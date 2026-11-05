/**
 * 2026-11-03 — DER KRAJOBRAZ IM WORKER: Graph (einmal je Baza und Widok), Höhen (nach jeder Antwort — die Bitmengen
 * bleiben), Gestalt. Die Ansicht schickt nur, was sich geändert hat (`landscapeClient.ts`); rein gerechnet wird in
 * `landscape.ts`. 2026-11-04 (Prompt 11): dazu der Stand je Knoten (`stand`) und die Gebiete (`regions`, einmal je
 * Baza: gemerkt, solange dieselben Themen und Wünsche des Besitzers kommen).
 */

import { LandscapeEngine, type LsInput, type LsOptions, type LsState } from './landscape';
import { landscapeWords } from './landscapeWords';
import type { Lang } from './lang';
import { buildRegions, type RegionGraphInput, type RegionOverrides, type RegionTree } from './regions';
import { worldLayout, type WorldLayout } from './worldLayout';

type Request =
  | { readonly id: number; readonly type: 'run'; readonly input?: LsInput; readonly state?: LsState; readonly options: LsOptions }
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
        const words = landscapeWords(msg.lang);
        regionsKept = { key: msg.key, tree: buildRegions(msg.graph, { around: msg.around === undefined ? words.around : (label: string) => msg.around!.replace('{label}', label), ...(msg.overrides === undefined ? {} : { overrides: msg.overrides }), ...(msg.previous === undefined ? {} : { previous: msg.previous }) }) };
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
        const words = landscapeWords(msg.lang);
        const tree = buildRegions(msg.graph, { around: msg.around === undefined ? words.around : (label: string) => msg.around!.replace('{label}', label), ...(msg.overrides === undefined ? {} : { overrides: msg.overrides }), ...(msg.previous === undefined ? {} : { previous: msg.previous }) });
        regionsKept = { key: msg.key, tree };
      }
      self.postMessage({ id: msg.id, ok: true, result: regionsKept.tree });
      return;
    }
    if (msg.input !== undefined) engine.setInput(msg.input);
    if (msg.state !== undefined) engine.setState(msg.state);
    if (msg.type === 'stand') {
      self.postMessage({ id: msg.id, ok: true, result: engine.stand() });
      return;
    }
    self.postMessage({ id: msg.id, ok: true, result: engine.layout(msg.options) });
  } catch (e) {
    self.postMessage({ id: msg.id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
