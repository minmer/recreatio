using System.Text;

namespace Recreatio.Api.Services.Library;

// Citation style is a separate axis from citation scheme.
//
//   Scheme  decides *where in the work* a quote sits, and renders the locator:
//           "s. 42", "Joh 3,16", "STh I, q.2, a.3".
//   Style   decides *how the whole reference reads*: name order, punctuation,
//           which elements appear and in what order.
//
// A quote therefore renders differently under Chicago and under the Polish
// convention while pointing at exactly the same place.
//
// Styles must also respect the scheme. Scripture is never cited with a
// publisher in any style — you name the translation. Works cited by internal
// division (the Summa) drop the imprint from the note. Those rules live here.

/// <summary>
/// A contributor's name in both orders. Surname-first matters: most styles put
/// the author surname-first in a bibliography and given-first in a note.
/// </summary>
public sealed record CitationName(string Display, string? Sort)
{
    /// <summary>"Prus, Bolesław" — from SortName, or derived from the display form.</summary>
    public string SurnameFirst => Sort ?? DeriveSurnameFirst(Display);

    /// <summary>
    /// Names that must never be inverted or initialised: mononyms and regnal
    /// names. A theology library is full of them — "Jan Paweł II", "Benedykt XVI",
    /// "Franciszek" — and treating "II" as a surname would be badly wrong.
    /// </summary>
    private bool IsUninvertible
    {
        get
        {
            if (Sort is not null) return false;
            var parts = Display.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length <= 1) return true;
            return IsRomanNumeral(parts[^1]);
        }
    }

    private static bool IsRomanNumeral(string token) =>
        token.Length > 0 && token.All(c => "IVXLCDM".Contains(char.ToUpperInvariant(c)));

    /// <summary>"Bolesław Prus".</summary>
    public string GivenFirst => Display;

    public string Surname
    {
        get
        {
            if (IsUninvertible) return Display.Trim();
            var sort = SurnameFirst;
            var comma = sort.IndexOf(',');
            return comma > 0 ? sort[..comma].Trim() : sort.Trim();
        }
    }

    /// <summary>"B." — used by the Polish and author-date conventions.</summary>
    public string Initials
    {
        get
        {
            // A regnal or single-part name carries no separable given name.
            if (IsUninvertible) return string.Empty;

            var sort = SurnameFirst;
            var comma = sort.IndexOf(',');
            var given = comma > 0 ? sort[(comma + 1)..].Trim() : string.Empty;
            if (given.Length == 0) return string.Empty;

            var parts = given.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return string.Join(" ", parts.Where(p => p.Length > 0).Select(p => $"{char.ToUpperInvariant(p[0])}."));
        }
    }

    /// <summary>
    /// Last whitespace-separated token is treated as the surname — unless the
    /// name is a mononym or ends in a regnal number, in which case it stands as
    /// written. Set SortName explicitly for anything this guesses wrongly.
    /// </summary>
    private static string DeriveSurnameFirst(string display)
    {
        var trimmed = display.Trim();
        var parts = trimmed.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length <= 1 || IsRomanNumeral(parts[^1])) return trimmed;

        var lastSpace = trimmed.LastIndexOf(' ');
        return $"{trimmed[(lastSpace + 1)..]}, {trimmed[..lastSpace]}";
    }
}

/// <summary>Everything a style needs to write one reference.</summary>
public sealed record CitationSubject(
    string Scheme,
    IReadOnlyList<CitationName> Authors,
    IReadOnlyList<CitationName> Translators,
    IReadOnlyList<CitationName> Editors,
    string WorkTitle,
    string? ExpressionName,
    string? ExpressionLanguage,
    string? ManifestationTitle,
    string? Publisher,
    string? Place,
    int? Year,
    string? EditionStatement,
    string? Series,
    string? Url,
    // Locator as the scheme renders it: "s. 42", "Joh 3,16", "STh I, q.2, a.3".
    string? LocatorDisplay,
    // The same position without a label: "42", "3,16". Styles that supply their
    // own label ("p. 42", or a bare number in Chicago notes) use this instead.
    string? LocatorBare,
    string? Sigil
);

public interface ICitationStyle
{
    /// <summary>Stable key used in the API and stored in the reader's preference.</summary>
    string Key { get; }

    string DisplayName { get; }

    /// <summary>The form that goes in a footnote or in running text.</summary>
    string FormatNote(CitationSubject subject);

