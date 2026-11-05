/**
 * 0137 — EINE WSPÓLNOTA: ein Baum von Einheiten (Bereichen) mit Positionen (Rollen), Personen
 * (persönliche Links) und den fünf Schritten der geführten Einrichtung je Einheit. Rein, ohne Dienst —
 * `scripts/app-json-community-check.mjs` prüft es.
 *
 * <b>Nichts Neues neben dem Vorhandenen.</b> Eine Einheit IST ein Bereich (`parent_area_id`), eine
 * Position IST eine Rolle des Bereichs (wie `roles` im Dokument eines Bereichs), ein persönlicher
 * Link IST ein Link, der die Rollen der Person hält (0091), die Werkzeuge einer Einheit SIND das
 * Dokument ihres Bereichs (`recreatio/area`: Rozmowy, Termine, Seiten, Formulare). Hier steht nur,
 * was die Teile zusammenhält: wer wo was darf, was geerbt wird, was ein Bauplan vorgibt.
 *
 * <b>Erben.</b> Eine Einstellung gilt, wie sie in der Einheit steht; sonst wie im Bauplan der
 * Einheit; sonst wie in der Einheit darüber (deren eigener Wert, Bauplan, Vater …); sonst der
 * Vorschlag. Was nicht vererbt wird (Gliederung), gilt nur, wo es steht.
 */

import type { ProfileKind } from '../areas/profile';

export const COMMUNITY_FORMAT = 'recreatio/community';

/* -- Positionen und ihre Rechte ---------------------------------------------------- */

export type Rights = 'lead' | 'accompany' | 'cooperate' | 'member' | 'participant';
export type Level = 'read' | 'write' | 'admin';

export const RIGHTS: readonly { readonly value: Rights; readonly label: string; readonly says: string; readonly level: Level }[] = [
  { value: 'lead', label: 'Prowadzenie', says: 'zmienia wszystko w jednostce i we wszystkich jednostkach pod nią; wpuszcza innych', level: 'admin' },
  { value: 'accompany', label: 'Towarzyszenie', says: 'widzi wszystko w jednostce i pod nią, niczego nie zmienia (np. ksiądz moderator)', level: 'read' },
  { value: 'cooperate', label: 'Współpraca', says: 'pisze w jednostce (terminy, materiały), np. animator z własną grupą', level: 'write' },
  { value: 'member', label: 'Członkostwo', says: 'należy do jednostki, pisze w jej rozmowach i kalendarzu', level: 'write' },
  { value: 'participant', label: 'Uczestnictwo', says: 'czyta, co jednostka udostępnia, i rozmawia', level: 'read' }
];

export const rightsLabel = (r: Rights): string => RIGHTS.find((x) => x.value === r)?.label ?? r;
export const levelOf = (r: Rights): Level => RIGHTS.find((x) => x.value === r)?.level ?? 'read';
export const isRights = (v: unknown): v is Rights => RIGHTS.some((r) => r.value === v);

export type Assign = 'appointed' | 'elected' | 'result';
export const ASSIGN_WORD: Record<Assign, string> = { appointed: 'mianowana', elected: 'wybierana', result: 'wpisuje się wynik' };

export interface Position {
  readonly key: string;
  readonly name: string;
  readonly rights: Rights;
  /** Obsadza ją para (każde z dwojga dostaje własny link). */
  readonly pair?: boolean;
  readonly assign?: Assign;
  /** Kadencja słowami, np. „3 lata, +2 możliwe”. */
  readonly term?: string;
  /** Ilu potrzeba w jednostce (obsada). */
  readonly need?: number;
  /** Albo: jedna na tylu z innej pozycji — np. animator na 4 uczestników. */
  readonly per?: { readonly count: number; readonly of: string };
  readonly note?: string;
}

/* -- Pola osób (krok 4) ------------------------------------------------------------- */

export type FieldKind = 'line' | 'text' | 'choice' | 'date' | 'checkbox' | 'number';
export const FIELD_KINDS: readonly FieldKind[] = ['line', 'text', 'choice', 'date', 'checkbox', 'number'];

export interface FieldDef {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly options?: readonly string[];
  /** Widzą tylko prowadzący (zdrowie, dieta, kontakt do rodziców). */
  readonly leadersOnly?: boolean;
}

