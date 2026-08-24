using System.Security.Cryptography;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Kapitel 8 — Wiederherstellung. Der gefaehrlichste Teil der Plattform.
///
/// <b>Warum es ihn geben muss.</b> Der Wurzelschluessel liegt nur unter EINEM
/// Passwort. Wer es vergisst, verliert alles — nicht „gesperrt", sondern fort.
/// Ohne Wiederherstellung waere die Plattform fuer eine Pfarrgemeinde
/// unbrauchbar: irgendwer vergisst immer.
///
/// <b>Warum er gefaehrlich ist.</b> Was einen Vergesslichen hereinlaesst,
/// laesst auch einen Fremden herein. Jede Wiederherstellung ist der Bau einer
/// zweiten Tuer neben der, die man sorgfaeltig verschlossen hat.
///
/// <b>Vier Riegel, und keiner davon genuegt allein:</b>
///
/// <code>
///   1. Schwellwert >= 2      Kein einzelner Buerge kommt allein hinein.
///                            Erzwungen von ck_rc_recovery_share_threshold.
///
///   2. Karenzzeit            Zwischen Antrag und Wirksamkeit liegen 0 bis 30
///                            Tage. In dieser Zeit kann widersprochen werden.
///
///   3. Widerspruch           Wer sich noch anmelden kann, sieht den Antrag
///                            und stoppt ihn. Das ist der Schutz gegen einen
///                            Fremden, der die Buergen ueberredet.
///
///   4. Ketteneintrag         PFLICHT (ledger_entry_id NOT NULL). Eine
///                            Wiederherstellung kann nicht unbemerkt
///                            geschehen — auch nicht durch den Betreiber.
/// </code>
///
/// <b>Die Karenzzeit ist eine Waage, kein Regler.</b> Null Tage heisst: sofort
/// wieder hereinkommen, aber auch sofort ausgesperrt werden koennen. Dreissig
/// Tage heisst: ein Fremder braucht einen Monat unbemerkt — und man selbst
/// wartet einen Monat. Der Hinweistext MUSS beide Enden nennen (8.3); ein Text,
/// der nur den Schutz erwaehnt, verkauft eine Falle als Vorzug.
/// </summary>
public static class RcRecovery
{
    public static void MapRcRecovery(this IEndpointRouteBuilder app)
    {
        app.MapPost("/rc/recovery/shares", CreateSharesAsync);
        app.MapGet("/rc/recovery/shares", ListSharesAsync);
        app.MapPost("/rc/recovery/requests", RequestAsync);
        app.MapGet("/rc/recovery/requests", ListRequestsAsync);
        app.MapPost("/rc/recovery/requests/{id:guid}/object", ObjectAsync);
        app.MapPost("/rc/recovery/requests/{id:guid}/contribute", ContributeAsync);
        app.MapPost("/rc/recovery/requests/{id:guid}/complete", CompleteAsync);
    }

    // -- Beitragen ------------------------------------------------------------

    public sealed record ContributeRequest(string GuarantorRoleId);

    /// <summary>
    /// <b>BEFUND 45 — der Schritt, der den Schwellwert erst wirksam macht.</b>
    ///
    /// Ein Anteil geht nur mit dem Schluessel SEINES Buergen auf. Verlangte man,
    /// dass ein einziger Aufruf alle noetigen Anteile oeffnet, brauchte es eine
    /// Person, die mehrere persoenliche Rollen haelt — die gibt es nicht, und
    /// die Wiederherstellung waere nie vollziehbar.
    ///
    /// Also traegt jeder Buerge einzeln bei: er oeffnet seinen Anteil mit
    /// seinem Schluessel und verpackt ihn neu fuer den Antragsteller. Erst wenn
    /// genug Beitraege da sind, kann dieser vollziehen.
    ///
    /// Damit verlangt der Schwellwert wieder das, was er verlangen soll:
    /// <b>mehrere Menschen, die sich jeder fuer sich anmelden und jeder fuer
    /// sich zustimmen.</b>
    /// </summary>
    private static async Task ContributeAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, Guid id, ContributeRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.GuarantorRoleId, out var guarantorRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Die Kennung der Rolle ist unlesbar.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var request = await LoadRequestAsync(connection, id, ctx.RequestAborted);
        if (request is null) { await NotFound(ctx); return; }

        if (request.ObjectedUtc is not null || request.CompletedUtc is not null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Dieser Antrag nimmt keine Beitraege mehr an.");
            return;
        }

