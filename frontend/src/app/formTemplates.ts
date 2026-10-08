/**
 * 0083 — GOTOWE WZORY, 0086 — WYMAGANIA: Zgoda rodzica, Zdrowie, Ubezpieczenie,
 * Zasady — als gewöhnliche Fragen, Aufbau und Logik eines Formulars, zum
 * Ankreuzen (unten: „Die Wymagania").
 *
 * <b>Kein eigener Baustein, kein eigener Speicher.</b> Der Altbestand hatte
 * dafür die „Karta uczestnika" (`legacy/pages/events/parts/cardLevels.ts`):
 * vier feste Dokumente mit eigener Tabelle. Hier ist ein Wzór nur ein Paket
 * aus dem, was jedes Formular schon kann — Fragen (dazu zwei neue Arten:
 * Zgoda mit ihrem Wortlaut, PESEL mit Prüfziffer), Gruppen, die Logik (der
 * Knoten „Wiek" zeigt die Eltern nur bei Minderjährigen) und die Einstellung
 * „do podpisu" (die Zustimmung der Eltern verlangt Papier). Danach ist es ein
 * Formular wie jedes andere: versiegelt, mit Link, Schritten, Liste, JSON —
 * und jeder Satz lässt sich ändern.
 *
 * <b>Wozu die Texte fest vorgeschlagen sind.</b> Die Wortlaute stammen aus dem
 * Altbestand und folgen RODO (Art. 6, 7, 9, 13) und k.c. Art. 17 (für ein
 * minderjähriges Kind stimmt der gesetzliche Vertreter zu, auf Papier). Wer
 * sie ändert, ändert sie für künftige Antworten — jede gegebene Zustimmung
 * trägt ihren eigenen Text (`consentValue`).
 *
 * <b>Mehrere Wymagania in einem Formular</b> gehen: was es schon gibt (Imię,
 * Nazwisko, Data urodzenia — genormte Angaben), wird nicht doppelt gefragt,
 * sondern weiterbenutzt.
 */

import { loadAreas, myEpochKeys } from './area';
import { readFormContent, writeFormContent, type QuestionJson } from './formJson';
import { removeField, restoreField, setPartConfig, type FieldKind, type IdentityRole } from './form';
import { layoutWith, type FormDesign, type LayoutItem, type LogicEdge, type LogicNode } from './formDesign';
import { newId } from './ids';
import { loadModules, type ModuleRow } from './module';
import { keysFor } from './ringOf';
import { WorkspaceError, type Who } from './session';
import { openStepInfo } from './entryDesk';
import { saveSteps, type StepDraft } from './steps';

/* -- Die Wortlaute ------------------------------------------------------------------- */

interface Q {
  readonly id: string;
  readonly kind: FieldKind;
  readonly label: string;
  readonly help?: string;
  readonly required?: boolean;
  readonly half?: boolean;
  readonly identity?: IdentityRole;
  /** Darf der Mensch es später über seinen Link ändern? Zustimmungen: ja (zurücknehmen). */
  readonly selfEdit?: boolean;
}

const Q_GIVEN: Q = { id: 'given', kind: 'line', label: 'Imię', identity: 'given_name', required: true, half: true };
const Q_SURNAME: Q = { id: 'surname', kind: 'line', label: 'Nazwisko', identity: 'surname', required: true, half: true };
const Q_BORN: Q = { id: 'born', kind: 'date', label: 'Data urodzenia', identity: 'born', required: true, half: true };
const Q_PESEL: Q = {
  id: 'pesel', kind: 'pesel', label: 'PESEL', half: true,
  help: 'Potrzebny do ubezpieczenia uczestnika. Jeśli uczestnik nie ma numeru PESEL, zostaw puste — wystarczy data urodzenia.'
};
const Q_ADDRESS: Q = { id: 'address', kind: 'line', label: 'Adres zamieszkania', identity: 'address', required: true };
/*
 * WAS DIE LOGIK VERBERGEN KANN, VERLANGT DIE LOGIK (Knoten „Wymagane"), nicht
 * die Frage selbst: der Dienst prüft „wymagane" ohne die Logik zu sehen (sie
 * ist versiegelt) — und wiese jeden Erwachsenen ab, der keinen Elternteil und
 * keine Zustimmung der Eltern angibt.
 */
