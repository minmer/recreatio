namespace Kernel;

/// <summary>
/// 3.5 — Vier Stufen, und die Frage, die die Spezifikation offenlaesst:
/// <b>schliesst die hoehere die niedrigere ein?</b>
///
/// <c>rc_certificate.capability</c> kennt <c>read | write | admin | certify</c>.
/// Ohne festgelegte Ordnung braeuchte ein Verwalter, der auch lesen darf, ZWEI
/// Zertifikate — und irgendwann fehlt eines davon. Das faellt nicht beim
/// Ausstellen auf, sondern Wochen spaeter, wenn jemand etwas nicht sehen kann,
/// das er verwaltet.
///
/// <b>Entschieden:</b> read &lt; write &lt; admin, und certify steht daneben.
///
/// <code>
///   certify ──┐   (darf Zertifikate ausstellen)
///             │
///   admin ────┼── schliesst write ein
///     │       │
///   write ────┘── schliesst read ein
///     │
///   read
/// </code>
///
/// <b>Warum certify nicht oben steht.</b> Wer Zertifikate ausstellen darf, darf
/// damit noch lange nicht selbst lesen. Das ist der Fall des Pfarrers, der
/// jemanden in eine Gruppe aufnimmt, deren Inhalte ihn nichts angehen — und
/// genau dieser Fall geht verloren, sobald certify die anderen einschliesst.
/// Umgekehrt ist es genauso: ein Verwalter, der alles lesen und aendern darf,
/// darf deshalb noch niemanden hineinlassen.
///
/// Wer beides braucht, bekommt zwei Zertifikate. Das ist keine Umstaendlichkeit,
/// sondern die Stelle, an der jemand einmal hinschauen muss.
/// </summary>
public enum Capability
{
    Read = 1,
    Write = 2,
    Admin = 3,

    /// <summary>Steht neben der Leiter, nicht darauf.</summary>
    Certify = 10
}

public static class Capabilities
{
    /// <summary>Die Zeichenketten aus <c>ck_rc_certificate_cap</c>. Anders geschrieben, anders gemeint.</summary>
    public static string ToText(Capability c) => c switch
    {
        Capability.Read => "read",
        Capability.Write => "write",
        Capability.Admin => "admin",
        Capability.Certify => "certify",
        _ => throw new ArgumentOutOfRangeException(nameof(c))
    };

    public static bool TryParse(string? text, out Capability capability)
    {
        switch (text)
        {
            case "read": capability = Capability.Read; return true;
            case "write": capability = Capability.Write; return true;
            case "admin": capability = Capability.Admin; return true;
            case "certify": capability = Capability.Certify; return true;
            default: capability = default; return false;
        }
    }

    /// <summary>
    /// Ob <paramref name="held"/> ausreicht, um <paramref name="needed"/> zu tun.
    ///
    /// <c>certify</c> deckt nur sich selbst, und nichts deckt <c>certify</c> ab.
    /// Das ist die ganze Sonderregel.
    /// </summary>
    public static bool Covers(Capability held, Capability needed)
    {
        if (needed == Capability.Certify) return held == Capability.Certify;
        if (held == Capability.Certify) return false;
        return held >= needed;
    }

    public static bool CoversAny(IEnumerable<Capability> held, Capability needed) =>
        held.Any(h => Covers(h, needed));

    /// <summary>
    /// Der Geltungsbereich eines Zertifikats. <c>area</c> ist der Regelfall,
    /// <c>tenant</c> und <c>module</c> sind die groben Kellen fuer
    /// Traegerschaft und Modulverwaltung.
    /// </summary>
    public static string ScopeText(ScopeKind kind) => kind switch
    {
        ScopeKind.Area => "area",
        ScopeKind.Tenant => "tenant",
        ScopeKind.Module => "module",
        _ => throw new ArgumentOutOfRangeException(nameof(kind))
    };

    public static bool TryParseScope(string? text, out ScopeKind kind)
    {
        switch (text)
        {
            case "area": kind = ScopeKind.Area; return true;
            case "tenant": kind = ScopeKind.Tenant; return true;
            case "module": kind = ScopeKind.Module; return true;
            default: kind = default; return false;
        }
    }
}

public enum ScopeKind
{
    Area = 1,
    Tenant = 2,
    Module = 3
}

/// <summary>
/// Was am Ende einer Berechtigungspruefung steht. Nicht bloss ja oder nein:
/// <see cref="Via"/> nennt die Rolle, ueber die es gilt — ohne sie kann niemand
/// beantworten, WARUM jemand etwas darf, und eine Berechtigung, die sich nicht
/// erklaeren laesst, laesst sich auch nicht zurechtruecken.
/// </summary>
public sealed record PermissionResult(bool Allowed, Guid? Via, Guid? CertificateId)
{
    public static readonly PermissionResult Denied = new(false, null, null);
}
