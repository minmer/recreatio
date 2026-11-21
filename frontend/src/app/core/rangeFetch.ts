/**
 * 2026-11-21 — EINE GROSSE DATEI IN STÜCKEN HOLEN (HTTP Range), jedes Stück mit
 * eigenen Wiederholungen. Ein Film von 60 MB über Mobilfunk riss vorher als Ganzes
 * ab — ein einziger Aussetzer, und alles war verloren. Jetzt holt ein Aussetzer nur
 * sein Stück noch einmal; ist das Netz fort, wird gewartet, bis es wieder da ist.
 *
 * Ein Dienst ohne Range antwortet 200 mit der ganzen Datei — dann ist sie eben ganz da.
 */

/** Wie gross ein Stück beim Holen ist. */
export const RANGE_PIECE = 4 * 1024 * 1024;

const TRIES = 6;

/** Eine Antwort, die nicht wiederholt wird (404, 410, 403 …) — der Aufrufer macht daraus seinen Fehler. */
export class RangeRefused extends Error {
  constructor(readonly response: Response) {
    super(`HTTP ${response.status}`);
  }
}

/** Das Netz kam nach allen Versuchen nicht durch. */
export class RangeOffline extends Error {
  constructor() {
    super('offline');
  }
}

const pause = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted === true) { reject(new DOMException('Aborted', 'AbortError')); return; }
  const timer = setTimeout(done, ms);
  function done() { signal?.removeEventListener('abort', stop); window.removeEventListener('online', done); clearTimeout(timer); resolve(); }
  function stop() { clearTimeout(timer); window.removeEventListener('online', done); reject(new DOMException('Aborted', 'AbortError')); }
  signal?.addEventListener('abort', stop, { once: true });
  /* Kommt das Netz zurück, sofort weiter. */
  window.addEventListener('online', done, { once: true });
});

/**
 * Ein Stück `[from, from + length)` — mit Wiederholungen. `whole`: der Dienst gab die
 * ganze Datei (kein Range); `bytes` ist dann alles.
 */
export async function fetchRange(
  url: string, from: number, length: number,
  options: { readonly credentials?: RequestCredentials; readonly signal?: AbortSignal; readonly onBytes?: (n: number) => void } = {}
): Promise<{ bytes: Uint8Array; whole: boolean; end: boolean }> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < TRIES; attempt++) {
    if (attempt > 0) await pause(Math.min(30_000, 1000 * 2 ** (attempt - 1)), options.signal);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) await pause(30_000, options.signal);
    let got = 0;
    try {
      const response = await fetch(url, {
        credentials: options.credentials ?? 'omit',
        headers: { Range: `bytes=${from}-${from + length - 1}` },
        signal: options.signal,
        cache: 'no-store'
      });
      if (response.status === 416) return { bytes: new Uint8Array(0), whole: false, end: true };
      if (!response.ok) {
        if (response.status >= 500 || response.status === 408 || response.status === 429) { lastError = new RangeRefused(response); continue; }
        throw new RangeRefused(response);
      }
      const whole = response.status === 200;
      const reader = response.body?.getReader();
      let bytes: Uint8Array;
      if (reader === undefined) {
        bytes = new Uint8Array(await response.arrayBuffer());
        options.onBytes?.(bytes.length);
        got = bytes.length;
      } else {
        const chunks: Uint8Array[] = [];
        for (;;) {
          const step = await reader.read();
          if (step.done) break;
          chunks.push(step.value);
          got += step.value.length;
          options.onBytes?.(step.value.length);
        }
        bytes = join(chunks, got);
      }
      if (!whole && bytes.length > length) throw new RangeRefused(response);
      return { bytes, whole, end: whole || bytes.length < length };
    } catch (e) {
      if (e instanceof RangeRefused) throw e;
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      /* Was dieser Versuch schon zählte, zählt der nächste noch einmal. */
      if (got > 0) options.onBytes?.(-got);
      lastError = e;
    }
  }
  if (lastError instanceof RangeRefused) throw lastError;
  throw new RangeOffline();
}

/** Die ganze Datei, Stück für Stück. `onProgress(done)` in Bytes. */
export async function fetchRanged(
  url: string,
  options: { readonly credentials?: RequestCredentials; readonly signal?: AbortSignal; readonly onProgress?: (done: number) => void; readonly piece?: number } = {}
): Promise<Uint8Array> {
  const piece = options.piece ?? RANGE_PIECE;
  const chunks: Uint8Array[] = [];
  let done = 0;
  const onBytes = (n: number) => { done += n; options.onProgress?.(done); };
  for (let at = 0; ;) {
    const step = await fetchRange(url, at, piece, { credentials: options.credentials, signal: options.signal, onBytes });
    if (step.whole) return step.bytes;
    chunks.push(step.bytes);
    at += step.bytes.length;
    if (step.end) break;
  }
  return join(chunks, chunks.reduce((n, c) => n + c.length, 0));
}

function join(chunks: readonly Uint8Array[], total: number): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}
