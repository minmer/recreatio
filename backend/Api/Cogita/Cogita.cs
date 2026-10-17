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
    private const int MaxBatchesPerDay = 400;
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

    public static void Map(WebApplication app)
    {
        app.MapPost("/workspace/learn/batches", PostBatchesAsync);
        app.MapGet("/workspace/learn/batches", MyBatchesAsync);
        app.MapGet("/workspace/learn/area/{areaId:guid}/batches", AreaBatchesAsync);
        app.MapPost("/workspace/learn/due", DueAsync);
        app.MapGet("/workspace/learn/due", MyDueAsync);
        app.MapPost("/workspace/learn/library/{id:guid}/report", ReportAsync);
        app.MapGet("/workspace/learn/library/{id:guid}/reports", ReportsAsync);

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

    public sealed record BatchIn(
        string? BatchId, string? LibraryId, string? AreaId, string? Kind, string? HolderRoleId,
        string? Sealed, string? KeyForHolder, string? KeyForArea);

    public sealed record BatchesRequest(IReadOnlyList<BatchIn>? Batches);

    private sealed record Batch(Guid Id, Guid LibraryId, Guid AreaId, string Kind, byte[] Sealed, byte[]? KeyForHolder, byte[]? KeyForArea, Guid? HolderRole);

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
        return (new Batch(id, library, area, kind, sealedBytes, forHolder, forArea, holder), null);
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
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ct);
        var holder = role is not null ? "holder_role_id" : "holder_access_id";
        await using (var cmd = new SqlCommand($"""
            IF NOT EXISTS (SELECT 1 FROM app.learn_batch WHERE id = @id)
            BEGIN
                {(Latest.Contains(batch.Kind) ? $"DELETE FROM app.learn_batch WHERE {holder} = @h AND library_id = @library AND area_id = @area AND kind = @kind;" : "")}
                INSERT INTO app.learn_batch (id, library_id, area_id, holder_role_id, holder_access_id, kind, sealed, key_for_holder, key_for_area, created_at)
                VALUES (@id, @library, @area, @role, @seat, @kind, @sealed, @forHolder, @forArea, SYSDATETIMEOFFSET());
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
            if (!await Reads(batch.AreaId))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Postępy zapisuje się w obszarze, który czytasz.");
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

    private static async Task WriteBatchesAsync(HttpContext ctx, SqlCommand cmd, bool forArea)
    {
        var batches = new List<object>();
        await using (var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted))
        {
            while (await reader.ReadAsync(ctx.RequestAborted))
            {
                batches.Add(new
                {
                    batchId = Ids.ToText(reader.GetGuid(0)),
                    libraryId = Ids.ToText(reader.GetGuid(1)),
                    areaId = Ids.ToText(reader.GetGuid(2)),
                    holderRoleId = reader.IsDBNull(3) ? null : Ids.ToText(reader.GetGuid(3)),
                    holderSeatId = reader.IsDBNull(4) ? null : Ids.ToText(reader.GetGuid(4)),
                    kind = reader.GetString(5),
                    @sealed = Base64Url.Encode((byte[])reader[6]),
                    key = reader.IsDBNull(7) ? null : Base64Url.Encode((byte[])reader[7]),
                    createdAt = reader.GetDateTimeOffset(8)
                });
            }
        }
        await ctx.Response.WriteAsJsonAsync(new { now = DateTimeOffset.UtcNow, forArea, batches });
    }

    private static bool SinceOf(string? since, out DateTimeOffset? from)
    {
        from = null;
        if (string.IsNullOrWhiteSpace(since)) return true;
        if (!DateTimeOffset.TryParse(since, out var parsed)) return false;
        from = parsed.AddSeconds(-2);
        return true;
    }

    /// <summary>Die eigenen Stapel — aller Personen dieses Kontos, mit ihrem Schlüssel für den Halter.</summary>
    private static async Task MyBatchesAsync(HttpContext ctx, Db db, string? libraryId, string? since)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (!SinceOf(since, out var from)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny stan."); return; }
        Guid? library = Guid.TryParse(libraryId, out var l) ? l : null;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var mine = (await Workspace.RolesOfAsync(connection, who.Value.AccountId, ctx.RequestAborted)).Select(r => r.Id).ToList();
        if (mine.Count == 0) { await ctx.Response.WriteAsJsonAsync(new { now = DateTimeOffset.UtcNow, forArea = false, batches = Array.Empty<object>() }); return; }

        var names = string.Join(", ", mine.Select((_, i) => $"@r{i}"));
        await using var cmd = new SqlCommand($"""
            SELECT TOP 5000 id, library_id, area_id, holder_role_id, holder_access_id, kind, sealed, key_for_holder, created_at
            FROM app.learn_batch
            WHERE holder_role_id IN ({names})
              {(library is null ? "" : "AND library_id = @library")}
              {(from is null ? "" : "AND created_at >= @since")}
            ORDER BY created_at;
            """, connection);
        for (var i = 0; i < mine.Count; i++) cmd.Parameters.AddWithValue($"@r{i}", mine[i]);
        if (library is not null) cmd.Parameters.AddWithValue("@library", library.Value);
        if (from is not null) cmd.Parameters.AddWithValue("@since", from.Value);
        await WriteBatchesAsync(ctx, cmd, forArea: false);
    }

    /// <summary>
    /// FÜR DIE KANZLEI, die Lehrerin [E10]: was in einem Bereich liegt, den sie
    /// liest — mit dem Schlüssel für die Annahme. Öffnen kann es nur, wer die
    /// Rolle hält, für die die Annahme gemacht wurde.
    /// </summary>
    private static async Task AreaBatchesAsync(HttpContext ctx, Db db, Guid areaId, string? libraryId, string? since)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (!SinceOf(since, out var from)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny stan."); return; }
        Guid? library = Guid.TryParse(libraryId, out var l) ? l : null;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (!await Area.MayAsync(connection, who.Value.AccountId, areaId, Capability.Read, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiego obszaru nie ma.");
            return;
        }

        await using var cmd = new SqlCommand($"""
            SELECT TOP 20000 id, library_id, area_id, holder_role_id, holder_access_id, kind, sealed, key_for_area, created_at
            FROM app.learn_batch
            WHERE area_id = @area AND key_for_area IS NOT NULL AND kind NOT IN (N'flags', N'counts')
              {(library is null ? "" : "AND library_id = @library")}
              {(from is null ? "" : "AND created_at >= @since")}
            ORDER BY created_at;
            """, connection);
        cmd.Parameters.AddWithValue("@area", areaId);
        if (library is not null) cmd.Parameters.AddWithValue("@library", library.Value);
        if (from is not null) cmd.Parameters.AddWithValue("@since", from.Value);
        await WriteBatchesAsync(ctx, cmd, forArea: true);
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

    /// <summary>Die Hinweise einer Bibliothek — für wer dort schreibt (die Autoren).</summary>
    private static async Task ReportsAsync(HttpContext ctx, Db db, Guid id, string? since)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        if (!SinceOf(since, out var from)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny stan."); return; }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var area = await LibraryAreaAsync(connection, id, ctx.RequestAborted);
        if (area is null || !await Area.MayAsync(connection, who.Value.AccountId, area.Value, Capability.Write, ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Takiej biblioteki nie ma.");
            return;
        }

        await using var cmd = new SqlCommand($"""
            SELECT TOP 10000 id, library_id, area_id, holder_role_id, holder_access_id, kind, sealed, key_for_area, created_at
            FROM app.learn_batch
            WHERE library_id = @library AND kind IN (N'flags', N'counts')
              {(from is null ? "" : "AND created_at >= @since")}
            ORDER BY created_at;
            """, connection);
        cmd.Parameters.AddWithValue("@library", id);
        if (from is not null) cmd.Parameters.AddWithValue("@since", from.Value);
        await WriteBatchesAsync(ctx, cmd, forArea: true);
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
            if (!await SeatStoresAsync(connection, seat.Value, batch.AreaId, ctx.RequestAborted))
            {
                await Fail(ctx, StatusCodes.Status403Forbidden, "Postępy zapisuje się w obszarze Twojej grupy.");
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

    private static async Task SeatBatchesAsync(HttpContext ctx, Db db, string token, string? libraryId, string? since)
    {
        if (!SinceOf(since, out var from)) { await Fail(ctx, StatusCodes.Status400BadRequest, "Nieczytelny stan."); return; }
        Guid? library = Guid.TryParse(libraryId, out var l) ? l : null;

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var seat = await Seat.LiveSeatAsync(connection, token, gated: true, ctx.RequestAborted);
        if (seat is null) { await Fail(ctx, StatusCodes.Status404NotFound, "Tego miejsca nie ma."); return; }

        await using var cmd = new SqlCommand($"""
            SELECT TOP 5000 id, library_id, area_id, holder_role_id, holder_access_id, kind, sealed, key_for_holder, created_at
            FROM app.learn_batch
            WHERE holder_access_id = @seat
              {(library is null ? "" : "AND library_id = @library")}
              {(from is null ? "" : "AND created_at >= @since")}
            ORDER BY created_at;
            """, connection);
        cmd.Parameters.AddWithValue("@seat", seat.Value.Id);
        if (library is not null) cmd.Parameters.AddWithValue("@library", library.Value);
        if (from is not null) cmd.Parameters.AddWithValue("@since", from.Value);
        await WriteBatchesAsync(ctx, cmd, forArea: false);
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
