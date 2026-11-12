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
 *
 * 2026-11-10 — GABELUNGEN (Eigentümer: „Zweige mit eigenem Ziel zählen als Fehler"). Eine Wahl, deren Möglichkeiten sich nie
 * wieder treffen, führt zu verschiedenen Türmen und endet dort: die Erzählung ist geschafft, wenn EIN Zweig geschafft ist, die
 * anderen bleiben offene Wege auf der Karte. Eine Wahl, deren Möglichkeiten sich wieder treffen (dieselben Karten verpackt für
 * Kinder, Schule, Erwachsene), bleibt eine Wahl wie oben.
 * <code>
 *   Gabelung        eine Wahl mit mindestens zwei Zielen vorwärts, deren Wege sich nie wieder treffen: ihr Nachdominator ist
 *                   das Ende selbst — ein gemeinsamer Schritt "end", "return", "handoff" oder "restart" ist kein Treffpunkt,
 *                   ein Rückweg („noch einmal" zurück) trifft nichts (`forkChoices`)
 *   Zweig           ein Weg durch die Gabelungen (`forkRoutes`); an den übrigen Wahlen gilt weiter „auf jedem Weg"
 *   Pflichtfragen   eines Zweiges: die Fragen auf jedem seiner Wege — die gemeinsamen vor der Gabelung gehören zu jedem Zweig;
 *                   die des Ablaufs: die jedes Zweiges (eine Frage eines Zweiges zählt — für diesen Zweig)
 *   gekonnt         alle Pflichtfragen EINES Zweiges (`flowQuestionsKnown`)
 *   Przegląd        in einem Zweig prüft er dessen Pflichtfragen (`reviewQuestionSteps`); am Ende eines Zweiges ist er richtig
 *   Ziele           ein Ziel, das nur in Zweigen erreicht wird (der Przegląd eines Turms), zählt nur für diese: bestanden ist,
 *                   wer einen Zweig zu Ende ging und dessen Ziele hat (`goalsToPass`); „Powtórz przegląd" springt zum
 *                   Przegląd seines Zweiges (`reviewOnRoute`)
 * </code>
 * Rein; geprüft in `scripts/app-mountain-check.mjs`. Die Prüfung warnt nur (der Import geht weiter).
 */

import { t } from '../core/i18n';
import { reviewOf, type Flow } from './flow';
import type { Condition } from './logic';

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

/** Ein Ablauf, wie die Wege ihn brauchen: sein Graph und sein Anfang. */
type FlowShape = Pick<Flow, 'graph'> & { readonly start?: string | null };

interface Exit { readonly out: string; readonly to: string }

/** Die Wege aus einem Schritt (Ausgang → Ziel), nur verbundene. */
function exitsMap(flow: Pick<Flow, 'graph'>): Map<string, Exit[]> {
  const ids = new Set(flow.graph.nodes.map((n) => n.id));
  const m = new Map<string, Exit[]>();
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
 * 2026-11-12 — EINE MÖGLICHKEIT, DIE ZUR WAHL ZURÜCKKEHRT („Sprawdź, ile już umiesz" → Einstufung → zurück zur Wahl): von ihrem
 * Ziel aus führt jeder Weg — ohne durch die Wahl selbst zu gehen — zurück zu ihr und nie an ein Ende. Sie ist kein Zweig und
 * kein Weg für sich, sondern ein Abstecher; der Lernende wählt danach noch einmal. Schlüssel: `<wahl>:<ausgang>`.
 */
function returningOptions(flow: Pick<Flow, 'graph'>): Set<string> {
  const exits = exitsMap(flow);
  const type = new Map(flow.graph.nodes.map((n) => [n.id, n.type] as const));
  const out = new Set<string>();
  for (const n of flow.graph.nodes) {
    if (n.type !== 'choice') continue;
    const list = exits.get(n.id) ?? [];
    for (const o of list) {
      let back = false, ends = false;
      const seen = new Set<string>();
      const stack = [o.to];
      while (stack.length > 0 && !ends) {
        const id = stack.pop()!;
        if (id === n.id) { back = true; continue; }
        if (seen.has(id)) continue;
        seen.add(id);
        const ty = type.get(id) ?? '';
        const next = exits.get(id) ?? [];
        if (TERMINAL.has(ty) || ty === 'chapterEnd' || next.length === 0) { ends = true; break; }
        for (const e of next) stack.push(e.to);
      }
      if (back && !ends) out.add(`${n.id}:${o.out}`);
    }
    /* Kehren alle zurück, ist keine davon ein Abstecher (sonst gäbe es keinen Weg). */
    if (list.length > 0 && list.every((o) => out.has(`${n.id}:${o.out}`))) for (const o of list) out.delete(`${n.id}:${o.out}`);
  }
  return out;
}

/**
 * Führt jeder Weg vom Anfang zu `q`? Rückwärts von q — eine Wahl gilt als „führt zu q", wenn jede ihrer Möglichkeiten dahin
 * führt (eine Gabelung aus `picks`: die gewählte), jeder andere Schritt, wenn einer seiner Ausgänge es tut.
 */
function everyRoute(flow: FlowShape): (q: string, picks?: Readonly<Record<string, string>>) => boolean {
  const start = flow.start;
  const exits = exitsMap(flow);
  /* Jeder Vorgänger einmal je Schritt (sonst zählten zwei Möglichkeiten zum selben Schritt viermal). */
  const preds = new Map<string, Set<string>>();
  for (const [from, list] of exits) for (const e of list) preds.set(e.to, (preds.get(e.to) ?? new Set<string>()).add(from));
  const type = new Map(flow.graph.nodes.map((n) => [n.id, n.type] as const));
  /* 2026-11-12 — eine Möglichkeit, die zur Wahl zurückkehrt, zählt hier nicht mit (an ihr führt jeder Weg vorbei). */
  const back = returningOptions(flow);
  return (q, picks = {}) => {
    if (start === null || start === undefined) return false;
    if (q === start) return true;
    const forced = new Set<string>([q]);
    const hits = new Map<string, number>();
    const work = [q];
    while (work.length > 0) {
      const at = work.pop()!;
      for (const p of preds.get(at) ?? []) {
        if (forced.has(p)) continue;
        if (type.get(p) === 'choice') {
          const list = (exits.get(p) ?? []).filter((e) => !back.has(`${p}:${e.out}`));
          const pick = picks[p];
          if (pick !== undefined) {
            if (!list.some((e) => e.out === pick && e.to === at)) continue;
          } else {
            /* Je Kante ein Treffer (zwei Möglichkeiten zum selben Schritt zählen zweimal). */
            const n = (hits.get(p) ?? 0) + list.filter((e) => e.to === at).length;
            hits.set(p, n);
            if (n < list.length) continue;
          }
        }
        if (p === start) return true;
        forced.add(p);
        work.push(p);
      }
    }
    return false;
  };
}

/**
 * Die Schritte, an denen kein Weg vorbeiführt (vom Anfang aus). Für jeden Schritt q: rückwärts von q — eine Wahl gilt als
 * „führt zu q", wenn jede ihrer Möglichkeiten dahin führt, jeder andere Schritt, wenn einer seiner Ausgänge es tut.
 */
export function stepsOnEveryRoute(flow: FlowShape): Set<string> {
  const on = everyRoute(flow);
  return new Set(flow.graph.nodes.map((n) => n.id).filter((id) => on(id)));
}

/** Schritte, nach denen es in einem Ablauf nicht weitergeht. */
const TERMINAL = new Set(['end', 'return', 'handoff', 'restart']);
/** Der gedachte Schritt hinter allen Enden. */
const EXIT = '~exit';

interface Forward {
  /** Die Ausgänge vorwärts je erreichbarem Schritt (ohne Rückwege). */
  readonly next: ReadonlyMap<string, readonly Exit[]>;
  /** Der Nachdominator je Schritt: der nächste Schritt, über den jeder Weg von ihm zum Ende führt (`EXIT`: erst das Ende). */
  readonly ipdom: ReadonlyMap<string, string>;
}

/**
 * Der Ablauf vorwärts (die Idee von `dagOf` der Weltkarte): vom Anfang aus, ohne Rückwege — eine Kante zu einem Schritt, von dem
 * man gerade kommt (Wiederholen, „noch einmal"), fällt weg; ein Kapitelende führt dorthin, wo es nach allen Kapiteln weitergeht.
 */
function forwardOf(flow: FlowShape): Forward {
  const exits = exitsMap(flow);
  const type = new Map(flow.graph.nodes.map((n) => [n.id, n.type] as const));
  /* Ein Kapitelende gehört zu der Auswahl, aus deren Kapitel man es erreicht. */
  const hubOf = new Map<string, string>();
  for (const hub of flow.graph.nodes.filter((n) => n.type === 'chapters')) {
    for (const { out, to } of exits.get(hub.id) ?? []) {
      if (!/^c\d+$/.test(out)) continue;
      const seen = new Set<string>();
      const stack = [to];
      while (stack.length > 0) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const ty = type.get(id) ?? '';
        if (ty === 'chapterEnd') { if (!hubOf.has(id)) hubOf.set(id, hub.id); continue; }
        if (ty === 'chapters' || TERMINAL.has(ty)) continue;
        for (const o of exits.get(id) ?? []) stack.push(o.to);
      }
    }
  }
  const raw = (id: string): readonly Exit[] => {
    const ty = type.get(id) ?? '';
    if (TERMINAL.has(ty)) return [];
    if (ty === 'chapterEnd') {
      const hub = hubOf.get(id);
      const done = hub === undefined ? undefined : (exits.get(hub) ?? []).find((o) => o.out === 'done')?.to;
      return done === undefined ? [] : [{ out: 'next', to: done }];
    }
    return exits.get(id) ?? [];
  };
  const next = new Map<string, Exit[]>();
  const post: string[] = [];
  const start = flow.start;
  if (start !== null && start !== undefined && type.has(start)) {
    const state = new Map<string, 1 | 2>([[start, 1]]);
    next.set(start, []);
    const stack = [{ id: start, kids: raw(start), i: 0 }];
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top.i >= top.kids.length) { state.set(top.id, 2); post.push(top.id); stack.pop(); continue; }
      const k = top.kids[top.i];
      top.i += 1;
      const s = state.get(k.to);
      /* Zurück zu einem Schritt, der noch offen ist: ein Rückweg. */
      if (s === 1) continue;
      next.get(top.id)!.push(k);
      if (s === 2) continue;
      state.set(k.to, 1);
      next.set(k.to, []);
      stack.push({ id: k.to, kids: raw(k.to), i: 0 });
    }
  }
  /* Rückwärts in der Reihenfolge: der Nachdominator ist der Treffpunkt der Nachdominatoren aller Nachfolger. */
  const order = post.reverse();
  const index = new Map(order.map((id, i) => [id, i] as const));
  index.set(EXIT, order.length);
  const ipdom = new Map<string, string>([[EXIT, EXIT]]);
  const meet = (a0: string, b0: string): string => {
    let a = a0;
    let b = b0;
    while (a !== b) {
      while (index.get(a)! < index.get(b)!) a = ipdom.get(a) ?? EXIT;
      while (index.get(b)! < index.get(a)!) b = ipdom.get(b) ?? EXIT;
    }
    return a;
  };
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const id = order[i];
    const succ = [...new Set(next.get(id)!.map((o) => o.to))];
    ipdom.set(id, succ.length === 0 ? EXIT : succ.slice(1).reduce(meet, succ[0]));
  }
  return { next, ipdom };
}

