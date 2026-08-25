namespace Rc.Api;

/// <summary>
/// 15.6 — Die Antwortformen von Kapitel 12 und der Wiederherstellung, mit Namen.
///
/// Siehe <see cref="RcAuthContracts"/> fuer den Grund.
/// </summary>
public sealed record RcDataItemCreatedResponse(
    string DataItemId, string DataClass, bool Logged, bool Shareable);

/// <summary>
/// <c>logged</c> steht in der Antwort, damit der Klient es ANZEIGEN kann. Wer
/// eine besondere Kategorie liest, soll im selben Moment sehen, dass es
/// vermerkt wurde — nicht erst, wenn ihn jemand darauf anspricht.
/// </summary>
public sealed record RcDataItemResponse(
    string DataItemId, string DataClass, string Field, string Value, bool Logged);

public sealed record RcDataItemsResponse(IReadOnlyList<RcDataItems.DataItemView> Items);

public sealed record RcDataSharedResponse(string DataItemId, string? ToRoleId, bool AlreadyShared = false);

/// <summary>
/// 12.3.2 — <c>ciphertextRemains</c> ist kein Eingestaendnis, sondern die
/// Zusage: der Geheimtext bleibt liegen, weil er ohne Schluessel nichts ist,
/// und seine Zeile belegt, DASS hier etwas war und wann es vernichtet wurde.
/// Eine geloeschte Zeile koennte das nicht.
/// </summary>
public sealed record RcDataDestroyedResponse(
    string DataItemId, DateTimeOffset DestroyedAt, int KeysDestroyed = 0,
    string? Reason = null, bool CiphertextRemains = true, bool AlreadyDestroyed = false);

public sealed record RcAccessLogResponse(IReadOnlyList<RcDataItems.AccessEntry> Accesses);

// -- Einwilligungen (12.10) ---------------------------------------------------

public sealed record RcConsentPublishedResponse(
    string ConsentKey, string Language, int Version, string BodyHash);

public sealed record RcConsentVersion(
    string Language, int Version, string BodyHash, DateTimeOffset PublishedAt);

public sealed record RcConsentVersionsResponse(string ConsentKey, IReadOnlyList<RcConsentVersion> Versions);

// -- Wiederherstellung (Kapitel 8) --------------------------------------------

/// <summary>
/// 8.3 — <c>notice</c> gehoert in die Antwort und nicht in den Klienten: der
/// Hinweistext muss BEIDE Enden der Karenzzeit nennen, und ein Text, den der
/// Klient selbst formuliert, nennt frueher oder spaeter nur das angenehme.
/// </summary>
public sealed record RcSharesDepositedResponse(
    int Guarantors, int Threshold, int GraceDays, string Notice);

public sealed record RcSharesResponse(IReadOnlyList<RcRecovery.ShareView> Shares);

public sealed record RcRecoveryRequestedResponse(
    string RequestId, DateTimeOffset EffectiveAt, int GraceDays, string Notice);

public sealed record RcRecoveryRequestsResponse(IReadOnlyList<RcRecovery.RequestView> Requests);

public sealed record RcObjectionResponse(string RequestId, bool Objected);

public sealed record RcContributionResponse(
    string RequestId, int Contributions = 0, int Threshold = 0,
    bool Enough = false, bool AlreadyContributed = false);

/// <summary>
/// <c>oneTimeSecret</c> geht genau einmal heraus und steht danach nirgends
/// mehr. <c>notice</c> sagt das, denn wer es fuer wiederholbar haelt, schliesst
/// das Fenster und braucht einen neuen Antrag.
/// </summary>
public sealed record RcRecoveryCompletedResponse(
    string RequestId, DateTimeOffset CompletedAt, string OneTimeSecret, string Notice);
