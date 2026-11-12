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
import { formsOfField, QUESTION_TYPES, SHOW_MAX } from './questionTypes';
import { t, texts } from '../core/i18n';

/** Die Art im Klartext für jeden Eintrag, der keine eingebaute ist. */
export const ENTITY = 'entity';

/** 2026-10-23 — der frühere eingebaute „Wiedza": kein Rodzaj mehr, nur noch das Merkmal alter Einträge. */
export const LEGACY_KNOWLEDGE = 'knowledge';

/** Was das Schema, die Karten, die Abläufe und die Einstellungen beschreibt — kein Eintrag, den man lernt. */
/* 2026-11-09 — `worldmap`: die gespeicherte Lage der Weltkarte (nur Schreibende legen sie ab; nie im JSON des Kurses). */
export const DOC_KINDS = ['kind', 'template', 'revision', 'flow', 'look', 'rules', 'values', 'collection', 'view', 'settings', 'merge', 'contribution', 'addform', 'anchor', 'reward', 'worldmap', 'qpath'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_LABEL: Readonly<Record<DocKind, string>> = texts({
  addform: 'cogitaData.docKind.addform',
  /* 2026-10-25 (Wywód) — ein Weg aus der Bibliothek: ein Werk (ganz oder Teile davon) → ein Eintrag, ein Widok (`anchors.ts`). */
  anchor: 'cogitaData.docKind.anchor',
  /* 2026-11-12 (Prompt 25) — ein Weg zu einer Frage auf der Weltkarte (`worldmap/wmPaths.ts`). */
  qpath: 'cogitaData.docKind.qpath',
  kind: 'cogitaData.docKind.kind',
  template: 'cogitaData.docKind.template',
  revision: 'cogitaData.docKind.revision',
  flow: 'cogitaData.docKind.flow',
  look: 'cogitaData.docKind.look',
  rules: 'cogitaData.docKind.rules',
  values: 'cogitaData.docKind.values',
  collection: 'cogitaData.docKind.collection',
  view: 'cogitaData.docKind.view',
  settings: 'cogitaData.docKind.settings',
  worldmap: 'cogitaData.docKind.worldmap',
  merge: 'cogitaData.docKind.merge',
  contribution: 'cogitaData.docKind.contribution',
  /* 2026-11-02 — punkty, seria, cel dnia, poziomy, odznaki (`rewards.ts`). */
  reward: 'cogitaData.docKind.reward'
});

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
  blocks: 'blocks',
  /* 2026-10-26 — eine Datei der Bibliothek (in der Bibliothek nur in Listen: die Dateien der Nuty, die Spuren eines Nagrania). */
  media: 'media'
};

function fromLibrary(f: LibField): FieldDef {
  const type = TYPE_OF[f.type];
  /* 2026-11-09 — Bezeichnungen der Bibliothek sind übersetzt (Getter): erst beim Lesen holen, nie beim Laden des Moduls. */
  return {
    key: f.key,
    get label() { return f.label; },
    type,
    multi: f.type === 'refs',
    uncertain: false,
    options: type === 'choice' ? (f.options ?? []).map((o) => ({ value: o.value, get label() { return o.label; } })) : undefined,
    to: type === 'ref' ? [...(f.to ?? [])] : undefined,
    role: f.key,
    get says() { return f.says; }
  };
}

/** Wie das Etikett einer eingebauten Art aus ihren Feldern entsteht — und was Gleichnamige unterscheidet. */
const PATTERNS: Record<string, { label: string; tells?: string }> = {
  person: { label: '{name} {givenNames} {surname}', tells: 'years' }, // i18n-ignore
  work: { label: '{title}: {subtitle}', tells: 'year' }, // i18n-ignore
  quote: { label: '{text}', tells: 'locator' },
  text: { label: '{title}', tells: 'date' },
  project: { label: '{title}', tells: 'projectType' },
  delivery: { label: '{date} {occasion}', tells: 'place' } // i18n-ignore
};

const field = (key: string, label: string, type: FieldType, more: Partial<FieldDef> = {}): FieldDef =>
  ({ key, label, type, multi: false, uncertain: false, ...more });

function builtin(id: string): KindDef {
  const lib = LIBRARY_KINDS.find((k) => k.kind === id)!;
  /* 2026-10-26 — ohne Listen von Objekten (die Dateien der Musik): Nauka liest sie aus den Daten, nicht als Feld. */
  const fields = lib.fields.filter((f) => f.type !== 'items').map(fromLibrary);
  const more: readonly FieldDef[] = [];
  return {
    id,
    get name() { return lib.label; },
    label: PATTERNS[id]?.label ?? `{${fields[0]?.key ?? 'title'}}`,
    tells: PATTERNS[id]?.tells,
    fields: [...fields, ...more.filter((m) => !fields.some((f) => f.key === m.key))],
    ...(id === 'text' ? { system: 'text' as const } : {})
  };
}

/**
 * EINE FRAGE [C4, D1] — die Felder, die `questionCard` liest. 2026-10-27: EIN Schema für jede Art
 * der Frage (`questionTypes.ts`): „Rodzaj pytania" (`form`) entscheidet, welche Felder gelten
 * (`when`); gemeinsam sind die Frage, „Wyjaśnienie", „O czym" (was die Frage prüft: ihre Kenntnis
 * zählt dort, und sie wartet auf das, was dort zuerst zu können ist) und „Najpierw trzeba znać".
 */
