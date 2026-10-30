/**
 * 2026-10-24 — DAS FORMULAR IM BAUM DER JSON-FORMATE (`core/jsonTree.ts`):
 * was ein Formular-Modul im Dokument trägt — Fragen, Aufbau und Logik,
 * Wymagania, Rollen, Obszary osób, Gruppe, Wiederholung. EIN Knoten: die Seite
 * (jeder Eintrag "form") und das Modul ("recreatio/module") tragen ihn, und
 * beide Importe tun damit dasselbe (`modules/moduleImport.ts`).
 */

import { keyLines, pretty, textNode, type JsonNode, type JsonSample } from '../core/jsonTree';
import { QUESTION_EXAMPLE, QUESTION_KEYS } from './formJson';
import { choiceOf, NEEDS } from './needs';
import { NEEDS_EXAMPLE, needsKeys } from './needsJson';
import { MODULE_FORMAT } from '../pages/pageJson';

/** Was ausser Fragen und Aufbau nur ein Formular trägt — ein Satz je Schlüssel. */
const FORM_MODULE_LINES = `  "needs" — wymagania formularza: niepełnoletni, zdrowie, ubezpieczenie, zasady — każde z ustawieniami (niżej: Wymagania formularza)
  "extends", "audience" — tylko w rozszerzeniu (podformularzu): który formularz rozszerza i kto je wypełnia ("person" — osoba przez swój link, "office" — tylko koordynator). "extends" to tylko informacja; "audience" import zmienia, dopóki podformularz nie ma żadnego wpisu
  "group" — grupa formularzy (folder), w której stoi: jej nazwa; null — bez grupy. Import przenosi formularz do grupy o tej nazwie (jeśli jej nie ma — zakłada ją). Dla wypełniających nic się nie zmienia
  "repeat" — tylko w rozszerzeniu: jak często każda osoba z listy dostaje wpis — "once" (raz), "day", "week", "month", "year". Import zmienia to, dopóki rozszerzenie nie ma żadnego wpisu
  "memberRoles" — role uczestników: lista identyfikatorów ról, które dostaje każdy, kto wyśle formularz (dostęp do ich obszarów, stron, kalendarzy, rozmów); pusta lista — żadna. Import ustawia je tylko, jeśli masz te role; kto już do roli należy, zostaje. Obecne zgłoszenia przenosi się w module („Przenieś obecne zgłoszenia"). Starszy zapis "memberRole" (jedna rola albo null) też jest czytany
  "virtualAreas" — obszary osób: lista reguł; każda osoba, która wyśle formularz, dostaje według każdej reguły własny obszar (rozmowa, terminy, zadania tylko dla niej). Reguła: { "name": nazwa, "submitter": co robi osoba — "write" (pisze), "read" (czyta), "none" (nie widzi: obszar tylko dla prowadzących), "roles": [{ "role": identyfikator roli, "level": "read" | "write" | "admin" (prowadzi) }] } — każda z tych ról widzi taki obszar każdej osoby. Import zakłada reguły, których nazwy jeszcze nie ma, zmienia "submitter" i dodaje role, które masz; niczego nie usuwa`;

/**
 * EIN GANZES FORMULAR mit allen Möglichkeiten für Minderjährige — zum
 * Einsetzen in den Import eines Moduls oder einer Seite (dort kommt es als
 * neues Modul dazu). Die Fragen der Wymagania stehen NICHT darin: der Import
 * legt sie an.
 */
export const minorFormSample = (age: 'birth' | 'ask'): Record<string, unknown> => ({
  format: MODULE_FORMAT,
  version: 1,
  kind: 'form',
  name: 'Zapisy na wyjazd',
  config: { title: 'Zapisy na wyjazd', sentTitle: 'Dziękujemy za zgłoszenie!' },
  questions: [
    { id: 'q1', kind: 'email', label: 'E-mail do kontaktu', help: null, options: [], required: true, halfWidth: true, identity: 'email', selfEdit: true },
    { id: 'q2', kind: 'phone', label: 'Telefon', help: null, options: [], required: false, halfWidth: true, identity: 'phone', selfEdit: true }
  ],
  needs: [{ id: 'minor', age, ways: ['parent', 'adult', 'consent'] }, 'health', 'rules']
});