function forksOf(flow: FlowShape, fw: Forward): Set<string> {
  const type = new Map(flow.graph.nodes.map((n) => [n.id, n.type] as const));
  const back = returningOptions(flow);
  const out = new Set<string>();
  for (const n of flow.graph.nodes) {
    if (n.type !== 'choice') continue;
    const ahead = fw.next.get(n.id)?.filter((e) => !back.has(`${n.id}:${e.out}`));
    if (ahead === undefined || new Set(ahead.map((e) => e.to)).size < 2) continue;
    const join = fw.ipdom.get(n.id) ?? EXIT;
    if (join === EXIT || TERMINAL.has(type.get(join) ?? '')) out.add(n.id);
  }
  return out;
}

/**
 * 2026-11-10 — DIE GABELUNGEN eines Ablaufs: erreichbare Wahlen mit mindestens zwei Zielen vorwärts, deren Wege sich nie wieder
 * treffen (ihr Nachdominator ist das Ende; ein gemeinsamer Schritt "end"/"return"/"handoff"/"restart" ist kein Treffpunkt).
 */
export function forkChoices(flow: FlowShape): Set<string> {
  if (!hasChoice(flow)) return new Set();
  return forksOf(flow, forwardOf(flow));
}

/** 2026-11-10 — Ein Zweig: ein Weg durch die Gabelungen eines Ablaufs. */
export interface ForkRoute {
  /** Die Möglichkeit an jeder Gabelung, die er erreicht (`{}`: ein Ablauf ohne Gabelung). */
  readonly picks: Readonly<Record<string, string>>;
  /** Die Schritte, die er erreicht (an den übrigen Wahlen jede Möglichkeit; ein Ablauf ohne „choice": alle). */
  readonly steps: ReadonlySet<string>;
  /** Seine Pflichtfragen: die Frage-Schritte auf jedem seiner Wege (ein Ablauf ohne „choice": alle Fragen, wie bisher). */
  readonly mandatory: ReadonlySet<string>;
  /** Die Przegląd-Schritte auf jedem seiner Wege. */
  readonly reviews: ReadonlySet<string>;
  /** 2026-11-12 — die Einstufungen ("explore") auf jedem seiner Wege: sie prüfen wie Fragen. */
  readonly explores: ReadonlySet<string>;
}

