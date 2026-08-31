/**
 * Die Form der öffentlichen Texte.
 *
 * <b>Kein Text steht in einer Komponente.</b> Im Altbestand sind zwei Folien
 * fest im Bauteil verdrahtet — „Cogita Graph" auf Englisch, „Biblioteka" auf
 * Polnisch — und übersetzen sich deshalb in keiner Sprache. Diese Form ist die
 * Vorkehrung dagegen: was hier nicht steht, kann eine Seite nicht anzeigen.
 *
 * <b>Fehlende Tatsachen sind ein eigener Typ</b>, kein leerer String. Ein
 * leerer String verschwindet lautlos; `RcFactNeeded` wird sichtbar gesetzt und
 * ist im Baum auffindbar. Abschnitt 7 verlangt genau das.
 */

/** Eine Tatsache, die noch niemand entschieden hat. Wird sichtbar dargestellt. */
export interface FactNeeded {
  readonly missing: string;
}

/** Ein Absatz, der aus dem polnischen Quelltext kommt und nicht erfunden wird. */
export interface SourceText {
  readonly source: string;
}

/** Ein Text ist entweder da, oder er fehlt sichtbar. */
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
  /** Die eine ehrliche Zeile: das hier wird vorbereitet. Kein Datum. */
  readonly preparing: string;
}

export interface PublicCopy {
  readonly meta: {
    readonly siteName: string;
    readonly description: string;
    /** Der Zusatz im Fensterttitel hinter dem Seitennamen. */
    readonly titleSuffix: string;
  };

  readonly nav: {
    readonly manifest: string;
    readonly osrodek: string;
    readonly wydarzenia: string;
    readonly biblioteka: string;
    readonly cogita: string;
    readonly narzedzia: string;
    readonly wesprzyj: string;
    readonly 'o-nas': string;
    readonly przejrzystosc: string;
    readonly kontakt: string;
    readonly menu: string;
    readonly skipToContent: string;

    /** Der Knopf rechts oben, abgemeldet. */
    readonly signIn: string;
    /** Derselbe Knopf, angemeldet — er führt in die Plattform, nicht ins Profil. */
    readonly platform: string;
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
      /** Was die Insel NICHT zeigt — steht auf der Seite, nicht nur im Code. */
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
      /** Der Satz, der den Unterschied zur Buchung macht. */
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
    /** Die eine ehrliche Zeile zur finanziellen Unterstützung. Mehr nicht. */
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
    readonly platform: string;
  };

  readonly factNeeded: string;
  readonly sourceTextNeeded: string;
}
