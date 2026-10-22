# Implementation log: the target architecture (2026-10-22 →)

The owner's decisions are in the task "Implement the target architecture" (accepted recommendations of
`target-architecture-gaps.md`, section D, plus further decisions). This file records, per step, what was built,
what was removed, the choices made, what the owner must run, and how to test it in the browser.

Words used here: **library** = a books library (`app.library.kind = 'books'`), **base** = a Cogita knowledge base
(`kind = 'knowledge'`), **display** = the third layer (page modules, a preached sermon's page, a learning aid) —
it shows prepared material and stores none.

---

## Step 1 — Housekeeping

**Built**

- **Certificates renew themselves.** A certificate now lasts two years (`Area.MaxLife` = 2 years + 1 day,
  browser `LIFETIME_SECONDS`). When one has less than a year left:
  - the bell digest names the area (`renewals.waiting`, `Notifications/Notify.cs`, using
    `Area.DueMemberships`);
  - the browser of anyone who may admit people there (live `admin`/`certify`) re-signs the due certificates with
    the same role and level (`areas/renew.ts`, `notify/notifyRich.ts` `renewWaiting`);
  - the service accepts them at `POST /workspace/area/{id}/renew` (`Areas/Area.Renew.cs`): the issuer must be the
    caller's role with live admin/certify; only memberships that still exist (not revoked, key not destroyed) — a
    dropped role cannot come back this way; validity at most two years; already-renewed lines are skipped (two
    browsers at once are harmless). No key travels.
- **The area's people list shows until when each level holds** (`members[].expires`, "do 22 paź 2028"; red
  under 60 days). Opening "Osoby" also renews right there when something is due; a failure (here or in the
  background) shows as a warning, and a member whose own access ends within 60 days is told to ask a leader.
- **Expired role edges give no reach.** `role_edge.expires_at` existed since 0008 but the service never checked
  it. Every query that walks edges now uses `RoleEdges.Live` (`Roles/RoleEdges.cs`): `Workspace.RolesOfAsync`
  (both walks), chat readers, form extensions, push, page access, role bundles, invites, reach, and the role
  graph handed to the browser. Checked first on production (read-only): 34 live edges, none with an expiry —
  nothing lapses because of this change.
- **Documentation drift fixed:** LIBRARY.md "How Cogita builds on this" (describes the built system now),
  COGITA.md (built-in kinds are eight; no private fields), the `Library.cs` header (visibility by area),
  menu-inheritance comments in `pages/page.ts` and `MenuEditor.tsx` (0058: menus are not inherited), the stale
  "opublikowany" texts of the library page modules (`writing`, `writings`, `quotes`, `pages/part.ts`).
  The Cogita modules still say "opublikowany" — true until step 8.

**Removed**

- `FieldDef.private` in Cogita and everything that read it (the "prywatne" tags in `EntityEditor` and
  `SchemaEditor`, the filters in `CardFace` and `publish.ts`). It was never set any more.
- The unused `Area.MembershipLife` constant.

**Choices**

- **Renewal at one year left, not 60 days.** The task text says "fewer than 60 days"; the owner decided in the
  chat on 2026-10-22 "limit 2 years and the renewal 1 year". With a two-year lifetime this leaves a full year
  in which any leader's browser can renew. The 60-day mark is kept for the red date and the member warning.
- A certify-only holder may renew `admin` lines, the same as `grant` already lets them admit at any level.

**Owner must run**

- Deploy the API (`-p:PublishProfile=Webio -p:IsGetPasswordEnabled=true`) and the website (build `docs/`).
  No migration in this step. The 45 existing one-year certificates renew to two years the first time an admin
  of each area opens the app after the deploy (read-only check: every one of the 30 areas has a live
  admin/certify holder).

**Test in the browser**

1. Obszary → an area → Osoby: every person shows "do …" about two years ahead.
2. Open the same tab in an area you lead whose memberships are older than one year (any area from before
   2026-10-23): after the deploy the dates jump to two years from today.
3. A member who only reads sees no renewal action; nothing else changes.

