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

import { describe, keyLines, pretty, textNode, type JsonNode } from '../core/jsonTree';
import { newId } from '../core/ids';
import { plural } from '../core/plural';
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

export const DOC_KEYS: Keys = {
  format: `zawsze "${LAMPS_FORMAT}"`,
  version: `${LAMPS_VERSION} (wersja formatu)`,
  buttons: 'tempo przycisków: { "pauseMs" } (niżej: Tempo); pominięte — bez zmian',
  lamps: 'urządzenia z ich sygnałami (niżej); pominięte — bez zmian',
  timers: 'timery (niżej); pominięte — bez zmian'
};

export const LAMP_KEYS: Keys = {
  id: 'identyfikator z eksportu — po nim import zmienia to samo urządzenie; bez niego (albo z identyfikatorem, którego tu nie ma, np. z innego konta) powstaje nowe',
  key: 'krótka nazwa, na którą wskazują akcje timerów w tym dokumencie ("@klucz"): litery, cyfry, - _ . (do 40 znaków), niepowtarzalna — nie jest zapisywana',
  name: 'nazwa, np. „Lampa w sypialni” — nazwa albo numer są wymagane',
  number: 'numer urządzenia jako tekst, np. "3" (porządkuje przyciski); null — bez numeru',
  room: 'pomieszczenie, np. „Sypialnia”, albo null',
  note: 'notatka o protokole (producent, adres pilota, co znaczą bajty) albo null',
  protocol: '"ble-adv" — surowa reklama BLE (legacy); jedyny protokół, można pominąć',
  signals: 'sygnały — przyciski urządzenia (niżej)',
  remove: 'true — usuwa urządzenie razem z jego sygnałami (tylko z "id"); timery, które ich używają, przestaną je wykonywać — lista zmian ostrzega'
};

export const SIGNAL_KEYS: Keys = {
  id: 'identyfikator sygnału z eksportu (w obrębie urządzenia) — po nim import zmienia ten sam sygnał; bez niego powstaje nowy',
  key: 'krótka nazwa sygnału dla akcji timerów ("@klucz"), niepowtarzalna w urządzeniu — nie jest zapisywana',
  label: 'napis na przycisku, np. „Włącz” (wymagany)',
  note: 'notatka albo null',
  frames: `ramki nadawane po kolei, od 1 do ${FRAMES_MAX} (niżej); podane zastępują wszystkie ramki sygnału`,
  remove: 'true — usuwa sygnał (tylko z "id")'
};

export const FRAME_KEYS: Keys = {
  hex: 'cały pakiet reklamy BLE szesnastkowo, jak w nRF Connect: "1EFF0000…"; spacje, dwukropki, przecinki i 0x import usuwa',
  durationMs: `jak długo nadawać, ${DURATION_MIN}–${DURATION_MAX} ms (domyślnie ${DURATION_DEFAULT})`,
  gapMs: `przerwa przed następną ramką, 0–${GAP_MAX} ms (domyślnie 0; po ostatniej nie ma znaczenia)`
};

export const TIMER_KEYS: Keys = {
  id: 'identyfikator z eksportu — po nim import zmienia ten sam timer; bez niego powstaje nowy',
  name: 'nazwa, np. „Rano” (opcjonalnie; bez niej — „Timer 07:00”)',
  time: 'godzina "GG:MM" według zegara telefonu, np. "06:45" — wymagana przy nowym timerze',
  days: 'dni tygodnia: 1–7 (1 = poniedziałek … 7 = niedziela) albo "pn", "wt", "śr", "cz", "pt", "so", "nd"; [] — codziennie',
  enabled: 'true — włączony (domyślnie), false — wyłączony',
  pace: 'tempo tego timera: { "pauseMs", "limitMs" } (niżej); pominięte przy nowym — najszybciej',
  actions: `akcje wysyłane po kolei, od 1 do ${ACTIONS_MAX} (niżej); podane zastępują wszystkie akcje timera`,
  remove: 'true — usuwa timer (tylko z "id")'
};

export const ACTION_KEYS: Keys = {
  lamp: 'urządzenie: "@klucz" z tego dokumentu, "id" z eksportu albo nazwa lub numer urządzenia („Lampa w sypialni”, "nr 3")',
  signal: 'sygnał TEGO urządzenia: "@klucz", "id" albo napis na przycisku („Włącz”)'
};

export const PACE_KEYS: Keys = {
  pauseMs: `przerwa między nadaniami, 0–${GAP_MAX} ms: między pakietami w ramce (pakiet co 100 ms + przerwa), między ramkami i między akcjami; 0 — bez przerwy`,
  limitMs: `tylko w timerze: najdłużej tyle ms nadawać każdą ramkę (co najmniej ${DURATION_MIN}); null — tak długo, jak zapisano`
};

export const BUTTONS_KEYS: Keys = { pauseMs: PACE_KEYS.pauseMs };

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
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[łŁ]/g, 'l').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

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

const quoted = (s: string): string => (s.trim() === '' ? '(bez nazwy)' : `„${s.trim()}”`);

