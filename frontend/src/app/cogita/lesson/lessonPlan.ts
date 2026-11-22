/**
 * 2026-11-22 (I11, „Good knowledge worlds") — DIE PLANUNG EINER STUNDE, rein gerechnet (geprüft in `scripts/app-lesson-plan-check.mjs`).
 *
 * Die Lehrerin wählt einen ANFANG (das Haus, einen Turm oder einen Schritt) und ein ZIEL (einen Turm). Der Weg dazwischen ist der
 * von „Prowadź mnie tutaj" — dieselbe Rechnung (`worldmap/wmPlan.ts`, über die Welt, ihre Linien und ihren Stand), keine zweite:
 * die Kette der fehlenden Türme in der Reihenfolge ihrer Voraussetzungen, entlang ihrer Pfade, durch jede Gabelung.
 *
 * <b>Für wen gerechnet.</b> Für eine Klasse, die bei Null anfängt (ein neuer Lernender) — und die am Anfang steht: wer bei einem
 * Turm beginnt, kann ihn und alles darunter (seine Grundlage); wer bei einem Schritt beginnt, den Turm, an dem dessen Abschnitt
 * beginnt, samt Grundlage. Den tatsächlichen Stand der Klasse (die Fortschritte aller) rechnet die Planung nicht: er liegt
 * versiegelt bei jedem Einzelnen, und eine Stunde soll für die ganze Klasse taugen.
 *
 * <b>Was die Lehrerin danach tut</b>, ohne die Rechnung neu zu erfinden: Teile auslassen, Teile hinzufügen (einen Pfad, eine
 * Vertiefung, einen Turm, einen Weg zu einer Frage), Teile verschieben — eine Warnung, wenn etwas vor das kommt, was es braucht,
 * aber kein Verbot — und je Turm wählen: nur der Pfad, oder Pfad UND Turm (dann beantwortet die Klasse seine Fragen nacheinander
 * gemeinsam: Abstimmung, Verteilung, Antwort der Klasse — in derselben Sitzung).
 *
 * Aus den Teilen werden die Teile der Stunde (`LessonPart`): ein Pfad → seine Erzählung (ab einem Schritt), ein Turm mit Fragen
 * → seine Karten. Der Plan selbst (Anfang, Ziel, Teile mit ihren Schaltern) reist im versiegelten `config` der Sitzung mit
 * (`lessonApi.ts`), damit er wieder geöffnet, kopiert und erneut gestartet werden kann.
 */

import { HOME, isJunction, type Lines, type World } from '../worldmap/wmTypes';
import { plan as planRoute, type PlanStep } from '../worldmap/wmPlan';
import { flowSections, pathPlan, type QPath } from '../worldmap/wmPaths';
import { stateOf, type WorldSettings, type WorldState } from '../worldmap/wmState';
import { tourInput } from '../worldmap/WorldTour';
import type { LessonPart } from './lessonTally';

/* -- Was ein Plan ist ------------------------------------------------------------------------------------------------ */

export type PlanStart =
  | { readonly kind: 'home' }
  | { readonly kind: 'place'; readonly place: string }
  | { readonly kind: 'step'; readonly flow: string; readonly step: string };

/** Ein Teil des Plans. `skip`: ausgelassen (bleibt sichtbar, zum Wiederholen); `added`: von Hand dazu (darf wieder weg). */
export type PlanItem =
  | { readonly kind: 'path'; readonly key: string; readonly flow: string; readonly start?: { readonly step: string; readonly exit?: string }; readonly to: string | null; readonly skip: boolean; readonly added: boolean }
  | { readonly kind: 'tower'; readonly key: string; readonly place: string; readonly ask: boolean; readonly skip: boolean; readonly added: boolean }
  | { readonly kind: 'check'; readonly key: string; readonly path: string; readonly cards: readonly string[]; readonly skip: boolean; readonly added: boolean };

export interface LessonPlanDoc {
  readonly v: 1;
  readonly start: PlanStart;
  readonly target: string;
  readonly items: readonly PlanItem[];
}

/** Höchstens so viele Fragen je Turm in einer Stunde (eine Stunde ist kein Durchgang; das Ereignis bleibt klein). */
export const TOWER_QUESTIONS_MAX = 12;
/** Höchstens so viele Teile in einem Plan. */
export const PLAN_ITEMS_MAX = 80;

const pathKey = (flow: string, start?: { readonly step: string; readonly exit?: string }) => `p:${flow}:${start?.step ?? ''}:${start?.exit ?? ''}`;

