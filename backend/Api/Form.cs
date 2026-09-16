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

        var grip = await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);
        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego adresu nie prowadzisz.");
            return;
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

    public sealed record SubmitRequest(
        IReadOnlyList<ValueIn> Values, string? ClaimSha256, string? SeatToken, string? RoleId);

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
            seatId = seatId is null ? null : Ids.ToText(seatId.Value)
        });
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

        var grip = await Access.OfAsync(connection, who.Value.AccountId, path, ctx.RequestAborted);
        if (!grip.MayWrite)
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Tego adresu nie prowadzisz.");
            return;
        }

        var rows = new List<(Guid Id, Guid? Seat, DateTimeOffset At, DateTimeOffset? Gone)>();

        await using (var cmd = new SqlCommand("""
            SELECT id, access_id, submitted_at, withdrawn_at
            FROM app.registration
            WHERE part_id = @part AND is_hidden = 0
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
                    reader.IsDBNull(3) ? null : reader.GetDateTimeOffset(3)));
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
                if (!byRegistration.TryGetValue(key, out var list)) byRegistration[key] = list = [];

                list.Add(new
                {
                    fieldId = Ids.ToText(reader.GetGuid(1)),
                    @sealed = Base64Url.Encode((byte[])reader[2]),

                    /* Verpackt unter der oeffentlichen Haelfte — zu oeffnen mit
                       dem privaten Annahmeschluessel, den nur das Amt hat. */
                    wrappedKey = Base64Url.Encode((byte[])reader[3])
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
                values = byRegistration.TryGetValue(r.Id, out var list) ? list : []
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

    /// <summary>Die Adresse, auf der dieser Baustein steht — fuer die Rechtefrage.</summary>
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
