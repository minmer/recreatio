using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>Die Tafel eines Formulars und das Umpacken der Schlüssel unter die Amtsrolle (0037).</summary>
public static partial class Form
{
    public sealed record ConfigRequest(Dictionary<string, string> Set);

    public sealed record RewrapValue(string RegistrationId, string FieldId, string OfficeKeySealed);

    public sealed record RewrapSeat(string SeatId, string SeatKeyForOffice);

    public sealed record RewrapRequest(
        IReadOnlyList<RewrapValue>? Values, IReadOnlyList<RewrapSeat>? Seats);

    /// <summary>
    /// Den RSA-Umschlag durch eine symmetrische Huelle ersetzen (0037).
    ///
    /// <para>
    /// <b>Wer das tut, hat den Schluessel gerade offen.</b> Das Amt macht eine
    /// Einsendung auf — dafuer packt es den privaten Annahmeschluessel aus und
    /// damit jeden Wertschluessel. In diesem Augenblick kann es denselben
    /// Schluessel unter dem Schluessel SEINER ROLLE neu versiegeln. Der Dienst
    /// bekommt die fertige Huelle und sieht wie immer nichts davon.
    /// </para>
    ///
    /// <para>
    /// <b>Und der alte faellt im selben Zug.</b> Beide nebeneinander stehen zu
    /// lassen brachte gar nichts: angreifbar ist, was dasteht. Deshalb setzt
    /// dieselbe Anweisung den einen und loescht den anderen — dazwischen gibt
    /// es keinen Zustand, in dem beide gelten.
    /// </para>
    ///
    /// <para>
    /// <b>Die Pruefbedingung der Tabelle ist die Sicherung.</b> Kaeme eine
    /// leere Huelle herein, schluege <c>ck_registration_value_office</c> an und
    /// die Zeile bliebe, wie sie war. Ein Wert ohne jeden Weg hinein kann so
    /// nicht entstehen — auch nicht durch einen Fehler hier.
    /// </para>
    /// </summary>
    private static async Task RewrapAsync(HttpContext ctx, Db db, Guid id, RewrapRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        /*
         * DASSELBE RECHT WIE ZUM LESEN der Einsendungen — mehr braucht es
         * nicht, und weniger waere zu wenig: wer die Werte oeffnen darf, darf
         * auch die Huelle um ihren Schluessel austauschen. Am Inhalt aendert
         * sich dabei nichts.
         *
         * `MayTendAsync` taugt hier NICHT: es fragt nach einer EINSENDUNG,
         * und hier steht ein Baustein.
         */
        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return;
        }

        id = sheet.ModuleId;

