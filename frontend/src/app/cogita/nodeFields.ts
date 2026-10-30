/**
 * COGITA — WAS EIN KNOTEN EINSTELLT, damit der eine Editor (`GraphEditor`)
 * für jede Palette das richtige Feld zeichnet: Kartenvorlagen, Wiederholungen,
 * Abläufe. Was hier fehlt, lässt sich trotzdem setzen — als JSON des Knotens.
 */

import { ANSWER_FORM_LABEL, ANSWER_FORMS } from './check';
import { MODE_LABEL, MODES, ORDER_LABEL, ORDERS, PICK_LABEL, PICKS } from './revision';
import { LEVEL_LABEL } from './knowness';
import { conditionText, readCondition } from './logic';
import { QUANTITY_KINDS } from '../core/quantities';
import { STATEMENT_KINDS } from './statements';

/** 2026-10-23 (Schritt 13) — die Grössen zur Wahl (leer: nur die Zahl). */
export const QUANTITY_OPTIONS: readonly { value: string; label: string }[] = [{ value: '', label: '— bez wielkości —' }, ...QUANTITY_KINDS.map((k) => ({ value: k.id, label: k.label }))];

export type ConfigType =
  | 'text' | 'longtext' | 'code' | 'number' | 'bool' | 'select' | 'lines'
  | 'field' | 'kind' | 'kinds' | 'entity' | 'collection' | 'template' | 'templates' | 'flow' | 'rule'
  | 'condition' | 'actions' | 'options' | 'chapters' | 'media' | 'forms' | 'levels'
  /* 2026-10-22 (Schritt 9) — die Regel der Zbiory (Feld, Vergleich, Gruppen), für „Filtr wpisów". */
  | 'query'
  /* 2026-10-22 — eine Bibliothek oder Baza wiedzy: diese oder eine ihrer Quellen. */
  | 'source'
  /* 2026-10-30 — ein gespeicherter Widok; eine Bedingung, die auch die Kenntnis relativ sieht (Widoki, Powtórki). */
  | 'view' | 'when';

export interface ConfigField {
  readonly key: string;
  readonly label: string;
  readonly type: ConfigType;
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  readonly hint?: string;
  /** Welche Arten ein Eintrag haben darf (bei `entity`). */
  readonly kinds?: readonly string[];
}

const f = (key: string, label: string, type: ConfigType, more: Partial<ConfigField> = {}): ConfigField => ({ key, label, type, ...more });
const opts = (pairs: readonly (readonly [string, string])[]) => pairs.map(([value, label]) => ({ value, label }));

/* -- Kartenvorlagen ---------------------------------------------------------------- */

