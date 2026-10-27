# Library — the backbone of citation

Status: implemented 2026-10-01 (migration `0064_library.sql`); since 2026-10-23 one of three parts (below). This file
explains the design; the code comments carry the details.

## Three parts

| part | job | holds | document |
|---|---|---|---|
| **Library** (Biblioteka) | normalise every reference; it holds nothing else | works (texts and, since 2026-10-26, music), quotes, persons as authors, media files | this file |
| **Scriptorium** (Skryptorium) | writing that uses the knowledge and cites the sources | texts, deliveries, projects, text types | [SCRIPTORIUM.md](SCRIPTORIUM.md) |
| **Cogita** (Nauka) | knowledge: the owner's own kinds, their entries and links; learning | own kinds and entries (places, persons as subjects, events, mysteries, comments…), questions, templates, revisions, flows, views | [COGITA.md](COGITA.md) |

**References run in one direction.** The Scriptorium cites the Library and links to or embeds Cogita; Cogita cites
the Library; the Library points only at other Library entries (a quote → its work, a work → its authors and its
container). Backlinks ("Powiązania", "Odwołują się tutaj") show every direction.

**Persons exist twice, on purpose.** A Library person is an author, a target for references. A Cogita person is a
described subject of an owner-written kind. If the owner wants a bridge, the kind gets a reference field to Library
persons; reference fields can point into source libraries already.

All three use the same sealed store (`app.library` / `app.library_entry`), told apart by `app.library.kind`:
`books` (Library), `writing` (Scriptorium, migration 0124) and `knowledge` (Cogita, 0110).

## What it is for

- **Citing.** A work, an author or a quote exists once. Sermons, statements, cards and pages point at it; footnotes
  and bibliographies follow Polish humanities practice.
- **Real shelves.** Books with ISBN scanning, the national catalogues, own numbers and measurements.
- **A collection of quotations**, each with its source and its place in it. A page shows them as a collection or as a
  "thought of the day". What one thinks about a quote is a statement in Nauka, not part of the quote.

## Model

A **library** belongs to an **area**, and an area has at most one library (the service refuses a second; the same
holds for a Scriptorium). Area access is library access: whoever holds the area's epoch key reads it; write
capability on the area means editing. "Tylko ja" (the personal area) is the default.

