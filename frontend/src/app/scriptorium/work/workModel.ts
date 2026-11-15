/**
 * DAS WERK VON OBEN NACH UNTEN (2026-11-15, documentation/WORK.md) — die Struktur eines Projekts als Baum.
 *
 * Ein Projekt des Skryptorium ist ein Baum aus Knoten (Art `node`): Werk → Teile → Kapitel → Abschnitte → … →
 * Einheiten. Ein Knoten steht, bevor es Prosa gibt (Zweck, Kernsatz, Rolle, Ziel); seine Prosa ist ein gewöhnlicher
 * Text (`text`), so dass Editor, Plan, Wygłoszenia, Seiten und Archiv weiterlaufen. Die Kennung eines Knotens bleibt,
 * wohin er auch zieht — Verweise, Marken und Wygłoszenia brechen nie.
 *
 * <b>Dimensionen.</b> Ein Projekt erklärt Dimensionen (Zielgruppe, Stufe, Blickwinkel …). Ein Knoten mit `split`
 * teilt sich nach einer: seine Kinder tragen `variant` — einen Wert, oder leer: der gemeinsame Kern für alle Werte.
 * Das gilt an jeder Stelle des Baums, auch verschachtelt (ein Teil nach Zielgruppe, darin ein Abschnitt nach
 * Blickwinkel). Ein Weg (eine Ausgabe) wählt je Dimension einen Wert und liest sich als ein lineares Werk:
 * durch die ungeteilten Teile unverändert, durch jeden geteilten Teil entlang seines Werts (`linear`).
 *
 * Alt: ein Projekt mit flacher Gliederung (`outline`) und ohne Knoten zeigt seine Gliederung als Baum aus
 * gedachten Knoten (`virtual`), bis der Besitzer sie umwandelt (`outlineToNodes`) — nichts geht verloren, und die
 * Gliederung bleibt für die, die sie lesen (Schule, alter Druck: `projectOutline`).
 */

import { newId } from '../../core/ids';
import {
  ids, itemsOf, NODE_ROLES, num, outline, str, wordCount,
  type EntryData, type LibEntry, type OutlineItem
} from '../../library/libraryKinds';
import type { SaveInput } from '../../library/libraryStore';

/* -- Das Modell ------------------------------------------------------------------------------------ */

export interface NodeMark {
  readonly entry: string;
  readonly role: MarkRole;
  readonly note?: string;
}

export type MarkRole = 'intro' | 'def' | 'ex' | 'use' | 'recall';
export const MARK_ORDER: readonly MarkRole[] = ['intro', 'def', 'ex', 'use', 'recall'];
export const isMarkRole = (v: unknown): v is MarkRole => typeof v === 'string' && (MARK_ORDER as readonly string[]).includes(v);

export interface WorkNode {
  readonly id: string;
  readonly key?: string;
  readonly parent: string | null;
  readonly order: number;
  readonly title: string;
  readonly purpose: string;
  readonly synopsis: string;
  readonly role: string;
  readonly brings: string;
  readonly targetWords: number | null;
  readonly targetMinutes: number | null;
  readonly status: string;
  readonly notes: string;
  readonly text: string | null;
  readonly split: string;
  readonly variant: string;
  readonly skip: readonly { readonly value: string; readonly note: string }[];
  readonly template: string | null;
  readonly templateSig: string;
  readonly marks: readonly NodeMark[];
  readonly depth: number;
  readonly children: readonly WorkNode[];
  /** Aus der alten Gliederung gedacht, noch nicht gespeichert. */
  readonly virtual: boolean;
}

export interface DimValue { readonly key: string; readonly name: string }
export interface Dimension { readonly key: string; readonly name: string; readonly ordered: boolean; readonly values: readonly DimValue[] }
export interface WorkPath { readonly key: string; readonly name: string; readonly choose: Readonly<Record<string, string>> }
export interface WorkLevel { readonly name: string; readonly latex: string }
export interface WorkRole { readonly value: string; readonly label: string; readonly brings: 'new' | 'nothing' | 'any'; readonly own: boolean }

