/**
 * 2026-11-04 — DIE ŚCIEŻKA EINER ERZÄHLUNG AUS IHREN TEILEN (nicht aus den Einträgen): der Graph des Ablaufs selbst,
 * zusammengefasst zu Teilen, die der Lernende als Schritte erlebt:
 * <code>
 *   Anfang, Ende   eigene Zeichen; genau ein Anfang (der Startschritt), ein Ende (alle Schritte „Koniec"/„Powrót"/
 *                  „Przekazanie" und jeder Ausgang ohne Weg — dort endet der Ablauf); das Ende steht allein oben
 *   Lesen          aufeinanderfolgende Schritte, die nur zeigen (Pokaż, Postać mówi, Wyjaśnij, Otwarcie, Szene ohne Frage);
 *                  ein Unterablauf ist ein eigener Teil und heisst wie die Erzählung, die er spielt
 *   Fragen         aufeinanderfolgende Fragen (eine Szene mit Fragen); zeigt ein Schritt beides: beides gezählt; eine Frage
 *                  heisst nie nach ihrem Text (nach ihrem Thema oder dem Bild davor)
 *   Przegląd       eine Schleife, die Fragen wiederholt, bis alles sitzt (ein Weg zurück), und der Schritt, den `review`
 *                  nennt; ein einzelnes Bild direkt davor („Przegląd") gehört dazu
 *   Gabel          eine Wahl (eine von n) oder Rozdziały (alle, in beliebiger Reihenfolge); eine Szene mit mehreren
 *                  Knöpfen ist eine Wahl auf der Szene; „wybierz 1 z N" zählt die Wege, die über ihr stehen
 * </code>
 * 2026-11-04 (Prompt 11) — AUTOMATISCHE SCHRITTE SIND KEINE WAHL: ein Warunek entscheidet selbst. Weiss der Gastgeber, wie
 * er für diesen Lernenden jetzt ausgeht (`decide`), steht nur dieser Weg da; sonst werden seine beiden Wege (bis sie wieder
 * zusammenkommen) EIN Teil mit dem Zeichen „automatisch". Ein Weg, der zu einer Wahl zurückführt, ist eine Schleife
 * (`loops`), kein Ende. Wert-Schritte (Wartość) bleiben durchsichtig.
 * Ein Teil endet, wo sich die Art ändert, der Weg sich gabelt oder zusammenkommt. Rein; die Karte zeichnet `PathMap`.
 */

import { t } from '../core/i18n';
import { exitsOf, follow, STEP_LABEL, type Flow } from './flow';
import type { GraphNode } from './graph';
import { countsAsStep, pathModel, type PartKind, type PathFork, type PathMarks, type PathModel, type PathState } from './pathLayout';

/** Was ein Schritt an Arbeit bringt: Bilder zum Lesen, Fragen zum Beantworten — und die Einträge dahinter. */
export interface StepWork {
  readonly slides: number;
  readonly questions: number;
  /** Was gezeigt wird (Lesen) oder worüber gefragt wird (Fragen) — für den Stand. */
  readonly shown: readonly string[];
  readonly asked: readonly string[];
}
export type WorkOfStep = (node: GraphNode) => StepWork;

export interface StoryBranch {
  readonly exit: string;
  readonly label: string;
  /** Der erste Teil dahinter (Index in `parts`). */
  readonly to: number;
  /** 2026-11-04 (Prompt 11) — der Schritt, zu dem der Ausgang führt (auch ein automatischer: wer dort war, ging diesen Weg). */
  readonly step?: string;
}

/** 2026-11-04 (Prompt 11) — ein automatischer Teil: der Warunek und seine beiden Wege (Schritte mit Inhalt, je „tak" / „nie"). */
export interface AutoPart {
  readonly step: string;
  readonly branches: readonly [readonly string[], readonly string[]];
  /** Wie die beiden Wege heissen (leer: der Weg zeigt nichts — er wird übersprungen). */
  readonly names: readonly [string, string];
}

export interface StoryPart {
  readonly kind: PartKind;
  readonly label: string;
  /** Die Schritte des Teils, in der Reihenfolge des Ablaufs. */
  readonly steps: readonly string[];
  /** Wohin ein Sprung zu diesem Teil führt. */
  readonly first: string | null;
  readonly slides: number;
  readonly questions: number;
  readonly shown: readonly string[];
  readonly asked: readonly string[];
  /** 2026-11-04 (Prompt 10) — die Schritte, die fragen (gefragt wird davon nur, was der Lernende nicht kann). */
  readonly questionSteps: readonly string[];
  /** 2026-11-04 (Prompt 11) — je Schritt aus `questionSteps`: wie viele Fragen er stellt (ein Unterablauf: alle seine). */
  readonly questionWeights?: readonly number[];
  /** Eine Gabel: Wahl (`choose`) oder Kapitel (`all`) — der Schritt und seine Wege. */
  readonly fork?: { readonly mode: 'choose' | 'all'; readonly step: string; readonly branches: readonly StoryBranch[] };
  /** Nach Kapiteln: frei erst, wenn alle Wege davor durch sind. */
  readonly needsAll?: boolean;
  /** 2026-11-04 (Prompt 11) — ein automatischer Teil (die App wählt einen der beiden Wege selbst). */
  readonly auto?: AutoPart;
}

export interface StoryPath {
  readonly parts: readonly StoryPart[];
  readonly model: PathModel;
  /** Je Schritt sein Teil (Logik-Schritte haben keinen, ausser in einem automatischen Teil). */
  readonly partOfStep: ReadonlyMap<string, number>;
  /** 2026-11-04 (Prompt 11) — die Wege zurück: [von Teil, zu Teil] (wie `model.loops`). */
  readonly loops: readonly (readonly [number, number])[];
}