    /// <summary>The form that goes in a list of works, author surname first.</summary>
    string FormatBibliography(CitationSubject subject);
}

public interface ICitationStyleRegistry
{
    IReadOnlyList<ICitationStyle> All { get; }
    ICitationStyle Resolve(string? key);
}

public sealed class CitationStyleRegistry : ICitationStyleRegistry
{
    private readonly Dictionary<string, ICitationStyle> _styles;
    private readonly ICitationStyle _fallback;

    public CitationStyleRegistry(IEnumerable<ICitationStyle> styles)
    {
        All = styles.OrderBy(x => x.DisplayName, StringComparer.CurrentCulture).ToList();
        _styles = All.ToDictionary(x => x.Key, StringComparer.OrdinalIgnoreCase);
        _fallback = _styles.GetValueOrDefault("polish") ?? All[0];
    }

    public IReadOnlyList<ICitationStyle> All { get; }

    public ICitationStyle Resolve(string? key) =>
        key is not null && _styles.TryGetValue(key, out var style) ? style : _fallback;
}

// ── Shared helpers ──────────────────────────────────────────────────────────

/// <summary>
/// Rules every style shares about what a scheme allows, so scholarly conventions
/// are not re-argued in each implementation.
/// </summary>
internal static class CitationRules
{
    /// <summary>
    /// Scripture is cited by translation, never by imprint; works cited by their
    /// own internal division carry the imprint only in a bibliography.
    /// </summary>
    public static bool ImprintInNote(string scheme) => scheme is "Page";

    public static bool IsScripture(string scheme) => scheme is "BibleReference";

    /// <summary>The title a reference should lead with for this scheme.</summary>
    public static string Title(CitationSubject subject) =>
        IsScripture(subject.Scheme)
            // A Bible citation names the translation, not the printing.
            ? subject.ExpressionName ?? subject.WorkTitle
            : subject.ManifestationTitle ?? subject.WorkTitle;

    public static void AppendIfPresent(StringBuilder builder, string? value, string separator = ", ")
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        if (builder.Length > 0) builder.Append(separator);
        builder.Append(value.Trim());
    }

    public static string Join(IReadOnlyList<string> parts, string separator = ", ") =>
        string.Join(separator, parts.Where(x => !string.IsNullOrWhiteSpace(x)));

    /// <summary>Trims a trailing separator and closes the reference with a stop.</summary>
    public static string Close(string text)
    {
        var trimmed = text.TrimEnd(' ', ',', ';');
        if (trimmed.Length == 0) return trimmed;
        return trimmed.EndsWith('.') ? trimmed : trimmed + ".";
    }
}

// ── Polish humanities convention ────────────────────────────────────────────

/// <summary>
/// The convention used across Polish theology and pedagogy:
/// "B. Prus, Lalka, Wrocław 1991, s. 42."
/// </summary>
public sealed class PolishCitationStyle : ICitationStyle
{
    public string Key => "polish";
    public string DisplayName => "Polska (tradycyjna)";

    public string FormatNote(CitationSubject subject)
    {
        var parts = new List<string>();

        // Initial before surname is the Polish footnote habit.
        if (subject.Authors.Count > 0)
        {
            parts.Add(CitationRules.Join(
                subject.Authors.Select(a => $"{a.Initials} {a.Surname}".Trim()).ToList()));
        }

        parts.Add(CitationRules.Title(subject));

        if (subject.Translators.Count > 0 && !CitationRules.IsScripture(subject.Scheme))
        {
            parts.Add($"tłum. {CitationRules.Join(subject.Translators.Select(t => $"{t.Initials} {t.Surname}".Trim()).ToList())}");
        }

        if (CitationRules.ImprintInNote(subject.Scheme))
        {
            var imprint = CitationRules.Join([subject.Place ?? string.Empty, subject.Year?.ToString() ?? string.Empty], " ");
            if (imprint.Length > 0) parts.Add(imprint);
        }

        if (!string.IsNullOrWhiteSpace(subject.LocatorDisplay)) parts.Add(subject.LocatorDisplay);

        return CitationRules.Close(CitationRules.Join(parts));
    }

