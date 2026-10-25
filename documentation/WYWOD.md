# Wywód — a work's leading question and its argumentation, in Cogita

*Design, 2026-10-25. Not built.*

*How it was made:*
- *Four independent designs were written: data-first, reader-first, boundaries-first and content-first.*
- *Four judges scored them: the three parts, user value, fit with the code, and privacy with AI.*
- *The final design builds on the winner, boundaries-first. A critic then checked it against the code, and its findings are folded in.*

*Section 17 lists problems found in the existing code along the way.*

## 1. What is asked

> in the cogita part there is the representation of the whole article, that is in the library in form of knowledge
> items — selecting a book I'm able to get to the cogita part — and there is a pretty representation of the whole
> structure of the article in form of a leading question and the way of argumentation — without giving up the
> distinction between the parts

**The ask:**
- **The work is in the Library.** The article or book is a work there, often with its full text: a source text, possibly kept in a private library.
- **Its argument is in Cogita.** The argument is: the leading question, the author's answer, arguments and sub-arguments, objections and replies, and the conclusion. It is stored there as knowledge items, i.e. statements.
- **From the book to the structure.** Starting from the work in the Library, one reaches that structure in Cogita. It is shown whole: the question on top, the line of argumentation below.
- **The three parts stay apart.**
  - The Library holds sources, the Scriptorium holds one's own writing, and Cogita holds knowledge.
  - References run in one direction only: Scriptorium → Library and Cogita, Cogita → Library, Library → Library.
  - Backlinks are computed, never stored.

**It must serve five cases:**
1. **A journal article.** Its places are pages, and its text is in the owner's private library.
2. **A Summa article.** One article of the Summa uses scheme `aquinas`: arg. / sed contra / co. / ad. The whole Summa, with hundreds of articles, must be reachable from one book page.
3. **A book of chapter questions.** Each chapter asks a question (scheme `outline`).
4. **Readers with different access.**
   - A parish library reader learns nothing of a private reconstruction.
   - A learner who reads the base but not the private text sees the structure without „pokaż w tekście”.
   - Two people may reconstruct one work in two bases.
5. **Reconstruction and own comment, told apart.** The reconstruction (what the source says, at its places) and own comments (what we think about it) stand side by side and can be told apart.

## 2. What exists, and what is missing

**What exists:**
- **Statements** (`library/blocks.ts`, `library/statement.ts`):
  - a statement is any entry whose kind has a `blocks` field;
  - the thesis is its first sentence;
  - a thesis ending in „?” makes a question, which counts as answered as soon as another statement points at it;
  - the badge Informacja / Interpretacja is computed from what the statement points at.
- **References with a place** (`{value, locator}`). The place schemes in `library/locations.ts`: pages, bible, numbered, aquinas, decimal, sections, outline.
- **„pokaż w tekście”** (`TextJump`), computed from the texts this reader can open.
- **Other building blocks:**
  - Struktura (`viewOutline`);
  - the computed backlinks „Powiązania” on a Library entry;
  - forms that add several connected entries;
  - the entities JSON with a prompt to copy;
  - MCP `get_related`;
  - `templates/cogita/komentarz-biblijny.json`, which already links comments by „Argumenty za” and „Zarzuty”.

**What is missing or in the way** (checked in the code):
- **No shape for an argument.** Nothing says which entry is a work's question, which step hangs under which, or in what order.
- **„Powiązania” lists one row per pointing entry.** A Summa reconstruction would be thousands of rows, and a statement's row is titled „Wpis” (`hitTitle`).
- **The badge counts every reference field.** A step linked to its parent statement reads „Interpretacja”, so reconstruction and opinion look the same.
- **In Cogita every question reads „Pytanie otwarte”.** The store's `markupLook` has no `readable()`, so `answersTo` finds nothing. Only „Do zrobienia” computes it.
- **Struktura is generic.** It repeats „O czym” and the full place on every node, groups by field, and orders by name instead of by the work.
- **The entities import:**
  - resolves `@refs` only by names inside the document or by existing ids, so a Library citation key (`@kowalski2020`) does not resolve;
  - lets a name in the document shadow such a key;
  - stores entries of Library kinds (a `work`, a `person`) inside the base.
- **Importing a template file again duplicates and overwrites.**
  - It adds its card templates and forms a second time, because they match only by id.
  - Importing `komentarz-biblijny.json` after `komentarz.json` replaces the fields of the shared kind name „Komentarz” and drops „O czym”.
- **Card conditions compare option labels.** The `when` node compares option *labels*, so renaming an option silently stops a card.
- **The order of places needs the work entry.** `workScheme` reads the scheme from the work itself. A reader who cannot open the work's library gets every place read as pages.

## 3. The idea

1. **The work stays a source.**
   - Its reconstruction is a set of ordinary Cogita statements of one owner kind, **„Krok wywodu”**, from `templates/cogita/wywod.json`.
   - Each step holds a paraphrase, its **place in the work**, and **one link up** to the step it belongs to. The link goes through a field with the new generic role `parent`.
2. **The structure is computed.**
   - Computed in the reader's browser: which step is the leading question, the tree, the order of the work (from the places), chips, badges, completeness and the links into the text.
   - It is computed only from what that reader can already open.
   - Nothing is stored for it. The Library stores nothing at all.
3. **One click from the book.**
   - „Powiązania” on the work lists, for each readable base, the reconstructed questions in the order of the work.
   - One click opens the screen **„Wywód”** in Wiedza: the leading question on top, and the steps below with their role, place and „pokaż w tekście”.
   - It can be read as the argument tree or in the order of the text.
4. **Reconstruction and opinion stay apart.**
   - Own comments are Komentarz entries pointing at steps. They are drawn in their own lane and are always „Interpretacja”.
   - A step tied to its place reads „Informacja”.
5. **Two ways in, and learning out.**
   - Steps go in by typing rows, or through one's own AI: a generated prompt, the existing entities JSON, and an import that is reviewed as a tree and safe to repeat.
   - They come out as cards declared in the same template.
   - ChatGPT reads the trees through MCP, read-only.

## 4. What lives where

| | holds | never holds |
|---|---|---|
| **Library** | the work with its place scheme, its authors, journal and quotes. Its full text may be in any library, including a private one | anything about a reconstruction: no field, flag, count, cache or pointer into Cogita |
| **Cogita** (the chosen base) | from `wywod.json`: the kind „Krok wywodu”, two forms and five card templates. The steps. Own comments (`komentarz.json`). `settings.sources` naming the work's library | the source text (a step holds a paraphrase and at most one short quotation). The work's data. Order, except `nr` for ties. Flags. A container entry. The private text library in its sources |
| **Scriptorium** | nothing new. A text may link or embed a step, or cite the work | any part of the reconstruction |
| **computed, never stored** | thesis, question, answered, badge. Steps, roots, the leading question, the tree, both orders, chips, relative places. A work's questions. The heads in „Powiązania”. The comments of a step. Completeness. „pokaż w tekście”. The prompt. The import review | — |

## 5. The model

### 5.1 Three field roles: the engine's whole new vocabulary

| role | label in Schematy | on | what the engine does |
|---|---|---|---|
| `parent` | „Krok wyżej (wywód)” | one `ref` field | builds the tree and walks to the root. The field does not count for the badge (decision 1) and stays out of „o: …” and of card subjects |
| `order` | „Kolejność w tym samym miejscu” | `number` | orders siblings, but only when their places are equal |
| `function` | „Rola kroku (napis)” | `choice` or `line` | shows its text as the step's chip, and nothing else |

The roles work together with two existing ones:
- `work` („Źródło”): a reference with a place, giving the step's place in the work;
- `body` („Treść”): the blocks.

**Rules for the roles:**
- **What a step kind is.** Any kind, own or from a reused base, that has a `blocks` field and a `ref` field with role `parent`.
- **Roles are matched strictly by `role`.** The existing `roleField` is not used, because it also accepts a field whose *key* equals the role. A genealogy kind „Osoba” with a field keyed `parent` must never become a step kind.
- **The engine reads no names.** It never reads a kind name, key, label or option value.
  - Another vocabulary, for example several kinds „Zarzut”, „Argument” …, gets the same screens.
  - A kind without a `function` field shows its name as the chip.
- **Several kinds.** An entry with several kinds is a step if any of them is a step kind.

### 5.2 Directions

**Step → parent.** One value, the same direction in which an answer points at its question. This direction has three advantages:
- adding a step never rewrites its parent;
- a step can hang under a step of a reused base;
- deleting a step leaves no stale list behind.

A second value in the field is ignored, with a warning to writers.

**The other directions:**
- **Step → the work with its place**, through the `work`-role field. A value **without** a locator means **the whole work**: it contains every place, sorts first, has no relative place and is never flagged „bez miejsca”.
- **Step → Library sources** in its cells and markup (Wj 3,14; a quote; `[@bultmann1941, s. 23]`).
- **Comment → step** through Komentarz „O czym”. Never step → comment.
- **Library → nothing in Cogita.**

