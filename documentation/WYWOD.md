# Wywód — the structure of a work in Cogita: its argument or its story, and its stable elements

*Built 2026-10-25, and extended the same day to any kind of work (§1.1). This replaces the design of the same day;
the owner chose the generic version described here.*

## 1. What it does

**The goal.** An article or a book lives in the **Library**. What it argues lives in **Cogita**, as knowledge items: the
leading question, the author's answer, arguments and sub-arguments, objections and replies, and the conclusion. From
the work in the Library, one click opens a readable picture of the whole structure: the question on top, the line of
argumentation below.

**The three parts stay apart:**
- The Library stores nothing about any of this. Its buttons are computed from the knowledge bases the reader can
  already open.
- Cogita holds the steps in **the owner's own kinds**. Nothing is built in, and a ready schema is only a file to
  import.
- References still run Cogita → Library only.

**How it is used:**
1. **Prepare.** The structure is prepared outside the app, by the owner or by the owner's own AI using
   `templates/cogita/wywod-AI.md`, in two steps (§4). First the text goes into the Library, then the structure into
   Cogita. It is imported as ordinary Cogita JSON, with a preview of the tree and a review of every change. Importing
   it again updates the same entries.
2. **Entry points.** „Wejścia z Biblioteki” say which part of the work a structure explains: the whole, the
   beginning, the end, or several parts at once. They may overlap, and parallel structures are allowed.
3. **Buttons in the Library.** At the work, in the reader, and on a phone as one line under the title, buttons
   „W Wiedzy” open the chosen view at the chosen node.

### 1.1 Any work: what describes a text, and what is one's own (2026-10-25, second round)

The owner's decisions:
- **One schema for every kind of work.** Two kinds describe texts, and new possibilities are new options in a list,
  never a new schema.
  - **Krok wywodu**: the moving thought. Its roles are those of an argument (pytanie, odpowiedź, argument, zarzut, sed
    contra, odpowiedź na zarzut, rozróżnienie, przykład, wniosek), plus wątek, część utworu, wydarzenie, etap, opis
    and streszczenie for narratives and descriptions.
  - **Element stały**: the stable things. A concept as this work understands it, a character, a place, an object, a
    group, a motif, a recurring question.
- **They describe only what the work says.** Whatever the source, the owner's or the AI's own remark is a
  **Komentarz** about anything, never one of the two.
- **Concepts above works.** An element without a work („Wolność”) is what the elements of different works point at
  with „Ogólnie” (Kant's and Mill's „wolność”). A comment can then say how they differ. Aspects hang under a concept
  (`nalezy` of the element).
- **Parallel structures of a narrative:** the composition, the chronology and the development of a character. The
  same events stand in all of them: „Należy do” takes several parents. The chronology is ordered by the field „Czas
  opowieści” (`czas`): a memory told at the end of the book can come first.
- **Cards are always checked strictly,** never as free text that could be marked wrong for its wording:
  - connect five fragments of one work with their theses;
  - which of four theses (the others from the same work) belongs to this fragment;
  - from which work this thesis comes;
  - what an element means in its work.

  The step's „Ważny fragment” (`fragment`, the exact sentence) feeds them.
- **Every change to what exists is accepted one by one.** Whether a document comes from the AI or is written by hand,
  the import shows every changed field, and saves it only when the owner accepts it. The owner can edit the proposal
  first. A document names only what it changes: fields it does not name stay, and `null` removes one.

## 2. The mechanism: what the engine knows

Nothing about arguments. It knows four general things, all declared by the owner.