**Visibility is decided by the area, and only by it** (since 2026-10-22). Members of the area see its library; if
the area is public, everyone does. There is no per-entry publishing and there are no private fields. To make an entry
public, move it into the library of a public area ("Przenieś do innej biblioteki" in the entry's "Kto widzi" box);
the id stays. Entries move only within their part: library to library, Scriptorium to Scriptorium, base to base
(`Library.MayMove`).

**All readable libraries work together.** The workspace opens one library and syncs the others in the background
(`LibraryStore.peers`): references, embedding, search and backlinks reach across all libraries the user can read. A
Scriptorium's peers are the libraries and the other Scriptoria; Cogita's bases are found by id. Lists, saving and
export stay per library. An entry of another library is edited in its own library.

An **entry** is one typed document. The kinds live in `frontend/src/app/library/libraryKinds.ts` (`LIBRARY_KINDS`):

| kind | what | key fields |
|---|---|---|
| `person` | author, editor, translator, institution | given names, surname or single name, years, description |
| `work` | a source: book, chapter, article, periodical, Church document, Bible, web page, talk — and music (2026-10-26): piece, score, recording, album | authors / editors / translators (refs), container (ref), volume, issue, edition, publisher, place, year, series, pages, page count, binding, height / width / thickness, siglum, ISBN, own number, DOI, URL, original title; music has its own fields (below, „Music”) |
| `quote` | a passage of a work | text, work (ref), locator (`s. 23`, `J 3,16`, `nr 24`), translation |

Media files belong to the library they are uploaded into (`library_file`, sealed under the area key).

Keyed kinds carry a **citation key** (`ratzinger2007`). **The key is a writing aid; the id is what is stored**
(2026-10-22): you type `[@ratzinger2007, s. 23]`, the store saves `[@<id of the work>, s. 23]` (`storedMarkup`), and
every editor, preview, JSON export and AI description shows the key again (`shownMarkup`) — unless that key, seen
from here, would find a different entry (two libraries may use the same key), in which case the id stays visible.
Renaming a key orphans nothing; the previous key stays at the entry as an alias (`_aliases`), so old JSON files and
texts in libraries you cannot edit still find it. Texts cite Pandoc-style: `[@ratzinger2007, s. 23]`, several sources
in one note as `[@bt, J 6,35; @ratzinger2007]`, an own footnote as `^[…]`, and an embedded quote or statement as
`![@key]`. Footnotes follow Polish humanities practice (`libraryCite.ts`): the first mention is full, later ones are
short with "dz. cyt.", an immediate repeat is "Tamże", and a bibliography closes the text.

**Sources are cited, own entries are linked** (2026-10-22). Only what comes from outside becomes a footnote: a work
(a dictionary entry is a work with the headword as locator), a quote, a person (`SOURCE_KINDS`, `isSource`). A
citation of an own entry — a text, a project, a delivery, an entry of a knowledge base — becomes a link in the line
where the footnote would stand: `[@ratzinger2007, s. 183; @kazanie-chleb]` gives a footnote for the book and
"(zob. Chleb życia)" as a link. `[[these words|@key]]` links with your own words. A target the reader cannot open
stays a footnote "[brak źródła]" in a citation, and "[odwołanie niedostępne]" (or just the words of a `[[…]]`)
everywhere else — never its title or key.

**One reader for every text** (2026-10-22). The markup reader lives here and serves all three parts: the same parser
(`libraryMarkup.ts`: `parseMarkup`, `parseInline`, `safeHref`) and the same drawing pieces (`markupView.tsx`:
`Blocks`, `Inlines`, `countNotes`, `NoteList`, `OwnRef`, and for statements `StatementBody`, `StatementMarks`,
`StatementCard`) draw Scriptorium texts, plan points and deliveries, statements and markup fields of Cogita
(`cogita/ui.tsx` `Markup`, through `CogitaLibrary.markupLook`), and the page `text` part (`ui/richText.tsx`,
`LibraryLines.tsx`). The rules for statements — thesis, question, Informacja / Interpretacja — are computed in
`library/blocks.ts` and `library/statement.ts` for every entry whose kind has a `blocks` field (COGITA.md §3).

## Storage and cryptography

- `app.library`: area, epoch, sealed name, kind (`books`, `knowledge`, `writing`).
- `app.library_entry`: kind (plaintext), epoch, **one sealed JSON document** (`{v, id, kind, key, data}`) under the
  area's epoch key, AAD `library:entry:<id>:library_entry:1`. The service never sees fields, references or keys.
- Concurrency: `version` per entry. A save with a stale version gets 409 `stale`, and the editor offers to load the
  newer version or overwrite.
- Sync: the browser holds the whole library in memory (`libraryStore.ts`) and asks only for what changed since its
  last read (`updated_at`). Deleted entries are tombstones without a body.
- Search, backlinks, key uniqueness and citation formatting all run in the browser, because only the browser can read
  entries.
- **Keys:** unique within a library (a taken key gets a letter); a suggested key avoids every key of the libraries you
  can read, and choosing a key used in another readable library is a warning, not an error (texts hold ids). A typed
  key resolves in the current library first (its keys, then its aliases), then in the others. Before a key changes,
  texts that still name the entry by the old key are rewritten to its id (`LibraryStore.pinCitations`) — the same
  happens before a move to another library.
- **Moving** (`POST /workspace/library/{id}/entry/{entryId}/move`, `Library.Areas.cs`): the browser reseals the entry
  under the target area's key; the id stays, so every reference keeps working. The old version goes to
  `library_entry_version`; `app.library_moved` (0122) lets the old library's sync report the entry as gone.

## Deleting, and entries of kinds that left (2026-10-23)

- **A whole library** (also a Scriptorium or a knowledge base) is deleted in its Ustawienia with all its entries,
  after typing its name.
- **Many entries at once**: every list has check boxes and a bar with "Usuń (n)" (`EntryPick.tsx`); the question says
  how many other entries point at them.
- **"Stare wpisy"**: entries of kinds a part no longer keeps — in a library: texts, deliveries, projects (now in the
  Scriptorium), comments (now an own kind in Nauka) and topics (gone) — are listed with their name and kind, to look
  at and delete. Nothing breaks because of them, and they never disappear by themselves (`OldEntries.tsx`,
  `oldKinds.ts`). The Scriptorium and Nauka have the same list for their own old kinds.

## References and places in the Scripture (2026-10-22)

**One reference index** (`library/refIndex.ts`) answers "who points here?" over every library, Scriptorium and
knowledge base this tab has open — computed in the browser from what the reader can already read; nothing is stored,
nothing goes to the service. It finds, without knowing the kind (`refsOf`):

- ids in fields (a quote's work, a field of a text type, a Cogita reference field, a reference with a place
  `{value, locator}`);
- references in markup, with their place: `[@x, Dz 1,14]`, `![@x, s. 3]`, `[[words|@x]]` — in a text's body, its
  further information, every plan point (the hit names the point), what a delivery added, the paragraphs of a
  statement;
- the references in the cells of a statement's lists and tables;
- the source of an uncertain Cogita value `{work, locator}`;
- documents of a knowledge base: revisions, flows, views, collections, card templates, add forms — every id in them.
  Merges and settings are bookkeeping and do not count; fields starting with `_` neither.

Keys in markup resolve first in the entry's own store, then in the libraries, then in the other bases.

- **"Powiązania"** under every entry (`LibraryRelations.tsx`): quotes, texts with the plan point ("plan, punkt 2.1 ·
  Dz 1,14"), deliveries, projects, and per knowledge base its entries (statements among them) and documents.
  "Szukaj we wszystkich, które możesz czytać" opens every library and base the account may read
  (`LibraryStore.openEverything`); "Sprawdź strony" looks through the pages this account leads (`pageUses.ts`) and
  lists the modules that show the entry — other pages are never asked.
- **Cogita** shows the same under "Odwołują się tutaj".
- **The library map** draws grey lines for what is not a field (markup, cells).

**Places in the Scripture** (`library/bible.ts`) are read, never stored: a locator stays the text someone wrote. The
book table has the 73 books with Polish (Biblia Tysiąclecia), Latin (Nova Vulgata) and English names and
abbreviations. The parser reads `Dz 1,14`, `Dz 1:14`, ranges `1,14-16`, across chapters `Łk 1,26–2,5`, lists
`Dz 1,8.14` (English `Acts 1:8,14`), whole chapters `Ps 23`, `Rdz 1-3`, several places `Mt 5,3-12; 6,1; Łk 6,20`, the
second numbering of the psalms `Ps 51(50),3`, parts of a verse `22,2a`, "i następne" `16,9nn`. Only references to a
work with `workType: bible` are read this way.

- **"Fragment Pisma"** on a Bible work: type a place and see every quote, statement, plan point, text and base entry
  pointing at an overlapping place ("Dz 1:14" also finds "Dz 1,12-14"), in every edition the reader has.
- **Quotes stand in canonical order** (`quoteOrder`, `bibleKey`): "Rdz" before "Mt", "Dz 1,8" before "Dz 1,14".

## Places in a work and source texts (2026-10-24)

A work is complete **without** its text: it is cited, quoted and referred to by place. When a full text arrives later,
every place already written somewhere leads into it — nothing is re-entered and nothing is stored to make the link.

**One model of places** (`library/locations.ts`) is used by footnotes, quotes, Cogita fields with a place, the
Scriptorium's markup, JSON and the blocks of a text. A locator stays the text someone wrote; what it *means* is read
by the **scheme** of its work (the work field "Układ miejsc", else from its kind: Pismo Święte → `bible`, Dokument →
`numbered`, anything else → `pages`):

| scheme | for | examples |
|---|---|---|
| `pages` | pages of this edition (books, articles) | `s. 23`, `s. 23–25`, `s. 23, 27`, `s. xii`, `rozdz. 3, s. 45` |
| `bible` | book, chapter, verse — every translation alike | `J 21,15-17`, `Ps 51(50),3`, `Łk 1,26–2,5`, `Mt 5,3-12; 6,1` |
| `numbered` | numbered paragraphs (Church documents, catechism, codes) | `nr 24`, `nn. 24–26`, `KKK 1234`, `kan. 915 § 1` |
| `aquinas` | part, question, article, objection / sed contra / corpus / answer | `I-II, q. 90, a. 1, ad 2`, `I q. 2 a. 3 co.` |
| `decimal` | decimal propositions (Tractatus) | `2.0121`, `4.1–4.116`, `TLP 6.54` |
| `sections` | numbered remarks with parts (Philosophical Investigations) | `§ 43`, `§§ 1–5`, `cz. II, xi` |
| `outline` | volume, part, book, chapter, section, paragraph — as many levels as the work has | `t. 2, cz. 1, rozdz. 3`, `ks. II, rozdz. 4, § 2` |
| `time` | minutes and seconds of a recording (2026-10-26) — like pages, of this performance only | `1:23`, `1:23–1:45`, `0:45; 2:10–2:30`, `1:02:03` |

- **Structure vs. edition.** A *structural* place (a verse, a number, a proposition, a chapter) is the same in every
  edition and translation; a *page* belongs to the one edition whose work entry is cited. A place may carry both
  (`rozdz. 3, s. 45`). Compound and discontinuous places (`Mt 5,3-12; 6,1`, `s. 23, 27`; since 2026-10-25 also parts after `;` in pages, outlines and Aquinas: `s. 45–47; 58–60`, `rozdz. 1; rozdz. 9`; a part that starts lower than the one before stays in its frame: `I q. 2 a. 3; a. 4`, `t. 2, rozdz. 1; rozdz. 9`) are lists of spans; a
  shorter path means the whole unit (a chapter holds its verses). Outline places may skip levels and are compared
  level by level.
- **Psalms**: the work field "Numeracja psalmów" says whether its places are Hebrew (Biblia Tysiąclecia, the
  default) or Greek (Vulgate); places are compared in Hebrew numbering, so editions line up.
- **Editions**: "Wydanie / przekład dzieła" points an edition or translation at the work it renders. A structural
  place cited in one edition may open the text of another (shown as such); a page never.
- Quotes are ordered by the scheme of their work (`workLocatorKey`): pages as numbers, the Scripture by the canon,
  Aquinas by part, question, article.
- **Page series** (2026-10-27): a book whose parts are paged separately — front matter, appendices, inserts — writes
  each page as printed, with any marks before, after or around the number: `s. xii`, `s. 12*`, `s. 3'`, `s. 3''`,
  `s. (7)`, `s. [7]`, `s. A12`, `s. †3`, `s. iv*`. There is no list of marks: the SERIES is the pattern of the marks
  (`#*`, `(#)`, `A#`, `i*`; `#` the plain pages, `i` roman front matter; `locations.ts` `readPage`). Not marks:
  separators, quotation marks, letters after the number (`23n` is "and next", `12a` a column) and a lone bracket
  (`(s. 7)`). Each series is a band of its own, computed from its pattern (FNV-1a; the same in the service,
  `AiAccess.PageValue`) — the same number in two series stays two pages, a range stays in its series (`s. 45'–47'`),
  and the numbers stored in a text's directory stay valid. The work field „Serie stron” (`pageSeries`) gives the
  order of the series by one example page each (`xii 12* 1 3'`; the marks alone still work: `* 1 '`); without it:
  roman, plain, then the others. A text's directory names the series of each part (`ManifestPart.series`) and the AI
  snapshot names those of a text (`pageSeries`), so pages are written back as printed. A book has „Gatunek” too
  (powieść biograficzna, podręcznik, mszał …).

**A source text** is stored like everything else, sealed under its area's key, in **any library one may write** —
not necessarily the work's. So the work can stand in a public library and its text in a private one; whoever reads
only the work's library sees the work and its quotes, never the text (not in footnotes, search, JSON, the AI link,
embeds or pages). The AI link and MCP read a text only through the collection it is stored in (below). Two kinds, neither listed among the sources:

| kind | holds | sync |
|---|---|---|
| `sourcetext` | the directory of one text of one work: `work`, `scheme`, `edition` (PDF page offset, language, psalm numbering, note), its parts with key, label, order, first / last place, pages, block and word counts | whole, like every entry |
| `sourcepart` | one portion (a book of the Bible, a chapter) with its blocks in the original order | **heavy**: the sync (`?light=1`) brings only its row; the reader fetches it by id (`?ids=`, at most 50) when it is read |

A block is a `heading` (level 1–4), `paragraph`, `quote`, `list`, `table`, `note` (a footnote with its id) or
`page` (a printed page starts here, with the PDF page). Blocks carry `loc` where they have their own structural place;
a block without one belongs to the place before it. Inside text: `{{page 46 pdf 52}}` (a page break exactly where it
falls, also mid-paragraph), `{{note 3}}`, `{{? word}}` (uncertain reading), `{{gap}}`; `"uncertain": true` marks a
whole block.

**JSON `recreatio/source-text`, version 1** (`library/sourceText.ts`): one document = one portion of one edition;
the description, with an example for every scheme (book, Scripture, Church document, Aquinas, Tractatus,
Investigations, an outlined work), stands beside the import and is the prompt for one's own AI ("Kopiuj opis (dla
AI)"). Its rule: transcribe exactly, mark what is uncertain, **never invent text or numbers**. The import is checked
before anything is written (format, version, the work, a scheme that contradicts the work, unknown blocks, unreadable
places, page order, notes without references and the reverse, size ≤ 3.5 MB per portion) and shown as a preview.
**Portions without duplicates:** a portion with the same `portion.key` replaces itself, the same portion again writes
nothing ("bez zmian"), another key covering the same places is flagged. The part is saved before the directory, so a
directory never points at a missing part. Export gives the whole text back as documents.

