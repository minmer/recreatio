/**
 * 2026-11-12 — EINSTUFUNG („Sprawdź, ile już umiesz", Schritt "explore"): prüft die noch nicht eroberten Türme eines Bereichs mit
 * echten Fragen und geht zu den Türmen weiter, die auf ihnen aufbauen — so weit der Lernende kommt. Rein (ohne React);
 * `scripts/app-wm-placement-check.mjs` prüft es auf erzeugten Welten.
 * <code>
 *   Bereich   Türme, Blöcke (mit ihren Teilen), Einheiten (was sie verlangen, mit Grundlage, und die Halte ihrer Linie); "downTo":
 *             die ganze Grundlage eines Turms samt ihm
 *   Front     adaptiv: nicht erobert, nicht gutgeschrieben, nicht verbrannt, jede Voraussetzung passierbar;
 *             Zielstufe L: unter L, jede Voraussetzung mindestens L (ohne openAt)
 *   adaptiv   "streak" richtig in Folge: gutgeschrieben (Wert ~placed.<turm>); "errors" falsch in einem Turm: verbrannt (für diesen
 *             Lauf). Verbrannt → jede in diesem Lauf gutgeschriebene unmittelbare Voraussetzung wird nachgeprüft ("recheck" richtig
 *             in Folge bestätigt; ein Fehler nimmt die Gutschrift zurück und prüft deren in diesem Lauf gutgeschriebene
 *             Voraussetzungen, und so weiter nach unten). Zurückgenommene Türme sind für diesen Lauf verbrannt. Was davon abhängt,
 *             fällt aus dem Graphen (`stateOf`: eine Gutschrift gilt nur über passierbaren Voraussetzungen)
 *   Zielstufe ein Turm wird gefragt wie ein echter Durchgang der Stufe L (Prozent und Regel der Versuche), Karten zufällig ohne
 *             Wiederholung, früh entschieden; erreicht: ein gewöhnlicher Durchgang (keine Gutschrift); sonst: nicht erobert, seine
 *             Nachfolger kommen nicht in die Front
 *   Lauf      in der Stelle eines eigenen Ablaufs \`explore:<bereich>\` (Schritt, Besuchtes); "once": danach \`done\`
 * </code>
 */

import type { WorldState } from './wmState';
import { runAnswer, runCard, runDone, startRun, type Attempts, type LevelRule, type RunSession } from './wmRuns';
import type { Lines, World } from './wmTypes';

export type ExploreMode = 'adaptive' | 'target';

export interface ExploreConfig {
  readonly scope: readonly string[];
  readonly downTo: string | null;
  readonly modes: readonly ExploreMode[];
  readonly default: ExploreMode;
  readonly targetLevels: readonly number[] | null;
  readonly streak: number;
  readonly errors: number;
  readonly recheck: number;
  readonly once: boolean;
  readonly push: boolean;
  readonly title: string;
  readonly of: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const clampInt = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
export const EXPLORE_LIMITS = { min: 1, max: 10 } as const;

export function readExplore(c: Readonly<Record<string, unknown>>): ExploreConfig {
  const modes = (Array.isArray(c.modes) ? c.modes : ['adaptive', 'target']).filter((m): m is ExploreMode => m === 'adaptive' || m === 'target');
  const list = modes.length === 0 ? ['adaptive', 'target'] as ExploreMode[] : [...new Set(modes)];
  const def = c.default === 'target' || c.default === 'adaptive' ? c.default : 'adaptive';
  const levels = Array.isArray(c.targetLevels) ? c.targetLevels.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1) : null;
  return {
    scope: (Array.isArray(c.scope) ? c.scope : typeof c.scope === 'string' ? [c.scope] : []).map(str).filter((x) => x !== ''),
    downTo: str(c.downTo) || null,
    modes: list,
    default: list.includes(def) ? def : list[0],
    targetLevels: levels === null || levels.length === 0 ? null : [...new Set(levels)].sort((a, b) => a - b),
    streak: clampInt(c.streak, 1, 10, 3),
    errors: clampInt(c.errors, 1, 10, 2),
    recheck: clampInt(c.recheck, 1, 10, 2),
    once: c.once !== false,
    push: c.push !== false,
    title: str(c.title),
    of: str(c.of)
  };
}

