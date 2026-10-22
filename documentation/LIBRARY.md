# Library — the shared base for sources, quotations, own writing and Cogita

Status: implemented 2026-10-01 (migration `0064_library.sql`). This file explains the design. The code comments carry the details.

## What it is for

- **Publishing sermons and other texts** on a page. Each text has footnotes, a "Dalsze informacje" (further information) section and its sources, so readers can follow every reference.
- **Organising writing.** Projects (a book, a sermon series, a collection) have an outline of parts and texts, a writing status, target lengths, progress, and a bibliography per project.
- **A collection of quotations**, each with its source, its place in the source and topics; what you think about one is a comment. A page shows them as a collection or as a "thought of the day".
- **The base for the new Cogita.** A work, an author or a quote exists once. Everything that needs it points at it: a sermon, a book, and later cards, revisions and dependency graphs.

## Model

A **library** belongs to an **area**, and an area has at most one library (the service refuses a second). Area access is library access: whoever holds the area's epoch key reads it; write capability on the area means editing. "Tylko ja" (the personal area) is the default.

**Visibility is decided by the area, and only by it** (since 2026-10-22). Members of the area see its library; if the area is public, everyone does. There is no per-entry publishing and there are no private fields. To make an entry public, move it into the library of a public area ("Przenieś do innej biblioteki" in the entry's "Kto widzi" box); to keep something to yourself, put it in your private area's library. Knowledge bases (Cogita) keep their own publishing for now.

**All readable libraries work together.** The workspace opens one library and syncs the others in the background (`LibraryStore.peers`): references, embedding, search, backlinks and "comments about this entry" reach across all libraries the user can read. Lists, saving and export stay per library; a kind list can include the other libraries ("też z innych bibliotek"). An entry of another library is edited in its own library.

An **entry** is one typed document. The kinds live in `frontend/src/app/library/libraryKinds.ts`:

| kind | what | key fields |
|---|---|---|
| `person` | author, editor, translator, institution | given names, surname or single name, years, description |
| `work` | a source: book, chapter, article, periodical, Church document, Bible, web page, talk | authors / editors / translators (refs), container (ref), volume, issue, edition, publisher, place, year, series, pages, page count, binding, height / width / thickness, siglum, ISBN, own number, DOI, URL, original title |
| `quote` | a passage of a work | text, work (ref), locator (`s. 23`, `J 3,16`, `nr 24`), translation, topics |
| `topic` | a subject heading, nestable; an **aspect** is a topic marked as an axis (see “Sermons”) | name, description, parent (ref), aspect, order |
| `text` | own writing: sermon, homily, meditation, chapter, article, note | title, date, occasion, readings, summary, **plan** (points), **body** and **further** (markup), project (ref), topics, audio and video links |
| `delivery` | one time a text was preached or given (2026-10-21) | texts (refs), date, occasion, place, audience, readings, audio, video, duration, summary, **coverage** and **added** (items), transcript (markup), topics |
| `comment` | own thinking about sources, quotes, Bible passages, plan points or other comments (2026-10-22) | **subjects** (refs with locator and, for a text, a plan point), **blocks**, topics |
| `project` | a book or series | outline (`{heading}` and `{text: ref}` items), description |

What stays on an entry is its own description in the narrow sense: a topic's definition, a person's bio, a project's description, a text's summary. Everything else one thinks about an entry is a comment.

Keyed kinds carry a **citation key** (`ratzinger2007`). Texts cite by key, Pandoc-style: `[@ratzinger2007, s. 23]`, several sources in one note as `[@bt, J 6,35; @ratzinger2007]`, an own footnote as `^[…]`, and an embedded quote or comment as `![@key]`. The markup is in `libraryMarkup.ts` and documented in `MARKUP_DOC`. Footnotes follow Polish humanities practice (`libraryCite.ts`): the first mention is full, later ones are short with "dz. cyt.", an immediate repeat is "Tamże", and a bibliography closes the text.

## Storage and cryptography

- `app.library`: area, epoch, sealed name.
- `app.library_entry`: kind (plaintext), epoch, **one sealed JSON document** (`{v, id, kind, key, data}`) under the area's epoch key, AAD `library:entry:<id>:library_entry:1`. The service never sees fields, references or keys.
- Concurrency: `version` per entry. A save with a stale version gets 409 `stale`, and the editor offers to load the newer version or overwrite.
- Sync: the browser holds the whole library in memory (`libraryStore.ts`) and asks only for what changed since its last read (`updated_at`). Deleted entries are tombstones without a body.
- Search, backlinks ("where is this quote used"), key uniqueness and citation formatting all run in the browser, because only the browser can read entries. Keys are unique per library; across libraries a key resolves in the current library first.
- **Moving** (`POST /workspace/library/{id}/entry/{entryId}/move`, `Library.Areas.cs`): the browser reseals the entry under the target area's key; the id stays, so every reference keeps working. The old version goes to `library_entry_version`; `app.library_moved` (0122) lets the old library's sync report the entry as gone.

## Comments (2026-10-22)

A comment (`comment.ts`) is its own entry, written once and used in many texts.

- **`subjects`**: what it is about — entries of any kind, each with a `locator` ("Łk 1,35", "s. 23") and, for a text, a plan `point`. A synthesis is a comment whose subjects are comments.
- **`blocks`**: exactly four types, and the type carries meaning: `paragraph` (prose, in markup), `ordered` (the order matters: a line of thought), `unordered` (equal points), `table` (a comparison: named columns, each row compares the same thing). A list item and a table cell are a sequence of runs: `{text}` (markup) or `{ref, locator}` — a real reference, not text that looks like one. `pairedWith` answers "what was Dz 1,8 set beside?" from the rows.
- No classification fields (no comment type, no certainty): the weight of a claim lives in its words.
- **In texts**: `![@key]` embeds a comment live (its blocks, tables included; footnotes inside count with the text; a comment that embeds itself through others stops with "[komentarz osadza sam siebie]"); `[@key]` cites it in a footnote ("Zob. komentarz: „…”").
- **Reachable wherever the entry is shown**, as far as area access allows: under a quote, under each source in "Źródła", at each plan point, at the end of a text ("Komentarze do tekstu"), in the entry's "Powiązania" box with "+ Komentarz". `Lookup.readable()` provides all readable entries for this.
- **Unreadable targets**: a reference whose target the reader cannot read shows "[odwołanie niedostępne]" — that it exists, nothing about the target, not even its key (`UNREADABLE`, `refLabel`).
- Editor: `CommentForm.tsx` (subjects with locator and point; blocks with type switch, ↑↓×; cells as runs with "+ tekst" / "+ odwołanie"); preview with `CommentCard`. LaTeX: paragraphs, lists, `tabular`.

## Reading on pages

The service never decrypts. A page opens libraries in the browser (`libraryOpen.ts`):

- **public area**: `GET /library/{id}/open?since=` (anonymous) returns all sealed entries under published epoch keys, plus the area id and the sealed name; the browser opens them with `/area/{id}/key?epoch=`. Served only when the area is public **and** the library has been settled (`area_rule_at`, 0122 — see "Migration").
- **otherwise, as a member** (or through a link or seat): `/workspace/library/{id}/entries` with the keys this browser holds.
- **references outside**: ids not found are looked up with `GET /library/where?ids=` (only entries the caller can read, or that lie in a public area); those libraries are opened too. What remains is unreadable.
- An entry that moved to another library is found there (`findOnPage`), so a page configured with the old library still shows it.
- The archive filters, searches and counts in the browser (`browseLocal` in `browse.ts`): a topic also finds its sub-topics, OR within an axis, AND between axes. There are no public summaries or browse endpoints any more.

## Migration (2026-10-22): "Porządki"

`#/workspace/library/porzadki` (`LibraryTidy.tsx`; plan in `libraryMigrate.ts`, execution in `libraryTidyRun.ts`). It runs in the browser, where the keys are, in two steps; nothing happens without a click, and the hard rule is: **nobody may see anything afterwards that they could not see before.**

| before | after |
|---|---|
| `description` of a quote or work | comment about it, in the same library; it moves with its entry |
| `notes` of any kind | comment about it, in the user's **private** library (created if missing) — unless the entry already lies there |
| `note` of a plan point | comment about the text with that `point`, private library |
| status, deadline, targetWords, libraryNumber | unchanged, no longer marked private (decided) |
| `delivery.hidden` | removed |
| entry never published, in a public area | would become public → default: move to the private library; "zostaw — niech będą publiczne" is a choice |
| entry published, in a non-public area | would disappear → default: move to the public library (when there is exactly one); "zostaw" is a choice |
| old public copies (`public_json`) | withdrawn |

1. **Krok 1** creates the comments as copies; the original values stay. The table shows each value, where it goes and a link once it exists. Re-running finds existing comments (same subject and wording).
2. **Krok 2** (after "Sprawdziłem…") removes the old fields — before any move, so nothing old travels into a public library — moves the chosen entries (with their description comments), withdraws old public copies and marks each library settled (`POST /workspace/library/{id}/area-rule`). Only then does `/open` serve a public area's library.

Libraries the user can only read are named and left alone. New libraries are created settled. Importing a version-1 file converts the same fields into comments in the target library (with a warning to move private ones).

## Page modules

| kind | shows | sizes |
|---|---|---|
| `writing` — Tekst z biblioteki (text from the library) | one text | strip: a button; block: title, date and opening; tall or fullscreen: the full text with notes and sources |
| `writings` — Archiwum tekstów (text archive) | the texts of a library, project or topic, newest first | strip: the newest; block: recent texts; tall and fullscreen: the whole archive — search, a filter per aspect, list (by year), table (a column per aspect) or tree (the topics of an aspect with counts); `?t=<id>` opens a text (see “Sermons”) |
| `quotes` — Zbiór cytatów (quote collection) | the quotes of a library, each with its comments | small: "Myśl dnia" (one or two quotes, changing daily, the same for everyone); tall: search and topic filter |

Who sees a module's content is who can read its library (see "Reading on pages"); a reader who cannot sees "Tej biblioteki nie widzisz".

## Sermons: plan, deliveries, aspects (2026-10-21)

A page for a very large number of sermons, built from the existing pieces. The rule: **the order lives in the library, not in the page module.** The page needs no new module, no new page type and no page subject; the two existing modules (`writing`, `writings`) show more, and the archive module gained one setting.

### The model

- **A sermon is a `text`** (as before). It may now have a **plan** (`plan`, field type `items`): the main thoughts in order and, under each, quotes, examples, questions and applications.
  - A point is `{ id, text, depth, kind }`. `text` is markup, so `[@key, s. 12]` becomes a footnote and a point that is only `![@key]` is a quote (or comment) from the library, shown in full. `depth` is 0 (main thought), 1 or 2. `kind` is thought, quote, example, question or application. Thoughts about a point are comments with the text and the point as subject.
  - Every point keeps a **stable id** (`p4k2x`) wherever it moves. Deliveries refer to points by it.
  - The plan's sources count like the body's: backlinks, the bibliography, LaTeX, the dependency map (`markupsOf` in `libraryKinds.ts` collects all markup of an entry, sub-fields included).
- **A delivery (`delivery`, "Wygłoszenie") is one time a text was preached** — the "record". One text, many deliveries (every Mass of a Sunday, and again years later). It names its text(s), date, occasion, place, audience, readings, recording (audio/video URL), duration and a summary, and says about the plan:
  - `coverage`: per point, `said` / `short` (only mentioned) / `skipped`, the time in the recording (`m:ss`) and a note on what was different;
  - `added`: what was said that is not in the plan, with its time and the point it came after;
  - `transcript` (markup) and its own topics.
- **Aspects are topics marked as axes** (`aspect: "yes"`): "Okres liturgiczny", "Temat", "Księga", "Okazja". Their sub-topics, at any depth, are the values; `order` sorts siblings (liturgical seasons in their order). One sermon carries values of several aspects at once. Topics outside any aspect are "Inne tematy"; a library without aspects gets one axis "Tematy".
- **Series** stay `project` entries (groups).

So the three ways to organise the user asked for are: groups = projects, hierarchies = topic trees, table = aspects as columns.

### Visibility

A delivery is seen by whoever reads its library — there is no "Nie publikuj". A text lists its deliveries from backlinks (`deliveriesOf`), newest first; a delivery the reader cannot read is simply not there. The archive's date is the date a text was **last preached**; filters by a topic also find texts tagged with its sub-topics.

### On the page

- **`writing` (one text)** and an opened text in the archive show: header → **Wygłoszenia** (newest first; choosing one opens its player, summary and transcript) → **Plan** (numbered like on the pulpit: 1, 1.1, 2) → the full text → further information, footnotes, sources, topic chips with their aspect. With a delivery chosen, the plan shows on each point ✓ said / ◐ short / ✕ skipped, the time (a click jumps in the player — or opens YouTube/Vimeo/a file at that place) and the note; what was added stands after its point. Each point also folds out its comments ("Komentarze (n)"). Block size: title, date, main thoughts.
- **`writings` (the archive)**, tall and fullscreen: search, a select per aspect (values indented, with counts), chips of the chosen filters, and three views the visitor can switch — **Lista** (year headings), **Tabela** (a column per aspect plus "Cykl"; on a phone each row becomes a labelled card) and **Drzewo** (tabs per aspect, the topic tree with counts, results beside it). The setting "Na początek" (`layout`: lista, tabela, drzewo) picks the starting view. One value per aspect; different aspects add up (AND); a value of an aspect is counted without that aspect's own filter, so its other values stay visible.
- The state is in the address: `?t=` (open text), `?tw=` (chosen delivery), `?tu=` (view), `?tq=` (search), `?tf=` (chosen values), `?to=` (order). A link to a delivery opens its sermon with it chosen.
- Files: `library/LibraryBrowse.tsx` (archive), `browse.ts` and `archiveLayout.ts` (pure logic), `SermonParts.tsx` (plan and deliveries), `LibraryText.tsx` (the text), `markupView.tsx` (markup drawing shared by both), `topics.ts` (tree and aspects), `styles/sermons.css`.

### In the workspace

- **Plan** is the first tab of a text (Plan · Treść · Dalsze informacje), an outliner (`PlanEditor.tsx`): Enter makes a point (splitting at the cursor), Tab / Shift+Tab deeper / higher, Alt+↑↓ moves, Backspace in an empty point removes it, Esc leaves the point. "Źródło…" and "Cytat z biblioteki…" work as in the body; a kind per point; "+ Komentarz do punktu" on the focused point (and links to its comments); "Wklej gotowy plan" reads a typed outline (numbers, letters, indentation, `>` quotes, `?` questions — `planFromText`).
- A text's side shows its **Wygłoszenia** with "+ Wygłoszenie". The delivery form (`DeliveryForm.tsx`): text, day, place; the recording (a file plays right there, and ⏱ beside a point takes the player's time); "Co z planu zostało powiedziane" point by point (three buttons, time, note; "Resztę oznacz: …"); "Co doszło"; summary, topics, transcript.
- **Topics per aspect**: every `topics` field shows a row per aspect (values of that aspect only; "+ Utwórz" creates the value under its aspect) and "Inne tematy" (`TopicPick.tsx`). The Tematy tab shows the tree with an "aspekt" badge and "+ Aspekt".
- A library tab **Wygłoszenia** lists all deliveries by date with what was said.

