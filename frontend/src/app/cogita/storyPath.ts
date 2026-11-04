/**
 * 2026-11-04 — DIE ŚCIEŻKA EINER ERZÄHLUNG AUS IHREN TEILEN (nicht aus den Einträgen): der Graph des Ablaufs selbst,
 * zusammengefasst zu Teilen, die der Lernende als Schritte erlebt:
 * <code>
 *   Anfang, Ende   eigene Zeichen; genau ein Anfang (der Startschritt), ein Ende (alle Schritte „Koniec"/„Powrót"/
 *                  „Przekazanie" und jeder Ausgang ohne Weg — dort endet der Ablauf)
 *   Lesen          aufeinanderfolgende Schritte, die nur zeigen (Pokaż, Postać mówi, Wyjaśnij, Otwarcie, Szene ohne Frage)
 *   Fragen         aufeinanderfolgende Fragen (eine Szene mit Fragen); zeigt ein Schritt beides: beides gezählt
 *   Przegląd       eine Schleife, die Fragen wiederholt, bis alles sitzt (ein Weg zurück), und der Schritt, den `review`
 *                  nennt; ein einzelnes Bild direkt davor („Przegląd") gehört dazu
 *   Gabel          eine Wahl (eine von n) oder Rozdziały (alle, in beliebiger Reihenfolge); eine Szene mit mehreren
 *                  Knöpfen ist eine Wahl auf der Szene. Logik (Warunek, Wartość) ist durchsichtig
 * </code>
 * Ein Teil endet, wo sich die Art ändert, der Weg sich gabelt oder zusammenkommt. Rein; die Karte zeichnet `PathMap`.
 */

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
  /** Eine Gabel: Wahl (`choose`) oder Kapitel (`all`) — der Schritt und seine Wege. */
  readonly fork?: { readonly mode: 'choose' | 'all'; readonly step: string; readonly branches: readonly StoryBranch[] };
  /** Nach Kapiteln: frei erst, wenn alle Wege davor durch sind. */
  readonly needsAll?: boolean;
}

export interface StoryPath {
  readonly parts: readonly StoryPart[];
  readonly model: PathModel;
  /** Je Schritt sein Teil (Logik-Schritte haben keinen). */
  readonly partOfStep: ReadonlyMap<string, number>;
}

const STOPS = new Set(['end', 'return', 'handoff']);
const FORKS = new Set(['choice', 'chapters']);
/** Ausgänge, die die Antwort wählt, nicht der Lernende. */
const ANSWER = new Set(['right', 'wrong']);

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Ein Ausgang, der fehlen darf: „dalej" einer Szene, die anders weitergeht (eine Frage auf ihr, ihre Knöpfe). */
export const optionalExit = (type: string, exit: string, others: number): boolean => type === 'scene' && exit === 'next' && others > 0;

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
      default:
        return { slides: 0, questions: 0, shown: [], asked: [] };
    }
  };
}

/** Wie ein Schritt heisst: sein Titel, sonst der Name dessen, was er zeigt, sonst seine Art. */
export function stepName(node: GraphNode, label: (id: string) => string): string {
  const title = str(node.config.title);
  if (title !== '') return title;
  const of = str(node.config.of);
  if (of !== '') { const l = label(of); if (l !== '' && l !== of) return l; }
  const own = label(node.id);
  if (own !== '' && own !== node.id) return own;
  return STEP_LABEL[node.type as keyof typeof STEP_LABEL] ?? node.type;
}