**Where steps hang:**

| step | hangs under |
|---|---|
| the answer, the Summa objections, sed contra, the conclusion | the question |
| an argument | what it supports |
| a sub-argument | its argument |
| an article's objection | what it attacks |
| **a reply** | **its objection** (ad 1 → arg. 1) |
| a distinction or an example | what it clarifies |
| **a chapter question** | **the book's question**, when there is one |

`komentarz-biblijny.json` keeps its own „Argumenty za” and „Zarzuty” (parent → children). Those comments are not steps.

### 5.3 The kind „Krok wywodu”

| key | label | type | role | meaning |
|---|---|---|---|---|
| `rola` | Rola w wywodzie | choice | `function` | Pytanie · Odpowiedź (teza autora) · Argument · Zarzut · Sed contra · Odpowiedź na zarzut · Rozróżnienie · Przykład · Wniosek |
| `miejsce` | Miejsce w dziele | ref → `work`, with a place | `work` | the work and the place in its scheme. For the leading question: the whole unit, or no locator = the whole work. For an unstated premise: no value |
| `tresc` | Treść | blocks | `body` | the first sentence is the thesis, in own words, at most 200 characters, with no place in it. Then a short summary, with at most one short quotation |
| `nalezy` | Należy do | ref → this kind, one value | `parent` | the step above. Empty only in the leading question |
| `nr` | Nr w tym samym miejscu | number | `order` | only when siblings share a place (the five ways in „co.”) |

- **Name and label.** The label is `{tresc}`, so a step is named by its thesis; `tells` is `miejsce`. The kind is not called „Pytanie”: that name belongs to the built-in learning kind.
- **A question the author never asks in words** still takes the unit as its place, and its content says so („Autor nie stawia tego pytania wprost; …”). The value is not marked uncertain: „w przybliżeniu” describes a place, and this place is exact. Every thesis is a paraphrase anyway; whoever disagrees with a formulation writes a Komentarz.

```json
{ "format": "recreatio.cogita.schema", "version": 1, "name": "Wywód — pytanie i argumentacja",
  "kinds": [{ "ref": "@krok", "name": "Krok wywodu", "label": "{tresc}", "tells": "miejsce", "fields": [
    { "key": "rola", "label": "Rola w wywodzie", "type": "choice", "role": "function",
      "options": [{"value":"pytanie","label":"Pytanie"},{"value":"odpowiedz","label":"Odpowiedź (teza autora)"},
        {"value":"argument","label":"Argument"},{"value":"zarzut","label":"Zarzut"},{"value":"sedcontra","label":"Sed contra"},
        {"value":"replika","label":"Odpowiedź na zarzut"},{"value":"rozroznienie","label":"Rozróżnienie"},
        {"value":"przyklad","label":"Przykład"},{"value":"wniosek","label":"Wniosek"}],
      "says": "Co ten krok robi w wywodzie autora …" },
    { "key": "miejsce", "label": "Miejsce w dziele", "type": "ref", "to": ["work"], "locator": true, "role": "work",
      "says": "Dzieło z Biblioteki i miejsce kroku w jego układzie: „s. 46–47”, „I q. 2 a. 3 arg. 1”, „rozdz. 3”. Pytanie wiodące: cały zakres. Przesłanka dopowiedziana: bez miejsca." },
    { "key": "tresc", "label": "Treść", "type": "blocks", "role": "body",
      "says": "Pierwsze zdanie to teza kroku — własnymi słowami, najwyżej 200 znaków, bez miejsca. Dalej krótkie streszczenie; dosłownie najwyżej jedno krótkie zdanie w „…”. Własna ocena to Komentarz wskazujący ten krok." },
    { "key": "nalezy", "label": "Należy do", "type": "ref", "to": ["@krok"], "role": "parent", "inverse": "Kroki niżej",
      "says": "Krok wyżej: pytanie, na które odpowiada; teza, którą wspiera albo atakuje; zarzut, na który odpowiada (ad 1 → arg. 1); pytanie książki nad pytaniem rozdziału. Puste tylko w pytaniu wiodącym." },
    { "key": "nr", "label": "Nr w tym samym miejscu", "type": "number", "role": "order",
      "says": "Tylko gdy kilka kroków pod tym samym krokiem ma to samo miejsce: 1, 2, 3 w kolejności tekstu." } ] }],
  "forms": [ "„Pytania dzieła — wiersz po wierszu”, „Kroki pod krokiem — wiersz po wierszu” (§8.2)" ],
  "templates": [ "five card templates, conditions written with option VALUES (§9)" ] }
```

The file ships no views. The structure never depends on a saved view, and views do not travel with a reused base (`SHARED_DOCS`).

### 5.4 Order: computed, and stored only for ties

`compareSteps` in `cogita/structure.ts` compares two steps in this order:
1. **A readable place first.** A step with a readable place comes before one without.
2. **The place**, compared with `placeCompare` in the scheme:
   - structural paths are compared level by level;
   - aquinas goes by part, question and article, then arg. < sed contra < co. < ad, then the number;
   - outline goes from the volume down; the Bible goes by canon;
   - the whole unit comes before its parts;
   - in scheme `pages`, places are compared by first page, then by last page, so „rozdz. 3, s. 45” and „s. 47” compare by page;
   - unreadable places come last, compared by the raw locator.
3. **`nr`.**
4. **The thesis**, in Polish collation, with numbers compared as numbers.
5. **The id**, only to make the order fixed. Writers then see „bez Nr”.

**The scheme when the work cannot be read.** `workScheme` needs the work entry. When this reader cannot open it — no access, the library removed from the base's sources, or the work deleted — the scheme is **recognised from the places themselves**, in this order:
1. the scheme of a readable text of the work (its manifest);
2. else the one scheme among aquinas, bible, numbered, decimal, sections and outline that reads every place of the tree;
3. else pages.

It is shown as „układ rozpoznany z miejsc” and never stored. So a learner who cannot read the parish library still sees a Summa article in its order.

**Text order** flattens the tree:
- it uses rules 1–2;
- steps with equal places follow the tree, so the answer comes before its five ways;
- an unplaced step (an unstated premise) stands right after its parent, marked „dopowiedziane”.

Ids never carry order. `nr` is written only by the import and the editors, and only for siblings that share a place.

## 6. What is computed

1. **Step, place, parent.**
   - A step's place is the first value of its `work`-role field.
   - Its parent is the value of its `parent` field, if that value resolves to a step.
   - A step whose parent this reader cannot open is shown as its own root, marked „(krok wyżej niedostępny)”.
2. **Roots and the leading question.**
   - A root is a step with an empty parent.
   - The leading question is a root whose thesis ends with „?”.
   - A root without „?” is still a wywód. It is headed „TEZA NA GÓRZE”, and writers get a hint.
3. **Nested questions** (a chapter question under a book question) are descendants that end with „?” **and have steps of their own**.
   - A leaf objection phrased as a question is not one.
   - Writers get a hint that only questions answered below should end with „?”.
4. **The tree.**
   - The children of X are the steps whose parent is X. They come from an index over step kinds only, which reads one field per step and is memoized per store stamp.
   - A path guard draws a cycle as „↺ … (już wyżej)”. Steps in a cycle that no root reaches are listed for writers under „Kroki w kole (n)”.
   - Depth is at most 24 and the tree at most 2 000 nodes; beyond that the screen says „Pokazano 2 000 kroków”.
   - Cross-references in cells never make children.
5. **What opens.** Opening any step shows the nearest question at or above it. A breadcrumb leads to the root, and the opened step is highlighted.
6. **Reading order** (§5.4).
   - **Scheme `aquinas`** opens in text order, with dividers taken from the piece of each place:

     | piece | divider |
     |---|---|
     | arg. | „ZARZUTY — Videtur quod” |
     | sed contra | „SED CONTRA” |
     | co. | „ODPOWIEDŹ — Respondeo” |
     | ad | „ODPOWIEDZI NA ZARZUTY” |

     A root above the article, such as a whole quaestio, is divided by article first.
   - **Every other scheme** opens as the argument tree.
   - **The switch** „Kolejność: wywodu / tekstu” is remembered per browser.
7. **Chips and ordinals.**
   - The chip is the `function` text, otherwise the kind name.
   - **Ordinals:**
     - when the place carries the author's number (aquinas arg. n, ad n), the ordinal is that number: „Zarzut 3” at arg. 3, even when arg. 2 is missing;
     - otherwise, when two siblings share a chip, they get ordinals by position („Argument 2.1” under „Argument 2”).
   - In text order, a step whose parent is not the root shows „↳ do: Zarzut 1”.
   - The root has no chip; its header says „PYTANIE WIODĄCE”.
