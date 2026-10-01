using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// ADRESY (0071) — eine Adresse aus Teilen, ein Verzeichnis je Gebiet, die
/// Haushalte darin (Kolęda).
///
/// <para>
/// <b>Normalisiert wird HIER</b> (<see cref="Norm"/>), und der Browser rechnet
/// dieselbe Funktion nach (<c>postal.ts</c>, geprüft von
/// <c>app-postal-check.mjs</c> und <c>PostalChecks.cs</c> mit derselben
/// Tabelle). Laufen beide auseinander, fände die Suche im Browser eine
/// Straße, die der Dienst als neue anlegt.
/// </para>
///
/// <para>
/// <b>Klartext und Hülle.</b> Teile und Orte liegen offen (ein Stadtplan sagt
/// nichts über Menschen); was über die Menschen dort gesagt wird — der
/// Haushalt —, liegt als EINE Hülle unter dem Schlüssel des Bereichs.
/// </para>
/// </summary>
public static partial class Postal
{
    public static readonly string[] Kinds = ["postcode", "post", "locality", "district", "street"];

    private const int MaxName = 200;
    private const int MaxHouse = 16;
    private const int MaxBatch = 2000;
    private const int MaxPlaces = 100_000;
    private const long MaxDoc = 256 * 1024;

    public static void Map(WebApplication app)
    {
        /* Ohne Konto: Straßen, Orte, Postleitzahlen zum Vorschlagen — Namen, keine Menschen. */
        app.MapGet("/addresses/parts", PartsAsync);

        app.MapGet("/workspace/area/{id:guid}/addresses", RegistryAsync);
        app.MapPost("/workspace/area/{id:guid}/addresses", SavePlacesAsync);
        app.MapPost("/workspace/address/{id:guid}/delete", DeletePlaceAsync);

        app.MapPut("/workspace/household/{id:guid}", SaveHouseholdAsync);
        app.MapPost("/workspace/household/{id:guid}/delete", DeleteHouseholdAsync);
    }

    /* ======================================================================
       NORMALISIEREN
       ====================================================================== */

    [GeneratedRegex(@"^(ul\.?|ulica|al\.?|aleja|aleje|pl\.?|plac|os\.?|osiedle|skwer|rondo|bulw\.?|bulwar)\s+", RegexOptions.IgnoreCase)]
    private static partial Regex StreetPrefix();

    [GeneratedRegex(@"^(ul\.?|ulica)\s+", RegexOptions.IgnoreCase)]
    private static partial Regex PlainStreetPrefix();

    [GeneratedRegex(@"^(\d{2})-?(\d{3})$")]
    private static partial Regex PostcodeShape();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();

