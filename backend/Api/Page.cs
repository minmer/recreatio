using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Was unter einer Adresse steht.
///
/// <para>
/// <b>Öffentlich im Wortsinn.</b> Das Anzeigen verlangt keine Sitzung, keinen
/// Keks und keinen Schlüssel — eine Seite, die man erst nach dem Anmelden
/// sieht, ist keine Seite, sondern eine Ansicht. Deshalb liegen Überschrift und
/// Vorspann im Klartext; sie zu versiegeln hiesse, sie genau dem
/// vorzuenthalten, für den sie geschrieben sind.
/// </para>
///
/// <para>
/// <b>Schreiben darf, wer die Adresse führt</b> — oder die nächsthöhere. Wer
/// <c>parish</c> hält, schreibt auch auf <c>parish/aktualnosci</c>; das ist
/// dieselbe Regel wie beim Übernehmen (<see cref="Slug"/>) und steht deshalb
/// auch an derselben Stelle.
/// </para>
/// </summary>
public static class Page
{
    public const int MaxTitle = 200;
    public const int MaxLead = 4000;

    public static void Map(WebApplication app)
    {
        // `{*path}` fängt auch die Teile nach dem Schrägstrich: `parish/proby`
        // ist EINE Adresse und nicht eine Adresse mit einem Anhängsel.
        app.MapGet("/page/{*path}", ShowAsync);

        /*
         * Welche Seite zeigt DIESE Domain? Gefragt vom Browser, sobald er
         * irgendwo anders als auf recreatio.pl geladen wurde. Öffentlich wie
         * die Seite selbst — ein Name ist kein Geheimnis.
         */
        app.MapGet("/site", SiteAsync);

        app.MapPut("/workspace/page/{*path}", SaveAsync);

        /*
         * Der Pfad reist im Rumpf und nicht in der Route: ein Fangmuster
         * (`{*path}`) muss am Ende stehen, und hinter dem Pfad stünde hier noch
         * etwas.
         */
        app.MapPut("/workspace/parts", SavePartsAsync);
    }

    public sealed record SaveRequest(string Title, string? Lead);

    /// <summary>Ein Baustein, wie ihn die Oberfläche schickt.</summary>
    /// <summary>
    /// <c>ModuleId</c> fehlt bei aelteren Aufrufern und beim Entwerfen im
    /// Raster — dann entsteht ein Baustein unter derselben Kennung (0036).
    /// Wer einen NENNT, stellt einen bestehenden hin: dieselben Daten an zwei
    /// Stellen.
    /// </summary>
    public sealed record PartInput(
        string Id, string Kind, string Layout, string? Config, string? ModuleId = null);

    public sealed record PartsRequest(string Path, IReadOnlyList<PartInput> Parts);

    /// <summary>So viele Bausteine trägt keine Seite — und wer es versucht, meint es nicht gut.</summary>
    public const int MaxParts = 60;
    public const int MaxLayout = 2000;
    public const int MaxConfig = 8000;

    /* -- Zeigen ------------------------------------------------------------- */

