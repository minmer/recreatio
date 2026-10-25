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

/** 2026-10-25 (Wywód) — ein Verweisfeld, das der Besitzer als Verbindung in einer Struktur erklärt hat (`structure`: `up`/`down`). */
export type StructureLink = 'up' | 'down';

/**
 * Die Verweisfelder seines Rodzaj — ihre Werte mit Stelle (\`{ value, locator }\`, eine Kennung, eine Liste).
 * 2026-10-25 — mit `structure`, wenn das Feld eine Verbindung der Struktur ist (`structure` des Feldes).
 */
export function aboutOf(entry: LibEntry, look: Pick<Lookup, 'get'>): { ref: string; locator: string; field: string; structure?: StructureLink }[] {
  if (entry.kind !== 'entity') return [];
  const out: { ref: string; locator: string; field: string; structure?: StructureLink }[] = [];
  const kinds = Array.isArray(entry.data._kinds) ? entry.data._kinds.filter((k): k is string => typeof k === 'string') : [];
  for (const kindId of kinds) {
    const doc = look.get(kindId);
    if (doc === undefined || doc.kind !== 'kind') continue;
    for (const field of Array.isArray(doc.data.fields) ? doc.data.fields : []) {
      if (!isObject(field) || field.type !== 'ref' || typeof field.key !== 'string') continue;
      const raw = entry.data[field.key];
      const structure: StructureLink | undefined = field.structure === 'up' || field.structure === 'down' ? field.structure : undefined;
      for (const one of Array.isArray(raw) ? raw : [raw]) {
        const value = isObject(one) && 'value' in one ? one.value : one;
        if (typeof value !== 'string' || value === '') continue;
        out.push({ ref: value, locator: isObject(one) && typeof one.locator === 'string' ? one.locator.trim() : '', field: field.key, ...(structure === undefined ? {} : { structure }) });
      }
    }
  }
  return out;
}

/**
 * Worauf eine Aussage zeigt (Kennungen oder Schlüssel): Zellen, Zapis, Verweisfelder. 2026-10-25 —
 * `skip`: ohne die Verbindungen der Struktur in dieser Richtung; `down` für „beantwortet": was eine
 * Aussage in einer Struktur UNTER sich nennt, beantwortet sie nicht.
 */
export function statementTokens(entry: LibEntry, look: Pick<Lookup, 'get'>, skip?: StructureLink): string[] {
  const statement = statementOf(entry, look);
  if (statement === null) return [];
  return [...new Set([
    ...blockRefs(statement.blocks).map((r) => r.ref),
    ...citedKeys(...blockMarkups(statement.blocks)),
    ...aboutOf(entry, look).filter((a) => skip === undefined || a.structure !== skip).map((a) => a.ref)
  ])];
}

/**
 * Die Rolle — gerechnet aus dem, worauf die Aussage zeigt (siehe oben). 2026-10-25 (Wywód): ohne
 * die Verbindungen der Struktur — ein Schritt, der unter seinem Pytanie liegt, bleibt Informacja,
 * solange er sonst nur auf Quellen zeigt.
 */
export function statementRole(entry: LibEntry, look: Lookup): StatementRole {
  const statement = statementOf(entry, look);
  if (statement === null) return 'interpretation';
  const tokens = [...new Set([
    ...blockRefs(statement.blocks).map((r) => r.ref),
    ...citedKeys(...blockMarkups(statement.blocks)),
    ...aboutOf(entry, look).filter((a) => a.structure === undefined).map((a) => a.ref)
  ])];
  const targets = tokens.map((token) => refTarget(look, token)).filter((t): t is LibEntry => t !== undefined && t.id !== entry.id);
  if (targets.some((t) => blocksKeyOf(t, look) !== null)) return 'interpretation';
  return targets.some((t) => SOURCE_KINDS.has(t.kind)) ? 'information' : 'interpretation';
}

/**
 * Die lesbaren Aussagen, die auf diese zeigen — eine Frage ist beantwortet, sobald es eine gibt.
 * 2026-10-25 (Wywód): eine Aussage, die diese nur in einer Struktur unter sich nennt (`down`), zählt
 * nicht; die Aussagen, die diese selbst unter sich nennt, zählen.
 */
export function answersTo(entry: LibEntry, look: Lookup): LibEntry[] {
  const below = aboutOf(entry, look).filter((a) => a.structure === 'down').map((a) => refTarget(look, a.ref))
    .filter((t): t is LibEntry => t !== undefined && t.id !== entry.id && blocksKeyOf(t, look) !== null);
  const pointing = (look.readable?.() ?? []).filter((e) => e.id !== entry.id && blocksKeyOf(e, look) !== null
    && statementTokens(e, look, 'down').some((token) => refTarget(look, token)?.id === entry.id));
  return [...new Map([...below, ...pointing].map((e) => [e.id, e])).values()];
}

/**
 * 2026-10-25 — IST DIESE FRAGE BEANTWORTET? Wer die Antwort schon gerechnet hat (eine Baza wiedzy
 * für alle ihre Einträge auf einmal: `Lookup.answered`), sagt es; sonst wie bisher über `answersTo`.
 */
export function isAnswered(entry: LibEntry, look: Lookup): boolean {
  const known = look.answered?.(entry.id);
  return known ?? answersTo(entry, look).length > 0;
}

/** Worüber eine Aussage ist — „Łk 1,35; Dz 1,8" (ihre Verweisfelder mit Stelle; ohne die Verbindungen einer Struktur). */
export function aboutLine(entry: LibEntry, look: Lookup): string {
  return aboutOf(entry, look).filter((a) => a.structure === undefined).map((a) => refLabel(a.ref, a.locator, look)).join('; ');
}
