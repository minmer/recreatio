/**
 * DIE BEWEGUNG EINER PRÄSENTATION (0085) — alles aus EINER Zahl: der Stelle
 * `s` auf der Achse. Keine Uhr, kein Zustand; dieselbe Stelle ergibt immer
 * dasselbe Bild. Deshalb lässt sich jede Zeile hier ohne Browser prüfen
 * (`scripts/app-presentation-check.mjs`), und der Editor kann jede Stelle
 * stehend zeigen.
 *
 * <b>Die Zahlen sind die der Startseite des Altbestands</b> (`FrontPage.tsx`
 * und `public.css`): das Verweilen bei jeder Blase (`WALK_HOLD`), das
 * Gefälle der Betonung, das Ausweichen, die drei Rampen der Kamera, die
 * Wortwolke. Sie sind dort an echten Rädern und Telefonen eingestellt worden;
 * hier stehen sie einmal, allgemein.
 *
 * <code>
 *   Szene i hat `steps` Stellen: von zone.at bis zone.to.
 *   Zwischen zwei Szenen liegt genau EINE Einheit — der Übergang.
 *   pIn  — wie weit die Szene hereingekommen ist   (0 bei zone.at − 1, 1 bei zone.at)
 *   pOut — wie weit sie schon gegangen ist          (0 bei zone.to,     1 bei zone.to + 1)
 * </code>
 */

import { ORIGIN_AT, type Arrival, type Ease, type Origin, type Place, type SceneChange, type Words } from './presentation';

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/* -- Die Achse ------------------------------------------------------------------------ */

export interface Zone {
  readonly at: number;
  readonly to: number;
}

/** Die Strecken der Szenen: jede so lang, wie sie Schritte hat, eine Einheit Übergang dazwischen. */
export function zonesOf(steps: readonly number[]): Zone[] {
  const zones: Zone[] = [];
  let at = 0;
  for (const n of steps) {
    const count = Math.max(1, Math.round(n));
    zones.push({ at, to: at + count - 1 });
    at += count;
  }
  return zones;
}

/** Das Ende der Achse. */
export const lastOf = (zones: readonly Zone[]): number => (zones.length === 0 ? 0 : zones[zones.length - 1].to);

/** Die Strecke, auf der diese Stelle liegt — sonst die nächste (Altbestand: `zoneOf`). */
export function zoneIndexOf(zones: readonly Zone[], s: number): number {
  for (let i = 0; i < zones.length; i += 1) {
    if (s >= zones[i].at - 1e-4 && s <= zones[i].to + 1e-4) return i;
  }
  let best = 0;
  for (let i = 0; i < zones.length; i += 1) {
    if (Math.abs(zones[i].at - s) < Math.abs(zones[best].at - s)) best = i;
  }
  return best;
}

/** Welche Szene gerade „dran" ist — die Mitte eines Übergangs ist die Grenze. */
export function activeScene(zones: readonly Zone[], s: number): number {
  let active = 0;
  for (let i = 0; i < zones.length; i += 1) if (s >= zones[i].at - 0.5) active = i;
  return active;
}

/**
 * DER GANG VON SCHRITT ZU SCHRITT verweilt bei jedem (Altbestand: WALK_HOLD).
 * 0 wäre gleichmässig, 1 bliebe stehen; 0,9 ist bei einem Schritt rund
 * achtzehnmal langsamer als auf halbem Weg und bleibt doch in Fahrt.
 */
export const WALK_HOLD = 0.9;

export function walkOf(s: number, hold = WALK_HOLD): number {
  const base = Math.floor(s);
  const t = s - base;
  const smooth = t * t * t * (t * (t * 6 - 15) + 10);
  return base + t + hold * (smooth - t);
}

/** Wie weit die Stelle zwischen zwei Schritten EINER Szene liegt: 0 an einem, 1 mittig. */
export function betweenOf(zones: readonly Zone[], s: number): number {
  const zone = zones[zoneIndexOf(zones, s)];
  if (zone === undefined || zone.to <= zone.at || s <= zone.at || s >= zone.to) return 0;
  const t = s - Math.floor(s);
  return 1 - Math.abs(2 * t - 1);
}

