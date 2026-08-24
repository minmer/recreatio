namespace Rc.Kernel;

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
public enum RcCapability
{
    Read = 1,
    Write = 2,
    Admin = 3,

    /// <summary>Steht neben der Leiter, nicht darauf.</summary>
    Certify = 10
}

public static class RcCapabilities
{
    /// <summary>Die Zeichenketten aus <c>ck_rc_certificate_cap</c>. Anders geschrieben, anders gemeint.</summary>
    public static string ToText(RcCapability c) => c switch
    {
        RcCapability.Read => "read",
        RcCapability.Write => "write",
        RcCapability.Admin => "admin",
        RcCapability.Certify => "certify",
        _ => throw new ArgumentOutOfRangeException(nameof(c))
    };

    public static bool TryParse(string? text, out RcCapability capability)
    {
        switch (text)
        {
            case "read": capability = RcCapability.Read; return true;
            case "write": capability = RcCapability.Write; return true;
            case "admin": capability = RcCapability.Admin; return true;
            case "certify": capability = RcCapability.Certify; return true;
            default: capability = default; return false;
        }
    }

    /// <summary>
    /// Ob <paramref name="held"/> ausreicht, um <paramref name="needed"/> zu tun.
    ///
    /// <c>certify</c> deckt nur sich selbst, und nichts deckt <c>certify</c> ab.
    /// Das ist die ganze Sonderregel.
    /// </summary>
    public static bool Covers(RcCapability held, RcCapability needed)
    {
        if (needed == RcCapability.Certify) return held == RcCapability.Certify;
        if (held == RcCapability.Certify) return false;
        return held >= needed;
    }

    public static bool CoversAny(IEnumerable<RcCapability> held, RcCapability needed) =>
        held.Any(h => Covers(h, needed));

    /// <summary>
    /// Der Geltungsbereich eines Zertifikats. <c>area</c> ist der Regelfall,
    /// <c>tenant</c> und <c>module</c> sind die groben Kellen fuer
    /// Traegerschaft und Modulverwaltung.
    /// </summary>
    public static string ScopeText(RcScopeKind kind) => kind switch
    {
        RcScopeKind.Area => "area",
        RcScopeKind.Tenant => "tenant",
        RcScopeKind.Module => "module",
        _ => throw new ArgumentOutOfRangeException(nameof(kind))
    };

    public static bool TryParseScope(string? text, out RcScopeKind kind)
    {
        switch (text)
        {
            case "area": kind = RcScopeKind.Area; return true;
            case "tenant": kind = RcScopeKind.Tenant; return true;
            case "module": kind = RcScopeKind.Module; return true;
            default: kind = default; return false;
        }
    }
}

public enum RcScopeKind
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
public sealed record RcPermissionResult(bool Allowed, Guid? Via, Guid? CertificateId)
{
    public static readonly RcPermissionResult Denied = new(false, null, null);
}