**Checklist for the owner: the rosary topic data** (sealed — only you can fix it; ids never change, so tags stay)

1. **Mystery 2 has the key of mystery 1** (`tajemnica-1-swiatla-cud-w-kanie`).
   - Biblioteka → Kazania… → Tematy → the topic "Cud w Kanie" (or however mystery 2 is titled).
   - Search the library for `tajemnica-1-swiatla-cud-w-kanie` first: if a text cites it as `[@…]`, note which.
     (After step 2 citations hold ids, so a key change cannot orphan them; until then, fix the citing text too.)
   - Check that no other topic already has the key you want (e.g. `tajemnica-2-swiatla-cud-w-kanie`); if one
     does, give that one its right key first.
   - In "Klucz cytowania" type the new key in one go and leave the field.
   - Correct the same key in your JSON source file (the rosary import), so a re-import matches the right topic.
2. **Leaf mysteries are marked as aspects instead of their root.**
   - On each of the 20 mysteries: "Aspekt" → empty. On the root of the axis (e.g. "Tajemnice różańca"): "Aspekt"
     → tak. Do the same for the 12 areas (the root "Obszary maryjne" or similar).
   - Nothing else changes: texts keep their tags (ids). Then the archive shows one "Tajemnice" axis with 20
     values and one "Obszary" axis with 12.
3. **The fifth joyful mystery is titled "Ofiarowanie"** (`01a16044-30c8-7819-8ba1-041d72538ebf`).
   - Rename it "Znalezienie Pana Jezusa w świątyni"; if its key says "ofiarowanie", change the key as in 1.
   - Check that the fourth joyful mystery really is "Ofiarowanie" — the error may be a shift by one.
4. For the matrix of step 10 the axes need groups: the 20 mysteries as four sub-topics (radosne, światła,
   bolesne, chwalebne) under the root, five each; the 12 areas as three groups of four. Arrange `parent` that way
   if it is not so already.

---

## Step 2 — Ids in markup, keys as writing aids

**Built**

- **Stored text holds ids.** `LibraryStore.write` turns every key in the markup that resolves (own library first,
  then the other readable ones) into the entry's id (`storedMarkup` in `libraryKinds.ts`, built on
  `mapRefTokens` in `libraryMarkup.ts`, which rewrites only reference tokens — in cites, embeds, notes and the
  `[[Wort|@token]]` links of knowledge bases — and leaves every other character as it was). Keys that resolve
  nowhere stay as typed.
- **Editors, previews, JSON export and AI descriptions show keys** (`shownMarkup`): the entry editor loads its data
  in key form, `exportLibrary(name, entries, look)` writes keys, `CitePicker` inserts the key. Where a key, seen
  from here, would find a different entry (two libraries using the same key), the id stays visible — so the text
  always points where it pointed.
- **Rendering resolves id first, then key** (`refTarget`): footnotes, embeds, LaTeX, plan points, backlinks, the
  library map, missing-source warnings.
- **A key change never orphans a citation.**
  - The key field commits on leaving it or on Enter, never on every keystroke (intermediate keys were autosaved
    before).
  - Before a new key is taken, `pinCitations` rewrites texts that still name the entry by its key (in every
    readable library the user may write) to its id.
  - The previous key stays at the entry as an alias (`_aliases`, at most ten): old JSON files and texts in
    libraries the user cannot edit still find it. A new entry cannot take an alias of another one.
- **`moveTo` no longer ignores `keyChanged`.** It pins citations before the move, keeps the old key as an alias,
  and says so — a toast in "Kto widzi", a report line in the visibility migration.
- **Keys across libraries (decision 6):** a suggested key avoids every key of the readable libraries; choosing a
  key used in another readable library shows a warning in the key box (not an error); unreadable libraries are
  never consulted.
- **Import** (`recreatio/library`): keys in the markup become ids (document keys first, then the store); unknown
  keys stay and are reported; `_aliases` travel without a warning. Export → import of a library changes nothing.
