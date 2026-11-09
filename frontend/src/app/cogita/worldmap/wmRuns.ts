/**
 * 2026-11-09 — EROBERN DURCH DURCHGÄNGE (spec §7, Entscheidungen 7, 8, 9).
 * <code>
 *   Durchgang  fragt jede Karte eines Ortes einmal, gemischt; eine falsche kommt am Ende EINMAL wieder (Entscheidung 7).
 *              Jede Antwort ist eine gewöhnliche Antwort (`via: "run:<id>"`); der Durchgang selbst ist ein Stapel `run`,
 *              nur für den Halter versiegelt (ohne Schlüssel des Bereichs, Entscheidung 9)
 *   zählen     „first": richtig beim ersten Mal · „one": dazu richtig nach der einen Korrektur · „any": richtig überhaupt
 *   Stufe      nie gespeichert: aus allen Durchgängen und der Einstellung, die JETZT gilt — ändert sie sich, ändert sich die
 *              Stufe; nichts geht verloren. Ein Durchgang hebt höchstens um eine Stufe; vor einer Stufe mit Abstand zählt
 *              erst ein Durchgang, der nach dem Abstand beginnt
 *   Freigabe   jede Karte ist erschienen (gelernt oder besser) und jede direkte Voraussetzung erobert — als Bedingung der
 *              einen Sprache (`wmConditions.ts`), damit künftige Typen (Gruppe, Ort) dazukommen
 *   Einstellung  Admin: `levelsSetup` in den Ustawienia; Lernender: Werte `~world.*` (nur Zahlen); es gilt: gesperrt beim
 *              Admin > eigene > Admin > Vorgabe (0 Stufen: für bestehende Bazy ändert sich nichts, Entscheidung 8)
 * </code>
 */

import { evaluateCondition, register, type LearnerContext } from './wmConditions';
import type { WmCondition, World } from './wmTypes';

export const DAY = 24 * 60 * 60 * 1000;
export const MAX_LEVELS = 5;

export type Attempts = 'any' | 'one' | 'first';
export const ATTEMPTS: readonly Attempts[] = ['any', 'one', 'first'];

export interface LevelRule {
  /** Schwelle in Prozent (0–100). */
  readonly pct: number;
  readonly attempts: Attempts;
  /** Mindestabstand zur vorigen Stufe, in Tagen. */
  readonly gapDays: number;
}

/** Was der Admin in den Ustawienia einstellt. */
export interface LevelsSetup {
  readonly levels: number;
  readonly rules: readonly LevelRule[];
  /** Mit 0 Stufen: welcher Anteil der Karten eines Ortes gekonnt sein muss (0–1). */
  readonly knownShare: number;
  /** Die Breite der Säulen (0,4–1). */
  readonly pillarWidth: number;
  /** Die Lernenden dürfen nichts davon ändern. */
  readonly locked: boolean;
}

/** Die Vorgabe der Stufen (spec §7.1, drei Stufen: 75 % beliebig; 85 % eine Korrektur, 1 Tag; 95 % erster Versuch, 1 Tag). */
export const RULE_TABLE: readonly LevelRule[] = [
  { pct: 75, attempts: 'any', gapDays: 0 },
  { pct: 85, attempts: 'one', gapDays: 1 },
  { pct: 95, attempts: 'first', gapDays: 1 },
  { pct: 95, attempts: 'first', gapDays: 3 },
  { pct: 100, attempts: 'first', gapDays: 7 }
];
export const defaultRules = (levels: number): LevelRule[] => RULE_TABLE.slice(0, Math.max(0, Math.min(MAX_LEVELS, levels)));

export const DEFAULT_PILLAR = 1;
export const PILLAR_MIN = 0.4;

export const DEFAULT_SETUP: LevelsSetup = { levels: 0, rules: [], knownShare: 1, pillarWidth: DEFAULT_PILLAR, locked: false };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function readRule(raw: unknown, fallback: LevelRule): LevelRule {
  if (!isObject(raw)) return fallback;
  return {
    pct: finite(raw.pct) ? clamp(Math.round(raw.pct), 1, 100) : fallback.pct,
    attempts: (ATTEMPTS as readonly string[]).includes(String(raw.attempts)) ? (raw.attempts as Attempts) : fallback.attempts,
    gapDays: finite(raw.gapDays) ? clamp(raw.gapDays, 0, 365) : fallback.gapDays
  };
}

