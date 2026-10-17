/**
 * DER EIGENE KALENDER (0054) — die Browserseite.
 *
 * <b>Ein Termin gehört Leuten, nicht einem Kalender.</b> Wer einträgt, wählt,
 * WER ihn sieht: sich allein („Tylko ja" — der eigene Bereich, beim ersten Mal
 * hier angelegt) oder einen Bereich, in dem er schreibt. Der Terminarz dieses
 * Bereichs entsteht am Dienst von selbst.
 *
 * <b>Titel, Ort und Notiz liegen versiegelt</b> unter dem Schlüssel dieses
 * Bereichs — auch ein privater Titel steht nirgends offen, und der Dienst
 * sieht von einem privaten Termin nur, dass um 18 Uhr etwas ist.
 *
 * Was ich sehe: jeder Termin meiner Bereiche (auch die Messen, wenn ich einen
 * solchen Bereich halte), meine Buchungen, und — aus `tasks.ts` — meine
 * Aufgaben.
 */

import { createArea, loadAreas, type AreaRow } from './area';
import { emptyTexts, itemFieldAad, putText, setOccurrence, type ItemField, type ItemKind, type ItemTexts, type SealedField } from './calendar';
import { areaKeys, newestKey } from './chat';
import { fromBase64Url, openText, sealText, toBase64Url } from './crypto';
import { newId } from './ids';
import type { Ring, SealedRole } from './keys';
import { call, WorkspaceError } from './session';

export interface Series {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly repeatKind: RepeatKind;
  readonly repeatEvery: number;
  readonly repeatWeekdays: number | null;
  readonly repeatUntil: string | null;
  readonly repeatCount: number | null;
  readonly timeZone: string;
}

export type RepeatKind = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface AgendaOccurrence {
  readonly itemId: string;
  readonly calendarId: string;
  /** Der Bereich des Terminarzes. */
  readonly areaId: string;
  readonly ownerRoleId: string;
  readonly kind: string;
  readonly occurrenceAt: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly allDay: boolean;
  readonly status: string;
  readonly titlePublic: string | null;
  readonly visibilityAreaId: string;
  readonly moved: boolean;
  readonly series: Series;
  readonly fields: readonly SealedField[];

  /* 0058 — was dieser Termin fürs Reservieren für sich sagt (`null`: wie der Kalender). */
  readonly bookable?: boolean | null;
  readonly capacity?: number | null;
  readonly reserveAreaId?: string | null;

  /* 0058 — wer da sein muss (für dieses Vorkommen), und ob ich es bin. */
  readonly people?: readonly { readonly roleId: string; readonly duty: 'present' | 'celebrant' | 'lead' }[];
  readonly mine?: boolean;

  /* 0070 — Teil welches Termins, an welcher Stelle; aus welcher Rozmowa / welchem Thema. */
  readonly parentItemId?: string | null;
  readonly position?: number | null;
  readonly chatId?: string | null;
  readonly topicId?: string | null;

  /** 0079 — an einer Messe: wie viele Intentionen (angenommen oder gefeiert). Sonst fehlt es. */
  readonly intentions?: number | null;
}

export interface AgendaClaim {
  readonly claimId: string;
  readonly resourceId: string;
  readonly resourceName: string;
  readonly areaId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: string;
  readonly roleId: string;
}