const TEMPLATE_FIELDS: Record<string, readonly ConfigField[]> = {
  field: [f('key', 'Pole', 'field')],
  media: [f('key', 'Pole z plikiem', 'field')],
  follow: [f('path', 'Droga po odwołaniach', 'lines', { hint: 'klucze pól, jeden w wierszu: authors, then birthplace' })],
  list: [f('items', 'Pozycje', 'lines')],
  entity: [],
  filter: [
    f('key', 'Pole', 'field', { hint: 'puste: porównuje same wpisy' }),
    f('value', 'Wartość, gdy nic nie przychodzi do „Porównaj z"', 'lines', { hint: 'np. angielski — jedna w wierszu' })
  ],
  unique: [],
  'statement.thesis': [],
  'statement.part': [f('n', 'Który kawałek (1, 2, …)', 'number', { hint: 'puste: wszystkie akapity' })],
  'statement.table': [f('table', 'Która tabela', 'number', { hint: '1' }), f('left', 'Kolumna po lewej', 'number', { hint: '1' }), f('right', 'Kolumna po prawej', 'number', { hint: '2' })],
  'statement.subjects': [],
  entries: [
    f('kind', 'Rodzaj', 'kind', { hint: 'puste: rodzaj tego wpisu' }),
    f('key', 'Tylko te, których pole', 'field', { hint: 'puste: wszystkie wpisy rodzaju' }),
    f('value', '… ma wartość (gdy nic nie przychodzi do „Gdzie pole ma")', 'lines'),
    f('self', 'Bez tego wpisu', 'bool'),
    f('scope', 'Tylko z bieżącego zbioru', 'bool'),
    f('count', 'Losowo najwyżej', 'number', { hint: 'puste: wszystkie' })
  ],
  pairs: [
    f('key', 'Pole z wartościami', 'field', { hint: 'np. słowa tłumaczenia' }),
    f('by', 'Według pola', 'field', { hint: 'np. język słowa' }),
    f('leftValue', 'Lewa strona, gdy nic nie przychodzi', 'lines'),
    f('rightValue', 'Prawa strona, gdy nic nie przychodzi', 'lines', { hint: 'puste: wszystkie pozostałe' }),
    f('count', 'Najwyżej par', 'number', { hint: '5' })
  ],
  /* 2026-10-25 (Wywód) — zwei Felder derselben Einträge: Fragment ↔ Teza. */
  'pairs.fields': [
    f('left', 'Pole po lewej', 'field', { hint: 'np. fragment; puste: teza wpisu' }),
    f('right', 'Pole po prawej', 'field', { hint: 'puste: teza wpisu' }),
    f('count', 'Najwyżej par', 'number', { hint: '5' })
  ],
  pattern: [f('text', 'Wzór', 'text', { hint: 'Kto napisał {0}?' }), f('inputs', 'Ile wejść', 'number'), f('joiner', 'Łącznik wielu wartości', 'text', { hint: ', ' })],
  mask: [f('mode', 'Co zakryć', 'select', { options: opts([['prefix', 'koniec (zostaje początek)'], ['suffix', 'początek (zostaje koniec)'], ['random', 'losowe słowa']]) }), f('keep', 'Ile zostaje widoczne (0–1)', 'number'), f('gap', 'Znak luki', 'text', { hint: '…' })],
  fragments: [f('min', 'Najkrótszy kawałek (znaki)', 'number'), f('max', 'Najdłuższy kawałek (znaki)', 'number')],
  pick: [f('position', 'Który', 'select', { options: opts([['random', 'losowy'], ['first', 'pierwszy'], ['last', 'ostatni']]) })],
  distractors: [
    f('key', 'Pole (dla „to samo pole")', 'field'), f('count', 'Ile', 'number'),
    f('from', 'Skąd', 'lines', { hint: 'field · scope · list · near — jedno w wierszu' }), f('list', 'Własna lista', 'lines')
  ],
  each: [],
  random: [f('min', 'Od', 'number'), f('max', 'Do', 'number'), f('step', 'Co ile', 'number')],
  math: [
    f('op', 'Działanie', 'select', { options: opts([['add', '+'], ['sub', '−'], ['mul', '×'], ['div', '÷'], ['pow', 'potęga'], ['exp', 'e^x'], ['log', 'log'], ['abs', '|x|'], ['min', 'min'], ['max', 'max'], ['floor', 'w dół'], ['ceil', 'w górę'], ['round', 'zaokrąglij'], ['mod', 'reszta']]) }),
    f('decimals', 'Miejsca po przecinku', 'number')
  ],
  compare: [f('op', 'Porównanie', 'select', { options: opts([['lt', 'a < b'], ['le', 'a ≤ b'], ['gt', 'a > b'], ['ge', 'a ≥ b'], ['eq', 'a = b'], ['ne', 'a ≠ b']]) })],
  when: [f('test', 'Warunek', 'select', { options: opts([['filled', 'jest wartość'], ['empty', 'brak wartości'], ['equals', 'równa się'], ['differs', 'różna od']]) }), f('value', 'Wartość', 'text')],
  python: [f('code', 'Kod (def run(*wejścia): …)', 'code'), f('inputs', 'Ile wejść', 'number')],
  prompt: [],
  'answer.text': [f('rule', 'Jak ściśle sprawdzać', 'rule')],
  'answer.gap': [f('rule', 'Jak ściśle sprawdzać', 'rule')],
  'answer.number': [f('tolerance', 'Tolerancja', 'number'), f('relative', 'Tolerancja w ułamku wartości', 'bool'), f('unit', 'Jednostka', 'text'), f('quantity', 'Wielkość', 'select', { options: QUANTITY_OPTIONS })],
  'answer.date': [f('precision', 'Dokładność', 'select', { options: opts([['year', 'rok'], ['month', 'miesiąc'], ['day', 'dzień']]) }), f('tolerance', 'Tolerancja', 'number')],
  'answer.one': [],
  'answer.many': [],
  'answer.truefalse': [],
  'answer.order': [],
  'answer.match': [],
  'answer.flash': [],
  'answer.code': [f('task', 'Zadanie', 'longtext'), f('starter', 'Kod na start', 'code'), f('createInput', 'create_input(seed)', 'code'), f('reference', 'reference(x)', 'code'), f('cases', 'Ile przypadków', 'number')],
  'answer.point': [f('on', 'Gdzie', 'select', { options: opts([['map', 'na mapie'], ['image', 'na obrazie']]) }), f('r', 'Promień (m albo część obrazu)', 'number'), f('x', 'x (0–1, na obrazie)', 'number'), f('y', 'y (0–1, na obrazie)', 'number')],
  card: []
};

