/**
 * What a participant card *is*, in four steps.
 *
 * The organizer picks one document, not a pile of switches, because the choice
 * is a legal one and the fields follow from it. Everything the rest of the part
 * needs to know about a level lives in this table: which blocks are asked, who
 * signs, whether an electronic signature finishes the matter, and which
 * statements go with it. Adding a fifth level means adding one entry here.
 *
 * Reference points behind the levels:
 *  - RODO art. 5(1)(c) — ask for as little as the purpose needs.
 *  - RODO art. 13 — the information clause is part of every level.
 *  - RODO art. 9(2)(a) — health and diet need their own explicit consent.
 *  - k.c. art. 17 — a minor cannot consent to their own participation; their
 *    statutory representative does, which is why those levels end on paper.
 *  - Rozporządzenie MEN o wypoczynku dzieci i młodzieży (wzór karty
 *    kwalifikacyjnej, Dz.U. 2026 poz. 704) — only the last level.
 */

export type CardLevel = 'rodo' | 'rodo-minor' | 'trip' | 'full';

export type ConsentSpec = {
  code: string;
  label: string;
  text: string;
  required: boolean;
  /** Only shown where the participant is under age. */
  minorOnly: boolean;
};

export type Question = {
  code: string;
  text: string;
  detailLabel: string;
  scope: 'all' | 'minor';
  requireDetail: boolean;
};

export type LevelSpec = {
  label: string;
  /** Shown to the organizer under the choice. */
  note: string;
  /** Needed wherever the answer decides who signs. */
  askBirthDate: boolean;
  /** Name and phone of the statutory representative, for a minor. */
  guardianForMinors: boolean;
  /** The yes/no block. */
  askQuestions: boolean;
  /** PESEL, addresses, vaccinations, special needs — the prescribed form. */
  askKarta: boolean;
  /**
   * True where a minor's card is not finished by clicking. Ticking a box on a
   * website is not the guardian's signature: nobody can show who sat at the
   * keyboard. The card is filled in online, then printed, signed by hand and
   * handed over.
   */
  paperForMinors: boolean;
  consents: ConsentSpec[];
  questions: Question[];
};

const CLAUSE_ACK: ConsentSpec = {
  code: 'clause',
  label: 'Informacja o danych',
  text: 'Zapoznałam/em się z informacją o przetwarzaniu danych osobowych podaną powyżej.',
  required: true,
  minorOnly: false
};

const IMAGE: ConsentSpec = {
  code: 'image',
  label: 'Wizerunek (dobrowolne)',
  text:
    'Zgadzam się na nieodpłatne utrwalenie i publikację wizerunku w relacjach z wydarzenia, zgodnie z art. 81 ' +
    'ustawy o prawie autorskim i prawach pokrewnych. Zgoda jest dobrowolna, nie warunkuje udziału i mogę ją wycofać.',
  required: false,
  minorOnly: false
};

const PARTICIPATION: ConsentSpec = {
  code: 'participation',
  label: 'Zgoda na udział',
  text:
    'Jako rodzic albo opiekun prawny wyrażam zgodę na udział mojego dziecka w tym wydarzeniu na warunkach ' +
    'podanych przez organizatora. Oświadczam, że znam jego stan zdrowia i nie widzę przeciwwskazań do udziału.',
  required: true,
  minorOnly: true
};

const MEDICAL: ConsentSpec = {
  code: 'medical',
  label: 'Pomoc w nagłym wypadku',
  text:
    'W razie zagrożenia zdrowia lub życia zgadzam się na wezwanie pomocy medycznej i udzielenie niezbędnej ' +
    'pomocy, a organizatora proszę o niezwłoczne powiadomienie mnie.',
  required: true,
  minorOnly: false
};

const HEALTH_DATA: ConsentSpec = {
  code: 'health',
  label: 'Zgoda na dane o zdrowiu',
  text:
    'Jeżeli podaję wyżej informacje o zdrowiu lub diecie, wyrażam wyraźną zgodę na ich przetwarzanie ' +
    '(art. 9 ust. 2 lit. a RODO) wyłącznie po to, żeby bezpiecznie zaopiekować się uczestnikiem. Zgodę mogę ' +
    'wycofać w każdej chwili; wycofanie nie wpływa na zgodność z prawem wcześniejszego przetwarzania.',
  required: false,
  minorOnly: false
};