export const loadAgenda = (from: Date, to: Date): Promise<{ occurrences: readonly AgendaOccurrence[]; claims: readonly AgendaClaim[] }> =>
  call(`/workspace/agenda?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);

/* -- Geöffnet ------------------------------------------------------------------- */

/**
 * Was man hier ändern darf — 0079: alles, auch Messe, Beichte und Nabożeństwo.
 * Vorher verwies der Kalender bei Messen auf „Msze i intencje", und dort gab
 * es kein Ändern. Die Intentionen gehen jetzt mit (der Dienst ordnet sie dem
 * Tag zu und sagt es, wenn einer die Messe fehlen würde).
 */
export const OWN_KINDS: readonly string[] = ['appointment', 'visit', 'task', 'mass', 'confession', 'devotion'];

/**
 * DER GOTTESDIENST — Messe, Beichte, Nabożeństwo. Er steht im Messplan, und sein
 * Name hängt im Schaukasten: er bleibt OFFEN (`title_public`), statt
 * versiegelt zu werden wie der Titel eines Treffens.
 */
export const LITURGY: readonly string[] = ['mass', 'confession', 'devotion'];
export const isLiturgy = (kind: string | undefined | null): boolean => kind != null && LITURGY.includes(kind);

const KIND_WORD: Record<string, string> = {
  appointment: 'Termin', task: 'Zadanie', mass: 'Msza', confession: 'Spowiedź', visit: 'Odwiedziny', devotion: 'Nabożeństwo'
};

/** Wie ein Eintrag ohne eigenen Namen heisst: „Msza", „Nabożeństwo". */
export const kindWord = (kind: string): string => KIND_WORD[kind] ?? 'Termin';

export interface OpenedItem {
  readonly occurrence: AgendaOccurrence;
  readonly title: string;
  readonly location: string | null;
  readonly notes: string | null;
  /** 0073 — der Link zu weiteren Informationen und das Wort auf seinem Knopf. */
  readonly link: string | null;
  readonly linkLabel: string | null;

  /** Darf ich die Reihe ändern? Eigene Art, und Schreibrecht im Bereich des Terminarzes. */
  readonly editable: boolean;

  /** Hat er einen eigenen Titel — oder steht da nur die Art („Termin")? Ein angebotener Termin heisst dann wie sein Ding. */
  readonly named: boolean;
}

const fieldAad = itemFieldAad;

/**
 * Die Termine aufmachen — jedes Feld mit dem Schlüssel SEINES Bereichs.
 * Was nicht aufgeht, bleibt leer; der Titel fällt dann auf den offenen oder
 * auf die Art zurück („Msza"), damit nichts als leerer Kasten dasteht.
 */
export async function openAgenda(
  ring: Ring, occurrences: readonly AgendaOccurrence[], areas: readonly AreaRow[]
): Promise<OpenedItem[]> {
  const byArea = new Map(areas.map((a) => [a.areaId, a]));
  const opened = new Map<string, ItemTexts>();

  for (const one of occurrences) {
    if (opened.has(one.itemId)) continue;
    const found = emptyTexts();

    for (const field of one.fields) {
      try {
        const key = (await areaKeys(ring, field.areaId)).get(field.epoch);
        if (key === undefined) continue;
        putText(found, field.field, await openText(key, fieldAad(one.itemId, field.field), fromBase64Url(field.sealed)));
      } catch {
        // Nicht lesbar — dann eben ohne.
      }
    }

    opened.set(one.itemId, found);
  }

  return occurrences.map((one) => {
    const fields = opened.get(one.itemId)!;
    const level = byArea.get(one.areaId)?.myLevel ?? null;
    return {
      occurrence: one,
      title: fields.title ?? one.titlePublic ?? KIND_WORD[one.kind] ?? 'Termin',
      named: fields.title !== null || (one.titlePublic ?? '') !== '',
      location: fields.location,
      notes: fields.notes,
      link: fields.link,
      linkLabel: fields.linkLabel,
      editable: OWN_KINDS.includes(one.kind) && (level === 'write' || level === 'admin')
    };
  });
}

/* -- „Tylko ja" ------------------------------------------------------------------ */

/**
 * DER EIGENE BEREICH — der vorhandene, sonst jetzt angelegt. Zwei Fenster, die
 * es zugleich tun, bekommen denselben: der Dienst behält den ersten.
 */
export async function ensurePrivateArea(ring: Ring, person: SealedRole, areas: readonly AreaRow[]): Promise<string> {
  const had = areas.find((a) => a.personal === true);
  if (had !== undefined) return had.areaId;

  try {
    return (await createArea(ring, person, 'Prywatne', undefined, { personal: true })).areaId;
  } catch (e) {
    if (e instanceof WorkspaceError && e.verdict === 'personal-exists') {
      const again = (await loadAreas()).areas.find((a) => a.personal === true);
      if (again !== undefined) return again.areaId;
    }
    throw e;
  }
}

/* -- Eintragen und ändern ---------------------------------------------------------- */

/** Was das Formular hergibt. Datum und Uhrzeit in Ortszeit — „2026-10-04", „18:00". */
export interface EventDraft {
  readonly title: string;
  readonly location: string;
  readonly notes: string;
  /** 0073 — wohin „Więcej informacji" führt (`https://…` oder `#/…`), und was auf dem Knopf steht. */
  readonly link?: string;
  readonly linkLabel?: string;

  /** Wer ihn sieht — ein Bereich; „Tylko ja" ist der eigene. */
  readonly areaId: string;
  readonly ownerRoleId: string;

  readonly date: string;
  readonly time: string;
  /** Wie lange — bei ganztägigen in ganzen Tagen × 1440. */
  readonly minutes: number;
  readonly allDay: boolean;

  readonly repeat: RepeatKind;
  readonly every: number;
  /** pn=1 … nd=64. */
  readonly weekdays: number;
  /** Letzter Tag der Reihe — `null` mit `count`, oder „bez końca" (dann weit voraus). */
  readonly until: string | null;
  readonly count: number | null;

  /*
   * 0058 — IN WELCHEN KALENDER. Genannt: dieser (er gibt die Art vor, und
   * `areaId` ist dann nur noch, wer den Termin sieht). Fehlt er: der
   * Terminarz des Bereichs `areaId`, wie seit 0054.
   */
  readonly calendarId?: string;

  /* 0058 — fürs Reservieren: `null`/fehlt heisst „wie der Kalender". */
  readonly bookable?: boolean | null;
  readonly capacity?: number | null;
  readonly reserveAreaId?: string | null;

  /*
   * 0070 — TEIL EINES TERMINS. `undefined`: bleibt, wie es war; `null`: kein
   * Teil mehr; sonst unter diesem Termin. Ebenso die Rozmowa, aus der er kommt.
   */
  readonly parentItemId?: string | null;
  readonly position?: number | null;
  readonly origin?: { readonly chatId: string; readonly topicId: string | null } | null;

  /**
   * 0079 — WAS es ist. Fehlt es bei einem neuen Eintrag in einem Kalender,
   * entscheidet der Kalender; beim Ändern bleibt es, was es war (vorher wurde
   * hier jedes geänderte Ding zum Treffen).
   */
  readonly kind?: ItemKind;
}

