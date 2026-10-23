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

## Step 8 — Knowledge bases follow their area

**Built**

- **Service.** `GET /library/{id}/open` now serves a base too — when its area is public **and** the base is opened
  (`area_rule_at`). `GET /library/{id}/file/{fileId}/sealed` serves a file of a public library or base, sealed, and only
  under a published epoch; the browser opens it with the area's published key. `POST …/publish` only withdraws old
  copies — a request to publish an entry is refused with a sentence that says what to do instead. The move endpoint
  also takes base → base, in any area (`Library.MayMove`: library → library anywhere, base → base anywhere, base →
  library only in the same area, library → base never).
- **Migration 0123** clears `area_rule_at` of every existing base. Before step 8 the mark had no effect on bases, but a
  base created after 0122 got it at creation without anyone reading what it means. Now no base is public until a
  writer opens it. Libraries are untouched.
- **Pages read the base itself** (`cogita/pageBase.ts`: `openPageBase`, `usePageBase`, `baseChoices`,
  `entityChoices`). This covers the six modules (revision, flow, entity card, entity table, topics, knowledge map),
  the page subject "Wpis z bazy wiedzy", keyless sessions (an async revision through `PageRevisionRun`, a story
  through `StoryPlay`), and the editor's entry picker (`PickLibraryEntry` on a base). A page shows a base to whoever
  may read it: publicly, through a link, a seat, or as a member. Otherwise it says so. Files open for strangers from
  the sealed endpoint (`files.ts`). The base picker tells each base apart: "publiczna w całości", "obszar publiczny,
  baza jeszcze nie otwarta" or "dla członków obszaru".
- **"Kto widzi"** (`cogita/BaseWho.tsx`, words and logic in `cogita/visibility.ts`) replaces "Opublikuj" on an entry,
  a revision and a flow.
  - It says who reads the item.
  - **"Przenieś do innej bazy wiedzy"** shows its plan first: who reads the item afterwards, and the plain statement
    when the target is public as a whole. It names what the item needs from this base (its kind, templates, entries
    it points at; `needsOf`, step by step), which moves along by default. The old base takes the new one as a source.
    A tick "Rozumiem: to będzie publiczne" is required.
  - A revision and a flow keep "Utwórz stronę z …" (a `c/<id>` page with the module), with one line on who will see
    it.
- **"Kto czyta"** in the base settings (`BaseVisibility`) says in words who reads the base. In a public area, an
  unopened base shows "Co się zmieni" with what is inside, counted. "Otwórz całą bazę dla wszystkich" sits behind
  "Rozumiem: cała baza będzie publiczna", and stays blocked while an old copy remains inside an entry.
- **The plain statement wherever a base becomes public:**
  - the "Nowa baza wiedzy" form, when a public area is chosen;
  - "Kto czyta";
  - "Kto widzi" and its move;
  - the area's "Dla wszystkich" panel (its libraries and bases; the bases as a whole).
- **Porządki tab 5 "Bazy wiedzy: stare publikacje"** (`library/rebuild/baseVisibility.ts`):
  - It withdraws old public copies at the service. The entry stays. In a closed area the plan says that only members
    read the entry afterwards, and how to keep it public: move it.
  - It removes the copy in `data.public` only when everything that copy shows still stands in the base or its
    sources. Otherwise the copy stays, and the plan says why.
  - It withdraws old open copies of files. The sealed file stays.
  - It names bases in public areas that wait to be opened. It never opens one.
- **Descriptions:**
  - `courseDescription()` has a "Kto czyta" paragraph;
  - the page modules' `use`, `missing` and example texts no longer say "opublikowana";
  - the page subject's texts are updated;
  - the JSON export still leaves out `data.public`.
- **Checks:**
  - `app-cogita-check` (339): the audience in words; public = public area AND opened; `needsOf` (follows references
    step by step, skips settings and anything unknown, respects its cap); `baseChoices` and `entityChoices` over a
    base with sources.
  - `app-library-check` 2g: the tab-5 plan per base, the run, and a second run that leaves only what could not be
    done.
  - `Api.Tests` (470): `MayMove`.
  - Drives against LocalDB:
    - `visibility-api.mjs` (22 checks): a new base in a public area is readable by a stranger; a closed one is not;
      files of one base are not served through another; the old readers are gone; publishing is refused,
      withdrawing accepted; a base with its mark cleared (0123) is closed until `settleLibrary`; an entry moved from a
      closed base is readable, the draft left behind is not; library → base is refused; tab 5 on simulated old copies
      withdraws, strips and is resumable.
    - `visibility-anon.mjs` (8 checks): a fresh browser without an account opens the public base with the published
      key, sees the moved entry and the answers of its questions, picks its revision, opens a file; the closed base
      stays closed.

**Removed**

- Browser:
  - `cogita/published.ts` and `library/libraryPublish.ts` (plan, closure, public summary);
  - the bundle builders in `cogita/publish.ts` (entity, revision and flow bundles, `publishMedia`, `publishBundle`,
    `unpublishBundle`), `publishFile` and `publicFileUrl`;
  - `PublicContext`, `PublicGlance` and `contentOfBundle`;
  - `PickPublished`, and `loadPublished`, `loadPublishedOne` and `summaryOf` with their types;
  - `LibraryStore.planFor`, `apply` and `publish` (replaced by `withdraw`); the automatic re-publish on removal;
  - `PublishEntity` and the "publiczny" tag on an entry.
- Service: `Library.Check(PublicEntry)` with its limits, `GET /library/{id}/published` and
  `/published/{entryId}`, `PublishFileAsync`, and the open file copy route `GET /library/{id}/file/{fileId}`.

**Choices**

- **Existing bases are opened explicitly** (0123), not by "follow the area" alone. This keeps rule 1: bases created
  between 0122 and this step were marked at creation without the statement.
- **New bases are opened at creation**, like libraries. The creation form says what that means in a public area.
- **Moving is publishing.** What an item needs moves along by default, and the old base takes the new one as a
  source, so nothing breaks there. Learners' answers stay with the old base, because progress is keyed by base. The
  move dialog says so.
- **An old copy goes only when what it shows still stands** (rule 2). A base still holding such a copy cannot be
  opened, because the copy may carry content of a source in another area.
- **The published readers are removed now**, not with the columns:
  - production has no published base entries;
  - the one published library row, "Kazania Maryjne", lies in a closed area. Under the area rule it is not public,
    so it is no longer served to strangers. Tab 1 offers to move it into the public library, which keeps it public.
    Its old columns stay until the drop.
- **The columns are dropped later.** First the owner must have run Porządki everywhere (SQL below).

**Special attention on production**

- **"Biblioteka" (public area), 14 entries never published.** `/open` keeps that library closed until tab 1 krok 2
  settles it. Tab 1 proposes the private library for each entry; "zostaw — niech będą publiczne" is a choice. Decide
  each one before krok 2.
