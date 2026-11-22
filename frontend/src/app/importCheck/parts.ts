/**
 * 2026-11-22 (A1) — DIE ADAPTER DER ÜBRIGEN IMPORTE: je Format ein Aufruf seines Planers (derselbe wie in der App), mit einem
 * Stand, den die Prüfung kennt. Der Dienst kennt den Stand eines Kalenders, einer Rozmowa, der Rollen … nicht (er ist
 * versiegelt oder gehört dem Konto) — geprüft wird gegen einen leeren Stand, der aus dem Dokument selbst nimmt, was es nennt
 * (Kalender, Bereiche): so prüft es Form, Werte und Zusammenhang; ob eine genannte Kennung wirklich existiert, sagt erst die
 * Vorschau in der App (das steht als Satz in `note`).
 */

import { t } from '../core/i18n';
import { readDoc } from './knowledge';
import type { RawCheck } from './check';
import { thrown } from './check';

import { PAGE_FORMAT } from '../pages/pageJson';
import { planPreview } from '../preview/previewDoc';
import { lintDocument } from '../preview/previewLint';
import { readModuleWish } from '../modules/moduleWish';
import { planArea, planLines, readAreaDocument, DEFAULT_AREA_IMPORT, keyBook } from '../areas/areaJson';
import { readCommunity } from '../communities/communityJson';
import { planLibraryImport, type ImportBase } from '../library/libraryJson';
import { planLiturgyImport, problemLine } from '../library/liturgy/liturgyJson';
import { effectiveEntities } from '../library/liturgy/defaults';
import { planWorkWithText } from '../library/sourceImport';
import { planSourceImport } from '../library/sourceText';
import { planQuotes, type QuoteBase } from '../library/libraryQuotes';
import { planScriptoriumImport } from '../scriptorium/scriptoriumJson';
import { planCalendar } from '../calendar/calendarJson';
import { readPlan, readScheme } from '../calendar/schemeJson';
import { planTasksImport } from '../calendar/tasksJson';
import { planMassesImport } from '../masses/massesJson';
import { planBookingsImport } from '../bookings/bookingsJson';
import { planRegistryImport } from '../registry/postalJson';
import { planEntries } from '../forms/entriesJson';
import { planContactsJson } from '../phone/contactsJson';
import { planRolesImport } from '../roles/rolesJson';
import { importContext, planChatImport } from '../chat/chatJson';
import { planLampsImport } from '../lamps/lampsJson';
import { FASTEST } from '../lamps/pace';
import { planPersons } from '../account/personsJson';
import { planAddresses } from '../pages/addressesJson';
import { planView } from '../workspace/viewJson';
import { DEFAULT_ALERTS } from '../workspace/alerts';
import { planProgress } from '../cogita/progressJson';
import type { LibEntry } from '../library/libraryKinds';