/** Propozycje pól — do wyboru w kroku 4. */
export const FIELD_PRESETS: readonly FieldDef[] = [
  { key: 'glos', label: 'Głos', kind: 'choice', options: ['sopran', 'alt', 'tenor', 'bas'] },
  { key: 'stopien', label: 'Stopień formacji', kind: 'choice', options: ['ODB', 'OND', 'ONŻ I°', 'ONŻ II°', 'ONŻ III°'] },
  { key: 'dieta', label: 'Dieta', kind: 'text', leadersOnly: true },
  { key: 'zdrowie', label: 'Zdrowie (alergie, leki)', kind: 'text', leadersOnly: true },
  { key: 'rodzic', label: 'Rodzic / opiekun — telefon', kind: 'line', leadersOnly: true },
  { key: 'urodzony', label: 'Data urodzenia', kind: 'date', leadersOnly: true },
  { key: 'telefon', label: 'Telefon', kind: 'line', leadersOnly: true },
  { key: 'zgoda-wizerunek', label: 'Zgoda na zdjęcia (wizerunek)', kind: 'checkbox' }
];

/* -- Die fünf Schritte ---------------------------------------------------------------- */

export type Step = 1 | 2 | 3 | 4 | 5;
export const STEP_TITLES: Record<Step, string> = {
  1: 'Jak żyje wasza wspólnota?',
  2: 'Jak jest podzielona?',
  3: 'Kto co robi?',
  4: 'Kto dołącza i jak?',
  5: 'Z czego korzystacie i kto co widzi?'
};

export interface Choice { readonly value: string; readonly label: string; readonly example?: string }

export interface SettingDef {
  readonly path: string;
  readonly step: Step;
  readonly label: string;
  readonly kind: 'choice' | 'bool' | 'text' | 'number' | 'date' | 'day' | 'time';
  readonly choices?: readonly Choice[];
  readonly fallback: string | number | boolean | null;
  /** Dziedziczy jednostka pod spodem? */
  readonly inherit: boolean;
  /** Pokazywane tylko, gdy … */
  readonly when?: (get: (path: string) => unknown) => boolean;
  /** Ustawienie dla zaawansowanych — za „Więcej”. */
  readonly fine?: boolean;
  readonly hint?: string;
}

const WEEKDAYS: readonly Choice[] = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'].map((d) => ({ value: d, label: d }));