const Q_GNAME: Q = { id: 'guardian', kind: 'line', label: 'Imię i nazwisko rodzica / opiekuna prawnego' };
const Q_GPHONE: Q = { id: 'guardianPhone', kind: 'phone', label: 'Telefon rodzica / opiekuna', help: 'Numer czynny przez cały czas trwania wydarzenia.' };

const C_PARTICIPATION: Q = {
  id: 'consentParticipation', kind: 'consent', label: 'Zgoda rodzica na udział',
  help: 'Jako rodzic albo opiekun prawny wyrażam zgodę na udział mojego dziecka w tym wydarzeniu na warunkach '
    + 'podanych przez organizatora. Oświadczam, że znam jego stan zdrowia i nie widzę przeciwwskazań do udziału.'
};
const C_MEDICAL: Q = {
  id: 'consentMedical', kind: 'consent', label: 'Pomoc w nagłym wypadku', required: true,
  help: 'W razie zagrożenia zdrowia lub życia zgadzam się na wezwanie pomocy medycznej i udzielenie niezbędnej '
    + 'pomocy, a organizatora proszę o niezwłoczne powiadomienie mnie (albo rodzica / opiekuna).'
};
const C_HEALTH: Q = {
  id: 'consentHealth', kind: 'consent', label: 'Zgoda na dane o zdrowiu',
  help: 'Jeżeli podaję informacje o zdrowiu lub diecie, wyrażam wyraźną zgodę na ich przetwarzanie '
    + '(art. 9 ust. 2 lit. a RODO) wyłącznie po to, żeby bezpiecznie zaopiekować się uczestnikiem. Zgodę mogę '
    + 'wycofać w każdej chwili; wycofanie nie wpływa na zgodność z prawem wcześniejszego przetwarzania.'
};
const C_RULES: Q = {
  id: 'consentRules', kind: 'consent', label: 'Zasady udziału', required: true,
  help: 'Znam zasady udziału podane przez organizatora (regulamin) i zobowiązuję się ich przestrzegać.'
};
const C_IMAGE: Q = {
  id: 'consentImage', kind: 'consent', label: 'Wizerunek (dobrowolne)',
  help: 'Zgadzam się na nieodpłatne utrwalenie i publikację wizerunku w relacjach z wydarzenia, zgodnie z art. 81 '
    + 'ustawy o prawie autorskim i prawach pokrewnych. Zgoda jest dobrowolna, nie warunkuje udziału i mogę ją wycofać.'
};
const C_INSURANCE: Q = {
  id: 'consentInsurance', kind: 'consent', label: 'Ubezpieczenie (NNW)', required: true,
  help: 'Przyjmuję do wiadomości, że w celu ubezpieczenia uczestnika od następstw nieszczęśliwych wypadków '
    + 'organizator przekaże ubezpieczycielowi jego imię, nazwisko, datę urodzenia, numer PESEL i adres — tylko w tym celu '
    + 'i tylko na czas trwania ubezpieczenia.'
};

const Q_HEALTH: Q = { id: 'health', kind: 'checkbox', label: 'Jest coś w stanie zdrowia, o czym powinniśmy wiedzieć (alergie, choroby przewlekłe, leki)' };
const Q_HEALTH_D: Q = { id: 'healthDetail', kind: 'text', label: 'Napisz krótko, co powinniśmy wiedzieć o zdrowiu' };
const Q_DIET: Q = { id: 'diet', kind: 'checkbox', label: 'Uczestnik stosuje dietę, której nie możemy pominąć' };
const Q_DIET_D: Q = { id: 'dietDetail', kind: 'text', label: 'Jaka dieta' };

