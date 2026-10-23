# Scriptorium — writing

Status: built 2026-10-23 (migration `0124_scriptorium.sql`; IMPLEMENTATION-LOG, P3 and P5). One of three parts:
the **Library** holds the sources ([LIBRARY.md](LIBRARY.md)), **Cogita** holds the knowledge ([COGITA.md](COGITA.md)),
and the **Scriptorium** holds the writing that uses the knowledge and cites the sources: sermons, conferences,
articles, course texts, page texts — with their deliveries and projects.

**References run in one direction.** A text cites the Library (works, quotes, persons become footnotes) and links to
or embeds Cogita (an entry as a link, a saved view as a live block). Nothing in the Library or in Cogita points at a
text; backlinks show it all the same.

## The container

- A Scriptorium is a library of kind `writing` in the shared sealed store (`app.library` / `app.library_entry`):
  one sealed document per entry under the area's epoch key, incremental sync, versions, 409 `stale`.
- **One per area**, like a library; the service refuses a second ("Ten obszar ma już swoje skryptorium").
- **Visibility is the area's.** Members read it; in a public area everyone does (`/library/{id}/open`, after the
  area rule is settled, as for a library). `/library/where` finds entries in it.
- **A text becomes public by moving** it to the Scriptorium of a public area ("Kto widzi" → move); its id stays, so
  every reference keeps working. Its text type can go along (a check box); otherwise readers there do not see the
  type's fields. Entries move only Scriptorium → Scriptorium (`Library.MayMove`).

## Kinds

| kind | what | fields |
|---|---|---|
| `text` | own writing: a sermon, conference, article, course or page text, a note | the core fields, the same for every text: title, subtitle, project, status, date, occasion, place, readings, summary, **plan**, **body**, **further**, audio, video, target words — plus the fields of its **text type** (`textType`) |
| `delivery` | one time a text was preached or given (Wygłoszenie) | texts (refs), date, occasion, place, audience, readings, audio, video, duration, summary, **coverage**, **added**, transcript |
| `project` | a book, a series, a collection | project type, title, subtitle, description, **outline** (`{heading}` and `{text: ref}` items), status, deadline, target words |
| `texttype` | the owner's own kind of text ("Rodzaj tekstu") | name, description, **fields** |

### Text types belong to the owner

- A text type is a name plus extra fields, described with **the same schema machinery as a Cogita kind**
  (`KindDef` / `FieldDef`) and edited with **the same editor** (`cogita/KindForm.tsx`, used by Nauka's Schemat and by
  `TextTypeEditor.tsx`).
- Example: "Kazanie maryjne" with `tajemnica` (ref → the owner's Cogita kind "Tajemnica") and `obszar` (ref →
  "Obszar").
- Field types for a text type: line, text, number, date, yes/no, choice, reference, web address, list (no media, map,
  range or markup — the text has its own markup). No "uncertain" values, no label pattern. The keys of the core fields
  are refused (`CORE_KEYS`).
- A reference field points at a Cogita kind of any base the author can read, or at `work`, `quote`, `person` or
  `text`; with `locator: true` it carries a place ("Fragment Pisma": the Bible + "Łk 1,26-38").
- A text fills its type's fields with the same inputs as Cogita (`TypeFields.tsx`). It sees Nauka through a read-only
  lens (`lens.ts`), which never creates Cogita entries.
- The fields show as "Tajemnica: Zwiastowanie" over the text, in the preview, on pages and in LaTeX (`typeLines`). A
  target the reader cannot open shows nothing, not even its name.
- **A text without a type is a plain text.** Values of a field the type no longer has stay in the text and are not
  shown.

## The workspace

- **Skryptorium** stands in the sidebar between Biblioteka and Nauka (`#/workspace/scriptorium`): the list of
  Scriptoria and a form to create one. The area picker leaves out areas that already have one and warns when the area
  is public.
- A Scriptorium has the tabs **Teksty, Wygłoszenia, Projekty, Rodzaje tekstów, Import / eksport, Ustawienia**, and
  **Stare wpisy** while it holds other kinds. Texts can be filtered by type; every list has select and delete.
  Ustawienia: the name, who reads it, and deleting it with all entries after typing its name.