**A whole text in one document** (2026-10-24): instead of `portion` + `blocks`, a document may carry
`"portions": [{ "portion": {…}, "blocks": [ … ] }, …]` — the whole text, or a list of documents. The description
says how to split a source (books of the Bible, chapters, a short article as one part), that end notes go into the part
they belong to, and how to continue in the next reply without breaking a part.

**A work and its text in one import** ("Dzieło z tekstem (JSON)" in Źródła, `sourceImport.ts`): `"work"` is an object
(`{ "key", "data": { workType, title, authors: ["@…"], container: "@…", … } }`), `"entries"` the persons and the
journal or book it names (library entries, `@key` references), then the text in `portions`. The work and its entries
go through the library import (a known key is completed, not doubled; the work takes the text's scheme when its kind
would not give it), then the text goes into the chosen library (also a private one); the work page opens with
"Czytaj". The same document again changes nothing new. In the box on a work page, such a document is accepted if its
work is this one (its fields are left alone); the library JSON import sends a source-text document to these two
places.

**Where it shows** (`SourceBox.tsx`, `SourceReader.tsx`, `SourceJump.tsx`):

- On the work's page, "Tekst źródła": which texts exist (parts, words, in which library), "Czytaj", and the JSON
  import with the choice of library (a public library asks first: copyright).