    public string FormatBibliography(CitationSubject subject)
    {
        var parts = new List<string>();

        if (subject.Authors.Count > 0)
        {
            parts.Add(CitationRules.Join(
                subject.Authors.Select(a => $"{a.Surname} {a.Initials}".Trim()).ToList()));
        }

        parts.Add(CitationRules.Title(subject));

        if (subject.Translators.Count > 0)
        {
            parts.Add($"tłum. {CitationRules.Join(subject.Translators.Select(t => $"{t.Initials} {t.Surname}".Trim()).ToList())}");
        }

        var imprint = CitationRules.Join([subject.Place ?? string.Empty, subject.Year?.ToString() ?? string.Empty], " ");
        if (imprint.Length > 0) parts.Add(imprint);

        return CitationRules.Close(CitationRules.Join(parts));
    }
}

// ── Deutsche Zitierweise ────────────────────────────────────────────────────

/// <summary>
/// The full-footnote German convention common in theology:
/// "Bolesław Prus, Lalka, Wrocław: Ossolineum 1991, S. 42."
/// </summary>
public sealed class GermanCitationStyle : ICitationStyle
{
    public string Key => "german";
    public string DisplayName => "Deutsche Zitierweise";

    public string FormatNote(CitationSubject subject)
    {
        var parts = new List<string>();

        if (subject.Authors.Count > 0)
        {
            parts.Add(CitationRules.Join(subject.Authors.Select(a => a.GivenFirst).ToList()));
        }

        parts.Add(CitationRules.Title(subject));

        if (subject.Translators.Count > 0 && !CitationRules.IsScripture(subject.Scheme))
        {
            parts.Add($"übers. v. {CitationRules.Join(subject.Translators.Select(t => t.GivenFirst).ToList())}");
        }

        if (!string.IsNullOrWhiteSpace(subject.EditionStatement)) parts.Add(subject.EditionStatement);

        if (CitationRules.ImprintInNote(subject.Scheme))
        {
            var publisher = string.IsNullOrWhiteSpace(subject.Publisher) ? null : subject.Publisher;
            var place = string.IsNullOrWhiteSpace(subject.Place) ? null : subject.Place;
            var imprint = place is not null && publisher is not null
                ? $"{place}: {publisher} {subject.Year}"
                : CitationRules.Join([place ?? publisher ?? string.Empty, subject.Year?.ToString() ?? string.Empty], " ");
            if (!string.IsNullOrWhiteSpace(imprint)) parts.Add(imprint.Trim());
        }

        if (!string.IsNullOrWhiteSpace(subject.LocatorDisplay)) parts.Add(subject.LocatorDisplay);

        return CitationRules.Close(CitationRules.Join(parts));
    }

    public string FormatBibliography(CitationSubject subject)
    {
        var builder = new StringBuilder();

        if (subject.Authors.Count > 0)
        {
            // German bibliographies separate name from title with a colon.
            builder.Append(CitationRules.Join(subject.Authors.Select(a => a.SurnameFirst).ToList(), "; "));
            builder.Append(": ");
        }

        builder.Append(CitationRules.Title(subject));

        var publisher = string.IsNullOrWhiteSpace(subject.Publisher) ? null : subject.Publisher;
        var place = string.IsNullOrWhiteSpace(subject.Place) ? null : subject.Place;
        var imprint = place is not null && publisher is not null
            ? $"{place}: {publisher} {subject.Year}"
            : CitationRules.Join([place ?? publisher ?? string.Empty, subject.Year?.ToString() ?? string.Empty], " ");
        if (!string.IsNullOrWhiteSpace(imprint)) builder.Append(", ").Append(imprint.Trim());

        return CitationRules.Close(builder.ToString());
    }
}

// ── Chicago, notes and bibliography ─────────────────────────────────────────

/// <summary>
/// Chicago 17th, notes-bibliography — the humanities default in English:
/// "Bolesław Prus, Lalka (Wrocław: Ossolineum, 1991), 42."
/// Scripture takes the Chicago form "John 3:16 (NRSV)".
/// </summary>
public sealed class ChicagoNoteCitationStyle : ICitationStyle
{
    public string Key => "chicago-note";
    public string DisplayName => "Chicago (notes)";