const INFO =
  'Informacja o danych (art. 13 RODO): dane z tego formularza widzi wyłącznie organizator — administrator danych podany '
  + 'powyżej. Służą udziałowi w wydarzeniu, kontaktowi w sprawach organizacyjnych i bezpieczeństwu uczestników, a dane '
  + 'o zdrowiu i diecie — tylko opiece nad uczestnikiem, na podstawie wyraźnej zgody. Przysługuje prawo dostępu do danych, '
  + 'ich sprostowania, usunięcia i ograniczenia przetwarzania; zgody można wycofać w każdej chwili przez swój link albo u '
  + 'organizatora. Przysługuje skarga do Prezesa Urzędu Ochrony Danych Osobowych.';

/* -- Die Wymagania ------------------------------------------------------------------- */

/**
 * 0086 — WAS EIN WYDARZENIE VERLANGT, zum Ankreuzen: „Niepełnoletni potrzebują
 * pisemnej zgody rodzica", „Zdrowie i dieta", „Ubezpieczenie", „Zasady".
 *
 * <b>Eingeschaltet</b> bringt ein Wymaganie seine Fragen, Gruppen, Logik und —
 * bei den Minderjährigen — den Ausdruck zum Unterschreiben mit; was das
 * Formular schon fragt (Imię, Nazwisko, Data urodzenia), wird weiterbenutzt.
 * <b>Solange es eingeschaltet ist</b>, lassen sich seine Fragen und seine
 * Logik nicht löschen — verschieben und umformulieren schon. Der Dienst prüft
 * das auch (`config.needs`, `Form.LockedFields`).
 * <b>Ausgeschaltet</b> nimmt es mit, was es hinzugefügt hat: Fragen ohne
 * Antworten verschwinden, Fragen mit Antworten werden vom Formular genommen
 * (die Antworten bleiben in den Zgłoszenia), Logik und Ausdruck gehen.
 */
export type NeedId = 'minor' | 'health' | 'insurance' | 'rules';

export interface FormNeed {
  readonly id: NeedId;
  /** Der Satz am Kästchen. */
  readonly label: string;
  /** Was es dem Formular gibt. */
  readonly use: string;
  readonly questions: readonly Q[];
  readonly layout: readonly LayoutItem[];
  readonly nodes: readonly LogicNode[];
  readonly edges: readonly LogicEdge[];
  /** Wann auf Papier: `minor` (Minderjährige), `always`. */
  readonly paper?: string;
  readonly signer?: string;
  /** Ein Schritt, den die Kanzlei abhakt — etwa „Zgoda rodzica podpisana — oddana". */
  readonly step?: string;
}

const field = (id: string): LayoutItem => ({ type: 'field', id });
const group = (id: string, title: string, ids: readonly string[]): LayoutItem => ({ type: 'group', id, kind: 'group', title, items: ids.map(field) });

/** Die Logik „unter 18": Wiek(Data urodzenia) < 18 → zeige die Eltern und ihre Zustimmung, und verlange sie. */
const minorLogic = (shows: readonly string[], requires: readonly string[]): { nodes: LogicNode[]; edges: LogicEdge[] } => ({
  nodes: [
    { id: 'nAge', kind: 'age', x: 40, y: 40, fieldId: 'born' },
    { id: 'n18', kind: 'const', x: 40, y: 140, value: '18' },
    { id: 'nMinor', kind: 'compare', x: 340, y: 80, op: 'lt' },
    ...shows.map((target, i): LogicNode => ({ id: `nShow${i}`, kind: 'show', x: 640, y: 40 + i * 96, target })),
    ...requires.map((target, i): LogicNode => ({ id: `nNeed${i}`, kind: 'require', x: 920, y: 40 + i * 96, target }))
  ],
  edges: [
    { id: 'eAge', from: 'nAge', to: 'nMinor', port: 'a' },
    { id: 'e18', from: 'n18', to: 'nMinor', port: 'b' },
    ...shows.map((_, i): LogicEdge => ({ id: `eShow${i}`, from: 'nMinor', to: `nShow${i}`, port: 'in' })),
    ...requires.map((_, i): LogicEdge => ({ id: `eNeed${i}`, from: 'nMinor', to: `nNeed${i}`, port: 'in' }))
  ]
});

