/**
 * 2026-11-03 — DER WEG ZUM MOTOR DES KRAJOBRAZ: im Worker (`landscape.worker.ts`), wo es einen gibt — sonst (Prüfungen,
 * ein Browser ohne Module-Worker) derselbe Motor im Hauptfaden. Die Ansicht schickt den Graphen nur, wenn er neu ist,
 * den Stand nach jeder Antwort, die Gestalt bei jedem Fokus; veraltete Antworten verwirft sie selbst.
 * 2026-11-04 (Prompt 11): `stand` (der Stand je Knoten ohne Gestalt) und `regions` (die Gebiete, einmal je Baza).
 */

import { LandscapeEngine, type LsInput, type LsOptions, type LsRun, type LsStand, type LsState } from './landscape';
import type { Lang } from './lang';
import { landscapeWords } from './landscapeWords';
import { t } from '../core/i18n';
import { buildRegions, type RegionGraphInput, type RegionOverrides, type RegionTree } from './regions';
import { worldLayout, type WorldLayout } from './worldLayout';

export interface RegionRequest {
  /** Was die Gebiete bestimmt (dieselben Themen, Kanten und Wünsche: dieselbe Antwort, ohne neu zu rechnen). */
  readonly key: string;
  readonly graph: RegionGraphInput;
  readonly lang: Lang;
  readonly overrides?: RegionOverrides;
  readonly previous?: Readonly<Record<string, readonly string[]>>;
  /** 2026-11-04 (Prompt 15) — die gespeicherten Plätze (Thema → [q, r]): gelten sie für alle Themen, wird nichts gerechnet. */
  readonly places?: Readonly<Record<string, readonly [number, number]>>;
}

export interface LandscapeClient {
  run(request: { readonly input?: LsInput; readonly state?: LsState; readonly options: LsOptions }): Promise<LsRun>;
  stand(request: { readonly input?: LsInput; readonly state?: LsState }): Promise<LsStand>;
  regions(request: RegionRequest): Promise<RegionTree>;
  /** 2026-11-04 (Prompt 13) — die Gebiete und die eine Landschaft (feste Plätze aller Themen). */
  world(request: RegionRequest): Promise<{ tree: RegionTree; world: WorldLayout }>;
  route(target: string): Promise<ReturnType<LandscapeEngine['routeTo']>>;
  dispose(): void;
  /** Rechnet ein Worker (sonst der Hauptfaden). */
  readonly inWorker: boolean;
}

type Factory = () => Worker;

/* Der Worker hat keine Wörterbücher: das Muster „Wokół: {label}“ kommt aus dem Hauptfaden mit. */
const aroundOf = (lang: Lang): string => landscapeWords(lang).around('{label}');

let factory: Factory | null | undefined;

/** Für Prüfungen und Werkbänke: woher der Worker kommt — `null`: keiner (der Hauptfaden). */
export function setLandscapeWorker(make: Factory | null): void { factory = make; }

function makeWorker(): Worker | null {
  try {
    if (factory === null) return null;
    if (factory !== undefined) return factory();
    if (typeof Worker === 'undefined') return null;
    return new Worker(new URL('./landscape.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

function mainThread(): LandscapeClient {
  const engine = new LandscapeEngine();
  let kept: { key: string; tree: RegionTree } | null = null;
  return {
    inWorker: false,
    run: async ({ input, state, options }) => {
      if (input !== undefined) engine.setInput(input);
      if (state !== undefined) engine.setState(state);
      return engine.layout(options);
    },
    stand: async ({ input, state }) => {
      if (input !== undefined) engine.setInput(input);
      if (state !== undefined) engine.setState(state);
      return engine.stand();
    },
    regions: async (r) => {
      if (kept === null || kept.key !== r.key) {
        const tree = buildRegions(r.graph, { around: landscapeWords(r.lang).around, ...(r.overrides === undefined ? {} : { overrides: r.overrides }), ...(r.previous === undefined ? {} : { previous: r.previous }) });
        kept = { key: r.key, tree };
      }
      return kept.tree;
    },
    world: async (r) => {
      if (kept === null || kept.key !== r.key) {
        const tree = buildRegions(r.graph, { around: landscapeWords(r.lang).around, ...(r.overrides === undefined ? {} : { overrides: r.overrides }), ...(r.previous === undefined ? {} : { previous: r.previous }) });
        kept = { key: r.key, tree };
      }
      const ids = Int32Array.from({ length: r.graph.ids.length }, (_, i) => i);
      return { tree: kept.tree, world: worldLayout(kept.tree, { graph: r.graph, node: ids, topicOf: ids }, r.places === undefined ? undefined : new Map(Object.entries(r.places))) };
    },
    route: async (target) => engine.routeTo(target),
    dispose: () => undefined
  };
}

export function landscapeClient(): LandscapeClient {
  const worker = makeWorker();
  if (worker === null) return mainThread();
  let next = 1;
  const waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  let broken = false;
  let fallback: LandscapeClient | null = null;
  /* Was der Worker zuletzt bekam — fällt er aus, bekommt der Hauptfaden dasselbe noch einmal. */
  let lastInput: LsInput | undefined;
  let lastState: LsState | undefined;
  worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
    const w = waiting.get(event.data.id);
    if (w === undefined) return;
    waiting.delete(event.data.id);
    if (event.data.ok) w.resolve(event.data.result); else w.reject(new Error(event.data.error ?? t('cogitaLearn.landscapeClient.failed')));
  };
  worker.onerror = () => {
    broken = true;
    for (const w of waiting.values()) w.reject(new Error(t('cogitaLearn.landscapeClient.workerDied')));
    waiting.clear();
  };
  const ask = <T>(message: Record<string, unknown>): Promise<T> => new Promise<T>((resolve, reject) => {
    const id = next++;
    waiting.set(id, { resolve: resolve as (v: unknown) => void, reject });
    worker.postMessage({ ...message, id });
  });
  const viaFallback = (): LandscapeClient => {
    if (fallback === null) fallback = mainThread();
    return fallback;
  };
  const again = () => ({ ...(lastInput === undefined ? {} : { input: lastInput }), ...(lastState === undefined ? {} : { state: lastState }) });
  return {
    inWorker: true,
    run: async ({ input, state, options }) => {
      if (input !== undefined) lastInput = input;
      if (state !== undefined) lastState = state;
      if (broken) return viaFallback().run({ ...again(), options });
      return ask<LsRun>({ type: 'run', input, state, options });
    },
    stand: async ({ input, state }) => {
      if (input !== undefined) lastInput = input;
      if (state !== undefined) lastState = state;
      if (broken) return viaFallback().stand(again());
      return ask<LsStand>({ type: 'stand', input, state });
    },
    regions: (r) => (broken ? viaFallback().regions(r) : ask<RegionTree>({ type: 'regions', ...r, around: aroundOf(r.lang) })),
    world: (r) => (broken ? viaFallback().world(r) : ask<{ tree: RegionTree; world: WorldLayout }>({ type: 'world', ...r, around: aroundOf(r.lang) })),
    route: (target) => (broken ? viaFallback().route(target) : ask({ type: 'route', target })),
    dispose: () => { worker.terminate(); waiting.clear(); }
  };
}
