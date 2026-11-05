/**
 * 2026-10-24 — TEXT HINEIN, AUCH MIT SEINEM WERK.
 *
 * Zwei Wege, dieselben Teile:
 * <code>
 *   am Werk („Tekst źródła")      die Teile zu einem Werk, das es gibt          previewPortions / writePortions
 *   in den Źródła („Dzieło z tekstem")  ein Werk (Buch, Artykuł …), seine Autoren
 *                                 und sein Text — in EINEM Dokument            planWorkWithText
 * </code>
 * Das Werk ist ein Eintrag der Bibliothek wie jeder andere: es geht durch denselben Import
 * (`planLibraryImport` — Autoren, Zeitschrift, Verweise per `@schlüssel`; ein Werk mit
 * bekanntem Schlüssel wird ergänzt, nicht verdoppelt). Danach kommt der Text an genau dieses
 * Werk, in die gewählte Bibliothek (auch eine andere, private). Erst das Werk, dann die Teile,
 * dann das Verzeichnis: was misslingt, lässt nichts Halbes zurück, das auf Fehlendes zeigt.
 */

import { newId } from '../core/ids';
import { t } from '../core/i18n';
import { kindsDoc, LIBRARY_FORMAT, LIBRARY_VERSION, planLibraryImport, type ImportBase, type LibraryImportPlan } from './libraryJson';
import { kindOf, MUSIC_TYPES, WORK_TYPES, workTitle, type LibEntry, type LibKind } from './libraryKinds';
import type { LibraryStore } from './libraryStore';
import { SCHEMES, schemeOf, workScheme, type SchemeId } from './locations';
import {
  mathAsk, nextManifest, overlapsWith, PART_KIND, pageRangeLabel, partData, planSourceImport, portionDocs, readManifest, readPart, samePart,
  SOURCE_FORMAT, sourceTextUse, SOURCE_VERSION, sourceTextDescription, TEXT_KIND, type TexCheck, type TextManifest
} from './sourceText';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);


export interface ImportSay {
  readonly lines: string[];
  readonly warnings: string[];
}

/* -- Die Teile zu einem Werk ------------------------------------------------------------------- */

/**
 * Was die Teile ändern würden — vor dem Speichern, ohne etwas zu speichern. 2026-11-01 — `tex`: der Prüfer der
 * Wzory (KaTeX), sobald er geladen ist; bis dahin sagt die Vorschau, dass sie die Wzory noch nicht gesetzt hat.
 */
export function previewPortions(work: LibEntry, manifest: TextManifest | undefined, docs: readonly unknown[], tex?: TexCheck): ImportSay | { error: string } {
  const lines: string[] = [];
  const warnings: string[] = [];
  let running = manifest;
  let unchecked = 0;
  for (const [i, raw] of docs.entries()) {
    const plan = planSourceImport(raw, { work, ...(running === undefined ? {} : { manifest: running }), ...(tex === undefined ? {} : { tex }) });
    const label = docs.length > 1 ? t('librarySource.preview.partPrefix', { n: i + 1 }) : '';
    if ('error' in plan) { if (docs.length === 1) return plan; warnings.push(`${label}${plan.error}`); continue; }
    const s = plan.summary;
    const items: string[] = [t('librarySource.preview.blocks', { count: s.blocks }), t('librarySource.preview.words', { count: s.words })];
    if (s.first !== undefined) items.push(s.last !== s.first ? t('librarySource.preview.placesRange', { first: s.first, last: s.last ?? '' }) : t('librarySource.preview.places', { first: s.first }));
    if (s.pages !== undefined) items.push(pageRangeLabel(s.pages));
    if (s.notes > 0) items.push(t('librarySource.preview.notes', { count: s.notes }));
    if (s.formulas !== undefined) {
      const f = t('librarySource.preview.formulas', { count: s.formulas });
      items.push(!s.checked ? f : s.texErrors === 0 ? t('librarySource.preview.formulasOk', { formulas: f }) : t('librarySource.preview.formulasBad', { formulas: f, errors: s.texErrors }));
    }
    if (s.statements !== 0) items.push(t('librarySource.preview.frames', { count: s.statements }));
    if (s.formulas !== undefined && !s.checked) unchecked += s.formulas;
    lines.push(t(plan.replaces ? 'librarySource.preview.replaces' : 'librarySource.preview.adds', { label: plan.portion.label, key: plan.portion.key, items: items.join(', ') }));
    if (plan.setScheme !== undefined) lines.push(`${label}${t('librarySource.preview.setScheme', { label: schemeOf(plan.setScheme).label, scheme: plan.setScheme })}`);
    for (const other of overlapsWith(running, plan)) warnings.push(`${label}${t('librarySource.preview.overlap', { other })}`);
    warnings.push(...plan.warnings.map((w) => `${label}${w}`));
    /* 2026-10-27 — je Teil eine eigene vorläufige Kennung: mit einer gemeinsamen verdrängte jeder Teil den vorigen, und ein Teil wurde nur mit dem davor verglichen. */
    running = readManifest(nextManifest(running, work.id, plan, `preview-${i}`));
  }
  if (lines.length === 0) return { error: warnings[0] ?? t('librarySource.preview.nothing') };
  if (unchecked > 0) lines.push(t('librarySource.preview.typesetting', { n: unchecked }));
  return { lines, warnings };
}

