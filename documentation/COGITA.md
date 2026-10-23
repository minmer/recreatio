# Cogita in the workspace — the decided design

Status: decided on 2026-10-15 from your answers on the page “Cogita rebuild questions” (https://claude.ai/artifact/YQqNZJkSHqu4NQSNhy4bwf). Built on 2026-10-16 (§19). Changed on 2026-10-16: Cogita has its own container, the knowledge base, beside the library (§2.1, §18 row 13).

- This file is the target and the only Cogita document. The older background documents (`CogitaAim.md`, `cogita-graph.md`, `COGITA_DESIGN_THINKING.md`) were removed on 2026-10-17; the definitions the code still cites from them are kept in Appendix A.
- A bracketed id such as [B11] points at the question on that page; F01–F47 are the old features and P01–P18 the integrations.
- §18 lists how the open points were settled on 2026-10-15.

## 1. The rule

- **Nothing is lost.** Every ability of the old Cogita stays. It is reformed, and abilities may merge into broader pieces [A8].
- **You declare, the code provides mechanics.** Kinds, questions, revisions, narratives, rules and looks are declared by you and reused as templates.
- **No second access model.** Areas, roles, links and seats carry Cogita. Its container is the knowledge base, a structure beside the library (§2.1).
- **The service stays blind by default** [N8]. The exceptions are in §15.
- **Placement.** Cogita lives in the workspace view **Nauka**, beside **Biblioteka**. Public parts are pages [A1].
  - The interface is Polish only [A3].
  - cogita.pl comes later; public courses start on recreatio.pl [A2, P10].
- **First uses** [A4]:
  - your own study and sermon knowledge;
  - confirmation candidates;
  - school and catechesis classes;
  - live quizzes at parish events.

  Drill (revision) is built first [A5].
- **Start empty.** No old data is carried over [A7].
- **Legacy goes last.** Cogita is the last legacy part still in use. Once it is rebuilt, the whole legacy code goes [N7]: `frontend/src/legacy`, `backend/legacy` and the switch in `main.tsx`.

## 2. Content: the knowledge base with a declared schema

### 2.1 The store

- **Two structures side by side** (changed on 2026-10-16):
  - **The library** (Biblioteka) is a collection of books: works, quotes, texts, persons and topics.
  - **The knowledge base** (Baza wiedzy) is what Cogita teaches: kinds, knowledge, questions, templates, revisions, flows, sessions and progress.
- **One storage engine** [N1]. Both use the 0064 store: one sealed document per entry under the area key, incremental sync, and 409 `stale` on version conflicts. They are told apart by `app.library.kind` (`books` or `knowledge`, migration 0110).
  - Area access is knowledge-base access [L1].
  - A course is one knowledge base, and an area may hold several [L7].
- **References instead of copies** (replaces [B15]). A knowledge base names its sources in its settings, from any area:
  - **libraries, for references only**: their works, quotes and persons can be pointed at in fields and cited, but never become cards;
  - **other knowledge bases, for reuse**: their kinds, entries, templates, revisions, flows, looks, rules, values and dependencies count here, and they are changed only there.
- **Rules for sources.**
  - A reused base brings its own sources along, up to 12, with no circles.
  - Each source is read with access to its own area. Whoever cannot read it simply does not see it.
  - Nothing is copied, and the service does not learn about references.
- **Big libraries** hold up to 50,000 entries [F6]. They get an encrypted copy in IndexedDB, sealed with the area key and cleared at sign-out [N2].
  - The browser searches and filters; there are no blind indexes [N3].
  - On a phone, entries are opened lazily against a local index rather than all at once.

### 2.2 Schema as data

**Kinds are entries of the system kind `kind`.** Each declares:
- a name;
- a **label pattern** such as `{givenNames} {surname}` [B8];
- the **field that tells entries apart** in search results [F4];
- its fields and its card templates [D8].

**No kind comes by itself** (2026-10-18). A new knowledge base has no kinds. „+ Rodzaj” adds an empty one or a ready-made one (Temat, Wiedza, Pytanie); a built-in kind is listed only where it was added (or changed) or where entries of it exist — the engine still knows all of them. **Every kind can be removed**, a built-in one too. The removal is counted first and listed in the question: entries only of this kind are deleted (with the progress of their cards), entries with another kind lose only this one, entries from source bases stay there, references of other entries to the deleted ones are taken out, reference fields of own kinds pointing only at it are removed (pointing at several: no longer at it), card templates only for it are deleted (for several: without it), add-form steps of this kind are removed (a form without entry steps is deleted), collections lose the deleted entries. A kind that comes from a source base is removed there (`kindRemoval.ts`).

**Field types** [B2]:
- line, long text, and markup (with citations and footnotes);
- number with a unit, and date with precision (year, month or day);
- yes / no / unknown, and choice from a list;
- reference to one or more kinds;
- media (image, audio, video, document) and web address;
- ordered list, and place (a geo point);
- **range with several segments** [B6].

Formula, code and duration are not field types.

**Values:**
- A field may be multi-value [B5].
- A field declared “may be uncertain” carries, for each value [B3]:
  - a state: known, approximate, disputed, unknown, not applicable or pending;
  - a source;
  - a note.
- A source is a library work plus a locator (`s. 23`, `J 3,16`). The existing citation code formats it as a footnote [B4].

**Relations:**
- A reference field names the other side (“wrote” / “written by”), and the other side shows it as a backlink [B9]. Since 2026-10-22 "Odwołują się tutaj" also lists what points without a field ("Wspominają go"): `[[…|@…]]` in knowledge texts, revisions, flows, views, collections and texts or comments of libraries — from the one reference index (LIBRARY.md, "References and places in the Scripture").
- A symmetric relation is stored once [B10].
- A relation with data of its own is an entry of a relation kind [B9].

**Several kinds per entity** [B11]. The entity has the union of their fields, and its label comes from its first kind.

**Not wanted:**
- subentities [B7];
- per-statement aliases [B17];
- private fields [B18]. Neither own nor built-in kinds have them: since 2026-10-22 who reads a field is decided by the area that holds the entry.

**Scope and templates:**
- A schema belongs to one library [B12].
- A schema template, with its card templates, is exported and imported as an independent copy [B12, D8].
- A **public template library** on recreatio.pl, which you maintain, offers Słownictwo, Katechizm, Historia, Książki and others [B14].
  - The old library templates (vocabulary, knowledge map, course, research, flashcards) become such templates, together with view presets [F05, F45].

**Schema changes** keep the values of removed or retyped fields, marked “outside the schema”, until someone resolves them [B13].

**The built-in kinds** (person, work, quote, topic, text, delivery, comment, project) become the editable starting schema [B1].
- Citations, the ISBN lookup and LaTeX keep running on the existing library code.
- They find their fields through **field roles** (authors, title, year, container, locator…).

**What the service sees** [B20]:
- only `entity`; the kinds and their names stay inside the sealed document;
- nothing is published one by one any more (step 8, 2026-10-22): a base is read by whoever reads its area (§13).

**Merging duplicates** [B16] rewrites every reference onto the entry that stays. The other becomes a tombstone pointing at it.

**Version history** [N9]: every save keeps the previous version, and restoring writes it again, as chat messages already do.

**Beyond learning.** Your own kinds also hold non-learning data. The existing registries (Kartoteka, addresses) stay as they are [B19, P18].

### 2.3 Views

- A table with column filters and sorting, a tree by kind, and a graph canvas whose positions all authors share [F2, F3].
- Saved views (filter, columns, sorting) can be shared by a link [F7].
- **A view is a selection in steps** (2026-10-22, step 9; `views.ts`, `selection.ts`). The steps are the ones a revision graph uses, with the same settings and the same code:
  - a source: everything, a kind (also a kind of a source library, optionally from one library), a collection, a topic with its subtopics and what points at them, a list;
  - **Idź po odwołaniu** (`follow`): along one reference field or all of them, or backwards to whatever points at the entries (fields and markup, library material too);
  - **Filtr** (`filter.rule`): the collections' rule.
- The tree groups by kind (the topic hierarchy as before), by the values of a field, or by an **axis of topics**: a topic marked as an aspect, whose subtopics are the values. An entry can stand in several groups.
- In **Wpisy**, "Rodzaj" and "Filtr" are short cuts into the steps; "Wybór i grupy" edits them all (`ViewSteps.tsx`). A view saved before step 9 (`kind` + `rule`) reads as steps and is written in the new shape; the JSON export and import do the same.
- **On a page**: the module **Widok** (`view`) shows a saved view as a table or a tree, with search, sorting and a clicked entry opened below it. Each module keeps its state in the address under its own scope (`?<scope>.q=…`, `pages/partQuery.ts`), so two views on one page do not disturb each other and a link carries the state.
- **Matrix and map** (step 10). A view can be a **matrix**: rows and columns are two groupings, usually two axes of topics such as 20 mysteries × 12 periods. Every value of an axis gets its row or column, also an empty one, and a cell holds what belongs to both (`viewMatrix`). A view can also be a **map**: the knowledge map's fog over the view's entries.
  - Sources at the start of a view count together, so one view can hold sermons and statements (`text` and `comment` from a source library).
  - A table column can be an axis (`#axis:<topic>`), which shows the axis values the entry belongs to.
- **Inner views with a path** (step 10). On a page a cell opens its entries below the matrix (`c=<row>~<col>`), and an entry opens itself (`e=`): a statement with its blocks, a sermon whole with its plan and deliveries (`d=`), anything else as a card. A breadcrumb leads back, and the address carries the whole path.
- **Actions** (step 10, `viewActions.ts`):
  - **Ucz się tego** (pages): the cards of what is shown, asked without an account.
  - **Powtórka z tego widoku / z tego pola** (Wpisy): a revision made of the same steps (`viewToRevision`; leading sources through "Razem").
  - **+ Nowy wpis tutaj** in a cell, or on an empty "+": a new entry carrying the cell's context (both topics, a field's value). A statement goes into the library it draws from, and an entry of the base stays in the base.
  - **Dodaj do planu** in a cell: the cell's entries become new points at the end of a sermon's plan. A quote is embedded and anything else becomes a link.
