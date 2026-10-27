# Preparing a work for Recreatio: its text in the Library, its structure in Cogita

This file is for an AI assistant. The user gives it to you together with a work: a file, a scan, a pasted text, or
access to the work over the Recreatio MCP connection. You prepare the work in **two steps**, in one conversation:

1. **Step 1, the text into the Library.** One JSON document of the format `recreatio/source-text`: the work, its
   authors (and journal or collection), and its full text. You answer with the JSON, tell the user how to import it,
   and **stop**.
2. **Step 2, the structure into Cogita.** When the user writes the sentence you gave them, you prepare one JSON
   document of the format `recreatio.cogita.entities`: the steps of the work, its stable elements, and the entry points
   („Wejścia z Biblioteki”).

A third task can come at any time: **correcting** entries that already exist (yours or the user's), see §5.

Write all content (theses, descriptions, names, the messages to the user) in the language of the work or of the
user, usually Polish. Answer each step with the JSON document only, plus the short message prescribed below.

---

## 1. How the whole thing is built

**The Library holds sources.** That means the work, its authors, its journal and its full text. Nothing in the Library
is an opinion.

**Cogita holds knowledge,** in the kinds of the user's knowledge base. Three kinds matter here; they come from
`templates/cogita/wywod.json`, which the user imports once per base:

| kind (lasting name) | what it is for | used for your own opinion? |
|---|---|---|
| **Krok wywodu** (`@wywod/krok`) | what the work *does*, step by step: a question, a thesis, an argument, an objection and its reply, a part of a novel, an event, a stage of a character's development, a description, a summary | never |
| **Element stały** (`@wywod/element`) | what *stays* in the work: a concept as this work understands it („wolność” here), a character, a place, an object, a group, a motif, a recurring question; also concepts above all works („Wolność” in general) | never |
| **Komentarz** (`@komentarz/rodzaj`) | a remark about anything: a step, an element, a verse, another comment | always |

Krok wywodu and Element stały describe **only what the work says or creates**. Your assessment, a comparison and a
critique are a Komentarz, and only when the user asks for one.

**Structures.** Steps form trees through the field „Należy do” (`nalezy`):
- Each step lies under the step directly above it.
- A tree has one root, a step with an empty `nalezy`.
- A step may lie under **several** steps. An event can sit in a chapter (the composition) and in the chronology at
  the same time.

**Parallel structures.** One work can carry several trees side by side:
- In an arguing text: the whole argument, and the argument of one part (the introduction).
- In a narrative: the composition (how the work is written), the chronology (how the story runs in time), and the
  development of a character.

**Order.** Steps are ordered by their place in the work. The views show the same tree in three ways:
- „Wywód”: the tree, by place;
- „Wywód — kolejność tekstu”: flattened in the order of the text;
- „Wywód — w czasie opowieści”: the tree ordered by the field „Czas opowieści” (`czas`). A memory told at the end of
  the book that happened in the childhood comes first there.

**Elements.**
- Each element of a work names the work and the places where the work introduces or describes it.
- An element with **no** work is a concept above works („Wolność”). Elements of different works point at it with
  „Ogólnie” (`ogolnie`), so the user can compare them in a comment.
- An element can be an aspect or part of another (`nalezy` of the element: „wolność wyboru” under „Wolność”, a room
  under a house).

**Entry points** („Wejścia z Biblioteki”) are buttons in the Library, at the work. Each opens one tree at its root in
a chosen view. Its `locator` says which parts of the work it covers:
- empty: the whole work;
- one range: „s. 45–47”;
- several parts at once: „s. 45–46; 52; 58–60”, i.e. beginning, middle and end.

Entry points may overlap.

**Cards.** The base turns steps and elements into learning cards that are checked strictly (choice and matching,
never free text):

| card | from | so write |
|---|---|---|
| connect the fragments with their theses | the `fragment` and the thesis of up to 5 steps of the same work | a `fragment` for every important step |
| which thesis belongs to this fragment? | one step's `fragment`, its thesis and the theses of other steps of the same work | theses that are clearly different from each other, because they are the wrong answers for each other |
| from which work is this thesis? | the thesis and the works of other steps in the base | the right work in `miejsce` |
| what does „X” mean in this work? | an element's name and the first sentence of descriptions of other elements of the same work | a first sentence of `opis` that says what the element is *in this work* |

---

## 2. Step 1: the text into the Library

**What you produce:** one JSON document of the format `recreatio/source-text`, version 1, with:
- `work`: the work as an object, a key and its fields from the title page or the article heading;
- `entries`: its authors, and the journal or collection it appears in;
- `scheme`: how places are written in this work (§4, „Places”);
- `portions`: the full text, divided as the work divides itself.

The complete format, generated by the app, is in **Appendix A** at the end of this file. In short:

- **Transcribe faithfully.**
  - Word for word, in the order of the original, with its paragraphs, headings, lists, tables and footnotes.
  - Mark page breaks exactly where they fall: `{"type": "page", "page": "46"}` between blocks, or `{{page 46}}`
    inside a paragraph.
  - Never correct, summarise, translate or add anything. Mark what is unreadable or uncertain (`{{? word}}`,
    `"uncertain": true`).
- **Give `loc` to every block that has its own number in the work's structure:** a verse, a numbered point, an article
  piece („I, q. 2, a. 3, arg. 1”), a chapter heading („rozdz. 3”). Pages are never written into `loc`.
- **Choose a short, stable key for the work:** the author's surname and the year (`kowalski2020`), or a usual siglum
  (`sth`). You will use it in step 2.
- **A long work:** if it does not fit into one answer, send several documents. The first has `work`, `entries` and
  the first portions; the next ones have `"work": "@<key>"` and the following portions. Never cut a portion in half.

**Where the user imports it:**
1. In the Library, the tab „Źródła”, click „Dzieło z tekstem (JSON)”.
2. Choose the library for the text (a private one for a text under copyright).
3. Paste the JSON, check the preview, and click import.

**Then stop.** After the JSON, write exactly this message (in the user's language), with the work's key filled in:

> Krok 1 gotowy. Zaimportuj ten dokument w Bibliotece: zakładka „Źródła” → „Dzieło z tekstem (JSON)” → wybierz
> bibliotekę na tekst → wklej → sprawdź podgląd → zapisz. Gdy tekst będzie w Bibliotece, napisz mi:
>
> **Tekst jest w Bibliotece. Zrób krok 2: strukturę dzieła @kowalski2020 w Cogicie.**

Do not start step 2 before the user writes this sentence.

---

## 3. Step 2: the structure into Cogita

**Before you start:**
- **The schema.** The base must contain the kinds from `templates/cogita/wywod.json`. The user imports it once:
  Wiedza → Schematy → Rodzaje wpisów → „Schemat jako JSON” → Import.
- **The sources.** The base must use the library with the work as a source (Wiedza → Więcej → Ustawienia → Źródła).
  A work key resolves only in the libraries the base uses.
- **Reading the text.** You already have it from step 1. Over MCP you can also read it as it is stored, with
  `list_texts` and `read_text` (by place, for example `"s. 45"` or `"I q. 2 a. 3"`), and check the work with
  `get_entry`.

**What you produce:** one JSON document:

```
{"format": "recreatio.cogita.entities", "version": 1, "name": "<Wywód: author, title (year)>",
 "entities": [ …steps and elements… ], "anchors": [ …entry points… ]}
```

- Write the kind by its lasting name: `"kinds": ["@wywod/krok"]`, `"kinds": ["@wywod/element"]` and, only when asked
  for an opinion, `"kinds": ["@komentarz/rodzaj"]`. The lasting name finds the kind even if the user renamed it.
- Keep `name` the same when you send a corrected version of the same document. The import then knows the entries are
  yours.

**Where the user imports it:**
1. Wiedza → Więcej → „Import i eksport (JSON)”.
2. Paste the JSON. The preview shows the tree.
3. In the review, the new entries are ticked, and changes to existing entries must be accepted one by one (each can
   be edited).
4. Click „Zapisz przyjęte”.

### 3.1 The fields of Krok wywodu

| key | what to write |
|---|---|
| `rola` | `pytanie`, `odpowiedz`, `argument`, `zarzut`, `sedcontra`, `replika`, `rozroznienie`, `przyklad`, `wniosek` (arguing texts); `watek`, `czesc`, `wydarzenie`, `etap`, `opis`, `streszczenie` (narratives and descriptions) |
| `miejsce` | `{"value": "@<work key>", "locator": "<place>"}`. A root covers its whole range („s. 45–60”, „I q. 2 a. 3”). Leave it out for a premise the author does not state |
| `tresc` | `[{"type": "paragraph", "text": "…"}]`. The first sentence is the **thesis**: one sentence in your own words, at most 200 characters, with no place in brackets. Then, if useful, a short summary. Never copy the text here |
| `fragment` | the most important sentence (at most three) of this place, **copied exactly** from the text, without quotation marks. Every step that stands at one place of the text should have one, because the cards are built from it. Not for a root, a part or a stage that only covers a range |
| `nalezy` | the step or steps directly above: `"@<name>"` or `["@<name>", "@<name>"]`. Leave it out only for a root |
| `elementy` | the stable elements this step speaks about: `["@<name>"]` |
| `czas` | narratives only: the order in the story's own time, 1 = earliest. Events at the same time share a number |
| `nr` | only when several steps under the same step have the same place (the five ways in „co.”): 1, 2, 3 in the order of the text |

### 3.2 The fields of Element stały

| key | what to write |
|---|---|
| `nazwa` | the name as in the work: a word („agapao”), a character's name, a place |
| `czym` | `pojecie`, `postac`, `miejsce`, `przedmiot`, `grupa`, `motyw`, `pytanie` |
| `opis` | blocks. The first sentence says what the element is **in this work**: your words, at most 200 characters. Then details: traits, changes, relations |
| `miejsce` | where the work introduces or describes it: `[{"value": "@<work key>", "locator": "<place>"}]`, several places allowed. Leave it out only for a concept above works |
| `fragment` | the sentence (at most three) that shows the element best, copied exactly |
| `ogolnie` | the concept above works that this element refers to: `["@pojecie/<name>"]` |
| `nalezy` | the broader element this one is an aspect or part of |

### 3.3 How to build the structures

**An arguing text** (an article, a treatise, a sermon, a document):
- The root is the **leading question**, with rola `pytanie` and the place of the whole text.
- The author's answer goes under the question.
- Arguments go under the thesis they support, and sub-arguments under their argument.
- Objections go under what they attack, and each reply under its objection.
- The conclusion goes under the question.
- Only questions end with „?”. If an objection is phrased as a question in the text, state it as a claim.

**A Summa article.**
- The root is the article's question („Utrum …”) with place „I q. 2 a. 3”.
- Each objection („arg. n”) is a `zarzut` under the question, and „sed contra” is a `sedcontra` under the question.
- The body („co.”) is an `odpowiedz` under the question. The ways or reasons inside it are each an `argument` under
  the `odpowiedz`, with the place „… co.” and `nr` 1, 2, 3.
- Each reply („ad n”) is a `replika` under its objection.

**A narrative** (a novel, a story, a drama), with up to three parallel structures. The events are shared between
them, so give each event several parents in `nalezy`:
- **The composition** (how the work is written). The root is a `watek` „Budowa utworu” covering the whole work. Under
  it are the parts, each a `czesc` with a `streszczenie` in `tresc`. Under the parts are the events, each a
  `wydarzenie`.
- **The chronology** (how the story runs in time). The root is a `watek` „Chronologia”. Under it are the events, each
  with `czas`. Its entry point opens the view „Wywód — w czasie opowieści”.
- **The development of a character.** The root is a `watek` „Rozwój <imię>”. Under it are the stages, each an `etap`
  with `czas`, and under the stages the events where the change shows.
- Characters, places, objects and motifs are elements. The events name them in `elementy`.

**A descriptive or explaining text** (a textbook, a chapter of a handbook): the root is a `watek` or `pytanie` for the
subject. Under it go the `opis`, `rozroznienie` and `przyklad` steps. The concepts are elements.

**Parallel reconstructions** of one work are separate roots. Each has its own middle part in the names (§4).

### 3.4 Elements and concepts above works

- **Describe what the work fixes.** For concepts, that is the meaning this work gives a word. For characters, places
  and objects, it is who or what they are and how they change. A motif is something that recurs.
- **A concept above works** is an element with no `miejsce`, named `@pojecie/<name>` (aspects:
  `@pojecie/<name>/<aspect>` with `nalezy` to the concept). Elements of a work point at it with `ogolnie`. If the user
  says the concept already exists, only point at it and do not send it again. If you are not sure, send it: the review
  shows the user what would change.
- **Do not describe the same thing twice.** One element per thing per work. Several places go into one `miejsce` list.

### 3.5 Entry points

```
{"ref": "@<work key>/<reconstruction>/wejscie", "name": "<button text>", "work": "@<work key>", "locator": "<parts>",
 "entry": "@<work key>/<reconstruction>/<root>", "view": "@wywod/widok"}
```

- **`locator`** says which parts the button covers: empty for the whole work, one range, or several parts separated
  by „;” („s. 45–46; 58–60”). A part that starts lower than the one before stays in its frame: „I q. 2 a. 3; a. 4” is
  article 4 of the same question.
- **`entry`** is the root of the reconstruction the button opens: a step, never the work.
- **`view`** is one of:
  - `@wywod/widok`: the tree;
  - `@wywod/widok-tekst`: the order of the text, best for a Summa article;
  - `@wywod/widok-czas`: by the story's time, for a chronology.
- **Make at least one entry point per root.** Add one for a part that has its own reconstruction, and one for
  „beginning and end” when the user asks.

---

## 4. Names, places, fragments

**Names (`ref`)** are lasting.
- **The form:**
  - steps: `@<work key>/<reconstruction>/<step>`, e.g. `@kowalski2020/calosc/pytanie`, `@kowalski2020/wstep/arg1`,
    `@sth/i-2-3/ad1`, `@zielinska2019/chronologia/ucieczka`;
  - elements: `@<work key>/el/<name>`, e.g. `@zielinska2019/el/marta`;
  - concepts above works: `@pojecie/<name>`;
  - a comment: `@<work key>/komentarz/<name>`.
- **They hold in the whole base.**
  - Importing the same document again updates the same entries instead of doubling them.
  - For a second reconstruction of a work that already has one, ask the user which middle parts are taken and choose
    a new one (`calosc-2`). Over MCP you can see the existing steps, but not their names.
  - The import warns when your document reaches entries made by another document.
- **Refer to other entries by these names,** in `nalezy`, `elementy`, `ogolnie`, `entry`. Never use the bare work key
  as a name: `@kowalski2020` is the work in the Library.

**Places** are written in the work's scheme, in full:

| scheme | for | examples |
|---|---|---|
| pages | books and articles without their own numbering | `s. 47`, `s. 46–48`, `s. 45–47; 52; 58–60` |
| aquinas | Thomas Aquinas | `I q. 2 a. 3`, `I q. 2 a. 3 arg. 1`, `I q. 2 a. 3 sed contra`, `I q. 2 a. 3 co.`, `I q. 2 a. 3 ad 1` |
| outline | volume, part, book, chapter, section | `rozdz. 3`, `cz. 1, rozdz. 2`, `rozdz. 3, § 2` |
| bible | book, chapter, verse | `J 21,15-17` |
| numbered | numbered paragraphs (Church documents, the catechism) | `nr 24`, `nn. 24–26` |
| decimal, sections | Tractatus; Philosophical Investigations | `4.116`; `§ 43` |

Use printed page numbers, never PDF page numbers.

**Fragments** are copied exactly from the text, at most three sentences, with no quotation marks around them. Never
put more of the text into Cogita: the full text is in the Library.

---

## 5. Correcting entries (yours or the user's)

The user may ask you to correct what you made, or what they wrote themselves.

- **Send only what changes:** `{"ref": "<name or id>", "kinds": ["…"], "data": { …only the changed fields… }}`.
  - Fields you do not mention stay as they are.
  - `null` removes a field: `"nr": null`.
- **An entry with a lasting name** is referred to by it (`"@kowalski2020/calosc/arg1"`).
- **An entry the user wrote by hand** has no lasting name: use its id (a UUID; over MCP `get_entry` and
  `search_entries` show it), as `"ref": "@<uuid>"`.
- **Keep the `name`** of the document you correct.
- **The user decides on every change.** The review lists every changed field with its old and new value. A change is
  saved only when the user accepts it, and the user can edit your proposal before accepting.
- **A comment** (only when the user asks for your opinion) is a Komentarz with `about`, pointing at the steps or
  elements it discusses.

---

## 6. Checklist before you answer

**Step 1:**
- [ ] One document `"format": "recreatio/source-text"`, `"version": 1`, with `work` (key and fields), `entries`,
  `scheme`, `portions`.
- [ ] Text transcribed exactly; pages, notes, `loc`; nothing invented.
- [ ] After the JSON: the message from §2 with the sentence for step 2. Then stop.

**Step 2:**
- [ ] One document `"format": "recreatio.cogita.entities"`, `"version": 1`, a `name`, kinds by lasting name.
- [ ] Every entity and anchor has a lasting `ref` (§4).
- [ ] Every root (no `nalezy`) has rola `pytanie` or `watek`. Only questions end with „?”.
- [ ] Every other step has `nalezy` pointing at a step in this document or at an existing step.
- [ ] Every step the work says has a place in the work's scheme. Every step at one place of the text has an exact
  `fragment`.
- [ ] Theses are your own words, one sentence, at most 200 characters, and clearly different from each other.
- [ ] In a narrative: each event sits in every structure it belongs to (several `nalezy`), with `czas` in the
  chronology.
- [ ] Elements: one per thing per work, the first sentence of `opis` says what it is in this work, `ogolnie` for
  concepts above works.
- [ ] At least one anchor per root. The work is referred to by its key, never created here.
- [ ] No Komentarz unless the user asked for an opinion.
- [ ] Nothing invented. If you are unsure where the author says something, leave the step out and say so outside the
  JSON.

**A correction:** only the changed fields; `null` to remove; the same `name`.

---

## 7. Examples

### 7.1 A journal article: two parallel reconstructions, elements and a concept above works

The whole article (`calosc`) and, beside it, the argument of its introduction (`wstep`). There are two elements of the
article (agapao, phileo), both pointing at the concept „Miłość”. There are three entry points: the whole article, the
introduction, and the beginning with the end. The text of this article is the step-1 example in Appendix A.

```json
{
  "format": "recreatio.cogita.entities",
  "version": 1,
  "name": "Wywód: Kowalski, Miłość, która pyta (2020)",
  "entities": [
    {"ref": "@kowalski2020/calosc/pytanie", "kinds": ["@wywod/krok"], "data": {"rola": "pytanie", "miejsce": {"value": "@kowalski2020", "locator": "s. 45–60"},
      "tresc": [{"type": "paragraph", "text": "Czy trzykrotne pytanie Jezusa w J 21 jest przesłuchaniem Piotra?"}]}},
    {"ref": "@kowalski2020/calosc/odpowiedz", "kinds": ["@wywod/krok"], "data": {"rola": "odpowiedz", "nalezy": "@kowalski2020/calosc/pytanie", "miejsce": {"value": "@kowalski2020", "locator": "s. 46"},
      "tresc": [{"type": "paragraph", "text": "Nie: pytanie Jezusa uzdrawia pamięć Piotra, a nie go przesłuchuje."}],
      "fragment": "Nie jest przesłuchaniem, lecz uzdrowieniem pamięci."}},
    {"ref": "@kowalski2020/calosc/arg1", "kinds": ["@wywod/krok"], "data": {"rola": "argument", "nalezy": "@kowalski2020/calosc/odpowiedz", "miejsce": {"value": "@kowalski2020", "locator": "s. 47–49"},
      "tresc": [{"type": "paragraph", "text": "Trzy pytania odpowiadają trzem zaparciom Piotra."}, {"type": "paragraph", "text": "Autor zestawia ognisko z J 18,18 i J 21,9 jako znak tego samego miejsca w pamięci."}],
      "fragment": "Trzykrotne pytanie Jezusa odpowiada trzykrotnemu zaparciu się Piotra."}},
    {"ref": "@kowalski2020/calosc/arg1-1", "kinds": ["@wywod/krok"], "data": {"rola": "argument", "nalezy": "@kowalski2020/calosc/arg1", "miejsce": {"value": "@kowalski2020", "locator": "s. 48"},
      "tresc": [{"type": "paragraph", "text": "To samo ognisko w J 18,18 i J 21,9 wiąże obie sceny."}],
      "fragment": "Ognisko z dziedzińca arcykapłana wraca nad jeziorem."}},
    {"ref": "@kowalski2020/calosc/zarzut", "kinds": ["@wywod/krok"], "data": {"rola": "zarzut", "nalezy": "@kowalski2020/calosc/odpowiedz", "miejsce": {"value": "@kowalski2020", "locator": "s. 51"},
      "tresc": [{"type": "paragraph", "text": "Różnica między agapao i phileo bywa uważana za wariację stylu."}],
      "fragment": "W dwóch pierwszych pytaniach pada czasownik agapao, w trzecim — phileo.",
      "elementy": ["@kowalski2020/el/agapao", "@kowalski2020/el/phileo"]}},
    {"ref": "@kowalski2020/calosc/replika", "kinds": ["@wywod/krok"], "data": {"rola": "replika", "nalezy": "@kowalski2020/calosc/zarzut", "miejsce": {"value": "@kowalski2020", "locator": "s. 52"},
      "tresc": [{"type": "paragraph", "text": "Jan waży słowa; por. J 15,13, gdzie ta sama różnica niesie treść."}],
      "fragment": "Jan nie zmienia słów bez powodu."}},
    {"ref": "@kowalski2020/calosc/wniosek", "kinds": ["@wywod/krok"], "data": {"rola": "wniosek", "nalezy": "@kowalski2020/calosc/pytanie", "miejsce": {"value": "@kowalski2020", "locator": "s. 58"},
      "tresc": [{"type": "paragraph", "text": "Pytanie Jezusa przywraca Piotrowi misję pasterza."}],
      "fragment": "Kto został zapytany o miłość, zostaje posłany, by paść."}},
    {"ref": "@kowalski2020/wstep/pytanie", "kinds": ["@wywod/krok"], "data": {"rola": "pytanie", "miejsce": {"value": "@kowalski2020", "locator": "s. 45–46"},
      "tresc": [{"type": "paragraph", "text": "Dlaczego rozmowę nad jeziorem trzeba odczytać na nowo?"}]}},
    {"ref": "@kowalski2020/wstep/arg1", "kinds": ["@wywod/krok"], "data": {"rola": "argument", "nalezy": "@kowalski2020/wstep/pytanie", "miejsce": {"value": "@kowalski2020", "locator": "s. 45"},
      "tresc": [{"type": "paragraph", "text": "Dotychczasowe komentarze czytają tę scenę jako sąd nad Piotrem."}],
      "fragment": "Komentatorzy widzą tu zwykle sąd nad apostołem."}},
    {"ref": "@kowalski2020/wstep/arg2", "kinds": ["@wywod/krok"], "data": {"rola": "argument", "nalezy": "@kowalski2020/wstep/pytanie", "miejsce": {"value": "@kowalski2020", "locator": "s. 46"},
      "tresc": [{"type": "paragraph", "text": "Taki odczyt pomija, że rozmowa kończy się powierzeniem misji."}],
      "fragment": "Rozmowa nie kończy się wyrokiem, lecz posłaniem."}},
    {"ref": "@pojecie/milosc", "kinds": ["@wywod/element"], "data": {"nazwa": "Miłość", "czym": "pojecie",
      "opis": [{"type": "paragraph", "text": "Miłość to chcenie dobra drugiego dla niego samego."}]}},
    {"ref": "@kowalski2020/el/agapao", "kinds": ["@wywod/element"], "data": {"nazwa": "agapao", "czym": "pojecie", "miejsce": [{"value": "@kowalski2020", "locator": "s. 51–52"}],
      "opis": [{"type": "paragraph", "text": "W artykule agapao to miłość, która daje siebie bez warunku."}],
      "ogolnie": ["@pojecie/milosc"]}},
    {"ref": "@kowalski2020/el/phileo", "kinds": ["@wywod/element"], "data": {"nazwa": "phileo", "czym": "pojecie", "miejsce": [{"value": "@kowalski2020", "locator": "s. 51–52"}],
      "opis": [{"type": "paragraph", "text": "W artykule phileo to miłość przyjaźni, na jaką Piotra stać po zaparciu."}],
      "ogolnie": ["@pojecie/milosc"]}}
  ],
  "anchors": [
    {"ref": "@kowalski2020/calosc/wejscie", "name": "Wywód całego artykułu", "work": "@kowalski2020", "locator": "s. 45–60", "entry": "@kowalski2020/calosc/pytanie", "view": "@wywod/widok"},
    {"ref": "@kowalski2020/wstep/wejscie", "name": "Wstęp: skąd to pytanie", "work": "@kowalski2020", "locator": "s. 45–46", "entry": "@kowalski2020/wstep/pytanie", "view": "@wywod/widok"},
    {"ref": "@kowalski2020/calosc/wejscie-teza-wniosek", "name": "Teza i wniosek", "work": "@kowalski2020", "locator": "s. 45–46; 58–60", "entry": "@kowalski2020/calosc/pytanie", "view": "@wywod/widok-tekst"}
  ]
}
```

### 7.2 An article of the Summa theologiae

```json
{
  "format": "recreatio.cogita.entities",
  "version": 1,
  "name": "Wywód: STh I q. 2 a. 3",
  "entities": [
    {"ref": "@sth/i-2-3/pytanie", "kinds": ["@wywod/krok"], "data": {"rola": "pytanie", "miejsce": {"value": "@sth", "locator": "I q. 2 a. 3"},
      "tresc": [{"type": "paragraph", "text": "Czy Bóg istnieje?"}]}},
    {"ref": "@sth/i-2-3/arg1", "kinds": ["@wywod/krok"], "data": {"rola": "zarzut", "nalezy": "@sth/i-2-3/pytanie", "miejsce": {"value": "@sth", "locator": "I q. 2 a. 3 arg. 1"},
      "tresc": [{"type": "paragraph", "text": "Wydaje się, że Boga nie ma, bo istnieje zło."}],
      "fragment": "Ad tertium sic proceditur. Videtur quod Deus non sit."}},
    {"ref": "@sth/i-2-3/arg2", "kinds": ["@wywod/krok"], "data": {"rola": "zarzut", "nalezy": "@sth/i-2-3/pytanie", "miejsce": {"value": "@sth", "locator": "I q. 2 a. 3 arg. 2"},
      "tresc": [{"type": "paragraph", "text": "Wydaje się, że świat tłumaczy się bez Boga przez naturę i rozum."}],
      "fragment": "Praeterea, quod potest compleri per pauciora principia, non fit per plura."}},
    {"ref": "@sth/i-2-3/sc", "kinds": ["@wywod/krok"], "data": {"rola": "sedcontra", "nalezy": "@sth/i-2-3/pytanie", "miejsce": {"value": "@sth", "locator": "I q. 2 a. 3 sed contra"},
      "tresc": [{"type": "paragraph", "text": "Bóg mówi o sobie: „Jestem, który jestem”."}],
      "fragment": "Sed contra est quod dicitur Exodi III, ex persona Dei, ego sum qui sum."}},
    {"ref": "@sth/i-2-3/co", "kinds": ["@wywod/krok"], "data": {"rola": "odpowiedz", "nalezy": "@sth/i-2-3/pytanie", "miejsce": {"value": "@sth", "locator": "I q. 2 a. 3 co."},
      "tresc": [{"type": "paragraph", "text": "Istnienie Boga można wykazać na pięć dróg."}],
      "fragment": "Respondeo dicendum quod Deum esse quinque viis probari potest."}},
    {"ref": "@sth/i-2-3/droga1", "kinds": ["@wywod/krok"], "data": {"rola": "argument", "nalezy": "@sth/i-2-3/co", "nr": 1, "miejsce": {"value": "@sth", "locator": "I q. 2 a. 3 co."},
      "tresc": [{"type": "paragraph", "text": "Droga pierwsza wychodzi od ruchu: to, co się porusza, jest poruszane przez coś innego."}],
      "fragment": "Prima autem et manifestior via est, quae sumitur ex parte motus."}},
    {"ref": "@sth/i-2-3/droga2", "kinds": ["@wywod/krok"], "data": {"rola": "argument", "nalezy": "@sth/i-2-3/co", "nr": 2, "miejsce": {"value": "@sth", "locator": "I q. 2 a. 3 co."},
      "tresc": [{"type": "paragraph", "text": "Droga druga wychodzi od przyczyny sprawczej, której łańcuch nie może iść w nieskończoność."}],
      "fragment": "Secunda via est ex ratione causae efficientis."}},
    {"ref": "@sth/i-2-3/ad1", "kinds": ["@wywod/krok"], "data": {"rola": "replika", "nalezy": "@sth/i-2-3/arg1", "miejsce": {"value": "@sth", "locator": "I q. 2 a. 3 ad 1"},
      "tresc": [{"type": "paragraph", "text": "Bóg dopuszcza zło, aby wyprowadzić z niego dobro."}],
      "fragment": "Ad primum ergo dicendum quod, sicut Augustinus dicit in Enchiridio…"}},
    {"ref": "@sth/i-2-3/ad2", "kinds": ["@wywod/krok"], "data": {"rola": "replika", "nalezy": "@sth/i-2-3/arg2", "miejsce": {"value": "@sth", "locator": "I q. 2 a. 3 ad 2"},
      "tresc": [{"type": "paragraph", "text": "Natura i rozum działają ze względu na cel, który wyznacza Bóg."}],
      "fragment": "Ad secundum dicendum quod, cum natura propter determinatum finem operetur ex directione alicuius superioris agentis, necesse est quod ea quae a natura fiunt, etiam in Deum reducantur, sicut in primam causam."}}
  ],
  "anchors": [
    {"ref": "@sth/i-2-3/wejscie", "name": "Czy Bóg istnieje? (I q. 2 a. 3)", "work": "@sth", "locator": "I q. 2 a. 3", "entry": "@sth/i-2-3/pytanie", "view": "@wywod/widok-tekst"}
  ]
}
```

### 7.3 A novel: composition, chronology and a character's development

A short novel, „Dom pod lipami” (key `zielinska2019`, places written by chapter). The same events stand in three
structures. In the chronology, the planting of the lindens comes first: it is told in chapter 5, in the letters, but
it happened decades before the story begins.

```json
{
  "format": "recreatio.cogita.entities",
  "version": 1,
  "name": "Struktura: Zielińska, Dom pod lipami (2019)",
  "entities": [
    {"ref": "@zielinska2019/budowa/watek", "kinds": ["@wywod/krok"], "data": {"rola": "watek", "miejsce": {"value": "@zielinska2019", "locator": "rozdz. 1–6"},
      "tresc": [{"type": "paragraph", "text": "Powieść ma dwie części: powrót Marty i listy dziadka."}]}},
    {"ref": "@zielinska2019/budowa/cz1", "kinds": ["@wywod/krok"], "data": {"rola": "czesc", "nalezy": "@zielinska2019/budowa/watek", "miejsce": {"value": "@zielinska2019", "locator": "rozdz. 1–3"},
      "tresc": [{"type": "paragraph", "text": "Część pierwsza: Marta wraca do domu dziadka i odkrywa jego listy."}]}},
    {"ref": "@zielinska2019/budowa/cz2", "kinds": ["@wywod/krok"], "data": {"rola": "czesc", "nalezy": "@zielinska2019/budowa/watek", "miejsce": {"value": "@zielinska2019", "locator": "rozdz. 4–6"},
      "tresc": [{"type": "paragraph", "text": "Część druga: listy opowiadają przeszłość, a Marta postanawia zostać."}]}},
    {"ref": "@zielinska2019/chronologia/watek", "kinds": ["@wywod/krok"], "data": {"rola": "watek", "miejsce": {"value": "@zielinska2019", "locator": "rozdz. 1–6"},
      "tresc": [{"type": "paragraph", "text": "Historia trwa od posadzenia lip po decyzję Marty."}]}},
    {"ref": "@zielinska2019/rozwoj/watek", "kinds": ["@wywod/krok"], "data": {"rola": "watek", "miejsce": {"value": "@zielinska2019", "locator": "rozdz. 1–6"},
      "tresc": [{"type": "paragraph", "text": "Marta przechodzi od ucieczki przed przeszłością do jej przyjęcia."}], "elementy": ["@zielinska2019/el/marta"]}},
    {"ref": "@zielinska2019/rozwoj/etap1", "kinds": ["@wywod/krok"], "data": {"rola": "etap", "nalezy": "@zielinska2019/rozwoj/watek", "czas": 3, "miejsce": {"value": "@zielinska2019", "locator": "rozdz. 1–2"},
      "tresc": [{"type": "paragraph", "text": "Na początku Marta chce tylko sprzedać dom i wyjechać."}]}},
    {"ref": "@zielinska2019/rozwoj/etap2", "kinds": ["@wywod/krok"], "data": {"rola": "etap", "nalezy": "@zielinska2019/rozwoj/watek", "czas": 5, "miejsce": {"value": "@zielinska2019", "locator": "rozdz. 5–6"},
      "tresc": [{"type": "paragraph", "text": "Po lekturze listów Marta przyjmuje pamięć rodziny jako swoją."}]}},
    {"ref": "@zielinska2019/chronologia/lipy", "kinds": ["@wywod/krok"], "data": {"rola": "wydarzenie", "czas": 1, "miejsce": {"value": "@zielinska2019", "locator": "rozdz. 5"},
      "nalezy": ["@zielinska2019/budowa/cz2", "@zielinska2019/chronologia/watek"],
      "tresc": [{"type": "paragraph", "text": "Po wojnie dziadek Józef sadzi przed domem dwie lipy."}],
      "fragment": "Posadziłem je w kwietniu, żeby ktoś po nas wiedział, gdzie jest dom.",
      "elementy": ["@zielinska2019/el/jozef", "@zielinska2019/el/lipy"]}},
    {"ref": "@zielinska2019/chronologia/wakacje", "kinds": ["@wywod/krok"], "data": {"rola": "wydarzenie", "czas": 2, "miejsce": {"value": "@zielinska2019", "locator": "rozdz. 1"},
      "nalezy": ["@zielinska2019/budowa/cz1", "@zielinska2019/chronologia/watek"],
      "tresc": [{"type": "paragraph", "text": "Jako dziecko Marta spędza w domu dziadka wakacje."}],
      "fragment": "Pamiętała tylko zapach lip i to, że dziadek nigdy nie mówił o wojnie.",
      "elementy": ["@zielinska2019/el/marta", "@zielinska2019/el/jozef"]}},
    {"ref": "@zielinska2019/chronologia/powrot", "kinds": ["@wywod/krok"], "data": {"rola": "wydarzenie", "czas": 3, "miejsce": {"value": "@zielinska2019", "locator": "rozdz. 1"},
      "nalezy": ["@zielinska2019/budowa/cz1", "@zielinska2019/chronologia/watek", "@zielinska2019/rozwoj/etap1"],
      "tresc": [{"type": "paragraph", "text": "Po śmierci dziadka Marta wraca, by sprzedać dom."}],
      "fragment": "Przyjechała na dwa dni, z umową sprzedaży w torebce.",
      "elementy": ["@zielinska2019/el/marta", "@zielinska2019/el/dom"]}},
    {"ref": "@zielinska2019/chronologia/listy", "kinds": ["@wywod/krok"], "data": {"rola": "wydarzenie", "czas": 4, "miejsce": {"value": "@zielinska2019", "locator": "rozdz. 2"},
      "nalezy": ["@zielinska2019/budowa/cz1", "@zielinska2019/chronologia/watek", "@zielinska2019/rozwoj/etap1"],
      "tresc": [{"type": "paragraph", "text": "Na strychu Marta znajduje listy dziadka do jej babki."}],
      "fragment": "Listy leżały w puszce po herbacie, przewiązane szpagatem.",
      "elementy": ["@zielinska2019/el/marta"]}},
    {"ref": "@zielinska2019/chronologia/decyzja", "kinds": ["@wywod/krok"], "data": {"rola": "wydarzenie", "czas": 5, "miejsce": {"value": "@zielinska2019", "locator": "rozdz. 6"},
      "nalezy": ["@zielinska2019/budowa/cz2", "@zielinska2019/chronologia/watek", "@zielinska2019/rozwoj/etap2"],
      "tresc": [{"type": "paragraph", "text": "Marta zrywa umowę sprzedaży i zostaje w domu."}],
      "fragment": "Podarła umowę i pierwszy raz od lat otworzyła okno na lipy.",
      "elementy": ["@zielinska2019/el/marta", "@zielinska2019/el/dom", "@zielinska2019/el/lipy"]}},
    {"ref": "@zielinska2019/el/marta", "kinds": ["@wywod/element"], "data": {"nazwa": "Marta", "czym": "postac", "miejsce": [{"value": "@zielinska2019", "locator": "rozdz. 1"}],
      "opis": [{"type": "paragraph", "text": "Marta to wnuczka Józefa, która ucieka od przeszłości, a potem ją przyjmuje."}]}},
    {"ref": "@zielinska2019/el/jozef", "kinds": ["@wywod/element"], "data": {"nazwa": "Józef", "czym": "postac", "miejsce": [{"value": "@zielinska2019", "locator": "rozdz. 5"}],
      "opis": [{"type": "paragraph", "text": "Józef to dziadek Marty, który przeżył wojnę i milczał o niej aż do listów."}]}},
    {"ref": "@zielinska2019/el/dom", "kinds": ["@wywod/element"], "data": {"nazwa": "dom pod lipami", "czym": "miejsce", "miejsce": [{"value": "@zielinska2019", "locator": "rozdz. 1"}],
      "opis": [{"type": "paragraph", "text": "Dom pod lipami to miejsce, w którym rodzina przechowuje swoją pamięć."}]}},
    {"ref": "@zielinska2019/el/lipy", "kinds": ["@wywod/element"], "data": {"nazwa": "lipy", "czym": "motyw", "miejsce": [{"value": "@zielinska2019", "locator": "rozdz. 5"}, {"value": "@zielinska2019", "locator": "rozdz. 6"}],
      "opis": [{"type": "paragraph", "text": "Lipy są w powieści znakiem pamięci, która przetrwała wojnę."}]}}
  ],
  "anchors": [
    {"ref": "@zielinska2019/budowa/wejscie", "name": "Budowa powieści", "work": "@zielinska2019", "locator": "", "entry": "@zielinska2019/budowa/watek", "view": "@wywod/widok"},
    {"ref": "@zielinska2019/chronologia/wejscie", "name": "Chronologia historii", "work": "@zielinska2019", "locator": "", "entry": "@zielinska2019/chronologia/watek", "view": "@wywod/widok-czas"},
    {"ref": "@zielinska2019/rozwoj/wejscie", "name": "Jak zmienia się Marta", "work": "@zielinska2019", "locator": "rozdz. 1–2; 5–6", "entry": "@zielinska2019/rozwoj/watek", "view": "@wywod/widok-czas"}
  ]
}
```

### 7.4 A correction: a sharper thesis, a removed fragment, and a comment the user asked for

The same `name` as 7.1. Only the changed fields are sent; `null` removes the fragment. The comment is the user's
request for an assessment, so it is a Komentarz.

```json
{
  "format": "recreatio.cogita.entities",
  "version": 1,
  "name": "Wywód: Kowalski, Miłość, która pyta (2020)",
  "entities": [
    {"ref": "@kowalski2020/calosc/arg1", "kinds": ["@wywod/krok"], "data": {
      "tresc": [{"type": "paragraph", "text": "Każde z trzech pytań Jezusa odpowiada jednemu zaparciu Piotra."}]}},
    {"ref": "@kowalski2020/calosc/arg1-1", "kinds": ["@wywod/krok"], "data": {"fragment": null}},
    {"ref": "@kowalski2020/komentarz/agapao-phileo", "kinds": ["@komentarz/rodzaj"], "data": {
      "about": [{"value": "@kowalski2020/el/agapao"}, {"value": "@kowalski2020/el/phileo"}],
      "content": [{"type": "paragraph", "text": "Rozróżnienie agapao i phileo niesie tu więcej, niż autor przyznaje."}, {"type": "paragraph", "text": "W J 15,13 ta sama para słów opisuje dar życia."}]}}
  ]
}
```

---

## Appendix A — the text format of step 1 (generated by the app)

This is the description the Library itself shows next to the import „Dzieło z tekstem (JSON)”. Its last example is
the text of the article from 7.1.

<!-- app:work-with-text:start -->
```text
# Dzieło z pełnym tekstem jako JSON ("recreatio/source-text", wersja 1)

Jeden dokument tworzy w Bibliotece wpis dzieła (książki, artykułu, rozdziału, dokumentu…), wpisy, na które ono wskazuje (autorzy, czasopismo, książka zbiorowa), i jego pełny tekst. Dzieło o kluczu, który już jest w bibliotece, zostaje uzupełnione (podane pola), nie zdublowane; tak samo autor albo czasopismo o istniejącym kluczu.

{
  "format": "recreatio/source-text",
  "version": 1,
  "work": { "key": "nazwisko2020", "data": { … pola dzieła … } },   — albo "@klucz" dzieła, które już jest
  "entries": [ { "kind": "person", "key": "…", "data": { … } }, { "kind": "work", "key": "…", "data": { "workType": "periodical", … } } ],
  "scheme": "pages",          — jak wskazuje się miejsca w tym dziele (niżej)
  "edition": { … },           — opcjonalnie: przesunięcie stron PDF, język
  "portions": [ { "portion": { "key", "label", "order" }, "blocks": [ … ] }, … ]
}

- Odwołania w polach dzieła ("authors", "editors", "translators", "container") to klucze z "@": do wpisów z "entries" albo do takich, które już są w bibliotece.
- Opis dzieła bierz ze strony tytułowej, metryczki albo nagłówka artykułu; czego tam nie ma, nie wpisuj.

## Pola dzieła i osoby
### "work" — Źródło
Dzieło, z którego się korzysta: książka, rozdział, artykuł, dokument Kościoła, Pismo Święte, strona — albo muzyka: utwór, nuty, nagranie, płyta. Ma klucz cytowania.
"data":
  "workType" — Rodzaj: Rodzaj: "book" (Książka), "chapter" (Rozdział w książce), "article" (Artykuł w czasopiśmie), "periodical" (Czasopismo), "document" (Dokument (Kościoła, urzędowy)), "bible" (Pismo Święte), "web" (Strona internetowa), "talk" (Wykład, kazanie, nagranie), "other" (Inne); muzyka: "piece" (Utwór muzyczny — sam utwór: kompozytor, słowa, tonacja, obsada), "score" (Nuty — wydanie nut, z plikami: partytura, głosy, zapis nutowy), "recording" (Nagranie — wykonanie: jeden plik albo kilka ścieżek (głosy i instrumenty, odtwarzane razem)), "album" (Płyta, album — zbiór nagrań). Rodzaj decyduje, które pola dzieło ma (jedna z wartości)
  "title" — Tytuł: Tytuł dzieła (utworu, nagrania, płyty) (tekst)
  "subtitle" — Podtytuł: Podtytuł (albo rodzaj dokumentu, np. "adhortacja apostolska") (tekst)
  "originalTitle" — Tytuł oryginału: Tytuł oryginału (oryginalny tytuł przekładu; przy utworze — tytuł w języku oryginału) (tekst)
  "authors" — Autorzy: Autorzy — odwołania do osób, w kolejności (przy muzyce: kompozytor, autor słów — pola niżej) (lista odwołań: kennungi albo "@klucze")
  "editors" — Redakcja: Redaktorzy — odwołania do osób (lista odwołań: kennungi albo "@klucze")
  "translators" — Tłumaczenie: Tłumacze — odwołania do osób (przy utworze: przekład słów) (lista odwołań: kennungi albo "@klucze")
  "container" — W (książka, czasopismo): Dla rozdziału: książka; dla artykułu: czasopismo — odwołanie do źródła (odwołanie: kennung albo "@klucz")
  "volume" — Tom / rocznik: Tom (książka, zbiór nut) albo rocznik (czasopismo) (tekst)
  "issue" — Numer: Numer czasopisma (tekst)
  "edition" — Wydanie: Które wydanie (tekst)
  "genre" — Gatunek: Jaki to utwór albo jaka to książka (powieść, powieść biograficzna, biografia, reportaż, mszał, modlitewnik, podręcznik…) (tekst)
  "publisher" — Wydawca: Wydawnictwo (przy nagraniu i płycie: wytwórnia) (tekst)
  "place" — Miejsce wydania: Miejsce wydania (tekst)
  "year" — Rok: Rok wydania (albo data dokumentu; przy utworze — rok powstania, przy nagraniu — rok nagrania) (tekst)
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
  "language" — Język: Język (np. "pl", "la"; przy muzyce — język słów) (tekst)
  "scheme" — Układ miejsc: Jak wskazuje się miejsca w tym dziele: "pages" (Strony wydania), "bible" (Pismo Święte), "numbered" (Numery (dokumenty)), "aquinas" (Tomasz z Akwinu), "decimal" (Numeracja dziesiętna), "sections" (Paragrafy dzieła), "outline" (Podział dzieła); puste — z rodzaju (Pismo Święte: bible, dokument: numbered, nagranie: time — minuty i sekundy, inne: pages) (jedna z wartości)
  "pageSeries" — Serie stron: Gdy książka numeruje swoje części osobno (wstęp, dodatki, wkładki): po jednej przykładowej stronie z każdej serii, tak jak jest wydrukowana, w kolejności książki, oddzielone spacją — np. "xii 12* 1 3' (1) A1" (rzymskie, z gwiazdką, zwykłe, z apostrofem, w nawiasie, z literą; znaki mogą być dowolne). Strona "12*" i strona "12" to dwie różne strony. Puste — rzymskie, potem zwykłe, potem pozostałe (tekst)
  "psalms" — Numeracja psalmów: Dla Pisma Świętego: "hebrew" (hebrajska — Biblia Tysiąclecia, większość przekładów) albo "greek" (grecka — Septuaginta, Wulgata) (jedna z wartości)
  "editionOf" — Wydanie / przekład dzieła: To jest inne wydanie albo przekład tego dzieła — odwołanie do źródła. Miejsca w strukturze (werset, numer, paragraf) są wspólne dla wszystkich wydań; strony nie. (odwołanie: kennung albo "@klucz")
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

## Tekst

Tekst dzieła składa się z CZĘŚCI (np. księga Biblii, rozdział książki, cały krótki dokument albo artykuł). Dokument JSON zawiera jedną część ("portion" + "blocks") albo kilka naraz ("portions": [ … ] — także cały tekst). Część z tym samym "portion.key" zastępuje poprzednią, inne zostają — więc długie dzieło można przysyłać w kilku dokumentach po kolei, a powtórzony dokument niczego nie zdubluje.

{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@klucz-dzieła",          — klucz (albo identyfikator) wpisu dzieła w Bibliotece; tekst należy do TEGO wydania/przekładu
  "scheme": "pages",                — układ miejsc dzieła (niżej); musi zgadzać się z dziełem
  "edition": {                       — opcjonalnie
    "pdfPageOffset": 12,            — strona drukowana = strona PDF − 12 (gdy stały)
    "language": "pl",
    "psalms": "hebrew" | "greek"    — tylko Pismo Święte: numeracja psalmów (BT: hebrew; Wulgata: greek)
  },
  "portion": { "key": "rozdz-1", "label": "Rozdział 1", "order": 1 },
  "blocks": [ … ]                    — bloki w kolejności oryginału
}

Albo kilka części (np. cały tekst) w jednym dokumencie — zamiast "portion" i "blocks":
  "portions": [
    { "portion": { "key": "wstep", "label": "Wstęp", "order": 1 }, "blocks": [ … ] },
    { "portion": { "key": "rozdz-1", "label": "Rozdział 1", "order": 2 }, "blocks": [ … ] }
  ]

## Bloki
  {"type": "heading", "level": 1-4, "text": "…", "loc": "…"}    nagłówek
  {"type": "paragraph", "text": "…", "loc": "…"}               akapit (także werset, punkt dokumentu, twierdzenie)
  {"type": "quote", "text": "…", "loc": "…"}                   cytat blokowy w źródle
  {"type": "list", "items": ["…", "…"], "ordered": true, "loc": "…"}
  {"type": "table", "columns": ["…"], "rows": [["…", "…"]], "loc": "…"}
  {"type": "note", "id": "1", "text": "…"}                     przypis (tekst przypisu); w tekście odwołanie {{note 1}}
  {"type": "page", "page": "46", "pdf": 52}                   tu zaczyna się strona 46 (drukowana) = strona 52 pliku PDF;
                                                              strona tak, jak jest wydrukowana — także ze znakami serii: "12*", "3'", "(7)", "A12", "xii"
  "uncertain": true                                           przy dowolnym bloku: odczyt niepewny

## Znaki w tekście
  {{page 46}}  albo  {{page 46 pdf 52}}    granica strony w środku akapitu (dokładnie tam, gdzie wypada)
  {{note 3}}                               odwołanie do przypisu "3"
  {{? słowo}}                              niepewny odczyt tego słowa;  {{?}} — nieczytelne
  {{gap}}                                  pominięty / brakujący fragment
Wszystko inne jest zwykłym tekstem. Zachowaj dokładne brzmienie, kolejność, akapity i interpunkcję oryginału. Nie poprawiaj, nie streszczaj, nie tłumacz.

## "loc" — miejsce w strukturze dzieła
Podawaj "loc" przy każdym bloku, który ma własny numer w strukturze dzieła (werset, punkt, artykuł, twierdzenie, paragraf, rozdział). Bloki bez własnego numeru (np. akapit w środku rozdziału) nie mają "loc" — należą do miejsca podanego wcześniej. Strony NIE wpisuje się do "loc": strony to bloki "page" i znaki {{page …}}, bo należą do tego jednego wydania.
- "pages" — Strony wydania: Tylko strony tej konkretnej edycji (książki, artykuły bez własnej numeracji). Gdy książka numeruje swoje części osobno (wstęp „xii” albo „12*”, dodatek „3'”, wkładki „(7)”, „A12”), strona niesie znaki swojej serii tak, jak są wydrukowane — dowolne — a dzieło w polu „Serie stron” mówi, w jakiej kolejności serie stoją w książce. Przykłady: s. 23 · s. 23–25 · s. 23, 27 · s. xii · s. 12* · s. 45'–47' · s. (7) · s. A12
- "bible" — Pismo Święte: Księga, rozdział, werset — wspólne dla wszystkich przekładów (numeracja psalmów: hebrajska, grecka w nawiasie). Przykłady: J 21,15-17 · Ps 51(50),3 · Łk 1,26–2,5 · Mt 5,3-12; 6,1
- "numbered" — Numery (dokumenty): Numerowane punkty dokumentów Kościoła, katechizmu, kodeksów; paragraf w numerze po „§". Przykłady: nr 24 · nn. 24–26 · KKK 1234 · kan. 915 § 1
- "aquinas" — Tomasz z Akwinu: Część, kwestia, artykuł; zarzut (arg.), sed contra, odpowiedź (co.), odpowiedź na zarzut (ad). Przykłady: I, q. 2, a. 3 · I-II, q. 90, a. 1, ad 2 · II-II q. 23 a. 1 arg. 1 · III q. 75 a. 1 co.
- "decimal" — Numeracja dziesiętna: Twierdzenia numerowane dziesiętnie, jak w Traktacie logiczno-filozoficznym: każda cyfra po kropce to poziom niżej. Przykłady: 2.0121 · 4.1–4.116 · TLP 6.54
- "sections" — Paragrafy dzieła: Paragrafy (uwagi) numerowane w całym dziele, z częściami, jak w Dociekaniach filozoficznych. Przykłady: § 43 · §§ 1–5 · cz. II, xi
- "outline" — Podział dzieła: Tom, część, księga, rozdział, paragraf, akapit — tyle poziomów, ile ma dzieło. Przykłady: t. 2, cz. 1, rozdz. 3 · ks. II, rozdz. 4, § 2 · rozdz. 3, ak. 5

## Zasady
- Nie wymyślaj tekstu ani numerów: czego nie widać w źródle, tego nie ma w JSON. Niepewne oznacz {{? …}} albo "uncertain": true.
- Numery stron: drukowane, tak jak w książce (także rzymskie: "xii"); numer strony pliku PDF w "pdf", jeśli się różni.
- Przypisy dolne i końcowe: blok "note" (po akapicie albo na końcu części) i {{note …}} w miejscu odsyłacza.
- Jedna część — najwyżej ok. 2 mln znaków.

## Cały tekst
- Podziel tekst według jego własnego podziału: księgi Biblii (klucz: skrót księgi, np. "J"), rozdziały książki ("rozdz-1", "rozdz-2"), kwestie Sumy ("I-q2"), rozdziały dokumentu; krótki artykuł albo dokument może być jedną częścią.
- Klucze krótkie i stałe; "order" — kolejność w dziele (1, 2, 3…). Wstęp, przedmowa, spis treści, bibliografia, indeks — osobne części tylko wtedy, gdy są w źródle.
- Przypisy końcowe (na końcu książki albo rozdziału) wpisz w tej części, do której odsyłają.
- Gdy tekst nie mieści się w jednej odpowiedzi: przepisz kolejne części w kolejnych dokumentach (z tym samym "work", "scheme" i "edition"), zaczynając dokładnie tam, gdzie skończyłeś. Nigdy nie przerywaj części w połowie — dokończ ją albo zacznij od niej następny dokument (ta sama część drugi raz zastąpi poprzednią).
Zwróć JEDEN obiekt JSON, bez komentarzy.

## Przykłady
### Strony wydania ("pages")
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@ratzinger2007",
  "scheme": "pages",
  "edition": {
    "pdfPageOffset": 12,
    "language": "pl"
  },
  "portion": {
    "key": "rozdz-1",
    "label": "Rozdział 1. Chrzest Jezusa",
    "order": 1
  },
  "blocks": [
    {
      "type": "page",
      "page": "33",
      "pdf": 45
    },
    {
      "type": "heading",
      "level": 1,
      "loc": "rozdz. 1",
      "text": "Rozdział pierwszy. Chrzest Jezusa"
    },
    {
      "type": "paragraph",
      "text": "Pierwsze zdanie akapitu na stronie 33, który przechodzi na następną {{page 34 pdf 46}} stronę i ma przypis.{{note 1}}"
    },
    {
      "type": "paragraph",
      "text": "Kolejny akapit, w którym jedno słowo jest {{? nieczytelne}}, a fragment pominięto {{gap}}.",
      "uncertain": true
    },
    {
      "type": "note",
      "id": "1",
      "text": "Por. J. Jeremias, Teologia Nowego Testamentu, s. 45."
    }
  ]
}

### Pismo Święte ("bible")
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@bt",
  "scheme": "bible",
  "edition": {
    "language": "pl",
    "psalms": "hebrew"
  },
  "portion": {
    "key": "J",
    "label": "Ewangelia według św. Jana",
    "order": 43
  },
  "blocks": [
    {
      "type": "heading",
      "level": 1,
      "loc": "J 21",
      "text": "Rozdział 21"
    },
    {
      "type": "heading",
      "level": 2,
      "text": "Jezus ukazuje się nad Jeziorem Tyberiadzkim"
    },
    {
      "type": "paragraph",
      "loc": "J 21,15",
      "text": "A gdy spożyli śniadanie, rzekł Jezus do Szymona Piotra: «Szymonie, synu Jana, czy miłujesz Mnie więcej aniżeli ci?»"
    },
    {
      "type": "paragraph",
      "loc": "J 21,16",
      "text": "I drugi raz powiedział do niego: «Szymonie, synu Jana, czy miłujesz Mnie?»"
    }
  ]
}

### Numery (dokumenty) ("numbered")
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@dei-verbum",
  "scheme": "numbered",
  "edition": {
    "language": "pl"
  },
  "portion": {
    "key": "rozdz-2",
    "label": "Rozdział II. Przekazywanie Objawienia Bożego",
    "order": 2
  },
  "blocks": [
    {
      "type": "heading",
      "level": 1,
      "text": "Rozdział II. Przekazywanie Objawienia Bożego"
    },
    {
      "type": "paragraph",
      "loc": "nr 7",
      "text": "Bóg w swej łaskawości postanowił, aby to, co dla zbawienia wszystkich narodów objawił, trwało na zawsze nienaruszone."
    },
    {
      "type": "paragraph",
      "loc": "nr 8",
      "text": "Przeto przepowiadanie apostolskie, które w szczególniejszy sposób wyrażone jest w księgach natchnionych…"
    }
  ]
}

### Tomasz z Akwinu ("aquinas")
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@sth",
  "scheme": "aquinas",
  "edition": {
    "language": "la"
  },
  "portion": {
    "key": "I-q2",
    "label": "I, q. 2. De Deo, an Deus sit",
    "order": 2
  },
  "blocks": [
    {
      "type": "heading",
      "level": 1,
      "loc": "I, q. 2",
      "text": "Quaestio 2. De Deo, an Deus sit"
    },
    {
      "type": "heading",
      "level": 2,
      "loc": "I, q. 2, a. 3",
      "text": "Articulus 3. Utrum Deus sit"
    },
    {
      "type": "paragraph",
      "loc": "I, q. 2, a. 3, arg. 1",
      "text": "Ad tertium sic proceditur. Videtur quod Deus non sit."
    },
    {
      "type": "paragraph",
      "loc": "I, q. 2, a. 3, sed contra",
      "text": "Sed contra est quod dicitur Exodi III, ex persona Dei, ego sum qui sum."
    },
    {
      "type": "paragraph",
      "loc": "I, q. 2, a. 3, co.",
      "text": "Respondeo dicendum quod Deum esse quinque viis probari potest."
    },
    {
      "type": "paragraph",
      "loc": "I, q. 2, a. 3, ad 1",
      "text": "Ad primum ergo dicendum quod, sicut Augustinus dicit in Enchiridio…"
    }
  ]
}

### Numeracja dziesiętna ("decimal")
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@tractatus",
  "scheme": "decimal",
  "edition": {
    "language": "pl"
  },
  "portion": {
    "key": "2",
    "label": "Twierdzenie 2",
    "order": 2
  },
  "blocks": [
    {
      "type": "paragraph",
      "loc": "2",
      "text": "To, co zachodzi, fakt, to istnienie stanów rzeczy."
    },
    {
      "type": "paragraph",
      "loc": "2.01",
      "text": "Stan rzeczy jest połączeniem przedmiotów (rzeczy)."
    },
    {
      "type": "paragraph",
      "loc": "2.011",
      "text": "Dla rzeczy jest istotne, że może ona być składnikiem stanu rzeczy."
    },
    {
      "type": "paragraph",
      "loc": "2.012",
      "text": "W logice nic nie jest przypadkowe."
    },
    {
      "type": "paragraph",
      "loc": "2.0121",
      "text": "Wyglądałoby to na przypadek, gdyby rzeczy, która mogłaby występować samodzielnie, później miała przypaść w udziale sytuacja."
    }
  ]
}

### Paragrafy dzieła ("sections")
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@dociekania",
  "scheme": "sections",
  "edition": {
    "language": "pl"
  },
  "portion": {
    "key": "cz-1-41-45",
    "label": "Część I, §§ 41–45",
    "order": 1
  },
  "blocks": [
    {
      "type": "paragraph",
      "loc": "§ 43",
      "text": "Dla wielkiej klasy przypadków użycia słowa „znaczenie\" — choć nie dla wszystkich — można to słowo objaśnić tak: znaczeniem słowa jest jego użycie w języku."
    },
    {
      "type": "paragraph",
      "loc": "§ 44",
      "text": "Powiedzieliśmy: zdanie „Excalibur ma ostre ostrze\" ma sens także wtedy, gdy Excalibur jest już rozbity."
    }
  ]
}

### Podział dzieła ("outline")
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": "@wyznania",
  "scheme": "outline",
  "edition": {
    "language": "pl"
  },
  "portion": {
    "key": "ks-1",
    "label": "Księga I",
    "order": 1
  },
  "blocks": [
    {
      "type": "heading",
      "level": 1,
      "loc": "ks. 1",
      "text": "Księga pierwsza"
    },
    {
      "type": "paragraph",
      "loc": "ks. 1, rozdz. 1, ak. 1",
      "text": "Wielki jesteś, Panie, i godzien wielkiej chwały. Stworzyłeś nas dla siebie i niespokojne jest serce nasze, dopóki nie spocznie w Tobie."
    },
    {
      "type": "list",
      "loc": "ks. 1, rozdz. 1, ak. 2",
      "items": [
        "Najpierw wzywać Ciebie?",
        "Czy najpierw Ciebie poznać?"
      ]
    },
    {
      "type": "table",
      "columns": [
        "Łacina",
        "Polski"
      ],
      "rows": [
        [
          "inquietum est cor nostrum",
          "niespokojne jest serce nasze"
        ]
      ]
    }
  ]
}

## Pełny przykład (artykuł w czasopiśmie, tekst w dwóch częściach)
{
  "format": "recreatio/source-text",
  "version": 1,
  "work": {
    "key": "kowalski2020",
    "data": {
      "workType": "article",
      "title": "Miłość, która pyta",
      "subtitle": "O J 21,15-17",
      "authors": [
        "@kowalski"
      ],
      "container": "@przeglad",
      "year": "2020",
      "volume": "12",
      "issue": "2",
      "pages": "45–60",
      "language": "pl"
    }
  },
  "entries": [
    {
      "kind": "person",
      "key": "kowalski",
      "data": {
        "personType": "person",
        "givenNames": "Jan",
        "surname": "Kowalski"
      }
    },
    {
      "kind": "work",
      "key": "przeglad",
      "data": {
        "workType": "periodical",
        "title": "Przegląd Biblijny"
      }
    }
  ],
  "scheme": "pages",
  "edition": {
    "language": "pl",
    "pdfPageOffset": -44
  },
  "portions": [
    {
      "portion": {
        "key": "wstep",
        "label": "Wstęp",
        "order": 1
      },
      "blocks": [
        {
          "type": "page",
          "page": "45",
          "pdf": 1
        },
        {
          "type": "heading",
          "level": 1,
          "text": "Miłość, która pyta"
        },
        {
          "type": "paragraph",
          "text": "Trzykrotne pytanie Jezusa odpowiada trzykrotnemu zaparciu się Piotra.{{note 1}} Nie jest przesłuchaniem, lecz uzdrowieniem {{page 46 pdf 2}} pamięci."
        },
        {
          "type": "note",
          "id": "1",
          "text": "Por. J 18,15-27."
        }
      ]
    },
    {
      "portion": {
        "key": "rozdz-1",
        "label": "1. Słowa pytania",
        "order": 2
      },
      "blocks": [
        {
          "type": "heading",
          "level": 2,
          "text": "1. Słowa pytania"
        },
        {
          "type": "paragraph",
          "text": "W dwóch pierwszych pytaniach pada czasownik agapao, w trzecim — phileo."
        }
      ]
    }
  ]
}
```
<!-- app:work-with-text:end -->