| piece | declared where | what it does |
|---|---|---|
| **Structure field**: a reference field with `structure: "up"` or `"down"` (Schematy → Rodzaje → field → „Połączenie w strukturze”) | in the owner's kind | `up`: this entry lies under the one it points at („Należy do”). `down`: the entries it names lie under it („Argumenty za”). Such links do not count for Informacja / Interpretacja |
| **Step „Idź po strukturze”** (`structure`, `{dir: down/up, one}`) | in a view or a revision | follows the structure fields down or up, to the end, or one level with `one: true` (an old `deep: false` is read the same way) |
| **Struktura display** (`outline: {chip, order?, by?, tie}`) | in the view | the field shown above each step (e.g. „Rola”); tree or text order (`order` left out: the reader's last choice, else text order for Aquinas and tree order for the rest); `by`: a field that orders the steps of one level first (e.g. „Czas opowieści”), else the place in the work; the field for ties at one place (e.g. „Nr”) |
| **Several parents** (a structure field with `multi`) | in the owner's kind | one entry stands in several trees at once: an event in its chapter, in the chronology and in a stage of a character |
| **Card node „Pary z dwóch pól”** (`pairs.fields`) | in a card template | from each entry a pair of two fields (e.g. the fragment and, with the field left empty, the thesis) for „Odpowiedź: dopasowanie par” |
| **Wejście z Biblioteki** (doc kind `anchor`: `{name, work, locator, entry, view, note}`) | in the base: under an entry, in „Więcej → Wejścia z Biblioteki”, or in JSON | the work, its parts (`locator`: empty = whole, `s. 45–47; 58–60` = several parts), the node and the view it opens |

**What is computed, never stored** (`cogita/structure.ts`):
- **Parents and children.** Children come from `up` fields pointing here and from `down` fields listing entries.
  Parents are the reverse. A path guard stops cycles.
- **The place in the work.** It is the first reference with a place to a Library work, among fields that are not
  structure fields. A value without a locator means the whole work.
- **Order:**
  0. when the view says `by`, by that field first (numbers as numbers; entries without it after the others);
  1. by place, read with the work's place scheme (`library/locations.ts`): pages as numbers; Aquinas by part,
     question, article, then arg. < sed contra < co. < ad; outline from the volume down. The whole comes before its
     parts;
  2. then by the view's tie field;
  3. then by the order of a `down` list;
  4. then by name.
- **The place scheme when the work cannot be read** (no access, its library removed from the base's sources, the work
  deleted). It is recognised from the places themselves: the strict readers first (aquinas, bible, decimal,
  outline), then the lenient ones (sections, numbered), else pages.
- **Text order.** The tree is flattened by place. Equal places follow the tree, and a step without a place follows
  the step it lies under.
- **For Aquinas.** The pieces of an article become headings: Zarzuty · Sed contra · Odpowiedź · Odpowiedzi na
  zarzuty. The author's number („arg. 3”) labels the step.
- **Relative places.** A step's place is shown without the root's place when it lies deeper in the same unit:
  „arg. 1”, „co.” under „I q. 2 a. 3”, „§ 4” under „rozdz. 3”, „14” under „J 1”. Another unit („rozdz. 12” under
  „rozdz. 1”) and pages stay whole.
- **Several parts in one place.** Parts are separated by „;”. A part that starts lower than the one before stays in
  its frame: „I q. 2 a. 3; a. 4” is article 4 of the same question, „I q. 2 a. 3 arg. 1; ad 1” the reply in the same
  article, „t. 2, rozdz. 1; rozdz. 9” chapter 9 of the same volume. Pages are always separate parts.
- **Answered.** A question is answered when another statement points at it, or when a step lies under it in a
  structure. Listing a question in one's own `down` field answers the lister, not the question listed. It is
  computed once per state of the base (`CogitaLibrary.answeredIds`; before this, every question in Cogita read
  „Pytanie otwarte”).

## 3. Screens

- **Wiedza → Wpisy, mode Struktura** (`cogita/StructureView.tsx`).
  - Each root is a card: the kicker „Pytanie wiodące” (or the chip), the place, the thesis, the work with „pokaż w
    tekście”, and the number of steps.
  - Below it the steps, either as the tree or in text order („Wywód | Kolejność tekstu”, remembered per browser
    unless the view fixes it). The steps are nested lists. A step's thesis opens the whole step (`aria-expanded`,
    `aria-controls`). ↑ ↓ move between steps, → opens one and ← closes it. „Rozwiń wszystko” opens every step; each
    can still be closed. In text order the heading of an Aquinas piece is read before its first step.
  - **„Tezy skrócone | Całe tezy”** (2026-10-26), beside the order. Short: a thesis is cut after 90 characters
    with „…”, like every name in lists. Whole: the question and every step show the whole first sentence (not the
    paragraph), wrapped over several lines. It is the reader's choice for every root on the screen, remembered per
    browser; references stay short („↳ do:”, the path „W strukturze”).
  - **Levels** (2026-10-26, tree order only, when a step has steps inside it; `cogita/outlineLevels.ts`):
    - The arrow before a step shows or hides the steps inside it, with their number („▾ 3” / „▸ 3”). It is its
      own button (`aria-expanded`, `aria-controls` = the inner list, „Kroki w środku: 3”), so a step with steps
      inside has two tab stops. A step without any has an empty place there. Before this, the arrow repeated the
      thesis (it opened the whole step); in text order there are no levels and no arrow.
    - **„Wszystkie poziomy | Poziom po poziomie”**, the reader's choice for every root, remembered per browser.
      All levels: every step shown; any branch folds by its arrow, and a click on „Wszystkie poziomy” opens them
      all again. Level by level: at first only the outer steps; the arrow opens one step, „Rozwiń poziom” opens one
      more level wherever steps are shown (exactly one: what was open deeper stays closed), „Zwiń poziom” closes the
      deepest level shown. „poziom 2 z 3” tells how far it is open. „Rozwiń wszystko” belongs to all levels and is
      not shown here; the thesis still opens the whole step.
  - Each step shows its chip, thesis, relative place, and a mark when it differs from reporting the source
    („dopowiedziane”, „Interpretacja”). Comments fetched by the view (e.g. „← O czym”) appear only when the step is
    opened, with a count „● n”.
  - A root without structure steps (a view of ordinary references) keeps the earlier outline: each entry with its
    groups („Argumenty za”, „← O czym”) below it.
  - A tree is cut at 2000 steps per root and 24 levels, and at 10000 steps in the whole view. The cut is said on the
    card.
  - The display settings sit under „Dostosuj → Jak pokazać”.
