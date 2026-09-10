using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 9.8 und 9.9 — Reaktionen, Lesestand, Entwuerfe.
///
/// Die drei kleinen Dinge, die ein Chat braucht, damit er sich wie einer
/// anfuehlt. Sie stehen zusammen, weil sie dieselbe Eigenschaft teilen: sie
/// sagen etwas ueber MENSCHEN aus, nicht ueber Inhalte — und genau deshalb sind
/// sie heikler, als ihre Groesse vermuten laesst.
/// </summary>
public static class RcEngagement
{
    public static void MapRcEngagement(this IEndpointRouteBuilder app)
    {
        app.MapPost("/rc/messages/{id:guid}/reaction", ReactAsync).Produces<RcReactionResponse>();
        app.MapGet("/rc/areas/{id:guid}/read-state", ReadStateAsync).Produces<RcReadStateResponse>();
        app.MapPost("/rc/areas/{id:guid}/read-state", MarkReadAsync).Produces<RcReadMarkedResponse>();
        app.MapGet("/rc/areas/{id:guid}/draft", GetDraftAsync).Produces<RcDraftResponse>();
        app.MapPost("/rc/areas/{id:guid}/draft", SaveDraftAsync).Produces<RcDraftSavedResponse>();
    }

    // -- Reaktionen -----------------------------------------------------------

    /// <summary>
    /// 9.8 — <b>EINE Reaktion je Person und Beitrag.</b> Das erzwingt der
    /// Primaerschluessel, und es ist die eigentliche Entscheidung: dies ist kein
    /// Emoji-Regal, sondern eine Stellungnahme. Wer zwoelf Bildchen unter einen
    /// Beitrag haengen kann, sagt am Ende nichts; wer genau eine Haltung
    /// waehlen muss, sagt etwas.
    ///
    /// <b>Die drei Werte sind eine Entscheidung und gehoeren bestaetigt.</b> Das
    /// Schema laesst 1, 2, 3 zu und nennt sie nicht. Gewaehlt wurden
    /// Zustimmung, Kenntnisnahme und Widerspruch — die drei Dinge, die in einem
    /// Gremium wirklich vorkommen. Ein Daumen-hoch waere hier zu wenig: „ich
    /// habe es gelesen" und „ich stimme zu" sind nicht dasselbe, und in einer
    /// Sitzung ist der Unterschied der ganze Punkt.
    /// </summary>
    public const byte ReactionAgree = 1;
    public const byte ReactionNoted = 2;
    public const byte ReactionObject = 3;

    public sealed record ReactRequest(string RoleId, int? Kind);

