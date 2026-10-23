/**
 * COGITA — WAS EIN KNOTEN EINSTELLT, damit der eine Editor (`GraphEditor`)
 * für jede Palette das richtige Feld zeichnet: Kartenvorlagen, Wiederholungen,
 * Abläufe. Was hier fehlt, lässt sich trotzdem setzen — als JSON des Knotens.
 */

import { ANSWER_FORM_LABEL, ANSWER_FORMS } from './check';
import { MODE_LABEL, MODES } from './revision';
import { LEVEL_LABEL } from './knowness';

export type ConfigType =
  | 'text' | 'longtext' | 'code' | 'number' | 'bool' | 'select' | 'lines'
  | 'field' | 'kind' | 'kinds' | 'entity' | 'collection' | 'template' | 'templates' | 'flow' | 'rule'
  | 'condition' | 'actions' | 'options' | 'chapters' | 'media' | 'forms' | 'levels'
  /* 2026-10-22 (Schritt 9) — die Regel der Zbiory (Feld, Vergleich, Gruppen), für „Filtr wpisów". */
  | 'query'
  /* 2026-10-22 — eine Bibliothek oder Baza wiedzy: diese oder eine ihrer Quellen. */
  | 'source';

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
  'answer.number': [f('tolerance', 'Tolerancja', 'number'), f('relative', 'Tolerancja w ułamku wartości', 'bool'), f('unit', 'Jednostka', 'text')],
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
  'source.topic': [f('topic', 'Temat', 'entity', { kinds: ['topic'] }), f('depth', 'Głębokość', 'number')],
  'source.list': [f('ids', 'Wpisy albo pytania', 'lines', { hint: 'identyfikatory, jeden w wierszu' })],
  /* 2026-10-22 (Schritt 11) — z kazania (albo innego wpisu): to, na co wskazuje. */
  'source.from': [f('entry', 'Wpis (np. kazanie)', 'entity', { kinds: ['text', 'comment', 'project'] })],
  filter: [f('templates', 'Tylko szablony', 'templates'), f('directions', 'Tylko kierunki', 'lines'), f('forms', 'Tylko formy', 'forms'), f('levels', 'Tylko stany', 'levels'), f('dueOnly', 'Tylko te, na które przyszła pora', 'bool')],
  /* 2026-10-22 (Schritt 9) — dieselben Schritte wie ein Widok (`selection.ts`). */
  follow: [f('field', 'Po którym polu', 'field', { hint: 'puste: po wszystkich odwołaniach' }), f('back', 'Wstecz: do tego, co wskazuje na te wpisy', 'bool')],
  'filter.rule': [f('rule', 'Reguła', 'query')],
  union: [],
  gate: [f('threshold', 'Od jakiej znajomości (1 = umie)', 'number')],
  strategy: [
    f('mode', 'Sposób', 'select', { options: MODES.map((m) => ({ value: m, label: MODE_LABEL[m] })) }),
    f('count', 'Ile kart (losowo)', 'number'), f('stackSize', 'Ile kart naraz w stosie', 'number'), f('levels', 'Ile poziomów', 'number'),
    f('minCorrectness', 'Od jakiej poprawności dobrze (0–1)', 'number'),
    f('order', 'Kolejność', 'select', { options: opts([['random', 'losowa'], ['given', 'jak przychodzą'], ['due', 'najpierw zaległe']]) }),
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
  prerequisite: [f('of', 'Co trzeba znać', 'entity'), f('threshold', 'Od jakiej znajomości', 'number')],
  expand: [f('of', 'Pojęcie', 'entity'), f('explain', 'Wyjaśnienie (komentarz albo wiedza)', 'entity', { kinds: ['comment', 'knowledge'] }), f('threshold', 'Kto zna od', 'number')],
  opening: [TITLE, f('mode', 'Otwarcie', 'select', { options: opts([['discovery', 'odkrywanie — najpierw pytanie'], ['recall', 'przypomnienie — najpierw treść']]) }), f('of', 'Czego dotyczy', 'entity')],
  line: [f('character', 'Postać', 'entity'), f('of', 'Co mówi (komentarz albo wiedza)', 'entity', { kinds: ['comment', 'knowledge'] }), f('mood', 'Nastrój', 'text'), f('condition', 'Tylko gdy', 'condition')],
  handoff: [f('flow', 'Do przebiegu', 'flow')],
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
export function configSummary(palette: string, type: string, config: Readonly<Record<string, unknown>>, name: (kind: 'entity' | 'kind' | 'collection' | 'flow' | 'template' | 'source', id: string) => string): string {
  const parts: string[] = [];
  for (const field of configFields(palette, type)) {
    const v = config[field.key];
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    if (field.type === 'entity' && typeof v === 'string') parts.push(name('entity', v));
    else if ((field.type === 'kind' || field.type === 'collection' || field.type === 'flow' || field.type === 'source') && typeof v === 'string') parts.push(name(field.type, v));
    else if (field.type === 'select' && typeof v === 'string') parts.push(field.options?.find((o) => o.value === v)?.label ?? v);
    else if (typeof v === 'string' && field.type !== 'code') parts.push(v.length > 28 ? `${v.slice(0, 27)}…` : v);
    else if (typeof v === 'number' || typeof v === 'boolean') parts.push(`${field.label.split(' ')[0].toLowerCase()} ${v === true ? 'tak' : v === false ? 'nie' : v}`);
    else if (field.type === 'options' && Array.isArray(v)) parts.push(`${v.length} możliwości`);
    else if (field.type === 'chapters' && Array.isArray(v)) parts.push(`${v.length} rozdziałów`);
    if (parts.length >= 2) break;
  }
  return parts.join(' · ');
}