/**
 * DIE TEILE SCHREIBEN — in `target` (die Bibliothek des Textes): je Teil erst der Teil, dann
 * das Verzeichnis; derselbe Teil noch einmal schreibt nichts. Bekommt das Werk dabei seine
 * Regel der Stellen und schreibt man in seiner Bibliothek (`workStore`), steht sie danach dort.
 */
export async function writePortions(opts: {
  readonly target: LibraryStore;
  readonly work: LibEntry;
  readonly docs: readonly unknown[];
  readonly stage: (what: string) => void;
  readonly workStore?: LibraryStore;
  readonly tex?: TexCheck;
}): Promise<ImportSay> {
  const { target, work, docs, stage, workStore, tex } = opts;
  const lines: string[] = [];
  const warnings: string[] = [];
  let current = target.ownTexts(work.id)[0];
  let read = current === undefined ? undefined : readManifest(current.data);
  const textId = current?.id ?? newId();
  for (const [i, raw] of docs.entries()) {
    const plan = planSourceImport(raw, { work, ...(read === undefined ? {} : { manifest: read }), ...(tex === undefined ? {} : { tex }) });
    if ('error' in plan) { warnings.push(`${t('librarySource.preview.partPrefix', { n: i + 1 })}${plan.error}`); continue; }
    const had = read?.parts.find((p) => p.key === plan.portion.key);
    if (had !== undefined) {
      const before = await target.heavy(had.id);
      if (before !== null && samePart(readPart(before.data), plan)) { lines.push(t('librarySource.write.unchanged', { label: plan.portion.label })); continue; }
    }
    stage(t('librarySource.write.saving', { n: i + 1, total: docs.length }));
    const partId = had?.id ?? newId();
    await target.save({ id: partId, kind: PART_KIND, data: partData(textId, work.id, plan) });
    current = await target.save({ id: textId, kind: TEXT_KIND, data: nextManifest(read, work.id, plan, partId) });
    read = readManifest(current.data);
    lines.push(t(had === undefined ? 'librarySource.write.added' : 'librarySource.write.replaced', { label: plan.portion.label }));
    warnings.push(...plan.warnings);
    if (plan.setScheme !== undefined && typeof work.data.scheme !== 'string' && workStore?.own(work.id) !== undefined) {
      await workStore.save({ id: work.id, kind: 'work', ...(work.key === undefined ? {} : { key: work.key }), data: { ...work.data, scheme: plan.setScheme } }).catch(() => {
        warnings.push(t('librarySource.write.schemeFailed'));
      });
    }
  }
  return { lines: lines.length === 0 ? [t('librarySource.write.nothing')] : lines, warnings };
}

/* -- Ein Werk mit seinem Text ------------------------------------------------------------------ */

