/**
 * DAS SKRYPTORIUM ALS JSON (2026-10-23) — hinaus, herein, und die
 * Beschreibung daneben (siehe [[json-import-export]]).
 *
 * <code>
 *   { "format": "recreatio/scriptorium", "version": 1, "name": "…",
 *     "entries": [ { "id", "kind", "key", "data": { … } } ] }
 *   kind: "texttype" | "text" | "delivery" | "project"
 * </code>
 *
 * Dieselbe Maschine wie die Bibliothek (`library/libraryJson.ts`, `FormatSpec`):
 * an Ort und Stelle ändern, nur genannte Felder, Verweise als Kennung oder
 * `@schlüssel`, nichts wird gelöscht. Dazu zweierlei:
 *
 *   - ein Rodzaj tekstu trägt Felder (`fields`) wie ein Rodzaj in Nauka; ein
 *     Verweisfeld nennt seine Ziele (`to`) beim Namen eines Rodzaj in Nauka
 *     („Tajemnica") oder als `work`, `quote`, `person`, `text`;
 *   - ein Text eines Rodzaju trägt dessen Felder als weitere Schlüssel in
 *     `data`; ein Verweis darin darf ein Eintrag in Nauka BEIM NAMEN sein
 *     („Zwiastowanie") — gefunden unter den Einträgen der Rodzaje des Feldes.
 *
 * Quellen (Werke, Zitate, Personen) gehören in die Bibliothek: eine Datei mit
 * ihnen wird abgewiesen, mit dem Format, in das sie gehört.
 */

import { readAmount, planLibraryImport, exportLibrary, kindsDoc, LIBRARY_FORMAT, MARKUP_DOC, BIBLE_DOC, SCRIPTORIUM_FORMAT, type ExtraField, type FormatSpec, type ImportBase, type LibraryImportPlan } from '../library/libraryJson';
import { isUuid } from '../library/library';
import { slug, WRITING_KINDS, type LibEntry, type Lookup } from '../library/libraryKinds';
import { CORE_KEYS, TEXT_TYPE_FIELD_TYPES, typeFieldsOf, type TypeField } from './textTypes';

export { SCRIPTORIUM_FORMAT };
export const SCRIPTORIUM_VERSION = 1;

