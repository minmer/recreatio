/**
 * 2026-10-26 — VORLAGEN FÜR SCHEMATA (D13 C: es gibt sie, aber sie kommen nur
 * von Hand in einen Kalender — „Dodaj z szablonu").
 *
 * <b>Msza</b>: Obchód und Kolor szat gehen offen hinaus (Plan, Gablota, Druck),
 * Czytania sind Verweise (Sigla, D16 — keine Texte). Die Intentionen sind die
 * Liste des universellen Schemas (`intencje`, dieselben Schlüssel, damit
 * „Msze i nabożeństwa" sie liest) — mit einer Regel als Ablauf: von aussen
 * wartet sie; eine pojedyncza steht allein; eine zbiorowa kommt nicht zu
 * einer pojedynczej; höchstens zwei Messen mit zbiorowe in einer Woche.
 *
 * Alles hier ist ein Vorschlag: die Pfarrei ändert Felder, Arten und Regel.
 */

import type { FlowDoc, FlowEdge, FlowNode, FlowNodeType, FlowOut, Test } from '../flow/flowModel';
import { INTENTION_MODES, LITURGICAL_COLOURS, UNIVERSAL, type SchemeDef, type SchemeField } from '../scheme';
import { t } from '../../core/i18n';

/*
 * Die Wörter einer Vorlage werden beim Lesen geholt (`calendarApp.tpl.*`) — in der Sprache, in der
 * jemand die Vorlage in seinen Kalender holt; danach gehören sie ihm.
 */
function worded<T extends object, K extends string>(base: T, keys: Readonly<Record<K, string>>): T & Readonly<Record<K, string>> {
  for (const k of Object.keys(keys) as K[]) {
    Object.defineProperty(base, k, { get: () => t(`calendarApp.tpl.${keys[k]}`), enumerable: true, configurable: true });
  }
  return base as T & Readonly<Record<K, string>>;
}
const msg = (key: string) => worded({}, { message: key });

const node = (id: string, type: FlowNodeType, x: number, y: number, data: Record<string, unknown> = {}): FlowNode => ({ id, type, x, y, data });
const edge = (from: string, to: string, out: FlowOut = 'out'): FlowEdge => ({ id: `${from}-${out}-${to}`, from, to, ...(out === 'out' ? {} : { out }) });
const when = (test: Test) => ({ test });

/**
 * Die Regel der Intentionen (bearbeitbar):
 *
 * <code>
 *   Nowy wpis → z zewnątrz?            tak → Czeka
 *             → pojedyncza?            tak → jest już intencja?        tak → Odmów   nie → Przyjmij
 *             → (zbiorowa) jest pojedyncza?                              tak → Odmów
 *             → ta msza ma już zbiorowe?                                tak → Przyjmij
 *             → w tygodniu ≥ 2 inne msze ze zbiorowymi?                 tak → Odmów   nie → Przyjmij
 * </code>
 */
export const INTENTION_RULE: FlowDoc = {
  v: 1,
  nodes: [
    node('r_start', 'record-start', 0, 0),
    node('r_outside', 'if', 260, 0, when({ t: 'actor', is: 'outside' })),
    node('r_wait', 'wait', 260, 160, msg('rule.intentionWaits')),
    node('r_single', 'if', 520, 0, when({ t: 'mode', modes: ['single'] })),
    node('r_any', 'if', 520, 160, when({ t: 'count', scope: 'occurrence', status: 'live', op: '>=', n: 1 })),
    node('r_refuse_single', 'refuse', 520, 320, msg('rule.singleAlone')),
    node('r_has_single', 'if', 780, 0, when({ t: 'count', scope: 'occurrence', mode: 'single', status: 'live', op: '>=', n: 1 })),
    node('r_refuse_mixed', 'refuse', 780, 160, msg('rule.noMixed')),
    node('r_coll_here', 'if', 1040, 0, when({ t: 'count', scope: 'occurrence', mode: 'collective', status: 'live', op: '>=', n: 1 })),
    node('r_week', 'if', 1300, 0, when({ t: 'count', scope: 'week', mode: 'collective', status: 'live', per: 'occurrence', op: '>=', n: 2 })),
    node('r_refuse_week', 'refuse', 1300, 160, msg('rule.weekFull')),
    node('r_allow', 'allow', 1560, 160)
  ],
  edges: [
    edge('r_start', 'r_outside'),
    edge('r_outside', 'r_wait', 'yes'),
    edge('r_outside', 'r_single', 'no'),
    edge('r_single', 'r_any', 'yes'),
    edge('r_single', 'r_has_single', 'no'),
    edge('r_any', 'r_refuse_single', 'yes'),
    edge('r_any', 'r_allow', 'no'),
    edge('r_has_single', 'r_refuse_mixed', 'yes'),
    edge('r_has_single', 'r_coll_here', 'no'),
    edge('r_coll_here', 'r_allow', 'yes'),
    edge('r_coll_here', 'r_week', 'no'),
    edge('r_week', 'r_refuse_week', 'yes'),
    edge('r_week', 'r_allow', 'no')
  ]
};

