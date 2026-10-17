using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DIE ÜBERTRAGUNG — was nach Schritt 3 noch übrig ist (documentation/TRANSFER.md).
///
/// <para>
/// <b>Antworten in RSA-Umschlägen</b>, die der gewöhnliche Weg der Kanzlei
/// (0037) nicht umstellt: sie liegen unter der Annahme eines ANDEREN Bereichs.
/// Das kann nur der Browser des Kontos, das beide Annahmen hält (Konto →
/// „Przeniesienie danych", <c>forms/rewrap.ts</c>). Hier steht, wie viele es
/// sind, und welche Formulare dieser Mensch selbst umstellen kann.
/// </para>
///
/// <para>
/// <b>Was der Server noch aufzuräumen hat</b> — Skripte ohne Eintrag, leere
/// Schemata des alten Systems, Rollen, die niemand mehr hält. Nur Zahlen;
/// aufgeräumt wird mit <c>migrate</c>.
/// </para>
///
/// <para>Steht alles auf null, geht diese Datei mit der Seite im Browser.</para>
/// </summary>
public static class Transfer
{
    public static void Map(WebApplication app) => app.MapGet("/workspace/transfer", StatusAsync);

    private static async Task StatusAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        int rsa, unheld;
        await using (var cmd = new SqlCommand("""
            SELECT
              (SELECT COUNT(*) FROM app.registration_value WHERE wrapped_key IS NOT NULL AND office_key_sealed IS NULL),
              (SELECT COUNT(*) FROM app.role r
                WHERE r.kind <> N'account' AND r.revoked_at IS NULL
                  AND NOT EXISTS (SELECT 1 FROM app.account a WHERE a.person_role_id = r.id)
                  AND NOT EXISTS (SELECT 1 FROM app.key_grant g WHERE g.key_ref = r.id AND g.key_kind = N'role' AND g.destroyed_at IS NULL)
                  AND NOT EXISTS (SELECT 1 FROM app.role_edge e WHERE e.to_role_id = r.id AND e.revoked_at IS NULL));
            """, connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            await reader.ReadAsync(ctx.RequestAborted);
            rsa = reader.GetInt32(0);
            unheld = reader.GetInt32(1);
        }

        /* Formulare mit RSA-Umschlägen, deren Bereich dieser Mensch liest: dort kann sein Browser umstellen. */
        var pending = new List<(Guid Module, Guid? Area, int Values)>();
        await using (var cmd = new SqlCommand("""
            SELECT g.part_id, m.area_id, COUNT(*)
              FROM app.registration_value v
              JOIN app.registration g ON g.id = v.registration_id
              JOIN app.module m ON m.id = g.part_id
             WHERE v.wrapped_key IS NOT NULL AND v.office_key_sealed IS NULL
             GROUP BY g.part_id, m.area_id;
            """, connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                pending.Add((reader.GetGuid(0), reader.IsDBNull(1) ? null : reader.GetGuid(1), reader.GetInt32(2)));
        }

        var forms = new List<object>();
        foreach (var (module, area, values) in pending)
        {
            if (area is Guid a && await Area.MayAsync(connection, who.Value.AccountId, a, Capability.Read, ctx.RequestAborted))
                forms.Add(new { moduleId = Ids.ToText(module), values });
        }

        var schemas = new List<string>();
        await using (var cmd = new SqlCommand("""
            SELECT s.name FROM sys.schemas s
             WHERE s.schema_id BETWEEN 5 AND 16383 AND s.name <> N'app'
               /* das eigene Schema des Datenbankbenutzers (seine Vorgabe) bleibt */
               AND s.name <> SCHEMA_NAME()
               AND NOT EXISTS (SELECT 1 FROM sys.objects o WHERE o.schema_id = s.schema_id)
             ORDER BY s.name;
            """, connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) schemas.Add(reader.GetString(0));
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            rsa,
            rsaForms = forms,
            migrations = await Migrate.UnrecordedAsync(connection, ctx.RequestAborted),
            legacySchemas = schemas,
            /* Rollen ohne jeden Halter: niemand öffnet sie mehr. */
            unheld
        });
    }
}
