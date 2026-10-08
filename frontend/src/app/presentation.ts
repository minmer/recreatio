/**
 * PREZENTACJA (0085) — die dritte Art einer Seite: SZENEN, auf denen die
 * Bausteine frei stehen.
 *
 * <code>
 *   Seite (slug.page_mode)   'page' — Raster · 'slides' — je Baustein ein Bildschirm · 'presentation'
 *   Aussehen (page_theme)    die Farben wie bei den Slajdy, dazu "show": Format, Schriften, Szenen
 *   Baustein (layout.show)   wo er auf welcher Szene steht, wie er aussieht, wie er kommt
 * </code>
 *
 * <b>Der Grundstein ist die Startseite des Altbestands</b> (`legacy/public/
 * pages/FrontPage.tsx`): ein Raum, durch den die Kamera fliegt, Szenen, auf
 * denen mehrere Blasen an einem Faden hängen und die Betonung von einer zur
 * nächsten wandert, vier Viertel, die von den Seiten hereinfahren, ein Kreis,
 * der zum Grund des letzten Bildes wächst, und ein Zeichen, das dabei in die
 * Ecke wandert. Alles davon ist hier ALLGEMEIN gesagt — eine Szene hat
 * Schritte, ein Baustein einen Platz je Szene —, damit dieselben Regler eine
 * Startseite, einen Vortrag oder eine Andacht tragen.
 *
 * <b>Eine Szene ist eine Strecke, kein Punkt</b> (wie im Altbestand): sie hat
 * `steps` Stellen. Gerastet wird an ihrem Anfang; dazwischen läuft es frei, und
 * die Betonung wandert über die Bausteine, die einen Schritt tragen.
 *
 * <b>Ein Baustein steht auf einer Szene</b> (ein Platz) und kommt und geht mit
 * ihr — oder er WANDERT (Plätze auf mehreren Szenen, oder `hold`): dann steht
 * er über den Szenen und gleitet von Platz zu Platz.
 *
 * <b>Duldsam wie alles, was als Zeichenkette vom Dienst kommt</b>: was nicht
 * passt, nimmt die Vorgabe an; geworfen wird nie.
 */

import type { Layout } from './layout';
import { COLOR_KEYS, readLayers, type Layer, type SlideColors } from './slides';

/* -- Wörterbücher ------------------------------------------------------------------ */

/**
 * WIE EINE SZENE DIE VORIGE ABLÖST. Gerechnet aus der Stelle der Bahn, nicht
 * aus einer Uhr (wie 0084): wer langsam zieht, sieht es langsam.
 *
 * `fly` ist der Flug des Altbestands: die Kamera fährt durch die VORIGE Szene
 * (deren Bausteine mit Tiefe und Wortwolke vorbeiziehen), während diese darunter
 * aufgeht.
 */
export const SCENE_CHANGES = ['fade', 'build', 'fly', 'rise', 'zoom', 'cover', 'reveal', 'side', 'cut'] as const;
export type SceneChange = (typeof SCENE_CHANGES)[number];

export const SCENE_CHANGE_LABEL: Record<SceneChange, string> = {
  fade: 'Przenikanie — poprzednia gaśnie, ta się pojawia',
  build: 'Złożenie — scena jest od razu, jej moduły wchodzą każdy po swojemu',
  fly: 'Przelot — kamera leci przez poprzednią scenę (jej głębię i chmurę słów)',
  rise: 'Wynurzenie — ta podnosi się lekko z dołu',
  zoom: 'Przybliżenie — poprzednia rośnie i znika, ta wyłania się z głębi',
  cover: 'Nakrycie — ta wjeżdża od dołu na poprzednią',
  reveal: 'Odsłonięcie — poprzednia odjeżdża w górę i odsłania tę',
  side: 'Z boku — ta wjeżdża z prawej, poprzednia odsuwa się w lewo',
  cut: 'Cięcie — bez przejścia'
};

/** Wie ein Baustein erscheint, wenn seine Szene kommt (oder er seine erste erreicht). */
export const ARRIVALS = ['none', 'fade', 'rise', 'zoom', 'grow', 'left', 'right', 'from-left', 'from-right', 'from-top', 'from-bottom'] as const;
export type Arrival = (typeof ARRIVALS)[number];

export const ARRIVAL_LABEL: Record<Arrival, string> = {
  none: 'Jest od razu',
  fade: 'Rozjaśnia się',
  rise: 'Wynurza się z dołu',
  zoom: 'Przybliża się',
  grow: 'Wyrasta z punktu',
  left: 'Wsuwa się z lewej',
  right: 'Wsuwa się z prawej',
  'from-left': 'Wjeżdża zza lewej krawędzi',
  'from-right': 'Wjeżdża zza prawej krawędzi',
  'from-top': 'Zjeżdża z góry',
  'from-bottom': 'Wjeżdża od dołu'
};

