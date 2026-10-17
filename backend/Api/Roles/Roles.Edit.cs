using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Rollen anlegen, weitergeben, abnehmen, benennen, umtypen und zurücknehmen.</summary>
public static partial class Roles
{
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
        if (kind is not ("role" or "group" or "person"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj: rola, grupa albo osoba.");
            return;
        }

        /*
         * `person` WAR hier verboten, mit der Begruendung, es gaebe sonst
         * persoenliche Rollen ohne ableitbaren Schluessel — dieselbe Bezeichnung
         * fuer zwei verschiedene Dinge.
         *
         * Die Begruendung traf die falsche Spalte. „Die persoenliche Rolle
         * DIESES Kontos" steht nicht in `kind`, sondern in
         * `app.account.person_role_id`; genau daraus rechnet `ListAsync` das
         * `isPersonal` aus, und nur dort wird der Schluessel aus dem
         * Hauptschluessel abgeleitet (`RoleKeys.PersonalRoleKey`).
         *
         * `kind = 'person'` heisst also schlicht: DIESE ROLLE IST EIN MENSCH —
         * eine Pfarrerin, ein Kuester, ein Mitglied. Ihr Schluessel entsteht wie
         * bei jeder anderen angelegten Rolle im Browser und wird dem Halter
         * verpackt. Das ist kein zweites Ding mit demselben Namen, sondern das,
         * was der Name immer schon sagte; die Oberflaeche nennt sie seit jeher
         * „Osoba".
         *
         * Was bleibt: die Rolle, auf die das Konto zeigt, ist unverwechselbar,
         * und sie ist es ueber den Zeiger — nicht ueber das Wort.
         */

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
        var reachable = RoleGraph.Reachable(person.Value, Held(edges));

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

        /*
         * DAS KONTO HAELT NUR PERSONEN (0040). Ein Amt direkt am Konto hiesse:
         * es gehoert niemandem Bestimmten, und wer es einem Nachfolger
         * uebergibt, muesste das Konto mitgeben.
         */
        if (holderId == person.Value && kind != "person")
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Konto prowadzi tylko osoby. Rolę albo grupę załóż pod osobą.");
            return;
        }

