# Recreatio — Library, Scriptorium, Knowledge bases (Cogita) and Pages

*A brief for an AI assistant. As of 2026-10-24: the target-architecture work (13 steps), the division into three
parts (P1–P5, commits `799a87da` … `453fc53f`) and the read-only AI link (0126).*

You are helping the owner of Recreatio (recreatio.pl), a platform for parishes and organisations. This document
says what the content model is now, how its JSON looks, and which rules hold, so you can discuss changes, prepare
data or write JSON for import. The app itself never calls an AI: the owner pastes your JSON into the app's JSON
import, reviews the plan and confirms. To let you **read** what is already written, the owner can give you a
read-only link to an area's Library, Scriptorium and knowledge bases (section 13).

- Sections 1–13 are an overview in English.
- The appendices are the app's own JSON descriptions, generated from the code (in Polish, like the user interface).
  They are the exact contract for import. Where this overview and an appendix disagree, the appendix wins.

---

## 1. Three parts for content, and pages

| part | its one job | holds | JSON format |
|---|---|---|---|
| **Library** (Biblioteka) | normalise every reference — the backbone of citation, nothing else | works (books, the Bible, articles, documents), quotes, persons as authors, media files | `recreatio/library` v3 (Appendix A) |
| **Scriptorium** (Skryptorium) | writing that uses the knowledge and cites the sources | texts (sermons, conferences, articles, page texts) with plan and body, deliveries (recordings), projects (series, books), the owner's **text types** | `recreatio/scriptorium` v1 (Appendix B) |
| **Knowledge base** (Baza wiedzy, Cogita, "Nauka") | knowledge: the owner's own schemas, their entries and links; learning | owner-written kinds and entries (places, persons as subjects, events, mysteries, comments …), questions, card templates, revisions, flows, views, add forms | `recreatio.cogita.course` / `.schema` / `.entities` / `.flow` (Appendix C) |
| **Page** (Strona) | what visitors see | a grid of modules, slides, or a presentation of scenes | `recreatio/page` (Appendix D: excerpts) |

- **References run in one direction.** The Scriptorium cites the Library and links to or embeds Cogita. Cogita
  cites the Library. The Library points only at other Library entries (a quote → its work, a work → its authors and
  its container). Backlinks show every direction.
- **Persons exist twice, on purpose.** A Library person is an author (a target for citations). A Cogita person is a
  described subject in an owner-written kind. A bridge is a reference field from the kind to Library persons.
- **A knowledge base reads sources** without copying them: libraries (references and card material), Scriptoria
  (texts and their text types) and other knowledge bases (reuse of kinds, entries, templates, revisions, flows).
- Everything is encrypted in the browser. The service stores sealed entries and never sees content in plaintext,
  except public pages — and the snapshots an owner explicitly opens to an AI with an AI link (section 13), which the
  service reads only while a request carries that link.

## 2. Who sees what — one rule

- **Visibility comes only from the area** (obszar) that holds a library, Scriptorium or base. Members of the area
  read it. If the area is public, everyone reads it. There is no per-entry publishing and there are no private
  fields.
- At most **one library and one Scriptorium per area**; an area may hold several knowledge bases.
- Something meant to stay private goes into a container of a private area. **Moving an entry** to another
  container of the same part re-seals it under the same id. **A text is made public by moving it to the Scriptorium
  of a public area.**
- **A knowledge base in a public area** is public only after someone who writes in it opens it explicitly
  (Ustawienia → Kto czyta).
- **Pages** take their visibility from the areas they are bound to: none bound means public, bound means "needs
  access". A public page is plaintext; an access-only page can be sealed.
- **References never leak.** A reader who cannot open what a reference points at sees `[odwołanie niedostępne]`,
  nothing about the target.

## 3. Ids in markup; keys are only a writing aid

Texts (a body, plan points, the paragraphs of a statement, markup fields) use one simple markup, read by one parser
(described in Appendix A, "Zapis treści", and Appendix B):

| written | meaning | shown as |
|---|---|---|
| `[@ratzinger2007, s. 23]` | cite a **source** (work, quote, person) with a place | a footnote |
| `[[own words\|@entry]]` | link to an **own** entry (a text, a statement, a base entry, a word of a dictionary) | a link; own entries are never footnotes |
| `[@text-key]` | a link with the entry's title | link "(zob. …)" |
| `![@quote-or-statement]` | embed a quote or a statement as a block | the block (a statement with its tables) |
| `![@view-id]` | embed a live **view** of a knowledge base, e.g. in a plan point | the list the view selects now |

- In JSON you may write **keys** (`@ratzinger2007`) or ids. On import, keys are resolved. In storage the text holds
  ids, so renaming a key never breaks a citation.

## 4. Statements: any kind with a `blocks` field

- There is **no built-in statement kind** any more (no "Wiedza", no library "comment"). A **statement** is any entry
  whose kind has a field of the type **`blocks`** ("Treść w blokach"): `paragraph` (markup), `ordered` and
  `unordered` lists, `table`; list items and table cells are runs `{ "text": … }` or `{ "ref": "@id", "locator":
  "Łk 1,35" }` — real references with a place.
- The ready kind is **"Komentarz"** from the file `templates/cogita/komentarz.json`: `about` "O czym" (references
  with a place, several, to any kind in any store) and `content` "Treść" (`blocks`), with the card templates "Teza"
  and "Tabela z treści". The owner imports the file under Schemat → JSON.
- Computed, never stored:
  - **thesis** = the first sentence of the first paragraph of the first `blocks` field (at most 200 characters); it
    names the entry and is the front of a card;
  - **question** = a statement whose thesis ends with "?"; it is answered as soon as another statement points at it;
  - **Informacja / Interpretacja** comes from references only: only Library sources → information; another statement
    (or no source) → interpretation. A table alone no longer makes an interpretation.
- Card steps `statement.thesis`, `statement.part`, `statement.table`, `statement.subjects` work on any statement kind
  (Appendix C).

## 5. No topics — order comes from the owner's kinds

- There is **no topic mechanism at all**: no `topic` kind, no aspects, no "Perspektywy", no `topics` fields, no
  revision source "Temat". Order and classification come from **own kinds** linked by **reference fields** — e.g.
  "Tajemnica" (20 mysteries with "numer" and "część" → "Część") and "Obszar" (12 Marian areas with "grupa").
- **Views** (Appendix C, "views") select in steps (`source.kind`, `source.collection`, `source.list`, `source.from`,
  `follow`, `filter.rule`) and group by kind, by a field, or by an **axis**:

```json
{ "name": "Tajemnica × Obszar", "mode": "matrix",
  "steps": [ { "type": "source.kind", "config": { "kind": "text" } },
             { "type": "source.kind", "config": { "kind": "@komentarz" } } ],
  "matrix": { "rows": { "by": "axis", "kind": "@tajemnica", "sort": { "field": "numer" }, "group": "czesc" },
              "cols": { "by": "axis", "kind": "@obszar", "group": "grupa" } } }
```

- **An axis is a kind**: its entries are the values, ordered by a number field (`sort: {field}`) or by another
  entry's list (`sort: {list, field}`), under headings from a reference field (`group`). An entry belongs to a value
  if it points at it through a chosen reference field (`via`; empty: any), directly or one step further (`through`).
- The matrix shows every value of both axes, also empty ones, with headings over the columns and between the rows.
  On a page the module **"Widok"** shows it; a click on a cell opens what belongs to both, a click on an entry opens
  it.
- Old views and revisions that used topics show a notice ("tematów już nie ma …") instead of failing.

## 6. The Scriptorium: texts and the owner's text types

- **A text** has fixed core fields for every text (title, subtitle, project, status, date, occasion, place,
  readings, summary, plan, body, further, audio, video, target words) and, if it has one, the fields of its **text
  type**.
- **A text type** ("Rodzaj tekstu") is a name plus extra fields described exactly like the fields of a Cogita kind
  (the same schema editor). Example: "Kazanie maryjne" with `tajemnica` (ref → the Cogita kind "Tajemnica") and
  `obszar` (ref → "Obszar"). A text without a type is a plain text.
- **In Nauka a text type is a kind**: a sermon carries its type as a second kind, so the matrix "Tajemnica × Obszar"
  places sermons by their type fields next to comments.
- **A delivery** records one time a text was preached: per plan point said / short / skipped with times, what was
  added, a transcript. **A project** is a book or a series with an outline.
- **Pages**: `writing` (one text) and `writings` (the archive; its filters are the reference fields of the text
  types — "Tajemnica", "Obszar" — and the series). **Page texts rule**: longer writing lives in the Scriptorium;
  short layout copy (headlines, notices, hours) stays in page modules.

## 7. Schema connections

- **Reference with a place**: a `ref` field with `"locator": true`; each value is `{ "value": "@work", "locator":
  "Ps 110,1-7" }`. A Bible target shows the place with the edition's siglum ("Ps 110,1-7 (BT)"); the Bible text
  itself is not stored.
- **No built-in content schemas**: a base has only the kinds its owner writes or imports. Built in are only
  `question` (grading depends on it) and the kinds of the other parts (`person`, `work`, `quote`; `text`,
  `delivery`, `project`). **Ready schemas are files** in the repository: `templates/cogita/komentarz.json`,
  `slownik.json` (Język, Słowo, Tłumaczenie, Synonimy, Antonimy with "Słówka" templates), `psalterz.json` (psalms
  and canticles with their place in Scripture, the places of the breviary).
- **From a sermon**: "Powtórka z tego tekstu" creates a revision of what the sermon points at; "Z bazy wiedzy…" in the
  editor links a base entry (`[[dom|@house]]`) or embeds a view (`![@view]`).

## 8. One narrative: presentations as flows

- A **presentation page** carries its storyboard in `show.story`: values, gates (condition / set), questions with
  right / wrong exits, and optionally the base where answers count (Appendix D).
- A knowledge base lists the same story as a **flow that points at the page** (no copy):
  `{ "name": "Droga", "look": "scenes", "presentation": "parafia/droga", "narrators": […] }`. In Nauka it plays the
  presentation itself; answers, values and the place count in the base.
- **Narrators** are chosen by values; the first whose condition holds tells the step. The step type **`scene`**
  `{ page, scene, title }` names a scene of a presentation inside any flow.

## 9. Quantities and units

- A shared list of **quantity kinds and units** (a subset of QUDT: `Torque`, `Energy`, `Mass` …; units `N-M`,
  `KiloN`, `DEG_C` …, with factors to SI) — listed at the end of Appendix C.
- **A number field** may name `"quantity"`: a value is typed in any unit of that kind and stored as typed plus SI,
  `{ "value": 1.5, "unit": "KiloN", "si": 1500 }`.
- **A number question** with `"quantity"` compares in SI within that kind: "12 N·m" and "0,012 kN·m" are right for
  torque, "12 J" is wrong (an energy).

## 10. Rules to keep when proposing changes

1. Nobody gains access to anything they could not read before (check visibility changes, public endpoints,
   reference indexes).
2. Sealed content is handled only in the browser; the service never decrypts.
3. No direct writes to the production database; schema changes are numbered SQL migrations.
4. User data is deleted only by the owner, explicitly and confirmed: a whole container after typing its name, chosen
   entries in a list, "Stare wpisy". Old entries of removed kinds never break anything; they wait under "Stare
   wpisy".
5. Existing pages keep rendering; a module whose source has gone shows a clear notice instead of an error.
6. The JSON descriptions (the appendices) and the AI prompts stay in step with the code.

## 11. Open, and waiting for the owner

- **To run:** the migrations not yet applied (0123 from step 8, 0124 for the Scriptorium, 0125 for Thunderbird
  connections, 0126 for the AI link), then the API and website deploys; creating a Scriptorium in each area that writes; importing `komentarz.json` where comments are wanted;
  deleting the old test data with the new tools (libraries with texts, topics and comments; test bases).
- **Not built:** a delivery linked to a calendar item; recordings stored as files instead of URLs; a podcast feed;
  progress of a presentation made without an account is not taken over after signing in.
- **Units:** the labs `lab2d` and `physics` do not use the shared units yet; interactive drawings keep display units.

## 12. How to hand data to the app

- **Library**: Biblioteka → a library → "Import / eksport" (Appendix A). Only works, quotes and persons.
- **Scriptorium**: Skryptorium → a Scriptorium → "Import / eksport" (Appendix B): text types, texts, deliveries,
  projects.
- **Knowledge base**: Nauka → a base → JSON (Appendix C); a schema (kinds, templates, add forms) under Schemat →
  JSON. The JSON tab gives a ready prompt for an AI ("Przygotuj z tekstu — w swoim czacie z AI").
- **Page**: the page editor → JSON (Appendix D has the page structure, the page-texts rule, the presentation, and the
  modules of the three parts; the full page description covers every module kind and is too long to include).
- Return **one JSON object, without comments**. Use `@keys` to refer between entries of the same document.

## 13. Reading the owner's data: the AI link