- **"Kazania Maryjne", published in a closed area.** Once the step-8 API runs, its old copy is no longer served. In
  tab 1 it shows as "would disappear → move to the public library" (the default when there is exactly one public
  library). Keep that choice to keep it public, or choose "zostaw". Krok 2 withdraws the old copy.

**Owner must run**

1. `migrate` (0123) **before** deploying the API. The old API never serves a base publicly, so clearing the marks
   first means the new API opens only bases a writer opens afterwards.
2. Deploy the API (`-p:PublishProfile=Webio -p:IsGetPasswordEnabled=true`), then the website.
3. Biblioteka → Porządki:
   - tab 1 "Widoczność i komentarze", if not done yet: decide the 14 entries of "Biblioteka" and "Kazania Maryjne",
     then krok 2;
   - tab 5 "Bazy wiedzy: stare publikacje".
4. For each base in a public area that should be public: Nauka → the base → Ustawienia → Kto czyta → read, tick,
   "Otwórz całą bazę dla wszystkich".
5. **Later**, once 3 is done everywhere: one numbered migration drops the old columns, together with the code that
   still names them. That code is the entries list (`publishedAs`), the clearing on save and move, the withdraw
   endpoint, the files list and `UnpublishFileAsync`, plus `Entry.publishedAs`, tab 1's `unpublish` and tab 5's
   withdrawals in the browser. Check first (read-only):

   ```sql
   SELECT COUNT(*) FROM app.library_entry WHERE published_at IS NOT NULL;   -- must be 0
   SELECT COUNT(*) FROM app.library_file  WHERE public_at    IS NOT NULL;   -- must be 0
   ```

   The migration:

   ```sql
   DROP INDEX IF EXISTS ix_library_entry_public ON app.library_entry;
   ALTER TABLE app.library_entry DROP CONSTRAINT IF EXISTS ck_library_entry_public;
   ALTER TABLE app.library_entry DROP COLUMN published_at, published_as, public_key, public_sort, public_summary, public_json;
   DROP TABLE IF EXISTS app.library_public_ref;
   ALTER TABLE app.library_file DROP COLUMN public_size, public_type, public_at;
   ```

**Test in the browser**

1. Nauka → a base in a public area → Ustawienia → Kto czyta: read "Co się zmieni", tick, press "Otwórz całą bazę dla
   wszystkich". In a private window, a page with that base's revision module works without an account.
2. A base in a closed area → Wpisy → an entry → Kto widzi → "Przenieś do innej bazy wiedzy" → the public base. The plan
   lists what moves along. Tick "Rozumiem", then press Przenieś: the entry opens in the public base.
3. Biblioteka → Porządki → "Bazy wiedzy: stare publikacje": read the plan and run it. A second run shows nothing left.

## Step 9 — Views, step 1: one selection, a View module, state per module

**Built**

- **One selection in steps** (`cogita/selection.ts`), shared by views and revisions:
  - sources: `source.all`, `source.kind` (with `from`), `source.collection`, `source.topic` (subtopics and what
    points at them), `source.list`;
  - `follow`: along one reference field or all of them, or backwards (`back: true`) to whatever points at the
    entries, in fields or markup, including library material (`CogitaLibrary.pointing`);
  - `filter.rule`: the collections' rule.

  The collections' rule (`RuleGroup`, `ruleMatches`) moved here; `store.ts` re-exports it, so old imports keep
  working. `CogitaLibrary.selectContext()` gives a selection what it needs.
- **The revision graph has the same steps as nodes:** "Idź po odwołaniu" gives the cards of the reached entries,
  "Filtr wpisów" keeps the cards whose entry passes the rule. Both nodes have the same settings fields as the view
  steps (`nodeFields.ts`, palettes `revision` and `view`), and the reference-field picker now lists the base's
  reference fields (`refFieldKeys`). New config type `query` (the rule) is edited by `RuleEditor.tsx`, which used to
  live inside `EntityList.tsx`.
- **The view document** (`cogita/views.ts`) holds its selection as `steps`, plus `query`, `group`, `columns`, `sort`
  and `positions`.
  - Groups for the tree: by kind (as before), by the values of a field, or by an axis of topics. An axis is a topic
    marked as an aspect, and its subtopics in their order are the values. An entry can stand in several groups,
    and what fits nowhere comes last.
  - `readView` reads the old shape (`kind` + `rule`) as steps. `viewJson` writes only the new shape. The Cogita JSON
    export and import convert the same way, and `courseDescription()` documents `views` and the shared nodes with
    a worked example.
- **Wpisy** (`EntityList.tsx`) works on the view document. "Rodzaj" and "Filtr" stay as short cuts into the steps,
  and "Wybór i grupy" (`ViewSteps.tsx`) edits the source, adds "Idź po odwołaniu" and "Filtr", and picks the tree's
  grouping (`GroupTree`). The table's column chooser works for any source.
