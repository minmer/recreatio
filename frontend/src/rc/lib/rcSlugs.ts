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
 * <b>Sie sagt, was ERLAUBT ist — nicht, was EXISTIERT.</b> Und das ist keine
 * Wortklauberei: die Liste stand einmal auf der oeffentlichen Seite unter der
 * Ueberschrift „gibt es schon", und dort behauptete sie von einer Pfarrei,
 * die noch niemand angelegt hatte, sie sei vorhanden. Was wirklich existiert,
 * weiss allein die Datenbank; diese Liste weiss nur, welche Namen vergeben
 * werden duerfen. Der
 * Adressleser weist NICHTS zurück, was hier fehlt: die Dinge selbst stehen in
 * der Datenbank, nicht im Programm, und eine Pfarrei, die morgen dazukommt,
 * soll nicht auf eine neue Fassung der Seite warten müssen.
 *
 * Wofür die Liste da ist: die öffentliche Seite kann sagen, was es schon gibt,
 * statt nur ein Muster zu zeigen. Und wer hier einträgt, muss den Namen genau
 * einmal richtig schreiben.
 *
 * <b>Der Server hat dieselbe Liste</b>, in `backend/Rc.Api/RcParishSlugs.cs`,
 * und DORT ist sie die Schranke. Diese hier ist die Freundlichkeit: sie warnt,
 * sobald jemand tippt, statt ihn absenden und ablehnen zu lassen. Ein Formular
 * ist keine Schranke — wer die Anfrage von Hand stellt, käme daran vorbei.
 *
 * Beide gehören zusammen geändert. Laufen sie auseinander, ist das kein stiller
 * Fehler: der Server lehnt ab und nennt in der Antwort die wirklich
 * vorgesehenen Namen.
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
 * Welche Namen vergeben werden duerfen.
 *
 * NICHT, welche es gibt. Ein Eintrag hier heisst: dieser Name ist vorgesehen,
 * und wer die Berechtigung hat, darf eine Pfarrei darauf anlegen. Ob das
 * jemand getan hat, steht in der Datenbank.
 *
 * Ein leeres Feld heisst „noch keiner vorgesehen", nicht „keiner moeglich". Die Teile ohne
 * eigenen Eintrag (`workshop`, `account`, …) benennen gar keine einzelnen
 * Dinge — das steht in `RC_PARTS` und wird hier nicht wiederholt.
 */
export const RC_ALLOWED_SLUGS = {
  parish: ['grzegorzki'],
  event: [],
  cogita: [],
  calendar: [],
  chat: [],
  confirmation: []
} as const satisfies Readonly<Partial<Record<RcPart, readonly string[]>>>;

/** Die erlaubten Namen eines Teils — leer, wenn keiner vorgesehen ist. */
export function rcAllowedSlugs(part: RcPart): readonly string[] {
  const table: Readonly<Record<string, readonly string[] | undefined>> = RC_ALLOWED_SLUGS;
  return table[part] ?? [];
}

/** Darf in diesem Teil ein Ding mit diesem Namen angelegt werden? */
export function rcIsAllowedSlug(part: RcPart, slug: string): boolean {
  return rcAllowedSlugs(part).includes(slug);
}
