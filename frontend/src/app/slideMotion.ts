/**
 * 0084 — WIE SICH SLAJDY ABLÖSEN, und wo ein wandernder Baustein gerade steht.
 *
 * <b>Alles aus der Stelle der Bahn, nichts aus der Uhr.</b> Der Antrieb
 * (`useSlideScroll`) schiebt die Bahn — mit dem Finger, dem Rad, oder in
 * seinem eigenen Übergang von einem Slajd zum nächsten. Jeder Effekt hier ist
 * eine Funktion dieser Stelle: wer langsam zieht, sieht das Ablösen langsam;
 * wer über die Kante späht und loslässt, sieht es zurückfedern. Eine Uhr
 * daneben liefe davon.
 *
 * <code>
 *   entering(k)   0 → 1, während Slajd k von unten an seinen Platz kommt
 *                 (die letzte Bildschirmhöhe vor seinem Anfang)
 *   deckAt        wo die Folge gerade ist: 2.35 = zwischen Slajd 2 und 3
 *   motionOf      was ein Slajd im Wechsel tut: festhalten, blenden, skalieren
 *   frameAt       der Platz eines wandernden Bausteins an dieser Stelle
 * </code>
 *
 * Rein und ohne Oberfläche — geprüft in `app-platform-check`.
 */

import type { Enter, SlideColors, StageFrame, Transition } from './slides';

export interface DeckFrame {
  readonly start: number;
  readonly height: number;
}

const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value);

/** Sanft hinein, sanft hinaus — damit ein Effekt nicht am Rand der Strecke ruckt. */
export const ease = (t: number): number => t * t * (3 - 2 * t);

/** Wie weit Slajd `k` hereingekommen ist: 0 — noch ganz unter dem Schirm, 1 — an seinem Platz (oder schon darüber hinaus). */
export function entering(frames: readonly DeckFrame[], k: number, position: number, viewport: number): number {
  if (k <= 0) return 1;
  const frame = frames[k];
  if (frame === undefined || viewport <= 0) return 0;
  return clamp((position - (frame.start - viewport)) / viewport, 0, 1);
}

/** Wo die Folge gerade steht: ganze Zahl — auf einem Slajd, dazwischen — im Wechsel. */
export function deckAt(frames: readonly DeckFrame[], position: number, viewport: number): number {
  let at = 0;
  for (let k = 1; k < frames.length; k += 1) at += entering(frames, k, position, viewport);
  return at;
}

/** Die Stelle, an der ein festgehaltener Slajd steht: sein eigener Bereich, nicht weiter. */
export function pinnedPosition(frame: DeckFrame, position: number, viewport: number): number {
  const travel = Math.max(0, frame.height - viewport);
  return clamp(position, frame.start, frame.start + travel);
}

/**
 * Was ein Slajd im Wechsel tut.
 *
 * <code>
 *   pin       festhalten: er läuft nicht mit der Bahn, sondern steht auf dem Schirm
 *   opacity   0–1
 *   scale     1 — seine Grösse
 *   shift     waagrecht, in Prozent seiner Breite
 *   dim       0–1, wie sehr er nachdunkelt (unter einem, der ihn bedeckt)
 *   above     über seinem Nachbarn (beim Odsłonięcie liegt der gehende oben)
 * </code>
 */
export interface Motion {
  readonly pin: boolean;
  readonly opacity: number;
  readonly scale: number;
  readonly shift: number;
  readonly dim: number;
  readonly above: boolean;
}

export const STILL: Motion = { pin: false, opacity: 1, scale: 1, shift: 0, dim: 0, above: false };

/**
 * Bei „weniger Bewegung" (System) wird aus jedem Übergang ein Überblenden —
 * nichts fliegt, nichts zoomt; nur „Przewinięcie" bleibt, was es ist.
 */
export const calmer = (kind: Transition, reduced: boolean): Transition =>
  reduced && kind !== 'scroll' ? 'fade' : kind;

function incoming(kind: Transition, t: number): Motion {
  const e = ease(t);
  switch (kind) {
    case 'fade': return { ...STILL, pin: true, opacity: e };
    case 'cover': return STILL;
    case 'reveal': return { ...STILL, pin: true };
    case 'zoom': return { ...STILL, pin: true, opacity: e, scale: 0.88 + 0.12 * e };
    case 'side': return { ...STILL, pin: true, shift: (1 - e) * 100 };
    default: return STILL;
  }
}

function outgoing(kind: Transition, t: number): Motion {
  const e = ease(t);
  switch (kind) {
    case 'fade': return { ...STILL, pin: true };
    case 'cover': return { ...STILL, pin: true, scale: 1 - 0.06 * e, dim: 0.45 * e };
    case 'reveal': return { ...STILL, above: true };
    case 'zoom': return { ...STILL, pin: true, opacity: 1 - e, scale: 1 + 0.12 * e };
    case 'side': return { ...STILL, pin: true, shift: -35 * e, dim: 0.3 * e };
    default: return STILL;
  }
}

