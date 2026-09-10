using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Events;
using Recreatio.Api.Services.Events;

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

            // A gallery can be asked to carry the memes made out of it, but is
            // not by default: a meme belongs to the slide it was made on, and a
            // gallery of photographs from the trip is not improved by filling up
            // with captioned versions of itself. The meme slide decides, since
            // that is where the connection is configured.
            var memePartIds = part.Kind == "gallery"
                ? await MemePartsFeedingAsync(dbContext, site.Id, part.Id, ct)
                : [];

            var partIds = memePartIds.Append(part.Id).ToList();

            var photos = await dbContext.EventGalleryPhotos.AsNoTracking()
                .Where(x => partIds.Contains(x.PartId))
                .OrderByDescending(x => x.CreatedUtc)
                .Select(x => new EventGalleryPhotoRow(
                    x.Id,
                    x.Caption,
                    x.UploaderName,
                    x.Width,
                    x.Height,
                    x.CreatedUtc,
                    access.Link != null && x.AccessLinkId == access.Link.Id,
                    memePartIds.Contains(x.PartId)))
                .ToListAsync(ct);

            return Results.Ok(new EventGalleryResponse(
                photos,
                MayAdd: access.ViaLink && (part.Kind == "meme" || ReadGalleryTakesPhotos(part.ConfigJson)),
                MayManage: access.IsAdmin));
        });

        group.MapGet("/photos/{photoId:guid}", async (
            Guid photoId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IConfiguration config,
            CancellationToken ct) =>
        {
            /*
             * ONLY THE COLUMNS NEEDED TO DECIDE - NOT THE BYTES.
             *
             * Loading the whole row would drag Data along for every
             * photograph already on disk, which is the cost this move
             * exists to remove. The bytes are read below, and only in the
             * one case that still needs them.
             */
            var photo = await dbContext.EventGalleryPhotos.AsNoTracking()
                .Where(x => x.Id == photoId)
                .Select(x => new { x.ContentType, x.StoragePath })
                .FirstOrDefaultAsync(ct);
            if (photo is null) return Results.NotFound();

            // Immutable, like every other uploaded byte here: an edit adds a new
            // picture rather than replacing one at an address already shared.
            context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            context.Response.Headers.XContentTypeOptions = "nosniff";

            if (photo.StoragePath is not null)
            {
                var stream = EventPhotoStore.OpenRead(config, photo.StoragePath);

                /*
                 * A path that points at nothing is a photograph that is
                 * gone: the row said it had moved, so the column was
                 * emptied. Reporting it missing is the honest answer -
                 * quietly falling back to an empty column would send a
                 * zero-byte image, and a broken picture reads as a browser
                 * problem rather than as a lost file.
                 */
                if (stream is null) return Results.NotFound();

                // Streamed, not buffered: the bytes go from disk to socket
                // without the whole photograph passing through memory.
                return Results.File(stream, photo.ContentType);
            }

            // Still in the row - until the move has caught up with it.
            var bytes = await dbContext.EventGalleryPhotos.AsNoTracking()
                .Where(x => x.Id == photoId)
                .Select(x => x.Data)
                .FirstOrDefaultAsync(ct);

            return bytes is null ? Results.NotFound() : Results.File(bytes, photo.ContentType);
        });

        group.MapPost("/link/{token}/parts/{partId:guid}/photos", async (
            string token,
            Guid partId,
            HttpRequest request,
            RecreatioDbContext dbContext,
            IConfiguration config,
            CancellationToken ct) =>
        {
            var link = await dbContext.EventAccessLinks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Token == token && x.Status == "active", ct);
            if (link is null) return Results.NotFound();

            var part = await dbContext.EventParts.AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Id == partId && x.IsVisible && (x.Kind == "gallery" || x.Kind == "meme"), ct);
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

            // A meme slide exists to be added to: the whole slide is the
            // invitation, so there is no separate switch to read. A gallery has
            // one, and it is the organizer's.
            if (part.Kind == "gallery" && !ReadGalleryTakesPhotos(part.ConfigJson))
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

            var photoId = Guid.NewGuid();

            /*
             * STRAIGHT TO DISK - the row never holds the bytes at all.
             *
             * Written and verified BEFORE the row is inserted: if the disk
             * refuses, nothing was recorded and the sender is told the
             * upload failed. The other order would leave a row pointing at
             * a file that does not exist, which reads as a lost photograph
             * rather than as a failed upload.
             */
            byte[] storedHash;
            string storedPath;
            try
            {
                storedPath = EventPhotoStore.RelativePathFor(photoId);
                storedHash = await EventPhotoStore.WriteAsync(config, photoId, bytes, ct);
            }
            catch (IOException)
            {
                return Results.Problem("Nie udalo sie zapisac zdjecia. Sprobuj ponownie.");
            }

            var photo = new EventGalleryPhoto
            {
                Id = photoId,
                SiteId = link.SiteId,
                PartId = part.Id,
                AccessLinkId = link.Id,
                UploaderName = link.RecipientName,
                FileName = NormalizeShort(Path.GetFileName(file.FileName), 200) ?? "zdjecie",
                ContentType = file.ContentType!,
                ByteSize = bytes.Length,
                Width = ReadDimension(form["width"], 0),
                Height = ReadDimension(form["height"], 0),
                // The bytes are on disk; the row carries only where they
                // are and which they are, so a corrupted file can be told
                // apart from a wrong one.
                Data = null,
                StoragePath = storedPath,
                ContentSha256 = storedHash,
                Caption = NormalizeShort(form["caption"], 300),
                CreatedUtc = DateTimeOffset.UtcNow
            };

            dbContext.EventGalleryPhotos.Add(photo);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new EventGalleryPhotoRow(
                photo.Id,
                photo.Caption,
                photo.UploaderName,
                photo.Width,
                photo.Height,
                photo.CreatedUtc,
                Mine: true,
                IsMeme: part.Kind == "meme"));
        });

        // A picture is the sender's to withdraw. The link that brought it is the
        // only one that can take it back — not another participant's, and not an
        // anonymous caller who guessed an id.
        group.MapDelete("/link/{token}/photos/{photoId:guid}", async (
            string token,
            Guid photoId,
            RecreatioDbContext dbContext,
            IConfiguration config,
            CancellationToken ct) =>
        {
            var link = await dbContext.EventAccessLinks.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Token == token && x.Status == "active", ct);
            if (link is null) return Results.NotFound();

            var photo = await dbContext.EventGalleryPhotos
                .FirstOrDefaultAsync(x => x.Id == photoId && x.AccessLinkId == link.Id, ct);
            // Not "forbidden": somebody else's picture is simply not theirs to
            // find, and saying which of the two it is tells them nothing useful.
            if (photo is null) return Results.NotFound();

            /*
             * THE ROW GOES FIRST, THE FILE AFTER.
             *
             * If the delete fails the file stays behind as wasted space,
             * and that is the harmless direction. The other way round -
             * file gone, row still there - is a photograph that is listed,
             * clicked, and answers 404. One of these costs a few hundred
             * kilobytes; the other looks like a bug to everybody who sees
             * it.
             */
            var goneFrom = photo.StoragePath;

            dbContext.EventGalleryPhotos.Remove(photo);
            await dbContext.SaveChangesAsync(ct);
            EventPhotoStore.TryDelete(config, goneFrom);

            return Results.Ok(new { deleted = true });
        });

        /*
         * WIE WEIT DER UMZUG IST.
         *
         * Ein Wartungslauf, der still im Hintergrund arbeitet, ist ein
         * Wartungslauf, von dem niemand weiss, ob er je gelaufen ist. Diese
         * Auskunft ist die einzige Stelle, an der sich das nachsehen laesst,
         * ohne in die Datenbank zu schauen — und sie sagt beides: was noch
         * drinliegt und woran der letzte Lauf gescheitert ist.
         *
         * Nur fuer den Verwalter: „wie viele Fotos hat diese Seite" ist keine
         * Auskunft fuer Vorbeikommende.
         */
        group.MapGet("/admin/photo-storage", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            GalleryPhotoOffload offload,
            IConfiguration config,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            // Bevor die Zahlen: geht Schreiben ueberhaupt. Ein Zaehler, der
            // nicht sinkt, und daneben die Auskunft warum, ist eine Diagnose;
            // ohne sie ist es ein Raetsel.
            var store = EventPhotoStore.Probe(config);

            var inDatabase = await dbContext.EventGalleryPhotos.AsNoTracking()
                .Where(x => x.StoragePath == null && x.Data != null)
                .CountAsync(ct);

            var onDisk = await dbContext.EventGalleryPhotos.AsNoTracking()
                .Where(x => x.StoragePath != null)
                .CountAsync(ct);

            // Die Summe der Groessen kommt aus `ByteSize` und NICHT aus
            // DATALENGTH(Data): das haette die Bytes gelesen, um sie zu zaehlen.
            var bytesOnDisk = await dbContext.EventGalleryPhotos.AsNoTracking()
                .Where(x => x.StoragePath != null)
                .SumAsync(x => (long?)x.ByteSize, ct) ?? 0;

            var last = offload.Last;

            return Results.Ok(new
            {
                inDatabase,
                onDisk,
                megabytesOnDisk = Math.Round(bytesOnDisk / 1048576.0, 1),
                store = new
                {
                    // `enabled = false` ist der haeufigste Grund dafuer,
                    // dass `inDatabase` nicht sinkt - und ohne diese Zeile
                    // der am schwersten zu erratende.
                    enabled = EventPhotoStore.OffloadEnabled(config),
                    writable = store.Writable,
                    root = store.Root,
                    problem = store.Problem
                },
                lastRun = new
                {
                    last.StartedUtc,
                    last.FinishedUtc,
                    last.Moved,
                    last.Failed,
                    last.LastError
                }
            });
        }).RequireAuthorization();

        /*
         * Den Umzug von Hand anstossen.
         *
         * Der Regelweg ist die Anmeldung des Verwalters. Diesen Knopf gibt es
         * trotzdem: wenn ein Lauf an einer vollen Platte gescheitert ist, will
         * man ihn nach dem Aufraeumen wiederholen koennen, ohne sich ab- und
         * wieder anzumelden.
         */
        group.MapPost("/admin/photo-storage/run", async (
            HttpContext context,
            RecreatioDbContext dbContext,
            GalleryPhotoOffload offload,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var progress = await offload.RunAsync(ct);
            return Results.Ok(progress);
        }).RequireAuthorization();

        group.MapDelete("/admin/photos/{photoId:guid}", async (
            Guid photoId,
            HttpContext context,
            RecreatioDbContext dbContext,
            IConfiguration config,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var photo = await dbContext.EventGalleryPhotos.FirstOrDefaultAsync(x => x.Id == photoId, ct);
            if (photo is null) return Results.NotFound();

            // Same order and same reason as above.
            var goneFrom = photo.StoragePath;

            dbContext.EventGalleryPhotos.Remove(photo);
            await dbContext.SaveChangesAsync(ct);
            EventPhotoStore.TryDelete(config, goneFrom);

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
            .FirstOrDefaultAsync(
                x => x.Id == partId && x.IsVisible && (x.Kind == "gallery" || x.Kind == "meme"), ct);
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

    /// <summary>
    /// The meme slides that draw on this gallery and hand their results back.
    ///
    /// Read out of each slide's own config rather than from a table: the link
    /// between the two is the organizer's setting on the meme slide, and there
    /// is exactly one place it should live.
    /// </summary>
    private static async Task<List<Guid>> MemePartsFeedingAsync(
        RecreatioDbContext dbContext,
        Guid siteId,
        Guid galleryPartId,
        CancellationToken ct)
    {
        var pageIds = await dbContext.EventPages.AsNoTracking()
            .Where(x => x.SiteId == siteId)
            .Select(x => x.Id)
            .ToListAsync(ct);

        var memeParts = await dbContext.EventParts.AsNoTracking()
            .Where(x => pageIds.Contains(x.PageId) && x.Kind == "meme" && x.IsVisible)
            .Select(x => new { x.Id, x.ConfigJson })
            .ToListAsync(ct);

        var feeding = new List<Guid>();
        foreach (var meme in memeParts)
        {
            if (ReadMemeSource(meme.ConfigJson) == galleryPartId) feeding.Add(meme.Id);
        }

        return feeding;
    }

    /// <summary>The gallery a meme slide draws on, or null when it keeps to itself.</summary>
    private static Guid? ReadMemeSource(string? configJson)
    {
        if (string.IsNullOrWhiteSpace(configJson)) return null;

        try
        {
            using var document = JsonDocument.Parse(configJson);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return null;

            // Only a slide that explicitly asks for it hands its memes back.
            if (!root.TryGetProperty("shareToGallery", out var share) || share.ValueKind != JsonValueKind.True)
            {
                return null;
            }

            return root.TryGetProperty("sourcePartId", out var source)
                && source.ValueKind == JsonValueKind.String
                && Guid.TryParse(source.GetString(), out var id)
                    ? id
                    : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>The size the browser reports after shrinking, for laying the picture out before it loads.</summary>
    private static int ReadDimension(string? raw, int fallback) =>
        int.TryParse(raw, out var value) && value > 0 && value < 20000 ? value : fallback;
}
