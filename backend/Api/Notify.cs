using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// POWIADOMIENIA (0067) — was neu ist, als ZAHLEN.
///
/// <para>
/// <b>Eine Frage, eine Antwort.</b> Der Browser (und die App) fragt
/// <c>/workspace/notifications</c> und bekommt in einem Rutsch: ungelesene
/// Nachrichten je Rozmowa, neue Anmeldungen je Formular, eingelöste Links,
/// offene Aufgaben. Keine Inhalte — die liegen versiegelt und gingen nur im
/// Browser auf. Wie oft gefragt wird, entscheidet der Browser
/// (<c>notify.ts</c>): sparsam, damit der Akku hält. <c>nextPollSeconds</c>
/// ist nur ein Rat.
/// </para>
///
/// <para>
/// <b>Das Gerät</b> (<c>app.notify_device</c>): die App auf dem Telefon fragt
/// auch geschlossen — ein Arbeiter des Systems ohne Sitzungscookie. Er weist
/// sich mit einem Zufallswert aus (<c>X-Notify-Token</c>), dessen Abdruck hier
/// liegt; er öffnet nur diese Zahlen.
/// </para>
/// </summary>
public static class Notify
{
    private const int MaxDevices = 20;

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/notifications", DigestAsync);
        app.MapGet("/workspace/notify-devices", DevicesAsync);
        app.MapPost("/workspace/notify-devices", RegisterAsync);
        app.MapDelete("/workspace/notify-devices/{id:guid}", RevokeAsync);