export const SETTINGS: readonly SettingDef[] = [
  /* Krok 1 */
  { path: 'life.duration', step: 1, label: 'Jak długo', kind: 'choice', inherit: true, fallback: 'permanent', choices: [
    { value: 'permanent', label: 'Na stałe', example: 'chór, krąg, klasa, oaza' },
    { value: 'limited', label: 'Na czas — z początkiem i końcem', example: 'turnus rekolekcji, wyjazd, projekt koncertowy' }] },
  { path: 'life.from', step: 1, label: 'Od', kind: 'date', inherit: false, fallback: null, when: (g) => g('life.duration') === 'limited' },
  { path: 'life.until', step: 1, label: 'Do', kind: 'date', inherit: false, fallback: null, when: (g) => g('life.duration') === 'limited' },
  { path: 'life.place', step: 1, label: 'Gdzie', kind: 'choice', inherit: true, fallback: 'onsite', choices: [
    { value: 'onsite', label: 'Na miejscu', example: 'spotkania w salce, próby, lekcje' },
    { value: 'online', label: 'Online', example: 'grupa, która głównie rozmawia i uczy się w sieci — bez miejsc i pokoi' },
    { value: 'both', label: 'Jedno i drugie' }] },
  { path: 'life.rhythm', step: 1, label: 'Jak często się spotykacie', kind: 'choice', inherit: true, fallback: 'weekly', choices: [
    { value: 'weekly', label: 'Co tydzień', example: 'próba chóru, spotkanie oazy' },
    { value: 'monthly', label: 'Co miesiąc', example: 'spotkanie kręgu' },
    { value: 'once', label: 'Jednorazowo', example: 'turnus, wyjazd' },
    { value: 'asNeeded', label: 'W miarę potrzeby', example: 'grupa ucząca się w swoim tempie' }] },
  { path: 'life.weekday', step: 1, label: 'Dzień spotkań', kind: 'day', inherit: true, fallback: null, choices: WEEKDAYS,
    when: (g) => g('life.rhythm') === 'weekly' || g('life.rhythm') === 'monthly' },
  { path: 'life.time', step: 1, label: 'Godzina', kind: 'time', inherit: true, fallback: null,
    when: (g) => g('life.rhythm') === 'weekly' || g('life.rhythm') === 'monthly' },
  { path: 'life.minutes', step: 1, label: 'Ile trwa (minuty)', kind: 'number', inherit: true, fallback: 90, fine: true,
    when: (g) => g('life.rhythm') === 'weekly' || g('life.rhythm') === 'monthly' },
  { path: 'life.location', step: 1, label: 'Miejsce spotkań', kind: 'text', inherit: true, fallback: null,
    when: (g) => g('life.place') !== 'online' },
  { path: 'life.yearFrom', step: 1, label: 'Rok pracy od (MM-DD)', kind: 'text', inherit: true, fallback: '09-01', fine: true, hint: 'np. 09-01 — stare lata zostają jako archiwum' },
  { path: 'life.yearUntil', step: 1, label: 'Rok pracy do (MM-DD)', kind: 'text', inherit: true, fallback: '06-30', fine: true },
  { path: 'life.open', step: 1, label: 'Kto może dołączyć', kind: 'choice', inherit: true, fallback: 'invite', choices: [
    { value: 'anyone', label: 'Każdy może dołączyć', example: 'chór parafialny, oaza, rekolekcje z zapisami' },
    { value: 'invite', label: 'Tylko z zaproszenia', example: 'klasa, grupa ucząca się, krąg' }] },

  /* Krok 2 — nie dziedziczy (dotyczy tej jednej jednostki) */
  { path: 'structure.subgroups', step: 2, label: 'Podgrupy', kind: 'choice', inherit: false, fallback: 'manual', choices: [
    { value: 'manual', label: 'Ręcznie (dodajesz je sam)', example: 'grupy formacyjne, kręgi, klasy' },
    { value: 'byField', label: 'Same, według cechy osoby', example: 'wszystkie tenory, wszyscy z ONŻ I°' }] },
  { path: 'structure.byField', step: 2, label: 'Według pola', kind: 'text', inherit: false, fallback: null,
    when: (g) => g('structure.subgroups') === 'byField', hint: 'klucz pola z kroku 4, np. „glos”' },
  { path: 'structure.council', step: 2, label: 'Grono prowadzących jednostek niżej', kind: 'bool', inherit: false, fallback: false,
    hint: 'np. krąg rejonowy: para rejonowa, moderator i wszystkie pary animatorskie — skład liczy się sam z obsady' },
  { path: 'structure.founders', step: 2, label: 'Kto zakłada nowe jednostki pod tą', kind: 'choice', inherit: true, fallback: 'admin', fine: true, choices: [
    { value: 'admin', label: 'Tylko administrator wspólnoty' },
    { value: 'lead', label: 'Także prowadzący tej jednostki' }] },

  /* Krok 4 */
  { path: 'intake.mode', step: 4, label: 'Jak się dołącza', kind: 'choice', inherit: true, fallback: 'leaders', choices: [
    { value: 'leaders', label: 'Prowadzący wpisuje osoby', example: 'klasa, krąg, grupa ucząca się — każdy dostaje osobisty link' },
    { value: 'link', label: 'Zaproszenie linkiem', example: 'jeden link dla wszystkich nowych członków chóru' },
    { value: 'signup', label: 'Publiczne zapisy przez formularz', example: 'turnus rekolekcji, oaza z naborem' }] },
  { path: 'intake.limit', step: 4, label: 'Liczba miejsc', kind: 'number', inherit: false, fallback: null, when: (g) => g('intake.mode') === 'signup' },
  { path: 'intake.waitlist', step: 4, label: 'Lista rezerwowa po wyczerpaniu miejsc', kind: 'bool', inherit: true, fallback: false, when: (g) => g('intake.mode') === 'signup' },
  { path: 'intake.requires', step: 4, label: 'Warunki (np. stopień w danym roku)', kind: 'text', inherit: true, fallback: null, when: (g) => g('intake.mode') === 'signup' },
  { path: 'intake.confirm', step: 4, label: 'Prowadzący potwierdza przyjęcie', kind: 'bool', inherit: true, fallback: true, when: (g) => g('intake.mode') === 'signup',
    hint: 'osobisty link dopiero po przyjęciu' },
  { path: 'intake.minors', step: 4, label: 'Są niepełnoletni (zgody rodziców)', kind: 'bool', inherit: true, fallback: false, fine: true },
  { path: 'intake.health', step: 4, label: 'Zbieramy dane o zdrowiu (tylko prowadzący)', kind: 'bool', inherit: true, fallback: false, fine: true },

  /* Krok 5 — narzędzia */
  { path: 'tools.chat', step: 5, label: 'Rozmowa wszystkich', kind: 'bool', inherit: true, fallback: true },
  { path: 'tools.announcements', step: 5, label: 'Ogłoszenia (piszą prowadzący)', kind: 'bool', inherit: true, fallback: false },
  { path: 'tools.askLeaders', step: 5, label: 'Każdy może napisać prywatnie do prowadzących', kind: 'bool', inherit: true, fallback: true },
  { path: 'tools.calendar', step: 5, label: 'Kalendarz (terminy wyżej widać niżej)', kind: 'bool', inherit: true, fallback: true },
  { path: 'tools.forms', step: 5, label: 'Formularze i zaproszenia', kind: 'bool', inherit: true, fallback: true },
  { path: 'tools.polls', step: 5, label: 'Ankiety do jednostek niżej', kind: 'bool', inherit: true, fallback: false },
  { path: 'tools.attendance', step: 5, label: 'Obecność', kind: 'bool', inherit: true, fallback: false },
  { path: 'tools.lessons', step: 5, label: 'Materiały i lekcje', kind: 'bool', inherit: true, fallback: false },
  { path: 'tools.cogita', step: 5, label: 'Nauka z Cogitą', kind: 'bool', inherit: true, fallback: false },
  { path: 'tools.notes', step: 5, label: 'Prywatne notatki prowadzących', kind: 'bool', inherit: true, fallback: false },
  { path: 'tools.tables', step: 5, label: 'Własne kategorie i tabele (np. oceny)', kind: 'bool', inherit: true, fallback: false },
  { path: 'tools.staffing', step: 5, label: 'Planowanie obsady (gdzie kogoś brakuje)', kind: 'bool', inherit: true, fallback: false },
  { path: 'talk.direct', step: 5, label: 'Osoby piszą też między sobą, jedna do drugiej', kind: 'bool', inherit: true, fallback: false, fine: true },
  /* Krok 5 — widoczność */
  { path: 'visibility.default', step: 5, label: 'Kto domyślnie widzi nowe treści', kind: 'choice', inherit: true, fallback: 'unit', choices: [
    { value: 'me', label: 'Tylko ja' },
    { value: 'persons', label: 'Wybrane osoby' },
    { value: 'position', label: 'Jedna pozycja (np. wszyscy animatorzy)' },
    { value: 'unit', label: 'Ta jednostka' },
    { value: 'subtree', label: 'Ta jednostka ze wszystkimi pod nią' },
    { value: 'public', label: 'Publicznie' }] },
  { path: 'visibility.subunitsSee', step: 5, label: 'Jednostki niżej widzą tę jednostkę (jej terminy, materiały)', kind: 'bool', inherit: false, fallback: false,
    hint: 'np. terminy diecezji widzą wszystkie rejony i kręgi' },
  /* Krok 5 — strona publiczna */
  { path: 'public.page', step: 5, label: 'Strona publiczna', kind: 'bool', inherit: false, fallback: false },
  { path: 'public.description', step: 5, label: 'Opis', kind: 'text', inherit: false, fallback: null, when: (g) => g('public.page') === true },
  { path: 'public.meetings', step: 5, label: 'Spotkania (godziny)', kind: 'text', inherit: false, fallback: null, when: (g) => g('public.page') === true },
  { path: 'public.contact', step: 5, label: 'Kontakt (e-mail albo telefon)', kind: 'text', inherit: false, fallback: null, when: (g) => g('public.page') === true },
  { path: 'public.events', step: 5, label: 'Publiczne terminy na stronie', kind: 'bool', inherit: false, fallback: true, when: (g) => g('public.page') === true },
  { path: 'public.reports', step: 5, label: 'Strona „po” (relacja po wydarzeniu)', kind: 'bool', inherit: false, fallback: false, when: (g) => g('public.page') === true && g('life.duration') === 'limited' }
];

