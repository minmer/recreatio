using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Das Formular — Felder als ZEILEN, und was von aussen hereinkommt.
///
/// <para>
/// <b>Warum Felder Zeilen sind und keine Einstellung.</b> 0003 sagte es, und es
/// gilt unveraendert: „Laege die Feldliste als JSON im Baustein, haette eine
/// Antwort keinen Anker: man aenderte die Reihenfolge, und alle Antworten
/// meinten etwas anderes." Eine Antwort zeigt auf ein Feld, also muss es das
/// Feld geben.
/// </para>
///
/// <para>
/// <b>Jedes Feld nennt seinen eigenen Bereich.</b> Damit kann ein Formular
/// Fragen stellen, deren Antworten an verschiedene Stellen gehen — die
/// Anmeldung an die Pfarrei, die Gesundheitsangabe an die Leitung der Freizeit.
/// Mit einem Bereich je Baustein muesste man dafuer zwei Formulare bauen und
/// den Menschen zweimal fragen.
/// </para>
///
/// <para>
/// <b>Auch die BESCHRIFTUNG ist versiegelt</b> — und die Auswahlliste erst
/// recht: eine Liste moeglicher Antworten sagt oft mehr als die Frage. Ein
/// oeffentliches Formular ist deshalb eines, dessen Bereich seine Epoche
/// offengelegt hat; dasselbe Verfahren wie beim Kalender, und kein zweites.
/// </para>
///
/// <para>
/// <b>Der Dienst liest nichts davon.</b> Werte kommen versiegelt an, die
/// Schluessel dazu verpackt unter der oeffentlichen Haelfte des Annahmepaares
/// (<see cref="Intake"/>). Er legt sie hin.
/// </para>
/// </summary>
public static class Form
{
    private static readonly string[] Kinds =
        ["line", "text", "choice", "date", "number", "checkbox", "email", "phone"];

    public static void Map(WebApplication app)
    {
        app.MapPost("/workspace/part/{id:guid}/field", AddFieldAsync);
        app.MapGet("/workspace/part/{id:guid}/fields", FieldsAsync);
        app.MapPost("/workspace/field/{id:guid}/remove", RemoveFieldAsync);

        app.MapGet("/workspace/part/{id:guid}/registrations", RegistrationsAsync);

        /*
         * ZWEI VERSCHIEDENE DINGE, und sie duerfen nicht denselben Knopf haben.
         *
         *   hide    raeumt die LISTE auf. Die Huellen bleiben liegen.
         *   remove  loescht die HUELLEN. Danach gibt es sie nicht mehr —
         *           auch nicht fuer den Betreiber, der sie ohnehin nie lesen
         *           konnte.
         *
         * Ein einziger Knopf „usuń", der in Wahrheit versteckt, waere eine
         * Zusage, die niemand einloest: wer seine Daten zurueckzieht, meint die
         * Bytes und nicht die Anzeige.
         */
        app.MapPost("/workspace/registration/{id:guid}/hide", HideAsync);
        app.MapPost("/workspace/registration/{id:guid}/remove", RemoveAsync);

        /*
         * EINE EINSENDUNG BERICHTIGEN — von der Kanzlei aus.
         *
         * Es gibt schon `POST /seat/{token}/submission`: dort berichtigt der
         * Mensch selbst, mit seinem Link. Das ist der Normalfall und bleibt es.
         *
         * Hier steht der andere: eine Telefonnummer, die als „600700800"
         * eingetragen wurde und als „+48 600 700 800" gespeichert gehoert. Wer
         * das reihum geradezieht, ist die Kanzlei — sie hat den
         * Annahmeschluessel, und der Betroffene hat vielleicht seit Wochen
         * nicht hereingeschaut.
         */
        app.MapPost("/workspace/registration/{id:guid}/values", ReviseAsOfficeAsync);

        /*
         * EINE NUMMER BESTAETIGEN, OHNE SIE ZU KENNEN (0030).
         *
         * Der Dienst kann keine SMS mit einem Code schicken — er liest die
         * Nummer nicht. Also wuerfelt die KANZLEI ein Geheimnis, verschickt den
         * Link von Hand, und der Dienst bekommt nur den Abdruck und die Stelle:
         * welche Einsendung, welches Feld.
         *
         * Wer klickt, war unter dieser Nummer erreichbar. Mehr beweist auch
         * eine Code-SMS nicht.
         */
        app.MapPost("/workspace/registration/{id:guid}/check", ArmCheckAsync);

        /* Ohne Konto — der Link IST der Beweis. */
        app.MapPost("/verify/{token}", VerifyAsync);

        /* Ohne Konto — das ist der Zweck. */
        app.MapGet("/form/{id:guid}", PublicAsync);
        app.MapPost("/form/{id:guid}/submit", SubmitAsync);
    }

    /* -- Felder pflegen ----------------------------------------------------- */

    public sealed record FieldRequest(
        string FieldId, string AreaId, int Epoch, string Kind, int Position,
        string LabelSealed, string? HelpSealed, string? OptionsSealed,
        bool? IsRequired, bool? IsHalfWidth, string? IdentityRole);

    /// <summary>
    /// Ein Feld anlegen.
    ///
    /// <para>
    /// <b>Zwei Rechte, und beide werden gebraucht.</b> Wer ein Feld hinstellt,
    /// aendert die SEITE — dafuer braucht er das Recht an der Adresse. Und er
    /// bestimmt, unter welchem Schluessel die Antworten liegen — dafuer braucht
    /// er das Recht am BEREICH. Eines allein genuegt nicht: sonst legte
    /// jemand, der nur die Seite fuehrt, Antworten in einen fremden Bereich.
    /// </para>
    /// </summary>
    private static async Task AddFieldAsync(HttpContext ctx, Db db, Guid id, FieldRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.FieldId, out var fieldId) || !Guid.TryParse(body.AreaId, out var areaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        var kind = (body.Kind ?? string.Empty).Trim().ToLowerInvariant();
        if (!Kinds.Contains(kind))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieznany rodzaj pola.");
            return;
        }

