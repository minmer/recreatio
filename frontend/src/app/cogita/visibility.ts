/**
 * WER EINE BAZA WIEDZY LIEST (2026-10-22, Schritt 8, Entscheidung 3) — die
 * Worte und die Rechnung hinter „Kto widzi" (`BaseWho.tsx`), ohne Oberfläche.
 *
 * Eine Baza folgt ihrem Bereich: Mitglieder lesen sie; ist er jawny und die
 * Baza geöffnet (\`area_rule_at\`), liest sie jeder — als GANZE, mit den
 * Antworten der Fragen und den Entwürfen. Einzelnes Veröffentlichen gibt es
 * nicht mehr: was öffentlich sein soll, zieht in eine öffentliche Baza.
 */

import type { OpenLibrary } from '../library/library';
import { labelOf } from './schema';
import { t } from '../core/i18n';
import type { CogitaLibrary } from './store';

/** Was eine öffentliche Baza zeigt — in jedem Satz, der davon spricht, dasselbe. */
export const wholeBase = (): string => t('cogitaData.visibility.wholeBase');

type Visible = Pick<OpenLibrary, 'areaPublic' | 'areaRuleAt'>;

/** Liest jeder diese Baza (ein jawny obszar, und sie ist geöffnet)? */
export const isPublicBase = (row: Visible | undefined): boolean => row?.areaPublic === true && row.areaRuleAt != null;

/** Wer eine Baza wiedzy liest — in Worten. */
export function audience(row: Visible | undefined): string {
  if (row?.areaPublic !== true) return t('cogitaData.visibility.members');
  if (row.areaRuleAt == null) return t('cogitaData.visibility.membersNotOpen');
  return t('cogitaData.visibility.everyone', { whole: wholeBase() });
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Was ein Eintrag aus DIESER Baza braucht — seine Art, Vorlagen, Einträge, auf
 * die er zeigt, und deren —, Stufe um Stufe, höchstens `cap`. Was aus einer
 * Quelle kommt, bleibt, wo es ist; die Einstellungen ziehen nie mit.
 */
export function needsOf(lib: { readonly store: { get(id: string): { readonly kind: string; readonly data: unknown } | undefined } }, id: string, cap = 300): string[] {
  const seen = new Set([id.toLowerCase()]);
  const queue = [id];
  const out: string[] = [];
  while (queue.length > 0 && out.length < cap) {
    const entry = lib.store.get(queue.shift()!);
    if (entry === undefined) continue;
    for (const ref of JSON.stringify(entry.data ?? null).match(UUID) ?? []) {
      const other = ref.toLowerCase();
      if (seen.has(other)) continue;
      seen.add(other);
      const found = lib.store.get(other);
      if (found === undefined || found.kind === 'settings') continue;
      out.push(other);
      queue.push(other);
      if (out.length >= cap) break;
    }
  }
  return out;
}

const KIND_WORDS: ReadonlySet<string> = new Set(['kind', 'template', 'revision', 'flow', 'collection', 'addform', 'rules', 'values', 'look', 'view', 'reward']);

/** Wie ein Eintrag der Baza im Plan heisst — ein Eintrag mit seinem Etikett, ein Dokument mit Art und Namen. */
export function nameIn(lib: CogitaLibrary, id: string): string {
  const entity = lib.entity(id);
  if (entity !== undefined) return labelOf(entity, lib.look);
  const entry = lib.store.get(id);
  const named = typeof entry?.data.name === 'string' && entry.data.name.trim() !== '' ? entry.data.name : null;
  const word = KIND_WORDS.has(entry?.kind ?? '') ? t(`cogitaData.visibility.kind.${entry!.kind}`) : t('cogitaData.visibility.kind.entry');
  return named === null ? word : `${word}: ${named}`;
}