export const pathItem = (flow: string, start: { readonly step: string; readonly exit?: string } | undefined, to: string | null, added = false): PlanItem =>
  ({ kind: 'path', key: pathKey(flow, start), flow, ...(start === undefined ? {} : { start }), to, skip: false, added });
export const towerItem = (place: string, ask = false, added = false): PlanItem => ({ kind: 'tower', key: `t:${place}`, place, ask, skip: false, added });
export const checkItem = (path: string, cards: readonly string[], added = false): PlanItem => ({ kind: 'check', key: `c:${path}`, path, cards: [...cards], skip: false, added });

/* -- Der Stand einer Klasse am Anfang --------------------------------------------------------------------------------- */

/** Wie sicher die Klasse kann, was vor dem Anfang liegt (wie „frisch gekonnt" im Rundgang, `WorldTour.tsx`). */
const KNOWN = 3;

/** Der Turm, an dem der Abschnitt eines Schritts beginnt (`null`: am Haus oder an einer Gabelung). */
export function stepStartPlace(lines: Lines, flow: string, step: string): string | null {
  const first = flowSections(lines, flow, step)[0];
  const sec = first === undefined ? undefined : lines.sections.get(first);
  return sec === undefined || sec.from === HOME || isJunction(sec.from) ? null : sec.from;
}

/** Was die Klasse am Anfang schon kann: der Turm des Anfangs und alles darunter. */
export function knownFrom(world: World, lines: Lines, start: PlanStart): Set<string> {
  const at = start.kind === 'home' ? null : start.kind === 'place' ? start.place : stepStartPlace(lines, start.flow, start.step);
  if (at === null || !world.places.has(at)) return new Set();
  return new Set([at, ...world.base(at)]);
}

/** Der Stand einer Klasse, die bei Null anfängt und am Anfang steht (alles davor erobert, die Pfade dorthin gefahren). */
export function classState(world: World, lines: Lines, settings: WorldSettings, known: ReadonlySet<string>, now = Date.now()): WorldState {
  const levels = Math.max(0, Math.round(settings.levels));
  const cards = new Map<string, number>();
  const reached = new Map<string, number>();
  for (const p of known) { cards.set(p, KNOWN); reached.set(p, levels); }
  const travelled = new Set([...lines.sections.values()].filter((s) => known.has(s.to)).map((s) => s.id));
  return stateOf(world, lines, tourInput(world, lines, { cards, levels: reached, perfect: new Set(known), travelled }, now), settings);
}

/* -- Der Weg: die Schritte des geführten Weges als Teile -------------------------------------------------------------- */

/**
 * Die Schritte eines Plans (`wmPlan.ts`) als Teile einer Stunde: jede Fahrt ein Pfad (eine Erzählung einmal — die Stunde spielt sie
 * bis zu ihrem Ende, durch ihre Gabelungen), jede Eroberung (Durchgang, Lernen, Können) ein Turm. Wiederholungen fallen weg: die
 * Klasse fängt bei Null an.
 */
export function itemsOfSteps(lines: Lines, steps: readonly PlanStep[], had: readonly PlanItem[] = [], added = false): PlanItem[] {
  const out: PlanItem[] = [];
  const flows = new Set(had.filter((i): i is Extract<PlanItem, { kind: 'path' }> => i.kind === 'path').map((i) => i.flow));
  const towers = new Set(had.filter((i): i is Extract<PlanItem, { kind: 'tower' }> => i.kind === 'tower').map((i) => i.place));
  for (const s of steps) {
    if (s.kind === 'travel') {
      const sec = lines.sections.get(s.section);
      if (sec === undefined || flows.has(sec.line)) continue;
      flows.add(sec.line);
      /* Der erste Abschnitt einer Linie: die Erzählung von ihrem Anfang (kein Sprung) — sonst ab dem Schritt, an dem er beginnt. */
      const first = lines.lines.get(sec.line)?.sections[0] === sec.id;
      out.push(pathItem(sec.line, first ? undefined : sec.start, sec.to, added));
    } else if (s.kind === 'run' || s.kind === 'know' || s.kind === 'learn') {
      if (towers.has(s.place)) continue;
      towers.add(s.place);
      out.push(towerItem(s.place, false, added));
    }
  }
  return out;
}

