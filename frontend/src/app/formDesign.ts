/**
 * Der AUFBAU und die LOGIK eines Formulars (0043).
 *
 * <b>Ein Dokument, zwei Hälften.</b>
 *
 * <code>
 *   layout   ein Baum: Fragen, Texte, Gruppen — und Gruppen sind entweder
 *            „group" (eine Überschrift über mehreren Fragen),
 *            „page"  (nacheinander — die nächste erst, wenn die vorige erfüllt ist) oder
 *            „tab"   (nebeneinander — alle zugleich erreichbar),
 *            und sie liegen ineinander, so tief man will
 *   logic    ein Graph: Eingänge (die Antwort auf eine Frage, ein fester Wert),
 *            Vergleiche und Verknüpfungen (und, oder, nicht, entweder-oder),
 *            Ausgänge (zeigen, Hinweis unter der Frage, Name der Frage, Pflicht)
 * </code>
 *
 * <b>Nicht jede Frage muss dabei sein.</b> Eine Frage, die im Aufbau fehlt,
 * steht am Ende; eine, auf die kein Ausgang zeigt, ist einfach da, wie immer.
 * Wer keinen Aufbau anlegt, hat das Formular, das er vorher hatte.
 *
 * <b>Ausgewertet wird hier, im Browser.</b> Der Dienst kann keine Antwort
 * lesen — also auch keine Bedingung prüfen. Das Dokument liegt bei ihm
 * versiegelt, unter dem Schlüssel des Formularbereichs, wie die Fragen.
 */

import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from './crypto';
import { call } from './session';

/* -- Der Aufbau --------------------------------------------------------------- */

export type GroupKind = 'group' | 'page' | 'tab';

export const GROUP_LABEL: Record<GroupKind, string> = {
  group: 'Grupa',
  page: 'Strona',
  tab: 'Zakładka'
};

export interface FieldItem { readonly type: 'field'; readonly id: string }
export interface TextItem { readonly type: 'text'; readonly id: string; readonly text: string }
export interface GroupItem {
  readonly type: 'group';
  readonly id: string;
  readonly kind: GroupKind;
  readonly title: string;
  readonly items: readonly LayoutItem[];
}

export type LayoutItem = FieldItem | TextItem | GroupItem;

/* -- Die Logik ------------------------------------------------------------------ */

export const COMPARE_OPS = ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'contains', 'filled', 'empty'] as const;
export type CompareOp = (typeof COMPARE_OPS)[number];

export const COMPARE_LABEL: Record<CompareOp, string> = {
  eq: '=', ne: '≠', gt: '>', ge: '≥', lt: '<', le: '≤',
  contains: 'zawiera', filled: 'wypełnione', empty: 'puste'
};

/** Die Vergleiche, die nur EINEN Eingang brauchen. */
export const UNARY: readonly CompareOp[] = ['filled', 'empty'];

export const NODE_KINDS = [
  'answer', 'const',
  'compare', 'and', 'or', 'not', 'xor',
  'show', 'message', 'label', 'require'
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const NODE_LABEL: Record<NodeKind, string> = {
  answer: 'Odpowiedź',
  const: 'Wartość',
  compare: 'Porównanie',
  and: 'I',
  or: 'LUB',
  not: 'NIE',
  xor: 'ALBO',
  show: 'Pokaż',
  message: 'Komunikat',
  label: 'Nazwa pola',
  require: 'Wymagane'
};

export type NodeRole = 'input' | 'gate' | 'output';

export const roleOf = (kind: NodeKind): NodeRole =>
  kind === 'answer' || kind === 'const' ? 'input'
  : kind === 'show' || kind === 'message' || kind === 'label' || kind === 'require' ? 'output'
  : 'gate';

export type Port = 'a' | 'b' | 'in';

/** Welche Eingänge ein Knoten hat — und ob einer mehrere Kanten nimmt. */
export function portsOf(kind: NodeKind): readonly { readonly port: Port; readonly many: boolean }[] {
  switch (kind) {
    case 'answer':
    case 'const':
      return [];
    case 'compare':
      return [{ port: 'a', many: false }, { port: 'b', many: false }];
    case 'and':
    case 'or':
    case 'xor':
      return [{ port: 'in', many: true }];
    default:
      return [{ port: 'in', many: false }];
  }
}

export interface LogicNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly x: number;
  readonly y: number;

  /** `answer`: welche Frage. */
  readonly fieldId?: string;

  /** `const`: der Wert. `message` / `label`: der Text. */
  readonly value?: string;

  /** `compare`: wie verglichen wird. */
  readonly op?: CompareOp;

  /** Ausgänge: worauf sie wirken — eine Frage, ein Text, eine Gruppe (ihre Kennung im Aufbau). */
  readonly target?: string;
}

