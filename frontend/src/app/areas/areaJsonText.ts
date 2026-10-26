/**
 * 0133 — DIE BESCHREIBUNG DES DOKUMENTS EINES BEREICHS („recreatio/area"), als
 * Baum (`core/jsonTree.ts`): der Bereich trägt seine Seiten, jede Seite ist das
 * Dokument einer Seite — derselbe Knoten wie im Editor der Seite (`PAGE_JSON`),
 * nur ohne dessen Beispiele zum Einsetzen (die sind Seiten, keine Bereiche).
 *
 * Dazu die Beispiele eines Wydarzenie und einer Grupa — sie lassen sich ohne
 * ein Wort importieren (`scripts/app-duty-check.mjs`) — und der Auftrag für ein
 * Sprachmodell, das aus dem Export des letzten Wydarzenie das nächste schreibt.
 */

import { describe, keyLines, pretty, sectionsOf, sectionText, textNode, type JsonNode } from '../core/jsonTree';
import { DEFAULT_ENTRY } from '../calendar/appointmentsJson';
import { PAGE_JSON } from '../pages/pageJsonText';
import { NEED_PREFIX } from '../pages/pageImageNeeds';
import { AREA_FORMAT, LEVEL_WORD, MAX_LISTINGS, MAX_PAGES, MAX_ROLES, MAX_SUBFORMS } from './areaJson';
import { kindLabel, PROFILE_KINDS, type ProfileKind } from './profile';

/* -- Der Baum ohne fremde Beispiele -------------------------------------------------- */

const bare = new Map<string, JsonNode>();

/** Derselbe Knoten (dieselben Sätze, derselbe Schlüssel), nur ohne Beispiele zum Einsetzen — auch darunter. */
function withoutSamples(node: JsonNode): JsonNode {
  const known = bare.get(node.key);
  if (known !== undefined) return known;
  const { samples: _samples, inside, ...rest } = node;
  const copy: JsonNode = { ...rest, ...(inside === undefined ? {} : { inside: () => inside().map(withoutSamples) }) };
  bare.set(node.key, copy);
  return copy;
}

/* -- Die Sätze ------------------------------------------------------------------------- */

const INTRO = (): string => `Jeden dokument opisuje cały obszar: wydarzenie, grupę, parafię albo kurs — jego profil i wizytówkę, role (z linkami), terminy z programem, strony (z formularzami), podformularze, rozmowy i listy, na których ma się pokazać.
Co robi import:
- Najpierw sprawdza i pokazuje plan, krok po kroku; zapisuje dopiero po „Importuj”, w kolejności: profil, role, terminy, formularze i strony, podformularze, rozmowy, wizytówka, listy.
- Wszystko nazywa się krótkimi kluczami ("key" ról, stron, terminów, podformularzy; "id" modułów na stronie). Obszar pamięta, co import utworzył pod jakim kluczem: ten sam dokument zaimportowany jeszcze raz ZMIENIA to samo, zamiast dublować. Dokument z innego obszaru (np. eksport zeszłorocznego wydarzenia) zakłada tu wszystko od nowa — nigdy nie zmienia stron, formularzy ani ról tamtego obszaru.
- Czego nie ma w dokumencie, zostaje bez zmian (rola, strona, termin, moduł). Wyjątek: program terminu — jego punkty są w dokumencie w całości, więc punkt, którego zabrakło, znika.
- Role, które już są, zostają, jakie były (import nie zmienia ich uprawnień); nowe role i linki powstają raz.
- Odpowiedzi formularzy zawsze trafiają do tego obszaru — za dane odpowiada jego administrator danych. Pytania, termin i wizytówka mogą być widoczne w innym obszarze ("publish") — zwykle w jawnym obszarze nad nim, jak „Wydarzenia” parafii.
- Klucze i adresy stron widzi usługa — nie wpisuj w nie danych osobowych.
Zwróć JEDEN obiekt JSON, bez komentarzy.`;