- **Porządki became a hub** (`library/rebuild/`): one tab per migration, each with "Co się zmieni" → run →
  report (`Rebuild` interface in `rebuild.ts`, panel in `RebuildView.tsx`). The visibility migration is the first
  tab; the second is **"Odwołania w tekstach"** (`rebuild/refsToIds.ts`): every text saved before today, in every
  library and knowledge base the user may write, gets ids instead of keys; unknown keys are listed.

**Removed**

- Nothing user-visible. The key-based resolution stays as a fallback for typing and for old texts.

**Choices**

- Aliases rather than rewriting texts one cannot write: some texts live in libraries the user may only read.
- The text example of the `text` kind now cites the work example (`[@ratzinger2007, s. 183]`) instead of `@bt`,
  which no example defines — the "examples import without a warning" check would otherwise fail on the new
  unknown-key warning.

**Owner must run**

- Deploy the website (no API change in this step).
- Biblioteka → "Porządki" → tab "Odwołania w tekstach": read "Co się zmieni", press "Wykonaj". Repeat after the
  visibility migration if that one moved anything (it does not touch text).

**Test in the browser**

1. Open a sermon that cites a book (`[@klucz, s. 5]`); open the book; change its "Klucz cytowania" and leave the
   field. Back in the sermon the footnote still names the book; the editor shows the new key.
2. Type the old key in another text: it still finds the book (alias).
3. Export the library as JSON: texts show keys, not long ids.
4. Porządki → "Odwołania w tekstach": after "Wykonaj", the plan reads "Wszystko jest już po nowemu".

---

## Step 3 — One reader, drawn by kind

**Built**

- **One parser for every text.** `libraryMarkup.ts` now also reads `[[these words|@key]]` (a `ref` inline: a link
  with its own words), and `safeHref` is the one rule for where a link may go — the web (`www.` becomes
  `https://`), a page here (`#/…`, also `/#/…`), a scene (`#name`), a path, e-mail, telephone. The page and
  presentation links (`textLink`) use the same rule. `UNREADABLE` ("[odwołanie niedostępne]") moved here.
- **Sources are cited, own entries are linked (decision 9).** In `markupView.tsx` only a work, a quote or a person
  becomes a footnote (`SOURCE_KINDS`, `isSource`). A citation of an own entry (text, comment, topic, project,
  delivery, an entry of a knowledge base) becomes a link where the footnote would stand — "(zob. title)";
  `[[words|@key]]` links with its words. A target the reader cannot open: the footnote "[brak źródła]" in a
  citation (as before), "[odwołanie niedostępne]" or just the words of a `[[…]]` elsewhere — never its title or key.
  Comment cells link own entries the same way.
- **Where a link goes** (`MarkupLinks` context): in the workspace preview to the entry's editor; on a page the entry
  opens under the text (`OpenedEntry` in `LibraryText.tsx`: a text in short, a comment with what it is about, a
  quote with its origin, otherwise title and description) — only what this reader can already read.
- **LaTeX and plan lines alike:** sources as `\footnote`, own entries as `(zob. \emph{title})`, `[[words|@key]]` as
  its words (`libraryLatex.ts`, `sermon.ts` `pointLine`). `wordCount` counts the words of `[[…]]`.
- **Cogita knowledge uses the same reader** (`cogita/ui.tsx` `Markup`): headings, lists, quotes and notes are now
  drawn properly, a citation of a work becomes a real footnote instead of the text "[klucz]", and entity links
  open the entity as before. Lookup through `CogitaLibrary.markupLook` (own base, then sources). Plain text for
  search and labels (`plainOf`) comes from the same parser.
- **The page `text` part:** inside a line the one reader works (`**bold**`, `*italic*`, links — `ui/richText.tsx`);
  the line syntax stays (`## `, `# `, `> `, a row of links). New optional field **"Odwołania z biblioteki"**
  (`library`): with it, `[@key, s. 12]` gives a footnote under the part, `[[words|@key]]` a link that opens the entry
  under the text, `^[…]` a footnote (`library/LibraryLines.tsx`, loaded only when a text has references). Without a
  library a reference says "[odwołanie niedostępne]" and a note stands in brackets.