8. **Relative place.** The place minus the root's unit: „arg. 1”, „sed contra”, „co.”, „ad 1”, „§ 2”. Pages stay as they are („s. 46”). The work's title appears once, in the header.
9. **The badge** (decisions 1–2). What counts are cells, markup and ref fields, with two exceptions:
   - references from a step to other steps do not count: its `parent` field, or a step cited in its text, such as an „ut supra dictum est” pointing at another article;
   - a value in a field that points only at Library source kinds counts as a source, even when this reader cannot open it.

   | entry | badge |
   |---|---|
   | a step with a place | Informacja, for every reader |
   | an unstated premise | „dopowiedziane · Interpretacja” |
   | a step whose text cites a comment | Interpretacja |
   | a comment | Interpretacja |
   | existing comment entries | unchanged (no existing template declares `parent`) |
10. **Answered.** The rule is unchanged: another readable statement points at the question. What changes is that it becomes true inside Cogita.
    - `markupLook` gets `answered(id)`, from the computation „Do zrobienia” already uses.
    - Outside Cogita, for example through a Scriptorium link, the question mark is answered from the step's base when that base is loaded, and otherwise not shown.
11. **The comments of a step.**
    - They are statements of this base or of its declared sources that point at the step and are not steps.
    - Never from bases that are merely loaded in the tab, and never attached by an overlapping place.
12. **Completeness**, shown and never stored.
    - **For everyone:** the number of steps, of steps with a place, and of comments. With a readable text, also „w tekście a/b”.
    - **For writers, also:**
      - a step without a place;
      - a place the scheme cannot read;
      - a place outside the root's unit or the work's pages;
      - siblings at one place without `nr`;
      - a thesis that is missing, too long, ends on a place abbreviation, or is only a piece marker („Ad 1.”, „Co.”);
      - a root without „?”;
      - orphans and cycles;
      - for aquinas only: an „ad n” not under „arg. n”, and an „arg. n” without „ad n” (a hint only).
13. **The questions of a work** („Pytania dzieła”).
    - **Which:** roots whose place is in the work, in the order of the work.
    - **Grouping:** one level up — aquinas „I, q. 2”; outline the levels above; pages no groups.
    - **Group heading:** the label of a readable text part, otherwise the formatted place.
    - **Nested questions** are indented.
    - **Roots outside every work:** those whose work cannot be resolved go to „Dzieło niedostępne (…)”, those without a place to „Wywody bez dzieła”.
14. **Heads in the Library.** They are computed per knowledge store loaded in the tab, in `library/structureHits.ts`.
    - A head is a hit on the work **through the step's `work`-role field**, not a citation in a cell, whose entry is a step with an empty parent.
    - For structural schemes there are also hits on other editions of the work (`editionsOf`), labelled „(w wydaniu: …)”.
15. **„Inne rekonstrukcje tego miejsca”.** Heads in other loaded bases whose place overlaps this one. They are for display only, and only in the workspace.

