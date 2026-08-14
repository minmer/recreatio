namespace Recreatio.Api.Options;

public sealed class BookLookupOptions
{
    /// <summary>When false, /library/scan reports owned copies only and never calls out.</summary>
    public bool Enabled { get; set; } = true;

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