/** Was ein Dokument nicht kennt, wird genannt — nicht still verschluckt. */
function unknownKeys(o: Doc, known: Keys, where: string, warnings: string[]): void {
  const extra = Object.keys(o).filter((key) => !has(known, key));
  if (extra.length === 1) warnings.push(`${where}: nieznany klucz „${extra[0]}” — pominięty.`);
  else if (extra.length > 1) warnings.push(`${where}: nieznane klucze ${extra.map((k) => `„${k}”`).join(', ')} — pominięte.`);
}

/** Ein Text: Zeichenkette (getrimmt) oder Zahl („number": 3); `null` leert; Anderes — `undefined` und eine Warnung (bleibt). */
function readText(value: unknown, where: string, warnings: string[]): string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  warnings.push(`${where} musi być tekstem — pominięte.`);
  return undefined;
}

function readId(value: unknown, where: string, warnings: string[]): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  warnings.push(`${where}: "id" musi być tekstem z eksportu — pominięte.`);
  return null;
}

function readKey(value: unknown, where: string, taken: ReadonlyMap<string, string>, warnings: string[]): string | null {
  if (value === undefined || value === null) return null;
  const key = typeof value === 'string' ? value.trim().replace(/^@/, '') : '';
  if (!KEY_PATTERN.test(key)) {
    warnings.push(`${where}: "key" to litery, cyfry, - _ . (do 40 znaków) — ${JSON.stringify(value)} pominięty.`);
    return null;
  }
  if (taken.has(key)) {
    warnings.push(`${where}: klucz "@${key}" jest już w dokumencie — ten pominięty.`);
    return null;
  }
  return key;
}