**Outside every structure:**
- comments (they have their own lane);
- Scriptorium texts;
- statements that cite the work but are not steps („Wpisy o tym dziele poza wywodami”);
- Library quotes;
- steps of other bases;
- orphans (in the writers' list);
- the source text (shown, never copied).

## 7. Screens

### 7.1 The Library work page: inside „Powiązania”

```
┌ Powiązania ───────────────────────────────────────────────────────┐
│ Cytaty z tego źródła: 12 — lista i dodawanie pod polami             │
│ W bazie wiedzy „Studium Tomasza”                                    │
│  Wywody (214)              [Szukaj albo miejsce: I q. 2           ] │
│   I, q. 2                                                           │
│    a. 1  Czy istnienie Boga jest oczywiste samo przez się?        › │
│    a. 2  Czy można dowieść, że Bóg istnieje?                      › │
│    a. 3  Czy Bóg istnieje?                                        › │
│   I, q. 3                                                           │
│    a. 1  Czy Bóg jest ciałem?                                     › │
│   [Pokaż wszystkie (214)]   [Pytania dzieła w Wiedzy →]             │
│  ▸ Pozostałe wpisy (2 418)                                          │
│ W bazie wiedzy „Seminarium”                                         │
│  Wywody (1)  I, q. 2, a. 3 · Czy Bóg istnieje?                    › │
│ Na stronach, które prowadzisz [Sprawdź strony]                      │
│ Przeszukano 3 bibliotek i 2 baz wiedzy… [Szukaj we wszystkich, …]   │
└─────────────────────────────────────────────────────────────────────┘
```

- **A journal article** shows: „Wywody (1): s. 45–60 · Czy trzykrotne pytanie Jezusa w J 21 jest przesłuchaniem? ›”.
- **Links.** A head links to `#/workspace/knowledge/<base>/wpisy/<root>`. „Pytania dzieła w Wiedzy →” links to `…/wpisy/dzielo/<work>`.
- **Long lists.** The first 8 heads are shown, with a filter by words or by a place in the work's scheme.
- **„Pozostałe wpisy”** is folded and shows 50 rows at a time. Rows are titled by their thesis (the `hitTitle` fix).
- **No actions:** no „+”, no AI button and no base chooser. A reconstruction is started in Wiedza.
- **Phone.** The side boxes stack under all the fields, so the head is repeated as one line under the title (decision 4). Either „W Wiedzy: „Czy trzykrotne pytanie…?” (Studium) ›” or „W Wiedzy: 214 wywodów („Studium Tomasza”) ↓”.

### 7.2 „Wywód”: a journal article (desktop, argument order)

Route: `#/workspace/knowledge/<base>/wpisy/<id>` for any step. Readers have Wpisy.

```
Wiedza › Studium › Wpisy                                                🎓 Ucz się z tej bazy
← Pytania dzieła: Miłość, która pyta (1)
┌ PYTANIE WIODĄCE ───────────────────────────────── s. 45–60 ┐ ┌ [Tekst] [Komentarze (2)] ───┐
│ Czy trzykrotne pytanie Jezusa w J 21 jest przesłuchaniem? │ │ s. 47–49 · Argument 1         │
│ J. Kowalski, Miłość, która pyta, „Przegląd Biblijny” 12   │ │ the passage, read with your   │
│ Pytanie — jest odpowiedź · pokaż w tekście · czytnik      │ │ own access         [czytnik]  │
│ 14 kroków · w tekście 14/14 · komentarze 2                │ └───────────────────────────────┘
│ Kolejność: (•) wywodu ( ) tekstu  [Tylko tezy] [Ucz się] ⋯│
└───────────────────────────────────────────────────────────┘
 Kroki mówią, co jest w źródle — każdy przy swoim miejscu · Komentarze — co my o tym myślimy
 ODPOWIEDŹ                                                         s. 46     ▸
 Nie: to uzdrowienie pamięci Piotra, nie przesłuchanie.
 ├ ARGUMENT 1   Trzy pytania odpowiadają trzem zaparciom.          s. 47–49  ▸  ● 1
 │  ├ ARGUMENT 1.1  To samo ognisko: J 18,18 i J 21,9.             s. 48     ▸
 │  └ ARGUMENT 1.2  dopowiedziane · Interpretacja — Piotr słyszy aluzję do zaparcia.  ▸
 ├ ARGUMENT 2   Agapao i phileo nie są synonimami.                 s. 49–50  ▸
 └ ZARZUT       To tylko wariacja stylu.                           s. 51     ▸
    └ ODPOWIEDŹ NA ZARZUT  Jan waży słowa — por. J 15,13.          s. 52     ▸
 WNIOSEK                                                           s. 58     ▸
 Pytanie Jezusa przywraca Piotrowi misję pasterza.
▸ Pola tego wpisu                     (the existing editor, folded; open for writers)
```

- **Folding.** Each step is folded to its thesis. ▸ opens the whole statement (`StatementCard`), together with „pokaż w tekście”.
- **Badges.** Steps with Informacja carry no pill; the legend says what they are. Exceptions are marked. „● 1” marks one comment.
- **The side pane** („Tekst” and „Komentarze”) is shown on desktop only.
- **Writer menu per step (⋯):** Edytuj tutaj · + Krok pod spodem · + Komentarz · Przenieś pod… · Ustal kolejność (only among siblings at one place) · Otwórz jako wpis · Usuń…
- **Header menu (⋯):** Dodaj wiele kroków (wierszami) · Uzupełnij przez AI… · Eksportuj wywód (JSON) · Zapisz jako powtórkę · Kopiuj link.

### 7.3 „Wywód”: a Summa article (text order, the default for aquinas)

```
← Pytania dzieła: Summa theologiae (214)               Inne rekonstrukcje tego miejsca: Seminarium ›
┌ PYTANIE WIODĄCE ────────────────────────────────── I, q. 2, a. 3 ┐
│ Czy Bóg istnieje?                                                │
│ Tomasz z Akwinu, Summa theologiae · pokaż w tekście · czytnik    │
│ Pytanie — jest odpowiedź · 12 kroków · w tekście 12/12 · kom. 2  │
│ Kolejność: ( ) wywodu (•) tekstu   [Tylko tezy] [Ucz się tego] ⋯ │
└──────────────────────────────────────────────────────────────────┘
 ZARZUTY — Videtur quod
  arg. 1   Zarzut 1    Wydaje się, że Boga nie ma, bo istnieje zło.              ▸
  arg. 2   Zarzut 2    Wydaje się, że świat tłumaczy się bez Boga.               ▸
 SED CONTRA
  sed contra           Bóg mówi o sobie: „Jestem, który jestem” (Wj 3,14).      ▸
 ODPOWIEDŹ — Respondeo
  co.      Odpowiedź   Istnienie Boga można wykazać na pięć dróg.               ▸
  co.      Argument 1  Droga pierwsza — z ruchu.               ↳ do: Odpowiedź  ▸
  …        Argument 5  Droga piąta — z rządzenia światem.                       ▸ ● 1
 ODPOWIEDZI NA ZARZUTY
  ad 1     Odpowiedź na zarzut  Bóg dopuszcza zło, by wyprowadzić dobro.   ↳ do: Zarzut 1 ▸
  ad 2     Odpowiedź na zarzut  Natura i rozum działają ze względu na Boga. ↳ do: Zarzut 2 ▸
```

With „Kolejność: wywodu” the same article shows the tree. Each reply sits under its objection:

```
 ZARZUT 1   Wydaje się, że Boga nie ma, bo istnieje zło.        arg. 1 ▸
 └ ODPOWIEDŹ NA ZARZUT  Bóg dopuszcza zło, by wyprowadzić dobro.   ad 1 ▸
 ZARZUT 2   …                                                   arg. 2 ▸
 └ ODPOWIEDŹ NA ZARZUT  …                                          ad 2 ▸
 SED CONTRA  Bóg mówi o sobie: „Jestem, który jestem”.      sed contra ▸
 ODPOWIEDŹ   Istnienie Boga można wykazać na pięć dróg.            co. ▾
 ├ ARGUMENT 1  Droga pierwsza — z ruchu.                           co. ▸
 └ ARGUMENT 5  Droga piąta — z rządzenia światem.                  co. ▸ ● 1
```

### 7.4 Phone

```
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ ← Summa theologiae (214)  ⋯  │   │ ← Miłość, która pyta (1)  ⋯  │
│ PYTANIE · I, q. 2, a. 3      │   │ PYTANIE · s. 45–60           │
│ Czy Bóg istnieje?            │   │ Czy trzykrotne pytanie       │
│ pokaż w tekście              │   │ Jezusa w J 21 jest           │
│ 12 kroków · w tekście 12/12  │   │ przesłuchaniem?              │
│ [Wywód | Tekst] [Tylko tezy] │   │ [Wywód | Tekst] [Tylko tezy] │
├──────────────────────────────┤   ├──────────────────────────────┤
│ ZARZUTY — Videtur quod       │   │ Odpowiedź · s. 46          ▾ │
│ arg. 1 · Zarzut 1          ▸ │   │ Nie: to uzdrowienie pamięci… │
│ Wydaje się, że Boga nie ma…  │   │ ┃ Argument 1 · s. 47–49    ▸ │
│ SED CONTRA                   │   │ ┃ Trzy pytania — trzy        │
│ sed contra                 ▸ │   │ ┃ zaparcia.          ● 1     │
│ ODPOWIEDŹ — Respondeo        │   │ ┃ ↳ 2 kroki niżej            │
│ co. · Odpowiedź            ▾ │   │ ┃ Zarzut · s. 51           ▸ │
│ ┃ co. · Argument 1         ▸ │   │ Wniosek · s. 58            ▸ │
│ ┃ ┆ Komentarz · Interpretacja│   │                              │
│ [ Ucz się tego wywodu ]      │   │ [ Ucz się tego wywodu ]      │
└──────────────────────────────┘   └──────────────────────────────┘
```

- **Depth.** At most two indents are drawn; deeper steps fold into „↳ n kroków niżej”.
- **Text and comments.** „pokaż w tekście” opens the passage inline; there is no side pane. Comments sit under their step, folded.
- **Controls.** The actions are in ⋯. „Ucz się tego wywodu” stays at the bottom.

### 7.5 „Pytania dzieła”: a big book

Route: `#/workspace/knowledge/<base>/wpisy/dzielo/<work>`. Without a work, it shows a work picker.

```
← Wpisy
Tomasz z Akwinu, Summa theologiae · z biblioteki „Biblioteka parafialna”              [Czytaj]
Pytania dzieła — 214 wywodów w porządku dzieła
[Szukaj w pytaniach…        ] [Przejdź do miejsca: I q. 2 a. 3 ⏎]  [Ucz się tych pytań]  [⋯]
▸ I, q. 1 — O świętej nauce (2)
▾ I, q. 2 — O Bogu, czy Bóg istnieje (3)        ← heading from a readable text part, else „I, q. 2”
    a. 1  Czy istnienie Boga jest oczywiste samo przez się?          9 kroków
    a. 2  Czy można dowieść, że Bóg istnieje?                        9 kroków
    a. 3  Czy Bóg istnieje?                             12 kroków · 2 komentarze
▸ I, q. 3 — O prostocie Boga (7)
▸ Wpisy o tym dziele poza wywodami (2)
```

- **„Czytaj”** appears only when a text of the work is readable here.
- **Writer menu (⋯):** + Nowe pytanie · Pytania dzieła — wiersz po wierszu · Polecenie dla AI… · Import JSON… · Eksportuj wywody (JSON) · Kroki bez kroku wyżej (n).
- **A root without steps** says „do opracowania”.
- **With exactly one root**, the route shows that wywód directly.
- **Case 3** (scheme `outline`) groups by „cz. 1”, „cz. 2”. A book question lists its chapter questions indented:

```
   Czym jest wiara?  (całe dzieło)                         3 kroki
     rozdz. 1  Czy wiara jest wiedzą?                     8 kroków
     rozdz. 2  Czy wiara jest posłuszeństwem?             6 kroków
```

### 7.6 Elsewhere in Cogita

- **Any step opened from search, a card or a backlink** shows:
  - a breadcrumb „W wywodzie: Czy Bóg istnieje? › Zarzut 1 › Odpowiedź na zarzut”;
  - the structure, with that step highlighted;
  - then „▸ Pola tego wpisu”.
- **A Library work opened in Cogita** gets a card „Wywody tego dzieła w tej bazie (214) →”.
- **The top of Wpisy**, when the base has wywody: „Wywody: Summa theologiae (214) · Miłość, która pyta (1) ›”.
- **A card's explanation** gets „w wywodzie ›”.
- **„Do zrobienia”** gets a section „Wywody do uzupełnienia”.

### 7.7 The page module „Pytanie i wywód” (part `structure`)

```
strip:  Czy Bóg istnieje? · I, q. 2, a. 3 · 12 kroków                    [Zobacz]
block:  ┌ Czy Bóg istnieje? ─────────────────────────── I, q. 2, a. 3 ┐
        │ Tomasz z Akwinu, Summa theologiae                            │
        │ Zarzut 1 · Wydaje się, że Boga nie ma…               arg. 1  │
        │ Sed contra · Bóg mówi o sobie: „Jestem…”         sed contra  │
        │ Odpowiedź · Istnienie Boga można wykazać…               co.  │
        │ [Cały wywód]  [Ucz się tego]                                 │
        └──────────────────────────────────────────────────────────────┘
tall / fullscreen: the read-only „Wywód” (order switch, comments if the module shows them)
```

- **Config:** `title`, `library` (a knowledge base), `entry` (the root or any step), `order` (`wywód`/`tekst`/empty) and `comments` (`pokaż`/`ukryj`). The state lives in the address under the module's scope.
- **Access.** The page reads the base with the visitor's own access. A visitor who cannot read it sees „Tej bazy wiedzy nie możesz tu czytać”.

### 7.8 States

| state | what is shown |
|---|---|
| loading | „Otwieranie bazy i jej źródeł…”; texts come later, never blocking. The route `dzielo` is handled before any entry lookup, and nothing is decided while the sources load |
| no step kind in the base | writers: „Ta baza nie ma rodzaju kroków wywodu — zaimportuj templates/cogita/wywod.json”; readers: nothing |
| the base does not read the work's library | writers: „Ta baza nie korzysta z biblioteki „…” — [Dodaj do źródeł]”, with a warning when that library lies in another area (§10); readers: bare places |
| the work unreadable for this reader | only places, in the recognised scheme; no title |
| no readable text | no „pokaż w tekście”, „czytnik”, „Tekst” or „w tekście”; nothing tells that a private text exists |
| root only | writers: „Ten wywód nie ma jeszcze kroków. + Krok pod spodem · Dodaj wiele (wierszami) · Polecenie dla AI”; readers: „Rekonstrukcja nie jest jeszcze gotowa.” |
| many | groups collapsed; the Library shows 8 heads plus a filter; above 60 steps only level 1 is open; above 2 000 nodes „Pokazano 2 000 kroków” |
| cycle / deep / orphan | „↺ … (już wyżej)” · „▸ n kroków niżej” · „Kroki bez kroku wyżej (n)” and „Kroki w kole (n)” (writers only) |
| step from a reused base | „z bazy „X” — zmień tam”; read-only; own comments allowed |

### 7.9 Accessibility

- **Tree semantics.** The tree is `role=tree` / `treeitem`, with `aria-level`, `aria-expanded`, `aria-setsize` and `aria-posinset`, and a roving tabindex.
- **Keys.** Arrow keys work only while the tree has focus. There are no single-letter shortcuts outside it.
- **Symbols have text:** „1 komentarz”, „już wyżej”, „należy do: Zarzut 1”. Each step carries a visually hidden „Informacja” or „Interpretacja”.
- **Focus and touch.** Opening a step moves focus to it. Touch targets are 44 px on the phone.

## 8. Getting content in

### 8.1 Once per base

- **Sources.** Ustawienia → Źródła: add the work's library.
  - **Do not** add the private text library. Its name and id would be readable by every reader of the base, and public for an opened public base.
  - Texts are found in the account's own readable libraries instead (§10).
  - When the work entry itself sits in a private library, the app warns before adding that library: „nazwa i identyfikator tej biblioteki będą widoczne dla czytelników bazy”. It recommends keeping the work in a shared library and only the text private; moving a work keeps its id.
- **Templates.** Schematy → Rodzaje wpisów → „Schemat jako JSON”: import `wywod.json`, and `komentarz.json` for comments.

### 8.2 Typing row by row

- **„Pytania dzieła — wiersz po wierszu”.**
  - Choose the work once. Each row is „Treść | Miejsce”, e.g. „Czy Bóg istnieje? | I q. 2 a. 3”.
  - A whole table of contents can be pasted.
  - Reuse counts the place, so pasting the same list again creates nothing.
- **„Kroki pod krokiem — wiersz po wierszu”.**
  - Choose the work and the step above once. Each row is „Rola | Treść | Miejsce”, e.g. „Zarzut | Wydaje się, że Boga nie ma… | I q. 2 a. 3 arg. 1”.
  - To check when building: the column order with one fixed field, and a fixed choice value read as an option value.
- **„Dodaj wiele kroków (wierszami)”** on the Wywód screen (phase 4) is an outline editor:
  - **Rows:** „Rola | Miejsce | Teza”. Indentation gives the parent: Alt+→ / Alt+← move a row deeper or higher, and Alt+↑ / Alt+↓ move it with its branch.
  - **Relative places** („arg. 1”, „47”) are completed from the row above and checked as they are typed.
  - **„Wklej listę…”** accepts an indented outline:
    - depth comes from two spaces, a tab, or „1.1.”;
    - the role from a „Rola:” prefix;
    - the place after the last „|” or in trailing parentheses.
  - **Same path as the AI.** The rows become the same entities document and go through the same review as the AI import.

### 8.3 The prompt to copy (the app never calls an AI)

**Where it is.** From „Pytania dzieła” (⋯ → „Polecenie dla AI…”) and from a wywód (⋯ → „Uzupełnij przez AI…”). It is built by `structurePrompt(lib, work, unit, options)` from data, not from a built-in schema.

**What it contains:**
- **The task:** „Odtwórz wywód dzieła: pytanie wiodące i tok argumentacji autora — odpowiedź (tezę), argumenty i podargumenty, zarzuty, które autor omawia, odpowiedzi na nie, wniosek. Odpowiedz WYŁĄCZNIE jednym dokumentem JSON „recreatio.cogita.entities” (wersja 1).”
- **The work:** its full bibliographic line and its **id** (the key only as a hint).
- **The place scheme:** its label, explanation and examples, and the unit („Zakres: I, q. 2, a. 3 — miejsca kroków możesz pisać względem niego: arg. 1, sed contra, co., ad 1”).
- **The base's step kind:** every field's key, label, type, `says` and options, with the meaning of each role. The prompt never names a key the kind lacks.
- **The rules, generated from the roles** (no option value or key is hard-coded):
  - the first entry is the leading question, with no `<parent key>` and a thesis ending with „?”;
  - every other step names its parent; a reply goes under its objection;
  - every step the author says has a place in this work and its scheme: never invent places, give printed pages; an unstated premise has no place;
  - the thesis is one sentence in own words, at most 200 characters, with no place in it; only the leading question and chapter questions end with „?”;
  - siblings at one place get `<order key>` 1, 2, 3;
  - do not copy the text: at most one short quotation;
  - create no works, persons, quotes or kinds;
  - only what the author says, no own remarks.
- **The text, off by default.**
  - **Without the text,** the prompt says: „Tekstu nie ma w tym poleceniu. Jeśli Twój dostęp dla AI (MCP) obejmuje bibliotekę z tekstem: list_texts {"work": "<id>"}, potem read_text {"text": "<id>", "locator": "<zakres>"}. Inaczej użyj załączonego pliku.”
  - **With the text:** a checkbox „Dołącz tekst tego miejsca” appears only when this tab reads a text of the work **and** the user leads the area of the library that holds it (decision 7). It is capped at 60 000 characters.
- **For „Uzupełnij przez AI”**, the prompt adds the current export of the wywód, so the AI keeps the ids and a re-import updates in place.

### 8.4 The JSON: the existing format, nothing new

```json
{"format":"recreatio.cogita.entities","version":1,"name":"Wywód: STh I q. 2 a. 3","entities":[
 {"ref":"@q","kinds":["Krok wywodu"],"data":{"rola":"pytanie","miejsce":{"value":"@<id Summy>","locator":"I q. 2 a. 3"},"tresc":[{"type":"paragraph","text":"Czy Bóg istnieje?"}]}},
 {"ref":"@arg1","kinds":["Krok wywodu"],"data":{"rola":"zarzut","nalezy":"@q","miejsce":{"value":"@<id Summy>","locator":"arg. 1"},"tresc":[{"type":"paragraph","text":"Wydaje się, że Boga nie ma, bo istnieje zło. Gdyby jedno z przeciwieństw było nieskończone, zniszczyłoby drugie."}]}},
 {"ref":"@sc","kinds":["Krok wywodu"],"data":{"rola":"sedcontra","nalezy":"@q","miejsce":{"value":"@<id Summy>","locator":"sed contra"},"tresc":[{"type":"paragraph","text":"Bóg mówi o sobie: „Jestem, który jestem”."},{"type":"unordered","items":[[{"ref":"@bt","locator":"Wj 3,14"}]]}]}},
 {"ref":"@co","kinds":["Krok wywodu"],"data":{"rola":"odpowiedz","nalezy":"@q","miejsce":{"value":"@<id Summy>","locator":"co."},"tresc":[{"type":"paragraph","text":"Istnienie Boga można wykazać na pięć dróg."}]}},
 {"ref":"@d1","kinds":["Krok wywodu"],"data":{"rola":"argument","nalezy":"@co","nr":1,"miejsce":{"value":"@<id Summy>","locator":"co."},"tresc":[{"type":"paragraph","text":"Pierwsza droga wychodzi od ruchu: to, co się porusza, jest poruszane przez coś innego."}]}},
 {"ref":"@ad1","kinds":["Krok wywodu"],"data":{"rola":"replika","nalezy":"@arg1","miejsce":{"value":"@<id Summy>","locator":"ad 1"},"tresc":[{"type":"paragraph","text":"Bóg dopuszcza zło, aby wyprowadzić z niego dobro."}]}}]}
```

A journal article has the same shape:
- the root at „s. 45–60”;
- the answer at „s. 46” under the root;
- the arguments at „s. 47–49” under the answer;
- an objection at „s. 51”, with its reply at „s. 52” under it;
- the conclusion at „s. 58” under the root.

**A chapter added later (case 3).** The import option „pod krokiem: <teza> (@id)” writes `nalezy: @<id>` on the document's top entity. It then hangs under the book question instead of becoming a second root.

### 8.5 The import with review (nothing is saved before „Importuj wywód”)

The panel „Wywód przez AI” has the prompt card, the generated description beside it, and the preview before saving. `planStructureImport` is a **pre-pass around `planImport`**, not a second format. It runs these steps:

1. **Narrow.** Only `entities` are taken.
   - `kinds`, `templates`, `forms`, `views`, `revisions`, `flows`, `settings` and `collections` are named in a warning and never saved.
   - Entries of Library or Scriptorium kinds are refused with where they belong: „Dzieło, osoba, cytat — są w Bibliotece; tu wskazuje się je identyfikatorem”.
2. **Resolve strictly.** A document `ref` first; then an existing id; then a citation key of the base or a **declared** source, through the new `lib.resolveDeclared`.
   - A key always wins over a document name.
   - A key found only in a library this base does not use gives a warning, plus a checkbox to add that library (with the area warning of §8.1).
3. **Complete places.** Only absolute places are stored:
   - „arg. 1” under „I q. 2 a. 3” → „I q. 2 a. 3 arg. 1”;
   - „§ 2” under „rozdz. 3” → „rozdz. 3, § 2”;
   - a bare „47” in scheme pages → „s. 47”.
4. **Fill `nr`** for siblings at one place from document order, and say so.
5. **Match identities** (§8.6), rewrite the matched `@refs`, then let `planImport` plan as usual.
6. **Do not save what did not change.** Only the template's fields of a matched step are replaced; fields the owner added stay. An unchanged entry is „bez zmian” and is not saved.

**The preview shows:**
- **The work and the unit.** „Dzieło: Tomasz z Akwinu, Summa theologiae — układ: Tomasz z Akwinu; zakres: I, q. 2, a. 3.”
- **New or existing.** „Nowy wywód: „Czy Bóg istnieje?” — 12 kroków.” — or — „Wywód tego miejsca już jest w tej bazie — uzupełnię go: nowe 2, zmienione 3, bez zmian 7; nie ma w dokumencie 1 — zostaje.”
- **Every pairing of a changed step** as „stara teza → nowa teza”, with a way to pair differently. A warning appears when a matched thesis changes completely, because the card's history would restart.
- **The tree** in „Tylko tezy” form, drawn by the same `structureTree` as the screen, from the existing and planned entries together.
- **Warnings**, each naming the step by its thesis:
  - a missing place, or a place the scheme cannot read;
  - a place outside the unit or the work's pages;
  - a thesis that breaks off on „q.”, is only „Ad 1.”, or is longer than 200 characters;
  - „ad 2” not under „arg. 2”;
  - a parent that leads nowhere, or a cycle;
  - a quotation longer than two sentences;
  - the text lies in an area that the base's readers do not read („nie przepisuj tekstu do kroków”);
  - the base does not use the work's library. This one blocks the import, while the checkbox stays visible.

**Options:**
- „(•) Uzupełnij istniejący wywód ( ) Zapisz jako osobny wywód”. When two own roots sit at one place, the preview asks which one is meant, and the rows show their number of steps and their last change.
- „Usuń z wywodu kroki, których nie ma w dokumencie”: off by default, and listed in the preview when on.

**Saving.** Steps are saved **level by level**: each depth waits for the one above, and saving stops at the first failure. A retry adopts own parentless steps that match a planned child of the same unit by function, place and `nr`, so nothing is doubled. Then the Wywód opens.

**Routing.** The tab „Import i eksport (JSON)” sends a `recreatio.cogita.entities` document **with no other lists**, whose entries are all of step kinds, to this planner.

### 8.6 Identity: a re-import updates

Identity is checked only among **strictly own** entries (`lib.origin(id)?.own`).

1. **By id.** A step of a reused base is reported („z bazy „X” — zmień tam”) and skipped.
2. **The top entity.**
   - If it names an existing own step as its parent, it is matched among that step's own children by rule 3.
   - Otherwise it is the root at the same work and the same place, after normalising both places.
3. **Every other step, parents first.** Among the matched parent's own children, a step with the same function value, the same place, and the same `nr` when given.
   - If several match, they are paired by position, and every pairing is shown.
   - If none matches, the step is new.
   - Theses are never compared for similarity.
4. **Nothing is deleted** unless the removal option is ticked.

**Consequences:**
- the same document twice: „Bez zmian — nic do zapisania”;
- an export imported back: 0 writes;
- a fresh AI answer for the same unit completes the wywód in place;
- card progress stays, because the ids stay.

### 8.7 Editing on the screen

Writers of the base can edit; steps from a reused base are read-only.
- **Edytuj tutaj:**
  - Rola;
  - Miejsce, with the wywód's work preset, completion and a live check;
  - Treść, in the blocks editor;
  - Nr, only when siblings share the place.
- **+ Krok pod spodem** sets the parent, and fills `nr` when the new step shares a sibling's place.
- **+ Komentarz** uses the comment kind found by declaration: a statement kind that is not a step kind and has a reference field that can point at steps. If there is none: „zaimportuj templates/cogita/komentarz.json”.
- **Przenieś pod…** picks a new parent within this wywód, never one of the step's own descendants.
- **Ustal kolejność (↑ ↓)** works only among siblings at one place and writes `nr`. Elsewhere the order is the work's; to change it, correct the place.
- **Usuń…** names what points at the step (comments, texts) and asks:
  - for a step: „Usuń ten krok i n pod nim” or „Usuń tylko ten — kroki pod nim przejdą wyżej”;
  - for a root: only „cały wywód”, or „zmień pytanie”.
- **„Tekst”** (desktop pane). Selecting text there offers „+ krok z tego miejsca”. Only the place is stored, never the selected text.

### 8.8 Export

„Eksportuj wywód (JSON)” writes **entities only**: no kinds, settings or documents.
- Comments are added only when „z komentarzami” is ticked, and only strictly own ones.
- References are written as `@<id>`. The work is written by id, with its key as a hint; on import, the preview warns when the key and the id lead to different works.
- The generated description stands beside the export.
- `exportCourse` is not used, because it would also carry settings and every own kind.

## 9. Learning in Nauka

Five card templates in `wywod.json`, using existing nodes. Conditions are written with **option values**, so renaming a label in Schematy does not stop them. Card keys are `template:entry`, so progress survives edits and re-imports of the steps.

1. **„Krok: co mówi autor w tym miejscu”** — every placed step except the root.
   - Front: „Zarzut · Summa theologiae, I, q. 2, a. 3, arg. 1 — co tu mówi autor?”. When siblings share role and place, the parent's chip is added.
   - Back: the thesis.
2. **„Wywód: jak autor odpowiada na pytanie”** — function `odpowiedz`. Front: „Jak autor odpowiada na pytanie: …”; back: the thesis.
3. **„Wywód: jak autor odpowiada na zarzut”** — function `replika`. Front: „Zarzut: „…” — co odpowiada autor?”.
4. **„Wywód: jaka to rola?”** — any step except the root. The answer is one of the function options, with three distractors.
5. **„Wywód: ułóż kroki”** — the children of a step, in the order of the work. No card is made for fewer than two.

**Learning one argument:**
- **„Ucz się tego wywodu”** is on the Wywód screen for **every reader, learners included**.
  - It runs only the tree's cards: a new `cardsFor(ids)` computes them for those entries instead of the whole base.
  - Answers go to the declared storage area, as everywhere.
  - Steps added later are included.
- **„Zapisz jako powtórkę”** (writers) makes a revision for Nauka → Powtórki.
- **„Ucz się tych pytań”** on Pytania dzieła covers all wywody of a work, or one group.
- **On pages**, the module's „Ucz się tego” uses the browser's own learner.

A learner without the text library gets the same cards: theses only, never text from it.

## 10. Privacy — case 4, reader by reader

**The setting:**
- Area **Parafia**: library **LP** holds the work W. Its readers include parishioner **R** and the owner.
- Area **Tylko ja**: the owner's library **LO** holds W's text.
- Area **Studium**: base **BS**, read by the owner and learners **L**. Its sources are [LP]; LO is not named.
- Jan has his own base **BJ**.

1. **The service.**
   - It sees only that BS's sealed entries grow. From the workspace it never learns that BS points at W, because references are inside sealed entries. There is no new endpoint, server index or stored pointer.
   - **Exception, already true of pages today:** a page that opens a base asks `/library/where` about referenced ids it does not hold. A page showing a wywód would therefore tell the service the work's id.
   - The module should skip that lookup for the work, which it does not need; otherwise COGITA.md §15 must say so.
2. **R (reads Parafia only) opens W.**
   - „Powiązania” is computed from the stores R's tab opened. BS, BO and BJ are never listed for R, so there is no block, no count and no phone line.
   - The public view shows no backlinks.
   - SourceBox shows no text.
   - R's AI link covers Parafia only.
3. **The owner.**
   - Sees the heads for BS.
   - „pokaż w tekście” works because the Wywód screen looks for texts in the account's own readable libraries: on wide screens one background sync per visit, on a phone or with data saving on request („Szukaj tekstu dzieła w moich bibliotekach”).
   - LO is never written into BS's settings.
   - The import warns not to copy the text.
4. **L (reads Studium and Parafia, not Tylko ja).**
   - **Sees:** the theses, chips, places and W's title.
   - **Does not get „pokaż w tekście”:** LO is not in L's tab, and L holds no key.
   - **Never gets:** LO's name (it is not in BS's settings) or LO's text (steps hold paraphrases).
   - **If L does not read Parafia either:** no title and bare places, still in the right order (§5.4), and the badges are still Informacja (decision 2).
