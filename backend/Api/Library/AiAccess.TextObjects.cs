using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Kernel;
using Microsoft.Data.SqlClient;

namespace Api;

/// <summary>
/// 2026-11-22 (0145) — DIE VOLLSTÄNDIGEN TEXTE ALS EIGENE STÜCKE (Abschrift Format 2).
///
/// <para>
/// <b>Warum.</b> Bis Format 1 trug die Abschrift eines Behälters alle seine Texte; über 30 MB (gepackt) fielen ALLE weg
/// (<c>textsOmitted</c>) — ein grosses Buch machte jedes kleine unlesbar. Jetzt trägt die Abschrift nur das Verzeichnis der
/// Texte; die Blöcke liegen in Stücken (<c>app.ai_access_text</c>): je Teil eines Textes eines oder mehrere, je höchstens
/// <see cref="MaxTextObject"/>, inhaltlich adressiert (SHA-256 des JSON). Die Lesbarkeit eines Textes hängt nur noch an seinen
/// eigenen Stücken.
/// </para>
///
/// <para>
/// <b>Hinaufladen</b> (der Browser, wer im Bereich schreibt, <c>aiAccess.ts</c>): erst fragen, welche Stücke schon da sind
/// (<c>GET …/texts</c>), nur die neuen laden (<c>PUT …/text/{hash}</c>), DANN das Verzeichnis (<c>PUT …/part/{lib}</c>, wie bisher),
/// zuletzt die nicht mehr genannten löschen (<c>POST …/texts/keep</c>) — so zeigt ein Verzeichnis nie auf ein Stück, das noch
/// nicht da ist. Gelöscht wird nur, was älter als <see cref="KeepYoung"/> ist: ein zweiter Browser, der gerade baut, verliert nichts.
/// </para>
///
/// <para>
/// <b>Lesen</b> (MCP): ein Stück wird erst geholt, wenn ein Werkzeug seine Blöcke braucht (<see cref="EnsureAsync"/>), mit dem
/// Schlüssel C aus dem Link — wie die Abschrift selbst — und geprüft (der Hash muss stimmen).
/// </para>
/// </summary>
public static partial class AiAccess
{
    /// <summary>Höchstens so gross ist ein Stück (versiegelt). Der Browser schneidet Teile kleiner (<c>CHUNK_JSON</c> in aiSnapshot.ts).</summary>
    public const int MaxTextObject = 8 * 1024 * 1024;
    /// <summary>Höchstens so viele Bytes Stücke liest ein Aufruf (entpackt) — darüber sagt er, wo er weitermacht.</summary>
    public const long MaxTextLoadPerCall = 96L * 1024 * 1024;
    /// <summary>Höchstens so gross ist ein Stück entpackt.</summary>
    private const long MaxTextOpened = 64L * 1024 * 1024;
    /// <summary>So jung bleibt ein Stück beim Aufräumen stehen, auch wenn das neue Verzeichnis es nicht nennt.</summary>
    private static readonly TimeSpan KeepYoung = TimeSpan.FromMinutes(30);

    public static Aad TextAad(Guid libraryId) => Aad.Create("ai", "text", libraryId, Field.AiText, 1);

    private static bool IsHash(string? hash) => hash is { Length: 64 } && hash.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');

    internal static void MapTextObjects(WebApplication app)
    {
        app.MapGet("/workspace/area/{areaId:guid}/ai-access/{id:guid}/part/{libraryId:guid}/texts", ListTextObjectsAsync);
        app.MapPut("/workspace/area/{areaId:guid}/ai-access/{id:guid}/part/{libraryId:guid}/text/{hash}", UploadTextObjectAsync);
        app.MapPost("/workspace/area/{areaId:guid}/ai-access/{id:guid}/part/{libraryId:guid}/texts/keep", KeepTextObjectsAsync);
    }

    /// <summary>Der Zugang deckt den Behälter, sein Schlüssel und wann er abläuft — oder die Antwort ist schon gegeben.</summary>
    private static async Task<(byte[] KeyId, DateTimeOffset Expires)?> PartKeyAsync(HttpContext ctx, Db db, SqlConnection connection, Guid areaId, Guid id, Guid libraryId)
    {
        if (await AllowedAsync(ctx, db, connection, areaId, Capability.Write) is null) return null;
        await using var cmd = new SqlCommand("""
            SELECT a.key_id, a.expires_at FROM app.ai_access a
            JOIN app.ai_access_part p ON p.access_id = a.id AND p.library_id = @library
            WHERE a.id = @id AND a.area_id = @area AND a.key_wrapped IS NOT NULL;
            """, connection);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@area", areaId);
        cmd.Parameters.AddWithValue("@library", libraryId);
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        if (!await reader.ReadAsync(ctx.RequestAborted))
        {
            await Fail(ctx, StatusCodes.Status404NotFound, "Ten dostęp nie obejmuje tego zbioru.");
            return null;
        }
        return ((byte[])reader[0], reader.GetDateTimeOffset(1));
    }