export interface WorkModel {
  readonly project: LibEntry;
  readonly nodes: ReadonlyMap<string, WorkNode>;
  readonly roots: readonly WorkNode[];
  readonly levels: readonly WorkLevel[];
  readonly dimensions: readonly Dimension[];
  readonly paths: readonly WorkPath[];
  readonly roles: readonly WorkRole[];
  readonly lang: 'pl' | 'de' | 'en' | '';
  /** Die Bazy wiedzy (Kennungen), deren Einträge das Wissen dieses Werks sind. */
  readonly bases: readonly string[];
  /** Noch aus der alten Gliederung (`outline`) gedacht. */
  readonly fromOutline: boolean;
}

/** Was das Modell zum Lesen braucht: die Einträge (Knoten, Texte) und einen Eintrag bei der Kennung. */
export interface WorkLook {
  all(): readonly LibEntry[];
  get(id: string): LibEntry | undefined;
}

/* -- Lesen ----------------------------------------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const KEY_WORD = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;

function readMarks(data: EntryData): NodeMark[] {
  const out: NodeMark[] = [];
  for (const item of itemsOf(data, 'marks')) {
    const entry = str(item, 'entry').trim();
    const role = str(item, 'role');
    if (entry === '') continue;
    out.push({ entry, role: isMarkRole(role) ? role : 'use', ...(str(item, 'note').trim() === '' ? {} : { note: str(item, 'note').trim() }) });
  }
  return out;
}

export function readDimensions(data: EntryData): Dimension[] {
  const out: Dimension[] = [];
  for (const item of itemsOf(data, 'dimensions')) {
    const key = str(item, 'key').trim();
    if (!KEY_WORD.test(key) || out.some((d) => d.key === key)) continue;
    const values: DimValue[] = [];
    for (const v of itemsOf(item, 'values')) {
      const vk = str(v, 'key').trim();
      if (!KEY_WORD.test(vk) || values.some((x) => x.key === vk)) continue;
      values.push({ key: vk, name: str(v, 'name').trim() || vk });
    }
    out.push({ key, name: str(item, 'name').trim() || key, ordered: str(item, 'ordered') === 'yes', values });
  }
  return out;
}

export function readPaths(data: EntryData, dims: readonly Dimension[]): WorkPath[] {
  const out: WorkPath[] = [];
  for (const item of itemsOf(data, 'paths')) {
    const key = str(item, 'key').trim();
    if (!KEY_WORD.test(key) || out.some((p) => p.key === key)) continue;
    const choose: Record<string, string> = {};
    for (const c of itemsOf(item, 'choose')) {
      const dim = dims.find((d) => d.key === str(c, 'dimension').trim());
      const value = dim?.values.find((v) => v.key === str(c, 'value').trim());
      if (dim !== undefined && value !== undefined) choose[dim.key] = value.key;
    }
    out.push({ key, name: str(item, 'name').trim() || key, choose });
  }
  return out;
}

export function readRoles(data: EntryData): WorkRole[] {
  const out: WorkRole[] = NODE_ROLES.map((r) => ({ value: r.value, get label() { return r.label; }, brings: r.brings, own: false }));
  for (const item of itemsOf(data, 'roles')) {
    const value = str(item, 'value').trim();
    if (!KEY_WORD.test(value) || out.some((r) => r.value === value)) continue;
    const brings = str(item, 'brings');
    out.push({ value, label: str(item, 'label').trim() || value, brings: brings === 'new' || brings === 'nothing' ? brings : 'any', own: true });
  }
  return out;
}

const LATEX_DEFAULT: Readonly<Record<string, readonly string[]>> = {
  book: ['part', 'chapter', 'section', 'subsection', 'subsubsection', 'paragraph'],
  booklet: ['chapter', 'section', 'subsection', 'subsubsection', 'paragraph'],
  article: ['section', 'subsection', 'subsubsection', 'paragraph'],
  handout: ['section', 'subsection', 'subsubsection', 'paragraph']
};

export function readLevels(data: EntryData): WorkLevel[] {
  const cls = str(data, 'latexClass') || 'book';
  const defaults = LATEX_DEFAULT[cls] ?? LATEX_DEFAULT.book;
  return itemsOf(data, 'levels').map((item, i) => ({ name: str(item, 'name').trim(), latex: str(item, 'latex') || defaults[Math.min(i, defaults.length - 1)] }));
}

/** Der Name der Ebene `depth` (oder leer) und wie sie gedruckt wird. */
export function levelOf(model: WorkModel, depth: number): WorkLevel {
  const cls = str(model.project.data, 'latexClass') || 'book';
  const defaults = LATEX_DEFAULT[cls] ?? LATEX_DEFAULT.book;
  return model.levels[depth] ?? { name: '', latex: defaults[Math.min(depth, defaults.length - 1)] };
}