5. **Two reconstructions.**
   - BJ's steps have their own ids and show as a separate block. Identity matching never crosses bases.
   - If BJ reuses BS, BS's steps appear in BJ read-only and Jan's comments live in BJ. A reader of BS alone never sees them.
6. **Pages.**
   - The module reads BS with the visitor's own access.
   - Texts come only through the base's declared sources, so LO never appears on a page.
   - An opened public base publishes its whole content, settings included — one more reason never to name LO.
7. **AI links.**
   - `read_text` by W's id works only through a link that also covers LO.
   - Only an area's leaders create links.
8. **Moving.** For a step, „Kto widzi → Przenieś” offers only „cały wywód” or „tylko ten krok”. The kind entry stays where it is while other entries use it. Today's default „Przenieś je razem z nim” would also take the kind and every ancestor.
9. **An existing exposure, noted.** In the reader, „Dodaj cytat” creates the quote in the work's library when the user writes there; in case 4 that is the parish library. The wywód never uses that path: „+ krok z tego miejsca” stores only the place.

**The hard rule holds.** Every new surface is computed in the browser from stores this account could already open: the heads, the phone line, Pytania dzieła, the Wywód, the text pane, the review, the prompt and the module. None adds a key, a grant, a stored pointer or a server index.

## 11. MCP and the AI link (read-only)

