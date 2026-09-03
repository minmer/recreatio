using System.Security.Cryptography;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// 3.1, 3.5, 3.14 — Rollen anlegen, Zertifikate ausstellen, zurueckziehen.
///
/// <b>Wie jemand hineinkommt.</b> Anmelden kann sich jeder. Wer es tut, bekommt
/// eine persoenliche Rolle und einen eigenen Geltungsbereich, auf den er
/// <c>admin</c> und <c>certify</c> haelt — sein Bereich, sonst nichts.
///
/// In FREMDE Bereiche fuehrt genau ein Weg: eine Einladung
/// (<see cref="RcInvitations"/>), die sich mit einem bestehenden Konto
/// verbindet. Deshalb ist offene Anmeldung hier ungefaehrlich — ein frisches
/// Konto erreicht nichts, was ihm nicht jemand ausdruecklich gegeben hat.
///
/// Ein offener Weg in fremde Bereiche („wer einen Bereich zuerst beansprucht,
/// gehoert er") waere bequem und falsch. Er verlegt die Frage, wem etwas
/// gehoert, in ein Wettrennen.
///
/// <b>Was hier ausdruecklich zusammengehoert.</b> Eine Rolle anzulegen heisst
/// immer zugleich: Schluessel erzeugen, sie einem Halter ZUTEILEN und die Kante
/// eintragen. Drei Endpunkte daraus zu machen hiesse, dass es Rollen gaebe, die
/// niemand halten kann — und die waeren nicht bloss nutzlos, sondern unloeschbar
/// nutzlos, weil niemand ihren Schluessel hat.
/// </summary>
public static class RcRoles
{
    /// <summary>
    /// E-07 — Lebenszeit ist Pflicht. Fuenf Jahre fuer die Gruendungszertifikate:
    /// lang genug, um nicht zur Schikane zu werden, kurz genug, dass die
    /// Erneuerung noch in ein Menschenleben faellt und jemand hinsieht.
    /// </summary>
    public static readonly TimeSpan FoundingCertificateLife = TimeSpan.FromDays(365 * 5);

    /// <summary>Vorgabe fuer ausgestellte Zertifikate, wenn kein Ablauf genannt wird.</summary>
    public static readonly TimeSpan DefaultCertificateLife = TimeSpan.FromDays(365);

    public static void MapRcRoles(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/roles", ListAsync).Produces<RcRolesResponse>();
        app.MapPost("/rc/roles", CreateAsync).Produces<RcRoleCreatedResponse>();
        app.MapPost("/rc/roles/{id:guid}/holders", AddHolderAsync).Produces<RcHolderAddedResponse>();
        app.MapPost("/rc/roles/{id:guid}/name", RenameAsync).Produces<RcRoleRenamedResponse>();
        app.MapGet("/rc/certificates", ListCertificatesAsync).Produces<RcCertificatesResponse>();
        app.MapPost("/rc/certificates", IssueAsync).Produces<RcCertificateIssuedResponse>();
        app.MapPost("/rc/certificates/{id:guid}/revoke", RevokeAsync).Produces<RcRevokedResponse>();
        app.MapGet("/rc/permissions/check", CheckAsync).Produces<RcPermissionCheckResponse>();
    }

    // -- Anzeigen -------------------------------------------------------------

    public sealed record RoleView(
        string RoleId, string Kind, string TenantId, int Depth, string? DisplayName, bool HasKey);

