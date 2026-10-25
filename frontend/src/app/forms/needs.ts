/**
 * 0083 — GOTOWE WZORY, 0086 — WYMAGANIA, 2026-10-24 — IHRE EINSTELLUNGEN.
 *
 * Was ein Wydarzenie verlangt, zum Ankreuzen: Udział niepełnoletnich, Zdrowie,
 * Ubezpieczenie, Zasady — als gewöhnliche Fragen, Aufbau und Logik eines
 * Formulars. Eingeschaltet, umgestellt und ausgeschaltet wird es in
 * `formTemplates.ts` nach dem Plan aus `needPlan.ts`; HIER steht nur, was ein
 * Wymaganie IST: seine Wortlaute, seine Einstellungen und die Gestalt, die es
 * dem Formular für diese Einstellungen gibt. Alles ohne Netz — so lässt es
 * sich prüfen (`app-platform-check`) und im JSON lesen (`app-json-check`).
 *
 * <b>Kein eigener Baustein, kein eigener Speicher.</b> Der Altbestand hatte
 * dafür die „Karta uczestnika" (`legacy/pages/events/parts/cardLevels.ts`):
 * vier feste Dokumente mit eigener Tabelle. Hier ist ein Wymaganie nur ein
 * Paket aus dem, was jedes Formular schon kann — Fragen (dazu zwei eigene
 * Arten: Zgoda mit ihrem Wortlaut, PESEL mit Prüfziffer), Gruppen, die Logik
 * (der Knoten „Wiek" zeigt die Eltern nur bei Minderjährigen) und die Regel
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
 * Nazwisko, Data urodzenia — genormte Angaben; eine Frage mit demselben
 * Wortlaut), wird nicht doppelt gefragt, sondern weiterbenutzt.
 *
 * <b>2026-10-24 — EINSTELLUNGEN.</b> Ein Wymaganie kann Einstellungen haben
 * (`settings`): eine von mehreren (Knöpfe) oder mehrere (Kästchen). Die
 * Minderjährigen haben zwei — woran man sie erkennt (Geburtsdatum, oder ein
 * Kästchen „ist minderjährig"), und wie sie teilnehmen dürfen (mit einem
 * Elternteil, unter der Obhut eines Erwachsenen, den die Eltern bestimmen,
 * oder allein mit der schriftlichen Zustimmung der Eltern). Für jede Wahl
 * fragt das Formular so wenig wie möglich: mit den Eltern nichts, mit einem
 * Erwachsenen nur seinen Namen, allein den Elternteil, sein Telefon und das
 * Blatt zum Unterschreiben. Ist nur EINE Möglichkeit offen (ein Lager nur für
 * Kinder: allein mit Zustimmung), wählt niemand — sie gilt.
 */

import type { FieldKind, IdentityRole } from './form';
import type { LayoutItem, LogicEdge, LogicNode } from './formDesign';

/* -- Die Wortlaute ------------------------------------------------------------------- */

