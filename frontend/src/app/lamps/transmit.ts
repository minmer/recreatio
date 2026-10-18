/**
 * SENDEN (2026-10-18) — ein Sygnał einer Lampe über den Sender des Telefons,
 * einer nach dem anderen, mit einem Protokoll der Versuche.
 *
 * <code>
 *   1. die Ramki prüfen und in das umbauen, was Android nimmt (adv.ts)
 *   2. Bluetooth da, an, Werben möglich?   (support)
 *   3. die Erlaubnis — sonst fragen         (requestPermission)
 *   4. senden, auf den Rückruf warten, halten, stoppen  (send — im Telefon)
 * </code>
 *
 * <b>Nacheinander.</b> Ein zweiter Druck wartet, bis der erste fertig ist —
 * zwei Werbungen zugleich wären zwei Pakete, die sich gegenseitig stören. Man
 * darf also weiterdrücken, auch während gesendet wird: jeder Druck steht gleich
 * als „Czeka" im Protokoll und geht hinaus, wenn er dran ist. „Stop" (und das
 * Verlassen der App) bricht das Laufende ab und streicht, was noch wartet.
 *
 * <b>„Nadano" heisst: Android hat gestartet und gestoppt.</b> Ob eine Lampe es
 * gehört und getan hat, weiss das Telefon nicht; im Protokoll lässt sich von
 * Hand vermerken, ob sie reagiert hat.
 *
 * Das Protokoll lebt nur in dieser Karte (die letzten {@link HISTORY_MAX}) —
 * es soll beim Ausprobieren helfen, nicht etwas festhalten.
 */

import { hexOf, readFrame } from './adv';
import type { LampData, LampSignal } from './lampStore';
import { lampTitle, signalProblem } from './lampStore';
import type { LampCode, LampNative, LampSupport, NativeFrame, NativeSendResult } from './native';

export type AttemptState = 'queued' | 'sending' | 'sent' | 'failed' | 'stopped';

export interface AttemptFrame {
  /** Das Paket, wie es in der Luft stehen soll (ohne Füllsel). */
  readonly hex: string;
  readonly size: number;
  readonly manufacturerId: number | null;
  readonly durationMs: number;
  readonly gapMs: number;
}

export interface Attempt {
  readonly id: string;
  readonly at: number;
  readonly lamp: string;
  readonly signal: string;
  readonly frames: readonly AttemptFrame[];
  readonly state: AttemptState;
  readonly code: LampCode | null;
  /** Was der Mensch liest. */
  readonly message: string | null;
  /** Was Android dazu sagte — für die Fehlersuche. */
  readonly detail: string | null;
  readonly result: NativeSendResult | null;
  /** Abweichungen von den gewünschten Zeiten. */
  readonly timing: readonly string[];
  /** Von Hand: hat die Lampe reagiert? */
  readonly responded: boolean | null;
}

export const HISTORY_MAX = 30;

const CODE_TEXT: Readonly<Record<LampCode, string>> = {
  'ok': 'Nadano: Android potwierdził start reklamy i ją zatrzymał. Czy lampa zareagowała — tego telefon nie wie.',
  'no-bluetooth': 'Ten telefon nie ma Bluetooth.',
  'bluetooth-off': 'Bluetooth jest wyłączony — włącz go i spróbuj ponownie.',
  'no-advertiser': 'Ten telefon nie potrafi nadawać reklam BLE (Android nie daje nadajnika).',
  'no-permission': 'Bez zgody na „Urządzenia w pobliżu" aplikacja nie może nadawać.',
  'data-too-large': 'Android odrzucił pakiet jako za duży (ADVERTISE_FAILED_DATA_TOO_LARGE).',
  'too-many-advertisers': 'Android: za dużo reklam naraz (ADVERTISE_FAILED_TOO_MANY_ADVERTISERS) — może nadaje inna aplikacja.',
  'already-started': 'Android: ta reklama już trwa (ADVERTISE_FAILED_ALREADY_STARTED).',
  'internal-error': 'Android: wewnętrzny błąd Bluetooth (ADVERTISE_FAILED_INTERNAL_ERROR).',
  'feature-unsupported': 'Android: ten telefon nie obsługuje takiej reklamy (ADVERTISE_FAILED_FEATURE_UNSUPPORTED).',
  'no-callback': 'Android nie potwierdził startu w ciągu 3 s — nadawanie przerwano.',
  'stopped': 'Zatrzymano.',
  'paused': 'Przerwano — aplikacja zeszła z ekranu.',
  'bad-frame': 'Tego sygnału nie da się nadać.',
  'error': 'Nadawanie się nie udało.',
  'unavailable': 'Nadawać może tylko telefon z aplikacją REcreatio (wydanie sms). Tutaj można sygnały ustawiać.'
};

