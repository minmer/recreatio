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
import { plural } from '../core/plural';
import { kindsDoc, LIBRARY_FORMAT, LIBRARY_VERSION, planLibraryImport, type ImportBase, type LibraryImportPlan } from './libraryJson';
import { kindOf, workTitle, type LibEntry } from './libraryKinds';
import type { LibraryStore } from './libraryStore';
import { SCHEMES, schemeOf, workScheme, type SchemeId } from './locations';
import {
  nextManifest, overlapsWith, PART_KIND, pageRangeLabel, partData, planSourceImport, portionDocs, readManifest, readPart, samePart,
  SOURCE_FORMAT, SOURCE_VERSION, sourceTextDescription, TEXT_KIND, type TextManifest
} from './sourceText';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (n: number, one: string, few: string, many: string) => `${n} ${plural(n, one, few, many)}`;

export interface ImportSay {
  readonly lines: string[];
  readonly warnings: string[];
}

/* -- Die Teile zu einem Werk ------------------------------------------------------------------- */

/** Was die Teile ändern würden — vor dem Speichern, ohne etwas zu speichern. */
export function previewPortions(work: LibEntry, manifest: TextManifest | undefined, docs: readonly unknown[]): ImportSay | { error: string } {
  const lines: string[] = [];
  const warnings: string[] = [];
  let running = manifest;
  for (const [i, raw] of docs.entries()) {
    const plan = planSourceImport(raw, { work, ...(running === undefined ? {} : { manifest: running }) });
    const label = docs.length > 1 ? `Część ${i + 1}: ` : '';
    if ('error' in plan) { if (docs.length === 1) return plan; warnings.push(`${label}${plan.error}`); continue; }
    const s = plan.summary;
    const range = s.first === undefined ? '' : `, miejsca ${s.first}${s.last !== s.first ? ` – ${s.last}` : ''}`;
    const pages = s.pages === undefined ? '' : `, ${pageRangeLabel(s.pages)}`;
    lines.push(`${plan.replaces ? 'Zastąpi' : 'Doda'} część „${plan.portion.label}” (${plan.portion.key}): ${count(s.blocks, 'blok', 'bloki', 'bloków')}, ${count(s.words, 'słowo', 'słowa', 'słów')}${range}${pages}${s.notes > 0 ? `, ${count(s.notes, 'przypis', 'przypisy', 'przypisów')}` : ''}.`);
    if (plan.setScheme !== undefined) lines.push(`${label}Układ miejsc dzieła: ${schemeOf(plan.setScheme).label} („${plan.setScheme}”).`);
    for (const other of overlapsWith(running, plan)) warnings.push(`${label}część „${other}” obejmuje te same miejsca — czy to nie ten sam fragment pod innym kluczem?`);
    warnings.push(...plan.warnings.map((w) => `${label}${w}`));
    running = readManifest(nextManifest(running, work.id, plan, 'preview'));
  }
  if (lines.length === 0) return { error: warnings[0] ?? 'Nic do zaimportowania.' };
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
}): Promise<ImportSay> {
  const { target, work, docs, stage, workStore } = opts;
  const lines: string[] = [];
  const warnings: string[] = [];
  let current = target.ownTexts(work.id)[0];
  let read = current === undefined ? undefined : readManifest(current.data);
  const textId = current?.id ?? newId();
  for (const [i, raw] of docs.entries()) {
    const plan = planSourceImport(raw, { work, ...(read === undefined ? {} : { manifest: read }) });
    if ('error' in plan) { warnings.push(`Część ${i + 1}: ${plan.error}`); continue; }
    const had = read?.parts.find((p) => p.key === plan.portion.key);
    if (had !== undefined) {
      const before = await target.heavy(had.id);
      if (before !== null && samePart(readPart(before.data), plan)) { lines.push(`„${plan.portion.label}”: bez zmian.`); continue; }
    }
    stage(`Zapisywanie części ${i + 1} z ${docs.length}…`);
    const partId = had?.id ?? newId();
    await target.save({ id: partId, kind: PART_KIND, data: partData(textId, work.id, plan) });
    current = await target.save({ id: textId, kind: TEXT_KIND, data: nextManifest(read, work.id, plan, partId) });
    read = readManifest(current.data);
    lines.push(`„${plan.portion.label}”: ${had === undefined ? 'dodana' : 'zastąpiona'}.`);
    warnings.push(...plan.warnings);
    if (plan.setScheme !== undefined && typeof work.data.scheme !== 'string' && workStore?.own(work.id) !== undefined) {
      await workStore.save({ id: work.id, kind: 'work', ...(work.key === undefined ? {} : { key: work.key }), data: { ...work.data, scheme: plan.setScheme } }).catch(() => {
        warnings.push('Nie udało się zapisać układu miejsc przy dziele — tekst ma go i tak.');
      });
    }
  }
  return { lines: lines.length === 0 ? ['Nic nie zapisano.'] : lines, warnings };
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
  raw: unknown, base: ImportBase, textManifest: (workId: string) => TextManifest | undefined = () => undefined
): WorkWithTextPlan | { error: string } {
  if (!isObject(raw) || raw.format !== SOURCE_FORMAT) return { error: `Oczekiwano dokumentu "${SOURCE_FORMAT}" z dziełem ("work") i jego tekstem ("portions" albo "portion" i "blocks").` };
  if (raw.version !== SOURCE_VERSION) return { error: `Nieznana wersja ${String(raw.version)} — ta aplikacja czyta wersję ${SOURCE_VERSION}.` };

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
    if (work === undefined) return { error: 'Dzieła z "work" nie da się zapisać — sprawdź jego pola.' };
  } else if (typeof raw.work === 'string' && raw.work.trim() !== '') {
    const ref = raw.work.trim().replace(/^@/, '');
    work = base.get(ref) ?? base.byKey(ref);
    if (work === undefined || work.kind !== 'work') return { error: `Nie ma w bibliotece dzieła „${raw.work}” — opisz je w "work" jako obiekt (pola dzieła), a powstanie razem z tekstem.` };
    if (extra.length > 0) {
      const planned = planLibraryImport({ format: LIBRARY_FORMAT, version: LIBRARY_VERSION, entries: extra }, base);
      if ('error' in planned) return planned;
      library = planned;
    }
  } else {
    return { error: '"work" — dzieło: obiekt z polami nowego dzieła (np. {"key": "kowalski2020", "data": {"workType": "article", "title": "…"}}) albo klucz istniejącego ("@kowalski2020").' };
  }

  const docs = portionDocs(raw);
  const hasText = docs.some((d) => isObject(d) && (Array.isArray(d.blocks) || isObject(d.portion)));
  const text = hasText ? previewPortions(work, textManifest(work.id), docs) : { lines: [], warnings: ['Dokument nie ma tekstu ("portions" albo "portion" i "blocks") — zapisze się tylko dzieło.'] };
  if ('error' in text) return text;

  const title = workTitle(work.data);
  const isNew = base.get(work.id) === undefined;
  return {
    library,
    work,
    workIsNew: isNew,
    docs: hasText ? docs : [],
    lines: [
      `${isNew ? 'Nowe dzieło' : library.drafts.some((d) => d.id === work!.id) ? 'Uzupełni dzieło' : 'Dzieło'}: „${title}”${work.key === undefined ? '' : ` [@${work.key}]`}.`,
      ...(library.drafts.filter((d) => d.id !== work!.id).length > 0 ? [`Oprócz niego w bibliotece: ${library.drafts.filter((d) => d.id !== work!.id).map((d) => `${kindOf(d.kind)?.label ?? d.kind} „${String(d.data.title ?? d.data.surname ?? d.data.name ?? d.key ?? '')}”${d.existing ? ' (zmiana)' : ''}`).join(', ')}.`] : []),
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
    data: { workType: 'article', title: 'Miłość, która pyta', subtitle: 'O J 21,15-17', authors: ['@kowalski'], container: '@przeglad', year: '2020', volume: '12', issue: '2', pages: '45–60', language: 'pl' }
  },
  entries: [
    { kind: 'person', key: 'kowalski', data: { personType: 'person', givenNames: 'Jan', surname: 'Kowalski' } },
    { kind: 'work', key: 'przeglad', data: { workType: 'periodical', title: 'Przegląd Biblijny' } }
  ],
  scheme: 'pages',
  edition: { language: 'pl', pdfPageOffset: -44 },
  portions: [
    {
      portion: { key: 'wstep', label: 'Wstęp', order: 1 },
      blocks: [
        { type: 'page', page: '45', pdf: 1 },
        { type: 'heading', level: 1, text: 'Miłość, która pyta' },
        { type: 'paragraph', text: 'Trzykrotne pytanie Jezusa odpowiada trzykrotnemu zaparciu się Piotra.{{note 1}} Nie jest przesłuchaniem, lecz uzdrowieniem {{page 46 pdf 2}} pamięci.' },
        { type: 'note', id: '1', text: 'Por. J 18,15-27.' }
      ]
    },
    {
      portion: { key: 'rozdz-1', label: '1. Słowa pytania', order: 2 },
      blocks: [
        { type: 'heading', level: 2, text: '1. Słowa pytania' },
        { type: 'paragraph', text: 'W dwóch pierwszych pytaniach pada czasownik agapao, w trzecim — phileo.' }
      ]
    }
  ]
};

