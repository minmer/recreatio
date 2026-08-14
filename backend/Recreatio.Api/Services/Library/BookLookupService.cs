using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Recreatio.Api.Options;

namespace Recreatio.Api.Services.Library;

/// <summary>A named contributor with the role the catalogue recorded for them.</summary>
public sealed record BookContributor(string Name, string Role);

public sealed record BookLookupResult(
    string Isbn,
    string? Title,
    string? Subtitle,
    IReadOnlyList<string> Authors,
    IReadOnlyList<BookContributor> Contributors,
    string? Publisher,
    string? PublishedPlace,
    int? PublishedYear,
    int? PageCount,
    string? Language,
    // OriginalLanguage: the language the work was written in, when the catalogue records it.
    string? OriginalLanguage,
    string? Series,
    string? CoverUrl,
    IReadOnlyList<string> Sources
);

public interface IBookLookupService
{
    bool Enabled { get; }

    /// <summary>
    /// Strips separators and verifies the check digit. Returns null when the code
    /// is not a valid ISBN-10/13, which is how a misread barcode gets caught.
    /// </summary>
    string? NormalizeIsbn(string? raw);

    Task<BookLookupResult?> LookupAsync(string normalizedIsbn, CancellationToken ct);
}

/// <summary>
/// Looks a book up by ISBN in public catalogues. Open Library and Google Books are
/// queried together and merged field by field: Open Library tends to have better
/// publisher and place data, Google Books reliably reports the language.
/// </summary>
public sealed class BookLookupService : IBookLookupService
{
    private readonly HttpClient _httpClient;
    private readonly BookLookupOptions _options;
    private readonly ILogger<BookLookupService> _logger;

