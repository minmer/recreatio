using System.Security.Cryptography;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 3.12 und 10.3 — Einladungen in nicht oeffentliche Teile.
///
/// <b>Was eine Einladung NICHT ist.</b> Sie ist kein Anmeldeweg. Anmelden kann
/// sich jeder, ohne Link und ohne Einladung. Ein Zugangslink fuehrt in einen
/// Teil der Plattform, der nicht oeffentlich ist, und wird mit einem
/// BESTEHENDEN Konto verbunden.
///
/// <code>
///   Einladender                          Eingeladene
///   -----------                          -----------
///   hat certify im Bereich
///     │
///     │ erzeugt Token, versiegelt den
///     │ Rollenschluessel darunter
///     ▼
///   Link / SMS ───────────────────────►  meldet sich an (ganz normal)
///                                          │
///                                          ▼
///                                        loest den Link ein
///                                          │
///                                          ▼
///                                        Rollenschluessel wird auf ihre
///                                        persoenliche Rolle umgepackt
/// </code>
///
/// <b>Der Kern: der Schluessel reist mit dem Link, nicht mit der Datenbank.</b>
/// <c>sealed_role_key</c> liegt unter einer Ableitung aus dem Token-Geheimnis,
/// und das Geheimnis steht nirgends gespeichert — nur sein SHA-256. Wer die
/// Tabelle vollstaendig besitzt, kann die Einladung nicht einloesen. Nur wer
/// den Link hat, kann es.
///
/// Deshalb ist der Verlust eines Links auch nicht bloss ein Bequemlichkeits-
/// problem: es gibt keinen Weg, ihn aus der Datenbank wiederherzustellen. Man
/// stellt einen neuen aus.
/// </summary>
public static class RcInvitations
{
    /// <summary>
    /// Vorgabe 30 Tage. 10.4 erzwingt fuer den SMS-Weg mindestens sieben — das
    /// prueft der Kernel, weil die Regel dort ohnehin steht.
    /// </summary>
    public static readonly TimeSpan DefaultLife = TimeSpan.FromDays(30);

    public static void MapRcInvitations(this IEndpointRouteBuilder app)
    {
        app.MapPost("/rc/invitations", CreateAsync).Produces<RcInvitationCreatedResponse>();
        app.MapGet("/rc/invitations", ListAsync).Produces<RcInvitationsResponse>();
        app.MapPost("/rc/invitations/{id:guid}/revoke", RevokeAsync).Produces<RcRevokedResponse>();

        // Ansehen, ohne einzuloesen — damit der Klient sagen kann, WOHINEIN
        // eingeladen wird, bevor jemand zusagt. Kein Konto noetig: der Link ist
        // der Nachweis.
        app.MapPost("/rc/invitations/peek", PeekAsync)
           .AllowAnonymousWrite("Zeigt, wohin ein Link fuehrt — vor der Anmeldung.")
           .Produces<RcInvitationPeekResponse>();

        app.MapPost("/rc/invitations/redeem", RedeemAsync).Produces<RcInvitationRedeemedResponse>();
    }

    // -- Ausstellen -----------------------------------------------------------

    public sealed record CreateRequest(string RoleId, string? Label, int? DaysValid, int? MaxUses, bool? ForSms);

    /// <summary>
    /// Wer einlaedt, braucht <c>certify</c> in der Traegerschaft der Rolle UND
    /// den Schluessel der Rolle selbst. Beides ist noetig und keines genuegt:
    /// ohne certify duerfte er nicht aufnehmen, ohne Schluessel koennte er die
    /// Einladung gar nicht bilden.
    /// </summary>
    private static async Task CreateAsync(
        HttpContext ctx, RcDb db, RcMasterKey keys, RcPermissions permissions, CreateRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.RoleId, out var roleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der Rolle ist unlesbar.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var tenantId = await TenantOfAsync(connection, roleId, ctx.RequestAborted);
        if (tenantId == Guid.Empty)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        var may = await permissions.CheckAsync(
            session.AccountId, RcScopeKind.Tenant, tenantId, RcCapability.Certify, ctx.RequestAborted);

        if (!may.Allowed)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Hier darfst du niemanden einladen.");
            return;
        }

