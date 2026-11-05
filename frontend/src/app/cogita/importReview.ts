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
 *   decidedPlan(lib, plan, …)        der Plan mit nur dem Angenommenen (und den geänderten Werten) — und was ihn blockiert
 *   importSession(lib, doc)          EIN Plan je Dokument und Stand: Vorschau, Durchsicht und Speichern sehen dieselben Kennungen
 *   changeSummary(changes)           in Worten: wie viel neu ist und wie viel sich ändert
 * </code>
 *
 * 2026-11-03 — LÖSCHUNGEN (`"remove": true`): jede einzeln (`x:<id>`), mit ihrem Namen und dem, was einen Verweis darauf
 * verliert; vorgeschlagen angenommen (das Dokument verlangt sie ausdrücklich), abwählbar. Nichts geht still.
 *
 * Nichts davon speichert; `applyImport` schreibt den entschiedenen Plan, in einem Zug.
 */

import { blockPlain, blocksIn, type CommentBlock } from '../library/blocks';
import { DOC_KINDS, DOC_LABEL, kindDoc } from './kinds';
import { importIds, importProblems, planImport, removalEffects, withRemovals, type ImportPlan } from './json';
import { t } from '../core/i18n';
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
  /** 2026-11-03 — eine Löschung (`x:<id>`): `afterText` sagt, wer seinen Verweis darauf verliert. */
  readonly remove?: true;
  /**
   * 2026-11-04 (Prompt 9) — die Änderung füllt nur, was leer war (überschreibt nichts): vorgeschlagen angenommen. Vorher
   * fiel so ein neues Feld eines bestehenden Ablaufs ("review") still weg, wenn niemand „Przyjmij wszystkie" drückte.
   */
  readonly fills?: true;
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
/**
 * 2026-11-03 — WIE EIN WERT GESPEICHERT DASTEHT (`cleanData`): leerer Text, leere Liste und `null` fallen weg, Text
 * ohne Leerraum am Ende. Ohne das zeigte jeder zweite Import eines Widok zwei Änderungen, die keine sind („query": "",
 * „columns": [] — der Speicher legt sie nie ab) — beim Besitzer „Zmiany (12)" statt 10.
 */
const stored = (v: unknown): unknown => {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') { const t = v.replace(/\s+$/, ''); return t === '' ? undefined : t; }
  if (Array.isArray(v) && v.length === 0) return undefined;
  return v;
};
const sameStored = (a: unknown, b: unknown): boolean => same(stored(a), stored(b));
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
    return Number.isFinite(n) ? { value: n } : { error: t('cogitaData.review.notNumber') };
  }
  try { return { value: JSON.parse(text) as unknown }; } catch { return { error: t('cogitaData.review.notJson') }; }
}

/* -- Die Liste ----------------------------------------------------------------------------------- */

/** Wie die geplanten Einträge und Rodzaje gelesen werden — die neue Fassung vor der alten. */
function plannedLook(lib: CogitaLibrary, plan: ImportPlan): Lookup {
  const entities = new Map(plan.entities.map((e) => [e.id, { id: e.id, kinds: e.kinds, data: e.data } as Entity]));
  const kinds = new Map(plan.kinds.map((k) => [k.id, k.def]));
  return { kind: (id) => kinds.get(id) ?? lib.kind(id), entity: (id) => entities.get(id) ?? lib.entity(id) };
}

/** Die Schlüssel eines Dokuments mit eigener Bezeichnung (`cogitaData.review.docKey.<schlüssel>`); die übrigen stehen als Schlüssel da. */
const DOC_KEYS: ReadonlySet<string> = new Set(['name', 'steps', 'mode', 'outline', 'columns', 'group', 'matrix', 'sort', 'graph', 'kinds', 'direction', 'says', 'keys',
  'paste', 'order', 'work', 'locator', 'entry', 'view', 'note', 'query', 'list', 'rule']);
const docKeyLabel = (key: string): string => (DOC_KEYS.has(key) ? t(`cogitaData.review.docKey.${key}`) : key);

