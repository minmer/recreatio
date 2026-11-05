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
import { t } from '../core/i18n';

/** 2026-10-23 (Schritt 13) — die Grössen zur Wahl (leer: nur die Zahl). */
export const QUANTITY_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', get label() { return t('cogitaEditNode.noQuantity'); } },
  ...QUANTITY_KINDS.map((k) => ({ value: k.id, get label() { return k.label; } }))
];

export type ConfigType =
  | 'text' | 'longtext' | 'code' | 'number' | 'bool' | 'select' | 'lines'
  | 'field' | 'kind' | 'kinds' | 'entity' | 'collection' | 'template' | 'templates' | 'flow' | 'rule'
  | 'condition' | 'actions' | 'options' | 'chapters' | 'media' | 'forms' | 'levels'
  /* 2026-10-22 (Schritt 9) — die Regel der Zbiory (Feld, Vergleich, Gruppen), für „Filtr wpisów". */
  | 'query'
  /* 2026-10-22 — eine Bibliothek oder Baza wiedzy: diese oder eine ihrer Quellen. */
  | 'source'
  /* 2026-10-30 — ein gespeicherter Widok; eine Bedingung, die auch die Kenntnis relativ sieht (Widoki, Powtórki). */
  | 'view' | 'when'
  /* 2026-11-03 — ein JSON-Wert (die Einstellung des Generators: params, let, texts). */
  | 'json';

export interface ConfigField {
  readonly key: string;
  readonly label: string;
  readonly type: ConfigType;
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  readonly hint?: string;
  /** Welche Arten ein Eintrag haben darf (bei `entity`). */
  readonly kinds?: readonly string[];
  /** 2026-11-05 (Prompt 24) — `flow`: auch eine Erzählung einer anderen Welt ("@@historia:@…", „Link do innego świata…"). */
  readonly cross?: true;
}

/*
 * 2026-11-05 — die Texte der Tabellen werden erst beim Lesen übersetzt: `K('cogitaEditNode.…')` ist ein Schlüssel,
 * ein blosser Text (Formel, Zahl, JSON-Beispiel) bleibt, wie er ist.
 */
type Text = string | { readonly k: string };
const K = (k: string): Text => ({ k });
const read = (x: Text): string => (typeof x === 'string' ? x : t(x.k));
const lazy = <O extends object>(o: O, prop: string, x: Text): O => Object.defineProperty(o, prop, { get: () => read(x), enumerable: true, configurable: true });

type FieldMore = Omit<Partial<ConfigField>, 'hint' | 'options'> & { readonly hint?: Text; readonly options?: readonly { readonly value: string; readonly label: string | Text }[] };
const f = (key: string, label: Text, type: ConfigType, more: FieldMore = {}): ConfigField => {
  const { hint, options, ...rest } = more;
  const out = lazy({ key, type, ...rest } as ConfigField, 'label', label);
  if (hint !== undefined) lazy(out, 'hint', hint);
  if (options !== undefined) Object.defineProperty(out, 'options', { value: options.map((o) => ('k' in Object(o.label) ? lazy({ value: o.value } as { value: string; label: string }, 'label', o.label) : o)), enumerable: true });
  return out;
};
const opts = (pairs: readonly (readonly [string, Text])[]) => pairs.map(([value, label]) => lazy({ value } as { value: string; label: string }, 'label', label));

/* -- Kartenvorlagen ---------------------------------------------------------------- */