    private static async Task ShowAsync(HttpContext ctx, Db db, string? path, string? seat)
    {
        var wanted = Slug.Normalise(path);

        if (!Slug.IsWellFormed(wanted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Pod tym adresem nie ma strony.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await WritePageAsync(ctx, db, connection, wanted, seat);
    }

    /// <summary>
    /// Welche Seite ein eigener Name zeigt.
    ///
    /// <para>
    /// Der Browser fragt das, sobald er unter einem anderen Namen als
    /// recreatio.pl geladen wurde: er kennt seinen Ort, aber nicht, welche
    /// Adresse dort gemeint ist. Was er nennt, ist ungeprüft — und das macht
    /// nichts: ein Name ist ein Schlüssel zum Nachschlagen, kein Recht. Was
    /// dabei herauskommt, ist ohnehin öffentlich.
    /// </para>
    /// </summary>
    private static async Task SiteAsync(HttpContext ctx, Db db, string? host, string? path, string? seat)
    {
        var name = (host ?? string.Empty).Trim().ToLowerInvariant();

        // Der Browser nennt bei einem abweichenden Port „name:5173". Der Port
        // gehört nicht zum Namen.
        var colon = name.IndexOf(':');
        if (colon >= 0) name = name[..colon];

        if (!Slug.IsHostName(name))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Ta domena nie prowadzi do żadnej strony.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        string root;
        await using (var find = new SqlCommand(
            "SELECT path, alias_of FROM app.slug WHERE host = @host;", connection))
        {
            find.Parameters.AddWithValue("@host", name);

            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);

            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Ta domena nie prowadzi do żadnej strony.");
                return;
            }

            /*
             * Zeigt der Name auf einen Alias, ist die WURZEL sein Ziel: dort
             * liegt der Inhalt, und dort hängen die lokalen Routen. Ein Alias
             * hat keinen eigenen Unterbau.
             */
            root = reader.IsDBNull(1) ? reader.GetString(0) : reader.GetString(1);
        }

        /*
         * DIE UNTERROUTEN SIND LOKAL. Unter cogita.pl heisst `cogita/kursy`
         * schlicht `#/kursy`.
         *
         * Sonst müsste jeder Verweis auf der Seite wissen, unter welchem Namen
         * sie gerade ausgeliefert wird — derselbe Link wäre auf recreatio.pl
         * richtig und auf cogita.pl falsch, und eine Seite, die unter zwei Namen
         * steht, hätte zwei Sorten Links, von denen immer eine bricht.
         */
        var local = Slug.Normalise(path);

        if (local != Slug.Home && !Slug.IsWellFormed(local))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Pod tym adresem nie ma jeszcze strony.");
            return;
        }

        var wanted =
            local == Slug.Home ? root
            : root == Slug.Home ? local
            : $"{root}/{local}";