const AREA_KEYS = (): string => `${keyLines({
  format: `"${AREA_FORMAT}"`,
  version: '1',
  kind: `rodzaj obszaru: ${PROFILE_KINDS.map((k) => `"${k.kind}" (${k.label})`).join(', ')}; pominięty — zostaje, jaki był (nowy profil go wymaga)`,
  name: 'nazwa obszaru — tylko informacja (import jej nie zmienia)',
  category: 'jedno słowo do filtrów na listach, np. "rekolekcje" (do 40 znaków) albo null',
  address: 'proponowany adres strony głównej, np. "parafia/rekolekcje-2026" — osoba importująca może go zmienić; adresy stron liczą się od niego',
  publish: '"auto" — publiczne części (wizytówka, termin, pytania formularzy) idą do najbliższego jawnego obszaru nad tym, który prowadzisz; "area" — zostają w tym obszarze (widzą je tylko jego osoby); albo identyfikator obszaru (z eksportu)',
  archive: '"auto" — godzinę po końcu głównego terminu formularze się zamykają, a strona „po wydarzeniu” się pokazuje; "manual" — ręcznie',
  card: 'wizytówka na listach i kartach: { "title", "lead", "image", "publish" } — "image": "page-image:@klucz" (plik opisany w "images" strony głównej) albo "page-image:<id>"; null — bez wizytówki',
  roles: `role obszaru (najwyżej ${MAX_ROLES}) — niżej: Role i linki`,
  appointments: 'terminy w kalendarzu obszaru, z programem — niżej: Terminy obszaru',
  pages: `strony obszaru (najwyżej ${MAX_PAGES}), każda z dokumentem strony — niżej: Strony obszaru`,
  subforms: `podformularze formularzy z tych stron (najwyżej ${MAX_SUBFORMS}) — niżej: Podformularze`,
  chats: '"area" — rozmowa wszystkich osób obszaru, "channel" — kanał ogłoszeń (piszą prowadzący); albo { "kind": "area", "forms": ["@form:strona/moduł"] } — z osobami zapisanymi przez te formularze (ich własnymi linkami)',
  listings: `adresy stron z listą „Wydarzenia”, na których obszar prosi o miejsce (najwyżej ${MAX_LISTINGS}); "events" — katalog recreatio.pl/events (decyduje operator, karta bez danych osobowych)`
})}`;

const REFS = (): string => `Dokument nie używa identyfikatorów usługi — wskazuje swoje części przez odwołania. Odwołanie to CAŁA wartość (albo lista po przecinku), nigdy fragment tekstu:
${keyLines({
  '@area': 'ten obszar — np. "area" modułu "event" (wizytówka), "areas" modułu "events"',
  '@form:strona/moduł': 'formularz z tego dokumentu: "key" strony i "id" modułu (np. "@form:main/zapisy"); albo "@form:klucz" podformularza — np. "form" modułu "entries", "formId" w mapie logiki',
  '@page:klucz': 'adres strony z tego dokumentu — np. w menu ("kind": "abs") albo w polu „Strona”',
  '@role:klucz': 'rola z tego dokumentu; w "memberRoles" i "virtualAreas" formularzy wystarczy "@klucz"',
  '@termin': `w polach kalendarza modułów ("item", "calendar", "calendars") — termin z "appointments" po "key" (także punkt programu z własnym "key"); "@${DEFAULT_ENTRY}" — kalendarz obszaru`
})}
Moduł "program" z "item": "@termin" i pustym "calendar" sam dostaje kalendarz obszaru. Eksport zapisuje odwołania w tej samej postaci.`;

const ROLES = (): string => `Wpis w "roles":
${keyLines({
  key: 'krótka nazwa (litery, cyfry, - i _, do 32 znaków), np. "organizatorzy"',
  name: 'nazwa roli, np. "Organizatorzy" (widzą ją prowadzący)',
  level: `co rola może w obszarze: ${Object.entries(LEVEL_WORD).map(([k, v]) => `"${k}" (${v})`).join(', ')}`,
  link: 'true albo { "days": 1–365 (domyślnie 30), "once": true — jednorazowy, "lead": true — kto go otworzy, sam może przyjmować innych do roli, "label" } — link zaproszenia do tej roli; otwiera widok obszaru (w wydarzeniu rola, która tylko czyta — jego stronę główną); powstaje raz i pokazuje się po imporcie'
})}
Każda nowa rola to kilkanaście sekund liczenia kluczy w przeglądarce. Uczestnicy zapisani przez formularz dostają rolę z "memberRoles" formularza (np. ["@uczestnicy"]) — dla nich link nie jest potrzebny.`;

