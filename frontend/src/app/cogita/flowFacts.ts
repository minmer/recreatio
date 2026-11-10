/**
 * 2026-11-03 (G) — WAS ÜBER DIE ERZÄHLUNGEN EINES LERNENDEN BEKANNT IST, für die Bedingung „Przebieg" der einen Logik
 * (`{"type": "flow", "flow": "@ref", "state": "done"}` in Widoki, Powtórki, Krajobraz): je Ablauf der Baza begonnen,
 * zu Ende (ein Ende erreicht), welche Ziele — aus seinen Stellen (`FlowPosition`). Eine Präsentation, auf die ein
 * Ablauf zeigt, merkt sich ihre Stelle unter `page:<seite>` mit ihrem Pfad: gefunden wird sie über ihn.
 */

import { texts } from '../core/i18n';
import { goalsReached, readFlow, type Flow, type FlowState } from './flow';
import { positionFor, type FlowPosition } from './learn';
import type { Facts, FlowFacts } from './logic';
import { forkChoices, forkRoutes, goalsToPass, reviewOnRoute, type GoalFlow } from './mountain';

/** Ein Pfad ohne „#/" und gross/klein. */
const bare = (path: string): string => path.trim().replace(/^#?\/?/, '').replace(/\/+$/, '').toLowerCase();

/** Ein Ablauf, wie die Bedingung ihn braucht: seine Kennung, und die Präsentation, auf die er zeigt. */
export interface FlowRef {
  readonly id: string;
  /** Der bleibende Name (2026-11-04, Prompt 13): die Stelle eines neu eingespielten Ablaufs. */
  readonly ref?: string;
  readonly presentation?: string;
  /** 2026-11-10 — der Ablauf hat Gabelungen (`mountain.ts`): seine Fakten nennen dann den letzten Lauf (`visited`). */
  readonly forked?: boolean;
}

/** 2026-11-10 — was über eine Erzählung bekannt ist; bei Gabelungen dazu die Schritte ihres letzten Laufs (welcher Zweig). */
export interface StoryFacts extends FlowFacts {
  readonly visited?: readonly string[];
}

export function flowFactsOf(positions: ReadonlyMap<string, FlowPosition> | undefined, flows: readonly FlowRef[]): Map<string, StoryFacts> {
  const out = new Map<string, StoryFacts>();
  if (positions === undefined || positions.size === 0) return out;
  const byPath = new Map<string, FlowPosition>();
  for (const p of positions.values()) {
    if (typeof p.path !== 'string' || p.path === '') continue;
    const k = bare(p.path);
    const had = byPath.get(k);
    if (had === undefined || had.at <= p.at) byPath.set(k, p);
  }
  for (const f of flows) {
    const found = [positionFor(positions, f), f.presentation === undefined ? undefined : byPath.get(bare(f.presentation))].filter((p): p is FlowPosition => p !== undefined);
    if (found.length === 0) continue;
    /* 2026-11-10 — mit Gabelungen: welcher Zweig — die Schritte des jüngsten Laufs (Ende und Ziele wachsen nur, das Besuchte nicht). */
    const last = found.reduce((a, b) => (b.at > a.at ? b : a));
    const run = f.forked === true && Array.isArray(last.visited) ? { visited: last.visited } : {};
    out.set(f.id, { started: true, done: found.some((p) => p.done === true), goals: [...new Set(found.flatMap((p) => p.goals ?? []))], ...run });
  }
  return out;
}

/** 2026-11-10 — hat das Dokument eines Ablaufs Gabelungen? (einmal je gelesenem Dokument; ohne „choice" gar nicht erst gelesen) */
const FORKED = new WeakMap<object, boolean>();
function forkedDoc(d: { readonly id: string; readonly data: Readonly<Record<string, unknown>> }): boolean {
  const had = FORKED.get(d.data);
  if (had !== undefined) return had;
  const g = d.data.graph;
  const nodes: unknown = typeof g === 'object' && g !== null ? (g as { nodes?: unknown }).nodes : undefined;
  const choice = Array.isArray(nodes) && nodes.some((n) => typeof n === 'object' && n !== null && (n as { type?: unknown }).type === 'choice');
  const forked = choice && forkChoices(readFlow(d.id, d.data)).size > 0;
  FORKED.set(d.data, forked);
  return forked;
}

/** Die Abläufe einer Baza (Kennung, Präsentation). */
export const flowRefsOf = (lib: { docs(kind: 'flow'): readonly { readonly id: string; readonly data: Readonly<Record<string, unknown>> }[] }): FlowRef[] =>
  lib.docs('flow').map((d) => ({
    id: d.id,
    ...(typeof d.data._ref === 'string' && d.data._ref !== '' ? { ref: d.data._ref } : {}),
    ...(typeof d.data.presentation === 'string' && d.data.presentation.trim() !== '' ? { presentation: d.data.presentation } : {}),
    ...(forkedDoc(d) ? { forked: true } : {})
  }));

/** Was über die Erzählungen dieses Lernenden in dieser Baza bekannt ist. */
export const learnerFlows = (lib: Parameters<typeof flowRefsOf>[0], positions: ReadonlyMap<string, FlowPosition> | undefined): Map<string, StoryFacts> =>
  flowFactsOf(positions, flowRefsOf(lib));

/**
 * 2026-11-03 (Prompt 5) — WO EIN LERNENDER IN EINER ERZÄHLUNG STEHT: neu, begonnen, zu Ende mit offenen Zielen (der
 * Przegląd ist noch nicht bestanden), bestanden (zu Ende und jedes Ziel erreicht; ein Ablauf ohne Ziele: zu Ende). Nur
 * „bestanden" senkt die Einheit der Erzählung ins Tal.
 */
export type StoryStage = 'new' | 'started' | 'review' | 'passed';

/**
 * 2026-11-10 — JEDES ZIEL, DAS ZÄHLT, ist erreicht: ohne Gabelung jedes Ziel (wie bisher); mit Gabelungen die Ziele des Zweiges,
 * den der letzte Lauf zu Ende ging (`goalsToPass`) — der Przegląd eines anderen Turms hält niemanden auf. Weiss man den Zweig
 * nicht (kein Ende im letzten Lauf, z. B. nach „od początku"), jedes Ziel (wie bisher).
 */
const goalsMet = (flow: GoalFlow, facts: StoryFacts): boolean => goalsToPass(flow, facts.visited).some((ids) => ids.every((id) => facts.goals.includes(id)));

/**
 * 2026-11-06 — ZU ENDE GEGANGEN, nicht nur gekonnt: ein Ende erreicht und jedes Ziel (der gemeinsame Przegląd). `storyStage` sagt
 * „passed" auch, wenn nur alle Pflichtfragen gekonnt sind (das Feld sinkt ins Tal, wie bisher) — das hier unterscheidet beides.
 */
export const storyCompleted = (flow: GoalFlow, facts: StoryFacts | undefined): boolean =>
  facts !== undefined && facts.done && goalsMet(flow, facts);
export function storyStage(flow: GoalFlow, facts: StoryFacts | undefined, questionsKnown = false): StoryStage {
  /*
    2026-11-05 (Prompt 23, C4) — KANN DER LERNENDE JEDE FRAGE DER ERZÄHLUNG (Band „znane", aus der ganzen Geschichte), ist sie
    bestanden — auch ungespielt oder ohne bestandenen Przegląd (ihr Ziel prüft ja dasselbe): die Einheit sinkt ins Tal. Gerechnet,
    nie gespeichert — wer etwas vergisst, sieht die Erzählung wieder als offen. (`questionsKnown`, `flowQuestionsKnown`.)
  */
  if (questionsKnown) return 'passed';
  if (facts === undefined || !facts.started) return 'new';
  if (!facts.done) return 'started';
  return goalsMet(flow, facts) ? 'passed' : 'review';
}

/**
 * 2026-11-05 (Prompt 23, C4) — sind ALLE Fragen, die eine Erzählung stellt (ihre Schritte „question"), gekonnt? Ohne eine Frage:
 * nein (eine Erzählung zum Lesen wird gelesen, nicht gewusst). `known`: die Karte (Schlüssel) ist im Band „znane".
 */
export function flowQuestionsKnown(flow: Pick<Flow, 'graph'> & { readonly start?: string | null }, cardOf: (id: string) => { readonly key: string } | null, known: (key: string) => boolean): boolean {
  /*
    2026-11-06 — mit Wahlen („choice"): nur die Fragen auf jedem Weg (`mountain.ts`); eine Frage eines einzelnen Weges zählt nicht.
    2026-11-10 — mit Gabelungen genügt EIN Zweig: alle seine Pflichtfragen (die gemeinsamen davor und seine eigenen) gekonnt;
    die anderen Zweige bleiben offene Wege. Ohne Gabelung ist das der eine Zweig (wie bisher).
  */
  const nodes = new Map(flow.graph.nodes.map((n) => [n.id, n] as const));
  const sure = new Map<string, boolean>();
  /* `null`: die Frage hat keine Karte (sie zählt nicht), sonst: gekonnt? */
  const knownAt = (step: string): boolean | null => {
    const c: Readonly<Record<string, unknown>> = nodes.get(step)?.config ?? {};
    const id = typeof c.of === 'string' && c.of !== '' ? c.of : typeof c.card === 'string' ? c.card : '';
    const card = id === '' ? null : cardOf(id);
    if (card === null) return null;
    if (!sure.has(card.key)) sure.set(card.key, known(card.key));
    return sure.get(card.key)!;
  };
  return forkRoutes(flow).some((route) => {
    let any = false;
    for (const step of route.mandatory) {
      const k = knownAt(step);
      if (k === null) continue;
      any = true;
      if (!k) return false;
    }
    return any;
  });
}

/** 2026-11-05 (Prompt 23, C4) — die Karte einer Frage (ihre Kennung oder der Schlüssel einer Karte) — einmal je Kartensatz. */
const CARD_OF = new WeakMap<readonly object[], Map<string, { readonly key: string }>>();
export function cardOfQuestion(cards: readonly { readonly key: string; readonly question: string }[]): (id: string) => { readonly key: string } | null {
  let m = CARD_OF.get(cards);
  if (m === undefined) {
    m = new Map();
    for (const c of cards) { if (!m.has(c.question)) m.set(c.question, c); if (!m.has(c.key)) m.set(c.key, c); }
    CARD_OF.set(cards, m);
  }
  const map = m;
  return (id) => map.get(id) ?? null;
}

/** Der eine Knopf einer Erzählung, nach ihrem Stand (er öffnet den Spieler: an der Stelle des Lernenden; „Powtórz przegląd" am Przegląd). */
export const STORY_BUTTON: Readonly<Record<StoryStage, string>> = texts({
  new: 'cogitaLearn.words.storyButton.new', started: 'cogitaLearn.words.storyButton.started', review: 'cogitaLearn.words.storyButton.review', passed: 'cogitaLearn.words.storyButton.passed'
});

/**
 * Wohin „Powtórz przegląd" springt: der Teil des Przeglądu (`review`), sonst der Anfang (eine Präsentation: ihre erste Szene, leer).
 * 2026-11-10 — mit Gabelungen und dem letzten Lauf (`visited` aus `StoryFacts`): der Przegląd auf dem Zweig des Lernenden, nicht
 * der eines anderen Turms (`reviewOnRoute`).
 */
export const reviewStart = (flow: Pick<Flow, 'review' | 'presentation' | 'start'> & Partial<Pick<Flow, 'graph'>>, visited?: readonly string[]): string =>
  (visited === undefined || flow.graph === undefined ? null : reviewOnRoute({ ...flow, graph: flow.graph }, visited)) ?? flow.review ?? (flow.presentation !== undefined ? '' : flow.start ?? '');

/** Die Einheiten, die Erzählungen sind (ein Ablauf zeigt auf sie, eigene Karten haben sie keine) — Einheit → Ablauf. */
export function storyUnitsOf(lib: { docs(kind: 'flow'): readonly { readonly id: string; readonly data: Readonly<Record<string, unknown>> }[] }, hasCards: (id: string) => boolean): Map<string, Flow> {
  const out = new Map<string, Flow>();
  for (const d of lib.docs('flow')) {
    const flow = readFlow(d.id, d.data);
    if (flow.unit !== undefined && !hasCards(flow.unit) && !out.has(flow.unit)) out.set(flow.unit, flow);
  }
  return out;
}

/**
 * 2026-11-03 (Prompt 5) — DIE ZIELE EINER PRÄSENTATION: der Ablauf der Baza, der auf diese Seite zeigt, und welche seiner
 * Ziele jetzt gelten (mit den Werten, Antworten und Szenen des Laufs) — die Seite merkt sie an ihrer Stelle.
 */
export function pageGoals(lib: Parameters<typeof flowRefsOf>[0], pagePath: string | null, facts: Facts): string[] {
  if (pagePath === null || pagePath.trim() === '') return [];
  const at = bare(pagePath);
  for (const d of lib.docs('flow')) {
    const p = typeof d.data.presentation === 'string' ? d.data.presentation : '';
    if (p.trim() === '' || bare(p) !== at) continue;
    return goalsReached(readFlow(d.id, d.data), facts);
  }
  return [];
}

/** Die Ziele, die ein Ablauf gerade erreicht — vereint mit denen, die er schon hatte (einmal erreicht bleibt erreicht). */
export const mergeGoals = (had: readonly string[] | undefined, now: readonly string[]): string[] => [...new Set([...(had ?? []), ...now])];

/** 2026-11-03 (G) — die Kapitel, die durch sind, wie sie gemerkt werden: `<auswahl>:<index>`. */
export const chaptersKept = (chapters: FlowState['chapters']): string[] => Object.entries(chapters).flatMap(([hub, list]) => list.map((i) => `${hub}:${i}`));

/** … und zurück in den Stand (wer wiederkommt, hat sie weiter durch). */
export function withChapters<S extends Pick<FlowState, 'chapters'>>(state: S, kept: readonly string[] | undefined): S {
  if (kept === undefined || kept.length === 0) return state;
  const chapters: Record<string, number[]> = {};
  for (const one of kept) {
    const at = one.lastIndexOf(':');
    const i = Number(one.slice(at + 1));
    if (at <= 0 || !Number.isInteger(i) || i < 0) continue;
    (chapters[one.slice(0, at)] ??= []).push(i);
  }
  return { ...state, chapters };
}