/** Duldsam gelesen (Ustawienia `levelsSetup`): fehlende Regeln aus der Vorgabe. */
export function readLevelsSetup(raw: unknown): LevelsSetup | undefined {
  if (!isObject(raw)) return undefined;
  const levels = finite(raw.levels) ? clamp(Math.round(raw.levels), 0, MAX_LEVELS) : 0;
  const given = Array.isArray(raw.rules) ? raw.rules : [];
  const rules = defaultRules(levels).map((d, i) => readRule(given[i], d));
  return {
    levels, rules,
    knownShare: finite(raw.knownShare) ? clamp(raw.knownShare > 1 ? raw.knownShare / 100 : raw.knownShare, 0.1, 1) : 1,
    pillarWidth: finite(raw.pillarWidth) ? clamp(raw.pillarWidth > 1 ? raw.pillarWidth / 100 : raw.pillarWidth, PILLAR_MIN, 1) : DEFAULT_PILLAR,
    locked: raw.locked === true
  };
}

/** Für das JSON der Ustawienia. */
export const levelsSetupDoc = (s: LevelsSetup): Record<string, unknown> => ({
  levels: s.levels, rules: s.rules.slice(0, s.levels).map((r) => ({ pct: r.pct, attempts: r.attempts, ...(r.gapDays > 0 ? { gapDays: r.gapDays } : {}) })),
  knownShare: s.knownShare, pillarWidth: s.pillarWidth, ...(s.locked ? { locked: true } : {})
});

/* -- Die eigene Einstellung des Lernenden, in seinen Werten (nur Zahlen) ---------------------------------------------- */

export const OWN_LEVELS = '~world.levels';
export const OWN_PILLAR = '~world.pillar';
const ownKey = (i: number, what: 'pct' | 'attempts' | 'gap') => `~world.l${i + 1}.${what}`;

export interface OwnWorld {
  readonly levels?: number;
  readonly rules?: readonly LevelRule[];
  readonly pillarWidth?: number;
}

export function ownWorld(values: Readonly<Record<string, number>> | undefined): OwnWorld {
  if (values === undefined) return {};
  const out: { levels?: number; rules?: LevelRule[]; pillarWidth?: number } = {};
  if (finite(values[OWN_LEVELS])) {
    const levels = clamp(Math.round(values[OWN_LEVELS]), 0, MAX_LEVELS);
    out.levels = levels;
    out.rules = defaultRules(levels).map((d, i) => ({
      pct: finite(values[ownKey(i, 'pct')]) ? clamp(Math.round(values[ownKey(i, 'pct')]), 1, 100) : d.pct,
      attempts: finite(values[ownKey(i, 'attempts')]) ? ATTEMPTS[clamp(Math.round(values[ownKey(i, 'attempts')]), 0, 2)] : d.attempts,
      gapDays: finite(values[ownKey(i, 'gap')]) ? clamp(values[ownKey(i, 'gap')], 0, 365) : d.gapDays
    }));
  }
  if (finite(values[OWN_PILLAR])) out.pillarWidth = clamp(values[OWN_PILLAR] / 100, PILLAR_MIN, 1);
  return out;
}

/** Die Werte mit (oder, `null`, ohne) eigener Einstellung der Stufen; die Breite der Säulen bleibt. */
export function withOwnLevels(values: Readonly<Record<string, number>>, own: { readonly levels: number; readonly rules: readonly LevelRule[] } | null): Record<string, number> {
  const rest: Record<string, number> = {};
  for (const [k, v] of Object.entries(values)) if (k !== OWN_LEVELS && !/^~world\.l\d+\./.test(k)) rest[k] = v;
  if (own === null) return rest;
  const levels = clamp(Math.round(own.levels), 0, MAX_LEVELS);
  rest[OWN_LEVELS] = levels;
  own.rules.slice(0, levels).forEach((r, i) => {
    rest[ownKey(i, 'pct')] = r.pct;
    rest[ownKey(i, 'attempts')] = ATTEMPTS.indexOf(r.attempts);
    rest[ownKey(i, 'gap')] = r.gapDays;
  });
  return rest;
}