/**
 * 2026-11-10 — DIE ZWEIGE eines Ablaufs (höchstens `cap`): je erreichbare Kombination der Möglichkeiten seiner Gabelungen (nur
 * die vorwärts — „noch einmal" zurück ist kein Zweig) einer. Ohne Gabelung genau einer: seine Pflichtfragen sind die bisherigen.
 */
export function forkRoutes(flow: FlowShape, cap = 64): ForkRoute[] {
  const questions = flow.graph.nodes.filter((n) => n.type === 'question').map((n) => n.id);
  const reviews = flow.graph.nodes.filter((n) => n.type === 'review').map((n) => n.id);
  const explores = flow.graph.nodes.filter((n) => n.type === 'explore').map((n) => n.id);
  /* Ohne Wahl: ein Weg über alle Schritte, alle Fragen zählen (wie bisher — auch ohne Kanten oder Anfang). */
  if (!hasChoice(flow)) return [{ picks: {}, steps: new Set(flow.graph.nodes.map((n) => n.id)), mandatory: new Set(questions), reviews: new Set(reviews), explores: new Set(explores) }];
  const start = flow.start;
  if (start === null || start === undefined) return [{ picks: {}, steps: new Set(), mandatory: new Set(), reviews: new Set(), explores: new Set() }];
  const fw = forwardOf(flow);
  const forks = forksOf(flow, fw);
  const back = returningOptions(flow);
  const exits = exitsMap(flow);
  const on = everyRoute(flow);
  const out: ForkRoute[] = [];
  const walk = (picks: Record<string, string>) => {
    if (out.length >= cap) return;
    const reach = new Set<string>();
    const stack = [start];
    let open: string | null = null;
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (reach.has(id)) continue;
      reach.add(id);
      const list = exits.get(id) ?? [];
      if (forks.has(id)) {
        const p = picks[id];
        if (p === undefined) { if (open === null) open = id; continue; }
        for (const e of list) if (e.out === p) stack.push(e.to);
      } else for (const e of list) stack.push(e.to);
    }
    if (open === null) {
      const fixed = (id: string) => reach.has(id) && on(id, picks);
      out.push({ picks, steps: reach, mandatory: new Set(questions.filter(fixed)), reviews: new Set(reviews.filter(fixed)), explores: new Set(explores.filter(fixed)) });
      return;
    }
    const at = open;
    for (const x of [...new Set((fw.next.get(at) ?? []).map((e) => e.out))].filter((x) => !back.has(`${at}:${x}`))) walk({ ...picks, [at]: x });
  };
  walk({});
  return out;
}

