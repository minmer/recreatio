/**
 * 0083 — GOTOWE WZORY: Zgoda rodzica, wyjazd, ubezpieczenie — als gewöhnliche
 * Fragen, Aufbau und Logik eines Formulars.
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
 * <b>Mehrere Wzory in einem Formular</b> gehen: was es schon gibt (Imię,
 * Nazwisko, Data urodzenia — genormte Angaben), wird nicht doppelt gefragt,
 * sondern weiterbenutzt.
 */

import { loadAreas, myEpochKeys } from './area';
import { readFormContent, writeFormContent, type QuestionJson } from './formJson';
import { setPartConfig, type FieldKind, type IdentityRole } from './form';
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

/* -- Die Wzory ----------------------------------------------------------------------- */

export interface FormTemplate {
  readonly id: string;
  readonly label: string;
  readonly use: string;
  readonly questions: readonly Q[];
  readonly layout: readonly LayoutItem[];
  readonly nodes: readonly LogicNode[];
  readonly edges: readonly LogicEdge[];
  /** Wann auf Papier: `always` oder die (lokale) Kennung einer Zustimmung. */
  readonly paper?: string;
  readonly signer?: string;
  /** Ein Schritt, den die Kanzlei abhakt — etwa „Zgoda podpisana — oddana". */
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

const MINOR_SHOWS = ['gGuardian', 'consentParticipation'] as const;
const MINOR_NEEDS = ['guardian', 'guardianPhone', 'consentParticipation'] as const;

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

const SIGNER = 'czytelny podpis rodzica / opiekuna prawnego';

const parent = minorLogic(MINOR_SHOWS, MINOR_NEEDS);

const trip = (() => {
  const minor = minorLogic(MINOR_SHOWS, MINOR_NEEDS);
  const health = detailLogic('health', 'healthDetail', 320);
  const diet = detailLogic('diet', 'dietDetail', 540);
  return { nodes: [...minor.nodes, ...health.nodes, ...diet.nodes], edges: [...minor.edges, ...health.edges, ...diet.edges] };
})();

export const FORM_TEMPLATES: readonly FormTemplate[] = [
  {
    id: 'parent',
    label: 'Zgoda rodzica (dla niepełnoletnich)',
    use: 'Uczestnik, data urodzenia; dla niepełnoletniego rodzic z telefonem i zgoda na udział — do wydrukowania i podpisania odręcznie. Wizerunek dobrowolnie.',
    questions: [Q_GIVEN, Q_SURNAME, Q_BORN, Q_GNAME, Q_GPHONE, C_PARTICIPATION, C_RULES, C_IMAGE],
    layout: [
      group('gParticipant', 'Uczestnik', ['given', 'surname', 'born']),
      group('gGuardian', 'Rodzic / opiekun prawny', ['guardian', 'guardianPhone']),
      group('gConsents', 'Oświadczenia i zgody', ['consentParticipation', 'consentRules', 'consentImage']),
      { type: 'text', id: 'tInfo', text: INFO }
    ],
    nodes: parent.nodes, edges: parent.edges,
    paper: 'consentParticipation', signer: SIGNER, step: 'Zgoda rodzica podpisana — oddana'
  },
  {
    id: 'trip',
    label: 'Wyjazd: zgoda rodzica, zdrowie, pomoc w nagłym wypadku',
    use: 'Jak wyżej, a do tego pytania „tak / nie” o zdrowie i dietę (z wyjaśnieniem przy „tak”), pomoc w nagłym wypadku, zgoda na dane o zdrowiu i zasady udziału.',
    questions: [Q_GIVEN, Q_SURNAME, Q_BORN, Q_GNAME, Q_GPHONE, Q_HEALTH, Q_HEALTH_D, Q_DIET, Q_DIET_D,
      C_PARTICIPATION, C_MEDICAL, C_HEALTH, C_RULES, C_IMAGE],
    layout: [
      group('gParticipant', 'Uczestnik', ['given', 'surname', 'born']),
      group('gGuardian', 'Rodzic / opiekun prawny', ['guardian', 'guardianPhone']),
      group('gHealth', 'Zdrowie i dieta', ['health', 'healthDetail', 'diet', 'dietDetail']),
      group('gConsents', 'Oświadczenia i zgody', ['consentParticipation', 'consentMedical', 'consentHealth', 'consentRules', 'consentImage']),
      { type: 'text', id: 'tInfo', text: INFO }
    ],
    nodes: trip.nodes, edges: trip.edges,
    paper: 'consentParticipation', signer: SIGNER, step: 'Zgoda rodzica podpisana — oddana'
  },
  {
    id: 'insurance',
    label: 'Dane do ubezpieczenia (NNW)',
    use: 'Imię, nazwisko, data urodzenia, PESEL (sprawdzany) i adres — to, czego potrzebuje ubezpieczyciel — oraz informacja, że dane trafią do niego. Lista do ubezpieczenia: zakładka „Zgłoszenia” → CSV.',
    questions: [Q_GIVEN, Q_SURNAME, Q_BORN, Q_PESEL, Q_ADDRESS, C_INSURANCE],
    layout: [group('gInsurance', 'Dane do ubezpieczenia', ['given', 'surname', 'born', 'pesel', 'address', 'consentInsurance'])],
    nodes: [], edges: []
  }
];

/* -- Anwenden ------------------------------------------------------------------------ */

export interface TemplateResult {
  readonly added: number;
  readonly reused: number;
  readonly warnings: readonly string[];
  /** Die Einstellungen des Formulars danach (`paper`, `paperSigner`) — `null`: unverändert. */
  readonly config: Record<string, string> | null;
}

/** Kennungen eines Wzór frisch machen — zweimal angewendet, darf nichts zusammenfallen. */
function fresh(template: FormTemplate, reused: ReadonlyMap<string, string>): {
  questions: QuestionJson[]; design: FormDesign; local: ReadonlyMap<string, string>;
} {
  const local = new Map<string, string>();
  const idOf = (id: string) => reused.get(id) ?? local.get(id) ?? (() => { const next = `tpl-${newId()}`; local.set(id, next); return next; })();

  const questions = template.questions.filter((q) => !reused.has(q.id)).map((q): QuestionJson => ({
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
      layout: template.layout.map(item),
      nodes: template.nodes.map((n) => ({
        ...n, id: idOf(n.id),
        ...(n.fieldId === undefined ? {} : { fieldId: idOf(n.fieldId) }),
        ...(n.target === undefined ? {} : { target: idOf(n.target) })
      })),
      edges: template.edges.map((e) => ({ ...e, id: idOf(e.id), from: idOf(e.from), to: idOf(e.to) }))
    }
  };
}

/**
 * EINEN WZÓR AN EIN FORMULAR — Fragen ans Ende, Gruppen und Logik zu dem, was
 * schon da ist (nicht statt dessen), die Einstellung „do podpisu", und der
 * Schritt der Kanzlei am Hauptformular.
 */
export async function applyTemplate(
  who: Who, module: ModuleRow, template: FormTemplate, answersTo: string | null,
  onStage?: (what: string) => void
): Promise<TemplateResult> {
  onStage?.('Czytanie formularza…');
  const now = await readFormContent(who, module.moduleId);
  if (now.unread > 0) throw new WorkspaceError('Części pytań tego formularza nie da się odczytać — wzór mógłby je zdublować. Otwórz formularz z kluczem jego obszaru.');

  /* Was es schon gibt (genormte Angaben), wird weiterbenutzt. */
  const reused = new Map<string, string>();
  for (const q of template.questions) {
    if ((q.identity ?? 'none') === 'none') continue;
    const there = now.questions.find((one) => one.identity === q.identity);
    if (there !== undefined) reused.set(q.id, there.id);
  }

  const { questions, design: added, local } = fresh(template, reused);

  /* Der Aufbau: was dasteht (ohne Aufbau: die Fragen in ihrer Reihenfolge), dann der Wzór. */
  const before = now.design;
  const merged: FormDesign = {
    version: 1,
    layout: [...layoutWith(before?.layout ?? [], now.questions.map((q) => q.id)), ...added.layout],
    nodes: [...(before?.nodes ?? []), ...added.nodes],
    edges: [...(before?.edges ?? []), ...added.edges]
  };

  const written = await writeFormContent(who, { moduleId: module.moduleId, areaId: module.areaId }, { questions, design: merged },
    { replace: false, answersTo, onStage });
  const warnings = [...written.warnings];
  let config: Record<string, string> | null = null;

  /* „Do podpisu": die Kennung der Zustimmung, wie sie jetzt heisst. */
  if (template.paper !== undefined) {
    const paper = template.paper === 'always' ? 'always'
      : reused.get(template.paper) ?? written.ids.get(local.get(template.paper) ?? '') ?? null;
    if (paper === null) warnings.push('Nie udało się ustawić „do podpisu” — ustaw je w zakładce „Ustawienia”.');
    else {
      onStage?.('Ustawianie wydruku do podpisu…');
      config = (await setPartConfig(module.moduleId, { paper, ...(template.signer === undefined ? {} : { paperSigner: template.signer }) })).config;
    }
  }

  if (template.step !== undefined) {
    try {
      onStage?.('Dodawanie kroku dla koordynatora…');
      await addOfficeStep(who, module, template.step);
    } catch (e) {
      warnings.push(`Krok „${template.step}” nie powstał: ${e instanceof WorkspaceError ? e.message : 'nie udało się'} — dodasz go w zakładce „Znaczniki”.`);
    }
  }

  return { added: written.added, reused: reused.size, warnings, config };
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