### AI stays outside

Two prompts to copy into one's own chat, each with an import that fills the **open form** (`patchFromDoc`), not the store behind it:
- on a delivery, "Z nagrania albo zapisu — przez AI we własnym czacie": the plan with its point ids, the rules and the format; the answer (library JSON for this delivery) fills coverage, added, summary, duration, transcript (`deliveryPrompt`);
- on a text with a body, "Plan z treści": the body; the answer fills the plan (`planPrompt`).

### Printing

`textToLatex` puts the plan (nested `enumerate`, footnotes) before the body. `planToLatex` prints **only the plan for the pulpit**: one page, 14 pt, quotes in full, the comments of each point on request — "Plan na ambonę (.tex)" in the editor, "Sam plan (LaTeX)" on the page.

### Further expansions this is built for

- Other prepared talks use the same pieces: conferences, catechesis, retreat talks (`textType`) with deliveries; a retreat is a project.
- `items` is a general field type (a list of objects with declared sub-fields): described, imported and searched like any field.
- Aspects serve every kind with `topics` (quotes, works), and any later list module can use `browse` the same way.
- Natural next steps, not built: a delivery linked to a calendar item (the Mass it was preached at), recordings stored as library files instead of URLs, a podcast feed of public deliveries, filtering texts by the topics of their deliveries.