    /// <summary>Welche Stücke dieser Zugang für den Behälter schon hat (ihre Hashes) — der Browser lädt nur die anderen.</summary>
    private static async Task ListTextObjectsAsync(HttpContext ctx, Db db, Guid areaId, Guid id, Guid libraryId)
    {
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await PartKeyAsync(ctx, db, connection, areaId, id, libraryId) is null) return;
        var hashes = new List<string>();
        await using (var cmd = new SqlCommand("SELECT hash FROM app.ai_access_text WHERE access_id = @id AND library_id = @library;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@library", libraryId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) hashes.Add(reader.GetString(0));
        }
        ctx.Response.Headers.CacheControl = "no-store";
        await ctx.Response.WriteAsJsonAsync(new { hashes, max = MaxTextObject });
    }

    /// <summary>Ein Stück hinaufladen: die Hülle selbst (gzip-JSON unter C, AAD des Behälters). Schon da: nichts zu tun.</summary>
    private static async Task UploadTextObjectAsync(HttpContext ctx, Db db, Guid areaId, Guid id, Guid libraryId, string hash)
    {
        var limit = ctx.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
        if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = MaxTextObject;
        if (!IsHash(hash))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Adres fragmentu to 64 znaki szesnastkowe (SHA-256).");
            return;
        }
        if (ctx.Request.ContentType != "application/octet-stream" || ctx.Request.ContentLength is not long size
            || size < Crypto.HeaderSize + Crypto.NonceSize + Crypto.TagSize || size > MaxTextObject)
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, $"Fragment tekstu może mieć najwyżej {MaxTextObject / (1024 * 1024)} MB.");
            return;
        }
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await PartKeyAsync(ctx, db, connection, areaId, id, libraryId) is not var (keyId, expires)) return;
        if (expires <= DateTimeOffset.UtcNow)
        {
            await Fail(ctx, StatusCodes.Status409Conflict, "Ten link wygasł — najpierw go przedłuż.");
            return;
        }
        var blob = new byte[size];
        await ctx.Request.Body.ReadExactlyAsync(blob, ctx.RequestAborted);
        if (!IsSealed(blob) || !Crypto.ReadHeader(blob).KeyId.AsSpan().SequenceEqual(keyId))
        {
            await Fail(ctx, StatusCodes.Status400BadRequest, "Fragment nie jest zapieczętowany kluczem tego dostępu.");
            return;
        }
        await using (var cmd = new SqlCommand("""
            IF NOT EXISTS (SELECT 1 FROM app.ai_access_text WHERE access_id = @id AND library_id = @library AND hash = @hash)
                INSERT INTO app.ai_access_text (access_id, library_id, hash, blob, size) VALUES (@id, @library, @hash, @blob, @size);
            ELSE
                UPDATE app.ai_access_text SET made_at = SYSDATETIMEOFFSET() WHERE access_id = @id AND library_id = @library AND hash = @hash;
            """, connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@library", libraryId);
            cmd.Parameters.Add("@hash", SqlDbType.Char, 64).Value = hash;
            cmd.Parameters.AddBlob("@blob", blob);
            cmd.Parameters.AddWithValue("@size", (int)size);
            await cmd.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        await ctx.Response.WriteAsJsonAsync(new { hash, bytes = size });
    }

    public sealed record KeepRequest(IReadOnlyList<string>? Hashes);

    /// <summary>Nach dem neuen Verzeichnis: was es nicht mehr nennt, fort (nur, was älter ist als <see cref="KeepYoung"/>).</summary>
    private static async Task KeepTextObjectsAsync(HttpContext ctx, Db db, Guid areaId, Guid id, Guid libraryId, KeepRequest body)
    {
        var keep = (body.Hashes ?? []).Where(IsHash).Distinct().ToList();
        await using var connection = await db.OpenAsync(ctx.RequestAborted);
        if (await PartKeyAsync(ctx, db, connection, areaId, id, libraryId) is null) return;
        var have = new List<(string Hash, DateTimeOffset At)>();
        await using (var cmd = new SqlCommand("SELECT hash, made_at FROM app.ai_access_text WHERE access_id = @id AND library_id = @library;", connection))
        {
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@library", libraryId);
            await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
            while (await reader.ReadAsync(ctx.RequestAborted)) have.Add((reader.GetString(0), reader.GetDateTimeOffset(1)));
        }
        var kept = keep.ToHashSet(StringComparer.Ordinal);
        var young = DateTimeOffset.UtcNow - KeepYoung;
        var gone = have.Where(h => !kept.Contains(h.Hash) && h.At < young).Select(h => h.Hash).ToList();
        foreach (var batch in gone.Chunk(200))
        {
            await using var del = new SqlCommand($"DELETE FROM app.ai_access_text WHERE access_id = @id AND library_id = @library AND hash IN ({string.Join(",", batch.Select((_, i) => $"@h{i}"))});", connection);
            del.Parameters.AddWithValue("@id", id);
            del.Parameters.AddWithValue("@library", libraryId);
            for (var i = 0; i < batch.Length; i += 1) del.Parameters.Add($"@h{i}", SqlDbType.Char, 64).Value = batch[i];
            await del.ExecuteNonQueryAsync(ctx.RequestAborted);
        }
        await ctx.Response.WriteAsJsonAsync(new { kept = have.Count - gone.Count, deleted = gone.Count });
    }

    /* -- Lesen: ein Stück erst, wenn es gebraucht wird --------------------------------------------------- */

    /// <summary>Warum ein Text (gerade) nicht lesbar ist — mit Zahlen, die der Assistent dem Menschen sagen kann.</summary>
    public sealed class TextUnavailable(string message) : Exception(message);

    /// <summary>Ein Stück öffnen und prüfen: entpackt, Hash stimmt, Blöcke lesbar. Rein (ohne Netz) — Api.Tests.</summary>
    public static List<TextBlock> OpenTextObject(byte[] key, Guid libraryId, string hash, byte[] sealedBlob, int firstIndex)
    {
        var json = Gunzip(Crypto.Open(key, TextAad(libraryId), sealedBlob), MaxTextOpened);
        if (!string.Equals(Convert.ToHexString(SHA256.HashData(json)), hash, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Fragment tekstu nie zgadza się ze swoim adresem.");
        using var doc = JsonDocument.Parse(json);
        return BlocksOf(doc.RootElement.TryGetProperty("blocks", out var blocks) ? blocks : default, firstIndex);
    }

    /// <summary>
    /// Die Blöcke eines Teils bereitstellen (Format 2: seine Stücke holen; Format 1: schon da). Zählt gegen das Budget des
    /// Aufrufs; was nicht geht, sagt <see cref="TextUnavailable"/> — nur für diesen Text.
    /// </summary>
    public static async Task EnsureAsync(TextDoc text, TextPart part, CancellationToken ct)
    {
        if (part.Loaded) return;
        if (text.State != "readable") throw new TextUnavailable(UnreadableWhy(text));
        var loader = text.From.LoadText ?? throw new TextUnavailable($"text exists but is not readable: its content is not available in this snapshot (text {text.Id}).");
        var budget = text.From.Budget;
        if (budget is not null && budget.Bytes + part.Bytes > MaxTextLoadPerCall && budget.Bytes > 0)
            throw new TextUnavailable($"budget: this call already read {budget.Bytes / (1024 * 1024)} MB of text; ask again for part „{part.Key}” of this text alone.");
        var blocks = new List<TextBlock>();
        foreach (var chunk in part.Chunks)
        {
            var loaded = await loader(chunk.Hash, chunk.From, ct)
                ?? throw new TextUnavailable($"text exists but is not readable: part „{part.Key}” was not uploaded completely (state not_uploaded) — the owner's next snapshot rebuild repairs it.");
            blocks.AddRange(loaded);
            if (budget is not null) budget.Bytes += chunk.Bytes;
        }
        part.Blocks.Clear();
        part.Blocks.AddRange(blocks.OrderBy(b => b.Index));
        part.Loaded = true;
    }

    /// <summary>Was ein nicht lesbarer Text sagt: der Grund, Wörter, Bytes, die Grenze.</summary>
    public static string UnreadableWhy(TextDoc text) => text.Reason switch
    {
        "too_large" => $"text exists but is not readable: too large, {text.Words} words / {text.Bytes} bytes, limit {text.Limit} bytes per piece",
        "excluded" => "text exists but is not readable: its owner switched it off for AI (\"available to AI\" in the Library)",
        "not_uploaded" => $"text exists but is not readable: not uploaded completely ({text.Words} words / {text.Bytes} bytes) — the next snapshot rebuild repairs it",
        "omitted" => "text exists but is not readable: the collection's snapshot is in the old format, where its full texts were too large together — the next snapshot rebuild (any change in the collection, or \"Odśwież\" in Dostęp dla AI) makes every text readable on its own",
        _ => $"text exists but is not readable ({text.Reason ?? "unknown"})"
    };

    /// <summary>Ein Stück aus der Tabelle holen und öffnen — `null`: nicht da oder nicht zu öffnen (für diesen Text, nicht für den Aufruf).</summary>
    internal static Func<string, int, CancellationToken, Task<List<TextBlock>?>> TextLoader(Db db, Guid accessId, Guid libraryId, byte[] key) => async (hash, from, ct) =>
    {
        if (!IsHash(hash)) return null;
        byte[]? blob = null;
        await using (var connection = await db.OpenAsync(ct))
        await using (var cmd = new SqlCommand("SELECT blob FROM app.ai_access_text WHERE access_id = @id AND library_id = @library AND hash = @hash;", connection))
        {
            cmd.Parameters.AddWithValue("@id", accessId);
            cmd.Parameters.AddWithValue("@library", libraryId);
            cmd.Parameters.Add("@hash", SqlDbType.Char, 64).Value = hash;
            if (await cmd.ExecuteScalarAsync(ct) is byte[] found) blob = found;
        }
        if (blob is null) return null;
        try { return OpenTextObject(key, libraryId, hash, blob, from); }
        catch (Exception e) when (e is DecryptException or InvalidDataException or JsonException) { return null; }
    };

    /// <summary>Was ein Aufruf schon gelesen hat (je Aufruf, über alle Behälter).</summary>
    public sealed class LoadBudget { public long Bytes { get; set; } }
}
