using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// Messintentionen — und der Aushang ueber ALLE Kalender hinweg.
///
/// <para>
/// <b>Diese Datei legt keine Messe mehr an.</b> Eine Messe IST ein
/// Kalendereintrag mit <c>kind = 'mass'</c>; angelegt wird sie ueber
/// <c>POST /workspace/calendar/{id}/item</c> wie eine Scholaprobe auch. Der
/// Altbestand sagt es so: „Msza to wpis kalendarza. Nie ma osobnej tabeli mszy
/// i nie powinno jej byc." 0018 wich davon ab, weil es keinen Kalender gab —
/// jetzt gibt es einen, und die Abweichung faellt mit 0020 fort.
/// </para>
///
/// <para>
/// Was hier bleibt, ist das, was NUR die Messe hat: die Intention. Sie haengt
/// am VORKOMMEN <c>(item_id, occurrence_at)</c> und nicht an der Reihe — am
/// Dienstag wird eine andere gelesen als am Mittwoch.
/// </para>
///
/// <para>
/// <b>Der Text steht im Klartext, Geber und Gabe nicht.</b> Eine Intention wird
/// in der Kirche vorgelesen und haengt im Schaukasten; sie zu versiegeln hiesse,
/// das Modul gegen seinen Zweck zu bauen. Wer sie gegeben hat und was er gegeben
/// hat, steht auf keinem Zettel an der Tuer — das liegt in
/// <c>app.mass_intention_field</c>, je Feld unter SEINEM Bereich.
/// </para>
///
/// <para>
/// <b>Der Aushang ist oeffentlich</b> und geht ueber alle Kalender: wer den
/// Messplan sucht, soll sich dafuer nicht anmelden muessen — und wir sollen
/// nicht erfahren, dass er geschaut hat. Sichtbar ist, was unter einem Bereich
/// mit offengelegter Epoche liegt; alles andere faellt gar nicht erst an.
/// </para>
/// </summary>
public static partial class Mass
{
    public const int MaxText = 400;

    /// <summary>Die Felder einer Intention, die versiegelt liegen duerfen — wie 0020.</summary>
    private static readonly string[] SealableFields = ["giver", "offering"];

    public static void Map(WebApplication app)
    {
        // Der Aushang — ohne Konto, ueber alle offengelegten Kalender.
        app.MapGet("/masses", PlanAsync);

        // Dasselbe mit Konto: mehr Bereiche, dazu Stand und Zelebrant.
        app.MapGet("/workspace/masses", OfficeAsync);

        app.MapPost("/workspace/mass/{id:guid}/intention", AddIntentionAsync);
        app.MapPost("/workspace/intention/{id:guid}", UpdateIntentionAsync);
        app.MapPost("/workspace/intention/{id:guid}/delete", DeleteIntentionAsync);
    }

/* -- Gemeinsames --------------------------------------------------------- */

    private sealed record Sealing(string Field, Guid AreaId, int Epoch, byte[] Blob);

    /// <summary>Die versiegelten Felder pruefen, wie sie hereinkommen.</summary>
    private static bool Sealed(
        IReadOnlyList<Calendar.SealedField>? given, out List<Sealing> found, out string complaint)
    {
        found = [];
        complaint = string.Empty;

        foreach (var one in given ?? [])
        {
            var name = (one.Field ?? string.Empty).Trim().ToLowerInvariant();

            if (!SealableFields.Contains(name))
            {
                complaint = "Zapieczętować można ofiarodawcę albo ofiarę.";
                return false;
            }

            if (!Guid.TryParse(one.AreaId, out var area) || one.Epoch < 1)
            {
                complaint = "Nieczytelny obszar albo epoka pola.";
                return false;
            }

            byte[] blob;
            try { blob = Base64Url.Decode(one.Sealed ?? string.Empty); }
            catch (FormatException)
            {
                complaint = "Nieczytelna zapieczętowana treść.";
                return false;
            }

            if (blob.Length == 0)
            {
                complaint = "Puste pole nie jest zapieczętowane.";
                return false;
            }

            found.Add(new Sealing(name, area, one.Epoch, blob));
        }

        if (found.Select(f => f.Field).Distinct().Count() != found.Count)
        {
            complaint = "To samo pole dwa razy.";
            return false;
        }

        return true;
    }

