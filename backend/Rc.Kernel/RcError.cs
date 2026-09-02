namespace Rc.Kernel;

/// <summary>
/// 15.7 — Einheitliches Fehlerformat.
///
/// Im Altbestand antwortete jedes Modul anders. Bei einem <em>erzeugten</em>
/// Klienten (15.6) muss das Format vor der Erzeugung feststehen, sonst ist es
/// nachtraeglich nicht mehr zu vereinheitlichen.
///
/// Die vier Felder sind abschliessend. Es gibt bewusst kein freies
/// Zusatzfeld — sonst landet dort mit der Zeit alles, was gerade nuetzlich
/// schien, einschliesslich Dingen, die 15.7 ausdruecklich verbietet.
/// </summary>
public sealed record RcError
{
    /// <summary>
    /// Maschinenlesbar, stabil ueber Versionen, hierarchisch als
    /// <c>&lt;bereich&gt;.&lt;fall&gt;</c>. Ein Klient darf auf <c>chat.</c>
    /// pruefen, ohne jeden Einzelfall zu kennen.
    /// </summary>
    public required string Code { get; init; }

    /// <summary>
    /// Ein Satz fuer den Menschen. Der Klient entscheidet NIEMALS anhand dieses
    /// Textes — er darf sich jederzeit aendern, und er kommt uebersetzt aus dem
    /// Klienten, nicht aus dem Server (15.7, M04).
    /// </summary>
    public required string Message { get; init; }

    /// <summary>
    /// Dieselbe Nummer, die im Serverprotokoll steht. Ein Nutzer kann sie
    /// melden, ohne dass jemand Inhalte nachschlagen muss.
    /// </summary>
    public required string TraceId { get; init; }

    /// <summary>Feldbezogen bei Eingabefehlern. Sonst leer.</summary>
    public IReadOnlyDictionary<string, string>? Details { get; init; }

    /// <summary>
    /// 15.7 — Eine Fehlerantwort enthaelt NIEMALS Geheimtext, Schluesselmaterial,
    /// AAD-Bestandteile oder entschluesselte Inhalte. Auch nicht in
    /// <see cref="Details"/>, auch nicht in der Entwicklungsumgebung.
    ///
    /// Diese Pruefung ist absichtlich grob und laeuft in den Tests, nicht im
    /// heissen Pfad: Sie soll den Entwicklungsfehler fangen, nicht einen
    /// Angreifer aufhalten.
    /// </summary>
    public bool LooksSafe()
    {
        static bool Suspect(string? s) =>
            s is not null &&
            (s.Contains("BEGIN ", StringComparison.Ordinal)
             || s.Contains("masterkey", StringComparison.OrdinalIgnoreCase)
             || LooksLikeLongHex(s));

        if (Suspect(Message)) return false;
        if (Details is null) return true;
        return !Details.Values.Any(Suspect) && !Details.Keys.Any(Suspect);
    }

    private static bool LooksLikeLongHex(string s)
    {
        var run = 0;
        foreach (var c in s)
        {
            var isHex = c is >= '0' and <= '9' or >= 'a' and <= 'f' or >= 'A' and <= 'F';
            run = isHex ? run + 1 : 0;
            if (run >= 48) return true;   // 24 Byte am Stueck sind kein Bezeichner mehr
        }
        return false;
    }

    public static RcError Create(string code, string message, string traceId,
        IReadOnlyDictionary<string, string>? details = null)
    {
        if (!code.Contains('.'))
            throw new ArgumentException($"Fehlerkennung '{code}' ist nicht hierarchisch (15.7).", nameof(code));

        return new RcError { Code = code, Message = message, TraceId = traceId, Details = details };
    }
}

/// <summary>
/// Die Kennungen des Kernels. Module bringen eigene mit, nach demselben Muster.
/// Sie stehen hier beisammen, damit ein Klient sie nachschlagen kann, ohne den
/// Serverquelltext zu lesen.
/// </summary>
public static class RcErrorCodes
{
    // Kryptografie — die vier unterscheidbaren Ursachen aus 15.9.
    public const string CryptoMissingEpoch = "crypto.missing_epoch";
    public const string CryptoMissingKey = "crypto.missing_key";
    public const string CryptoAadMismatch = "crypto.aad_mismatch";
    public const string CryptoMalformed = "crypto.malformed";

    // Kette
    public const string ChainSequenceConflict = "chain.sequence_conflict";
    public const string ChainAppendOnly = "chain.append_only";

    // Kennungen
    public const string IdDuplicate = "id.duplicate";
    public const string IdMalformed = "id.malformed";

    // Sitzung und Entsperren (3.9)
    public const string SessionRevoked = "session.revoked";
    public const string SessionUnlockRequired = "session.unlock_required";
    public const string SessionExpired = "session.expired";

    // Zugang
    public const string AuthCsrfMissing = "auth.csrf_missing";
    public const string AuthTokenInvalid = "auth.token_invalid";

    /// <summary>
    /// EIN Code fuer "Benutzer unbekannt" UND "Passwort falsch". Zwei
    /// unterscheidbare Codes waeren eine Auskunft darueber, welche Namen
    /// vergeben sind — und damit die halbe Arbeit eines Angreifers geschenkt.
    /// </summary>
    public const string AuthCredentialsInvalid = "auth.credentials_invalid";

    /// <summary>Nur beim Anlegen. Dort ist die Auskunft unvermeidlich.</summary>
    public const string AuthUsernameTaken = "auth.username_taken";

    public const string AuthAccountDisabled = "auth.account_disabled";
    public const string AuthRateLimited = "auth.rate_limited";
    public const string AuthPasswordWeak = "auth.password_weak";

    // Berechtigung (3.5)
    public const string PermissionDenied = "permission.denied";
    public const string PermissionCertificateExpired = "permission.certificate_expired";

    // Rollen (3.1 / 3.14)
    /// <summary>
    /// 3.14 — Eigener Code, weil der Mensch davor etwas Sinnvolles gewollt hat
    /// und erfahren muss, warum es nicht geht. Ein allgemeines "ungueltig"
    /// waere hier besonders unfreundlich.
    /// </summary>
    public const string RoleCycle = "role.cycle";
    public const string RoleNotFound = "role.not_found";
    public const string RoleUnreachable = "role.unreachable";
    public const string RoleRevoked = "role.revoked";

    // Pfarrei
    /// <summary>
    /// Der Name in der Adresse ist nicht vorgesehen.
    ///
    /// Eigener Code und nicht das allgemeine "verboten": der Mensch davor hat
    /// nichts Unerlaubtes versucht, sondern einen Namen benutzt, ueber den
    /// noch niemand entschieden hat. Das ist eine andere Auskunft, und sie
    /// gehoert auch anders formuliert.
    ///
    /// Die erlaubten Namen stehen in den Einzelheiten der Antwort — wer eine
    /// Pfarrei anlegen darf, darf auch wissen, welche vorgesehen sind.
    /// </summary>
    public const string ParishSlugNotAllowed = "parish.slug_not_allowed";

    // Ablage
    public const string StorageQuotaExceeded = "storage.quota_exceeded";
    public const string StorageFileTooLarge = "storage.file_too_large";

    // Klient
    public const string ClientTooOld = "client.too_old";
}
