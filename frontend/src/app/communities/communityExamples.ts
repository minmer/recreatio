/* i18n-ignore-file */
/* Die Beispieldokumente sind Inhalt (polnische Gemeinschaften mit polnischen Namen, auch Vorlagen im MCP) —
   sie werden nicht übersetzt; nur ihre Bezeichnungen kommen aus `communities.examples`. */
/**
 * 0137 — BEISPIELE EINER WSPÓLNOTA, je ein Anwendungsfall: Schule mit Klassen, zwei Rejony des Domowy
 * Kościół (später unter eine Diözese gehängt), Oaza in der Pfarrei, Rekolekcje-Turnus, Chor, Lerngruppe.
 * Keine festen Typen — nur Einstellungen. Jedes lässt sich ohne ein Wort importieren
 * (`scripts/app-json-community-check.mjs`) und steht im MCP (`import-formats.mjs`, `templates/communities/`).
 */

import { t } from '../core/i18n';
import { COMMUNITY_FORMAT } from './community';

const doc = (body: Record<string, unknown>): Record<string, unknown> => ({ format: COMMUNITY_FORMAT, version: 1, ...body });

/** Szenario 1: Schule → Klassen (Bauplan), Lehrer = Leitung, Schüler = Teilnehmer, Lektionen und Cogita. */
const school = () => doc({
  name: 'Liceum — religia i fizyka',
  positions: [
    { key: 'nauczyciel', name: 'Nauczyciel', rights: 'lead' },
    { key: 'uczen', name: 'Uczeń', rights: 'participant' }
  ],
  fields: [{ key: 'ocena-sem', label: 'Ocena semestralna', kind: 'number', leadersOnly: false }],
  blueprints: [{
    key: 'klasa', name: 'Klasa', kind: 'class', positions: ['nauczyciel', 'uczen'],
    settings: { tools: { chat: true, askLeaders: true, lessons: true, cogita: true, notes: true, tables: true, attendance: true }, talk: { direct: false } }
  }],
  unit: {
    key: 'szkola', name: 'Liceum im. Jana Pawła II', kind: 'school', address: 'liceum-jp2',
    positions: ['nauczyciel'],
    settings: {
      life: { duration: 'permanent', place: 'onsite', rhythm: 'weekly', open: 'invite', yearFrom: '09-01', yearUntil: '06-26' },
      intake: { mode: 'leaders' },
      tools: { chat: false, announcements: true, calendar: true },
      visibility: { default: 'unit', subunitsSee: true }
    },
    people: { nauczyciel: ['Michał Mleczek'] },
    units: [
      { key: '2b', name: 'Klasa 2b', from: 'klasa', people: { nauczyciel: ['@michal-mleczek'], uczen: ['Anna Nowak', 'Piotr Zieliński', 'Zofia Wójcik'] } },
      { key: '3a', name: 'Klasa 3a', from: 'klasa', people: { nauczyciel: ['@michal-mleczek'], uczen: ['Jan Lis', 'Maria Kot'] } }
    ]
  },
  persons: []
});

const dkPositions = [
  { key: 'para-rejonowa', name: 'Para rejonowa', rights: 'lead', pair: true, assign: 'elected', term: '3 lata' },
  { key: 'para-lacznikowa', name: 'Para łącznikowa', rights: 'cooperate', pair: true, assign: 'appointed', note: 'w imieniu pary rejonowej opiekuje się wybranymi kręgami' },
  { key: 'moderator-rejonu', name: 'Moderator rejonu', rights: 'accompany', assign: 'appointed' },
  { key: 'para-animatorska', name: 'Para animatorska', rights: 'lead', pair: true, assign: 'elected', term: '1 rok', note: 'wybierana w czerwcu; nowy krąg — na rok mianuje para pilotująca' },
  { key: 'moderator-kregu', name: 'Moderator kręgu', rights: 'accompany', assign: 'appointed' },
  { key: 'czlonek', name: 'Członek kręgu', rights: 'member' }
];

const dkBlueprint = {
  key: 'krag', name: 'Krąg', kind: 'group', positions: ['para-animatorska', 'moderator-kregu', 'czlonek'],
  settings: { life: { rhythm: 'monthly' }, tools: { chat: true, announcements: false, askLeaders: true } }
};

const dkRejonSettings = {
  life: { duration: 'permanent', place: 'onsite', rhythm: 'monthly', open: 'invite', yearFrom: '09-01', yearUntil: '06-30' },
  structure: { council: true },
  intake: { mode: 'leaders' },
  tools: { chat: true, announcements: true, calendar: true, polls: true, forms: true },
  visibility: { default: 'unit', subunitsSee: true },
  public: { page: true, description: 'Rejon Domowego Kościoła — kręgi rodzin Ruchu Światło-Życie.', events: true }
};