/** Was an einem Rodzaj anders wird — in einer Zeile. */
function kindChange(before: KindDef, after: KindDef): string {
  const out: string[] = [];
  if (before.name !== after.name) out.push(t('cogitaData.review.kindName', { from: before.name, to: after.name }));
  if (before.label !== after.label) out.push(t('cogitaData.review.kindLabel', { from: before.label, to: after.label }));
  const old = new Map(before.fields.map((f) => [f.key, f]));
  const added = after.fields.filter((f) => !old.has(f.key)).map((f) => f.label);
  const changed = after.fields.filter((f) => old.has(f.key) && !same(kindDoc({ ...before, fields: [old.get(f.key)!] }).fields, kindDoc({ ...after, fields: [f] }).fields)).map((f) => f.label);
  if (added.length > 0) out.push(t('cogitaData.review.newFields', { fields: added.join(', ') }));
  if (changed.length > 0) out.push(t('cogitaData.review.changedFields', { fields: changed.join(', ') }));
  if (before.fields.map((f) => f.key).join() !== after.fields.map((f) => f.key).join() && added.length === 0) out.push(t('cogitaData.review.fieldOrder'));
  if (before.tells !== after.tells) out.push(t('cogitaData.review.kindTells', { from: before.tells ?? '—', to: after.tells ?? '—' }));
  if (before.system !== after.system) out.push(t('cogitaData.review.kindSystem'));
  if ((before.reading ?? '') !== (after.reading ?? '')) out.push(after.reading === undefined ? t('cogitaData.review.readingRemoved') : t('cogitaData.review.readingChanged'));
  return out.join('; ');
}

/** DIE ÄNDERUNGEN EINES PLANS, in der Reihenfolge: Rodzaje, Einträge, Dokumente; Neues zuerst je Gruppe. */
export function changesOf(lib: CogitaLibrary, plan: ImportPlan): ImportChange[] {
  const look = plannedLook(lib, plan);
  const out: ImportChange[] = [];

  for (const k of plan.kinds) {
    if (k.isNew) { out.push({ id: `k:${k.id}`, target: 'kind', targetId: k.id, isNew: true, title: t('cogitaData.import.kindTitle', { name: k.def.name }), beforeText: '', afterText: k.def.fields.map((f) => f.label).join(', '), edit: null }); continue; }
    const before = lib.kind(k.id);
    if (before === undefined || same(kindDoc(before), kindDoc(k.def))) continue;
    out.push({ id: `k:${k.id}`, target: 'kind', targetId: k.id, isNew: false, title: t('cogitaData.import.kindTitle', { name: before.name }), beforeText: '', afterText: kindChange(before, k.def), edit: null });
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
      if (sameStored(was, now)) continue;
      const field = fields.get(key);
      out.push({
        id: `e:${e.id}:${key}`, target: 'entity', targetId: e.id, isNew: false, title, field: key, fieldLabel: field?.label ?? key, ...(stored(was) === undefined && now !== undefined ? { fills: true as const } : {}),
        beforeText: valueWords(field, was, look), afterText: now === undefined ? t('cogitaData.review.fieldRemoved') : valueWords(field, now, look),
        ...(now === undefined ? {} : { after: now }), edit: editOf(field, now)
      });
    }
    if (!same(before.kinds, e.kinds)) {
      const name = (ids: readonly string[]) => ids.map((k) => look.kind(k)?.name ?? k).join(', ');
      out.push({ id: `e:${e.id}:#kinds`, target: 'entity', targetId: e.id, isNew: false, title, field: '#kinds', fieldLabel: t('cogitaData.review.kinds'), beforeText: name(before.kinds), afterText: name(e.kinds), after: e.kinds, edit: null });
    }
  }

  /* 2026-11-03 — die Löschungen, jede mit dem, was seinen Verweis darauf verliert (auf dem Stand nach dem Import). */
  const removals = plan.removals ?? [];
  if (removals.length > 0) {
    const fx = removalEffects(lib, plan, new Set(removals.map((r) => r.id)));
    for (const r of removals) {
      const who = fx.unlinked.get(r.id) ?? [];
      out.push({
        id: `x:${r.id}`, target: r.target, targetId: r.id, isNew: false, remove: true, title: r.title, beforeText: '',
        afterText: who.length === 0 ? t('cogitaData.review.nothingPoints') : t('cogitaData.review.unlinkedFrom', { list: who.length > 8 ? t('cogitaData.import.listedMore', { list: who.slice(0, 8).join(', '), count: who.length - 8 }) : who.join(', ') }), edit: null
      });
    }
  }

  for (const d of plan.docs) {
    const title = t('cogitaData.import.docTitle', { doc: DOC_LABEL[d.kind], name: typeof d.data.name === 'string' && d.data.name !== '' ? d.data.name : '—' });
    if (d.isNew) { out.push({ id: `d:${d.id}`, target: 'doc', targetId: d.id, isNew: true, title, beforeText: '', afterText: '', edit: null }); continue; }
    const before = DOC_KINDS.flatMap((k) => lib.docs(k)).find((x) => x.id === d.id);
    if (before === undefined) continue;
    for (const key of [...new Set([...plainKeys(before.data), ...plainKeys(d.data)])]) {
      const was = before.data[key];
      const now = d.data[key];
      if (sameStored(was, now)) continue;
      const words = (v: unknown) => (v === undefined ? '—' : typeof v === 'string' || typeof v === 'number' ? clip(String(v)) : clip(JSON.stringify(v), 300));
      out.push({
        id: `d:${d.id}:${key}`, target: 'doc', targetId: d.id, isNew: false, title, field: key, fieldLabel: docKeyLabel(key), ...(stored(was) === undefined && now !== undefined ? { fills: true as const } : {}),
        beforeText: words(was), afterText: now === undefined ? t('cogitaData.review.removed') : words(now), ...(now === undefined ? {} : { after: now }),
        edit: now === undefined ? null : typeof now === 'string' ? 'text' : 'json'
      });
    }
  }
  return out;
}

