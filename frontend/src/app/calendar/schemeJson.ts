/**
 * 2026-10-26 — SCHEMAT I PLAN JAKO JSON (0132): eksport, import i opis formatu
 * obok importu (jak przy stronach, modułach i bibliotece — patrz
 * `app-json-check.mjs`). Rein: kein Dienst, kein Schlüssel.
 *
 * Ein Schema (`recreatio/scheme`) und ein Plan (`recreatio/plan`) gehen so
 * hinaus, wie sie gespeichert sind; beim Import wird geprüft, was ein Browser
 * später lesen muss — fehlende Schlüssel entstehen aus der Beschriftung, Unbekanntes
 * fällt mit einer Warnung weg. Ein Plan aus einem anderen Kalender verliert
 * seinen Verweis auf ein Schema (es gibt dort ein anderes) — mit einer Warnung.
 *
 * Die Beschreibung ist ein Teil des Baums der JSON-Formate (`core/jsonTree.ts`):
 * Schema → Feld, Liste → Regel → Ablauf, Bedingung, Datum; Plan → Ablauf des
 * Plans → dieselben Knoten. Jeder steht einmal; die Vorlagen sind die Beispiele.
 */

import { keyLines, pretty, type JsonNode } from '../core/jsonTree';
import { ITEM_KINDS, ITEM_LABEL, type ItemKind } from './calendar';
import {
  type DateRule, type FlowDoc, type FlowEdge, type FlowNode, type FlowNodeType, NODE_INFO, PLAN_NODES, PLAN_TESTS, RULE_NODES, RULE_TESTS,
  SEASONS, type Test
} from './flow/flowModel';
import {
  KEY_PATTERN, keyOf, LITURGICAL_COLOURS, type PlanDef, type RecordList, SCHEME_FIELD_LABEL, SCHEME_FIELD_TYPES, type SchemeChoice,
  type SchemeDef, type SchemeField, type SchemeFieldType
} from './scheme';
import { PLAN_TEMPLATES } from './templates/planTemplates';
import { SCHEME_TEMPLATES } from './templates/schemeTemplates';

export const SCHEME_FORMAT = 'recreatio/scheme';
export const PLAN_FORMAT = 'recreatio/plan';

export const exportScheme = (def: SchemeDef) => ({ format: SCHEME_FORMAT, version: 1, ...def });
export const exportPlan = (def: PlanDef) => ({ format: PLAN_FORMAT, version: 1, ...def });

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max = 400): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : undefined);

function readChoices(value: unknown, where: string, warnings: string[]): SchemeChoice[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) { warnings.push(`${where}: „options” musi być listą — pominięte.`); return undefined; }
  const out: SchemeChoice[] = [];
  for (const one of value) {
    if (typeof one === 'string' && one.trim() !== '') out.push({ value: one.trim(), label: one.trim() });
    else if (isObject(one) && text(one.label) !== undefined) out.push({ value: text(one.value) ?? text(one.label)!, label: text(one.label)! });
    else warnings.push(`${where}: opcja bez nazwy — pominięta.`);
  }
  return out;
}

const readKinds = (value: unknown): ItemKind[] | undefined =>
  Array.isArray(value) ? value.filter((k): k is ItemKind => typeof k === 'string' && (ITEM_KINDS as readonly string[]).includes(k)) : undefined;