export function readNode(entry: LibEntry, depth = 0, children: readonly WorkNode[] = []): WorkNode {
  const d = entry.data;
  const skip = itemsOf(d, 'skip').map((s) => ({ value: str(s, 'value').trim(), note: str(s, 'note').trim() })).filter((s) => s.value !== '');
  return {
    id: entry.id,
    ...(entry.key === undefined ? {} : { key: entry.key }),
    parent: ids(d, 'parent')[0] ?? null,
    order: num(d, 'order') ?? 0,
    title: str(d, 'title').trim(),
    purpose: str(d, 'purpose').trim(),
    synopsis: str(d, 'synopsis').trim(),
    role: str(d, 'role').trim(),
    brings: str(d, 'brings').trim(),
    targetWords: num(d, 'targetWords'),
    targetMinutes: num(d, 'targetMinutes'),
    status: str(d, 'status'),
    notes: str(d, 'notes'),
    text: ids(d, 'text')[0] ?? null,
    split: str(d, 'split').trim(),
    variant: str(d, 'variant').trim(),
    skip,
    template: ids(d, 'template')[0] ?? null,
    templateSig: str(d, 'templateSig'),
    marks: readMarks(d),
    depth,
    children,
    virtual: false
  };
}

/** Die Knoten eines Projekts aus den Einträgen. */
export const nodesOf = (project: LibEntry, look: WorkLook): LibEntry[] =>
  look.all().filter((e) => e.kind === 'node' && ids(e.data, 'project').includes(project.id));

/**
 * DAS MODELL EINES PROJEKTS. Kreise (ein Knoten unter sich selbst) und verwaiste Knoten (Eltern fehlt, steht in
 * einem anderen Projekt) stehen oben — nichts verschwindet.
 */
export function readWork(project: LibEntry, look: WorkLook): WorkModel {
  const d = project.data;
  const dimensions = readDimensions(d);
  const entries = nodesOf(project, look);
  const fromOutline = entries.length === 0 && outline(d).length > 0;
  const raw = fromOutline ? outlineNodes(project, look) : entries.map((e) => readNode(e));
  const byId = new Map(raw.map((n) => [n.id, n]));
  const kids = new Map<string | null, WorkNode[]>();
  for (const n of raw) {
    let parent = n.parent !== null && byId.has(n.parent) && n.parent !== n.id ? n.parent : null;
    /* Gegen Kreise: geht man von hier nach oben und kommt hier an, steht der Knoten oben. */
    for (let at = parent, steps = 0; at !== null && steps <= raw.length; steps += 1) {
      if (at === n.id) { parent = null; break; }
      const up = byId.get(at)?.parent ?? null;
      at = up !== null && byId.has(up) ? up : null;
    }
    const list = kids.get(parent) ?? [];
    list.push(n);
    kids.set(parent, list);
  }
  const nodes = new Map<string, WorkNode>();
  const build = (parent: string | null, depth: number, seen: Set<string>): WorkNode[] =>
    (kids.get(parent) ?? []).sort(byOrder).flatMap((n) => {
      if (seen.has(n.id)) return [];
      seen.add(n.id);
      const made: WorkNode = { ...n, parent, depth, children: build(n.id, depth + 1, seen) };
      nodes.set(n.id, made);
      return [made];
    });
  const roots = build(null, 0, new Set());
  const bases = itemsOf(d, 'knowledge').map((b) => str(b, 'base').trim()).filter((b) => b !== '');
  const lang = str(d, 'lang');
  return {
    project, nodes, roots, dimensions, paths: readPaths(d, dimensions), roles: readRoles(d), levels: readLevels(d),
    lang: lang === 'pl' || lang === 'de' || lang === 'en' ? lang : '', bases: [...new Set(bases)], fromOutline
  };
}

