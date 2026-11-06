/**
 * 2026-11-06 — EIN SECHSECK, MEHRERE WEGE INNEN. Ein Ablauf mit `unit` ist ein Feld des Krajobraz; in ihm wählt der Lernende
 * („choice") zwischen Wegen, jeder ein eigener Abschnitt (`subflow`, endet mit „Powrót"), die Wege treffen sich wieder an
 * gemeinsamen Fragen, einem gemeinsamen Przegląd und einem Ende. Ein Weg genügt; die anderen bleiben freiwillig.
 * <code>
 *   auf jedem Weg   ein Schritt, an dem kein Weg vorbeiführt: jede Wahl ("choice") muss mit JEDER Möglichkeit zu ihm führen,
 *                   jeder andere Schritt mit IRGENDEINEM Ausgang (eine Antwort, eine Bedingung — nicht der Lernende wählt)
 *   Pflichtfragen   die Fragen des Ablaufs selbst, die auf jedem Weg liegen — sie zählen für „alles gekonnt" und für den
 *                   Przegląd ("of": "story"); ein Ablauf ohne „choice": alle seine Fragen (wie bisher)
 *   Abschnitt       der Ablauf hinter einem `subflow` eines Ablaufs mit `unit`: ohne eigenes `unit` (sonst ein eigenes Feld),
 *                   endet mit „Powrót"; seine Fragen sind Übung, sie zählen nicht für das Sechseck
 *   Abdeckung       jede Pflichtfrage ist auf jedem Weg vorbereitet: der Weg zeigt ihr Thema ("about") oder eine Folie ihrer
 *                   Erklärung ("explain") — im Ablauf selbst oder in einem gerufenen Abschnitt
 * </code>
 * Rein; geprüft in `scripts/app-mountain-check.mjs`. Die Prüfung warnt nur (der Import geht weiter).
 */

import { t } from '../core/i18n';
import type { Flow } from './flow';

export interface MountainProblem {
  readonly level: 'error' | 'warning';
  readonly text: string;
  readonly step?: string;
}