function listOf(value: unknown, name: string, warnings: string[]): unknown[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  warnings.push(`"${name}" musi być listą — pominięte.`);
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
  if (!Array.isArray(value)) return { problem: '"frames" musi być listą ramek {"hex", "durationMs", "gapMs"}' };
  const frames: LampFrame[] = [];
  for (const [i, one] of value.entries()) {
    const at = value.length === 1 ? 'ramka' : `ramka ${i + 1}`;
    if (!isObject(one) || typeof one.hex !== 'string') return { problem: `${at}: brak pakietu "hex"` };
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
    warnings.push(`${where}: "signals" musi być listą — sygnały bez zmian.`);
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
    const at = `${where}, sygnał ${isObject(one) && typeof one.label === 'string' && one.label.trim() !== '' ? `„${one.label.trim()}”` : i + 1}`;
    if (!isObject(one)) { warnings.push(`${at}: to nie jest obiekt — pominięty.`); return; }
    unknownKeys(one, SIGNAL_KEYS, at, warnings);
    const givenId = readId(one.id, at, warnings);
    let was: LampSignal | null = null;
    if (givenId !== null) {
      if (docIds.has(givenId)) { warnings.push(`${at}: to samo "id" drugi raz — pominięty.`); return; }
      docIds.add(givenId);
      was = hadById.get(givenId) ?? null;
      if (was === null && before !== null) warnings.push(`${at}: "id" nie należy do sygnałów tego urządzenia — powstanie nowy sygnał.`);
    }
    if (one.remove === true) {
      if (was === null) { warnings.push(`${at}: "remove" bez "id" sygnału tego urządzenia — nie ma czego usunąć.`); return; }
      named.add(was.id);
      gone.add(was.id);
      return;
    }
    if (one.remove !== undefined && one.remove !== false) warnings.push(`${at}: "remove" może być tylko true — pominięte.`);
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
      warnings.push(`${at}: ${problem.replace(/\.$/, '')} — ${was === null ? 'sygnał pominięty' : 'sygnał bez zmian'}.`);
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
    warnings.push(`${where}: najwyżej ${SIGNALS_MAX} sygnałów w urządzeniu — ${dropped.length} ${plural(dropped.length, 'nowy pominięty', 'nowe pominięte', 'nowych pominiętych')}.`);
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
  if (!Array.isArray(value)) return { problem: `"days" to lista (np. ["pn", "śr"] albo [1, 3]; [] — codziennie), a jest ${JSON.stringify(value)}` };
  const days: number[] = [];
  const bad: string[] = [];
  for (const one of value) {
    const n = typeof one === 'number' ? one
      : typeof one === 'string' ? DAY_WORDS[fold(one)] ?? (/^\d+$/.test(one.trim()) ? Number(one) : NaN) : NaN;
    if (Number.isInteger(n) && n >= 1 && n <= 7) days.push(n);
    else bad.push(JSON.stringify(one));
  }
  if (bad.length > 0) return { problem: `nieznane dni ${bad.join(', ')} (1–7 albo pn, wt, śr, cz, pt, so, nd)` };
  return { days: [...new Set(days)].sort((a, b) => a - b) };
}

/** Das Tempo eines Timers — nur die genannten Regler; ausserhalb der Grenzen wird gekappt und gesagt. */
function readPace(value: unknown, base: Pace, where: string, warnings: string[]): Pace {
  if (value === null) return FASTEST;
  if (!isObject(value)) {
    warnings.push(`${where}: "pace" to {"pauseMs", "limitMs"} — tempo bez zmian.`);
    return base;
  }
  unknownKeys(value, PACE_KEYS, `${where}, "pace"`, warnings);
  let pauseMs = base.pauseMs;
  if (value.pauseMs !== undefined) {
    if (typeof value.pauseMs !== 'number' || !Number.isFinite(value.pauseMs)) warnings.push(`${where}: "pauseMs" musi być liczbą — bez zmian.`);
    else {
      if (value.pauseMs < 0 || value.pauseMs > GAP_MAX) warnings.push(`${where}: "pauseMs" od 0 do ${GAP_MAX} ms — przycięte.`);
      pauseMs = value.pauseMs;
    }
  }
  let limitMs = base.limitMs;
  if (value.limitMs !== undefined) {
    if (value.limitMs === null) limitMs = null;
    else if (typeof value.limitMs !== 'number' || !Number.isFinite(value.limitMs)) warnings.push(`${where}: "limitMs" to liczba albo null — bez zmian.`);
    else {
      if (value.limitMs < DURATION_MIN) warnings.push(`${where}: "limitMs" co najmniej ${DURATION_MIN} ms — przycięte.`);
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
      out.add(fold(`nr ${d.number}`));
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
  if (!isObject(doc)) return { error: `To nie jest dokument lamp — oczekiwano obiektu {"format": "${LAMPS_FORMAT}", …}.` };
  if (doc.format !== undefined && doc.format !== LAMPS_FORMAT) return { error: `Inny format: „${String(doc.format)}” — tu importuje się "${LAMPS_FORMAT}".` };
  if (doc.lamps === undefined && doc.timers === undefined && doc.buttons === undefined) {
    return { error: 'Dokument nie ma ani "lamps", ani "timers", ani "buttons" — nie ma czego importować.' };
  }
  const warnings: string[] = [];
  unknownKeys(doc, DOC_KEYS, 'Dokument', warnings);
  if (doc.version !== undefined && doc.version !== LAMPS_VERSION) warnings.push(`Wersja ${JSON.stringify(doc.version)} — import zna wersję ${LAMPS_VERSION}; czego nie zna, pomija.`);

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
    const at = `Urządzenie ${isObject(one) && typeof one.name === 'string' && one.name.trim() !== '' ? `„${one.name.trim()}”` : i + 1}`;
    if (!isObject(one)) { warnings.push(`${at}: to nie jest obiekt — pominięte.`); return; }
    unknownKeys(one, LAMP_KEYS, at, warnings);
    const givenId = readId(one.id, at, warnings);
    let was: Lamp | null = null;
    if (givenId !== null) {
      if (seenLamps.has(givenId)) { warnings.push(`${at}: to samo "id" drugi raz w dokumencie — pominięte.`); return; }
      seenLamps.add(givenId);
      was = lampsById.get(givenId) ?? null;
      if (was === null) {
        warnings.push(timersById.has(givenId)
          ? `${at}: "id" należy do timera, nie do urządzenia — powstanie nowe urządzenie.`
          : `${at}: "id" nie należy do żadnego urządzenia tutaj (np. z innego konta) — powstanie nowe, z nowym "id".`);
      }
    }
    if (one.remove === true) {
      if (was === null) { warnings.push(`${at}: "remove" bez "id" istniejącego urządzenia — nie ma czego usunąć.`); return; }
      removedLamps.set(was.id, was);
      world.delete(was.id);
      const n = was.signals.length;
      removals.push({ id: was.id, kind: 'lamp', title: `„${lampTitle(was)}” ${n === 0 ? 'bez sygnałów' : `z ${n} ${plural(n, 'sygnałem', 'sygnałami', 'sygnałami')}`}` });
      return;
    }
    if (one.remove !== undefined && one.remove !== false) warnings.push(`${at}: "remove" może być tylko true — pominięte.`);
    const key = readKey(one.key, at, lampKeys, warnings);

    /* Ein Gerät, das bleibt, wie es ist: Timer dürfen trotzdem über seinen Schlüssel auf es zeigen. */
    const asItWas = (lamp: Lamp) => {
      if (givenId !== null) lampIds.set(givenId, lamp.id);
      if (key !== null) lampKeys.set(key, lamp.id);
    };
    if (one.protocol !== undefined && one.protocol !== 'ble-adv') {
      warnings.push(`${at}: nieznany protokół ${JSON.stringify(one.protocol)} (jest tylko "ble-adv") — ${was === null ? 'urządzenie pominięte' : 'urządzenie bez zmian'}.`);
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
      warnings.push(`${at}: bez nazwy i numeru — ${was === null ? 'urządzenie pominięte' : 'urządzenie bez zmian'}.`);
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
      if (twin !== undefined) warnings.push(`${at}: bez "id" — powstanie drugie urządzenie „${lampTitle(data)}” obok istniejącego; żeby zmienić istniejące, podaj jego "id" z eksportu.`);
      const n = data.signals.length;
      const labels = data.signals.slice(0, 8).map((s) => s.label).join(', ') + (n > 8 ? ', …' : '');
      lampLines.push(`Nowe urządzenie: „${lampTitle(data)}”${data.room === null ? '' : ` (${data.room})`} — ${n} ${plural(n, 'sygnał', 'sygnały', 'sygnałów')}${n > 0 ? `: ${labels}` : ''}.`);
      return;
    }
    const what: string[] = [];
    if (was.name !== data.name) what.push(`nazwa ${quoted(was.name)} → ${quoted(data.name)}`);
    if (was.number !== data.number) what.push(`numer ${was.number ?? '—'} → ${data.number ?? '—'}`);
    if (was.room !== data.room) what.push(`pomieszczenie ${was.room ?? '—'} → ${data.room ?? '—'}`);
    if (was.note !== data.note) what.push('notatka');
    const listed = (labels: readonly string[]) => labels.map(quoted).join(', ');
    if (signals !== null) {
      if (signals.added.length > 0) what.push(`${plural(signals.added.length, 'nowy sygnał', 'nowe sygnały', 'nowe sygnały')} ${listed(signals.added)}`);
      if (signals.changed.length > 0) what.push(`${plural(signals.changed.length, 'zmieniony sygnał', 'zmienione sygnały', 'zmienione sygnały')} ${listed(signals.changed)}`);
      if (signals.removed.length > 0) what.push(`${plural(signals.removed.length, 'usunięty sygnał', 'usunięte sygnały', 'usunięte sygnały')} ${listed(signals.removed)}`);
      if (signals.moved) what.push('kolejność sygnałów');
    }
    lampLines.push(`Zmienione urządzenie: „${lampTitle(was)}” — ${what.join('; ') || 'zapis'}.`);
  });

  /* -- Aktionen der Timer: auf welches Gerät, welchen Sygnał -- */
  const resolveLamp = (ref: unknown, where: string): string | null => {
    if (typeof ref !== 'string' || ref.trim() === '') {
      warnings.push(`${where}: "lamp" to "@klucz", "id" albo nazwa urządzenia — akcja pominięta.`);
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
          warnings.push(`${where}: „${text}” pasuje do ${hits.length} urządzeń — podaj "@klucz" albo "id"; akcja pominięta.`);
          return null;
        }
        id = hits[0]?.id ?? [...removedLamps.values()].find((l) => namesOf({ data: l, before: l }).includes(wanted))?.id;
      }
    }
    const gone = id === undefined ? undefined : removedLamps.get(id);
    if (gone !== undefined) {
      warnings.push(`${where}: urządzenie „${lampTitle(gone)}” jest w tym dokumencie usuwane — akcja pominięta.`);
      return null;
    }
    if (id === undefined || !world.has(id)) {
      warnings.push(`${where}: nie ma urządzenia ${text.startsWith('@') ? `"${text}"` : `„${text}”`} — akcja pominięta.`);
      return null;
    }
    return id;
  };

  const resolveSignal = (lamp: WorldLamp, ref: unknown, where: string): string | null => {
    const title = lampTitle(lamp.data);
    if (typeof ref !== 'string' || ref.trim() === '') {
      warnings.push(`${where}: "signal" to "@klucz", "id" albo napis na przycisku — akcja pominięta.`);
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
          warnings.push(`${where}: „${text}” pasuje do ${hits.length} sygnałów „${title}” — podaj "@klucz" albo "id"; akcja pominięta.`);
          return null;
        }
        id = hits[0]?.id;
      }
    }
    if (id !== undefined && signals.some((s) => s.id === id)) return id;
    const gone = id === undefined ? undefined : lamp.before?.signals.find((s) => s.id === id);
    warnings.push(gone !== undefined
      ? `${where}: sygnał „${gone.label}” („${title}”) jest w tym dokumencie usuwany — akcja pominięta.`
      : `${where}: „${title}” nie ma sygnału ${text.startsWith('@') ? `"${text}"` : `„${text}”`} — akcja pominięta.`);
    return null;
  };

  const actionText = (a: LampTimerAction): string => {
    const lamp = world.get(a.lampId);
    const signal = lamp?.data.signals.find((s) => s.id === a.signalId);
    return lamp === undefined || signal === undefined ? '(usunięty sygnał)' : `${lampTitle(lamp.data)}: ${signal.label}`;
  };

  /* -- Timer -- */
  const plannedTimers: PlannedTimer[] = [];
  const timerLines: string[] = [];
  const seenTimers = new Set<string>();

  listOf(doc.timers, 'timers', warnings).forEach((one, i) => {
    const at = `Timer ${isObject(one) && typeof one.name === 'string' && one.name.trim() !== '' ? `„${one.name.trim()}”`
      : isObject(one) && typeof one.time === 'string' && one.time.trim() !== '' ? one.time.trim() : i + 1}`;
    if (!isObject(one)) { warnings.push(`${at}: to nie jest obiekt — pominięty.`); return; }
    unknownKeys(one, TIMER_KEYS, at, warnings);
    const givenId = readId(one.id, at, warnings);
    let was: LampTimer | null = null;
    if (givenId !== null) {
      if (seenTimers.has(givenId)) { warnings.push(`${at}: to samo "id" drugi raz w dokumencie — pominięty.`); return; }
      seenTimers.add(givenId);
      was = timersById.get(givenId) ?? null;
      if (was === null) {
        warnings.push(lampsById.has(givenId)
          ? `${at}: "id" należy do urządzenia, nie do timera — powstanie nowy timer.`
          : `${at}: "id" nie należy do żadnego timera tutaj (np. z innego konta) — powstanie nowy, z nowym "id".`);
      }
    }
    if (one.remove === true) {
      if (was === null) { warnings.push(`${at}: "remove" bez "id" istniejącego timera — nie ma czego usunąć.`); return; }
      removals.push({ id: was.id, kind: 'timer', title: timerHead(was) });
      return;
    }
    if (one.remove !== undefined && one.remove !== false) warnings.push(`${at}: "remove" może być tylko true — pominięte.`);

    const base: LampTimerData = was ?? emptyTimer();
    /* Was ein Timer zum Laufen braucht (Uhrzeit, Tage, Aktionen), ist falsch: der ganze Eintrag fällt weg — nicht halb. */
    const skip = (why: string) => warnings.push(`${at}: ${why} — ${was === null ? 'timer pominięty' : 'timer bez zmian'}.`);
    const name = has(one, 'name') ? readText(one.name, `${at}, "name"`, warnings) : undefined;
    let minute = base.minute;
    if (has(one, 'time')) {
      const read = typeof one.time === 'string' ? minuteOf(one.time) : null;
      if (read === null) { skip(`"time" to godzina "GG:MM" (np. "07:00"), a jest ${JSON.stringify(one.time)}`); return; }
      minute = read;
    } else if (was === null) {
      skip('brak godziny "time"');
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
      else warnings.push(`${at}: "enabled" to true albo false — pominięte.`);
    }
    const pace = has(one, 'pace') ? readPace(one.pace, base.pace, at, warnings) : base.pace;

    let actions: readonly LampTimerAction[] = base.actions;
    let broken = 0;
    if (has(one, 'actions')) {
      if (!Array.isArray(one.actions)) { skip('"actions" to lista {"lamp", "signal"}'); return; }
      const steps: readonly unknown[] = one.actions;
      const out: LampTimerAction[] = [];
      let over = 0;
      steps.forEach((step, k) => {
        const where = `${at}, akcja ${k + 1}`;
        if (out.length >= ACTIONS_MAX) { over += 1; return; }
        if (!isObject(step)) { warnings.push(`${where}: akcja to {"lamp": …, "signal": …} — pominięta.`); return; }
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
      if (over > 0) warnings.push(`${at}: najwyżej ${ACTIONS_MAX} akcji — ${over} ${plural(over, 'dalsza pominięta', 'dalsze pominięte', 'dalszych pominiętych')}.`);
      if (out.length === 0) {
        skip(steps.length === 0 ? 'pusta lista "actions" — timer musi coś wysłać' : 'żadna akcja nie wskazuje sygnału');
        return;
      }
      actions = out;
    }
    if (actions.length === 0) { skip('brak akcji "actions" — timer musi coś wysłać'); return; }

    const data = tidyTimer({ name: name === undefined ? base.name : name ?? '', minute, days, enabled, actions, pace });
    if (was !== null && sealedTimerJson(was) === sealedTimerJson(data)) return;
    if (broken > 0) {
      warnings.push(`${at}: ${broken} ${plural(broken, 'akcja wskazuje', 'akcje wskazują', 'akcji wskazuje')} urządzenie albo sygnał, którego już nie ma — ${broken === 1 ? 'zostaje' : 'zostają'}, ale timer ${broken === 1 ? 'jej' : 'ich'} nie wykona.`);
    }
    const id = was?.id ?? newId();
    plannedTimers.push({ id, existing: was, data });
    const tempo = paceSummary(data.pace);
    if (was === null) {
      const twin = now.timers.find((t) => !removals.some((r) => r.id === t.id) && sealedTimerJson({ ...t, enabled: true }) === sealedTimerJson({ ...data, enabled: true }));
      if (twin !== undefined) warnings.push(`${at}: bez "id" — powstanie drugi taki sam timer obok istniejącego (${timerHead(twin)}); żeby zmienić istniejący, podaj jego "id" z eksportu.`);
      timerLines.push(`Nowy timer: ${timerHead(data)} — ${data.actions.map(actionText).join(', ')}${tempo === null ? '' : `; tempo: ${tempo}`}${data.enabled ? '' : ' (wyłączony)'}.`);
      return;
    }
    const what: string[] = [];
    if (was.name !== data.name) what.push(`nazwa ${quoted(was.name)} → ${quoted(data.name)}`);
    if (was.minute !== data.minute) what.push(`godzina ${timeText(was.minute)} → ${timeText(data.minute)}`);
    if (was.days.join() !== data.days.join()) what.push(`dni ${daysText(was.days)} → ${daysText(data.days)}`);
    if (was.enabled !== data.enabled) what.push(data.enabled ? 'włączony' : 'wyłączony');
    if (JSON.stringify(tidyPace(was.pace)) !== JSON.stringify(data.pace)) what.push(`tempo: ${tempo ?? 'najszybciej'}`);
    if (JSON.stringify(was.actions) !== JSON.stringify(data.actions)) what.push(`akcje: ${data.actions.map(actionText).join(', ')}`);
    timerLines.push(`Zmieniony timer: ${timerHead(was)} — ${what.join('; ') || 'zapis'}.`);
  });

  /*
   * Was nach dem Import in den Timern steht (geplant oder wie bisher), verliert vielleicht ein Gerät oder einen Sygnał,
   * den das Dokument löscht. Neu aufgelöste Aktionen zeigen nie auf Gelöschtes — gewarnt wird also nur bei dem, was blieb.
   */
  const removedTimers = new Set(removals.filter((r) => r.kind === 'timer').map((r) => r.id));
  const plannedById = new Map(plannedTimers.map((p) => [p.id, p.data]));
  for (const t of now.timers) {
    if (removedTimers.has(t.id)) continue;
    const after = plannedById.get(t.id) ?? t;
    for (const a of after.actions) {
      const before = lampsById.get(a.lampId);
      const signal = before?.signals.find((s) => s.id === a.signalId);
      if (before === undefined || signal === undefined) continue;
      const lamp = world.get(a.lampId);
      if (lamp !== undefined && lamp.data.signals.some((s) => s.id === a.signalId)) continue;
      warnings.push(`Timer ${timerHead(after)}: akcja „${lampTitle(before)}: ${signal.label}” wskazuje ${lamp === undefined ? 'usuwane urządzenie' : 'usuwany sygnał'} — timer tej akcji nie wykona.`);
    }
  }

  /* -- Das Tempo der Knöpfe -- */
  let buttons: Pace | null = null;
  if (doc.buttons !== undefined) {
    if (!isObject(doc.buttons)) warnings.push('"buttons" to {"pauseMs": …} — pominięte.');
    else {
      unknownKeys(doc.buttons, BUTTONS_KEYS, 'Tempo przycisków ("buttons")', warnings);
      const pause = doc.buttons.pauseMs;
      if (pause !== undefined) {
        if (typeof pause !== 'number' || !Number.isFinite(pause) || pause < 0 || pause > GAP_MAX) {
          warnings.push(`Tempo przycisków: "pauseMs" od 0 do ${GAP_MAX} ms — pominięte.`);
        } else if (Math.round(pause) !== now.buttons.pauseMs) {
          buttons = { pauseMs: Math.round(pause), limitMs: null };
        }
      }
    }
  }

  /* -- Die Liste -- */
  const lines: string[] = [
    ...removals.map((r) => (r.kind === 'lamp' ? `Usunięte urządzenie: ${r.title}.` : `Usunięty timer: ${r.title}.`)),
    ...lampLines,
    ...timerLines,
    ...(buttons === null ? [] : [`Tempo przycisków — przerwa: ${pauseText(buttons.pauseMs)} (było: ${pauseText(now.buttons.pauseMs)}).`])
  ];
  if (lines.length === 0) lines.push('Nic się nie zmieni — dokument zgadza się z tym, co jest zapisane.');
  const sameLamps = now.lamps.length - removedLamps.size - plannedLamps.filter((p) => p.existing !== null).length;
  const sameTimers = now.timers.length - removals.filter((r) => r.kind === 'timer').length - plannedTimers.filter((p) => p.existing !== null).length;
  if (sameLamps + sameTimers > 0) {
    lines.push(`Bez zmian: ${sameLamps} ${plural(sameLamps, 'urządzenie', 'urządzenia', 'urządzeń')}, ${sameTimers} ${plural(sameTimers, 'timer', 'timery', 'timerów')}.`);
  }
  const rows = now.lamps.length + now.timers.length - removals.length
    + plannedLamps.filter((p) => p.existing === null).length + plannedTimers.filter((p) => p.existing === null).length;
  if (rows > ROWS_MAX) warnings.push(`Razem byłoby ${rows} urządzeń i timerów — usługa przyjmie najwyżej ${ROWS_MAX}; nadmiarowe nowe się nie zapiszą.`);

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
      stage(`Usuwanie (${done + 1} z ${total})…`);
      await write.remove(one.id);
      removed.push(one.id);
      done += 1;
    }
    for (const one of plan.lamps) {
      stage(`Zapisywanie urządzeń (${done + 1} z ${total})…`);
      lamps.push(await write.saveLamp(one.id, one.data, one.existing?.version ?? 0));
      done += 1;
    }
    for (const one of plan.timers) {
      stage(`Zapisywanie timerów (${done + 1} z ${total})…`);
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
        name: 'Lampa w sypialni',
        number: '1',
        room: 'Sypialnia',
        note: 'Pilot z napisem HFKJ w pakiecie, identyfikator producenta 0x0000',
        protocol: 'ble-adv',
        signals: [
          { key: 'wlacz', label: 'Włącz', note: null, frames: [{ hex: ON, durationMs: 1000, gapMs: 0 }] },
          { key: 'wylacz', label: 'Wyłącz', note: null, frames: [{ hex: OFF, durationMs: 1000, gapMs: 0 }] }
        ]
      },
      {
        key: 'salon',
        name: 'Lampa w salonie',
        number: '2',
        room: 'Salon',
        note: null,
        protocol: 'ble-adv',
        signals: [
          { key: 'cieple', label: 'Ciepłe światło', note: null, frames: [{ hex: WARM, durationMs: 1000, gapMs: 0 }] },
          {
            key: 'noc', label: 'Tryb nocny', note: 'Najpierw przyciemnia, potem ciepłe światło',
            frames: [{ hex: DIM, durationMs: 600, gapMs: 300 }, { hex: WARM, durationMs: 600, gapMs: 0 }]
          }
        ]
      }
    ],
    timers: [
      {
        name: 'Rano', time: '06:45', days: ['pn', 'wt', 'śr', 'cz', 'pt'], enabled: true, pace: { pauseMs: 0, limitMs: null },
        actions: [{ lamp: '@sypialnia', signal: '@wlacz' }]
      },
      {
        name: 'Na noc', time: '23:00', days: [], enabled: true, pace: { pauseMs: 300, limitMs: 1000 },
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
      { name: 'Weekend rano', time: '08:30', days: ['so', 'nd'], actions: [{ lamp: 'Lampa w sypialni', signal: 'Włącz' }] },
      { name: 'Zmierzch', time: '17:15', days: [], actions: [{ lamp: 'Lampa w salonie', signal: 'Ciepłe światło' }] }
    ]
  };
}

