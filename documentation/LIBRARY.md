# Library — the shared base for sources, quotations, own writing and Cogita

Status: implemented 2026-10-01 (migration `0064_library.sql`). This file explains the design. The code comments carry the details.

## What it is for

- **Publishing sermons and other texts** on a page. Each text has footnotes, a "Dalsze informacje" (further information) section and its sources, so readers can follow every reference.
- **Organising writing.** Projects (a book, a sermon series, a collection) have an outline of parts and texts, a writing status, target lengths, progress, and a bibliography per project.
- **A collection of quotations**, each with its source, its place in the source, a description and topics. It can be published as a collection or as a "thought of the day".
- **The base for the new Cogita.** A work, an author or a quote exists once. Everything that needs it points at it: a sermon, a book, and later cards, revisions and dependency graphs.

## Model

A **library** belongs to an **area**. Area access is library access: whoever holds the area's epoch key reads it; write capability on the area means editing. "Tylko ja" (the personal area) is the default.

An **entry** is one typed document. The kinds live in `frontend/src/app/library/libraryKinds.ts`:

| kind | what | key fields |
|---|---|---|
| `person` | author, editor, translator, institution | given names, surname or single name, years, description |
| `work` | a source: book, chapter, article, periodical, Church document, Bible, web page, talk | authors / editors / translators (refs), container (ref), volume, issue, edition, publisher, place, year, series, pages, page count, binding, height / width / thickness, siglum, ISBN, own number (private), DOI, URL, original title |
| `quote` | a passage of a work | text, work (ref), locator (`s. 23`, `J 3,16`, `nr 24`), translation, description, topics |
| `topic` | a subject heading, nestable; an **aspect** is a topic marked as an axis (see “Sermons”) | name, description, parent (ref), aspect, order |
| `text` | own writing: sermon, homily, meditation, chapter, article, note | title, date, occasion, readings, summary, **plan** (points), **body** and **further** (markup), project (ref), topics, audio and video links |
| `delivery` | one time a text was preached or given (2026-10-21) | texts (refs), date, occasion, place, audience, readings, audio, video, duration, summary, **coverage** and **added** (items), transcript (markup), topics, hidden |
| `project` | a book or series | outline (`{heading}` and `{text: ref}` items), description |

Every field says whether it is **private**: notes, writing status, deadlines and targets. Private fields never leave the browser in plaintext.

Keyed kinds carry a **citation key** (`ratzinger2007`). Texts cite by key, Pandoc-style: `[@ratzinger2007, s. 23]`, several sources in one note as `[@bt, J 6,35; @ratzinger2007]`, an own footnote as `^[…]`, and an embedded quote as `![@quote-key]`. The markup is in `libraryMarkup.ts` and documented in `MARKUP_DOC`. Footnotes follow Polish humanities practice (`libraryCite.ts`): the first mention is full, later ones are short with "dz. cyt.", an immediate repeat is "Tamże", and a bibliography closes the text.

## Storage and cryptography

- `app.library`: area, epoch, sealed name.
- `app.library_entry`: kind (plaintext), epoch, **one sealed JSON document** (`{v, id, kind, key, data}`) under the area's epoch key, AAD `library:entry:<id>:library_entry:1`. The service never sees fields, references or keys.
- Concurrency: `version` per entry. A save with a stale version gets 409 `stale`, and the editor offers to load the newer version or overwrite.
- Sync: the browser holds the whole library in memory (`libraryStore.ts`) and asks only for what changed since its last read (`updated_at`). Deleted entries are tombstones without a body.
- Search, backlinks ("where is this quote used"), key uniqueness and citation formatting all run in the browser, because only the browser can read entries.

## Publication

Nothing is public until it is explicitly published (`libraryPublish.ts`).

