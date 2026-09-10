using System.IO.Compression;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Data;
using Recreatio.Api.Services.Events;

namespace Recreatio.Api.Endpoints.Events;

/// <summary>
/// Eine ganze Galerie am Stück herunterladen.
///
/// <para>
/// <b>Warum das gebraucht wird.</b> Hundertfünf Fotos einzeln anzuklicken ist
/// keine Sicherung, sondern eine Nachmittagsbeschäftigung — und wer es
/// abbricht, weiss hinterher nicht, bei welchem. Vor einem Umbau, der die
/// Datenbank neu schneidet, ist das der Unterschied zwischen „die Bilder sind
/// noch da" und „die Bilder waren mal da".
/// </para>
///
/// <para>
/// <b>Warum der Server das Paket schnürt und nicht der Browser.</b> Im Browser
/// hiesse es: 61 MB einzeln holen, alle gleichzeitig im Speicher halten, mit
/// einer Bibliothek packen. Auf einem Telefon endet das im Absturz, und auf
/// einem Rechner dauert es, ohne dass jemand sagen könnte, wie weit es ist.
/// Hier wird STRÖMEND gepackt: jedes Bild wandert einzeln aus der Datenbank
/// (oder von der Platte) in die Antwort, und keines wird zweimal gehalten.
/// </para>
///
/// <para>
/// <b>Dieselbe Tür wie die Galerie selbst.</b> Ein öffentlicher Auftritt ist
/// öffentlich; eine interne Seite verlangt den Link, der sie öffnet. Ein
/// Sammeldownload, der lockerer prüft als die Ansicht, wäre die bequemste Art,
/// eine Zugangsprüfung zu umgehen — man lädt eben alles herunter, statt es
/// anzusehen.
/// </para>
/// </summary>
public static partial class EventEndpoints
{
    private static void MapGalleryDownloadEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("/site/{slug}/parts/{partId:guid}/photos.zip", async (
            string slug,
            Guid partId,
            string? token,
            HttpContext context,
            RecreatioDbContext dbContext,
            IConfiguration config,
            CancellationToken ct) =>
        {
            var found = await FindGalleryAsync(dbContext, slug, partId, ct);
            if (found is null) return Results.NotFound();
            var (site, page, part) = found.Value;

            // GENAU dieselbe Prüfung wie beim Ansehen der Galerie.
            var access = await ResolveAccessAsync(dbContext, context, site.Id, page.Id, token, ct);
            if (page.Kind == "public")
            {
                if (!site.IsPublished) return Results.NotFound();
            }
            else if (!access.MayRead)
            {
                return Results.NotFound();
            }

            /*
             * Eine Galerie kann die Meme mittragen, die aus ihr gemacht wurden
             * — dieselbe Regel wie in der Ansicht. Wer die Galerie sichert,
             * soll nicht hinterher merken, dass die Meme woanders lagen.
             */
            var memePartIds = part.Kind == "gallery"
                ? await MemePartsFeedingAsync(dbContext, site.Id, part.Id, ct)
                : [];

            var partIds = memePartIds.Append(part.Id).ToList();

            /*
             * NUR DIE KENNUNGEN, NICHT DIE BYTES.
             *
             * Ein `ToList()` über die ganzen Zeilen zöge alle Bilder auf einmal
             * in den Speicher — also genau das, was dieser Weg vermeiden soll.
             * Die Bytes kommen unten, eines nach dem anderen.
             */
            var rows = await dbContext.EventGalleryPhotos.AsNoTracking()
                .Where(x => partIds.Contains(x.PartId))
                .OrderBy(x => x.CreatedUtc)
                .Select(x => new { x.Id, x.FileName, x.ContentType, x.StoragePath, x.CreatedUtc, x.UploaderName })
                .ToListAsync(ct);

            if (rows.Count == 0) return Results.NotFound();

            var stamp = DateTimeOffset.UtcNow.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
            var fileName = $"{Safe(site.Slug)}-{Safe(part.Kind)}-{stamp}.zip";

            context.Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"";
            context.Response.ContentType = "application/zip";

            /*
             * KEINE `Content-Length`. Die Grösse steht erst fest, wenn gepackt
             * ist — und sie vorher zu schätzen hiesse, einen Download zu
             * versprechen, der bei 98 % abbricht. Der Browser zeigt dafür
             * keinen Fortschrittsbalken; das ist der ehrlichere Handel.
             */
            using var archive = new ZipArchive(context.Response.Body, ZipArchiveMode.Create, leaveOpen: true);

            var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var index = new StringBuilder();
            index.AppendLine("plik;kto przysłał;kiedy");

            foreach (var row in rows)
            {
                if (ct.IsCancellationRequested) break;

                var name = UniqueName(used, row.FileName, row.ContentType, row.Id);

                var entry = archive.CreateEntry(name, CompressionLevel.NoCompression);

                /*
                 * NoCompression ist Absicht: JPEG und WebP sind bereits
                 * komprimiert. Sie noch einmal durch Deflate zu schicken kostet
                 * Rechenzeit für ein Ergebnis, das ein Prozent kleiner ist.
                 */
                entry.LastWriteTime = row.CreatedUtc;

                await using var target = entry.Open();

                if (row.StoragePath is not null)
                {
                    // Schon auf der Platte: von dort strömen, nicht über die
                    // Datenbank.
                    var source = EventPhotoStore.OpenRead(config, row.StoragePath);
                    if (source is null) continue;

                    await using (source) await source.CopyToAsync(target, ct);
                }
                else
                {
                    // Noch in der Zeile. EINZELN geholt — das ist der ganze
                    // Grund, oben nur die Kennungen zu lesen.
                    var bytes = await dbContext.EventGalleryPhotos.AsNoTracking()
                        .Where(x => x.Id == row.Id)
                        .Select(x => x.Data)
                        .FirstOrDefaultAsync(ct);

                    if (bytes is null) continue;
                    await target.WriteAsync(bytes, ct);
                }

                index.Append(Csv(name)).Append(';')
                     .Append(Csv(row.UploaderName)).Append(';')
                     .Append(row.CreatedUtc.ToString("yyyy-MM-dd HH:mm", System.Globalization.CultureInfo.InvariantCulture))
                     .AppendLine();
            }

            /*
             * EIN VERZEICHNIS LIEGT BEI.
             *
             * Die Dateinamen allein sagen nicht, wer ein Bild geschickt hat —
             * das steht in der Zeile, und die Zeile wird gleich gelöscht. Ohne
             * diese Liste ist der Ordner hinterher ein Haufen Fotos, zu denen
             * niemand mehr jemanden fragen kann.
             */
            var listing = archive.CreateEntry("spis.csv", CompressionLevel.Optimal);
            await using (var writer = new StreamWriter(listing.Open(), new UTF8Encoding(true)))
            {
                await writer.WriteAsync(index.ToString());
            }

            return Results.Empty;
        });
    }

    /// <summary>
    /// Ein Name, den es im Paket noch nicht gibt.
    ///
    /// Zwei Teilnehmer schicken beide <c>IMG_1234.jpg</c> — im ZIP wäre das
    /// zweimal derselbe Eintrag, und je nach Entpacker verschwindet einer
    /// davon lautlos. Also bekommt der zweite eine Nummer.
    /// </summary>
    private static string UniqueName(HashSet<string> used, string? fileName, string contentType, Guid id)
    {
        var extension = contentType switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            "image/gif" => ".gif",
            "image/avif" => ".avif",
            _ => ".bin"
        };

        var baseName = Path.GetFileNameWithoutExtension(fileName ?? "");
        baseName = Safe(baseName);
        if (baseName.Length == 0) baseName = id.ToString("N")[..8];

        var candidate = baseName + extension;
        var n = 2;
        while (!used.Add(candidate))
        {
            candidate = $"{baseName}-{n}{extension}";
            n++;
        }

        return candidate;
    }

    /// <summary>
    /// Was in einem Dateinamen stehen darf.
    ///
    /// Ein Name aus einem Upload ist fremder Text: Schrägstriche und
    /// <c>..</c> darin sind der klassische Weg, beim Entpacken aus dem Ordner
    /// auszubrechen. Hier bleibt nur, was harmlos ist.
    /// </summary>
    private static string Safe(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";

        var sb = new StringBuilder(raw.Length);
        foreach (var c in raw.Trim())
        {
            if (char.IsLetterOrDigit(c) || c is '-' or '_') sb.Append(c);
            else if (c is ' ' or '.') sb.Append('-');

            if (sb.Length >= 60) break;
        }

        return sb.ToString().Trim('-');
    }

    private static string Csv(string? value)
    {
        var text = value ?? "";
        return text.Contains(';') || text.Contains('"') || text.Contains('\n')
            ? '"' + text.Replace("\"", "\"\"", StringComparison.Ordinal) + '"'
            : text;
    }
}
