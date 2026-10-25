/**
 * 2026-10-25 — EIN SLAJD IST EIN BLATT: seine eigenen Schichten und sein Inhalt,
 * zusammen in seinem Abschnitt. Der Wechsel bewegt das Blatt — hinauf, festgehalten,
 * kleiner, zur Seite, blasser —, und wer oben hinausfährt, nimmt alles von sich mit
 * (Wunsch des Nutzers: „die Slajdy sollen oben ganz verschwinden"). Vorher lagen die
 * eigenen Schichten bei einem gemeinsamen Tuch fest im Tuch und blendeten nur über —
 * das Foto des vorigen Slajds stand noch über dem ganzen Schirm, während sein Text
 * längst oben war. Das Tuch liegt jetzt als erstes in der Bahn (`SlideDeck`), hinter
 * allen Blättern.
 *
 * <b>Wer über wem liegt, schneidet</b> (`cut`). Über dem Tuch ist ein Blatt oft
 * durchsichtig (ein Foto mit .45, nur ein Schein, gar keine eigenen Schichten) — es
 * kann den anderen nicht verdecken. Darum wird vom unteren abgeschnitten, was der
 * obere bedeckt: beim Odsłonięcie der kommende unter der Unterkante des gehenden,
 * beim Nakrycie der alte unter der Oberkante des kommenden, „Z boku" der alte rechts
 * vom kommenden. Darunter liegt das Tuch, nicht der andere Slajd.
 *
 * <b>Wer an Ort und Stelle überblendet</b> (Przenikanie): der alte steht, der neue
 * erscheint auf ihm. Deckt der neue ganz (`layerCover` 1), bleibt der alte, wie er
 * ist; sonst blendet der alte so aus, dass genau 1 − e von ihm zu sehen bleibt — am
 * Ende nichts, kein Sprung im letzten Bild.
 *
 * <b>Die Schichten wandern mit der Bahn</b>, jede in ihrem Tempo — auch, während ihr
 * Slajd im Wechsel festgehalten steht (Wunsch des Nutzers, 2026-10-24: Tiefe durch
 * verschiedene Tempi, nichts Stehendes).
 *
 * Rein und ohne Oberfläche — geprüft in `app-slides-check`.
 */

import { calmer, ease, edgeOf, entering, motionOf, pinnedPosition, type DeckFrame, type Motion } from './slideMotion';
import type { Layer } from './slideLook';
import type { Transition } from './slides';

/** Was ein anderer Slajd von diesem bedeckt: oben und unten in px, rechts in Prozent seiner Breite — in seinen eigenen, ungeschrumpften Massen. */
export interface Cut {
  readonly top: number;
  readonly bottom: number;
  readonly right: number;
}

export interface Sheet {
  readonly motion: Motion;
  /** Die Stelle der Bahn, an der er steht — festgehalten, sonst die Bahn selbst. */
  readonly pinned: number;
  /** Was ein anderer von ihm bedeckt — `null`: nichts. */
  readonly cut: Cut | null;
}

const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value);

/** Eine Farbe ohne Durchsicht? Namen (ground, accent …) sind es; rgba/hsla mit Alpha unter 1, #rgba, „transparent" nicht. */
function solid(color: string): boolean {
  const c = color.trim().toLowerCase();
  if (c === 'transparent') return false;
  const hex = /^#([0-9a-f]+)$/.exec(c);
  if (hex !== null) {
    const digits = hex[1];
    if (digits.length === 4) return digits[3] === 'f';
    if (digits.length === 8) return digits.slice(6) === 'ff';
    return true;
  }
  const fn = /^(?:rgba?|hsla?)\((.*)\)$/.exec(c);
  if (fn === null) return true;
  const parts = fn[1].split(/[\s,/]+/).filter((part) => part !== '');
  if (parts.length < 4) return true;
  const alpha = parts[3].endsWith('%') ? Number.parseFloat(parts[3]) / 100 : Number.parseFloat(parts[3]);
  return !(alpha < 0.999);
}

/**
 * Wie viel ein Stapel eigener Schichten verdeckt (0–1): ein Verlauf aus deckenden
 * Farben ganz, ein Bild („normal") mit seiner Deckkraft — höchstens 0,98, ein Bild
 * kann Löcher haben —, alles andere (Schein, Schriftzug, Luft, andere Mischungen) nichts.
 */
