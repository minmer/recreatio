using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recreatio.Api.Contracts;
using Recreatio.Api.Data;
using Recreatio.Api.Data.Events;

namespace Recreatio.Api.Endpoints.Events;

/// <summary>
/// Bulk import. The normal authoring path is a model writing one JSON document
/// for a whole event; the organizer then fine-tunes it in the editor.
///
/// Import never overwrites and never deletes: a taken slug is a conflict, and
/// parts are only ever appended. Anything unrecognised is skipped and reported
/// as a warning rather than failing the whole document, because a partly-usable
/// import the organizer can fix beats a rejection they cannot act on.
/// </summary>
public static partial class EventEndpoints
{
    private static void MapImportEndpoints(RouteGroupBuilder group)
    {
        group.MapPost("/admin/import/site", async (
            JsonElement body,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();
            if (body.ValueKind != JsonValueKind.Object)
            {
                return Results.BadRequest(new { error = "Główny element musi być obiektem JSON." });
            }

            var slug = NormalizeSlug(ReadString(body, "slug"));
            var title = NormalizeShort(ReadString(body, "title"), 200);
            if (slug is null || title is null)
            {
                return Results.BadRequest(new { error = "JSON musi zawierać „slug” i „title”." });
            }
            if (await dbContext.EventSites.AnyAsync(x => x.Slug == slug, ct))
            {
                return Results.Conflict(new { error = $"Wydarzenie o adresie „{slug}” już istnieje. Zmień „slug” w JSON-ie." });
            }

            var warnings = new List<string>();
            var now = DateTimeOffset.UtcNow;

            var site = new EventSite
            {
                Id = Guid.NewGuid(),
                Slug = slug,
                Title = title,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            ApplyCatalogue(site, BuildUpsertFromJson(body, slug, title, warnings));
            dbContext.EventSites.Add(site);

            var pageElements = ReadArray(body, "pages");
            var publicIndex = FindPublicPageIndex(pageElements);
            var pagesCreated = 0;
            var partsCreated = 0;
            var fieldsCreated = 0;

            // The site must end up with exactly one public page whether or not
            // the document remembered to mark one.
            if (pageElements.Count == 0)
            {
                dbContext.EventPages.Add(NewPage(site.Id, 0, "public", "start", title, "Strona publiczna", null, now));
                pagesCreated = 1;
                warnings.Add("JSON nie zawierał żadnych stron — utworzono pustą stronę publiczną.");
            }
            else
            {
                for (var index = 0; index < pageElements.Count; index += 1)
                {
                    var element = pageElements[index];
                    var isPublic = index == publicIndex;
                    var pageTitle = NormalizeShort(ReadString(element, "title"), 200)
                        ?? (isPublic ? title : $"Strona {index + 1}");
                    var pageSlug = NormalizeSlug(ReadString(element, "slug"))
                        ?? NormalizeSlug(pageTitle)
                        ?? $"strona-{index + 1}";

                    // Slugs are unique per site; a duplicate gets a suffix
                    // rather than losing the page.
                    var candidate = pageSlug;
                    var attempt = 2;
                    while (dbContext.EventPages.Local.Any(x => x.SiteId == site.Id && x.Slug == candidate))
                    {
                        candidate = $"{pageSlug}-{attempt++}";
                    }
                    if (candidate != pageSlug)
                    {
                        warnings.Add($"Adres strony „{pageSlug}” powtarzał się — zapisano jako „{candidate}”.");
                    }

                    var page = NewPage(
                        site.Id,
                        index,
                        isPublic ? "public" : "internal",
                        candidate,
                        pageTitle,
                        NormalizeShort(ReadString(element, "menuLabel"), 60) ?? pageTitle,
                        NormalizeShort(ReadString(element, "description"), 600),
                        now);

                    dbContext.EventPages.Add(page);
                    pagesCreated += 1;

                    var (parts, fields) = AddParts(dbContext, page, ReadArray(element, "parts"), 0, now, warnings);
                    partsCreated += parts;
                    fieldsCreated += fields;
                }
            }

            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new EventImportResult(
                site.Id, site.Slug, pagesCreated, partsCreated, fieldsCreated, warnings));
        }).RequireAuthorization();

        group.MapPost("/admin/pages/{pageId:guid}/import/parts", async (
            Guid pageId,
            JsonElement body,
            HttpContext context,
            RecreatioDbContext dbContext,
            CancellationToken ct) =>
        {
            if (!await IsAdminAsync(context, dbContext, ct)) return Results.Forbid();

            var page = await dbContext.EventPages.FirstOrDefaultAsync(x => x.Id == pageId, ct);
            if (page is null) return Results.NotFound();

            // Accept either a bare array of parts or an object wrapping one.
            var elements = body.ValueKind == JsonValueKind.Array
                ? body.EnumerateArray().ToList()
                : ReadArray(body, "parts");

            if (elements.Count == 0)
            {
                return Results.BadRequest(new { error = "JSON nie zawiera żadnych części do zaimportowania." });
            }

            var startOrder = await dbContext.EventParts
                .Where(x => x.PageId == pageId)
                .Select(x => (int?)x.SortOrder)
                .MaxAsync(ct) ?? -1;

            var warnings = new List<string>();
            var now = DateTimeOffset.UtcNow;
            var (parts, fields) = AddParts(dbContext, page, elements, startOrder + 1, now, warnings);

            await TouchSiteAsync(dbContext, page.SiteId, ct);
            await dbContext.SaveChangesAsync(ct);

            return Results.Ok(new EventImportResult(page.SiteId, page.Slug, 0, parts, fields, warnings));
        }).RequireAuthorization();
    }