- **Retired** (step 10): `entity-table`, `topic-explorer`, `knowledge-map` and the archive's table layout. They left the palette, and existing placements keep rendering. **Porządki → "Moduły stron → Widok"** (`library/rebuild/pageModules.ts`) converts them on the pages you lead into a saved view plus the module "Widok" in the same place. The report lists the converted pages.
- **Choosing many** (2026-10-18): in the table, the box in front of a row, Ctrl+click, Shift+click (everything between), dragging over the boxes, or holding a row on a phone; once something is chosen, a click chooses instead of opening, Esc clears. A bar floating at the bottom (so the list does not move) acts on them: set a field for all (add, replace or remove a value, clear — e.g. the language or a topic), put them into a collection (an existing or a new one), delete them (the question says how many other entries point at them; entries from source bases are left alone).
- Library content appears in the workspace search, Ctrl K [F5, P12].
- “Looks per kind” replace the old approaches, such as the citation view and the vocabulary card [F47].

### 2.4 Adding many at once: forms (added 2026-10-17)

A **form for adding** (Formularz dodawania, doc kind `addform`) says once what one typed row becomes, so a long list is typed, not clicked: “car” Enter “samochód” Enter, next row.

- **The form is a graph** on the model of §4 (nodes, ports, edges, JSON), drawn in its own React Flow canvas because a node shows the fields of its kind:
  - `pick` — **chosen on top** (Na początek): an existing entry such as a language or a topic, chosen once and kept for every row until changed; required or optional, one or several, with a default;
  - `entry` — **made from each row** (W każdym wierszu): an entry of a kind. Each field gets its value typed in the row, set once on top, or fixed in the form. Every reference field is an input; an edge from another node fills it.
