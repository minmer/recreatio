using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.SqlClient;
using Rc.Kernel;

namespace Rc.Api;

/// <summary>
/// Cogita — der Wissensgraph.
///
/// <b>Alles Wissen ist ein Graph</b> (cogita-graph.md §0). Vokabellisten,
/// Begriffskarten, Zeitleisten, Telefonbuecher — Knoten mit Kanten dazwischen.
/// Die Plattform liefert die Mechanik, das Schema bestimmt der Benutzer.
///
/// <b>Eine Tabelle fuer alle Knoten.</b> EntityKind, EdgeKind, Range, Text,
/// Zahl und jede erfundene Art sind Knoten derselben Tabelle. Der ganze Punkt
/// ist, dass der Benutzer neue Arten erfindet, ohne dass jemand eine Migration
/// schreibt.
///
/// <b>Die Spannung, die diese Fassung aufloest.</b> §5.2 verlangt Volltextsuche
/// ueber alle Felder — das setzt Klartext voraus. Ein Server durchsucht nicht,
/// was er nicht lesen kann, und jede Form durchsuchbarer Verschluesselung
/// verraet etwas: Gleichheit, Haeufigkeit, Zugriffsmuster.
///
/// Aufgeloest wird das nicht mit einem Trick, sondern mit einer Entscheidung je
/// Bibliothek — oeffentlich (Klartext, Server sucht) oder privat (versiegelt,
/// der Browser sucht in dem, was er ohnehin geladen hat). Die zweite Form
/// skaliert schlechter. Das ist der Preis, und er wird genannt.
/// </summary>
public static class RcGraph
{
    /// <summary>
    /// §1.1 — Die eingebauten Arten. Erweiterbar ist der Graph ueber
    /// <c>entity</c> plus einen <c>entity_kind</c>-Knoten, nicht ueber diese
    /// Liste: sie steht auch als CHECK in der Datenbank.
    /// </summary>
    public static readonly string[] NodeKinds =
    [
        "text", "number", "date", "boolean", "media",
        "entity", "entity_kind", "edge_kind", "range",
        "knowledge", "topic", "question"
    ];

    /// <summary>
    /// §1.6 — Der Zustand einer Kante. <c>unknown</c> ist eine ANGABE und kein
    /// fehlender Wert: „wir wissen es nicht" zu sagen ist etwas anderes, als
    /// nichts zu sagen. Genau darin liegt der Gewinn dieses Modells.
    /// </summary>
    public static readonly string[] EdgeStates =
    [
        "known", "approximate", "disputed", "unknown", "not_applicable", "pending"
    ];

    public static void MapRcGraph(this IEndpointRouteBuilder app)
    {
        app.MapGet("/rc/libraries", ListAsync).Produces<RcLibrariesResponse>();
        app.MapPost("/rc/libraries", CreateLibraryAsync).Produces<RcLibraryCreatedResponse>();

        app.MapGet("/rc/libraries/{id:guid}/nodes", NodesAsync).Produces<RcNodesResponse>();
        app.MapPost("/rc/libraries/{id:guid}/nodes", AddNodeAsync).Produces<RcNodeCreatedResponse>();
        app.MapPost("/rc/libraries/{id:guid}/edges", AddEdgeAsync).Produces<RcEdgeCreatedResponse>();

        // §5 — Suche. Nur in oeffentlichen Bibliotheken; siehe die Begruendung
        // oben und die Antwort, die es ausdruecklich sagt.
        app.MapGet("/rc/libraries/{id:guid}/search", SearchAsync).Produces<RcGraphSearchResponse>();
    }

    private static RcAad ValueAad(Guid nodeId) =>
        RcAad.Create("cogita", "node", nodeId, RcField.GraphNodeValue, 1);

    private static RcAad NoteAad(Guid edgeId) =>
        RcAad.Create("cogita", "edge", edgeId, RcField.GraphEdgeNote, 1);

    // -- Bibliothek -----------------------------------------------------------

    public sealed record CreateLibraryRequest(string AreaId, string Slug, string Title, bool? IsPublic);

