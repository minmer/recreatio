/**
 * COGITA — DAS SCHEMA EINER BIBLIOTHEK, wie es in ihr liegt (COGITA.md §2.2).
 *
 * <b>2026-10-23 — KEINE EINGEBAUTEN INHALTE.</b> Was eine Baza an Rodzajen hat,
 * schreibt ihr Besitzer (oder holt er als Vorlage: `templates/cogita/*.json` —
 * Komentarz, Słownik, Psałterz). Eingebaut bleibt nur, was der Motor braucht,
 * und was eine Baza aus den anderen Teilen LESEN muss:
 *
 * <code>
 *   question                 eine von Hand geschriebene Frage — Karten, Sitzungen,
 *                            Abläufe und Vorschläge stellen sie (bleibt eingebaut)
 *   work · quote · person    die Quellen der Bibliothek: Verweise, Szablony und
 *                            Powtórki über Bibliotheken lesen ihre Felder
 *   text · delivery · project  die Texte des Skryptorium (als Quelle einer Baza)
 * </code>
 *
 * <b>2026-10-23 (Schritt 5) — keine Themen mehr</b> (`topic`, seine Felder des
 * Lernens, Perspektywy): Ordnung geben eigene Rodzaje, verbunden über
 * Verweisfelder. Alte Themen stehen unter „Stare wpisy" (`oldInBase.ts`).
 *
 * <b>Rodzaje tekstów</b> eines Skryptorium, aus dem die Baza schöpft, sind hier
 * Rodzaje wie andere (`textTypeKind`): ein Text trägt seinen Rodzaj als zweite
 * Art (`entityOf`), seine Felder („Tajemnica", „Obszar") stehen neben den
 * festen — Widoki gruppieren und Macierze ordnen nach ihnen.
 *
 * `knowledge` (ein Satz Wissen) und der Komentarz der Bibliothek sind fort:
 * eine Aussage ist jetzt jeder Eintrag eines Rodzaj mit Feld `blocks`
 * (`statements.ts`). Alte Einträge der Art `knowledge` stehen unter „Stare wpisy".
 *
 * Die Arten der anderen Teile kommen aus `libraryKinds.ts`; hier werden sie zu
 * Arten wie jede andere: mit Feldern, einem Muster für das Etikett und ROLLEN,
 * an denen die eingebauten Werkzeuge ihre Felder erkennen. Wer sie ändert,
 * legt einen Eintrag der Art `kind` mit `builtin` an; ihre Felder bleiben.
 *
 * <b>Wie es gespeichert liegt</b> (was der Dienst sieht [B20]):
 *
 * <code>
 *   person · work · quote · text · delivery · project · texttype   die Arten der Bibliothek und des Skryptorium
 *   entity                                            jeder andere Eintrag; seine Arten in `_kinds`
 *   kind · template · revision · flow · look · rules · values · collection · view · settings · merge · contribution · addform · anchor
 *                                                     was das Schema, die Karten und die Abläufe beschreibt
 *                                                     (`addform`: ein Formularz dodawania, `addForm.ts`;
 *                                                     `anchor`: ein Wejście z Biblioteki, `anchors.ts`)
 * </code>
 *
 * Schlüssel mit `_` sind keine Felder (ein Feld beginnt mit einem Buchstaben,
 * `FIELD_KEY`): `_kinds` die Arten, `_checked` wann ein Autor zuletzt nachsah
 * [C7]. Sie fallen weg, bevor das Schema die Daten sieht.
 */

import { KINDS as LIBRARY_KINDS, type LibEntry, type LibField, type LibFieldType } from '../library/libraryKinds';
import { readKind, type Entity, type FieldDef, type FieldType, type KindDef } from './schema';
import { QUANTITY_KINDS } from '../core/quantities';

/** Die Art im Klartext für jeden Eintrag, der keine eingebaute ist. */
export const ENTITY = 'entity';

/** 2026-10-23 — der frühere eingebaute „Wiedza": kein Rodzaj mehr, nur noch das Merkmal alter Einträge. */
export const LEGACY_KNOWLEDGE = 'knowledge';