        var targetAccountId = await AccountOfPersonalRoleAsync(connection, request.TargetRoleId, ctx.RequestAborted);
        if (targetAccountId == Guid.Empty) { await NotFound(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var mine = await RcRoleAccess.AllRoleKeysAsync(connection, session.AccountId, held.MasterKey, ctx.RequestAborted);

        if (!mine.ContainsKey(guarantorRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Beitragen kann nur, wem der Anteil gehoert.");
            return;
        }

        var (opened, _) = await OpenSharesAsync(connection, targetAccountId, [guarantorRoleId], mine, ctx.RequestAborted);
        if (opened.Count == 0)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Fuer dieses Konto haeltst du keinen Anteil.");
            return;
        }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [request.RequestedByRoleId], ctx.RequestAborted);
        if (!identities.TryGetValue(request.RequestedByRoleId, out var requester))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Den Antragsteller gibt es nicht mehr.");
            return;
        }

        var contributionId = RcId.NewId();
        var payload = new byte[1 + opened[0].Y.Length];
        payload[0] = opened[0].X;
        opened[0].Y.CopyTo(payload, 1);

        try
        {
            using var rsa = RSA.Create();
            rsa.ImportSubjectPublicKeyInfo(requester.WrapPublicKey, out _);
            var resealed = RcCrypto.WrapKey(rsa, ContributionAad(contributionId), payload);

            await using var insert = new SqlCommand("""
                INSERT INTO dbo.rc_recovery_contribution
                    (id, request_id, guarantor_role_id, share_resealed, contributed_at)
                VALUES (@id, @request, @guarantor, @share, @now);
                """, connection);

            insert.Parameters.AddWithValue("@id", contributionId);
            insert.Parameters.AddWithValue("@request", id);
            insert.Parameters.AddWithValue("@guarantor", guarantorRoleId);
            insert.Parameters.AddWithValue("@share", resealed);
            insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            // Ein Buerge zaehlt einmal. Sonst erreichte einer allein den
            // Schwellwert, indem er denselben Anteil mehrfach einreicht.
            await RcResults.WriteJsonAsync(ctx, new
            {
                requestId = RcId.ToText(id), alreadyContributed = true
            });
            return;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(payload);
            foreach (var share in opened) CryptographicOperations.ZeroMemory(share.Y);
        }

