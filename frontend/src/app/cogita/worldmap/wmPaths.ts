/**
 * 2026-11-12 (Prompt 25) — WEGE ZU EINER FRAGE („Dlaczego ksiądz Bosko założył salezjanów?"), rein. Ein Lernender kommt oft mit
 * einer Frage, nicht mit einem Ort. Ein Weg (Dokument der Baza, Art `qpath`, im Kurs-JSON die Liste "paths") ist ein ANGEBOT:
 * <code>
 *   name      die Frage selbst                      promise   ein Satz: „Danach kannst du sagen, warum …"
 *   steps     Orte (Thema; "level": eine zweite Runde höher — die Spirale) und Erzählungen (ein Ablauf, "from": ab einem Schritt),
 *             je mit "why" (ein Satz: warum dieser Schritt)
 *   anchors   wo er angeboten wird: "home", ein Ort, oder {"flow", "step"} (eine Gabelung, ein Schritt auf einem Pfad) — auf
 *             der Karte steht dort ein Wegweiser (ohne eigene Karten; sein Text ist die Frage); das Haus listet alle Wege
 *   check     der Abschluss: 1–3 Fragen ({"questions": [...]}) oder eine Folie ({"slide": …})
 *   deeper    ein tieferer Weg, angeboten, wenn dieser erledigt ist („Głębiej")
 * </code>
 * Er ändert NIE Voraussetzungen, Reihenfolge, Höhen, Kenntnis oder Stufen; wer ihn auslässt, verliert nichts (der Fortschritt
 * liegt in den Orten und Karten). Erledigt (je Lernendem, Wert `~qpath.<id>`) ist er, wenn seine Schritte erledigt sind und der
 * Abschluss bestanden ist. Geführt wird er wie „Prowadź mnie tutaj": `pathPlan` reiht die Pläne seiner offenen Schritte aneinander
 * (`wmPlan.ts`, Bekanntes fällt weg) — die Navigation, die Kette und der Blick auf den Weg nehmen ihn wie jeden Plan.
 */

import { plan as planRoute, type Plan, type PlanStep } from './wmPlan';
import type { Scene } from './wmScene';
import type { WorldState } from './wmState';
import { HOME, type Lines } from './wmTypes';

/** Ziel der Navigation (und „Ustaw jako cel") für einen Weg: `~path:<id>`. */
export const PATH_TARGET = '~path:';
export const isPathTarget = (id: string | null | undefined): id is string => typeof id === 'string' && id.startsWith(PATH_TARGET);
export const pathOfTarget = (id: string): string => id.slice(PATH_TARGET.length);
/** Der Wert beim Lernenden: der Abschluss bestanden (Zeitpunkt). */
export const PATH_DONE = '~qpath.';

export type QStep =
  | { readonly kind: 'place'; readonly place: string; readonly level?: number; readonly why?: string }
  | { readonly kind: 'flow'; readonly flow: string; readonly from?: string; readonly why?: string };
export type QAnchor = { readonly kind: 'home' } | { readonly kind: 'place'; readonly place: string } | { readonly kind: 'track'; readonly flow: string; readonly step: string };
export type QCheck = { readonly kind: 'questions'; readonly questions: readonly string[] } | { readonly kind: 'slide'; readonly slide: string };

