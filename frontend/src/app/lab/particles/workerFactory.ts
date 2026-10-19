/**
 * PARTIKEL-LABOR — die Arbeiter der Engine. Vite bündelt sie an dieser Stelle
 * (Modul-Arbeiter, wie `cogita/python.worker.ts`). Die Karte mit allen Kernen
 * (`lab.html`) legt sie anders an — aus einem Blob (`src/lab.tsx`): eine Seite,
 * die „cross-origin isolated“ ist, lässt nur Arbeiter zu, die ihre Kopfzeilen
 * teilen, und eine Datei unter /assets/ erreicht ihr Service Worker nicht. Der
 * Prüfstand ohne Vite ersetzt diese Datei durch eine eigene.
 */

export function createEngineWorker(): Worker {
  return new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
}

/** Ein Helfer, der auf gemeinsamem Speicher mitrechnet (nur in einer Seite, die „cross-origin isolated“ ist). */
export function createHelperWorker(): Worker {
  return new Worker(new URL('./helper.worker.ts', import.meta.url), { type: 'module' });
}