const RULES: ConsentSpec = {
  code: 'rules',
  label: 'Zasady udziału',
  text: 'Znam zasady udziału podane przez organizatora i zobowiązuję się ich przestrzegać.',
  required: true,
  minorOnly: false
};

const HEALTH_QUESTION: Question = {
  code: 'health',
  text: 'Czy jest coś w stanie zdrowia, o czym powinniśmy wiedzieć — alergie, choroby przewlekłe, leki przyjmowane na stałe?',
  detailLabel: 'Napisz krótko, co powinniśmy wiedzieć',
  scope: 'all',
  requireDetail: true
};

const DIET_QUESTION: Question = {
  code: 'diet',
  text: 'Czy stosujesz dietę, której nie możemy pominąć?',
  detailLabel: 'Jaka dieta',
  scope: 'all',
  requireDetail: true
};

export const CARD_LEVELS: Record<CardLevel, LevelSpec> = {
  rodo: {
    label: 'Sama klauzula i zgody RODO',
    note:
      'Pytamy wyłącznie o imię i nazwisko, pokazujemy klauzulę i zbieramy zgody. Nic się nie drukuje. ' +
      'Poziom dla wydarzeń, w których biorą udział wyłącznie osoby pełnoletnie.',
    askBirthDate: false,
    guardianForMinors: false,
    askQuestions: false,
    askKarta: false,
    paperForMinors: false,
    consents: [CLAUSE_ACK, IMAGE],
    questions: []
  },

  'rodo-minor': {
    label: 'RODO + krótka zgoda rodzica dla niepełnoletnich',
    note:
      'Osoba pełnoletnia załatwia wszystko na stronie. Dla niepełnoletniej dochodzi rodzic albo opiekun ' +
      'z telefonem i krótka zgoda na udział, którą trzeba wydrukować i podpisać odręcznie.',
    askBirthDate: true,
    guardianForMinors: true,
    askQuestions: false,
    askKarta: false,
    paperForMinors: true,
    consents: [CLAUSE_ACK, PARTICIPATION, IMAGE],
    questions: []
  },

  trip: {
    label: 'Pełna zgoda na wyjazd + RODO',
    note:
      'Dla wycieczki, wyjazdu, pielgrzymki. Do zgody dochodzą pytania „tak/nie” o zdrowie i dietę oraz ' +
      'zgoda na pomoc w nagłym wypadku. Zgodę dla niepełnoletniego trzeba wydrukować i podpisać odręcznie.',
    askBirthDate: true,
    guardianForMinors: true,
    askQuestions: true,
    askKarta: false,
    paperForMinors: true,
    consents: [CLAUSE_ACK, PARTICIPATION, MEDICAL, HEALTH_DATA, RULES, IMAGE],
    questions: [HEALTH_QUESTION, DIET_QUESTION]
  },

  full: {
    label: 'Komplet danych — karta kwalifikacyjna (wypoczynek)',
    note:
      'Dokłada PESEL, adresy, szczepienia i szczególne potrzeby, bo tego wymaga wzór karty kwalifikacyjnej. ' +
      'Wybieraj tylko wtedy, gdy wydarzenie naprawdę jest wypoczynkiem dzieci i młodzieży w rozumieniu ustawy ' +
      'o systemie oświaty — w innym przypadku zbierasz dane, do których nie masz podstawy.',
    askBirthDate: true,
    guardianForMinors: true,
    askQuestions: true,
    askKarta: true,
    paperForMinors: true,
    consents: [CLAUSE_ACK, PARTICIPATION, MEDICAL, HEALTH_DATA, RULES, IMAGE],
    questions: [HEALTH_QUESTION, DIET_QUESTION]
  }
};

export const LEVEL_OPTIONS: Array<{ value: CardLevel; label: string }> = (
  Object.keys(CARD_LEVELS) as CardLevel[]
).map((value) => ({ value, label: CARD_LEVELS[value].label }));

export function readLevel(value: unknown): CardLevel {
  return value === 'rodo' || value === 'rodo-minor' || value === 'trip' || value === 'full' ? value : 'trip';
}