/** Was das Schema, die Karten, die Abläufe und die Einstellungen beschreibt — kein Eintrag, den man lernt. */
export const DOC_KINDS = ['kind', 'template', 'revision', 'flow', 'look', 'rules', 'values', 'collection', 'view', 'settings', 'merge', 'contribution', 'addform', 'anchor'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_LABEL: Record<DocKind, string> = {
  addform: 'Formularz dodawania',
  /* 2026-10-25 (Wywód) — ein Weg aus der Bibliothek: ein Werk (ganz oder Teile davon) → ein Eintrag, ein Widok (`anchors.ts`). */
  anchor: 'Wejście z Biblioteki',
  kind: 'Rodzaj',
  template: 'Szablon kart',
  revision: 'Powtórka',
  flow: 'Przebieg',
  look: 'Wygląd',
  rules: 'Zasady sesji',
  values: 'Wartości',
  collection: 'Zbiór',
  view: 'Widok',
  settings: 'Ustawienia',
  merge: 'Połączenie',
  contribution: 'Propozycja'
};

export const isDocKind = (kind: string): kind is DocKind => (DOC_KINDS as readonly string[]).includes(kind);

/* -- Die eingebauten Arten als Schema ----------------------------------------------- */

const TYPE_OF: Record<LibFieldType, FieldType> = {
  line: 'line', text: 'text', markup: 'markup', number: 'number', date: 'date',
  select: 'choice', url: 'url', ref: 'ref', refs: 'ref', outline: 'outline',
  /* 2026-10-21 — eine Liste von Objekten (der Plan eines Textes): hier nur zum Lesen, nie geschrieben. */
  items: 'list',
  /* 2026-10-23 — die Felder eines Rodzaj tekstu (Skryptorium); keine eingebaute Art von Nauka hat sie. */
  fields: 'list',
  /* 2026-10-22 — Bausteine (`blocks`): seit 2026-10-23 ein Feldtyp von Nauka wie jeder andere. */
  blocks: 'blocks'
};

function fromLibrary(f: LibField): FieldDef {
  const type = TYPE_OF[f.type];
  return {
    key: f.key,
    label: f.label,
    type,
    multi: f.type === 'refs',
    uncertain: false,
    options: type === 'choice' ? (f.options ?? []).map((o) => ({ value: o.value, label: o.label })) : undefined,
    to: type === 'ref' ? [...(f.to ?? [])] : undefined,
    role: f.key,
    says: f.says
  };
}

/** Wie das Etikett einer eingebauten Art aus ihren Feldern entsteht — und was Gleichnamige unterscheidet. */
const PATTERNS: Record<string, { label: string; tells?: string }> = {
  person: { label: '{name} {givenNames} {surname}', tells: 'years' },
  work: { label: '{title}: {subtitle}', tells: 'year' },
  quote: { label: '{text}', tells: 'locator' },
  text: { label: '{title}', tells: 'date' },
  project: { label: '{title}', tells: 'projectType' },
  delivery: { label: '{date} {occasion}', tells: 'place' }
};

const field = (key: string, label: string, type: FieldType, more: Partial<FieldDef> = {}): FieldDef =>
  ({ key, label, type, multi: false, uncertain: false, ...more });

function builtin(id: string): KindDef {
  const lib = LIBRARY_KINDS.find((k) => k.kind === id)!;
  const fields = lib.fields.map(fromLibrary);
  const more: readonly FieldDef[] = [];
  return {
    id,
    name: lib.label,
    label: PATTERNS[id]?.label ?? `{${fields[0]?.key ?? 'title'}}`,
    tells: PATTERNS[id]?.tells,
    fields: [...fields, ...more.filter((m) => !fields.some((f) => f.key === m.key))],
    ...(id === 'text' ? { system: 'text' as const } : {})
  };
}

/** Eine von Hand geschriebene Frage [C4, D1] — die Felder, die `questionCard` liest. */
export const QUESTION: KindDef = {
  id: 'question',
  name: 'Pytanie',
  label: '{prompt}',
  tells: 'form',
  system: 'question',
  fields: [
    field('form', 'Forma odpowiedzi', 'choice', {
      options: [
        { value: 'text', label: 'Tekst' }, { value: 'number', label: 'Liczba' }, { value: 'date', label: 'Data' },
        { value: 'one', label: 'Jedna z kilku' }, { value: 'many', label: 'Kilka z kilku' }, { value: 'truefalse', label: 'Prawda / fałsz' },
        { value: 'order', label: 'Kolejność' }, { value: 'match', label: 'Dopasowanie' }, { value: 'gap', label: 'Luka w cytacie' },
        { value: 'flash', label: 'Fiszka (ocena własna)' }, { value: 'code', label: 'Kod (Python)' }, { value: 'point', label: 'Miejsce na mapie' },
        { value: 'interactive', label: 'Rysunek do poruszania' }
      ],
      says: 'Jak się odpowiada: text, number, date, one, many, truefalse, order, match, gap, flash, code, point, interactive (ustawia się rysunek — suwaki, przeciąganie — i sprawdza)'
    }),
    field('prompt', 'Pytanie', 'markup', { role: 'text', says: 'Treść pytania (dla luki: tekst z lukami [[słowo]])' }),
    field('answers', 'Poprawne odpowiedzi', 'list', { says: 'Przyjmowane odpowiedzi (tekst, liczba, data, luka) — pierwsza jest wzorcowa' }),
    field('options', 'Do wyboru', 'list', { says: 'Możliwości (one, many)' }),
    field('correct', 'Które są dobre', 'list', { says: 'Numery dobrych możliwości, od 0 (one, many)' }),
    field('items', 'W dobrej kolejności', 'list', { says: 'Elementy w poprawnej kolejności (order)' }),
    field('left', 'Lewa strona', 'list', { says: 'Lewa strona par (match)' }),
    field('right', 'Prawa strona', 'list', { says: 'Prawa strona par, w tej samej kolejności (match)' }),
    field('value', 'Prawda?', 'bool', { says: 'Czy zdanie jest prawdziwe (truefalse)' }),
    field('back', 'Odwrotna strona', 'list', { says: 'Co jest na odwrocie fiszki (flash)' }),
    field('tolerance', 'Tolerancja', 'number', { says: 'Ile wolno się pomylić (liczba; data — w jednostkach dokładności)' }),
    field('relative', 'Tolerancja względna', 'bool', { says: 'Tolerancja jako ułamek wartości (liczba)' }),
    field('unit', 'Jednostka', 'line', { says: 'Jednostka liczby' }),
    field('quantity', 'Wielkość', 'choice', { options: QUANTITY_KINDS.map((k) => ({ value: k.id, label: k.label })), says: 'Jaka wielkość (number): Torque, Energy, Mass, Length … — wtedy odpowiedź może mieć inną jednostkę tej wielkości (przeliczana), a jednostka innej wielkości jest błędem (12 J na pytanie o moment siły)' }),
    field('precision', 'Dokładność daty', 'choice', { options: [{ value: 'year', label: 'rok' }, { value: 'month', label: 'miesiąc' }, { value: 'day', label: 'dzień' }], says: 'year, month albo day' }),
    field('task', 'Zadanie', 'text', { says: 'Opis zadania (code)' }),
    field('starter', 'Początek kodu', 'text', { says: 'Kod na start, z def transform(x): (code)' }),
    field('createInput', 'Dane testowe', 'text', { says: 'def create_input(seed): … — dane do sprawdzenia (code)' }),
    field('reference', 'Rozwiązanie wzorcowe', 'text', { says: 'def reference(x): … — wynik, z którym porównuje się kod (code)' }),
    field('cases', 'Ile przypadków', 'number', { says: 'Na ilu danych sprawdzić (code)' }),
    field('place', 'Miejsce', 'geo', { says: 'Szukany punkt: {"lat": …, "lon": …} (point)' }),
    field('radius', 'Promień (m)', 'number', { says: 'Jak blisko trzeba trafić, w metrach (point)' }),
    field('drawing', 'Rysunek (JSON)', 'text', { says: 'Rysunek do poruszania — ten sam JSON co w module „Animacja” strony: vars, sim, controls, rules (z "goal": true — cel), world (rzeczy do budowania, np. waga), elements (interactive)' }),
    field('goal', 'Cel (wyrażenie)', 'line', { says: 'Kiedy odpowiedź jest dobra, np. "abs(x - cel) < 0.5 && y <= 0" — liczone w symulacji do końca; puste: reguły rysunku z "goal": true (interactive)' }),
    field('solution', 'Rozwiązanie', 'line', { says: 'Wartości, które rozwiązują zadanie, np. "kat = 45; v0 = 12" albo własności rzeczy "w2.pos = 5" — pokazywane po złej odpowiedzi; puste: "task.solve" rysunku (interactive)' }),
    field('explain', 'Wyjaśnienie', 'ref', { multi: true, says: 'Wpisy pokazywane po odpowiedzi (np. wypowiedź z treścią w blokach)' }),
    field('about', 'O czym', 'ref', { multi: true, inverse: 'pytania', says: 'Wpisy, których dotyczy pytanie' })
  ]
};

/** In dieser Reihenfolge stehen sie in Listen. */
const BASE: readonly KindDef[] = [
  ...['person', 'work', 'quote', 'text', 'delivery', 'project'].map(builtin),
  QUESTION
];

const BASE_BY_ID = new Map(BASE.map((k) => [k.id, k]));

/** Die eingebauten Arten der Bibliothek (mit ihrem Klartext im Dienst). */
export const LIBRARY_KIND_IDS: ReadonlySet<string> = new Set(LIBRARY_KINDS.map((k) => k.kind));

export const isBaseKind = (id: string): boolean => BASE_BY_ID.has(id);

export const baseKind = (id: string): KindDef | undefined => BASE_BY_ID.get(id);

/**
 * Eine geänderte eingebaute Art: Beschriftungen, Reihenfolge, Muster und neue
 * Felder aus dem Dokument — Typ, Rolle, Ziel und „prywatne" ihrer eigenen
 * Felder bleiben, wie die Bibliothek sie braucht, und keines fehlt.
 */
function overridden(base: KindDef, doc: KindDef): KindDef {
  const own = new Map(base.fields.map((f) => [f.key, f]));
  const fields: FieldDef[] = [];
  for (const f of doc.fields) {
    const was = own.get(f.key);
    /* Die Gestalt eines eingebauten Feldes (einfach, sicher, sein Typ) braucht die Bibliothek so — nur Beschriftung und Erklärung sind frei. */
    fields.push(was === undefined ? f : { ...was, label: f.label, says: f.says ?? was.says });
  }
  for (const f of base.fields) if (!fields.some((one) => one.key === f.key)) fields.push(f);
  return { ...base, name: doc.name || base.name, label: doc.label || base.label, tells: doc.tells ?? base.tells, fields };
}

/** Alle Arten einer Bibliothek: die eingebauten (wie geändert), dann die eigenen. */
export function kindDefs(entries: Iterable<LibEntry>): KindDef[] {
  const overrides = new Map<string, KindDef>();
  const own: KindDef[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'kind') continue;
    const builtinId = typeof entry.data.builtin === 'string' ? entry.data.builtin : null;
    const base = builtinId === null ? undefined : BASE_BY_ID.get(builtinId);
    if (base !== undefined) overrides.set(base.id, overridden(base, readKind(base.id, entry.data)));
    /* 2026-10-23 — die Änderung eines eingebauten Rodzaj, den es nicht mehr gibt (Wiedza, Komentarz, Temat): kein eigener Rodzaj — sie steht unter „Stare wpisy". */
    else if (builtinId === null) own.push(readKind(entry.id, entry.data));
  }
  return [...BASE.map((k) => overrides.get(k.id) ?? k), ...own];
}

