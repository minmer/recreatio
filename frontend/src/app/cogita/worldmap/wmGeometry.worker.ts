/**
 * 2026-11-09 — DIE GESTALT DER WELTKARTE IM WORKER: Lage und Gleise (`wmGeometry.ts`). Kein `.tsx`, keine Wörterbücher
 * (Entscheidung, Korrektur 6) — im Entwicklungsserver bricht ein Worker sonst an react-refresh (`window`).
 */

import { geometryOf, type GeometryInput } from './wmGeometry';

self.addEventListener('message', (event: MessageEvent<{ readonly id: number; readonly input: GeometryInput }>) => {
  const { id, input } = event.data;
  try {
    self.postMessage({ id, ok: true, result: geometryOf(input) });
  } catch (e) {
    self.postMessage({ id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