/** Szenario 2a: Domowy Kościół — ein Rejon mit drei Kręgi (Bauplan „krąg”), Krąg rejonowy, Pary in Leitung. */
const dkRejon13 = () => doc({
  name: 'DK — Rejon XIII',
  positions: dkPositions,
  fields: [],
  blueprints: [dkBlueprint],
  unit: {
    key: 'rejon-13', name: 'Rejon XIII', kind: 'organisation', address: 'dk-rejon-13',
    positions: ['para-rejonowa', 'para-lacznikowa', 'moderator-rejonu'],
    council: { key: 'krag-rejonowy-13', name: 'Krąg rejonowy XIII', own: ['para-rejonowa', 'moderator-rejonu'], below: ['para-animatorska'] },
    settings: dkRejonSettings,
    units: [
      { key: 'krag-13-1', name: 'Krąg 1 (Rejon XIII)', from: 'krag' },
      { key: 'krag-13-2', name: 'Krąg 2 (Rejon XIII)', from: 'krag' },
      { key: 'krag-13-3', name: 'Krąg 3 (Rejon XIII)', from: 'krag' }
    ]
  },
  persons: [
    { key: 'anna-kowalska', name: 'Anna Kowalska', pair: 'jan-kowalski', places: [{ unit: 'rejon-13', position: 'para-rejonowa' }, { unit: 'krag-13-3', position: 'czlonek' }] },
    { key: 'jan-kowalski', name: 'Jan Kowalski', pair: 'anna-kowalska', places: [{ unit: 'rejon-13', position: 'para-rejonowa' }, { unit: 'krag-13-3', position: 'czlonek' }] },
    { key: 'ks-adam', name: 'ks. Adam Nowicki', places: [{ unit: 'rejon-13', position: 'moderator-rejonu' }] },
    { key: 'ewa-mazur', name: 'Ewa Mazur', pair: 'tomasz-mazur', places: [{ unit: 'krag-13-1', position: 'para-animatorska' }] },
    { key: 'tomasz-mazur', name: 'Tomasz Mazur', pair: 'ewa-mazur', places: [{ unit: 'krag-13-1', position: 'para-animatorska' }] },
    { key: 'maria-lis', name: 'Maria Lis', places: [{ unit: 'krag-13-1', position: 'czlonek' }] },
    { key: 'pawel-lis', name: 'Paweł Lis', places: [{ unit: 'krag-13-1', position: 'czlonek' }] }
  ]
});

/** Szenario 2b: ein zweiter, kleiner Rejon daneben — später beide unter die Diözese („Połącz pod nową jednostką”). */
const dkRejon1 = () => doc({
  name: 'DK — Rejon I Bieżanów',
  positions: dkPositions,
  fields: [],
  blueprints: [dkBlueprint],
  unit: {
    key: 'rejon-1', name: 'Rejon I Bieżanów', kind: 'organisation', address: 'dk-rejon-1',
    positions: ['para-rejonowa', 'moderator-rejonu'],
    council: { key: 'krag-rejonowy-1', name: 'Krąg rejonowy I', own: ['para-rejonowa', 'moderator-rejonu'], below: ['para-animatorska'] },
    settings: dkRejonSettings,
    units: [
      { key: 'krag-1-1', name: 'Krąg 1 (Rejon I)', from: 'krag' },
      { key: 'krag-1-2', name: 'Krąg 2 (Rejon I)', from: 'krag' }
    ]
  },
  persons: [
    { key: 'barbara-wrona', name: 'Barbara Wrona', pair: 'krzysztof-wrona', places: [{ unit: 'rejon-1', position: 'para-rejonowa' }] },
    { key: 'krzysztof-wrona', name: 'Krzysztof Wrona', pair: 'barbara-wrona', places: [{ unit: 'rejon-1', position: 'para-rejonowa' }] }
  ]
});