const byOrder = (a: WorkNode, b: WorkNode): number => a.order - b.order || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);

/* -- Die alte Gliederung ---------------------------------------------------------------------------- */

/** Die Gliederung als gedachte Knoten: Überschriften oben, Texte darunter (vor der ersten Überschrift: oben). */
function outlineNodes(project: LibEntry, look: WorkLook): WorkNode[] {
  const out: WorkNode[] = [];
  let heading: string | null = null;
  outline(project.data).forEach((item, i) => {
    const base = readNode({ id: `outline-${i}`, kind: 'node', data: {} });
    if ('heading' in item) {
      heading = `outline-${i}`;
      out.push({ ...base, title: item.heading, order: i + 1, virtual: true });
      return;
    }
    const text = look.get(item.text);
    out.push({ ...base, parent: heading, title: text === undefined ? '' : str(text.data, 'title'), order: i + 1, text: text?.id ?? item.text, virtual: true });
  });
  return out;
}

/**
 * DIE ALTE GLIEDERUNG ALS KNOTEN — was der Besitzer mit einem Klick speichert. Überschriften werden Knoten der
 * obersten Ebene, Texte Knoten darunter, die auf ihren Text zeigen. Die Gliederung selbst bleibt stehen.
 */
export function outlineToNodes(project: LibEntry, look: WorkLook): SaveInput[] {
  const planned = outlineNodes(project, look);
  const idOf = new Map(planned.map((n) => [n.id, newId()]));
  return planned.map((n) => ({
    id: idOf.get(n.id)!,
    kind: 'node',
    data: {
      project: project.id,
      ...(n.parent === null ? {} : { parent: idOf.get(n.parent)! }),
      order: n.order,
      title: n.title,
      ...(n.text === null ? {} : { text: n.text }),
      status: n.text === null ? 'planned' : statusOfText(look.get(n.text))
    }
  }));
}

const statusOfText = (text: LibEntry | undefined): string =>
  text === undefined ? 'planned' : str(text.data, 'status') === 'final' ? 'done' : wordCount(str(text.data, 'body')) > 0 ? 'drafting' : 'planned';

/**
 * WAS ALTE LESER ALS GLIEDERUNG SEHEN (die Schule, der alte Druck): mit Knoten aus dem Baum — innere Knoten als
 * Überschriften, Knoten mit Text als Texte, in Lesereihenfolge über alle Varianten; ohne Knoten die gespeicherte.
 */
export function projectOutline(project: LibEntry, look: WorkLook): OutlineItem[] {
  if (nodesOf(project, look).length === 0) return outline(project.data);
  const model = readWork(project, look);
  const out: OutlineItem[] = [];
  const walk = (list: readonly WorkNode[]) => {
    for (const n of list) {
      if (n.text !== null) out.push({ text: n.text });
      else if (n.children.length > 0 && n.title !== '') out.push({ heading: n.title });
      walk(n.children);
    }
  };
  walk(model.roots);
  return out;
}

/* -- Wege durch die Dimensionen --------------------------------------------------------------------- */

/** Die Wege des Projekts — ohne erklärte: einer, der in jeder Dimension den ersten Wert nimmt. */
export function pathsOf(model: WorkModel): WorkPath[] {
  if (model.paths.length > 0) return [...model.paths];
  return [{ key: '', name: '', choose: Object.fromEntries(model.dimensions.filter((d) => d.values.length > 0).map((d) => [d.key, d.values[0].key])) }];
}

export function pathOf(model: WorkModel, key: string | undefined): WorkPath {
  const all = pathsOf(model);
  return all.find((p) => p.key === key) ?? all[0];
}

/** Welcher Wert einer Dimension auf diesem Weg gilt (fehlt die Wahl: der erste). */
export function chosenValue(model: WorkModel, path: WorkPath, dim: string): string | undefined {
  return path.choose[dim] ?? model.dimensions.find((d) => d.key === dim)?.values[0]?.key;
}

