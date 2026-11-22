/**
 * 2026-11-20 — ADAPTIVE ABLÄUFE: die Antwort entscheidet, was als Nächstes kommt.
 *
 * <b>Ausgänge eines Schrittes „question"</b> (jeder fällt auf den alten zurück, wenn er keinen Weg hat — ein Ablauf ohne sie
 * verhält sich wie bisher):
 * <code>
 *   right          richtig (Anteil ≥ "rightAt", Vorgabe 1; Podpowiedzi sind schon abgezogen)
 *   rightOnRetry   richtig im zweiten (oder späteren) Versuch nach "retry"                    → sonst "right"
 *   partial        teilweise (Anteil ≥ "partialAt")                                            → sonst wie falsch
 *   pick:<i>       die Möglichkeit i (one: die gewählte; Zählung wie „options", ab 0)          → sonst wie die Antwort
 *   wrong:<tag>    falsch mit diesem Fehler-Tag der Frage ("tags", je Möglichkeit/Paar/Lücke/Stelle) → sonst "wrong"
 *   wrong          falsch
 * </code>
 * <b>Kurzformen</b> an einem Schritt „question" (der Spieler liest sie als ausdrückliche Schritte — `expandAdaptive`; gespeichert
 * und exportiert bleibt die Kurzform):
 * <code>
 *   "rightAt": 1, "partialAt": 0.5
 *   "retry": { "after": ["@folie"], "max": 1 }       falsch: die Folien, dann dieselbe Frage noch einmal (höchstens "max" Mal)
 *   "onWrong": { "show": ["@einfacher"], "byTag": { "<tag>": ["@folie"] }, "check": "@leichtereFrage", "then": "continue" | "retry" }
 *   "onRight": { "skip": ["@grundlagen"] }           richtig: diese Folien (Schritte oder Einträge) werden übersprungen
 * </code>
 * Hilfsschritte heissen `<frage>~w0`, `~wc`, `~t0_0`, `~r0` und tragen `"remedial": true` — sie zählen nie im Fortschritt
 * (Ścieżka, Karte, „was hinter einer Wahl wartet"), nur als „N Schritte zur Nachhilfe". Ein Autor darf jeden Schritt so
 * markieren (`"remedial": true`), und was nur über `wrong:<tag>`, `partial` oder `rightOnRetry` erreichbar ist, gilt auch so.
 * Rein (ohne React); geprüft in `scripts/app-adaptive-check.mjs`.
 */

import type { Card } from './cardBasics';
import type { Graph, GraphEdge, GraphNode } from './graph';
import { choicesOf, rawList } from './questionTypes';
import { readingTags } from './reading/readingSpec';
import { t as tr } from '../core/i18n';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const refs = (v: unknown): string[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]).map((x) => (isObject(x) ? str(x.value) : str(x))).filter((x) => x !== '').slice(0, 12);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const share = (v: unknown, fallback: number | null): number | null => { const n = num(v); return n === null ? fallback : Math.max(0, Math.min(1, n > 1 ? n / 100 : n)); };

/** Die Ausgänge, die die Antwort wählt. */
export const isAnswerExit = (exit: string): boolean =>
  exit === 'right' || exit === 'wrong' || exit === 'partial' || exit === 'rightOnRetry' || exit === 'retry' || exit.startsWith('wrong:') || exit.startsWith('pick:') || exit.startsWith('retry:');
/** Ausgänge, die nur die Nachhilfe nimmt (nie der Hauptweg). */
export const isRemedialExit = (exit: string): boolean => exit === 'partial' || exit === 'rightOnRetry' || exit === 'retry' || exit.startsWith('wrong:') || exit.startsWith('retry:');

export interface Remediation {
  readonly show: readonly string[];
  readonly byTag: Readonly<Record<string, readonly string[]>>;
  readonly check: string | null;
  readonly then: 'continue' | 'retry';
  readonly max: number | null;
}

