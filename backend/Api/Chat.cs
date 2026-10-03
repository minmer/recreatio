using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// ROZMOWY (0052) — Chats auf dem Kern der Bereiche.
///
/// <para>
/// <b>Jeder Chat liegt an einem Bereich</b>, und der Zugang zum Chat IST der
/// Zugang zum Bereich: wer ihn lesen darf, liest mit; wer darin schreiben
/// darf, schreibt; wer darin hineinlaesst, nimmt Menschen in den Chat. Es
/// gibt deshalb keine eigene Mitgliederliste und keine eigene Schluessel —
/// nur zwei Oberflaechen fuer dieselbe Sache: die Einstellungen des Bereichs
/// und die des Chats.
/// </para>
///
/// <code>
///   area     ein bestehender Bereich bekommt seinen Chat
///   group    der Browser legt fuer die Gruppe einen eigenen Bereich an
///   direct   zu zweit — zwei Personen oder Rollen, ebenfalls mit Bereich
///   self     Notatki — im eigenen Bereich einer Person (0062)
///   seat     mit EINEM Platz: der Mensch, der ein Formular ausgefuellt hat (0069)
/// </code>
///
/// <para>
/// <b>Der Dienst liest keine Nachricht.</b> Sie liegt unter dem
/// Epochenschluessel des Bereichs; jede ist von der Rolle ihres Verfassers
/// unterschrieben (<see cref="MessageVersionRecord"/>, Version 1), und die
/// Unterschrift wird hier geprueft — der Dienst kann niemandem ein Wort in
/// den Mund legen.
/// </para>
///
/// <para>
/// <b>In der Rozmowa eines Bereichs schreibt jeder, der dazugehoert (0053)</b>
/// — jede Rolle, die ihn lesen darf, und jeder PLATZ des Bereichs, der Mensch
/// mit dem Link. Der Platz haelt dafuer nicht den Bereichsschluessel, sondern
/// nur den des Chats, abgeleitet und ihm von einem Mitglied verpackt.
/// </para>
/// </summary>
public static partial class Chat
{
    /// <summary>Eine Nachricht, versiegelt — mehr schreibt niemand in eine Zeile.</summary>
    private const int MaxBody = 24_000;

    private const int MaxName = 1_024;

    /// <summary>Wie weit die Uhr des Browsers danebenliegen darf — der Zeitpunkt geht in die Unterschrift ein.</summary>
    private static readonly TimeSpan ClockSlack = TimeSpan.FromMinutes(15);

    private static readonly string[] Readers = ["read", "write", "admin"];
    private static readonly string[] Writers = ["write", "admin"];

    public static void Map(WebApplication app)
    {
        MapFeatures(app);
        MapTopics(app);
        app.MapGet("/workspace/chats", ListAsync);
        app.MapPost("/workspace/chats", CreateAsync);
        app.MapGet("/workspace/chat/{id:guid}", ShowAsync);
        app.MapGet("/workspace/chat/{id:guid}/messages", MessagesAsync);
        app.MapPost("/workspace/chat/{id:guid}/messages", PostAsync);
        app.MapPost("/workspace/chat/{id:guid}/read", ReadAsync);
        app.MapPost("/workspace/chat/message/{id:guid}/delete", DeleteAsync);

        /* Wie jemand in einem Bereich heisst — fuer die anderen Mitglieder, versiegelt. */
        app.MapPost("/workspace/area/{id:guid}/names", NameAsync);
        app.MapGet("/workspace/area/{id:guid}/names", AreaNamesAsync);

        /*
         * DIE VISITENKARTE EINER ROLLE — Art und oeffentlicher Schluessel, zu
         * einer Kennung, die jemand weitergegeben hat („Twój kod do rozmów").
         * Damit laesst sich ein Mensch aus einem anderen Konto in einen
         * Bereich nehmen: der Browser verpackt ihm den Schluessel.
         */
        app.MapGet("/workspace/role/{id:guid}/card", CardAsync);

        /* 0053 — den Plaetzen des Bereichs den Chatschluessel weitergeben. */
        app.MapPost("/workspace/chat/{id:guid}/seats", GrantSeatsAsync);


        /*
         * 0053 — DER MENSCH MIT DEM LINK. Ohne Konto; der Link (sein Token)
         * ist der Ausweis, wie bei allem anderen unter `/seat/`.
         */
        app.MapGet("/seat/{token}/chats", SeatChatsAsync);
        app.MapPost("/seat/{token}/identity", SeatIdentityAsync);
        app.MapGet("/seat/{token}/chat/{id:guid}/messages", SeatMessagesAsync);
        app.MapPost("/seat/{token}/chat/{id:guid}/messages", SeatPostAsync);
        app.MapPost("/seat/{token}/chat/message/{id:guid}/delete", SeatDeleteAsync);

        /* 0058 — bearbeiten, wiederherstellen, die Fassungen (Chat.Versions.cs). */
        app.MapPost("/workspace/chat/message/{id:guid}/edit", EditAsync);
        app.MapPost("/workspace/chat/message/{id:guid}/restore", RestoreAsync);
        app.MapGet("/workspace/chat/message/{id:guid}/versions", VersionsAsync);
        app.MapPost("/seat/{token}/chat/message/{id:guid}/edit", SeatEditAsync);
        app.MapPost("/seat/{token}/chat/message/{id:guid}/restore", SeatRestoreAsync);
        app.MapGet("/seat/{token}/chat/message/{id:guid}/versions", SeatVersionsAsync);
    }

    /// <summary>
    /// Wer in einem Chat schreibt. In der Rozmowa eines BEREICHS jeder, der ihn
    /// lesen darf (0053) — sie gehoert allen darin; in einer eigenen (Gruppe, zu
    /// zweit) sagen es die Einstellungen.
    /// </summary>
    private static string[] SpeakersOf(ChatRow chat) => ChatRules.Speakers(chat.Kind, chat.PostingPolicy);

    /* ======================================================================
       WER DARF
       ====================================================================== */

