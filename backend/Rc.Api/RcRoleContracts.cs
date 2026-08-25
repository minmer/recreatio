namespace Rc.Api;

/// <summary>
/// 15.6 — Die Antwortformen der Rollenschicht, mit Namen.
///
/// Siehe <see cref="RcAuthContracts"/> fuer den Grund: ein anonymes Objekt hat
/// keinen Namen, unter dem es in einer Beschreibung stehen koennte, und ist
/// fuer einen erzeugten Klienten deshalb unsichtbar.
/// </summary>
public sealed record RcRolesResponse(IReadOnlyList<RcRoles.RoleView> Roles);

public sealed record RcRoleCreatedResponse(string RoleId, string TenantId, string Kind, string Fingerprint);

/// <summary>
/// <c>alreadyHeld</c> ist kein Fehler: dieselbe Rolle zweimal demselben Halter
/// zu geben ist ein Wunsch, der bereits erfuellt ist. Deshalb 200 mit einem
/// Hinweis und nicht 409 mit einem Vorwurf.
/// </summary>
public sealed record RcHolderAddedResponse(
    string? EdgeId, string? EdgeKind = null, DateTimeOffset? ExpiresUtc = null, bool AlreadyHeld = false);

public sealed record RcCertificateIssuedResponse(
    string CertificateId, DateTimeOffset ExpiresUtc, string Capability);

public sealed record RcCertificatesResponse(IReadOnlyList<RcRoles.CertificateView> Certificates);

public sealed record RcRevokedResponse(bool Revoked);

/// <summary>
/// 3.5 — <c>via</c> und <c>certificateId</c> sind der Grund, warum etwas
/// erlaubt ist. Eine Berechtigung, die sich nicht erklaeren laesst, laesst sich
/// auch nicht zurechtruecken — und irgendwann fragt jemand, warum er etwas
/// sieht.
/// </summary>
public sealed record RcPermissionCheckResponse(bool Allowed, string? Via, string? CertificateId);

// -- Einladungen (3.12) -------------------------------------------------------

public sealed record RcInvitationCreatedResponse(
    string InvitationId, string Secret, DateTimeOffset ExpiresUtc, string Purpose, int? MaxUses);

/// <summary>
/// Was der Link ueber sich verraet, BEVOR jemand ihn einloest. Der Anzeigename
/// des Ziels steht ausdruecklich nicht darin: ihn zu zeigen hiesse, den
/// Rollenschluessel zu benutzen, und der gehoert erst dem, der einloest.
/// </summary>
public sealed record RcInvitationPeekResponse(
    string? Label, string Purpose, DateTimeOffset ExpiresUtc, bool RequiresAccount);

public sealed record RcInvitationRedeemedResponse(string RoleId, string? EdgeId, bool AlreadyRedeemed);

public sealed record RcInvitationsResponse(IReadOnlyList<RcInvitations.InvitationView> Invitations);