/** 2026-11-04 (Prompt 11) — die Namen der Teile in der Sprache der Baza (`lang.ts` → `partNames`). */
export interface StoryWords {
  readonly start: string;
  readonly end: string;
  readonly review: string;
  readonly choice: string;
  readonly chapters: string;
  readonly questions: string;
  readonly questionsOf: (name: string) => string;
  readonly choiceOn: (name: string) => string;
  /** Wie ein Schritt ohne Titel heisst (sonst wie im Editor). */
  readonly step?: (type: string) => string | undefined;
}

/** 2026-11-05 — die Worte der Ścieżka in der Sprache der Anwendung (`words(lang).partNames` für eine Baza). */
export const STORY_WORDS: StoryWords = {
  get start() { return t('cogitaLearn.words.partNames.start'); },
  get end() { return t('cogitaLearn.words.partNames.end'); },
  get review() { return t('cogitaLearn.words.partNames.review'); },
  get choice() { return t('cogitaLearn.words.partNames.choice'); },
  get chapters() { return t('cogitaLearn.words.partNames.chapters'); },
  get questions() { return t('cogitaLearn.words.partNames.questions'); },
  questionsOf: (x) => t('cogitaLearn.words.partNames.questionsOf', { x }),
  choiceOn: (x) => t('cogitaLearn.words.partNames.choiceOn', { x })
};

export interface StoryPathOptions {
  /**
   * 2026-11-04 (Prompt 11) — WIE EIN AUTOMATISCHER SCHRITT FÜR DIESEN LERNENDEN JETZT AUSGEHT: der Ausgang eines Warunek
   * („yes"/„no"), `null`: noch nicht zu wissen (dann beide Wege als ein Teil mit dem Zeichen „automatisch").
   */
  readonly decide?: (node: GraphNode) => string | null;
  readonly words?: StoryWords;
  /** Der Name eines Ablaufs — ein Unterablauf heisst wie die Erzählung, die er spielt. */
  readonly flowName?: (id: string) => string | null;
  /** Das Thema einer Frage (worüber sie ist) — `null`: keins; ihr Text ist nie ein Name. */
  readonly topicName?: (questionRef: string) => string | null;
}

const STOPS = new Set(['end', 'return', 'handoff']);
const FORKS = new Set(['choice', 'chapters']);
const INNER = new Set(['subflow', 'each', 'detour']);
/** Ausgänge, die die Antwort wählt, nicht der Lernende. */
const ANSWER = new Set(['right', 'wrong']);

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Ein Ausgang, der fehlen darf: „dalej" einer Szene, die anders weitergeht (eine Frage auf ihr, ihre Knöpfe). */
/* 2026-11-05 (Prompt 23, D4) — „notyet" eines Przegląd ohne Weg: die Erzählung endet mit noch nicht bestandenem Przegląd („Powtórz przegląd" am Ende). */
export const optionalExit = (type: string, exit: string, others: number): boolean => (type === 'scene' && exit === 'next' && others > 0) || (type === 'review' && exit === 'notyet');

/**
 * Die Arbeit eines Schrittes eines gewöhnlichen Ablaufs: Pokaż und Verwandtes ein Bild, eine Frage eine Frage (ihre
 * Einträge sagt `entries`), eine Szene je nachdem, ob sie fragt; alles andere nichts (durchsichtig).
 */
export function stepWorkOf(entries: (node: GraphNode) => readonly string[]): WorkOfStep {
  return (node) => {
    const of = entries(node);
    switch (node.type) {
      case 'show': case 'expand': case 'opening': case 'line':
        return { slides: 1, questions: 0, shown: of, asked: [] };
      case 'question':
        return { slides: 0, questions: 1, shown: [], asked: of };
      case 'scene':
        return node.config.question === true ? { slides: 0, questions: 1, shown: [], asked: of } : { slides: 1, questions: 0, shown: of, asked: [] };
      case 'subflow': case 'each':
        return { slides: 1, questions: 0, shown: [], asked: [] };
      /* 2026-11-12 — die Einstufung: EIN Schritt auf der Ścieżka (ein Teil). */
      case 'explore':
        return { slides: 1, questions: 0, shown: [], asked: [] };
      /* 2026-11-11 — eine Wahl mit Folie ("of"): kein eigener Teil, aber ihre Folie ist gezeigt (ihr „about" zählt wie bei „show"). */
      case 'choice':
        return { slides: 0, questions: 0, shown: str(node.config.of) === '' ? [] : of, asked: [] };
      /* 2026-11-04 (Prompt 13) — ein Abstecher bringt hier nichts: seine Erzählung zählt für sich (ein eigener Teil, `detour`). */
      default:
        return { slides: 0, questions: 0, shown: [], asked: [] };
    }
  };
}

/**
 * Wie ein Schritt heisst: sein Titel, sonst der Name dessen, was er zeigt, sonst seine Art. 2026-11-04 (Prompt 11) — mit
 * `options` (die Ścieżka): eine Frage nach ihrem Thema („Pytania — …", nie nach ihrem Text), ein Unterablauf nach seiner
 * Erzählung, ein Schritt ohne Namen in der Sprache der Baza.
 */
export function stepName(node: GraphNode, label: (id: string) => string, options?: Pick<StoryPathOptions, 'words' | 'flowName' | 'topicName'>): string {
  const title = str(node.config.title);
  if (title !== '') return title;
  if (options !== undefined) {
    const W = options.words ?? STORY_WORDS;
    if (node.type === 'question') {
      const of = str(node.config.of) || str(node.config.card);
      const topic = of === '' ? null : options.topicName?.(of) ?? null;
      return topic !== null && topic !== '' ? W.questionsOf(topic) : W.questions;
    }
    if (node.type === 'subflow' || node.type === 'handoff' || node.type === 'each' || node.type === 'detour') {
      const f = str(node.config.flow);
      const named = f === '' ? null : options.flowName?.(f) ?? null;
      if (named !== null && named !== '') return named;
    }
  }
  const of = str(node.config.of);
  if (of !== '') { const l = label(of); if (l !== '' && l !== of) return l; }
  const own = label(node.id);
  if (own !== '' && own !== node.id) return own;
  return options?.words?.step?.(node.type) ?? STEP_LABEL[node.type as keyof typeof STEP_LABEL] ?? node.type;
}

