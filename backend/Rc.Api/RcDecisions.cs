using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 9.4 — Entscheidungen. <b>Immer kettenpflichtig</b> (7.8).
///
/// Bei Nachrichten ist <c>ledger_entry_id</c> nullbar: ob ein Beitrag in die
/// Kette gehoert, wird je Beitrag entschieden. Bei Entscheidungen und ihren
/// Uebergaengen ist die Spalte <c>NOT NULL</c> — das Schema laesst eine
/// Entscheidung ohne Ketteneintrag gar nicht erst zu.
///
/// Das ist keine Strenge um ihrer selbst willen. Eine Entscheidung, deren
/// Reihenfolge sich nicht beweisen laesst, ist keine Entscheidung, sondern eine
/// Behauptung darueber, was beschlossen wurde. Der Unterschied faellt erst auf,
/// wenn jemand ihn bestreitet — und dann ist es zu spaet, ihn nachzutragen.
///
/// <b>Was in der Kette steht.</b> Nicht der Text. Der Eintrag nennt die
/// Entscheidung, ihren Zustand und den HASH des versiegelten Textes. Damit
/// laesst sich beweisen, dass genau dieser Text an genau dieser Stelle stand —
/// ohne dass ein Pruefer ihn lesen koennen muss. Genau das ist die Bedingung
/// dafuer, dass ein Betreiber, der nicht mitlesen darf, die Kette trotzdem
/// vorlegen kann.
///
/// <code>
///   proposed ──► open ──┬──► accepted ──┐
///                       └──► rejected ──┴──► reopened ──► open ──► …
/// </code>
///
/// Jeder Uebergang ist ein eigener Eintrag mit eigener Begruendung. Das
/// Wiederaufgreifen loescht nichts: die alte Entscheidung bleibt stehen, und
/// daneben steht, dass sie wieder aufgemacht wurde.
/// </summary>
public static class RcDecisions
{
    public const string StateProposed = "proposed";
    public const string StateOpen = "open";
    public const string StateAccepted = "accepted";
    public const string StateRejected = "rejected";
    public const string StateReopened = "reopened";

    /// <summary>
    /// Welcher Zustand auf welchen folgen darf. Ein Uebergang, der hier fehlt,
    /// wird abgewiesen — sonst stuende irgendwann „angenommen" direkt nach
    /// „vorgeschlagen", ohne dass je jemand darueber gesprochen haette.
    /// </summary>
    private static readonly Dictionary<string, string[]> Allowed = new()
    {
        [StateProposed] = [StateOpen, StateRejected],
        [StateOpen] = [StateAccepted, StateRejected],
        [StateAccepted] = [StateReopened],
        [StateRejected] = [StateReopened],
        [StateReopened] = [StateOpen, StateRejected]
    };

    public static void MapRcDecisions(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/areas/{id:guid}/decisions", ListAsync);
        app.MapPost("/rc/areas/{id:guid}/decisions", CreateAsync);
        app.MapPost("/rc/decisions/{id:guid}/transition", TransitionAsync);
    }

    // -- Anlegen --------------------------------------------------------------

    public sealed record CreateDecisionRequest(string RoleId, string Body, string? TopicId);

