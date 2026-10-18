/**
 * VOM PILOT LERNEN (2026-10-18) — das Telefon hört zu (BLE-Scan im Baustein
 * `Lamp`), man drückt auf dem Pilot, und hier wird gesucht, was er sendet.
 *
 * <code>
 *   Pakete      was das Telefon hört: Absender, Stärke (RSSI), Inhalt, Zeit
 *   Absender    nach Stärke geordnet — der Pilot liegt am Telefon, er ist der Stärkste
 *   Läufe       dasselbe Paket hintereinander (ein Pilot wiederholt es, solange man drückt)
 *   Muster      ein Paket immer wieder · ein Kreis aus mehreren · sonst das häufigste
 * </code>
 *
 * Dieselbe Rechnung nimmt einen Mitschnitt aus nRF Connect (Zeilen
 * `2026-10-18 03:27:06.277, -29 dBm, 0x1EFF…`) — dann ist alles ein Absender.
 *
 * <b>Die Adresse des Pilots ist nur ein Wegweiser.</b> Viele Piloten wechseln
 * sie (zufällige Adressen); das Telefon sendet ohnehin mit seiner eigenen.
 */

import { normalizeHex, significantHex } from './adv';
import { DURATION_DEFAULT, type LampFrame } from './lampStore';
import type { NativePacket, ScanCode } from './native';

export interface Packet {
  readonly address: string;
  readonly rssi: number;
  /** Der Inhalt ohne Füllsel, hex. */
  readonly hex: string;
  /** Uhrzeit in ms. */
  readonly at: number;
  readonly name: string | null;
}

export interface Source {
  readonly address: string;
  readonly name: string | null;
  readonly count: number;
  /** Die stärksten drei gemittelt — ein einzelner Ausreisser macht keinen Pilot. */
  readonly strength: number;
  readonly peakRssi: number;
  readonly lastRssi: number;
  readonly firstAt: number;
  readonly lastAt: number;
  readonly lastHex: string;
  /** Wie viele verschiedene Pakete. */
  readonly distinct: number;
}

export interface Run {
  readonly hex: string;
  readonly count: number;
  readonly firstAt: number;
  readonly lastAt: number;
  readonly peakRssi: number;
}

export type PatternKind = 'single' | 'cycle' | 'dominant' | 'none';

export interface Pattern {
  readonly kind: PatternKind;
  /** Die Läufe eines Durchgangs — das, was ein Sygnał wird. */
  readonly runs: readonly Run[];
  /** Wo sie in der Liste der Läufe stehen (zum Vorwählen). */
  readonly at: readonly number[];
  /** Wie oft der Durchgang vorkam (bei `cycle`) oder wie oft das Paket (sonst). */
  readonly repeats: number;
}

/** Ein Paket des Telefons → ein Paket hier (Füllsel ab, nur Lesbares). */
export function packetOf(p: NativePacket): Packet | null {
  const read = normalizeHex(p.hex);
  if (read.problem !== null) return null;
  const hex = significantHex(read.hex);
  if (hex === '') return null;
  return { address: p.address, rssi: p.rssi, hex, at: p.at, name: p.name };
}

/* -- Der Mitschnitt ------------------------------------------------------------------------- */

interface SourceAcc {
  address: string;
  name: string | null;
  count: number;
  top: number[];
  peakRssi: number;
  lastRssi: number;
  firstAt: number;
  lastAt: number;
  lastHex: string;
  seen: Set<string>;
  packets: Packet[];
}

/**
 * Alles, was gehört wurde — nach Absendern sortiert, während es ankommt.
 * Höchstens {@link Capture.MAX} Pakete; danach fallen bei jedem Absender die ältesten weg.
 */
export class Capture {
  static readonly MAX = 40_000;
  private readonly by = new Map<string, SourceAcc>();
  private total = 0;

  get size(): number {
    return this.total;
  }

  add(packets: readonly Packet[]): void {
    for (const p of packets) {
      let acc = this.by.get(p.address);
      if (acc === undefined) {
        acc = {
          address: p.address, name: null, count: 0, top: [], peakRssi: p.rssi, lastRssi: p.rssi,
          firstAt: p.at, lastAt: p.at, lastHex: p.hex, seen: new Set(), packets: []
        };
        this.by.set(p.address, acc);
      }
      acc.count++;
      acc.name = p.name ?? acc.name;
      acc.peakRssi = Math.max(acc.peakRssi, p.rssi);
      acc.lastRssi = p.rssi;
      acc.firstAt = Math.min(acc.firstAt, p.at);
      acc.lastAt = Math.max(acc.lastAt, p.at);
      acc.lastHex = p.hex;
      acc.seen.add(p.hex);
      acc.top = [...acc.top, p.rssi].sort((a, b) => b - a).slice(0, 3);
      acc.packets.push(p);
      this.total++;
    }
    if (this.total > Capture.MAX) this.trim();
  }