function readFields(value: unknown, where: string, warnings: string[]): SchemeField[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) { warnings.push(`${where}: „fields” musi być listą — pominięte.`); return []; }
  const out: SchemeField[] = [];
  for (const [i, one] of value.entries()) {
    if (!isObject(one) || text(one.label) === undefined) { warnings.push(`${where}: pole ${i + 1} bez nazwy („label”) — pominięte.`); continue; }
    const label = text(one.label, 120)!;
    const type = (SCHEME_FIELD_TYPES as readonly string[]).includes(String(one.type)) ? one.type as SchemeFieldType : 'text';
    if (one.type !== undefined && type !== one.type) warnings.push(`${where}: „${label}” — nieznany typ „${String(one.type)}”, będzie tekstem.`);
    let key = typeof one.key === 'string' && KEY_PATTERN.test(one.key) ? one.key : keyOf(label, out.map((f) => f.key));
    if (out.some((f) => f.key === key)) key = keyOf(label, out.map((f) => f.key));
    out.push({
      key, label, type,
      ...(one.level === 'day' ? { level: 'day' as const } : {}),
      ...(one.public === true ? { public: true } : {}),
      ...(one.required === true ? { required: true } : {}),
      ...(readChoices(one.options, `${where} „${label}”`, warnings) !== undefined ? { options: readChoices(one.options, '', []) } : {}),
      ...(text(one.unit, 20) !== undefined ? { unit: text(one.unit, 20) } : {}),
      ...(readKinds(one.onlyKinds) !== undefined ? { onlyKinds: readKinds(one.onlyKinds) } : {}),
      ...(text(one.says) !== undefined ? { says: text(one.says) } : {})
    });
  }
  return out;
}

/** Ein Ablauf — Knoten, die es gibt, und Kanten zwischen ihnen. */
export function readFlow(value: unknown, kind: 'plan' | 'rule', where: string, warnings: string[]): FlowDoc | null {
  if (value === undefined || value === null) return null;
  if (!isObject(value) || !Array.isArray(value.nodes)) { warnings.push(`${where}: przebieg bez „nodes” — pominięty.`); return null; }
  const allowed: readonly string[] = kind === 'plan' ? PLAN_NODES : RULE_NODES;
  const nodes: FlowNode[] = [];
  for (const one of value.nodes) {
    if (!isObject(one) || typeof one.id !== 'string' || !allowed.includes(String(one.type))) {
      warnings.push(`${where}: węzeł ${isObject(one) ? String(one.type) : '?'} nie pasuje do ${kind === 'plan' ? 'planu' : 'reguły'} — pominięty.`);
      continue;
    }
    nodes.push({
      id: one.id, type: one.type as FlowNodeType,
      x: typeof one.x === 'number' ? one.x : 0, y: typeof one.y === 'number' ? one.y : 0,
      data: isObject(one.data) ? one.data : {}
    });
  }
  const ids = new Set(nodes.map((n) => n.id));
  const edges: FlowEdge[] = [];
  for (const one of Array.isArray(value.edges) ? value.edges : []) {
    if (!isObject(one) || typeof one.from !== 'string' || typeof one.to !== 'string' || !ids.has(one.from) || !ids.has(one.to)) continue;
    const out = one.out === 'yes' || one.out === 'no' ? one.out : 'out';
    edges.push({ id: typeof one.id === 'string' ? one.id : `${one.from}-${out}-${one.to}`, from: one.from, to: one.to, ...(out === 'out' ? {} : { out }) });
  }
  return { v: 1, nodes, edges };
}

function readLists(value: unknown, warnings: string[]): RecordList[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) { warnings.push('„lists” musi być listą — pominięte.'); return []; }
  const out: RecordList[] = [];
  for (const [i, one] of value.entries()) {
    if (!isObject(one) || text(one.label) === undefined) { warnings.push(`Lista ${i + 1} bez nazwy („label”) — pominięta.`); continue; }
    const label = text(one.label, 120)!;
    const key = typeof one.key === 'string' && KEY_PATTERN.test(one.key) && !out.some((l) => l.key === one.key) ? one.key : keyOf(label, out.map((l) => l.key));
    const rule = readFlow(one.rule, 'rule', `Lista „${label}”`, warnings);
    out.push({
      key, label,
      ...(text(one.itemLabel, 60) !== undefined ? { itemLabel: text(one.itemLabel, 60) } : {}),
      ...(readChoices(one.modes, `Lista „${label}”`, warnings) !== undefined ? { modes: readChoices(one.modes, '', []) } : {}),
      ...(text(one.textLabel, 120) !== undefined ? { textLabel: text(one.textLabel, 120) } : {}),
      ...(text(one.person, 120) !== undefined ? { person: text(one.person, 120) } : {}),
      fields: readFields(one.fields, `Lista „${label}”`, warnings),
      ...(one.outside === true ? { outside: true } : {}),
      ...(readKinds(one.onlyKinds) !== undefined ? { onlyKinds: readKinds(one.onlyKinds) } : {}),
      ...(rule !== null ? { rule } : {}),
      ...(text(one.says) !== undefined ? { says: text(one.says) } : {})
    });
  }
  return out;
}

