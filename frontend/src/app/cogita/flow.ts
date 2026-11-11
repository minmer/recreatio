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
 *   expand      ein Begriff, an Ort und Stelle erklärt, wenn er noch nicht sitzt
 *   (2026-10-30: der frühere Schritt „Najpierw podstawy" — `prerequisite` — ist ein „Warunek" mit „Znajomość";
 *   ein alter wird beim Lesen zu ihm, `migratePrerequisites`)
 *   opening     ein Anfang: entdecken (erst fragen) oder erinnern (erst zeigen) [G13]
 *   line        eine Gestalt spricht (ihr Satz ist ein Wissen) [H2]
 *   handoff     weiter in einem anderen Ablauf (eine Übergabe)
 *   detour      (2026-11-04, Prompt 13) ein Abstecher in eine andere Erzählung, angeboten: „Wejdź" oder „Dalej bez tego";
 *               Ausgänge „done" (nach ihrem Ende) und „skip" (ausgelassen; fehlt bei "optional": false)
 *   review      (2026-11-05, Prompt 23, D4) der Przegląd als EIN Schritt: fragt die Fragen des Ablaufs, die noch nicht
 *               sitzen, einmal je Runde; Anteil des Gekonnten ≥ "threshold" → Ausgang „passed", sonst „notyet" (`reviewOf`)
 *   scene       (Schritt 12) eine Szene einer Präsentation — Ausgänge „dalej", die Frage
 *               auf ihr (dobrze / źle), ihre Knöpfe (b0, b1 …)
 *   end · return
 * </code>
 *
 * <b>Eine Erzählung</b> (2026-10-22, Schritt 12, COGITA.md §8): das Storyboard
 * einer Präsentation IST ein Ablauf im Aussehen `scenes` — gespeichert bleibt
 * es in der Seite; ein Ablauf der Baza zeigt nur auf sie (`presentation`), und
 * `pages/presentation/storyFlow.ts` liest es als diesen Graphen. Erzähler
 * (`narrators`) wählen sich nach den Werten.
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
import { t, texts } from '../core/i18n';
import { apply, holds, readAction, readCondition, type Action, type Condition, type Facts, type ValueLimit } from './logic';

export const STEP_TYPES = [
  'show', 'question', 'choice', 'condition', 'set', 'chapters', 'chapterEnd', 'restart', 'subflow', 'each',
  'expand', 'opening', 'line', 'handoff', 'detour', 'review', 'scene', 'end', 'return'
] as const;
export type StepType = (typeof STEP_TYPES)[number];

export const STEP_LABEL: Record<StepType, string> = texts({
  show: 'cogitaEditFlow.stepLabel.show', question: 'cogitaEditFlow.stepLabel.question', choice: 'cogitaEditFlow.stepLabel.choice', condition: 'cogitaEditFlow.stepLabel.condition', set: 'cogitaEditFlow.stepLabel.set',
  chapters: 'cogitaEditFlow.stepLabel.chapters', chapterEnd: 'cogitaEditFlow.stepLabel.chapterEnd', restart: 'cogitaEditFlow.stepLabel.restart', subflow: 'cogitaEditFlow.stepLabel.subflow',
  each: 'cogitaEditFlow.stepLabel.each', expand: 'cogitaEditFlow.stepLabel.expand', opening: 'cogitaEditFlow.stepLabel.opening',
  line: 'cogitaEditFlow.stepLabel.line', handoff: 'cogitaEditFlow.stepLabel.handoff', detour: 'cogitaEditFlow.stepLabel.detour', review: 'cogitaEditFlow.stepLabel.review', scene: 'cogitaEditFlow.stepLabel.scene', end: 'cogitaEditFlow.stepLabel.end', return: 'cogitaEditFlow.stepLabel.return'
});

