/**
 * Die öffentlich erreichbaren Pfarrseiten — mit dem Namen, unter dem sie
 * wirklich heissen.
 *
 * <b>Warum eine Liste und keine Abfrage.</b> Das Werkzeugverzeichnis gehört zum
 * öffentlichen Teil: es fragt den Dienst nicht, und es soll ihn nicht fragen
 * müssen, um zu zeigen, was es gibt. Eine Seite, die erst nach einer Antwort
 * des Servers weiss, was sie anbietet, ist leer, solange er schweigt — und die
 * Auskunft „diese Pfarrei hat eine Seite" ist ohnehin öffentlich.
 *
 * Sobald es mehr als eine Handvoll wird, gehört das in eine Abfrage. Bis dahin
 * ist eine Liste ehrlicher als eine Abfrage, die immer dasselbe zurückgibt.
 *
 * <b>Der Name ist der AMTLICHE</b>, nicht die Adresse. „grzegorzki" ist der
 * Weg; „Parafia św. Grzegorza Wielkiego" ist, wie die Gemeinde heisst. Wer im
 * Verzeichnis den Weg statt des Namens läse, fände seine Pfarrei nicht.
 *
 * Die Liste ist mit `RC_ALLOWED_SLUGS` verwandt und NICHT dasselbe: dort steht,
 * welche Namen vergeben werden dürfen, hier, welche Seiten es schon gibt. Ein
 * geprüfter Zusammenhang steht in `rcParishPublic.test.ts`.
 */

export type RcPublicParish = {
  /** Der amtliche Name der Pfarrei. */
  readonly name: string;
  /** Wo sie steht — damit zwei gleichnamige unterscheidbar bleiben. */
  readonly place: string;
  /** Ein Satz für das Verzeichnis. */
  readonly lead: string;
};

export const RC_PARISH_PUBLIC: Readonly<Record<string, RcPublicParish>> = {
  grzegorzki: {
    name: 'Parafia św. Grzegorza Wielkiego',
    place: 'Kraków — Grzegórzki',
    lead: 'Msze, intencje, ogłoszenia i kancelaria.'
  }
};

/** Die Namen der Reihe nach, für Verzeichnisse. */
export const rcPublicParishes = (): readonly (RcPublicParish & { slug: string })[] =>
  Object.entries(RC_PARISH_PUBLIC)
    .map(([slug, parish]) => ({ slug, ...parish }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
