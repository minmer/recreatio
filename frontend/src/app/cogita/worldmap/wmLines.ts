/**
 * 2026-11-09 — LINIEN AUS ABLÄUFEN (spec §5.2, Bericht §6, Entscheidungen 4, 15, Korrekturen 3, 4).
 * <code>
 *   R1  der Ort eines Schrittes: eine Folie zeigt einen Ort, sonst zeigt sie über ein Verweisfeld auf einen (Bosko: `o_czym`),
 *       sonst über Fragen, die sie erklären („explain"); eine Frage: worüber sie ist („about")
 *   R2  Halte nur aus Gezeigtem; eine geborgte Frage (über einen anderen Ort) führt ihre Karte auf diesem Abschnitt ein, hält
 *       aber nicht; der Przegląd (ab `review`, Schritte „review") hält nicht und führt nichts ein. Ein Ablauf, der keinen Ort
 *       zeigt, hält an den Orten seiner Fragen.
 *   R3  der erste Abschnitt kommt von dem Ort, den die Einheit verlangt (der tiefste; eine verlangte Einheit: der letzte Halt
 *       ihrer Linie), sonst vom Haus; seine Fahrkarte ist „Wymaga" der Einheit (Korrektur 4a)
 *   R4  ein Abstecher-Ziel beginnt und endet am rufenden Ort; mehrere Rufer: jeder ist ein Umsteigeort, die Linie wird einmal
 *       gezeichnet, Ein- und Rückfahrt gibt es je Rufer (Korrektur 3)
 *   Zweig  `choice`, `chapters`, eine Szene mit Knöpfen: je Ausgang ein Zweig (PR #5: `choice → subflow` wird so ein Zweig);
 *       er beginnt am letzten Halt davor, trifft er die anderen wieder, endet er am nächsten gemeinsamen Halt
 *   Fahrkarte  nur (a) „Wymaga", (b) die Bedingung der Möglichkeit, mit der ein Zweig beginnt, (c) ein Tor: ein Schritt
 *       „condition", dessen einer Ausgang die Linie verlässt (Korrektur 4)
 * </code>
 * Rein; geprüft in `scripts/app-wm-model-check.mjs`.
 */

import { exitsOf, type Flow } from '../flow';
import { readTicketCondition, unknownTypes } from './wmConditions';
import { byCode, shownEntries } from './wmGraph';
import { HOME, type Line, type LineBranch, type Lines, type Section, type SectionKind, type Station, type TicketPart, type WmCondition, type WmIssue, type World } from './wmTypes';

/** Der Anfang einer Linie, bevor feststeht, woher sie kommt (R3, R4). */
const START = '~start';
const SINK = '~sink';
const SEP = '>';
const MAX_INLINE = 4;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter((x) => x !== '') : str(v) === '' ? [] : [str(v)]);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Ein Schritt im aufgeklappten Graphen: eingebettete Abschnitte (`subflow`, `each`) stehen als `<schritt>>…` darin. */
interface XNode {
  readonly id: string;
  /** Der Schritt im Ablauf der Linie (bei Eingebettetem: der Schritt, der den Abschnitt ruft). */
  readonly orig: string;
  /** Der Ablauf, dem der Schritt gehört, und seine eigene Kennung dort. */
  readonly flow: string;
  readonly own: string;
  readonly type: string;
  readonly config: Readonly<Record<string, unknown>>;
}

interface XGraph {
  readonly nodes: Map<string, XNode>;
  readonly out: Map<string, { out: string; to: string }[]>;
  readonly start: string | null;
}

type Resolve = (ref: string) => Flow | undefined;

/** Den Ablauf aufklappen: jeder gerufene Abschnitt wird an Ort und Stelle eingesetzt (höchstens 4 tief, ohne Kreise). */
function expand(flow: Flow, resolve: Resolve): XGraph {
  const nodes = new Map<string, XNode>();
  const out = new Map<string, { out: string; to: string }[]>();
  const link = (from: string, exit: string, to: string) => { const l = out.get(from) ?? []; l.push({ out: exit, to }); out.set(from, l); };
  const put = (f: Flow, prefix: string, orig: string | null, depth: number, chain: ReadonlySet<string>, after: string | null): string | null => {
    const ids = new Set(f.graph.nodes.map((n) => n.id));
    for (const n of f.graph.nodes) nodes.set(prefix + n.id, { id: prefix + n.id, orig: orig ?? n.id, flow: f.id, own: n.id, type: n.type, config: n.config });
    const callFor = new Map<string, string | null>();
    for (const n of f.graph.nodes) {
      if ((n.type !== 'subflow' && n.type !== 'each') || depth >= MAX_INLINE) continue;
      const inner = resolve(str(n.config.flow));
      if (inner === undefined || chain.has(inner.id) || inner.start === null) continue;
      const next = f.graph.edges.find((e) => e.from === n.id && e.out === 'next' && ids.has(e.to))?.to;
      const entry = put(inner, `${prefix}${n.id}${SEP}`, orig ?? n.id, depth + 1, new Set([...chain, inner.id]), next === undefined ? after : prefix + next);
      callFor.set(n.id, entry);
    }
    for (const e of f.graph.edges) {
      if (!ids.has(e.from) || !ids.has(e.to)) continue;
      /* Der rufende Schritt geht in seinen Abschnitt; dessen Ende führt dorthin weiter, wohin er ging. */
      if (callFor.has(e.from) && e.out === 'next') continue;
      link(prefix + e.from, e.out, prefix + e.to);
    }
    for (const [step, entry] of callFor) if (entry !== null) link(prefix + step, 'enter', entry);
    /* Ein Abschnitt endet mit „Powrót" oder einem Ausgang ins Leere: zurück zum Rufer. Ein „Koniec" beendet alles. */
    if (after !== null) {
      for (const n of f.graph.nodes) {
        if (n.type === 'end' || n.type === 'handoff' || n.type === 'restart' || (callFor.get(n.id) ?? null) !== null) continue;
        if (n.type === 'return') { link(prefix + n.id, 'next', after); continue; }
        const have = new Set((out.get(prefix + n.id) ?? []).map((x) => x.out));
        for (const p of exitsOf(n.type, n.config)) if (!have.has(p.id)) link(prefix + n.id, p.id, after);
      }
    }
    return f.start === null ? null : prefix + f.start;
  };
  const start = put(flow, '', null, 0, new Set([flow.id]), null);
  return { nodes, out, start };
}

