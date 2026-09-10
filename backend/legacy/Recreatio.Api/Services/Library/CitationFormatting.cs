using System.Text;
using System.Text.Json;

namespace Recreatio.Api.Services.Library;

/// <summary>
/// The place in a work a quote came from, before rendering. The scheme decides
/// which of the fields carry meaning.
/// </summary>
public sealed record CitationLocator(string Scheme, JsonElement Value);

/// <summary>Context a formatter may need from the work being cited.</summary>
public sealed record CitationContext(
    string? Sigil,
    string? StructureTemplateJson,
    /// <summary>Language the locator is rendered for — "Joh 3,16" vs "J 3,16".</summary>
    string DisplayLanguage
);

/// <summary>
/// One strategy per citation scheme. Adding a scheme means adding a class and
/// registering it — the locator is JSON, so nothing in the database changes.
/// </summary>
public interface ICitationLocatorFormatter
{
    /// <summary>Matches <see cref="Data.Library.LibraryWork.CitationScheme"/>.</summary>
    string Scheme { get; }

    /// <summary>Renders the locator, or null when there is nothing to show.</summary>
    string? Format(JsonElement locator, CitationContext context);
}

public interface ICitationService
{
    IReadOnlyList<string> KnownSchemes { get; }

    /// <summary>Renders a stored LocatorJson. Never throws on malformed input.</summary>
    string? Render(string? locatorJson, string scheme, CitationContext context);
}

public sealed class CitationService : ICitationService
{
    private readonly Dictionary<string, ICitationLocatorFormatter> _formatters;

    public CitationService(IEnumerable<ICitationLocatorFormatter> formatters)
    {
        _formatters = formatters.ToDictionary(x => x.Scheme, StringComparer.OrdinalIgnoreCase);
    }

    public IReadOnlyList<string> KnownSchemes => _formatters.Keys.OrderBy(x => x, StringComparer.Ordinal).ToList();

    public string? Render(string? locatorJson, string scheme, CitationContext context)
    {
        if (string.IsNullOrWhiteSpace(locatorJson)) return null;
        if (!_formatters.TryGetValue(scheme, out var formatter)) return null;

        try
        {
            using var document = JsonDocument.Parse(locatorJson);
            if (document.RootElement.ValueKind != JsonValueKind.Object) return null;

            var rendered = formatter.Format(document.RootElement, context);
            return string.IsNullOrWhiteSpace(rendered) ? null : rendered.Trim();
        }
        catch (JsonException)
        {
            // A locator saved by an older client shape must not break display.
            return null;
        }
    }
}

// ── Shared reading helpers ──────────────────────────────────────────────────

internal static class LocatorJsonExtensions
{
    public static string? Text(this JsonElement element, string property)
    {
        if (!element.TryGetProperty(property, out var value)) return null;
        return value.ValueKind switch
        {
            JsonValueKind.String => Clean(value.GetString()),
            JsonValueKind.Number => value.ToString(),
            _ => null
        };
    }

    public static int? Int(this JsonElement element, string property)
    {
        if (!element.TryGetProperty(property, out var value)) return null;
        return value.ValueKind switch
        {
            JsonValueKind.Number when value.TryGetInt32(out var number) => number,
            JsonValueKind.String when int.TryParse(value.GetString(), out var parsed) => parsed,
            _ => null
        };
    }

    private static string? Clean(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}

// ── Page ────────────────────────────────────────────────────────────────────

/// <summary>
/// Ordinary pagination. Points at the manifestation, since page numbers belong
/// to a printing rather than to the work. Renders "S. 42", "S. 42–45".
/// </summary>
public sealed class PageLocatorFormatter : ICitationLocatorFormatter
{
    public string Scheme => "Page";