- **The text editor** (`WritingEditor.tsx`, `TextForm.tsx`): tabs **Plan · Treść · Dalsze informacje**, "Dane tekstu"
  (the type's fields), a live preview. Pickers: "Źródło…" (cite a work, quote or person), "Cytat z biblioteki…"
  (embed a quote), "Z bazy wiedzy…" (`BasePicker.tsx`: link an entry of a base `[[słowo|@id]]`, or embed a saved view
  `![@view]` as a block or plan point — it shows what the view selects **now**). Autosave is one hook for all editors
  (`library/entryDraft.ts`).
- **The plan** is the first tab, an outliner (`PlanEditor.tsx`): Enter makes a point (splitting at the cursor), Tab /
  Shift+Tab deeper / higher, Alt+↑↓ moves, Backspace in an empty point removes it, Esc leaves the point. A kind per
  point (thought, quote, example, question, application). "Wklej gotowy plan" reads a typed outline (numbers, letters,
  indentation, `>` quotes, `?` questions — `planFromText`).
- A text's side shows its **Wygłoszenia** with "+ Wygłoszenie". The delivery form (`DeliveryForm.tsx`): text, day,
  place; the recording (a file plays right there, and ⏱ beside a point takes the player's time); "Co z planu zostało
  powiedziane" point by point (three buttons, time, note; "Resztę oznacz: …"); "Co doszło"; summary, transcript.
- **Nauka** box of a text: "Powtórka z tego tekstu" — a revision of what the text points at, in a base that draws on
  this Scriptorium (`cogita/fromEntry.ts`).

## Plan and deliveries

- **A plan point** is `{ id, text, depth, kind }`. `text` is markup, so `[@key, s. 12]` on a source becomes a footnote
  (on an own entry: a link) and a point that is only `![@key]` is a quote or statement shown whole. `depth` is 0 (main
  thought), 1 or 2. Every point keeps a **stable id** wherever it moves; deliveries refer to points by it. The plan's
  sources count like the body's: backlinks, the bibliography, LaTeX (`markupsOf` collects all markup of an entry).
- **A delivery is one time a text was preached** — the record. One text, many deliveries. It says about the plan:
  - `coverage`: per point, `said` / `short` (only mentioned) / `skipped`, the time in the recording (`m:ss`) and a
    note on what was different;
  - `added`: what was said that is not in the plan, with its time and the point it came after;
  - `transcript` (markup).
- A delivery is seen by whoever reads its Scriptorium. A text lists its deliveries from backlinks (`deliveriesOf`),
  newest first. The archive's date is the date a text was **last preached**.

### AI stays outside

Two prompts to copy into one's own chat, each with an import that fills the **open form** (`patchFromDoc`), not the
store behind it:
- on a delivery, "Z nagrania albo zapisu — przez AI we własnym czacie": the plan with its point ids, the rules and the
  format; the answer (Scriptorium JSON for this delivery) fills coverage, added, summary, duration, transcript
  (`deliveryPrompt`);
- on a text with a body, "Plan z treści": the body; the answer fills the plan (`planPrompt`).

## Printing: LaTeX

Printing goes through LaTeX (`scriptorium/latex.ts`). The page draws the markup as HTML; the same parse tree is written
out as one self-contained `.tex` file for `pdflatex` or `lualatex` (UTF-8, Polish babel, no separate bibliography
file).

- **A text** becomes an `article`: title page, the meta line, the type's fields, the plan (nested `enumerate`,
  footnotes) before the body, `##` → `\section*`, quotes and embedded statements (their tables as `tabular`), notes and
  citations of sources as `\footnote` in the Polish style (`dz. cyt.`, `Tamże`), citations of own entries by their
  title in the line (`(zob. \emph{…})`), and "Źródła" at the end.
- **"Plan na ambonę"** (`planToLatex`): only the plan, for the pulpit — one page, 14 pt, quotes in full.
- **A project** becomes a `book`: outline headings → `\part*`, texts → `\chapter*` in outline order, one table of
  contents, footnotes counted over the whole book, sources once at the end.
- **Where:** the editor's side panel "LaTeX" (download, copy, preview). The `writing` module offers "Pobierz do druku
  (LaTeX)" from what the reader can see.

## Pages

**Page texts.** Longer texts that are writing (articles, course texts, sermons) live in the Scriptorium; pages show
them through `writing` and `writings`. Short layout copy (headlines, notices, hours) stays inline in page modules.
`pageDescription()` says this rule to an AI.

| kind | shows | sizes |
|---|---|---|
| `writing` — Tekst ze skryptorium | one text | strip: a button; block: title, date and opening; tall or fullscreen: the full text — header → Wygłoszenia (choosing one opens its player, summary and transcript) → Plan (numbered 1, 1.1, 2; with a delivery chosen ✓ said / ◐ short / ✕ skipped, times that jump in the player, what was added after its point) → body → further information, footnotes, sources |
| `writings` — Archiwum tekstów | the texts of a Scriptorium or of one project, newest first | strip: the newest; block: recent texts; tall and fullscreen: the whole archive — search, a filter per axis, **Lista** (year headings) and **Drzewo** (the values of an axis with counts); **Tabela** only where it was set as the start before step 10 |

- **The archive's axes are the reference fields of the text types** (`archive.ts`, `ArchiveCard.tsx`; P5): every
  reference field of a type is an axis — the same key in several types is one axis — and its values are the entries
  the texts point at ("Tajemnica: Zwiastowanie, Nawiedzenie…"), by name; a target the reader cannot open is no value.
  Projects ("Cykl") are an axis too. One value per axis; different axes add up (AND); a value is counted without its
  own axis's filter, so the other values stay visible. **Decided:** the archive stays its own module, not a preset of
  "Widok" — a visitor needs only the Scriptorium, no knowledge base. Tables and matrices over Nauka are the module
  "Widok" (COGITA.md §2.3).
- The state is in the address: `?t=` (open text), `?tw=` (chosen delivery), `?tu=` (view), `?tq=` (search), `?tf=`
  (chosen values), `?to=` (order). A link to a delivery opens its sermon with it chosen.
- Both modules read a Scriptorium through the key `scriptorium`; an older page with `library` still renders
  (`read()` falls back). A module whose Scriptorium has gone shows a notice.

## In Nauka

- **A knowledge base can list Scriptoria as sources** (Ustawienia → Źródła), next to libraries and other bases.
- **Text types are kinds there** (`cogita/kinds.ts` `textTypeKind`): a text carries its type as a second kind, so its
  type fields stand next to the core fields. Views group by them, a matrix "Tajemnica × Obszar" places sermons by them
  next to comments, filters, columns and card templates read them. They are kinds of another part: pointed at and
  learned from, never created in the base. "+ Nowy wpis tutaj" in a matrix cell creates a sermon of the type in the
  Scriptorium that holds the type, with the cell's values in its fields.

## JSON

- **Format `recreatio/scriptorium` version 1** (`scriptoriumJson.ts`, with the Library's import engine): `texttype`,
  `text`, `delivery`, `project`, with `@key` references.
  - In a text type, a reference field's targets may be Cogita kind names ("Tajemnica").
  - In a text, values of type fields may name Cogita entries by name ("Zwiastowanie"), places as
    `{ "value", "locator" }`, numbers with units; unknown fields and names are reported.
  - A file with sources, comments or topics is refused, naming where they belong.
- `scriptoriumDescription()` (Polish) describes all four kinds, text types with a worked example ("Kazanie maryjne"
  with Tajemnica, Obszar and a Scripture place), the markup and Scripture places. Every JSON panel of the Scriptorium
  shows it.
- **Read by an AI** (0126): the area's AI link (area → Dostęp → "Dostęp dla AI") can include the Scriptorium; the
  assistant then searches the texts, deliveries, projects and text types and reads each with its references
  (LIBRARY.md → "An AI reads the three parts"). A text's text type is its second kind there, and the type's fields
  are described like any kind's.

## Files

`frontend/src/app/scriptorium/`: `ScriptoriumView.tsx` (list, tabs, settings), `WritingEditor.tsx`, `TextForm.tsx`,
`PlanEditor.tsx`, `DeliveryForm.tsx`, `TextTypeEditor.tsx`, `TypeFields.tsx`, `textTypes.ts` (reading a type, its
lines and marks), `lens.ts`, `TextArticle.tsx` and `SermonParts.tsx` (drawing), `WritingCard.tsx`, `ArchiveCard.tsx`,
`archive.ts`, `archiveLayout.ts`, `sermon.ts` (plan, coverage, prompts), `latex.ts`, `WritingTools.tsx`,
`WritingBoxes.tsx`, `scriptoriumJson.ts`, `format.ts`. Page parts: `pages/parts/writing.tsx`, `writings.tsx`.
Service: `backend/Api/Library/` (kind `writing`, one per area, moves within the part).

## Checks

- `app-library-check.mjs`: section 2i (the format, text types — targets by Cogita kind name, core keys refused,
  values by entry name, places, numbers —, the text with its fields drawn, the AI description) and section 7 (plan
  reading and numbering, pasting, times and links, marks on the drawn plan, LaTeX, prompts, JSON into the form, archive
  rows, axes from text types, filters and counts).
- `app-platform-check.mjs`: LaTeX escaping, citations, quotes, lists, notes, sources and the book layout.
- Browser drives (outside the repository, local service, `zz-probe-` accounts): `scriptorium-api.mjs` /
  `scriptorium-browser.mjs` (P3) and `axes-api.mjs` / `axes-browser.mjs` (P5).