        var identity = (body.IdentityRole ?? "none").Trim().ToLowerInvariant();
        if (identity is not ("none" or "name" or "contact"))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rola pola: none, name albo contact.");
            return;
        }

        if (body.Epoch < 1)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Epoka zaczyna się od 1.");
            return;
        }

        byte[] label;
        try { label = Base64Url.Decode(body.LabelSealed ?? string.Empty); }
        catch (FormatException)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna zapieczętowana etykieta.");
            return;
        }

        if (label.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Pole potrzebuje etykiety.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var path = await PathOfPartAsync(connection, id, ctx.RequestAborted);
        if (path is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return;
        }

        var grip = await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);
        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego adresu nie prowadzisz.");
            return;
        }

        if (!await Area.MayAsync(connection, who.Value.AccountId, areaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Pod obszar, w którym nie możesz pisać, nie skierujesz odpowiedzi.");
            return;
        }

        await using var insert = new SqlCommand("""
            INSERT INTO app.slug_field
                (id, part_id, area_id, kind, position, label_sealed, help_sealed, options_sealed,
                 epoch, is_required, is_half_width, identity_role, created_at)
            VALUES (@id, @part, @area, @kind, @pos, @label, @help, @options,
                    @epoch, @required, @half, @identity, @now);
            """, connection);

        insert.Parameters.AddWithValue("@id", fieldId);
        insert.Parameters.AddWithValue("@part", id);
        insert.Parameters.AddWithValue("@area", areaId);
        insert.Parameters.AddWithValue("@kind", kind);
        insert.Parameters.AddWithValue("@pos", body.Position);
        insert.Parameters.AddWithValue("@label", label);
        insert.Parameters.AddBlob("@help", Optional(body.HelpSealed));
        insert.Parameters.AddBlob("@options", Optional(body.OptionsSealed));
        insert.Parameters.AddWithValue("@epoch", body.Epoch);
        insert.Parameters.AddWithValue("@required", body.IsRequired ?? false);
        insert.Parameters.AddWithValue("@half", body.IsHalfWidth ?? false);
        insert.Parameters.AddWithValue("@identity", identity);
        insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

        try
        {
            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Takie pole już istnieje.");
            return;
        }

        await ctx.Response.WriteAsJsonAsync(new { fieldId = Ids.ToText(fieldId), partId = Ids.ToText(id) });
    }

    private static async Task FieldsAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var path = await PathOfPartAsync(connection, id, ctx.RequestAborted);
        if (path is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return;
        }

        /*
         * Dieselben zwei Achsen wie bei den Einsendungen: wer die Seite fuehrt,
         * oder wer einen der Bereiche liest, in die gefragt wird. Die
         * Beschriftungen liegen unter dem Epochenschluessel des Bereichs — wer
         * ihn hat, soll seine eigenen Fragen auch sehen duerfen, ohne dass ihm
         * jemand die Seite gibt.
         */
        var grip = await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);

        if (!grip.MayWrite)
        {
            var asked = await ReadFieldsAsync(connection, id, ctx.RequestAborted);
            var any = false;

            foreach (var areaId in asked.Select(f => f.AreaId).Distinct())
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
                    "Ani tego adresu nie prowadzisz, ani nie czytasz obszaru, o który pyta ten formularz.");
                return;
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            partId = Ids.ToText(id),
            fields = await ReadFieldsAsync(connection, id, ctx.RequestAborted)
        });
    }

    /// <summary>
    /// Ein Feld entfernen.
    ///
    /// <para>
    /// <b>Nur, solange keine Antwort darauf zeigt.</b> Sonst faende sich eine
    /// Einsendung mit einem Wert ohne Frage — und niemand koennte mehr sagen,
    /// worauf jemand geantwortet hat. Wer die Frage loswerden will, nachdem
    /// geantwortet wurde, verbirgt den Baustein; die Antworten bleiben lesbar.
    /// </para>
    /// </summary>
    private static async Task RemoveFieldAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        Guid partId;
        await using (var find = new SqlCommand("SELECT part_id FROM app.slug_field WHERE id = @id;", connection))
        {
            find.Parameters.AddWithValue("@id", id);
            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego pola nie ma.");
                return;
            }
            partId = found;
        }

        var path = await PathOfPartAsync(connection, partId, ctx.RequestAborted);
        if (path is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return;
        }

        var grip = await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);
        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego adresu nie prowadzisz.");
            return;
        }

        await using (var used = new SqlCommand(
            "SELECT TOP 1 1 FROM app.registration_value WHERE field_id = @id;", connection))
        {
            used.Parameters.AddWithValue("@id", id);
            if (await used.ExecuteScalarAsync(ctx.RequestAborted) is not null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Na to pole ktoś już odpowiedział. Usunięcie zostawiłoby odpowiedź bez pytania.");
                return;
            }
        }

        await using var drop = new SqlCommand("DELETE FROM app.slug_field WHERE id = @id;", connection);
        drop.Parameters.AddWithValue("@id", id);
        await drop.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { fieldId = Ids.ToText(id), removed = true });
    }

    /* -- Das oeffentliche Formular ------------------------------------------ */

    /// <summary>
    /// Das Formular, wie ein Fremder es bekommt.
    ///
    /// <para>
    /// Mit den Beschriftungen VERSIEGELT und der oeffentlichen Haelfte des
    /// Annahmepaares je Bereich. Wer die Epoche offengelegt hat, dessen
    /// Beschriftungen kann der Browser oeffnen; wer nicht, dessen Feld bleibt
    /// zu — und das ist dann kein oeffentliches Formular.
    /// </para>
    /// </summary>
    private static async Task PublicAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var fields = await ReadFieldsAsync(connection, id, ctx.RequestAborted);
        if (fields.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tu nie ma formularza.");
            return;
        }

        var areas = new List<object>();

        foreach (var areaId in fields.Select(f => f.AreaId).Distinct())
        {
            await using var cmd = new SqlCommand("""
                SELECT i.public_key, c.name, c.address, c.email
                FROM app.intake i
                LEFT JOIN app.area_controller c ON c.area_id = i.area_id
                WHERE i.area_id = @area;
                """, connection);

            cmd.Parameters.AddWithValue("@area", areaId);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted)) continue;

            areas.Add(new
            {
                areaId = Ids.ToText(areaId),
                publicKey = Base64Url.Encode((byte[])reader[0]),
                controller = reader.IsDBNull(1) ? null : new
                {
                    name = reader.GetString(1),
                    address = reader.IsDBNull(2) ? null : reader.GetString(2),
                    email = reader.IsDBNull(3) ? null : reader.GetString(3)
                }
            });
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            partId = Ids.ToText(id),
            fields = fields.Select(Told),
            areas
        });
    }

    public sealed record ValueIn(string FieldId, string Sealed, string WrappedKey, string? SeatKeySealed);

    /// <summary>
    /// Ein Platz, den der Einsendende sich SELBST gewuerfelt hat (0027).
    ///
    /// <para>
    /// <b>Nicht der Dienst legt ihn an, sondern der Browser</b> — wie bei jedem
    /// Platz. Der Dienst bekommt den Abdruck des Links und zwei Huellen, von
    /// denen er keine oeffnen kann; das Geheimnis, das sie aufmacht, hat er nie
    /// gesehen.
    /// </para>
    ///
    /// <para>
    /// <b><c>SeatKeyForIntake</c> und nicht <c>…ForArea</c>.</b> Ein
    /// oeffentliches Formular setzt voraus, dass der Bereich seinen
    /// Epochenschluessel veroeffentlicht hat — sonst bleiben die
    /// Beschriftungen zu. Unter einem veroeffentlichten Schluessel zu
    /// versiegeln schuetzt nichts. Der Platz geht deshalb an die ANNAHME, deren
    /// private Haelfte unter dem Amtsschluessel liegt.
    /// </para>
    /// </summary>
    public sealed record SelfSeat(
        string SeatId, string TokenSha256, string SeatKeySealed, string SeatKeyForIntake,
        string AreaId, int Epoch, string? RecipientName, string? UnderPath);

    public sealed record SubmitRequest(
        IReadOnlyList<ValueIn> Values, string? ClaimSha256, string? SeatToken, string? RoleId,
        SelfSeat? Seat);

    /// <summary>
    /// Eine Einsendung — ohne Konto.
    ///
    /// <para>
    /// <b>Die Quittung (`claimSha256`) ist der einzige Weg zurueck</b>, wenn
    /// niemand angemeldet war und kein Platz im Spiel ist. Gespeichert wird nur
    /// ihr Abdruck; wer sie verliert, kommt an seine Einsendung nicht mehr
    /// heran — und das ist besser, als wenn jeder andere es koennte.
    /// </para>
    ///
    /// <para>
    /// <b>Jeder Wert bringt seinen eigenen Schluessel mit</b>, verpackt unter der
    /// oeffentlichen Haelfte. Ein gemeinsamer Schluessel fuer alle Felder waere
    /// kuerzer und hiesse: wer eines oeffnet, oeffnet alle.
    /// </para>
    /// </summary>
    private static async Task SubmitAsync(HttpContext ctx, Db db, Guid id, SubmitRequest body)
    {
        var values = body.Values ?? [];

        if (values.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Puste zgłoszenie.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var fields = await ReadFieldsAsync(connection, id, ctx.RequestAborted);
        if (fields.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tu nie ma formularza.");
            return;
        }

        var known = fields.Select(f => f.Id).ToHashSet();
        var parsed = new List<(Guid Field, byte[] Sealed, byte[] Wrapped, byte[]? ForSeat)>();

        foreach (var one in values)
        {
            if (!Guid.TryParse(one.FieldId, out var fieldId) || !known.Contains(fieldId))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Odpowiedź na pole, którego tu nie ma.");
                return;
            }

            byte[] sealedValue, wrapped;
            try
            {
                sealedValue = Base64Url.Decode(one.Sealed ?? string.Empty);
                wrapped = Base64Url.Decode(one.WrappedKey ?? string.Empty);
            }
            catch (FormatException)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna zapieczętowana odpowiedź.");
                return;
            }

            if (sealedValue.Length == 0 || wrapped.Length == 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Pusta odpowiedź nie jest zapieczętowana.");
                return;
            }

            parsed.Add((fieldId, sealedValue, wrapped, Optional(one.SeatKeySealed)));
        }

        var missing = fields
            .Where(f => f.IsRequired && parsed.All(p => p.Field != f.Id))
            .ToList();

        if (missing.Count > 0)
        {
            /*
             * WELCHE fehlen, steht nicht dabei: die Beschriftung ist versiegelt,
             * und der Dienst kann sie nicht lesen. Die Oberflaeche weiss es —
             * sie hat das Formular geoeffnet — und sagt es dort.
             */
            await Fail(ctx, StatusCodes.Status400BadRequest, "Brakuje odpowiedzi na pole wymagane.");
            return;
        }

        Guid? seatId = null;

        if (!string.IsNullOrWhiteSpace(body.SeatToken))
        {
            await using var find = new SqlCommand("""
                SELECT id FROM app.access
                WHERE token_sha256 = @token AND revoked_at IS NULL AND status = N'active'
                  AND (expires_at IS NULL OR expires_at > @now);
                """, connection);

            find.Parameters.AddWithValue("@token",
                System.Security.Cryptography.SHA256.HashData(
                    System.Text.Encoding.UTF8.GetBytes(body.SeatToken.Trim())));
            find.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            if (await find.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma.");
                return;
            }
            seatId = found;
        }

        byte[]? claim = null;
        if (!string.IsNullOrWhiteSpace(body.ClaimSha256))
        {
            claim = Optional(body.ClaimSha256);
            if (claim is null || claim.Length != 32)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Odcisk pokwitowania musi mieć 32 bajty.");
                return;
            }
        }

        /*
         * Angemeldet? Dann kann die Einsendung an einer Rolle haengen — aber an
         * einer GENANNTEN.
         *
         * Die erste beste zu nehmen waere genau der Fehler, den der Altbestand
         * mit seiner Personenauswahl behoben hat: ein Elternteil meldet zwei
         * Kinder an, beide landeten bei derselben Person, und weil die Angaben
         * trotzdem aufgingen, faende es niemand heraus. Wird keine genannt,
         * haengt die Einsendung eben nur am Platz oder an der Quittung.
         */
        var who = await Auth.WhoAsync(ctx, db);
        Guid? roleId = null;

        if (who is not null && !string.IsNullOrWhiteSpace(body.RoleId))
        {
            if (!Guid.TryParse(body.RoleId, out var wanted))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung roli.");
                return;
            }

            var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
            if (!mine.Any(r => r.Id == wanted))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja rola.");
                return;
            }

            roleId = wanted;
        }

        /*
         * DER SELBSTGEWUERFELTE PLATZ (0027).
         *
         * Er entsteht ZUGLEICH mit der Einsendung und nicht davor: der Firmling
         * fuellt aus, und erst danach gibt es etwas, worauf ein Link zeigen
         * koennte. Beides in einer Transaktion — ein Platz ohne Einsendung waere
         * ein Link auf nichts, eine Einsendung ohne Platz ein Mensch, der nicht
         * mehr an seine eigenen Angaben kommt.
         */
        SelfSeatRow? mint = null;

        if (body.Seat is not null)
        {
            if (seatId is not null)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest,
                    "Zgłoszenie ma jedno miejsce, nie dwa.");
                return;
            }

            mint = await ReadSelfSeatAsync(ctx, connection, id, body.Seat, fields);
            if (mint is null) return;

            seatId = mint.Value.Id;
        }

        if (seatId is null && roleId is null && claim is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Zgłoszenie bez żadnego śladu — nikt nie mógłby go później odnaleźć.");
            return;
        }

        var registrationId = Ids.NewId();
        var now = DateTimeOffset.UtcNow;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            if (mint is not null)
            {
                var seat = mint.Value;

                await using (var open = new SqlCommand("""
                    INSERT INTO app.access
                        (id, area_id, token_sha256, seat_key_sealed, seat_key_for_intake, epoch,
                         recipient_name, origin, created_by_role_id, created_at)
                    VALUES (@id, @area, @token, @forLink, @forIntake, @epoch,
                            @name, N'self', NULL, @now);
                    """, connection, tx))
                {
                    open.Parameters.AddWithValue("@id", seat.Id);
                    open.Parameters.AddWithValue("@area", seat.AreaId);
                    open.Parameters.AddWithValue("@token", seat.TokenHash);
                    open.Parameters.AddBlob("@forLink", seat.ForLink);
                    open.Parameters.AddBlob("@forIntake", seat.ForIntake);
                    open.Parameters.AddWithValue("@epoch", seat.Epoch);
                    open.Parameters.AddWithValue("@name",
                        seat.RecipientName is null ? DBNull.Value : seat.RecipientName);
                    open.Parameters.AddWithValue("@now", now);

                    await open.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                /*
                 * Wohin der Platz gehoert — damit das Portal zurueckfindet und
                 * damit eine interne Unterseite (0026) sich ihm oeffnet.
                 */
                foreach (var slugId in seat.SlugIds)
                {
                    await using var bind = new SqlCommand(
                        "INSERT INTO app.access_slug (access_id, slug_id) VALUES (@a, @s);",
                        connection, tx);

                    bind.Parameters.AddWithValue("@a", seat.Id);
                    bind.Parameters.AddWithValue("@s", slugId);
                    await bind.ExecuteNonQueryAsync(ctx.RequestAborted);
                }
            }

            await using (var insert = new SqlCommand("""
                INSERT INTO app.registration
                    (id, part_id, access_id, role_id, claim_sha256, submitted_at)
                VALUES (@id, @part, @access, @role, @claim, @now);
                """, connection, tx))
            {
                insert.Parameters.AddWithValue("@id", registrationId);
                insert.Parameters.AddWithValue("@part", id);
                insert.Parameters.AddWithValue("@access", (object?)seatId ?? DBNull.Value);
                insert.Parameters.AddWithValue("@role", (object?)roleId ?? DBNull.Value);
                insert.Parameters.AddBlob("@claim", claim);
                insert.Parameters.AddWithValue("@now", now);

                await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            foreach (var (fieldId, sealedValue, wrapped, forSeat) in parsed)
            {
                await using var add = new SqlCommand("""
                    INSERT INTO app.registration_value
                        (registration_id, field_id, value_sealed, wrapped_key, seat_key_sealed)
                    VALUES (@reg, @field, @value, @wrapped, @seat);
                    """, connection, tx);

                add.Parameters.AddWithValue("@reg", registrationId);
                add.Parameters.AddWithValue("@field", fieldId);
                add.Parameters.AddWithValue("@value", sealedValue);
                add.Parameters.AddWithValue("@wrapped", wrapped);
                add.Parameters.AddBlob("@seat", forSeat);

                await add.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            registrationId = Ids.ToText(registrationId),
            values = parsed.Count,
            seatId = seatId is null ? null : Ids.ToText(seatId.Value),

            /*
             * WO das Portal haengt — der Dienst hat es entschieden, also sagt
             * er es auch. Ohne das muesste der Browser die Regel ein zweites
             * Mal kennen, und zwei Meinungen darueber ergaeben eine Adresse,
             * die ins Leere zeigt.
             */
            portalUnder = mint?.UnderPath
        });
    }

    /// <summary>Ein geprueufter Selbstplatz, fertig zum Einfuegen.</summary>
    private readonly record struct SelfSeatRow(
        Guid Id, Guid AreaId, byte[] TokenHash, byte[] ForLink, byte[] ForIntake,
        int Epoch, string? RecipientName, IReadOnlyList<Guid> SlugIds, string? UnderPath);

    /// <summary>
    /// Den mitgeschickten Platz pruefen — und dabei die eine Frage stellen, die
    /// wirklich zaehlt: KOMMT DIE KANZLEI HERAN?
    ///
    /// <para>
    /// Der Platzschluessel ist unter der oeffentlichen Haelfte der Annahme
    /// verpackt. Hat der Bereich gar keine Annahme, gibt es diese Haelfte
    /// nicht, und was hier ankaeme, koennte niemand je oeffnen — ein Platz, der
    /// aussieht wie einer und keiner ist. Deshalb steht die Pruefung hier und
    /// nicht bei der Anzeige, wo sie zu spaet waere.
    /// </para>
    ///
    /// <para>
    /// <b>Der Bereich muss einer sein, in den dieses Formular ohnehin
    /// einsendet.</b> Sonst haengte sich eine Einsendung einen Platz in einen
    /// fremden Bereich — und stuende dort in der Liste der Kanzlei, die ihn nie
    /// ausgestellt hat.
    /// </para>
    /// </summary>
    private static async Task<SelfSeatRow?> ReadSelfSeatAsync(
        HttpContext ctx, SqlConnection connection, Guid partId, SelfSeat body, List<FieldRow> fields)
    {
        if (!Guid.TryParse(body.SeatId, out var seatId) || seatId == Guid.Empty
            || !Guid.TryParse(body.AreaId, out var areaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung miejsca.");
            return null;
        }

        if (!fields.Any(f => f.AreaId == areaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest,
                "Miejsce miałoby powstać w obszarze, do którego ten formularz nie pisze.");
            return null;
        }

        if (body.Epoch < 1)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Epoka zaczyna się od 1.");
            return null;
        }

        var tokenHash = Optional(body.TokenSha256);
        if (tokenHash is null || tokenHash.Length != 32)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Odcisk linku musi mieć 32 bajty.");
            return null;
        }

        var forLink = Optional(body.SeatKeySealed);
        var forIntake = Optional(body.SeatKeyForIntake);

        if (forLink is null || forLink.Length == 0 || forIntake is null || forIntake.Length == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny zapieczętowany klucz miejsca.");
            return null;
        }

        await using (var has = new SqlCommand(
            "SELECT TOP 1 1 FROM app.intake WHERE area_id = @area;", connection))
        {
            has.Parameters.AddWithValue("@area", areaId);

            if (await has.ExecuteScalarAsync(ctx.RequestAborted) is null)
            {
                await Fail(ctx, StatusCodes.Status409Conflict,
                    "Ten obszar nie przyjmuje zgłoszeń — nikt nie mógłby otworzyć miejsca.");
                return null;
            }
        }

        /*
         * WOHIN DER PLATZ GEHOERT — und das darf der Einsendende NICHT frei
         * waehlen.
         *
         * `app.access_slug` ist einer der drei Wege in eine interne Unterseite
         * (0026). Naehme der Dienst hier eine Kennung entgegen, wie sie kommt,
         * schriebe sich ein Fremder mit einer Anmeldung den Zutritt zu
         * `lo13/anna` — er muesste die Kennung nur raten oder abschreiben.
         *
         * Erlaubt ist deshalb genau die Seite, auf der das Formular steht, oder
         * eine darueber. Mehr braucht der Fall nicht: das Formular liegt unter
         * `…/confirmation/signin`, das Portal soll unter `…/confirmation`
         * haengen.
         */
        var slugIds = new List<Guid>();

        var formPath = await PathOfPartAsync(connection, partId, ctx.RequestAborted);
        if (formPath is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return null;
        }

        /*
         * WO DAS PORTAL HAENGT — und der Browser muss es nicht wissen.
         *
         * Die Regel ist eine Eigenschaft des Baus und keine Einstellung je
         * Seite: das Formular liegt auf `…/confirmation/signin`, das Portal
         * gehoert eine Ebene darueber, auf `…/confirmation`. Genau dort sucht
         * ein Mensch es auch — die Anmeldung ist ein Durchgang, die Firmung
         * ist der Ort.
         *
         * Gibt es die Seite darueber nicht im Register, bleibt die Seite mit
         * dem Formular. Und wer es anders will, nennt `UnderPath` — dann gilt
         * dieselbe Pruefung wie sonst.
         */
        var wanted = string.IsNullOrWhiteSpace(body.UnderPath)
            ? Above(formPath)
            : Slug.Normalise(body.UnderPath);

        if (formPath != wanted && !formPath.StartsWith(wanted + "/", StringComparison.Ordinal))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Miejsce może należeć tylko do strony z tym formularzem albo do strony nad nią.");
            return null;
        }

        var anchor = await SlugIdAsync(connection, wanted, ctx.RequestAborted);

        /*
         * Nur wenn der Aufrufer ihn GENANNT hat, ist ein fehlender Anker ein
         * Fehler. Beim abgeleiteten faellt er still auf die Seite mit dem
         * Formular zurueck: eine Anmeldung abzulehnen, weil eine Zwischenseite
         * nie uebernommen wurde, waere eine Strafe fuer den Falschen.
         */
        if (anchor is null && !string.IsNullOrWhiteSpace(body.UnderPath))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego adresu nie ma w rejestrze.");
            return null;
        }

        var anchorPath = wanted;

        if (anchor is null)
        {
            anchor = await SlugIdAsync(connection, formPath, ctx.RequestAborted);
            anchorPath = formPath;
        }

        if (anchor is not null) slugIds.Add(anchor.Value);

        var name = (body.RecipientName ?? string.Empty).Trim();

        return new SelfSeatRow(seatId, areaId, tokenHash, forLink, forIntake, body.Epoch,
            name == "" ? null : name[..Math.Min(name.Length, 200)],
            slugIds, anchor is null ? null : anchorPath);
    }

    /* -- Was die Kanzlei sieht ---------------------------------------------- */

    private static async Task RegistrationsAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var path = await PathOfPartAsync(connection, id, ctx.RequestAborted);
        if (path is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return;
        }

        /*
         * ZWEI ACHSEN, und die zweite ist die, auf die es hier ankommt.
         *
         * Bis hierher stand allein das Schreibrecht an der ADRESSE. Das ist die
         * falsche Achse: die Antworten liegen unter dem Annahmeschluessel des
         * BEREICHS, und den haelt die Kanzlei — nicht, wer die Seite fuehrt. Es
         * war genau der Fall aus 0001, nur umgedreht: der eine DARF und KANN
         * nicht, der andere KANN und DARF nicht.
         *
         * Deshalb: sehen darf, wer die Seite fuehrt ODER einen der Bereiche
         * lesen darf, in die dieses Formular schreibt.
         */
        var grip = await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);
        var fields = await ReadFieldsAsync(connection, id, ctx.RequestAborted);

        var mine = new HashSet<Guid>();

        foreach (var areaId in fields.Select(f => f.AreaId).Distinct())
        {
            if (await Area.MayAsync(connection, who.Value.AccountId, areaId,
                    Capability.Read, ctx.RequestAborted))
            {
                mine.Add(areaId);
            }
        }

        if (!grip.MayWrite && mine.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden,
                "Ani tego adresu nie prowadzisz, ani nie czytasz obszaru, do którego trafiają odpowiedzi.");
            return;
        }

        /*
         * Und HERAUS gehen nur die Werte der Bereiche, die dieser Mensch lesen
         * darf. Eine Huelle an jemanden zu schicken, der den Schluessel dazu
         * nie bekommt, nuetzt ihm nichts und liegt dann an einer Stelle mehr.
         *
         * Wer die Seite fuehrt, ohne einen Bereich zu lesen, sieht deshalb DASS
         * es Einsendungen gibt und wann — nicht, was darin steht. Das ist keine
         * Einschraenkung, sondern die Wahrheit: oeffnen koennte er sie ohnehin
         * nicht.
         */
        var readable = fields.Where(f => mine.Contains(f.AreaId)).Select(f => f.Id).ToHashSet();

        var rows = new List<(Guid Id, Guid? Seat, DateTimeOffset At, DateTimeOffset? Gone, bool Hidden)>();

        /*
         * Versteckte kommen nur mit, wenn danach gefragt wird — sonst waere
         * „ukryj" ein Knopf ohne Wirkung. Und sie kommen als VERSTECKT, damit
         * die Oberflaeche sie nicht wieder unter die uebrigen mischt.
         */
        var withHidden = ctx.Request.Query["hidden"] == "1";

        await using (var cmd = new SqlCommand($"""
            SELECT id, access_id, submitted_at, withdrawn_at, is_hidden
            FROM app.registration
            WHERE part_id = @part {(withHidden ? "" : "AND is_hidden = 0")}
            ORDER BY submitted_at DESC;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@part", id);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                rows.Add((
                    reader.GetGuid(0),
                    reader.IsDBNull(1) ? null : reader.GetGuid(1),
                    reader.GetDateTimeOffset(2),
                    reader.IsDBNull(3) ? null : reader.GetDateTimeOffset(3),
                    reader.GetBoolean(4)));
            }
        }

        var byRegistration = new Dictionary<Guid, List<object>>();

        if (rows.Count > 0)
        {
            var names = string.Join(", ", rows.Select((_, i) => $"@r{i}"));

            await using var cmd = new SqlCommand(
                $"SELECT registration_id, field_id, value_sealed, wrapped_key "
                + $"FROM app.registration_value WHERE registration_id IN ({names});", connection);

            for (var i = 0; i < rows.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", rows[i].Id);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var key = reader.GetGuid(0);
                var fieldId = reader.GetGuid(1);

                // Ein Feld aus einem Bereich, den dieser Mensch nicht liest.
                if (!readable.Contains(fieldId)) continue;

                if (!byRegistration.TryGetValue(key, out var list)) byRegistration[key] = list = [];

                list.Add(new
                {
                    fieldId = Ids.ToText(fieldId),
                    @sealed = Base64Url.Encode((byte[])reader[2]),

                    /* Verpackt unter der oeffentlichen Haelfte — zu oeffnen mit
                       dem privaten Annahmeschluessel, den nur das Amt hat. */
                    wrappedKey = Base64Url.Encode((byte[])reader[3])
                });
            }
        }

        /* Die Bestaetigungen dieser Einsendungen — der Leser oben ist zu (MARS). */
        var byCheck = new Dictionary<Guid, List<object>>();

        if (rows.Count > 0)
        {
            var names = string.Join(", ", rows.Select((_, i) => $"@c{i}"));

            await using var cmd = new SqlCommand(
                $"SELECT registration_id, field_id, sent_at, expires_at, verified_at "
                + $"FROM app.value_check WHERE registration_id IN ({names});", connection);

            for (var i = 0; i < rows.Count; i++) cmd.Parameters.AddWithValue($"@c{i}", rows[i].Id);

            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var key = reader.GetGuid(0);
                if (!byCheck.TryGetValue(key, out var list)) byCheck[key] = list = [];

                list.Add(new
                {
                    fieldId = Ids.ToText(reader.GetGuid(1)),
                    sentAt = reader.GetDateTimeOffset(2),
                    expiresAt = reader.GetDateTimeOffset(3),
                    verifiedAt = reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(4)
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            partId = Ids.ToText(id),
            registrations = rows.Select(r => new
            {
                registrationId = Ids.ToText(r.Id),
                seatId = r.Seat is null ? null : Ids.ToText(r.Seat.Value),
                submittedAt = r.At,
                withdrawnAt = r.Gone,
                hidden = r.Hidden,
                values = byRegistration.TryGetValue(r.Id, out var list) ? list : [],

                /*
                 * Welche Werte bestaetigt sind (0030) — die STELLE, nicht der
                 * Inhalt. Der Dienst sagt „dieses Feld dieser Einsendung wurde
                 * bestaetigt" und weiss weiterhin nicht, welche Nummer das ist.
                 */
                checks = byCheck.TryGetValue(r.Id, out var marks) ? marks : []
            })
        });
    }

    /* -- Gemeinsames -------------------------------------------------------- */

    internal sealed record FieldRow(
        Guid Id, Guid AreaId, string Kind, int Position, byte[] Label, byte[]? Help,
        byte[]? Options, int Epoch, bool IsRequired, bool IsHalfWidth, string IdentityRole);

    private static object Told(FieldRow f) => new
    {
        fieldId = Ids.ToText(f.Id),
        areaId = Ids.ToText(f.AreaId),
        kind = f.Kind,
        position = f.Position,
        labelSealed = Base64Url.Encode(f.Label),
        helpSealed = f.Help is null ? null : Base64Url.Encode(f.Help),
        optionsSealed = f.Options is null ? null : Base64Url.Encode(f.Options),
        epoch = f.Epoch,
        isRequired = f.IsRequired,
        isHalfWidth = f.IsHalfWidth,
        identityRole = f.IdentityRole
    };

    private static async Task<List<FieldRow>> ReadFieldsAsync(
        SqlConnection connection, Guid partId, CancellationToken ct)
    {
        var fields = new List<FieldRow>();

        await using var cmd = new SqlCommand("""
            SELECT id, area_id, kind, position, label_sealed, help_sealed, options_sealed,
                   epoch, is_required, is_half_width, identity_role
            FROM app.slug_field
            WHERE part_id = @part
            ORDER BY position;
            """, connection);

        cmd.Parameters.AddWithValue("@part", partId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            fields.Add(new FieldRow(
                reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetInt32(3),
                (byte[])reader[4],
                reader.IsDBNull(5) ? null : (byte[])reader[5],
                reader.IsDBNull(6) ? null : (byte[])reader[6],
                reader.GetInt32(7), reader.GetBoolean(8), reader.GetBoolean(9), reader.GetString(10)));
        }

        return fields;
    }

    public sealed record HideRequest(bool Hidden);

    /// <summary>
    /// Eine Einsendung aus der Liste nehmen — oder zurueckholen.
    ///
    /// <para>
    /// <b>Das loescht nichts.</b> Die versiegelten Antworten bleiben, wo sie
    /// sind; es aendert sich, was die Kanzlei vor sich sieht. Fuer eine
    /// Doppeleinsendung oder einen Probelauf ist das genau richtig — und fuer
    /// jemanden, der um Loeschung bittet, genau falsch. Dafuer steht
    /// <see cref="RemoveAsync"/> daneben.
    /// </para>
    /// </summary>
    private static async Task HideAsync(HttpContext ctx, Db db, Guid id, HideRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayTendAsync(ctx, db, connection, id)) return;

        await using var cmd = new SqlCommand(
            "UPDATE app.registration SET is_hidden = @hidden WHERE id = @id;", connection);

        cmd.Parameters.AddWithValue("@hidden", body.Hidden);
        cmd.Parameters.AddWithValue("@id", id);

        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new
        {
            registrationId = Ids.ToText(id),
            hidden = body.Hidden
        });
    }

    /// <summary>
    /// Eine Einsendung LOESCHEN — die Antworten mit.
    ///
    /// <para>
    /// <b>Danach gibt es sie nicht mehr.</b> Kein Papierkorb, kein Merkmal: die
    /// Zeilen in <c>registration_value</c> verschwinden, und mit ihnen die
    /// einzigen Bytes, in denen die Angaben je standen. Der Dienst konnte sie
    /// nie lesen und kann sie erst recht nicht wiederherstellen.
    /// </para>
    ///
    /// <para>
    /// <b>Der PLATZ bleibt stehen.</b> Er ist der Zugang eines Menschen und
    /// nicht seine Einsendung; naehme man ihn mit, naehme man dem Firmling auch
    /// die Nachricht der Kanzlei und den gemeinsamen Kalender. Sein Portal
    /// zeigt danach kein „Twoje zgłoszenie" mehr — was zutrifft.
    /// </para>
    /// </summary>
    private static async Task RemoveAsync(HttpContext ctx, Db db, Guid id)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayTendAsync(ctx, db, connection, id)) return;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            int values;

            await using (var cmd = new SqlCommand("""
                DELETE FROM app.registration_value WHERE registration_id = @id;
                SELECT @@ROWCOUNT;
                """, connection, tx))
            {
                cmd.Parameters.AddWithValue("@id", id);
                values = (int)(await cmd.ExecuteScalarAsync(ctx.RequestAborted) ?? 0);
            }

            await using (var cmd = new SqlCommand(
                "DELETE FROM app.registration WHERE id = @id;", connection, tx))
            {
                cmd.Parameters.AddWithValue("@id", id);
                await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);

            await ctx.Response.WriteAsJsonAsync(new
            {
                registrationId = Ids.ToText(id),
                removed = true,
                values
            });
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }
    }

    public sealed record OfficeValue(string FieldId, string Sealed, string WrappedKey, string? SeatKeySealed);

    public sealed record OfficeReviseRequest(IReadOnlyList<OfficeValue> Values);

    /// <summary>
    /// Eine Einsendung von der Kanzlei aus berichtigen.
    ///
    /// <para>
    /// <b>Der Dienst sieht auch hier nichts.</b> Er bekommt dieselben Huellen
    /// wie bei der ersten Einsendung und legt sie hin. Wer berichtigt, hat den
    /// Annahmeschluessel im Browser — der Dienst hat ihn nie.
    /// </para>
    ///
    /// <para>
    /// <b><c>SeatKeySealed</c> gehoert dazu, wenn es einen Platz gibt.</b>
    /// Liesse man es weg, staende die berichtigte Nummer nur noch fuer das Amt
    /// da und waere fuer den Menschen selbst verschwunden — eine Korrektur, die
    /// ihm etwas WEGNIMMT. Die Oberflaeche holt den Platzschluessel dafuer
    /// ueber die Epoche oder die Annahme (0027).
    /// </para>
    ///
    /// <para>
    /// Ersetzt wird Feld fuer Feld, und nur was mitkommt — wie beim Menschen
    /// selbst.
    /// </para>
    /// </summary>
    private static async Task ReviseAsOfficeAsync(
        HttpContext ctx, Db db, Guid id, OfficeReviseRequest body)
    {
        var values = body.Values ?? [];

        if (values.Count == 0)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nie podano żadnej poprawki.");
            return;
        }

        var parsed = new List<(Guid Field, byte[] Sealed, byte[] Wrapped, byte[]? ForSeat)>();

        foreach (var one in values)
        {
            if (!Guid.TryParse(one.FieldId, out var fieldId))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung pola.");
                return;
            }

            var sealedValue = Optional(one.Sealed);
            var wrapped = Optional(one.WrappedKey);

            if (sealedValue is null || sealedValue.Length == 0 || wrapped is null || wrapped.Length == 0)
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna poprawka.");
                return;
            }

            parsed.Add((fieldId, sealedValue, wrapped, Optional(one.SeatKeySealed)));
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayTendAsync(ctx, db, connection, id)) return;

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            foreach (var (fieldId, sealedValue, wrapped, forSeat) in parsed)
            {
                await using (var drop = new SqlCommand("""
                    DELETE FROM app.registration_value
                     WHERE registration_id = @reg AND field_id = @field;
                    """, connection, tx))
                {
                    drop.Parameters.AddWithValue("@reg", id);
                    drop.Parameters.AddWithValue("@field", fieldId);
                    await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                /*
                 * EINE BESTAETIGUNG GILT DEM WERT, NICHT DEM MENSCHEN (0030).
                 * Wer die Nummer aendert, hat eine ANDERE Nummer — und die ist
                 * ungeprueft. Das hier zu tun statt es jemandem aufzutragen ist
                 * der Unterschied zwischen einer Regel und einer Bitte.
                 */
                await using (var stale = new SqlCommand("""
                    DELETE FROM app.value_check
                     WHERE registration_id = @reg AND field_id = @field;
                    """, connection, tx))
                {
                    stale.Parameters.AddWithValue("@reg", id);
                    stale.Parameters.AddWithValue("@field", fieldId);
                    await stale.ExecuteNonQueryAsync(ctx.RequestAborted);
                }

                await using var add = new SqlCommand("""
                    INSERT INTO app.registration_value
                        (registration_id, field_id, value_sealed, wrapped_key, seat_key_sealed)
                    VALUES (@reg, @field, @value, @wrapped, @seat);
                    """, connection, tx);

                add.Parameters.AddWithValue("@reg", id);
                add.Parameters.AddWithValue("@field", fieldId);
                add.Parameters.AddBlob("@value", sealedValue);
                add.Parameters.AddBlob("@wrapped", wrapped);
                add.Parameters.AddBlob("@seat", forSeat);

                await add.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number == 547)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "To pytanie już nie należy do tego formularza.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            registrationId = Ids.ToText(id),
            revised = parsed.Count
        });
    }

    public sealed record ArmRequest(string FieldId, string TokenSha256, int? Days);

    /// <summary>
    /// Eine Bestaetigung scharfstellen — die Kanzlei verschickt sie selbst.
    ///
    /// <para>
    /// <b>Der Dienst erfaehrt die Nummer nicht.</b> Er bekommt den ABDRUCK
    /// eines Geheimnisses und die Stelle, um die es geht: diese Einsendung,
    /// dieses Feld. Welche Nummer dort steht, weiss er so wenig wie vorher.
    /// </para>
    ///
    /// <para>
    /// <b>Eine offene Bestaetigung ersetzt die vorige.</b> Wer den Link zweimal
    /// verschickt, hat nicht zwei Bestaetigungen offen, sondern eine neue — und
    /// die alte soll dann nicht mehr gelten.
    /// </para>
    /// </summary>
    private static async Task ArmCheckAsync(HttpContext ctx, Db db, Guid id, ArmRequest body)
    {
        if (!Guid.TryParse(body.FieldId, out var fieldId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung pola.");
            return;
        }

        var hash = Optional(body.TokenSha256);
        if (hash is null || hash.Length != 32)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Odcisk linku musi mieć 32 bajty.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await MayTendAsync(ctx, db, connection, id)) return;

        var now = DateTimeOffset.UtcNow;
        var until = now.AddDays(body.Days is > 0 and <= 90 ? body.Days.Value : 14);

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        try
        {
            /* Die vorige, noch offene, faellt weg — siehe oben. */
            await using (var drop = new SqlCommand("""
                DELETE FROM app.value_check
                 WHERE registration_id = @reg AND field_id = @field AND verified_at IS NULL;
                """, connection, tx))
            {
                drop.Parameters.AddWithValue("@reg", id);
                drop.Parameters.AddWithValue("@field", fieldId);
                await drop.ExecuteNonQueryAsync(ctx.RequestAborted);
            }

            await using var insert = new SqlCommand("""
                INSERT INTO app.value_check
                    (id, registration_id, field_id, token_sha256, sent_at, expires_at)
                VALUES (@id, @reg, @field, @token, @now, @until);
                """, connection, tx);

            insert.Parameters.AddWithValue("@id", Ids.NewId());
            insert.Parameters.AddWithValue("@reg", id);
            insert.Parameters.AddWithValue("@field", fieldId);
            insert.Parameters.AddBlob("@token", hash);
            insert.Parameters.AddWithValue("@now", now);
            insert.Parameters.AddWithValue("@until", until);

            await insert.ExecuteNonQueryAsync(ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten link już istnieje.");
            return;
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            registrationId = Ids.ToText(id),
            fieldId = Ids.ToText(fieldId),
            expiresAt = until
        });
    }

    /// <summary>
    /// Den Link einloesen — ohne Konto, ohne Platz.
    ///
    /// <para>
    /// <b>Der Link IST der Beweis.</b> Wer ihn hat, war unter der Nummer
    /// erreichbar, an die er geschickt wurde. Der Dienst weiss weiterhin nicht,
    /// welche Nummer das war — er setzt nur einen Zeitstempel an die Stelle.
    /// </para>
    ///
    /// <para>
    /// <b>Zweimal klicken bestaetigt nicht zweimal</b>, und es ist auch kein
    /// Fehler: wer auf denselben Link noch einmal tippt, soll dasselbe sehen
    /// wie beim ersten Mal und nicht eine Absage.
    /// </para>
    /// </summary>
    private static async Task VerifyAsync(HttpContext ctx, Db db, string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Tego linku nie ma.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        var hash = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(token.Trim()));

        DateTimeOffset? already;
        DateTimeOffset until;

        await using (var find = new SqlCommand(
            "SELECT verified_at, expires_at FROM app.value_check WHERE token_sha256 = @t;", connection))
        {
            find.Parameters.AddBlob("@t", hash);

            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (!await reader.ReadAsync(ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Tego linku nie ma.");
                return;
            }

            already = reader.IsDBNull(0) ? null : reader.GetDateTimeOffset(0);
            until = reader.GetDateTimeOffset(1);
        }

        if (already is not null)
        {
            await ctx.Response.WriteAsJsonAsync(new { verified = true, at = already, again = true });
            return;
        }

        if (until <= DateTimeOffset.UtcNow)
        {
            await Fail(ctx, StatusCodes.Status410Gone,
                "Ten link już wygasł. Poproś kancelarię o nowy.");
            return;
        }

        var now = DateTimeOffset.UtcNow;

        await using (var mark = new SqlCommand("""
            UPDATE app.value_check SET verified_at = @now
             WHERE token_sha256 = @t AND verified_at IS NULL;
            """, connection))
        {
            mark.Parameters.AddWithValue("@now", now);
            mark.Parameters.AddBlob("@t", hash);

            await mark.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await ctx.Response.WriteAsJsonAsync(new { verified = true, at = now, again = false });
    }

    /// <summary>
    /// Darf dieser Mensch an DIESER Einsendung etwas aendern?
    ///
    /// <para>
    /// <b>Schreiben, nicht lesen.</b> Zum Ansehen genuegt Lesen am Bereich —
    /// zum Wegraeumen oder Loeschen nicht. Wer etwas fortnimmt, aendert den
    /// Bestand, und dafuer gilt dieselbe Schwelle wie fuers Aufstellen der
    /// Fragen.
    /// </para>
    ///
    /// <para>
    /// Antwortet selbst, wenn es nicht geht — der Aufrufer sieht nur noch den
    /// Rueckgabewert an.
    /// </para>
    /// </summary>
    private static async Task<bool> MayTendAsync(
        HttpContext ctx, Db db, SqlConnection connection, Guid registrationId)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return false; }

        Guid partId;

        await using (var cmd = new SqlCommand(
            "SELECT part_id FROM app.registration WHERE id = @id;", connection))
        {
            cmd.Parameters.AddWithValue("@id", registrationId);

            if (await cmd.ExecuteScalarAsync(ctx.RequestAborted) is not Guid found)
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiego zgłoszenia nie ma.");
                return false;
            }

            partId = found;
        }

        var path = await PathOfPartAsync(connection, partId, ctx.RequestAborted);
        if (path is null)
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego bloku nie ma.");
            return false;
        }

        var grip = await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);
        if (grip.MayWrite) return true;

        var fields = await ReadFieldsAsync(connection, partId, ctx.RequestAborted);

        foreach (var areaId in fields.Select(f => f.AreaId).Distinct())
        {
            if (await Area.MayAsync(connection, who.Value.AccountId, areaId,
                    Capability.Write, ctx.RequestAborted))
            {
                return true;
            }
        }

        await Fail(ctx, StatusCodes.Status403Forbidden,
            "Do tego zgłoszenia nie masz prawa zapisu — ani przez adres, ani przez obszar.");
        return false;
    }

    /// <summary>
    /// Eine Ebene hoeher — oder der Pfad selbst, wenn er schon oben steht.
    ///
    /// <para>
    /// Eine oberste Adresse hat kein Darueber: <c>parish</c> bliebe sonst
    /// <c>""</c>, und das ist die Wurzel, die niemandem gehoert.
    /// </para>
    /// </summary>
    private static string Above(string path)
    {
        var cut = path.LastIndexOf('/');
        return cut <= 0 ? path : path[..cut];
    }

    private static async Task<Guid?> SlugIdAsync(
        SqlConnection connection, string path, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(
            "SELECT id FROM app.slug WHERE path = @p;", connection);

        cmd.Parameters.AddWithValue("@p", path);
        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    private static async Task<string?> PathOfPartAsync(
        SqlConnection connection, Guid partId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT s.path
            FROM app.slug_part p
            JOIN app.slug s ON s.id = p.slug_id
            WHERE p.id = @id;
            """, connection);

        cmd.Parameters.AddWithValue("@id", partId);
        return await cmd.ExecuteScalarAsync(ct) as string;
    }

    private static byte[]? Optional(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        try { return Base64Url.Decode(text); }
        catch (FormatException) { return null; }
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
