using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Rollen — anlegen, benennen, umtypen, weitergeben, zurücknehmen.
///
/// <para>
/// <b>Der Dienst rechnet hier nichts Geheimes.</b> Er hält keine Schlüssel: den
/// Namen einer Rolle kann er weder lesen noch setzen, und eine Kante kann er
/// nicht unterschreiben. Was hereinkommt, ist fertig versiegelt und fertig
/// unterschrieben; seine Aufgabe ist die andere Hälfte, und die kann nur er:
/// </para>
///
/// <list type="bullet">
///   <item>PRÜFEN, ob die Unterschrift zum öffentlichen Schlüssel des Halters passt,</item>
///   <item>PRÜFEN, ob der Aufrufer die beteiligten Rollen überhaupt erreicht,</item>
///   <item>VERHINDERN, dass ein Kreis entsteht (3.14),</item>
///   <item>alles in EINER Transaktion ablegen.</item>
/// </list>
///
/// <para>
/// <b>Warum Unterschriften überhaupt.</b> Ohne sie wäre „gehört dazu" eine
/// Zeile, die ein INSERT herstellt — die ganze Rollenordnung wäre eine
/// Höflichkeitsvereinbarung mit dem, der die Datenbank hält. Mit ihr kann der
/// Betreiber sie nicht herstellen: der private Signierschlüssel liegt
/// versiegelt und geht nur im Browser seines Halters auf.
/// </para>
/// </summary>
public static partial class Roles
{
    /// <summary>
    /// 3.1 — Der Kernel deutet die Art einer Kante nicht; das tut das Modul.
    ///
    /// <para>
    /// <c>holds</c> ist die Art, mit der eine Rolle GEFUEHRT wird: der Halter
    /// hat ihren Schluessel und handelt in ihrem Namen. Der Altbestand nannte
    /// das <c>Owner</c>, und die Oberflaeche beschriftet es weiterhin so — ein
    /// zweiter Name in der Datenbank waere dieselbe Sache doppelt.
    /// </para>
    /// </summary>
    private const string HoldsEdge = "holds";

    /// <summary>
    /// Die drei Arten, die der Altbestand an jedem Knoten als drei Punkte
    /// zeichnete (<c>roleGraphConfig.ts</c>) — und die Ordnung, die
    /// <c>Domain/RoleRelationships.cs</c> ihnen gab:
    ///
    /// <code>
    ///   holds ("Owner")  fuehren: aendern, weitergeben, aufnehmen
    ///   write            eintragen, was der Rolle gehoert
    ///   read             hineinsehen
    /// </code>
    ///
    /// <para>
    /// <b>Die Art geht in die UNTERSCHRIFT ein</b> (0008), nicht nur in die
    /// Zeile. Deshalb steht die Liste hier und nicht bloss in der
    /// Pruefbedingung der Tabelle: was der Browser unterschreibt und was
    /// gespeichert wird, muss dieselbe Zeichenkette sein, sonst laesst sich die
    /// Kante hinterher nicht mehr nachpruefen.
    /// </para>
    ///
    /// <para>
    /// <b>Was hier NICHT steht</b>, ist die Bedeutung fuer die Schluessel.
    /// Heute oeffnet ein Rollenschluessel alles einer Rolle zugleich; eine
    /// Zuteilung kann deshalb nicht weniger hergeben als alles. Solange das so
    /// ist, sind <c>read</c> und <c>write</c> Hausregeln und keine Schranke —
    /// und die Oberflaeche hat das zu sagen, statt eine Sicherheit zu
    /// behaupten, die es nicht gibt.
    /// </para>
    /// </summary>
    private static readonly string[] EdgeKinds = [HoldsEdge, "write", "read"];

    private static bool IsEdgeKind(string? text) =>
        text is not null && Array.IndexOf(EdgeKinds, text) >= 0;

