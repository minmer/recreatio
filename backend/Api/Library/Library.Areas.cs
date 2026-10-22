using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 2026-10-22 — WER EINE BIBLIOTHEK LIEST, ENTSCHEIDET IHR BEREICH, und nur er.
///
/// <para>
/// Bis hierher gab es daneben ein zweites System: ein Eintrag wurde einzeln
/// „veröffentlicht" (eine offene Fassung neben der Hülle), Felder waren
/// „privat". Zwei Stellen, die über Sichtbarkeit entscheiden, laufen
/// irgendwann auseinander — jedes Auseinanderlaufen ist ein Leck oder eine
/// Sperre. Für Bibliotheken (Art <c>books</c>) gilt jetzt allein der Bereich:
/// seine Mitglieder lesen, und ist er öffentlich (<c>public_level</c> und ein
/// offengelegter Epochenschlüssel), liest jeder — die Hüllen, geöffnet im
/// Browser mit dem offengelegten Schlüssel (<c>/area/{id}/key</c>).
/// </para>
///
/// <code>
///   GET  /library/{id}/open           ein öffentlicher Bereich: alle Hüllen, ohne Konto — Bibliotheken und Bazy wiedzy (Schritt 8)
///   GET  /library/{id}/file/{fileId}/sealed   eine Datei derselben Bibliothek, versiegelt, unter einer offengelegten Epoche
///   GET  /library/where?ids=…          in welcher Bibliothek ein Eintrag liegt — nur, wo der Rufer lesen darf
///   POST /workspace/library/{id}/entry/{entryId}/move   einen Eintrag in eine andere Bibliothek (Baza wiedzy) tragen — die Kennung bleibt
///   POST /workspace/library/{id}/area-rule        die Umstellung dieser Bibliothek ist durchgesehen (0122)
/// </code>
///
/// 2026-10-22 (Schritt 8) — die Bazy wiedzy folgen derselben Regel: eine
/// Baza in einem öffentlichen Bereich ist, sobald ihre Umstellung bestätigt ist
/// (<c>area_rule_at</c>), als GANZE öffentlich — mit Fragen, Antworten,
/// Entwürfen, Przebiegi. Das einzelne Veröffentlichen ist fort.
/// </summary>
public static partial class Library
{
    private const int MaxWhere = 400;

    private static void MapAreas(WebApplication app)
    {
        app.MapGet("/library/{id:guid}/open", OpenEntriesAsync);
        app.MapGet("/library/{id:guid}/file/{fileId:guid}/sealed", OpenFileAsync);
        app.MapGet("/library/where", WhereAsync);
        app.MapPost("/workspace/library/{id:guid}/entry/{entryId:guid}/move", MoveAsync);
        app.MapPost("/workspace/library/{id:guid}/area-rule", AreaRuleAsync);
    }

    /// <summary>Ob 0122 schon da ist (die Spalte <c>area_rule_at</c>).</summary>
    internal static async Task<bool> HasAreaRuleAsync(SqlConnection connection, CancellationToken ct, SqlTransaction? tx = null)
    {
        await using var cmd = new SqlCommand("SELECT CASE WHEN COL_LENGTH('app.library', 'area_rule_at') IS NULL THEN 0 ELSE 1 END;", connection, tx);
        return (int)(await cmd.ExecuteScalarAsync(ct) ?? 0) == 1;
    }

    /// <summary>
    /// Ist die Umstellung dieser Bibliothek durchgesehen? Vorher öffnet
    /// <c>/open</c> sie nicht — auch in einem öffentlichen Bereich: was dort
    /// nie veröffentlicht war, soll nicht ungefragt sichtbar werden.
    /// </summary>
    private static async Task<bool> AreaRuleSetAsync(SqlConnection connection, Guid id, CancellationToken ct)
    {
        if (!await HasAreaRuleAsync(connection, ct)) return false;
        await using var cmd = new SqlCommand("SELECT CASE WHEN area_rule_at IS NULL THEN 0 ELSE 1 END FROM app.library WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", id);
        return (int)(await cmd.ExecuteScalarAsync(ct) ?? 0) == 1;
    }

