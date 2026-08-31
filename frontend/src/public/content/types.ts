/**
 * Die Form der öffentlichen Texte.
 *
 * <b>Kein Text steht in einer Komponente.</b> Im Altbestand sind zwei Folien
 * fest im Bauteil verdrahtet — „Cogita Graph" auf Englisch, „Biblioteka" auf
 * Polnisch — und übersetzen sich deshalb in keiner Sprache. Diese Form ist die
 * Vorkehrung dagegen: was hier nicht steht, kann eine Seite nicht anzeigen.
 *
 * <b>Fehlende Tatsachen sind ein eigener Typ</b>, kein leerer String. Ein
 * leerer String verschwindet lautlos; `FactNeeded` wird sichtbar gesetzt und
 * ist im Baum auffindbar.
 */

/** Eine Tatsache, die noch niemand entschieden hat. Wird sichtbar dargestellt. */
export interface FactNeeded {
  readonly missing: string;
}

/** Ein Absatz, der noch aus dem Quelltext kommen muss. */
export interface SourceText {
  readonly source: string;
}

export type Text = string | FactNeeded | SourceText;

export const isFactNeeded = (t: Text): t is FactNeeded =>
  typeof t === 'object' && 'missing' in t;

export const isSourceText = (t: Text): t is SourceText =>
  typeof t === 'object' && 'source' in t;

export interface Area {
  readonly name: string;
  readonly body: Text;
}

export interface PlaceholderCopy {
  readonly title: string;
  readonly body: string;
  readonly preparing: string;
}

/** Eine Zahl, die für sich steht. Nur echte Zahlen — keine geschätzten. */
export interface Fact {
  readonly value: string;
  readonly label: string;
}

/**
 * Ein Schritt des Stufenplans.
 *
 * <b>Der Zustand ist der Punkt.</b> Eine Liste von acht Vorhaben ohne Angabe,
 * was davon läuft, liest sich als Wunschzettel. Mit dem Zustand wird sie zu
 * einer Auskunft: das hier steht schon, das hier wird gerade gebaut, das hier
 * ist Absicht. Nur drei Zustände, und keiner davon heisst „fast fertig".
 */
export type StepState = 'live' | 'building' | 'planned';

export interface RoadStep {
  readonly title: string;
  readonly note: string;
  readonly state: StepState;
}

/** Eine Folie der Startseite. */
export interface Slide {
  /** Das kleine Wort darüber. Sagt, WAS das hier ist. */
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly cta: string;
  readonly facts?: readonly Fact[];
}

/** Ein Abschnitt der Sicherheitsseite: eine Frage, eine Antwort. */
export interface Point {
  readonly q: string;
  readonly a: string;
}

export interface PublicCopy {
  readonly meta: {
    readonly siteName: string;
    readonly description: string;
    readonly titleSuffix: string;
  };

  readonly nav: {
    readonly front: string;
    readonly recreatio: string;
    readonly 'o-nas': string;
    readonly bezpieczenstwo: string;
    readonly przejrzystosc: string;
    readonly kontakt: string;
    readonly osrodek: string;
    readonly wydarzenia: string;
    readonly biblioteka: string;
    readonly cogita: string;
    readonly narzedzia: string;
    readonly wesprzyj: string;

    readonly menu: string;
    readonly skipToContent: string;
    readonly signIn: string;
    readonly platform: string;
    readonly account: string;
    readonly lock: string;
    readonly signOut: string;
    readonly more: string;
  };

  /**
   * Die Startseite erzählt einen Bogen, sie zählt keine Angebote auf.
   *
   *   These   — was falsch läuft, und wogegen sich das hier stellt
   *   Ort     — wo es konkret wird
   *   Beleg   — dass es das schon gibt, nicht erst geplant ist
   *   Werk    — was daraus entstanden ist
   *   Haltung — wie gebaut wird, und warum das eine Aussage ist
   *   Schluss — die vier Wörter, und die ehrliche Zeile darunter
   *
   * Die letzten beiden Folien liegen auf dunklem Grund. Das ist keine
   * Abwechslung: es ist dieselbe Kante wie in der Plattform — hell ist das
   * Haus, dunkel die Werkstatt.
   */
  /**
   * Die Startseite: DREI Bilder, EIN Dokument.
   *
   *   1  Der Name. Sonst nichts.
   *   2  Worum es geht — eine Sicht, keine Leistungsliste.
   *   3  Wie es geschieht — die konkreten Werke.
   *
   * Keine Adresse beim Scrollen, keine Rasterung, kein Abfangen des Rades.
   * Der Besucher bestimmt das Tempo.
   */
  readonly front: {
    readonly screen1: {
      readonly wordmark: string;
      /**
       * Die `h1` der Seite — und die Zeile, die Suchmaschinen und
       * Sprachmodelle zitieren werden. Sie wird NICHT erfunden.
       */
      readonly sentence: Text;
      readonly hint: string;
    };

    /**
     * Das zweite Bild kommt in DREI WELLEN von Blasen.
     *
     *   Welle 1  Titel, der Gedanke, ein Bild
     *   Welle 2  die dreifache Verbindung: in sich, in Gemeinschaft, mit Gott
     *   Welle 3  die Offenheit, in ihren drei Sätzen
     *
     * Die Aufteilung ist nicht erfunden, um Blasen zu füllen: der Quelltext
     * nennt drei Verbindungen und die Offenheit nennt drei Menschen. Die Form
     * folgt dem Inhalt und nicht umgekehrt.
     */
    readonly screen2: {
      readonly title: string;
      readonly lead: string;
      /** Die Blase, in der ein Bild stehen soll — solange keines da ist, sichtbar leer. */
      readonly image: Text;
      readonly relations: readonly { readonly name: string; readonly body: string }[];
      readonly openness: readonly { readonly name: string; readonly body: string }[];
    };

    readonly screen3: {
      readonly title: string;
      /** Dass die Teile verschieden weit sind, steht ausdrücklich da. */
      readonly stages: string;
      readonly works: readonly {
        readonly name: string;
        readonly body: string;
        readonly cta: string;
      }[];
    };
  };