const TEMPLATE_FIELDS: Record<string, readonly ConfigField[]> = {
  field: [f('key', K('cogitaEditNode.f.field'), 'field')],
  media: [f('key', K('cogitaEditNode.f.mediaField'), 'field')],
  follow: [f('path', K('cogitaEditNode.f.path'), 'lines', { hint: K('cogitaEditNode.hint.path') })],
  list: [f('items', K('cogitaEditNode.f.items'), 'lines')],
  entity: [],
  filter: [
    f('key', K('cogitaEditNode.f.field'), 'field', { hint: K('cogitaEditNode.hint.compareEntries') }),
    f('value', K('cogitaEditNode.f.filterValue'), 'lines', { hint: K('cogitaEditNode.hint.filterValue') })
  ],
  unique: [],
  'statement.thesis': [],
  'statement.part': [f('n', K('cogitaEditNode.f.partN'), 'number', { hint: K('cogitaEditNode.hint.allParagraphs') })],
  'statement.table': [f('table', K('cogitaEditNode.f.table'), 'number', { hint: '1' }), f('left', K('cogitaEditNode.f.leftColumn'), 'number', { hint: '1' }), f('right', K('cogitaEditNode.f.rightColumn'), 'number', { hint: '2' })],
  'statement.subjects': [],
  entries: [
    f('kind', K('cogitaEditNode.f.kind'), 'kind', { hint: K('cogitaEditNode.hint.kindOfEntry') }),
    f('key', K('cogitaEditNode.f.onlyWhereField'), 'field', { hint: K('cogitaEditNode.hint.allOfKind') }),
    f('value', K('cogitaEditNode.f.hasValue'), 'lines'),
    f('self', K('cogitaEditNode.f.withoutSelf'), 'bool'),
    f('scope', K('cogitaEditNode.f.scopeOnly'), 'bool'),
    f('count', K('cogitaEditNode.f.randomMax'), 'number', { hint: K('cogitaEditNode.hint.all') })
  ],
  pairs: [
    f('key', K('cogitaEditNode.f.valuesField'), 'field', { hint: K('cogitaEditNode.hint.translationWords') }),
    f('by', K('cogitaEditNode.f.byField'), 'field', { hint: K('cogitaEditNode.hint.wordLanguage') }),
    f('leftValue', K('cogitaEditNode.f.leftValue'), 'lines'),
    f('rightValue', K('cogitaEditNode.f.rightValue'), 'lines', { hint: K('cogitaEditNode.hint.allOthers') }),
    f('count', K('cogitaEditNode.f.maxPairs'), 'number', { hint: '5' })
  ],
  /* 2026-10-25 (Wywód) — zwei Felder derselben Einträge: Fragment ↔ Teza. */
  'pairs.fields': [
    f('left', K('cogitaEditNode.f.leftField'), 'field', { hint: K('cogitaEditNode.hint.leftField') }),
    f('right', K('cogitaEditNode.f.rightField'), 'field', { hint: K('cogitaEditNode.hint.thesis') }),
    f('count', K('cogitaEditNode.f.maxPairs'), 'number', { hint: '5' })
  ],
  pattern: [f('text', K('cogitaEditNode.f.pattern'), 'text', { hint: K('cogitaEditNode.hint.pattern') }), f('inputs', K('cogitaEditNode.f.inputs'), 'number'), f('joiner', K('cogitaEditNode.f.joiner'), 'text', { hint: ', ' })],
  mask: [f('mode', K('cogitaEditNode.f.maskMode'), 'select', { options: opts([['prefix', K('cogitaEditNode.opt.maskPrefix')], ['suffix', K('cogitaEditNode.opt.maskSuffix')], ['random', K('cogitaEditNode.opt.maskRandom')]]) }), f('keep', K('cogitaEditNode.f.keep'), 'number'), f('gap', K('cogitaEditNode.f.gap'), 'text', { hint: '…' })],
  fragments: [f('min', K('cogitaEditNode.f.minPiece'), 'number'), f('max', K('cogitaEditNode.f.maxPiece'), 'number')],
  pick: [f('position', K('cogitaEditNode.f.which'), 'select', { options: opts([['random', K('cogitaEditNode.opt.random')], ['first', K('cogitaEditNode.opt.first')], ['last', K('cogitaEditNode.opt.last')]]) })],
  distractors: [
    f('key', K('cogitaEditNode.f.distractorField'), 'field'), f('count', K('cogitaEditNode.f.count'), 'number'),
    f('from', K('cogitaEditNode.f.from'), 'lines', { hint: K('cogitaEditNode.hint.distractorFrom') }), f('list', K('cogitaEditNode.f.ownList'), 'lines')
  ],
  each: [],
  random: [
    f('min', K('cogitaEditNode.f.min'), 'number'), f('max', K('cogitaEditNode.f.max'), 'number'), f('step', K('cogitaEditNode.f.step'), 'number'),
    /* 2026-11-01 — oder eine Pozycja aus einer hier getippten Liste. */
    f('list', K('cogitaEditNode.f.orFromList'), 'lines', { hint: K('cogitaEditNode.hint.randomList') }),
    /* 2026-11-03 — k verschiedene auf einmal. */
    f('count', K('cogitaEditNode.f.howManyDifferent'), 'number', { hint: K('cogitaEditNode.hint.howManyDifferent') })
  ],
  /* 2026-11-03 — der eine Generator (`generator.ts`): dieselbe Einstellung wie an einer Frage. */
  generate: [
    f('params', K('cogitaEditNode.f.params'), 'json', { hint: '[{"name": "s", "random": [20, 500], "step": 10}, {"name": "f", "values": ["sin", "cos"]}, {"name": "anion", "entry": {"kind": "@chem/jon", "where": "it.ladunek < 0"}}, {"name": "zd", "entries": {"kind": "@hist/zdarzenie", "count": 4}}]' }),
    f('let', K('cogitaEditNode.f.let'), 'json', { hint: K('cogitaEditNode.hint.let') }),
    f('require', K('cogitaEditNode.f.require'), 'lines', { hint: K('cogitaEditNode.hint.require') }),
    f('texts', K('cogitaEditNode.f.texts'), 'json', { hint: K('cogitaEditNode.hint.texts') }),
    f('only', K('cogitaEditNode.f.only'), 'text', { hint: K('cogitaEditNode.hint.only') })
  ],
  math: [
    f('op', K('cogitaEditNode.f.op'), 'select', { options: opts([['add', '+'], ['sub', '−'], ['mul', '×'], ['div', '÷'], ['pow', K('cogitaEditNode.opt.pow')], ['exp', 'e^x'], ['log', 'log'], ['abs', '|x|'], ['min', 'min'], ['max', 'max'], ['floor', K('cogitaEditNode.opt.floor')], ['ceil', K('cogitaEditNode.opt.ceil')], ['round', K('cogitaEditNode.opt.round')], ['mod', K('cogitaEditNode.opt.mod')]]) }),
    f('decimals', K('cogitaEditNode.f.decimals'), 'number')
  ],
  /* 2026-11-01 (Lemma) — Rechnen in der Sprache der Rysunki, und Zusammenfassen vieler Werte. */
  calc: [
    f('expr', K('cogitaEditNode.f.expr'), 'longtext', { hint: K('cogitaEditNode.hint.expr') }),
    f('inputs', K('cogitaEditNode.f.inputs'), 'number', { hint: '1–8' }),
    f('decimals', K('cogitaEditNode.f.decimals'), 'number', { hint: K('cogitaEditNode.hint.noRounding') })
  ],
  aggregate: [
    f('op', K('cogitaEditNode.f.aggregateOp'), 'select', { options: opts([['sum', K('cogitaEditNode.opt.sum')], ['count', K('cogitaEditNode.opt.count')], ['min', K('cogitaEditNode.opt.min')], ['max', K('cogitaEditNode.opt.max')], ['avg', K('cogitaEditNode.opt.avg')]]), hint: K('cogitaEditNode.hint.sum') }),
    f('decimals', K('cogitaEditNode.f.decimals'), 'number', { hint: K('cogitaEditNode.hint.noRounding') })
  ],
  compare: [f('op', K('cogitaEditNode.f.compare'), 'select', { options: opts([['lt', 'a < b'], ['le', 'a ≤ b'], ['gt', 'a > b'], ['ge', 'a ≥ b'], ['eq', 'a = b'], ['ne', 'a ≠ b']]) })],
  when: [f('test', K('cogitaEditNode.f.condition'), 'select', { options: opts([['filled', K('cogitaEditNode.opt.filled')], ['empty', K('cogitaEditNode.opt.empty')], ['equals', K('cogitaEditNode.opt.equals')], ['differs', K('cogitaEditNode.opt.differs')]]) }), f('value', K('cogitaEditNode.f.value'), 'text')],
  python: [f('code', K('cogitaEditNode.f.code'), 'code'), f('inputs', K('cogitaEditNode.f.inputs'), 'number')],
  prompt: [],
  'answer.text': [f('rule', K('cogitaEditNode.f.rule'), 'rule')],
  'answer.gap': [f('rule', K('cogitaEditNode.f.rule'), 'rule')],
  'answer.number': [f('tolerance', K('cogitaEditNode.f.tolerance'), 'number'), f('relative', K('cogitaEditNode.f.relative'), 'bool'), f('unit', K('cogitaEditNode.f.unit'), 'text'), f('quantity', K('cogitaEditNode.f.quantity'), 'select', { options: QUANTITY_OPTIONS })],
  'answer.date': [f('precision', K('cogitaEditNode.f.precision'), 'select', { options: opts([['year', K('cogitaEditNode.opt.year')], ['month', K('cogitaEditNode.opt.month')], ['day', K('cogitaEditNode.opt.day')]]) }), f('tolerance', K('cogitaEditNode.f.tolerance'), 'number')],
  'answer.one': [],
  'answer.many': [],
  'answer.truefalse': [],
  'answer.order': [],
  'answer.match': [],
  'answer.flash': [],
  'answer.code': [f('task', K('cogitaEditNode.f.task'), 'longtext'), f('starter', K('cogitaEditNode.f.starter'), 'code'), f('createInput', 'create_input(seed)', 'code'), f('reference', 'reference(x)', 'code'), f('cases', K('cogitaEditNode.f.cases'), 'number')],
  'answer.point': [f('on', K('cogitaEditNode.f.on'), 'select', { options: opts([['map', K('cogitaEditNode.opt.map')], ['image', K('cogitaEditNode.opt.image')]]) }), f('r', K('cogitaEditNode.f.radius'), 'number'), f('x', K('cogitaEditNode.f.x'), 'number'), f('y', K('cogitaEditNode.f.y'), 'number')],
  card: []
};

