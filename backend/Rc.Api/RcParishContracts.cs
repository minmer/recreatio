namespace Rc.Api;

/* ---------------------------------------------------------------------------
   Antworten des Pfarrei-Moduls.
   --------------------------------------------------------------------------- */

public sealed record RcParishCreatedResponse(string ParishId, string Slug, string Name);

public sealed record RcParishesResponse(IReadOnlyList<RcParish.ParishSummary> Parishes);

public sealed record RcMassCreatedResponse(string MassId, DateTimeOffset StartsUtc, string Church);

/// <summary>
/// Der Plan, wie er am Schaukasten haengt. Ohne Konto abrufbar — dafuer ist er
/// da. Zu jeder Messe stehen die OEFFENTLICHEN Texte der Intentionen; was
/// intern dazu vermerkt ist, kommt hier nicht vor.
/// </summary>
public sealed record RcMassesResponse(string ParishId, IReadOnlyList<RcParish.MassView> Masses);

public sealed record RcIntentionCreatedResponse(string IntentionId, string PublicText);

public sealed record RcIntentionsResponse(IReadOnlyList<RcParish.IntentionView> Intentions);

public sealed record RcOfferingCreatedResponse(string OfferingId, string Currency);
