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
 *
 * 2026-10-19 — dieselbe Zahl treibt die KLATKI eines Platzes (`placeAt`): ihr
 * Fortschritt ist das Innere der Szene, ihr Kommen oder ihr Gehen (`progressOf`);
 * Ausschnitt und Maske mischen sich mit (`mixCrop`, `mixMask`, `maskCss`).
 */

import {
  ORIGIN_AT, type Arrival, type Between, type Ease, type Frame, type FrameValues, type Mask, type Origin, type Place, type Progress,
  type SceneChange, type Words
} from './presentation';

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
  /** 0108 — senkrecht in Pixeln und Unschärfe (beim Rozmycie: die gehende sinkt, die kommende steigt). */
  readonly lift: number;
  readonly blur: number;
}

/** 0108 — der Wechsel des Pokaz von Cogita: 12 px Weg, 2 px Unschärfe. */
export const DISSOLVE_SCENE = { lift: 12, blur: 2 } as const;

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
  let opacity = 1, x = 0, y = 0, scale = 1, dim = 0, above = false, lift = 0, blur = 0;
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
      case 'dissolve': opacity = pIn; lift = (1 - e) * DISSOLVE_SCENE.lift; blur = (1 - e) * DISSOLVE_SCENE.blur; break;
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
      /* Beide zugleich: die eine blendet aus, sinkt und verschwimmt, während die andere aufsteigt. */
      case 'dissolve': opacity *= 1 - pOut; lift += e * DISSOLVE_SCENE.lift; blur += e * DISSOLVE_SCENE.blur; break;
    }
  }

  return { visible, pIn, pOut, opacity, x, y, scale, dim, above, flown, lift, blur };
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
    tall: null,
    crop: mixCrop(a.crop, b.crop, t),
    mask: mixMask(a.mask, b.mask, t),
    frames: [],
    by: a.by,
    still: a.still
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
  /** 2026-10-19 — auf welcher Szene er gerade steht (beim Gleiten: die, von der er kommt — wer mit seinen Szenen geht, die, zu der er geht). */
  readonly scene: number;
}

/**
 * WO EIN WANDERNDER BAUSTEIN STEHT. Auf jeder Szene mit einem Platz steht er
 * still (über ihre ganze Strecke); dazwischen gleitet er — über Szenen ohne
 * eigenen Platz hinweg. Vor dem ersten und nach dem letzten: bleibt er
 * (`hold`), oder er kommt mit seiner ersten Szene und geht mit seiner letzten.
 */
export function journeyAt(
  places: ReadonlyMap<number, Place>, zones: readonly Zone[], s: number, ease: Ease, hold: boolean,
  /** 2026-10-19 — der Platz auf Szene `i` an der Stelle `s` (mit seinen Klatki); fehlt: wie er dasteht. */
  framed: (i: number, s: number) => Place = (i) => places.get(i)!,
  /** 2026-10-19 — zwischen Plätzen auf nicht benachbarten Szenen: gleiten (wie bisher) oder gehen und wiederkommen. */
  between: Between = 'glide'
): Journey | null {
  const keyed = [...places.keys()].filter((i) => zones[i] !== undefined).sort((a, b) => a - b);
  if (keyed.length === 0) return null;
  const first = keyed[0], last = keyed[keyed.length - 1];
  const firstZone = zones[first], lastZone = zones[last];

  if (s <= firstZone.to) {
    const place = framed(first, s);
    if (hold || first === 0) return { place, presence: 1, arriving: null, between: 0, scene: first };
    const pIn = enteredOf(firstZone, s);
    return { place, presence: pIn, arriving: pIn < 1 ? first : null, between: 0, scene: first };
  }

  if (s >= lastZone.at) {
    const place = framed(last, s);
    if (s <= lastZone.to || hold || last === zones.length - 1) return { place, presence: 1, arriving: null, between: 0, scene: last };
    return { place, presence: 1 - leftOf(lastZone, s), arriving: null, between: 0, scene: last };
  }

  for (let k = 0; k < keyed.length - 1; k += 1) {
    const a = keyed[k], b = keyed[k + 1];
    const from = zones[a].to, to = zones[b].at;
    if (s >= zones[a].at && s <= zones[a].to) return { place: framed(a, s), presence: 1, arriving: null, between: 0, scene: a };
    if (s > from && s < to) {
      /*
       * 2026-10-19 — GEHEN UND WIEDERKOMMEN: zwischen nicht benachbarten Szenen
       * geht er mit der einen (wie ein Baustein seiner Szene) und kommt mit der
       * anderen — dazwischen ist er nicht da.
       */
      if (between === 'leave' && b > a + 1) {
        if (s < from + 1) return { place: framed(a, s), presence: 1 - leftOf(zones[a], s), arriving: null, between: 0, scene: a };
        if (s > to - 1) {
          const pIn = enteredOf(zones[b], s);
          return { place: framed(b, s), presence: pIn, arriving: pIn < 1 ? b : null, between: 0, scene: b };
        }
        return { place: framed(a, s), presence: 0, arriving: null, between: 0, scene: a };
      }
      const t = easeOf(ease, (s - from) / (to - from));
      /* 2026-10-19 — wer mit seinen Szenen geht ("leave"), steht beim Gleiten schon in der Ebene der kommenden: ihr Grund deckt ihn nicht zu. */
      return { place: mixPlace(framed(a, s), framed(b, s), t), presence: 1, arriving: null, between: t, scene: between === 'leave' ? b : a };
    }
  }
  return { place: framed(last, s), presence: 1, arriving: null, between: 0, scene: last };
}