/**
 * 2026-10-23 (Schritt 5) — EIN RODZAJ TEKSTU ALS RODZAJ: seine Kennung, sein
 * Name, seine Felder (dieselben `FieldDef` wie in Nauka). Ein Text dieses
 * Rodzaju hat dann beide Arten — die festen Felder des Textes und diese.
 */
export function textTypeKind(entry: Pick<LibEntry, 'id' | 'data'>): KindDef {
  const kind = readKind(entry.id, { name: entry.data.name, label: '{title}', fields: entry.data.fields });
  /* Die festen Schlüssel eines Textes gehören dem Text (der Editor des Rodzaju weist sie ab — hier für alte Einträge). */
  const core = new Set(BASE_BY_ID.get('text')?.fields.map((f) => f.key) ?? []);
  return { ...kind, label: '{title}', fields: kind.fields.filter((f) => !core.has(f.key)), system: undefined };
}

/** Der Eintrag, der eine eingebaute Art ändert — damit ein zweites Speichern ihn trifft und nicht einen neuen anlegt. */
export function overrideEntryOf(entries: Iterable<LibEntry>, id: string): LibEntry | undefined {
  for (const entry of entries) if (entry.kind === 'kind' && entry.data.builtin === id) return entry;
  return undefined;
}

/** Eine Art als Dokument — was in ihrem Eintrag steht (und im JSON). */
export function kindDoc(kind: KindDef): Record<string, unknown> {
  return {
    ...(isBaseKind(kind.id) ? { builtin: kind.id } : {}),
    name: kind.name,
    label: kind.label,
    ...(kind.tells === undefined ? {} : { tells: kind.tells }),
    ...(kind.system === undefined ? {} : { system: kind.system }),
    fields: kind.fields.map((f) => {
      const out: Record<string, unknown> = { key: f.key, label: f.label, type: f.type };
      if (f.multi) out.multi = true;
      if (f.uncertain) out.uncertain = true;
      if (f.unit !== undefined) out.unit = f.unit;
      if (f.quantity !== undefined) out.quantity = f.quantity;
      if (f.options !== undefined) out.options = f.options;
      if (f.to !== undefined && f.to.length > 0) out.to = f.to;
      if (f.inverse !== undefined) out.inverse = f.inverse;
      if (f.symmetric === true) out.symmetric = true;
      if (f.locator === true) out.locator = true;
      if (f.structure !== undefined) out.structure = f.structure;
      if (f.media !== undefined) out.media = f.media;
      if (f.rangeOf !== undefined) out.rangeOf = f.rangeOf;
      if (f.role !== undefined && !isBaseKind(kind.id)) out.role = f.role;
      if (f.says !== undefined) out.says = f.says;
      return out;
    })
  };
}