    private static async Task CreateAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, RcLedger ledger,
        Guid id, CreateDecisionRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.RoleId, out var roleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der Rolle ist unlesbar.");
            return;
        }

        // 9.4.4 — bis 20.000 Zeichen. Eine Entscheidung ist kein Zuruf.
        var text = body.Body?.Trim() ?? "";
        if (text.Length is 0 or > 20_000)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Text ist leer oder laenger als 20.000 Zeichen.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id, RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var context = await PrepareAsync(connection, session, held.MasterKey, id, roleId, ctx.RequestAborted);
        if (context.Error is not null) { await context.Error(ctx); return; }

        using var signKey = context.SignKey!;
        var decisionId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;
        var sealedBody = RcCrypto.Seal(context.EpochKey!, BodyAad(decisionId), Encoding.UTF8.GetBytes(text));

        Guid? topicId = Guid.TryParse(body.TopicId, out var parsedTopic) ? parsedTopic : null;
        var transactionId = RcId.NewId();

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
        try
        {
            // Kette ZUERST: ihre Kennung ist eine Pflichtspalte der Entscheidung.
            // Die Reihenfolge ist nicht Geschmack, sie ist erzwungen.
            var entry = await ledger.AppendAsync(connection, tx, context.LedgerId,
                RcJson.O(
                    ("bodyHash", RcJson.Hex(SHA256.HashData(sealedBody))),
                    ("decisionId", RcJson.G(decisionId)),
                    ("kind", RcJson.S("decision.created")),
                    ("state", RcJson.S(StateProposed))),
                decisionId, context.TenantId, "chat",
                context.Signer!, signKey, session.AccountId, transactionId, ctx.RequestAborted);

            await using (var insert = new SqlCommand("""
                INSERT INTO dbo.rc_decision (id, area_id, topic_id, state, body_sealed, ledger_entry_id, created_at)
                VALUES (@id, @area, @topic, @state, @body, @entry, @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", decisionId);
                insert.Parameters.AddWithValue("@area", id);
                insert.Parameters.Add("@topic", System.Data.SqlDbType.UniqueIdentifier).Value =
                    (object?)topicId ?? DBNull.Value;
                insert.Parameters.AddWithValue("@state", StateProposed);
                insert.Parameters.AddWithValue("@body", sealedBody);
                insert.Parameters.AddWithValue("@entry", entry.EntryId);
                insert.Parameters.AddWithValue("@now", now);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new
        {
            decisionId = RcId.ToText(decisionId),
            state = StateProposed
        }, StatusCodes.Status201Created);
    }

    // -- Uebergaenge ----------------------------------------------------------

    public sealed record TransitionRequest(string RoleId, string ToState, string Reason);

    /// <summary>
    /// Ein Zustandswechsel mit Begruendung — beides in einem Ketteneintrag.
    ///
    /// Die Begruendung ist PFLICHT (<c>reason_sealed NOT NULL</c>). Eine
    /// Ablehnung ohne Grund ist der Anfang jedes Streits darueber, was eigentlich
    /// entschieden wurde; ein leeres Feld waere die bequemste Stelle, an der
    /// genau das entsteht.
    /// </summary>
    private static async Task TransitionAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, RcLedger ledger,
        Guid id, TransitionRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.RoleId, out var roleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der Rolle ist unlesbar.");
            return;
        }

        var reason = body.Reason?.Trim() ?? "";
        if (reason.Length is 0 or > 4000)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Ein Zustandswechsel braucht eine Begruendung.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid areaId;
        string fromState;
        await using (var read = new SqlCommand(
            "SELECT area_id, state FROM dbo.rc_decision WHERE id = @id;", connection))
        {
            read.Parameters.AddWithValue("@id", id);
            await using var reader = await read.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted)) { await RcAreas.NotForYou(ctx); return; }
            areaId = reader.GetGuid(0);
            fromState = reader.GetString(1);
        }

        // Annehmen und Ablehnen sind Verwaltungsakte, kein Mitreden.
        var needed = body.ToState is StateAccepted or StateRejected ? RcCapability.Admin : RcCapability.Write;
        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId, needed, ctx.RequestAborted);
        if (!may.Allowed)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Diesen Schritt darfst du hier nicht gehen.");
            return;
        }

        if (!Allowed.TryGetValue(fromState, out var next) || !next.Contains(body.ToState))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied,
                $"Von '{fromState}' fuehrt kein Weg direkt nach '{body.ToState}'.");
            return;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var context = await PrepareAsync(connection, session, held.MasterKey, areaId, roleId, ctx.RequestAborted);
        if (context.Error is not null) { await context.Error(ctx); return; }

        using var signKey = context.SignKey!;
        var transitionId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;
        var sealedReason = RcCrypto.Seal(context.EpochKey!, ReasonAad(transitionId), Encoding.UTF8.GetBytes(reason));
        var transactionId = RcId.NewId();

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
        try
        {
            var entry = await ledger.AppendAsync(connection, tx, context.LedgerId,
                RcJson.O(
                    ("decisionId", RcJson.G(id)),
                    ("fromState", RcJson.S(fromState)),
                    ("kind", RcJson.S("decision.transition")),
                    ("reasonHash", RcJson.Hex(SHA256.HashData(sealedReason))),
                    ("toState", RcJson.S(body.ToState))),
                id, context.TenantId, "chat",
                context.Signer!, signKey, session.AccountId, transactionId, ctx.RequestAborted);

            await using (var insert = new SqlCommand("""
                INSERT INTO dbo.rc_decision_transition
                    (id, decision_id, from_state, to_state, reason_sealed, by_role_id, at, ledger_entry_id)
                VALUES (@id, @decision, @from, @to, @reason, @by, @now, @entry);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", transitionId);
                insert.Parameters.AddWithValue("@decision", id);
                insert.Parameters.AddWithValue("@from", fromState);
                insert.Parameters.AddWithValue("@to", body.ToState);
                insert.Parameters.AddWithValue("@reason", sealedReason);
                insert.Parameters.AddWithValue("@by", roleId);
                insert.Parameters.AddWithValue("@now", now);
                insert.Parameters.AddWithValue("@entry", entry.EntryId);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            // Der Zustand an der Entscheidung ist eine Abkuerzung fuer „der
            // letzte Uebergang". Die Uebergangsliste ist die Wahrheit; diese
            // Spalte erspart nur, sie bei jeder Anzeige zu lesen.
            await using (var update = new SqlCommand(
                "UPDATE dbo.rc_decision SET state = @to WHERE id = @id AND state = @from;", connection, tx))
            {
                update.Parameters.AddWithValue("@to", body.ToState);
                update.Parameters.AddWithValue("@id", id);
                update.Parameters.AddWithValue("@from", fromState);

                if (await update.ExecuteNonQueryAsync(ctx.RequestAborted) != 1)
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                        RcErrorCodes.ChainSequenceConflict, "Diese Entscheidung hat sich inzwischen geaendert.");
                    return;
                }
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new
        {
            decisionId = RcId.ToText(id),
            fromState,
            toState = body.ToState
        }, StatusCodes.Status201Created);
    }

    // -- Anzeigen -------------------------------------------------------------

    public sealed record TransitionView(string FromState, string ToState, string? Reason, DateTimeOffset At);

    public sealed record DecisionView(
        string DecisionId, string State, string? Body, string? TopicId,
        DateTimeOffset CreatedAt, IReadOnlyList<TransitionView> History);

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

        var rows = new List<(Guid Id, string State, byte[] Body, Guid? TopicId, DateTimeOffset CreatedAt)>();
        await using (var cmd = new SqlCommand(
            "SELECT id, state, body_sealed, topic_id, created_at FROM dbo.rc_decision WHERE area_id = @area ORDER BY seq DESC;",
            connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((reader.GetGuid(0), reader.GetString(1), (byte[])reader[2],
                    reader.IsDBNull(3) ? null : reader.GetGuid(3), reader.GetDateTimeOffset(4)));
            }
        }

        var views = new List<DecisionView>();
        foreach (var row in rows)
        {
            var history = new List<TransitionView>();
            await using (var cmd = new SqlCommand(
                "SELECT id, from_state, to_state, reason_sealed, at FROM dbo.rc_decision_transition " +
                "WHERE decision_id = @id ORDER BY seq;", connection))
            {
                cmd.Parameters.AddWithValue("@id", row.Id);
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted))
                {
                    history.Add(new TransitionView(
                        reader.IsDBNull(1) ? "" : reader.GetString(1),
                        reader.GetString(2),
                        RcAreaKeys.TryOpenText(keys, ReasonAad(reader.GetGuid(0)), (byte[])reader[3]),
                        reader.GetDateTimeOffset(4)));
                }
            }

            views.Add(new DecisionView(
                RcId.ToText(row.Id), row.State,
                RcAreaKeys.TryOpenText(keys, BodyAad(row.Id), row.Body),
                row.TopicId is null ? null : RcId.ToText(row.TopicId.Value),
                row.CreatedAt, history));
        }

        await RcResults.WriteJsonAsync(ctx, new { decisions = views });
    }

    // -- Gemeinsames ----------------------------------------------------------

    private sealed record Prepared(
        Guid LedgerId, Guid TenantId, byte[]? EpochKey, RcRoleIdentity? Signer, RSA? SignKey,
        Func<HttpContext, Task>? Error);

    /// <summary>
    /// Alles, was ein kettenpflichtiger Schreibvorgang braucht: die Kennung der
    /// Kette, die Traegerschaft, den Epochenschluessel und den Signierschluessel
    /// der handelnden Rolle. Fehlt eines davon, entsteht gar nichts.
    /// </summary>
    private static async Task<Prepared> PrepareAsync(
        SqlConnection connection, RcRequestSession session, byte[] masterKey,
        Guid areaId, Guid roleId, CancellationToken ct)
    {
        Guid ledgerId = Guid.Empty, tenantId = Guid.Empty;
        var epoch = 0;

        await using (var cmd = new SqlCommand(
            "SELECT ledger_id, tenant_id, current_epoch FROM dbo.rc_area WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", areaId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                ledgerId = reader.GetGuid(0);
                tenantId = reader.GetGuid(1);
                epoch = reader.GetInt32(2);
            }
        }

        if (ledgerId == Guid.Empty)
            return new Prepared(default, default, null, null, null, RcAreas.NotForYou);

        var roleKey = await RcRoleAccess.RoleKeyAsync(connection, session.AccountId, masterKey, roleId, ct);
        if (roleKey is null)
        {
            return new Prepared(default, default, null, null, null, c => RcResults.WriteErrorAsync(
                c, StatusCodes.Status403Forbidden, RcErrorCodes.RoleUnreachable,
                "Unter diesem Namen kannst du hier nicht handeln."));
        }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [roleId], ct);
        if (!identities.TryGetValue(roleId, out var signer))
        {
            return new Prepared(default, default, null, null, null, c => RcResults.WriteErrorAsync(
                c, StatusCodes.Status404NotFound, RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht."));
        }

        var epochKey = await RcAreaKeys.EpochKeyAsync(connection, session.AccountId, masterKey, areaId, epoch, ct);
        if (epochKey is null)
        {
            return new Prepared(default, default, null, null, null, c => RcResults.WriteErrorAsync(
                c, StatusCodes.Status409Conflict, RcErrorCodes.CryptoMissingKey,
                "Fuer die laufende Epoche fehlt dir der Schluessel."));
        }

        return new Prepared(ledgerId, tenantId, epochKey, signer, RcRoleKeys.OpenSignKey(signer, roleKey), null);
    }

    private static RcAad BodyAad(Guid decisionId) =>
        RcAad.Create("chat", "decision", decisionId, RcField.DecisionBody, 1);

    /// <summary>
    /// Die Begruendung haengt am UEBERGANG, nicht an der Entscheidung. Sonst
    /// liessen sich zwei Begruendungen derselben Entscheidung vertauschen — und
    /// eine Ablehnung traege ploetzlich den Grund einer Annahme.
    /// </summary>
    private static RcAad ReasonAad(Guid transitionId) =>
        RcAad.Create("chat", "decision_transition", transitionId, RcField.DecisionBody, 1);
}