/** „Tak" bei einer Frage → zeige und verlange ihre Erklärung. */
const detailLogic = (yes: string, detail: string, y: number): { nodes: LogicNode[]; edges: LogicEdge[] } => ({
  nodes: [
    { id: `n${yes}`, kind: 'answer', x: 40, y, fieldId: yes },
    { id: `n${yes}Show`, kind: 'show', x: 640, y, target: detail },
    { id: `n${yes}Req`, kind: 'require', x: 920, y, target: detail }
  ],
  edges: [
    { id: `e${yes}Show`, from: `n${yes}`, to: `n${yes}Show`, port: 'in' },
    { id: `e${yes}Req`, from: `n${yes}`, to: `n${yes}Req`, port: 'in' }
  ]
});

export const NEED_SIGNER = 'czytelny podpis rodzica / opiekuna prawnego';

const minor = minorLogic(['gGuardian'], ['guardian', 'guardianPhone', 'consentParticipation']);

/* Jedes Wymaganie zeichnet seine Logik in einem eigenen Streifen — zusammen überlappen sie nicht. */
const health = (() => {
  const a = detailLogic('health', 'healthDetail', 460);
  const b = detailLogic('diet', 'dietDetail', 640);
  return { nodes: [...a.nodes, ...b.nodes], edges: [...a.edges, ...b.edges] };
})();

export const NEEDS: readonly FormNeed[] = [
  {
    id: 'minor',
    label: 'Niepełnoletni potrzebują pisemnej zgody rodzica',
    use: 'Data urodzenia uczestnika; gdy ma mniej niż 18 lat (w dniu wypełnienia) — rodzic z telefonem i jego zgoda na udział. '
      + 'Po wysłaniu niepełnoletni dostaje wydruk do podpisania odręcznie, a koordynator odhacza oddaną zgodę.',
    questions: [Q_GIVEN, Q_SURNAME, Q_BORN, Q_GNAME, Q_GPHONE, C_PARTICIPATION],
    layout: [
      group('gParticipant', 'Uczestnik', ['given', 'surname', 'born']),
      group('gGuardian', 'Rodzic / opiekun prawny', ['guardian', 'guardianPhone', 'consentParticipation'])
    ],
    nodes: minor.nodes, edges: minor.edges,
    paper: 'minor', signer: NEED_SIGNER, step: 'Zgoda rodzica podpisana — oddana'
  },
  {
    id: 'health',
    label: 'Zdrowie i dieta, pomoc w nagłym wypadku',
    use: 'Pytania „tak / nie” o zdrowie i dietę (przy „tak” — krótkie wyjaśnienie), zgoda na pomoc w nagłym wypadku i na dane o zdrowiu (art. 9 RODO).',
    questions: [Q_HEALTH, Q_HEALTH_D, Q_DIET, Q_DIET_D, C_MEDICAL, C_HEALTH],
    layout: [group('gHealth', 'Zdrowie i dieta', ['health', 'healthDetail', 'diet', 'dietDetail', 'consentMedical', 'consentHealth'])],
    nodes: health.nodes, edges: health.edges
  },
  {
    id: 'insurance',
    label: 'Ubezpieczenie NNW',
    use: 'Imię, nazwisko, data urodzenia, PESEL (sprawdzany) i adres — to, czego potrzebuje ubezpieczyciel — oraz informacja, że dane trafią do niego. Lista: zakładka „Zgłoszenia” → CSV.',
    questions: [Q_GIVEN, Q_SURNAME, Q_BORN, Q_PESEL, Q_ADDRESS, C_INSURANCE],
    layout: [group('gInsurance', 'Dane do ubezpieczenia', ['given', 'surname', 'born', 'pesel', 'address', 'consentInsurance'])],
    nodes: [], edges: []
  },
  {
    id: 'rules',
    label: 'Zasady udziału, wizerunek i informacja o danych',
    use: 'Akceptacja zasad (wymagana), dobrowolna zgoda na wizerunek i informacja z art. 13 RODO pod pytaniami.',
    questions: [C_RULES, C_IMAGE],
    layout: [group('gRules', 'Oświadczenia i zgody', ['consentRules', 'consentImage']), { type: 'text', id: 'tInfo', text: INFO }],
    nodes: [], edges: []
  }
];

export const needOf = (id: string): FormNeed | undefined => NEEDS.find((one) => one.id === id);

