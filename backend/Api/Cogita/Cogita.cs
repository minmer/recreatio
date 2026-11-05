using System.Globalization;
using System.Security.Cryptography;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// COGITA (0109) — was ein Lernender hinterlässt, und wohin es geht (COGITA.md §7).
///
/// <para>
/// <b>Jede Antwort wird gespeichert, versiegelt</b> [F16]. Der Browser sammelt
/// Antworten (und je Karte eine Momentaufnahme der Kenntnis, mit der Kennung
/// der Frage und der Richtung) zu einem STAPEL, würfelt einen Schlüssel,
/// versiegelt damit den Stapel und verpackt den Schlüssel zweimal: für den
/// Lernenden (seine Person, RSA — oder sein Platz, P-256) und für die Annahme
/// des Bereichs, in dem die Antworten liegen sollen. Genau so erreicht ein
/// Formular sein Amt [E10]. Beide Schlüssel sind öffentlich: wer ohne Netz
/// gelernt hat, versiegelt trotzdem, und später geht es hinaus [E9].
/// </para>
///
/// <para>
/// <b>Der Dienst sieht</b>: wer, wohin, welche Art, wann, wie gross — und je
/// Lernendem und Bibliothek EINE offene Zeit, wann er wieder dran ist [E8].
/// Mehr nicht. Die Kenntnis rechnet der Browser [E7].
/// </para>
///
/// <para>
/// <b>Wohin darf ein Lernender schreiben?</b> In einen Bereich, den er liest —
/// den eigenen privaten, den seiner Klasse. Sonst könnte jeder den
/// Speicherbereich eines fremden Kurses mit Müll füllen. Ein Platz schreibt in
/// seinen Bereich und in die Bereiche seiner Rollen.
/// </para>
/// </summary>
public static partial class Cogita
{
    private const int MaxBatch = 512 * 1024;
    private const int MaxBatchesAtOnce = 50;
    /// <summary>2026-11-04 (Prompt 13): 2000 statt 400 — ein langer Lerntag mit Erzählungen stiess an die Grenze, danach blieb alles in der Ablage.</summary>
    private const int MaxBatchesPerDay = 2000;
    private const int MaxKey = 2048;

    /// <summary>Was ein Stapel sein kann. Die letzten drei gelten nur in ihrer jüngsten Fassung.</summary>
    private static readonly HashSet<string> Kinds = new(StringComparer.Ordinal)
    {
        "answers", "snapshots", "position", "values", "suspend", "flags", "counts"
    };

    /// <summary>Der Stand von heute ersetzt den von gestern: nur der jüngste Stapel je Halter, Bibliothek, Bereich und Art bleibt.</summary>
    private static readonly HashSet<string> Latest = new(StringComparer.Ordinal) { "position", "values", "suspend" };

    /// <summary>An die Autoren, ohne Halter [K4].</summary>
    private static readonly HashSet<string> Anonymous = new(StringComparer.Ordinal) { "flags", "counts" };

    /// <summary>
    /// 2026-11-05 (Durchsicht) — SO VIELE STAPEL JE SEITE. Vorher schnitt ein festes TOP ab, aufsteigend sortiert: nach 5000
    /// Stapeln fehlten die JÜNGSTEN Antworten, Werte und Stellen. Jetzt sagt eine volle Seite `more` und `next` (nach
    /// welchem Stapel die nächste beginnt), und `now` ist dann die Zeit ihres letzten Stapels — ein Browser, der nicht
    /// weiterblättert (eine ältere Fassung), holt den Rest mit dem nächsten `since`.
    /// </summary>
    internal const int OwnPage = 5000;
    internal const int AreaPage = 20000;
    internal const int ReportPage = 10000;

    public static void Map(WebApplication app)
    {
        app.MapPost("/workspace/learn/batches", PostBatchesAsync);
        app.MapGet("/workspace/learn/batches", MyBatchesAsync);
        app.MapGet("/workspace/learn/area/{areaId:guid}/batches", AreaBatchesAsync);
        app.MapPost("/workspace/learn/due", DueAsync);
        app.MapGet("/workspace/learn/due", MyDueAsync);
        app.MapPost("/workspace/learn/library/{id:guid}/report", ReportAsync);
        app.MapGet("/workspace/learn/library/{id:guid}/reports", ReportsAsync);
        /* 2026-11-01 — in welche Bereiche die Antworten zu einer Baza gingen (eine Baza steht in vielen Kursen). */
        app.MapGet("/workspace/learn/library/{id:guid}/areas", AnswerAreasAsync);

        app.MapPost("/seat/{token}/learn/batches", SeatPostBatchesAsync);
        app.MapGet("/seat/{token}/learn/batches", SeatBatchesAsync);
        app.MapPost("/seat/{token}/learn/due", SeatDueAsync);
        app.MapPost("/seat/{token}/learn/library/{id:guid}/report", SeatReportAsync);

        /* 0109 — einen Baustein direkt veröffentlichen [F20]: eine Adresse unter `c`, die dem gehört, der veröffentlicht. */
        app.MapPost("/workspace/publish/address", PublishAddressAsync);
        app.MapGet("/workspace/publish/addresses", MyAddressesAsync);

        MapSessions(app);
        MapGame(app);
    }

    /* -- Prüfen, was hereinkommt ------------------------------------------------------------ */

    /// <summary>`AreaEpoch` (0136): `KeyForArea` ist unter dem Epochenschlüssel des Bereichs versiegelt, nicht für seine Przyjęcia.</summary>
    public sealed record BatchIn(
        string? BatchId, string? LibraryId, string? AreaId, string? Kind, string? HolderRoleId,
        string? Sealed, string? KeyForHolder, string? KeyForArea, int? AreaEpoch = null);

    public sealed record BatchesRequest(IReadOnlyList<BatchIn>? Batches);