    public string? Format(JsonElement locator, CitationContext context)
    {
        var page = locator.Text("page");
        if (page is null) return null;

        var pageEnd = locator.Text("pageEnd");
        var label = context.DisplayLanguage switch
        {
            "de" => "S.",
            "pl" => "s.",
            "la" => "p.",
            _ => "p."
        };

        return pageEnd is null ? $"{label} {page}" : $"{label} {page}–{pageEnd}";
    }
}

// ── Bible ───────────────────────────────────────────────────────────────────

/// <summary>
/// Book, chapter, verse. What matters is the expression — which translation —
/// not the printing it was read in. Renders "Joh 3,16" in German and Polish
/// convention, "Jn 3:16" in English.
/// </summary>
public sealed class BibleReferenceLocatorFormatter : ICitationLocatorFormatter
{
    private readonly IBibleBookCatalog _books;

    public BibleReferenceLocatorFormatter(IBibleBookCatalog books) => _books = books;

    public string Scheme => "BibleReference";

    public string? Format(JsonElement locator, CitationContext context)
    {
        var bookId = locator.Text("book");
        if (bookId is null) return null;

        var abbreviation = _books.Abbreviation(bookId, context.DisplayLanguage) ?? bookId;
        var chapter = locator.Int("chapter");
        if (chapter is null) return abbreviation;

        var verse = locator.Int("verse");
        if (verse is null) return $"{abbreviation} {chapter}";

        // English cites Jn 3:16; German and Polish use Joh 3,16.
        var verseSeparator = context.DisplayLanguage == "en" ? ":" : ",";
        var reference = $"{abbreviation} {chapter}{verseSeparator}{verse}";

        var verseEnd = locator.Int("verseEnd");
        return verseEnd is > 0 && verseEnd > verse ? $"{reference}–{verseEnd}" : reference;
    }
}

/// <summary>
/// Book abbreviations per language. Backed by the same list the frontend uses,
/// so a reference reads identically on both sides.
/// </summary>
public interface IBibleBookCatalog
{
    string? Abbreviation(string bookId, string language);
    IReadOnlyList<BibleBook> All { get; }
}

public sealed record BibleBookName(string Abbr, string Name);

public sealed record BibleBook(string Id, IReadOnlyDictionary<string, BibleBookName> Names);

public sealed class BibleBookCatalog : IBibleBookCatalog
{
    private readonly Dictionary<string, BibleBook> _byId;

    public BibleBookCatalog(IWebHostEnvironment environment, ILogger<BibleBookCatalog> logger)
    {
        var books = new List<BibleBook>();
        var path = Path.Combine(environment.ContentRootPath, "Data", "Library", "bibleBooks.json");

        try
        {
            if (File.Exists(path))
            {
                using var stream = File.OpenRead(path);
                using var document = JsonDocument.Parse(stream);
                foreach (var entry in document.RootElement.EnumerateArray())
                {
                    var id = entry.Text("id");
                    if (id is null) continue;

                    var names = new Dictionary<string, BibleBookName>(StringComparer.OrdinalIgnoreCase);
                    foreach (var property in entry.EnumerateObject())
                    {
                        if (property.Name == "id" || property.Value.ValueKind != JsonValueKind.Object) continue;
                        var abbr = property.Value.Text("abbr");
                        var name = property.Value.Text("name");
                        if (abbr is not null || name is not null)
                        {
                            names[property.Name] = new BibleBookName(abbr ?? name!, name ?? abbr!);
                        }
                    }

                    books.Add(new BibleBook(id, names));
                }
            }
            else
            {
                logger.LogWarning("Bible book list not found at {Path}; references will render raw book ids.", path);
            }
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Bible book list could not be parsed; references will render raw book ids.");
        }

        _byId = books.ToDictionary(x => x.Id, StringComparer.OrdinalIgnoreCase);
        All = books;
    }

    public IReadOnlyList<BibleBook> All { get; }

