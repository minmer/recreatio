using System.Security.Cryptography;
using System.Text.Json;
using Kernel;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// SITZUNGEN (0109, COGITA.md §10) — ein eigener Kern neben dem Chat, der
/// dessen Stücke teilt.
///
/// <para>
/// <b>Eine Sitzung ist ein Strom von Ereignissen in einem Bereich.</b> Der
/// Gastgeber stellt Fragen (ohne Antworten [L3]), deckt auf, zählt; die
/// Teilnehmer melden sich an und antworten. Der Schlüssel der Sitzung kommt aus
/// der Epoche des Bereichs, abgeleitet wie der Chatschlüssel; Mitglieder rechnen
/// ihn selbst, ein Platz bekommt ihn über seine P-256-Identität
/// (<c>cogita_session_key</c>), wer mit dem Link des Quiz kommt, hat ihn hinter
/// der Raute. Antworten gehen an die Annahme des Bereichs — sie liest nur, wer
/// die Rolle der Annahme hält: der Gastgeber und die Leiter [I10].
/// </para>
///
/// <para>
/// <b>Wer mitmacht</b> [I7]: ein Konto, ein Link mit Zugang, ein Platz (ein
/// Mensch aus einem Formular), oder — mit dem Geheimnis oder dem Code der
/// Sitzung — jemand ganz ohne alles, der sich beim Mitmachen vorstellt.
/// </para>
///
/// <para>
/// <b>Echtzeit</b> [I4]: ein SignalR-Hub auf demselben Hosting
/// (<see cref="CogitaHub"/>). Geschrieben wird immer über REST; der Hub trägt
/// nur aus — Fragen an alle, Antworten an die Gastgeber. Ohne WebSocket fragt
/// der Browser selbst nach.
/// </para>
/// </summary>
public static partial class Cogita
{
    private const int MaxEventSealed = 64 * 1024;
    private const int MaxEventPlain = 16 * 1024;
    private const int MaxEventsAtOnce = 50;
    private const int MaxEventsPerSession = 50_000;
    private const int MaxTitle = 4096;

    private static readonly HashSet<string> SessionKinds = new(StringComparer.Ordinal) { "live", "async", "sync", "story", "game", "shared" };
    private static readonly HashSet<string> States = new(StringComparer.Ordinal) { "lobby", "running", "paused", "finished", "closed" };

    /// <summary>Was ein Teilnehmer schicken darf — alles andere ist Sache des Gastgebers.</summary>
    private static readonly HashSet<string> ParticipantKinds = new(StringComparer.Ordinal) { "join", "answer", "leave", "hello", "react", "ready", "attempt" };

    /// <summary>Was der Dienst selbst schreibt (im Spiel) — offen, für alle.</summary>
    private static readonly HashSet<string> ServiceKinds = new(StringComparer.Ordinal) { "trigger", "tick", "zone" };

    public const string SeatHeader = "X-Recreatio-Seat";
    public const string JoinHeader = "X-Cogita-Join";

    private static void MapSessions(WebApplication app)
    {
        app.MapPost("/workspace/cogita/sessions", CreateSessionAsync);
        app.MapGet("/workspace/cogita/sessions", ListSessionsAsync);
        app.MapGet("/workspace/cogita/session/{id:guid}/seats", SessionSeatsAsync);
        app.MapPost("/workspace/cogita/session/{id:guid}/keys", SessionKeysAsync);
        app.MapDelete("/workspace/cogita/session/{id:guid}", DeleteSessionAsync);

        app.MapGet("/seat/{token}/cogita/sessions", SeatSessionsAsync);

        /* Mit Konto, Link, Platz oder dem Geheimnis der Sitzung (Köpfe X-Recreatio-Seat, X-Cogita-Join). */
        app.MapPost("/cogita/join", JoinCodeAsync);
        app.MapGet("/cogita/session/{id:guid}", OneSessionAsync);
        app.MapGet("/cogita/session/{id:guid}/events", EventsAsync);
        app.MapPost("/cogita/session/{id:guid}/events", PostEventsAsync);
        app.MapPost("/cogita/session/{id:guid}/state", StateAsync);
    }

    /* -- Die Sitzung ---------------------------------------------------------------------------- */

    internal sealed record SessionRow(
        Guid Id, Guid AreaId, Guid? LibraryId, string Kind, string State, int Epoch, byte[]? Title, Guid HostRoleId,
        string? PagePath, byte[]? JoinHash, string? JoinCode, DateTimeOffset? EndsAt,
        DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? StartedAt, DateTimeOffset? ClosedAt);

    private const string SessionColumns = """
        id, area_id, library_id, kind, state, epoch, title_sealed, host_role_id, page_path, join_sha256, join_code, ends_at,
        created_at, updated_at, started_at, closed_at
        """;

