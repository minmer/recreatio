/**
 * 2026-11-22 (A1) — DIE PRÜFUNG EINES DOKUMENTS FÜR EINE BAZA WIEDZY (`knowledge-base`, `knowledge-forms`), gegen die Baza,
 * wie sie ist. Derselbe Weg wie die Vorschau der App (`ImportReviewPanel.tsx`): `importSession` → Änderungen →
 * `decidedPlan` (darin `withRemovals`, `importProblems`, die Probleme der Abläufe) — nur in einen Speicher ohne Dienst
 * (`MemoryStore`), und es wird nichts geschrieben.
 *
 * <b>Die Baza aus ihrer Abschrift</b> (`restoreBase`): der Dienst kennt eine Baza nur als Abschrift für AI
 * (`aiAccess/aiSnapshot.ts`): ihre Einträge mit Daten und Kennung, ihre Rodzaje, und in `setup.course` alles Übrige als
 * Kurs ohne Einträge (Rodzaje, Vorlagen, Widoki, Przebiegi … mit `@name`). Daraus wird die Baza wieder aufgebaut — MIT DEN
 * KENNUNGEN, die sie wirklich hat: ein Dokument, das einen Eintrag an seiner Kennung ändert, trifft ihn hier wie in der App.
 *   1. die Rodzaje über den Import der App (Kennung je Stelle vorgegeben: `k:<Stelle>`),
 *   2. die Einträge, wie sie sind (Daten, Rodzaje, bleibender Name als `_ref`),
 *   3. die Dokumente des Kurses über den Import — jetzt finden ihre `@name` die Einträge (Kennung je Stelle: `d:<art>:<Stelle>`).
 * Die Stellen sind die von `planImport` (cogita/json.ts); ändern sie sich dort, meldet `app-import-registry-check` es
 * (die Kennungen kämen nicht mehr an) — und hier steht es als Hinweis in der Prüfung.
 */

import { changeSummary, importSession, type Decisions, type ImportChange } from '../cogita/importReview';
import { COURSE_FORMAT, importProblems, planFormImport, planImport, structurePreview, withRemovals, type ImportIds, type ImportPlan } from '../cogita/json';
import { isBaseKind, DOC_KINDS } from '../cogita/kinds';
import { MemoryStore } from '../cogita/memoryBase';
import { CogitaLibrary, type BatchItem } from '../cogita/store';
import { t } from '../core/i18n';
import type { RawCheck } from './check';