export interface AdaptiveConfig {
  /** Ab diesem Anteil „richtig" (0–1). */
  readonly rightAt: number;
  /** Ab diesem Anteil „teilweise" — `null`: kein Ausgang „partial". */
  readonly partialAt: number | null;
  readonly retry: { readonly after: readonly string[]; readonly max: number } | null;
  readonly onWrong: Remediation | null;
  readonly onRight: { readonly skip: readonly string[] } | null;
  /** Fehler-Tags, nach denen der Schritt verzweigt (Ausgänge `wrong:<tag>` im Editor). */
  readonly tags: readonly string[];
  /** Wie viele Ausgänge `pick:<i>` der Editor zeigt. */
  readonly picks: number;
}

/** Die gelesenen adaptiven Einstellungen eines Schrittes „question" (duldsam). */
export function adaptiveOf(config: Readonly<Record<string, unknown>>): AdaptiveConfig {
  const r = isObject(config.retry) ? config.retry : config.retry === true ? {} : null;
  const w = isObject(config.onWrong) ? config.onWrong : null;
  const byTag: Record<string, readonly string[]> = {};
  if (w !== null && isObject(w.byTag)) for (const [k, v] of Object.entries(w.byTag)) { const list = refs(v); if (k.trim() !== '' && list.length > 0) byTag[k.trim()] = list; }
  const onRight = isObject(config.onRight) ? refs(config.onRight.skip) : [];
  return {
    rightAt: share(config.rightAt, 1)! - 1e-3,
    partialAt: share(config.partialAt, null),
    retry: r === null ? null : { after: refs(r.after), max: Math.max(1, Math.min(5, Math.round(num(r.max) ?? 1))) },
    onWrong: w === null ? null : {
      show: refs(w.show), byTag, check: str(w.check) || null, then: w.then === 'retry' ? 'retry' : 'continue',
      max: num(w.max) === null ? null : Math.max(1, Math.min(5, Math.round(num(w.max)!)))
    },
    onRight: onRight.length === 0 ? null : { skip: onRight },
    tags: (Array.isArray(config.tags) ? config.tags : []).map(str).filter((x) => x !== '').slice(0, 24),
    picks: Math.max(0, Math.min(12, Math.round(num(config.picks) ?? 0)))
  };
}

/** Hat der Schritt etwas Adaptives (sonst bleibt alles, wie es war)? */
export const isAdaptive = (a: AdaptiveConfig): boolean =>
  a.retry !== null || a.onWrong !== null || a.onRight !== null || a.partialAt !== null || a.tags.length > 0 || a.picks > 0 || a.rightAt < 0.998;

/* -- Erklärte Ausgänge -------------------------------------------------------------------------------------------- */

/**
 * Die Ausgänge eines Schrittes „question", die er erklärt (für Editor und Prüfung): `wrong:<tag>` und `pick:<i>` aus den
 * Wegen, die es schon gibt (ein Import mit `wrong:zu-wörtlich`), werden in "tags"/"picks" eingetragen; ein Weg „partial"
 * ohne "partialAt" bekommt 0.5.
 */
export function declareExits(graph: Graph): Graph {
  let changed = false;
  const nodes = graph.nodes.map((n) => {
    if (n.type !== 'question') return n;
    const outs = graph.edges.filter((e) => e.from === n.id).map((e) => e.out);
    const tags = new Set(Array.isArray(n.config.tags) ? n.config.tags.map(str).filter((x) => x !== '') : []);
    let picks = num(n.config.picks) ?? 0;
    const before = tags.size;
    for (const o of outs) {
      if (o.startsWith('wrong:') && o.length > 6) tags.add(o.slice(6));
      const p = /^pick:(\d+)$/.exec(o);
      if (p !== null) picks = Math.max(picks, Number(p[1]) + 1);
    }
    const partial = outs.includes('partial') && num(n.config.partialAt) === null;
    if (tags.size === before && picks === (num(n.config.picks) ?? 0) && !partial) return n;
    changed = true;
    return { ...n, config: { ...n.config, ...(tags.size > 0 ? { tags: [...tags] } : {}), ...(picks > 0 ? { picks } : {}), ...(partial ? { partialAt: 0.5 } : {}) } };
  });
  return changed ? { nodes, edges: graph.edges } : graph;
}