export interface QPath {
  readonly id: string;
  /** Die Frage. */
  readonly title: string;
  readonly promise: string;
  readonly steps: readonly QStep[];
  readonly anchors: readonly QAnchor[];
  readonly check: QCheck | null;
  readonly deeper: string | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const obj = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Höchstens so viele Fragen im Abschluss. */
export const CHECK_MAX = 3;

/** Ein Weg aus seinem Dokument (fehlerhafte Teile fallen weg; `pathProblems` nennt sie). */
export function readPath(id: string, data: Readonly<Record<string, unknown>>): QPath {
  const steps: QStep[] = [];
  for (const s of Array.isArray(data.steps) ? data.steps : []) {
    if (!obj(s)) continue;
    const why = str(s.why);
    const w = why === '' ? {} : { why };
    if (str(s.place) !== '') {
      const level = typeof s.level === 'number' && Number.isFinite(s.level) && s.level >= 1 ? Math.round(s.level) : undefined;
      steps.push({ kind: 'place', place: str(s.place), ...(level === undefined ? {} : { level }), ...w });
    } else if (str(s.flow) !== '') steps.push({ kind: 'flow', flow: str(s.flow), ...(str(s.from) === '' ? {} : { from: str(s.from) }), ...w });
  }
  const anchors: QAnchor[] = [];
  for (const a of Array.isArray(data.anchors) ? data.anchors : []) {
    if (a === 'home' || a === HOME || a === 'start') anchors.push({ kind: 'home' });
    else if (typeof a === 'string' && a.trim() !== '') anchors.push({ kind: 'place', place: a.trim() });
    else if (obj(a) && str(a.flow) !== '' && str(a.step) !== '') anchors.push({ kind: 'track', flow: str(a.flow), step: str(a.step) });
    else if (obj(a) && str(a.place) !== '') anchors.push({ kind: 'place', place: str(a.place) });
  }
  const c = data.check;
  const check: QCheck | null = obj(c) && Array.isArray(c.questions) && c.questions.some((q) => str(q) !== '')
    ? { kind: 'questions', questions: c.questions.map(str).filter((q) => q !== '').slice(0, CHECK_MAX) }
    : obj(c) && str(c.slide) !== '' ? { kind: 'slide', slide: str(c.slide) } : null;
  return { id, title: str(data.name) || str(data.title), promise: str(data.promise), steps, anchors, check, deeper: str(data.deeper) || null };
}

/** Wo ein Anker steht (ein Schlüssel je Stelle: mehrere Wege an derselben Stelle teilen einen Wegweiser). */
export const anchorKey = (a: QAnchor): string => (a.kind === 'home' ? 'home' : a.kind === 'place' ? `p:${a.place}` : `t:${a.flow}#${a.step}`);

/** Die Abschnitte einer Erzählung auf der Karte, in ihrer Reihenfolge — mit `from` ab dem Abschnitt, der diesen Schritt enthält. */
export function flowSections(lines: Lines, flow: string, from?: string): string[] {
  const line = lines.lines.get(flow);
  const all = line === undefined ? [...lines.sections.values()].filter((s) => s.line === flow).map((s) => s.id) : [...line.sections];
  if (from === undefined) return all;
  const has = (id: string) => (lines.sections.get(id)?.steps ?? []).some((x) => x === from || x.endsWith(`>${from}`)) || lines.sections.get(id)?.start?.step === from;
  const at = all.findIndex(has);
  return at < 0 ? all : all.slice(at);
}

export interface PathCtx {
  readonly state: WorldState;
  readonly lines: Lines;
  /** Die Erzählung ist zu Ende gespielt (ihr Stand beim Lernenden). */
  readonly flowDone: (flow: string) => boolean;
  /** Der Abschluss des Weges ist bestanden (`~qpath.<id>`). */
  readonly checkPassed: (path: string) => boolean;
}

export type StepState = 'done' | 'open' | 'locked';

/** Ist ein Ort-Schritt erreicht? Mit `level`: die Stufe (ohne Stufen: erobert); sonst passierbar (die Stufe, die weiterführt). */
const placeDone = (state: WorldState, step: Extract<QStep, { kind: 'place' }>): boolean => {
  const ps = state.places.get(step.place);
  if (ps === undefined) return false;
  if (step.level === undefined) return ps.passable;
  return state.settings.levels <= 0 ? ps.conquered : ps.level >= Math.min(step.level, state.settings.levels);
};

export function stepState(ctx: PathCtx, step: QStep): StepState {
  const { state, lines } = ctx;
  if (step.kind === 'place') {
    if (!state.places.has(step.place)) return 'locked';
    if (placeDone(state, step)) return 'done';
    /* Offen: nichts davor fehlt (die nicht passierbare Grundlage ist nur er selbst). */
    return state.conquestOrder(step.place).every((p) => p === step.place) ? 'open' : 'locked';
  }
  const secs = flowSections(lines, step.flow, step.from);
  if (secs.length === 0) return ctx.flowDone(step.flow) ? 'done' : 'locked';
  if (ctx.flowDone(step.flow) || secs.every((id) => state.sections.get(id)?.travelled === true)) return 'done';
  const first = secs.find((id) => state.sections.get(id)?.travelled !== true);
  return first !== undefined && state.sections.get(first)?.open === true ? 'open' : 'locked';
}

export type PathStatus = 'new' | 'going' | 'done';

/** Nicht begonnen · unterwegs · erledigt (erledigt bleibt, was einmal bestanden ist; ohne Abschluss: alle Schritte erledigt). */
export function pathStatus(ctx: PathCtx, path: QPath): PathStatus {
  if (ctx.checkPassed(path.id)) return 'done';
  const states = path.steps.map((s) => stepState(ctx, s));
  if (path.check === null && states.length > 0 && states.every((s) => s === 'done')) return 'done';
  return states.some((s) => s === 'done') ? 'going' : 'new';
}

/** Alle Schritte erledigt — jetzt der Abschluss (oder, ohne ihn, erledigt). */
export const stepsDone = (ctx: PathCtx, path: QPath): boolean => path.steps.every((s) => stepState(ctx, s) === 'done');

const keyOf = (s: PlanStep): string =>
  s.kind === 'travel' ? `travel:${s.section}` : s.kind === 'review' ? `review:${s.section}` : s.kind === 'run' ? `run:${s.place}:${s.level}` : `${s.kind}:${s.place}`;

/**
 * DER GEFÜHRTE WEG: je offener Schritt sein Plan (der Weg dorthin, Bekanntes fällt weg), aneinandergereiht; ein Schritt, den ein
 * früherer schon enthält, kommt nicht zweimal. Eine Erzählung: der Weg zu ihrem Anfang, dann ihre noch nicht befahrenen Abschnitte.
 * Die zweite Runde an einem Ort (höhere Stufe) ist ein Durchgang an ihm. Das Ziel heisst `~path:<id>`.
 */
export function pathPlan(ctx: PathCtx, path: QPath, choices?: ReadonlyMap<string, string>): Plan {
  const { state, lines } = ctx;
  const steps: PlanStep[] = [];
  const places: string[] = [];
  const route: string[] = [];
  const seen = new Set<string>();
  let cards = 0;
  const take = (p: Plan) => {
    for (const s of p.steps) { const k = keyOf(s); if (seen.has(k)) continue; seen.add(k); steps.push(s); }
    for (const x of p.places) if (!places.includes(x)) places.push(x);
    for (const r of p.route) if (!route.includes(r)) route.push(r);
    cards += p.cards;
  };
  const opts = choices === undefined ? {} : { choices };
  for (const step of path.steps) {
    if (stepState(ctx, step) === 'done') continue;
    if (step.kind === 'place') {
      if (!state.places.has(step.place)) continue;
      const p = planRoute(state, step.place, opts);
      if (p.steps.length > 0) { take(p); continue; }
      /* Die zweite Runde: der Ort ist schon passierbar, die verlangte Stufe fehlt — ein Durchgang an ihm. */
      const ps = state.places.get(step.place)!;
      const run: PlanStep = { kind: 'run', place: step.place, level: ps.level, upTo: step.level ?? state.settings.levels, cards: ps.cards.length, unseen: ps.cards.filter((k) => state.band(k) === 'unseen'), prepare: [] };
      const k = keyOf(run);
      if (!seen.has(k)) { seen.add(k); steps.push(run); if (!places.includes(step.place)) places.push(step.place); }
      continue;
    }
    const secs = flowSections(lines, step.flow, step.from).filter((id) => state.sections.get(id)?.travelled !== true);
    for (const id of secs) {
      const s = lines.sections.get(id);
      const st = state.sections.get(id);
      if (s === undefined || st === undefined) continue;
      /* Zum Anfang des Abschnitts (ein Turm, der noch nicht passierbar ist, wird vorher genommen). */
      if (s.from !== HOME && state.places.has(s.from) && state.places.get(s.from)?.passable !== true) take(planRoute(state, s.from, opts));
      const travel: PlanStep = { kind: 'travel', place: s.to, section: id, cards: s.introduces, locked: !st.open, alternatives: [] };
      const k = keyOf(travel);
      if (seen.has(k)) continue;
      seen.add(k);
      steps.push(travel);
      if (!route.includes(id)) route.push(id);
      cards += st.fresh.length;
    }
  }
  return { target: `${PATH_TARGET}${path.id}`, places, steps, cards, route };
}

/** Wie lang ein Weg ist: Folien und Fragen seiner Erzählungen, Karten seiner Orte. */
export function pathLength(state: WorldState, lines: Lines, path: QPath): { readonly slides: number; readonly questions: number; readonly cards: number } {
  let slides = 0, questions = 0, cards = 0;
  const counted = new Set<string>();
  for (const step of path.steps) {
    if (step.kind === 'place') {
      if (counted.has(`p:${step.place}`)) continue;
      counted.add(`p:${step.place}`);
      cards += state.places.get(step.place)?.cards.length ?? 0;
      continue;
    }
    for (const id of flowSections(lines, step.flow, step.from)) {
      if (counted.has(id)) continue;
      counted.add(id);
      const s = lines.sections.get(id);
      if (s !== undefined) { slides += s.slides; questions += s.questions.length; }
    }
  }
  if (path.check?.kind === 'questions') questions += path.check.questions.length;
  if (path.check?.kind === 'slide') slides += 1;
  return { slides, questions, cards };
}

/** Ein Wegweiser auf der Karte: wo (Boden), welche Wege dort hängen. */
export interface Sign {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly paths: readonly string[];
}

/**
 * Wo die Wegweiser stehen (keine Koordinaten im Import — die App stellt sie neben ihren Anker): an einem Ort vorn rechts neben der
 * Säule, am Haus daneben, an einer Gabelung neben ihrem Knoten, an einem Schritt auf einem Pfad neben der Mitte seines Abschnitts.
 * Was die Karte nicht zeigt (ein Ort ausserhalb dieses Widoku, ein Schritt ohne Abschnitt), bekommt keinen Wegweiser.
 */
export function signsOf(paths: readonly QPath[], scene: Scene, lines: Lines): Sign[] {
  const at = new Map<string, { x: number; y: number; paths: string[] }>();
  const add = (key: string, x: number, y: number, id: string) => { const s = at.get(key) ?? { x, y, paths: [] }; if (!s.paths.includes(id)) s.paths.push(id); at.set(key, s); };
  for (const p of paths) {
    for (const a of p.anchors) {
      const key = anchorKey(a);
      if (a.kind === 'home') { if (scene.home !== null) add(key, scene.home.x + scene.home.r * 1.5, scene.home.y + scene.home.r * 0.4, p.id); continue; }
      if (a.kind === 'place') { const sp = scene.byId.get(a.place); if (sp !== undefined) add(key, sp.x + sp.r * 1.05, sp.y + sp.r * 0.75, p.id); continue; }
      const jn = [...lines.junctions.values()].find((j) => j.line === a.flow && j.step === a.step);
      const sj = jn === undefined ? undefined : scene.junctions.find((j) => j.id === jn.id);
      if (sj !== undefined) { add(key, sj.x + 14, sj.y + 10, p.id); continue; }
      const sec = flowSections(lines, a.flow, a.step)[0];
      const lane = sec === undefined ? undefined : scene.lanes.find((l) => l.section === sec);
      if (lane === undefined || lane.points.length < 2) continue;
      const mid = Math.floor(lane.points.length / 4) * 2;
      const nx = lane.points[Math.min(lane.points.length - 2, mid + 2)]! - lane.points[mid]!, ny = lane.points[Math.min(lane.points.length - 1, mid + 3)]! - lane.points[mid + 1]!;
      const len = Math.hypot(nx, ny) || 1;
      add(key, lane.points[mid]! - (ny / len) * 12, lane.points[mid + 1]! + (nx / len) * 12, p.id);
    }
  }
  return [...at].map(([key, s]) => ({ key, x: s.x, y: s.y, paths: s.paths }));
}

/** Was an einem Weg nicht stimmt (für den Import und die Liste der Schreibenden): ein Schlüssel der Übersetzung und seine Werte. */
export interface PathProblem { readonly path: string; readonly key: string; readonly params: Readonly<Record<string, string | number>> }

export interface PathCheckCtx {
  /** Gibt es diesen Eintrag (einen Ort)? */
  readonly entity: (id: string) => boolean;
  /** Die Schritte eines Ablaufs (undefined: kein Ablauf). */
  readonly flowSteps: (id: string) => ReadonlySet<string> | undefined;
  /** Gibt es diesen Weg? */
  readonly path: (id: string) => QPath | undefined;
  /** Optional (auf der Karte): steht der Ort auf der Weltkarte, hat die Erzählung dort Abschnitte? */
  readonly onMap?: { readonly place: (id: string) => boolean; readonly flow: (id: string) => boolean };
}

/**
 * DIE PRÜFUNG EINES WEGES: ein unbekannter Ort, ein unbekannter Ablauf oder Schritt, ein Anker, den es nicht gibt, ein Schritt, der
 * nicht zu erreichen ist (nicht auf der Karte), eine Schleife ("deeper" führt zu ihm zurück; derselbe Schritt zweimal hintereinander),
 * zu viele Fragen im Abschluss, ein Weg ohne Schritte oder ohne Frage.
 */
export function pathProblems(path: QPath, raw: Readonly<Record<string, unknown>>, ctx: PathCheckCtx): PathProblem[] {
  const out: PathProblem[] = [];
  const name = path.title || path.id;
  const add = (key: string, params: Record<string, string | number> = {}) => out.push({ path: path.id, key, params: { name, ...params } });
  if (path.title === '') add('qpathNoTitle');
  if (path.steps.length === 0) add('qpathNoSteps');
  path.steps.forEach((s, i) => {
    const n = i + 1;
    if (s.kind === 'place') {
      if (!ctx.entity(s.place)) add('qpathPlace', { n, ref: s.place });
      else if (ctx.onMap !== undefined && !ctx.onMap.place(s.place)) add('qpathUnreachable', { n, ref: s.place });
    } else {
      const steps = ctx.flowSteps(s.flow);
      if (steps === undefined) add('qpathFlow', { n, ref: s.flow });
      else if (s.from !== undefined && !steps.has(s.from)) add('qpathFrom', { n, ref: s.from });
      else if (ctx.onMap !== undefined && !ctx.onMap.flow(s.flow)) add('qpathUnreachable', { n, ref: s.flow });
    }
    const prev = path.steps[i - 1];
    if (prev !== undefined && JSON.stringify({ ...prev, why: undefined }) === JSON.stringify({ ...s, why: undefined })) add('qpathRepeat', { n });
  });
  for (const a of path.anchors) {
    if (a.kind === 'place' && !ctx.entity(a.place)) add('qpathAnchor', { ref: a.place });
    if (a.kind === 'track') {
      const steps = ctx.flowSteps(a.flow);
      if (steps === undefined || !steps.has(a.step)) add('qpathAnchor', { ref: `${a.flow} · ${a.step}` });
    }
  }
  const rawAnchors = Array.isArray(raw.anchors) ? raw.anchors.length : 0;
  if (rawAnchors > path.anchors.length) add('qpathAnchorShape');
  if (path.check?.kind === 'questions') { for (const q of path.check.questions) if (!ctx.entity(q)) add('qpathCheck', { ref: q }); }
  if (path.check?.kind === 'slide' && !ctx.entity(path.check.slide)) add('qpathCheck', { ref: path.check.slide });
  const rawQ = obj(raw.check) && Array.isArray(raw.check.questions) ? raw.check.questions.length : 0;
  if (rawQ > CHECK_MAX) add('qpathCheckMany', { count: rawQ, max: CHECK_MAX });
  /* "deeper": ein Weg, den es gibt, und keine Schleife zurück zu diesem. */
  if (path.deeper !== null) {
    if (ctx.path(path.deeper) === undefined) add('qpathDeeper', { ref: path.deeper });
    else {
      const seen = new Set<string>([path.id]);
      let at: string | null = path.deeper;
      while (at !== null) {
        if (seen.has(at)) { add('qpathLoop'); break; }
        seen.add(at);
        at = ctx.path(at)?.deeper ?? null;
      }
    }
  }
  return out;
}
