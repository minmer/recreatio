/**
 * Die Grenze zwischen dem Altbestand und dem Neubau.
 *
 * <b>Was hier steht, ist die einzige Stelle, die BEIDE kennt.</b> Alles unter
 * `src/legacy/` ist der Stand, der heute recreatio.pl bedient; alles unter
 * `src/workspace/` ist das, was ihn ersetzt. Sie teilen keinen Zustand, keinen
 * Speicher und kein Stilblatt — nur diese Datei und das `<div id="root">`.
 *
 * <b>Warum die Weiche hier liegt und nicht in einem Bauteil.</b> Ein Zweig
 * innerhalb einer React-Komponente zoege den jeweils anderen Zweig mit in den
 * Speicher: die alten Stilblaetter kaemen mit, und der Neubau erbte Regeln, die
 * er nicht kennt. Beide Seiten werden deshalb per `import()` geholt, und nur
 * die, die gerade gebraucht wird.
 *
 * <b>Der Altbestand mountet sich SELBST.</b> `legacy/main.tsx` legt seine
 * eigene Wurzel an, sobald es geladen wird — deshalb wird hier im alten Fall
 * keine zweite angelegt. Zwei Wurzeln auf demselben Knoten waeren kein Absturz,
 * sondern zwei Anwendungen, die sich gegenseitig ueberschreiben.
 */

const NEW_BASE = '#/workspace';

/** Gehoert diese Adresse dem Neubau? */
const isNew = (): boolean => {
  const hash = window.location.hash;
  return hash === NEW_BASE || hash.startsWith(`${NEW_BASE}/`);
};

/*
 * DIE GRENZE WIRD MIT EINEM NEULADEN UEBERQUERT.
 *
 * Sie steht VOR dem ersten `import()`, damit sie auch dann greift, wenn gerade
 * der Altbestand laeuft: dessen eigene Weiche kennt `#/workspace` nicht und
 * hielte es fuer eine seiner Adressen — der Neubau kaeme nie zum Vorschein.
 *
 * Ein Neuladen an dieser Stelle ist Absicht und kein Behelf: Alt und Neu teilen
 * weder Sitzung noch Speicher, und ein Wechsel ohne Neuladen erzeugte genau die
 * Vermischung, die der Umbau gerade abschafft.
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
    const { mountWorkspace } = await import('./workspace/mount');
    mountWorkspace(document.getElementById('root')!);
    return;
  }

  // Er legt seine Wurzel selbst an — hier wird nur geladen.
  await import('./legacy/main');
}

void mount();
