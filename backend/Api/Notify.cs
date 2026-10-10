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

        /* 0090 — „przejrzane" je Konto: alles, ein Formular, die Links. */
        app.MapPost("/workspace/notifications/seen", SeenAsync);
        app.MapGet("/workspace/notify-devices", DevicesAsync);
        app.MapPost("/workspace/notify-devices", RegisterAsync);
        app.MapDelete("/workspace/notify-devices/{id:guid}", RevokeAsync);

        /* Ohne Sitzung — für den Arbeiter der App. */
        app.MapGet("/notify/digest", DeviceDigestAsync);

        /* 0075 — die FCM-Kennung des Geräts (die App meldet sie selbst, auch wenn Firebase sie erneuert). */
        app.MapPost("/notify/push-token", PushTokenAsync);
    }

    public sealed record DeviceRequest(string Token, string? Label, string? Platform);

    public sealed record PushTokenRequest(string? PushToken);

    /// <summary>0090 — was gesehen ist: <c>all</c>, <c>form</c> (mit <c>subject</c>) oder <c>links</c>; bis <c>at</c> (ohne: jetzt).</summary>
    public sealed record SeenRequest(string? Kind, string? Subject, string? At);

    /// <summary>Weiter zurück als so viele Tage gilt nichts mehr als neu.</summary>
    private const int MaxNewDays = 60;

    /// <summary>So viel war vor 0090 neu — die erste Marke eines Kontos steht so weit zurück.</summary>
    private const int FirstNewDays = 3;

    /// <summary>Das Gerät nach seinem Kennzeichen (<c>X-Notify-Token</c>) — <c>null</c>: unbekannt oder zurückgezogen.</summary>
    private static async Task<Guid?> DeviceOfAsync(HttpContext ctx, SqlConnection connection)
    {
        var token = ctx.Request.Headers["X-Notify-Token"].ToString();
        if (!Base64Url.TryDecode(token, out var raw) || raw.Length != 32) return null;
        await using var cmd = new SqlCommand("SELECT id FROM app.notify_device WHERE token_sha256 = @hash AND revoked_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@hash", SHA256.HashData(raw));
        return await cmd.ExecuteScalarAsync(ctx.RequestAborted) as Guid?;
    }

    /// <summary>
    /// 0075 — die FCM-Kennung eines Geräts setzen (oder mit <c>null</c> löschen).
    /// Ohne Sitzung, mit dem Gerätekennzeichen: Firebase erneuert die Kennung
    /// auch, wenn die App zu ist, und dann meldet sie der Dienst der App selbst.
    /// </summary>
    private static async Task PushTokenAsync(HttpContext ctx, Db db, PushTokenRequest body)
    {
        var push = (body.PushToken ?? "").Trim();
        if (push.Length > 512 || push.Any(c => char.IsWhiteSpace(c) || char.IsControl(c)))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny token push.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var device = await DeviceOfAsync(ctx, connection);
        if (device is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using (var cmd = new SqlCommand("""
            UPDATE app.notify_device SET push_token = NULL, push_error = NULL WHERE push_token = @push AND id <> @id;
            UPDATE app.notify_device SET push_token = @push, push_error = NULL, last_seen_at = @now WHERE id = @id;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", device.Value);
            cmd.Parameters.Add("@push", System.Data.SqlDbType.NVarChar, 512).Value = push.Length == 0 ? DBNull.Value : push;
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { deviceId = Ids.ToText(device.Value), push = push.Length > 0 });
    }

    private static async Task DigestAsync(HttpContext ctx, Db db, string? since)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(await BuildAsync(connection, who.Value.AccountId, Asked(since), ctx.RequestAborted));
    }

    /// <summary>
    /// 0090 — GESEHEN, FÜR DAS KONTO. Die Marke wandert nur vorwärts: ein
    /// Gerät, das spät mit einer alten Zeit kommt, macht nichts wieder neu.
    /// „Alles" räumt die engeren Marken weg, die es jetzt einschliesst.
    /// </summary>
    private static async Task SeenAsync(HttpContext ctx, Db db, SeenRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var kind = body.Kind ?? "all";
        if (kind is not ("all" or "form" or "links"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj: all, form albo links.");
            return;
        }

        var subject = Guid.Empty;
        if (kind == "form" && !Guid.TryParse(body.Subject, out subject))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Którego formularza?");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var at = Asked(body.At) ?? now;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (kind == "form")
        {
            await using var known = new SqlCommand("SELECT COUNT(*) FROM app.module WHERE id = @id;", connection);
            known.Parameters.AddWithValue("@id", subject);
            if ((int)(await known.ExecuteScalarAsync(ctx.RequestAborted))! == 0)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego formularza nie ma.");
                return;
            }
        }

        var before = await MarkAsync(connection, who.Value.AccountId, kind, subject, at, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new
        {
            kind,
            subjectId = kind == "form" ? Ids.ToText(subject) : null,
            seenAt = before is { } b && b > at ? b : at,
            before
        });
    }

    /// <summary>Eine Marke setzen (nie zurück) — gibt die vorige zurück, <c>null</c>: es gab keine.</summary>
    internal static async Task<DateTimeOffset?> MarkAsync(SqlConnection connection, Guid account, string kind, Guid subject, DateTimeOffset at, CancellationToken ct)
    {
        DateTimeOffset? before = null;
        await using (var cmd = new SqlCommand("""
            DECLARE @before datetimeoffset(7) = (SELECT seen_at FROM app.notify_seen WITH (UPDLOCK, HOLDLOCK)
                                                  WHERE account_id = @account AND kind = @kind AND subject_id = @subject);
            IF @before IS NULL
                INSERT INTO app.notify_seen (account_id, kind, subject_id, seen_at) VALUES (@account, @kind, @subject, @at);
            ELSE IF @before < @at
                UPDATE app.notify_seen SET seen_at = @at WHERE account_id = @account AND kind = @kind AND subject_id = @subject;
            IF @kind = N'all'
                DELETE FROM app.notify_seen WHERE account_id = @account AND kind <> N'all' AND seen_at <= @at;
            SELECT @before;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@account", account);
            cmd.Parameters.Add("@kind", System.Data.SqlDbType.NVarChar, 8).Value = kind;
            cmd.Parameters.AddWithValue("@subject", subject);
            cmd.Parameters.AddWithValue("@at", at);
            if (await cmd.ExecuteScalarAsync(ct) is DateTimeOffset found) before = found;
        }
        return before;
    }

    /// <summary>
    /// Die Marken eines Kontos: „alles" (fehlt sie, steht sie ab jetzt drei Tage
    /// zurück), die Links, je Formular.
    /// </summary>
    internal static async Task<(DateTimeOffset All, DateTimeOffset? Links)> MarksAsync(SqlConnection connection, Guid account, DateTimeOffset now, CancellationToken ct)
    {
        DateTimeOffset? all = null, links = null;
        await using (var cmd = new SqlCommand(
            "SELECT kind, seen_at FROM app.notify_seen WHERE account_id = @account AND kind IN (N'all', N'links');", connection))
        {
            cmd.Parameters.AddWithValue("@account", account);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                if (reader.GetString(0) == "all") all = reader.GetDateTimeOffset(1); else links = reader.GetDateTimeOffset(1);
            }
        }

        if (all is null)
        {
            all = now.AddDays(-FirstNewDays);
            await MarkAsync(connection, account, "all", Guid.Empty, all.Value, ct);
        }
        return (all.Value, links);
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

        await ctx.Response.WriteAsJsonAsync(await BuildAsync(connection, account, Asked(since), ctx.RequestAborted, countsOnly: true));
    }

    /// <summary>
    /// Eine Zeit vom Gerät — <c>null</c>: keine (oder unlesbar). Weiter zurück
    /// als 60 Tage fragt niemand sinnvoll, in der Zukunft liegt nichts.
    /// </summary>
    private static DateTimeOffset? Asked(string? text)
    {
        var now = DateTimeOffset.UtcNow;
        if (!DateTimeOffset.TryParse(text, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out var at)) return null;
        return at < now.AddDays(-MaxNewDays) ? now.AddDays(-MaxNewDays) : at > now ? now : at;
    }

    /// <summary>Die spätere von zwei Zeiten — <c>null</c> zählt nicht.</summary>
    private static DateTimeOffset Later(DateTimeOffset one, DateTimeOffset? other) => other is { } o && o > one ? o : one;

    /// <summary>
    /// Die Zahlen eines Kontos. <paramref name="countsOnly"/>: für das Gerät —
    /// ohne Namen von Bereichen und Formularen (die Benachrichtigung auf dem
    /// Sperrbildschirm sagt „3 nowe wiadomości", nicht wo).
    ///
    /// <para>
    /// 0090 — NEU IST, WAS DAS KONTO NOCH NICHT GESEHEN HAT. Die Marken liegen
    /// beim Dienst (<see cref="MarksAsync"/>); <paramref name="asked"/> (ein
    /// Gerät mit eigener, älterer Marke im Speicher) kann nur weiter nach vorn
    /// rücken, nie etwas wieder neu machen.
    /// </para>
    /// </summary>
    internal static async Task<object> BuildAsync(SqlConnection connection, Guid account, DateTimeOffset? asked, CancellationToken ct, bool countsOnly = false)
    {
        var now = DateTimeOffset.UtcNow;
        var marks = await MarksAsync(connection, account, now, ct);
        var since = Later(Later(now.AddDays(-MaxNewDays), marks.All), asked);
        var linksSince = Later(since, marks.Links);
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

        /*
         * -- 0081: WER AUF SEINEN SCHLÜSSEL WARTET. Rozmowy meiner Bereiche, in denen
         * ein Mensch mit Link schon da ist (seine Identität steht), aber den
         * Chatschlüssel der laufenden Epoche noch nicht hat — etwa weil er eben
         * selbst angefangen hat („Napisz do nas"). Die App eines Mitglieds gibt ihn
         * weiter, sobald sie das hier liest; niemand muss dafür die Rozmowa öffnen.
         */
        var waiting = new List<Guid>();
        if (!countsOnly && mine.Count > 0)
        {
            var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT TOP 20 c.id FROM app.chat c
                JOIN app.area a ON a.id = c.area_id
                WHERE c.kind IN (N'area', N'channel', N'seat')
                  AND c.area_id IN (
                    SELECT scope_id FROM app.certificate
                    WHERE scope_kind = N'area' AND revoked_at IS NULL AND expires_at > @now
                      AND capability IN (N'read', N'write', N'admin') AND subject_role_id IN ({names}))
                  AND EXISTS (
                    SELECT 1 FROM app.access s JOIN app.seat_identity i ON i.access_id = s.id
                    WHERE {ChatRules.SeatOfChat} AND {Audience.LiveSeat("s")}
                      AND NOT EXISTS (SELECT 1 FROM app.chat_seat_key k
                                       WHERE k.chat_id = c.id AND k.access_id = s.id AND k.epoch = a.current_epoch));
                """, connection);
            cmd.Parameters.AddWithValue("@now", now);
            for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) waiting.Add(reader.GetGuid(0));
        }

        /*
         * -- 0091: WER AUF DEN SCHLÜSSEL SEINER ROLLE WARTET. Formulare, deren Rolle ich
         * halte und deren Menschen ich öffnen kann (die Kanzlei): dort hat jemand
         * eingesandt und gehört schon dazu, aber den Schlüssel der Rolle hat er noch
         * nicht. Der Browser gibt ihn weiter, sobald er das hier liest (`memberRole.ts`).
         */
        var rolesWaiting = new List<Guid>();
        if (!countsOnly && mine.Count > 0)
        {
            var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT DISTINCT TOP 20 ar.module_id FROM app.access_role ar
                JOIN app.access s ON s.id = ar.access_id
                JOIN app.module m ON m.id = ar.module_id AND m.member_role_id = ar.role_id
                WHERE ar.key_sealed IS NULL AND ar.role_id IN ({names})
                  AND {Form.LiveMember} AND {Form.OpensSeat(names)};
                """, connection);
            cmd.Parameters.AddWithValue("@now", now);
            for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) rolesWaiting.Add(reader.GetGuid(0));
        }

        /*
         * -- Anmeldungen: neu seit `since`, in Formularen, deren Bereich ich lesen kann —
         *    und, 0090, nach der Marke des Formulars (die Kanzlei hat die Liste geöffnet).
         */
        var held = await Agenda.HeldAreasAsync(connection, account, ct);
        var forms = new List<(Guid Id, string Name, int Count, DateTimeOffset Last, DateTimeOffset Since)>();
        if (held.Count > 0)
        {
            var names = string.Join(", ", held.Select((_, i) => $"@h{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT m.id, m.name, COUNT(*), MAX(r.submitted_at), MAX(s.seen_at)
                FROM app.registration r
                JOIN app.module m ON m.id = r.part_id
                LEFT JOIN app.notify_seen s ON s.account_id = @account AND s.kind = N'form' AND s.subject_id = m.id
                WHERE r.submitted_at > @since AND (s.seen_at IS NULL OR r.submitted_at > s.seen_at)
                  AND r.is_hidden = 0 AND r.withdrawn_at IS NULL
                  /*
                   * 0077 — nur, was ein MENSCH eingesandt hat. Was die Kanzlei
                   * selbst eintraegt (jemanden auf die Liste, eine Erweiterung
                   * „nur fuer den Koordinator", den Haken eines Monats), ist
                   * keine Neuigkeit fuer sie — sonst meldete die Glocke jeden
                   * eigenen Haken.
                   */
                  AND r.by_office = 0
                  AND (r.access_id IS NOT NULL OR r.role_id IS NOT NULL OR r.claim_sha256 IS NOT NULL)
                  AND m.area_id IN ({names})
                GROUP BY m.id, m.name
                ORDER BY MAX(r.submitted_at) DESC;
                """, connection);
            cmd.Parameters.AddWithValue("@since", since);
            cmd.Parameters.AddWithValue("@account", account);
            for (var i = 0; i < held.Count; i++) cmd.Parameters.AddWithValue($"@h{i}", held[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                forms.Add((reader.GetGuid(0), reader.GetString(1), reader.GetInt32(2), reader.GetDateTimeOffset(3),
                    Later(since, reader.IsDBNull(4) ? null : reader.GetDateTimeOffset(4))));
            }
        }

        /* -- Links mit Zugang (0065): wer seit `linksSince` über einen meiner Links hereinkam. */
        var links = 0;
        if (mine.Count > 0)
        {
            var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT COUNT(*) FROM app.invitation_redemption x
                JOIN app.invitation i ON i.id = x.invitation_id
                WHERE x.redeemed_at > @since AND i.purpose = N'area-link' AND i.created_by_role_id IN ({names});
                """, connection);
            cmd.Parameters.AddWithValue("@since", linksSince);
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

            /* 0090 — seit wann Links als neu gelten (die Marke der Links kann später liegen). */
            linksSince,
            total = unreadTotal + formsTotal + links,
            chats = new
            {
                unread = unreadTotal,

                /* Was sich melden darf — ohne stumme und archivierte Rozmowy. */
                loud = loudTotal,

                /*
                 * 0076 — die jüngste ungelesene laute Nachricht, als Zeit. Daran
                 * sieht das Telefon (auch mit den blossen Zahlen) eine NEUE
                 * Nachricht, wenn die Summe gleich blieb — eine Rozmowa gelesen,
                 * in einer anderen etwas Neues —, und öffnet nur dann den Inhalt.
                 */
                newestAt = chats.Where(c => !c.Quiet).Select(c => c.Last).Max(),

                /* 0081 — wo ein Mensch mit Link auf seinen Schlüssel wartet: die App gibt ihn weiter. */
                waiting = waiting.Select(Ids.ToText).ToList(),
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
                    lastAt = f.Last,

                    /* 0090 — seit wann hier neu gilt: die Marke des Formulars, sonst die allgemeine. */
                    since = f.Since
                }).ToList()
            },
            links,
            tasks,

            /* 0091 — Formulare, deren Menschen auf den Schlüssel ihrer Rolle warten: die App gibt ihn weiter. */
            roles = new { waiting = rolesWaiting.Select(Ids.ToText).ToList() },

            /* Ein Rat, kein Befehl: ist etwas offen, lohnt eine Minute; sonst reichen zwei. */
            nextPollSeconds = unreadTotal + formsTotal > 0 ? 60 : 120
        };
    }

    private static async Task DevicesAsync(HttpContext ctx, Db db, Push push)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand("""
            SELECT id, label, platform, created_at, last_seen_at, CASE WHEN push_token IS NULL THEN 0 ELSE 1 END, push_at, push_error FROM app.notify_device
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
                lastSeenAt = reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(4),
                push = reader.GetInt32(5) == 1,
                pushAt = reader.IsDBNull(6) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(6),
                pushError = reader.IsDBNull(7) ? null : reader.GetString(7)
            });
        }

        /* 0075 — schickt dieser Dienst Push? Ohne Firebase-Zugang nur das Fragen im Takt. */
        await ctx.Response.WriteAsJsonAsync(new { devices, push = new { available = push.Available } });
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
            UPDATE app.notify_device SET revoked_at = @now, push_token = NULL WHERE id = @id AND account_id = @account AND revoked_at IS NULL;
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