- **The page module "Widok"** (`pages/parts/view.tsx`, lazy view `viewViews.tsx`) shows a saved view of a base:
  - fields: title, base, view (the picker lists the base's views), and "tabela / drzewo";
  - in the strip, one line with "Zobacz"; as a block, the first eight entries; tall or full screen, search, Tabela /
    Drzewo, sortable columns, and the clicked entry opened below the view (or chosen at the top, when the page
    chooses an entry of that base);
  - it reads the base the way the reader may read it (`pageBase.ts`, step 8).
- **State per module in the address** (`pages/partQuery.ts`): `?<scope>.<key>=…`, where the scope is the last six
  characters of the module id. "Widok" keeps its search, open entry, presentation and sort there. Two views on one
  page keep separate state, and a link carries it. The address is replaced, not pushed, and back and forward are
  followed.
- **Checks:**
  - `app-cogita-check` (360): an old view reads as steps and is written new; a kind by label; everything; follow
    forward twice, backwards along a field and backwards along anything (the question about him); the rule; a
    collection; a topic; search and sort both ways; groups by field and by an axis in its order with the rest
    last; the axes; the short cuts; default columns; the same follow and filter as revision nodes; two module
    scopes in one address.
  - `app-json-check`: the module "view" with its example, keys and round trip.
  - Drives against LocalDB:
    - `views-api.mjs`: an author saves a tree view grouped by an axis, a "children" view that follows backwards,
      and an old-shape view doc.
    - `views-anon.mjs`: a stranger's browser opens the public base, sees all three views in the module picker, and
      gets the same list, the groups in axis order, the children and the old view's entries. Two module scopes stay
      apart in one address.

**Removed**

- The private `ViewDoc` reader and the inline `RuleEditor` of `EntityList.tsx` (both now shared).
- The view's `kind` and `rule` keys on save. Old documents are still read.

**Choices**

- **A view is a list of steps, not a drawn graph.** The steps are the revision's node types with the same configs
  and code, so the two stay one language. A view has one path (source → steps), which a list edits more simply
  than a canvas. Revisions keep their graph, with union, gates and strategy.
- **A page search narrows the saved selection.** It does not replace the view's own query.
- **The canvas mode is not shown on pages.** A page shows it as a table.
- **Scope = the module id, not the placement.** The same module placed twice shares its state, which is the same
  view anyway.
- `entity-table`, `topic-explorer`, `knowledge-map` and the `writings` table stay until step 10 (matrix, inner views,
  converter).

**Owner must run**

- Deploy the website. There is no API change and no migration.

**Test in the browser**

1. Nauka → a base → Wpisy → choose a kind → "Wybór i grupy" → "Drzewo grupuje: według osi tematów …" → Drzewo →
   "Zapisz jako widok".
2. A page → add the module "Widok" → choose the base and that view. Add a second "Widok" with another view. Search
   in one: the other does not change, and the address holds both (`?abc123.q=…`).
3. Open the page in a private window (public base): the same entries, and a click opens the entry below.

## Step 10 — Views, step 2: matrix, inner views, actions; four modules retired

**Built**

- **Sources at the start count together** (`runSteps`): "Kazania" and "Komentarze" (`text` and `comment` of a source
  library) make one view. A source after another step starts anew.
- **Matrix** (`views.ts` `viewMatrix`, `MatrixGrid.tsx`):
  - rows and columns are two groupings: kind, the values of a field, or an axis of topics;
  - an axis lists all its values in their order, also empty ones, so 20 mysteries × 12 periods stays 20 × 12;
  - a cell holds what belongs to both.

  The view document gains `matrix: { rows, cols }` and the modes `matrix` and `map`. A table column can be an axis
  (`#axis:<topic>`): the values the entry belongs to.
- **Wpisy** offers Tabela, Drzewo, Macierz and Płótno. "Wybór i grupy" adds "+ Źródło (razem)" and the rows and
  columns of the matrix. A cell opens below the matrix with its entries, and writers get the actions:
  - **+ Nowy wpis tutaj** (also "+" on an empty cell): a new entry with the cell's context (`viewActions.ts`
    `createHere`). For a library kind, a statement or text goes into the library it draws from (or the one holding
    the topic), with both topics. An entry of the base gets them in its first reference field to topics, and a
    field grouping sets the field.
  - **Dodaj do planu** (pick a sermon): the cell's entries become new points at the end of its plan, with stable
    point ids and the old points kept. A quote is embedded (`![@id]`), anything else becomes a link
    (`[[name|@id]]`).
  - **Powtórka z tego pola**, and in the toolbar **Powtórka z tego widoku**: a revision made of the same steps
    (`viewToRevision`; several sources through "Razem", ending in "Sposób pytania" by knowness). It opens in
    Powtórki.
- **The module "Widok" on a page** (`viewViews.tsx`):
  - table, tree, matrix and map, switchable;
  - **inner views with a path in the address**, under the module's scope: a cell (`c=<row>~<col>`) opens its
    entries, and an entry (`e=`) opens a statement with its blocks (`CommentCard`), a sermon whole with its plan and
    deliveries (`WritingCard`, delivery in `d=`), or anything else as a card;
  - a breadcrumb back ("Widok › row × col › entry"), so the address can be shared;
  - **Ucz się tego**: the cards of what is shown (a cell or the whole view), asked without an account, with
    progress kept in the browser;
  - **Mapa**: the knowledge map's fog over the view's entries, with "Ucz się tego".
- **Retired:** `entity-table`, `topic-explorer`, `knowledge-map` (`retired` on the module definition), and the
  archive's **table** layout.
  - They are gone from the four "add" lists (`palette()`) and from the module list unless still used, where they are
    marked "Wycofany". The JSON help marks them "WYCOFANY".
  - Existing placements keep rendering. An archive set to start as a table keeps its table, and old `?tu=tabela`
    links still work.
- **Converter, Porządki tab 6 "Moduły stron → Widok"** (`library/rebuild/pageModules.ts`). On pages the account
  leads, each retired placement becomes the module "Widok" in the same place, with a saved view (`convertPart`):
  - entity table → table of the kind, with the columns found by their names;
  - topic explorer → tree by the topic as an axis;
  - knowledge map → map of what its revision selects (`stepsOfRevision`);
  - the archive's table → the library's texts (topic and project kept as steps), with the date and the library's
    aspects as columns, newest first. The view lives in a base of the library's area that draws on the library,
    linked or made ("Widoki — <obszar>"). The plan says so, including that such a base in a public area is public
    and holds only views.

  Bases the account only reads, unknown kinds and missing revisions are named and left. The report lists the
  converted pages, and a second run finds nothing.
- **Descriptions:** `courseDescription()` explains views with matrix, axes, axis columns, leading sources and the
  20 × 12 example. The "view" module's `use`, `shows` and example (`macierz`) are updated.
- **Checks:**
  - `app-cogita-check` (374): sources united and restarted; the matrix with every value of both axes; a cell with a
    sermon and a statement; axis columns; cell keys; view → revision (nodes, union, round trip, the plan asks the
    reached cards); a cell's context; a statement created in a cell goes to the library with both topics; an entry
    of the base gets a group's field value; points for quotes and links; add to plan keeps the old points and
    unique ids.
  - `app-library-check` 2h: what is retired; each conversion; problems reported; the palette without the retired
    modules while they still render.
  - Drives against LocalDB:
    - `matrix-api.mjs`: a public library with 20 + 12 topics, sermons and statements, a base drawing on it, the
      matrix view; a page with the view and two retired modules; Porządki converts both, the page has three "Widok"
      modules in place and the views are in the base, and a second plan is empty.
    - `matrix-anon.mjs`: a stranger loads the page, gets 20 × 12, the cell with the sermon and the statement, the
      statement as a library comment, the path in the address, and an empty cell empty.

**Removed**

- `entity-table`, `topic-explorer` and `knowledge-map` from the palettes, and the archive's table from the visitor's
  switch. Their code stays until production pages are converted. The views in `cogitaViews.tsx` and the archive's
  table go in a later cleanup, once the report shows no placements are left.

**Choices**

- **The archive's table, not the whole archive, is retired.** Lista and Drzewo with their aspect chips are the
  archive's own strength. Tables and matrices go to "Widok".
- **A view of library material lives in a base.** Views are base documents, and the converter finds or makes a base
  in the library's area, so readers do not change.
- **"Add to plan" appends points.** It does not rearrange the plan. The author moves them in the plan editor.
- **Create-here for library kinds writes into the library.** Statements live in libraries (decision 5). The base
  only shows them.

**Owner must run**

- Deploy the website. There is no API change and no migration.
- Biblioteka → Porządki → "Moduły stron → Widok": read the plan and run it. Keep the report with the list of
  converted pages.

**Test in the browser**

1. Nauka → a base whose source is the sermons library → Wpisy → "Wybór i grupy": Skąd "Rodzaj: Tekst"; "+ Źródło
   (razem)": "Rodzaj: Komentarz". Then Macierz → rows "Tajemnice", columns the other axis → "Zapisz jako widok".
2. A page → module "Widok" → that view → "macierz". Click a cell: its sermons and statements appear. Click a
   statement: it opens below. Copy the address and open it in a private window: the same cell and statement are open.