/** Eine Frage eines Wymaganie — `id` ist ihr Schlüssel im Wzór, nicht ihre Kennung im Formular. */
export interface Q {
  readonly id: string;
  readonly kind: FieldKind;
  readonly label: string;
  readonly help?: string;
  readonly required?: boolean;
  readonly half?: boolean;
  readonly identity?: IdentityRole;
  /** Darf der Mensch es später über seinen Link ändern? Zustimmungen: ja (zurücknehmen). */
  readonly selfEdit?: boolean;
  /**
   * Bei „choice": die Möglichkeiten. Die Logik erkennt die Antwort an ihrem
   * Wortlaut — deshalb hält das Wymaganie sie fest (`lockedOf().options`).
   */
  readonly options?: readonly string[];
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

/* 2026-10-24 — die Minderjährigkeit ohne Geburtsdatum, die Wahl, wie, und der Erwachsene. */
const Q_MINOR: Q = { id: 'minorAsk', kind: 'checkbox', label: 'Uczestnik jest niepełnoletni (nie ma jeszcze 18 lat)' };
const Q_ADULT: Q = {
  id: 'adultName', kind: 'line', label: 'Imię i nazwisko pełnoletniego opiekuna',
  help: 'Osoba dorosła, której rodzic powierza opiekę nad uczestnikiem na miejscu.'
};

/*
 * 0087 — DIE ZUSTIMMUNG DER ELTERN IST KEIN KÄSTCHEN. Ein Häkchen setzt das Kind,
 * nicht der Elternteil, und es ist keine Unterschrift; das Formular zwang aber
 * jeden Minderjährigen, es zu setzen. Jetzt steht sie als Erklärung im
 * Formular (`sign`) und auf dem Ausdruck über der Linie, auf der der
 * Elternteil unterschreibt — gedruckt am Ende des Formulars oder danach.
 */
const APPROVAL = 'Zgoda rodzica / opiekuna prawnego na udział.\n'
  + 'Jako rodzic albo opiekun prawny wyrażam zgodę na udział mojego dziecka w tym wydarzeniu na warunkach '
  + 'podanych przez organizatora. Oświadczam, że znam jego stan zdrowia i nie widzę przeciwwskazań do udziału.';
const WITH_PARENT = 'Niepełnoletni uczestnik bierze udział razem z rodzicem albo opiekunem prawnym.';

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
  + 'organizatora. Gdzie możesz złożyć skargę, podaje informacja o administratorze danych na początku formularza.';

export const NEED_SIGNER = 'czytelny podpis rodzica / opiekuna prawnego';

/** Der Schritt der Kanzlei, wenn Eltern auf Papier zustimmen. */
const APPROVAL_STEP = 'Zgoda rodzica podpisana — oddana';

/* -- Was ein Wymaganie ist -------------------------------------------------------------- */

export type NeedId = 'minor' | 'health' | 'insurance' | 'rules';

/** Eine Möglichkeit einer Einstellung — `label` in der Einstellung, `says` dahinter (und im JSON). */
export interface NeedSettingChoice {
  readonly value: string;
  readonly label: string;
  readonly says: string;
}

/**
 * EINE EINSTELLUNG eines Wymaganie: eine Möglichkeit von mehreren (`many:
 * false`, Knöpfe) oder mehrere (`many: true`, Kästchen — mindestens eine).
 */
export interface NeedSetting {
  readonly key: string;
  readonly label: string;
  readonly many: boolean;
  readonly choices: readonly NeedSettingChoice[];
  /** Was beim Einschalten vorgeschlagen ist (und was ein Dokument ohne diese Einstellung bekommt). */
  readonly start: readonly string[];
  /** Wie ein Eintrag von vor den Einstellungen gilt — so, wie das Wymaganie damals war. */
  readonly was: readonly string[];
}

/** Die gewählten Einstellungen: Schlüssel → gewählte Werte (bei einer: genau einer). */
export type NeedChoice = Readonly<Record<string, readonly string[]>>;

/** Was ein Wymaganie dem Formular für eine Wahl gibt. Die Kennungen darin sind Schlüssel des Wzór. */
export interface NeedShape {
  readonly questions: readonly Q[];
  readonly layout: readonly LayoutItem[];
  readonly nodes: readonly LogicNode[];
  readonly edges: readonly LogicEdge[];
  /** Wann auf Papier: `sign` (wenn eine Erklärung zum Unterschreiben zu sehen ist), `minor`, `always`. */
  readonly paper?: string;
  readonly signer?: string;
  /** Ein Schritt, den die Kanzlei abhakt — etwa „Zgoda rodzica podpisana — oddana". */
  readonly step?: string;
}

export interface FormNeed {
  readonly id: NeedId;
  /** Der Satz am Kästchen. */
  readonly label: string;
  /** Was es dem Formular gibt — für diese Einstellungen. */
  readonly use: (choice: NeedChoice) => string;
  readonly settings: readonly NeedSetting[];
  readonly shape: (choice: NeedChoice) => NeedShape;
  /** Die Regeln „do podpisu", die es setzen kann — beim Ausschalten weicht nur eine von ihnen. */
  readonly papers: readonly string[];
}

const field = (id: string): LayoutItem => ({ type: 'field', id });
const group = (id: string, title: string, items: readonly LayoutItem[]): LayoutItem => ({ type: 'group', id, kind: 'group', title, items });

const plain = (shape: Omit<NeedShape, 'nodes' | 'edges'> & Partial<Pick<NeedShape, 'nodes' | 'edges'>>): NeedShape =>
  ({ nodes: [], edges: [], ...shape });

/* -- Udział niepełnoletnich --------------------------------------------------------------- */

export type MinorWay = 'parent' | 'adult' | 'consent';
const WAY_ORDER: readonly MinorWay[] = ['parent', 'adult', 'consent'];

/** Wie eine Möglichkeit in der Frage „Jak … weźmie udział?" steht — daran erkennt die Logik die Antwort. */
export const WAY_OPTION: Readonly<Record<MinorWay, string>> = {
  parent: 'Razem z rodzicem albo opiekunem prawnym',
  adult: 'Pod opieką pełnoletniej osoby upoważnionej przez rodzica',
  consent: 'Samodzielnie — z pisemną zgodą rodzica'
};

const AGE: NeedSetting = {
  key: 'age',
  label: 'Skąd wiadomo, że uczestnik jest niepełnoletni',
  many: false,
  choices: [
    { value: 'birth', label: 'Pyta o datę urodzenia', says: 'pytanie „Data urodzenia”; niepełnoletni jest ten, kto w dniu wypełnienia nie ma 18 lat — liczy się samo' },
    { value: 'ask', label: 'Pyta tylko, czy jest niepełnoletni', says: 'pole do zaznaczenia „Uczestnik jest niepełnoletni”, bez daty urodzenia' }
  ],
  start: ['birth'],
  was: ['birth']
};

const WAYS: NeedSetting = {
  key: 'ways',
  label: 'Jak może wziąć udział niepełnoletni',
  many: true,
  choices: [
    { value: 'parent', label: 'Razem z rodzicem albo opiekunem prawnym', says: 'nic więcej nie trzeba' },
    { value: 'adult', label: 'Pod opieką pełnoletniej osoby upoważnionej przez rodzica', says: 'wystarczy imię i nazwisko tej osoby' },
    { value: 'consent', label: 'Samodzielnie, z pisemną zgodą rodzica', says: 'imię i nazwisko rodzica, jego telefon i zgoda do podpisu na wydruku; koordynator odhacza oddaną zgodę' }
  ],
  start: ['parent', 'adult', 'consent'],
  was: ['consent']
};

const waysOf = (choice: NeedChoice): MinorWay[] => {
  const ways = WAY_ORDER.filter((w) => (choice.ways ?? []).includes(w));
  return ways.length === 0 ? ['consent'] : ways;
};

const lowerFirst = (text: string): string => text.charAt(0).toLocaleLowerCase('pl') + text.slice(1);

function minorUse(choice: NeedChoice): string {
  const ways = waysOf(choice);
  const how = ways.map((w) => {
    const one = WAYS.choices.find((c) => c.value === w)!;
    return `${lowerFirst(one.label)} (${one.says})`;
  });
  return [
    (choice.age ?? [])[0] === 'ask'
      ? 'Formularz pyta tylko, czy uczestnik jest niepełnoletni.'
      : 'Formularz pyta o datę urodzenia — kto w dniu wypełnienia nie ma 18 lat, jest niepełnoletni.',
    ways.length > 1 ? `Niepełnoletni wybiera, jak weźmie udział: ${how.join('; ')}.` : `Niepełnoletni bierze udział ${how[0]}.`
  ].join(' ');
}

/**
 * DIE GESTALT FÜR MINDERJÄHRIGE — je nach Einstellung.
 *
 * <code>
 *   woran       Geburtsdatum: Wiek(born) < 18       Kästchen: Antwort(minorAsk)
 *   eine Art    gilt für jeden Minderjährigen — ohne Frage
 *   mehrere     „Jak … weźmie udział?" (Pflicht für Minderjährige), und je Art:
 *               Antwort = ihr Wortlaut UND minderjährig
 *   mit Eltern  nichts (allein offen: ein Satz, dass ein Elternteil dabei ist)
 *   Erwachsener sein Name
 *   Zustimmung  Elternteil, Telefon, die Erklärung zum Unterschreiben, Papier
 * </code>
 *
 * Die Schlüssel sind für alle Einstellungen dieselben, und die Fassung von vor
 * den Einstellungen (Geburtsdatum, nur Zustimmung) hat GENAU die Schlüssel und
 * die Reihenfolge, die `applyNeed` damals anlegte — darauf baut `keysOfOn`.
 */
function minorShape(choice: NeedChoice): NeedShape {
  const ask = (choice.age ?? [])[0] === 'ask';
  const ways = waysOf(choice);
  const many = ways.length > 1;
  const has = (w: MinorWay) => ways.includes(w);

  const questions: Q[] = [Q_GIVEN, Q_SURNAME, ask ? Q_MINOR : Q_BORN];
  if (many) questions.push({ id: 'way', kind: 'choice', label: 'Jak niepełnoletni uczestnik weźmie udział?', options: ways.map((w) => WAY_OPTION[w]) });
  if (has('adult')) questions.push(Q_ADULT);
  if (has('consent')) questions.push(Q_GNAME, Q_GPHONE);

  const participant: LayoutItem[] = [field('given'), field('surname'), field(ask ? 'minorAsk' : 'born')];
  if (many) participant.push(field('way'));
  if (!many && has('parent')) participant.push({ type: 'text', id: 'tParent', text: WITH_PARENT });
  if (has('adult')) participant.push(field('adultName'));
  const layout: LayoutItem[] = [group('gParticipant', 'Uczestnik', participant)];
  if (has('consent')) {
    layout.push(group('gGuardian', 'Rodzic / opiekun prawny', [
      field('guardian'), field('guardianPhone'), { type: 'text', id: 'tApproval', text: APPROVAL, sign: true }
    ]));
  }

  /* Woran ein Minderjähriger erkannt wird. */
  const nodes: LogicNode[] = [];
  const edges: LogicEdge[] = [];
  let minor: string;
  if (ask) {
    nodes.push({ id: 'nAsk', kind: 'answer', x: 40, y: 88, fieldId: 'minorAsk' });
    minor = 'nAsk';
  } else {
    nodes.push(
      { id: 'nAge', kind: 'age', x: 40, y: 40, fieldId: 'born' },
      { id: 'n18', kind: 'const', x: 40, y: 140, value: '18' },
      { id: 'nMinor', kind: 'compare', x: 340, y: 80, op: 'lt' }
    );
    edges.push({ id: 'eAge', from: 'nAge', to: 'nMinor', port: 'a' }, { id: 'e18', from: 'n18', to: 'nMinor', port: 'b' });
    minor = 'nMinor';
  }

  /* Was eine Art zeigt und verlangt — gespeist aus `from` (minderjährig, oder minderjährig UND diese Art gewählt). */
  const outputs = (way: MinorWay, from: string, x: number, y: number) => {
    const out = (id: string, kind: 'show' | 'require', target: string, at: { x: number; y: number }, edge: string) => {
      nodes.push({ id, kind, x: at.x, y: at.y, target });
      edges.push({ id: edge, from, to: id, port: 'in' });
    };
    if (way === 'consent') {
      out('nShow0', 'show', 'gGuardian', { x, y }, 'eShow0');
      out('nNeed0', 'require', 'guardian', { x: x + 280, y }, 'eNeed0');
      out('nNeed1', 'require', 'guardianPhone', { x: x + 280, y: y + 96 }, 'eNeed1');
    } else if (way === 'adult') {
      out('nShowA', 'show', 'adultName', { x, y }, 'eShowA');
      out('nNeedA', 'require', 'adultName', { x: x + 280, y }, 'eNeedA');
    } else {
      out('nShowP', 'show', 'tParent', { x, y }, 'eShowP');
    }
  };

  if (!many) {
    outputs(ways[0], minor, 640, 40);
  } else {
    nodes.push(
      { id: 'nShowW', kind: 'show', x: 880, y: 40, target: 'way' },
      { id: 'nNeedW', kind: 'require', x: 1160, y: 40, target: 'way' },
      { id: 'nWay', kind: 'answer', x: 40, y: 240, fieldId: 'way' }
    );
    edges.push({ id: 'eShowW', from: minor, to: 'nShowW', port: 'in' }, { id: 'eNeedW', from: minor, to: 'nNeedW', port: 'in' });
    /* Mit den Eltern braucht es nichts — nur die beiden anderen Arten zeigen etwas. */
    const rows: Partial<Record<MinorWay, number>> = { consent: 136, adult: 328 };
    for (const way of ways) {
      const y = rows[way];
      if (y === undefined) continue;
      const k = way === 'consent' ? 'c' : 'a';
      nodes.push(
        { id: `nC${k}`, kind: 'const', x: 40, y: y + 200, value: WAY_OPTION[way] },
        { id: `nEq${k}`, kind: 'compare', x: 320, y: y + 152, op: 'eq' },
        { id: `nIs${k}`, kind: 'and', x: 600, y: y + 48 }
      );
      edges.push(
        { id: `eWay${k}`, from: 'nWay', to: `nEq${k}`, port: 'a' },
        { id: `eC${k}`, from: `nC${k}`, to: `nEq${k}`, port: 'b' },
        { id: `eM${k}`, from: minor, to: `nIs${k}`, port: 'in' },
        { id: `eEq${k}`, from: `nEq${k}`, to: `nIs${k}`, port: 'in' }
      );
      outputs(way, `nIs${k}`, 880, y);
    }
  }

  return {
    questions, layout, nodes, edges,
    ...(has('consent') ? { paper: 'sign', signer: NEED_SIGNER, step: APPROVAL_STEP } : {})
  };
}

/* -- Zdrowie, Ubezpieczenie, Zasady ------------------------------------------------------- */

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

/* Jedes Wymaganie zeichnet seine Logik in einem eigenen Streifen — zusammen überlappen sie nicht (die Minderjährigen reichen bis 680). */
const HEALTH: NeedShape = (() => {
  const a = detailLogic('health', 'healthDetail', 760);
  const b = detailLogic('diet', 'dietDetail', 940);
  return {
    questions: [Q_HEALTH, Q_HEALTH_D, Q_DIET, Q_DIET_D, C_MEDICAL, C_HEALTH],
    layout: [group('gHealth', 'Zdrowie i dieta', ['health', 'healthDetail', 'diet', 'dietDetail', 'consentMedical', 'consentHealth'].map(field))],
    nodes: [...a.nodes, ...b.nodes],
    edges: [...a.edges, ...b.edges]
  };
})();

const INSURANCE: NeedShape = plain({
  questions: [Q_GIVEN, Q_SURNAME, Q_BORN, Q_PESEL, Q_ADDRESS, C_INSURANCE],
  layout: [group('gInsurance', 'Dane do ubezpieczenia', ['given', 'surname', 'born', 'pesel', 'address', 'consentInsurance'].map(field))]
});

const RULES: NeedShape = plain({
  questions: [C_RULES, C_IMAGE],
  layout: [group('gRules', 'Oświadczenia i zgody', ['consentRules', 'consentImage'].map(field)), { type: 'text', id: 'tInfo', text: INFO }]
});

/* -- Die Wymagania --------------------------------------------------------------------- */

/**
 * 0086 — WAS EIN WYDARZENIE VERLANGT, zum Ankreuzen.
 *
 * <b>Eingeschaltet</b> bringt ein Wymaganie seine Fragen, Gruppen, Logik und —
 * bei den Minderjährigen mit Zustimmung — den Ausdruck zum Unterschreiben
 * mit; was das Formular schon fragt, wird weiterbenutzt. <b>Solange es
 * eingeschaltet ist</b>, lassen sich seine Fragen und seine Logik nicht
 * löschen — verschieben und umformulieren schon. Der Dienst prüft das auch
 * (`config.needs`, `Form.LockedFields`). <b>Umgestellt</b> (2026-10-24) bleibt,
 * was beide Fassungen brauchen, an seinem Platz, mit seinen Antworten.
 * <b>Ausgeschaltet</b> nimmt es mit, was es hinzugefügt hat: Fragen ohne
 * Antworten verschwinden, Fragen mit Antworten werden vom Formular genommen
 * (die Antworten bleiben in den Zgłoszenia), Logik und Ausdruck gehen.
 */
export const NEEDS: readonly FormNeed[] = [
  {
    id: 'minor',
    label: 'Udział niepełnoletnich',
    use: minorUse,
    settings: [AGE, WAYS],
    shape: minorShape,
    /* `minor` setzte die Fassung vor den Einstellungen; heute das allgemeinere `sign`. */
    papers: ['sign', 'minor']
  },
  {
    id: 'health',
    label: 'Zdrowie i dieta, pomoc w nagłym wypadku',
    use: () => 'Pytania „tak / nie” o zdrowie i dietę (przy „tak” — krótkie wyjaśnienie), zgoda na pomoc w nagłym wypadku i na dane o zdrowiu (art. 9 RODO).',
    settings: [],
    shape: () => HEALTH,
    papers: []
  },
  {
    id: 'insurance',
    label: 'Ubezpieczenie NNW',
    use: () => 'Imię, nazwisko, data urodzenia, PESEL (sprawdzany) i adres — to, czego potrzebuje ubezpieczyciel — oraz informacja, że dane trafią do niego. Lista: zakładka „Zgłoszenia” → CSV.',
    settings: [],
    shape: () => INSURANCE,
    papers: []
  },
  {
    id: 'rules',
    label: 'Zasady udziału, wizerunek i informacja o danych',
    use: () => 'Akceptacja zasad (wymagana), dobrowolna zgoda na wizerunek i informacja z art. 13 RODO pod pytaniami.',
    settings: [],
    shape: () => RULES,
    papers: []
  }
];

export const needOf = (id: string): FormNeed | undefined => NEEDS.find((one) => one.id === id);

/* -- Die Wahl ------------------------------------------------------------------------- */

/**
 * Die Einstellungen eines Wymaganie aus einem Wert, duldsam: nur bekannte
 * Möglichkeiten; bei „einer" genau eine, bei „mehreren" mindestens eine —
 * sonst der Vorschlag (`start`) oder, für einen alten Eintrag, `was`.
 */
export function choiceOf(need: FormNeed, raw: unknown, fallback: 'start' | 'was' = 'start', warnings?: string[]): NeedChoice {
  const said = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const out: Record<string, readonly string[]> = {};
  for (const s of need.settings) {
    const value = said[s.key];
    const given = value === undefined ? [] : (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === 'string');
    const known = s.choices.map((c) => c.value);
    const kept = known.filter((v) => given.includes(v));
    for (const v of given) if (!known.includes(v)) warnings?.push(`„${need.label}”: "${s.key}" nie zna „${v}” — możliwe: ${known.map((k) => `"${k}"`).join(', ')}.`);
    if (value !== undefined && given.length === 0 && warnings !== undefined) warnings.push(`„${need.label}”: "${s.key}" bez wartości — przyjęto domyślne.`);
    /* Bei „einer" gilt die erste genannte, die es gibt. */
    const first = given.find((v) => known.includes(v));
    const picked = s.many ? kept : first === undefined ? [] : [first];
    if (!s.many && kept.length > 1) warnings?.push(`„${need.label}”: "${s.key}" przyjmuje jedną wartość — przyjęto „${first}”.`);
    out[s.key] = picked.length > 0 ? picked : (fallback === 'was' ? s.was : s.start);
  }
  return out;
}

export const sameChoice = (need: FormNeed, a: NeedChoice, b: NeedChoice): boolean =>
  need.settings.every((s) => {
    const x = [...(a[s.key] ?? [])].sort();
    const y = [...(b[s.key] ?? [])].sort();
    return x.length === y.length && x.every((v, i) => v === y[i]);
  });

/** Die Wahl in Worten — eine Zeile je Einstellung (für die Vorschau eines Imports). */
export const choiceWords = (need: FormNeed, choice: NeedChoice): string =>
  need.settings.map((s) => `${s.label.toLocaleLowerCase('pl')}: ${(choice[s.key] ?? [])
    .map((v) => lowerFirst(s.choices.find((c) => c.value === v)?.label ?? v)).join(', ')}`).join('; ');