/* -- Was ein eingeschaltetes Wymaganie hält (config.needs) ----------------------------- */

/**
 * In der Einstellung `needs` des Formulars — eine Liste, eine Zeile je
 * eingeschaltetem Wymaganie, mit den Kennungen dessen, was es hält.
 */
export interface NeedOn {
  readonly id: string;
  readonly label: string;
  /** ALLE seine Fragen — auch die weiterbenutzten. Gesperrt, solange es eingeschaltet ist. */
  readonly fields: readonly string[];
  /** Die, die es selbst angelegt hat — beim Ausschalten gehen nur sie. */
  readonly added: readonly string[];
  /** Seine Gruppen und Texte im Aufbau. */
  readonly items: readonly string[];
  /** Seine Logik. */
  readonly nodes: readonly string[];
  readonly edges: readonly string[];
  /** Hat es die Regel „do podpisu” gesetzt? Dann nimmt es sie beim Ausschalten mit. */
  readonly paper?: boolean;
}

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : []);

/** Duldsam gelesen: Unlesbares heisst „nichts eingeschaltet". */
export function readNeeds(text: string | null | undefined): NeedOn[] {
  if (text == null || text.trim() === '') return [];
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const out: NeedOn[] = [];
  for (const one of raw) {
    if (typeof one !== 'object' || one === null) continue;
    const r = one as Record<string, unknown>;
    if (typeof r.id !== 'string' || r.id === '' || out.some((x) => x.id === r.id)) continue;
    out.push({
      id: r.id,
      label: typeof r.label === 'string' && r.label !== '' ? r.label : needOf(r.id)?.label ?? r.id,
      fields: ids(r.fields), added: ids(r.added), items: ids(r.items), nodes: ids(r.nodes), edges: ids(r.edges),
      ...(r.paper === true ? { paper: true } : {})
    });
  }
  return out;
}

/** Zurück in die Einstellung — leer, wenn keines eingeschaltet ist (dann fällt der Schlüssel weg). */
export const needsJson = (needs: readonly NeedOn[]): string => (needs.length === 0 ? '' : JSON.stringify(needs));

/** Was gesperrt ist — Frage, Knoten → der Name des Wymaganie; Kanten als Menge. */
export function lockedOf(needs: readonly NeedOn[]): {
  readonly fields: ReadonlyMap<string, string>;
  readonly nodes: ReadonlyMap<string, string>;
  readonly edges: ReadonlySet<string>;
} {
  const fields = new Map<string, string>();
  const nodes = new Map<string, string>();
  const edges = new Set<string>();
  for (const need of needs) {
    for (const id of need.fields) if (!fields.has(id)) fields.set(id, need.label);
    for (const id of need.nodes) if (!nodes.has(id)) nodes.set(id, need.label);
    for (const id of need.edges) edges.add(id);
  }
  return { fields, nodes, edges };
}

/**
 * Ein Aufbau ohne die Gruppen und Texte eines Wymaganie. Was in einer seiner
 * Gruppen steht und nicht ihm gehört (jemand hat eine eigene Frage
 * hineingeschoben), rückt an die Stelle der Gruppe — es geht nichts verloren.
 */
export function layoutWithout(layout: readonly LayoutItem[], items: ReadonlySet<string>, fields: ReadonlySet<string>): LayoutItem[] {
  return layout.flatMap((item): LayoutItem[] => {
    if (item.type === 'field') return fields.has(item.id) ? [] : [item];
    if (item.type === 'group') {
      const inner = layoutWithout(item.items, items, fields);
      return items.has(item.id) ? inner : [{ ...item, items: inner }];
    }
    return items.has(item.id) ? [] : [item];
  });
}

/** Eine Logik ohne die Knoten und Kanten eines Wymaganie — und ohne Kanten, die an einem davon hingen. */
export function logicWithout(
  design: { readonly nodes: readonly LogicNode[]; readonly edges: readonly LogicEdge[] },
  nodes: ReadonlySet<string>, edges: ReadonlySet<string>
): { nodes: LogicNode[]; edges: LogicEdge[] } {
  return {
    nodes: design.nodes.filter((n) => !nodes.has(n.id)),
    edges: design.edges.filter((e) => !edges.has(e.id) && !nodes.has(e.from) && !nodes.has(e.to))
  };
}

