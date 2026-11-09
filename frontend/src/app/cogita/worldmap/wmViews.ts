/**
 * 2026-11-09 — WAS DIE WELTKARTE VOM KRAJOBRAZ MITNIMMT (Step-1-Bericht §3: behalten — Ansichten, Selbsttest, Portale, Ziel;
 * anpassen — das Abspielen), rein und ohne Zeichnen:
 * <code>
 *   Ansichten    Ogólny · Co umiem (erobert) · Do odkrycia (jetzt lernbar: alles davor erobert) · Do powtórki (Karten, die
 *                fällig sind UND wiederholt werden dürfen — `reviewable`) · Luki (Kernfrage beantwortet, jetzt nicht gewusst,
 *                `selfCheck.ts`); was nicht dazugehört, bleibt grau — deckend, nie durchsichtig
 *   Abspielen    was sich seit dem letzten Zeigen änderte, je Ort: Höhe (fehlende Karten), Stufe, Sättigung, erobert, Punkt —
 *                gemerkt wie im Krajobraz (`landscapeShown.ts`: dieselbe Ablage, hier eine eigene Packung je Ort)
 *   Zeitplan     Säulen sinken (600 ms; beim ersten Besuch steigen sie, 750 ms, von der Mitte nach aussen bis 450 ms später),
 *                Nachbarn kurz nach dem Eroberten (Welle bis 300 ms), dann leuchten Stufen und der Ring der Eroberung,
 *                dann steigen die Punkte; „ograniczone": nur ein kurzes Aufleuchten, nichts bewegt sich; „wyłączone": sofort
 * </code>
 */

import type { PlaceState, WorldState } from './wmState';
import { reviewable } from './wmState';

/* -- Ansichten ------------------------------------------------------------------------------------------------------------- */

export type WorldMode = 'all' | 'known' | 'discover' | 'due' | 'gaps';
export const WORLD_MODES: readonly WorldMode[] = ['all', 'known', 'discover', 'due', 'gaps'];

/** Jetzt lernbar: noch nicht erobert, und alles davor ist erobert (die eigene Gruppe eines Kreises zählt nicht). */
export function readyNow(state: WorldState, id: string): boolean {
  const ps = state.places.get(id);
  if (ps === undefined || ps.conquered) return false;
  const group = state.world.places.get(id)?.group;
  for (const b of state.world.base(id)) {
    if (group !== undefined && state.world.places.get(b)?.group === group) continue;
    if (state.places.get(b)?.conquered === false) return false;
  }
  return true;
}

/** Die Karten eines Ortes, die jetzt zu wiederholen sind: fällig und wiederholbar (`reviewable`); ausgesetzte nie. */
export function dueOf(state: WorldState, id: string): string[] {
  return (state.places.get(id)?.cards ?? []).filter((k) => state.band(k) === 'learning' && reviewable(k, state));
}

/** Welche Orte in einer Ansicht farbig stehen (`null`: alle). */
export function litPlaces(mode: WorldMode, state: WorldState, gaps: ReadonlySet<string>): ReadonlySet<string> | null {
  if (mode === 'all') return null;
  const out = new Set<string>();
  for (const [id, ps] of state.places) {
    const lit = mode === 'known' ? ps.conquered : mode === 'discover' ? readyNow(state, id) : mode === 'due' ? dueOf(state, id).length > 0 : gaps.has(id);
    if (lit) out.add(id);
  }
  return out;
}

const modeKey = (k: string) => `cg-wm2-mode:${k}`;
export function keptMode(key: string): WorldMode {
  try { const v = localStorage.getItem(modeKey(key)); if (v !== null && (WORLD_MODES as readonly string[]).includes(v)) return v as WorldMode; } catch { /* ohne Speicher */ }
  return 'all';
}
export function keepMode(key: string, mode: WorldMode): void {
  try { localStorage.setItem(modeKey(key), mode); } catch { /* ohne Speicher */ }
}

/* -- Was zuletzt zu sehen war ----------------------------------------------------------------------------------------------- */