const APPOINTMENTS = (): string => `Wpis w "appointments" ma klucze terminu ze strony (niżej: Terminy do kalendarza) — "key", "title", "start", "end", "allDay", "location", "notes", "link", "linkLabel", "repeat", "every", "weekdays", "until", "points" — oraz:
${keyLines({
  key: 'wymagany — po nim ponowny import zmienia ten sam termin (bez niego dostaje „termin-1”, „termin-2”…)',
  main: 'true — główny termin: jego koniec jest końcem wydarzenia (karty, archiwum); jeden, bez powtórzeń; pojedynczy termin wydarzenia jest główny sam',
  publish: '"area", "auto" albo identyfikator obszaru — gdzie termin (i jego program) jest widoczny; pominięty — jak "publish" obszaru'
})}
Wszystkie terminy idą do kalendarza obszaru ("calendar" i "calendars" są tu zbędne). Punkty programu ("points") ponowny import zmienia w miejscu po kolei; punkt, którego zabrakło w dokumencie, znika z kalendarza.`;

const PAGES = (): string => `Wpis w "pages":
${keyLines({
  key: 'krótka nazwa strony (do 24 znaków), np. "main", "zapisy", "po"',
  path: '"" — adres strony głównej; "zapisy" — pod nim ("parafia/rekolekcje-2026/zapisy"); "/inny/adres" — dokładnie ten adres; pominięty — "" dla strony głównej, inaczej "key"',
  main: 'true — strona główna obszaru (karty prowadzą na nią); bez tego — strona z "path": ""',
  after: 'true — strona „po wydarzeniu”: przygotowana, ale ukryta do końca głównego terminu; potem pokazuje się na kartach',
  access: '"public" — każdy; "members" — tylko osoby obszaru; pominięty — zostaje, jak było (nowa: publiczna)',
  page: 'dokument strony — jak niżej (Strona jako JSON), bez "path", "appointments" i "calendars"'
})}
W modułach strony ("modules") dokument obszaru dodaje:
${keyLines({
  id: 'nazwa modułu na tej stronie (litery, cyfry, - i _, do 32 znaków) — po niej ponowny import zmienia ten sam moduł; formularz musi ją mieć (inaczej po zmianie kolejności trafiłby w inny formularz i jego zgłoszenia)',
  members: 'true — moduł widzą tylko osoby obszaru (z kontem, linkiem albo własnym linkiem z formularza), np. zdjęcia i materiały na stronie „po wydarzeniu”; false — wszyscy',
  publish: 'tylko "form": "area", "auto" albo identyfikator obszaru — gdzie leżą pytania (formularz publiczny w prywatnym obszarze: pytania pod kluczem jawnego obszaru, odpowiedzi tutaj); pominięty — jak "publish" obszaru',
  answer: 'tylko "seat-ask" („Napisz do nas”): kto odpowiada — role z "roles", np. ["@role:organizatorzy"]; pominięty — role z "level": "admin" (bez nich tylko osoba importująca); osoba z linkiem czyta „Napisz do: …” z ich nazwami',
  forms: 'tylko "seat-ask": czyje osoby mogą zacząć rozmowę — formularze z tego dokumentu, np. ["@form:main/zapisy"]; pominięty — wszystkie formularze stron dokumentu'
})}
"module" jest w dokumencie obszaru pomijane, "answersTo" pytań też (odpowiedzi trafiają do tego obszaru). Strona, która już istnieje, a nie jest stroną tego obszaru, nie zostanie zmieniona, chyba że osoba importująca na to pozwoli.`;

const SUBFORMS = (): string => `Wpis w "subforms" — formularz, który rozszerza formularz ze strony (zgody, ankieta po wydarzeniu, karta zdrowia):
${keyLines({
  key: 'krótka nazwa (do 32 znaków)',
  of: 'formularz, który rozszerza: "@form:strona/moduł"',
  name: 'nazwa podformularza',
  audience: '"person" — wypełnia osoba przez swój link; "office" — tylko prowadzący',
  repeat: '"once", "day", "week", "month", "year" — jak często (zwykle "once")',
  publish: 'jak przy formularzu na stronie',
  questions: 'pytania — jak w formularzu (niżej: Formularz); także "design", "needs", "memberRoles", "virtualAreas", "group"'
})}`;

/* -- Beispiele ------------------------------------------------------------------------- */

const SIGNUP = [
  { id: 'imie', kind: 'line', label: 'Imię', required: true, halfWidth: true, identity: 'given_name' },
  { id: 'nazwisko', kind: 'line', label: 'Nazwisko', required: true, halfWidth: true, identity: 'surname' },
  { id: 'telefon', kind: 'phone', label: 'Telefon', required: true, halfWidth: true, identity: 'phone' },
  { id: 'email', kind: 'email', label: 'E-mail', required: false, halfWidth: true, identity: 'email' }
];