/** Der Weg vom Anfang zum Ziel — dieselbe Rechnung wie „Prowadź mnie tutaj". Leer: das Ziel kann die Klasse vom Anfang her schon. */
export function routeItems(state: WorldState, lines: Lines, start: PlanStart, target: string): PlanItem[] {
  if (!state.world.places.has(target)) return [];
  const first: PlanItem[] = [];
  /* Ein Anfang mitten in einem Pfad: dieser Pfad ab dem Schritt zuerst (statt ab seinem Anfang). */
  if (start.kind === 'step') {
    const secs = flowSections(lines, start.flow, start.step);
    const to = secs.length === 0 ? null : lines.sections.get(secs[secs.length - 1]!)?.to ?? null;
    first.push(pathItem(start.flow, { step: start.step }, to));
  }
  const route = planRoute(state, target);
  return [...first, ...itemsOfSteps(lines, route.steps, first)];
}

/** Ein Weg zu einer Frage als Teile (sein geführter Weg, `wmPaths.pathPlan`), dazu sein Abschluss (die Fragen am Ende). */
export function questionPathItems(state: WorldState, lines: Lines, path: QPath, had: readonly PlanItem[], checkCards: readonly string[]): PlanItem[] {
  const route = pathPlan({ state, lines, flowDone: () => false, checkPassed: () => false }, path);
  const out = itemsOfSteps(lines, route.steps, had, true);
  if (checkCards.length > 0 && !had.some((i) => i.key === `c:${path.id}`)) out.push(checkItem(path.id, checkCards, true));
  return out;
}

/* -- Ändern ------------------------------------------------------------------------------------------------------------ */

/** Teile dazu — was schon im Plan steht (derselbe Schlüssel), nicht noch einmal. `at`: hinter diesem Teil (sonst am Ende). */
export function addItems(items: readonly PlanItem[], more: readonly PlanItem[], at?: string): PlanItem[] {
  const fresh = more.filter((m, i) => !items.some((x) => x.key === m.key) && more.findIndex((y) => y.key === m.key) === i).map((m) => ({ ...m, added: true }));
  if (fresh.length === 0) return [...items];
  const index = at === undefined ? -1 : items.findIndex((x) => x.key === at);
  return index < 0 ? [...items, ...fresh].slice(0, PLAN_ITEMS_MAX) : [...items.slice(0, index + 1), ...fresh, ...items.slice(index + 1)].slice(0, PLAN_ITEMS_MAX);
}

/** Einen Teil um `delta` Stellen verschieben (an den Rändern bleibt er stehen). */
export function moveItem(items: readonly PlanItem[], key: string, delta: number): PlanItem[] {
  const from = items.findIndex((x) => x.key === key);
  if (from < 0) return [...items];
  const to = Math.max(0, Math.min(items.length - 1, from + delta));
  if (to === from) return [...items];
  const out = [...items];
  const [one] = out.splice(from, 1);
  out.splice(to, 0, one!);
  return out;
}

export const setSkip = (items: readonly PlanItem[], key: string, skip: boolean): PlanItem[] => items.map((x) => (x.key === key ? { ...x, skip } : x));
/** Nur der Pfad (`false`) oder Pfad und Turm (`true`): die Klasse beantwortet seine Fragen gemeinsam. */
export const setAsk = (items: readonly PlanItem[], key: string, ask: boolean): PlanItem[] => items.map((x) => (x.key === key && x.kind === 'tower' ? { ...x, ask } : x));
/** Nur was von Hand dazukam, verschwindet wieder (der berechnete Weg bleibt; auslassen geht immer). */
export const removeItem = (items: readonly PlanItem[], key: string): PlanItem[] => items.filter((x) => x.key !== key || !x.added);

/* -- Warnungen ------------------------------------------------------------------------------------------------------- */

export interface PlanWarning {
  /** Der Teil, der zu früh steht. */
  readonly key: string;
  /** Der Turm, den er braucht. */
  readonly needs: string;
  /** Der Teil, der diesen Turm erst später bringt. */
  readonly later: string;
}

/** Welche Türme ein Teil bringt: ein Pfad den Turm, zu dem er führt; ein Turm sich selbst. */
const provides = (world: World, it: PlanItem): string[] =>
  it.kind === 'path' ? (it.to !== null && world.places.has(it.to) ? [it.to] : []) : it.kind === 'tower' ? [it.place] : [];
/** Was ein Teil braucht: die Grundlage des Turms, zu dem er führt (bzw. der er ist). */
const needs = (world: World, it: PlanItem): string[] => {
  const at = it.kind === 'path' ? it.to : it.kind === 'tower' ? it.place : null;
  return at === null || !world.places.has(at) ? [] : [...world.base(at)].filter((p) => p !== at);
};