export const settingDef = (path: string): SettingDef | undefined => SETTINGS.find((s) => s.path === path);

/** Ustawienia jednostki, jak w JSON: { "life": { "duration": "limited" }, "tools": { … } }. */
export type Settings = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export function getSetting(settings: Settings | undefined, path: string): unknown {
  if (settings === undefined) return undefined;
  const [group, key] = path.split('.');
  const g = settings[group];
  return g === undefined || !Object.prototype.hasOwnProperty.call(g, key) ? undefined : g[key];
}

/** `undefined` usuwa (wraca do dziedziczenia). */
export function setSetting(settings: Settings | undefined, path: string, value: unknown): Settings {
  const [group, key] = path.split('.');
  const was = settings ?? {};
  const g = { ...(was[group] ?? {}) };
  if (value === undefined) delete g[key]; else g[key] = value;
  const out: Record<string, Readonly<Record<string, unknown>>> = { ...was };
  if (Object.keys(g).length === 0) delete out[group]; else out[group] = g;
  return out;
}

/* -- Jednostki, plany budowy, osoby -------------------------------------------------- */

export interface Council {
  readonly key: string;
  readonly name: string;
  /** Pozycje tej jednostki w gronie (np. para rejonowa, moderator). */
  readonly own: readonly string[];
  /** Pozycje jednostek bezpośrednio pod nią (np. para animatorska każdego kręgu). */
  readonly below: readonly string[];
}