/** Ein Wydarzenie: Rekolekcje mit Zapisy, Programm, Seite danach mit Materialien nur für Teilnehmer. */
export function areaExample(): Record<string, unknown> {
  return {
    format: AREA_FORMAT,
    version: 1,
    kind: 'event',
    name: 'Rekolekcje adwentowe 2026',
    category: 'rekolekcje',
    address: 'parafia/rekolekcje-2026',
    publish: 'auto',
    archive: 'auto',
    card: { title: 'Rekolekcje adwentowe 2026', lead: 'Trzy wieczory ze słowem, ciszą i wspólnotą — 4–6 grudnia w kościele parafialnym.', image: `${NEED_PREFIX}plakat` },
    roles: [
      { key: 'organizatorzy', name: 'Organizatorzy', level: 'admin' },
      { key: 'pomocnicy', name: 'Pomocnicy', level: 'write', link: { days: 30 } },
      { key: 'uczestnicy', name: 'Uczestnicy', level: 'read' }
    ],
    appointments: [{
      key: 'main', main: true, title: 'Rekolekcje adwentowe 2026', start: '2026-12-04T18:00', end: '2026-12-06T21:00', location: 'Kościół parafialny',
      points: [
        { key: 'dzien1', title: 'Dzień 1 — Słowo', start: '2026-12-04T18:00', end: '2026-12-04T21:00' },
        { title: 'Dzień 2 — Cisza', start: '2026-12-05T18:00', end: '2026-12-05T21:00' },
        { title: 'Dzień 3 — Wspólnota', start: '2026-12-06T18:00', end: '2026-12-06T21:00' }
      ]
    }],
    pages: [
      {
        key: 'main', path: '', main: true, access: 'public',
        page: {
          title: 'Rekolekcje adwentowe 2026',
          lead: 'Trzy wieczory ze słowem, ciszą i wspólnotą.',
          images: [{ key: 'plakat', label: 'Plakat rekolekcji', description: 'Plakat albo zdjęcie kościoła wieczorem; poziomo — na kartę i na górę strony' }],
          modules: [
            { id: 'wizytowka', kind: 'event', config: { title: '', area: '@area' } },
            { id: 'zdjecie', kind: 'image', config: { url: `${NEED_PREFIX}plakat`, alt: 'Kościół parafialny wieczorem', fit: 'cover' } },
            { id: 'program', kind: 'program', config: { title: 'Program', calendar: '', item: '@main', hide: '' } },
            { id: 'zapisy', kind: 'form', name: 'Zapisy na rekolekcje', questions: SIGNUP, memberRoles: ['@uczestnicy'] },
            { id: 'napisz', kind: 'seat-ask', config: { title: 'Napisz do organizatorów' }, answer: ['@role:organizatorzy'], forms: ['@form:main/zapisy'] }
          ]
        }
      },
      {
        key: 'po', path: 'po', after: true,
        page: {
          title: 'Po rekolekcjach',
          lead: 'Dziękujemy, że byliście.',
          modules: [
            { id: 'podziekowanie', kind: 'text', config: { title: 'Dziękujemy', body: 'Nagrania konferencji i zdjęcia są niżej — tylko dla uczestników.' } },
            { id: 'materialy', kind: 'files', members: true, config: { files: [{ label: 'Konferencje (nagrania)', url: 'https://…/konferencje.zip', note: null, size: null }], note: null } }
          ]
        }
      }
    ],
    subforms: [{
      key: 'zgody', of: '@form:main/zapisy', name: 'Zgoda na zdjęcia', audience: 'person',
      questions: [{ id: 'zgoda', kind: 'choice', label: 'Czy zgadzasz się na zdjęcia z rekolekcji na stronie parafii?', options: ['Tak', 'Nie'], required: true }]
    }],
    chats: [{ kind: 'area', forms: ['@form:main/zapisy'] }, 'channel']
  };
}

