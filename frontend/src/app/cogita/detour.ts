/**
 * 2026-11-04 (Prompt 13) — ABSTECHER IN EINE ANDERE ERZÄHLUNG („Chcesz wiedzieć więcej?"). Erzählungen stehen als Leiter:
 * eine allgemeine („Kim jest ksiądz Bosko?"), darunter Überblicke je Etappe, darunter tiefere Erzählungen. Der Überblick
 * bleibt kurz und bietet an der passenden Stelle einen Schritt `detour` an:
 * <code>
 *   {"type": "detour", "config": {"flow": "@bosko/becchi", "label": "Chcesz wiedzieć więcej: …", "optional": true}}
 *   Ausgänge      „done" — nach dem Ende der anderen Erzählung; „skip" — ausgelassen (nur freiwillig, "optional" ≠ false)
 *   Fortschritt   gehört den Erzählungen, nicht dem Lauf: die andere ist einmal ukończona, wo immer sie zu Ende ging
 *   ausgelassen   hält nichts auf (weder das Ende der rufenden noch, was danach kommt) und zählt auf der Ścieżka als durch;
 *                 „Co dalej" bietet die offenen freiwilligen Abstecher zuerst an
 *   Pflicht       "optional": false — nur „Wejdź"; das Ende der rufenden braucht ihn
 *   Tiefe, Kreis  höchstens 3 Abstecher ineinander (`DETOUR_DEPTH`); ein Kreis A → B → A wird im Import abgelehnt und im
 *                 Editor genannt — beide beim Namen
 * </code>
 * Rein; der Lauf steht in `runningStory.ts`, die Prüfung im Import (`json.ts`) und im Editor (`FlowEditor.tsx`),
 * nachgemessen in `scripts/app-detour-check.mjs`.
 */

import { t } from '../core/i18n';
import { DETOUR_DEPTH, type Flow } from './flow';
import type { GraphNode } from './graph';

export interface DetourConfig {
  /** Die andere Erzählung (Kennung oder @bleibender Name). */
  readonly flow: string;
  /** Wie der Abstecher angeboten wird („Chcesz wiedzieć więcej: …"); leer: der Spieler sagt es selbst. */
  readonly label: string;
  /** Freiwillig (Vorgabe) — `false` (oder `"required": true`, so setzt es der Editor): nur „Wejdź", das Ende braucht ihn. */
  readonly optional: boolean;
  /**
   * 2026-11-05 (Prompt 24) — in eine Erzählung einer ANDEREN Baza ("flow": "@@historia:@historia/f/rewolucja", `worlds.ts`):
   * immer freiwillig (ein "optional": false gilt dort nicht), nie in Kreisen, Tiefe oder Ścieżka dieser Baza gerechnet.
   */
  readonly cross?: true;
}

/** 2026-11-05 (Prompt 24) — ein Verweis in eine andere Baza ("@@name:…") — dieselbe Form wie `worlds.ts` `crossOf`. */
export const isCrossFlow = (ref: string): boolean => /^@@[a-z0-9][a-z0-9_-]{0,39}:\S/i.test(ref.trim());

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function detourOf(node: Pick<GraphNode, 'type' | 'config'>): DetourConfig | null {
  if (node.type !== 'detour') return null;
  const flow = str(node.config.flow);
  if (isCrossFlow(flow)) return { flow, label: str(node.config.label), optional: true, cross: true };
  return { flow, label: str(node.config.label), optional: node.config.optional !== false && node.config.required !== true };
}

/** Die Abstecher eines Ablaufs, in der Reihenfolge seiner Schritte. */
export const detoursIn = (flow: Pick<Flow, 'graph'>): (DetourConfig & { readonly step: string })[] =>
  flow.graph.nodes.flatMap((n) => { const d = detourOf(n); return d === null ? [] : [{ ...d, step: n.id }]; });

/** Wohin ein Ablauf über Abstecher (und Unterabläufe) geht — für Kreise; `detour`: über einen Abstecher. */
function callsOf(flow: Pick<Flow, 'graph'>, resolve: (ref: string) => string | null): { readonly to: string; readonly detour: boolean }[] {
  const out: { to: string; detour: boolean }[] = [];
  for (const n of flow.graph.nodes) {
    if (n.type !== 'detour' && n.type !== 'subflow') continue;
    const to = resolve(str(n.config.flow));
    if (to !== null) out.push({ to, detour: n.type === 'detour' });
  }
  return out;
}

/**
 * DIE KREISE ÜBER ABSTECHER: je Kreis die Kennungen in der Reihenfolge des Rufens, der erste am Ende noch einmal
 * (A → B → A). Nur Kreise mit mindestens einem Abstecher; jeder Kreis einmal.
 */
export function detourCycles(flows: readonly Pick<Flow, 'id' | 'graph'>[], resolve: (ref: string) => string | null): string[][] {
  const byId = new Map(flows.map((f) => [f.id, f] as const));
  const calls = new Map(flows.map((f) => [f.id, callsOf(f, resolve).filter((c) => byId.has(c.to))] as const));
  const found = new Map<string, string[]>();
  const walk = (path: string[], viaDetour: boolean[]) => {
    const at = path[path.length - 1];
    for (const c of calls.get(at) ?? []) {
      const i = path.indexOf(c.to);
      if (i >= 0) {
        const ring = path.slice(i);
        if (![...viaDetour.slice(i), c.detour].some(Boolean)) continue;
        /* Derselbe Kreis von einem anderen Anfang: einmal (gedreht zum kleinsten). */
        const min = ring.indexOf([...ring].sort()[0]);
        const norm = [...ring.slice(min), ...ring.slice(0, min)];
        const key = norm.join('>');
        if (!found.has(key)) found.set(key, [...ring, c.to]);
        continue;
      }
      if (path.length > 24) continue;
      walk([...path, c.to], [...viaDetour, c.detour]);
    }
  };
  for (const f of flows) walk([f.id], []);
  return [...found.values()];
}

