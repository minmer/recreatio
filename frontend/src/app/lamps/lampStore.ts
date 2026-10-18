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
 * <b>Später</b> (Zeitpläne, Abläufe, Vorlagen je Protokoll) kommen als weitere
 * Schlüssel in dieselbe Hülle (`v`) oder als eigene Zeilen; `protocol` sagt,
 * wie die Ramki zu lesen sind (heute nur `ble-adv`: rohe Legacy-Werbung).
 */

import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from '../core/crypto';
import { newId } from '../core/ids';
import { call, WorkspaceError } from '../core/session';
import type { PhoneCtx } from '../phone/phoneContext';
import { viewPath } from '../routes';
import { normalizeHex, readFrame } from './adv';

/** Die Wörter im Weg (`#/workspace/lamps/…`): ein neues Gerät, der Pilot. */
export const NEW_LAMP = 'nowe';
export const PILOT = 'pilot';

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
export const sealedJson = (d: LampData): string => JSON.stringify({ v: 1, ...tidyLamp(d) });

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

export async function loadLamps(ctx: PhoneCtx): Promise<Lamp[]> {
  const { lamps } = await call<{ lamps: readonly LampRow[] }>(`${base(ctx)}/lamps`);
  const out: Lamp[] = [];
  for (const row of lamps) {
    const key = ctx.keys.get(row.epoch);
    if (key === undefined) continue;
    try {
      const data = readLamp(await openText(key, lampAad(row.lampId), fromBase64Url(row.sealed)));
      out.push({ ...data, id: row.lampId, version: row.version, updatedAt: row.updatedAt });
    } catch {
      // Eine Hülle, die nicht aufgeht, hält die anderen nicht auf.
    }
  }
  return out.sort(lampOrder);
}

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

export const removeLamp = (ctx: PhoneCtx, id: string): Promise<{ deleted: boolean }> =>
  call(`${base(ctx)}/lamp/${encodeURIComponent(id)}`, { method: 'DELETE' });

export function lampSaveProblem(e: unknown): string {
  if (e instanceof WorkspaceError) {
    if (e.verdict === 'stale') return 'Ktoś zmienił to urządzenie w międzyczasie — wczytaj je ponownie.';
    return e.message;
  }
  return 'Nie udało się zapisać urządzenia.';
}
