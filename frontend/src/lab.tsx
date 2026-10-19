/**
 * 2026-10-19 — DER EINSTIEG DER KARTE MIT ALLEN KERNEN (`lab.html`): das
 * Partikel-Labor im ganzen Fenster, sonst nichts von der Seite.
 *
 * Zuerst die Isolation: ohne sie gibt der Browser keinen gemeinsamen Speicher,
 * und die Engine rechnet mit einem Faden. Ist die Seite noch nicht isoliert,
 * meldet sie den Service Worker an (`public/lab-sw.js`, nur für diese Seite),
 * wartet, bis er sie übernimmt, und lädt sich EINMAL neu — klappt es dann
 * immer noch nicht (ein Browser ohne Service Worker, ein harter Neuladen),
 * läuft das Labor eben mit einem Faden; ein Merker in sessionStorage
 * verhindert eine Schleife.
 *
 * Die Arbeiter entstehen hier aus einem Blob (`?worker&inline`): eine isolierte
 * Seite lässt nur Arbeiter zu, die ihre Kopfzeilen teilen — ein Blob erbt sie,
 * eine Datei unter /assets/ (die der Service Worker der Karte nicht erreicht)
 * nicht. Der Baustein auf einer Seite nimmt die Dateien (`workerFactory.ts`).
 *
 * Was gebaut wurde, steht in der Adresse (`#z=…`, `fullLab.ts`); ohne sie
 * zeigt die Karte die Szene mit der Zlewka auf der Heizplatte.
 */

import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';

import EngineWorker from './app/lab/particles/engine.worker?worker&inline';
import { decodeLab, isolated } from './app/lab/particles/fullLab';
import HelperWorker from './app/lab/particles/helper.worker?worker&inline';
import './app/app.css';
import './app/ui/ui.css';

const RELOADED = 'recreatio.lab.reloaded';

function language(): void {
  try {
    const stored = localStorage.getItem('recreatio.lang');
    document.documentElement.lang = stored === 'en' || stored === 'de' || stored === 'pl' ? stored : 'pl';
  } catch {
    document.documentElement.lang = 'pl';
  }
}

/** Einmal neu laden (mit Merker) — `true`, wenn die Seite gleich neu lädt. */
function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOADED) === '1') return false;
    sessionStorage.setItem(RELOADED, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Isoliert werden (Service Worker), sonst eben nicht. `true`: die Seite lädt gleich neu. */
async function isolate(): Promise<boolean> {
  if (isolated()) {
    try { sessionStorage.removeItem(RELOADED); } catch { /* ohne Speicher: egal */ }
    return false;
  }
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return false;
  let reg: ServiceWorkerRegistration;
  try {
    reg = await navigator.serviceWorker.register('lab-sw.js', { scope: './lab.html' });
  } catch {
    return false;
  }
  /* Unter dem Worker, aber nicht isoliert: einmal neu laden. */
  if (navigator.serviceWorker.controller !== null) return reloadOnce();
  /* Beim ersten Besuch, bis der Worker aktiv ist; nach einem harten Neuladen (der am Worker vorbeigeht) ist er es schon — ein gewöhnliches Neuladen geht durch ihn. */
  if (reg.active === null) {
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      const worker = reg.installing ?? reg.waiting;
      worker?.addEventListener('statechange', () => { if (worker.state === 'activated') resolve(); });
      setTimeout(resolve, 4000);
    });
  }
  return reg.active !== null && reloadOnce();
}

async function start(): Promise<void> {
  language();
  if (await isolate()) return;
  const [{ ParticleLab }, { BOILING_SCENE, PARTICLE_PRESETS }] = await Promise.all([
    import('./app/lab/particles/ParticleLab'),
    import('./app/lab/particles/particlePresets')
  ]);
  const payload = await decodeLab(window.location.hash);
  const preset = PARTICLE_PRESETS[0];
  const config = payload ?? { title: preset.title, text: preset.text, scene: BOILING_SCENE };
  document.title = `${config.title || 'Laboratorium cząstek'} — REcreatio`;
  const root = document.getElementById('root');
  if (root === null) return;
  root.className = 'pl-page';
  createRoot(root).render(h(ParticleLab, {
    config: { title: config.title, text: config.text, scene: config.scene },
    whole: true,
    createWorker: () => new EngineWorker(),
    createHelper: () => new HelperWorker()
  }));
}

void start();