No new tool and no write tool. The ten tools stay read-only.

**How ChatGPT reads a wywód:**
1. `get_schema` shows „Krok wywodu” with every field's role, `says`, options and inverse.
2. `search_entries` „Czy Bóg istnieje” finds the root.
3. `get_related(id: root, direction: "in", depth: 3, fields: ["nalezy"])` returns the subtree: nodes with readable text, and edges with field and locator. For a larger tree it is called again from a deeper node.
4. `read_text(text: <work id>, locator: "I q. 2 a. 3")` reads the passage when the link covers the text's library.

**Text changes only:**
- **A paragraph in `BASE_NOTES`** (`aiAccess/aiSnapshot.ts`): „Wywód: wpis bez wartości w polu z rolą "parent" to pytanie wiodące; kroki niżej wskazują krok wyżej polem z rolą "parent"; miejsce w dziele to pole z rolą "work"; kolejność to kolejność miejsc w układzie dzieła, potem pole z rolą "order"; "function" to rola kroku. Komentarze to inne wypowiedzi wskazujące kroki — nie są częścią rekonstrukcji.”
- **One sentence in the server instructions and in the `get_related` description** (`AiMcp.cs`): „A reconstructed argument: start at its leading question and follow direction "in" along the field with role parent; order steps by the locator of their work-role field.”