export function readScheme(value: unknown, warnings: string[]): SchemeDef | null {
  if (!isObject(value)) { warnings.push('To nie jest obiekt JSON.'); return null; }
  if (value.format !== undefined && value.format !== SCHEME_FORMAT) { warnings.push(`To nie jest schemat („format”: ${String(value.format)}).`); return null; }
  const name = text(value.name, 120);
  if (name === undefined) { warnings.push('Schemat potrzebuje nazwy („name”).'); return null; }
  const kind = (ITEM_KINDS as readonly string[]).includes(String(value.kind)) ? value.kind as ItemKind : undefined;
  if (value.kind !== undefined && kind === undefined) warnings.push(`Nieznany rodzaj „${String(value.kind)}” — pominięty.`);
  return {
    name,
    ...(kind !== undefined ? { kind } : {}),
    ...(readKinds(value.kinds) !== undefined ? { kinds: readKinds(value.kinds) } : {}),
    ...(typeof value.publicTitle === 'boolean' ? { publicTitle: value.publicTitle } : {}),
    fields: readFields(value.fields, 'Schemat', warnings),
    lists: readLists(value.lists, warnings),
    ...(text(value.says, 1000) !== undefined ? { says: text(value.says, 1000) } : {})
  };
}

/** `schemeIds`: die Schemata DIESES Kalenders — ein Verweis auf ein anderes fällt fort. */
export function readPlan(value: unknown, schemeIds: readonly string[], warnings: string[]): PlanDef | null {
  if (!isObject(value)) { warnings.push('To nie jest obiekt JSON.'); return null; }
  if (value.format !== undefined && value.format !== PLAN_FORMAT) { warnings.push(`To nie jest plan („format”: ${String(value.format)}).`); return null; }
  const name = text(value.name, 120);
  if (name === undefined) { warnings.push('Plan potrzebuje nazwy („name”).'); return null; }
  const flow = readFlow(value.flow, 'plan', 'Plan', warnings);
  if (flow === null) { warnings.push('Plan potrzebuje przebiegu („flow”).'); return null; }
  let schemeId = typeof value.schemeId === 'string' ? value.schemeId : null;
  if (schemeId !== null && !schemeIds.includes(schemeId)) {
    warnings.push('Schemat z dokumentu nie należy do tego kalendarza — wybierz schemat w planie.');
    schemeId = null;
  }
  const kind = (ITEM_KINDS as readonly string[]).includes(String(value.kind)) ? value.kind as ItemKind : undefined;
  const weeks = typeof value.weeks === 'number' && value.weeks >= 1 && value.weeks <= 60 ? Math.round(value.weeks) : undefined;
  return {
    name, schemeId, flow,
    ...(kind !== undefined ? { kind } : {}),
    ...(weeks !== undefined ? { weeks } : {}),
    ...(text(value.says, 1000) !== undefined ? { says: text(value.says, 1000) } : {})
  };
}

/* -- Der Baum der Formate ---------------------------------------------------------------------- */

/** Beispiele und ihre Sätze, eine Zeile je Beispiel: `  {"t":"sunday"} — niedziela`. */
const rows = (pairs: readonly (readonly [string, string])[]): string => pairs.map(([what, says]) => `  ${what} — ${says}`).join('\n');

const nodeLines = (types: readonly FlowNodeType[]): string => rows(types.map((t) => [`"${t}"`, `${NODE_INFO[t].label}: ${NODE_INFO[t].says}`]));