/* -- Wiederholungen ------------------------------------------------------------------ */

const REVISION_FIELDS: Record<string, readonly ConfigField[]> = {
  'source.all': [],
  'source.kind': [f('kind', K('cogitaEditNode.f.kind'), 'kind'), f('from', K('cogitaEditNode.f.from'), 'source', { hint: K('cogitaEditNode.hint.fromAll') })],
  'source.collection': [f('collection', K('cogitaEditNode.f.collection'), 'collection')],
  'source.list': [f('ids', K('cogitaEditNode.f.ids'), 'lines', { hint: K('cogitaEditNode.hint.ids') })],
  /* 2026-10-22 (Schritt 11) — z kazania (albo innego wpisu): to, na co wskazuje. */
  'source.from': [f('entry', K('cogitaEditNode.f.fromEntry'), 'entity', { kinds: ['text', 'project', STATEMENT_KINDS] })],
  /* 2026-10-30 — ein gespeicherter Widok als Quelle einer Powtórka. */
  'source.view': [f('view', K('cogitaEditNode.f.view'), 'view')],
  filter: [f('templates', K('cogitaEditNode.f.onlyTemplates'), 'templates'), f('directions', K('cogitaEditNode.f.onlyDirections'), 'lines'), f('forms', K('cogitaEditNode.f.onlyForms'), 'forms'), f('levels', K('cogitaEditNode.f.onlyLevels'), 'levels'), f('dueOnly', K('cogitaEditNode.f.dueOnly'), 'bool')],
  /* 2026-10-22 (Schritt 9) — dieselben Schritte wie ein Widok (`selection.ts`). */
  follow: [
    f('field', K('cogitaEditNode.f.followField'), 'field', { hint: K('cogitaEditNode.hint.allRefs') }), f('back', K('cogitaEditNode.f.back'), 'bool'),
    f('keep', K('cogitaEditNode.f.keepStart'), 'bool')
  ],
  /* 2026-10-25 (Wywód) — entlang der Strukturfelder, die der Rodzaj erklärt. */
  structure: [
    f('dir', K('cogitaEditNode.f.dir'), 'select', { options: opts([['down', K('cogitaEditNode.opt.down')], ['up', K('cogitaEditNode.opt.up')]]) }),
    f('one', K('cogitaEditNode.f.oneLevel'), 'bool', { hint: K('cogitaEditNode.hint.oneLevel') }),
    f('keep', K('cogitaEditNode.f.keepStart'), 'bool')
  ],
  /* 2026-10-30 — entlang der Reihenfolge des Lernens (die Grundlagen dazu holen). */
  learning: [
    f('dir', K('cogitaEditNode.f.dir'), 'select', { options: opts([['before', K('cogitaEditNode.opt.before')], ['after', K('cogitaEditNode.opt.after')]]) }),
    f('one', K('cogitaEditNode.f.oneStep'), 'bool', { hint: K('cogitaEditNode.hint.oneStep') }),
    f('keep', K('cogitaEditNode.f.keepStart'), 'bool')
  ],
  'filter.rule': [f('rule', K('cogitaEditNode.f.query'), 'query')],
  /* 2026-10-30 — die eine Logik, auch über die Kenntnis: dieses Eintrags, seiner Karten, dessen, was vorher kommt … */
  'filter.when': [f('when', K('cogitaEditNode.f.condition'), 'when')],
  union: [],
  strategy: [
    f('mode', K('cogitaEditNode.rev.mode'), 'select', { options: MODES.map((m) => ({ value: m, get label() { return MODE_LABEL[m]; } })) }),
    f('order', K('cogitaEditNode.rev.order'), 'select', { options: ORDERS.map((o) => ({ value: o, get label() { return ORDER_LABEL[o]; } })), hint: K('cogitaEditNode.hint.orderEmpty') }),
    f('pick', K('cogitaEditNode.rev.pick'), 'select', { options: PICKS.map((p) => ({ value: p, get label() { return PICK_LABEL[p]; } })), hint: K('cogitaEditNode.hint.pickEmpty') }),
    f('count', K('cogitaEditNode.f.cardCount'), 'number'), f('stackSize', K('cogitaEditNode.f.stackSize'), 'number'), f('levels', K('cogitaEditNode.f.levels'), 'number'),
    f('minCorrectness', K('cogitaEditNode.f.minCorrectness'), 'number'),
    /* 2026-11-01 — nach den Bändern: ohne Häkchen lernt der Stapel „na zapas" weiter, wenn nichts mehr fällig und nichts neu ist. */
    f('endWhenDone', K('cogitaEditNode.f.endWhenDone'), 'bool', { hint: K('cogitaEditNode.hint.endWhenDone') }),
    f('rule', K('cogitaEditNode.f.textRule'), 'rule')
  ]
};

