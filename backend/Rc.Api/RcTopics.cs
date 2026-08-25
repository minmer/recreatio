using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 9.3 — Themen: Ordnung, die NACHTRAEGLICH entsteht.
///
/// <b>Der Unterschied zu einem Kanal.</b> Ein Kanal verlangt die Entscheidung
/// vorher: wohin gehoert das, was ich gleich schreibe? Wer das nicht weiss —
/// und meistens weiss man es nicht —, schreibt es irgendwohin, und die Ordnung
/// ist von Anfang an falsch. Ein Thema wird gebildet, wenn sich zeigt, dass
/// eines da ist: man sammelt ein, was ohnehin schon gesagt wurde.
///
/// Deshalb ist die Zuordnung eine eigene Tabelle und keine Spalte an der
/// Nachricht. Eine Nachricht kann zu mehreren Themen gehoeren, und sie muss zu
/// keinem gehoeren.
///
/// <b>Zwei Zustaende, mehr nicht (9.3.2).</b> Offen oder geschlossen. Jeder
/// weitere Zustand erzeugt Diskussionen darueber, was er bedeutet, und niemand
/// pflegt ihn. Alle Nuancen laufen ueber Etiketten.
/// </summary>
public static class RcTopics
{
    public static void MapRcTopics(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/areas/{id:guid}/topics", ListAsync).Produces<RcTopicsResponse>();
        app.MapPost("/rc/areas/{id:guid}/topics", CreateAsync).Produces<RcTopicCreatedResponse>();
        app.MapPost("/rc/topics/{id:guid}/messages", AssignAsync).Produces<RcTopicAssignedResponse>();
        app.MapPost("/rc/topics/{id:guid}/close", CloseAsync).Produces<RcTopicClosedResponse>();
        app.MapPost("/rc/topics/{id:guid}/labels", LabelAsync).Produces<RcTopicLabelsResponse>();
    }

    // -- Anlegen --------------------------------------------------------------

    public sealed record CreateTopicRequest(string Title, string? ParentTopicId, string[]? MessageIds);

    private static async Task CreateAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, CreateTopicRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var title = body.Title?.Trim() ?? "";
        if (title.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Ein Thema braucht einen Namen.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id, RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var epoch = await CurrentEpochAsync(connection, id, ctx.RequestAborted);
        var epochKey = await RcAreaKeys.EpochKeyAsync(
            connection, session.AccountId, held.MasterKey, id, epoch, ctx.RequestAborted);

        if (epochKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.CryptoMissingKey, "Fuer die laufende Epoche fehlt dir der Schluessel.");
            return;
        }

        var topicId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;

        // 9.3.9 — Der Titel wird GETIPPT, nie abgeleitet. Ein aus den ersten
        // Woertern der ersten Nachricht erzeugter Titel ist fast immer falsch
        // und wird nie korrigiert, weil niemand ihn als seinen ansieht.
        var titleSealed = RcCrypto.Seal(epochKey, TitleAad(topicId), Encoding.UTF8.GetBytes(title));