/** Jede Regel eines Datums mit einem Beispiel — ein `Record`, damit keine fehlt. */
const DATE_ROWS: Readonly<Record<DateRule['r'], readonly [string, string]>> = {
  fixed: ['{"r":"fixed","month":11,"day":1}', 'co roku ten sam dzień (miesiąc 1 = styczeń)'],
  easter: ['{"r":"easter","offset":-46}', 'dni od Niedzieli Wielkanocnej: −46 Popielec, +49 Zesłanie Ducha Świętego, +60 Boże Ciało, +68 Najświętsze Serce Pana Jezusa'],
  advent: ['{"r":"advent","offset":-7}', 'dni od pierwszej niedzieli Adwentu (−7 Jezusa Chrystusa Króla Wszechświata)'],
  'christmas-sunday': ['{"r":"christmas-sunday"}', 'Święta Rodzina: niedziela w oktawie Narodzenia Pańskiego, a gdy jej nie ma — 30 grudnia'],
  baptism: ['{"r":"baptism"}', 'Chrzest Pański: niedziela po 6 stycznia'],
  'nth-weekday': ['{"r":"nth-weekday","n":1,"weekday":5}', 'n-ty dzień tygodnia miesiąca (n: 1–5, −1 — ostatni); z "month" tylko w tym miesiącu, bez niego co miesiąc (np. pierwszy piątek)'],
  'sunday-after': ['{"r":"sunday-after","month":1,"day":6}', 'pierwsza niedziela PO danym dniu (nie w nim)']
};

/** Jede Bedingung mit einem Beispiel — ein `Record`, damit keine fehlt. */
const TEST_ROWS: Readonly<Record<Test['t'], readonly [string, string]>> = {
  weekday: ['{"t":"weekday","days":[3]}', 'dzień tygodnia'],
  slot: ['{"t":"slot","keys":["p1800"]}', 'godzina mszy — klucz z węzła "slots" (tylko w przebiegu "mass")'],
  time: ['{"t":"time","from":"17:00","to":"21:00"}', 'msza zaczyna się w tym przedziale (wystarczy jedna granica)'],
  season: ['{"t":"season","seasons":["adwent"]}', `okres liturgiczny: ${SEASONS.join(', ')}`],
  week: ['{"t":"week","op":">=","n":2}', 'tydzień okresu'],
  rank: ['{"t":"rank","op":"<=","n":12}', 'ranga obchodu (bez obchodu — dnia): 1 najwyższa … 13 dzień powszedni'],
  celebration: ['{"t":"celebration","is":"any"}', '"any" — jest obchód, "none" — nie ma, "name" — nazwa obchodu zawiera "name"'],
  festive: ['{"t":"festive"}', 'niedziela albo święto nakazane'],
  sunday: ['{"t":"sunday"}', 'niedziela'],
  date: ['{"t":"date","rule":{"r":"easter","offset":60}}', 'ten dzień według reguły daty (niżej)'],
  between: ['{"t":"between","from":"12-24","to":"01-06"}', 'dzień roku w przedziale "MM-DD" (także przez Nowy Rok)'],
  var: ['{"t":"var","name":"colour","op":"=","value":"biały"}', 'zmienna ustawiona wcześniej węzłem "set"; "op": "=", "!=" albo "contains"'],
  mode: ['{"t":"mode","modes":["single"]}', 'rodzaj wpisu'],
  count: ['{"t":"count","scope":"occurrence","op":">=","n":1}', 'ile wpisów tej listy jest już przy tym terminie ("scope": "occurrence") albo w tygodniu od poniedziałku ("week"); "mode" — tylko tego rodzaju; "status": "live" (przyjęte i odprawione, domyślnie) albo "all" (także czekające); "per": "occurrence" — przy ilu INNYCH terminach tygodnia są takie wpisy'],
  actor: ['{"t":"actor","is":"office"}', 'kto dodaje: "office" — prowadzący kalendarz, "outside" — ktoś spoza (jego wpis i tak czeka)'],
  field: ['{"t":"field","key":"giver","op":"set"}', 'pole wpisu: "set" — wypełnione, "empty" — puste, "=" — równe "value"']
};