3. In Wpisy, an empty cell "+" creates a statement with both topics, and "Dodaj do planu" puts a cell's entries into
   a sermon plan.

## Step 11 — Schema connections: places, ready schemas, sermon ↔ base

**Built**

- **A reference with a place** (decision 12):
  - a Cogita `ref` field can carry `locator: true`, and each value is then `{ value, locator }` (`schema.ts`
    `readField`, `Value.locator`, `kindDoc`);
  - shown by `placeText`: a Bible target gives the place read and written alike with the edition's siglum
    ("Ps 110,1-7 (BT)"), any other work gives "Leksykon, s. 23";
  - the reference index reads such values (`refsOf`), so "Fragment Pisma" finds a psalm of the psalter;
  - the editors: a tick "z miejscem" on a reference field in Schemat, and a place input beside the picker in the entry
    editor (it also works with "uncertain" values);
  - the Bible's text is not stored.
- **Ready schemas** (`schemaStarts.ts`, Schemat → "+ Rodzaj" → "Gotowy schemat"), through the same import as a JSON
  file, with the plan as the question:
  - **Słownik** (decision 11): Język, Słowo (tekst, język), Tłumaczenie (słowa), Synonimy, Antonimy, with four
    "Słówka" templates (both directions, which language, pairs, translate a word);
  - **Psałterz**: the breviary schema (`starts/psalterz.json`, from the breviary fixture) whose psalm or canticle has
    "Miejsce w Piśmie" as a reference with a place.
- **"Z wpisu"** (`source.from`, shared by views and revisions): what one entry points at, in fields, markup, plan
  points or subjects (`SelectContext.refsOf`). In the revision palette, "Wpis (np. kazanie)" picks the text.
- **"Powtórka z tego tekstu"** (library text panel, "Nauka" box; `cogita/fromEntry.ts`). It finds a base that draws
  on the library; failing that, a writable base of the same area, which gets the library as a source. It creates a
  revision "Z kazania: …" (Z wpisu → Sposób pytania) there and opens it in Powtórki.
- **A sermon reaches into knowledge bases:**
  - "Z bazy wiedzy…" in the text and plan editors (`BasePicker.tsx`) links an entry (`[[house|@id]]`, using the
    selection as the words) or embeds a view (`![@view]`, as a block or as a plan point of its own);
  - in the workspace the account's bases are opened in the background, and `LibraryStore.get` also looks there, by id
    only;
  - names of base entries come from their data (`entryTitle` fallback). An opened link shows the entry's values and
    "Otwórz w Nauce";
  - **a live view inside a plan point**: `![@view]` renders `cogita/ViewEmbed.tsx`, loaded on demand. It shows what
    the view selects now and catches up when the base changes in the same tab, so "Psalmy jutrzni niedzielnej"
    follows the psalter.
- **Service:** `GET /library/where` also finds entries of knowledge bases, by the base's rule: a member, or a public
  area **and** an opened base. A page's reach also follows what the markup names (`refsOf`), so a public sermon
  reaches the linked word and the embedded view.
- **Descriptions:**
  - `courseDescription()`: `"locator": true` with an example value, the ready schemas, and `source.from`;
  - `libraryDescription()`: `[[house|@id-słowa]]` and `![@id-widoku]`.
- **Checks:**
  - `app-cogita-check` (383): the option and value survive, Bible and work wording, a psalm labelled by its place,
    "Z wpisu" over a sermon's links and plan, a revision from a sermon asks the right card, both starts import (five
    kinds and four templates, a word's language resolved, the psalter's place field).
  - `app-library-check`: `{value, locator}` in the index, "Fragment Pisma" finding a base entry, names of base
    entries and views, the description.
  - Drives against LocalDB:
    - `schema-api.mjs`: both starts imported; psalms with places; the view of Sunday Lauds; a word and a question; a
      sermon embedding the view and linking both; a fourth psalm appears in the embedded list; the revision from the
      sermon lives in the linked base and asks the question.
    - `schema-anon.mjs`: a stranger's `/library/where` finds the word in the public base but not the closed base's
      entry; the sermon reaches the word; the embedded view shows all four psalms; a psalm reads "Ps 63,2-9 (BT)".

**Removed**

- Nothing. The breviary fixture stays for the checks. The start is its copy with the new field.

**Choices**

- **The place sits on the value, not on the field.** One psalm per value with its own place. It is the same pair as
  the uncertain value's `source: {work, locator}`, but on the value itself.
- **The dictionary is not migrated.** The existing "Słówka" presets already assume Word / Language / Translation. The
  production base is sealed and unseen, and decision 11 says to leave it alone. The start serves new bases.
- **Bases are reached by id only.** Keys stay unique across libraries, not bases (decision 6 leaves base keys to
  their own warning). A key could also leak across stores a reader cannot open.
- **A live view is the base's current selection, not a snapshot.** Printing (LaTeX) shows the view's name, not its
  list.

**Owner must run**

- Deploy the API (`/library/where` for bases) and the website. No migration.

**Test in the browser**

1. Nauka → a base drawing on the sermons library → Schemat → "+ Rodzaj" → "Gotowy schemat — Słownik". Add the language
   "angielski" and the word "house".
2. Biblioteka → a sermon → edit → select "dom" → "Z bazy wiedzy…" → "house". The reader shows "dom" as a link, and a
   click opens the word with "Otwórz w Nauce".
3. In the same base: "Gotowy schemat — Psałterz". Add psalms with "Miejsce w Piśmie" (BT, "Ps 63,2-9") and a place
   "Jutrznia, niedziela, I". Save a view (Wpisy → source "Miejsce w brewiarzu", filter godzina = Jutrznia, + "Idź po
   odwołaniu" teksty). In the sermon's plan, "Z bazy wiedzy…" → that view. The point lists the psalms, and it changes
   when a psalm is added to the place.
4. The sermon's "Nauka" box → "Powtórka z tego tekstu": the revision opens in Powtórki.

## Step 12 — One narrative: a storyboard is a flow in look `scenes`

**Built**

- **Defined first** in COGITA.md §8 ("One narrative"): the storyboard stays in the presentation page, and a knowledge
  base lists it as a flow that points at it: `{ "name", "look": "scenes", "presentation": "<path>", "narrators" }`,
  with no graph of its own. Nothing is copied.
- **The storyboard read as a flow** (`pages/presentation/storyFlow.ts`, `storyToFlow`):
  - a scene becomes a step `scene` (`{ page, scene, title }`) whose exit `next` is its „dalej”;
  - a question on the scene adds the exits `right` / `wrong`, and a button adds `b0`, `b1`, … to its target;
  - a condition gate becomes `condition` (`yes` / `no`), a set gate becomes `set` (`next`);
  - `end` and `link:<id>` become `end` steps, and a link keeps its target.
- **The flow engine** (`cogita/flow.ts`):
  - the new step type `scene`, with its exits, its fields in the editor and its JSON help;
  - `presentation` on a flow;
  - `narrators` (`[{ character, condition }]`, up to 12) and `narratorNow`: the first narrator whose condition holds;
  - a template use keeps its own narrators, otherwise it takes the template's.
- **In Nauka** (`PresentationInNauka.tsx`, loaded only when someone plays one):
  - a presentation flow plays the presentation through its own engine, filling the screen below the header as on its
    page;
  - the learner is the base's (`useStoryRun(show, pageId, given)`: it listens to the given learner and never flushes
    or closes it), so answers, values and the place count in the base;
  - the place is kept under the same key as on the page (`page:<id>`);
  - a box at the bottom left holds the flow's name, the narrator, „edytuj w prezentacji” (for those who may edit the
    page) and „zamknij”.
