/**
 * 2026-10-25 — WAS EIN IMPORT ÄNDERT, EINZELN: jede Änderung an etwas, das es schon gibt (ein Feld eines
 * Eintrags, ein Teil eines Dokuments, ein Rodzaj), und jedes Neue — und was der Besitzer davon annimmt.
 * Ein Dokument kommt von der eigenen KI oder ist von Hand geschrieben: was an Bestehendem geändert würde,
 * gilt erst, wenn es angenommen ist; der vorgeschlagene Wert lässt sich vorher ändern („die Änderung
 * ändern"). Neues ist vorgeschlagen angenommen und lässt sich abwählen.
 *
 * <code>
 *   changesOf(lib, plan)             die Liste der Änderungen eines Plans
 *   defaultDecisions(changes)        Neues an, Änderungen an Bestehendem aus
 *   decidedPlan(lib, plan, …)        der Plan mit nur dem Angenommenen (und den geänderten Werten)
 * </code>
 *
 * Nichts davon speichert; `applyImport` schreibt den entschiedenen Plan.
 */

import { blockPlain, blocksIn, type CommentBlock } from '../library/blocks';
import { DOC_KINDS, DOC_LABEL, kindDoc } from './kinds';
import type { ImportPlan } from './json';
import { fieldsOf, fieldText, labelOf, type Entity, type FieldDef, type KindDef, type Lookup } from './schema';
import type { CogitaLibrary } from './store';

/** Was geändert wird: ein Eintrag (ein Feld, seine Rodzaje), ein Dokument (ein Schlüssel), ein Rodzaj (als Ganzes). */
export interface ImportChange {
  /** Fest je Änderung: `e:<id>`, `e:<id>:<feld>`, `e:<id>:#kinds`, `d:<id>`, `d:<id>:<schlüssel>`, `k:<id>`. */
  readonly id: string;
  readonly target: 'entity' | 'doc' | 'kind';
  readonly targetId: string;
  /** Etwas Neues (als Ganzes anzunehmen oder nicht). */
  readonly isNew: boolean;
  /** Wie der Eintrag (das Dokument, der Rodzaj) heisst. */
  readonly title: string;
  /** Das Feld (der Schlüssel) — bei Neuem und bei einem Rodzaj leer. */
  readonly field?: string;
  readonly fieldLabel?: string;
  /** Vorher und nachher in Worten (für die Liste). */
  readonly beforeText: string;
  readonly afterText: string;
  /** Der vorgeschlagene Wert (`undefined`: das Feld wird entfernt). */
  readonly after?: unknown;
  /** Wie sich der vorgeschlagene Wert ändern lässt: als Text, als Absätze, als JSON — oder gar nicht. */
  readonly edit: 'text' | 'number' | 'blocks' | 'json' | null;
}

export interface Decisions {
  readonly accepted: ReadonlySet<string>;
  /** Geänderte Vorschläge: der Text (für `blocks`: Absätze, getrennt durch eine Leerzeile; für `json`: JSON). */
  readonly edited: ReadonlyMap<string, string>;
}

/* -- Gleich oder nicht ------------------------------------------------------------------------- */

/** JSON mit geordneten Schlüsseln — `{value, locator}` und `{locator, value}` sind dasselbe. */
const canon = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (typeof v === 'object' && v !== null) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
};
const same = (a: unknown, b: unknown): boolean => canon(a) === canon(b);
const plainKeys = (data: Readonly<Record<string, unknown>>): string[] => Object.keys(data).filter((k) => !k.startsWith('_'));

/* -- In Worten ------------------------------------------------------------------------------------ */

const clip = (text: string, n = 600) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text);