If the owner gives you a link `https://api.recreatio.pl/ai/<secret>`, it is a read-only view of chosen collections
(Library, Scriptorium, knowledge bases) of **one** area — nothing else of that area, nothing of other areas, and no
way to change anything.

- `GET <link>` — the guide: the area, each collection with its entry count and the time its snapshot was made,
  how to ask, the markup notes. Start here.
- `GET <link>/search?q=<words>` — all words must occur (title, key, kind or content); case and Polish letters do not
  matter. Optional `part=books|writing|knowledge` (or a collection id), `kind=<kind or text type name>`,
  `limit=1..50`, `offset`. Without `q` it lists everything in order; follow `next`. The same as a path:
  `<link>/search/<words>`.
- `GET <link>/entry/<id or key>` — one entry: `data` (its fields, markup with citation keys), `schema` (what the
  fields mean), `refs` (what it points at, with titles) and `usedBy` (what points at it).
- `GET <link>/kinds` — every kind with the meaning of its fields; `GET <link>/openapi.json` — for tools that take
  an OpenAPI description (ChatGPT actions).
- Snapshots are rebuilt after changes, but may lag; quote titles and links (`url`) from the answers, and never
  invent entries. A reference to something outside the link is a bare id — say that it is not readable here.
- Writing still goes through the JSON import (section 12): the link reads, it never writes.

---

## Appendix A — Library JSON (generated by the app, `libraryDescription()`)

# Biblioteka jako JSON ("recreatio/library", wersja 3)

Co robi import:
Biblioteka to kręgosłup cytowania: trzyma TYLKO źródła — dzieła ("work"), cytaty ("quote") i osoby jako autorów ("person"); wpis biblioteki wskazuje tylko inne wpisy biblioteki (cytat → swoje dzieło, dzieło → autorzy, tłumacze, książka albo czasopismo, w którym jest). Własne teksty (kazania, konferencje, artykuły) są w Skryptorium (format "recreatio/scriptorium"), a wiedza — komentarze, postacie, miejsca, wydarzenia — w Nauce, jako własne rodzaje; oba te miejsca cytują stąd. Tematów nie ma.
- Każdy wpis to { "id", "kind", "key", "data" }. Wpis z kennung z eksportu (albo z kluczem istniejącego wpisu tego samego rodzaju) jest ZMIENIANY — tylko pola podane w "data"; pola, których nie ma, zostają. Żeby wyczyścić pole, podaj null.
- Wpis bez kennung (albo z nieznaną) powstaje nowy. Import niczego nie usuwa.
- Odwołania ("authors", "editors", "translators", "container", "work") mogą być kennungami albo kluczami: "@ratzinger2007". Klucze z tego samego dokumentu też działają — można opisać całą bibliotekę, nie znając żadnej kennung.
- Plik z innymi rodzajami (teksty, wygłoszenia, projekty, komentarze, tematy) zostanie odrzucony — z informacją, gdzie go zaimportować.
- "key" to klucz cytowania: krótki, bez spacji (np. "ratzinger2007"); w tekstach odwołuje się do niego [@ratzinger2007, s. 23]. Pominięty — zostanie zaproponowany sam.
- Liczby mogą mieć jednostkę ("384 s.", "20,5 cm"); pole wyboru przyjmuje wartość ("hard") albo jej nazwę ("Twarda").
- Cytaty z jednej książki (np. odczytane przez AI ze zdjęć) mają własny format "recreatio/quotes" — importuje się je na stronie tej książki.
- Kto widzi wpis, decyduje wyłącznie obszar jego biblioteki: członkowie obszaru, a gdy obszar jest publiczny — wszyscy. Nie ma pól prywatnych ani publikowania pojedynczych wpisów; to, co ma zostać prywatne, idzie do biblioteki prywatnego obszaru.
Zwróć JEDEN obiekt JSON, bez komentarzy.

{
  "format": "recreatio/library",
  "version": 3,
  "name": "Moja biblioteka",
  "entries": [ { "kind": "person", "key": "ratzinger", "data": { … } }, … ]
}