/** Ändern und Löschen — nur, was sich ändert, mit den Kennungen aus dem Export (Platzhalter, kein Beispiel zum Einsetzen). */
const changeExample = (): Record<string, unknown> => ({
  format: LAMPS_FORMAT,
  version: LAMPS_VERSION,
  lamps: [{
    id: '<id urządzenia z eksportu>',
    room: 'Pokój dzieci',
    signals: [{ id: '<id sygnału>', label: 'Zgaś' }, { id: '<id innego sygnału>', remove: true }]
  }],
  timers: [{ id: '<id timera>', time: '07:15', enabled: false }, { id: '<id innego timera>', remove: true }]
});

/* -- Der Baum der Beschreibung ------------------------------------------------------------------------------------ */

const INTRO = (): string => `Lampy to urządzenia Bluetooth LE, którymi steruje telefon z aplikacją REcreatio (wydanie SMS na Androida): każde urządzenie ma przyciski — sygnały, czyli pakiety reklamy BLE wpisane ręcznie albo odczytane z pilota. Timery wysyłają sygnały o ustalonej godzinie. Dokument może zawierać wszystko (kopia zapasowa, przeniesienie na inne konto) albo tylko część — np. same timery przygotowane przez AI.
Co robi import:
- Najpierw pokazuje listę zmian z ostrzeżeniami; zapisuje dopiero „Importuj”. Zapis idzie tą samą drogą co zmiana ręczna: urządzenia i timery są szyfrowane w przeglądarce kluczem obszaru „Tylko ja”, a telefon, który wykonuje timery, od razu dostaje nowy plan.
- Wpis z "id" z eksportu zmienia się w miejscu — tylko klucze, które dokument podaje; pozostałe zostają, jak były. Wpis bez "id" (albo z "id", którego tu nie ma — np. z innego konta) powstaje jako nowy, z nowym "id" — przy każdym imporcie od nowa, więc do dalszych zmian weź świeży eksport.
- Niczego nie usuwa, chyba że wpis z "id" ma "remove": true — urządzenie, sygnał albo timer; lista zmian to pokazuje.
- Wpis z błędem (zły pakiet, brak godziny, akcja bez urządzenia) import pomija z ostrzeżeniem, resztę zapisuje. Nieznane klucze też dają ostrzeżenie.
- Czy TEN telefon wykonuje timery, ustawia się na telefonie (lista timerów) — dokument tego nie zawiera.
Limity: najwyżej ${ROWS_MAX} urządzeń i timerów razem, ${SIGNALS_MAX} sygnałów w urządzeniu, ${FRAMES_MAX} ramek w sygnale, ${ACTIONS_MAX} akcji w timerze.
Zwróć JEDEN obiekt JSON, bez komentarzy.
${keyLines(DOC_KEYS)}`;

