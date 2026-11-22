using System.Collections.Concurrent;
using System.ComponentModel;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace Api;

/// <summary>
/// 2026-11-22 — EIN GROSSES DOKUMENT AN <c>check_import</c>, OHNE DASS ES DURCH DIE ARGUMENTE EINES WERKZEUGS MUSS.
///
/// <para>
/// Ein Assistent schreibt Argumente in begrenzter Länge; ein Dokument von einigen MB in Teilen durch das Gespräch zu
/// schicken kostet Dutzende Aufrufe. Darum: <c>start_upload</c> gibt eine Adresse mit einem einmaligen Geheimnis
/// (<c>POST {api}/ai/upload/{token}</c>, eine halbe Stunde gültig), an die ein Assistent mit einer Shell die Datei
/// schickt (<c>curl --data-binary @datei.json</c>, gern gzip). Danach <c>check_import(format, upload)</c> ohne
/// <c>document</c>. Das Geheimnis IST die Berechtigung (wie ein Zugangslink) — der OAuth-Ausweis des Assistenten liegt
/// in seinem Programm, nicht bei ihm. Nur im Speicher, nichts in der Datenbank, je Verbindung höchstens vier.
/// </para>
/// </summary>
public sealed partial class AiMcpTools
{
    public sealed record StartUploadResult(string Upload, string Url, string ExpiresAt, int MaxCharacters, string HowTo);

    private sealed class StoredUpload(string caller, string id)
    {
        public readonly string Caller = caller;
        public readonly string Id = id;
        public readonly DateTime At = DateTime.UtcNow;
        public string? Text;
    }

    /// <summary>Nach Geheimnis (für die Adresse) — die Kennung <c>Id</c> nennt <c>check_import</c>.</summary>
    private static readonly ConcurrentDictionary<string, StoredUpload> StoredUploads = new();

    private static void DropOldUploads()
    {
        foreach (var old in StoredUploads.Where(kv => DateTime.UtcNow - kv.Value.At > UploadKeep).Select(kv => kv.Key).ToList()) StoredUploads.TryRemove(old, out _);
    }

    [McpServerTool(Name = "start_upload", Title = "Adres do wysłania dużego dokumentu", ReadOnly = false, Destructive = false, Idempotent = false, OpenWorld = false, UseStructuredContent = true)]
    [Description("For a LARGE JSON document (more than ~100 kB) that check_import should check: returns a one-time address. Send the file there with an HTTP POST from a shell — e.g. curl -X POST --data-binary @world.json \"<url>\" (add -H \"Content-Encoding: gzip\" for a gzipped file) — then call check_import with format and upload (this id) and WITHOUT document. Valid 30 minutes, for this connection only, used once by check_import; the address itself is the permission (no Authorization header). Nothing is saved in Recreatio. Without a shell, send the document in parts instead (check_import part/of/upload).")]
    public static StartUploadResult StartUpload(IHttpContextAccessor http)
    {
        var ctx = http.HttpContext ?? throw new McpException("unauthorized: brak kontekstu żądania.");
        var caller = CallerKey(http);
        DropOldUploads();
        if (StoredUploads.Values.Count(u => u.Caller == caller) >= UploadsPerCaller)
            throw new McpException($"invalid: at most {UploadsPerCaller} uploads at once — check or abandon one (they expire after 30 minutes).");
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        var id = "u" + Convert.ToHexString(RandomNumberGenerator.GetBytes(5)).ToLowerInvariant();
        StoredUploads[token] = new StoredUpload(caller, id);
        var url = $"{AiAccess.PublicRoot(ctx.Request)}/ai/upload/{token}";
        return new StartUploadResult(id, url, DateTime.UtcNow.Add(UploadKeep).ToString("O"), ImportCheck.MaxDocument,
            $"curl -X POST --data-binary @<file.json> \"{url}\"  — then check_import(format, upload: \"{id}\") without document.");
    }

    /// <summary>Den abgelegten Text einer Kennung dieser Verbindung nehmen (einmal) — oder <c>null</c>, wenn es keine gibt.</summary>
    public static string TakeUpload(string caller, string id, out bool started)
    {
        DropOldUploads();
        var hit = StoredUploads.FirstOrDefault(kv => kv.Value.Caller == caller && kv.Value.Id == id.Trim());
        started = hit.Value is not null;
        if (hit.Value?.Text is not string text) return "";
        StoredUploads.TryRemove(hit.Key, out _);
        return text;
    }

    /// <summary>Die Adresse, an die die Datei geht: der Körper ist der JSON-Text (UTF-8, auch gzip).</summary>
    public static void MapUpload(WebApplication app)
    {
        app.MapPost("/ai/upload/{token}", ReceiveUploadAsync).RequireCors(AiMcp.OpenCors);
    }

    /// <summary>Den Körper ablegen (ohne Netz prüfbar: Api.Tests).</summary>
    public static async Task<IResult> ReceiveUploadAsync(HttpContext ctx, string token)
    {
        DropOldUploads();
        if (!StoredUploads.TryGetValue(token, out var slot))
            return Results.Json(new { error = "not_found", message = "This upload address is unknown or expired — call start_upload again." }, statusCode: 404);
        var limit = ctx.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
        if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = 4L * ImportCheck.MaxDocument;
        Stream body = ctx.Request.Body;
        var encoding = ctx.Request.Headers.ContentEncoding.ToString();
        if (encoding.Contains("gzip", StringComparison.OrdinalIgnoreCase)) body = new GZipStream(body, CompressionMode.Decompress);
        using var reader = new StreamReader(body, Encoding.UTF8);
        var buffer = new char[81920];
        var sb = new StringBuilder();
        int n;
        while ((n = await reader.ReadAsync(buffer, ctx.RequestAborted)) > 0)
        {
            sb.Append(buffer, 0, n);
            if (sb.Length > ImportCheck.MaxDocument)
                return Results.Json(new { error = "too_large", message = $"The document has more than {ImportCheck.MaxDocument} characters." }, statusCode: 413);
        }
        var text = sb.ToString().TrimStart((char)0xFEFF);
        if (text.Trim().Length == 0) return Results.Json(new { error = "empty", message = "The body is empty — send the JSON file as the body." }, statusCode: 400);
        slot.Text = text;
        return Results.Json(new { ok = true, upload = slot.Id, characters = text.Length, next = $"check_import(format, upload: \"{slot.Id}\") without document" });
    }
}