    private sealed record Batch(Guid Id, Guid LibraryId, Guid AreaId, string Kind, byte[] Sealed, byte[]? KeyForHolder, byte[]? KeyForArea, Guid? HolderRole, int? AreaEpoch = null);

    private static bool Blob(string? text, int max, out byte[] bytes)
    {
        bytes = [];
        if (string.IsNullOrEmpty(text)) return false;
        try { bytes = Base64Url.Decode(text); } catch (FormatException) { return false; }
        return bytes.Length > 0 && bytes.Length <= max;
    }

    /// <summary>Ein Stapel, wie er hereinkam — <c>null</c> mit einem Grund, wenn er so nicht geht.</summary>
    private static (Batch? Batch, string? Problem) Read(BatchIn one, bool seat)
    {
        if (!Guid.TryParse(one.BatchId, out var id) || !Guid.TryParse(one.LibraryId, out var library) || !Guid.TryParse(one.AreaId, out var area))
            return (null, "Nieczytelny pakiet odpowiedzi.");
        var kind = (one.Kind ?? string.Empty).Trim();
        if (!Kinds.Contains(kind) || Anonymous.Contains(kind)) return (null, "Nieznany rodzaj pakietu.");
        if (!Blob(one.Sealed, MaxBatch, out var sealedBytes) || sealedBytes.Length < 32) return (null, "Pakiet odpowiedzi może mieć najwyżej 512 kB.");
        if (!Blob(one.KeyForHolder, MaxKey, out var forHolder)) return (null, "Brakuje klucza dla uczącego się.");
        byte[]? forArea = null;
        if (!string.IsNullOrEmpty(one.KeyForArea) && !Blob(one.KeyForArea, MaxKey, out forArea)) return (null, "Nieczytelny klucz dla obszaru.");
        Guid? holder = null;
        if (!seat)
        {
            if (!Guid.TryParse(one.HolderRoleId, out var role)) return (null, "Czyje to odpowiedzi?");
            holder = role;
        }
        if (one.AreaEpoch is < 0 || (one.AreaEpoch is not null && forArea is null)) return (null, "Nieczytelny klucz dla obszaru.");
        return (new Batch(id, library, area, kind, sealedBytes, forHolder, forArea, holder, one.AreaEpoch), null);
    }

    private static async Task<Guid?> LibraryAreaAsync(SqlConnection connection, Guid libraryId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT area_id FROM app.library WHERE id = @id;", connection);
        cmd.Parameters.AddWithValue("@id", libraryId);
        return await cmd.ExecuteScalarAsync(ct) as Guid?;
    }

    private static async Task<bool> HasIntakeAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        await using var cmd = new SqlCommand("SELECT 1 FROM app.intake WHERE area_id = @area;", connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        return await cmd.ExecuteScalarAsync(ct) is not null;
    }