type Way = { readonly exit: string; readonly to: string | null };

export function storyPath(flow: Flow, work: WorkOfStep, label: (id: string) => string, options: StoryPathOptions = {}): StoryPath {
  const Wd = options.words ?? STORY_WORDS;
  const nodes = new Map(flow.graph.nodes.map((n) => [n.id, n] as const));
  const empty: StoryPath = { parts: [], model: pathModel([], []), partOfStep: new Map(), loops: [] };
  if (flow.start === null || !nodes.has(flow.start)) return empty;
  const start = flow.start;
  const typeOf = (id: string): string => nodes.get(id)?.type ?? '';
  const nameOf = (id: string): string => { const n = nodes.get(id); return n === undefined ? id : stepName(n, label, options); };

  /* Kapitel: jedes „Koniec rozdziału" führt zurück zu seiner Auswahl — auf der Karte dorthin, wo es danach weitergeht. */
  const hubOf = new Map<string, string>();
  for (const hub of flow.graph.nodes.filter((n) => n.type === 'chapters')) {
    for (const p of exitsOf(hub.type, hub.config)) {
      if (!/^c\d+$/.test(p.id)) continue;
      const seen = new Set<string>();
      const stack = [follow(flow, hub.id, p.id)].filter((x): x is string => x !== null);
      while (stack.length > 0) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const n = nodes.get(id);
        if (n === undefined) continue;
        if (n.type === 'chapterEnd') { if (!hubOf.has(id)) hubOf.set(id, hub.id); continue; }
        if (n.type === 'chapters' || STOPS.has(n.type)) continue;
        for (const q of exitsOf(n.type, n.config)) { const to = follow(flow, id, q.id); if (to !== null) stack.push(to); }
      }
    }
  }
  const viaEnds = new Set(hubOf.values());
  /** Wohin ein Schritt weiterführt: je Ausgang das Ziel (`null`: kein Weg — dort endet der Ablauf). */
  const rawForward = (id: string): Way[] => {
    const n = nodes.get(id);
    if (n === undefined || STOPS.has(n.type) || n.type === 'restart') return [];
    if (n.type === 'chapterEnd') { const hub = hubOf.get(id); return [{ exit: 'next', to: hub === undefined ? follow(flow, id, 'next') : follow(flow, hub, 'done') }]; }
    /* Die Wege, wie sie im Graphen stehen, und jeder erklärte Ausgang ohne Weg (dort endet der Ablauf). */
    const skip = (out: string) => n.type === 'chapters' && out === 'done' && viaEnds.has(id);
    const list: Way[] = flow.graph.edges.filter((e) => e.from === id && !skip(e.out)).map((e) => ({ exit: e.out, to: nodes.has(e.to) ? e.to : null }));
    for (const p of exitsOf(n.type, n.config)) if (!skip(p.id) && !list.some((x) => x.exit === p.id) && !optionalExit(n.type, p.id, list.length)) list.push({ exit: p.id, to: null });
    return list;
  };

  /* Tiefensuche: was zurückführt (eine Schleife), ist kein Schritt nach vorn; die Reihenfolge des Lesens. */
  const walk = (forward: (id: string) => Way[]) => {
    const back = new Set<string>();
    const order: string[] = [];
    const state = new Map<string, 1 | 2>();
    const kidsOf = (id: string) => forward(id).map((x) => x.to).filter((x): x is string => x !== null).reverse();
    const stack: { id: string; kids: string[]; i: number }[] = [{ id: start, kids: kidsOf(start), i: 0 }];
    state.set(start, 1);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top.i >= top.kids.length) { state.set(top.id, 2); order.push(top.id); stack.pop(); continue; }
      const to = top.kids[top.i];
      top.i += 1;
      const s = state.get(to);
      if (s === 1) { back.add(`${top.id}>${to}`); continue; }
      if (s === 2) continue;
      state.set(to, 1);
      stack.push({ id: to, kids: kidsOf(to), i: 0 });
    }
    order.reverse();
    const reach = new Set(order);
    const ahead = (id: string): Way[] => forward(id).filter((x) => x.to === null || !back.has(`${id}>${x.to}`));
    const preds = new Map<string, string[]>();
    for (const id of order) for (const { to } of ahead(id)) if (to !== null) preds.set(to, [...new Set([...(preds.get(to) ?? []), id])]);
    const reachFrom = (from: string): Set<string> => {
      const out = new Set<string>();
      const todo = [from];
      while (todo.length > 0) { const id = todo.pop()!; if (out.has(id)) continue; out.add(id); for (const { to } of ahead(id)) if (to !== null && reach.has(to)) todo.push(to); }
      return out;
    };
    return { back, order, reach, ahead, preds, reachFrom };
  };

  const workCache = new Map<string, StepWork>();
  const workOf = (id: string): StepWork => { let w = workCache.get(id); if (w === undefined) { w = work(nodes.get(id)!); workCache.set(id, w); } return w; };
  /* 2026-11-04 (Prompt 13) — ein Abstecher ist immer ein eigener Teil (Art `detour`), auch ohne Arbeit hier. */
  const isContent = (id: string) => { if (typeOf(id) === 'detour') return true; const w = workOf(id); return w.slides + w.questions > 0; };
  const kindOf = (id: string): PartKind => { if (typeOf(id) === 'detour') return 'detour'; const w = workOf(id); return w.questions === 0 ? 'read' : w.slides === 0 ? 'learn' : 'mixed'; };
  /** Fragen, die dieser Schritt selbst stellt (ein Unterablauf fragt in seiner Erzählung, nicht in einem Przegląd hier). */
  const ownAsks = (id: string): number => { const t = typeOf(id); return t === 'question' || (t === 'scene' && nodes.get(id)?.config.question === true) ? workOf(id).questions : 0; };

  /* Der Przegląd (aus dem Graphen, wie er steht): Schleifen mit Fragen, der Schritt aus `review`, ein einzelnes Bild davor. */
  const A1 = walk(rawForward);
  const review = new Set<string>();
  const heads = new Set<string>();
  /* 2026-11-05 (Prompt 23, D4) — ein Schritt „review" ist der Przegląd (ein Knoten statt der Schleife je Frage). */
  for (const n of flow.graph.nodes) if (n.type === 'review' && A1.reach.has(n.id)) review.add(n.id);
  for (const key of A1.back) {
    const [u, v] = key.split('>');
    /* Ein Weg zurück zu einer Wahl ist eine Schleife der Wahl, kein Przegląd. */
    if (FORKS.has(typeOf(v))) continue;
    const fromV = A1.reachFrom(v);
    const body = A1.order.filter((w) => fromV.has(w) && A1.reachFrom(w).has(u));
    /* Ein Przegląd wiederholt mehrere Fragen (eine einzelne Frage, die nach „źle" wiederkommt, ist keiner). */
    if (body.reduce((s, w) => s + ownAsks(w), 0) >= 2) { for (const w of body) review.add(w); heads.add(v); }
  }
  if (flow.review !== undefined && A1.reach.has(flow.review) && !review.has(flow.review)) {
    /* Vom Schritt aus `review` die Kette bis in die Schleife (oder, ohne Schleife, die Fragen, die folgen). */
    let at: string | null = flow.review;
    for (let guard = 0; at !== null && guard < 200 && !review.has(at); guard += 1) {
      const type = typeOf(at);
      if (STOPS.has(type) || FORKS.has(type)) break;
      review.add(at);
      const next: string[] = A1.ahead(at).map((x) => x.to).filter((x): x is string => x !== null);
      at = next.length === 1 && (heads.size > 0 || !isContent(next[0]) || kindOf(next[0]) !== 'read') ? next[0] : null;
    }
  }
  for (const h of heads) {
    const p = A1.preds.get(h) ?? [];
    if (p.length === 1 && !review.has(p[0]) && isContent(p[0]) && kindOf(p[0]) === 'read' && A1.ahead(p[0]).every((x) => x.to === h) && p[0] !== start) review.add(p[0]);
  }

  /* Was der Gastgeber über die automatischen Schritte weiss (nicht im Przegląd — der bleibt, wie er ist). */
  const decided = new Map<string, string>();
  if (options.decide !== undefined) {
    for (const n of flow.graph.nodes) {
      if (n.type !== 'condition' || review.has(n.id) || !A1.reach.has(n.id)) continue;
      const exit = options.decide(n);
      if (exit !== null && exitsOf(n.type, n.config).some((p) => p.id === exit)) decided.set(n.id, exit);
    }
  }
  const forward = (id: string): Way[] => { const d = decided.get(id); const all = rawForward(id); return d === undefined ? all : all.filter((x) => x.exit === d); };
  const { back, order, reach, ahead, preds, reachFrom } = decided.size === 0 ? A1 : walk(forward);
  for (const r of [...review]) if (!reach.has(r)) review.delete(r);
  const sceneFork = (id: string) => typeOf(id) === 'scene' && new Set(ahead(id).filter((x) => !ANSWER.has(x.exit)).map((x) => x.to)).size >= 2;

  /*
    Die unentschiedenen Warunki: ihre beiden Wege bis dorthin, wo sie wieder zusammenkommen, sind EIN Teil — wenn darin
    keine Wahl, kein Ende, kein Przegląd liegt und niemand von aussen mitten hinein führt.
  */
  const autoOf = new Map<string, string>();
  const regions = new Map<string, { readonly yes: readonly string[]; readonly no: readonly string[] }>();
  for (const c of order) {
    if (typeOf(c) !== 'condition' || review.has(c) || decided.has(c) || autoOf.has(c)) continue;
    const out = ahead(c);
    const yes = out.find((x) => x.exit === 'yes')?.to ?? null;
    const no = out.find((x) => x.exit === 'no')?.to ?? null;
    if (yes === no) continue;
    const ry = yes === null ? new Set<string>() : reachFrom(yes);
    const rn = no === null ? new Set<string>() : reachFrom(no);
    const meet = order.find((v) => ry.has(v) && rn.has(v));
    const after = meet === undefined ? new Set<string>() : reachFrom(meet);
    const steps = new Set([...ry, ...rn].filter((v) => !after.has(v)));
    const list = [...steps];
    if (list.length === 0 || !list.some(isContent)) continue;
    if (list.some((v) => FORKS.has(typeOf(v)) || STOPS.has(typeOf(v)) || review.has(v) || sceneFork(v) || typeOf(v) === 'chapterEnd' || typeOf(v) === 'restart')) continue;
    if (!list.every((v) => (preds.get(v) ?? []).every((p) => p === c || steps.has(p)))) continue;
    for (const v of list) autoOf.set(v, c);
    regions.set(c, { yes: order.filter((v) => ry.has(v) && steps.has(v) && isContent(v)), no: order.filter((v) => rn.has(v) && steps.has(v) && isContent(v)) });
  }

  /* Die Teile. */
  type Draft = {
    kind: PartKind; label: string; steps: string[]; slides: number; questions: number; shown: string[]; asked: string[]; qsteps?: string[]; qweights?: number[];
    fork?: { mode: 'choose' | 'all'; step: string; exits: { exit: string; label: string; to: string | null }[] }; needsAll?: boolean; auto?: AutoPart;
  };
  const parts: Draft[] = [{ kind: 'start', label: Wd.start, steps: [], slides: 0, questions: 0, shown: [], asked: [] }];
  const needs: Set<number>[] = [new Set()];
  const partOf = new Map<string, number>();
  /** Was nach einem Schritt kommt, wenn er eine Wahl auf der Szene ist (die Gabel hinter seinem Teil). */
  const forkAfter = new Map<string, number>();
  const into = new Map<string, Set<number>>();
  let END = -1;
  let REVIEW = -1;
  const add = (d: Draft) => { parts.push(d); needs.push(new Set()); return parts.length - 1; };
  const endPart = () => { if (END < 0) END = add({ kind: 'end', label: Wd.end, steps: [], slides: 0, questions: 0, shown: [], asked: [] }); return END; };
  const outOf = (p: string): Set<number> => (forkAfter.has(p) ? new Set([forkAfter.get(p)!]) : partOf.has(p) ? new Set([partOf.get(p)!]) : into.get(p) ?? new Set());
  const intoOf = (t: string): Set<number> => {
    const out = new Set<number>(t === start ? [0] : []);
    for (const p of preds.get(t) ?? []) for (const x of outOf(p)) out.add(x);
    return out;
  };
  const link = (to: number, from: Iterable<number>) => { for (const f of from) if (f !== to) needs[to].add(f); };
  /** Die nächsten Schritte mit Inhalt (durch Logik hindurch) — `null`: der Ablauf endet. */
  const nextContent = (s: string): Set<string | null> => {
    const out = new Set<string | null>();
    const seen = new Set<string>();
    const stack = ahead(s).map((x) => x.to);
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === null) { out.add(null); continue; }
      if (seen.has(id)) continue;
      seen.add(id);
      const type = typeOf(id);
      if (isContent(id) || review.has(id) || FORKS.has(type) || STOPS.has(type) || regions.has(id)) { out.add(id); continue; }
      for (const x of ahead(id)) stack.push(x.to);
    }
    return out;
  };
  const accumulate = (d: Draft, id: string) => {
    const w = workOf(id);
    d.steps.push(id);
    d.slides += w.slides;
    d.questions += w.questions;
    if (w.questions > 0) { (d.qsteps ??= []).push(id); (d.qweights ??= []).push(w.questions); }
    for (const e of w.shown) if (!d.shown.includes(e)) d.shown.push(e);
    for (const e of w.asked) if (!d.asked.includes(e)) d.asked.push(e);
  };

  for (const t of order) {
    const n = nodes.get(t)!;
    const ins = intoOf(t);
    if (review.has(t)) {
      if (REVIEW < 0) REVIEW = add({ kind: 'review', label: Wd.review, steps: [], slides: 0, questions: 0, shown: [], asked: [] });
      accumulate(parts[REVIEW], t);
      partOf.set(t, REVIEW);
      link(REVIEW, ins);
      continue;
    }
    /* Ein Schritt in einem automatischen Teil gehört ihm (sein Warunek kam in der Reihenfolge zuerst). */
    const inAuto = autoOf.get(t);
    if (inAuto !== undefined) {
      const i = partOf.get(inAuto)!;
      parts[i].steps.push(t);
      partOf.set(t, i);
      continue;
    }
    const region = regions.get(t);
    if (region !== undefined) {
      const name = (list: readonly string[]) => (list.length === 0 ? '' : list.length === 1 ? nameOf(list[0]) : `${nameOf(list[0])} …`);
      const names: [string, string] = [name(region.yes), name(region.no)];
      const i = add({ kind: 'read', label: names.filter(Boolean).join(' / '), steps: [t], slides: 0, questions: 0, shown: [], asked: [], auto: { step: t, branches: [region.yes, region.no], names } });
      partOf.set(t, i);
      link(i, ins);
      continue;
    }
    if (STOPS.has(n.type)) { const e = endPart(); parts[e].steps.push(t); partOf.set(t, e); link(e, ins); continue; }
    if (FORKS.has(n.type)) {
      const chapters = n.type === 'chapters';
      /* Die Wege in der Reihenfolge der Möglichkeiten (nicht der Kanten im Graphen). */
      const ports = exitsOf(n.type, n.config);
      const rank = (exit: string) => { const i = ports.findIndex((p) => p.id === exit); return i < 0 ? ports.length : i; };
      const exits = forward(t).map((x) => ({ ...x, label: ports.find((p) => p.id === x.exit)?.label ?? x.exit })).sort((a, b) => rank(a.exit) - rank(b.exit));
      const f = add({ kind: 'fork', label: str(n.config.title) || (chapters ? Wd.chapters : Wd.choice), steps: [t], slides: 0, questions: 0, shown: [], asked: [], fork: { mode: chapters ? 'all' : 'choose', step: t, exits } });
      partOf.set(t, f);
      link(f, ins);
      continue;
    }
    if (!isContent(t)) { into.set(t, ins); continue; }
    const k = kindOf(t);
    const [only] = ins;
    const P = ins.size === 1 ? parts[only] : undefined;
    const last = P?.steps[P.steps.length - 1];
    /* Zusammen nur, was direkt aufeinander folgt — nie über einen Warunek, nie ein Unterablauf (er ist eine eigene Erzählung). */
    if (P !== undefined && only !== 0 && P.kind === k && P.auto === undefined && last !== undefined && !forkAfter.has(last) && !INNER.has(n.type) && !INNER.has(typeOf(last)) && ahead(last).some((x) => x.to === t)) {
      const next = nextContent(last);
      if (next.size === 1 && next.has(t)) { accumulate(P, t); partOf.set(t, only); }
    }
    if (!partOf.has(t)) {
      const d: Draft = { kind: k, label: nameOf(t), steps: [], slides: 0, questions: 0, shown: [], asked: [] };
      if (k === 'learn' && P !== undefined && P.kind === 'read' && P.auto === undefined) d.label = Wd.questionsOf(P.label);
      accumulate(d, t);
      const i = add(d);
      partOf.set(t, i);
      link(i, ins);
    }
    /* Eine Szene mit mehreren Knöpfen (Wegen, die nicht die Antwort wählt): eine Wahl auf der Szene. */
    const choices = ahead(t).filter((x) => !ANSWER.has(x.exit));
    /* Ein Abstecher wählt nicht: „done" und „skip" sind Ausgänge wie die einer Antwort. */
    if (n.type !== 'detour' && new Set(choices.map((x) => x.to)).size >= 2) {
      const exits = choices.map((x) => ({ ...x, label: exitsOf(n.type, n.config).find((p) => p.id === x.exit)?.label ?? x.exit }));
      const f = add({ kind: 'fork', label: Wd.choiceOn(nameOf(t)), steps: [], slides: 0, questions: 0, shown: [], asked: [], fork: { mode: 'choose', step: t, exits } });
      link(f, [partOf.get(t)!]);
      forkAfter.set(t, f);
    }
  }
  /* Die automatischen Teile: so viel, wie der längere der beiden Wege bringt; ihre Art danach. */
  for (const d of parts) {
    if (d.auto === undefined) continue;
    const sum = (list: readonly string[]) => list.reduce((s, id) => ({ slides: s.slides + workOf(id).slides, questions: s.questions + workOf(id).questions }), { slides: 0, questions: 0 });
    const [y, no] = d.auto.branches.map(sum);
    d.slides = Math.max(y.slides, no.slides);
    d.questions = Math.max(y.questions, no.questions);
    d.kind = d.questions === 0 ? 'read' : d.slides === 0 ? 'learn' : 'mixed';
    for (const id of [...d.auto.branches[0], ...d.auto.branches[1]]) {
      const w = workOf(id);
      if (w.questions > 0) { (d.qsteps ??= []).push(id); (d.qweights ??= []).push(w.questions); }
      for (const e of w.shown) if (!d.shown.includes(e)) d.shown.push(e);
      for (const e of w.asked) if (!d.asked.includes(e)) d.asked.push(e);
    }
  }
  /* Ein Ausgang ohne Weg beendet den Ablauf: dorthin führt das Ende. */
  for (const s of order) if (ahead(s).some((x) => x.to === null)) link(endPart(), outOf(s));
  /* Nach Kapiteln: die Zusammenführung braucht alle. */
  for (const d of parts) {
    if (d.fork?.mode !== 'all') continue;
    const done = follow(flow, d.fork.step, 'done');
    const at = done === null ? undefined : partOf.get(done) ?? [...nextContent(d.fork.step)].map((x) => (x === null ? undefined : partOf.get(x))).find((x) => x !== undefined);
    if (at !== undefined && viaEnds.has(d.fork.step)) parts[at].needsAll = true;
  }
  /** Der Teil, in dem ein Schritt liegt oder mit dem es nach ihm weitergeht (ohne ein Ende anzulegen). */
  const partAt = (to: string): number | undefined => {
    const own = partOf.get(to);
    if (own !== undefined) return own;
    for (const x of nextContent(to)) { const p = x === null ? (END >= 0 ? END : undefined) : partOf.get(x); if (p !== undefined) return p; }
    return undefined;
  };
  /* Die Gabeln: je Ausgang der erste Teil dahinter. */
  const firstPartAt = (to: string | null): number => (to === null ? endPart() : partAt(to) ?? endPart());
  /* 2026-11-04 (Prompt 11) — die Wege zurück (zu einer Wahl, einer Szene, einem Teil davor): Schleifen, keine Enden. */
  const loops: [number, number][] = [];
  for (const key of back) {
    const [u, v] = key.split('>');
    if (review.has(u) && review.has(v)) continue;
    const to = partAt(v);
    if (to === undefined) continue;
    for (const f of outOf(u)) if (f !== to && f !== 0 && !loops.some(([a, b]) => a === f && b === to)) loops.push([f, to]);
  }
  const finished: StoryPart[] = parts.map((d) => ({
    kind: d.kind, label: d.label, steps: d.steps, first: d.steps[0] ?? (d.kind === 'start' ? start : null), slides: d.slides, questions: d.questions, shown: d.shown, asked: d.asked, questionSteps: d.qsteps ?? [],
    ...(d.qweights === undefined ? {} : { questionWeights: d.qweights }),
    ...(d.fork === undefined ? {} : { fork: { mode: d.fork.mode, step: d.fork.step, branches: d.fork.exits.map((x) => ({ exit: x.exit, label: x.label, to: firstPartAt(x.to), ...(x.to === null ? {} : { step: x.to }) })) } }),
    ...(d.needsAll === true ? { needsAll: true } : {}),
    ...(d.auto === undefined ? {} : { auto: d.auto })
  }));
  const items = finished.map((p, i) => ({ id: `p${i}`, label: p.label }));
  const model = pathModel(items, needs.map((s) => [...s]), {
    source: 'story', reduced: true, loops,
    info: finished.map((p) => ({ kind: p.kind, slides: p.slides, questions: p.questions, ...(p.auto === undefined ? {} : { auto: true }) }))
  });
  return { parts: finished, model, partOfStep: partOf, loops: model.loops ?? [] };
}