/** Wie der Baustein auf der Szene aussieht — die Hülle, nicht der Inhalt. */
export const SKINS = ['plain', 'card', 'bubble', 'pill', 'panel'] as const;
export type Skin = (typeof SKINS)[number];

export const SKIN_LABEL: Record<Skin, string> = {
  plain: 'Bez tła — sam napis, logo, obraz',
  card: 'Tafla',
  bubble: 'Bańka — zaokrąglona, z cieniem',
  pill: 'Pigułka — jedna linijka',
  panel: 'Pole — wypełnia swój prostokąt kolorem (i obrazem)'
};

/** Wie ein TEXT darauf steht. `auto`: wie auf der Seite (der Baustein selbst). */
export const TEXT_TYPES = ['auto', 'display', 'title', 'heading', 'kicker', 'body', 'close', 'note'] as const;
export type TextType = (typeof TEXT_TYPES)[number];

export const TEXT_TYPE_LABEL: Record<TextType, string> = {
  auto: 'Jak na stronie',
  display: 'Wielki napis — zdanie przewodnie (nagłówek strony)',
  title: 'Tytuł — wersaliki',
  heading: 'Nagłówek z treścią',
  kicker: 'Nagłówek w kolorze akcentu z treścią',
  body: 'Akapity',
  close: 'Puenta — kursywa w kolorze akcentu, pusta linia dzieli grupy',
  note: 'Dopisek — mały, rozstrzelony'
};

/**
 * WELCHER PUNKT DES BAUSTEINS auf `x`, `y` steht — die Mitte (Vorgabe) oder
 * eine Ecke, eine Kante. Ein Text, der oben links unter einem Zeichen anfängt,
 * steht mit seiner Ecke dort, gleich wie lang er wird.
 */
export const ORIGINS = ['center', 'top-left', 'top', 'top-right', 'left', 'right', 'bottom-left', 'bottom', 'bottom-right'] as const;
export type Origin = (typeof ORIGINS)[number];

export const ORIGIN_LABEL: Record<Origin, string> = {
  center: 'Środek', 'top-left': 'Lewy górny róg', top: 'Środek góry', 'top-right': 'Prawy górny róg', left: 'Środek lewej',
  right: 'Środek prawej', 'bottom-left': 'Lewy dolny róg', bottom: 'Środek dołu', 'bottom-right': 'Prawy dolny róg'
};

/** Wo der Punkt im Baustein liegt — Anteile seiner Breite und Höhe. */
export const ORIGIN_AT: Record<Origin, { readonly x: number; readonly y: number }> = {
  center: { x: 0.5, y: 0.5 }, 'top-left': { x: 0, y: 0 }, top: { x: 0.5, y: 0 }, 'top-right': { x: 1, y: 0 }, left: { x: 0, y: 0.5 },
  right: { x: 1, y: 0.5 }, 'bottom-left': { x: 0, y: 1 }, bottom: { x: 0.5, y: 1 }, 'bottom-right': { x: 1, y: 1 }
};

/** Wie ein wandernder Baustein von einem Platz zum nächsten gleitet. */
export const EASES = ['inOut', 'linear', 'in', 'out'] as const;
export type Ease = (typeof EASES)[number];

export const EASE_LABEL: Record<Ease, string> = {
  inOut: 'Łagodnie rusza i hamuje',
  linear: 'Równo',
  in: 'Przyspiesza (jak rosnące koło)',
  out: 'Hamuje'
};

/**
 * DAS FORMAT. `screen` füllt das Fenster (eine Startseite — auf dem Telefon
 * hochkant, mit eigenen Plätzen); `wide` und `classic` sind feste Bilder
 * (16 : 9, 4 : 3), die wie eine Folie mit dem Fenster wachsen — für Vorträge.
 */
export const FORMATS = ['screen', 'wide', 'classic'] as const;
export type Format = (typeof FORMATS)[number];

export const FORMAT_LABEL: Record<Format, string> = {
  screen: 'Cały ekran — jak strona startowa (telefon pionowo, z własnymi miejscami)',
  wide: 'Slajd 16 : 9 — jak w programie do prezentacji',
  classic: 'Slajd 4 : 3'
};

/** Das Seitenverhältnis eines festen Formats — `null`: das Fenster. */
export const ASPECT: Record<Format, number | null> = { screen: null, wide: 16 / 9, classic: 4 / 3 };

