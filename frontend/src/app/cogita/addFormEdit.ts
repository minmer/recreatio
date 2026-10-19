/**
 * COGITA — VORHANDENES IM FORMULAR BEARBEITEN (COGITA.md §2.4), 2026-10-17.
 *
 * Ein Formularz dodawania legt an; dieselbe Gestalt zeigt auch, was schon da
 * ist: je Zeile der Eintrag, der sie zusammenhält (eine Übersetzung), und in
 * den Spalten seine Einträge (die Wörter je Sprache) — dazu leere Stellen, wo
 * etwas fehlen darf. Man ändert, fügt hinzu, nimmt heraus, löscht Zeilen, und
 * EIN Knopf speichert alles.
 *
 * <b>Welche Spalte.</b> Ein Wort gehört in die Spalte, deren Knoten es so
 * gemacht hätte: derselbe Rodzaj, und was oben gewählt oder fest ist (die
 * Sprache, das Thema), hat es auch. Die Wahl oben ist damit zugleich der
 * Filter: Englisch–Polnisch zeigt keine deutschen Zeilen.
 *
 * <b>Was nicht in eine Spalte passt</b> (ein viertes Wort in einer Sprache,
 * die das Formular nicht kennt), bleibt am Eintrag, wie es war — gezeigt wird
 * es nicht, verloren geht es nicht.
 */

import {
  entryConfig, groupsOf, isTypeable, pickConfig, planForm, refFields, typedValue,
  type AddForm, type FormGroup, type PlanCtx, type PlannedEntry, type RowInput, type TopChoice
} from './addForm';
import type { GraphNode } from './graph';
import { rangeText, valuesOf, type Entity, type FieldDef, type GeoPoint, type Lookup, type RangeValue } from './schema';

/* -- Vorhandenes als Zeilen ------------------------------------------------------------------ */

export interface EditValue {
  /** Der Eintrag — fehlt: ein neuer, erst getippt. */
  readonly id?: string;
  /** Je getipptem Feld der Text. */
  readonly texts: Readonly<Record<string, string>>;
}

export interface EditRow {
  /** Woran die Zeile hängt: der verbindende Eintrag — oder, ohne einen solchen, der Eintrag selbst. */
  readonly key: string;
  /** Der verbindende Eintrag (eine Übersetzung); `null`: das Formular hat keinen. */
  readonly root: string | null;
  readonly cells: Readonly<Record<string, readonly EditValue[]>>;
}

export interface EditShape {
  readonly rows: readonly EditRow[];
  /** Der Knoten des verbindenden Eintrags. */
  readonly root: string | null;
  /** Warum nicht alles gezeigt wird. */
  readonly note?: string;
}

const norm = (v: unknown): string =>
  typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v);

/** Der Wert eines Feldes als Text, wie man ihn tippt — der Weg zurück von `typedValue`. */
export function textOf(field: FieldDef, entity: Entity): string {
  const one = (v: unknown): string => {
    if (field.type === 'bool') return v === true ? 'tak' : v === false ? 'nie' : 'nie wiadomo';
    if (field.type === 'list' && Array.isArray(v)) return v.join('; ');
    if (field.type === 'geo' && typeof v === 'object' && v !== null) return `${(v as GeoPoint).lat}, ${(v as GeoPoint).lon}`;
    if (field.type === 'range' && typeof v === 'object' && v !== null) return rangeText(v as RangeValue, field.rangeOf ?? 'number');
    if (typeof v === 'number') return String(v).replace('.', ',');
    return typeof v === 'string' ? v : JSON.stringify(v);
  };
  return valuesOf(entity, field).map((v) => v.value).filter((v) => v !== null).map(one).join('; ');
}

/**
 * DER EINTRAG, DER EINE ZEILE HÄLT: einer, in den getippte Einträge führen und
 * der selbst in keinen anderen führt (die Übersetzung). `null`: das Formular
 * hat keinen — dann ist jede Zeile ein Eintrag der ersten Spalte.
 */