/** Die Abfolge vorwärts: Rückkanten (Wiederholen, Kreise) fallen weg; ein Kapitelende führt dorthin, wo es nach allen weitergeht. */
interface Dag {
  readonly order: readonly string[];
  readonly index: ReadonlyMap<string, number>;
  readonly next: (id: string) => readonly { out: string; to: string }[];
  readonly back: ReadonlySet<string>;
  readonly ipdom: ReadonlyMap<string, string>;
}

const TERMINAL = new Set(['end', 'restart', 'handoff']);

function dagOf(g: XGraph): Dag {
  /* Ein Kapitelende gehört zu der Auswahl, aus deren Kapitel man es erreicht. */
  const hubOf = new Map<string, string>();
  for (const hub of [...g.nodes.values()].filter((n) => n.type === 'chapters')) {
    for (const { out, to } of g.out.get(hub.id) ?? []) {
      if (!/^c\d+$/.test(out)) continue;
      const seen = new Set<string>();
      const stack = [to];
      while (stack.length > 0) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const n = g.nodes.get(id);
        if (n === undefined) continue;
        if (n.type === 'chapterEnd') { if (!hubOf.has(id)) hubOf.set(id, hub.id); continue; }
        if (n.type === 'chapters' || TERMINAL.has(n.type)) continue;
        for (const o of g.out.get(id) ?? []) stack.push(o.to);
      }
    }
  }
  const raw = (id: string): { out: string; to: string }[] => {
    const n = g.nodes.get(id);
    if (n === undefined || TERMINAL.has(n.type)) return [];
    if (n.type === 'chapterEnd') {
      const hub = hubOf.get(id);
      const done = hub === undefined ? undefined : (g.out.get(hub) ?? []).find((o) => o.out === 'done')?.to;
      return done === undefined ? [] : [{ out: 'next', to: done }];
    }
    return (g.out.get(id) ?? []).filter((o) => g.nodes.has(o.to));
  };
  const back = new Set<string>();
  const post: string[] = [];
  if (g.start !== null && g.start !== undefined && g.nodes.has(g.start)) {
    const state = new Map<string, 1 | 2>();
    const stack: { id: string; kids: { out: string; to: string }[]; i: number }[] = [{ id: g.start, kids: raw(g.start), i: 0 }];
    state.set(g.start, 1);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top.i >= top.kids.length) { state.set(top.id, 2); post.push(top.id); stack.pop(); continue; }
      const k = top.kids[top.i];
      top.i += 1;
      const s = state.get(k.to);
      if (s === 1) { back.add(`${top.id}${SEP}${k.out}`); continue; }
      if (s === 2) continue;
      state.set(k.to, 1);
      stack.push({ id: k.to, kids: raw(k.to), i: 0 });
    }
  }
  const order = post.slice().reverse();
  const index = new Map(order.map((id, i) => [id, i] as const));
  index.set(SINK, order.length);
  const next = (id: string) => raw(id).filter((o) => !back.has(`${id}${SEP}${o.out}`) && index.has(o.to));
  /* Der nächste Schritt, an dem alle Wege wieder zusammenkommen (Nachdominator), rückwärts in der Reihenfolge. */
  const ipdom = new Map<string, string>([[SINK, SINK]]);
  const meet = (a0: string, b0: string): string => {
    let a = a0;
    let b = b0;
    while (a !== b) {
      while (index.get(a)! < index.get(b)!) a = ipdom.get(a) ?? SINK;
      while (index.get(b)! < index.get(a)!) b = ipdom.get(b) ?? SINK;
    }
    return a;
  };
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const id = order[i];
    const succ = [...new Set(next(id).map((o) => o.to))];
    if (succ.length === 0) { ipdom.set(id, SINK); continue; }
    let d = succ[0];
    for (const s of succ.slice(1)) d = meet(d, s);
    ipdom.set(id, d);
  }
  return { order, index, next, back, ipdom };
}

/* -- Beim Gehen ----------------------------------------------------------------------------------------------------------------- */

interface Build {
  id: string;
  line: string;
  branch: string;
  from: string;
  to: string;
  kind: SectionKind;
  steps: string[];
  questions: string[];
  slides: number;
  introduces: string[];
  ticket: TicketPart[];
  start?: { step: string; exit?: string };
  callers?: string[];
}

interface Pending {
  steps: string[];
  questions: string[];
  slides: number;
  asks: string[];
  ticket: TicketPart[];
  start?: { step: string; exit?: string };
}

/** Ein offenes Ende des Weges: wo es steht, welche Abschnitte gerade Inhalt bekommen, was es schon gefragt hat. */
interface End {
  branch: string;
  stop: string;
  secs: Build[];
  pending: Pending;
  seen: Set<string>;
  /**
   * Step 3 · 5 — Tore nach Inhalt an diesem Halt (man ist schon auf einem Abschnitt): sie warten auf den nächsten Abschnitt, der
   * den Halt verlässt. Ein Tor vor allem Inhalt hier steht dagegen in `pending.ticket` (der nächste Abschnitt, der hier entsteht).
   */
  gate: TicketPart[];
  /** Nach einem Zusammentreffen: in welchem Zweig es weitergeht, sobald der nächste Halt erreicht ist. */
  converge: string | null;
}