- **Publishing an entry** writes a plaintext projection beside the sealed document: `public_json` holds only non-private fields, and `public_summary` holds the list view.
- **The closure goes with it.** A text publishes what it cites, the quote's work, the work's authors, its topics and its project. Those entries are `implicit`; what you chose yourself is `explicit`. A project shows only its published texts publicly.
- **Unpublishing removes only what nothing else needs.** A quote that a published sermon still cites stays public, as implicit.
- **Edits to a published entry are not pushed automatically.** The editor says "Zmiany nie są jeszcze opublikowane" (changes not yet published), and "Zaktualizuj publikację" (update publication) republishes it together with entries whose summaries name it.
- **Public reads need no login.** `GET /library/{id}/published?kind=&ref=&q=&order=` returns lists. `GET /library/{id}/published/{entryId}` returns one entry plus its published closure, up to depth 4, using `app.library_public_ref`.

## Page modules

| kind | shows | sizes |
|---|---|---|
| `writing` — Tekst z biblioteki (text from the library) | one published text | strip: a button; block: title, date and opening; tall or fullscreen: the full text with notes and sources |
| `writings` — Archiwum tekstów (text archive) | published texts of a library, project or topic, newest first | strip: the newest; block: recent texts; tall and fullscreen: the whole archive — search, a filter per aspect, list (by year), table (a column per aspect) or tree (the topics of an aspect with counts); `?t=<id>` opens a text (see “Sermons”) |
| `quotes` — Zbiór cytatów (quote collection) | published quotes | small: "Myśl dnia" (one or two quotes, changing daily, the same for everyone); tall: search and topic filter |

## Sermons: plan, deliveries, aspects (2026-10-21)

A page for a very large number of sermons, built from the existing pieces. The rule: **the order lives in the library, not in the page module.** The page needs no new module, no new page type and no page subject; the two existing modules (`writing`, `writings`) show more, and the archive module gained one setting.

### The model

- **A sermon is a `text`** (as before). It may now have a **plan** (`plan`, field type `items`): the main thoughts in order and, under each, quotes, examples, questions and applications.
  - A point is `{ id, text, depth, kind, note }`. `text` is markup, so `[@key, s. 12]` becomes a footnote and a point that is only `![@quote-key]` is a quote from the library, shown in full. `depth` is 0 (main thought), 1 or 2. `kind` is thought, quote, example, question or application. `note` is private (never published).
  - Every point keeps a **stable id** (`p4k2x`) wherever it moves. Deliveries refer to points by it.
  - The plan's sources count like the body's: backlinks, publication, the bibliography, LaTeX, the dependency map (`markupsOf` in `libraryKinds.ts` collects all markup of an entry, sub-fields included).
- **A delivery (`delivery`, "Wygłoszenie") is one time a text was preached** — the "record". One text, many deliveries (every Mass of a Sunday, and again years later). It names its text(s), date, occasion, place, audience, readings, recording (audio/video URL), duration and a summary, and says about the plan:
  - `coverage`: per point, `said` / `short` (only mentioned) / `skipped`, the time in the recording (`m:ss`) and a note on what was different;
  - `added`: what was said that is not in the plan, with its time and the point it came after;
  - `transcript` (markup), its own topics, private notes, and `hidden` ("Nie publikuj").
- **Aspects are topics marked as axes** (`aspect: "yes"`): "Okres liturgiczny", "Temat", "Księga", "Okazja". Their sub-topics, at any depth, are the values; `order` sorts siblings (liturgical seasons in their order). One sermon carries values of several aspects at once. Topics outside any aspect are "Inne tematy"; a library without aspects gets one axis "Tematy".
- **Series** stay `project` entries (groups).

So the three ways to organise the user asked for are: groups = projects, hierarchies = topic trees, table = aspects as columns.

### Publication

- **A delivery goes out with its text.** Publishing a text publishes its deliveries (implicit) — except the hidden ones. A delivery is never published on its own. Its box in the editor says whether it is out, and "Opublikuj razem z tekstem" / "Zaktualizuj publikację" refreshes it together with its text.
- The text's public document lists its deliveries (`deliveries`, newest first), and its public refs include them, so **one request returns the sermon with its recordings**, quotes, works and topics. A new or changed delivery makes the text "not current" ("Zmiany nie są jeszcze opublikowane").
- **Topic refs include the topics above** (`publicRefs`): a sermon tagged "I Niedziela Adwentu" is also found under "Adwent" and "Okres liturgiczny", and counts per topic are exact — without the service knowing the tree.
- The text's summary carries the main thoughts, the number of deliveries, the last date and up to 12 deliveries; its public sort key is the **date it was last preached**.
- Entries published before 2026-10-21 lack the ancestors and the new summary fields until republished: Ustawienia → "Odśwież wszystkie publikacje" republishes everything once.

