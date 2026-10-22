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

import { newId } from '../core/ids';
import { blockData, blockOf, LEGACY_COMMENT_FIELDS, legacyBlocks, type CommentBlock, type Run } from './comment';
import { isUuid } from './library';
import { KINDS, kindOf, outline, slug, type EntryData, type LibEntry, type LibField } from './libraryKinds';

export const LIBRARY_FORMAT = 'recreatio/library';

/**
 * 2: seit 2026-10-22 — Komentarze als eigene Art, keine privaten Felder und
 * kein Veröffentlichen mehr. Eine Datei der Fassung 1 wird so gelesen: was
 * dort in `description`/`notes` eines Zitats, Werks (und `notes` jeder
 * anderen Art, `note` eines Planpunkts) stand, wird ein Komentarz über
 * diesen Eintrag.
 */
export const LIBRARY_VERSION = 2;

/** Die Zitate EINES Buches (`libraryQuotes.ts`) — sie gehören auf die Seite dieses Buches. */
const QUOTES_FORMAT = 'recreatio/quotes';

/**
 * Eine Zahl, wie sie Menschen und Kataloge schreiben: „384", „384 s.",
 * „20,5 cm". Was mehr ist als eine Zahl mit Einheit („24 x 17 cm"), ist
 * keine — lieber eine Warnung als eine falsche Höhe.
 */
export function readAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*[^\d\s]*\.?\s*$/u.exec(String(value));
  return m === null ? null : Number(m[1]!.replace(',', '.'));
}

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
    version: LIBRARY_VERSION,
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

/** In welcher Reihenfolge gespeichert wird: wer genannt wird, zuerst (der Schlüssel eines Zitats folgt seinem Werk; ein Wygłoszenie seinem Text). */
const SAVE_ORDER = ['person', 'topic', 'work', 'quote', 'project', 'text', 'delivery', 'comment'];