/** Ein Wert eines Feldes in Worten: Absätze ganz, Verweise mit ihren Namen und Stellen, sonst wie im Eintrag. */
function valueWords(field: FieldDef | undefined, value: unknown, look: Lookup): string {
  if (value === undefined) return '—';
  if (field?.type === 'blocks') {
    const label = (ref: string, locator: string) => { const t = look.entity(ref); return [t === undefined ? ref : labelOf(t, look), locator].filter(Boolean).join(', '); };
    return clip(blocksIn(value).map((b: CommentBlock) => blockPlain(b, label)).filter(Boolean).join('\n')) || '—';
  }
  if (field !== undefined) {
    const text = fieldText({ id: '', kinds: [], data: { [field.key]: value } }, field, look);
    if (text !== '') return clip(text);
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return clip(String(value));
  return clip(JSON.stringify(value));
}

/** Wie ein vorgeschlagener Wert zu ändern ist. */
function editOf(field: FieldDef | undefined, value: unknown): ImportChange['edit'] {
  if (value === undefined) return null;
  if (field?.type === 'blocks') return blocksIn(value).every((b) => b.type === 'paragraph') ? 'blocks' : 'json';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string' && field?.type !== 'ref' && field?.type !== 'choice') return 'text';
  return 'json';
}

/** Der Text, mit dem das Ändern eines Vorschlags beginnt. */
export function editText(change: ImportChange): string {
  const v = change.after;
  if (change.edit === 'blocks') return blocksIn(v).map((b) => (b.type === 'paragraph' ? b.text : '')).join('\n\n');
  if (change.edit === 'text') return typeof v === 'string' ? v : '';
  if (change.edit === 'number') return typeof v === 'number' ? String(v) : '';
  return JSON.stringify(v, null, 2) ?? '';
}

/** Aus dem geänderten Text der Wert — oder ein Fehler, wenn er sich nicht lesen lässt. */
export function editedValue(change: ImportChange, text: string): { value: unknown } | { error: string } {
  if (change.edit === 'blocks') {
    const paragraphs = text.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);
    return { value: paragraphs.map((t) => ({ type: 'paragraph', text: t })) };
  }
  if (change.edit === 'text') return { value: text };
  if (change.edit === 'number') {
    const n = Number(text.replace(',', '.'));
    return Number.isFinite(n) ? { value: n } : { error: 'To nie jest liczba.' };
  }
  try { return { value: JSON.parse(text) as unknown }; } catch { return { error: 'To nie jest poprawny JSON.' }; }
}

/* -- Die Liste ----------------------------------------------------------------------------------- */

/** Wie die geplanten Einträge und Rodzaje gelesen werden — die neue Fassung vor der alten. */
function plannedLook(lib: CogitaLibrary, plan: ImportPlan): Lookup {
  const entities = new Map(plan.entities.map((e) => [e.id, { id: e.id, kinds: e.kinds, data: e.data } as Entity]));
  const kinds = new Map(plan.kinds.map((k) => [k.id, k.def]));
  return { kind: (id) => kinds.get(id) ?? lib.kind(id), entity: (id) => entities.get(id) ?? lib.entity(id) };
}

const DOC_KEY_LABEL: Readonly<Record<string, string>> = {
  name: 'Nazwa', steps: 'Kroki', mode: 'Układ', outline: 'Struktura', columns: 'Kolumny', group: 'Grupowanie', matrix: 'Macierz', sort: 'Sortowanie',
  graph: 'Graf', kinds: 'Rodzaje', direction: 'Kierunek', says: 'Opis', keys: 'Klawisze', paste: 'Wklejanie', order: 'Kolejność',
  work: 'Dzieło', locator: 'Miejsca', entry: 'Wpis', view: 'Sposób wyświetlania', note: 'Uwaga', query: 'Szukane', list: 'Lista', rule: 'Reguła'
};

