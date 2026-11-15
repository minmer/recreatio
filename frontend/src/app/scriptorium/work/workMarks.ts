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

import { ids, refTarget, str, wordCount, type LibEntry, type Lookup } from '../../library/libraryKinds';
import { parseMarkup, plainText, walkBlocks, walkInline, type Block, type Inline } from '../../library/libraryMarkup';
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
  /**
   * 2026-11-15 — DAS AKAPIT (Absatz des Textes, 0, 1, 2 …), in dem es steht (`unitsOf`). Fehlt es, gilt das Vorkommen
   * für den ganzen Knoten (eine Marke am Knoten, ein Punkt des Plans neben einer Treść) — es steht an seinem Anfang.
   */
  readonly para?: number;
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

/** Die Vorkommen in einem Zapis (oder in schon gelesenen Blöcken) — die Links mit oder ohne Rolle. */
function inMarkup(source: string | readonly Block[], node: string, where: Where, look: MarkLook, point?: string, para?: number): Occurrence[] {
  const out: Occurrence[] = [];
  walkBlocks(typeof source === 'string' ? parseMarkup(source) : source, () => undefined, (i) => {
    if (i.t !== 'ref' || i.key.startsWith('@@')) return;
    out.push({ entity: idOf(look, i.key), node, role: isMarkRole(i.mark) ? i.mark : 'use', where, ...(point === undefined ? {} : { point }), ...(para === undefined ? {} : { para }) });
  });
  return out;
}

/* -- 2026-11-15: Akapity ------------------------------------------------------------------------------ */

export type UnitKind = 'p' | 'h' | 'quote' | 'list' | 'embed' | 'point';

/** Ein Akapit eines Textes: ein Block der Treść — oder, solange es keine Treść gibt, ein Punkt des Plans. */
export interface TextUnit {
  readonly index: number;
  readonly kind: UnitKind;
  /** Was man liest, ohne Zeichen. */
  readonly plain: string;
  readonly words: number;
  readonly blocks: readonly Block[];
  /** Bei einem Punkt des Plans: seine Kennung. */
  readonly point?: string;
}

const kindOfBlock = (b: Block): UnitKind => (b.t === 'h' ? 'h' : b.t === 'quote' || b.t === 'details' ? 'quote' : b.t === 'list' ? 'list' : b.t === 'embed' ? 'embed' : 'p');

/**
 * DIE AKAPITY EINES KNOTENS in ihrer Reihenfolge: jeder Block der Treść (Absatz, Überschrift, Zitat, Liste) ist eines;
 * ohne Treść die Punkte des Plans (so ist auch ein Text, der erst geplant ist, schon gegliedert).
 */
export function unitsOf(node: WorkNode, look: WorkLook): TextUnit[] {
  const text = textOf(node, look);
  if (text === undefined) return [];
  const body = str(text.data, 'body');
  if (body.trim() !== '') {
    return parseMarkup(body).map((b, index) => {
      const plain = blockPlain(b);
      return { index, kind: kindOfBlock(b), plain, words: wordCount(plain), blocks: [b] };
    });
  }
  return planOf(text.data).map((p, index) => {
    const plain = plainText(p.text);
    return { index, kind: 'point' as const, plain, words: wordCount(plain), blocks: parseMarkup(p.text), point: p.id };
  });
}

