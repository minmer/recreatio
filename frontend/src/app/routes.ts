/**
 * Das zentrale Register der Adressen — für den Neubau.
 *
 * <b>Warum ein Register und nicht freier Text.</b> Steht ein Wort hier, kann
 * keine Organisation, keine Gruppe und kein Ereignis es mehr als Namen tragen.
 * Genau das macht `#/<wort>` auflösbar, OHNE den Dienst zu fragen — der
 * Browser weiß aus der Adresse allein, was er zu laden hat, und ob dafür
 * jemand angemeldet sein muss.
 *
 * <b>Die Regel: der Teil steht vor dem einzelnen Ding.</b> Nicht `#/schola`,
 * sondern `#/workspace/groups/schola`. Ohne den Teil davor teilen sich alle
 * Module EINEN Namensraum, und eine Gruppe, die `account` heißen möchte,
 * verschluckte ein Modul.
 *
 * <b>Kein `#/new` mehr.</b> Der Neubau ist nicht mehr der Parallelbau neben
 * dem Altbestand — er ist die Plattform. Er liegt deshalb direkt hinter der
 * Raute. Die Raute selbst bleibt: GitHub Pages liefert für `/workspace` keine
 * Datei aus, weil es die Route nicht kennt; hinter der Raute bleibt es für den
 * Server ein Aufruf der Startseite.
 */

interface RouteDef {
  /**
   * Benennt dieser Teil einzelne Dinge?
   *
   * `false` heißt NICHT „hat keine Unterseiten", sondern „das nächste Segment
   * ist kein Name eines Dings". `#/workspace/groups` ist eine Ansicht des
   * Arbeitsplatzes und keine Gruppe namens `groups`.
   */
  readonly slugged: boolean;

  /** Muss bekannt sein, WER hier ist, bevor das erste Bild entsteht? */
  readonly needsIdentity: boolean;
}

/**
 * Die Teile. Bewusst eine feste Liste: ein Tippfehler wird zum
 * Übersetzungsfehler statt zu einer stillschweigend leeren Seite.
 *
 * Heute steht nur der Arbeitsplatz darin. Er ist das erste Stück des Neubaus,
 * und alles Weitere hängt an ihm — Organisationen, Gruppen, Ereignisse kommen
 * als eigene Teile dazu, wenn sie gebaut sind. Ein Register, das Adressen
 * enthält, die es noch nicht gibt, ist ein Register, dem man nicht glaubt.
 */
export const ROUTES = {
  /**
   * Der Arbeitsplatz — was DIESER Mensch hier zu tun hat.
   *
   * Es gibt nur einen: deinen. Ein Name dahinter wäre der Arbeitsplatz eines
   * anderen, und den gibt es nicht zu sehen.
   */
  workspace: { slugged: false, needsIdentity: true }
} as const satisfies Readonly<Record<string, RouteDef>>;

export type Route = keyof typeof ROUTES;

/** Der Teil zu einem Wort, oder `null`, wenn das Wort keiner ist. */
export function routeOf(word: string): Route | null {
  // `hasOwnProperty` und nicht `in`: sonst wäre `#/constructor` ein Teil.
  return Object.prototype.hasOwnProperty.call(ROUTES, word) ? (word as Route) : null;
}

export interface Address {
  readonly route: Route;
  /** Das einzelne Ding — `null`, wenn keines benannt ist. */
  readonly slug: string | null;
  /** Was danach kommt: `#/workspace/groups/schola` ergibt `['schola']`. */
  readonly tail: readonly string[];
  /**
   * Ein erstes Segment, das kein Teil ist.
   *
   * Es wird NICHT stillschweigend zur Startseite: wer so einen Link bekommen
   * hat, soll erfahren, dass ihm der Teil fehlt, statt auf einer Seite zu
   * landen, die er nicht gesucht hat.
   */
  readonly stray: string | null;
}

const HOME: Address = { route: 'workspace', slug: null, tail: [], stray: null };

/** Die Adresse zerlegen. Nimmt die Raute mitsamt allem davor. */
export function parsePath(hash: string): Address {
  const marker = hash.indexOf('#');
  const afterHash = marker >= 0 ? hash.slice(marker + 1) : hash;

  // Alles ab `?` oder `&` gehört nicht mehr zum Pfad. Ein Geheimnis im
  // Fragment darf davon nichts abbekommen.
  const path = afterHash.split(/[?&]/)[0];

  const segments: string[] = [];
  for (const raw of path.split('/')) {
    if (raw.length === 0) continue;
    try {
      segments.push(decodeURIComponent(raw));
    } catch {
      // Eine kaputte Kodierung ist kein Absturz — das Segment gilt roh.
      segments.push(raw);
    }
  }

  if (segments.length === 0) return HOME;

  const route = routeOf(segments[0]);
  if (route === null) {
    return { route: 'workspace', slug: null, tail: [], stray: segments[0] };
  }

  const rest = segments.slice(1);
  const slugged = ROUTES[route].slugged;

  return {
    route,
    slug: slugged ? (rest[0] ?? null) : null,
    tail: slugged ? rest.slice(1) : rest,
    stray: null
  };
}

/** Die Adresse eines Teils. */
export function path(route: Route, slug?: string | null, ...tail: readonly string[]): string {
  if (slug !== undefined && slug !== null && slug !== '' && !ROUTES[route].slugged) {
    throw new Error(`Der Teil "${route}" benennt keine einzelnen Dinge — "${slug}" gehört nicht dahinter.`);
  }

  const words = [route, slug ?? '', ...tail]
    .filter((word) => word.length > 0)
    .map(encodeURIComponent);

  return `#/${words.join('/')}`;
}

/** Muss vor dem ersten Bild bekannt sein, wer hier ist? */
export function needsIdentity(address: Address): boolean {
  return ROUTES[address.route].needsIdentity;
}

/* -- Die Ansichten des Arbeitsplatzes ---------------------------------------
 *
 * Eine Kachel, die sich öffnet, ist eine ADRESSE und kein Zustand im Speicher:
 * `#/workspace/pages` lässt sich verschicken, neu laden und mit dem Zurück-Pfeil
 * des Browsers verlassen. Als `useState` wäre der Zurück-Pfeil des Browsers die
 * Abmeldung — er verliesse den Arbeitsplatz statt die Kachel.
 *
 * Der Pfeil in der Ansicht führt deshalb auf `#/workspace` und nicht auf
 * `history.back()`: wer über einen Link hereinkommt, hat kein Zurück.
 */
export const VIEWS = {
  calendar: 'Kalendarz',
  chat: 'Rozmowy',
  pages: 'Strony',
  roles: 'Role'
} as const;

export type View = keyof typeof VIEWS;

/** Wo im Arbeitsplatz wir stehen. */
export type Spot =
  | { readonly kind: 'tiles' }
  | { readonly kind: 'view'; readonly view: View }
  | { readonly kind: 'stray'; readonly word: string };

export function spotOf(address: Address): Spot {
  const first = address.tail[0];
  if (first === undefined) return { kind: 'tiles' };

  // `hasOwnProperty` und nicht `in`: sonst wäre `#/workspace/constructor` eine Ansicht.
  return Object.prototype.hasOwnProperty.call(VIEWS, first)
    ? { kind: 'view', view: first as View }
    : { kind: 'stray', word: first };
}

/** Die Adresse einer Ansicht. */
export const viewPath = (view: View): string => path('workspace', null, view);

/** Die Adresse der Kacheln — das Ziel jedes Zurück-Pfeils. */
export const tilesPath = (): string => path('workspace');