export interface LogicEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly port: Port;
}

export interface FormDesign {
  readonly version: 1;
  readonly layout: readonly LayoutItem[];
  readonly nodes: readonly LogicNode[];
  readonly edges: readonly LogicEdge[];
}

export const EMPTY_DESIGN: FormDesign = { version: 1, layout: [], nodes: [], edges: [] };

/* -- Lesen, duldsam ------------------------------------------------------------ */

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function readItem(raw: unknown, depth: number): LayoutItem | null {
  if (typeof raw !== 'object' || raw === null || depth > 32) return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id);
  if (id === undefined || id === '') return null;

  if (o.type === 'field') return { type: 'field', id };
  if (o.type === 'text') return { type: 'text', id, text: str(o.text) ?? '' };
  if (o.type === 'group') {
    const kind: GroupKind = o.kind === 'page' || o.kind === 'tab' ? o.kind : 'group';
    const items = Array.isArray(o.items)
      ? o.items.map((one) => readItem(one, depth + 1)).filter((one): one is LayoutItem => one !== null)
      : [];
    return { type: 'group', id, kind, title: str(o.title) ?? '', items };
  }
  return null;
}

/**
 * Ein Dokument aus dem, was der Browser aufgemacht hat — und NUR daraus.
 *
 * Was nicht passt, fällt weg, statt die ganze Ansicht zu reissen: ein
 * einzelner kaputter Knoten darf das Formular nicht unbenutzbar machen.
 */
export function readDesign(raw: unknown): FormDesign {
  if (typeof raw !== 'object' || raw === null) return EMPTY_DESIGN;
  const o = raw as Record<string, unknown>;

  const layout = Array.isArray(o.layout)
    ? o.layout.map((one) => readItem(one, 0)).filter((one): one is LayoutItem => one !== null)
    : [];

  const nodes: LogicNode[] = [];
  for (const one of Array.isArray(o.nodes) ? o.nodes : []) {
    if (typeof one !== 'object' || one === null) continue;
    const n = one as Record<string, unknown>;
    const id = str(n.id);
    const kind = (NODE_KINDS as readonly string[]).includes(str(n.kind) ?? '') ? (n.kind as NodeKind) : null;
    if (id === undefined || kind === null) continue;

    nodes.push({
      id, kind, x: num(n.x), y: num(n.y),
      fieldId: str(n.fieldId),
      value: str(n.value),
      op: (COMPARE_OPS as readonly string[]).includes(str(n.op) ?? '') ? (n.op as CompareOp) : undefined,
      target: str(n.target)
    });
  }

  const known = new Set(nodes.map((n) => n.id));
  const edges: LogicEdge[] = [];
  for (const one of Array.isArray(o.edges) ? o.edges : []) {
    if (typeof one !== 'object' || one === null) continue;
    const e = one as Record<string, unknown>;
    const id = str(e.id);
    const from = str(e.from);
    const to = str(e.to);
    const port: Port = e.port === 'a' || e.port === 'b' ? e.port : 'in';
    if (id === undefined || from === undefined || to === undefined) continue;
    if (!known.has(from) || !known.has(to)) continue;
    edges.push({ id, from, to, port });
  }

  return { version: 1, layout, nodes, edges };
}

