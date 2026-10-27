/**
 * 2026-10-27 — DIE DATEIEN, UM DIE EIN DOKUMENT BITTET, IN DER VORSCHAU.
 *
 * Steht im Dokument `page-image:@schlüssel` (`pageImageNeeds.ts`), gibt es die
 * Datei noch nicht. Die Vorschau zeigt an ihrer Stelle, was der Assistent
 * mitgegeben hat (eine Datei, als `data:`-Adresse) — sonst einen Platzhalter,
 * auf dem steht, was dort hingehört: Name, Beschreibung, Schlüssel. So sieht
 * man auf dem Bild der Seite, wo welches Foto steht und wie es zugeschnitten
 * wird.
 *
 * <b>Ein Platzhalter hat ein Seitenverhältnis</b> (3 : 2, quer) — ein echtes
 * Foto mit einem anderen verändert ein Layout, das sich nach dem Bild richtet.
 * Das sagt der Bericht.
 */

import type { ImageNeed } from '../pages/pageImageNeeds';

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Ein Text in Zeilen von höchstens `width` Zeichen, höchstens `max` Zeilen. */
function wrap(text: string, width: number, max: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter((one) => one !== '');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((`${line} ${word}`).trim().length > width && line !== '') {
      lines.push(line);
      line = word;
      if (lines.length === max) break;
    } else line = `${line} ${word}`.trim();
  }
  if (lines.length < max && line !== '') lines.push(line);
  if (lines.length === max && words.join(' ').length > lines.join(' ').length) lines[max - 1] = `${lines[max - 1].replace(/[.,;:]?$/, '')}…`;
  return lines;
}

const WORD: Record<string, string> = { image: 'ZDJĘCIE', video: 'FILM', sound: 'DŹWIĘK', file: 'PLIK', any: 'PLIK' };

/** Ein Platzhalter als SVG: was hierher gehört. */
export function placeholderUrl(need: Pick<ImageNeed, 'key' | 'label' | 'description' | 'kind'>, w = 1200, h = 800): string {
  const title = wrap(need.label, 28, 2);
  const about = wrap(need.description, 46, 4);
  const lines = [
    ...title.map((one, i) => `<text x="${w / 2}" y="${h * 0.36 + i * 64}" font-size="54" font-weight="700" fill="#1f3a4d">${escape(one)}</text>`),
    ...about.map((one, i) => `<text x="${w / 2}" y="${h * 0.36 + title.length * 64 + 28 + i * 38}" font-size="30" fill="#33566b">${escape(one)}</text>`)
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><pattern id="s" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="40" height="40" fill="#dfe9f0"/><rect width="20" height="40" fill="#d3e1ea"/></pattern></defs>
<rect width="${w}" height="${h}" fill="url(#s)"/>
<rect x="18" y="18" width="${w - 36}" height="${h - 36}" fill="none" stroke="#7a9bb0" stroke-width="4" stroke-dasharray="18 12"/>
<g font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" text-anchor="middle">
<text x="${w / 2}" y="${h * 0.22}" font-size="30" letter-spacing="6" fill="#4f7489">${WORD[need.kind] ?? 'PLIK'} · page-image:@${escape(need.key)}</text>
${lines.join('\n')}
</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Was der Assistent zu einer Bitte mitgegeben hat: eine `data:`-Adresse (oder eine andere, die der Browser öffnen kann). */
export type GivenFiles = Readonly<Record<string, string>>;

/**
 * DIE TAFEL DER VORSCHAU: Kennung der Datei → Adresse — mitgegeben oder
 * Platzhalter. `given` nach Schlüssel der Bitte.
 */
export function previewFileMap(needs: readonly ImageNeed[], ids: ReadonlyMap<string, string>, given: GivenFiles): Map<string, string> {
  const out = new Map<string, string>();
  for (const need of needs) {
    const id = ids.get(need.key);
    if (id === undefined) continue;
    out.set(id, given[need.key] ?? placeholderUrl(need));
  }
  return out;
}
