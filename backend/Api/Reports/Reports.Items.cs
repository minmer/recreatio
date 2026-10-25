using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0130 — DIE ARTEN, DIE MAN MELDEN KANN: was eine Kennung bezeichnet, ob der Meldende
/// sie lesen kann, zu welchem Bereich sie gehört, wer sie geschrieben hat (dem sagt die
/// Glocke, warum sie gesperrt ist), und wie sie endgültig gelöscht wird — nach Kennung,
/// ohne dass jemand sie liest.
/// </summary>
public static partial class Reports
{
    internal static readonly string[] Kinds = ["page", "part", "file", "form", "message", "entry", "item", "share", "link", "event"];

    internal sealed record Item(string Kind, Guid Id, Guid? AreaId, Guid? AuthorRoleId, string? Path, string? Title);

    /// <summary>Ist der Bereich offen (jawny, mit veröffentlichtem Schlüssel)?</summary>
    private static async Task<bool> AreaPublicAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT CASE WHEN EXISTS (
                SELECT 1 FROM app.area a WHERE a.id = @area AND a.public_level <> N'none'
                   AND EXISTS (SELECT 1 FROM app.area_epoch e WHERE e.area_id = a.id AND e.key_public IS NOT NULL)) THEN 1 ELSE 0 END;
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        return (int)(await cmd.ExecuteScalarAsync(ct))! == 1;
    }

    private static async Task<bool> ReadsAsync(SqlConnection connection, Caller? caller, Guid areaId, CancellationToken ct) =>
        caller is not null && await Area.MayAsync(connection, caller, areaId, Capability.Read, ct);

    /// <summary>Die Rolle, die eine Adresse führt (die nächste übernommene, sie selbst oder darüber).</summary>
    private static async Task<Guid?> LeaderOfAsync(SqlConnection connection, string path, CancellationToken ct)
    {
        var paths = new List<string> { path };
        paths.AddRange(Slug.Ancestors(path));
        var names = string.Join(", ", paths.Select((_, i) => $"@p{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT TOP 1 claimed_by_role_id FROM app.slug
            WHERE path IN ({names}) AND claimed_by_role_id IS NOT NULL ORDER BY LEN(path) DESC;
            """, connection);
        for (var i = 0; i < paths.Count; i++) cmd.Parameters.AddWithValue($"@p{i}", paths[i]);
        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    private sealed record PageRow(Guid Id, string Path, string? Title, List<Guid> Areas);

    private static async Task<PageRow?> PageRowAsync(SqlConnection connection, Guid slugId, CancellationToken ct)
    {
        string path;
        string? title;
        await using (var cmd = new SqlCommand("""
            SELECT s.path, p.title FROM app.slug s LEFT JOIN app.slug_page p ON p.slug_id = s.id WHERE s.id = @id;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", slugId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return null;
            path = reader.GetString(0);
            title = reader.IsDBNull(1) ? null : reader.GetString(1);
        }

        var areas = new List<Guid>();
        await using (var cmd = new SqlCommand("SELECT area_id FROM app.slug_area WHERE slug_id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", slugId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) areas.Add(reader.GetGuid(0));
        }
        /* Eine versiegelte Seite trägt ihren Titel als Hülle — dann nennen wir ihn nicht. */
        return new PageRow(slugId, path, title is not null && Page.IsEnvelope(title) ? null : title, areas);
    }

    /// <summary>Darf, wer ruft, die Seite sehen? Öffentlich: jeder; nur mit Zugang: wer einen ihrer Bereiche liest.</summary>
    private static async Task<bool> PageReadableAsync(SqlConnection connection, Caller? caller, PageRow page, CancellationToken ct)
    {
        if (page.Areas.Count == 0) return true;
        foreach (var area in page.Areas)
            if (await ReadsAsync(connection, caller, area, ct)) return true;
        return false;
    }

    private static async Task<Guid?> PageAreaAsync(SqlConnection connection, PageRow page, CancellationToken ct) =>
        page.Areas.Count > 0 ? page.Areas[0] : (await Controllers.OfPageAsync(connection, page.Path, ct)).AreaId;

    /// <summary>
    /// Die Sache hinter Art und Kennung — wenn es sie gibt UND wer ruft sie lesen kann. Sonst
    /// <c>null</c>: melden kann nur, wer sieht, was er meldet.
    /// </summary>
    internal static async Task<Item?> ItemAsync(SqlConnection connection, Caller? caller, string kind, Guid id, CancellationToken ct, bool trusted = false)
    {
        switch (kind)
        {
            case "page":
            {
                var page = await PageRowAsync(connection, id, ct);
                if (page is null || (!trusted && !await PageReadableAsync(connection, caller, page, ct))) return null;
                return new Item(kind, id, await PageAreaAsync(connection, page, ct), await LeaderOfAsync(connection, page.Path, ct), page.Path, page.Title);
            }
            case "part":
            {
                Guid slug;
                Guid? module, moduleArea;
                await using (var cmd = new SqlCommand("""
                    SELECT p.slug_id, p.module_id, m.area_id FROM app.slug_part p LEFT JOIN app.module m ON m.id = p.module_id WHERE p.id = @id;
                    """, connection))
                {
                    cmd.Parameters.AddWithValue("@id", id);
                    await using var reader = await cmd.ExecuteReaderAsync(ct);
                    if (!await reader.ReadAsync(ct)) return null;
                    slug = reader.GetGuid(0);
                    module = reader.IsDBNull(1) ? null : reader.GetGuid(1);
                    moduleArea = reader.IsDBNull(2) ? null : reader.GetGuid(2);
                }
                var page = await PageRowAsync(connection, slug, ct);
                if (page is null || (!trusted && !await PageReadableAsync(connection, caller, page, ct))) return null;
                return new Item(kind, id, moduleArea ?? await PageAreaAsync(connection, page, ct), await LeaderOfAsync(connection, page.Path, ct), page.Path, page.Title);
            }
            case "file":
            {
                Guid slug;
                Guid? by;
                await using (var cmd = new SqlCommand("SELECT slug_id, created_by_role_id FROM app.page_image WHERE id = @id;", connection))
                {
                    cmd.Parameters.AddWithValue("@id", id);
                    await using var reader = await cmd.ExecuteReaderAsync(ct);
                    if (!await reader.ReadAsync(ct)) return null;
                    slug = reader.GetGuid(0);
                    by = reader.IsDBNull(1) ? null : reader.GetGuid(1);
                }
                var page = await PageRowAsync(connection, slug, ct);
                if (page is null || (!trusted && !await PageReadableAsync(connection, caller, page, ct))) return null;
                return new Item(kind, id, await PageAreaAsync(connection, page, ct), by ?? await LeaderOfAsync(connection, page.Path, ct), page.Path, page.Title);
            }
            case "form":
            {
                Guid? area;
                await using (var cmd = new SqlCommand("SELECT area_id FROM app.module WHERE id = @id AND kind = N'form';", connection))
                {
                    cmd.Parameters.AddWithValue("@id", id);
                    var found = await cmd.ExecuteScalarAsync(ct);
                    if (found is null) return null;
                    area = found as Guid?;
                }
                if (area is null) return null;
                if (!trusted && !await AreaPublicAsync(connection, area.Value, ct) && !await ReadsAsync(connection, caller, area.Value, ct)) return null;

                string? path = null;
                await using (var cmd = new SqlCommand("""
                    SELECT TOP 1 s.path FROM app.slug_part p JOIN app.slug s ON s.id = p.slug_id WHERE p.module_id = @id ORDER BY s.path;
                    """, connection))
                {
                    cmd.Parameters.AddWithValue("@id", id);
                    path = await cmd.ExecuteScalarAsync(ct) as string;
                }
                return new Item(kind, id, area, path is null ? null : await LeaderOfAsync(connection, path, ct), path, null);
            }
            case "message":
            {
                Guid area;
                Guid? author;
                await using (var cmd = new SqlCommand("""
                    SELECT c.area_id, COALESCE(m.author_person_id, m.author_role_id)
                    FROM app.chat_message m JOIN app.chat c ON c.id = m.chat_id WHERE m.id = @id;
                    """, connection))
                {
                    cmd.Parameters.AddWithValue("@id", id);
                    await using var reader = await cmd.ExecuteReaderAsync(ct);
                    if (!await reader.ReadAsync(ct)) return null;
                    area = reader.GetGuid(0);
                    author = reader.IsDBNull(1) ? null : reader.GetGuid(1);
                }
                if (!trusted && !await ReadsAsync(connection, caller, area, ct)) return null;
                return new Item(kind, id, area, author, null, null);
            }
            case "entry":
            {
                Guid area;
                Guid? account;
                await using (var cmd = new SqlCommand("""
                    SELECT l.area_id, e.written_by_account_id FROM app.library_entry e JOIN app.library l ON l.id = e.library_id
                    WHERE e.id = @id AND e.deleted_at IS NULL;
                    """, connection))
                {
                    cmd.Parameters.AddWithValue("@id", id);
                    await using var reader = await cmd.ExecuteReaderAsync(ct);
                    if (!await reader.ReadAsync(ct)) return null;
                    area = reader.GetGuid(0);
                    account = reader.IsDBNull(1) ? null : reader.GetGuid(1);
                }
                if (!trusted && !await AreaPublicAsync(connection, area, ct) && !await ReadsAsync(connection, caller, area, ct)) return null;
                Guid? person = null;
                if (account is not null)
                {
                    await using var cmd = new SqlCommand("SELECT person_role_id FROM app.account WHERE id = @id;", connection);
                    cmd.Parameters.AddWithValue("@id", account.Value);
                    person = await cmd.ExecuteScalarAsync(ct) as Guid?;
                }
                return new Item(kind, id, area, person, null, null);
            }
            case "item":
            {
                Guid area, visibility;
                Guid? owner;
                await using (var cmd = new SqlCommand("""
                    SELECT c.area_id, i.visibility_area_id, i.owner_role_id
                    FROM app.calendar_item i JOIN app.calendar c ON c.id = i.calendar_id WHERE i.id = @id;
                    """, connection))
                {
                    cmd.Parameters.AddWithValue("@id", id);
                    await using var reader = await cmd.ExecuteReaderAsync(ct);
                    if (!await reader.ReadAsync(ct)) return null;
                    area = reader.GetGuid(0);
                    visibility = reader.GetGuid(1);
                    owner = reader.IsDBNull(2) ? null : reader.GetGuid(2);
                }
                if (!trusted && !await AreaPublicAsync(connection, visibility, ct) && !await ReadsAsync(connection, caller, visibility, ct)
                    && !await ReadsAsync(connection, caller, area, ct)) return null;
                return new Item(kind, id, area, owner, null, null);
            }
            case "share":
            {
                /* Die Kennung leitet der Browser aus dem Geheimnis des Links ab: wer sie hat, hatte den Link. */
                await using var cmd = new SqlCommand("""
                    SELECT s.area_id, a.person_role_id
                    FROM app.phone_share s
                    LEFT JOIN app.phone_share_device d ON d.id = s.device_id
                    LEFT JOIN app.account a ON a.id = d.account_id
                    WHERE s.id = @id AND s.deleted_at IS NULL;
                    """, connection);
                cmd.Parameters.AddWithValue("@id", id);
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                if (!await reader.ReadAsync(ct)) return null;
                return new Item(kind, id, reader.GetGuid(0), reader.IsDBNull(1) ? null : reader.GetGuid(1), null, null);
            }
            case "link":
            {
                /* Die Kennung steht auf der Seite des Links, die nur sieht, wer ihn hat. */
                Guid role;
                Guid? by;
                await using (var cmd = new SqlCommand(
                    "SELECT role_id, created_by_role_id FROM app.invitation WHERE id = @id AND purpose = N'area-link';", connection))
                {
                    cmd.Parameters.AddWithValue("@id", id);
                    await using var reader = await cmd.ExecuteReaderAsync(ct);
                    if (!await reader.ReadAsync(ct)) return null;
                    role = reader.GetGuid(0);
                    by = reader.IsDBNull(1) ? null : reader.GetGuid(1);
                }
                Guid? area = null;
                await using (var cmd = new SqlCommand("""
                    SELECT TOP 1 scope_id FROM app.certificate
                    WHERE scope_kind = N'area' AND subject_role_id = @role AND revoked_at IS NULL ORDER BY issued_at;
                    """, connection))
                {
                    cmd.Parameters.AddWithValue("@role", role);
                    area = await cmd.ExecuteScalarAsync(ct) as Guid?;
                }
                return new Item(kind, id, area, by, null, null);
            }
            case "event":
            {
                Guid? by;
                await using (var cmd = new SqlCommand("SELECT created_by_role_id FROM app.area_event WHERE area_id = @id;", connection))
                {
                    cmd.Parameters.AddWithValue("@id", id);
                    var found = await cmd.ExecuteScalarAsync(ct);
                    if (found is null) return null;
                    by = found as Guid?;
                }
                return new Item(kind, id, id, by, null, null);
            }
            default:
                return null;
        }
    }

    /// <summary>
    /// Die Sache ENDGÜLTIG löschen — nach Kennung, ohne sie zu lesen. Was zu einer
    /// Gemeinschaft gehört und nicht gemeldet ist (die Einsendungen eines Formulars, die
    /// Adresse einer Seite), bleibt. Dateien gehen nach dem Commit.
    /// </summary>
    internal static async Task<List<string>> DeleteForGoodAsync(
        SqlConnection connection, SqlTransaction tx, IConfiguration config, string kind, Guid id, DateTimeOffset now, CancellationToken ct)
    {
        var files = new List<string>();

        async Task Run(string sql)
        {
            await using var cmd = new SqlCommand(sql, connection, tx);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@now", now);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        async Task<List<Guid>> IdList(string sql)
        {
            var list = new List<Guid>();
            await using var cmd = new SqlCommand(sql, connection, tx);
            cmd.Parameters.AddWithValue("@id", id);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) list.Add(reader.GetGuid(0));
            return list;
        }

        switch (kind)
        {
            case "page":
                /* Der Inhalt geht (Bausteine ohne Bereich mit, Dateien der Seite auch); die Adresse bleibt vergeben. */
                foreach (var image in await IdList("SELECT id FROM app.page_image WHERE slug_id = @id;"))
                    files.Add(PageImage.FileOf(config, image));
                await Run("""
                    DECLARE @mods TABLE (id uniqueidentifier);
                    INSERT INTO @mods SELECT p.module_id FROM app.slug_part p JOIN app.module m ON m.id = p.module_id
                     WHERE p.slug_id = @id AND m.area_id IS NULL AND m.kind <> N'form'
                       AND NOT EXISTS (SELECT 1 FROM app.slug_part o WHERE o.module_id = p.module_id AND o.slug_id <> @id);
                    DELETE FROM app.slug_part WHERE slug_id = @id;
                    /* Der Inhalt der Bausteine, die nur hier standen, geht; die Zeilen bleiben leer (an ihnen kann etwas hängen). */
                    UPDATE app.module SET config = NULL WHERE id IN (SELECT id FROM @mods);
                    DELETE FROM app.slug_menu WHERE slug_id = @id;
                    UPDATE app.slug_page SET image_id = NULL WHERE slug_id = @id;
                    DELETE FROM app.page_image WHERE slug_id = @id;
                    DELETE FROM app.slug_page WHERE slug_id = @id;
                    """);
                break;

            case "part":
                /*
                 * Der Platz geht und mit ihm der Inhalt — auch dort, wo derselbe Baustein sonst
                 * noch steht (er ist derselbe Inhalt). Der Baustein selbst bleibt leer stehen (an ihm
                 * können Fragen, Schritte, Einsendungen hängen; ohne Platz räumt ihn 0063 beim
                 * nächsten Speichern weg). Ein Formular behält seine Einsendungen (die gehören dem
                 * Verantwortlichen) — für das Formular selbst gibt es „form".
                 */
                await Run("""
                    DECLARE @module uniqueidentifier = (SELECT module_id FROM app.slug_part WHERE id = @id);
                    DELETE FROM app.slug_part WHERE id = @id;
                    UPDATE app.module SET config = NULL WHERE id = @module AND kind <> N'form';
                    UPDATE app.slug_part SET config = NULL WHERE module_id = @module AND kind <> N'form';
                    """);
                break;

            case "file":
                files.Add(PageImage.FileOf(config, id));
                await Run("UPDATE app.slug_page SET image_id = NULL WHERE image_id = @id; DELETE FROM app.page_image WHERE id = @id;");
                break;

            case "form":
                /* Die Fragen und ihr Aufbau gehen, das Formular ist zu; die Einsendungen bleiben beim Verantwortlichen. */
                await Run("""
                    UPDATE app.module SET closed_at = COALESCE(closed_at, @now) WHERE id = @id;
                    UPDATE app.slug_field SET removed_at = COALESCE(removed_at, @now) WHERE part_id = @id;
                    DELETE FROM app.form_design WHERE module_id = @id;
                    """);
                break;

            case "message":
                await Run("""
                    DELETE FROM app.chat_message_version WHERE message_id = @id;
                    UPDATE app.chat_message SET body_sealed = NULL, deleted_at = COALESCE(deleted_at, @now), changed_at = @now WHERE id = @id;
                    """);
                break;

            case "entry":
                await Run("""
                    DELETE FROM app.library_entry_version WHERE entry_id = @id;
                    UPDATE app.library_entry SET sealed = NULL, deleted_at = COALESCE(deleted_at, @now), updated_at = @now WHERE id = @id;
                    """);
                break;

            case "item":
                /* Was über den Termin geschrieben steht, geht; die Zeit bleibt (an ihr hängen Buchungen und Intentionen). */
                await Run("""
                    DELETE FROM app.calendar_field WHERE item_id = @id;
                    UPDATE app.calendar_item SET title_public = NULL WHERE id = @id;
                    """);
                break;

            case "share":
                await Phone.RemoveShareAsync(config, connection, tx, id, ct);
                break;

            case "link":
                await Run("UPDATE app.invitation SET revoked_at = COALESCE(revoked_at, @now) WHERE id = @id;");
                break;

            case "event":
                await Run("DELETE FROM app.event_listing WHERE area_id = @id;");
                break;
        }

        return files;
    }

    /// <summary>Was eine Sperre an der Sache selbst anstösst, damit Leser sie neu holen (Rozmowy, Bibliotheken).</summary>
    internal static async Task TouchAsync(SqlConnection connection, SqlTransaction tx, string kind, Guid id, DateTimeOffset now, CancellationToken ct)
    {
        var sql = kind switch
        {
            "message" => "UPDATE app.chat_message SET changed_at = @now WHERE id = @id;",
            "entry" => "UPDATE app.library_entry SET updated_at = @now WHERE id = @id;",
            _ => null
        };
        if (sql is null) return;
        await using var cmd = new SqlCommand(sql, connection, tx);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@now", now);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