/** Schriftpaare — von Google Fonts, erst geladen, wenn eine Präsentation sie nimmt. */
export const FONT_PAIRS = ['app', 'spectral', 'cormorant', 'plex'] as const;
export type FontPair = (typeof FONT_PAIRS)[number];

export const FONT_LABEL: Record<FontPair, string> = {
  app: 'Jak aplikacja',
  spectral: 'Spectral + IBM Plex Sans (strona startowa REcreatio)',
  cormorant: 'Cormorant Garamond + Source Sans (wydarzenia)',
  plex: 'IBM Plex Sans — bezszeryfowa'
};

/** Welche Familien ein Paar braucht, und für welche Rolle. */
export const FONT_FACES: Record<FontPair, { readonly display: string; readonly text: string; readonly ui: string; readonly load: string | null }> = {
  app: { display: "'Cormorant Garamond', Georgia, serif", text: "'Segoe UI', system-ui, sans-serif", ui: "'Segoe UI', system-ui, sans-serif", load: null },
  spectral: {
    display: "'Spectral', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
    text: "'Spectral', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
    ui: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
    load: 'family=Spectral:ital,wght@0,300;0,400;0,600;1,300;1,400&family=IBM+Plex+Sans:wght@400;500;600'
  },
  cormorant: {
    display: "'Cormorant Garamond', Georgia, serif",
    text: "'Source Sans 3', system-ui, sans-serif",
    ui: "'Source Sans 3', system-ui, sans-serif",
    load: 'family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Source+Sans+3:wght@400;500;600'
  },
  plex: {
    display: "'IBM Plex Sans', system-ui, sans-serif",
    text: "'IBM Plex Sans', system-ui, sans-serif",
    ui: "'IBM Plex Sans', system-ui, sans-serif",
    load: 'family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400'
  }
};

export const THREADS = ['none', 'line', 'dots'] as const;
export type Thread = (typeof THREADS)[number];

export const THREAD_LABEL: Record<Thread, string> = { none: 'Bez nitki', line: 'Linia', dots: 'Kropki' };

/** Die Leiste der Szenen oben. */
export const NAVS = ['labels', 'dots', 'none'] as const;
export type Nav = (typeof NAVS)[number];

export const NAV_LABEL: Record<Nav, string> = { labels: 'Nazwy scen', dots: 'Kropki', none: 'Bez paska' };

/* -- Ein Platz ------------------------------------------------------------------------ */

/**
 * WO EIN BAUSTEIN AUF EINER SZENE STEHT. `x`, `y` — seine Mitte in Prozent
 * der Bühne; `w` — Breite in Prozent ihrer Breite; `h` — Höhe in Prozent
 * ihrer Höhe (`null`: so hoch, wie der Inhalt ist); `max` — höchstens so breit
 * (in rem: eine Blase bleibt auf einem grossen Schirm eine Blase, auf dem
 * Telefon nimmt sie `w` Prozent); `z` — Tiefe im Raum in
 * Pixeln (0 flach, −1000 weit hinten — nur wo die Kamera fliegt, sieht man es).
 * `step` — der Schritt der Szene, in dem er betont ist (`null`: keiner).
 * `tall` — andere Werte auf einem hohen, schmalen Bild (Telefon hochkant).
 */
export interface Place {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number | null;
  readonly max: number | null;
  readonly rotate: number;
  readonly scale: number;
  readonly opacity: number;
  readonly z: number;
  readonly step: number | null;
  readonly tall: TallPlace | null;
}

export interface TallPlace {
  readonly x?: number;
  readonly y?: number;
  readonly w?: number;
  readonly h?: number | null;
  readonly max?: number | null;
  readonly scale?: number;
  readonly rotate?: number;
}

export const PLACE: Place = { x: 50, y: 50, w: 30, h: null, max: null, rotate: 0, scale: 1, opacity: 1, z: 0, step: null, tall: null };

/** Grenzen — weit genug für einen Kreis, der zum Grund wächst (×26), eng genug, dass nichts ins Unendliche geht. */
export const LIMITS = {
  x: [-100, 200], y: [-100, 200], w: [1, 300], h: [1, 300], max: [1, 200], rotate: [-360, 360], scale: [0, 40], opacity: [0, 1], z: [-5000, 900], step: [0, 49]
} as const;