### On the page

- **`writing` (one text)** and an opened text in the archive show: header → **Wygłoszenia** (newest first; choosing one opens its player, summary and transcript) → **Plan** (numbered like on the pulpit: 1, 1.1, 2) → the full text → further information, footnotes, sources, topic chips with their aspect. With a delivery chosen, the plan shows on each point ✓ said / ◐ short / ✕ skipped, the time (a click jumps in the player — or opens YouTube/Vimeo/a file at that place) and the note; what was added stands after its point. Block size: title, date, main thoughts.
- **`writings` (the archive)**, tall and fullscreen: search, a select per aspect (values indented, with counts), chips of the chosen filters, and three views the visitor can switch — **Lista** (year headings), **Tabela** (a column per aspect plus "Cykl"; on a phone each row becomes a labelled card) and **Drzewo** (tabs per aspect, the topic tree with counts, results beside it). The setting "Na początek" (`layout`: lista, tabela, drzewo) picks the starting view. One value per aspect; different aspects add up (AND); a value of an aspect is counted without that aspect's own filter, so its other values stay visible.
- The state is in the address: `?t=` (open text), `?tw=` (chosen delivery), `?tu=` (view), `?tq=` (search), `?tf=` (chosen values), `?to=` (order). A link to a delivery opens its sermon with it chosen.
- Files: `library/LibraryBrowse.tsx` (archive), `browse.ts` and `archiveLayout.ts` (pure logic), `SermonParts.tsx` (plan and deliveries), `LibraryText.tsx` (the text), `markupView.tsx` (markup drawing shared by both), `topics.ts` (tree and aspects), `styles/sermons.css`.

### The service

`GET /library/{id}/published/browse?kind=&ref=a,b&ref=c&q=&order=&take=&skip=&counts=true` (anonymous, `Library.Publish.cs`): several filters at once — a comma is OR, another `ref` is AND (at most 8 filters, 200 values each, 400 in all) — order `sort`, `-sort`, `key` (≈ title), `-key`, and with `counts` how many of the found entries point at each target. A page facing an older service (404) falls back to `published` with one filter and no counts.

### In the workspace

- **Plan** is the first tab of a text (Plan · Treść · Dalsze informacje), an outliner (`PlanEditor.tsx`): Enter makes a point (splitting at the cursor), Tab / Shift+Tab deeper / higher, Alt+↑↓ moves, Backspace in an empty point removes it, Esc leaves the point. "Źródło…" and "Cytat z biblioteki…" work as in the body; a kind per point; a private note; "Wklej gotowy plan" reads a typed outline (numbers, letters, indentation, `>` quotes, `?` questions — `planFromText`).
- A text's side shows its **Wygłoszenia** with "+ Wygłoszenie". The delivery form (`DeliveryForm.tsx`): text, day, place; the recording (a file plays right there, and ⏱ beside a point takes the player's time); "Co z planu zostało powiedziane" point by point (three buttons, time, note; "Resztę oznacz: …"); "Co doszło"; summary, topics, transcript.
- **Topics per aspect**: every `topics` field shows a row per aspect (values of that aspect only; "+ Utwórz" creates the value under its aspect) and "Inne tematy" (`TopicPick.tsx`). The Tematy tab shows the tree with an "aspekt" badge and "+ Aspekt".
- A library tab **Wygłoszenia** lists all deliveries by date with what was said.

### AI stays outside

Two prompts to copy into one's own chat, each with an import that fills the **open form** (`patchFromDoc`), not the store behind it:
- on a delivery, "Z nagrania albo zapisu — przez AI we własnym czacie": the plan with its point ids, the rules and the format; the answer (library JSON for this delivery) fills coverage, added, summary, duration, transcript (`deliveryPrompt`);
- on a text with a body, "Plan z treści": the body; the answer fills the plan (`planPrompt`).

### Printing

