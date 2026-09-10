/**
 * Shrinking a photograph in the browser, before it is sent.
 *
 * A phone in 2026 takes a 12-megapixel picture and writes four to eight
 * megabytes per shutter press. Sending that over a rural mobile connection at a
 * pilgrimage stop takes a minute per photo, fails half the time, and buys
 * nothing: the picture is looked at on a phone screen, which is at most a couple
 * of thousand pixels across even on a good day.
 *
 * So the long edge comes down to 2048px and the result is re-encoded. That is
 * comfortably above what any current phone or laptop displays — a 2048px picture
 * still has room to be looked at closely on a retina screen — and it lands at a
 * few hundred kilobytes rather than several megabytes. Uploads that used to fail
 * finish in a second or two.
 *
 * Re-encoding through a canvas has a second effect worth naming: the EXIF block
 * does not survive it. Nobody who sends a photograph of a bike stop means to
 * publish the coordinates of where they were standing, and this drops them
 * without anybody having to think about it. Orientation is the one EXIF field
 * that must survive, so it is applied to the pixels themselves before the tag is
 * lost — otherwise every photo taken in portrait would appear on its side.
 */

/** The long edge nothing needs to exceed for a picture that is looked at, not printed. */
export const MAX_EDGE = 2048;

/** Enough that the difference cannot be seen; small enough to be worth sending. */
export const QUALITY = 0.82;

/**
 * The size a picture should be shrunk to.
 *
 * Only ever downwards: enlarging a small photograph would spend bytes inventing
 * pixels that were never taken.
 */
export function targetSize(
  width: number,
  height: number,
  maxEdge = MAX_EDGE
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) return { width, height };

  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

/** WEBP where the browser can write it, JPEG otherwise. Both are ~30% of a PNG here. */
function bestType(): string {
  try {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    return probe.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
  } catch {
    return 'image/jpeg';
  }
}

export type Downscaled = { blob: Blob; width: number; height: number; fileName: string };

/**
 * One picture, ready to send. Anything that goes wrong — an unreadable file, a
 * browser without `createImageBitmap`, a canvas that refuses — falls back to the
 * original bytes rather than losing the photograph: the server's own cap is what
 * ultimately protects it, and a slow upload beats a lost one.
 */
export async function downscaleImage(file: File, maxEdge = MAX_EDGE): Promise<Downscaled> {
  const original: Downscaled = { blob: file, width: 0, height: 0, fileName: file.name };

  if (typeof createImageBitmap !== 'function') return original;

  let bitmap: ImageBitmap;
  try {
    // from-image: the rotation lives in EXIF, which this re-encode drops. Baking
    // it into the pixels first is what keeps portrait photographs upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return original;
  }

  try {
    const size = targetSize(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext('2d');
    if (context === null) return original;

    context.drawImage(bitmap, 0, 0, size.width, size.height);

    const type = bestType();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));
    if (blob === null) return original;

    // A picture that grew is one the original already stored better — keep it.
    if (blob.size >= file.size && size.width === bitmap.width) return { ...original, ...size };

    const stem = file.name.replace(/\.[^.]+$/, '') || 'zdjecie';
    return {
      blob,
      width: size.width,
      height: size.height,
      fileName: `${stem}.${type === 'image/webp' ? 'webp' : 'jpg'}`
    };
  } finally {
    bitmap.close();
  }
}