/* -- 2026-10-19: Klatki nach dem Fortschritt einer Szene ------------------------------------------ */

/**
 * WIE WEIT EINE SZENE IST — nach der Art des Fortschritts, je 0–1 (`Progress`):
 * das Innere (vom ersten zum letzten Schritt; ohne zweiten Schritt 0), das Kommen
 * (die erste Szene ist immer da), das Gehen (die letzte geht nie).
 */
export function progressOf(by: Progress, zone: Zone, s: number, first = false, last = false): number {
  switch (by) {
    case 'scene': return zone.to <= zone.at ? 0 : clamp01((s - zone.at) / (zone.to - zone.at));
    case 'enter': return first ? 1 : enteredOf(zone, s);
    case 'leave': return last ? 0 : leftOf(zone, s);
  }
}

/** Wo eine Klatka steht: an einem Schritt (in Teilen der Schritte der Szene) oder bei `at`. */
export const frameAt = (frame: Frame, steps: number): number =>
  frame.step === null ? frame.at : steps <= 1 ? 0 : clamp01(frame.step / (steps - 1));

/** Die zwei Prozente eines Ausschnitts („57% 40%" — so speichert ihn `readCrop`). */
const cropXY = (crop: string): { x: number; y: number } | null => {
  const m = /^(-?[\d.]+)% (-?[\d.]+)%$/.exec(crop);
  return m === null ? null : { x: Number(m[1]), y: Number(m[2]) };
};

/** Zwei Ausschnitte gemischt — Prozent um Prozent; fehlt einer, gilt bis zur Mitte der eine, danach der andere. */
export function mixCrop(a: string | null, b: string | null, t: number): string | null {
  if (a === b) return a;
  const pa = a === null ? null : cropXY(a);
  const pb = b === null ? null : cropXY(b);
  if (pa === null || pb === null) return t < 0.5 ? a : b;
  return `${r2(mix(pa.x, pb.x, t))}% ${r2(mix(pa.y, pb.y, t))}%`;
}

/**
 * Die Maske, die ALLES zeigt — in der Form einer anderen und um ihre Mitte
 * (damit eine Maske aus dem Nichts aufgeht, statt zu springen). Ein Kreis
 * braucht dafür höchstens 141 % (bis in die fernste Ecke, wie gestreckt der
 * Kasten auch ist), eine Ellipse √2 mal den Weg zum fernsten Rand.
 */
export function fullMask(like: Mask): Mask {
  switch (like.shape) {
    case 'circle': return { ...like, r: 141.5 };
    case 'ellipse': return { ...like, rx: r2(1.4143 * Math.max(like.x, 100 - like.x)), ry: r2(1.4143 * Math.max(like.y, 100 - like.y)) };
    case 'inset': return { ...like, top: 0, right: 0, bottom: 0, left: 0 };
  }
}

/** Zwei Masken gemischt: dieselbe Form Zahl um Zahl; ohne Maske — mit der, die alles zeigt; verschiedene Formen wechseln in der Mitte. */
export function mixMask(a: Mask | null, b: Mask | null, t: number): Mask | null {
  if (a === null && b === null) return null;
  if (t <= 0) return a;
  if (t >= 1) return b;
  const from = a ?? fullMask(b!);
  const to = b ?? fullMask(a!);
  if (from.shape !== to.shape) return t < 0.5 ? a : b;
  return {
    shape: from.shape,
    x: mix(from.x, to.x, t), y: mix(from.y, to.y, t), r: mix(from.r, to.r, t), rx: mix(from.rx, to.rx, t), ry: mix(from.ry, to.ry, t),
    top: mix(from.top, to.top, t), right: mix(from.right, to.right, t), bottom: mix(from.bottom, to.bottom, t), left: mix(from.left, to.left, t),
    round: mix(from.round, to.round, t)
  };
}