/** Das Bild in einem Feld oder einer Tafel: neben dem Text (danach, davor) oder dahinter. */
export interface Media {
  readonly url: string;
  /** Wo der Ausschnitt sitzt (`57% 50%`). */
  readonly at: string;
  readonly fit: 'cover' | 'contain';
  /** Bei `contain`: wie gross, in Prozent des Platzes — und höchstens so breit (rem; `null`: ohne Grenze). */
  readonly size: number;
  readonly max: number | null;
  readonly opacity: number;
  /** Weich in den Text übergehen (die Naht wird ausgeblendet). */
  readonly fade: boolean;
  readonly side: 'after' | 'before' | 'behind';
}

export const MEDIA: Media = { url: '', at: 'center', fit: 'cover', size: 60, max: null, opacity: 1, fade: true, side: 'after' };

export type Align = 'start' | 'center' | 'end';
export const ALIGNS: readonly Align[] = ['start', 'center', 'end'];

/**
 * EIN BAUSTEIN IN DER PRÄSENTATION (`layout.show`): seine Plätze je Szene
 * (nach der Kennung der Szene), seine Hülle, wie er kommt, wie er wandert.
 */
export interface Piece {
  readonly places: Readonly<Record<string, Place>>;
  readonly skin: Skin;
  readonly type: TextType;
  /** Farbe des Grundes, der Schrift und des Akzents (Verweise, Pointe) — `#rrggbb`, `hell|dunkel`, oder `accent`, `ink`, `ground`, `muted`. */
  readonly fill: string | null;
  readonly ink: string | null;
  readonly accent: string | null;
  /** Welcher Punkt auf `x`, `y` steht. */
  readonly origin: Origin;
  readonly media: Media | null;
  readonly align: Align;
  readonly valign: Align;
  readonly arrive: Arrival;
  /** Wann im Übergang er anfängt (0–1) und wie lange er braucht (Anteil des Übergangs). */
  readonly delay: number;
  readonly span: number;
  readonly ease: Ease;
  /** Bleibt vor seinem ersten und nach seinem letzten Platz stehen (statt zu kommen und zu gehen). */
  readonly hold: boolean;
  /** Vor und hinter anderen: höher steht vorn. */
  readonly layer: number;
}

export const PIECE: Piece = {
  places: {}, skin: 'card', type: 'auto', fill: null, ink: null, accent: null, origin: 'center', media: null, align: 'start', valign: 'start',
  arrive: 'fade', delay: 0, span: 0.6, ease: 'inOut', hold: false, layer: 0
};

/* -- Eine Szene ---------------------------------------------------------------------- */

/** Die Wortwolke einer Szene — Wörter im Raum, durch die die Kamera fliegt (Altbestand: „RE…"). */
export interface Words {
  readonly list: readonly string[];
  /** Vor jedes Wort, gross und aufrecht (das RE). */
  readonly prefix: string;
  /** Wie viele im Raum stehen — ein Vielfaches der Liste, damit keines häufiger ist. */
  readonly count: number;
  readonly seed: number;
  readonly color: string | null;
}

export const WORDS: Words = { list: [], prefix: '', count: 30, seed: 7, color: null };

/** Die Kamera einer Szene: wie tief der Raum ist und wie weit sie beim Flug hindurch fährt. */
export interface Depth {
  readonly perspective: number;
  readonly travel: number;
  /** Unterwegs innehalten, dort, wo der tiefste Baustein allein und gross steht. */
  readonly linger: boolean;
}

export const DEPTH: Depth = { perspective: 1000, travel: 2200, linger: true };

export interface Scene {
  /** Eigene Kennung — die Plätze der Bausteine zeigen darauf. */
  readonly key: string;
  readonly label: string;
  /** Wie viele Stellen (Schritte) die Szene hat — mindestens eine. */
  readonly steps: number;
  readonly change: SceneChange;
  /**
   * Die vorige bleibt darunter stehen, bis der Wechsel vorbei ist (statt zu
   * verblassen) — der Kontakt legt sich über die Viertel, der Kreis deckt sie zu.
   */
  readonly keep: boolean;
  /** Wie lange der Sprung in diese Szene dauert, wenn man ihn auslöst (ms). */
  readonly duration: number;
  /** Eigene Farben; `ground` ist ihr Grund (sonst scheint der der Seite durch). */
  readonly colors: SlideColors | null;
  readonly layers: readonly Layer[];
  /** Die Szene wächst über ihre Lebenszeit — vom Kommen bis zum letzten Schritt. */
  readonly grow: { readonly from: number; readonly to: number } | null;
  /** Wie stark die Szene dem betonten Baustein nachgeht (0–1), breit und hoch. */
  readonly follow: { readonly wide: number; readonly tall: number };
  /** Die Schritte betonen ihre Bausteine (die anderen werden blasser und weichen aus). */
  readonly emphasis: boolean;
  readonly thread: Thread;
  /** Ein kleiner Hinweis unten („Przewiń") — verschwindet, sobald es losgeht. */
  readonly hint: string;
  readonly words: Words | null;
  readonly depth: Depth;
}