- **The reader** `#/workspace/library/<library>/<work>/tekst[/<place>]`: contents (parts with their places and
  pages), places at the margin, page breaks in the flow, footnotes with jumps, uncertain readings marked; "Przejdź"
  to a place; search in the whole text (parts are fetched for it, diacritics ignored); "Obok" puts another edition
  beside it, aligned by structural places (`alignEditions`); selecting text offers "Dodaj cytat" — a new quote with
  the text, the work and the place of the selection (verses, numbers, or the pages of this edition) — and "Kopiuj z
  miejscem". The margin and page labels are CSS `::before`, so they never get into a selection.
- **Links made while reading:** a footnote in a text or a plan, a quote, a cell of a statement (a Komentarz biblijny
  pointing at "Łk 1,35") and a Cogita field with a place show "pokaż w tekście" when this reader can read a text of
  that work and the place is in it: the passage opens right there (also on a page), and in the workspace "czytnik"
  opens the reader at the place. A place that falls into several parts is flagged as ambiguous instead of guessed.
  Texts are found in what the reader has open: the drawing store and its neighbours, and the libraries of this tab.

## Reading on pages

The service never decrypts. A page opens libraries in the browser (`libraryOpen.ts`):

- **public area**: `GET /library/{id}/open?since=` (anonymous) returns all sealed entries under published epoch keys,
  plus the area id and the sealed name; the browser opens them with `/area/{id}/key?epoch=`. Served only when the area
  is public **and** the library has been settled (`area_rule_at`, 0122). The same holds for a Scriptorium; a
  knowledge base must also be opened explicitly by a writer (COGITA.md §13).