    public string FormatNote(CitationSubject subject)
    {
        if (CitationRules.IsScripture(subject.Scheme))
        {
            // Chicago cites scripture in the note and identifies the version.
            var version = subject.ExpressionName ?? subject.ExpressionLanguage;
            return CitationRules.Close(version is null
                ? subject.LocatorDisplay ?? subject.WorkTitle
                : $"{subject.LocatorDisplay ?? subject.WorkTitle} ({version})");
        }

        var builder = new StringBuilder();
        if (subject.Authors.Count > 0)
        {
            builder.Append(CitationRules.Join(subject.Authors.Select(a => a.GivenFirst).ToList()));
            builder.Append(", ");
        }

        builder.Append(CitationRules.Title(subject));

        if (subject.Translators.Count > 0)
        {
            builder.Append(", trans. ").Append(CitationRules.Join(subject.Translators.Select(t => t.GivenFirst).ToList()));
        }

        if (CitationRules.ImprintInNote(subject.Scheme))
        {
            var imprint = subject.Publisher is { Length: > 0 } && subject.Place is { Length: > 0 }
                ? $"{subject.Place}: {subject.Publisher}, {subject.Year}"
                : CitationRules.Join([subject.Place ?? subject.Publisher ?? string.Empty, subject.Year?.ToString() ?? string.Empty], ", ");
            if (!string.IsNullOrWhiteSpace(imprint)) builder.Append(" (").Append(imprint.Trim(' ', ',')).Append(')');
        }

        // Chicago notes give a bare page number, without "p.".
        var locator = CitationRules.ImprintInNote(subject.Scheme) ? subject.LocatorBare : subject.LocatorDisplay;
        if (!string.IsNullOrWhiteSpace(locator)) builder.Append(", ").Append(locator);

        return CitationRules.Close(builder.ToString());
    }

    public string FormatBibliography(CitationSubject subject)
    {
        var builder = new StringBuilder();

        if (subject.Authors.Count > 0)
        {
            // Only the first author inverts in Chicago.
            var names = subject.Authors.Select((a, index) => index == 0 ? a.SurnameFirst : a.GivenFirst).ToList();
            builder.Append(CitationRules.Join(names)).Append(". ");
        }

        builder.Append(CitationRules.Title(subject)).Append('.');

        if (subject.Translators.Count > 0)
        {
            builder.Append(" Translated by ")
                   .Append(CitationRules.Join(subject.Translators.Select(t => t.GivenFirst).ToList()))
                   .Append('.');
        }

        if (subject.Place is { Length: > 0 }) builder.Append(' ').Append(subject.Place).Append(':');
        if (subject.Publisher is { Length: > 0 }) builder.Append(' ').Append(subject.Publisher).Append(',');
        if (subject.Year is not null) builder.Append(' ').Append(subject.Year);

        return CitationRules.Close(builder.ToString());
    }
}

// ── Author-date family ──────────────────────────────────────────────────────

/// <summary>
/// Shared machinery for the author-date styles. They differ only in punctuation
/// and in how the in-text locator is labelled, so one base keeps them honest
/// about being variants rather than four unrelated implementations.
/// </summary>
public abstract class AuthorDateCitationStyle : ICitationStyle
{
    public abstract string Key { get; }
    public abstract string DisplayName { get; }

    /// <summary>Separator between year and locator inside the in-text bracket.</summary>
    protected abstract string InTextLocatorSeparator { get; }

    /// <summary>Label placed before a page number in text; empty for MLA.</summary>
    protected abstract string PageLabel { get; }

    /// <summary>Whether the year appears in the in-text bracket at all.</summary>
    protected virtual bool YearInText => true;

    public string FormatNote(CitationSubject subject)
    {
        if (CitationRules.IsScripture(subject.Scheme))
        {
            var version = subject.ExpressionName ?? subject.ExpressionLanguage;
            return version is null
                ? subject.LocatorDisplay ?? subject.WorkTitle
                : $"{subject.LocatorDisplay ?? subject.WorkTitle} ({version})";
        }

        var author = subject.Authors.Count > 0
            ? CitationRules.Join(subject.Authors.Select(a => a.Surname).ToList(), " & ")
            : CitationRules.Title(subject);

        var inner = new StringBuilder(author);
        if (YearInText && subject.Year is not null) inner.Append(", ").Append(subject.Year);

        var locator = subject.LocatorBare ?? subject.LocatorDisplay;
        if (!string.IsNullOrWhiteSpace(locator))
        {
            inner.Append(InTextLocatorSeparator);
            if (PageLabel.Length > 0 && CitationRules.ImprintInNote(subject.Scheme))
            {
                inner.Append(PageLabel).Append(' ');
            }
            inner.Append(locator);
        }

        return $"({inner})";
    }

