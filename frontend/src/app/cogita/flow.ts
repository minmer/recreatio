/**
 * COGITA — ABLÄUFE: wie etwas erzählt wird (COGITA.md §8, §9).
 *
 * <b>Drei Schichten</b> [G1]: der Inhalt (Einträge, Wissen, Texte), der
 * Ablauf (dieser Graph) und das Aussehen (`look`). Ein Ablauf hat keinen
 * eigenen Text [G9]: was ein Lernender liest, ist ein Wissenssatz, ein Text
 * oder ein Eintrag. Überschriften der Schritte, Beschriftungen der Wahl und
 * Namen der Kapitel sind Daten des Ablaufs.
 *
 * <b>Die Schritte</b> [G5, F32]:
 *
 * <code>
 *   show        einen Eintrag, ein Wissen, ein Thema zeigen (oder ein Bild, einen Ton)
 *   question    eine Frage — mit Ausgang „dobrze" und „źle"
 *   choice      eine Wahl — je Möglichkeit ein Ausgang
 *   condition   eine Bedingung der einen Logik — „tak" / „nie"
 *   set         Werte setzen oder ändern
 *   chapters    Kapitel: nur, was noch fehlt, wird angeboten; „gotowe", wenn alle durch sind
 *   chapterEnd  das Ende eines Kapitels — zurück zur Auswahl
 *   restart     das Kapitel von vorn
 *   subflow     ein anderer Ablauf, dann weiter
 *   each        für jeden Eintrag eines Zbiór ein Unterablauf (mit {item})
 *   prerequisite  wer es schon kann, geht weiter; sonst die Erklärung
 *   expand      ein Begriff, an Ort und Stelle erklärt, wenn er noch nicht sitzt
 *   opening     ein Anfang: entdecken (erst fragen) oder erinnern (erst zeigen) [G13]
 *   line        eine Gestalt spricht (ihr Satz ist ein Wissen) [H2]
 *   handoff     weiter in einem anderen Ablauf (eine Übergabe)
 *   end · return
 * </code>
 *
 * Jeder Schritt öffnet einen neuen Bildschirm oder klappt an Ort und Stelle
 * auf [G12]. Ein Ablauf darf zurückführen — ein Kapitel neu, zurück zur
 * Auswahl —, anders als die Graphen der Karten.
 *
 * <b>Erzählvorlagen</b> [G7]: ein Ablauf mit Platzhaltern (`{person}`); eine
 * Verwendung nennt die Vorlage, füllt die Platzhalter und darf Schritte
 * überschreiben — ändert sich die Vorlage, ändert sie sich in jeder Verwendung.
 */

import { paletteOf, readGraph, type Graph, type GraphNode, type NodeKind, type Port } from './graph';
import { apply, holds, readAction, readCondition, type Action, type Condition, type Facts, type ValueLimit } from './logic';

export const STEP_TYPES = [
  'show', 'question', 'choice', 'condition', 'set', 'chapters', 'chapterEnd', 'restart', 'subflow', 'each',
  'prerequisite', 'expand', 'opening', 'line', 'handoff', 'end', 'return'
] as const;
export type StepType = (typeof STEP_TYPES)[number];

export const STEP_LABEL: Record<StepType, string> = {
  show: 'Pokaż', question: 'Pytanie', choice: 'Wybór', condition: 'Warunek', set: 'Zmień wartość',
  chapters: 'Rozdziały', chapterEnd: 'Koniec rozdziału', restart: 'Rozdział od nowa', subflow: 'Inny przebieg',
  each: 'Dla każdego', prerequisite: 'Najpierw podstawy', expand: 'Wyjaśnij w miejscu', opening: 'Otwarcie',
  line: 'Postać mówi', handoff: 'Przekazanie', end: 'Koniec', return: 'Powrót'
};

