using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Events;

namespace Recreatio.Api.Endpoints.Events;

/// <summary>
/// Photographs participants add to a gallery slide.
///
/// The event has the pictures; the organizer has a camera and forty people had
/// one too. This is the path for theirs, and it is deliberately narrow:
///
///  1. **Only through an individual link.** The token is required, and the name
///     it belongs to is stored with the picture. An open upload box on a public
///     page is an invitation to whatever the internet feels like sending, and
///     nobody could be asked about it afterwards.
///
///  2. **Only where the slide says so.** The gallery's own config carries the
///     permission, so it is the organizer's decision, made per slide, in the
///     builder — not a site-wide setting somebody has to remember.
///
///  3. **Only pictures, and only small ones.** The browser is asked to shrink
///     photographs before they are sent, because a modern phone produces eight
///     megabytes per press of the shutter and neither the sender's data plan nor
///     this table wants that. The cap here is what makes the request honest
///     rather than merely polite: the bytes are checked, and so is what they
///     start with.
/// </summary>
public static partial class EventEndpoints
{
    /// <summary>
    /// After the browser has shrunk it, a photograph is a few hundred kilobytes.
    /// This leaves room for one that could not be shrunk while still bounding
    /// what a single upload can cost.
    /// </summary>
    private const int MaxPhotoBytes = 4 * 1024 * 1024;

    private static void MapGalleryEndpoints(RouteGroupBuilder group)
    {
        // The pictures on one gallery slide. Same door as the slide itself: a
        // public page is public, an internal one needs the link that opens it.
        group.MapGet("/site/{slug}/parts/{partId:guid}/photos", async (
            string slug,
            Guid partId,
            string? token,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var found = await FindGalleryAsync(dbContext, slug, partId, ct);
            if (found is null) return Results.NotFound();
            var (site, page, part) = found.Value;

            var access = await ResolveAccessAsync(dbContext, context, site.Id, page.Id, token, ct);
            if (page.Kind == "public")
            {
                if (!site.IsPublished) return Results.NotFound();
            }
            else if (!access.MayRead)
            {
                return Results.NotFound();
            }

            var photos = await dbContext.EventGalleryPhotos.AsNoTracking()
                .Where(x => x.PartId == part.Id)
                .OrderByDescending(x => x.CreatedUtc)
                .Select(x => new EventGalleryPhotoRow(
                    x.Id, x.Caption, x.UploaderName, x.Width, x.Height, x.CreatedUtc))
                .ToListAsync(ct);

            return Results.Ok(new EventGalleryResponse(
                photos,
                MayAdd: access.ViaLink && ReadGalleryTakesPhotos(part.ConfigJson),
                MayManage: access.IsAdmin));
        });

        group.MapGet("/photos/{photoId:guid}", async (
            Guid photoId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var photo = await dbContext.EventGalleryPhotos.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == photoId, ct);
            if (photo is null) return Results.NotFound();

            // Immutable, like every other uploaded byte here: an edit adds a new
            // picture rather than replacing one at an address already shared.
            context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            context.Response.Headers.XContentTypeOptions = "nosniff";
            return Results.File(photo.Data, photo.ContentType);
        });

        group.MapPost("/link/{token}/parts/{partId:guid}/photos", async (
            string token,
            Guid partId,
            HttpRequest request,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            var link = await dbContext.EventAccessLinks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Token == token && x.Status == "active", ct);
            if (link is null) return Results.NotFound();

            var part = await dbContext.EventParts.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == partId && x.IsVisible && x.Kind == "gallery", ct);
            if (part is null) return Results.NotFound();

