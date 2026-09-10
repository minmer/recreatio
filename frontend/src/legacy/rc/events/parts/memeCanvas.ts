/**
 * Laying out a meme: a picture, and a black band under it with white words.
 *
 * All of it is arithmetic, and all of it is the kind that looks almost right
 * when it is wrong — a caption two pixels past the edge, a band that swallows
 * half the photograph, a font that shrinks to nothing on a long sentence. So the
 * measuring lives here, apart from the canvas it eventually draws on, with the
 * text measurement handed in: the checks can then measure with a ruler of their
 * own instead of needing a browser.
 */

/** The band's share of the finished picture. A quarter to a fifth reads well. */
export const BAR_SHARE = 0.22;

/** Nothing is gained past this: a meme is looked at on a phone and sent onwards. */
export const MAX_WIDTH = 1080;

export type MemeLayout = {
  width: number;
  height: number;
  /** Where the picture ends and the band begins. */
  imageHeight: number;
  barHeight: number;
};

/**
 * The finished shape, from the piece of picture that was chosen.
 *
 * The crop keeps its proportions and the band is added underneath, so the
 * picture is never squeezed to make room for the words — the words take their
 * share of a taller image instead.
 */
export function memeLayout(cropWidth: number, cropHeight: number, share = BAR_SHARE): MemeLayout {
  const scale = cropWidth > MAX_WIDTH ? MAX_WIDTH / cropWidth : 1;

  const width = Math.max(1, Math.round(cropWidth * scale));
  const imageHeight = Math.max(1, Math.round(cropHeight * scale));

  // share is of the whole, so the band is that fraction of the total height:
  // barHeight = share * (imageHeight + barHeight).
  const barHeight = Math.max(1, Math.round((imageHeight * share) / (1 - share)));

  return { width, height: imageHeight + barHeight, imageHeight, barHeight };
}

/** Measures a line at a given size. The canvas supplies one; the checks fake one. */
export type Measure = (text: string, fontSize: number) => number;

/**
 * Breaking a caption into lines that fit.
 *
 * Words first; a single word longer than the line is cut, because a meme with a
 * hashtag half off the edge is worse than one with a hyphenless break.
 */
export function wrapLines(text: string, fontSize: number, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = '';

  for (const word of text.trim().split(/\s+/).filter((entry) => entry.length > 0)) {
    const candidate = line.length === 0 ? word : `${line} ${word}`;

    if (measure(candidate, fontSize) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line.length > 0) lines.push(line);

    if (measure(word, fontSize) <= maxWidth) {
      line = word;
      continue;
    }

    // One word wider than the band: cut it where it stops fitting.
    let piece = '';
    for (const letter of word) {
      if (measure(piece + letter, fontSize) > maxWidth && piece.length > 0) {
        lines.push(piece);
        piece = letter;
      } else {
        piece += letter;
      }
    }
    line = piece;
  }

  if (line.length > 0) lines.push(line);
  return lines;
}

export type CaptionFit = { fontSize: number; lines: string[]; lineHeight: number };

/**
 * The largest size at which the caption still fits the band, and how it breaks.
 *
 * It starts from what the band can afford and comes down a step at a time. Text
 * that will not fit even at the floor is allowed to be clipped rather than
 * vanishing: a meme with a squeezed last line is a meme; one with no words is a
 * photograph.
 */
export function fitCaption(
  text: string,
  layout: MemeLayout,
  measure: Measure,
  padding = 0.06
): CaptionFit {
  const maxWidth = layout.width * (1 - padding * 2);
  const maxHeight = layout.barHeight * (1 - padding * 2);

  const ceiling = Math.round(layout.barHeight * 0.52);
  const floor = Math.max(12, Math.round(layout.width * 0.022));

  for (let fontSize = ceiling; fontSize >= floor; fontSize -= 1) {
    const lines = wrapLines(text, fontSize, maxWidth, measure);
    const lineHeight = Math.round(fontSize * 1.18);

    if (lines.length * lineHeight <= maxHeight) return { fontSize, lines, lineHeight };
  }

  return {
    fontSize: floor,
    lines: wrapLines(text, floor, maxWidth, measure),
    lineHeight: Math.round(floor * 1.18)
  };
}

/**
 * The part of the picture the reader chose, in the picture's own pixels.
 *
 * The crop box is dragged over a preview of some other size, so it arrives as
 * fractions of the whole. Clamped here rather than at the edges of the drawing
 * code: a box dragged past the corner should shrink, not read pixels that are
 * not there.
 */
export type CropBox = { x: number; y: number; width: number; height: number };

export function cropInPixels(crop: CropBox, imageWidth: number, imageHeight: number): CropBox {
  const x = Math.max(0, Math.min(1, crop.x));
  const y = Math.max(0, Math.min(1, crop.y));
  const width = Math.max(0.02, Math.min(1 - x, crop.width));
  const height = Math.max(0.02, Math.min(1 - y, crop.height));

  return {
    x: Math.round(x * imageWidth),
    y: Math.round(y * imageHeight),
    width: Math.max(1, Math.round(width * imageWidth)),
    height: Math.max(1, Math.round(height * imageHeight))
  };
}