    /// <summary>
    /// Die normalisierte Form eines Teils: klein, ohne Diakritika (ł → l),
    /// ohne Satzzeichen, Leerraum zusammengezogen; bei Straßen ohne
    /// „ul.", „al.", „pl.", „os.". Bei der Postleitzahl „NN-NNN".
    /// </summary>
    public static string Norm(string kind, string? text)
    {
        var raw = Spaces().Replace((text ?? "").Trim(), " ");
        if (raw.Length == 0) return "";

        if (kind == "postcode")
        {
            var m = PostcodeShape().Match(raw.Replace(" ", ""));
            return m.Success ? $"{m.Groups[1].Value}-{m.Groups[2].Value}" : "";
        }

        if (kind == "street") raw = StreetPrefix().Replace(raw, "");
        if (kind is "house" or "unit") return raw.Replace(" ", "").ToUpperInvariant();

        var folded = raw.ToLowerInvariant().Replace('ł', 'l').Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(folded.Length);
        foreach (var ch in folded)
        {
            var cat = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (cat == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(char.IsLetterOrDigit(ch) ? ch : ' ');
        }
        return Spaces().Replace(sb.ToString(), " ").Trim();
    }

    /// <summary>Wie ein Teil angezeigt wird: wie getippt, Leerraum zusammengezogen; „ul." fällt weg, die Straße ist die Regel.</summary>
    public static string Display(string kind, string? text)
    {
        var raw = Spaces().Replace((text ?? "").Trim(), " ");
        if (kind == "postcode") return Norm("postcode", raw);
        if (kind == "street") raw = PlainStreetPrefix().Replace(raw, "");
        if (kind is "house" or "unit") return raw.Replace(" ", "").ToUpperInvariant();
        return raw.Length > MaxName ? raw[..MaxName] : raw;
    }

    /// <summary>
    /// Was eine Adresse ohne Ort meint: den Ort ihrer Post. „ul. Długa 5,
    /// 31-147 Kraków" liegt in Kraków — ohne diese Regel wäre sie eine andere
    /// Adresse als „Długa 5, Kraków, 31-147 Kraków".
    /// </summary>
    public static PlaceIn Complete(PlaceIn place) =>
        string.IsNullOrWhiteSpace(place.Locality) && !string.IsNullOrWhiteSpace(place.Post)
            ? place with { Locality = place.Post }
            : place;

    /// <summary>Wonach in den Teilen gesucht wird: bei der Postleitzahl die Ziffern mit Bindestrich, sonst die Norm.</summary>
    public static string Prefix(string kind, string? text)
    {
        if (kind != "postcode") return Norm(kind, text);
        var digits = new string((text ?? "").Where(char.IsDigit).ToArray());
        return digits.Length > 2 ? $"{digits[..2]}-{digits[2..Math.Min(5, digits.Length)]}" : digits;
    }

    /// <summary>Die ganze Adresse normalisiert — dieselbe Adresse gibt es im Gebiet nur einmal.</summary>
    public static string Key(string? postcode, string? post, string? locality, string? district, string? street, string? house, string? unit) =>
        string.Join("|", Norm("postcode", postcode), Norm("post", post), Norm("locality", locality), Norm("district", district),
            Norm("street", street), Norm("house", house), Norm("unit", unit));

    /* ======================================================================
       TEILE
       ====================================================================== */

    private static async Task PartsAsync(HttpContext ctx, Db db, string? kind, string? q, Guid? parent, int? limit)
    {
        var k = (kind ?? "").Trim().ToLowerInvariant();
        if (!Kinds.Contains(k))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Rodzaj: postcode, post, locality, district albo street.");
            return;
        }

        var norm = Prefix(k, q);
        var take = Math.Clamp(limit ?? 12, 1, 50);

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        await using var cmd = new SqlCommand($"""
            SELECT TOP {take} id, kind, name, parent_id
            FROM app.address_part
            WHERE kind = @kind AND norm LIKE @prefix
              {(parent is null ? "" : "AND parent_id = @parent")}
            ORDER BY LEN(norm), norm;
            """, connection);
        cmd.Parameters.AddWithValue("@kind", k);
        cmd.Parameters.AddWithValue("@prefix", norm.Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]") + "%");
        if (parent is not null) cmd.Parameters.AddWithValue("@parent", parent.Value);

        var parts = new List<object>();
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        while (await reader.ReadAsync(ctx.RequestAborted))
        {
            parts.Add(new
            {
                partId = Ids.ToText(reader.GetGuid(0)),
                kind = reader.GetString(1),
                name = reader.GetString(2),
                parentId = reader.IsDBNull(3) ? null : Ids.ToText(reader.GetGuid(3))
            });
        }

        ctx.Response.Headers.CacheControl = "public, max-age=300";
        await ctx.Response.WriteAsJsonAsync(new { parts });
    }

