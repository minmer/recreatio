/**
 * DIE LAMPEN (2026-10-18, 0118) — jede Lampe mit ihren Sygnały als EINE Hülle
 * im eigenen Bereich (`/workspace/phone/<bereich>/lamps`, `app.phone_lamp`).
 * Der Dienst sieht nur, dass es sie gibt.
 *
 * <b>Eine Lampe ist ein Name, kein Empfänger.</b> Name, Nummer und Raum ordnen
 * nur die Knöpfe. Eine BLE-Werbung geht an alle in Reichweite; welche Lampe
 * reagiert, entscheiden die Bytes im Paket (eine Kennung, ein Zähler — je nach
 * Hersteller), nicht die Wahl hier.
 *
 * <b>Timer</b> (2026-10-18) stehen in derselben Tabelle, je Timer eine Hülle mit
 * `kind: 'timer'` — der Dienst unterscheidet nicht, er sieht ohnehin nur Hüllen.
 * Ein Timer nennt Uhrzeit, Wochentage und Aktionen (Gerät + Sygnał), nicht die
 * Bytes: ändert man einen Sygnał, gilt er auch im Timer (`timers.ts` rechnet daraus
 * den Plan für das Telefon).
 *
 * <b>Später</b> (Abläufe, Vorlagen je Protokoll) kommen als weitere Schlüssel in
 * dieselbe Hülle (`v`) oder als weitere `kind`; `protocol` sagt, wie die Ramki zu
 * lesen sind (heute nur `ble-adv`: rohe Legacy-Werbung).
 */

import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from '../core/crypto';
import { newId } from '../core/ids';
import { call, WorkspaceError } from '../core/session';
import type { PhoneCtx } from '../phone/phoneContext';
import { viewPath } from '../routes';
import { normalizeHex, readFrame } from './adv';

/** Die Wörter im Weg (`#/workspace/lamps/…`): ein neues Gerät, der Pilot, ein Timer (`timer/<kennung>`, `timer/nowy`). */
export const NEW_LAMP = 'nowe';
export const PILOT = 'pilot';
export const TIMER = 'timer';
export const NEW_TIMER = 'nowy';

export const timerPath = (timerId: string = NEW_TIMER): string => viewPath('lamps', TIMER, timerId);

/** Vom Pilot lernen — mit `lampId` gleich für dieses Gerät. */
export const pilotPath = (lampId?: string): string =>
  `${viewPath('lamps', PILOT)}${lampId === undefined ? '' : `?lampa=${encodeURIComponent(lampId)}`}`;

export interface LampFrame {
  /** Das ganze Werbepaket, hex, wie nRF Connect es zeigt (`1EFF0000…`). */
  readonly hex: string;
  readonly durationMs: number;
  /** Pause nach dieser Ramka (nur zwischen Ramki). */
  readonly gapMs: number;
}

export interface LampSignal {
  readonly id: string;
  /** Was auf dem Knopf steht: „Włącz", „Ciepłe światło". */
  readonly label: string;
  readonly note: string | null;
  readonly frames: readonly LampFrame[];
}

export interface LampData {
  readonly name: string;
  /** Die Nummer des Geräts — frei, wie man die Lampen zählt. */
  readonly number: string | null;
  readonly room: string | null;
  readonly note: string | null;
  readonly protocol: 'ble-adv';
  readonly signals: readonly LampSignal[];
}

export interface Lamp extends LampData {
  readonly id: string;
  readonly version: number;
  readonly updatedAt: string;
}

/** Was ein Timer tut: einen Sygnał eines Geräts senden. */
export interface LampTimerAction {
  readonly lampId: string;
  readonly signalId: string;
}

export interface LampTimerData {
  readonly name: string;
  /** Minute des Tages, 0…1439 (Ortszeit des Telefons). */
  readonly minute: number;
  /** 1 = Montag … 7 = Sonntag; leer = jeden Tag. */
  readonly days: readonly number[];
  readonly enabled: boolean;
  /** Nacheinander, in dieser Reihenfolge. */
  readonly actions: readonly LampTimerAction[];
}

export interface LampTimer extends LampTimerData {
  readonly id: string;
  readonly version: number;
  readonly updatedAt: string;
}