/** Ein Paket: was Android senden kann (`adv.ts`). */
export const LAMP_FRAME_JSON: JsonNode = {
  key: 'lamps.frame',
  title: 'Ramka ("frames[]")',
  /* Erst ein Satz: der Abschnitt wird getrimmt (`sectionText`) — mit den Schlüsseln vorn verlöre die erste Zeile ihren Einzug. */
  text: () => `Ramka to jeden pakiet i to, jak długo go nadawać; ramki sygnału idą po kolei.
${keyLines(FRAME_KEYS)}
Pakiet to reklama BLE „legacy”: najwyżej ${LEGACY_MAX} bajtów, z jedną strukturą danych producenta — długość, FF, identyfikator producenta (2 bajty, little endian), dane; np. "1EFF0000…" to ${LEGACY_MAX} ${plural(LEGACY_MAX, 'bajt', 'bajty', 'bajtów')} z identyfikatorem 0x0000. Innych struktur (flagi, nazwy, UUID, dane usług) telefon nie nadaje — sygnał z nimi import pomija. Zera na końcu (wypełnienie z nasłuchu) nie są nadawane.`
};

export const LAMP_SIGNAL_JSON: JsonNode = {
  key: 'lamps.signal',
  title: 'Sygnał ("signals[]")',
  text: () => `Sygnał to przycisk: napis i to, co telefon nadaje po naciśnięciu — jedna ramka albo kilka po kolei (sekwencja). Krótkie naciśnięcie wysyła cały sygnał; przytrzymanie nadaje, dopóki trzyma się przycisk.
${keyLines(SIGNAL_KEYS)}
Sygnał z błędem (np. zły pakiet) import pomija z ostrzeżeniem — zmiana istniejącego sygnału wtedy nie wchodzi, reszta urządzenia się zapisuje.`,
  inside: () => [LAMP_FRAME_JSON]
};