/** Was die Prüfung aus der Baza braucht (der Import: Plan + Baza; der Editor: die Baza). */
export interface MountainContext {
  /** Ein Ablauf aus Kennung oder @Namen — `undefined`: es gibt ihn nicht. */
  readonly flow: (ref: string) => Flow | undefined;
  /** Ein Eintrag aus Kennung oder @Namen — seine Kennung, `null`: es gibt ihn nicht. */
  readonly entity: (ref: string) => string | null;
  /** Eine Frage: worüber sie ist und welche Folien sie erklären (Kennungen) — `null`: keine Frage. */
  readonly question: (id: string) => { readonly about: readonly string[]; readonly explain: readonly string[] } | null;
  /** Der Name eines Eintrags (für die Meldungen). */
  readonly label: (id: string) => string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Die Wege aus einem Schritt (Ausgang → Ziel), nur verbundene. */
function exitsMap(flow: Pick<Flow, 'graph'>): Map<string, { readonly out: string; readonly to: string }[]> {
  const ids = new Set(flow.graph.nodes.map((n) => n.id));
  const m = new Map<string, { out: string; to: string }[]>();
  for (const e of flow.graph.edges) {
    if (typeof e.to !== 'string' || !ids.has(e.to)) continue;
    const list = m.get(e.from) ?? [];
    list.push({ out: e.out, to: e.to });
    m.set(e.from, list);
  }
  return m;
}

export const hasChoice = (flow: Pick<Flow, 'graph'>): boolean => flow.graph.nodes.some((n) => n.type === 'choice');

/**
 * Die Schritte, an denen kein Weg vorbeiführt (vom Anfang aus). Für jeden Schritt q: rückwärts von q — eine Wahl gilt als
 * „führt zu q", wenn jede ihrer Möglichkeiten dahin führt, jeder andere Schritt, wenn einer seiner Ausgänge es tut.
 */
export function stepsOnEveryRoute(flow: Pick<Flow, 'graph'> & { readonly start?: string | null }): Set<string> {
  const out = new Set<string>();
  if (flow.start === null || flow.start === undefined) return out;
  const exits = exitsMap(flow);
  const preds = new Map<string, string[]>();
  for (const [from, list] of exits) for (const e of list) preds.set(e.to, [...(preds.get(e.to) ?? []), from]);
  const type = new Map(flow.graph.nodes.map((n) => [n.id, n.type] as const));
  for (const q of flow.graph.nodes.map((n) => n.id)) {
    const forced = new Set<string>([q]);
    const hits = new Map<string, number>();
    const work = [q];
    while (work.length > 0) {
      const at = work.pop()!;
      for (const p of preds.get(at) ?? []) {
        if (forced.has(p)) continue;
        if (type.get(p) === 'choice') {
          /* Je Kante ein Treffer (zwei Möglichkeiten zum selben Schritt zählen zweimal). */
          const n = (hits.get(p) ?? 0) + (exits.get(p) ?? []).filter((e) => e.to === at).length;
          hits.set(p, n);
          if (n < (exits.get(p) ?? []).length) continue;
        }
        forced.add(p);
        work.push(p);
      }
    }
    if (forced.has(flow.start)) out.add(q);
  }
  return out;
}

/** Die Fragen des Ablaufs, die zählen: auf jedem Weg (mit „choice"), sonst alle (wie bisher). */
export function mandatoryQuestionSteps(flow: Pick<Flow, 'graph'> & { readonly start?: string | null }): Set<string> {
  const questions = flow.graph.nodes.filter((n) => n.type === 'question').map((n) => n.id);
  if (!hasChoice(flow)) return new Set(questions);
  const every = stepsOnEveryRoute(flow);
  return new Set(questions.filter((id) => every.has(id)));
}

/** Ein Weg durch die Wahlen: welche Möglichkeit an welcher Wahl, und welche Schritte er erreicht. */
export interface Route {
  readonly picks: Readonly<Record<string, string>>;
  readonly steps: ReadonlySet<string>;
}

/** Alle Wege durch die Wahlen eines Ablaufs (höchstens `cap`); ein Schritt ohne Wahl folgt allen seinen Ausgängen. */
export function routesOf(flow: Flow, cap = 64): { readonly routes: Route[]; readonly capped: boolean } {
  const routes: Route[] = [];
  let capped = false;
  if (flow.start === null) return { routes, capped };
  const exits = exitsMap(flow);
  const type = new Map(flow.graph.nodes.map((n) => [n.id, n.type] as const));
  const walk = (picks: Record<string, string>) => {
    if (routes.length >= cap) { capped = true; return; }
    const reach = new Set<string>();
    const stack = [flow.start!];
    let open: string | null = null;
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (reach.has(id)) continue;
      reach.add(id);
      const list = exits.get(id) ?? [];
      if (type.get(id) === 'choice') {
        const p = picks[id];
        if (p === undefined) { if (open === null && list.length > 0) open = id; continue; }
        for (const e of list) if (e.out === p) stack.push(e.to);
      } else for (const e of list) stack.push(e.to);
    }
    if (open === null) { routes.push({ picks, steps: reach }); return; }
    for (const x of [...new Set((exits.get(open) ?? []).map((e) => e.out))]) walk({ ...picks, [open]: x });
  };
  walk({});
  return { routes, capped };
}

const SHOWS = new Set(['show', 'expand', 'opening', 'line']);

/**
 * Was ein Ablauf auf jedem seiner Wege zeigt oder fragt (Kennungen) — mit den Abschnitten, die er ruft (bis 4 tief).
 * `only`: nur diese Schritte (ein Weg); sonst die Schritte auf jedem Weg.
 */
function contentOf(flow: Flow, ctx: MountainContext, only: ReadonlySet<string> | null, depth: number, seen: Set<string>): Set<string> {
  const out = new Set<string>();
  const steps = only ?? (hasChoice(flow) ? stepsOnEveryRoute(flow) : new Set(flow.graph.nodes.map((n) => n.id)));
  for (const n of flow.graph.nodes) {
    if (!steps.has(n.id)) continue;
    if (SHOWS.has(n.type) || n.type === 'question') {
      const id = ctx.entity(str(n.config.of) || str(n.config.card));
      if (id !== null) out.add(id);
    }
    if (n.type === 'subflow' && depth < 4) {
      const inner = ctx.flow(str(n.config.flow));
      if (inner !== undefined && !seen.has(inner.id)) {
        seen.add(inner.id);
        for (const x of contentOf(inner, ctx, null, depth + 1, seen)) out.add(x);
        seen.delete(inner.id);
      }
    }
  }
  return out;
}

/** Wie ein Weg heisst: die gewählten Möglichkeiten („Krótko → Źródła"). */
function routeName(flow: Flow, picks: Readonly<Record<string, string>>): string {
  const names = flow.graph.nodes.filter((n) => n.type === 'choice' && picks[n.id] !== undefined).map((n) => {
    const i = Number(picks[n.id].replace(/^o/, ''));
    const o = Array.isArray(n.config.options) ? n.config.options[i] : undefined;
    const label = typeof o === 'string' ? o : typeof o === 'object' && o !== null ? str((o as { label?: unknown }).label) : '';
    return label !== '' ? label : t('cogitaEditFlow.exit.option', { n: i + 1 });
  });
  return names.length === 0 ? flow.name : names.join(' → ');
}

