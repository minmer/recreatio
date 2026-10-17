using System.Security.Cryptography;
using System.Text.Json;
using Kernel;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Die Ereignisse einer Sitzung, ihr Zustand, und die Schlüssel für Plätze.</summary>
public static partial class Cogita
{
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
}
