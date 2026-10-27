/**
 * 2026-10-27 — DIE VORSCHAU SPRICHT MIT DEM DIENST NUR LESEND.
 *
 * Die öffentliche Seite holt sich, was sie zeigt, selbst (`call` in
 * `core/session.ts`). In der Vorschau steht dazwischen dieses Stück:
 *
 * <code>
 *   GET /page/<pfad der vorschau>   die Seite nach dem Import (previewDoc.ts) — sie gibt es beim Dienst nicht
 *   GET /session                    niemand angemeldet: die Seite, wie ein Besucher sie sieht
 *   GET alles andere                an den Dienst (öffentliche Daten: Kalender, Messen …) — oder, ohne
 *                                   „dane na żywo", „nicht da"
 *   alles, was schreibt             abgelehnt: die Vorschau ändert nichts, nirgends
 * </code>
 *
 * Jede Anfrage wird mitgeschrieben (der Bericht nennt sie), und die Vorschau
 * weiss, wann keine mehr unterwegs ist (`quiet`).
 */

export interface FetchEntry {
  readonly method: string;
  /** Der Pfad beim Dienst (ohne seine Adresse), oder die ganze Adresse ausserhalb. */
  readonly path: string;
  readonly status: number;
  readonly ms: number;
  /** `preview` — von der Vorschau beantwortet; `live` — vom Dienst; `blocked` — abgelehnt; `offline` — ohne Daten. */
  readonly via: 'preview' | 'live' | 'blocked' | 'offline' | 'outside';
}

export interface PreviewFetch {
  readonly log: () => readonly FetchEntry[];
  readonly pending: () => number;
  /** Wann zuletzt eine Antwort kam (performance.now). */
  readonly lastAt: () => number;
  /** Die Seite, die `GET /page/<pfad>` liefert — neu gesetzt bei jedem Dokument. */
  readonly serve: (path: string, body: unknown) => void;
  readonly setLive: (live: boolean) => void;
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Ein Pfad, wie ihn `loadPage` schreibt: jeder Teil für sich kodiert. */
const decodePath = (path: string): string => path.split('/').map((one) => {
  try { return decodeURIComponent(one); } catch { return one; }
}).join('/');

export function installPreviewFetch(api: string): PreviewFetch {
  const real = window.fetch.bind(window);
  const base = new URL(api, window.location.href).href.replace(/\/+$/, '');
  const log: FetchEntry[] = [];
  let pending = 0;
  let lastAt = performance.now();
  let live = true;
  let page: { path: string; body: unknown } | null = null;

  const done = (entry: FetchEntry): void => {
    log.push(entry);
    if (log.length > 400) log.shift();
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const absolute = new URL(url, window.location.href).href;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const started = performance.now();
    const inside = absolute === base || absolute.startsWith(`${base}/`);
    const path = inside ? absolute.slice(base.length) || '/' : absolute;
    const bare = path.split('?')[0];

    const answer = (status: number, body: unknown, via: FetchEntry['via']): Response => {
      done({ method, path, status, ms: Math.round(performance.now() - started), via });
      lastAt = performance.now();
      return json(status, body);
    };

    if (!inside) {
      /* Schriften, Kacheln einer Karte, ein Bild von woanders: wie auf der Seite. */
      pending += 1;
      try {
        const response = await real(input, init);
        done({ method, path, status: response.status, ms: Math.round(performance.now() - started), via: 'outside' });
        return response;
      } finally {
        pending -= 1;
        lastAt = performance.now();
      }
    }

    if (method !== 'GET' && method !== 'HEAD') {
      return answer(403, { error: 'Podgląd niczego nie zapisuje.', verdict: 'preview' }, 'blocked');
    }
    if (bare === '/session') return answer(401, { error: 'Nikt nie jest zalogowany (podgląd).' }, 'preview');
    if (bare.startsWith('/page/')) {
      const wanted = decodePath(bare.slice('/page/'.length));
      if (page !== null && wanted === page.path) return answer(200, page.body, 'preview');
    }
    if (!live) return answer(404, { error: 'Podgląd bez danych na żywo.' }, 'offline');

    pending += 1;
    try {
      /* Ohne Keks: die Vorschau ist niemand. */
      const response = await real(input, { ...init, credentials: 'omit' });
      done({ method, path, status: response.status, ms: Math.round(performance.now() - started), via: 'live' });
      return response;
    } catch (e) {
      done({ method, path, status: 0, ms: Math.round(performance.now() - started), via: 'live' });
      throw e;
    } finally {
      pending -= 1;
      lastAt = performance.now();
    }
  };

  /* Ein Beacon schreibt — auch der nicht. */
  if (typeof navigator.sendBeacon === 'function') navigator.sendBeacon = () => true;

  return {
    log: () => [...log],
    pending: () => pending,
    lastAt: () => lastAt,
    serve: (path, body) => { page = { path, body }; },
    setLive: (on) => { live = on; }
  };
}