/** „Bez końca" — eine Reihe braucht am Dienst ein Ende; zehn Jahre sind im Kalender keins. */
export const forever = (from: Date): string => {
  const at = new Date(from);
  at.setFullYear(at.getFullYear() + 10);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
};

/**
 * Einen Termin speichern — neu (`itemId` fehlt) oder die ganze Reihe eines
 * bestehenden. Die Felder werden HIER versiegelt, unter dem jüngsten
 * Schlüssel des gewählten Bereichs; die Kennung entsteht vorher, weil die AAD
 * sie nennt.
 */
export async function saveEvent(ring: Ring, draft: EventDraft, itemId?: string): Promise<string> {
  const id = itemId ?? newId();
  const newest = newestKey(await areaKeys(ring, draft.areaId, true));
  if (newest === null) throw new WorkspaceError('Nie masz klucza tego obszaru — nie da się tu zapisać.');

  const seal = async (field: ItemField, text: string): Promise<SealedField> => ({
    field,
    areaId: draft.areaId,
    epoch: newest.epoch,
    sealed: toBase64Url(await sealText(newest.key, fieldAad(id, field), text))
  });

  /*
   * 0079 — DER NAME EINES GOTTESDIENSTES HÄNGT AUS: er geht offen hinaus
   * (`titlePublic`) und wird nicht versiegelt — der Schaukasten hat keinen
   * Schlüssel. Ohne Namen steht dort die Art („Msza").
   */
  const liturgy = isLiturgy(draft.kind);
  const fields: SealedField[] = liturgy ? [] : [await seal('title', draft.title.trim() || 'Termin')];
  if (draft.location.trim() !== '') fields.push(await seal('location', draft.location.trim()));
  if (draft.notes.trim() !== '') fields.push(await seal('notes', draft.notes.trim()));
  if ((draft.link ?? '').trim() !== '') {
    fields.push(await seal('link', draft.link!.trim()));
    if ((draft.linkLabel ?? '').trim() !== '') fields.push(await seal('link_label', draft.linkLabel!.trim()));
  }

  const body = {
    itemId: id,
    ownerRoleId: draft.ownerRoleId,
    visibilityAreaId: draft.areaId,
    /* Neu in einem Kalender: seine Art (Treffen, Messe …). Ändern geht hier nur bei Treffen und Besuchen. */
    kind: draft.kind ?? (itemId === undefined && draft.calendarId !== undefined ? null : 'appointment'),
    calendarId: draft.calendarId ?? null,
    bookable: draft.bookable ?? null,
    capacity: draft.capacity ?? null,
    reserveAreaId: draft.reserveAreaId ?? null,
    date: draft.date,
    time: draft.allDay ? '00:00' : draft.time,
    minutes: draft.minutes,
    allDay: draft.allDay,
    titlePublic: liturgy && draft.title.trim() !== '' ? draft.title.trim() : null,
    status: 'planned',
    repeat: draft.repeat,
    every: draft.every,
    weekdays: draft.repeat === 'weekly' ? draft.weekdays : null,
    until: draft.repeat === 'none' ? null : draft.until,
    count: draft.repeat === 'none' ? null : draft.count,
    fields,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    parentItemId: draft.parentItemId === undefined ? null : draft.parentItemId ?? '',
    position: draft.position ?? null,
    chatId: draft.origin === undefined ? null : draft.origin?.chatId ?? '',
    topicId: draft.origin?.topicId ?? null
  };

  if (itemId === undefined && draft.calendarId !== undefined) {
    await call(`/workspace/calendar/${encodeURIComponent(draft.calendarId)}/item`, { method: 'POST', body: JSON.stringify(body) });
  } else if (itemId === undefined) {
    await call(`/workspace/area/${encodeURIComponent(draft.areaId)}/item`, { method: 'POST', body: JSON.stringify(body) });
  } else {
    await call(`/workspace/item/${encodeURIComponent(itemId)}`, { method: 'POST', body: JSON.stringify(body) });
  }

  return id;
}