export interface Unit {
  readonly key: string;
  readonly name: string;
  readonly kind?: ProfileKind;
  /** Plan budowy, z którego jednostka bierze pozycje, ustawienia i pola. */
  readonly from?: string;
  /** Pozycje w tej jednostce (bez planu — tylko te; z planem — dodatkowo). */
  readonly positions?: readonly string[];
  readonly settings?: Settings;
  readonly council?: Council;
  readonly units?: readonly Unit[];
  /** Adres stron jednostki (np. "dk/rejon-13"); pominięty — adres jednostki wyżej + klucz. */
  readonly address?: string;
  /** Istniejący obszar, który staje się tą jednostką (przeniesiony tutaj) — tylko świadomie, np. przy łączeniu. */
  readonly area?: string;
  /** Rozwiązana: obszar i treści zostają, wspólnota przestaje nim zarządzać. */
  readonly remove?: boolean;
  /** Dodatkowe części dokumentu obszaru (terminy, strony, podformularze) — jak w „recreatio/area”. */
  readonly extra?: Readonly<Record<string, unknown>>;
}

export interface Blueprint {
  readonly key: string;
  readonly name: string;
  readonly kind?: ProfileKind;
  readonly positions?: readonly string[];
  readonly settings?: Settings;
  readonly council?: Council;
  readonly extra?: Readonly<Record<string, unknown>>;
}

export interface PersonPlace { readonly unit: string; readonly position: string }

export interface Person {
  readonly key: string;
  readonly name: string;
  readonly places: readonly PersonPlace[];
  readonly fields?: Readonly<Record<string, string>>;
  /** Druga osoba pary (np. małżonek) — każde ma własny link, oboje tę samą pozycję. */
  readonly pair?: string;
  /** Usunięta: jej link przestaje działać. */
  readonly remove?: boolean;
}

export interface CommunityDoc {
  readonly name: string;
  readonly positions: readonly Position[];
  readonly fields: readonly FieldDef[];
  readonly blueprints: readonly Blueprint[];
  readonly unit: Unit;
  readonly persons: readonly Person[];
}

/* -- Der Baum ------------------------------------------------------------------------- */

export interface FlatUnit {
  readonly unit: Unit;
  readonly parent: string | null;
  readonly depth: number;
  /** Klucze od korzenia do tej jednostki. */
  readonly path: readonly string[];
}

/** Jednostki w kolejności drzewa (rodzic przed dziećmi); rozwiązane — też, z `unit.remove`. */
export function flatten(root: Unit): FlatUnit[] {
  const out: FlatUnit[] = [];
  const walk = (unit: Unit, parent: string | null, path: readonly string[]) => {
    const here = [...path, unit.key];
    out.push({ unit, parent, depth: path.length, path: here });
    for (const child of unit.units ?? []) walk(child, unit.key, here);
  };
  walk(root, null, []);
  return out;
}