        if (wanted.Length > Slug.MaxPathLength)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Pod tym adresem nie ma jeszcze strony.");
            return;
        }

        await WritePageAsync(ctx, db, connection, wanted, seat);
    }

    /// <summary>
    /// Die Seite einer Adresse hinausschreiben — die eine Stelle, die das tut.
    ///
    /// <para>
    /// Sie wird von zwei Seiten gerufen: vom Pfad her und vom Namen her. Zwei
    /// Fassungen hiessen zwei Meinungen darüber, wann ein Alias gilt und was
    /// „noch nichts veröffentlicht" bedeutet.
    /// </para>
    /// </summary>
    /// <summary>
    /// Darf dieser Aufrufer eine INTERNE Adresse sehen? Drei Wege, und kein vierter.
    ///
    /// <code>
    ///   ein PLATZ            der Link, ohne Konto — `app.access_slug`
    ///   die Rolle halten     ueber das Konto, im Rollengraphen erreichbar
    ///   schreiben duerfen    das Amt, das die Adresse fuehrt
    /// </code>
    ///
    /// <para>
    /// Der erste steht zuerst, weil er der haeufigste ist: ein Vierzehnjaehriger
    /// hat kein Konto, und eine Rollenpruefung allein sperrte genau den aus,
    /// fuer den die Seite gemacht wurde.
    /// </para>
    /// </summary>
    private static async Task<bool> MaySeeAsync(
        HttpContext ctx, Db db, SqlConnection connection,
        Guid internalFor, Guid slugId, Guid askedId, string path, string? seat)
    {
        if (!string.IsNullOrWhiteSpace(seat))
        {
            await using var cmd = new SqlCommand("""
                SELECT TOP 1 1
                FROM app.access a
                JOIN app.access_slug g ON g.access_id = a.id
                WHERE a.token_sha256 = @token
                  AND a.revoked_at IS NULL AND a.status = N'active'
                  AND (a.expires_at IS NULL OR a.expires_at > @now)
                  AND g.slug_id IN (@slug, @asked);
                """, connection);

            cmd.Parameters.AddWithValue("@token",
                System.Security.Cryptography.SHA256.HashData(
                    System.Text.Encoding.UTF8.GetBytes(seat.Trim())));
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@slug", slugId);
            cmd.Parameters.AddWithValue("@asked", askedId);

            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not null) return true;
        }

        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) return false;

        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (mine.Any(r => r.Id == internalFor)) return true;

        var grip = await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);
        return grip.MayWrite;
    }

    private static async Task WritePageAsync(
        HttpContext ctx, Db db, SqlConnection connection, string wanted, string? seat = null)
    {
        Guid slugId, askedId;
        Guid? internalFor;
        string? title = null, lead = null, aliasOf = null;
        DateTimeOffset? updatedAt = null;

        /*
         * EIN ALIAS ZEIGT AUF EINE ANDERE ADRESSE, und von dort kommt alles:
         * Titel, Vorspann, Bausteine. Deshalb wird hier gleich mitgesprungen —
         * zwei Abfragen hintereinander hiessen zwei Runden, und die zweite
         * käme für einen Besucher sichtbar später.
         *
         * Übernommen sein muss das ZIEL: dort liegt der Inhalt. Ob der Alias
         * selbst schon jemandem gehört, entscheidet, wer ihn verwaltet — nicht,
         * ob die Seite zu sehen ist.
         */
        await using (var cmd = new SqlCommand("""
            SELECT COALESCE(t.id, s.id),
                   COALESCE(t.claimed_by_role_id, s.claimed_by_role_id),
                   p.title, p.lead, p.updated_at, s.alias_of,
                   COALESCE(t.internal_for_role_id, s.internal_for_role_id),
                   s.id
            FROM app.slug s
            LEFT JOIN app.slug t ON s.alias_of IS NOT NULL AND t.path = s.alias_of
            LEFT JOIN app.slug_page p ON p.slug_id = COALESCE(t.id, s.id)
            WHERE s.path = @path;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@path", wanted);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);

            if (!await reader.ReadAsync(ctx.RequestAborted) || reader.IsDBNull(1))
            {
                /*
                 * Eine Adresse, die niemand führt, ist keine Seite — und eine,
                 * die gar nicht im Register steht, auch nicht. Dieselbe Antwort
                 * für beides: der Unterschied verriete, welche Adressen noch zu
                 * haben sind, bevor sie jemand hat.
                 */
                await Fail(ctx, StatusCodes.Status404NotFound, "Pod tym adresem nie ma jeszcze strony.");
                return;
            }

            slugId = reader.GetGuid(0);
            title = reader.IsDBNull(2) ? null : reader.GetString(2);
            lead = reader.IsDBNull(3) ? null : reader.GetString(3);
            updatedAt = reader.IsDBNull(4) ? null : reader.GetDateTimeOffset(4);
            aliasOf = reader.IsDBNull(5) ? null : reader.GetString(5);
            internalFor = reader.IsDBNull(6) ? null : reader.GetGuid(6);
            askedId = reader.GetGuid(7);
        }

        /*
         * EINE INTERNE ADRESSE GEHOERT EINER ROLLE (0026).
         *
         * Wer nicht hineindarf, bekommt dieselbe Antwort wie fuer eine Adresse,
         * die es nicht gibt. Ein 403 verriete, dass unter `lo13/anna` jemand
         * gefuehrt wird — und das ist bereits eine Auskunft ueber Anna.
         */
        if (internalFor is not null
            && !await MaySeeAsync(ctx, db, connection, internalFor.Value, slugId, askedId, wanted, seat))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Pod tym adresem nie ma jeszcze strony.");
            return;
        }

        /*
         * Die Bausteine gehen MIT der Seite hinaus, nicht auf einen zweiten
         * Ruf. Ein Besucher, der erst die Seite und dann ihren Inhalt holt,
         * sieht dazwischen eine leere Seite — und wer sie in dem Augenblick
         * wegklickt, kommt nicht wieder.
         */
        var parts = await PartsOfAsync(connection, slugId, ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { path = wanted, aliasOf, title, lead, updatedAt, parts });
    }

    /* -- Schreiben ---------------------------------------------------------- */

    private static async Task SaveAsync(HttpContext ctx, Db db, string path, SaveRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var wanted = Slug.Normalise(path);
        if (!Slug.IsWellFormed(wanted))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest adres.");
            return;
        }

        var title = (body.Title ?? string.Empty).Trim();
        if (title.Length is 0 or > MaxTitle)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Tytuł: od 1 do {MaxTitle} znaków.");
            return;
        }

        var lead = string.IsNullOrWhiteSpace(body.Lead) ? null : body.Lead.Trim();
        if (lead is not null && lead.Length > MaxLead)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Tekst: najwyżej {MaxLead} znaków.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * DIE REIHENFOLGE: erst gibt es die Adresse, dann KANN sie überhaupt
         * Inhalt tragen, dann DARF dieser Mensch.
         *
         * Ein Alias kann nie Inhalt tragen — ob ihn jemand übernommen hat oder
         * nicht, ändert daran nichts. Fragte man zuerst nach dem Recht, bekäme
         * man bei einem unübernommenen Alias „das hat noch niemand übernommen"
         * zu hören: wahr, aber die falsche Auskunft. Wer das liest, holt sich
         * einen Code für eine Adresse, die auch dann nichts annimmt.
         */
        var row = await RowAsync(connection, wanted, ctx.RequestAborted);

        if (row is null)
        {
            // Ein Unterpfad, den niemand geöffnet hat, ist keine Adresse — auch
            // nicht für den, der die Adresse darüber führt.
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
            return;
        }

        if (row.Value.AliasOf is not null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                $"Ten adres jest tylko innym wejściem do „{row.Value.AliasOf}” — treść zmienia się tam.");
            return;
        }

        /*
         * Wer darf hier schreiben? Zwei Wege, und beide beantwortet
         * <see cref="Access"/>: eine meiner Rollen FÜHRT die Adresse (oder die
         * nächsthöhere), oder eine meiner Rollen hält ein Zertifikat darauf.
         */
        var grip = await Access.OfAsync(connection, who.Value.AccountId, wanted, ctx.RequestAborted);

        if (grip.OwnerRoleId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nikt jeszcze nie przejął.");
            return;
        }

        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Tego adresu nie prowadzi żadna z Twoich ról i nie masz do niego prawa zapisu.");
            return;
        }

        var slugId = row.Value.Id;

        var now = DateTimeOffset.UtcNow;

        await using var save = new SqlCommand("""
            UPDATE app.slug_page
            SET title = @title, lead = @lead, updated_at = @now, updated_by_role_id = @role
            WHERE slug_id = @id;

            IF @@ROWCOUNT = 0
            INSERT INTO app.slug_page (slug_id, title, lead, updated_at, updated_by_role_id)
            VALUES (@id, @title, @lead, @now, @role);
            """, connection);

        save.Parameters.AddWithValue("@id", slugId);
        save.Parameters.AddWithValue("@title", title);
        save.Parameters.AddWithValue("@lead", (object?)lead ?? DBNull.Value);
        save.Parameters.AddWithValue("@now", now);
        // Die Rolle, ÜBER DIE es galt — nicht die des Führenden. Wer über ein
        // Zertifikat schreibt, soll auch als der dastehen, der er war.
        save.Parameters.AddWithValue("@role", (object?)grip.ViaRoleId ?? grip.OwnerRoleId!.Value);

        await save.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { path = wanted, title, lead, updatedAt = now });
    }

    /* -- Die Bausteine setzen ----------------------------------------------- */

    /// <summary>
    /// Die ganze Anordnung auf einmal — löschen und neu schreiben, in EINER
    /// Transaktion.
    ///
    /// <para>
    /// <b>Warum nicht je Baustein ein Aufruf.</b> Wer im Editor zieht, schiebt
    /// und löscht, ändert nicht einen Baustein, sondern eine Anordnung: die
    /// Reihenfolge, die Rechtecke und der Bestand hängen zusammen. Fünf einzelne
    /// Aufrufe könnten zur Hälfte ankommen, und dann stünde eine Seite da, die
    /// so nie jemand gebaut hat.
    /// </para>
    ///
    /// <para>
    /// <b>Der Dienst liest den Inhalt nicht.</b> `layout` und `config` sind für
    /// ihn Zeichenketten mit einer Obergrenze. Was darin steht, versteht der
    /// Baustein — und die Anzeige ist duldsam gegenüber allem, was nicht passt
    /// (`modules.ts`). Eine Prüfung hier wäre ein zweiter Katalog, der dem
    /// ersten hinterherhinkt.
    /// </para>
    /// </summary>
    private static async Task SavePartsAsync(HttpContext ctx, Db db, PartsRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var wanted = Slug.Normalise(body.Path);
        if (!Slug.IsWellFormed(wanted))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "To nie jest adres.");
            return;
        }

        var parts = body.Parts ?? [];
        if (parts.Count > MaxParts)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Najwyżej {MaxParts} modułów na stronie.");
            return;
        }

        var ids = new HashSet<Guid>();

        foreach (var part in parts)
        {
            if (!Guid.TryParse(part.Id, out var id) || !ids.Add(id))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Moduły muszą mieć różne kennungi.");
                return;
            }

            var kind = (part.Kind ?? string.Empty).Trim();
            if (kind.Length is 0 or > 40)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj modułu: od 1 do 40 znaków.");
                return;
            }

            if (string.IsNullOrWhiteSpace(part.Layout) || part.Layout.Length > MaxLayout)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Układ modułu jest pusty albo za długi.");
                return;
            }

            if (part.Config is not null && part.Config.Length > MaxConfig)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Treść modułu: najwyżej {MaxConfig} znaków.");
                return;
            }
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        // Dieselbe Reihenfolge wie beim Text: erst die Zeile, dann ob sie Inhalt
        // tragen KANN, dann ob dieser Mensch DARF.
        var row = await RowAsync(connection, wanted, ctx.RequestAborted);

        if (row is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
            return;
        }

        if (row.Value.AliasOf is not null)
        {
            await Fail(ctx, StatusCodes.Status409Conflict,
                $"Ten adres jest tylko innym wejściem do „{row.Value.AliasOf}” — moduły zmieniają się tam.");
            return;
        }

        var grip = await Access.OfAsync(connection, who.Value.AccountId, wanted, ctx.RequestAborted);

        if (grip.OwnerRoleId is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nikt jeszcze nie przejął.");
            return;
        }

        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Tego adresu nie prowadzi żadna z Twoich ról i nie masz do niego prawa zapisu.");
            return;
        }

        var slugId = row.Value.Id;

        var now = DateTimeOffset.UtcNow;
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        /*
         * NICHT MEHR ALLES WEGWERFEN UND NEU SCHREIBEN.
         *
         * <b>Ein Baustein ist eine Kennung, an der etwas hängt.</b> Auf
         * `app.slug_part` zeigen zwei Fremdschlüssel: die FRAGEN eines
         * Formulars (`slug_field.part_id`) und die EINSENDUNGEN darauf
         * (`registration.part_id`). Ein `DELETE` über alle Zeilen der Seite —
         * so stand es hier — liess sich deshalb nicht mehr ausführen, sobald
         * ein Formular auch nur eine Frage trug: die Datenbank lehnte ab, und
         * heraus kam ein 500. Die Seite war damit gar nicht mehr zu speichern,
         * nicht bloss das Formular nicht mehr zu entfernen.
         *
         * Also der ehrliche Abgleich: was bleibt, wird geändert; was neu ist,
         * kommt hinzu; was geht, geht — und was NICHT gehen kann, sagt warum.
         */
        try
        {

        var here = new List<Guid>();

        await using (var known = new SqlCommand(
            "SELECT id FROM app.slug_part WHERE slug_id = @slug;", connection, tx))
        {
            known.Parameters.AddWithValue("@slug", slugId);

            await using var reader = await known.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) here.Add(reader.GetGuid(0));
        }

        foreach (var going in here.Where(id => !ids.Contains(id)))
        {
            /*
             * EINE EINSENDUNG IST KEIN ENTWURF. Wer ein Formular wegnimmt, auf
             * das sich Menschen eingetragen haben, nähme ihnen auch das, was
             * sie eingesandt haben — und der Dienst könnte es nicht einmal
             * wieder herausgeben, weil er es nicht lesen kann. Das geht nur,
             * wenn es ausdrücklich verlangt wird, und dafür gibt es hier keinen
             * Weg.
             */
            await using (var count = new SqlCommand(
                "SELECT COUNT(*) FROM app.registration WHERE part_id = @part;", connection, tx))
            {
                count.Parameters.AddWithValue("@part", going);

                if ((int)(await count.ExecuteScalarAsync(ctx.RequestAborted) ?? 0) > 0)
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await Fail(ctx, StatusCodes.Status409Conflict,
                        "Na tym formularzu są już zgłoszenia — nie da się go usunąć razem ze stroną. "
                        + "Zostaw blok albo najpierw zajmij się zgłoszeniami.");
                    return;
                }
            }

            /* Fragen ohne Einsendungen gehen mit — sie hängen an diesem Baustein. */
            await using (var fields = new SqlCommand(
                "DELETE FROM app.slug_field WHERE part_id = @part;", connection, tx))
            {
                fields.Parameters.AddWithValue("@part", going);
                await fields.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using (var drop = new SqlCommand(
                "DELETE FROM app.slug_part WHERE id = @part;", connection, tx))
            {
                drop.Parameters.AddWithValue("@part", going);
                await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            }
        }

        var staying = here.ToHashSet();

        for (var i = 0; i < parts.Count; i++)
        {
            var id = Guid.Parse(parts[i].Id);

            /*
             * JEDE VERWENDUNG HAT EINEN BAUSTEIN (0036).
             *
             * Nennt der Aufrufer einen, wird dieser gezeigt — so haengt derselbe
             * Bogen auf zwei Seiten und traegt EINEN Satz Antworten.
             *
             * Nennt er keinen, entsteht einer, und zwar unter DERSELBEN
             * Kennung wie die Verwendung. Das ist die Regel, die frueher einmal
             * aufgeschrieben wurde: was ein einfacher Weg nebenbei anlegt, muss
             * danach ein richtiges, benanntes Ding sein, das auch in der
             * Bausteinliste steht — kein stiller Sonderfall, der sich nirgends
             * wiederfindet.
             *
             * Den Bereich kann er dabei nicht kennen; den setzt man beim
             * Baustein. `NULL` ist deshalb die richtige Antwort und keine
             * Luecke.
             */
            var moduleId = string.IsNullOrWhiteSpace(parts[i].ModuleId)
                ? id
                : Guid.Parse(parts[i].ModuleId!);

            await using (var mint = new SqlCommand("""
                IF NOT EXISTS (SELECT 1 FROM app.module WHERE id = @module)
                BEGIN
                    INSERT INTO app.module (id, area_id, kind, name, config, created_at)
                    VALUES (@module, NULL, @kind, @name, @config, @now);
                END
                ELSE IF @mine = 1
                BEGIN
                    /* Ein Baustein, der nur HIER steht, folgt dem Entwurf. Einer,
                       der auch woanders steht, tut es nicht: sonst aenderte das
                       Speichern einer Seite stillschweigend eine andere. */
                    UPDATE app.module
                       SET kind = @kind, config = @config
                     WHERE id = @module
                       AND (SELECT COUNT(*) FROM app.slug_part p
                             WHERE p.module_id = @module AND p.id <> @id) = 0;
                END
                """, connection, tx))
            {
                mint.Parameters.AddWithValue("@module", moduleId);
                mint.Parameters.AddWithValue("@id", id);
                mint.Parameters.AddWithValue("@kind", parts[i].Kind.Trim());
                mint.Parameters.AddWithValue("@config", (object?)parts[i].Config ?? DBNull.Value);
                mint.Parameters.AddWithValue("@now", now);
                mint.Parameters.AddWithValue("@mine", moduleId == id ? 1 : 0);

                /* Ein Name, unter dem er wiederzufinden ist. Die Kanzlei
                   benennt ihn um, sobald sie ihn das erste Mal ansieht. */
                mint.Parameters.AddWithValue("@name",
                    $"{parts[i].Kind.Trim()} — {wanted}".Length > 200
                        ? $"{parts[i].Kind.Trim()} — {wanted}"[..200]
                        : $"{parts[i].Kind.Trim()} — {wanted}");

                await mint.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using var save = staying.Contains(id)
                ? new SqlCommand("""
                    UPDATE app.slug_part
                       SET kind = @kind, position = @position, layout = @layout,
                           config = @config, module_id = @module
                     WHERE id = @id;
                    """, connection, tx)
                : new SqlCommand("""
                    INSERT INTO app.slug_part
                        (id, slug_id, kind, position, layout, config, created_at, module_id)
                    VALUES (@id, @slug, @kind, @position, @layout, @config, @now, @module);
                    """, connection, tx);

            save.Parameters.AddWithValue("@id", id);
            save.Parameters.AddWithValue("@module", moduleId);
            save.Parameters.AddWithValue("@kind", parts[i].Kind.Trim());
            save.Parameters.AddWithValue("@position", i);
            save.Parameters.AddWithValue("@layout", parts[i].Layout);
            save.Parameters.AddWithValue("@config", (object?)parts[i].Config ?? DBNull.Value);

            if (!staying.Contains(id))
            {
                save.Parameters.AddWithValue("@slug", slugId);
                save.Parameters.AddWithValue("@now", now);
            }

            await save.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { path = wanted, parts = parts.Count });

        }
        catch (SqlException e) when (e.Number is 547 or 2601 or 2627)
        {
            /*
             * Ein 500 auf einem PUT ist doppelt schlecht: der Browser sieht dann
             * nicht einmal den Grund, weil eine Fehlerantwort keine
             * CORS-Kopfzeile mehr traegt — es sieht nach „blockiert" aus und ist
             * ein Verstoss gegen eine Bedingung. Also wird er hier benannt.
             */
            await tx.RollbackAsync(ctx.RequestAborted);

            await Fail(ctx, StatusCodes.Status409Conflict, e.Number == 547
                ? "Do któregoś z tych bloków coś jeszcze należy — nie da się go teraz usunąć."
                : "Taki blok już gdzieś stoi. Odśwież stronę i spróbuj jeszcze raz.");
        }
    }

    /// <summary>
    /// Die Bausteine einer Adresse, in ihrer Reihenfolge.
    ///
    /// <para>
    /// <b>Oeffentlich zugaenglich, weil das Portal sie auch braucht.</b> Ein
    /// Platz bekommt seine Vorlage ueber <c>GET /seat/{token}</c> (0028) — er
    /// hat keine Adresse zum Tippen und darf trotzdem dieselben Bausteine
    /// sehen. Sie dort noch einmal abzufragen hiesse, zwei Abfragen zu haben,
    /// die sich einig sein muessen.
    /// </para>
    /// </summary>
    public static async Task<List<object>> PartsOfAsync(
        SqlConnection connection, Guid slugId, CancellationToken ct)
    {
        var parts = new List<object>();

        await using var cmd = new SqlCommand("""
            SELECT p.id, COALESCE(m.kind, p.kind) AS kind, p.layout,
                   COALESCE(m.config, p.config) AS config, p.module_id
            FROM app.slug_part p
            /*
                DER BAUSTEIN GEWINNT (0036). Steht derselbe auf zwei Seiten,
                zeigen beide dasselbe — sonst waere „DERSELBE“ nur ein Wort.
                `slug_part.kind`/`config` stehen noch als Rest da und gelten
                nur, wo ein Baustein (noch) fehlt.
            */
            LEFT JOIN app.module m ON m.id = p.module_id
            WHERE p.slug_id = @slug
            ORDER BY p.position;
            """, connection);

        cmd.Parameters.AddWithValue("@slug", slugId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            parts.Add(new
            {
                id = Ids.ToText(reader.GetGuid(0)),
                kind = reader.GetString(1),
                layout = reader.GetString(2),
                config = reader.IsDBNull(3) ? null : reader.GetString(3),

                /* Welcher Baustein hier gezeigt wird — die Seite zeigt ihn nur. */
                moduleId = reader.IsDBNull(4) ? null : Ids.ToText(reader.GetGuid(4))
            });
        }

        return parts;
    }

    /// <summary>
    /// Die Zeile des Registers — mit der Frage, ob sie nur ein zweiter Weg ist.
    ///
    /// <para>
    /// Geschrieben wird NIE auf einen Alias. Läge unter ihm eine zweite Seite,
    /// gäbe es zwei Fassungen derselben Sache, und eine davon wäre immer die
    /// veraltete.
    /// </para>
    /// </summary>
    private static async Task<(Guid Id, string? AliasOf)?> RowAsync(
        SqlConnection connection, string path, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT id, alias_of FROM app.slug WHERE path = @path;", connection);
        cmd.Parameters.AddWithValue("@path", path);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return (reader.GetGuid(0), reader.IsDBNull(1) ? null : reader.GetString(1));
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