export function rootOf(form: AddForm, look: Pick<Lookup, 'kind'>): string | null {
  const typed = new Set(groupsOf(form, look).map((g) => g.node));
  const entries = form.graph.nodes.filter((n) => n.type === 'entry');
  const linking = entries.filter((n) =>
    !form.graph.edges.some((e) => e.from === n.id && entries.some((m) => m.id === e.to))
    && form.graph.edges.some((e) => e.to === n.id && typed.has(e.from) && e.from !== n.id));
  return linking[0]?.id ?? null;
}

/**
 * Ob der verbindende Eintrag aus dieser Spalte MEHRERE nimmt (die Słowa einer
 * Grupa) — oder genau einen (das „Z" einer Übersetzung: wer dort ein zweites
 * Wort will, legt eine zweite Übersetzung an, beim Hinzufügen).
 */
export function takesMany(form: AddForm, look: Pick<Lookup, 'kind'>, root: string | null, node: string): boolean {
  const rootNode = root === null ? undefined : form.graph.nodes.find((n) => n.id === root);
  const kind = rootNode === undefined ? undefined : look.kind(entryConfig(rootNode.config).kind);
  if (kind === undefined) return false;
  return form.graph.edges.some((e) => e.from === node && e.to === root && refFields(kind).some((f) => f.key === e.in && f.multi));
}

interface Constraint { readonly field: FieldDef; readonly values: readonly unknown[] }

/** Was ein Eintrag haben muss, um in die Spalte dieses Knotens zu gehören: die Wahlen oben, die festen und oben gesetzten Werte. */
function constraintsOf(form: AddForm, node: GraphNode, look: Pick<Lookup, 'kind'>, top: TopChoice): Constraint[] {
  const c = entryConfig(node.config);
  const kind = look.kind(c.kind);
  if (kind === undefined) return [];
  const out: Constraint[] = [];
  for (const f of refFields(kind)) {
    const chosen = form.graph.edges.filter((e) => e.to === node.id && e.in === f.key)
      .map((e) => form.graph.nodes.find((n) => n.id === e.from))
      .filter((n): n is GraphNode => n?.type === 'pick')
      .flatMap((p) => top.picks[p.id] ?? pickConfig(p.config).value);
    if (chosen.length > 0) out.push({ field: f, values: chosen });
  }
  for (const f of kind.fields) {
    const source = c.fields[f.key];
    if (source === undefined || source.from === 'type' || !isTypeable(f)) continue;
    const text = (source.from === 'ask' ? top.asks[`${node.id}.${f.key}`] ?? source.value : source.value) ?? '';
    if (text.trim() === '') continue;
    const v = typedValue(f, text);
    if ('value' in v) out.push({ field: f, values: Array.isArray(v.value) && f.type !== 'list' ? v.value : [v.value] });
  }
  return out;
}

const belongs = (entity: Entity, kind: string, constraints: readonly Constraint[]): boolean =>
  entity.kinds.includes(kind) && constraints.every(({ field, values }) => {
    const have = new Set(valuesOf(entity, field).map((v) => norm(v.value)));
    return values.every((v) => have.has(norm(v)));
  });

/** Mit Rodzaj zur Wahl (Psalm oder Pieśń): das Feld, das dieser Eintrag getippt bekam — unter dem Schlüssel der Spalte. */
const fieldsFor = (group: FormGroup, entity: Entity | undefined): { key: string; field: FieldDef }[] => {
  const ch = group.choices === undefined || entity === undefined ? undefined : group.choices.find((x) => entity.kinds.includes(x.kind.id));
  return ch === undefined ? group.fields.map((f) => ({ key: f.key, field: f })) : [{ key: group.fields[0].key, field: ch.field }];
};