/** Szenario 2c: Oaza w parafii — grupy formacyjne według stopnia (same), schola, teatr; strona publiczna. */
const oaza = () => doc({
  name: 'Oaza parafialna',
  positions: [
    { key: 'moderator', name: 'Moderator', rights: 'accompany' },
    { key: 'animator', name: 'Animator', rights: 'cooperate', per: { count: 8, of: 'uczestnik' } },
    { key: 'uczestnik', name: 'Uczestnik', rights: 'member' }
  ],
  fields: [{ key: 'stopien', label: 'Stopień formacji', kind: 'choice', options: ['ODB', 'OND', 'ONŻ'] }],
  blueprints: [],
  unit: {
    key: 'oaza', name: 'Oaza przy parafii', kind: 'group', address: 'oaza-parafia',
    positions: ['moderator', 'animator', 'uczestnik'],
    settings: {
      life: { duration: 'permanent', place: 'onsite', rhythm: 'weekly', weekday: 'pt', time: '19:00', location: 'Salka oazowa', open: 'anyone' },
      structure: { subgroups: 'byField', byField: 'stopien' },
      intake: { mode: 'signup', confirm: true, minors: true },
      tools: { chat: true, announcements: true, calendar: true, attendance: true, lessons: true },
      public: { page: true, description: 'Spotkania w piątki o 19:00, Msza niedzielna o 11:00. Zapraszamy młodzież.', meetings: 'piątek 19:00, niedziela 11:00', events: true }
    },
    units: [
      { key: 'schola', name: 'Schola', kind: 'group', positions: ['animator', 'uczestnik'] },
      { key: 'teatr', name: 'Grupa teatralna', kind: 'group', positions: ['animator', 'uczestnik'] }
    ]
  },
  persons: [
    { key: 'ks-marek', name: 'ks. Marek Zając', places: [{ unit: 'oaza', position: 'moderator' }] },
    { key: 'kasia-bury', name: 'Kasia Bury', places: [{ unit: 'oaza', position: 'animator' }, { unit: 'schola', position: 'animator' }] },
    { key: 'ola-sowa', name: 'Ola Sowa', fields: { stopien: 'OND' }, places: [{ unit: 'oaza', position: 'uczestnik' }] },
    { key: 'kuba-jez', name: 'Kuba Jeż', fields: { stopien: 'ODB' }, places: [{ unit: 'oaza', position: 'uczestnik' }, { unit: 'teatr', position: 'uczestnik' }] }
  ]
});

/** Szenario 2d: Rekolekcje-Turnus — befristet, Gruppen nach Stufe, öffentliche Anmeldung, Personalplanung. */
const turnus = () => doc({
  name: 'Oaza wakacyjna — turnus II',
  positions: [
    { key: 'moderator', name: 'Moderator', rights: 'lead' },
    { key: 'diakonia', name: 'Diakonia (animatorzy, muzyczna, liturgiczna)', rights: 'cooperate' },
    { key: 'animator', name: 'Animator grupy', rights: 'lead', per: { count: 4, of: 'uczestnik' } },
    { key: 'uczestnik', name: 'Uczestnik', rights: 'participant' }
  ],
  fields: [
    { key: 'stopien', label: 'Stopień', kind: 'choice', options: ['OND', 'ONŻ I°', 'ONŻ II°'] },
    { key: 'dieta', label: 'Dieta', kind: 'text', leadersOnly: true },
    { key: 'rodzic', label: 'Telefon rodzica', kind: 'line', leadersOnly: true }
  ],
  blueprints: [{ key: 'grupa', name: 'Grupa', kind: 'group', positions: ['animator', 'uczestnik'], settings: { tools: { chat: true, announcements: false } } }],
  unit: {
    key: 'turnus-2', name: 'Turnus II — Krościenko 2027', kind: 'event', address: 'oaza-2027-turnus-2',
    positions: ['moderator', 'diakonia', 'uczestnik'],
    settings: {
      life: { duration: 'limited', from: '2027-07-15', until: '2027-07-29', place: 'onsite', rhythm: 'once', open: 'anyone' },
      intake: { mode: 'signup', limit: 38, waitlist: true, requires: 'ukończony stopień niższy w tym roku formacyjnym', confirm: true, minors: true, health: true },
      tools: { chat: true, announcements: true, calendar: true, attendance: true, staffing: true, notes: true },
      public: { page: true, description: 'Piętnaście dni rekolekcji oazowych dla młodzieży. Liczba miejsc ograniczona.', events: true, reports: true }
    },
    units: [
      { key: 'grupa-ond', name: 'Grupa OND', from: 'grupa' },
      { key: 'grupa-onz1', name: 'Grupa ONŻ I°', from: 'grupa' },
      { key: 'grupa-onz2', name: 'Grupa ONŻ II°', from: 'grupa' }
    ]
  },
  persons: [
    { key: 'ks-piotr', name: 'ks. Piotr Grab', places: [{ unit: 'turnus-2', position: 'moderator' }] },
    { key: 'magda-ryba', name: 'Magda Ryba', places: [{ unit: 'turnus-2', position: 'diakonia' }, { unit: 'grupa-ond', position: 'animator' }] }
  ]
});

