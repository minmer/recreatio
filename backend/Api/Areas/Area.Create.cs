using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Einen Bereich anlegen — und den eigenen, privaten finden.</summary>
public static partial class Area
{
    /* -- Anlegen ------------------------------------------------------------ */

    /// <summary>Ein Zertifikat, wie der Browser es unterschrieben hat.</summary>
    public sealed record Proof(string Id, string Capability, long IssuedAt, long ExpiresAt, string Signature);

    public sealed record CreateRequest(
        string AreaId, string Name, string RoleId, string WrappedKey, IReadOnlyList<Proof> Certificates,

        /// <summary>Unter welchem Bereich er liegt — `null` heisst: ganz aussen (0035).</summary>
        string? ParentAreaId = null,

        /// <summary>
        /// 0054 — DER EIGENE: „Tylko ja". Je Person höchstens einer, ganz
        /// aussen; die Oberfläche legt ihn beim ersten privaten Termin selbst an.
        /// </summary>
        bool? Personal = null);

    /// <summary>
    /// Einen Bereich anlegen.
    ///
    /// <para>
    /// <b>Die Kennung kommt aus dem Browser.</b> Die AAD des Epochenschlüssels
    /// nennt den Bereich — ohne seine Kennung lässt sich der Schlüssel nicht
    /// verpacken. Der Dienst könnte sie erst NACH dem Einfügen vergeben, und
    /// dann wäre der Schlüssel unter einer falschen AAD verpackt und für immer
    /// zu. Deshalb würfelt der Browser sie, wie er es bei Zertifikaten schon tut.
    /// </para>
    ///
    /// <para>
    /// <b>Alles in EINER Transaktion.</b> Bereich, Epoche, Zuteilung und
    /// Zertifikate gehören zusammen: ein Bereich ohne Zuteilung wäre ein
    /// Schlüssel, den niemand hat, und ein Bereich ohne Zertifikat einer, in den
    /// niemand jemanden lassen darf. Beides ist unbrauchbar und bliebe stehen.
    /// </para>
    /// </summary>
    private static async Task CreateAsync(HttpContext ctx, Db db, CreateRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var name = (body.Name ?? string.Empty).Trim();

        if (name.Length is 0 or > MaxName)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Obszar potrzebuje nazwy.");
            return;
        }

