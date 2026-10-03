using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// DAS KONTO LÖSCHEN — vom Menschen selbst, in der App wie im Browser.
///
/// <para>
/// <b>Was „das Konto" ist.</b> Das Konto und jede Rolle, die NUR von ihm aus
/// gehalten wird: seine Personen, und ein Amt, das sonst niemand hält. Eine
/// Rolle, die auch ein anderes Konto hält (das Sekretariat), bleibt — es geht
/// nur die Kante dorthin.
/// </para>
///
/// <code>
///   gelöscht            Anmeldung, Sitzungen, verwahrte Schlüssel, gemerkter
///                       Stand; die privaten Schlüssel und Namen der Rollen;
///                       Personendaten; eigene Nachrichten (nur der Inhalt —
///                       im Gespräch steht „usunięta"); künftige Buchungen;
///                       Bereiche, die NUR diese Rollen halten und die niemand
///                       sonst sieht (der eigene Kalender, eine private Gruppe)
///   bleibt              was einer Gemeinschaft gehört: Anmeldungen zu ihren
///                       Formularen, vergangene Termine, Seiten, Bereiche mit
///                       anderen Mitgliedern oder Plätzen
/// </code>
///
/// <para>
/// <b>Die Rollen bleiben als Grabstein.</b> Die Zeile bleibt (widerrufen, ohne
/// privaten Schlüssel, ohne Namen), weil fremde Zeilen auf sie zeigen: ein
/// Zertifikat, das diese Person einem anderen ausgestellt hat, eine Kante, die
/// sie unterschrieben hat. Löschte man sie, verlöre ein anderer sein Recht.
/// Ohne privaten Schlüssel und ohne Hauptschlüssel öffnet sie nichts mehr.
/// </para>
///
/// <para>
/// <b>Mit dem Passwort, nicht nur mit der Sitzung.</b> Ein vergessenes offenes
/// Telefon soll ein Konto nicht in einem Handgriff vernichten können.
/// </para>
/// </summary>
public static class AccountDeletion
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/auth/account/deletion", PreviewAsync);
        app.MapPost("/auth/account/delete", DeleteAsync);
    }

    public sealed record DeleteRequest(string LoginId, string PasswordKeyBase64Url);

    /* -- Vorschau ----------------------------------------------------------- */

    /// <summary>
    /// Was geschähe — ohne dass etwas geschieht. Die Oberfläche zeigt es vor
    /// dem Knopf: besonders, was danach NIEMAND mehr öffnen kann.
    /// </summary>
    private static async Task PreviewAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var doomed = await DoomedAsync(connection, null, who.Value.AccountId, ctx.RequestAborted);
        await AnalyseAsync(connection, null, doomed, ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT
                (SELECT COUNT(*) FROM #doomed d JOIN app.role r ON r.id = d.id WHERE r.kind = N'person'),
                (SELECT COUNT(*) FROM app.chat_message
                  WHERE author_role_id IN (SELECT id FROM #doomed) AND deleted_at IS NULL),
                (SELECT COUNT(*) FROM app.account_key WHERE account_id = @account);

            SELECT d.id FROM #doomed d JOIN app.role r ON r.id = d.id WHERE r.kind IN (N'role', N'group');

            SELECT a.id, a.name, CASE WHEN a.personal_role_id IN (SELECT id FROM #doomed) THEN 1 ELSE 0 END
            FROM app.area a WHERE a.id IN (SELECT id FROM #dead) ORDER BY a.name;

            SELECT a.id, a.name FROM app.area a WHERE a.id IN (SELECT id FROM #orphan) ORDER BY a.name;

            SELECT path FROM app.slug WHERE claimed_by_role_id IN (SELECT id FROM #doomed) ORDER BY path;
            """, connection);
        cmd.Parameters.AddWithValue("@account", who.Value.AccountId);

        int persons, messages, devices;
        var offices = new List<string>();
        var deleted = new List<object>();
        var orphaned = new List<object>();
        var pages = new List<string>();

        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            await reader.ReadAsync(ctx.RequestAborted);
            persons = reader.GetInt32(0);
            messages = reader.GetInt32(1);
            devices = reader.GetInt32(2);

            await reader.NextResultAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) offices.Add(Ids.ToText(reader.GetGuid(0)));

            await reader.NextResultAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                deleted.Add(new { id = Ids.ToText(reader.GetGuid(0)), name = reader.GetString(1), personal = reader.GetInt32(2) == 1 });

            await reader.NextResultAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                orphaned.Add(new { id = Ids.ToText(reader.GetGuid(0)), name = reader.GetString(1) });

            await reader.NextResultAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) pages.Add(reader.GetString(0));
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            loginId = who.Value.LoginId,
            persons,
            messages,
            devices,
            offices,
            deletedAreas = deleted,
            orphanedAreas = orphaned,
            pages
        });
    }

    /* -- Löschen ------------------------------------------------------------ */

    private static async Task DeleteAsync(HttpContext ctx, Db db, IConfiguration config, DeleteRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        /* Der Name wird getippt, nicht angeklickt: niemand löscht aus Versehen „das da". */
        if (!string.Equals((body.LoginId ?? string.Empty).Trim(), who.Value.LoginId, StringComparison.OrdinalIgnoreCase))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Wpisz dokładnie nazwę swojego konta.");
            return;
        }

        byte[] passwordKey;
        try { passwordKey = Base64Url.Decode(body.PasswordKeyBase64Url ?? string.Empty); }
        catch (FormatException) { passwordKey = []; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        try
        {
            if (passwordKey.Length != Password.OutputBytes
                || !await PasswordMatchesAsync(connection, who.Value.AccountId, passwordKey, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Hasło się nie zgadza.");
                return;
            }
        }
        finally
        {
            CryptographicOperations.ZeroMemory(passwordKey);
        }

        var attachments = new List<Guid>();
        var removed = new Dictionary<string, int>();

        await using (var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted))
        {
            var doomed = await DoomedAsync(connection, tx, who.Value.AccountId, ctx.RequestAborted);
            await AnalyseAsync(connection, tx, doomed, ctx.RequestAborted);

            await using var cmd = new SqlCommand(Delete, connection, tx) { CommandTimeout = 120 };
            cmd.Parameters.AddWithValue("@account", who.Value.AccountId);
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
            {
                // Erst die Dateien der Anhänge, dann die Zählung.
                while (await reader.ReadAsync(ctx.RequestAborted)) attachments.Add(reader.GetGuid(0));
                await reader.NextResultAsync(ctx.RequestAborted);
                if (await reader.ReadAsync(ctx.RequestAborted))
                {
                    for (var i = 0; i < reader.FieldCount; i++) removed[reader.GetName(i)] = reader.GetInt32(i);
                }
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }

        /*
         * Die Anhänge liegen als Dateien neben der Datenbank. Erst NACH dem
         * Commit: scheiterte die Transaktion, wären sonst Dateien fort, auf die
         * noch Nachrichten zeigen. Bleibt hier eine liegen, ist sie versiegelt
         * und ohne Zeile — Rauschen, das niemand mehr adressiert.
         */
        foreach (var id in attachments)
        {
            try { File.Delete(Chat.AttachmentFile(config, id)); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }

        ctx.Response.Cookies.Delete(Auth.Cookie, new CookieOptions
        {
            HttpOnly = true, Secure = true, SameSite = SameSiteMode.None, Path = "/"
        });

        await ctx.Response.WriteAsJsonAsync(new { ok = true, removed });
    }

    private static async Task<bool> PasswordMatchesAsync(
        SqlConnection connection, Guid accountId, byte[] passwordKey, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT login_salt, login_verifier FROM app.account WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", accountId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return false;

        return Password.VerifyLogin(passwordKey, (byte[])reader[0], (byte[])reader[1]);
    }

    /* -- Was NUR diesem Konto gehört ----------------------------------------- */

    /// <summary>
    /// Die Rollen, die von diesem Konto aus gehalten werden und von keinem
    /// anderen. Gerechnet im Kernel (<see cref="RoleGraph"/>) und nicht als
    /// rekursive Abfrage: dort ist die besuchte Menge der Schutz vor Kreisen.
    ///
    /// <para>
    /// Nur <c>holds</c>-Kanten zählen — wie bei <c>Workspace.RolesOfAsync</c>.
    /// Wer eine Rolle nur lesen darf, hält sie nicht; sie gehört dann trotzdem
    /// allein diesem Konto.
    /// </para>
    /// </summary>
    private static async Task<HashSet<Guid>> DoomedAsync(
        SqlConnection connection, SqlTransaction? tx, Guid accountId, CancellationToken ct)
    {
        var edges = new List<RoleGraph.Edge>();
        var others = new List<Guid>();
        Guid? root = null;

        await using (var cmd = new SqlCommand("""
            SELECT from_role_id, to_role_id FROM app.role_edge
            WHERE revoked_at IS NULL AND edge_kind = N'holds';

            SELECT id, person_role_id FROM app.account WHERE person_role_id IS NOT NULL;
            """, connection, tx))
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct)) edges.Add(new RoleGraph.Edge(reader.GetGuid(0), reader.GetGuid(1)));

            await reader.NextResultAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                if (reader.GetGuid(0) == accountId) root = reader.GetGuid(1);
                else others.Add(reader.GetGuid(1));
            }
        }

        if (root is null) return [];

        var doomed = RoleGraph.Reachable(root.Value, edges);
        doomed.ExceptWith(RoleGraph.ReachableFromAll(others, edges));
        return doomed;
    }

    /// <summary>
    /// Legt die Arbeitstabellen an und füllt sie: welche Bereiche diese Rollen
    /// berühren, welche davon mit ihnen sterben (privat) und welche ohne
    /// Schlüsselhalter zurückbleiben (gemeinsam).
    ///
    /// <para>
    /// Temporäre Tabellen der SITZUNG, nicht der Anweisung: angelegt in einem
    /// Stapel ohne Parameter, damit die folgenden Befehle auf derselben
    /// Verbindung sie noch sehen. Die Verbindung geht danach in den Pool, und
    /// der räumt sie ab.
    /// </para>
    /// </summary>
    private static async Task AnalyseAsync(
        SqlConnection connection, SqlTransaction? tx, HashSet<Guid> doomed, CancellationToken ct)
    {
        await using (var create = new SqlCommand("""
            CREATE TABLE #doomed (id uniqueidentifier PRIMARY KEY);
            CREATE TABLE #touched (id uniqueidentifier PRIMARY KEY);
            CREATE TABLE #dead (id uniqueidentifier PRIMARY KEY);
            CREATE TABLE #orphan (id uniqueidentifier PRIMARY KEY);
            """, connection, tx))
        {
            await create.ExecuteNonQueryAsync(ct);
        }

        foreach (var chunk in doomed.Chunk(500))
        {
            await using var insert = new SqlCommand(
                "INSERT INTO #doomed (id) VALUES " + string.Join(", ", chunk.Select((_, i) => $"(@d{i})")) + ";",
                connection, tx);
            for (var i = 0; i < chunk.Length; i++) insert.Parameters.AddWithValue($"@d{i}", chunk[i]);
            await insert.ExecuteNonQueryAsync(ct);
        }

        await using var analyse = new SqlCommand(Analyse, connection, tx);
        await analyse.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Ein Bereich stirbt mit, wenn ihn NUR diese Rollen halten und er nach
    /// aussen nichts ist: nicht öffentlich, keine Plätze (Menschen mit Link),
    /// keine Seite, kein Baustein auf einer Seite, kein fremdes Formularfeld,
    /// das für ihn versiegelt. Sonst bleibt er stehen — ohne Schlüsselhalter,
    /// und die Vorschau sagt das vorher.
    /// </summary>
    private const string Analyse = """
        INSERT INTO #touched (id)
        SELECT key_ref FROM app.key_grant
         WHERE key_kind = N'epoch' AND role_id IN (SELECT id FROM #doomed)
        UNION
        SELECT scope_id FROM app.certificate
         WHERE scope_kind = N'area' AND subject_role_id IN (SELECT id FROM #doomed)
        UNION
        SELECT id FROM app.area WHERE personal_role_id IN (SELECT id FROM #doomed);

        DELETE FROM #touched WHERE id NOT IN (SELECT id FROM app.area);

        -- Hält ihn noch jemand anderes? Dann bleibt er, ganz gleich was sonst.
        DELETE FROM #touched
        WHERE EXISTS (SELECT 1 FROM app.key_grant g
                       WHERE g.key_kind = N'epoch' AND g.key_ref = #touched.id
                         AND g.destroyed_at IS NULL
                         AND g.role_id NOT IN (SELECT id FROM #doomed))
           OR EXISTS (SELECT 1 FROM app.certificate c
                       WHERE c.scope_kind = N'area' AND c.scope_id = #touched.id
                         AND c.revoked_at IS NULL
                         AND c.subject_role_id NOT IN (SELECT id FROM #doomed));

        INSERT INTO #dead (id)
        SELECT a.id FROM app.area a
        WHERE a.id IN (SELECT id FROM #touched)
          AND a.public_level = N'none'
          AND NOT EXISTS (SELECT 1 FROM app.access x WHERE x.area_id = a.id)
          AND NOT EXISTS (SELECT 1 FROM app.access_grant x WHERE x.area_id = a.id)
          AND NOT EXISTS (SELECT 1 FROM app.slug_area s WHERE s.area_id = a.id)
          AND NOT EXISTS (SELECT 1 FROM app.area_portal p WHERE p.area_id = a.id)
          AND NOT EXISTS (SELECT 1 FROM app.module m JOIN app.slug_part sp ON sp.module_id = m.id
                           WHERE m.area_id = a.id)
          AND NOT EXISTS (SELECT 1 FROM app.slug_field f
                           WHERE (f.area_id = a.id OR f.label_area_id = a.id)
                             AND f.part_id NOT IN (SELECT id FROM app.module WHERE area_id = a.id));

        INSERT INTO #orphan (id)
        SELECT id FROM #touched WHERE id NOT IN (SELECT id FROM #dead);
        """;

    /// <summary>
    /// Das Löschen selbst — in der Reihenfolge der Fremdschlüssel (alle ohne
    /// Kaskade). Zuerst die sterbenden Bereiche mit allem, was an ihnen hängt;
    /// dann, was die Rollen anderswo hinterlassen; zuletzt das Konto.
    ///
    /// <para>
    /// Die Tabellen der Gesprächsfunktionen (0060) werden nur angefasst, wenn es
    /// sie gibt: der Stapel wird erst beim Ausführen einer Anweisung aufgelöst,
    /// und eine übersprungene fragt nicht nach ihrer Tabelle.
    /// </para>
    /// </summary>
    private const string Delete = """
        SET XACT_ABORT ON;

        CREATE TABLE #cals (id uniqueidentifier PRIMARY KEY);
        CREATE TABLE #items (id uniqueidentifier PRIMARY KEY);
        CREATE TABLE #mods (id uniqueidentifier PRIMARY KEY);
        CREATE TABLE #chats (id uniqueidentifier PRIMARY KEY);
        CREATE TABLE #files (id uniqueidentifier PRIMARY KEY);

        INSERT INTO #cals (id) SELECT id FROM app.calendar WHERE area_id IN (SELECT id FROM #dead);
        INSERT INTO #items (id)
        SELECT id FROM app.calendar_item
        WHERE calendar_id IN (SELECT id FROM #cals) OR visibility_area_id IN (SELECT id FROM #dead);
        INSERT INTO #mods (id) SELECT id FROM app.module WHERE area_id IN (SELECT id FROM #dead);
        INSERT INTO #chats (id) SELECT id FROM app.chat WHERE area_id IN (SELECT id FROM #dead);

        DECLARE @areas int = (SELECT COUNT(*) FROM #dead);
        DECLARE @messages int = (SELECT COUNT(*) FROM app.chat_message
                                  WHERE author_role_id IN (SELECT id FROM #doomed) AND deleted_at IS NULL);

        -- ===== Die sterbenden Bereiche ====================================

        -- Fremdes, das nur auf sie ZEIGT, zeigt künftig ins Leere statt ins Nichts.
        UPDATE app.calendar SET visibility_area_id = NULL
         WHERE visibility_area_id IN (SELECT id FROM #dead) AND id NOT IN (SELECT id FROM #cals);
        UPDATE app.calendar_item SET reserve_area_id = NULL
         WHERE reserve_area_id IN (SELECT id FROM #dead) AND id NOT IN (SELECT id FROM #items);
        UPDATE app.resource SET reserve_area_id = NULL
         WHERE reserve_area_id IN (SELECT id FROM #dead) AND area_id NOT IN (SELECT id FROM #dead);
        UPDATE app.resource SET calendar_id = NULL
         WHERE calendar_id IN (SELECT id FROM #cals) AND area_id NOT IN (SELECT id FROM #dead);
        UPDATE app.area SET parent_area_id = NULL
         WHERE parent_area_id IN (SELECT id FROM #dead) AND id NOT IN (SELECT id FROM #dead);
        UPDATE app.module SET extends_id = NULL
         WHERE extends_id IN (SELECT id FROM #mods) AND id NOT IN (SELECT id FROM #mods);
        -- 0070: ein Teil eines sterbenden Termins, der selbst bleibt, wird ein eigener Termin.
        UPDATE app.calendar_item SET parent_item_id = NULL
         WHERE parent_item_id IN (SELECT id FROM #items) AND id NOT IN (SELECT id FROM #items);

        -- Termine
        DELETE FROM app.mass_intention_field
         WHERE intention_id IN (SELECT id FROM app.mass_intention WHERE item_id IN (SELECT id FROM #items))
            OR area_id IN (SELECT id FROM #dead);
        DELETE FROM app.mass_intention    WHERE item_id IN (SELECT id FROM #items);
        DELETE FROM app.calendar_presence WHERE item_id IN (SELECT id FROM #items);
        DELETE FROM app.calendar_field    WHERE item_id IN (SELECT id FROM #items) OR area_id IN (SELECT id FROM #dead);
        DELETE FROM app.calendar_exception WHERE item_id IN (SELECT id FROM #items);
        DELETE FROM app.offer_state
         WHERE item_id IN (SELECT id FROM #items)
            OR resource_id IN (SELECT id FROM app.resource WHERE area_id IN (SELECT id FROM #dead));
        DELETE FROM app.claim
         WHERE item_id IN (SELECT id FROM #items)
            OR resource_id IN (SELECT id FROM app.resource WHERE area_id IN (SELECT id FROM #dead));
        DELETE FROM app.slot_booking WHERE item_id IN (SELECT id FROM #items);
        DELETE FROM app.slot_request WHERE item_id IN (SELECT id FROM #items);
        DELETE FROM app.item_slot    WHERE item_id IN (SELECT id FROM #items);

        -- Dinge: Kinder vor Eltern (ein Zimmer zeigt auf sein Haus).
        WHILE EXISTS (SELECT 1 FROM app.resource WHERE area_id IN (SELECT id FROM #dead))
            DELETE FROM app.resource
             WHERE area_id IN (SELECT id FROM #dead)
               AND id NOT IN (SELECT parent_id FROM app.resource WHERE parent_id IS NOT NULL);

        DELETE FROM app.calendar_item WHERE id IN (SELECT id FROM #items);
        DELETE FROM app.calendar      WHERE id IN (SELECT id FROM #cals);

        -- Gespräche
        IF OBJECT_ID(N'app.chat_mark', N'U') IS NOT NULL
            DELETE FROM app.chat_mark
             WHERE message_id IN (SELECT id FROM app.chat_message WHERE chat_id IN (SELECT id FROM #chats));
        IF OBJECT_ID(N'app.chat_attachment', N'U') IS NOT NULL
        BEGIN
            INSERT INTO #files (id) SELECT id FROM app.chat_attachment WHERE chat_id IN (SELECT id FROM #chats);
            DELETE FROM app.chat_attachment WHERE chat_id IN (SELECT id FROM #chats);
        END
        IF OBJECT_ID(N'app.chat_presence', N'U') IS NOT NULL
            DELETE FROM app.chat_presence WHERE chat_id IN (SELECT id FROM #chats);
        IF OBJECT_ID(N'app.chat_preference', N'U') IS NOT NULL
            DELETE FROM app.chat_preference
             WHERE scope_id IN (SELECT id FROM #chats) OR scope_id IN (SELECT id FROM #dead);
        DELETE FROM app.chat_message_version
         WHERE message_id IN (SELECT id FROM app.chat_message WHERE chat_id IN (SELECT id FROM #chats));
        -- 0080/0081: Formulare an einer Rozmowa oder an „Napisz do nas" (Audience) — von beiden Seiten her.
        IF OBJECT_ID(N'app.audience_form', N'U') IS NOT NULL
            DELETE FROM app.audience_form
             WHERE (subject_kind = N'chat' AND subject_id IN (SELECT id FROM #chats))
                OR (subject_kind = N'module' AND subject_id IN (SELECT id FROM #mods))
                OR module_id IN (SELECT id FROM #mods);
        DELETE FROM app.chat_read     WHERE chat_id IN (SELECT id FROM #chats);
        DELETE FROM app.chat_seat_key WHERE chat_id IN (SELECT id FROM #chats);
        DELETE FROM app.chat_message  WHERE chat_id IN (SELECT id FROM #chats);
        -- 0068: die Themen gehören zur Rozmowa.
        IF COL_LENGTH('app.topic', 'chat_id') IS NOT NULL
            DELETE FROM app.topic WHERE chat_id IN (SELECT id FROM #chats);
        DELETE FROM app.chat          WHERE id IN (SELECT id FROM #chats);

        -- Aufgaben
        DELETE FROM app.task_done WHERE task_id IN (SELECT id FROM app.task WHERE area_id IN (SELECT id FROM #dead));
        DELETE FROM app.task      WHERE area_id IN (SELECT id FROM #dead);

        -- Bibliotheken (0064) — mit allem, was darin steht, auch dem Veröffentlichten
        IF OBJECT_ID('app.library', 'U') IS NOT NULL
        BEGIN
            DELETE FROM app.library_public_ref
             WHERE entry_id IN (SELECT e.id FROM app.library_entry e JOIN app.library l ON l.id = e.library_id WHERE l.area_id IN (SELECT id FROM #dead))
                OR ref_id   IN (SELECT e.id FROM app.library_entry e JOIN app.library l ON l.id = e.library_id WHERE l.area_id IN (SELECT id FROM #dead));
            DELETE FROM app.library_entry WHERE library_id IN (SELECT id FROM app.library WHERE area_id IN (SELECT id FROM #dead));
            DELETE FROM app.library       WHERE area_id IN (SELECT id FROM #dead);
        END

        -- Adressen und Haushalte (0071): das Verzeichnis eines Gebiets geht mit ihm.
        IF OBJECT_ID('app.household', 'U') IS NOT NULL
        BEGIN
            DELETE FROM app.household     WHERE area_id IN (SELECT id FROM #dead)
                                             OR place_id IN (SELECT id FROM app.address_place WHERE area_id IN (SELECT id FROM #dead));
            DELETE FROM app.address_place WHERE area_id IN (SELECT id FROM #dead);
        END

        -- Formulare und Bausteine
        DELETE FROM app.step_mark
         WHERE step_id IN (SELECT id FROM app.form_step
                            WHERE module_id IN (SELECT id FROM #mods) OR area_id IN (SELECT id FROM #dead))
            OR registration_id IN (SELECT id FROM app.registration WHERE part_id IN (SELECT id FROM #mods));
        DELETE FROM app.form_step
         WHERE module_id IN (SELECT id FROM #mods) OR area_id IN (SELECT id FROM #dead);
        DELETE FROM app.value_check
         WHERE registration_id IN (SELECT id FROM app.registration WHERE part_id IN (SELECT id FROM #mods))
            OR field_id IN (SELECT id FROM app.slug_field
                             WHERE part_id IN (SELECT id FROM #mods)
                                OR area_id IN (SELECT id FROM #dead) OR label_area_id IN (SELECT id FROM #dead));
        DELETE FROM app.registration_value
         WHERE registration_id IN (SELECT id FROM app.registration WHERE part_id IN (SELECT id FROM #mods))
            OR field_id IN (SELECT id FROM app.slug_field
                             WHERE part_id IN (SELECT id FROM #mods)
                                OR area_id IN (SELECT id FROM #dead) OR label_area_id IN (SELECT id FROM #dead));
        UPDATE app.registration SET base_id = NULL
         WHERE base_id IN (SELECT id FROM app.registration WHERE part_id IN (SELECT id FROM #mods))
           AND part_id NOT IN (SELECT id FROM #mods);
        DELETE FROM app.registration WHERE part_id IN (SELECT id FROM #mods);
        DELETE FROM app.slug_field
         WHERE part_id IN (SELECT id FROM #mods)
            OR area_id IN (SELECT id FROM #dead) OR label_area_id IN (SELECT id FROM #dead);
        DELETE FROM app.form_design WHERE module_id IN (SELECT id FROM #mods) OR area_id IN (SELECT id FROM #dead);
        DELETE FROM app.module      WHERE id IN (SELECT id FROM #mods);

        -- Was sonst am Bereich hängt
        DELETE FROM app.intake           WHERE area_id IN (SELECT id FROM #dead);
        DELETE FROM app.person_release   WHERE area_id IN (SELECT id FROM #dead);
        DELETE FROM app.area_member_name WHERE area_id IN (SELECT id FROM #dead);
        DELETE FROM app.area_controller  WHERE area_id IN (SELECT id FROM #dead);
        DELETE FROM app.topic_message
         WHERE topic_id IN (SELECT id FROM app.topic WHERE area_id IN (SELECT id FROM #dead))
            OR message_id IN (SELECT id FROM app.message WHERE area_id IN (SELECT id FROM #dead));
        DELETE FROM app.topic      WHERE area_id IN (SELECT id FROM #dead);
        DELETE FROM app.message    WHERE area_id IN (SELECT id FROM #dead);
        DELETE FROM app.attachment WHERE area_id IN (SELECT id FROM #dead);
        DELETE FROM app.access_grant WHERE area_id IN (SELECT id FROM #dead);
        DELETE FROM app.certificate WHERE scope_kind = N'area' AND scope_id IN (SELECT id FROM #dead);
        DELETE FROM app.key_grant   WHERE key_kind = N'epoch' AND key_ref IN (SELECT id FROM #dead);
        DELETE FROM app.area_epoch  WHERE area_id IN (SELECT id FROM #dead);
        DELETE FROM app.area        WHERE id IN (SELECT id FROM #dead);

        -- ===== Was die Rollen anderswo hinterlassen =========================

        DELETE FROM app.person_release   WHERE role_id IN (SELECT id FROM #doomed);
        DELETE FROM app.person_value     WHERE role_id IN (SELECT id FROM #doomed);
        DELETE FROM app.area_member_name WHERE role_id IN (SELECT id FROM #doomed);
        DELETE FROM app.calendar_presence WHERE role_id IN (SELECT id FROM #doomed);
        UPDATE app.mass_intention SET celebrant_role_id = NULL WHERE celebrant_role_id IN (SELECT id FROM #doomed);

        -- Künftige Buchungen geben den Platz frei; vergangene sind Geschichte der Gemeinschaft.
        DELETE FROM app.claim        WHERE role_id IN (SELECT id FROM #doomed) AND ends_at > @now;
        DELETE FROM app.slot_booking WHERE role_id IN (SELECT id FROM #doomed) AND occurrence_at > @now;
        DELETE FROM app.slot_request WHERE asked_by_role_id IN (SELECT id FROM #doomed) AND occurrence_at > @now;

        DELETE FROM app.access_holder WHERE role_id IN (SELECT id FROM #doomed);
        DELETE FROM app.invitation_redemption
         WHERE role_id IN (SELECT id FROM #doomed)
            OR invitation_id IN (SELECT id FROM app.invitation WHERE role_id IN (SELECT id FROM #doomed));
        DELETE FROM app.invitation WHERE role_id IN (SELECT id FROM #doomed);

        DELETE FROM app.key_grant
         WHERE role_id IN (SELECT id FROM #doomed)
            OR (key_kind <> N'epoch' AND key_ref IN (SELECT id FROM #doomed));
        DELETE FROM app.certificate WHERE subject_role_id IN (SELECT id FROM #doomed);
        DELETE FROM app.role_edge
         WHERE from_role_id IN (SELECT id FROM #doomed) OR to_role_id IN (SELECT id FROM #doomed);

        -- Eigene Nachrichten: der Inhalt geht, die Stelle im Gespräch bleibt („usunięta").
        IF OBJECT_ID(N'app.chat_attachment', N'U') IS NOT NULL
        BEGIN
            INSERT INTO #files (id)
            SELECT id FROM app.chat_attachment
             WHERE uploaded_by IN (SELECT id FROM #doomed) AND id NOT IN (SELECT id FROM #files);
            DELETE FROM app.chat_attachment WHERE uploaded_by IN (SELECT id FROM #doomed);
        END
        IF OBJECT_ID(N'app.chat_mark', N'U') IS NOT NULL
            DELETE FROM app.chat_mark WHERE principal_id IN (SELECT id FROM #doomed);
        IF OBJECT_ID(N'app.chat_presence', N'U') IS NOT NULL
            DELETE FROM app.chat_presence WHERE principal_id IN (SELECT id FROM #doomed);
        IF OBJECT_ID(N'app.chat_preference', N'U') IS NOT NULL
            DELETE FROM app.chat_preference WHERE principal_id IN (SELECT id FROM #doomed);

        DELETE FROM app.chat_message_version
         WHERE message_id IN (SELECT id FROM app.chat_message WHERE author_role_id IN (SELECT id FROM #doomed));
        UPDATE app.chat_message
           SET body_sealed = NULL,
               deleted_at = COALESCE(deleted_at, @now),
               deleted_by_role_id = COALESCE(deleted_by_role_id, author_role_id),
               changed_at = @now,
               schedule_state = CASE WHEN schedule_state = N'pending' THEN N'cancelled' ELSE schedule_state END
         WHERE author_role_id IN (SELECT id FROM #doomed);

        -- Die Rollen selbst: Grabsteine. Ohne privaten Schlüssel und Namen öffnen sie nichts mehr.
        UPDATE app.role
           SET display_name_sealed = NULL,
               sign_private_sealed = NULL,
               wrap_private_sealed = NULL,
               revoked_at = COALESCE(revoked_at, @now)
         WHERE id IN (SELECT id FROM #doomed);

        -- ===== Das Konto ================================================

        DECLARE @devices int = (SELECT COUNT(*) FROM app.account_key WHERE account_id = @account);
        DECLARE @roles int = (SELECT COUNT(*) FROM #doomed);

        DELETE FROM app.session       WHERE account_id = @account;
        DELETE FROM app.account_key   WHERE account_id = @account;
        DELETE FROM app.account_state WHERE account_id = @account;
        DELETE FROM app.chat_read     WHERE account_id = @account;
        IF OBJECT_ID('app.notify_device', 'U') IS NOT NULL
            DELETE FROM app.notify_device WHERE account_id = @account;
        UPDATE app.slug SET claimed_by_account_id = NULL WHERE claimed_by_account_id = @account;
        DELETE FROM app.account WHERE id = @account;

        SELECT id FROM #files;
        SELECT @roles AS roles, @areas AS areas, @messages AS messages, @devices AS devices;
        """;

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