/* -- Einträge und Entitäten ---------------------------------------------------------- */

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : []);

/** Die Daten ohne die Schlüssel, die keine Felder sind. */
export function fieldData(data: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) if (!key.startsWith('_')) out[key] = value;
  return out;
}

/**
 * Ein Eintrag der Bibliothek als Entität — oder `null`, wenn er keine ist
 * (ein Dokument des Schemas, ein Ablauf).
 */
export function entityOf(entry: LibEntry): Entity | null {
  if (entry.kind === ENTITY) {
    const kinds = strings(entry.data._kinds);
    /* 2026-10-23 — ein Eintrag ohne Arten war ein „Wiedza"; den Rodzaj gibt es nicht mehr (er steht unter „Stare wpisy"). */
    return { id: entry.id, kinds: kinds.length === 0 ? [LEGACY_KNOWLEDGE] : kinds, data: fieldData(entry.data) };
  }
  if (LIBRARY_KIND_IDS.has(entry.kind)) {
    /* 2026-10-23 (Schritt 5) — ein Text trägt seinen Rodzaj tekstu als zweite Art (`textTypeKind`). */
    const type = entry.kind === 'text' && typeof entry.data.textType === 'string' && entry.data.textType !== '' ? [entry.data.textType] : [];
    const more = strings(entry.data._kinds).filter((k) => k !== entry.kind && !type.includes(k));
    return { id: entry.id, kinds: [entry.kind, ...type, ...more], data: fieldData(entry.data) };
  }
  return null;
}

/** Unter welcher Art im Klartext eine Entität liegt: die eingebaute ihrer ersten Art, sonst `entity`. */
export const plainKindOf = (kinds: readonly string[]): string =>
  kinds[0] !== undefined && LIBRARY_KIND_IDS.has(kinds[0]) ? kinds[0] : ENTITY;

/**
 * Was eine Entität in ihren Eintrag schreibt. `keep`: was der Eintrag schon
 * trug und kein Feld ist (`_checked`) — bleibt.
 */
export function entryData(entity: Pick<Entity, 'kinds' | 'data'>, plain: string, keep: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(keep)) if (key.startsWith('_') && key !== '_kinds') out[key] = value;
  for (const [key, value] of Object.entries(entity.data)) if (!key.startsWith('_')) out[key] = value;
  const kinds = plain === ENTITY ? [...entity.kinds] : entity.kinds.filter((k) => k !== plain);
  if (kinds.length > 0) out._kinds = kinds;
  return out;
}