/** Der lesbare Text eines Blocks. */
function blockPlain(b: Block): string {
  const parts: string[] = [];
  const inline = (list: readonly Inline[]) => walkInline(list, (i) => { if (i.t === 'text') parts.push(i.v); else if (i.t === 'br') parts.push(' '); });
  switch (b.t) {
    case 'p': case 'h': inline(b.c); break;
    case 'list': for (const item of b.items) { inline(item); parts.push(' '); } break;
    case 'quote': for (const one of b.c) parts.push(blockPlain(one), ' '); break;
    case 'details': inline(b.summary); parts.push(' '); for (const one of b.c) parts.push(blockPlain(one), ' '); break;
    default:
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
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
    const units = unitsOf(node, look);
    const hasBody = units.some((u) => u.kind !== 'point');
    /* Der Plan neben einer Treść ist ein Gerüst: er gilt für den ganzen Knoten. Ohne Treść ist er der Text — Punkt für Punkt. */
    if (hasBody) for (const p of planOf(text.data)) out.push(...inMarkup(p.text, node.id, 'plan', look, p.id));
    for (const u of units) out.push(...inMarkup(u.blocks, node.id, hasBody ? 'body' : 'plan', look, u.point, u.index));
  }
  if (knowledge === undefined) return out;
  /* Ohne Link: nur Einträge, die irgendwo ausdrücklich markiert sind. */
  const marked = new Set(out.map((o) => o.entity));
  const patterns = [...marked].map((id) => knowledge.get(id)).filter((e) => e !== undefined)
    .map((e) => ({ id: e.id, re: formPattern(formsOf(e)) })).filter((p): p is { id: string; re: RegExp } => p.re !== null);
  if (patterns.length === 0) return out;
  /* 2026-11-15 — je Akapit: ein Wort ohne Link in einem Akapit, in dem der Eintrag schon verlinkt ist, zählt nicht doppelt. */
  const explicitPara = new Set(out.filter((o) => o.para !== undefined).map((o) => `${o.node}\u0000${o.para}\u0000${o.entity}`));
  for (const node of nodes) {
    for (const u of unitsOf(node, look)) {
      if (u.plain === '') continue;
      for (const p of patterns) {
        if (explicitPara.has(`${node.id}\u0000${u.index}\u0000${p.id}`)) continue;
        if (p.re.test(u.plain)) out.push({ entity: p.id, node: node.id, role: 'use', where: 'implicit', para: u.index });
      }
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
  /** 2026-11-15 — die erste Einführung selbst (mit ihrem Akapit). */
  readonly first: Placement | null;
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
  /* In Lesereihenfolge: Knoten, dann Akapit (was für den ganzen Knoten gilt, steht an seinem Anfang), dann Rolle. */
  const on = occurrences.filter((o) => posOf.has(o.node)).map((o) => ({ ...o, pos: posOf.get(o.node)! }))
    .sort((a, b) => a.pos - b.pos || (a.para ?? -1) - (b.para ?? -1) || order[a.role] - order[b.role]);
  type Mutable = { entity: string; occ: Placement[]; firstIntro: number | null; first: Placement | null; roles: Record<MarkRole, Placement[]> };
  const byEntity = new Map<string, Mutable>();
  const atNode = new Map<string, Placement[]>();
  for (const o of on) {
    let was = byEntity.get(o.entity);
    if (was === undefined) { was = { entity: o.entity, occ: [], firstIntro: null, first: null, roles: { intro: [], def: [], ex: [], use: [], recall: [] } }; byEntity.set(o.entity, was); }
    was.occ.push(o);
    was.roles[o.role].push(o);
    if (was.first === null && o.role === 'intro') { was.first = o; was.firstIntro = o.pos; }
    const list = atNode.get(o.node);
    if (list === undefined) atNode.set(o.node, [o]); else list.push(o);
  }
  return { path, placed, posOf, byEntity, atNode };
}

/**
 * 2026-11-15 — STEHT DIESES VORKOMMEN VOR DER EINFÜHRUNG? Ein früherer Knoten ja; im selben Knoten entscheidet das
 * Akapit — innerhalb eines Akapit gilt die Einführung für das ganze Akapit (der Satz, der ein Wort einführt, gebraucht
 * es oft selbst). Was für den ganzen Knoten gilt (eine Marke am Knoten, der Plan neben der Treść), ist im eigenen Knoten
 * nie „zu früh".
 */
export function beforeIntro(o: Pick<Placement, 'pos' | 'para'>, first: Pick<Placement, 'pos' | 'para'> | null): boolean {
  if (first === null) return true;
  if (o.pos !== first.pos) return o.pos < first.pos;
  return o.para !== undefined && first.para !== undefined && o.para < first.para;
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