        var (have, need) = await ContributionCountAsync(connection, id, targetAccountId, ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new
        {
            requestId = RcId.ToText(id),
            contributions = have,
            threshold = need,
            enough = have >= need
        }, StatusCodes.Status201Created);
    }

    // -- Anteile hinterlegen --------------------------------------------------

    public sealed record CreateSharesRequest(string[] GuarantorRoleIds, int? Threshold);

    /// <summary>
    /// Der Besitzer teilt seinen Wurzelschluessel und legt die Anteile bei
    /// Buergen ab. Er muss dafuer entsperrt sein — niemand sonst kann das tun,
    /// und das ist der Punkt.
    ///
    /// Jeder Anteil wird unter dem oeffentlichen Verpackungsschluessel seines
    /// Buergen versiegelt: der Betreiber sieht Huellen, die er nicht oeffnen
    /// kann, und die Buergen sehen nur ihren eigenen Anteil.
    /// </summary>
    private static async Task CreateSharesAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, CreateSharesRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var guarantorIds = (body.GuarantorRoleIds ?? [])
            .Select(s => Guid.TryParse(s, out var g) ? g : Guid.Empty)
            .Where(g => g != Guid.Empty).Distinct().ToList();

        var threshold = body.Threshold ?? 2;

        if (guarantorIds.Count < 2 || guarantorIds.Count > 20)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Es braucht zwischen zwei und zwanzig Buergen.");
            return;
        }

        if (threshold < 2 || threshold > guarantorIds.Count)
        {
            // Ein Schwellwert von 1 waere keine Teilung, sondern eine Kopie:
            // ein einzelner Buerge kaeme allein an den Schluessel.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied,
                "Der Schwellwert muss mindestens zwei sein und darf die Zahl der Buergen nicht ueberschreiten.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, guarantorIds, ctx.RequestAborted);
        if (identities.Count != guarantorIds.Count)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Mindestens eine dieser Rollen gibt es nicht.");
            return;
        }

        var shares = RcShamir.Split(held.MasterKey, guarantorIds.Count, threshold);
        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.ReadCommitted, ctx.RequestAborted);
        try
        {
            // Eine neue Hinterlegung ersetzt die alte vollstaendig. Zwei
            // nebeneinander waeren zwei Tueren, und die aeltere kennt niemand
            // mehr.
            await using (var revoke = new SqlCommand(
                "UPDATE dbo.rc_recovery_share SET revoked_at = @now " +
                "WHERE account_id = @account AND revoked_at IS NULL;", connection, tx))
            {
                revoke.Parameters.AddWithValue("@now", now);
                revoke.Parameters.AddWithValue("@account", session.AccountId);
                await revoke.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            for (var i = 0; i < guarantorIds.Count; i++)
            {
                var guarantorId = guarantorIds[i];
                var shareId = RcId.NewId();

                using var rsa = RSA.Create();
                rsa.ImportSubjectPublicKeyInfo(identities[guarantorId].WrapPublicKey, out _);

                // Die Stelle des Anteils reist mit — ohne sie laesst er sich
                // nicht einsetzen.
                var payload = new byte[1 + shares[i].Y.Length];
                payload[0] = shares[i].X;
                shares[i].Y.CopyTo(payload, 1);

                var sealedShare = RcCrypto.WrapKey(rsa, ShareAad(shareId), payload);
                CryptographicOperations.ZeroMemory(payload);

                await using var insert = new SqlCommand("""
                    INSERT INTO dbo.rc_recovery_share
                        (id, account_id, guarantor_role_id, share_sealed, threshold, total_shares, created_at)
                    VALUES (@id, @account, @guarantor, @share, @threshold, @total, @now);
                    """, connection, tx);

                insert.Parameters.AddWithValue("@id", shareId);
                insert.Parameters.AddWithValue("@account", session.AccountId);
                insert.Parameters.AddWithValue("@guarantor", guarantorId);
                insert.Parameters.AddWithValue("@share", sealedShare);
                insert.Parameters.AddWithValue("@threshold", (short)threshold);
                insert.Parameters.AddWithValue("@total", (short)guarantorIds.Count);
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
        finally
        {
            foreach (var share in shares) CryptographicOperations.ZeroMemory(share.Y);
        }

        var graceDays = await GraceDaysAsync(connection, session.AccountId, ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new
        {
            guarantors = guarantorIds.Count,
            threshold,
            graceDays,

            // 8.3 — Der Hinweis nennt BEIDE Enden. Ein Text, der nur den Schutz
            // erwaehnt, verkauft eine Falle als Vorzug.
            notice = graceDays == 0
                ? "Ohne Karenzzeit wirkt eine Wiederherstellung sofort — auch eine, der du "
                + "widersprochen haettest."
                : $"Zwischen Antrag und Wirksamkeit liegen {graceDays} Tage. So lange kannst du "
                + $"widersprechen — und so lange musst du warten, wenn du selbst es bist."
        }, StatusCodes.Status201Created);
    }

    public sealed record ShareView(string GuarantorRoleId, int Threshold, int TotalShares, DateTimeOffset CreatedAt);

    private static async Task ListSharesAsync(HttpContext ctx, RcDb db)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand("""
            SELECT guarantor_role_id, threshold, total_shares, created_at
            FROM dbo.rc_recovery_share WHERE account_id = @account AND revoked_at IS NULL
            ORDER BY seq;
            """, connection);
        cmd.Parameters.AddWithValue("@account", session.AccountId);

        var views = new List<ShareView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            views.Add(new ShareView(RcId.ToText(reader.GetGuid(0)),
                reader.GetInt16(1), reader.GetInt16(2), reader.GetDateTimeOffset(3)));
        }

        await RcResults.WriteJsonAsync(ctx, new { shares = views });
    }

    // -- Beantragen -----------------------------------------------------------

    public sealed record RequestRecoveryRequest(string TargetRoleId, string ByRoleId);

    /// <summary>
    /// Ein Buerge beantragt die Wiederherstellung. Ab hier laeuft die
    /// Karenzzeit — und der Antrag steht in der Kette, bevor irgendetwas
    /// geschieht.
    ///
    /// Antragsberechtigt ist nur, wer selbst einen Anteil haelt. Sonst koennte
    /// ein Beliebiger die Karenzzeit anstossen und den Besitzer mit Antraegen
    /// zudecken, bis er einen uebersieht.
    /// </summary>
    private static async Task RequestAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcLedger ledger, RequestRecoveryRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.TargetRoleId, out var targetRoleId)
            || !Guid.TryParse(body.ByRoleId, out var byRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.IdMalformed, "Eine der Kennungen ist unlesbar.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var targetAccountId = await AccountOfPersonalRoleAsync(connection, targetRoleId, ctx.RequestAborted);
        if (targetAccountId == Guid.Empty)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Zu dieser Rolle gibt es kein Konto.");
            return;
        }

        if (!await IsGuarantorAsync(connection, targetAccountId, byRoleId, ctx.RequestAborted))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Nur ein Buerge kann eine Wiederherstellung beantragen.");
            return;
        }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        using var signKey = await RcRoleAccess.OpenSignKeyAsync(
            connection, session.AccountId, held.MasterKey, byRoleId, ctx.RequestAborted);

        if (signKey is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.RoleUnreachable, "Im Namen dieser Rolle kannst du nichts beantragen.");
            return;
        }

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [byRoleId, targetRoleId], ctx.RequestAborted);
        if (!identities.TryGetValue(byRoleId, out var signer) || !identities.TryGetValue(targetRoleId, out _))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
                RcErrorCodes.RoleNotFound, "Diese Rolle gibt es nicht.");
            return;
        }

        var graceDays = await GraceDaysAsync(connection, targetAccountId, ctx.RequestAborted);
        var tenantId = await TenantOfRoleAsync(connection, targetRoleId, ctx.RequestAborted);
        var now = DateTimeOffset.UtcNow;
        var effectiveAt = now.AddDays(graceDays);
        var requestId = RcId.NewId();

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
        try
        {
            // Die Kette ZUERST — ledger_entry_id ist Pflichtspalte. Eine
            // Wiederherstellung, die nicht in der Kette steht, gibt es nicht.
            var entry = await ledger.AppendAsync(connection, tx, RecoveryLedgerId(targetAccountId),
                RcJson.O(
                    ("effectiveAt", RcJson.I(effectiveAt.ToUnixTimeSeconds())),
                    ("kind", RcJson.S("recovery.requested")),
                    ("requestId", RcJson.G(requestId)),
                    ("targetRoleId", RcJson.G(targetRoleId))),
                targetRoleId, tenantId, "kernel",
                signer, signKey, session.AccountId, RcId.NewId(), ctx.RequestAborted);

            await using (var insert = new SqlCommand("""
                INSERT INTO dbo.rc_recovery_request
                    (id, target_role_id, requested_by_role_id, requested_at, effective_at, ledger_entry_id)
                VALUES (@id, @target, @by, @now, @effective, @entry);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", requestId);
                insert.Parameters.AddWithValue("@target", targetRoleId);
                insert.Parameters.AddWithValue("@by", byRoleId);
                insert.Parameters.AddWithValue("@now", now);
                insert.Parameters.AddWithValue("@effective", effectiveAt);
                insert.Parameters.AddWithValue("@entry", entry.EntryId);
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
            requestId = RcId.ToText(requestId),
            effectiveAt,
            graceDays,
            notice = "Der Besitzer kann bis zur Wirksamkeit widersprechen."
        }, StatusCodes.Status201Created);
    }

    public sealed record RequestView(
        string RequestId, string TargetRoleId, string RequestedByRoleId,
        DateTimeOffset RequestedAt, DateTimeOffset EffectiveAt,
        bool Objected, bool Completed, bool Effective);

    /// <summary>
    /// Antraege, die dieses Konto betreffen — und Antraege, die es selbst
    /// gestellt hat. Der erste Fall ist der wichtige: <b>ohne diese Liste kann
    /// niemand widersprechen</b>, und die Karenzzeit waere Zierrat.
    /// </summary>
    private static async Task ListRequestsAsync(HttpContext ctx, RcDb db, RcMasterKey masterKeys)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var mine = await RcRoleAccess.AllRoleKeysAsync(connection, session.AccountId, held.MasterKey, ctx.RequestAborted);

        if (mine.Count == 0)
        {
            await RcResults.WriteJsonAsync(ctx, new { requests = Array.Empty<RequestView>() });
            return;
        }

        var names = string.Join(", ", mine.Keys.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT id, target_role_id, requested_by_role_id, requested_at, effective_at,
                   objected_at, completed_at
            FROM dbo.rc_recovery_request
            WHERE target_role_id IN ({names}) OR requested_by_role_id IN ({names})
            ORDER BY seq DESC;
            """, connection);

        var i = 0;
        foreach (var roleId in mine.Keys) cmd.Parameters.AddWithValue($"@r{i++}", roleId);

        var now = DateTimeOffset.UtcNow;
        var views = new List<RequestView>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            var effectiveAt = reader.GetDateTimeOffset(4);
            var objected = !reader.IsDBNull(5);
            views.Add(new RequestView(
                RcId.ToText(reader.GetGuid(0)), RcId.ToText(reader.GetGuid(1)), RcId.ToText(reader.GetGuid(2)),
                reader.GetDateTimeOffset(3), effectiveAt, objected, !reader.IsDBNull(6),
                !objected && effectiveAt <= now));
        }

        await RcResults.WriteJsonAsync(ctx, new { requests = views });
    }

    // -- Widersprechen --------------------------------------------------------

    /// <summary>
    /// <b>Der Riegel, der wirklich schuetzt.</b> Wer sich noch anmelden kann,
    /// sieht den Antrag und stoppt ihn — und genau dieser Fall ist der
    /// gefaehrliche: ein Fremder, der die Buergen ueberredet hat, waehrend der
    /// Besitzer voellig arglos weiterarbeitet.
    ///
    /// Widersprechen darf nur, wem die Zielrolle gehoert. Und der Widerspruch
    /// ist endgueltig: der Antrag lebt nicht wieder auf, sondern es braucht
    /// einen neuen — mit neuer Karenzzeit.
    /// </summary>
    private static async Task ObjectAsync(HttpContext ctx, RcDb db, RcMasterKey masterKeys, Guid id)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var request = await LoadRequestAsync(connection, id, ctx.RequestAborted);
        if (request is null) { await NotFound(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var mine = await RcRoleAccess.AllRoleKeysAsync(connection, session.AccountId, held.MasterKey, ctx.RequestAborted);

        if (!mine.ContainsKey(request.TargetRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Widersprechen kann nur, wem die Rolle gehoert.");
            return;
        }

        if (request.CompletedUtc is not null)
        {
            // Zu spaet. Das ehrlich zu sagen ist wichtiger, als es zu
            // verschleiern: der Besitzer muss wissen, dass es geschehen IST.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied,
                "Diese Wiederherstellung ist bereits vollzogen. Ein Widerspruch kommt zu spaet.");
            return;
        }

        await using var cmd = new SqlCommand(
            "UPDATE dbo.rc_recovery_request SET objected_at = @now WHERE id = @id AND objected_at IS NULL;",
            connection);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new { requestId = RcId.ToText(id), objected = true });
    }

    // -- Vollziehen -----------------------------------------------------------

    public sealed record CompleteRequest(string RequesterRoleId);

    /// <summary>
    /// Der Vollzug. Die Buergen legen ihre Anteile vor, der Wurzelschluessel
    /// wird zusammengesetzt und unter einem NEUEN Passwort neu versiegelt.
    ///
    /// <b>Was hier NICHT passiert:</b> der zusammengesetzte Schluessel wird
    /// nicht gespeichert und nicht ausgeliefert. Er lebt bis zum Ende dieser
    /// Anfrage und wird dann ueberschrieben.
    ///
    /// <b>Drei Bedingungen, und alle drei muessen gelten:</b> die Karenzzeit ist
    /// abgelaufen, es wurde nicht widersprochen, und es liegen mindestens so
    /// viele Anteile vor, wie der Schwellwert verlangt. Jede fuer sich ist zu
    /// wenig.
    /// </summary>
    private static async Task CompleteAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcLoginGuard guard, Guid id, CompleteRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var request = await LoadRequestAsync(connection, id, ctx.RequestAborted);
        if (request is null) { await NotFound(ctx); return; }

        var now = DateTimeOffset.UtcNow;

        if (request.ObjectedUtc is not null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Dieser Wiederherstellung wurde widersprochen.");
            return;
        }

        if (request.CompletedUtc is not null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Diese Wiederherstellung ist bereits vollzogen.");
            return;
        }

        if (request.EffectiveUtc > now)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied,
                $"Die Karenzzeit laeuft noch bis {request.EffectiveUtc:u}.");
            return;
        }

        var targetAccountId = await AccountOfPersonalRoleAsync(connection, request.TargetRoleId, ctx.RequestAborted);
        if (targetAccountId == Guid.Empty) { await NotFound(ctx); return; }

        using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
        var mine = await RcRoleAccess.AllRoleKeysAsync(connection, session.AccountId, held.MasterKey, ctx.RequestAborted);

        // Vollziehen kann nur der Antragsteller — er ist der Einzige, fuer den
        // die Beitraege verpackt wurden.
        if (!mine.ContainsKey(request.RequestedByRoleId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                RcErrorCodes.PermissionDenied, "Vollziehen kann nur, wer beantragt hat.");
            return;
        }

        var (collected, threshold) = await CollectContributionsAsync(
            connection, id, request.RequestedByRoleId, mine, ctx.RequestAborted);

        if (collected.Count < threshold)
        {
            // Wie viele noch fehlen, darf dastehen: die Zahl verraet nichts
            // ueber die Anteile und ohne sie taeppt man im Dunkeln.
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied,
                $"Es liegen {collected.Count} von {threshold} noetigen Anteilen vor.");
            return;
        }

        var recovered = RcShamir.Combine(collected);
        try
        {
            // Die Probe: passt der zusammengesetzte Schluessel wirklich? Ohne
            // sie liefe eine falsche Wiederherstellung durch — Shamir liefert
            // bei zu wenigen oder falschen Anteilen ein Ergebnis, nur eben das
            // falsche, und zwar ohne Anzeichen.
            if (!await MasterKeyFitsAsync(connection, request.TargetRoleId, recovered, ctx.RequestAborted))
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                    RcErrorCodes.CryptoMalformed,
                    "Die vorgelegten Anteile ergeben nicht den Schluessel dieses Kontos.");
                return;
            }

            // Ein neues Anmeldegeheimnis. Es wird EINMAL ausgeliefert und
            // nirgends gespeichert — wer es verpasst, braucht einen neuen
            // Antrag.
            var newSecret = RcToken.Create(RcTokenPurpose.RecoveryShare, targetAccountId, now,
                TimeSpan.FromDays(7), "Wiederherstellung");

            byte[] newPasswordKey;
            var newSalt = RcPassword.NewSalt();
            using (await guard.EnterAsync(ctx.RequestAborted))
            {
                newPasswordKey = RcPassword.DerivePasswordKey(newSecret.Secret, newSalt);
            }

            var secrets = RcAccountSecrets.Create(targetAccountId, newPasswordKey, recovered, newSalt);

            await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(
                System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
            try
            {
                await using (var update = new SqlCommand("""
                    UPDATE dbo.rc_account
                    SET login_verifier = @verifier, login_salt = @loginSalt,
                        password_salt = @passwordSalt, master_key_sealed = @sealed
                    WHERE id = @id;
                    """, connection, tx))
                {
                    update.Parameters.AddWithValue("@verifier", secrets.LoginVerifier);
                    update.Parameters.AddWithValue("@loginSalt", secrets.LoginSalt);
                    update.Parameters.AddWithValue("@passwordSalt", secrets.PasswordSalt);
                    update.Parameters.AddWithValue("@sealed", secrets.MasterKeySealed);
                    update.Parameters.AddWithValue("@id", targetAccountId);
                    await update.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                // Alle bestehenden Sitzungen enden. Wer bisher angemeldet war,
                // ist es nicht mehr — auch der Besitzer nicht. Das ist hart und
                // richtig: nach einer Wiederherstellung weiss niemand mehr
                // sicher, wer da noch angemeldet ist.
                await using (var revoke = new SqlCommand(
                    "UPDATE dbo.rc_session SET revoked_at = @now WHERE account_id = @id AND revoked_at IS NULL;",
                    connection, tx))
                {
                    revoke.Parameters.AddWithValue("@now", now);
                    revoke.Parameters.AddWithValue("@id", targetAccountId);
                    await revoke.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                await using (var complete = new SqlCommand(
                    "UPDATE dbo.rc_recovery_request SET completed_at = @now " +
                    "WHERE id = @id AND completed_at IS NULL AND objected_at IS NULL;", connection, tx))
                {
                    complete.Parameters.AddWithValue("@now", now);
                    complete.Parameters.AddWithValue("@id", id);

                    if (await complete.ExecuteNonQueryAsync(ctx.RequestAborted) != 1)
                    {
                        // Zwischen Pruefung und Vollzug wurde widersprochen.
                        // Der Widerspruch gewinnt.
                        await tx.RollbackAsync(ctx.RequestAborted);
                        await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                            RcErrorCodes.PermissionDenied, "Dieser Wiederherstellung wurde widersprochen.");
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

            CryptographicOperations.ZeroMemory(newPasswordKey);

            await RcResults.WriteJsonAsync(ctx, new
            {
                requestId = RcId.ToText(id),
                completedAt = now,

                // Genau einmal. Danach steht es nirgends mehr.
                oneTimeSecret = newSecret.Secret,
                notice = "Dieses Geheimnis wird nur einmal angezeigt. Damit anmelden und sofort "
                       + "ein eigenes Passwort setzen. Alle bisherigen Sitzungen wurden beendet."
            });
        }
        finally
        {
            CryptographicOperations.ZeroMemory(recovered);
            foreach (var share in collected) CryptographicOperations.ZeroMemory(share.Y);
        }
    }

    // -- Datenzugriff ---------------------------------------------------------

    private sealed record RequestRow(
        Guid Id, Guid TargetRoleId, Guid RequestedByRoleId, DateTimeOffset EffectiveUtc,
        DateTimeOffset? ObjectedUtc, DateTimeOffset? CompletedUtc);

    private static async Task<RequestRow?> LoadRequestAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT id, target_role_id, requested_by_role_id, effective_at, objected_at, completed_at " +
            "FROM dbo.rc_recovery_request WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new RequestRow(
            reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetDateTimeOffset(3),
            reader.IsDBNull(4) ? null : reader.GetDateTimeOffset(4),
            reader.IsDBNull(5) ? null : reader.GetDateTimeOffset(5));
    }

    /// <summary>
    /// Die Beitraege einsammeln und oeffnen. Sie sind fuer den Antragsteller
    /// verpackt — nur er bekommt sie auf, und auch er nur, wenn er entsperrt
    /// ist.
    /// </summary>
    private static async Task<(List<RcShamir.Share> Shares, int Threshold)> CollectContributionsAsync(
        SqlConnection connection, Guid requestId, Guid requesterRoleId,
        IReadOnlyDictionary<Guid, byte[]> roleKeys, CancellationToken ct)
    {
        var collected = new List<RcShamir.Share>();

        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [requesterRoleId], ct);
        if (!identities.TryGetValue(requesterRoleId, out var requester)) return (collected, int.MaxValue);
        if (!roleKeys.TryGetValue(requesterRoleId, out var requesterKey)) return (collected, int.MaxValue);

        var rows = new List<(Guid Id, byte[] Blob)>();
        await using (var cmd = new SqlCommand(
            "SELECT id, share_resealed FROM dbo.rc_recovery_contribution WHERE request_id = @request;", connection))
        {
            cmd.Parameters.AddWithValue("@request", requestId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) rows.Add((reader.GetGuid(0), (byte[])reader[1]));
        }

        using var wrapKey = RcRoleKeys.OpenWrapKey(requester, requesterKey);
        foreach (var (contributionId, blob) in rows)
        {
            try
            {
                var payload = RcCrypto.UnwrapKey(wrapKey, ContributionAad(contributionId), blob);
                collected.Add(new RcShamir.Share(payload[0], payload[1..]));
            }
            catch (RcDecryptException)
            {
                // Ein Beitrag, der sich nicht oeffnen laesst, faellt aus. Der
                // Schwellwert entscheidet, ob es trotzdem reicht.
            }
        }

        return (collected, await ThresholdOfRequestAsync(connection, requestId, ct));
    }

    private static async Task<int> ThresholdOfRequestAsync(
        SqlConnection connection, Guid requestId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT TOP 1 s.threshold
            FROM dbo.rc_recovery_request q
            JOIN dbo.rc_role_edge e ON e.to_role_id = q.target_role_id AND e.from_account_id IS NOT NULL
            JOIN dbo.rc_recovery_share s ON s.account_id = e.from_account_id AND s.revoked_at IS NULL
            WHERE q.id = @request;
            """, connection);
        cmd.Parameters.AddWithValue("@request", requestId);
        return await cmd.ExecuteScalarAsync(ct) is short threshold ? threshold : int.MaxValue;
    }

    private static async Task<(int Have, int Need)> ContributionCountAsync(
        SqlConnection connection, Guid requestId, Guid accountId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT (SELECT COUNT(*) FROM dbo.rc_recovery_contribution WHERE request_id = @request),
                   ISNULL((SELECT TOP 1 threshold FROM dbo.rc_recovery_share
                           WHERE account_id = @account AND revoked_at IS NULL), 2);
            """, connection);
        cmd.Parameters.AddWithValue("@request", requestId);
        cmd.Parameters.AddWithValue("@account", accountId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? (reader.GetInt32(0), reader.GetInt16(1)) : (0, 2);
    }

    private static RcAad ContributionAad(Guid contributionId) =>
        RcAad.Create("kernel", "recovery_contribution", contributionId, RcField.AccountMasterKey, 1);

    /// <summary>
    /// Die Anteile der vorlegenden Buergen oeffnen. Jeder oeffnet seinen
    /// eigenen mit seinem eigenen Verpackungsschluessel — der Server kann keinen
    /// einzigen davon allein aufmachen.
    /// </summary>
    private static async Task<(List<RcShamir.Share> Shares, int Threshold)> OpenSharesAsync(
        SqlConnection connection, Guid accountId, IReadOnlyList<Guid> guarantorIds,
        IReadOnlyDictionary<Guid, byte[]> roleKeys, CancellationToken ct)
    {
        var collected = new List<RcShamir.Share>();
        var threshold = int.MaxValue;

        if (guarantorIds.Count == 0) return (collected, threshold);

        var names = string.Join(", ", guarantorIds.Select((_, i) => $"@g{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT id, guarantor_role_id, share_sealed, threshold
            FROM dbo.rc_recovery_share
            WHERE account_id = @account AND revoked_at IS NULL AND guarantor_role_id IN ({names});
            """, connection);

        cmd.Parameters.AddWithValue("@account", accountId);
        for (var i = 0; i < guarantorIds.Count; i++) cmd.Parameters.AddWithValue($"@g{i}", guarantorIds[i]);

        var rows = new List<(Guid ShareId, Guid RoleId, byte[] Blob, int Threshold)>();
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
                rows.Add((reader.GetGuid(0), reader.GetGuid(1), (byte[])reader[2], reader.GetInt16(3)));
        }

        if (rows.Count == 0) return (collected, threshold);

        var identities = await RcRoleAccess.LoadIdentitiesAsync(
            connection, rows.Select(r => r.RoleId).Distinct().ToList(), ct);

        foreach (var (shareId, roleId, blob, rowThreshold) in rows)
        {
            threshold = Math.Min(threshold, rowThreshold);
            if (!identities.TryGetValue(roleId, out var identity)) continue;
            if (!roleKeys.TryGetValue(roleId, out var roleKey)) continue;

            try
            {
                using var wrapKey = RcRoleKeys.OpenWrapKey(identity, roleKey);
                var payload = RcCrypto.UnwrapKey(wrapKey, ShareAad(shareId), blob);
                collected.Add(new RcShamir.Share(payload[0], payload[1..]));
            }
            catch (RcDecryptException)
            {
                // Ein Anteil, der sich nicht oeffnen laesst, faellt aus. Der
                // Schwellwert entscheidet, ob es trotzdem reicht.
            }
        }

        return (collected, threshold == int.MaxValue ? 2 : threshold);
    }

    /// <summary>
    /// <b>Die Probe, und sie ist unverzichtbar.</b> Shamir liefert auch bei
    /// falschen oder zu wenigen Anteilen ein Ergebnis — nur eben das falsche,
    /// und ohne jedes Anzeichen. Ohne diese Pruefung wuerde eine misslungene
    /// Wiederherstellung das Konto mit einem Unsinnsschluessel neu versiegeln
    /// und es damit endgueltig zerstoeren.
    ///
    /// Geprueft wird am persoenlichen Rollenschluessel: aus dem
    /// Wurzelschluessel wird er ABGELEITET (21.6), und mit ihm muss sich der
    /// versiegelte private Schluessel der Rolle oeffnen lassen. Das ist kein
    /// Vergleich zweier Kennungen, sondern eine echte Entschluesselung — sie
    /// gelingt nur mit dem richtigen Schluessel.
    ///
    /// <b>Warum nicht gegen master_key_sealed?</b> Dessen Kopf nennt die
    /// Kennung des PasswortSCHLUESSELS, mit dem versiegelt wurde, nicht die des
    /// Wurzelschluessels darin. Ein Vergleich damit waere immer falsch — und
    /// zwar auf die stille Art.
    /// </summary>
    private static async Task<bool> MasterKeyFitsAsync(
        SqlConnection connection, Guid personalRoleId, byte[] candidate, CancellationToken ct)
    {
        var identities = await RcRoleAccess.LoadIdentitiesAsync(connection, [personalRoleId], ct);
        if (!identities.TryGetValue(personalRoleId, out var identity)) return false;

        var roleKey = RcRoleKeys.PersonalRoleKey(candidate, personalRoleId);
        try
        {
            using var _ = RcRoleKeys.OpenSignKey(identity, roleKey);
            return true;
        }
        catch (RcDecryptException)
        {
            return false;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(roleKey);
        }
    }

    private static async Task<bool> IsGuarantorAsync(
        SqlConnection connection, Guid accountId, Guid roleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT COUNT(*) FROM dbo.rc_recovery_share " +
            "WHERE account_id = @account AND guarantor_role_id = @role AND revoked_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@account", accountId);
        cmd.Parameters.AddWithValue("@role", roleId);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct), System.Globalization.CultureInfo.InvariantCulture) > 0;
    }

    private static async Task<Guid> AccountOfPersonalRoleAsync(
        SqlConnection connection, Guid roleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT TOP 1 e.from_account_id
            FROM dbo.rc_role_edge e
            WHERE e.to_role_id = @role AND e.from_account_id IS NOT NULL AND e.revoked_at IS NULL
            ORDER BY e.seq;
            """, connection);
        cmd.Parameters.AddWithValue("@role", roleId);
        return await cmd.ExecuteScalarAsync(ct) is Guid accountId ? accountId : Guid.Empty;
    }

    private static async Task<int> GraceDaysAsync(SqlConnection connection, Guid accountId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT recovery_grace_days FROM dbo.rc_account WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", accountId);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct) ?? 1, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static async Task<Guid> TenantOfRoleAsync(SqlConnection connection, Guid roleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT tenant_id FROM dbo.rc_role WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", roleId);
        return await cmd.ExecuteScalarAsync(ct) is Guid tenantId ? tenantId : Guid.Empty;
    }

    /// <summary>
    /// Jedes Konto hat eine eigene Wiederherstellungskette. Sie haengt an
    /// keinem Bereich — eine Wiederherstellung betrifft das Konto, nicht ein
    /// Gespraech.
    /// </summary>
    private static Guid RecoveryLedgerId(Guid accountId) => accountId;

    private static RcAad ShareAad(Guid shareId) =>
        RcAad.Create("kernel", "recovery_share", shareId, RcField.AccountMasterKey, 1);

    private static Task NotFound(HttpContext ctx) =>
        RcResults.WriteErrorAsync(ctx, StatusCodes.Status404NotFound,
            RcErrorCodes.PermissionDenied, "Diesen Antrag gibt es nicht.");
}