/** Was ein Schritt im Ablauf-Editor bedeutet — ein Satz, auch für die Beschreibung des JSON. */
export const STEP_SAYS: Record<StepType, string> = {
  show: 'Pokazuje wpis, wiedzę albo temat ("of"), albo plik ("media"); "title" — nagłówek ekranu.',
  question: 'Zadaje pytanie ("of": pytanie albo klucz karty); wyjścia "right" i "wrong".',
  choice: 'Daje wybór: "options" [{"label", "condition"?}]; wyjście "o0", "o1", … dla każdej możliwości.',
  condition: 'Sprawdza warunek ("condition" — jedna logika); wyjścia "yes" i "no".',
  set: 'Zmienia wartości ("actions": [{"type": "set"|"add", "value", "to"|"by"}]); wyjście "next".',
  chapters: 'Rozdziały ("chapters": [{"title"}]); wyjście "c0", "c1", … — początek rozdziału; "done", gdy wszystkie przerobione.',
  chapterEnd: 'Koniec rozdziału — wraca do wyboru rozdziałów.',
  restart: 'Zaczyna bieżący rozdział od nowa.',
  subflow: 'Wchodzi w inny przebieg ("flow"); po nim wyjście "next".',
  each: 'Dla każdego wpisu zbioru ("collection") albo rodzaju ("kind") — inny przebieg ("flow") z {item}; potem "next".',
  prerequisite: 'Kto zna "of" (od progu "threshold", domyślnie 1), idzie dalej "known"; inaczej "explain".',
  expand: 'Wyjaśnia pojęcie "of" na miejscu, gdy jeszcze go nie zna; potem "next".',
  opening: 'Otwarcie ("mode": "discovery" — najpierw pytanie, "recall" — najpierw przypomnienie); "next".',
  line: 'Postać ("character") mówi zdanie ("of": wiedza); "mood" — nastrój; "next".',
  handoff: 'Przekazuje do innego przebiegu ("flow") — tamten zaczyna się od początku.',
  end: 'Koniec przebiegu.',
  return: 'Wraca z przebiegu wewnętrznego do miejsca, z którego wszedł.'
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const port = (id: string, label: string, many = false): Port => ({ id, label, type: 'step', many });

/** Die Ausgänge eines Schrittes — sie hängen an seiner Einstellung (eine Wahl mit drei Möglichkeiten hat drei). */
export function exitsOf(type: string, config: Readonly<Record<string, unknown>>): Port[] {
  switch (type) {
    case 'question': return [port('right', 'dobrze'), port('wrong', 'źle')];
    case 'choice': return (Array.isArray(config.options) ? config.options : []).map((o, i) => port(`o${i}`, str(isObject(o) ? o.label : o) || `możliwość ${i + 1}`));
    case 'condition': return [port('yes', 'tak'), port('no', 'nie')];
    case 'chapters': return [...(Array.isArray(config.chapters) ? config.chapters : []).map((c, i) => port(`c${i}`, str(isObject(c) ? c.title : c) || `rozdział ${i + 1}`)), port('done', 'wszystkie przerobione')];
    case 'prerequisite': return [port('known', 'zna'), port('explain', 'wyjaśnij')];
    case 'end':
    case 'return':
    case 'chapterEnd':
    case 'restart':
    case 'handoff':
      return [];
    default: return [port('next', 'dalej')];
  }
}

type FlowCtx = Record<string, never>;

const STEP: (type: StepType) => NodeKind<FlowCtx> = (type) => ({
  type,
  label: STEP_LABEL[type],
  says: STEP_SAYS[type],
  group: type === 'show' || type === 'line' || type === 'expand' ? 'Treść'
    : type === 'question' || type === 'choice' || type === 'opening' ? 'Rozmowa'
    : type === 'condition' || type === 'set' || type === 'prerequisite' ? 'Logika'
    : 'Przebieg',
  ports: (config) => ({ inputs: [port('in', 'wejście', true)], outputs: exitsOf(type, config) }),
  run: () => ({})
});

/** Die Palette des Ablauf-Editors — die Schritte als Knoten. */
export const FLOW_PALETTE = paletteOf<FlowCtx>('flow', STEP_TYPES.map(STEP));

/* -- Der Ablauf ------------------------------------------------------------------------- */

export const LOOK_TYPES = ['reading', 'slides', 'scenes', 'dialogue', 'flashcards', 'map'] as const;
export type LookType = (typeof LOOK_TYPES)[number];

export const LOOK_LABEL: Record<LookType, string> = {
  reading: 'Czytanie', slides: 'Slajdy', scenes: 'Sceny', dialogue: 'Rozmowa w dymkach', flashcards: 'Fiszki', map: 'Mapa do odkrywania'
};

export interface Slot {
  readonly id: string;
  readonly label: string;
  /** Welche Art der Platzhalter nimmt. */
  readonly kind?: string;
}

export interface Goal {
  readonly id: string;
  readonly title: string;
  readonly condition: Condition | null;
}

/** Eine Zeile einer Gestalt, die von selbst fällt, wenn ihre Bedingung gilt [H2]. */
export interface CharacterLine {
  readonly character: string;
  readonly of: string;
  readonly condition: Condition | null;
  readonly once: boolean;
}

export interface Flow {
  readonly id: string;
  readonly name: string;
  readonly look: LookType;
  /** Ein Aussehen der Bibliothek (`look`), sonst das Vorgabe-Aussehen der Art. */
  readonly lookId?: string;
  readonly start: string | null;
  readonly graph: Graph;
  readonly slots: readonly Slot[];
  /** Eine Verwendung einer Erzählvorlage [G7]. */
  readonly template?: string;
  readonly fill: Readonly<Record<string, string>>;
  readonly overrides: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** Ziele — ein Ablauf mit Zielen ist eine Aufgabe (quest) [H6]. */
  readonly goals: readonly Goal[];
  readonly lines: readonly CharacterLine[];
}

export function readFlow(id: string, raw: unknown): Flow {
  const d = isObject(raw) ? raw : {};
  const graph = readGraph(d.graph, true);
  const start = str(d.start);
  const fill: Record<string, string> = {};
  if (isObject(d.fill)) for (const [k, v] of Object.entries(d.fill)) if (typeof v === 'string' && v !== '') fill[k] = v;
  const overrides: Record<string, Record<string, unknown>> = {};
  if (isObject(d.overrides)) for (const [k, v] of Object.entries(d.overrides)) if (isObject(v)) overrides[k] = v;
  return {
    id,
    name: str(d.name).trim() || 'Przebieg',
    look: (LOOK_TYPES as readonly string[]).includes(str(d.look)) ? (d.look as LookType) : 'reading',
    ...(str(d.lookId) === '' ? {} : { lookId: str(d.lookId) }),
    start: graph.nodes.some((n) => n.id === start) ? start : (graph.nodes[0]?.id ?? null),
    graph,
    slots: (Array.isArray(d.slots) ? d.slots : []).flatMap((s): Slot[] => (isObject(s) && str(s.id) !== '' ? [{ id: str(s.id), label: str(s.label) || str(s.id), ...(str(s.kind) === '' ? {} : { kind: str(s.kind) }) }] : [])),
    ...(str(d.template) === '' ? {} : { template: str(d.template) }),
    fill,
    overrides,
    goals: (Array.isArray(d.goals) ? d.goals : []).flatMap((g): Goal[] => (isObject(g) && str(g.id) !== '' ? [{ id: str(g.id), title: str(g.title) || str(g.id), condition: readCondition(g.condition) }] : [])),
    lines: (Array.isArray(d.lines) ? d.lines : []).flatMap((l): CharacterLine[] => (isObject(l) && str(l.character) !== '' && str(l.of) !== '' ? [{ character: str(l.character), of: str(l.of), condition: readCondition(l.condition), once: l.once !== false }] : []))
  };
}

/**
 * EINE VERWENDUNG AUFGELÖST [G7]: der Graph der Vorlage, die überschriebenen
 * Schritte, und jeder Platzhalter `{"slot": "person"}` in einer Einstellung
 * durch den Eintrag ersetzt, der ihn füllt.
 */
export function resolveFlow(flow: Flow, find: (id: string) => Flow | undefined, depth = 0): Flow {
  if (flow.template === undefined || depth > 4) return flow;
  const base = find(flow.template);
  if (base === undefined) return flow;
  const template = resolveFlow(base, find, depth + 1);
  const fill = (value: unknown): unknown => {
    if (isObject(value) && typeof value.slot === 'string' && Object.keys(value).length === 1) return flow.fill[value.slot] ?? '';
    if (Array.isArray(value)) return value.map(fill);
    if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v)]));
    return value;
  };
  const nodes: GraphNode[] = template.graph.nodes.map((n) => ({ ...n, config: fill({ ...n.config, ...(flow.overrides[n.id] ?? {}) }) as Record<string, unknown> }));
  return { ...template, id: flow.id, name: flow.name || template.name, look: flow.look, ...(flow.lookId === undefined ? {} : { lookId: flow.lookId }), graph: { nodes, edges: template.graph.edges }, fill: flow.fill, overrides: flow.overrides, template: flow.template };
}