/** Die Frage-Schritte in der Reihenfolge des Ablaufs, die `keep` behält. */
const questionsWhere = (flow: FlowShape, keep: (id: string) => boolean): Set<string> =>
  new Set(flow.graph.nodes.filter((n) => n.type === 'question' && keep(n.id)).map((n) => n.id));

/**
 * Die Fragen des Ablaufs, die zählen: auf jedem Weg (mit „choice"), sonst alle (wie bisher). 2026-11-10 — mit Gabelungen: die
 * Pflichtfragen jedes Zweiges.
 */
export function mandatoryQuestionSteps(flow: FlowShape): Set<string> {
  if (!hasChoice(flow)) return questionsWhere(flow, () => true);
  const inSome = new Set(forkRoutes(flow).flatMap((r) => [...r.mandatory]));
  return questionsWhere(flow, (id) => inSome.has(id));
}

/**
 * 2026-11-10 — WAS EIN PRZEGLĄD ("of": "story") AM SCHRITT `step` PRÜFT: die Pflichtfragen, die in jedem Zweig gelten, in dem er
 * liegt — in einem Zweig dessen eigene mit den gemeinsamen davor. Vor der Gabelung, ohne `step` oder ohne Gabelung: die Fragen
 * auf jedem Weg (wie bisher).
 */
