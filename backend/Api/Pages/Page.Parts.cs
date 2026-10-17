using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Die Bausteine einer Seite setzen und lesen.</summary>
public static partial class Page
{
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
    /// (`pages/part.ts`, `pages/parts/`). Eine Prüfung hier wäre ein zweiter Katalog, der dem
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

        /* 0063 — die Bausteine der Stellen, die gehen (siehe unten, vor dem Abschluss). */
        var dropped = new List<Guid>();

        foreach (var going in here.Where(id => !ids.Contains(id)))
        {
            await using (var which = new SqlCommand(
                "SELECT module_id FROM app.slug_part WHERE id = @part;", connection, tx))
            {
                which.Parameters.AddWithValue("@part", going);
                if (await which.ExecuteScalarAsync(ctx.RequestAborted) is Guid module) dropped.Add(module);
            }

            /*
             * NUR DIE VERWENDUNG GEHT (0041). Fragen und Einsendungen gehoeren
             * dem BAUSTEIN; er bleibt in der Bausteinliste stehen, mit allem,
             * was daran haengt, und laesst sich auf eine andere Seite setzen.
             *
             * Hier stand frueher: Einsendungen da? Dann ablehnen. Keine? Dann
             * die Fragen mitloeschen. Das stammte aus der Zeit, in der Baustein
             * und Verwendung dieselbe Zeile waren — heute loeschte es die
             * Fragen eines Formulars, das weiter existiert, nur weil es von
             * EINER Seite genommen wurde. Wer den Baustein selbst loswerden
             * will, loescht ihn in der Bausteinliste; dort gilt die Regel mit
             * den Einsendungen weiter.
             */
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
                       SET kind = @kind, config = @config,
                           /* 0097 — wird er ein Formular, geht sein offener Name (der Name eines Formulars liegt nie offen). */
                           name = CASE WHEN kind <> N'form' AND @kind = N'form' THEN NULL ELSE name END
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
                   benennt ihn um, sobald sie ihn das erste Mal ansieht.
                   0097 — ein Formular bekommt keinen: sein Name liegt nie offen,
                   und der Dienst hat keinen Schlüssel, ihn zu versiegeln. Die
                   Liste nennt es nach seiner Seite, bis jemand es benennt. */
                var minted = $"{parts[i].Kind.Trim()} — {wanted}";
                mint.Parameters.AddWithValue("@name",
                    parts[i].Kind.Trim() == "form" ? DBNull.Value : minted.Length > 200 ? minted[..200] : minted);

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

        /*
         * 0063 — WAS NEBENBEI ENTSTAND UND NIRGENDS MEHR STEHT, GEHT MIT.
         *
         * Ein Baustein ohne Bereich steht nur in der Bausteinliste, solange er
         * auf einer Seite steht (`Module.ListAsync`: Bereich, den ich lese, oder
         * Adresse, die ich führe). Nimmt man ihn von seiner letzten Seite, sieht
         * ihn niemand mehr — und niemand kann ihn wieder hinsetzen oder löschen.
         * So sammelten sich „text — …", „seat-shared — …" an. Er geht deshalb
         * mit, sobald nichts mehr an ihm hängt: keine Stelle (auch keine eben
         * neu gesetzte), keine Fragen, keine Einsendungen, keine Schritte, keine
         * Gestaltung, keine Erweiterung. Wer einen Bereich hat, bleibt — den
         * sieht seine Gruppe in der Liste und entscheidet selbst.
         */
        foreach (var module in dropped.Distinct())
        {
            await using var orphan = new SqlCommand("""
                DELETE FROM app.module
                 WHERE id = @module AND area_id IS NULL
                   AND NOT EXISTS (SELECT 1 FROM app.slug_part p WHERE p.module_id = @module)
                   AND NOT EXISTS (SELECT 1 FROM app.slug_field f WHERE f.part_id = @module)
                   AND NOT EXISTS (SELECT 1 FROM app.registration g WHERE g.part_id = @module)
                   AND NOT EXISTS (SELECT 1 FROM app.form_step s WHERE s.module_id = @module)
                   AND NOT EXISTS (SELECT 1 FROM app.form_design d WHERE d.module_id = @module)
                   AND NOT EXISTS (SELECT 1 FROM app.module x WHERE x.extends_id = @module);
                """, connection, tx);
            orphan.Parameters.AddWithValue("@module", module);
            await orphan.ExecuteNonQueryAsync(ctx.RequestAborted);
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
}