/** Eine Grupa: Schola mit wöchentlicher Probe, einer Seite nur für Mitglieder und einem Link für sie. */
export function groupExample(): Record<string, unknown> {
  return {
    format: AREA_FORMAT,
    version: 1,
    kind: 'group',
    name: 'Schola parafialna',
    address: 'parafia/schola',
    publish: 'area',
    card: { title: 'Schola parafialna', lead: 'Śpiewamy na mszy niedzielnej o 11:00. Próby w czwartki o 19:00.' },
    roles: [{ key: 'czlonkowie', name: 'Członkowie scholi', level: 'write', link: { days: 60 } }],
    appointments: [{ key: 'proba', title: 'Próba scholi', start: '2026-11-05T19:00', end: '20:30', repeat: 'weekly', weekdays: ['cz'], location: 'Salka przy zakrystii' }],
    pages: [{
      key: 'main', path: '', main: true, access: 'members',
      page: {
        title: 'Schola — dla członków',
        modules: [
          { id: 'kalendarz', kind: 'calendar', config: { title: 'Próby i występy', calendars: `@${DEFAULT_ENTRY}` } },
          { id: 'nuty', kind: 'files', config: { files: [{ label: 'Śpiewnik na Adwent', url: 'https://…/spiewnik.pdf', note: null, size: 'PDF' }], note: null } }
        ]
      }
    }],
    chats: ['area']
  };
}

/* -- Der Baum ---------------------------------------------------------------------------- */

/** 0133 — DER BEREICH ALS JSON: der Baum, aus dem seine Beschreibung entsteht (und die Beispiele zum Einsetzen). */
export const AREA_JSON: JsonNode = {
  key: 'area',
  title: `Obszar jako JSON ("${AREA_FORMAT}", wersja 1)`,
  text: INTRO,
  inside: () => [
    textNode('area.keys', 'Obszar', AREA_KEYS),
    textNode('area.refs', 'Odwołania', REFS),
    textNode('area.roles', 'Role i linki', ROLES),
    textNode('area.appointments', 'Terminy obszaru', APPOINTMENTS),
    textNode('area.pages', 'Strony obszaru', PAGES, () => [withoutSamples(PAGE_JSON)]),
    textNode('area.subforms', 'Podformularze', SUBFORMS),
    textNode('area.example', 'Przykład: wydarzenie', () => pretty(areaExample())),
    textNode('area.group', 'Przykład: grupa', () => pretty(groupExample()))
  ],
  samples: () => [
    { label: 'wydarzenie: rekolekcje z zapisami i stroną po nich', doc: areaExample },
    { label: 'grupa: schola z próbami', doc: groupExample }
  ]
};

export const areaDescription = (): string => describe(AREA_JSON);

/* -- Kürzer für eine KI ------------------------------------------------------------------------ */

/**
 * Lange Abschnitte, die ein Wydarzenie, eine Grupa, eine Parafia selten braucht (die Animation
 * allein ist ein Drittel des Ganzen) — im Auftrag nur, wenn ein Vorbild sie benutzt.
 */
const RARE_KINDS = new Set(['animation', 'lab2d', 'physics', 'particles', 'layers', 'shape', 'question', 'cogita-revision', 'cogita-flow', 'cogita-live', 'knowledge-map', 'topic-explorer']);
const RARE_SECTIONS: Readonly<Record<string, RegExp>> = {
  live: /"live"\s*:/,
  motion: /"motion"\s*:/,
  layers: /"(?:layers|slide)"\s*:/,
  presentation: /"mode"\s*:\s*"presentation"/,
  'page.presentation': /"mode"\s*:\s*"presentation"/
};

/** Die Arten der Bausteine auf den Seiten eines Dokuments eines Bereichs. */
export function kindsUsed(doc: unknown): Set<string> {
  const out = new Set<string>();
  const pages = doc !== null && typeof doc === 'object' && Array.isArray((doc as { pages?: unknown }).pages) ? (doc as { pages: unknown[] }).pages : [];
  for (const entry of pages) {
    const page = entry !== null && typeof entry === 'object' ? (entry as { page?: unknown }).page : undefined;
    const modules = page !== null && typeof page === 'object' && Array.isArray((page as { modules?: unknown }).modules) ? (page as { modules: unknown[] }).modules : [];
    for (const m of modules) {
      const kind = m !== null && typeof m === 'object' ? (m as { kind?: unknown }).kind : undefined;
      if (typeof kind === 'string' && kind !== '') out.add(kind);
    }
  }
  return out;
}

/**
 * DIE BESCHREIBUNG FÜR DEN AUFTRAG — ohne die langen, seltenen Abschnitte, die kein Vorbild
 * braucht (`left`: was fehlt, in Worten). Die volle steht neben dem Import.
 */
