using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Was dem Konto vor 0040 gegeben wurde — einer Person uebergeben, in einem Zug.
///
/// <para>
/// <b>Seit 0040 bekommt das Konto nichts mehr.</b> Vorher war es die einzige
/// Rolle, die ein neuer Mensch hatte, und alles landete dort: Bereiche,
/// Adressen, Kalendereintraege, das Postfach eines Formulars. Das bleibt so
/// lange so, bis der Browser es umverpackt — der Dienst kann einen
/// Epochenschluessel nicht fuer eine andere Rolle verpacken und kein
/// Zertifikat unterschreiben.
/// </para>
///
/// <para>
/// <b>Alles oder nichts, in EINER Transaktion.</b> Einzeln uebergeben hiesse:
/// bei einem Abbruch in der Mitte haelt das Konto die eine Haelfte und die
/// Person die andere, und niemand saehe mehr, was wohin gehoert.
/// </para>
///
/// <para>
/// <b>Genau das, was das Konto hatte — nicht mehr, nicht weniger.</b> Jede
/// Stufe, die es hielt, bekommt die Person; keine, die es nicht hielt. Und
/// was der Browser schickt, muss ALLES sein: ist inzwischen etwas
/// hinzugekommen, wird abgelehnt, statt es am Konto liegen zu lassen.
/// </para>
/// </summary>
public static class HandOver
{
    private static readonly TimeSpan ClockSlack = TimeSpan.FromHours(1);
    private static readonly TimeSpan MaxLife = TimeSpan.FromDays(365 * 5);

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/account/held", HeldAsync);
        app.MapPost("/workspace/account/hand-over", HandOverAsync);
    }

    /* -- Was das Konto haelt ------------------------------------------------- */

    private sealed record HeldArea(
        Guid AreaId, string Name, Guid? ParentAreaId,
        List<string> Capabilities, List<(int Epoch, byte[] Sealed)> Keys);

    private sealed record Held(
        Guid AccountRoleId, List<HeldArea> Areas, List<(Guid AreaId, byte[] Sealed)> Intakes,
        int Addresses, int CalendarItems);

    private static async Task<Held> HeldByAsync(
        SqlConnection connection, SqlTransaction? tx, Guid account, CancellationToken ct)
    {
        var areas = new Dictionary<Guid, HeldArea>();

        await using (var cmd = new SqlCommand("""
            SELECT a.id, a.name, a.parent_area_id, c.capability, NULL AS epoch, NULL AS blob
            FROM app.certificate c
            JOIN app.area a ON a.id = c.scope_id
            WHERE c.scope_kind = N'area' AND c.subject_role_id = @account
              AND c.revoked_at IS NULL AND c.expires_at > @now

            UNION ALL

            SELECT a.id, a.name, a.parent_area_id, NULL, g.key_epoch, g.sealed_blob
            FROM app.key_grant g
            JOIN app.area a ON a.id = g.key_ref
            WHERE g.key_kind = N'epoch' AND g.role_id = @account AND g.destroyed_at IS NULL;
            """, connection, tx))
        {
            cmd.Parameters.AddWithValue("@account", account);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var id = reader.GetGuid(0);
                if (!areas.TryGetValue(id, out var area))
                {
                    area = new HeldArea(id, reader.GetString(1),
                        reader.IsDBNull(2) ? null : reader.GetGuid(2), [], []);
                    areas[id] = area;
                }

                if (!reader.IsDBNull(3))
                {
                    var capability = reader.GetString(3);
                    if (!area.Capabilities.Contains(capability)) area.Capabilities.Add(capability);
                }

                if (!reader.IsDBNull(4)) area.Keys.Add((reader.GetInt32(4), (byte[])reader[5]));
            }
        }

        var intakes = new List<(Guid, byte[])>();

        await using (var cmd = new SqlCommand(
            "SELECT area_id, private_key_sealed FROM app.intake WHERE sealed_for_role_id = @account;",
            connection, tx))
        {
            cmd.Parameters.AddWithValue("@account", account);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) intakes.Add((reader.GetGuid(0), (byte[])reader[1]));
        }

        int addresses, calendarItems;

        await using (var cmd = new SqlCommand("""
            SELECT (SELECT COUNT(*) FROM app.slug
                     WHERE claimed_by_role_id = @account OR internal_for_role_id = @account),
                   (SELECT COUNT(*) FROM app.calendar_item WHERE owner_role_id = @account);
            """, connection, tx))
        {
            cmd.Parameters.AddWithValue("@account", account);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            await reader.ReadAsync(ct);
            addresses = reader.GetInt32(0);
            calendarItems = reader.GetInt32(1);
        }

        return new Held(account, [.. areas.Values.OrderBy(a => a.Name)], intakes, addresses, calendarItems);
    }

    /// <summary>
    /// Was das Konto noch selbst haelt — mit den Huellen, die der Browser
    /// umverpacken muss. Leer, wenn es nichts mehr gibt; dann zeigt die
    /// Oberflaeche auch nichts an.
    /// </summary>
    private static async Task HeldAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (mine.FirstOrDefault(r => r.IsPersonal) is not { IsPersonal: true } account)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "To konto nie ma jeszcze klucza.");
            return;
        }

        var held = await HeldByAsync(connection, null, account.Id, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            accountRoleId = Ids.ToText(held.AccountRoleId),
            areas = held.Areas.Select(a => new
            {
                areaId = Ids.ToText(a.AreaId),
                name = a.Name,
                parentAreaId = a.ParentAreaId is null ? null : Ids.ToText(a.ParentAreaId.Value),
                capabilities = a.Capabilities,
                keys = a.Keys.Select(k => new { epoch = k.Epoch, sealedBlob = Base64Url.Encode(k.Sealed) })
            }),
            intakes = held.Intakes.Select(i => new
            {
                areaId = Ids.ToText(i.AreaId),
                privateKeySealed = Base64Url.Encode(i.Sealed)
            }),
            addresses = held.Addresses,
            calendarItems = held.CalendarItems
        });
    }

    /* -- Uebergeben ---------------------------------------------------------- */

    public sealed record KeyIn(int Epoch, string WrappedKey);

    public sealed record AreaIn(string AreaId, IReadOnlyList<KeyIn> Keys, IReadOnlyList<Area.Proof> Certificates);

    public sealed record IntakeIn(string AreaId, string PrivateKeySealed);

    public sealed record HandOverRequest(
        string PersonRoleId, IReadOnlyList<AreaIn> Areas, IReadOnlyList<IntakeIn> Intakes);

    private static async Task HandOverAsync(HttpContext ctx, Db db, HandOverRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.PersonRoleId, out var personId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung osoby.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (mine.FirstOrDefault(r => r.IsPersonal) is not { IsPersonal: true } account)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "To konto nie ma jeszcze klucza.");
            return;
        }

        /*
         * NUR EINE PERSON, DIE DAS KONTO SELBST HAELT. Eine Rolle darunter
         * waere wieder etwas, das man mit einem Amt weitergibt — und mit ihm
         * alles, was dem Menschen gehoerte.
         */
        if (!mine.Any(r => r.Id == personId && r.Kind == "person" && r.Depth == 1))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Przekazać można tylko osobie, którą prowadzi konto.");
            return;
        }

        var signPublic = await SignKeyAsync(connection, account.Id, ctx.RequestAborted);
        if (signPublic is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "To konto nie ma jeszcze klucza.");
            return;
        }

        /*
         * ALLES VOR DER TRANSAKTION PRUEFEN, was ohne Datenbank geht: Kennungen
         * und Unterschriften. RSA in einer offenen Transaktion hiesse
         * Sekunden mit gehaltenen Sperren.
         */
        var now = DateTimeOffset.UtcNow;
        var areasIn = new Dictionary<Guid, (Dictionary<int, byte[]> Keys, List<(CertificateRecord Record, byte[] Signature)> Certificates)>();

        foreach (var area in body.Areas ?? [])
        {
            if (!Guid.TryParse(area.AreaId, out var areaId) || areasIn.ContainsKey(areaId))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny albo podwójny obszar.");
                return;
            }

            var keys = new Dictionary<int, byte[]>();
            foreach (var key in area.Keys ?? [])
            {
                try { keys[key.Epoch] = Base64Url.Decode(key.WrappedKey ?? string.Empty); }
                catch (FormatException)
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz.");
                    return;
                }
            }

            var certificates = new List<(CertificateRecord, byte[])>();
            foreach (var proof in area.Certificates ?? [])
            {
                if (!Guid.TryParse(proof.Id, out var certificateId)
                    || !Capabilities.TryParse(proof.Capability, out var capability))
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zaświadczenie.");
                    return;
                }

                var issuedAt = DateTimeOffset.FromUnixTimeSeconds(proof.IssuedAt);
                var expiresAt = DateTimeOffset.FromUnixTimeSeconds(proof.ExpiresAt);

                if (issuedAt > now + ClockSlack || issuedAt < now - ClockSlack
                    || expiresAt <= issuedAt || expiresAt > now + MaxLife)
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Data albo ważność zaświadczenia się nie zgadza.");
                    return;
                }

                var record = new CertificateRecord
                {
                    Id = certificateId,
                    SubjectRoleId = personId,
                    ScopeKind = ScopeKind.Area,
                    ScopeId = areaId,
                    Capability = capability,
                    IssuedByRoleId = account.Id,
                    IssuedUtc = issuedAt,
                    ExpiresUtc = expiresAt
                };

                byte[] signature;
                try { signature = Base64Url.Decode(proof.Signature ?? string.Empty); }
                catch (FormatException)
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny podpis.");
                    return;
                }

                // Unterschrieben vom KONTO, fuer DIESE Person, auf DIESEN Bereich.
                if (!Area.Verify(record, signPublic, signature))
                {
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis zaświadczenia się nie zgadza.");
                    return;
                }

                certificates.Add((record, signature));
            }

            areasIn[areaId] = (keys, certificates);
        }

        var intakesIn = new Dictionary<Guid, byte[]>();
        foreach (var intake in body.Intakes ?? [])
        {
            if (!Guid.TryParse(intake.AreaId, out var areaId))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny obszar skrzynki.");
                return;
            }

            try { intakesIn[areaId] = Base64Url.Decode(intake.PrivateKeySealed ?? string.Empty); }
            catch (FormatException)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz skrzynki.");
                return;
            }
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            var held = await HeldByAsync(connection, tx, account.Id, ctx.RequestAborted);

            /*
             * GENAU DAS, WAS DA IST. Hat sich etwas geaendert, seit der Browser
             * nachgesehen hat, wird nicht die Haelfte uebergeben.
             */
            var stale =
                !held.Areas.Select(a => a.AreaId).ToHashSet().SetEquals(areasIn.Keys)
                || !held.Intakes.Select(i => i.AreaId).ToHashSet().SetEquals(intakesIn.Keys)
                || held.Areas.Any(a =>
                       !a.Keys.Select(k => k.Epoch).ToHashSet().SetEquals(areasIn[a.AreaId].Keys.Keys)
                    || !a.Capabilities.ToHashSet().SetEquals(
                           areasIn[a.AreaId].Certificates.Select(c => Capabilities.ToText(c.Record.Capability))));

            if (stale)
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Konto trzyma teraz coś innego niż przed chwilą. Odśwież i spróbuj jeszcze raz.");
                return;
            }

            foreach (var area in held.Areas)
            {
                var (keys, certificates) = areasIn[area.AreaId];

                /* Die Person bekommt jeden Schluessel, den das Konto hatte — ausser
                   sie hat ihn schon (sie war vielleicht schon Mitglied). */
                foreach (var (epoch, wrapped) in keys)
                {
                    await using var has = new SqlCommand("""
                        SELECT 1 FROM app.key_grant
                        WHERE role_id = @role AND key_kind = N'epoch' AND key_ref = @area
                          AND key_epoch = @epoch AND destroyed_at IS NULL;
                        """, connection, tx);
                    has.Parameters.AddWithValue("@role", personId);
                    has.Parameters.AddWithValue("@area", area.AreaId);
                    has.Parameters.AddWithValue("@epoch", epoch);

                    if (await has.ExecuteScalarAsync(ctx.RequestAborted) is null)
                    {
                        await Area.GrantKeyAsync(connection, tx, personId, area.AreaId, epoch, wrapped,
                            account.Id, now, ctx.RequestAborted);
                    }
                }

                foreach (var (record, signature) in certificates)
                {
                    await Area.InsertCertificateAsync(connection, tx, record, signature, ctx.RequestAborted);
                }

                /* Und das Konto steht nicht mehr darin. */
                await using var drop = new SqlCommand("""
                    UPDATE app.certificate SET revoked_at = @now
                    WHERE scope_kind = N'area' AND scope_id = @area
                      AND subject_role_id = @account AND revoked_at IS NULL;

                    UPDATE app.key_grant SET destroyed_at = @now
                    WHERE key_kind = N'epoch' AND key_ref = @area
                      AND role_id = @account AND destroyed_at IS NULL;
                    """, connection, tx);
                drop.Parameters.AddWithValue("@now", now);
                drop.Parameters.AddWithValue("@area", area.AreaId);
                drop.Parameters.AddWithValue("@account", account.Id);
                await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            /*
             * DAS POSTFACH: dieselbe private Haelfte, nur unter dem Schluessel
             * der Person. Oeffnen kann der Dienst es nicht — der Browser hat
             * die neue Huelle geoeffnet, bevor er sie geschickt hat.
             */
            foreach (var (areaId, sealedNew) in intakesIn)
            {
                await using var reseal = new SqlCommand("""
                    UPDATE app.intake SET private_key_sealed = @sealed, sealed_for_role_id = @person
                    WHERE area_id = @area AND sealed_for_role_id = @account;
                    """, connection, tx);
                reseal.Parameters.AddWithValue("@sealed", sealedNew);
                reseal.Parameters.AddWithValue("@person", personId);
                reseal.Parameters.AddWithValue("@area", areaId);
                reseal.Parameters.AddWithValue("@account", account.Id);
                await reseal.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            /*
             * WAS NUR ZEIGER SIND — wer eine Adresse fuehrt, wem eine Seite
             * gehoert, wessen ein Kalendereintrag ist. Kein Schluessel liegt
             * darunter; umhaengen darf der Dienst selbst.
             *
             * WER ETWAS GETAN HAT (`created_by`, `issued_by`, `cut_by`) bleibt
             * stehen: das ist Geschichte, und die schreibt man nicht um.
             */
            await using (var pointers = new SqlCommand("""
                UPDATE app.slug SET claimed_by_role_id = @person WHERE claimed_by_role_id = @account;
                UPDATE app.slug SET internal_for_role_id = @person WHERE internal_for_role_id = @account;
                UPDATE app.calendar_item SET owner_role_id = @person WHERE owner_role_id = @account;
                """, connection, tx))
            {
                pointers.Parameters.AddWithValue("@person", personId);
                pointers.Parameters.AddWithValue("@account", account.Id);
                await pointers.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);

            await ctx.Response.WriteAsJsonAsync(new
            {
                areas = held.Areas.Count,
                intakes = held.Intakes.Count,
                addresses = held.Addresses,
                calendarItems = held.CalendarItems
            });
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }
    }

    private static async Task<byte[]?> SignKeyAsync(SqlConnection connection, Guid roleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT sign_public_key FROM app.role WHERE id = @id AND revoked_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", roleId);
        return await cmd.ExecuteScalarAsync(ct) as byte[];
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