/* -- Kurzformen aufklappen ---------------------------------------------------------------------------------------- */

/** Was ein aufgeklappter Schritt „question" über seinen zweiten Versuch weiss. */
export interface RetryPlan {
  /** Wohin es nach einer falschen Antwort geht, solange Versuche übrig sind (ohne Folien: die Frage selbst). */
  readonly to: string;
  readonly byTag: Readonly<Record<string, string>>;
  readonly max: number;
}

export const retryPlanOf = (node: Pick<GraphNode, 'id' | 'config'>): RetryPlan | null => {
  const c = node.config._retry;
  if (isObject(c) && typeof c.to === 'string') return { to: c.to, byTag: isObject(c.byTag) ? (c.byTag as Record<string, string>) : {}, max: num(c.max) ?? 1 };
  const a = adaptiveOf(node.config);
  return a.retry === null ? null : { to: node.id, byTag: {}, max: a.retry.max };
};

export const isRemedialNode = (node: Pick<GraphNode, 'config'>): boolean => node.config.remedial === true;

/**
 * DIE KURZFORMEN ALS SCHRITTE: "retry.after", "onWrong" (show, byTag, check, then) werden Hilfsschritte mit `"remedial": true`;
 * die Frage bekommt `_retry` (wohin ein falscher Versuch geht). Ausdrückliche Wege des Autors bleiben vor den erzeugten.
 */
export function expandAdaptive(graph: Graph): Graph {
  const questions = graph.nodes.filter((n) => n.type === 'question' && (isObject(n.config.retry) || n.config.retry === true || isObject(n.config.onWrong)));
  if (questions.length === 0) return graph;
  const ids = new Set(graph.nodes.map((n) => n.id));
  const nodes: GraphNode[] = [...graph.nodes];
  let edges: GraphEdge[] = [...graph.edges];
  let k = 0;
  const edge = (from: string, out: string, to: string) => { edges.push({ id: `${from}~e${k++}`, from, out, to, in: 'in' }); };
  const put = (id: string, type: string, config: Record<string, unknown>, near: GraphNode): string => {
    let unique = id;
    for (let i = 1; ids.has(unique); i += 1) unique = `${id}_${i}`;
    ids.add(unique);
    nodes.push({ id: unique, type, x: near.x + 40, y: near.y + 120, config });
    return unique;
  };
  /** Folien hintereinander, die letzte führt nach `end`; zurück: die erste (keine Folien: `end`). */
  const chain = (q: GraphNode, prefix: string, list: readonly string[], end: string): string => {
    let next = end;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const id = put(`${q.id}~${prefix}${i}`, 'show', { of: list[i], remedial: true, for: q.id }, q);
      edge(id, 'next', next);
      next = id;
    }
    return next;
  };
  const follow = (from: string, out: string): string | null => edges.find((e) => e.from === from && e.out === out)?.to ?? null;
  for (const q of questions) {
    const a = adaptiveOf(q.config);
    const rightTo = follow(q.id, 'right');
    const wrongTo = follow(q.id, 'wrong');
    const own: Record<string, unknown> = { ...q.config };
    let retry: RetryPlan | null = null;
    if (a.retry !== null) retry = { to: chain(q, 'r', a.retry.after, q.id), byTag: {}, max: a.retry.max };
    const w = a.onWrong;
    if (w !== null) {
      const goesBack = w.then === 'retry';
      const after = goesBack ? q.id : (wrongTo ?? rightTo);
      let tail = after;
      if (w.check !== null && after !== null) {
        const check = put(`${q.id}~wc`, 'question', { of: w.check, remedial: true, for: q.id }, q);
        edge(check, 'right', after);
        edge(check, 'wrong', after);
        tail = check;
      }
      if (tail !== null) {
        const generic = chain(q, 'w', w.show, tail);
        const byTag: Record<string, string> = {};
        Object.entries(w.byTag).forEach(([tag, list], i) => { byTag[tag] = chain(q, `t${i}_`, list, tail!); });
        if (goesBack) {
          retry = { to: retry !== null && w.show.length === 0 && w.check === null ? retry.to : generic, byTag, max: w.max ?? a.retry?.max ?? 1 };
          /* Nach dem letzten Versuch geht es über „wrong" weiter — ohne Weg dorthin, wohin „right" führt. */
          if (wrongTo === null && rightTo !== null) edge(q.id, 'wrong', rightTo);
        } else {
          edges = edges.filter((e) => !(e.from === q.id && e.out === 'wrong'));
          if (generic !== q.id) edge(q.id, 'wrong', generic);
          for (const [tag, to] of Object.entries(byTag)) if (follow(q.id, `wrong:${tag}`) === null) edge(q.id, `wrong:${tag}`, to);
        }
      }
    } else if (retry !== null && wrongTo === null && rightTo !== null) {
      edge(q.id, 'wrong', rightTo);
    }
    if (retry !== null) {
      own._retry = retry;
      /* Der Weg in die Folien vor dem nächsten Versuch steht auch im Graphen ("retry", "retry:<tag>") — Prüfung, Ścieżka und Karte sehen ihn. */
      if (retry.to !== q.id) edge(q.id, 'retry', retry.to);
      for (const [tag, to] of Object.entries(retry.byTag)) if (to !== q.id) edge(q.id, `retry:${tag}`, to);
    }
    const at = nodes.findIndex((n) => n.id === q.id);
    nodes[at] = { ...q, config: own };
  }
  return { nodes, edges };
}