/** Was an einem Rodzaj anders wird — in einer Zeile. */
function kindChange(before: KindDef, after: KindDef): string {
  const out: string[] = [];
  if (before.name !== after.name) out.push(`nazwa „${before.name}” → „${after.name}”`);
  if (before.label !== after.label) out.push(`wzór etykiety „${before.label}” → „${after.label}”`);
  const old = new Map(before.fields.map((f) => [f.key, f]));
  const added = after.fields.filter((f) => !old.has(f.key)).map((f) => f.label);
  const changed = after.fields.filter((f) => old.has(f.key) && !same(kindDoc({ ...before, fields: [old.get(f.key)!] }).fields, kindDoc({ ...after, fields: [f] }).fields)).map((f) => f.label);
  if (added.length > 0) out.push(`nowe pola: ${added.join(', ')}`);
  if (changed.length > 0) out.push(`zmienione pola: ${changed.join(', ')}`);
  if (before.fields.map((f) => f.key).join() !== after.fields.map((f) => f.key).join() && added.length === 0) out.push('inna kolejność pól');
  if (before.tells !== after.tells) out.push(`pole odróżniające „${before.tells ?? '—'}” → „${after.tells ?? '—'}”`);
  if (before.system !== after.system) out.push('inna stała rola');
  if ((before.reading ?? '') !== (after.reading ?? '')) out.push(after.reading === undefined ? 'bez wzoru tekstu do czytania' : 'inny wzór tekstu do czytania');
  return out.join('; ');
}

/** DIE ÄNDERUNGEN EINES PLANS, in der Reihenfolge: Rodzaje, Einträge, Dokumente; Neues zuerst je Gruppe. */
export function changesOf(lib: CogitaLibrary, plan: ImportPlan): ImportChange[] {
  const look = plannedLook(lib, plan);
  const out: ImportChange[] = [];

  for (const k of plan.kinds) {
    if (k.isNew) { out.push({ id: `k:${k.id}`, target: 'kind', targetId: k.id, isNew: true, title: `Rodzaj „${k.def.name}”`, beforeText: '', afterText: k.def.fields.map((f) => f.label).join(', '), edit: null }); continue; }
    const before = lib.kind(k.id);
    if (before === undefined || same(kindDoc(before), kindDoc(k.def))) continue;
    out.push({ id: `k:${k.id}`, target: 'kind', targetId: k.id, isNew: false, title: `Rodzaj „${before.name}”`, beforeText: '', afterText: kindChange(before, k.def), edit: null });
  }

  for (const e of plan.entities) {
    const planned: Entity = { id: e.id, kinds: e.kinds, data: e.data };
    const title = labelOf(planned, look) || e.id;
    if (e.isNew) { out.push({ id: `e:${e.id}`, target: 'entity', targetId: e.id, isNew: true, title, beforeText: '', afterText: '', edit: null }); continue; }
    const before = lib.entity(e.id);
    if (before === undefined) continue;
    const fields = new Map([...fieldsOf(before, look), ...fieldsOf(planned, look)].map((f) => [f.key, f]));
    const keys = [...new Set([...plainKeys(before.data), ...plainKeys(e.data)])];
    for (const key of keys) {
      const was = before.data[key];
      const now = e.data[key];
      if (same(was, now) || (was === undefined && now === undefined)) continue;
      const field = fields.get(key);
      out.push({
        id: `e:${e.id}:${key}`, target: 'entity', targetId: e.id, isNew: false, title, field: key, fieldLabel: field?.label ?? key,
        beforeText: valueWords(field, was, look), afterText: now === undefined ? '(pole usunięte)' : valueWords(field, now, look),
        ...(now === undefined ? {} : { after: now }), edit: editOf(field, now)
      });
    }
    if (!same(before.kinds, e.kinds)) {
      const name = (ids: readonly string[]) => ids.map((k) => look.kind(k)?.name ?? k).join(', ');
      out.push({ id: `e:${e.id}:#kinds`, target: 'entity', targetId: e.id, isNew: false, title, field: '#kinds', fieldLabel: 'Rodzaje', beforeText: name(before.kinds), afterText: name(e.kinds), after: e.kinds, edit: null });
    }
  }

  for (const d of plan.docs) {
    const title = `${DOC_LABEL[d.kind]} „${typeof d.data.name === 'string' && d.data.name !== '' ? d.data.name : '—'}”`;
    if (d.isNew) { out.push({ id: `d:${d.id}`, target: 'doc', targetId: d.id, isNew: true, title, beforeText: '', afterText: '', edit: null }); continue; }
    const before = DOC_KINDS.flatMap((k) => lib.docs(k)).find((x) => x.id === d.id);
    if (before === undefined) continue;
    for (const key of [...new Set([...plainKeys(before.data), ...plainKeys(d.data)])]) {
      const was = before.data[key];
      const now = d.data[key];
      if (same(was, now)) continue;
      const words = (v: unknown) => (v === undefined ? '—' : typeof v === 'string' || typeof v === 'number' ? clip(String(v)) : clip(JSON.stringify(v), 300));
      out.push({
        id: `d:${d.id}:${key}`, target: 'doc', targetId: d.id, isNew: false, title, field: key, fieldLabel: DOC_KEY_LABEL[key] ?? key,
        beforeText: words(was), afterText: now === undefined ? '(usunięte)' : words(now), ...(now === undefined ? {} : { after: now }),
        edit: now === undefined ? null : typeof now === 'string' ? 'text' : 'json'
      });
    }
  }
  return out;
}