    /// <summary>
    /// Darf man unter JEDEN genannten Bereich schreiben?
    ///
    /// <para>
    /// Ohne diese Runde liesse sich eine Huelle unter einen fremden Bereich
    /// haengen: sie stuende dort, niemand koennte sie oeffnen, und der Fremde
    /// faende sie in seiner Epoche wieder, ohne je davon gehoert zu haben.
    /// </para>
    /// </summary>
    private static async Task<bool> MayAllAsync(
        SqlConnection connection, Caller caller, List<Sealing> fields, CancellationToken ct)
    {
        foreach (var areaId in fields.Select(f => f.AreaId).Distinct())
        {
            if (!await Area.MayAsync(connection, caller, areaId, Capability.Write, ct)) return false;
        }

        return true;
    }

    /// <summary>
    /// Die versiegelten Felder ablegen — ersetzend, nicht haeufend.
    ///
    /// <para>
    /// Ein zweiter Aufruf zu demselben Feld ersetzt den ersten: der Browser
    /// schickt eine Gabe, die er neu versiegelt hat, und nicht eine zweite Gabe.
    /// </para>
    /// </summary>
    private static async Task WriteFieldsAsync(
        SqlConnection connection, SqlTransaction tx, Guid intentionId,
        List<Sealing> fields, DateTimeOffset now, CancellationToken ct)
    {
        /*
         * 0132 — die Felder eines Eintrags (`occurrence_record_value`). Ihre AAD
         * bleibt die der Messintention: die Liste `intencje` und die Felder
         * `giver`/`offering` versiegelt der Browser immer so.
         */
        foreach (var (field, areaId, epoch, blob) in fields)
        {
            await using var upsert = new SqlCommand("""
                UPDATE app.occurrence_record_value
                   SET area_id = @area, epoch = @epoch, sealed = @blob, public_value = NULL, updated_at = @now
                 WHERE record_id = @intention AND field_key = @field;

                IF @@ROWCOUNT = 0
                    INSERT INTO app.occurrence_record_value
                        (record_id, field_key, area_id, epoch, sealed, public_value, updated_at)
                    VALUES (@intention, @field, @area, @epoch, @blob, NULL, @now);
                """, connection, tx);

            upsert.Parameters.AddWithValue("@intention", intentionId);
            upsert.Parameters.AddWithValue("@field", field);
            upsert.Parameters.AddWithValue("@area", areaId);
            upsert.Parameters.AddWithValue("@epoch", epoch);
            upsert.Parameters.AddWithValue("@blob", blob);
            upsert.Parameters.AddWithValue("@now", now);

            await upsert.ExecuteNonQueryAsync(ct);
        }
    }

    /// <summary>
    /// Findet diese Messe an diesem Vorkommen statt — gehört der Zeitpunkt zur
    /// Reihe, und ist er nicht abgesagt? (Verlegt ist in Ordnung: die Adresse
    /// bleibt der ursprüngliche Beginn.)
    /// </summary>
    private static Task<bool> TakesPlaceAsync(SqlConnection connection, Guid itemId, DateTimeOffset at, CancellationToken ct) =>
        Calendar.TakesPlaceAsync(connection, itemId, at, ct);

