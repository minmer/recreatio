/**
 * 2026-11-05 — DIE SPRACHE EINER SEITE UND EINES BAUSTEINS (LOCALIZATION.md, Stufe 3).
 *
 * Die Seite trägt sie in ihrem Aussehen (`look.lang`, page_theme), der Baustein in seiner Anordnung
 * (`layout.lang`). Fehlt sie, gilt die darüber — und dann steht hier KEIN zusätzlicher Rahmen im DOM:
 * `LangScope` zeichnet ein `<div style="display: contents">`, und Regeln mit `>` (`.wk-card > .wk-card-title`)
 * griffen sonst auf jeder Seite ins Leere.
 */

import type { ReactNode } from 'react';

import { LangScope, type Lang } from '../core/i18n';

export function InLang({ lang, children }: { lang: Lang | null | undefined; children: ReactNode }) {
  return lang == null ? <>{children}</> : <LangScope lang={lang}>{children}</LangScope>;
}

export default InLang;