export const SCENE: Omit<Scene, 'key'> = {
  label: '', steps: 1, change: 'fade', keep: false, duration: 700, colors: null, layers: [], grow: null,
  follow: { wide: 0.45, tall: 1 }, emphasis: true, thread: 'none', hint: '', words: null, depth: DEPTH
};

/** Die ganze Präsentation (im Aussehen der Seite, unter "show"). */
export interface Show {
  readonly format: Format;
  readonly fonts: FontPair;
  readonly nav: Nav;
  readonly scenes: readonly Scene[];
}

export const NO_SHOW: Show = { format: 'screen', fonts: 'app', nav: 'labels', scenes: [] };

/* -- Duldsame Leser ------------------------------------------------------------------- */

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const within = (value: unknown, [min, max]: readonly [number, number], fallback: number): number =>
  Math.min(max, Math.max(min, num(value, fallback)));

const oneOf = <T extends string>(value: unknown, list: readonly T[], fallback: T): T =>
  (list as readonly string[]).includes(str(value)) ? str(value) as T : fallback;

/** Eine Farbe: `#rrggbb`, ein Name, `hell|dunkel`, oder einer der vier Namen des Themas. Leer: keine. */
export const colorOrNull = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text === '' || text.length > 80 ? null : text;
};

function readTall(value: unknown): TallPlace | null {
  if (typeof value !== 'object' || value === null) return null;
  const one = record(value);
  const out: { -readonly [K in keyof TallPlace]: TallPlace[K] } = {};
  if (typeof one.x === 'number') out.x = within(one.x, LIMITS.x, 50);
  if (typeof one.y === 'number') out.y = within(one.y, LIMITS.y, 50);
  if (typeof one.w === 'number') out.w = within(one.w, LIMITS.w, 30);
  if (one.h === null || typeof one.h === 'number') out.h = one.h === null ? null : within(one.h, LIMITS.h, 30);
  if (one.max === null || typeof one.max === 'number') out.max = one.max === null ? null : within(one.max, LIMITS.max, 20);
  if (typeof one.scale === 'number') out.scale = within(one.scale, LIMITS.scale, 1);
  if (typeof one.rotate === 'number') out.rotate = within(one.rotate, LIMITS.rotate, 0);
  return Object.keys(out).length === 0 ? null : out;
}

export function readPlace(value: unknown): Place | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const one = record(value);
  const step = typeof one.step === 'number' && Number.isFinite(one.step) ? Math.round(within(one.step, LIMITS.step, 0)) : null;
  return {
    x: within(one.x, LIMITS.x, PLACE.x),
    y: within(one.y, LIMITS.y, PLACE.y),
    w: within(one.w, LIMITS.w, PLACE.w),
    h: typeof one.h === 'number' && Number.isFinite(one.h) ? within(one.h, LIMITS.h, 30) : null,
    max: typeof one.max === 'number' && Number.isFinite(one.max) ? within(one.max, LIMITS.max, 20) : null,
    rotate: within(one.rotate, LIMITS.rotate, PLACE.rotate),
    scale: within(one.scale, LIMITS.scale, PLACE.scale),
    opacity: within(one.opacity, LIMITS.opacity, PLACE.opacity),
    z: within(one.z, LIMITS.z, PLACE.z),
    step,
    tall: readTall(one.tall)
  };
}

function readMedia(value: unknown): Media | null {
  if (typeof value !== 'object' || value === null) return null;
  const one = record(value);
  const url = str(one.url).trim();
  if (url === '') return null;
  return {
    url,
    at: str(one.at, MEDIA.at).trim().slice(0, 40) || MEDIA.at,
    fit: one.fit === 'contain' ? 'contain' : 'cover',
    size: within(one.size, [5, 100], MEDIA.size),
    max: typeof one.max === 'number' && Number.isFinite(one.max) ? within(one.max, [1, 200], 20) : null,
    opacity: within(one.opacity, [0, 1], MEDIA.opacity),
    fade: one.fade !== false,
    side: oneOf(one.side, ['after', 'before', 'behind'] as const, 'after')
  };
}