- **A view opened at a node**: `#/workspace/knowledge/<base>/wpisy/widok/<view>/<entry>` (`viewFrom`). Everything
  before the view's first „Idź po…” is replaced by that entry. A banner says „Od wpisu: …”, with a link to the whole
  view. Search and the kind filter are off there (they would find nothing else), and „Ucz się tego” makes a revision
  of what is shown, not of the whole view.
- **An entry's page.** If its kinds have structure fields, the page shows the path from the root („W strukturze: … ›
  …”) and the structure below the entry. It uses the display of the view an anchor at this entry names, else of the
  first Struktura view with a structure step. Below the editor: „Wejścia z Biblioteki” for this entry, with
  „+ Wejście z Biblioteki”. The work and the place it suggests are the entry's own.
- **Więcej → „Wejścia z Biblioteki”**: every anchor of the base, with create, change and delete.
- **The import review** (`cogita/ImportReviewPanel.tsx`, under the plan of every Cogita JSON import, in Wiedza → JSON
  and in Schematy):
  - **Changes to what exists.** Each changed field of an entry, document or kind appears with „było” and „będzie”.
    Nothing is ticked: a change is saved only when accepted. „Popraw propozycję” edits the value first, as text,
    paragraphs or JSON.
  - **New entries.** They are ticked and can be unticked; a large list folds.
  - The button is „Zapisz przyjęte”.
- **„Dostosuj → Jak pokazać → Kroki na jednym poziomie — według”**: the place in the work, or a field (e.g. „Czas
  opowieści”).
- **The Library** (`library/LibraryKnowledge.tsx`, `library/anchorHits.ts`):
  - **Box „W Wiedzy” at a work.** Anchors from the bases this tab opened, grouped by base and ordered by place
    (whole before parts). Anchors on another edition of the work also appear when their place is structural.
  - **On a phone,** one line under the title.
  - **In the reader,** the anchors that touch the part being read.
  - **„Powiązania”** no longer repeats anchors, and its statement rows are titled by their thesis.
  - **Search and „Fragment Pisma”.** An anchor found there is titled „Wejście z Biblioteki: …” and opens where it
    leads (its view at its entry); it is edited under „Wejścia z Biblioteki”.
- **Loading.** While the libraries a base uses are still loading, an entry or a view from them says „Otwieranie
  źródeł…” instead of „nie ma”.

## 4. Getting a structure in

- **Import the schema once.** `templates/cogita/wywod.json` holds:
  - **three kinds:**
    - „Krok wywodu” (`@wywod/krok`): rola, miejsce, treść, ważny fragment, należy do (`up`, several), elementy
      stałe, czas opowieści, nr;
    - „Element stały” (`@wywod/element`): nazwa, czym jest, opis, miejsce (several), ważny fragment, ogólnie,
      część albo aspekt (`up`);
    - „Komentarz” (`@komentarz/rodzaj`);
  - **six views:** „Wywód”, „Wywód — kolejność tekstu”, „Wywód — w czasie opowieści” (`by: czas`), „Pytania
    wiodące i inne początki”, „Elementy stałe” (concepts above works with their aspects and the elements that refer
    to them), and „Elementy stałe — tabela”;
  - **three forms:** questions of a work; steps under a step; elements of a work, each row by row;
  - **four card templates:** „Fragmenty i tezy jednego dzieła — połącz w pary”, „Do tego fragmentu — która teza?”,
    „Z którego dzieła jest ta teza?”, and „Co znaczy w tym dziele…?”.

  The earlier self-assessed template „Krok wywodu: co mówi autor w tym miejscu” is no longer in the file. A base that
  imported it keeps it until the owner deletes it.

  The owner may change all of it, or build their own kinds instead.