    /// <summary>Die Rollen dieses Kontos — und welche davon den Bereich mit einer dieser Stufen tragen.</summary>
    private static async Task<List<Guid>> HoldingAsync(
        SqlConnection connection, IReadOnlyList<Guid> roles, Guid areaId, string[] capabilities, CancellationToken ct)
    {
        var found = new List<Guid>();
        if (roles.Count == 0) return found;

        var names = string.Join(", ", roles.Select((_, i) => $"@r{i}"));
        var caps = string.Join(", ", capabilities.Select((_, i) => $"@c{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT DISTINCT subject_role_id FROM app.certificate
            WHERE scope_kind = N'area' AND scope_id = @area
              AND revoked_at IS NULL AND expires_at > @now
              AND capability IN ({caps})
              AND subject_role_id IN ({names});
            """, connection);

        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < roles.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", roles[i]);
        for (var i = 0; i < capabilities.Length; i++) cmd.Parameters.AddWithValue($"@c{i}", capabilities[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) found.Add(reader.GetGuid(0));
        return found;
    }

    private sealed record ChatRow(Guid Id, Guid AreaId, string Kind, string? PairKey, DateTimeOffset CreatedAt,
        DateTimeOffset? LastMessageAt, string PostingPolicy, Guid? SeatId = null);

    private static async Task<ChatRow?> ChatOfAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT id, area_id, kind, pair_key, created_at, last_message_at, posting_policy, seat_id FROM app.chat WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new ChatRow(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3), reader.GetDateTimeOffset(4),
            reader.IsDBNull(5) ? null : reader.GetDateTimeOffset(5), reader.GetString(6),
            reader.IsDBNull(7) ? null : reader.GetGuid(7));
    }

    /// <summary>
    /// Welche Plaetze in dieser Rozmowa dabei sind — als SQL fuer eine
    /// Unterabfrage ueber `s` (app.access) und `c` (app.chat): im Bereich
    /// alle Plaetze des Bereichs und der Formulare der Rozmowa (0080), in der
    /// eines Platzes (0069) nur er.
    /// </summary>
    private static readonly string SeatOfChat = ChatRules.SeatOfChat;

    private static bool HasSeats(ChatRow chat) => ChatRules.HasSeats(chat.Kind);

    /// <summary>Der Chat — wenn dieses Konto ihn lesen darf; sonst null (und 404 geschrieben).</summary>
    private static async Task<(ChatRow Chat, List<Guid> Mine, Guid Account)?> ReadableAsync(
        HttpContext ctx, Db db, SqlConnection connection, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return null; }

        var chat = await ChatOfAsync(connection, id, ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();

        if (chat is null || (await HoldingAsync(connection, mine, chat.AreaId, Readers, ctx.RequestAborted)).Count == 0)
        {
            // „Darfst du nicht" und „gibt es nicht" bekommen dieselbe Antwort.
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej rozmowy nie ma.");
            return null;
        }

        return (chat, mine, who.Value.AccountId);
    }

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
            int Unread, int Seats, int Pending, Guid? Seat, string? SeatName)>();

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
                       AND (m.author_role_id IS NULL OR m.author_role_id NOT IN ({names}))) AS unread,
                   (SELECT COUNT(*) FROM app.access s
                     WHERE {SeatOfChat} AND {LiveSeat("s")}) AS seats,
                   (SELECT COUNT(*) FROM app.access s
                     JOIN app.seat_identity i ON i.access_id = s.id
                     WHERE {SeatOfChat} AND {LiveSeat("s")}
                       AND NOT EXISTS (SELECT 1 FROM app.chat_seat_key k
                                        WHERE k.chat_id = c.id AND k.access_id = s.id
                                          AND k.epoch = a.current_epoch)) AS pending,
                   c.seat_id,
                   (SELECT x.recipient_name FROM app.access x WHERE x.id = c.seat_id) AS seat_name
            FROM app.chat c
            JOIN app.area a ON a.id = c.area_id
            LEFT JOIN app.chat_read r ON r.chat_id = c.id AND r.account_id = @account
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
                    reader.IsDBNull(9) ? null : reader.GetGuid(9), reader.IsDBNull(10) ? null : reader.GetString(10)));
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
                seatName = r.SeatName,

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

    public sealed record CreateRequest(string ChatId, string AreaId, string Kind, string AsRoleId, string? WithRoleId, string PostingPolicy = "legacy",

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

        if (body.Kind is not ("area" or "channel" or "group" or "direct" or "self" or "seat") || body.PostingPolicy is not ("legacy" or "members" or "writers"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj rozmowy: area, channel, group, direct, self albo seat.");
            return;
        }

        /*
         * 0080 — DER KANAŁ ist eine eigene Art: im Bereich schreiben die
         * Schreibenden, alle anderen lesen. Ein Browser von gestern legt ihn
         * noch als Rozmowa des Bereichs mit `writers` an — das ist derselbe
         * Wunsch. Und in der Rozmowa des Bereichs schreibt jeder darin.
         */
        var kind = body.Kind == "area" && body.PostingPolicy == "writers" ? "channel" : body.Kind;
        var policy = kind == "channel" ? "writers" : body.PostingPolicy;

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

    /* ======================================================================
       EIN CHAT
       ====================================================================== */

    private static async Task ShowAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seen = await ReadableAsync(ctx, db, connection, id);
        if (seen is null) return;
        var (chat, mine, account) = seen.Value;

        string areaName;
        int currentEpoch;
        await using (var cmd = new SqlCommand("SELECT name, current_epoch FROM app.area WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", chat.AreaId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            await reader.ReadAsync(ctx.RequestAborted);
            areaName = reader.GetString(0);
            currentEpoch = reader.GetInt32(1);
        }

        DateTimeOffset? readAt;
        await using (var cmd = new SqlCommand(
            "SELECT read_at FROM app.chat_read WHERE chat_id = @chat AND account_id = @account;", connection))
        {
            cmd.Parameters.AddWithValue("@chat", chat.Id);
            cmd.Parameters.AddWithValue("@account", account);
            readAt = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as DateTimeOffset?;
        }

        var members = await MembersOfAsync(connection, [chat.AreaId], ctx.RequestAborted);
        var names = await NamesOfAsync(connection, [chat.AreaId], ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            chatId = Ids.ToText(chat.Id),
            areaId = Ids.ToText(chat.AreaId),
            areaName,
            currentEpoch,
            kind = chat.Kind,
            postingPolicy = chat.PostingPolicy,
            createdAt = chat.CreatedAt,
            lastMessageAt = chat.LastMessageAt,
            readAt,

            /* Welche meiner Rollen hier schreiben duerfen — die Oberflaeche bietet nur sie an. */
            writers = (await HoldingAsync(connection, mine, chat.AreaId, SpeakersOf(chat), ctx.RequestAborted)).Select(Ids.ToText),
            certifiers = (await HoldingAsync(connection, mine, chat.AreaId, ["admin", "certify"], ctx.RequestAborted)).Select(Ids.ToText),
            members = members.TryGetValue(chat.AreaId, out var m) ? m : [],
            names = names.TryGetValue(chat.AreaId, out var n) ? n : [],

            /* 0053 — die Menschen mit Link, und ob ihr Schluessel schon bei ihnen ist (0069: in der eines Platzes nur er). */
            seatId = chat.SeatId is null ? null : Ids.ToText(chat.SeatId.Value),
            seats = HasSeats(chat) ? await SeatsOfAsync(connection, chat, ctx.RequestAborted) : [],

            /* 0080 — die Formulare, deren Menschen hier dabei sind (Audience). */
            forms = chat.Kind is "area" or "channel" ? await Audience.FormsOfAsync(connection, "chat", chat.Id, ctx.RequestAborted) : []
        });
    }

    /// <summary>
    /// Ein lebendiger Platz, der nicht mehr auf seine erste Bestaetigung wartet
    /// — dieselbe Bedingung wie <c>Seat.LiveSeatAsync(gated: true)</c>, als SQL
    /// fuer eine Unterabfrage. Braucht <c>@now</c>.
    /// </summary>
    private static string LiveSeat(string a) => Audience.LiveSeat(a);

    /// <summary>
    /// DIE PLAETZE EINER ROZMOWA — die des Bereichs und seiner Formulare (0080),
    /// in der mit einem Platz nur er — mit dem oeffentlichen Schluessel, unter
    /// den ein Mitglied ihnen den Chatschluessel verpackt, und den Epochen, fuer
    /// die er schon da ist.
    ///
    /// <para>
    /// Der Name ist der, den die Kanzlei am Platz fuehrt (`recipient_name`) —
    /// er steht ohnehin offen da, damit sie ihre Plaetze zuordnen kann.
    /// </para>
    /// </summary>
    private static async Task<List<object>> SeatsOfAsync(SqlConnection connection, ChatRow chat, CancellationToken ct)
    {
        var rows = new List<(Guid Id, string? Name, byte[]? Wrap)>();

        await using (var cmd = new SqlCommand($"""
            SELECT s.id, s.recipient_name, i.wrap_public_key
            FROM app.chat c
            JOIN app.access s ON {SeatOfChat}
            LEFT JOIN app.seat_identity i ON i.access_id = s.id
            WHERE c.id = @chat AND {LiveSeat("s")}
            ORDER BY s.recipient_name, s.created_at;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@chat", chat.Id);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                rows.Add((reader.GetGuid(0), reader.IsDBNull(1) ? null : reader.GetString(1),
                    reader.IsDBNull(2) ? null : (byte[])reader[2]));
            }
        }

        var epochs = new Dictionary<Guid, List<int>>();
        await using (var cmd = new SqlCommand(
            "SELECT access_id, epoch FROM app.chat_seat_key WHERE chat_id = @chat;", connection))
        {
            cmd.Parameters.AddWithValue("@chat", chat.Id);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var seat = reader.GetGuid(0);
                if (!epochs.TryGetValue(seat, out var list)) epochs[seat] = list = [];
                list.Add(reader.GetInt32(1));
            }
        }

        return rows.Select(r => (object)new
        {
            seatId = Ids.ToText(r.Id),
            name = r.Name,

            /* `null`: er hat die Rozmowa noch nie geoeffnet — dann gibt es nichts, wofuer man verpacken koennte. */
            wrapPublicKey = r.Wrap is null ? null : Base64Url.Encode(r.Wrap),
            epochs = epochs.TryGetValue(r.Id, out var e) ? e : []
        }).ToList();
    }

    /// <summary>
    /// Die Nachrichten — die neuesten (\`before\` fuer weiter zurueck) oder,
    /// fuer das Nachladen, die nach \`after\`.
    /// </summary>
    private static async Task MessagesAsync(
        HttpContext ctx, Db db, Guid id, string? before, string? after, int? limit, string? changed, Guid? beforeId, Guid? afterId, Guid? topic)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seen = await ReadableAsync(ctx, db, connection, id);
        if (seen is null) return;

        var now = DateTimeOffset.UtcNow;
        await ctx.Response.WriteAsJsonAsync(new
        {
            chatId = Ids.ToText(id),
            messages = await ReadMessagesAsync(connection, id, before, after, limit, ctx.RequestAborted, changed, beforeId, afterId, topic),
            asOf = now
        });
    }

    /// <summary>
    /// Die Nachrichten eines Chats, versiegelt — fuer ein Mitglied und fuer
    /// einen Platz dieselben. Verfasser ist eine Rolle ODER ein Platz (0053).
    /// </summary>
    private static async Task<List<object>> ReadMessagesAsync(
        SqlConnection connection, Guid id, string? before, string? after, int? limit, CancellationToken ct,
        string? changed = null, Guid? beforeId = null, Guid? afterId = null, Guid? topic = null)
    {
        var take = Math.Clamp(limit ?? 60, 1, 200);
        var hasBefore = DateTimeOffset.TryParse(before, out var b);
        var hasAfter = DateTimeOffset.TryParse(after, out var a);

        /*
         * 0059 — WAS SICH GEÄNDERT HAT, seit der Leser zuletzt gefragt hat:
         * bearbeitet, gelöscht, wiederhergestellt. Ohne das käme eine
         * bearbeitete Nachricht von gestern bei niemandem an, der die Rozmowa
         * offen hat — er holt sonst nur das Neue.
         */
        var hasChanged = DateTimeOffset.TryParse(changed, out var c);
        if (hasChanged) { hasBefore = false; hasAfter = false; }

        var messages = new List<object>();

        await using (var cmd = new SqlCommand($"""
            SELECT TOP {take} id, author_role_id, epoch, body_sealed, created_at, deleted_at, signature, signed_at,
                   author_access_id, version, edited_at, deleted_by_role_id, deleted_by_access_id, topic_id
            FROM app.chat_message
            WHERE chat_id = @chat AND schedule_state = N'sent'
              {(topic is null ? "" : "AND topic_id = @topic")}
              {(hasBefore ? "AND (created_at < @before OR (created_at = @before AND id < @beforeId))" : "")}
              {(hasAfter ? "AND (created_at > @after OR (created_at = @after AND id > @afterId))" : "")}
              {(hasChanged ? "AND changed_at > @changed" : "")}
            ORDER BY created_at {(hasAfter || hasChanged ? "ASC" : "DESC")}, id {(hasAfter || hasChanged ? "ASC" : "DESC")};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@chat", id);
            if (hasBefore) { cmd.Parameters.AddWithValue("@before", b); cmd.Parameters.AddWithValue("@beforeId", (object?)beforeId ?? DBNull.Value); }
            if (hasAfter) { cmd.Parameters.AddWithValue("@after", a); cmd.Parameters.AddWithValue("@afterId", (object?)afterId ?? DBNull.Value); }
            if (hasChanged) cmd.Parameters.AddWithValue("@changed", c);
            if (topic is not null) cmd.Parameters.AddWithValue("@topic", topic.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                Guid? authorRole = reader.IsDBNull(1) ? null : reader.GetGuid(1);
                Guid? authorSeat = reader.IsDBNull(8) ? null : reader.GetGuid(8);
                Guid? byRole = reader.IsDBNull(11) ? null : reader.GetGuid(11);
                Guid? bySeat = reader.IsDBNull(12) ? null : reader.GetGuid(12);
                var deleted = !reader.IsDBNull(5);

                messages.Add(new
                {
                    messageId = Ids.ToText(reader.GetGuid(0)),
                    authorRoleId = authorRole is null ? null : Ids.ToText(authorRole.Value),
                    authorSeatId = authorSeat is null ? null : Ids.ToText(authorSeat.Value),
                    epoch = reader.GetInt32(2),
                    bodySealed = reader.IsDBNull(3) ? null : Base64Url.Encode((byte[])reader[3]),
                    createdAt = reader.GetDateTimeOffset(4),
                    deletedAt = deleted ? reader.GetDateTimeOffset(5) : (DateTimeOffset?)null,
                    signature = Base64Url.Encode((byte[])reader[6]),
                    signedAt = reader.GetDateTimeOffset(7),

                    /* 0058 — die wievielte Fassung, und seit wann bearbeitet. */
                    version = reader.GetInt32(9),
                    editedAt = reader.IsDBNull(10) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(10),

                    /* Wer gelöscht hat: der Verfasser selbst oder wer moderiert — davon hängt ab, wer zurückholen darf. */
                    deletedBy = !deleted ? null
                        : (byRole is not null && byRole == authorRole) || (bySeat is not null && bySeat == authorSeat) ? "author"
                        : "moderator",

                    /* 0068 — zu welchem Thema. */
                    topicId = reader.IsDBNull(13) ? null : Ids.ToText(reader.GetGuid(13))
                });
            }
        }

        /* Immer in der Reihenfolge, in der sie geschrieben wurden — die aelteste zuerst. */
        if (!hasAfter && !hasChanged) messages.Reverse();

        return messages;
    }

    public sealed record PostRequest(string MessageId, string AuthorRoleId, int Epoch, string BodySealed,
        string Signature, long SignedAt, DateTimeOffset? SendAt = null, string? TopicId = null);

    /// <summary>Was an einer Nachricht zu pruefen ist, bevor jemand gefragt wird, wer sie schreibt.</summary>
    private sealed record Incoming(Guid MessageId, int Epoch, byte[] Body, byte[] BodyHash, byte[] Signature,
        DateTimeOffset SignedAt);

    /// <summary>Die Huelle, die Unterschrift und die Uhr — gleich, ob eine Rolle oder ein Platz schreibt.</summary>
    private static async Task<Incoming?> IncomingAsync(
        HttpContext ctx, string? messageIdText, int epoch, string? bodyText, string? signatureText, long signedAtUnix)
    {
        if (!Guid.TryParse(messageIdText, out var messageId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return null;
        }

        byte[] sealedBody, signature;
        try
        {
            sealedBody = Base64Url.Decode(bodyText ?? string.Empty);
            signature = Base64Url.Decode(signatureText ?? string.Empty);
        }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna wiadomość albo podpis.");
            return null;
        }

        if (sealedBody.Length is 0 or > MaxBody)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Wiadomość jest pusta albo za długa.");
            return null;
        }

        DateTimeOffset signedAt;
        try { signedAt = DateTimeOffset.FromUnixTimeSeconds(signedAtUnix); }
        catch (ArgumentOutOfRangeException) { await Fail(ctx, 400, "Nieprawidłowy czas podpisu."); return null; }
        var now = DateTimeOffset.UtcNow;
        if (signedAt > now + ClockSlack || signedAt < now - ClockSlack)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Czas podpisu nie zgadza się z zegarem.");
            return null;
        }

        return new Incoming(messageId, epoch, sealedBody, SHA256.HashData(sealedBody), signature, signedAt);
    }

    /// <summary>Gibt es die Epoche, unter der geschrieben wurde? Sonst 400.</summary>
    private static async Task<bool> EpochExistsAsync(
        HttpContext ctx, SqlConnection connection, ChatRow chat, int epoch)
    {
        await using var cmd = new SqlCommand("SELECT current_epoch FROM app.area WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", chat.AreaId);
        var current = (int)(await cmd.ExecuteScalarAsync(ctx.RequestAborted))!;

        if (epoch >= 1 && epoch <= current) return true;

        await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru.");
        return false;
    }

    /// <summary>
    /// Was unterschrieben wird — fuer eine Rolle und fuer einen Platz derselbe
    /// Datensatz; im Feld des Verfassers steht die Kennung dessen, der schreibt.
    /// </summary>
    private static MessageVersionRecord RecordOf(Incoming message, Guid author) => new()
    {
        Id = message.MessageId,
        MessageId = message.MessageId,
        Version = 1,
        AuthorRoleId = author,
        BodyHash = message.BodyHash,
        CreatedUtc = message.SignedAt
    };

    /// <summary>Die Zeile — und der Chat bekommt seinen Zeitpunkt. 409, wenn es sie schon gibt.</summary>
    private static async Task<DateTimeOffset?> InsertAsync(
        HttpContext ctx, SqlConnection connection, ChatRow chat, Incoming message, Guid? authorRole, Guid? authorSeat, DateTimeOffset? sendAt = null,
        string? topicText = null)
    {
        /* 0068 — das Thema muss in DIESER Rozmowa liegen. */
        var topic = await TopicOfChatAsync(ctx, connection, chat, topicText);
        if (topic is { Ok: false }) return null;

        var now = DateTimeOffset.UtcNow;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO app.chat_message
                    (id, chat_id, author_role_id, author_access_id, epoch, body_sealed, body_sha256,
                     signature, signed_at, created_at, scheduled_at, schedule_state, topic_id)
                VALUES (@id, @chat, @author, @seat, @epoch, @body, @hash, @sig, @signed, @now, @due, @state, @topic);
                INSERT INTO app.chat_message_version
                    (message_id, version, epoch, body_sealed, body_sha256, signature, signed_at, created_at)
                VALUES (@id, 1, @epoch, @body, @hash, @sig, @signed, @now);
                UPDATE app.chat SET last_message_at = @now WHERE id = @chat AND @state = N'sent';
                UPDATE app.topic SET last_message_at = @now WHERE id = @topic AND @state = N'sent';
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@topic", (object?)topic?.Id ?? DBNull.Value);
                insert.Parameters.AddWithValue("@due", (object?)sendAt ?? DBNull.Value);
                insert.Parameters.AddWithValue("@state", sendAt is null ? "sent" : "pending");
                insert.Parameters.AddWithValue("@id", message.MessageId);
                insert.Parameters.AddWithValue("@chat", chat.Id);
                insert.Parameters.AddWithValue("@author", (object?)authorRole ?? DBNull.Value);
                insert.Parameters.AddWithValue("@seat", (object?)authorSeat ?? DBNull.Value);
                insert.Parameters.AddWithValue("@epoch", message.Epoch);
                insert.Parameters.AddWithValue("@body", message.Body);
                insert.Parameters.AddWithValue("@hash", message.BodyHash);
                insert.Parameters.AddWithValue("@sig", message.Signature);
                insert.Parameters.AddWithValue("@signed", message.SignedAt);
                insert.Parameters.AddWithValue("@now", now);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
            return now;
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta wiadomość już jest.");
            return null;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }
    }

    /// <summary>
    /// EINE NACHRICHT — versiegelt im Browser, von der Rolle des Verfassers
    /// unterschrieben. Schreiben darf eine Rolle, die SELBST im Bereich
    /// schreibt — in der Rozmowa eines Bereichs jede, die ihn liest (0053); die
    /// Unterschrift wird hier gegen ihren oeffentlichen Schluessel geprueft.
    /// </summary>
    private static async Task PostAsync(HttpContext ctx, Db db, Push push, Guid id, PostRequest body)
    {
        if (!Guid.TryParse(body.AuthorRoleId, out var author))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        var message = await IncomingAsync(ctx, body.MessageId, body.Epoch, body.BodySealed, body.Signature, body.SignedAt);
        if (message is null) return;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seen = await ReadableAsync(ctx, db, connection, id);
        if (seen is null) return;
        var (chat, mine, account) = seen.Value;

        if (!mine.Contains(author))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W imieniu tej roli nie piszesz.");
            return;
        }

        if (!(await HoldingAsync(connection, [author], chat.AreaId, SpeakersOf(chat), ctx.RequestAborted)).Contains(author))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ta rola w tej rozmowie tylko czyta.");
            return;
        }

        if (!await EpochExistsAsync(ctx, connection, chat, message.Epoch)) return;

        byte[]? signKey;
        await using (var cmd = new SqlCommand("SELECT sign_public_key FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection))
        {
            cmd.Parameters.AddWithValue("@id", author);
            signKey = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as byte[];
        }

        if (signKey is null || !VerifySignature(RecordOf(message, author), signKey, message.Signature))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis wiadomości się nie zgadza.");
            return;
        }

        if (!await ValidSendAtAsync(ctx, body.SendAt)) return;
        var at = await InsertAsync(ctx, connection, chat, message, author, null, body.SendAt, body.TopicId);
        if (at is null) return;

        /* Was ich selbst schreibe, habe ich gelesen — ausserhalb der Nachricht: ein Streit darum darf sie nicht kosten. */
        if (body.SendAt is null) await MarkReadAsync(connection, null, chat.Id, account, at.Value, ctx.RequestAborted);

        /* 0075 — die anderen wecken (eine geplante Nachricht weckt, wenn sie hinausgeht: ChatDelivery). */
        if (body.SendAt is null) push.Chat(chat.Id, account);

        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(message.MessageId), createdAt = at.Value });
    }

    private static bool VerifySignature(MessageVersionRecord record, byte[] spki, byte[] signature)
    {
        try
        {
            using var rsa = RSA.Create();
            rsa.ImportSubjectPublicKeyInfo(spki, out _);
            return record.Verify(rsa, signature);
        }
        catch (CryptographicException)
        {
            return false;
        }
    }

    /// <summary>
    /// Die Unterschrift eines PLATZES (0053) — ECDSA P-256 ueber denselben
    /// Abdruck, im Format, das WebCrypto liefert (r‖s, IEEE P1363).
    /// </summary>
    private static bool VerifySeatSignature(MessageVersionRecord record, byte[] spki, byte[] signature)
    {
        try
        {
            using var ecdsa = ECDsa.Create();
            ecdsa.ImportSubjectPublicKeyInfo(spki, out _);
            return ecdsa.KeySize == 256 && ecdsa.VerifyHash(record.Hash(), signature);
        }
        catch (CryptographicException)
        {
            return false;
        }
    }

    private static async Task MarkReadAsync(
        SqlConnection connection, SqlTransaction? tx, Guid chatId, Guid account, DateTimeOffset at, CancellationToken ct)
    {
        /*
         * EIN MERGE UNTER SPERRE — und nur nach bestem Vermoegen. Zwei Fenster
         * desselben Kontos melden oft im selben Augenblick „gelesen"; wer dabei
         * verliert (1205, 2627), hat nichts verloren: der andere hat es schon
         * eingetragen, und das naechste Nachladen traegt es wieder ein.
         */
        await using var cmd = new SqlCommand("""
            MERGE app.chat_read WITH (HOLDLOCK) AS t
            USING (SELECT @chat AS chat_id, @account AS account_id) AS s
               ON t.chat_id = s.chat_id AND t.account_id = s.account_id
            WHEN MATCHED AND t.read_at < @at THEN UPDATE SET read_at = @at
            WHEN NOT MATCHED THEN INSERT (chat_id, account_id, read_at) VALUES (@chat, @account, @at);
            """, connection, tx);
        cmd.Parameters.AddWithValue("@chat", chatId);
        cmd.Parameters.AddWithValue("@account", account);
        cmd.Parameters.AddWithValue("@at", at);

        try
        {
            await cmd.ExecuteNonQueryAsync(ct);
        }
        catch (SqlException e) when (tx is null && e.Number is 1205 or 2601 or 2627)
        {
            // Gleichzeitig gelesen — der andere hat es eingetragen.
        }
    }

    /// <summary>Gelesen bis jetzt — fuer „nowe wiadomości" auf allen Geraeten dieses Kontos.</summary>
    private static async Task ReadAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seen = await ReadableAsync(ctx, db, connection, id);
        if (seen is null) return;

        await MarkReadAsync(connection, null, id, seen.Value.Account, DateTimeOffset.UtcNow, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { chatId = Ids.ToText(id), read = true });
    }

    /// <summary>
    /// EINE NACHRICHT ZURUECKNEHMEN — der Verfasser, oder wer im Bereich
    /// hineinlaesst. Die Zeile bleibt (dass hier etwas stand, ist eine
    /// Auskunft), die Huelle geht.
    /// </summary>
    private static async Task DeleteAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid chatId;
        Guid? author;
        await using (var cmd = new SqlCommand(
            "SELECT chat_id, author_role_id FROM app.chat_message WHERE id = @id AND deleted_at IS NULL AND schedule_state = N'sent';", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej wiadomości nie ma.");
                return;
            }
            chatId = reader.GetGuid(0);

            /* NULL: ein Platz hat sie geschrieben (0053) — dann nimmt sie nur er selbst zurueck, oder wer moderiert. */
            author = reader.IsDBNull(1) ? null : reader.GetGuid(1);
        }

        var seen = await ReadableAsync(ctx, db, connection, chatId);
        if (seen is null) return;
        var (chat, mine, _) = seen.Value;

        /* Zu zweit loescht niemand die Worte des anderen — auch nicht, wer den Bereich angelegt hat. */
        var mayModerate = chat.Kind != "direct"
            && (await HoldingAsync(connection, mine, chat.AreaId, ["admin", "certify"], ctx.RequestAborted)).Count > 0;
        if (!(author is Guid role && mine.Contains(role)) && !mayModerate)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Usunąć może tylko autor albo ten, kto prowadzi rozmowę.");
            return;
        }

        /*
         * 0058 — DIE HÜLLE GEHT AUS DER ZEILE, DIE FASSUNGEN BLEIBEN. So lässt
         * sich die Nachricht wiederherstellen. Wer gelöscht hat, steht dabei:
         * der Verfasser selbst, oder wer moderiert — dann holt sie auch nur
         * jemand zurück, der moderiert.
         */
        Guid? by = author is Guid own && mine.Contains(own)
            ? own
            : (await HoldingAsync(connection, mine, chat.AreaId, ["admin", "certify"], ctx.RequestAborted)).FirstOrDefault();

        await using var drop = new SqlCommand("""
            UPDATE app.chat_message
               SET body_sealed = NULL, deleted_at = @now, changed_at = @now,
                   deleted_by_role_id = @by, deleted_by_access_id = NULL
             WHERE id = @id;
            """, connection);
        drop.Parameters.AddWithValue("@id", id);
        drop.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        drop.Parameters.AddWithValue("@by", by is null || by == Guid.Empty ? DBNull.Value : by.Value);
        await drop.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(id), deleted = true });
    }

    /* ======================================================================
       NAMEN UND VISITENKARTEN
       ====================================================================== */

    public sealed record NameRequest(string RoleId, string NameSealed, int Epoch, string ByRoleId);

    /// <summary>
    /// WIE JEMAND IN DIESEM BEREICH HEISST — versiegelt unter dessen Schluessel.
    /// Den eigenen Namen setzt man selbst; einen fremden setzt, wer im Bereich
    /// hineinlaesst (er weiss, wen er eben aufgenommen hat).
    /// </summary>
    private static async Task NameAsync(HttpContext ctx, Db db, Guid id, NameRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.RoleId, out var roleId) || !Guid.TryParse(body.ByRoleId, out var byRole))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        byte[] name;
        try { name = Base64Url.Decode(body.NameSealed ?? string.Empty); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna nazwa.");
            return;
        }

        if (name.Length is 0 or > MaxName)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nazwa jest pusta albo za długa.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        if (!mine.Contains(byRole))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W imieniu tej roli nic nie ustawisz.");
            return;
        }

        var own = roleId == byRole
            && (await HoldingAsync(connection, [roleId], id, Readers, ctx.RequestAborted)).Contains(roleId);
        var certifies = (await HoldingAsync(connection, [byRole], id, ["admin", "certify"], ctx.RequestAborted)).Contains(byRole);

        if (!own && !certifies)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Nazwę ustawia sama osoba albo ten, kto wpuszcza do obszaru.");
            return;
        }

        /* Nur fuer jemanden, der wirklich im Bereich steht. */
        if (!(await HoldingAsync(connection, [roleId], id, [.. Readers, "certify"], ctx.RequestAborted)).Contains(roleId))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tej roli nie ma w obszarze.");
            return;
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.area_member_name
               SET name_sealed = @name, epoch = @epoch, set_by_role_id = @by, updated_at = @now
             WHERE area_id = @area AND role_id = @role;
            IF @@ROWCOUNT = 0
                INSERT INTO app.area_member_name (area_id, role_id, name_sealed, epoch, set_by_role_id, updated_at)
                VALUES (@area, @role, @name, @epoch, @by, @now);
            """, connection);
        cmd.Parameters.AddWithValue("@area", id);
        cmd.Parameters.AddWithValue("@role", roleId);
        cmd.Parameters.AddWithValue("@name", name);
        cmd.Parameters.AddWithValue("@epoch", body.Epoch);
        cmd.Parameters.AddWithValue("@by", byRole);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), roleId = Ids.ToText(roleId), named = true });
    }

    /// <summary>Die Namen der Mitglieder eines Bereichs, versiegelt — fuer die Seite des Bereichs.</summary>
    private static async Task AreaNamesAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /* Die Namen liegen unter dem Schlüssel des Bereichs — wer ihn hält (auch ein Link), öffnet sie (`Caller`). */
        var caller = await Callers.OfAsync(ctx, db, connection);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!await Area.MayAsync(connection, caller, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        var names = await NamesOfAsync(connection, [id], ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { areaId = Ids.ToText(id), names = names.TryGetValue(id, out var n) ? n : [] });
    }

    /// <summary>
    /// Die Visitenkarte einer Rolle: Art und oeffentlicher Schluessel. Mit
    /// Anmeldung; kein Konto (0040) — das nimmt nichts entgegen.
    /// </summary>
    private static async Task CardAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand(
            "SELECT kind, wrap_public_key FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        if (!await reader.ReadAsync(ctx.RequestAborted) || reader.GetString(0) == "account")
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma osoby ani roli o takim kodzie.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            roleId = Ids.ToText(id),
            kind = reader.GetString(0),
            wrapPublicKey = Base64Url.Encode((byte[])reader[1])
        });
    }

    /* ======================================================================
       0053 — DER MENSCH MIT DEM LINK
       ====================================================================== */

    /// <summary>Eine verpackte Huelle fasst einen Schluessel von 32 Bytes — mehr nimmt niemand an.</summary>
    private const int MaxWrapped = 512;

    /// <summary>Die privaten Haelften eines Platzes, versiegelt — zwei P-256-Schluessel.</summary>
    private const int MaxIdentity = 2048;

    public sealed record SeatKeyIn(string SeatId, int Epoch, string KeyWrapped);

    public sealed record GrantSeatsRequest(string ByRoleId, IReadOnlyList<SeatKeyIn>? Keys);

    /// <summary>
    /// DEN CHATSCHLUESSEL WEITERGEBEN — an die Plaetze des Bereichs, die darauf
    /// warten. Verpackt hat ihn der Browser eines Mitglieds, unter dem
    /// oeffentlichen Schluessel des Platzes; hier wird er nur abgelegt.
    ///
    /// <para>
    /// <b>Wer weitergibt, entscheidet nicht, wer dazugehoert.</b> Das sagt der
    /// Bereich: annehmen kann nur ein lebendiger Platz DIESES Bereichs. Das
    /// Mitglied liefert bloss den Schluessel, den es ohnehin haelt — deshalb
    /// darf das jedes, nicht erst, wer hineinlaesst.
    /// </para>
    ///
    /// <para>
    /// <b>Die erste Huelle bleibt.</b> Eine zweite derselben Epoche ersetzt sie
    /// nicht — sonst koennte ein Mitglied eine gute durch eine leere ersetzen.
    /// </para>
    /// </summary>
    private static async Task GrantSeatsAsync(HttpContext ctx, Db db, Guid id, GrantSeatsRequest body)
    {
        if (!Guid.TryParse(body.ByRoleId, out var byRole))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        var keys = body.Keys ?? [];
        if (keys.Count > 500)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Za dużo naraz — najwyżej 500.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seen = await ReadableAsync(ctx, db, connection, id);
        if (seen is null) return;
        var (chat, mine, _) = seen.Value;

        if (!HasSeats(chat))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Osoby z linkiem są tylko w rozmowie i kanale obszaru oraz w rozmowie z nimi samymi.");
            return;
        }

        if (!mine.Contains(byRole)
            || !(await HoldingAsync(connection, [byRole], chat.AreaId, Readers, ctx.RequestAborted)).Contains(byRole))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ta rola nie ma klucza tego obszaru.");
            return;
        }

        int current;
        await using (var cmd = new SqlCommand("SELECT current_epoch FROM app.area WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", chat.AreaId);
            current = (int)(await cmd.ExecuteScalarAsync(ctx.RequestAborted))!;
        }

        var parsed = new List<(Guid Seat, int Epoch, byte[] Key)>();
        foreach (var one in keys)
        {
            byte[] wrapped;
            try { wrapped = Base64Url.Decode(one.KeyWrapped ?? string.Empty); }
            catch (FormatException) { wrapped = []; }

            if (!Guid.TryParse(one.SeatId, out var seatId) || one.Epoch < 1 || one.Epoch > current
                || wrapped.Length is 0 or > MaxWrapped)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz dla osoby z linkiem.");
                return;
            }

            parsed.Add((seatId, one.Epoch, wrapped));
        }

        var now = DateTimeOffset.UtcNow;
        var granted = 0;

        foreach (var (seatId, epoch, wrapped) in parsed)
        {
            await using var insert = new SqlCommand($"""
                INSERT INTO app.chat_seat_key (chat_id, access_id, epoch, key_wrapped, granted_by_role_id, granted_at)
                SELECT @chat, s.id, @epoch, @key, @by, @now
                FROM app.access s
                JOIN app.seat_identity i ON i.access_id = s.id
                JOIN app.chat c ON c.id = @chat
                WHERE s.id = @seat AND {SeatOfChat} AND {LiveSeat("s")}
                  AND NOT EXISTS (SELECT 1 FROM app.chat_seat_key k
                                   WHERE k.chat_id = @chat AND k.access_id = @seat AND k.epoch = @epoch);
                """, connection);

            insert.Parameters.AddWithValue("@chat", chat.Id);
            insert.Parameters.AddWithValue("@seat", seatId);
            insert.Parameters.AddWithValue("@epoch", epoch);
            insert.Parameters.AddWithValue("@key", wrapped);
            insert.Parameters.AddWithValue("@by", byRole);
            insert.Parameters.AddWithValue("@now", now);

            try
            {
                granted += await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                // Ein zweites Fenster war schneller — die erste Huelle bleibt, und sie ist da.
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { chatId = Ids.ToText(chat.Id), granted });
    }

    /// <summary>Der Platz hinter dem Token und der Chat — wenn der Platz dazugehoert (<see cref="SeatOfChat"/>). Sonst 404.</summary>
    private static async Task<((Guid Id, Guid AreaId) Seat, ChatRow Chat)?> SeatChatAsync(
        HttpContext ctx, SqlConnection connection, string token, Guid chatId)
    {
        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        var chat = seat is null ? null : await ChatOfAsync(connection, chatId, ctx.RequestAborted);

        /*
         * 0069 — die Rozmowa seines Bereichs, oder seine eigene; keine eines anderen Platzes.
         * 0080 — und die Rozmowa und der Kanał, zu denen eines seiner Formulare gehoert; die
         * eigene auch an einem anderen Bereich als dem seines Platzes.
         */
        var belongs = false;
        if (seat is not null && chat is not null && HasSeats(chat))
        {
            await using var cmd = new SqlCommand($"""
                SELECT 1 FROM app.chat c JOIN app.access s ON s.id = @seat
                WHERE c.id = @chat AND {SeatOfChat};
                """, connection);
            cmd.Parameters.AddWithValue("@seat", seat.Value.Id);
            cmd.Parameters.AddWithValue("@chat", chat.Id);
            belongs = await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not null;
        }

        if (seat is null || chat is null || !belongs)
        {
            // Wie ueberall unter `/seat/`: was es nicht gibt und was nicht zu diesem Link gehoert, sieht gleich aus.
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej rozmowy nie ma.");
            return null;
        }

        return (seat.Value, chat);
    }

    /// <summary>
    /// DIE ROZMOWY DIESES LINKS — die seines Bereichs, die seiner Formulare
    /// (0080) und die mit ihm selbst, mit den Huellen des
    /// Chatschluessels, soweit ein Mitglied sie schon weitergegeben hat, und
    /// mit seiner eigenen Identitaet (oder <c>null</c>: noch keine).
    /// </summary>
    private static async Task SeatChatsAsync(HttpContext ctx, Db db, string token)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        var identity = await IdentityOfAsync(connection, seat.Value.Id, ctx.RequestAborted);

        var chats = new List<(Guid Id, Guid Area, string Name, int Epoch, DateTimeOffset? Last, string Kind, int Unread)>();
        await using (var cmd = new SqlCommand($"""
            SELECT c.id, c.area_id, a.name, a.current_epoch, c.last_message_at, c.kind,
                   (SELECT COUNT(*) FROM app.chat_message m
                     WHERE m.chat_id = c.id AND m.schedule_state = N'sent' AND m.deleted_at IS NULL
                       AND (m.author_access_id IS NULL OR m.author_access_id <> @seat)
                       AND m.created_at > COALESCE((SELECT p.read_at FROM app.chat_presence p
                                                     WHERE p.chat_id = c.id AND p.principal_id = @seat), '0001-01-01')) AS unread
            FROM app.chat c
            JOIN app.area a ON a.id = c.area_id
            JOIN app.access s ON s.id = @seat
            WHERE {SeatOfChat}
            ORDER BY CASE c.kind WHEN N'seat' THEN 0 WHEN N'channel' THEN 1 ELSE 2 END, a.name;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@seat", seat.Value.Id);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                chats.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetInt32(3),
                    reader.IsDBNull(4) ? null : reader.GetDateTimeOffset(4), reader.GetString(5), reader.GetInt32(6)));
            }
        }

        var keys = new Dictionary<Guid, List<object>>();
        await using (var cmd = new SqlCommand(
            "SELECT chat_id, epoch, key_wrapped FROM app.chat_seat_key WHERE access_id = @seat;", connection))
        {
            cmd.Parameters.AddWithValue("@seat", seat.Value.Id);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var chat = reader.GetGuid(0);
                if (!keys.TryGetValue(chat, out var list)) keys[chat] = list = [];
                list.Add(new { epoch = reader.GetInt32(1), keyWrapped = Base64Url.Encode((byte[])reader[2]) });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            seatId = Ids.ToText(seat.Value.Id),
            identity,
            chats = chats.Select(c => new
            {
                chatId = Ids.ToText(c.Id),
                areaId = Ids.ToText(c.Area),
                areaName = c.Name,
                currentEpoch = c.Epoch,
                lastMessageAt = c.Last,

                /* 0069 — `seat`: die Rozmowa nur mit der Kanzlei; `area`: die mit allen im Bereich. 0080 — `channel`: er liest. */
                kind = c.Kind,
                unread = c.Unread,
                keys = keys.TryGetValue(c.Id, out var k) ? k : []
            })
        });
    }

    private static async Task<object?> IdentityOfAsync(SqlConnection connection, Guid seatId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT wrap_public_key, sign_public_key, private_sealed FROM app.seat_identity WHERE access_id = @seat;",
            connection);
        cmd.Parameters.AddWithValue("@seat", seatId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new
        {
            wrapPublicKey = Base64Url.Encode((byte[])reader[0]),
            signPublicKey = Base64Url.Encode((byte[])reader[1]),
            privateSealed = Base64Url.Encode((byte[])reader[2])
        };
    }

    public sealed record IdentityRequest(string WrapPublicKey, string SignPublicKey, string PrivateSealed);

    /// <summary>Ist das ein oeffentlicher P-256-Schluessel — zum Empfangen oder zum Pruefen?</summary>
    private static bool IsP256(byte[] spki, bool forSigning)
    {
        try
        {
            if (forSigning)
            {
                using var ecdsa = ECDsa.Create();
                ecdsa.ImportSubjectPublicKeyInfo(spki, out var read);
                return read == spki.Length && ecdsa.KeySize == 256;
            }

            using var ecdh = ECDiffieHellman.Create();
            ecdh.ImportSubjectPublicKeyInfo(spki, out var used);
            return used == spki.Length && ecdh.KeySize == 256;
        }
        catch (CryptographicException)
        {
            return false;
        }
    }

    /// <summary>
    /// DIE IDENTITAET EINES PLATZES — beim ersten Oeffnen einer Rozmowa im
    /// Browser erzeugt. Die erste bleibt: wer sie ersetzen koennte, koennte
    /// sich die Schluessel eines anderen verpacken lassen. Zurueck kommt die,
    /// die gilt — auch wenn es nicht die eben geschickte ist.
    /// </summary>
    private static async Task SeatIdentityAsync(HttpContext ctx, Db db, string token, IdentityRequest body)
    {
        byte[] wrap, sign, sealedPrivate;
        try
        {
            wrap = Base64Url.Decode(body.WrapPublicKey ?? string.Empty);
            sign = Base64Url.Decode(body.SignPublicKey ?? string.Empty);
            sealedPrivate = Base64Url.Decode(body.PrivateSealed ?? string.Empty);
        }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz.");
            return;
        }

        if (wrap.Length > 256 || sign.Length > 256 || !IsP256(wrap, false) || !IsP256(sign, true)
            || sealedPrivate.Length is 0 or > MaxIdentity)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
            return;
        }

        await using (var insert = new SqlCommand("""
            INSERT INTO app.seat_identity (access_id, wrap_public_key, sign_public_key, private_sealed, created_at)
            SELECT @seat, @wrap, @sign, @private, @now
            WHERE NOT EXISTS (SELECT 1 FROM app.seat_identity WHERE access_id = @seat);
            """, connection))
        {
            insert.Parameters.AddWithValue("@seat", seat.Value.Id);
            insert.Parameters.AddWithValue("@wrap", wrap);
            insert.Parameters.AddWithValue("@sign", sign);
            insert.Parameters.AddWithValue("@private", sealedPrivate);
            insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            try
            {
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                // Ein zweites Fenster desselben Links war schneller — dessen gilt.
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            seatId = Ids.ToText(seat.Value.Id),
            identity = await IdentityOfAsync(connection, seat.Value.Id, ctx.RequestAborted)
        });
    }

    private static async Task SeatMessagesAsync(
        HttpContext ctx, Db db, string token, Guid id, string? before, string? after, int? limit, string? changed, Guid? beforeId, Guid? afterId, Guid? topic)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await SeatChatAsync(ctx, connection, token, id);
        if (found is null) return;

        var now = DateTimeOffset.UtcNow;
        await ctx.Response.WriteAsJsonAsync(new
        {
            chatId = Ids.ToText(id),
            messages = await ReadMessagesAsync(connection, id, before, after, limit, ctx.RequestAborted, changed, beforeId, afterId, topic),
            asOf = now
        });
    }

    public sealed record SeatPostRequest(string MessageId, int Epoch, string BodySealed, string Signature, long SignedAt, DateTimeOffset? SendAt = null,
        string? TopicId = null);

    /// <summary>
    /// EINE NACHRICHT VOM LINK — versiegelt unter dem Chatschluessel,
    /// unterschrieben mit dem Schluessel des Platzes. Verfasser ist der Platz;
    /// welcher, sagt das Token und nicht der Absender.
    /// </summary>
    private static async Task SeatPostAsync(HttpContext ctx, Db db, Push push, string token, Guid id, SeatPostRequest body)
    {
        var message = await IncomingAsync(ctx, body.MessageId, body.Epoch, body.BodySealed, body.Signature, body.SignedAt);
        if (message is null) return;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var found = await SeatChatAsync(ctx, connection, token, id);
        if (found is null) return;
        var (seat, chat) = found.Value;

        if (!await EpochExistsAsync(ctx, connection, chat, message.Epoch)) return;

        byte[]? signKey;
        await using (var cmd = new SqlCommand(
            "SELECT sign_public_key FROM app.seat_identity WHERE access_id = @seat;", connection))
        {
            cmd.Parameters.AddWithValue("@seat", seat.Id);
            signKey = await cmd.ExecuteScalarAsync(ctx.RequestAborted) as byte[];
        }

        if (signKey is null || !VerifySeatSignature(RecordOf(message, seat.Id), signKey, message.Signature))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis wiadomości się nie zgadza.");
            return;
        }

        if (!await SeatMayPostAsync(ctx, chat) || !await ValidSendAtAsync(ctx, body.SendAt)) return;
        var at = await InsertAsync(ctx, connection, chat, message, null, seat.Id, body.SendAt, body.TopicId);
        if (at is null) return;
        if (body.SendAt is null) push.Chat(chat.Id, null);

        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(message.MessageId), createdAt = at.Value });
    }

    /// <summary>Die eigene Nachricht zuruecknehmen — nur die eigene.</summary>
    private static async Task SeatDeleteAsync(HttpContext ctx, Db db, string token, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid chatId;
        Guid? author;
        await using (var cmd = new SqlCommand(
            "SELECT chat_id, author_access_id FROM app.chat_message WHERE id = @id AND deleted_at IS NULL AND schedule_state = N'sent';", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej wiadomości nie ma.");
                return;
            }
            chatId = reader.GetGuid(0);
            author = reader.IsDBNull(1) ? null : reader.GetGuid(1);
        }

        var found = await SeatChatAsync(ctx, connection, token, chatId);
        if (found is null) return;

        if (author != found.Value.Seat.Id)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Usunąć możesz tylko swoją wiadomość.");
            return;
        }

        await using var drop = new SqlCommand("""
            UPDATE app.chat_message
               SET body_sealed = NULL, deleted_at = @now, changed_at = @now,
                   deleted_by_access_id = @seat, deleted_by_role_id = NULL
             WHERE id = @id;
            """, connection);
        drop.Parameters.AddWithValue("@id", id);
        drop.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        drop.Parameters.AddWithValue("@seat", found.Value.Seat.Id);
        await drop.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { messageId = Ids.ToText(id), deleted = true });
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