/* -- Abläufe ----------------------------------------------------------------------------- */

const OPEN = f('open', K('cogitaEditNode.f.open'), 'select', { options: opts([['screen', K('cogitaEditNode.opt.screen')], ['inline', K('cogitaEditNode.opt.inline')]]) });
const TITLE = f('title', K('cogitaEditNode.f.title'), 'text');

const FLOW_FIELDS: Record<string, readonly ConfigField[]> = {
  show: [TITLE, f('of', K('cogitaEditNode.f.show'), 'entity'), f('media', K('cogitaEditNode.f.media'), 'media'), OPEN],
  question: [TITLE, f('of', K('cogitaEditNode.f.question'), 'entity', { kinds: ['question'] }), f('card', K('cogitaEditNode.f.cardKey'), 'text'), OPEN],
  choice: [TITLE, f('options', K('cogitaEditNode.f.options'), 'options')],
  condition: [f('condition', K('cogitaEditNode.f.condition'), 'condition')],
  set: [f('actions', K('cogitaEditNode.f.actions'), 'actions')],
  chapters: [TITLE, f('chapters', K('cogitaEditNode.f.chapters'), 'chapters')],
  chapterEnd: [],
  restart: [],
  subflow: [f('flow', K('cogitaEditNode.f.flow'), 'flow')],
  each: [f('collection', K('cogitaEditNode.f.collection'), 'collection'), f('kind', K('cogitaEditNode.f.orKind'), 'kind'), f('flow', K('cogitaEditNode.f.flowEach'), 'flow')],
  expand: [f('of', K('cogitaEditNode.f.concept'), 'entity'), f('explain', K('cogitaEditNode.f.explain'), 'entity', { kinds: [STATEMENT_KINDS] }), f('threshold', K('cogitaEditNode.f.threshold'), 'number')],
  opening: [TITLE, f('mode', K('cogitaEditNode.f.opening'), 'select', { options: opts([['discovery', K('cogitaEditNode.opt.discovery')], ['recall', K('cogitaEditNode.opt.recall')]]) }), f('of', K('cogitaEditNode.f.about'), 'entity')],
  line: [f('character', K('cogitaEditNode.f.character'), 'entity'), f('of', K('cogitaEditNode.f.says'), 'entity', { kinds: [STATEMENT_KINDS] }), f('mood', K('cogitaEditNode.f.mood'), 'text'), f('condition', K('cogitaEditNode.f.onlyWhen'), 'condition')],
  handoff: [f('flow', K('cogitaEditNode.f.handoff'), 'flow')],
  /* 2026-11-04 (Prompt 13) — ein Abstecher: die Erzählung aus der Liste, wie er angeboten wird, ob er Pflicht ist. */
  detour: [f('flow', K('cogitaEditNode.f.detour'), 'flow', { cross: true, hint: K('cogitaEditNode.hint.detour') }), f('label', K('cogitaEditNode.f.detourLabel'), 'text', { hint: K('cogitaEditNode.hint.detourLabel') }), f('required', K('cogitaEditNode.f.required'), 'bool')],
  /* 2026-10-22 (Schritt 12) — eine Szene einer Präsentation (ihre Ausgänge kommen aus dem Storyboard). */
  scene: [TITLE, f('page', K('cogitaEditNode.f.page'), 'text'), f('scene', K('cogitaEditNode.f.scene'), 'text')],
  end: [],
  return: []
};