interface LampRow {
  readonly lampId: string;
  readonly epoch: number;
  readonly sealed: string;
  readonly version: number;
  readonly updatedAt: string;
}

/* Die Grenzen: so, dass Android sie halten kann — kein Versprechen auf Millisekunden. */
export const DURATION_DEFAULT = 1000;
export const DURATION_MIN = 100;
export const DURATION_MAX = 30_000;
export const GAP_MAX = 10_000;
export const FRAMES_MAX = 20;
export const SIGNALS_MAX = 100;
export const ACTIONS_MAX = 20;

const lampAad = (id: string) => aad('phone', 'lamp', id, Field.PhoneLamp, 1);
const base = (ctx: PhoneCtx) => `/workspace/phone/${encodeURIComponent(ctx.areaId)}`;

const text = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
};

const whole = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

export const emptyFrame = (hex = ''): LampFrame => ({ hex, durationMs: DURATION_DEFAULT, gapMs: 0 });
export const emptySignal = (label = ''): LampSignal => ({ id: newId(), label, note: null, frames: [emptyFrame()] });
export const emptyLamp = (): LampData => ({ name: '', number: null, room: null, note: null, protocol: 'ble-adv', signals: [] });

/** Aufgeräumt: getrimmt, hex in einer Form (wo es lesbar ist), Zeiten ganze Zahlen. Grenzen prüft `lampProblems`. */
export function tidyLamp(d: LampData): LampData {
  return {
    name: d.name.trim(),
    number: text(d.number),
    room: text(d.room),
    note: text(d.note),
    protocol: 'ble-adv',
    signals: d.signals.map((s) => ({
      id: s.id,
      label: s.label.trim(),
      note: text(s.note),
      frames: s.frames.map((f) => {
        const read = normalizeHex(f.hex);
        return {
          hex: read.problem === null ? read.hex : f.hex.trim(),
          durationMs: whole(f.durationMs, DURATION_DEFAULT),
          gapMs: Math.max(0, whole(f.gapMs, 0))
        };
      })
    }))
  };
}

/** Was eine Ramka am Senden hindert — `null`: sie geht. */
export function frameProblem(f: LampFrame): string | null {
  const read = readFrame(f.hex);
  if (read.problem !== null) return read.problem;
  if (!Number.isFinite(f.durationMs) || f.durationMs < DURATION_MIN || f.durationMs > DURATION_MAX) {
    return `Czas nadawania od ${DURATION_MIN} do ${DURATION_MAX} ms.`;
  }
  if (!Number.isFinite(f.gapMs) || f.gapMs < 0 || f.gapMs > GAP_MAX) return `Przerwa od 0 do ${GAP_MAX} ms.`;
  return null;
}

/** Was ein Sygnał am Senden hindert — `null`: er geht. */
export function signalProblem(s: LampSignal): string | null {
  if (s.label.trim() === '') return 'Podaj nazwę sygnału (napis na przycisku).';
  if (s.frames.length === 0) return 'Sygnał potrzebuje co najmniej jednej ramki.';
  if (s.frames.length > FRAMES_MAX) return `Najwyżej ${FRAMES_MAX} ramek w sygnale.`;
  for (let i = 0; i < s.frames.length; i++) {
    const problem = frameProblem(s.frames[i]);
    if (problem !== null) return s.frames.length === 1 ? problem : `Ramka ${i + 1}: ${problem}`;
  }
  return null;
}

/** Alles, was das Speichern verhindert — leer: es geht. */
export function lampProblems(d: LampData): string[] {
  const out: string[] = [];
  if (d.name.trim() === '' && (d.number ?? '').trim() === '') out.push('Podaj nazwę albo numer urządzenia.');
  if (d.signals.length > SIGNALS_MAX) out.push(`Najwyżej ${SIGNALS_MAX} sygnałów na urządzenie.`);
  d.signals.forEach((s, i) => {
    const problem = signalProblem(s);
    if (problem !== null) out.push(`${s.label.trim() || `Sygnał ${i + 1}`}: ${problem}`);
  });
  return out;
}

/** Wie die Lampe heisst, wo sie steht: „Lampa w sypialni · nr 3". */
export const lampTitle = (d: Pick<LampData, 'name' | 'number'>): string =>
  [d.name.trim() || null, d.number !== null && d.number.trim() !== '' ? `nr ${d.number.trim()}` : null].filter(Boolean).join(' · ') || 'Bez nazwy';