/* -- Der Stand ------------------------------------------------------------------------------------------------------- */

export interface StoryProgress {
  /** Die besuchten Schritte, in der Reihenfolge des Besuchs. */
  readonly visited: readonly string[];
  readonly ended?: boolean;
  /** Der Schritt, an dem der Lernende steht. */
  readonly step?: string | null;
  /** Der Stand eines Eintrags (mit Lernendem); ohne: was besucht ist, ist durch. */
  readonly know?: (id: string) => { readonly learned: boolean; readonly due: boolean };
  /** Je Rozdziały die Kapitel, die in dieser Erzählung durch sind. */
  readonly chapters?: Readonly<Record<string, readonly number[]>>;
  /** 2026-11-04 (Prompt 10) — ist die Frage dieses Schrittes gekonnt (dann wird sie übersprungen, nicht gefragt)? */
  readonly knownStep?: (step: string) => boolean;
  /** 2026-11-04 (Prompt 13) — ist dieser Abstecher ausgelassen (vorbei, ohne dass seine Erzählung ukończona ist)? */
  readonly skipped?: (step: string) => boolean;
}

/** Die Teile einer Spur ab einem Teil, bis zur Zusammenführung (sie nicht mehr) oder zum Ende. */
export function branchParts(sp: StoryPath, from: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const stack = [from];
  while (stack.length > 0) {
    const v = stack.pop()!;
    if (seen.has(v)) continue;
    seen.add(v);
    const p = sp.parts[v];
    if (p === undefined || p.kind === 'end' || (v !== from && (p.needsAll === true || sp.model.nodes[v].needs.length > 1))) continue;
    out.push(v);
    for (const c of sp.model.nodes[v].builds) stack.push(c);
  }
  return out;
}