/** Was ein Schritt im Ablauf-Editor bedeutet — ein Satz, auch für die Beschreibung des JSON. */
export const STEP_SAYS: Record<StepType, string> = texts({
  show: 'cogitaEditFlow.stepSays.show',
  question: 'cogitaEditFlow.stepSays.question',
  choice: 'cogitaEditFlow.stepSays.choice',
  condition: 'cogitaEditFlow.stepSays.condition',
  set: 'cogitaEditFlow.stepSays.set',
  chapters: 'cogitaEditFlow.stepSays.chapters',
  chapterEnd: 'cogitaEditFlow.stepSays.chapterEnd',
  restart: 'cogitaEditFlow.stepSays.restart',
  subflow: 'cogitaEditFlow.stepSays.subflow',
  each: 'cogitaEditFlow.stepSays.each',
  expand: 'cogitaEditFlow.stepSays.expand',
  opening: 'cogitaEditFlow.stepSays.opening',
  line: 'cogitaEditFlow.stepSays.line',
  handoff: 'cogitaEditFlow.stepSays.handoff',
  detour: 'cogitaEditFlow.stepSays.detour',
  review: 'cogitaEditFlow.stepSays.review',
  scene: 'cogitaEditFlow.stepSays.scene',
  end: 'cogitaEditFlow.stepSays.end',
  return: 'cogitaEditFlow.stepSays.return'
});

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const port = (id: string, label: string, many = false): Port => ({ id, label, type: 'step', many });

/** Die Ausgänge eines Schrittes — sie hängen an seiner Einstellung (eine Wahl mit drei Möglichkeiten hat drei). */
export function exitsOf(type: string, config: Readonly<Record<string, unknown>>): Port[] {
  switch (type) {
    case 'question': return [port('right', t('cogitaEditFlow.exit.right')), port('wrong', t('cogitaEditFlow.exit.wrong'))];
    case 'choice': return (Array.isArray(config.options) ? config.options : []).map((o, i) => port(`o${i}`, str(isObject(o) ? o.label : o) || t('cogitaEditFlow.exit.option', { n: i + 1 })));
    case 'condition': return [port('yes', t('cogitaEditFlow.exit.yes')), port('no', t('cogitaEditFlow.exit.no'))];
    /* 2026-11-05 (Prompt 23, D4) — der Przegląd in einem Schritt: zdany oder noch nicht. */
    case 'review': return [port('passed', t('cogitaEditFlow.exit.passed')), port('notyet', t('cogitaEditFlow.exit.notYet'))];
    /* 2026-11-04 (Prompt 13) — ein Abstecher: nach der anderen Erzählung „done", ausgelassen „skip" (nur, wenn er freiwillig ist). */
    case 'detour': return config.optional === false || config.required === true ? [port('done', t('cogitaEditFlow.exit.afterStory'))] : [port('done', t('cogitaEditFlow.exit.afterStory')), port('skip', t('cogitaEditFlow.exit.skip'))];
    case 'chapters': return [...(Array.isArray(config.chapters) ? config.chapters : []).map((c, i) => port(`c${i}`, str(isObject(c) ? c.title : c) || t('cogitaEditFlow.exit.chapter', { n: i + 1 }))), port('done', t('cogitaEditFlow.exit.allDone'))];
    /* 2026-10-22 (Schritt 12) — eine Szene: „dalej", die Frage auf ihr, ihre Knöpfe. */
    case 'scene': return [
      port('next', t('cogitaEditFlow.exit.next')),
      ...(config.question === true ? [port('right', t('cogitaEditFlow.exit.right')), port('wrong', t('cogitaEditFlow.exit.wrong'))] : []),
      ...(Array.isArray(config.buttons) ? config.buttons : []).flatMap((b) => (isObject(b) && str(b.exit) !== '' ? [port(str(b.exit), str(b.label) || str(b.exit))] : []))
    ];
    case 'end':
    case 'return':
    case 'chapterEnd':
    case 'restart':
    case 'handoff':
      return [];
    default: return [port('next', t('cogitaEditFlow.exit.next'))];
  }
}

type FlowCtx = Record<string, never>;