const SAMPLES: readonly JsonSample[] = [
  { label: 'formularz z niepełnoletnimi — data urodzenia, wszystkie możliwości', doc: () => minorFormSample('birth') },
  { label: 'formularz z niepełnoletnimi — tylko „czy niepełnoletni”, wszystkie możliwości', doc: () => minorFormSample('ask') }
];

/** Die Wymagania im Dokument — erzeugt aus den Wymagania selbst (`needs.ts`). */
export const NEEDS_FORMAT: JsonNode = {
  key: 'form.needs',
  title: 'Wymagania formularza ("needs")',
  text: () => [
    'Wymagania to gotowe części formularza na to, czego wymaga wydarzenie. Włączone wymaganie dodaje swoje pytania, grupy i logikę (to, o co formularz już pyta — imię, nazwisko, data urodzenia — wykorzystuje); dopóki jest włączone, jego pytań i logiki nie da się usunąć, a pytania można przesuwać i przeredagować.',
    'Co robi import:',
    '- Wymaganie, którego formularz nie ma, zostaje włączone z podanymi ustawieniami.',
    '- Włączone z innymi ustawieniami zostaje przestawione: co potrzebne w obu, zostaje z odpowiedziami na swoim miejscu; pytania, których nowe ustawienia nie potrzebują, znikają (te z odpowiedziami — tylko zdjęte z formularza; odpowiedzi zostają w zgłoszeniach).',
    '- Z "holds" (z eksportu) import przejmuje pytania, grupy i logikę z dokumentu, zamiast dodawać je drugi raz — tak formularz przenosi się na inną stronę albo do kolejnej edycji.',
    '- Włączone wymagania, których nie ma w dokumencie, zostają — wyłącza je dopiero „Usuń pytania i wymagania, których nie ma w dokumencie”.',
    keyLines(needsKeys()),
    'Wymagania (z ustawieniami, które proponuje import bez nich):',
    NEEDS.map((n) => `  "${n.id}" — ${n.label}: ${n.use(choiceOf(n, undefined))}`).join('\n'),
    'Niepełnoletni: kto przychodzi z rodzicem — nic więcej; z pełnoletnim opiekunem — tylko jego imię i nazwisko; samodzielnie — imię i nazwisko rodzica, jego telefon i zgoda: formularz pokazuje jej treść bez pola do zaznaczenia, a na końcu (i po wysłaniu) „Drukuj zgodę do podpisu” ("paper": "sign" w "config"). Gdy otwarta jest tylko jedna możliwość, nikt nie wybiera — ona obowiązuje (np. wyjazd tylko dla dzieci: "ways": ["consent"]).',
    'Przykład:',
    pretty(NEEDS_EXAMPLE),
    'Przykład całego formularza (dokument modułu) ze wszystkimi możliwościami dla niepełnoletnich:',
    pretty(minorFormSample('birth'))
  ].join('\n'),
  samples: () => SAMPLES
};