`textToLatex` puts the plan (nested `enumerate`, footnotes) before the body. `planToLatex` prints **only the plan for the pulpit**: one page, 14 pt, quotes in full, own notes on request — "Plan na ambonę (.tex)" in the editor, "Sam plan (LaTeX)" on the page.

### Further expansions this is built for

- Other prepared talks use the same pieces: conferences, catechesis, retreat talks (`textType`) with deliveries; a retreat is a project.
- `items` is a general field type (a list of objects with declared sub-fields): described, imported, searched and published like any field.
- Aspects serve every kind with `topics` (quotes, works), and any later list module can use `browse` the same way.
- Natural next steps, not built: a delivery linked to a calendar item (the Mass it was preached at), recordings stored as library files instead of URLs, a podcast feed of public deliveries, filtering texts by the topics of their deliveries.

### Checks

`app-library-check.mjs` section 7 (plan reading and numbering, pasting, times and links, aspects, publication with deliveries and topic ancestors, marks on the drawn plan, LaTeX, prompts, JSON into the form, archive rows and filters); `Api.Tests` LibraryChecks (filter groups, order); a browser harness drive outside the repository (67 checks: table, filters, tree, list, opening, marks, player, phone, dark, an older service, the editors).

## Books on the shelf

A `work` of a printed kind (book, periodical, Bible, document, other) also records:
- page count, binding (`BINDINGS` in `libraryKinds.ts`), height / width / thickness in cm;
- series and the original title;
- the library's own number for the copy (`libraryNumber`, private).

The library is meant to work with real shelves:

- **Scan to get to a book** (`BookLookup.tsx`, "Skanuj kod" beside the library search):
  - The code on the back cover (EAN-13 = ISBN) or on an own label (the library number) opens that book.
  - An unknown ISBN offers "Znajdź w katalogach i dodaj" (find in catalogues and add).
  - Codes are read from the live camera, from a photo of the code, or by typing. `barcode.ts` uses the browser's `BarcodeDetector` where it exists and ZXing (`@zxing/library`, its own lazy chunk `vendor-barcode`) everywhere else.
  - The Android app declares `CAMERA` for this.
- **The catalogue** (`libraryCatalog.ts`):
  - `GET /library/catalog/{isbn}` (`LibraryCatalog.cs`) relays the Biblioteka Narodowa union catalogue (MARC 21), e-ISBN (publishers' ONIX) and Open Library. The first two send no CORS headers, so the browser cannot ask them directly.
  - The browser parses the answer, so mapping the catalogue data onto library fields happens there, like all other library logic.
  - The browser calls the relay without a session, so no account is tied to a lookup. The service rate-limits by IP and caches answers for an hour.
  - One ISBN often has several descriptions (editions). All of them are shown, the fullest exact one first, and the reader picks the copy in hand.
  - Persons already in the library are reused; new ones are created with the work.
  - In the editor, "Uzupełnij z katalogu" (fill from catalogue) fills **only empty fields**.
- **Own numbers**:
  - "Nadaj kolejny" (assign next) proposes the next free number in the style of the last one (`B-0042` → `B-0043`).
  - A duplicate number is flagged.
  - A label can be scanned into the field.

## Quotes from a book

The usual way of collecting quotes:
1. Read and mark passages in pencil.
2. After a few pages, photograph the marked pages.
3. Give the photos and the prompt to your own AI chat (ChatGPT, Claude, Gemini…). It transcribes them as JSON.
4. Import that JSON. All the quotes are bound to that book.

The app calls no AI and uploads no photos. Only the JSON comes in.

`QuoteIntake.tsx` sits under a work's fields as "Cytaty z tej książki" (quotes from this book). It has three parts:

- **The list**, sorted by page.
- **Quick add**: text and page; the page stays for the next quote.
- **"Import cytatów z JSON"** (import quotes from JSON):
  1. Choose what counts as a quote: pencil-marked passages, or the whole text of each photo. Copy the prompt (`quotesPrompt`). It names the book, explains the transcription rules and carries the JSON format.
  2. Paste the AI's answer, or load it as a file.
  3. Review each quote:
     - Uncertain readings are marked "do sprawdzenia" (to check).
     - Quotes already in the book are unchecked.
     - Page ranges become `s. 23–24`.
     - New topic names can become topics.
  4. Save them all at once.

The format is `recreatio/quotes` (`libraryQuotes.ts`). Its description is generated from the `quote` kind's fields plus `page`, `uncertain` and `id`, and is shown beside the paste box. "Eksportuj cytaty tej książki" (export this book's quotes) writes the same format with ids. Re-importing it changes those quotes in place.