/** Ketten von Abstechern, die tiefer gehen als erlaubt: je Kette die Kennungen (die rufende zuerst). */
export function detourTooDeep(flows: readonly Pick<Flow, 'id' | 'graph'>[], resolve: (ref: string) => string | null, from: string): string[] | null {
  const byId = new Map(flows.map((f) => [f.id, f] as const));
  let deepest: string[] | null = null;
  const walk = (path: string[]) => {
    const f = byId.get(path[path.length - 1]);
    if (f === undefined) return;
    for (const d of detoursIn(f)) {
      const to = resolve(d.flow);
      if (to === null || path.includes(to)) continue;
      const next = [...path, to];
      if (next.length - 1 > DETOUR_DEPTH) { if (deepest === null) deepest = next; return; }
      walk(next);
    }
  };
  walk([from]);
  return deepest;
}

export interface DetourProblem {
  readonly level: 'error' | 'warning';
  readonly text: string;
  readonly step?: string;
}

/**
 * WAS AN DEN ABSTECHERN EINES ABLAUFS NICHT STIMMT (Import und Editor): eine andere Erzählung, die es nicht gibt (Warnung),
 * ein Abstecher in sich selbst oder ein Kreis A → B → A (Fehler — beide beim Namen), mehr als `DETOUR_DEPTH` ineinander
 * (Warnung: der Spieler bietet den tiefsten nicht an). `all`: alle Abläufe (die der Baza und die des Dokuments).
 */
export function detourProblems(flow: Pick<Flow, 'id' | 'name' | 'graph'>, all: readonly Pick<Flow, 'id' | 'name' | 'graph'>[], resolve: (ref: string) => string | null): DetourProblem[] {
  const out: DetourProblem[] = [];
  const list = all.some((f) => f.id === flow.id) ? all.map((f) => (f.id === flow.id ? flow : f)) : [...all, flow];
  const nameOf = (id: string) => t('cogitaLearnLogic.detour.quoted', { name: list.find((f) => f.id === id)?.name ?? id });
  for (const d of detoursIn(flow)) {
    /* 2026-11-05 (Prompt 24) — in eine andere Baza: geprüft beim Import gegen jene (`worldsImport.ts`); hier nur, dass es freiwillig bleibt. */
    if (d.cross === true) {
      const node = flow.graph.nodes.find((n) => n.id === d.step);
      if (node !== undefined && (node.config.optional === false || node.config.required === true)) out.push({ level: 'warning', step: d.step, text: t('cogitaLearnLogic.detour.crossOptional', { flow: d.flow }) });
      continue;
    }
    const to = d.flow === '' ? null : resolve(d.flow);
    if (to === null || !list.some((f) => f.id === to)) {
      out.push({ level: 'warning', step: d.step, text: d.flow === '' ? t('cogitaLearnLogic.detour.noFlow') : t('cogitaLearnLogic.detour.missing', { flow: d.flow }) });
    } else if (to === flow.id) {
      out.push({ level: 'error', step: d.step, text: t('cogitaLearnLogic.detour.self', { name: nameOf(flow.id) }) });
    }
  }
  for (const ring of detourCycles(list, resolve)) {
    if (!ring.includes(flow.id) || ring[0] === ring[1]) continue;
    out.push({ level: 'error', text: t('cogitaLearnLogic.detour.cycle', { ring: ring.map(nameOf).join(' → ') }) });
  }
  const deep = detourTooDeep(list, resolve, flow.id);
  if (deep !== null) out.push({ level: 'warning', text: t('cogitaLearnLogic.detour.deep', { depth: DETOUR_DEPTH, chain: deep.map(nameOf).join(' → ') }) });
  return out;
}

/** Wie ein Abstecher auf der Ścieżka steht: die andere Erzählung ist ukończona; vorbei ohne sie (ausgelassen); offen. */
export type DetourState = 'done' | 'skipped' | 'open';
export function detourState(step: string, visited: ReadonlySet<string>, current: string | null, innerDone: boolean): DetourState {
  if (innerDone) return 'done';
  return visited.has(step) && current !== step ? 'skipped' : 'open';
}

/**
 * Die Pflicht-Abstecher ("optional": false), an denen der Lernende vorbeikam, deren Erzählung aber nicht ukończona ist —
 * solange es sie gibt, ist die rufende Erzählung nicht zu Ende (ein Sprung über die Ścieżka führt sonst daran vorbei).
 */
export function requiredOpen(flow: Pick<Flow, 'graph'>, visited: readonly string[], innerDone: (ref: string) => boolean): string[] {
  const seen = new Set(visited);
  return detoursIn(flow).filter((d) => !d.optional && seen.has(d.step) && !innerDone(d.flow)).map((d) => d.step);
}

/** „Co dalej" nach einer Erzählung: ihre freiwilligen Abstecher, deren Erzählung noch nicht ukończona ist (jede einmal). */
export function openDetours(flow: Pick<Flow, 'graph'>, innerDone: (ref: string) => boolean, resolve: (ref: string) => string | null = (r) => r): (DetourConfig & { readonly step: string; readonly target: string })[] {
  const out: (DetourConfig & { step: string; target: string })[] = [];
  for (const d of detoursIn(flow)) {
    const target = resolve(d.flow);
    if (target === null || !d.optional || innerDone(d.flow) || out.some((x) => x.target === target)) continue;
    out.push({ ...d, target });
  }
  return out;
}