    /// <summary>
    /// Die Kanten, die BEFUGNIS tragen — und das sind nur die, mit denen eine
    /// Rolle gefuehrt wird.
    ///
    /// <para>
    /// <b>Warum das gefiltert gehoert.</b> Seit 0032 gibt es Kanten der Art
    /// <c>read</c> und <c>write</c>. Liefen sie in dieselbe Erreichbarkeit,
    /// holte sich jeder mit einer Lesekante das Recht, die Rolle umzubenennen,
    /// weiterzugeben oder zurueckzunehmen — eine Lesekante waere dann die
    /// staerkste Kante von allen.
    /// </para>
    ///
    /// <para>
    /// Sichtbar bleiben sie trotzdem: die Anzeige laeuft ueber alle Kanten,
    /// die Befugnis ueber diese.
    /// </para>
    /// </summary>
    private static List<RoleGraph.Edge> Held(IEnumerable<EdgeRow> edges) =>
        edges.Where(e => e.Kind == HoldsEdge)
             .Select(e => new RoleGraph.Edge(e.From, e.To))
             .ToList();

    /// <summary>
    /// Wie weit ein mitgeschickter Zeitpunkt danebenliegen darf. Er geht in die
    /// Unterschrift ein, kommt also aus dem Browser — ohne Fenster liesse sich
    /// eine Kante auf 1980 datieren, und die Reihenfolge im Protokoll wäre
    /// Behauptung statt Befund.
    /// </summary>
    private static readonly TimeSpan ClockSlack = TimeSpan.FromHours(1);

    public static void Map(WebApplication app)
    {
        app.MapGet("/workspace/roles", ListAsync);
        app.MapPost("/workspace/roles", CreateAsync);
        app.MapPost("/workspace/roles/{id:guid}/name", RenameAsync);
        app.MapPost("/workspace/roles/{id:guid}/kind", RetypeAsync);
        app.MapPost("/workspace/roles/{id:guid}/holders", AddHolderAsync);
        app.MapDelete("/workspace/roles/{id:guid}/holders/{holderId:guid}", DropHolderAsync);
        app.MapDelete("/workspace/roles/{id:guid}", RevokeAsync);

        /* 0065 — Links mit Zugang zu Bereichen (Roles.Invites.cs). */
        MapInvites(app);

        /* 0091 — welche Rolle wozu Zugang gibt (Roles.Reach.cs): zum Wählen für Links und Formulare. */
        app.MapGet("/workspace/roles/reach", ReachAsync);

        /* 2026-10-17 — eine Rolle der alten Form bekommt ihren eigenen Signierschlüssel (Roles.Layout.cs). */
        MapLayout(app);
    }

    /* -- Was hereinkommt ---------------------------------------------------- */

    /// <summary>Eine Kante, wie der Browser sie unterschrieben hat.</summary>
    public sealed record EdgeProof(string Id, long CreatedAt, string Signature);

    public sealed record CreateRequest(
        string Id,
        string Kind,
        string HolderRoleId,
        string WrapPublicKey,
        string SignPublicKey,
        string WrapPrivateSealed,
        string SignPrivateSealed,
        string? DisplayNameSealed,
        string GrantSealedBlob,
        EdgeProof Edge,

        /// <summary>
        /// Der Signierschluessel, verpackt fuer den Halter (0034). Ist er da,
        /// entsteht die Rolle in der getrennten Form: Lesen und Unterschreiben
        /// haben dann verschiedene Schluessel. Fehlt er, entsteht sie wie vor
        /// 0034 — EIN Schluessel fuer beides.
        /// </summary>
        string? SignGrantSealedBlob = null);

    /// <summary>
    /// <c>EdgeKind</c> fehlt bei aelteren Aufrufern — dann ist es <c>holds</c>,
    /// die einzige Art, die es vor 0032 gab. Ein stillschweigendes Umdeuten
    /// waere hier gefaehrlich: die Art steht in der Unterschrift, und wer
    /// nichts schickt, hat auch nichts anderes unterschrieben.
    /// </summary>
    public sealed record HolderRequest(
        string HolderRoleId, string GrantSealedBlob, EdgeProof Edge, string? EdgeKind = null,

        /// <summary>
        /// Nur fuer <c>holds</c> und nur bei getrennter Form: wer FUEHRT, muss
        /// unterschreiben koennen. Wer liest oder schreibt, bekommt ihn nicht —
        /// das ist der ganze Unterschied zwischen den Stufen.
        /// </summary>
        string? SignGrantSealedBlob = null);
    public sealed record NameRequest(string DisplayNameSealed);
    public sealed record KindRequest(string Kind);