- **otherwise, as a member** (or through a link or seat): `/workspace/library/{id}/entries` with the keys this
  browser holds.
- **references outside**: ids not found are looked up with `GET /library/where?ids=` (only entries the caller can
  read, or that lie in a public area); those libraries are opened too. What remains is unreadable.
- An entry that moved to another library is found there (`findOnPage`), so a page configured with the old library
  still shows it.

## Page modules

| kind | shows | sizes |
|---|---|---|
| `quotes` — Zbiór cytatów (quote collection) | the quotes of a library, or of one work | small: "Myśl dnia" (one or two quotes, changing daily, the same for everyone); tall: search |

Texts on pages come from the Scriptorium (`writing`, `writings` — SCRIPTORIUM.md). Who sees a module's content is who
can read its library; a reader who cannot sees "Tej biblioteki nie widzisz". A module whose library has gone shows a
notice instead of an error.

## Books on the shelf

A `work` of a printed kind (book, periodical, Bible, document, other) also records:
- page count, binding (`BINDINGS` in `libraryKinds.ts`), height / width / thickness in cm;
- series and the original title;
- the library's own number for the copy (`libraryNumber`).

The library is meant to work with real shelves:

- **Scan to get to a book** (`BookLookup.tsx`, "Skanuj kod" beside the library search):
  - The code on the back cover (EAN-13 = ISBN) or on an own label (the library number) opens that book.
  - An unknown ISBN offers "Znajdź w katalogach i dodaj" (find in catalogues and add).
  - Codes are read from the live camera, from a photo of the code, or by typing. `barcode.ts` uses the browser's
    `BarcodeDetector` where it exists and ZXing (`@zxing/library`, its own lazy chunk `vendor-barcode`) everywhere
    else.
  - The Android app declares `CAMERA` for this.
