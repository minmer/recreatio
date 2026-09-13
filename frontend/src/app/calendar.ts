/**
 * Der Kalender — die Browserseite.
 *
 * <b>Sichtbarkeit ist ein SCHLÜSSEL, kein Schalter.</b> Jeder Eintrag nennt
 * einen Bereich (`visibilityAreaId`); wer dessen Schlüssel hat — oder wessen
 * Epoche offenliegt —, sieht ihn. Wer nicht, bekommt die Zeile gar nicht.
 * „Öffentlich" ist deshalb kein eigener Zustand, sondern ein Bereich, dessen
 * Epochenschlüssel offenliegt.
 *
 * <b>Jedes verschlüsselte Feld nennt SEINEN eigenen Bereich.</b> Dieselbe Messe
 * kann ihre Zeit unter einem offengelegten Bereich tragen und ihre Notiz unter
 * dem der Kanzlei. Deshalb ist `fields` eine Liste und keine Handvoll Spalten.
 *
 * <b>Der Dienst öffnet nichts.</b> Was hier hinausgeht, ist schon versiegelt;
 * was hereinkommt, ist es noch. Geöffnet wird im Browser, mit den Schlüsseln
 * des Lesers — diese Datei transportiert nur.
 *
 * <b>Gerechnet wird am Dienst.</b> Welche Tage aus einer Reihe werden, steht in
 * `Calendar.Occurrences` und nicht hier: zwei Fassungen derselben Rechnung
 * ergeben irgendwann zwei Pläne, und der gedruckte wäre ein anderer als der
 * ausgehängte.
 */

import { call } from './session';