export const LAMP_JSON: JsonNode = {
  key: 'lamps.lamp',
  title: 'Urządzenie ("lamps[]")',
  text: () => `Urządzenie porządkuje przyciski: nazwa, numer i pomieszczenie nie wybierają odbiornika — reklama BLE trafia do wszystkich lamp w zasięgu, a którą włączy, decydują bajty w pakiecie.
${keyLines(LAMP_KEYS)}
Sygnały istniejącego urządzenia: z "id" zmieniają się w miejscu, bez "id" dochodzą, niewymienione zostają. Gdy dokument wymienia WSZYSTKIE sygnały urządzenia, obowiązuje jego kolejność; gdy tylko część — nowe dochodzą na końcu. Urządzenia stoją na stronie według numeru, potem nazwy.`,
  inside: () => [LAMP_SIGNAL_JSON]
};

export const LAMP_ACTION_JSON: JsonNode = {
  key: 'lamps.action',
  title: 'Akcja timera ("actions[]")',
  text: () => `Akcja: który sygnał którego urządzenia wysłać.
${keyLines(ACTION_KEYS)}
"@klucz" to "key" urządzenia albo sygnału z tego dokumentu; działa też klucz, który eksport nadaje urządzeniu i sygnałowi (np. "@lampa-w-sypialni-nr-1", "@wlacz"), gdy samego urządzenia w dokumencie nie ma. Nazwy porównuje się bez wielkości liter i polskich znaków; nazwa musi wskazywać dokładnie jedno urządzenie (jeden sygnał) — inaczej akcja jest pomijana z ostrzeżeniem. Eksport zapisuje akcje jako "@klucz".`
};