/** Ein Baustein der Präsentation aus dem, was gespeichert liegt (oder im Dokument steht). */
export function readPieceValue(value: unknown): Piece {
  const one = record(value);
  const places: Record<string, Place> = {};
  for (const [key, raw] of Object.entries(record(one.places))) {
    const place = readPlace(raw);
    if (place !== null && key.trim() !== '' && key.length <= 64) places[key.trim()] = place;
  }
  return {
    places,
    skin: oneOf(one.skin, SKINS, PIECE.skin),
    type: oneOf(one.type, TEXT_TYPES, PIECE.type),
    fill: colorOrNull(one.fill),
    ink: colorOrNull(one.ink),
    accent: colorOrNull(one.accent),
    origin: oneOf(one.origin, ORIGINS, PIECE.origin),
    media: readMedia(one.media),
    align: oneOf(one.align, ALIGNS, PIECE.align),
    valign: oneOf(one.valign, ALIGNS, PIECE.valign),
    arrive: oneOf(one.arrive, ARRIVALS, PIECE.arrive),
    delay: within(one.delay, [0, 0.95], PIECE.delay),
    span: within(one.span, [0.05, 1], PIECE.span),
    ease: oneOf(one.ease, EASES, PIECE.ease),
    hold: one.hold === true,
    layer: Math.round(within(one.layer, [-20, 20], PIECE.layer))
  };
}

export const readPiece = (layout: Layout): Piece => readPieceValue(layout.show);

/** Steht der Baustein überhaupt in der Präsentation? */
export const isPlaced = (layout: Layout): boolean => Object.keys(readPiece(layout).places).length > 0;

const roundTo = (value: number, digits = 2): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/** Ein Platz KNAPP: was der Vorgabe entspricht, fehlt. */
export function placeJson(place: Place): Record<string, unknown> {
  const out: Record<string, unknown> = { x: roundTo(place.x), y: roundTo(place.y), w: roundTo(place.w) };
  if (place.h !== null) out.h = roundTo(place.h);
  if (place.max !== null) out.max = roundTo(place.max);
  if (place.rotate !== 0) out.rotate = roundTo(place.rotate);
  if (place.scale !== 1) out.scale = roundTo(place.scale, 3);
  if (place.opacity !== 1) out.opacity = roundTo(place.opacity);
  if (place.z !== 0) out.z = Math.round(place.z);
  if (place.step !== null) out.step = place.step;
  if (place.tall !== null) out.tall = place.tall;
  return out;
}

/** Der Baustein, wie er gespeichert wird und im JSON steht — knapp. */
export function pieceJson(piece: Piece): Record<string, unknown> {
  const out: Record<string, unknown> = {
    places: Object.fromEntries(Object.entries(piece.places).map(([key, place]) => [key, placeJson(place)]))
  };
  if (piece.skin !== PIECE.skin) out.skin = piece.skin;
  if (piece.type !== PIECE.type) out.type = piece.type;
  if (piece.fill !== null) out.fill = piece.fill;
  if (piece.ink !== null) out.ink = piece.ink;
  if (piece.accent !== null) out.accent = piece.accent;
  if (piece.origin !== PIECE.origin) out.origin = piece.origin;
  if (piece.media !== null) {
    const m = piece.media;
    out.media = {
      url: m.url,
      ...(m.at !== MEDIA.at ? { at: m.at } : {}),
      ...(m.fit !== MEDIA.fit ? { fit: m.fit } : {}),
      ...(m.size !== MEDIA.size ? { size: m.size } : {}),
      ...(m.max !== null ? { max: m.max } : {}),
      ...(m.opacity !== MEDIA.opacity ? { opacity: m.opacity } : {}),
      ...(m.fade !== MEDIA.fade ? { fade: m.fade } : {}),
      ...(m.side !== MEDIA.side ? { side: m.side } : {})
    };
  }
  if (piece.align !== PIECE.align) out.align = piece.align;
  if (piece.valign !== PIECE.valign) out.valign = piece.valign;
  if (piece.arrive !== PIECE.arrive) out.arrive = piece.arrive;
  if (piece.delay !== PIECE.delay) out.delay = roundTo(piece.delay, 3);
  if (piece.span !== PIECE.span) out.span = roundTo(piece.span, 3);
  if (piece.ease !== PIECE.ease) out.ease = piece.ease;
  if (piece.hold) out.hold = true;
  if (piece.layer !== PIECE.layer) out.layer = piece.layer;
  return out;
}

/** Den Baustein in die Anordnung schreiben — ohne Plätze fällt er aus der Präsentation (und `show` weg). */
export function withPiece(layout: Layout, piece: Piece): Layout {
  if (Object.keys(piece.places).length === 0) {
    const { show: _show, ...rest } = layout as Layout & { show?: unknown };
    return rest;
  }
  return { ...layout, show: pieceJson(piece) };
}

