using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 0132 — DIE WERTE EINES TERMINS NACH SEINEM SCHEMA.
///
/// <para>
/// <b>Der Dienst kennt das Schema nicht</b> (es liegt versiegelt in
/// <c>app.calendar_doc</c>). Er legt ab, was der Browser schickt: je Feld eine
/// Hülle unter einem Bereich, in dem der Schreibende schreiben darf — oder,
/// wo das Schema ein Feld offen nennt, Beschriftung und Wert im Klartext. Nur
/// diese offenen Werte gehen an den Aushang, die Gablota und den Druck.
/// </para>
///
/// <para>
/// <b>Am Termin oder an einem Vorkommen</b>: <c>occurrence_at</c> NULL gilt für
/// die ganze Reihe (der Obchód einer einzelnen Messe aus einem Plan), sonst für
/// diesen einen Tag einer Reihe.
/// </para>
/// </summary>
public static partial class Calendar
{
    /// <summary>Ein Wert, wie der Browser ihn schickt — am Termin, an einem Vorkommen oder an einem Eintrag.</summary>
    public sealed record ValueIn(string? Field, string? AreaId, int? Epoch, string? Sealed, string? Label, string? Value);

    /// <summary>Ein geprüfter Wert. <c>Blob</c> und <c>Value</c> beide <c>null</c>: dieses Feld löschen (nur, wo es erlaubt ist).</summary>
    public sealed record ValueRow(string Field, Guid? AreaId, int? Epoch, byte[]? Blob, string? Label, string? Value)
    {
        public bool Empty => Blob is null && Value is null;
    }

    public const int MaxItemValues = 100;
    public const int MaxRecordValues = 50;
    public const int MaxValueLabel = 120;
    public const int MaxValueText = 400;
    public const int MaxSealedValue = 64 * 1024;
    public const int MaxOrigin = 200;

    /// <summary>Ein Schlüssel eines Feldes oder einer Liste: <c>[a-z0-9_.-]{1,64}</c> — wie im Browser (`scheme.ts`).</summary>
    public static bool ValidKey(string? key) =>
        key is { Length: >= 1 and <= 64 } && key.All(c => c is >= 'a' and <= 'z' or >= '0' and <= '9' or '_' or '.' or '-');

    /// <summary>
    /// Werte prüfen, wie sie hereinkommen. <paramref name="labels"/>: ob eine offene
    /// Beschriftung mitkommen darf (am Termin ja, am Eintrag nein);
    /// <paramref name="sealedAllowed"/>: von aussen nur offene Felder;
    /// <paramref name="allowEmpty"/>: ein Feld ohne Wert heisst „löschen" (beim Ändern eines Eintrags).
    /// </summary>
    public static bool ParseValues(
        IReadOnlyList<ValueIn>? given, int max, bool labels, bool sealedAllowed, bool allowEmpty,
        out List<ValueRow> rows, out string error)
    {
        rows = [];
        error = string.Empty;
        if (given is null) return true;

        if (given.Count > max)
        {
            error = $"Za dużo pól (najwyżej {max}).";
            return false;
        }

        foreach (var one in given)
        {
            var key = (one.Field ?? string.Empty).Trim();
            var shown = key.Length > 40 ? key[..40] : key;

            if (!ValidKey(key))
            {
                error = $"Nieczytelny klucz pola „{shown}”.";
                return false;
            }

            byte[]? blob = null;
            Guid? area = null;
            int? epoch = null;

            if (!string.IsNullOrEmpty(one.Sealed))
            {
                if (!sealedAllowed)
                {
                    error = "Z zewnątrz można podać tylko jawne pola.";
                    return false;
                }

                try { blob = Base64Url.Decode(one.Sealed); }
                catch (FormatException)
                {
                    error = "Nieczytelna zapieczętowana treść.";
                    return false;
                }

                if (blob.Length == 0)
                {
                    error = "Puste pole nie jest zapieczętowane.";
                    return false;
                }

                if (blob.Length > MaxSealedValue)
                {
                    error = $"Pole „{shown}” jest za duże.";
                    return false;
                }

                if (!Guid.TryParse(one.AreaId, out var parsedArea) || one.Epoch is null or < 1)
                {
                    error = "Nieczytelny obszar albo epoka pola.";
                    return false;
                }

                area = parsedArea;
                epoch = one.Epoch;
            }

            var value = string.IsNullOrWhiteSpace(one.Value) ? null : one.Value.Trim();
            if (value is { Length: > MaxValueText })
            {
                error = $"Wartość pola „{shown}” jest za długa.";
                return false;
            }

            var label = !labels || string.IsNullOrWhiteSpace(one.Label) ? null : one.Label.Trim();
            if (label is { Length: > MaxValueLabel })
            {
                error = $"Opis pola „{shown}” jest za długi.";
                return false;
            }

            if (blob is null && value is null && !allowEmpty)
            {
                error = $"Pole „{shown}” nie ma wartości.";
                return false;
            }

            rows.Add(new ValueRow(key, area, epoch, blob, label, value));
        }

        if (rows.Select(r => r.Field).Distinct().Count() != rows.Count)
        {
            error = "To samo pole dwa razy.";
            return false;
        }

        return true;
    }

