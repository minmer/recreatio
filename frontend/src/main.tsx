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

const BASE = '#/workspace';

const isNew = (): boolean => {
  const hash = window.location.hash;
  return hash === BASE || hash.startsWith(`${BASE}/`);
};

/*
 * Die Grenze wird mit einem Neuladen überquert, und der Horcher steht VOR dem
 * ersten `import()`: die Weiche des Altbestands kennt `#/workspace` nicht und
 * hielte es für eine seiner Adressen — der Neubau käme nie zum Vorschein.
 */
let wasNew = isNew();
window.addEventListener('hashchange', () => {
  if (isNew() !== wasNew) {
    wasNew = isNew();
    window.location.reload();
  }
});

async function mount(): Promise<void> {
  if (isNew()) {
    const { mountApp } = await import('./app/mount');
    mountApp(document.getElementById('root')!);
    return;
  }

  await import('./legacy/main');
}

void mount();