/** Die Arten, die ein Eintrag haben kann — wie `ck_item_kind`. */
export const ITEM_KINDS = ['appointment', 'task', 'mass', 'confession', 'visit'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_LABEL: Record<ItemKind, string> = {
  appointment: 'spotkanie',
  task: 'zadanie',
  mass: 'msza',
  confession: 'spowiedź',
  visit: 'odwiedziny'
};

export const REPEAT_KINDS = ['none', 'daily', 'weekly', 'monthly', 'yearly'] as const;
export type RepeatKind = (typeof REPEAT_KINDS)[number];

export const REPEAT_LABEL: Record<RepeatKind, string> = {
  none: 'raz',
  daily: 'codziennie',
  weekly: 'co tydzień',
  monthly: 'co miesiąc',
  yearly: 'co rok'
};

export type ItemStatus = 'planned' | 'confirmed' | 'cancelled';

/**
 * Ein versiegeltes Feld, wie es über die Leitung geht.
 *
 * `areaId` und `epoch` stehen DABEI, nicht irgendwo daneben: ohne sie wüsste
 * der Leser nicht, welchen Schlüssel er nehmen soll, und probierte alle durch —
 * oder, schlimmer, den falschen und hielte das Ergebnis für Text.
 */
export interface SealedField {
  readonly field: string;
  readonly areaId: string;
  readonly epoch: number;
  /** Base64URL. Nur der Browser bekommt das auf. */
  readonly sealed: string;
}

export interface Occurrence {
  readonly itemId: string;
  readonly ownerRoleId: string;
  readonly kind: ItemKind;

  /**
   * Der Name des Vorkommens in der Reihe — der URSPRÜNGLICHE Beginn.
   *
   * Daran hängen Ausnahmen und Intentionen. Er bleibt auch nach einer
   * Verschiebung stehen; nähme man `startsAt`, verlöre eine verlegte Messe
   * genau dann ihre Intentionen, wenn sie verlegt wird.
   */
  readonly occurrenceAt: string;

  readonly startsAt: string;
  readonly endsAt: string;
  readonly allDay: boolean;
  readonly status: ItemStatus;
  readonly titlePublic: string | null;
  readonly visibilityAreaId: string;
  readonly fields: readonly SealedField[];
}

export interface Days {
  readonly calendarId: string;
  readonly timeZone: string;
  readonly fromUtc: string;
  readonly toUtc: string;
  readonly occurrences: readonly Occurrence[];
}

export interface CalendarRow {
  readonly calendarId: string;
  readonly areaId: string;
  readonly title: string;
  readonly timeZone: string;
  readonly areaName: string;
}

/* -- Kalender -------------------------------------------------------------- */

export const createCalendar = (
  body: { areaId: string; title: string; timeZone?: string }
): Promise<CalendarRow> =>
  call<CalendarRow>('/workspace/calendar', { method: 'POST', body: JSON.stringify(body) });

export const loadCalendars = (): Promise<{ calendars: readonly CalendarRow[] }> =>
  call<{ calendars: readonly CalendarRow[] }>('/workspace/calendars');

/* -- Einträge -------------------------------------------------------------- */

export interface NewItem {
  readonly ownerRoleId: string;

  /**
   * Der Bereich, dessen Schlüssel über das DASEIN des Eintrags entscheidet.
   *
   * Man muss in ihm schreiben dürfen — sonst legte man einen Eintrag unter
   * einen fremden Schlüssel und entzöge ihn damit sich selbst.
   */
  readonly visibilityAreaId: string;

  readonly kind?: ItemKind;

  /** Ortszeit — „2026-10-04". */
  readonly date: string;
  /** Ortszeit — „18:00". Bei `allDay` ohne Bedeutung. */
  readonly time: string;

  readonly minutes?: number;
  readonly allDay?: boolean;

  /** Was im Schaukasten steht. Offen, absichtlich — siehe `fields` für das andere. */
  readonly titlePublic?: string;
  readonly status?: ItemStatus;

  readonly repeat?: RepeatKind;
  readonly every?: number;
  /** Bitmaske; pn=1 … nd=64. */
  readonly weekdays?: number;
  /** Bei einer Reihe Pflicht, wenn `count` fehlt — sie muss ein Ende haben. */
  readonly until?: string;
  readonly count?: number;

  /** Schon versiegelt. Der Dienst legt sie ab, ohne sie zu lesen. */
  readonly fields?: readonly SealedField[];
}

export interface AddedItem {
  readonly itemId: string;
  readonly calendarId: string;
  readonly kind: ItemKind;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly visibilityAreaId: string;
  readonly timeZone: string;
  readonly fields: number;
}

export const addItem = (calendarId: string, body: NewItem): Promise<AddedItem> =>
  call<AddedItem>(`/workspace/calendar/${encodeURIComponent(calendarId)}/item`, {
    method: 'POST',
    body: JSON.stringify(body)
  });

const window_ = (from?: Date, to?: Date): string => {
  const query = new URLSearchParams();
  if (from !== undefined) query.set('from', from.toISOString());
  if (to !== undefined) query.set('to', to.toISOString());
  return query.toString();
};

export const loadItems = (
  calendarId: string, from?: Date, to?: Date, kind?: ItemKind
): Promise<Days> => {
  const query = new URLSearchParams(window_(from, to));
  if (kind !== undefined) query.set('kind', kind);

  return call<Days>(`/workspace/calendar/${encodeURIComponent(calendarId)}/items?${query}`);
};

/** Ohne Konto: nur was unter einem offengelegten Bereich liegt. */
export const loadPublic = (
  calendarId: string, from?: Date, to?: Date, kind?: ItemKind
): Promise<Days> => {
  const query = new URLSearchParams(window_(from, to));
  if (kind !== undefined) query.set('kind', kind);

  return call<Days>(`/calendar/${encodeURIComponent(calendarId)}/public?${query}`);
};

/* -- Ein einzelnes Vorkommen ----------------------------------------------- */

/**
 * Ein Vorkommen absagen oder verschieben.
 *
 * Angesprochen über `originalStart` — den Namen des Vorkommens in der Reihe,
 * nicht seinen (womöglich schon verschobenen) Beginn. Ein zweiter Aufruf zu
 * demselben Vorkommen ersetzt den ersten.
 */
export const setOccurrence = (
  itemId: string,
  originalStart: string,
  body: { cancelled?: boolean; movedTo?: string }
): Promise<{ itemId: string; originalStart: string; cancelled: boolean; movedTo: string | null }> =>
  call(`/workspace/item/${encodeURIComponent(itemId)}/occurrence`, {
    method: 'POST',
    body: JSON.stringify({ originalStart, ...body })
  });