        /* Ohne Sitzung — für den Arbeiter der App. */
        app.MapGet("/notify/digest", DeviceDigestAsync);
    }

    public sealed record DeviceRequest(string Token, string? Label, string? Platform);

    private static async Task DigestAsync(HttpContext ctx, Db db, string? since)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(await BuildAsync(connection, who.Value.AccountId, Since(since), ctx.RequestAborted));
    }

    private static async Task DeviceDigestAsync(HttpContext ctx, Db db, string? since)
    {
        var token = ctx.Request.Headers["X-Notify-Token"].ToString();
        if (!Base64Url.TryDecode(token, out var raw) || raw.Length != 32)
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        Guid account;
        await using (var cmd = new SqlCommand("""
            UPDATE app.notify_device SET last_seen_at = @now
            OUTPUT inserted.account_id
            WHERE token_sha256 = @hash AND revoked_at IS NULL;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@hash", SHA256.HashData(raw));
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return;
            }
            account = found;
        }

        await ctx.Response.WriteAsJsonAsync(await BuildAsync(connection, account, Since(since), ctx.RequestAborted, countsOnly: true));
    }

    /// <summary>Ohne Angabe: die letzten drei Tage. Weiter zurück als 60 Tage fragt niemand sinnvoll.</summary>
    private static DateTimeOffset Since(string? text)
    {
        var now = DateTimeOffset.UtcNow;
        if (!DateTimeOffset.TryParse(text, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out var since)) return now.AddDays(-3);
        return since < now.AddDays(-60) ? now.AddDays(-60) : since > now ? now : since;
    }

    /// <summary>
    /// Die Zahlen eines Kontos. <paramref name="countsOnly"/>: für das Gerät —
    /// ohne Namen von Bereichen und Formularen (die Benachrichtigung auf dem
    /// Sperrbildschirm sagt „3 nowe wiadomości", nicht wo).
    /// </summary>
    internal static async Task<object> BuildAsync(SqlConnection connection, Guid account, DateTimeOffset since, CancellationToken ct, bool countsOnly = false)
    {
        var now = DateTimeOffset.UtcNow;
        var mine = (await Workspace.RolesOfAsync(connection, account, ct)).Select(r => r.Id).ToList();

        /* -- Rozmowy: ungelesen, was nicht von mir kommt (wie die Liste der Rozmowy). */
        var chats = new List<(Guid Id, string Area, string Kind, int Unread, DateTimeOffset? Last, string? Seat, bool Quiet)>();
        if (mine.Count > 0)
        {
            var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT c.id, a.name, c.kind,
                       (SELECT COUNT(*) FROM app.chat_message m
                         WHERE m.chat_id = c.id AND m.schedule_state = N'sent' AND m.deleted_at IS NULL
                           AND (r.read_at IS NULL OR m.created_at > r.read_at)
                           AND (m.author_role_id IS NULL OR m.author_role_id NOT IN ({names}))) AS unread,
                       c.last_message_at,
                       (SELECT x.recipient_name FROM app.access x WHERE x.id = c.seat_id)
                FROM app.chat c
                JOIN app.area a ON a.id = c.area_id
                LEFT JOIN app.chat_read r ON r.chat_id = c.id AND r.account_id = @account
                WHERE c.last_message_at IS NOT NULL
                  AND (r.read_at IS NULL OR c.last_message_at > r.read_at)
                  AND c.area_id IN (
                    SELECT scope_id FROM app.certificate
                    WHERE scope_kind = N'area' AND revoked_at IS NULL AND expires_at > @now
                      AND capability IN (N'read', N'write', N'admin')
                      AND subject_role_id IN ({names}));
                """, connection);
            cmd.Parameters.AddWithValue("@account", account);
            cmd.Parameters.AddWithValue("@now", now);
            for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var unread = reader.GetInt32(3);
                if (unread == 0) continue;
                chats.Add((reader.GetGuid(0), reader.GetString(1), reader.GetString(2), unread,
                    reader.IsDBNull(4) ? null : reader.GetDateTimeOffset(4), reader.IsDBNull(5) ? null : reader.GetString(5), false));
            }
        }

        /* Stumm, archiviert, ausserhalb der eigenen Zeiten: zählt mit, meldet sich aber nicht. */
        for (var i = 0; i < chats.Count; i++)
            if (await Chat.QuietAsync(connection, account, chats[i].Id, ct)) chats[i] = chats[i] with { Quiet = true };

        /* -- Anmeldungen: neu seit `since`, in Formularen, deren Bereich ich lesen kann. */
        var held = await Agenda.HeldAreasAsync(connection, account, ct);
        var forms = new List<(Guid Id, string Name, int Count, DateTimeOffset Last)>();
        if (held.Count > 0)
        {
            var names = string.Join(", ", held.Select((_, i) => $"@h{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT m.id, m.name, COUNT(*), MAX(r.submitted_at)
                FROM app.registration r
                JOIN app.module m ON m.id = r.part_id
                WHERE r.submitted_at > @since AND r.is_hidden = 0 AND r.withdrawn_at IS NULL
                  AND m.area_id IN ({names})
                GROUP BY m.id, m.name
                ORDER BY MAX(r.submitted_at) DESC;
                """, connection);
            cmd.Parameters.AddWithValue("@since", since);
            for (var i = 0; i < held.Count; i++) cmd.Parameters.AddWithValue($"@h{i}", held[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                forms.Add((reader.GetGuid(0), reader.GetString(1), reader.GetInt32(2), reader.GetDateTimeOffset(3)));
        }

        /* -- Links mit Zugang (0065): wer seit `since` über einen meiner Links hereinkam. */
        var links = 0;
        if (mine.Count > 0)
        {
            var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT COUNT(*) FROM app.invitation_redemption x
                JOIN app.invitation i ON i.id = x.invitation_id
                WHERE x.redeemed_at > @since AND i.purpose = N'area-link' AND i.created_by_role_id IN ({names});
                """, connection);
            cmd.Parameters.AddWithValue("@since", since);
            for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);
            links = (int)(await cmd.ExecuteScalarAsync(ct))!;
        }

        var tasks = await Tasks.OpenNowAsync(connection, held, now, ct);
        var unreadTotal = chats.Sum(c => c.Unread);
        var loudTotal = chats.Where(c => !c.Quiet).Sum(c => c.Unread);
        var formsTotal = forms.Sum(f => f.Count);

        return new
        {
            now,
            since,
            total = unreadTotal + formsTotal + links,
            chats = new
            {
                unread = unreadTotal,

                /* Was sich melden darf — ohne stumme und archivierte Rozmowy. */
                loud = loudTotal,
                list = countsOnly ? [] : chats.OrderByDescending(c => c.Last).Take(30).Select(c => (object)new
                {
                    chatId = Ids.ToText(c.Id),
                    areaName = c.Area,
                    kind = c.Kind,
                    unread = c.Unread,
                    lastMessageAt = c.Last,
                    seatName = c.Seat,
                    quiet = c.Quiet
                }).ToList()
            },
            registrations = new
            {
                count = formsTotal,
                list = countsOnly ? [] : forms.Take(30).Select(f => (object)new
                {
                    moduleId = Ids.ToText(f.Id),
                    name = f.Name,
                    count = f.Count,
                    lastAt = f.Last
                }).ToList()
            },
            links,
            tasks,

            /* Ein Rat, kein Befehl: ist etwas offen, lohnt eine Minute; sonst reichen zwei. */
            nextPollSeconds = unreadTotal + formsTotal > 0 ? 60 : 120
        };
    }

    private static async Task DevicesAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand("""
            SELECT id, label, platform, created_at, last_seen_at FROM app.notify_device
            WHERE account_id = @account AND revoked_at IS NULL ORDER BY created_at DESC;
            """, connection);
        cmd.Parameters.AddWithValue("@account", who.Value.AccountId);

        var devices = new List<object>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            devices.Add(new
            {
                deviceId = Ids.ToText(reader.GetGuid(0)),
                label = reader.IsDBNull(1) ? null : reader.GetString(1),
                platform = reader.GetString(2),
                createdAt = reader.GetDateTimeOffset(3),
                lastSeenAt = reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(4)
            });
        }

        await ctx.Response.WriteAsJsonAsync(new { devices });
    }

    /// <summary>Ein Gerät anmelden — den Zufallswert erzeugt die App; hier liegt nur sein Abdruck.</summary>
    private static async Task RegisterAsync(HttpContext ctx, Db db, DeviceRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Base64Url.TryDecode(body.Token, out var raw) || raw.Length != 32)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz urządzenia.");
            return;
        }

        var platform = body.Platform is "web" ? "web" : "android";
        var label = (body.Label ?? "").Trim();
        if (label.Length > 100) label = label[..100];

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using (var count = new SqlCommand("SELECT COUNT(*) FROM app.notify_device WHERE account_id = @account AND revoked_at IS NULL;", connection))
        {
            count.Parameters.AddWithValue("@account", who.Value.AccountId);
            if ((int)(await count.ExecuteScalarAsync(ctx.RequestAborted))! >= MaxDevices)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, $"Najwyżej {MaxDevices} urządzeń — usuń któreś w ustawieniach powiadomień.");
                return;
            }
        }

        var id = Ids.NewId();
        await using var insert = new SqlCommand("""
            INSERT INTO app.notify_device (id, account_id, token_sha256, label, platform, created_at)
            VALUES (@id, @account, @hash, @label, @platform, @now);
            """, connection);
        insert.Parameters.AddWithValue("@id", id);
        insert.Parameters.AddWithValue("@account", who.Value.AccountId);
        insert.Parameters.AddWithValue("@hash", SHA256.HashData(raw));
        insert.Parameters.AddWithValue("@label", label.Length == 0 ? DBNull.Value : label);
        insert.Parameters.AddWithValue("@platform", platform);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "To urządzenie już jest.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { deviceId = Ids.ToText(id) });
    }

    private static async Task RevokeAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand("""
            UPDATE app.notify_device SET revoked_at = @now WHERE id = @id AND account_id = @account AND revoked_at IS NULL;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@account", who.Value.AccountId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        var done = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { deviceId = Ids.ToText(id), revoked = done > 0 });
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