    /// <summary>Der Kalendereintrag hinter einer Messe: welcher Bereich, welche Art.</summary>
    private static async Task<(Guid AreaId, string Kind)?> ItemAsync(
        SqlConnection connection, Guid itemId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT c.area_id, i.kind
            FROM app.calendar_item i
            JOIN app.calendar c ON c.id = i.calendar_id
            WHERE i.id = @id;
            """, connection);

        cmd.Parameters.AddWithValue("@id", itemId);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return (reader.GetGuid(0), reader.GetString(1));
    }

    private static async Task<Dictionary<(Guid, DateTimeOffset), (bool Cancelled, DateTimeOffset? MovedTo)>>
        ExceptionsAsync(SqlConnection connection, List<Guid> itemIds, CancellationToken ct)
    {
        var map = new Dictionary<(Guid, DateTimeOffset), (bool, DateTimeOffset?)>();
        if (itemIds.Count == 0) return map;

        var names = string.Join(", ", itemIds.Select((_, i) => $"@i{i}"));

        await using var cmd = new SqlCommand(
            $"SELECT item_id, original_start, cancelled, moved_to FROM app.calendar_exception "
            + $"WHERE item_id IN ({names});", connection);

        for (var i = 0; i < itemIds.Count; i++) cmd.Parameters.AddWithValue($"@i{i}", itemIds[i]);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            map[(reader.GetGuid(0), reader.GetDateTimeOffset(1))] =
                (reader.GetBoolean(2), reader.IsDBNull(3) ? null : reader.GetDateTimeOffset(3));
        }

        return map;
    }

    private sealed record Held(
        Guid Id, Guid ItemId, DateTimeOffset At, int Ordinal, string Text,
        string Kind, string Status, Guid? Celebrant, List<Sealing> Fields);

    /// <summary>
    /// Die Intentionen im Fenster.
    ///
    /// <para>
    /// In ZWEI Abfragen und nicht einer je Messe: ein Wochenplan mit zwanzig
    /// Messen waere sonst einundzwanzig Runden zur Datenbank, und das sieht man
    /// dem Aushang an.
    /// </para>
    /// </summary>
    private static async Task<List<Held>> IntentionsAsync(
        SqlConnection connection, List<Guid> itemIds, DateTimeOffset from, DateTimeOffset to,
        bool withCancelled, CancellationToken ct)
    {
        var held = new List<Held>();
        if (itemIds.Count == 0) return held;

        var names = string.Join(", ", itemIds.Select((_, i) => $"@i{i}"));

        /*
         * 0132 — die Intentionen sind Einträge der Liste `intencje`. Vor der
         * Migration (der Dienst kam vor `migrate`) liest der Aushang weiter aus
         * `mass_intention` — er bleibt stehen, Neues wird solange abgewiesen.
         */
        var ready = await Calendar.RecordsReadyAsync(connection, ct);
        var source = ready
            ? $"""
              SELECT n.id, n.item_id, n.occurrence_at, n.ordinal, n.text_public,
                     ISNULL(n.mode, N'single'), n.status, n.role_id
              FROM app.occurrence_record n
              WHERE n.list_key = N'{Calendar.IntentionList}' AND n.item_id IN ({names})
                AND n.occurrence_at BETWEEN @from AND @to
                AND n.status IN (N'accepted', N'cancelled', N'celebrated')
                {(withCancelled ? "" : "AND n.status <> N'cancelled'")}
              ORDER BY n.occurrence_at, n.ordinal;
              """
            : $"""
              SELECT n.id, n.item_id, n.occurrence_at, n.ordinal, n.text_public,
                     n.kind, n.status, n.celebrant_role_id
              FROM app.mass_intention n
              WHERE n.item_id IN ({names})
                AND n.occurrence_at BETWEEN @from AND @to
                {(withCancelled ? "" : "AND n.status <> N'cancelled'")}
              ORDER BY n.occurrence_at, n.ordinal;
              """;

        await using (var cmd = new SqlCommand(source, connection))
        {
            cmd.Parameters.AddWithValue("@from", from);
            cmd.Parameters.AddWithValue("@to", to);
            for (var i = 0; i < itemIds.Count; i++) cmd.Parameters.AddWithValue($"@i{i}", itemIds[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                held.Add(new Held(
                    reader.GetGuid(0), reader.GetGuid(1), reader.GetDateTimeOffset(2),
                    reader.GetInt32(3), reader.GetString(4), reader.GetString(5), reader.GetString(6),
                    reader.IsDBNull(7) ? null : reader.GetGuid(7),
                    []));
            }
        }

        if (held.Count == 0) return held;

        /*
         * Geber und Gabe. Sie gehen NUR in die Kanzlei hinaus — am Aushang
         * werden sie nicht einmal geholt.
         */
        if (!withCancelled) return held;

        var byId = held.ToDictionary(h => h.Id);
        var ids = string.Join(", ", held.Select((_, i) => $"@n{i}"));

        await using (var cmd = new SqlCommand(ready
            ? $"SELECT record_id, field_key, area_id, epoch, sealed FROM app.occurrence_record_value "
              + $"WHERE record_id IN ({ids}) AND sealed IS NOT NULL ORDER BY record_id, field_key;"
            : $"SELECT intention_id, field, area_id, epoch, sealed_blob FROM app.mass_intention_field "
              + $"WHERE intention_id IN ({ids}) ORDER BY intention_id, field;", connection))
        {
            for (var i = 0; i < held.Count; i++) cmd.Parameters.AddWithValue($"@n{i}", held[i].Id);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                if (byId.TryGetValue(reader.GetGuid(0), out var one))
                {
                    one.Fields.Add(new Sealing(
                        reader.GetString(1), reader.GetGuid(2), reader.GetInt32(3), (byte[])reader[4]));
                }
            }
        }

        return held;
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
