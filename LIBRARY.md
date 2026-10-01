# Library — the shared base for sources, quotations, own writing and Cogita

Status: implemented 2026-10-01 (migration `0064_library.sql`). This file explains the design. The code comments carry the details.

## What it is for

- **Publishing sermons and other texts** on a page. Each text has footnotes, a "Dalsze informacje" (further information) section and its sources, so readers can follow every reference.
- **Organising writing.** Projects (a book, a sermon series, a collection) have an outline of parts and texts, a writing status, target lengths, progress, and a bibliography per project.
- **A collection of quotations**, each with its source, its place in the source, a description and topics. It can be published as a collection or as a "thought of the day".
- **The base for the new Cogita.** A work, an author or a quote exists once. Everything that needs it points at it: a sermon, a book, and later cards, revisions and dependency graphs.

## Model

A **library** belongs to an **area**. Area access is library access: whoever holds the area's epoch key reads it; write capability on the area means editing. "Tylko ja" (the personal area) is the default.

An **entry** is one typed document. The kinds live in `frontend/src/app/libraryKinds.ts`:

| kind | what | key fields |
|---|---|---|
| `person` | author, editor, translator, institution | given names, surname or single name, years, description |
| `work` | a source: book, chapter, article, periodical, Church document, Bible, web page, talk | authors / editors / translators (refs), container (ref), volume, issue, edition, publisher, place, year, pages, siglum, ISBN, DOI, URL |
| `quote` | a passage of a work | text, work (ref), locator (`s. 23`, `J 3,16`, `nr 24`), translation, description, topics |
| `topic` | a subject heading, nestable | name, description, parent (ref) |
| `text` | own writing: sermon, homily, meditation, chapter, article, note | title, date, occasion, readings, summary, **body** and **further** (markup), project (ref), topics, audio and video links |
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
| `writings` — Archiwum tekstów (text archive) | published texts of a library, project or topic, newest first | strip: the newest; block: recent texts; tall: search, topics, "Więcej" (more); `?t=<id>` opens a text |
| `quotes` — Zbiór cytatów (quote collection) | published quotes | small: "Myśl dnia" (one or two quotes, changing daily, the same for everyone); tall: search and topic filter |

## Printing: LaTeX

Printing goes through LaTeX (`libraryLatex.ts`). The page draws the markup as HTML; the same parse tree is written out as one self-contained `.tex` file for `pdflatex` or `lualatex` (UTF-8, Polish babel, no separate bibliography file).

- **A text** becomes an `article`: title page, the meta line (type, date, occasion, place, readings), `##` → `\section*`, `###` → `\subsection*`, quotes and embedded library quotes as `quotation` with their origin, own notes and citations as `\footnote` in the Polish style (`dz. cyt.`, `Tamże`), and "Źródła" (sources) at the end.
- **A project** becomes a `book`: outline headings → `\part*`, texts → `\chapter*` in outline order, one table of contents, footnotes counted over the whole book, sources once at the end.
- **Where:** the editor's side panel "LaTeX" (download, copy, preview; the author line is remembered). The public `writing` module offers "Pobierz do druku (LaTeX)" (download for print) from what is published.
- **Checks:** `scripts/app-platform-check.mjs` checks escaping, the first full citation, `Tamże`, quotes, lists, notes, sources and the book layout.

## JSON

These follow the standing JSON rule.

- **Library documents** (`recreatio/library`): export everything or chosen kinds. Import matches entries by id or by key and changes them in place, setting only the fields given. References can be `@keys`, so a whole library can be written by hand or by an AI. Nothing is deleted.
- **Description:** the library JSON panel and each entry's panel show `libraryDescription()`, generated from the kinds registry.
- **Page modules:** `writing`, `writings` and `quotes` take part in the page JSON (examples in their part files).
- **Checks:** `scripts/app-library-check.mjs` enforces that every field is described, that the examples import without warnings, and that export followed by import changes nothing.

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