const textsOf = (group: FormGroup, entity: Entity): Record<string, string> => {
  const texts: Record<string, string> = Object.fromEntries(fieldsFor(group, entity).map(({ key, field }) => [key, textOf(field, entity)]));
  const ch = group.choices?.find((x) => entity.kinds.includes(x.kind.id));
  return ch === undefined ? texts : { ...texts, _kind: ch.kind.id };
};

/** Gehört ein Eintrag in die Spalte dieser Gruppe — auch als einer der wählbaren Rodzaje? */
const fitsGroup = (g: FormGroup, e: Entity, constraints: readonly Constraint[]): boolean =>
  belongs(e, g.kind.id, constraints) || (g.choices ?? []).slice(1).some((ch) => e.kinds.includes(ch.kind.id));

/**
 * WAS SCHON DA IST, als Zeilen dieses Formulars — bei dieser Wahl oben. Eine
 * Zeile erscheint, wenn wenigstens eine Spalte etwas hat; ein Feld für EINEN
 * Eintrag, dessen Eintrag nicht in seine Spalte passt (eine andere Sprache),
 * nimmt die ganze Zeile heraus.
 */
export function existingRows(form: AddForm, look: Lookup, pool: (kind: string) => readonly Entity[], top: TopChoice): EditShape {
  const groups = groupsOf(form, look);
  const byId = new Map(form.graph.nodes.map((n) => [n.id, n]));
  const constraints = new Map(groups.map((g) => [g.node, constraintsOf(form, byId.get(g.node)!, look, top)]));
  const first = (row: EditRow): string => {
    for (const g of groups) for (const v of row.cells[g.node] ?? []) for (const t of Object.values(v.texts)) if (t !== '') return t;
    return '';
  };
  const sorted = (rows: EditRow[]) => rows.sort((a, b) => first(a).localeCompare(first(b), 'pl'));
  const root = rootOf(form, look);
  if (root === null) {
    const g = groups[0];
    if (g === undefined) return { rows: [], root: null };
    const rows = pool(g.kind.id).filter((e) => belongs(e, g.kind.id, constraints.get(g.node) ?? []))
      .map((e): EditRow => ({ key: e.id, root: null, cells: { [g.node]: [{ id: e.id, texts: textsOf(g, e) }] } }));
    return {
      rows: sorted(rows), root: null,
      ...(groups.length > 1 ? { note: 'Ten formularz nie ma wpisu, który łączy pola wiersza — edycja pokazuje tylko pierwszą kolumnę.' } : {})
    };
  }
  const rootNode = byId.get(root)!;
  const rootKind = look.kind(entryConfig(rootNode.config).kind);
  if (rootKind === undefined) return { rows: [], root };
  const rootGroup = groups.find((g) => g.node === root);
  const rows: EditRow[] = [];
  for (const entity of pool(rootKind.id)) {
    const cells: Record<string, EditValue[]> = {};
    let fits = true;
    let any = false;
    for (const f of refFields(rootKind)) {
      const sources = groups.filter((g) => g.node !== root && form.graph.edges.some((e) => e.to === root && e.in === f.key && e.from === g.node));
      if (sources.length === 0) continue;
      for (const v of valuesOf(entity, f)) {
        const target = typeof v.value === 'string' ? look.entity(v.value) : undefined;
        if (target === undefined) continue;
        const into = sources.find((g) => fitsGroup(g, target, constraints.get(g.node) ?? []));
        if (into === undefined) { if (!f.multi) fits = false; continue; }
        (cells[into.node] ??= []).push({ id: target.id, texts: textsOf(into, target) });
        any = true;
      }
    }
    if (rootGroup !== undefined) cells[root] = [{ id: entity.id, texts: textsOf(rootGroup, entity) }];
    if (fits && any) rows.push({ key: entity.id, root: entity.id, cells });
  }
  return { rows: sorted(rows), root };
}

/* -- Geändert → gespeichert ---------------------------------------------------------------- */

