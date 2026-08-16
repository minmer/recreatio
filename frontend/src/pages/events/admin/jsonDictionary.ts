import { PART_MODULES } from '../parts/registry';

/**
 * The brief you hand to a model so it can write a whole event as one JSON
 * document. The per-part sections are generated from the part registry — add a
 * part file and it documents itself here, so the dictionary cannot drift away
 * from what the importer actually accepts.
 */

const FIELD_KINDS = [
  'text — jedna linia',
  'textarea — wiele linii',
  'select — lista, jeden wybór (wymaga "options")',
  'multiselect — lista, wiele wyborów (wymaga "options")',
  'checkbox — pojedyncze potwierdzenie',
  'number — liczba',
  'date — data',
  'email — adres e-mail',
  'phone — telefon'
];

const ENVELOPE = `# Jak zbudować wydarzenie w formacie JSON

Zwróć JEDEN obiekt JSON, bez komentarzy i bez tekstu wokół niego.
Cały dokument opisuje jedno wydarzenie: dane do przeglądu wydarzeń,
strony i części, z których składa się każda strona.

## Obiekt główny

{
  "slug":         "adres-wydarzenia",        // wymagane; małe litery, cyfry, myślniki
  "title":        "Nazwa wydarzenia",        // wymagane
  "subtitle":     "Hasło na stronie",        // opcjonalne
  "summary":      "Zdanie na kafelku listy", // opcjonalne, do 400 znaków
  "category":     "Pielgrzymka rowerowa",    // grupa wydarzeń; po niej działa filtr
  "audience":     "Rowerzyści od 16 lat",    // dla kogo jest wydarzenie
  "places":       ["Kraków", "Częstochowa"], // główne miejsca, w kolejności trasy
  "thumbnailUrl": "https://…/foto.jpg",      // opcjonalne
  "startDate":    "2026-08-28",              // RRRR-MM-DD
  "endDate":      "2026-08-29",              // RRRR-MM-DD
  "dateLabel":    null,                      // zostaw null — wyliczy się z dat
  "theme":        { "mode": "dark",          // "dark" albo "light" — cała strona
                    "accent": "#4c7dd6", "ground": "#080d15",
                    "ink": "#eef2f8", "muted": "#a3b2c9" },
                    // tryb jasny: ground "#f4f6fa", ink "#16202e",
                    // muted "#5a6a80", accent "#2f5fb5"
  "pages":        [ … ]                      // patrz niżej
}

Wydarzenie po imporcie jest zawsze SZKICEM. Publikuje je człowiek, nie dokument.

## Strony

"pages" to lista stron. Dokładnie jedna z nich jest publiczna — ta z
"kind": "public". Jeśli żadna nie jest oznaczona, publiczna zostaje pierwsza.
Pozostałe są wewnętrzne: nie ma do nich odnośnika na stronie publicznej i
otwiera je tylko link osobisty, któremu organizator nada do nich dostęp.

{
  "kind":        "public",            // "public" albo "internal"
  "slug":        "start",
  "title":       "Rowerowa Częstochowa 2026",
  "menuLabel":   "Strona publiczna",  // etykieta w przełączniku stron
  "description": null,
  "parts":       [ … ]
}

Typowy układ: jedna strona publiczna z opisem i zapisami, do tego strony
wewnętrzne dla ról — np. "Uczestnicy", "Prowadzący trasę", "Organizatorzy".

## Części

Każda część to jeden ekran strony. Wspólne pola:

{
  "kind":      "plan",        // typ części; lista niżej
  "menuLabel": "Plan",        // etykieta w menu sekcji
  "title":     "Plan dnia",   // nagłówek nad treścią; dla "title" zostaw null
  "intro":     "Krótkie wprowadzenie pod nagłówkiem.",
  "isVisible": true,
  "config":    { … },         // zawartość, inna dla każdego typu — patrz niżej
  "layers":    [ … ]          // opcjonalne; pominięte = sensowne domyślne
}

## Warstwy tła

"layers" to lista warstw od tyłu do przodu. Pomiń "layers", a dostaniesz
gradient plus duży napis z etykiety części — zwykle to wystarczy.

Dla "gradient" i "image" pole "speed" (0–1) to tempo paralaksy:
0 stoi w miejscu, 1 przesuwa się razem z treścią.

Dla "bigtext" pole "speed" znaczy co innego: to długość przejazdu napisu
przez ekran. Napis wędruje z dołu do góry; 1 = pełna wysokość ekranu.

[
  { "kind": "gradient", "speed": 0.12, "angle": 168,
    "from": "#12203a", "via": null, "to": "#060a12" },
  { "kind": "image", "speed": 0.34, "url": "https://…/tlo.jpg",
    "opacity": 0.45, "blend": "soft-light", "position": "center" },
  { "kind": "bigtext", "speed": 0.95, "lines": ["TRASA"], "opacity": 0.09 }
]

## Pola formularza

Część typu "form" ma dodatkowo listę "fields":

{
  "kind":         "text",
  "label":        "Imię i nazwisko",
  "helpText":     null,
  "options":      null,          // lista tekstów; tylko dla select i multiselect
  "isRequired":   true,
  "isHalfWidth":  false,
  "identityRole": "name"         // "none" | "name" | "contact"
}

Dostępne typy pól:
${FIELD_KINDS.map((entry) => `  - ${entry}`).join('\n')}

WAŻNE: dokładnie jedno pole w formularzu powinno mieć "identityRole": "name",
a najwyżej jedno "contact". To z nich bierze się imię i kontakt uczestnika, i
dzięki temu organizator może jednym kliknięciem nadać tej osobie link osobisty.
Bez pola "name" zgłoszenia są anonimowe.

## Części tylko za linkiem osobistym

Dwie części działają na danych samego czytelnika i mają sens wyłącznie na
stronie wewnętrznej, do której ktoś dostał link osobisty:

  - "registration" — pokazuje osobie jej własne zgłoszenie z formularza
    zapisów i pozwala je poprawić. Nie ma własnych pól; bierze je z formularza.
  - "card" — karta uczestnika: dane uzupełniające, zgoda rodzica dla osób
    niepełnoletnich i klauzula RODO.

W "card" o zakres pól decyduje "regime" — czym wydarzenie jest w świetle prawa:

  - "minimal"    — spotkanie, wydarzenie jednodniowe. Pytamy wyłącznie o imię,
                   nazwisko i datę urodzenia. Dla niepełnoletniego dochodzi
                   rodzic lub opiekun i jego telefon.
  - "trip"       — wyjazd, wycieczka, pielgrzymka (domyślne). Jak wyżej, plus
                   pytania „tak/nie” z opisem dopiero po odpowiedzi „tak”.
  - "wypoczynek" — dopiero to uruchamia PESEL, adresy i szczepienia, bo wynikają
                   ze wzoru karty kwalifikacyjnej. Nie wybieraj tego dla zwykłego
                   wyjazdu — zbierałbyś dane bez podstawy prawnej.

Osoba pełnoletnia podaje tylko imię, nazwisko i datę urodzenia — kontakt jest
już w zgłoszeniu z formularza i nie pytamy o niego drugi raz.

Zamiast otwartych pól o zdrowiu używa się listy "questions": pytanie, na które
odpowiada się „tak” albo „nie”, a pole opisu pojawia się dopiero po „tak”.

Na stronie publicznej obie części nie pokażą nic poza informacją, że wymagają
linku. W "card" zawsze uzupełnij "controllerName" i "retention" — bez nich
klauzula informacyjna jest niekompletna.

## Typy części i ich "config"`;

