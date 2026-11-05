/**
 * LAMPY JAKO JSON (2026-10-29) — die Geräte mit ihren Sygnały (Name, Nummer, Raum, Notiz, die gelernten Pakete),
 * die Timer und das Tempo der Knöpfe: Export, Import mit der Liste der Änderungen und die Beschreibung daneben
 * (`ui/JsonPanel`, `core/jsonTree`) — wie bei jedem Teil (Erinnerung „json-import-export"). Wozu: eine Sicherung,
 * ein anderes Konto, und ein Sprachmodell, das Timer vorbereitet (es liest diese Beschreibung über den MCP-Dienst).
 *
 * <b>Rein</b>: kein Dienst, kein Schlüssel. Geplant wird gegen den Stand der Seite (`loadLamps`); geschrieben wird
 * über dieselben Aufrufe wie von Hand (`LampsWrite` → `saveLamp`, `saveTimer`, `removeItem`) — versiegelt im eigenen
 * Bereich, und das Telefon bekommt den Plan der Timer wie nach jeder Änderung (`LampsApp`, `change`).
 *
 * <code>
 *   "id" aus dem Export       an Ort und Stelle — nur die Schlüssel, die das Dokument nennt
 *   ohne "id", fremdes "id"   neu, mit neuer Kennung (eine Zeile gehört EINEM Bereich — ein fremdes "id" lehnte der Dienst ab)
 *   "remove": true            gelöscht — nur mit "id", und die Liste zeigt es vorher
 *   "@klucz"                  ein Gerät / Sygnał dieses Dokuments; so zeigen die Timer auf sie
 * </code>
 *
 * Ein Sprachmodell kennt die Kennungen oft nicht: eine Aktion findet ihr Gerät deshalb auch über den Namen
 * (eindeutig — sonst eine Warnung) und über den Schlüssel, den der Export ihm gäbe.
 */

import { t } from '../core/i18n';
import { describe, keyLines, pretty, textNode, type JsonNode } from '../core/jsonTree';
import { newId } from '../core/ids';
import { LEGACY_MAX } from './adv';
import {
  ACTIONS_MAX, DURATION_DEFAULT, DURATION_MAX, DURATION_MIN, emptyLamp, emptyTimer, FRAMES_MAX, GAP_MAX, lampTitle, minuteOf,
  sealedJson, sealedTimerJson, SIGNALS_MAX, signalProblem, tidyLamp, tidyPace, tidyTimer, timeText,
  type Lamp, type LampData, type LampFrame, type LampSignal, type LampTimer, type LampTimerAction, type LampTimerData
} from './lampStore';
import { FASTEST, paceSummary, pauseText, type Pace } from './pace';
import { DAY_SHORT, daysText } from './timers';

export const LAMPS_FORMAT = 'recreatio/lamps';
export const LAMPS_VERSION = 1;
/** So viele Zeilen hält der Dienst je Bereich — Geräte und Timer zusammen (`Phone.Lamps.cs`, `MaxLamps`). */
export const ROWS_MAX = 500;

/** Was gespeichert ist (der eigene Bereich) — und das Tempo der Knöpfe, am Konto gemerkt (`lamps.pace`). */
export interface LampsNow {
  readonly lamps: readonly Lamp[];
  readonly timers: readonly LampTimer[];
  readonly buttons: Pace;
}

/* -- Die Schlüssel: Beschreibung, Prüfung auf Unbekanntes und `app-json-lamps-check` aus derselben Quelle -------------- */

type Keys = Readonly<Record<string, string>>;

/** Eine Tabelle, deren Sätze erst beim Lesen geholt werden (in der Sprache der Anwendung) — die Form bleibt. */
function lazy(table: Readonly<Record<string, () => string>>): Keys {
  const out: Record<string, string> = {};
  for (const [key, text] of Object.entries(table)) Object.defineProperty(out, key, { get: text, enumerable: true });
  return out;
}

export const DOC_KEYS: Keys = lazy({
  format: () => t('lampsJson.keys.doc.format', { format: LAMPS_FORMAT }),
  version: () => t('lampsJson.keys.doc.version', { version: LAMPS_VERSION }),
  buttons: () => t('lampsJson.keys.doc.buttons'),
  lamps: () => t('lampsJson.keys.doc.lamps'),
  timers: () => t('lampsJson.keys.doc.timers')
});

export const LAMP_KEYS: Keys = lazy({
  id: () => t('lampsJson.keys.lamp.id'),
  key: () => t('lampsJson.keys.lamp.key'),
  name: () => t('lampsJson.keys.lamp.name'),
  number: () => t('lampsJson.keys.lamp.number'),
  room: () => t('lampsJson.keys.lamp.room'),
  note: () => t('lampsJson.keys.lamp.note'),
  protocol: () => t('lampsJson.keys.lamp.protocol'),
  signals: () => t('lampsJson.keys.lamp.signals'),
  remove: () => t('lampsJson.keys.lamp.remove')
});

export const SIGNAL_KEYS: Keys = lazy({
  id: () => t('lampsJson.keys.signal.id'),
  key: () => t('lampsJson.keys.signal.key'),
  label: () => t('lampsJson.keys.signal.label'),
  note: () => t('lampsJson.keys.signal.note'),
  frames: () => t('lampsJson.keys.signal.frames', { max: FRAMES_MAX }),
  remove: () => t('lampsJson.keys.signal.remove')
});

export const FRAME_KEYS: Keys = lazy({
  hex: () => t('lampsJson.keys.frame.hex'),
  durationMs: () => t('lampsJson.keys.frame.durationMs', { min: DURATION_MIN, max: DURATION_MAX, default: DURATION_DEFAULT }),
  gapMs: () => t('lampsJson.keys.frame.gapMs', { max: GAP_MAX })
});

export const TIMER_KEYS: Keys = lazy({
  id: () => t('lampsJson.keys.timer.id'),
  name: () => t('lampsJson.keys.timer.name'),
  time: () => t('lampsJson.keys.timer.time'),
  days: () => t('lampsJson.keys.timer.days'),
  enabled: () => t('lampsJson.keys.timer.enabled'),
  pace: () => t('lampsJson.keys.timer.pace'),
  actions: () => t('lampsJson.keys.timer.actions', { max: ACTIONS_MAX }),
  remove: () => t('lampsJson.keys.timer.remove')
});

export const ACTION_KEYS: Keys = lazy({
  lamp: () => t('lampsJson.keys.action.lamp'),
  signal: () => t('lampsJson.keys.action.signal')
});

export const PACE_KEYS: Keys = lazy({
  pauseMs: () => t('lampsJson.keys.pace.pauseMs', { max: GAP_MAX }),
  limitMs: () => t('lampsJson.keys.pace.limitMs', { min: DURATION_MIN })
});

export const BUTTONS_KEYS: Keys = lazy({ pauseMs: () => PACE_KEYS.pauseMs });

/** Wo welche Schlüssel gelten — der Weg im Dokument (`lamps[].signals[]`) und seine Schlüssel. */
export const LAMPS_LEVELS: Readonly<Record<string, Keys>> = {
  '': DOC_KEYS,
  buttons: BUTTONS_KEYS,
  'lamps[]': LAMP_KEYS,
  'lamps[].signals[]': SIGNAL_KEYS,
  'lamps[].signals[].frames[]': FRAME_KEYS,
  'timers[]': TIMER_KEYS,
  'timers[].pace': PACE_KEYS,
  'timers[].actions[]': ACTION_KEYS
};

