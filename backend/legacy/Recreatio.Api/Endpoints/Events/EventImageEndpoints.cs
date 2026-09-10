using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Events;

namespace Recreatio.Api.Endpoints.Events;

/// <summary>
/// Background images an organizer uploads instead of hosting pictures
/// elsewhere. Serving is public and cached hard — the bytes at an image's
/// address never change, because an edit uploads a new image rather than
/// replacing one.
/// </summary>
public static partial class EventEndpoints
{
    /// <summary>Comfortably more than a full-screen photograph needs.</summary>
    private const int MaxImageBytes = 6 * 1024 * 1024;

    private static readonly Dictionary<string, string> AllowedImageTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
        ["image/gif"] = ".gif",
        ["image/avif"] = ".avif"
    };

    private static void MapImageEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/images/{imageId:guid}", async (
            Guid imageId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var image = await dbContext.EventImages.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == imageId, ct);
            if (image is null) return Results.NotFound();

            // Immutable: a given id always returns the same bytes, so the
            // browser never has to ask again.
            context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            return Results.File(image.Data, image.ContentType);
        });

        group.MapGet("/admin/sites/{siteId:guid}/images", async (
            Guid siteId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            // Never select Data here — the list is metadata only, or every
            // visit to the editor would drag every image over the wire.
            var images = await dbContext.EventImages.AsNoTracking()
                .Where(x => x.SiteId == siteId)
                .OrderByDescending(x => x.CreatedUtc)
                .Select(x => new EventImageResponse(x.Id, x.FileName, x.ContentType, x.ByteSize, x.CreatedUtc))
                .ToListAsync(ct);

            return Results.Ok(images);
        }).RequireAuthorization();

        group.MapPost("/admin/sites/{siteId:guid}/images", async (
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
            if (file.Length > MaxImageBytes)
            {
                return Results.BadRequest(new
                {
                    error = $"Plik jest za duży — maksimum to {MaxImageBytes / (1024 * 1024)} MB."
                });
            }
            if (!AllowedImageTypes.ContainsKey(file.ContentType ?? string.Empty))
            {
                return Results.BadRequest(new
                {
                    error = "Dozwolone formaty: JPG, PNG, WEBP, GIF, AVIF."
                });
            }

            using var buffer = new MemoryStream();
            await file.CopyToAsync(buffer, ct);
            var bytes = buffer.ToArray();

            // The declared type is a claim by the browser; check the bytes.
            if (!LooksLikeImage(bytes))
            {
                return Results.BadRequest(new { error = "Plik nie wygląda na obraz." });
            }

            var image = new EventImage
            {
                Id = Guid.NewGuid(),
                SiteId = siteId,
                FileName = NormalizeShort(Path.GetFileName(file.FileName), 200) ?? "obraz",
                ContentType = file.ContentType!,
                ByteSize = bytes.Length,
                Data = bytes,
                CreatedUtc = DateTimeOffset.UtcNow
            };

            dbContext.EventImages.Add(image);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new EventImageResponse(
                image.Id, image.FileName, image.ContentType, image.ByteSize, image.CreatedUtc));
        }).RequireAuthorization();

        group.MapDelete("/admin/images/{imageId:guid}", async (
            Guid imageId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var image = await dbContext.EventImages.FirstOrDefaultAsync(x => x.Id == imageId, ct);
            if (image is null) return Results.NotFound();

            // Layers referencing it keep their address and will simply stop
            // painting; there is no way to know which parts point here without
            // scanning every LayersJson, and a silent edit would be worse.
            dbContext.EventImages.Remove(image);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new { deleted = true });
        }).RequireAuthorization();
    }

    /// <summary>
    /// Magic-number check. A declared content type is only what the uploader
    /// said; this is what the file actually starts with.
    /// </summary>
    private static bool LooksLikeImage(byte[] bytes)
    {
        if (bytes.Length < 12) return false;

        // JPEG
        if (bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) return true;
        // PNG
        if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) return true;
        // GIF87a / GIF89a
        if (bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46) return true;

        // RIFF....WEBP
        var isRiff = bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46;
        if (isRiff && bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50) return true;

        // ....ftyp — the ISO-BMFF box AVIF sits in
        if (bytes[4] == 0x66 && bytes[5] == 0x74 && bytes[6] == 0x79 && bytes[7] == 0x70) return true;

        return false;
    }
}