        Guid? parentId = Guid.TryParse(body.ParentTopicId, out var parsed) ? parsed : null;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.ReadCommitted, ctx.RequestAborted);
        try
        {
            await using (var insert = new SqlCommand("""
                INSERT INTO dbo.rc_topic (id, area_id, title_sealed, parent_topic_id, created_at)
                VALUES (@id, @area, @title, @parent, @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", topicId);
                insert.Parameters.AddWithValue("@area", id);
                insert.Parameters.AddWithValue("@title", titleSealed);
                insert.Parameters.Add("@parent", System.Data.SqlDbType.UniqueIdentifier).Value =
                    (object?)parentId ?? DBNull.Value;
                insert.Parameters.AddWithValue("@now", now);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            // Ein Thema entsteht meist AUS Nachrichten — deshalb lassen sie sich
            // gleich mitgeben, statt in einem zweiten Aufruf.
            foreach (var messageId in ParseIds(body.MessageIds))
                await AssignOneAsync(connection, tx, messageId, topicId, id, may.Via!.Value, ctx.RequestAborted);

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new RcTopicCreatedResponse(
            RcId.ToText(topicId), title, ParseIds(body.MessageIds).Count), StatusCodes.Status201Created);
    }

    // -- Anzeigen -------------------------------------------------------------

    public sealed record TopicView(
        string TopicId, string? Title, string? ParentTopicId, bool Closed,
        int MessageCount, IReadOnlyList<int> Labels);

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

        await using var cmd = new SqlCommand("""
            SELECT t.id, t.title_sealed, t.parent_topic_id, t.closed_at,
                   (SELECT COUNT(*) FROM dbo.rc_message_topic mt WHERE mt.topic_id = t.id),
                   (SELECT STRING_AGG(CAST(l.label_id AS nvarchar(8)), ',')
                    FROM dbo.rc_topic_label l WHERE l.topic_id = t.id)
            FROM dbo.rc_topic t
            WHERE t.area_id = @area
            ORDER BY t.closed_at, t.seq DESC;
            """, connection);
        cmd.Parameters.AddWithValue("@area", id);

        var views = new List<TopicView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            var topicId = reader.GetGuid(0);
            var labels = reader.IsDBNull(5)
                ? []
                : reader.GetString(5).Split(',').Select(int.Parse).ToList();

            views.Add(new TopicView(
                RcId.ToText(topicId),
                RcAreaKeys.TryOpenText(keys, TitleAad(topicId), (byte[])reader[1]),
                reader.IsDBNull(2) ? null : RcId.ToText(reader.GetGuid(2)),
                !reader.IsDBNull(3),
                reader.GetInt32(4),
                labels));
        }

        await RcResults.WriteJsonAsync(ctx, new RcTopicsResponse(views));
    }

    // -- Zuordnen -------------------------------------------------------------

    public sealed record AssignRequest(string[] MessageIds);

    /// <summary>
    /// Nachrichten einem Thema zuordnen — auch nachtraeglich, auch mehrfach.
    /// Die Zuordnung ist keine Eigenschaft der Nachricht, sondern eine
    /// Beziehung; deshalb steht sie in einer eigenen Tabelle und nicht in einer
    /// Spalte.
    /// </summary>
    private static async Task AssignAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, AssignRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await AreaOfTopicAsync(connection, id, ctx.RequestAborted);
        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId, RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var assigned = 0;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.ReadCommitted, ctx.RequestAborted);
        try
        {
            foreach (var messageId in ParseIds(body.MessageIds))
                assigned += await AssignOneAsync(connection, tx, messageId, id, areaId, may.Via!.Value, ctx.RequestAborted);

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new RcTopicAssignedResponse(RcId.ToText(id), assigned));
    }

    /// <summary>
    /// Gibt 1 zurueck, wenn zugeordnet wurde, und 0, wenn die Zuordnung schon
    /// bestand oder die Nachricht nicht in diesen Bereich gehoert.
    ///
    /// Die Bereichspruefung ist nicht Formsache: ohne sie liesse sich eine
    /// Nachricht aus einem fremden Bereich in ein eigenes Thema haengen und
    /// waere dann ueber dieses Thema sichtbar.
    /// </summary>
    private static async Task<int> AssignOneAsync(
        SqlConnection connection, SqlTransaction tx, Guid messageId, Guid topicId, Guid areaId,
        Guid byRoleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO dbo.rc_message_topic (message_id, topic_id, assigned_at, assigned_by_role_id)
            SELECT @message, @topic, @now, @by
            WHERE EXISTS (SELECT 1 FROM dbo.rc_message m WHERE m.id = @message AND m.area_id = @area)
              AND NOT EXISTS (SELECT 1 FROM dbo.rc_message_topic x
                              WHERE x.message_id = @message AND x.topic_id = @topic);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@message", messageId);
        cmd.Parameters.AddWithValue("@topic", topicId);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@by", byRoleId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        return await cmd.ExecuteNonQueryAsync(ct);
    }

    // -- Schliessen und Etiketten ---------------------------------------------

    public sealed record CloseRequest(bool? Reopen, string? DuplicateOfId);

    private static async Task CloseAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, CloseRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await AreaOfTopicAsync(connection, id, ctx.RequestAborted);
        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId, RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var reopen = body.Reopen == true;

        // 9.3.7 — Ein Duplikat ist ein beidseitiger ZEIGER, kein Verschmelzen.
        // Verschmelzen ginge auch gar nicht: die Nachrichten koennen in
        // verschiedenen Bereichen liegen, mit verschiedenen Schluesseln.
        Guid? duplicateOf = Guid.TryParse(body.DuplicateOfId, out var parsed) ? parsed : null;

        await using var cmd = new SqlCommand("""
            UPDATE dbo.rc_topic
            SET closed_at = @closedAt, closed_by_role_id = @by,
                duplicate_of_id = COALESCE(@duplicate, duplicate_of_id)
            WHERE id = @id;
            """, connection);

        cmd.Parameters.Add("@closedAt", System.Data.SqlDbType.DateTimeOffset).Value =
            reopen ? DBNull.Value : DateTimeOffset.UtcNow;
        cmd.Parameters.Add("@by", System.Data.SqlDbType.UniqueIdentifier).Value =
            reopen ? DBNull.Value : may.Via!.Value;
        cmd.Parameters.Add("@duplicate", System.Data.SqlDbType.UniqueIdentifier).Value =
            (object?)duplicateOf ?? DBNull.Value;
        cmd.Parameters.AddWithValue("@id", id);

        var rows = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await RcResults.WriteJsonAsync(ctx, new RcTopicClosedResponse(RcId.ToText(id), !reopen && rows == 1));
    }

    public sealed record LabelRequest(int[] Labels);

    /// <summary>
    /// 9.3.2 — Hier laufen alle Nuancen zusammen, die NICHT zu einem Zustand
    /// werden durften. Etiketten sind Zahlen, keine Texte: sie werden im
    /// Klienten uebersetzt, damit dieselbe Sache in drei Sprachen dieselbe Sache
    /// bleibt und nicht dreimal getippt wird.
    /// </summary>
    private static async Task LabelAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, LabelRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await AreaOfTopicAsync(connection, id, ctx.RequestAborted);
        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId, RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var labels = (body.Labels ?? []).Where(l => l is > 0 and < short.MaxValue).Distinct().ToList();

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.ReadCommitted, ctx.RequestAborted);
        try
        {
            await using (var clear = new SqlCommand("DELETE FROM dbo.rc_topic_label WHERE topic_id = @id;", connection, tx))
            {
                clear.Parameters.AddWithValue("@id", id);
                await clear.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var label in labels)
            {
                await using var insert = new SqlCommand(
                    "INSERT INTO dbo.rc_topic_label (topic_id, label_id) VALUES (@id, @label);", connection, tx);
                insert.Parameters.AddWithValue("@id", id);
                insert.Parameters.AddWithValue("@label", (short)label);
                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new RcTopicLabelsResponse(RcId.ToText(id), labels));
    }

    // -- Gemeinsames ----------------------------------------------------------

    private static List<Guid> ParseIds(string[]? ids) =>
        (ids ?? []).Select(s => Guid.TryParse(s, out var g) ? g : Guid.Empty)
                   .Where(g => g != Guid.Empty).Distinct().ToList();

    internal static async Task<Guid> AreaOfTopicAsync(SqlConnection connection, Guid topicId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT area_id FROM dbo.rc_topic WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", topicId);
        return await cmd.ExecuteScalarAsync(ct) is Guid areaId ? areaId : Guid.Empty;
    }

    internal static async Task<int> CurrentEpochAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT current_epoch FROM dbo.rc_area WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", areaId);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct) ?? 0, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static RcAad TitleAad(Guid topicId) =>
        RcAad.Create("chat", "topic", topicId, RcField.TopicTitle, 1);
}
