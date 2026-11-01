/**
 * 2026-11-01 — KaTeX MIT SEINEM AUSSEHEN: was `Tex.tsx` nachlädt, sobald ein Wzór zu sehen ist. Die Schriften
 * kommen nur als woff2 mit (`vite.config.ts`, „katex-woff2") — jeder Browser, der die App trägt, liest sie.
 */

import 'katex/dist/katex.min.css';

export { checkTex, renderTex } from './katexCore';