export function areaDescriptionShort(docs: readonly unknown[]): { text: string; left: string[] } {
  const used = new Set(docs.flatMap((d) => [...kindsUsed(d)]));
  const raw = docs.map((d) => JSON.stringify(d) ?? '').join('\n');
  const left: string[] = [];
  const skipped = new Set<string>();
  const kept = sectionsOf(AREA_JSON).filter((s) => {
    if (s.parent !== null && skipped.has(s.parent)) { skipped.add(s.node.key); return false; }
    const kind = /^part(?:-doc)?:(.+)$/.exec(s.node.key)?.[1];
    const rare = kind !== undefined ? RARE_KINDS.has(kind) && !used.has(kind) : RARE_SECTIONS[s.node.key] !== undefined && !RARE_SECTIONS[s.node.key].test(raw);
    if (!rare) return true;
    skipped.add(s.node.key);
    left.push(kind !== undefined ? `"${kind}"` : s.node.title);
    return false;
  });
  return { text: `${kept.map(sectionText).join('\n\n')}\n`, left };
}

/* -- Der Auftrag für ein Sprachmodell ------------------------------------------------------ */

/**
 * WAS MAN IN DIE EIGENE KI KOPIERT (die App ruft keine KI auf): der Auftrag, die
 * Beschreibung des Formats und — als Vorlage — der Export eines anderen Bereichs
 * (des letzten Wydarzenie) oder der dieses Bereichs.
 */
export function areaPrompt(input: {
  readonly areaName: string;
  readonly kind: ProfileKind | null;
  /** Ein anderer Bereich als Vorlage (das letzte Wydarzenie). */
  readonly template: { readonly name: string; readonly doc: unknown } | null;
  /** Dieser Bereich, wie er gerade ist. */
  readonly current: unknown | null;
  /** Die ganze Beschreibung — sonst ohne die langen, seltenen Abschnitte, die kein Vorbild braucht. */
  readonly full?: boolean;
}): string {
  const short = input.full === true ? null : areaDescriptionShort([input.template?.doc ?? null, input.current].filter((d) => d !== null));
  const what = input.kind === null ? '' : ` (rodzaj: ${kindLabel(input.kind).toLowerCase()})`;
  const task = input.template !== null
    ? `Na dole jest eksport obszaru „${input.template.name}” — poprzedniego wydarzenia. Zrób na jego wzór nowe: zachowaj układ stron, moduły, pytania formularzy, role, ich "key" i "id" modułów; zmień daty, tytuły, opisy i wszystko, co dotyczy nowego. Usuń to, co dotyczyło tylko poprzedniego (np. jego zdjęcia i materiały na stronie „po wydarzeniu”). "address" ustaw na nowy adres.`
    : input.current !== null
      ? 'Na dole jest obecny eksport tego obszaru. Zmień go według moich wskazówek — zachowaj wszystkie "key" i "id", żeby import zmienił to, co jest, zamiast dublować.'
      : 'Ułóż obszar od zera według moich wskazówek.';
  return [
    `Przygotuj jeden dokument JSON w formacie „${AREA_FORMAT}” (opis formatu jest niżej) dla obszaru „${input.areaName}”${what}.`,
    '',
    task,
    '',
    'Zasady:',
    '- Zwróć JEDEN obiekt JSON — bez komentarzy, bez tekstu przed nim i po nim.',
    '- Nie wpisuj danych osobowych (imion i nazwisk, telefonów, adresów e-mail konkretnych osób), chyba że podam je wprost do publikacji.',
    '- Nie wymyślaj faktów — dat, miejsc, cen, osób, zgód ani podstaw prawnych, których nie podałem. Czego nie wiesz, zostaw puste.',
    `- Zdjęcia i pliki, których jeszcze nie ma, opisz w "images" strony i wstaw "${NEED_PREFIX}klucz". "page-image:<id>" ze wzoru możesz zostawić — to ten sam plik.`,
    '- Formularz musi mieć "id"; odpowiedzi trafiają do tego obszaru, więc "answersTo" pomiń.',
    '',
    'Moje wskazówki: (uzupełnij — daty, miejsce, co ma być inaczej)',
    '',
    ...(short === null || short.left.length === 0 ? [] : [
      `Opis formatu jest skrócony — bez rzadkich modułów i rozdziałów (${short.left.join(', ')}). Jeśli któregoś potrzebujesz, napisz o tym — dostaniesz pełny opis.`,
      ''
    ]),
    '=== OPIS FORMATU ===',
    short === null ? areaDescription() : short.text,
    ...(input.template !== null
      ? ['=== WZÓR: POPRZEDNIE WYDARZENIE ===', pretty(input.template.doc)]
      : input.current !== null ? ['=== OBECNY OBSZAR ===', pretty(input.current)] : [])
  ].join('\n');
}