  private trim(): void {
    /* Der lauteste Absender bekommt am meisten Platz — die anderen zuerst kürzen. */
    const order = [...this.by.values()].sort((a, b) => b.packets.length - a.packets.length);
    for (const acc of order) {
      if (this.total <= Capture.MAX * 0.9) break;
      const drop = Math.min(acc.packets.length - 1, this.total - Math.floor(Capture.MAX * 0.9));
      if (drop <= 0) continue;
      acc.packets.splice(0, drop);
      this.total -= drop;
    }
  }

  sources(): Source[] {
    return [...this.by.values()].map((a) => ({
      address: a.address,
      name: a.name,
      count: a.count,
      /* Fehlt einem Absender das dritte Paket, zählt es als −100 dBm: ein einzelnes lautes Paket ist kein Pilot. */
      strength: Math.round([...a.top, -100, -100, -100].slice(0, 3).reduce((s, r) => s + r, 0) / 3),
      peakRssi: a.peakRssi,
      lastRssi: a.lastRssi,
      firstAt: a.firstAt,
      lastAt: a.lastAt,
      lastHex: a.lastHex,
      distinct: a.seen.size
    })).sort((a, b) => b.strength - a.strength || b.count - a.count);
  }

  packetsOf(address: string): readonly Packet[] {
    return this.by.get(address)?.packets ?? [];
  }

  clear(): void {
    this.by.clear();
    this.total = 0;
  }
}

/* -- Läufe und Muster ----------------------------------------------------------------------- */

/** Dasselbe Paket hintereinander → ein Lauf. In der Reihenfolge, in der sie kamen. */
export function runsOf(packets: readonly Packet[]): Run[] {
  const out: Run[] = [];
  for (const p of [...packets].sort((a, b) => a.at - b.at)) {
    const last = out[out.length - 1];
    if (last !== undefined && last.hex === p.hex) {
      out[out.length - 1] = { ...last, count: last.count + 1, lastAt: p.at, peakRssi: Math.max(last.peakRssi, p.rssi) };
    } else {
      out.push({ hex: p.hex, count: 1, firstAt: p.at, lastAt: p.at, peakRssi: p.rssi });
    }
  }
  return out;
}

/** Wie oft jedes Paket vorkam — in der Reihenfolge des ersten Auftretens. */
export function framesSeen(packets: readonly Packet[]): { readonly hex: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const p of [...packets].sort((a, b) => a.at - b.at)) counts.set(p.hex, (counts.get(p.hex) ?? 0) + 1);
  return [...counts].map(([hex, count]) => ({ hex, count }));
}

/**
 * DAS MUSTER: ein Paket immer wieder (`single`); ein Kreis aus mehreren
 * Paketen, der sich mindestens zweimal wiederholt (`cycle`); sonst das
 * Paket, das am öftesten kam (`dominant`) — bei einem Pilot mit wechselndem
 * Code ist das ein Druck.
 */
export function patternOf(runs: readonly Run[]): Pattern {
  if (runs.length === 0) return { kind: 'none', runs: [], at: [], repeats: 0 };
  /* Gleiche Pakete hintereinander sind schon EIN Lauf — ein einziger Lauf heisst: ein Paket. */
  if (runs.length === 1) return { kind: 'single', runs: [runs[0]], at: [0], repeats: runs[0].count };

  for (let p = 2; p * 2 <= runs.length; p++) {
    let fits = true;
    for (let i = 0; i + p < runs.length && fits; i++) fits = runs[i].hex === runs[i + p].hex;
    if (fits) {
      const at = Array.from({ length: p }, (_, i) => i);
      return { kind: 'cycle', runs: runs.slice(0, p), at, repeats: Math.floor(runs.length / p) };
    }
  }

  const totals = new Map<string, number>();
  for (const r of runs) totals.set(r.hex, (totals.get(r.hex) ?? 0) + r.count);
  const [top, count] = [...totals].sort((a, b) => b[1] - a[1])[0];
  let longest = -1;
  runs.forEach((r, i) => { if (r.hex === top && (longest < 0 || r.count > runs[longest].count)) longest = i; });
  return { kind: 'dominant', runs: [runs[longest]], at: [longest], repeats: count };
}