/* -- Was eine Antwort sagt ---------------------------------------------------------------------------------------- */

export interface AnswerSignals {
  /** Fehler-Tags der falschen Teile (je Teil einer, in der Folge der Teile, ohne doppelte). */
  readonly tags: readonly string[];
  /** Die gewählten Möglichkeiten (one, many) in der Zählung von „options" (ohne leere). */
  readonly picks: readonly number[];
}

const tagList = (d: Readonly<Record<string, unknown>>): string[] => rawList(d.tags).map((x) => x.trim());

/**
 * WELCHE FEHLER-TAGS EINE ANTWORT TRÄGT — je Möglichkeit (one, many: gewählt falsch oder richtig vergessen), je Paar (match),
 * je Lücke (gap), je Stelle (order, build); dazu, welche Möglichkeiten gewählt wurden (für `pick:<i>`).
 */
export function answerSignals(card: Pick<Card, 'answer'>, data: Readonly<Record<string, unknown>> | null, given: unknown, outcome: { readonly correctness: number; readonly marks?: readonly boolean[] }): AnswerSignals {
  const d = data ?? {};
  const a = card.answer;
  const out = new Set<string>();
  const picks: number[] = [];
  const tag = (list: readonly string[], i: number) => { const x = list[i]; if (x !== undefined && x !== '') out.add(x); };
  if (a.form === 'one' || a.form === 'many') {
    const { options, tags } = choicesOf(d);
    const indexOf = (shown: number) => options.indexOf(a.options[shown] ?? '\u0000');
    const chosen = (a.form === 'one' ? [given] : Array.isArray(given) ? given : []).filter((g): g is number => typeof g === 'number');
    for (const g of chosen) { const i = indexOf(g); if (i >= 0) picks.push(i); }
    const right = new Set(a.form === 'one' ? [a.correct] : a.correct);
    for (const g of chosen) if (!right.has(g)) { const i = indexOf(g); if (i >= 0) tag(tags, i); }
    if (a.form === 'many') for (const r of right) if (!chosen.includes(r)) { const i = indexOf(r); if (i >= 0) tag(tags, i); }
  } else if (a.form === 'match') {
    const tags = tagList(d);
    const lefts = rawList(d.left).map((x) => x.trim());
    const mine = new Map<number, number>();
    for (const p of Array.isArray(given) ? given : []) if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number') mine.set(p[0], p[1]);
    for (const [l, r] of a.pairs) if (mine.get(l) !== r) tag(tags, lefts.indexOf(a.left[l] ?? '\u0000'));
  } else if (a.form === 'lines' || a.form === 'label' || a.form === 'span') {
    /* 2026-11-22 (Homer-Einheit) — Lektüre: Tags je Zeilenbereich („7: tag”, `reading/readingSpec.ts`). */
    for (const x of readingTags(a, d.tags, given)) out.add(x);
  } else if (a.form === 'gap' || a.form === 'order' || a.form === 'build') {
    const tags = tagList(d);
    const marks = outcome.marks ?? (a.form === 'order' || a.form === 'build'
      ? a.items.map((x, i) => Array.isArray(given) && given[i] === x)
      : []);
    marks.forEach((ok, i) => { if (!ok) tag(tags, i); });
  }
  return { tags: [...out], picks };
}