/** Der Schlüssel des Bereichs: dieselbe Einstufung in mehreren Erzählungen hat dieselbe Stelle (gemacht, ausgelassen). */
export function scopeKey(cfg: Pick<ExploreConfig, 'scope' | 'downTo'>): string {
  const text = [...cfg.scope].sort().join('|') + (cfg.downTo === null ? '' : `>${cfg.downTo}`);
  let h1 = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) h1 = Math.imul(h1 ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `explore:${h1.toString(36)}`;
}

/** Die Türme des Bereichs. */
export function scopeTowers(world: World, lines: Lines, cfg: Pick<ExploreConfig, 'scope' | 'downTo'>): Set<string> {
  const out = new Set<string>();
  const withBase = (p: string) => { out.add(p); for (const b of world.base(p)) if (world.places.has(b)) out.add(b); };
  for (const r of cfg.scope) {
    if (world.places.has(r)) { out.add(r); continue; }
    const block = world.blocks.get(r);
    if (block !== undefined) { for (const p of block.parts) if (world.places.has(p)) out.add(p); continue; }
    /* Eine Einheit: was sie verlangt (mit Grundlage), dazu die Halte ihrer Linie. */
    for (const q of world.requires(r)) {
      if (world.places.has(q)) withBase(q);
      else for (const p of world.blocks.get(q)?.parts ?? []) if (world.places.has(p)) withBase(p);
    }
    for (const line of lines.lines.values()) if (line.unit === r) for (const s of line.stops) if (world.places.has(s)) out.add(s);
  }
  if (cfg.downTo !== null && world.places.has(cfg.downTo)) withBase(cfg.downTo);
  return out;
}

export const PLACED_PREFIX = '~placed.';
export const placedKey = (place: string): string => `${PLACED_PREFIX}${place}`;

/* -- Der Lauf ---------------------------------------------------------------------------------------------------------------------- */

export interface AdaptiveRun {
  readonly mode: 'adaptive';
  /** Richtig in Folge je Turm (im gewöhnlichen Fragen). */
  readonly streak: Readonly<Record<string, number>>;
  /** Falsch je Turm. */
  readonly wrong: Readonly<Record<string, number>>;
  readonly burned: readonly string[];
  /** In diesem Lauf gutgeschrieben, in Reihenfolge. */
  readonly credited: readonly string[];
  /** Nachprüfen: der jetzige zuerst, dann die wartenden. */
  readonly recheck: readonly string[];
  readonly recheckStreak: number;
}

export interface TargetRun {
  readonly mode: 'target';
  readonly level: number;
  readonly reached: readonly string[];
  readonly failed: readonly string[];
  /** Der Turm, der gerade gefragt wird, und sein Durchgang (nicht gespeichert: ein neuer Lauf fragt ihn neu). */
  readonly session: RunSession | null;
}

export type PlacementRun = AdaptiveRun | TargetRun;

export const newAdaptive = (): AdaptiveRun => ({ mode: 'adaptive', streak: {}, wrong: {}, burned: [], credited: [], recheck: [], recheckStreak: 0 });
export const newTarget = (level: number): TargetRun => ({ mode: 'target', level, reached: [], failed: [], session: null });

export interface PlacementCtx {
  readonly world: World;
  readonly state: WorldState;
  readonly scope: ReadonlySet<string>;
  /** Die Karten eines Turms, die gefragt werden dürfen (nicht ausgesetzt). */
  readonly cardsOf: (place: string) => readonly string[];
  /** Wann eine Karte zuletzt beantwortet wurde (0: nie) — kürzlich gefragte kommen später. */
  readonly lastAnswered: (card: string) => number;
  readonly rules: readonly LevelRule[];
  readonly random: () => number;
}

const pick = <T,>(list: readonly T[], random: () => number): T | undefined => (list.length === 0 ? undefined : list[Math.min(list.length - 1, Math.floor(random() * list.length))]);

