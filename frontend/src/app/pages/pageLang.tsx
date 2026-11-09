/**
 * 2026-11-05 — DIE SPRACHE EINER SEITE UND EINES BAUSTEINS (LOCALIZATION.md, Stufe 3).
 *
 * Die Seite trägt sie in ihrem Aussehen (`look.lang`, page_theme), der Baustein in seiner Anordnung
 * (`layout.lang`). Fehlt sie, gilt die darüber — und dann steht hier KEIN zusätzlicher Rahmen im DOM:
 * und auch mit eigener Sprache nicht (`bare`): Regeln mit `>` (`.wk-card > .wk-card-title`, `.wk-deck-actor > .wk-deck-card`)
 * griffen sonst ins Leere.
 */

import type { ReactNode } from 'react';

import { LangScope, type Lang } from '../core/i18n';

export function InLang({ lang, children }: { lang: Lang | null | undefined; children: ReactNode }) {
  return lang == null ? <>{children}</> : <LangScope lang={lang} bare>{children}</LangScope>;
}

export default InLang;