/** Die Werte mit (oder, `null`, ohne) eigener Breite der Säulen (in Prozent gespeichert). */
export function withOwnPillar(values: Readonly<Record<string, number>>, width: number | null): Record<string, number> {
  const { [OWN_PILLAR]: _p, ...rest } = values;
  return width === null ? rest : { ...rest, [OWN_PILLAR]: Math.round(clamp(width, PILLAR_MIN, 1) * 100) };
}

export interface EffectiveWorld {
  readonly levels: number;
  readonly rules: readonly LevelRule[];
  readonly knownShare: number;
  readonly pillarWidth: number;
  /** Woher die Stufen kommen. */
  readonly from: 'own' | 'area' | 'default';
  readonly changeable: boolean;
  /** Stufen sind eingestellt, aber der Dienst speichert noch keine Durchgänge (vor 0140): sie gelten als 0 (`wmFeatures.ts`). */
  readonly serverOld?: boolean;
}

/** GESPERRT BEIM ADMIN — SONST DAS EIGENE — SONST DAS DES ADMINS — SONST DIE VORGABE (0 Stufen). */
export function effectiveWorld(area: LevelsSetup | undefined, own: OwnWorld): EffectiveWorld {
  const share = area?.knownShare ?? 1;
  /* Die Breite der Säulen darf jeder für sich ändern (§4.7) — gesperrt sind nur die Stufen. */
  const pillarWidth = own.pillarWidth ?? area?.pillarWidth ?? DEFAULT_PILLAR;
  if (area?.locked === true) return { levels: area.levels, rules: area.rules, knownShare: share, pillarWidth, from: 'area', changeable: false };
  if (own.levels !== undefined) return { levels: own.levels, rules: own.rules ?? defaultRules(own.levels), knownShare: share, pillarWidth, from: 'own', changeable: true };
  if (area !== undefined) return { levels: area.levels, rules: area.rules, knownShare: share, pillarWidth, from: 'area', changeable: true };
  return { levels: 0, rules: [], knownShare: 1, pillarWidth, from: 'default', changeable: true };
}

/* -- Der Durchgang als Stapel ------------------------------------------------------------------------------------------- */

export interface RunRecord {
  readonly id: string;
  readonly place: string;
  /** Wer ihn ging — heute immer genau einer (§10.3: später eine Gruppe). */
  readonly participants: readonly string[];
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly cards: number;
  /** Richtig beim ersten Mal. */
  readonly firstTry: number;
  /** Beim ersten Mal falsch, bei der einen Wiederholung am Ende richtig. */
  readonly afterCorrection: number;
  /** Erst nach mehr als einer Korrektur richtig (für „beliebig"; heute 0 — eine Karte kommt höchstens einmal wieder). */
  readonly laterRight?: number;
  /** Alle Antworten des Durchgangs. */
  readonly attempts: number;
}

export function readRun(raw: unknown): RunRecord | null {
  if (!isObject(raw)) return null;
  const { id, place, startedAt, finishedAt, cards, firstTry, afterCorrection, attempts } = raw;
  if (typeof id !== 'string' || id === '' || typeof place !== 'string' || place === '') return null;
  if (!finite(startedAt) || !finite(finishedAt) || !finite(cards) || !finite(firstTry) || !finite(afterCorrection) || !finite(attempts)) return null;
  const n = Math.max(0, Math.round(cards));
  const first = clamp(Math.round(firstTry), 0, n);
  const after = clamp(Math.round(afterCorrection), 0, n - first);
  const later = finite(raw.laterRight) ? clamp(Math.round(raw.laterRight), 0, n - first - after) : 0;
  return {
    id, place,
    participants: (Array.isArray(raw.participants) ? raw.participants : []).filter((p): p is string => typeof p === 'string' && p !== '').slice(0, 12),
    startedAt, finishedAt: Math.max(startedAt, finishedAt), cards: n, firstTry: first, afterCorrection: after,
    ...(later > 0 ? { laterRight: later } : {}),
    attempts: Math.max(0, Math.round(attempts))
  };
}

