using System.ComponentModel;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Kernel;
using Microsoft.Data.SqlClient;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace Api;

/// <summary>
/// 2026-11-15 (Eigentümer: „für den MCP-Server die Möglichkeit, die Seiten zu sehen, ihren Inhalt und ihre Bausteine —
/// nur lesend") — DIE SEITEN DER FREIGEGEBENEN BEREICHE.
///
/// <para>
/// <b>Welche Seiten?</b> Die, die ein Bereich der Freigabe schon heute als seine kennt — nichts Neues zum Ankreuzen:
/// <list type="bullet">
/// <item>eine Seite „tylko z dostępem", die an diesen Bereich gebunden ist (<c>app.slug_area</c>, 0051) — ein Link des
/// Bereichs ist hier wie ein Mensch des Bereichs, der sie öffnen darf;</item>
/// <item>eine öffentliche Seite, für die dieser Bereich geradesteht (<c>controller_area_id</c> an ihr oder der nächsten
/// darüber, 0129 — dieselbe Frage wie <see cref="Controllers.OfPageAsync"/>).</item>
/// </list>
/// Eine Seite mit Zugang, die an einen ANDEREN Bereich gebunden ist, erscheint nie — auch wenn dieser Bereich für sie
/// geradesteht. Gesperrte Seiten (0130) und Seiten „po wydarzeniu" vor dem Ende ebenso nicht.
/// </para>
///
/// <para>
/// <b>Was gelesen wird:</b> was der Dienst ohnehin zeigt (<c>GET /page/…</c>): Titel, Vorspann, Art, Aussehen, Karte,
/// Wybór, Menü und die Bausteine mit Raster und Einstellungen — so, wie sie gespeichert sind. Ein Baustein nur für die
/// Menschen eines Bereichs (0133) nur, wenn dieser Bereich freigegeben ist. Eine VERSIEGELTE Seite (0121) kann der Dienst
/// nicht öffnen: sie steht mit ihrer Adresse da, ohne Inhalt. Nie: Antworten auf Formulare, Einträge, Menschen.
/// </para>
/// </summary>
public sealed partial class AiMcpTools
{
    public sealed record PageLine(string Path, string? Title, string? Lead, string Mode, string Access, bool Sealed, int Modules,
        IReadOnlyList<string> Kinds, string Area, string? UpdatedAt, string Url, string EditUrl);
    public sealed record PagesResult(string? Query, int Total, int Offset, int Limit, int? NextOffset, IReadOnlyList<PageLine> Pages, string Note);
    public sealed record PageModule(int Index, string Id, string ModuleId, string? Name, string Kind, string? AudienceAreaId,
        JsonObject? Layout, JsonObject? Config, string? Text, bool Sealed);
    public sealed record PageResult(string Format, string Path, string? Title, string? Lead, string Mode, string Access, bool Sealed,
        string Area, string? ResponsibleArea, IReadOnlyList<string> BoundAreas, string? UpdatedAt, JsonObject? Look, JsonObject? Logic, JsonObject? Subject,
        JsonArray? Menu, string? MenuFrom, IReadOnlyList<PageModule> Modules, IReadOnlyList<PageLine> Subpages, string Url, string EditUrl, string Note);

    private const string PagesNote =
        "Pages of the authorized areas, read-only: access-only pages bound to an authorized area and public pages an authorized area is responsible for. " +
        "Content is as stored (title, lead, mode, look, logic, modules with their grid layout and config) — the same data the public page shows; " +
        "a sealed page (encrypted in the browser) is listed by its address only. Form answers, people and calendar entries are never part of it. " +
        "To change a page, prepare a page JSON (get_import_format page) for the user to import in the page editor.";

    /// <summary>Ein Bereich der Freigabe, mit Namen (der Name steht offen da, wie in der Liste der Bereiche).</summary>
    private sealed record PageArea(Guid Id, string Name);