/** Eine Maske als `clip-path` — keine: leer. */
export function maskCss(mask: Mask | null): string {
  if (mask === null) return '';
  switch (mask.shape) {
    case 'circle': return `circle(${r2(mask.r)}% at ${r2(mask.x)}% ${r2(mask.y)}%)`;
    case 'ellipse': return `ellipse(${r2(mask.rx)}% ${r2(mask.ry)}% at ${r2(mask.x)}% ${r2(mask.y)}%)`;
    case 'inset': return `inset(${r2(mask.top)}% ${r2(mask.right)}% ${r2(mask.bottom)}% ${r2(mask.left)}%${mask.round > 0 ? ` round ${r2(mask.round)}rem` : ''})`;
  }
}

/** Was eine Klatka zeigt — der Platz ohne Kennung, Schritt und Klatki. */
type Look = Pick<Place, 'x' | 'y' | 'w' | 'h' | 'max' | 'rotate' | 'scale' | 'opacity' | 'z' | 'crop' | 'mask'>;

const lookOf = (p: Place): Look => ({ x: p.x, y: p.y, w: p.w, h: p.h, max: p.max, rotate: p.rotate, scale: p.scale, opacity: p.opacity, z: p.z, crop: p.crop, mask: p.mask });

const withValues = (look: Look, v: FrameValues): Look => ({
  x: v.x ?? look.x, y: v.y ?? look.y, w: v.w ?? look.w,
  h: v.h === undefined ? look.h : v.h, max: v.max === undefined ? look.max : v.max,
  rotate: v.rotate ?? look.rotate, scale: v.scale ?? look.scale, opacity: v.opacity ?? look.opacity, z: v.z ?? look.z,
  crop: v.crop ?? look.crop, mask: v.mask === undefined ? look.mask : v.mask
});

const mixLook = (a: Look, b: Look, t: number): Look => ({
  x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t),
  h: a.h !== null && b.h !== null ? mix(a.h, b.h, t) : t < 0.5 ? a.h : b.h,
  max: a.max !== null && b.max !== null ? mix(a.max, b.max, t) : t < 0.5 ? a.max : b.max,
  rotate: mix(a.rotate, b.rotate, t), scale: mix(a.scale, b.scale, t), opacity: mix(a.opacity, b.opacity, t), z: mix(a.z, b.z, t),
  crop: mixCrop(a.crop, b.crop, t), mask: mixMask(a.mask, b.mask, t)
});

/**
 * DER PLATZ BEI `u` (0–1 seines Fortschritts) — mit seinen Klatki. Der Platz
 * selbst ist das Bild bei 0; jede Klatka ändert, was sie nennt (das Übrige
 * bleibt, wie es in der Klatka davor war), und der Baustein geht in ihrer
 * Kurve (`ease`) von der Klatka davor zu ihr. Nach der letzten bleibt er. Eine
 * Klatka ohne Änderung hält also einfach still — bis zur nächsten. `steps`:
 * die Schritte der Szene (für Klatki an einem Schritt).
 */
export function placeAt(place: Place, u: number, steps = 1): Place {
  if (place.frames.length === 0) return place;
  const frames = place.frames
    .map((frame, i) => ({ frame, at: frameAt(frame, steps), i }))
    .sort((a, b) => a.at - b.at || a.i - b.i);
  let look = lookOf(place);
  let at = 0;
  for (const one of frames) {
    const next = withValues(look, one.frame);
    if (u <= one.at) {
      const t = one.at <= at ? 1 : clamp01((u - at) / (one.at - at));
      return { ...place, ...mixLook(look, next, easeOf(one.frame.ease, t)), frames: [] };
    }
    look = next;
    at = one.at;
  }
  return { ...place, ...look, frames: [] };
}

/** Wo die Klatki bei „weniger Bewegung" stehen: `still` — sonst am Ende (beim Gehen am Anfang: die Szene ist ja noch da). */
export const stillOf = (place: Place): number => place.still ?? (place.by === 'leave' ? 0 : 1);

/**
 * 2026-10-19 — UND AN DIESER STELLE `s`: Klatki an Schritten (eine Wahl, die
 * ein Schritt trifft) springen von Schritt zu Schritt, ohne Weg dazwischen —
 * sonst stünde die Szene auf einer einzigen Wahl, und die anderen Texte wären
 * nie zu sehen. Ein gesetztes `still` gilt immer.
 */
export function stillAt(place: Place, zone: Zone, s: number): number {
  if (place.still !== null || place.by !== 'scene' || !place.frames.some((frame) => frame.step !== null)) return stillOf(place);
  const span = zone.to - zone.at;
  return span <= 0 ? 0 : clamp01(Math.round(s - zone.at) / span);
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