- **AI descriptions:** `MARKUP_DOC` (library JSON) and `courseDescription()` (Cogita JSON) say which citations
  become footnotes and which links, with examples; the `text` part's hint and example show a citation and a link.
- Checks: `app-library-check` 2c (kinds, `[[…]]`, unreadable targets, workspace links, LaTeX, plan lines, the page
  part, Cogita, descriptions), `app-presentation-check` §8 (bold/italic, no library), `app-cogita-check`.

**Removed**

- The "Zob. komentarz: „…”" footnote and the link inside a footnote for own texts (`citeSegs` has no `href` any more).
- Cogita's own regex renderer and the `resolve` prop of `Markup` (the lookup comes from the base).
- `textLink`'s own rule (it now calls `safeHref`). A protocol-relative address (`//host/…`) is no longer a link.

**Choices**

- **"(zob. …)"** rather than a bare title: the author wrote the citation where a footnote belongs, so the link stands
  there as the usual Polish cross-reference.
- **The page part keeps its line syntax** (`# ` = big line, `> ` = quiet line). This differs from the library, where
  `#` is a heading and `>` a block quote. Changing it would change 79 existing text parts and the presentations;
  only the inline syntax and references are unified. Read-only check before the change: no existing text part used
  `*`, `_`, `^[` or `\` in a way the new reader would read differently.
- Data is not rewritten: `[@id]` citations of comments stay as they are and are drawn as links.
- A knowledge base on a public page without keys (Cogita bundles) shows references as unreadable until step 8 moves
  keyless sessions to the sealed store; there are no Cogita page modules on production (read-only check).

**The change on one sermon** (decision 9). Production texts are sealed, and reading production is not permitted to
me in this session, so here is a worked sermon with the same shapes (a Bible citation, a comment cited in a
footnote, an own earlier sermon cited together with a book):

```
Anioł mówi: „Duch Święty zstąpi na Ciebie” [@bt, Łk 1,35]. Ten obłok zna już Stary Testament [@cien-ducha].
Mówiliśmy o tym w zeszłym roku [@kazanie-zwiastowanie; @ratzinger2007, s. 40].
```

Before: three footnotes — ¹ Łk 1,35 (BT). ² Zob. komentarz: „„Moc Najwyższego osłoni Cię” — ten sam obłok…”.
³ *Fiat — odwaga zgody* (2025-03-25); J. Ratzinger, *Jezus z Nazaretu*, Kraków 2007, s. 40.

After: two footnotes, two links —

```
Anioł mówi: „Duch Święty zstąpi na Ciebie”¹. Ten obłok zna już Stary Testament (zob. „Moc Najwyższego osłoni
Cię” — ten sam obłok, który osłaniał Namiot Spotkania.). Mówiliśmy o tym w zeszłym roku (zob. Fiat — odwaga zgody)².
  ¹ Łk 1,35 (BT).   ² J. Ratzinger, Jezus z Nazaretu, Kraków 2007, s. 40.
```

The two "(zob. …)" are links (in the workspace to the editor, on the page they open the comment or the sermon under
the text). LaTeX prints the same with `\emph{…}`.

**Owner must run**

- Deploy the website (no API change, no migration, no data change).

**Test in the browser**

1. Open a sermon that cites a comment (`[@klucz-komentarza]`): in the preview it reads "(zob. …)" as a link to the
   comment, the footnotes count only books, the Bible and quotes.
2. On the public page of that sermon click the link: the comment opens under the text with "Zamknij".
3. A page "Tekst" part: choose "Odwołania z biblioteki", type `Zob. [@klucz, s. 3] i [[ten tekst|@klucz-tekstu]].`
   → a footnote under the part and a link that opens the text.
4. Cogita → a knowledge entry with `## Teza`, a list and `[@dzielo, s. 5]`: heading, list and a numbered footnote.

---

## Step 4 — The reference index and places in the Scripture

