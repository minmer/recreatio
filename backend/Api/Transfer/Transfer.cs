using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DIE ÜBERTRAGUNG (2026-10-17) — was in der Datenbank noch in einer älteren
/// Form steht, in die heutige bringen (documentation/TRANSFER.md).
///
/// <para>
/// <b>Wer was tut.</b> Was ohne Schlüssel geht, tut der Dienst — hier: die
/// Zasady alter Rozmowy ausschreiben. Was Schlüssel braucht, tut der Browser
/// nach der Anmeldung (Konto → „Przeniesienie danych", <c>account/transfer.ts</c>)
/// mit den Endpunkten, die es dafür schon gibt, und mit
/// <c>/workspace/roles/{id}/layout</c>.
/// </para>
///
/// <para>
/// <b>Die Übersicht zählt nur.</b> Sie sagt, wie viel von jeder Art noch übrig
/// ist — in der ganzen Datenbank, damit man weiss, wann Schritt 3 (das
/// Wegräumen der Rückwärtsverträglichkeit) gefahrlos ist —, und welche Formulare
/// mit RSA-Umschlägen dieser Mensch selbst umstellen kann. Inhalte gibt sie
/// keine heraus.
/// </para>
///
/// <para>Diese Datei geht in Schritt 3 mit dem Rest.</para>
/// </summary>
public static class Transfer
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/transfer", StatusAsync);
        app.MapPost("/workspace/transfer/chats", ChatsAsync);
    }

    /* -- Was noch übrig ist ----------------------------------------------------- */

    private static async Task StatusAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT
              (SELECT COUNT(*) FROM app.chat WHERE posting_policy = N'legacy'),
              (SELECT COUNT(*) FROM app.module WHERE controller_name IS NOT NULL),
              (SELECT COUNT(*) FROM app.module WHERE config LIKE N'%"sms":%'),
              (SELECT COUNT(*) FROM app.account a
                 JOIN app.role r ON r.id = a.person_role_id AND r.kind = N'account'
                WHERE EXISTS (SELECT 1 FROM app.certificate c WHERE c.subject_role_id = r.id AND c.scope_kind = N'area'
                                AND c.revoked_at IS NULL AND c.expires_at > SYSDATETIMEOFFSET())
                   OR EXISTS (SELECT 1 FROM app.key_grant g WHERE g.role_id = r.id AND g.key_kind = N'epoch' AND g.destroyed_at IS NULL)
                   OR EXISTS (SELECT 1 FROM app.intake i WHERE i.sealed_for_role_id = r.id)
                   OR EXISTS (SELECT 1 FROM app.slug s WHERE s.claimed_by_role_id = r.id OR s.internal_for_role_id = r.id)
                   OR EXISTS (SELECT 1 FROM app.calendar_item ci WHERE ci.owner_role_id = r.id)),
              (SELECT COUNT(*) FROM app.role r
                WHERE r.key_layout = 0 AND r.kind <> N'account' AND r.revoked_at IS NULL
                  AND EXISTS (SELECT 1 FROM app.key_grant g WHERE g.key_ref = r.id AND g.key_kind = N'role' AND g.destroyed_at IS NULL)),
              (SELECT COUNT(*) FROM app.role r
                WHERE r.kind <> N'account' AND r.revoked_at IS NULL
                  AND NOT EXISTS (SELECT 1 FROM app.account a WHERE a.person_role_id = r.id)
                  AND NOT EXISTS (SELECT 1 FROM app.key_grant g WHERE g.key_ref = r.id AND g.key_kind = N'role' AND g.destroyed_at IS NULL)
                  AND NOT EXISTS (SELECT 1 FROM app.role_edge e WHERE e.to_role_id = r.id AND e.revoked_at IS NULL)),
              (SELECT COUNT(*) FROM app.registration_value WHERE wrapped_key IS NOT NULL AND office_key_sealed IS NULL),
              (SELECT COUNT(*) FROM app.access WHERE recipient_name IS NOT NULL)
                + (SELECT COUNT(*) FROM app.claim WHERE holder_name IS NOT NULL)
                + (SELECT COUNT(*) FROM app.module WHERE kind = N'form' AND name IS NOT NULL AND name_sealed IS NULL);
            """, connection);

        int chats, controllers, sms, accounts, layouts, unheld, rsa, plainNames;
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            await reader.ReadAsync(ctx.RequestAborted);
            chats = reader.GetInt32(0); controllers = reader.GetInt32(1); sms = reader.GetInt32(2);
            accounts = reader.GetInt32(3); layouts = reader.GetInt32(4); unheld = reader.GetInt32(5);
            rsa = reader.GetInt32(6); plainNames = reader.GetInt32(7);
        }

        /* Formulare mit RSA-Umschlägen, deren Bereich dieser Mensch liest: dort kann sein Browser umstellen. */
        var forms = new List<object>();
        var pending = new List<(Guid Module, Guid? Area, int Values)>();
        await using (var rsaCmd = new SqlCommand("""
            SELECT g.part_id, m.area_id, COUNT(*)
              FROM app.registration_value v
              JOIN app.registration g ON g.id = v.registration_id
              JOIN app.module m ON m.id = g.part_id
             WHERE v.wrapped_key IS NOT NULL AND v.office_key_sealed IS NULL
             GROUP BY g.part_id, m.area_id;
            """, connection))
        {
            await using var reader = await rsaCmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                pending.Add((reader.GetGuid(0), reader.IsDBNull(1) ? null : reader.GetGuid(1), reader.GetInt32(2)));
        }

        foreach (var (module, area, values) in pending)
        {
            if (area is Guid a && await Area.MayAsync(connection, who.Value.AccountId, a, Capability.Read, ctx.RequestAborted))
                forms.Add(new { moduleId = Ids.ToText(module), values });
        }

        /* Alte Zasady in Rozmowy, deren Bereich dieser Mensch führt — die stellt sein Knopf um. */
        var chatsMine = 0;
        foreach (var area in await LegacyChatAreasAsync(connection, ctx.RequestAborted))
        {
            if (await Area.MayAsync(connection, who.Value.AccountId, area, Capability.Admin, ctx.RequestAborted)) chatsMine++;
        }

        var schemas = new List<string>();
        await using (var schemaCmd = new SqlCommand("""
            SELECT s.name FROM sys.schemas s
             WHERE s.schema_id BETWEEN 5 AND 16383 AND s.name <> N'app'
               /* das eigene Schema des Datenbankbenutzers (seine Vorgabe) bleibt */
               AND s.name <> SCHEMA_NAME()
               AND NOT EXISTS (SELECT 1 FROM sys.objects o WHERE o.schema_id = s.schema_id)
             ORDER BY s.name;
            """, connection))
        {
            await using var reader = await schemaCmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) schemas.Add(reader.GetString(0));
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            /* Was noch übrig ist — in der ganzen Datenbank. */
            chats, controllers, sms, accounts, layouts, rsa, plainNames,
            chatsMine,
            /* Rollen ohne jeden Halter: niemand öffnet sie mehr (Schritt 3 räumt sie weg). */
            unheld,
            rsaForms = forms,
            migrations = await Migrate.UnrecordedAsync(connection, ctx.RequestAborted),
            legacySchemas = schemas
        });
    }

    /* -- Die Zasady der Rozmowy ausschreiben ------------------------------------- */

    /// <summary>Die Bereiche der Rozmowy, die noch `legacy` tragen — eine Zeile je Rozmowa.</summary>
    private static async Task<List<Guid>> LegacyChatAreasAsync(SqlConnection connection, CancellationToken ct)
    {
        var areas = new List<Guid>();
        await using var cmd = new SqlCommand("SELECT area_id FROM app.chat WHERE posting_policy = N'legacy';", connection);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) areas.Add(reader.GetGuid(0));
        return areas;
    }

    /// <summary>
    /// `legacy` → was es heisst (<see cref="ChatRules.Explicit"/>) — für jede
    /// Rozmowa, deren Bereich dieser Mensch führt. Am Verhalten ändert das
    /// nichts; danach braucht niemand mehr das Wort `legacy`.
    /// </summary>
    private static async Task ChatsAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var legacy = new List<(Guid Id, Guid Area, string Kind)>();
        await using (var cmd = new SqlCommand(
            "SELECT id, area_id, kind FROM app.chat WHERE posting_policy = N'legacy';", connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                legacy.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2)));
        }

        var converted = 0;
        var skipped = 0;

        foreach (var (id, area, kind) in legacy)
        {
            if (!await Area.MayAsync(connection, who.Value.AccountId, area, Capability.Admin, ctx.RequestAborted))
            {
                skipped++;
                continue;
            }

            await using var update = new SqlCommand(
                "UPDATE app.chat SET posting_policy = @policy WHERE id = @id AND posting_policy = N'legacy';", connection);
            update.Parameters.AddWithValue("@id", id);
            update.Parameters.AddWithValue("@policy", ChatRules.Explicit(kind, "legacy"));
            converted += await update.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { converted, skipped });
    }
}
