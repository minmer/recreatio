using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Recreatio.Api.Options;

namespace Recreatio.Api.Services.Library;

public sealed record BookLookupResult(
    string Isbn,
    string? Title,
    string? Subtitle,
    IReadOnlyList<string> Authors,
    string? Publisher,
    string? PublishedPlace,
    int? PublishedYear,
    int? PageCount,
    string? Language,
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
        var openLibraryTask = _options.OpenLibraryEnabled
            ? TryOpenLibraryAsync(normalizedIsbn, ct)
            : Task.FromResult<BookLookupResult?>(null);
        var openLibraryEditionTask = _options.OpenLibraryEnabled
            ? TryOpenLibraryEditionAsync(normalizedIsbn, ct)
            : Task.FromResult<BookLookupResult?>(null);
        var googleTask = GoogleAvailable
            ? TryGoogleBooksAsync(normalizedIsbn, ct)
            : Task.FromResult<BookLookupResult?>(null);

        await Task.WhenAll(openLibraryTask, openLibraryEditionTask, googleTask);

        var merged = Merge(normalizedIsbn, await openLibraryTask, await openLibraryEditionTask);
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
                ReadFirstNamed(book, "publishers"),
                ReadFirstNamed(book, "publish_places"),
                ExtractYear(ReadString(book, "publish_date")),
                ReadInt(book, "number_of_pages"),
                Language: null, // jscmd=data does not carry a language code
                Series: null,
                CoverUrl: ReadCover(book),
                Sources: ["openlibrary"]);
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
                isbn, null, null, [], null, null, null, null, language, series, null, ["openlibrary"]);
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
                ReadString(info, "publisher"),
                PublishedPlace: null,
                ExtractYear(ReadString(info, "publishedDate")),
                ReadInt(info, "pageCount"),
                ReadString(info, "language")?.ToLowerInvariant(),
                Series: null,
                cover,
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
            primary.Publisher ?? secondary.Publisher,
            primary.PublishedPlace ?? secondary.PublishedPlace,
            primary.PublishedYear ?? secondary.PublishedYear,
            primary.PageCount ?? secondary.PageCount,
            primary.Language ?? secondary.Language,
            primary.Series ?? secondary.Series,
            primary.CoverUrl ?? secondary.CoverUrl,
            primary.Sources.Concat(secondary.Sources).Distinct().ToList());
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
