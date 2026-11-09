/**
 * 2026-10-28 — DIE FORMATE DER JSON-IMPORTE FÜR DEN MCP-SERVER (`backend/Api/Library/ImportFormats.json`).
 *
 * Ein Assistent, der Recreatio über MCP liest (AiMcp.cs), schreibt oft genau das, was danach importiert werden
 * soll: Einträge einer Bibliothek, ein Werk mit vollem Text, eine Baza wiedzy, eine Seite. Den Import macht der
 * Mensch in der App, mit Vorschau — der Dienst schreibt nichts. Damit der Assistent das Format nicht raten muss,
 * gibt `get_import_format` dieselben Beschreibungen heraus, die neben jedem Import stehen, erzeugt aus der App
 * selbst; dazu die Leitfäden für die KI und die fertigen Schemata (`templates/cogita/`).
 *
 * Nur, was ohne einen bestimmten Ort gilt. Was von einem Formular, einem Werk oder einem Text abhängt (die Liste
 * eines Formulars, der Text eines bestimmten Werks, Plan und Wygłoszenie eines Textes), steht unter `contextual`:
 * dort sagt die App die Beschreibung selbst, mit dem, was sie an der Stelle weiss.
 *
 *   node scripts/import-formats.mjs          schreibt die Datei neu
 *   node scripts/import-formats.mjs --check  sagt nur, ob sie stimmt (Exit 1, wenn nicht)
 */

import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const OUT = '../backend/Api/Library/ImportFormats.json';
const TEMPLATES = '../templates/cogita/';

/*
 * 2026-10-29 — DIE BEISPIELE für Beschreibungen, die in der App von ihrem Ort abhängen: ein Formular mit seinen
 * Fragen (die Liste der Zgłoszenia), ein Buch (seine Cytaty), ein Text (sein Plan). Fest — auch das Datum —, damit
 * die Datei bei jedem Lauf gleich ausfällt. Die App schreibt an der Stelle dieselbe Beschreibung mit dem echten.
 */
const SAMPLE_NOW = new Date('2026-11-02T12:00:00');
const sampleField = (fieldId, label, kind, options = []) => ({ fieldId, label, kind, options, help: null });
const SAMPLE_FORM = {
  formName: 'Zapisy na rekolekcje (przykład)',
  fields: [
    sampleField('f1', 'Imię', 'line'), sampleField('f2', 'Nazwisko', 'line'), sampleField('f3', 'Telefon', 'phone'),
    sampleField('f4', 'Data urodzenia', 'date'), sampleField('f5', 'Grupa', 'choice', ['młodzież', 'dorośli']), sampleField('f6', 'Zgoda na kontakt', 'checkbox')
  ],
  extensions: [{ moduleId: 'x1', name: 'Obecność', audience: 'office', repeat: 'week', fields: [sampleField('g1', 'Obecny', 'checkbox'), sampleField('g2', 'Uwagi', 'text')] }]
};
const SAMPLE_WORK = { id: 'work-1', key: 'ratzinger2007', kinds: ['work'], data: { title: 'Jezus z Nazaretu (przykład)' } };
const SAMPLE_TEXT = { id: 'text-1', kinds: ['text'], data: { title: 'Kazanie na XVII niedzielę (przykład)', body: '(Tu aplikacja wstawia treść tekstu, z którego ma powstać plan.)' } };

