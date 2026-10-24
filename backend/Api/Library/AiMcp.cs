using System.ComponentModel;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kernel;
using ModelContextProtocol;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Api;

/// <summary>
/// RECREATIO ALS MCP-SERVER (0127, 2026-10-24) — <c>https://api.recreatio.pl/mcp</c>, Streamable HTTP
/// über das offizielle SDK (<c>ModelContextProtocol.AspNetCore</c>), zustandslos.
///
/// <para>
/// <b>Eine dünne Schicht über dem Dostęp dla AI (0126).</b> Wer sich verbindet, bringt einen oder
/// mehrere Links mit — als OAuth-Zugangstoken (<c>AiOAuth.cs</c>: der Mensch gibt im Browser seine
/// Links frei; das Token IST die Liste ihrer Geheimnisse) oder als Pfad <c>/mcp/{link}</c> für
/// Programme ohne OAuth. Jeder Aufruf öffnet die Abschriften dieser Links genau so wie
/// <c>/ai/{link}</c> (<see cref="AiAccess.OpenLinkAsync"/>): dieselben Behälter, dieselbe Gültigkeit,
/// derselbe Urheber, der den Bereich noch prowadzi. Es gibt nichts zu schreiben.
/// </para>
///
/// <para>
/// <b>Kein Geheimnis in einer Antwort.</b> Die Adressen der Einträge zeigen in die App
/// (<c>recreatio.pl/#/workspace/…</c> — dort öffnet sie nur, wer den Bereich liest), nie auf
/// <c>/ai/{link}</c>.
/// </para>
/// </summary>
public static class AiMcp
{
    public const string Scope = "recreatio.read";
    public const string OpenCors = "ai-open";
    internal const string SecretsKey = "ai.mcp.secrets";
    private const int MaxLinks = 10;

    public const string Instructions =
        "Recreatio: read-only access to the Library (sources), Scriptorium (own texts) and knowledge bases (Cogita) the user authorized. " +
        "Start with list_collections, read entry types with get_schema, find entries with search_entries (all words; a short reference like \"J 21\" matches as a phrase), " +
        "read full entries with get_entry and follow arguments with get_related (fields such as grounds/objections). " +
        "Cite entries by title and url; never invent entries. Content is mostly Polish.";

    public static void AddServices(IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddMcpServer(options =>
            {
                options.ServerInfo = new Implementation { Name = "recreatio", Title = "Recreatio", Version = "1.0.0" };
                options.ServerInstructions = Instructions;
            })
            .WithHttpTransport()
            .WithTools<AiMcpTools>(AiMcpTools.Json);

        /* Ohne Kekse, für jeden Ursprung: der MCP-Server und OAuth werden auch aus Browsern (MCP Inspector) gerufen. */
        services.AddCors(options => options.AddPolicy(OpenCors, policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()
            .WithExposedHeaders("WWW-Authenticate", "Mcp-Session-Id", "Mcp-Protocol-Version")));
    }

    public static void Map(WebApplication app)
    {
        app.Use(GateAsync);
        app.MapMcp("/mcp").RequireCors(OpenCors);
        app.MapMcp("/mcp/{link}").RequireCors(OpenCors);
        AiOAuth.Map(app);
    }

    /// <summary>Die Geheimnisse eines Zugangstokens: Links, mit Punkt getrennt (höchstens zehn).</summary>
    public static List<string> SecretsOf(string? token) =>
        (token ?? "").Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(AiAccess.TokenOf).OfType<string>().Distinct().Take(MaxLinks).ToList();