/**
 * Was Slajd `k` gerade tut. Ein Slajd hat zwei Kanten: die, an der er kommt
 * (seine eigene Art), und die, an der er geht (die Art des NÄCHSTEN). Die
 * beiden Strecken berühren sich höchstens, sie überlappen nie.
 */
export function motionOf(
  frames: readonly DeckFrame[], k: number, position: number, viewport: number,
  kinds: readonly Transition[], reduced = false
): Motion {
  const into = entering(frames, k, position, viewport);
  if (into > 0 && into < 1) return incoming(calmer(kinds[k] ?? 'scroll', reduced), into);

  const leaving = k + 1 < frames.length ? entering(frames, k + 1, position, viewport) : 0;
  if (leaving > 0 && leaving < 1) return outgoing(calmer(kinds[k + 1] ?? 'scroll', reduced), leaving);

  return STILL;
}

/** Wie der INHALT eines Slajds erscheint, wenn er `t` weit hereingekommen ist. */
export function enterStyle(kind: Enter, t: number, reduced = false): { opacity: number; x: number; y: number; scale: number } {
  const e = ease(t);
  const plain = { opacity: 1, x: 0, y: 0, scale: 1 };
  if (kind === 'none') return plain;
  if (reduced) return { ...plain, opacity: e };
  switch (kind) {
    case 'rise': return { ...plain, opacity: e, y: (1 - e) * 56 };
    case 'fade': return { ...plain, opacity: e };
    case 'zoom': return { ...plain, opacity: e, scale: 0.9 + 0.1 * e };
    case 'left': return { ...plain, opacity: e, x: (1 - e) * -72 };
    case 'right': return { ...plain, opacity: e, x: (1 - e) * 72 };
    default: return plain;
  }
}

/* -- Der wandernde Baustein ---------------------------------------------------------- */

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Der Platz an der Stelle `at` (`deckAt`) — aus den Plätzen je Slajd. Zwischen
 * zwei Slajdy mit Platz gleitet er (auch über Slajdy ohne eigenen hinweg); vor
 * dem ersten und nach dem letzten bleibt er stehen. `null`: kein Platz überhaupt.
 */
export function frameAt(frames: ReadonlyMap<number, StageFrame>, at: number): StageFrame | null {
  const keys = [...frames.keys()].sort((a, b) => a - b);
  if (keys.length === 0) return null;
  if (at <= keys[0]) return frames.get(keys[0])!;
  if (at >= keys[keys.length - 1]) return frames.get(keys[keys.length - 1])!;

  let i = 0;
  while (i + 1 < keys.length && keys[i + 1] <= at) i += 1;
  const from = frames.get(keys[i])!;
  const to = frames.get(keys[i + 1])!;
  const t = ease((at - keys[i]) / (keys[i + 1] - keys[i]));

  return {
    x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), w: lerp(from.w, to.w, t),
    scale: lerp(from.scale, to.scale, t), rotate: lerp(from.rotate, to.rotate, t), opacity: lerp(from.opacity, to.opacity, t)
  };
}

/* -- Farben, die mitgehen ------------------------------------------------------------- */

const hex = (value: string): [number, number, number] | null => {
  const m = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (m === null) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Zwei Farben gemischt — `#rrggbb` fliessend; anderes (ein Name) springt in der Mitte. */
export function mixColor(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  if (x === null || y === null) return t < 0.5 ? a : b;
  return '#' + x.map((c, i) => Math.round(lerp(c, y[i], t)).toString(16).padStart(2, '0')).join('');
}

export interface DeckColors {
  readonly accent: string;
  readonly ink: string;
  readonly ground: string;
  readonly muted: string;
}

/** Die Farben eines Slajds: seine eigenen, wo er welche hat, sonst die der Seite. */
export const colorsOf = (page: DeckColors, own: SlideColors | null | undefined): DeckColors => ({
  accent: own?.accent ?? page.accent,
  ink: own?.ink ?? page.ink,
  ground: own?.ground ?? page.ground,
  muted: own?.muted ?? page.muted
});

/** Die Farben an der Stelle `at` — zwischen zwei Slajdy fliessend. */
export function colorsAt(each: readonly DeckColors[], at: number): DeckColors | null {
  if (each.length === 0) return null;
  const i = Math.min(each.length - 1, Math.max(0, Math.floor(at)));
  const j = Math.min(each.length - 1, i + 1);
  const t = ease(Math.min(1, Math.max(0, at - i)));
  const a = each[i];
  const b = each[j];
  return {
    accent: mixColor(a.accent, b.accent, t), ink: mixColor(a.ink, b.ink, t),
    ground: mixColor(a.ground, b.ground, t), muted: mixColor(a.muted, b.muted, t)
  };
}