/** Die Beschreibungen, wie die App sie neben ihre Importe stellt. */
async function appTexts() {
  const out = await mkdtemp(join(tmpdir(), 'import-formats-'));
  try {
    const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
    const entry = join(out, 'entry.ts');
    await writeFile(entry, [
      `export { LITURGY_JSON } from '${app}library/liturgy/liturgyJson';`,
      `export { libraryDescription } from '${app}library/libraryJson';`,
      `export { workWithTextPrompt } from '${app}library/sourceImport';`,
      `export { sourceTextDescription } from '${app}library/sourceText';`,
      `export { courseDescription, formDescription } from '${app}cogita/json';`,
      `export { scriptoriumDescription } from '${app}scriptorium/scriptoriumJson';`,
      `export { pageDescription } from '${app}pages/pageJsonText';`,
      `export { areaDescription } from '${app}areas/areaJsonText';`,
      `export { describe } from '${app}core/jsonTree';`,
      `export { SCHEME_JSON, PLAN_JSON } from '${app}calendar/schemeJson';`,
      `export { registryDescription } from '${app}registry/postalJson';`,
      /* 2026-10-29 — was in der App von einem Formular, einem Buch, einem Text abhängt: mit einem Beispiel davon. */
      `export { moduleDescription } from '${app}pages/pageJsonText';`,
      `export { entriesDescription } from '${app}forms/entriesJson';`,
      `export { quotesDescription } from '${app}library/libraryQuotes';`,
      `export { planPrompt } from '${app}scriptorium/sermon';`,
      /* 2026-10-29 — JSON für jeden Teil: die Formate, die bis dahin fehlten. */
      `export { CONTACTS_JSON } from '${app}phone/contactsJson';`,
      `export { ROLES_JSON } from '${app}roles/rolesJson';`,
      `export { addressesDescription } from '${app}pages/addressesJson';`,
      `export { workspaceViewDescription } from '${app}workspace/viewJson';`,
      `export { personsDescription } from '${app}account/personsJson';`,
      `export { learnProgressDescription } from '${app}cogita/progressJson';`,
      `export { TASKS_JSON } from '${app}calendar/tasksJson';`,
      `export { BOOKINGS_JSON } from '${app}bookings/bookingsJson';`,
      `export { CHAT_JSON } from '${app}chat/chatJson';`,
      `export { LAMPS_JSON } from '${app}lamps/lampsJson';`,
      `export { CALENDAR_JSON } from '${app}calendar/calendarJson';`,
      `export { MASSES_JSON } from '${app}masses/massesJson';`,
      /* 0137 — Wspólnoty: der Baum der Einheiten mit Positionen, Personen und den fünf Schritten. */
      `export { communityDescription } from '${app}communities/communityJson';`,
      `export { EXAMPLES as COMMUNITY_EXAMPLES } from '${app}communities/communityExamples';`
    ].join('\n'));
    await build({
      entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error', jsx: 'automatic',
      loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
    });
    globalThis.BroadcastChannel = undefined;
    const m = await import(pathToFileURL(join(out, 'entry.js')).href);
    return {
      liturgy: m.describe(m.LITURGY_JSON),
      library: m.libraryDescription(),
      workWithText: m.workWithTextPrompt(),
      sourceText: m.sourceTextDescription(),
      knowledge: m.courseDescription(),
      forms: m.formDescription(),
      scriptorium: m.scriptoriumDescription(),
      page: m.pageDescription(),
      area: m.areaDescription(),
      scheme: m.describe(m.SCHEME_JSON),
      plan: m.describe(m.PLAN_JSON),
      registry: m.registryDescription(),
      form: m.moduleDescription('form'),
      entries: m.entriesDescription(SAMPLE_FORM, SAMPLE_NOW),
      quotes: m.quotesDescription(SAMPLE_WORK),
      textPlan: m.planPrompt(SAMPLE_TEXT),
      contacts: m.describe(m.CONTACTS_JSON),
      roles: m.describe(m.ROLES_JSON),
      addresses: m.addressesDescription(),
      workspaceView: m.workspaceViewDescription(),
      persons: m.personsDescription(),
      learnProgress: m.learnProgressDescription(),
      tasks: m.describe(m.TASKS_JSON),
      bookings: m.describe(m.BOOKINGS_JSON),
      chat: m.describe(m.CHAT_JSON),
      lamps: m.describe(m.LAMPS_JSON),
      calendar: m.describe(m.CALENDAR_JSON),
      masses: m.describe(m.MASSES_JSON),
      community: m.communityDescription(),
      communityExamples: m.COMMUNITY_EXAMPLES.map((e) => ({ key: e.key, label: e.label, text: `${JSON.stringify(e.doc(), null, 2)}\n` }))
    };
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

/**
 * IN TEILEN — die Seite allein sind über 250 000 Zeichen, und ein Werkzeug soll nicht mehr als ein paar tausend
 * Wörter auf einmal liefern. Geteilt wird an Überschriften (`#`…), ein zu grosser Abschnitt an Leerzeilen; das
 * Inhaltsverzeichnis (Überschriften bis `####`, die Arten der Module eingeschlossen) sagt, in welchem Teil was steht.
 */
export const PART_LIMIT = 24000;

const NL = '\n';

export function partsOf(text) {
  const lines = text.split('\r\n').join(NL).split(NL);
  const sections = [];
  let current = [];
  for (const line of lines) {
    if (/^#{1,4} /.test(line) && current.length > 0) { sections.push(current.join(NL)); current = []; }
    current.push(line);
  }
  if (current.length > 0) sections.push(current.join(NL));
  /*
   * Ein Abschnitt, der allein zu gross ist, an Leerzeilen — und ein Block ohne Leerzeile (die Animacja: über
   * 100 000 Zeichen Schlüssel) an Zeilen; jedes Stück danach sagt, wessen Fortsetzung es ist.
   */
  const byLines = (block, heading) => {
    const out = [];
    let chunk = '';
    for (const line of block.split(NL)) {
      const next = chunk === '' ? line : chunk + NL + line;
      if (next.length > PART_LIMIT && chunk !== '') { out.push(chunk); chunk = (heading === '' ? '' : `(ciąg dalszy: ${heading})${NL}`) + line; } else chunk = next;
    }
    if (chunk !== '') out.push(chunk);
    return out;
  };
  const pieces = [];
  for (const section of sections) {
    if (section.length <= PART_LIMIT) { pieces.push(section); continue; }
    const first = section.split(NL, 1)[0];
    const heading = /^#{1,4} /.test(first) ? first.replace(/^#+ /, '') : '';
    let chunk = '';
    for (const block of section.split(NL + NL).flatMap((one) => (one.length > PART_LIMIT ? byLines(one, heading) : [one]))) {
      const next = chunk === '' ? block : chunk + NL + NL + block;
      if (next.length > PART_LIMIT && chunk !== '') { pieces.push(chunk); chunk = block; } else chunk = next;
    }
    if (chunk !== '') pieces.push(chunk);
  }
  const parts = [];
  let part = '';
  for (const piece of pieces) {
    const next = part === '' ? piece : part + NL + NL + piece;
    if (next.length > PART_LIMIT && part !== '') { parts.push(part); part = piece; } else part = next;
  }
  if (part !== '') parts.push(part);
  const contents = [];
  parts.forEach((one, i) => {
    for (const line of one.split(NL)) {
      const m = /^(#{1,4}) (.+)$/.exec(line);
      if (m !== null) contents.push({ level: m[1].length, title: m[2].trim(), part: i + 1 });
    }
  });
  return { parts: parts.map((one) => one.trimEnd()), contents: parts.length > 1 ? contents : [] };
}

const IMPORT_NOTE = 'Import robi człowiek w aplikacji: wkleja albo wczytuje JSON, widzi listę zmian (z ostrzeżeniami) i dopiero wtedy zatwierdza. Niczego nie zapisuje się stąd.';

/** Die ganze Liste — in der Reihenfolge, in der sie der Assistent sieht. */
export async function formats() {
  const t = await appTexts();
  const file = async (name) => (await readFile(`${TEMPLATES}${name}`, 'utf8')).replace(/\r\n/g, '\n');
  const schemeOf = async (name) => {
    const text = await file(name);
    const doc = JSON.parse(text);
    return { name: doc.name ?? name, text };
  };
  const liturgyExample = await readFile('../templates/liturgy/complete-example.json', 'utf8');
  const liturgyWhere = 'Biblioteka → zbiór rodzaju Liturgia → zakładka „Import / eksport” → „JSON liturgii — eksport i import” (#/workspace/library/<id>/import); także przy każdym wpisie („Ten wpis jako JSON”). Bieżące dane zbioru dokładnie: get_liturgy_library.';
  const list = [
    { id: 'liturgy', group: 'Biblioteka — Liturgia', title: 'Liturgia — cały zbiór (dzieła, wydania, teksty, fragmenty, szablony, obchody, przypisania, reguły, profile)', what: 'Wszystkie dziewięć rodzajów wpisów Liturgii. Znane "id" zmienia w miejscu tylko podane pola (null czyści), nowe "id" dodaje, {"id", "remove": true} usuwa; wszystko sprawdzane razem i zapisywane naraz; nic poza tym nie jest usuwane.', where: liturgyWhere, text: t.liturgy },
    { id: 'example-liturgy', group: 'Biblioteka — Liturgia', title: 'Przykład całej biblioteki liturgicznej', what: 'Spójny, importowalny zbiór w formacie "liturgy": każdy rodzaj wpisu, wszystkie godziny i Msza, wspólny tekst z podziałem, antyfona, wydanie i profil. Teksty zmyślone.', where: liturgyWhere, text: liturgyExample },
    { id: 'library', group: 'Biblioteka', title: 'Biblioteka — wpisy (źródła, cytaty, osoby, muzyka)', what: 'Dzieła, cytaty, osoby, utwory i ich odwołania; nowe wpisy i zmiany istniejących.', where: 'Biblioteka → biblioteka → zakładka „Import / eksport” → „JSON biblioteki — eksport i import” (#/workspace/library/<id>/json); także pod każdą zakładką listy i przy każdym wpisie („Import / eksport JSON”).', text: t.library },
    { id: 'work-with-text', group: 'Biblioteka', title: 'Dzieło z pełnym tekstem', what: 'Nowe dzieło (książka, artykuł, rozdział) z autorami i CAŁYM tekstem podzielonym na części, z granicami stron. To polecenie aplikacja daje do skopiowania dla AI.', where: 'Biblioteka → biblioteka → zakładka „Źródła” → „Dzieło z tekstem (JSON)” → „Dzieło z pełnym tekstem — import JSON”.', text: t.workWithText },
    { id: 'source-text', group: 'Biblioteka', title: 'Tekst źródła — do istniejącego dzieła', what: 'Pełny tekst (albo kolejne części) dzieła, które już jest w Bibliotece: części, bloki, miejsca, strony, przypisy.', where: 'Biblioteka → biblioteka → „Źródła” → dzieło → ramka „Tekst źródła” → „Dodaj tekst (JSON)” albo „Dodaj lub zmień części (JSON)”. Aplikacja dopisuje tam klucz dzieła i jego sposób liczenia miejsc.', text: t.sourceText },
    { id: 'knowledge-base', group: 'Cogita', title: 'Baza wiedzy (Cogita) — rodzaje, wpisy, pytania, powtórki', what: 'Cała baza wiedzy albo jej część: rodzaje wpisów (schemat), wpisy, pytania, szablony kart, powtórki, ścieżki, widoki, ustawienia. Ten sam dokument może też zmieniać wpisy po identyfikatorze (tylko wymienione pola) i usuwać je ("remove": true) — podgląd wymienia każde usunięcie, wszystko w jednym zapisie.', where: 'Wiedza → baza wiedzy → „Więcej” → „Import i eksport (JSON)” (#/workspace/knowledge/<id>/json); sam schemat także w „Schematy → Rodzaje wpisów → Schemat jako JSON”.', text: t.knowledge },
    { id: 'knowledge-forms', group: 'Cogita', title: 'Formularze dodawania (Cogita)', what: 'Sposoby dodawania wpisów do bazy wiedzy: pola, wiersze, wartości wybierane raz dla wielu wierszy.', where: 'Wiedza → baza wiedzy → „Schematy” → „Sposoby dodawania” → „Formularz” → „Z JSON (wklej)…”, albo formularz → „Formularz jako JSON”.', text: t.forms },
    { id: 'scriptorium', group: 'Skryptorium', title: 'Skryptorium — własne teksty, wygłoszenia, projekty', what: 'Teksty (np. kazania z planem), ich wygłoszenia, projekty i rodzaje tekstów.', where: 'Skryptorium → skryptorium → zakładka „Import / eksport” → „JSON skryptorium — eksport i import” (#/workspace/scriptorium/<id>/json); także przy każdym wpisie.', text: t.scriptorium },
    { id: 'page', group: 'Strony', title: 'Strona (JSON strony)', what: 'Strona publiczna albo z dostępem: moduły w siatce, slajdy albo prezentacja, menu, wygląd, logika.', where: 'Strony → strona → „Edytuj” → „JSON strony — eksport i import” (#/workspace/pages/<ścieżka>).', text: t.page },
    { id: 'community', group: 'Obszary', title: 'Wspólnota — drzewo jednostek z pozycjami, osobami i ustawieniami (grupa, szkoła z klasami, Domowy Kościół, oaza, turnus, chór, grupa nauki)', what: 'Cała wspólnota naraz: jednostki (obszary pod obszarami), plany budowy podobnych jednostek, pozycje z prawami (prowadzenie, towarzyszenie, współpraca, członkostwo, uczestnictwo), osoby z miejscami (każda dostaje jeden osobisty link z wszystkimi swoimi rolami), ustawienia pięciu kroków (życie, podział, kto co robi, dołączanie, narzędzia i widoczność, strona publiczna). Ten sam dokument zmienia później to samo po kluczach: przeniesienia, nowe osoby, nowa obsada, „remove”.', where: 'Wspólnoty (#/workspace/wspolnoty) → „Nowa wspólnota z JSON”; istniejąca — wspólnota → zakładka „JSON” (#/workspace/wspolnoty/<id>/json). Przewodnik: „guide-community”, przykłady: „example-community-…”.', text: t.community },
    { id: 'area', group: 'Obszary', title: 'Obszar z rodzajem (wydarzenie, grupa, parafia, kurs, szkoła, klasa)', what: 'Wizytówka i narzędzia obszaru danego rodzaju, razem ze stronami.', where: 'Obszary → obszar → zakładka jego rodzaju („Wydarzenie”, „Grupa”, „Parafia / organizacja”, „Kurs”, „Szkoła”, „Klasa”) → „Import i eksport (JSON dla AI)” (#/workspace/areas/<id>/profil).', text: t.area },
    { id: 'calendar', group: 'Kalendarz', title: 'Terminy jednego kalendarza (pojedyncze, powtarzane, program, wartości schematu, dni serii)', what: 'Terminy kalendarza w wybranym okresie: tytuł, czas, powtarzanie (np. tygodniowy plan lekcji), miejsce, notatki, program (punkty), schemat i jego wartości, dni serii (odwołane, przesunięte, wartości dnia). Z "id" zmienia w miejscu, bez "id" dodaje; usuwa tylko z "remove": true. Intencje mszy — w formacie „masses”.', where: 'Kalendarz → „Kalendarze” → „Ustawienia” kalendarza → „Terminy jako JSON” → „JSON terminów — eksport i import” (czytający: „Kalendarze” → „Eksport JSON”).', text: t.calendar },
    { id: 'calendar-scheme', group: 'Kalendarz', title: 'Schemat terminów kalendarza', what: 'Pola, które mają terminy danego rodzaju (np. msza: intencja, celebrans), z regułami.', where: 'Kalendarz → „Kalendarze” → „Ustawienia” kalendarza → „Schematy terminów” → schemat → „JSON schematu — eksport i import”.', text: t.scheme },
    { id: 'calendar-plan', group: 'Kalendarz', title: 'Plan kalendarza', what: 'Plan, który rozkłada terminy (np. tygodniowy porządek mszy) z przepływem reguł.', where: 'Kalendarz → „Kalendarze” → „Ustawienia” kalendarza → „Plany” → plan → „JSON planu — eksport i import”.', text: t.plan },
    { id: 'tasks', group: 'Kalendarz', title: 'Zadania (okno czasu, odstęp po wykonaniu, okres; przypomnienia)', what: 'Zadania „Tylko ja” i grup: rodzaj, czas, powtarzanie, przypomnienia, notatka. Z "id" zmienia w miejscu, bez "id" dodaje, "remove": true archiwizuje; wykonań nie rusza.', where: 'Kalendarz → zakładka „Zadania” → „⋯” (Więcej: Zadania) → „Import i eksport (JSON)” (#/workspace/tasks).', text: t.tasks },
    { id: 'masses', group: 'Parafia', title: 'Msze, nabożeństwa i intencje (księga intencji)', what: 'Msze (pojedyncze i serie) z odprawiającymi i ich intencje na każdy dzień — np. przepisana księga intencji na miesiąc. Podgląd mówi, która msza dostaje którą intencję, i ostrzega o konfliktach; niczego nie usuwa (wycofanie to "status": "cancelled").', where: 'Msze i nabożeństwa → „Więcej” → „Import i eksport (JSON)” (#/workspace/masses).', text: t.masses },
    { id: 'bookings', group: 'Parafia', title: 'Rezerwacje — zasoby, ich zasady i terminy do wzięcia', what: 'Zasoby (osoba, pomieszczenie, dom, miejsce) z zasadami i terminami w ich kalendarzu. Rezerwacje ludzi są w eksporcie tylko do wglądu i nigdy nie są importowane; podgląd ostrzega o kolizjach z nimi.', where: 'Rezerwacje → „Więcej” → „Import i eksport (JSON)” (#/workspace/bookings); przy zasobie — tylko ten zasób.', text: t.bookings },
    { id: 'registry', group: 'Parafia', title: 'Kartoteka (adresy, domy, kolęda)', what: 'Adresy i miejsca kartoteki obszaru (dane domów są zapieczętowane w przeglądarce).', where: 'Kartoteka i kolęda → „Kartoteka obszaru” → zakładka „Import i JSON” → „Kartoteka jako JSON”.', text: t.registry },
    /* 2026-10-29 — was in der App an einem bestimmten Formular, Buch oder Text hängt: hier mit einem Beispiel davon. */
    { id: 'form', group: 'Formularze', title: 'Formularz (moduł „form”) — pytania, potrzeby, rozszerzenia, role', what: 'Jeden formularz: pytania i ich rodzaje, zgody, potrzeby, logika, rozszerzenia (np. obecność), grupy, role osób. Ten sam format stoi w „page” jako moduł; tu osobno.', where: 'Moduły → formularz → „JSON modułu — eksport i import”; na stronie: Strony → strona → moduł → „JSON tego modułu”; nowe formularze także w „page” i „area”.', text: t.form },
    { id: 'form-entries', group: 'Formularze', title: 'Lista osób formularza (zgłoszenia) — na przykładzie', what: 'Osoby zapisane w formularzu i wpisy koordynatora w rozszerzeniach (np. obecność co tydzień). Klucze odpowiedzi to pytania TEGO formularza — w aplikacji opis podaje je dla wybranego formularza; tu przykład z sześcioma pytaniami.', where: 'Formularze → formularz → zakładka „Zgłoszenia” → „JSON listy — eksport i import” (#/workspace/forms/<id>).', text: t.entries },
    { id: 'quotes', group: 'Biblioteka', title: 'Cytaty jednej książki — na przykładzie', what: 'Cytaty z książki (np. przepisane ze zdjęć stron): tekst, strona, co sprawdzić. W aplikacji opis podaje tytuł i klucz wybranej książki; tu przykład.', where: 'Biblioteka → książka (dzieło) → „Cytaty z tej książki” → „Import cytatów z JSON…”.', text: t.quotes },
    { id: 'contacts', group: 'Kontakty i konto', title: 'Kontakty (książka adresowa)', what: 'Kontakty: podpis, imię i nazwisko, firma, numery, adresy e-mail, grupy, data urodzenia, notatka. Z "id" zmienia w miejscu, bez "id" uzupełnia pasujący kontakt albo dodaje; nic nie usuwa.', where: 'Kontakty → „Więcej” → „Import i eksport (JSON)” (#/workspace/contacts); vCard zostaje dla telefonów i Google.', text: t.contacts },
    { id: 'roles', group: 'Kontakty i konto', title: 'Role konta (osoby, role, grupy, kto kogo trzyma)', what: 'Struktura ról konta: nowe role i grupy pod wskazanymi posiadaczami, zmiany nazw i rodzaju, nowe przynależności, które konto może nadać. Nigdy nie usuwa, nie tworzy osób ani kont.', where: 'Role → „Więcej” → „Import i eksport (JSON)” (#/workspace/roles).', text: t.roles },
    { id: 'chat', group: 'Rozmowy', title: 'Rozmowa (wiadomości, wątki)', what: 'Eksport rozmowy: wiadomości z autorami, wątki, odpowiedzi, załączniki (tylko nazwy). Import nigdy nie pisze w czyimś imieniu ani wstecz: nowe wątki, nowe wiadomości od importującego (oznaczone „Z importu”), przeniesienia do wątków, przypięcia.', where: 'Rozmowy → rozmowa → „⋮” (Więcej opcji rozmowy) → „Rozmowa jako JSON” (#/workspace/chat/<id>).', text: t.chat },
    { id: 'lamps', group: 'Lampy', title: 'Lampy BLE — urządzenia, sygnały, timery', what: 'Urządzenia Bluetooth LE z sygnałami, timery i tempo przycisków — kopia, przeniesienie na inne konto, timery przygotowane przez AI. Usuwa tylko z "remove": true.', where: 'Lampy → „⋯” (Więcej: lampy) → „Import i eksport (JSON)” (#/workspace/lamps).', text: t.lamps },
    { id: 'persons', group: 'Kontakty i konto', title: 'Moje dane (osoby konta)', what: 'Dane własnych osób konta: imię, nazwisko, telefon, data urodzenia, adres, e-mail, pseudonim. Zmienia tylko osoby tego konta, po "id"; pustą wartością nic nie usuwa (usunięcie cofa też udostępnienia).', where: 'Konto → „Moje dane” → „Moje dane jako JSON” (#/workspace/account).', text: t.persons },
    { id: 'workspace-view', group: 'Kontakty i konto', title: 'Powiadomienia: „Czeka na Ciebie” (kolejność i włączone rodzaje)', what: 'Które rodzaje spraw stoją w „Czeka na Ciebie” i w jakiej kolejności. Układ Teraz i obszarów jest stały — tego format nie zmienia.', where: 'Konto → „Powiadomienia” (#/workspace/account/widok) → „Powiadomienia jako JSON”.', text: t.workspaceView },
    { id: 'addresses', group: 'Strony', title: 'Adresy i domeny (aliasy, własne domeny)', what: 'Aliasy pod adresami, które konto prowadzi, i własne domeny przypięte do stron. DNS, hosting i lista źródeł usługi są poza aplikacją — podgląd mówi, co jeszcze zrobić.', where: 'Ustawienia → „Adresy i domeny” → „Import i eksport (JSON)” (#/workspace/addresses).', text: t.addresses },
    { id: 'learn-progress', group: 'Cogita', title: 'Moje postępy w bazie wiedzy (odpowiedzi)', what: 'Własne odpowiedzi w jednej bazie wiedzy — do zachowania, przeniesienia albo analizy. Import tylko do własnych postępów, jako nowa zapieczętowana paczka; istniejące odpowiedzi są pomijane.', where: 'Nauka → baza wiedzy → „Postępy” → „Moje postępy jako JSON” (#/workspace/learn/<baza>/postepy).', text: t.learnProgress },
    { id: 'text-plan', group: 'Skryptorium', title: 'Plan tekstu z jego treści — na przykładzie', what: 'Plan kazania albo innego tekstu Skryptorium: główne myśli po kolei, pod nimi cytaty, przykłady, pytania. W aplikacji polecenie zawiera treść tego tekstu; tu z miejscem na nią.', where: 'Skryptorium → tekst → „Plan z treści — przez AI we własnym czacie”.', text: t.textPlan },
    { id: 'guide-book', group: 'Przewodniki dla AI', title: 'Przewodnik: książka → Biblioteka i baza wiedzy', what: 'Jak z książki albo artykułu zrobić dzieło z pełnym tekstem, a potem bazę wiedzy z pytaniami (z gotowym schematem). Z dodatkami wygenerowanymi z aplikacji.', where: 'Plik templates/cogita/ksiazka-AI.md; importy jak w „work-with-text” i „knowledge-base”.', text: await file('ksiazka-AI.md') },
    { id: 'guide-argument', group: 'Przewodniki dla AI', title: 'Przewodnik: rekonstrukcja wywodu dzieła (Wywód)', what: 'Jak odtworzyć tok argumentacji dzieła krok po kroku, z odwołaniami do miejsc w tekście.', where: 'Plik templates/cogita/wywod-AI.md; import jako „knowledge-base” do bazy ze schematem „scheme-wywod”.', text: await file('wywod-AI.md') },
    /* 2026-11-01 — wie man ein Schema baut: was die App selbst rechnet (Bänder, Stapel, Prüfung) und was ein Schema erklärt (Reihenfolge, tests, asks, Bänder in Bedingungen). */
    { id: 'guide-schemes', group: 'Przewodniki dla AI', title: 'Przewodnik: jak budować schemat wiedzy', what: 'Co aplikacja liczy sama (pamięć karty, trzy pasma, stos powtórki, sprawdzanie odpowiedzi), a co opisuje schemat: kolejność nauki, "tests" (dla jakich wpisów karta jest dowodem), "asks" (karty o tym samym fakcie dzielą odpowiedzi), warunki pasmami w widokach i powtórkach — i jak zbudować bazę pod krajobraz wiedzy (jak liczy wysokości, tylko bezpośrednie wymagania, bez kół, temat = jeden krok, oś dziedzin z hierarchią, cel i zamek „najpierw powtórz” z warunkiem "rel": "chain", moduł strony, ostrzeżenia importu) oraz pole „W innych światach” ("external": true, odwołania "@@baza:@…" do innej bazy — oferta, nigdy wymaganie).', where: 'Plik templates/cogita/schematy-AI.md; import jako schemat: Wiedza → Schematy → „Schemat jako JSON”.', text: await file('schematy-AI.md') },
    /* 2026-11-01 — Teile einer Frage als Fakten: Paare, Sätze, Lücken, "fact", "share", "#strona". */
    { id: 'guide-parts', group: 'Przewodniki dla AI', title: 'Przewodnik: pytania z części (wspólne fakty)', what: 'Jak pisać pytania, których części (pary, zdania, luki, nazwane fakty) liczą się osobno i dzielą odpowiedzi między pytaniami i kartami szablonów: "show", "share", "fact", "#strona".', where: 'Plik templates/cogita/czesci-AI.md; import jako „knowledge-base” (pytania w "entities").', text: await file('czesci-AI.md') },
    /* 2026-11-03 — Übungen, die bei jedem Zeigen neu entstehen: Parameter, gezogene Einträge, Bedingungen, der Knoten "generate". */
    { id: 'guide-generators', group: 'Przewodniki dla AI', title: 'Przewodnik: ćwiczenia generowane (nowe przy każdym pokazaniu)', what: 'Jak opisać ćwiczenie raz, żeby przy każdym pokazaniu powstawała nowa wersja: "params" (liczby z zakresów, wartości z listy, wylosowane wpisy "entry"/"entries"), "let", "require", wartości w tekstach i wzorach, węzeł "generate" w szablonie ("texts", "only", wejścia karty "hints" i "solution"); co zaczyna historię karty od nowa; cztery wzory (fizyka z jednostkami, chemia z listy jonów, matematyka od końca, logika na datach), dystraktory, jednostki, normalizacja tekstu, sprawdzanie podglądem, typowe błędy.', where: 'Plik templates/cogita/generatory-AI.md; import jako „knowledge-base” (pytania w "entities", szablony w "templates"); wszystkie wzory razem: „example-generators”.', text: await file('generatory-AI.md') },
    /* 2026-11-03 (H) — eine Erzählung, die in Cogita zählt: Seite + Ablauf, echte Fragen, Tore, Gabel, Ścieżka, Einheit. */
    { id: 'guide-stories', group: 'Przewodniki dla AI', title: 'Przewodnik: opowieść, która liczy się w Cogicie', what: 'Jak zbudować kurs-opowieść: jedna jednostka (z polem „Wymaga” — tematy, które trzeba znać przed opowieścią) i jeden przebieg z "unit", "review" i "goals" (z własnym grafem albo jako strona-prezentacja: "look": "scenes", "presentation"); pytania jako prawdziwe pytania bazy ("question") albo z "about" — zawsze o tematach, nigdy o jednostce; laboratoria z celem; kolejność nauki jako ścieżka (moduł "path", "about" sceny); rozwidlenie, które się schodzi; bramki czytające znajomość; przegląd na końcu (licznik z nazwą opowieści, zero na początku, +1 przy dobrej odpowiedzi, warunek z powrotem, cel z tym samym warunkiem — dopiero zdany opuszcza jednostkę do doliny); przycisk opowieści (Zacznij / Kontynuuj opowieść, Powtórz przegląd) i ekran zamknięcia (czego brakuje, Ustaw jako cel, Najpierw powtórz (N)); inne światy (linki i zagłębienia do innej bazy wiedzy: "@@historia:@…", zawsze oferta); kolejność importu, odpis dla AI i typowe błędy.', where: 'Plik templates/cogita/opowiesci-AI.md; importy jako „knowledge-base” i „page”; kompletny przykład: „example-story” i „example-story-page”.', text: await file('opowiesci-AI.md') },
    /* 2026-11-09 — die Weltkarte: wie eine Baza wiedzy aussehen muss, damit Orte, Linien, Umsteigeorte und Fahrkarten lesbar sind. */
    { id: 'guide-world-map', group: 'Przewodniki dla AI', title: 'Przewodnik: mapa świata (miejsca, linie opowieści, węzły, bilety, poziomy)', what: 'Jak przygotować bazę wiedzy pod mapę świata (widok "landscape" z "style": "world"): jeden temat = jedno miejsce z 10–15 pytaniami, bloki z częściami tylko przez pole z "part": "up" (nigdy z "prerequisite"), tylko bezpośrednie wymagania, opowieść = linia (skąd przystanki, początek, zagłębienia jako pętle), rozwidlenia jako węzły przesiadkowe, bilety tylko z „Wymaga”, warunku opcji i kroku "condition", karty bez slajdu, bez położeń w imporcie, poziomy zdobywania ("levelsSetup") i lista kontrolna jak lista dla autorów; postać mapy świata w get_knowledge_setup ([x, y]).', where: 'Plik templates/cogita/weltkarte-AI.md; importy jako „knowledge-base” (widok, schemat z "part", przebiegi, "settings.levelsSetup").', text: await file('weltkarte-AI.md') }
  ];
  /* 0137 — wie ein Assistent eine ganze Wspólnota vorbereitet und später ändert, und je ein Beispiel. */
  list.push({
    id: 'guide-community', group: 'Przewodniki dla AI', title: 'Przewodnik: wspólnota (struktura → pozycje → osoby → treści)',
    what: 'Model (jednostka = obszar, pozycja = rola, osoba ≠ konto, link osobisty, para), macierz uprawnień (lead/accompany/cooperate/member/participant → read/write/admin, subunitsSee, grono) z tym, co sprawdza usługa, kalendarze, rozmowy i kanały (co tworzy dane ustawienie), strony i adresy (pagesBy — kto prowadzi adres; publikacja nie jest zatwierdzana technicznie), terminy publiczne bezpiecznie, co robi import (kolejność, powtórzenie, remove, przeniesienia), praca asystenta bez dostępu do instancji (pytania, walidacja, kroki w aplikacji, sprawdzenie po imporcie, drugi etap), wzorzec Domowy Kościół ze stanem wymagań, czego nie obiecywać.',
    where: 'Plik templates/communities/wspolnoty-AI.md; import jako „community”.',
    text: (await readFile('../templates/communities/wspolnoty-AI.md', 'utf8')).replace(/\r\n/g, '\n')
  });
  for (const e of t.communityExamples) {
    list.push({
      id: `example-community-${e.key}`, group: 'Przykłady', title: `Przykład wspólnoty: ${e.label}`,
      what: 'Kompletny dokument „community” do zaimportowania i zmiany — jedna z przykładowych konfiguracji (nie typ).',
      where: 'Wspólnoty → „Nowa wspólnota z JSON” (także „Wstaw przykład” przy imporcie).', text: e.text, whole: true
    });
  }
  /* 2026-11-03 — dazu: die vier Muster der Generatoren als ein Kurs, und die Welt des Wissens (Krajobraz + Generatoren). */
  const EXAMPLE_WHAT = {
    'example-atom': 'Mała, kompletna baza wiedzy (rodzaje, wpisy, pytania, powtórka) — wzór dokumentu w formacie „knowledge-base”.',
    'example-generators': 'Cztery wzory ćwiczeń generowanych z przewodnika „guide-generators” jako jeden kurs: prędkość z jednostkami, wzór i nazwa soli z listy jonów, równanie i logarytm liczone od końca, które wydarzenie było wcześniej i kolejność czterech — do zaimportowania i przećwiczenia.',
    'example-world': 'Świat wiedzy pod krajobraz: ok. 20 tematów z matematyki i fizyki i jeden z historii nauki, dziedziny z hierarchią, bezpośrednie wymagania, dwa generatory (pytanie z "params", szablon z węzłem "generate" i rozwiązaniem z wartościami), widok w trybie "landscape" i nagrody; strona do niego — „example-world-page”.',
    'example-story': 'Opowieść, która liczy się w Cogicie (przewodnik „guide-stories”): lekcja (jednostka), która wymaga tematu „Stany skupienia wody” (do tego czasu opowieść jest zamknięta), początek, rozwidlenie na trzy drogi i krok, który je łączy, trzy pytania (po jednym na drogę, "about" — tylko tematy), przebieg {"look": "scenes", "presentation", "unit", "review": "przeglad", "goals"} z przeglądem z tych samych trzech pytań (licznik „opowiesc.przeglad”, cel „przeglad” — dopiero zdany opuszcza lekcję do doliny), krajobraz lekcji i widok z warunkiem „przebieg ukończony”; strona do niej — „example-story-page”. Najpierw utwórz stronę (adres), wpisz go w "presentation", potem importuj.'
  };
  for (const [id, name] of [['scheme-fakty', 'fakty.json'], ['scheme-zbior', 'zbior.json'], ['scheme-wywod', 'wywod.json'], ['scheme-podstawy', 'podstawy.json'], ['scheme-pytania', 'pytania.json'], ['example-atom', 'przyklad-atom.json'], ['example-generators', 'przyklad-generatory.json'], ['example-world', 'przyklad-swiat.json'], ['example-story', 'przyklad-opowiesc.json']]) {
    const s = await schemeOf(name);
    list.push({
      id, group: id.startsWith('example') ? 'Przykłady' : 'Gotowe schematy baz wiedzy',
      title: `${id.startsWith('example') ? 'Przykład kursu' : 'Schemat'}: ${s.name}`,
      what: EXAMPLE_WHAT[id] ?? 'Gotowy schemat (rodzaje wpisów, szablony kart, sposoby dodawania, widoki) do zaimportowania w bazie wiedzy, zanim doda się wpisy.',
      where: `Plik templates/cogita/${name}; import w Wiedza → baza wiedzy → „Więcej” → „Import i eksport (JSON)”.`,
      text: s.text,
      /* Ein Dokument zum Importieren bleibt ganz — in Teilen liesse es sich nicht einfügen. */
      whole: true
    });
  }
  /* 2026-11-03 — die Seite zur Welt des Wissens: der Baustein „Widok" als Krajobraz und „Punkty i seria". */
  list.push({
    id: 'example-world-page', group: 'Przykłady', title: 'Przykład strony: Świat wiedzy (krajobraz i punkty)',
    what: 'Strona do kursu „example-world”: moduł „Widok” w trybie "krajobraz" (krajobraz wiedzy odwiedzającego, z nagrodami kursu w trakcie nauki), „Punkty i seria” i krótki tekst. Po zaimportowaniu kursu wstaw w "library" identyfikator bazy wiedzy, w "view" — identyfikator widoku „Krajobraz wiedzy”, a w "rewards" — identyfikator nagród „Punkty świata wiedzy” (albo wybierz je w edytorze strony); "answers" puste — odpowiedzi idą tam, gdzie każe baza wiedzy.',
    where: 'Plik templates/cogita/przyklad-swiat-strona.json; import w Strony → strona → „Edytuj” → „JSON strony — eksport i import” (format „page”).',
    text: await file('przyklad-swiat-strona.json'),
    whole: true
  });
  /* 2026-11-03 (H) — die Seite zur Erzählung: Szenen, Knöpfe, echte Fragen, Tore, die Ścieżka. */
  list.push({
    id: 'example-story-page', group: 'Przykłady', title: 'Przykład strony: opowieść „Skąd się bierze deszcz” (prezentacja ze ścieżką)',
    what: 'Prezentacja do kursu „example-story”: sceny start, wstęp, rozwidlenie z trzema przyciskami, trzy drogi z prawdziwymi pytaniami bazy ("question": "@opowiesc/q/…"), miejsce spotkania, przegląd (te same trzy pytania: wartość „opowiesc.przeglad” w "story.values", bramki zero / +1 / wynik ≥ 3, scena „Jeszcze nie” z „Spróbuj jeszcze raz” i „Zakończ na razie”) i koniec; bramki czytające znajomość (wstęp pomijany, gdy temat poznany; powrót do rozwidlenia, dopóki wszystkie trzy drogi nie są poznane), "about" scen wstępu i spotkania oraz moduł "path" ze ścieżką opowieści. Wstaw id bazy w "story.base" i "library" modułu "path", a id przebiegu w jego "flow".',
    where: 'Plik templates/cogita/przyklad-opowiesc-strona.json; import w Strony → strona → „Edytuj” → „JSON strony — eksport i import” (format „page”).',
    text: await file('przyklad-opowiesc-strona.json'),
    whole: true
  });
  const contextual = [
    { title: 'Tekst konkretnego dzieła', where: 'Biblioteka → dzieło → „Tekst źródła” → „Dodaj tekst (JSON)”.', why: 'Polecenie zawiera klucz i sposób liczenia miejsc tego dzieła; ogólny format to „source-text”.' },
    { title: 'Wygłoszenie z nagrania albo zapisu (Skryptorium)', where: 'Skryptorium → wygłoszenie → „Z nagrania albo zapisu — przez AI we własnym czacie”.', why: 'Polecenie zawiera plan wygłoszonego tekstu z identyfikatorami jego punktów; zwracany dokument ma format „scriptorium”.' },
    { title: 'Moduł strony innego rodzaju niż formularz', where: 'Strony → strona → moduł → „JSON tego modułu”; Moduły → „JSON modułu”.', why: 'Format każdego rodzaju modułu jest częścią „page” (spis treści jej pierwszej części wskazuje, gdzie który).' }
  ];
  const formats = list.map(({ text, whole, ...rest }) => ({ ...rest, size: text.length, ...(whole === true ? { parts: [text.trimEnd()], contents: [] } : partsOf(text)) }));
  return { about: `Formaty JSON importów Recreatio, wygenerowane z aplikacji (frontend/scripts/import-formats.mjs). ${IMPORT_NOTE}`, formats, contextual };
}

export const render = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const next = render(await formats());
  let had = '';
  try { had = (await readFile(OUT, 'utf8')).replace(/\r\n/g, '\n'); } catch { had = ''; }
  if (process.argv.includes('--check')) {
    console.log(next === had ? 'Formaty importu dla MCP stimmen.' : 'ImportFormats.json weicht von der App ab — node scripts/import-formats.mjs');
    process.exit(next === had ? 0 : 1);
  }
  await writeFile(OUT, next);
  const sizes = JSON.parse(next).formats.map((f) => `${f.id} ${Math.round(f.size / 1024)}k/${f.parts.length}`).join(', ');
  console.log(`${next === had ? 'War schon aktuell' : 'Neu geschrieben'}: ${OUT} — ${sizes}`);
}