    /* -- Anzeigen ----------------------------------------------------------- */

    private sealed record RoleRow(
        Guid Id, string Kind, byte[]? NameSealed, byte[] WrapPublic, byte[] SignPublic,
        byte[]? WrapPrivateSealed, byte[]? SignPrivateSealed, DateTimeOffset CreatedAt,
        byte KeyLayout);

    private sealed record EdgeRow(
        Guid Id, Guid From, Guid To, Guid Signer, string Kind, DateTimeOffset CreatedAt, DateTimeOffset? ExpiresAt);

    /// <summary>
    /// Alles, was der Browser braucht, um den Graphen zu zeichnen UND ihn zu
    /// öffnen: die Rollen mit ihren versiegelten Hälften, die Kanten, und die
    /// Zuteilungen (<c>key_grant</c>), aus denen er die Schlüssel der
    /// Unterrollen auspackt.
    ///
    /// <para>
    /// Nur, was von der persönlichen Rolle aus erreichbar ist. Erreichbarkeit im
    /// Graphen IST Schlüsselerreichbarkeit — eine Rolle, die hier nicht steht,
    /// könnte dieser Mensch ohnehin nicht öffnen.
    /// </para>
    /// </summary>
    private static async Task ListAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var person = await PersonRoleAsync(connection, null, who.Value.AccountId, ctx.RequestAborted);
        if (person is null)
        {
            await ctx.Response.WriteAsJsonAsync(new { personRoleId = (string?)null, roles = Array.Empty<object>(), edges = Array.Empty<object>(), grants = Array.Empty<object>() });
            return;
        }

        var (roles, edges) = await GraphAsync(connection, null, ctx.RequestAborted);
        var reachable = RoleGraph.Reachable(person.Value, Held(edges));

        var mine = roles.Where(r => reachable.Contains(r.Id)).ToList();
        var grants = await GrantsAsync(connection, mine.Select(r => r.Id).ToList(), ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            personRoleId = Ids.ToText(person.Value),
            roles = mine.Select(r => new
            {
                id = Ids.ToText(r.Id),
                kind = r.Kind,
                isPersonal = r.Id == person.Value,
                createdAt = r.CreatedAt,
                displayNameSealed = r.NameSealed is null ? null : Base64Url.Encode(r.NameSealed),
                wrapPublicKey = Base64Url.Encode(r.WrapPublic),
                signPublicKey = Base64Url.Encode(r.SignPublic),
                wrapPrivateSealed = r.WrapPrivateSealed is null ? null : Base64Url.Encode(r.WrapPrivateSealed),
                signPrivateSealed = r.SignPrivateSealed is null ? null : Base64Url.Encode(r.SignPrivateSealed),

                /* 0 = ein Schluessel oeffnet alles (vor 0034), 1 = getrennt. */
                keyLayout = r.KeyLayout
            }),
            edges = edges
                .Where(e => reachable.Contains(e.From) && reachable.Contains(e.To))
                .Select(e => new
                {
                    id = Ids.ToText(e.Id),
                    fromRoleId = Ids.ToText(e.From),
                    toRoleId = Ids.ToText(e.To),
                    signerRoleId = Ids.ToText(e.Signer),
                    edgeKind = e.Kind,
                    createdAt = e.CreatedAt,
                    expiresAt = e.ExpiresAt
                }),
            grants = grants.Select(g => new
            {
                holderRoleId = Ids.ToText(g.Holder),
                roleId = Ids.ToText(g.Granted),
                sealedBlob = Base64Url.Encode(g.Blob),

                /* `role` oeffnet Name und Lesen, `role_sign` das Unterschreiben. */
                keyKind = g.Kind
            })
        });
    }

private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