/** Vorgeschlagen: alles Neue an, jede Änderung an Bestehendem aus — sie wird erst angenommen. */
export function defaultDecisions(changes: readonly ImportChange[]): Decisions {
  return { accepted: new Set(changes.filter((c) => c.isNew).map((c) => c.id)), edited: new Map() };
}

/* -- Der entschiedene Plan ------------------------------------------------------------------------- */

/** Verweise auf Abgelehntes aus den Daten nehmen — sonst zeigte ein angenommener Eintrag ins Leere. */
function without(value: unknown, gone: ReadonlySet<string>): unknown {
  if (gone.size === 0) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return gone.has(v) ? undefined : v;
    if (Array.isArray(v)) return v.map(walk).filter((x) => x !== undefined);
    if (typeof v === 'object' && v !== null) {
      const o = v as Record<string, unknown>;
      if (typeof o.value === 'string' && gone.has(o.value)) return undefined;
      return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, walk(x)]).filter(([, x]) => x !== undefined));
    }
    return v;
  };
  return walk(value);
}

/**
 * DER PLAN MIT NUR DEM ANGENOMMENEN: Neues, das angenommen ist (abgelehntes fällt weg, und was darauf
 * zeigte, zeigt nicht mehr darauf); an Bestehendem nur die angenommenen Felder, mit dem geänderten Wert,
 * wo der Besitzer ihn geändert hat; ein Bestehendes ohne angenommene Änderung wird nicht gespeichert.
 * `invalid`: Änderungen, deren geänderter Wert sich nicht lesen lässt (sie bleiben aus).
 */