    /// <summary>Die Bereiche über einem Bereich — sein Elternbereich, dessen Elternbereich … (höchstens 16).</summary>
    private static async Task<List<Guid>> AboveAsync(SqlConnection connection, Guid areaId, CancellationToken ct)
    {
        var above = new List<Guid>();
        await using var cmd = new SqlCommand("""
            WITH up AS (
                SELECT a.parent_area_id AS id, 1 AS depth FROM app.area a WHERE a.id = @area AND a.parent_area_id IS NOT NULL
                UNION ALL
                SELECT a.parent_area_id, up.depth + 1 FROM up JOIN app.area a ON a.id = up.id
                 WHERE a.parent_area_id IS NOT NULL AND up.depth < 16
            )
            SELECT id FROM up ORDER BY depth;
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) above.Add(reader.GetGuid(0));
        return above;
    }

    /// <summary>
    /// 2026-11-01 — ANTWORTEN IN EINEN BEREICH DARIN: die Prowadzący eines Kurses haben oft einen eigenen Bereich im
    /// Kurs; dorthin dürfen die Uczący się ihre Antworten schicken, wie ein Formular sein Amt erreicht — wenn der
    /// Bereich Przyjęcia hat und der Lernende einen Bereich darüber liest. Versiegelt für die Przyjęcia: lesen kann
    /// sie nur, wer deren Schlüssel hält; der Lernende sieht vom Bereich nichts.
    /// </summary>
    private static async Task<bool> InsideAsync(SqlConnection connection, Guid areaId, Func<Guid, Task<bool>> reads, CancellationToken ct)
    {
        if (!await HasIntakeAsync(connection, areaId, ct)) return false;
        foreach (var above in await AboveAsync(connection, areaId, ct))
            if (await reads(above)) return true;
        return false;
    }

    /// <summary>Ein Nein zum Bereich — mit dem Wort `area`: der Browser schickt die Antworten dann dorthin, wo er darf.</summary>
    private static Task RefuseArea(HttpContext ctx, string message)
    {
        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
        return ctx.Response.WriteAsJsonAsync(new { error = message, verdict = "area" });
    }

    /// <summary>Wie viele Stapel dieser Halter heute schon geschickt hat — ein Browser in einer Schleife soll nicht die Datenbank füllen.</summary>
    private static async Task<int> TodayAsync(SqlConnection connection, Guid? role, Guid? seat, CancellationToken ct)
    {
        await using var cmd = new SqlCommand($"""
            SELECT COUNT(*) FROM app.learn_batch
            WHERE {(role is not null ? "holder_role_id = @h" : "holder_access_id = @h")} AND created_at > DATEADD(day, -1, SYSDATETIMEOFFSET());
            """, connection);
        cmd.Parameters.AddWithValue("@h", (object?)role ?? seat!.Value);
        return (int)(await cmd.ExecuteScalarAsync(ct) ?? 0);
    }

    /// <summary>Einen Stapel ablegen. Ein zweites Mal dieselbe Kennung ist kein Fehler: ein Browser, der ohne Netz war, schickt nach.</summary>
    private static async Task<bool> StoreAsync(SqlConnection connection, Batch batch, Guid? role, Guid? seat, CancellationToken ct)
    {
        var epoch = await Schema.LearnEpochAsync(connection, ct);
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ct);
        var holder = role is not null ? "holder_role_id" : "holder_access_id";
        await using (var cmd = new SqlCommand($"""
            IF NOT EXISTS (SELECT 1 FROM app.learn_batch WHERE id = @id)
            BEGIN
                {(Latest.Contains(batch.Kind) ? $"DELETE FROM app.learn_batch WHERE {holder} = @h AND library_id = @library AND area_id = @area AND kind = @kind;" : "")}
                INSERT INTO app.learn_batch (id, library_id, area_id, holder_role_id, holder_access_id, kind, sealed, key_for_holder, key_for_area, created_at{(epoch ? ", area_epoch" : "")})
                VALUES (@id, @library, @area, @role, @seat, @kind, @sealed, @forHolder, @forArea, SYSDATETIMEOFFSET(){(epoch ? ", @epoch" : "")});
            END
            """, connection, tx))
        {
            cmd.Parameters.AddWithValue("@id", batch.Id);
            cmd.Parameters.AddWithValue("@library", batch.LibraryId);
            cmd.Parameters.AddWithValue("@area", batch.AreaId);
            cmd.Parameters.AddWithValue("@h", (object?)role ?? seat!.Value);
            cmd.Parameters.Add("@role", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)role ?? DBNull.Value;
            cmd.Parameters.Add("@seat", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)seat ?? DBNull.Value;
            cmd.Parameters.AddWithValue("@kind", batch.Kind);
            cmd.Parameters.AddBlob("@sealed", batch.Sealed);
            cmd.Parameters.AddBlob("@forHolder", batch.KeyForHolder);
            cmd.Parameters.AddBlob("@forArea", batch.KeyForArea);
            if (epoch) cmd.Parameters.Add("@epoch", System.Data.SqlDbType.Int).Value = (object?)batch.AreaEpoch ?? DBNull.Value;
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
        return true;
    }

    /* -- Für ein Konto --------------------------------------------------------------------------- */

    /// <summary>
    /// STAPEL VON EINEM KONTO. Der Halter ist eine Person dieses Kontos (auch
    /// eine von mehreren [E11]); die Bibliothek muss sie lesen, den Bereich, in
    /// den die Antworten gehen, auch.
    /// </summary>
    private static async Task PostBatchesAsync(HttpContext ctx, Db db, BatchesRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var given = body.Batches ?? [];
        if (given.Count == 0 || given.Count > MaxBatchesAtOnce)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Od 1 do {MaxBatchesAtOnce} pakietów naraz.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var reads = new Dictionary<Guid, bool>();
        async Task<bool> Reads(Guid area)
        {
            if (!reads.TryGetValue(area, out var may)) reads[area] = may = await Area.MayAsync(connection, new Caller(who.Value.AccountId, mine), area, Capability.Read, ctx.RequestAborted);
            return may;
        }

        var stored = new List<string>();
        foreach (var one in given)
        {
            var (batch, problem) = Read(one, seat: false);
            if (batch is null) { await Fail(ctx, StatusCodes.Status400BadRequest, problem!); return; }

            var holder = batch.HolderRole!.Value;
            if (!mine.Any(r => r.Id == holder) || Workspace.IsAccount(mine, holder))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Odpowiedzi zapisuje się dla jednej z Twoich osób.");
                return;
            }

            var libraryArea = await LibraryAreaAsync(connection, batch.LibraryId, ctx.RequestAborted);
            if (libraryArea is null || !await Reads(libraryArea.Value))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej biblioteki nie ma.");
                return;
            }
            if (!await Reads(batch.AreaId) && !await InsideAsync(connection, batch.AreaId, Reads, ctx.RequestAborted))
            {
                await RefuseArea(ctx, "Postępy zapisuje się w obszarze, który czytasz (albo w obszarze z przyjęciami wewnątrz niego).");
                return;
            }
            if (batch.AreaEpoch is not null && !await Schema.LearnEpochAsync(connection, ctx.RequestAborted))
            {
                await RefuseArea(ctx, "Odpowiedzi do obszaru osoby przyjmie usługa po migracji 0136.");
                return;
            }

            if (stored.Count == 0 && await TodayAsync(connection, holder, null, ctx.RequestAborted) + given.Count > MaxBatchesPerDay)
            {
                await Fail(ctx, StatusCodes.Status429TooManyRequests, "Na dziś to za dużo pakietów — reszta pójdzie jutro.");
                return;
            }

            await StoreAsync(connection, batch, holder, null, ctx.RequestAborted);
            stored.Add(Ids.ToText(batch.Id));
        }

        await ctx.Response.WriteAsJsonAsync(new { stored });
    }

    /// <summary>
    /// Eine Seite Stapel hinaus. Der Befehl liefert zuerst die Zeit der Datenbank (vor dem Lesen: was danach dazukommt, ist
    /// jünger — der Browser fragt ab ihr weiter), dann bis zu <paramref name="page"/> + 1 Stapel nach (created_at, id).
    /// 2026-11-05 (Durchsicht): ist die Seite voll, sagen <c>more</c> und <c>next</c>, wo die nächste beginnt.
    /// </summary>
    private static async Task WriteBatchesAsync(HttpContext ctx, SqlCommand cmd, bool forArea, int page, int? total = null)
    {
        var batches = new List<object>();
        var now = DateTimeOffset.UtcNow;
        (DateTimeOffset At, Guid Id)? last = null;
        var more = false;
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            if (await reader.ReadAsync(ctx.RequestAborted)) now = reader.GetDateTimeOffset(0);
            await reader.NextResultAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                if (batches.Count == page) { more = true; break; }
                var id = reader.GetGuid(0);
                var createdAt = reader.GetDateTimeOffset(8);
                batches.Add(new
                {
                    batchId = Ids.ToText(id),
                    libraryId = Ids.ToText(reader.GetGuid(1)),
                    areaId = Ids.ToText(reader.GetGuid(2)),
                    holderRoleId = reader.IsDBNull(3) ? null : Ids.ToText(reader.GetGuid(3)),
                    holderSeatId = reader.IsDBNull(4) ? null : Ids.ToText(reader.GetGuid(4)),
                    kind = reader.GetString(5),
                    @sealed = Base64Url.Encode((byte[])reader[6]),
                    key = reader.IsDBNull(7) ? null : Base64Url.Encode((byte[])reader[7]),
                    createdAt,
                    /* 0136 — unter dem Epochenschlüssel des Bereichs versiegelt (sonst für seine Przyjęcia). */
                    areaEpoch = reader.FieldCount > 9 && !reader.IsDBNull(9) ? reader.GetInt32(9) : (int?)null
                });
                last = (createdAt, id);
            }
        }
        await ctx.Response.WriteAsJsonAsync(new
        {
            now = more ? last!.Value.At : now,
            forArea,
            batches,
            more,
            next = more ? CursorOf(last!.Value.At, last.Value.Id) : null,
            total
        });
    }

    private static bool SinceOf(string? since, out DateTimeOffset? from)
    {
        from = null;
        if (string.IsNullOrWhiteSpace(since)) return true;
        if (!DateTimeOffset.TryParse(since, out var parsed)) return false;
        from = parsed.AddSeconds(-2);
        return true;
    }

    /// <summary>
    /// 2026-11-05 (Durchsicht) — WO EINE SEITE BEGINNT: nach diesem Stapel, Zeit UND Kennung — Stapel mit derselben Zeit an
    /// der Grenze gehen so weder verloren noch kommen sie zweimal. Der Browser gibt <c>next</c> unverändert zurück.
    /// </summary>
    internal static string CursorOf(DateTimeOffset at, Guid id) => $"{at.ToString("O", CultureInfo.InvariantCulture)}_{Ids.ToText(id)}";

    internal static bool AfterOf(string? after, out (DateTimeOffset At, Guid Id)? cursor)
    {
        cursor = null;
        if (string.IsNullOrWhiteSpace(after)) return true;
        var cut = after.LastIndexOf('_');
        if (cut <= 0
            || !DateTimeOffset.TryParseExact(after[..cut], "O", CultureInfo.InvariantCulture, DateTimeStyles.None, out var at)
            || !Guid.TryParse(after[(cut + 1)..], out var id)) return false;
        cursor = (at, id);
        return true;
    }

    /// <summary>Die Bedingung „nach der Stelle" (leer ohne) — die Seite ist nach (created_at, id) geordnet.</summary>
    private static string AfterSql((DateTimeOffset At, Guid Id)? cursor) =>
        cursor is null ? "" : "AND (created_at > @afterAt OR (created_at = @afterAt AND id > @afterId))";

    private static void AddAfter(SqlCommand cmd, (DateTimeOffset At, Guid Id)? cursor)
    {
        if (cursor is null) return;
        cmd.Parameters.Add(new SqlParameter("@afterAt", System.Data.SqlDbType.DateTimeOffset) { Scale = 7, Value = cursor.Value.At });
        cmd.Parameters.Add("@afterId", System.Data.SqlDbType.UniqueIdentifier).Value = cursor.Value.Id;
    }

    /// <summary>
    /// Die eigenen Stapel — aller Personen dieses Kontos, mit ihrem Schlüssel für den Halter. 2026-11-05 (Durchsicht):
    /// seitenweise (<c>after</c> = <c>next</c> der vorigen Seite).
    /// </summary>
    private static async Task MyBatchesAsync(HttpContext ctx, Db db, string? libraryId, string? since, string? after)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (!SinceOf(since, out var from) || !AfterOf(after, out var cursor)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny stan."); return; }
        Guid? library = Guid.TryParse(libraryId, out var l) ? l : null;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        if (mine.Count == 0) { await ctx.Response.WriteAsJsonAsync(new { now = DateTimeOffset.UtcNow, forArea = false, batches = Array.Empty<object>(), more = false, next = (string?)null }); return; }

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT SYSDATETIMEOFFSET();
            SELECT TOP ({OwnPage + 1}) id, library_id, area_id, holder_role_id, holder_access_id, kind, sealed, key_for_holder, created_at{(await Schema.LearnEpochAsync(connection, ctx.RequestAborted) ? ", area_epoch" : "")}
            FROM app.learn_batch
            WHERE holder_role_id IN ({names})
              {(library is null ? "" : "AND library_id = @library")}
              {(from is null ? "" : "AND created_at >= @since")}
              {AfterSql(cursor)}
            ORDER BY created_at, id;
            """, connection);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);
        if (library is not null) cmd.Parameters.AddWithValue("@library", library.Value);
        if (from is not null) cmd.Parameters.AddWithValue("@since", from.Value);
        AddAfter(cmd, cursor);
        /*
         * 2026-11-05 — WIE VIELE ES SIND (nur auf der ersten Seite): der Browser zeigt beim Laden der eigenen Fortschritte einen
         * Kreis „120 z 480" statt eines blossen Wartens. Dieselben Bedingungen wie die Abfrage, ohne Seite.
         */
        int? total = null;
        if (cursor is null)
        {
            await using var count = new SqlCommand($"""
                SELECT COUNT(*) FROM app.learn_batch
                WHERE holder_role_id IN ({names})
                  {(library is null ? "" : "AND library_id = @library")}
                  {(from is null ? "" : "AND created_at >= @since")};
                """, connection);
            for (var i = 0; i < mine.Count; i++) count.Parameters.AddWithValue($"@r{i}", mine[i]);
            if (library is not null) count.Parameters.AddWithValue("@library", library.Value);
            if (from is not null) count.Parameters.AddWithValue("@since", from.Value);
            total = Convert.ToInt32(await count.ExecuteScalarAsync(ctx.RequestAborted));
        }
        await WriteBatchesAsync(ctx, cmd, forArea: false, OwnPage, total);
    }

    /// <summary>
    /// FÜR DIE KANZLEI, die Lehrerin [E10]: was in einem Bereich liegt, den sie
    /// liest — mit dem Schlüssel für die Annahme. Öffnen kann es nur, wer die
    /// Rolle hält, für die die Annahme gemacht wurde. 2026-11-05 (Durchsicht): seitenweise (<c>after</c>).
    /// </summary>
    private static async Task AreaBatchesAsync(HttpContext ctx, Db db, Guid areaId, string? libraryId, string? since, string? after)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (!SinceOf(since, out var from) || !AfterOf(after, out var cursor)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny stan."); return; }
        Guid? library = Guid.TryParse(libraryId, out var l) ? l : null;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await Area.MayAsync(connection, who.Value.AccountId, areaId, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        /*
         * 2026-11-01 — EIN VIRTUELLER BEREICH EINES FORMULARS (0120): die Antworten liegen im Kleinbereich jeder Person
         * (versiegelt unter seinem Schlüssel, 0136). Mit dazu kommt jeder Kleinbereich, den der Rufer liest — die
         * Regel des virtuellen Bereichs gibt ihn den Prowadzący.
         */
        var areas = new List<Guid> { areaId };
        if (await Schema.VirtualAreasAsync(connection, ctx.RequestAborted))
        {
            var instances = new List<Guid>();
            await using (var find = new SqlCommand("SELECT TOP 1000 area_id FROM app.area_instance WHERE virtual_area_id = @area;", connection))
            {
                find.Parameters.AddWithValue("@area", areaId);
                await using var reader = await find.ExecuteReaderAsync(ctx.RequestAborted);
                while (await reader.ReadAsync(ctx.RequestAborted)) instances.Add(reader.GetGuid(0));
            }
            var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
            foreach (var one in instances)
                if (await Area.MayAsync(connection, new Caller(who.Value.AccountId, mine), one, Capability.Read, ctx.RequestAborted)) areas.Add(one);
        }
        var epoch = await Schema.LearnEpochAsync(connection, ctx.RequestAborted);
        var inAreas = string.Join(", ", areas.Select((_, i) => $"@a{i}"));

        await using var cmd = new SqlCommand($"""
            SELECT SYSDATETIMEOFFSET();
            SELECT TOP ({AreaPage + 1}) id, library_id, area_id, holder_role_id, holder_access_id, kind, sealed, key_for_area, created_at{(epoch ? ", area_epoch" : "")}
            FROM app.learn_batch
            WHERE area_id IN ({inAreas}) AND key_for_area IS NOT NULL AND kind NOT IN (N'flags', N'counts')
              {(library is null ? "" : "AND library_id = @library")}
              {(from is null ? "" : "AND created_at >= @since")}
              {AfterSql(cursor)}
            ORDER BY created_at, id;
            """, connection);
        for (var i = 0; i < areas.Count; i++) cmd.Parameters.AddWithValue($"@a{i}", areas[i]);
        if (library is not null) cmd.Parameters.AddWithValue("@library", library.Value);
        if (from is not null) cmd.Parameters.AddWithValue("@since", from.Value);
        AddAfter(cmd, cursor);
        await WriteBatchesAsync(ctx, cmd, forArea: true, AreaPage);
    }

    /// <summary>
    /// 2026-11-01 — WOHIN DIE ANTWORTEN ZU EINER BAZA GINGEN. Eine Baza steht in vielen Kursen und auf Seiten ohne
    /// Kurs; jeder Ort schickt die Antworten seiner Uczący się in seinen Bereich. Die Lehrerin wählt, wessen sie
    /// sieht — genannt werden nur Bereiche, die sie liest, und nur Zahlen: wie viele Lernende, wie viele Pakete,
    /// wann zuletzt. Öffnen kann sie sie weiter nur mit dem Schlüssel der Annahme.
    /// </summary>
    private static async Task AnswerAreasAsync(HttpContext ctx, Db db, Guid id)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        var caller = new Caller(who.Value.AccountId, mine);
        var libraryArea = await LibraryAreaAsync(connection, id, ctx.RequestAborted);
        if (libraryArea is null || !await Area.MayAsync(connection, caller, libraryArea.Value, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej biblioteki nie ma.");
            return;
        }

        var rows = new List<(Guid Area, int Learners, int Batches, DateTimeOffset Last)>();
        /* 0120 — die Antworten im Kleinbereich einer Person zählen für ihren virtuellen Bereich (dort wählt die Lehrerin). */
        var whereOf = await Schema.VirtualAreasAsync(connection, ctx.RequestAborted)
            ? "COALESCE((SELECT ai.virtual_area_id FROM app.area_instance ai WHERE ai.area_id = b.area_id), b.area_id)"
            : "b.area_id";
        await using (var cmd = new SqlCommand($"""
            SELECT x.place, COUNT(DISTINCT x.holder), COUNT(*), MAX(x.created_at)
            FROM (SELECT {whereOf} AS place, COALESCE(b.holder_role_id, b.holder_access_id) AS holder, b.created_at
                  FROM app.learn_batch b
                  WHERE b.library_id = @library AND b.key_for_area IS NOT NULL AND b.kind NOT IN (N'flags', N'counts')) x
            GROUP BY x.place;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@library", id);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
                rows.Add((reader.GetGuid(0), reader.GetInt32(1), reader.GetInt32(2), reader.GetDateTimeOffset(3)));
        }

        var areas = new List<object>();
        foreach (var row in rows.OrderByDescending(r => r.Last))
        {
            if (!await Area.MayAsync(connection, caller, row.Area, Capability.Read, ctx.RequestAborted)) continue;
            areas.Add(new { areaId = Ids.ToText(row.Area), learners = row.Learners, batches = row.Batches, lastAt = row.Last });
        }
        await ctx.Response.WriteAsJsonAsync(new { libraryId = Ids.ToText(id), areas });
    }

    public sealed record DueRequest(string? LibraryId, string? HolderRoleId, DateTimeOffset? DueAt, int DueCount);

    /// <summary>Wann wieder dran — die einzige offene Angabe; daraus wird die Erinnerung [E8, P03].</summary>
    private static async Task UpsertDueAsync(SqlConnection connection, Guid libraryId, Guid? role, Guid? seat, DateTimeOffset? dueAt, int count, CancellationToken ct)
    {
        var holder = role is not null ? "holder_role_id" : "holder_access_id";
        await using var cmd = new SqlCommand($"""
            UPDATE app.learn_due SET due_at = @due, due_count = @count, updated_at = SYSDATETIMEOFFSET()
             WHERE {holder} = @h AND library_id = @library;
            IF @@ROWCOUNT = 0
                INSERT INTO app.learn_due (id, holder_role_id, holder_access_id, library_id, due_at, due_count, updated_at)
                VALUES (NEWID(), @role, @seat, @library, @due, @count, SYSDATETIMEOFFSET());
            """, connection);
        cmd.Parameters.AddWithValue("@h", (object?)role ?? seat!.Value);
        cmd.Parameters.Add("@role", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)role ?? DBNull.Value;
        cmd.Parameters.Add("@seat", System.Data.SqlDbType.UniqueIdentifier).Value = (object?)seat ?? DBNull.Value;
        cmd.Parameters.AddWithValue("@library", libraryId);
        cmd.Parameters.AddWithValue("@due", (object?)dueAt ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@count", Math.Clamp(count, 0, 1_000_000));
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task DueAsync(HttpContext ctx, Db db, DueRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (!Guid.TryParse(body.LibraryId, out var libraryId) || !Guid.TryParse(body.HolderRoleId, out var role))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin powtórki.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == role) || Workspace.IsAccount(mine, role))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja osoba.");
            return;
        }
        var area = await LibraryAreaAsync(connection, libraryId, ctx.RequestAborted);
        if (area is null || !await Area.MayAsync(connection, new Caller(who.Value.AccountId, mine), area.Value, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej biblioteki nie ma.");
            return;
        }

        await UpsertDueAsync(connection, libraryId, role, null, body.DueAt, body.DueCount, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { libraryId = Ids.ToText(libraryId), dueAt = body.DueAt, dueCount = body.DueCount });
    }

    /// <summary>Wann was dran ist — je Bibliothek, mit dem versiegelten Namen (der Browser öffnet ihn).</summary>
    private static async Task MyDueAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        var due = new List<object>();
        if (mine.Count > 0)
        {
            var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT d.library_id, d.holder_role_id, d.due_at, d.due_count, d.updated_at, l.area_id, l.epoch, l.name_sealed
                FROM app.learn_due d JOIN app.library l ON l.id = d.library_id
                WHERE d.holder_role_id IN ({names})
                ORDER BY CASE WHEN d.due_at IS NULL THEN 1 ELSE 0 END, d.due_at;
                """, connection);
            for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                due.Add(new
                {
                    libraryId = Ids.ToText(reader.GetGuid(0)),
                    holderRoleId = Ids.ToText(reader.GetGuid(1)),
                    dueAt = reader.IsDBNull(2) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(2),
                    dueCount = reader.GetInt32(3),
                    updatedAt = reader.GetDateTimeOffset(4),
                    areaId = Ids.ToText(reader.GetGuid(5)),
                    epoch = reader.GetInt32(6),
                    nameSealed = Base64Url.Encode((byte[])reader[7])
                });
            }
        }
        await ctx.Response.WriteAsJsonAsync(new { now = DateTimeOffset.UtcNow, due });
    }

    /* -- Hinweise an die Autoren, ohne Namen [K4, D12] -------------------------------------------- */

    public sealed record ReportRequest(string? BatchId, string? Kind, string? Sealed, string? KeyForArea);

    /// <summary>
    /// EIN HINWEIS AN DIE AUTOREN — eine gemeldete Karte, Zahlen je Karte („viele
    /// bleiben hier hängen"). Versiegelt für die Annahme des Bereichs der
    /// Bibliothek; ohne Halter, also ohne Namen.
    /// </summary>
    private static async Task StoreReportAsync(HttpContext ctx, SqlConnection connection, Guid libraryId, Guid areaId, ReportRequest body)
    {
        var kind = (body.Kind ?? string.Empty).Trim();
        if (!Guid.TryParse(body.BatchId, out var id) || !Anonymous.Contains(kind)
            || !Blob(body.Sealed, MaxBatch, out var sealedBytes) || sealedBytes.Length < 32
            || !Blob(body.KeyForArea, MaxKey, out var forArea))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna uwaga.");
            return;
        }
        if (!await HasIntakeAsync(connection, areaId, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Autorzy tej biblioteki nie przyjmują jeszcze uwag.");
            return;
        }

        await using (var count = new SqlCommand("""
            SELECT COUNT(*) FROM app.learn_batch WHERE library_id = @library AND kind IN (N'flags', N'counts') AND created_at > DATEADD(day, -1, SYSDATETIMEOFFSET());
            """, connection))
        {
            count.Parameters.AddWithValue("@library", libraryId);
            if ((int)(await count.ExecuteScalarAsync(ctx.RequestAborted) ?? 0) >= 5000)
            {
                await Fail(ctx, StatusCodes.Status429TooManyRequests, "Na dziś to za dużo uwag dla tej biblioteki.");
                return;
            }
        }

        await using var cmd = new SqlCommand("""
            IF NOT EXISTS (SELECT 1 FROM app.learn_batch WHERE id = @id)
                INSERT INTO app.learn_batch (id, library_id, area_id, holder_role_id, holder_access_id, kind, sealed, key_for_holder, key_for_area, created_at)
                VALUES (@id, @library, @area, NULL, NULL, @kind, @sealed, NULL, @forArea, SYSDATETIMEOFFSET());
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@library", libraryId);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@kind", kind);
        cmd.Parameters.AddBlob("@sealed", sealedBytes);
        cmd.Parameters.AddBlob("@forArea", forArea);
        await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { batchId = Ids.ToText(id) });
    }

    private static async Task ReportAsync(HttpContext ctx, Db db, Guid id, ReportRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var caller = await Callers.OfAsync(ctx, db, connection);
        if (caller is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        var area = await LibraryAreaAsync(connection, id, ctx.RequestAborted);
        if (area is null || !await Area.MayAsync(connection, caller, area.Value, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej biblioteki nie ma.");
            return;
        }
        await StoreReportAsync(ctx, connection, id, area.Value, body);
    }

    private static async Task SeatReportAsync(HttpContext ctx, Db db, string token, Guid id, ReportRequest body)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        var area = seat is null ? null : await LibraryAreaAsync(connection, id, ctx.RequestAborted);
        if (seat is null || area is null || !await Library.SeatReadsAsync(connection, seat.Value.Id, area.Value, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej biblioteki nie ma.");
            return;
        }
        await StoreReportAsync(ctx, connection, id, area.Value, body);
    }

    /// <summary>Die Hinweise einer Bibliothek — für wer dort schreibt (die Autoren). 2026-11-05 (Durchsicht): seitenweise.</summary>
    private static async Task ReportsAsync(HttpContext ctx, Db db, Guid id, string? since, string? after)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (!SinceOf(since, out var from) || !AfterOf(after, out var cursor)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny stan."); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var area = await LibraryAreaAsync(connection, id, ctx.RequestAborted);
        if (area is null || !await Area.MayAsync(connection, who.Value.AccountId, area.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej biblioteki nie ma.");
            return;
        }

        await using var cmd = new SqlCommand($"""
            SELECT SYSDATETIMEOFFSET();
            SELECT TOP ({ReportPage + 1}) id, library_id, area_id, holder_role_id, holder_access_id, kind, sealed, key_for_area, created_at
            FROM app.learn_batch
            WHERE library_id = @library AND kind IN (N'flags', N'counts')
              {(from is null ? "" : "AND created_at >= @since")}
              {AfterSql(cursor)}
            ORDER BY created_at, id;
            """, connection);
        cmd.Parameters.AddWithValue("@library", id);
        if (from is not null) cmd.Parameters.AddWithValue("@since", from.Value);
        AddAfter(cmd, cursor);
        await WriteBatchesAsync(ctx, cmd, forArea: true, ReportPage);
    }

    /* -- Für einen Platz (ein Mensch ohne Konto, über sein Formular) ------------------------------- */

    /// <summary>Wohin ein Platz schreiben darf: sein Bereich und die Bereiche seiner Rollen.</summary>
    private static async Task<bool> SeatStoresAsync(SqlConnection connection, (Guid Id, Guid AreaId) seat, Guid areaId, CancellationToken ct) =>
        seat.AreaId == areaId || await Library.SeatReadsAsync(connection, seat.Id, areaId, ct);

    private static async Task SeatPostBatchesAsync(HttpContext ctx, Db db, string token, BatchesRequest body)
    {
        var given = body.Batches ?? [];
        if (given.Count == 0 || given.Count > MaxBatchesAtOnce)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Od 1 do {MaxBatchesAtOnce} pakietów naraz.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma."); return; }

        var stored = new List<string>();
        foreach (var one in given)
        {
            var (batch, problem) = Read(one, seat: true);
            if (batch is null) { await Fail(ctx, StatusCodes.Status400BadRequest, problem!); return; }

            var libraryArea = await LibraryAreaAsync(connection, batch.LibraryId, ctx.RequestAborted);
            if (libraryArea is null || !await Library.SeatReadsAsync(connection, seat.Value.Id, libraryArea.Value, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status404NotFound, "Takiej biblioteki nie ma.");
                return;
            }
            if (!await SeatStoresAsync(connection, seat.Value, batch.AreaId, ctx.RequestAborted)
                && !await InsideAsync(connection, batch.AreaId, (above) => SeatStoresAsync(connection, seat.Value, above, ctx.RequestAborted), ctx.RequestAborted))
            {
                await RefuseArea(ctx, "Postępy zapisuje się w obszarze Twojej grupy (albo w obszarze z przyjęciami wewnątrz niej).");
                return;
            }
            if (batch.AreaEpoch is not null && !await Schema.LearnEpochAsync(connection, ctx.RequestAborted))
            {
                await RefuseArea(ctx, "Odpowiedzi do obszaru osoby przyjmie usługa po migracji 0136.");
                return;
            }
            if (stored.Count == 0 && await TodayAsync(connection, null, seat.Value.Id, ctx.RequestAborted) + given.Count > MaxBatchesPerDay)
            {
                await Fail(ctx, StatusCodes.Status429TooManyRequests, "Na dziś to za dużo pakietów — reszta pójdzie jutro.");
                return;
            }

            await StoreAsync(connection, batch, null, seat.Value.Id, ctx.RequestAborted);
            stored.Add(Ids.ToText(batch.Id));
        }

        await ctx.Response.WriteAsJsonAsync(new { stored });
    }

    /// <summary>Die eigenen Stapel eines Platzes. 2026-11-05 (Durchsicht): seitenweise (<c>after</c>).</summary>
    private static async Task SeatBatchesAsync(HttpContext ctx, Db db, string token, string? libraryId, string? since, string? after)
    {
        if (!SinceOf(since, out var from) || !AfterOf(after, out var cursor)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny stan."); return; }
        Guid? library = Guid.TryParse(libraryId, out var l) ? l : null;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma."); return; }

        await using var cmd = new SqlCommand($"""
            SELECT SYSDATETIMEOFFSET();
            SELECT TOP ({OwnPage + 1}) id, library_id, area_id, holder_role_id, holder_access_id, kind, sealed, key_for_holder, created_at{(await Schema.LearnEpochAsync(connection, ctx.RequestAborted) ? ", area_epoch" : "")}
            FROM app.learn_batch
            WHERE holder_access_id = @seat
              {(library is null ? "" : "AND library_id = @library")}
              {(from is null ? "" : "AND created_at >= @since")}
              {AfterSql(cursor)}
            ORDER BY created_at, id;
            """, connection);
        cmd.Parameters.AddWithValue("@seat", seat.Value.Id);
        if (library is not null) cmd.Parameters.AddWithValue("@library", library.Value);
        if (from is not null) cmd.Parameters.AddWithValue("@since", from.Value);
        AddAfter(cmd, cursor);
        await WriteBatchesAsync(ctx, cmd, forArea: false, OwnPage);
    }

    private static async Task SeatDueAsync(HttpContext ctx, Db db, string token, DueRequest body)
    {
        if (!Guid.TryParse(body.LibraryId, out var libraryId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny termin powtórki.");
            return;
        }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        var area = seat is null ? null : await LibraryAreaAsync(connection, libraryId, ctx.RequestAborted);
        if (seat is null || area is null || !await Library.SeatReadsAsync(connection, seat.Value.Id, area.Value, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej biblioteki nie ma.");
            return;
        }
        await UpsertDueAsync(connection, libraryId, null, seat.Value.Id, body.DueAt, body.DueCount, ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { libraryId = Ids.ToText(libraryId), dueAt = body.DueAt, dueCount = body.DueCount });
    }

    /* -- Direkt veröffentlichen: `c/<kennung>` -------------------------------------------------- */

    public sealed record AddressRequest(string? RoleId);

    private const string AddressAlphabet = "abcdefghijkmnpqrstuvwxyz23456789";
    private const int MaxAddressesPerRole = 500;

    /// <summary>
    /// EINE ADRESSE FÜR EINEN BAUSTEIN [F20] — <c>c/&lt;acht zeichen&gt;</c>, auf
    /// die Rolle dessen, der veröffentlicht. Danach ist es eine Seite wie jede
    /// andere (er führt sie): der Browser legt den Baustein darauf, ohne dass
    /// jemand eine Seite von Hand baut. Die Wurzel <c>c</c> führt niemand.
    /// </summary>
    private static async Task PublishAddressAsync(HttpContext ctx, Db db, AddressRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (!Guid.TryParse(body.RoleId, out var roleId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelna rola.");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted);
        if (!mine.Any(r => r.Id == roleId))
        {
            await Fail(ctx, StatusCodes.Status403Forbidden, "To nie jest Twoja rola.");
            return;
        }
        if (Workspace.IsAccount(mine, roleId))
        {
            await Fail(ctx, StatusCodes.Status409Conflict, Workspace.AccountTakesNothing);
            return;
        }

        await using (var count = new SqlCommand(
            "SELECT COUNT(*) FROM app.slug WHERE claimed_by_role_id = @role AND path LIKE N'c/%';", connection))
        {
            count.Parameters.AddWithValue("@role", roleId);
            if ((int)(await count.ExecuteScalarAsync(ctx.RequestAborted) ?? 0) >= MaxAddressesPerRole)
            {
                await Fail(ctx, StatusCodes.Status429TooManyRequests, $"Ta rola ma już {MaxAddressesPerRole} opublikowanych adresów.");
                return;
            }
        }

        var now = DateTimeOffset.UtcNow;
        for (var attempt = 0; attempt < 8; attempt++)
        {
            var path = "c/" + RandomNumberGenerator.GetString(AddressAlphabet, 8);
            await using var insert = new SqlCommand("""
                IF NOT EXISTS (SELECT 1 FROM app.slug WHERE path = @path)
                    INSERT INTO app.slug (id, path, claim_code_sha256, note, created_at, claimed_by_role_id, claimed_by_account_id, claimed_at)
                    VALUES (NEWID(), @path, NULL, N'Published module', @now, @role, @account, @now);
                """, connection);
            insert.Parameters.AddWithValue("@path", path);
            insert.Parameters.AddWithValue("@now", now);
            insert.Parameters.AddWithValue("@role", roleId);
            insert.Parameters.AddWithValue("@account", who.Value.AccountId);
            try
            {
                if (await insert.ExecuteNonQueryAsync(ctx.RequestAborted) > 0)
                {
                    await ctx.Response.WriteAsJsonAsync(new { path, roleId = Ids.ToText(roleId), claimedAt = now });
                    return;
                }
            }
            catch (SqlException e) when (e.Number is 2601 or 2627)
            {
                // Zwei im selben Augenblick — noch einmal würfeln.
            }
        }

        await Fail(ctx, StatusCodes.Status409Conflict, "Nie udało się wylosować adresu — spróbuj jeszcze raz.");
    }

    /// <summary>Die direkt veröffentlichten Adressen der eigenen Rollen.</summary>
    private static async Task MyAddressesAsync(HttpContext ctx, Db db)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        var addresses = new List<object>();
        if (mine.Count > 0)
        {
            var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
            await using var cmd = new SqlCommand($"""
                SELECT s.path, s.claimed_by_role_id, s.claimed_at,
                       (SELECT COUNT(*) FROM app.slug_part p WHERE p.slug_id = s.id)
                FROM app.slug s
                WHERE s.path LIKE N'c/%' AND s.claimed_by_role_id IN ({names})
                ORDER BY s.claimed_at DESC;
                """, connection);
            for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                addresses.Add(new
                {
                    path = reader.GetString(0),
                    roleId = Ids.ToText(reader.GetGuid(1)),
                    claimedAt = reader.IsDBNull(2) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(2),
                    parts = reader.GetInt32(3)
                });
            }
        }
        await ctx.Response.WriteAsJsonAsync(new { addresses });
    }

    private static Task Fail(HttpContext ctx, int status, string message)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