    /// <summary>
    /// Woher ein aus einem Plan angelegter Termin stammt: <c>&lt;Plan&gt;|&lt;Messe&gt;|&lt;JJJJ-MM-TT&gt;</c>.
    /// Nur die Vorschau des Plans liest es („schon geplant") — es ändert nie etwas.
    /// </summary>
    public static bool ValidOrigin(string? text)
    {
        if (string.IsNullOrEmpty(text)) return true;
        if (text.Length > MaxOrigin) return false;

        var parts = text.Split('|');
        return parts.Length == 3
            && Guid.TryParse(parts[0], out _)
            && parts[1] is { Length: >= 1 and <= 64 }
            && parts[1].All(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '.' or '-')
            && DateOnly.TryParseExact(parts[2], "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out _);
    }

    /// <summary>Die Werte am TERMIN ersetzen (alle mit <c>occurrence_at</c> NULL) — in der Transaktion dessen, der speichert.</summary>
    internal static async Task ReplaceItemValuesAsync(
        SqlConnection connection, SqlTransaction tx, Guid itemId, DateTimeOffset? at, List<ValueRow> values,
        DateTimeOffset now, CancellationToken ct)
    {
        await using (var clear = new SqlCommand(at is null
            ? "DELETE FROM app.calendar_value WHERE item_id = @item AND occurrence_at IS NULL;"
            : "DELETE FROM app.calendar_value WHERE item_id = @item AND occurrence_at = @at;", connection, tx))
        {
            clear.Parameters.AddWithValue("@item", itemId);
            if (at is not null) clear.Parameters.AddWithValue("@at", at.Value);
            await clear.ExecuteNonQueryAsync(ct);
        }

        foreach (var v in values)
        {
            await using var add = new SqlCommand("""
                INSERT INTO app.calendar_value
                    (id, item_id, occurrence_at, field_key, area_id, epoch, sealed, public_label, public_value, updated_at)
                VALUES (@id, @item, @at, @field, @area, @epoch, @blob, @label, @value, @now);
                """, connection, tx);
            add.Parameters.AddWithValue("@id", Ids.NewId());
            add.Parameters.AddWithValue("@item", itemId);
            add.Parameters.AddWithValue("@at", (object?)at ?? DBNull.Value);
            add.Parameters.AddWithValue("@field", v.Field);
            add.Parameters.AddWithValue("@area", v.Blob is null ? DBNull.Value : (object)v.AreaId!.Value);
            add.Parameters.AddWithValue("@epoch", v.Blob is null ? DBNull.Value : (object)v.Epoch!.Value);
            add.Parameters.Add("@blob", System.Data.SqlDbType.VarBinary, -1).Value = (object?)v.Blob ?? DBNull.Value;
            add.Parameters.AddWithValue("@label", v.Value is null ? DBNull.Value : (object?)v.Label ?? DBNull.Value);
            add.Parameters.AddWithValue("@value", (object?)v.Value ?? DBNull.Value);
            add.Parameters.AddWithValue("@now", now);
            await add.ExecuteNonQueryAsync(ct);
        }
    }

    /// <summary>
    /// Darf man unter JEDEN Bereich schreiben, den ein versiegelter Wert nennt?
    /// Dieselbe Regel wie für die Felder eines Termins.
    /// </summary>
    internal static async Task<bool> MayAllValuesAsync(
        SqlConnection connection, Caller caller, IEnumerable<ValueRow> values, CancellationToken ct)
    {
        foreach (var area in values.Where(v => v.Blob is not null).Select(v => v.AreaId!.Value).Distinct())
        {
            if (!await Area.MayAsync(connection, caller, area, Capability.Write, ct)) return false;
        }

        return true;
    }

    /// <summary>
    /// Gehört dieses Schema zu diesem Kalender? <c>""</c> heisst „das universelle"
    /// (NULL). <c>null</c> zurück: abgelehnt, die Antwort ist geschrieben.
    /// </summary>
    internal static async Task<(bool Ok, Guid? Scheme)> SchemeOfAsync(
        HttpContext ctx, SqlConnection connection, Guid calendarId, string text, CancellationToken ct, SqlTransaction? tx = null)
    {
        if (text.Trim() == "") return (true, null);

        if (Guid.TryParse(text, out var scheme))
        {
            await using var find = new SqlCommand(
                "SELECT 1 FROM app.calendar_doc WHERE id = @id AND calendar_id = @cal AND kind = N'scheme';", connection, tx);
            find.Parameters.AddWithValue("@id", scheme);
            find.Parameters.AddWithValue("@cal", calendarId);
            if (await find.ExecuteScalarAsync(ct) is not null) return (true, scheme);
        }

        await Fail(ctx, StatusCodes.Status400BadRequest, "Taki schemat nie należy do tego kalendarza.");
        return (false, null);
    }

    /* -- Die Werte eines einzelnen Vorkommens ------------------------------------------- */

    public sealed record DayValuesRequest(string? OccurrenceAt, IReadOnlyList<ValueIn>? Values);

    /// <summary>
    /// Die Werte EINES Vorkommens einer Reihe ersetzen (eine leere Liste räumt sie ab).
    /// Wer im Kalender schreibt; das Vorkommen muss stattfinden.
    /// </summary>
    private static async Task DayValuesAsync(HttpContext ctx, Db db, Guid id, DayValuesRequest body)
    {
        var caller = await Callers.OfAsync(ctx, db);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!DateTimeOffset.TryParse(body.OccurrenceAt, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out var at))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin.");
            return;
        }