    public BookLookupService(HttpClient httpClient, IOptions<BookLookupOptions> options, ILogger<BookLookupService> logger)
    {
        _options = options.Value;
        _logger = logger;
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromMilliseconds(Math.Clamp(_options.RequestTimeoutMs, 1000, 30000));
        if (!_httpClient.DefaultRequestHeaders.Contains("User-Agent") && !string.IsNullOrWhiteSpace(_options.UserAgent))
        {
            _httpClient.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", _options.UserAgent);
        }
        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    /// <summary>
    /// Google Books now serves keyless callers a per-day quota of zero, so it only
    /// counts as available once a key is configured. Open Library needs no key.
    /// </summary>
    private bool GoogleAvailable =>
        _options.GoogleBooksEnabled && !string.IsNullOrWhiteSpace(_options.GoogleBooksApiKey);

    public bool Enabled => _options.Enabled && (_options.OpenLibraryEnabled || GoogleAvailable);

    public string? NormalizeIsbn(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var digits = new string(raw.Where(c => char.IsAsciiLetterOrDigit(c)).ToArray()).ToUpperInvariant();
        return digits.Length switch
        {
            10 when IsValidIsbn10(digits) => digits,
            13 when IsValidIsbn13(digits) => digits,
            _ => null
        };
    }

    public async Task<BookLookupResult?> LookupAsync(string normalizedIsbn, CancellationToken ct)
    {
        if (!Enabled) return null;

        // Every source is queried at once, so a scan costs one round trip.
        // Open Library is split in two: the bibkeys endpoint has the best author
        // and publisher data, the edition record is the one carrying the language.
        var nationalPlTask = _options.NationalLibraryPlEnabled
            ? TryNationalLibraryPlAsync(normalizedIsbn, ct)
            : Task.FromResult<BookLookupResult?>(null);
        var openLibraryTask = _options.OpenLibraryEnabled
            ? TryOpenLibraryAsync(normalizedIsbn, ct)
            : Task.FromResult<BookLookupResult?>(null);
        var openLibraryEditionTask = _options.OpenLibraryEnabled
            ? TryOpenLibraryEditionAsync(normalizedIsbn, ct)
            : Task.FromResult<BookLookupResult?>(null);
        var googleTask = GoogleAvailable
            ? TryGoogleBooksAsync(normalizedIsbn, ct)
            : Task.FromResult<BookLookupResult?>(null);

        await Task.WhenAll(nationalPlTask, openLibraryTask, openLibraryEditionTask, googleTask);

        // Merge order is priority order: Biblioteka Narodowa first, because for a
        // Polish shelf it is both the most accurate and the only one that knows
        // whether the book in hand is a translation.
        var merged = Merge(normalizedIsbn, await nationalPlTask, await openLibraryTask);
        merged = Merge(normalizedIsbn, merged, await openLibraryEditionTask);
        return Merge(normalizedIsbn, merged, await googleTask);
    }

    // ── Providers ───────────────────────────────────────────────────────────

    private async Task<BookLookupResult?> TryOpenLibraryAsync(string isbn, CancellationToken ct)
    {
        var url = $"{_options.OpenLibraryBaseUrl.TrimEnd('/')}/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data";
        var document = await TryGetJsonAsync(url, "Open Library", ct);
        if (document is null) return null;

        using (document)
        {
            if (!document.RootElement.TryGetProperty($"ISBN:{isbn}", out var book)) return null;

            var authors = new List<string>();
            if (book.TryGetProperty("authors", out var authorArray) && authorArray.ValueKind == JsonValueKind.Array)
            {
                foreach (var author in authorArray.EnumerateArray())
                {
                    var name = ReadString(author, "name");
                    if (name is not null) authors.Add(name);
                }
            }

            return new BookLookupResult(
                isbn,
                ReadString(book, "title"),
                ReadString(book, "subtitle"),
                authors,
                authors.Select(name => new BookContributor(name, "author")).ToList(),
                ReadFirstNamed(book, "publishers"),
                ReadFirstNamed(book, "publish_places"),
                ExtractYear(ReadString(book, "publish_date")),
                ReadInt(book, "number_of_pages"),
                Language: null, // jscmd=data does not carry a language code
                OriginalLanguage: null,
                Series: null,
                CoverUrl: ReadCover(book),
                Sources: ["openlibrary"]);
        }
    }

    /// <summary>
    /// Biblioteka Narodowa. Its isbnIssn filter is an exact match on the ISBN as
    /// catalogued, and Polish records are split between the two forms: modern
    /// books under ISBN-13, older ones under ISBN-10. Both are tried at once.
    /// </summary>
    private async Task<BookLookupResult?> TryNationalLibraryPlAsync(string isbn, CancellationToken ct)
    {
        var candidates = new List<string> { isbn };
        var alternate = isbn.Length == 13 ? ConvertIsbn13To10(isbn) : ConvertIsbn10To13(isbn);
        if (alternate is not null) candidates.Add(alternate);

        var attempts = candidates
            .Select(candidate => TryNationalLibraryPlForCodeAsync(isbn, candidate, ct))
            .ToList();
        var results = await Task.WhenAll(attempts);

        return results.FirstOrDefault(result => result is not null);
    }

    private async Task<BookLookupResult?> TryNationalLibraryPlForCodeAsync(string isbn, string code, CancellationToken ct)
    {
        var url = $"{_options.NationalLibraryPlBaseUrl.TrimEnd('/')}/api/institutions/bibs.json?isbnIssn={code}&limit=1";
        var document = await TryGetJsonAsync(url, "Biblioteka Narodowa", ct);
        if (document is null) return null;

        using (document)
        {
            if (!document.RootElement.TryGetProperty("bibs", out var bibs) ||
                bibs.ValueKind != JsonValueKind.Array ||
                bibs.GetArrayLength() == 0)
            {
                return null;
            }

            var bib = bibs[0];

            // The MARC record is far cleaner than the flattened fields: one entry
            // per person with their role, and a title free of appended series.
            var marc = ReadMarcFields(bib);

            var (marcTitle, marcSubtitle) = ReadMarcTitle(marc);
            var (flatTitle, flatSubtitle) = SplitTitle(ReadString(bib, "title"));
            var title = marcTitle ?? flatTitle;
            if (title is null) return null;

            var contributors = ReadMarcContributors(marc);
            if (contributors.Count == 0)
            {
                contributors = ParsePolishAuthors(ReadString(bib, "author"))
                    .Select(name => new BookContributor(name, "author"))
                    .ToList();
            }

            return new BookLookupResult(
                isbn,
                title,
                marcSubtitle ?? flatSubtitle,
                contributors.Where(x => x.Role == "author").Select(x => x.Name).ToList(),
                contributors,
                ReadMarcPublisher(marc) ?? TrimTrailingPunctuation(ReadString(bib, "publisher")),
                ReadMarcPlace(marc) ?? SplitPlace(ReadString(bib, "placeOfPublication")),
                ExtractYear(ReadString(bib, "publicationYear")),
                ReadMarcPageCount(marc),
                MapPolishLanguage(ReadString(bib, "language")),
                MapPolishLanguage(ReadString(bib, "languageOfOriginal")),
                ReadMarcSeries(marc),
                CoverUrl: null,
                Sources: ["bn.org.pl"]);
        }
    }

    /// <summary>
    /// The edition record behind an ISBN. Consulted purely for the fields the
    /// bibkeys endpoint omits — the language code and the series.
    /// </summary>
    private async Task<BookLookupResult?> TryOpenLibraryEditionAsync(string isbn, CancellationToken ct)
    {
        var url = $"{_options.OpenLibraryBaseUrl.TrimEnd('/')}/isbn/{isbn}.json";
        var document = await TryGetJsonAsync(url, "Open Library edition", ct);
        if (document is null) return null;

        using (document)
        {
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return null;

            string? language = null;
            if (root.TryGetProperty("languages", out var languages) && languages.ValueKind == JsonValueKind.Array)
            {
                foreach (var entry in languages.EnumerateArray())
                {
                    // Recorded as { "key": "/languages/eng" }.
                    var key = ReadString(entry, "key");
                    var code = key?.Split('/', StringSplitOptions.RemoveEmptyEntries).LastOrDefault();
                    language = MapMarcLanguage(code);
                    if (language is not null) break;
                }
            }

            string? series = null;
            if (root.TryGetProperty("series", out var seriesArray) && seriesArray.ValueKind == JsonValueKind.Array)
            {
                foreach (var entry in seriesArray.EnumerateArray())
                {
                    if (entry.ValueKind == JsonValueKind.String)
                    {
                        var text = entry.GetString();
                        if (!string.IsNullOrWhiteSpace(text))
                        {
                            series = text.Trim();
                            break;
                        }
                    }
                }
            }

            if (language is null && series is null) return null;

            return new BookLookupResult(
                isbn, null, null, [], [], null, null, null, null, language, null, series, null, ["openlibrary"]);
        }
    }

    private async Task<BookLookupResult?> TryGoogleBooksAsync(string isbn, CancellationToken ct)
    {
        var key = string.IsNullOrWhiteSpace(_options.GoogleBooksApiKey)
            ? string.Empty
            : $"&key={Uri.EscapeDataString(_options.GoogleBooksApiKey)}";
        var url = $"{_options.GoogleBooksBaseUrl.TrimEnd('/')}/books/v1/volumes?q=isbn:{isbn}&maxResults=1{key}";
        var document = await TryGetJsonAsync(url, "Google Books", ct);
        if (document is null) return null;

        using (document)
        {
            if (!document.RootElement.TryGetProperty("items", out var items) ||
                items.ValueKind != JsonValueKind.Array ||
                items.GetArrayLength() == 0)
            {
                return null;
            }

            var volume = items[0];
            if (!volume.TryGetProperty("volumeInfo", out var info)) return null;

            var authors = new List<string>();
            if (info.TryGetProperty("authors", out var authorArray) && authorArray.ValueKind == JsonValueKind.Array)
            {
                foreach (var author in authorArray.EnumerateArray())
                {
                    if (author.ValueKind == JsonValueKind.String)
                    {
                        var name = author.GetString();
                        if (!string.IsNullOrWhiteSpace(name)) authors.Add(name.Trim());
                    }
                }
            }

            string? cover = null;
            if (info.TryGetProperty("imageLinks", out var images))
            {
                cover = ReadString(images, "thumbnail") ?? ReadString(images, "smallThumbnail");
                // Google hands back http:// links, which an https page refuses to load.
                if (cover is not null && cover.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
                {
                    cover = string.Concat("https://", cover.AsSpan("http://".Length));
                }
            }

            return new BookLookupResult(
                isbn,
                ReadString(info, "title"),
                ReadString(info, "subtitle"),
                authors,
                authors.Select(name => new BookContributor(name, "author")).ToList(),
                ReadString(info, "publisher"),
                null, // Google Books does not report a place of publication
                ExtractYear(ReadString(info, "publishedDate")),
                ReadInt(info, "pageCount"),
                ReadString(info, "language")?.ToLowerInvariant(),
                OriginalLanguage: null,
                Series: null,
                CoverUrl: cover,
                Sources: ["googlebooks"]);
        }
    }

    private async Task<JsonDocument?> TryGetJsonAsync(string url, string providerName, CancellationToken ct)
    {
        try
        {
            using var response = await _httpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogInformation("{Provider} lookup returned {Status}.", providerName, (int)response.StatusCode);
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            return await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException)
        {
            // A catalogue being down or slow must not fail the scan: the caller
            // still gets the owned-copies half of the answer.
            _logger.LogInformation(ex, "{Provider} lookup failed.", providerName);
            return null;
        }
    }

    // ── Merging and parsing ─────────────────────────────────────────────────

    private static BookLookupResult? Merge(string isbn, BookLookupResult? primary, BookLookupResult? secondary)
    {
        if (primary is null && secondary is null) return null;
        if (primary is null) return secondary;
        if (secondary is null) return primary;

        return new BookLookupResult(
            isbn,
            primary.Title ?? secondary.Title,
            primary.Subtitle ?? secondary.Subtitle,
            primary.Authors.Count > 0 ? primary.Authors : secondary.Authors,
            primary.Contributors.Count > 0 ? primary.Contributors : secondary.Contributors,
            primary.Publisher ?? secondary.Publisher,
            primary.PublishedPlace ?? secondary.PublishedPlace,
            primary.PublishedYear ?? secondary.PublishedYear,
            primary.PageCount ?? secondary.PageCount,
            primary.Language ?? secondary.Language,
            primary.OriginalLanguage ?? secondary.OriginalLanguage,
            primary.Series ?? secondary.Series,
            primary.CoverUrl ?? secondary.CoverUrl,
            primary.Sources.Concat(secondary.Sources).Distinct().ToList());
    }

    // ── MARC parsing (Biblioteka Narodowa) ──────────────────────────────────

    /// <summary>
    /// One MARC field flattened to (tag, subfield code → values). BN serialises
    /// fields as [{ "700": { "subfields": [ { "a": "…" }, { "e": "…" } ] } }].
    /// </summary>
    private sealed record MarcField(string Tag, List<KeyValuePair<string, string>> Subfields)
    {
        public string? First(string code) =>
            Subfields.FirstOrDefault(x => x.Key == code) is { Value: { Length: > 0 } value } ? value : null;
    }

    private static List<MarcField> ReadMarcFields(JsonElement bib)
    {
        var fields = new List<MarcField>();
        if (!bib.TryGetProperty("marc", out var marc) ||
            !marc.TryGetProperty("fields", out var array) ||
            array.ValueKind != JsonValueKind.Array)
        {
            return fields;
        }

        foreach (var entry in array.EnumerateArray())
        {
            if (entry.ValueKind != JsonValueKind.Object) continue;
            foreach (var property in entry.EnumerateObject())
            {
                if (property.Value.ValueKind != JsonValueKind.Object) continue;
                if (!property.Value.TryGetProperty("subfields", out var subfields) ||
                    subfields.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                var values = new List<KeyValuePair<string, string>>();
                foreach (var subfield in subfields.EnumerateArray())
                {
                    if (subfield.ValueKind != JsonValueKind.Object) continue;
                    foreach (var pair in subfield.EnumerateObject())
                    {
                        if (pair.Value.ValueKind == JsonValueKind.String)
                        {
                            var text = pair.Value.GetString();
                            if (!string.IsNullOrWhiteSpace(text))
                            {
                                values.Add(new KeyValuePair<string, string>(pair.Name, text.Trim()));
                            }
                        }
                    }
                }

                fields.Add(new MarcField(property.Name, values));
            }
        }

        return fields;
    }

    /// <summary>245 $a is the title proper, $b the remainder of the title.</summary>
    private static (string? Title, string? Subtitle) ReadMarcTitle(List<MarcField> fields)
    {
        var field = fields.FirstOrDefault(x => x.Tag == "245");
        if (field is null) return (null, null);
        return (TrimTrailingPunctuation(field.First("a")), TrimTrailingPunctuation(field.First("b")));
    }

    /// <summary>100 is the main entry, 700 the added entries; $e names the role.</summary>
    private static List<BookContributor> ReadMarcContributors(List<MarcField> fields)
    {
        var contributors = new List<BookContributor>();

        foreach (var field in fields.Where(x => x.Tag is "100" or "700"))
        {
            var raw = field.First("a");
            if (raw is null) continue;

            var name = FlipSurnameFirst(TrimTrailingPunctuation(raw) ?? raw);
            if (name is null) continue;

            // A 100 without a relator is the author; an unlabelled 700 is a co-author.
            var role = MapPolishRelator(field.First("e") ?? field.First("4"))
                       ?? (field.Tag == "100" ? "author" : "coauthor");

            if (!contributors.Any(x => x.Name == name && x.Role == role))
            {
                contributors.Add(new BookContributor(name, role));
            }
        }

        return contributors;
    }

    private static string? ReadMarcPublisher(List<MarcField> fields)
    {
        var field = fields.FirstOrDefault(x => x.Tag is "260" or "264");
        return TrimTrailingPunctuation(field?.First("b"));
    }

    private static string? ReadMarcPlace(List<MarcField> fields)
    {
        var field = fields.FirstOrDefault(x => x.Tag is "260" or "264");
        return SplitPlace(field?.First("a"));
    }

    /// <summary>490/440 $a carries the series statement.</summary>
    private static string? ReadMarcSeries(List<MarcField> fields)
    {
        var field = fields.FirstOrDefault(x => x.Tag is "490" or "440");
        return TrimTrailingPunctuation(field?.First("a"));
    }

    /// <summary>300 $a reads like "xxxiv, 671 s." — the largest number is the extent.</summary>
    private static int? ReadMarcPageCount(List<MarcField> fields)
    {
        var extent = fields.FirstOrDefault(x => x.Tag == "300")?.First("a");
        if (extent is null) return null;

        var best = 0;
        foreach (System.Text.RegularExpressions.Match match in
                 System.Text.RegularExpressions.Regex.Matches(extent, @"\d+"))
        {
            if (int.TryParse(match.Value, out var value) && value > best) best = value;
        }

        return best is > 0 and <= 100000 ? best : null;
    }

    /// <summary>BN writes relators as Polish words rather than MARC codes.</summary>
    private static string? MapPolishRelator(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var text = raw.Trim().TrimEnd('.', ',').ToLowerInvariant();

        return text switch
        {
            "autor" or "aut" => "author",
            "współautor" => "coauthor",
            "tłumaczenie" or "tł" or "tłum" or "przekład" or "trl" => "translator",
            "redakcja" or "red" or "edt" => "editor",
            "opracowanie" or "oprac" => "compiler",
            "ilustracje" or "il" or "ill" or "fot" or "fotografie" or "zdjęcia" => "illustrator",
            "wstęp" or "przedmowa" => "foreword",
            "posłowie" => "afterword",
            "komentarz" => "commentary",
            _ => null
        };
    }

    // ── Biblioteka Narodowa parsing ─────────────────────────────────────────

    /// <summary>
    /// BN titles carry MARC punctuation: "Matka Teresa : miłość w czynach /" and
    /// often a series after the slash. Everything after " / " is dropped, and
    /// " : " separates title from subtitle.
    /// </summary>
    private static (string? Title, string? Subtitle) SplitTitle(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return (null, null);

        var text = raw.Trim();
        var slash = text.IndexOf(" / ", StringComparison.Ordinal);
        if (slash >= 0) text = text[..slash];
        text = TrimTrailingPunctuation(text) ?? string.Empty;
        if (text.Length == 0) return (null, null);

        var colon = text.IndexOf(" : ", StringComparison.Ordinal);
        if (colon < 0) return (text, null);

        var title = TrimTrailingPunctuation(text[..colon]);
        var subtitle = TrimTrailingPunctuation(text[(colon + 3)..]);
        return (title, subtitle);
    }

    /// <summary>"Gorle : Włochy" records the town and the country; keep the town.</summary>
    private static string? SplitPlace(string? raw)
    {
        var text = TrimTrailingPunctuation(raw);
        if (text is null) return null;
        var colon = text.IndexOf(" : ", StringComparison.Ordinal);
        return colon < 0 ? text : TrimTrailingPunctuation(text[..colon]);
    }

    private static string? TrimTrailingPunctuation(string? raw)
    {
        if (raw is null) return null;
        var text = raw.Trim().TrimEnd('/', ',', ':', ';', '.', ' ').Trim();
        return text.Length == 0 ? null : text;
    }

    /// <summary>
    /// BN packs contributors into one string as "Surname, Given (dates)" repeated,
    /// sometimes followed by a corporate body. Personal-name entries are extracted
    /// and flipped into the display order this library stores.
    /// </summary>
    private static IReadOnlyList<string> ParsePolishAuthors(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return [];

        var names = new List<string>();
        var remainder = raw;

        // Each authority record ends with its life dates in brackets.
        var matches = System.Text.RegularExpressions.Regex.Matches(raw, @"([^()]+?)\s*\([^)]*\)");
        foreach (System.Text.RegularExpressions.Match match in matches)
        {
            var name = FlipSurnameFirst(match.Groups[1].Value.Trim());
            if (name is not null) names.Add(name);
            remainder = remainder.Replace(match.Value, " ", StringComparison.Ordinal);
        }

        // Modern records may list people without dates; those still read as
        // "Surname, Given", while a leftover corporate body has no comma.
        foreach (var chunk in remainder.Split(new[] { "  " }, StringSplitOptions.RemoveEmptyEntries))
        {
            var trimmed = chunk.Trim();
            if (trimmed.Length == 0 || !trimmed.Contains(',')) continue;
            var name = FlipSurnameFirst(trimmed);
            if (name is not null && !names.Contains(name)) names.Add(name);
        }

        return names;
    }

    /// <summary>"Prus, Bolesław" reads as "Bolesław Prus" on a title page.</summary>
    private static string? FlipSurnameFirst(string raw)
    {
        var text = raw.Trim().TrimEnd(',', ';').Trim();
        if (text.Length == 0) return null;

        var comma = text.IndexOf(',');
        if (comma < 0) return text;

        var surname = text[..comma].Trim();
        var given = text[(comma + 1)..].Trim();
        if (surname.Length == 0) return given.Length == 0 ? null : given;
        return given.Length == 0 ? surname : $"{given} {surname}";
    }

    /// <summary>BN names languages in Polish rather than by code.</summary>
    private static string? MapPolishLanguage(string? name) => name?.Trim().ToLowerInvariant() switch
    {
        "polski" => "pl",
        "angielski" => "en",
        "niemiecki" => "de",
        "francuski" => "fr",
        "włoski" => "it",
        "hiszpański" => "es",
        "portugalski" => "pt",
        "niderlandzki" or "holenderski" => "nl",
        "łaciński" or "łacina" => "la",
        "starogrecki" or "grecki klasyczny" => "grc",
        "grecki" or "nowogrecki" => "el",
        "hebrajski" => "he",
        "rosyjski" => "ru",
        "ukraiński" => "uk",
        "czeski" => "cs",
        "słowacki" => "sk",
        "węgierski" => "hu",
        "litewski" => "lt",
        "szwedzki" => "sv",
        "norweski" => "no",
        "duński" => "da",
        "fiński" => "fi",
        "rumuński" => "ro",
        "turecki" => "tr",
        "arabski" => "ar",
        "chiński" => "zh",
        "japoński" => "ja",
        _ => null
    };

    // ── ISBN conversion ─────────────────────────────────────────────────────

    /// <summary>978-prefixed ISBN-13 values have an ISBN-10 equivalent.</summary>
    private static string? ConvertIsbn13To10(string isbn13)
    {
        if (isbn13.Length != 13 || !isbn13.StartsWith("978", StringComparison.Ordinal)) return null;

        var body = isbn13.Substring(3, 9);
        var sum = 0;
        for (var i = 0; i < 9; i++)
        {
            sum += (body[i] - '0') * (10 - i);
        }

        var remainder = (11 - sum % 11) % 11;
        var check = remainder == 10 ? "X" : remainder.ToString();
        return body + check;
    }

    private static string? ConvertIsbn10To13(string isbn10)
    {
        if (isbn10.Length != 10) return null;

        var body = "978" + isbn10[..9];
        var sum = 0;
        for (var i = 0; i < 12; i++)
        {
            sum += (body[i] - '0') * (i % 2 == 0 ? 1 : 3);
        }

        var check = (10 - sum % 10) % 10;
        return body + check;
    }

    /// <summary>
    /// Open Library records languages as MARC three-letter codes; the library
    /// stores the shorter ISO forms used across the module.
    /// </summary>
    private static string? MapMarcLanguage(string? code) => code?.ToLowerInvariant() switch
    {
        "eng" => "en",
        "pol" => "pl",
        "ger" or "deu" => "de",
        "fre" or "fra" => "fr",
        "ita" => "it",
        "spa" => "es",
        "por" => "pt",
        "dut" or "nld" => "nl",
        "lat" => "la",
        "grc" => "grc",
        "heb" => "he",
        "rus" => "ru",
        "ukr" => "uk",
        "cze" or "ces" => "cs",
        "slo" or "slk" => "sk",
        "hun" => "hu",
        "lit" => "lt",
        "swe" => "sv",
        "nor" => "no",
        "dan" => "da",
        "fin" => "fi",
        "rum" or "ron" => "ro",
        "gre" or "ell" => "el",
        "tur" => "tr",
        "ara" => "ar",
        "chi" or "zho" => "zh",
        "jpn" => "ja",
        _ => null
    };

    private static string? ReadString(JsonElement element, string property)
    {
        if (!element.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.String) return null;
        var text = value.GetString();
        return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
    }

    private static int? ReadInt(JsonElement element, string property)
    {
        if (!element.TryGetProperty(property, out var value)) return null;
        return value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var parsed) && parsed > 0 ? parsed : null;
    }

    /// <summary>Open Library nests publishers and places as [{ "name": "…" }].</summary>
    private static string? ReadFirstNamed(JsonElement element, string property)
    {
        if (!element.TryGetProperty(property, out var array) || array.ValueKind != JsonValueKind.Array) return null;
        foreach (var item in array.EnumerateArray())
        {
            var name = ReadString(item, "name");
            if (name is not null) return name;
        }
        return null;
    }

    private static string? ReadCover(JsonElement book)
    {
        if (!book.TryGetProperty("cover", out var cover)) return null;
        return ReadString(cover, "large") ?? ReadString(cover, "medium") ?? ReadString(cover, "small");
    }

    /// <summary>Publish dates arrive as "2003", "March 2003" or "2003-01-01".</summary>
    private static int? ExtractYear(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        for (var i = 0; i + 4 <= text.Length; i++)
        {
            var span = text.AsSpan(i, 4);
            if (!span[0].Equals('0') && span.ToString().All(char.IsAsciiDigit) &&
                int.TryParse(span, out var year) && year is >= 1000 and <= 2999)
            {
                return year;
            }
        }

        return null;
    }

    private static bool IsValidIsbn10(string value)
    {
        var sum = 0;
        for (var i = 0; i < 9; i++)
        {
            if (!char.IsAsciiDigit(value[i])) return false;
            sum += (value[i] - '0') * (10 - i);
        }

        var last = value[9];
        var checkDigit = last == 'X' ? 10 : char.IsAsciiDigit(last) ? last - '0' : -1;
        if (checkDigit < 0) return false;

        return (sum + checkDigit) % 11 == 0;
    }

    private static bool IsValidIsbn13(string value)
    {
        if (!value.All(char.IsAsciiDigit)) return false;

        var sum = 0;
        for (var i = 0; i < 12; i++)
        {
            sum += (value[i] - '0') * (i % 2 == 0 ? 1 : 3);
        }

        var checkDigit = (10 - sum % 10) % 10;
        return checkDigit == value[12] - '0';
    }
}