/* -- Die Wahl des Ausgangs ---------------------------------------------------------------------------------------- */

export interface AnswerInput {
  /** 0–1, Podpowiedzi schon eingerechnet. */
  readonly score: number;
  /** Das Urteil der Karte — gilt, solange der Schritt kein eigenes "rightAt" hat (wie bisher). */
  readonly correct?: boolean;
  readonly hints?: number;
  readonly ms?: number;
  readonly tags?: readonly string[];
  readonly picks?: readonly number[];
}

export interface AnswerDecision {
  /** Der Ausgang, über den es weitergeht — oder `null`, wenn ein weiterer Versuch kommt. */
  readonly exit: string | null;
  readonly correct: boolean;
  readonly partial: boolean;
  /** Ein weiterer Versuch: wohin (die Folien davor oder die Frage selbst). */
  readonly retryTo: string | null;
  /** Der wievielte Versuch dies war (0: der erste). */
  readonly attempt: number;
}

/**
 * WOHIN EINE ANTWORT FÜHRT — `has(exit)`: gibt es einen Weg über diesen Ausgang. Reihenfolge: pick:<i> · right/rightOnRetry ·
 * partial · ein weiterer Versuch · wrong:<tag> · wrong.
 */
export function decideAnswer(node: Pick<GraphNode, 'id' | 'config'>, input: AnswerInput, attempt: number, has: (exit: string) => boolean): AnswerDecision {
  const a = adaptiveOf(node.config);
  const correct = input.correct !== undefined && node.config.rightAt === undefined ? input.correct : input.score >= a.rightAt;
  const partial = !correct && a.partialAt !== null && input.score >= a.partialAt - 1e-3;
  const base = { correct, partial, attempt };
  const picks = input.picks ?? [];
  if (picks.length === 1 && has(`pick:${picks[0]}`)) return { ...base, exit: `pick:${picks[0]}`, retryTo: null };
  if (correct) return { ...base, exit: attempt > 0 && has('rightOnRetry') ? 'rightOnRetry' : 'right', retryTo: null };
  if (partial && has('partial')) return { ...base, exit: 'partial', retryTo: null };
  const retry = retryPlanOf(node);
  if (retry !== null && attempt < retry.max) {
    const byTag = (input.tags ?? []).map((t) => retry.byTag[t]).find((x) => x !== undefined);
    return { ...base, exit: null, retryTo: byTag ?? retry.to };
  }
  const tagged = (input.tags ?? []).find((t) => has(`wrong:${t}`));
  return { ...base, exit: tagged === undefined ? 'wrong' : `wrong:${tagged}`, retryTo: null };
}

/* -- Prüfen und beschreiben --------------------------------------------------------------------------------------- */

export interface AdaptiveCheckContext {
  /** Die Fehler-Tags der Frage (`null`: die Frage ist unbekannt). */
  readonly tagsOf: (question: string) => readonly string[] | null;
  /** Die Themen einer Frage („about"). */
  readonly topicsOf: (question: string) => readonly string[];
  /** Worauf ein Eintrag (eine Folie) zeigt — er selbst und seine Verweise („about", „o_czym" …). */
  readonly linksOf: (entry: string) => readonly string[];
}