export const codeText = (code: LampCode): string => CODE_TEXT[code] ?? CODE_TEXT.error;

export const stateOf = (code: LampCode): AttemptState =>
  code === 'ok' ? 'sent' : code === 'stopped' || code === 'paused' ? 'stopped' : 'failed';

/** Was das Senden am Telefon verhindert, bevor es versucht wird — `null`: es geht. */
export function supportProblem(s: LampSupport): LampCode | null {
  if (!s.bluetooth) return 'no-bluetooth';
  if (!s.enabled) return 'bluetooth-off';
  if (!s.advertiser) return 'no-advertiser';
  return null;
}

/* -- Ramki für Android ------------------------------------------------------------------------ */

export interface Prepared {
  readonly frames: readonly NativeFrame[];
  readonly shown: readonly AttemptFrame[];
  readonly problem: string | null;
}

/** Ein Sygnał → was der Sender bekommt: je Ramka Kennung und Daten des Herstellers. */
export function prepareSignal(signal: LampSignal): Prepared {
  const shown: AttemptFrame[] = [];
  const frames: NativeFrame[] = [];
  for (const f of signal.frames) {
    const read = readFrame(f.hex);
    const air = read.advertising === null ? read.hex : hexOf(read.advertising.bytes.slice(0, read.advertising.bytes.length - read.advertising.padding));
    shown.push({
      hex: air,
      size: read.advertising === null ? Math.floor(read.hex.length / 2) : read.advertising.bytes.length - read.advertising.padding,
      manufacturerId: read.advertising?.manufacturer?.id ?? null,
      durationMs: f.durationMs,
      gapMs: f.gapMs
    });
    if (read.manufacturer !== null) {
      frames.push({ manufacturerId: read.manufacturer.id, data: hexOf(read.manufacturer.data), durationMs: f.durationMs, gapMs: f.gapMs });
    }
  }
  return { frames, shown, problem: signalProblem(signal) };
}

/** Wo die Zeiten anders waren als gewünscht (ab 100 ms Unterschied) — Android hält sie nur ungefähr. */
export function timingNotes(shown: readonly AttemptFrame[], result: NativeSendResult): string[] {
  const out: string[] = [];
  const many = shown.length > 1;
  const name = (i: number) => (many ? `Ramka ${i + 1}: ` : '');
  result.frames.forEach((r, i) => {
    if (r.startMs !== undefined && r.startMs > 200) out.push(`${name(i)}Android potrzebował ${r.startMs} ms na start.`);
    if (r.heldMs !== undefined && r.code === 'ok' && Math.abs(r.heldMs - r.requestedMs) >= 100) {
      out.push(`${name(i)}nadawana ${r.heldMs} ms zamiast ${r.requestedMs} ms.`);
    }
    const next = result.frames[i + 1];
    if (next?.startedAt !== undefined && r.stoppedAt !== undefined) {
      const gap = next.startedAt - r.stoppedAt;
      const wanted = shown[i]?.gapMs ?? 0;
      if (Math.abs(gap - wanted) >= 100) out.push(`Między ramką ${i + 1} a ${i + 2}: ${gap} ms zamiast ${wanted} ms.`);
    }
  });
  return out;
}

/* -- Das Protokoll ---------------------------------------------------------------------------- */

let attempts: readonly Attempt[] = [];
const listeners = new Set<() => void>();

export const attemptsNow = (): readonly Attempt[] => attempts;