    // ── Building ─────────────────────────────────────────────────────────────

    private static EventPage NewPage(
        Guid siteId, int sortOrder, string kind, string slug, string title,
        string menuLabel, string? description, DateTimeOffset now) =>
        new()
        {
            Id = Guid.NewGuid(),
            SiteId = siteId,
            SortOrder = sortOrder,
            Kind = kind,
            Slug = slug,
            Title = title,
            MenuLabel = menuLabel,
            Description = description,
            CreatedUtc = now,
            UpdatedUtc = now
        };

    private static (int Parts, int Fields) AddParts(
        RecreatioDbContext dbContext,
        EventPage page,
        List<JsonElement> elements,
        int startOrder,
        DateTimeOffset now,
        List<string> warnings)
    {
        var partCount = 0;
        var fieldCount = 0;
        var order = startOrder;

        foreach (var element in elements)
        {
            var kind = (ReadString(element, "kind") ?? string.Empty).Trim().ToLowerInvariant();
            if (!AllowedPartKinds.Contains(kind))
            {
                warnings.Add($"Pominięto część o nieznanym typie „{kind}”.");
                continue;
            }

            var menuLabel = NormalizeShort(ReadString(element, "menuLabel"), 60) ?? DefaultPartLabel(kind);

            var part = new EventPart
            {
                Id = Guid.NewGuid(),
                PageId = page.Id,
                SortOrder = order++,
                Kind = kind,
                MenuLabel = menuLabel,
                Title = NormalizeShort(ReadString(element, "title"), 200),
                Intro = NormalizeShort(ReadString(element, "intro"), 600),
                ConfigJson = ReadRawJson(element, "config"),
                LayersJson = ReadRawJson(element, "layers") ?? DefaultLayersJson(menuLabel),
                IsVisible = ReadBool(element, "isVisible", true),
                CreatedUtc = now,
                UpdatedUtc = now
            };

            dbContext.EventParts.Add(part);
            partCount += 1;

            if (kind != "form") continue;

            var fieldOrder = 0;
            var identityTaken = new HashSet<string>(StringComparer.Ordinal);

            foreach (var fieldElement in ReadArray(element, "fields"))
            {
                var fieldKind = (ReadString(fieldElement, "kind") ?? string.Empty).Trim().ToLowerInvariant();
                var label = NormalizeShort(ReadString(fieldElement, "label"), 300);

                if (!AllowedFieldKinds.Contains(fieldKind) || label is null)
                {
                    warnings.Add($"Pominięto pole formularza w części „{menuLabel}” (typ „{fieldKind}”, brak etykiety lub nieznany typ).");
                    continue;
                }

                var options = NormalizeOptions(ReadStringList(fieldElement, "options"));
                if ((fieldKind == "select" || fieldKind == "multiselect") && options.Count == 0)
                {
                    warnings.Add($"Pominięto pole „{label}” — typ „{fieldKind}” wymaga listy „options”.");
                    continue;
                }

                // Only one field per form may carry a given identity role.
                var identityRole = NormalizeIdentityRole(ReadString(fieldElement, "identityRole"));
                if (identityRole != "none" && !identityTaken.Add(identityRole))
                {
                    warnings.Add($"Pole „{label}”: rola „{identityRole}” była już zajęta w tym formularzu — ustawiono „none”.");
                    identityRole = "none";
                }

                dbContext.EventPartFields.Add(new EventPartField
                {
                    Id = Guid.NewGuid(),
                    PartId = part.Id,
                    SortOrder = fieldOrder++,
                    Kind = fieldKind,
                    Label = label,
                    HelpText = NormalizeShort(ReadString(fieldElement, "helpText"), 400),
                    OptionsJson = options.Count > 0 ? JsonSerializer.Serialize(options) : null,
                    IsRequired = ReadBool(fieldElement, "isRequired", false),
                    IsHalfWidth = ReadBool(fieldElement, "isHalfWidth", false),
                    IdentityRole = identityRole
                });
                fieldCount += 1;
            }

            if (fieldCount > 0 && !identityTaken.Contains("name"))
            {
                warnings.Add($"Formularz „{menuLabel}” nie ma pola z rolą „name” — zgłoszenia będą anonimowe.");
            }
        }

        return (partCount, fieldCount);
    }