export interface WorkWithTextPlan {
  /** Werk, Autoren, Zeitschrift … — wie der Import der Bibliothek sie schreiben würde. */
  readonly library: LibraryImportPlan;
  /** Das Werk, an das der Text kommt (neu, ergänzt oder unverändert). */
  readonly work: LibEntry;
  readonly workIsNew: boolean;
  /** Die Teile, je eines ein Dokument der einfachen Gestalt. */
  readonly docs: readonly unknown[];
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

/** Ein Werk als Objekt: `{ key, data: {…} }` (wie im Import der Bibliothek) oder flach `{ key, workType, title, … }`. */
function workEntryOf(raw: Record<string, unknown>): Record<string, unknown> {
  const { key, id, kind: _kind, data, ...flat } = raw;
  return {
    kind: 'work',
    ...(typeof id === 'string' && id.trim() !== '' ? { id: id.trim() } : {}),
    ...(typeof key === 'string' && key.trim() !== '' ? { key: key.trim().replace(/^@/, '') } : {}),
    data: isObject(data) ? data : flat
  };
}

/**
 * DAS DOKUMENT PRÜFEN: das Werk (neu oder bekannt), was es nennt (`entries`: Personen, eine
 * Zeitschrift, ein Sammelband), und die Teile seines Textes. `textManifest`: was die Bibliothek
 * des Textes zu diesem Werk schon hat (ein bekanntes Werk kann schon Teile haben).
 */
export function planWorkWithText(
  raw: unknown, base: ImportBase, textManifest: (workId: string) => TextManifest | undefined = () => undefined, tex?: TexCheck
): WorkWithTextPlan | { error: string } {
  if (!isObject(raw) || raw.format !== SOURCE_FORMAT) return { error: t('librarySource.withWork.expected', { format: SOURCE_FORMAT }) };
  if (raw.version !== SOURCE_VERSION) return { error: t('librarySource.import.unknownVersion', { version: String(raw.version), known: SOURCE_VERSION }) };

  let work: LibEntry | undefined;
  let library: LibraryImportPlan = { drafts: [], created: 0, updated: 0, unchanged: 0, lines: [], warnings: [] };
  const extra = Array.isArray(raw.entries) ? raw.entries : [];

  if (isObject(raw.work)) {
    const entry = workEntryOf(raw.work);
    const id = typeof entry.id === 'string' ? entry.id : newId();
    /* Die Regel der Stellen gleich ans neue Werk, wenn sie nicht aus seinem Rodzaj folgt. */
    const data = { ...(entry.data as Record<string, unknown>) };
    if (typeof raw.scheme === 'string' && SCHEMES.some((x) => x.id === raw.scheme) && data.scheme === undefined && workScheme(data) !== raw.scheme) data.scheme = raw.scheme;
    const planned = planLibraryImport({ format: LIBRARY_FORMAT, version: LIBRARY_VERSION, entries: [...extra, { ...entry, id, data }] }, base);
    if ('error' in planned) return planned;
    library = planned;
    const draft = planned.drafts.find((d) => d.kind === 'work' && (d.id === id || (typeof entry.key === 'string' && d.key?.toLowerCase() === entry.key.toLowerCase())));
    const known = typeof entry.key === 'string' ? base.byKey(entry.key) : base.get(id);
    work = draft !== undefined ? { id: draft.id, kind: 'work', ...(draft.key === undefined ? {} : { key: draft.key }), data: draft.data }
      : known !== undefined && known.kind === 'work' ? known : undefined;
    if (work === undefined) return { error: t('librarySource.withWork.workInvalid') };
  } else if (typeof raw.work === 'string' && raw.work.trim() !== '') {
    const ref = raw.work.trim().replace(/^@/, '');
    work = base.get(ref) ?? base.byKey(ref);
    if (work === undefined || work.kind !== 'work') return { error: t('librarySource.withWork.workUnknown', { work: raw.work }) };
    if (extra.length > 0) {
      const planned = planLibraryImport({ format: LIBRARY_FORMAT, version: LIBRARY_VERSION, entries: extra }, base);
      if ('error' in planned) return planned;
      library = planned;
    }
  } else {
    return { error: t('librarySource.withWork.workMissing') };
  }

  const docs = portionDocs(raw);
  const hasText = docs.some((d) => isObject(d) && (Array.isArray(d.blocks) || isObject(d.portion)));
  const text = hasText ? previewPortions(work, textManifest(work.id), docs, tex) : { lines: [], warnings: [t('librarySource.withWork.noText')] };
  if ('error' in text) return text;

  const title = workTitle(work.data);
  const isNew = base.get(work.id) === undefined;
  return {
    library,
    work,
    workIsNew: isNew,
    docs: hasText ? docs : [],
    lines: [
      t(isNew ? 'librarySource.withWork.newWork' : library.drafts.some((d) => d.id === work!.id) ? 'librarySource.withWork.fillWork' : 'librarySource.withWork.work', { title, key: work.key === undefined ? '' : ` [@${work.key}]` }),
      ...(library.drafts.filter((d) => d.id !== work!.id).length > 0 ? [t('librarySource.withWork.besides', { list: library.drafts.filter((d) => d.id !== work!.id).map((d) => t(d.existing ? 'librarySource.withWork.otherChanged' : 'librarySource.withWork.other', { kind: kindOf(d.kind)?.label ?? d.kind, title: String(d.data.title ?? d.data.surname ?? d.data.name ?? d.key ?? '') })).join(', ') })] : []),
      ...text.lines
    ],
    warnings: [...library.warnings, ...text.warnings]
  };
}

/* -- Beschreibung und Polecenie -------------------------------------------------------------------- */

/** Ein vollständiges Beispiel: ein Artykuł in einer Zeitschrift, mit Autor und Text in zwei Teilen. */
export const WORK_WITH_TEXT_EXAMPLE: Readonly<Record<string, unknown>> = {
  format: SOURCE_FORMAT,
  version: SOURCE_VERSION,
  work: {
    key: 'kowalski2020',
    data: { workType: 'article', title: 'Miłość, która pyta', subtitle: 'O J 21,15-17', authors: ['@kowalski'], container: '@przeglad', year: '2020', volume: '12', issue: '2', pages: '45–60', language: 'pl' } // i18n-ignore
  },
  entries: [
    { kind: 'person', key: 'kowalski', data: { personType: 'person', givenNames: 'Jan', surname: 'Kowalski' } },
    { kind: 'work', key: 'przeglad', data: { workType: 'periodical', title: 'Przegląd Biblijny' } } // i18n-ignore
  ],
  scheme: 'pages',
  edition: { language: 'pl', pdfPageOffset: -44 },
  portions: [
    {
      portion: { key: 'wstep', label: 'Wstęp', order: 1 }, // i18n-ignore
      blocks: [
        { type: 'page', page: '45', pdf: 1 },
        { type: 'heading', level: 1, text: 'Miłość, która pyta' }, // i18n-ignore
        { type: 'paragraph', text: 'Trzykrotne pytanie Jezusa odpowiada trzykrotnemu zaparciu się Piotra.{{note 1}} Nie jest przesłuchaniem, lecz uzdrowieniem {{page 46 pdf 2}} pamięci.' }, // i18n-ignore
        { type: 'note', id: '1', text: 'Por. J 18,15-27.' } // i18n-ignore
      ]
    },
    {
      portion: { key: 'rozdz-1', label: '1. Słowa pytania', order: 2 }, // i18n-ignore
      blocks: [
        { type: 'heading', level: 2, text: '1. Słowa pytania' }, // i18n-ignore
        { type: 'paragraph', text: 'W dwóch pierwszych pytaniach pada czasownik agapao, w trzecim — phileo.' } // i18n-ignore
      ]
    }
  ]
};

/** 2026-10-26 — ein Werk mit Text hat keine Felder der Musik; ihre Beispiele gehören nicht hierher. */
const TEXT_TYPES: readonly string[] = WORK_TYPES.filter((t) => !MUSIC_TYPES.has(t.value)).map((t) => t.value);
const forText = (def: LibKind): LibKind => ({
  kind: def.kind, label: def.label, plural: def.plural, says: def.says, keyed: def.keyed, title: def.title, sort: def.sort, example: def.example,
  fields: def.fields.filter((f) => f.when === undefined || TEXT_TYPES.some((workType) => f.when!({ workType })))
});

/**
 * Wie man ein Werk MIT seinem Text als ein Dokument schreibt — für Mensch und KI. 2026-10-30 — am Ende „Jak
 * aplikacja używa tych danych" einmal für beides: das Werk (ein Eintrag der Bibliothek) und der Text
 * (`SOURCE_TEXT_USE`; der Abschnitt des Textformats selbst bleibt darum weg).
 */
export function workWithTextDescription(scheme?: SchemeId): string {
  const work = forText(kindOf('work')!);
  const person = forText(kindOf('person')!);
  return `${t('librarySource.withWork.head', { format: SOURCE_FORMAT, version: SOURCE_VERSION })}
${kindsDoc([work, person])}

${sourceTextDescription(scheme, { usage: false }).replace(/^# .*\n/, `${t('librarySource.withWork.textHead')}\n`)}
${t('librarySource.withWork.exampleHead')}
${JSON.stringify(WORK_WITH_TEXT_EXAMPLE, null, 2)}

${t('librarySource.withWork.use')}
${sourceTextUse()}
`;
}

/** Der Auftrag für die eigene KI: Werk + Text aus einer Datei (PDF, Scan). */
export function workWithTextPrompt(): string {
  return `${t('librarySource.withWork.prompt')}
${mathAsk()}

${workWithTextDescription()}`;
}