/** Was in die Hülle kommt — ohne Kennung und Fassung (die stehen neben ihr). */
export const sealedJson = (d: LampData): string => JSON.stringify({ v: 1, kind: 'device', ...tidyLamp(d) });

/* -- Timer ------------------------------------------------------------------------------------ */

export const emptyTimer = (): LampTimerData => ({ name: '', minute: 7 * 60, days: [], enabled: true, actions: [] });

export function tidyTimer(d: LampTimerData): LampTimerData {
  return {
    name: d.name.trim(),
    minute: whole(d.minute, -1),
    days: [...new Set(d.days.map((n) => whole(n, 0)).filter((n) => n >= 1 && n <= 7))].sort((a, b) => a - b),
    enabled: d.enabled !== false,
    actions: d.actions.filter((a) => typeof a.lampId === 'string' && typeof a.signalId === 'string').map((a) => ({ lampId: a.lampId, signalId: a.signalId }))
  };
}

export const sealedTimerJson = (d: LampTimerData): string => JSON.stringify({ v: 1, kind: 'timer', ...tidyTimer(d) });

export function readTimer(json: string): LampTimerData {
  const o = JSON.parse(json) as Record<string, unknown>;
  const actions = Array.isArray(o.actions) ? o.actions.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object') : [];
  return tidyTimer({
    name: String(o.name ?? ''),
    minute: whole(o.minute, -1),
    days: Array.isArray(o.days) ? o.days.map((n) => whole(n, 0)) : [],
    enabled: o.enabled !== false,
    actions: actions.map((a) => ({ lampId: String(a.lampId ?? ''), signalId: String(a.signalId ?? '') }))
  });
}

/** Die Aktion beim Namen: Gerät und Sygnał — `null`, wenn es eins davon nicht mehr gibt. */
export function actionOf(lamps: readonly Lamp[], a: LampTimerAction): { readonly lamp: Lamp; readonly signal: LampSignal } | null {
  const lamp = lamps.find((l) => l.id === a.lampId);
  const signal = lamp?.signals.find((s) => s.id === a.signalId);
  return lamp === undefined || signal === undefined ? null : { lamp, signal };
}

/** Alles, was das Speichern eines Timers verhindert — leer: es geht. */
export function timerProblems(d: LampTimerData, lamps: readonly Lamp[]): string[] {
  const out: string[] = [];
  if (!Number.isInteger(d.minute) || d.minute < 0 || d.minute >= 24 * 60) out.push('Podaj godzinę.');
  if (d.actions.length === 0) out.push('Dodaj co najmniej jedną akcję (urządzenie i sygnał).');
  if (d.actions.length > ACTIONS_MAX) out.push(`Najwyżej ${ACTIONS_MAX} akcji w timerze.`);
  d.actions.forEach((a, i) => {
    if (actionOf(lamps, a) === null) out.push(`Akcja ${i + 1}: tego urządzenia albo sygnału już nie ma.`);
  });
  return out;
}

const two = (n: number) => String(n).padStart(2, '0');

/** 420 → „07:00". */
export const timeText = (minute: number): string =>
  (Number.isInteger(minute) && minute >= 0 && minute < 1440 ? `${two(Math.floor(minute / 60))}:${two(minute % 60)}` : '');

/** „7:05", „07:05" → 425; sonst `null`. */
export function minuteOf(text: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(text);
  if (m === null) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

/** Wie der Timer heisst: sein Name oder seine Uhrzeit. */
export const timerTitle = (d: LampTimerData): string => d.name.trim() || `Timer ${timeText(d.minute)}`;

export function readLamp(json: string): LampData {
  const o = JSON.parse(json) as Record<string, unknown>;
  const list = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object') : [];
  return tidyLamp({
    name: String(o.name ?? ''),
    number: text(o.number),
    room: text(o.room),
    note: text(o.note),
    protocol: 'ble-adv',
    signals: list(o.signals).map((s) => ({
      id: text(s.id) ?? newId(),
      label: String(s.label ?? ''),
      note: text(s.note),
      frames: list(s.frames).map((f) => ({
        hex: String(f.hex ?? ''),
        durationMs: whole(f.durationMs, DURATION_DEFAULT),
        gapMs: whole(f.gapMs, 0)
      }))
    }))
  });
}

/** Eine Abschrift — neue Kennungen für die Sygnały, damit nichts doppelt heisst. */
export const copyOf = (d: LampData): LampData => ({
  ...d,
  name: d.name.trim() === '' ? d.name : `${d.name.trim()} (kopia)`,
  signals: d.signals.map((s) => ({ ...s, id: newId() }))
});

const collator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true });