    /// <summary>Eine Adresse, wie die Liste sie braucht.</summary>
    private sealed record PageRow(Guid Id, string Path, string? Title, string? Lead, DateTimeOffset? UpdatedAt, string Mode, bool Sealed,
        List<Guid> Bound, Guid Area, string Access);

    /// <summary>Die Bereiche der Links dieses Aufrufs — nur die, die gerade gelten (wie <see cref="AiAccess.LinkWorksAsync"/>).</summary>
    private static async Task<List<PageArea>> PageAreasAsync(IHttpContextAccessor http, SqlConnection connection, IConfiguration config, CancellationToken ct)
    {
        var ctx = http.HttpContext ?? throw new McpException("unauthorized: brak kontekstu żądania.");
        var secrets = ctx.Items[AiMcp.SecretsKey] as List<string> ?? [];
        var areas = new List<PageArea>();
        foreach (var secret in secrets)
        {
            Guid area, creator;
            string name;
            await using (var cmd = new SqlCommand("""
                SELECT a.area_id, a.account_id, ar.name FROM app.ai_access a JOIN app.area ar ON ar.id = a.area_id
                WHERE a.token_sha256 = @hash AND a.key_wrapped IS NOT NULL AND a.expires_at > SYSDATETIMEOFFSET();
                """, connection))
            {
                cmd.Parameters.Add("@hash", System.Data.SqlDbType.VarBinary, 32).Value = Token.HashSecret(secret);
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                if (!await reader.ReadAsync(ct)) continue;
                area = reader.GetGuid(0);
                creator = reader.GetGuid(1);
                name = reader.IsDBNull(2) ? "" : reader.GetString(2);
            }
            if (areas.Any(a => a.Id == area)) continue;
            if (await Area.MayAsync(connection, creator, area, Capability.Admin, ct)) areas.Add(new PageArea(area, name));
        }
        if (areas.Count == 0)
            throw new McpException(ctx.Items[AiMcpConnections.ConnectionKey] is AiMcpConnections.Opened
                ? $"no_areas: this connection has no working area right now. The user adds or renews areas in Recreatio — {AiMcp.ManageUrl(config)} — no reconnection is needed."
                : "unauthorized: żaden z udostępnionych linków już nie działa. Połącz Recreatio ponownie.");
        return areas;
    }

