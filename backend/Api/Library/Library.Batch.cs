using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 2026-11-03 — VIELE EINTRÄGE IN EINEM ZUG, ALLE ODER KEINER (der Import einer Baza wiedzy).
///
/// <para>
/// Ein Import legt neue Rodzaje und Einträge an und ändert bestehende, die auf sie zeigen. Einzeln
/// gespeichert, blieb nach einem Fehler die Hälfte stehen — ein Feld, das auf einen Rodzaj zeigt, den
/// es nie gab. Hier geht der ganze Zapis in EINER Transaktion: jeder Eintrag wird geprüft (gehört er
/// dieser Bibliothek, ist sein Stand noch der, auf dem der Browser geändert hat), und nur, wenn alle
/// stimmen, wird geschrieben — in der Reihenfolge, in der sie kommen. Sonst bleibt alles, wie es war,
/// und die Antwort nennt jeden Eintrag, der nicht ging.
/// </para>
///
/// <para>
/// Wie <see cref="SaveAsync"/> je Eintrag: die alte Hülle bleibt als Fassung, der Dienst liest nichts.
/// </para>
/// </summary>
public static partial class Library
{
    /// <summary>Höchstens so viele Einträge in einem Zapis.</summary>
    public const int MaxSaveBatch = 5000;
    /// <summary>Höchstens so viele Bytes versiegelter Hüllen zusammen.</summary>
    public const long MaxSaveBatchBytes = 40L * 1024 * 1024;
    /// <summary>Wie gross die Anfrage sein darf (base64 und JSON um die Hüllen).</summary>
    private const long MaxSaveBatchRequest = 64L * 1024 * 1024;

    public sealed record SaveManyEntry(string? EntryId, string? Kind, int Epoch, string? Sealed, int Version);
    public sealed record SaveManyRequest(List<SaveManyEntry>? Entries);

    /// <summary>Ein geprüfter Eintrag eines Zapis.</summary>
    public sealed record SaveManyRow(Guid Id, string Kind, int Epoch, byte[] Sealed, int Version);