    /// <summary>Die Umstellung bestätigen — wer dort schreiben darf; einmal gesetzt, bleibt sie.</summary>
    private static async Task AreaRuleAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write) is null) return;
        if (!await HasAreaRuleAsync(connection, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Baza danych nie zna jeszcze tej zmiany (0122).");
            return;
        }

        await using var cmd = new SqlCommand("""
            UPDATE app.library SET area_rule_at = COALESCE(area_rule_at, @now) WHERE id = @id;
            SELECT area_rule_at FROM app.library WHERE id = @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        await ctx.Response.WriteAsJsonAsync(new { areaRuleAt = await cmd.ExecuteScalarAsync(ctx.RequestAborted) });
    }

    /// <summary>Was eine Bibliothek ist (<c>books</c>, <c>knowledge</c>) — <c>null</c>: keine.</summary>
    private static async Task<string?> KindOfLibraryAsync(SqlConnection connection, Guid id, CancellationToken ct, SqlTransaction? tx = null)
    {
        await using var cmd = new SqlCommand("SELECT kind FROM app.library WHERE id = @id;", connection, tx);
        cmd.Parameters.AddWithValue("@id", id);
        return await cmd.ExecuteScalarAsync(ct) as string;
    }

    /// <summary>Ist der Bereich offen — eine Stufe über <c>none</c> UND ein offengelegter Schlüssel?</summary>
    private static async Task<bool> AreaIsPublicAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            SELECT CASE WHEN EXISTS (
                SELECT 1 FROM app.area a
                 WHERE a.id = @area AND a.public_level <> N'none'
                   AND EXISTS (SELECT 1 FROM app.area_epoch e WHERE e.area_id = a.id AND e.key_public IS NOT NULL))
            THEN 1 ELSE 0 END;
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        return (int)(await cmd.ExecuteScalarAsync(ct) ?? 0) == 1;
    }

    /// <summary>
    /// EINE ÖFFENTLICHE BIBLIOTHEK, ohne Konto: dieselben Hüllen, die ein
    /// Mitglied bekommt — aber nur die unter einer offengelegten Epoche (eine
    /// andere könnte der Leser ohnehin nicht öffnen) und nur, solange der
    /// Bereich offen ist. Der Dienst öffnet nichts; er gibt weiter.
    /// </summary>
    private static async Task OpenEntriesAsync(HttpContext ctx, Db db, Guid id, string? since)
    {
        if (!SinceOf(since, out var from)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny stan."); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var library = await LibraryAsync(connection, id, ctx.RequestAborted);
        if (library is null || !await PublicLibraryAsync(connection, id, library.Value.AreaId, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Ta biblioteka nie jest publiczna.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        byte[] name;
        int nameEpoch;
        await using (var head = new SqlCommand("SELECT name_sealed, epoch FROM app.library WHERE id = @id;", connection))
        {
            head.Parameters.AddWithValue("@id", id);
            await using var reader = await head.ExecuteReaderAsync(ctx.RequestAborted);
            await reader.ReadAsync(ctx.RequestAborted);
            name = (byte[])reader[0];
            nameEpoch = reader.GetInt32(1);
        }

        await using var cmd = new SqlCommand($"""
            SELECT e.id, e.kind, e.epoch, e.sealed, e.version, e.created_at, e.updated_at, e.deleted_at
            FROM app.library_entry e
            WHERE e.library_id = @id
              AND {(from is null ? "e.deleted_at IS NULL" : "e.updated_at >= @since")}
              AND (e.deleted_at IS NOT NULL OR EXISTS (
                    SELECT 1 FROM app.area_epoch k WHERE k.area_id = @area AND k.epoch = e.epoch AND k.key_public IS NOT NULL))
            ORDER BY e.updated_at;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@area", library.Value.AreaId);
        if (from is not null) cmd.Parameters.AddWithValue("@since", from.Value);

        var entries = new List<object>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                entries.Add(new
                {
                    entryId = Ids.ToText(reader.GetGuid(0)),
                    kind = reader.GetString(1),
                    epoch = reader.GetInt32(2),
                    @sealed = reader.IsDBNull(3) ? null : Base64Url.Encode((byte[])reader[3]),
                    version = reader.GetInt32(4),
                    createdAt = reader.GetDateTimeOffset(5),
                    updatedAt = reader.GetDateTimeOffset(6),
                    deletedAt = reader.IsDBNull(7) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(7),
                    publishedAt = (DateTimeOffset?)null,
                    publishedAs = (string?)null
                });
            }
        }

        ctx.Response.Headers.CacheControl = "no-cache";
        await ctx.Response.WriteAsJsonAsync(new
        {
            now,
            libraryId = Ids.ToText(id),
            areaId = Ids.ToText(library.Value.AreaId),
            nameSealed = Base64Url.Encode(name),
            nameEpoch,
            entries
        });
    }

    /// <summary>
    /// Öffentlich lesbar: eine Bibliothek ODER eine Baza wiedzy (Schritt 8) in
    /// einem öffentlichen Bereich, deren Umstellung bestätigt ist.
    /// </summary>
    private static async Task<bool> PublicLibraryAsync(SqlConnection connection, Guid id, Guid areaId, CancellationToken ct) =>
        await KindOfLibraryAsync(connection, id, ct) is "books" or "knowledge"
        && await AreaIsPublicAsync(connection, areaId, ct)
        && await AreaRuleSetAsync(connection, id, ct);

    /// <summary>
    /// 2026-10-22 (Schritt 8) — EINE DATEI EINER ÖFFENTLICHEN BIBLIOTHEK, ohne
    /// Konto: die Hülle, wie ein Mitglied sie bekommt — nur unter einer
    /// offengelegten Epoche (eine andere könnte der Leser ohnehin nicht öffnen).
    /// Ersetzt die offenen Kopien der Dateien.
    /// </summary>
    private static async Task OpenFileAsync(HttpContext ctx, Db db, IConfiguration config, Guid id, Guid fileId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var library = await LibraryAsync(connection, id, ctx.RequestAborted);
        var row = await FileRowAsync(connection, id, fileId, ctx.RequestAborted);
        if (library is null || row is null || !await PublicLibraryAsync(connection, id, library.Value.AreaId, ctx.RequestAborted))
        {
            ctx.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }
        await using (var shown = new SqlCommand("SELECT CASE WHEN EXISTS (SELECT 1 FROM app.area_epoch WHERE area_id = @area AND epoch = @epoch AND key_public IS NOT NULL) THEN 1 ELSE 0 END;", connection))
        {
            shown.Parameters.AddWithValue("@area", library.Value.AreaId);
            shown.Parameters.AddWithValue("@epoch", row.Value.Epoch);
            if ((int)(await shown.ExecuteScalarAsync(ctx.RequestAborted) ?? 0) != 1) { ctx.Response.StatusCode = StatusCodes.Status404NotFound; return; }
        }
        await SendSealedAsync(ctx, connection, config, id, fileId);
    }

    /// <summary>Die Kennungen aus <c>ids=a,b,c</c> — höchstens <see cref="MaxWhere"/>, sonst <c>null</c>.</summary>
    public static List<Guid>? ParseIds(string? ids)
    {
        var out_ = new List<Guid>();
        foreach (var part in (ids ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!Guid.TryParse(part, out var one)) return null;
            if (!out_.Contains(one)) out_.Add(one);
        }
        return out_.Count is 0 or > MaxWhere ? null : out_;
    }

    /// <summary>
    /// WO LIEGT DAS, WORAUF EIN EINTRAG ZEIGT? Ein Verweis über Bereiche hinweg
    /// trägt nur die Kennung seines Ziels. Gesagt wird die Bibliothek nur, wo
    /// der Rufer sie lesen darf (Mitglied, Link, oder ein öffentlicher
    /// Bereich); sonst fehlt die Kennung in der Antwort — der Leser sieht, dass
    /// es einen Verweis gibt, und nichts darüber, nicht einmal den Titel.
    /// </summary>
    private static async Task WhereAsync(HttpContext ctx, Db db, string? ids)
    {
        var wanted = ParseIds(ids);
        if (wanted is null) { await Fail(ctx, StatusCodes.Status400BadRequest, $"Od jednej do {MaxWhere} kennung."); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var caller = await Callers.OfAsync(ctx, db, connection);

        var rows = new List<(Guid Entry, Guid Library, Guid Area)>();
        var names = string.Join(", ", wanted.Select((_, i) => $"@e{i}"));
        await using (var cmd = new SqlCommand($"""
            SELECT e.id, l.id, l.area_id FROM app.library_entry e JOIN app.library l ON l.id = e.library_id
            WHERE e.id IN ({names}) AND e.deleted_at IS NULL AND l.kind = N'books';
            """, connection))
        {
            for (var i = 0; i < wanted.Count; i++) cmd.Parameters.AddWithValue($"@e{i}", wanted[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) rows.Add((reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2)));
        }

        /* Je Bereich EINE Frage. */
        var readable = new Dictionary<Guid, bool>();
        foreach (var area in rows.Select(r => r.Area).Distinct())
        {
            readable[area] = (caller is not null && await Area.MayAsync(connection, caller, area, Capability.Read, ctx.RequestAborted))
                || await AreaIsPublicAsync(connection, area, ctx.RequestAborted);
        }

        ctx.Response.Headers.CacheControl = "no-cache";
        await ctx.Response.WriteAsJsonAsync(new
        {
            found = rows.Where(r => readable[r.Area]).Select(r => new { entryId = Ids.ToText(r.Entry), libraryId = Ids.ToText(r.Library) })
        });
    }

    public sealed record MoveRequest(string? ToLibrary, string? Kind, int Epoch, string? Sealed, int Version);

    /// <summary>
    /// Wohin ein Eintrag ziehen darf (Schreiben müssen beide Seiten dürfen):
    /// <code>
    ///   books     → books      in jeden Bereich (die Sichtbarkeit folgt dem neuen Bereich)
    ///   knowledge → knowledge  in jeden Bereich — 2026-10-22 (Schritt 8): so „veröffentlicht"
    ///                          man jetzt: man trägt etwas in eine Baza eines öffentlichen Bereichs
    ///   knowledge → books      nur im selben Bereich (Schritt 6: ein Stwierdzenie wird ein Komentarz)
    ///   books     → knowledge  nie
    /// </code>
    /// </summary>
    public static bool MayMove(string? fromKind, string? toKind, bool sameArea) => (fromKind, toKind) switch
    {
        ("books", "books") => true,
        ("knowledge", "knowledge") => true,
        ("knowledge", "books") => sameArea,
        _ => false
    };

    /// <summary>
    /// EINEN EINTRAG IN EINEN ANDEREN BEREICH TRAGEN — das ist jetzt, was
    /// früher „veröffentlichen" hiess: wer ihn öffentlich will, trägt ihn in
    /// die Bibliothek eines öffentlichen Bereichs. Die Hülle kommt neu
    /// versiegelt (unter dem Schlüssel des Ziels) aus dem Browser; die
    /// Kennung bleibt, so zeigen alle Verweise weiter auf ihn. Schreiben
    /// müssen beide Seiten dürfen.
    ///
    /// 2026-10-22 (Schritt 6) — auch aus einer Baza wiedzy in eine Bibliothek:
    /// ein „Wiedza" wird dabei ein Komentarz (die neue Hülle sagt es). Dann nur
    /// in eine Bibliothek DESSELBEN Bereichs — so wird keine Aussage für mehr
    /// Menschen lesbar, als sie es vorher war.
    ///
    /// 2026-10-22 (Schritt 8) — und von einer Baza wiedzy in eine andere, in
    /// jeden Bereich: das ist in Cogita jetzt das Veröffentlichen. Der Browser
    /// sagt vorher, dass eine öffentliche Baza als Ganze öffentlich ist.
    /// </summary>
    private static async Task MoveAsync(HttpContext ctx, Db db, Guid id, Guid entryId, MoveRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        if (!Guid.TryParse(body.ToLibrary, out var to) || to == id) { await Fail(ctx, StatusCodes.Status400BadRequest, "Wybierz inną bibliotekę."); return; }
        if (!IsKind(body.Kind)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieznany rodzaj wpisu."); return; }
        if (!Base64Url.TryDecode(body.Sealed, out var sealedBytes) || sealedBytes.Length is < 48 or > (int)MaxSealed)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Zapieczętowany wpis musi mieć najwyżej 4 MB.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var source = await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write);
        if (source is null) return;
        var target = await AllowedAsync(ctx, connection, who.Value.AccountId, to, Capability.Write);
        if (target is null) return;
        var fromKind = await KindOfLibraryAsync(connection, id, ctx.RequestAborted);
        var toKind = await KindOfLibraryAsync(connection, to, ctx.RequestAborted);
        if (!MayMove(fromKind, toKind, source.Value.AreaId == target.Value.AreaId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, fromKind == "knowledge" && toKind == "books"
                ? "Z bazy wiedzy do biblioteki przenosi się tylko w tym samym obszarze."
                : "Wpis przenosi się z biblioteki do biblioteki albo z bazy wiedzy do bazy wiedzy.");
            return;
        }
        if (body.Epoch < 1 || body.Epoch > target.Value.CurrentEpoch) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nie ma takiej epoki obszaru."); return; }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);
        int? version = null;
        await using (var read = new SqlCommand(
            "SELECT version FROM app.library_entry WITH (UPDLOCK, HOLDLOCK) WHERE id = @entry AND library_id = @library AND deleted_at IS NULL;", connection, tx))
        {
            read.Parameters.AddWithValue("@entry", entryId);
            read.Parameters.AddWithValue("@library", id);
            version = await read.ExecuteScalarAsync(ctx.RequestAborted) as int?;
        }
        if (version is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Takiego wpisu nie ma."); return; }
        if (version != body.Version)
        {
            ctx.Response.StatusCode = StatusCodes.Status409Conflict;
            await ctx.Response.WriteAsJsonAsync(new { error = "Ktoś zmienił ten wpis w międzyczasie — wczytaj nowszą wersję.", verdict = "stale", version });
            return;
        }

        var now = DateTimeOffset.UtcNow;
        await using (var move = new SqlCommand("""
            INSERT INTO app.library_entry_version (entry_id, version, kind, epoch, sealed, written_at, written_by_account_id)
            SELECT id, version, kind, epoch, sealed, updated_at, written_by_account_id FROM app.library_entry
             WHERE id = @entry AND sealed IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM app.library_entry_version v WHERE v.entry_id = @entry AND v.version = app.library_entry.version);
            DELETE FROM app.library_public_ref WHERE entry_id = @entry OR ref_id = @entry;
            UPDATE app.library_entry
               SET library_id = @to, kind = @kind, epoch = @epoch, sealed = @sealed, version = version + 1, updated_at = @now,
                   written_by_account_id = @account,
                   published_at = NULL, published_as = NULL, public_key = NULL, public_sort = NULL, public_summary = NULL, public_json = NULL
             WHERE id = @entry;
            """, connection, tx))
        {
            move.Parameters.AddWithValue("@entry", entryId);
            move.Parameters.AddWithValue("@to", to);
            move.Parameters.AddWithValue("@kind", body.Kind!);
            move.Parameters.AddWithValue("@epoch", body.Epoch);
            move.Parameters.AddBlob("@sealed", sealedBytes);
            move.Parameters.AddWithValue("@now", now);
            move.Parameters.AddWithValue("@account", who.Value.AccountId);
            await move.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        /*
         * Die ALTE Bibliothek muss beim nächsten Abgleich erfahren, dass er fort
         * ist: ein Grabstein mit derselben Kennung geht nicht (sie ist jetzt die
         * des Eintrags drüben) — deshalb steht der Umzug in einer eigenen Spur.
         */
        await using (var gone = new SqlCommand("""
            IF OBJECT_ID(N'app.library_moved', N'U') IS NOT NULL
                INSERT INTO app.library_moved (entry_id, from_library_id, moved_at) VALUES (@entry, @from, @now);
            """, connection, tx))
        {
            gone.Parameters.AddWithValue("@entry", entryId);
            gone.Parameters.AddWithValue("@from", id);
            gone.Parameters.AddWithValue("@now", now);
            await gone.ExecuteNonQueryAsync(ctx.RequestAborted);
        }

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { entryId = Ids.ToText(entryId), libraryId = Ids.ToText(to), version = version + 1, updatedAt = now });
    }
}

public static partial class Library
{
    /// <summary>Einträge, die seit <paramref name="since"/> aus dieser Bibliothek fortgezogen sind — als Grabsteine für den Abgleich.</summary>
    private static async Task MovedAwayAsync(SqlConnection connection, Guid id, DateTimeOffset since, List<object> into, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("""
            IF OBJECT_ID(N'app.library_moved', N'U') IS NOT NULL
                SELECT m.entry_id, e.kind, m.moved_at FROM app.library_moved m JOIN app.library_entry e ON e.id = m.entry_id
                 WHERE m.from_library_id = @id AND m.moved_at >= @since AND e.library_id <> @id;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@since", since);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            into.Add(new
            {
                entryId = Ids.ToText(reader.GetGuid(0)),
                kind = reader.GetString(1),
                epoch = 1,
                @sealed = (string?)null,
                version = 0,
                createdAt = reader.GetDateTimeOffset(2),
                updatedAt = reader.GetDateTimeOffset(2),
                deletedAt = (DateTimeOffset?)reader.GetDateTimeOffset(2),
                publishedAt = (DateTimeOffset?)null,
                publishedAs = (string?)null
            });
        }
    }
}
