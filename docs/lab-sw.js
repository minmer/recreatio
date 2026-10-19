/*
 * PARTIKEL-LABOR — KOPFZEILEN FÜR DIE KARTE MIT ALLEN KERNEN (lab.html).
 *
 * GitHub Pages kann keine Kopfzeilen setzen. Ohne Cross-Origin-Opener-Policy
 * und Cross-Origin-Embedder-Policy erlaubt kein Browser gemeinsamen Speicher
 * (SharedArrayBuffer), und ohne ihn rechnet die Engine mit einem Faden. Dieser
 * Service Worker gilt nur für lab.html (Bereich ./lab.html): er reicht jede
 * Antwort der Seite und ihrer Arbeiter durch und setzt die drei Kopfzeilen.
 * Die Seite lädt nur Dateien vom eigenen Ursprung; fremde Antworten (die er
 * nicht ändern kann) gibt er unverändert weiter.
 *
 * documentation/particles/ARCHITECTURE.md §8.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  event.respondWith(
    fetch(request).then((response) => {
      if (response.status === 0) return response;
      const headers = new Headers(response.headers);
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      headers.set('Cross-Origin-Resource-Policy', 'same-origin');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    })
  );
});