            var page = await dbContext.EventPages.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == part.PageId && x.SiteId == link.SiteId, ct);
            if (page is null) return Results.NotFound();

            // The link has to be able to open the page the slide is on. A public
            // page counts: the link opens that too.
            if (page.Kind != "public")
            {
                var granted = await dbContext.EventAccessLinkPages.AsNoTracking()
                    .AnyAsync(x => x.AccessLinkId == link.Id && x.PageId == page.Id, ct);
                if (!granted) return Results.NotFound();
            }

            if (!ReadGalleryTakesPhotos(part.ConfigJson))
            {
                return Results.BadRequest(new { error = "Ta galeria nie przyjmuje zdjęć." });
            }

            if (!request.HasFormContentType) return Results.BadRequest(new { error = "Oczekiwano przesłania pliku." });

            var form = await request.ReadFormAsync(ct);
            var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
            if (file is null || file.Length == 0) return Results.BadRequest(new { error = "Nie wybrano pliku." });

            if (file.Length > MaxPhotoBytes)
            {
                return Results.BadRequest(new
                {
                    error = $"Zdjęcie jest za duże — maksimum to {MaxPhotoBytes / (1024 * 1024)} MB."
                });
            }
            if (!AllowedImageTypes.ContainsKey(file.ContentType ?? string.Empty))
            {
                return Results.BadRequest(new { error = "Dozwolone formaty: JPG, PNG, WEBP, GIF, AVIF." });
            }

            using var buffer = new MemoryStream();
            await file.CopyToAsync(buffer, ct);
            var bytes = buffer.ToArray();

            // The declared type is the browser's word; this is what the file
            // actually begins with.
            if (!LooksLikeImage(bytes)) return Results.BadRequest(new { error = "Plik nie wygląda na obraz." });

            var photo = new EventGalleryPhoto
            {
                Id = Guid.NewGuid(),
                SiteId = link.SiteId,
                PartId = part.Id,
                AccessLinkId = link.Id,
                UploaderName = link.RecipientName,
                FileName = NormalizeShort(Path.GetFileName(file.FileName), 200) ?? "zdjecie",
                ContentType = file.ContentType!,
                ByteSize = bytes.Length,
                Width = ReadDimension(form["width"], 0),
                Height = ReadDimension(form["height"], 0),
                Data = bytes,
                Caption = NormalizeShort(form["caption"], 300),
                CreatedUtc = DateTimeOffset.UtcNow
            };

            dbContext.EventGalleryPhotos.Add(photo);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new EventGalleryPhotoRow(
                photo.Id, photo.Caption, photo.UploaderName, photo.Width, photo.Height, photo.CreatedUtc));
        });

        group.MapDelete("/admin/photos/{photoId:guid}", async (
            Guid photoId,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var photo = await dbContext.EventGalleryPhotos.FirstOrDefaultAsync(x => x.Id == photoId, ct);
            if (photo is null) return Results.NotFound();

            dbContext.EventGalleryPhotos.Remove(photo);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new { deleted = true });
        }).RequireAuthorization();
    }

    /// <summary>The site, page and part behind a gallery address, or null.</summary>
    private static async Task<(EventSite Site, EventPage Page, EventPart Part)?> FindGalleryAsync(
        RecreatioDbContext dbContext,
        string slug,
        Guid partId,
        CancellationToken ct)
    {
        var normalized = slug.Trim().ToLowerInvariant();
        var site = await dbContext.EventSites.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == normalized, ct);
        if (site is null) return null;

        var part = await dbContext.EventParts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == partId && x.IsVisible && x.Kind == "gallery", ct);
        if (part is null) return null;

        var page = await dbContext.EventPages.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == part.PageId && x.SiteId == site.Id, ct);

        return page is null ? null : (site, page, part);
    }

    /// <summary>
    /// Whether this gallery invites photographs. Read here rather than trusted
    /// from the caller: the permission is the organizer's, and it lives in the
    /// slide they set it on.
    /// </summary>
    private static bool ReadGalleryTakesPhotos(string? configJson)
    {
        if (string.IsNullOrWhiteSpace(configJson)) return false;

        try
        {
            using var document = JsonDocument.Parse(configJson);
            return document.RootElement.ValueKind == JsonValueKind.Object
                && document.RootElement.TryGetProperty("contributions", out var value)
                && value.ValueKind == JsonValueKind.String
                && value.GetString() == "link";
        }
        catch (JsonException)
        {
            // A config nobody can read grants nothing.
            return false;
        }
    }

    /// <summary>The size the browser reports after shrinking, for laying the picture out before it loads.</summary>
    private static int ReadDimension(string? raw, int fallback) =>
        int.TryParse(raw, out var value) && value > 0 && value < 20000 ? value : fallback;
}