export const deleteEvent = (itemId: string): Promise<{ deleted: boolean }> =>
  call(`/workspace/item/${encodeURIComponent(itemId)}/delete`, { method: 'POST' });

/** Nur dieses eine Vorkommen — absagen. */
export const cancelOne = (itemId: string, occurrenceAt: string) =>
  setOccurrence(itemId, occurrenceAt, { cancelled: true });

/** Nur dieses eine Vorkommen — verschieben. */
export const moveOne = (itemId: string, occurrenceAt: string, startsAt: Date) =>
  setOccurrence(itemId, occurrenceAt, { movedTo: startsAt.toISOString() });

/** 0079 — ein abgesagtes oder verlegtes Vorkommen steht wieder, wie die Reihe es sagt. */
export const restoreOne = (itemId: string, occurrenceAt: string) =>
  setOccurrence(itemId, occurrenceAt, { restore: true });

/**
 * 0079 — „TA I NASTĘPNE": die Reihe `itemId` endet vor dem Tag von `from`, und
 * die Reihe `to` (eben angelegt) übernimmt ab dann, was an den Vorkommen
 * hängt — Intentionen, wer da sein muss, Reservierungen. Der Dienst ordnet
 * nach dem Tag zu und ändert nichts, wenn einer Intention die Messe fehlte.
 */
export const handover = (itemId: string, to: string, from: string): Promise<{ until: string; intentions: number; people: number }> =>
  call(`/workspace/item/${encodeURIComponent(itemId)}/handover`, { method: 'POST', body: JSON.stringify({ to, from }) });