/** Liegt dieses Kind eines geteilten Knotens auf dem Weg? Kern (leer) immer, sonst nur der gewählte Wert. */
export function childOnPath(model: WorkModel, path: WorkPath, parent: WorkNode, child: WorkNode): boolean {
  if (parent.split === '' || child.variant === '') return true;
  return child.variant === chosenValue(model, path, parent.split);
}

export interface Placed {
  readonly node: WorkNode;
  /** Die Stelle in der Lesereihenfolge des Weges (0, 1, 2 …). */
  readonly pos: number;
  /** „1.2.3" — nach den Knoten, die auf dem Weg liegen. */
  readonly number: string;
  /** Die Werte, für die diese Stelle eigens steht (Dimension → Wert, von oben her); ein gemeinsamer Kern nennt seine Dimension nicht. */
  readonly through: Readonly<Record<string, string>>;
}

/**
 * DER WEG ALS LINEARES WERK: jeder Knoten, der auf ihm liegt, in Lesereihenfolge (Tiefe zuerst), mit Nummer und
 * den Werten der Dimensionen, durch die er erreicht wird.
 */
export function linear(model: WorkModel, path: WorkPath): Placed[] {
  const out: Placed[] = [];
  const walk = (list: readonly WorkNode[], parent: WorkNode | null, prefix: string, through: Record<string, string>) => {
    let n = 0;
    for (const node of list) {
      if (parent !== null && !childOnPath(model, path, parent, node)) continue;
      n += 1;
      const number = prefix === '' ? String(n) : `${prefix}.${n}`;
      const here = parent !== null && parent.split !== '' && node.variant !== '' ? { ...through, [parent.split]: node.variant } : through;
      out.push({ node, pos: out.length, number, through: here });
      walk(node.children, node, number, here);
    }
  };
  walk(model.roots, null, '', {});
  return out;
}

/** Alle Knoten, auf allen Wegen, in Baumreihenfolge. */
export function allNodes(model: WorkModel): WorkNode[] {
  const out: WorkNode[] = [];
  const walk = (list: readonly WorkNode[]) => { for (const n of list) { out.push(n); walk(n.children); } };
  walk(model.roots);
  return out;
}

/** Ein Knoten und alles darunter. */
export function subtree(node: WorkNode): WorkNode[] {
  const out: WorkNode[] = [node];
  for (const c of node.children) out.push(...subtree(c));
  return out;
}

/** Die Vorfahren eines Knotens, vom Eltern bis zur Wurzel. */
export function ancestors(model: WorkModel, node: WorkNode): WorkNode[] {
  const out: WorkNode[] = [];
  for (let at = node.parent === null ? undefined : model.nodes.get(node.parent); at !== undefined; at = at.parent === null ? undefined : model.nodes.get(at.parent)) {
    if (out.includes(at)) break;
    out.push(at);
  }
  return out;
}

/** Auf welchen Wegen ein Knoten liegt. */
export function pathsThrough(model: WorkModel, node: WorkNode): WorkPath[] {
  return pathsOf(model).filter((p) => linear(model, p).some((x) => x.node.id === node.id));
}

/** Die Rolle eines Knotens (eingebaut oder eigene des Projekts). */
export const roleOf = (model: WorkModel, value: string): WorkRole | undefined => model.roles.find((r) => r.value === value);

/* -- Wörter und Ziele -------------------------------------------------------------------------------- */

/** Gesprochen: etwa 130 Wörter in der Minute (ein Fünf-Minuten-Kazanie hat ~650). */
export const WORDS_PER_MINUTE = 130;

/** Das Ziel in Wörtern: eigenes, sonst aus Minuten. */
export function targetOf(node: WorkNode): number | null {
  if (node.targetWords !== null && node.targetWords > 0) return node.targetWords;
  if (node.targetMinutes !== null && node.targetMinutes > 0) return Math.round(node.targetMinutes * WORDS_PER_MINUTE);
  return null;
}

/** Die Wörter des Textes dieses Knotens (nur sein eigener). */
export function wordsOf(node: WorkNode, look: WorkLook): number {
  const text = node.text === null ? undefined : look.get(node.text);
  return text === undefined || text.kind !== 'text' ? 0 : wordCount(str(text.data, 'body'));
}