/** 2026-11-04 (Prompt 11) — wie viele Fragen ein Teil wirklich stellt: alle, ohne die gekonnten (mit ihrem Gewicht). */
const askOf = (p: StoryPart, knownStep?: (step: string) => boolean): number =>
  p.questionSteps.reduce((s, x, i) => s + (knownStep?.(x) === true ? 0 : p.questionWeights?.[i] ?? 1), 0);

/** Was eine Spur einer Gabel an Arbeit bringt (für die Wahl: „3 slajdy do przeczytania · 5 pytań"). */
export function branchWork(sp: StoryPath, branch: StoryBranch, knownStep?: (step: string) => boolean): { readonly slides: number; readonly questions: number; readonly parts: number; readonly ask: number } {
  const list = branchParts(sp, branch.to);
  const ask = list.reduce((s, v) => s + askOf(sp.parts[v], knownStep), 0);
  return { slides: list.reduce((s, v) => s + sp.parts[v].slides, 0), questions: list.reduce((s, v) => s + sp.parts[v].questions, 0), parts: list.length, ask };
}

/** 2026-11-04 (Prompt 10) — je Teil: wie viele seiner Fragen wirklich gefragt würden (die gekonnten nicht). */
export const askCounts = (sp: StoryPath, knownStep?: (step: string) => boolean): number[] => sp.parts.map((p) => askOf(p, knownStep));