- **The catalogue** (`libraryCatalog.ts`):
  - `GET /library/catalog/{isbn}` (`LibraryCatalog.cs`) relays the Biblioteka Narodowa union catalogue (MARC 21),
    e-ISBN (publishers' ONIX) and Open Library. The first two send no CORS headers, so the browser cannot ask them
    directly.
  - The browser parses the answer, so mapping the catalogue data onto library fields happens there.
  - The browser calls the relay without a session, so no account is tied to a lookup. The service rate-limits by IP
    and caches answers for an hour.
  - One ISBN often has several descriptions (editions). All of them are shown, the fullest exact one first.
  - Persons already in the library are reused; new ones are created with the work.
  - In the editor, "Uzupełnij z katalogu" fills **only empty fields**.
- **Own numbers**: "Nadaj kolejny" proposes the next free number in the style of the last one (`B-0042` → `B-0043`);
  a duplicate number is flagged; a label can be scanned into the field.

## Music (2026-10-26)

The library stores music as well as books. It is its own tab, **„Muzyka”**, next to „Źródła”. A music work is
an ordinary `work` with a music kind, so it is cited, referred to with a place, searched, exported and moved like any
other source. **The kind decides which fields the work has** (the `when` of each field in `libraryKinds.ts`; the kind
select groups the kinds under „Teksty i wystąpienia” and „Muzyka”). The tab has one button per kind.

| kind | what it is | its own fields |
|---|---|---|
| `piece` — Utwór muzyczny | the piece as such: what one names when asked „what is this?” | composer, lyricist, arrangement, translation of the words, other titles and incipit, catalogue number (KV 618, BWV 147), key, voicing, genre, year written, language, lyrics |
| `score` — Nuty | an edition of the notation | its piece, composer, lyricist, arrangement, editors, edition, volume, publisher, place, year, catalogue number, ISMN, pages, binding, size, shelf number — and its **files** |
| `recording` — Nagranie | a performance | its piece, performers (a choir, a conductor, soloists), album and track number, arrangement, key, voicing, other titles, duration, publisher, year — and its **tracks** |
| `album` — Płyta, album | a CD or album of recordings | performers, publisher, year, catalogue number, duration, shelf number |

A score and a recording point at their piece (`piece`); a recording at its album (`album`). The pickers offer only
pieces (only albums), and a name typed there makes a new piece (album). A score or recording without its own title or
composer takes them from its piece. Typing a performer that starts like an ensemble („Chór…”, „Schola…”, „Zespół…”,
„Orkiestra…”, „Ensemble…”) makes an institution with its whole name, not a first name and a surname.

**Files** (`library/MusicFiles.tsx`, `library/music.ts`):

- **Tracks of a recording.** A recording is one file (the whole) or several tracks: one per voice or instrument. Each
  track has a name (Sopran, Alt, Tenor, Bas, Organy, …) and a role: „Głos albo instrument” (`part`, sounds together
  with the other parts) or „Całe nagranie” (`whole`, heard alone). Several files can be added at once; the file name
  suggests the voice („Barka - Sopran.mp3” → Sopran, „ave_verum_Tenor2.ogg” → Tenor II, „Barka S.mp3” → Sopran,
  „full mix” → Całość). A single track without a voice in its name is the whole recording.
- **Files of a score:** the full score, separate parts, notation files (PDF, images, MusicXML, MIDI), each with what
  it is.
- Files are uploaded only after the entry is saved, and only for writers. Each file is encrypted in the browser under
  the area's key, like every entry (`library_file`, up to 50 MB each, 2 GB per library). The list of files is saved
  at once with every upload, replacement or removal (`entryDraft.commit`), not after the usual pause: the file is
  already on the server, and a closed tab must not leave it without its entry. A file is opened only when
  someone asks: „▶ Odsłuchaj” plays a track, „Pokaż” shows a PDF or image in place, anything else downloads. A page
  with five tracks does not download five files.
- **Files belong to their entry.** They go away when the entry is deleted (also many at once) or when a track is
  removed (after a question that names it). They move with it to another library, sealed again under that area's
  key; this is how a recording becomes public. A track can be replaced and reordered.

**Places in a recording are times** (`locations.ts`, scheme `time`): `1:23`, `1:23–1:45`, `0:45; 2:10–2:30`,
`1:02:03`, `1:23.5`. A recording reads its places this way by its kind. Like a page, a time belongs to this one
performance, not to the piece (`isStructural` says no), so it never matches another recording. Quotes of a recording
are ordered by time.

**Footnotes** (`libraryCite.ts`):

| kind | full |
|---|---|
| piece | W. A. Mozart, *Ave verum corpus*, KV 618, sł. …, oprac. … |
| score | W. A. Mozart, *Ave verum corpus* [nuty], oprac. J. Kowalski, Stuttgart 2005, s. 3 |
| recording | *Ave verum corpus* (W. A. Mozart), wyk. Schola Katedralna, [nagranie], w: *Muzyka katedry*, nr 5, Dux, 2024, 1:23 |
| album | *Muzyka katedry*, wyk. Schola Katedralna, [płyta], Dux, 2010 |

The short form is „W. A. Mozart, *Ave verum corpus*, dz. cyt., 2:10”. A recording without a composer is listed by its
performers.

**JSON.** The music fields are described with the others, with two more examples (a piece, and a recording in voices
with its composer and choir). A file is written as the export writes it (`{ "file", "type", "name", "mime",
"library" }`); a file the document invents is dropped with a warning, and the track stays. So an AI can describe
pieces, recordings and their tracks without files; the files are added in the app. An export followed by an import of
the same library changes nothing.

**Built for what comes later** (not built now; the data is ready):

1. **A player on a public page that plays the voices together.** A page module will take a recording. It plays its
   parts (`partsOf`: tracks with role `part` and a file) in sync, one volume and mute or solo per voice, so a singer
   hears all voices or practises one. The whole (`wholeOf`) plays alone. Visitors of a public area open the files
   sealed under its published key (`/library/{id}/file/{fileId}/sealed`), as they open its entries. Moving a recording
   into a public library carries its files.
   Still to decide then: a shared start offset per track (if files do not start together), and whether the score is
   shown beside the player.
2. **Listening cards in Cogita.** A card template will play a recording from a moment and ask for the piece:
   - choosing among several pieces (wrong answers from other pieces of the same library or genre), or typing the
     title;
   - a typed answer counts if it matches any name the piece is known by (`titlesOf`: the title, the original title,
     the other titles and the incipit of the piece and of the recording);
   - several recordings of one piece are one answer (`pieceBehind`).
   - The moment is a reference with a place, as Cogita already stores it: `{ "value": <recording>, "locator": "1:23" }`,
     or chosen by the card from the length.
3. Later still: bars as places in a score (`t. 12–16`, `cz. 2`, `zwr. 3`), and showing MusicXML as notation.

## Quotes from a book

The usual way of collecting quotes:
1. Read and mark passages in pencil.
2. After a few pages, photograph the marked pages.
3. Give the photos and the prompt to your own AI chat. It transcribes them as JSON.
4. Import that JSON. All the quotes are bound to that book.

The app calls no AI and uploads no photos. Only the JSON comes in.

`QuoteIntake.tsx` sits under a work's fields as "Cytaty z tej książki": the list sorted by page; quick add (text and
page; the page stays for the next quote); and "Import cytatów z JSON":
  1. Choose what counts as a quote: pencil-marked passages, or the whole text of each photo. Copy the prompt
     (`quotesPrompt`). It names the book, explains the transcription rules and carries the JSON format.
  2. Paste the AI's answer, or load it as a file.
  3. Review each quote: uncertain readings are marked "do sprawdzenia"; quotes already in the book are unchecked; page
     ranges become `s. 23–24`.
  4. Save them all at once.

