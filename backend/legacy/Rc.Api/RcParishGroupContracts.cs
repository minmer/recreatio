namespace Rc.Api;

/// <summary>
/// Die Antworten des Gruppenmoduls (rc_0035).
///
/// <b>Warum sie in einer eigenen Datei stehen</b> — wie bei allen Modulen: der
/// erzeugte Klient (15.6) liest sie, und was er liest, muss sich lesen lassen,
/// ohne den Dienst danebenzulegen.
/// </summary>
public sealed record RcParishGroupCreatedResponse(string GroupId, string Slug, string Name);

/// <summary>
/// Eine Gruppe, wie sie in einer Liste steht.
///
/// <b>Was hier NICHT drinsteht: der Inhalt.</b> Keine Nachricht, kein Termin,
/// keine interne Notiz. Eine Liste von zwanzig Gruppen wuerde sonst zwanzig
/// Bereiche aufschliessen, um zwanzig Zeilen zu zeigen.
/// </summary>
/// <param name="Mine">
/// Ob der Fragende zu dieser Gruppe gehoert.
///
/// Das ist die Auskunft, nach der die Oberflaeche die Liste teilt („moje
/// wspolnoty" und „inne"). Sie aus dem Vorhandensein eines Schluessels zu
/// raten ginge auch — aber falsch: ein Pfarrverwalter kann jede Gruppe
/// oeffnen und gehoert zu keiner.
/// </param>
/// <param name="MayAdmin">
/// Ob er sie verwalten darf. Steht hier, damit die Oberflaeche den
/// Bearbeitungsschalter nicht raten muss (siehe <c>rcParishRights.ts</c>): ein
/// Schalter, der erscheint, weil jemand vermutet, fuehrt zu einem Klick und
/// einer Fehlermeldung.
/// </param>
public sealed record RcParishGroupView(
    string GroupId, string Slug, string Name,
    string? Summary, string? Meets, bool IsPublic, string Lifecycle,
    string AreaId, string CalendarId, string MemberRoleId, string LeaderRoleId,
    int Members, bool Mine, bool MayAdmin, bool Leading);

public sealed record RcParishGroupsResponse(string ParishId, IReadOnlyList<RcParishGroupView> Groups);

/// <summary>
/// Eine einzelne Gruppe — mit dem, was nur Mitglieder angeht.
/// </summary>
/// <param name="Note">
/// Die interne Notiz, geoeffnet. <c>null</c> heisst „keine", nicht „darf
/// nicht" — dafuer steht <paramref name="NoteUnreadable"/> daneben.
/// </param>
/// <param name="NoteUnreadable">
/// Warum sie zu blieb, als Code aus 15.9. Die Unterscheidung ist keine
/// Feinheit: „hier steht nichts" und „hier steht etwas, das du nicht
/// aufbekommst" verlangen verschiedene Antworten, und wer sie verwechselt,
/// schreibt die Notiz eines anderen einfach neu.
/// </param>
/// <param name="LeaderRoleId">
/// Das Amt, das diese Gruppe fuehrt (rc_0037). Es steht hier, weil der
/// Uebergabelink daran haengt — ein geratenes Amt vergibt Schluessel an der
/// Gruppe vorbei.
/// </param>
/// <param name="Leading">
/// Ob der Fragende dieses Amt HAELT.
///
/// Nicht dasselbe wie <c>MayAdmin</c>: der Pfarrverwalter darf die Gruppe
/// verwalten, ohne sie zu fuehren. Die Oberflaeche braucht beides — „du
/// fuehrst das hier" ist eine andere Auskunft als „du darfst hier etwas
/// aendern", und wer sie zusammenwirft, schreibt einer Pfarrkanzlei
/// zwanzig Gruppen ins eigene Verzeichnis.
/// </param>
public sealed record RcParishGroupResponse(
    string GroupId, string ParishId, string ParishSlug, string Slug, string Name,
    string? Summary, string? Meets, bool IsPublic, string Lifecycle,
    string AreaId, string CalendarId, string MemberRoleId, string LeaderRoleId,
    int Members, bool Mine, bool MayAdmin, bool Leading,
    string? Note, string? NoteUnreadable);

public sealed record RcParishGroupSavedResponse(string GroupId, string Slug, string Name);

/// <summary>
/// Was ohne Konto sichtbar ist: der Aushang.
///
/// Name, Anriss und „wann wir uns treffen" — mehr nicht. Genau das, was auf
/// einem Zettel im Schaukasten stuende, und aus demselben Grund im Klartext:
/// es ist fuer jemanden gedacht, der noch nicht dazugehoert.
/// </summary>
public sealed record RcPublicParishGroupView(string Slug, string Name, string? Summary, string? Meets);

public sealed record RcPublicParishGroupsResponse(
    string ParishSlug, IReadOnlyList<RcPublicParishGroupView> Groups);