/** Wie ein Ort aussah: Höhe (fehlende Karten bis hierher), Stufe, Sättigung (0 nie, 1 teils, 2 voll), erobert, Punkt (0 keiner, 1 grün, 2 gelb, 3 orange). */
export interface PlaceShown {
  readonly missing: number;
  readonly level: number;
  readonly sat: 0 | 1 | 2;
  readonly conquered: boolean;
  readonly dot: 0 | 1 | 2 | 3;
}

const SAT: Readonly<Record<PlaceState['saturation'], 0 | 1 | 2>> = { never: 0, partly: 1, full: 2 };
const DOT_CODE = { green: 1, yellow: 2, orange: 3 } as const;
export const DOT_OF: readonly ('green' | 'yellow' | 'orange' | null)[] = [null, 'green', 'yellow', 'orange'];
export const SAT_OF: readonly PlaceState['saturation'][] = ['never', 'partly', 'full'];

export const shownOfPlace = (ps: PlaceState): PlaceShown => ({
  missing: ps.height, level: ps.level, sat: SAT[ps.saturation], conquered: ps.conquered, dot: ps.dot === null ? 0 : DOT_CODE[ps.dot]
});

const MAX_MISSING = 1_000_000_000;
/** Eine Zahl je Ort: Punkt + 4 · Sättigung + 12 · erobert + 24 · Stufe + 144 · Höhe. */
export function packPlace(p: PlaceShown): number {
  const missing = Math.max(0, Math.min(MAX_MISSING, Math.round(Number.isFinite(p.missing) ? p.missing : 0)));
  return p.dot + 4 * p.sat + 12 * (p.conquered ? 1 : 0) + 24 * Math.max(0, Math.min(5, Math.round(p.level))) + 144 * missing;
}
export function unpackPlace(n: number): PlaceShown {
  const missing = Math.floor(n / 144);
  let r = n - 144 * missing;
  const level = Math.floor(r / 24); r -= 24 * level;
  const conquered = r >= 12; if (conquered) r -= 12;
  const sat = Math.floor(r / 4) as 0 | 1 | 2;
  return { missing, level, sat, conquered, dot: (r - 4 * sat) as 0 | 1 | 2 | 3 };
}

export interface PlacesDiff {
  /** Wie die geänderten Orte vorher aussahen. */
  readonly before: ReadonlyMap<string, PlaceShown>;
  readonly conquered: readonly string[];
  readonly levelled: readonly string[];
  readonly reviewed: readonly string[];
  readonly opened: readonly string[];
  readonly lowered: readonly string[];
  readonly moved: readonly string[];
  readonly fresh: readonly string[];
  /** Etwas ist anders (neue Orte zählen nur, wenn vorher schon etwas gemerkt war). */
  readonly any: boolean;
}

/** Ort für Ort: was sich seit dem Gemerkten geändert hat (`was`: gekürzte Kennung → Packung). */
export function diffPlaces(was: Readonly<Record<string, number>>, now: ReadonlyMap<string, PlaceShown>, short: (id: string) => string): PlacesDiff {
  const before = new Map<string, PlaceShown>();
  const conquered: string[] = []; const levelled: string[] = []; const reviewed: string[] = []; const opened: string[] = [];
  const lowered: string[] = []; const moved: string[] = []; const fresh: string[] = [];
  for (const [id, n] of now) {
    const raw = was[short(id)];
    if (raw === undefined) { fresh.push(id); continue; }
    const b = unpackPlace(raw);
    const same = packPlace(b) === packPlace(n);
    if (same) continue;
    before.set(id, b);
    if (n.conquered && !b.conquered) conquered.push(id);
    else if (n.level > b.level) levelled.push(id);
    else if (b.dot === 3 && n.dot !== 3 && n.dot !== 0) reviewed.push(id);
    else if (n.sat > b.sat) opened.push(id);
    else if (n.missing < b.missing) lowered.push(id);
    else moved.push(id);
  }
  const known = Object.keys(was).length > 0;
  const any = conquered.length + levelled.length + reviewed.length + opened.length + lowered.length + moved.length > 0 || (known && fresh.length > 0);
  return { before, conquered, levelled, reviewed, opened, lowered, moved, fresh, any };
}