/** Ein Datum, das sich jedes Jahr verschiebt — im Kalender der Feste ("when") und in der Bedingung "date". */
export const FLOW_DATE_JSON: JsonNode = {
  key: 'flow.date',
  title: 'Reguła daty ("when", warunek "date")',
  text: () => `Data liczona na każdy rok od nowa:
${rows(Object.values(DATE_ROWS))}
Dzień tygodnia ("weekday", "days"): 1 = poniedziałek … 7 = niedziela.`
};

/** Die Bedingungen des Knotens "if" — in einem Plan und in einer Regel. */
export const FLOW_TEST_JSON: JsonNode = {
  key: 'flow.test',
  title: 'Warunek ("if")',
  text: () => `Węzeł "if" ma dane {"test": …} i dwa wyjścia: "yes" (tak) i "no" (nie). Porównanie "op": <, <=, =, >=, >, !=.
Dzień i msza (w planie):
${rows(PLAN_TESTS.map((t) => TEST_ROWS[t]))}
Wpis (w regule listy):
${rows(RULE_TESTS.map((t) => TEST_ROWS[t]))}`,
  inside: () => [FLOW_DATE_JSON]
};

/** Wie ein Ablauf gespeichert ist — Knoten und Kanten, gleich in Plan und Regel. */
export const FLOW_JSON: JsonNode = {
  key: 'flow',
  title: 'Przebieg ("flow", "rule")',
  text: () => `Przebieg to graf jak w edytorze: {"v":1,"nodes":[…],"edges":[…]}.
${keyLines({
    'nodes[]': '{"id", "type", "x", "y", "data"} — "id" niepowtarzalny w przebiegu; "x", "y" — miejsce w edytorze; "data" — ustawienia węzła',
    'edges[]': '{"id", "from", "to", "out"} — z wyjścia węzła "from" do węzła "to"; "out": "out" (jedyne wyjście, domyślnie), "yes" (tak) albo "no" (nie) z węzła "if"'
  })}
Przebieg idzie od węzła startowego po krawędziach, aż dojdzie do węzła kończącego. Węzły bez połączenia nic nie robią; węzły z innego rodzaju przebiegu import pomija ze słowem.`
};

/** Die Regel einer Liste: wer etwas einträgt, kommt durch sie. */
export const RULE_FLOW_JSON: JsonNode = {
  key: 'flow.rule',
  title: 'Reguła listy ("rule")',
  text: () => `Reguła idzie w przeglądarce, gdy ktoś dodaje wpis albo kancelaria przyjmuje czekający. Wynik: przyjąć, czekać albo odmówić (z komunikatem — wpis wtedy nie powstaje). Wpis kogoś spoza prowadzących czeka zawsze; reguła idzie jeszcze raz, gdy kancelaria go przyjmuje.
Węzły:
${nodeLines(RULE_NODES)}
Dane: "refuse" i "wait" — {"message": "…"} (co widzi dodający); "if" — warunek (niżej).`,
  inside: () => [FLOW_JSON, FLOW_TEST_JSON]
};

