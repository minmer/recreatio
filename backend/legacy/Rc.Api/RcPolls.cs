using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 9.5 — Umfragen.
///
/// <b>Jede Stimme wird EINZELN unterschrieben.</b> Das ist der Unterschied
/// zwischen einer Umfrage und einer Zahl, die der Betreiber hinschreibt. Ohne
/// Unterschrift je Stimme waere ein Ergebnis eine Behauptung: wer die Datenbank
/// hat, koennte Stimmen erfinden, aendern oder verschwinden lassen, und niemand
/// koennte es zeigen.
///
/// <b>Zwei Zeitpunkte der Auszaehlung (<c>reveal</c>).</b>
///
///   <c>immediate</c> — jeder sieht den Stand sofort. Bequem, aber es
///   beeinflusst: wer als Zehnter abstimmt, sieht neun Stimmen und schliesst
///   sich an.
///
///   <c>on_close</c> — der Stand wird erst beim Schliessen sichtbar. Fuer alles,
///   wo die eigene Meinung zaehlen soll und nicht die Mehrheit.
///
/// Der Server haelt sich daran: bei <c>on_close</c> liefert er vor dem
/// Schliessen KEINE Auszaehlung, auch nicht an den, der die Umfrage angelegt
/// hat. Eine Regel, die der Klient durchsetzt, ist keine Regel.
/// </summary>
public static class RcPolls
{
    public const string ModeSingle = "single";
    public const string ModeMulti = "multi";
    public const string ModeQuiz = "quiz";

    public const string RevealImmediate = "immediate";
    public const string RevealOnClose = "on_close";

    public static void MapRcPolls(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/areas/{id:guid}/polls", ListAsync).Produces<RcPollsResponse>();
        app.MapPost("/rc/areas/{id:guid}/polls", CreateAsync).Produces<RcPollCreatedResponse>();
        app.MapPost("/rc/polls/{id:guid}/vote", VoteAsync).Produces<RcPollVotedResponse>();
        app.MapPost("/rc/polls/{id:guid}/close", CloseAsync).Produces<RcPollClosedResponse>();
    }

    // -- Anlegen --------------------------------------------------------------

    public sealed record CreatePollRequest(string Question, string? Mode, string? Reveal);