**The loop:**
1. The owner asks ChatGPT to compare the reconstruction with the text.
2. ChatGPT reads the tree and the text, and answers with an entities document that keeps the ids.
3. The owner pastes it into „Wywód przez AI”, reviews it and saves it.

## 12. Changes, file by file

There is no migration, no new endpoint and no change to backend logic; the only backend change is text in `AiMcp.cs`. New logic goes into new pure modules.

**Library — rules and helpers**

| file | change |
|---|---|
| `library/statement.ts` | role constants. `aboutOf` returns each value's field role and `to`. `statementRole` skips references to steps and counts unreadable Library-only values as sources. `aboutLine` skips the parent. New `isAnswered`, plus raw-document helpers for the Library side |
| `library/libraryKinds.ts` | `Lookup.answered?(id)` |
| `library/markupView.tsx` | `StatementMarks` uses `isAnswered` |
| `library/locations.ts` | `placeCompare`, `relativePlace`, `completePlace`, `samePlace`, `unitUp`, the aquinas pieces and their headings, and `recogniseScheme(places)` |
| `library/structureHits.ts` (new) | the heads per knowledge store, through the work-role field only; other editions; sorted and grouped, memoized per index stamp |
| `library/refLabels.ts` | `hitTitle` falls back to the thesis before „Wpis” |
| `library/LibraryRelations.tsx` | per base: „Wywody (n)”, a filter, the first 8 then all, „Pozostałe wpisy” in pages of 50. No actions. Exports `RelationsHead` |
| `library/LibraryEditor.tsx` | `RelationsHead` under the title on narrow screens |
| `library/useReadableLibraries.ts` (new) | one sync of the account's readable books libraries per visit, again on `visibilitychange`, re-rendering through `subscribe`; on demand on phones and with data saving |

**Cogita — pure**

| file | change |
|---|---|
| `cogita/schema.ts` | `FIELD_ROLES` += `parent`, `order`, `function` |
| `cogita/statements.ts` | `entitySubjects` (without the parent) and `answeredIds` (moved from Pending) |
| `cogita/store.ts` | `markupLook.answered`. `resolveDeclared` (only the base and its declared sources). Staleness skips the parent and work-role fields of steps. `cardsFor(ids)` |
| `cogita/structure.ts` (new) | step fields by role (strict), `isStep`, `parentOf`, `rootOf`, `stepPlace`, `compareSteps`, `structureTree`, `textOrder`, chips, `commentsOf`, `structureFacts`, `rootsOfWork`, `otherReconstructions` |
| `cogita/structureJson.ts` (new) | `structureDescription`, `structurePrompt`, `planStructureImport`, `writeStructurePlan` (level by level), `exportStructure` |
| `cogita/cardPalette.ts` | `when` also matches option values; `entries` gets `order: 'place'`; `statement.subjects` without the parent |
| `cogita/json.ts` | `planImport` falls back to `resolveDeclared`, and keys win over document names. **Schema imports match card templates and forms by name and kinds, and merge a kind's fields by key** (add the missing ones, keep the existing ones, warn on a type change). Descriptions list roles. The `aiPrompt('entities')` wording changes. Foreign kinds are refused (decision 3) |

**Cogita — screens**

| file | change |
|---|---|
| `cogita/StructureView.tsx` (new) + `cogita.css` | the Wywód screen, and a read-only mode for pages |
| `cogita/WorkQuestions.tsx` (new) | Pytania dzieła |
| `cogita/StructureImport.tsx` (new) | the prompt card, description, preview and import/export |
| `cogita/StructureEdit.tsx` (new, phase 4) | editing on the screen, and the outline editor |
| `cogita/CogitaHome.tsx` | routes `wpisy/dzielo[/<work>]` (handled first) and `wpisy/<step>`, the loading state, the work card, the strip |
| `cogita/CardFace.tsx` | „w wywodzie ›” |
| `cogita/CogitaJson.tsx` | routes pure step documents to the structure import |
| `cogita/Pending.tsx` | `answeredIds`; stale steps grouped per wywód; „Wywody do uzupełnienia”; strict ownership |
| `cogita/BaseWho.tsx` | the move options for steps |

**Pages, AI and data**

| file | change |
|---|---|
| `pages/parts/structure.tsx` + `structureViews.tsx` (new, phase 6) | part „Pytanie i wywód”, with an example and every key described |
| `aiAccess/aiSnapshot.ts` | the `BASE_NOTES` paragraph |
| `backend/Api/Library/AiMcp.cs` | instruction text only |
| `templates/cogita/wywod.json` (new) | the kind, two forms and five card templates |

## 13. Checks and docs

**`app-cogita-check`:**
- **Template:**
  - import `wywod.json` into an empty base without a warning;
  - **import it twice: 0 new card templates or forms**;
  - `komentarz.json` and `komentarz-biblijny.json` in either order: no field of the shared kind is lost.
- **Roles:**
  - renaming the kind, keys, labels and options keeps every rule and every card working;
  - a field keyed `parent` without the role makes no step kind;
  - Komentarz is never a step.
- **Badge:**
  - a step with a place is Informacja, and stays Informacja with the work unreadable;
  - a step without a place is Interpretacja;
  - a comment on a step, and a step citing a comment, are Interpretacja;
  - existing comment entries keep their badge.
- **Answered:** `markupLook.answered` agrees with Pending.
- **Order:**
  - a Summa fixture inserted at random gives the tree arg. 1[ad 1], arg. 2, s.c., co.[ways 1–5] and the text order arg. 1, arg. 2, s.c., co., ways 1–5, ad 1;
  - **the same fixture without the work, and with the work's library removed from the sources, gives the same orders** (the recognised scheme);
  - an article sorts by page; outline sorts rozdz. 2 before rozdz. 10;
  - an unplaced step stands after its parent;
  - a book root without a locator contains every chapter.
- **Chips:** „Zarzut 3” at arg. 3 when arg. 2 is missing; „Argument 2.1”; relative places.
- **Tree:**
  - a cycle is cut, and a rootless cycle is listed;
  - an orphan and an unreadable parent are handled;
  - a leaf ending in „?” is not a nested question;
  - the depth and node caps hold.
- **Comments lane:** only from the base and its declared sources.
- **`planImport`:**
  - declared keys resolve, also in cells;
  - an undeclared key gives a warning;
  - a document name does not shadow a key;
  - foreign kinds are refused.
- **Structure import:**
  - relative places are completed and `nr` is filled;
  - the same document twice → 0 writes; export → import → 0 writes;
  - a fresh document completes the wywód in place;
  - a chapter is attached „pod krokiem”;
  - pairings are listed;
  - saving is level by level, and a retry after a failure leaves no doubles;
  - strict ownership.