/** Die Wege einer Wahl, wie sie gezeichnet sind (zwei Möglichkeiten zum selben Teil sind ein Weg). */
export const roadsOf = (f: NonNullable<StoryPart['fork']>): number[] => [...new Set(f.branches.map((b) => b.to))];

/**
 * DER STAND DER TEILE: Lesen ist durch, wenn alle seine Schritte besucht sind; Fragen, wenn sie gestellt und alles Gefragte
 * gelernt ist (ab 10 %; ohne Lernenden: gestellt); der Przegląd, wenn alles darin sitzt (100 %); eine Wahl, sobald ein Weg gewählt
 * ist; Kapitel, wenn alle durch sind; das Ende, wenn die Erzählung zu Ende ist; ein automatischer Teil, wenn der Weg, den die
 * App nahm, gegangen ist. Frei ist, was hinter einem Durchgangenen liegt (nach Kapiteln: hinter allen); „jetzt dran" ist der
 * Teil des Schrittes, an dem der Lernende steht. 2026-11-04 (Prompt 11) — IST DIE ERZÄHLUNG ZU ENDE, ist alles durch, was
 * galt; die nicht gegangenen Wege einer Wahl sind „nicht gewählt" (nicht gezählt, nie offen).
 */
export function storyMarks(sp: StoryPath, pr: StoryProgress): PathMarks {
  const { parts, model } = sp;
  const n = parts.length;
  const visited = new Set(pr.visited);
  const seen = (i: number) => parts[i].steps.some((s) => visited.has(s));
  /* Durch ist ein Teil erst, wenn der Lernende ihn verlassen hat (wer darin steht, ist noch nicht fertig). */
  const inside = (i: number) => pr.ended !== true && pr.step !== undefined && pr.step !== null && parts[i].steps.includes(pr.step);
  const allSeen = (i: number) => parts[i].steps.length > 0 && parts[i].steps.every((s) => visited.has(s)) && !inside(i);
  const know = pr.know;
  const done = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i += 1) {
    const p = parts[i];
    if (p.auto !== undefined) {
      const [yes, no] = p.auto.branches;
      const walked = (list: readonly string[]) => list.length > 0 && list.every((s) => visited.has(s));
      const anyContent = [...yes, ...no].some((s) => visited.has(s));
      done[i] = !inside(i) && visited.has(p.auto.step) && (walked(yes) || walked(no) || ((yes.length === 0 || no.length === 0) && !anyContent));
      continue;
    }
    switch (p.kind) {
      case 'start': done[i] = true; break;
      case 'end': done[i] = pr.ended === true || seen(i); break;
      case 'fork': break;
      case 'read': done[i] = allSeen(i); break;
      /* Der Przegląd: erreicht und alles darin sitzt (ohne Lernenden: durchlaufen). */
      case 'review':
        done[i] = know !== undefined && p.asked.length > 0 ? seen(i) && p.asked.every((e) => { const k = know(e); return k.learned && !k.due; }) : allSeen(i);
        break;
      /* Fragen: in dieser Erzählung gestellt und gelernt (ohne Lernenden: gestellt). */
      default:
        done[i] = allSeen(i) && (know === undefined || p.asked.every((e) => know(e).learned));
    }
  }
  /* Die Gabeln zuletzt: sie stehen über dem, was hinter ihnen liegt. */
  const forks = new Map<number, PathFork>();
  const branchDone = (to: number) => { const list = branchParts(sp, to); return list.length > 0 && list.every((v) => done[v]); };
  /*
    2026-11-04 (Prompt 11) — EIN WEG EINER WAHL IST GEGANGEN, wenn ein Teil von ihm besucht ist oder der Schritt, zu dem ihr
    Ausgang führt (ein Warunek, der heute anders ausginge: der Weg „więcej" zeigt nun „Wiesz już", gegangen wurde die Erzählung).
  */
  const walkedRoad = (f: NonNullable<StoryPart['fork']>, to: number) => seen(to) || branchParts(sp, to).some(seen) || f.branches.some((b) => b.to === to && b.step !== undefined && visited.has(b.step));
  for (let i = 0; i < n; i += 1) {
    const f = parts[i].fork;
    if (f === undefined) continue;
    if (f.mode === 'choose') {
      const roads = roadsOf(f);
      const taken = roads.filter((to) => walkedRoad(f, to) || done[to]).length;
      /* 2026-11-04 (Prompt 9) — auch eine Wahl sagt, welche ihrer Wege schon zu Ende gegangen sind. */
      const finishedRoads = roads.filter((to) => branchDone(to)).length;
      forks.set(i, { mode: 'choose', done: taken, total: roads.length, ...(finishedRoads > 0 ? { finished: finishedRoads } : {}) });
      done[i] = taken > 0;
    } else {
      const told = new Set(pr.chapters?.[f.step] ?? []);
      const count = f.branches.filter((b) => told.has(Number(b.exit.slice(1))) || branchDone(b.to)).length;
      forks.set(i, { mode: 'all', done: count, total: f.branches.length });
      done[i] = f.branches.length > 0 && count === f.branches.length;
    }
  }
  /* Was gewählt wurde, bevor das Ende alles durch macht (für die hervorgehobenen Wege). */
  const doneBefore = [...done];
  const optional = new Array<boolean>(n).fill(false);
  /*
    2026-11-06 — EIN NICHT GEWÄHLTER WEG ZÄHLT NICHT, sobald ein anderer Weg derselben Wahl begangen ist — schon unterwegs, nicht erst
    am Ende (vorher zählte ein Sechseck mit zwei inneren Wegen unterwegs „4 z 7", am Ende „6 z 6"). Am Ende wie bisher.
  */
  for (let i = 0; i < n; i += 1) {
    const f = parts[i].fork;
    if (f?.mode !== 'choose') continue;
    const roads = roadsOf(f);
    if (!roads.some((to) => walkedRoad(f, to))) continue;
    for (const to of roads) if (!walkedRoad(f, to)) for (const v of branchParts(sp, to)) optional[v] = true;
  }
  if (pr.ended === true) for (let i = 0; i < n; i += 1) if (!optional[i]) done[i] = true;
  const state: PathState[] = parts.map((p, i) => {
    if (done[i]) return 'done';
    if (optional[i]) return 'available';
    const before = model.nodes[i].needs;
    const open = before.length === 0 || (p.needsAll === true ? before.every((v) => done[v]) : before.some((v) => done[v]));
    return open ? 'available' : 'locked';
  });
  const due = parts.map((p, i) => know !== undefined && done[i] && !optional[i] && (p.kind !== 'review' || pr.ended === true) && p.asked.some((e) => { const k = know(e); return k.learned && k.due; }));
  let current = -1;
  if (pr.ended === true && parts.some((p) => p.kind === 'end')) current = parts.findIndex((p) => p.kind === 'end');
  else if (pr.step !== undefined && pr.step !== null) {
    current = sp.partOfStep.get(pr.step) ?? -1;
    for (let k = pr.visited.length - 1; current < 0 && k >= 0; k -= 1) current = sp.partOfStep.get(pr.visited[k]) ?? -1;
  }
  if (current < 0) {
    for (let v = 0; v < n; v += 1) {
      if (state[v] !== 'available' || optional[v] || !countsAsStep(model.nodes[v])) continue;
      if (current < 0 || model.nodes[v].level < model.nodes[current].level) current = v;
    }
  }
  const taken = model.edges.map(([p, c]) => { const f = parts[p].fork; return f?.mode === 'choose' && (walkedRoad(f, c) || doneBefore[c]); });
  const counted = (v: number) => countsAsStep(model.nodes[v]) && !optional[v];
  /* 2026-11-04 (Prompt 13) — ein ausgelassener Abstecher ist durch (er hält nichts auf), aber dünn umrandet. */
  const skipped = parts.map((p, i) => p.kind === 'detour' && state[i] === 'done' && pr.skipped !== undefined && p.steps.some((s) => pr.skipped!(s)));
  return {
    ask: askCounts(sp, pr.knownStep), state, due, current, lit: model.edges.map(([p]) => done[p]), taken, forks, optional,
    ...(skipped.some(Boolean) ? { skipped } : {}),
    done: state.filter((s, v) => s === 'done' && counted(v)).length, total: model.nodes.filter((_, v) => counted(v)).length
  };
}

/** Je Schritt in einem Kapitel: seine Auswahl und der Ausgang des Kapitels (wer dorthin springt, ist in diesem Kapitel). */
export function chapterOfSteps(sp: StoryPath): Map<string, { readonly hub: string; readonly exit: string }> {
  const out = new Map<string, { hub: string; exit: string }>();
  for (const p of sp.parts) {
    if (p.fork?.mode !== 'all') continue;
    for (const b of p.fork.branches) for (const v of branchParts(sp, b.to)) for (const s of sp.parts[v].steps) if (!out.has(s)) out.set(s, { hub: p.fork.step, exit: b.exit });
  }
  return out;
}

/** Die Teile einer Spur einer Gabel als Kennungen der Karte (zum Hervorheben). */
export function branchIds(sp: StoryPath, step: string, exit: string): Set<string> | null {
  const f = sp.partOfStep.get(step);
  const b = f === undefined ? undefined : sp.parts[f].fork?.branches.find((x) => x.exit === exit);
  return b === undefined ? null : new Set(branchParts(sp, b.to).map((v) => sp.model.nodes[v].id));
}