/** Die Abschrift einer Baza wiedzy, wie der Dienst sie hat (Format 1, `aiSnapshot.ts`) — nur, was die Prüfung braucht. */
export interface KnowledgeSnapshot {
  readonly library?: string;
  readonly name?: string;
  readonly madeAt?: string;
  readonly kinds?: readonly { readonly id?: string; readonly name?: string }[];
  readonly entries?: readonly { readonly id?: string; readonly kind?: string; readonly kinds?: readonly string[]; readonly ref?: string; readonly data?: Readonly<Record<string, unknown>> }[];
  /** 2026-11-22 (I6) — dazu die Uwagi (`feedback`, wie `feedbackForAi` sie schreibt): ein Import kann sie erledigen, die Kontrolle zählt die offenen. */
  readonly setup?: { readonly course?: Readonly<Record<string, unknown>>; readonly feedback?: readonly unknown[] } | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refOf = (v: unknown): string => str(v).replace(/^@/, '');

/** Die Listen der Dokumente eines Kurses — in der Reihenfolge, in der `planImport` sie liest (davon hängt `d:<art>:<Stelle>` ab). */
const DOC_LISTS: readonly (readonly [string, string])[] = [
  ['template', 'templates'], ['revision', 'revisions'], ['flow', 'flows'], ['look', 'looks'], ['rules', 'rules'], ['values', 'values'],
  ['collection', 'collections'], ['view', 'views'], ['settings', 'settings'], ['addform', 'forms'], ['anchor', 'anchors'], ['reward', 'rewards'],
  ['qpath', 'paths']
];

/** Eine leere Baza im Speicher. */
export function emptyBase(libraryId = 'sprawdzenie-importu'): CogitaLibrary {
  return new CogitaLibrary(new MemoryStore(libraryId, 'sprawdzenie-obszaru'), true);
}

/** Die Punkte eines Plans als Zapis — wie `applyImport`, aber ohne Prüfungen (die Baza ist, wie sie ist). */
function itemsOf(plan: ImportPlan, onlyKinds: boolean): BatchItem[] {
  if (onlyKinds) return plan.kinds.map((k) => ({ sort: 'kind', def: k.def, ...(k.marks === undefined ? {} : { marks: k.marks }) }));
  return plan.docs.map((d) => ({ sort: 'doc', kind: d.kind, id: d.id, data: d.data }));
}

/**
 * DIE BAZA AUS IHRER ABSCHRIFT — mit ihren Kennungen. `missing`: wie viele Rodzaje, Einträge, Dokumente ihre Kennung nicht
 * wiederbekamen (dann ist die Prüfung ungenauer — ein Dokument, das sie an der Kennung ändert, sähe sie als neu).
 */
export async function restoreBase(snap: KnowledgeSnapshot): Promise<{ lib: CogitaLibrary; kinds: number; entries: number; docs: number; missing: number }> {
  const lib = emptyBase(str(snap.library) || 'sprawdzenie-importu');
  const course = isObject(snap.setup) && isObject(snap.setup.course) ? snap.setup.course : {};
  const byName = new Map<string, string>();
  for (const k of snap.kinds ?? []) if (isObject(k) && str(k.id) !== '' && str(k.name) !== '') byName.set(str(k.name).toLowerCase(), str(k.id));
  let missing = 0;

  /* 1. Die Rodzaje — über den Import, mit ihren Kennungen. */
  const kindsIn = Array.isArray(course.kinds) ? course.kinds : [];
  const kindIds: ImportIds = new Map();
  const wantKinds: string[] = [];
  kindsIn.forEach((k, i) => {
    if (!isObject(k) || str(k.builtin) !== '') return;
    const r = refOf(k.ref);
    const id = UUID.test(r) ? r : byName.get(str(k.name).toLowerCase());
    if (id !== undefined) { kindIds.set(`k:${i}`, id); wantKinds.push(id); }
  });
  if (kindsIn.length > 0) {
    const plan = planImport(lib, { format: COURSE_FORMAT, version: 1, name: str(course.name), kinds: kindsIn }, { ids: kindIds });
    if (!('error' in plan) && plan.kinds.length > 0) await lib.saveBatch(itemsOf(plan, true));
  }

  /* 2. Die Einträge, wie sie sind. */
  const items: BatchItem[] = [];
  for (const e of snap.entries ?? []) {
    if (!isObject(e) || str(e.id) === '') continue;
    const kinds = (Array.isArray(e.kinds) ? e.kinds : [e.kind]).map(str).filter((k) => k !== '');
    const lasting = str(e.ref).toLowerCase();
    items.push({ sort: 'entity', id: str(e.id), kinds, data: isObject(e.data) ? e.data : {}, ...(lasting === '' ? {} : { marks: { _ref: lasting } }) });
  }
  if (items.length > 0) await lib.saveBatch(items);

  /* 3. Die Dokumente — über den Import (jetzt finden ihre `@name` Rodzaje und Einträge), mit ihren Kennungen. */
  const docIds: ImportIds = new Map();
  const wantDocs: string[] = [];
  const docDoc: Record<string, unknown> = { format: COURSE_FORMAT, version: 1, name: str(course.name) };
  let at = 0;
  for (const [kind, key] of DOC_LISTS) {
    const list = course[key];
    if (list === undefined) continue;
    docDoc[key] = list;
    for (const raw of Array.isArray(list) ? list : isObject(list) ? [list] : []) {
      if (!isObject(raw) || raw.remove === true) continue;
      const r = refOf(raw.ref ?? raw.id);
      if (UUID.test(r)) { docIds.set(`d:${kind}:${at}`, r); wantDocs.push(r); }
      at += 1;
    }
  }
  if (at > 0) {
    const plan = planImport(lib, docDoc, { ids: docIds });
    if (!('error' in plan) && plan.docs.length > 0) await lib.saveBatch(itemsOf(plan, false));
  }
  /*
    4. 2026-11-22 (I6) — DIE UWAGI, mit ihren Kennungen (ein Import erledigt sie an der Kennung): Ziele in der Abschrift beim
    bleibenden Namen („@…") — zurück zur Kennung des Eintrags (die Vorlage ebenso), wie die App sie speichert.
  */
  const fb = isObject(snap.setup) && Array.isArray(snap.setup.feedback) ? snap.setup.feedback : [];
  const back = (v: unknown, kind: 'entity' | 'template'): string | undefined => {
    const r = refOf(v);
    if (r === '') return undefined;
    if (kind === 'entity') return lib.entity(r)?.id ?? lib.byImportRef(r.toLowerCase(), 'entity')?.id ?? r;
    return lib.templates().find((x) => x.id === r)?.id ?? lib.byImportRef(r.toLowerCase(), 'template')?.id ?? r;
  };
  const notes: BatchItem[] = [];
  for (const raw of fb) {
    if (!isObject(raw) || str(raw.id) === '') continue;
    const tg = isObject(raw.target) ? raw.target : {};
    const entity = back(tg.entity, 'entity');
    const template = back(tg.template, 'template');
    notes.push({ sort: 'doc', kind: 'feedback', id: str(raw.id), data: {
      target: { kind: str(tg.kind) || 'entry', ...(entity === undefined ? {} : { entity }), ...(template === undefined ? {} : { template }), ...(str(tg.card) === '' ? {} : { card: str(tg.card) }), label: str(tg.shownAs) },
      category: str(raw.category), text: str(raw.text), at: str(raw.at), state: raw.state === 'done' ? 'done' : 'open',
      ...(str(raw.note) === '' ? {} : { note: str(raw.note) }), ...(str(raw.doneAt) === '' ? {} : { doneAt: str(raw.doneAt) })
    } });
  }
  if (notes.length > 0) await lib.saveBatch(notes);
  for (const id of wantKinds) if (lib.kind(id) === undefined) missing += 1;
  for (const id of wantDocs) if (!DOC_KINDS.some((k) => lib.docs(k).some((d) => d.id === id))) missing += 1;
  return { lib, kinds: lib.kinds.filter((k) => !isBaseKind(k.id)).length, entries: items.length, docs: at, missing };
}

/** Ein Dokument als Wert (auch als Text gekommen, mit BOM). */
export function readDoc(doc: unknown): { value: unknown } | { error: string } {
  if (typeof doc !== 'string') return { value: doc };
  try { return { value: JSON.parse(doc.replace(/^﻿/, '')) as unknown }; } catch (e) { return { error: t('importCheck.notJson', { error: e instanceof Error ? e.message : String(e) }) }; }
}

/** Was eine Änderung an Bestehendem sagt — eine Zeile. */
const editLine = (c: ImportChange): string => (c.target === 'kind'
  ? t('importCheck.editKind', { title: c.title, field: c.fieldLabel ?? t('importCheck.whole'), after: c.afterText })
  : t('importCheck.editField', { title: c.title, field: c.fieldLabel ?? t('importCheck.whole'), before: c.beforeText, after: c.afterText }));

/** Alles angenommen — wie „Przyjmij wszystkie" (die App schlägt Änderungen an Bestehendem erst abgewählt vor). */
const acceptAll = (changes: readonly ImportChange[]): Decisions => ({ accepted: new Set(changes.map((c) => c.id)), edited: new Map() });

/** Woran geprüft wurde. */
async function baseFor(base: KnowledgeSnapshot | undefined): Promise<{ lib: CogitaLibrary; note: string; warnings: string[] }> {
  if (base === undefined) return { lib: emptyBase(), note: t('importCheck.againstEmptyBase'), warnings: [] };
  const made = await restoreBase(base);
  return {
    lib: made.lib,
    note: t('importCheck.againstBase', { name: str(base.name) || '—', entries: made.entries, kinds: made.kinds, docs: made.docs }),
    warnings: made.missing > 0 ? [t('importCheck.idsLost', { count: made.missing })] : []
  };
}

/** `knowledge-base`: ein Kurs, ein Schemat, Einträge, ein Ablauf — gegen die Baza (oder eine leere). */
export async function checkKnowledge(doc: unknown, base?: KnowledgeSnapshot): Promise<RawCheck> {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  const { lib, note, warnings: baseWarnings } = await baseFor(base);
  const session = importSession(lib, read.value);
  const plan = session.plan();
  if ('error' in plan) return { errors: [plan.error], note };
  const changes = session.changes();
  const decided = session.decide(acceptAll(changes));
  const edits = changes.filter((c) => !c.isNew && c.remove !== true);
  const changed = new Set(edits.map((c) => c.targetId));
  const lines = [
    ...changeSummary(changes),
    ...(edits.length === 0 ? [] : [t('importCheck.editsHead', { count: edits.length }), ...edits.map(editLine)]),
    ...(changes.length === 0 ? [] : structurePreview(lib, plan, 80, changed))
  ];
  const removals = changes.filter((c) => c.remove === true).map((c) => (c.afterText === '' ? c.title : t('importCheck.removal', { title: c.title, what: c.afterText })));
  if ('error' in decided) return { changes: lines, removals, errors: [decided.error], warnings: [...baseWarnings, ...plan.warnings], note };
  return {
    changes: lines, removals, note,
    errors: [...decided.invalid, ...decided.blocked],
    /* 2026-11-22 (I6) — erledigte Uwagi sind vorgeschlagen angenommen: sie zählen nicht zu den Änderungen, die abgewählt beginnen. */
    warnings: [...baseWarnings, ...plan.warnings, ...decided.kept, ...(edits.filter((c) => c.resolves !== true).length > 0 ? [t('importCheck.editsUnticked', { count: edits.filter((c) => c.resolves !== true).length })] : [])]
  };
}

/** `knowledge-forms`: Formularze dodawania — gegen die Baza (ihre Rodzaje). */
export async function checkKnowledgeForms(doc: unknown, base?: KnowledgeSnapshot): Promise<RawCheck> {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  const { lib, note, warnings: baseWarnings } = await baseFor(base);
  const plan = planFormImport(lib, read.value);
  if ('error' in plan) return { errors: [plan.error], note };
  const gone = withRemovals(lib, plan);
  const checked = importProblems(lib, gone.plan);
  return { changes: plan.lines, note, errors: [...gone.blocked, ...checked.blocked], warnings: [...baseWarnings, ...plan.warnings, ...checked.kept] };
}