/** Was der Import über Nauka wissen kann — ohne sie bleiben Namen Namen (mit einer Warnung). */
export interface ScriptoriumContext {
  /** Ein Rodzaj in Nauka: Kennung oder Name → seine Kennung. */
  readonly kindRef?: (token: string) => string | null;
  /** Ein Eintrag in Nauka beim Namen, unter den Einträgen dieser Rodzaje → seine Kennung. */
  readonly entryByName?: (name: string, kinds: readonly string[]) => string | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const FIELD_KEY = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;
/** Ziele eines Verweisfeldes, die keine Rodzaje in Nauka sind: die Quellen der Bibliothek und ein anderer Text. */
const PLAIN_TARGETS: ReadonlySet<string> = new Set(['work', 'quote', 'person', 'text']);

const SOURCES_NAMED: Readonly<Record<string, string>> = { work: 'źródła', quote: 'cytaty', person: 'osoby' };

/** Die Grundgestalt (ohne Rodzaje tekstów eines Dokuments) — für den Export und die Beschreibung. */
const BASE_SPEC: FormatSpec = {
  format: SCRIPTORIUM_FORMAT,
  version: SCRIPTORIUM_VERSION,
  kinds: WRITING_KINDS,
  saveOrder: ['texttype', 'project', 'text', 'delivery'],
  elsewhere: (kind) => SOURCES_NAMED[kind] !== undefined
    ? `${SOURCES_NAMED[kind]} są w Bibliotece — importuje się je tam (format "${LIBRARY_FORMAT}")`
    : kind === 'comment' ? 'komentarze są własnym rodzajem w Wiedzy — gotowy schemat: plik templates/cogita/komentarz.json'
    : kind === 'topic' ? 'tematów już nie ma — porządek dają własne rodzaje w Wiedzy, połączone polami-odwołaniami (np. pola rodzaju tekstu)'
    : null
};

/* -- Die Felder eines Rodzaj tekstu lesen -------------------------------------------------------- */

function readTypeFields(value: unknown, where: string, warn: (line: string) => void, ctx: ScriptoriumContext): unknown {
  const out: Record<string, unknown>[] = [];
  for (const [index, raw] of (Array.isArray(value) ? value : []).entries()) {
    if (!isObject(raw)) { warn(`${where}: pole ${index + 1} nie jest obiektem — pominięte.`); continue; }
    const key = typeof raw.key === 'string' ? raw.key.trim() : '';
    if (!FIELD_KEY.test(key)) { warn(`${where}: klucz „${key}” — litery, cyfry i _, zaczyna się literą; pole pominięte.`); continue; }
    if (CORE_KEYS.has(key)) { warn(`${where}: klucz „${key}” należy do stałych pól tekstu — pole pominięte.`); continue; }
    if (out.some((f) => f.key === key)) { warn(`${where}: drugie pole „${key}” — pominięte.`); continue; }
    const type = String(raw.type ?? 'line');
    if (!(TEXT_TYPE_FIELD_TYPES as readonly string[]).includes(type)) { warn(`${where}: pole „${key}” — typ „${type}” nie jest dostępny w rodzaju tekstu (${TEXT_TYPE_FIELD_TYPES.join(', ')}); pole pominięte.`); continue; }
    const field: Record<string, unknown> = { key, label: typeof raw.label === 'string' && raw.label.trim() !== '' ? raw.label.trim() : key, type };
    if (raw.multi === true) field.multi = true;
    if (typeof raw.says === 'string' && raw.says.trim() !== '') field.says = raw.says.trim();
    if (type === 'number' && typeof raw.unit === 'string' && raw.unit.trim() !== '') field.unit = raw.unit.trim();
    if (type === 'choice') {
      field.options = (Array.isArray(raw.options) ? raw.options : []).flatMap((o) => (typeof o === 'string' && o.trim() !== '' ? [{ value: o.trim(), label: o.trim() }]
        : isObject(o) && typeof o.value === 'string' && o.value.trim() !== '' ? [{ value: o.value.trim(), label: typeof o.label === 'string' && o.label.trim() !== '' ? o.label.trim() : o.value.trim() }] : []));
    }
    if (type === 'ref') {
      const to: string[] = [];
      for (const target of Array.isArray(raw.to) ? raw.to : typeof raw.to === 'string' ? [raw.to] : []) {
        const token = String(target).trim().replace(/^@/, '');
        if (token === '') continue;
        if (PLAIN_TARGETS.has(token)) { to.push(token); continue; }
        const id = ctx.kindRef?.(token) ?? (isUuid(token) ? token : null);
        if (id === null) { warn(`${where}: pole „${key}” — nie ma w Wiedzy rodzaju „${token}”; to ograniczenie pominięte (pole wskaże dowolny wpis).`); continue; }
        to.push(id);
      }
      if (to.length > 0) field.to = to;
      if (raw.locator === true) field.locator = true;
    }
    out.push(field);
  }
  return out;
}

/* -- Die Werte der Felder eines Rodzaj tekstu lesen -------------------------------------------- */

const yes = (v: unknown): boolean | null => {
  if (v === true || v === false) return v;
  const s = slug(String(v));
  return ['tak', 'yes', 'true', '1'].includes(s) ? true : ['nie', 'no', 'false', '0'].includes(s) ? false : null;
};

/** Wie ein Wert eines Feldes aus dem Dokument gelesen wird. */
function readerFor(field: TypeField, ctx: ScriptoriumContext): ExtraField['read'] {
  const one = (raw: unknown, where: string, x: Parameters<ExtraField['read']>[2]): unknown => {
    switch (field.type) {
      case 'number': {
        const n = readAmount(raw);
        if (n === null) { x.warn(`${where}: „${String(raw)}” to nie liczba — pominięte.`); return undefined; }
        return n;
      }
      case 'bool': {
        const b = yes(raw);
        if (b === null) { x.warn(`${where}: „${String(raw)}” — tak albo nie; pominięte.`); return undefined; }
        return b;
      }
      case 'date': {
        const s = String(raw).trim();
        if (!/^-?\d{1,4}(-\d{2}(-\d{2})?)?$/.test(s)) { x.warn(`${where}: „${s}” to nie data (RRRR, RRRR-MM albo RRRR-MM-DD) — pominięte.`); return undefined; }
        return s;
      }
      case 'choice': {
        const s = String(raw).trim();
        const hit = field.options?.find((o) => o.value === s) ?? field.options?.find((o) => slug(o.label) === slug(s));
        if (hit === undefined) { x.warn(`${where}: nieznana wartość „${s}”.`); return s; }
        return hit.value;
      }
      case 'ref': {
        const value = isObject(raw) && 'value' in raw ? raw.value : raw;
        const locator = isObject(raw) && typeof raw.locator === 'string' && raw.locator.trim() !== '' ? raw.locator.trim() : undefined;
        const token = typeof value === 'string' ? value.trim() : '';
        if (token === '') return undefined;
        /* Kennung oder @schlüssel — sonst ein Eintrag in Nauka beim Namen. */
        const id = isUuid(token) || token.startsWith('@') || ctx.entryByName === undefined
          ? x.resolve(token, where)
          : ctx.entryByName(token, (field.to ?? []).filter((t) => !PLAIN_TARGETS.has(t))) ?? x.resolve(token, where);
        if (id === null) return undefined;
        return field.locator === true && locator !== undefined ? { value: id, locator } : id;
      }
      case 'list':
        return Array.isArray(raw) ? raw.map((s) => String(s).trim()).filter(Boolean) : String(raw).split('\n').map((s) => s.trim()).filter(Boolean);
      default:
        return typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : JSON.stringify(raw);
    }
  };
  return (value, where, x) => {
    if (field.multi && field.type !== 'list') {
      const list = (Array.isArray(value) ? value : [value]).map((v) => one(v, where, x)).filter((v) => v !== undefined);
      return list;
    }
    return one(Array.isArray(value) && field.type !== 'list' ? value[0] : value, where, x);
  };
}

/* -- Die Gestalt für EIN Dokument ---------------------------------------------------------------- */

/**
 * Das Format für ein Dokument: die Rodzaje tekstów darin (beim Schlüssel oder
 * der Kennung) und die schon da sind — ein Text darin bekommt die Felder seines
 * Rodzaju.
 */
export function scriptoriumSpec(doc: unknown, base: ImportBase, ctx: ScriptoriumContext = {}): FormatSpec {
  const list: unknown[] = Array.isArray(doc) ? doc : isObject(doc) && Array.isArray(doc.entries) ? doc.entries : [];
  const inDoc = new Map<string, unknown>();
  for (const raw of list) {
    if (!isObject(raw) || raw.kind !== 'texttype' || !isObject(raw.data)) continue;
    if (typeof raw.key === 'string' && raw.key.trim() !== '') inDoc.set(raw.key.trim().replace(/^@/, '').toLowerCase(), raw.data.fields);
    if (typeof raw.id === 'string' && raw.id.trim() !== '') inDoc.set(raw.id.trim().toLowerCase(), raw.data.fields);
  }
  const fieldsOf = (token: string, resolve: (token: string) => string | null): readonly TypeField[] => {
    const bare = token.trim().replace(/^@/, '').toLowerCase();
    /* Ein Rodzaj aus demselben Dokument: seine Felder, wie sie dort stehen (gelesen wie beim Import). */
    if (inDoc.has(bare)) return typeFieldsOf(readTypeFields(inDoc.get(bare), '', () => undefined, ctx));
    const id = resolve(token);
    const entry: LibEntry | undefined = id === null ? undefined : base.get(id);
    return entry !== undefined && entry.kind === 'texttype' ? typeFieldsOf(entry.data.fields) : [];
  };
  return {
    ...BASE_SPEC,
    readFields: (value, where, warn) => readTypeFields(value, where, warn, ctx),
    extraFields: (kind, data, resolve) => {
      if (kind !== 'text') return [];
      const token = typeof data.textType === 'string' ? data.textType : Array.isArray(data.textType) && typeof data.textType[0] === 'string' ? data.textType[0] : '';
      if (token === '') return [];
      return fieldsOf(token, resolve).map((field) => ({ key: field.key, read: readerFor(field, ctx) }));
    }
  };
}

/** Herein: was ein Dokument für dieses Skryptorium bedeuten würde. */
export const planScriptoriumImport = (doc: unknown, base: ImportBase, ctx: ScriptoriumContext = {}): LibraryImportPlan | { error: string } =>
  planLibraryImport(doc, base, scriptoriumSpec(doc, base, ctx));

/** Hinaus — mit `look` stehen im Zapis die Schlüssel. Nur die Arten des Skryptorium. */
export const exportScriptorium = (name: string, entries: readonly LibEntry[], look?: Lookup): Record<string, unknown> =>
  exportLibrary(name, entries, look, BASE_SPEC);

/** Die Gestalt ohne Dokument — für ein Formular, das einen Eintrag aus einer Antwort füllt (`patchFromDoc`). */
export const SCRIPTORIUM_SPEC: FormatSpec = BASE_SPEC;

/* -- Die Beschreibung --------------------------------------------------------------------------- */

const TEXT_WITH_TYPE = {
  format: SCRIPTORIUM_FORMAT,
  version: SCRIPTORIUM_VERSION,
  name: 'Kazania maryjne',
  entries: [
    {
      kind: 'texttype', key: 'kazanie-maryjne',
      data: {
        name: 'Kazanie maryjne',
        fields: [
          { key: 'tajemnica', label: 'Tajemnica', type: 'ref', to: ['Tajemnica'] },
          { key: 'obszar', label: 'Obszar', type: 'ref', to: ['Obszar'] },
          { key: 'fragment', label: 'Fragment Pisma', type: 'ref', to: ['work'], locator: true }
        ]
      }
    },
    {
      kind: 'text', key: 'zwiastowanie-modlitwa',
      data: {
        textType: '@kazanie-maryjne', title: 'Niech mi się stanie', date: '2026-03-25', occasion: 'Uroczystość Zwiastowania Pańskiego',
        tajemnica: 'Zwiastowanie', obszar: 'Modlitwa', fragment: { value: '@bt', locator: 'Łk 1,26-38' },
        plan: [{ id: 'p1', text: 'Maryja słucha, zanim odpowie [@bt, Łk 1,29]' }, { id: 'p2', text: 'Gdzie dziś słucham?', kind: 'question' }],
        body: 'Maryja „zmieszała się na te słowa i rozważała” [@bt, Łk 1,29].'
      }
    }
  ]
};

export function scriptoriumDescription(): string {
  return `# Skryptorium jako JSON ("${SCRIPTORIUM_FORMAT}", wersja ${SCRIPTORIUM_VERSION})

Co robi import:
Skryptorium to miejsce pisania: własne teksty ("text" — kazania, konferencje, rozważania, rozdziały), ich wygłoszenia ("delivery"), projekty ("project" — książka, cykl) i własne rodzaje tekstów ("texttype"). Tekst cytuje źródła z Biblioteki (dzieła, cytaty, osoby — format "${LIBRARY_FORMAT}") i wskazuje wpisy z Nauki (np. tajemnicę, słowo ze słownika, widok); w drugą stronę nic nie wskazuje na Skryptorium.
- Każdy wpis to { "id", "kind", "key", "data" }. Wpis z kennung z eksportu (albo z kluczem istniejącego wpisu tego samego rodzaju) jest ZMIENIANY — tylko pola podane w "data"; pola, których nie ma, zostają. Żeby wyczyścić pole, podaj null.
- Wpis bez kennung (albo z nieznaną) powstaje nowy. Import niczego nie usuwa.
- Odwołania mogą być kennungami albo kluczami: "@kazanie-chleb", "@ratzinger2007". Klucze z tego samego dokumentu też działają.
- Plik z dziełami, cytatami, osobami, komentarzami albo tematami zostanie odrzucony — z informacją, gdzie go zaimportować.
- Kto widzi wpis, decyduje wyłącznie obszar skryptorium: członkowie obszaru, a gdy obszar jest publiczny — wszyscy. Tekst staje się publiczny, gdy przeniesie się go do skryptorium obszaru publicznego (zachowuje kennungę).
Zwróć JEDEN obiekt JSON, bez komentarzy.

{
  "format": "${SCRIPTORIUM_FORMAT}",
  "version": ${SCRIPTORIUM_VERSION},
  "name": "Moje skryptorium",
  "entries": [ { "kind": "texttype", "key": "kazanie-maryjne", "data": { … } }, { "kind": "text", "data": { … } }, … ]
}

## Rodzaje wpisów
${kindsDoc(WRITING_KINDS)}

## Rodzaj tekstu i jego pola
Rodzaj tekstu ("texttype") to nazwa i dodatkowe pola, które ma każdy tekst tego rodzaju — obok stałych pól tekstu (tytuł, data, plan, treść …). Pola opisuje się jak pola rodzaju w Nauce: {"key", "label", "type", "multi", "options", "to", "locator", "says"}; "type": ${TEXT_TYPE_FIELD_TYPES.join(', ')}.
- "ref" — odwołanie: "to" to nazwy rodzajów w Nauce (np. ["Tajemnica"]) albo "work", "quote", "person" (Biblioteka) i "text" (inny tekst); "locator": true — z miejscem.
- Tekst tego rodzaju: "textType": "@klucz-rodzaju", a wartości pól jako zwykłe pola w "data" — pod kluczem pola. Odwołanie do wpisu w Nauce można podać jego kennungą albo NAZWĄ ("Zwiastowanie"); odwołanie z miejscem: {"value": "@bt", "locator": "Łk 1,26-38"}; kilka wartości ("multi": true) — lista.
- Klucze stałych pól tekstu są zajęte: ${[...CORE_KEYS.keys()].join(', ')}.
- Tekst bez rodzaju to zwykły tekst.

Przykład — rodzaj „Kazanie maryjne” i jedno kazanie tego rodzaju (z Pismem Świętym "@bt" z Biblioteki):
${JSON.stringify(TEXT_WITH_TYPE, null, 2)}

${MARKUP_DOC}

## Miejsce w źródle
${BIBLE_DOC}
`;
}