  readonly manifest: {
    readonly title: string;
    readonly opening: { readonly lead: Text; readonly inFormation: string };
    readonly mission: { readonly title: string; readonly body: Text };
    readonly areas: { readonly title: string; readonly items: readonly Area[] };
    readonly inspiration: { readonly title: string; readonly body: Text };
    readonly family: { readonly title: string; readonly body: Text };
    readonly road: {
      readonly title: string;
      readonly intro: Text;
      readonly steps: readonly string[];
    };
    readonly closing: readonly string[];
  };

  /**
   * Warum die Werkzeuge so gebaut sind, wie sie gebaut sind.
   *
   * Diese Seite gehört zu REcreatio und nicht zur Plattform: sie erklärt kein
   * Bedienfeld, sondern eine Haltung. Wer nicht versteht, warum es keinen
   * Verwalter gibt, hält das Fehlen für einen Mangel.
   */
  readonly security: {
    readonly title: string;
    readonly lead: string;
    readonly points: readonly Point[];
    readonly toolsTitle: string;
    readonly toolsIntro: string;
    readonly tools: readonly { readonly name: string; readonly body: string }[];
    readonly originTitle: string;
    readonly origin: string;
  };

  readonly about: {
    readonly title: string;
    readonly lead: string;
    readonly whatInitiativeMeans: { readonly title: string; readonly body: string };
    readonly family: { readonly title: string; readonly body: string };
    readonly road: { readonly title: string; readonly body: string };
    readonly people: { readonly title: string; readonly body: Text };
  };

  readonly transparency: {
    readonly title: string;
    readonly lead: string;
    readonly separation: { readonly title: string; readonly body: string };
    readonly house: { readonly title: string; readonly body: string };
    readonly notYet: { readonly title: string; readonly body: string };
  };

  readonly contact: {
    readonly title: string;
    readonly lead: string;
    readonly email: string;
    readonly address: Text;
    readonly people: Text;
  };

  readonly osrodek: {
    readonly title: string;
    readonly underConstruction: string;
    readonly purpose: { readonly title: string; readonly body: string };
    readonly capacity: {
      readonly title: string;
      readonly body: string;
      readonly exact: Text;
      readonly groups: readonly string[];
    };
    readonly character: { readonly title: string; readonly body: string };
    readonly facilities: { readonly title: string; readonly items: readonly string[] };
    readonly openToOthers: {
      readonly title: string;
      readonly body: string;
      readonly items: readonly string[];
    };
    readonly supports: { readonly title: string; readonly body: string };
    readonly where: { readonly title: string; readonly address: Text };
    readonly photos: Text;

    readonly availability: {
      readonly title: string;
      readonly intro: string;
      readonly showsNothingElse: string;
      readonly free: string;
      readonly held: string;
      readonly taken: string;
      readonly loading: string;
      readonly unreachable: string;
      readonly noAccountNeeded: string;
      readonly month: string;
      readonly nothingPlanned: string;
    };

    readonly enquiry: {
      readonly title: string;
      readonly intro: string;
      readonly brokeredNotBooked: string;
      readonly groupName: string;
      readonly contactPerson: string;
      readonly contact: string;
      readonly from: string;
      readonly to: string;
      readonly people: string;
      readonly groupKind: string;
      readonly note: string;
      readonly submit: string;
      readonly sending: string;
      readonly sent: string;
      readonly sentBody: string;
      readonly failed: string;
      readonly sealedNote: string;
      readonly required: string;
    };
  };

  readonly wesprzyj: {
    readonly title: string;
    readonly lead: string;
    readonly ways: readonly { readonly name: string; readonly body: string }[];
    readonly financialLater: string;
  };

  readonly placeholders: {
    readonly wydarzenia: PlaceholderCopy;
    readonly biblioteka: PlaceholderCopy;
    readonly cogita: PlaceholderCopy;
    readonly narzedzia: PlaceholderCopy;
  };

  readonly notFound: { readonly title: string; readonly body: string; readonly back: string };

  readonly footer: {
    readonly logoAlt: string;
    readonly initiative: string;
  };

  readonly factNeeded: string;
  readonly sourceTextNeeded: string;
}
