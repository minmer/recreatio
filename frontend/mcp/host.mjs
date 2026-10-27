/**
 * 2026-10-27 — WO DIE VORSCHAU LÄUFT: ein kleiner Dienst auf 127.0.0.1.
 *
 * <code>
 *   source   die Quellen des Arbeitsbaums (frontend/src), über Vite — was gleich gebaut würde
 *   site     der gebaute Auftritt in docs/ — was auf recreatio.pl steht, sobald es gepusht ist
 *   dist     ein Bau in frontend/dist (npm run build)
 *   https:// eine Vorschau, die schon im Netz steht (…/preview.html) — dann braucht es diesen Dienst nicht
 * </code>
 *
 * Unter `/api/` reicht er an den echten Dienst weiter — NUR lesend (GET, HEAD),
 * ohne Kekse: öffentliche Kalender, Messen, Bilder der Seiten. Alles, was
 * schreibt, lehnt er ab (die Seite selbst lehnt es schon vorher ab,
 * `previewFetch.ts`). Unter `/__preview/doc/<id>` liegen die Dokumente, die ein
 * Mensch im Browser öffnen kann (der Link im Bericht).
 */

import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
  '.xpi': 'application/x-xpinstall', '.map': 'application/json'
};

/** Kopfzeilen, die vom Dienst zurück zur Seite gehen. */
const PASS_BACK = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag', 'last-modified', 'content-disposition'];

async function proxyApi(req, res, api) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Podgląd niczego nie zapisuje.' }));
    return;
  }
  if (api === null) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Podgląd bez danych na żywo.' }));
    return;
  }
  const target = `${api}${req.url.slice('/api'.length) || '/'}`;
  try {
    const headers = { Accept: req.headers.accept ?? '*/*' };
    if (req.headers.range) headers.Range = req.headers.range;
    const answer = await fetch(target, { method: req.method, headers, redirect: 'follow' });
    const out = {};
    for (const name of PASS_BACK) {
      const value = answer.headers.get(name);
      if (value !== null) out[name] = value;
    }
    res.writeHead(answer.status, out);
    if (req.method === 'HEAD' || answer.body === null) { res.end(); return; }
    res.end(Buffer.from(await answer.arrayBuffer()));
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Usługa nie odpowiada (${e instanceof Error ? e.message : 'błąd'}).` }));
  }
}

async function serveStatic(req, res, dir) {
  const url = new URL(req.url, 'http://local');
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(dir, path));
  if (!file.startsWith(resolve(dir) + sep) && file !== resolve(dir)) { res.writeHead(403); res.end(); return; }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('no file');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

/** Vite aus frontend/node_modules — mit derselben Grundgestalt wie vite.config.ts, aber ohne dessen Weiterleitung. */
async function startVite(frontend, log) {
  /* Aufgelöst von hier aus: frontend/node_modules. */
  const { createServer: createVite } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;
  const quiet = (level) => (message) => { if (level !== 'info') log(`vite ${level}: ${String(message).slice(0, 400)}`); };
  const logger = {
    hasWarned: false,
    info: quiet('info'), warn: quiet('warn'), warnOnce: quiet('warn'), error: quiet('error'),
    clearScreen: () => {}, hasErrorLogged: () => false
  };
  return createVite({
    root: frontend,
    configFile: false,
    plugins: [react()],
    worker: { format: 'es' },
    appType: 'mpa',
    /* Ein eigener Vorrat: ein `npm run dev` daneben teilt ihn nicht. */
    cacheDir: join(frontend, 'node_modules', '.vite-preview'),
    customLogger: logger,
    clearScreen: false,
    server: { middlewareMode: true, hmr: false, watch: { ignored: ['**/android/**', '**/dist/**', '**/android-out/**', '**/node_modules/**'] } }
  });
}

export async function startHost({ renderer, frontend, repo, api, log = () => {} }) {
  let vite = null;
  let dir = null;
  if (renderer === 'source') vite = await startVite(frontend, log);
  else if (renderer === 'site') dir = join(repo, 'docs');
  else if (renderer === 'dist') dir = join(frontend, 'dist');
  else throw new Error(`Unknown renderer "${renderer}" — source, site, dist or an https:// address of preview.html.`);
  if (dir !== null && !existsSync(join(dir, 'preview.html'))) {
    throw new Error(`${dir} has no preview.html — build the site again (deploy-web.bat, or npm run build for dist), or use the renderer "source".`);
  }

  const docs = new Map();
  const server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/api' || path.startsWith('/api/')) { void proxyApi(req, res, api); return; }
    if (path.startsWith('/__preview/doc/')) {
      const doc = docs.get(decodeURIComponent(path.slice('/__preview/doc/'.length)));
      res.writeHead(doc === undefined ? 404 : 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(doc === undefined ? JSON.stringify({ error: 'Nie ma takiego podglądu (serwer podglądu został uruchomiony ponownie?).' }) : doc);
      return;
    }
    if (vite !== null) {
      vite.middlewares(req, res, () => { res.writeHead(404); res.end('Not found'); });
      return;
    }
    void serveStatic(req, res, dir);
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    /** Ein Dokument für den Link im Bericht — die letzten 30 bleiben. */
    keep(id, body) {
      docs.set(id, JSON.stringify(body));
      while (docs.size > 30) docs.delete(docs.keys().next().value);
    },
    async close() {
      await new Promise((done) => server.close(() => done()));
      if (vite !== null) await vite.close();
    }
  };
}