- **Rule 1:** the page is loaded through the usual page endpoint with the reader's own access (`storyOfPage.ts`).
  Whoever cannot see it gets "[odwołanie niedostępne]".
- **On a page**, the module „Przebieg” with a presentation flow links to the presentation (it *is* a page) instead of
  playing it inside itself (`presentationAs="link"`).
- **Narrators in every flow:**
  - FlowPlayer shows the narrator above the step (portrait or initial, name), and the narrator announces the step's
    title;
  - the editor has „Narratorzy” (a character, a condition, order) next to goals and character lines.
- **A step `scene` in an ordinary flow** shows its title, a link to the presentation (new tab) and „Dalej”.
- **The flow editor** for a presentation flow (`StoryMap`):
  - the path of the page (taken over when the field is left), and the storyboard as a read-only map from
    `storyToFlow`;
  - „Edytuj w prezentacji”;
  - no own graph, template or field-game sections.
- **Adding one:**
  - Przebiegi → „+ Nowy przebieg” → „Z prezentacji — adres strony”;
  - or the presentation editor → Przejścia → Przebieg → „Przebieg w Nauce” (`cogita/presentationFlow.ts`). It finds
    the pointing flow in the story's base or, for someone who writes there, creates it, then opens it in a new tab.
- **Descriptions:**
  - `courseDescription()`: `"narrators"` with an example, the step `"scene"` with its exits, and a presentation flow
    with an example;
  - `pageDescription()`: the same story as a base flow (`"presentation"`, „Przebieg w Nauce”);
  - `exportFlow` takes the narrators' entities along.
- **Checks:**
  - `app-presentation-check` — one narrative. On the storyboard with gates, the flow engine walks the graph from
    `storyToFlow` to the same scenes as `storyChain`, unanswered and answered. A set gate changes the value on the way
    and decides the next condition. A question scene waits in both engines. The answers lead where the question says.
    A button is an exit, a way out is an end that keeps its link, and the scene names its page. Narrators are chosen
    by values, and a flow's path is read without `#/`.
  - `app-cogita-check` (386): template uses and narrators, the exits of a scene step, a presentation flow without its
    own graph.
  - `app-library-check`: the description.
  - Drives against LocalDB:
    - `story-api.mjs`: a public and a closed presentation with a gate, a question and a value. „Przebieg w Nauce”
      creates the flow once, then finds it. The storyboard loads as a flow (four scenes, the gate, the end), and both
      engines go A → B with few points and A → D with enough. At the question, right leads to D and wrong to A. The
      author loads the closed storyboard; a visitor and a signed-in stranger do not ("[odwołanie niedostępne]"). A
      stranger cannot add a flow to the base.
    - `story-browser.mjs` (headless Edge, the built app):
      - Nauka plays the presentation with the box and the narrator chosen by values (0 points: Piotr, not Maria);
      - „dalej” goes through the gate to the question;
      - after leaving Nauka, the public page resumes at the question (the same place);
      - a right answer on the page leads to D;
      - the flow editor draws the storyboard as a map;
      - no console errors.

**Removed**

- From COGITA.md, the "Not yet" lines about flows running apart and Przebiegi not listing presentations. From
  INTERACTIVE.md, the line saying that `scenes` flows only render as reading (it now applies only to flows with a
  graph of their own).

**Choices**

- **Pointer, not copy.** A presentation flow stores only the path. The storyboard stays plaintext in the page, so a
  public presentation keeps working for every visitor, and the base and the page cannot drift apart. The flow graph is
  derived each time it is shown.
- **One engine plays it.** Nauka renders the presentation itself rather than walking the derived graph step by step.
  The derived graph is the editor's map and the proof (checked) that both engines agree. Drawing a single scene
  inside an ordinary flow is left open.
- **The learner chooses where answers go.** In Nauka they go into the base, as for any flow. On the page the existing
  rule stays: the person's private area, or the page's named area, and otherwise the browser. The page never sends
  progress into someone else's area by itself. A person without a private area therefore continues across page and
  Nauka only once they have one (the calendar creates it).
- **The place resumes inside the current route.** A scene past a question that waits is not resumed, which is the
  2026-10-21 rule: coming back asks again.
- **On a page, a link.** A presentation inside a page module would be a page inside a page.

**Owner must run**

- Deploy the website. No migration, no API change.

**Test in the browser**

1. Prezentacja → Przejścia → Przebieg: „W Cogicie”, pick a base → „Przebieg w Nauce”. A new tab opens the flow in
   Przebiegi with the storyboard drawn as a map and „Edytuj w prezentacji”.
2. Add a narrator under „Cele (zadanie), narratorzy i postacie” (any entry), save, then Nauka → the flow → „Zacznij”.
   The presentation fills the screen; at the bottom left are the flow's name, the narrator and „zamknij”.
3. Go to the question scene and close. Open the presentation page itself: it resumes at the same scene. (The account
   needs a private area, which the calendar creates.)

## Step 13 — Quantities and units

**Built**

- **The quantity module** (`core/quantities.ts`, pure, no React):
  - a QUDT subset: seven base dimensions, 33 quantity kinds and 135 units, each unit with its factor (and offset) to
    SI;
  - ids are QUDT's local names (`Torque`, `Energy`, `Mass`; `N-M`, `KiloN`, `DEG_C`), and labels are Polish;
  - two kinds may share a dimension: torque and energy are both M L² T⁻². `N·m` measures torque and, ambiguously,
    energy; `J` measures only energy;
  - reading what people type: "12 N·m", "12Nm", "1,5 kN", "−3,2e3 J", "1,5·10³ Pa", "12 000 kg", "20 °C", "45°".
    Letter case matters where it must (mm / Mm, km / KM);
  - conversion to and from SI, a kind from a unit only when the unit is unambiguous, text for answers and readouts,
    and a description for AI.