        if (!Guid.TryParse(body.AreaId, out var areaId) || areaId == Guid.Empty
            || !Guid.TryParse(body.RoleId, out var roleId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        /*
         * DER VATER (0035). Wer einen inneren Bereich anlegt, muss den
         * aeusseren VERWALTEN — sonst haengte sich jeder mit Lesezugang einen
         * Bereich unter fremde Ordnung.
         */
        Guid? parentId = null;

        if (body.ParentAreaId is not null)
        {
            if (!Guid.TryParse(body.ParentAreaId, out var asked))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung obszaru nadrzędnego.");
                return;
            }

            parentId = asked;
        }

        if (body.Personal == true && body.ParentAreaId is not null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Prywatny obszar nie leży w żadnym innym.");
            return;
        }

        byte[] wrapped;
        try { wrapped = Base64Url.Decode(body.WrappedKey ?? string.Empty); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny klucz.");
            return;
        }

        if (wrapped.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Bez klucza obszar jest nie do otwarcia.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == roleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja rola.");
            return;
        }

        if (Workspace.IsAccount(mine, roleId))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, Workspace.AccountTakesNothing);
            return;
        }

        var issuer = await PublicSignKeyAsync(connection, roleId, ctx.RequestAborted);
        if (issuer is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej roli nie ma.");
            return;
        }

        /*
         * WER INNEN ANLEGT, MUSS AUSSEN VERWALTEN (0035).
         *
         * Sonst haengte sich jeder, der die Messe nur liest, einen Bereich
         * unter sie — und die Verschachtelung waere eine Behauptung ueber
         * Ordnung statt einer Ordnung.
         *
         * Die ROLLE, auf die der neue Bereich laeuft, muss dagegen NICHT
         * aussen stehen: jeder Bereich hat seine eigenen Rollen (siehe
         * GrantAsync). Die Verschachtelung ordnet Bereiche, nicht Menschen.
         */
        if (parentId is not null)
        {
            if (!await MayAsync(connection, who.Value.AccountId, parentId.Value,
                    Capability.Admin, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nadrzędnego nie ma.");
                return;
            }

            if (await PersonalOwnerAsync(connection, parentId.Value, ctx.RequestAborted) is not null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, PersonalStaysPersonal);
                return;
            }
        }

        /*
         * EIN Zertifikat genuegt: `admin`. Es schliesst `certify` ein
         * (Kernel 3.5, seit 2026-09-24) — wer einen Bereich fuehrt, laesst auch
         * hinein. Ein zweites `certify` nimmt der Dienst weiterhin an; so
         * schickten es die Browser bis dahin, und es schadet nicht.
         */
        var proofs = body.Certificates ?? [];

        if (!proofs.Any(p => Capabilities.TryParse(p.Capability, out var parsed) && parsed == Capability.Admin))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Brakuje zaświadczenia: obszar potrzebuje „admin”.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var records = new List<(CertificateRecord Record, byte[] Signature)>();

        foreach (var proof in proofs)
        {
            if (!Guid.TryParse(proof.Id, out var certificateId)
                || !Capabilities.TryParse(proof.Capability, out var capability))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelne zaświadczenie.");
                return;
            }

            var issuedAt = DateTimeOffset.FromUnixTimeSeconds(proof.IssuedAt);
            var expiresAt = DateTimeOffset.FromUnixTimeSeconds(proof.ExpiresAt);

            if (issuedAt > now + ClockSlack || issuedAt < now - ClockSlack)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Data podpisu nie zgadza się z zegarem.");
                return;
            }

            if (expiresAt <= issuedAt || expiresAt > now + MaxLife)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    $"Ważność: od jednego dnia do {MaxLife.Days / 365} lat.");
                return;
            }

            byte[] signature;
            try { signature = Base64Url.Decode(proof.Signature ?? string.Empty); }
            catch (FormatException)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny podpis.");
                return;
            }

            var record = new CertificateRecord
            {
                Id = certificateId,
                SubjectRoleId = roleId,
                ScopeKind = ScopeKind.Area,
                ScopeId = areaId,
                Capability = capability,
                IssuedByRoleId = roleId,
                IssuedUtc = issuedAt,
                ExpiresUtc = expiresAt
            };

            if (!Verify(record, issuer, signature))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis się nie zgadza.");
                return;
            }

            records.Add((record, signature));
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            await using (var area = new SqlCommand("""
                INSERT INTO app.area (id, name, current_epoch, created_at, parent_area_id, personal_role_id)
                VALUES (@id, @name, 1, @now, @parent, @personal);
                """, connection, tx))
            {
                area.Parameters.AddWithValue("@id", areaId);
                area.Parameters.AddWithValue("@name", name);
                area.Parameters.AddWithValue("@now", now);
                area.Parameters.AddWithValue("@parent", (object?)parentId ?? DBNull.Value);
                area.Parameters.AddWithValue("@personal", body.Personal == true ? roleId : DBNull.Value);
                await area.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using (var epoch = new SqlCommand("""
                INSERT INTO app.area_epoch (area_id, epoch, reason, cut_by_role_id, created_at)
                VALUES (@area, 1, N'initial', @role, @now);
                """, connection, tx))
            {
                epoch.Parameters.AddWithValue("@area", areaId);
                epoch.Parameters.AddWithValue("@role", roleId);
                epoch.Parameters.AddWithValue("@now", now);
                await epoch.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await GrantKeyAsync(connection, tx, roleId, areaId, 1, wrapped, roleId, now, ctx.RequestAborted);

            foreach (var (record, signature) in records)
            {
                await InsertCertificateAsync(connection, tx, record, signature, ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);

            /* Der eigene Bereich doppelt: zwei Fenster, ein erster privater Termin. Der erste gilt. */
            if (body.Personal == true)
            {
                ctx.Response.StatusCode = StatusCodes.Status409Conflict;
                await ctx.Response.WriteAsJsonAsync(new
                {
                    error = "Ta osoba ma już swój prywatny obszar.",
                    verdict = "personal-exists",
                    areaId = await PersonalAreaOfAsync(connection, roleId, ctx.RequestAborted) is Guid had ? Ids.ToText(had) : null
                });
                return;
            }

            await Fail(ctx, StatusCodes.Status409Conflict, "Taki obszar już istnieje.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(areaId),
            name,
            epoch = 1,
            roleId = Ids.ToText(roleId)
        });
    }

    internal const string PersonalStaysPersonal =
        "To Twoja prywatna przestrzeń — tylko Ty ją widzisz. Żeby coś pokazać innym, wybierz ich grupę.";

    /// <summary>Wem ein Bereich als eigener gehört — oder <c>null</c>: ein gewöhnlicher Bereich (0054).</summary>
    internal static async Task<Guid?> PersonalOwnerAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT personal_role_id FROM app.area WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", areaId);
        return await cmd.ExecuteScalarAsync(ct) is Guid owner ? owner : null;
    }

    /// <summary>Der eigene Bereich einer Person — oder <c>null</c>: noch keiner (0054).</summary>
    internal static async Task<Guid?> PersonalAreaOfAsync(SqlConnection connection, Guid roleId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT id FROM app.area WHERE personal_role_id = @role;", connection);
        cmd.Parameters.AddWithValue("@role", roleId);
        return await cmd.ExecuteScalarAsync(ct) is Guid found ? found : null;
    }
}
