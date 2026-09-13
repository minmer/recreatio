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
public static class Roles
{
    /// <summary>
    /// 3.1 — Der Kernel deutet die Art einer Kante nicht; das tut das Modul.
    /// Der Neubau vergibt heute genau eine.
    /// </summary>
    private const string HoldsEdge = "holds";

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
        EdgeProof Edge);

    public sealed record HolderRequest(string HolderRoleId, string GrantSealedBlob, EdgeProof Edge);
    public sealed record NameRequest(string DisplayNameSealed);
    public sealed record KindRequest(string Kind);

    /* -- Anzeigen ----------------------------------------------------------- */

    private sealed record RoleRow(
        Guid Id, string Kind, byte[]? NameSealed, byte[] WrapPublic, byte[] SignPublic,
        byte[]? WrapPrivateSealed, byte[]? SignPrivateSealed, DateTimeOffset CreatedAt);

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
        var reachable = RoleGraph.Reachable(person.Value, edges.Select(e => new RoleGraph.Edge(e.From, e.To)).ToList());

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
                signPrivateSealed = r.SignPrivateSealed is null ? null : Base64Url.Encode(r.SignPrivateSealed)
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
                sealedBlob = Base64Url.Encode(g.Blob)
            })
        });
    }

    /* -- Anlegen ------------------------------------------------------------ */

    /// <summary>
    /// Eine neue Rolle — Schlüssel, Zuteilung und Kante in einem Zug.
    ///
    /// <para>
    /// Drei Endpunkte daraus zu machen hiesse, dass es Rollen gäbe, die niemand
    /// hält — und die wären nicht bloss nutzlos, sondern unlöschbar nutzlos,
    /// weil niemand ihren Schlüssel hat.
    /// </para>
    ///
    /// <para>
    /// Ein Kreis kann hier nicht entstehen: eine gerade entstandene Rolle hat
    /// keine ausgehenden Kanten. Geprüft wird er trotzdem bei
    /// <see cref="AddHolderAsync"/>, wo er entstehen KANN.
    /// </para>
    /// </summary>
    private static async Task CreateAsync(HttpContext ctx, Db db, CreateRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.Id, out var roleId) || !Guid.TryParse(body.HolderRoleId, out var holderId)
            || !Guid.TryParse(body.Edge.Id, out var edgeId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        var kind = (body.Kind ?? string.Empty).Trim();
        if (kind is not ("office" or "member"))
        {
            // Persönliche Rollen entstehen mit dem Konto und sonst nie. Liesse
            // man sie hier zu, gäbe es persönliche Rollen ohne ableitbaren
            // Schlüssel — dieselbe Bezeichnung für zwei verschiedene Dinge.
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rola może być urzędem albo członkostwem.");
            return;
        }

        if (!TryBlobs(ctx, out var fail,
                (body.WrapPublicKey, "wrapPublicKey"), (body.SignPublicKey, "signPublicKey"),
                (body.WrapPrivateSealed, "wrapPrivateSealed"), (body.SignPrivateSealed, "signPrivateSealed"),
                (body.GrantSealedBlob, "grantSealedBlob"), (body.Edge.Signature, "signature")))
        {
            await fail;
            return;
        }

        var createdAt = DateTimeOffset.FromUnixTimeSeconds(body.Edge.CreatedAt);
        if (!IsFresh(createdAt))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Data podpisu nie zgadza się z zegarem.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var person = await PersonRoleAsync(connection, null, who.Value.AccountId, ctx.RequestAborted);
        if (person is null) { await Fail(ctx, StatusCodes.Status403Forbidden, "Nie masz jeszcze roli osobistej."); return; }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        var (roles, edges) = await GraphAsync(connection, tx, ctx.RequestAborted);
        var reachable = RoleGraph.Reachable(person.Value, edges.Select(e => new RoleGraph.Edge(e.From, e.To)).ToList());

        var holder = roles.FirstOrDefault(r => r.Id == holderId);
        if (holder is null || !reachable.Contains(holderId))
        {
            await tx.RollbackAsync(ctx.RequestAborted);

            // „Nicht erreichbar" und „gibt es nicht" bekommen dieselbe Antwort:
            // der Unterschied wäre eine Auskunft über fremde Rollen.
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ta rola nie jest Twoja.");
            return;
        }

        if (roles.Any(r => r.Id == roleId))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Taka rola już istnieje.");
            return;
        }

        if (!VerifyEdge(holder.SignPublic, edgeId, holderId, roleId, holderId, createdAt, Base64Url.Decode(body.Edge.Signature)))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis krawędzi się nie zgadza.");
            return;
        }

        await InsertRoleAsync(connection, tx, roleId, kind, body, ctx.RequestAborted);
        await InsertEdgeAsync(connection, tx, edgeId, holderId, roleId, holderId, createdAt,
            Base64Url.Decode(body.Edge.Signature), ctx.RequestAborted);
        await InsertGrantAsync(connection, tx, holderId, roleId, Base64Url.Decode(body.GrantSealedBlob),
            holderId, ctx.RequestAborted);

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(roleId), kind });
    }

    /* -- Weitergeben -------------------------------------------------------- */

    /// <summary>
    /// „Gib der Gruppe die Schriftführung." Der eigentliche Verwaltungsakt — und
    /// die einzige Stelle, an der ein Kreis entstehen kann (3.14).
    ///
    /// <para>
    /// Die Prüfung läuft INNERHALB der Transaktion. Ausserhalb könnte zwischen
    /// Prüfung und Einfügen eine zweite Kante entstehen, und der Kreis wäre
    /// trotz Prüfung da: zwei Verwalter, jeder für sich im Recht, und hinterher
    /// schliesst niemand mehr die Runde auf.
    /// </para>
    /// </summary>
    private static async Task AddHolderAsync(HttpContext ctx, Db db, Guid id, HolderRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.HolderRoleId, out var holderId) || !Guid.TryParse(body.Edge.Id, out var edgeId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        if (!TryBlobs(ctx, out var fail, (body.GrantSealedBlob, "grantSealedBlob"), (body.Edge.Signature, "signature")))
        {
            await fail;
            return;
        }

        var createdAt = DateTimeOffset.FromUnixTimeSeconds(body.Edge.CreatedAt);
        if (!IsFresh(createdAt))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Data podpisu nie zgadza się z zegarem.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var person = await PersonRoleAsync(connection, null, who.Value.AccountId, ctx.RequestAborted);
        if (person is null) { await Fail(ctx, StatusCodes.Status403Forbidden, "Nie masz jeszcze roli osobistej."); return; }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        var (roles, edges) = await GraphAsync(connection, tx, ctx.RequestAborted);
        var links = edges.Select(e => new RoleGraph.Edge(e.From, e.To)).ToList();
        var reachable = RoleGraph.Reachable(person.Value, links);

        var holder = roles.FirstOrDefault(r => r.Id == holderId);

        // Weitergeben kann man nur, was einem selbst offensteht — und in eine
        // Rolle, die man erreicht.
        if (holder is null || !reachable.Contains(holderId) || !reachable.Contains(id))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ta rola nie jest Twoja.");
            return;
        }

        if (edges.Any(e => e.From == holderId && e.To == id))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta rola już to trzyma.");
            return;
        }

        if (RoleGraph.WouldCreateCycle(holderId, id, links))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict,
                "To zamknęłoby krąg: obie role otwierałyby się nawzajem.");
            return;
        }

        if (!VerifyEdge(holder.SignPublic, edgeId, holderId, id, holderId, createdAt, Base64Url.Decode(body.Edge.Signature)))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis krawędzi się nie zgadza.");
            return;
        }

        await InsertEdgeAsync(connection, tx, edgeId, holderId, id, holderId, createdAt,
            Base64Url.Decode(body.Edge.Signature), ctx.RequestAborted);
        await InsertGrantAsync(connection, tx, holderId, id, Base64Url.Decode(body.GrantSealedBlob),
            holderId, ctx.RequestAborted);

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { id = Ids.ToText(edgeId) });
    }

    /// <summary>
    /// Eine Kante zurücknehmen — und mit ihr die Zuteilung.
    ///
    /// <para>
    /// <b>Die letzte Kante bleibt.</b> Eine Rolle ohne Halter ist eine Rolle,
    /// deren Schlüssel niemand mehr hat: sie lässt sich nicht mehr öffnen, nicht
    /// mehr umbenennen und nicht mehr zurücknehmen. Wer eine Rolle loswerden
    /// will, nimmt die Rolle zurück (<see cref="RevokeAsync"/>) — das ist
    /// derselbe Wunsch, aber vollständig.
    /// </para>
    /// </summary>
    private static async Task DropHolderAsync(HttpContext ctx, Db db, Guid id, Guid holderId)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var person = await PersonRoleAsync(connection, null, who.Value.AccountId, ctx.RequestAborted);
        if (person is null) { await Fail(ctx, StatusCodes.Status403Forbidden, "Nie masz jeszcze roli osobistej."); return; }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        var (_, edges) = await GraphAsync(connection, tx, ctx.RequestAborted);
        var reachable = RoleGraph.Reachable(person.Value, edges.Select(e => new RoleGraph.Edge(e.From, e.To)).ToList());

        if (!reachable.Contains(id) || !reachable.Contains(holderId))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ta rola nie jest Twoja.");
            return;
        }

        if (edges.Count(e => e.To == id) <= 1)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict,
                "To ostatni, kto trzyma tę rolę — bez niego nikt jej już nie otworzy. Usuń rolę zamiast tego.");
            return;
        }

        await using (var cmd = new SqlCommand("""
            UPDATE app.role_edge SET revoked_at = @now
            WHERE from_role_id = @from AND to_role_id = @to AND revoked_at IS NULL;

            UPDATE app.key_grant SET destroyed_at = @now
            WHERE role_id = @from AND key_kind = N'role' AND key_ref = @to AND destroyed_at IS NULL;
            """, connection, tx))
        {
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@from", holderId);
            cmd.Parameters.AddWithValue("@to", id);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { ok = true });
    }

    /* -- Benennen und umtypen ----------------------------------------------- */

    /// <summary>
    /// Den Namen setzen. Er kommt FERTIG VERSIEGELT herein — der Dienst legt ein
    /// Byte-Feld ab und weiss nicht, was darin steht.
    ///
    /// <para>
    /// <b>Wirkt rückwirkend.</b> Der Name liegt einmal an der Rolle und nicht als
    /// Kopie in allem, was sie je getan hat. Wer heiratet, heisst danach überall
    /// anders — auch über alten Einträgen. Die Alternative wäre, ihn überall
    /// mitzuschreiben; dann stünde der alte Name für immer an tausend Stellen.
    /// </para>
    ///
    /// <para>
    /// Wer den Schlüssel hat, darf: den Rollenschlüssel zu halten heisst, im
    /// Namen dieser Rolle handeln zu können — ihren Namen zu setzen ist weniger
    /// als das.
    /// </para>
    /// </summary>
    private static async Task RenameAsync(HttpContext ctx, Db db, Guid id, NameRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!TryBlobs(ctx, out var fail, (body.DisplayNameSealed, "displayNameSealed")))
        {
            await fail;
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MayTouchAsync(ctx, db, connection, id)) return;

        await using var cmd = new SqlCommand(
            "UPDATE app.role SET display_name_sealed = @name WHERE id = @id AND revoked_at IS NULL;", connection);

        cmd.Parameters.AddWithValue("@name", Base64Url.Decode(body.DisplayNameSealed));
        cmd.Parameters.AddWithValue("@id", id);

        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej roli nie ma.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { ok = true });
    }

    /// <summary>
    /// Die Art ändern — Amt oder Mitgliedschaft.
    ///
    /// <para>
    /// Die persönliche Rolle bleibt, was sie ist: ihr Schlüssel wird aus dem
    /// Hauptschlüssel ABGELEITET, und das gilt nur für sie. Hiesse sie plötzlich
    /// „Amt", stünde dieselbe Bezeichnung für zwei Dinge mit verschiedener
    /// Schlüsselherkunft.
    /// </para>
    /// </summary>
    private static async Task RetypeAsync(HttpContext ctx, Db db, Guid id, KindRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var kind = (body.Kind ?? string.Empty).Trim();
        if (kind is not ("office" or "member"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rola może być urzędem albo członkostwem.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MayTouchAsync(ctx, db, connection, id)) return;

        await using var cmd = new SqlCommand(
            "UPDATE app.role SET kind = @kind WHERE id = @id AND kind <> N'person' AND revoked_at IS NULL;",
            connection);

        cmd.Parameters.AddWithValue("@kind", kind);
        cmd.Parameters.AddWithValue("@id", id);

        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Roli osobistej nie da się przetypować.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { ok = true, kind });
    }

    /* -- Zurücknehmen ------------------------------------------------------- */

    /// <summary>
    /// Eine Rolle zurücknehmen — mit allen ihren Kanten und Zuteilungen.
    ///
    /// <para>
    /// Nicht gelöscht, sondern <c>revoked_at</c>: was sie getan hat, bleibt
    /// nachvollziehbar. Eine verschwundene Zeile protokolliert nichts.
    /// </para>
    ///
    /// <para>
    /// <b>Nicht, solange sie eine Adresse führt.</b> Sonst stünde
    /// <c>recreatio.pl/&lt;pfad&gt;</c> unter einer Rolle, die es nicht mehr
    /// gibt, und niemand könnte die Seite je wieder ändern.
    /// </para>
    /// </summary>
    private static async Task RevokeAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var person = await PersonRoleAsync(connection, null, who.Value.AccountId, ctx.RequestAborted);
        if (person is null) { await Fail(ctx, StatusCodes.Status403Forbidden, "Nie masz jeszcze roli osobistej."); return; }

        if (id == person.Value)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                "To Twoja rola osobista — bez niej konto nic nie trzyma.");
            return;
        }

        if (!await MayTouchAsync(ctx, db, connection, id)) return;

        await using (var holds = new SqlCommand(
            "SELECT TOP 1 path FROM app.slug WHERE claimed_by_role_id = @id;", connection))
        {
            holds.Parameters.AddWithValue("@id", id);
            if (await holds.ExecuteScalarAsync(ctx.RequestAborted) is string path)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    $"Ta rola prowadzi adres „{path}”. Najpierw przekaż go komuś innemu.");
                return;
            }
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.role      SET revoked_at   = @now WHERE id = @id AND revoked_at IS NULL;
            UPDATE app.role_edge SET revoked_at   = @now WHERE (from_role_id = @id OR to_role_id = @id) AND revoked_at IS NULL;
            UPDATE app.key_grant SET destroyed_at = @now WHERE (role_id = @id OR key_ref = @id) AND destroyed_at IS NULL;
            """, connection);

        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { ok = true });
    }

    /* -- Gemeinsames -------------------------------------------------------- */

    /// <summary>Erreicht dieser Mensch die Rolle? Sonst gibt es sie für ihn nicht.</summary>
    private static async Task<bool> MayTouchAsync(HttpContext ctx, Db db, SqlConnection connection, Guid roleId)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return false; }

        var person = await PersonRoleAsync(connection, null, who.Value.AccountId, ctx.RequestAborted);
        if (person is null)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Nie masz jeszcze roli osobistej.");
            return false;
        }

        var (_, edges) = await GraphAsync(connection, null, ctx.RequestAborted);
        var reachable = RoleGraph.Reachable(person.Value, edges.Select(e => new RoleGraph.Edge(e.From, e.To)).ToList());

        if (!reachable.Contains(roleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ta rola nie jest Twoja.");
            return false;
        }

        return true;
    }

    private static async Task<Guid?> PersonRoleAsync(
        SqlConnection connection, SqlTransaction? tx, Guid accountId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT person_role_id FROM app.account WHERE id = @id;", connection, tx);
        cmd.Parameters.AddWithValue("@id", accountId);

        return await cmd.ExecuteScalarAsync(ct) is Guid role ? role : null;
    }

    private static async Task<(List<RoleRow> Roles, List<EdgeRow> Edges)> GraphAsync(
        SqlConnection connection, SqlTransaction? tx, CancellationToken ct)
    {
        var roles = new List<RoleRow>();
        var edges = new List<EdgeRow>();

        await using (var cmd = new SqlCommand("""
            SELECT id, kind, display_name_sealed, wrap_public_key, sign_public_key,
                   wrap_private_sealed, sign_private_sealed, created_at
            FROM app.role WHERE revoked_at IS NULL;
            """, connection, tx))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                roles.Add(new RoleRow(
                    reader.GetGuid(0), reader.GetString(1),
                    reader.IsDBNull(2) ? null : (byte[])reader[2],
                    (byte[])reader[3], (byte[])reader[4],
                    reader.IsDBNull(5) ? null : (byte[])reader[5],
                    reader.IsDBNull(6) ? null : (byte[])reader[6],
                    reader.GetDateTimeOffset(7)));
            }
        }

        await using (var cmd = new SqlCommand("""
            SELECT id, from_role_id, to_role_id, signer_role_id, edge_kind, created_at, expires_at
            FROM app.role_edge WHERE revoked_at IS NULL;
            """, connection, tx))
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                edges.Add(new EdgeRow(
                    reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetGuid(3),
                    reader.GetString(4), reader.GetDateTimeOffset(5),
                    reader.IsDBNull(6) ? null : reader.GetDateTimeOffset(6)));
            }
        }

        return (roles, edges);
    }

    private static async Task<List<(Guid Holder, Guid Granted, byte[] Blob)>> GrantsAsync(
        SqlConnection connection, List<Guid> holders, CancellationToken ct)
    {
        var grants = new List<(Guid, Guid, byte[])>();
        if (holders.Count == 0) return grants;

        var names = string.Join(", ", holders.Select((_, i) => $"@h{i}"));
        await using var cmd = new SqlCommand(
            $"SELECT role_id, key_ref, sealed_blob FROM app.key_grant "
            + $"WHERE key_kind = N'role' AND destroyed_at IS NULL AND role_id IN ({names});", connection);

        for (var i = 0; i < holders.Count; i++) cmd.Parameters.AddWithValue($"@h{i}", holders[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            grants.Add((reader.GetGuid(0), reader.GetGuid(1), (byte[])reader[2]));
        }

        return grants;
    }

    /// <summary>
    /// Die Unterschrift gegen den öffentlichen Schlüssel des Unterzeichners.
    ///
    /// <para>
    /// Der Kernel baut dieselbe kanonische Form, die der Browser unterschrieben
    /// hat. Weicht ein Feld ab — auch nur die Reihenfolge —, passt die
    /// Unterschrift nicht, und das ist die Absicht: sie hängt am ganzen Inhalt,
    /// nicht an einem Teil davon.
    /// </para>
    /// </summary>
    private static bool VerifyEdge(
        byte[] signerSpki, Guid edgeId, Guid from, Guid to, Guid signer,
        DateTimeOffset createdAt, byte[] signature)
    {
        var record = new RoleEdgeRecord
        {
            Id = edgeId,
            FromRoleId = from,
            ToRoleId = to,
            EdgeKind = HoldsEdge,
            SignerRoleId = signer,
            CreatedUtc = createdAt
        };

        try
        {
            using var rsa = RSA.Create();
            rsa.ImportSubjectPublicKeyInfo(signerSpki, out _);
            return record.Verify(rsa, signature);
        }
        catch (CryptographicException)
        {
            return false;
        }
    }

    private static bool IsFresh(DateTimeOffset at)
    {
        var now = DateTimeOffset.UtcNow;
        return at <= now + ClockSlack && at >= now - ClockSlack;
    }

    private static async Task InsertRoleAsync(
        SqlConnection connection, SqlTransaction tx, Guid roleId, string kind,
        CreateRequest body, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO app.role
                (id, kind, display_name_sealed, wrap_public_key, sign_public_key,
                 wrap_private_sealed, sign_private_sealed, created_at)
            VALUES (@id, @kind, @name, @wrapPub, @signPub, @wrapPriv, @signPriv, @now);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", roleId);
        cmd.Parameters.AddWithValue("@kind", kind);
        cmd.Parameters.AddWithValue("@name",
            body.DisplayNameSealed is null ? DBNull.Value : Base64Url.Decode(body.DisplayNameSealed));
        cmd.Parameters.AddWithValue("@wrapPub", Base64Url.Decode(body.WrapPublicKey));
        cmd.Parameters.AddWithValue("@signPub", Base64Url.Decode(body.SignPublicKey));
        cmd.Parameters.AddWithValue("@wrapPriv", Base64Url.Decode(body.WrapPrivateSealed));
        cmd.Parameters.AddWithValue("@signPriv", Base64Url.Decode(body.SignPrivateSealed));
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task InsertEdgeAsync(
        SqlConnection connection, SqlTransaction tx, Guid edgeId, Guid from, Guid to, Guid signer,
        DateTimeOffset createdAt, byte[] signature, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO app.role_edge
                (id, from_role_id, to_role_id, signer_role_id, signature, edge_kind, created_at)
            VALUES (@id, @from, @to, @signer, @sig, @kind, @created);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", edgeId);
        cmd.Parameters.AddWithValue("@from", from);
        cmd.Parameters.AddWithValue("@to", to);
        cmd.Parameters.AddWithValue("@signer", signer);
        cmd.Parameters.AddWithValue("@sig", signature);
        cmd.Parameters.AddWithValue("@kind", HoldsEdge);

        // Derselbe Zeitpunkt, der unterschrieben wurde — auf die Sekunde. Sonst
        // liesse sich die Kante später nicht mehr nachprüfen.
        cmd.Parameters.AddWithValue("@created", createdAt);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task InsertGrantAsync(
        SqlConnection connection, SqlTransaction tx, Guid holderId, Guid grantedId,
        byte[] sealedBlob, Guid grantedBy, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            INSERT INTO app.key_grant
                (id, role_id, key_kind, key_ref, sealed_blob, granted_by_role_id, created_at)
            VALUES (@id, @role, N'role', @ref, @blob, @by, @now);
            """, connection, tx);

        cmd.Parameters.AddWithValue("@id", Ids.NewId());
        cmd.Parameters.AddWithValue("@role", holderId);
        cmd.Parameters.AddWithValue("@ref", grantedId);
        cmd.Parameters.AddWithValue("@blob", sealedBlob);
        cmd.Parameters.AddWithValue("@by", grantedBy);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Base64URL-Felder einlesen, die nicht fehlen dürfen. Ein unlesbares Feld
    /// bekommt seinen Namen genannt — „ungültig" allein liesse raten, welches
    /// von sechs gemeint ist.
    /// </summary>
    private static bool TryBlobs(
        HttpContext ctx, out Task fail, params (string? Value, string Name)[] fields)
    {
        foreach (var (value, name) in fields)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                fail = Fail(ctx, StatusCodes.Status400BadRequest, $"Brakuje pola „{name}”.");
                return false;
            }

            try { Base64Url.Decode(value); }
            catch (FormatException)
            {
                fail = Fail(ctx, StatusCodes.Status400BadRequest, $"Nieczytelne pole „{name}”.");
                return false;
            }
        }

        fail = Task.CompletedTask;
        return true;
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
