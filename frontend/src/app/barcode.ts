/**
 * STRICHCODES LESEN — die ISBN auf dem Buchrücken, eine eigene Nummer auf
 * einem Etikett.
 *
 * <b>Erst, was der Browser kann:</b> `BarcodeDetector` (Chrome auf Android,
 * macOS, ChromeOS) liest schnell und gut. Wo es ihn nicht gibt (Windows,
 * Firefox, Safari, manche WebView), liest ZXing — erst beim ersten Scannen
 * geladen, damit niemand, der nie scannt, es herunterlädt.
 *
 * Gelesen werden nur Strichcodes in einer Zeile (EAN, UPC, Code 128/39):
 * mehr braucht ein Buch nicht, und jedes weitere Format macht ZXing grösser.
 */

import type { DecodeHintType } from '@zxing/library';

interface NativeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]>;
}

interface NativeDetectorClass {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats(): Promise<string[]>;
}

const WANTED = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

let native: Promise<NativeDetector | null> | null = null;

function nativeDetector(): Promise<NativeDetector | null> {
  native ??= (async () => {
    const Detector = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
    if (Detector === undefined) return null;
    try {
      const supported = await Detector.getSupportedFormats();
      const formats = WANTED.filter((f) => supported.includes(f));
      return formats.includes('ean_13') ? new Detector({ formats }) : null;
    } catch {
      return null;
    }
  })();
  return native;
}

/** Grauwerte eines Bildes, ein Byte je Punkt — was ZXing liest. */
export function grayOf(rgba: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; j < out.length; i += 4, j += 1) out[j] = (rgba[i]! * 299 + rgba[i + 1]! * 587 + rgba[i + 2]! * 114) / 1000;
  return out;
}

/**
 * ZXing über Grauwerte. `hard`: gründlicher (auch gedreht) — für ein Foto,
 * nicht für jedes Bild eines Videos.
 */
export async function decodeGray(gray: Uint8ClampedArray, width: number, height: number, hard: boolean): Promise<string | null> {
  const zx = await import('@zxing/library');
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(zx.DecodeHintType.POSSIBLE_FORMATS, [
    zx.BarcodeFormat.EAN_13, zx.BarcodeFormat.EAN_8, zx.BarcodeFormat.UPC_A, zx.BarcodeFormat.UPC_E,
    zx.BarcodeFormat.CODE_128, zx.BarcodeFormat.CODE_39
  ]);
  if (hard) hints.set(zx.DecodeHintType.TRY_HARDER, true);
  const reader = new zx.MultiFormatOneDReader(hints);
  for (const how of hard ? ['hybrid', 'global'] : ['global']) {
    try {
      const source = new zx.RGBLuminanceSource(gray, width, height);
      const binarizer = how === 'hybrid' ? new zx.HybridBinarizer(source) : new zx.GlobalHistogramBinarizer(source);
      return reader.decode(new zx.BinaryBitmap(binarizer), hints).getText();
    } catch {
      /* Nichts gefunden — der nächste Versuch, oder nichts. */
    }
  }
  return null;
}

let canvas: HTMLCanvasElement | null = null;

/** Ein Bild (oder ein Ausschnitt eines Videos) als Grauwerte, höchstens `maxWidth` breit. */
function grab(source: CanvasImageSource, width: number, height: number, maxWidth: number, band: boolean): { gray: Uint8ClampedArray; width: number; height: number } | null {
  if (width === 0 || height === 0) return null;
  canvas ??= document.createElement('canvas');
  const scale = Math.min(1, maxWidth / width);
  /* Im Video nur das Band in der Mitte — dort hält man den Code hin, und es rechnet sich schneller. */
  const top = band ? Math.round(height * 0.25) : 0;
  const tall = band ? Math.round(height * 0.5) : height;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(tall * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) return null;
  ctx.drawImage(source, 0, top, width, tall, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { gray: grayOf(image.data, canvas.width, canvas.height), width: canvas.width, height: canvas.height };
}

/** Ein Bild aus dem laufenden Video — schnell, oft hintereinander. */
export async function readFrame(video: HTMLVideoElement): Promise<string | null> {
  if (video.readyState < 2) return null;
  const detector = await nativeDetector();
  if (detector !== null) {
    try {
      const found = await detector.detect(video);
      return found[0]?.rawValue ?? null;
    } catch {
      return null;
    }
  }
  const frame = grab(video, video.videoWidth, video.videoHeight, 960, true);
  return frame === null ? null : decodeGray(frame.gray, frame.width, frame.height, false);
}

/** Ein Foto des Codes — gründlich. */
export async function readPhoto(file: Blob): Promise<string | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
  try {
    const detector = await nativeDetector();
    if (detector !== null) {
      const found = await detector.detect(bitmap).catch(() => []);
      if (found[0] !== undefined) return found[0].rawValue;
    }
    for (const maxWidth of [1600, 900]) {
      const frame = grab(bitmap, bitmap.width, bitmap.height, maxWidth, false);
      const code = frame === null ? null : await decodeGray(frame.gray, frame.width, frame.height, true);
      if (code !== null) return code;
    }
    return null;
  } finally {
    bitmap.close();
  }
}