export function decidedPlan(lib: CogitaLibrary, plan: ImportPlan, changes: readonly ImportChange[], decisions: Decisions): { plan: ImportPlan; invalid: string[] } {
  const ok = (id: string) => decisions.accepted.has(id);
  const invalid: string[] = [];
  const valueOf = (c: ImportChange): { value: unknown } | null => {
    const text = decisions.edited.get(c.id);
    if (text === undefined) return { value: c.after };
    const read = editedValue(c, text);
    if ('error' in read) { invalid.push(`${c.title} — ${c.fieldLabel ?? ''}: ${read.error}`); return null; }
    return read;
  };
  const byTarget = new Map<string, ImportChange[]>();
  for (const c of changes) if (!c.isNew) byTarget.set(c.targetId, [...(byTarget.get(c.targetId) ?? []), c]);

  /* Was als Neues abgelehnt ist — darauf darf nichts Angenommenes mehr zeigen. */
  const gone = new Set(changes.filter((c) => c.isNew && !ok(c.id)).map((c) => c.targetId));

  /* Ein Rodzaj, dessen Änderung nicht angenommen ist, der aber seinen bleibenden Namen bekommt (`_ref`), wird in seiner alten Gestalt gespeichert — das ist Buchhaltung, kein Inhalt. */
  const kinds: ImportPlan['kinds'] = plan.kinds.flatMap((k) => {
    if (ok(`k:${k.id}`)) return [k];
    const before = lib.kind(k.id);
    if (!k.isNew && k.marks !== undefined && before !== undefined) return [{ ...k, def: before }];
    return [];
  });
  const lostKinds = new Set(plan.kinds.filter((k) => k.isNew && !ok(`k:${k.id}`)).map((k) => k.id));

  const entities: ImportPlan['entities'] = [];
  for (const e of plan.entities) {
    if (e.isNew) {
      if (!ok(`e:${e.id}`)) continue;
      const kept = e.kinds.filter((k) => !lostKinds.has(k));
      if (kept.length === 0) { gone.add(e.id); continue; }
      entities.push({ ...e, kinds: kept });
      continue;
    }
    const before = lib.entity(e.id);
    if (before === undefined) continue;
    const mine = (byTarget.get(e.id) ?? []).filter((c) => ok(c.id));
    if (mine.length === 0) {
      /* Nur der bleibende Name kommt dazu (ein Eintrag, der ihn noch nicht trug): Buchhaltung, ohne Frage. */
      const stamp = e.marks?._ref;
      if (typeof stamp === 'string' && lib.entry(e.id)?.data._ref !== stamp) entities.push({ ...e, kinds: [...before.kinds], data: { ...before.data }, marks: { _ref: stamp } });
      continue;
    }
    const data: Record<string, unknown> = { ...before.data };
    let kindsNow: readonly string[] = before.kinds;
    for (const c of mine) {
      if (c.field === '#kinds') { kindsNow = e.kinds.filter((k) => !lostKinds.has(k)); continue; }
      if (c.field === undefined) continue;
      if (c.after === undefined && !decisions.edited.has(c.id)) { delete data[c.field]; continue; }
      const v = valueOf(c);
      if (v !== null) data[c.field] = v.value;
    }
    entities.push({ ...e, kinds: [...kindsNow], data });
  }

  const docs: ImportPlan['docs'] = [];
  for (const d of plan.docs) {
    if (d.isNew) { if (ok(`d:${d.id}`)) docs.push(d); continue; }
    const before = DOC_KINDS.flatMap((k) => lib.docs(k)).find((x) => x.id === d.id);
    if (before === undefined) continue;
    const mine = (byTarget.get(d.id) ?? []).filter((c) => ok(c.id));
    if (mine.length === 0) {
      if (typeof d.data._ref === 'string' && before.data._ref !== d.data._ref) docs.push({ ...d, data: { ...before.data, _ref: d.data._ref } });
      continue;
    }
    const data: Record<string, unknown> = { ...before.data };
    for (const c of mine) {
      if (c.field === undefined) continue;
      if (c.after === undefined && !decisions.edited.has(c.id)) { delete data[c.field]; continue; }
      const v = valueOf(c);
      if (v !== null) data[c.field] = v.value;
    }
    /* Der bleibende Name und sein Dokument kommen mit dem Import, auch wenn sonst nur ein Teil angenommen ist. */
    for (const key of ['_ref', '_refDoc']) if (d.data[key] !== undefined) data[key] = d.data[key];
    docs.push({ ...d, data });
  }

  const cleanEntities = entities.map((e) => ({ ...e, data: without(e.data, gone) as Record<string, unknown> }));
  const cleanDocs = docs.map((d) => ({ ...d, data: without(d.data, gone) as Record<string, unknown> }));
  const count = (n: number, one: string) => `${n} ${one}`;
  const lines = [
    kinds.length === 0 ? '' : `Rodzaje: ${count(kinds.filter((k) => k.isNew).length, 'nowych')}, ${count(kinds.filter((k) => !k.isNew).length, 'do zmiany')}.`,
    cleanEntities.length === 0 ? '' : `Wpisy: ${count(cleanEntities.filter((e) => e.isNew).length, 'nowych')}, ${count(cleanEntities.filter((e) => !e.isNew).length, 'do zmiany')}.`,
    ...DOC_KINDS.map((k) => {
      const n = cleanDocs.filter((d) => d.kind === k);
      return n.length === 0 ? '' : `${DOC_LABEL[k]}: ${count(n.filter((d) => d.isNew).length, 'nowych')}, ${count(n.filter((d) => !d.isNew).length, 'do zmiany')}.`;
    })
  ].filter(Boolean);
  return { plan: { kinds, entities: cleanEntities, docs: cleanDocs, lines: lines.length === 0 ? ['Nic do zapisania.'] : lines, warnings: plan.warnings }, invalid };
}
