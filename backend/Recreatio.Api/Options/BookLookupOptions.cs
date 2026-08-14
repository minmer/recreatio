namespace Recreatio.Api.Options;

public sealed class BookLookupOptions
{
    /// <summary>When false, /library/scan reports owned copies only and never calls out.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Biblioteka Narodowa — the Polish national bibliography. Best source by far
    /// for Polish publications, and the only one that reports the original
    /// language, so it is consulted first and wins on conflicts.
    /// </summary>
    public bool NationalLibraryPlEnabled { get; set; } = true;

    public string NationalLibraryPlBaseUrl { get; set; } = "https://data.bn.org.pl";

    /// <summary>
    /// e-isbn.pl, the Polish ISBN agency. It has no API: the provider holds a
    /// session cookie and scrapes the result table, so it is off by default and
    /// only consulted when every other source misses. Its unique contribution is
    /// binding and very new titles the national library has not catalogued yet.
    /// </summary>
    public bool EIsbnPlEnabled { get; set; }

    public string EIsbnPlBaseUrl { get; set; } = "https://e-isbn.pl";

    public bool OpenLibraryEnabled { get; set; } = true;

    public bool GoogleBooksEnabled { get; set; } = true;

    public string OpenLibraryBaseUrl { get; set; } = "https://openlibrary.org";

    public string GoogleBooksBaseUrl { get; set; } = "https://www.googleapis.com";

    /// <summary>Optional Google Books API key. The endpoint works unauthenticated, just rate-limited harder.</summary>
    public string GoogleBooksApiKey { get; set; } = string.Empty;

    /// <summary>Open Library asks callers to identify themselves; keep a contact address in here.</summary>
    public string UserAgent { get; set; } = "RecreatioLibrary/1.0 (+https://recreatio.pl)";

    public int RequestTimeoutMs { get; set; } = 6000;
}