export interface RowDraft {
  readonly cells: Readonly<Record<string, readonly EditValue[]>>;
  readonly dropped?: boolean;
}

export interface EditPlan {
  /** Geänderte und neue Einträge, geänderte verbindende — wie `planForm` sie gibt. */
  readonly saves: readonly PlannedEntry[];
  /** Was gelöscht wird (Zeilen). */
  readonly drops: readonly string[];
  /** Was nicht geht — die Zeile bleibt dann, wie sie war. */
  readonly problems: readonly string[];
}

const same = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean =>
  Object.keys({ ...a, ...b }).every((k) => (a[k] ?? '').trim() === (b[k] ?? '').trim());

const filled = (v: EditValue): boolean => Object.entries(v.texts).some(([k, t]) => k !== '_kind' && t.trim() !== '');

/** Der Teil des Formulars, der EINEN Knoten macht: er selbst und seine Wahlen oben. */
function alone(form: AddForm, node: string): AddForm {
  const edges = form.graph.edges.filter((e) => e.to === node && form.graph.nodes.find((n) => n.id === e.from)?.type === 'pick');
  const keep = new Set([node, ...edges.map((e) => e.from)]);
  return { ...form, graph: { nodes: form.graph.nodes.filter((n) => keep.has(n.id)), edges } };
}

/**
 * DER PLAN DER ÄNDERUNGEN: geänderte Texte vorhandener Einträge, neue Werte
 * (gefunden oder angelegt wie beim Hinzufügen — samt Sprache und Thema), was
 * aus einer Zeile herausgenommen wird, und gelöschte Zeilen.
 */