    public string? Abbreviation(string bookId, string language)
    {
        if (!_byId.TryGetValue(bookId, out var book)) return null;
        if (book.Names.TryGetValue(language, out var localised)) return localised.Abbr;
        // Latin is the reasonable fallback for a scholarly reference.
        return book.Names.TryGetValue("la", out var latin) ? latin.Abbr : book.Names.Values.FirstOrDefault()?.Abbr;
    }
}

// ── Structured work ─────────────────────────────────────────────────────────

/// <summary>
/// Works cited by their own internal division rather than by page: the Summa by
/// part, question and article; the Tractatus by thesis number. The parts are an
/// ordered list, so both are the same scheme with different templates.
/// Renders "STh I, q.2, a.3" and "4.024".
/// </summary>
public sealed class StructuredWorkLocatorFormatter : ICitationLocatorFormatter
{
    public string Scheme => "StructuredWork";

    public string? Format(JsonElement locator, CitationContext context)
    {
        var rendered = new List<string>();

        if (locator.TryGetProperty("parts", out var parts) && parts.ValueKind == JsonValueKind.Array)
        {
            foreach (var part in parts.EnumerateArray())
            {
                if (part.ValueKind != JsonValueKind.Object) continue;
                var value = part.Text("value");
                if (value is null) continue;

                // An empty abbreviation is meaningful: "STh I" has no label on
                // the part, only on the question and article.
                var abbr = part.Text("abbr") ?? part.Text("label");
                rendered.Add(string.IsNullOrEmpty(abbr) ? value : $"{abbr}{value}");
            }
        }

        if (rendered.Count == 0)
        {
            // Single-axis works such as the Tractatus store one bare value.
            var thesis = locator.Text("thesis") ?? locator.Text("value");
            if (thesis is null) return null;
            rendered.Add(thesis);
        }

        var body = string.Join(", ", rendered);
        return string.IsNullOrWhiteSpace(context.Sigil) ? body : $"{context.Sigil} {body}";
    }
}

// ── Magisterial documents ───────────────────────────────────────────────────

/// <summary>
/// Paragraph-numbered documents. The document is cited, never the website that
/// happens to host it. Renders "Nr. 27" / "nr 27" / "no. 27".
/// </summary>
public sealed class DocumentParagraphLocatorFormatter : ICitationLocatorFormatter
{
    public string Scheme => "DocumentParagraph";

    public string? Format(JsonElement locator, CitationContext context)
    {
        var paragraph = locator.Text("paragraph") ?? locator.Text("number");
        if (paragraph is null) return null;

        var paragraphEnd = locator.Text("paragraphEnd");
        var label = context.DisplayLanguage switch
        {
            "de" => "Nr.",
            "pl" => "nr",
            "la" => "n.",
            _ => "no."
        };

        var body = paragraphEnd is null ? paragraph : $"{paragraph}–{paragraphEnd}";
        var sigil = string.IsNullOrWhiteSpace(context.Sigil) ? string.Empty : $"{context.Sigil} ";
        return $"{sigil}{label} {body}";
    }
}

// ── Full reference rendering ────────────────────────────────────────────────

/// <summary>
/// Assembles the reference shown beside a quote: author, title, the parts of the
/// edition that matter for this scheme, and the locator.
/// </summary>
public static class ReferenceComposer
{
    public static string Compose(
        string scheme,
        IReadOnlyList<string> authors,
        string workTitle,
        string? expressionName,
        string? manifestationTitle,
        string? publisher,
        int? publishedYear,
        string? locatorDisplay)
    {
        var builder = new StringBuilder();

        if (authors.Count > 0) builder.Append(string.Join(", ", authors)).Append(", ");

        // A Bible reference names the translation rather than the printing; a
        // paged citation needs the edition, because the page number is its.
        builder.Append(scheme switch
        {
            "BibleReference" => expressionName ?? workTitle,
            _ => manifestationTitle ?? workTitle
        });

        if (scheme is "Page" or "DocumentParagraph")
        {
            if (!string.IsNullOrWhiteSpace(publisher)) builder.Append(", ").Append(publisher);
            if (publishedYear is not null) builder.Append(' ').Append(publishedYear);
        }

        if (!string.IsNullOrWhiteSpace(locatorDisplay)) builder.Append(", ").Append(locatorDisplay);

        return builder.ToString();
    }
}
