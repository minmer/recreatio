/**
 * Die Adressen der öffentlichen REcreatio-Seite — und die EINE Stelle, die
 * sich ändert, wenn die Rautenadressen verschwinden.
 *
 * <b>Der Umzug später, vollständig:</b>
 *
 *   1. `PUBLIC_BASE` von `'#/rc'` auf `''` setzen.
 *   2. In `main.tsx` `HashRouter` gegen `BrowserRouter` tauschen.
 *   3. Nichts sonst. Die Seiten kennen keine Adresse; sie bekommen ihre Links
 *      aus `publicHref()`.
 *
 * DOMAENENWECHSEL — dieser Umzug und der der Plattform gehören zusammen; die
 * vollständige Liste steht in `rc/lib/rcOrigins.ts`.
 *
 * Solange 1 und 2 nicht geschehen sind, ist die Seite für Suchmaschinen EINE
 * Adresse. Das ist die Folge der Raute — was hinter ihr steht, erreicht den
 * Server nie — und steht hier, damit es niemand später für ein Versehen hält.
 */

// Ausdruecklich `string` und nicht der enge Literaltyp: sonst haelt der
// Uebersetzer die Vergleiche gegen `''` fuer unmoeglich und meldet genau den
// Zweig als Fehler, der beim Umzug der einzige bleibt.
export const PUBLIC_BASE: string = '#/rc';

export const PUBLIC_PAGES = [
  'front',
  'recreatio',
  'o-nas',
  'bezpieczenstwo',
  'przejrzystosc',
  'kontakt',
  'osrodek',
  'wydarzenia',
  'biblioteka',
  'cogita',
  'narzedzia',
  'wesprzyj'
] as const;

export type PublicPage = (typeof PUBLIC_PAGES)[number];

export interface PublicRoute {
  /** Das Adresswort. Leer für die Startseite. */
  readonly segment: string;
  /** Ist die Seite nur ein Platzhalter? */
  readonly placeholder: boolean;
}

/**
 * Die Adresswörter sind POLNISCH, die Modulteile der Plattform englisch
 * (`parish`, `cogita`, …). Das ist kein Versehen: die öffentliche Seite spricht
 * zuerst polnisch, ihre Adressen werden von Menschen gelesen und
 * weitergegeben; die Modulteile stehen in Links, die Maschinen bauen.
 */
export const PUBLIC_ROUTES: Readonly<Record<PublicPage, PublicRoute>> = {
  front:          { segment: '',                placeholder: false },

  recreatio:      { segment: 'recreatio',       placeholder: false },
  'o-nas':        { segment: 'o-nas',           placeholder: false },
  bezpieczenstwo: { segment: 'bezpieczenstwo',  placeholder: false },
  przejrzystosc:  { segment: 'przejrzystosc',   placeholder: false },
  kontakt:        { segment: 'kontakt',         placeholder: false },

  osrodek:        { segment: 'osrodek',         placeholder: false },
  wydarzenia:     { segment: 'wydarzenia',      placeholder: true },
  biblioteka:     { segment: 'biblioteka',      placeholder: true },
  cogita:         { segment: 'cogita',          placeholder: true },
  narzedzia:      { segment: 'narzedzia',       placeholder: true },
  wesprzyj:       { segment: 'wesprzyj',        placeholder: false }
};

/**
 * Die Hauptnavigation. Reihenfolge ist Absicht und wird nicht umgestellt.
 *
 * <b>REcreatio trägt seine Unterseiten sichtbar.</b> Sie im Fusstext zu
 * verstecken hiesse, dass „wer sind wir" schwerer zu finden ist als „was
 * bieten wir an" — bei einer Einrichtung, die sich vorstellt, genau
 * verkehrt herum.
 */
export interface MenuEntry {
  readonly page: PublicPage;
  readonly children?: readonly PublicPage[];
}

export const PUBLIC_MENU: readonly MenuEntry[] = [
  { page: 'recreatio', children: ['o-nas', 'bezpieczenstwo', 'przejrzystosc', 'kontakt'] },
  { page: 'osrodek' },
  { page: 'wydarzenia' },
  { page: 'biblioteka' },
  { page: 'cogita' },
  { page: 'narzedzia' },
  { page: 'wesprzyj' }
];

/** Zu welchem Menüpunkt gehört diese Seite? Für die Markierung „hier bist du". */
export function menuParentOf(page: PublicPage | null): PublicPage | null {
  if (page === null) return null;
  for (const entry of PUBLIC_MENU) {
    if (entry.page === page) return entry.page;
    if (entry.children?.includes(page) === true) return entry.page;
  }
  return null;
}

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
 * Unbekannt ergibt `null` — und der Aufrufer zeigt eine ehrliche „gibt es
 * nicht"-Seite statt stillschweigend die Startseite. Eine Umleitung verbirgt
 * kaputte Verweise genau so lange, bis jemand sich wundert, warum über einen
 * verteilten Link niemand ankommt.
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