/*
   2026-10-30 — WAS DIE APP MIT EINEM FORMULAR TUT, sobald es importiert ist: wo man es ausfüllt
   (`FormCard.tsx`, `Widget.tsx`, `Form.Submit.cs`), wer geradesteht (`Form.cs` → `Controllers`, `clause.ts`,
   `SignSheet.tsx`), wer die Antworten öffnet (`Form.Office.cs`, `intake.ts`, `entrySubject.tsx`), die Glocke
   (`Notify.cs`, `Push.cs`), der eigene Link (`Seat*.cs`, `parts/seat.tsx`), Rollen und Obszary osób
   (`Form.Members.cs`, `Form.Virtual.cs`, `useFormOffice.tsx`), Kroki (`steps/steps.ts`), die Karte der Seite
   (`pageLogic.ts`), Rozmowy (`Audience.cs`, `Chat.Ask.cs`) — und was der Import nicht anfasst (`moduleWish.ts`).
*/
const FORM_USAGE: JsonNode = textNode('form.usage', 'Jak aplikacja używa tych danych', () => `- Formularz wypełnia się bez konta na stronie, na której stoi (także w widżecie); podformularz — tylko przez osobisty link albo tylko kancelaria ("audience"). Ten sam formularz na kilku stronach zbiera jedną listę zgłoszeń.
- Pytania przeczyta każdy, gdy obszar, w którym leżą, jest jawny; inaczej tylko ci, którzy go czytają (konto albo link).
- Zgłoszenia przyjmuje tylko wtedy, gdy obszar formularza (albo obszar nad nim) ma administratora danych — jego klauzula stoi nad pytaniami i na wydruku do podpisu.
- Odpowiedzi szyfruje przeglądarka wypełniającego; serwer ich nie czyta. Otwierają je koordynatorzy formularza: zakładki „Zgłoszenia” i „Tabela”, moduły strony „Lista osób” i „Panel osoby”. Kto tylko prowadzi stronę, widzi, że zgłoszenia są — bez ich treści.
- Nowe zgłoszenie stoi w dzwonku osób, które czytają obszar formularza (także jako powiadomienie).
- Kto wyśle formularz, dostaje własny link (widzi go raz; kancelaria może mu go wysłać SMS-em). Pod nim widzi swoje odpowiedzi i poprawia te z "selfEdit", uzupełnia podformularze z "audience": "person", odhacza swoje kroki i pisze w rozmowach.
- Przez ten link działają "memberRoles" i "virtualAreas": osoba od razu należy do ról, a klucze ról i obszary osób rozdaje bez klikania przeglądarka kancelarii albo prowadzącego (gdy otworzy formularz albo dzwonek).
- Podformularz daje osobie krok „Uzupełnij: …” (podformularz kancelarii — krok widoczny tylko dla niej). Ze zgłoszeń korzystają też kroki (zakładka „Kroki”), mapa logiki strony ("registered", "confirmed", "answer", "mark"), rozmowy połączone z formularzem i „Napisz do nas”.
- Import nie otwiera ani nie zamyka zapisów i nie zmienia kroków ani niczyich odpowiedzi.`);

/** Das Formular im Dokument — Fragen, Aufbau, und was nur ein Formular trägt. */
export const FORM_FORMAT: JsonNode = {
  key: 'form',
  title: 'Formularz (moduł "form")',
  text: () => `Wpis modułu "form" — na stronie i w dokumencie modułu — niesie oprócz nazwy i treści ("config") to, co należy do formularza: pytania, układ i logikę, wymagania, role uczestników, obszary osób, grupę. Strona i moduł importują je tak samo. Pytania są szyfrowane w przeglądarce kluczem obszaru formularza: eksport pokazuje tylko te, które da się otworzyć Twoimi kluczami (inne mają "label": null i przy imporcie zostają nietknięte). Import pieczętuje nowe i zmienione pytania tutaj, zanim trafią do usługi.
- Pytanie z "id" z eksportu jest zmieniane — jego odpowiedzi zostają.
- Pytanie bez "id" albo z własnym (np. "q1") powstaje nowe, na końcu; tej samej nazwy można użyć w "design".
- Pytań, których nie ma w dokumencie, import nie usuwa — chyba że zaznaczysz „Usuń pytania i wymagania, których nie ma w dokumencie”. Pytania z odpowiedziami usługa tylko zdejmie z formularza (ich odpowiedzi zostają), a pytań włączonych wymagań nie usunie.
- Kolejności istniejących pytań nie da się zmienić — kolejność na formularzu ustala "design.layout".
${keyLines(QUESTION_KEYS)}
${FORM_MODULE_LINES}
Przykład:
${pretty(QUESTION_EXAMPLE)}`,
  inside: () => [FORM_USAGE, NEEDS_FORMAT]
};
