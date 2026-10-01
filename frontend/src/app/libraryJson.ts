/**
 * DIE BIBLIOTHEK ALS JSON (0064) — hinaus, herein, und die Beschreibung
 * daneben (siehe [[json-import-export]]: jede Möglichkeit hat ihr JSON).
 *
 * <code>
 *   { "format": "recreatio/library", "version": 1, "name": "…",
 *     "entries": [ { "id", "kind", "key", "data": { … } } ] }
 * </code>
 *
 * <b>Herein ändert an Ort und Stelle:</b> ein Eintrag mit bekannter Kennung
 * (oder bekanntem Schlüssel derselben Art) wird geändert — nur die Felder,
 * die im Dokument stehen; was fehlt, bleibt. Alles andere entsteht neu.
 * Verweise dürfen Kennungen sein oder `@schlüssel` — so lässt sich eine
 * Bibliothek von Hand oder mit einem Sprachmodell schreiben, ohne eine
 * einzige Kennung zu kennen. Gelöscht wird nie.
 *
 * Die Beschreibung entsteht aus `libraryKinds.ts`; `app-library-check.mjs`
 * prüft, dass jedes Feld beschrieben ist.
 */

import { newId } from './ids';
import { isUuid } from './library';
import { KINDS, kindOf, outline, type EntryData, type LibEntry, type LibField } from './libraryKinds';

export const LIBRARY_FORMAT = 'recreatio/library';

export interface ExportEntry {
  readonly id: string;
  readonly kind: string;
  readonly key?: string;
  readonly data: EntryData;
}

/** Was eine Bibliothek (oder ein Ausschnitt) als Dokument ist. */
export function exportLibrary(name: string, entries: readonly LibEntry[]): Record<string, unknown> {
  const order = new Map(KINDS.map((k, i) => [k.kind, i]));
  const sorted = [...entries].sort((a, b) => (order.get(a.kind) ?? 99) - (order.get(b.kind) ?? 99));
  return {
    format: LIBRARY_FORMAT,
    version: 1,
    name,
    entries: sorted.map((e): ExportEntry => ({ id: e.id, kind: e.kind, ...(e.key === undefined ? {} : { key: e.key }), data: e.data }))
  };
}

/* -- Herein ----------------------------------------------------------------------------------- */

export interface ImportDraft {
  readonly id: string;
  readonly kind: string;
  readonly key?: string;
  readonly data: EntryData;
  readonly existing: boolean;
}

