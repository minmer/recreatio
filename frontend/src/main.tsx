/**
 * Der Einstieg — ein Haus, eine Weiche weniger.
 *
 * Bis 2026-10-16 stand hier die Grenze zwischen Altbestand und Neubau: eine
 * Liste der Adressen des Neubaus, alles andere ging an `src/legacy/`, und wer
 * die Grenze überquerte, lud die Seite neu. Cogita war das letzte, was dort
 * noch lief. Jetzt gehört JEDE Adresse der Plattform (`src/app/`): ein Wort,
 * das kein Teil ist (`routes.ts`, `ROUTES`), ist eine Seite des Registers —
 * gibt es sie nicht, sagt die Seite das selbst. Der Altbestand wird nicht mehr
 * geladen.
 */

import './app/core/polyfills';
import { keepLinkFromAddress } from './app/links/linkKeep';

/*
 * 0073 — EIN LINK MIT ZUGANG (`#/<ziel>?dostep=T`) wird behalten und aus der
 * Adresse genommen, bevor irgendetwas anderes die Adresse liest — beim Laden
 * und bei jedem Wechsel. `linkKeep` importiert nichts.
 */
const keepLink = () => {
  const linked = keepLinkFromAddress(window.location.hash);
  if (linked !== null) window.history.replaceState(null, '', linked);
};

keepLink();
window.addEventListener('hashchange', keepLink);

/*
 * In der Android-App steht vor allem anderen die Hülle (`shell.ts`): sie
 * setzt die Adresse, mit der die App gestartet wurde. Nachgesehen wird am
 * Objekt, das die App selbst einsetzt — so lädt der Browser davon nichts.
 */
const inShell = (): boolean =>
  (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;

async function mount(): Promise<void> {
  if (inShell()) {
    const { startShell } = await import('./shell');
    await startShell();
  }

  const { mountApp } = await import('./app/mount');
  mountApp(document.getElementById('root')!);
}

void mount();
