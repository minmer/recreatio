using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Kapitel 9 — Bereiche und ihre Mitglieder.
///
/// <b>Mitgliedschaft ist kein eigener Begriff.</b> Sie ist ein Zertifikat mit
/// <c>scope_kind = 'area'</c>. Es gibt keine Mitgliedertabelle, die mit den
/// Berechtigungen auseinanderlaufen koennte — die Frage „darf er hier lesen"
/// und die Frage „ist er Mitglied" sind dieselbe Frage, und sie hat genau eine
/// Antwortquelle.
///
/// Dazu kommt der Schluessel: wer Mitglied ist, hat eine Zuteilung des
/// Epochenschluessels (<see cref="RcAreaKeys"/>). Zertifikat ohne Schluessel
/// waere ein Versprechen ohne Deckung, Schluessel ohne Zertifikat eine
/// Berechtigung, die niemand vergeben hat. Beide entstehen deshalb IMMER
/// zusammen, in einer Transaktion.
/// </summary>
public static class RcAreas
{
    public static readonly TimeSpan MembershipLife = TimeSpan.FromDays(365 * 2);

    public static void MapRcAreas(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/areas", ListAsync).Produces<RcAreasResponse>();
        app.MapPost("/rc/areas", CreateAsync).Produces<RcAreaCreatedResponse>();
        app.MapGet("/rc/areas/{id:guid}/members", MembersAsync).Produces<RcMembersResponse>();
        app.MapPost("/rc/areas/{id:guid}/members", AddMemberAsync).Produces<RcMemberAddedResponse>();
        app.MapPost("/rc/areas/{id:guid}/members/{roleId:guid}/remove", RemoveMemberAsync).Produces<RcMemberRemovedResponse>();
    }

    // -- Anlegen --------------------------------------------------------------

    public sealed record CreateAreaRequest(string OwnerRoleId, string Title, bool? IsPublic);

