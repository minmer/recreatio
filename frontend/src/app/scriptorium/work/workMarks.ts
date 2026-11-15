/**
 * EINGEFÜHRT, BEVOR ES GEBRAUCHT WIRD — das Register der Vorkommen (2026-11-15).
 *
 * Jeder Begriff, jede Idee, Person, jeder Ort hat Vorkommen mit einer Rolle: eingeführt (`intro`), definiert
 * (`def`), Beispiel (`ex`), gebraucht (`use`), wieder aufgenommen (`recall`, in einer Zusammenfassung). Woher sie
 * kommen:
 *   - am Knoten (`marks`) — so geht es, bevor es Prosa gibt;
 *   - im Zapis seines Textes, in Plan und Treść: `[[Anna|@anna|intro]]` (ohne Rolle: gebraucht);
 *   - ohne Link: ein Wort des Textes ist eine Form eines Eintrags (`formsOf`) — gebraucht, aber nur für Einträge,
 *     die irgendwo im Werk ausdrücklich markiert sind (sonst spräche jeder Name, der zufällig passt).
 *
 * Das Register gilt je Weg: dieselben Vorkommen, in der Lesereihenfolge des Weges.
 */

import { ids, refTarget, str, type LibEntry, type Lookup } from '../../library/libraryKinds';
import { parseMarkup, plainText, walkBlocks } from '../../library/libraryMarkup';
import { planOf } from '../sermon';
import { formsOf, type WorkKnowledge } from './workKnowledge';
import { isMarkRole, linear, type MarkRole, type Placed, type WorkLook, type WorkModel, type WorkNode, type WorkPath } from './workModel';

export type Where = 'node' | 'plan' | 'body' | 'implicit';

export interface Occurrence {
  readonly entity: string;
  readonly node: string;
  readonly role: MarkRole;
  readonly where: Where;
  /** Der Punkt des Plans, in dem es steht. */
  readonly point?: string;
  readonly note?: string;
}

export type MarkLook = WorkLook & Pick<Lookup, 'byKey'>;

/** Ein Ziel im Zapis (Kennung oder Schlüssel) als Kennung — oder wie es steht. */
function idOf(look: MarkLook, token: string): string {
  const hit = refTarget(look as Lookup, token);
  return hit?.id ?? token;
}

/** Der Text eines Knotens, wenn es einer ist. */
export function textOf(node: WorkNode, look: WorkLook): LibEntry | undefined {
  const text = node.text === null ? undefined : look.get(node.text);
  return text?.kind === 'text' ? text : undefined;
}