    private static SessionRow ReadSession(SqlDataReader r) => new(
        r.GetGuid(0), r.GetGuid(1), r.IsDBNull(2) ? null : r.GetGuid(2), r.GetString(3), r.GetString(4), r.GetInt32(5),
        r.IsDBNull(6) ? null : (byte[])r[6], r.GetGuid(7), r.IsDBNull(8) ? null : r.GetString(8),
        r.IsDBNull(9) ? null : (byte[])r[9], r.IsDBNull(10) ? null : r.GetString(10),
        r.IsDBNull(11) ? null : r.GetDateTimeOffset(11),
        r.GetDateTimeOffset(12), r.GetDateTimeOffset(13), r.IsDBNull(14) ? null : r.GetDateTimeOffset(14), r.IsDBNull(15) ? null : r.GetDateTimeOffset(15));

    internal static async Task<SessionRow?> SessionAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand($"SELECT {SessionColumns} FROM app.cogita_session WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadSession(reader) : null;
    }

    private static object Told(SessionRow s, bool host) => new
    {
        sessionId = Ids.ToText(s.Id),
        areaId = Ids.ToText(s.AreaId),
        libraryId = s.LibraryId is { } l ? Ids.ToText(l) : null,
        kind = s.Kind,
        state = s.State,
        epoch = s.Epoch,
        titleSealed = s.Title is null ? null : Base64Url.Encode(s.Title),
        hostRoleId = Ids.ToText(s.HostRoleId),
        pagePath = s.PagePath,
        /* Den Code sieht, wer ihn weitergibt; das Geheimnis kennt der Dienst nicht. */
        joinCode = host ? s.JoinCode : null,
        joinable = s.JoinHash is not null || s.JoinCode is not null,
        endsAt = s.EndsAt,
        createdAt = s.CreatedAt,
        updatedAt = s.UpdatedAt,
        startedAt = s.StartedAt,
        closedAt = s.ClosedAt,
        host
    };

    /* -- Wer ist dabei ---------------------------------------------------------------------------- */

    /// <summary>Wie jemand an eine Sitzung kommt: Konto (Keks), Links, Platz, Geheimnis oder Code.</summary>
    internal sealed record Credentials(string? Links, string? Seat, string? Join);

    internal sealed record Presence(SessionRow Session, bool Host, Guid? AccountId, IReadOnlyList<Guid> Roles, Guid? SeatId, bool ByJoin);

    internal static Credentials CredentialsOf(HttpContext ctx) => new(
        ctx.Request.Headers[Callers.Header].ToString(),
        ctx.Request.Headers[SeatHeader].ToString(),
        ctx.Request.Headers[JoinHeader].ToString());