/** Der Anteil, der nach einer Regel zählt (0–1). */
export function runScore(run: RunRecord, attempts: Attempts): number {
  if (run.cards <= 0) return 0;
  const right = attempts === 'first' ? run.firstTry : attempts === 'one' ? run.firstTry + run.afterCorrection : run.firstTry + run.afterCorrection + (run.laterRight ?? 0);
  return right / run.cards;
}

export interface LevelProgress {
  readonly level: number;
  /** Wann jede erreichte Stufe erreicht wurde (Index 0 = Stufe 1). */
  readonly reachedAt: readonly number[];
  /** Ab wann ein Durchgang für die nächste Stufe zählt (0: sofort; null: es gibt keine nächste). */
  readonly nextAt: number | null;
}

/** DIE STUFE AUS DEN DURCHGÄNGEN eines Ortes und der Einstellung, die jetzt gilt. */
export function levelOf(runs: readonly RunRecord[], rules: readonly LevelRule[], levels: number): LevelProgress {
  const n = Math.max(0, Math.min(MAX_LEVELS, levels, rules.length));
  const reachedAt: number[] = [];
  for (const run of runs.slice().sort((a, b) => a.finishedAt - b.finishedAt || (a.id < b.id ? -1 : 1))) {
    const level = reachedAt.length;
    if (level >= n) break;
    const rule = rules[level];
    if (level > 0 && run.startedAt < reachedAt[level - 1] + rule.gapDays * DAY) continue;
    if (runScore(run, rule.attempts) * 100 >= rule.pct - 1e-9) reachedAt.push(run.finishedAt);
  }
  const level = reachedAt.length;
  const nextAt = level >= n ? null : level === 0 ? 0 : reachedAt[level - 1] + rules[level].gapDays * DAY;
  return { level, reachedAt, nextAt };
}

/** Die Stufen aller Orte aus allen Durchgängen. */
export function levelsByPlace(runs: Iterable<RunRecord>, rules: readonly LevelRule[], levels: number): Map<string, LevelProgress> {
  const by = new Map<string, RunRecord[]>();
  for (const r of runs) { const l = by.get(r.place) ?? []; l.push(r); by.set(r.place, l); }
  const out = new Map<string, LevelProgress>();
  for (const [place, list] of by) out.set(place, levelOf(list, rules, levels));
  return out;
}

/* -- Die Freigabe: eine Bedingung der einen Sprache --------------------------------------------------------------------- */

/** „Dieser Ort ist erobert" — für die Freigabe eines Durchgangs (und für Fahrkarten, wenn ein Autor es will). */
register({
  type: 'conquered',
  symbol: 'knowledge',
  evaluate: (c, ctx) => { const met = typeof c.of === 'string' && ctx.conquered?.(c.of) === true; return { met, progress: met ? 1 : 0 }; },
  cost: (c, ctx, r) => (r.met ? 0 : 4 * (typeof c.of === 'string' ? ctx.world.places.get(c.of)?.cards.length ?? 1 : 1)),
  describe: (c, ctx, r) => ({ symbol: 'knowledge', key: 'cogitaWorld.condition.conquered', params: { name: typeof c.of === 'string' ? ctx.world.places.get(c.of)?.label ?? c.of : '' }, action: r.met ? 'none' : 'learn' })
});

/** Die Freigabe eines Durchgangs: jede Karte erschienen, jede direkte Voraussetzung erobert. */
export function runUnlock(world: World, place: string): WmCondition {
  const needs = world.places.get(place)?.needs ?? [];
  return { type: 'and', items: [{ type: 'knowness', of: place, band: 'learned' }, ...needs.map((n) => ({ type: 'conquered', of: n }))] };
}