/** Nach Nummer, dann nach Namen. */
export const lampOrder = (a: LampData, b: LampData): number =>
  collator.compare(a.number ?? '￿', b.number ?? '￿') || collator.compare(a.name, b.name);

/* -- Der Dienst ------------------------------------------------------------------------------- */

/** Alle Geräte (nach Nummer, dann Name) und alle Timer (nach Uhrzeit) — aus einer Liste von Hüllen. */
export async function loadLamps(ctx: PhoneCtx): Promise<{ lamps: Lamp[]; timers: LampTimer[] }> {
  const { lamps: rows } = await call<{ lamps: readonly LampRow[] }>(`${base(ctx)}/lamps`);
  const lamps: Lamp[] = [];
  const timers: LampTimer[] = [];
  for (const row of rows) {
    const key = ctx.keys.get(row.epoch);
    if (key === undefined) continue;
    try {
      const json = await openText(key, lampAad(row.lampId), fromBase64Url(row.sealed));
      const meta = { id: row.lampId, version: row.version, updatedAt: row.updatedAt };
      if ((JSON.parse(json) as { kind?: unknown }).kind === 'timer') timers.push({ ...readTimer(json), ...meta });
      else lamps.push({ ...readLamp(json), ...meta });
    } catch {
      // Eine Hülle, die nicht aufgeht, hält die anderen nicht auf.
    }
  }
  return { lamps: lamps.sort(lampOrder), timers: timers.sort(timerOrder) };
}

/** Nach Uhrzeit, dann Name. */
export const timerOrder = (a: LampTimerData, b: LampTimerData): number => a.minute - b.minute || collator.compare(a.name, b.name);

/** Speichern — neu (`id` null) oder geändert (auf dem Stand `version`). */
export async function saveLamp(ctx: PhoneCtx, id: string | null, data: LampData, version: number): Promise<Lamp> {
  const lampId = id ?? newId();
  const tidy = tidyLamp(data);
  const sealed = toBase64Url(await sealText(ctx.newest.key, lampAad(lampId), sealedJson(tidy)));
  const saved = await call<{ version: number; updatedAt: string }>(`${base(ctx)}/lamp/${encodeURIComponent(lampId)}`, {
    method: 'PUT', body: JSON.stringify({ epoch: ctx.newest.epoch, sealed, version })
  });
  return { ...tidy, id: lampId, version: saved.version, updatedAt: saved.updatedAt };
}

/** Einen Timer speichern — neu (`id` null) oder geändert (auf dem Stand `version`). */
export async function saveTimer(ctx: PhoneCtx, id: string | null, data: LampTimerData, version: number): Promise<LampTimer> {
  const timerId = id ?? newId();
  const tidy = tidyTimer(data);
  const sealed = toBase64Url(await sealText(ctx.newest.key, lampAad(timerId), sealedTimerJson(tidy)));
  const saved = await call<{ version: number; updatedAt: string }>(`${base(ctx)}/lamp/${encodeURIComponent(timerId)}`, {
    method: 'PUT', body: JSON.stringify({ epoch: ctx.newest.epoch, sealed, version })
  });
  return { ...tidy, id: timerId, version: saved.version, updatedAt: saved.updatedAt };
}

/** Ein Gerät oder einen Timer löschen (dieselbe Tabelle). */
export const removeItem = (ctx: PhoneCtx, id: string): Promise<{ deleted: boolean }> =>
  call(`${base(ctx)}/lamp/${encodeURIComponent(id)}`, { method: 'DELETE' });

export function lampSaveProblem(e: unknown): string {
  if (e instanceof WorkspaceError) {
    if (e.verdict === 'stale') return 'Ktoś zmienił to w międzyczasie — wczytaj stronę ponownie.';
    return e.message;
  }
  return 'Nie udało się zapisać urządzenia.';
}