The format is `recreatio/quotes` (`libraryQuotes.ts`, version 3). Its description is generated from the `quote`
kind's fields plus `check` (what to verify — shown in the review, never saved), `page`, `uncertain` and `id`. Older
fields (`topics`, `comment`, `description`, `notes`) are named in the review and not saved: topics are gone, and what
one thinks about a quote is a statement in Nauka. "Eksportuj cytaty tej książki" writes the same format with ids;
re-importing it changes those quotes in place.

## JSON

- **Library documents** (`recreatio/library`, version 3): sources only — `work`, `quote`, `person`. Export everything
  or chosen kinds. Import matches entries by id or by key and changes them in place, setting only the fields given.
  References can be `@keys`, so a whole library can be written by hand or by an AI. Nothing is deleted. A file with
  other kinds (texts, deliveries, projects, comments, topics — an older file) is refused as a whole, with what is in
  it and where it belongs: the Scriptorium's format `recreatio/scriptorium`, an own kind in Nauka with
  `templates/cogita/komentarz.json`, or nowhere (topics).
- **Lenient values:** numbers may carry units (`"384 s."`, `"20,5 cm"`), and a select field takes its value or its
  label (`"hard"` or `"Twarda"`).
- **Where:** the library's "Import / eksport" tab, the bottom of every list (that kind only), and every entry. On a
  **new** entry, the one entry of its kind in the document becomes this entry, so pasting a book written by an AI opens
  that book.
- **Quotes of one book** (`recreatio/quotes`, above) are imported on that book's page.
- **Description:** every JSON panel shows `libraryDescription()`, generated from the kinds registry; it says that the
  library holds sources only and where the other things live.
- **Checks:** `scripts/app-library-check.mjs` enforces that every field is described, that the examples import
  without warnings, that export followed by import changes nothing, and that a file with other kinds is refused with
  the right format named. Its section 6 covers the book tools: ISBN rules, a drawn EAN-13 decoded by ZXing, the
  catalogue parsers against a real BN/e-ISBN answer in `scripts/fixtures/`, person reuse, own numbers, and the quotes
  format.

## An AI reads the three parts — the AI link (0126)

The JSON above goes **into** the app; the AI link lets an assistant **read** what is already written, without
copying files. Whoever leads an area opens the area → Dostęp → "Dostęp dla AI" (on a private area, right under its
name), ticks the collections (the Library, the Scriptorium, any knowledge base of that area — nothing else of the
area, and nothing of other areas), chooses how long it lasts (a week, a month, three months, a year) and gets a link
`https://api.<domain>/ai/<secret>` to copy into ChatGPT, Claude or any assistant that can fetch addresses.

- **What the assistant gets** (read-only, `GET` only): the guide at the link itself (what is there, how fresh, how
  to ask, the markup notes), `/search?q=…` (all words, any case and Polish letters; `part`, `kind`, `limit`,
  `offset`; without `q` it browses everything page by page; also `/search/<words>` for tools that cannot add
  parameters), `/entry/<id or key>` (all fields, what it cites with titles, what cites it), `/kinds` (each kind with
  the meaning of its fields), `/openapi.json` (for a ChatGPT action: Create a GPT → Configure → Actions → Import from
  URL).