/** Die Anmeldung: „będę" zählt gegen die Plätze (wartende mit); von aussen wartet sie. */
export const SIGNUP_RULE: FlowDoc = {
  v: 1,
  nodes: [
    node('z_start', 'record-start', 0, 0),
    node('z_coming', 'if', 260, 0, when({ t: 'mode', modes: ['tak'] })),
    node('z_full', 'if', 260, 160, when({ t: 'count', scope: 'occurrence', mode: 'tak', status: 'all', op: '>=', n: 20 })),
    node('z_refuse', 'refuse', 260, 320, msg('rule.noPlaces')),
    node('z_outside', 'if', 520, 0, when({ t: 'actor', is: 'outside' })),
    node('z_wait', 'wait', 520, 160, msg('rule.signupWaits')),
    node('z_allow', 'allow', 780, 0)
  ],
  edges: [
    edge('z_start', 'z_coming'),
    edge('z_coming', 'z_full', 'yes'),
    edge('z_coming', 'z_outside', 'no'),
    edge('z_full', 'z_refuse', 'yes'),
    edge('z_full', 'z_outside', 'no'),
    edge('z_outside', 'z_wait', 'yes'),
    edge('z_outside', 'z_allow', 'no')
  ]
};

const OBCHOD: SchemeField = worded({ key: 'obchod', type: 'text', public: true } as const, { label: 'field.obchod.label', says: 'field.obchod.says' });

const KOLOR: SchemeField = worded({ key: 'kolor', type: 'colour', public: true, options: LITURGICAL_COLOURS } as const,
  { label: 'field.kolor.label', says: 'field.kolor.says' });

const CZYTANIA: SchemeField = worded({ key: 'czytania', type: 'bible' } as const, { label: 'field.czytania.label', says: 'field.czytania.says' });

const intentions = UNIVERSAL.lists[0];

export const SCHEME_TEMPLATES: readonly { readonly id: string; readonly def: SchemeDef }[] = [
  {
    id: 'msza',
    def: worded({
      kind: 'mass',
      publicTitle: true,
      fields: [OBCHOD, KOLOR, CZYTANIA],
      lists: [worded({
        key: intentions.key,
        label: intentions.label,
        itemLabel: intentions.itemLabel,
        modes: INTENTION_MODES,
        textLabel: intentions.textLabel,
        person: intentions.person,
        fields: intentions.fields,
        rule: INTENTION_RULE
      }, { says: 'msza.listSays' })]
    }, { name: 'msza.name', says: 'msza.says' }) as SchemeDef
  },
  {
    id: 'nabozenstwo',
    def: worded({
      kind: 'devotion',
      publicTitle: true,
      fields: [OBCHOD, KOLOR],
      lists: []
    }, { name: 'nabozenstwo.name', says: 'nabozenstwo.says' }) as SchemeDef
  },
  {
    id: 'spowiedz',
    def: worded({
      kind: 'confession',
      publicTitle: true,
      fields: [worded({ key: 'dla_wiernych', type: 'text', public: true } as const, { label: 'spowiedz.fieldLabel', says: 'spowiedz.fieldSays' })],
      lists: []
    }, { name: 'spowiedz.name', says: 'spowiedz.says' }) as SchemeDef
  },
  {
    id: 'spotkanie-zapisy',
    def: worded({
      kind: 'appointment',
      fields: [worded({ key: 'prowadzi', type: 'text', public: true } as const, { label: 'zapisy.leadLabel', says: 'zapisy.leadSays' })],
      lists: [worded({
        key: 'zapisy',
        modes: [worded({ value: 'tak' }, { label: 'zapisy.yes' }), worded({ value: 'moze' }, { label: 'zapisy.maybe' }), worded({ value: 'nie' }, { label: 'zapisy.no' })],
        fields: [worded({ key: 'uwagi', type: 'text' } as const, { label: 'zapisy.notesLabel', says: 'zapisy.notesSays' })],
        outside: true,
        rule: SIGNUP_RULE
      }, { label: 'zapisy.listLabel', itemLabel: 'zapisy.itemLabel', person: 'zapisy.person', says: 'zapisy.listSays' })]
    }, { name: 'zapisy.name', says: 'zapisy.says' }) as SchemeDef
  }
];

export const schemeTemplate = (id: string) => SCHEME_TEMPLATES.find((t) => t.id === id);