export const enteredOf = (zone: Zone, s: number): number => clamp01(s - (zone.at - 1));
export const leftOf = (zone: Zone, s: number): number => clamp01(s - zone.to);

/* -- Eine Szene im Wechsel -------------------------------------------------------------- */

export interface SceneState {
  readonly visible: boolean;
  readonly pIn: number;
  readonly pOut: number;
  readonly opacity: number;
  /** Verschiebung in Prozent der Bühne. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  /** Abdunkeln (0–1). */
  readonly dim: number;
  /** Über der folgenden (sie geht oben weg: Flug, Odsłonięcie, Przybliżenie). */
  readonly above: boolean;
  /** Die FOLGENDE fliegt durch diese hindurch — dann fährt ihre Kamera (`flightCurve` von pOut). */
  readonly flown: boolean;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Weniger Bewegung im System: alles blendet über, nichts fliegt (der Schnitt bleibt ein Schnitt). */
export const calmerChange = (change: SceneChange, reduced: boolean): SceneChange =>
  reduced && change !== 'cut' ? 'fade' : change;

/**
 * Wie eine Szene an der Stelle `s` steht. `changes[i]` — wie Szene i die
 * vorige ablöst; er gilt für das KOMMEN von i und das GEHEN von i − 1.
 */
export function sceneState(
  zones: readonly Zone[], i: number, s: number, changes: readonly SceneChange[], reduced = false, keeps: readonly boolean[] = []
): SceneState {
  const zone = zones[i];
  const pIn = i === 0 ? 1 : enteredOf(zone, s);
  const pOut = i === zones.length - 1 ? 0 : leftOf(zone, s);
  const visible = pIn > 0 && pOut < 1;
  let opacity = 1, x = 0, y = 0, scale = 1, dim = 0, above = false;
  const flown = calmerChange(changes[i + 1] ?? 'fade', reduced) === 'fly';

  /* Kommen — nach der eigenen Art. */
  if (pIn < 1) {
    const kind = calmerChange(changes[i] ?? 'fade', reduced);
    const e = smooth(pIn);
    switch (kind) {
      case 'fade': case 'fly': opacity = pIn; break;
      /* Die Szene ist sofort da; ihre Bausteine kommen jeder auf seine Art (die Viertel). */
      case 'build': break;
      case 'cut': opacity = pIn >= 0.5 ? 1 : 0; break;
      case 'rise': opacity = pIn; y = (1 - e) * 6; break;
      case 'zoom': opacity = pIn; scale = 0.92 + 0.08 * e; break;
      case 'cover': y = (1 - e) * 100; break;
      case 'reveal': break;
      case 'side': x = (1 - e) * 100; break;
    }
  }

  /* Gehen — nach der Art der FOLGENDEN; bleibt sie stehen (`keep`), steht diese, bis der Wechsel vorbei ist. */
  if (pOut > 0) {
    const kind = calmerChange(changes[i + 1] ?? 'fade', reduced);
    const keep = keeps[i + 1] === true && (kind === 'fade' || kind === 'build' || kind === 'rise');
    const e = smooth(pOut);
    switch (keep ? 'keep' : kind) {
      case 'keep': break;
      case 'fade': case 'rise': case 'build': opacity *= 1 - pOut; break;
      case 'cut': opacity *= pOut >= 0.5 ? 0 : 1; break;
      /* Der Raum ist erst fort, wenn alles vorbeigezogen ist (Altbestand: --pspace). */
      case 'fly': opacity *= 1 - clamp01((pOut - 0.55) / 0.45); above = true; break;
      case 'zoom': opacity *= 1 - pOut; scale *= 1 + 0.12 * e; above = true; break;
      case 'cover': dim = 0.35 * e; break;
      case 'reveal': y -= e * 100; above = true; break;
      case 'side': x -= e * 30; dim = 0.25 * e; break;
    }
  }

  return { visible, pIn, pOut, opacity, x, y, scale, dim, above, flown };
}

/**
 * DIE KAMERA beim Flug: drei Rampen statt einer geraden Fahrt (Altbestand:
 * --pcam) — schnell heran, ein langsames Stück, wo der tiefste Gegenstand
 * allein und gross steht, dann wieder schnell davon. Ohne Innehalten: weich.
 */
export function flightCurve(p: number, linger: boolean): number {
  const t = clamp01(p);
  if (!linger) return smooth(t);
  return 0.545 * clamp01(t / 0.30) + 0.155 * clamp01((t - 0.30) / 0.46) + 0.300 * clamp01((t - 0.76) / 0.24);
}

/** Wie gross die Szene über ihre Lebenszeit ist — vom Kommen bis zum letzten Schritt (Altbestand: --u). */
export function growAt(grow: { readonly from: number; readonly to: number } | null, zone: Zone, s: number): number {
  if (grow === null) return 1;
  const u = clamp01((s - (zone.at - 1)) / (zone.to - zone.at + 1));
  return grow.from + (grow.to - grow.from) * u;
}

/* -- Betonung und Nachgehen ------------------------------------------------------------- */

/** Ein Baustein mit Schritt: wo er steht und wann er dran ist. */
export interface Stepped {
  readonly scene: number;
  readonly step: number;
  readonly x: number;
  readonly y: number;
}

/** Wie sehr der Baustein gerade betont ist: ein Dreieck um seine Stelle (Altbestand: --f). */
export function emphasisOf(zone: Zone, step: number, walk: number): number {
  const at = zone.at + step;
  return clamp01(Math.min(walk - at + 1, at + 1 - walk));
}

/**
 * WIE WEIT DIE SZENEN DEM BETONTEN NACHGEHEN — damit er in der Mitte steht.
 * Die Betonungen addieren sich zu jeder Zeit zu 1; die Summe ist also genau
 * der Weg zwischen zwei Plätzen (Altbestand: `pan`).
 */
export function panAt(zones: readonly Zone[], stepped: readonly Stepped[], walk: number): { x: number; y: number } {
  let x = 0, y = 0;
  for (const one of stepped) {
    const zone = zones[one.scene];
    if (zone === undefined) continue;
    const weight = Math.max(0, 1 - Math.abs(walk - (zone.at + one.step)));
    if (weight === 0) continue;
    x += (50 - one.x) * weight;
    y += (50 - one.y) * weight;
  }
  return { x, y };
}

/** Das Ausweichen der unbetonten: ein Stück vom Mittelpunkt der Szene weg (Altbestand: BUBBLE_YIELD). */
export const YIELD = 5;

export function yieldOf(place: { x: number; y: number }, centre: { x: number; y: number }): { x: number; y: number } {
  const dx = place.x - centre.x, dy = place.y - centre.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (dx / len) * YIELD, y: (dy / len) * YIELD };
}