/* -- Der Spieler -------------------------------------------------------------------------- */

export interface FlowState {
  readonly flow: string;
  readonly step: string | null;
  readonly visited: readonly string[];
  readonly values: Readonly<Record<string, number>>;
  /** Kapitel, die durch sind — je Auswahl-Schritt die Indizes. */
  readonly chapters: Readonly<Record<string, readonly number[]>>;
  /** Wo das laufende Kapitel begann (für „od nowa") und zu welcher Auswahl es gehört. */
  readonly chapter: { readonly hub: string; readonly index: number; readonly start: string } | null;
  /** Wohin ein Unterablauf zurückkehrt. */
  readonly stack: readonly { readonly flow: string; readonly step: string | null; readonly item?: string }[];
  /** Der Eintrag eines „dla każdego"-Durchlaufs. */
  readonly item?: string;
  /** Was „dla każdego" noch vor sich hat. */
  readonly queue?: readonly string[];
  readonly ended: boolean;
  /** Was die Gestalten schon gesagt haben (für „einmal"). */
  readonly said: readonly string[];
}

export interface PlayContext {
  readonly facts: (state: FlowState) => Facts;
  readonly flows: (id: string) => Flow | undefined;
  readonly members: (collectionOrKind: string) => readonly string[];
  readonly limits?: (value: string) => ValueLimit;
}