    /// <summary>Einen Teil finden oder anlegen — gleiche Norm, gleicher Elternteil: derselbe Teil.</summary>
    private static async Task<Guid?> EnsurePartAsync(SqlConnection connection, SqlTransaction tx, string kind, string? text, Guid? parent, CancellationToken ct)
    {
        var norm = Norm(kind, text);
        if (norm.Length == 0) return null;
        var name = Display(kind, text);
        if (kind is not ("street" or "district")) parent = null;

        for (var attempt = 0; attempt < 2; attempt++)
        {
            await using (var find = new SqlCommand(
                "SELECT id FROM app.address_part WHERE kind = @kind AND norm = @norm AND ((@parent IS NULL AND parent_id IS NULL) OR parent_id = @parent);",
                connection, tx))
            {
                find.Parameters.AddWithValue("@kind", kind);
                find.Parameters.AddWithValue("@norm", norm);
                find.Parameters.Add("@parent", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)parent ?? DBNull.Value;
                if (await find.ExecuteScalarAsync(ct) is Guid found) return found;
            }

            var id = Ids.NewId();
            await using var insert = new SqlCommand("""
                INSERT INTO app.address_part (id, kind, name, norm, parent_id, created_at)
                VALUES (@id, @kind, @name, @norm, @parent, @now);
                """, connection, tx);
            insert.Parameters.AddWithValue("@id", id);
            insert.Parameters.AddWithValue("@kind", kind);
            insert.Parameters.AddWithValue("@name", name);
            insert.Parameters.AddWithValue("@norm", norm);
            insert.Parameters.Add("@parent", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)parent ?? DBNull.Value;
            insert.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            try
            {
                await insert.ExecuteNonQueryAsync(ct);
                return id;
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                // Gleichzeitig angelegt — die nächste Runde findet ihn.
            }
        }

        return null;
    }

    /* ======================================================================
       DAS VERZEICHNIS EINES GEBIETS
       ====================================================================== */

    public sealed record PlaceIn(string? PlaceId, string? Postcode, string? Post, string? Locality, string? District,
        string? Street, string? House, string? Unit);

    public sealed record PlacesRequest(IReadOnlyList<PlaceIn>? Places);

    /// <summary>Was an einer Adresse nicht stimmt — oder <c>null</c>.</summary>
    public static string? Check(PlaceIn place)
    {
        foreach (var text in new[] { place.Post, place.Locality, place.District, place.Street })
            if ((text?.Trim().Length ?? 0) > MaxName) return $"Nazwa: najwyżej {MaxName} znaków.";
        if ((place.House?.Trim().Length ?? 0) > MaxHouse || (place.Unit?.Trim().Length ?? 0) > MaxHouse) return $"Numer: najwyżej {MaxHouse} znaków.";
        if (!string.IsNullOrWhiteSpace(place.Postcode) && Norm("postcode", place.Postcode).Length == 0) return "Kod pocztowy ma postać 00-000.";
        if (Key(place.Postcode, place.Post, place.Locality, place.District, place.Street, place.House, place.Unit).Replace("|", "").Length == 0)
            return "Pusty adres.";
        if (string.IsNullOrWhiteSpace(place.Locality) && string.IsNullOrWhiteSpace(place.Post) && string.IsNullOrWhiteSpace(place.Street))
            return "Adres potrzebuje miejscowości, poczty albo ulicy.";
        return null;
    }

    /// <summary>
    /// Das Verzeichnis: alle Orte des Gebiets mit ihren Teilen (offen) und alle
    /// Haushalte (versiegelt). <c>since</c>: nur, was sich seither geändert hat
    /// — der Browser hält das Verzeichnis ganz, wie die Bibliothek.
    /// </summary>
    private static async Task RegistryAsync(HttpContext ctx, Db db, Guid id, string? since)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        var hasSince = DateTimeOffset.TryParse(since, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var from);
        var now = DateTimeOffset.UtcNow;