        using var held = await keys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var roleKey = await RcRoleAccess.RoleKeyAsync(
            connection, session.AccountId, held.MasterKey, roleId, ctx.RequestAborted);

        if (roleKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Einladen kannst du nur, was dir selbst offensteht.");
            return;
        }

        var purpose = body.ForSms == true ? RcTokenPurpose.SmsAccessLink : RcTokenPurpose.AreaInvitation;
        var life = TimeSpan.FromDays(Math.Clamp(body.DaysValid ?? DefaultLife.Days, 1, 365));

        string secret;
        RcTokenRecord record;
        try
        {
            (secret, record) = RcToken.Create(purpose, roleId, DateTimeOffset.UtcNow, life, body.Label);
        }
        catch (ArgumentOutOfRangeException)
        {
            // 10.4 — Der Kernel besteht auf sieben Tagen fuer den SMS-Weg. Das
            // ist keine Formalie: zwischen dem Klick auf den sms:-Link und dem
            // Absenden koennen Stunden liegen.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied,
                $"Ueber SMS verschickte Links gelten mindestens {RcToken.MinimumSmsLifetime.TotalDays:0} Tage.");
            return;
        }

        // Hier reist der Schluessel in den Link hinein.
        var sealedRoleKey = RcCrypto.Seal(
            RcCrypto.Derive(System.Text.Encoding.UTF8.GetBytes(secret), RcCrypto.InfoInvitation(secret), RcCrypto.KeySize),
            InviteAad(record.Id), roleKey);

        await InsertAsync(connection, record, sealedRoleKey, may.Via!.Value, body.MaxUses, ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcInvitationCreatedResponse(
            RcId.ToText(record.Id),
            // Genau einmal. Danach steht er nirgends mehr — auch nicht hier.
            secret,
            record.ExpiresUtc, purpose.ToString(), body.MaxUses), StatusCodes.Status201Created);
    }

    // -- Ansehen --------------------------------------------------------------

    public sealed record SecretRequest(string Secret);

    /// <summary>
    /// Was hinter dem Link steht, ohne ihn zu verbrauchen. Ohne Konto
    /// erreichbar — wer den Link hat, soll sehen koennen, worauf er sich
    /// einlaesst, bevor er sich anmeldet.
    ///
    /// Der Anzeigename bleibt dabei ZU. Ihn zu zeigen hiesse, den
    /// Rollenschluessel zu benutzen, und der gehoert erst dem, der einloest.
    /// </summary>
    private static async Task PeekAsync(HttpContext ctx, RcDb db, SecretRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var token = await LoadBySecretAsync(connection, body.Secret, ctx.RequestAborted);

        if (token is null || !RcToken.Verify(token.Record, body.Secret, DateTimeOffset.UtcNow) || token.Exhausted)
        {
            // Abgelaufen, widerrufen, aufgebraucht und schlicht falsch geben
            // dieselbe Antwort (10.3).
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.AuthTokenInvalid, "Dieser Link gilt nicht mehr.");
            return;
        }

        await MarkOpenedAsync(connection, token.Record.Id, ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcInvitationPeekResponse(
            token.Record.Label, token.Record.Purpose.ToString(), token.Record.ExpiresUtc,
            // Ob man schon angemeldet ist, weiss der Klient selbst; hier steht
            // nur, dass man es sein MUSS.
            RequiresAccount: true));
    }

    // -- Einloesen ------------------------------------------------------------

    /// <summary>
    /// Der eigentliche Vorgang: den Rollenschluessel aus dem Link auf die
    /// persoenliche Rolle der eingeloesten Person umpacken.
    ///
    /// Verlangt ein angemeldetes, entsperrtes Konto. Genau das ist die
    /// Bedeutung von „der Link verbindet den Zugang mit einem bestehenden
    /// Konto": ohne Konto gibt es keine persoenliche Rolle, unter deren
    /// Verpackungsschluessel sich etwas legen liesse.
    /// </summary>
    private static async Task RedeemAsync(HttpContext ctx, RcDb db, RcMasterKey keys, SecretRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var token = await LoadBySecretAsync(connection, body.Secret, ctx.RequestAborted);
        var now = DateTimeOffset.UtcNow;

        if (token is null || !RcToken.Verify(token.Record, body.Secret, now) || token.Exhausted
            || token.SealedRoleKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.AuthTokenInvalid, "Dieser Link gilt nicht mehr.");
            return;
        }

        using var held = await keys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var personalRoleId = await PersonalRoleAsync(connection, session.AccountId, ctx.RequestAborted);
        if (personalRoleId is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.RoleNotFound, "Diesem Konto fehlt seine persoenliche Rolle.");
            return;
        }

        byte[] roleKey;
        try
        {
            roleKey = RcCrypto.Open(
                RcCrypto.Derive(System.Text.Encoding.UTF8.GetBytes(body.Secret),
                    RcCrypto.InfoInvitation(body.Secret), RcCrypto.KeySize),
                InviteAad(token.Record.Id), token.SealedRoleKey);
        }
        catch (RcDecryptException)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.AuthTokenInvalid, "Dieser Link gilt nicht mehr.");
            return;
        }

        var invitedRoleId = token.Record.SubjectId;
        var identities = await RcRoleAccess.LoadIdentitiesAsync(
            connection, [personalRoleId.Value, invitedRoleId], ctx.RequestAborted);

        if (!identities.TryGetValue(personalRoleId.Value, out var personal)
            || !identities.TryGetValue(invitedRoleId, out var invited))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht mehr.");
            return;
        }

        // Unterschrieben wird mit dem Schluessel der EINGELADENEN Rolle. Der
        // Einladende ist beim Einloesen nicht anwesend; die Vollmacht dazu ist
        // der Link selbst, und wer ihn hat, kann diesen Schluessel oeffnen.
        using var invitedSign = RcRoleKeys.OpenSignKey(invited, roleKey);

        var edge = new RcRoleEdgeRecord
        {
            Id = RcId.NewId(),
            FromRoleId = personalRoleId.Value,
            ToRoleId = invitedRoleId,
            EdgeKind = RcEdgeKinds.Holds,
            SignerRoleId = invitedRoleId,
            CreatedUtc = now
        };

        var grant = RcRoleKeys.GrantTo(personal.WrapPublicKey, invitedRoleId, roleKey);
        CryptographicOperations.ZeroMemory(roleKey);

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
        try
        {
            await RcPermissions.AssertNoCycleAsync(connection, tx, personalRoleId.Value, invitedRoleId, ctx.RequestAborted);
            await RcRoles.InsertEdgeAsync(connection, tx, edge, edge.Sign(invitedSign), ctx.RequestAborted);
            await RcRoles.InsertGrantAsync(connection, tx, personalRoleId.Value, invitedRoleId, grant, invitedRoleId, ctx.RequestAborted);
            await RecordRedemptionAsync(connection, tx, token.Record.Id, personalRoleId.Value, edge.Id, ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (RcRoleCycleException)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict, RcErrorCodes.RoleCycle,
                "Das wuerde einen Kreis schliessen.");
            return;
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            // Zweimal derselbe Link von derselben Person. Kein Fehler — das
            // Ergebnis ist bereits da, und der Mensch davor soll das erfahren
            // und nicht ratlos vor einem Konflikt stehen.
            await tx.RollbackAsync(ctx.RequestAborted);
            await RcResults.WriteJsonAsync(ctx, new RcInvitationRedeemedResponse(
                RcId.ToText(invitedRoleId), null, AlreadyRedeemed: true));
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcInvitationRedeemedResponse(
            RcId.ToText(invitedRoleId), RcId.ToText(edge.Id), AlreadyRedeemed: false),
            StatusCodes.Status201Created);
    }

    // -- Verwalten ------------------------------------------------------------

    public sealed record InvitationView(
        string InvitationId, string RoleId, string? Label, string Purpose,
        DateTimeOffset ExpiresUtc, int UseCount, int? MaxUses, DateTimeOffset? FirstOpenedUtc);

    private static async Task ListAsync(HttpContext ctx, RcDb db)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var reachable = await RcPermissions.ReachableRolesAsync(connection, session.AccountId, ctx.RequestAborted);
        if (reachable.Count == 0)
        {
            await RcResults.WriteJsonAsync(ctx, new RcInvitationsResponse([]));
            return;
        }

        var names = string.Join(", ", reachable.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT id, subject_id, label, purpose, expires_at, use_count, max_uses, first_opened_at
            FROM dbo.rc_token
            WHERE revoked_at IS NULL AND expires_at > @now AND subject_id IN ({names})
            ORDER BY created_at DESC;
            """, connection);

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < reachable.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", reachable[i].RoleId);

        var list = new List<InvitationView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            list.Add(new InvitationView(
                RcId.ToText(reader.GetGuid(0)), RcId.ToText(reader.GetGuid(1)),
                reader.IsDBNull(2) ? null : reader.GetString(2), reader.GetString(3),
                reader.GetDateTimeOffset(4), reader.GetInt32(5),
                reader.IsDBNull(6) ? null : reader.GetInt32(6),
                reader.IsDBNull(7) ? null : reader.GetDateTimeOffset(7)));
        }

        await RcResults.WriteJsonAsync(ctx, new RcInvitationsResponse(list));
    }

    private static async Task RevokeAsync(HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid roleId;
        await using (var read = new SqlCommand(
            "SELECT subject_id FROM dbo.rc_token WHERE id = @id AND revoked_at IS NULL;", connection))
        {
            read.Parameters.AddWithValue("@id", id);
            if (await read.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                    RcErrorCodes.AuthTokenInvalid, "Diese Einladung gibt es nicht.");
                return;
            }
            roleId = found;
        }

        var tenantId = await TenantOfAsync(connection, roleId, ctx.RequestAborted);
        var may = await permissions.CheckAsync(
            session.AccountId, RcScopeKind.Tenant, tenantId, RcCapability.Certify, ctx.RequestAborted);

        if (!may.Allowed)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Hier darfst du nichts zuruecknehmen.");
            return;
        }

        await using var cmd = new SqlCommand(
            "UPDATE dbo.rc_token SET revoked_at = @now WHERE id = @id AND revoked_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@id", id);

        // Der Widerruf nimmt dem Link seine Wirkung, aber nicht die
        // Einloesungen, die schon geschehen sind. Wer drin ist, bleibt drin —
        // ihn wieder hinauszubefoerdern ist ein eigener Vorgang mit eigener
        // Entscheidung, und ihn hier stillschweigend mitzuerledigen waere eine
        // Ueberraschung.
        await RcResults.WriteJsonAsync(ctx, new RcRevokedResponse(
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 1));
    }

    // -- Datenzugriff ---------------------------------------------------------

    private sealed record TokenRow(RcTokenRecord Record, byte[]? SealedRoleKey, int? MaxUses, int UseCount)
    {
        public bool Exhausted => MaxUses is not null && UseCount >= MaxUses;
    }

    private static async Task<TokenRow?> LoadBySecretAsync(SqlConnection connection, string? secret, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(secret)) return null;

        await using var cmd = new SqlCommand("""
            SELECT id, purpose, subject_id, token_hash, sealed_role_key, created_at, expires_at,
                   revoked_at, label, max_uses, use_count, first_opened_at, view_count
            FROM dbo.rc_token WHERE token_hash = @hash;
            """, connection);
        cmd.Parameters.AddWithValue("@hash", RcToken.HashSecret(secret));

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        if (!Enum.TryParse<RcTokenPurpose>(reader.GetString(1), out var purpose)) return null;

        var record = new RcTokenRecord
        {
            Id = reader.GetGuid(0),
            Purpose = purpose,
            SubjectId = reader.GetGuid(2),
            Hash = (byte[])reader[3],
            CreatedUtc = reader.GetDateTimeOffset(5),
            ExpiresUtc = reader.GetDateTimeOffset(6),
            RevokedUtc = reader.IsDBNull(7) ? null : reader.GetDateTimeOffset(7),
            Label = reader.IsDBNull(8) ? null : reader.GetString(8),
            FirstOpenedUtc = reader.IsDBNull(11) ? null : reader.GetDateTimeOffset(11),
            ViewCount = reader.GetInt32(12)
        };

        return new TokenRow(record, reader.IsDBNull(4) ? null : (byte[])reader[4],
            reader.IsDBNull(9) ? null : reader.GetInt32(9), reader.GetInt32(10));
    }

    private static async Task InsertAsync(
        SqlConnection connection, RcTokenRecord record, byte[] sealedRoleKey,
        Guid createdByRoleId, int? maxUses, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO dbo.rc_token
                (id, purpose, subject_id, token_hash, sealed_role_key, created_by_role_id,
                 created_at, expires_at, max_uses, label)
            VALUES
                (@id, @purpose, @subject, @hash, @sealed, @by, @created, @expires, @maxUses, @label);
            """, connection);

        cmd.Parameters.AddWithValue("@id", record.Id);
        cmd.Parameters.AddWithValue("@purpose", record.Purpose.ToString());
        cmd.Parameters.AddWithValue("@subject", record.SubjectId);
        cmd.Parameters.AddWithValue("@hash", record.Hash);
        cmd.Parameters.AddWithValue("@sealed", sealedRoleKey);
        cmd.Parameters.AddWithValue("@by", createdByRoleId);
        cmd.Parameters.AddWithValue("@created", record.CreatedUtc);
        cmd.Parameters.AddWithValue("@expires", record.ExpiresUtc);
        cmd.Parameters.AddWithValue("@maxUses", (object?)maxUses ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@label", (object?)record.Label ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task MarkOpenedAsync(SqlConnection connection, Guid tokenId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            UPDATE dbo.rc_token
            SET view_count = view_count + 1,
                first_opened_at = COALESCE(first_opened_at, @now)
            WHERE id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@id", tokenId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task RecordRedemptionAsync(
        SqlConnection connection, SqlTransaction tx, Guid tokenId, Guid roleId, Guid edgeId, CancellationToken ct)
    {
        await using (var insert = new SqlCommand("""
            INSERT INTO dbo.rc_token_redemption (id, token_id, redeemed_by_role_id, redeemed_at, edge_id)
            VALUES (@id, @token, @role, @now, @edge);
            """, connection, tx))
        {
            insert.Parameters.AddWithValue("@id", RcId.NewId());
            insert.Parameters.AddWithValue("@token", tokenId);
            insert.Parameters.AddWithValue("@role", roleId);
            insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            insert.Parameters.AddWithValue("@edge", edgeId);
            await insert.ExecuteNonQueryAsync(ct);
        }

        // Der Zaehler wird in derselben Transaktion hochgesetzt. Ausserhalb
        // koennten zwei gleichzeitige Einloesungen eine einmalige Einladung
        // zweimal verbrauchen — und beide waeren fuer sich im Recht.
        await using var bump = new SqlCommand(
            "UPDATE dbo.rc_token SET use_count = use_count + 1 WHERE id = @id;", connection, tx);
        bump.Parameters.AddWithValue("@id", tokenId);
        await bump.ExecuteNonQueryAsync(ct);
    }

    private static async Task<Guid?> PersonalRoleAsync(SqlConnection connection, Guid accountId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT TOP 1 e.to_role_id
            FROM dbo.rc_role_edge e
            JOIN dbo.rc_role r ON r.id = e.to_role_id AND r.revoked_at IS NULL
            WHERE e.from_account_id = @account AND e.revoked_at IS NULL AND r.kind = @person
            ORDER BY e.seq;
            """, connection);
        cmd.Parameters.AddWithValue("@account", accountId);
        cmd.Parameters.AddWithValue("@person", RcRoleKinds.Person);
        return await cmd.ExecuteScalarAsync(ct) is Guid id ? id : null;
    }

    private static async Task<Guid> TenantOfAsync(SqlConnection connection, Guid roleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT tenant_id FROM dbo.rc_role WHERE id = @id AND revoked_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", roleId);
        return await cmd.ExecuteScalarAsync(ct) is Guid tenant ? tenant : Guid.Empty;
    }

    private static RcAad InviteAad(Guid tokenId) =>
        RcAad.Create("kernel", "invitation", tokenId, RcField.InvitationRoleKey, 1);

    private static Task Unauthenticated(HttpContext ctx) =>
        RcResults.WriteErrorAsync(ctx, StatusCodes.Status401Unauthorized,
            RcErrorCodes.SessionExpired, "Dafuer musst du angemeldet sein.");
}
