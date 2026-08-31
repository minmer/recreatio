/**
 * Die Adressen der öffentlichen REcreatio-Seite — und die EINE Stelle, die
 * sich ändert, wenn die Rautenadressen verschwinden.
 *
 * <b>Warum das eine eigene Datei ist.</b> Die Seite läuft die nächsten Monate
 * mit Rautenadressen auf GitHub Pages und danach auf gewöhnlichen Pfaden. Wäre
 * die Raute über die Seiten verstreut — in jedem `href`, in jedem Vergleich —
 * wäre der Umzug eine Suche-und-Ersetze-Aktion quer durch den Baum, und genau
 * dabei bleibt ein Link zurück, den niemand mehr findet. Hier steht sie
 * genau einmal.
 *
 * <b>Der Umzug später, vollständig:</b>
 *
 *   1. `PUBLIC_BASE` von `'#/rc'` auf `''` setzen — die Seite wird zur
 *      Startseite und liegt auf gewöhnlichen Pfaden.
 *   2. In `main.tsx` `HashRouter` gegen `BrowserRouter` tauschen.
 *   3. Nichts sonst. Die Seiten selbst kennen keine Adresse; sie bekommen
 *      ihre Links aus `publicHref()`.
 *
 * Solange Punkt 1 und 2 nicht geschehen sind, ist die Seite für Suchmaschinen
 * EINE Adresse. Das ist keine Nachlässigkeit, sondern die Folge der Raute:
 * was hinter ihr steht, erreicht den Server nie. Es steht hier, damit niemand
 * später glaubt, es sei übersehen worden.
 */

/**
 * Der Anfang jeder öffentlichen Adresse.
 *
 * `'#/rc'` heisst: die Seite läuft NEBEN dem bestehenden Foliensatz, der unter
 * `'#/'` weiterläuft, bis sie abgenommen ist. Der Tausch ist eine Zeile.
 */
// Ausdruecklich `string` und nicht der enge Literaltyp: sonst haelt der
// Uebersetzer die Vergleiche gegen `''` fuer unmoeglich und meldet genau den
// Zweig als Fehler, der beim Umzug der einzige bleibt.
export const PUBLIC_BASE: string = '#/rc';

/** Die Seiten. Reihenfolge im Menü ist die Reihenfolge hier — sie ist gewollt. */
export const PUBLIC_PAGES = [
  'manifest',
  'osrodek',
  'wydarzenia',
  'biblioteka',
  'cogita',
  'narzedzia',
  'wesprzyj',
  'o-nas',
  'przejrzystosc',
  'kontakt'
] as const;

export type PublicPage = (typeof PUBLIC_PAGES)[number];

export interface PublicRoute {
  /** Das Adresswort. Leer für die Startseite. */
  readonly segment: string;
  /** Steht es in der Hauptnavigation? */
  readonly inMenu: boolean;
  /** Ist die Seite nur ein Platzhalter (Abschnitt 5)? */
  readonly placeholder: boolean;
}

/**
 * Die Adresswörter sind POLNISCH, die Modulteile der Plattform englisch
 * (`parish`, `cogita`, …). Das ist kein Versehen: die öffentliche Seite
 * spricht zuerst polnisch und ihre Adressen werden von Menschen gelesen und
 * weitergegeben; die Modulteile sind technische Namen und stehen in Links, die
 * Maschinen bauen. Wer beides gleich benennt, bekommt entweder polnische
 * Modulnamen im Code oder englische Adressen auf einer polnischen Seite.
 */
export const PUBLIC_ROUTES: Readonly<Record<PublicPage, PublicRoute>> = {
  manifest:       { segment: '',               inMenu: true,  placeholder: false },
  osrodek:        { segment: 'osrodek',        inMenu: true,  placeholder: false },
  wydarzenia:     { segment: 'wydarzenia',     inMenu: true,  placeholder: true },
  biblioteka:     { segment: 'biblioteka',     inMenu: true,  placeholder: true },
  cogita:         { segment: 'cogita',         inMenu: true,  placeholder: true },
  narzedzia:      { segment: 'narzedzia',      inMenu: true,  placeholder: true },
  wesprzyj:       { segment: 'wesprzyj',       inMenu: true,  placeholder: false },

  // Kinder des Manifests. Sie stehen nicht im Menü — fünf bis sieben Punkte
  // sind die Grenze, ab der eine Navigation nicht mehr überblickt wird.
  'o-nas':        { segment: 'o-nas',          inMenu: false, placeholder: false },
  przejrzystosc:  { segment: 'przejrzystosc',  inMenu: false, placeholder: false },
  kontakt:        { segment: 'kontakt',        inMenu: false, placeholder: false }
};

/** Die Punkte der Hauptnavigation, in der festgelegten Reihenfolge. */
export const PUBLIC_MENU: readonly PublicPage[] =
  PUBLIC_PAGES.filter((page) => PUBLIC_ROUTES[page].inMenu);

/**
 * Die Adresse einer Seite, wie sie in ein `href` gehört.
 *
 * Immer ein echtes `href` und nie ein Klickbehandler: ein Klickbehandler lässt
 * sich nicht in einem neuen Tab öffnen, nicht kopieren, nicht vorlesen und
 * nicht von einer Suchmaschine verfolgen.
 */
export function publicHref(page: PublicPage): string {
  const { segment } = PUBLIC_ROUTES[page];
  if (segment === '') return PUBLIC_BASE === '' ? '/' : PUBLIC_BASE;
  return PUBLIC_BASE === '' ? `/${segment}` : `${PUBLIC_BASE}/${segment}`;
}

/**
 * Welche Seite meint diese Adresse?
 *
 * Kennt sie niemand, ist die Antwort `null` — und der Aufrufer zeigt eine
 * ehrliche „gibt es nicht"-Seite statt stillschweigend die Startseite. Eine
 * unbekannte Adresse auf die Startseite umzuleiten verbirgt kaputte Links
 * genau so lange, bis jemand sich wundert, warum niemand ankommt.
 */
export function publicPageOf(hash: string): PublicPage | null {
  const cut = hash.indexOf('#');
  const raw = cut >= 0 ? hash.slice(cut) : hash;

  const base = PUBLIC_BASE;
  let rest: string;

  if (base === '') {
    rest = raw.startsWith('#') ? raw.slice(1) : raw;
  } else if (raw === base) {
    rest = '';
  } else if (raw.startsWith(`${base}/`)) {
    rest = raw.slice(base.length);
  } else {
    return null;
  }

  const segment = rest.split('?')[0].split('&')[0].split('/').filter(Boolean)[0] ?? '';

  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Eine kaputt kodierte Adresse ist eine unbekannte Adresse, kein Absturz.
    return null;
  }

  return PUBLIC_PAGES.find((page) => PUBLIC_ROUTES[page].segment === decoded) ?? null;
}

/** Liegt diese Adresse überhaupt im öffentlichen Teil? */
export const isPublicAddress = (hash: string): boolean => {
  const cut = hash.indexOf('#');
  const raw = cut >= 0 ? hash.slice(cut) : hash;
  return PUBLIC_BASE === '' ? true : raw === PUBLIC_BASE || raw.startsWith(`${PUBLIC_BASE}/`);
};