export function configFields(palette: string, type: string): readonly ConfigField[] {
  /* 2026-10-22 (Schritt 9) — ein Widok wählt mit denselben Schritten wie die Powtórka. */
  const table = palette === 'card-template' ? TEMPLATE_FIELDS : palette === 'revision' || palette === 'view' ? REVISION_FIELDS : palette === 'flow' ? FLOW_FIELDS : {};
  return table[type] ?? [];
}

export const FORM_OPTIONS: readonly { value: string; label: string }[] = ANSWER_FORMS.map((form) => ({ value: form, get label() { return ANSWER_FORM_LABEL[form]; } }));
export const LEVEL_OPTIONS: readonly { value: string; label: string }[] = (['unseen', 'learning', 'known'] as const).map((l) => ({ value: l, get label() { return LEVEL_LABEL[l]; } }));

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
    else if (typeof v === 'number' || typeof v === 'boolean') parts.push(`${field.label.split(' ')[0].toLowerCase()} ${v === true ? t('cogitaEditNode.summary.yes') : v === false ? t('cogitaEditNode.summary.no') : v}`);
    else if (field.type === 'options' && Array.isArray(v)) parts.push(t('cogitaEditNode.summary.options', { count: v.length }));
    else if (field.type === 'chapters' && Array.isArray(v)) parts.push(t('cogitaEditNode.summary.chapters', { count: v.length }));
    /* 2026-11-03 — der Generator: welche Namen er zieht oder rechnet. */
    else if (field.type === 'json' && Array.isArray(v)) {
      const names = v.map((x) => (typeof x === 'object' && x !== null && typeof (x as { name?: unknown }).name === 'string' ? (x as { name: string }).name : '')).filter((x) => x !== '');
      if (names.length > 0) parts.push(names.slice(0, 4).join(', '));
    }
    if (parts.length >= 2) break;
  }
  return parts.join(' · ');
}