        var places = new List<object>();
        var partIds = new HashSet<Guid>();
        await using (var cmd = new SqlCommand($"""
            SELECT id, postcode_id, post_id, locality_id, district_id, street_id, house, unit, norm_key, updated_at, deleted_at
            FROM app.address_place
            WHERE area_id = @area {(hasSince ? "AND updated_at > @since" : "AND deleted_at IS NULL")};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            if (hasSince) cmd.Parameters.AddWithValue("@since", from);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                Guid? Part(int i) { if (reader.IsDBNull(i)) return null; var g = reader.GetGuid(i); partIds.Add(g); return g; }
                string? T(Guid? g) => g is null ? null : Ids.ToText(g.Value);
                var postcode = Part(1); var post = Part(2); var locality = Part(3); var district = Part(4); var street = Part(5);
                places.Add(new
                {
                    placeId = Ids.ToText(reader.GetGuid(0)),
                    postcodeId = T(postcode), postId = T(post), localityId = T(locality), districtId = T(district), streetId = T(street),
                    house = reader.IsDBNull(6) ? null : reader.GetString(6),
                    unit = reader.IsDBNull(7) ? null : reader.GetString(7),
                    key = reader.GetString(8),
                    updatedAt = reader.GetDateTimeOffset(9),
                    deleted = !reader.IsDBNull(10)
                });
            }
        }

        var parts = new List<object>();
        if (partIds.Count > 0)
        {
            foreach (var chunk in partIds.Chunk(1000))
            {
                var names = string.Join(", ", chunk.Select((_, i) => $"@p{i}"));
                await using var cmd = new SqlCommand($"SELECT id, kind, name, norm, parent_id FROM app.address_part WHERE id IN ({names});", connection);
                for (var i = 0; i < chunk.Length; i++) cmd.Parameters.AddWithValue($"@p{i}", chunk[i]);
                await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted))
                {
                    parts.Add(new
                    {
                        partId = Ids.ToText(reader.GetGuid(0)),
                        kind = reader.GetString(1),
                        name = reader.GetString(2),
                        norm = reader.GetString(3),
                        parentId = reader.IsDBNull(4) ? null : Ids.ToText(reader.GetGuid(4))
                    });
                }
            }
        }

        var households = new List<object>();
        await using (var cmd = new SqlCommand($"""
            SELECT id, place_id, epoch, doc_sealed, version, updated_at, deleted_at
            FROM app.household
            WHERE area_id = @area {(hasSince ? "AND updated_at > @since" : "AND deleted_at IS NULL")};
            """, connection))
        {
            cmd.Parameters.AddWithValue("@area", id);
            if (hasSince) cmd.Parameters.AddWithValue("@since", from);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                var deleted = !reader.IsDBNull(6);
                households.Add(new
                {
                    householdId = Ids.ToText(reader.GetGuid(0)),
                    placeId = reader.IsDBNull(1) ? null : Ids.ToText(reader.GetGuid(1)),
                    epoch = reader.GetInt32(2),
                    docSealed = deleted ? null : Base64Url.Encode((byte[])reader[3]),
                    version = reader.GetInt32(4),
                    updatedAt = reader.GetDateTimeOffset(5),
                    deleted
                });
            }
        }

        await ctx.Response.WriteAsJsonAsync(new
        {
            areaId = Ids.ToText(id),
            asOf = now,
            mayWrite = await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Write, ctx.RequestAborted),
            parts,
            places,
            households
        });
    }

    /// <summary>
    /// ORTE ANLEGEN ODER ÄNDERN — viele auf einmal (eine eingefügte Liste, eine
    /// Straße mit allen Hausnummern). Dieselbe Adresse zweimal ergibt EINEN Ort:
    /// zurück kommt dessen Kennung.
    /// </summary>
    private static async Task SavePlacesAsync(HttpContext ctx, Db db, Guid id, PlacesRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var places = body.Places ?? [];
        if (places.Count is 0 or > MaxBatch)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Od jednego do {MaxBatch} adresów naraz.");
            return;
        }

        for (var i = 0; i < places.Count; i++)
        {
            var wrong = Check(places[i]);
            if (wrong is not null) { await Fail(ctx, StatusCodes.Status400BadRequest, $"Adres {i + 1}: {wrong}"); return; }
            if (places[i].PlaceId is not null && !Guid.TryParse(places[i].PlaceId, out _))
            {
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Adres {i + 1}: nieczytelna kennung.");
                return;
            }
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await Area.MayAsync(connection, who.Value.AccountId, id, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W tym obszarze nie możesz zmieniać adresów.");
            return;
        }

        await using (var count = new SqlCommand("SELECT COUNT(*) FROM app.address_place WHERE area_id = @area AND deleted_at IS NULL;", connection))
        {
            count.Parameters.AddWithValue("@area", id);
            if ((int)(await count.ExecuteScalarAsync(ctx.RequestAborted))! + places.Count > MaxPlaces)
            {
                await Fail(ctx, StatusCodes.Status409Conflict, $"Rejestr może mieć najwyżej {MaxPlaces} adresów.");
                return;
            }
        }

        var saved = new List<object>();
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            var now = DateTimeOffset.UtcNow;
            foreach (var given in places)
            {
                var place = Complete(given);
                var ct = ctx.RequestAborted;
                var locality = await EnsurePartAsync(connection, tx, "locality", place.Locality, null, ct);
                var post = await EnsurePartAsync(connection, tx, "post", place.Post, null, ct);
                var postcode = await EnsurePartAsync(connection, tx, "postcode", place.Postcode, null, ct);
                var district = await EnsurePartAsync(connection, tx, "district", place.District, locality, ct);
                var street = await EnsurePartAsync(connection, tx, "street", place.Street, locality ?? post, ct);
                var key = Key(place.Postcode, place.Post, place.Locality, place.District, place.Street, place.House, place.Unit);
                var house = Display("house", place.House);
                var unit = Display("unit", place.Unit);

                Guid placeId;
                var wanted = place.PlaceId is null ? (Guid?)null : Guid.Parse(place.PlaceId);

                /* Gibt es diese Adresse schon (unter anderer Kennung)? Dann ist es dieser Ort. */
                await using (var find = new SqlCommand(
                    "SELECT id FROM app.address_place WHERE area_id = @area AND norm_key = @key AND deleted_at IS NULL;", connection, tx))
                {
                    find.Parameters.AddWithValue("@area", id);
                    find.Parameters.AddWithValue("@key", key);
                    var existing = await find.ExecuteScalarAsync(ct) as Guid?;

                    if (existing is not null && existing != wanted)
                    {
                        saved.Add(new { placeId = Ids.ToText(existing.Value), key, merged = true });
                        continue;
                    }
                }

                placeId = wanted ?? Ids.NewId();
                await using var upsert = new SqlCommand("""
                    UPDATE app.address_place
                       SET postcode_id = @postcode, post_id = @post, locality_id = @locality, district_id = @district,
                           street_id = @street, house = @house, unit = @unit, norm_key = @key, updated_at = @now, deleted_at = NULL
                     WHERE id = @id AND area_id = @area;
                    IF @@ROWCOUNT = 0
                        INSERT INTO app.address_place
                            (id, area_id, postcode_id, post_id, locality_id, district_id, street_id, house, unit, norm_key, created_at, updated_at)
                        VALUES (@id, @area, @postcode, @post, @locality, @district, @street, @house, @unit, @key, @now, @now);
                    """, connection, tx);
                upsert.Parameters.AddWithValue("@id", placeId);
                upsert.Parameters.AddWithValue("@area", id);
                foreach (var (name, value) in new[] { ("@postcode", postcode), ("@post", post), ("@locality", locality), ("@district", district), ("@street", street) })
                    upsert.Parameters.Add(name, System.Data.SqlDbType.UniqueIdentifier).Value = (object?)value ?? DBNull.Value;
                upsert.Parameters.AddWithValue("@house", house.Length == 0 ? DBNull.Value : house);
                upsert.Parameters.AddWithValue("@unit", unit.Length == 0 ? DBNull.Value : unit);
                upsert.Parameters.AddWithValue("@key", key);
                upsert.Parameters.AddWithValue("@now", now);
                await upsert.ExecuteNonQueryAsync(ct);

                saved.Add(new { placeId = Ids.ToText(placeId), key, merged = false });
            }

            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { places = saved });
    }

    private static async Task<Guid?> AreaOfAsync(SqlConnection connection, string table, Guid id, CancellationToken ct)
    {
        await using var cmd = new SqlCommand($"SELECT area_id FROM app.{table} WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    private static async Task DeletePlaceAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var area = await AreaOfAsync(connection, "address_place", id, ctx.RequestAborted);
        if (area is null || !await Area.MayAsync(connection, who.Value.AccountId, area.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego adresu nie ma.");
            return;
        }

        await using var cmd = new SqlCommand("UPDATE app.address_place SET deleted_at = @now, updated_at = @now WHERE id = @id AND deleted_at IS NULL;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { placeId = Ids.ToText(id), deleted = true });
    }

    /* ======================================================================
       HAUSHALTE
       ====================================================================== */

    public sealed record HouseholdRequest(string AreaId, string? PlaceId, int Epoch, string DocSealed, int? Version);

    /// <summary>
    /// EINEN HAUSHALT SPEICHERN — neu oder geändert. <c>version</c> ist die, von
    /// der der Browser ausging; ist inzwischen eine neuere da, kommt 409
    /// <c>stale</c> mit ihr zurück, statt sie zu überschreiben.
    /// </summary>
    private static async Task SaveHouseholdAsync(HttpContext ctx, Db db, Guid id, HouseholdRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.AreaId, out var areaId) || (body.PlaceId is not null && body.PlaceId.Length > 0 && !Guid.TryParse(body.PlaceId, out _)))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna kennung.");
            return;
        }

        if (!Base64Url.TryDecode(body.DocSealed, out var doc) || doc.Length is 0 or > (int)MaxDoc || body.Epoch < 1)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna albo za duża treść.");
            return;
        }

        Guid? placeId = string.IsNullOrWhiteSpace(body.PlaceId) ? null : Guid.Parse(body.PlaceId);

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await Area.MayAsync(connection, who.Value.AccountId, areaId, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "W tym obszarze nie możesz zapisywać.");
            return;
        }

        if (placeId is not null && await AreaOfAsync(connection, "address_place", placeId.Value, ctx.RequestAborted) != areaId)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Ten adres nie należy do tego rejestru.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ctx.RequestAborted);
        (Guid Area, int Version)? existing = null;
        await using (var find = new SqlCommand("SELECT area_id, version FROM app.household WITH (UPDLOCK) WHERE id = @id;", connection, tx))
        {
            find.Parameters.AddWithValue("@id", id);
            await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
            if (await reader.ReadAsync(ctx.RequestAborted)) existing = (reader.GetGuid(0), reader.GetInt32(1));
        }

        if (existing is not null && existing.Value.Area != areaId)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego domu nie ma.");
            return;
        }

        if (existing is not null && body.Version is not null && body.Version != existing.Value.Version)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            ctx.Response.StatusCode = StatusCodes.Status409Conflict;
            await ctx.Response.WriteAsJsonAsync(new { error = "Ktoś zmienił ten dom w międzyczasie.", verdict = "stale", version = existing.Value.Version });
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var version = (existing?.Version ?? 0) + 1;
        await using (var save = new SqlCommand(existing is null
            ? """
              INSERT INTO app.household (id, area_id, place_id, epoch, doc_sealed, version, created_at, updated_at)
              VALUES (@id, @area, @place, @epoch, @doc, @version, @now, @now);
              """
            : """
              UPDATE app.household SET place_id = @place, epoch = @epoch, doc_sealed = @doc, version = @version,
                                       updated_at = @now, deleted_at = NULL
               WHERE id = @id;
              """, connection, tx))
        {
            save.Parameters.AddWithValue("@id", id);
            save.Parameters.AddWithValue("@area", areaId);
            save.Parameters.Add("@place", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)placeId ?? DBNull.Value;
            save.Parameters.AddWithValue("@epoch", body.Epoch);
            save.Parameters.AddWithValue("@doc", doc);
            save.Parameters.AddWithValue("@version", version);
            save.Parameters.AddWithValue("@now", now);
            await save.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { householdId = Ids.ToText(id), version, updatedAt = now });
    }

    private static async Task DeleteHouseholdAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var area = await AreaOfAsync(connection, "household", id, ctx.RequestAborted);
        if (area is null || !await Area.MayAsync(connection, who.Value.AccountId, area.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego domu nie ma.");
            return;
        }

        /* Die Hülle geht, die Zeile bleibt als Grabstein — damit andere Browser beim Abgleich erfahren, dass er fort ist. */
        await using var cmd = new SqlCommand("""
            UPDATE app.household SET doc_sealed = 0x00, deleted_at = @now, updated_at = @now, version = version + 1
             WHERE id = @id AND deleted_at IS NULL;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);

        await ctx.Response.WriteAsJsonAsync(new { householdId = Ids.ToText(id), deleted = true });
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