export function startFlow(flow: Flow, values: Readonly<Record<string, number>> = {}, at?: string | null): FlowState {
  const step = at !== undefined && at !== null && flow.graph.nodes.some((n) => n.id === at) ? at : flow.start;
  return { flow: flow.id, step, visited: step === null ? [] : [step], values, chapters: {}, chapter: null, stack: [], ended: step === null, said: [] };
}

const nodeOf = (flow: Flow, id: string | null): GraphNode | undefined => (id === null ? undefined : flow.graph.nodes.find((n) => n.id === id));

/** Wohin ein Ausgang führt — `null`: nirgends (der Ablauf endet dort). */
export function follow(flow: Flow, from: string, exit: string): string | null {
  return flow.graph.edges.find((e) => e.from === from && e.out === exit)?.to ?? null;
}

const actionsOf = (raw: unknown): Action[] => (Array.isArray(raw) ? raw.map(readAction).filter((a): a is Action => a !== null) : []);

/** Den Schritt betreten — und, was von selbst weitergeht (Bedingung, Werte, Voraussetzung), gleich weitergehen. */
function enter(flow: Flow, state: FlowState, to: string | null, ctx: PlayContext, guard = 0): FlowState {
  if (guard > 64) return { ...state, step: to, ended: to === null };
  if (to === null) return leave(flow, state, ctx, guard);
  const node = nodeOf(flow, to);
  if (node === undefined) return leave(flow, state, ctx, guard);
  const visited = state.visited.includes(to) ? state.visited : [...state.visited, to];
  const here: FlowState = { ...state, step: to, visited };
  const facts = ctx.facts(here);
  const c = node.config;

  switch (node.type) {
    case 'condition': {
      const ok = holds(readCondition(c.condition), facts);
      return enter(flow, here, follow(flow, to, ok ? 'yes' : 'no'), ctx, guard + 1);
    }
    case 'set': {
      const done = apply(actionsOf(c.actions), here.values, ctx.limits);
      const next = done.go !== null && nodeOf(flow, done.go) !== undefined ? done.go : follow(flow, to, 'next');
      return enter(flow, { ...here, values: done.values }, next, ctx, guard + 1);
    }
    case 'prerequisite': {
      const known = facts.knowness(str(c.of)) >= num(c.threshold, 1);
      return enter(flow, here, follow(flow, to, known ? 'known' : 'explain'), ctx, guard + 1);
    }
    case 'expand': {
      /* Wer es kann, sieht die Erklärung nicht. */
      if (facts.knowness(str(c.of)) >= num(c.threshold, 1)) return enter(flow, here, follow(flow, to, 'next'), ctx, guard + 1);
      return here;
    }
    case 'chapterEnd': {
      if (here.chapter === null) return enter(flow, here, follow(flow, to, 'next'), ctx, guard + 1);
      const hub = here.chapter.hub;
      const done = [...new Set([...(here.chapters[hub] ?? []), here.chapter.index])];
      return enter(flow, { ...here, chapters: { ...here.chapters, [hub]: done }, chapter: null }, hub, ctx, guard + 1);
    }
    case 'restart':
      return here.chapter === null ? here : enter(flow, here, here.chapter.start, ctx, guard + 1);
    case 'chapters': {
      const all = Array.isArray(c.chapters) ? c.chapters.length : 0;
      const done = here.chapters[to] ?? [];
      if (all > 0 && done.length >= all) return enter(flow, here, follow(flow, to, 'done'), ctx, guard + 1);
      return here;
    }
    case 'subflow':
    case 'each':
    case 'handoff':
      return here;
    case 'return':
    case 'end':
      return leave(flow, here, ctx, guard, node.type === 'end');
    default:
      return here;
  }
}