- **Questions** (Cogita `question`, the card step „Odpowiedź: liczba”, and the page module „Pytanie”):
  - a number question may name its `quantity`; then the answer is compared in SI and only within that kind;
  - a torque of 12 N·m accepts "12 N·m", "12 Nm", "0,012 kN·m" and a bare "12" (in the question's unit);
  - it rejects "12 J", and the verdict says why: „„J” to jednostka wielkości: energia (praca, ciepło) — a pytanie
    dotyczy wielkości: moment siły.” An unknown unit is named too;
  - right answers may be written with a unit, and the tolerance is in the question's unit (temperatures with their
    offset: 68 °F is 20 °C);
  - the page module gains `unit`, `quantity` and `tolerance` (it had none). Its editor loads the unit list only when
    opened (`questionNumber.tsx`), so pages do not carry it.
- **Number fields** (decision 15: the entered value and unit, plus SI):
  - a field may name its `quantity` beside its display unit, and the schema editor offers the kinds („Wielkość”);
  - a value is typed in any unit of the kind and stored as typed with SI: `{ "value": 1.5, "unit": "KiloN",
    "si": 1500 }`;
  - lists, cards, sorting and filters read the number in the field's unit (1500). It is shown as typed („1,5 kN”);
  - a filter may name a unit („masa > 2 kg” over a field in grams);
  - the entry editor takes "1,5 kN" and refuses "15 J" for a torque with the reason, and add-form rows do the same.
- **Migration at read time, nothing rewritten:**
  - a number field or question without a quantity takes the kind of its unit where the unit is unambiguous ("kg"
    → mass, "m/s²" → acceleration);
  - "N·m" stays without a kind (the old check, where only the number counts) until the author picks one. Both
    editors say so: „„N·m” może znaczyć: energia albo moment siły — wybierz”;
  - old plain numbers stay; they are in the field's unit;
  - a card's fingerprint does not change, so progress stays.
- **Labs:** the engines keep computing in SI, and their data stays engine data (decision C.10). `lab/LabFrame.tsx`
  `labQuantity(si, unitId, digits)` shows an SI value in a unit of the shared list. The particle lab's inspector uses
  it for temperature, pressure, mass, velocity, density and specific enthalpy (a new kind `SpecificEnergy`).
- **Descriptions:** `courseDescription()` explains `"quantity"` on fields and questions, the stored envelope, an example
  field and value, and lists every kind with its units. The page JSON help describes the module's `unit`, `quantity`
  and `tolerance`.
- **Checks:**
  - `app-cogita-check` (415):
    - the module is consistent: every unit measures known kinds of one dimension, every kind has its SI unit, ids
      are unique;
    - spellings, case, exponents, reading, SI both ways with an offset, guessing only when unambiguous, no
      conversion across kinds, text, the description;
    - the step's test: torque in N·m accepted (also "12", "Nm", "kN·m", "mN·m") and "12 J" rejected with the
      reason;
    - the legacy question with "N·m" unchanged, "kg" giving mass (2000 g right, 2 m wrong), answers written with
      units, temperature offsets, an unchanged fingerprint;
    - fields: the quantity kept, written back and dropped when unknown; the envelope, reading in the field's unit,
      showing as typed, add-form rows, filters in other units.
  - `app-json-check`: the module's new keys are in its example and described.
  - Drives against LocalDB:
    - `quantity-api.mjs`: a course with a torque field and question imported. Values come back from the service as
      typed with SI. The stored question accepts N·m and rejects J. The export carries the quantity and the envelope,
      and a second base reads the same.
    - `quantity-browser.mjs` (headless Edge, a visitor on a public page): "12 J" is wrong with the reason; "12 N·m"
      and "0,012 kN·m" are right.
    - `quantity-editor.mjs`: the entry editor shows "0,012 kN·m" as typed and labels the field „N·m (moment siły)”.
      It refuses "15 J" with the reason; "15 N·m" is saved and shown again after a reload.

**Removed**

- Nothing.

**Choices**

- **QUDT ids, a small list.** The local names keep the vocabulary shared and recognisable for AI and for imports.
  The list covers school and workshop physics, chemistry basics and what the labs show. More units are one line each.
- **N·m is ambiguous on purpose.** QUDT lists N·m for torque and energy. A torque question still rejects J (energy
  only); an energy question would accept N·m. Without a chosen kind, the old number-only check stays.
- **The number in the field's unit is what everything else reads.** The entered form and SI ride beside it
  (`Value.entered`, `Value.si`). Nothing that sorted, filtered or built cards from numbers had to change.
- **Labs: readouts only.** Inputs already convert at the engine boundary (°C → K in the particle lab). The lab2d and
  physics labs have uncommitted work by the parallel lab session; their readouts can switch to `labQuantity` without
  touching an engine. Interactive drawings keep display units (`vars[].unit`).
- **Library amounts** (`libraryJson.ts` `readAmount`, "205 mm" stored as 205) are book data, not Cogita fields, and
  stay as they are.

**Owner must run**

- Deploy the website. No migration, no API change.

**Test in the browser**

1. Nauka → a base → Schemat → a kind → a number field: unit "N·m", „Wielkość” = moment siły. In Wpisy, type "1,5 kN·m"
   into the field (it stays "1,5 kN·m"), then try "15 J" (refused, with the reason).
2. Wpisy → new Pytanie: form "number", answers "12", unit "N·m", „Wielkość” = moment siły. In Powtórki (or a page with
   the module „Pytanie”, form Liczba, same settings) answer "12 J": "Niestety nie" with the reason. Then "0,012 kN·m":
   "Dobrze!".

---

# Part two: three parts — Library (sources), Cogita (knowledge), Scriptorium (writing) (2026-10-23 →)

The owner's task "Three parts: Library (sources), Cogita (knowledge), Scriptorium (writing)" replaces parts of the
steps above:
- the Library keeps only works, quotes, persons and files;
- Cogita holds the owner's own schemas, without built-in content kinds or topics;
- the new Scriptorium (`app.library.kind = 'writing'`) holds texts, deliveries, projects and the owner's text types;
- references run one way: Scriptorium → Library and Cogita, Cogita → Library, Library → Library.

All current content is test data, so no old content is migrated. The rule "no user data is deleted" is lifted only for
the owner's explicit, confirmed deletions.

## P1 — Safety check and delete tools

**Safety check (section 3.1)**
- One read-only query ran on production (in a transaction that was rolled back). It found four containers:
  - "Biblioteka": books, 14 entries, written before writers were recorded;
  - a knowledge base: 20 entries, one writing account, one learning batch;
  - a knowledge base: 26 entries, one writing account;
  - "Kazania, konferencje i rekolekcje": books, 210 entries, one writing account.
- Migration 0123 is applied there.
- The permission guard blocked the second query: members of the areas, writers, learners and pages using the
  containers, printed as counts only. The owner then confirmed that all four containers and the pages built on them
  are his, so every step goes ahead.

**Built**
- **Many entries deleted at once:**
  - `POST /workspace/library/{id}/entries/remove` (`Library.cs`, up to 500 ids, write access) removes each entry as
    a single delete does: the last envelope stays as a version, and the row becomes a tombstone for sync. All of it
    runs in one transaction;
  - `LibraryStore.removeMany` sends packets of 200.
