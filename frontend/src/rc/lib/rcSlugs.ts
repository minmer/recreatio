/**
 * Die Namen der einzelnen Dinge — und was ein Name überhaupt sein darf.
 *
 * `rcRoute` sagt, welche TEILE es gibt (`parish`, `event`, …). Hier steht das
 * Gegenstück: welche einzelnen Dinge in einem Teil schon benannt sind, und in
 * welcher Form ein Name geschrieben wird.
 *
 * ---------------------------------------------------------------------------
 * WARUM DIE FORM EINGESCHRÄNKT IST
 *
 * Ein Name steht in einer Adresse, und eine Adresse wird abgeschrieben,
 * vorgelesen, in eine Nachricht geklebt und auf ein Blatt gedruckt. Was dabei
 * schiefgeht, geht still schief: `Grzegorzki` und `grzegorzki` wären zwei
 * Dinge, `św-jan` überlebt keinen Zeilenumbruch in einer E-Mail, und ein Name
 * mit einem Punkt darin sieht in der Adresszeile aus wie ein Dateiname.
 *
 * Deshalb: kleine lateinische Buchstaben, Ziffern, Bindestriche dazwischen.
 * Keine diakritischen Zeichen — auch nicht die polnischen, so schade das ist.
 * Ein Name ist keine Aufschrift; die Aufschrift steht im Datensatz und darf
 * heissen, wie sie will.
 *
 * ---------------------------------------------------------------------------
 * WARUM ES EINE LISTE GIBT
 *
 * <b>Sie ist eine Auskunft, keine Schranke.</b> Was hier steht, ist bekannt
 * und darf öffentlich verlinkt werden — nicht mehr und nicht weniger. Der
 * Adressleser weist NICHTS zurück, was hier fehlt: die Dinge selbst stehen in
 * der Datenbank, nicht im Programm, und eine Pfarrei, die morgen dazukommt,
 * soll nicht auf eine neue Fassung der Seite warten müssen.
 *
 * Wofür die Liste da ist: die öffentliche Seite kann sagen, was es schon gibt,
 * statt nur ein Muster zu zeigen. Und wer hier einträgt, muss den Namen genau
 * einmal richtig schreiben.
 *
 * <b>`invite` steht mit Absicht nicht hier</b>, und darf hier auch nie stehen:
 * sein Name IST das Geheimnis der Einladung. Eine Liste bekannter Einladungen
 * wäre eine Liste offener Türen.
 */

import type { RcPart } from './rcRoute';

/** Kleinbuchstaben und Ziffern, Bindestriche nur dazwischen. */
const SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Lang genug für „matka-boza-czestochowska", kurz genug, dass eine Adresse
 * noch in eine Zeile passt.
 */
const MAX = 48;

/** Taugt das Wort als Name in einer Adresse? */
export function rcIsSlug(word: string): boolean {
  return word.length > 0 && word.length <= MAX && SHAPE.test(word);
}

/**
 * Was schon benannt ist.
 *
 * Ein leeres Feld heisst „noch keines", nicht „keines möglich". Die Teile ohne
 * eigenen Eintrag (`workshop`, `account`, …) benennen gar keine einzelnen
 * Dinge — das steht in `RC_PARTS` und wird hier nicht wiederholt.
 */
export const RC_KNOWN_SLUGS = {
  parish: ['grzegorzki'],
  event: [],
  cogita: [],
  calendar: [],
  chat: [],
  confirmation: []
} as const satisfies Readonly<Partial<Record<RcPart, readonly string[]>>>;

/** Die bekannten Namen eines Teils — leer, wenn keiner benannt ist. */
export function rcKnownSlugs(part: RcPart): readonly string[] {
  const table: Readonly<Record<string, readonly string[] | undefined>> = RC_KNOWN_SLUGS;
  return table[part] ?? [];
}

/** Ist dieser Name in diesem Teil bekannt? */
export function rcIsKnownSlug(part: RcPart, slug: string): boolean {
  return rcKnownSlugs(part).includes(slug);
}