/** Grundhelligkeit der Unbetonten und der Einbruch unterwegs (Altbestand: 0.62, 0.34, 0.07). */
export const EMPHASIS = { rest: 0.62, dip: 0.34, grow: 0.07 } as const;

/* -- Das Kommen eines Bausteins ---------------------------------------------------------- */

export const arriveProgress = (pIn: number, delay: number, span: number): number =>
  clamp01((pIn - delay) / Math.max(0.01, span));

export interface ArriveStyle {
  readonly opacity: number;
  /** Verschiebung in Prozent der Bühne (x der Breite, y der Höhe). */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/**
 * Wie ein Baustein bei `p` (0–1) seines Kommens steht. Die „zza krawędzi"-Arten
 * fahren ihn ganz von aussen herein — ohne Ausblenden: ein Feld, das sich
 * schiebt, ist ein Gegenstand; eines, das durchsichtig anfängt, ein Effekt
 * (Altbestand, die vier Viertel).
 */
export function arriveStyle(
  kind: Arrival, p: number, place: { x: number; y: number; w: number; h: number | null }, reduced = false, origin: Origin = 'center'
): ArriveStyle {
  const q = clamp01(p);
  if (q >= 1 || kind === 'none') return { opacity: 1, x: 0, y: 0, scale: 1 };
  if (reduced) return { opacity: q, x: 0, y: 0, scale: 1 };
  const e = smooth(q);
  /* Wie weit er bis aus dem Bild muss: von seiner Kante, nicht von seinem Punkt. */
  const at = ORIGIN_AT[origin];
  const h = place.h ?? place.w;
  const left = place.x - at.x * place.w, right = left + place.w;
  const top = place.y - at.y * h, bottom = top + h;
  switch (kind) {
    case 'fade': return { opacity: q, x: 0, y: 0, scale: 1 };
    case 'rise': return { opacity: q, x: 0, y: (1 - e) * 3, scale: 1 };
    case 'zoom': return { opacity: q, x: 0, y: 0, scale: 0.93 + 0.07 * q };
    case 'grow': return { opacity: 1, x: 0, y: 0, scale: q };
    case 'left': return { opacity: q, x: -(1 - e) * 4, y: 0, scale: 1 };
    case 'right': return { opacity: q, x: (1 - e) * 4, y: 0, scale: 1 };
    case 'from-left': return { opacity: 1, x: -(1 - q) * (right + 4), y: 0, scale: 1 };
    case 'from-right': return { opacity: 1, x: (1 - q) * (100 - left + 4), y: 0, scale: 1 };
    case 'from-top': return { opacity: 1, x: 0, y: -(1 - q) * (bottom + 4), scale: 1 };
    case 'from-bottom': return { opacity: 1, x: 0, y: (1 - q) * (100 - top + 4), scale: 1 };
  }
}

/* -- Wandern ------------------------------------------------------------------------------ */

export function easeOf(kind: Ease, t: number): number {
  const q = clamp01(t);
  switch (kind) {
    case 'linear': return q;
    case 'in': return q * q;
    case 'out': return 1 - (1 - q) * (1 - q);
    case 'inOut': return smooth(q);
  }
}

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Zwei Plätze gemischt. Eine Höhe, die einer nicht hat, nimmt der andere mit. */
export function mixPlace(a: Place, b: Place, t: number): Place {
  return {
    x: mix(a.x, b.x, t),
    y: mix(a.y, b.y, t),
    w: mix(a.w, b.w, t),
    h: a.h !== null && b.h !== null ? mix(a.h, b.h, t) : t < 0.5 ? a.h : b.h,
    max: a.max !== null && b.max !== null ? mix(a.max, b.max, t) : t < 0.5 ? a.max : b.max,
    rotate: mix(a.rotate, b.rotate, t),
    scale: mix(a.scale, b.scale, t),
    opacity: mix(a.opacity, b.opacity, t),
    z: mix(a.z, b.z, t),
    step: t < 0.5 ? a.step : b.step,
    tall: null
  };
}

export interface Journey {
  readonly place: Place;
  /** Wie weit er da ist: 0 noch nicht / nicht mehr, 1 ganz. */
  readonly presence: number;
  /** Die Szene, deren Kommen ihn bringt (für Verzögerung und Art) — oder `null`, wenn er schon/noch steht. */
  readonly arriving: number | null;
  /** Wie weit er zwischen zwei Plätzen ist (0–1, mit Kurve) — für den Editor. */
  readonly between: number;
}

/**
 * WO EIN WANDERNDER BAUSTEIN STEHT. Auf jeder Szene mit einem Platz steht er
 * still (über ihre ganze Strecke); dazwischen gleitet er — über Szenen ohne
 * eigenen Platz hinweg. Vor dem ersten und nach dem letzten: bleibt er
 * (`hold`), oder er kommt mit seiner ersten Szene und geht mit seiner letzten.
 */
export function journeyAt(places: ReadonlyMap<number, Place>, zones: readonly Zone[], s: number, ease: Ease, hold: boolean): Journey | null {
  const keyed = [...places.keys()].filter((i) => zones[i] !== undefined).sort((a, b) => a - b);
  if (keyed.length === 0) return null;
  const first = keyed[0], last = keyed[keyed.length - 1];
  const firstZone = zones[first], lastZone = zones[last];

  if (s <= firstZone.to) {
    const place = places.get(first)!;
    if (hold || first === 0) return { place, presence: 1, arriving: null, between: 0 };
    const pIn = enteredOf(firstZone, s);
    return { place, presence: pIn, arriving: pIn < 1 ? first : null, between: 0 };
  }

  if (s >= lastZone.at) {
    const place = places.get(last)!;
    if (s <= lastZone.to || hold || last === zones.length - 1) return { place, presence: 1, arriving: null, between: 0 };
    return { place, presence: 1 - leftOf(lastZone, s), arriving: null, between: 0 };
  }

  for (let k = 0; k < keyed.length - 1; k += 1) {
    const a = keyed[k], b = keyed[k + 1];
    const from = zones[a].to, to = zones[b].at;
    if (s >= zones[a].at && s <= zones[a].to) return { place: places.get(a)!, presence: 1, arriving: null, between: 0 };
    if (s > from && s < to) {
      const t = easeOf(ease, (s - from) / (to - from));
      return { place: mixPlace(places.get(a)!, places.get(b)!, t), presence: 1, arriving: null, between: t };
    }
  }
  return { place: places.get(last)!, presence: 1, arriving: null, between: 0 };
}

/* -- Tiefe ------------------------------------------------------------------------------- */

/**
 * Wie sichtbar ein Gegenstand im Raum ist (Altbestand: --far, und das
 * Ausblenden VOR der Kameraebene — dort wäre die Vergrösserung unendlich).
 * `ze` — sein Abstand nach der Fahrt (z + Kamera), `p` — die Perspektive.
 */
export function depthFade(ze: number, p: number): number {
  const far = Math.min(1, Math.max(0.4, 1 + (ze + 0.5 * p) / (1.8 * p)));
  const near = clamp01((0.88 * p - ze) / (0.32 * p));
  return far * near;
}

/** Wie gross ein Gegenstand in der Tiefe `z` erscheint (ohne Kamera). */
export const depthScale = (z: number, p: number): number => p / Math.max(1, p - z);

/** Ein Zufall, der jedes Mal derselbe ist — sonst zitterten die Wörter in der Vorschau (mulberry32). */
export function seeded(seed: number): () => number {
  let a = (Math.round(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface WordSpot {
  readonly word: string;
  /** Mitte in Prozent der Bühne. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Grösse in Hundertsteln der kürzeren Bühnenseite. */
  readonly size: number;
  readonly alpha: number;
}

/** Tiefe der Wörter: von ganz hinten bis dicht vor die Kamera (Altbestand: WORD_FAR, WORD_NEAR). */
export const WORD_FAR = -1650;
export const WORD_NEAR = -150;

/**
 * DIE WOLKE (Altbestand: `placeWord`). Der Winkel läuft im goldenen Schnitt
 * weiter, damit sich keine Speiche wiederholt; der Abstand zur Mitte wird um
 * die Tiefe vorgerechnet, damit ferne Wörter auf dem Bild ebenso weit streuen;
 * aussen ist gross. Die Einheiten des Altbestands — 0,625 vw quer, 1 vh hoch —
 * sind hier Prozent der Bühne.
 */
export function scatterWords(words: Words, perspective = 1000): WordSpot[] {
  if (words.list.length === 0) return [];
  const roll = seeded(words.seed);
  const spots: WordSpot[] = [];
  for (let index = 0; index < words.count; index += 1) {
    const angle = index * 2.39996 + (roll() - 0.5) * 0.7;
    const z = WORD_FAR + roll() * (WORD_NEAR - WORD_FAR);
    const shrink = (perspective - z) / perspective;
    const out = roll();
    const radius = (30 + out * 46) * shrink;
    spots.push({
      word: words.list[index % words.list.length],
      x: 50 + Math.cos(angle) * radius * 0.625,
      y: 50 + Math.sin(angle) * radius * 0.78,
      z,
      size: 1.5 + out * 3.4 + roll() * 1.3,
      alpha: 0.35 + roll() * 0.45
    });
  }
  return spots;
}

/* -- Anordnen ------------------------------------------------------------------------------ */

export const ARRANGEMENTS = ['ring', 'row', 'column', 'quarters', 'grid', 'stack'] as const;
export type Arrangement = (typeof ARRANGEMENTS)[number];

export const ARRANGEMENT_LABEL: Record<Arrangement, string> = {
  ring: 'W kręgu', row: 'W rzędzie', column: 'W kolumnie', quarters: 'Ćwiartki', grid: 'Siatka', stack: 'Jeden pod drugim'
};

export interface Spot {
  readonly x: number;
  readonly y: number;
  readonly w?: number;
  readonly h?: number | null;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * PLÄTZE FÜR `count` BAUSTEINE — gerechnet aus der Anzahl, nicht eingetragen
 * (Altbestand: `ringPoints`): eine Blase mehr, und alles rückt von selbst.
 * Der Kreis ist je Szene gedreht (`turn`), damit zwei Szenen nicht gleich
 * aussehen; hoch steht er schmal und lang, breit flach.
 */
export function arrange(kind: Arrangement, count: number, tall: boolean, turn = 0): Spot[] {
  if (count <= 0) return [];
  switch (kind) {
    case 'ring': {
      const [cx, cy] = tall ? [50, 50] : [52, 52];
      const rx = tall ? 17 : 27, ry = tall ? 31 : 24;
      const t = turn * 0.37 - 0.25;
      return Array.from({ length: count }, (_, i) => {
        const a = 2 * Math.PI * (i / count + t);
        return { x: r2(cx + rx * Math.cos(a)), y: r2(cy + ry * Math.sin(a)) };
      });
    }
    case 'row':
      return Array.from({ length: count }, (_, i) => ({ x: r2(((i + 0.5) / count) * 100), y: 50, w: r2(Math.min(tall ? 90 : 40, 92 / count)) }));
    case 'column':
    case 'stack':
      return Array.from({ length: count }, (_, i) => ({ x: 50, y: r2(((i + 0.5) / count) * 100), ...(kind === 'stack' ? { w: tall ? 88 : 56 } : {}) }));
    case 'quarters':
      return Array.from({ length: count }, (_, i) => {
        const col = Math.floor((i % 4) / 2), row = i % 2;
        return { x: col === 0 ? 25 : 75, y: row === 0 ? 25 : 75, w: 50, h: 50 };
      });
    case 'grid': {
      const cols = Math.ceil(Math.sqrt(count * (tall ? 0.6 : 1.6)));
      const rows = Math.ceil(count / cols);
      return Array.from({ length: count }, (_, i) => ({
        x: r2(((i % cols) + 0.5) / cols * 100),
        y: r2((Math.floor(i / cols) + 0.5) / rows * 100),
        w: r2(88 / cols)
      }));
    }
  }
}

/* -- Der Sprung (Altbestand: rcGlide) ------------------------------------------------------ */

/**
 * Die Kurve, mit der ein Sprung läuft: eine kubische Hermite-Kurve mit der
 * Anfangssteigung der Hand und der Endsteigung null. Über der Steigung 3
 * schwänge sie über das Ziel hinaus — deshalb ist dort gedeckelt.
 */
export const GLIDE_MAX = 3;

export const glide = (k: number, m: number): number => m * k * (k - 1) * (k - 1) + k * k * (3 - 2 * k);

export const glideSlope = (k: number, m: number): number => m * (3 * k - 1) * (k - 1) + 6 * k * (1 - k);

export function glideLead(speed: number, span: number, reach: number): number {
  if (reach === 0 || span <= 0) return 0;
  return Math.min(GLIDE_MAX, Math.max(0, (speed * span) / reach));
}