    /// <summary>
    /// DIE TÜR ZUM MCP: ohne Ausweis 401 mit dem Hinweis, wo OAuth beginnt (RFC 9728); mit Ausweis nur
    /// die Links, die gerade gelten. Gilt keiner, ist es wieder 401 — der Assistent meldet sich neu an.
    /// </summary>
    private static async Task GateAsync(HttpContext ctx, RequestDelegate next)
    {
        if (!ctx.Request.Path.StartsWithSegments("/mcp") || HttpMethods.IsOptions(ctx.Request.Method))
        {
            await next(ctx);
            return;
        }

        var db = ctx.RequestServices.GetRequiredService<Db>();
        var fromPath = ctx.GetRouteValue("link") as string;
        var header = ctx.Request.Headers.Authorization.ToString();
        var bearer = header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? header[7..].Trim() : null;
        var secrets = fromPath is not null ? SecretsOf(fromPath) : SecretsOf(bearer);

        var works = new List<string>();
        foreach (var secret in secrets) if (await AiAccess.LinkWorksAsync(db, secret, ctx.RequestAborted)) works.Add(secret);
        if (works.Count == 0)
        {
            var root = AiAccess.PublicRoot(ctx.Request);
            /* Kopfzeilen sind ASCII — die Beschreibung englisch, die polnische steht im Körper. */
            var error = secrets.Count == 0 ? "" : ", error=\"invalid_token\", error_description=\"The access link was deleted, has expired, or its creator no longer leads the area.\"";
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            ctx.Response.Headers.WWWAuthenticate = $"Bearer resource_metadata=\"{root}/.well-known/oauth-protected-resource/mcp\", scope=\"{Scope}\"{error}";
            ctx.Response.Headers.CacheControl = "no-store";
            await ctx.Response.WriteAsJsonAsync(new { error = secrets.Count == 0 ? "unauthorized" : "invalid_token", message = "Połącz Recreatio przez OAuth albo podaj link dostępu dla AI." });
            return;
        }
        ctx.Items[SecretsKey] = works;
        await next(ctx);
    }
}