const STEP: (type: StepType) => NodeKind<FlowCtx> = (type) => ({
  type,
  get label() { return STEP_LABEL[type]; },
  get says() { return STEP_SAYS[type]; },
  get group() {
    return type === 'show' || type === 'line' || type === 'expand' || type === 'scene' ? t('cogitaEditFlow.group.content')
      : type === 'question' || type === 'choice' || type === 'opening' ? t('cogitaEditFlow.group.talk')
      : type === 'condition' || type === 'set' ? t('cogitaEditFlow.group.logic')
      : t('cogitaEditFlow.group.flow');
  },
  ports: (config) => ({ inputs: [port('in', t('cogitaEditFlow.exit.in'), true)], outputs: exitsOf(type, config) }),
  run: () => ({})
});

/** Die Palette des Ablauf-Editors — die Schritte als Knoten. */
export const FLOW_PALETTE = paletteOf<FlowCtx>('flow', STEP_TYPES.map(STEP));

/* -- Der Ablauf ------------------------------------------------------------------------- */

export const LOOK_TYPES = ['reading', 'slides', 'scenes', 'dialogue', 'flashcards', 'map'] as const;
export type LookType = (typeof LOOK_TYPES)[number];

export const LOOK_LABEL: Record<LookType, string> = texts({
  reading: 'cogitaEditFlow.look.reading', slides: 'cogitaEditFlow.look.slides', scenes: 'cogitaEditFlow.look.scenes',
  dialogue: 'cogitaEditFlow.look.dialogue', flashcards: 'cogitaEditFlow.look.flashcards', map: 'cogitaEditFlow.look.map'
});

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

/** 2026-10-22 (Schritt 12) — ein Erzähler: die Gestalt, die erzählt, solange ihre Bedingung gilt (die erste, die gilt). */
export interface Narrator {
  readonly character: string;
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
  /** 2026-10-22 (Schritt 12) — wer erzählt, nach den Werten (der erste, dessen Bedingung gilt). */
  readonly narrators: readonly Narrator[];
  /** 2026-10-22 (Schritt 12) — ein Storyboard einer Präsentation (der Pfad der Seite): der Graph kommt aus ihr. */
  readonly presentation?: string;
  /**
   * 2026-11-03 (G) — DIE EINHEIT, DIE DIESE ERZÄHLUNG IST (ein Eintrag der Baza): im Krajobraz EIN Feld — seine Ścieżka
   * ist die der Erzählung, und wer sie zu Ende bringt, senkt das Feld ins Tal.
   */
  readonly unit?: string;
  /**
   * 2026-11-03 (Prompt 5) — WO DER PRZEGLĄD BEGINNT: ein Schritt des eigenen Graphen (bei einer Präsentation der Schlüssel
   * einer Szene). „Powtórz przegląd" springt dorthin; ohne ihn an den Anfang.
   */
  readonly review?: string;
  /** 2026-11-04 (Prompt 13) — der bleibende Name aus dem Import („@bosko/krag"): so findet ein neu eingespielter Ablauf seine Stellen wieder. */
  readonly ref?: string;
}

/**
 * 2026-11-05 (Prompt 23, D4) — DER PRZEGLĄD ALS EIN SCHRITT (`{"type": "review", "of": "story", "threshold": 0.9}`):
 * <code>
 *   of         "story" — die Fragen DIESES Ablaufs (seine Schritte „question"); "@przebieg" / Kennung — die eines anderen
 *   threshold  Anteil der Fragen, die danach sitzen müssen (0–1; Vorgabe 0.9)
 *   value      wo das Ergebnis steht (1 zdany, 0 nie; Vorgabe "<bleibender Name ohne @ oder Kennung>.przeglad")
 *   goal       Name des Ziels, das ein Ablauf ohne eigene "goals" bekommt (Vorgabe „Przegląd zdany")
 * </code>
 * Ersetzt das Muster „set 0 → je Frage +1 → Bedingung ≥ N → zurück" (das weiter gilt).
 */
export interface ReviewConfig {
  readonly of: string;
  readonly threshold: number;
  readonly value: string;
  readonly goal: string;
}