/* -- Der Aufbau, vollständig ------------------------------------------------------ */

/**
 * Der Aufbau, wie er gezeichnet wird: ohne Fragen, die es nicht mehr gibt, und
 * mit denen, die (noch) nirgends stehen — am Ende.
 *
 * <b>Nicht jede Frage muss eingeordnet sein.</b> Eine neue Frage erscheint,
 * ohne dass jemand den Aufbau anfasst; eine gelöschte verschwindet aus ihm.
 */
export function layoutWith(layout: readonly LayoutItem[], fieldIds: readonly string[]): readonly LayoutItem[] {
  const exists = new Set(fieldIds);
  const placed = new Set<string>();

  const clean = (items: readonly LayoutItem[]): LayoutItem[] => items.flatMap((item): LayoutItem[] => {
    if (item.type === 'field') {
      if (!exists.has(item.id) || placed.has(item.id)) return [];
      placed.add(item.id);
      return [item];
    }
    if (item.type === 'group') return [{ ...item, items: clean(item.items) }];
    return [item];
  });

  const kept = clean(layout);
  const rest: LayoutItem[] = fieldIds.filter((id) => !placed.has(id)).map((id) => ({ type: 'field', id }));

  return [...kept, ...rest];
}

/** Jede Kennung im Aufbau — und die Gruppe, in der sie steht. */
export function parentsOf(layout: readonly LayoutItem[]): ReadonlyMap<string, string | null> {
  const out = new Map<string, string | null>();
  const walk = (items: readonly LayoutItem[], parent: string | null) => {
    for (const item of items) {
      out.set(item.id, parent);
      if (item.type === 'group') walk(item.items, item.id);
    }
  };
  walk(layout, null);
  return out;
}

/* -- Auswerten -------------------------------------------------------------------- */

type Value = string | boolean;

/**
 * Wann eine Antwort als „ja" gilt.
 *
 * Nicht leer — und nicht eines der Wörter, mit denen ein Mensch „nein" sagt.
 * Eine Frage „Tak / nie" soll sich direkt an ein UND hängen lassen, ohne
 * Vergleich dazwischen.
 */
export function truthy(v: Value): boolean {
  if (typeof v === 'boolean') return v;
  const t = v.trim().toLocaleLowerCase('pl');
  return t !== '' && !['nie', 'false', '0', 'no', 'n'].includes(t);
}

const asText = (v: Value): string => (typeof v === 'boolean' ? (v ? 'tak' : 'nie') : v);