export interface LibraryImportPlan {
  readonly drafts: readonly ImportDraft[];
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

/** Was der Plan vom Bestand wissen muss. */
export interface ImportBase {
  get(id: string): LibEntry | undefined;
  byKey(key: string): LibEntry | undefined;
}

/** In welcher Reihenfolge gespeichert wird: wer genannt wird, zuerst (der Schlüssel eines Zitats folgt seinem Werk). */
const SAVE_ORDER = ['person', 'topic', 'work', 'quote', 'project', 'text'];

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function planLibraryImport(doc: unknown, base: ImportBase): LibraryImportPlan | { error: string } {
  const root = asRecord(doc);
  const list: unknown[] = Array.isArray(doc) ? doc
    : Array.isArray(root.entries) ? root.entries
    : typeof root.kind === 'string' && typeof root.data === 'object' ? [root]
    : [];
  if (list.length === 0) return { error: 'To nie jest dokument biblioteki — brakuje "entries" (albo "kind" i "data").' };
  if (root.format !== undefined && root.format !== LIBRARY_FORMAT) return { error: `Inny format: „${String(root.format)}”, a tu przyjmowany jest "${LIBRARY_FORMAT}".` };

  const warnings: string[] = [];

  /* 1. Wer ist wer: bekannt (Kennung oder Schlüssel derselben Art) oder neu. */
  const placed: { raw: Record<string, unknown>; id: string; kind: string; key?: string; existing: LibEntry | undefined }[] = [];
  const keyToId = new Map<string, string>();
  const usedIds = new Set<string>();

  list.forEach((one, index) => {
    const raw = asRecord(one);
    const kind = typeof raw.kind === 'string' ? raw.kind : '';
    if (kindOf(kind) === undefined) { warnings.push(`Wpis ${index + 1}: nieznany rodzaj „${kind}” — pominięty.`); return; }
    const givenId = typeof raw.id === 'string' ? raw.id.trim() : '';
    const givenKey = typeof raw.key === 'string' && raw.key.trim() !== '' ? raw.key.trim().replace(/^@/, '') : undefined;

    let existing = isUuid(givenId) ? base.get(givenId) : undefined;
    if (existing !== undefined && existing.kind !== kind) { warnings.push(`Wpis ${index + 1}: kennung należy do wpisu innego rodzaju — powstanie nowy.`); existing = undefined; }
    if (existing === undefined && givenKey !== undefined) {
      const byKey = base.byKey(givenKey);
      if (byKey !== undefined && byKey.kind === kind) existing = byKey;
    }
    let id = existing?.id ?? (isUuid(givenId) && base.get(givenId) === undefined ? givenId : newId());
    if (usedIds.has(id)) { warnings.push(`Wpis ${index + 1} powtarza wpis z tego samego dokumentu — pominięty.`); return; }
    usedIds.add(id);
    if (givenKey !== undefined) keyToId.set(givenKey.toLowerCase(), id);
    placed.push({ raw, id, kind, ...(givenKey === undefined ? {} : { key: givenKey }), existing });
  });

  /* 2. Verweise: Kennung, `@schlüssel` oder blosser Schlüssel. */
  const resolve = (value: unknown, where: string): string | null => {
    if (typeof value !== 'string' || value.trim() === '') return null;
    const v = value.trim();
    if (isUuid(v) && (usedIds.has(v) || base.get(v) !== undefined)) return v;
    const key = v.replace(/^@/, '').toLowerCase();
    const id = keyToId.get(key) ?? base.byKey(key)?.id;
    if (id === undefined) warnings.push(`${where}: nie znaleziono „${v}” — odwołanie pominięte.`);
    return id ?? null;
  };

  const coerce = (field: LibField, value: unknown, where: string): unknown => {
    if (value === null) return null;
    switch (field.type) {
      case 'ref': {
        const one = Array.isArray(value) ? value[0] : value;
        return resolve(one, where);
      }
      case 'refs':
        return (Array.isArray(value) ? value : [value]).map((one) => resolve(one, where)).filter((id): id is string => id !== null);
      case 'outline':
        return (Array.isArray(value) ? value : []).map((item) => {
          const o = asRecord(item);
          if (typeof o.heading === 'string') return { heading: o.heading };
          const id = resolve(o.text, where);
          return id === null ? null : { text: id };
        }).filter((x) => x !== null);
      case 'number': {
        const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
        if (!Number.isFinite(n)) { warnings.push(`${where}: „${String(value)}” to nie liczba — pominięte.`); return null; }
        return n;
      }
      case 'select': {
        const s = String(value);
        if (field.options !== undefined && !field.options.some((o) => o.value === s)) warnings.push(`${where}: nieznana wartość „${s}”.`);
        return s;
      }
      default:
        return Array.isArray(value) ? value.map(String).join('\n') : typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
  };

  /* 3. Die Felder — was im Dokument steht, ersetzt; was fehlt, bleibt. */
  const drafts: ImportDraft[] = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const one of placed) {
    const def = kindOf(one.kind)!;
    const given = asRecord(one.raw.data);
    const data: EntryData = { ...(one.existing?.data ?? {}) };
    for (const [name, value] of Object.entries(given)) {
      const field = def.fields.find((f) => f.key === name);
      const where = `${def.label} „${String(given.title ?? given.name ?? given.text ?? one.key ?? '').slice(0, 40)}” · ${name}`;
      if (field === undefined) { warnings.push(`${where}: nieznane pole — pominięte.`); continue; }
      const next = coerce(field, value, where);
      if (next === null || next === '' || (Array.isArray(next) && next.length === 0 && field.type !== 'outline')) delete data[name];
      else data[name] = next;
    }
    if (one.kind === 'project' && Array.isArray(data.outline)) data.outline = outline(data);

    const key = one.key ?? one.existing?.key;
    if (one.existing !== undefined && JSON.stringify(one.existing.data) === JSON.stringify(data) && (one.existing.key ?? '') === (key ?? '')) {
      unchanged += 1;
      continue;
    }
    drafts.push({ id: one.id, kind: one.kind, ...(key === undefined ? {} : { key }), data, existing: one.existing !== undefined });
    if (one.existing === undefined) created += 1; else updated += 1;
  }

  drafts.sort((a, b) => SAVE_ORDER.indexOf(a.kind) - SAVE_ORDER.indexOf(b.kind));

  const byKind = KINDS.map((k) => [k.plural, drafts.filter((d) => d.kind === k.kind).length] as const).filter(([, n]) => n > 0);
  const lines = [
    `Nowe: ${created}, zmienione: ${updated}, bez zmian: ${unchanged}.`,
    ...(byKind.length === 0 ? [] : [byKind.map(([label, n]) => `${label}: ${n}`).join(' · ')])
  ];
  return { drafts, created, updated, unchanged, lines, warnings };
}

/* -- Die Beschreibung --------------------------------------------------------------------------- */

const TYPE_SAYS: Record<LibField['type'], string> = {
  line: 'tekst', text: 'tekst (może mieć wiele wierszy)', markup: 'tekst w zapisie treści (niżej)', number: 'liczba',
  date: 'data RRRR-MM-DD', select: 'jedna z wartości', url: 'adres https://…', ref: 'odwołanie: kennung albo "@klucz"',
  refs: 'lista odwołań: kennungi albo "@klucze"', outline: 'lista punktów planu'
};

export const MARKUP_DOC = `## Zapis treści (pola "body" i "further" tekstu)
  ## Śródtytuł            (# albo ## — śródtytuł, ### — mniejszy)
  Akapity oddziela pusta linia; pojedyncze przejście do nowej linii zostaje (psalmy, pieśni).
  **pogrubienie**  *kursywa*  [opis linku](https://…)
  [@klucz]                 odwołanie do źródła lub cytatu — staje się przypisem
  [@klucz, s. 23]          z miejscem w źródle
  [@bt, J 6,35; @klucz2]   kilka odwołań w jednym przypisie
  ^[treść przypisu]        własny przypis, bez źródła
  ![@klucz-cytatu]         cytat z biblioteki jako osobny blok, z podpisem skąd pochodzi
  > tekst                  wcięty cytat
  - punkt   ·   1. punkt
  ---                      linia oddzielająca
  \\znak                    znak bez znaczenia (np. \\* zamiast kursywy)
Przypisy liczą się same; pierwszy raz źródło jest podane w całości, potem skrótem z „dz. cyt.”, a tuż po sobie — „Tamże”. Pod tekstem pojawia się bibliografia.`;

export function libraryDescription(): string {
  const kinds = KINDS.map((def) => {
    const fields = def.fields.map((f) => `  "${f.key}" — ${f.label}: ${f.says} (${TYPE_SAYS[f.type]}${f.private === true ? '; prywatne — nigdy nie jest publikowane' : ''})`).join('\n');
    const example = { kind: def.kind, ...(def.example.key === undefined ? {} : { key: def.example.key }), data: def.example.data };
    return `### "${def.kind}" — ${def.label}\n${def.says}${def.keyed ? ' Ma klucz cytowania.' : ''}\n"data":\n${fields}\nPrzykład:\n${JSON.stringify(example, null, 2)}`;
  }).join('\n\n');

  return `# Biblioteka jako JSON ("${LIBRARY_FORMAT}", wersja 1)

Co robi import:
- Każdy wpis to { "id", "kind", "key", "data" }. Wpis z kennung z eksportu (albo z kluczem istniejącego wpisu tego samego rodzaju) jest ZMIENIANY — tylko pola podane w "data"; pola, których nie ma, zostają. Żeby wyczyścić pole, podaj null.
- Wpis bez kennung (albo z nieznaną) powstaje nowy. Import niczego nie usuwa.
- Odwołania ("authors", "work", "topics", "project", plan projektu) mogą być kennungami albo kluczami: "@ratzinger2007". Klucze z tego samego dokumentu też działają — można opisać całą bibliotekę, nie znając żadnej kennung.
- "key" to klucz cytowania: krótki, bez spacji (np. "ratzinger2007"); w tekstach odwołuje się do niego [@ratzinger2007, s. 23]. Pominięty — zostanie zaproponowany sam.
- Wszystko jest szyfrowane w przeglądarce kluczem obszaru biblioteki; publiczne staje się tylko to, co opublikujesz (pola prywatne nigdy).
Zwróć JEDEN obiekt JSON, bez komentarzy.

{
  "format": "${LIBRARY_FORMAT}",
  "version": 1,
  "name": "Moja biblioteka",
  "entries": [ { "kind": "person", "key": "ratzinger", "data": { … } }, … ]
}

## Rodzaje wpisów
${kinds}

${MARKUP_DOC}
`;
}