- **Prepare it with an AI, in two steps.** `templates/cogita/wywod-AI.md` is the one file to give one's AI.
  - It explains what each part is for, how to build the structures of an arguing text, a Summa article and a
    narrative, the elements and concepts above works, names, places, fragments, entry points, cards and corrections.
  - **Step 1:** the AI turns the work into one `recreatio/source-text` document: the work, its authors and the full
    text. The user imports it in the Library (Źródła → „Dzieło z tekstem (JSON)”). Appendix A is the app's own
    description of that format, generated by `node scripts/wywod-guide.mjs` and compared by `app-cogita-check`.
  - The AI then stops and gives the user a sentence to write: „Tekst jest w Bibliotece. Zrób krok 2: strukturę
    dzieła @<klucz> w Cogicie.”
  - **Step 2:** the structure, as a `recreatio.cogita.entities` document. The AI can read the stored text over MCP
    (`read_text`).
  - Four complete examples: an article with two parallel reconstructions and elements, a Summa article, a novel with
    three parallel structures, and a correction.
- **Import it** in Wiedza → Więcej → „Import i eksport (JSON)”:
  - **Lasting names.** A `ref` with „/” is kept with the entry, the document or the kind (`_ref`, in lower case), so
    the same document again changes the same things. Names are not case-sensitive. A name without „/” (`@q`) holds
    only inside its document.
    - The guide names steps `@<work key>/<reconstruction>/<step>` (`@kowalski2020/calosc/pytanie`,
      `@kowalski2020/wstep/arg1`): each reconstruction of a work has its own middle part.
    - Lasting names hold in the whole base. An entry or document from a document of steps (format `entities`) also
      remembers that document's name (`_refDoc`). When another document reaches it, the review says so: most often a
      second reconstruction that reused the names. The guide tells the AI to choose a new middle part (`calosc-2`).
  - **Separate name spaces.** Kinds and entries share one space; each sort of document (views, anchors, card
    templates …) has its own. An anchor „@q” never changes the entry „@q”. Inside a document, a reference goes to
    the sort its key names first: `collection` to a collection, `view` to a view. A stored entry never changes its
    sort: a view, a kind or an entry saved over an id of another sort is refused.
  - **Which document is meant, in two passes.** First every incoming document takes what it names: an id, a name
    from this document, a lasting name. Only then are card templates and forms without such a match recognised by
    name and kinds. So a same-named copy placed before the original never takes it, and no lasting name exists twice.
  - **Each value of an anchor in its own space.** `entry` is an entry of this base (a Library work there is refused
    with a warning); `view` is a view by name (with or without „@”), lasting name or id; `work` is a work of a library
    the base uses.
  - **What is a reference.** A name with „/” is a reference only where the field is one: a reference field, or the
    `ref` of a cell in a statement. There, a name that leads nowhere is left out, with a warning. In a text field,
    „@autor/rok” is text and stays. A Library key resolves only through the base's declared sources; one that does
    not resolve is left out, and the warning points to Więcej → Ustawienia → Źródła.
  - **What is named in the review:**
    - a document name that shadows a key;
    - an entry of a Library kind (a copy);
    - a name used twice;
    - two names that lead to one merged entry;
    - names of entries made by another document;
    - entries in a circle („A under B, B under A”), with what hangs under it, since no tree would show them;
    - entries whose up field names only themselves or nothing that exists: a tree would start with them, but a view
      that starts from an empty up field (like „Wywód”) would hide them.
  - **Kinds that already exist are completed, not replaced:**
    - The fields the document names come in its order; the others stay, each behind the field it stood behind.
      This means `komentarz-biblijny.json` no longer drops „O czym” of `komentarz.json`.
    - The name, label pattern, `tells` and `system` stay unless the document names them. The review says when they
      change, and when a field changes its type.
    - An import never removes a field (the review says which ones stay); a field is removed in the kind's editor.
    - The shipped files give their kinds lasting names too (`@wywod/krok`, `@komentarz/rodzaj`, `@slownik/slowo` …).
      A kind the owner renamed is found again, instead of a second, empty one being made.
  - **Card templates and forms.** The shipped files give them lasting names (`@komentarz/t-teza`,
    `@psalterz/f-nieszpory` …). One without a lasting name in the base (an import from before) is recognised by its
    name and its kinds, only when exactly one such exists. It is then replaced (said in the review) and gets the name.
  - **Merging keeps names.** Merging two entries carries the dropped one's lasting names to the kept one (`_refs`).
    The same document again writes into the kept entry instead of recreating the dropped one. The row with the kept
    entry's own name wins; a row that reaches it only through the dropped name fills only what is empty, so a
    re-import never undoes the merge.
  - **The preview** draws the tree (+ new, ~ changed) and lists the anchors.
