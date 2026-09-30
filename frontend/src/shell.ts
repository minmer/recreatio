/**
 * DIE HÜLLE — was nur in der Android-App geschieht, und zwar BEVOR die Seite
 * startet. Im Browser wird diese Datei gar nicht geladen (`main.tsx`).
 *
 * Sie gehört weder zum Altbestand noch zum Neubau: die Zurück-Taste und ein
 * Link, der von aussen kommt, betreffen beide gleich.
 *
 * <code>
 *   Start ohne Adresse      → der Arbeitsplatz (#/workspace), nicht die Startseite
 *   Link auf recreatio.pl   → in der App geöffnet, beim Start wie im Lauf
 *   Zurück-Taste            → erst schliessen, was offen ist, dann zurück,
 *                             zuletzt die App in den Hintergrund (nicht beenden:
 *                             der Schlüssel im Speicher bliebe sonst nicht)
 *   <a download> mit blob:  → der Dokumentenwähler (eine WebView lädt nichts herunter)
 *   Hell ↔ Dunkel           → die Symbole der Statusleiste wechseln mit
 * </code>
 */

import { App } from '@capacitor/app';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';

import { saveBlob } from './app/platform';

const HOME = '#/workspace';
const OWN_HOSTS = new Set(['recreatio.pl', 'www.recreatio.pl']);

/**
 * Welcher Startlink schon verarbeitet ist. Die App liefert ihn bei JEDEM
 * Neuladen der Seite wieder — und neu geladen wird auch beim Wechsel zwischen
 * Altbestand und Neubau. Ohne diese Marke spränge die Seite dann jedes Mal
 * zurück an den Anfang.
 */
const LAUNCH_SLOT = 'recreatio:shell:launch';

/** Was hinter einem der eigenen Links steht — oder `null`, wenn er nicht uns gehört. */
function ownLink(url: string): URL | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && OWN_HOSTS.has(parsed.hostname.toLowerCase()) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Einen eigenen Link hier öffnen.
 *
 * Eine blosse Raute wechselt ohne Neuladen (der Schlüssel im Speicher bleibt);
 * ein anderer Pfad (Altbestand: /event/…) lädt die Seite von hier neu — die
 * App liefert sie aus sich selbst, nicht aus dem Netz.
 */
function openHere(link: URL, starting: boolean): void {
  const rootPath = link.pathname === '/' || link.pathname === '' || link.pathname === '/index.html';

  if (!rootPath) {
    if (window.location.pathname !== link.pathname || window.location.hash !== link.hash) {
      window.location.replace(`${link.pathname}${link.search}${link.hash}`);
    }
    return;
  }

  const hash = link.hash === '' || link.hash === '#' ? HOME : link.hash;
  if (starting) window.history.replaceState(null, '', `/${hash}`);
  else window.location.hash = hash;
}

/** Ist etwas offen, das Esc schliesst? Dann schliesst die Zurück-Taste zuerst das. */
const OPEN_OVERLAY = [
  '.wk-modal-back',
  '.wk-full',
  '.wk-sitemenu-link[aria-expanded="true"]',
  '.wk-sitemenu-sub[aria-expanded="true"]',
  '.wk-crumb-more[aria-expanded="true"]'
].join(', ');

/**
 * Die Zurück-Taste.
 *
 * <b>`canGoBack` allein genügt nicht.</b> Chromium überspringt beim Zurück
 * Einträge, die ohne Fingertipp entstanden sind (die Seite wechselt nach dem
 * Speichern selbst die Adresse) — `canGoBack` sagt dann „nein", obwohl es ein
 * Zurück gibt. Deshalb wird es versucht: bewegt sich innerhalb eines Moments
 * nichts, gab es kein Zurück, und die App geht in den Hintergrund.
 */
function onBack({ canGoBack }: { canGoBack: boolean }): void {
  if (document.querySelector(OPEN_OVERLAY) !== null) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return;
  }

  if (canGoBack) {
    window.history.back();
    return;
  }

  const before = window.location.href;
  let moved = false;
  const onMove = () => { moved = true; };
  const events = ['popstate', 'hashchange', 'pagehide'] as const;
  events.forEach((name) => window.addEventListener(name, onMove));

  window.history.back();

  window.setTimeout(() => {
    events.forEach((name) => window.removeEventListener(name, onMove));
    if (!moved && window.location.href === before) void App.minimizeApp();
  }, 300);
}

/**
 * Ein Klick auf einen Download-Link, der auf etwas im Speicher der Seite zeigt.
 * Abgefangen in der Einfangphase, bevor die WebView ihn als Navigation nimmt.
 */
function onDownload(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest('a[download]');
  if (!(link instanceof HTMLAnchorElement)) return;
  if (!link.href.startsWith('blob:') && !link.href.startsWith('data:')) return;

  event.preventDefault();
  const name = link.getAttribute('download') || 'plik';

  void fetch(link.href)
    .then((response) => response.blob())
    .then((blob) => saveBlob(blob, name))
    .catch(() => { window.alert('Nie udało się zapisać pliku.'); });
}

export async function startShell(): Promise<void> {
  let launched: string | null = null;
  try {
    launched = (await App.getLaunchUrl())?.url ?? null;
  } catch { /* ohne Startlink eben die Startseite */ }

  let handled: string | null = null;
  try { handled = sessionStorage.getItem(LAUNCH_SLOT); } catch { /* dann gilt er als neu */ }

  const link = launched !== null && launched !== handled ? ownLink(launched) : null;
  if (link !== null) {
    try { sessionStorage.setItem(LAUNCH_SLOT, launched!); } catch { /* höchstens einmal zu oft */ }
    openHere(link, true);
  } else {
    const hash = window.location.hash;
    if (window.location.pathname === '/' && (hash === '' || hash === '#' || hash === '#/')) {
      window.history.replaceState(null, '', `/${HOME}`);
    }
  }

  await App.addListener('appUrlOpen', ({ url }) => {
    const own = ownLink(url);
    if (own !== null) openHere(own, false);
  });

  await App.addListener('backButton', onBack);

  document.addEventListener('click', onDownload, true);

  /*
   * Die Seite folgt dem dunklen Modus von selbst (prefers-color-scheme). Die
   * Symbole der Statusleiste nicht: SystemBars legt „DEFAULT" beim Start auf
   * hell oder dunkel fest und bleibt dabei — dunkle Uhr auf dunklem Grund.
   * Also bei jedem Wechsel neu fragen.
   */
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    void SystemBars.setStyle({ style: SystemBarsStyle.Default }).catch(() => undefined);
  });
}
