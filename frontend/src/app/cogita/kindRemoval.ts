/**
 * COGITA — EINEN RODZAJ ENTFERNEN (COGITA.md §2.1), 2026-10-18, auf Wunsch:
 * jeder Rodzaj lässt sich entfernen, auch ein eingebauter (Temat, Wiedza,
 * Pytanie) — samt dem, was an ihm hängt, und dem, was auf ihn zeigt. Vorher
 * wird ausgerechnet und gesagt, was alles geht:
 *
 * <code>
 *   Einträge nur dieses Rodzaj         gelöscht
 *   Einträge, die noch einen haben     bleiben, ohne ihn
 *   Einträge aus Quellen               bleiben (dort gehören sie hin)
 *   Verweise anderer Einträge darauf   werden aus ihnen herausgenommen
 *   Verweisfelder eigener Rodzaje      nur auf ihn: fallen weg; auf mehrere: zeigen nicht mehr auf ihn
 *   Kartenvorlagen                     nur für ihn: gelöscht; für mehrere: ohne ihn
 *   Formularze dodawania               Knoten dieses Rodzaj fallen weg; ohne Eintragsknoten: gelöscht
 *   Zbiory                             die gelöschten Einträge fallen heraus
 * </code>
 *
 * Reine Rechnung — `CogitaLibrary.removeKind` führt sie aus.
 */

import { readAddForm } from './addForm';
import type { GraphNode } from './graph';
import { fieldsOf, refIndex, valuesOf, type Entity, type KindDef, type Lookup } from './schema';