- **Several in one row.** A node marked “kilka w wierszu” takes several values (Ctrl+Enter or “+ kolejne”). A reference field that takes ONE entry then makes one entry per value (each pair: two English words × one Polish word = two translations); one that takes several takes them all into one entry.
- **Nothing twice.** An entry that already exists is used instead of a new one, recognised by the single-valued fields the node sets (text and language) or by the fields chosen in the form. What it lacks (another topic) is added; entries from a source base are used, not changed. This holds inside one list too (“zamek” for castle and lock is one word with two translations), so retrying a row is harmless.
- **A row with a value that does not fit** (“abc” in a number field) is left out whole. A node is made only when every row entry it is connected to is in the row (a translation needs all its words); otherwise it is skipped with the reason.
- **Keys** are part of the form: Enter, Ctrl+Enter and Shift+Enter each do one of: next field (in the last one: save the row), another value here, save the row, a new line in long text, nothing.
- **Pasting a list** from a sheet or text: one line per row, the columns in the order of the typed fields (tab, ;, =, “ - ”, | or , — recognised by itself), several values in a cell split by a chosen sign. The plan is shown before anything is saved.
- **Saving** runs in the background, row after row, so the next row can be typed at once. Each row can be undone (what it created, unless a later row already uses it).
- **The form describes itself**: the sentence list under the designer and under “Jak działa ten formularz” is generated from the form.
- **Starting points.** “Z rodzaju: X” builds a form from a kind: a kind that is typed (Słowo: its label fields) gets its references as choices on top; a kind that only connects (Tłumaczenie: z → Słowo, na → Słowo) gets an entry per reference — two where the field takes several (a translation with one field “Word” gets “Word 1” and “Word 2”) — whose own references become choices on top: one per row entry where the field takes one entry (each word its language), shared where it takes several (topics).
- **The designer** (reworked twice on 2026-10-17, on request): on top the name, “Zapisz formularz” (“Zapisano” when nothing is unsaved), “Wypełniaj →” and a menu with “Usuń formularz”; then the tools (“Na początek”, “W każdym wierszu” with the kinds, “Kolejny taki jak …”). Below, **the canvas on the left and the nodes on the right**: one module per node, as an accordion — the node chosen on the canvas or by its title is open, so the node and its settings are seen side by side (the first row entry is open at the start; on a phone the modules follow the canvas). Under both: the row order, the keys and the pasting rules, then the generated description. **“+ kolejny taki”** adds the next row entry like this one (the next language): the same kind and fields, its own empty choice where the original had one of its own (its language), the shared choices (topics, and any choice that feeds a field taking several), and the same target where that field takes several.
- **Row order** (“Kolejność pól w wierszu”, form key `order`): the order of the typed row entries — where Enter goes next and how the columns of a pasted list stand — set with ↑ ↓ above the keys. Without it the canvas decides (column, then height); a new “kolejny taki” is placed right after its original.
- **Choosing an entry** (everywhere a reference is picked: the choices on top, the defaults in the designer, reference fields in the entry editor): type to search, or open the list with the arrow; when nothing matches exactly and the place takes exactly one kind with a text field (the one in its label, else its first line), the list ends with “+ Utwórz „…” — Rodzaj”, which creates the entry and chooses it.
- **Editing what is there** (“Edycja tego, co już jest”, beside “Dodawanie” on the filling screen): the saved entries shown in the shape of the form — a row per connecting entry (a translation, a group), its entries in the columns of the row entries that would have made them (the words per language), empty places where something may still be added. The choice on top is the filter: English–Polish shows no German rows. Texts are changed in place; values are added (found or made as when adding, with their language and topics), taken out of a row (×), rows deleted — and nothing is saved until **one button, “Zapisz zmiany (n)”**; leaving with unsaved changes asks first. A field that takes ONE entry (the “z” of a translation) cannot be left empty (delete the row instead) and offers “+ dodaj” only while it is empty; one that takes several (the words of a group) always offers it. Entries from a source base are shown, not changed; a value that fits no column (a language the form does not know) stays on its entry, unseen. A form without a connecting entry shows its first column only.
- **Where.** Built under Schemat (`schemat/formularz/<id>`), filled under Wpisy (`wpisy/dodaj/<id>`, the menu “Wiele naraz”, and Ctrl K). Forms belong to the schema JSON (`forms`) and travel with it; a reused base’s forms are usable here.
- **A form as JSON** (2026-10-19): under each form „Formularz jako JSON” exports it with the own kinds it needs (in the schema format, so the Schemat import takes the same document) and imports one beside the generated description: the same `ref` changes the form in place, a new one creates a form. „+ Formularz → Z JSON (wklej)…” imports a form that is not here yet. The form import takes kinds, card templates and forms only; anything else in the document is named as left out. Several entry steps into one field that takes several give their values in the declared row order („Kolejność pól w wierszu”; without it, as on the canvas) — psalm, psalm, canticle. Example: `frontend/scripts/fixtures/brewiarz.json` — the psalter (kinds, a vespers and a compline form, five card templates), checked end to end in `app-cogita-check`.
- **A kind to choose per value** (2026-10-20, entry key `also`): an entry step that takes several values can have several kinds (under „Rodzaj”, „+ inny rodzaj”; stored as the first in `kind`, the rest in `also`) — each value gets a select (Psalm / Pieśń) before its input, typed into that kind's first plain field; values keep the typed order, so one step serves vespers (psalm, psalm, canticle) and lauds (psalm, canticle, psalm). In a pasted list a prefix with the kind name chooses it (`Pieśń: Ap 19,1-7`); without one, the step's own kind. Such a step takes no reference connections.

## 3. Knowledge layer

These are fixed system kinds that the engine understands. You may add fields to them [C1].

| kind | what it is |
|---|---|
| `knowledge` | **Superseded by the library comment (2026-10-22, step 6):** new statements are comments of a source library; existing ones move with Porządki → "Wiedza → komentarze" (same id); the kind is no longer offered under "+ Rodzaj". One statement in markup — read by the library's one reader since 2026-10-22 (headings, lists, quotes, notes; `[@work, s. 23]` on a work, quote or person is a footnote, a citation of an own entry is a link "(zob. …)"; LIBRARY.md "One reader for every text"). Words link to entities as `[[Księgi Samuela\|@samuel]]`, inserted from the search overlay [C3]. It carries perspective tags from the library’s own tag set [C8] and a source as in §2.2. |
| `text` | The existing library text. It embeds knowledge nodes the way it embeds quotes (`![@key]`) and serves as a narrative [C2, K1]. |
| `topic` | **One topic system (2026-10-22, step 7):** the topic is the library topic (name, description, parent, aspect, order); a base sees the topics of its source libraries as its own (`CogitaLibrary.topics()`), and its own topics move into the library of its area (Porządki → "Tematy i perspektywy → biblioteka", same ids). A topic subtree (`topicTree`, revision source "Temat", ExploreMap) follows **backlinks**: everything that points at the topic or a subtopic — a sermon's `topics`, a statement in its markup, a question's `about` — not only `answers`. **Learning fields are an extension** the base adds (Schemat → Temat → "+ Pola nauki", stored as an override of the built-in topic): answers (comments, texts, quotes), an attached entity, a level for depth [C9], a landmark flag for threshold concepts [C11], dimension, open; a base whose topics already carry them keeps seeing them. **Perspectives are an axis**: the aspect topic "Perspektywy" with one value per perspective; entries get them in "Tematy" (the base settings list and the `tags` fields go). Dimensions (What, Why, How…) are child topics [C10]. |
| `question` | A hand-written check: an answer form, expected and accepted answers, linked entities, and right and wrong exits used in flows [C4, D1]. |

- **Parallel bundles** (“How is David shown in chapter 16, 17, 19?”) are proposed from a pattern for each entity of a set. The author confirms each one [C5].
- **The pending list**, shared by all authors [C6], collects:
  - open topics (“expand later”);
  - knowledge and topics whose linked entity changed since an author last checked them [C7];
  - cards flagged by learners [D12].

## 4. One graph engine

- **One editor for everything** [N4]: a React Flow editor core, a node registry with typed ports, evaluation in the browser, and JSON for every graph. Graphs are library entries.
- **Palettes**:
  - card templates (§5);
  - revisions and dependencies (§6);
  - conditions (below);
  - flows (§8);
  - game actions (§11).