## Printing: LaTeX

Printing goes through LaTeX (`libraryLatex.ts`). The page draws the markup as HTML; the same parse tree is written out as one self-contained `.tex` file for `pdflatex` or `lualatex` (UTF-8, Polish babel, no separate bibliography file).

- **A text** becomes an `article`: title page, the meta line (type, date, occasion, place, readings), `##` → `\section*`, `###` → `\subsection*`, quotes and embedded library quotes as `quotation` with their origin, own notes and citations as `\footnote` in the Polish style (`dz. cyt.`, `Tamże`), and "Źródła" (sources) at the end.
- **A project** becomes a `book`: outline headings → `\part*`, texts → `\chapter*` in outline order, one table of contents, footnotes counted over the whole book, sources once at the end.
- **Where:** the editor's side panel "LaTeX" (download, copy, preview; the author line is remembered). The public `writing` module offers "Pobierz do druku (LaTeX)" (download for print) from what is published.
- **Checks:** `scripts/app-platform-check.mjs` checks escaping, the first full citation, `Tamże`, quotes, lists, notes, sources and the book layout.

## JSON

These follow the standing JSON rule.

- **Library documents** (`recreatio/library`): export everything or chosen kinds. Import matches entries by id or by key and changes them in place, setting only the fields given. References can be `@keys`, so a whole library can be written by hand or by an AI. Nothing is deleted.
- **Lenient values:** numbers may carry units (`"384 s."`, `"20,5 cm"`), and a select field takes its value or its label (`"hard"` or `"Twarda"`).
- **Where:** the library's "Import / eksport" tab, the bottom of every list (that kind only), and every entry. On a **new** entry, the one entry of its kind in the document becomes this entry, so pasting a book written by an AI opens that book.
- **Quotes of one book** (`recreatio/quotes`, see above) are imported on that book's page. The library import refuses them and says where they belong.
- **Description:** every JSON panel shows `libraryDescription()`, generated from the kinds registry.
- **Page modules:** `writing`, `writings` and `quotes` take part in the page JSON (examples in their part files).
- **Checks:** `scripts/app-library-check.mjs` enforces that every field is described, that the examples import without warnings, and that export followed by import changes nothing. Its section 6 covers the book tools:
  - ISBN rules;
  - a drawn EAN-13 decoded by ZXing;
  - the catalogue parsers, against a real BN/e-ISBN answer in `scripts/fixtures/`;
  - person reuse and own numbers;
  - the quotes format: plan, import, export → import, and that its description covers every quote field.

## How Cogita builds on this

- **A notion is a library entry.** Cogita's own kinds (`word`, `sentence`, `language`, `question`, …) are added to `KINDS` with their fields, examples and descriptions. Nothing else needs to change for storage, sync, search, JSON or publication.
- **Cards, revisions, knowness and dependency graphs reference entries by id.** They should live in their own tables keyed by `library_entry.id`. Cards can be generated from an entry's kind, for example quote → completion card or person → "who wrote" card.
- **Collections are queries over the store** (kind, topic, project) or explicit lists of entry ids.
- **Writing in Cogita is the `text` and `project` kinds.** The Cogita spec's "citation / notion insertion" is the `[@key]` and `![@key]` markup.

## Adding a kind

1. Add a `LibKind` in `libraryKinds.ts`. It needs fields with `says` and private flags, `title`, `sort`, and a filled `example`.
2. If its list view needs specific data, add a case to `publicSummary` in `libraryPublish.ts`.
3. If it should cite in a special way, add a case to `citeSegs` / `workSegs` in `libraryCite.ts`.
4. If it gets its own workspace tab, add it to `TABS` in `LibraryView.tsx`.
5. Run `npm run app:check`. The library check fails until every field is described and the example imports cleanly.