        if (!ParseValues(body.Values ?? [], MaxItemValues, labels: true, sealedAllowed: true, allowEmpty: false,
                out var values, out var error))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, error);
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);

        if (!await Schema.RecordsAsync(connection, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status503ServiceUnavailable, NeedsMigration);
            return;
        }

        var area = await AreaOfItemAsync(connection, id, ctx.RequestAborted);
        if (area is null || !await Area.MayAsync(connection, caller, area.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego terminu nie ma — albo nie możesz go zmieniać.");
            return;
        }

        if (!await MayAllValuesAsync(connection, caller, values, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "Pod obszar, w którym nie możesz pisać, nic nie schowasz.");
            return;
        }

        if (!await TakesPlaceAsync(connection, id, at, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, NotInPlan);
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        try
        {
            await ReplaceItemValuesAsync(connection, tx, id, at, values, DateTimeOffset.UtcNow, ctx.RequestAborted);
            await tx.CommitAsync(ctx.RequestAborted);
        }
        catch
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            throw;
        }

        await ctx.Response.WriteAsJsonAsync(new { itemId = Ids.ToText(id), values = values.Count });
    }

    /* -- Lesen -------------------------------------------------------------------------------- */

    /// <summary>Ein abgelegter Wert, wie er hinausgeht.</summary>
    internal sealed record ValueHeld(
        DateTimeOffset? At, string Field, Guid? AreaId, int? Epoch, byte[]? Blob, string? Label, string? Value);

    /// <summary>
    /// Die Werte dieser Termine: alle am Termin und die an Vorkommen im Fenster.
    /// <paramref name="publicOnly"/>: nur die offenen (der Aushang). Vor 0132: keine.
    /// </summary>
    internal static async Task<Dictionary<Guid, List<ValueHeld>>> ValuesAsync(
        SqlConnection connection, IReadOnlyList<Guid> itemIds, DateTimeOffset? from, DateTimeOffset? to,
        CancellationToken ct, bool publicOnly = false)
    {
        var map = new Dictionary<Guid, List<ValueHeld>>();
        if (itemIds.Count == 0 || !await Schema.RecordsAsync(connection, ct)) return map;

        var names = string.Join(", ", itemIds.Select((_, i) => $"@i{i}"));
        var window = from is null || to is null ? "" : "AND (occurrence_at IS NULL OR occurrence_at BETWEEN @from AND @to)";

        await using var cmd = new SqlCommand($"""
            SELECT item_id, occurrence_at, field_key, area_id, epoch, sealed, public_label, public_value
            FROM app.calendar_value
            WHERE item_id IN ({names}) {window} {(publicOnly ? "AND public_value IS NOT NULL" : "")}
            ORDER BY item_id, occurrence_at, field_key;
            """, connection);

        for (var i = 0; i < itemIds.Count; i++) cmd.Parameters.AddWithValue($"@i{i}", itemIds[i]);
        if (from is not null && to is not null)
        {
            cmd.Parameters.AddWithValue("@from", from.Value);
            cmd.Parameters.AddWithValue("@to", to.Value);
        }

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var item = reader.GetGuid(0);
            if (!map.TryGetValue(item, out var list)) map[item] = list = [];

            list.Add(new ValueHeld(
                reader.IsDBNull(1) ? null : reader.GetDateTimeOffset(1),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetGuid(3),
                reader.IsDBNull(4) ? null : reader.GetInt32(4),
                reader.IsDBNull(5) ? null : (byte[])reader[5],
                reader.IsDBNull(6) ? null : reader.GetString(6),
                reader.IsDBNull(7) ? null : reader.GetString(7)));
        }

        return map;
    }

    /// <summary>
    /// Was an EINEM Vorkommen gilt: die Werte am Termin und die dieses Tages
    /// (<paramref name="at"/> <c>null</c>: nur die am Termin) — so, wie sie hinausgehen.
    /// </summary>
    internal static IEnumerable<object> ValuesAt(Dictionary<Guid, List<ValueHeld>> map, Guid itemId, DateTimeOffset? at) =>
        !map.TryGetValue(itemId, out var list)
            ? []
            : list.Where(v => v.At is null || (at is not null && v.At.Value == at.Value))
                .Select(v => (object)new
                {
                    field = v.Field,
                    occurrenceAt = v.At,
                    areaId = v.AreaId is null ? null : Ids.ToText(v.AreaId.Value),
                    epoch = v.Epoch,
                    @sealed = v.Blob is null ? null : Base64Url.Encode(v.Blob),
                    label = v.Label,
                    value = v.Value
                });

    /// <summary>Für den Aushang: nur Beschriftung und Wert — die offenen Werte am Termin und an diesem Vorkommen.</summary>
    internal static IEnumerable<object> PublicValuesAt(Dictionary<Guid, List<ValueHeld>> map, Guid itemId, DateTimeOffset at) =>
        !map.TryGetValue(itemId, out var list)
            ? []
            : list.Where(v => v.Value is not null && (v.At is null || v.At.Value == at))
                /* Ein Wert des Tages ersetzt den des Termins für dasselbe Feld. */
                .GroupBy(v => v.Field)
                .Select(g => g.OrderBy(v => v.At is null ? 1 : 0).First())
                .Select(v => (object)new { field = v.Field, label = v.Label, value = v.Value });
}
