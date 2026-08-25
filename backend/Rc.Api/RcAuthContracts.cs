namespace Rc.Api;

/// <summary>
/// 15.6 — Die Antwortformen der Anmeldung, mit Namen.
///
/// <b>Warum benannte Datensätze und keine anonymen Objekte mehr.</b> Ein
/// <c>new { … }</c> im Endpunkt ist bequem zu schreiben und fuer einen Klienten
/// unsichtbar: aus ihm laesst sich keine Beschreibung erzeugen, weil er keinen
/// Namen hat, unter dem er in einem Schema stehen koennte.
///
/// Solange der Browser-Teil die Formen von Hand nachbaute, fiel das nicht auf —
/// es fiel nur spaeter auf, naemlich wenn eine Umbenennung im Server die
/// Nachbildung still falsch machte. Genau diese Stelle schliesst der erzeugte
/// Klient, und dafuer brauchen die Antworten Namen.
///
/// <b>Diese Datei ist der Vertrag.</b> Wer hier etwas umbenennt, bricht den
/// Bau des Browser-Teils — und das ist der Zweck der Uebung: der Bruch soll
/// beim Uebersetzen auffallen und nicht im Browser eines Menschen.
/// </summary>
public sealed record RcArgon2Parameters(int MemoryKiB, int Iterations, int Parallelism, int OutputBytes)
{
    /// <summary>21.1 — Die Parameter reisen mit, damit sie sich einmal aendern lassen.</summary>
    public static RcArgon2Parameters Current => new(
        RcPasswordParameters.MemoryKiB, RcPasswordParameters.Iterations,
        RcPasswordParameters.Parallelism, RcPasswordParameters.OutputBytes);
}

/// <summary>
/// Was vor der Anmeldung herausgeht: ein Salz — echt oder Schein — und die
/// Parameter, mit denen daraus zu rechnen ist.
/// </summary>
public sealed record RcSaltResponse(string PasswordSalt, RcArgon2Parameters Argon2);

/// <summary>Was nach dem Entsperren feststeht.</summary>
public sealed record RcSessionStartedResponse(
    string AccountId, string SessionId, DateTimeOffset ExpiresUtc, int CacheMode, int IdleMinutes);

/// <summary>
/// Das Anlegen liefert zusaetzlich, was dabei gegruendet wurde — den eigenen
/// Geltungsbereich und die persoenliche Rolle darin (BEFUND 40).
/// </summary>
public sealed record RcRegisteredResponse(
    string AccountId, string SessionId, DateTimeOffset ExpiresUtc, int CacheMode, int IdleMinutes,
    string TenantId, string PersonalRoleId);

/// <summary>
/// 3.9 — Wer bin ich, und liegt mein Schluesselbund bereit. Beides zusammen,
/// weil der Klient beides zusammen braucht, um zu entscheiden, was er anzeigt.
/// </summary>
public sealed record RcMeResponse(
    bool SignedIn, string? AccountId = null, string? SessionId = null, bool? KeysHeld = null);

public sealed record RcLockedResponse(bool Locked, bool HadKeys);

public sealed record RcLoggedOutResponse(bool LoggedOut);

/// <summary>
/// 3.9 — <c>forgottenBundles</c> ist kein Zierrat: beim Wechsel in den sicheren
/// Modus zeigt die Zahl, dass wirklich sofort vergessen wurde, was schon lag.
/// </summary>
public sealed record RcCacheModeResponse(int CacheMode, int ForgottenBundles);

public sealed record RcCsrfResponse(string Token);

/// <summary>
/// Die Parameter aus <c>RcPassword</c>, hier ohne Abhaengigkeit vom Kernel
/// wiederholt — <see cref="RcArgon2Parameters"/> ist ein Vertragstyp und soll
/// nicht davon abhaengen, was der Kernel gerade fuer richtig haelt.
/// </summary>
internal static class RcPasswordParameters
{
    public const int MemoryKiB = Rc.Kernel.RcPassword.MemoryKiB;
    public const int Iterations = Rc.Kernel.RcPassword.Iterations;
    public const int Parallelism = Rc.Kernel.RcPassword.Parallelism;
    public const int OutputBytes = Rc.Kernel.RcPassword.OutputBytes;
}