    /// <summary>
    /// Ein Bereich entsteht mit: Epoche 1, deren Schluessel, und zwei
    /// Zertifikaten fuer den Anlegenden (<c>admin</c> und <c>certify</c>). Ohne
    /// <c>certify</c> koennte er niemanden hineinlassen — und ein Bereich, in
    /// den niemand kommt, ist ein teures Nichts.
    /// </summary>
    private static async Task CreateAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, CreateAreaRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.OwnerRoleId, out var ownerRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der Rolle ist unlesbar.");
            return;
        }

        var title = body.Title?.Trim() ?? "";
        if (title.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Ein Bereich braucht einen Namen.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var tenantId = await TenantOfRoleAsync(connection, ownerRoleId, ctx.RequestAborted);
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
                RcErrorCodes.PermissionDenied, "Hier darfst du keinen Bereich anlegen.");
            return;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var ownerKey = await RcRoleAccess.RoleKeyAsync(
            connection, session.AccountId, held.MasterKey, ownerRoleId, ctx.RequestAborted);

        if (ownerKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Diese Rolle steht dir nicht zur Verfuegung.");
            return;
        }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [ownerRoleId], ctx.RequestAborted);
        if (!identities.TryGetValue(ownerRoleId, out var owner))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        Guid areaId;
        await using (var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted))
        {
            try
            {
                areaId = await InsertAreaAsync(connection, tx, ownerRoleId, ownerKey, owner,
                    tenantId, title, body.IsPublic == true, ctx.RequestAborted);
                await tx.CommitAsync(ctx.RequestAborted);
            }
            catch
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                throw;
            }
        }

        await RcResults.WriteJsonAsync(ctx, new RcAreaCreatedResponse(
            RcId.ToText(areaId), RcId.ToText(tenantId), 1, title), StatusCodes.Status201Created);
    }

    /// <summary>
    /// Ein Bereich, angelegt IN einer fremden Transaktion.
    ///
    /// <b>Warum das herausgeloest ist.</b> Eine Pfarrei braucht einen Bereich,
    /// und der Browser hat ihn eine Zeit lang selbst angelegt: erst
    /// <c>POST /rc/areas</c>, dann <c>POST /rc/parishes</c>. Scheiterte der
    /// zweite Aufruf — an einem nicht vorgesehenen Namen zum Beispiel —, blieb
    /// der Bereich stehen. Bei vier Anlaeufen standen vier davon herum, alle
    /// gleich benannt, und keiner gehoerte zu irgendetwas.
    ///
    /// Zwei Aufrufe, die zusammengehoeren, gehoeren in EINE Transaktion. Der
    /// Browser kann das nicht: zwischen zwei Anfragen gibt es kein Zurueck.
    ///
    /// Verwaltet KEINE Transaktion und faengt nichts ab — der Aufrufer haelt
    /// beides. Ein Fehler hier rollt alles zurueck, auch die Pfarrei.
    /// </summary>
    /// <param name="alsoAdmin">
    /// Eine zweite Rolle, die von Anfang an <c>admin</c> auf diesem Bereich
    /// hat — bei einer Pfarrei das Amt, das sie verwaltet.
    ///
    /// <b>Warum sie HIER hineingereicht wird</b> und nicht danach aufgenommen:
    /// die Epoche wird einmal geschnitten, und wer beim Schnitt Mitglied ist,
    /// bekommt den Schluessel. Nachtraeglich aufnehmen hiesse, sofort eine
    /// zweite Epoche zu schneiden — zwei Schluessel und zwei Kettenzeilen fuer
    /// einen Bereich, der eine Sekunde alt ist.
    /// </param>
    internal static async Task<Guid> InsertAreaAsync(
        SqlConnection connection, SqlTransaction tx, Guid ownerRoleId, byte[] ownerKey,
        RcRoleIdentity owner, Guid tenantId, string title, bool isPublic, CancellationToken ct,
        Guid? alsoAdmin = null)
    {
        var areaId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;
        using var ownerSign = RcRoleKeys.OpenSignKey(owner, ownerKey);

        // Der Bereich braucht seinen Schluessel, BEVOR er seinen Titel hat —
        // der Titel liegt darunter (9.13). Deshalb entsteht der Schluessel hier
        // und wird unten an CutEpochAsync weitergereicht; erzeugte ihn jede
        // Seite fuer sich, waere der Titel unter einem Schluessel versiegelt,
        // den niemand bekommt.
        var epochKey = RcCrypto.NewSymmetricKey();
        var titleSealed = RcCrypto.Seal(epochKey, TitleAad(areaId), Encoding.UTF8.GetBytes(title));

        await using (var insert = new SqlCommand("""
            INSERT INTO dbo.rc_area (id, tenant_id, title_sealed, ledger_id, current_epoch, is_public, created_at)
            VALUES (@id, @tenant, @title, @ledger, 1, @public, @now);
            """, connection, tx))
        {
            insert.Parameters.AddWithValue("@id", areaId);
            insert.Parameters.AddWithValue("@tenant", tenantId);
            insert.Parameters.AddWithValue("@title", titleSealed);

            // 7.8 — Die Kettenkennung ist der NAME der Kette, nicht ein Verweis
            // auf eine Zeile. Sie steht ab der Geburt fest, auch solange noch
            // kein Eintrag geschrieben wird.
            insert.Parameters.AddWithValue("@ledger", RcId.NewId());
            insert.Parameters.AddWithValue("@public", isPublic);
            insert.Parameters.AddWithValue("@now", now);
            await insert.ExecuteNonQueryAsync(ct);
        }

        // Zertifikate ZUERST: CutEpochAsync liest die Mitglieder aus genau
        // diesen Zeilen. Andersherum bekaeme der Anlegende keinen Schluessel
        // fuer seinen eigenen Bereich.
        foreach (var capability in new[] { RcCapability.Admin, RcCapability.Certify })
        {
            var certificate = new RcCertificateRecord
            {
                Id = RcId.NewId(),
                SubjectRoleId = ownerRoleId,
                ScopeKind = RcScopeKind.Area,
                ScopeId = areaId,
                Capability = capability,
                IssuedByRoleId = ownerRoleId,
                IssuedUtc = now,
                ExpiresUtc = now + MembershipLife
            };
            await RcRoles.InsertCertificateAsync(connection, tx, certificate, certificate.Sign(ownerSign), ct);
        }

        // Die zweite Rolle bekommt ihr Zertifikat VOR dem Schnitt, aus
        // demselben Grund wie der Eigentuemer: MembersAsync liest genau diese
        // Zeilen, und wer dann nicht dasteht, bekommt keinen Schluessel.
        if (alsoAdmin is Guid second && second != ownerRoleId)
        {
            var certificate = new RcCertificateRecord
            {
                Id = RcId.NewId(),
                SubjectRoleId = second,
                ScopeKind = RcScopeKind.Area,
                ScopeId = areaId,
                Capability = RcCapability.Admin,
                IssuedByRoleId = ownerRoleId,
                IssuedUtc = now,
                ExpiresUtc = now + MembershipLife
            };
            await RcRoles.InsertCertificateAsync(connection, tx, certificate, certificate.Sign(ownerSign), ct);
        }

        var members = await RcAreaKeys.MembersAsync(connection, tx, areaId, ct);
        try
        {
            await RcAreaKeys.CutEpochAsync(connection, tx, areaId, RcAreaKeys.ReasonInitial,
                members, ownerRoleId, epochKey, ct);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(epochKey);
        }

        return areaId;
    }

    // -- Anzeigen -------------------------------------------------------------

    /// <summary>
    /// <paramref name="LedgerId"/> ist der Weg zur Kette dieses Bereichs.
    ///
    /// Ohne ihn kaeme die Oberflaeche gar nicht an das Protokoll heran: die
    /// Kennung steht nur in der Zeile des Bereichs, und es gibt keinen zweiten
    /// Weg, sie zu erfahren. Ein Beweis, den man nicht aufrufen kann, ueberzeugt
    /// niemanden — und genau dafuer ist er da.
    /// </summary>
    /// <summary>
    /// <paramref name="CanCertify"/> heisst: darf andere hineinbitten.
    ///
    /// Aus demselben Grund wie <paramref name="CanWrite"/>: eine Oberflaeche,
    /// die "Jemanden einladen" jedem zeigt, verspricht etwas, das der Dienst
    /// den meisten Lesern verweigert. Ein Knopf, der zuverlaessig mit einer
    /// Absage endet, sieht aus wie eine Befugnis.
    /// </summary>
    public sealed record AreaView(
        string AreaId, string? Title, int CurrentEpoch, string Lifecycle, bool IsPublic,
        int ReadableEpochs, bool CanWrite, string LedgerId, bool CanCertify);

    private static async Task ListAsync(HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var reachable = await RcPermissions.ReachableRolesAsync(connection, session.AccountId, ctx.RequestAborted);
        if (reachable.Count == 0)
        {
            await RcResults.WriteJsonAsync(ctx, new RcAreasResponse([]));
            return;
        }

        var names = string.Join(", ", reachable.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT DISTINCT a.id, a.title_sealed, a.current_epoch, a.lifecycle, a.is_public, a.ledger_id
            FROM dbo.rc_area a
            JOIN dbo.rc_certificate c
              ON c.scope_kind = 'area' AND c.scope_id = a.id
             AND c.revoked_at IS NULL AND c.expires_at > @now
            WHERE c.subject_role_id IN ({names})
            ORDER BY a.id;
            """, connection);

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        for (var i = 0; i < reachable.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", reachable[i].RoleId);

        var rows = new List<(Guid Id, byte[] Title, int Epoch, string Lifecycle, bool IsPublic, Guid Ledger)>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
                rows.Add((reader.GetGuid(0), (byte[])reader[1], reader.GetInt32(2),
                    reader.GetString(3), reader.GetBoolean(4), reader.GetGuid(5)));
        }

        var views = new List<AreaView>();
        foreach (var row in rows)
        {
            var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey, row.Id, ctx.RequestAborted);

            // Der Titel liegt unter dem Schluessel der ERSTEN Epoche, die man
            // hat — er wandert bei einem Schnitt nicht mit, weil er sich nicht
            // aendert.
            string? title = null;
            foreach (var key in keys.OrderBy(k => k.Key).Select(k => k.Value))
            {
                try { title = Encoding.UTF8.GetString(RcCrypto.Open(key, TitleAad(row.Id), row.Title)); break; }
                catch (RcDecryptException) { /* naechste Epoche versuchen */ }
            }

            var mayWrite = await permissions.CheckAsync(
                session.AccountId, RcScopeKind.Area, row.Id, RcCapability.Write, ctx.RequestAborted);

            var mayCertify = await permissions.CheckAsync(
                session.AccountId, RcScopeKind.Area, row.Id, RcCapability.Certify, ctx.RequestAborted);

            views.Add(new AreaView(RcId.ToText(row.Id), title, row.Epoch, row.Lifecycle, row.IsPublic,
                keys.Count, mayWrite.Allowed, RcId.ToText(row.Ledger), mayCertify.Allowed));
        }

        await RcResults.WriteJsonAsync(ctx, new RcAreasResponse(views));
    }

    public sealed record MemberView(string RoleId, string Capability, DateTimeOffset ExpiresUtc, int EpochGrants);

    private static async Task MembersAsync(HttpContext ctx, RcDb db, RcPermissions permissions, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id, RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand("""
            SELECT c.subject_role_id, MAX(c.capability), MAX(c.expires_at),
                   (SELECT COUNT(*) FROM dbo.rc_role_key_grant g
                    WHERE g.role_id = c.subject_role_id AND g.key_kind = 'epoch'
                      AND g.key_ref = @area AND g.destroyed_at IS NULL)
            FROM dbo.rc_certificate c
            WHERE c.scope_kind = 'area' AND c.scope_id = @area
              AND c.revoked_at IS NULL AND c.expires_at > @now
            GROUP BY c.subject_role_id;
            """, connection);

        cmd.Parameters.AddWithValue("@area", id);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        var list = new List<MemberView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            list.Add(new MemberView(RcId.ToText(reader.GetGuid(0)), reader.GetString(1),
                reader.GetDateTimeOffset(2), reader.GetInt32(3)));
        }

        await RcResults.WriteJsonAsync(ctx, new RcMembersResponse(list));
    }

    // -- Aufnehmen ------------------------------------------------------------

    public sealed record AddMemberRequest(string RoleId, string? Capability, bool? GrantHistory);

    /// <summary>
    /// <b>Die Entscheidung, die hier faellt:</b> darf der Neue die Vergangenheit
    /// lesen?
    ///
    ///   <c>grantHistory = true</c> — er bekommt ALLE bisherigen
    ///   Epochenschluessel und liest den Bereich von Anfang an.
    ///
    ///   <c>grantHistory = false</c> (Vorgabe) — es wird eine NEUE Epoche
    ///   geschnitten, und er bekommt nur diese. Was vorher gesagt wurde, bleibt
    ///   ihm verschlossen.
    ///
    /// Die Vorgabe ist die zurueckhaltende: wer jemanden aufnimmt, entscheidet
    /// damit nicht nebenbei ueber Gespraeche, an denen andere beteiligt waren
    /// und die sie im Vertrauen auf einen bestimmten Kreis gefuehrt haben.
    /// </summary>
    private static async Task AddMemberAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, AddMemberRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.RoleId, out var newRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der Rolle ist unlesbar.");
            return;
        }

        var capability = RcCapability.Write;
        if (body.Capability is not null && !RcCapabilities.TryParse(body.Capability, out capability))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Stufe gibt es nicht.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id, RcCapability.Certify, ctx.RequestAborted);
        if (!may.Allowed)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Hier darfst du niemanden aufnehmen.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var issuerRoleId = may.Via!.Value;
        using var issuerSign = await RcRoleAccess.OpenSignKeyAsync(
            connection, session.AccountId, held.MasterKey, issuerRoleId, ctx.RequestAborted);

        if (issuerSign is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Im Namen dieser Rolle kannst du nicht aufnehmen.");
            return;
        }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [newRoleId], ctx.RequestAborted);
        if (!identities.TryGetValue(newRoleId, out var newMember))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        var grantHistory = body.GrantHistory == true;
        var existingKeys = grantHistory
            ? await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey, id, ctx.RequestAborted)
            : [];

        var now = DateTimeOffset.UtcNow;
        int epoch;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
        try
        {
            var certificate = new RcCertificateRecord
            {
                Id = RcId.NewId(),
                SubjectRoleId = newRoleId,
                ScopeKind = RcScopeKind.Area,
                ScopeId = id,
                Capability = capability,
                IssuedByRoleId = issuerRoleId,
                IssuedUtc = now,
                ExpiresUtc = now + MembershipLife
            };
            await RcRoles.InsertCertificateAsync(connection, tx, certificate, certificate.Sign(issuerSign), ctx.RequestAborted);

            if (grantHistory)
            {
                foreach (var (existingEpoch, key) in existingKeys)
                {
                    await RcAreaKeys.GrantAsync(connection, tx, newRoleId, id, existingEpoch, key,
                        newMember.WrapPublicKey, issuerRoleId, ctx.RequestAborted);
                }
                epoch = existingKeys.Count == 0 ? 0 : existingKeys.Keys.Max();
            }
            else
            {
                var members = await RcAreaKeys.MembersAsync(connection, tx, id, ctx.RequestAborted);
                epoch = await RcAreaKeys.CutEpochAsync(connection, tx, id, RcAreaKeys.ReasonMemberAdded,
                    members, issuerRoleId, null, ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await RcResults.WriteJsonAsync(ctx, new RcMemberAddedResponse(
                RcId.ToText(newRoleId), AlreadyMember: true));
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new RcMemberAddedResponse(
            RcId.ToText(newRoleId), RcCapabilities.ToText(capability), epoch, grantHistory),
            StatusCodes.Status201Created);
    }

    // -- Entfernen ------------------------------------------------------------

    /// <summary>
    /// Der Schnitt. Drei Dinge, und keines genuegt allein:
    ///
    ///   1. Zertifikate zuruecknehmen — er darf nicht mehr.
    ///   2. Epochenschluessel vernichten (12.3.2, mit Protokoll) — er kann
    ///      serverseitig nichts mehr aufmachen.
    ///   3. Neue Epoche schneiden — was ab jetzt geschrieben wird, ist ihm
    ///      auch dann verschlossen, wenn er sich eine Kopie des alten
    ///      Schluessels gemacht hat.
    ///
    /// Punkt 3 ist der einzige, der wirklich traegt. Die ersten beiden wirken
    /// nur gegen jemanden, der sich an die Spielregeln haelt; der dritte wirkt
    /// gegen jeden.
    ///
    /// Was er gelesen HAT, behaelt er. Das laesst sich nicht zurueckholen, und
    /// so zu tun als ginge es waere die eigentliche Unehrlichkeit.
    /// </summary>
    private static async Task RemoveMemberAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions, Guid id, Guid roleId)
    {
        var session = ctx.RcSession();
        if (session is null) { await Unauthenticated(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, id, RcCapability.Certify, ctx.RequestAborted);
        if (!may.Allowed)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Hier darfst du niemanden entfernen.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var issuerRoleId = may.Via!.Value;
        int epoch;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
        try
        {
            await using (var revoke = new SqlCommand("""
                UPDATE dbo.rc_certificate SET revoked_at = @now
                WHERE scope_kind = 'area' AND scope_id = @area AND subject_role_id = @role AND revoked_at IS NULL;
                """, connection, tx))
            {
                revoke.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
                revoke.Parameters.AddWithValue("@area", id);
                revoke.Parameters.AddWithValue("@role", roleId);
                await revoke.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await RcAreaKeys.DestroyGrantsAsync(connection, tx, roleId, id, "member_left", ctx.RequestAborted);

            // Die Mitgliederliste wird NACH dem Widerruf gelesen. Der Entfernte
            // steht nicht mehr darin und bekommt deshalb keine Zuteilung — das
            // ist der ganze Mechanismus.
            var members = await RcAreaKeys.MembersAsync(connection, tx, id, ctx.RequestAborted);
            epoch = await RcAreaKeys.CutEpochAsync(connection, tx, id, RcAreaKeys.ReasonMemberLeft,
                members, issuerRoleId, null, ctx.RequestAborted);

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await RcResults.WriteJsonAsync(ctx, new RcMemberRemovedResponse(
            RcId.ToText(roleId), epoch, KeptWhatTheyRead: true));
    }

    // -- Gemeinsames ----------------------------------------------------------

    /// <summary>
    /// Die Titel mehrerer Bereiche auf einmal oeffnen.
    ///
    /// Der Titel liegt unter dem Schluessel der ERSTEN Epoche, die man hat —
    /// er wandert bei einem Schnitt nicht mit, weil er sich nicht aendert.
    ///
    /// Wo kein Schluessel da ist, fehlt der Eintrag. Das ist kein Fehler: dass
    /// ein Bereich DA ist, gehoert zur Auskunft, auch wenn sein Name nicht zu
    /// lesen ist.
    /// </summary>
    internal static async Task<Dictionary<Guid, string>> OpenTitlesAsync(
        SqlConnection connection, Guid accountId, byte[] masterKey,
        IReadOnlyList<Guid> areaIds, CancellationToken ct)
    {
        var found = new Dictionary<Guid, string>();
        if (areaIds.Count == 0) return found;

        var names = string.Join(", ", areaIds.Select((_, i) => $"@a{i}"));
        await using var cmd = new SqlCommand(
            $"SELECT id, title_sealed FROM dbo.rc_area WHERE id IN ({names});", connection);
        for (var i = 0; i < areaIds.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", areaIds[i]);

        var rows = new List<(Guid Id, byte[] Title)>();
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct)) rows.Add((reader.GetGuid(0), (byte[])reader[1]));
        }

        foreach (var row in rows)
        {
            var keys = await RcAreaKeys.EpochKeysAsync(connection, accountId, masterKey, row.Id, ct);
            foreach (var key in keys.OrderBy(k => k.Key).Select(k => k.Value))
            {
                try
                {
                    found[row.Id] = Encoding.UTF8.GetString(RcCrypto.Open(key, TitleAad(row.Id), row.Title));
                    break;
                }
                catch (RcDecryptException) { /* naechste Epoche versuchen */ }
            }
        }

        return found;
    }

    internal static RcAad TitleAad(Guid areaId) =>
        RcAad.Create("chat", "area", areaId, RcField.AreaTitle, 1);

    internal static async Task<Guid> TenantOfRoleAsync(SqlConnection connection, Guid roleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT tenant_id FROM dbo.rc_role WHERE id = @id AND revoked_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", roleId);
        return await cmd.ExecuteScalarAsync(ct) is Guid tenant ? tenant : Guid.Empty;
    }

    /// <summary>
    /// Hier ist gar keine Sitzung angekommen.
    ///
    /// <b>Nicht dasselbe wie „abgelaufen".</b> Abgelaufen sagt die
    /// Sitzungspruefung selbst, mit eigenem Code — sie hat die Zeile in der
    /// Datenbank gesehen. Hier ist nichts angekommen: kein Cookie, oder eines,
    /// das sich nicht oeffnen liess.
    ///
    /// Beides trug frueher denselben Code, und von aussen war nicht zu sehen,
    /// welches von beiden vorlag. Genau daran haengt aber, was zu tun ist.
    /// </summary>
    internal static Task Unauthenticated(HttpContext ctx) =>
        RcResults.WriteErrorAsync(ctx, StatusCodes.Status401Unauthorized,
            RcErrorCodes.NotSignedIn, "Dafuer musst du angemeldet sein.");

    /// <summary>
    /// „Darfst du nicht" und „gibt es nicht" bekommen dieselbe Antwort. Sonst
    /// waere die Fehlermeldung ein Verzeichnis aller Bereiche.
    /// </summary>
    internal static Task NotForYou(HttpContext ctx) =>
        RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
            RcErrorCodes.PermissionDenied, "Diesen Bereich gibt es nicht.");
}