/** Was zu früh steht: ein Teil vor dem, was er braucht (ausgelassene zählen nicht; was die Klasse am Anfang kann, auch nicht). */
export function planWarnings(world: World, items: readonly PlanItem[], known: ReadonlySet<string> = new Set()): PlanWarning[] {
  const live = items.filter((x) => !x.skip);
  const first = new Map<string, number>();
  live.forEach((it, i) => { for (const p of provides(world, it)) if (!first.has(p)) first.set(p, i); });
  const out: PlanWarning[] = [];
  live.forEach((it, i) => {
    for (const n of needs(world, it)) {
      if (known.has(n)) continue;
      const at = first.get(n);
      if (at !== undefined && at > i && !out.some((w) => w.key === it.key && w.needs === n)) out.push({ key: it.key, needs: n, later: live[at]!.key });
    }
  });
  return out;
}

/* -- Die Teile der Stunde ---------------------------------------------------------------------------------------------- */

/**
 * Was gespielt wird: jeder nicht ausgelassene Pfad (seine Erzählung, ab einem Schritt), jeder Turm mit „Pfad und Turm" (seine
 * Fragen, höchstens `TOWER_QUESTIONS_MAX`), jeder Abschluss eines Weges zu einer Frage. Ein Turm „nur Pfad" spielt nichts Eigenes.
 */
export function lessonPartsOf(items: readonly PlanItem[], cardsOf: (place: string) => readonly string[]): LessonPart[] {
  const out: LessonPart[] = [];
  for (const it of items) {
    if (it.skip) continue;
    if (it.kind === 'path') out.push({ flow: it.flow, ...(it.start === undefined ? {} : { start: it.start }) });
    else if (it.kind === 'tower' && it.ask) {
      const cards = cardsOf(it.place).slice(0, TOWER_QUESTIONS_MAX);
      if (cards.length > 0) out.push({ questions: cards, tower: it.place });
    } else if (it.kind === 'check' && it.cards.length > 0) out.push({ questions: it.cards.slice(0, TOWER_QUESTIONS_MAX), path: it.path });
  }
  return out;
}

/* -- Gespeichert und wieder gelesen ------------------------------------------------------------------------------------ */

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const isObj = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === 'object' && v !== null && !Array.isArray(v);

function readStart(v: unknown): PlanStart {
  if (!isObj(v)) return { kind: 'home' };
  if (v.kind === 'place' && str(v.place) !== '') return { kind: 'place', place: str(v.place) };
  if (v.kind === 'step' && str(v.flow) !== '' && str(v.step) !== '') return { kind: 'step', flow: str(v.flow), step: str(v.step) };
  return { kind: 'home' };
}

function readItem(v: unknown): PlanItem | null {
  if (!isObj(v)) return null;
  const skip = v.skip === true;
  const added = v.added === true;
  if (v.kind === 'path' && str(v.flow) !== '') {
    const s = isObj(v.start) && str(v.start.step) !== '' ? { step: str(v.start.step), ...(str(v.start.exit) !== '' ? { exit: str(v.start.exit) } : {}) } : undefined;
    return { ...pathItem(str(v.flow), s, str(v.to) === '' ? null : str(v.to), added), skip };
  }
  if (v.kind === 'tower' && str(v.place) !== '') return { ...towerItem(str(v.place), v.ask === true, added), skip };
  if (v.kind === 'check' && str(v.path) !== '') {
    const cards = (Array.isArray(v.cards) ? v.cards : []).filter((c): c is string => typeof c === 'string' && c !== '').slice(0, TOWER_QUESTIONS_MAX);
    return { ...checkItem(str(v.path), cards, added), skip };
  }
  return null;
}

/** Ein gespeicherter Plan (aus dem `config` einer Stunde) — `null`: keiner. Unlesbares fällt weg. */
export function readPlanDoc(raw: unknown): LessonPlanDoc | null {
  if (!isObj(raw) || str(raw.target) === '') return null;
  const items: PlanItem[] = [];
  for (const one of Array.isArray(raw.items) ? raw.items : []) {
    const it = readItem(one);
    if (it !== null && !items.some((x) => x.key === it.key)) items.push(it);
    if (items.length >= PLAN_ITEMS_MAX) break;
  }
  return { v: 1, start: readStart(raw.start), target: str(raw.target), items };
}