        var mayWrite = await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted);

        if (!mayWrite)
        {
            var fields = await ReadFieldsAsync(connection, id, ctx.RequestAborted, withRemoved: true);
            var any = false;

            foreach (var areaId in fields.Select(f => f.AreaId).Distinct())
            {
                if (await Area.MayAsync(connection, who.Value.AccountId, areaId,
                        Capability.Read, ctx.RequestAborted))
                {
                    any = true;
                    break;
                }
            }

            if (!any)
            {
                await Fail(ctx, StatusCodes.Status403Forbidden,
                    "Ani tego adresu nie prowadzisz, ani nie czytasz obszaru tego formularza.");
                return;
            }
        }

        var values = body.Values ?? [];
        var seats = body.Seats ?? [];

        if (values.Count == 0 && seats.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie podano nic do przepieczętowania.");
            return;
        }

        var done = 0;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            foreach (var one in values)
            {
                if (!Guid.TryParse(one.RegistrationId, out var registrationId)
                    || !Guid.TryParse(one.FieldId, out var fieldId))
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
                    return;
                }

                var blob = Optional(one.OfficeKeySealed);
                if (blob is null || blob.Length == 0)
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Pusta koperta — to by zabrało dostęp.");
                    return;
                }

                await using var cmd = new SqlCommand("""
                    UPDATE v
                       SET v.office_key_sealed = @blob, v.wrapped_key = NULL
                      FROM app.registration_value v
                      JOIN app.registration r ON r.id = v.registration_id
                     WHERE v.registration_id = @reg AND v.field_id = @field
                       AND r.part_id = @part;
                    """, connection, tx);

                cmd.Parameters.AddBlob("@blob", blob);
                cmd.Parameters.AddWithValue("@reg", registrationId);
                cmd.Parameters.AddWithValue("@field", fieldId);
                cmd.Parameters.AddWithValue("@part", id);

                done += await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var one in seats)
            {
                if (!Guid.TryParse(one.SeatId, out var seatId))
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung miejsca.");
                    return;
                }

                var blob = Optional(one.SeatKeyForOffice);
                if (blob is null || blob.Length == 0)
                {
                    await tx.RollbackAsync(ctx.RequestAborted);
                    await Fail(ctx, StatusCodes.Status400BadRequest, "Pusta koperta — to by zabrało dostęp.");
                    return;
                }

                /*
                 * NUR die Plaetze DIESES Bausteins. Ohne die Verbindung ueber
                 * `registration` liesse sich von hier aus ein fremder Platz
                 * umschreiben — mit einer Huelle, die der Absender gewaehlt hat.
                 */
                await using var cmd = new SqlCommand("""
                    UPDATE a
                       SET a.seat_key_for_office = @blob, a.seat_key_for_intake = NULL
                      FROM app.access a
                     WHERE a.id = @seat
                       AND EXISTS (SELECT 1 FROM app.registration r
                                    WHERE r.access_id = a.id AND r.part_id = @part);
                    """, connection, tx);

                cmd.Parameters.AddBlob("@blob", blob);
                cmd.Parameters.AddWithValue("@seat", seatId);
                cmd.Parameters.AddWithValue("@part", id);

                done += await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number == 547)
        {
            /*
             * Die Pruefbedingung hat angeschlagen: es waere ein Wert
             * entstanden, den niemand mehr oeffnet. Nichts davon gilt.
             */
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Ta koperta nie otwierałaby nic — nic nie zmieniono.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { partId = Ids.ToText(id), rewrapped = done });
    }

    /// <summary>
    /// Einzelne Einstellungen eines Bausteins aendern — ohne die Seite.
    ///
    /// <para>
    /// <b>Gesetzt wird, was mitkommt</b>; alles andere bleibt. Der Rasterentwurf
    /// schickt beim Speichern das ganze `config`, und das ist dort richtig —
    /// hier waere es falsch: wer die Nachrichtenvorlage tippt, meint die
    /// Vorlage und nicht die Ueberschrift, die er nicht angefasst hat.
    /// </para>
    ///
    /// <para>
    /// Ein leerer Wert LOESCHT den Schluessel. Sonst bliebe eine Vorlage, die
    /// jemand geleert hat, als leerer Text stehen und gaelte weiter als gesetzt.
    /// </para>
    /// </summary>
    private static async Task ConfigAsync(HttpContext ctx, Db db, Guid id, ConfigRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var set = body.Set ?? [];

        if (set.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie podano żadnej zmiany.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var sheet = await SheetAsync(connection, id, ctx.RequestAborted);
        if (sheet is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return;
        }

        id = sheet.ModuleId;

        if (!await MayWriteSheetAsync(connection, who.Value.AccountId, sheet, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, NotYours);
            return;
        }

        /*
         * DAS PORTAL WIRD BEIM EINSTELLEN GEPRUEFT, nicht erst beim ersten
         * Einsendenden — dort sähe die Absage niemand, der sie beheben kann.
         * Steht der Bogen noch nirgends, gibt es nichts zu messen; dann
         * greift die Regel beim Absenden.
         */
        if (set.TryGetValue("portalUnder", out var portal) && !string.IsNullOrWhiteSpace(portal)
            && sheet.Paths.Count > 0
            && !await MayAnchorAsync(connection, sheet.Paths, Slug.Normalise(portal), chosenByOffice: true, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, NotAnchorable);
            return;
        }

        /* 0086 — der Zusatz zur Adresse (`?s=3`, `#zapisy`): lesbar, oder gar nicht. */
        if (set.TryGetValue("portalAt", out var at) && at.Trim() != "")
        {
            var normal = PortalAt(at);
            if (normal is null)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    $"Dopisek do adresu zaczyna się od „?” albo „#”, bez spacji i bez „{SeatParam}=”, najwyżej {MaxPortalAt} znaków.");
                return;
            }
            set["portalAt"] = normal;
        }

        string? current;

        await using (var read = new SqlCommand(
            /*
                DIE EINSTELLUNG GEHOERT DEM BAUSTEIN (0036), nicht seiner
                Verwendung. Sonst schriebe man sie an EINE Stelle, waehrend das
                Lesen ueber den Baustein laeuft — und die Vorlage waere gespeichert
                und trotzdem unsichtbar. Genau das ist einmal passiert.
            */
            "SELECT config FROM app.module WHERE id = @id;", connection))
        {
            read.Parameters.AddWithValue("@id", id);
            current = await read.ExecuteScalarAsync(ctx.RequestAborted) as string;
        }

        Dictionary<string, string> config;

        try
        {
            config = current is null or ""
                ? []
                : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(current) ?? [];
        }
        catch (System.Text.Json.JsonException)
        {
            /* Was nicht zu lesen ist, wird nicht stillschweigend ueberschrieben. */
            await Fail(ctx, StatusCodes.Status409Conflict,
                "Ustawienia tego bloku są nieczytelne — otwórz go w edytorze strony.");
            return;
        }

        foreach (var (key, value) in set)
        {
            if (value.Trim() == "") config.Remove(key);
            else config[key] = value;
        }

        var written = System.Text.Json.JsonSerializer.Serialize(config);

        if (written.Length > MaxConfigLength)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                $"Ustawienia bloku: najwyżej {MaxConfigLength} znaków.");
            return;
        }

        await using (var save = new SqlCommand(
            """
            UPDATE app.module SET config = @c WHERE id = @id;

            /* Der Rest in `slug_part` wird mitgefuehrt, solange er dasteht —
               zwei Staende derselben Sache laufen sonst auseinander. Auf JEDER
               Seite, auf der der Baustein steht. */
            UPDATE app.slug_part SET config = @c WHERE module_id = @id;
            """, connection))
        {
            save.Parameters.AddWithValue("@c", written);
            save.Parameters.AddWithValue("@id", id);

            await save.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { partId = Ids.ToText(id), config });
    }

    /// <summary>Dieselbe Grenze wie beim Speichern der ganzen Seite (<see cref="Page"/>).</summary>
    private const int MaxConfigLength = Page.MaxConfig;
}