/// <summary>
/// Die Werkzeuge — nur lesend. Jedes öffnet die freigegebenen Links für die Dauer des Aufrufs.
/// Fehler sagen, was los ist: <c>not_found</c> (kein solcher Eintrag in diesem Zugang),
/// <c>unauthorized</c> (kein Link gilt mehr), <c>rate_limited</c>, <c>not_ready</c> (ein Behälter
/// hat noch keine Abschrift).
/// </summary>
[McpServerToolType]
public sealed class AiMcpTools
{
    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        /* Keine Felder weglassen: das Ausgabeschema verlangt jedes, auch wenn es null ist. */
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.Never,
        TypeInfoResolver = new System.Text.Json.Serialization.Metadata.DefaultJsonTypeInfoResolver()
    };

    private const int MaxRelated = 60;

    /* -- Ergebnisse ---------------------------------------------------------------------------- */

    public sealed record KindCount(string Kind, string Name, int Entries);
    public sealed record CollectionInfo(string Id, string Part, string PartName, string Name, string Area, int Entries, string? SnapshotMadeAt, bool Ready, IReadOnlyList<KindCount> Kinds);
    public sealed record CollectionsResult(IReadOnlyList<CollectionInfo> Collections, string AccessExpiresAt, string Note);
    public sealed record CollectionSchema(string Id, string Name, string Part, string Area, JsonArray Kinds);
    public sealed record SchemaResult(IReadOnlyList<CollectionSchema> Collections);
    public sealed record SearchHit(string Id, string Title, string Kind, string? Type, string? Key, string Collection, string Area, string Snippet, string Url);
    public sealed record SearchResult(string? Query, string Match, int Total, int Offset, int Limit, int? NextOffset, IReadOnlyList<SearchHit> Results, string? Note);
    public sealed record LinkInfo(string Field, string Id, string? Title, string? Kind, string? Locator, bool Outside, string? Url);
    public sealed record EntryResult(
        string Id, string Title, string Kind, string KindId, IReadOnlyList<string> Kinds, string? Type, string? Key, string? Tell,
        string Collection, string CollectionId, string Part, string Area, string? UpdatedAt, string Url,
        JsonObject Data, JsonArray Schema, IReadOnlyList<LinkInfo> Links, IReadOnlyList<LinkInfo> LinkedFrom, string Text);
    public sealed record RelatedNode(string Id, string Title, string Kind, string? Type, string Collection, string Url, int Depth, string? Text, JsonObject? Data);
    public sealed record RelatedEdge(string From, string To, string Field, string? Locator);
    public sealed record RelatedResult(string Root, IReadOnlyList<RelatedNode> Nodes, IReadOnlyList<RelatedEdge> Edges, int OutsideReferences, bool Truncated);
    public sealed record DocHit(string Id, string Title, string Url);
    public sealed record DocHits(IReadOnlyList<DocHit> Results);
    public sealed record Document(string Id, string Title, string Text, string Url, IReadOnlyDictionary<string, string> Metadata);

    /* -- Öffnen ---------------------------------------------------------------------------------- */

    /// <summary>Alle freigegebenen Links dieses Aufrufs, offen und als einer.</summary>
    private static async Task<AiAccess.Opened> OpenAsync(IHttpContextAccessor http, Db db, IConfiguration config, CancellationToken ct)
    {
        var ctx = http.HttpContext ?? throw new McpException("unauthorized: brak kontekstu żądania.");
        var secrets = ctx.Items[AiMcp.SecretsKey] as List<string> ?? [];
        var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? "?";
        var opened = new List<AiAccess.Opened>();
        var limited = false;
        foreach (var secret in secrets)
        {
            var (one, problem) = await AiAccess.OpenLinkAsync(db, secret, ip, "", ct);
            if (one is not null) opened.Add(one);
            else if (problem == AiAccess.LinkProblem.TooManyRequests) limited = true;
        }
        if (opened.Count == 0)
            throw new McpException(limited
                ? "rate_limited: za dużo zapytań na minutę — spróbuj za chwilę."
                : "unauthorized: żaden z udostępnionych linków już nie działa (usunięty, wygasły albo jego twórca nie prowadzi już obszaru). Połącz Recreatio ponownie.");
        var all = AiAccess.Opened.Combine(opened);
        foreach (var o in opened) o.Dispose();
        var app = AppOrigin(config);
        all.UrlOf = item => AppUrl(app, item);
        return all;
    }

    /// <summary>Wo die App liegt (für Adressen der Einträge): <c>Api:App</c>, sonst der erste Ursprung aus <c>Api:Origins</c>.</summary>
    internal static string AppOrigin(IConfiguration config) =>
        (config["Api:App"] ?? (config["Api:Origins"] ?? "https://recreatio.pl").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault() ?? "https://recreatio.pl").TrimEnd('/');

    /// <summary>Der Eintrag in der App — öffnet ihn nur, wer seinen Bereich liest.</summary>
    internal static string AppUrl(string app, AiAccess.Item item) => item.From.Part switch
    {
        "books" => $"{app}/#/workspace/library/{Ids.ToText(item.From.LibraryId)}/{item.Id}",
        "writing" => $"{app}/#/workspace/scriptorium/{Ids.ToText(item.From.LibraryId)}/{item.Id}",
        _ => $"{app}/#/workspace/knowledge/{Ids.ToText(item.From.LibraryId)}/wpisy/{item.Id}"
    };

    private static AiAccess.Item Find(AiAccess.Opened o, string id) =>
        o.Get(id) ?? throw new McpException($"not_found: w udostępnionych zbiorach nie ma wpisu o id ani kluczu „{id}”. Szukaj przez search_entries.");

    private static LinkInfo LinkOf(AiAccess.Opened o, AiAccess.Link l) => !l.Outside && o.Get(l.Id) is AiAccess.Item to
        ? new LinkInfo(l.Field, to.Id, to.Title, to.KindName, l.Locator, false, o.Url(to))
        : new LinkInfo(l.Field, l.Id, null, null, null, true, null);

    private static JsonObject ObjectOf(JsonElement e) => e.ValueKind == JsonValueKind.Object ? JsonNode.Parse(e.GetRawText())!.AsObject() : [];
    private static JsonArray ArrayOf(JsonElement e) => e.ValueKind == JsonValueKind.Array ? JsonNode.Parse(e.GetRawText())!.AsArray() : [];

    private static JsonArray SchemaOf(AiAccess.Item item)
    {
        var kinds = item.Kinds.Length > 0 ? item.Kinds : [item.Kind];
        var list = item.From.Kinds.ValueKind == JsonValueKind.Array
            ? item.From.Kinds.EnumerateArray().Where(k => k.TryGetProperty("id", out var id) && id.ValueKind == JsonValueKind.String && kinds.Contains(id.GetString())).ToList()
            : [];
        return new JsonArray(list.Select(k => (JsonNode?)JsonNode.Parse(k.GetRawText())).ToArray());
    }

    /* -- Werkzeuge --------------------------------------------------------------------------------- */

    [McpServerTool(Name = "list_collections", Title = "Zbiory Recreatio", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("List the collections the user authorized: Libraries (sources: works, quotes, persons), Scriptoria (own texts, deliveries, projects) and knowledge bases (Cogita). For each: id, area, number of entries, the kinds of entries with counts, and when its snapshot was made. Call this first.")]
    public static async Task<CollectionsResult> ListCollections(IHttpContextAccessor http, Db db, IConfiguration config, CancellationToken cancellationToken)
    {
        using var o = await OpenAsync(http, db, config, cancellationToken);
        var collections = o.Parts.Select(p => new CollectionInfo(
                Ids.ToText(p.LibraryId), p.Part, AiAccess.PartLabel(p.Part), p.Name, p.AreaName, p.Items.Count, p.MadeAt, true,
                p.Items.GroupBy(i => (i.Kind, i.KindName)).Select(g => new KindCount(g.Key.Kind, g.Key.KindName, g.Count())).OrderByDescending(k => k.Entries).ToList()))
            .Concat(o.Missing.Select(m => new CollectionInfo(Ids.ToText(m.Library), m.Part, AiAccess.PartLabel(m.Part), AiAccess.PartLabel(m.Part), m.Area, 0, null, false, [])))
            .ToList();
        return new CollectionsResult(collections, o.Expires.ToString("O"),
            "Ready = false: the collection's snapshot is not built yet (it appears when someone who writes in the area opens Recreatio). Its entries are not missing, only not yet readable here.");
    }

    [McpServerTool(Name = "get_schema", Title = "Rodzaje wpisów", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("The entry types (kinds) of the authorized collections with their fields: key, label, type (line, text, markup, blocks, ref, refs, number, date, choice …), what a field means (says), reference targets (to: kind ids), multiplicity (multi) and options. Use it to interpret entry data. Optionally limit to one collection (id or name).")]
    public static async Task<SchemaResult> GetSchema(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Collection id or name; empty for all.")] string? collection = null,
        CancellationToken cancellationToken = default)
    {
        using var o = await OpenAsync(http, db, config, cancellationToken);
        var parts = o.Parts.Where(p => string.IsNullOrWhiteSpace(collection)
            || string.Equals(Ids.ToText(p.LibraryId), collection.Trim(), StringComparison.OrdinalIgnoreCase)
            || AiAccess.Fold(p.Name) == AiAccess.Fold(collection)).ToList();
        if (parts.Count == 0 && !string.IsNullOrWhiteSpace(collection))
            throw new McpException($"not_found: nie ma udostępnionego zbioru „{collection}”. Zobacz list_collections.");
        return new SchemaResult(parts.Select(p => new CollectionSchema(Ids.ToText(p.LibraryId), p.Name, p.Part, p.AreaName,
            ArrayOf(p.Kinds))).ToList());
    }

    [McpServerTool(Name = "search_entries", Title = "Szukaj wpisów", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Search or list entries. All words must occur (in title, key, kind or content); case and Polish letters do not matter; words of 1–2 characters count only as whole words, and entries where the words stand together (\"J 21\" in \"J 21,15-17\") come first. Without a query it lists everything in a stable order. Filter by collection (id, name, or books/writing/knowledge) and kind (kind id or name, e.g. Komentarz, Cytat, Kazanie). Page with offset/limit until nextOffset is null.")]
    public static async Task<SearchResult> SearchEntries(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Words to find; empty to list all.")] string? query = null,
        [Description("Collection id, name, or books / writing / knowledge.")] string? collection = null,
        [Description("Kind id or name, e.g. Komentarz.")] string? kind = null,
        [Description("Results per page, 1–50 (default 20).")] int limit = 20,
        [Description("How many results to skip.")] int offset = 0,
        CancellationToken cancellationToken = default)
    {
        using var o = await OpenAsync(http, db, config, cancellationToken);
        limit = Math.Clamp(limit, 1, 50);
        offset = Math.Max(0, offset);
        var terms = AiAccess.Terms(query);
        var (found, all) = AiAccess.Find(o.Items, query, collection, kind);
        var page = found.Skip(offset).Take(limit).Select(i => new SearchHit(i.Id, i.Title, i.KindName, i.TypeName, i.Key, i.From.Name, i.From.AreaName,
            AiAccess.Snippet(i.Plain, terms), o.Url(i))).ToList();
        return new SearchResult(terms.Count == 0 ? null : query!.Trim(), terms.Count == 0 ? "list" : all ? "all words" : "some words (nothing had all of them)",
            found.Count, offset, limit, offset + limit < found.Count ? offset + limit : null, page,
            o.Missing.Count == 0 ? null : $"{o.Missing.Count} collection(s) have no snapshot yet; their entries are not searchable now.");
    }

    [McpServerTool(Name = "get_entry", Title = "Wpis", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("One complete entry by id (or citation key): its data exactly as stored (references are ids), the meaning of its fields (schema), its outgoing references with the field they come from and their locator (links), the entries that refer to it (linkedFrom), and a readable text rendering with titles in place of ids.")]
    public static async Task<EntryResult> GetEntry(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Entry id (UUID) or citation key.")] string id,
        CancellationToken cancellationToken = default)
    {
        using var o = await OpenAsync(http, db, config, cancellationToken);
        var item = Find(o, id);
        return new EntryResult(item.Id, item.Title, item.KindName, item.Kind, item.Kinds.Length > 0 ? item.Kinds : [item.Kind], item.TypeName, item.Key, item.Tell,
            item.From.Name, Ids.ToText(item.From.LibraryId), item.From.Part, item.From.AreaName, item.UpdatedAt, o.Url(item),
            ObjectOf(item.Data), SchemaOf(item),
            o.LinksOf(item).Select(l => LinkOf(o, l)).ToList(),
            o.Backlinks(item).Take(100).Select(b => new LinkInfo(b.Link.Field, b.From.Id, b.From.Title, b.From.KindName, b.Link.Locator, false, o.Url(b.From))).ToList(),
            AiAccess.Render(item, o));
    }

    [McpServerTool(Name = "get_related", Title = "Powiązane wpisy", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Follow references from an entry to reconstruct a network, e.g. a comment with its grounds and objections and theirs in turn. Breadth-first up to depth 1–3; direction out (what it refers to), in (what refers to it) or both; optionally only some fields (e.g. [\"grounds\", \"objections\"]). Returns nodes with their readable text and the edges with field and locator. References outside the authorization are only counted.")]
    public static async Task<RelatedResult> GetRelated(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Entry id (UUID) or citation key to start from.")] string id,
        [Description("How many steps to follow, 1–3 (default 2).")] int depth = 2,
        [Description("out, in or both (default out).")] string direction = "out",
        [Description("Only follow these fields (field keys); empty for all.")] string[]? fields = null,
        [Description("Also return each node's raw data (default false).")] bool includeData = false,
        CancellationToken cancellationToken = default)
    {
        using var o = await OpenAsync(http, db, config, cancellationToken);
        var root = Find(o, id);
        depth = Math.Clamp(depth, 1, 3);
        var outward = direction is "out" or "both" || string.IsNullOrWhiteSpace(direction);
        var inward = direction is "in" or "both";
        var only = fields is { Length: > 0 } ? new HashSet<string>(fields, StringComparer.OrdinalIgnoreCase) : null;

        var nodes = new List<RelatedNode>();
        var edges = new List<RelatedEdge>();
        var seen = new Dictionary<string, int> { [root.Id] = 0 };
        var queue = new Queue<AiAccess.Item>([root]);
        var outside = 0;
        var truncated = false;
        nodes.Add(Node(root, 0));
        while (queue.Count > 0)
        {
            var at = queue.Dequeue();
            var level = seen[at.Id];
            if (level >= depth) continue;
            var steps = new List<(AiAccess.Item To, RelatedEdge Edge)>();
            if (outward)
                foreach (var l in o.LinksOf(at))
                {
                    if (only is not null && !only.Contains(l.Field)) continue;
                    if (l.Outside || o.Get(l.Id) is not AiAccess.Item to) { outside++; continue; }
                    steps.Add((to, new RelatedEdge(at.Id, to.Id, l.Field, l.Locator)));
                }
            if (inward)
                foreach (var (from, l) in o.Backlinks(at))
                {
                    if (only is not null && !only.Contains(l.Field)) continue;
                    steps.Add((from, new RelatedEdge(from.Id, at.Id, l.Field, l.Locator)));
                }
            foreach (var (to, edge) in steps)
            {
                if (!edges.Contains(edge)) edges.Add(edge);
                if (seen.ContainsKey(to.Id)) continue;
                if (nodes.Count >= MaxRelated) { truncated = true; continue; }
                seen[to.Id] = level + 1;
                nodes.Add(Node(to, level + 1));
                queue.Enqueue(to);
            }
        }
        return new RelatedResult(root.Id, nodes, edges, outside, truncated);

        RelatedNode Node(AiAccess.Item item, int at) => new(item.Id, item.Title, item.KindName, item.TypeName, item.From.Name, o.Url(item), at,
            AiAccess.Render(item, o), includeData ? ObjectOf(item.Data) : null);
    }

    /* -- Die Standardwerkzeuge für Recherche und Firmenwissen in ChatGPT ------------------------------- */

    [McpServerTool(Name = "search", Title = "Szukaj (standard)", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Standard search over all authorized Recreatio collections: returns up to 20 entries (id, title, url) for a query. Use fetch to read one.")]
    public static async Task<DocHits> Search(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Search words.")] string query,
        CancellationToken cancellationToken = default)
    {
        using var o = await OpenAsync(http, db, config, cancellationToken);
        var (found, _) = AiAccess.Find(o.Items, query, null, null);
        return new DocHits(found.Take(20).Select(i => new DocHit(i.Id, $"{i.Title} ({i.KindName}, {i.From.Name})", o.Url(i))).ToList());
    }

    [McpServerTool(Name = "fetch", Title = "Pobierz wpis (standard)", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Standard fetch: the full readable text of one entry by id (from search), with its references and the entries referring to it.")]
    public static async Task<Document> Fetch(
        IHttpContextAccessor http, Db db, IConfiguration config,
        [Description("Entry id from search.")] string id,
        CancellationToken cancellationToken = default)
    {
        using var o = await OpenAsync(http, db, config, cancellationToken);
        var item = Find(o, id);
        var metadata = new Dictionary<string, string>
        {
            ["kind"] = item.KindName,
            ["collection"] = item.From.Name,
            ["part"] = AiAccess.PartLabel(item.From.Part),
            ["area"] = item.From.AreaName
        };
        if (item.TypeName is not null) metadata["type"] = item.TypeName;
        if (item.Key is not null) metadata["key"] = item.Key;
        if (item.UpdatedAt is not null) metadata["updatedAt"] = item.UpdatedAt;
        return new Document(item.Id, item.Title, AiAccess.Render(item, o), o.Url(item), metadata);
    }
}