/* -- Kleinigkeiten ------------------------------------------------------------------------------------------------ */

type Doc = Record<string, unknown>;

const isObject = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);
const has = (o: Readonly<Record<string, unknown>>, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);

/** Zum Vergleichen von Namen: ohne Gross/klein, Zeichen über den Buchstaben, Satzzeichen — „Lampa w sypialni · nr 3" = „lampa w sypialni nr 3". */
const fold = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[łŁ]/g, 'l').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); // i18n-ignore

const slug = (s: string, fallback: string): string =>
  fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '') || fallback;

const unique = (base: string, taken: Set<string>): string => {
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}-${n}`;
  taken.add(key);
  return key;
};

/** Ein Schlüssel des Dokuments — Buchstaben, Ziffern, - _ . (ein „@" davor wird verziehen). */
const KEY_PATTERN = /^[\p{L}\p{N}_.-]{1,40}$/u;

const quoted = (s: string): string => (s.trim() === '' ? t('lampsJson.noName') : `„${s.trim()}”`);

/** Was ein Dokument nicht kennt, wird genannt — nicht still verschluckt. */
function unknownKeys(o: Doc, known: Keys, where: string, warnings: string[]): void {
  const extra = Object.keys(o).filter((key) => !has(known, key));
  if (extra.length === 1) warnings.push(t('lampsJson.warn.unknownKey', { where, key: extra[0] }));
  else if (extra.length > 1) warnings.push(t('lampsJson.warn.unknownKeys', { where, keys: extra.map((k) => `„${k}”`).join(', ') }));
}

/** Ein Text: Zeichenkette (getrimmt) oder Zahl („number": 3); `null` leert; Anderes — `undefined` und eine Warnung (bleibt). */
function readText(value: unknown, where: string, warnings: string[]): string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  warnings.push(t('lampsJson.warn.notText', { where }));
  return undefined;
}

function readId(value: unknown, where: string, warnings: string[]): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  warnings.push(t('lampsJson.warn.badId', { where }));
  return null;
}

function readKey(value: unknown, where: string, taken: ReadonlyMap<string, string>, warnings: string[]): string | null {
  if (value === undefined || value === null) return null;
  const key = typeof value === 'string' ? value.trim().replace(/^@/, '') : '';
  if (!KEY_PATTERN.test(key)) {
    warnings.push(t('lampsJson.warn.badKey', { where, value: JSON.stringify(value) }));
    return null;
  }
  if (taken.has(key)) {
    warnings.push(t('lampsJson.warn.keyTaken', { where, key }));
    return null;
  }
  return key;
}

function listOf(value: unknown, name: string, warnings: string[]): unknown[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  warnings.push(t('lampsJson.warn.notList', { name }));
  return [];
}

/** Eine Zahl des Dokuments — auch als Text („1000"); fehlt sie, gilt `fallback`; Unlesbares wird NaN (das sagt dann die Prüfung). */
const numberOf = (value: unknown, fallback: number): number =>
  (value === undefined || value === null ? fallback
    : typeof value === 'number' ? value
      : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);

/* -- Export ------------------------------------------------------------------------------------------------------- */

export interface ExportKeys {
  /** Kennung des Geräts → sein Schlüssel. */
  readonly lamp: ReadonlyMap<string, string>;
  /** Kennung des Geräts → (Kennung des Sygnał → sein Schlüssel). */
  readonly signal: ReadonlyMap<string, ReadonlyMap<string, string>>;
}

/**
 * Die Schlüssel, die der Export vergibt: das Gerät aus Name und Nummer („lampa-w-sypialni-nr-1"), der Sygnał aus
 * seinem Napis („wlacz") — lesbar statt der Kennungen, und dieselben bei jedem Export desselben Stands.
 */
export function exportKeys(lamps: readonly Lamp[]): ExportKeys {
  const taken = new Set<string>();
  const lamp = new Map<string, string>();
  const signal = new Map<string, Map<string, string>>();
  for (const l of lamps) {
    lamp.set(l.id, unique(slug(lampTitle(l), 'lampa'), taken));
    const own = new Set<string>();
    signal.set(l.id, new Map(l.signals.map((s) => [s.id, unique(slug(s.label, 'sygnal'), own)])));
  }
  return { lamp, signal };
}

export function exportLamps(now: LampsNow): Record<string, unknown> {
  const keys = exportKeys(now.lamps);
  return {
    format: LAMPS_FORMAT,
    version: LAMPS_VERSION,
    buttons: { pauseMs: now.buttons.pauseMs },
    lamps: now.lamps.map((l) => ({
      id: l.id,
      key: keys.lamp.get(l.id),
      name: l.name,
      number: l.number,
      room: l.room,
      note: l.note,
      protocol: l.protocol,
      signals: l.signals.map((s) => ({
        id: s.id,
        key: keys.signal.get(l.id)?.get(s.id),
        label: s.label,
        note: s.note,
        frames: s.frames.map((f) => ({ hex: f.hex, durationMs: f.durationMs, gapMs: f.gapMs }))
      }))
    })),
    timers: now.timers.map((t) => ({
      id: t.id,
      name: t.name,
      time: timeText(t.minute),
      days: t.days.map((d) => DAY_SHORT[d - 1]),
      enabled: t.enabled,
      pace: { pauseMs: t.pace.pauseMs, limitMs: t.pace.limitMs },
      actions: t.actions.map((a) => {
        const lampKey = keys.lamp.get(a.lampId);
        const signalKey = keys.signal.get(a.lampId)?.get(a.signalId);
        /* Gerät oder Sygnał gibt es nicht mehr: die Kennungen, wie sie sind — der Import lässt die Aktion dann stehen. */
        return lampKey === undefined || signalKey === undefined
          ? { lamp: a.lampId, signal: a.signalId }
          : { lamp: `@${lampKey}`, signal: `@${signalKey}` };
      })
    }))
  };
}

/* -- Der Plan ----------------------------------------------------------------------------------------------------- */

export interface PlannedLamp {
  readonly id: string;
  /** Wie es jetzt ist — `null`: neu (gespeichert auf dem Stand 0). */
  readonly existing: Lamp | null;
  readonly data: LampData;
}

export interface PlannedTimer {
  readonly id: string;
  readonly existing: LampTimer | null;
  readonly data: LampTimerData;
}

export interface PlannedRemoval {
  readonly id: string;
  readonly kind: 'lamp' | 'timer';
  readonly title: string;
}

export interface LampsPlan {
  /** Neue und geänderte Geräte, in der Reihenfolge des Dokuments. */
  readonly lamps: readonly PlannedLamp[];
  readonly timers: readonly PlannedTimer[];
  readonly removals: readonly PlannedRemoval[];
  /** Das neue Tempo der Knöpfe — `null`: bleibt. */
  readonly buttons: Pace | null;
  readonly unchanged: { readonly lamps: number; readonly timers: number };
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

/** Ein Gerät, wie es nach dem Import ist — darauf zeigen die Aktionen der Timer. */
interface WorldLamp {
  readonly id: string;
  readonly data: LampData;
  /** Wie es vor dem Import war — `null`: neu. */
  readonly before: Lamp | null;
  /** "key" der Sygnały im Dokument → Kennung. */
  readonly keys: ReadonlyMap<string, string>;
  /** "id" der Sygnały im Dokument → Kennung (ein fremdes bekam eine neue). */
  readonly ids: ReadonlyMap<string, string>;
}

interface SignalsPlan {
  readonly signals: LampSignal[];
  readonly keys: Map<string, string>;
  readonly ids: Map<string, string>;
  readonly added: string[];
  readonly changed: string[];
  readonly removed: string[];
  readonly moved: boolean;
}

/** Ein Sygnał zum Vergleichen — so, wie er versiegelt würde. */
const signalText = (s: LampSignal): string => JSON.stringify(tidyLamp({ ...emptyLamp(), signals: [s] }).signals[0]);

type FramesRead = { readonly frames: LampFrame[] } | { readonly problem: string };

function readFrames(value: unknown, where: string, warnings: string[]): FramesRead {
  if (!Array.isArray(value)) return { problem: t('lampsJson.warn.framesNotList') };
  const frames: LampFrame[] = [];
  for (const [i, one] of value.entries()) {
    const at = value.length === 1 ? t('lampsJson.at.frame') : t('lampsJson.at.frameN', { n: i + 1 });
    if (!isObject(one) || typeof one.hex !== 'string') return { problem: t('lampsJson.warn.noHex', { at }) };
    unknownKeys(one, FRAME_KEYS, `${where}, ${at}`, warnings);
    frames.push({ hex: one.hex, durationMs: numberOf(one.durationMs, DURATION_DEFAULT), gapMs: numberOf(one.gapMs, 0) });
  }
  return { frames };
}

/**
 * DIE SYGNAŁY EINES GERÄTS: mit "id" an Ort und Stelle, ohne dazu, "remove" fort, Ungenanntes bleibt. Nennt das
 * Dokument ALLE, gilt seine Reihenfolge; sonst bleibt die alte und Neues kommt ans Ende — ein Sprachmodell, das einen
 * Sygnał ergänzt, soll nicht die Knöpfe umstellen.
 */
function planSignals(value: unknown, before: Lamp | null, where: string, warnings: string[]): SignalsPlan | null {
  if (!Array.isArray(value)) {
    warnings.push(t('lampsJson.warn.signalsNotList', { where }));
    return null;
  }
  const had = before?.signals ?? [];
  const hadById = new Map(had.map((s) => [s.id, s]));
  const keys = new Map<string, string>();
  const ids = new Map<string, string>();
  const docIds = new Set<string>();
  /* Die vorhandenen, die das Dokument nennt (auch zum Löschen). */
  const named = new Set<string>();
  const gone = new Set<string>();
  const updated = new Map<string, LampSignal>();
  const fresh: LampSignal[] = [];
  const order: string[] = [];

  value.forEach((one: unknown, i: number) => {
    const at = t('lampsJson.at.signal', { where, which: isObject(one) && typeof one.label === 'string' && one.label.trim() !== '' ? `„${one.label.trim()}”` : i + 1 });
    if (!isObject(one)) { warnings.push(t('lampsJson.warn.notObjectM', { at })); return; }
    unknownKeys(one, SIGNAL_KEYS, at, warnings);
    const givenId = readId(one.id, at, warnings);
    let was: LampSignal | null = null;
    if (givenId !== null) {
      if (docIds.has(givenId)) { warnings.push(t('lampsJson.warn.idTwiceSignal', { at })); return; }
      docIds.add(givenId);
      was = hadById.get(givenId) ?? null;
      if (was === null && before !== null) warnings.push(t('lampsJson.warn.signalIdForeign', { at }));
    }
    if (one.remove === true) {
      if (was === null) { warnings.push(t('lampsJson.warn.removeNoSignal', { at })); return; }
      named.add(was.id);
      gone.add(was.id);
      return;
    }
    if (one.remove !== undefined && one.remove !== false) warnings.push(t('lampsJson.warn.removeOnlyTrue', { at }));
    const key = readKey(one.key, at, keys, warnings);
    const keep = (s: LampSignal) => {
      if (givenId !== null) ids.set(givenId, s.id);
      if (key !== null) keys.set(key, s.id);
      order.push(s.id);
    };
    const label = has(one, 'label') ? readText(one.label, `${at}, "label"`, warnings) : undefined;
    const note = has(one, 'note') ? readText(one.note, `${at}, "note"`, warnings) : undefined;
    const read = has(one, 'frames') ? readFrames(one.frames, at, warnings) : null;
    const draft: LampSignal = {
      id: was?.id ?? newId(),
      label: label === undefined ? was?.label ?? '' : label ?? '',
      note: note === undefined ? was?.note ?? null : note,
      frames: read !== null && 'frames' in read ? read.frames : was?.frames ?? []
    };
    const same = was !== null && signalText(draft) === signalText(was);
    /* Geprüft wird nur, was sich ändert — ein alter Sygnał, der einmal so gespeichert wurde, hält keinen Export auf. */
    const problem = read !== null && 'problem' in read ? read.problem : same ? null : signalProblem(draft);
    if (problem !== null) {
      warnings.push(t(was === null ? 'lampsJson.warn.signalSkipped' : 'lampsJson.warn.signalKept', { at, problem: problem.replace(/\.$/, '') }));
      if (was !== null) { named.add(was.id); keep(was); }
      return;
    }
    if (was === null) fresh.push(draft);
    else {
      named.add(was.id);
      if (!same) updated.set(was.id, draft);
    }
    keep(draft);
  });

  /* Höchstens SIGNALS_MAX: was nicht mehr passt, sind die letzten neuen. */
  const room = Math.max(0, SIGNALS_MAX - had.filter((s) => !gone.has(s.id)).length);
  if (fresh.length > room) {
    const dropped = fresh.splice(room);
    const out = new Set(dropped.map((s) => s.id));
    warnings.push(t('lampsJson.warn.tooManySignals', { where, max: SIGNALS_MAX, count: dropped.length }));
    for (const [k, id] of [...keys]) if (out.has(id)) keys.delete(k);
    for (const [k, id] of [...ids]) if (out.has(id)) ids.delete(k);
  }

  const freshById = new Map(fresh.map((s) => [s.id, s]));
  const all = had.length > 0 && had.every((s) => named.has(s.id));
  const signals = all
    ? order.filter((id) => !gone.has(id)).map((id) => updated.get(id) ?? hadById.get(id) ?? freshById.get(id)).filter((s): s is LampSignal => s !== undefined)
    : [...had.filter((s) => !gone.has(s.id)).map((s) => updated.get(s.id) ?? s), ...fresh];
  const kept = had.filter((s) => !gone.has(s.id)).map((s) => s.id).join();
  const now = signals.filter((s) => hadById.has(s.id)).map((s) => s.id).join();
  return {
    signals, keys, ids,
    added: fresh.map((s) => s.label.trim()),
    changed: [...updated.values()].map((s) => s.label.trim()),
    removed: had.filter((s) => gone.has(s.id)).map((s) => s.label),
    moved: kept !== now
  };
}

const DAY_WORDS: Readonly<Record<string, number>> = { pn: 1, wt: 2, sr: 3, cz: 4, pt: 5, so: 6, nd: 7 };

/** Die Tage — ganz oder gar nicht: ein unbekannter Tag liesse sonst aus „pn, xx" still „codziennie" werden. */
function readDays(value: unknown): { readonly days: number[] } | { readonly problem: string } {
  if (!Array.isArray(value)) return { problem: t('lampsJson.warn.daysNotList', { value: JSON.stringify(value) }) };
  const days: number[] = [];
  const bad: string[] = [];
  for (const one of value) {
    const n = typeof one === 'number' ? one
      : typeof one === 'string' ? DAY_WORDS[fold(one)] ?? (/^\d+$/.test(one.trim()) ? Number(one) : NaN) : NaN;
    if (Number.isInteger(n) && n >= 1 && n <= 7) days.push(n);
    else bad.push(JSON.stringify(one));
  }
  if (bad.length > 0) return { problem: t('lampsJson.warn.badDays', { days: bad.join(', ') }) };
  return { days: [...new Set(days)].sort((a, b) => a - b) };
}

/** Das Tempo eines Timers — nur die genannten Regler; ausserhalb der Grenzen wird gekappt und gesagt. */
function readPace(value: unknown, base: Pace, where: string, warnings: string[]): Pace {
  if (value === null) return FASTEST;
  if (!isObject(value)) {
    warnings.push(t('lampsJson.warn.paceNotObject', { where }));
    return base;
  }
  unknownKeys(value, PACE_KEYS, `${where}, "pace"`, warnings);
  let pauseMs = base.pauseMs;
  if (value.pauseMs !== undefined) {
    if (typeof value.pauseMs !== 'number' || !Number.isFinite(value.pauseMs)) warnings.push(t('lampsJson.warn.pauseNotNumber', { where }));
    else {
      if (value.pauseMs < 0 || value.pauseMs > GAP_MAX) warnings.push(t('lampsJson.warn.pauseClamped', { where, max: GAP_MAX }));
      pauseMs = value.pauseMs;
    }
  }
  let limitMs = base.limitMs;
  if (value.limitMs !== undefined) {
    if (value.limitMs === null) limitMs = null;
    else if (typeof value.limitMs !== 'number' || !Number.isFinite(value.limitMs)) warnings.push(t('lampsJson.warn.limitNotNumber', { where }));
    else {
      if (value.limitMs < DURATION_MIN) warnings.push(t('lampsJson.warn.limitClamped', { where, min: DURATION_MIN }));
      limitMs = value.limitMs;
    }
  }
  return tidyPace({ pauseMs, limitMs });
}

/** Wie ein Gerät heissen kann, wenn ein Timer es beim Namen nennt — jetzt und vor dem Import (es wurde umbenannt). */
function namesOf(lamp: Pick<WorldLamp, 'data' | 'before'>): string[] {
  const out = new Set<string>();
  for (const d of [lamp.data, lamp.before]) {
    if (d === null) continue;
    if (d.name.trim() !== '') out.add(fold(d.name));
    if (d.number !== null && d.number.trim() !== '') {
      out.add(fold(d.number));
      out.add(fold(`nr ${d.number}`)); // i18n-ignore
      out.add(fold(t('lamps.app.number', { n: d.number })));
    }
    out.add(fold(lampTitle(d)));
  }
  return [...out];
}

const timerHead = (d: LampTimerData): string => `${timeText(d.minute)}, ${daysText(d.days)}${d.name.trim() === '' ? '' : ` „${d.name.trim()}”`}`;

/**
 * DER PLAN: was ein Dokument ändern würde — oder warum es nicht geht. Rein: dieselbe Rechnung für die Vorschau und
 * für den Import (der danach `applyLampsPlan` schreibt).
 */
export function planLampsImport(doc: unknown, now: LampsNow): LampsPlan | { error: string } {
  if (!isObject(doc)) return { error: t('lampsJson.err.notDoc', { format: LAMPS_FORMAT }) };
  if (doc.format !== undefined && doc.format !== LAMPS_FORMAT) return { error: t('lampsJson.err.otherFormat', { got: String(doc.format), format: LAMPS_FORMAT }) };
  if (doc.lamps === undefined && doc.timers === undefined && doc.buttons === undefined) {
    return { error: t('lampsJson.err.nothing') };
  }
  const warnings: string[] = [];
  unknownKeys(doc, DOC_KEYS, t('lampsJson.at.doc'), warnings);
  if (doc.version !== undefined && doc.version !== LAMPS_VERSION) warnings.push(t('lampsJson.warn.version', { got: JSON.stringify(doc.version), version: LAMPS_VERSION }));

  const lampsById = new Map(now.lamps.map((l) => [l.id, l]));
  const timersById = new Map(now.timers.map((t) => [t.id, t]));
  const exported = exportKeys(now.lamps);
  const exportedLamp = new Map([...exported.lamp].map(([id, key]) => [key, id]));
  const exportedSignal = new Map([...exported.signal].map(([lampId, keys]) => [lampId, new Map([...keys].map(([id, key]) => [key, id]))]));

  /* -- Geräte -- */
  const world = new Map<string, WorldLamp>(now.lamps.map((l) => [l.id, { id: l.id, data: l, before: l, keys: new Map(), ids: new Map() }]));
  const lampKeys = new Map<string, string>();
  const lampIds = new Map<string, string>();
  const removedLamps = new Map<string, Lamp>();
  const plannedLamps: PlannedLamp[] = [];
  const removals: PlannedRemoval[] = [];
  const lampLines: string[] = [];
  const seenLamps = new Set<string>();

  listOf(doc.lamps, 'lamps', warnings).forEach((one, i) => {
    const at = t('lampsJson.at.lamp', { which: isObject(one) && typeof one.name === 'string' && one.name.trim() !== '' ? `„${one.name.trim()}”` : i + 1 });
    if (!isObject(one)) { warnings.push(t('lampsJson.warn.notObjectN', { at })); return; }
    unknownKeys(one, LAMP_KEYS, at, warnings);
    const givenId = readId(one.id, at, warnings);
    let was: Lamp | null = null;
    if (givenId !== null) {
      if (seenLamps.has(givenId)) { warnings.push(t('lampsJson.warn.idTwiceN', { at })); return; }
      seenLamps.add(givenId);
      was = lampsById.get(givenId) ?? null;
      if (was === null) {
        warnings.push(timersById.has(givenId) ? t('lampsJson.warn.lampIdIsTimer', { at }) : t('lampsJson.warn.lampIdForeign', { at }));
      }
    }
    if (one.remove === true) {
      if (was === null) { warnings.push(t('lampsJson.warn.removeNoLamp', { at })); return; }
      removedLamps.set(was.id, was);
      world.delete(was.id);
      const n = was.signals.length;
      removals.push({ id: was.id, kind: 'lamp', title: n === 0 ? t('lampsJson.line.lampNoSignals', { name: lampTitle(was) }) : t('lampsJson.line.lampWithSignals', { name: lampTitle(was), count: n }) });
      return;
    }
    if (one.remove !== undefined && one.remove !== false) warnings.push(t('lampsJson.warn.removeOnlyTrue', { at }));
    const key = readKey(one.key, at, lampKeys, warnings);

    /* Ein Gerät, das bleibt, wie es ist: Timer dürfen trotzdem über seinen Schlüssel auf es zeigen. */
    const asItWas = (lamp: Lamp) => {
      if (givenId !== null) lampIds.set(givenId, lamp.id);
      if (key !== null) lampKeys.set(key, lamp.id);
    };
    if (one.protocol !== undefined && one.protocol !== 'ble-adv') {
      warnings.push(t(was === null ? 'lampsJson.warn.protocolSkipped' : 'lampsJson.warn.protocolKept', { at, protocol: JSON.stringify(one.protocol) }));
      if (was !== null) asItWas(was);
      return;
    }

    const base: LampData = was ?? emptyLamp();
    const field = (name: 'name' | 'number' | 'room' | 'note') => (has(one, name) ? readText(one[name], `${at}, "${name}"`, warnings) : undefined);
    const name = field('name');
    const number = field('number');
    const room = field('room');
    const note = field('note');
    const signals = has(one, 'signals') ? planSignals(one.signals, was, at, warnings) : null;
    const data = tidyLamp({
      name: name === undefined ? base.name : name ?? '',
      number: number === undefined ? base.number : number,
      room: room === undefined ? base.room : room,
      note: note === undefined ? base.note : note,
      protocol: 'ble-adv',
      signals: signals?.signals ?? base.signals
    });
    if (data.name === '' && (data.number ?? '') === '') {
      warnings.push(t(was === null ? 'lampsJson.warn.noNameSkipped' : 'lampsJson.warn.noNameKept', { at }));
      if (was !== null) {
        asItWas(was);
        const alive = new Set(was.signals.map((s) => s.id));
        world.set(was.id, {
          id: was.id, data: was, before: was,
          keys: new Map([...(signals?.keys ?? [])].filter(([, id]) => alive.has(id))),
          ids: new Map([...(signals?.ids ?? [])].filter(([, id]) => alive.has(id)))
        });
      }
      return;
    }

    const id = was?.id ?? newId();
    if (givenId !== null) lampIds.set(givenId, id);
    if (key !== null) lampKeys.set(key, id);
    const same = was !== null && sealedJson(was) === sealedJson(data);
    world.set(id, { id, data: same && was !== null ? was : data, before: was, keys: signals?.keys ?? new Map(), ids: signals?.ids ?? new Map() });
    if (same) return;
    plannedLamps.push({ id, existing: was, data });
    if (was === null) {
      /* Ohne "id" wird nie über den Namen zugeordnet — aber ein Zwilling wird gesagt (ein zweiter Import desselben Texts, ein Modell ohne Export). */
      const twin = now.lamps.find((l) => !removedLamps.has(l.id) && fold(lampTitle(l)) === fold(lampTitle(data)));
      if (twin !== undefined) warnings.push(t('lampsJson.warn.lampTwin', { at, name: lampTitle(data) }));
      const n = data.signals.length;
      const labels = data.signals.slice(0, 8).map((s) => s.label).join(', ') + (n > 8 ? ', …' : '');
      const head = data.room === null ? `„${lampTitle(data)}”` : `„${lampTitle(data)}” (${data.room})`;
      lampLines.push(n > 0 ? t('lampsJson.line.newLampSignals', { head, count: n, labels }) : t('lampsJson.line.newLamp', { head, count: n }));
      return;
    }
    const what: string[] = [];
    if (was.name !== data.name) what.push(t('lampsJson.what.name', { from: quoted(was.name), to: quoted(data.name) }));
    if (was.number !== data.number) what.push(t('lampsJson.what.number', { from: was.number ?? '—', to: data.number ?? '—' }));
    if (was.room !== data.room) what.push(t('lampsJson.what.room', { from: was.room ?? '—', to: data.room ?? '—' }));
    if (was.note !== data.note) what.push(t('lampsJson.what.note'));
    const listed = (labels: readonly string[]) => labels.map(quoted).join(', ');
    if (signals !== null) {
      if (signals.added.length > 0) what.push(t('lampsJson.what.added', { count: signals.added.length, list: listed(signals.added) }));
      if (signals.changed.length > 0) what.push(t('lampsJson.what.changed', { count: signals.changed.length, list: listed(signals.changed) }));
      if (signals.removed.length > 0) what.push(t('lampsJson.what.removed', { count: signals.removed.length, list: listed(signals.removed) }));
      if (signals.moved) what.push(t('lampsJson.what.order'));
    }
    lampLines.push(t('lampsJson.line.changedLamp', { name: lampTitle(was), what: what.join('; ') || t('lampsJson.what.save') }));
  });

  /* -- Aktionen der Timer: auf welches Gerät, welchen Sygnał -- */
  const resolveLamp = (ref: unknown, where: string): string | null => {
    if (typeof ref !== 'string' || ref.trim() === '') {
      warnings.push(t('lampsJson.warn.lampRef', { where }));
      return null;
    }
    const text = ref.trim();
    let id: string | undefined;
    if (text.startsWith('@')) {
      id = lampKeys.get(text.slice(1)) ?? exportedLamp.get(text.slice(1));
    } else {
      id = lampIds.get(text) ?? (lampsById.has(text) ? text : undefined);
      if (id === undefined) {
        const wanted = fold(text);
        const hits = [...world.values()].filter((l) => namesOf(l).includes(wanted));
        if (hits.length > 1) {
          warnings.push(t('lampsJson.warn.lampAmbiguous', { where, text, count: hits.length }));
          return null;
        }
        id = hits[0]?.id ?? [...removedLamps.values()].find((l) => namesOf({ data: l, before: l }).includes(wanted))?.id;
      }
    }
    const gone = id === undefined ? undefined : removedLamps.get(id);
    if (gone !== undefined) {
      warnings.push(t('lampsJson.warn.lampRemoved', { where, name: lampTitle(gone) }));
      return null;
    }
    if (id === undefined || !world.has(id)) {
      warnings.push(t('lampsJson.warn.lampMissing', { where, ref: text.startsWith('@') ? `"${text}"` : `„${text}”` }));
      return null;
    }
    return id;
  };

  const resolveSignal = (lamp: WorldLamp, ref: unknown, where: string): string | null => {
    const title = lampTitle(lamp.data);
    if (typeof ref !== 'string' || ref.trim() === '') {
      warnings.push(t('lampsJson.warn.signalRef', { where }));
      return null;
    }
    const text = ref.trim();
    const signals = lamp.data.signals;
    let id: string | undefined;
    if (text.startsWith('@')) {
      id = lamp.keys.get(text.slice(1)) ?? exportedSignal.get(lamp.id)?.get(text.slice(1));
    } else {
      id = lamp.ids.get(text) ?? (signals.some((s) => s.id === text) || lamp.before?.signals.some((s) => s.id === text) === true ? text : undefined);
      if (id === undefined) {
        const wanted = fold(text);
        const hits = signals.filter((s) => fold(s.label) === wanted);
        if (hits.length > 1) {
          warnings.push(t('lampsJson.warn.signalAmbiguous', { where, text, count: hits.length, title }));
          return null;
        }
        id = hits[0]?.id;
      }
    }
    if (id !== undefined && signals.some((s) => s.id === id)) return id;
    const gone = id === undefined ? undefined : lamp.before?.signals.find((s) => s.id === id);
    warnings.push(gone !== undefined
      ? t('lampsJson.warn.signalRemoved', { where, label: gone.label, title })
      : t('lampsJson.warn.signalMissing', { where, title, ref: text.startsWith('@') ? `"${text}"` : `„${text}”` }));
    return null;
  };

  const actionText = (a: LampTimerAction): string => {
    const lamp = world.get(a.lampId);
    const signal = lamp?.data.signals.find((s) => s.id === a.signalId);
    return lamp === undefined || signal === undefined ? t('lamps.timers.signalGone') : `${lampTitle(lamp.data)}: ${signal.label}`;
  };

  /* -- Timer -- */
  const plannedTimers: PlannedTimer[] = [];
  const timerLines: string[] = [];
  const seenTimers = new Set<string>();

  listOf(doc.timers, 'timers', warnings).forEach((one, i) => {
    const at = t('lampsJson.at.timer', { which: isObject(one) && typeof one.name === 'string' && one.name.trim() !== '' ? `„${one.name.trim()}”`
      : isObject(one) && typeof one.time === 'string' && one.time.trim() !== '' ? one.time.trim() : i + 1 });
    if (!isObject(one)) { warnings.push(t('lampsJson.warn.notObjectM', { at })); return; }
    unknownKeys(one, TIMER_KEYS, at, warnings);
    const givenId = readId(one.id, at, warnings);
    let was: LampTimer | null = null;
    if (givenId !== null) {
      if (seenTimers.has(givenId)) { warnings.push(t('lampsJson.warn.idTwiceM', { at })); return; }
      seenTimers.add(givenId);
      was = timersById.get(givenId) ?? null;
      if (was === null) {
        warnings.push(lampsById.has(givenId) ? t('lampsJson.warn.timerIdIsLamp', { at }) : t('lampsJson.warn.timerIdForeign', { at }));
      }
    }
    if (one.remove === true) {
      if (was === null) { warnings.push(t('lampsJson.warn.removeNoTimer', { at })); return; }
      removals.push({ id: was.id, kind: 'timer', title: timerHead(was) });
      return;
    }
    if (one.remove !== undefined && one.remove !== false) warnings.push(t('lampsJson.warn.removeOnlyTrue', { at }));

    const base: LampTimerData = was ?? emptyTimer();
    /* Was ein Timer zum Laufen braucht (Uhrzeit, Tage, Aktionen), ist falsch: der ganze Eintrag fällt weg — nicht halb. */
    const skip = (why: string) => warnings.push(t(was === null ? 'lampsJson.warn.timerSkipped' : 'lampsJson.warn.timerKept', { at, why }));
    const name = has(one, 'name') ? readText(one.name, `${at}, "name"`, warnings) : undefined;
    let minute = base.minute;
    if (has(one, 'time')) {
      const read = typeof one.time === 'string' ? minuteOf(one.time) : null;
      if (read === null) { skip(t('lampsJson.why.badTime', { value: JSON.stringify(one.time) })); return; }
      minute = read;
    } else if (was === null) {
      skip(t('lampsJson.why.noTime'));
      return;
    }
    let days = base.days;
    if (has(one, 'days')) {
      const read = readDays(one.days);
      if ('problem' in read) { skip(read.problem); return; }
      days = read.days;
    }
    let enabled = base.enabled;
    if (has(one, 'enabled')) {
      if (typeof one.enabled === 'boolean') enabled = one.enabled;
      else warnings.push(t('lampsJson.warn.badEnabled', { at }));
    }
    const pace = has(one, 'pace') ? readPace(one.pace, base.pace, at, warnings) : base.pace;

    let actions: readonly LampTimerAction[] = base.actions;
    let broken = 0;
    if (has(one, 'actions')) {
      if (!Array.isArray(one.actions)) { skip(t('lampsJson.why.actionsNotList')); return; }
      const steps: readonly unknown[] = one.actions;
      const out: LampTimerAction[] = [];
      let over = 0;
      steps.forEach((step, k) => {
        const where = t('lampsJson.at.action', { at, n: k + 1 });
        if (out.length >= ACTIONS_MAX) { over += 1; return; }
        if (!isObject(step)) { warnings.push(t('lampsJson.warn.actionNotObject', { where })); return; }
        unknownKeys(step, ACTION_KEYS, where, warnings);
        /* Eine Aktion, deren Gerät oder Sygnał es schon vorher nicht mehr gab: bleibt, wie sie war (der Export schreibt sie mit ihren Kennungen). */
        const old = was?.actions.find((a) => a.lampId === step.lamp && a.signalId === step.signal);
        if (old !== undefined && lampsById.get(old.lampId)?.signals.some((s) => s.id === old.signalId) !== true) {
          out.push(old);
          broken += 1;
          return;
        }
        const lampId = resolveLamp(step.lamp, where);
        const lamp = lampId === null ? undefined : world.get(lampId);
        if (lamp === undefined) return;
        const signalId = resolveSignal(lamp, step.signal, where);
        if (signalId !== null) out.push({ lampId: lamp.id, signalId });
      });
      if (over > 0) warnings.push(t('lampsJson.warn.tooManyActions', { at, max: ACTIONS_MAX, count: over }));
      if (out.length === 0) {
        skip(steps.length === 0 ? t('lampsJson.why.emptyActions') : t('lampsJson.why.noActionHits'));
        return;
      }
      actions = out;
    }
    if (actions.length === 0) { skip(t('lampsJson.why.noActions')); return; }

    const data = tidyTimer({ name: name === undefined ? base.name : name ?? '', minute, days, enabled, actions, pace });
    if (was !== null && sealedTimerJson(was) === sealedTimerJson(data)) return;
    if (broken > 0) {
      warnings.push(t('lampsJson.warn.brokenActions', { at, count: broken }));
    }
    const id = was?.id ?? newId();
    plannedTimers.push({ id, existing: was, data });
    const tempo = paceSummary(data.pace);
    if (was === null) {
      const twin = now.timers.find((x) => !removals.some((r) => r.id === x.id) && sealedTimerJson({ ...x, enabled: true }) === sealedTimerJson({ ...data, enabled: true }));
      if (twin !== undefined) warnings.push(t('lampsJson.warn.timerTwin', { at, head: timerHead(twin) }));
      const extra = (tempo === null ? '' : t('lampsJson.line.tempo', { tempo })) + (data.enabled ? '' : t('lampsJson.line.off'));
      timerLines.push(t('lampsJson.line.newTimer', { head: timerHead(data), actions: data.actions.map(actionText).join(', '), extra }));
      return;
    }
    const what: string[] = [];
    if (was.name !== data.name) what.push(t('lampsJson.what.name', { from: quoted(was.name), to: quoted(data.name) }));
    if (was.minute !== data.minute) what.push(t('lampsJson.what.time', { from: timeText(was.minute), to: timeText(data.minute) }));
    if (was.days.join() !== data.days.join()) what.push(t('lampsJson.what.days', { from: daysText(was.days), to: daysText(data.days) }));
    if (was.enabled !== data.enabled) what.push(data.enabled ? t('lampsJson.what.on') : t('lampsJson.what.off'));
    if (JSON.stringify(tidyPace(was.pace)) !== JSON.stringify(data.pace)) what.push(t('lampsJson.what.tempo', { tempo: tempo ?? t('lampsJson.what.fastest') }));
    if (JSON.stringify(was.actions) !== JSON.stringify(data.actions)) what.push(t('lampsJson.what.actions', { list: data.actions.map(actionText).join(', ') }));
    timerLines.push(t('lampsJson.line.changedTimer', { head: timerHead(was), what: what.join('; ') || t('lampsJson.what.save') }));
  });

  /*
   * Was nach dem Import in den Timern steht (geplant oder wie bisher), verliert vielleicht ein Gerät oder einen Sygnał,
   * den das Dokument löscht. Neu aufgelöste Aktionen zeigen nie auf Gelöschtes — gewarnt wird also nur bei dem, was blieb.
   */
  const removedTimers = new Set(removals.filter((r) => r.kind === 'timer').map((r) => r.id));
  const plannedById = new Map(plannedTimers.map((p) => [p.id, p.data]));
  for (const one of now.timers) {
    if (removedTimers.has(one.id)) continue;
    const after = plannedById.get(one.id) ?? one;
    for (const a of after.actions) {
      const before = lampsById.get(a.lampId);
      const signal = before?.signals.find((s) => s.id === a.signalId);
      if (before === undefined || signal === undefined) continue;
      const lamp = world.get(a.lampId);
      if (lamp !== undefined && lamp.data.signals.some((s) => s.id === a.signalId)) continue;
      warnings.push(t(lamp === undefined ? 'lampsJson.warn.actionToRemovedLamp' : 'lampsJson.warn.actionToRemovedSignal', { head: timerHead(after), action: `${lampTitle(before)}: ${signal.label}` }));
    }
  }

  /* -- Das Tempo der Knöpfe -- */
  let buttons: Pace | null = null;
  if (doc.buttons !== undefined) {
    if (!isObject(doc.buttons)) warnings.push(t('lampsJson.warn.buttonsNotObject'));
    else {
      unknownKeys(doc.buttons, BUTTONS_KEYS, t('lampsJson.at.buttons'), warnings);
      const pause = doc.buttons.pauseMs;
      if (pause !== undefined) {
        if (typeof pause !== 'number' || !Number.isFinite(pause) || pause < 0 || pause > GAP_MAX) {
          warnings.push(t('lampsJson.warn.buttonsPause', { max: GAP_MAX }));
        } else if (Math.round(pause) !== now.buttons.pauseMs) {
          buttons = { pauseMs: Math.round(pause), limitMs: null };
        }
      }
    }
  }

  /* -- Die Liste -- */
  const lines: string[] = [
    ...removals.map((r) => (r.kind === 'lamp' ? t('lampsJson.line.removedLamp', { title: r.title }) : t('lampsJson.line.removedTimer', { title: r.title }))),
    ...lampLines,
    ...timerLines,
    ...(buttons === null ? [] : [t('lampsJson.line.buttons', { pause: pauseText(buttons.pauseMs), was: pauseText(now.buttons.pauseMs) })])
  ];
  if (lines.length === 0) lines.push(t('lampsJson.line.nothing'));
  const sameLamps = now.lamps.length - removedLamps.size - plannedLamps.filter((p) => p.existing !== null).length;
  const sameTimers = now.timers.length - removals.filter((r) => r.kind === 'timer').length - plannedTimers.filter((p) => p.existing !== null).length;
  if (sameLamps + sameTimers > 0) {
    lines.push(t('lampsJson.line.unchanged', { lamps: t('lamps.app.devices', { count: sameLamps }), timers: t('lampsJson.timers', { count: sameTimers }) }));
  }
  const rows = now.lamps.length + now.timers.length - removals.length
    + plannedLamps.filter((p) => p.existing === null).length + plannedTimers.filter((p) => p.existing === null).length;
  if (rows > ROWS_MAX) warnings.push(t('lampsJson.warn.tooManyRows', { rows, max: ROWS_MAX }));

  return {
    lamps: plannedLamps,
    timers: plannedTimers,
    removals,
    buttons,
    unchanged: { lamps: sameLamps, timers: sameTimers },
    lines,
    warnings
  };
}

/* -- Schreiben ---------------------------------------------------------------------------------------------------- */

/** Dieselben Aufrufe wie von Hand (`saveLamp`, `saveTimer`, `removeItem`, der Regler der Knöpfe) — hier nur genannt, damit der Plan rein bleibt. */
export interface LampsWrite {
  readonly saveLamp: (id: string, data: LampData, version: number) => Promise<Lamp>;
  readonly saveTimer: (id: string, data: LampTimerData, version: number) => Promise<LampTimer>;
  readonly remove: (id: string) => Promise<unknown>;
  readonly setButtons: (pace: Pace) => void;
}

export interface LampsApplied {
  readonly lamps: readonly Lamp[];
  readonly timers: readonly LampTimer[];
  readonly removed: readonly string[];
  readonly done: number;
  readonly total: number;
  /** Woran es scheiterte — `null`: alles geschrieben. */
  readonly error: unknown;
}

/**
 * Der Plan, geschrieben: erst das Löschen (es macht Platz — der Dienst zählt die Zeilen), dann die Geräte (die Timer
 * zeigen auf ihre Sygnały), dann die Timer, zuletzt das Tempo. Ein Fehler hält an; was bis dahin geschrieben ist,
 * kommt zurück, damit die Seite (und der Plan des Telefons) es kennt.
 */
export async function applyLampsPlan(plan: LampsPlan, write: LampsWrite, stage: (what: string) => void): Promise<LampsApplied> {
  const lamps: Lamp[] = [];
  const timers: LampTimer[] = [];
  const removed: string[] = [];
  const total = plan.removals.length + plan.lamps.length + plan.timers.length + (plan.buttons === null ? 0 : 1);
  let done = 0;
  const result = (error: unknown): LampsApplied => ({ lamps, timers, removed, done, total, error });
  try {
    for (const one of plan.removals) {
      stage(t('lampsJson.stage.remove', { n: done + 1, total }));
      await write.remove(one.id);
      removed.push(one.id);
      done += 1;
    }
    for (const one of plan.lamps) {
      stage(t('lampsJson.stage.lamps', { n: done + 1, total }));
      lamps.push(await write.saveLamp(one.id, one.data, one.existing?.version ?? 0));
      done += 1;
    }
    for (const one of plan.timers) {
      stage(t('lampsJson.stage.timers', { n: done + 1, total }));
      timers.push(await write.saveTimer(one.id, one.data, one.existing?.version ?? 0));
      done += 1;
    }
    if (plan.buttons !== null) {
      write.setButtons(plan.buttons);
      done += 1;
    }
    return result(null);
  } catch (e) {
    return result(e);
  }
}

/* -- Die Beispiele ------------------------------------------------------------------------------------------------ */

/* Zwei Mitschnitte eines Pilots aus nRF Connect (dieselben wie in `app-lamp-check.mjs`) und zwei nach ihrem Muster. */
const ON = '1EFF00000048464B4AE15A2285B8F21CB0424734F03133C519101112131415';
const OFF = '1EFF00000048464B4AFFC185675ED4FE58606205383D074F85101112131415';
const WARM = '1EFF00000048464B4A7C3D19A0E2B54F6D21C8830A9E57F1B2101112131415';
const DIM = '1EFF00000048464B4A2B90E64D7135CA08F3B6125E7D4C29A3101112131415';

/** Zwei Lampen mit ihren Sygnały und zwei Timer — ein neues Konto, eine Sicherung. */
export function lampsExample(): Record<string, unknown> {
  return {
    format: LAMPS_FORMAT,
    version: LAMPS_VERSION,
    buttons: { pauseMs: 0 },
    lamps: [
      {
        key: 'sypialnia',
        name: t('lampsJson.sample.bedroomLamp'),
        number: '1',
        room: t('lampsJson.sample.bedroom'),
        note: t('lampsJson.sample.bedroomNote'),
        protocol: 'ble-adv',
        signals: [
          { key: 'wlacz', label: t('lampsJson.sample.on'), note: null, frames: [{ hex: ON, durationMs: 1000, gapMs: 0 }] },
          { key: 'wylacz', label: t('lampsJson.sample.off'), note: null, frames: [{ hex: OFF, durationMs: 1000, gapMs: 0 }] }
        ]
      },
      {
        key: 'salon',
        name: t('lampsJson.sample.livingLamp'),
        number: '2',
        room: t('lampsJson.sample.living'),
        note: null,
        protocol: 'ble-adv',
        signals: [
          { key: 'cieple', label: t('lampsJson.sample.warm'), note: null, frames: [{ hex: WARM, durationMs: 1000, gapMs: 0 }] },
          {
            key: 'noc', label: t('lampsJson.sample.night'), note: t('lampsJson.sample.nightNote'),
            frames: [{ hex: DIM, durationMs: 600, gapMs: 300 }, { hex: WARM, durationMs: 600, gapMs: 0 }]
          }
        ]
      }
    ],
    timers: [
      {
        name: t('lampsJson.sample.morning'), time: '06:45', days: ['pn', 'wt', 'śr', 'cz', 'pt'], enabled: true, pace: { pauseMs: 0, limitMs: null }, // i18n-ignore
        actions: [{ lamp: '@sypialnia', signal: '@wlacz' }]
      },
      {
        name: t('lampsJson.sample.forNight'), time: '23:00', days: [], enabled: true, pace: { pauseMs: 300, limitMs: 1000 },
        actions: [{ lamp: '@sypialnia', signal: '@wylacz' }, { lamp: '@salon', signal: '@noc' }]
      }
    ]
  };
}

/** Nur Timer, für Lampen, die es schon gibt — beim Namen genannt, wie ein Sprachmodell sie ohne Export schreibt. */
export function timersExample(): Record<string, unknown> {
  return {
    format: LAMPS_FORMAT,
    version: LAMPS_VERSION,
    timers: [
      { name: t('lampsJson.sample.weekendMorning'), time: '08:30', days: ['so', 'nd'], actions: [{ lamp: t('lampsJson.sample.bedroomLamp'), signal: t('lampsJson.sample.on') }] },
      { name: t('lampsJson.sample.dusk'), time: '17:15', days: [], actions: [{ lamp: t('lampsJson.sample.livingLamp'), signal: t('lampsJson.sample.warm') }] }
    ]
  };
}

/** Ändern und Löschen — nur, was sich ändert, mit den Kennungen aus dem Export (Platzhalter, kein Beispiel zum Einsetzen). */
const changeExample = (): Record<string, unknown> => ({
  format: LAMPS_FORMAT,
  version: LAMPS_VERSION,
  lamps: [{
    id: t('lampsJson.sample.lampId'),
    room: t('lampsJson.sample.kidsRoom'),
    signals: [{ id: t('lampsJson.sample.signalId'), label: t('lampsJson.sample.dark') }, { id: t('lampsJson.sample.otherSignalId'), remove: true }]
  }],
  timers: [{ id: t('lampsJson.sample.timerId'), time: '07:15', enabled: false }, { id: t('lampsJson.sample.otherTimerId'), remove: true }]
});

/* -- Der Baum der Beschreibung ------------------------------------------------------------------------------------ */

const INTRO = (): string => `${t('lampsJson.node.intro', { rows: ROWS_MAX, signals: SIGNALS_MAX, frames: FRAMES_MAX, actions: ACTIONS_MAX })}
${keyLines(DOC_KEYS)}`;

/*
 * 2026-10-30 — WAS DIE APP MIT DEM IMPORTIERTEN TUT: versiegelt in „Tylko ja" (`lampStore.ts`, `openPhone`);
 * senden kann nur das Telefon der Ausgabe „sms" (`native.ts`, `lampHere`); Timer nennen Gerät und Sygnał, nicht
 * Bytes; der Plan liegt im Telefon und wird nach einer Änderung dort und beim Start der App neu abgelegt
 * (`LampsApp.tsx` → `sync`, `timerStart.ts`); das Tempo der Knöpfe am Konto (`useRemembered`).
 */
export const LAMPS_USAGE_JSON: JsonNode = {
  key: 'lamps.usage',
  get title() { return t('lampsJson.node.usage.title'); },
  text: () => t('lampsJson.node.usage.text')
};

/** Ein Paket: was Android senden kann (`adv.ts`). */
export const LAMP_FRAME_JSON: JsonNode = {
  key: 'lamps.frame',
  get title() { return t('lampsJson.node.frame.title'); },
  /* Erst ein Satz: der Abschnitt wird getrimmt (`sectionText`) — mit den Schlüsseln vorn verlöre die erste Zeile ihren Einzug. */
  text: () => `${t('lampsJson.node.frame.lead')}
