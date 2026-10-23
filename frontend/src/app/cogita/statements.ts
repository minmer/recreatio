/**
 * AUSSAGEN IN NAUKA (2026-10-23) — jeder Eintrag, dessen Rodzaj ein Feld vom
 * Typ `blocks` hat (Treść w blokach: Absätze, Listen, Tabellen). Eine eigene,
 * eingebaute Art dafür gibt es nicht mehr; der Komentarz ist ein Rodzaj wie
 * jeder andere (`templates/cogita/komentarz.json`: „O czym" und „Treść").
 *
 * <code>
 *   blocksField     das erste Feld \`blocks\` seiner Rodzaje
 *   entityBlocks    seine Bausteine
 *   entityAbout     was seine Verweisfelder nennen, mit Stelle („O czym": Łk 1,35)
 *   statementKinds  die Rodzaje mit einem solchen Feld (für Wähler und Szablony)
 * </code>
 *
 * Teza, Frage und Rolle rechnen `library/blocks.ts` und `library/statement.ts`
 * — dieselben Regeln für Nauka, Skryptorium und Seiten.
 */

import { blocksIn, type CommentBlock } from '../library/blocks';
import { fieldsOf, valuesOf, type Entity, type FieldDef, type KindDef, type Lookup } from './schema';

/** Das erste Feld vom Typ \`blocks\` unter den Rodzajen eines Eintrags. */
export const blocksField = (entity: Entity, look: Pick<Lookup, 'kind'>): FieldDef | undefined =>
  fieldsOf(entity, look).find((f) => f.type === 'blocks');

/** Die Bausteine eines Eintrags — leer, wenn er keine Aussage ist. */
export function entityBlocks(entity: Entity, look: Pick<Lookup, 'kind'>): CommentBlock[] {
  const field = blocksField(entity, look);
  return field === undefined ? [] : blocksIn(entity.data[field.key]);
}

/** Ist dieser Rodzaj ein Rodzaj von Aussagen (hat er ein Feld \`blocks\`)? */
export const isStatementKind = (kind: Pick<KindDef, 'fields'>): boolean => kind.fields.some((f) => f.type === 'blocks');

/** Die Rodzaje mit einem Feld \`blocks\` — ihre Kennungen. */
export const statementKinds = (kinds: readonly KindDef[]): string[] => kinds.filter(isStatementKind).map((k) => k.id);

/** Worüber eine Aussage ist: die Werte ihrer Verweisfelder, mit Stelle. */
export function entityAbout(entity: Entity, look: Pick<Lookup, 'kind'>): { ref: string; locator: string }[] {
  const out: { ref: string; locator: string }[] = [];
  for (const field of fieldsOf(entity, look)) {
    if (field.type !== 'ref') continue;
    for (const v of valuesOf(entity, field)) if (typeof v.value === 'string' && v.value !== '') out.push({ ref: v.value, locator: v.locator ?? '' });
  }
  return out;
}

/**
 * 2026-10-23 — Ein Wähler, der „Aussagen" will (ein Ablauf: „co mówi"; ein
 * Knoten: „wyjaśnienie"), nennt statt fester Arten diesen Platzhalter; er wird
 * zu den Rodzajen mit Feld \`blocks\` der Baza.
 */
export const STATEMENT_KINDS = '@blocks';

/** Die Arten eines Wählers, mit dem Platzhalter aufgelöst. */
export const resolveKinds = (kinds: readonly string[] | undefined, all: readonly KindDef[]): string[] | undefined =>
  kinds === undefined ? undefined : kinds.flatMap((k) => (k === STATEMENT_KINDS ? statementKinds(all) : [k]));