/** Die Front: was jetzt gefragt werden kann (ohne einen laufenden Durchgang / ein Nachprüfen). */
export function frontOf(ctx: PlacementCtx, run: PlacementRun): string[] {
  const { state } = ctx;
  const out: string[] = [];
  for (const id of ctx.world.order) {
    if (!ctx.scope.has(id)) continue;
    const ps = state.places.get(id);
    if (ps === undefined || ps.total === 0 || ctx.cardsOf(id).length === 0) continue;
    const needs = ctx.world.places.get(id)?.needs ?? [];
    /* Was dieser Lauf eben gutschrieb oder erreichte, gilt sofort (auch bevor der gespeicherte Stand es weiss). */
    if (run.mode === 'adaptive') {
      if (ps.conquered || ps.placed > 0 || run.burned.includes(id) || run.credited.includes(id)) continue;
      if (needs.every((n) => run.credited.includes(n) || state.places.get(n)?.passable !== false)) out.push(id);
    } else {
      if (ps.level >= run.level || run.failed.includes(id) || run.reached.includes(id)) continue;
      if (needs.every((n) => run.reached.includes(n) || (state.places.get(n)?.level ?? run.level) >= run.level)) out.push(id);
    }
  }
  return out;
}

/** Eine Karte eines Turms: zuerst die am längsten nicht beantworteten, unter ihnen zufällig. */
export function cardOf(ctx: PlacementCtx, place: string, avoid: ReadonlySet<string> = new Set()): string | null {
  const all = ctx.cardsOf(place).filter((k) => !avoid.has(k));
  const list = all.length === 0 ? ctx.cardsOf(place) : all;
  if (list.length === 0) return null;
  const oldest = Math.min(...list.map((k) => ctx.lastAnswered(k)));
  return pick(list.filter((k) => ctx.lastAnswered(k) === oldest), ctx.random) ?? null;
}

export interface Ask { readonly place: string; readonly card: string; readonly recheck: boolean }

/** Was als Nächstes gefragt wird (null: die Einstufung ist am Ende). */
export function nextAsk(ctx: PlacementCtx, run: PlacementRun, avoid: ReadonlySet<string> = new Set()): { run: PlacementRun; ask: Ask | null } {
  if (run.mode === 'adaptive') {
    if (run.recheck.length > 0) {
      const place = run.recheck[0];
      const card = cardOf(ctx, place, avoid);
      return { run, ask: card === null ? null : { place, card, recheck: true } };
    }
    const place = pick(frontOf(ctx, run), ctx.random);
    if (place === undefined) return { run, ask: null };
    const card = cardOf(ctx, place, avoid);
    return { run, ask: card === null ? null : { place, card, recheck: false } };
  }
  let r = run;
  if (r.session === null) {
    const place = pick(frontOf(ctx, r), ctx.random);
    if (place === undefined) return { run: r, ask: null };
    r = { ...r, session: startRun(`placement-${Math.floor(ctx.random() * 1e9).toString(36)}`, place, ctx.cardsOf(place), 0) };
  }
  const card = runCard(r.session!);
  return { run: r, ask: card === null ? null : { place: r.session!.place, card, recheck: false } };
}

export interface Outcome {
  readonly run: PlacementRun;
  /** Neu gutgeschrieben (adaptiv) — als Wert \`~placed.<turm>\` = jetzt. */
  readonly credit?: string;
  /** Zurückgenommen (adaptiv) — als Wert \`~placed.<turm>\` = 0. */
  readonly withdraw?: string;
  /** Entschieden (Zielstufe): der Durchgang, gespeichert wie jeder Durchgang. */
  readonly decided?: { readonly place: string; readonly reached: boolean; readonly session: RunSession };
}