/** Vorgeschlagen: alles Neue an, jede Änderung an Bestehendem aus — sie wird erst angenommen. */
export function defaultDecisions(changes: readonly ImportChange[]): Decisions {
  return { accepted: new Set(changes.filter((c) => c.isNew || c.remove === true || c.fills === true).map((c) => c.id)), edited: new Map() };
}

/* -- Der entschiedene Plan ------------------------------------------------------------------------- */

/**
 * DER PLAN MIT NUR DEM ANGENOMMENEN: Neues, das angenommen ist; an Bestehendem nur die angenommenen Felder, mit dem
 * geänderten Wert, wo der Besitzer ihn geändert hat; ein Bestehendes ohne angenommene Änderung wird nicht gespeichert.
 * `invalid`: Änderungen, deren geänderter Wert sich nicht lesen lässt (sie bleiben aus).
 *
 * 2026-11-03 — `blocked`: was diesen Plan am Speichern hindert (`importProblems`), je Element und Feld. Abgelehntes
 * Neues fällt nicht mehr STILL aus dem heraus, was darauf zeigt (vorher verlor so ein Etap sein Obszar, und ein
 * Rodzaj zeigte auf einen, den es nie gab): zeigt Angenommenes darauf, sagt der Plan es und speichert nichts.
 * `kept`: Verweise ins Leere, die schon vorher gespeichert waren und bleiben — ein Hinweis, kein Halt.
 */