/** Der Schlüssel des Ergebnisses eines Przegląd (bleibt bei einem neu eingespielten Ablauf derselbe, über den bleibenden Namen). */
export const reviewKey = (flow: Pick<Flow, 'id' | 'ref'>): string => `${(flow.ref ?? flow.id).replace(/^@/, '')}.przeglad`;

export function reviewOf(flow: Pick<Flow, 'id' | 'ref'>, node: Pick<GraphNode, 'type' | 'config'>): ReviewConfig | null {
  if (node.type !== 'review') return null;
  const c = node.config;
  const th = typeof c.threshold === 'number' && Number.isFinite(c.threshold) ? c.threshold : 0.9;
  return {
    of: str(c.of).trim() || 'story',
    threshold: Math.max(0, Math.min(1, th > 1 ? th / 100 : th)),
    value: str(c.value).trim() || reviewKey(flow),
    goal: str(c.goal).trim() || t('cogitaEditFlow.reviewPassed')
  };
}

/** Der Schritt, zu dem kein Weg führt — `null`, wenn es keinen oder mehrere gibt. */
function entryOf(graph: Graph): string | null {
  const reached = new Set(graph.edges.filter((e) => e.from !== e.to).map((e) => e.to));
  const free = graph.nodes.filter((n) => !reached.has(n.id));
  return free.length === 1 ? free[0].id : null;
}