function readWords(value: unknown): Words | null {
  if (typeof value !== 'object' || value === null) return null;
  const one = record(value);
  const list = (Array.isArray(one.list) ? one.list : [])
    .filter((w): w is string => typeof w === 'string')
    .map((w) => w.trim().slice(0, 40))
    .filter((w) => w !== '')
    .slice(0, 60);
  if (list.length === 0) return null;
  return {
    list,
    prefix: str(one.prefix).trim().slice(0, 12),
    count: Math.round(within(one.count, [1, 120], WORDS.count)),
    seed: Math.round(within(one.seed, [0, 1_000_000], WORDS.seed)),
    color: colorOrNull(one.color)
  };
}

function readColors(value: unknown): SlideColors | null {
  const c = record(value);
  const colors: SlideColors = { accent: colorOrNull(c.accent), ink: colorOrNull(c.ink), ground: colorOrNull(c.ground), muted: colorOrNull(c.muted) };
  return COLOR_KEYS.some((k) => colors[k] !== null) ? colors : null;
}

/** Eine Szene aus dem Gespeicherten — ohne Kennung bekommt sie eine aus ihrer Stelle. */
export function readScene(value: unknown, index: number): Scene {
  const one = record(value);
  const key = str(one.key).trim().slice(0, 64) || `scena-${index + 1}`;
  const change = oneOf(one.change, SCENE_CHANGES, SCENE.change);
  const grow = record(one.grow);
  const follow = record(one.follow);
  const depth = record(one.depth);
  return {
    key,
    label: str(one.label).trim().slice(0, 80),
    steps: Math.round(within(one.steps, [1, 50], SCENE.steps)),
    change,
    keep: one.keep === true,
    duration: Math.round(within(one.duration, [0, 5000], change === 'fly' ? 1700 : SCENE.duration)),
    colors: readColors(one.colors),
    layers: readLayers(one.layers),
    grow: typeof one.grow === 'object' && one.grow !== null
      ? { from: within(grow.from, [0.1, 3], 1), to: within(grow.to, [0.1, 3], 1) }
      : null,
    follow: {
      wide: within(follow.wide, [0, 1], SCENE.follow.wide),
      tall: within(follow.tall, [0, 1], SCENE.follow.tall)
    },
    emphasis: one.emphasis !== false,
    thread: oneOf(one.thread, THREADS, SCENE.thread),
    hint: str(one.hint).trim().slice(0, 60),
    words: readWords(one.words),
    depth: {
      perspective: within(depth.perspective, [200, 4000], DEPTH.perspective),
      travel: within(depth.travel, [0, 8000], DEPTH.travel),
      linger: depth.linger !== false
    }
  };
}

/** Die Präsentation aus dem, was im Aussehen der Seite unter "show" liegt. */
export function readShow(value: unknown): Show {
  const one = record(value);
  const seen = new Set<string>();
  const scenes: Scene[] = [];
  (Array.isArray(one.scenes) ? one.scenes : []).slice(0, 60).forEach((raw, index) => {
    let scene = readScene(raw, index);
    /* Zwei Szenen mit derselben Kennung wären ein Platz für zwei Orte — die zweite bekommt eine eigene. */
    while (seen.has(scene.key)) scene = { ...scene, key: `${scene.key}-${index + 1}` };
    seen.add(scene.key);
    scenes.push(scene);
  });
  return {
    format: oneOf(one.format, FORMATS, NO_SHOW.format),
    fonts: oneOf(one.fonts, FONT_PAIRS, NO_SHOW.fonts),
    nav: oneOf(one.nav, NAVS, NO_SHOW.nav),
    scenes
  };
}

