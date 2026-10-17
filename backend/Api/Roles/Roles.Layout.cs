using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0034 NACHGEHOLT — eine Rolle der alten Form (<c>key_layout = 0</c>: EIN
/// Schlüssel öffnet Namen, Lesen UND Unterschreiben) bekommt ihren eigenen
/// Signierschlüssel (documentation/TRANSFER.md).
///
/// <para>
/// <b>Der Browser macht ihn, der Dienst trägt ein.</b> Der neue Schlüssel
/// versiegelt den privaten Signierschlüssel; jeder, der die Rolle FÜHRT (eine
/// Kante <c>holds</c>), bekommt ihn in einer Zuteilung <c>role_sign</c>,
/// verpackt mit seinem öffentlichen Schlüssel. Wer die Rolle nur liest oder
/// schreibt (<c>read</c>, <c>write</c>), bekommt keinen — das ist die Trennung,
/// die 0034 meint und die in der alten Form nicht galt.
/// </para>
///
/// <para>
/// <b>Alle oder keiner.</b> Die Liste der Führenden muss genau stimmen; sonst
/// stünde nach der Umstellung jemand da, der gestern unterschrieb und heute
/// nicht mehr kann, ohne dass es jemand entschieden hätte.
/// </para>
///
/// <para>Konten (<c>account</c>) bleiben in der alten Form: niemand hält sie, und ihr Schlüssel kommt aus dem Hauptschlüssel.</para>
/// </summary>
public static partial class Roles
{
    private static void MapLayout(WebApplication app)
    {
        app.MapGet("/workspace/roles/{id:guid}/leaders", LeadersAsync);
        app.MapPost("/workspace/roles/{id:guid}/layout", LayoutAsync);
    }

    public sealed record LayoutGrant(string HolderRoleId, string SealedBlob);
    public sealed record LayoutRequest(string SignPrivateSealed, List<LayoutGrant>? Grants);

    /// <summary>Wer die Rolle führt: eine Kante <c>holds</c> und den Rollenschlüssel.</summary>
    private static async Task<Dictionary<Guid, byte[]>> LeadersOfAsync(
        SqlConnection connection, SqlTransaction? tx, Guid roleId, CancellationToken ct)
    {
        var leaders = new Dictionary<Guid, byte[]>();
        await using var cmd = new SqlCommand("""
            SELECT DISTINCT h.id, h.wrap_public_key
              FROM app.role_edge e
              JOIN app.role h ON h.id = e.from_role_id AND h.revoked_at IS NULL
              JOIN app.key_grant g ON g.role_id = e.from_role_id AND g.key_ref = e.to_role_id
                                  AND g.key_kind = N'role' AND g.destroyed_at IS NULL
             WHERE e.to_role_id = @role AND e.edge_kind = N'holds' AND e.revoked_at IS NULL
               AND (e.expires_at IS NULL OR e.expires_at > SYSDATETIMEOFFSET());
            """, connection, tx);
        cmd.Parameters.AddWithValue("@role", roleId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) leaders[reader.GetGuid(0)] = (byte[])reader[1];
        return leaders;
    }

    private static async Task LeadersAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MayTouchAsync(ctx, db, connection, id)) return;

        var leaders = await LeadersOfAsync(connection, null, id, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new
        {
            leaders = leaders.Select(l => new { roleId = Ids.ToText(l.Key), wrapPublicKey = Base64Url.Encode(l.Value) })
        });
    }

    private static async Task LayoutAsync(HttpContext ctx, Db db, Guid id, LayoutRequest body)
    {
        if (!TryBlobs(ctx, out var fail, (body.SignPrivateSealed, "signPrivateSealed")))
        {
            await fail;
            return;
        }

        var wanted = new Dictionary<Guid, byte[]>();
        foreach (var grant in body.Grants ?? [])
        {
            if (!Guid.TryParse(grant.HolderRoleId, out var holder) || string.IsNullOrWhiteSpace(grant.SealedBlob))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny przydział klucza podpisu.");
                return;
            }

            try { wanted[holder] = Base64Url.Decode(grant.SealedBlob); }
            catch (FormatException) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny przydział klucza podpisu."); return; }
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MayTouchAsync(ctx, db, connection, id)) return;

        var who = await Auth.WhoAsync(ctx, db);
        var person = await PersonRoleAsync(connection, null, who!.Value.AccountId, ctx.RequestAborted);
        if (person is null) { await Fail(ctx, StatusCodes.Status403Forbidden, "Nie masz jeszcze roli osobistej."); return; }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        string? kind;
        await using (var read = new SqlCommand(
            "SELECT kind FROM app.role WITH (UPDLOCK) WHERE id = @id AND key_layout = 0 AND revoked_at IS NULL;", connection, tx))
        {
            read.Parameters.AddWithValue("@id", id);
            kind = await read.ExecuteScalarAsync(ctx.RequestAborted) as string;
        }

        if (kind is null or "account")
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, kind is null
                ? "Ta rola ma już osobny klucz podpisu."
                : "Konto zostaje przy jednym kluczu — nikt inny go nie trzyma.");
            return;
        }

        var leaders = await LeadersOfAsync(connection, tx, id, ctx.RequestAborted);

        /* Ohne Führende könnte danach niemand mehr in ihrem Namen unterschreiben. */
        if (leaders.Count == 0)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Tej roli nikt nie prowadzi — najpierw daj komuś prowadzenie.");
            return;
        }

        if (leaders.Count != wanted.Count || leaders.Keys.Any(l => !wanted.ContainsKey(l)))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Kto prowadzi tę rolę, zmieniło się w międzyczasie — wczytaj ją ponownie.");
            return;
        }

        await using (var update = new SqlCommand("""
            UPDATE app.role SET sign_private_sealed = @sealed, key_layout = 1
             WHERE id = @id AND key_layout = 0 AND revoked_at IS NULL;
            """, connection, tx))
        {
            update.Parameters.AddWithValue("@id", id);
            update.Parameters.AddWithValue("@sealed", Base64Url.Decode(body.SignPrivateSealed));
            await update.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        foreach (var (holder, blob) in wanted)
        {
            await InsertGrantAsync(connection, tx, holder, id, blob, person.Value, ctx.RequestAborted, "role_sign");
        }

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { roleId = Ids.ToText(id), keyLayout = 1, leaders = wanted.Count });
    }
}