    /// <summary>Der Rufer mit ausdrücklich genannten Links — ein WebSocket kann keine eigenen Köpfe schicken.</summary>
    private static async Task<Caller?> CallerOfAsync(HttpContext ctx, Db db, SqlConnection connection, string? links)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is not null)
            return new Caller(who.Value.AccountId, await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted));
        var held = await HeldLinks.RoleRowsAsync(connection, links, ctx.RequestAborted);
        return held.Count == 0 ? null : new Caller(null, held);
    }

    private static async Task<bool> HasSeatKeyAsync(SqlConnection connection, Guid sessionId, Guid seatId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT TOP 1 1 FROM app.cogita_session_key WHERE session_id = @s AND access_id = @a;", connection);
        cmd.Parameters.AddWithValue("@s", sessionId);
        cmd.Parameters.AddWithValue("@a", seatId);
        return await cmd.ExecuteScalarAsync(ct) is not null;
    }

    /// <summary>Stimmt das Geheimnis (oder der Code) der Sitzung? In fester Zeit verglichen.</summary>
    private static bool JoinMatches(SessionRow s, string? join)
    {
        if (string.IsNullOrWhiteSpace(join)) return false;
        var given = join.Trim();
        if (given.StartsWith("code:", StringComparison.Ordinal))
        {
            var code = given[5..].Trim().ToUpperInvariant();
            return s.JoinCode is not null && code.Length == s.JoinCode.Length
                && CryptographicOperations.FixedTimeEquals(System.Text.Encoding.UTF8.GetBytes(code), System.Text.Encoding.UTF8.GetBytes(s.JoinCode));
        }
        if (s.JoinHash is null) return false;
        var hash = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(given));
        return CryptographicOperations.FixedTimeEquals(hash, s.JoinHash);
    }

    internal static async Task<Presence?> PresenceAsync(HttpContext ctx, Db db, SqlConnection connection, Guid id, Credentials cred)
    {
        var ct = ctx.RequestAborted;
        var session = await SessionAsync(connection, id, ct);
        if (session is null) return null;

        var caller = await CallerOfAsync(ctx, db, connection, cred.Links);
        if (caller is not null)
        {
            var host = caller.Holds(session.HostRoleId) || await Area.MayAsync(connection, caller, session.AreaId, Capability.Write, ct);
            if (host || await Area.MayAsync(connection, caller, session.AreaId, Capability.Read, ct))
                return new Presence(session, host, caller.AccountId, caller.RoleIds, null, false);
        }

        if (!string.IsNullOrWhiteSpace(cred.Seat))
        {
            var seat = await Seat.LiveSeatAsync(connection, cred.Seat, gated: true, ct);
            if (seat is not null && (seat.Value.AreaId == session.AreaId
                || await Library.SeatReadsAsync(connection, seat.Value.Id, session.AreaId, ct)
                || await HasSeatKeyAsync(connection, id, seat.Value.Id, ct)))
                return new Presence(session, false, null, [], seat.Value.Id, false);
        }

        if (session.State != "closed" && JoinMatches(session, cred.Join))
            return new Presence(session, false, null, [], null, true);

        return null;
    }

    /* -- Anlegen und finden --------------------------------------------------------------------- */

    public sealed record SessionRequest(
        string? SessionId, string? AreaId, string? LibraryId, string? Kind, int Epoch, string? TitleSealed, string? HostRoleId,
        string? PagePath, string? JoinHash, bool JoinCode, DateTimeOffset? EndsAt);

    private const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    /// <summary>
    /// EINE SITZUNG ANLEGEN — wer im Bereich schreibt, mit einer seiner Rollen
    /// als Gastgeber. Die Kennung kommt aus dem Browser (die AAD des Titels
    /// nennt sie), ebenso der Hash des Geheimnisses im Link; den Code würfelt
    /// der Dienst.
    /// </summary>
    private static async Task CreateSessionAsync(HttpContext ctx, Db db, SessionRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var kind = (body.Kind ?? string.Empty).Trim();
        if (!Guid.TryParse(body.SessionId, out var id) || !Guid.TryParse(body.AreaId, out var areaId)
            || !Guid.TryParse(body.HostRoleId, out var host) || !SessionKinds.Contains(kind))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna sesja.");
            return;
        }

        byte[]? title = null;
        if (!string.IsNullOrEmpty(body.TitleSealed) && !Blob(body.TitleSealed, MaxTitle, out title))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny tytuł.");
            return;
        }
        byte[]? joinHash = null;
        if (!string.IsNullOrEmpty(body.JoinHash) && (!Blob(body.JoinHash, 32, out joinHash) || joinHash.Length != 32))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz dołączenia.");
            return;
        }
        var pagePath = string.IsNullOrWhiteSpace(body.PagePath) ? null : body.PagePath.Trim();
        if (pagePath is { Length: > 400 })
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Za długi adres strony.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == host) || Workspace.IsAccount(mine, host))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Gospodarzem jest jedna z Twoich ról.");
            return;
        }
        if (!await Area.MayAsync(connection, new Caller(who.Value.AccountId, mine), areaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Sesję prowadzi ktoś, kto pisze w obszarze.");
            return;
        }

        await using (var epoch = new SqlCommand("SELECT current_epoch FROM app.area WHERE id = @id;", connection))
        {
            epoch.Parameters.AddWithValue("@id", areaId);
            if (await epoch.ExecuteScalarAsync(ctx.RequestAborted) is not int current || body.Epoch < 1 || body.Epoch > current)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru.");
                return;
            }
        }

        if (Guid.TryParse(body.LibraryId, out var library))
        {
            var libraryArea = await LibraryAreaAsync(connection, library, ctx.RequestAborted);
            if (libraryArea is null || !await Area.MayAsync(connection, new Caller(who.Value.AccountId, mine), libraryArea.Value, Capability.Read, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej biblioteki nie ma.");
                return;
            }
        }

        string? code = null;
        for (var attempt = 0; attempt < 10; attempt++)
        {
            code = body.JoinCode ? RandomNumberGenerator.GetString(CodeAlphabet, 6) : null;
            await using var insert = new SqlCommand("""
                INSERT INTO app.cogita_session
                    (id, area_id, library_id, kind, state, epoch, title_sealed, host_role_id, page_path, join_sha256, join_code, ends_at, created_at, updated_at)
                VALUES (@id, @area, @library, @kind, N'lobby', @epoch, @title, @host, @page, @hash, @code, @ends, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
                """, connection);
            insert.Parameters.AddWithValue("@id", id);
            insert.Parameters.AddWithValue("@area", areaId);
            insert.Parameters.Add("@library", System.Data.SqlDbType.UniqueIdentifier).Value = Guid.TryParse(body.LibraryId, out var lib) ? lib : DBNull.Value;
            insert.Parameters.AddWithValue("@kind", kind);
            insert.Parameters.AddWithValue("@epoch", body.Epoch);
            insert.Parameters.AddBlob("@title", title);
            insert.Parameters.AddWithValue("@host", host);
            insert.Parameters.AddWithValue("@page", (object?)pagePath ?? DBNull.Value);
            insert.Parameters.Add("@hash", System.Data.SqlDbType.VarBinary, 32).Value = (object?)joinHash ?? DBNull.Value;
            insert.Parameters.AddWithValue("@code", (object?)code ?? DBNull.Value);
            insert.Parameters.AddWithValue("@ends", (object?)body.EndsAt ?? DBNull.Value);
            try
            {
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
                break;
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                if (await SessionAsync(connection, id, ctx.RequestAborted) is not null)
                {
                    await Fail(ctx, StatusCodes.Status409Conflict, "Ta sesja już jest.");
                    return;
                }
                if (!body.JoinCode) throw;
                // Der Code war schon vergeben — noch einmal.
            }
        }

        var made = await SessionAsync(connection, id, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(Told(made!, true));
    }

    /// <summary>Die Sitzungen der Bereiche, die ich lese — die neuesten zuerst.</summary>
    private static async Task ListSessionsAsync(HttpContext ctx, Db db, string? areaId, string? libraryId)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var held = await Agenda.HeldAreasAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (Guid.TryParse(areaId, out var only)) held = held.Where(a => a == only).ToList();

        var rows = new List<SessionRow>();
        if (held.Count > 0)
        {
            var names = string.Join(", ", held.Select((_, i) => $"@a{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT TOP 200 {SessionColumns} FROM app.cogita_session
                WHERE area_id IN ({names}) {(Guid.TryParse(libraryId, out _) ? "AND library_id = @library" : "")}
                  AND (state <> N'closed' OR updated_at > DATEADD(day, -60, SYSDATETIMEOFFSET()))
                ORDER BY updated_at DESC;
                """, connection);
            for (var i = 0; i < held.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", held[i]);
            if (Guid.TryParse(libraryId, out var lib)) cmd.Parameters.AddWithValue("@library", lib);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) rows.Add(ReadSession(reader));
        }

        var writes = new Dictionary<Guid, bool>();
        var told = new List<object>();
        foreach (var s in rows)
        {
            if (!writes.TryGetValue(s.AreaId, out var w)) writes[s.AreaId] = w = await Area.MayAsync(connection, new Caller(who.Value.AccountId, mine), s.AreaId, Capability.Write, ctx.RequestAborted);
            told.Add(Told(s, w || mine.Any(r => r.Id == s.HostRoleId)));
        }
        await ctx.Response.WriteAsJsonAsync(new { sessions = told });
    }

    /// <summary>Für einen Platz: die Sitzungen seines Bereichs, seiner Rollen, und die, für die er einen Schlüssel bekam.</summary>
    private static async Task SeatSessionsAsync(HttpContext ctx, Db db, string token)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma."); return; }

        var rows = new List<SessionRow>();
        await using (var cmd = new SqlCommand($"""
            SELECT TOP 100 {SessionColumns} FROM app.cogita_session s
            WHERE s.state NOT IN (N'closed')
              AND (s.area_id = @area
                   OR EXISTS (SELECT 1 FROM app.access_grant g WHERE g.access_id = @seat AND g.area_id = s.area_id)
                   OR EXISTS (SELECT 1 FROM app.access_role_area r WHERE r.access_id = @seat AND r.area_id = s.area_id)
                   OR EXISTS (SELECT 1 FROM app.cogita_session_key k WHERE k.session_id = s.id AND k.access_id = @seat))
            ORDER BY s.updated_at DESC;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@area", seat.Value.AreaId);
            cmd.Parameters.AddWithValue("@seat", seat.Value.Id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) rows.Add(ReadSession(reader));
        }

        var keys = await SeatKeysAsync(connection, rows.Select(r => r.Id).ToList(), seat.Value.Id, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new
        {
            sessions = rows.Select(s => new
            {
                session = Told(s, false),
                keys = keys.TryGetValue(s.Id, out var k) ? k : []
            })
        });
    }

    private static async Task<Dictionary<Guid, List<object>>> SeatKeysAsync(SqlConnection connection, IReadOnlyList<Guid> sessions, Guid seatId, CancellationToken ct)
    {
        var map = new Dictionary<Guid, List<object>>();
        if (sessions.Count == 0) return map;
        var names = string.Join(", ", sessions.Select((_, i) => $"@s{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT session_id, epoch, key_sealed FROM app.cogita_session_key WHERE access_id = @seat AND session_id IN ({names});
            """, connection);
        cmd.Parameters.AddWithValue("@seat", seatId);
        for (var i = 0; i < sessions.Count; i++) cmd.Parameters.AddWithValue($"@s{i}", sessions[i]);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var s = reader.GetGuid(0);
            if (!map.TryGetValue(s, out var list)) map[s] = list = [];
            list.Add(new { epoch = reader.GetInt32(1), keySealed = Base64Url.Encode((byte[])reader[2]) });
        }
        return map;
    }

    public sealed record JoinRequest(string? Code);

    /// <summary>
    /// EIN CODE ZUM EINTIPPEN — er sagt, welche Sitzung es ist, und gibt das
    /// Mitmachen. Einen Schlüssel gibt er nicht: das Telefon zeigt die Knöpfe,
    /// die Fragen stehen auf der Leinwand.
    /// </summary>
    private static async Task JoinCodeAsync(HttpContext ctx, Db db, JoinRequest body)
    {
        var code = (body.Code ?? string.Empty).Trim().ToUpperInvariant();
        if (code.Length != 6 || code.Any(c => !CodeAlphabet.Contains(c)))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Kod ma sześć znaków.");
            return;
        }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        SessionRow? session = null;
        await using (var cmd = new SqlCommand($"SELECT {SessionColumns} FROM app.cogita_session WHERE join_code = @code AND state <> N'closed';", connection))
        {
            cmd.Parameters.AddWithValue("@code", code);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted)) session = ReadSession(reader);
        }
        if (session is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Nie ma sesji z takim kodem.");
            return;
        }
        await ctx.Response.WriteAsJsonAsync(new { session = Told(session, false), join = $"code:{code}" });
    }

    /// <summary>Die Sitzung, für wen auch immer dabei ist — dazu, ob er sie führt, und für einen Platz seine Schlüssel.</summary>
    private static async Task OneSessionAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var presence = await PresenceAsync(ctx, db, connection, id, CredentialsOf(ctx));
        if (presence is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiej sesji nie ma."); return; }

        var keys = presence.SeatId is { } seat
            ? (await SeatKeysAsync(connection, [id], seat, ctx.RequestAborted)).GetValueOrDefault(id) ?? []
            : [];
        await ctx.Response.WriteAsJsonAsync(new
        {
            session = Told(presence.Session, presence.Host),
            seatId = presence.SeatId is { } s ? Ids.ToText(s) : null,
            keys,
            /* Die Annahme des Bereichs — dorthin gehen die Antworten (öffentlich, wie bei einem Formular). */
            intake = await HasIntakeAsync(connection, presence.Session.AreaId, ctx.RequestAborted)
        });
    }

    /* -- Ereignisse ----------------------------------------------------------------------------- */

    internal sealed record EventRow(int Seq, Guid Id, string Kind, Guid? AuthorRole, Guid? AuthorPerson, Guid? AuthorSeat, int Epoch, byte[]? Sealed, string? Plain, DateTimeOffset At);

    private static object ToldEvent(Guid session, EventRow e) => new
    {
        sessionId = Ids.ToText(session),
        seq = e.Seq,
        eventId = Ids.ToText(e.Id),
        kind = e.Kind,
        authorRoleId = e.AuthorRole is { } r ? Ids.ToText(r) : null,
        authorPersonId = e.AuthorPerson is { } p ? Ids.ToText(p) : null,
        authorSeatId = e.AuthorSeat is { } a ? Ids.ToText(a) : null,
        epoch = e.Epoch,
        @sealed = e.Sealed is null ? null : Base64Url.Encode(e.Sealed),
        plain = e.Plain,
        createdAt = e.At
    };

    /// <summary>Wer was sieht: der Gastgeber alles; ein Teilnehmer, was der Gastgeber und der Dienst schreiben.</summary>
    private static bool ForEveryone(string kind) => !ParticipantKinds.Contains(kind);

    private static async Task EventsAsync(HttpContext ctx, Db db, Guid id, int? after)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var presence = await PresenceAsync(ctx, db, connection, id, CredentialsOf(ctx));
        if (presence is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiej sesji nie ma."); return; }

        var participant = string.Join(", ", ParticipantKinds.Select(k => $"N'{k}'"));
        await using var cmd = new SqlCommand($"""
            SELECT TOP 2000 seq, id, kind, author_role_id, author_person_id, author_access_id, epoch, sealed, plain, created_at
            FROM app.cogita_session_event
            WHERE session_id = @s AND seq > @after
              {(presence.Host ? "" : $"AND (kind NOT IN ({participant}) OR (@seat IS NOT NULL AND author_access_id = @seat))")}
            ORDER BY seq;
            """, connection);
        cmd.Parameters.AddWithValue("@s", id);
        cmd.Parameters.AddWithValue("@after", Math.Max(0, after ?? 0));
        cmd.Parameters.Add("@seat", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)presence.SeatId ?? DBNull.Value;

        var events = new List<object>();
        var last = after ?? 0;
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var row = new EventRow(reader.GetInt32(0), reader.GetGuid(1), reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetGuid(3), reader.IsDBNull(4) ? null : reader.GetGuid(4), reader.IsDBNull(5) ? null : reader.GetGuid(5),
                    reader.GetInt32(6), reader.IsDBNull(7) ? null : (byte[])reader[7], reader.IsDBNull(8) ? null : reader.GetString(8), reader.GetDateTimeOffset(9));
                last = Math.Max(last, row.Seq);
                events.Add(ToldEvent(id, row));
            }
        }

        await ctx.Response.WriteAsJsonAsync(new { session = Told(presence.Session, presence.Host), events, last });
    }

    public sealed record EventIn(string? EventId, string? Kind, int Epoch, string? Sealed, string? Plain, string? AuthorRoleId, string? AuthorPersonId);

    public sealed record EventsRequest(IReadOnlyList<EventIn>? Events);

    private static bool IsEventKind(string kind) =>
        kind.Length is >= 2 and <= 16 && kind.All(c => c is >= 'a' and <= 'z' or >= '0' and <= '9' or '_' or '-');

    /// <summary>Ereignisse anhängen (und weitertragen) — der Dienst vergibt die Reihenfolge.</summary>
    internal static async Task<List<EventRow>> AppendAsync(
        SqlConnection connection, Guid sessionId, IReadOnlyList<(Guid Id, string Kind, Guid? Role, Guid? Person, Guid? Seat, int Epoch, byte[]? Sealed, string? Plain)> events,
        CancellationToken ct)
    {
        var out_ = new List<EventRow>();
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ct);
        int next;
        int count;
        await using (var seq = new SqlCommand("""
            SELECT ISNULL(MAX(seq), 0), COUNT(*) FROM app.cogita_session_event WITH (UPDLOCK, HOLDLOCK) WHERE session_id = @s;
            """, connection, tx))
        {
            seq.Parameters.AddWithValue("@s", sessionId);
            await using var reader = await seq.ExecuteReaderAsync(ct);
            await reader.ReadAsync(ct);
            next = reader.GetInt32(0) + 1;
            count = reader.GetInt32(1);
        }
        if (count + events.Count > MaxEventsPerSession) throw new InvalidOperationException("session full");

        var now = DateTimeOffset.UtcNow;
        foreach (var e in events)
        {
            await using var insert = new SqlCommand("""
                IF NOT EXISTS (SELECT 1 FROM app.cogita_session_event WHERE id = @id)
                    INSERT INTO app.cogita_session_event (session_id, seq, id, kind, author_role_id, author_person_id, author_access_id, epoch, sealed, plain, created_at)
                    VALUES (@s, @seq, @id, @kind, @role, @person, @seat, @epoch, @sealed, @plain, @now);
                """, connection, tx);
            insert.Parameters.AddWithValue("@s", sessionId);
            insert.Parameters.AddWithValue("@seq", next);
            insert.Parameters.AddWithValue("@id", e.Id);
            insert.Parameters.AddWithValue("@kind", e.Kind);
            insert.Parameters.Add("@role", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)e.Role ?? DBNull.Value;
            insert.Parameters.Add("@person", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)e.Person ?? DBNull.Value;
            insert.Parameters.Add("@seat", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)e.Seat ?? DBNull.Value;
            insert.Parameters.AddWithValue("@epoch", e.Epoch);
            insert.Parameters.AddBlob("@sealed", e.Sealed);
            insert.Parameters.AddWithValue("@plain", (object?)e.Plain ?? DBNull.Value);
            insert.Parameters.AddWithValue("@now", now);
            if (await insert.ExecuteNonQueryAsync(ct) == 0) continue;
            out_.Add(new EventRow(next, e.Id, e.Kind, e.Role, e.Person, e.Seat, e.Epoch, e.Sealed, e.Plain, now));
            next++;
        }

        await using (var touch = new SqlCommand("UPDATE app.cogita_session SET updated_at = @now WHERE id = @s;", connection, tx))
        {
            touch.Parameters.AddWithValue("@s", sessionId);
            touch.Parameters.AddWithValue("@now", now);
            await touch.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
        return out_;
    }

    /// <summary>Was angehängt wurde, hinaus: an alle, oder (Antworten, Anmeldungen) nur an die Gastgeber.</summary>
    internal static async Task BroadcastAsync(IHubContext<CogitaHub> hub, Guid sessionId, IEnumerable<EventRow> rows, CancellationToken ct)
    {
        foreach (var row in rows)
        {
            var group = ForEveryone(row.Kind) ? CogitaHub.All(sessionId) : CogitaHub.Hosts(sessionId);
            try { await hub.Clients.Group(group).SendAsync("ev", ToldEvent(sessionId, row), ct); }
            catch (Exception) { /* Wer gerade nicht verbunden ist, holt es sich über REST. */ }
        }
    }

    private static async Task PostEventsAsync(HttpContext ctx, Db db, IHubContext<CogitaHub> hub, Guid id, EventsRequest body)
    {
        var given = body.Events ?? [];
        if (given.Count == 0 || given.Count > MaxEventsAtOnce)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Od 1 do {MaxEventsAtOnce} zdarzeń naraz.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var presence = await PresenceAsync(ctx, db, connection, id, CredentialsOf(ctx));
        if (presence is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiej sesji nie ma."); return; }
        if (presence.Session.State == "closed")
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta sesja jest zamknięta.");
            return;
        }

        var parsed = new List<(Guid Id, string Kind, Guid? Role, Guid? Person, Guid? Seat, int Epoch, byte[]? Sealed, string? Plain)>();
        foreach (var e in given)
        {
            var kind = (e.Kind ?? string.Empty).Trim();
            if (!Guid.TryParse(e.EventId, out var eventId) || !IsEventKind(kind) || ServiceKinds.Contains(kind) || e.Epoch < 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zdarzenie.");
                return;
            }
            if (!presence.Host && !ParticipantKinds.Contains(kind))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "To zdarzenie wysyła gospodarz.");
                return;
            }
            byte[]? sealedBytes = null;
            if (!string.IsNullOrEmpty(e.Sealed) && !Blob(e.Sealed, MaxEventSealed, out sealedBytes))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Zdarzenie może mieć najwyżej 64 kB.");
                return;
            }
            var plain = string.IsNullOrEmpty(e.Plain) ? null : e.Plain;
            if (plain is not null && (plain.Length > MaxEventPlain || !IsJson(plain)))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Jawna część zdarzenia: JSON, najwyżej 16 kB.");
                return;
            }
            if (sealedBytes is null && plain is null)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Puste zdarzenie.");
                return;
            }

            /* Wer spricht: eine eigene Rolle (und Person) — sonst niemand Benanntes; ein Platz als er selbst. */
            Guid? role = Guid.TryParse(e.AuthorRoleId, out var r) && presence.Roles.Contains(r) ? r : null;
            Guid? person = Guid.TryParse(e.AuthorPersonId, out var p) && presence.Roles.Contains(p) ? p : null;
            parsed.Add((eventId, kind, role, person, presence.SeatId, e.Epoch, sealedBytes, plain));
        }

        List<EventRow> rows;
        try
        {
            rows = await AppendAsync(connection, id, parsed, ctx.RequestAborted);
        }
        catch (InvalidOperationException)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta sesja ma już za dużo zdarzeń.");
            return;
        }

        await BroadcastAsync(hub, id, rows, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { events = rows.Select(r => new { eventId = Ids.ToText(r.Id), seq = r.Seq }) });
    }

    private static bool IsJson(string text)
    {
        try { using var _ = JsonDocument.Parse(text); return true; }
        catch (JsonException) { return false; }
    }

    public sealed record StateRequest(string? State, DateTimeOffset? EndsAt, string? TitleSealed, int? Epoch);

    /// <summary>
    /// DER GANG DER SITZUNG — Warteraum, läuft, Pause, beendet, geschlossen.
    /// Endet ein Spiel, gehen die Positionen und der offene Spielstand [J3].
    /// </summary>
    private static async Task StateAsync(HttpContext ctx, Db db, IHubContext<CogitaHub> hub, Guid id, StateRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var presence = await PresenceAsync(ctx, db, connection, id, CredentialsOf(ctx));
        if (presence is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiej sesji nie ma."); return; }
        if (!presence.Host) { await Fail(ctx, StatusCodes.Status403Forbidden, "Sesję prowadzi gospodarz."); return; }

        var state = (body.State ?? presence.Session.State).Trim();
        if (!States.Contains(state)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieznany stan sesji."); return; }
        byte[]? title = null;
        if (!string.IsNullOrEmpty(body.TitleSealed) && !Blob(body.TitleSealed, MaxTitle, out title))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny tytuł.");
            return;
        }

        await using (var cmd = new SqlCommand("""
            UPDATE app.cogita_session
               SET state = @state, updated_at = SYSDATETIMEOFFSET(),
                   started_at = CASE WHEN @state = N'running' AND started_at IS NULL THEN SYSDATETIMEOFFSET() ELSE started_at END,
                   closed_at = CASE WHEN @state IN (N'finished', N'closed') THEN COALESCE(closed_at, SYSDATETIMEOFFSET()) ELSE NULL END,
                   ends_at = COALESCE(@ends, ends_at),
                   title_sealed = COALESCE(@title, title_sealed),
                   epoch = CASE WHEN @title IS NULL THEN epoch ELSE @epoch END
             WHERE id = @id;
            IF @state IN (N'finished', N'closed')
            BEGIN
                DELETE FROM app.cogita_game_position WHERE session_id = @id;
                DELETE FROM app.cogita_game_state WHERE session_id = @id;
            END
            """, connection))
        {
            cmd.Parameters.AddWithValue("@state", state);
            cmd.Parameters.AddWithValue("@ends", (object?)body.EndsAt ?? DBNull.Value);
            cmd.Parameters.AddBlob("@title", title);
            cmd.Parameters.AddWithValue("@epoch", body.Epoch ?? presence.Session.Epoch);
            cmd.Parameters.AddWithValue("@id", id);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        var now = await SessionAsync(connection, id, ctx.RequestAborted);
        try { await hub.Clients.Group(CogitaHub.All(id)).SendAsync("state", Told(now!, false), ctx.RequestAborted); } catch (Exception) { }
        await ctx.Response.WriteAsJsonAsync(Told(now!, true));
    }

    /* -- Schlüssel für Plätze (wie in der Rozmowa) ----------------------------------------------- */

    /// <summary>Plätze des Bereichs mit Identität, denen der Schlüssel einer Epoche noch fehlt.</summary>
    private static async Task SessionSeatsAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var session = await SessionAsync(connection, id, ctx.RequestAborted);
        if (session is null || !await Area.MayAsync(connection, who.Value.AccountId, session.AreaId, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej sesji nie ma.");
            return;
        }

        var seats = new List<object>();
        await using (var cmd = new SqlCommand($"""
            SELECT TOP 2000 s.id, i.wrap_public_key,
                   (SELECT STRING_AGG(CAST(k.epoch AS nvarchar(12)), ',') FROM app.cogita_session_key k WHERE k.session_id = @session AND k.access_id = s.id)
            FROM app.access s JOIN app.seat_identity i ON i.access_id = s.id
            WHERE s.area_id = @area AND {Audience.LiveSeat("s")};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@session", id);
            cmd.Parameters.AddWithValue("@area", session.AreaId);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var epochs = reader.IsDBNull(2) ? [] : reader.GetString(2).Split(',').Select(int.Parse).ToArray();
                seats.Add(new { seatId = Ids.ToText(reader.GetGuid(0)), wrapPublicKey = Base64Url.Encode((byte[])reader[1]), epochs });
            }
        }
        await ctx.Response.WriteAsJsonAsync(new { seats });
    }

    public sealed record SeatKeyIn(string? SeatId, int Epoch, string? KeySealed);

    public sealed record SeatKeysRequest(string? ByRoleId, IReadOnlyList<SeatKeyIn>? Keys);

    /// <summary>Wer den Bereich liest, gibt Plätzen den Schlüssel der Sitzung — verpackt für ihre P-256-Identität.</summary>
    private static async Task SessionKeysAsync(HttpContext ctx, Db db, Guid id, SeatKeysRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        var keys = body.Keys ?? [];
        if (keys.Count > 500) { await Fail(ctx, StatusCodes.Status400BadRequest, "Najwyżej 500 kluczy naraz."); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var session = await SessionAsync(connection, id, ctx.RequestAborted);
        if (session is null || !await Area.MayAsync(connection, new Caller(who.Value.AccountId, mine), session.AreaId, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej sesji nie ma.");
            return;
        }
        Guid? by = Guid.TryParse(body.ByRoleId, out var b) && mine.Any(r => r.Id == b) ? b : null;

        var granted = 0;
        foreach (var k in keys)
        {
            if (!Guid.TryParse(k.SeatId, out var seat) || k.Epoch < 1 || !Blob(k.KeySealed, MaxKey, out var sealedKey)) continue;
            await using var cmd = new SqlCommand("""
                IF EXISTS (SELECT 1 FROM app.access WHERE id = @seat AND area_id = @area)
                   AND NOT EXISTS (SELECT 1 FROM app.cogita_session_key WHERE session_id = @session AND access_id = @seat AND epoch = @epoch)
                    INSERT INTO app.cogita_session_key (session_id, access_id, epoch, key_sealed, sealed_by_role_id, sealed_at)
                    VALUES (@session, @seat, @epoch, @key, @by, SYSDATETIMEOFFSET());
                """, connection);
            cmd.Parameters.AddWithValue("@seat", seat);
            cmd.Parameters.AddWithValue("@area", session.AreaId);
            cmd.Parameters.AddWithValue("@session", id);
            cmd.Parameters.AddWithValue("@epoch", k.Epoch);
            cmd.Parameters.AddBlob("@key", sealedKey);
            cmd.Parameters.Add("@by", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)by ?? DBNull.Value;
            granted += await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) > 0 ? 1 : 0;
        }
        await ctx.Response.WriteAsJsonAsync(new { granted });
    }

    /// <summary>Eine Sitzung ganz löschen — mit ihren Ereignissen, Schlüsseln und dem Spiel.</summary>
    private static async Task DeleteSessionAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var session = await SessionAsync(connection, id, ctx.RequestAborted);
        if (session is null || !(mine.Any(r => r.Id == session.HostRoleId) || await Area.MayAsync(connection, new Caller(who.Value.AccountId, mine), session.AreaId, Capability.Write, ctx.RequestAborted)))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej sesji nie ma.");
            return;
        }
        await DropSessionAsync(connection, id, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { sessionId = Ids.ToText(id), deleted = true });
    }

    internal static async Task DropSessionAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            DELETE FROM app.cogita_game_position WHERE session_id = @id;
            DELETE FROM app.cogita_game_state WHERE session_id = @id;
            DELETE FROM app.cogita_session_key WHERE session_id = @id;
            DELETE FROM app.cogita_session_event WHERE session_id = @id;
            DELETE FROM app.cogita_session WHERE id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
