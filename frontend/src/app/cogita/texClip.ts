/**
 * 2026-11-01 — EIN NAME MIT WZORY, GEKÜRZT: Listen kürzen lange Etiketten (`.slice(0, 120)`); ein Schnitt mitten in
 * einem Wzór liesse ein einzelnes `$` stehen und den Rest als LaTeX. Hier wird nur im Text geschnitten — ein Wzór
 * bleibt ganz oder fällt ganz weg — und ein Dollar im Text bleibt `\$` (so liest ihn `TexText`).
 */

import { texPieces, texSource } from '../core/tex';

/** Höchstens `max` Zeichen (ein Wzór zählt mit seinem LaTeX), mit „…" am Ende, wenn gekürzt wurde. */
export function clipTex(text: string, max: number): string {
  if (text.length <= max) return text;
  if (!text.includes('$')) return text.slice(0, max);
  let out = '';
  let used = 0;
  for (const p of texPieces(text)) {
    if (p.t === 'math') {
      const source = texSource(p.tex, false);
      if (used + source.length > max) return `${out.trimEnd()}…`;
      out += source;
      used += source.length;
      continue;
    }
    const room = max - used;
    if (p.v.length > room) return `${out}${p.v.slice(0, Math.max(0, room)).split('$').join('\\$')}…`;
    out += p.v.split('$').join('\\$');
    used += p.v.length;
  }
  return out;
}