/** Die Wörter eines Teilbaums entlang eines Weges. */
export function wordsBelow(model: WorkModel, path: WorkPath, node: WorkNode, look: WorkLook): number {
  let sum = wordsOf(node, look);
  for (const c of node.children) if (childOnPath(model, path, node, c)) sum += wordsBelow(model, path, c, look);
  return sum;
}

/* -- Wie weit das Konzept ist ------------------------------------------------------------------------ */

export interface LevelProgress {
  readonly depth: number;
  readonly name: string;
  readonly nodes: number;
  readonly noPurpose: number;
  readonly noRole: number;
  readonly noSynopsis: number;
  readonly noTarget: number;
  readonly written: number;
  readonly words: number;
  readonly target: number;
}

/** Je Ebene: wie viele Knoten, wie vielen noch Zweck, Rolle, Kernsatz, Ziel fehlen, Wörter gegen Ziel. */
export function progressOf(model: WorkModel, look: WorkLook): LevelProgress[] {
  const out: LevelProgress[] = [];
  for (const node of allNodes(model)) {
    const at = out[node.depth] ?? { depth: node.depth, name: levelOf(model, node.depth).name, nodes: 0, noPurpose: 0, noRole: 0, noSynopsis: 0, noTarget: 0, written: 0, words: 0, target: 0 };
    const target = targetOf(node);
    const words = wordsOf(node, look);
    out[node.depth] = {
      ...at,
      nodes: at.nodes + 1,
      noPurpose: at.noPurpose + (node.purpose === '' ? 1 : 0),
      noRole: at.noRole + (node.role === '' ? 1 : 0),
      noSynopsis: at.noSynopsis + (node.synopsis === '' ? 1 : 0),
      noTarget: at.noTarget + (target === null && node.children.length === 0 ? 1 : 0),
      written: at.written + (words > 0 ? 1 : 0),
      words: at.words + words,
      target: at.target + (target ?? 0)
    };
  }
  return out.filter(Boolean);
}

/* -- Die Tabelle der Dimensionen --------------------------------------------------------------------- */

export interface Cell {
  /** Die Knoten, die nur für diesen Wert stehen (unter einer Teilung nach der Dimension). */
  readonly specific: readonly WorkNode[];
  /** Absichtlich nicht nötig (`skip`), mit Notiz. */
  readonly skipped: string | null;
  /** Eine Lücke: geteilt, aber nichts für diesen Wert und nicht als unnötig markiert. */
  readonly gap: boolean;
}

export interface TableRow {
  readonly node: WorkNode | null;
  /** Bei Zeilen nach einer Dimension: ihr Wert. */
  readonly value?: DimValue;
  /** Was für alle Werte gemeinsam gilt (der Kern unter Teilungen nach der Spalten-Dimension). */
  readonly shared: readonly WorkNode[];
  /** Ungeteilt: die Zeile ist eine einzige Linie über alle Spalten. */
  readonly single: boolean;
  readonly cells: Readonly<Record<string, Cell>>;
}

export interface TableSpec {
  /** Zeilen: die Knoten einer Ebene des Baums (`level`) — oder die Werte einer Dimension (`rows`). */
  readonly level?: number;
  readonly rows?: string;
  /** Spalten: die Werte dieser Dimension. */
  readonly columns: string;
  /** Die anderen Dimensionen festgelegt (Filter). */
  readonly filters?: Readonly<Record<string, string>>;
}

/**
 * DIE TABELLE: Zeilen × Werte einer Dimension. Eine Zelle sammelt die Knoten unter der Zeile, die für genau diesen
 * Wert stehen (unter einer Teilung nach der Spalten-Dimension, entlang der Filter für die anderen); der gemeinsame
 * Kern steht daneben. Eine Lücke ist eine Teilung ohne Kind für den Wert, die nicht als unnötig markiert ist.
 */
