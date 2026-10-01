/**
 * Die Grenze zwischen Altbestand und Neubau — die einzige Stelle, die beide
 * kennt.
 *
 * Alles unter `src/legacy/` bedient heute recreatio.pl; alles unter
 * `src/app/` ersetzt es. Sie teilen keinen Zustand, keinen Speicher und kein
 * Stilblatt — nur diese Datei und das `<div id="root">`.
 *
 * Beide Seiten werden per `import()` geholt, damit die alten Stilblätter nicht
 * mitkommen, wenn der Neubau geladen wird: eine geerbte Regel, die man nicht
 * kennt, ist schwerer zu finden als eine fehlende.
 *
 * Der Altbestand mountet sich SELBST, sobald er geladen ist — deshalb wird
 * hier für ihn keine zweite Wurzel angelegt.
 */

import { foreignHost, PAGES, ROUTES } from './app/routes';
import { keepLinkFromAddress } from './app/linkKeep';

/*
 * 0073 — EIN LINK MIT ZUGANG (`#/<ziel>?dostep=T`) wird behalten und aus der
 * Adresse genommen, BEVOR die Weiche entscheidet: auch ein Ziel im Altbestand
 * soll das Geheimnis nicht in der Adresszeile stehen lassen. `linkKeep`
 * importiert nichts — die Trennung der beiden Häuser bleibt.
 */
{
  const linked = keepLinkFromAddress(window.location.hash);
  if (linked !== null) window.history.replaceState(null, '', linked);
}

const BASE = '#/workspace';

/*
 * Die Seitenliste wird MITGELESEN und nicht abgeschrieben: zwei Listen liefen
 * auseinander, und eine übernommene Adresse landete beim Altbestand, der sie
 * nicht kennt. `routes.ts` importiert selbst nichts und bringt deshalb weder
 * React noch ein Stilblatt in diese Datei — die Trennung bleibt.
 */
const isNew = (): boolean => {
  /*
   * Eine EIGENE Domain gehört ganz dem Neubau. Dort gibt es keinen Altbestand,
   * den man treffen könnte — und die Seite, die sie zeigt, steht im Register.
   */
  if (foreignHost() !== null) return true;

  // 0062 — hinter `?` steht nur, welcher Slajd (`?s=3`): für die Weiche zählt der Pfad davor.
  const hash = window.location.hash.split('?')[0];
  if (hash === BASE || hash.startsWith(`${BASE}/`)) return true;

  // Die Wurzel gehört dem Neubau: `recreatio.pl` zeigt die Seite, die im
  // Register als Alias auf `start` steht.
  if (hash === '' || hash === '#' || hash === '#/') return true;

  /*
   * Die Teile des Neubaus ausser dem Arbeitsplatz — der Platz, die Bestätigung,
   * der Link mit Zugang (0065), das Widget (0067). Der Altbestand kennt keinen davon.
   */
  if (Object.keys(ROUTES).some((route) => hash === `#/${route}` || hash.startsWith(`#/${route}/`))) return true;

  return PAGES.some((page) => hash === `#/${page}` || hash.startsWith(`#/${page}/`));
};

/*
 * Die Grenze wird mit einem Neuladen überquert, und der Horcher steht VOR dem
 * ersten `import()`: die Weiche des Altbestands kennt `#/workspace` nicht und
 * hielte es für eine seiner Adressen — der Neubau käme nie zum Vorschein.
 */
let wasNew = isNew();
window.addEventListener('hashchange', () => {
  const linked = keepLinkFromAddress(window.location.hash);
  if (linked !== null) window.history.replaceState(null, '', linked);
  if (isNew() !== wasNew) {
    wasNew = isNew();
    window.location.reload();
  }
});

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

    // Die Hülle kann die Adresse gewechselt haben, ohne dass `hashchange` kam.
    wasNew = isNew();
  }

  if (isNew()) {
    const { mountApp } = await import('./app/mount');
    mountApp(document.getElementById('root')!);
    return;
  }

  await import('./legacy/main');
}

void mount();
