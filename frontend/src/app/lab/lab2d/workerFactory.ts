/**
 * LABOR 2D (v2) — der Arbeiter der Engine. Vite bündelt ihn an dieser Stelle
 * (ein Modul-Arbeiter, wie `cogita/python.worker.ts`); der Prüfstand ohne Vite
 * ersetzt diese Datei durch eine eigene.
 */

export function createLabWorker(): Worker {
  return new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
}

/** Der Arbeiter des beschleunigten Wegs (WebGPU, gpu.worker.ts). */
export function createGpuWorker(): Worker {
  return new Worker(new URL('./gpu.worker.ts', import.meta.url), { type: 'module' });
}