/** Der Abstand zwischen zwei Paketen eines Laufs (ms) — `null` bei einem einzigen. */
export const intervalOf = (r: Run): number | null => (r.count < 2 ? null : Math.round((r.lastAt - r.firstAt) / (r.count - 1)));

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/**
 * Läufe → Ramki eines Sygnał. Ein einziges Paket: {@link DURATION_DEFAULT}
 * (die Lampe braucht es meist nur einmal zu hören, Android wiederholt es
 * ohnehin). Mehrere: so lange, wie der Pilot jedes gesendet hat (50 ms genau,
 * 150 ms bis 3 s) — Android hält das nur ungefähr.
 */
export function framesFrom(runs: readonly Run[]): LampFrame[] {
  if (runs.length === 1) return [{ hex: runs[0].hex, durationMs: DURATION_DEFAULT, gapMs: 0 }];
  return runs.map((r) => {
    const span = r.lastAt - r.firstAt + (intervalOf(r) ?? 0);
    return { hex: r.hex, durationMs: Math.min(3000, Math.max(150, roundTo(span, 50))), gapMs: 0 };
  });
}

/* -- Ein Mitschnitt aus nRF Connect -------------------------------------------------------------- */

const LOG_LINE = /^\s*(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)\s*,\s*(-?\d{1,3})\s*dBm\s*,\s*((?:0x)?[0-9A-Fa-f][0-9A-Fa-f\s]*)\s*$/;

/** Die Zeilen eines Mitschnitts (Datum Uhrzeit, Stärke dBm, 0x…) → Pakete eines Absenders. */
export function parseNrfLog(text: string, address = 'nRF Connect'): { readonly packets: Packet[]; readonly skipped: number } {
  const packets: Packet[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const m = LOG_LINE.exec(line);
    const read = m === null ? null : normalizeHex(m[4]);
    const at = m === null ? NaN : Date.parse(`${m[1]}T${m[2]}`);
    if (m === null || read === null || read.problem !== null || !Number.isFinite(at)) { skipped++; continue; }
    const hex = significantHex(read.hex);
    if (hex === '') { skipped++; continue; }
    packets.push({ address, rssi: Number(m[3]), hex, at, name: null });
  }
  return { packets, skipped };
}

/* -- Was der Scan sagt ---------------------------------------------------------------------- */

const SCAN_TEXT: Readonly<Record<ScanCode, string>> = {
  'ok': 'Nasłuch trwa.',
  'no-bluetooth': 'Ten telefon nie ma Bluetooth.',
  'bluetooth-off': 'Bluetooth jest wyłączony — włącz go i spróbuj ponownie.',
  'no-scanner': 'Android nie daje skanera BLE.',
  'no-permission': 'Bez zgody na „Urządzenia w pobliżu" aplikacja nie słyszy pilota.',
  'location-off': 'Na tym Androidzie (11 i starszy) skanowanie wymaga włączonej lokalizacji.',
  'already-started': 'Skanowanie już trwa (SCAN_FAILED_ALREADY_STARTED).',
  'registration-failed': 'Android nie zarejestrował skanowania (SCAN_FAILED_APPLICATION_REGISTRATION_FAILED) — wyłącz i włącz Bluetooth.',
  'internal-error': 'Android: wewnętrzny błąd skanowania (SCAN_FAILED_INTERNAL_ERROR).',
  'feature-unsupported': 'Ten telefon nie obsługuje takiego skanowania (SCAN_FAILED_FEATURE_UNSUPPORTED).',
  'out-of-resources': 'Android: brak zasobów na skanowanie (SCAN_FAILED_OUT_OF_HARDWARE_RESOURCES).',
  'too-frequently': 'Android: zbyt częste skanowanie — odczekaj 30 s (najwyżej 5 startów na 30 s).',
  'timeout': 'Nasłuch zakończony po ustalonym czasie.',
  'stopped': 'Nasłuch zatrzymany.',
  'paused': 'Nasłuch przerwany — aplikacja zeszła z ekranu.',
  'error': 'Skanowanie się nie udało.'
};

export const scanText = (code: ScanCode): string => SCAN_TEXT[code] ?? SCAN_TEXT.error;
