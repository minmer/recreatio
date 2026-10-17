using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Rozmowy auflisten, ihre Mitglieder und Namen; eine Rozmowa anlegen.</summary>
public static partial class Chat
{
    /* ======================================================================
       DIE LISTE
       ====================================================================== */

    /// <summary>
    /// Meine Rozmowy — jede, deren Bereich eine meiner Rollen lesen darf, die
    /// neueste zuerst; mit ihren Mitgliedern (Kennung, Art), den versiegelten
    /// Namen und dem, was ich noch nicht gelesen habe.
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        if (mine.Count == 0)
        {
            await ctx.Response.WriteAsJsonAsync(new { chats = Array.Empty<object>() });
            return;
        }

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
        var rows = new List<(Guid Id, Guid Area, string AreaName, string Kind, DateTimeOffset Created, DateTimeOffset? Last,
            int Unread, int Seats, int Pending, Guid? Seat, byte[]? SeatSealed, int? SeatEpoch, Guid? SeatArea)>();

        /*
         * Ungelesen ist, was nicht von MIR kommt — auch was ein Platz schrieb
         * (0053): dort ist die Rolle NULL, und `NULL NOT IN (…)` ist nicht wahr.
         *
         * Und je Rozmowa eines Bereichs: wie viele Menschen mit Link dazu
         * gehoeren, und wie viele davon noch auf ihren Schluessel warten — der
         * Browser eines Mitglieds gibt ihn weiter, sobald er das sieht.
         */
        await using (var cmd = new SqlCommand($"""
            SELECT c.id, c.area_id, a.name, c.kind, c.created_at, c.last_message_at,
                   (SELECT COUNT(*) FROM app.chat_message m
                     WHERE m.chat_id = c.id AND m.schedule_state = N'sent' AND m.deleted_at IS NULL
                       AND (r.read_at IS NULL OR m.created_at > r.read_at)
                       AND (m.author_role_id IS NULL OR m.author_role_id NOT IN ({names})
                            /* 0095 — ein anderer aus derselben Gruppe: dieselbe Rolle, eine fremde Person */
                            OR (m.author_person_id IS NOT NULL AND m.author_person_id NOT IN ({names})))) AS unread,
                   (SELECT COUNT(*) FROM app.access s
                     WHERE {SeatOfChat} AND {LiveSeat("s")}) AS seats,
                   (SELECT COUNT(*) FROM app.access s
                     JOIN app.seat_identity i ON i.access_id = s.id
                     WHERE {SeatOfChat} AND {LiveSeat("s")}
                       AND NOT EXISTS (SELECT 1 FROM app.chat_seat_key k
                                        WHERE k.chat_id = c.id AND k.access_id = s.id
                                          AND k.epoch = a.current_epoch)) AS pending,
                   c.seat_id,
                   seat.name_sealed, seat.name_epoch, seat.area_id
            FROM app.chat c
            JOIN app.area a ON a.id = c.area_id
            LEFT JOIN app.chat_read r ON r.chat_id = c.id AND r.account_id = @account
            OUTER APPLY (SELECT x.name_sealed, x.name_epoch, x.area_id FROM app.access x WHERE x.id = c.seat_id) seat
            WHERE c.area_id IN (
                SELECT scope_id FROM app.certificate
                WHERE scope_kind = N'area' AND revoked_at IS NULL AND expires_at > @now
                  AND capability IN (N'read', N'write', N'admin')
                  AND subject_role_id IN ({names}))
            ORDER BY COALESCE(c.last_message_at, c.created_at) DESC;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@account", who.Value.AccountId);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3),
                    reader.GetDateTimeOffset(4), reader.IsDBNull(5) ? null : reader.GetDateTimeOffset(5),
                    reader.GetInt32(6), reader.GetInt32(7), reader.GetInt32(8),
                    reader.IsDBNull(9) ? null : reader.GetGuid(9),
                    reader.IsDBNull(10) ? null : (byte[])reader[10], Names.Int(reader, 11), reader.IsDBNull(12) ? null : reader.GetGuid(12)));
            }
        }

        var members = await MembersOfAsync(connection, rows.Select(r => r.Area).Distinct().ToList(), ctx.RequestAborted);
        var sealedNames = await NamesOfAsync(connection, rows.Select(r => r.Area).Distinct().ToList(), ctx.RequestAborted);
        var forms = await Audience.FormsAsync(connection, "chat", rows.Where(r => r.Kind is "area" or "channel").Select(r => r.Id).ToList(), ctx.RequestAborted);
        var commonPreferences = await PreferencesOfAsync(connection, who.Value.AccountId, Guid.Empty, ctx.RequestAborted) ?? new();
        var preferences = new Dictionary<Guid, Preferences>();
        foreach (var row in rows)
            preferences[row.Id] = await PreferencesOfAsync(connection, who.Value.AccountId, row.Id, ctx.RequestAborted) ?? commonPreferences;


        await ctx.Response.WriteAsJsonAsync(new
        {
            chats = rows.Select(r => new
            {
                chatId = Ids.ToText(r.Id),
                areaId = Ids.ToText(r.Area),
                areaName = r.AreaName,
                kind = r.Kind,
                createdAt = r.Created,
                lastMessageAt = r.Last,
                unread = r.Unread,
                preferences = preferences[r.Id],
                seats = r.Seats,
                pendingSeats = r.Pending,

                /* 0069 — die Rozmowa mit einem Platz: mit wem (der Name, den die Kanzlei am Platz fuehrt). */
                seatId = r.Seat is null ? null : Ids.ToText(r.Seat.Value),

                /* 0097 — versiegelt unter dem Schlüssel des Bereichs des Platzes. */
                seatNameSealed = r.SeatSealed is null ? null : Base64Url.Encode(r.SeatSealed),
                seatNameEpoch = r.SeatEpoch,
                seatAreaId = r.SeatArea is null ? null : Ids.ToText(r.SeatArea.Value),

                /* 0080 — die Formulare, deren Menschen in dieser Rozmowa (diesem Kanał) dabei sind. */
                formIds = forms.TryGetValue(r.Id, out var f) ? f.Select(x => Ids.ToText(x.ModuleId)).ToList() : [],
                members = members.TryGetValue(r.Area, out var m) ? m : [],
                names = sealedNames.TryGetValue(r.Area, out var n) ? n : []
            })
        });
    }

    /// <summary>Die Mitglieder der Bereiche — je Rolle einmal, mit ihren Stufen und oeffentlichen Schluesseln.</summary>
    private static async Task<Dictionary<Guid, List<object>>> MembersOfAsync(
        SqlConnection connection, IReadOnlyList<Guid> areas, CancellationToken ct)
    {
        var out_ = new Dictionary<Guid, List<object>>();
        if (areas.Count == 0) return out_;

        var names = string.Join(", ", areas.Select((_, i) => $"@a{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT c.scope_id, r.id, r.kind, r.wrap_public_key, r.sign_public_key, c.capability
            FROM app.certificate c
            JOIN app.role r ON r.id = c.subject_role_id AND r.revoked_at IS NULL
            WHERE c.scope_kind = N'area' AND c.scope_id IN ({names})
              AND c.revoked_at IS NULL AND c.expires_at > @now
            ORDER BY c.scope_id, r.id;
            """, connection);

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < areas.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", areas[i]);

        var grouped = new Dictionary<(Guid Area, Guid Role), (string Kind, byte[] Wrap, byte[] Sign, List<string> Caps)>();
        var order = new List<(Guid, Guid)>();

        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var key = (reader.GetGuid(0), reader.GetGuid(1));
                if (!grouped.TryGetValue(key, out var row))
                {
                    row = (reader.GetString(2), (byte[])reader[3], (byte[])reader[4], []);
                    grouped[key] = row;
                    order.Add(key);
                }
                var capability = reader.GetString(5);
                if (!row.Caps.Contains(capability)) row.Caps.Add(capability);
            }
        }

        foreach (var key in order)
        {
            var row = grouped[key];
            if (!out_.TryGetValue(key.Item1, out var list)) out_[key.Item1] = list = [];
            list.Add(new
            {
                roleId = Ids.ToText(key.Item2),
                kind = row.Kind,
                wrapPublicKey = Base64Url.Encode(row.Wrap),
                signPublicKey = Base64Url.Encode(row.Sign),
                capabilities = row.Caps
            });
        }

        return out_;
    }

    /// <summary>Die versiegelten Namen der Mitglieder — je Bereich.</summary>
    private static async Task<Dictionary<Guid, List<object>>> NamesOfAsync(
        SqlConnection connection, IReadOnlyList<Guid> areas, CancellationToken ct)
    {
        var out_ = new Dictionary<Guid, List<object>>();
        if (areas.Count == 0) return out_;

        var names = string.Join(", ", areas.Select((_, i) => $"@a{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT area_id, role_id, name_sealed, epoch FROM app.area_member_name WHERE area_id IN ({names});
            """, connection);
        for (var i = 0; i < areas.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", areas[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var area = reader.GetGuid(0);
            if (!out_.TryGetValue(area, out var list)) out_[area] = list = [];
            list.Add(new
            {
                roleId = Ids.ToText(reader.GetGuid(1)),
                nameSealed = Base64Url.Encode((byte[])reader[2]),
                epoch = reader.GetInt32(3)
            });
        }

        return out_;
    }

    /* ======================================================================
       ANLEGEN
       ====================================================================== */

    public sealed record CreateRequest(string ChatId, string AreaId, string Kind, string AsRoleId, string? WithRoleId, string PostingPolicy,

        /* 0069 — die Rozmowa mit diesem Platz (kind = seat). */
        string? SeatId = null);

    /// <summary>
    /// EINEN CHAT ANLEGEN — am Bereich, den der Browser dafuer gewaehlt oder
    /// gerade angelegt hat.
    ///
    /// <para>
    /// <b>Ein Bereich, ein Chat.</b> Zu einem bestehenden Bereich darf ihn
    /// anlegen, wer dort schreibt; zu einem eigenen (Gruppe, zu zweit), wer ihn
    /// fuehrt — das ist, wer ihn eben angelegt hat. Zu zweit gibt es jede
    /// Paarung nur einmal: wer eine zweite anlegen will, bekommt die erste.
    /// </para>
    /// </summary>
    private static async Task CreateAsync(HttpContext ctx, Db db, CreateRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.ChatId, out var chatId) || !Guid.TryParse(body.AreaId, out var areaId)
            || !Guid.TryParse(body.AsRoleId, out var asRole))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        if (body.Kind is not ("area" or "channel" or "group" or "direct" or "self" or "seat"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj rozmowy: area, channel, group, direct, self albo seat.");
            return;
        }

        if (body.PostingPolicy is not ("members" or "writers"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zasada rozmowy: members albo writers.");
            return;
        }

        /*
         * 0080 — wo die Art es sagt, sagt sie es (<see cref="ChatRules.FixedPolicy"/>):
         * im Kanał schreiben die Schreibenden, in der Rozmowa des Bereichs alle
         * darin, in den Notatki nur ich. Sonst wählt der Browser.
         */
        var kind = body.Kind;
        var policy = kind switch { "channel" => "writers", "area" or "self" => "members", _ => body.PostingPolicy };

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        if (!mine.Contains(asRole))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W imieniu tej roli nie rozmawiasz.");
            return;
        }

        /* 0069 — mit einem Menschen vom Formular spricht, wer dessen Antworten lesen darf. */
        var needed = kind is "area" or "channel" ? Writers : kind == "seat" ? Readers : ["admin"];
        if (!(await HoldingAsync(connection, [asRole], areaId, needed, ctx.RequestAborted)).Contains(asRole))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, kind == "area" ? "Rozmowę obszaru zakłada ktoś, kto w nim pisze."
                : kind == "channel" ? "Kanał obszaru zakłada ktoś, kto w nim pisze."
                : "Ta rola nie prowadzi obszaru tej rozmowy.");
            return;
        }

        /*
         * 0062 — NOTATKI: die Rozmowa mit sich selbst. Sie liegt im EIGENEN
         * Bereich dieser Person (0054) — dort ist niemand sonst, und je Person
         * gibt es ihn nur einmal, also auch nur eine solche Rozmowa.
         */
        if (kind == "self")
        {
            await using var own = new SqlCommand("SELECT personal_role_id FROM app.area WHERE id = @area;", connection);
            own.Parameters.AddWithValue("@area", areaId);
            if (await own.ExecuteScalarAsync(ctx.RequestAborted) is not Guid owner || owner != asRole)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Notatki należą do własnego obszaru tej osoby.");
                return;
            }
        }

        /* 0080 — der eigene Bereich einer Gruppe, eines Gesprächs zu zweit, der Notatki IST schon eine Rozmowa: kein Kanał daneben. */
        if (kind == "channel")
        {
            await using var own = new SqlCommand(
                "SELECT TOP 1 1 FROM app.chat WHERE area_id = @area AND kind IN (N'group', N'direct', N'self');", connection);
            own.Parameters.AddWithValue("@area", areaId);
            if (await own.ExecuteScalarAsync(ctx.RequestAborted) is not null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Ten obszar należy do własnej rozmowy (grupy, we dwoje, notatek) — kanał załóż w innym obszarze.");
                return;
            }
        }

        /*
         * 0069 — DIE ROZMOWA MIT EINEM PLATZ. Er muss leben; je Platz und
         * Bereich gibt es sie einmal — wer eine zweite anlegen will, bekommt
         * die erste.
         *
         * 0080 — der Zugang „einer mit einem" (`Audience`): an JEDEM Bereich,
         * der mit ihm zu tun hat (`Audience.MayMeetAsync`) — etwa „Ksiądz",
         * ohne dass alle mitlesen, die „Kandydaci" lesen.
         */
        Guid? seatId = null;
        if (kind == "seat")
        {
            if (!Guid.TryParse(body.SeatId, out var wanted))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Z kim? Brakuje osoby z formularza.");
                return;
            }

            if (!await Audience.MayMeetAsync(connection, wanted, areaId, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound,
                    "Ta osoba nie wypełniła formularza tego obszaru (ani obszaru pod nim) — albo jej link już nie działa.");
                return;
            }

            await using var existing = new SqlCommand("SELECT id FROM app.chat WHERE seat_id = @seat AND area_id = @area;", connection);
            existing.Parameters.AddWithValue("@seat", wanted);
            existing.Parameters.AddWithValue("@area", areaId);
            if (await existing.ExecuteScalarAsync(ctx.RequestAborted) is Guid already)
            {
                ctx.Response.StatusCode = StatusCodes.Status409Conflict;
                await ctx.Response.WriteAsJsonAsync(new { error = "Ta rozmowa już istnieje.", verdict = "exists", chatId = Ids.ToText(already) });
                return;
            }

            seatId = wanted;
        }

        string? pair = null;
        if (kind == "direct")
        {
            if (!Guid.TryParse(body.WithRoleId, out var with) || with == asRole)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Rozmowa we dwoje potrzebuje drugiej osoby albo roli.");
                return;
            }

            /* Beide stehen schon im Bereich — der Browser hat den zweiten eben hineingenommen. */
            if (!(await HoldingAsync(connection, [with], areaId, Writers, ctx.RequestAborted)).Contains(with))
            {
                await Fail(ctx, StatusCodes.Status409Conflict, "Druga strona nie jest jeszcze w obszarze tej rozmowy.");
                return;
            }

            var sorted = new[] { Ids.ToText(asRole), Ids.ToText(with) }.OrderBy(x => x, StringComparer.Ordinal).ToArray();
            pair = $"{sorted[0]}|{sorted[1]}";

            await using var existing = new SqlCommand("SELECT id FROM app.chat WHERE pair_key = @pair;", connection);
            existing.Parameters.AddWithValue("@pair", pair);
            if (await existing.ExecuteScalarAsync(ctx.RequestAborted) is Guid already)
            {
                ctx.Response.StatusCode = StatusCodes.Status409Conflict;
                await ctx.Response.WriteAsJsonAsync(new
                {
                    error = "Ta rozmowa już istnieje.",
                    verdict = "exists",
                    chatId = Ids.ToText(already)
                });
                return;
            }
        }

        await using var insert = new SqlCommand("""
            INSERT INTO app.chat (id, area_id, kind, pair_key, created_by_role_id, created_at, posting_policy, seat_id)
            VALUES (@id, @area, @kind, @pair, @by, @now, @policy, @seat);
            """, connection);
        insert.Parameters.AddWithValue("@id", chatId);
        insert.Parameters.AddWithValue("@seat", (object?)seatId ?? DBNull.Value);
        insert.Parameters.AddWithValue("@area", areaId);
        insert.Parameters.AddWithValue("@kind", kind);
        insert.Parameters.AddWithValue("@policy", policy);
        insert.Parameters.AddWithValue("@pair", (object?)pair ?? DBNull.Value);
        insert.Parameters.AddWithValue("@by", asRole);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            /* 0080 — die Rozmowa (der Kanał) dieses Bereichs gibt es schon: dann ist SIE es. */
            Guid? had = null;
            if (kind is "area" or "channel")
            {
                await using var find = new SqlCommand(kind == "channel"
                    ? "SELECT id FROM app.chat WHERE area_id = @area AND kind = N'channel';"
                    : "SELECT id FROM app.chat WHERE area_id = @area AND seat_id IS NULL AND kind <> N'channel';", connection);
                find.Parameters.AddWithValue("@area", areaId);
                had = await find.ExecuteScalarAsync(ctx.RequestAborted) as Guid?;
            }

            ctx.Response.StatusCode = StatusCodes.Status409Conflict;
            await ctx.Response.WriteAsJsonAsync(new
            {
                error = seatId is not null ? "Ta rozmowa już istnieje."
                    : kind == "channel" ? "Ten obszar ma już swój kanał." : "Ten obszar ma już swoją rozmowę.",
                verdict = had is null ? null : "exists",
                chatId = had is null ? null : Ids.ToText(had.Value)
            });
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { chatId = Ids.ToText(chatId), areaId = Ids.ToText(areaId), kind });
    }
}