${keyLines(FRAME_KEYS)}
${t('lampsJson.node.frame.text', { max: LEGACY_MAX, bytes: t('lampsJson.bytes', { count: LEGACY_MAX }) })}`
};

export const LAMP_SIGNAL_JSON: JsonNode = {
  key: 'lamps.signal',
  get title() { return t('lampsJson.node.signal.title'); },
  text: () => `${t('lampsJson.node.signal.lead')}
${keyLines(SIGNAL_KEYS)}
${t('lampsJson.node.signal.text')}`,
  inside: () => [LAMP_FRAME_JSON]
};

export const LAMP_JSON: JsonNode = {
  key: 'lamps.lamp',
  get title() { return t('lampsJson.node.lamp.title'); },
  text: () => `${t('lampsJson.node.lamp.lead')}
${keyLines(LAMP_KEYS)}
${t('lampsJson.node.lamp.text')}`,
  inside: () => [LAMP_SIGNAL_JSON]
};

export const LAMP_ACTION_JSON: JsonNode = {
  key: 'lamps.action',
  get title() { return t('lampsJson.node.action.title'); },
  text: () => `${t('lampsJson.node.action.lead')}
${keyLines(ACTION_KEYS)}
${t('lampsJson.node.action.text')}`
};

export const LAMP_PACE_JSON: JsonNode = {
  key: 'lamps.pace',
  get title() { return t('lampsJson.node.pace.title'); },
  text: () => `${t('lampsJson.node.pace.lead')}
