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
  workspace: { slugged: false, needsIdentity: true },

  /**
   * Ein individueller Platz — `#/seat/<token>/<key>`.
   *
   * <b>Ohne Konto</b>, und das ist der ganze Zweck: ein Firmkandidat ist
   * vierzehn und hat keines. Der Link IST der Ausweis.
   *
   * <b>Beide Teile stehen hinter der Raute.</b> Der Server einer statischen
   * Seite sieht davon nichts; in seinem Protokoll steht, dass jemand die
   * Startseite geholt hat. Der Browser schickt danach NUR das Token an den
   * Dienst — der Schlüssel bleibt hier und öffnet den Platz.
   */
  seat: { slugged: true, needsIdentity: false }
} as const satisfies Readonly<Record<string, RouteDef>>;

export type Route = keyof typeof ROUTES;

/**
 * Die Adressen, die der NEUBAU ausliefert.
 *
 * <b>Warum hier eine Liste steht und nicht eine Frage an den Dienst.</b> Die
 * Weiche in `main.tsx` entscheidet, BEVOR irgendetwas geladen ist, ob der
 * Altbestand oder der Neubau die Adresse bekommt — und sie kann dabei nicht auf
 * eine Antwort warten. Eine übernommene Adresse, die hier fehlt, landete beim
 * Altbestand, der sie nicht kennt.
 *
 * Die Liste ist damit der Spiegel von `app.slug` im Browser, und jede neue
 * Seite kostet einen Bau. Das ist der Preis für eine Weiche ohne Wartezeit;
 * wenn der Altbestand fort ist, fällt er weg — dann gehört jede Adresse dem
 * Neubau, und diese Liste verschwindet.
 */
export const PAGES = ['parish', 'start', 'lo13'] as const;

export const isPage = (word: string): boolean => (PAGES as readonly string[]).includes(word);

/**
 * Der Name, unter dem die Plattform zu Hause ist.
 *
 * <b>Alles andere ist eine EIGENE Domain</b> — cogita.pl zum Beispiel, die eine
 * Seite zeigt, die auf recreatio.pl verwaltet wird. Dort gilt die Adresszeile
 * nicht: der Name selbst sagt, welche Seite gemeint ist, und den fragt der
 * Browser beim Dienst nach (`site.ts`).
 *
 * Steht hier und nicht in `site.ts`, weil die Weiche in `main.tsx` es wissen
 * muss, BEVOR irgendetwas geladen ist — und diese Datei bringt nichts mit.
 */
export const PRIMARY_HOST = 'recreatio.pl';

/**
 * Der eigene Name dieser Seite — oder `null`, wenn wir zu Hause sind.
 *
 * Die Entwicklung zählt nicht als fremd: dort läuft alles unter localhost, und
 * eine Adresszeile, die dann plötzlich nach einer Domain fragt, machte jeden
 * Entwicklungslauf zu einer Fehlersuche.
 */
export function foreignHost(): string | null {
  if (typeof window === 'undefined') return null;

  const host = window.location.hostname.toLowerCase();

  if (host === PRIMARY_HOST || host === `www.${PRIMARY_HOST}`) return null;
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return null;

  return host;
}

/** Der Teil zu einem Wort, oder `null`, wenn das Wort keiner ist. */
export function routeOf(word: string): Route | null {
  // `hasOwnProperty` und nicht `in`: sonst wäre `#/constructor` ein Teil.
  return Object.prototype.hasOwnProperty.call(ROUTES, word) ? (word as Route) : null;
}

/**
 * Ein individueller Platz, aus der Adresse gelesen.
 *
 * Zwei Teile, und sie tun Verschiedenes: `token` geht an den Dienst und sagt,
 * WELCHER Platz gemeint ist; `key` geht nie hinaus und öffnet ihn. Beide stehen
 * hinter der Raute — der Server einer statischen Seite sieht davon nichts.
 */
export interface Seat {
  readonly token: string;
  /** `null`, wenn der Link ohne zweiten Teil ankam — dann bleibt der Inhalt zu. */
  readonly key: string | null;
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

  /**
   * Eine öffentliche Seite (`#/parish`), oder `null`.
   *
   * Steht hier etwas, ist `route` bedeutungslos: die Adresse gehört keinem Teil
   * des Arbeitsplatzes, sondern der Welt draussen.
   */
  readonly page: string | null;

  /**
   * Ein Platz — `#/lo13/portal/<token>/<key>` oder `#/seat/<token>/<key>`.
   *
   * Die erste Form gehört einer Seite: der Schüler liest die Adresse seiner
   * Schule und dahinter seinen Platz, und das ist die Ordnung, die er erwartet.
   * Die zweite bleibt für Plätze, die unter keiner Seite hängen.
   */
  readonly seat: Seat | null;
}

/**
 * `recreatio.pl` ohne alles.
 *
 * <b>Die Wurzel ist eine SEITE</b>, nicht der Arbeitsplatz: im Register steht
 * sie als leerer Pfad und zeigt als Alias auf `start`. Wer hier ankommt, ist
 * meistens ein Besucher — und der bekommt die Seite, nicht ein Anmeldeformular.
 */
const HOME: Address = { route: 'workspace', slug: null, tail: [], stray: null, page: '', seat: null };