- **A Python node** runs Pyodide in the browser. It is loaded lazily (about 10 MB). The service never runs learner code [F12, D10].
- **One logic engine** serves forms, pages, flows, characters, quests and games [G6].
  - The form logic (0043) and page logic (0048) maps move onto it.
  - New inputs: knowness, values, answers, visited steps, time, place.
  - New actions: set a value, go to a step.

## 5. Cards

**Where cards come from:** templates per kind, plus hand-written `question` entries [D1].

**Statements** (2026-10-22, step 6). A library comment reads as a Cogita entity of kind `comment`: its `blocks` are a read-only field type `blocks` (one value; the generic "Pole" node gives one item per paragraph, list or table), and it is named by its thesis (first sentence). Template nodes in the group "Komentarz": "Teza komentarza" (`statement.thesis`), "Część komentarza" (`statement.part`, piece n: a paragraph, each list item, each table row), "Tabela komentarza" (`statement.table`, two columns as the left and right side of "dopasowanie par"), "O czym jest komentarz" (`statement.subjects`, with places — the Scripture by its place alone). Two starts for comments: "Teza komentarza" (front: what it is about, back: the thesis, a flash card) and "Tabela komentarza: dopasuj pary". Flows (`line`, `expand`) and a question's "Wyjaśnienie" accept comments and show them whole. "Do zrobienia" lists comments without a good thesis and questions without an answer.

**Library material** (2026-10-22). A base that reads a library as a source (`settings.sources`) learns from it too: the library's kinds that have entries there (quotes, works, texts, comments, projects, deliveries, persons) are "material kinds" (`CogitaLibrary.materialKinds`, labelled "(z biblioteki)"). A template may target one of them — "Luki w cytacie" over quotes, "Pytanie o pole" on a quote's place — and then makes cards of the library's entries, keyed `template:entry` like every card (entry ids are stable, so progress stays). "Wpisy rodzaju" and "Dystraktory" of such a template draw from the same material (`material(kind)`, `poolFor`). The base's own lists ("Wpisy") still show only its own entries; library topics give no cards yet (step 7).

A template is a graph built from these blocks [D2]:
- a field of the entity, or a reference followed several steps deep;
- a split by a field (“Filtr”, added 2026-10-18): the entries whose field has one of the values arriving at “Porównaj z” — or typed in — and the rest (the words in the language of this card, and the others); without a field it compares the entries themselves (“all but this one”). “Bez powtórzeń” passes each entry or text once;
- the entries of a kind (“Wpisy rodzaju”, 2026-10-18): all of them, or those whose field has one of the arriving or typed values — the words spelled the same, the translations that hold this word (the way back), the words of a language — optionally without this entry, only from the current collection, at most N at random (random per entry, so the card counts as varying). It reads an index per pool and field, built once for all cards, not the whole pool per card;
- pairs from entries (“Pary”, 2026-10-18): from each entry the values of a field that belong on the left (the English words of a translation) and those on the right (the Polish ones; without a right side: all the others), side by side for “dopasowanie par”; an entry missing a side drops out, and no text stands twice on a side or faces itself;
- a text pattern;
- a mask: prefix, suffix or random, keeping a share;
- pick one of a list (the chosen one and the rest);
- distractors, and an image or audio prompt;
- a random value and arithmetic. The old computed questions become these blocks [D9, F11];
- a condition (only when a field is filled), and tolerance;
- extra accepted answers;
- order items and match pairs;
- true or false from a comparison (“born before …?”);
- Python.