${keyLines(PACE_KEYS)}`
};

export const LAMP_TIMER_JSON: JsonNode = {
  key: 'lamps.timer',
  get title() { return t('lampsJson.node.timer.title'); },
  text: () => `${t('lampsJson.node.timer.lead')}
${keyLines(TIMER_KEYS)}
${t('lampsJson.node.timer.text')}`,
  inside: () => [LAMP_ACTION_JSON, LAMP_PACE_JSON]
};

/** 2026-10-29 — DIE LAMPEN ALS JSON: der Baum, aus dem die Beschreibung neben dem Import entsteht (und der Katalog des MCP-Dienstes). */
export const LAMPS_JSON: JsonNode = {
  key: 'lamps',
  get title() { return t('lampsJson.node.root.title', { format: LAMPS_FORMAT, version: LAMPS_VERSION }); },
  get short() { return t('lampsJson.node.root.short'); },
  text: INTRO,
  inside: () => [
    LAMPS_USAGE_JSON,
    LAMP_JSON,
    LAMP_TIMER_JSON,
    textNode('lamps.example', t('lampsJson.node.example.title'), () => pretty(lampsExample())),
    textNode('lamps.example-timers', t('lampsJson.node.exampleTimers.title'), () =>
      `${t('lampsJson.node.exampleTimers.lead')}\n${pretty(timersExample())}`),
    textNode('lamps.example-change', t('lampsJson.node.exampleChange.title'), () =>
      `${t('lampsJson.node.exampleChange.lead')}\n${pretty(changeExample())}`)
  ],
  samples: () => [
    { get label() { return t('lampsJson.node.sampleFull'); }, doc: lampsExample },
    { get label() { return t('lampsJson.node.sampleTimers'); }, doc: timersExample }
  ]
};

export const lampsDescription = (): string => describe(LAMPS_JSON);