/*
 * 2026-11-05 — Name, Bezeichnungen und Erklärungen der eingebauten Frage in der Sprache der Anwendung
 * (`cogitaData.question.*`): Getter, beim Lesen geholt. Wer die eingebaute Frage ändert, speichert seine eigenen.
 */
const Q = 'cogitaData.question';
const qf = (key: string, type: FieldType, more: Partial<FieldDef> = {}, said?: () => string, inverse = false): FieldDef => {
  const out = field(key, '', type, more);
  Object.defineProperty(out, 'label', { get: () => t(`${Q}.label.${key}`), enumerable: true, configurable: true });
  Object.defineProperty(out, 'says', { get: said ?? (() => t(`${Q}.says.${key}`)), enumerable: true, configurable: true });
  if (inverse) Object.defineProperty(out, 'inverse', { get: () => t(`${Q}.inverse.${key}`), enumerable: true, configurable: true });
  return out;
};
const q = (key: string, type: FieldType, more: Partial<FieldDef> = {}, said?: () => string): FieldDef => {
  const forms = formsOfField(key);
  return qf(key, type, { ...more, ...(forms === undefined ? {} : { when: { field: 'form', values: forms } }) }, said);
};
const options = (key: string, values: readonly string[]) =>
  values.map((value) => ({ value, get label() { return t(`${Q}.option.${key}.${value}`); } }));

export const QUESTION: KindDef = {
  id: 'question',
  get name() { return t(`${Q}.name`); },
  label: '{prompt}',
  tells: 'form',
  system: 'question',
  fields: [
    qf('form', 'choice', {
      options: QUESTION_TYPES.map((qt) => ({ value: qt.form, get label() { return qt.label; } }))
    }, () => t(`${Q}.says.form`, { list: QUESTION_TYPES.map((qt) => `${qt.form} (${qt.label})`).join(', ') })),
    q('prompt', 'markup', { role: 'text' }),
    q('hints', 'list'),
    q('explanation', 'markup'),
    q('answers', 'list'),
    q('options', 'list'),
    q('correct', 'list'),
    q('feedback', 'list'),
    q('value', 'bool'),
    q('left', 'list'),
    q('right', 'list'),
    q('leftLabel', 'line'),
    q('rightLabel', 'line'),
    q('show', 'number', {}, () => t(`${Q}.says.show`, { max: SHOW_MAX })),
    q('share', 'text'),
    q('fact', 'text'),
    q('items', 'list'),
    q('extra', 'list'),
    q('alternatives', 'json'),
    q('preview', 'choice', { options: options('preview', ['math', 'text']) }),
    q('join', 'json'),
    q('choices', 'json'),
    q('back', 'list'),
    q('tolerance', 'number'),
    q('relative', 'bool'),
    q('unit', 'line'),
    q('quantity', 'choice', { options: QUANTITY_KINDS.map((k) => ({ value: k.id, get label() { return k.label; } })) }),
    q('precision', 'choice', { options: options('precision', ['year', 'month', 'day']) }),
    q('task', 'text'),
    q('starter', 'text'),
    q('createInput', 'text'),
    q('reference', 'text'),
    q('cases', 'number'),
    q('tests', 'json'),
    q('place', 'geo'),
    q('radius', 'number'),
    q('drawing', 'text'),
    q('goal', 'line'),
    q('solution', 'line'),
    q('goals', 'list'),
    q('check', 'choice', { options: options('check', ['live', 'submit']) }),
    qf('explain', 'ref', { multi: true }),
    qf('params', 'json'),
    qf('let', 'json'),
    qf('require', 'list'),
    qf('core', 'bool'),
    qf('about', 'ref', { multi: true }, undefined, true),
    qf('needs', 'ref', { multi: true, prerequisite: 'up' }, undefined, true)
  ]
};

/** In dieser Reihenfolge stehen sie in Listen. */
const BASE: readonly KindDef[] = [
  ...['person', 'work', 'quote', 'text', 'delivery', 'project', ...LIBRARY_KINDS.filter(k => k.kind.startsWith('lit_')).map(k => k.kind)].map(builtin),
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
  /* 2026-10-31 — auch ein eingebauter Rodzaj darf sagen, wie seine Einträge zum Lesen aussehen. */
  const reading = doc.reading ?? base.reading;
  return { ...base, name: doc.name || base.name, label: doc.label || base.label, tells: doc.tells ?? base.tells, ...(reading === undefined ? {} : { reading }), fields };
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
    ...(kind.reading === undefined ? {} : { reading: kind.reading }),
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
      if (f.prerequisite !== undefined) out.prerequisite = f.prerequisite;
      /* 2026-11-09 (Weltkarte) — ein Teil eines Blocks. */
      if (f.part !== undefined) out.part = f.part;
      /* 2026-11-05 (Prompt 24) — ein Verweisfeld, das auch in andere Bazy zeigen darf ("@@historia:@…"). */
      if (f.external === true) out.external = true;
      if (f.when !== undefined) out.when = { field: f.when.field, values: [...f.when.values] };
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