export interface AdaptiveProblem {
  readonly key: 'tagNoEdge' | 'edgeNoTag' | 'noExit' | 'retryMax' | 'offTopic';
  readonly step: string;
  readonly params: Readonly<Record<string, string | number>>;
}

/**
 * WAS AN DER NACHHILFE NICHT STIMMT (Warnungen): ein Tag der Frage ohne Weg (wenn der Schritt nach Tags verzweigt), ein Weg
 * zu einem Tag, den die Frage nicht hat, Nachhilfe, die nie zurück auf den Hauptweg führt, mehr als zwei Versuche, eine Folie
 * der Nachhilfe, die nicht beim Thema der Frage ist. `authored`: der Graph, wie er steht; `expanded`: aufgeklappt.
 */
export function adaptiveProblems(authored: Graph, expanded: Graph, ctx: AdaptiveCheckContext): AdaptiveProblem[] {
  const out: AdaptiveProblem[] = [];
  const nodes = new Map(expanded.nodes.map((n) => [n.id, n] as const));
  for (const q of authored.nodes) {
    if (q.type !== 'question') continue;
    const a = adaptiveOf(q.config);
    const of = str(q.config.of) || str(q.config.card);
    const known = of === '' ? null : ctx.tagsOf(of);
    const outs = authored.edges.filter((e) => e.from === q.id).map((e) => e.out);
    const used = new Set([...outs.filter((o) => o.startsWith('wrong:')).map((o) => o.slice(6)), ...Object.keys(a.onWrong?.byTag ?? {})]);
    if (known !== null) {
      for (const t of used) if (!known.includes(t)) out.push({ key: 'edgeNoTag', step: q.id, params: { tag: t } });
      if (used.size > 0) for (const t of new Set(known.filter((x) => x !== ''))) if (!used.has(t)) out.push({ key: 'tagNoEdge', step: q.id, params: { tag: t } });
    }
    const max = Math.max(a.retry?.max ?? 0, a.onWrong?.then === 'retry' ? (a.onWrong.max ?? a.retry?.max ?? 1) : 0);
    if (max > 2) out.push({ key: 'retryMax', step: q.id, params: { max } });
    const topics = of === '' ? [] : ctx.topicsOf(of);
    if (topics.length > 0) {
      const slides = [...(a.retry?.after ?? []), ...(a.onWrong?.show ?? []), ...Object.values(a.onWrong?.byTag ?? {}).flat()];
      for (const s of new Set(slides)) {
        const links = new Set([s, ...ctx.linksOf(s)]);
        if (!topics.some((x) => links.has(x))) out.push({ key: 'offTopic', step: q.id, params: { slide: s } });
      }
    }
  }
  /* Nachhilfe ohne Rückweg: von ihr aus nie ein Schritt des Hauptweges (oder ein Ende). */
  const remedial = remedialSteps(expanded);
  for (const r of remedial) {
    const seen = new Set<string>();
    const stack = [r];
    let exit = false;
    while (stack.length > 0 && !exit) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const n = nodes.get(id);
      if (n === undefined) continue;
      if (!remedial.has(id) || n.type === 'end' || n.type === 'return') { exit = true; break; }
      for (const e of expanded.edges) if (e.from === id) stack.push(e.to);
      if (n.config.for !== undefined && expanded.edges.every((e) => e.from !== id)) exit = true;
    }
    if (!exit) out.push({ key: 'noExit', step: r, params: {} });
  }
  return out.filter((p, i) => out.findIndex((x) => x.key === p.key && x.step === p.step && JSON.stringify(x.params) === JSON.stringify(p.params)) === i);
}

/**
 * DIE SCHRITTE DER NACHHILFE: markierte (`"remedial": true`) und alles, was nur über `wrong:<tag>`, `partial` oder
 * `rightOnRetry` erreichbar ist (bis es wieder auf den Hauptweg trifft). Ein schlichtes „wrong" bleibt, wie es war.
 */