    private static async Task ReactAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, ReactRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.RoleId, out var roleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der Rolle ist unlesbar.");
            return;
        }

        if (body.Kind is not null and not (ReactionAgree or ReactionNoted or ReactionObject))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Reaktion gibt es nicht.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var areaId = await AreaOfMessageAsync(connection, id, ctx.RequestAborted);
        if (areaId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId, RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        // Unter welchem Namen reagiert wird, muss dem Reagierenden gehoeren.
        // Sonst legte jemand eine fremde Zustimmung unter einen Beitrag.
        if (await RcRoleAccess.RoleKeyAsync(connection, session.AccountId, held.MasterKey, roleId, ctx.RequestAborted) is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Unter diesem Namen kannst du nicht reagieren.");
            return;
        }

        if (body.Kind is null)
        {
            await using var clear = new SqlCommand(
                "DELETE FROM dbo.rc_reaction WHERE message_id = @m AND role_id = @r;", connection);
            clear.Parameters.AddWithValue("@m", id);
            clear.Parameters.AddWithValue("@r", roleId);
            await clear.ExecuteNonQueryAsync(ctx.RequestAborted);
            await RcResults.WriteJsonAsync(ctx, new RcReactionResponse(RcId.ToText(id), null));
            return;
        }

        // Umentscheiden ueberschreibt, es haeuft nicht an — dieselbe Regel wie
        // im Gremium: man hebt die Hand oder man hebt sie nicht.
        await using var cmd = new SqlCommand("""
            MERGE dbo.rc_reaction AS target
            USING (SELECT @m AS message_id, @r AS role_id) AS source
              ON target.message_id = source.message_id AND target.role_id = source.role_id
            WHEN MATCHED THEN UPDATE SET kind = @kind, at = @now
            WHEN NOT MATCHED THEN INSERT (message_id, role_id, kind, at) VALUES (@m, @r, @kind, @now);
            """, connection);

        cmd.Parameters.AddWithValue("@m", id);
        cmd.Parameters.AddWithValue("@r", roleId);
        cmd.Parameters.AddWithValue("@kind", (byte)body.Kind.Value);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcReactionResponse(RcId.ToText(id), body.Kind));
    }

    // -- Lesestand ------------------------------------------------------------

    public sealed record MarkReadRequest(string RoleId, long? LastReadSeq, bool? ReceiptsEnabled);

    /// <summary>
    /// 9.9.1 — Lesebestaetigungen mit <b>Symmetrie</b>: wer verbirgt, sieht auch
    /// nicht. Ohne diese Kopplung waere die Abschaltung ein einseitiger Vorteil,
    /// und der erste, der ihn bemerkt, nimmt ihn — danach schaltet jeder ab und
    /// die Funktion ist tot.
    ///
    /// <b>Eine Ausnahme, und die steht in der Datenbank</b> (4.5): eine
    /// Aufsichtsrolle darf NICHT verbergen. Sonst schaltete der
    /// Aufsichtsfuehrende die Sichtbarkeit ab, laese weiter mit und hebelte
    /// genau das aus, was die Aufsicht zusagt. Die Bedingung
    /// <c>ck_rc_read_state_sup</c> laesst das gar nicht erst zu.
    ///
    /// <b>Die Leitung kann abschalten, aber nie erzwingen</b> (E-278). Steht der
    /// Bereichsschalter auf aus, gibt es keine Bestaetigungen — steht er auf an,
    /// entscheidet immer noch jeder fuer sich.
    /// </summary>
    private static async Task MarkReadAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, MarkReadRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.RoleId, out var roleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der Rolle ist unlesbar.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id, RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        if (await RcRoleAccess.RoleKeyAsync(connection, session.AccountId, held.MasterKey, roleId, ctx.RequestAborted) is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Diese Rolle steht dir nicht zur Verfuegung.");
            return;
        }

        var seq = body.LastReadSeq ?? await LatestSeqAsync(connection, id, ctx.RequestAborted);

        try
        {
            await using var cmd = new SqlCommand("""
                MERGE dbo.rc_read_state AS target
                USING (SELECT @area AS area_id, @role AS role_id) AS source
                  ON target.area_id = source.area_id AND target.role_id = source.role_id
                WHEN MATCHED THEN UPDATE SET
                    last_read_seq = CASE WHEN @seq > target.last_read_seq THEN @seq ELSE target.last_read_seq END,
                    last_read_at = @now,
                    receipts_enabled = COALESCE(@receipts, target.receipts_enabled)
                WHEN NOT MATCHED THEN
                    INSERT (area_id, role_id, last_read_seq, last_read_at, receipts_enabled)
                    VALUES (@area, @role, @seq, @now, COALESCE(@receipts, 1));
                """, connection);

            cmd.Parameters.AddWithValue("@area", id);
            cmd.Parameters.AddWithValue("@role", roleId);

            // Der Lesestand geht nur vorwaerts. Sonst koennte ein alter Tab, der
            // spaeter aufwacht, den Stand zurueckdrehen und alles wieder als
            // ungelesen zeigen.
            cmd.Parameters.AddWithValue("@seq", seq);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.Add("@receipts", System.Data.SqlDbType.Bit).Value =
                (object?)body.ReceiptsEnabled ?? DBNull.Value;

            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number == 547)
        {
            // ck_rc_read_state_sup: eine Aufsichtsrolle darf nicht verbergen.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied,
                "Eine Aufsichtsrolle kann ihre Lesebestaetigungen nicht abschalten.");
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcReadMarkedResponse(RcId.ToText(id), seq));
    }

    public sealed record ReadStateView(string RoleId, long LastReadSeq, DateTimeOffset LastReadAt);

    /// <summary>
    /// Wer wie weit gelesen hat. Zeigt NUR etwas, wenn der Fragende seine
    /// eigenen Bestaetigungen anhat — das ist die Symmetrie, und sie wird hier
    /// durchgesetzt, nicht im Klienten.
    /// </summary>
    private static async Task ReadStateAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id, RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        // E-278 — Der Bereichsschalter kann abschalten, aber nichts erzwingen.
        await using (var areaSwitch = new SqlCommand(
            "SELECT receipts_enabled FROM dbo.rc_area WHERE id = @id;", connection))
        {
            areaSwitch.Parameters.AddWithValue("@id", id);
            if (await areaSwitch.ExecuteScalarAsync(ctx.RequestAborted) is not true)
            {
                await RcResults.WriteJsonAsync(ctx, new RcReadStateResponse(false, false, []));
                return;
            }
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var mine = await RcRoleAccess.AllRoleKeysAsync(connection, session.AccountId, held.MasterKey, ctx.RequestAborted);

        var iShow = await ShowsReceiptsAsync(connection, id, mine.Keys.ToList(), ctx.RequestAborted);
        if (!iShow)
        {
            await RcResults.WriteJsonAsync(ctx, new RcReadStateResponse(true, true, []));
            return;
        }

        await using var cmd = new SqlCommand("""
            SELECT role_id, last_read_seq, last_read_at
            FROM dbo.rc_read_state
            WHERE area_id = @area AND receipts_enabled = 1
            ORDER BY last_read_seq DESC;
            """, connection);
        cmd.Parameters.AddWithValue("@area", id);

        var readers = new List<ReadStateView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
            readers.Add(new ReadStateView(RcId.ToText(reader.GetGuid(0)), reader.GetInt64(1), reader.GetDateTimeOffset(2)));

        await RcResults.WriteJsonAsync(ctx, new RcReadStateResponse(true, false, readers));
    }

    // -- Entwuerfe ------------------------------------------------------------

    public sealed record DraftRequest(string RoleId, string Body);

    /// <summary>
    /// Ein angefangener Text, der das Schliessen des Tabs ueberlebt.
    ///
    /// Er liegt VERSCHLUESSELT, unter demselben Epochenschluessel wie die
    /// Beitraege. Das ist keine Uebertreibung: ein Entwurf enthaelt oft mehr als
    /// das, was am Ende abgeschickt wird — die erste, unvorsichtige Fassung.
    /// Ihn im Klartext zu speichern hiesse, ausgerechnet den ungeschuetztesten
    /// Satz ungeschuetzt abzulegen.
    /// </summary>
    private static async Task SaveDraftAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, DraftRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.RoleId, out var roleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der Rolle ist unlesbar.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id, RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        if (await RcRoleAccess.RoleKeyAsync(connection, session.AccountId, held.MasterKey, roleId, ctx.RequestAborted) is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Diese Rolle steht dir nicht zur Verfuegung.");
            return;
        }

        var text = body.Body ?? "";
        if (text.Length == 0)
        {
            await using var clear = new SqlCommand(
                "DELETE FROM dbo.rc_draft WHERE area_id = @area AND role_id = @role;", connection);
            clear.Parameters.AddWithValue("@area", id);
            clear.Parameters.AddWithValue("@role", roleId);
            await clear.ExecuteNonQueryAsync(ctx.RequestAborted);
            await RcResults.WriteJsonAsync(ctx, new RcDraftSavedResponse(RcId.ToText(id), false));
            return;
        }

        var epoch = await RcTopics.CurrentEpochAsync(connection, id, ctx.RequestAborted);
        var epochKey = await RcAreaKeys.EpochKeyAsync(
            connection, session.AccountId, held.MasterKey, id, epoch, ctx.RequestAborted);

        if (epochKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.CryptoMissingKey, "Fuer die laufende Epoche fehlt dir der Schluessel.");
            return;
        }

        var sealedBody = RcCrypto.Seal(epochKey, DraftAad(id, roleId), Encoding.UTF8.GetBytes(text));

        await using var cmd = new SqlCommand("""
            MERGE dbo.rc_draft AS target
            USING (SELECT @area AS area_id, @role AS role_id) AS source
              ON target.area_id = source.area_id AND target.role_id = source.role_id
            WHEN MATCHED THEN UPDATE SET body_sealed = @body, updated_at = @now
            WHEN NOT MATCHED THEN INSERT (area_id, role_id, body_sealed, updated_at)
                                 VALUES (@area, @role, @body, @now);
            """, connection);

        cmd.Parameters.AddWithValue("@area", id);
        cmd.Parameters.AddWithValue("@role", roleId);
        cmd.Parameters.AddWithValue("@body", sealedBody);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcDraftSavedResponse(RcId.ToText(id), true));
    }

    private static async Task GetDraftAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, Guid roleId)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id, RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        if (await RcRoleAccess.RoleKeyAsync(connection, session.AccountId, held.MasterKey, roleId, ctx.RequestAborted) is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Diese Rolle steht dir nicht zur Verfuegung.");
            return;
        }

        await using var cmd = new SqlCommand(
            "SELECT body_sealed, updated_at FROM dbo.rc_draft WHERE area_id = @area AND role_id = @role;", connection);
        cmd.Parameters.AddWithValue("@area", id);
        cmd.Parameters.AddWithValue("@role", roleId);

        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        if (!await reader.ReadAsync(ctx.RequestAborted))
        {
            await RcResults.WriteJsonAsync(ctx, new RcDraftResponse(RcId.ToText(id), null));
            return;
        }

        var sealedBody = (byte[])reader[0];
        var updatedAt = reader.GetDateTimeOffset(1);
        await reader.CloseAsync();

        var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey, id, ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcDraftResponse(
            RcId.ToText(id), RcAreaKeys.TryOpenText(keys, DraftAad(id, roleId), sealedBody), updatedAt));
    }

    // -- Gemeinsames ----------------------------------------------------------

    internal static async Task<Guid> AreaOfMessageAsync(SqlConnection connection, Guid messageId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT area_id FROM dbo.rc_message WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", messageId);
        return await cmd.ExecuteScalarAsync(ct) is Guid areaId ? areaId : Guid.Empty;
    }

    private static async Task<long> LatestSeqAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT ISNULL(MAX(seq), 0) FROM dbo.rc_message WHERE area_id = @area;", connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        return Convert.ToInt64(await cmd.ExecuteScalarAsync(ct), System.Globalization.CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Ob eine der Rollen dieses Kontos hier sichtbar liest. Ohne Zeile gilt die
    /// Vorgabe: sichtbar. Wer nie etwas eingestellt hat, verbirgt sich nicht.
    /// </summary>
    private static async Task<bool> ShowsReceiptsAsync(
        SqlConnection connection, Guid areaId, IReadOnlyList<Guid> roleIds, CancellationToken ct)
    {
        if (roleIds.Count == 0) return true;

        var names = string.Join(", ", roleIds.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand(
            $"SELECT COUNT(*) FROM dbo.rc_read_state " +
            $"WHERE area_id = @area AND receipts_enabled = 0 AND role_id IN ({names});", connection);

        cmd.Parameters.AddWithValue("@area", areaId);
        for (var i = 0; i < roleIds.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", roleIds[i]);

        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct), System.Globalization.CultureInfo.InvariantCulture) == 0;
    }

    /// <summary>
    /// Ein Entwurf gehoert einem PAAR aus Bereich und Rolle — das ist auch sein
    /// Primaerschluessel. Beide muessen deshalb in die AAD: stuende nur der
    /// Bereich darin, liesse sich der Entwurf eines Menschen an die Stelle des
    /// Entwurfs eines anderen schieben, und er faende beim naechsten Oeffnen
    /// fremde Saetze in seinem Eingabefeld (3.13).
    /// </summary>
    private static RcAad DraftAad(Guid areaId, Guid roleId) =>
        RcAad.Create("chat", $"draft_{RcId.ToText(roleId)}", areaId, RcField.DraftBody, 1);
}