### Checks

`app-library-check.mjs` section 4 (comments, JSON v2, version-1 conversion, embedding with the cycle guard, unreadable refs, the migration plan) and section 7 (plan reading and numbering, pasting, times and links, aspects, marks and comments on the drawn plan, LaTeX, prompts, JSON into the form, archive rows, filters and counts); `Api.Tests` LibraryChecks (`ParseIds`).

## Books on the shelf

A `work` of a printed kind (book, periodical, Bible, document, other) also records:
- page count, binding (`BINDINGS` in `libraryKinds.ts`), height / width / thickness in cm;
- series and the original title;
- the library's own number for the copy (`libraryNumber`).

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

The format is `recreatio/quotes` (`libraryQuotes.ts`, version 2). Its description is generated from the `quote` kind's fields plus `comment` (becomes a comment about the quote), `check` (what to verify — shown in the review, never saved), `page`, `uncertain` and `id`, and is shown beside the paste box. Version 1's `description` and `notes` are read as `comment`. "Eksportuj cytaty tej książki" (export this book's quotes) writes the same format with ids. Re-importing it changes those quotes in place.

## Printing: LaTeX

Printing goes through LaTeX (`libraryLatex.ts`). The page draws the markup as HTML; the same parse tree is written out as one self-contained `.tex` file for `pdflatex` or `lualatex` (UTF-8, Polish babel, no separate bibliography file).

- **A text** becomes an `article`: title page, the meta line (type, date, occasion, place, readings), `##` → `\section*`, `###` → `\subsection*`, quotes and embedded library quotes as `quotation` with their origin, own notes and citations as `\footnote` in the Polish style (`dz. cyt.`, `Tamże`), and "Źródła" (sources) at the end.
- **A project** becomes a `book`: outline headings → `\part*`, texts → `\chapter*` in outline order, one table of contents, footnotes counted over the whole book, sources once at the end.
- **Where:** the editor's side panel "LaTeX" (download, copy, preview; the author line is remembered). The `writing` module offers "Pobierz do druku (LaTeX)" (download for print) from what the reader can see.
- **Checks:** `scripts/app-platform-check.mjs` checks escaping, the first full citation, `Tamże`, quotes, lists, notes, sources and the book layout.

## JSON

These follow the standing JSON rule.

- **Library documents** (`recreatio/library`, version 2): export everything or chosen kinds. Import matches entries by id or by key and changes them in place, setting only the fields given. References can be `@keys` — also inside comment blocks (runs in list items and table cells) — so a whole library can be written by hand or by an AI. Nothing is deleted. There are no privacy markers; the description says in one line that the area decides who sees an entry, and carries a worked comment example with a table (`COMMENT_DOC`). A version-1 file is read with `description`/`notes`/plan `note` turned into comments.
- **Lenient values:** numbers may carry units (`"384 s."`, `"20,5 cm"`), and a select field takes its value or its label (`"hard"` or `"Twarda"`).
- **Where:** the library's "Import / eksport" tab, the bottom of every list (that kind only), and every entry. On a **new** entry, the one entry of its kind in the document becomes this entry, so pasting a book written by an AI opens that book.
- **Quotes of one book** (`recreatio/quotes`, see above) are imported on that book's page. The library import refuses them and says where they belong.
- **Description:** every JSON panel shows `libraryDescription()`, generated from the kinds registry.
- **Page modules:** `writing`, `writings` and `quotes` take part in the page JSON (examples in their part files).
- **Checks:** `scripts/app-library-check.mjs` enforces that every field is described, that the examples import without warnings, and that export followed by import changes nothing (block types and references included). Its section 6 covers the book tools:
  - ISBN rules;
  - a drawn EAN-13 decoded by ZXing;
  - the catalogue parsers, against a real BN/e-ISBN answer in `scripts/fixtures/`;
  - person reuse and own numbers;
  - the quotes format: plan, import, export → import, and that its description covers every quote field.

## How Cogita builds on this

- **A knowledge base is a library of kind `knowledge`** (0110) in the same store: sealed entries, sync, versions, files. Its own kinds are `kind` documents (schema as data, `cogita/schema.ts`), not entries in `KINDS`; the library kinds appear there as built-in kinds (`cogita/kinds.ts` `fromLibrary`).
- **A base reads libraries as sources** (`settings.sources`, `cogita/sources.ts`): their works, quotes, persons and comments are reference targets and card material; they are never copied.
- **Cards are computed, not stored.** A card is `template:entry[:value]` plus a direction; answers go into sealed `learn_batch` rows of the storage area, keyed by those ids.
- **Collections, views, revisions and flows are documents of the base** that hold entry ids and rules.
- **Writing is the library's `text` and `project`** with the `[@key]` / `![@key]` markup.

## Adding a kind

1. Add a `LibKind` in `libraryKinds.ts`. It needs fields with `says`, `title`, `sort`, and a filled `example`.
2. If it should cite in a special way, add a case to `citeSegs` / `workSegs` in `libraryCite.ts`.
3. If it gets its own workspace tab, add it to `TABS` in `LibraryView.tsx` (and `TAB_OF` in `LibraryEntryBoxes.tsx`).
4. Run `npm run app:check`. The library check fails until every field is described and the example imports cleanly.