export function remedialSteps(graph: Graph, start?: string | null): Set<string> {
  const out = new Set(graph.nodes.filter(isRemedialNode).map((n) => n.id));
  const from = start ?? graph.nodes[0]?.id ?? null;
  if (from === null) return out;
  /* Der Hauptweg: vom Anfang, ohne die Ausgänge der Nachhilfe und ohne markierte Schritte. */
  const main = new Set<string>();
  const stack = [from];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (main.has(id) || out.has(id)) continue;
    main.add(id);
    for (const e of graph.edges) if (e.from === id && !isRemedialExit(e.out)) stack.push(e.to);
  }
  for (const e of graph.edges) {
    if (!isRemedialExit(e.out)) continue;
    const todo = [e.to];
    while (todo.length > 0) {
      const id = todo.pop()!;
      if (main.has(id) || out.has(id)) continue;
      out.add(id);
      for (const x of graph.edges) if (x.from === id) todo.push(x.to);
    }
  }
  return out;
}

/** Je Frage, was sie verzweigt — für die Vorschau des Imports (Wörter macht der Aufrufer). */
export interface BranchSummary {
  readonly step: string;
  readonly tags: readonly string[];
  readonly partial: number | null;
  readonly retry: { readonly max: number; readonly slides: number } | null;
  readonly remediation: { readonly slides: number; readonly check: boolean; readonly then: 'continue' | 'retry'; readonly byTag: number } | null;
  readonly picks: number;
  readonly skips: number;
}

export function branchSummaries(authored: Graph): BranchSummary[] {
  return authored.nodes.flatMap((q): BranchSummary[] => {
    if (q.type !== 'question') return [];
    const a = adaptiveOf(q.config);
    const outs = authored.edges.filter((e) => e.from === q.id).map((e) => e.out);
    const tags = [...new Set([...outs.filter((o) => o.startsWith('wrong:')).map((o) => o.slice(6)), ...Object.keys(a.onWrong?.byTag ?? {})])];
    const picks = outs.filter((o) => o.startsWith('pick:')).length;
    const partial = outs.includes('partial') ? a.partialAt ?? 0.5 : null;
    const w = a.onWrong;
    const s: BranchSummary = {
      step: q.id, tags, partial, picks, skips: a.onRight?.skip.length ?? 0,
      retry: a.retry === null ? null : { max: a.retry.max, slides: a.retry.after.length },
      remediation: w === null ? null : { slides: w.show.length, check: w.check !== null, then: w.then, byTag: Object.keys(w.byTag).length }
    };
    return s.tags.length > 0 || s.partial !== null || s.retry !== null || s.remediation !== null || s.picks > 0 || s.skips > 0 ? [s] : [];
  });
}

/* -- Für Autoren: was die Wege taten (nur zusammengezählt) ---------------------------------------------------------- */

/** Was eine gespeicherte Antwort über ihren Weg trägt (`learn.ts` AnswerRecord). */
export interface BranchMark {
  readonly at: number;
  readonly correctness: number;
  readonly via?: string;
  /** `<ablauf>|<schritt>|<ausgang>` — der Ausgang, den diese Antwort nahm ("retry": ein weiterer Versuch). */
  readonly branch?: string;
  readonly tags?: readonly string[];
}

export interface BranchStat {
  readonly flow: string;
  readonly step: string;
  readonly exit: string;
  /** Wie oft der Weg genommen wurde (über alle Lernenden). */
  readonly taken: number;
  /** Wie oft danach noch eine Antwort in derselben Erzählung kam — und wie oft sie richtig war. */
  readonly checked: number;
  readonly right: number;
}

/**
 * ZUSAMMENGEZÄHLT, NIE JE LERNENDEM: je Weg, wie oft er genommen wurde und wie oft die nächste Prüfung danach (die nächste
 * Antwort desselben Lernenden in derselben Erzählung) richtig war; je Fehler-Tag, wie oft er vorkam.
 */