- **Prompt and description:**
  - they contain the work's id and the scheme's examples;
  - they name every key of the step kind and no other;
  - they have no text unless it was passed.
- **Cards:**
  - T2 only for `odpowiedz` and T3 only for `replika`, also after the labels are renamed;
  - T4 skips the root;
  - T5 orders by place;
  - the T1 fronts of the five ways differ.
- **Pending:** an edit of the work or of a parent does not flag the steps.

**`app-library-check`:**
- `structureHits` over [LP, BS] gives heads only, through the work-role field; over [LP] it gives nothing.
- `hitTitle` is the thesis.
- No Library store is written during planning, writing or screen actions.
- `placeFor` finds nothing without LO.
- The new `locations` helpers are tested per scheme.

**`app-json-check`:** the part `structure`, with an example, every key described and a lossless round trip.

**Browser drive** (scratchpad, local service, test accounts):
- the template and both forms;
- a journal article through prompt → JSON → review → save → the same document again (0 writes);
- Library → work → Powiązania → Wywód, on desktop and at 360 px;
- privacy:
  - a Parafia-only account sees nothing;
  - a learner sees no „pokaż w tekście” and no private library name;
- MCP `get_related` under both links;
- **the request count on the Library and Wywód screens stays flat** (§17.1).

**Docs to update:**
- **COGITA.md:** §2.2 the roles and `wywod.json`; §3 the badge decision; §14.1 the routes; §15 the page lookup; §19.
- **LIBRARY.md:** „Powiązania” with the wywody and the phone line.
- **AI-BRIEF.md:** the template, the roles and the JSON; keys resolve through declared sources.
- **MCP.md:** reading a wywód.
- **ARCHITECTURE.md:** the new modules.
- **IMPLEMENTATION-LOG.md:** the entry „W1 — Wywód”.

## 14. Plan

| phase | work | what the owner can do at the end |
|---|---|---|
| **P0** | the decisions below | — |
| **P1 — the wywód as data, on one screen** | the rules in `statement.ts`; answered; the roles; the `locations` helpers with the recognised scheme; `structure.ts`; `wywod.json`; the schema-import fixes (templates, forms, merged fields); the card palette changes; StructureView, read-only, both orders; the `hitTitle` fix; the checks | import the template, type a Summa article or a journal article with the two forms, open any step to see the whole structure, and learn it with the five card templates |
| **P2 — from the book** | `structureHits` with editions; the heads in Powiązania; the phone line; `useReadableLibraries`; WorkQuestions; the Wpisy strip; the work card | select the book in the Library, get its questions in the order of the work, then one structure with „pokaż w tekście” |
| **P3 — with your own AI** | `resolveDeclared`, keys winning and foreign kinds refused in `planImport`; the descriptions; `structureJson.ts`; StructureImport; the routing | copy a prompt, paste ChatGPT's JSON, review the tree and the pairings, save, and correct and re-import without doubles |
| **P4 — editing** | StructureEdit; the outline editor and pasted lists; the text pane with „+ krok z tego miejsca”; the Pending and move changes | build and repair structures by hand, and see a list of gaps |
| **P5 — learning in place** | `cardsFor`; „Ucz się tego wywodu” for every reader; „Zapisz jako powtórkę”; „Ucz się tych pytań” | learners study one argument, or a whole quaestio, where they read it |
| **P6 — pages and the AI link** | the part „Pytanie i wywód”; texts through declared sources on pages; skipping the work's where-lookup; `BASE_NOTES`; the `AiMcp.cs` text; the docs; the drive | show a structure on a page, and let ChatGPT read the trees |
| **P7 — later, optional** | the generic Struktura ordered by place; a deeper „Idź po odwołaniu”; a Scriptorium embed of a whole wywód; „Przenieś cały wywód”; readers' proposals on steps through „Zaproponuj”; the reader's way back (decision 13) | — |

## 15. Decisions for the owner

| # | question | recommendation |
|---|---|---|
| 1 | **Badge.** References from a step to other steps (its `parent` field, or a step cited in its text) do not count for Informacja / Interpretacja. References to comments and to all other statements still count. This changes the rule of 2026-10-23 for steps only | **Yes.** Otherwise every step reads „Interpretacja” and reconstruction cannot be told from opinion. Existing entries keep their badges |
| 2 | **A stable badge across readers.** An unreadable value in a field that points only at Library sources still counts as a source | **Yes.** It reveals no more than „[odwołanie niedostępne]” already does |
| 3 | **Every Cogita import refuses entries of Library and Scriptorium kinds** (work, person, quote, text…) and says where they belong; the AI wording changes with it | **Yes.** Bases point at those kinds and do not hold them; today a copied work can take over references meant for the real one |
| 4 | **The phone line under the work's title:** one computed line, no actions | **Yes.** Otherwise the way from the book sits at the very bottom of the page |
| 5 | **The template's vocabulary:** one kind and nine roles; replies under their objection; Summa objections, sed contra and respondeo under the question | **Accept.** Labels may be renamed freely once `when` matches option values |
| 6 | **Default order:** the Summa in text order with dividers, everything else as the tree; a switch remembered per browser | **Yes** |
| 7 | **The passage in the AI prompt:** off by default; offered only to leaders of the text's area, up to 60 000 characters; otherwise MCP `read_text` | **Yes.** Copying a private text into an outside chat is a new way out, so it stays with whoever decides AI access for that area |
| 8 | **Finding texts without naming the private library:** a background sync on wide screens, on request on phones | **Yes** |
| 9 | **„Answered” unchanged:** any readable statement pointing at a question answers it | **Keep it.** The status line shows the finer facts |
| 10 | **Re-import identity as in §8.6;** nothing deleted unless ticked | **Yes** |
| 11 | **A new page part** „Pytanie i wywód”, rather than a new mode of „Widok” | **Yes, in P6** |
| 12 | **Fix `isOwn` in Cogita now, separately** (§17.2) | **Yes.** It is a one-line fix that restores its documented meaning; it needs its own check |
| 13 | **A way back in the Library reader:** „W Wiedzy: kroki przy tym miejscu (n)” beside a place, computed, for the owner's own stores only, never on public pages | **Not yet.** Decide after P2: it puts Cogita marks into the Library's reader |

## 16. Alternatives considered

Four designs were scored by four judges: the parts, user value, fit with the code, and privacy with AI. Each judge gave 0–10, summed:

| design | score | why it was not taken as is |
|---|---|---|
| **C — boundaries first** („Tok argumentacji”) | 26.5 | **The base.** Its seven kinds and three argument roles were more than needed. It redefined „answered”, and it let ids carry order |
| **A — data first** (one kind, saved Struktura views) | 25.5 | The generic Struktura is not a representation: grouping by role breaks the order, and views do not travel with a reused base. It kept the „Wywody” heads and the single structural role |
| **B — reader first** | 24.5 | Its screens and learning were taken. It put a Cogita box with actions on the Library page, and allowed verbatim text in steps |
| **D — content first** | 23.5 | Its identity rules, outline editor and order switch were taken. It had a second JSON format, stored the order of every sibling, and left „Pytanie otwarte” |

## 17. Found on the way (existing code)

1. **The Library view sent ~190 requests per second without end** for any account that reads a knowledge base. The effect that loads the libraries depended on `tick`, and every finished knowledge-base sync bumped `tick` (since Step 11, 2026-10-23). Measured locally: 471 × `/libraries`, 471 × `/areas` and 942 × `/entries` in 10 s.
   - **Fixed 2026-10-25** in `library/LibraryView.tsx`: a finished sync only re-renders, and `tick` still reloads after „+ Biblioteka” and the settings.
   - The same pattern in `scriptorium/ScriptoriumView.tsx` had been held back with `tick === 0`, which stopped „Ustawienia” changes from reloading the list. It got the same fix.
   - After the fix both views are quiet: 1 libraries call, 1 areas call and 2 entries calls. The live site has had the loop since that build.
2. **`CogitaLibrary.isOwn` (`cogita/store.ts`) also says „own” for entries of any other knowledge base open in the tab.** `LibraryStore.get` reaches loaded bases since 2026-10-22. Exports, kind removal, add-form reuse and Pending use it. The fix is `this.store.own(id) !== undefined` with a check (decision 12). Not changed yet.
3. **In Cogita every question reads „Pytanie otwarte”.** `markupLook` has no `readable()`. Fixed in P1.
4. **The Cogita entities import has three gaps.** Library citation keys do not resolve, a document name can shadow a key, and entries of Library kinds are stored inside the base. Fixed in P1/P3 (decision 3).
5. **A template file imported twice duplicates its card templates and forms.** `komentarz.json` and `komentarz-biblijny.json` share the kind name „Komentarz”, so the second import replaces the first's fields. Fixed in P1.
6. **The card condition `when` compares option labels.** Renaming an option silently stops its cards. Fixed in P1.