    private static EventSiteUpsertRequest BuildUpsertFromJson(
        JsonElement body,
        string slug,
        string title,
        List<string> warnings)
    {
        var startDate = ReadDate(body, "startDate", warnings);
        var endDate = ReadDate(body, "endDate", warnings);

        string? themeJson = null;
        if (body.TryGetProperty("theme", out var theme) && theme.ValueKind == JsonValueKind.Object)
        {
            themeJson = theme.GetRawText();
        }

        return new EventSiteUpsertRequest(
            slug,
            title,
            NormalizeShort(ReadString(body, "subtitle"), 300),
            NormalizeShort(ReadString(body, "summary"), 400),
            NormalizeShort(ReadString(body, "category"), 80),
            NormalizeShort(ReadString(body, "audience"), 160),
            ReadStringList(body, "places"),
            NormalizeShort(ReadString(body, "thumbnailUrl"), 600),
            startDate,
            endDate,
            NormalizeShort(ReadString(body, "dateLabel"), 120),
            themeJson,
            NormalizeShort(ReadString(body, "smsTemplate"), 600),
            // An imported event stays a draft: the organizer publishes it after
            // looking at it, never the document.
            false);
    }

    /// <summary>Index of the page to treat as public — the marked one, else the first.</summary>
    private static int FindPublicPageIndex(List<JsonElement> pages)
    {
        for (var index = 0; index < pages.Count; index += 1)
        {
            if (string.Equals(ReadString(pages[index], "kind"), "public", StringComparison.OrdinalIgnoreCase))
            {
                return index;
            }
        }
        return 0;
    }

    private static string DefaultLayersJson(string menuLabel)
    {
        var word = menuLabel.Trim().ToUpperInvariant();
        return JsonSerializer.Serialize(new object[]
        {
            new { kind = "gradient", speed = 0.12, angle = 168, from = "#12203a", via = (string?)null, to = "#060a12" },
            new { kind = "bigtext", speed = 0.95, lines = new[] { word.Length > 0 ? word : "SEKCJA" }, opacity = 0.09 }
        });
    }

    private static string DefaultPartLabel(string kind) => kind switch
    {
        "title" => "Start",
        "shortinfos" => "Informacje",
        "text" => "Treść",
        "plan" => "Plan",
        "map" => "Mapa",
        "faq" => "FAQ",
        "form" => "Zapisy",
        "costs" => "Koszty",
        "contact" => "Kontakt",
        "gallery" => "Galeria",
        "files" => "Pliki",
        "people" => "Osoby",
        _ => "Sekcja"
    };

    // ── Tolerant JSON readers ────────────────────────────────────────────────

    private static string? ReadString(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object
        && element.TryGetProperty(name, out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static bool ReadBool(JsonElement element, string name, bool fallback)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(name, out var value))
        {
            return fallback;
        }
        return value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => fallback
        };
    }

    private static List<JsonElement> ReadArray(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object
        && element.TryGetProperty(name, out var value)
        && value.ValueKind == JsonValueKind.Array
            ? value.EnumerateArray().ToList()
            : [];

    private static List<string> ReadStringList(JsonElement element, string name) =>
        ReadArray(element, name)
            .Where(entry => entry.ValueKind == JsonValueKind.String)
            .Select(entry => entry.GetString() ?? string.Empty)
            .Where(entry => entry.Trim().Length > 0)
            .Select(entry => entry.Trim())
            .ToList();

    /// <summary>Keeps a nested object or array verbatim, for part config and layers.</summary>
    private static string? ReadRawJson(JsonElement element, string name)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(name, out var value))
        {
            return null;
        }
        return value.ValueKind is JsonValueKind.Object or JsonValueKind.Array ? value.GetRawText() : null;
    }

    private static DateOnly? ReadDate(JsonElement element, string name, List<string> warnings)
    {
        var raw = ReadString(element, name);
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (DateOnly.TryParse(raw, out var parsed)) return parsed;

        warnings.Add($"Nie udało się odczytać daty „{name}”: „{raw}”. Oczekiwany format to RRRR-MM-DD.");
        return null;
    }
}