- **What an import does to an entry that exists:** it completes it. The fields the document names replace theirs;
  the others stay; `null` removes a field; the entry's kinds stay and the document's are added. Before, a document
  that left a field out deleted it.
- **The review decides** (§3): changes to what exists only when accepted, new entries unless unticked. An entry or a
  document that only gets its lasting name stamped is saved without a question.
- **Kinds by lasting name in step documents:** `"kinds": ["@wywod/krok"]` finds the kind even after the owner renamed
  it.
- **Export.** Entries, documents and kinds go out under their lasting names. Ids of the base's own entries, kinds and
  documents go out as `@name` inside views (their steps, groups, matrix axes and `#axis:` columns), card templates,
  revisions, flows, collections and forms. So an export imported into another base points at that base's copies.
- **By hand:** the two forms, or single entries in Dodaj.

## 5. Privacy

- **The service.** Anchors and steps are sealed entries of the base. The service sees only that the base has entries
  of the sort „anchor” (the sort of an entry is not sealed), never which work, which part or which entry they name.
- **The Library box** is computed from `loadedStores()`: only bases this account can read are ever loaded. A
  parishioner who reads the library but not the base sees no button, no name and no count (browser drive, check
  „a reader who cannot open the base sees nothing”).
- **The private text library.** It is never named in the base. „pokaż w tekście” appears only for readers whose tab
  can open the text (TextJump).
- **Over MCP and REST.** The AI link snapshot carries every field's `structure`, and the notes and the server
  instructions explain it. Over MCP, an AI reads a structure with `get_related(root, direction "in", fields [<up
  field>], depth 3)` and continues from every node at depth 3. One call returns at most 60 nodes; when it is
  truncated, its edges still name the steps that did not fit. Over REST, `/entry/<id>` lists in `linkedFrom` the
  entries directly below (with their field). Anchors are not part of the snapshot.

## 6. Files

**Cogita:**
- `cogita/structure.ts` (new);
- `cogita/StructureView.tsx` (new);
- `cogita/anchors.ts` and `cogita/AnchorList.tsx` (new);
- `schema.ts` (`FieldDef.structure`);
- `kinds.ts` (doc kind `anchor`);
- `selection.ts`, `nodeFields.ts`, `revision.ts` (the step);
- `views.ts` (`outline` with `by`, `viewFrom`, `viewOutline`);
- `importReview.ts` and `ImportReviewPanel.tsx` (new: the review of an import, used by `CogitaJson.tsx` and `SchemaEditor.tsx`);
- `cardPalette.ts` and `nodeFields.ts` (the node „Pary z dwóch pól”);
- `EntityList.tsx`, `CogitaHome.tsx`, `parts.ts`, `search.ts`, `KindForm.tsx`, `ViewSteps.tsx`, `sources.ts`
  (loading from the first frame);
- `store.ts` (`isOwn`, `resolveDeclared`, `byImportRef` per sort with `_refs`, `answeredIds`, `marks`, the sort
  guard, `saveKind` keeping `_ref`, `merge` carrying names);
- `json.ts` (import with separate name spaces, completing entries, kinds by lasting name, `_refDoc`, the circle
  warning, export with `@name`, `structurePreview`, descriptions);
- `Pending.tsx`, `statements.ts`, `cogita.css`.

**Library:**
- `library/anchorHits.ts` and `library/LibraryKnowledge.tsx` (new);
- `statement.ts` (badge, `isAnswered`, `down` lists in `answersTo`);
- `libraryKinds.ts` (`Lookup.answered`);
- `markupView.tsx`, `locations.ts` (parts after „;” in the frame of the part before), `refLabels.ts` (anchors
  lead where they point);