**Built**

- **One reference index** (`library/refIndex.ts`) over every library and knowledge base open in the tab, computed in
  the browser. `refsOf` finds references in any entry without knowing its kind: ids in fields, markup references with
  their place (`[@x, Dz 1,14]`, `![@x]`, `[[words|@x]]`, also inside plan points — the hit names the point), comment
  subjects and table/list cells (`{ref, locator}`), sources of uncertain Cogita values (`{work, locator}`), and every
  id in Cogita documents (revisions, flows, views, collections, templates, add forms). Merges, settings and `_` fields
  do not count. Keys resolve in the entry's own store first, then libraries, then other bases. Recomputed only when a
  store changes.
- **"Powiązania"** (`library/LibraryRelations.tsx`, replacing the box in `LibraryEntryBoxes.tsx`) now lists, besides the
  library entries as before (with the plan point and place), the entries and documents of knowledge bases that use the
  entry, grouped per base; **"Szukaj we wszystkich, które możesz czytać"** opens every library and base the account
  may read (`LibraryStore.openEverything`); **"Sprawdź strony"** lists the pages this account leads whose modules show
  the entry (`library/pageUses.ts`).
- **Cogita "Odwołują się tutaj"** adds "Wspominają go": knowledge texts that link with `[[…]]`, revisions, flows, views,
  collections, library texts and comments.
- **The library map** shows comments, and draws grey lines for comment subjects and cells, project outlines and plan
  points (`refsOf` instead of the cited keys only).
- **Places in the Scripture** (`library/bible.ts`): the 73 books with Polish, Latin and English names and abbreviations;
  the parser reads `Dz 1,14`, `Dz 1:14`, `Acts 1,14`, ranges, ranges over chapters, Polish and English lists, whole
  chapters, several places with the book carrying on, `Ps 51(50),3`, `22,2a`, `16,9nn`. Overlap, canonical order,
  writing back in three languages.
- **"Fragment Pisma"** on every Bible work: type a place, see every quote, comment, plan point, text and knowledge entry
  pointing at an overlapping place, in every edition of the Scripture (other editions show their siglum). The library
  search does the same when the query is a place.
- **Quotes in canonical order** (`quoteOrder`): in lists, in "Cytaty z tego źródła" and in the quotes JSON of a book —
  "Dz 1,8" before "Dz 1,14", "s. 9" before "s. 10" (the old order compared text).
- `MARKUP_DOC` tells an AI how to write a place in the Scripture.
- Checks: `app-library-check` 2d (books in three languages, every locator form, overlap, order, `refsOf` per shape, the
  index across stores with key resolution, the passage search across editions, the description).

**Removed**

- `pageNumber` (quote order by the first number) — replaced by `locatorKey`.
- `entryLine` moved from `LibraryPick.tsx` to `refLabels.ts` (no copy left behind).

**Choices**

- **Nothing is stored for places.** Locators stay what people wrote; the index is computed. No migration.
- **Pages: only those the account leads**, loaded on request, never other pages — the service is not asked to index
  page configurations (sealed pages could only be read in the browser anyway).
- Opening every readable base is a button, not automatic: a large knowledge base costs time and memory.
- A place without a book ("1,14") is not read — a Bible locator must name its book.

**Owner must run**

- Deploy the website (no API change, no migration).

**Test in the browser**

