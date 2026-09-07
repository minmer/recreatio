/**
 * Der Beleg der Anmeldung, solange die Karte offen ist.
 *
 * <b>Wofuer.</b> Teile wie die Checkliste, die Teilnehmerkarte und die Fragen
 * gehoeren einem einzelnen Teilnehmer. Der hat kein Konto — er weist sich mit
 * dem Beleg aus, den er beim Anmelden bekommen hat.
 *
 * <b>Warum nicht in der Adresse</b>, wie im alten Modul der persoenliche Link.
 * Eine Adresse steht im Verlauf des Browsers, im `Referer` der naechsten Seite,
 * im Protokoll jedes Zwischenservers und in der Vorschau jedes Boten, durch den
 * jemand sie weiterschickt. Ein Geheimnis dort ist ein Geheimnis, das man
 * versehentlich weitergibt.
 *
 * <b>Warum `sessionStorage` und nicht `localStorage`.</b> Der Beleg gehoert
 * einer Person, der Rechner oft nicht: Pfarrbuero, Gemeindesaal, das Telefon
 * eines Freundes. `sessionStorage` endet mit der Karte; `localStorage` bliebe
 * bis jemand ihn loescht, und der naechste Benutzer haette ihn geerbt.
 *
 * <b>Warum ueberhaupt gemerkt.</b> Weil er sonst je Teil neu eingetippt werden
 * muesste — und ein Beleg, den man dreimal abschreibt, wird beim dritten Mal
 * aus der Nachricht kopiert, in der er steht, und die liegt dann offen.
 */

/** Je Veranstaltung ein Beleg: zwei Feste sind zwei Anmeldungen. */
const key = (collection: string, slug: string) => `rc.claim.${collection}/${slug}`;

/**
 * Lesen. Ein Fehlschlag ist KEIN Fehler: privates Fenster, gesperrter Speicher,
 * geleerte Daten — dann gibt es eben keinen, und der Teil fragt danach.
 */
export function rcReadClaim(collection: string, slug: string): string | null {
  try {
    const found = window.sessionStorage.getItem(key(collection, slug));
    return found === null || found.trim() === '' ? null : found;
  } catch {
    return null;
  }
}

/** Schreiben. Ein leerer Wert LOESCHT — so meldet man sich wieder ab. */
export function rcWriteClaim(collection: string, slug: string, claim: string | null): void {
  try {
    if (claim === null || claim.trim() === '') window.sessionStorage.removeItem(key(collection, slug));
    else window.sessionStorage.setItem(key(collection, slug), claim.trim());
  } catch {
    /*
     * Nicht speichern zu koennen ist kein Grund, die Seite scheitern zu lassen:
     * der Beleg gilt dann fuer diese eine Ansicht und wird beim naechsten Teil
     * neu erfragt. Unbequem, aber vollstaendig.
     */
  }
}
