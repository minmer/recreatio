/**
 * DER BETREIBER — wer recreatio.pl betreibt (Hosting, Dienst, Speicher) und
 * an wen jede Meldung geht (0130).
 *
 * Er verarbeitet die Daten der Organisationen in deren Auftrag; wofür die Daten
 * gesammelt werden, verantwortet der Administrator danych des Bereichs. Was
 * gemeldet wird, entscheidet er — sperren, wiederherstellen, endgültig löschen —,
 * jeder Schritt unterschrieben in einer Kette.
 *
 * HIER UND NUR HIER zu ändern. Name und Kontakt stehen offen auf jeder Seite
 * neben „Zgłoś"; eine Postanschrift steht hier bewusst nicht.
 */
export const OPERATOR = {
  name: 'Michael Mleczek',
  email: 'kontakt@recreatio.pl',
  site: 'recreatio.pl'
} as const;

/** „Michael Mleczek (kontakt@recreatio.pl)". */
export const operatorLine = (): string => `${OPERATOR.name} (${OPERATOR.email})`;