    private static void MapBatch(WebApplication app)
    {
        app.MapPost("/workspace/library/{id:guid}/entries/save", SaveManyAsync)
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(MaxSaveBatchRequest));
    }

    /// <summary>
    /// Was hereinkommt, ohne Datenbank geprüft (<c>Api.Tests/LibraryChecks.cs</c>): 1 bis <see cref="MaxSaveBatch"/>
    /// Einträge, jeder einmal, mit Art, Epoche, Hülle (48 Bytes bis 4 MB) und Stand; zusammen höchstens
    /// <see cref="MaxSaveBatchBytes"/>. Die Reihenfolge bleibt.
    /// </summary>
    public static (List<SaveManyRow>? Rows, string? Error) ReadSaveMany(SaveManyRequest? body)
    {
        var list = body?.Entries;
        if (list is null || list.Count == 0 || list.Count > MaxSaveBatch) return (null, $"Od 1 do {MaxSaveBatch} wpisów w jednym zapisie.");
        var rows = new List<SaveManyRow>(list.Count);
        var seen = new HashSet<Guid>();
        long total = 0;
        foreach (var one in list)
        {
            if (one is null || !Guid.TryParse(one.EntryId, out var id)) return (null, "Nieczytelny identyfikator wpisu.");
            var name = Ids.ToText(id);
            if (!seen.Add(id)) return (null, $"Wpis {name} stoi w zapisie dwa razy.");
            if (!IsKind(one.Kind)) return (null, $"Nieznany rodzaj wpisu {name}.");
            if (one.Epoch < 1) return (null, "Nie ma takiej epoki obszaru.");
            if (one.Version < 0) return (null, $"Nieczytelny stan wpisu {name}.");
            if (!Base64Url.TryDecode(one.Sealed, out var bytes) || bytes.Length is < 48 or > (int)MaxSealed)
                return (null, $"Zapieczętowany wpis {name} musi mieć najwyżej 4 MB.");
            total += bytes.Length;
            if (total > MaxSaveBatchBytes) return (null, $"Zapis jest za duży (więcej niż {MaxSaveBatchBytes / (1024 * 1024)} MB) — podziel go na mniejsze części.");
            rows.Add(new SaveManyRow(id, one.Kind!, one.Epoch, bytes, one.Version));
        }
        return (rows, null);
    }

    /// <summary>Ein Problem eines Eintrags, wie die Antwort es nennt.</summary>
    public sealed record SaveManyProblem(string EntryId, string Error, int? Version);

    /// <summary>
    /// Welche Einträge nicht gehen, aus dem, was die Datenbank für sie hält (<paramref name="had"/>: Bibliothek und Stand
    /// der vorhandenen) — leer, wenn alle gehen. Ohne Datenbank prüfbar.
    /// </summary>
    public static List<SaveManyProblem> SaveManyProblems(Guid library, IReadOnlyList<SaveManyRow> rows, IReadOnlyDictionary<Guid, (Guid Library, int Version)> had)
    {
        var problems = new List<SaveManyProblem>();
        foreach (var row in rows)
        {
            var name = Ids.ToText(row.Id);
            if (had.TryGetValue(row.Id, out var now))
            {
                if (now.Library != library) problems.Add(new SaveManyProblem(name, "należy do innej biblioteki", null));
                else if (now.Version != row.Version) problems.Add(new SaveManyProblem(name, "ktoś zmienił go w międzyczasie", now.Version));
            }
            else if (row.Version != 0)
            {
                problems.Add(new SaveManyProblem(name, "nie ma go już w bibliotece", 0));
            }
        }
        return problems;
    }

    private static async Task SaveManyAsync(HttpContext ctx, Db db, Guid id, SaveManyRequest body)
    {
        var who = await Auth.WhoAsync(ctx, db);
        if (who is null) { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }

        var (rows, error) = ReadSaveMany(body);
        if (rows is null)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Nic nie zapisano: {error}");
            return;
        }

        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        var library = await AllowedAsync(ctx, connection, who.Value.AccountId, id, Capability.Write);
        if (library is null) return;
        if (rows.Any(r => r.Epoch > library.Value.CurrentEpoch))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Nic nie zapisano: nie ma takiej epoki obszaru.");
            return;
        }

        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ctx.RequestAborted);

        /* Was es schon gibt — gesperrt bis zum Ende, damit niemand dazwischen schreibt (auch keinen neuen mit derselben Kennung). */
        var had = new Dictionary<Guid, (Guid Library, int Version)>();
        foreach (var chunk in rows.Chunk(500))
        {
            var names = string.Join(", ", chunk.Select((_, i) => $"@i{i}"));
            await using var read = new SqlCommand(
                $"SELECT id, library_id, version FROM app.library_entry WITH (UPDLOCK, HOLDLOCK) WHERE id IN ({names});", connection, tx);
            for (var i = 0; i < chunk.Length; i++) read.Parameters.AddWithValue($"@i{i}", chunk[i].Id);
            await using var reader = await read.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) had[reader.GetGuid(0)] = (reader.GetGuid(1), reader.GetInt32(2));
        }

        var problems = SaveManyProblems(id, rows, had);
        if (problems.Count > 0)
        {
            await tx.RollbackAsync(ctx.RequestAborted);
            ctx.Response.StatusCode = StatusCodes.Status409Conflict;
            var stale = problems.Any(p => p.Version is not null);
            await ctx.Response.WriteAsJsonAsync(new
            {
                error = $"Nic nie zapisano: {problems.Count} {(problems.Count == 1 ? "wpis nie może" : "wpisów nie może")} być zapisanych ({string.Join("; ", problems.Take(5).Select(p => $"{p.EntryId}: {p.Error}"))}{(problems.Count > 5 ? "; …" : "")}).",
                verdict = stale ? "stale" : "conflict",
                problems = problems.Select(p => new { entryId = p.EntryId, error = p.Error, version = p.Version })
            });
            return;
        }

        var added = rows.Count(r => !had.ContainsKey(r.Id));
        if (added > 0)
        {
            await using var count = new SqlCommand("SELECT COUNT(*) FROM app.library_entry WHERE library_id = @library;", connection, tx);
            count.Parameters.AddWithValue("@library", id);
            if ((int)(await count.ExecuteScalarAsync(ctx.RequestAborted))! + added > MaxEntries)
            {
                await tx.RollbackAsync(ctx.RequestAborted);
                await Fail(ctx, StatusCodes.Status400BadRequest, $"Nic nie zapisano: biblioteka miałaby więcej niż {MaxEntries} wpisów.");
                return;
            }
        }

        var now = DateTimeOffset.UtcNow;
        var saved = new List<object>(rows.Count);
        foreach (var row in rows)
        {
            var exists = had.TryGetValue(row.Id, out var before);
            /* 0109 — was überschrieben wird, bleibt als Fassung (wie beim einzelnen Speichern). */
            await using var save = new SqlCommand(exists
                ? """
                  INSERT INTO app.library_entry_version (entry_id, version, kind, epoch, sealed, written_at, written_by_account_id)
                  SELECT id, version, kind, epoch, sealed, updated_at, written_by_account_id
                    FROM app.library_entry
                   WHERE id = @id AND sealed IS NOT NULL
                     AND NOT EXISTS (SELECT 1 FROM app.library_entry_version v WHERE v.entry_id = @id AND v.version = app.library_entry.version);
                  UPDATE app.library_entry
                     SET kind = @kind, epoch = @epoch, sealed = @sealed, version = version + 1,
                         updated_at = @now, deleted_at = NULL, written_by_account_id = @account
                   WHERE id = @id;
                  """
                : """
                  INSERT INTO app.library_entry (id, library_id, kind, epoch, sealed, version, created_at, updated_at, written_by_account_id)
                  VALUES (@id, @library, @kind, @epoch, @sealed, 1, @now, @now, @account);
                  """, connection, tx);
            save.Parameters.AddWithValue("@id", row.Id);
            save.Parameters.AddWithValue("@library", id);
            save.Parameters.AddWithValue("@kind", row.Kind);
            save.Parameters.AddWithValue("@epoch", row.Epoch);
            save.Parameters.AddBlob("@sealed", row.Sealed);
            save.Parameters.AddWithValue("@now", now);
            save.Parameters.AddWithValue("@account", who.Value.AccountId);
            await save.ExecuteNonQueryAsync(ctx.RequestAborted);
            saved.Add(new { entryId = Ids.ToText(row.Id), version = (exists ? before.Version : 0) + 1, updatedAt = now });
        }

        await tx.CommitAsync(ctx.RequestAborted);
        await ctx.Response.WriteAsJsonAsync(new { saved = saved.Count, entries = saved });
    }
}