/** Eine Zahl — mit Komma oder Punkt —, sonst `null`. */
export function asNumber(v: Value): number | null {
  const t = asText(v).trim().replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Zwei Werte vergleichen — als Zahlen, wenn beide welche sind, sonst als Text.
 *
 * Ein Datum (`2011-04-02`) vergleicht sich als Text richtig; „10" und „9"
 * nur als Zahl. Grösser/kleiner mit einer leeren Seite ist nie wahr: wer
 * nichts geantwortet hat, ist nicht „jünger als 16".
 */
export function compare(op: CompareOp, a: Value, b: Value): boolean {
  const x = asText(a).trim();
  const y = asText(b).trim();

  if (op === 'filled') return x !== '';
  if (op === 'empty') return x === '';
  if (op === 'contains') return y !== '' && x.toLocaleLowerCase('pl').includes(y.toLocaleLowerCase('pl'));

  const nx = asNumber(x);
  const ny = asNumber(y);

  if (op === 'eq' || op === 'ne') {
    const same = nx !== null && ny !== null
      ? nx === ny
      : x.toLocaleLowerCase('pl') === y.toLocaleLowerCase('pl');
    return op === 'eq' ? same : !same;
  }

  if (x === '' || y === '') return false;

  const order = nx !== null && ny !== null
    ? Math.sign(nx - ny)
    : Math.sign(x.localeCompare(y, 'pl', { numeric: true }));

  switch (op) {
    case 'gt': return order > 0;
    case 'ge': return order >= 0;
    case 'lt': return order < 0;
    default: return order <= 0;
  }
}

export interface Outcome {
  /** Was nicht zu sehen ist — durch eine eigene Bedingung oder weil die Gruppe darüber fehlt. */
  readonly hidden: ReadonlySet<string>;

  /** Hinweise unter einer Frage. */
  readonly messages: ReadonlyMap<string, readonly string[]>;

  /** Ein anderer Name für eine Frage — der erste Ausgang, der gilt. */
  readonly labels: ReadonlyMap<string, string>;

  /** Fragen, die die Logik zur Pflicht macht (zusätzlich zu den ohnehin verlangten). */
  readonly required: ReadonlySet<string>;

  /** Der Wert jedes Knotens — für die Vorschau im Editor. */
  readonly values: ReadonlyMap<string, Value>;
}

/**
 * Die Logik auswerten — für diese Antworten, jetzt.
 *
 * <b>Mehrere „Pokaż" auf dasselbe Ziel müssen ALLE gelten.</b> Wer „oder"
 * meint, hängt ein LUB davor; so steht die Absicht im Bild und nicht in einer
 * Regel, die man kennen muss.
 *
 * <b>Ein Kreis wertet sich zu „nein" aus</b>, statt den Browser anzuhalten.
 * Der Editor lässt keinen entstehen; ein Dokument von woanders könnte einen
 * tragen.
 */
export function evaluate(design: FormDesign, answers: Readonly<Record<string, string>>): Outcome {
  const byId = new Map(design.nodes.map((n) => [n.id, n]));
  const into = new Map<string, LogicEdge[]>();
  for (const e of design.edges) into.set(e.to, [...(into.get(e.to) ?? []), e]);

  const memo = new Map<string, Value>();
  const visiting = new Set<string>();

  const valueOf = (id: string): Value => {
    const done = memo.get(id);
    if (done !== undefined) return done;
    if (visiting.has(id)) return false;

    const node = byId.get(id);
    if (node === undefined) return '';

    visiting.add(id);
    const edges = into.get(id) ?? [];
    const on = (port: Port): Value[] => edges.filter((e) => e.port === port).map((e) => valueOf(e.from));
    const first = (port: Port): Value => on(port)[0] ?? '';

    let v: Value;
    switch (node.kind) {
      case 'answer': v = node.fieldId === undefined ? '' : answers[node.fieldId] ?? ''; break;
      case 'const': v = node.value ?? ''; break;
      case 'compare': v = compare(node.op ?? 'eq', first('a'), first('b')); break;
      case 'and': { const all = on('in'); v = all.length > 0 && all.every(truthy); break; }
      case 'or': v = on('in').some(truthy); break;
      case 'xor': v = on('in').filter(truthy).length % 2 === 1; break;
      case 'not': v = !truthy(first('in')); break;
      default: v = truthy(first('in')); break;
    }

    visiting.delete(id);
    memo.set(id, v);
    return v;
  };

  const shows = new Map<string, boolean[]>();
  const messages = new Map<string, string[]>();
  const labels = new Map<string, string>();
  const required = new Set<string>();

  for (const node of design.nodes) {
    if (roleOf(node.kind) !== 'output' || node.target === undefined) continue;
    const on = truthy(valueOf(node.id));

    if (node.kind === 'show') shows.set(node.target, [...(shows.get(node.target) ?? []), on]);
    if (!on) continue;

    const text = (node.value ?? '').trim();
    if (node.kind === 'message' && text !== '') messages.set(node.target, [...(messages.get(node.target) ?? []), text]);
    if (node.kind === 'label' && text !== '' && !labels.has(node.target)) labels.set(node.target, text);
    if (node.kind === 'require') required.add(node.target);
  }

  for (const node of design.nodes) valueOf(node.id);

  /* Verborgen: durch eigene Bedingung — und alles in einer verborgenen Gruppe. */
  const hidden = new Set<string>();
  const walk = (items: readonly LayoutItem[], above: boolean) => {
    for (const item of items) {
      const own = (shows.get(item.id) ?? []).some((ok) => !ok);
      const gone = above || own;
      if (gone) hidden.add(item.id);
      if (item.type === 'group') walk(item.items, gone);
    }
  };
  walk(design.layout, false);

  /* Ein Ziel, das im Aufbau nicht vorkommt (eine Frage am Ende), gilt trotzdem. */
  for (const [target, all] of shows) if (all.some((ok) => !ok)) hidden.add(target);

  return { hidden, messages, labels, required, values: memo };
}

/**
 * Welche sichtbaren Pflichtfragen in diesem Teil des Aufbaus noch leer sind.
 *
 * Daran hängt, ob die nächste SEITE aufgeht — und ob das Formular abgeschickt
 * werden kann.
 */
export function missingIn(
  items: readonly LayoutItem[],
  requiredField: (fieldId: string) => boolean,
  answers: Readonly<Record<string, string>>,
  outcome: Outcome
): readonly string[] {
  const out: string[] = [];
  const walk = (list: readonly LayoutItem[]) => {
    for (const item of list) {
      if (outcome.hidden.has(item.id)) continue;
      if (item.type === 'group') { walk(item.items); continue; }
      if (item.type !== 'field') continue;
      const need = requiredField(item.id) || outcome.required.has(item.id);
      if (need && (answers[item.id] ?? '').trim() === '') out.push(item.id);
    }
  };
  walk(items);
  return out;
}

/** Würde eine Kante `from → to` einen Kreis schliessen? */
export function wouldCycle(edges: readonly LogicEdge[], from: string, to: string): boolean {
  if (from === to) return true;
  const next = new Map<string, string[]>();
  for (const e of edges) next.set(e.from, [...(next.get(e.from) ?? []), e.to]);

  const seen = new Set<string>();
  const stack = [to];
  while (stack.length > 0) {
    const at = stack.pop()!;
    if (at === from) return true;
    if (seen.has(at)) continue;
    seen.add(at);
    stack.push(...(next.get(at) ?? []));
  }
  return false;
}

/* -- Versiegeln und ablegen ------------------------------------------------------- */

/** So liegt das Dokument beim Dienst — und so kommt es heraus. */
export interface SealedDesign {
  readonly areaId: string;
  readonly epoch: number;
  readonly sealed: string;
  readonly updatedAt?: string;
}

/* Das Etikett nennt das FORMULAR — ein Dokument lässt sich nicht an ein anderes hängen. */
const designAad = (moduleId: string) => aad('form', 'design', moduleId, Field.FormDesign, 1);

export async function sealDesign(design: FormDesign, key: Uint8Array, moduleId: string): Promise<string> {
  return toBase64Url(await sealText(key, designAad(moduleId), JSON.stringify(design)));
}

/**
 * Aufmachen — mit dem Schlüssel des Formularbereichs. Geht es nicht (kein
 * Schlüssel, ein fremdes Dokument), ist das Formular eine Liste wie vorher:
 * `null` und kein Absturz.
 */
export async function openDesign(
  sealed: SealedDesign | null, key: Uint8Array | undefined, moduleId: string
): Promise<FormDesign | null> {
  if (sealed === null || key === undefined) return null;
  try {
    return readDesign(JSON.parse(await openText(key, designAad(moduleId), fromBase64Url(sealed.sealed))));
  } catch {
    return null;
  }
}

export const saveDesign = (
  moduleId: string, areaId: string, epoch: number, sealed: string | null
): Promise<{ design: SealedDesign | null }> =>
  call(`/workspace/part/${encodeURIComponent(moduleId)}/design`, {
    method: 'POST',
    body: JSON.stringify({ areaId, epoch, sealed })
  });
