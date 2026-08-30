/**
 * Der Eintritt: **wer ist hier?** — und wann diese Frage gestellt wird.
 *
 * Sie muss früh beantwortet sein. Die Kopfleiste zeigt entweder „Anmelden"
 * oder den angemeldeten Streifen; wer sie erst nach einer halben Sekunde
 * umbaut, hat dem Leser eine falsche Auskunft gegeben und sie danach
 * zurückgenommen. Bei einer Werkstattadresse ist es schlimmer: dort ist ohne
 * Antwort überhaupt nichts zu malen.
 *
 * **Warum nicht einfach immer beim Eintritt fragen.** Die öffentliche Seite
 * ist die Stiftung, und die meisten, die sie öffnen, haben hier nie ein Konto
 * gehabt. Für sie wäre die Frage eine Anfrage über Ursprungsgrenzen hinweg —
 * mit Vorabfrage, ohne Zwischenspeicher, bei jedem Aufruf — deren Antwort
 * schon feststeht: niemand. Das ist kein Schutz, das ist Last ohne Auskunft.
 *
 * **Deshalb zwei Wege, und beide sind gewollt:**
 *
 *   1. Beim Eintritt, wenn die Antwort etwas ändern kann — die Adresse zeigt
 *      in die Werkstatt, oder dieser Browser war hier schon einmal angemeldet.
 *   2. Sonst gar nicht, bis jemand den Anmeldeknopf anfasst. Dann sofort und
 *      von selbst, ohne dass er ein zweites Mal drücken muss.
 *
 * Wer nie angemeldet war und die Stiftung liest, löst keine einzige Anfrage
 * aus. Wer angemeldet war, bekommt die Antwort vor dem ersten Bild.
 *
 * **Was der Merker ist und was nicht.** Er sagt „auf diesem Gerät war einmal
 * jemand angemeldet" und sonst nichts: kein Name, keine Kennung, kein
 * Schlüssel. Die Sitzung selbst steht im Keks, den dieser Teil nicht sieht und
 * nicht sehen darf. Der Merker entscheidet allein, ob gefragt wird — die
 * Antwort gibt immer der Dienst.
 */

/**
 * Was der Eintritt ergeben hat.
 *
 * `signed-out` und `unreachable` auseinanderzuhalten ist keine Feinheit: ein
 * nicht erreichbarer Dienst ist kein abgemeldeter Mensch. Wer beides gleich
 * behandelt, wirft bei jeder Störung alle hinaus und löscht ihnen dabei den
 * Merker — beim nächsten Versuch wird dann auch nicht mehr gefragt.
 */
export type RcEntry<TWho> =
  /** Es wurde nicht gefragt. Kein Fehler, sondern Weg 2 oben. */
  | { readonly kind: 'unasked' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'signed-in'; readonly who: TWho }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'unreachable' };

/**
 * Der Merker, herausgezogen, damit die Regel oben prüfbar bleibt.
 *
 * `localStorage` wirft in manchen Browsern schon beim Lesen — privates
 * Fenster, gesperrte Seitendaten. Ein Merker, den es nicht gibt, ist kein
 * Grund, den Eintritt scheitern zu lassen: dann eben Weg 2.
 */
export interface RcMemory {
  readonly signedInBefore: () => boolean;
  readonly remember: () => void;
  readonly forget: () => void;
}

const SEEN_KEY = 'rc.signed-in-before';

export const rcBrowserMemory: RcMemory = {
  signedInBefore: () => {
    try {
      return localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      return false;
    }
  },
  remember: () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Ohne Merker läuft alles weiter, nur eben über den Anmeldeknopf.
    }
  },
  forget: () => {
    try {
      localStorage.removeItem(SEEN_KEY);
    } catch {
      // Siehe oben.
    }
  }
};

export interface RcEntryHints {
  /** Aus der Adresse: `rcNeedsIdentity(rcParsePath(location.hash))`. */
  readonly needsIdentity: boolean;
  readonly signedInBefore: boolean;
  /**
   * Ob dieser Tab noch ein Öffnungsstück hat (`rcHasUnlockPiece`). Es liegt im
   * `sessionStorage` und überlebt ein Neuladen — wer neu lädt, hat also eine
   * Sitzung, nach der zu fragen sich lohnt.
   */
  readonly hasUnlockPiece: boolean;
}

/**
 * Wird beim Eintritt gefragt?
 *
 * Rein und ohne Browser prüfbar — die ganze Entscheidung steht in dieser einen
 * Zeile, damit sie sich nicht über drei Dateien verteilt und dabei verrutscht.
 */
export function rcShouldCheckAtEntry(hints: RcEntryHints): boolean {
  return hints.needsIdentity || hints.signedInBefore || hints.hasUnlockPiece;
}

/**
 * Fragen.
 *
 * Auch der Rückfall am Anmeldeknopf ruft DIESE Funktion — es gibt nur eine
 * Auskunft, und sie kommt immer vom Dienst. Der Unterschied zwischen den
 * beiden Wegen ist allein der Zeitpunkt.
 */
export async function rcEntryCheck<TWho extends { readonly signedIn: boolean }>(
  fetchWho: () => Promise<TWho>,
  memory: RcMemory = rcBrowserMemory
): Promise<RcEntry<TWho>> {
  let who: TWho;
  try {
    who = await fetchWho();
  } catch {
    // Der Merker bleibt stehen. Eine Störung ist keine Abmeldung, und beim
    // nächsten Aufruf soll wieder gefragt werden.
    return { kind: 'unreachable' };
  }

  if (!who.signedIn) {
    // Aufräumen: ein Merker ohne Sitzung kostete sonst bei jedem weiteren
    // Aufruf eine Anfrage, deren Antwort feststeht.
    memory.forget();
    return { kind: 'signed-out' };
  }

  memory.remember();
  return { kind: 'signed-in', who };
}

/**
 * Der Eintritt selbst: erst die Entscheidung, dann höchstens eine Anfrage.
 */
export async function rcEnter<TWho extends { readonly signedIn: boolean }>(
  hints: RcEntryHints,
  fetchWho: () => Promise<TWho>,
  memory: RcMemory = rcBrowserMemory
): Promise<RcEntry<TWho>> {
  if (!rcShouldCheckAtEntry(hints)) return { kind: 'unasked' };
  return rcEntryCheck(fetchWho, memory);
}

/**
 * Was die Kopfleiste malen soll, solange die Antwort unterwegs ist.
 *
 * `unasked` ist NICHT `signed-out`. Beide sehen gleich aus — abgemeldete
 * Kopfleiste —, aber nur bei `checking` darf nichts Endgültiges dastehen:
 * dort wissen wir, dass gleich etwas anderes kommt, und ein Knopf, der von
 * „Anmelden" auf einen Namen springt, ist genau das Flackern, das der frühe
 * Eintritt vermeiden soll.
 */
export function rcEntrySettled<TWho>(entry: RcEntry<TWho>): boolean {
  return entry.kind !== 'checking';
}
