/**
 * 2026-11-09 — DIE FARBEN DER LINIEN (Entscheidung 5): eine eigene Palette, getrennt von den Farben der Säulen (die behalten
 * die Farbe ihres Themas, §4.2). Dunkler und gesättigter als die Säulen, damit eine Linie auf jeder Säule und auf dem Boden
 * lesbar bleibt — im hellen und im dunklen Bild. Jede grosse Linie hat ihren eigenen Farbton (goldener Winkel, in fester
 * Reihenfolge); eine Vertiefung nimmt eine hellere Abstufung der Linie, die sie am häufigsten ruft.
 * Rein (OKLCH → sRGB hier gerechnet, damit Canvas und Prüfung dieselben Werte haben).
 */

import type { Lines } from './wmTypes';

export type Rgb = readonly [number, number, number];

/** OKLCH (L 0–1, C, h in Grad) → sRGB 0–255, in den Farbraum geklemmt (die Sättigung sinkt, bis es passt). */
export function oklch(L: number, C: number, h: number): Rgb {
  for (let c = C; c >= 0; c -= 0.005) {
    const a = c * Math.cos((h * Math.PI) / 180);
    const b = c * Math.sin((h * Math.PI) / 180);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ];
    if (lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4)) {
      const enc = (v: number) => { const x = Math.max(0, Math.min(1, v)); return Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255); };
      return [enc(lin[0]), enc(lin[1]), enc(lin[2])];
    }
  }
  const g = Math.round(Math.max(0, Math.min(1, L)) * 255);
  return [g, g, g];
}

/** Relative Leuchtdichte (WCAG). */
export function luminance(c: Rgb): number {
  const ch = (v: number) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
}

/** Kontrast zweier Farben (1–21). */
export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rgbCss = (c: Rgb): string => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

/** Hell und dunkel: die Helligkeit und Sättigung der Linien — und ihrer Vertiefungen. */
const TONE = {
  light: { L: 0.46, C: 0.19, deepL: 0.62, deepC: 0.14 },
  dark: { L: 0.80, C: 0.15, deepL: 0.90, deepC: 0.09 }
} as const;

export interface LineColour {
  readonly hue: number;
  readonly color: Rgb;
  readonly deep: boolean;
}

/**
 * DIE FARBE JEDER LINIE: grosse Linien in fester Reihenfolge (die längsten zuerst, dann nach Kennung) je ein Farbton im
 * goldenen Winkel; eine Vertiefung den Farbton der Linie, die sie am häufigsten ruft, heller.
 */
export function lineColours(lines: Lines, theme: 'light' | 'dark'): Map<string, LineColour> {
  const tone = TONE[theme];
  const big = [...lines.lines.values()].filter((l) => !l.deepening)
    .sort((a, b) => b.sections.length - a.sections.length || (a.id < b.id ? -1 : 1));
  const hues = new Map<string, number>();
  big.forEach((l, i) => hues.set(l.id, (28 + i * 137.508) % 360));
  const out = new Map<string, LineColour>();
  for (const l of big) out.set(l.id, { hue: hues.get(l.id)!, color: oklch(tone.L, tone.C, hues.get(l.id)!), deep: false });
  const deep = [...lines.lines.values()].filter((l) => l.deepening).sort((a, b) => (a.id < b.id ? -1 : 1));
  deep.forEach((l, i) => {
    const caller = [...l.calledBy.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([id]) => id).find((id) => hues.has(id));
    const hue = caller === undefined ? (200 + i * 137.508) % 360 : hues.get(caller)!;
    out.set(l.id, { hue, color: oklch(tone.deepL, tone.deepC, hue), deep: true });
  });
  return out;
}
