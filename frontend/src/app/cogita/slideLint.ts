/**
 * 2026-11-05 (Prompt 23, A6) — DER LINT DER FOLIEN IM IMPORT (Vorschau des Imports, neben den Warnungen der Generatoren):
 * in Feldern „blocks“ (Folien, Aussagen) — die alte Schreibweise „Cytat (…):“, eine handgeschriebene Liste „Przypisy“, „kliknij
 * dalej“, ein Zitat-Absatz („> …“) ohne Zeile „> — Autor“; in Fragen — ein Zitierschlüssel [@…] im Text der Frage. Nur
 * Warnungen: gespeichert wird trotzdem. Rein bis auf die Sprache der Baza (`slideLintOf` ist ohne Baza prüfbar).
 */

import type { KindDef } from './schema';
import { baseLang, type Lang } from './lang';
import { slideWords } from './slideWords';
import type { CogitaLibrary } from './store';

interface PlanPart {
  readonly kinds: readonly { readonly id: string; readonly def: KindDef }[];
  readonly entities: readonly { readonly id: string; readonly kinds: readonly string[]; readonly data: Readonly<Record<string, unknown>> }[];
}

const OLD_QUOTE = /\bCytat\s*\([^)\n]*\)\s*:/i;
const NOTES_HEAD = /(^|\n)\s*\**\s*(Przypisy|Fußnoten|Fussnoten|Anmerkungen)\s*\**\s*:?\s*(\n|$)/i;
const CLICK = /\b(klikni(j|jcie)|kliknąć|klicke?|click)\s+(na\s+|auf\s+|on\s+)?[„"«]?\s*(dalej|weiter|next)\b/i;
const CITE = /\[@[^\]\s][^\]]*\]/;

/** Die Texte eines Feldes „blocks“: Absätze, Listen, Tabellen — je Absatz ein Text. */
function blockTexts(v: unknown): string[] {
  if (!Array.isArray(v)) return typeof v === 'string' ? [v] : [];
  const out: string[] = [];
  const cell = (c: unknown): string => (Array.isArray(c) ? c.map((x) => (typeof x === 'object' && x !== null && typeof (x as { text?: unknown }).text === 'string' ? (x as { text: string }).text : '')).join('') : typeof c === 'string' ? c : '');
  for (const b of v) {
    if (typeof b !== 'object' || b === null) continue;
    const o = b as Record<string, unknown>;
    if (typeof o.text === 'string') out.push(o.text);
    if (Array.isArray(o.items)) out.push(o.items.map(cell).join('\n'));
    if (Array.isArray(o.rows)) for (const r of o.rows) if (Array.isArray(r)) out.push(r.map(cell).join(' | '));
  }
  return out;
}

/** Was an einem Text nicht stimmt (Kennungen der Regeln: quote, notes, click, quoteBy). */
export function textProblems(texts: readonly string[]): ('quote' | 'notes' | 'click' | 'quoteBy')[] {
  const out = new Set<'quote' | 'notes' | 'click' | 'quoteBy'>();
  for (const t of texts) {
    if (OLD_QUOTE.test(t)) out.add('quote');
    if (NOTES_HEAD.test(t)) out.add('notes');
    if (CLICK.test(t)) out.add('click');
    const ls = t.split('\n').map((l) => l.trim()).filter((l) => l !== '');
    const quoted = ls.filter((l) => l.startsWith('>'));
    if (quoted.length > 0 && quoted.length >= Math.ceil(ls.length / 2) && !quoted.some((l) => /^>\s*[—–-]\s*\S/.test(l))) out.add('quoteBy');
  }
  return [...out];
}

/** Ein Zitierschlüssel im Text einer Frage? */
export const promptCites = (prompt: unknown): boolean => typeof prompt === 'string' && CITE.test(prompt);

/** DIE WARNUNGEN, ohne Baza: `blocksOf` nennt je Eintrag seine Felder „blocks“; `lang` die Sprache der Worte. */
export function slideLintOf(plan: PlanPart, blocksOf: (kinds: readonly string[]) => readonly string[], lang: Lang): string[] {
  const W = slideWords(lang);
  const out: string[] = [];
  const nameOf = (e: PlanPart['entities'][number]): string => {
    const d = e.data;
    const first = ['tytul', 'title', 'titel', 'nazwa', 'name', 'prompt'].map((k) => d[k]).find((v) => typeof v === 'string' && v.trim() !== '') as string | undefined;
    const s = (first ?? e.id).trim();
    return `„${s.length > 60 ? `${s.slice(0, 59)}…` : s}”`;
  };
  for (const e of plan.entities) {
    if (e.kinds.includes('question')) {
      if (promptCites(e.data.prompt)) out.push(W.lintCitePrompt(nameOf(e)));
      continue;
    }
    const keys = blocksOf(e.kinds);
    if (keys.length === 0) continue;
    const texts = keys.flatMap((k) => blockTexts(e.data[k]));
    for (const p of textProblems(texts)) {
      const who = nameOf(e);
      out.push(p === 'quote' ? W.lintQuoteLabel(who) : p === 'notes' ? W.lintNotes(who) : p === 'click' ? W.lintClick(who) : W.lintQuoteBy(who));
    }
  }
  return out;
}

/** Die Warnungen eines geplanten Imports (die Arten aus dem Dokument oder der Baza). */
export function slideImportWarnings(lib: CogitaLibrary, plan: PlanPart): string[] {
  const blocksOf = (kinds: readonly string[]): string[] => kinds.flatMap((k) => {
    const def = plan.kinds.find((x) => x.id === k)?.def ?? lib.kind(k);
    return (def?.fields ?? []).filter((f) => f.type === 'blocks').map((f) => f.key);
  });
  return slideLintOf(plan, blocksOf, baseLang(lib));
}