type Planned = { readonly lines: readonly string[]; readonly warnings: readonly string[] } | { readonly error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Ein fester Zeitpunkt? Nein: „jetzt" — was in der Vergangenheit beginnt, sagt der Planer selbst. */
const now = (): Date => new Date();
const today = (): string => { const d = now(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Ein Planer, als Prüfung: seine Zeilen, Warnungen — oder sein Fehler (auch einer, den er wirft). */
function planned(note: string, run: () => Planned, extra: { errors?: string[]; warnings?: string[] } = {}): RawCheck {
  try {
    const plan = run();
    if ('error' in plan) return { errors: [plan.error, ...(extra.errors ?? [])], warnings: extra.warnings, note };
    return { changes: plan.lines, errors: extra.errors, warnings: [...plan.warnings, ...(extra.warnings ?? [])], note };
  } catch (e) {
    return { errors: [thrown(e), ...(extra.errors ?? [])], note };
  }
}

/** Alle Zeichenketten unter diesen Schlüsseln, irgendwo im Dokument (die Kalender, Bereiche, die es nennt). */
function namedUnder(doc: unknown, keys: ReadonlySet<string>): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, key: string): void => {
    if (typeof v === 'string') { if (keys.has(key) && v.trim() !== '') out.add(v.trim()); return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, key); return; }
    if (isObject(v)) for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(doc, '');
  return [...out];
}

const NOTE_EMPTY = (): string => t('importCheck.againstEmpty');

/** Ein leerer Bestand einer Bibliothek (nichts gibt es schon). */
const NO_ENTRIES: ImportBase & QuoteBase = { get: () => undefined, byKey: () => undefined, all: () => [] } as unknown as ImportBase & QuoteBase;

/** Ein Werk zum Prüfen von Zitaten und Texten eines Werks (die App nimmt das gewählte). */
const SAMPLE_WORK = { id: 'sprawdzenie-dziela', key: 'dzielo', kind: 'work', kinds: ['work'], data: { title: '—' } } as unknown as LibEntry;

/* -- Seiten ------------------------------------------------------------------------------------------------------------- */

/** `page`: der Plan der Vorschau (wie `check_page`) und was der Import nicht nimmt (`lintDocument`). */
export function checkPage(doc: unknown): RawCheck {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  try {
    const pp = planPreview({ doc: read.value });
    if ('error' in pp) return { errors: [pp.error], note: t('importCheck.againstNewPage') };
    const lint = lintDocument(read.value).map((l) => `${l.path}: ${l.detail}`);
    return { changes: [...pp.lines, ...pp.notes], warnings: [...pp.warnings, ...lint], note: t('importCheck.againstNewPage') };
  } catch (e) {
    return { errors: [thrown(e)], note: t('importCheck.againstNewPage') };
  }
}

/** `form`: ein Modul „form" — als Seite mit diesem einen Modul geprüft (dort liest der Import Fragen, Potrzeby, Rollen). */
export function checkForm(doc: unknown): RawCheck {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  if (!isObject(read.value)) return { errors: [t('importCheck.notObject')] };
  const wish = readModuleWish(read.value);
  const page = isObject(read.value) && Array.isArray(read.value.modules) ? read.value : { format: PAGE_FORMAT, version: 1, title: '—', modules: [{ ...read.value, kind: 'form' }] };
  const asPage = checkPage(page);
  return { ...asPage, warnings: [...(wish.warnings ?? []), ...(asPage.warnings ?? [])], note: t('importCheck.formAsPage') };
}

/** `area`: der Plan eines Bereichs mit Rodzaj — für einen neuen Bereich, den ich leite, unter einer Probeadresse. */
export function checkArea(doc: unknown): RawCheck {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  const got = readAreaDocument(read.value);
  if ('error' in got) return { errors: [got.error] };
  const note = t('importCheck.againstNewArea');
  try {
    const A = 'sprawdzenie-obszaru';
    const controller = { id: 'sprawdzenie-administratora', version: 1, name: '—', address: null, email: null, phone: null, dpo: null, authority: null, homeAreaId: A, fromAreaId: A };
    const profile = { areaId: A, profile: null, admin: true, controller, public: false, publishPublic: true, openForms: [] };
    /* Die Seite über der Probeadresse leite ich (sonst entstünde keine Unterseite). */
    const parent = { path: 'sprawdzenie', roleId: 'r', claimedAt: '', aliasOf: null, host: null, title: null, accessAreaIds: [] };
    const plan = planArea(got.doc, {
      areaId: A, areaName: '—', profile, book: keyBook([]), areas: [], desk: [parent], modules: [], holds: () => false, pages: new Map()
    } as unknown as Parameters<typeof planArea>[1], { ...DEFAULT_AREA_IMPORT, base: 'sprawdzenie/obszar' });
    const pageProblems = plan.pages.flatMap((p) => (p.problem === null ? [] : [`${p.path}: ${p.problem}`]));
    return {
      changes: planLines(plan.steps), note,
      errors: [...(plan.blocked === null ? [] : [plan.blocked]), ...pageProblems],
      warnings: [...got.warnings, ...plan.warnings]
    };
  } catch (e) {
    return { errors: [thrown(e)], warnings: got.warnings, note };
  }
}

/** `community`: der Baum einer Wspólnota gelesen (Einheiten, Positionen, Personen) — was er nicht nimmt, sagen die Warnungen. */
export function checkCommunity(doc: unknown): RawCheck {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  try {
    const got = readCommunity(read.value);
    if ('error' in got) return { errors: [got.error] };
    return { changes: [t('importCheck.communityRead')], warnings: got.warnings, note: t('importCheck.communityNote') };
  } catch (e) {
    return { errors: [thrown(e)] };
  }
}

/* -- Bibliothek, Skryptorium ---------------------------------------------------------------------------------------------- */

export const checkLibrary = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  return planned(NOTE_EMPTY(), () => planLibraryImport(read.value, NO_ENTRIES));
};