export function subscribeAttempts(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Neu: vorn; schon da: an seiner Stelle (die Reihenfolge ist die der Drücke). */
function put(next: Attempt): Attempt {
  attempts = attempts.some((a) => a.id === next.id)
    ? attempts.map((a) => (a.id === next.id ? next : a))
    : [next, ...attempts].slice(0, HISTORY_MAX);
  for (const one of listeners) one();
  return next;
}

/** Von Hand: hat die Lampe reagiert? (`null`: nicht vermerkt) */
export function markResponded(id: string, responded: boolean | null): void {
  const had = attempts.find((a) => a.id === id);
  if (had !== undefined) put({ ...had, responded });
}

/** Für die Prüfungen. */
export function forgetAttempts(): void {
  attempts = [];
  for (const one of listeners) one();
}

/* -- Senden --------------------------------------------------------------------------------- */

let queue: Promise<unknown> = Promise.resolve();
let counter = 0;
/** Zählt bei „Stop" (und beim Verlassen der App) hoch — was davor gedrückt wurde und noch wartet, entfällt. */
let epoch = 0;

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : typeof e === 'string' ? e : 'Nieznany błąd.');

/**
 * Einen Sygnał senden — nach allen, die schon warten. `radio` ist der Sender
 * (`LampRadio`) oder `null` im Browser. Wirft nie: wie es ausging, steht im Versuch.
 */
export function transmit(radio: LampNative | null, lamp: Pick<LampData, 'name' | 'number'>, signal: LampSignal): Promise<Attempt> {
  const prepared = prepareSignal(signal);
  const queued = put({
    id: `t${++counter}-${Date.now()}`,
    at: Date.now(),
    lamp: lampTitle(lamp),
    signal: signal.label.trim() || 'Sygnał',
    frames: prepared.shown,
    state: 'queued',
    code: null,
    message: null,
    detail: null,
    result: null,
    timing: [],
    responded: null
  });
  const mine = epoch;
  const run = queue.then(() => sendOne(radio, queued, prepared, mine));
  queue = run.catch(() => undefined);
  return run;
}

/** Was noch wartet, entfällt — mit diesem Grund (`stopped`, `paused`). */
function dropQueue(code: LampCode): void {
  epoch++;
  for (const a of attempts) {
    if (a.state === 'queued') put({ ...a, state: stateOf(code), code, message: codeText(code) });
  }
}

async function sendOne(radio: LampNative | null, queued: Attempt, prepared: Prepared, mine: number): Promise<Attempt> {
  const finish = (code: LampCode, detail: string | null = null, result: NativeSendResult | null = null, message: string | null = null): Attempt =>
    put({
      ...(attempts.find((a) => a.id === queued.id) ?? queued),
      state: stateOf(code),
      code,
      message: message ?? codeText(code),
      detail,
      result,
      timing: result === null ? [] : timingNotes(prepared.shown, result)
    });

  if (mine !== epoch) {
    /* Gestrichen (Stop, App verlassen) — mit dem Grund, den es beim Streichen bekam. */
    const dropped = attempts.find((a) => a.id === queued.id);
    return dropped !== undefined && dropped.state !== 'queued' ? dropped : finish('stopped');
  }
  put({ ...(attempts.find((a) => a.id === queued.id) ?? queued), state: 'sending' });
  if (prepared.problem !== null) return finish('bad-frame', null, null, prepared.problem);
  if (radio === null) return finish('unavailable');

  try {
    const support = await radio.support();
    const blocked = supportProblem(support);
    if (blocked !== null) return finish(blocked);
    if (support.permission !== 'granted') {
      const { granted } = await radio.requestPermission();
      if (!granted) return finish('no-permission');
    }
    const result = await radio.send({ frames: prepared.frames });
    /* Die App ist vom Bildschirm gegangen: was danach noch wartete, geht auch nicht mehr hinaus. */
    if (result.code === 'paused') dropQueue('paused');
    return finish(result.code, result.detail, result, result.code === 'bad-frame' && result.detail !== null ? result.detail : null);
  } catch (e) {
    return finish('error', messageOf(e));
  }
}

/** Das Laufende abbrechen — und alles, was noch wartet. */
export async function stopTransmission(radio: LampNative | null): Promise<void> {
  dropQueue('stopped');
  if (radio === null) return;
  try {
    await radio.stop();
  } catch {
    // Nichts zu stoppen.
  }
}