- **Selecting in the Library's lists** (`library/EntryPick.tsx`):
  - own entries get a checkbox, and Esc clears the selection;
  - a bar at the bottom offers "Zaznacz wszystkie", "Odznacz" and "Usuń (N)";
  - the question before deleting says how many other entries point at the chosen ones;
  - Cogita's Wpisy already had this (`EntitySelection.tsx`).
- **"Stare wpisy"** (`library/OldEntries.tsx`) lists entries of kinds this version no longer knows, with their name
  and old kind, to select and delete. The tab appears in a library only when there are such entries; that happens
  from P2 on. Cogita gets the same list in P4.
- **Deleting a whole library or knowledge base** with all its entries, files, learning batches and versions already
  existed. It sits in Ustawienia: type the name, then "Usuń na zawsze". The Scriptorium gets the same in P3.

**Checks**
- All check scripts and both builds pass.
- `clear-api.mjs` (LocalDB):
  - seven entries are written;
  - a stranger's batch delete is refused, and an empty request too;
  - five are removed at once, and only two remain on the service;
  - then the library and a knowledge base are deleted whole.

**Owner must run**
- Deploy the API and the website.
- Then delete the test data in the browser:
  - Biblioteka → the library → Ustawienia → "Usuń bibliotekę";
  - Nauka → a base → Ustawienia → "Usuń bazę wiedzy";
  - or only some entries: tick them in a list → "Usuń".

**Test in the browser**
1. Biblioteka → a library → Osoby: tick two entries, "Usuń (2)", confirm. Both are gone.
2. Biblioteka → a test library → Ustawienia → type its name → "Usuń na zawsze". The list no longer shows it.
3. Nauka → a test base → Ustawienia → "Usuń bazę wiedzy" → type its name → "Usuń na zawsze".

## P2 — The Library holds sources only

**Built**
- **Kinds** (`libraryKinds.ts`): the Library keeps `work`, `quote` and `person` (`LIBRARY_KINDS`). Texts, deliveries
  and projects are `WRITING_KINDS`; they move to the Scriptorium in P3. Works, quotes and texts lose their `topics`
  field.
- **Tabs** (`LibraryView.tsx`): Źródła, Cytaty, Osoby, Mapa, Import / eksport, Ustawienia. "Stare wpisy" appears only
  while the library still holds entries of other kinds. A new entry can only be of a source kind; the editor shows a
  notice with a link to "Stare wpisy" for an old one instead of a form.
- **Format** (`libraryJson.ts`): `recreatio/library` version 3 takes only work, quote and person. One machine serves
  every part's format (`FormatSpec`). A file with other kinds is refused as a whole, with where each kind belongs:
  - texts, deliveries, projects: the Scriptorium, format `recreatio/scriptorium`;
  - comments: the Cogita template `templates/cogita/komentarz.json`;
  - topics: there are none; the owner's own kinds take their place.
- **The description for an AI** (`libraryDescription()`) describes sources only. The markup description moves to the
  Scriptorium in P3.
- **Quotes of a book** (`libraryQuotes.ts`, `QuoteIntake.tsx`): format `recreatio/quotes` version 3, without
  `topics` and `comment`. An older file is still read. Its old fields are named in a warning and not saved; an old
  comment is shown under "Do sprawdzenia" before saving, so nothing disappears unseen. The prompt asks the AI to put
  a handwritten note in `check`.
- **Page module "Zbiór cytatów"**: "Tylko ze źródła" (a work) instead of "Tylko z tematu". The large view offers the
  works as chips. A page with the old `topic` setting shows all quotes.
- **Map and relations**: the Library map has quote, work and person columns. The relations box no longer offers
  "+ Komentarz".
- **Confirming the area rule** without Porządki: Ustawienia → "Kto widzi" shows a box for a library created before
  0122. It says who reads the library afterwards (in a public area: everyone, with the number of entries). Confirming
  needs a ticked "Rozumiem, kto będzie to widział".
- **Old copies in a knowledge base** without Porządki (`cogita/oldCopies.ts`): Ustawienia → "Kto czyta" →
  "Wycofaj stare kopie". It withdraws old public versions and old file copies. It removes a copy stored in an entry
  only when everything the copy shows still exists, and says how many copies stay and why. While copies stay, the
  base cannot be opened for everyone.
- **Contributions** (Cogita → Propozycje): an accepted proposal stays in the base. It no longer becomes a Library
  comment.

**Removed, and why**
- Porządki (`library/rebuild/*`, `LibraryTidy.tsx`, `libraryMigrate.ts`, `libraryTidyRun.ts`). They converted old
  content into topics and comments in the Library, which no longer exist, and all content is test data (no
  migration). The two parts still needed (the area rule, old copies in a base) are now in the settings, as above.
  The converter of retired page modules went with them; a retired module now says which module replaces it.
- The Library's `topic` and `comment` kinds, in the editor, tabs, map, format and description.

**Kept for now, and why**
- The `topic` and `comment` definitions stay as `COGITA_LEGACY_KINDS`, only so that Cogita can build its two
  built-in kinds from them. Cogita drops the comment in P4 and topics in P5; then these definitions go too.
- The text, delivery and project editors stay in `library/` until P3 moves them to the Scriptorium. Until then they
  open only in a `writing` container, which cannot be created yet.

**Checks**
- All check scripts and both builds pass; the style ratchet is locked one lower (`wk-hint` 568).
- `app-library-check`:
  - the library kinds are only sources, and their references point only at sources;
  - a file with text, delivery, comment and topic entries is refused, naming the Scriptorium, the Cogita template
    and "no topics";
  - quotes format 3: old `topics` and `notes` are named and not saved, and only the quote is written;
  - old copies are withdrawn without Porządki, a copy that is the last trace stays, and the action can be repeated;
  - retired page modules say what replaces them.
- `sources-api.mjs` + `sources-browser.mjs` (LocalDB, headless Edge, the built app):
  - the tabs are Źródła, Cytaty, Osoby, Mapa, Import / eksport, Ustawienia and, while old entries exist, Stare wpisy;
  - Stare wpisy lists a text, a delivery, a project, a comment and a topic, and says where such things live now;
  - all five are deleted after a confirmation, and then the tabs are exactly the six;
  - an old file with a text and a comment is refused in Import / eksport;
  - the settle box says that everyone will read the 5 entries; after confirming it says "wszyscy";
  - no console errors.

**Owner must run**
- Deploy the website (no API change in P2).
- In each library: open "Stare wpisy" and delete what is there once the Scriptorium (P3) has what is still needed.
  The old entries cause no harm meanwhile.

**Test in the browser**
1. Biblioteka → the library: the tabs are Źródła, Cytaty, Osoby, Mapa, Import / eksport, Ustawienia (and Stare wpisy
   while old texts, comments or topics are there).
2. Stare wpisy: tick everything → "Usuń (N)" → confirm. The tab disappears.
3. Import / eksport: paste `{"format":"recreatio/library","entries":[{"kind":"text","data":{}}]}`. The message names
   the Scriptorium.