/** Die Vorkommen in einem Zapis — die Links mit oder ohne Rolle. */
function inMarkup(source: string, node: string, where: Where, look: MarkLook, point?: string): Occurrence[] {
  const out: Occurrence[] = [];
  walkBlocks(parseMarkup(source), () => undefined, (i) => {
    if (i.t !== 'ref' || i.key.startsWith('@@')) return;
    out.push({ entity: idOf(look, i.key), node, role: isMarkRole(i.mark) ? i.mark : 'use', where, ...(point === undefined ? {} : { point }) });
  });
  return out;
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ein Muster für die Formen eines Eintrags, als ganze Wörter, ohne Rücksicht auf Gross/klein. */
export function formPattern(forms: readonly string[]): RegExp | null {
  if (forms.length === 0) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${forms.map(escape).sort((a, b) => b.length - a.length).join('|')})(?![\\p{L}\\p{N}])`, 'iu');
}

/** Der lesbare Text eines Knotens (Plan und Treść), für Prüfungen am Wortlaut. */
export function plainOfNode(node: WorkNode, look: WorkLook): string {
  const text = textOf(node, look);
  if (text === undefined) return '';
  return [...planOf(text.data).map((p) => plainText(p.text)), plainText(str(text.data, 'body'))].join('\n');
}

/**
 * ALLE VORKOMMEN DES WERKS — unabhängig vom Weg (der Weg ordnet sie erst im Register). `knowledge`: mit ihr kommen
 * die Vorkommen ohne Link dazu.
 */
export function occurrencesOf(model: WorkModel, look: MarkLook, knowledge?: WorkKnowledge): Occurrence[] {
  const out: Occurrence[] = [];
  const nodes = [...model.nodes.values()];
  for (const node of nodes) {
    for (const m of node.marks) out.push({ entity: idOf(look, m.entry), node: node.id, role: m.role, where: 'node', ...(m.note === undefined ? {} : { note: m.note }) });
    const text = textOf(node, look);
    if (text === undefined) continue;
    for (const p of planOf(text.data)) out.push(...inMarkup(p.text, node.id, 'plan', look, p.id));
    out.push(...inMarkup(str(text.data, 'body'), node.id, 'body', look));
  }
  if (knowledge === undefined) return out;
  /* Ohne Link: nur Einträge, die irgendwo ausdrücklich markiert sind. */
  const marked = new Set(out.map((o) => o.entity));
  const patterns = [...marked].map((id) => knowledge.get(id)).filter((e) => e !== undefined)
    .map((e) => ({ id: e.id, re: formPattern(formsOf(e)) })).filter((p): p is { id: string; re: RegExp } => p.re !== null);
  if (patterns.length === 0) return out;
  const explicitAt = new Set(out.map((o) => `${o.node}\u0000${o.entity}`));
  for (const node of nodes) {
    const plain = plainOfNode(node, look);
    if (plain.trim() === '') continue;
    for (const p of patterns) {
      if (explicitAt.has(`${node.id}\u0000${p.id}`)) continue;
      if (p.re.test(plain)) out.push({ entity: p.id, node: node.id, role: 'use', where: 'implicit' });
    }
  }
  return out;
}

export interface Placement extends Occurrence { readonly pos: number }

export interface EntityRegister {
  readonly entity: string;
  /** In Lesereihenfolge. */
  readonly occ: readonly Placement[];
  readonly firstIntro: number | null;
  readonly roles: Readonly<Record<MarkRole, readonly Placement[]>>;
}

export interface Register {
  readonly path: WorkPath;
  readonly placed: readonly Placed[];
  readonly posOf: ReadonlyMap<string, number>;
  readonly byEntity: ReadonlyMap<string, EntityRegister>;
  /** Die Vorkommen je Knoten (nur auf dem Weg). */
  readonly atNode: ReadonlyMap<string, readonly Placement[]>;
}

/** DAS REGISTER EINES WEGES: jedes Vorkommen an seiner Stelle der Lesereihenfolge. */
export function registerOf(model: WorkModel, path: WorkPath, occurrences: readonly Occurrence[]): Register {
  const placed = linear(model, path);
  const posOf = new Map(placed.map((p) => [p.node.id, p.pos]));
  const order: Readonly<Record<MarkRole, number>> = { intro: 0, def: 1, ex: 2, use: 3, recall: 4 };
  const on = occurrences.filter((o) => posOf.has(o.node)).map((o) => ({ ...o, pos: posOf.get(o.node)! }))
    .sort((a, b) => a.pos - b.pos || order[a.role] - order[b.role]);
  const byEntity = new Map<string, EntityRegister>();
  const atNode = new Map<string, Placement[]>();
  for (const o of on) {
    const was = byEntity.get(o.entity) ?? { entity: o.entity, occ: [], firstIntro: null, roles: { intro: [], def: [], ex: [], use: [], recall: [] } };
    byEntity.set(o.entity, {
      entity: o.entity,
      occ: [...was.occ, o],
      firstIntro: was.firstIntro ?? (o.role === 'intro' ? o.pos : null),
      roles: { ...was.roles, [o.role]: [...was.roles[o.role], o] }
    });
    atNode.set(o.node, [...(atNode.get(o.node) ?? []), o]);
  }
  return { path, placed, posOf, byEntity, atNode };
}

/** Wo ein Eintrag auf ANDEREN Wegen eingeführt wird (für „nur in der Fassung für Erwachsene eingeführt"). */
export function introducedElsewhere(occurrences: readonly Occurrence[], entity: string, register: Register): string[] {
  return [...new Set(occurrences.filter((o) => o.entity === entity && o.role === 'intro' && !register.posOf.has(o.node)).map((o) => o.node))];
}

/** Die Kennungen der Einträge, auf die das Werk zeigt (für das Laden des Wissens). */
export function entitiesOf(occurrences: readonly Occurrence[]): string[] {
  return [...new Set(occurrences.map((o) => o.entity))];
}

/** Die Knoten eines Textes — für den Editor eines Textes, der zu einem Werk gehört. */
export function nodesOfText(look: WorkLook, textId: string): LibEntry[] {
  return look.all().filter((e) => e.kind === 'node' && ids(e.data, 'text').includes(textId));
}