export function reviewQuestionSteps(flow: FlowShape, step?: string): Set<string> {
  const routes = forkRoutes(flow);
  const mine = step === undefined ? [] : routes.filter((r) => r.steps.has(step));
  const use = mine.length > 0 ? mine : routes;
  return questionsWhere(flow, (id) => use.length > 0 && use.every((r) => r.mandatory.has(id)));
}

/**
 * 2026-11-10 — DIE ZWEIGE EINES LAUFS (`visited`, die Schritte seines letzten Laufs): unter den Zweigen, die ein besuchtes Ende
 * ("end", "return") erreichen — sonst unter allen —, die mit den meisten besuchten Schritten. `null`: ohne Gabelung oder ohne Besuchtes.
 */
export function runRoutes(flow: FlowShape, visited: readonly string[]): { readonly routes: readonly ForkRoute[]; readonly ended: boolean } | null {
  if (visited.length === 0) return null;
  const routes = forkRoutes(flow);
  if (!routes.some((r) => Object.keys(r.picks).length > 0)) return null;
  const type = new Map(flow.graph.nodes.map((n) => [n.id, n.type] as const));
  const ends = visited.filter((s) => type.get(s) === 'end' || type.get(s) === 'return');
  const ended = routes.filter((r) => ends.some((e) => r.steps.has(e)));
  const pool = ended.length > 0 ? ended : routes;
  const score = (r: ForkRoute) => visited.filter((s) => r.steps.has(s)).length;
  const best = Math.max(...pool.map(score));
  return { routes: pool.filter((r) => score(r) === best), ended: ended.length > 0 };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * 2026-11-10 — WO EIN ZIEL ERREICHT WIRD: ein Ziel „Wartość" (`{"type": "value", "value": v, …}`, auch das Ziel „Przegląd zdany")
 * an den Schritten, die v schreiben — ein Przegląd mit diesem "value" (ohne: der Schlüssel des Ablaufs), ein "set" mit "set"/"add"
 * auf v; ein Ziel „odwiedzony" an seinem Schritt. `null`: an keinem Schritt des Ablaufs (das Ziel zählt überall, wie bisher).
 */
export function goalSteps(flow: Pick<Flow, 'id' | 'ref' | 'graph'>, goal: { readonly condition?: Condition | null }): Set<string> | null {
  const c = goal.condition;
  const out = new Set<string>();
  if (c?.type === 'value' && (c.value ?? '').trim() !== '') {
    const v = (c.value ?? '').trim();
    for (const n of flow.graph.nodes) {
      if (n.type === 'review' && reviewOf(flow, n)?.value === v) out.add(n.id);
      if (n.type === 'set' && Array.isArray(n.config.actions) && n.config.actions.some((a) => isRecord(a) && (a.type === 'set' || a.type === 'add') && str(a.value) === v)) out.add(n.id);
    }
  } else if (c?.type === 'visited' && flow.graph.nodes.some((n) => n.id === c.of)) out.add(c.of!);
  return out.size === 0 ? null : out;
}

/** Ein Ablauf mit Zielen, wie `goalsToPass` ihn liest (ohne Graph: alle Ziele, wie bisher). */
export type GoalFlow = { readonly goals: readonly { readonly id: string; readonly condition?: Condition | null }[] } & Partial<Pick<Flow, 'id' | 'ref' | 'graph' | 'start'>>;

/**
 * 2026-11-10 — WELCHE ZIELE EIN LERNENDER ERREICHEN MUSS (Kennungen; mehrere Listen: eine genügt). Ohne Gabelung, ohne `visited`
 * oder ohne ein Ende darin: alle Ziele (wie bisher). Mit Gabelungen je Zweig, den sein letzter Lauf zu Ende ging, dessen Ziele —
 * ein Ziel, das nur in anderen Zweigen erreicht wird (der Przegląd am Ende eines anderen Turms), zählt nicht.
 */
