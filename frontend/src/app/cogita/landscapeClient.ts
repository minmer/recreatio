/**
 * 2026-11-03 — DER WEG ZUM MOTOR DES KRAJOBRAZ: im Worker (`landscape.worker.ts`), wo es einen gibt — sonst (Prüfungen,
 * ein Browser ohne Module-Worker) derselbe Motor im Hauptfaden. Die Ansicht schickt den Graphen nur, wenn er neu ist,
 * den Stand nach jeder Antwort, die Gestalt bei jedem Fokus; veraltete Antworten verwirft sie selbst.
 */

import { LandscapeEngine, type LsInput, type LsOptions, type LsRun, type LsState } from './landscape';

export interface LandscapeClient {
  run(request: { readonly input?: LsInput; readonly state?: LsState; readonly options: LsOptions }): Promise<LsRun>;
  route(target: string): Promise<ReturnType<LandscapeEngine['routeTo']>>;
  dispose(): void;
  /** Rechnet ein Worker (sonst der Hauptfaden). */
  readonly inWorker: boolean;
}

type Factory = () => Worker;

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
  return {
    inWorker: false,
    run: async ({ input, state, options }) => {
      if (input !== undefined) engine.setInput(input);
      if (state !== undefined) engine.setState(state);
      return engine.layout(options);
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
    if (event.data.ok) w.resolve(event.data.result); else w.reject(new Error(event.data.error ?? 'Krajobraz: błąd obliczeń.'));
  };
  worker.onerror = () => {
    broken = true;
    for (const w of waiting.values()) w.reject(new Error('Krajobraz: worker przestał działać.'));
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
  return {
    inWorker: true,
    run: async ({ input, state, options }) => {
      if (input !== undefined) lastInput = input;
      if (state !== undefined) lastState = state;
      if (broken) return viaFallback().run({ ...(lastInput === undefined ? {} : { input: lastInput }), ...(lastState === undefined ? {} : { state: lastState }), options });
      return ask<LsRun>({ type: 'run', input, state, options });
    },
    route: (target) => (broken ? viaFallback().route(target) : ask({ type: 'route', target })),
    dispose: () => { worker.terminate(); waiting.clear(); }
  };
}