export function branchInsight(learners: readonly (readonly BranchMark[])[]): { readonly branches: readonly BranchStat[]; readonly tags: readonly { readonly tag: string; readonly count: number }[] } {
  const branches = new Map<string, { flow: string; step: string; exit: string; taken: number; checked: number; right: number }>();
  const tags = new Map<string, number>();
  for (const answers of learners) {
    const list = [...answers].sort((x, y) => x.at - y.at);
    list.forEach((a, i) => {
      for (const t of a.tags ?? []) tags.set(t, (tags.get(t) ?? 0) + 1);
      if (a.branch === undefined) return;
      const [flow = '', step = '', exit = ''] = a.branch.split('|');
      const b = branches.get(a.branch) ?? { flow, step, exit, taken: 0, checked: 0, right: 0 };
      b.taken += 1;
      const next = list.slice(i + 1).find((x) => x.via === a.via);
      if (next !== undefined) { b.checked += 1; if (next.correctness >= 0.999) b.right += 1; }
      branches.set(a.branch, b);
    });
  }
  return {
    branches: [...branches.values()].sort((x, y) => y.taken - x.taken),
    tags: [...tags].map(([tag, count]) => ({ tag, count })).sort((x, y) => y.count - x.count)
  };
}

/* -- Wörter und Zusammenhang der Prüfung (Editor und Import) --------------------------------------------------------- */

/** Alle Verweise in den Feldern eines Eintrags (Kennungen und `@name`) — für „ist die Folie beim Thema der Frage?". */
export function linksIn(data: Readonly<Record<string, unknown>> | null | undefined): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, depth: number) => {
    if (depth > 4) return;
    if (typeof v === 'string') { if (v.trim() !== '' && v.length < 120) out.add(v.trim()); return; }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, depth + 1)); return; }
    if (isObject(v)) { if (typeof v.value === 'string') out.add(v.value); else for (const x of Object.values(v)) walk(x, depth + 1); }
  };
  for (const [k, v] of Object.entries(data ?? {})) if (k !== 'prompt' && k !== 'text' && k !== 'blocks') walk(v, 0);
  return [...out];
}

/** Der Zusammenhang der Prüfung aus den Feldern der Einträge (`data(id)`: die Felder, `null`: unbekannt; `isQuestion`). */
export function checkContext(data: (id: string) => Readonly<Record<string, unknown>> | null, isQuestion: (id: string) => boolean): AdaptiveCheckContext {
  return {
    tagsOf: (q) => (isQuestion(q) ? rawList(data(q)?.tags).map((x) => x.trim()).filter((x) => x !== '') : null),
    topicsOf: (q) => refs(data(q)?.about),
    linksOf: (e) => linksIn(data(e))
  };
}

/** Was eine Frage verzweigt, in einer Zeile (auch für die Vorschau des Imports). */
export function branchWords(s: BranchSummary, t: (key: string, params?: Record<string, string | number>) => string = tr): string {
  return [
    s.tags.length === 0 ? '' : t('cogitaEditFlow.adaptive.sumTags', { list: s.tags.join(', ') }),
    s.partial === null ? '' : t('cogitaEditFlow.adaptive.sumPartial', { pct: Math.round(s.partial * 100) }),
    s.retry === null ? '' : t('cogitaEditFlow.adaptive.sumRetry', { count: s.retry.slides, max: s.retry.max, slides: s.retry.slides }),
    s.remediation === null ? '' : t(s.remediation.then === 'retry' ? 'cogitaEditFlow.adaptive.sumRemedyRetry' : 'cogitaEditFlow.adaptive.sumRemedy', { count: s.remediation.slides, extra: [s.remediation.check ? t('cogitaEditFlow.adaptive.sumCheck') : '', s.remediation.byTag > 0 ? t('cogitaEditFlow.adaptive.sumByTag', { count: s.remediation.byTag }) : ''].join('') }),
    s.picks === 0 ? '' : t('cogitaEditFlow.adaptive.sumPicks', { count: s.picks }),
    s.skips === 0 ? '' : t('cogitaEditFlow.adaptive.sumSkips', { count: s.skips })
  ].filter(Boolean).join(' · ');
}