/** Aus dem Ablauf heraus: zurück in den, der ihn aufrief — sonst ist es zu Ende. */
function leave(_flow: Flow, state: FlowState, ctx: PlayContext, guard: number, hard = false): FlowState {
  if (hard || state.stack.length === 0) return { ...state, ended: true };
  const back = state.stack[state.stack.length - 1];
  const parent = ctx.flows(back.flow);
  const rest = state.stack.slice(0, -1);
  if (parent === undefined || back.step === null) return { ...state, stack: rest, ended: true };
  /* Ein „dla każdego" mit weiteren Einträgen: noch einmal hinein. */
  if (state.queue !== undefined && state.queue.length > 0) {
    const inner = ctx.flows(state.flow);
    if (inner !== undefined) {
      const [item, ...queue] = state.queue;
      return enter(inner, { ...state, item, queue, step: inner.start }, inner.start, ctx, guard + 1);
    }
  }
  const resumed: FlowState = { ...state, flow: back.flow, stack: rest, item: back.item, queue: undefined, chapter: null };
  return enter(parent, resumed, follow(parent, back.step, 'next'), ctx, guard + 1);
}

/**
 * WEITER — vom aktuellen Schritt über einen Ausgang (`right`, `o2`, `c1`, …;
 * ohne: `next`). Die Wahl eines Kapitels merkt sich, wo es begann.
 */
export function advance(flow: Flow, state: FlowState, exit: string | undefined, ctx: PlayContext): FlowState {
  if (state.ended || state.step === null) return state;
  const node = nodeOf(flow, state.step);
  if (node === undefined) return { ...state, ended: true };
  const c = node.config;

  if (node.type === 'subflow' || node.type === 'handoff' || node.type === 'each') {
    const inner = ctx.flows(str(c.flow));
    if (inner === undefined) return enter(flow, state, follow(flow, node.id, 'next'), ctx);
    if (node.type === 'handoff') return enter(inner, { ...state, flow: inner.id, stack: [], chapter: null }, inner.start, ctx);
    const items = node.type === 'each' ? ctx.members(str(c.collection) || str(c.kind)) : [];
    if (node.type === 'each' && items.length === 0) return enter(flow, state, follow(flow, node.id, 'next'), ctx);
    const [item, ...queue] = items;
    return enter(inner, {
      ...state, flow: inner.id, chapter: null,
      stack: [...state.stack, { flow: flow.id, step: node.id, ...(state.item === undefined ? {} : { item: state.item }) }],
      ...(node.type === 'each' ? { item, queue } : {})
    }, inner.start, ctx);
  }

  const out = exit ?? 'next';
  const to = follow(flow, node.id, out);
  if (node.type === 'chapters' && /^c\d+$/.test(out)) {
    const index = Number(out.slice(1));
    return enter(flow, { ...state, chapter: to === null ? null : { hub: node.id, index, start: to } }, to, ctx);
  }
  if (node.type === 'choice' && /^o\d+$/.test(out)) {
    const option = (Array.isArray(c.options) ? c.options : [])[Number(out.slice(1))];
    const actions = isObject(option) ? actionsOf(option.actions) : [];
    const done = apply(actions, state.values, ctx.limits);
    return enter(flow, { ...state, values: done.values }, done.go ?? to, ctx);
  }
  return enter(flow, state, to, ctx);
}