export function planEdit(form: AddForm, ctx: PlanCtx, top: TopChoice, shape: EditShape, drafts: Readonly<Record<string, RowDraft>>): EditPlan {
  const { look } = ctx;
  const groups = groupsOf(form, look);
  const saves = new Map<string, PlannedEntry>();
  const drops: string[] = [];
  const problems: string[] = [];
  const label = (row: EditRow) => Object.values(row.cells).flat().flatMap((v) => Object.values(v.texts)).find((t) => t !== '') ?? row.key.slice(-4);

  /* Neue Werte je Knoten auf einmal geplant: zweimal „zamek" in zwei Zeilen ist EIN Wort. */
  const fresh = new Map<string, { row: string; index: number; texts: Readonly<Record<string, string>> }[]>();
  const rowsOk = new Set<string>();
  for (const row of shape.rows) {
    const draft = drafts[row.key];
    if (draft === undefined) continue;
    if (draft.dropped === true) { drops.push(row.key); continue; }
    let ok = true;
    for (const g of groups) {
      for (const v of draft.cells[g.node] ?? []) {
        if (v.id !== undefined && filled(v)) {
          for (const { key, field: f } of fieldsFor(g, look.entity(v.id))) {
            const text = (v.texts[key] ?? '').trim();
            if (text === '') continue;
            const parsed = typedValue(f, text);
            if ('error' in parsed) { problems.push(`„${label(row)}": ${f.label} — ${parsed.error}.`); ok = false; }
          }
        }
      }
    }
    if (!ok) continue;
    rowsOk.add(row.key);
    for (const g of groups) {
      (draft.cells[g.node] ?? []).forEach((v, index) => {
        if (v.id === undefined && filled(v)) fresh.set(g.node, [...(fresh.get(g.node) ?? []), { row: row.key, index, texts: v.texts }]);
      });
    }
  }

  const made = new Map<string, string>();
  for (const [node, list] of fresh) {
    const plan = planForm(alone(form, node), ctx, list.map((one): RowInput => ({ [node]: [one.texts] })), top);
    if (plan.problems.length > 0) { problems.push(...plan.problems); for (const one of list) rowsOk.delete(one.row); continue; }
    plan.rows.forEach((r, i) => {
      if (r.problems.length > 0) { problems.push(...r.problems); rowsOk.delete(list[i].row); return; }
      const id = r.made[0]?.id;
      if (id !== undefined) made.set(`${list[i].row}|${node}|${list[i].index}`, id);
    });
    for (const s of plan.saves) saves.set(s.id, s);
  }

  for (const row of shape.rows) {
    const draft = drafts[row.key];
    if (draft === undefined || draft.dropped === true || !rowsOk.has(row.key)) continue;
    /* Geänderte Texte vorhandener Einträge. */
    for (const g of groups) {
      const before = new Map((row.cells[g.node] ?? []).flatMap((v) => (v.id === undefined ? [] : [[v.id, v.texts] as const])));
      for (const v of draft.cells[g.node] ?? []) {
        if (v.id === undefined || !filled(v)) continue;
        const was = before.get(v.id);
        if (was === undefined || same(was, v.texts)) continue;
        const entity = look.entity(v.id);
        if (entity === undefined || !ctx.isOwn(v.id)) continue;
        const data: Record<string, unknown> = { ...(saves.get(v.id)?.data ?? entity.data) };
        for (const { key, field: f } of fieldsFor(g, entity)) {
          const text = (v.texts[key] ?? '').trim();
          if (text === '') { delete data[f.key]; continue; }
          const parsed = typedValue(f, text);
          if ('value' in parsed) data[f.key] = parsed.value;
        }
        saves.set(v.id, { id: v.id, kinds: entity.kinds, data, isNew: false, node: g.node, depth: 1 });
      }
    }
    /* Der verbindende Eintrag: herausgenommen, dazugekommen. */
    if (row.root === null) continue;
    const root = look.entity(row.root);
    const rootNode = shape.root === null ? undefined : form.graph.nodes.find((n) => n.id === shape.root);
    const rootKind = rootNode === undefined ? undefined : look.kind(entryConfig(rootNode.config).kind);
    if (root === undefined || rootKind === undefined || !ctx.isOwn(root.id)) continue;
    const data: Record<string, unknown> = { ...(saves.get(root.id)?.data ?? root.data) };
    let changed = false;
    for (const f of refFields(rootKind)) {
      const sources = groups.filter((g) => g.node !== shape.root && form.graph.edges.some((e) => e.to === shape.root && e.in === f.key && e.from === g.node));
      if (sources.length === 0) continue;
      const removed = new Set<string>();
      const added: string[] = [];
      for (const g of sources) {
        const kept = new Set((draft.cells[g.node] ?? []).filter((v) => v.id !== undefined && filled(v)).map((v) => v.id!));
        for (const v of row.cells[g.node] ?? []) if (v.id !== undefined && !kept.has(v.id)) removed.add(v.id);
        (draft.cells[g.node] ?? []).forEach((v, index) => {
          const id = v.id === undefined ? made.get(`${row.key}|${g.node}|${index}`) : undefined;
          if (id !== undefined) added.push(id);
        });
      }
      if (removed.size === 0 && added.length === 0) continue;
      const before = valuesOf(root, f).map((v) => v.value).filter((v): v is string => typeof v === 'string');
      const after = [...before.filter((id) => !removed.has(id)), ...added.filter((id) => !before.includes(id))];
      /* Ein Feld für EINEN Eintrag bleibt nicht leer: wer ihn nicht mehr will, löscht die ganze Zeile. */
      if (!f.multi && after.length === 0) { problems.push(`„${label(row)}": ${f.label} nie może zostać puste — usuń cały wiersz.`); continue; }
      if (f.multi) data[f.key] = [...new Set(after)];
      else if (after.length > 0) data[f.key] = after[after.length - 1];
      else delete data[f.key];
      changed = true;
    }
    if (changed) saves.set(root.id, { id: root.id, kinds: root.kinds, data, isNew: false, node: shape.root!, depth: 2 });
  }

  return { saves: [...saves.values()].sort((a, b) => a.depth - b.depth), drops, problems };
}