export function decidedPlan(lib: CogitaLibrary, plan: ImportPlan, changes: readonly ImportChange[], decisions: Decisions): { plan: ImportPlan; invalid: string[]; blocked: string[]; kept: string[] } {
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
  for (const c of changes) if (!c.isNew && c.remove !== true) byTarget.set(c.targetId, [...(byTarget.get(c.targetId) ?? []), c]);

  /* Was als Neues abgelehnt ist, mit seinem Namen — darauf darf nichts Angenommenes zeigen (`importProblems`). */
  const kindName = (id: string, fallback: string) => plan.kinds.find((k) => k.id === id)?.def.name ?? fallback;
  const unsaved = new Map(changes.filter((c) => c.isNew && !ok(c.id)).map((c) => [c.targetId,
    c.target === 'entity' ? t('cogitaData.review.unsavedEntry', { title: c.title }) : c.target === 'kind' ? t('cogitaData.review.unsavedKind', { name: kindName(c.targetId, c.title) }) : c.title]));

  /* Ein Rodzaj, dessen Änderung nicht angenommen ist, der aber seinen bleibenden Namen bekommt (`_ref`), wird in seiner alten Gestalt gespeichert — das ist Buchhaltung, kein Inhalt. */
  const kinds: ImportPlan['kinds'] = plan.kinds.flatMap((k) => {
    if (ok(`k:${k.id}`)) return [k];
    const before = lib.kind(k.id);
    if (!k.isNew && k.marks !== undefined && before !== undefined) return [{ ...k, def: before }];
    return [];
  });

  const entities: ImportPlan['entities'] = [];
  for (const e of plan.entities) {
    if (e.isNew) {
      if (ok(`e:${e.id}`)) entities.push(e);
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
      if (c.field === '#kinds') { kindsNow = e.kinds; continue; }
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

  const cleanEntities = entities;
  const cleanDocs = docs;
  const lines = [
    kinds.length === 0 ? '' : t('cogitaData.import.summaryKinds', { fresh: kinds.filter((k) => k.isNew).length, changed: kinds.filter((k) => !k.isNew).length }),
    cleanEntities.length === 0 ? '' : t('cogitaData.import.summaryEntries', { fresh: cleanEntities.filter((e) => e.isNew).length, changed: cleanEntities.filter((e) => !e.isNew).length }),
    ...DOC_KINDS.map((k) => {
      const n = cleanDocs.filter((d) => d.kind === k);
      return n.length === 0 ? '' : t('cogitaData.import.summaryDocs', { doc: DOC_LABEL[k], fresh: n.filter((d) => d.isNew).length, changed: n.filter((d) => !d.isNew).length });
    })
  ].filter(Boolean);
  const titles = new Map(changes.filter((c) => c.target === 'entity').map((c) => [c.targetId, c.title]));
  /* 2026-11-03 — nur die angenommenen Löschungen; was darauf zeigt, schreibt derselbe Zapis mit (`withRemovals`). */
  const removals = (plan.removals ?? []).filter((r) => ok(`x:${r.id}`));
  if (removals.length > 0) lines.push(t('cogitaData.import.summaryRemove', { count: removals.length }));
  const raw: ImportPlan = { kinds, entities: cleanEntities, docs: cleanDocs, lines: lines.length === 0 ? [t('cogitaData.review.nothingToSave')] : lines, warnings: plan.warnings, unsaved, titles, ...(removals.length === 0 ? {} : { removals }) };
  const withGone = withRemovals(lib, raw);
  const decided = withGone.plan;
  const { blocked, kept } = importProblems(lib, decided);
  return { plan: decided, invalid, blocked: [...withGone.blocked, ...blocked], kept };
}

/* -- Ein Dokument, ein Plan ----------------------------------------------------------------------- */

/** Ein Dokument in der Durchsicht: sein Plan (je Stand der Baza einmal gerechnet), seine Änderungen, das Entschiedene. */
export interface ImportSession {
  plan(): ImportPlan | { error: string };
  changes(): readonly ImportChange[];
  /** `null`: wie vorgeschlagen (Neues an, Änderungen an Bestehendem aus). */
  decide(decisions: Decisions | null): ReturnType<typeof decidedPlan> | { error: string };
}

/**
 * 2026-11-03 — EIN PLAN FÜR VORSCHAU, DURCHSICHT UND SPEICHERN. Vorher plante jede für sich, mit neuen Kennungen für
 * alles Neue — die Annahmen der Durchsicht trafen beim Speichern nichts mehr. Hier gibt es den Plan einmal je Stand
 * der Baza, mit den Kennungen dieses Dokuments (`importIds`): ändert sich der Stand (ein Abgleich), wird neu geplant —
 * mit denselben Kennungen, und die Annahmen gelten weiter.
 */
export function importSession(lib: CogitaLibrary, doc: unknown): ImportSession {
  const ids = importIds(lib, doc);
  let at: { revision: number; plan: ImportPlan | { error: string }; changes: readonly ImportChange[] } | null = null;
  const now = () => {
    if (at === null || at.revision !== lib.revision) {
      const plan = planImport(lib, doc, { ids });
      at = { revision: lib.revision, plan, changes: 'error' in plan ? [] : changesOf(lib, plan) };
    }
    return at;
  };
  return {
    plan: () => now().plan,
    changes: () => now().changes,
    decide: (decisions) => {
      const { plan, changes } = now();
      if ('error' in plan) return plan;
      return decidedPlan(lib, plan, changes, decisions ?? defaultDecisions(changes));
    }
  };
}

/** Wie ein Element in der Zusammenfassung heisst (eine Mehrzahl: `cogitaData.review.target.<art>`). */
const targetWords = (target: ImportChange['target'], count: number): string => t(`cogitaData.review.target.${target}`, { count });

/**
 * 2026-11-03 — WAS DER IMPORT TUT, GEZÄHLT AN DEM, WAS SICH WIRKLICH ÄNDERT (nicht an dem, was das Dokument nennt):
 * dasselbe Dokument ein zweites Mal sagt „nic nowego, nic do zmiany".
 */
export function changeSummary(changes: readonly ImportChange[]): string[] {
  const fresh = changes.filter((c) => c.isNew);
  const edits = changes.filter((c) => !c.isNew && c.remove !== true);
  const gone = changes.filter((c) => c.remove === true);
  if (fresh.length === 0 && edits.length === 0 && gone.length === 0) return [t('cogitaData.review.nothingAtAll')];
  const words = (list: readonly ImportChange[]) => (['kind', 'entity', 'doc'] as const)
    .map((target) => { const n = new Set(list.filter((c) => c.target === target).map((c) => c.targetId)).size; return n === 0 ? '' : targetWords(target, n); })
    .filter(Boolean).join(', ');
  const touched = new Set(edits.map((c) => `${c.target}:${c.targetId}`)).size;
  return [
    fresh.length === 0 ? t('cogitaData.review.freshNone') : t('cogitaData.review.fresh', { count: fresh.length, words: words(fresh) }),
    edits.length === 0 ? t('cogitaData.review.editsNone') : t('cogitaData.review.edits', { count: edits.length, touched: t('cogitaData.review.touched', { count: touched }), words: words(edits) }),
    ...(gone.length === 0 ? [] : [t('cogitaData.review.gone', { count: gone.length, words: words(gone) })])
  ];
}