/* -- Wiederholungen ------------------------------------------------------------------ */

const REVISION_FIELDS: Record<string, readonly ConfigField[]> = {
  'source.all': [],
  'source.kind': [f('kind', 'Rodzaj', 'kind'), f('from', 'Skąd', 'source', { hint: 'puste: z tej bazy i ze wszystkich źródeł' })],
  'source.collection': [f('collection', 'Zbiór', 'collection')],
  'source.list': [f('ids', 'Wpisy albo pytania', 'lines', { hint: 'identyfikatory, jeden w wierszu' })],
  /* 2026-10-22 (Schritt 11) — z kazania (albo innego wpisu): to, na co wskazuje. */
  'source.from': [f('entry', 'Wpis (np. kazanie)', 'entity', { kinds: ['text', 'project', STATEMENT_KINDS] })],
  /* 2026-10-30 — ein gespeicherter Widok als Quelle einer Powtórka. */
  'source.view': [f('view', 'Widok (sposób wyświetlania)', 'view')],
  filter: [f('templates', 'Tylko szablony', 'templates'), f('directions', 'Tylko kierunki', 'lines'), f('forms', 'Tylko formy', 'forms'), f('levels', 'Tylko stany', 'levels'), f('dueOnly', 'Tylko te, na które przyszła pora', 'bool')],
  /* 2026-10-22 (Schritt 9) — dieselben Schritte wie ein Widok (`selection.ts`). */
  follow: [
    f('field', 'Po którym polu', 'field', { hint: 'puste: po wszystkich odwołaniach' }), f('back', 'Wstecz: do tego, co wskazuje na te wpisy', 'bool'),
    f('keep', 'Zostaw też wpisy, od których wychodzi', 'bool')
  ],
  /* 2026-10-25 (Wywód) — entlang der Strukturfelder, die der Rodzaj erklärt. */
  structure: [
    f('dir', 'Kierunek', 'select', { options: opts([['down', 'w dół — to, co leży pod nimi'], ['up', 'w górę — to, pod czym leżą']]) }),
    f('one', 'Tylko jeden poziom', 'bool', { hint: 'bez zaznaczenia: do samego końca, wszystkie poziomy' }),
    f('keep', 'Zostaw też wpisy, od których wychodzi', 'bool')
  ],
  /* 2026-10-30 — entlang der Reihenfolge des Lernens (die Grundlagen dazu holen). */
  learning: [
    f('dir', 'Kierunek', 'select', { options: opts([['before', 'wstecz — to, co trzeba znać wcześniej'], ['after', 'dalej — to, co na nich buduje']]) }),
    f('one', 'Tylko jeden krok', 'bool', { hint: 'bez zaznaczenia: aż do samych podstaw (albo do końca)' }),
    f('keep', 'Zostaw też wpisy, od których wychodzi', 'bool')
  ],
  'filter.rule': [f('rule', 'Reguła', 'query')],
  /* 2026-10-30 — die eine Logik, auch über die Kenntnis: dieses Eintrags, seiner Karten, dessen, was vorher kommt … */
  'filter.when': [f('when', 'Warunek', 'when')],
  union: [],
  strategy: [
    f('mode', 'Sposób', 'select', { options: MODES.map((m) => ({ value: m, label: MODE_LABEL[m] })) }),
    f('order', 'Kolejność', 'select', { options: ORDERS.map((o) => ({ value: o, label: ORDER_LABEL[o] })), hint: 'puste: w stosie najpierw ogólne, w stałej kolejce losowo' }),
    f('pick', 'Wybór ze stosu', 'select', { options: PICKS.map((p) => ({ value: p, label: PICK_LABEL[p] })), hint: 'puste: losowo, częściej słabsze' }),
    f('count', 'Ile kart (losowo)', 'number'), f('stackSize', 'Ile kart naraz w stosie', 'number'), f('levels', 'Ile poziomów', 'number'),
    f('minCorrectness', 'Od jakiej poprawności dobrze (0–1)', 'number'),
    f('rule', 'Jak ściśle sprawdzać tekst', 'rule')
  ]
};

/* -- Abläufe ----------------------------------------------------------------------------- */

const OPEN = f('open', 'Jak się otwiera', 'select', { options: opts([['screen', 'nowy ekran'], ['inline', 'rozwija się w miejscu']]) });
const TITLE = f('title', 'Nagłówek (dane przebiegu)', 'text');

