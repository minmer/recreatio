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

import { newId } from './ids';
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

  /** 0070 — Teil welches Termins, an welcher Stelle (der Aushang zeigt Teile unter ihrem Ganzen). */
  readonly parentItemId?: string | null;
  readonly position?: number | null;
}

export interface Days {
  readonly calendarId: string;
  /** 0058 — wie der Kalender heisst und wie seine Termine gemeint sind. */
  readonly title?: string | null;
  readonly description?: string | null;
  readonly itemKind?: string | null;
  readonly timeZone: string;
  readonly fromUtc: string;
  readonly toUtc: string;
  readonly occurrences: readonly Occurrence[];
}

/**
 * RESERVIEREN AN EINEM KALENDER (0058).
 *
 * <code>
 *   all      jeder Termin ist ein Angebot (ein einzelner kann „nein" sagen)
 *   marked   nur Termine, die es sagen
 * </code>
 *
 * Keine Regeln (`booking: null`): niemand reserviert.
 */
export interface CalendarBooking {
  readonly resourceId: string;
  readonly mode: 'all' | 'marked';
  readonly capacity: number;
  readonly approval: 'none' | 'office';
  /** Nur Leute aus dieser Gruppe (und den Gruppen darunter) — `null`: jeder, der den Termin findet. */
  readonly reserveAreaId: string | null;
  readonly perPerson: number;
}

export type CalendarKind = 'appointment' | 'mass' | 'confession' | 'visit';

export const CALENDAR_KIND_LABEL: Record<CalendarKind, string> = {
  appointment: 'spotkania',
  mass: 'msze',
  confession: 'spowiedzi',
  visit: 'odwiedziny'
};

export interface CalendarRow {
  readonly calendarId: string;
  readonly areaId: string;
  readonly title: string;
  readonly timeZone: string;
  readonly areaName: string;

  /* 0058 — wie die Termine dieses Kalenders funktionieren. Ältere Dienste nennen sie nicht. */
  readonly description?: string | null;
  readonly itemKind?: CalendarKind;
  /** Wer sie sieht — `null`: wer den Bereich des Kalenders hat. */
  readonly visibilityAreaId?: string | null;
  readonly visibilityAreaName?: string | null;
  readonly durationMinutes?: number;
  readonly isDefault?: boolean;
  readonly archived?: boolean;
  /** Schreibe ich darin — trage ein, ändere, stelle die Regeln? */
  readonly mayWrite?: boolean;
  readonly booking?: CalendarBooking | null;
}

/** Die Regeln, mit denen ein Kalender angelegt oder geändert wird. */
export interface CalendarRules {
  readonly title?: string;
  readonly description?: string;
  readonly itemKind?: CalendarKind;
  /** "" = wer den Bereich hat. */
  readonly visibilityAreaId?: string;
  readonly durationMinutes?: number;
  readonly booking?: {
    readonly mode: 'none' | 'all' | 'marked';
    readonly capacity?: number;
    readonly approval?: 'none' | 'office';
    /** "" = jeder, der den Termin findet. */
    readonly reserveAreaId?: string;
    readonly perPerson?: number;
  };
  readonly archived?: boolean;
}

/* -- Kalender -------------------------------------------------------------- */

/** Der Terminarz eines Bereichs — der vorhandene (Standard), sonst jetzt angelegt (0054). */
export const createCalendar = (
  body: { areaId: string; title: string; timeZone?: string }
): Promise<CalendarRow> =>
  call<CalendarRow>('/workspace/calendar', { method: 'POST', body: JSON.stringify(body) });

/** 0058 — einen WEITEREN Kalender anlegen, mit seinen Regeln. */
export const addCalendar = (
  areaId: string, title: string, rules: CalendarRules
): Promise<{ calendarId: string }> =>
  call('/workspace/calendar', {
    method: 'POST',
    body: JSON.stringify({ areaId, title, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, create: true, ...rules })
  });

/** 0058 — die Regeln eines Kalenders ändern (nur, was genannt ist). */
export const saveCalendarRules = (calendarId: string, rules: CalendarRules): Promise<{ saved: boolean }> =>
  call(`/workspace/calendar/${encodeURIComponent(calendarId)}/settings`, { method: 'POST', body: JSON.stringify(rules) });

/** 0058 — wer bei einem Termin da sein muss: für die Reihe (ohne `occurrenceAt`) oder ein Vorkommen. */
export type Duty = 'present' | 'celebrant' | 'lead';

export const DUTY_LABEL: Record<Duty, string> = { present: 'obecny', celebrant: 'celebrans', lead: 'prowadzi' };

export const setPeople = (
  itemId: string, people: readonly { roleId: string; duty: Duty }[], occurrenceAt?: string
): Promise<{ people: number }> =>
  call(`/workspace/item/${encodeURIComponent(itemId)}/people`, {
    method: 'POST', body: JSON.stringify({ occurrenceAt: occurrenceAt ?? null, people })
  });

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

/**
 * Einen Eintrag anlegen.
 *
 * <b>Die Kennung entsteht HIER</b>, nicht am Dienst — wie beim Bereich und beim
 * Platz. Sie muss es: die AAD eines versiegelten Feldes nennt den Eintrag, und
 * versiegelt wird, bevor der Dienst antwortet. Münzte er die Kennung, nennte
 * jede Hülle eine andere als die, unter der sie liegt.
 *
 * Wer die Kennung selbst mitbringt (weil er vorher damit versiegelt hat), gibt
 * sie in `itemId` an; sonst entsteht sie hier.
 */
export const addItem = (
  calendarId: string, body: NewItem & { readonly itemId?: string }
): Promise<AddedItem> =>
  call<AddedItem>(`/workspace/calendar/${encodeURIComponent(calendarId)}/item`, {
    method: 'POST',
    body: JSON.stringify({ ...body, itemId: body.itemId ?? newId() })
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

/**
 * Ohne Konto: was unter einem offengelegten Bereich liegt — und, mit `seat`,
 * was der Platz dieses Menschen aufschliesst.
 *
 * Das Token sagt dem Dienst nur, WELCHE Bereiche er herausgeben darf. Der
 * Schlüssel bleibt hier; was zurückkommt, ist versiegelt wie immer.
 */
export const loadPublic = (
  calendarId: string, from?: Date, to?: Date, kind?: ItemKind, seat?: string
): Promise<Days> => {
  const query = new URLSearchParams(window_(from, to));
  if (kind !== undefined) query.set('kind', kind);
  if (seat !== undefined && seat !== '') query.set('seat', seat);

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
