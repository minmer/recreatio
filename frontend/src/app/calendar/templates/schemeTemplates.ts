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
    node('r_wait', 'wait', 260, 160, { message: 'Intencja czeka na przyjęcie przez kancelarię.' }),
    node('r_single', 'if', 520, 0, when({ t: 'mode', modes: ['single'] })),
    node('r_any', 'if', 520, 160, when({ t: 'count', scope: 'occurrence', status: 'live', op: '>=', n: 1 })),
    node('r_refuse_single', 'refuse', 520, 320, { message: 'Ta msza ma już intencję — intencja pojedyncza musi być jedyna.' }),
    node('r_has_single', 'if', 780, 0, when({ t: 'count', scope: 'occurrence', mode: 'single', status: 'live', op: '>=', n: 1 })),
    node('r_refuse_mixed', 'refuse', 780, 160, { message: 'Na tej mszy jest intencja pojedyncza — zbiorowa nie może do niej dojść.' }),
    node('r_coll_here', 'if', 1040, 0, when({ t: 'count', scope: 'occurrence', mode: 'collective', status: 'live', op: '>=', n: 1 })),
    node('r_week', 'if', 1300, 0, when({ t: 'count', scope: 'week', mode: 'collective', status: 'live', per: 'occurrence', op: '>=', n: 2 })),
    node('r_refuse_week', 'refuse', 1300, 160, { message: 'W tym tygodniu są już dwie msze z intencjami zbiorowymi.' }),
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
    node('z_refuse', 'refuse', 260, 320, { message: 'Nie ma już wolnych miejsc.' }),
    node('z_outside', 'if', 520, 0, when({ t: 'actor', is: 'outside' })),
    node('z_wait', 'wait', 520, 160, { message: 'Zapis czeka na potwierdzenie.' }),
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

const OBCHOD: SchemeField = {
  key: 'obchod', label: 'Obchód', type: 'text', public: true,
  says: 'Obchód dnia albo formularz mszy (np. „Wszystkich Świętych”, „XXX Niedziela zwykła”) — stoi w planie i w gablocie.'
};

const KOLOR: SchemeField = {
  key: 'kolor', label: 'Kolor szat', type: 'colour', public: true, options: LITURGICAL_COLOURS,
  says: 'Kolor szat liturgicznych — w planie jako znaczek koloru.'
};

const CZYTANIA: SchemeField = {
  key: 'czytania', label: 'Czytania', type: 'bible',
  says: 'Sigla czytań, np. „Iz 7,10-14; Ps 24; Rz 1,1-7; Mt 1,18-24” — tylko odnośniki, bez tekstów.'
};

const intentions = UNIVERSAL.lists[0];

export const SCHEME_TEMPLATES: readonly { readonly id: string; readonly def: SchemeDef }[] = [
  {
    id: 'msza',
    def: {
      name: 'Msza',
      kind: 'mass',
      publicTitle: true,
      fields: [OBCHOD, KOLOR, CZYTANIA],
      lists: [{
        key: intentions.key,
        label: intentions.label,
        itemLabel: intentions.itemLabel,
        modes: INTENTION_MODES,
        textLabel: intentions.textLabel,
        person: intentions.person,
        fields: intentions.fields,
        rule: INTENTION_RULE,
        says: 'Intencje mszy: treść czytana na mszy i w gablocie; pojedyncza stoi sama, zbiorowych najwyżej dwie msze w tygodniu.'
      }],
      says: 'Msza z obchodem, kolorem szat, czytaniami i intencjami (z regułą pojedynczych i zbiorowych).'
    }
  },
  {
    id: 'nabozenstwo',
    def: {
      name: 'Nabożeństwo',
      kind: 'devotion',
      publicTitle: true,
      fields: [OBCHOD, KOLOR],
      lists: [],
      says: 'Nabożeństwo (Różaniec, Droga Krzyżowa, Gorzkie Żale …) z obchodem i kolorem.'
    }
  },
  {
    id: 'spowiedz',
    def: {
      name: 'Spowiedź',
      kind: 'confession',
      publicTitle: true,
      fields: [{
        key: 'dla_wiernych', label: 'Dla wiernych', type: 'text', public: true,
        says: 'Krótka informacja w planie, np. „przy konfesjonale św. Józefa”.'
      }],
      lists: [],
      says: 'Spowiedź z krótką jawną informacją.'
    }
  },
  {
    id: 'spotkanie-zapisy',
    def: {
      name: 'Spotkanie z zapisami',
      kind: 'appointment',
      fields: [{ key: 'prowadzi', label: 'Prowadzi', type: 'text', public: true, says: 'Kto prowadzi spotkanie.' }],
      lists: [{
        key: 'zapisy',
        label: 'Zapisy',
        itemLabel: 'zapis',
        modes: [{ value: 'tak', label: 'będę' }, { value: 'moze', label: 'może' }, { value: 'nie', label: 'nie będę' }],
        person: 'Kto',
        fields: [{ key: 'uwagi', label: 'Uwagi', type: 'text', says: 'Uwagi do zapisu — widzi je kancelaria.' }],
        outside: true,
        rule: SIGNUP_RULE,
        says: 'Zapisy na termin: „będę” liczy się do miejsc (20, do zmiany w regule); zapis z zewnątrz czeka na potwierdzenie.'
      }],
      says: 'Spotkanie, na które można się zapisać (np. kandydaci do bierzmowania wybierają termin).'
    }
  }
];

export const schemeTemplate = (id: string) => SCHEME_TEMPLATES.find((t) => t.id === id);