const FLOW_FIELDS: Record<string, readonly ConfigField[]> = {
  show: [TITLE, f('of', 'Co pokazać', 'entity'), f('media', 'Plik', 'media'), OPEN],
  question: [TITLE, f('of', 'Pytanie', 'entity', { kinds: ['question'] }), f('card', 'albo klucz karty', 'text'), OPEN],
  choice: [TITLE, f('options', 'Możliwości', 'options')],
  condition: [f('condition', 'Warunek', 'condition')],
  set: [f('actions', 'Działania', 'actions')],
  chapters: [TITLE, f('chapters', 'Rozdziały', 'chapters')],
  chapterEnd: [],
  restart: [],
  subflow: [f('flow', 'Przebieg', 'flow')],
  each: [f('collection', 'Zbiór', 'collection'), f('kind', 'albo rodzaj', 'kind'), f('flow', 'Przebieg dla każdego', 'flow')],
  expand: [f('of', 'Pojęcie', 'entity'), f('explain', 'Wyjaśnienie (wypowiedź — treść w blokach)', 'entity', { kinds: [STATEMENT_KINDS] }), f('threshold', 'Kto zna od', 'number')],
  opening: [TITLE, f('mode', 'Otwarcie', 'select', { options: opts([['discovery', 'odkrywanie — najpierw pytanie'], ['recall', 'przypomnienie — najpierw treść']]) }), f('of', 'Czego dotyczy', 'entity')],
  line: [f('character', 'Postać', 'entity'), f('of', 'Co mówi (wypowiedź — treść w blokach)', 'entity', { kinds: [STATEMENT_KINDS] }), f('mood', 'Nastrój', 'text'), f('condition', 'Tylko gdy', 'condition')],
  handoff: [f('flow', 'Do przebiegu', 'flow')],
  /* 2026-10-22 (Schritt 12) — eine Szene einer Präsentation (ihre Ausgänge kommen aus dem Storyboard). */
  scene: [TITLE, f('page', 'Strona z prezentacją (adres)', 'text'), f('scene', 'Scena (klucz)', 'text')],
  end: [],
  return: []
};

export function configFields(palette: string, type: string): readonly ConfigField[] {
  /* 2026-10-22 (Schritt 9) — ein Widok wählt mit denselben Schritten wie die Powtórka. */
  const table = palette === 'card-template' ? TEMPLATE_FIELDS : palette === 'revision' || palette === 'view' ? REVISION_FIELDS : palette === 'flow' ? FLOW_FIELDS : {};
  return table[type] ?? [];
}

export const FORM_OPTIONS = ANSWER_FORMS.map((form) => ({ value: form, label: ANSWER_FORM_LABEL[form] }));
export const LEVEL_OPTIONS = (['unseen', 'learning', 'known'] as const).map((l) => ({ value: l, label: LEVEL_LABEL[l] }));

/** Ein kurzer Satz am Knoten: was er gerade einstellt. */
export function configSummary(palette: string, type: string, config: Readonly<Record<string, unknown>>, name: (kind: 'entity' | 'kind' | 'collection' | 'flow' | 'template' | 'source' | 'view', id: string) => string): string {
  const parts: string[] = [];
  for (const field of configFields(palette, type)) {
    const v = config[field.key];
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    if (field.type === 'entity' && typeof v === 'string') parts.push(name('entity', v));
    else if (field.type === 'when') { const c = readCondition(v); if (c !== null) parts.push(conditionText(c, (id) => name('entity', id))); }
    else if ((field.type === 'kind' || field.type === 'collection' || field.type === 'flow' || field.type === 'source' || field.type === 'view') && typeof v === 'string') parts.push(name(field.type, v));
    else if (field.type === 'select' && typeof v === 'string') parts.push(field.options?.find((o) => o.value === v)?.label ?? v);
    else if (typeof v === 'string' && field.type !== 'code') parts.push(v.length > 28 ? `${v.slice(0, 27)}…` : v);
    else if (typeof v === 'number' || typeof v === 'boolean') parts.push(`${field.label.split(' ')[0].toLowerCase()} ${v === true ? 'tak' : v === false ? 'nie' : v}`);
    else if (field.type === 'options' && Array.isArray(v)) parts.push(`${v.length} możliwości`);
    else if (field.type === 'chapters' && Array.isArray(v)) parts.push(`${v.length} rozdziałów`);
    if (parts.length >= 2) break;
  }
  return parts.join(' · ');
}
