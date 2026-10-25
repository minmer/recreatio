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

import { calmer, ease, entering, motionOf, pinnedPosition, type DeckFrame, type Motion } from './slideMotion';
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
 * EINE SCHICHT IN IHREM SLAJD: wo sie darin steht und wie hoch sie ist. Auf dem
 * Schirm wandert sie um ihr Tempo langsamer als die Bahn (0 steht, 1 läuft mit dem
 * Inhalt) — über den ganzen Weg des Slajds, vom Hereinkommen unten bis zum Verlassen
 * oben —, und sie ist um ihr Tempo höher als der Schirm, damit sie den Slajd auf
 * diesem ganzen Weg bedeckt (ein Bild wird dafür grösser gezogen). Gerechnet aus der
 * Bahn: auch ein festgehaltener Slajd behält seine Tiefe. Ausserhalb des Schirms
 * ändert sich nichts (keine Arbeit für Slajdy, die keiner sieht).
 *
 * Bei „weniger Bewegung" läuft sie mit ihrem Slajd und bedeckt ihn ganz (slides.css
 * nimmt dort jedes transform weg). `shift`: wie weit ein Schriftzug gerade über den
 * Schirm gewandert ist (px).
 */
export function layerPlace(
  speed: number, bigtext: boolean, frame: DeckFrame, pinned: number, position: number, viewport: number, reduced = false
): { top: number; height: number; shift: number } {
  if (reduced) return { top: 0, height: bigtext ? viewport : Math.max(frame.height, viewport), shift: 0 };
  const span = frame.height + viewport;
  const local = clamp(pinned - frame.start, -viewport, frame.height);
  const along = clamp(position - frame.start + viewport, 0, span);
  const pace = bigtext ? 0 : speed;
  return {
    top: local - pace * along,
    height: viewport + pace * span,
    shift: bigtext ? (0.5 - along / span) * viewport * speed : 0
  };
}