1. Biblioteka → Źródła → the Bible (BT) → "Fragment Pisma": type `Dz 1:14`. Quotes, comments, sermons (with "plan,
   punkt …") and, after "Szukaj we wszystkich…", knowledge entries citing that place appear; `Dz 1,12-14` is found too.
2. In the library search type `Psalm 23`: the passage list appears under the search.
3. Open a topic → "Powiązania" → "Szukaj we wszystkich…": knowledge bases that use it appear with their entries.
4. "Sprawdź strony" on a sermon shown by a "Tekst z biblioteki" module: the page is listed with the module.
5. Cytaty tab: Bible quotes stand in the order of the Bible.

---

## Step 5 — Cogita learns from Library material

**Built**

- **Material kinds** (`CogitaLibrary.materialKinds`): a base's own kinds plus the kinds of its source libraries that
  have entries there (quotes, works, texts, comments, projects, deliveries, persons), labelled "(z biblioteki)" in the
  template editor, the new-revision form and every kind choice of a graph node.
- **Cards from library entries.** A template over a library kind makes cards of that library's entries, keyed
  `template:entry` like every card — entry ids are stable, so progress keys stay. "Wpisy rodzaju" and "Dystraktory" of
  such a template draw from the same material (`material(kind)`, `poolFor(entity)`); templates over the base's own
  kinds draw from its own entries as before.
- **Revision source "kind from where"**: `source.kind` has "Skąd" (`from`): empty — this base and all sources; or one
  library or base. The new-revision form offers the library kinds and, with several libraries, which one; it warns when
  no template makes cards of that kind yet. One place builds the revision context (`CogitaLibrary.revisionContext`, used
  by Nauka and the public bundle).
- The template preview works on a library entry (picker over library material).
- `courseDescription()` shows a template over `"kinds": ["quote"]` and a revision source with `"from"`.
- Checks: `app-cogita-check` (a kind from one library; material kinds, material, cards keyed template:entry, the place
  as the answer, where entries come from), a drive against the local API (`material-api.mjs`: a library with a Bible,
  quotes, a sermon and a comment; a knowledge base reading it; the passage search over both; a template over quotes;
  a revision of that library's quotes plans all three, one "from the base" plans none).

**Removed**

- The hard-coded copies of the library kinds in `TemplateEditor.tsx` and `EntityEditor.tsx` (now `BOOK_KINDS` and
  `LIBRARY_KIND_IDS`).
- The two hand-built revision contexts in `RevisionRun.tsx` and `publish.ts`.

**Choices**

- **Library material enters only through templates and revisions that name its kind.** Nothing changes for existing
  bases: no template over a library kind could be made before, and the base's own lists ("Wpisy", "Do zrobienia")
  still show only its own entries.
- Library topics give no cards yet — the two topic systems become one in step 7.

**Owner must run**

- Deploy the website (no API change, no migration).

**Test in the browser**

1. Nauka → a knowledge base → Ustawienia: add the library with your quotes as a source.
2. Karty → "+ Nowy szablon" → "Dla rodzaju": "Cytat (z biblioteki)", "Początek": "Luki w cytacie" (field: Tekst
   cytatu) → Utwórz. The preview shows a library quote with its gaps.
3. Powtórki → "+ Nowa powtórka" → "Z czego": rodzaj → "Cytat (z biblioteki)" → Utwórz → Ucz się: the quotes are asked.

---

## Step 6 — Statements: one kind, computed roles

**Built**

- **The library comment is the one kind for statements** (decision 5: it lives in libraries; plaintext kind stays
  `comment`, label "Komentarz"). Computed, never stored (`library/comment.ts`):
  - **thesis** = the first sentence of the first paragraph (decision 1; `firstSentence` skips "św.", "np.", "zob. s.",
    initials, markup and citations). Missing or over 200 characters: a warning in the editor, "brak tezy" / "za długa
    teza" in the comments list, and "Komentarze bez dobrej tezy" in Cogita's "Do zrobienia";
  - **question** = a comment whose first sentence is a question (decision 2); answered once another readable comment
    points at it; open ones are listed in "Do zrobienia" ("Pytania bez odpowiedzi");
  - **information / interpretation** (`statementRole`): information cites a work, a quote or a person and rests on no
    other comment and no table. A mark on every comment card, in the editor preview and in the list.
- **Cogita reads statements**: the comment's `blocks` are a read-only field type `blocks`; the comment is named by its
  thesis; new template nodes (group "Komentarz"): thesis, piece n (paragraph, each list item, each table row), table
  columns as the two sides of "dopasowanie par", subjects with places; two starts for comments ("Teza komentarza",
  "Tabela komentarza: dopasuj pary"), offered only for comments.
- **Flows and explanations accept statements**: `line` and `expand` steps and the dialogue editor pick comments; a
  question's "Wyjaśnienie" and the explanation after an answer show a comment whole (`CommentCard`); the flow player
  shows it as markup (`blocksMarkup`).
- **Migration "Wiedza → komentarze"** (Porządki, tab 3, `rebuild/knowledgeToStatements.ts`): every knowledge statement
  of a base you may write moves into a library of the same area as a comment under the same id; `text` → paragraph,
  `source` + `locator` → a citation inside it, `about` → subjects, `tags` and all other fields stay; the library becomes
  a source of the base; a library "Komentarze — <obszar>" is made where none can be written. Skipped and named: entries
  with other kinds too, published ones (until step 8), bases you only read. Idempotent.
- **Service**: a move may now go from a knowledge base into a library — only within the same area
  (`Library.Areas.cs` `MoveAsync`), so nobody reads more than before. `LibraryStore.moveTo(id, target, as)` carries the
  new kind and data.
- **New statements are not made as "Wiedza" any more**: "+ Rodzaj" no longer offers it; an accepted proposal
  ("wyjaśnienie") becomes a comment of the base's library in its area (as "Wiedza" only where there is none).
- `BOOK_KINDS` is derived from the library kinds (no own list).
- Descriptions: `COMMENT_DOC` (thesis, question, computed role, knowledge as comments with the source as a citation),
  `courseDescription()` (statement templates and nodes).
- Checks: `app-library-check` 2e (first sentence and abbreviations, thesis problems, questions, roles, `blocksMarkup`,
  the conversion, the marks), `app-cogita-check` (label by thesis, `blocks` values, thesis and table cards, presets
  for comments only, `BOOK_KINDS`), drive `statements-api.mjs` against the local API (cross-area move refused; plan;
  run; same id as a comment with the citation inside; subject and tags kept; key; the base reads the library; the
  question's explanation resolves as a comment named by its thesis; a library made in an empty area; second plan
  empty).

**Removed**

- The `knowledge` kind from "+ Rodzaj" (existing ones keep working until migrated).
- The own list of library kinds in `cogita/store.ts`.

**Choices**

- **The source of a knowledge statement becomes a citation inside its paragraph**, before the final punctuation
  ("… na modlitwie [@bt, Dz 1,14]."), as decided — not an extra subject. Without text, the source stays as a subject.
- **Perspectives (`tags`) stay on the moved comments as they are**; step 7 turns them into aspects.
- **Published knowledge entries are not moved**: the service clears the public copy on a move, and public bundles go
  only in step 8.
- **A table makes a comment an interpretation** (it compares), even when its cells cite sources.
- Templates over "Wiedza" do not apply to moved entries (they are comments now); the report says so and points at the
  two comment starts. Card progress rows stay stored.

**Owner must run**

1. Deploy the API (`-p:PublishProfile=Webio -p:IsGetPasswordEnabled=true`) — the move rule changed — and the website.
2. Biblioteka → Porządki → "Wiedza → komentarze": read "Co się zmieni", then "Wykonaj". (On production the knowledge
   bases held 21 entries in total — probably dictionary words, which are not "Wiedza" and are not touched.)

**Test in the browser**

1. Open a comment in the library: the preview shows "Informacja" or "Interpretacja"; write a first sentence over 200
   characters — the editor warns; start with a question — "Pytanie otwarte" until another comment refers to it.
2. Cogita → Karty → "+ Nowy szablon" → "Komentarz (z biblioteki)" → "Teza komentarza" → the preview shows "Co mówi
   komentarz o: Łk 1,35?" with the thesis on the back.
3. Cogita → Do zrobienia: "Pytania bez odpowiedzi" and "Komentarze bez dobrej tezy".
4. Porządki → "Wiedza → komentarze" on a base with a "Wiedza" entry: after "Wykonaj" it opens in the library as a
   comment; a flow line that spoke it still shows it.

---

## Step 7 — One topic system

**Built**

- **Topics from libraries are a base's topics** (`CogitaLibrary.topics()`): its own (until they move) and those of its
  source libraries — the library's aspects are the axes. ExploreMap, "Do zrobienia" and the topic pickers of revisions
  (also in graph nodes) use them.
- **A topic follows backlinks** (`topicTree`, `taggedWith`): a topic and its subtopics take everything that points at
  them — a sermon's `topics`, a statement's markup, a question's `about` — computed over the base and its library
  material (`refsOf`), besides `answers` and `entity` as before. A revision "everything under Tajemnice światła" now
  picks up statements, sermons and questions tagged there. A library topic with answers keeps giving its topic card.
- **Learning fields are an optional extension** of the built-in topic (`TOPIC_LEARNING`: answers, entity, level,
  landmark, dimension, open): Schemat → Temat → "+ Pola nauki" adds them as an override of the topic; a base whose
  topics already carry them keeps seeing them (`kindDefs`). The built-in topic is the library topic. The `tags` field of
  library texts in Cogita is gone; `answers` also accepts comments.
- **Migration "Tematy i perspektywy → biblioteka"** (Porządki, tab 4, `rebuild/topicsToLibrary.ts`): the topics of every
  base you may write move into the library of its area (same ids, parents kept, learning fields along; the base gets
  "Pola nauki"); a topic the library already has (same name and parent) is named, not merged. Perspectives (the base's
  settings list and the `tags` of entries) become the aspect topic "Perspektywy" with one value per perspective;
  library entries with `tags` get those topics and lose `tags`; the settings list goes. Base entries whose kind has no
  topics keep their perspectives and are named. Library creation and the source link are shared with tab 3
  (`rebuild/areaLibrary.ts`).
- Cogita settings: the perspectives textarea is replaced by a note pointing at the axis (and at the migration while a
  list remains).
- `courseDescription()` explains topics from the library, the learning extension and the perspectives axis.
- Checks: `app-cogita-check` (topics from a source library; a subtree with sermons, statements and questions via
  backlinks, nothing above it, depth; what points at a topic; topic fields plain / kept when used / added by the
  extension), `app-library-check` 2f (the plan: move, twin named, extension, one axis case-insensitive, library entries
  converted, base entries named, description), drive `topics-api.mjs` (moved topics with fields and parents, the twin
  stays, the extension doc, the axis and its values, the comment's topics, the settings list gone, the base sees the
  topics with their fields, the subtree holds the question via its `about`, a revision by topic asks it, second plan
  empty).

**Removed**

- `TOPIC_MORE` as a part of the built-in topic (it is the `TOPIC_LEARNING` extension now), `TEXT_MORE` (perspectives
  on texts), the perspectives list in Cogita settings (after the migration).

**Choices**

- **Twins are not merged automatically** — "report, don't guess": Cogita's "Połącz z duplikatem" merges, then the
  migration runs again.
- **`topic.answers` stays** for now (data rule: removed only after its data stands elsewhere); topic trees read it and
  backlinks together. Dropping it needs the overview entries of a later step.
- **Perspectives on topics stay in their field**: a library topic has no "Tematy" of its own; the plan names them.

**Owner must run**

- Deploy the website (no API change in this step; the step-6 API deploy covers the moves).
- Biblioteka → Porządki → "Tematy i perspektywy → biblioteka" after "Wiedza → komentarze" (so moved statements bring
  their perspectives into the library first).

**Test in the browser**

1. Cogita → Powtórki → "+ Nowa powtórka" → "Z czego: temat z podtematami" → pick "Tajemnice światła" (a library topic
   now) → Utwórz → Ucz się: the cards of sermons, comments and questions tagged under it are asked (given templates for
   texts or comments, or hand-written questions).
2. Cogita → Schemat → Temat → "+ Pola nauki" → Zapisz: topics show Głębokość, Próg, Do rozwinięcia.
3. Porządki → "Tematy i perspektywy": the plan lists the topics and the axis; after "Wykonaj" the library's Tematy show
   "Perspektywy" with its values.