/** Die Möglichkeiten einer Wahl, die gerade gelten (eine Möglichkeit darf eine Bedingung tragen). */
export function optionsOf(node: GraphNode, facts: Facts): { exit: string; label: string }[] {
  const list = Array.isArray(node.config.options) ? node.config.options : [];
  return list.flatMap((o, i) => {
    const label = str(isObject(o) ? o.label : o) || `możliwość ${i + 1}`;
    const condition = isObject(o) ? readCondition(o.condition) : null;
    return holds(condition, facts) ? [{ exit: `o${i}`, label }] : [];
  });
}

/** Die Kapitel einer Auswahl, die noch fehlen [F32]. */
export function chaptersLeft(node: GraphNode, state: FlowState): { exit: string; title: string }[] {
  const done = new Set(state.chapters[node.id] ?? []);
  return (Array.isArray(node.config.chapters) ? node.config.chapters : [])
    .map((c, i) => ({ exit: `c${i}`, title: str(isObject(c) ? c.title : c) || `Rozdział ${i + 1}`, i }))
    .filter((c) => !done.has(c.i))
    .map(({ exit, title }) => ({ exit, title }));
}

/** Welche Zeilen der Gestalten jetzt fallen — und noch nicht gefallen sind (bei „einmal"). */
export function linesNow(flow: Flow, state: FlowState, facts: Facts): CharacterLine[] {
  return flow.lines.filter((l) => !(l.once && state.said.includes(`${l.character}:${l.of}`)) && holds(l.condition, facts));
}

export const markSaid = (state: FlowState, lines: readonly CharacterLine[]): FlowState =>
  lines.length === 0 ? state : { ...state, said: [...new Set([...state.said, ...lines.map((l) => `${l.character}:${l.of}`)])] };

/** Welche Ziele erreicht sind [H6]. */
export const goalsReached = (flow: Flow, facts: Facts): string[] => flow.goals.filter((g) => g.condition !== null && holds(g.condition, facts)).map((g) => g.id);

/** Was der Ablauf zeigt (ohne Logik): die Einträge, Wissen, Fragen, Dateien — für die Veröffentlichung und das Lernen ohne Netz. */
export function contentOf(flow: Flow): { entities: string[]; flows: string[]; files: string[] } {
  const entities = new Set<string>();
  const flows = new Set<string>();
  const files = new Set<string>();
  const walk = (v: unknown, key = '') => {
    if (typeof v === 'string') {
      if (['of', 'character', 'item', 'collection'].includes(key) && v !== '') entities.add(v);
      if (key === 'flow' && v !== '') flows.add(v);
      return;
    }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, key)); return; }
    if (isObject(v)) {
      if (typeof v.file === 'string' && typeof v.type === 'string') files.add(v.file);
      for (const [k, x] of Object.entries(v)) walk(x, k);
    }
  };
  for (const n of flow.graph.nodes) walk(n.config);
  for (const l of flow.lines) { entities.add(l.character); entities.add(l.of); }
  return { entities: [...entities], flows: [...flows], files: [...files] };
}

/**
 * Was Abläufe über Abhängigkeiten nahelegen [E5]: eine Voraussetzung, deren
 * Erklärung zu einem Eintrag führt — der Autor bestätigt sie oder nicht.
 */
export function proposedDependencies(flow: Flow): { parent: string; child: string }[] {
  const out: { parent: string; child: string }[] = [];
  for (const n of flow.graph.nodes) {
    if (n.type !== 'prerequisite') continue;
    const parent = str(n.config.of);
    const next = follow(flow, n.id, 'known');
    const child = next === null ? '' : str(nodeOf(flow, next)?.config.of);
    if (parent !== '' && child !== '' && parent !== child) out.push({ parent, child });
  }
  return out;
}
