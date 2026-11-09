/**
 * 2026-11-09 — DER WEG ZUR GESTALT: im Worker, wo es einen gibt (sonst im Hauptfaden), und gemerkt in diesem Browser je
 * Fassung der Welt (IndexedDB, Ablage `library`, Schlüssel `wm-geo:<fassung>` — sie geht mit dem Abmelden weg). Dieselbe
 * Fassung: dieselbe Gestalt, nichts wird gerechnet.
 */

import { idbGet, idbPut } from '../../core/idb';
import { geometryOf, geometryVersion, type Geometry, type GeometryInput } from './wmGeometry';

type Factory = () => Worker;
let factory: Factory | null | undefined;

/** Für Prüfungen und Werkbänke: woher der Worker kommt — `null`: keiner (der Hauptfaden). */
export function setGeometryWorker(make: Factory | null): void { factory = make; }

function makeWorker(): Worker | null {
  try {
    if (factory === null) return null;
    if (factory !== undefined) return factory();
    if (typeof Worker === 'undefined') return null;
    return new Worker(new URL('./wmGeometry.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

let worker: Worker | null | undefined;
let next = 1;
const waiting = new Map<number, { resolve: (g: Geometry) => void; reject: (e: Error) => void }>();

function viaWorker(input: GeometryInput): Promise<Geometry> {
  if (worker === undefined) {
    worker = makeWorker();
    worker?.addEventListener('message', (e: MessageEvent<{ id: number; ok: boolean; result?: Geometry; error?: string }>) => {
      const w = waiting.get(e.data.id);
      if (w === undefined) return;
      waiting.delete(e.data.id);
      if (e.data.ok && e.data.result !== undefined) w.resolve(e.data.result); else w.reject(new Error(e.data.error ?? 'geometry'));
    });
    worker?.addEventListener('error', () => {
      /* Ein kaputter Worker: alles Wartende im Hauptfaden, und künftig auch. */
      for (const [id, w] of waiting) { waiting.delete(id); w.reject(new Error('worker')); }
      worker = null;
    });
  }
  if (worker === null) return Promise.resolve(geometryOf(input));
  const id = next;
  next += 1;
  return new Promise<Geometry>((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    worker!.postMessage({ id, input });
  }).catch(() => geometryOf(input));
}

const MEMORY = new Map<string, Geometry>();

/** Die Gestalt dieser Fassung: aus dem Gedächtnis, aus diesem Browser, sonst gerechnet (und gemerkt). */
export async function geometryFor(input: GeometryInput): Promise<Geometry> {
  const version = geometryVersion(input);
  const had = MEMORY.get(version);
  if (had !== undefined) return had;
  const kept = await idbGet<Geometry>('library', `wm-geo:${version}`).catch(() => null);
  if (kept !== null && kept.version === version) { MEMORY.set(version, kept); return kept; }
  const made = await viaWorker(input);
  MEMORY.set(version, made);
  void idbPut('library', `wm-geo:${version}`, made).catch(() => false);
  return made;
}
