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