    private static async Task CreateLibraryAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, CreateLibraryRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.AreaId, out var areaId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Das ist keine Bereichskennung.");
            return;
        }

        var slug = RcEvents.Slugify(body.Slug);
        var title = body.Title?.Trim() ?? "";
        if (slug.Length is 0 or > 80 || title.Length is 0 or > 200)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Adresse oder Titel fehlen.");
            return;
        }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, areaId,
            RcCapability.Admin, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var tenantId = await TenantOfAreaAsync(connection, areaId, ctx.RequestAborted);
        if (tenantId == Guid.Empty) { await RcAreas.NotForYou(ctx); return; }

        var libraryId = RcId.NewId();
        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_library (id, area_id, tenant_id, slug, title, is_public, created_at)
            VALUES (@id, @area, @tenant, @slug, @title, @public, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", libraryId);
        insert.Parameters.AddWithValue("@area", areaId);
        insert.Parameters.AddWithValue("@tenant", tenantId);
        insert.Parameters.AddWithValue("@slug", slug);
        insert.Parameters.AddWithValue("@title", title);
        insert.Parameters.AddWithValue("@public", body.IsPublic ?? false);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Diese Adresse ist vergeben.");
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcLibraryCreatedResponse(
            RcId.ToText(libraryId), slug, title, body.IsPublic ?? false), StatusCodes.Status201Created);
    }

    public sealed record LibrarySummary(string LibraryId, string AreaId, string Slug,
        string Title, bool IsPublic, int Nodes, int Edges);

    private static async Task ListAsync(HttpContext ctx, RcDb db, RcPermissions permissions)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        await using var cmd = new SqlCommand("""
            SELECT l.id, l.area_id, l.slug, l.title, l.is_public,
                   (SELECT COUNT(*) FROM dbo.rc_node n WHERE n.library_id = l.id),
                   (SELECT COUNT(*) FROM dbo.rc_edge e WHERE e.library_id = l.id)
            FROM dbo.rc_library l ORDER BY l.title;
            """, connection);

        var all = new List<LibrarySummary>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
                all.Add(new LibrarySummary(
                    RcId.ToText(reader.GetGuid(0)), RcId.ToText(reader.GetGuid(1)),
                    reader.GetString(2), reader.GetString(3), reader.GetBoolean(4),
                    reader.GetInt32(5), reader.GetInt32(6)));
        }

        var visible = new List<LibrarySummary>();
        foreach (var library in all)
        {
            var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area,
                Guid.Parse(library.AreaId), RcCapability.Read, ctx.RequestAborted);
            if (may.Allowed) visible.Add(library);
        }

        await RcResults.WriteJsonAsync(ctx, new RcLibrariesResponse(visible));
    }

    // -- Knoten ---------------------------------------------------------------

    public sealed record AddNodeRequest(string Kind, string? Value, string? KindNodeId);

    private static async Task AddNodeAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, AddNodeRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        var kind = body.Kind?.Trim().ToLowerInvariant() ?? "";
        if (!NodeKinds.Contains(kind))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diese Art von Knoten gibt es nicht.");
            return;
        }

        // §1.3 — Eine Entitaet ist ein Verbindungspunkt und braucht die Art,
        // die sie beschreibt. Ohne sie waere sie ein Knoten, von dem niemand
        // sagen kann, was er sein soll.
        Guid? kindNode = Guid.TryParse(body.KindNodeId, out var k) ? k : null;
        if (kind == "entity" && kindNode is null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Eine Entitaet braucht die Art, die sie beschreibt.");
            return;
        }
        if (kind != "entity" && kindNode is not null)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Nur eine Entitaet verweist auf eine Art.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var library = await LoadLibraryAsync(connection, id, ctx.RequestAborted);
        if (library is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, library.AreaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        var nodeId = RcId.NewId();
        var now = DateTimeOffset.UtcNow;
        var value = body.Value?.Trim();

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_node
                (id, library_id, kind, kind_node_id, value, value_sealed, epoch, created_at, updated_at)
            VALUES (@id, @library, @kind, @kindNode, @value, @sealed, @epoch, @now, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", nodeId);
        insert.Parameters.AddWithValue("@library", id);
        insert.Parameters.AddWithValue("@kind", kind);
        insert.Parameters.Add("@kindNode", System.Data.SqlDbType.UniqueIdentifier).Value =
            (object?)kindNode ?? DBNull.Value;
        insert.Parameters.AddWithValue("@now", now);

        if (string.IsNullOrEmpty(value))
        {
            // Ein Knoten ohne Wert ist erlaubt (§1.3): eine Entitaet ist ein
            // reiner Verbindungspunkt, bis das erste Feld gefuellt ist.
            insert.Parameters.Add("@value", System.Data.SqlDbType.NVarChar, -1).Value = DBNull.Value;
            insert.Parameters.Add("@sealed", System.Data.SqlDbType.VarBinary).Value = DBNull.Value;
            insert.Parameters.Add("@epoch", System.Data.SqlDbType.Int).Value = DBNull.Value;
        }
        else if (library.IsPublic)
        {
            insert.Parameters.Add("@value", System.Data.SqlDbType.NVarChar, -1).Value = value;
            insert.Parameters.Add("@sealed", System.Data.SqlDbType.VarBinary).Value = DBNull.Value;
            insert.Parameters.Add("@epoch", System.Data.SqlDbType.Int).Value = DBNull.Value;
        }
        else
        {
            using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
            var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
                library.AreaId, ctx.RequestAborted);

            if (keys.Count == 0)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                    RcErrorCodes.CryptoMissingEpoch, "Du hast keinen Schluessel fuer diese Bibliothek.");
                return;
            }

            var epoch = keys.Keys.Max();
            insert.Parameters.Add("@value", System.Data.SqlDbType.NVarChar, -1).Value = DBNull.Value;
            insert.Parameters.AddWithValue("@sealed",
                RcCrypto.Seal(keys[epoch], ValueAad(nodeId), Encoding.UTF8.GetBytes(value)));
            insert.Parameters.AddWithValue("@epoch", epoch);
        }

        await insert.ExecuteNonQueryAsync(ctx.RequestAborted);

        await RcResults.WriteJsonAsync(ctx, new RcNodeCreatedResponse(
            RcId.ToText(nodeId), kind), StatusCodes.Status201Created);
    }

    public sealed record NodeView(string NodeId, string Kind, string? KindNodeId,
        string? Value, string? Unreadable);

    private static async Task NodesAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, string? kind, int? limit)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var library = await LoadLibraryAsync(connection, id, ctx.RequestAborted);
        if (library is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, library.AreaId,
            RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        Dictionary<int, byte[]> keys = [];
        if (!library.IsPublic)
        {
            using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
            keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
                library.AreaId, ctx.RequestAborted);
        }

        await using var cmd = new SqlCommand("""
            SELECT TOP (@limit) id, kind, kind_node_id, value, value_sealed, epoch
            FROM dbo.rc_node
            WHERE library_id = @library AND (@kind IS NULL OR kind = @kind)
            ORDER BY seq;
            """, connection);

        cmd.Parameters.AddWithValue("@library", id);
        cmd.Parameters.AddWithValue("@limit", Math.Clamp(limit ?? 200, 1, 1000));
        cmd.Parameters.Add("@kind", System.Data.SqlDbType.NVarChar, 40).Value =
            (object?)kind ?? DBNull.Value;

        var views = new List<NodeView>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var nodeId = reader.GetGuid(0);
                var sealedValue = reader.IsDBNull(4) ? null : (byte[])reader[4];

                string? value = reader.IsDBNull(3) ? null : reader.GetString(3);
                string? unreadable = null;

                if (sealedValue is not null)
                {
                    var epoch = reader.GetInt32(5);
                    if (!keys.TryGetValue(epoch, out var key))
                    {
                        // 15.9 — Der Knoten faellt NICHT aus dem Graphen. Ein
                        // Loch im Graphen waere schlimmer als ein Knoten ohne
                        // Beschriftung: die Kanten daran zeigten ins Leere.
                        unreadable = RcErrorCodes.CryptoMissingEpoch;
                    }
                    else
                    {
                        try { value = Encoding.UTF8.GetString(RcCrypto.Open(key, ValueAad(nodeId), sealedValue)); }
                        catch (RcDecryptException e) { unreadable = e.Code; }
                    }
                }

                views.Add(new NodeView(
                    RcId.ToText(nodeId), reader.GetString(1),
                    reader.IsDBNull(2) ? null : RcId.ToText(reader.GetGuid(2)),
                    value, unreadable));
            }
        }

        await RcResults.WriteJsonAsync(ctx, new RcNodesResponse(views, library.IsPublic));
    }

    // -- Kanten ---------------------------------------------------------------

    public sealed record AddEdgeRequest(string FromNodeId, string ToNodeId, string Kind,
        string? KindNodeId, string? State, string? Note, string? SourceNodeId, int? SortOrder);

    private static async Task AddEdgeAsync(
        HttpContext ctx, RcDb db, RcMasterKey masterKeys, RcPermissions permissions,
        Guid id, AddEdgeRequest body)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        if (!Guid.TryParse(body.FromNodeId, out var fromId) || !Guid.TryParse(body.ToNodeId, out var toId))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Die Kante braucht zwei Knoten.");
            return;
        }

        // Die Schlinge zuerst — vor allem anderen. Sonst faellt sie erst der
        // Pruefung "gehoeren beide Knoten hierher" auf: die zaehlt bei zwei
        // gleichen Kennungen EINE Zeile und meldet dann etwas, das nicht das
        // Problem ist. Ein richtiges Nein mit falscher Begruendung schickt den
        // Suchenden in die falsche Richtung.
        if (fromId == toId)
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied,
                "Eine Kante von einem Knoten auf sich selbst ist fast immer ein Versehen.");
            return;
        }

        var state = body.State?.Trim().ToLowerInvariant() ?? "known";
        if (!EdgeStates.Contains(state))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied, "Diesen Zustand gibt es nicht.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var library = await LoadLibraryAsync(connection, id, ctx.RequestAborted);
        if (library is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, library.AreaId,
            RcCapability.Write, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        // Beide Knoten muessen in DIESER Bibliothek liegen. Eine Kante ueber
        // Bibliotheksgrenzen waere ein Weg, Inhalte einer Bibliothek in einer
        // anderen sichtbar zu machen — und die Berechtigung haengt an der
        // Bibliothek.
        if (!await BothInLibraryAsync(connection, id, fromId, toId, ctx.RequestAborted))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status409Conflict,
                RcErrorCodes.PermissionDenied, "Beide Knoten muessen zu dieser Bibliothek gehoeren.");
            return;
        }

        var edgeId = RcId.NewId();
        var note = body.Note?.Trim();

        await using var insert = new SqlCommand("""
            INSERT INTO dbo.rc_edge
                (id, library_id, from_node_id, to_node_id, kind, kind_node_id, state,
                 source_node_id, note, note_sealed, epoch, sort_order, created_at)
            VALUES (@id, @library, @from, @to, @kind, @kindNode, @state,
                    @source, @note, @sealed, @epoch, @sort, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", edgeId);
        insert.Parameters.AddWithValue("@library", id);
        insert.Parameters.AddWithValue("@from", fromId);
        insert.Parameters.AddWithValue("@to", toId);
        insert.Parameters.AddWithValue("@kind", (body.Kind?.Trim() ?? "relates_to").ToLowerInvariant());
        insert.Parameters.Add("@kindNode", System.Data.SqlDbType.UniqueIdentifier).Value =
            Guid.TryParse(body.KindNodeId, out var kn) ? kn : DBNull.Value;
        insert.Parameters.AddWithValue("@state", state);
        insert.Parameters.Add("@source", System.Data.SqlDbType.UniqueIdentifier).Value =
            Guid.TryParse(body.SourceNodeId, out var src) ? src : DBNull.Value;
        insert.Parameters.AddWithValue("@sort", body.SortOrder ?? 0);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        if (string.IsNullOrEmpty(note))
        {
            insert.Parameters.Add("@note", System.Data.SqlDbType.NVarChar, -1).Value = DBNull.Value;
            insert.Parameters.Add("@sealed", System.Data.SqlDbType.VarBinary).Value = DBNull.Value;
            insert.Parameters.Add("@epoch", System.Data.SqlDbType.Int).Value = DBNull.Value;
        }
        else if (library.IsPublic)
        {
            insert.Parameters.Add("@note", System.Data.SqlDbType.NVarChar, -1).Value = note;
            insert.Parameters.Add("@sealed", System.Data.SqlDbType.VarBinary).Value = DBNull.Value;
            insert.Parameters.Add("@epoch", System.Data.SqlDbType.Int).Value = DBNull.Value;
        }
        else
        {
            using var held = await masterKeys.OpenAsync(connection, session, ctx.RcUnlockPiece(), ctx.RequestAborted);
            var keys = await RcAreaKeys.EpochKeysAsync(connection, session.AccountId, held.MasterKey,
                library.AreaId, ctx.RequestAborted);

            if (keys.Count == 0)
            {
                await RcResults.WriteErrorAsync(ctx, StatusCodes.Status403Forbidden,
                    RcErrorCodes.CryptoMissingEpoch, "Du hast keinen Schluessel fuer diese Bibliothek.");
                return;
            }

            var epoch = keys.Keys.Max();
            insert.Parameters.Add("@note", System.Data.SqlDbType.NVarChar, -1).Value = DBNull.Value;
            insert.Parameters.AddWithValue("@sealed",
                RcCrypto.Seal(keys[epoch], NoteAad(edgeId), Encoding.UTF8.GetBytes(note)));
            insert.Parameters.AddWithValue("@epoch", epoch);
        }

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Message.Contains("ck_rc_edge_loop"))
        {
            await RcResults.WriteErrorAsync(ctx, StatusCodes.Status400BadRequest,
                RcErrorCodes.PermissionDenied,
                "Eine Kante von einem Knoten auf sich selbst ist fast immer ein Versehen.");
            return;
        }

        await RcResults.WriteJsonAsync(ctx, new RcEdgeCreatedResponse(
            RcId.ToText(edgeId), state), StatusCodes.Status201Created);
    }

    // -- Suche ----------------------------------------------------------------

    public sealed record SearchHit(string NodeId, string Kind, string Value);

    /// <summary>
    /// §5 — Suche, und die ehrliche Grenze dabei.
    ///
    /// In einer OEFFENTLICHEN Bibliothek durchsucht der Server die Werte. In
    /// einer privaten liegen sie versiegelt; er kann es nicht, und er tut auch
    /// nicht so. Die Antwort sagt es ausdruecklich (<c>serverSide: false</c>),
    /// damit die Oberflaeche im Browser suchen kann, statt eine leere Liste
    /// fuer „nichts gefunden" zu halten.
    ///
    /// Der Unterschied zwischen „ich habe gesucht und nichts gefunden" und
    /// „ich kann hier nicht suchen" ist genau die Art Auskunft, die eine
    /// verschluesselte Plattform schuldig bleibt, wenn sie nicht aufpasst.
    /// </summary>
    private static async Task SearchAsync(
        HttpContext ctx, RcDb db, RcPermissions permissions, Guid id, string? q)
    {
        var session = ctx.RcSession();
        if (session is null) { await RcAreas.Unauthenticated(ctx); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var library = await LoadLibraryAsync(connection, id, ctx.RequestAborted);
        if (library is null) { await RcAreas.NotForYou(ctx); return; }

        var may = await permissions.CheckAsync(session.AccountId, RcScopeKind.Area, library.AreaId,
            RcCapability.Read, ctx.RequestAborted);
        if (!may.Allowed) { await RcAreas.NotForYou(ctx); return; }

        if (!library.IsPublic)
        {
            await RcResults.WriteJsonAsync(ctx, new RcGraphSearchResponse([], false));
            return;
        }

        var needle = q?.Trim() ?? "";
        if (needle.Length == 0)
        {
            await RcResults.WriteJsonAsync(ctx, new RcGraphSearchResponse([], true));
            return;
        }

        await using var cmd = new SqlCommand("""
            SELECT TOP (50) id, kind, value
            FROM dbo.rc_node
            WHERE library_id = @library AND value IS NOT NULL AND value LIKE @needle
            ORDER BY CASE WHEN value = @exact THEN 0 ELSE 1 END, LEN(value), seq;
            """, connection);

        cmd.Parameters.AddWithValue("@library", id);
        // §5.2 — Genaue Treffer zuerst, dann der Rest. Die Sortierung steht in
        // der Abfrage und nicht im Klienten: sonst muesste jeder Klient sie
        // nachbauen, und der zweite baut sie anders.
        cmd.Parameters.AddWithValue("@exact", needle);
        cmd.Parameters.AddWithValue("@needle", "%" + needle.Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]") + "%");

        var hits = new List<SearchHit>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
                hits.Add(new SearchHit(RcId.ToText(reader.GetGuid(0)),
                    reader.GetString(1), reader.GetString(2)));
        }

        await RcResults.WriteJsonAsync(ctx, new RcGraphSearchResponse(hits, true));
    }

    // -- Kleinkram ------------------------------------------------------------

    private sealed record LibraryRow(Guid Id, Guid AreaId, bool IsPublic);

    private static async Task<LibraryRow?> LoadLibraryAsync(
        SqlConnection connection, Guid libraryId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT id, area_id, is_public FROM dbo.rc_library WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", libraryId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct)
            ? new LibraryRow(reader.GetGuid(0), reader.GetGuid(1), reader.GetBoolean(2))
            : null;
    }

    private static async Task<bool> BothInLibraryAsync(
        SqlConnection connection, Guid libraryId, Guid from, Guid to, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT COUNT(*) FROM dbo.rc_node
            WHERE library_id = @library AND id IN (@from, @to);
            """, connection);
        cmd.Parameters.AddWithValue("@library", libraryId);
        cmd.Parameters.AddWithValue("@from", from);
        cmd.Parameters.AddWithValue("@to", to);
        return await cmd.ExecuteScalarAsync(ct) is int n && n == 2;
    }

    private static async Task<Guid> TenantOfAreaAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT tenant_id FROM dbo.rc_area WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", areaId);
        return await cmd.ExecuteScalarAsync(ct) is Guid g ? g : Guid.Empty;
    }
}