const CLOSING = `## Zasady

- Pisz po polsku, w tonie właściwym dla wydarzenia.
- Nie wymyślaj faktów: dat, cen, adresów ani nazwisk. Czego nie wiesz,
  zostaw jako null albo pomiń.
- Każda część ma sens sama w sobie — nie dziel jednego zdania na dwie części.
- Nieznany typ części albo pola zostanie pominięty przy imporcie,
  a import pokaże ostrzeżenie.`;

/** Builds the full brief, part sections included. */
export function buildJsonDictionary(): string {
  const partSections = PART_MODULES.map((module) => {
    const example = module.exampleConfigJson()
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');

    return `### "${module.kind}" — ${module.label}\n${module.description}\n\n"config":\n${example}`;
  }).join('\n\n');

  return `${ENVELOPE}\n\n${partSections}\n\n${CLOSING}\n`;
}

/** A complete, importable document — the shortest way to see the shape working. */
export function buildStarterJson(): string {
  return JSON.stringify(
    {
      slug: 'przyklad-2026',
      title: 'Przykładowe wydarzenie 2026',
      subtitle: 'Podtytuł wydarzenia',
      summary: 'Jedno zdanie, które zachęca do kliknięcia.',
      category: 'Pielgrzymka rowerowa',
      audience: 'Młodzież i dorośli',
      places: ['Kraków', 'Częstochowa'],
      thumbnailUrl: null,
      startDate: '2026-08-28',
      endDate: '2026-08-29',
      dateLabel: null,
      theme: { mode: 'dark', accent: '#4c7dd6', ground: '#080d15', ink: '#eef2f8', muted: '#a3b2c9' },
      pages: [
        {
          kind: 'public',
          slug: 'start',
          title: 'Przykładowe wydarzenie 2026',
          menuLabel: 'Strona publiczna',
          parts: [
            {
              kind: 'title',
              menuLabel: 'Start',
              title: null,
              config: {
                badge: '28–29.08.2026 · Kraków → Częstochowa',
                headline: 'Przykładowe wydarzenie',
                lede: 'Dwa dni w drodze.',
                paragraphs: ['Krótki opis wydarzenia.'],
                actions: [{ label: 'Zapisz się', href: '#zapisy', variant: 'cta' }],
                footnote: null
              }
            },
            {
              kind: 'form',
              menuLabel: 'Zapisy',
              title: 'Zapisy',
              intro: 'Wypełnij formularz, żeby zgłosić swój udział.',
              config: {
                submitLabel: 'Wyślij zgłoszenie',
                successMessage: 'Dziękujemy za zgłoszenie.',
                consentNote: 'Wysyłając formularz, zgadzasz się na kontakt organizacyjny.'
              },
              fields: [
                {
                  kind: 'text',
                  label: 'Imię i nazwisko',
                  isRequired: true,
                  isHalfWidth: true,
                  identityRole: 'name'
                },
                {
                  kind: 'phone',
                  label: 'Telefon',
                  isRequired: true,
                  isHalfWidth: true,
                  identityRole: 'contact'
                }
              ]
            }
          ]
        },
        {
          kind: 'internal',
          slug: 'prowadzacy',
          title: 'Prowadzący trasę',
          menuLabel: 'Prowadzący',
          description: 'Strona widoczna tylko dla osób z nadanym dostępem.',
          parts: [
            {
              kind: 'text',
              menuLabel: 'Zadania',
              title: 'Zadania na trasie',
              config: {
                paragraphs: ['Treść widoczna tylko dla prowadzących.'],
                bullets: [],
                note: null
              }
            }
          ]
        }
      ]
    },
    null,
    2
  );
}