export function dimensionTable(model: WorkModel, spec: TableSpec): TableRow[] {
  const dim = model.dimensions.find((d) => d.key === spec.columns);
  if (dim === undefined) return [];
  const filters = spec.filters ?? {};
  const passes = (parent: WorkNode, child: WorkNode): boolean =>
    parent.split === '' || child.variant === '' || parent.split === dim.key || filters[parent.split] === undefined || filters[parent.split] === child.variant;

  const cellsFor = (root: WorkNode, only?: (n: WorkNode, value: string) => boolean): Omit<TableRow, 'node' | 'value'> => {
    const specific = new Map<string, WorkNode[]>(dim.values.map((v) => [v.key, []]));
    const shared: WorkNode[] = [];
    const skipped = new Map<string, string>();
    const gaps = new Set<string>();
    let split = false;
    const walk = (node: WorkNode, value: string | null) => {
      if (node.split === dim.key && value === null) {
        split = true;
        for (const v of dim.values) {
          const has = node.children.some((c) => c.variant === v.key);
          const skip = node.skip.find((s) => s.value === v.key);
          if (skip !== undefined) skipped.set(v.key, skip.note);
          else if (!has) gaps.add(v.key);
        }
      }
      for (const c of node.children) {
        if (!passes(node, c)) continue;
        const v = node.split === dim.key && c.variant !== '' ? c.variant : value;
        if (v !== null && (only === undefined || only(c, v))) specific.get(v)?.push(c);
        else if (v === null && node.split === dim.key) shared.push(c);
        walk(c, v);
      }
    };
    walk(root, null);
    const cells: Record<string, Cell> = {};
    for (const v of dim.values) cells[v.key] = { specific: specific.get(v.key) ?? [], skipped: skipped.get(v.key) ?? null, gap: gaps.has(v.key) };
    return { shared, single: !split, cells };
  };

  if (spec.rows !== undefined) {
    const rowsDim = model.dimensions.find((d) => d.key === spec.rows);
    if (rowsDim === undefined || rowsDim.key === dim.key) return [];
    /* Zeilen nach einer zweiten Dimension: eine Zelle zeigt, was auf dem Weg (Zeile, Spalte) für beide eigens steht. */
    return rowsDim.values.map((rv) => {
      const cells: Record<string, Cell> = {};
      for (const cv of dim.values) {
        const path: WorkPath = { key: '', name: '', choose: { ...filters, [rowsDim.key]: rv.key, [dim.key]: cv.key } };
        const on = linear(model, path).filter((p) => p.through[rowsDim.key] === rv.key && p.through[dim.key] === cv.key);
        cells[cv.key] = { specific: on.map((p) => p.node).filter((n) => n.variant !== ''), skipped: null, gap: false };
      }
      return { node: null, value: rv, shared: [], single: false, cells };
    });
  }
  const level = spec.level ?? 0;
  return allNodes(model).filter((n) => n.depth === level).map((node) => ({ node, ...cellsFor(node) }));
}

/* -- Ändern: was gespeichert wird --------------------------------------------------------------------- */

/** Eine Ordnungszahl zwischen zwei Nachbarn (ohne die anderen umzuschreiben). */
export function orderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1;
  if (before === null) return after! - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}

/** Ein neuer Knoten — unter `parent` (oder oben), nach `after` (oder am Ende). */
export function newNode(model: WorkModel, parent: WorkNode | null, after: WorkNode | null, data: EntryData = {}): SaveInput {
  const siblings = parent === null ? model.roots : parent.children;
  const index = after === null ? siblings.length - 1 : siblings.findIndex((s) => s.id === after.id);
  const before = index < 0 ? null : siblings[index]?.order ?? null;
  const next = index + 1 < siblings.length ? siblings[index + 1].order : null;
  return {
    id: newId(),
    kind: 'node',
    data: {
      project: model.project.id,
      ...(parent === null ? {} : { parent: parent.id }),
      order: orderBetween(before, after === null ? null : next),
      status: 'idea',
      ...data
    }
  };
}