## Rodzaje wpisów
### "work" — Źródło
Dzieło, z którego się korzysta: książka, rozdział, artykuł, dokument Kościoła, Pismo Święte, strona. Ma klucz cytowania.
"data":
  "workType" — Rodzaj: Rodzaj: "book" (Książka), "chapter" (Rozdział w książce), "article" (Artykuł w czasopiśmie), "periodical" (Czasopismo), "document" (Dokument (Kościoła, urzędowy)), "bible" (Pismo Święte), "web" (Strona internetowa), "talk" (Wykład, kazanie, nagranie), "other" (Inne) (jedna z wartości)
  "title" — Tytuł: Tytuł dzieła (tekst)
  "subtitle" — Podtytuł: Podtytuł (albo rodzaj dokumentu, np. "adhortacja apostolska") (tekst)
  "originalTitle" — Tytuł oryginału: Tytuł oryginału (oryginalny tytuł przekładu) (tekst)
  "authors" — Autorzy: Autorzy — odwołania do osób, w kolejności (lista odwołań: kennungi albo "@klucze")
  "editors" — Redakcja: Redaktorzy — odwołania do osób (lista odwołań: kennungi albo "@klucze")
  "translators" — Tłumaczenie: Tłumacze — odwołania do osób (lista odwołań: kennungi albo "@klucze")
  "container" — W (książka, czasopismo): Dla rozdziału: książka; dla artykułu: czasopismo — odwołanie do źródła (odwołanie: kennung albo "@klucz")
  "volume" — Tom / rocznik: Tom (książka) albo rocznik (czasopismo) (tekst)
  "issue" — Numer: Numer czasopisma (tekst)
  "edition" — Wydanie: Które wydanie (tekst)
  "publisher" — Wydawca: Wydawnictwo (tekst)
  "place" — Miejsce wydania: Miejsce wydania (tekst)
  "year" — Rok: Rok wydania (albo data dokumentu) (tekst)
  "series" — Seria: Seria wydawnicza, z numerem tomu w serii (tekst)
  "pages" — Strony: Zakres stron rozdziału albo artykułu (tekst)
  "pageCount" — Liczba stron: Ile stron ma książka (liczba)
  "binding" — Oprawa: Oprawa: "soft" (Miękka), "soft-flaps" (Miękka ze skrzydełkami), "hard" (Twarda), "integrated" (Zintegrowana), "cloth" (Płócienna), "leather" (Skórzana), "spiral" (Spirala), "ebook" (E-book), "other" (Inna) (jedna z wartości)
  "height" — Wysokość (cm): Wysokość w centymetrach (liczba)
  "width" — Szerokość (cm): Szerokość w centymetrach (liczba)
  "length" — Grubość (cm): Trzeci wymiar — grubość (długość grzbietu w głąb) w centymetrach (liczba)
  "siglum" — Skrót przekładu: Dla Pisma Świętego: skrót przekładu, dopisywany do sigli (tekst)
  "isbn" — ISBN: Numer ISBN książki (z kreskami albo bez; kilka — po przecinku) (tekst)
  "libraryNumber" — Numer w bibliotece: Własny numer egzemplarza w tej bibliotece (numer inwentarzowy, sygnatura) — można po nim szukać i go zeskanować (tekst)
  "doi" — DOI: Identyfikator DOI publikacji (tekst)
  "url" — Adres: Adres w sieci (adres https://…)
  "accessed" — Dostęp: Kiedy strona była czytana (RRRR-MM-DD) (data RRRR-MM-DD)
  "language" — Język: Język (np. "pl", "la") (tekst)
Przykład:
{
  "kind": "work",
  "key": "ratzinger2007",
  "data": {
    "workType": "book",
    "title": "Jezus z Nazaretu",
    "subtitle": "Część 1: Od chrztu w Jordanie do Przemienienia",
    "originalTitle": "Jesus von Nazareth",
    "authors": [
      "@ratzinger"
    ],
    "volume": "1",
    "publisher": "Wydawnictwo M",
    "place": "Kraków",
    "year": "2007",
    "series": "Dzieła wybrane, t. 1",
    "pageCount": 384,
    "binding": "hard",
    "height": 24,
    "width": 16.5,
    "length": 3,
    "isbn": "978-83-7595-061-8",
    "libraryNumber": "B-0042"
  }
}

### "quote" — Cytat
Fragment ze źródła — z miejscem (strona, werset, numer) i opisem. Ma klucz cytowania.
"data":
  "text" — Tekst cytatu: Dokładne brzmienie cytatu (tekst (może mieć wiele wierszy))
  "work" — Źródło: Z jakiego źródła — odwołanie (odwołanie: kennung albo "@klucz")
  "locator" — Miejsce: Gdzie w źródle: "s. 23", "J 3,16", "nr 24" (tekst)
  "language" — Język: Język cytatu (np. "pl", "la") (tekst)
  "translation" — Przekład: Przekład cytatu (gdy tekst jest w innym języku) (tekst (może mieć wiele wierszy))
Przykład:
{
  "kind": "quote",
  "key": "ratzinger2007-1",
  "data": {
    "text": "Modlitwa jest rozmową z Bogiem, w której człowiek staje się sobą.",
    "work": "@ratzinger2007",
    "locator": "s. 168"
  }
}

### "person" — Osoba
Autor, redaktor, tłumacz — albo instytucja, która wydała dokument. Ma klucz cytowania.
"data":
  "personType" — Kto to: "person" — osoba, "organization" — instytucja (jedna z wartości)
  "name" — Jak się nazywa: Pełna nazwa, gdy nie dzieli się na imię i nazwisko (np. "Franciszek", "św. Augustyn", "Kongregacja Nauki Wiary") (tekst)
  "givenNames" — Imiona: Imiona — w przypisach skracane do inicjałów (tekst)
  "surname" — Nazwisko: Nazwisko — według niego układa się bibliografia (tekst)
  "years" — Lata: Lata życia albo działalności (tekst)
  "description" — Opis: Krótki opis osoby (biogram) — widoczny przy jej źródłach (tekst (może mieć wiele wierszy))
  "url" — Adres strony: Strona o tej osobie (np. biografia) (adres https://…)
Przykład:
{
  "kind": "person",
  "key": "ratzinger",
  "data": {
    "personType": "person",
    "givenNames": "Joseph",
    "surname": "Ratzinger",
    "years": "1927–2022",
    "description": "Papież Benedykt XVI."
  }
}

## Miejsce w źródle
Miejsce w Piśmie Świętym (odwołanie do dzieła z "workType": "bible" — w "locator" cytatu, w przypisie tekstu, w polu z miejscem w Nauce) pisz razem z księgą: Dz 1,14 · Dz 1,14-16 · Łk 1,26–2,5 · Dz 1,8.14 · Ps 23 · Mt 5,3-12; 6,1. Księgi mogą być po polsku (BT), łacinie (Nova Vulgata) albo angielsku (Acts 1:14) — aplikacja je rozpoznaje, porządkuje cytaty w kolejności Biblii i znajduje wszystko, co wskazuje na dany werset, we wszystkich przekładach.
Inne miejsca: "s. 23", "nr 24", "rozdz. 4".

---

## Appendix B — Scriptorium JSON (generated by the app, `scriptoriumDescription()`)

# Skryptorium jako JSON ("recreatio/scriptorium", wersja 1)

Co robi import:
Skryptorium to miejsce pisania: własne teksty ("text" — kazania, konferencje, rozważania, rozdziały), ich wygłoszenia ("delivery"), projekty ("project" — książka, cykl) i własne rodzaje tekstów ("texttype"). Tekst cytuje źródła z Biblioteki (dzieła, cytaty, osoby — format "recreatio/library") i wskazuje wpisy z Nauki (np. tajemnicę, słowo ze słownika, widok); w drugą stronę nic nie wskazuje na Skryptorium.
- Każdy wpis to { "id", "kind", "key", "data" }. Wpis z kennung z eksportu (albo z kluczem istniejącego wpisu tego samego rodzaju) jest ZMIENIANY — tylko pola podane w "data"; pola, których nie ma, zostają. Żeby wyczyścić pole, podaj null.
- Wpis bez kennung (albo z nieznaną) powstaje nowy. Import niczego nie usuwa.
- Odwołania mogą być kennungami albo kluczami: "@kazanie-chleb", "@ratzinger2007". Klucze z tego samego dokumentu też działają.
- Plik z dziełami, cytatami, osobami, komentarzami albo tematami zostanie odrzucony — z informacją, gdzie go zaimportować.
- Kto widzi wpis, decyduje wyłącznie obszar skryptorium: członkowie obszaru, a gdy obszar jest publiczny — wszyscy. Tekst staje się publiczny, gdy przeniesie się go do skryptorium obszaru publicznego (zachowuje kennungę).
Zwróć JEDEN obiekt JSON, bez komentarzy.

{
  "format": "recreatio/scriptorium",
  "version": 1,
  "name": "Moje skryptorium",
  "entries": [ { "kind": "texttype", "key": "kazanie-maryjne", "data": { … } }, { "kind": "text", "data": { … } }, … ]
}

## Rodzaje wpisów
### "text" — Tekst
Własny tekst — kazanie, rozważanie, rozdział książki — z odwołaniami do źródeł i cytatów. Ma klucz cytowania.
"data":
  "textType" — Rodzaj tekstu: Własny rodzaj tekstu — odwołanie (np. "@kazanie-maryjne"); jego dodatkowe pola stoją wtedy obok pól tekstu. Pominięty — zwykły tekst (odwołanie: kennung albo "@klucz")
  "title" — Tytuł: Tytuł (tekst)
  "subtitle" — Podtytuł: Podtytuł (tekst)
  "project" — Projekt (książka, cykl): Do jakiej książki albo cyklu należy — odwołanie (odwołanie: kennung albo "@klucz")
  "status" — Stan pracy: Stan pracy: "idea", "draft", "revision", "final" (jedna z wartości)
  "date" — Data wygłoszenia / napisania: Data (RRRR-MM-DD) — według niej układa się archiwum (data RRRR-MM-DD)
  "occasion" — Okazja: Okazja, dzień liturgiczny (tekst)
  "place" — Miejsce: Gdzie wygłoszony (tekst)
  "readings" — Czytania: Czytania, sigla biblijne (tekst)
  "summary" — Krótki opis: Krótki opis — w archiwum, nad treścią (tekst (może mieć wiele wierszy))
  "plan" — Plan: Plan — główne myśli po kolei, pod nimi cytaty, przykłady, pytania, zastosowania; lista punktów { "id", "text", "depth", "kind", "note" }. Wygłoszenia odwołują się do punktów po "id" (lista obiektów o polach:)
      "id" — Identyfikator: Stały identyfikator punktu (np. "p4k2x"); pominięty — nada się sam. Wygłoszenia wskazują punkty po nim (tekst)
      "text" — Treść: Myśl w jednym-dwóch zdaniach, w zapisie treści: [@klucz, s. 12] — źródło, sam ![@klucz-cytatu] — cytat z biblioteki (tekst w zapisie treści (niżej))
      "depth" — Poziom: 0 — główna myśl, 1 — pod nią, 2 — jeszcze głębiej (liczba)
      "kind" — Rodzaj: Rodzaj punktu: "thought" (Myśl), "quote" (Cytat), "example" (Przykład), "question" (Pytanie), "application" (Zastosowanie); pominięty — myśl (jedna z wartości)
  "body" — Treść: Treść w prostym zapisie (niżej: "Zapis treści") — z odwołaniami [@klucz, s. 12] (tekst w zapisie treści (niżej))
  "further" — Dalsze informacje: Dalsze informacje pod tekstem — w tym samym zapisie (tekst w zapisie treści (niżej))
  "audio" — Nagranie (adres): Adres nagrania audio (adres https://…)
  "video" — Wideo (adres): Adres nagrania wideo (adres https://…)
  "targetWords" — Docelowa liczba słów: Ile słów ma mieć (liczba)
Przykład:
{
  "kind": "text",
  "key": "kazanie-chleb",
  "data": {
    "textType": "@kazanie-maryjne",
    "title": "Chleb, który daje życie",
    "date": "2026-08-02",
    "occasion": "XVIII Niedziela zwykła",
    "readings": "Wj 16,2-4.12-15; Ef 4,17.20-24; J 6,24-35",
    "status": "final",
    "summary": "O głodzie, którego nie nasyci chleb.",
    "plan": [
      {
        "id": "p1",
        "text": "Głód, którego nie nasyci chleb",
        "depth": 0
      },
      {
        "id": "p2",
        "text": "Prośba o chleb sięga dalej niż pokarm [@ratzinger2007, s. 183]",
        "depth": 1,
        "kind": "quote"
      },
      {
        "id": "p3",
        "text": "![@ratzinger2007-1]",
        "depth": 1,
        "kind": "quote"
      },
      {
        "id": "p4",
        "text": "Chleb dzielony przy stole w domu",
        "depth": 1,
        "kind": "example"
      },
      {
        "id": "p5",
        "text": "Gdzie w tym tygodniu będę szukać chleba?",
        "depth": 0,
        "kind": "question"
      }
    ],
    "body": "## Głód\nJezus mówi, że jest chlebem życia — a prośba o chleb sięga dalej niż pokarm [@ratzinger2007, s. 183].\n\n![@ratzinger2007-1]\n\nModlitwa to nie technika^[Por. też Katechizm, nr 2559.].",
    "further": "Do czytania: [@ratzinger2007].",
    "project": "@niedziele-2026"
  }
}

### "delivery" — Wygłoszenie
Jedno wygłoszenie przygotowanego tekstu (kazania, konferencji): kiedy i gdzie, nagranie — i co z planu zostało powiedziane, co tylko krótko, co pominięte, a co doszło.
"data":
  "texts" — Kazanie (tekst): Który przygotowany tekst wygłoszono — odwołanie (zwykle jedno; kilka, gdy łączyło się materiał) (lista odwołań: kennungi albo "@klucze")
  "date" — Data: Kiedy (RRRR-MM-DD) — według niej układa się archiwum (data RRRR-MM-DD)
  "occasion" — Okazja: Dzień liturgiczny, okazja (tekst)
  "place" — Miejsce: Gdzie: kościół, Msza (tekst)
  "audience" — Dla kogo: Słuchacze (tekst)
  "readings" — Czytania: Czytania tego dnia, sigla biblijne (tekst)
  "audio" — Nagranie (adres): Adres nagrania audio — plik (mp3, m4a, ogg) albo strona z nagraniem (adres https://…)
  "video" — Wideo (adres): Adres nagrania wideo — plik (mp4, webm) albo YouTube (adres https://…)
  "duration" — Długość: Długość nagrania (mm:ss) (tekst)
  "summary" — Krótko o tym wygłoszeniu: Co tym razem było najważniejsze, czym się różniło (tekst (może mieć wiele wierszy))
  "coverage" — Co z planu: Co z planu tekstu zostało powiedziane — punkt po punkcie: { "point", "state", "at", "note" } (lista obiektów o polach:)
      "point" — Punkt planu: "id" punktu z planu tekstu (tekst)
      "state" — Jak: "said" — powiedziane, "short" — tylko wspomniane, krótko, "skipped" — pominięte (jedna z wartości)
      "at" — Czas: Kiedy w nagraniu zaczyna się ten punkt (mm:ss albo gg:mm:ss) (tekst)
      "note" — Uwaga: Co było inaczej niż w planie (tekst (może mieć wiele wierszy))
  "added" — Co doszło: Co zostało powiedziane, a nie było w planie: { "text", "at", "after" } (lista obiektów o polach:)
      "text" — Co: Co zostało powiedziane (jedno-dwa zdania), w zapisie treści (tekst w zapisie treści (niżej))
      "at" — Czas: Kiedy w nagraniu (mm:ss) (tekst)
      "after" — Po punkcie: "id" punktu planu, po którym to padło; puste — na końcu (tekst)
  "transcript" — Zapis (transkrypcja): To, co zostało powiedziane, spisane słowo w słowo — w zapisie treści (tekst w zapisie treści (niżej))
Przykład:
{
  "kind": "delivery",
  "data": {
    "texts": [
      "@kazanie-chleb"
    ],
    "date": "2026-08-02",
    "occasion": "XVIII Niedziela zwykła",
    "place": "Kraków, Msza o 10:30",
    "audio": "https://example.pl/kazania/2026-08-02.mp3",
    "duration": "14:30",
    "summary": "Tym razem mocniej o niedzielnej Eucharystii.",
    "coverage": [
      {
        "point": "p1",
        "state": "said",
        "at": "0:40"
      },
      {
        "point": "p2",
        "state": "said",
        "at": "2:05"
      },
      {
        "point": "p3",
        "state": "short",
        "at": "4:30",
        "note": "Bez całego cytatu."
      },
      {
        "point": "p4",
        "state": "skipped"
      },
      {
        "point": "p5",
        "state": "said",
        "at": "11:20"
      }
    ],
    "added": [
      {
        "text": "Zaproszenie na czwartkową adorację.",
        "at": "13:05",
        "after": "p5"
      }
    ]
  }
}

### "project" — Projekt
Książka, cykl kazań, zbiór — z planem (rozdziały, części) i postępem pisania. Ma klucz cytowania.
"data":
  "projectType" — Rodzaj: Rodzaj: "book" (Książka), "series" (Cykl kazań), "collection" (Zbiór), "article" (Artykuł), "other" (Inny) (jedna z wartości)
  "title" — Tytuł: Tytuł (tekst)
  "subtitle" — Podtytuł: Podtytuł (tekst)
  "description" — Opis: Opis projektu — o czym jest książka albo cykl (tekst (może mieć wiele wierszy))
  "outline" — Plan: Plan: lista {"heading": "Część I"} i {"text": <odwołanie do tekstu>} w kolejności; czytelnik widzi te teksty, które może czytać (lista punktów planu)
  "status" — Stan: Stan: "planned", "writing", "editing", "done" (jedna z wartości)
  "deadline" — Termin: Do kiedy (RRRR-MM-DD) (data RRRR-MM-DD)
  "targetWords" — Docelowa liczba słów: Ile słów ma mieć całość (liczba)
Przykład:
{
  "kind": "project",
  "key": "niedziele-2026",
  "data": {
    "projectType": "series",
    "title": "Niedziele 2026",
    "description": "Kazania niedzielne roku B.",
    "outline": [
      {
        "heading": "Lipiec"
      },
      {
        "text": "@kazanie-chleb"
      }
    ],
    "status": "writing"
  }
}

### "texttype" — Rodzaj tekstu
Własny rodzaj tekstu (np. „Kazanie maryjne”): nazwa i dodatkowe pola, które ma każdy tekst tego rodzaju — także odwołania do wpisów w Nauce (np. tajemnica, obszar). Tekst bez rodzaju to zwykły tekst. Ma klucz cytowania.
"data":
  "name" — Nazwa: Nazwa rodzaju, np. „Kazanie maryjne” (tekst)
  "description" — Opis: Do czego służy ten rodzaj (tekst (może mieć wiele wierszy))
  "fields" — Dodatkowe pola: Pola, które ma każdy tekst tego rodzaju — opisane jak pola rodzaju w Nauce: lista {"key", "label", "type", "multi", "options", "to", "locator", "says"}. "type": line, text, number, date, bool, choice, ref, url, list. Przy "ref" — "to": nazwy rodzajów w Nauce (np. ["Tajemnica"]) albo "work", "quote", "person" z biblioteki; "locator": true — z miejscem (np. Pismo Święte + "Łk 1,26-38"). Klucze stałych pól tekstu (title, date, plan, body …) są zajęte (lista pól — jak pola rodzaju w Nauce)
Przykład:
{
  "kind": "texttype",
  "key": "kazanie-maryjne",
  "data": {
    "name": "Kazanie maryjne",
    "description": "Kazania o tajemnicach różańca w obszarach życia Maryi.",
    "fields": [
      {
        "key": "tajemnica",
        "label": "Tajemnica",
        "type": "ref",
        "to": [
          "Tajemnica"
        ],
        "says": "Która tajemnica różańca"
      },
      {
        "key": "obszar",
        "label": "Obszar",
        "type": "ref",
        "to": [
          "Obszar"
        ],
        "says": "Który obszar życia Maryi"
      }
    ]
  }
}

## Rodzaj tekstu i jego pola
Rodzaj tekstu ("texttype") to nazwa i dodatkowe pola, które ma każdy tekst tego rodzaju — obok stałych pól tekstu (tytuł, data, plan, treść …). Pola opisuje się jak pola rodzaju w Nauce: {"key", "label", "type", "multi", "options", "to", "locator", "says"}; "type": line, text, number, date, bool, choice, ref, url, list.
- "ref" — odwołanie: "to" to nazwy rodzajów w Nauce (np. ["Tajemnica"]) albo "work", "quote", "person" (Biblioteka) i "text" (inny tekst); "locator": true — z miejscem.
- Tekst tego rodzaju: "textType": "@klucz-rodzaju", a wartości pól jako zwykłe pola w "data" — pod kluczem pola. Odwołanie do wpisu w Nauce można podać jego kennungą albo NAZWĄ ("Zwiastowanie"); odwołanie z miejscem: {"value": "@bt", "locator": "Łk 1,26-38"}; kilka wartości ("multi": true) — lista.
- Klucze stałych pól tekstu są zajęte: textType, title, subtitle, project, status, date, occasion, place, readings, summary, plan, body, further, audio, video, targetWords.
- Tekst bez rodzaju to zwykły tekst.

Przykład — rodzaj „Kazanie maryjne” i jedno kazanie tego rodzaju (z Pismem Świętym "@bt" z Biblioteki):
{
  "format": "recreatio/scriptorium",
  "version": 1,
  "name": "Kazania maryjne",
  "entries": [
    {
      "kind": "texttype",
      "key": "kazanie-maryjne",
      "data": {
        "name": "Kazanie maryjne",
        "fields": [
          {
            "key": "tajemnica",
            "label": "Tajemnica",
            "type": "ref",
            "to": [
              "Tajemnica"
            ]
          },
          {
            "key": "obszar",
            "label": "Obszar",
            "type": "ref",
            "to": [
              "Obszar"
            ]
          },
          {
            "key": "fragment",
            "label": "Fragment Pisma",
            "type": "ref",
            "to": [
              "work"
            ],
            "locator": true
          }
        ]
      }
    },
    {
      "kind": "text",
      "key": "zwiastowanie-modlitwa",
      "data": {
        "textType": "@kazanie-maryjne",
        "title": "Niech mi się stanie",
        "date": "2026-03-25",
        "occasion": "Uroczystość Zwiastowania Pańskiego",
        "tajemnica": "Zwiastowanie",
        "obszar": "Modlitwa",
        "fragment": {
          "value": "@bt",
          "locator": "Łk 1,26-38"
        },
        "plan": [
          {
            "id": "p1",
            "text": "Maryja słucha, zanim odpowie [@bt, Łk 1,29]"
          },
          {
            "id": "p2",
            "text": "Gdzie dziś słucham?",
            "kind": "question"
          }
        ],
        "body": "Maryja „zmieszała się na te słowa i rozważała” [@bt, Łk 1,29]."
      }
    }
  ]
}

## Zapis treści (pola "body" i "further" tekstu, punkty planu "plan[].text", "transcript" i "added[].text" wygłoszenia)
  ## Śródtytuł            (# albo ## — śródtytuł, ### — mniejszy)
  Akapity oddziela pusta linia; pojedyncze przejście do nowej linii zostaje (psalmy, pieśni).
  **pogrubienie**  *kursywa*  [opis linku](https://…)
  [@klucz]                 odwołanie do źródła (dzieło, cytat, osoba) — staje się przypisem
  [@klucz, s. 23]          z miejscem w źródle
  [@bt, J 6,35; @klucz2]   kilka odwołań w jednym przypisie
  [@klucz-tekstu]          odwołanie do WŁASNEGO wpisu (tekst, projekt, wpis bazy wiedzy — np. komentarz) — nigdy przypis: w tekście staje się linkiem „(zob. jego tytuł)”
  [[te słowa|@klucz]]      link do wpisu z własnymi słowami (np. [[kazaniu o chlebie|@kazanie-chleb]]) — też nigdy przypis
  ^[treść przypisu]        własny przypis, bez źródła
  ![@klucz-cytatu]         cytat z biblioteki jako osobny blok, z podpisem skąd pochodzi
  ![@id-wpisu]             wpis bazy wiedzy z treścią w blokach (np. komentarz) jako osobny blok — cały, z tabelami
  [[house|@id-słowa]]      link do wpisu bazy wiedzy (np. słowa ze słownika) — czytelnik widzi go, jeśli może czytać tę bazę
  ![@id-widoku]            widok bazy wiedzy jako osobny blok (np. w punkcie planu): lista, która zmienia się razem z danymi — np. „psalmy jutrzni niedzielnej" z psałterza
  > tekst                  wcięty cytat
  - punkt   ·   1. punkt
  ---                      linia oddzielająca
  \znak                    znak bez znaczenia (np. \* zamiast kursywy)
Przypisy liczą się same; pierwszy raz źródło jest podane w całości, potem skrótem z „dz. cyt.”, a tuż po sobie — „Tamże”. Pod tekstem pojawia się bibliografia.
Miejsce w Piśmie Świętym (odwołanie do dzieła z "workType": "bible" — w "locator" cytatu, w przypisie tekstu, w polu z miejscem w Nauce) pisz razem z księgą: Dz 1,14 · Dz 1,14-16 · Łk 1,26–2,5 · Dz 1,8.14 · Ps 23 · Mt 5,3-12; 6,1. Księgi mogą być po polsku (BT), łacinie (Nova Vulgata) albo angielsku (Acts 1:14) — aplikacja je rozpoznaje, porządkuje cytaty w kolejności Biblii i znajduje wszystko, co wskazuje na dany werset, we wszystkich przekładach.
Źródło (to, co przyszło z zewnątrz) się cytuje, własne wpisy się linkuje: [@ratzinger2007, s. 183; @kazanie-chleb] daje przypis do książki i w tekście link „(zob. Chleb życia)”. Czego czytelnik nie może otworzyć, pokazuje się jako „[odwołanie niedostępne]” (albo same słowa z [[…|@…]]) — bez tytułu i bez klucza.
Klucz to pomoc przy pisaniu: aplikacja zapamiętuje stały odnośnik do wpisu (jego kennungę), więc późniejsza zmiana klucza nie psuje tekstu. Zamiast klucza można też podać kennungę wpisu: [@01a1…-…, s. 3]. Klucz, którego nie ma, zostaje w tekście, jak jest (z ostrzeżeniem przy imporcie).

## Miejsce w źródle
Miejsce w Piśmie Świętym (odwołanie do dzieła z "workType": "bible" — w "locator" cytatu, w przypisie tekstu, w polu z miejscem w Nauce) pisz razem z księgą: Dz 1,14 · Dz 1,14-16 · Łk 1,26–2,5 · Dz 1,8.14 · Ps 23 · Mt 5,3-12; 6,1. Księgi mogą być po polsku (BT), łacinie (Nova Vulgata) albo angielsku (Acts 1:14) — aplikacja je rozpoznaje, porządkuje cytaty w kolejności Biblii i znajduje wszystko, co wskazuje na dany werset, we wszystkich przekładach.

---

## Appendix C — Knowledge base JSON (generated by the app, `courseDescription()`)

# Cogita jako JSON

Formaty:
  "recreatio.cogita.course" — cały kurs: rodzaje, wpisy, szablony kart, powtórki, przebiegi, zbiory, wygląd, zasady, wartości
  "recreatio.cogita.schema" — rodzaje z ich szablonami kart i formularzami dodawania (niezależna kopia do innej bazy wiedzy)
  "recreatio.cogita.entities" — same wpisy (także wypowiedzi i pytania)
  "recreatio.cogita.flow" — przebieg razem z tym, co pokazuje

Wspólne:
  "format", "version": 1, "name" — nazwa
  "ref" — własna nazwa wpisu, np. "@dawid"; inne pola odwołują się do niej tak samo: "@dawid".
  Istniejące wpisy rozpoznaje się po identyfikatorze (z eksportu); import zmienia je w miejscu i niczego nie usuwa.

Kto czyta: bazę czyta ten, kto czyta jej obszar. W obszarze jawnym (gdy baza jest otwarta: Ustawienia → Kto czyta) każdy, bez konta — cała baza, także odpowiedzi pytań i szkice.
  Pojedynczych wpisów się nie publikuje: to, co ma być publiczne, trafia do osobnej bazy w obszarze jawnym (wpis → Kto widzi → Przenieś; identyfikator zostaje). Moduły stron (powtórka, przebieg, karta wpisu) czytają bazę tak, jak widzi ją czytelnik strony.

"kinds" — rodzaje:
  "name" — nazwa, "label" — wzór etykiety, np. "{givenNames} {surname}", "tells" — pole, które odróżnia imienników,
  "builtin" — zmiana wbudowanego rodzaju (person, work, quote — z biblioteki; text, delivery, project — ze skryptorium; question);
    innych wbudowanych treści nie ma: rodzaje pisze właściciel bazy albo importuje gotowy schemat (niżej)
  "fields": [{"key", "label", "type", "multi", "uncertain", "unit", "quantity", "options", "to", "inverse", "symmetric", "locator", "media", "rangeOf", "says"}]
  "quantity" (liczba) — jaka wielkość (identyfikator z QUDT, np. "Torque", "Mass"); wtedy wartość wpisuje się w dowolnej jednostce tej wielkości, a zapisuje tak, jak wpisano, razem z SI:
    {"value": 1.5, "unit": "KiloN", "si": 1500} ("unit" — identyfikator jednostki z QUDT: "N", "KiloN", "N-M", "J", "KiloGM", "DEG_C" …; liczba bez jednostki — w jednostce pola);
    np. {"key": "moment", "label": "Moment obrotowy", "type": "number", "unit": "N·m", "quantity": "Torque"}, a we wpisie: "moment": {"value": 12, "unit": "N-M", "si": 12};
    bez "quantity" pole bierze wielkość z jednostki, gdy jest jednoznaczna ("kg" → Mass; "N·m" — moment siły albo energia — trzeba wybrać)
  pytanie z liczbą i wielkością: {"form": "number", "prompt": "Jaki moment siły…?", "answers": ["12"], "unit": "N·m", "quantity": "Torque", "tolerance": 0.1} — „12 N·m" i „0,012 kN·m" są dobre, „12 J" nie (energia, choć wymiar ten sam)
  wielkości i ich jednostki: Dimensionless (bez wymiaru): —, %; PlaneAngle (kąt): rad, °, obr; Length (długość): m, km, dm, cm, mm, µm, nm, in, ft, mi, ly; Area (pole powierzchni): m², dm², cm², mm², km², ha; Volume (objętość): m³, dm³, cm³, mm³, l, ml, hl; Mass (masa): kg, dag, g, mg, µg, t, lb; Time (czas): s, ms, µs, min, h, d, rok; Frequency (częstotliwość): Hz, kHz, MHz, GHz, 1/s, 1/min; AngularVelocity (prędkość kątowa): rad/s, °/s, obr/s, obr/min; Velocity (prędkość): m/s, cm/s, km/h, km/s, mph, kn; Acceleration (przyspieszenie): m/s², cm/s², g₀; Force (siła): N, mN, kN, MN, kgf, dyn; Momentum (pęd): kg·m/s, N·s; Energy (energia (praca, ciepło)): J, mJ, kJ, MJ, cal, kcal, W·h, kW·h, eV, N·m, mN·m, kN·m; Torque (moment siły): N·m, mN·m, kN·m; Power (moc): W, mW, kW, MW, KM; Pressure (ciśnienie): Pa, hPa, kPa, MPa, bar, mbar, atm, mmHg, psi; ThermodynamicTemperature (temperatura): K, °C, °F; Density (gęstość): kg/m³, g/cm³, g/l, kg/l, g/ml; DynamicViscosity (lepkość dynamiczna): Pa·s, mPa·s, cP; KinematicViscosity (lepkość kinematyczna): m²/s; SpecificEnergy (energia właściwa (entalpia na kilogram)): J/kg, kJ/kg; SpecificHeatCapacity (ciepło właściwe): J/(kg·K); ThermalConductivity (przewodność cieplna): W/(m·K); ElectricCurrent (natężenie prądu): A, mA, µA; ElectricCharge (ładunek elektryczny): C, mA·h, A·h; Voltage (napięcie): V, mV, kV; Resistance (opór elektryczny): Ω, kΩ, MΩ; Capacitance (pojemność elektryczna): F, µF, nF, pF; AmountOfSubstance (liczność materii): mol, mmol; AmountOfSubstanceConcentration (stężenie molowe): mol/m³, mol/l; MolarMass (masa molowa): kg/mol, g/mol; LuminousIntensity (światłość): cd
  "options" (wybór z listy) — [{"value", "label"}]
  "to" (odwołanie) — na jakie rodzaje wskazuje: ["@ref rodzaju z tego dokumentu", "Nazwa rodzaju", "work"]; puste — na dowolne
  "locator": true (odwołanie z miejscem) — każda wartość to {"value": "@dzielo", "locator": "Ps 110"}: psalm to Biblia z biblioteki + miejsce, hasło to leksykon + „s. 23"; miejsca w Piśmie aplikacja czyta (Ps 110 · Łk 1,46-55) i po nich szuka; tekstu Biblii się nie przechowuje
    np. {"key": "miejsce", "label": "Miejsce w Piśmie", "type": "ref", "to": ["work"], "locator": true}, a we wpisie: "miejsce": {"value": "@bt", "locator": "Ps 110,1-7"}
  "blocks" (treść w blokach) — lista bloków: {"type": "paragraph", "text": "zapis"} | {"type": "ordered"|"unordered", "items": [komórka, …]} | {"type": "table", "columns": ["nagłówek", …], "rows": [[komórka, …], …]};
    komórka to lista kawałków: {"text": "…"} albo {"ref": "@wpis", "locator": "Łk 1,35"} — prawdziwe odwołanie (do wpisu tej bazy, innej bazy albo źródła biblioteki), z miejscem albo bez
    każdy rodzaj z polem "blocks" jest rodzajem WYPOWIEDZI (np. Komentarz): teza = pierwsze zdanie pierwszego akapitu (najwyżej 200 znaków) — nazwa wpisu i pierwsza strona karty;
    teza zakończona „?” czyni wpis pytaniem — odpowiedzią jest wypowiedź, która się do niego odwołuje; „informacja” (odwołuje się tylko do źródeł biblioteki) albo „interpretacja” (do innej wypowiedzi albo do żadnego źródła) liczy się z odwołań i nie zapisuje się
  gotowe schematy to pliki w repozytorium, importowane jak każdy schemat (Schemat → „Schemat jako JSON” → Import): templates/cogita/komentarz.json (Komentarz: „O czym” — odwołania z miejscem do dowolnego wpisu, „Treść” — bloki; z szablonami kart „Teza” i „Tabela z treści”),
    templates/cogita/slownik.json (Język, Słowo, Tłumaczenie, Synonimy, Antonimy — z szablonami „Słówka”), templates/cogita/psalterz.json (psalm z miejscem w Piśmie, miejsca brewiarza)
  typy pól: "line" (Wiersz tekstu), "text" (Dłuższy tekst), "markup" (Tekst z przypisami), "blocks" (Treść w blokach (akapity, listy, tabele)), "number" (Liczba z jednostką), "date" (Data (rok, miesiąc albo dzień)), "bool" (Tak / nie / nie wiadomo), "choice" (Wybór z listy), "ref" (Odwołanie), "media" (Obraz, dźwięk, film, dokument), "url" (Adres strony), "list" (Lista w kolejności), "geo" (Miejsce na mapie), "range" (Zakres z kilku odcinków)
  wartość niepewna: {"value": …, "state": "known|approximate|disputed|unknown|na|pending", "source": {"work": "@dzielo", "locator": "s. 23"}, "note": "…"}
  data: "1999", "1999-05", "1999-05-03", "-1000" (przed Chr.); zakres: {"segments": [{"from": 992, "to": 1000}]}

"entities" — wpisy: {"ref", "kinds": ["person", "Postać"], "data": {pole: wartość}}
  wypowiedź — wpis rodzaju z polem "blocks", np. komentarz z templates/cogita/komentarz.json:
    "kinds": ["Komentarz"], "data": {"about": [{"value": "@bt", "locator": "Łk 1,35"}], "content": [{"type": "paragraph", "text": "Duch Święty zstępuje na Maryję jak na Apostołów. Łukasz opisuje oba wydarzenia tymi samymi słowami."}, {"type": "table", "columns": ["Zwiastowanie", "Pięćdziesiątnica"], "rows": [[[{"ref": "@bt", "locator": "Łk 1,35"}], [{"ref": "@bt", "locator": "Dz 1,8"}]]]}]}
    rodzaju „wiedza” ("knowledge") już nie ma — stare takie wpisy stoją w Nauce pod „Stare wpisy”
    tematów i perspektyw nie ma — porządek dają własne rodzaje (np. "Tajemnica" z polami "numer" i "czesc" → rodzaj "Część"; "Obszar" z polem "grupa"), a wpisy wskazują na nie polami-odwołaniami (komentarz: "about"; kazanie: pola swojego rodzaju tekstu, np. "tajemnica", "obszar")
    rodzaj tekstu ze skryptorium, z którego korzysta baza, jest tu rodzajem: tekst ma jego pola obok stałych (tytuł, data, plan…) — widoki grupują i macierze ustawiają teksty według nich
    karty z wypowiedzi: szablon z "kinds": ["@rodzaj z polem blocks"] i węzłami "statement.thesis" (teza), "statement.part" ({"n": 2} — drugi kawałek; puste: akapity), "statement.table" ({"table": 1, "left": 1, "right": 2} — pary z kolumn), "statement.subjects" (o czym: wartości pól-odwołań, z miejscem)
    zapis tekstu w akapicie i w polach "markup" (ten sam co w Skryptorium): akapity oddziela pusta linia, "## śródtytuł", **pogrubienie**, *kursywa*, [opis](https://…), ^[przypis], "> cytat", "- punkt";
    [[słowo|@wpis]] — link do wpisu (tej bazy, innej bazy albo biblioteki) z tymi słowami; nigdy przypis;
    [@dzielo, s. 23] — źródło: dzieło, cytat, osoba z biblioteki staje się przypisem; ten sam zapis na wypowiedź, wpis czy tekst daje w tekście link „(zob. etykieta)”
  pytanie: "kinds": ["question"], "data": {"form": "text|number|date|one|many|truefalse|order|match|gap|flash|code|point|interactive", "prompt", "answers", "options", "correct", …}
    "interactive" — rysunek do poruszania: "drawing" (ten sam JSON co moduł strony „Animacja”: vars, let, sim, controls, rules z "goal": true, world, elements — jako tekst JSON),
    "goal" (wyrażenie celu, np. "abs(x - cel) < 0.5 && y <= 0"; puste — reguły rysunku z "goal"), "solution" ("kat = 45; v0 = sqrt(cel*g)" — rachunek z wartościami rysunku; w świecie także "w2.pos = 5"; puste — "task.solve" rysunku, a jego "task" losuje przy każdej próbie zadanie tak samo trudne);
    sprawdzane przez symulację ustawionych wartości do końca (świat — odtworzony według jego reguł: co zablokowane, zostaje); wartości z "random" losowane przy każdej próbie

"templates" — szablony kart: {"name", "kinds": ["@rodzaj"], "direction": "a→b", "graph": {"nodes": [{"id", "type", "x", "y", "config"}], "edges": [{"id", "from", "out", "to", "in"}]}}
  szablon może dotyczyć rodzaju z biblioteki ("quote", "work", "person") albo ze skryptorium ("text", "delivery", "project"), z których korzysta ta baza: wtedy karty powstają z ich wpisów, np. {"name": "Miejsce cytatu", "kinds": ["quote"], "direction": "locator", "graph": …}
"revisions" — powtórki: {"name", "graph"} (źródła → filtr → … → jeden „Sposób pytania")
  także kroki wspólne z widokami: {"type": "follow", "config": {"field": "authors", "back": false}} — karty wpisów, do których prowadzi odwołanie (albo, "back": true, które wskazują na te wpisy); {"type": "filter.rule", "config": {"rule": {"op": "and", "items": [{"field", "cmp", "value"}]}}} — karty wpisów spełniających regułę
  źródło „rodzaj z biblioteki": {"type": "source.kind", "config": {"kind": "quote", "from": "<identyfikator biblioteki>"}} — "from" puste: z tej bazy i ze wszystkich źródeł
"flows" — przebiegi: {"name", "look": "reading|slides|scenes|dialogue|flashcards|map", "start", "graph", "slots", "goals", "lines", "narrators"}
  "narrators" — kto opowiada, według wartości: [{"character": "@piotr", "condition": {"type": "value", "value": "przewodnik", "op": "eq", "than": 1}}, {"character": "@maria"}] — opowiada pierwszy, którego warunek jest spełniony (bez warunku: zawsze); jego portret i imię stoją nad krokiem i zapowiadają jego tytuł
  krok "scene" {"page": "adres/strony", "scene": "klucz sceny", "title"} — scena prezentacji; wyjścia "next", przy pytaniu na scenie "right" / "wrong", przyciski "b0", "b1", …
  przebieg z prezentacji (jedna opowieść, nie kopia): {"name": "Droga", "look": "scenes", "presentation": "parafia/droga", "narrators": […]} — bez własnego "graph": jego mapą jest storyboard strony (sceny, przejścia, pytania, warunki, wartości — "story" w JSON strony); w Nauce gra tę prezentację, a odpowiedzi, wartości i miejsce, w którym ktoś skończył, liczą się w tej bazie (to samo miejsce co na stronie); zobaczy ją tylko ten, kto może zobaczyć stronę
"collections" — zbiory: {"name", "rule": {"op": "and|or", "items": [{"field", "cmp", "value"}]}, "list": ["@wpis"]}
"views" — widoki (te same kroki co powtórka, po wpisach): {"name", "mode": "table|tree|matrix|map|canvas", "steps": [krok, …], "query", "group", "matrix", "columns": ["klucz pola" | "#axis:@oś"], "sort": {"key", "dir": 1|-1}}
  na początku źródła — kilka pod rząd sumuje się (np. kazania i komentarze): "source.all" | "source.kind" {"kind": "@rodzaj" albo "text" ze skryptorium, "from"} | "source.collection" {"collection": "@zbiór"} | "source.list" {"ids": ["@wpis"]};
  także "source.from" {"entry": "@kazanie"} — to, na co wskazuje wpis (kazanie: jego cytaty, wypowiedzi, słowa ze słownika, miejsca z planu; w powtórce: „Z wpisu" — powtórka z kazania);
  potem "follow" {"field", "back"} i "filter.rule" {"rule"} (źródło po innym kroku zaczyna od nowa);
  grupowanie (drzewo "group", wiersze i kolumny "matrix": {"rows": grupowanie, "cols": grupowanie}): {"by": "kind"} | {"by": "field", "field": "klucz"} | {"by": "axis", "kind": "@rodzaj", "via", "through", "sort", "group"} — OŚ: jej wartości to wpisy rodzaju
    "via": ["pole"] — przez które pola-odwołania wpis należy do wartości (puste: przez dowolne); "through": "pole" albo "*" — także o jeden krok dalej (wpis → przez to pole → inny wpis → przez "via" → wartość)
    "sort": {"field": "numer"} — kolejność według pola liczbowego wartości, albo {"list": "@rozaniec", "field": "tajemnice"} — według kolejności w polu-odwołaniu innego wpisu; bez "sort" — według nazwy
    "group": "czesc" — nagłówki: pole-odwołanie wartości (np. część tajemnic); w macierzy nad kolumnami i między wierszami
  kolumna "#axis:@rodzaj" — wartości tej osi (wpisy rodzaju), na które wskazuje wpis
  np. {"name": "Postacie według okresu", "mode": "tree", "steps": [{"type": "source.kind", "config": {"kind": "@postac"}}], "group": {"by": "axis", "kind": "@okres", "via": ["okres"], "sort": {"field": "od"}}}
  np. macierz 20 × 12 — Tajemnica × Obszar: {"name": "Tajemnica × Obszar", "mode": "matrix", "steps": [{"type": "source.kind", "config": {"kind": "text"}}, {"type": "source.kind", "config": {"kind": "@komentarz"}}], "matrix": {"rows": {"by": "axis", "kind": "@tajemnica", "sort": {"field": "numer"}, "group": "czesc"}, "cols": {"by": "axis", "kind": "@obszar", "group": "grupa"}}}
    — 20 tajemnic różańca (w czterech częściach) × 12 maryjnych obszarów (w grupach); w polu: kazania ze skryptorium (rodzaj tekstu „Kazanie maryjne” z polami "tajemnica" i "obszar") i komentarze, których "about" wskazuje tajemnicę i obszar; puste pola też są widoczne
  na stronie: moduł "view" {"library": "<id bazy>", "view": "<id widoku>", "mode": "tabela|drzewo|macierz|mapa"} — pole macierzy (klik) i wpis otwierają się pod spodem, droga w adresie osobno dla każdego modułu
"forms" — formularze dodawania (należą do schematu): {"ref", "name", "says", "graph", "keys", "paste", "order"}
  węzeł "pick" — wybór na początek, zostaje dla wszystkich wierszy: "config": {"label", "kinds": ["@rodzaj"], "many", "optional", "value": ["@wpis"]}
  węzeł "entry" — wpis z każdego wiersza: "config": {"kind": "@rodzaj", "also": ["@inny rodzaj"] (rodzaj wybierany przy każdej wartości; na liście przedrostek „Nazwa rodzaju: …”), "label", "many" (kilka w wierszu), "reuse": "same|never", "identity": ["pole"],
    "fields": {"pole": {"from": "type|ask|fixed", "value": "tekst"}}} — type: wpisywane w wierszu, ask: ustawiane na początek ("value" — domyślnie), fixed: stała wartość
  krawędź {"id", "from": węzeł, "out": "out", "to": węzeł "entry", "in": klucz pola-odwołania} — wypełnia to pole wpisem z węzła "from";
    kilka krawędzi do pola, które przyjmuje kilka: wartości po kolei według położenia węzłów (z góry na dół); wpis powstaje, gdy w wierszu są wszystkie połączone
  "order": ["id węzła entry"] — kolejność pól w wierszu (Enter, kolumny wklejanej listy); bez niej jak na płótnie
  "keys": {"enter", "ctrlEnter", "shiftEnter"}: "next", "more", "save", "newline", "none"
  "paste": {"columns": "auto", "tab", ";", "=", " - ", "|", ",", "values": ",", ";", "/", "|", "header": true|false}

---

## Appendix D — Page JSON, excerpts: the page, texts on pages, the presentation with its storyboard, and the modules of the three parts (from `pageDescription()`)

## Strona
  "format" — "recreatio/page"
  "version" — 1
  "path" — tylko informacja; import zawsze trafia na otwartą stronę
  "title" — tytuł strony
  "lead" — tekst pod tytułem (albo null)
  "mode" — "page": moduły na siatce; "slides": każdy moduł to osobny slajd; "presentation": sceny z modułami w dowolnym miejscu (niżej: Prezentacja)
  "theme" — kolory: null (automatyczne — jak w aplikacji) albo { "mode": "dark"|"light", "accent", "ink", "ground", "muted" } (kolory "#rrggbb"); z "night": { "accent", "ink", "ground", "muted" } strona idzie za urządzeniem — jasne kolory w dzień, te w nocy
  "cover" — tło slajdu tytułowego: lista warstw (niżej)
  "show" — sceny prezentacji (niżej: Prezentacja)
  "deck" — całość pokazu slajdów (tylko "mode": "slides"): { "backdrop": [warstwy], "nav": "labels"|"dots"|"none", "titleSlide": true|false, "width": 80 }
      "backdrop" — tło wspólne: warstwy (jak niżej), które stoją za wszystkimi slajdami i leżą POD ich własnymi warstwami — gradient tła wspólnego nie zasłania więc obrazów slajdów; slajdy przesuwają się nad nim przezroczyste, a ich własne warstwy jadą razem ze swoim slajdem (w jego prostokącie): przy przejściu odjeżdżają z nim w górę, gasną albo zostają zakryte jak on — nic z poprzedniego slajdu nie zostaje na następnym
      "nav" — pasek: nazwy slajdów u góry (zwykły), kropki z prawej, bez paska; "titleSlide": false — bez slajdu tytułowego (pierwszy moduł jest pierwszym ekranem)
      "width" — najwyżej tyle rem szerokości sceny: w niej liczą się miejsca modułów przechodzących i "layout" slajdów (null — całe okno)
  "menu" — null (bez menu), lista pozycji albo { "from": "ścieżka" } (to samo menu co na innej Twojej stronie)
      pozycja: { "label", "kind": "abs" (ścieżka od korzenia, np. "parafia/zapisy") | "rel" (względem tej strony) | "url" (pełny adres) | "none" (sam nagłówek), "target", "children": [pozycje], "image" }
      "image" — obraz zamiast nazwy (logo): "page-image:<id>" (obraz tej strony), "https://…" albo "/logo.svg"; "label" zostaje — czyta go czytnik ekranu i pokazuje się, gdy obrazu brak
  "subject" — wybór na stronie: u góry strony wybiera się jedną rzecz, a moduły (np. "entry-panel") ją pokazują. null (brak wyboru) albo obiekt; rodzaje: { "kind": "entry"; "form": identyfikator modułu „Formularz” — czyje zgłoszenia są do wyboru; "list": nieobowiązkowo: ścieżka strony z modułem „Lista osób” — dokąd prowadzi „← lista” } — Osoba z formularza: U góry strony wybór jednej osoby, która wypełniła formularz (◀ ▶ po liście, filtr); moduły „Panel osoby” pokazują wszystko o niej. Dla koordynatorów. · { "kind": "entity"; "library": identyfikator bazy wiedzy — jej wpisy są do wyboru; "of": nieobowiązkowo: nazwa rodzaju (np. „Postać”) — tylko wpisy tego rodzaju } — Wpis z bazy wiedzy: U góry strony wybór jednego wpisu bazy wiedzy (◀ ▶ po liście); moduły „Karta wpisu” bez własnego wpisu pokazują ten. Jedna strona dla wszystkich postaci, miejsc, pojęć. Wpisy widzi ten, kto może czytać bazę (publiczny obszar: każdy).
  "logic" — mapa logiki strony (kiedy który moduł jest widoczny, kroki osoby) albo null. Najprościej układać ją w edytorze; w JSON: { "version": 1, "nodes": [...], "edges": [...] }
      węzeł: { "id", "kind", "x", "y", ... } — kind: "chosen" (Wybrana osoba), "link" (Otwarte przez link), "loggedIn" (Zalogowany), "registered" (Zgłoszenie wysłane), "confirmed" (Dane potwierdzone), "answer" (Odpowiedź), "mark" (Znacznik), "date" (Data), "and" (I), "or" (LUB), "not" (NIE), "part" (Moduł), "step" (Krok)
      "part" ma "partId" (= "id" modułu) i "message"; "step" ma "label", "help", "dueAt" (RRRR-MM-DD), "goto" (= "id" modułu);
      "registered"/"confirmed"/"answer"/"mark" mają "formId"; "answer" — "fieldId", "op" ("filled"|"empty"|"eq"|"ne"), "valueHash"; "mark" — "stepId", "markBy" ("office"|"person"); "date" — "when" ("after"|"before"), "date"
      krawędź: { "id", "from", "to", "port": "show"|"done"|"applies"|"in" }
  "modules" — moduły w kolejności czytania

## Teksty na stronie
Krótki napis (powitanie, ogłoszenie, kilka zdań) zostaje w module — np. "text". Dłuższy tekst (kazanie, konferencja, rozważanie, rozdział) mieszka w Skryptorium i stamtąd go się pokazuje: moduł "writing" (jeden tekst — z planem, wygłoszeniami, przypisami) albo "writings" (archiwum tekstów jednego skryptorium). Wtedy poprawka w Skryptorium jest od razu na każdej stronie, a kto widzi tekst, decyduje obszar skryptorium. Cytaty pokazuje moduł "quotes" (z Biblioteki).

## Moduł (wpis w "modules")
  "id" — Miejsce modułu na tej stronie. Z eksportu — moduł jest zmieniany w miejscu (zostają zgłoszenia, linki, mapa logiki). Pominięty albo nieznany — powstaje nowe miejsce
  "module" — Moduł, który to miejsce pokazuje (ten sam moduł może stać na kilku stronach). Przy nowym miejscu pominięty — powstaje nowy moduł; przy miejscu z "id" — zostaje dotychczasowy
  "name" — Nazwa modułu na liście modułów (opcjonalnie)
  "kind" — Rodzaj modułu — lista niżej
  "slide" — Jak wygląda jako slajd: { "label": nazwa w menu slajdów (z niej kotwica "#nazwa"), "layers": [warstwy tła], "transition", "enter", "colors", "stage" } — szczegóły niżej (Slajd modułu)
  "show" — Gdzie stoi w prezentacji ("mode": "presentation"): { "places": { "<klucz sceny>": miejsce }, "skin", "type", … } — szczegóły niżej (Prezentacja). null — zdejmuje moduł z prezentacji
  "size" — Rozmiar, gdy nie podajesz "layout": { "colSpan": 2|3|4|6, "rowSpan": 1|3|5 } — 1 pasek, 3 blok, 5 wysoki. Miejsce: pierwsze wolne
  "layout" — Dokładne miejsce na siatce dla "desktop" (6 kolumn), "tablet" (4) i "mobile" (2): { "position": { "row", "col" }, "size": { "colSpan", "rowSpan" } }. Pominięty — moduł zostaje, gdzie był (nowy: pierwsze wolne miejsce)
  "config" — Treść modułu — zależy od rodzaju (niżej). Pominięta — treść zostaje bez zmian
  "questions" — Tylko "form": pytania (niżej)
  "design" — Tylko "form": układ i logika (niżej)

Warstwy tła ("cover" strony, "slide.layers" modułu) — od tyłu do przodu:
  { "kind": "gradient", "speed": 0.12, "angle": 168, "from": "#12203a", "via": null, "to": "#060a12" }
  { "kind": "image", "speed": 0.34, "url": "https://…/tlo.jpg", "opacity": 0.45, "blend": "normal"|"multiply"|"screen"|"overlay"|"soft-light", "position": "center" }
  { "kind": "bigtext", "speed": 0.95, "lines": ["TRASA"], "opacity": 0.1, "color": null }
  { "kind": "glow", "speed": 0.12, "color": "rgba(120, 170, 220, 0.18)", "x": 58, "y": 42, "size": 60, "opacity": 1, "blend": "normal" } — poświata: miękka plama światła; "x", "y" — środek w %, "size" — gdzie gaśnie (% odległości do najbliższej krawędzi)
  { "kind": "vignette", "speed": 0, "strength": 0.35, "reach": 55, "color": "#000000" } — ciemne rogi: od "reach" % drogi do rogu ciemniej, w rogu "strength"
  { "kind": "haze", "speed": 0.08, "color": "rgba(120, 170, 220, 0.08)", "depth": "rgba(30, 60, 100, 0.1)", "blur": 60, "opacity": 0.35, "motion": { "name": "drift" } } — mgła: dwie ciemne plamy ("depth") i jasna smuga ("color"), mocno rozmyte, dryfują
  { "kind": "mesh", "speed": 0.05, "seed": 7, "count": 4, "color": "rgba(143, 208, 255, 0.25)", "glow": "rgba(167, 224, 255, 0.35)", "center": 0.82, "amplitude": 1, "opacity": 0.9, "dust": true, "motion": { "name": "sway" } } — nici: świecące linie fal nad dolną krawędzią z pyłem; "count" warstw, każda faluje po swojemu ("sway": 180–400 s); "center" — wysokość fali (0 góra, 1 dół)
  { "kind": "waves", "speed": 0.05, "seed": 7, "count": 6, "hue": 188, "spread": 32, "opacity": 1, "blur": 1, "motion": [] } — fale: rozmyte pasma przy dole z jasnymi brzegami (barwa "hue"…"hue"+"spread"); w pokazie Cogita stoją — z "motion": { "name": "wave" } płyną
  "speed" 0–1 — jak wolno warstwa przesuwa się przy przewijaniu; "opacity" 0–1. Obraz może być plikiem strony: "page-image:<id>".
  Kolory warstw mogą być nazwami: "ground", "accent", "ink", "muted" — wtedy idą za kolorami slajdów. "seed" — ta sama liczba daje ten sam obraz za każdym razem; "motion" — ruch warstwy (niżej: Ruch), "[]" — stoi.

Slajd modułu ("slide") — wszystko poza "label" i "layers" jest nieobowiązkowe:
  "transition" — jak ten slajd zastępuje poprzedni: "scroll" (wjeżdża od dołu, zwykłe), "fade" (przenika), "cover" (nakrywa poprzedni, który przygasa), "reveal" (poprzedni odjeżdża i go odsłania), "zoom" (przybliżenie), "side" (z prawej), "dissolve" (rozmycie: poprzedni gaśnie, rozmywa się i opada o 12 px, ten wyostrza się, unosząc — jak pokaz Cogita). Idzie za przewijaniem, nie za zegarem
  "enter" — jak pojawia się treść: "none", "rise", "fade", "zoom", "left", "right"
  "colors" — własne kolory slajdu, przechodzą płynnie między slajdami: { "accent", "ink", "ground", "muted" } ("#rrggbb"; pominięty — jak strona)
  "stage" — moduł NIE ma własnego slajdu: stoi nad wszystkimi i przy zmianie slajdu przesuwa się na swoje miejsce na następnym:
      { "frames": { "<id modułu-slajdu albo "cover">": { "x": 50, "y": 50, "w": 30, "scale": 1, "rotate": 0, "opacity": 1 } }, "bare": false }
      "x", "y" — środek w procentach sceny; "w" — szerokość w procentach; między slajdami z miejscem przesuwa się płynnie, przed pierwszym i po ostatnim stoi; "bare": true — bez ramki (logo, obraz)
      "max" — najwyżej tyle szerokości w rem (logo zostaje logo na dużym ekranie); "tall" — inne wartości na ekranie wyższym niż szeroki (telefon): { "x", "y", "w", "scale", "rotate", "opacity" } — tylko te, które się różnią; z własnym "w" na telefonie liczy się dokładnie ono
  "motion" — ruch modułu na jego slajdzie albo na scenie (niżej: Ruch), np. { "name": "rise", "delay": 220 } — tekst unosi się po dotarciu slajdu
  "layout" — gdzie stoi treść slajdu: { "align": "start"|"center"|"end", "valign": "start"|"center"|"end", "width": 68, "tall": { "align", "valign", "width" } } — "width" w procentach sceny (szerokość sceny — "deck.width"); "tall" — na telefonie; pominięte — na środku, wygodna szerokość tekstu
  "with" — moduł NIE ma własnego slajdu: stoi obok innego na jego slajdzie, w jednym rzędzie: { "slide": "<id modułu>", "side": "end"|"start", "share": 42, "tallSide": "start"|"end" } — "side" po prawej / po lewej, "share" — % szerokości rzędu, "tallSide" — na telefonie nad nim / pod nim (obraz, animacja obok tekstu); "with": "<id>" też wystarczy

## Prezentacja ("mode": "presentation")
Sceny to ekrany; moduły stoją na nich w dowolnym miejscu. Scena może mieć kilka kroków — wtedy wyróżnienie przechodzi z modułu na moduł, a scena idzie za wyróżnionym. Moduł z miejscem na kilku scenach wędruje: przy zmianie sceny przechodzi płynnie na swoje następne miejsce. Wszystko idzie za przewijaniem (kółko, palec, strzałki), w „Pokazie” — za klawiaturą i kliknięciem.
Wewnątrz sceny moduł może zmieniać się z jej POSTĘPEM ("frames" miejsca): duże zdjęcie maleje do kadru, przesuwa się, odsłania przez maskę — przewijanie wstecz cofa zmianę, zatrzymanie ją zatrzymuje, a koło, palec, klawiatura i pokaz poruszają ten sam postęp. Im więcej "steps" ma scena, tym dłuższa jej droga.
Sceny nie muszą iść po kolei: każda ma jedno wejście i wyjścia — „dalej” (strzałki, przewijanie: "next") i przyciski (moduły z "go"). Wyjście prowadzi do sceny, do końca ("end") albo na zewnątrz ("link:<id>" z "links"). Kto naciśnie przycisk, idzie dalej tą drogą; wstecz — drogą, którą przyszedł.

"show" strony:
  "format" — "screen" (cały ekran, jak strona startowa; na telefonie pionowo — z miejscami "tall"), "wide" (16:9), "classic" (4:3)
  "fonts" — pismo: "app", "spectral" (Spectral + IBM Plex Sans), "cormorant" (Cormorant Garamond + Source Sans), "plex" (IBM Plex Sans)
  "nav" — pasek scen: "labels" (nazwy u góry), "dots" (kropki z prawej), "none"
  "links" — drogi na zewnątrz: [{ "id": "zapisy", "label": "Zapisz się", "href": "https://…" | "#/strona" | "mailto:…" }] — wyjście sceny albo przycisku prowadzi tam przez "link:<id>"
  "width" — najwyżej tyle rem szerokości sceny: w niej liczą się miejsca modułów (x, y w procentach), tło zostaje na całym ekranie (np. 80 — jak pokaz Cogita); pominięte — całe okno
  "sound" — dźwięk otoczenia (ogień, liście), tylko na życzenie widza: { "url": "page-image:<id>" | "https://…/ogrod.mp3", "label": "Odgłosy ogrodu", "volume": 0.6 } — w pasku na dole jest przycisk z "label"; bez kliknięcia nic nie gra; gra w kółko, cichnie, gdy karta jest ukryta. Plik: MP3, M4A, OGG albo WAV (plik strony do 30 MB). Głośność na scenie — "volume" sceny
  "backdrop" — tło wspólne: warstwy (jak przy slajdach: "gradient", "image", "glow", "vignette", "haze", "mesh", "waves" …), które stoją za wszystkimi scenami; sceny są wtedy przezroczyste, a ich własne tło (kolor "ground", warstwy "layers") leży w nim i przechodzi płynnie w tło następnej
  "map" — gdzie stoją sceny na mapie przejść w edytorze: { "<klucz sceny>" | "link:<id>" | "gate:<klucz>" | "end": { "x", "y" } } — tylko dla edytora
  "story" — PRZEBIEG (jak w Cogicie): pytania, warunki, wartości; prezentacja z modułem "question" ma go zawsze (wtedy odpowiedzi zostają w przeglądarce). { "base": "<id bazy wiedzy>", "storage": "<id obszaru>", "values": [...], "gates": [...] }
    "base" — baza wiedzy (Cogita), w której liczą się odpowiedzi zalogowanych (i osób z formularza); pominięte — przykład: odpowiedzi, wartości i miejsce, w którym ktoś skończył, zostają tylko w przeglądarce
    "storage" — obszar (z przyjmowaniem), do którego trafiają odpowiedzi; pominięte — prywatny obszar osoby
    "values" — [{ "id": "pkt", "label": "Punkty", "start": 0, "min": 0, "max": 10 }] — wartości przebiegu (punkty, bliskość postaci)
    w bazie wiedzy ten sam przebieg to przebieg {"look": "scenes", "presentation": "<adres tej strony>"} (Prezentacja → Przejścia → „Przebieg w Nauce”): w Nauce gra tę prezentację, odpowiedzi i miejsce liczą się w bazie — bez kopii
    "gates" — bramki między scenami; wyjście sceny, przycisku albo pytania prowadzi do bramki przez "gate:<klucz>":
      { "key": "czy-umie", "label": "Umie?", "type": "condition", "when": { "type": "answered", "of": "<id modułu pytania>", "correct": true }, "yes": "<klucz sceny>", "no": "<klucz sceny>" } — warunek (jak w Cogicie: "answered", "value" { "value": "pkt", "op": "ge", "than": 3 }, "visited" { "of": "<klucz sceny>" }, "knowness", "time", "and"/"or"/"not" z "items")
      { "key": "punkt", "type": "set", "actions": [{ "type": "add", "value": "pkt", "by": 1 } | { "type": "set", "value": "pkt", "to": 0 }], "next": "<cel>" } — zmienia wartości, potem prowadzi dalej
  "scenes" — lista scen w kolejności:
    "key" — klucz sceny (krótki, unikalny, np. "start"); miejsca modułów wskazują scenę po kluczu
    "label" — nazwa w pasku; link "#nazwa" w tekście prowadzi do tej sceny
    "steps" — ile kroków (postojów) ma scena; domyślnie 1
    "change" — jak zastępuje poprzednią: "fade" (przenikanie), "build" (scena jest od razu, jej moduły wchodzą każdy po swojemu — "arrive"), "fly" (kamera przelatuje przez POPRZEDNIĄ scenę — jej moduły z głębią i chmurę słów), "rise", "zoom", "cover", "reveal", "side", "cut", "dissolve" (rozmycie: poprzednia gaśnie, rozmywa się i opada o 12 px, ta wyostrza się, unosząc — jak pokaz Cogita)
    "keep" — true: poprzednia scena zostaje pod spodem, aż przejście się skończy (przy "fade", "build", "rise")
    "duration" — ile trwa skok do tej sceny w ms (domyślnie 700, przy "fly" 1700)
    "colors" — { "accent", "ink", "ground" (tło sceny), "muted" } — pominięte: jak cała prezentacja
    "layers" — warstwy tła (jak przy slajdach, bez przesuwania)
    "grow" — { "from": 0.8, "to": 1.08 } — scena rośnie od wejścia do ostatniego kroku
    "follow" — { "wide": 0.45, "tall": 1 } — jak mocno scena przesuwa się, by wyróżniony moduł stał w środku (szeroki / wąski ekran)
    "emphasis" — false: kroki nie wyróżniają modułów (domyślnie true: niewyróżnione bledną i odsuwają się od środka)
    "thread" — nitka przez moduły z krokami, w kolejności kroków: "none", "line", "dots"
    "hint" — mała podpowiedź na dole (np. "Przewiń"); znika, gdy ruszysz dalej
    "words" — chmura słów w głębi: { "list": ["colligere", …], "prefix": "RE", "count": 39, "seed": 7, "color": null }
    "depth" — { "perspective": 1000, "travel": 2200, "linger": true } — głębia sceny i jak daleko przelatuje kamera; "linger" — zwalnia przy najgłębszym module
    "next" — dokąd prowadzi „dalej” (strzałki, przewijanie): klucz sceny, "end" (tu koniec) albo "link:<id>"; pominięte — następna scena na liście
    "volume" — jak głośny jest dźwięk otoczenia ("sound") na tej scenie, 0–1 (pominięte — 1; 0 — cisza); między scenami przechodzi płynnie

"show" modułu:
  "places" — { "<klucz sceny>": miejsce } — jedno miejsce: moduł należy do tej sceny; kilka: wędruje
    miejsce: { "x": 50, "y": 50, "w": 30, "h": null, "max": null, "rotate": 0, "scale": 1, "opacity": 1, "z": 0, "step": null, "tall": null }
      "x", "y" — punkt modułu (zwykle środek — zob. "origin") w procentach sceny; "w" — szerokość w procentach szerokości; "h" — wysokość w procentach wysokości (null — jak treść)
      "max" — najwyżej tyle szerokości w rem (np. 22): na dużym ekranie moduł nie rośnie dalej, na telefonie bierze "w" procent
      "z" — głębia w pikselach (0 płasko, −980 daleko); "step" — w którym kroku sceny jest wyróżniony (od 0)
      "tall" — inne wartości na wąskim ekranie: { "x", "y", "w", "h", "max", "scale", "rotate", "crop", "mask" } (tylko te, które się różnią)
      "crop" — punkt kadru obrazu na tym miejscu: "57% 40%", "center", "left top" — przy kadrze ("fit": "cover" modułu "image", obraz w oprawie "media") ten punkt zostaje w widoku, gdy pole zmienia wymiary (ognisko zostaje ogniskiem, także na telefonie — "crop" w "tall"); pominięty — "at" obrazu; w klatkach przechodzi płynnie
      "mask" — co z modułu widać: koło { "shape": "circle", "r": 40, "x": 50, "y": 50 } ("r" — promień w %; 71 sięga rogów, gdy środek jest w środku), owal { "shape": "ellipse", "rx": 60, "ry": 40, "x": 50, "y": 50 } ("rx" — % szerokości, "ry" — % wysokości), prostokąt { "shape": "inset", "top": 10, "right": 10, "bottom": 10, "left": 10, "round": 1.5 } (wcięcia w %, "round" — rogi w rem); null — cały moduł; w klatkach maski tego samego kształtu przechodzą płynnie, a maska z null rośnie od całości
      "frames" — KLATKI sterowane postępem sceny (nie zegarem), najwyżej 16: [{ "at": 0.4, "x": 30, "w": 40, "h": 55, "crop": "50% 60%" }, …] — "at" 0–1 postępu albo "step": numer kroku sceny (od 0) zamiast "at"; klatka zmienia tylko to, co podaje ("x", "y", "w", "h", "max", "rotate", "scale", "opacity", "z", "crop", "mask"), reszta zostaje jak w klatce przed nią; samo miejsce to stan przy 0; do każdej klatki moduł przechodzi płynnie w jej "ease" ("inOut" — zwykle, "linear", "in", "out"); po ostatniej zostaje; klatka bez zmian trzyma stan (np. { "at": 0.3 } — stoi do 0,3); "tall" w klatce — jej inne wartości na telefonie
      "by" — czym jest postęp klatek: "scene" (zwykle) — wnętrze sceny: 0 na pierwszym kroku, 1 na ostatnim (scena musi mieć co najmniej 2 "steps"; przy 1 kroku stoi na 0); "enter" — wejście sceny: 0, gdy przejście z poprzedniej się zaczyna, 1, gdy scena jest; "leave" — wyjście sceny: 0 na ostatnim kroku, 1, gdy jest już następna
      "still" — przy ustawieniu „mniej ruchu”: na jakim postępie (0–1) stoją klatki — nieruchoma kompozycja z tymi samymi nagłówkami, obrazami i przyciskami; pominięte — na końcu (przy "leave" — na początku), a klatki ze "step" przeskakują wtedy z kroku na krok, bez drogi pomiędzy
  "skin" — oprawa: "plain" (bez tła), "card" (tafla), "bubble" (bańka), "pill" (pigułka), "panel" (pole wypełniające "w"×"h")
  "type" — tylko "text": "auto" (jak na stronie), "display" (wielkie zdanie — nagłówek strony), "title" (wersaliki), "heading" (nagłówek z treścią), "kicker" (nagłówek w kolorze akcentu z treścią), "body" (akapity), "close" (puenta: kursywa w kolorze akcentu, pusta linia dzieli grupy), "note" (mały dopisek)
  "fill", "ink", "accent" — kolor tła, pisma i akcentu (linki, puenta): "#rrggbb", para "jasny|ciemny" albo nazwa: "accent", "ink", "ground", "muted"
  "origin" — który punkt modułu stoi na "x", "y": "center" (domyślnie), "top-left", "top", "top-right", "left", "right", "bottom-left", "bottom", "bottom-right"
  "media" — obraz w oprawie: { "url", "at": "57% 50%", "fit": "cover"|"contain", "size": 60, "max": null, "opacity": 1, "fade": true, "side": "after"|"before"|"behind" } — przy "contain": "size" w procentach miejsca, "max" najwyżej tyle rem
  "align", "valign" — "start", "center", "end"
  "arrive" — jak się pojawia: "none", "fade", "rise", "zoom", "grow", "left", "right", "from-left", "from-right", "from-top", "from-bottom" (z "from-…" wjeżdża zza krawędzi)
  "delay", "span" — kiedy w przejściu zaczyna (0–1) i jaką jego część trwa (0–1)
  "ease" — ruch wędrującego: "inOut", "linear", "in" (przyspiesza), "out"
  "hold" — true: stoi też przed pierwszym i po ostatnim swoim miejscu
  "between" — moduł z miejscami na scenach NIE po kolei: "glide" — sunie przez sceny pomiędzy (zwykle), "leave" — odchodzi ze swoją sceną i wraca z następną, na której ma miejsce (ten sam obraz na początku i na końcu opowieści, a w środku go nie ma); stoi wtedy zawsze w scenie, na której jest — jak jej własny moduł
  "layer" — wyżej z przodu; wędrujący z ujemnym (-1 … -5) stoi przed tłem sceny, ale za jej tekstami (zdjęcie na całą scenę, a na nim napis) — w scenie swojego pierwszego miejsca, z "between": "leave" w scenie, na której właśnie jest; wędrujący od 10 stoi nad wszystkimi scenami
  "go" — moduł jest przyciskiem: { "<klucz sceny>": cel } — na tej scenie kliknięcie prowadzi do celu (klucz sceny, "end", "link:<id>", "step" — do własnego kroku tego modułu na tej scenie: wyróżnia go, scena zostaje, "step:2" — do kroku 3 tej sceny; "" — jeszcze nigdzie); zamiast klucza sceny "*" — na każdej scenie, na której moduł stoi (np. stały przycisk „Kontakt” z "hold": true), klucz sceny ma pierwszeństwo przed "*"; pytanie ("question") ma zamiast tego wyjścia wyniku: { "<klucz sceny>:right": cel, "<klucz sceny>:wrong": cel } — dokąd prowadzi „Dalej” po dobrej i po złej odpowiedzi (pominięte — „dalej” sceny); celem może być też bramka "gate:<klucz>"
  "motion" — ruch według zegara (opis: Ruch): raz, gdy scena zostaje osiągnięta (np. { "name": "rise", "delay": 220 } — tekst unosi się po dotarciu), albo w pętli, dopóki moduł widać; niezależny od "arrive", które idzie za przewijaniem; z "by" ("scene", "enter", "leave") ruch idzie za postępem sceny zamiast zegara — np. { "name": "keys", "by": "enter", "keys": [{ "at": 0, "clip": "circle(0% at 50% 50%)" }, { "at": 1, "clip": "circle(75% at 50% 50%)" }] } — zdjęcie odsłania się przez rosnące koło, gdy scena wchodzi

Tekst ("text") w prezentacji i na stronie: "## " — śródtytuł, "# " — duża linia, "> " — mała, cicha linia, [napis](https://… | #/strona | #scena | mailto:… | tel:…) — link; linia z samych linków to rząd linków.

## Rodzaje modułów (wybór: moduły trzech części)

### "writing" — Tekst ze skryptorium
Kazanie albo inny tekst ze Skryptorium — z planem, nagraniami wygłoszeń (co powiedziano, co pominięto), przypisami i źródłami z Biblioteki. Dłuższy tekst trzymaj w Skryptorium i pokaż tym modułem; krótki napis zostaje w module „Tekst”. (można otworzyć na pełnym ekranie)
Domyślny rozmiar: 6×5.
"config":
  "scriptorium" — Ze skryptorium — identyfikator skryptorium — najprościej wybrać w edytorze
  "entry" — Który tekst — identyfikator wpisu biblioteki, skryptorium albo bazy wiedzy — najprościej wybrać w edytorze
Przykład "config":
{
  "scriptorium": "<id-skryptorium>",
  "entry": "<id-tekstu>"
}

### "writings" — Archiwum tekstów
Kazania i teksty ze Skryptorium — z wyszukiwaniem i filtrami według pól ich rodzaju (np. tajemnica, obszar), jako lista; każdy otwiera się z planem, nagraniami i źródłami. Tabelę i macierz (np. tajemnice × obszary) daje moduł „Widok”. (można otworzyć na pełnym ekranie)
Domyślny rozmiar: 6×5.
"config":
  "title" — Nagłówek — tekst w jednym wierszu (np. Kazania)
  "scriptorium" — Ze skryptorium — identyfikator skryptorium — najprościej wybrać w edytorze
  "project" — Tylko z projektu (cyklu, książki) — identyfikator wpisu biblioteki, skryptorium albo bazy wiedzy — najprościej wybrać w edytorze
  "layout" — Na początek — tekst w jednym wierszu (lista albo drzewo — odwiedzający może zmienić (tabela: moduł „Widok”))
Przykład "config":
{
  "title": "Kazania",
  "scriptorium": "<id-skryptorium>",
  "project": "<id-projektu albo puste>",
  "layout": "drzewo"
}

### "quotes" — Zbiór cytatów
Cytaty z Biblioteki — ze źródłem (widzi je ten, kto widzi obszar biblioteki); mały kafelek pokazuje „myśl dnia”, duży — zbiór z wyszukiwaniem i wyborem źródła. (można otworzyć na pełnym ekranie)
Domyślny rozmiar: 3×3.
"config":
  "title" — Nagłówek — tekst w jednym wierszu (np. Myśl dnia)
  "library" — Z której biblioteki — identyfikator biblioteki — najprościej wybrać w edytorze
  "work" — Tylko ze źródła — identyfikator wpisu biblioteki, skryptorium albo bazy wiedzy — najprościej wybrać w edytorze
Przykład "config":
{
  "title": "Myśl dnia",
  "library": "<id-biblioteki>",
  "work": "<id-dzieła albo puste>"
}

### "question" — Pytanie
Pytanie z odpowiedzią do sprawdzenia. W prezentacji — krok przebiegu: po dobrej i po złej odpowiedzi może prowadzić w inne miejsce, a odpowiedzi liczą się w przeglądarce albo w Cogicie. (w edytorze: własny edytor list)
Domyślny rozmiar: 4×3.
"config":
  "form" — "one" — jedna z kilku, "many" — kilka, "truefalse", "text", "number", "flash" — fiszka
  "prompt" — treść pytania (przy fiszce: przód)
  "options" — możliwości, każda w osobnej linii (one, many)
  "correct" — numery dobrych możliwości od 0, po przecinku, np. "1" albo "0,2"
  "answers" — dobre odpowiedzi, każda w osobnej linii (text, number); odwrotna strona (flash)
  "value" — "tak" albo "nie" — czy zdanie jest prawdziwe (truefalse)
  "explain" — wyjaśnienie pokazywane po odpowiedzi
  "unit" — jednostka dobrych odpowiedzi, np. "N·m" (number)
  "quantity" — wielkość (number) — np. "Torque" (moment siły), "Energy", "Mass", "Length"; wtedy odpowiedź w innej jednostce tej wielkości jest przeliczana, a jednostka innej wielkości jest błędem ("12 J" na pytanie o moment siły)
  "tolerance" — ile wolno się pomylić, w jednostce pytania, np. "0,5" (number)
Przykład "config":
{
  "form": "one",
  "prompt": [
    "Ile jest sakramentów?"
  ],
  "options": [
    "Pięć",
    "Siedem",
    "Dwanaście"
  ],
  "correct": "1",
  "answers": [
    "siedem",
    "7"
  ],
  "value": "tak",
  "explain": [
    "Chrzest, bierzmowanie, Eucharystia, pokuta, namaszczenie chorych, kapłaństwo, małżeństwo."
  ],
  "unit": "szt.",
  "quantity": "Dimensionless",
  "tolerance": "0"
}

### "cogita-revision" — Powtórka
Powtórka z bazy wiedzy (Cogita). Widzą ją ci, którzy mogą czytać bazę — w jawnym obszarze (baza otwarta) każdy, bez konta; postępy bez konta zostają w przeglądarce. (można otworzyć na pełnym ekranie)
Domyślny rozmiar: 4×3.
"config":
  "title" — Nagłówek — tekst w jednym wierszu (puste: nazwa powtórki)
  "library" — Z której bazy wiedzy — identyfikator bazy wiedzy (Cogita) — najprościej wybrać w edytorze
  "revision" — Która powtórka — identyfikator wpisu biblioteki, skryptorium albo bazy wiedzy — najprościej wybrać w edytorze
Przykład "config":
{
  "title": "Powtórka przed bierzmowaniem",
  "library": "<id-biblioteki>",
  "revision": "<id-powtórki>"
}

### "cogita-flow" — Kurs / opowieść
Przebieg z bazy wiedzy (Cogita): kurs, opowieść, rozmowa w dymkach, mapa do odkrywania. Widzą go ci, którzy mogą czytać bazę — w jawnym obszarze każdy, bez konta. (można otworzyć na pełnym ekranie)
Domyślny rozmiar: 6×5.
"config":
  "title" — Nagłówek — tekst w jednym wierszu (puste: nazwa przebiegu)
  "library" — Z której bazy wiedzy — identyfikator bazy wiedzy (Cogita) — najprościej wybrać w edytorze
  "flow" — Który przebieg — identyfikator wpisu biblioteki, skryptorium albo bazy wiedzy — najprościej wybrać w edytorze
Przykład "config":
{
  "title": "Droga przez Ewangelię Marka",
  "library": "<id-biblioteki>",
  "flow": "<id-przebiegu>"
}

### "knowledge-map" — Mapa wiedzy (WYCOFANY — nie dodawaj; zastąpił go moduł „Widok” (mapa). na stronie dodaj moduł „Widok” i usuń ten)
Wpisy powtórki jako mapa: co już umiesz, jest jasne; granica do odkrycia; reszta we mgle. Widzą ją ci, którzy mogą czytać bazę (jawny obszar: każdy, bez konta). (można otworzyć na pełnym ekranie)
Domyślny rozmiar: 6×5.
"config":
  "title" — Nagłówek — tekst w jednym wierszu (np. Mapa wiedzy)
  "library" — Z której bazy wiedzy — identyfikator bazy wiedzy (Cogita) — najprościej wybrać w edytorze
  "revision" — Z której powtórki — identyfikator wpisu biblioteki, skryptorium albo bazy wiedzy — najprościej wybrać w edytorze
Przykład "config":
{
  "title": "Mapa: Dzieje Apostolskie",
  "library": "<id-biblioteki>",
  "revision": "<id-powtórki>"
}

### "entity-card" — Karta wpisu
Jeden wpis bazy wiedzy — postać, miejsce, pojęcie, wiedza — z polami i zdjęciem. Widzą go ci, którzy mogą czytać bazę. (można otworzyć na pełnym ekranie)
Domyślny rozmiar: 3×3.
"config":
  "title" — Nagłówek — tekst w jednym wierszu (puste: nazwa wpisu)
  "library" — Z której bazy wiedzy — identyfikator bazy wiedzy (Cogita) — najprościej wybrać w edytorze
  "entry" — Który wpis — identyfikator wpisu biblioteki, skryptorium albo bazy wiedzy — najprościej wybrać w edytorze
Przykład "config":
{
  "title": "Św. Józef",
  "library": "<id-biblioteki>",
  "entry": "<id-wpisu>"
}

### "entity-table" — Tabela wpisów (WYCOFANY — nie dodawaj; zastąpił go moduł „Widok” (tabela). na stronie dodaj moduł „Widok” i usuń ten)
Wpisy bazy wiedzy jako tabela — z wyszukiwaniem; mały kafelek pokazuje listę. Widzą je ci, którzy mogą czytać bazę. (można otworzyć na pełnym ekranie)
Domyślny rozmiar: 6×3.
"config":
  "title" — Nagłówek — tekst w jednym wierszu (np. Postacie)
  "library" — Z której bazy wiedzy — identyfikator bazy wiedzy (Cogita) — najprościej wybrać w edytorze
  "kind" — Tylko rodzaj — tekst w jednym wierszu (nazwa rodzaju, np. Postać — puste: wszystkie)
  "columns" — Kolumny — tekst w jednym wierszu (nazwy pól po przecinku — puste: cztery pierwsze)
Przykład "config":
{
  "title": "Postacie Starego Testamentu",
  "library": "<id-biblioteki>",
  "kind": "Postać",
  "columns": "Kiedy żył, Księga"
}

### "topic-explorer" — Tematy (WYCOFANY — nie dodawaj; tematów już nie ma — zastąpił go moduł „Widok” (drzewo albo macierz według osi: własnych rodzajów, np. Tajemnica × Obszar). na stronie dodaj moduł „Widok” i usuń ten)
Dawniej: tematy bazy wiedzy. Tematów już nie ma — moduł pokazuje tylko informację; porządek daje moduł „Widok” z osiami (rodzajami). (można otworzyć na pełnym ekranie)
Domyślny rozmiar: 4×3.
"config":
  "title" — Nagłówek — tekst w jednym wierszu (np. Tematy)
  "library" — Z której bazy wiedzy — identyfikator bazy wiedzy (Cogita) — najprościej wybrać w edytorze
Przykład "config":
{
  "title": "Tematy katechezy",
  "library": "<id-bazy-wiedzy>"
}

### "view" — Widok
Zapisany widok bazy wiedzy (Nauka → baza → Wpisy → „Zapisz jako widok"): wybrane wpisy — także kazania i komentarze z bibliotek, z których baza korzysta — jako tabela, drzewo z grupami, macierz (np. 20 tajemnic × 12 okresów; pole otwiera swoje wpisy) albo mapa nauki; kliknięty wpis otwiera się pod spodem (komentarz, całe kazanie), droga zostaje w adresie. „Ucz się tego" pyta o pokazane wpisy. Widzi go ten, kto może czytać bazę. (można otworzyć na pełnym ekranie)
Domyślny rozmiar: 6×4.
"config":
  "title" — Nagłówek — tekst w jednym wierszu (puste: nazwa widoku)
  "library" — Z której bazy wiedzy — identyfikator bazy wiedzy (Cogita) — najprościej wybrać w edytorze
  "view" — Który widok — identyfikator wpisu biblioteki, skryptorium albo bazy wiedzy — najprościej wybrać w edytorze
  "mode" — Jak pokazać — tekst w jednym wierszu (tabela, drzewo, macierz albo mapa — puste: jak zapisano)
Przykład "config":
{
  "title": "Tajemnice i okresy",
  "library": "<id-bazy-wiedzy>",
  "view": "<id-widoku>",
  "mode": "macierz"
}
