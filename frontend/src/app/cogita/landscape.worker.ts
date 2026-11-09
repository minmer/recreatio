/**
 * 2026-11-03 — DER KRAJOBRAZ IM WORKER: Graph (einmal je Baza und Widok), Höhen (nach jeder Antwort — die Bitmengen
 * bleiben), Gestalt. Die Ansicht schickt nur, was sich geändert hat (`landscapeClient.ts`); rein gerechnet wird in
 * `landscape.ts`. 2026-11-04 (Prompt 11): dazu der Stand je Knoten (`stand`) und die Gebiete (`regions`, einmal je
 * Baza: gemerkt, solange dieselben Themen und Wünsche des Besitzers kommen).
 * 2026-11-09 (Weltkarte, Korrektur 6) — ohne Wörterbücher: das Muster „Wokół: {label}" schickt der Hauptfaden immer mit
 * (`landscapeClient.ts`). Vorher zog `landscapeWords` `core/i18n.tsx` herein, und im Entwicklungsserver brach der Worker an
 * react-refresh (`window`). Die alte Gestalt je Fokus (`run`) ist entfernt (Entscheidung 2): niemand fragte sie mehr.
 */

/** Ohne Muster aus dem Hauptfaden: der Name selbst. */
const aroundOf = (pattern: string | undefined) => (label: string): string => (pattern === undefined ? label : pattern.replace('{label}', label));

import { LandscapeEngine, type LsInput, type LsState } from './landscape';
import type { Lang } from './lang';
import { buildRegions, type RegionGraphInput, type RegionOverrides, type RegionTree } from './regions';
import { worldLayout, type WorldLayout } from './worldLayout';

type Request =
  | { readonly id: number; readonly type: 'stand'; readonly input?: LsInput; readonly state?: LsState }
  | { readonly id: number; readonly type: 'route'; readonly target: string }
  | { readonly id: number; readonly type: 'world'; readonly key: string; readonly graph: RegionGraphInput; readonly lang: Lang; readonly around?: string; readonly overrides?: RegionOverrides; readonly previous?: Readonly<Record<string, readonly string[]>>; readonly places?: Readonly<Record<string, readonly [number, number]>> }
  | { readonly id: number; readonly type: 'regions'; readonly key: string; readonly graph: RegionGraphInput; readonly lang: Lang; readonly around?: string; readonly overrides?: RegionOverrides; readonly previous?: Readonly<Record<string, readonly string[]>> };

const engine = new LandscapeEngine();
let regionsKept: { key: string; tree: RegionTree } | null = null;
/* 2026-11-04 (Prompt 13) — die eine Landschaft: einmal je Baza (dieselben Gebiete: dieselben Plätze). */
let worldKept: { key: string; world: WorldLayout } | null = null;

self.addEventListener('message', (event: MessageEvent<Request>) => {
  const msg = event.data;
  try {
    if (msg.type === 'route') {
      self.postMessage({ id: msg.id, ok: true, result: engine.routeTo(msg.target) });
      return;
    }
    if (msg.type === 'world') {
      if (regionsKept === null || regionsKept.key !== msg.key) {
        regionsKept = { key: msg.key, tree: buildRegions(msg.graph, { around: aroundOf(msg.around), ...(msg.overrides === undefined ? {} : { overrides: msg.overrides }), ...(msg.previous === undefined ? {} : { previous: msg.previous }) }) };
      }
      if (worldKept === null || worldKept.key !== msg.key) {
        const n = msg.graph.ids.length;
        const ids = Int32Array.from({ length: n }, (_, i) => i);
        worldKept = { key: msg.key, world: worldLayout(regionsKept.tree, { graph: msg.graph, node: ids, topicOf: ids }, msg.places === undefined ? undefined : new Map(Object.entries(msg.places))) };
      }
      self.postMessage({ id: msg.id, ok: true, result: { tree: regionsKept.tree, world: worldKept.world } });
      return;
    }
    if (msg.type === 'regions') {
      if (regionsKept === null || regionsKept.key !== msg.key) {
        const tree = buildRegions(msg.graph, { around: aroundOf(msg.around), ...(msg.overrides === undefined ? {} : { overrides: msg.overrides }), ...(msg.previous === undefined ? {} : { previous: msg.previous }) });
        regionsKept = { key: msg.key, tree };
      }
      self.postMessage({ id: msg.id, ok: true, result: regionsKept.tree });
      return;
    }
    /* Der Stand je Knoten (`stand`). */
    if (msg.input !== undefined) engine.setInput(msg.input);
    if (msg.state !== undefined) engine.setState(msg.state);
    self.postMessage({ id: msg.id, ok: true, result: engine.stand() });
  } catch (e) {
    self.postMessage({ id: msg.id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