/* -- Einschalten --------------------------------------------------------------------- */

export interface NeedResult {
  readonly added: number;
  readonly reused: number;
  readonly warnings: readonly string[];
  /** Die Einstellungen des Formulars danach. */
  readonly config: Record<string, string>;
}

/** Kennungen eines Wymaganie frisch machen — zweimal angewendet, darf nichts zusammenfallen. */
function fresh(need: FormNeed, reused: ReadonlyMap<string, string>): {
  questions: QuestionJson[]; design: FormDesign; local: ReadonlyMap<string, string>;
} {
  const local = new Map<string, string>();
  const idOf = (id: string) => reused.get(id) ?? local.get(id) ?? (() => { const next = `tpl-${newId()}`; local.set(id, next); return next; })();

  const questions = need.questions.filter((q) => !reused.has(q.id)).map((q): QuestionJson => ({
    id: idOf(q.id), kind: q.kind, label: q.label, help: q.help ?? null, options: [],
    required: q.required ?? false, halfWidth: q.half ?? false, identity: q.identity ?? 'none',
    selfEdit: q.selfEdit ?? true, answersTo: ''
  }));

  const item = (one: LayoutItem): LayoutItem =>
    one.type === 'field' ? { type: 'field', id: idOf(one.id) }
    : one.type === 'group' ? { ...one, id: idOf(one.id), items: one.items.map(item) }
    : { ...one, id: idOf(one.id) };

  return {
    questions,
    local,
    design: {
      version: 1,
      layout: need.layout.map(item),
      nodes: need.nodes.map((n) => ({
        ...n, id: idOf(n.id),
        ...(n.fieldId === undefined ? {} : { fieldId: idOf(n.fieldId) }),
        ...(n.target === undefined ? {} : { target: idOf(n.target) })
      })),
      edges: need.edges.map((e) => ({ ...e, id: idOf(e.id), from: idOf(e.from), to: idOf(e.to) }))
    }
  };
}

/** Die Kennungen der Gruppen und Texte eines Aufbaus (ohne die Fragen). */
const itemIds = (layout: readonly LayoutItem[]): string[] =>
  layout.flatMap((one) => (one.type === 'field' ? [] : one.type === 'group' ? [one.id, ...itemIds(one.items)] : [one.id]));

/**
 * EIN WYMAGANIE EINSCHALTEN — Fragen ans Ende, Gruppen und Logik zu dem, was
 * schon da ist (nicht statt dessen), die Regel „do podpisu", der Schritt der
 * Kanzlei — und in `config.needs`, was es jetzt hält.
 */