export function readFlow(id: string, raw: unknown): Flow {
  const d = isObject(raw) ? raw : {};
  const graph = migratePrerequisites(readGraph(d.graph, true));
  const start = str(d.start);
  const fill: Record<string, string> = {};
  if (isObject(d.fill)) for (const [k, v] of Object.entries(d.fill)) if (typeof v === 'string' && v !== '') fill[k] = v;
  const overrides: Record<string, Record<string, unknown>> = {};
  if (isObject(d.overrides)) for (const [k, v] of Object.entries(d.overrides)) if (isObject(v)) overrides[k] = v;
  const goals = (Array.isArray(d.goals) ? d.goals : []).flatMap((g): Goal[] => (isObject(g) && str(g.id) !== '' ? [{ id: str(g.id), title: str(g.title) || str(g.id), condition: readCondition(g.condition) }] : []));
  /*
    2026-11-05 (Prompt 23, D4) — EIN SCHRITT „review": ohne eigene Ziele bekommt der Ablauf das Ziel „Przegląd zdany" (sein
    Ergebnis ist 1), und „Powtórz przegląd" springt zu ihm, wenn "review" nichts anderes nennt.
  */
  const reviewNode = graph.nodes.find((n) => n.type === 'review');
  const self = { id, ...(str(d._ref) === '' ? {} : { ref: str(d._ref) }) };
  const rc = reviewNode === undefined ? null : reviewOf(self, reviewNode);
  if (rc !== null && goals.length === 0) goals.push({ id: 'przeglad', title: rc.goal, condition: { type: 'value', value: rc.value, op: 'ge', than: 1 } as Condition });
  const reviewAt = str(d.review).trim() || (reviewNode?.id ?? '');
  return {
    id,
    ...(str(d._ref) === '' ? {} : { ref: str(d._ref) }),
    name: str(d.name).trim() || 'Przebieg',
    look: (LOOK_TYPES as readonly string[]).includes(str(d.look)) ? (d.look as LookType) : 'reading',
    ...(str(d.lookId) === '' ? {} : { lookId: str(d.lookId) }),
    /* 2026-11-04 — ohne gültiges "start": der eine Schritt, zu dem nichts führt (sonst wie bisher der erste). */
    start: graph.nodes.some((n) => n.id === start) ? start : (entryOf(graph) ?? graph.nodes[0]?.id ?? null),
    graph,
    slots: (Array.isArray(d.slots) ? d.slots : []).flatMap((s): Slot[] => (isObject(s) && str(s.id) !== '' ? [{ id: str(s.id), label: str(s.label) || str(s.id), ...(str(s.kind) === '' ? {} : { kind: str(s.kind) }) }] : [])),
    ...(str(d.template) === '' ? {} : { template: str(d.template) }),
    fill,
    overrides,
    goals,
    lines: (Array.isArray(d.lines) ? d.lines : []).flatMap((l): CharacterLine[] => (isObject(l) && str(l.character) !== '' && str(l.of) !== '' ? [{ character: str(l.character), of: str(l.of), condition: readCondition(l.condition), once: l.once !== false }] : [])),
    narrators: (Array.isArray(d.narrators) ? d.narrators : []).flatMap((n): Narrator[] => (isObject(n) && str(n.character) !== '' ? [{ character: str(n.character), condition: readCondition(n.condition) }] : [])).slice(0, 12),
    ...(str(d.presentation).trim() === '' ? {} : { presentation: str(d.presentation).trim().replace(/^#?\/?/, '') }),
    ...(str(d.unit).trim() === '' ? {} : { unit: str(d.unit).trim() }),
    ...(reviewAt === '' ? {} : { review: reviewAt })
  };
}

/** 2026-10-22 (Schritt 12) — wer jetzt erzählt: der erste Erzähler, dessen Bedingung gilt (ohne Bedingung: immer). */
export function narratorNow(flow: Pick<Flow, 'narrators'>, facts: Facts): Narrator | null {
  return flow.narrators.find((n) => holds(n.condition, facts)) ?? null;
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
  const nodes: GraphNode[] = template.graph.nodes.map((n) => {
    const over = flow.overrides[n.id] ?? {};
    /* 2026-10-30 — eine Verwendung, die einen früheren „Najpierw podstawy" überschrieb (`of`, `threshold`): dieselbe Bedingung. */
    const legacy = n.type === 'condition' && ('of' in over || 'threshold' in over) ? readCondition(n.config.condition) : null;
    const merged = legacy !== null && legacy.type === 'knowness' && legacy.rel === undefined
      ? prerequisiteCondition({ ...n.config, of: legacy.of, threshold: legacy.than, ...over })
      : { ...n.config, ...over };
    return { ...n, config: fill(merged) as Record<string, unknown> };
  });
  return { ...template, id: flow.id, name: flow.name || template.name, look: flow.look, ...(flow.lookId === undefined ? {} : { lookId: flow.lookId }), graph: { nodes, edges: template.graph.edges }, fill: flow.fill, overrides: flow.overrides, template: flow.template, narrators: flow.narrators.length > 0 ? flow.narrators : template.narrators };
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
  /**
   * 2026-11-04 (Prompt 10) — DIE REGEL DES SPIELERS: eine Frage, die der Lernende schon kann, wird still übersprungen —
   * über ihren Ausgang „dobrze", ohne Antwort und ohne den Plan der Karte zu ändern (`flowAsk.ts`).
   */
  readonly skip?: (node: GraphNode, state: FlowState) => boolean;
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
  if (guard > 600) return { ...state, step: to, ended: to === null };
  if (to === null) return leave(flow, state, ctx, guard);
  const node = nodeOf(flow, to);
  if (node === undefined) return leave(flow, state, ctx, guard);
  const visited = state.visited.includes(to) ? state.visited : [...state.visited, to];
  const here: FlowState = { ...state, step: to, visited };
  const facts = ctx.facts(here);
  const c = node.config;

  if (node.type === 'question' && ctx.skip?.(node, here) === true) return enter(flow, here, follow(flow, to, 'right'), ctx, guard + 1);
  /*
    2026-11-10 (Eigentümer: „kein leerer Entscheidungsfolie") — EIN SCHRITT, DER SICH ERÜBRIGT:
      skipWhen  eine Bedingung an einem Schritt mit nur einem Ausgang „dalej" (show, opening, line, scene ohne Frage): gilt sie, geht
                es gleich weiter (wer es weiss, wer es kürzlich wiederholt hat, wer an einem Wert steht …)
      Wahl      bleibt von den Möglichkeiten genau EINE übrig (die anderen tragen eine Bedingung, die nicht gilt), wählt sie sich selbst;
                `"hold": true` hält die Wahl trotzdem an
  */
  if (SKIPPABLE.has(node.type) && !(node.type === 'scene' && c.question === true) && skips(c.skipWhen, facts)) {
    return enter(flow, here, follow(flow, to, 'next'), ctx, guard + 1);
  }
  /* 2026-11-11 — eine Wahl mit eigener Folie ("of") wird immer gelesen: sie wählt nie selbst (wie "hold": true). */
  if (node.type === 'choice' && c.hold !== true && str(c.of) === '') {
    const only = optionsOf(node, facts);
    if (only.length === 1) return takeOption(flow, here, node, only[0].exit, ctx, guard + 1);
  }
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
    case 'detour':
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
  return enter(parent, resumed, follow(parent, back.step, exitAfter(parent, back.step)), ctx, guard + 1);
}

/** 2026-11-04 (Prompt 13) — über welchen Ausgang es nach einer gerufenen Erzählung weitergeht: ein Abstecher „done", sonst „dalej". */
export const exitAfter = (flow: Flow, step: string): string => (nodeOf(flow, step)?.type === 'detour' ? 'done' : 'next');

/** 2026-11-04 (Prompt 13) — so tief dürfen Abstecher ineinander gehen (ein Abstecher in einem Abstecher in einem Abstecher). */
export const DETOUR_DEPTH = 3;

/** 2026-11-04 (Prompt 13) — wie viele Abstecher gerade offen sind (Rahmen des Stapels, die an einem „detour" warten). */
export function detourDepth(state: Pick<FlowState, 'stack'>, flows: (id: string) => Flow | undefined): number {
  return state.stack.filter((x) => { const f = flows(x.flow); return x.step !== null && f !== undefined && nodeOf(f, x.step)?.type === 'detour'; }).length;
}

/**
 * 2026-11-04 (Prompt 13) — DARF DIESER ABSTECHER HINEIN? Nicht in eine Erzählung, die schon läuft oder ihn ruft (ein Kreis
 * A → B → A), und nicht tiefer als `DETOUR_DEPTH`. `null`: ja; sonst warum nicht.
 */
export function detourRefused(state: Pick<FlowState, 'flow' | 'stack'>, target: string, flows: (id: string) => Flow | undefined): 'cycle' | 'deep' | null {
  if (target === state.flow || state.stack.some((x) => x.flow === target)) return 'cycle';
  return detourDepth(state, flows) >= DETOUR_DEPTH ? 'deep' : null;
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

  /*
    2026-11-04 (Prompt 13) — EIN ABSTECHER: „enter" (oder kein Ausgang) geht hinein — die andere Erzählung von ihrem Anfang
    (der Spieler setzt danach ihre gemerkte Stelle); „done" / „skip" gehen weiter wie andere Ausgänge. Kreis oder zu tief: er
    bleibt stehen.
  */
  if (node.type === 'detour' && (exit === undefined || exit === 'enter')) {
    const inner = ctx.flows(str(c.flow));
    if (inner === undefined || detourRefused(state, inner.id, ctx.flows) !== null) return state;
    return enter(inner, {
      ...state, flow: inner.id, chapter: null, item: undefined, queue: undefined,
      stack: [...state.stack, { flow: flow.id, step: node.id, ...(state.item === undefined ? {} : { item: state.item }) }]
    }, inner.start, ctx);
  }

  /* 2026-11-05 (Prompt 23, D4) — ein Przegląd: das Ergebnis (1 zdany, 0 nie) in seiner Wartość, dann weiter über „passed"/„notyet". */
  if (node.type === 'review' && (exit === 'passed' || exit === 'notyet')) {
    const rc = reviewOf(flow, node)!;
    return enter(flow, { ...state, values: { ...state.values, [rc.value]: exit === 'passed' ? 1 : 0 } }, follow(flow, node.id, exit), ctx);
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

/** Gilt `skipWhen`? Eine unlesbare Bedingung gilt nie (eine fehlende gälte immer — und überspränge jeden Schritt). */
const skips = (raw: unknown, facts: Facts): boolean => { const cond = raw === undefined ? null : readCondition(raw); return cond !== null && holds(cond, facts); };

/** Schritte mit einem Ausgang „dalej", die `skipWhen` tragen dürfen. */
const SKIPPABLE: ReadonlySet<string> = new Set(['show', 'opening', 'line', 'scene']);

/** Eine Möglichkeit einer Wahl nehmen (mit ihren Aktionen) — von Hand oder von selbst. */
function takeOption(flow: Flow, state: FlowState, node: GraphNode, exit: string, ctx: PlayContext, guard = 0): FlowState {
  const option = (Array.isArray(node.config.options) ? node.config.options : [])[Number(exit.slice(1))];
  const done = apply(isObject(option) ? actionsOf(option.actions) : [], state.values, ctx.limits);
  const to = follow(flow, node.id, exit);
  return enter(flow, { ...state, values: done.values }, done.go ?? to, ctx, guard);
}

/** Die Möglichkeiten einer Wahl, die gerade gelten (eine Möglichkeit darf eine Bedingung tragen). */
export function optionsOf(node: GraphNode, facts: Facts): { exit: string; label: string }[] {
  const list = Array.isArray(node.config.options) ? node.config.options : [];
  return list.flatMap((o, i) => {
    const label = str(isObject(o) ? o.label : o) || t('cogitaEditFlow.exit.option', { n: i + 1 });
    const condition = isObject(o) ? readCondition(o.condition) : null;
    return holds(condition, facts) ? [{ exit: `o${i}`, label }] : [];
  });
}

/** Die Kapitel einer Auswahl, die noch fehlen [F32]. */
export function chaptersLeft(node: GraphNode, state: FlowState): { exit: string; title: string }[] {
  const done = new Set(state.chapters[node.id] ?? []);
  return (Array.isArray(node.config.chapters) ? node.config.chapters : [])
    .map((c, i) => ({ exit: `c${i}`, title: str(isObject(c) ? c.title : c) || t('cogitaEditFlow.chapterN', { n: i + 1 }), i }))
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

/** Was der Ablauf zeigt (ohne Logik): die Einträge, Wissen, Fragen, Dateien — für das Lernen ohne Netz. */
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
    /* 2026-10-30 — ein „Warunek", der fragt, ob man einen Eintrag kennt (wie der frühere „Najpierw podstawy"). */
    const c = n.type === 'condition' ? readCondition(n.config.condition) : null;
    if (c === null || c.type !== 'knowness' || c.rel !== undefined) continue;
    const parent = c.of ?? '';
    const next = follow(flow, n.id, 'yes');
    const child = next === null ? '' : str(nodeOf(flow, next)?.config.of);
    if (parent !== '' && child !== '' && parent !== child) out.push({ parent, child });
  }
  return out;
}

/** Der frühere Schritt „Najpierw podstawy" als die Bedingung, die er war: wer `of` kennt (ab `threshold`, sonst 1). */
const prerequisiteCondition = (config: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const { of, threshold, ...rest } = config;
  return { ...rest, condition: { type: 'knowness', of: of ?? '', op: 'ge', than: num(threshold, 1) } };
};

/**
 * 2026-10-30 — DER SCHRITT „Najpierw podstawy" (`prerequisite`) IST EINE BEDINGUNG der einen Logik: „wer `of` kennt"
 * ist ein „Warunek" mit „Znajomość". Ein alter Schritt wird beim Lesen zu ihm — Kennung und Platz bleiben, die
 * Ausgänge heissen nun „tak" (vorher „zna") und „nie" (vorher „wyjaśnij").
 */
export function migratePrerequisites(graph: Graph): Graph {
  const old = new Set(graph.nodes.filter((n) => n.type === 'prerequisite').map((n) => n.id));
  if (old.size === 0) return graph;
  return {
    nodes: graph.nodes.map((n) => (old.has(n.id) ? { ...n, type: 'condition', config: prerequisiteCondition(n.config) } : n)),
    edges: graph.edges.map((e) => (!old.has(e.from) ? e : e.out === 'known' ? { ...e, out: 'yes' } : e.out === 'explain' ? { ...e, out: 'no' } : e))
  };
}