    public virtual string FormatBibliography(CitationSubject subject)
    {
        var builder = new StringBuilder();

        if (subject.Authors.Count > 0)
        {
            builder.Append(CitationRules.Join(
                subject.Authors.Select(a => $"{a.Surname}, {a.Initials}".Trim(' ', ',')).ToList(), ", "));
            builder.Append(' ');
        }

        if (subject.Year is not null) builder.Append('(').Append(subject.Year).Append("). ");
        builder.Append(CitationRules.Title(subject)).Append('.');

        if (subject.Publisher is { Length: > 0 }) builder.Append(' ').Append(subject.Publisher).Append('.');

        return builder.ToString().TrimEnd();
    }
}

/// <summary>APA 7 — the pedagogy and social-science default. In text: (Prus, 1991, p. 42).</summary>
public sealed class ApaCitationStyle : AuthorDateCitationStyle
{
    public override string Key => "apa";
    public override string DisplayName => "APA 7";
    protected override string InTextLocatorSeparator => ", ";
    protected override string PageLabel => "p.";
}

/// <summary>Harvard — in text: (Prus, 1991, p. 42); imprint includes the place.</summary>
public sealed class HarvardCitationStyle : AuthorDateCitationStyle
{
    public override string Key => "harvard";
    public override string DisplayName => "Harvard";
    protected override string InTextLocatorSeparator => ", ";
    protected override string PageLabel => "p.";

    public override string FormatBibliography(CitationSubject subject)
    {
        var builder = new StringBuilder();

        if (subject.Authors.Count > 0)
        {
            builder.Append(CitationRules.Join(
                subject.Authors.Select(a => $"{a.Surname}, {a.Initials}".Trim(' ', ',')).ToList(), ", "));
            builder.Append(' ');
        }

        if (subject.Year is not null) builder.Append('(').Append(subject.Year).Append(") ");
        builder.Append(CitationRules.Title(subject)).Append('.');

        if (subject.Place is { Length: > 0 }) builder.Append(' ').Append(subject.Place).Append(':');
        if (subject.Publisher is { Length: > 0 }) builder.Append(' ').Append(subject.Publisher).Append('.');

        return builder.ToString().TrimEnd();
    }
}

/// <summary>Cambridge author-date — in text the year and page are colon-separated: (Prus 1991: 42).</summary>
public sealed class CambridgeCitationStyle : AuthorDateCitationStyle
{
    public override string Key => "cambridge";
    public override string DisplayName => "Cambridge (author–date)";
    protected override string InTextLocatorSeparator => ": ";
    protected override string PageLabel => string.Empty;

    public override string FormatBibliography(CitationSubject subject)
    {
        var builder = new StringBuilder();

        if (subject.Authors.Count > 0)
        {
            builder.Append(CitationRules.Join(
                subject.Authors.Select(a => $"{a.Surname}, {a.Initials}".Trim(' ', ',')).ToList(), ", "));
            builder.Append(' ');
        }

        if (subject.Year is not null) builder.Append(subject.Year).Append(". ");
        builder.Append(CitationRules.Title(subject)).Append('.');

        if (subject.Place is { Length: > 0 }) builder.Append(' ').Append(subject.Place).Append(':');
        if (subject.Publisher is { Length: > 0 }) builder.Append(' ').Append(subject.Publisher).Append('.');

        return builder.ToString().TrimEnd();
    }
}

/// <summary>MLA 9 — in text the year is absent: (Prus 42).</summary>
public sealed class MlaCitationStyle : AuthorDateCitationStyle
{
    public override string Key => "mla";
    public override string DisplayName => "MLA 9";
    protected override string InTextLocatorSeparator => " ";
    protected override string PageLabel => string.Empty;
    protected override bool YearInText => false;

    public override string FormatBibliography(CitationSubject subject)
    {
        var builder = new StringBuilder();

        if (subject.Authors.Count > 0)
        {
            var names = subject.Authors.Select((a, index) => index == 0 ? a.SurnameFirst : a.GivenFirst).ToList();
            builder.Append(CitationRules.Join(names)).Append(". ");
        }

        builder.Append(CitationRules.Title(subject)).Append('.');

        if (subject.Publisher is { Length: > 0 }) builder.Append(' ').Append(subject.Publisher).Append(',');
        if (subject.Year is not null) builder.Append(' ').Append(subject.Year);

        return CitationRules.Close(builder.ToString());
    }
}