export function layerCover(layers: readonly Layer[]): number {
  let open = 1;
  for (const layer of layers) {
    const covers = layer.kind === 'gradient'
      ? (solid(layer.from) && solid(layer.to) && (layer.via === null || solid(layer.via)) ? 1 : 0)
      : layer.kind === 'image' && layer.url.trim() !== '' && layer.blend === 'normal' ? Math.min(layer.opacity, 0.98) : 0;
    open *= 1 - covers;
  }
  return 1 - open;
}

/**
 * Wie jedes Blatt an dieser Stelle der Bahn steht, und was von ihm bedeckt ist.
 * `cover[k]`: wie viel Slajd k mit seinen Schichten verdeckt (`layerCover`; fehlt — ganz).
 */
export function sheetsAt(
  frames: readonly DeckFrame[], position: number, viewport: number,
  kinds: readonly Transition[], cover: readonly number[] = [], reduced = false
): Sheet[] {
  const out = frames.map((frame, k) => {
    const motion = motionOf(frames, k, position, viewport, kinds, reduced);
    return { motion, pinned: motion.pin ? pinnedPosition(frame, position, viewport) : position, cut: null as Cut | null };
  });

  /* Jeder Slajd ist mindestens einen Schirm hoch: höchstens ein Wechsel ist zugleich im Gang. */
  for (let k = 1; k < frames.length; k += 1) {
    const t = entering(frames, k, position, viewport);
    if (t <= 0 || t >= 1) continue;
    const kind = calmer(kinds[k] ?? 'scroll', reduced);
    const old = out[k - 1];
    const neu = out[k];
    const oldTop = frames[k - 1].start - old.pinned + old.motion.lift;
    const neuTop = frames[k].start - neu.pinned + neu.motion.lift;
    const oldHeight = frames[k - 1].height;
    if (kind === 'reveal') {
      /* Der alte fährt oben hinaus und deckt auf: vom neuen nur, was unter seiner Unterkante liegt. */
      neu.cut = { top: clamp(oldTop + oldHeight - neuTop, 0, frames[k].height), bottom: 0, right: 0 };
    } else if (kind === 'cover') {
      /* Der neue kommt von unten über den alten, der steht und um die Mitte des Schirms kleiner wird: vom alten nur, was darüber liegt. */
      const origin = old.pinned - frames[k - 1].start + viewport / 2;
      const under = origin + (neuTop - oldTop - origin) / Math.max(0.01, old.motion.scale);
      old.cut = { top: 0, bottom: clamp(oldHeight - under, 0, oldHeight), right: 0 };
    } else if (kind === 'side') {
      /* Der neue kommt von rechts über den alten, der nach links weicht: vom alten nur, was links vom neuen liegt. */
      old.cut = { top: 0, bottom: 0, right: clamp(100 - (neu.motion.shift - old.motion.shift), 0, 100) };
    } else if (kind === 'fade') {
      /* Unter einem neuen, der nicht ganz deckt, bleibt vom alten genau 1 − e zu sehen. */
      const covers = clamp(cover[k] ?? 1, 0, 1);
      const e = ease(t);
      if (covers < 0.999) old.motion = { ...old.motion, opacity: (1 - e) / (1 - covers * e) };
    }
    /* Przewinięcie und Przepływ berühren sich nur; Przybliżenie und Rozmycie blenden den alten ohnehin aus. */
  }
  return out;
}

/**
 * 2026-10-25 — WIE VIEL RAUM DIE SCHICHTEN EINES SLAJDS BRAUCHEN (Wunsch des Nutzers:
 * „so gross, wie es für den Slajd und die Bewegung darin reicht — und das Bild dabei so
 * gross wie möglich"). Ein Slajd ist ein Blatt: von seinen Schichten ist nur zu sehen,
 * was in seinem Rechteck auf dem Schirm liegt. Fährt er herein (nicht festgehalten), ist
 * sein unterer Teil noch nicht zu sehen; fährt er hinaus, sein oberer nicht mehr — dort
 * braucht die Schicht nichts zu bedecken. Nur wo ein Wechsel ihn festhält, steht er
 * weiter auf dem ganzen Schirm, während seine Schichten weiterwandern.
 *
 * <code>
 *   entryPinned  er steht beim Kommen (Przenikanie, Odsłonięcie, …) — der erste kommt nie
 *   exitPinned   er steht beim Gehen (Przenikanie, Nakrycie, …) — der letzte geht nie
 *   above        Rand oben: ein hoher Slajd, den das Gehen verkleinert oder sinken lässt, zeigt mehr von oben
 *   below        Rand unten: ein hoher Slajd, den das Kommen verkleinert (Przybliżenie), zeigt mehr von unten
 * </code>
 */