export const checkScriptorium = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  return planned(NOTE_EMPTY(), () => planScriptoriumImport(read.value, NO_ENTRIES));
};

export const checkWorkWithText = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  return planned(NOTE_EMPTY(), () => {
    const plan = planWorkWithText(read.value, NO_ENTRIES);
    if ('error' in plan) return plan;
    const p = plan as unknown as { lines?: readonly string[]; warnings?: readonly string[]; library?: { lines: readonly string[]; warnings: readonly string[] } };
    return { lines: [...(p.library?.lines ?? []), ...(p.lines ?? [])], warnings: [...(p.library?.warnings ?? []), ...(p.warnings ?? [])] };
  });
};

export const checkSourceText = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  return planned(t('importCheck.sampleWork'), () => {
    /* Das Werk, das das Dokument nennt ("work": "@klucz") — sonst ein Beispielwerk. */
    const named = isObject(read.value) && typeof read.value.work === 'string' ? read.value.work.trim().replace(/^@/, '') : '';
    const work = named === '' ? SAMPLE_WORK : { ...SAMPLE_WORK, id: named, key: named } as LibEntry;
    const plan = planSourceImport(read.value, { work });
    if ('error' in plan) return plan;
    const p = plan as unknown as { lines?: readonly string[]; warnings?: readonly string[] };
    return { lines: p.lines ?? [], warnings: p.warnings ?? [] };
  });
};

export const checkQuotes = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  return planned(t('importCheck.sampleWork'), () => {
    const plan = planQuotes(read.value, SAMPLE_WORK, NO_ENTRIES);
    if ('error' in plan) return plan;
    const p = plan as unknown as { lines?: readonly string[]; warnings?: readonly string[]; items?: readonly unknown[] };
    return { lines: p.lines ?? [t('importCheck.quotesCount', { count: p.items?.length ?? 0 })], warnings: p.warnings ?? [] };
  });
};

export const checkLiturgy = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  try {
    const plan = planLiturgyImport(read.value, effectiveEntities([]), []);
    if ('error' in plan) return { errors: [plan.error], note: NOTE_EMPTY() };
    return { changes: plan.lines, errors: plan.problems.map(problemLine), warnings: plan.warnings, note: NOTE_EMPTY() };
  } catch (e) {
    return { errors: [thrown(e)] };
  }
};

/* -- Kalender ----------------------------------------------------------------------------------------------------------- */

export const checkCalendar = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  const calendar = { calendarId: 'sprawdzenie-kalendarza', title: '—', itemKind: 'appointment', booking: false, personal: false, visibilityAreaId: 'sprawdzenie-obszaru', durationMinutes: 60 };
  return planned(NOTE_EMPTY(), () => planCalendar(read.value, { calendar, items: [], schemes: [], spans: [] }));
};

export const checkScheme = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  const warnings: string[] = [];
  try {
    const scheme = readScheme(read.value, warnings);
    return scheme === null ? { errors: [t('importCheck.notScheme')], warnings } : { changes: [t('importCheck.schemeRead')], warnings };
  } catch (e) { return { errors: [thrown(e)], warnings }; }
};

export const checkPlan = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  const warnings: string[] = [];
  try {
    const schemes = namedUnder(read.value, new Set(['scheme', 'schemeId']));
    const plan = readPlan(read.value, schemes, warnings);
    return plan === null ? { errors: [t('importCheck.notPlan')], warnings } : { changes: [t('importCheck.planRead')], warnings, note: NOTE_EMPTY() };
  } catch (e) { return { errors: [thrown(e)], warnings }; }
};

export const checkTasks = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  const groups = namedUnder(read.value, new Set(['group', 'areaId'])).map((areaId) => ({ areaId, name: areaId, write: true, self: false }));
  const self = { areaId: 'ja', name: t('importCheck.onlyMe'), write: true, self: true };
  return planned(NOTE_EMPTY(), () => planTasksImport(read.value, { tasks: [], groups: [self, ...groups] as unknown as Parameters<typeof planTasksImport>[1]['groups'], now: now() }));
};