/** Der Ablauf eines Plans: Tage, ihre Messen, was jede ist. */
export const PLAN_FLOW_JSON: JsonNode = {
  key: 'flow.plan',
  title: 'Przebieg planu ("flow")',
  text: () => `Przebieg "day" idzie raz na każdy dzień zakresu i kończy się węzłem "slots" (msze tego dnia) albo "skip" (bez mszy). Potem przebieg "mass" idzie raz na każdą mszę dnia i kończy się "end" (utwórz) albo "skip" (tej godziny nie ma). Pierwsza pasująca droga wygrywa — tak ustala się pierwszeństwo.
Węzły:
${nodeLines(PLAN_NODES)}
Dane węzłów:
${keyLines({
    season: `{"colours":{"adwent":"fioletowy",…}, "special":{"gaudete":"różowy","laetare":"różowy","palm":"czerwony","goodFriday":"czerwony","pentecost":"czerwony"}} — kolor każdego okresu (${SEASONS.join(', ')}) i dni szczególnych; węzeł liczy okres, tydzień, rangę dnia i kolor`,
    feasts: '{"rows":[{"name","when","rank","colour","festive","title","moveIfImpeded"}]} — obchody: "when" — reguła daty (niżej), "rank" 1–13, "festive": true — godziny niedzielne, "title" — tytuł mszy (bez niego nazwa), "moveIfImpeded": true — wyparty przez wyższą rangę przechodzi na następny dzień; wygrywa najwyższa ranga',
    set: '{"target":"title"|"field"|"var", "key", "value"} — tytuł mszy, pole schematu (po kluczu) albo zmienna (np. "colour")',
    slots: '{"festive":[{"key","label","time":"HH:MM","minutes"}], "weekdays":[{"key","label","time","minutes","days":[1,…,6]}]} — msze w niedziele i święta nakazane oraz w pozostałe dni; "key" zostaje na zawsze — po nim podgląd poznaje msze już zaplanowane',
    record: '{"list":"intencje","mode":"single","text":"Za parafian"} — stały wpis listy schematu przy tej mszy',
    'if, skip, end': '"if" — warunek (niżej); "skip" i "end" bez danych'
  })}
Teksty ("value", "title", "text") mogą mieć miejsca do wypełnienia: {celebration} {celebrationTitle} {title} {season} {seasonName} {week} {weekRoman} {sundayName} {dayName} {weekday} {colour} {date} {dateWords} {time} {slot} — i każdą zmienną z "set". Nieznane zostają, jak są (podgląd je pokaże).`,
  inside: () => [FLOW_JSON, FLOW_DATE_JSON, FLOW_TEST_JSON]
};

/** Ein Feld — am Termin, an einem Tag der Serie, an einem Eintrag. */
export const SCHEME_FIELD_JSON: JsonNode = {
  key: 'scheme.field',
  title: 'Pole ("fields[]")',
  text: () => `${keyLines({
    key: 'a–z, 0–9, _ . - (brak: z nazwy); zostaje, gdy nazwa się zmienia — pod nim są wartości',
    label: 'nazwa (wymagana)',
    type: SCHEME_FIELD_TYPES.map((t) => `"${t}" (${SCHEME_FIELD_LABEL[t]})`).join(', '),
    level: '"item" — cały termin (domyślnie) albo "day" — jeden dzień serii (tylko pola terminu)',
    public: 'true — wartość widać bez klucza: plan mszy, gablota, wydruk; inaczej zaszyfrowana. Przy polach wpisu: tylko takie wypełnia ktoś spoza prowadzących',
    required: 'true — bez wartości nie da się zapisać',
    options: 'dla "choice" i "colour": lista nazw albo {"value","label"}',
    unit: 'dla "number": jednostka (np. "osób")',
    onlyKinds: 'tylko przy tych rodzajach terminów (np. ["mass"])',
    says: 'objaśnienie pola'
  }, '')}
Wartości są tekstem. Kolor liturgiczny to słowo: ${LITURGICAL_COLOURS.map((c) => c.value).join(', ')}.`
};

/** Eine Liste von Einträgen am Termin. */
export const RECORD_LIST_JSON: JsonNode = {
  key: 'scheme.list',
  title: 'Lista wpisów ("lists[]")',
  text: () => `Lista wpisów przy każdym terminie — np. intencje mszy albo zapisy na spotkanie.
${keyLines({
    key: 'jak przy polu; lista "intencje" to intencje mszy (widać je też w „Msze i nabożeństwa”)',
    label: 'nazwa (wymagana)',
    itemLabel: 'jak nazywa się jeden wpis (np. „intencja”)',
    modes: 'rodzaje wpisu: lista nazw albo {"value","label"} (np. [{"value":"single","label":"pojedyncza"},{"value":"collective","label":"zbiorowa"}])',
    textLabel: 'jawny tekst wpisu i jego podpis (np. „Treść intencji” — czytana na mszy, w planie i w gablocie)',
    person: 'podpis przypiętej osoby (np. „Kto odprawia”); kto wpisuje się sam spoza prowadzących, jest tą osobą',
    fields: 'pola wpisu (jak wyżej) — zaszyfrowane kluczem prowadzących kalendarz',
    outside: 'true — wpisują się też osoby, które nie prowadzą kalendarza (wpis czeka na kancelarię)',
    onlyKinds: 'lista tylko przy tych rodzajach terminów',
    rule: 'reguła listy — przebieg (niżej); bez niej każdy wpis prowadzących jest przyjęty',
    says: 'objaśnienie listy'
  }, '')}`,
  inside: () => [SCHEME_FIELD_JSON, RULE_FLOW_JSON]
};