export const LAMP_PACE_JSON: JsonNode = {
  key: 'lamps.pace',
  title: 'Tempo ("pace", "buttons")',
  text: () => `Tempo zwalnia nadawanie, nie zmieniając zapisanych sygnałów. W timerze: { "pauseMs", "limitMs" }; w "buttons" (przyciski i próby nadania, zapamiętane na koncie) tylko "pauseMs" — jak długo nadaje przycisk, decyduje przytrzymanie.
${keyLines(PACE_KEYS)}`
};

export const LAMP_TIMER_JSON: JsonNode = {
  key: 'lamps.timer',
  title: 'Timer ("timers[]")',
  text: () => `Timer wysyła o danej godzinie, w wybrane dni tygodnia, sygnały po kolei. Wykonuje go telefon z aplikacją REcreatio (wydanie SMS), na którym timery są włączone — także przy zamkniętej aplikacji.
${keyLines(TIMER_KEYS)}
Przy zmianie istniejącego timera wystarczy "id" i to, co się zmienia (np. {"id": "…", "enabled": false}). Timer ze złą godziną, złymi dniami albo bez akcji, która coś wskazuje, import pomija (istniejący zostaje bez zmian).`,
  inside: () => [LAMP_ACTION_JSON, LAMP_PACE_JSON]
};