export type RunGate =
  | { readonly kind: 'none' }
  | { readonly kind: 'conquered' }
  | { readonly kind: 'ready'; readonly level: number }
  | { readonly kind: 'wait'; readonly level: number; readonly from: number }
  | { readonly kind: 'locked'; readonly level: number; readonly unseen: readonly string[]; readonly needs: readonly string[] };

/** KANN EIN DURCHGANG BEGINNEN — und für welche Stufe; sonst warum nicht. */
export function runGate(ctx: LearnerContext, place: string, progress: LevelProgress, levels: number, now: number): RunGate {
  if (levels <= 0) return { kind: 'none' };
  if (progress.level >= levels) return { kind: 'conquered' };
  const level = progress.level + 1;
  const unlock = evaluateCondition(runUnlock(ctx.world, place), { ...ctx, subject: place });
  if (!unlock.met) {
    const needs = (ctx.world.places.get(place)?.needs ?? []).filter((n) => ctx.conquered?.(n) !== true);
    return { kind: 'locked', level, unseen: unlock.missing?.new ?? [], needs };
  }
  if (progress.nextAt !== null && progress.nextAt > now) return { kind: 'wait', level, from: progress.nextAt };
  return { kind: 'ready', level };
}

/* -- Ein Durchgang, Schritt für Schritt (rein; der Bildschirm ist `WorldRun.tsx`) -------------------------------------- */

export interface RunSession {
  readonly id: string;
  readonly place: string;
  readonly startedAt: number;
  /** Die Karten in der gemischten Reihenfolge. */
  readonly order: readonly string[];
  /** Was noch dran ist (vorn: jetzt). */
  readonly queue: readonly string[];
  /** Je Karte: die erste und die zweite Antwort (Richtigkeit 0–1). */
  readonly first: Readonly<Record<string, number>>;
  readonly second: Readonly<Record<string, number>>;
  readonly attempts: number;
  /** Ab hier kommen die Wiederholungen der falschen Karten. */
  readonly retrying: boolean;
}

/** Gemischt mit Samen (dieselbe Kennung, dieselbe Reihenfolge — nach Neuladen geht es gleich weiter). */
export function shuffled<T>(list: readonly T[], seed: string): T[] {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) { h ^= seed.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  let a = h >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

export function startRun(id: string, place: string, cards: readonly string[], now: number): RunSession {
  const order = shuffled(cards, id);
  return { id, place, startedAt: now, order, queue: order, first: {}, second: {}, attempts: 0, retrying: false };
}

export const runCard = (s: RunSession): string | null => s.queue[0] ?? null;

/** Eine Antwort: beim ersten Mal falsch → am Ende noch einmal (Entscheidung 7). */
export function runAnswer(s: RunSession, card: string, correctness: number): RunSession {
  if (s.queue[0] !== card) return s;
  const right = correctness >= 0.999;
  const rest = s.queue.slice(1);
  if (!s.retrying && s.first[card] === undefined) {
    const first = { ...s.first, [card]: correctness };
    const wrongs = right ? [] : [card];
    const queue = [...rest, ...wrongs];
    /* Die erste Runde ist vorbei, sobald keine Karte der gemischten Reihenfolge mehr vorn wartet. */
    const retrying = queue.length > 0 && queue.every((k) => first[k] !== undefined);
    return { ...s, first, queue, attempts: s.attempts + 1, retrying };
  }
  return { ...s, second: { ...s.second, [card]: correctness }, queue: rest, attempts: s.attempts + 1, retrying: true };
}

export const runDone = (s: RunSession): boolean => s.queue.length === 0;

/** Der Durchgang als Stapel (`kind: "run"`). */
export function finishRun(s: RunSession, now: number, participants: readonly string[]): RunRecord {
  const cards = s.order.length;
  const firstTry = s.order.filter((k) => (s.first[k] ?? 0) >= 0.999).length;
  const afterCorrection = s.order.filter((k) => (s.first[k] ?? 0) < 0.999 && (s.second[k] ?? 0) >= 0.999).length;
  return { id: s.id, place: s.place, participants, startedAt: s.startedAt, finishedAt: Math.max(s.startedAt, now), cards, firstTry, afterCorrection, attempts: s.attempts };
}