4. A book → "Cytaty z tej książki" → JSON: the copied prompt no longer asks for topics.

## P3 — The Scriptorium

**Built**
- **Container** (migration `0124_scriptorium.sql`): `app.library.kind = 'writing'` is allowed. The service:
  - creates at most one Scriptorium per area, as with the Library;
  - opens a Scriptorium in a public area to everyone (`/library/{id}/open`), like a library, and `/library/where`
    finds entries in it;
  - moves entries only within one part: Scriptorium to Scriptorium, Library to Library, base to base. A move from a
    knowledge base into a library (a statement becoming a comment) is gone, because the Library holds no comments.
- **Workspace** (`scriptorium/ScriptoriumView.tsx`, `#/workspace/scriptorium`): the menu reads Biblioteka,
  Skryptorium, Nauka. Under Skryptorium are the list of Scriptoria and a create form; the area picker leaves out areas
  that already have one and warns when the area is public. A Scriptorium has the tabs Teksty, Wygłoszenia, Projekty,
  Rodzaje tekstów, Import / eksport and Ustawienia, plus Stare wpisy while it holds other kinds. Texts can be
  filtered by type, and every list has select and delete. Ustawienia has rename, who reads it, and delete with the
  typed name.
- **Editors moved from the Library** to `scriptorium/`: the text editor (Plan / Treść / Dalsze informacje, pickers,
  preview), deliveries with coverage, projects with outline, LaTeX and "Plan na ambonę", the AI prompts (now answered
  in `recreatio/scriptorium`), the archive and the page card. Autosave is one hook for both parts
  (`library/entryDraft.ts`). The plan editor no longer offers "+ Komentarz do punktu", since comments become a Cogita
  kind in P4.
- **Text types** (kind `texttype`; the service accepts only lower-case kinds):
  - a type has a name, a description and extra fields;
  - the fields are edited with the same schema editor as Cogita: `KindForm` was moved out of `SchemaEditor.tsx`
    into `cogita/KindForm.tsx`, and both use it;
  - for a text type the editor offers line, text, number, date, bool, choice, ref, url and list (no media, map,
    range or markup), no "uncertain", no label pattern, and refuses the keys of the core text fields;
  - a ref field can point at a Cogita kind of any readable base, or at work, quote, person or text;
  - a text of a type fills its fields with the same field inputs as Cogita (`TypeFields.tsx`). It sees Nauka
    through a read-only lens (`scriptorium/lens.ts`), which never creates Cogita entries;
  - texts show the fields as "Tajemnica: Zwiastowanie" in the article, the preview, on pages and in LaTeX;
  - a target the reader cannot open shows nothing, not even its name.
- **Format** `recreatio/scriptorium` v1 (`scriptoriumJson.ts`), with the Library's import engine:
  - it takes texttype, text, delivery and project, and refuses sources, comments and topics, naming where they go;
  - in a text type, a ref field's targets may be Cogita kind names ("Tajemnica");
  - in a text, values of type fields may be Cogita entries by name ("Zwiastowanie"), places as
    `{ "value", "locator" }`, numbers with units;
  - unknown fields and names are reported;
  - `scriptoriumDescription()` (Polish) describes all four kinds, text types with a worked example ("Kazanie
    maryjne" with Tajemnica, Obszar and a Scripture place), the markup and Scripture places.
- **Pages**:
  - `writing` and `writings` read a Scriptorium through the key `scriptorium`. An older page with `library` still
    renders, because `read()` falls back to it;
  - the new field kind `scriptorium` picks one in the page editor and the module manager;
  - `pageDescription()` gains the rule: short copy stays in the module, longer texts live in the Scriptorium and
    are shown with `writing` or `writings`.
- **Moving a text** ("Kto widzi"): a text moves only to another Scriptorium; this is how it becomes public. Its text
  type can go along (a checkbox), otherwise readers there do not see the type's fields.
- **Paths** follow the part (`containerPath`): search hits, relations, pickers, Cogita origins, the dependency map.
  The Library's address for a Scriptorium points to it.

**Fixed on the way**
- Footnotes on a page are now counted again when the cited library arrives after the text (`Lookup.revision`). A
  text in the Scriptorium citing the Library showed "[brak źródła]" until a reload.

**Kept for now, and why**
- The archive module (`writings`) still has its topic facets. Texts carry no topics, so they stay empty. P5 decides
  the archive filters.
- The Library's comment display pieces stay until P4 turns comments into a Cogita kind.

**Checks**
- All check scripts and both builds pass; Api.Tests 472. The style ratchet is locked at `wk-hint` 567.
- `app-library-check`: the Scriptorium format, text types, rendering, export → import round trip and the AI
  description:
  - all writing examples import next to the Library's sources, text types first;
  - text-type targets resolve by Cogita kind name; core keys, markup and unknown kinds are refused with warnings;
  - text values resolve by entry name, places, numbers and several values; unknown names are reported;
  - the article and LaTeX show the type fields; an unreadable target shows nothing, not even its id.
- `scriptorium-api.mjs` (LocalDB), 14 checks:
  - one Scriptorium per area;
  - a stranger is refused;
  - a text moves from the closed Scriptorium into the public one, but never into the library;
  - without an account the public Scriptorium opens and the closed one does not;
  - `where` never reveals the hidden entry;
  - page modules read the `scriptorium` key, and an older `library` key still works.
- `scriptorium-browser.mjs` (headless Edge, built app), the step's test:
  - the menu order is right;
  - a new text type is made in the UI; its field type offers "→ Tajemnica (Różaniec)" from Nauka;
  - a sermon of that type is written in the UI: the Tajemnica is picked from Nauka and the quote cited, and the
    preview shows "Tajemnica: Zwiastowanie" and the footnote Łk 2,19;
  - a delivery is recorded;
  - a visitor without an account sees the sermon on a page with its Tajemnica, the quote and the delivery, and
    nothing of the entry in the closed base;
  - footnotes resolve;
  - an older page still renders;
  - no console errors.

**Owner must run**
- Apply migration 0124 (`dotnet Api.dll migrate`), then deploy the API and the website.
- Create a Scriptorium (Skryptorium → "Załóż") in each area that writes texts. Old texts in a library are
  "Stare wpisy" there and can be deleted (test data, no migration).

**Test in the browser**
1. Skryptorium → "Załóż" (your private area) → Rodzaje tekstów → "+ Rodzaj tekstu": name "Kazanie maryjne",
   "+ pole" key `tajemnica`, type "→ Tajemnica (…)" (a kind of one of your bases) → "Zapisz rodzaj tekstu".
2. "+ Tekst tego rodzaju": a title → "Zapisz"; under "Dane tekstu" choose the Tajemnica; in Treść write
   `[@klucz-cytatu]`. The preview shows the Tajemnica and the footnote.
3. "+ Wygłoszenie" → "Zapisz". The text lists the delivery.
4. A page → module "Tekst ze skryptorium" → choose the Scriptorium and the text. If the area is public, a visitor
   sees it.