export function goalsToPass(flow: GoalFlow, visited?: readonly string[]): string[][] {
  const all = flow.goals.map((g) => g.id);
  if (visited === undefined || flow.graph === undefined || flow.id === undefined || all.length === 0) return [all];
  const shaped = { id: flow.id, ...(flow.ref === undefined ? {} : { ref: flow.ref }), graph: flow.graph, start: flow.start };
  const run = runRoutes(shaped, visited);
  if (run === null || !run.ended) return [all];
  const at = flow.goals.map((g) => [g.id, goalSteps(shaped, g)] as const);
  return run.routes.map((r) => at.filter(([, steps]) => steps === null || [...steps].some((s) => r.steps.has(s))).map(([id]) => id));
}

/**
 * 2026-11-10 — DER PRZEGLĄD AUF DEM ZWEIG DES LERNENDEN (mit Gabelungen, aus seinem letzten Lauf): `review` des Ablaufs, wenn er
 * auf diesem Zweig liegt (`null`), sonst der erste Przegląd des Zweiges. `null` auch ohne Gabelung oder ohne Przegląd dort.
 */
export function reviewOnRoute(flow: FlowShape & { readonly review?: string }, visited: readonly string[]): string | null {
  const run = runRoutes(flow, visited);
  if (run === null) return null;
  const own = flow.review;
  if (own !== undefined && run.routes.some((r) => r.steps.has(own))) return null;
  return flow.graph.nodes.find((n) => n.type === 'review' && run.routes.some((r) => r.steps.has(n.id)))?.id ?? null;
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
  /* 2026-11-12 — eine Möglichkeit, die zur Wahl zurückkehrt, ist kein Weg für sich (der Lernende wählt danach noch einmal). */
  const back = returningOptions(flow);
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
    const at = open;
    for (const x of [...new Set((exits.get(at) ?? []).map((e) => e.out))].filter((x) => !back.has(`${at}:${x}`))) walk({ ...picks, [at]: x });
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
  /* 2026-11-10 — die Zweige durch die Gabelungen; ohne Gabelung einer: der ganze Ablauf (wie bisher). */
  const branches = forkRoutes(flow);
  const forked = branches.some((b) => Object.keys(b.picks).length > 0);
  const inSome = new Set(branches.flatMap((b) => [...b.mandatory]));
  const mandatory = questionsWhere(flow, (id) => inSome.has(id));

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

  /*
    Fragen, die in keinem Zweig Pflicht sind (eine Wahl führt an ihnen vorbei); Przeglądy, die in ihrem Zweig nur auf einigen
    Wegen liegen (am Ende eines Zweiges ist einer richtig) oder ohne Pflichtfragen.
  */
  for (const n of flow.graph.nodes) {
    if (n.type === 'question' && !mandatory.has(n.id)) {
      const id = ctx.entity(str(n.config.of) || str(n.config.card));
      warn(t('cogitaEditFlow.mountain.branchQuestion', { name: id === null ? n.id : ctx.label(id) }), n.id);
    }
    if (n.type === 'review') {
      const of = str(n.config.of);
      const mine = branches.filter((b) => b.steps.has(n.id));
      if (mine.length === 0 || mine.some((b) => !b.reviews.has(n.id))) warn(t('cogitaEditFlow.mountain.reviewBranch'), n.id);
      else if ((of === '' || of === 'story') && ![...mine[0].mandatory].some((q) => mine.every((b) => b.mandatory.has(q)))) warn(t('cogitaEditFlow.mountain.reviewEmpty'), n.id);
    }
  }
  /* Jeder Zweig prüft: eine Pflichtfrage oder ein Przegląd auf jedem seiner Wege. */
  for (const b of branches) {
    if (b.mandatory.size > 0 || b.reviews.size > 0 || b.explores.size > 0) continue;
    warn(forked ? t('cogitaEditFlow.mountain.noAssessmentBranch', { route: routeName(flow, b.picks) }) : t('cogitaEditFlow.mountain.noAssessment'));
  }

  /* Jeder Weg: kommt an ein Ende, bereitet jede Pflichtfrage vor, die auf ihm liegt (die eines anderen Zweiges nicht). */
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
    for (const p of prep) if (r.steps.has(p.step) && !p.ways.some((w) => taught.has(w))) warn(t('cogitaEditFlow.mountain.notCovered', { route: name, name: ctx.label(p.id) }), p.step);
  }
  return out;
}