export async function applyNeed(
  who: Who, module: ModuleRow, need: FormNeed, answersTo: string | null,
  config: Readonly<Record<string, string>>, onStage?: (what: string) => void
): Promise<NeedResult> {
  const before = readNeeds(config.needs);
  if (before.some((one) => one.id === need.id)) throw new WorkspaceError(`„${need.label}” jest już włączone.`);

  onStage?.('Czytanie formularza…');
  const now = await readFormContent(who, module.moduleId);
  if (now.unread > 0) throw new WorkspaceError('Części pytań tego formularza nie da się odczytać — wymaganie mogłoby je zdublować. Otwórz formularz z kluczem jego obszaru.');

  /*
   * Was es schon gibt (genormte Angaben), wird weiterbenutzt. 0086 — und was
   * vom Formular genommen ist (ein Wymaganie, das aus- und wieder eingeschaltet
   * wird): dieselbe Angabe oder dieselbe Frage kommt mit ihren Antworten
   * zurück, statt neben ihnen ein zweites Mal zu entstehen.
   */
  const reused = new Map<string, string>();
  const back: string[] = [];
  for (const q of need.questions) {
    const identity = q.identity ?? 'none';
    const there = identity === 'none' ? undefined : now.questions.find((one) => one.identity === identity);
    if (there !== undefined) { reused.set(q.id, there.id); continue; }
    const gone = (now.removed ?? []).find((one) => (identity !== 'none' && one.identity === identity)
      || (one.kind === q.kind && one.label !== null && one.label.trim() === q.label));
    if (gone !== undefined && !back.includes(gone.id)) { reused.set(q.id, gone.id); back.push(gone.id); }
  }
  for (const id of back) {
    onStage?.('Przywracanie pytań…');
    await restoreField(id);
  }

  const { questions, design: added, local } = fresh(need, reused);

  /* Der Aufbau: was dasteht (ohne Aufbau: die Fragen in ihrer Reihenfolge), dann das Wymaganie. */
  const was = now.design;
  const merged: FormDesign = {
    version: 1,
    layout: [...layoutWith(was?.layout ?? [], now.questions.map((q) => q.id)), ...added.layout],
    nodes: [...(was?.nodes ?? []), ...added.nodes],
    edges: [...(was?.edges ?? []), ...added.edges]
  };

  const written = await writeFormContent(who, { moduleId: module.moduleId, areaId: module.areaId }, { questions, design: merged },
    { replace: false, answersTo, onStage });
  const warnings = [...written.warnings];

  const made = [
    ...back,
    ...need.questions.filter((q) => !reused.has(q.id))
      .map((q) => written.ids.get(local.get(q.id) ?? '')).filter((id): id is string => id !== undefined)
  ];
  const all = need.questions.map((q) => reused.get(q.id) ?? written.ids.get(local.get(q.id) ?? ''))
    .filter((id): id is string => id !== undefined);

  /*
   * „DO PODPISU": für Minderjährige. Steht schon „zawsze", bleibt es — das ist
   * mehr; eine Regel „wenn angekreuzt" (vor 0086 von Hand gesetzt) weicht.
   */
  const set: Record<string, string> = {};
  let paper = false;
  if (need.paper !== undefined && (config.paper ?? '') !== 'always') {
    set.paper = need.paper;
    if (need.signer !== undefined) set.paperSigner = need.signer;
    paper = true;
  }

  const on: NeedOn = {
    id: need.id, label: need.label, fields: all, added: made,
    items: itemIds(added.layout), nodes: added.nodes.map((n) => n.id), edges: added.edges.map((e) => e.id),
    ...(paper ? { paper: true } : {})
  };
  set.needs = needsJson([...before, on]);

  onStage?.('Zapisywanie wymagań formularza…');
  const saved = (await setPartConfig(module.moduleId, set)).config;

  if (need.step !== undefined) {
    try {
      onStage?.('Dodawanie kroku dla koordynatora…');
      await addOfficeStep(who, module, need.step);
    } catch (e) {
      warnings.push(`Krok „${need.step}” nie powstał: ${e instanceof WorkspaceError ? e.message : 'nie udało się'} — dodasz go w zakładce „Znaczniki”.`);
    }
  }

  if (back.length > 0) warnings.push(`Wróciły do formularza pytania zdjęte wcześniej (${back.length}) — razem z odpowiedziami.`);
  return { added: made.length - back.length, reused: reused.size - back.length, warnings, config: saved };
}

/* -- Ausschalten --------------------------------------------------------------------- */

export interface NeedDropped {
  /** Ganz gelöscht (ohne Antworten). */
  readonly removed: number;
  /** Vom Formular genommen — ihre Antworten bleiben in den Zgłoszenia. */
  readonly kept: number;
  readonly warnings: readonly string[];
  readonly config: Record<string, string>;
}

/**
 * EIN WYMAGANIE AUSSCHALTEN. Erst die Sperre (sonst lehnte der Dienst das
 * Entfernen ab), dann seine eigenen Fragen — die, die noch ein anderes
 * eingeschaltetes Wymaganie braucht, bleiben —, dann seine Gruppen und Logik.
 * Der Schritt der Kanzlei bleibt: an ihm hängen vielleicht schon Häkchen.
 */