/** 2026-10-29 — DIE LAMPEN ALS JSON: der Baum, aus dem die Beschreibung neben dem Import entsteht (und der Katalog des MCP-Dienstes). */
export const LAMPS_JSON: JsonNode = {
  key: 'lamps',
  title: `Lampy jako JSON ("${LAMPS_FORMAT}", wersja ${LAMPS_VERSION})`,
  short: 'Lampy',
  text: INTRO,
  inside: () => [
    LAMP_JSON,
    LAMP_TIMER_JSON,
    textNode('lamps.example', 'Przykład: dwie lampy i dwa timery', () => pretty(lampsExample())),
    textNode('lamps.example-timers', 'Przykład: same timery dla lamp, które już są', () =>
      `Bez identyfikatorów — urządzenia i sygnały po nazwie (tak napisze je AI, które nie widziało eksportu):\n${pretty(timersExample())}`),
    textNode('lamps.example-change', 'Przykład: zmiana i usunięcie', () =>
      `Identyfikatory z eksportu; zmienia się tylko to, co podane:\n${pretty(changeExample())}`)
  ],
  samples: () => [
    { label: 'dwie lampy z sygnałami i dwa timery', doc: lampsExample },
    { label: 'same timery dla lamp, które już są (np. od AI)', doc: timersExample }
  ]
};

export const lampsDescription = (): string => describe(LAMPS_JSON);
