/**
 * Telefonnummern — eine oder mehrere, und eine davon ist nie „+48 zu tippen".
 *
 * <b>Die Vorwahl gehört nicht in die Hand des Ausfüllenden.</b> Wer „600 700
 * 800" einträgt, meint eine polnische Nummer; das Land dazuzuschreiben ist
 * Arbeit, die eine Maschine besser tut als ein Mensch um halb elf abends auf dem
 * Telefon. Wer eine ausländische Nummer hat, schreibt sie mit `+` — und dann
 * wird nichts davorgesetzt.
 *
 * <b>Warum hier und nicht in der Eingabemaske.</b> Das Rechnen ist reine
 * Zeichenarbeit: Text hinein, Nummer heraus. So lässt es sich prüfen, ohne einen
 * Browser zu starten — und geprüft gehört es, weil die Fälle sich nicht von
 * selbst verstehen (00 statt +, eine schon vollständige Nummer, eine zu kurze).
 */

/** Das Land, in dem diese Anwendung steht. Eine Annahme, und sie steht hier. */
const HOME = '48';

/** Wie viele Ziffern eine polnische Nummer hat, ohne Vorwahl. */
const HOME_DIGITS = 9;

/**
 * Eine getippte Nummer in die Form bringen, in der sie gespeichert wird.
 *
 * <code>
 *   600 700 800        →  +48 600 700 800
 *   600-700-800        →  +48 600 700 800
 *   48600700800        →  +48 600 700 800
 *   0048 600 700 800   →  +48 600 700 800
 *   +49 151 23456789   →  +49 151 23456789   (unberührt: nicht unser Land)
 *   12 345             →  null               (zu kurz, um eine Nummer zu sein)
 * </code>
 *
 * <b>`null` heisst: das ist keine Nummer.</b> Nicht „ungültig" — die Maske soll
 * die Eingabe dann stehen lassen und nichts daraus machen, statt einen halben
 * Eintrag zu erzeugen, den später niemand deuten kann.
 */
export function normalisePhone(raw: string): string | null {
  const text = raw.trim();
  if (text === '') return null;

  /* Alles, was Menschen zur Gliederung schreiben, ist keine Ziffer. */
  const cleaned = text.replace(/[\s()./-]/g, '');

  let digits: string;

  if (cleaned.startsWith('+')) {
    digits = cleaned.slice(1);
  } else if (cleaned.startsWith('00')) {
    // Die alte Schreibweise für „ins Ausland" — dasselbe wie `+`.
    digits = cleaned.slice(2);
  } else if (cleaned.startsWith(HOME) && cleaned.length === HOME.length + HOME_DIGITS) {
    digits = cleaned;
  } else {
    digits = HOME + cleaned;
  }

  if (!/^\d+$/.test(digits)) return null;

  /*
   * Kürzer als sieben Ziffern ist keine Rufnummer, sondern ein Tippfehler oder
   * eine Hausnummer. Länger als fünfzehn verbietet die E.164 — was darüber
   * liegt, ist mit Sicherheit keine Nummer.
   */
  if (digits.length < 7 + HOME.length || digits.length > 15) return null;

  return '+' + group(digits);
}

/**
 * Die Ziffern lesbar gliedern — aber nur, wo wir die Gewohnheit kennen.
 *
 * <b>Für das eigene Land nach der gewohnten Art</b> (`+48 600 700 800`).
 *
 * <b>Für alles andere gar nicht.</b> Hier stand einmal „in Dreiergruppen, weil
 * wir die dortige Gewohnheit nicht kennen" — und das war falsch: es nimmt eine
 * zweistellige Landesvorwahl an. `+1 202 555 0143` wurde dabei zu
 * `+12 025 550 143`, was wie eine andere Nummer aussieht. Eine Gliederung, die
 * man nicht kennt, erfindet man nicht; ungegliederte Ziffern sind hässlicher
 * und immer richtig.
 */
function group(digits: string): string {
  if (digits.startsWith(HOME) && digits.length === HOME.length + HOME_DIGITS) {
    const rest = digits.slice(HOME.length);
    return `${HOME} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }

  return digits;
}

/**
 * Der gespeicherte Wert eines Telefonfeldes — eine Nummer je Zeile.
 *
 * <b>Zeilen und keine Kommas.</b> Eine Nummer enthält nie einen Zeilenumbruch,
 * ein Komma dagegen kommt in Schreibweisen durchaus vor; und dieselbe Trennung
 * benutzt das Formular schon für die Auswahlliste eines Feldes.
 */
export const splitPhones = (value: string): readonly string[] =>
  value.split('\n').map((one) => one.trim()).filter((one) => one !== '');

export const joinPhones = (numbers: readonly string[]): string => numbers.join('\n');

/**
 * Eine Nummer dazunehmen — geordnet, ohne Dopplung.
 *
 * Gibt die Liste unverändert zurück, wenn die Nummer keine ist oder schon
 * dasteht. Zweimal dieselbe Nummer ist keine zweite Nummer.
 */
export function withPhone(
  numbers: readonly string[], raw: string
): { readonly numbers: readonly string[]; readonly added: boolean } {
  const one = normalisePhone(raw);
  if (one === null || numbers.includes(one)) return { numbers, added: false };

  return { numbers: [...numbers, one], added: true };
}

/**
 * Dieselbe Nummer, wie ein Telefon sie wählt.
 *
 * <b>Ohne Leerzeichen.</b> `+48 600 700 800` liest sich gut und gehört nicht in
 * ein `sms:`- oder `tel:`-Ziel: dort ist alles ausser Ziffern und `+` bestenfalls
 * überflüssig und schlimmstenfalls der Grund, warum das Telefon den Link gar
 * nicht erst annimmt.
 *
 * Der Altbestand hatte dafür `dialable()` in `AccessPanel.tsx` und machte
 * nebenbei dieselbe +48-Ergänzung — hier steht sie schon in `normalisePhone`,
 * also bleibt hier nur das Abstreifen.
 */
export function dialable(value: string): string | null {
  const one = normalisePhone(value);
  return one === null ? null : one.replace(/\s+/g, '');
}

/**
 * Die ERSTE Nummer eines Feldes — für einen Link, der genau ein Ziel hat.
 *
 * Ein Feld kann mehrere tragen (Mutter, Vater, Kind); ein `sms:`-Ziel nicht.
 * Welche gemeint ist, sagt die Reihenfolge: die zuerst eingetragene.
 */
export const firstPhone = (value: string): string | null => {
  const all = splitPhones(value);
  return all.length === 0 ? null : dialable(all[0]);
};