export function storyPath(flow: Flow, work: WorkOfStep, label: (id: string) => string): StoryPath {
  const nodes = new Map(flow.graph.nodes.map((n) => [n.id, n] as const));
  const empty: StoryPath = { parts: [], model: pathModel([], []), partOfStep: new Map() };
  if (flow.start === null || !nodes.has(flow.start)) return empty;

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
  const forward = (id: string): { exit: string; to: string | null }[] => {
    const n = nodes.get(id);
    if (n === undefined || STOPS.has(n.type) || n.type === 'restart') return [];
    if (n.type === 'chapterEnd') { const hub = hubOf.get(id); return [{ exit: 'next', to: hub === undefined ? follow(flow, id, 'next') : follow(flow, hub, 'done') }]; }
    /* Die Wege, wie sie im Graphen stehen, und jeder erklärte Ausgang ohne Weg (dort endet der Ablauf). */
    const skip = (out: string) => n.type === 'chapters' && out === 'done' && viaEnds.has(id);
    const list: { exit: string; to: string | null }[] = flow.graph.edges.filter((e) => e.from === id && !skip(e.out)).map((e) => ({ exit: e.out, to: nodes.has(e.to) ? e.to : null }));
    for (const p of exitsOf(n.type, n.config)) if (!skip(p.id) && !list.some((x) => x.exit === p.id) && !optionalExit(n.type, p.id, list.length)) list.push({ exit: p.id, to: null });
    return list;
  };

  /* Tiefensuche: was zurückführt (eine Schleife), ist kein Schritt nach vorn; die Reihenfolge des Lesens. */
  const back = new Set<string>();
  const order: string[] = [];
  {
    const state = new Map<string, 1 | 2>();
    const kidsOf = (id: string) => forward(id).map((x) => x.to).filter((x): x is string => x !== null).reverse();
    const stack: { id: string; kids: string[]; i: number }[] = [{ id: flow.start, kids: kidsOf(flow.start), i: 0 }];
    state.set(flow.start, 1);
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
  }
  const reach = new Set(order);
  const ahead = (id: string) => forward(id).filter((x) => x.to === null || !back.has(`${id}>${x.to}`));
  const preds = new Map<string, string[]>();
  for (const id of order) for (const { to } of ahead(id)) if (to !== null) preds.set(to, [...new Set([...(preds.get(to) ?? []), id])]);
  const works = new Map(order.map((id) => [id, work(nodes.get(id)!)] as const));
  const isContent = (id: string) => { const w = works.get(id)!; return w.slides + w.questions > 0; };
  const kindOf = (id: string): PartKind => { const w = works.get(id)!; return w.questions === 0 ? 'read' : w.slides === 0 ? 'learn' : 'mixed'; };

  /* Der Przegląd: Schleifen mit Fragen (alles darin), der Schritt aus `review`, ein einzelnes Bild direkt davor. */
  const review = new Set<string>();
  const reachFrom = (from: string, avoidBack = true): Set<string> => {
    const out = new Set<string>();
    const stack = [from];
    while (stack.length > 0) { const id = stack.pop()!; if (out.has(id)) continue; out.add(id); for (const { to } of (avoidBack ? ahead(id) : forward(id))) if (to !== null && reach.has(to)) stack.push(to); }
    return out;
  };
  const heads = new Set<string>();
  for (const key of back) {
    const [u, v] = key.split('>');
    const fromV = reachFrom(v);
    const body = order.filter((w) => fromV.has(w) && reachFrom(w).has(u));
    /* Ein Przegląd wiederholt mehrere Fragen (eine einzelne Frage, die nach „źle" wiederkommt, ist keiner). */
    if (body.reduce((s, w) => s + (works.get(w)?.questions ?? 0), 0) >= 2) { for (const w of body) review.add(w); heads.add(v); }
  }
  if (flow.review !== undefined && reach.has(flow.review) && !review.has(flow.review)) {
    /* Vom Schritt aus `review` die Kette bis in die Schleife (oder, ohne Schleife, die Fragen, die folgen). */
    let at: string | null = flow.review;
    for (let guard = 0; at !== null && guard < 200 && !review.has(at); guard += 1) {
      const type = nodes.get(at)?.type ?? '';
      if (STOPS.has(type) || FORKS.has(type)) break;
      review.add(at);
      const next: string[] = ahead(at).map((x) => x.to).filter((x): x is string => x !== null);
      at = next.length === 1 && (heads.size > 0 || !isContent(next[0]) || kindOf(next[0]) !== 'read') ? next[0] : null;
    }
  }
  for (const h of heads) {
    const p = preds.get(h) ?? [];
    if (p.length === 1 && !review.has(p[0]) && isContent(p[0]) && kindOf(p[0]) === 'read' && ahead(p[0]).every((x) => x.to === h) && p[0] !== flow.start) review.add(p[0]);
  }

  /* Die Teile. */
  type Draft = { kind: PartKind; label: string; steps: string[]; slides: number; questions: number; shown: string[]; asked: string[]; qsteps?: string[]; fork?: { mode: 'choose' | 'all'; step: string; exits: { exit: string; label: string; to: string | null }[] }; needsAll?: boolean };
  const parts: Draft[] = [{ kind: 'start', label: 'Początek', steps: [], slides: 0, questions: 0, shown: [], asked: [] }];
  const needs: Set<number>[] = [new Set()];
  const partOf = new Map<string, number>();
  /** Was nach einem Schritt kommt, wenn er eine Wahl auf der Szene ist (die Gabel hinter seinem Teil). */
  const forkAfter = new Map<string, number>();
  const into = new Map<string, Set<number>>();
  let END = -1;
  let REVIEW = -1;
  const add = (d: Draft) => { parts.push(d); needs.push(new Set()); return parts.length - 1; };
  const endPart = () => { if (END < 0) END = add({ kind: 'end', label: 'Koniec', steps: [], slides: 0, questions: 0, shown: [], asked: [] }); return END; };
  const outOf = (p: string): Set<number> => (forkAfter.has(p) ? new Set([forkAfter.get(p)!]) : partOf.has(p) ? new Set([partOf.get(p)!]) : into.get(p) ?? new Set());
  const intoOf = (t: string): Set<number> => {
    const out = new Set<number>(t === flow.start ? [0] : []);
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
      const n = nodes.get(id)!;
      if (isContent(id) || review.has(id) || FORKS.has(n.type) || STOPS.has(n.type)) { out.add(id); continue; }
      for (const x of ahead(id)) stack.push(x.to);
    }
    return out;
  };
  const accumulate = (d: Draft, id: string) => {
    const w = works.get(id)!;
    d.steps.push(id);
    d.slides += w.slides;
    d.questions += w.questions;
    if (w.questions > 0) (d.qsteps ??= []).push(id);
    for (const e of w.shown) if (!d.shown.includes(e)) d.shown.push(e);
    for (const e of w.asked) if (!d.asked.includes(e)) d.asked.push(e);
  };

  for (const t of order) {
    const n = nodes.get(t)!;
    const ins = intoOf(t);
    if (review.has(t)) {
      if (REVIEW < 0) REVIEW = add({ kind: 'review', label: 'Przegląd', steps: [], slides: 0, questions: 0, shown: [], asked: [] });
      accumulate(parts[REVIEW], t);
      partOf.set(t, REVIEW);
      link(REVIEW, ins);
      continue;
    }
    if (STOPS.has(n.type)) { const e = endPart(); partOf.set(t, e); link(e, ins); continue; }
    if (FORKS.has(n.type)) {
      const chapters = n.type === 'chapters';
      const exits = forward(t).map((x) => ({ ...x, label: exitsOf(n.type, n.config).find((p) => p.id === x.exit)?.label ?? x.exit }));
      const f = add({ kind: 'fork', label: str(n.config.title) || (chapters ? 'Rozdziały' : 'Wybór'), steps: [t], slides: 0, questions: 0, shown: [], asked: [], fork: { mode: chapters ? 'all' : 'choose', step: t, exits } });
      partOf.set(t, f);
      link(f, ins);
      continue;
    }
    if (!isContent(t)) { into.set(t, ins); continue; }
    const k = kindOf(t);
    const [only] = ins;
    const P = ins.size === 1 ? parts[only] : undefined;
    const last = P?.steps[P.steps.length - 1];
    if (P !== undefined && only !== 0 && P.kind === k && last !== undefined && !forkAfter.has(last)) {
      const next = nextContent(last);
      if (next.size === 1 && next.has(t)) { accumulate(P, t); partOf.set(t, only); }
    }
    if (!partOf.has(t)) {
      const d: Draft = { kind: k, label: stepName(n, label), steps: [], slides: 0, questions: 0, shown: [], asked: [] };
      if (k === 'learn' && P !== undefined && P.kind === 'read') d.label = `Pytania — ${P.label}`;
      accumulate(d, t);
      const i = add(d);
      partOf.set(t, i);
      link(i, ins);
    }
    /* Eine Szene mit mehreren Knöpfen (Wegen, die nicht die Antwort wählt): eine Wahl auf der Szene. */
    const choices = ahead(t).filter((x) => !ANSWER.has(x.exit));
    if (new Set(choices.map((x) => x.to)).size >= 2) {
      const exits = choices.map((x) => ({ ...x, label: exitsOf(n.type, n.config).find((p) => p.id === x.exit)?.label ?? x.exit }));
      const f = add({ kind: 'fork', label: `Wybór: ${stepName(n, label)}`, steps: [], slides: 0, questions: 0, shown: [], asked: [], fork: { mode: 'choose', step: t, exits } });
      link(f, [partOf.get(t)!]);
      forkAfter.set(t, f);
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
  /* Die Gabeln: je Ausgang der erste Teil dahinter. */
  const firstPartAt = (to: string | null): number => {
    if (to === null) return endPart();
    const own = partOf.get(to);
    if (own !== undefined) return own;
    for (const x of nextContent(to)) { const p = x === null ? endPart() : partOf.get(x); if (p !== undefined) return p; }
    return endPart();
  };
  const finished: StoryPart[] = parts.map((d) => ({
    kind: d.kind, label: d.label, steps: d.steps, first: d.steps[0] ?? (d.kind === 'start' ? flow.start : null), slides: d.slides, questions: d.questions, shown: d.shown, asked: d.asked, questionSteps: d.qsteps ?? [],
    ...(d.fork === undefined ? {} : { fork: { mode: d.fork.mode, step: d.fork.step, branches: d.fork.exits.map((x) => ({ exit: x.exit, label: x.label, to: firstPartAt(x.to) })) } }),
    ...(d.needsAll === true ? { needsAll: true } : {})
  }));
  const items = finished.map((p, i) => ({ id: `p${i}`, label: p.label }));
  const model = pathModel(items, needs.map((s) => [...s]), { source: 'story', reduced: true, info: finished.map((p) => ({ kind: p.kind, slides: p.slides, questions: p.questions })) });
  return { parts: finished, model, partOfStep: partOf };
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

/** Was eine Spur einer Gabel an Arbeit bringt (für die Wahl: „3 slajdy do przeczytania · 5 pytań"). */
export function branchWork(sp: StoryPath, branch: StoryBranch, knownStep?: (step: string) => boolean): { readonly slides: number; readonly questions: number; readonly parts: number; readonly ask: number } {
  const list = branchParts(sp, branch.to);
  const ask = list.reduce((s, v) => s + sp.parts[v].questionSteps.filter((x) => knownStep?.(x) !== true).length, 0);
  return { slides: list.reduce((s, v) => s + sp.parts[v].slides, 0), questions: list.reduce((s, v) => s + sp.parts[v].questions, 0), parts: list.length, ask };
}

/** 2026-11-04 (Prompt 10) — je Teil: wie viele seiner Fragen wirklich gefragt würden (die gekonnten nicht). */
export const askCounts = (sp: StoryPath, knownStep?: (step: string) => boolean): number[] =>
  sp.parts.map((p) => p.questionSteps.filter((x) => knownStep?.(x) !== true).length);

/**
 * DER STAND DER TEILE: Lesen ist durch, wenn alle seine Schritte besucht sind; Fragen, wenn sie gestellt und alles Gefragte
 * gelernt ist (ab 10 %; ohne Lernenden: gestellt); der Przegląd, wenn alles darin sitzt (100 %); eine Wahl, sobald ein Weg gewählt
 * ist; Kapitel, wenn alle durch sind; das Ende, wenn die Erzählung zu Ende ist. Frei ist, was hinter einem Durchgangenen
 * liegt (nach Kapiteln: hinter allen); „jetzt dran" ist der Teil des Schrittes, an dem der Lernende steht.
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
  const branchDone = (b: StoryBranch) => { const list = branchParts(sp, b.to); return list.length > 0 && list.every((v) => done[v]); };
  for (let i = 0; i < n; i += 1) {
    const f = parts[i].fork;
    if (f === undefined) continue;
    if (f.mode === 'choose') {
      const taken = new Set(f.branches.filter((b) => seen(b.to) || done[b.to]).map((b) => b.to)).size;
      /* 2026-11-04 (Prompt 9) — auch eine Wahl sagt, welche ihrer Wege schon zu Ende gegangen sind. */
      const finished = new Set(f.branches.filter((b) => branchDone(b)).map((b) => b.to)).size;
      forks.set(i, { mode: 'choose', done: taken, total: f.branches.length, ...(finished > 0 ? { finished } : {}) });
      done[i] = taken > 0;
    } else {
      const told = new Set(pr.chapters?.[f.step] ?? []);
      const count = f.branches.filter((b) => told.has(Number(b.exit.slice(1))) || branchDone(b)).length;
      forks.set(i, { mode: 'all', done: count, total: f.branches.length });
      done[i] = f.branches.length > 0 && count === f.branches.length;
    }
  }
  const state: PathState[] = parts.map((p, i) => {
    if (done[i]) return 'done';
    const before = model.nodes[i].needs;
    const open = before.length === 0 || (p.needsAll === true ? before.every((v) => done[v]) : before.some((v) => done[v]));
    return open ? 'available' : 'locked';
  });
  const due = parts.map((p, i) => know !== undefined && done[i] && p.kind !== 'review' && p.asked.some((e) => { const k = know(e); return k.learned && k.due; }));
  let current = -1;
  if (pr.ended === true && parts.some((p) => p.kind === 'end')) current = parts.findIndex((p) => p.kind === 'end');
  else if (pr.step !== undefined && pr.step !== null) {
    current = sp.partOfStep.get(pr.step) ?? -1;
    for (let k = pr.visited.length - 1; current < 0 && k >= 0; k -= 1) current = sp.partOfStep.get(pr.visited[k]) ?? -1;
  }
  if (current < 0) {
    for (let v = 0; v < n; v += 1) {
      if (state[v] !== 'available' || !countsAsStep(model.nodes[v])) continue;
      if (current < 0 || model.nodes[v].level < model.nodes[current].level) current = v;
    }
  }
  const taken = model.edges.map(([p, c]) => parts[p].fork?.mode === 'choose' && (seen(c) || done[c]));
  return {
    ask: askCounts(sp, pr.knownStep), state, due, current, lit: model.edges.map(([p]) => done[p]), taken, forks,
    done: state.filter((s, v) => s === 'done' && countsAsStep(model.nodes[v])).length, total: model.nodes.filter(countsAsStep).length
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