    /// <summary>
    /// Die erreichbaren Rollen mit ihren Namen.
    ///
    /// <c>hasKey</c> ist kein Schmuck: fallen Erreichbarkeit im Graphen und
    /// Erreichbarkeit der Schluessel auseinander, sieht man es hier und nicht
    /// erst, wenn jemand eine Nachricht nicht oeffnen kann.
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, RcDb db, RcMasterKey masterKeys)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var masterKey = held.MasterKey;

        var reachable = await RcPermissions.ReachableRolesAsync(connection, session.AccountId, ctx.RequestAborted);
        var keys = await RcRoleAccess.AllRoleKeysAsync(connection, session.AccountId, masterKey, ctx.RequestAborted);
        var names = await LoadDisplayNamesAsync(connection, reachable.Select(r => r.RoleId).ToList(), ctx.RequestAborted);

        var views = reachable.Select(r =>
        {
            string? name = null;
            if (keys.TryGetValue(r.RoleId, out var key) && names.TryGetValue(r.RoleId, out var sealedName))
            {
                try { name = OpenDisplayName(r.RoleId, key, sealedName); }
                catch (RcDecryptException) { /* Der Name bleibt leer; die Rolle bleibt sichtbar. */ }
            }

            return new RoleView(RcId.ToText(r.RoleId), r.Kind, RcId.ToText(r.TenantId), r.Depth,
                name, keys.ContainsKey(r.RoleId));
        }).ToList();

        await RcResults.WriteJsonAsync(ctx, new RcRolesResponse(views));
    }

    // -- Umbenennen -----------------------------------------------------------

    public sealed record RenameRequest(string DisplayName);

    /// <summary>
    /// Den Anzeigenamen einer Rolle aendern.
    ///
    /// <b>Er wirkt RUECKWIRKEND</b> (9.13.2), und das ist keine Nachlaessigkeit,
    /// sondern der Entwurf: der Name liegt EINMAL an der Rolle und nicht als
    /// Kopie in jeder Nachricht, die sie je geschrieben hat. Wer heiratet,
    /// heisst danach ueberall anders — auch ueber alten Beitraegen. Die
    /// Alternative waere, den Namen bei jeder Verwendung mitzuschreiben; dann
    /// stuende der alte Name fuer immer an tausend Stellen, und niemand
    /// bekaeme ihn je wieder weg.
    ///
    /// <b>Derselbe Schluessel, dasselbe Etikett, dieselbe Fassung.</b> Anders
    /// als bei einem Datenelement steigt hier keine Fassung: die AAD des
    /// Anzeigenamens ist fest verdrahtet (<c>DisplayNameAad</c>, Fassung 1),
    /// und jede Stelle, die ihn oeffnet, erwartet genau die. Eine steigende
    /// Fassung muesste dort mitgelesen werden — sie steht aber nirgends in der
    /// Zeile, also gaebe es nichts, woran man sie erkennt.
    ///
    /// <b>Wer den Schluessel hat, darf.</b> Kein zusaetzliches Zertifikat:
    /// den Rollenschluessel zu halten heisst, im Namen dieser Rolle handeln zu
    /// koennen — und ihren Namen zu setzen ist weniger als das.
    /// </summary>
    private static async Task RenameAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, Guid id, RenameRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        var name = body.DisplayName?.Trim() ?? "";
        if (name.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Der Name fehlt oder ist zu lang.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var roleKey = await RcRoleAccess.RoleKeyAsync(
            connection, session.AccountId, held.MasterKey, id, ctx.RequestAborted);

        if (roleKey is null)
        {
            // „Nicht erreichbar" und „gibt es nicht" bekommen dieselbe Antwort.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        await using var cmd = new SqlCommand(
            "UPDATE dbo.rc_role SET display_name_sealed = @name WHERE id = @id AND revoked_at IS NULL;",
            connection);
        cmd.Parameters.AddWithValue("@name", SealDisplayName(id, roleKey, name));
        cmd.Parameters.AddWithValue("@id", id);

        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcRoleRenamedResponse(RcId.ToText(id), name));
    }

    // -- Anlegen --------------------------------------------------------------

    public sealed record CreateRoleRequest(string HolderRoleId, string Kind, string DisplayName);

    private static async Task CreateAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcLoginGuard guard, CreateRoleRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.HolderRoleId, out var holderRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der haltenden Rolle ist unlesbar.");
            return;
        }

        var kind = body.Kind?.Trim() ?? "";
        if (kind.Length is 0 or > 64 || kind == RcRoleKinds.Person)
        {
            // Persoenliche Rollen entstehen mit dem Konto und sonst nie. Liesse
            // man sie hier zu, gaebe es persoenliche Rollen ohne ableitbaren
            // Schluessel — dieselbe Bezeichnung fuer zwei verschiedene Dinge.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Art von Rolle laesst sich hier nicht anlegen.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var holderKey = await RcRoleAccess.RoleKeyAsync(connection, session.AccountId, held.MasterKey, holderRoleId, ctx.RequestAborted);
        if (holderKey is null)
        {
            // „Nicht erreichbar" und „gibt es nicht" bekommen dieselbe Antwort.
            // Der Unterschied waere eine Auskunft ueber fremde Rollen.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Diese Rolle steht dir nicht zur Verfuegung.");
            return;
        }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [holderRoleId], ctx.RequestAborted);
        if (!identities.TryGetValue(holderRoleId, out var holder))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Diese Rolle steht dir nicht zur Verfuegung.");
            return;
        }

        var tenantId = await TenantOfAsync(connection, holderRoleId, ctx.RequestAborted);

        // Zwei RSA-4096-Paare. Das dauert Sekunden und gehoert deshalb hinter
        // denselben Riegel wie Argon2id — sonst ist das Anlegen von Rollen der
        // bequemste Weg, den Dienst umzuwerfen.
        RcRoleIdentity created;
        byte[] newRoleKey;
        var newRoleId = RcId.NewId();

        using (await guard.EnterAsync(ctx.RequestAborted))
        {
            newRoleKey = RcRoleKeys.NewRoleKey();
            created = RcRoleKeys.Create(newRoleId, newRoleKey);
        }

        using var holderSign = RcRoleKeys.OpenSignKey(holder, holderKey);

        var edge = new RcRoleEdgeRecord
        {
            Id = RcId.NewId(),
            FromRoleId = holderRoleId,
            ToRoleId = newRoleId,
            EdgeKind = RcEdgeKinds.Holds,
            SignerRoleId = holderRoleId,
            CreatedUtc = DateTimeOffset.UtcNow
        };

        var displayNameSealed = SealDisplayName(newRoleId, newRoleKey, body.DisplayName ?? "");
        var grant = RcRoleKeys.GrantTo(holder.WrapPublicKey, newRoleId, newRoleKey);

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
        try
        {
            // 3.14 — Innerhalb der Transaktion. Ausserhalb koennte zwischen
            // Pruefung und Einfuegen eine zweite Kante entstehen, und der Kreis
            // waere trotz Pruefung da.
            await RcPermissions.AssertNoCycleAsync(connection, tx, holderRoleId, newRoleId, ctx.RequestAborted);

            await InsertRoleAsync(connection, tx, created, tenantId, kind, displayNameSealed, ctx.RequestAborted);
            await InsertEdgeAsync(connection, tx, edge, edge.Sign(holderSign), ctx.RequestAborted);
            await InsertGrantAsync(connection, tx, holderRoleId, newRoleId, grant, holderRoleId, ctx.RequestAborted);

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (RcRoleCycleException e)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            CryptographicOperations.ZeroMemory(newRoleKey);
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict, e.Code,
                "Diese Zuordnung wuerde einen Kreis schliessen: die beiden Rollen wuerden einander gegenseitig aufschliessen.");
            return;
        }

        CryptographicOperations.ZeroMemory(newRoleKey);

        await RcResults.WriteJsonAsync(ctx, new RcRoleCreatedResponse(
            RcId.ToText(newRoleId), RcId.ToText(tenantId), kind, RcCrypto.ToHex(created.Fingerprint)),
            StatusCodes.Status201Created);
    }

    // -- Eine bestehende Rolle weitergeben -------------------------------------

    public sealed record AddHolderRequest(string HolderRoleId, string? EdgeKind, int? DaysValid);

    /// <summary>
    /// „Gib der Gruppe die Schriftfuehrung." Der eigentliche Verwaltungsakt —
    /// und die einzige Stelle, an der ein Kreis ueberhaupt entstehen kann
    /// (3.14). Beim Anlegen einer Rolle kann er es nicht: eine gerade
    /// entstandene Rolle hat keine ausgehenden Kanten.
    ///
    /// <b>Drei Bedingungen, und jede fuer sich noetig:</b>
    ///
    ///   1. Der Aufrufer muss die weiterzugebende Rolle SELBST erreichen. Man
    ///      kann nicht weiterreichen, was man nicht hat — und ohne ihren
    ///      Schluessel liesse sich die Zuteilung gar nicht bilden.
    ///   2. Er muss die haltende Rolle erreichen, um deren
    ///      Verpackungsschluessel zu benutzen. Das ist keine zusaetzliche
    ///      Huerde, sondern dieselbe Tatsache von der anderen Seite.
    ///   3. Er braucht <c>certify</c> in der Traegerschaft. Wer Schluessel hat,
    ///      soll damit nicht schon Mitgliedschaften vergeben duerfen — sonst
    ///      waere jede Weitergabe zugleich eine Erlaubnis zur Weitergabe.
    /// </summary>
    private static async Task AddHolderAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, AddHolderRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.HolderRoleId, out var holderRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der haltenden Rolle ist unlesbar.");
            return;
        }

        var edgeKind = body.EdgeKind ?? RcEdgeKinds.Holds;
        if (edgeKind is not (RcEdgeKinds.Holds or RcEdgeKinds.Inherits or RcEdgeKinds.Supervises))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Art von Kante ist unbekannt.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var tenantId = await TenantOfAsync(connection, id, ctx.RequestAborted);
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
                RcErrorCodes.PermissionDenied, "Hier darfst du niemanden aufnehmen.");
            return;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        {
            var grantedKey = await RcRoleAccess.RoleKeyAsync(connection, session.AccountId, held.MasterKey, id, ctx.RequestAborted);
            var holderKey = await RcRoleAccess.RoleKeyAsync(connection, session.AccountId, held.MasterKey, holderRoleId, ctx.RequestAborted);

            if (grantedKey is null || holderKey is null)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                    RcErrorCodes.RoleUnreachable,
                    "Weitergeben kannst du nur, was dir selbst offensteht.");
                return;
            }

            var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [holderRoleId], ctx.RequestAborted);
            if (!identities.TryGetValue(holderRoleId, out var holder))
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                    RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
                return;
            }

            using var holderSign = RcRoleKeys.OpenSignKey(holder, holderKey);

            var edge = new RcRoleEdgeRecord
            {
                Id = RcId.NewId(),
                FromRoleId = holderRoleId,
                ToRoleId = id,
                EdgeKind = edgeKind,
                SignerRoleId = holderRoleId,
                CreatedUtc = DateTimeOffset.UtcNow,
                ExpiresUtc = body.DaysValid is null ? null : DateTimeOffset.UtcNow.AddDays(body.DaysValid.Value)
            };

            var grant = RcRoleKeys.GrantTo(holder.WrapPublicKey, id, grantedKey);

            await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
                System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
            try
            {
                // 3.14 — INNERHALB der Transaktion. Ausserhalb koennte zwischen
                // Pruefung und Einfuegen eine zweite Kante entstehen, und der
                // Kreis waere trotz Pruefung da: zwei Verwalter, jeder fuer sich
                // im Recht, und hinterher schliesst niemand mehr die Runde auf.
                await RcPermissions.AssertNoCycleAsync(connection, tx, holderRoleId, id, ctx.RequestAborted);

                await InsertEdgeAsync(connection, tx, edge, edge.Sign(holderSign), ctx.RequestAborted);
                await InsertGrantAsync(connection, tx, holderRoleId, id, grant, holderRoleId, ctx.RequestAborted);

                await tx.CommitAsync(ctx.RequestAborted);
            }
            catch (RcRoleCycleException)
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict, RcErrorCodes.RoleCycle,
                    "Das wuerde einen Kreis schliessen: die beiden Rollen wuerden einander gegenseitig aufschliessen.");
                return;
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                await RcResults.WriteJsonAsync(ctx, new RcHolderAddedResponse(null, AlreadyHeld: true));
                return;
            }

            await RcResults.WriteJsonAsync(ctx, new RcHolderAddedResponse(
                RcId.ToText(edge.Id), edgeKind, edge.ExpiresUtc), StatusCodes.Status201Created);
        }
    }

    // -- Zertifikate ----------------------------------------------------------

    public sealed record IssueRequest(
        string SubjectRoleId, string IssuerRoleId, string ScopeKind, string ScopeId,
        string Capability, int? DaysValid);

    private static async Task IssueAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, IssueRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.SubjectRoleId, out var subjectRoleId)
            || !Guid.TryParse(body.IssuerRoleId, out var issuerRoleId)
            || !Guid.TryParse(body.ScopeId, out var scopeId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Eine der Kennungen ist unlesbar.");
            return;
        }

        if (!RcCapabilities.TryParse(body.Capability, out var capability)
            || !RcCapabilities.TryParseScope(body.ScopeKind, out var scopeKind))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Stufe oder Geltungsbereich ist unbekannt.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, scopeKind, scopeId, RcCapability.Certify, ctx.RequestAborted);
        if (!may.Allowed)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Hier darfst du niemanden aufnehmen.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        // Unterschrieben wird mit dem Schluessel der ausstellenden Rolle — nicht
        // mit irgendeinem erreichbaren. Wer im Namen einer Rolle ausstellt, muss
        // deren Schluessel haben.
        using var issuerSign = await RcRoleAccess.OpenSignKeyAsync(
            connection, session.AccountId, held.MasterKey, issuerRoleId, ctx.RequestAborted);

        if (issuerSign is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Im Namen dieser Rolle kannst du nicht ausstellen.");
            return;
        }

        var life = TimeSpan.FromDays(Math.Clamp(body.DaysValid ?? DefaultCertificateLife.Days, 1, 365 * 5));
        var now = DateTimeOffset.UtcNow;

        var certificate = new RcCertificateRecord
        {
            Id = RcId.NewId(),
            SubjectRoleId = subjectRoleId,
            ScopeKind = scopeKind,
            ScopeId = scopeId,
            Capability = capability,
            IssuedByRoleId = issuerRoleId,
            IssuedUtc = now,
            ExpiresUtc = now + life
        };

        try
        {
            await InsertCertificateAsync(connection, null, certificate, certificate.Sign(issuerSign), ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number == 547)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcCertificateIssuedResponse(
            RcId.ToText(certificate.Id), certificate.ExpiresUtc, RcCapabilities.ToText(capability)),
            StatusCodes.Status201Created);
    }

    public sealed record CertificateView(
        string CertificateId, string SubjectRoleId, string ScopeKind, string ScopeId,
        string Capability, string IssuedByRoleId, DateTimeOffset ExpiresUtc);

    private static async Task ListCertificatesAsync(HttpContext ctx, RcDb db)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var reachable = await RcPermissions.ReachableRolesAsync(connection, session.AccountId, ctx.RequestAborted);
        if (reachable.Count == 0)
        {
            await RcResults.WriteJsonAsync(ctx, new RcCertificatesResponse([]));
            return;
        }

        var names = string.Join(", ", reachable.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT id, subject_role_id, scope_kind, scope_id, capability, issued_by_role_id, expires_at
            FROM dbo.rc_certificate
            WHERE revoked_at IS NULL AND expires_at > @now AND subject_role_id IN ({names})
            ORDER BY expires_at;
            """, connection);

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < reachable.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", reachable[i].RoleId);

        var list = new List<CertificateView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            list.Add(new CertificateView(
                RcId.ToText(reader.GetGuid(0)), RcId.ToText(reader.GetGuid(1)),
                reader.GetString(2), RcId.ToText(reader.GetGuid(3)), reader.GetString(4),
                RcId.ToText(reader.GetGuid(5)), reader.GetDateTimeOffset(6)));
        }

        await RcResults.WriteJsonAsync(ctx, new RcCertificatesResponse(list));
    }

    /// <summary>
    /// Zuruecknehmen wirkt SOFORT — es gibt keinen Zwischenspeicher, der es
    /// verzoegern koennte (24.5). Genau das war im Altbestand anders, und
    /// deshalb wirkte dort ein Entzug erst nach Ablauf des Caches.
    /// </summary>
    private static async Task RevokeAsync(HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid scopeId;
        RcScopeKind scopeKind;
        await using (var read = new SqlCommand(
            "SELECT scope_kind, scope_id FROM dbo.rc_certificate WHERE id = @id AND revoked_at IS NULL;", connection))
        {
            read.Parameters.AddWithValue("@id", id);
            await using var reader = await read.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                    RcErrorCodes.PermissionDenied, "Dieses Zertifikat gibt es nicht.");
                return;
            }
            RcCapabilities.TryParseScope(reader.GetString(0), out scopeKind);
            scopeId = reader.GetGuid(1);
        }

        var may = await permissions.CheckAsync(
            session.AccountId, scopeKind, scopeId, RcCapability.Certify, ctx.RequestAborted);

        if (!may.Allowed)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Hier darfst du nichts zuruecknehmen.");
            return;
        }

        await using var cmd = new SqlCommand(
            "UPDATE dbo.rc_certificate SET revoked_at = @now WHERE id = @id AND revoked_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@id", id);

        var rows = await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await RcResults.WriteJsonAsync(ctx, new RcRevokedResponse(rows == 1));
    }

    private static async Task CheckAsync(
        HttpContext ctx, RcPermissions permissions, string scopeKind, Guid scopeId, string capability)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        if (!RcCapabilities.TryParse(capability, out var needed)
            || !RcCapabilities.TryParseScope(scopeKind, out var kind))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Stufe oder Geltungsbereich ist unbekannt.");
            return;
        }

        var result = await permissions.CheckAsync(session.AccountId, kind, scopeId, needed, ctx.RequestAborted);
        await RcResults.WriteJsonAsync(ctx, new RcPermissionCheckResponse(
            result.Allowed,
            result.Via is null ? null : RcId.ToText(result.Via.Value),
            result.CertificateId is null ? null : RcId.ToText(result.CertificateId.Value)));
    }

    // -- Die Gruendung ---------------------------------------------------------

    /// <summary>
    /// Der eigene Bereich: persoenliche Rolle, eigener Geltungsbereich, zwei
    /// Zertifikate darauf. Laeuft bei JEDER Anmeldung, nicht nur bei der ersten.
    ///
    /// <b>Warum jeder seinen eigenen Bereich bekommt</b> und nicht alle einen
    /// gemeinsamen: <c>certify</c> auf einem gemeinsamen Bereich waere die
    /// Vollmacht, jedem alles zu geben. Ein Bereich je Person hat diese Stelle
    /// nicht — dort ist jeder in seinem eigenen Haus souveraen und in keinem
    /// fremden.
    ///
    /// Laeuft in DERSELBEN Transaktion wie das Anlegen des Kontos. Ein Konto
    /// ohne persoenliche Rolle waere ein Konto, das sich anmelden kann und sonst
    /// nichts — und niemand koennte ihm nachtraeglich eine geben, weil dazu ein
    /// Zertifikat noetig waere, das es nicht gibt.
    /// </summary>
    public static async Task<RcFoundation> FoundAsync(
        SqlConnection connection, SqlTransaction tx, Guid accountId, byte[] masterKey,
        string displayName, CancellationToken ct)
    {
        var tenantId = RcId.NewId();
        var roleId = RcId.NewId();
        var roleKey = RcRoleKeys.PersonalRoleKey(masterKey, roleId);
        var identity = RcRoleKeys.Create(roleId, roleKey);

        await InsertRoleAsync(connection, tx, identity, tenantId, RcRoleKinds.Person,
            SealDisplayName(roleId, roleKey, displayName), ct);

        using var signKey = RcRoleKeys.OpenSignKey(identity, roleKey);
        var now = DateTimeOffset.UtcNow;

        // 3.4 — Am Anfang steht ein Konto, und dessen Kennung geht NICHT in die
        // Unterschrift ein, sondern eine gesaltete Verpflichtung.
        var commitmentSalt = RandomNumberGenerator.GetBytes(16);
        var edge = new RcRoleEdgeRecord
        {
            Id = RcId.NewId(),
            FromAccountId = accountId,
            FromAccountCommitment = RcLedgerEntry.CommitAccount(accountId, commitmentSalt),
            ToRoleId = roleId,
            EdgeKind = RcEdgeKinds.Holds,
            SignerRoleId = roleId,
            CreatedUtc = now
        };
        await InsertEdgeAsync(connection, tx, edge, edge.Sign(signKey), ct);

        // admin UND certify. Nach der Ordnung aus 3.5 schliesst das eine das
        // andere nicht ein — wer gruendet, braucht beides ausdruecklich.
        var certificates = new List<RcCertificateRecord>();
        foreach (var capability in new[] { RcCapability.Admin, RcCapability.Certify })
        {
            var certificate = new RcCertificateRecord
            {
                Id = RcId.NewId(),
                SubjectRoleId = roleId,
                ScopeKind = RcScopeKind.Tenant,
                ScopeId = tenantId,
                Capability = capability,
                IssuedByRoleId = roleId,
                IssuedUtc = now,
                ExpiresUtc = now + FoundingCertificateLife
            };
            await InsertCertificateAsync(connection, tx, certificate, certificate.Sign(signKey), ct);
            certificates.Add(certificate);
        }

        CryptographicOperations.ZeroMemory(roleKey);
        return new RcFoundation(tenantId, roleId, certificates.Select(c => c.Id).ToList());
    }

    // -- Schreibhilfen ---------------------------------------------------------

    /// <summary>
    /// Eine Rolle, angelegt IN einer fremden Transaktion — Rolle, Kante und
    /// Schluesselzuteilung.
    ///
    /// Herausgeloest aus demselben Grund wie <see cref="RcAreas.InsertAreaAsync"/>:
    /// wer eine Pfarrei anlegt, legt auch ein Amt an, und das darf nicht
    /// stehenbleiben, wenn die Pfarrei scheitert.
    ///
    /// Verwaltet KEINE Transaktion und faengt nichts ab. Der Aufrufer haelt
    /// beides — und muss den Schluessel danach loeschen; er kommt hier nicht
    /// heraus, weil ihn niemand ausserhalb braucht.
    /// </summary>
    internal static async Task<Guid> InsertHeldRoleAsync(
        SqlConnection connection, SqlTransaction tx, Guid holderRoleId, byte[] holderKey,
        RcRoleIdentity holder, Guid tenantId, string kind, string displayName, CancellationToken ct)
    {
        var newRoleId = RcId.NewId();
        var newRoleKey = RcRoleKeys.NewRoleKey();
        var created = RcRoleKeys.Create(newRoleId, newRoleKey);

        using var holderSign = RcRoleKeys.OpenSignKey(holder, holderKey);

        var edge = new RcRoleEdgeRecord
        {
            Id = RcId.NewId(),
            FromRoleId = holderRoleId,
            ToRoleId = newRoleId,
            EdgeKind = RcEdgeKinds.Holds,
            SignerRoleId = holderRoleId,
            CreatedUtc = DateTimeOffset.UtcNow
        };

        var displayNameSealed = SealDisplayName(newRoleId, newRoleKey, displayName);
        var grant = RcRoleKeys.GrantTo(holder.WrapPublicKey, newRoleId, newRoleKey);

        // 3.14 — innerhalb der Transaktion, damit zwischen Pruefung und
        // Einfuegen keine zweite Kante den Kreis schliessen kann.
        await RcPermissions.AssertNoCycleAsync(connection, tx, holderRoleId, newRoleId, ct);

        await InsertRoleAsync(connection, tx, created, tenantId, kind, displayNameSealed, ct);
        await InsertEdgeAsync(connection, tx, edge, edge.Sign(holderSign), ct);
        await InsertGrantAsync(connection, tx, holderRoleId, newRoleId, grant, holderRoleId, ct);

        CryptographicOperations.ZeroMemory(newRoleKey);
        return newRoleId;
    }

    private static async Task InsertRoleAsync(
        SqlConnection connection, SqlTransaction? tx, RcRoleIdentity role, Guid tenantId,
        string kind, byte[] displayNameSealed, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO dbo.rc_role
                (id, tenant_id, kind, display_name_sealed, sign_public_key, wrap_public_key,
                 sign_private_sealed, wrap_private_sealed, key_fingerprint, key_version, created_at)
            VALUES
                (@id, @tenant, @kind, @name, @signPub, @wrapPub, @signPriv, @wrapPriv, @fp, @ver, @now);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", role.RoleId);
        cmd.Parameters.AddWithValue("@tenant", tenantId);
        cmd.Parameters.AddWithValue("@kind", kind);
        cmd.Parameters.AddWithValue("@name", displayNameSealed);
        cmd.Parameters.AddWithValue("@signPub", role.SignPublicKey);
        cmd.Parameters.AddWithValue("@wrapPub", role.WrapPublicKey);
        cmd.Parameters.AddWithValue("@signPriv", role.SignPrivateSealed);
        cmd.Parameters.AddWithValue("@wrapPriv", role.WrapPrivateSealed);
        cmd.Parameters.AddWithValue("@fp", role.Fingerprint);
        cmd.Parameters.AddWithValue("@ver", role.KeyVersion);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    internal static async Task InsertEdgeAsync(
        SqlConnection connection, SqlTransaction? tx, RcRoleEdgeRecord edge, byte[] signature, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO dbo.rc_role_edge
                (id, from_role_id, from_account_id, to_role_id, edge_kind, created_at, expires_at,
                 signature, signer_role_id)
            VALUES
                (@id, @fromRole, @fromAccount, @to, @kind, @created, @expires, @sig, @signer);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", edge.Id);
        cmd.Parameters.AddWithValue("@fromRole", (object?)edge.FromRoleId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@fromAccount", (object?)edge.FromAccountId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@to", edge.ToRoleId);
        cmd.Parameters.AddWithValue("@kind", edge.EdgeKind);
        cmd.Parameters.AddWithValue("@created", edge.CreatedUtc);
        cmd.Parameters.AddWithValue("@expires", (object?)edge.ExpiresUtc ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@sig", signature);
        cmd.Parameters.AddWithValue("@signer", edge.SignerRoleId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    internal static async Task InsertGrantAsync(
        SqlConnection connection, SqlTransaction? tx, Guid holderRoleId, Guid grantedRoleId,
        byte[] sealedBlob, Guid grantedByRoleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO dbo.rc_role_key_grant
                (id, role_id, key_kind, key_ref, sealed_blob, granted_by_role_id, granted_at)
            VALUES
                (@id, @role, @kind, @ref, @blob, @by, @now);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", RcId.NewId());
        cmd.Parameters.AddWithValue("@role", holderRoleId);
        cmd.Parameters.AddWithValue("@kind", RcGrantKinds.RoleKey);
        cmd.Parameters.AddWithValue("@ref", grantedRoleId);
        cmd.Parameters.AddWithValue("@blob", sealedBlob);
        cmd.Parameters.AddWithValue("@by", grantedByRoleId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    internal static async Task InsertCertificateAsync(
        SqlConnection connection, SqlTransaction? tx, RcCertificateRecord c, byte[] signature, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO dbo.rc_certificate
                (id, subject_role_id, scope_kind, scope_id, capability, issued_by_role_id,
                 issued_at, expires_at, signature)
            VALUES
                (@id, @subject, @scopeKind, @scopeId, @cap, @by, @issued, @expires, @sig);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", c.Id);
        cmd.Parameters.AddWithValue("@subject", c.SubjectRoleId);
        cmd.Parameters.AddWithValue("@scopeKind", RcCapabilities.ScopeText(c.ScopeKind));
        cmd.Parameters.AddWithValue("@scopeId", c.ScopeId);
        cmd.Parameters.AddWithValue("@cap", RcCapabilities.ToText(c.Capability));
        cmd.Parameters.AddWithValue("@by", c.IssuedByRoleId);
        cmd.Parameters.AddWithValue("@issued", c.IssuedUtc);
        cmd.Parameters.AddWithValue("@expires", c.ExpiresUtc);
        cmd.Parameters.AddWithValue("@sig", signature);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    // -- Kleinkram ------------------------------------------------------------

    /// <summary>
    /// 9.13.2 — Der Anzeigename liegt beim Eigentuemer und ist verschluesselt.
    /// Wer die Rolle erreicht, erreicht auch ihren Namen; wer sie nicht
    /// erreicht, sieht eine Rolle ohne Namen. Das ist die richtige Reihenfolge:
    /// die Struktur ist offen (3.14), der Name ist es nicht.
    /// </summary>
    private static byte[] SealDisplayName(Guid roleId, byte[] roleKey, string name) =>
        RcCrypto.Seal(roleKey, DisplayNameAad(roleId), System.Text.Encoding.UTF8.GetBytes(name.Trim()));

    internal static string OpenDisplayName(Guid roleId, byte[] roleKey, byte[] sealedName) =>
        System.Text.Encoding.UTF8.GetString(RcCrypto.Open(roleKey, DisplayNameAad(roleId), sealedName));

    private static RcAad DisplayNameAad(Guid roleId) =>
        RcAad.Create("kernel", "role", roleId, RcField.RoleDisplayName, 1);

    internal static async Task<Dictionary<Guid, byte[]>> LoadDisplayNamesAsync(
        SqlConnection connection, IReadOnlyList<Guid> roleIds, CancellationToken ct)
    {
        if (roleIds.Count == 0) return [];

        var names = string.Join(", ", roleIds.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand(
            $"SELECT id, display_name_sealed FROM dbo.rc_role WHERE id IN ({names});", connection);
        for (var i = 0; i < roleIds.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", roleIds[i]);

        var map = new Dictionary<Guid, byte[]>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) map[reader.GetGuid(0)] = (byte[])reader[1];
        return map;
    }

    /// <summary><c>Guid.Empty</c>, wenn es die Rolle nicht gibt — die Kennung selbst ist nie leer (UUIDv7).</summary>
    private static async Task<Guid> TenantOfAsync(SqlConnection connection, Guid roleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT tenant_id FROM dbo.rc_role WHERE id = @id AND revoked_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", roleId);
        return await cmd.ExecuteScalarAsync(ct) is Guid tenant ? tenant : Guid.Empty;
    }

    private static Task Unauthenticated(HttpContext ctx) =>
        RcResults.WriteErrorAsync(ctx, StatusCodes.Status401Unauthorized,
            RcErrorCodes.SessionExpired, "Dafuer musst du angemeldet sein.");
}

/// <summary>3.1 — Nur vom Modul interpretiert, nie vom Kernel.</summary>
public static class RcEdgeKinds
{
    public const string Holds = "holds";
    public const string Inherits = "inherits";

    /// <summary>Traegt Kapitel 4. Der Kernel weiss davon nichts.</summary>
    public const string Supervises = "supervises";
}

public sealed record RcFoundation(Guid TenantId, Guid PersonalRoleId, IReadOnlyList<Guid> CertificateIds);