/** Szenario 2e: Chor — Untergruppen nach Stimme (automatisch), Dirigent, Proben, Konzerte öffentlich. */
const choir = () => doc({
  name: 'Chór parafialny',
  positions: [
    { key: 'dyrygent', name: 'Dyrygent', rights: 'lead' },
    { key: 'zarzad', name: 'Zarząd chóru', rights: 'cooperate' },
    { key: 'chorzysta', name: 'Chórzysta', rights: 'member' }
  ],
  fields: [{ key: 'glos', label: 'Głos', kind: 'choice', options: ['sopran', 'alt', 'tenor', 'bas'] }],
  blueprints: [],
  unit: {
    key: 'chor', name: 'Chór parafialny', kind: 'group', address: 'chor-parafialny',
    positions: ['dyrygent', 'zarzad', 'chorzysta'],
    settings: {
      life: { duration: 'permanent', place: 'onsite', rhythm: 'weekly', weekday: 'cz', time: '19:00', minutes: 120, location: 'Sala pod kościołem', open: 'anyone' },
      structure: { subgroups: 'byField', byField: 'glos' },
      intake: { mode: 'link' },
      tools: { chat: true, announcements: true, calendar: true, attendance: true, lessons: true },
      visibility: { subunitsSee: true },
      public: { page: true, description: 'Śpiewamy na Pasterce, w Triduum i na odpuście. Próby w czwartki.', meetings: 'czwartek 19:00–21:00', events: true }
    },
    extra: {
      appointments: [
        { key: 'pasterka', title: 'Pasterka — śpiew chóru', start: '2026-12-24T23:30', end: '2026-12-25T01:00', location: 'Kościół parafialny' },
        { key: 'odpust', title: 'Odpust parafialny — Msza z chórem', start: '2027-06-29T11:00', end: '12:30' }
      ]
    }
  },
  persons: [
    { key: 'teresa-dab', name: 'Teresa Dąb', places: [{ unit: 'chor', position: 'dyrygent' }] },
    { key: 'ala-mak', name: 'Ala Mak', fields: { glos: 'sopran' }, places: [{ unit: 'chor', position: 'chorzysta' }] },
    { key: 'bartek-wos', name: 'Bartek Woś', fields: { glos: 'tenor' }, places: [{ unit: 'chor', position: 'chorzysta' }] },
    { key: 'celina-rak', name: 'Celina Rak', fields: { glos: 'alt' }, places: [{ unit: 'chor', position: 'chorzysta' }, { unit: 'chor', position: 'zarzad' }] }
  ]
});

/** Szenario 3: Lerngruppe mit Cogita — online, nach Bedarf, nur auf Einladung, Gespräche mit mir und untereinander. */
const learning = () => doc({
  name: 'Grupa: Grawitacja krok po kroku',
  positions: [
    { key: 'prowadzacy', name: 'Prowadzący', rights: 'lead' },
    { key: 'uczacy-sie', name: 'Uczący się', rights: 'participant' }
  ],
  fields: [],
  blueprints: [],
  unit: {
    key: 'grawitacja', name: 'Grupa: Grawitacja', kind: 'course', address: 'grupa-grawitacja',
    positions: ['prowadzacy', 'uczacy-sie'],
    settings: {
      life: { duration: 'limited', from: '2026-11-10', until: '2027-01-31', place: 'online', rhythm: 'asNeeded', open: 'invite' },
      intake: { mode: 'leaders' },
      tools: { chat: true, announcements: true, askLeaders: true, calendar: false, cogita: true, lessons: true },
      talk: { direct: true },
      visibility: { default: 'unit' }
    },
    people: { prowadzacy: ['Michał Mleczek'], 'uczacy-sie': ['Hania Górska', 'Igor Pawlak', 'Julia Sikora'] }
  },
  persons: []
});

export interface Example { readonly key: string; readonly label: string; readonly doc: () => Record<string, unknown> }

/** Die Bezeichnung kommt beim Lesen aus `communities.examples.<name>`. */
const example = (key: string, name: string, doc: () => Record<string, unknown>): Example =>
  ({ key, doc, get label() { return t(`communities.examples.${name}`); } });

export const EXAMPLES: readonly Example[] = [
  example('szkola', 'school', school),
  example('dk-rejon-13', 'dkRejon13', dkRejon13),
  example('dk-rejon-1', 'dkRejon1', dkRejon1),
  example('oaza', 'oaza', oaza),
  example('turnus', 'turnus', turnus),
  example('chor', 'choir', choir),
  example('grupa-nauki', 'learning', learning)
];