export const checkMasses = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  const ids = namedUnder(read.value, new Set(['calendar', 'calendarId']));
  const calendars = (ids.length === 0 ? ['kalendarz'] : ids).map((calendarId) => ({ calendarId, title: calendarId, areaName: calendarId, mayWrite: true }));
  const day = today();
  return planned(NOTE_EMPTY(), () => planMassesImport(read.value, {
    calendars, chosen: calendars[0]!.calendarId, loaded: calendars.map((c) => c.calendarId), from: day, to: day,
    series: new Map(), occurrences: [], people: new Map(), today: day
  }));
};

export const checkBookings = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  const areas = namedUnder(read.value, new Set(['area', 'areaId'])).map((areaId) => ({ areaId, name: areaId, mayWrite: true }));
  return planned(NOTE_EMPTY(), () => planBookingsImport(read.value, { resources: [], areas, calendars: [], now: now() }, { areaId: areas[0]?.areaId ?? 'sprawdzenie-obszaru' }));
};

/* -- Kanzlei, Formulare, Konto ------------------------------------------------------------------------------------------- */

export const checkRegistry = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  return planned(NOTE_EMPTY(), () => planRegistryImport(read.value, [], []));
};

/** Die Fragen eines Formulars aus der Liste selbst (die App nimmt die des gewählten Formulars). */
export const checkEntries = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  const keys = new Set<string>();
  const rows = isObject(read.value) && Array.isArray(read.value.entries) ? read.value.entries : [];
  for (const row of rows) if (isObject(row) && isObject(row.answers)) for (const k of Object.keys(row.answers)) keys.add(k);
  const fields = [...keys].map((k, i) => ({ fieldId: `f${i + 1}`, label: k, kind: 'line', options: [], help: null }));
  return planned(t('importCheck.entriesNote'), () => planEntries(read.value, { formId: 'formularz', formName: '—', fields, extensions: [], existing: [] } as unknown as Parameters<typeof planEntries>[1], now()));
};

export const checkContacts = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  return planned(NOTE_EMPTY(), () => planContactsJson(read.value, []));
};

export const checkRoles = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  /* Ein Konto mit einer Person (ich, „@ja"), die führt — die übrigen Rollen kennt der Dienst nicht. */
  const me = { id: 'ja', kind: 'person' as const, name: t('importCheck.onlyMe'), readable: true, leads: true, passesSign: true, link: false, areas: [], createdAt: '' };
  return planned(t('importCheck.rolesNote'), () => planRolesImport(read.value, { accountId: 'konto', accountLeads: true, selfId: 'ja', roles: [me], holdings: [] }));
};

export const checkChat = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  return planned(NOTE_EMPTY(), () => planChatImport(read.value, importContext({
    chatId: 'sprawdzenie-rozmowy', kind: 'group', now: now(), writes: true, moderates: true, me: [], topics: [], topicMayChange: () => true,
    items: [], look: { author: () => '', mine: () => true }, mayFile: () => true, marks: [], from: null, complete: true, scheduled: []
  })));
};

export const checkLamps = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  return planned(NOTE_EMPTY(), () => planLampsImport(read.value, { lamps: [], timers: [], buttons: FASTEST }));
};

export const checkPersons = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  return planned(t('importCheck.personsNote'), () => planPersons(read.value, [], now()));
};

export const checkAddresses = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  return planned(NOTE_EMPTY(), () => planAddresses(read.value, { pages: [], roles: [] }));
};

export const checkWorkspaceView = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  return planned('', () => planView(read.value, DEFAULT_ALERTS));
};

export const checkProgress = (doc: unknown): RawCheck => {
  const read = readDoc(doc);
  if ('error' in read) return { errors: [read.error] };
  /* Die Baza, die das Dokument nennt ("library": {id, name}) — der Dienst weiss nicht, in welche es kommt. */
  const named = isObject(read.value) && isObject(read.value.library) ? read.value.library.id : undefined;
  const libraryId = typeof named === 'string' && named !== '' ? named : 'sprawdzenie-bazy';
  return planned(NOTE_EMPTY(), () => planProgress(read.value, { libraryId, existing: new Map(), cardKeys: null }));
};

