/**
 * Telefonnummern in eine Form bringen.
 *
 * <b>Warum überhaupt.</b> Dieselbe Nummer wird auf fünf Arten geschrieben:
 * `501 234 567`, `501-234-567`, `0501234567`, `+48 501 234 567`,
 * `0048501234567`. Wer sie später sucht oder anruft, sucht fünfmal — und wer
 * eine Liste durchgeht, sieht nicht, dass zwei Zeilen dieselbe Person meinen.
 *
 * <b>Ergänzt wird nur, was fehlt.</b> Eine Nummer, die schon eine Landesvorwahl
 * trägt — welche auch immer —, bleibt, wie sie ist. Ein Kandidat mit einer
 * slowakischen Nummer soll keine polnische bekommen, bloss weil das Formular in
 * einer polnischen Pfarrei steht.
 *
 * <b>Was nicht nach Nummer aussieht, bleibt unangetastet.</b> Lieber eine Zeile,
 * die jemand von Hand geschrieben hat, unverändert weiterreichen, als sie zu
 * etwas zu machen, das niemand gemeint hat.
 */

/** Die Vorwahl, die ergänzt wird, wenn keine dasteht. */
export const RC_DEFAULT_DIAL = '+48';

/**
 * Eine Nummer in die einheitliche Form bringen.
 *
 * <code>
 *   501234567         →  +48 501 234 567
 *   501-234-567       →  +48 501 234 567
 *   0501234567        →  +48 501 234 567     die führende 0 ist Inlandsvorwahl
 *   0048501234567     →  +48 501 234 567     00 ist dasselbe wie +
 *   +48501234567      →  +48 501 234 567
 *   +421905123456     →  +421 905 123 456    fremde Vorwahl bleibt
 *   Kancelaria        →  Kancelaria          keine Nummer, unverändert
 * </code>
 */
export function rcPhone(raw: string): string {
  const text = raw.trim();
  if (text === '') return '';

  // Alles ausser Ziffern und einem führenden Plus ist Schreibweise.
  const plus = text.startsWith('+');
  const digits = text.replace(/\D/g, '');

  /*
   * Zu kurz oder zu lang für eine Nummer: unverändert lassen.
   *
   * Neun Ziffern sind eine polnische Nummer ohne Vorwahl, fünfzehn das Maximum
   * nach E.164. Was ausserhalb liegt, ist etwas anderes — eine Hausnummer, ein
   * Hinweis, ein Tippfehler —, und daraus eine Telefonnummer zu machen wäre
   * eine Behauptung.
   */
  if (digits.length < 9 || digits.length > 15) return text;

  let national: string;
  let dial: string;

  if (plus) {
    // Schon international. Die Vorwahl bleibt, wie sie ist.
    const known = digits.startsWith('48') ? '48' : null;
    dial = known === null ? guessDial(digits) : '48';
    national = digits.slice(dial.length);
  } else if (digits.startsWith('00')) {
    // `00` ist dasselbe wie `+`, nur älter.
    const rest = digits.slice(2);
    dial = rest.startsWith('48') ? '48' : guessDial(rest);
    national = rest.slice(dial.length);
  } else if (digits.startsWith('48') && digits.length === 11) {
    // `48501234567` ohne Plus — in Polen die übliche Schreibweise.
    dial = '48';
    national = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 10) {
    // Führende Null: Inlandsvorwahl, die international wegfällt.
    dial = '48';
    national = digits.slice(1);
  } else {
    dial = '48';
    national = digits;
  }

  if (national === '') return text;
  return `+${dial} ${group(national)}`;
}

/**
 * Wenn eine fremde Vorwahl dasteht, aber unbekannt ist.
 *
 * Geraten wird NICHT: die ersten drei Ziffern gelten als Vorwahl, weil das die
 * längste im Plan der ITU ist. Falsch gruppiert ist unschön; falsch getrennt
 * wäre eine falsche Nummer.
 */
function guessDial(digits: string): string {
  return digits.slice(0, Math.min(3, digits.length - 6));
}

/** Dreiergruppen — so liest man eine Nummer, und so wird sie diktiert. */
function group(national: string): string {
  return national.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

/**
 * Mehrere Nummern, eine je Zeile.
 *
 * Leere Zeilen fallen weg, Doppelte auch: zweimal dieselbe Nummer ist keine
 * zweite Erreichbarkeit, sondern ein Versehen beim Einfügen.
 */
export function rcPhones(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of raw.split('\n')) {
    const one = rcPhone(line);
    if (one === '' || seen.has(one)) continue;
    seen.add(one);
    out.push(one);
  }

  return out;
}