/**
 * Das Wort, hinter dem ein Platz beginnt.
 *
 * Es ist im Register gesperrt (`Slug.IsReserved`), damit niemand eine
 * Unterseite so nennt — sie verdeckte sonst jeden Schülerlink, und zwar
 * lautlos, denn beide Adressen sähen gleich aus.
 */
const PORTAL = 'portal';

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

  /*
   * Eine öffentliche Seite steht VOR der Suche nach einem Teil: `#/parish` ist
   * keine Ansicht des Arbeitsplatzes, und niemand muss dafür angemeldet sein.
   * Der ganze Pfad gehört ihr — `#/parish/proby` ist EINE Adresse und nicht
   * eine Adresse mit einem Anhängsel.
   */
  if (isPage(segments[0])) {
    /*
     * `lo13/portal/<token>/<key>` ist KEINE Unterseite von lo13, sondern der
     * Platz eines Menschen. Die Seite davor bleibt stehen — sie sagt ihm, wo er
     * ist —, aber geladen wird der Platz.
     */
    const at = segments.indexOf(PORTAL);

    if (at > 0) {
      return {
        route: 'workspace', slug: null, tail: [], stray: null,
        page: segments.slice(0, at).join('/'),
        seat: { token: segments[at + 1] ?? '', key: segments[at + 2] ?? null }
      };
    }

    return {
      route: 'workspace', slug: null, tail: [], stray: null,
      page: segments.join('/'), seat: null
    };
  }

  const route = routeOf(segments[0]);
  if (route === null) {
    return { route: 'workspace', slug: null, tail: [], stray: segments[0], page: null, seat: null };
  }

  const rest = segments.slice(1);
  const slugged = ROUTES[route].slugged;

  return {
    route,
    slug: slugged ? (rest[0] ?? null) : null,
    tail: slugged ? rest.slice(1) : rest,
    stray: null,
    page: null,

    /*
     * Die allgemeine Form, für Plätze ohne Seite darüber. Sie ergibt DENSELBEN
     * Befund wie die seitenlokale — damit die Anwendung genau eine Stelle hat,
     * an der sie einen Platz erkennt.
     */
    seat: route === 'seat' ? { token: rest[0] ?? '', key: rest[1] ?? null } : null
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

/**
 * Die Form eines Pfades im Register — dieselbe wie `ck_slug_path` und
 * `Slug.Shape()` im Dienst.
 *
 * Steht hier und nicht in einer Ansicht: zwei Fassungen derselben Prüfung laufen
 * auseinander, und die lockerere gewinnt dann still, bis die Datenbank ablehnt.
 */
export const PATH_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

/** Die Adresse einer öffentlichen Seite. */
export const pagePath = (path: string): string =>
  `#/${path.split('/').map(encodeURIComponent).join('/')}`;

/**
 * Der Pfad unter einer EIGENEN Domain — und zwar der lokale.
 *
 * <b>Unter cogita.pl heisst `cogita/kursy` schlicht `#/kursy`.</b> Welche
 * Wurzel dieser Name bedeutet, weiss nur das Register; der Browser schickt
 * deshalb bloss das Stück hinter der Raute mit und lässt den Dienst davorsetzen.
 *
 * Der Grund ist nicht Schönheit, sondern Haltbarkeit: schrieben die Verweise
 * einer Seite den ganzen Pfad, wäre derselbe Link auf recreatio.pl richtig und
 * auf cogita.pl falsch — eine Seite unter zwei Namen hätte zwei Sorten Links,
 * von denen immer eine bricht.
 *
 * `parsePath` taugt hier nicht: dort ist das erste Wort ein Teil oder eine
 * Seite, hier ist es der Anfang eines lokalen Pfades.
 */
export function localPath(hash: string): string {
  const marker = hash.indexOf('#');
  const afterHash = marker >= 0 ? hash.slice(marker + 1) : hash;

  // Alles ab `?` oder `&` gehört nicht mehr zum Pfad.
  return afterHash.split(/[?&]/)[0]
    .split('/')
    .filter((raw) => raw.length > 0)
    .map((raw) => {
      try { return decodeURIComponent(raw); } catch { return raw; }
    })
    .join('/');
}

/** Muss vor dem ersten Bild bekannt sein, wer hier ist? */
export function needsIdentity(address: Address): boolean {
  // Eine öffentliche Seite wartet auf niemanden: sie wird ohne Konto
  // ausgeliefert, und ein Anmeldeformular davor wäre schlicht falsch.
  if (address.page !== null) return false;

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
  /*
   * Die Bereiche stehen VOR dem Kalender, weil sie unter ihm liegen: ein
   * Kalender gehört einem Bereich, und ein Bereich ist ein benannter Schlüssel
   * mit seinen Epochen — kein Anhängsel einer Organisation. Wer den Kalender
   * zuerst sucht, findet hier, woran er hängt.
   */
  areas: 'Obszary',
  calendar: 'Kalendarz',
  chat: 'Rozmowy',
  pages: 'Strony',
  addresses: 'Adresy i domeny',
  roles: 'Role',

  /*
   * Das Konto selbst — und die eine Entscheidung, die daran hängt: wie lange
   * der Schlüssel lebt. Sie steht NICHT bei „Obszary": dort geht es um
   * Schlüssel, die Inhalte öffnen, hier um den, der das Konto öffnet.
   */
  account: 'Konto'
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