export const unitsOf = (doc: CommunityDoc): FlatUnit[] => flatten(doc.unit).filter((u) => u.unit.remove !== true);
export const findUnit = (doc: CommunityDoc, key: string): FlatUnit | undefined => flatten(doc.unit).find((u) => u.unit.key === key);

export const blueprintOf = (doc: CommunityDoc, unit: Unit): Blueprint | undefined =>
  unit.from === undefined ? undefined : doc.blueprints.find((b) => b.key === unit.from);

/** Pozycje jednostki: z planu budowy i własne, bez powtórzeń, tylko znane. */
export function positionsOf(doc: CommunityDoc, unit: Unit): Position[] {
  const keys = [...(blueprintOf(doc, unit)?.positions ?? []), ...(unit.positions ?? [])];
  const out: Position[] = [];
  for (const key of keys) {
    const p = doc.positions.find((x) => x.key === key);
    if (p !== undefined && !out.some((o) => o.key === key)) out.push(p);
  }
  return out;
}

export const kindOf = (doc: CommunityDoc, unit: Unit): ProfileKind => unit.kind ?? blueprintOf(doc, unit)?.kind ?? 'group';
export const councilOf = (doc: CommunityDoc, unit: Unit): Council | undefined => unit.council ?? blueprintOf(doc, unit)?.council;

/* -- Erben ----------------------------------------------------------------------------- */

export type Source =
  | { readonly kind: 'own' }
  | { readonly kind: 'blueprint'; readonly key: string; readonly name: string }
  | { readonly kind: 'unit'; readonly key: string; readonly name: string }
  | { readonly kind: 'default' };

export interface Resolved { readonly value: unknown; readonly source: Source }

/** Wartość ustawienia w jednostce i skąd pochodzi. */
export function resolveSetting(doc: CommunityDoc, unitKey: string, path: string): Resolved {
  const def = settingDef(path);
  const chain = flatten(doc.unit);
  const here = chain.find((u) => u.unit.key === unitKey);
  if (here === undefined) return { value: def?.fallback ?? null, source: { kind: 'default' } };
  const steps = def?.inherit === false ? [here.unit.key] : [...here.path].reverse();
  for (const [i, key] of steps.entries()) {
    const unit = chain.find((u) => u.unit.key === key)!.unit;
    const own = getSetting(unit.settings, path);
    if (own !== undefined) return { value: own, source: i === 0 ? { kind: 'own' } : { kind: 'unit', key: unit.key, name: unit.name } };
    const bp = blueprintOf(doc, unit);
    const fromBp = getSetting(bp?.settings, path);
    if (bp !== undefined && fromBp !== undefined) return { value: fromBp, source: { kind: 'blueprint', key: bp.key, name: bp.name } };
  }
  return { value: def?.fallback ?? null, source: { kind: 'default' } };
}

export const valueOf = (doc: CommunityDoc, unitKey: string, path: string): unknown => resolveSetting(doc, unitKey, path).value;

export function sourceWords(source: Source): string {
  switch (source.kind) {
    case 'own': return 'ustawione tutaj';
    case 'blueprint': return `z planu „${source.name}”`;
    case 'unit': return `odziedziczone z „${source.name}”`;
    default: return 'propozycja';
  }
}

/* -- Krok 1 podpowiada kroki 2–5 ------------------------------------------------------- */

/** Ustawienia, które wynikają z odpowiedzi kroku 1 — wpisywane tylko tam, gdzie jeszcze nic nie ma. */
export function suggestFrom(life: Readonly<Record<string, unknown>>): Settings {
  const online = life.place === 'online';
  const limited = life.duration === 'limited';
  const open = life.open === 'anyone';
  return {
    intake: { mode: open ? (limited ? 'signup' : 'link') : 'leaders', ...(open && limited ? { confirm: true } : {}) },
    tools: {
      chat: true,
      announcements: limited || open,
      askLeaders: true,
      calendar: !online || life.rhythm === 'weekly' || life.rhythm === 'monthly',
      attendance: !online && (life.rhythm === 'weekly' || life.rhythm === 'monthly'),
      staffing: limited,
      cogita: online && life.rhythm === 'asNeeded',
      lessons: online && life.rhythm === 'asNeeded'
    },
    public: { page: open },
    visibility: { default: 'unit' }
  };
}