    private static async Task CreateAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, CreatePollRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var question = body.Question?.Trim() ?? "";
        if (question.Length is 0 or > 500)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Eine Umfrage braucht eine Frage.");
            return;
        }

        var mode = body.Mode ?? ModeSingle;
        var reveal = body.Reveal ?? RevealImmediate;

        if (mode is not (ModeSingle or ModeMulti or ModeQuiz) || reveal is not (RevealImmediate or RevealOnClose))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Art von Umfrage gibt es nicht.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id, RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var epoch = await RcTopics.CurrentEpochAsync(connection, id, ctx.RequestAborted);
        var epochKey = await RcAreaKeys.EpochKeyAsync(
            connection, session.AccountId, held.MasterKey, id, epoch, ctx.RequestAborted);

        if (epochKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.CryptoMissingKey, "Fuer die laufende Epoche fehlt dir der Schluessel.");
            return;
        }

        var pollId = RcId.NewId();
        var sealedQuestion = RcCrypto.Seal(epochKey, QuestionAad(pollId), Encoding.UTF8.GetBytes(question));

        await using var cmd = new SqlCommand("""
            INSERT INTO dbo.rc_poll (id, area_id, question_sealed, mode, reveal, created_at)
            VALUES (@id, @area, @question, @mode, @reveal, @now);
            """, connection);

        cmd.Parameters.AddWithValue("@id", pollId);
        cmd.Parameters.AddWithValue("@area", id);
        cmd.Parameters.AddWithValue("@question", sealedQuestion);
        cmd.Parameters.AddWithValue("@mode", mode);
        cmd.Parameters.AddWithValue("@reveal", reveal);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcPollCreatedResponse(
            RcId.ToText(pollId), question, mode, reveal), StatusCodes.Status201Created);
    }

    // -- Abstimmen ------------------------------------------------------------

    public sealed record VoteRequest(string RoleId, string Choice);

    /// <summary>
    /// Eine Stimme ist ein eigener Datensatz mit eigener Unterschrift. Beim
    /// Umentscheiden wird NICHT ueberschrieben, sondern angefuegt — die letzte
    /// Stimme je Rolle zaehlt.
    ///
    /// Das ist mehr Zeilen und weniger Bequemlichkeit, aber es ist der Grund,
    /// warum die Auszaehlung nachpruefbar ist: eine ueberschriebene Stimme
    /// hinterlaesst keine Spur, eine angefuegte schon.
    /// </summary>
    private static async Task VoteAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, VoteRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.RoleId, out var roleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der Rolle ist unlesbar.");
            return;
        }

        var choice = body.Choice?.Trim() ?? "";
        if (choice.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Antwort ist leer oder zu lang.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var poll = await LoadAsync(connection, id, ctx.RequestAborted);
        if (poll is null) { await RcAreas.NotForYou(ctx); return; }

        if (poll.ClosedUtc is not null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Diese Umfrage ist geschlossen.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, poll.AreaId, RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var roleKey = await RcRoleAccess.RoleKeyAsync(connection, session.AccountId, held.MasterKey, roleId, ctx.RequestAborted);
        if (roleKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Unter diesem Namen kannst du nicht abstimmen.");
            return;
        }

        var epoch = await RcTopics.CurrentEpochAsync(connection, poll.AreaId, ctx.RequestAborted);
        var epochKey = await RcAreaKeys.EpochKeyAsync(
            connection, session.AccountId, held.MasterKey, poll.AreaId, epoch, ctx.RequestAborted);

        if (epochKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.CryptoMissingKey, "Fuer die laufende Epoche fehlt dir der Schluessel.");
            return;
        }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [roleId], ctx.RequestAborted);
        if (!identities.TryGetValue(roleId, out var voter))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        var voteId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;
        var sealedChoice = RcCrypto.Seal(epochKey, ChoiceAad(voteId), Encoding.UTF8.GetBytes(choice));

        // Unterschrieben wird der HASH des Geheimtextes zusammen mit Umfrage,
        // Rolle und Zeit — nicht die Antwort im Klartext. Wer die Auszaehlung
        // nachprueft, muss nicht lesen duerfen, WAS gestimmt wurde.
        var record = new RcMessageVersionRecord
        {
            Id = voteId,
            MessageId = id,
            Version = 1,
            AuthorRoleId = roleId,
            BodyHash = RcMessageVersionRecord.QuoteHash(sealedChoice),
            CreatedUtc = now
        };

        using var voterSign = RcRoleKeys.OpenSignKey(voter, roleKey);

        await using var cmd = new SqlCommand("""
            INSERT INTO dbo.rc_poll_vote (id, poll_id, role_id, choice_sealed, signature, cast_at)
            VALUES (@id, @poll, @role, @choice, @sig, @now);
            """, connection);

        cmd.Parameters.AddWithValue("@id", voteId);
        cmd.Parameters.AddWithValue("@poll", id);
        cmd.Parameters.AddWithValue("@role", roleId);
        cmd.Parameters.AddWithValue("@choice", sealedChoice);
        cmd.Parameters.AddWithValue("@sig", record.Sign(voterSign));
        cmd.Parameters.AddWithValue("@now", now);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcPollVotedResponse(RcId.ToText(id), RcId.ToText(voteId)),
            StatusCodes.Status201Created);
    }

    // -- Ansehen und Schliessen -----------------------------------------------

    public sealed record PollView(
        string PollId, string? Question, string Mode, string Reveal, bool Closed,
        int VoteCount, IReadOnlyDictionary<string, int>? Tally, string? YourChoice);

    private static async Task ListAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id, RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey, id, ctx.RequestAborted);
        var mine = await RcRoleAccess.AllRoleKeysAsync(connection, session.AccountId, held.MasterKey, ctx.RequestAborted);

        var polls = new List<(Guid Id, byte[] Question, string Mode, string Reveal, bool Closed)>();
        await using (var cmd = new SqlCommand(
            "SELECT id, question_sealed, mode, reveal, closed_at FROM dbo.rc_poll WHERE area_id = @area ORDER BY seq DESC;",
            connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                polls.Add((reader.GetGuid(0), (byte[])reader[1], reader.GetString(2), reader.GetString(3),
                    !reader.IsDBNull(4)));
            }
        }

        var views = new List<PollView>();
        foreach (var poll in polls)
        {
            var votes = await LatestVotesAsync(connection, poll.Id, ctx.RequestAborted);

            // 9.5 — Bei on_close gibt es vor dem Schliessen KEINE Auszaehlung.
            // Auch nicht fuer den, der die Umfrage angelegt hat: eine Regel, die
            // nur fuer manche gilt, ist keine.
            var mayTally = poll.Reveal == RevealImmediate || poll.Closed;

            Dictionary<string, int>? tally = null;
            string? yours = null;

            foreach (var vote in votes)
            {
                var choice = RcAreaKeys.TryOpenText(keys, ChoiceAad(vote.VoteId), vote.Choice);
                if (choice is null) continue;

                if (mine.ContainsKey(vote.RoleId)) yours = choice;
                if (!mayTally) continue;

                tally ??= [];
                tally[choice] = tally.GetValueOrDefault(choice) + 1;
            }

            views.Add(new PollView(
                RcId.ToText(poll.Id),
                RcAreaKeys.TryOpenText(keys, QuestionAad(poll.Id), poll.Question),
                poll.Mode, poll.Reveal, poll.Closed, votes.Count, tally, yours));
        }

        await RcResults.WriteJsonAsync(ctx, new RcPollsResponse(views));
    }

    private static async Task CloseAsync(HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var poll = await LoadAsync(connection, id, ctx.RequestAborted);
        if (poll is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, poll.AreaId, RcCapability.Admin, ctx.RequestAborted);
        if (!may.Allowed)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Hier darfst du nichts schliessen.");
            return;
        }

        await using var cmd = new SqlCommand(
            "UPDATE dbo.rc_poll SET closed_at = @now WHERE id = @id AND closed_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@id", id);

        await RcResults.WriteJsonAsync(ctx, new RcPollClosedResponse(
            RcId.ToText(id), await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 1));
    }

    // -- Datenzugriff ---------------------------------------------------------

    private sealed record PollRow(Guid Id, Guid AreaId, string Mode, string Reveal, DateTimeOffset? ClosedUtc);

    private static async Task<PollRow?> LoadAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT id, area_id, mode, reveal, closed_at FROM dbo.rc_poll WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new PollRow(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3),
            reader.IsDBNull(4) ? null : reader.GetDateTimeOffset(4));
    }

    private sealed record VoteRow(Guid VoteId, Guid RoleId, byte[] Choice);

    /// <summary>
    /// Je Rolle die LETZTE Stimme. Die frueheren bleiben liegen — sie sind der
    /// Grund, warum sich das Ergebnis nachpruefen laesst.
    /// </summary>
    private static async Task<List<VoteRow>> LatestVotesAsync(SqlConnection connection, Guid pollId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            WITH ranked AS (
                SELECT id, role_id, choice_sealed,
                       ROW_NUMBER() OVER (PARTITION BY role_id ORDER BY cast_at DESC, seq DESC) AS rn
                FROM dbo.rc_poll_vote WHERE poll_id = @poll
            )
            SELECT id, role_id, choice_sealed FROM ranked WHERE rn = 1;
            """, connection);
        cmd.Parameters.AddWithValue("@poll", pollId);

        var votes = new List<VoteRow>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            votes.Add(new VoteRow(reader.GetGuid(0), reader.GetGuid(1), (byte[])reader[2]));
        return votes;
    }

    private static RcAad QuestionAad(Guid pollId) =>
        RcAad.Create("chat", "poll", pollId, RcField.PollQuestion, 1);

    /// <summary>
    /// Die AAD haengt an der STIMME, nicht an der Umfrage. Sonst liessen sich
    /// zwei Stimmen derselben Umfrage gegeneinander austauschen — und die
    /// Auszaehlung waere manipulierbar, ohne dass eine Unterschrift bricht.
    /// </summary>
    private static RcAad ChoiceAad(Guid voteId) =>
        RcAad.Create("chat", "poll_vote", voteId, RcField.PollChoice, 1);
}