/*
 * 2026-10-30 — WAS DIE APP MIT EINEM SCHEMA TUT: Editor und Details eines Termins (`EventEditor.tsx`,
 * `EventDetails.tsx`); offene Werte gehen nur in den offenen Plan und den Bogen (`Calendar.ValuesAsync` publicOnly,
 * `MassParts.tsx`, `sheet.ts`), die anderen liegen unter dem Bereich, der den Termin sieht (`schemeValues.ts`);
 * Listen mit Regel im Browser (`records.ts`, `RecordsPanel.tsx`), wer welche Einträge sieht (`Calendar.Records.cs`),
 * Wartendes an die Kanzlei (`Notify.cs`, `alerts.ts`); die Liste `intencje` (`Mass.cs`); Pläne (`PlanApply.tsx`).
 */
export const SCHEME_USAGE_JSON: JsonNode = {
  key: 'scheme.usage',
  title: 'Jak aplikacja używa tych danych',
  text: () => `- Schemat zapisany w ustawieniach kalendarza („Schematy terminów”) działa przy terminach, które go mają: edytor terminu pokazuje jego pola (pola "level": "day" — przy wybranym dniu serii), a szczegóły terminu w Kalendarzu — wartości i listy.
- Jawne pola mszy ("public": true) idą do jawnego planu (moduł strony „Msze i nabożeństwa”, np. obchód i kolor szat) i na wydruk do gabloty — gdy obszar, który widzi kalendarz, jest jawny. Pozostałe wartości otwiera tylko klucz tego obszaru.
- Listy wpisów stoją przy każdym dniu terminu. Prowadzący kalendarz dodają wpisy; przy "outside": true także ci, którzy go tylko czytają („Zgłoś”) — taki wpis czeka, a prowadzący widzą go w „Wpisy do przyjęcia” (dzwonek, „Czeka na Ciebie”). Prowadzący widzą wszystkie wpisy, czytający — przyjęte, odprawione i własne.
- Reguły list sprawdza tylko przeglądarka — serwer ich nie zna, bo schemat jest zaszyfrowany.
- Lista "intencje" to intencje mszy: pracuje na niej kancelaria („Msze i nabożeństwa”), a jej przyjęte i odprawione treści idą do jawnego planu i na wydruk. Wpisy innych list do jawnego planu nie trafiają.
- Plan kalendarza tworzy terminy z wybranym schematem i od razu wypełnia jego pola oraz stałe wpisy list.`
};

/*
 * 2026-10-30 — WAS EIN PLAN BEWIRKT: nichts, bis „Zastosuj…" (`PlanApply.tsx`: einzelne Termine aus diesem Browser —
 * Art, Schema, Titel, Werte, feste Einträge „z reguły", `planOrigin`); „już jest" und „Plany do przedłużenia"
 * (`Notify.cs`, `alerts.ts`); versiegelt unter dem eigenen Bereich des Kalenders (`scheme.docAreaOf`).
 */