/** Eine Szene knapp — was der Vorgabe entspricht, fehlt. */
export function sceneJson(scene: Scene): Record<string, unknown> {
  const out: Record<string, unknown> = { key: scene.key, label: scene.label };
  if (scene.steps !== 1) out.steps = scene.steps;
  if (scene.change !== SCENE.change) out.change = scene.change;
  if (scene.keep) out.keep = true;
  if (scene.duration !== (scene.change === 'fly' ? 1700 : SCENE.duration)) out.duration = scene.duration;
  if (scene.colors !== null) {
    out.colors = Object.fromEntries(COLOR_KEYS.filter((k) => scene.colors![k] !== null).map((k) => [k, scene.colors![k]]));
  }
  if (scene.layers.length > 0) out.layers = scene.layers;
  if (scene.grow !== null) out.grow = { from: roundTo(scene.grow.from, 3), to: roundTo(scene.grow.to, 3) };
  if (scene.follow.wide !== SCENE.follow.wide || scene.follow.tall !== SCENE.follow.tall) {
    out.follow = { wide: roundTo(scene.follow.wide), tall: roundTo(scene.follow.tall) };
  }
  if (!scene.emphasis) out.emphasis = false;
  if (scene.thread !== SCENE.thread) out.thread = scene.thread;
  if (scene.hint !== '') out.hint = scene.hint;
  if (scene.words !== null) {
    out.words = {
      list: scene.words.list,
      ...(scene.words.prefix !== '' ? { prefix: scene.words.prefix } : {}),
      count: scene.words.count,
      seed: scene.words.seed,
      ...(scene.words.color !== null ? { color: scene.words.color } : {})
    };
  }
  if (scene.depth.perspective !== DEPTH.perspective || scene.depth.travel !== DEPTH.travel || scene.depth.linger !== DEPTH.linger) {
    out.depth = {
      ...(scene.depth.perspective !== DEPTH.perspective ? { perspective: scene.depth.perspective } : {}),
      ...(scene.depth.travel !== DEPTH.travel ? { travel: scene.depth.travel } : {}),
      ...(scene.depth.linger !== DEPTH.linger ? { linger: scene.depth.linger } : {})
    };
  }
  return out;
}

export function showJson(show: Show): Record<string, unknown> {
  return {
    format: show.format,
    ...(show.fonts !== NO_SHOW.fonts ? { fonts: show.fonts } : {}),
    ...(show.nav !== NO_SHOW.nav ? { nav: show.nav } : {}),
    scenes: show.scenes.map(sceneJson)
  };
}

/** Eine neue Szene — `key` vom Aufrufer (eine frische Kennung). */
export const blankScene = (key: string, label: string): Scene => ({ ...SCENE, key, label });

/* -- Für die Darstellung ---------------------------------------------------------------- */

/** Der Platz, der gerade gilt — auf einem hohen Bild mit seinen eigenen Werten. */
export const placeFor = (place: Place, tall: boolean): Place =>
  !tall || place.tall === null ? place : {
    ...place,
    x: place.tall.x ?? place.x,
    y: place.tall.y ?? place.y,
    w: place.tall.w ?? place.w,
    h: place.tall.h === undefined ? place.h : place.tall.h,
    max: place.tall.max === undefined ? place.max : place.tall.max,
    scale: place.tall.scale ?? place.scale,
    rotate: place.tall.rotate ?? place.rotate
  };

/**
 * WANDERT ER? Plätze auf mehr als einer Szene — oder er bleibt vor dem ersten
 * und nach dem letzten stehen. Dann steht er über den Szenen statt in einer.
 */
export const travels = (piece: Piece): boolean => piece.hold || Object.keys(piece.places).length > 1;

/** Wie viele Schritte eine Szene mindestens braucht, damit jeder Baustein seinen bekommt. */
export function stepsNeeded(sceneKey: string, pieces: readonly Piece[]): number {
  let most = 0;
  for (const piece of pieces) {
    const step = piece.places[sceneKey]?.step;
    if (step !== null && step !== undefined) most = Math.max(most, step + 1);
  }
  return Math.max(1, most);
}

/**
 * EINE FARBE AUFLÖSEN: `hell|dunkel` nach dem Gerät, die vier Namen des Themas
 * als Variable der Bühne (sie gehen zwischen den Szenen mit), alles andere,
 * wie es dasteht.
 */
export function resolveColor(value: string | null, dark: boolean): string | null {
  if (value === null) return null;
  const pair = value.split('|').map((one) => one.trim());
  const chosen = pair.length === 2 ? (dark ? pair[1] : pair[0]) : value.trim();
  if (chosen === 'accent' || chosen === 'ink' || chosen === 'ground' || chosen === 'muted') return `var(--pz-${chosen})`;
  if (chosen === 'paper') return 'var(--pz-paper)';
  return chosen === '' ? null : chosen;
}

/**
 * Was ein Verweis in einem Text sein darf: eine Adresse im Netz, eine Seite
 * hier (`#/…`), eine Szene (`#name`), eine E-Mail, ein Telefon. Alles andere
 * (`javascript:` und dergleichen) bleibt Text.
 */
export function textLink(href: string): string | null {
  const t = href.trim();
  if (/^https?:\/\/[^\s]+$/i.test(t)) return t;
  if (/^www\.[^\s]+$/i.test(t)) return `https://${t}`;
  if (/^\/?#\/?[^\s]*$/.test(t)) return t.replace(/^\//, '');
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(t)) return t;
  if (/^tel:\+?[0-9 ()-]{3,}$/i.test(t)) return t.replace(/\s+/g, '');
  return null;
}