- **What a snapshot is:** per collection, the entries of its own kinds as the app shows them — the title, the kind
  (and a text's text type), the citation key, the fields (markup with keys where they find the entry again), the
  references; for a base, its own entries (no views, revisions or other tools). Old kinds ("Stare wpisy") are left
  out. Titles, keys and references resolve **only inside the link**: a quote from another area's library stays a
  bare id.
- **Fresh by itself:** after a write to a collection that a link copies, the writer's browser rebuilds that snapshot
  when things are quiet (45 s); opening the Dostęp tab also refreshes stale ones, and "Odśwież teraz" forces it.
- **Who:** leaders make, show again, extend, change the collections and delete; writers refresh; every member sees
  that a link exists, what it shows and how often it was used. The link works only while its creator still leads the
  area. Deleting it stops it at once and removes its snapshots.
- **For web-reading assistants** (2026-10-24): a client that asks for HTML (`Accept: text/html`, as browsers and ChatGPT's web tool do, or `?format=html`) gets the same answers as a page where every address is a real link — the guide links the kinds, every collection, every kind of entry and the full list; list pages link each entry and the next page; entries link what they cite and what cites them. Such tools open only links they have seen, not addresses built from a template. JSON stays the default (`?format=json`, ChatGPT actions). `HEAD` is answered too.
- **As an MCP server** (0127): ChatGPT and other MCP assistants connect once to `https://api.recreatio.pl/mcp` with
  OAuth and pick these links on a consent page; then they search, read and follow references through tools
  ([MCP.md](MCP.md)), and read full texts (`list_texts`, `read_text` by place, `search_text`).
- **Full texts** (2026-10-24): a library's snapshot carries the texts stored in it — blocks with their place (own and
  inherited, written the app's way), pages and readable marks (`aiSnapshot.ts` `snapshotTexts`; the parts are fetched
  for it). A text in a library the link does not hold never appears. Over ~30 MB packed, the snapshot is made without
  texts and says so.
- **Following the area** (0128): a link can show the whole area — "Cały obszar — także zbiory, które dojdą później",
  the default for new links and for links made on the consent page. A library, Scriptorium or base created later
  becomes part of it at once (the service adds it when the collection is created, when links are listed and when a
  link is read), and the browser that created it builds its first snapshot. Links made before 0128 that held every
  collection their area had at the time follow it from then on; the others keep their choice. Switch it under
  Dostęp dla AI → Zbiory.
- **How it stays sealed:** ARCHITECTURE.md → Keys → AI access.

## How the Scriptorium and Cogita build on this

- **The Scriptorium** (SCRIPTORIUM.md) cites works, quotes and persons in its texts and plans, embeds quotes, and its
  text types may point at Library kinds (`work` with a place: "Fragment Pisma").
- **A knowledge base reads libraries as sources** (`settings.sources`, `cogita/sources.ts`): their works, quotes and
  persons are reference targets and card material (a template over quotes makes cards of a library's quotes; a
  revision can take "Cytaty" from one library); they are never copied. A reference with a place (`locator: true`)
  stores `{value, locator}`: a psalm is the Bible plus "Ps 110".
- **Statements** — comments, theses, questions — are entries of the owner's own kinds in Nauka, built on the field
  type `blocks` (COGITA.md §3). They cite the Library; the Library never points at them.
- **Cards are computed, not stored.** A card is `template:entry[:value]` plus a direction; answers go into sealed
  `learn_batch` rows of the storage area, keyed by those ids.
- **„W Wiedzy” at a work** (2026-10-25, [WYWOD.md](WYWOD.md)). A knowledge base can explain a work, or parts of it,
  through its „Wejścia z Biblioteki”: documents of the base naming the work, its places
  (`s. 45–47; 58–60`; empty = the whole work), an entry and a view.
  - **Where they show:**
    - the work's page has a box „W Wiedzy”, grouped by base and ordered by place (the whole before its parts);
    - on a phone, a line under the title;
    - the reader has buttons for the anchors that touch the part being read;
    - another edition shows anchors with structural places.
  - **How they are found:** by the reference index over the stores this tab opened (`library/anchorHits.ts`). The
    Library stores nothing, and a reader who cannot read the base sees no trace of it. „Powiązania” no longer
    repeats anchors, and rows of statements there are titled by their thesis.
  - **In search and „Fragment Pisma”** an anchor is titled „Wejście z Biblioteki: …” and opens where it leads (its
    view at its entry).

## History

- 2026-10-01: the library with texts, topics and projects (0064).
- 2026-10-21/22: sermons with plans and deliveries; comments as statements; one topic system; visibility by area;
  "Porządki", the screen of migrations in the browser.
- 2026-10-23, three parts (IMPLEMENTATION-LOG, P1–P5): the library holds sources only. Texts, deliveries and projects
  moved to the Scriptorium (with LaTeX, the plan editor and the archive); the comment became an own kind in Nauka on
  the field type `blocks`; topics, aspects and perspectives are gone — order comes from own kinds linked by
  reference fields. All earlier content was test data, so there was no migration; "Porządki" and its rebuilds were
  removed, and old entries stand under "Stare wpisy".
- 2026-10-24: one model of places for every reference (schemes, structure vs. edition, editions); source texts in
  portions with a reader, imported as JSON (IMPLEMENTATION-LOG, L1).
- 2026-10-26: music — pieces, scores with their files, recordings with their tracks (voices and instruments), albums;
  places in time (IMPLEMENTATION-LOG, M1).

## Adding a kind

1. Add a `LibKind` in `libraryKinds.ts` and put it into `LIBRARY_KINDS` (a source) or `WRITING_KINDS` (writing). It
   needs fields with `says`, `title`, `sort`, and a filled `example`.
2. If it should cite in a special way, add a case to `citeSegs` / `workSegs` in `libraryCite.ts`.
3. If it gets its own workspace tab, add it to `TABS` in `LibraryView.tsx` (and `LIBRARY_TAB` in
   `LibraryEditor.tsx`), or to the Scriptorium's tabs.
4. Run `npm run app:check`. The library check fails until every field is described and the example imports cleanly.