- `LibraryEditor.tsx`, `LibraryRelations.tsx`, `SourceReader.tsx`, `styles/library.css`.

**AI and MCP:** `aiAccess/aiSnapshot.ts` (notes for MCP and REST readers) and `backend/Api/Library/AiMcp.cs` (the
instruction on reading a structure).

**Data:** `templates/cogita/wywod.json` and `templates/cogita/wywod-AI.md` (with Appendix A from `frontend/scripts/wywod-guide.mjs`);
lasting names for the kinds, card templates and forms of `komentarz.json`, `komentarz-biblijny.json`, `slownik.json`
and `psalterz.json`.

**Checks:**
- `app-cogita-check`: 114 checks. They import all four guide examples as they stand. They cover the second round:
  one event in three structures, the time order, concepts above works, all four card kinds checked against the
  steps of the same work, the correction with its review (default, accept, edit, reject, unreadable edit), kinds by
  lasting name, and Appendix A equal to the app. They also cover the import after the review: older imports recognised, two passes, name spaces and the sort guard, kind names and renamed kinds,
  completed kinds, `down` answers, merged names, case, references only in reference fields, circles and steps that
  point nowhere, anchors, documents reaching another document's entries, export into another base with axes. They
  also cover the structure view: relative places for outlines, one collator, the budget per root, one tab stop per
  step, piece headings, keys, short and whole theses, and the levels (exactly one level deeper or shallower, a
  step „już wyżej”, the arrows and their lists, the remembered choice, no levels in text order).
- `app-library-check`: the „W Wiedzy” computation, and parts after „;” (frames, merging, bare numbers, pages).
- The browser drive `scratchpad/argdesign/wywod-browser.mjs` (headless Edge, local API on LocalDB): 42 checks.
  They run from the schema import to the parishioner who sees nothing, and include the novel's chronology in the
  time of the story, a correction accepted and edited in the review, „Tezy skrócone | Całe tezy” (kept over a
  reload, wrapped on a phone), and „Poziom po poziomie” on the article (2, 5, 7 steps; kept over a reload; a branch
  folded and opened again with all levels).

## 7. Found on the way

1. **The Library view loop: fixed 2026-10-25** (`LibraryView.tsx`, and `ScriptoriumView.tsx`'s workaround). With a
   readable knowledge base, the view sent about 190 requests a second without end.
2. **`CogitaLibrary.isOwn`: fixed.** It answered „own” for entries of any other knowledge base loaded in the tab.
3. **Every question read „Pytanie otwarte” in Cogita: fixed** (`answered`).
4. **The Cogita import: fixed.** Library keys did not resolve, a document name could shadow a key, and entries of
   Library kinds were stored silently. The last of these is now named in the review.
5. **Template files: fixed.** A template file imported twice doubled its card templates and forms. Two files sharing
   the kind name „Komentarz” replaced each other's fields.
6. **The card condition `when` (equals / differs): fixed.** It compared only an option's label, so renaming an option
   silently stopped its cards. It now also matches the stored value.

**From the review of 2026-10-25** (45 confirmed findings, all fixed):

7. **One name space for everything in an import.** An anchor and an entry with the same name changed one another, and
   a view could be written over an entry. Now each sort of document has its own space, and the store refuses to change
   an entry's sort.
8. **Recognising templates by name alone.** A card template of another kind with the same name was overwritten. Now
   the name and the kinds must match, and only when exactly one candidate exists.
9. **Kinds never kept their lasting name,** and the editor would have dropped it. Both fixed.
10. **Exports wrote raw ids** into views, forms and revisions, which pointed nowhere in another base. They now go out
    as `@name`.
11. **A `down` list answered the questions it listed.** It now answers only the lister.
12. **Parts after „;” lost their frame** („I q. 2 a. 3; a. 4” read article 4 without its question).
13. **The tree view** had one budget for the whole view (a large root starved the rest), could not fold from the
    keyboard as announced, and showed the wrong order when the view fixed none. Rebuilt (§3).
14. **A source still loading** made its entries read „nie ma” for a moment.

**Found in the second round** (the same day):

15. **An import replaced entries that already existed.** A field the document did not name was deleted, though the
    format said the import never deletes. Now an import completes an entry, `null` removes a field, and every change
    passes the review.