/** Die in diesem Lauf gutgeschriebenen unmittelbaren Voraussetzungen eines Turms (zufällig geordnet). */
const creditedNeeds = (ctx: PlacementCtx, run: AdaptiveRun, place: string, skip: ReadonlySet<string>): string[] => {
  const list = (ctx.world.places.get(place)?.needs ?? []).filter((n) => run.credited.includes(n) && !skip.has(n));
  for (let i = list.length - 1; i > 0; i -= 1) { const j = Math.floor(ctx.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};

/** Eine Antwort (richtig oder nicht) auf die gefragte Karte. */
export function answer(ctx: PlacementCtx, run: PlacementRun, ask: Ask, right: boolean, cfg: Pick<ExploreConfig, 'streak' | 'errors' | 'recheck'>, correctness = right ? 1 : 0): Outcome {
  if (run.mode === 'target') {
    if (run.session === null) return { run };
    const session = runAnswer(run.session, ask.card, correctness);
    const rule = ctx.rules[run.level - 1];
    const verdict = rule === undefined ? 'open' : decide(session, rule);
    if (verdict === 'open' && !runDone(session)) return { run: { ...run, session } };
    const reached = verdict === 'reached' || (verdict === 'open' && rule !== undefined && scoreOf(session, rule.attempts) * 100 >= rule.pct - 1e-9);
    const next: TargetRun = { ...run, session: null, ...(reached ? { reached: [...run.reached, ask.place] } : { failed: [...run.failed, ask.place] }) };
    return { run: next, decided: { place: ask.place, reached, session } };
  }
  /* Nachprüfen: "recheck" richtig in Folge bestätigt; ein Fehler nimmt zurück und prüft darunter. */
  if (ask.recheck) {
    const place = run.recheck[0];
    if (right) {
      const n = run.recheckStreak + 1;
      if (n < cfg.recheck) return { run: { ...run, recheckStreak: n } };
      return { run: { ...run, recheck: run.recheck.slice(1), recheckStreak: 0 } };
    }
    const waiting = new Set(run.recheck.slice(1));
    const below = creditedNeeds(ctx, run, place, waiting);
    return {
      run: { ...run, credited: run.credited.filter((x) => x !== place), burned: [...run.burned, place], recheck: [...below, ...run.recheck.slice(1)], recheckStreak: 0 },
      withdraw: place
    };
  }
  const place = ask.place;
  if (right) {
    const n = (run.streak[place] ?? 0) + 1;
    if (n < cfg.streak) return { run: { ...run, streak: { ...run.streak, [place]: n } } };
    return { run: { ...run, streak: { ...run.streak, [place]: 0 }, credited: [...run.credited, place] }, credit: place };
  }
  const w = (run.wrong[place] ?? 0) + 1;
  const after: AdaptiveRun = { ...run, streak: { ...run.streak, [place]: 0 }, wrong: { ...run.wrong, [place]: w } };
  if (w < cfg.errors) return { run: after };
  /* Verbrannt: einen Schritt zurück — seine in diesem Lauf gutgeschriebenen Voraussetzungen nachprüfen. */
  return { run: { ...after, burned: [...after.burned, place], recheck: creditedNeeds(ctx, after, place, new Set()), recheckStreak: 0 } };
}

const rightBy = (s: RunSession, attempts: Attempts, k: string): boolean => (s.first[k] ?? 0) >= 0.999
  || (attempts !== 'first' && (s.second[k] ?? 0) >= 0.999) || (attempts === 'any' && (s.later[k] ?? 0) >= 0.999);
const scoreOf = (s: RunSession, attempts: Attempts): number => (s.order.length === 0 ? 0 : s.order.filter((k) => rightBy(s, attempts, k)).length / s.order.length);

/** Ist der Durchgang schon entschieden? Erreicht, wenn genug sicher richtig sind; verfehlt, wenn es nicht mehr reichen kann. */
export function decide(s: RunSession, rule: LevelRule): 'reached' | 'failed' | 'open' {
  const total = s.order.length;
  if (total === 0) return 'failed';
  const needed = Math.ceil((rule.pct / 100) * total - 1e-9);
  const right = s.order.filter((k) => rightBy(s, rule.attempts, k)).length;
  if (right >= needed) return 'reached';
  const still = s.order.filter((k) => {
    if (rightBy(s, rule.attempts, k)) return false;
    if (s.first[k] === undefined) return true;
    if (rule.attempts === 'first') return false;
    if (rule.attempts === 'one') return s.second[k] === undefined;
    return true;
  }).length;
  return right + still < needed ? 'failed' : 'open';
}

/* -- Der Lauf in der Stelle eines Ablaufs (Schritt, Besuchtes) --------------------------------------------------------------------- */

/** Was die Stelle trägt: der Lauf, ausgelassen, fertig. */
export interface PlacementMemory { readonly run: PlacementRun | null; readonly skipped: boolean; readonly done: boolean }

export function packRun(run: PlacementRun): string[] {
  if (run.mode === 'target') return [`mode:target:${run.level}`, ...run.reached.map((p) => `ok:${p}`), ...run.failed.map((p) => `f:${p}`)];
  return [
    'mode:adaptive',
    ...run.credited.map((p) => `c:${p}`), ...run.burned.map((p) => `b:${p}`), ...run.recheck.map((p) => `r:${p}`),
    ...Object.entries(run.streak).filter(([, n]) => n > 0).map(([p, n]) => `s:${n}:${p}`),
    ...Object.entries(run.wrong).filter(([, n]) => n > 0).map(([p, n]) => `w:${n}:${p}`),
    ...(run.recheckStreak > 0 ? [`rs:${run.recheckStreak}`] : [])
  ];
}

export function unpackRun(visited: readonly string[]): PlacementRun | null {
  const mode = visited.find((v) => v.startsWith('mode:'));
  if (mode === undefined) return null;
  const after = (p: string) => visited.filter((v) => v.startsWith(p)).map((v) => v.slice(p.length));
  if (mode.startsWith('mode:target:')) return { ...newTarget(Math.max(1, Number(mode.slice('mode:target:'.length)) || 1)), reached: after('ok:'), failed: after('f:') };
  const counted = (p: string) => Object.fromEntries(after(p).map((v) => { const i = v.indexOf(':'); return [v.slice(i + 1), Number(v.slice(0, i)) || 0] as const; }));
  return { mode: 'adaptive', streak: counted('s:'), wrong: counted('w:'), burned: after('b:'), credited: after('c:'), recheck: after('r:'), recheckStreak: Number(after('rs:')[0] ?? 0) || 0 };
}

/* -- Was eine Einstufung jetzt bedeutet (für den Spieler und den Anstoss an einer Wahl) ------------------------------------------------ */

/** Hat der Bereich noch offene Türme (adaptiv: die Front ist nicht leer)? */
export function hasOpen(ctx: Omit<PlacementCtx, 'random' | 'lastAnswered' | 'rules'>): boolean {
  return frontOf({ ...ctx, random: () => 0, lastAnswered: () => 0, rules: [] }, newAdaptive()).length > 0;
}

/* -- Der Anstoss an einer Wahl ------------------------------------------------------------------------------------------------------- */

interface FlowLike {
  readonly id: string;
  readonly start: string | null;
  readonly graph: { readonly nodes: readonly { readonly id: string; readonly type: string; readonly config: Readonly<Record<string, unknown>> }[]; readonly edges: readonly { readonly from: string; readonly out: string; readonly to: string }[] };
}

/** Der erste Schritt nach einem Ausgang (null: keiner). */
const after = (flow: FlowLike, from: string, out?: string): string | null => {
  const list = flow.graph.edges.filter((e) => e.from === from && (out === undefined || e.out === out));
  return list[0]?.to ?? null;
};

/** Die erste Einstufung auf einem Weg ab `from` — bevor die nächste Wahl kommt; Abstecher und Unterabläufe: wenn ihr Weg mit ihr beginnt. */
function exploreAlong(flow: FlowLike, from: string | null, flowOf: (id: string) => FlowLike | undefined, depth: number): ExploreConfig | null {
  const seen = new Set<string>();
  let at = from;
  for (let guard = 0; at !== null && guard < 60 && !seen.has(at); guard += 1) {
    seen.add(at);
    const n = flow.graph.nodes.find((x) => x.id === at);
    if (n === undefined) return null;
    if (n.type === 'explore') return readExplore(n.config);
    if (n.type === 'choice' || n.type === 'chapters' || n.type === 'end' || n.type === 'return') return null;
    if ((n.type === 'detour' || n.type === 'subflow') && depth === 0) {
      const inner = flowOf(str(n.config.flow));
      const found = inner === undefined ? null : exploreAlong(inner, inner.start, flowOf, 1);
      if (found !== null) return found;
    }
    at = after(flow, at);
  }
  return null;
}

/**
 * 2026-11-12 (Einstufung, „push") — die Einstufung auf dem Zweig einer Wahl: ein Schritt "explore" auf dem Zweig (vor der nächsten
 * Wahl), oder ein Abstecher / Unterablauf darauf, dessen Erzählung mit ihr beginnt. Null: keine (oder "push": false).
 */
export function exploreOnBranch(flow: FlowLike, choice: string, exit: string, flowOf: (id: string) => FlowLike | undefined): ExploreConfig | null {
  const found = exploreAlong(flow, after(flow, choice, exit), flowOf, 0);
  return found !== null && found.push ? found : null;
}

/** Eine Karte, die der Spieler als gekonnt überspringen würde (7a): sie zählt in der Einstufung als richtig, ohne gefragt zu werden. */
export const isKnownSkip = (state: Pick<WorldState, 'band'>, card: string): boolean => state.band(card) === 'known';