const emptyPending = (): Pending => ({ steps: [], questions: [], slides: 0, asks: [], ticket: [] });
/** Die Tore, die noch warten (aus dem Ticket von „pending" und den wartenden). */
const gatesOf = (e: End): TicketPart[] => [...e.pending.ticket.filter((t) => t.source === 'gate'), ...e.gate];
/** Dasselbe Tor (derselbe Schritt, dieselbe Bedingung), von mehreren Enden mitgebracht, zählt einmal. */
const oneGateEach = (parts: readonly TicketPart[]): TicketPart[] => {
  const seen = new Set<string>();
  return parts.filter((p) => {
    if (p.source !== 'gate') return true;
    const k = `${p.step}|${JSON.stringify(p.condition)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
const mergePending = (list: readonly Pending[]): Pending => {
  if (list.length === 0) return emptyPending();
  const start = list.find((p) => p.start !== undefined)?.start;
  return {
    steps: [...new Set(list.flatMap((p) => p.steps))], questions: [...new Set(list.flatMap((p) => p.questions))], slides: Math.max(...list.map((p) => p.slides)), asks: [...new Set(list.flatMap((p) => p.asks))],
    ticket: list.flatMap((p) => p.ticket), ...(start === undefined ? {} : { start })
  };
};

interface Call {
  readonly caller: string;
  readonly branch: string;
  readonly station: string;
  readonly step: string;
  readonly target: string;
  readonly kind: 'detour' | 'handoff';
}

interface Walked {
  readonly flow: Flow;
  readonly sections: Build[];
  readonly branches: Map<string, { id: string; parent: string | null; fork: LineBranch['fork'] }>;
  readonly ends: End[];
  readonly calls: Call[];
  readonly forks: { place: string; step: string; branches: string[] }[];
  readonly meetings: string[];
  readonly trunkStops: string[];
  readonly issues: WmIssue[];
  readonly stepFlow: Map<string, string>;
}

/** Eine Linie gehen. */
function walkLine(flow: Flow, world: World, resolve: Resolve, placeOfShown: (id: string) => string | null): Walked {
  const issues: WmIssue[] = [];
  const g = expand(flow, resolve);
  const dag = dagOf(g);
  const stepFlow = new Map<string, string>();
  for (const n of g.nodes.values()) if (n.flow !== flow.id) stepFlow.set(n.id, n.flow);

  /* Der Przegląd: ab dem Schritt `review` (wenn er nicht der Anfang ist) und jeder Schritt „review". */
  const reviewBlock = new Set<string>();
  if (flow.review !== undefined && flow.review !== flow.start && dag.index.has(flow.review)) {
    const stack = [flow.review];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (reviewBlock.has(id)) continue;
      reviewBlock.add(id);
      for (const o of dag.next(id)) stack.push(o.to);
    }
  }
  for (const n of g.nodes.values()) if (n.type === 'review') reviewBlock.add(n.id);

  /* Was ein Schritt zeigt und fragt. */
  const cardsOfStep = (n: XNode): string[] => {
    if (n.type === 'question') {
      const card = str(n.config.card);
      if (card !== '' && world.cards.has(card)) return [card];
      const of = str(n.config.of);
      return [...(world.questionCards.get(of) ?? (world.cards.has(of) ? [of] : []))];
    }
    if (n.type === 'scene') return strings(n.config.asks).flatMap((q) => world.questionCards.get(q) ?? (world.cards.has(q) ? [q] : []));
    return [];
  };
  const showOf = (n: XNode): string | null => {
    for (const id of shownEntries(n)) { const p = placeOfShown(id); if (p !== null) return p; }
    return null;
  };
  const asksPlace = (n: XNode): string | null => {
    for (const k of cardsOfStep(n)) { const p = world.cardPlaces.get(k)?.[0]; if (p !== undefined) return p; }
    return null;
  };
  /* R2 — ein Ablauf, der keinen Ort zeigt, hält an den Orten seiner Fragen. */
  const showsPlaces = dag.order.some((id) => { const n = g.nodes.get(id)!; return !reviewBlock.has(id) && showOf(n) !== null; });
  const isSlide = (n: XNode) => n.type === 'show' || n.type === 'scene';

  /* (c) Ein Tor: ein „condition", dessen einer Ausgang die Linie verlässt (ins Leere, zurück, oder nur noch zum Ende). */
  const contentAhead = new Map<string, boolean>();
  for (let i = dag.order.length - 1; i >= 0; i -= 1) {
    const id = dag.order[i];
    const n = g.nodes.get(id)!;
    const own = !reviewBlock.has(id) && (showOf(n) !== null || cardsOfStep(n).length > 0 || n.type === 'detour' || n.type === 'handoff');
    contentAhead.set(id, own || dag.next(id).some((o) => contentAhead.get(o.to) === true));
  }
  const gateOf = (n: XNode): WmCondition | null => {
    if (n.type !== 'condition') return null;
    const leaves = (exit: string): boolean => {
      const e = (g.out.get(n.id) ?? []).find((o) => o.out === exit);
      if (e === undefined || !g.nodes.has(e.to)) return true;
      if (dag.back.has(`${n.id}${SEP}${exit}`)) return true;
      return contentAhead.get(e.to) !== true;
    };
    const yes = leaves('yes');
    const no = leaves('no');
    if (yes === no) return null;
    const c = readTicketCondition(n.config.condition);
    return yes ? { type: 'not', items: [c] } : c;
  };

  const sections: Build[] = [];
  const branches = new Map<string, { id: string; parent: string | null; fork: LineBranch['fork'] }>([[flow.id, { id: flow.id, parent: null, fork: null }]]);
  const calls: Call[] = [];
  const forks: { place: string; step: string; branches: string[] }[] = [];
  const meetings: string[] = [];
  const trunkStops: string[] = [];
  let counter = 0;
  const processed = new Set<string>();

  const newSection = (e: End, to: string, firstStep: string | null): Build => {
    /* Step 3 · 5 — die wartenden Tore fahren nur mit einem Abschnitt, der den Halt verlässt. */
    const leaves = to !== e.stop;
    const sec: Build = {
      id: `${flow.id}:${counter}`, line: flow.id, branch: e.branch, from: e.stop, to,
      kind: e.stop === START ? 'entry' : 'main',
      steps: [...e.pending.steps], questions: [...e.pending.questions], slides: e.pending.slides, introduces: [...e.pending.asks],
      ticket: oneGateEach([...e.pending.ticket, ...(leaves ? e.gate : [])]),
      ...(e.pending.start !== undefined ? { start: e.pending.start } : e.stop === START && flow.start !== null ? { start: { step: flow.start } } : firstStep !== null ? { start: { step: firstStep } } : {})
    };
    counter += 1;
    sections.push(sec);
    if (leaves) e.gate = [];
    return sec;
  };
  const addTo = (e: End, step: string, slide: boolean, asks: readonly string[]) => {
    const fresh = asks.filter((k) => !e.seen.has(k));
    for (const k of fresh) e.seen.add(k);
    if (e.secs.length === 0) {
      e.pending.steps.push(step);
      if (asks.length > 0) e.pending.questions.push(step);
      e.pending.slides += slide ? 1 : 0;
      for (const k of fresh) if (!e.pending.asks.includes(k)) e.pending.asks.push(k);
      return;
    }
    /* Step 3 · 5 — ein Tor gilt nicht für den Abschnitt, auf dem man schon ist (es wartet in `e.gate`). */
    for (const s of e.secs) {
      s.steps.push(step);
      if (asks.length > 0) s.questions.push(step);
      s.slides += slide ? 1 : 0;
      for (const k of fresh) if (!s.introduces.includes(k)) s.introduces.push(k);
    }
  };
  /** Was noch ohne Abschnitt ist, bekommt einen am Ort selbst (Inhalt ohne Weg). */
  const settle = (e: End) => {
    if (e.secs.length > 0 || (e.pending.steps.length === 0 && e.pending.asks.length === 0) || e.stop === START) return;
    e.secs = [newSection(e, e.stop, e.pending.steps[0] ?? null)];
    e.pending = emptyPending();
  };
  const markTrunk = (stop: string) => { if (trunkStops[trunkStops.length - 1] !== stop) trunkStops.push(stop); };

  /** Ein Schritt mit Inhalt, für alle offenen Enden. */
  const visit = (id: string, ends: End[]): End[] => {
    const n = g.nodes.get(id)!;
    if (reviewBlock.has(id)) return ends;
    /* Ein Schritt zählt je Zweig einmal (eine Gabel ohne Treffpunkt geht ihr Ende mehrmals entlang). */
    const freshBranches = new Set(ends.map((e) => e.branch).filter((b) => !processed.has(`${b}|${id}`)));
    for (const b of freshBranches) processed.add(`${b}|${id}`);
    const live = ends.filter((e) => freshBranches.has(e.branch));
    if (live.length === 0) return ends;
    const gate = gateOf(n);
    if (gate !== null) {
      /*
        Step 3 · 5 — vor allem Inhalt an diesem Halt (kein Abschnitt, nichts wartet): wie die Bedingung einer Möglichkeit, der nächste
        Abschnitt, der hier entsteht, nimmt es. Nach Inhalt hier ist man schon unterwegs: es wartet auf den nächsten, der abfährt.
      */
      const part: TicketPart = { source: 'gate', step: n.orig, condition: gate };
      for (const e of live) { if (e.secs.length === 0 && e.pending.steps.length === 0) e.pending.ticket.push(part); else e.gate.push(part); }
      return ends;
    }
    if (n.type === 'detour' || n.type === 'handoff') {
      const target = resolve(str(n.config.flow));
      if (target === undefined) {
        issues.push({ code: 'dangling', level: 'warning', ids: [flow.id, n.orig], data: { field: 'flow', to: str(n.config.flow) || '—' } });
        return ends;
      }
      for (const e of live) calls.push({ caller: flow.id, branch: e.branch, station: e.stop, step: n.orig, target: target.id, kind: n.type === 'detour' ? 'detour' : 'handoff' });
      return ends;
    }
    const asks = cardsOfStep(n);
    const shown = showOf(n);
    const stop = showsPlaces ? shown : shown ?? asksPlace(n);
    const slide = isSlide(n);
    if (stop === null && asks.length === 0 && !slide) return ends;
    const moving = stop !== null ? live.filter((e) => e.stop !== stop) : [];
    if (moving.length === 0) { for (const e of live) addTo(e, id, slide, asks); return ends; }
    /* Ein neuer Halt. Mehrere offene Enden mit demselben Halt werden zuerst eins; sonst bekommt jedes seinen letzten Abschnitt. */
    const target = stop!;
    const staying = live.filter((e) => e.stop === target);
    const created: Build[] = [];
    const seenAll: Set<string>[] = [];
    const groups = new Map<string, End[]>();
    for (const e of moving) { const k = `${e.branch}|${e.stop}`; const l = groups.get(k) ?? []; l.push(e); groups.set(k, l); }
    for (const list of groups.values()) {
      const e = list[0];
      if (list.length > 1) {
        e.pending = mergePending(list.map((x) => x.pending));
        e.seen = new Set([...e.seen].filter((k) => list.every((x) => x.seen.has(k))));
        e.gate = list.flatMap((x) => x.gate);
      }
      const fresh = asks.filter((k) => !e.seen.has(k));
      for (const k of fresh) e.seen.add(k);
      const sec = newSection(e, target, n.orig);
      sec.steps.push(id);
      if (asks.length > 0) sec.questions.push(id);
      sec.slides += slide ? 1 : 0;
      for (const k of fresh) if (!sec.introduces.includes(k)) sec.introduces.push(k);
      created.push(sec);
      seenAll.push(e.seen);
    }
    for (const e of staying) { addTo(e, id, slide, asks); settle(e); created.push(...e.secs); seenAll.push(e.seen); }
    const converge = live.find((e) => e.converge !== null)?.converge ?? null;
    const branch = converge ?? live[0].branch;
    const seen = new Set([...seenAll[0]].filter((k) => seenAll.every((s) => s.has(k))));
    if (live.length > 1) meetings.push(target);
    /* Was an diesem Halt noch wartet (die Enden, die hier standen, sind schon auf ihren Abschnitten), wartet weiter. */
    const merged: End = { branch, stop: target, secs: created, pending: emptyPending(), seen, gate: oneGateEach(staying.flatMap(gatesOf)), converge: null };
    if (branch === flow.id) markTrunk(target);
    return [...ends.filter((e) => !live.includes(e)), merged];
  };

  /** Die Ausgänge einer Gabel, die Zweige werden — je Ziel einer (in der Reihenfolge der Ausgänge). */
  const forkExits = (id: string): { exit: string; to: string; label: string }[] | null => {
    const n = g.nodes.get(id)!;
    const pick = n.type === 'choice' ? (o: string) => /^o\d+$/.test(o) : n.type === 'chapters' ? (o: string) => /^c\d+$/.test(o) : n.type === 'scene' ? (o: string) => o === 'next' || /^b\d+$/.test(o) : null;
    if (pick === null) return null;
    const seen = new Set<string>();
    const out: { exit: string; to: string; label: string }[] = [];
    for (const o of dag.next(id)) {
      if (!pick(o.out) || seen.has(o.to)) continue;
      seen.add(o.to);
      out.push({ exit: o.out, to: o.to, label: exitLabel(n, o.out) });
    }
    return out.length >= 2 ? out : null;
  };

  const walk = (from: string | null, until: string, ends0: End[]): End[] => {
    let ends = ends0;
    let at = from;
    let guard = 0;
    while (at !== null && at !== until && at !== SINK && guard < 20000) {
      guard += 1;
      ends = visit(at, ends);
      const fork = reviewBlock.has(at) ? null : forkExits(at);
      const join = dag.ipdom.get(at) ?? SINK;
      if (fork !== null) {
        const n = g.nodes.get(at)!;
        const parent = ends.find((e) => e.converge !== null)?.converge ?? ends[0]?.branch ?? flow.id;
        const station = ends[0]?.stop ?? START;
        const children: End[] = [];
        const made: string[] = [];
        for (const f of fork) {
          const id = `${flow.id}/${at}:${f.exit}`;
          made.push(id);
          branches.set(id, { id, parent, fork: { step: n.orig, exit: f.exit, label: f.label } });
          /* (b) — die Bedingung der Möglichkeit, mit der der Zweig beginnt. */
          const option = n.type === 'choice' ? (Array.isArray(n.config.options) ? n.config.options : [])[Number(f.exit.slice(1))] : undefined;
          const ticket: TicketPart[] = isObject(option) && option.condition !== undefined && option.condition !== null ? [{ source: 'option', step: n.orig, condition: readTicketCondition(option.condition) }] : [];
          /* Step 3 · 5 — ein Tor vor der Gabel kommt vor allem Inhalt des Zweiges: sein erster Abschnitt nimmt es (auch einer am Ort). */
          const spawned = ends.map((e): End => ({
            branch: id, stop: e.stop, secs: [], pending: { ...emptyPending(), ticket: [...ticket, ...gatesOf(e)], start: { step: n.orig, exit: f.exit } },
            seen: new Set(e.seen), gate: [], converge: null
          }));
          children.push(...walk(f.to, join, spawned));
        }
        forks.push({ place: station, step: n.orig, branches: made });
        ends = join === SINK ? children : joinAt(children, parent);
        at = join === SINK ? null : join;
        continue;
      }
      const succ = [...new Set(dag.next(at).map((o) => o.to))];
      if (succ.length >= 2) {
        /* Eine Gabel, die nicht der Lernende wählt (eine Antwort, eine Bedingung): alle Wege nacheinander im selben Zweig. */
        for (const s of succ) ends = walk(s, join, ends);
        at = join === SINK ? null : join;
        continue;
      }
      at = succ[0] ?? null;
    }
    return ends;
  };
  const joinAt = (children: End[], parent: string): End[] => {
    if (children.length === 0) return children;
    const stops = new Set(children.map((e) => e.stop));
    if (stops.size === 1) {
      for (const e of children) settle(e);
      const stop = children[0].stop;
      const seen = new Set([...children[0].seen].filter((k) => children.every((e) => e.seen.has(k))));
      if (stop !== START) meetings.push(stop);
      if (parent === flow.id && stop !== START) markTrunk(stop);
      return [{ branch: parent, stop, secs: children.flatMap((e) => e.secs), pending: mergePending(children.filter((e) => e.secs.length === 0).map((e) => e.pending)), seen, gate: children.flatMap((e) => e.gate), converge: null }];
    }
    for (const e of children) e.converge = parent;
    return children;
  };

  const ends = walk(g.start, SINK, [{ branch: flow.id, stop: START, secs: [], pending: emptyPending(), seen: new Set(), gate: [], converge: null }]);
  for (const e of ends) settle(e);

  /* Für Autoren: Inhalt, den kein Weg erreicht; ein Anfang, der nicht die erste Folie ist (Entscheidung, Korrektur 7). */
  const unreached = flow.graph.nodes.filter((n) => (n.type === 'show' || n.type === 'question' || n.type === 'scene') && !dag.index.has(n.id)).map((n) => n.id);
  if (unreached.length > 0) issues.push({ code: 'unreachableSteps', level: 'warning', ids: [flow.id, ...unreached.slice(0, 12)], data: { count: unreached.length } });
  const firstSlide = flow.graph.nodes.find((n) => n.type === 'show' || n.type === 'scene');
  const startNode = flow.graph.nodes.find((n) => n.id === flow.start);
  if (firstSlide !== undefined && startNode !== undefined && (startNode.type === 'show' || startNode.type === 'scene') && startNode.id !== firstSlide.id) {
    issues.push({ code: 'flowStartsLate', level: 'info', ids: [flow.id, startNode.id, firstSlide.id], data: { step: startNode.id, first: firstSlide.id } });
  }
  return { flow, sections, branches, ends, calls, forks, meetings, trunkStops, issues, stepFlow };
}

const exitLabel = (n: { type: string; config: Readonly<Record<string, unknown>> }, exit: string): string => {
  if (n.type === 'choice') { const o = (Array.isArray(n.config.options) ? n.config.options : [])[Number(exit.slice(1))]; return isObject(o) ? str(o.label) : str(o); }
  if (n.type === 'chapters') { const c = (Array.isArray(n.config.chapters) ? n.config.chapters : [])[Number(exit.slice(1))]; return isObject(c) ? str(c.title) : str(c); }
  if (n.type === 'scene') { const b = (Array.isArray(n.config.buttons) ? n.config.buttons : []).find((x) => isObject(x) && str(x.exit) === exit); return isObject(b) ? str(b.label) : ''; }
  return '';
};

/* -- Alle Linien ------------------------------------------------------------------------------------------------------------- */

export function linesOf(world: World, flows: readonly Flow[]): Lines {
  const issues: WmIssue[] = [];
  const byId = new Map(flows.map((f) => [f.id, f] as const));
  const byRef = new Map<string, Flow>();
  for (const f of flows) if (f.ref !== undefined) { byRef.set(f.ref, f); byRef.set(f.ref.replace(/^@/, ''), f); }
  const resolve: Resolve = (ref) => (ref === '' ? undefined : byId.get(ref) ?? byRef.get(ref) ?? byRef.get(ref.replace(/^@/, '')));

  /* R1 — der Ort eines gezeigten Eintrags. */
  const explainOf = new Map<string, string[]>();
  for (const c of world.cards.values()) for (const x of c.explain ?? []) { const l = explainOf.get(x) ?? []; l.push(c.key); explainOf.set(x, l); }
  const memo = new Map<string, string | null>();
  const placeOfShown = (id: string): string | null => {
    if (memo.has(id)) return memo.get(id)!;
    let out: string | null = null;
    if (world.places.has(id)) out = id;
    else {
      const e = world.entries.get(id);
      for (const r of e?.refs ?? []) if (r.prerequisite === undefined && r.part === undefined && world.places.has(r.to)) { out = r.to; break; }
      if (out === null) for (const k of explainOf.get(id) ?? []) { const p = world.cardPlaces.get(k)?.[0]; if (p !== undefined) { out = p; break; } }
    }
    memo.set(id, out);
    return out;
  };

  /* Welche Abläufe Linien sind: mit Einheit, und was sie als Abstecher oder Übergabe rufen (auch weiter). */
  const isLine = new Set<string>();
  const queue = flows.filter((f) => f.unit !== undefined).map((f) => f.id);
  for (const f of flows) if (f.unit !== undefined && !world.entries.has(f.unit)) issues.push({ code: 'unitMissing', level: 'warning', ids: [f.id, f.unit] });
  const walked = new Map<string, Walked>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (isLine.has(id)) continue;
    isLine.add(id);
    const w = walkLine(byId.get(id)!, world, resolve, placeOfShown);
    walked.set(id, w);
    for (const c of w.calls) if (!isLine.has(c.target)) queue.push(c.target);
  }

  /* Wer ruft wen (R4). */
  const calledBy = new Map<string, Map<string, number>>();
  for (const w of walked.values()) for (const c of w.calls) {
    if (c.target === c.caller) continue;
    const m = calledBy.get(c.target) ?? new Map<string, number>();
    m.set(c.caller, (m.get(c.caller) ?? 0) + 1);
    calledBy.set(c.target, m);
  }

  /* Nicht gezeichnet: ein Ablauf ohne erkennbaren Ort (§11). */
  const drawn = new Map<string, Walked>();
  for (const [id, w] of walked) {
    if (w.sections.length === 0) { issues.push({ code: 'flowNoPlaces', level: 'warning', ids: [id] }); continue; }
    drawn.set(id, w);
  }
  const lineByUnit = new Map<string, string>();
  for (const w of drawn.values()) if (w.flow.unit !== undefined && !lineByUnit.has(w.flow.unit)) lineByUnit.set(w.flow.unit, w.flow.id);
  const lastStop = (line: string): string | null => {
    const w = drawn.get(line);
    if (w === undefined) return null;
    const trunk = w.trunkStops;
    if (trunk.length > 0) return trunk[trunk.length - 1];
    const s = w.sections.filter((x) => x.to !== START);
    return s.length > 0 ? s[s.length - 1].to : null;
  };
  const depthOf = (p: string) => world.places.get(p)?.depth ?? -1;

  /** (a) — was die Einheit verlangt: Orte (ihre Karten im Band „znane"), Einheiten mit Linie („bestanden"); dazu der tiefste Ort. */
  const unitTicket = (unit: string | undefined, skipLine: string | null, firstStop: string | null = null): { parts: TicketPart[]; start: string | null } => {
    if (unit === undefined) return { parts: [], start: null };
    const parts: TicketPart[] = [];
    const candidates: string[] = [];
    const seen = new Set<string>([unit]);
    const stack = [...world.requires(unit)].reverse();
    while (stack.length > 0) {
      const r = stack.pop()!;
      if (seen.has(r)) continue;
      seen.add(r);
      if (!world.entries.has(r)) continue;
      const block = world.blocks.get(r);
      if (block !== undefined || world.places.has(r)) {
        parts.push({ source: 'unit', condition: { type: 'knowness', of: r, band: 'known' } });
        candidates.push(...(block !== undefined ? block.parts : [r]));
        continue;
      }
      const line = lineByUnit.get(r);
      if (line !== undefined) {
        if (line !== skipLine) parts.push({ source: 'unit', condition: { type: 'story', flow: line, unit: r } });
        const last = lastStop(line);
        if (last !== null) candidates.push(last);
        continue;
      }
      if (world.entries.get(r)?.kinds.includes('question') === true) continue;
      for (const x of [...world.requires(r)].reverse()) stack.push(x);
    }
    /* Verlangt die Einheit ihren ersten Halt selbst, beginnt die Linie dort (mitten in der Welt); sonst am tiefsten Verlangten. */
    const start = firstStop !== null && candidates.includes(firstStop) ? firstStop : candidates.slice().sort((a, b) => depthOf(b) - depthOf(a))[0] ?? null;
    return { parts, start };
  };

  const sections = new Map<string, Section>();
  const lines = new Map<string, Line>();
  const stepFlow = new Map<string, string>();
  const forkAt = new Map<string, { line: string; step: string; branches: string[] }[]>();
  const meetingPlaces = new Set<string>();
  const callerStations = new Set<string>();
  const midStarts = new Set<string>();

  /* Erst die Anfänge (R3) aller Linien, die keine Vertiefungen sind — die Abstecher davor brauchen sie. */
  const isDeepening = (id: string): boolean => { const c = calledBy.get(id); return c !== undefined && [...c.keys()].some((x) => x !== id && drawn.has(x)); };
  const starts = new Map<string, { start: string; parts: TicketPart[] }>();
  for (const [id, w] of drawn) {
    if (isDeepening(id)) continue;
    const t = unitTicket(w.flow.unit, null, w.trunkStops[0] ?? w.sections[0]?.to ?? null);
    starts.set(id, { start: t.start ?? HOME, parts: t.parts });
  }
  for (const [id, w] of drawn) {
    for (const [k, v] of w.stepFlow) stepFlow.set(k, v);
    const callers = calledBy.get(id);
    const deepening = isDeepening(id);
    const out: Section[] = [];
    const finalStops = [...new Set(w.ends.map((e) => e.stop).filter((s) => s !== START))];
    let start: string | null = null;
    const sectionBranch = new Map<string, string[]>();
    const keep = (s: Section) => { out.push(s); sections.set(s.id, s); const l = sectionBranch.get(s.branch) ?? []; l.push(s.id); sectionBranch.set(s.branch, l); };

    if (!deepening) {
      const t = starts.get(id)!;
      start = t.start;
      if (start !== HOME) midStarts.add(start);
      for (const b of w.sections) keep(b.from === START ? { ...b, from: t.start, ticket: [...t.parts, ...b.ticket] } : b);
    } else {
      /* R4 — je rufendem Ort eine Einfahrt (mit „Wymaga" ohne die eigene Erzählung des Rufers) und eine Rückfahrt. */
      const stations = new Map<string, Set<string>>();
      for (const cw of drawn.values()) for (const c of cw.calls) {
        if (c.target !== id || c.caller === id) continue;
        const st = c.station === START ? (starts.get(c.caller)?.start ?? drawn.get(c.caller)?.trunkStops[0] ?? null) : c.station;
        const place = st === null || st === START ? null : st;
        if (place === null) continue;
        const set = stations.get(place) ?? new Set<string>();
        set.add(c.caller);
        stations.set(place, set);
      }
      const stationList = [...stations.keys()].sort(byCode);
      for (const place of stationList) callerStations.add(place);
      const t = unitTicket(w.flow.unit, null);
      for (const b of w.sections) {
        if (b.from !== START) { keep(b); continue; }
        for (const place of stationList) {
          const by = [...stations.get(place)!].sort(byCode);
          const own = new Set(by);
          const parts = t.parts.filter((p) => !(p.condition.type === 'story' && own.has(String(p.condition.flow))));
          keep({ ...b, id: `${b.id}@${place}`, from: place, ticket: [...parts, ...b.ticket], callers: by });
        }
      }
      for (const place of stationList) for (const f of finalStops) {
        if (f === place) continue;
        keep({ id: `${id}:back@${f}${SEP}${place}`, line: id, branch: id, from: f, to: place, kind: 'return', steps: [], questions: [], slides: 0, introduces: [], ticket: [], callers: [...stations.get(place)!].sort(byCode) });
      }
    }
    /* Zweige, Gabeln, Treffpunkte. */
    const branchList: LineBranch[] = [...w.branches.values()].map((b) => ({ id: b.id, line: id, parent: b.parent, fork: b.fork, sections: sectionBranch.get(b.id) ?? [] }));
    for (const f of w.forks) {
      const place = f.place === START ? start : f.place;
      if (place === null || place === START) continue;
      const l = forkAt.get(place) ?? [];
      l.push({ line: id, step: f.step, branches: f.branches });
      forkAt.set(place, l);
    }
    for (const m of w.meetings) if (m !== START) meetingPlaces.add(m);
    lines.set(id, {
      id, name: w.flow.name, ...(w.flow.unit === undefined ? {} : { unit: w.flow.unit }),
      deepening, calledBy: callers ?? new Map(), stops: w.trunkStops, branches: branchList, sections: out.map((s) => s.id), start
    });
    for (const issue of w.issues) issues.push(issue);
    for (const s of out) for (const p of s.ticket) for (const type of unknownTypes(p.condition)) {
      issues.push({ code: 'unknownCondition', level: 'warning', ids: [id, p.step ?? s.id], data: { type: type || '?' } });
    }
  }

  /* -- Umsteigeorte -------------------------------------------------------------------------------------------------------- */
  const touching = new Map<string, Set<string>>();
  const outOf = new Map<string, string[]>();
  for (const s of sections.values()) {
    for (const p of [s.from, s.to]) { if (p === HOME) continue; const set = touching.get(p) ?? new Set<string>(); set.add(s.line); touching.set(p, set); }
    if (s.from !== s.to) { const l = outOf.get(s.from) ?? []; l.push(s.id); outOf.set(s.from, l); }
  }
  const stations = new Map<string, Station>();
  const stationPlaces = new Set<string>([...forkAt.keys(), ...meetingPlaces, ...callerStations, ...midStarts]);
  for (const [p, set] of touching) if (set.size >= 2) stationPlaces.add(p);
  for (const p of [...stationPlaces].sort(byCode)) {
    if (!world.places.has(p)) continue;
    stations.set(p, { place: p, lines: [...(touching.get(p) ?? [])].sort(byCode), out: outOf.get(p) ?? [], forks: forkAt.get(p) ?? [] });
  }
  const home = [...sections.values()].filter((s) => s.from === HOME);
  if (home.length > 0) stations.set(HOME, { place: HOME, lines: [...new Set(home.map((s) => s.line))].sort(byCode), out: home.map((s) => s.id), forks: forkAt.get(HOME) ?? [] });

  /* -- Für Autoren --------------------------------------------------------------------------------------------------------- */
  const introducedBy = new Map<string, string[]>();
  for (const s of sections.values()) for (const k of s.introduces) { const l = introducedBy.get(k) ?? []; l.push(s.id); introducedBy.set(k, l); }
  const touched = new Set<string>();
  for (const s of sections.values()) { touched.add(s.from); touched.add(s.to); }
  const lonely = world.order.filter((p) => !touched.has(p));
  if (lonely.length > 0) issues.push({ code: 'placesWithoutLine', level: 'info', ids: lonely.slice(0, 40), data: { count: lonely.length } });
  for (const p of world.order) {
    const without = (world.places.get(p)?.cards ?? []).filter((k) => !introducedBy.has(k)).length;
    if (without > 0 && touched.has(p)) issues.push({ code: 'cardsWithoutSlide', level: 'info', ids: [p], data: { count: without } });
  }
  for (const l of lines.values()) if (l.start !== null && l.start !== HOME) issues.push({ code: 'lineStartsMid', level: 'info', ids: [l.id, l.start] });

  /* Korrektur 7 — Mitglieder einer Einheit (Struktur „up" auf sie), die ihre Erzählung nicht als Abstecher ruft. */
  const unitOfLine = new Map([...lines.values()].filter((l) => l.unit !== undefined).map((l) => [l.id, l.unit!] as const));
  const lineUnits = new Set(unitOfLine.values());
  const detoured = new Map<string, Set<string>>();
  for (const w of drawn.values()) for (const c of w.calls) {
    const u = unitOfLine.get(c.target);
    if (u === undefined) continue;
    const set = detoured.get(w.flow.id) ?? new Set<string>();
    set.add(u);
    detoured.set(w.flow.id, set);
  }
  for (const l of lines.values()) {
    if (l.unit === undefined) continue;
    const members = [...world.entries.values()]
      .filter((e) => e.id !== l.unit && lineUnits.has(e.id) && e.refs.some((r) => r.structure === 'up' && r.to === l.unit))
      .map((e) => e.id);
    const missing = members.filter((m) => !(detoured.get(l.id)?.has(m) ?? false)).sort(byCode);
    if (members.length > 0 && missing.length > 0) issues.push({ code: 'membersNotDetoured', level: 'info', ids: [l.unit, ...missing], data: { count: missing.length } });
  }
  /* … und eine Vertiefung, die verlangt, was ihr Rufer verlangt, statt den Rufer selbst. */
  const flagged = new Set<string>();
  for (const w of drawn.values()) for (const c of w.calls) {
    const uc = w.flow.unit;
    const ut = unitOfLine.get(c.target);
    if (uc === undefined || ut === undefined || uc === ut || flagged.has(`${ut}>${uc}`)) continue;
    const rt = new Set(world.requires(ut));
    const rc = new Set(world.requires(uc));
    if (rt.size > 0 && !rt.has(uc) && [...rt].every((x) => rc.has(x))) {
      flagged.add(`${ut}>${uc}`);
      issues.push({ code: 'requiresSiblingPrerequisite', level: 'info', ids: [ut, uc] });
    }
  }

  /* Dieselbe Meldung nur einmal (ein Tor nach einem Treffpunkt steht an jedem ankommenden Abschnitt). */
  const once = new Map<string, WmIssue>();
  for (const i of issues) { const k = `${i.code}|${i.ids.join('|')}|${JSON.stringify(i.data ?? {})}`; if (!once.has(k)) once.set(k, i); }
  return { lines, sections, stations, introducedBy, issues: [...once.values()], stepFlow };
}

/** Wo der Spieler einen Schritt der Linie öffnet: ein eingebetteter (`<subflow>>…`) am Unterablauf-Schritt der Linie selbst. */
export const outerStep = (step: string): string => { const at = step.indexOf(SEP); return at < 0 ? step : step.slice(0, at); };

/** Der Ablauf eines Schrittes in einem Abschnitt (ein eingebetteter gehört dem gerufenen Ablauf) und seine eigene Kennung. */
export function stepOwner(lines: Lines, line: string, step: string): { flow: string; step: string } {
  const flow = lines.stepFlow.get(step) ?? line;
  const at = step.lastIndexOf(SEP);
  return { flow, step: at < 0 ? step : step.slice(at + 1) };
}

/** Nur für Prüfungen: der aufgeklappte Graph mit seiner Reihenfolge (`expand` + Rückkanten + Nachdominatoren). */
export function inspectFlow(flow: Flow, flows: readonly Flow[]): { order: readonly string[]; back: readonly string[]; ipdom: Readonly<Record<string, string>> } {
  const byId = new Map(flows.map((f) => [f.id, f] as const));
  const g = expand(flow, (r) => byId.get(r));
  const d = dagOf(g);
  return { order: d.order, back: [...d.back], ipdom: Object.fromEntries(d.ipdom) };
}