export interface LayerRoom {
  readonly entryPinned: boolean;
  readonly exitPinned: boolean;
  readonly above: number;
  readonly below: number;
}

/** Der grösste Bedarf — so rechnete `layerPlace` bis 2026-10-25 für jeden Slajd. */
export const ROOM_ANY: LayerRoom = { entryPinned: true, exitPinned: true, above: 0, below: 0 };

/** Der Raum, den Slajd `k` bei diesen Wechseln braucht — gleich über seinen ganzen Weg (eine Höhe, kein Neuzeichnen). */
export function layerRoom(frames: readonly DeckFrame[], k: number, viewport: number, kinds: readonly Transition[], reduced = false): LayerRoom {
  const frame = frames[k];
  if (frame === undefined) return ROOM_ANY;
  const entry = k > 0 ? edgeOf('entry', calmer(kinds[k] ?? 'scroll', reduced)) : null;
  const exit = k + 1 < frames.length ? edgeOf('exit', calmer(kinds[k + 1] ?? 'scroll', reduced)) : null;
  /* Verkleinert um die Mitte des Schirms: so viel mehr ist auf jeder Seite zu sehen. Nur ein hoher Slajd hat dort noch Zeilen. */
  const shrink = (scale: number): number => (scale < 1 ? (1 / Math.max(0.01, scale) - 1) * viewport / 2 : 0);
  const tall = frame.height > viewport + 0.5;
  return {
    entryPinned: entry?.pin ?? false,
    exitPinned: exit?.pin ?? false,
    above: tall && exit !== null ? shrink(exit.scale) + exit.sink : 0,
    below: tall && entry !== null ? shrink(entry.scale) : 0
  };
}

/**
 * EINE SCHICHT IN IHREM SLAJD: wo sie darin steht und wie hoch sie ist. Auf dem
 * Schirm wandert sie um ihr Tempo langsamer als die Bahn (0 steht, 1 läuft mit dem
 * Inhalt) — über den ganzen Weg des Slajds, vom Hereinkommen unten bis zum Verlassen
 * oben. Gerechnet aus der Bahn: auch ein festgehaltener Slajd behält seine Tiefe.
 * Ausserhalb des Schirms ändert sich nichts (keine Arbeit für Slajdy, die keiner sieht).
 *
 * 2026-10-25 — SO HOCH WIE NÖTIG, NICHT HÖHER (`room`, siehe `LayerRoom`): ein Bild
 * wird nur so weit gestreckt, wie seine Wanderung es verlangt. Ein Slajd von einem
 * Schirm zwischen zwei Przewinięcia braucht nichts als den Schirm; ein hoher dazu sein
 * Tempo mal seine Überlänge; jedes festgehaltene Ende dazu sein Tempo mal einen Schirm.
 * Kommt er herein, ohne festgehalten zu werden, steht die Schicht um Tempo × Schirm
 * tiefer — beim Ankommen trifft ihre Oberkante genau die des Slajds. Ohne `room`: der
 * grösste Bedarf (`ROOM_ANY`), wie vorher.
 *
 * Bei „weniger Bewegung" läuft sie mit ihrem Slajd und bedeckt ihn ganz (slides.css
 * nimmt dort jedes transform weg). `shift`: wie weit ein Schriftzug gerade über den
 * Schirm gewandert ist (px).
 */
export function layerPlace(
  speed: number, bigtext: boolean, frame: DeckFrame, pinned: number, position: number, viewport: number, reduced = false,
  room: LayerRoom = ROOM_ANY
): { top: number; height: number; shift: number } {
  if (reduced) return { top: 0, height: bigtext ? viewport : Math.max(frame.height, viewport), shift: 0 };
  const span = frame.height + viewport;
  const local = clamp(pinned - frame.start, -viewport, frame.height);
  const along = clamp(position - frame.start + viewport, 0, span);
  /* Ein Schriftzug steht in seiner Ebene, die genau einen Schirm hoch ist — nur sein Text wandert. */
  if (bigtext) return { top: local, height: viewport, shift: (0.5 - along / span) * viewport * speed };
  const lead = room.entryPinned ? 0 : speed * viewport;
  const reach = room.exitPinned ? span : frame.height;
  return {
    top: local - speed * along + lead - room.above,
    height: viewport - lead + speed * reach + room.above + room.below,
    shift: 0
  };
}