/** Dopisuje propozycje tylko tam, gdzie jednostka nie ma własnej wartości. */
export function withSuggestions(settings: Settings | undefined, suggested: Settings): Settings {
  let out: Settings = settings ?? {};
  for (const [group, values] of Object.entries(suggested)) {
    for (const [key, value] of Object.entries(values)) {
      if (getSetting(out, `${group}.${key}`) === undefined) out = setSetting(out, `${group}.${key}`, value);
    }
  }
  return out;
}

/* -- Obsada ------------------------------------------------------------------------------- */

export interface Staffing {
  readonly unit: string;
  readonly unitName: string;
  readonly position: string;
  readonly positionName: string;
  readonly have: number;
  readonly want: number;
}

/** Osoby (aktywne) na pozycji w jednostce. */
export const holdersOf = (doc: CommunityDoc, unitKey: string, positionKey: string): Person[] =>
  doc.persons.filter((p) => p.remove !== true && p.places.some((pl) => pl.unit === unitKey && pl.position === positionKey));

/** Gdzie kogoś brakuje — pozycje z "need" albo "per" (np. animator na 4 uczestników, przy limicie miejsc). */
export function staffing(doc: CommunityDoc): Staffing[] {
  const out: Staffing[] = [];
  for (const { unit } of unitsOf(doc)) {
    for (const p of positionsOf(doc, unit)) {
      if (p.need === undefined && p.per === undefined) continue;
      const have = holdersOf(doc, unit.key, p.key).length;
      let want = p.need ?? 0;
      if (p.per !== undefined && p.per.count > 0) {
        const base = Math.max(holdersOf(doc, unit.key, p.per.of).length, Number(valueOf(doc, unit.key, 'intake.limit') ?? 0) || 0);
        want = Math.max(want, Math.ceil(base / p.per.count));
      }
      if (want > 0) out.push({ unit: unit.key, unitName: unit.name, position: p.key, positionName: p.name, have, want });
    }
  }
  return out;
}

/* -- Podgrupy według cechy ------------------------------------------------------------------- */

/**
 * Jednostka z "structure.subgroups": "byField" dostaje swoje podgrupy SAMA: jedną na każdą wartość
 * pola (bez wartości — nic), a osoby tej jednostki z tą wartością — na pozycję członka podgrupy.
 * Klucz podgrupy: "<jednostka>-<wartość>". Liczone przy imporcie; w dokumencie ich nie ma.
 */
export function withAutoSubgroups(doc: CommunityDoc): CommunityDoc {
  const memberish = (unit: Unit): Position | undefined => positionsOf(doc, unit).find((p) => p.rights === 'member' || p.rights === 'participant');
  let persons = [...doc.persons];
  const grow = (unit: Unit): Unit => {
    const children = (unit.units ?? []).map(grow);
    if (unit.remove === true || valueOf(doc, unit.key, 'structure.subgroups') !== 'byField') return { ...unit, units: children };
    const field = String(valueOf(doc, unit.key, 'structure.byField') ?? '');
    const def = doc.fields.find((f) => f.key === field);
    const member = memberish(unit);
    if (def === undefined || member === undefined) return { ...unit, units: children };
    const people = persons.filter((p) => p.remove !== true && p.places.some((pl) => pl.unit === unit.key));
    const values = [...new Set([...(def.options ?? []), ...people.map((p) => p.fields?.[field] ?? '').filter((v) => v !== '')])];
    const made: Unit[] = [];
    for (const value of values) {
      const key = `${unit.key}-${slug(value)}`.slice(0, 40);
      if (children.some((c) => c.key === key)) continue;
      made.push({ key, name: `${unit.name} — ${value}`, kind: 'group', positions: [member.key] });
      persons = persons.map((p) => (p.remove !== true && p.fields?.[field] === value && p.places.some((pl) => pl.unit === unit.key)
        && !p.places.some((pl) => pl.unit === key)
        ? { ...p, places: [...p.places, { unit: key, position: member.key }] } : p));
    }
    return { ...unit, units: [...children, ...made] };
  };
  const unit = grow(doc.unit);
  return { ...doc, unit, persons };
}

/** „Rejon XIII” → „rejon-xiii” (do 40 znaków). */
export function slug(name: string, max = 40): string {
  const s = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '');
  return s === '' ? 'x' : s;
}

export const KEY = /^[a-z0-9][a-z0-9_-]{0,39}$/;