**Answer forms** [D3]:
- typed text with a similarity threshold;
- number with tolerance and unit, and date with precision;
- one choice, several choices, and true or false;
- ordering and matching — matching by tapping (2026-10-18): an item on one side, then its partner on the other; a pair carries one number on both sides, and tapping a paired item undoes its pair;
- a gap in a quote (the old fragment tree) [F10];
- a self-graded flashcard [D4];
- code (Python), and a point on an image or a map.
- **a drawing to manipulate** (`interactive`, added 2026-10-17): the question carries the same JSON as the page module „Animacja” — values, a simulation, controls and rules (see [INTERACTIVE.md](INTERACTIVE.md)). The learner sets values (sliders, dragging) and presses „Sprawdź”; the stored answer is those values, and the check simulates them to the end: correct when a goal rule (or the question's `goal` expression) is reached. `random` values are drawn per attempt and fixed in the card; the `solution` is a computation with them (`v0 = sqrt(cel*g)`). Participants of a live session get the drawing without its goal rules. Since 2026-10-18 the drawing may carry a world of things (a balance of beams and weights, a mobile, gears): the answer is also the world as the learner left it, replayed through the world's own rules (locked stays locked, every changed thing is a move) before it is simulated; a solution may name properties of things (`w3.m = 2; b2.pos = 6`). The eight levels of the Balance Lab are such questions (`frontend/scripts/fixtures/balance-lab-cogita.json`). Since the same day an attempt draws a task of comparable difficulty with the drawing's own `task` (requirements, a solution as expressions — the same generator as a page, [INTERACTIVE.md](INTERACTIVE.md) §12) and keeps its numbers in the card; a question without its own `solution` takes the drawing's `task.solve`.

There are no spoken answers.

**Distractors** come from [D15]:
- the same field of other entities of the kind;
- only the current collection;
- a list the author writes;
- similar values.

**One card per value.** A template can make one card for each value, such as each translation or each isotope [D11]. Vocabulary cards in both directions and “which language is this word” cards are templates [F09].

**Vocabulary starts — “Słówka”** (2026-10-18), for the model of a translation that holds words of several languages in one field (“Słowa”), each word with its language. The new-template dialog asks each start for what it needs, by its own names (the field with the words, the language field of a word, the text field, where the translations are), and preselects them.

| start | for | the card |
|---|---|---|
| “z języka na język (oba kierunki)” | the translation | one per language present: its words with the direction (“angielski → polski: house”), the words of the other languages accepted; two languages give both directions |
| “jaki to język?” | the word | tick every language in which a word of this spelling exists (“hotel”: English, Polish); words spelled the same give one card (the first of them; a Warunek holds back the others) |
| “połącz w pary” | the translation | this translation and up to twelve others at random, five pairs in its two languages, matched by tapping; a one-language translation makes none |
| “zaznacz tłumaczenia” | the word | tick all its translations, in one or more languages — the words of the other languages in the translations that hold it (same-language synonyms are not translations) — among four words of the same target languages |
| “przetłumacz słowo (każdy język osobno)” | the word | one card per language it has translations in (“dom (polski) → niemiecki”), every translation into that language accepted |

A fixed direction is a Filtr with the language typed in, behind a “Warunek” so that a translation without that language makes no card. Field lists in a template show the own kind's fields first, then those of related kinds under their names (one reference away before two), then the rest.

**Checking** is one module [F13, D6]:
- bidirectional, prefix and anchor comparison, similar letters, punctuation and a threshold;
- it produces a per-character mask and partial correctness;
- the template holds the settings, and a revision may override them [D5].

**After answering** the learner sees the correct answer, the per-character comparison and the linked knowledge [D14].

**Card history** is kept unless the expected answer changed [D7]. A learner can suspend a card for themselves and flag it for the authors [D12].

**JSON:** new formats only. There is no converter for the old question JSON [D13].

## 6. Revision, collections, knowness, dependencies

**A revision is a graph that selects cards** [F15]. Its nodes:
- sources: a kind — also a kind of a source library, optionally only from one library or base ("Skąd", `source.kind` `from`; 2026-10-22) —, a collection, a topic subtree, a list;
- the steps shared with views (step 9): **Idź po odwołaniu** gives the cards of the entries reached along a reference (or backwards), **Filtr wpisów** keeps the cards whose entry passes the collections' rule;
- dependency gates;
- one strategy node from a fixed list, with its parameters [E6]: random fixed number, whole stack once, levels, time-knowness;
- order and limits.

**Collections** are saved filters with AND / OR groups, plus explicit lists [F1, F19].

**Dependencies:**
- Three kinds: prerequisite, elaboration and context. Each edge has an impact weight, and only prerequisites gate [E3].
- Propagation: parent knowness += child knowness × impact [E4].
- Dependencies inferred from flows and character hand-offs are proposed to the author, who confirms them [E5].

**Knowness:**
- The spec formula `knowledge(q1, d1, q2, d2, t)` (Appendix A.1), over a card’s latest answers [E1].
- An entity, topic or collection averages its cards [E2].
- It is computed in the browser [E7].

## 7. Answers and progress

- **Every answer is stored in the database, sealed.** Knowness and the statistics come from the answers [F16, F22].
- **Knowness is saved too**, as a snapshot per card: the question id plus the direction. A template card’s question id is the stable id of the generated card.
- **A declared storage area** receives a learner’s answers. A teacher who can read there sees the progress [E10].
  - The course (library) declares the area; a revision, session or form step may override it.
  - For your own study, it is your private area.
- **Answers reach the storage area exactly the way a form reaches its office.** Each batch is sealed for the learner and for the area’s intake key, and whoever holds the role the intake was made for reads it. Learners write without reading one another.
- **Progress is per person**, including several persons on one account [E11, F06]. Form people (seats) are always visible to their office [E10].
- **Reminders.** The service sees one plain “next due” time per learner and library, and nothing more [E8].
- **A learner’s place in a flow** is kept across devices, together with their progress [G14].
- **Learners without an account** keep their progress in the browser and can save it to an account after signing in [L6, I13].
- **Offline revision** [E9, F21]. A revision runs without the network. Its answers and knowness are saved later.
  - The browser keeps a cache of some questions by itself.
  - The Android app keeps a larger amount when the learner chooses one.
  - Authoring stays online.
  - The cached questions are sealed under the device’s own key: the vault of `kept.ts`, which in the app is the Android Keystore. Offline answers are sealed to public keys (the storage area’s intake and the learner’s own key), so answering needs no secret at all.
  - In the strict key-keeping mode (`tab`), nothing is cached.

## 8. Narratives

There are three separate layers: content (§2–3), flow and look [G1].

**A flow is a sealed library entry.** A page shows it through the module `cogita-flow`, which reads the base itself — whoever can read the base can play it there (§13, step 8) [G2].
- A flow never holds text of its own. Everything a learner reads is a knowledge node, a text or an entity [G9].
  - Step titles, choice labels and chapter names are flow data.

**Step types** [G5]:
- show an entity, knowledge or a topic; show content media;
- a question with right and wrong exits; a choice;
- a condition; changing a value;
- chapters: split and join, only the remaining chapters offered, restart the chapter, go to its end [F32];
- a sub-flow; a step repeated for each item of a set;
- prerequisite: skip if known, otherwise explain;
- expansion: explain a term in place when it is unknown;
- a discovery or recall opening and ending [G13];
- a character line; a hand-off to another flow; end or return.

Each step opens on a new screen or expands in place [G12].

**Narrative templates** are flows with slots ({person}, {collection}) [G7]. Each use points at the template and may override parts, and a change to the template reaches every use.

**Looks:**
- Kinds of look [G4]: reading, slides, presentation scenes, dialogue in chat bubbles [P05], flashcards, map exploration.
- Reusable looks [G8]: themes, layouts per step type, how each kind is shown (a Person card), scene presets, transitions.
- The motion dictionary of 0107 (`motion.ts`) is the transition and motion layer.

**The player** is the presentation engine (0085, 0089). It is extended with question pieces, conditions from the logic engine and modules bound to library content [G3].

**Built on 2026-10-21: the storyboard of a presentation.** One presentation page is both the example and the course. Pages have no second structure for flows.
- The presentation carries `show.story`: values (start, min, max), gates and, for a connected page, the knowledge base (`base`) and the area where answers count (`storage`).
- A gate is a node on the map (`gate:<key>`). A condition gate has a yes and a no exit. Its condition comes from the one logic (`cogita/logic.ts`): answered right or wrong, a value, a visited scene, knowness, time, and/or/not. A set gate changes values and has one exit. Any exit can lead to a gate: „dalej”, a button or an answer.
- The module **Pytanie** (`question`) is a Cogita card on a scene. It has one exit for a right answer and one for a wrong one. A scene with a question waits: „dalej” does not pass it before the answer. Coming back to it asks again.
- Where it runs:
  - Without `base`, answers, values and the place stay in the browser (IndexedDB, holder `page:<id>`). This is the example: nothing leaves the device.
  - With `base`, a signed-in person (or a seat) learns into the knowledge base, as in any Cogita run. The batches are sealed into the named area; without one, a person learns into their private area and a seat stays in the browser. A visitor without an account still gets the browser-only run.
  - A reload resumes at the last scene.
- Editor: Prezentacja → Przejścia. Gates are on the map, each question has its outcome selects, and the panel „Przebieg” holds the mode, the base and the values.
- Files: `pages/presentation/story.ts` (model, gates, the way through them), `storyRun.tsx` (the run on a Cogita `Learner`), `StoryPanel.tsx`, `PathsEditor.tsx`; `pages/parts/question.tsx` and `questionView.tsx`.
- Not yet:
  - Cogita flows (`FlowEditor`, `FlowPlayer`, sessions, games, characters) still run on their own flow entries.
  - The tab Przebiegi does not list presentation pages.
  - Browser progress of a storyboard is not taken over after signing in.

**Media** — narration audio, images, video — are sealed library files [G10, F31]. Browser speech is not used [G11].

**Other:**
- Any flow can run live [G15].
- Flow JSON imports notions and the graph together [F34].
- The Cogita intro slides become a page: 0107 is porting them now [F35].

## 9. Characters, values, quests

- **Any entry can be a character.** A character line or a “character speaks” step names it; it has a portrait and a voice [H1]. (Until 2026-10-17 a kind had to be marked “can speak”; that flag is gone, and an old `speaks` in a kind document is ignored.)
  - It is realized by a group of values that change for each learner as they use the course.
  - Its lines are knowledge nodes.
  - Lines fire through the logic engine, on values, knowness and visited steps [H2].
- **Relations between characters are typed links** [H3]. Closeness is a value: flow steps change it, and so does the learner’s progress [H4].
- **Age** is authoring data only [H5].
- **A quest is a flow with goals** [H6].
- **Values** are declared per library and kept between sessions, with a ledger [H7, F37]. Each declares:
  - a scope: person, group or session;
  - a visibility: all, group or person;
  - a type, limits, and whether it is a score.

## 10. Sessions

**A session core of its own.** It shares pieces with the chat core [F23, I3]:
- area-derived keys;
- seat identities and key delivery;
- link persons, signatures and presence.

**Kinds of session** [I2]:
- solo;
- a shared link for people without an account;
- group async, counted per member [E12, F28];
- group sync: several persons on one device, switching who answers [F27];
- live: a host, participants and a projector screen [F23];
- storyboard session: joined by code, with answers and attempts per step and results for the owner [F33];
- game session [F41].

Modes are free, directed and algorithmic, and switching mode keeps your place [I1].

**Realtime** is a SignalR hub in the API, on the same hosting [I4]. It uses WebSocket and falls back to SSE or long polling by itself. FCM only wakes phones (“a session is starting”), as it does for chat today.

**Rules and presets** [I5, F24]:
- The live rules become rule templates you declare: first-answer and all-answered actions, timers, speed and first-correct bonuses, penalties, streaks.
- The old presets ship as templates.

**Participants:**
- Teams are an area role or a name typed when joining, and they have team scores [I6, F25].
- Participants are accounts, form people, and link holders who introduce themselves [I7].
- Joining again on another device needs the host’s approval [I8, F26].

**Screens** [I9, I12, F29]:
- the host: panel, question, score;
- a participant: question, score, full screen;
- the projector: a presentation-mode view.

Phones stay awake.

**Results:**
- The host and the leaders’ area see everything; each participant sees their own [I10].
- Answers also enter each participant’s progress (§7).
- Sessions can be planned in the calendar, with a join link [I11, P02].

**Shared revisions** are revision modules on a page at a generated address (`c/<id>`) [I13, F20]; who can use them is decided by the base's area (§13).

## 11. Games

**Games are part of the graph, not a module** [F36]. A game is made of:
- flows;
- the logic engine with location blocks [J5, F38]: geopoint, position, distance, entering a zone, N members present, every N seconds;
- zones (point, radius, active window) that can open flow steps [F40, J6];
- values with a ledger [F37];
- layouts per role: host, group leader, participant [F39].

**Uses:** a city game, a youth or camp game, a quiz with places [J1].

**Triggers** are evaluated by the service on game data it can read [J2]. This is the first exception to blindness.
- The service receives positions readable only while the game runs, and deletes them when it ends [J3].
- Nobody but the host sees them.
- Spoof detection runs on the host’s device [J4].

## 12. Contributing and exploring

- **Contributions** [K2, K3]:
  - Every writer of the library’s area writes into the library directly. That is the library’s own confidence.
  - Everyone else writes explanations, expansions and questions into a contribution area, and an author approves them before they join the course.
- **Authors** see anonymous counts per card, such as “many learners stall here” [K4].
- **Exploration** is a separate game-like map: fog, frontier, decay, landmarks [K5].
- **Motivation** is chosen by the author per course [K6]. There are no leaderboards outside live sessions [K7].

## 13. Access

- **A course in areas** [L1, E10]:
  - authors write in the knowledge base's area;
  - its sources may sit in other areas; learners see a source only if they can read its area;
  - learners hold a role that reads it;
  - sessions run in the class area;
  - progress goes to the declared storage area.
- **Readers do not see the authoring tools** [L2].
- **No secret test areas.** Sessions send question copies without answers [L3].
- **User types** (teacher, student, self-learner, researcher, casual) are starting presets of views and display modes [L4].
- **Another organisation** gets access through a link role, as everywhere since 0091 [L8].
- **Visibility follows the area** (step 8, 2026-10-22; decision 3 of the target architecture):
  - members of the base's area read it; through a link or a seat, whoever holds them;
  - a base in a **public** area is public **as a whole** — entries, questions with their answers, drafts, revisions, flows — once a writer has opened it (**Ustawienia → Kto czyta**, after the plain statement; migration 0123 left every existing base unopened; a new base is opened at creation, and the creation form says what that means in a public area);
  - there is no per-item publishing: to make something public, move it into a base of a public area (**Kto widzi → Przenieś**, same id; what it needs can move along, and the old base takes the new one as a source); to keep something for a few, move it into a base of a closed area;
  - pages and keyless sessions read the base itself (`pageBase.ts`), so a page shows exactly what its reader may read.

## 14. In the workspace

| where | what | id |
|---|---|---|
| Workspace views | The part “Nauka”: due now, progress, open sessions. The alert “Powtórka czeka”. | P01 |
| Calendar | Revision as a repeating personal task with a link; sessions as appointments | P02 |
| Notifications | Revision due; a session starting | P03 |
| Chat | Discuss a card or a topic in a chat topic; turn a message into a question; the dialogue look | P04, P05 |
| Pages | Modules: revision, live participant, live host, flow player, entity card, and **Widok** (steps 9–10): a saved view as a table, tree, matrix or map. Entity table, topic explorer and knowledge map are retired into it. | P06 |
| Page subject | A page about one entity (“Kim był Dawid?”) | P07 |
| Widgets | A revision, a quiz or a quote of the day on other websites | P08 |
| Forms and steps | Learning targets as steps (“Naucz się: Modlitwy, 80%”), with progress in the office list; enrolling through a form | P09, L5 |
| Public courses | A knowledge base in a public area, opened by a writer (Ustawienia → Kto czyta): everyone reads it as a whole, without an account (§13) | P10 |
| Pages with one module | One common way to put a module on its own page (a form, a revision, a flow…) at `recreatio.pl/#/c/<id>`, owned by whoever creates it, without building a page by hand; the module reads the base itself | F20 |
| Search | Library and knowledge-base content in Ctrl K | P12 |
| Nauka | The workspace view of Cogita: due now, sessions, the knowledge bases (each with its tabs at `#/workspace/learn/<id>`), and offline practice. The library itself has no Cogita tab. | A1 |
| JSON and your AI | Schema, entities, knowledge, questions and flows from a text: a prompt to copy and an import with review | P13 |
| Android app | Reminders, the screen kept awake, offline practice | P17 |

**Not wanted:**
- printing (flashcards, tests, booklets) [K8, P11];
- quizzes made from sermons [P14];
- a shared Bible library [P15];
- readings linked to verses [P16];
- moving the Kartoteka [P18].

**Dropped:**
- the mock data generator [F07];
- creation artifacts [F43];
- the old Python exercise type, which becomes the Python node [F12].

## 15. What the service sees

| sealed | readable by the service |
|---|---|
| entries, kinds, templates, flows, looks, rules, media, versions | that an entry exists, its time and size, its library |
| answers, knowness snapshots, places in flows, values | the holder, storage area, time and size of each batch; the next due time |
| session events and results | the kind of session, participants’ ids, times |
| — | game data while a game runs: positions and values [J2] |

A public, opened base (§13) is served to anyone as the same sealed entries and files (`/library/{id}/open`, `/library/{id}/file/{fileId}/sealed`); the browser opens them with the area's published key. The service still reads none of it.

## 16. New storage (migrations)

1. **Library:**
   - the plain kind becomes `entity`, while published entries keep a public kind (until step 8, 2026-10-22: nothing is published one by one now — §13);
   - `library_entry_version`;
   - sealed library files.
2. **Answers:** answer batches (holder, storage area, sealed batch with key copies) and the next due time.
3. **Sessions:**
   - sessions and session events;
   - key delivery to seats, shared with chat;
   - the realtime hub (no table).
4. **Games:** game state the service can read, deleted when the game ends.
5. **Forms:** the form step kind `learn` with its target.
6. **Pages:** the register root `c` for modules published directly.
7. **Knowledge bases (0110):** `app.library.kind` (`books` or `knowledge`).

## 17. Build order

1. **Drill on your own library.**
   - Schema as data, with the built-in kinds as the starting schema; merging; versions; the IndexedDB copy.
   - The graph engine with the template palette and the Python node; the checking module and the answer forms.
   - The knowledge kinds and the pending list.
   - Revision graphs, knowness and dependencies.
   - Answers in the storage area; next due; reminders; the Nauka part.
   - Offline practice.
2. **Publication:**
   - publishing modules directly at `#/c/<id>`, starting with revisions;
   - the page modules, the entity page subject and widgets;
   - Ctrl K.
3. **Forms:** learning steps for candidates and classes, enrolment, and seats’ progress in the office list.
4. **Sessions:**
   - the session core and the realtime hub;
   - live sessions with rules and presets, teams, screens and results;
   - group sync and async;
   - calendar and notifications.
5. **Narratives:**
   - flows, looks and narrative templates;
   - the presentation player;
   - characters and values;
   - storyboard sessions, the dialogue look and the exploration map.
6. **Games:** zones, triggers on the service, location blocks, layouts per role.
7. **Contributing** and anonymous counts. Then the legacy code is deleted.

## 18. Settled on 2026-10-15

| # | question | answer |
|---|---|---|
| 1 | Game positions [J2, J3] | The service reads them only while the game runs and deletes them at its end (§11). |
| 2 | Printing [K8, P11] | No printing. |
| 3 | cogita.pl [A2, P10] | Later. |
| 4 | Session core [F23, I3] | Its own core, sharing pieces with chat (§10). |
| 5 | Realtime [I4] | A SignalR hub on the same hosting (§10). |
| 6 | “Own confidence” [K3] | Every writer of the library’s area writes directly (§12). |
| 7 | Characters [H1] | A group of values that changes for the learner during use (§9). |
| 8 | Offline [E9, F21] | Revision offline, saved later; browser cache plus a larger download in the app (§7). |
| 9 | Storage area [E10] | Exactly the way a form reaches its office (§7). |
| 10 | Text in flows [G9] | Titles and labels are flow data (§8). |
| 11 | Generated pages [F20] | One common way to publish modules directly, under `c` (§14). |
| 12 | Knowness [F16] | Saved with the question id and the direction (§7). |
| 13 | Library and Cogita (2026-10-16) | Parallel structures. A library is a collection of books; a knowledge base holds what is learned. A knowledge base references libraries (for references only) and other knowledge bases (for reuse), also in other areas (§2.1). |

## 19. Built so far

**State on 2026-10-16: every step of §17 is built.**
- Migrations `0109_cogita.sql` and `0110_knowledge_base.sql` are applied to the shared database.
- The legacy code is gone.
- Later the same day, Cogita moved out of the library into its own container, the knowledge base (§2.1).

### Where it lives

| part | files |
|---|---|
| Engine (pure, checked without a browser) | `frontend/src/app/cogita/`: `schema`, `graph`, `check`, `knowness`, `cards`, `revision`, `logic` (the one logic, also used by forms and pages), `flow`, `rules`, `game`, `kinds`, forms for adding: `addForm` (model, plan, row order), `addFormText` (pasted lists, problems, description), `addFormBuild` (a form from a kind, “kolejny taki”), `addFormEdit` (editing what is there) |
| Knowledge base on the schema | `store.ts` (`CogitaLibrary`: own entries plus sources), `sources.ts` (opening the sources), `kinds.ts`, `versions.ts`, `files.ts`, `json.ts`, `presets.ts`; the IndexedDB copy in `libraryStore.ts` and `idb.ts` |
| Learning | `learn.ts` (sealed batches, outbox, due), `holders.ts`, `offline.ts`, `python.ts` with `python.worker.ts` (Pyodide) |
| Screens | `LearnView.tsx` (the workspace view **Nauka**: the knowledge bases, due, sessions, offline), `CogitaHome.tsx` (one knowledge base and its tabs), `LearnPart.tsx` (the view part), `AddFormEditor.tsx`, `AddFormRun.tsx` and `AddFormRows.tsx` (forms for adding and editing in their shape, §2.4), and the editors and players beside them |
| Sessions | `live.ts` (keys, events, SignalR client with polling fallback), `Sessions.tsx`, `GamePanel.tsx` |
| Public pages | `parts/cogita.tsx` (definitions) with `parts/cogitaViews.tsx` (loaded only when shown), `pageBase.ts` (the base as this reader may read it — step 8), `PublicRun.tsx` (a keyless revision), `entitySubject.tsx`, `seatLearn.ts` |
| Visibility | `visibility.ts` (who reads, in words; what an item needs when it moves), `BaseWho.tsx` ("Kto widzi" with the move, "Kto czyta" in settings), `library/rebuild/baseVisibility.ts` (Porządki tab 5) |
| Views | `selection.ts` (the steps shared with revisions, the collections' rule, groups), `views.ts` (the view document, its list, groups, columns, matrix; view ↔ revision), `viewActions.ts` (create here, add to plan, learn), `ViewSteps.tsx`, `RuleEditor.tsx` and `MatrixGrid.tsx`; on pages `pages/parts/view.tsx` with `viewViews.tsx` (inner views, map), and `pages/partQuery.ts` (state per module in the address); `library/rebuild/pageModules.ts` converts retired modules |
| Forms | `LearnStep.tsx`; the step kind `learn` in `steps.ts` and `StepList.tsx` |
| Service | `backend/Api/`: `Library.Cogita.cs` (versions, files, seat reading), `Cogita.cs` (batches, due, reports, the `c/` addresses), `Cogita.Session.cs`, `CogitaHub.cs` (`/cogita/hub`), `Cogita.Game.cs` (triggers, `CogitaClock`) |

### Where it is used

- **Workspace.**
  - The view **Nauka** (`#/workspace/learn`): the knowledge bases (create one there), due now, sessions and offline practice.
  - A knowledge base (`#/workspace/learn/<id>`) has these tabs: Nauka, Wpisy, Schemat, Szablony kart, Powtórki, Przebiegi, Sesje, Postępy, Mapa, Do zrobienia, Propozycje, Ustawienia, JSON. Readers see Nauka, Przebiegi, Sesje, Postępy, Mapa and Zaproponuj.
  - **Ustawienia** holds the name (and deletion) and **Źródła**: add a library or another knowledge base from any area you read.
  - What comes from a source carries its name. It is read-only here, with a link to where it is changed.
  - The alert **Powtórka czeka** and a daily reminder.
  - A revision becomes a daily task. A session goes into the area's calendar with its join link and code.
  - Ctrl K finds entries and documents of the libraries opened in the tab.
  - The starter **Kurs do nauki** creates an area, a knowledge base, the intake, a daily revision, a learners' role and a link.
- **Pages.** Nine modules: `cogita-revision`, `cogita-flow`, `cogita-live`, `entity-card`, `entity-table`, `topic-explorer`, `knowledge-map`, `seat-learn`, and `view` (step 9). They pick a knowledge base (field kind `knowledge`).
  - In a presentation: the module `question` and the storyboard (§8, built 2026-10-21).
  - The page subject **Wpis z bazy wiedzy** (`entity`).
  - `c/<8 characters>` addresses for pages with one module.
- **Forms.** The step **Naucz się**.
  - The browser of the person with the link measures the knowness and ticks the step at the threshold.
  - The office sees the step in the list. The details are in Postępy.

### Decided while building

- **Schema JSON references** (2026-10-17). A reference field's `to` names kinds by `@ref`, id or name, also kinds further down the same document. Before, it stayed literal, and a schema copied into another base pointed at kind ids that did not exist there.
- **Files across origins** (2026-10-17). The API exposes `X-Epoch` to the browser (CORS `WithExposedHeaders`); against an API without it, a file is opened by trying the held epochs, newest first.
- **Stored entries are not rewritten.**
  - A knowledge base adds the kinds knowledge, question and topic, plus its own. The book kinds (person, work, quote, text, project) live in libraries and are only pointed at.
  - Built-in kinds keep their plaintext kind.
  - Own entities are `entity` entries, with their kinds in `_kinds`.
  - A built-in kind can be renamed by a `kind` entry with `builtin`. Its fields keep their shape.
- **Who learns where.**
  - An account learns into the storage area (or its private area).
  - A seat learns into the course area.
  - Without an account, progress stays in the browser. It is taken over after signing in.
- **Anonymous counts** come from runs with a library (account or seat). A public page has no route to the intake.
- **Live sessions.**
  - Answers are sealed to the area intake (without one, to the session key).
  - The host scores in the browser.
  - Joining with a code gives only the answer buttons. The questions stay on the screen.
- **Size.** The Cogita screens, the page views and the learning step are separate bundles. A page without Cogita loads none of it.

### Checks

| check | count |
|---|---|
| `scripts/app-cogita-check.mjs` (part of `npm run app:check`) | 339 (2026-10-22) |
| `backend/Api.Tests` (22 of them for the game rules) | 470 (2026-10-22) |
| `backend/Kernel.Tests` | 122 |

The full `tsc -p tsconfig.json` is clean now that the legacy tree is gone.

### Left open

- **No browser drive yet.** No end-to-end run with `zz-probe-` data has been done for sessions, games or the learning step. The anonymous routes and the SignalR negotiation answer correctly on a local service against the migrated database.
- **Legacy remnants, kept on purpose.** Six content files stay under `frontend/src/legacy/`:
  - `content/pl.ts` with `content/types.ts` and `types/navigation.ts`;
  - `public/content/pl.ts` with `public/content/types.ts` and `rc/lib/rcRoute.ts`.

  The fixture generators `scripts/cogita-home.mjs` and `scripts/presentation-home.mjs` read them. They go in step 3 of the transfer (`documentation/TRANSFER.md`).
- **Where a library is used.** A library does not know which knowledge bases point at it, because the references are sealed in their settings.

Done on 2026-10-17: the dead `package.json` scripts (`api:types`, `rc:*`, `public:check`, `events:check`) and `_reference/` are removed.

## Appendix A — definitions kept from the former specification

The code cites these four sections of the removed `CogitaAim.md` (“Cogita — Final Post-Recreation Product Specification”). They are quoted here unchanged so that the citations keep a target.

### A.1 Knowness (former I.8, I.8.1)

Knowness is a computed signal attached to a person/entity context. Knowness snapshots MUST be refreshed when a new correctness entry is written for the related person/entity, and SHOULD remain computationally lightweight and stable.

The knowness behaviour is governed by this function form:

```js
function knowledge(q1, d1, q2, d2, t) {
  const T0 = 5 / 60; // 5 minutes in hours
  const H = Math.max(
    T0,
    Math.pow(T0, 1 - q2) * Math.pow(12 * (d2 + q1 * d1), q2)
  );
  return Math.pow(10, 0.5 * (1 - t / H));
}
```

- `q` = correctness quality terms, `d` = delay terms, `t` = elapsed time from the last relevant question.
- The final update SHOULD use up to the last three correctness entries when available.

### A.2 Selection gating (former I.9.1, I.9.2)

If a revision has dependency mode enabled:
- child cards MUST only be selected into the stack when the parent knowness threshold is met;
- a child already in the active stack MUST NOT be removed during the same stack cycle only because the parent drops later.

Propagation: the propagated amount is `childKnowness * impact`, and it MUST be added to the parent knowness. If the child’s correctness worsens, the child’s knowness drops, the parent loses the corresponding contribution, and child availability is re-evaluated against the dependency gates when the stack is rebuilt.

### A.3 Dependency propagation contract (former II.11)

Knowness propagation MUST implement `parentKnowness += childKnowness * impact`. When the child’s knowness decreases, the parent’s propagated contribution MUST decrease accordingly. Eligibility checks MUST re-evaluate child visibility for the next stack build.

### A.4 Role-oriented live wall (former II.18)

Host wall endpoints MUST allow a control mode, an analytics mode and a presentation-safe output mode. Participant wall endpoints MUST be answer-centric and fairness-safe.