/** Eine Kennung für einen Punkt einer Liste — „p" und fünf Zeichen, eindeutig in der Liste. */
function itemId(taken: Set<string>): string {
  for (;;) {
    const id = `p${newId().replace(/-/g, '').slice(-5)}`;
    if (!taken.has(id)) return id;
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function planLibraryImport(doc: unknown, base: ImportBase): LibraryImportPlan | { error: string } {
  const root = asRecord(doc);
  const list: unknown[] = Array.isArray(doc) ? doc
    : Array.isArray(root.entries) ? root.entries
    : typeof root.kind === 'string' && typeof root.data === 'object' ? [root]
    : [];
  if (root.format === QUOTES_FORMAT) {
    return { error: `To są cytaty jednej książki ("${QUOTES_FORMAT}") — importuje się je na stronie tej książki: Źródła → książka → „Cytaty z tej książki”.` };
  }
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
        const n = readAmount(value);
        if (n === null) { warnings.push(`${where}: „${String(value)}” to nie liczba — pominięte.`); return null; }
        return n;
      }
      case 'items': {
        /*
         * 2026-10-21 — eine Liste von Objekten (die Punkte eines Plans): jedes
         * Feld nach seiner Art, Unbekanntes mit einer Warnung; ein Punkt ohne
         * (oder mit doppelter) Kennung bekommt eine neue.
         */
        const subs = field.item ?? [];
        const out: Record<string, unknown>[] = [];
        const unknown = new Set<string>();
        for (const raw of Array.isArray(value) ? value : []) {
          const given = typeof raw === 'string' ? { [subs.find((s) => s.type === 'markup')?.key ?? 'text']: raw } : asRecord(raw);
          const item: Record<string, unknown> = {};
          for (const [name, one] of Object.entries(given)) {
            const sub = subs.find((s) => s.key === name);
            if (sub === undefined) { unknown.add(name); continue; }
            const next = coerce(sub, one, `${where} · ${name}`);
            if (next !== null && next !== '' && !(Array.isArray(next) && next.length === 0)) item[name] = next;
          }
          if (Object.keys(item).length > 0) out.push(item);
        }
        if (unknown.size > 0) warnings.push(`${where}: nieznane pola punktów (${[...unknown].join(', ')}) — pominięte.`);
        if (subs.some((s) => s.key === 'id')) {
          const taken = new Set<string>();
          for (const item of out) {
            const id = typeof item.id === 'string' ? item.id.trim() : '';
            item.id = id === '' || taken.has(id) ? itemId(taken) : id;
            taken.add(item.id as string);
          }
        }
        return out;
      }
      case 'blocks': {
        const out: Record<string, unknown>[] = [];
        for (const [index, raw] of (Array.isArray(value) ? value : []).entries()) {
          const block = blockOf(raw);
          if (block === null) { warnings.push(`${where}: blok ${index + 1} nie ma rozpoznawalnej treści — pominięty.`); continue; }
          const runs = (cell: readonly Run[]): Run[] => cell.flatMap((run): Run[] => {
            if (!('ref' in run)) return [run];
            const id = resolve(run.ref, `${where} · blok ${index + 1}`);
            return id === null ? [] : [{ ref: id, ...(run.locator === undefined ? {} : { locator: run.locator }) }];
          });
          const fixed: CommentBlock = block.type === 'paragraph' ? block
            : block.type === 'table' ? { ...block, rows: block.rows.map((row) => row.map(runs)) }
            : { ...block, items: block.items.map(runs) };
          out.push(blockData(fixed));
        }
        return out;
      }
      case 'select': {
        const s = String(value);
        if (field.options === undefined || field.options.some((o) => o.value === s)) return s;
        /* „miękka" statt "soft": wer die Bezeichnung schreibt, meint den Wert. */
        const byLabel = field.options.find((o) => slug(o.label) === slug(s));
        if (byLabel !== undefined) return byLabel.value;
        warnings.push(`${where}: nieznana wartość „${s}”.`);
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

  const legacy: ImportDraft[] = [];
  const legacyComment = (about: string, value: string, point?: string) => {
    const blocks = legacyBlocks(value);
    if (blocks.length === 0) return;
    legacy.push({ id: newId(), kind: 'comment', data: { subjects: [{ ref: about, ...(point === undefined ? {} : { point }) }], blocks: blocks.map(blockData) }, existing: false });
  };

  for (const one of placed) {
    const def = kindOf(one.kind)!;
    const given = { ...asRecord(one.raw.data) };
    const data: EntryData = { ...(one.existing?.data ?? {}) };

    /*
     * 2026-10-22 — was in einer alten Datei in `description`/`notes` stand,
     * wird ein Komentarz über diesen Eintrag (derselbe Wert, der schon am
     * Eintrag liegt, gehört der Umstellung, nicht dem Import).
     */
    for (const { key } of LEGACY_COMMENT_FIELDS[one.kind] ?? []) {
      const value = given[key];
      delete given[key];
      if (typeof value !== 'string' || value.trim() === '' || value === one.existing?.data[key]) continue;
      legacyComment(one.id, value);
      warnings.push(`${def.label} · ${key}: z dawnego pola powstał komentarz w tej bibliotece — jeśli był prywatny, przenieś go do prywatnego obszaru.`);
    }
    if (one.kind === 'text' && Array.isArray(given.plan)) {
      const taken = new Set<string>();
      given.plan = given.plan.map((raw) => {
        const item = asRecord(raw);
        if (typeof item.note !== 'string' || item.note.trim() === '') return raw;
        const { note, ...rest } = item;
        const id = typeof rest.id === 'string' && rest.id.trim() !== '' ? rest.id.trim() : itemId(taken);
        taken.add(id);
        legacyComment(one.id, note as string, id);
        return { ...rest, id };
      });
    }

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

  drafts.push(...legacy);
  created += legacy.length;
  drafts.sort((a, b) => SAVE_ORDER.indexOf(a.kind) - SAVE_ORDER.indexOf(b.kind));

  const byKind = KINDS.map((k) => [k.plural, drafts.filter((d) => d.kind === k.kind).length] as const).filter(([, n]) => n > 0);
  const lines = [
    `Nowe: ${created}, zmienione: ${updated}, bez zmian: ${unchanged}.`,
    ...(byKind.length === 0 ? [] : [byKind.map(([label, n]) => `${label}: ${n}`).join(' · ')])
  ];
  return { drafts, created, updated, unchanged, lines, warnings };
}

/**
 * 2026-10-21 — EIN EINTRAG AUS EINEM DOKUMENT, FÜR EIN OFFENES FORMULAR: was
 * ein Sprachmodell für dieses Wygłoszenie (diesen Plan) geschrieben hat, geht
 * in das Formular, nicht am Formular vorbei in den Speicher — sonst stiesse
 * das Speichern des Formulars danach auf eine neuere Fassung. Geprüft wird
 * wie beim Import (`planLibraryImport`); heraus kommen nur die Felder, die
 * das Dokument nennt (`null`: leeren).
 */
export function patchFromDoc(doc: unknown, target: { readonly id: string; readonly kind: string }, base: ImportBase):
  { patch: EntryData; lines: readonly string[]; warnings: readonly string[] } | { error: string } {
  const root = asRecord(doc);
  const list: unknown[] = Array.isArray(doc) ? doc : Array.isArray(root.entries) ? root.entries : typeof root.kind === 'string' || typeof root.data === 'object' ? [root] : [];
  if (root.format !== undefined && root.format !== LIBRARY_FORMAT) return { error: `Inny format: „${String(root.format)}”, a tu przyjmowany jest "${LIBRARY_FORMAT}".` };
  const records = list.map(asRecord);
  const mine = records.find((one) => one.id === target.id) ?? (records.filter((one) => one.kind === target.kind || one.kind === undefined).length === 1
    ? records.find((one) => one.kind === target.kind || one.kind === undefined) : undefined);
  if (mine === undefined) return { error: records.length === 0 ? 'Brak wpisu — dokument powinien mieć "entries" z jednym wpisem.' : 'Nie ma tu wpisu dla tego formularza (sprawdź "id" i "kind").' };
  const given = asRecord(mine.data);
  if (Object.keys(given).length === 0) return { error: 'Wpis nie ma pól ("data").' };
  const planned = planLibraryImport({ format: LIBRARY_FORMAT, entries: [{ id: target.id, kind: target.kind, data: given }] }, base);
  if ('error' in planned) return planned;
  const draft = planned.drafts[0];
  const patch: EntryData = {};
  for (const key of Object.keys(given)) {
    if (kindOf(target.kind)?.fields.some((f) => f.key === key) !== true) continue;
    patch[key] = draft === undefined ? (base.get(target.id)?.data[key] ?? null) : (draft.data[key] ?? null);
  }
  const others = records.length - 1;
  return {
    patch,
    lines: [`Pola do wpisania w formularz: ${Object.keys(patch).join(', ') || 'żadne'}.`],
    warnings: [...planned.warnings, ...(others > 0 ? [`Pozostałe wpisy w dokumencie (${others}) są tu pomijane.`] : [])]
  };
}

/* -- Die Beschreibung --------------------------------------------------------------------------- */

const TYPE_SAYS: Record<LibField['type'], string> = {
  line: 'tekst', text: 'tekst (może mieć wiele wierszy)', markup: 'tekst w zapisie treści (niżej)', number: 'liczba',
  date: 'data RRRR-MM-DD', select: 'jedna z wartości', url: 'adres https://…', ref: 'odwołanie: kennung albo "@klucz"',
  refs: 'lista odwołań: kennungi albo "@klucze"', outline: 'lista punktów planu', items: 'lista obiektów o polach:',
  blocks: 'lista bloków (niżej: „Komentarz”)'
};

/** Ein Feld in der Beschreibung — bei `items` darunter seine Unterfelder. */
function fieldDoc(f: LibField, indent: string): string {
  const head = `${indent}"${f.key}" — ${f.label}: ${f.says} (${TYPE_SAYS[f.type]})`;
  if (f.type !== 'items') return head;
  return [head, ...(f.item ?? []).map((sub) => fieldDoc(sub, `${indent}    `))].join('\n');
}

export const MARKUP_DOC = `## Zapis treści (pola "body" i "further" tekstu, punkty planu "plan[].text", "transcript" i "added[].text" wygłoszenia)
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
    const fields = def.fields.map((f) => fieldDoc(f, '  ')).join('\n');
    const example = { kind: def.kind, ...(def.example.key === undefined ? {} : { key: def.example.key }), data: def.example.data };
    return `### "${def.kind}" — ${def.label}\n${def.says}${def.keyed ? ' Ma klucz cytowania.' : ''}\n"data":\n${fields}\nPrzykład:\n${JSON.stringify(example, null, 2)}`;
  }).join('\n\n');

  return `# Biblioteka jako JSON ("${LIBRARY_FORMAT}", wersja 1)

Co robi import:
- Każdy wpis to { "id", "kind", "key", "data" }. Wpis z kennung z eksportu (albo z kluczem istniejącego wpisu tego samego rodzaju) jest ZMIENIANY — tylko pola podane w "data"; pola, których nie ma, zostają. Żeby wyczyścić pole, podaj null.
- Wpis bez kennung (albo z nieznaną) powstaje nowy. Import niczego nie usuwa.
- Odwołania ("authors", "work", "topics", "project", plan projektu, "texts" wygłoszenia) mogą być kennungami albo kluczami: "@ratzinger2007". Klucze z tego samego dokumentu też działają — można opisać całą bibliotekę, nie znając żadnej kennung.
- Plan tekstu ("plan") to lista punktów; punkt bez "id" dostaje go sam. Wygłoszenie ("delivery") mówi o punktach po ich "id": co powiedziano ("coverage"), co doszło ("added"). Lista podana w imporcie zastępuje całą dotychczasową.
- Własne przemyślenia o źródłach, cytatach, fragmentach Pisma i innych komentarzach to osobne wpisy "comment" (niżej: „Komentarz”) — nie opisy w polach innych wpisów. Tekst osadza komentarz blokiem ![@klucz] i przywołuje go w przypisie [@klucz].
- "key" to klucz cytowania: krótki, bez spacji (np. "ratzinger2007"); w tekstach odwołuje się do niego [@ratzinger2007, s. 23]. Pominięty — zostanie zaproponowany sam.
- Liczby mogą mieć jednostkę ("384 s.", "20,5 cm"); pole wyboru przyjmuje wartość ("hard") albo jej nazwę ("Twarda").
- Cytaty z jednej książki (np. odczytane przez AI ze zdjęć) mają własny format "${QUOTES_FORMAT}" — importuje się je na stronie tej książki.
- Kto widzi wpis, decyduje wyłącznie obszar jego biblioteki: członkowie obszaru, a gdy obszar jest publiczny — wszyscy. Nie ma pól prywatnych ani publikowania pojedynczych wpisów; to, co ma zostać prywatne, idzie do biblioteki prywatnego obszaru.
Zwróć JEDEN obiekt JSON, bez komentarzy.

{
  "format": "${LIBRARY_FORMAT}",
  "version": ${LIBRARY_VERSION},
  "name": "Moja biblioteka",
  "entries": [ { "kind": "person", "key": "ratzinger", "data": { … } }, … ]
}

## Rodzaje wpisów
${kinds}

${COMMENT_DOC}

${MARKUP_DOC}
`;
}