/** Wie man ein Werk MIT seinem Text als ein Dokument schreibt — für Mensch und KI. */
export function workWithTextDescription(scheme?: SchemeId): string {
  const work = kindOf('work')!;
  const person = kindOf('person')!;
  return `# Dzieło z pełnym tekstem jako JSON ("${SOURCE_FORMAT}", wersja ${SOURCE_VERSION})

Jeden dokument tworzy w Bibliotece wpis dzieła (książki, artykułu, rozdziału, dokumentu…), wpisy, na które ono wskazuje (autorzy, czasopismo, książka zbiorowa), i jego pełny tekst. Dzieło o kluczu, który już jest w bibliotece, zostaje uzupełnione (podane pola), nie zdublowane; tak samo autor albo czasopismo o istniejącym kluczu.

{
  "format": "${SOURCE_FORMAT}",
  "version": ${SOURCE_VERSION},
  "work": { "key": "nazwisko2020", "data": { … pola dzieła … } },   — albo "@klucz" dzieła, które już jest
  "entries": [ { "kind": "person", "key": "…", "data": { … } }, { "kind": "work", "key": "…", "data": { "workType": "periodical", … } } ],
  "scheme": "pages",          — jak wskazuje się miejsca w tym dziele (niżej)
  "edition": { … },           — opcjonalnie: przesunięcie stron PDF, język
  "portions": [ { "portion": { "key", "label", "order" }, "blocks": [ … ] }, … ]
}

- Odwołania w polach dzieła ("authors", "editors", "translators", "container") to klucze z "@": do wpisów z "entries" albo do takich, które już są w bibliotece.
- Opis dzieła bierz ze strony tytułowej, metryczki albo nagłówka artykułu; czego tam nie ma, nie wpisuj.

## Pola dzieła i osoby
${kindsDoc([work, person])}

${sourceTextDescription(scheme).replace(/^# .*\n/, '## Tekst\n')}
## Pełny przykład (artykuł w czasopiśmie, tekst w dwóch częściach)
${JSON.stringify(WORK_WITH_TEXT_EXAMPLE, null, 2)}
`;
}

/** Der Auftrag für die eigene KI: Werk + Text aus einer Datei (PDF, Scan). */
export function workWithTextPrompt(): string {
  return `Przekształć załączone źródło (PDF, skan albo plik z książką lub artykułem) w JEDEN dokument JSON do importu w Bibliotece Recreatio: opis dzieła (dane bibliograficzne ze strony tytułowej albo nagłówka artykułu), jego autorów i — jeśli to artykuł albo rozdział — czasopismo lub książkę, w której jest, oraz cały tekst podzielony na części.

Przepisz tekst wiernie — słowo w słowo, w kolejności oryginału, z podziałem na akapity, nagłówkami, listami, tabelami i przypisami, z granicami stron dokładnie tam, gdzie wypadają (także w środku akapitu). Nie poprawiaj, nie streszczaj, nie dopisuj niczego, czego nie ma w źródle. Co nieczytelne albo niepewne — oznacz. Jeśli całość nie zmieści się w jednej odpowiedzi, w pierwszej daj "work", "entries" i pierwsze części, a w następnych — "work": "@klucz-dzieła" i kolejne części.

${workWithTextDescription()}`;
}
