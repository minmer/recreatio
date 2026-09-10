/**
 * Titel vor einem Namen — mehrere, jeder für sich, frei geschrieben.
 *
 * <b>Warum keine Auswahlliste.</b> Eine Liste mit „ks.", „ks. dr" und
 * „ks. prof." darin führt fertige KOMBINATIONEN, und davon gibt es beliebig
 * viele: jede Verbindung von geistlichem und akademischem Grad wäre ein
 * eigener Eintrag, und wer „ks. dr hab." führt, findet sich nicht. Wer die
 * Liste pflegt, entscheidet ausserdem darüber, welche Titel es gibt — das ist
 * keine Entscheidung, die in dieser Datei getroffen werden sollte.
 *
 * Jeder Titel ist deshalb ein eigenes, frei geschriebenes Stück. Sie stehen in
 * der Reihenfolge, in die sie jemand gebracht hat, und werden mit einem
 * Leerzeichen verbunden.
 *
 * <b>Das schwierige Stück ist das Zurücklesen.</b> Gespeichert wird EIN
 * Anzeigename — „ks. dr Michał Mleczek" —, denn der Name liegt als ein Feld an
 * der Rolle. Beim nächsten Öffnen des Formulars müssen daraus wieder Stücke
 * werden, ohne dass ein Vorname abgerissen wird.
 *
 * Die Regel dafür steht in `rcSplitTitles` und ist bewusst schmal: ein
 * führendes Wort ist ein Titel, wenn es auf einen Punkt endet oder in einer
 * kurzen Liste steht. Beides trifft auf keinen Vornamen zu.
 */

/**
 * Titelwörter OHNE Punkt, die es trotzdem gibt.
 *
 * Alles andere erkennt die Punktregel. Diese Liste ist kein Katalog erlaubter
 * Titel — sie erlaubt nichts und verbietet nichts. Sie sagt nur, welche Wörter
 * beim Zurücklesen nicht für einen Vornamen gehalten werden.
 */
export const RC_TITLE_WORDS: readonly string[] = [
  'dr', 'hab', 'prof', 'mgr', 'lic', 'inz', 'inż', 'bp', 'abp', 'kard'
];

/**
 * Was die Oberfläche zum schnellen Anfügen anbietet.
 *
 * VORSCHLÄGE, keine Auswahl: jeder davon landet als gewöhnliches Stück in der
 * Liste und lässt sich danach ändern oder entfernen wie ein selbst getipptes.
 * Wer etwas anderes braucht, tippt es — die Vorschläge sparen Tastendrücke und
 * halten die Schreibweise der häufigsten Fälle einheitlich.
 */
export const RC_TITLE_HINTS: readonly string[] = ['ks.', 'o.', 's.', 'bp', 'dr', 'hab.', 'prof.', 'mgr'];

/** Ein Stück ist ein Titel, wenn es auf einen Punkt endet oder in der Liste steht. */
const isTitleWord = (word: string): boolean =>
  word.endsWith('.') || RC_TITLE_WORDS.includes(word.toLowerCase());

/**
 * Den Anzeigenamen in Titel und Namen zerlegen.
 *
 * Gelesen wird von vorn, Wort für Wort, und beim ERSTEN Wort abgebrochen, das
 * kein Titel ist. Ab dort ist alles Name — auch wenn später noch einmal etwas
 * stünde, das wie ein Titel aussieht.
 *
 * <b>Der letzte Rest bleibt immer Name.</b> Bestünde die ganze Zeichenkette aus
 * Titelwörtern, hiesse jemand „ks. dr" und sonst nichts; dann ist das letzte
 * Wort sein Name, so seltsam das ist. Andernfalls verschwände beim Öffnen des
 * Formulars der einzige Text, den es gibt.
 */
export function rcSplitTitles(full: string): { titles: string[]; name: string } {
  const words = full.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return { titles: [], name: '' };

  const titles: string[] = [];
  let i = 0;

  // `words.length - 1`: das letzte Wort wird nie als Titel genommen.
  while (i < words.length - 1 && isTitleWord(words[i])) {
    titles.push(words[i]);
    i++;
  }

  return { titles, name: words.slice(i).join(' ') };
}

/**
 * Und wieder zusammen.
 *
 * Leere Stücke fallen weg — sie entstehen, wenn jemand ein Feld leert, statt es
 * zu entfernen, und ein doppeltes Leerzeichen im Namen sieht niemand, bis er
 * ihn kopiert.
 */
export const rcJoinTitles = (titles: readonly string[], name: string): string =>
  [...titles.map((t) => t.trim()).filter((t) => t.length > 0), name.trim()]
    .filter((part) => part.length > 0)
    .join(' ');