/** Ein Knoten zieht um: neuer Eltern (oder oben), nach `after` (oder an den Anfang). Nur seine eigenen Daten ändern sich. */
export function moveNode(model: WorkModel, node: WorkNode, parent: WorkNode | null, after: WorkNode | null, entry: LibEntry): SaveInput | null {
  if (parent !== null && (parent.id === node.id || subtree(node).some((n) => n.id === parent.id))) return null;
  const siblings = (parent === null ? model.roots : parent.children).filter((s) => s.id !== node.id);
  const index = after === null ? -1 : siblings.findIndex((s) => s.id === after.id);
  const before = index < 0 ? null : siblings[index].order;
  const next = index + 1 < siblings.length ? siblings[index + 1].order : null;
  const data: EntryData = { ...entry.data, order: orderBetween(before, next) };
  if (parent === null) delete data.parent; else data.parent = parent.id;
  if (parent === null || parent.split === '') delete data.variant;
  return { id: node.id, kind: 'node', ...(entry.key === undefined ? {} : { key: entry.key }), data };
}

/**
 * TEILEN: die Kinder ab `from` ziehen in einen neuen Geschwisterknoten direkt danach (mit demselben Eltern, Rolle
 * und Ziel leer). Gibt den neuen Knoten und die umgezogenen Kinder zurück.
 */
export function splitNode(model: WorkModel, node: WorkNode, from: number, title: string, entryOf: (id: string) => LibEntry | undefined): SaveInput[] {
  const parent = node.parent === null ? null : model.nodes.get(node.parent) ?? null;
  const made = newNode(model, parent, node, { title, ...(node.variant === '' ? {} : { variant: node.variant }) });
  const out: SaveInput[] = [made];
  node.children.slice(from).forEach((c, i) => {
    const e = entryOf(c.id);
    if (e === undefined) return;
    out.push({ id: c.id, kind: 'node', ...(e.key === undefined ? {} : { key: e.key }), data: { ...e.data, parent: made.id!, order: i + 1 } });
  });
  return out;
}

/**
 * VEREINEN: `drop` geht in `keep` auf — seine Kinder ziehen unter `keep` (hinter dessen Kinder), seine Marken und
 * sein Zweck kommen dazu; hat nur `drop` einen Text, nimmt `keep` ihn. `drop` selbst wird danach gelöscht
 * (`remove`). Ein zweiter Text bleibt als Text bestehen und wird nicht gelöscht.
 */
export function mergeNodes(keep: WorkNode, drop: WorkNode, entryOf: (id: string) => LibEntry | undefined): { save: SaveInput[]; remove: string } | null {
  const k = entryOf(keep.id);
  if (k === undefined || keep.id === drop.id) return null;
  const join = (a: string, b: string) => [a, b].filter((s) => s.trim() !== '').join('\n\n');
  const marks = [...itemsOf(k.data, 'marks'), ...drop.marks.filter((m) => !keep.marks.some((x) => x.entry === m.entry && x.role === m.role))];
  const data: EntryData = {
    ...k.data,
    purpose: join(keep.purpose, drop.purpose),
    synopsis: join(keep.synopsis, drop.synopsis),
    brings: join(keep.brings, drop.brings),
    notes: join(keep.notes, drop.notes),
    marks,
    ...(keep.text === null && drop.text !== null ? { text: drop.text } : {})
  };
  for (const key of ['purpose', 'synopsis', 'brings', 'notes']) if (data[key] === '') delete data[key];
  const last = keep.children.length === 0 ? 0 : keep.children[keep.children.length - 1].order;
  const save: SaveInput[] = [{ id: keep.id, kind: 'node', ...(k.key === undefined ? {} : { key: k.key }), data }];
  drop.children.forEach((c, i) => {
    const e = entryOf(c.id);
    if (e !== undefined) save.push({ id: c.id, kind: 'node', ...(e.key === undefined ? {} : { key: e.key }), data: { ...e.data, parent: keep.id, order: last + i + 1 } });
  });
  return { save, remove: drop.id };
}

/** Ein Feld der gespeicherten Daten — für Editoren, die nur `patch` geben. */
export function patchNode(entry: LibEntry, patch: EntryData): SaveInput {
  const data: EntryData = { ...entry.data };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) delete data[k];
    else data[k] = v;
  }
  return { id: entry.id, kind: entry.kind, ...(entry.key === undefined ? {} : { key: entry.key }), data };
}

/** Ein Wert, der ein Objekt aus Feldern ist — für die Editoren der Dimensionen und Wege. */
export const asRecord = (v: unknown): Record<string, unknown> => (isObject(v) ? v : {});
