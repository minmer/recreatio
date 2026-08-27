using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Events;

namespace Recreatio.Api.Endpoints.Events;

/// <summary>
/// The files an event hands out: the regulamin, a consent to print and bring, a
/// GPX track. Uploaded once into the event's own library and picked from there,
/// the way background pictures are — so a link in a "files" slide points at
/// something this application still has, rather than at a drive that was tidied
/// up in November.
///
/// Two rules shape what happens here, and both come from what these files are:
///
///  1. **The extension decides the type, not the browser.** A content type in an
///     upload is whatever the uploading side felt like saying, and for GPX it is
///     usually nothing at all. The name the organizer picked the file under is
///     the honest signal, so the allowed extensions are the whitelist and the
///     served type is looked up from them.
///
///  2. **Everything is served as a download.** These files are read by nothing
///     in the page; handing them to the browser as attachments, with sniffing
///     switched off, keeps a file uploaded here from ever being interpreted as
///     something to run at the API's own origin.
/// </summary>
public static partial class EventEndpoints
{
    /// <summary>A scanned regulamin is bigger than a photograph; this still bounds the row.</summary>
    private const int MaxDocumentBytes = 15 * 1024 * 1024;

    /// <summary>Extension → the type it is served as. The whitelist is this table.</summary>
    private static readonly Dictionary<string, string> AllowedDocumentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = "application/pdf",
        [".doc"] = "application/msword",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".xls"] = "application/vnd.ms-excel",
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".ppt"] = "application/vnd.ms-powerpoint",
        [".pptx"] = "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        [".odt"] = "application/vnd.oasis.opendocument.text",
        [".ods"] = "application/vnd.oasis.opendocument.spreadsheet",
        [".txt"] = "text/plain",
        [".csv"] = "text/csv",
        // The route files a bicycle pilgrimage lives on; the map part reads the
        // same format.
        [".gpx"] = "application/gpx+xml"
    };

    private static void MapDocumentEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/documents/{documentId:guid}", async (
            Guid documentId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var document = await dbContext.EventDocuments.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == documentId, ct);
            if (document is null) return Results.NotFound();

            // Immutable, like the images: an edit uploads a new file rather than
            // replacing the bytes at an address somebody has already shared.
            context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            context.Response.Headers.XContentTypeOptions = "nosniff";

            return Results.File(document.Data, document.ContentType, document.FileName);
        });

        group.MapGet("/admin/sites/{siteId:guid}/documents", async (
            Guid siteId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            // Metadata only. Selecting Data here would drag every file over the
            // wire each time the builder opens.
            var documents = await dbContext.EventDocuments.AsNoTracking()
                .Where(x => x.SiteId == siteId)
                .OrderByDescending(x => x.CreatedUtc)
                .Select(x => new EventDocumentResponse(x.Id, x.FileName, x.ContentType, x.ByteSize, x.CreatedUtc))
                .ToListAsync(ct);

            return Results.Ok(documents);
        }).RequireAuthorization();

        group.MapPost("/admin/sites/{siteId:guid}/documents", async (
            Guid siteId,
            HttpRequest request,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();
            if (!await dbContext.EventSites.AnyAsync(x => x.Id == siteId, ct)) return Results.NotFound();

            if (!request.HasFormContentType)
            {
                return Results.BadRequest(new { error = "Oczekiwano przesłania pliku." });
            }

            var form = await request.ReadFormAsync(ct);
            var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
            if (file is null || file.Length == 0)
            {
                return Results.BadRequest(new { error = "Nie wybrano pliku." });
            }
            if (file.Length > MaxDocumentBytes)
            {
                return Results.BadRequest(new
                {
                    error = $"Plik jest za duży — maksimum to {MaxDocumentBytes / (1024 * 1024)} MB."
                });
            }

            var name = Path.GetFileName(file.FileName) ?? string.Empty;
            var extension = Path.GetExtension(name);
            if (!AllowedDocumentTypes.TryGetValue(extension ?? string.Empty, out var contentType))
            {
                return Results.BadRequest(new
                {
                    error = "Dozwolone pliki: PDF, DOC(X), XLS(X), PPT(X), ODT, ODS, TXT, CSV, GPX."
                });
            }

            using var buffer = new MemoryStream();
            await file.CopyToAsync(buffer, ct);
            var bytes = buffer.ToArray();

            // A PDF is the one format here whose first bytes are worth insisting
            // on: it is what people actually upload, and a renamed something-else
            // would otherwise be handed to participants as a regulamin.
            if (contentType == "application/pdf" && !LooksLikePdf(bytes))
            {
                return Results.BadRequest(new { error = "Ten plik nie wygląda na PDF." });
            }

            var document = new EventDocument
            {
                Id = Guid.NewGuid(),
                SiteId = siteId,
                FileName = NormalizeShort(name, 200) ?? $"plik{extension}",
                ContentType = contentType,
                ByteSize = bytes.Length,
                Data = bytes,
                CreatedUtc = DateTimeOffset.UtcNow
            };

            dbContext.EventDocuments.Add(document);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new EventDocumentResponse(
                document.Id, document.FileName, document.ContentType, document.ByteSize, document.CreatedUtc));
        }).RequireAuthorization();

        group.MapDelete("/admin/documents/{documentId:guid}", async (
            Guid documentId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var document = await dbContext.EventDocuments.FirstOrDefaultAsync(x => x.Id == documentId, ct);
            if (document is null) return Results.NotFound();

            // Slides pointing at it keep their address and will simply stop
            // offering the file; finding them would mean scanning every
            // ConfigJson, and a silent edit of somebody's page would be worse.
            dbContext.EventDocuments.Remove(document);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new { deleted = true });
        }).RequireAuthorization();
    }

    /// <summary>"%PDF-" — the five bytes every PDF starts with.</summary>
    private static bool LooksLikePdf(byte[] bytes) =>
        bytes.Length >= 5
        && bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46 && bytes[4] == 0x2D;
}