/** Ein Ablauf, den diese Prüfung betrifft: ein Sechseck (`unit`) mit Wahlen oder Abschnitten. */
export const isMountain = (flow: Flow): boolean => flow.unit !== undefined && flow.graph.nodes.some((n) => n.type === 'choice' || n.type === 'subflow');

/** Was an einem Sechseck mit inneren Wegen nicht stimmt — nur Warnungen. */
export function mountainProblems(flow: Flow, ctx: MountainContext): MountainProblem[] {
  if (!isMountain(flow)) return [];
  const out: MountainProblem[] = [];
  const warn = (text: string, step?: string) => out.push({ level: 'warning', text, ...(step === undefined ? {} : { step }) });
  const every = hasChoice(flow) ? stepsOnEveryRoute(flow) : new Set(flow.graph.nodes.map((n) => n.id));
  const mandatory = mandatoryQuestionSteps(flow);

  /* Die Abschnitte: es gibt sie, ohne eigenes Feld, sie enden mit „Powrót", ihre Fragen sind Übung. */
  for (const n of flow.graph.nodes.filter((x) => x.type === 'subflow')) {
    const ref = str(n.config.flow);
    const seg = ref === '' ? undefined : ctx.flow(ref);
    if (seg === undefined) { warn(t('cogitaEditFlow.mountain.segmentMissing', { ref: ref || '—' }), n.id); continue; }
    if (seg.id === flow.id) continue;
    if (seg.unit !== undefined) warn(t('cogitaEditFlow.mountain.segmentUnit', { name: seg.name }), n.id);
    if (seg.graph.nodes.some((x) => x.type === 'end')) warn(t('cogitaEditFlow.mountain.segmentEnd', { name: seg.name }), n.id);
    const asks = seg.graph.nodes.filter((x) => x.type === 'question').length;
    if (asks > 0) warn(t('cogitaEditFlow.mountain.segmentQuestions', { name: seg.name, count: asks }), n.id);
  }

  /* Fragen auf nur einem Weg, Przeglądy auf nur einem Weg oder ohne Pflichtfragen. */
  for (const n of flow.graph.nodes) {
    if (n.type === 'question' && !mandatory.has(n.id)) {
      const id = ctx.entity(str(n.config.of) || str(n.config.card));
      warn(t('cogitaEditFlow.mountain.branchQuestion', { name: id === null ? n.id : ctx.label(id) }), n.id);
    }
    if (n.type === 'review') {
      const of = str(n.config.of);
      if (!every.has(n.id)) warn(t('cogitaEditFlow.mountain.reviewBranch'), n.id);
      else if ((of === '' || of === 'story') && mandatory.size === 0) warn(t('cogitaEditFlow.mountain.reviewEmpty'), n.id);
    }
  }
  if (mandatory.size === 0 && !flow.graph.nodes.some((n) => n.type === 'review' && every.has(n.id))) warn(t('cogitaEditFlow.mountain.noAssessment'));

  /* Jeder Weg: kommt an ein Ende, bereitet jede Pflichtfrage vor. */
  const { routes, capped } = routesOf(flow);
  if (capped) warn(t('cogitaEditFlow.mountain.tooManyRoutes', { count: routes.length }));
  const prep = [...mandatory].map((step) => {
    const node = flow.graph.nodes.find((x) => x.id === step)!;
    const ref = str(node.config.of) || str(node.config.card);
    const id = ctx.entity(ref);
    if (id === null) { warn(t('cogitaEditFlow.mountain.questionMissing', { ref: ref || '—' }), step); return null; }
    const q = ctx.question(id);
    const ways = q === null ? [] : [...q.about, ...q.explain];
    if (ways.length === 0) { warn(t('cogitaEditFlow.mountain.uncheckable', { name: ctx.label(id) }), step); return null; }
    return { step, id, ways };
  }).filter((x): x is { step: string; id: string; ways: string[] } => x !== null);
  const type = new Map(flow.graph.nodes.map((n) => [n.id, n.type] as const));
  for (const r of routes) {
    const name = routeName(flow, r.picks);
    if (![...r.steps].some((id) => type.get(id) === 'end' || type.get(id) === 'return')) { warn(t('cogitaEditFlow.mountain.routeNoEnd', { route: name })); continue; }
    const taught = contentOf(flow, ctx, r.steps, 0, new Set([flow.id]));
    for (const p of prep) if (!p.ways.some((w) => taught.has(w))) warn(t('cogitaEditFlow.mountain.notCovered', { route: name, name: ctx.label(p.id) }), p.step);
  }
  return out;
}
