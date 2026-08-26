namespace Rc.Api;

/* ---------------------------------------------------------------------------
   Antworten des Kalenders.
   --------------------------------------------------------------------------- */

public sealed record RcCalendarCreatedResponse(string CalendarId, string Title);

public sealed record RcCalendarsResponse(IReadOnlyList<RcCalendar.CalendarSummary> Calendars);

public sealed record RcCalendarItemCreatedResponse(string ItemId, string ItemType, string RepeatKind);

/// <summary>
/// Die Vorkommen in einem Zeitraum — AUSGERECHNET, nicht die Regeln.
///
/// Der Zeitraum steht mit in der Antwort, weil die Liste sonst nichts ueber
/// ihre eigenen Grenzen sagt: eine Wiederholung ohne Ende gibt es nicht, aber
/// eine mit einem Ende weit hinter dem Fenster schon. Ohne <c>fromUtc</c> und
/// <c>toUtc</c> haelt die Oberflaeche das Fenster fuer die Reihe.
///
/// <c>timeZone</c> gehoert dazu, weil darin gerechnet wurde. Wer die Liste in
/// einer anderen Zone anzeigt, bekommt andere Tagesgrenzen — und muss wissen,
/// dass das seine Entscheidung ist und nicht die des Dienstes.
/// </summary>
public sealed record RcCalendarItemsResponse(
    string CalendarId, string TimeZone,
    DateTimeOffset FromUtc, DateTimeOffset ToUtc,
    IReadOnlyList<RcCalendar.OccurrenceView> Occurrences);

public sealed record RcOccurrenceChangedResponse(
    string ItemId, DateTimeOffset OccurrenceUtc, string Kind);