export const PLAN_USAGE_JSON: JsonNode = {
  key: 'plan.usage',
  title: 'Jak aplikacja używa tych danych',
  text: () => `- Zapisany plan sam niczego nie tworzy. Dopiero „Zastosuj…” (ustawienia kalendarza → „Plany”) liczy w przeglądarce dni wybranego okresu i tworzy pojedyncze terminy w tym kalendarzu.
- Każdy dostaje: rodzaj z planu (bez niego — ze schematu, a bez obu — "mass"), schemat planu, tytuł z przebiegu, wartości pól (także pól dnia) i jawny tytuł, jeśli tak mówi schemat; stałe wpisy z węzłów "record" (np. intencja „Za parafian”) są od razu przyjęte.
- Utworzone terminy widzi każdy, kto ma klucz obszaru, który widzi kalendarz: w Kalendarzu, w „Teraz”, w „Msze i nabożeństwa” i w modułach stron; gdy ten obszar jest jawny — także w jawnym planie mszy i na wydruku do gabloty.
- Termin pamięta plan, godzinę ("key" z "slots") i dzień: dzięki temu podgląd poznaje msze już zaplanowane, a prowadzący kalendarz dostają w „Czeka na Ciebie” „Plany do przedłużenia”, gdy ostatni termin z planu wypada w ciągu dwóch tygodni.
- Plan jest szyfrowany kluczem obszaru, który prowadzi kalendarz (schemat — kluczem obszaru, który widzi terminy).`
};

/** Das Schema — die Wurzel neben seinem Import. */
export const SCHEME_JSON: JsonNode = {
  key: 'scheme',
  title: `Schemat terminu ("${SCHEME_FORMAT}")`,
  short: 'Schemat terminu',
  text: () => `Schemat mówi, czym są terminy kalendarza, jakie mają pola i jakie listy wpisów (intencje, zapisy). Jest szyfrowany w przeglądarce kluczem obszaru, który widzi terminy kalendarza. Import wczytuje dokument do edytora; zapisuje dopiero „Zapisz schemat”. Klucze pól i list zostają — pod nimi są wartości terminów.
${keyLines({
    format: `"${SCHEME_FORMAT}", "version": 1`,
    name: 'nazwa schematu (wymagana), np. „Msza”',
    kind: `rodzaj terminów: ${ITEM_KINDS.map((k) => `"${k}" (${ITEM_LABEL[k]})`).join(', ')} — "mass" stawia termin w planie mszy i w gablocie`,
    kinds: 'rodzaje do wyboru przy terminie (zamiast jednego "kind")',
    publicTitle: 'true — tytuł jawny (plan, gablota), false — zaszyfrowany; brak: jawny przy mszy, spowiedzi i nabożeństwie',
    fields: 'pola terminu (niżej)',
    lists: 'listy wpisów (niżej)',
    says: 'objaśnienie schematu'
  })}
Przykład (szablon „Spotkanie z zapisami”):
${pretty(exportScheme(SCHEME_TEMPLATES.find((t) => t.id === 'spotkanie-zapisy')?.def ?? SCHEME_TEMPLATES[0].def))}`,
  inside: () => [SCHEME_USAGE_JSON, SCHEME_FIELD_JSON, RECORD_LIST_JSON],
  samples: () => SCHEME_TEMPLATES.map((t) => ({ label: `szablon „${t.def.name}”`, doc: () => exportScheme(t.def) }))
};

/** Der Plan — die Wurzel neben seinem Import. */
export const PLAN_JSON: JsonNode = {
  key: 'plan',
  title: `Plan ("${PLAN_FORMAT}")`,
  short: 'Plan',
  text: () => `Plan tworzy pojedyncze terminy (np. msze) na wybrany okres — „Zastosuj…”. Po utworzeniu terminy nie są z planem związane: zmienia się je jak każde inne; drugie zastosowanie tego samego planu pomija msze już zaplanowane. Import wczytuje dokument do edytora; zapisuje dopiero „Zapisz plan”.
${keyLines({
    format: `"${PLAN_FORMAT}", "version": 1`,
    name: 'nazwa planu (wymagana)',
    schemeId: 'schemat tworzonych terminów — schemat TEGO kalendarza; z innego kalendarza znika przy imporcie (wybierz go wtedy w planie)',
    kind: 'rodzaj tworzonych terminów (np. "mass")',
    weeks: 'ile tygodni proponuje okno „Zastosuj…” (1–60)',
    flow: 'przebieg planu (niżej)',
    says: 'objaśnienie planu'
  })}`,
  inside: () => [PLAN_USAGE_JSON, PLAN_FLOW_JSON],
  samples: () => PLAN_TEMPLATES.map((t) => ({ label: `szablon „${t.def.name}”`, doc: () => exportPlan(t.def) }))
};