/** Wie ein Komentarz gebaut ist — mit einem ganzen Beispiel samt Tabelą (dla AI, które przygotowuje import). */
export const COMMENT_DOC = `## Komentarz ("comment") — jak go zbudować
Komentarz to osobny wpis: przemyślenie, które można osadzić w wielu tekstach. Ma dwie części.
1. "subjects" — o czym jest: jeden albo więcej wpisów, każdy z miejscem. { "ref": "@klucz", "locator": "Łk 1,35" }. Fragment Pisma to Pismo Święte (wpis "work" z "workType": "bible") plus miejsce. Przy tekście można wskazać punkt jego planu: { "ref": "@klucz-tekstu", "point": "p4k2x" }. Synteza to komentarz, którego "subjects" (albo bloki) wskazują inne komentarze.
2. "blocks" — treść jako bloki; forma niesie znaczenie, innych bloków (np. nagłówków) nie ma:
  { "type": "paragraph", "text": "…" }                         proza, w zapisie treści (pogrubienie, kursywa, przypisy [@klucz, s. 3])
  { "type": "ordered", "items": [ komórka, … ] }               kolejność ma znaczenie: tok myśli, następstwo
  { "type": "unordered", "items": [ komórka, … ] }             równorzędne punkty
  { "type": "table", "columns": ["…", "…"], "rows": [ [komórka, komórka], … ] }   porównanie: każdy wiersz porównuje to samo w kolumnach
Komórka (i punkt listy) to lista kawałków: { "text": "zapis treści" } albo { "ref": "@klucz", "locator": "Dz 1,8" } — PRAWDZIWE odwołanie, nie tekst, który je udaje. Sam napis "…" znaczy { "text": "…" }.
Nie dodawaj rodzaju komentarza ani stopnia pewności — waga twierdzenia należy do jego słów.

Przykład — całość w jednym dokumencie (Pismo Święte jako źródło i komentarz z tabelą zestawiającą fragmenty):
${JSON.stringify({
  format: LIBRARY_FORMAT,
  version: LIBRARY_VERSION,
  entries: [
    { kind: 'work', key: 'bt', data: { workType: 'bible', title: 'Pismo Święte Starego i Nowego Testamentu', siglum: 'BT' } },
    {
      kind: 'comment', key: 'wniebowstapienie-paralele',
      data: {
        subjects: [{ ref: '@bt', locator: 'Łk 1,35' }, { ref: '@bt', locator: 'Dz 1,8' }],
        blocks: [
          { type: 'paragraph', text: 'Łukasz opisuje zstąpienie Ducha na Maryję i na Kościół tymi samymi słowami.' },
          {
            type: 'table', columns: ['Łk 1–2', 'Łk 24 / Dz 1'],
            rows: [
              [[{ ref: '@bt', locator: 'Łk 1,35' }], [{ ref: '@bt', locator: 'Dz 1,8' }]],
              [[{ ref: '@bt', locator: 'Łk 2,19' }], [{ ref: '@bt', locator: 'Dz 1,14' }]],
              ['Duch Święty zstąpi na ciebie', 'gdy Duch Święty zstąpi na was']
            ]
          },
          { type: 'ordered', items: ['Najpierw Maryja przyjmuje Ducha', [{ text: 'potem Kościół: ' }, { ref: '@bt', locator: 'Dz 2,1-4' }]] }
        ]
      }
    }
  ]
}, null, 2)}`;