export interface DocEntry {
  readonly id: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface EntityChange {
  readonly id: string;
  readonly kinds: readonly string[];
  readonly data: Readonly<Record<string, unknown>>;
}

export interface DocChange {
  readonly id: string;
  /** `null`: das Dokument wird gelöscht. */
  readonly data: Readonly<Record<string, unknown>> | null;
}

export interface KindRemoval {
  readonly kind: KindDef;
  /** Warum es hier nicht geht — `null`: es geht. */
  readonly blocked: string | null;
  /** Eigene Einträge nur dieses Rodzaj — sie werden gelöscht. */
  readonly remove: readonly string[];
  /** Eigene Einträge mit noch einem Rodzaj — sie verlieren nur diesen. */
  readonly narrow: readonly EntityChange[];
  /** Einträge dieses Rodzaj aus Quellen — sie bleiben. */
  readonly foreign: number;
  /** Eigene Einträge, aus denen Verweise auf die gelöschten herausgenommen werden. */
  readonly unlink: readonly EntityChange[];
  /** Eigene Rodzaje, deren Verweisfelder auf ihn zeigen. */
  readonly kinds: readonly KindDef[];
  readonly templates: readonly DocChange[];
  readonly forms: readonly DocChange[];
  readonly collections: readonly DocChange[];
  /** Was der Rückfrage gesagt wird. */
  readonly lines: readonly string[];
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const isEnvelope = (v: unknown): v is { value: unknown } => typeof v === 'object' && v !== null && !Array.isArray(v) && 'value' in v;

/** Die Daten ohne Verweise auf `gone` — `null`: es gab keine. */
export function withoutRefs(entity: Entity, look: Pick<Lookup, 'kind'>, gone: ReadonlySet<string>): Record<string, unknown> | null {
  const data: Record<string, unknown> = { ...entity.data };
  let changed = false;
  for (const field of fieldsOf(entity, look)) {
    if (field.type !== 'ref') continue;
    const raw = data[field.key];
    if (raw === undefined || raw === null) continue;
    const list = Array.isArray(raw) ? raw : [raw];
    const kept = list.filter((one) => !gone.has(String(isEnvelope(one) ? one.value : one)));
    if (kept.length === list.length) continue;
    changed = true;
    if (kept.length === 0) delete data[field.key];
    else data[field.key] = Array.isArray(raw) ? kept : kept[0];
  }
  return changed ? data : null;
}

const count = (n: number, one: string, few: string, many: string): string => {
  const last = n % 10;
  const teen = n % 100 >= 12 && n % 100 <= 14;
  return `${n} ${n === 1 ? one : !teen && last >= 2 && last <= 4 ? few : many}`;
};

export function planKindRemoval(input: {
  readonly kind: KindDef;
  readonly isBase: boolean;
  readonly kinds: readonly KindDef[];
  readonly entities: readonly Entity[];
  readonly look: Lookup;
  readonly isOwn: (id: string) => boolean;
  readonly templates: readonly DocEntry[];
  readonly forms: readonly DocEntry[];
  readonly collections: readonly DocEntry[];
}): KindRemoval {
  const { kind, isBase, look, isOwn } = input;
  const id = kind.id;
  const empty: KindRemoval = { kind, blocked: null, remove: [], narrow: [], foreign: 0, unlink: [], kinds: [], templates: [], forms: [], collections: [], lines: [] };
  if (!isBase && !isOwn(id)) {
    return { ...empty, blocked: `Rodzaj „${kind.name}” pochodzi z innej bazy wiedzy (źródła) — usuń go tam albo odłącz to źródło w Ustawieniach.` };
  }

  const of = input.entities.filter((e) => e.kinds.includes(id));
  const own = of.filter((e) => isOwn(e.id));
  const remove = own.filter((e) => e.kinds.length === 1).map((e) => e.id);
  const narrow = own.filter((e) => e.kinds.length > 1).map((e): EntityChange => ({ id: e.id, kinds: e.kinds.filter((k) => k !== id), data: e.data }));
  const gone = new Set(remove);

  /* Wer auf die Gelöschten zeigt (und selbst bleibt und hierher gehört), verliert diese Verweise. */
  const index = refIndex(input.entities, look);
  const pointing = new Set<string>();
  for (const target of gone) for (const back of index.get(target) ?? []) if (!gone.has(back.from) && isOwn(back.from)) pointing.add(back.from);
  const unlink: EntityChange[] = [];
  for (const from of pointing) {
    const e = look.entity(from);
    if (e === undefined) continue;
    const data = withoutRefs(e, look, gone);
    if (data !== null) unlink.push({ id: e.id, kinds: narrow.find((n) => n.id === e.id)?.kinds ?? e.kinds, data });
  }
  /* Wer nur seinen Rodzaj verliert und auch Verweise, bekommt beides in EINEM Speichern. */
  const narrowed = narrow.filter((n) => !unlink.some((u) => u.id === n.id));

  /* Verweisfelder eigener Rodzaje, die auf ihn zeigen. */
  const kinds: KindDef[] = [];
  const fieldLines: string[] = [];
  for (const k of input.kinds) {
    if (k.id === id || !isOwn(k.id)) continue;
    let touched = false;
    const fields = k.fields.flatMap((f) => {
      if (f.type !== 'ref' || f.to === undefined || !f.to.includes(id)) return [f];
      touched = true;
      if (f.to.length === 1) { fieldLines.push(`pole „${f.label}” w „${k.name}” zostanie usunięte`); return []; }
      fieldLines.push(`pole „${f.label}” w „${k.name}” przestanie wskazywać na „${kind.name}”`);
      return [{ ...f, to: f.to.filter((t) => t !== id) }];
    });
    if (touched) kinds.push({ ...k, fields });
  }

  const name = (d: DocEntry, fallback: string) => (typeof d.data.name === 'string' && d.data.name.trim() !== '' ? d.data.name : fallback);
  const templates: DocChange[] = [];
  const templateDropped: string[] = [];
  const templateNarrowed: string[] = [];
  for (const t of input.templates) {
    if (!isOwn(t.id)) continue;
    const ks = strings(t.data.kinds);
    if (!ks.includes(id)) continue;
    if (ks.length === 1) { templates.push({ id: t.id, data: null }); templateDropped.push(name(t, 'Szablon')); }
    else { templates.push({ id: t.id, data: { ...t.data, kinds: ks.filter((k) => k !== id) } }); templateNarrowed.push(name(t, 'Szablon')); }
  }

  const forms: DocChange[] = [];
  const formDropped: string[] = [];
  const formNarrowed: string[] = [];
  for (const f of input.forms) {
    if (!isOwn(f.id)) continue;
    const form = readAddForm(f.id, f.data);
    const uses = (n: GraphNode) => n.config.kind === id || strings(n.config.kinds).includes(id);
    if (!form.graph.nodes.some(uses)) continue;
    const nodes = form.graph.nodes.filter((n) => !uses(n));
    if (!nodes.some((n) => n.type === 'entry')) { forms.push({ id: f.id, data: null }); formDropped.push(form.name); continue; }
    const keep = new Set(nodes.map((n) => n.id));
    const graph = { nodes, edges: form.graph.edges.filter((e) => keep.has(e.from) && keep.has(e.to)) };
    const raw = f.data.graph;
    const order = strings(f.data.order).filter((x) => keep.has(x));
    forms.push({ id: f.id, data: { ...f.data, graph: { ...(typeof raw === 'object' && raw !== null ? raw : {}), nodes: graph.nodes, edges: graph.edges }, ...(f.data.order === undefined ? {} : { order }) } });
    formNarrowed.push(form.name);
  }

  const collections: DocChange[] = [];
  for (const c of input.collections) {
    if (!isOwn(c.id)) continue;
    const list = strings(c.data.list);
    const kept = list.filter((x) => !gone.has(x));
    if (kept.length !== list.length) collections.push({ id: c.id, data: { ...c.data, list: kept } });
  }

  const foreign = of.length - own.length;
  const lines = [
    isBase ? `Rodzaj „${kind.name}” zniknie z tej bazy wiedzy — gotowy można później dodać z powrotem („+ Rodzaj”).` : `Rodzaj „${kind.name}” zniknie ze schematu.`,
    remove.length > 0 ? `${count(remove.length, 'wpis tego rodzaju zostanie usunięty', 'wpisy tego rodzaju zostaną usunięte', 'wpisów tego rodzaju zostanie usuniętych')} — razem z postępami ich kart.` : 'Nie ma wpisów tego rodzaju do usunięcia.',
    narrow.length > 0 ? `${count(narrow.length, 'wpis ma', 'wpisy mają', 'wpisów ma')} też inny rodzaj — zostaną, bez „${kind.name}”.` : '',
    foreign > 0 ? `${count(foreign, 'wpis pochodzi', 'wpisy pochodzą', 'wpisów pochodzi')} z innych baz wiedzy — tam zostaną.` : '',
    unlink.length > 0 ? `${count(unlink.length, 'inny wpis odwołuje', 'inne wpisy odwołują', 'innych wpisów odwołuje')} się do usuwanych — te odwołania zostaną z nich wyjęte.` : '',
    ...fieldLines.map((l) => `Schemat: ${l}.`),
    templateDropped.length > 0 ? `Szablony kart do usunięcia: ${templateDropped.map((n) => `„${n}”`).join(', ')}.` : '',
    templateNarrowed.length > 0 ? `Szablony kart, które przestaną dotyczyć „${kind.name}”: ${templateNarrowed.map((n) => `„${n}”`).join(', ')}.` : '',
    formDropped.length > 0 ? `Formularze dodawania do usunięcia: ${formDropped.map((n) => `„${n}”`).join(', ')}.` : '',
    formNarrowed.length > 0 ? `Formularze dodawania bez kroków tego rodzaju: ${formNarrowed.map((n) => `„${n}”`).join(', ')}.` : '',
    collections.length > 0 ? `${count(collections.length, 'zbiór straci', 'zbiory stracą', 'zbiorów straci')} usuwane wpisy.` : ''
  ].filter((l) => l !== '');
  return { kind, blocked: null, remove, narrow: narrowed, foreign, unlink, kinds, templates, forms, collections, lines };
}

/** Wie viele Verweise ein Eintrag auf einen der gegebenen hat — für Tests und Anzeigen. */
export const refsTo = (entity: Entity, look: Pick<Lookup, 'kind'>, ids: ReadonlySet<string>): number =>
  fieldsOf(entity, look).filter((f) => f.type === 'ref').reduce((n, f) => n + valuesOf(entity, f).filter((v) => typeof v.value === 'string' && ids.has(v.value)).length, 0);