export async function dropNeed(
  who: Who, module: ModuleRow, needId: string,
  config: Readonly<Record<string, string>>, onStage?: (what: string) => void
): Promise<NeedDropped> {
  const before = readNeeds(config.needs);
  const gone = before.find((one) => one.id === needId);
  if (gone === undefined) throw new WorkspaceError('To wymaganie nie jest włączone.');
  const rest = before.filter((one) => one.id !== needId);

  const set: Record<string, string> = { needs: needsJson(rest) };
  if (gone.paper === true && (config.paper ?? '') === (needOf(needId)?.paper ?? '')) {
    set.paper = '';
    if ((config.paperSigner ?? '') === (needOf(needId)?.signer ?? '')) set.paperSigner = '';
  }
  onStage?.('Zapisywanie wymagań formularza…');
  const saved = (await setPartConfig(module.moduleId, set)).config;

  const still = new Set(rest.flatMap((one) => one.fields));
  const leaving = gone.added.filter((id) => !still.has(id));
  const warnings: string[] = [];
  let removed = 0;
  let kept = 0;
  for (const id of leaving) {
    onStage?.('Usuwanie pytań wymagania…');
    try {
      const done = await removeField(id);
      if (done.kept === true) kept += 1; else removed += 1;
    } catch (e) {
      /* Schon von Hand entfernt — nichts zu tun. Sonst sagen, was blieb. */
      if (!(e instanceof WorkspaceError && /nie ma/i.test(e.message))) {
        warnings.push(`Pytanie ${id.slice(0, 8)} zostaje: ${e instanceof WorkspaceError ? e.message : 'nie udało się usunąć'}.`);
      }
    }
  }

  /* Der Aufbau und die Logik ohne das, was es mitgebracht hat. */
  const now = await readFormContent(who, module.moduleId);
  if (now.design !== null) {
    const logic = logicWithout(now.design, new Set(gone.nodes), new Set(gone.edges));
    const design: FormDesign = {
      ...now.design,
      layout: layoutWithout(now.design.layout, new Set(gone.items), new Set(leaving)),
      nodes: logic.nodes,
      edges: logic.edges
    };
    if (JSON.stringify(design) !== JSON.stringify(now.design)) {
      onStage?.('Zapisywanie układu…');
      const written = await writeFormContent(who, { moduleId: module.moduleId, areaId: module.areaId }, { design },
        { replace: false, answersTo: null, onStage });
      warnings.push(...written.warnings);
    }
  }

  return { removed, kept, warnings, config: saved };
}

const localDay = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Ein Schritt, den die Kanzlei abhakt — am HAUPTformular (eine Erweiterung hat
 * keine eigenen Schritte). Alle vorhandenen bleiben; ist er schon da, nichts.
 */
async function addOfficeStep(who: Who, module: ModuleRow, label: string): Promise<void> {
  const baseId = module.extendsId ?? module.moduleId;
  const base = module.extendsId === null ? module : (await loadModules()).modules.find((m) => m.moduleId === baseId);
  if (base === undefined || base.areaId === null) throw new WorkspaceError('formularz główny nie ma własnego obszaru');

  const { ring } = await keysFor(who);
  if (ring === null) throw new WorkspaceError('bez hasła nie da się zapieczętować kroku');

  const info = await openStepInfo(baseId, ring);
  if (info.steps.some((one) => one.label === label)) return;
  if (info.steps.some((one) => one.label === null)) throw new WorkspaceError('nie wszystkie kroki da się odczytać');

  const area = (await loadAreas()).areas.find((a) => a.areaId === base.areaId);
  const key = area === undefined ? undefined : (await myEpochKeys(ring, area.areaId)).get(area.currentEpoch);
  if (area === undefined || key === undefined) throw new WorkspaceError('brak klucza obszaru formularza');

  const drafts: StepDraft[] = [
    ...info.steps.map((one): StepDraft => ({
      stepId: one.stepId, label: one.label!, help: one.help ?? '', doneBy: one.doneBy,
      visibleToPerson: one.visibleToPerson, dueAt: one.dueAt === null ? '' : localDay(one.dueAt)
    })),
    { stepId: newId(), label, help: 'Koordynator odhacza, gdy dostanie podpisany wydruk.', doneBy: 'office', visibleToPerson: true, dueAt: '' }
  ];

  await saveSteps(baseId, drafts, { areaId: area.areaId, epoch: area.currentEpoch, key });
}