        /* Eine neue Rolle wird GEFUEHRT — alles andere waere eine Rolle, die
           niemand oeffnen kann. */
        if (!VerifyEdge(holder.SignPublic, edgeId, holderId, roleId, holderId, createdAt,
                Base64Url.Decode(body.Edge.Signature), HoldsEdge))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis krawędzi się nie zgadza.");
            return;
        }

        await InsertRoleAsync(connection, tx, roleId, kind, body, ctx.RequestAborted);
        await InsertEdgeAsync(connection, tx, edgeId, holderId, roleId, holderId, createdAt,
            Base64Url.Decode(body.Edge.Signature), HoldsEdge, ctx.RequestAborted);
        await InsertGrantAsync(connection, tx, holderId, roleId, Base64Url.Decode(body.GrantSealedBlob),
            holderId, ctx.RequestAborted);

        /*
         * DER SIGNIERSCHLUESSEL, wenn die Rolle in getrennter Form entsteht
         * (0034). Wer sie anlegt, FUEHRT sie — er bekommt beides.
         */
        if (body.SignGrantSealedBlob is not null)
        {
            await InsertGrantAsync(connection, tx, holderId, roleId,
                Base64Url.Decode(body.SignGrantSealedBlob), holderId, ctx.RequestAborted, "role_sign");
        }

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

        /*
         * DIE ART DER KANTE (0032). Fehlt sie, ist es `holds` — so hiess es,
         * bevor es eine Wahl gab, und wer nichts schickt, hat auch nichts
         * anderes unterschrieben.
         */
        var edgeKind = body.EdgeKind ?? HoldsEdge;

        if (!IsEdgeKind(edgeKind))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Rodzaj powiązania: holds, write albo read.");
            return;
        }

        /*
         * STILLSCHWEIGEND ZU VERWERFEN WAERE SCHLIMMER als abzulehnen: der
         * Aufrufer glaubte dann, er habe jemandem das Unterschreiben gegeben,
         * und niemand saehe, dass es nicht geschah.
         */
        if (body.SignGrantSealedBlob is not null && edgeKind != HoldsEdge)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Klucz podpisu należy tylko do prowadzenia roli — nie do odczytu ani zapisu.");
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
        var links = Held(edges);
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

        /*
         * DAS KONTO (0040): niemand haelt es, und es haelt nur Personen — und
         * die ganz. Eine Lesekante vom Konto auf eine Person waere eine Person,
         * die zum Konto gehoert und doch nicht von ihm gefuehrt wird.
         */
        var target = roles.First(r => r.Id == id);

        if (id == person.Value || target.Kind == "account")
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Konta nikt nie trzyma — to ono jest na górze.");
            return;
        }

        if (holderId == person.Value && (target.Kind != "person" || edgeKind != HoldsEdge))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Konto prowadzi tylko osoby. Rolę albo grupę przekaż osobie.");
            return;
        }

        /*
         * DIESELBE ART ZWEIMAL ist dieselbe Zusage doppelt — und bleibt
         * abgelehnt. VERSCHIEDENE Arten nebeneinander sind dagegen sinnvoll:
         * wer eine Rolle fuehrt, kann daneben eine Schreibkante von woanders
         * haben, und welche zaehlt, entscheidet die Aufloesung.
         *
         * Vor 0032 gab es nur eine Art, und da war „dieselbe Paarung" und
         * „dieselbe Zusage" dasselbe. Jetzt nicht mehr.
         */
        if (edges.Any(e => e.From == holderId && e.To == id && e.Kind == edgeKind))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Ta rola już to trzyma na tym stopniu.");
            return;
        }

        if (RoleGraph.WouldCreateCycle(holderId, id, links))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict,
                "To zamknęłoby krąg: obie role otwierałyby się nawzajem.");
            return;
        }

        if (!VerifyEdge(holder.SignPublic, edgeId, holderId, id, holderId, createdAt,
                Base64Url.Decode(body.Edge.Signature), edgeKind))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status400BadRequest, "Podpis krawędzi się nie zgadza.");
            return;
        }

        await InsertEdgeAsync(connection, tx, edgeId, holderId, id, holderId, createdAt,
            Base64Url.Decode(body.Edge.Signature), edgeKind, ctx.RequestAborted);
        await InsertGrantAsync(connection, tx, holderId, id, Base64Url.Decode(body.GrantSealedBlob),
            holderId, ctx.RequestAborted);

        /*
         * NUR WER FUEHRT, DARF UNTERSCHREIBEN (0034).
         *
         * Das ist die Stelle, an der die drei Stufen aufhoeren, blosse
         * Etiketten zu sein: ein Leser bekommt den Signierschluessel nicht,
         * und ohne ihn kann er keine Kante und kein Zertifikat herstellen, das
         * der Dienst annimmt. Schreiben kann er trotzdem — aber nicht so, dass
         * es wie eine befugte Zusage aussieht.
         */
        if (body.SignGrantSealedBlob is not null && edgeKind == HoldsEdge)
        {
            await InsertGrantAsync(connection, tx, holderId, id,
                Base64Url.Decode(body.SignGrantSealedBlob), holderId, ctx.RequestAborted, "role_sign");
        }

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
    private static async Task DropHolderAsync(
        HttpContext ctx, Db db, Guid id, Guid holderId, string? kind)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (kind is not null && !IsEdgeKind(kind))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Rodzaj powiązania: holds, write albo read.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var person = await PersonRoleAsync(connection, null, who.Value.AccountId, ctx.RequestAborted);
        if (person is null) { await Fail(ctx, StatusCodes.Status403Forbidden, "Nie masz jeszcze roli osobistej."); return; }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        var (_, edges) = await GraphAsync(connection, tx, ctx.RequestAborted);
        var reachable = RoleGraph.Reachable(person.Value, Held(edges));

        if (!reachable.Contains(id) || !reachable.Contains(holderId))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status403Forbidden, "Ta rola nie jest Twoja.");
            return;
        }

        /*
         * NUR DIE FUEHRENDEN ZAEHLEN (0032). Wer eine Rolle bloss liest, haelt
         * sie nicht — zaehlte er mit, liesse sich der letzte echte Halter
         * entfernen, solange irgendwo eine Lesekante steht, und danach koennte
         * niemand die Rolle mehr oeffnen.
         */
        /*
         * … UND NUR, WENN HIER WIRKLICH EIN HALTER WEGGEHT. Eine Lesekante zu
         * loesen nimmt niemandem den Schluessel; die Wache davor waere dann
         * eine Absage auf eine Gefahr, die es nicht gibt.
         */
        if ((kind is null || kind == HoldsEdge)
            && edges.Count(e => e.To == id && e.Kind == HoldsEdge) <= 1
            && edges.Any(e => e.From == holderId && e.To == id && e.Kind == HoldsEdge))
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict,
                "To ostatni, kto trzyma tę rolę — bez niego nikt jej już nie otworzy. Usuń rolę zamiast tego.");
            return;
        }

        /*
         * EINE ART LOESEN ODER ALLE.
         *
         * Ohne `kind` faellt jede Verbindung zwischen den beiden — das ist, was
         * „diesen Halter entfernen" immer hiess, und es bleibt die Vorgabe.
         * Mit `kind` faellt genau ein Punkt aus dem Graphen; die uebrigen
         * bleiben stehen, denn sie sind eigene Zusagen.
         *
         * DER SCHLUESSEL GEHT NUR MIT DER FUEHRENDEN KANTE. Wer eine Lesekante
         * loest, nimmt damit keine Zuteilung zurueck — die haengt am Fuehren.
         */
        var dropsHolding = kind is null || kind == HoldsEdge;

        await using (var cmd = new SqlCommand($"""
            UPDATE app.role_edge SET revoked_at = @now
            WHERE from_role_id = @from AND to_role_id = @to AND revoked_at IS NULL
              {(kind is null ? "" : "AND edge_kind = @kind")};

            {(dropsHolding ? """
            UPDATE app.key_grant SET destroyed_at = @now
            WHERE role_id = @from AND key_kind IN (N'role', N'role_sign')
              AND key_ref = @to AND destroyed_at IS NULL;
            """ : "")}
            """, connection, tx))
        {
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@from", holderId);
            cmd.Parameters.AddWithValue("@to", id);
            if (kind is not null) cmd.Parameters.AddWithValue("@kind", kind);
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
        if (kind is not ("role" or "group"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj: rola albo grupa.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await MayTouchAsync(ctx, db, connection, id)) return;

        await using var cmd = new SqlCommand(
            "UPDATE app.role SET kind = @kind WHERE id = @id AND kind IN (N'role', N'group') AND revoked_at IS NULL;",
            connection);

        cmd.Parameters.AddWithValue("@kind", kind);
        cmd.Parameters.AddWithValue("@id", id);

        if (await cmd.ExecuteNonQueryAsync(ctx.RequestAborted) == 0)
        {
            // Gilt fuer JEDE Person und fuer das Konto: aus einem Menschen wird
            // keine Gruppe, und aus dem Schluesselbund kein Amt.
            await Fail(ctx, StatusCodes.Status409Conflict, "Osoby ani konta nie da się przetypować.");
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
                "To konto — na nim wiszą wszystkie Twoje osoby.");
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
}
