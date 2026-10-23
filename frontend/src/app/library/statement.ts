/**
 * DIE AUSSAGE, GERECHNET (2026-10-23) — für JEDEN Eintrag, dessen Rodzaj ein
 * Feld `blocks` hat (`blocks.ts`): seine Teza, ob er eine Frage ist und ob sie
 * beantwortet ist, und ob er eine Informacja oder eine Interpretacja ist.
 * Gespeichert wird davon nichts; gerechnet wird aus dem, worauf er zeigt.
 *
 * <code>
 *   worauf er zeigt   die Verweise in seinen Zellen, die Verweise im Zapis seiner
 *                     Absätze und die Werte seiner Verweisfelder (z. B. „O czym",
 *                     mit Stelle) — soweit dieser Leser sie lesen kann
 *   Interpretacja     er zeigt auf eine andere Aussage — oder auf keine Quelle
 *   Informacja        er zeigt auf Quellen der Bibliothek (Werk, Zitat, Person)
 *                     und auf keine andere Aussage
 *   beantwortet       eine andere lesbare Aussage zeigt auf diese Frage
 * </code>
 *
 * Ob der Eintrag selbst eine Tabelle hat, zählt nicht (2026-10-23: „eine
 * Tabelle macht eine Deutung" gibt es nicht mehr).
 */

import { blockMarkups, blockRefs, blocksKeyOf, blocksOf, isQuestion, thesisOf, thesisProblem, type CommentBlock } from './blocks';
import { citedKeys } from './libraryMarkup';
import { refLabel } from './libraryCite';
import { refTarget, SOURCE_KINDS, type LibEntry, type Lookup } from './libraryKinds';

export interface Statement {
  /** Der Schlüssel seines Feldes `blocks`. */
  readonly key: string;
  readonly blocks: readonly CommentBlock[];
  readonly thesis: string;
  readonly question: boolean;
  readonly problem: 'missing' | 'long' | null;
}

export type StatementRole = 'information' | 'interpretation';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Die Aussage eines Eintrags — \`null\`, wenn sein Rodzaj kein Feld \`blocks\` hat. */
export function statementOf(entry: LibEntry, look: Pick<Lookup, 'get'>): Statement | null {
  const key = blocksKeyOf(entry, look);
  if (key === null) return null;
  const blocks = blocksOf(entry.data, key);
  return { key, blocks, thesis: thesisOf(blocks), question: isQuestion(blocks), problem: thesisProblem(blocks) };
}

/** Die Verweisfelder seines Rodzaj — ihre Werte mit Stelle (\`{ value, locator }\`, eine Kennung, eine Liste). */
export function aboutOf(entry: LibEntry, look: Pick<Lookup, 'get'>): { ref: string; locator: string; field: string }[] {
  if (entry.kind !== 'entity') return [];
  const out: { ref: string; locator: string; field: string }[] = [];
  const kinds = Array.isArray(entry.data._kinds) ? entry.data._kinds.filter((k): k is string => typeof k === 'string') : [];
  for (const kindId of kinds) {
    const doc = look.get(kindId);
    if (doc === undefined || doc.kind !== 'kind') continue;
    for (const field of Array.isArray(doc.data.fields) ? doc.data.fields : []) {
      if (!isObject(field) || field.type !== 'ref' || typeof field.key !== 'string') continue;
      const raw = entry.data[field.key];
      for (const one of Array.isArray(raw) ? raw : [raw]) {
        const value = isObject(one) && 'value' in one ? one.value : one;
        if (typeof value !== 'string' || value === '') continue;
        out.push({ ref: value, locator: isObject(one) && typeof one.locator === 'string' ? one.locator.trim() : '', field: field.key });
      }
    }
  }
  return out;
}

/** Worauf eine Aussage zeigt (Kennungen oder Schlüssel): Zellen, Zapis, Verweisfelder. */
export function statementTokens(entry: LibEntry, look: Pick<Lookup, 'get'>): string[] {
  const statement = statementOf(entry, look);
  if (statement === null) return [];
  return [...new Set([
    ...blockRefs(statement.blocks).map((r) => r.ref),
    ...citedKeys(...blockMarkups(statement.blocks)),
    ...aboutOf(entry, look).map((a) => a.ref)
  ])];
}

/** Die Rolle — gerechnet aus dem, worauf die Aussage zeigt (siehe oben). */
export function statementRole(entry: LibEntry, look: Lookup): StatementRole {
  const targets = statementTokens(entry, look).map((token) => refTarget(look, token)).filter((t): t is LibEntry => t !== undefined && t.id !== entry.id);
  if (targets.some((t) => blocksKeyOf(t, look) !== null)) return 'interpretation';
  return targets.some((t) => SOURCE_KINDS.has(t.kind)) ? 'information' : 'interpretation';
}

/** Die lesbaren Aussagen, die auf diese zeigen — eine Frage ist beantwortet, sobald es eine gibt. */
export function answersTo(entry: LibEntry, look: Lookup): LibEntry[] {
  return (look.readable?.() ?? []).filter((e) => e.id !== entry.id && blocksKeyOf(e, look) !== null
    && statementTokens(e, look).some((token) => refTarget(look, token)?.id === entry.id));
}

/** Worüber eine Aussage ist — „Łk 1,35; Dz 1,8" (ihre Verweisfelder mit Stelle). */
export function aboutLine(entry: LibEntry, look: Lookup): string {
  return aboutOf(entry, look).map((a) => refLabel(a.ref, a.locator, look)).join('; ');
}
