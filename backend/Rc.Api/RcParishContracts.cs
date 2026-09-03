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

/// <summary>
/// Was die Pfarrei auf ihrer Startseite zeigt.
///
/// Ohne Konto abrufbar, wie der Messplan: es ist die oeffentliche Seite, die
/// hier beschrieben wird. <c>Modules</c> ist die JSON-Liste der Bausteine in
/// ihrer Reihenfolge — der Server reicht sie durch und deutet sie nicht.
///
/// <c>Configured</c> unterscheidet „noch nicht eingerichtet" von „mit den
/// Vorgaben eingerichtet". Ohne diesen Unterschied saehe eine Pfarrei, die
/// gerade erst entstanden ist, genauso aus wie eine, die sich bewusst fuer die
/// Vorgaben entschieden hat — und der zweite Schritt des Anlegens haette kein
/// Merkmal, an dem er erkennen koennte, dass er noch aussteht.
/// </summary>
public sealed record RcParishSiteResponse(string ParishId, string Theme, string Modules, bool Configured);