    /// <summary>
    /// DIE SEITEN DIESER BEREICHE — eine Abfrage über das Register, entschieden hier: gebunden an einen der Bereiche,
    /// oder öffentlich und der nächste verantwortliche Bereich ist einer von ihnen.
    /// </summary>
    private static async Task<List<PageRow>> PagesOfAsync(SqlConnection connection, IReadOnlyList<PageArea> areas, CancellationToken ct)
    {
        var mine = areas.Select(a => a.Id).ToHashSet();
        var sealColumn = await Page.SealReadyAsync(connection, ct) ? "s.page_seal" : "CAST(NULL AS nvarchar(max))";

        var controllers = new Dictionary<string, Guid>(StringComparer.Ordinal);
        await using (var cmd = new SqlCommand("SELECT path, controller_area_id FROM app.slug WHERE controller_area_id IS NOT NULL;", connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) controllers[reader.GetString(0)] = reader.GetGuid(1);
        }

        var rows = new List<PageRow>();
        await using (var cmd = new SqlCommand($"""
            SELECT s.id, s.path, p.title, p.lead, p.updated_at, s.page_mode, {sealColumn},
                   (SELECT STRING_AGG(CONVERT(nvarchar(36), w.area_id), ',') FROM app.slug_area w WHERE w.slug_id = s.id)
            FROM app.slug s
            LEFT JOIN app.slug_page p ON p.slug_id = s.id
            WHERE s.alias_of IS NULL AND s.claimed_by_role_id IS NOT NULL
              AND (p.slug_id IS NOT NULL OR EXISTS (SELECT 1 FROM app.slug_part x WHERE x.slug_id = s.id))
              AND NOT {Takedowns.Exists("page", "s.id")};
            """, connection))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var path = reader.GetString(1);
                var bound = reader.IsDBNull(7) ? [] : reader.GetString(7).Split(',', StringSplitOptions.RemoveEmptyEntries).Select(Guid.Parse).ToList();
                Guid? area = null;
                string access;
                if (bound.Count > 0)
                {
                    area = bound.FirstOrDefault(mine.Contains);
                    if (area == Guid.Empty) continue;
                    access = "area";
                }
                else
                {
                    /* Wie Controllers.OfPageAsync: die Seite selbst, dann die Adressen darüber, die nächste zuerst. */
                    foreach (var p in new[] { path }.Concat(Slug.Ancestors(path).Reverse()))
                        if (controllers.TryGetValue(p, out var c)) { area = c; break; }
                    if (area is not Guid a || !mine.Contains(a)) continue;
                    access = "public";
                }
                var sealedPage = !reader.IsDBNull(6);
                rows.Add(new PageRow(reader.GetGuid(0), path,
                    sealedPage || reader.IsDBNull(2) ? null : reader.GetString(2),
                    sealedPage || reader.IsDBNull(3) ? null : reader.GetString(3),
                    reader.IsDBNull(4) ? null : reader.GetDateTimeOffset(4),
                    Page.ModeOf(reader.IsDBNull(5) ? null : reader.GetString(5)), sealedPage, bound, area!.Value, access));
            }
        }

        /* 0133 — eine Seite „po wydarzeniu" erst nach dem Ende (wie für jeden Besucher). */
        var shown = new List<PageRow>();
        foreach (var row in rows)
            if (await Profiles.OfAfterPageAsync(connection, row.Id, ct) is not { } before || before.Ended(DateTimeOffset.UtcNow)) shown.Add(row);
        return shown.OrderBy(r => r.Path, StringComparer.Ordinal).ToList();
    }

    /// <summary>
    /// Die Arten der Bausteine einer Seite, in ihrer Reihenfolge — ohne die für die Menschen eines nicht freigegebenen
    /// Bereichs (0133), wie <c>get_page</c> sie auch weglässt.
    /// </summary>
    private static async Task<Dictionary<Guid, List<string>>> KindsOfAsync(SqlConnection connection, IReadOnlyList<Guid> pages, IReadOnlyList<PageArea> areas, CancellationToken ct)
    {
        var mine = areas.Select(a => a.Id).ToHashSet();
        var kinds = new Dictionary<Guid, List<string>>();
        foreach (var chunk in pages.Chunk(500))
        {
            var names = string.Join(", ", chunk.Select((_, i) => $"@s{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT p.slug_id, COALESCE(m.kind, p.kind), p.audience_area_id FROM app.slug_part p LEFT JOIN app.module m ON m.id = p.module_id
                WHERE p.slug_id IN ({names}) ORDER BY p.slug_id, p.position;
                """, connection);
            for (var i = 0; i < chunk.Length; i++) cmd.Parameters.AddWithValue($"@s{i}", chunk[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                if (!reader.IsDBNull(2) && !mine.Contains(reader.GetGuid(2))) continue;
                if (!kinds.TryGetValue(reader.GetGuid(0), out var list)) kinds[reader.GetGuid(0)] = list = [];
                list.Add(reader.GetString(1));
            }
        }
        return kinds;
    }

    private static string PageUrl(IConfiguration config, string path) =>
        $"{AppOrigin(config)}/#/{string.Join('/', path.Split('/').Select(Uri.EscapeDataString))}";

    private static string PageEditUrl(IConfiguration config, string path) =>
        $"{AppOrigin(config)}/#/workspace/pages/{(path == Slug.Home ? "~" : string.Join('/', path.Split('/').Select(Uri.EscapeDataString)))}";

    private static PageLine LineOf(IConfiguration config, PageRow r, IReadOnlyList<PageArea> areas, Dictionary<Guid, List<string>> kinds)
    {
        var list = !r.Sealed && kinds.TryGetValue(r.Id, out var k) ? k : [];
        return new PageLine(r.Path == Slug.Home ? "/" : r.Path, r.Title, r.Lead is null ? null : Clip(r.Lead, 300), r.Mode, r.Access, r.Sealed,
            list.Count, list.Distinct().ToList(), areas.First(a => a.Id == r.Area).Name, r.UpdatedAt?.ToString("O"),
            PageUrl(config, r.Path), PageEditUrl(config, r.Path));
    }

    private static string Clip(string text, int max) => text.Length <= max ? text : text[..max].TrimEnd() + "…";

    [McpServerTool(Name = "list_pages", Title = "Strony", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("The web pages (recreatio.pl/<path>) of the authorized areas, read-only: access-only pages bound to an authorized area and public pages an authorized area is responsible for. Each with path, title, lead, mode (page / slides / presentation), access (public / area), whether it is sealed, how many modules and of which kinds, the area, the public url and the editor url. Filter with query (all words in path, title or lead). Read one page in full with get_page.")]
    public static async Task<PagesResult> ListPages(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Optional words: every word must occur in the path, title or lead (case and Polish letters do not matter).")] string? query = null,
        [Description("Optional area id or name — only its pages.")] string? area = null,
        [Description("How many pages, 1–200.")] int limit = 100,
        [Description("Start at this position (from nextOffset).")] int offset = 0,
        CancellationToken cancellationToken = default)
    {
        await using var connection = await db.OpenAsync(cancellationToken);
        var areas = await PageAreasAsync(http, connection, config, cancellationToken);
        if (!string.IsNullOrWhiteSpace(area))
        {
            var wanted = area.Trim();
            areas = areas.Where(a => string.Equals(Ids.ToText(a.Id), wanted, StringComparison.OrdinalIgnoreCase)
                || string.Equals(a.Name, wanted, StringComparison.CurrentCultureIgnoreCase)).ToList();
            if (areas.Count == 0) throw new McpException($"not_found: no authorized area „{area}”. See get_access_overview.");
        }
        var rows = await PagesOfAsync(connection, areas, cancellationToken);
        var words = PageWords(query);
        if (words.Count > 0)
            rows = rows.Where(r => { var hay = Fold($"{r.Path} {r.Title} {r.Lead}"); return words.All(hay.Contains); }).ToList();
        limit = Math.Clamp(limit, 1, 200);
        offset = Math.Max(0, offset);
        var page = rows.Skip(offset).Take(limit).ToList();
        var kinds = await KindsOfAsync(connection, page.Select(r => r.Id).ToList(), areas, cancellationToken);
        int? next = offset + page.Count < rows.Count ? offset + page.Count : null;
        return new PagesResult(query, rows.Count, offset, limit, next, page.Select(r => LineOf(config, r, areas, kinds)).ToList(), PagesNote);
    }

    [McpServerTool(Name = "get_page", Title = "Strona", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("One page of an authorized area, read-only and in full: title, lead, mode, look (theme, cover, scenes of a presentation, style), logic, subject, menu, and every module in its order — kind, name, grid layout per screen size, its config as stored, and a readable text of what it says — plus its subpages. A sealed page answers with its address only (the service cannot open it). The shape follows the page JSON format (get_import_format page), as stored.")]
    public static async Task<PageResult> GetPage(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("The page's path, e.g. \"parafia/aktualnosci\" (\"/\" for the root page), or its url from list_pages.")] string path,
        CancellationToken cancellationToken = default)
    {
        await using var connection = await db.OpenAsync(cancellationToken);
        var areas = await PageAreasAsync(http, connection, config, cancellationToken);
        var rows = await PagesOfAsync(connection, areas, cancellationToken);
        var wanted = PathOf(path);
        var row = rows.FirstOrDefault(r => r.Path == wanted)
            ?? throw new McpException($"not_found: „{path}” is not a page of the authorized areas (or it is blocked, or not visible yet). See list_pages.");
        return await PageOfAsync(connection, config, row, rows, areas, cancellationToken);
    }

    /// <summary>Ein Pfad aus dem, was ein Assistent schreibt: Pfad, „/" für die Wurzel, eine Adresse mit <c>#/</c>.</summary>
    private static string PathOf(string said)
    {
        var text = (said ?? "").Trim();
        if (text.StartsWith("page:", StringComparison.Ordinal)) text = text[5..];
        var hash = text.IndexOf("#/", StringComparison.Ordinal);
        if (hash >= 0) text = text[(hash + 2)..];
        else if (Uri.TryCreate(text, UriKind.Absolute, out var uri) && uri.Scheme.StartsWith("http", StringComparison.Ordinal)) text = uri.AbsolutePath;
        var query = text.IndexOfAny(['?', '#']);
        if (query >= 0) text = text[..query];
        return Slug.Normalise(Uri.UnescapeDataString(text));
    }

    private static JsonNode? JsonOf(string? text)
    {
        if (string.IsNullOrWhiteSpace(text) || Page.IsEnvelope(text)) return null;
        try { return JsonNode.Parse(text); } catch (JsonException) { return JsonValue.Create(text); }
    }

    /// <summary>Als Objekt (das Ausgabeschema braucht eine feste Art): ein anderer Wert steht unter <c>value</c>.</summary>
    private static JsonObject? ObjOf(JsonNode? node) => node switch { null => null, JsonObject o => o, _ => new JsonObject { ["value"] = node } };

    private static JsonArray? ArrOf(JsonNode? node) => node switch { null => null, JsonArray a => a, _ => [node] };

    private static async Task<PageResult> PageOfAsync(SqlConnection connection, IConfiguration config, PageRow row, IReadOnlyList<PageRow> all,
        IReadOnlyList<PageArea> areas, CancellationToken ct)
    {
        var mine = areas.Select(a => a.Id).ToHashSet();
        var shownPath = row.Path == Slug.Home ? "/" : row.Path;
        var children = all.Where(r => r.Path != row.Path && (row.Path == Slug.Home
            ? !r.Path.Contains('/')
            : r.Path.StartsWith(row.Path + "/", StringComparison.Ordinal) && !r.Path[(row.Path.Length + 1)..].Contains('/'))).ToList();
        var kinds = await KindsOfAsync(connection, children.Select(c => c.Id).Append(row.Id).ToList(), areas, ct);
        var subpages = children.Select(c => LineOf(config, c, areas, kinds)).ToList();
        var areaName = areas.First(a => a.Id == row.Area).Name;
        var (_, responsibleId, _) = await Controllers.OfPageAsync(connection, row.Path, ct);
        string? responsible = responsibleId is Guid r ? areas.FirstOrDefault(a => a.Id == r)?.Name ?? "(obszar spoza udostępnienia)" : null;
        var bound = row.Bound.Select(b => areas.FirstOrDefault(a => a.Id == b)?.Name ?? "(obszar spoza udostępnienia)").ToList();

        if (row.Sealed)
            return new PageResult("recreatio/page", shownPath, null, null, row.Mode, row.Access, true, areaName, responsible, bound, row.UpdatedAt?.ToString("O"),
                null, null, null, null, null, [], subpages, PageUrl(config, row.Path), PageEditUrl(config, row.Path),
                "This page is sealed: its title, look and modules are encrypted in the browser of the people who read it, and the service cannot open them — nothing of its content is available here. " + PagesNote);

        string? logic = null, theme = null, subject = null;
        await using (var cmd = new SqlCommand("SELECT page_logic, page_theme, page_subject FROM app.slug WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", row.Id);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                logic = reader.IsDBNull(0) ? null : reader.GetString(0);
                theme = reader.IsDBNull(1) ? null : reader.GetString(1);
                subject = reader.IsDBNull(2) ? null : reader.GetString(2);
            }
        }

        /* Die Bausteine wie für einen Besucher dieses Bereichs: einer nur für die Menschen eines Bereichs, wenn er freigegeben ist. */
        var parts = await Page.PartsOfAsync(connection, row.Id, ct, audience => Task.FromResult(mine.Contains(audience)));
        var modules = new List<PageModule>();
        var moduleIds = new List<Guid>();
        foreach (var part in parts)
        {
            var json = JsonSerializer.SerializeToElement(part);
            if (json.TryGetProperty("moduleId", out var m) && m.ValueKind == JsonValueKind.String && Guid.TryParse(m.GetString(), out var mid)) moduleIds.Add(mid);
        }
        var names = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (moduleIds.Count > 0)
        {
            var list = string.Join(", ", moduleIds.Distinct().Select((_, i) => $"@m{i}"));
            await using var cmd = new SqlCommand($"SELECT id, name FROM app.module WHERE id IN ({list});", connection);
            var i2 = 0;
            foreach (var id in moduleIds.Distinct()) cmd.Parameters.AddWithValue($"@m{i2++}", id);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                if (!reader.IsDBNull(1) && !Page.IsEnvelope(reader.GetString(1))) names[Ids.ToText(reader.GetGuid(0))] = reader.GetString(1);
        }
        foreach (var part in parts)
        {
            var json = JsonSerializer.SerializeToElement(part);
            string? Str(string key) => json.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
            var id = Str("id") ?? "";
            var moduleId = Str("moduleId") ?? id;
            var config0 = Str("config");
            var layout0 = Str("layout");
            var sealedPart = Page.IsEnvelope(config0) || Page.IsEnvelope(layout0);
            var configNode = ObjOf(JsonOf(config0));
            var text = configNode is null ? null : ReadableOf(configNode);
            modules.Add(new PageModule(modules.Count + 1, id, moduleId, names.GetValueOrDefault(moduleId), Str("kind") ?? "?", Str("audienceAreaId"),
                ObjOf(JsonOf(layout0)), configNode, string.IsNullOrWhiteSpace(text) ? null : text, sealedPart));
        }

        var menu = await Menu.ForPageAsync(connection, row.Path, includeSelf: true, ct);
        JsonNode? menuNode = null;
        if (menu is { } mm && mm.Items.ValueKind != JsonValueKind.Undefined)
        {
            menuNode = mm.Items.ValueKind == JsonValueKind.String ? JsonOf(mm.Items.GetString()) : JsonNode.Parse(mm.Items.GetRawText());
        }

        return new PageResult("recreatio/page", shownPath, row.Title, row.Lead, row.Mode, row.Access, false, areaName, responsible, bound,
            row.UpdatedAt?.ToString("O"), ObjOf(JsonOf(theme)), ObjOf(JsonOf(logic)), ObjOf(JsonOf(subject)), ArrOf(menuNode), menu?.From,
            modules, subpages, PageUrl(config, row.Path), PageEditUrl(config, row.Path),
            "Modules are listed in their order with their stored layout (per screen size: columns, rows) and config; `text` is a readable digest of the words a module shows (not stored as such). " +
            "Look is the stored page look (theme, cover, show = presentation scenes, deck, style, lang). " + PagesNote);
    }

    /* -- Lesbar ---------------------------------------------------------------------------------- */

    /// <summary>Schlüssel, deren Werte keine Worte für Menschen sind (Kennungen, Adressen, Farben, Arten).</summary>
    private static readonly HashSet<string> NotWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "id", "module", "moduleId", "kind", "type", "image", "src", "href", "url", "icon", "color", "colour", "background", "bg", "font",
        "align", "style", "variant", "mode", "area", "areaId", "calendarId", "form", "formId", "library", "libraryId", "page", "path",
        "slug", "target", "anchor", "ref", "key", "lang", "size", "shape", "transition", "easing", "fit", "position", "view", "layout"
    };

    private static readonly Regex Tags = new("<[^>]+>", RegexOptions.Compiled);
    private static readonly Regex Uuid = new("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    /// <summary>Die Worte, die ein Baustein zeigt — die Zeichenketten seiner Einstellungen, ohne Kennungen und Technik, höchstens 6 000 Zeichen.</summary>
    public static string ReadableOf(JsonNode node)
    {
        var lines = new List<string>();
        var size = 0;
        void Walk(JsonNode? n, string? key)
        {
            if (n is null || size > 6000) return;
            switch (n)
            {
                case JsonObject o:
                    foreach (var (k, v) in o) if (!NotWords.Contains(k)) Walk(v, k);
                    break;
                case JsonArray a:
                    foreach (var v in a) Walk(v, key);
                    break;
                case JsonValue v when v.TryGetValue<string>(out var s):
                    var t = System.Net.WebUtility.HtmlDecode(Tags.Replace(s, " ")).Trim();
                    if (t.Length < 2 || Uuid.IsMatch(t) || t.StartsWith("http", StringComparison.OrdinalIgnoreCase) || t.StartsWith("page-image:", StringComparison.Ordinal)
                        || t.StartsWith('#') || t.StartsWith('{') || t.StartsWith('[') || !t.Any(char.IsLetter)) return;
                    if (lines.Count > 0 && lines[^1] == t) return;
                    lines.Add(t);
                    size += t.Length;
                    break;
            }
        }
        Walk(node, null);
        var text = string.Join("\n", lines);
        return text.Length > 6000 ? text[..6000].TrimEnd() + "…" : text;
    }

    /// <summary>Ohne Gross/klein und polnische Zeichen (wie die Suche der Einträge).</summary>
    private static string Fold(string text)
    {
        var d = text.ToLowerInvariant().Replace('ł', 'l').Normalize(NormalizationForm.FormD);
        var b = new StringBuilder(d.Length);
        foreach (var c in d) if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark) b.Append(c);
        return b.ToString();
    }

    private static List<string> PageWords(string? query) =>
        Fold(query ?? "").Split([' ', '\t', ',', ';', '/'], StringSplitOptions.RemoveEmptyEntries).ToList();

    /// <summary>Für <c>search</c>: Seiten, deren Adresse, Titel oder Vorspann alle Worte trägt — leer, wenn keine Seiten freigegeben sind.</summary>
    private static async Task<List<DocHit>> PageHitsAsync(IHttpContextAccessor http, Db db, IConfiguration config, string query, int max, CancellationToken ct)
    {
        var words = PageWords(query);
        if (words.Count == 0 || max <= 0) return [];
        try
        {
            await using var connection = await db.OpenAsync(ct);
            var areas = await PageAreasAsync(http, connection, config, ct);
            var rows = await PagesOfAsync(connection, areas, ct);
            return rows.Where(r => !r.Sealed && words.All(Fold($"{r.Path} {r.Title} {r.Lead}").Contains)).Take(max)
                .Select(r => new DocHit($"page:{(r.Path == Slug.Home ? "/" : r.Path)}", $"{r.Title ?? r.Path} (strona)", PageUrl(config, r.Path))).ToList();
        }
        catch (McpException) { return []; }
    }

    /// <summary>Für <c>fetch</c>: eine Seite (<c>page:&lt;path&gt;</c>) als lesbarer Text — Titel, Vorspann, dann jeder Baustein.</summary>
    private static async Task<Document> FetchPageAsync(IHttpContextAccessor http, Db db, IConfiguration config, string id, CancellationToken ct)
    {
        var page = await GetPage(http, db, config, id, ct);
        var text = new StringBuilder();
        if (page.Lead is not null) text.AppendLine(page.Lead).AppendLine();
        foreach (var m in page.Modules)
        {
            text.AppendLine($"[{m.Index}. {m.Kind}{(m.Name is null ? "" : " — " + m.Name)}]");
            if (m.Text is not null) text.AppendLine(m.Text);
            text.AppendLine();
        }
        if (page.Sealed) text.AppendLine("(strona zaszyfrowana — treść niedostępna)");
        var metadata = new Dictionary<string, string> { ["kind"] = "page", ["mode"] = page.Mode, ["access"] = page.Access, ["area"] = page.Area };
        if (page.UpdatedAt is not null) metadata["updatedAt"] = page.UpdatedAt;
        return new Document($"page:{page.Path}", page.Title ?? page.Path, text.ToString().TrimEnd(), page.Url, metadata);
    }
}