/** Was die Karte abspielt (neu je `id`). */
export interface WorldPlayback extends Omit<PlacesDiff, 'any'> {
  readonly id: number;
  /** first — der erste Besuch (die Säulen steigen); return — zurück auf die Karte; live — während sie zu sehen war (ohne Punkte). */
  readonly kind: 'first' | 'return' | 'live';
  /** Punkte je Ort seit dem letzten Zeigen (nur `return`, nur mit Nagrody) — und der Rest (Ziel, Serie, Karten ohne Ort). */
  readonly points: ReadonlyMap<string, number>;
  readonly rest: number;
}

/* -- Der Zeitplan ------------------------------------------------------------------------------------------------------------ */

export const COL_MS = 600;
export const RISE_MS = 750;
export const FLASH_MS = 520;
export const PTS_MS = 900;
export const FADE_MS = 500;

export interface PlaySchedule {
  /** Wann jeder Ort beginnt (ms nach dem Anfang). */
  readonly delay: ReadonlyMap<string, number>;
  /** Wie lange eine Säule sinkt oder steigt. */
  readonly colMs: number;
  /** Ab hier leuchten neue Stufen und der Ring der Eroberung. */
  readonly flash0: number;
  /** Ab hier steigen die Punkte (+N). */
  readonly pts0: number;
  readonly end: number;
  /** „ograniczone": so lange das Aufleuchten (sonst 0). */
  readonly fade: number;
}

/** Wann was läuft — `pos`: die Mitte eines Ortes (Bodeneinheiten), `centre` die der Welt. */
export function scheduleOf(pb: WorldPlayback, motion: 'full' | 'reduced' | 'off', pos: (id: string) => readonly [number, number] | undefined, centre: readonly [number, number]): PlaySchedule {
  const delay = new Map<string, number>();
  if (motion === 'off') return { delay, colMs: 0, flash0: 0, pts0: 0, end: 0, fade: 0 };
  if (motion === 'reduced') return { delay, colMs: 0, flash0: 0, pts0: 0, end: FADE_MS, fade: FADE_MS };
  if (pb.kind === 'first') {
    const ids = [...pb.fresh];
    let far = 0;
    const dist = new Map(ids.map((id) => { const p = pos(id); const d = p === undefined ? 0 : Math.hypot(p[0] - centre[0], p[1] - centre[1]); far = Math.max(far, d); return [id, d] as const; }));
    for (const id of ids) delay.set(id, far <= 0 ? 0 : (450 * (dist.get(id) ?? 0)) / far);
    const end = RISE_MS + (ids.length === 0 ? 0 : 450);
    return { delay, colMs: RISE_MS, flash0: end, pts0: end, end, fade: 0 };
  }
  /* Die Welle: was niedriger wurde oder sich sonst änderte, beginnt nach dem Nächsten, das erobert oder gestuft wurde. */
  const sources = [...pb.conquered, ...pb.levelled, ...pb.reviewed].map(pos).filter((p): p is readonly [number, number] => p !== undefined);
  let most = 0;
  for (const id of [...pb.opened, ...pb.lowered, ...pb.moved, ...pb.fresh]) {
    const p = pos(id);
    let d = Infinity;
    if (p !== undefined) for (const s of sources) d = Math.min(d, Math.hypot(p[0] - s[0], p[1] - s[1]));
    const at = !Number.isFinite(d) ? 0 : Math.min(300, 120 + (60 * d) / 150);
    delay.set(id, at);
    most = Math.max(most, at);
  }
  const flash0 = COL_MS - 120;
  const points = pb.kind === 'return' && (pb.points.size > 0 || pb.rest > 0);
  const pts0 = COL_MS + most - 100;
  const flashes = pb.conquered.length + pb.levelled.length + pb.reviewed.length > 0;
  const end = Math.max(COL_MS + most, flashes ? flash0 + FLASH_MS : 0, points ? pts0 + PTS_MS : 0);
  return { delay, colMs: COL_MS, flash0, pts0, end, fade: 0 };
}

export const easeInOut = (k: number): number => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
export const clamp01 = (k: number): number => (k <= 0 ? 0 : k >= 1 ? 1 : k);
