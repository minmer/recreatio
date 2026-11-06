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

## P4 — Cogita without built-in content schemas

**Built**
- **A statement is any entry whose kind has a field of the new type `blocks`** ("Treść w blokach": paragraphs, lists,
  tables with real references). There is no built-in kind for it any more. The rules live in one place for Nauka,
  the Scriptorium and pages (`library/blocks.ts`, renamed from `comment.ts`; `library/statement.ts`;
  `cogita/statements.ts`):
  - the thesis is the first sentence of the first paragraph of the first `blocks` field; it names the entry;
  - a thesis ending in "?" makes the entry a question; it is answered as soon as another readable statement points
    at it;
  - the badge Informacja / Interpretacja is computed only from what the statement points at: its cells, the
    references in its paragraphs and its reference fields (such as "O czym"). Only sources of the Library →
    Informacja; another statement, or no source at all → Interpretacja. "A table makes an interpretation" is gone;
  - nothing of this is stored.
- **Editing**: `blocks` is a field type in the Cogita schema editor. The entity editor edits it with the block editor
  (moved out of `library/CommentForm.tsx`, now `library/BlocksEditor.tsx`). A reference in a cell picks any entry of
  the base or a source of a library. Under the field: the thesis and whether it is a question; above the fields: the
  computed marks.
- **Cards**: the nodes Teza, Część treści, Tabela z treści and O czym jest work on any kind with a `blocks` field;
  "O czym jest" reads the entry's reference fields with their places. The presets "Teza: o czym → teza" and "Tabela z
  treści: dopasuj pary" are offered for every such kind, whatever its name.
- **Pickers** that asked for "komentarz albo wiedza" (a flow line's "co mówi", the node "Wyjaśnienie", "Z wpisu")
  now name the placeholder `@blocks`, which becomes the statement kinds of the base. A flow shows any entry with a
  `blocks` field whole.
- **Templates are files** in `templates/cogita/`, imported like any schema (Schemat → "Schemat jako JSON" → Import);
  nothing of them is in the frontend:
  - `komentarz.json` — the kind Komentarz: `about` "O czym" (references with a place, several, to any kind in any
    store the base reads) and `content` "Treść" (`blocks`), named by `{content}` (its thesis); with the card
    templates "Teza" and "Tabela z treści";
  - `slownik.json` — the former ready schema Słownik, written from the same presets;
  - `psalterz.json` — moved from `cogita/starts/`.
- **"Stare wpisy" in Nauka** (a tab, shown only while there are any): entries of the gone built-ins `knowledge`
  (also entries with no kind at all, which used to count as Wiedza) and `comment`, and saved changes of those
  built-ins. List, select, delete — the Library's own list. Only these named kinds count: an entry whose kind lives in
  a source this account cannot read right now is not "old". A saved change of a gone built-in no longer turns into a
  nameless kind of its own.
- **Proposals** (Zaproponuj): a reader proposes a question or an entry of a statement kind of the base (the text
  becomes its first paragraph, the chosen entry its first reference field). An old "Wiedza" proposal can only be
  rejected.
- **Views**: "+ here" in a cell makes a statement as an entry of the base; a text goes to a Scriptorium the base
  draws on (before P3 it went to a library).
- **AI descriptions** (`courseDescription`, `aiPrompt`): the `blocks` type with an example (a comment about Łk 1,35
  with a table), statements on any `blocks` kind, the template files, no knowledge or comment kinds. The prompt
  "wypowiedzi" replaces "wiedza"; when the base has no statement kind yet, the prompt brings the Komentarz kind along.

**What stays built in, and why**
- `question` (Pytanie): cards, sessions, flows, proposals and the page module "Pytanie" ask it, and its fields are
  the answer forms the checker knows (text, number with units, choice, pairs, code, a drawing…). It is offered as
  "+ Pytanie" in Wpisy, no longer as a "ready kind" in the schema.
- `work`, `quote`, `person` (Library) and `text`, `delivery`, `project` (Scriptorium): kinds of the other parts.
  References, templates and revisions over library material read their fields; they are not content schemas of a
  base.
- `topic`: until P5, which removes topics.

**Removed, and why**
- The built-in kinds Wiedza (`knowledge`) and the library's Komentarz (`comment`); the schema menu "Gotowy: Temat /
  Wiedza / Pytanie" (`missingBuiltins`, `addBuiltin`) and "Gotowy schemat — Słownik / Psałterz"
  (`cogita/schemaStarts.ts`, `cogita/starts/`). Decision 2: a base has only the kinds its owner writes or imports.
- `library/CommentForm.tsx`: statements are written in the entity editor.
- Comments at the points of a plan, and on the pulpit sheet; "Komentarze (n)" under a quote. A statement says in its
  own fields what it is about; the relations box ("Powiązania") shows everything that points at an entry.

**Checks**
- All check scripts and both builds pass; Api.Tests 472. The style ratchet is locked at `wk-hint` 566 (one shared
  element for a field's description in the entity editor).
- `app-cogita-check` (426):
  - the Komentarz kind from the file;
  - which kinds are statement kinds, and the `@blocks` placeholder;
  - what a statement is about;
  - cards from the file's own templates, which equal the presets;
  - no knowledge or comment built-ins, and a change of one is no kind;
  - which entries are "Stare wpisy";
  - sources and views rewritten with own kinds; a text made in a cell goes to the Scriptorium;
  - the three template files import.
- `app-library-check`:
  - statements as entries of a base: roles from references (a table alone no longer makes an interpretation; "O
    czym" counts), the marks, the reference index, embedding in a text with the cycle guard;
  - no statements at plan points.
- `komentarz-api.mjs` (LocalDB): a library with the Bible, a base drawing on it, an old Wiedza entry and an old change
  of the built-in. Without `UI_IMPORT=1` it also imports `komentarz.json` and reads the kind back from the service.
- `komentarz-browser.mjs` (headless Edge, built app), the step's test, 17 checks:
  - Schemat offers only "+ Rodzaj";
  - `komentarz.json` is imported in the UI (the plan: one kind, two templates, no warning);
  - a comment is written in the UI: "O czym" = the Bible at Łk 1,35; a paragraph; a table whose cells point at
    Łk 1,35 and Dz 1,8;
  - the editor names the thesis and marks it Informacja; it is saved, and the places and the table come back from
    the service; the list names it by its thesis;
  - Nauka counts two cards and makes "Powtórka codzienna"; the thesis card asks "Co mówi ta wypowiedź o: Łk 1,35?"
    and shows the thesis; the table card pairs Łk 1,35 – Dz 1,8 and Maryja – Apostołowie and is judged right;
  - "Stare wpisy" lists the old Wiedza entry and the old change, and not the comment;
  - no console errors.

**Owner must run**
- No migration. Deploy the website.
- In a base that used Wiedza or library comments: import `templates/cogita/komentarz.json`. Old entries are under
  "Stare wpisy" (in Nauka and in the Library); review them and delete them (test data, no migration).

**Test in the browser**
1. Nauka → a base → Więcej → Schemat → "Schemat jako JSON — kopia do innej bazy wiedzy" → Import → "Wczytaj plik…"
   → `templates/cogita/komentarz.json` → "Importuj schemat".
2. Wpisy → "+ Wpis" (kind Komentarz). "O czym" → "+ wartość" → search "Biblia" → place "Łk 1,35". Treść → "+ Akapit":
   "Duch Święty zstępuje dwa razy. …"; "+ Tabela": in a cell "+ odwołanie" → the Bible → "Łk 1,35", next cell
   "Dz 1,8" → "Zapisz". The entry is named by its first sentence and marked Informacja.
3. Nauka → "Utwórz „Powtórkę codzienną” ze wszystkich kart" → the card "Co mówi ta wypowiedź o: Łk 1,35?" →
   "Pokaż odpowiedź" shows the thesis.

## P5 — Views without topics

**Built**
- **An axis is a kind** (`cogita/selection.ts`: `Axis`, `axisValues`, `axisMembers`). A grouping
  `{ by: "axis", kind, via, through, sort, group }` replaces the grouping by a topic axis:
  - the values are the entries of the kind (own entries, or entries of a source);
  - they are ordered by a number field of the values (`sort: { field: "numer" }`), or by the order in which another
    entry lists them in a multi-ref field (`sort: { list, field }`), otherwise by name;
  - `group` is a ref field of the values. The values then stand under headings (Tajemnica by "Część", Obszar by
    "Grupa"), in the order of their first value;
  - an entry belongs to a value if it points at it through a chosen ref field (`via`; empty means any ref field), or
    one step further (`through`: first through this field to another entry, which points at the value);
  - a value belongs to itself.
- **Matrix and tree**:
  - the matrix shows a heading row over the columns (each heading spans its columns) and a heading row where a new
    row heading begins, in the workspace and on pages (`MatrixGrid`);
  - the tree in Wpisy shows the headings too;
  - a column `#axis:<kind>` lists the values of that kind an entry points at.
- **Editing an axis** ("Wybór i grupy" → `AxisSettings`):
  - "Drzewo grupuje", "Macierz — wiersze" and "Macierz — kolumny" offer kinds with entries ("według osi — rodzaju");
  - for an axis: the field an entry belongs through (or any), one step further (no / any field / a field), the order
    (by name / by a number field / by the list in another entry's field, with that entry picked), and the headings
    field.
- **Text types are kinds in Nauka** (`textTypeKind`). The text types of a Scriptorium the base draws on are kinds of
  the base:
  - a text carries its type as a second kind, so its type fields (`tajemnica`, `obszar`) stand next to the fixed
    ones. Views group by them, matrices place sermons by them, and filters, columns and templates read them;
  - they are kinds of another part (`isForeignKind`): they can be pointed at and learned from, never created in the
    base. "+ Wpis" in Wpisy no longer offers a foreign kind;
  - **Scriptoria are sources of a base** next to libraries and other bases (Ustawienia → Źródła names them; the
    revision source "Rodzaj … z …" lists them).
- **"+ here" in a cell** (`createHere`):
  - the values of both axes go into fitting ref fields: first a chosen `via` field, then a field pointing at the
    value's kind, then a field pointing at any kind ("O czym");
  - a sermon of a text type is created in the Scriptorium that holds the type, with the values in the type's fields.
- **The archive (`writings`) filters by the ref fields of the text types**, not by aspects. Every ref field of a text
  type is an axis (the same key in several types is one axis), and its values are the entries the texts point at, by
  name. A target the reader cannot open is not a value. Projects stay an axis. Lista, Tabela and Drzewo work on
  these axes. **Decided: the archive stays its own module, not a preset of "Widok"**: a visitor needs only the
  Scriptorium, no knowledge base, and the Widok module already gives the table and matrix over Nauka.

**Removed, and why** (decision 1: no topic mechanism at all)
- The Library kind `topic` with `aspect` and `order`. `library/topics.ts` and `TopicPick` / `TopicsField` are
  deleted. Old topic entries are listed under "Stare wpisy" in the Library, the Scriptorium and Nauka.
- The last `topics` field (the delivery form). Works, quotes and texts lost theirs in P2 and P3.
- The "Perspektywy" axis. Ustawienia mentions old perspectives only when a base still has some.
- The Cogita built-in `topic` with its learning extension: Odpowiedzi, Dotyczy, Głębokość, Próg, Wymiar, Do
  rozwinięcia, the "+ Pola nauki" button, and topic cards. A saved change of the topic built-in, or an import with
  `"builtin": "topic"`, is skipped and named.
- The revision source `source.topic`. An old revision says: "Źródło „Temat” już nie istnieje — tematów nie ma.
  Wybierz rodzaj, zbiór albo listę." An old view step "Temat" becomes an empty list with the same notice.
- Every grouping by a topic axis. An old view says so in Wpisy and on its page ("Macierz miała osie z tematów…")
  instead of failing or showing nothing.
- The topic tree in Wpisy (topics nested by their parent).
- **Features that depended on topics:**
  - ExploreMap (Mapa) now works on owner kinds: the entries of a chosen kind (or all own kinds) with their ref
    links and the confirmed dependencies.
  - "Do zrobienia": the "Tematy do rozwinięcia" list is removed. Open questions are statements whose thesis ends
    with "?" ("Pytania bez odpowiedzi", P4). "Do sprawdzenia" now covers statements whose targets changed. A
    parallel question becomes a statement (the question as its thesis, pointing at the entry), not a topic.
  - Archive filters: as above.
  - The page module "Tematy" (`topic-explorer`, retired since step 10) now shows only a notice on pages that still
    have it.
  - The archive module's setting "Tylko z tematu" is dropped; an old setting is ignored.

**Checks**
- All check scripts and both builds pass; Api.Tests 472. The style ratchet is locked at `wk-hint` 565.
- `app-cogita-check` (431):
  - text types as kinds: a second kind, fields next to the fixed ones, foreign, material;
  - no topics: no built-in, an old revision node and an old view step named, old topics in "Stare wpisy";
  - axes: order by a number field and by another entry's list, headings, membership through one field, one step
    further, axes = kinds with entries, a topic grouping read as none;
  - the matrix: sermons of a text type (through their type fields) and comments ("O czym") per cell, an axis
    column;
  - "+ here" placing values into "O czym" and into the fields of a text type, in its Scriptorium.
- `app-library-check`: archive axes from text-type ref fields, values by name, OR/AND filters, counts, one value
  per axis, an unreadable target is not a value.
- `axes-api.mjs` (LocalDB), 8 checks. It builds a public area with a library (Bible), a Scriptorium (text type
  "Kazanie maryjne" with `tajemnica` → Tajemnica and `obszar` → Obszar, three sermons) and a base. The base has own
  kinds Część / Tajemnica (20, numbered, saved shuffled) and Grupa obszarów / Obszar (12), imports
  `komentarz.json`, adds two comments, and lists the library and the Scriptorium as sources. It saves the view
  "Tajemnica × Obszar" and a page with it. Read back from the service:
  - 20 × 12 values in "numer" order, under the headings;
  - Zwiastowanie × Wiara holds a sermon and a comment.
- `axes-browser.mjs` (headless Edge, built app), the step's test, 10 checks:
  - in Wpisy the matrix has 20 rows under the część headings and 12 columns under the grupa headings;
  - the settings show both axes (by "Numer", headings by Część / Grupa);
  - a click on Zwiastowanie × Wiara opens the field with the sermon and the comment;
  - a visitor without an account sees the same matrix on the page, a click opens the field (with crumbs), and a
    click on the sermon opens it;
  - no console errors.

**Owner must run**
- No migration. Deploy the website.
- Old topics, if any, are under "Stare wpisy" (test data).

**Test in the browser**
1. Nauka → a base → Schemat: own kinds "Część" (Nazwa), "Tajemnica" (Nazwa, Numer — number, Część — ref → Część),
   "Grupa obszarów", "Obszar" (Nazwa, Numer, Grupa — ref). Add a few entries.
2. Ustawienia → Źródła → add your Scriptorium. In the Scriptorium: a text type with `tajemnica` (→ Tajemnica) and
   `obszar` (→ Obszar); a sermon of that type.
3. Wpisy → Macierz → "Wybór i grupy": Skąd "Rodzaj: Tekst" + "Razem z: Komentarz"; Macierz — wiersze: "Tajemnica"
   (Kolejność: według pola Numer, Nagłówki: Część); kolumny: "Obszar" (Nagłówki: Grupa). The matrix shows the
   headings; click a number to open the field; "Zapisz jako widok".
4. A page → module "Widok" → this view, mode macierz.

## P6 — Documentation

**Updated**
- `ARCHITECTURE.md`: the three parts in the overview; `templates/cogita/` in the repository layout; the folders
  `library/` (sources only, the one markup reader, the statement rules), `scriptorium/` (new) and `cogita/` (own kinds
  only, statements, kind axes, text types as kinds, old kinds); the backend's shared store with three kinds; the
  `library.kind` values in the data table.
- `LIBRARY.md`, rewritten:
  - the Library as the backbone of citation: works, quotes, persons and files;
  - the three parts, with references in one direction and persons twice;
  - deleting and "Stare wpisy";
  - the reference index with statements and text types;
  - JSON v3 for sources only (refusing other kinds with the right format);
  - quotes v3;
  - how the Scriptorium and Cogita build on it;
  - a short history. The sermon, LaTeX, comment, topic and Porządki sections moved out or went away.
- `SCRIPTORIUM.md`, new:
  - the container (one per area, a move to a public area makes a text public);
  - the four kinds, and text types with the shared schema editor;
  - the workspace, the editors, the plan and deliveries, the AI prompts, LaTeX and "Plan na ambonę";
  - the pages: the page-texts rule, and the archive with its axes from the text types' ref fields and why it stays
    a module;
  - text types as kinds in Nauka;
  - the format `recreatio/scriptorium` v1;
  - files and checks.
- `COGITA.md`:
  - the store (three parts, Scriptoria as sources);
  - the schema (no built-in content schemas, `question` stays and why, the field type `blocks`, the template files,
    text types as kinds, old kinds under "Stare wpisy");
  - views (kind axes with order, headings and membership; "Tajemnica × Obszar"; create here);
  - §3 rewritten (question; statements on any kind with `blocks`; the pending list);
  - cards (statement nodes and presets on any statement kind; library and Scriptorium material);
  - revisions without "Temat"; the map without topics; the files, tabs and check counts.
- `AI-BRIEF.md` (the brief "Recreatio — Library, Scriptorium, Knowledge bases (Cogita) and Pages"), regenerated:
  - sections 1–12 rewritten for the three parts: who sees what, markup, statements on `blocks`, no topics and kind
    axes, text types, template files, narrative, units, the rules, what is open, how to hand data to the app;
  - the four appendices generated from the code: `libraryDescription()`, `scriptoriumDescription()`,
    `courseDescription()`, and excerpts of `pageDescription()` (the page, texts on pages, the presentation, and the
    modules of the three parts).

**Checks**
- Documentation only; the code is unchanged since P5 (all checks passed there).

# Part three: the AI link (2026-10-24)

The owner's request: "There should be only an explicit AI access point by a link copyable — and it is read-only for
these three [parts]." An assistant (ChatGPT, Claude …) should look up and search what is already written in an
area's Library, Scriptorium and knowledge bases, without files being copied by hand, and without the service
gaining a general way to read sealed content.

## AI1 — The AI link (0126)

**Decided**
- **Snapshots, not area keys.** The link never carries or unlocks an area key. The browser builds a readable snapshot
  per chosen collection and seals it under a random key `C`; the service holds `C` only wrapped under a key derived
  from the secret in the link. So the link can open exactly the chosen collections and nothing else of the area (no
  chats, forms, calendars), and the service reads a snapshot only while a request carries the link.
- **The service draws the secret** (`Kernel.Token`, the one token building block), returns it once and keeps its
  hash. Because `C` must be wrapped under a key from that secret, making a link takes two calls; the second one
  test-opens the wrap and keeps only `C`'s key id, which every uploaded snapshot must carry.
- **Explicit and visible.** Only leaders make, extend, change and delete links; writers refresh snapshots; every
  member sees that a link exists, what it shows and how often it was used. A link lives on its creator's right to
  lead the area, and lasts 7, 30, 90 or 365 days (at most 10 per area).
- **Resolved only inside the link.** Titles, citation keys and references in a snapshot resolve only through the
  collections of that link; anything else stays a bare id.
- **Descriptions from the code.** The kinds with the meaning of every field and the markup notes in a snapshot come
  from the same definitions the app shows entries with (`libraryKinds.ts`, the Cogita schema, `MARKUP_DOC`,
  `BIBLE_DOC`), so the assistant's description cannot drift from the app.

**Built**
- Migration `0126_ai_access.sql`: `app.ai_access` (the hash of the secret, `C` sealed three ways, its key id, the
  epoch, expiry, uses, last use; a check that a link is either complete or empty) and `app.ai_access_part` (one sealed
  snapshot per collection with the state it was made from and its entry count). Both cascade with their area and
  collection, so account and library deletion need no change. Idempotent (re-run on LocalDB: no change).
- Kernel: `Crypto.InfoAiAccess(id)` in the closed list; AAD fields `AiAccessKey`, `AiAccessWrap`, `AiAccessLink`,
  `AiSnapshot` (`ai_access_key`, `ai_access_wrap`, `ai_access_link`, `ai_snapshot`, the same in `core/crypto.ts`).
- Service `Library/AiAccess.cs`: `GET/POST /workspace/area/{id}/ai-access`, `PUT …/{access}/key` (second step),
  `POST …/{access}` (extend, change collections), `DELETE …/{access}`, `PUT …/{access}/part/{library}` (a sealed
  snapshot, octet-stream, up to 32 MB, with the state it was made from). Unfinished links go after an hour, expired
  ones 30 days after expiry. The state of a collection is computed without keys: count, a checksum over ids and
  versions, the newest change, the collection's own change (`count.checksum.newest.renamed`).
- Service `Library/AiAccess.Read.cs`, for the assistant (GET only, no session): `/ai/{secret}` (the guide in Polish:
  the area, the collections, freshness, how to ask, rules, the notes from the snapshots), `/search` (all words, folded
  like the browser's search; `part`, `kind`, `limit`, `offset`; without words a list in order with `next`; also
  `/search/{words}`), `/entry/{id or key}` (fields, the meaning of its fields, refs with titles, what points at it),
  `/kinds`, `/openapi.json` (servers = the link, for ChatGPT actions). Readable Polish JSON, `no-store`, `noindex`.
  Wrong, expired and revoked links get the same 404; misses per address are limited after the lookup (a shared AI
  address never blocks a valid link); 120 requests a minute per link; gzip unpacked with a limit.
- Frontend `aiAccess/`: `aiAccess.ts` (keys and labels like the service, the two-step making, opening `C` and the
  secret, refreshing what is stale — the state is read before the stores sync, so nothing is lost; after a write, a
  rebuild when things are quiet), `aiSnapshot.ts` (the snapshot, pure, checkable in node), `AiAccessPanel.tsx` (the
  panel: links with their collections and freshness, "Pokaż link", "Odśwież teraz", "Przedłuż", "Zbiory", "Usuń", and
  the form; quiet when an older service has no AI link yet). `libraryStore.ts` reports its writes (lazy import).
  `areas/AreaPage.tsx` shows the panel in the Dostęp tab, and on a private area under its name.

**Checks**
- `app-library-check.mjs` 2j: the snapshot of a library, a Scriptorium and a base (titles and kind names as the app
  shows them, old kinds left out, text types as second kinds, field meanings, notes), references only inside the
  link (the same Scriptorium alone resolves nothing of the others), references found anywhere in the data, gzip.
- `Api.Tests` `AiAccessChecks.cs` (503 checks in all): the labels are the browser's; the key from the link against a
  vector from the browser's HKDF; wraps open only with their secret and access; what comes in (secret, envelopes,
  state, collections, days); folding, search (all words, then any; keys; filters; order), snippets, reading a
  snapshot (another collection or format refused), unpacking with a limit.
- LocalDB drive `ai-api.mjs` (47 checks): content in three collections plus a base outside the link and a library in
  another area; the link made in two steps; the guide, search (words, no Polish letters, path form, filters, browse
  with `next`), entries by key and id, kinds, OpenAPI — all without an account; nothing from outside the link in any
  answer; reader / writer / leader rights; a stale part after a write, refreshed by the writer; foreign uploads
  refused; the second step not repeatable; the link dead when its creator no longer leads, and when expired, alive
  again when extended; collections changed and a deleted base cascading; deletion; the miss limit.
- Browser drive `ai-browser.mjs` (headless Edge on the built app): the panel lists the link, the form offers the
  area's collections, the confirmation names the AI provider, the new link is shown at once and works through the
  proxy, an older link is shown again and deleted; no console errors.
- tsc, all `app-*-check` scripts, vite build, `dotnet build`.

**Open**
- A bearer link reads until it is deleted or expires: after removing a leader who could copy it, make a new one.
  The secret is in the path, so the host's access log may record it (as with seat links).
- `C` lies under the area epoch of the day the link was made. Epochs do not rotate today; if they ever do, a re-seal
  by a leader is needed (not built) — until then a new link.
- Browser-based tools calling the link from another origin would need CORS for `/ai/*` (not opened; assistants fetch
  server-side).

**For the owner**
- Apply 0123–0126 (0125 is the Thunderbird connections), deploy the API, then the website. Until the API has 0126,
  the panel says that the AI link is not available now.
- Making a link: an area → Dostęp → "Dostęp dla AI" → tick the collections → "Utwórz link dla AI". Paste the link into
  the assistant's chat ("Przeczytaj <link> i znajdź …"), or add `<link>/openapi.json` as a ChatGPT action.

## AI2 — The link for web-reading assistants (2026-10-24)

**Found** (tested from outside against the live link): the guide, `/kinds`, `/search` and `/search/<words>` all
answer 200 with JSON, also for the ChatGPT-User agent; no redirects, no bot block, no robots.txt. What failed:
`HEAD` got 405, and ChatGPT's web tool opens only URLs it has already seen as links — the guide gave templates
(`/search?q=<słowa>`) inside JSON text, which it neither builds nor follows. The DNS errors came from the other
tool's sandbox, not from the service.

**Changed** (`AiAccess.Read.cs`, no new endpoints, the same data):
- GET and HEAD on every `/ai` route.
- Content negotiation: `Accept: text/html` or `?format=html` gives the same answer as a page with real links
  (templates are not linked); JSON stays the default, `?format=json` forces it (ChatGPT actions use JSON).
- The guide has `start` links: the kinds, everything, each collection, each kind of entry.
- `X-Robots-Tag: noindex` without `nofollow`; snippets no longer show block types ("paragraph").

**Checks:** Api.Tests 504; LocalDB drive 47; a links-only crawl (HTML, ChatGPT-User agent) from the one link
reaches the kinds, all 10 entries, refs and backlinks.

**Not verifiable from here:** ChatGPT's own browsing. The most reliable way is a Custom GPT with an Action that
imports `<link>/openapi.json`; plain chat browsing should work through the HTML links once the API is deployed.

## AI3 — Recreatio as an MCP server (0127, 2026-10-24)

The owner asked for a proper tool integration: connect Recreatio to ChatGPT once (custom MCP server with OAuth) and
let the assistant discover, search, read and follow the authorized knowledge without copied links. Read-only.

**Decided**
- **A thin layer over the AI link.** No second store, no copies: every MCP call opens the authorized links'
  snapshots exactly like `/ai/{link}` (`AiAccess.OpenLinkAsync`, split out of the HTTP handler for this). Search,
  references and rendering are shared code.
- **The OAuth access token is the list of AI link secrets** the user picks on a consent page in the app. Only the
  user's browser can open those secrets (they lie under the area key); the service keeps them only sealed under a key
  from the one-time code until redemption, then nothing. So every rule of the link holds: its collections, its expiry,
  deletion stops it, its creator must still lead the area — and the service reads only while a request carries it.
- **Official SDK** `ModelContextProtocol.AspNetCore` 2.3.0, stateless Streamable HTTP; tools with read-only
  annotations and output schemas; the standard `search` / `fetch` for ChatGPT research next to five specific tools.
- **No secret in results**: entry URLs point into the app. A `/mcp/<link>` path form stays for clients without
  OAuth (documented: prefer OAuth, the path can reach host logs).

**Built**
- `backend/Api/Library/AiMcp.cs`: registration, the gate (401 with RFC 9728 metadata; only working links pass), the
  tools `list_collections`, `get_schema`, `search_entries`, `get_entry`, `get_related`, `search`, `fetch`.
- `backend/Api/Library/AiOAuth.cs` + `0127_ai_oauth.sql`: metadata (resource and authorization server), DCR, CIMD from
  known assistant hosts, authorize (PKCE S256, `resource`, redirect checks; errors to the client with `iss`), the
  consent calls (`/oauth/request`, `/oauth/approve` — every link must work and lie in an area the user leads —,
  `/oauth/deny`), token (one use, PKCE, client, redirect, resource; `expires_in` = the shortest link).
- Kernel: `Crypto.InfoAiOAuthCode`, AAD field `AiOAuthCode`.
- `AiAccess.Read.cs`: references with their field and locator (`LinksOf`, from fields, `{value, locator}`, cells,
  markup by key), backlinks with field, a readable rendering of an entry (`Render`), search with short words as whole
  words and phrases first (`J 21`), the area name on every snapshot; the HTTP entry answer gained `links` and
  `linkedFrom`.
- Frontend: `aiAccess/AiConnect.tsx` (route `#/polacz-ai/<request>`: sign in, who asks, pick or make links, allow or
  deny), `aiSecretOf` and the consent calls in `aiAccess.ts`, the MCP address in the "Dostęp dla AI" panel.
- `documentation/MCP.md`: endpoint, authentication, connecting ChatGPT, tools, scope, revocation, troubleshooting.

**Checks**
- Api.Tests 515 (short words and phrases, links with fields and locators, PKCE against RFC 7636, redirects, `iss`,
  token parsing, trusted CIMD hosts, the code seal).
- `scratchpad/mcp/mcp-e2e.mjs` with the official MCP TypeScript SDK (1.32) on LocalDB — 40 checks: 401 discovery,
  metadata, DCR, authorize/consent/token with PKCE (wrong verifier, code reuse, a non-leader refused), initialize and
  tools with annotations and schemas, every tool, `J 21` ranking, Polish without diacritics, paging 36 entries by 7,
  grounds/objections to depth 2 and backwards, the biblical commentary's passage with locator, standard search/fetch,
  not_found for a foreign area's entry, the path form, revocation → 401 invalid_token.
- `scratchpad/mcp/mcp-consent-browser.mjs` (headless Edge): from the authorize URL through sign-in and the consent page
  to the client's callback with code, state and iss; the token works on `/mcp`.
- MCP Inspector CLI 0.17.2: `tools/list` and `tools/call search_entries` against the local server.

**Not verified here:** the production endpoint (needs the API deployed with 0125–0127) and ChatGPT itself (needs the
owner's ChatGPT account) — MCP.md has the steps.

## L1 — Source texts and one model of places (2026-10-24)

The owner asked that works be usable with or without their full text, that one model of places serve footnotes,
quotes, full texts, Cogita and the Scriptorium alike, and that structured full texts (order, hierarchy, places, page
breaks, notes) be importable in portions as JSON — written by one's own AI — without ever leaking a private text.

**Decided**
- **A locator stays what was written; its meaning is read** (`library/locations.ts`) by the scheme of its work:
  `pages`, `bible`, `numbered`, `aquinas`, `decimal`, `sections`, `outline`. Structural places (paths) are the same in
  every edition; pages belong to one edition. The work gains "Układ miejsc", "Numeracja psalmów" and "Wydanie /
  przekład dzieła". No migration: old locators are read the same way.
- **Links are computed while reading, never stored**: a footnote, a quote, a statement's cell or a Cogita field asks
  whether a text of that work is readable and holds the place. A text added later makes all earlier places
  navigable; a place in several parts is flagged, not guessed.
- **The text is a pair of entries** — `sourcetext` (the directory) and `sourcepart` (a portion) — in any writable
  library, so the work can be public and its text private. Parts are **heavy**: the sync brings their rows only
  (`?light=1`, `heavy: true`), the reader fetches them by id (`?ids=`, ≤ 50). An older client without `light` still
  gets everything. Neither kind is a source: they stay out of lists, search, the library JSON and the AI link.
- **JSON `recreatio/source-text` v1**, one portion per document; portions replace themselves by key; checked and
  previewed before writing; "never invent text" is part of the description and the prompt.

**Built**
- Backend: `Library.cs` / `Library.Areas.cs` / `Library.Cogita.cs` — `light` and `ids` on the member, public and seat
  entry routes (`HeavyKinds`).
- `library/locations.ts` (parse, overlap, contains, sort keys, format), `library/sourceText.ts` (format, checks,
  manifest, places → blocks, alignment of editions, selection → place, search, export, description with examples),
  `library/sourceFind.ts`, `SourceBox.tsx` (the work's box and import), `SourceReader.tsx` (the reader, lazy),
  `SourceBlocks.tsx`, `SourceJump.tsx` (footnotes, quotes, statement cells, Cogita place fields).
- `LibraryStore`: heavy rows and on-demand opening (`heavy`, `heavyMany`), texts per work (`texts`, `ownTexts`);
  `Lookup.texts` / `Lookup.heavy`; quotes ordered by the scheme of their work.

**Checks**
- `app-library-check.mjs` 2j/2k: every scheme (both psalm numberings, ranges, discontinuous places, outlines with gaps,
  structure vs. pages), ordering by scheme; every example imports without warnings and survives export → import;
  refusals and warnings; places → blocks; portions (replace, "bez zmian", duplicates flagged); ambiguity; selection
  → place; search; alignment; footnotes and quotes link only when the text is readable.
- `scratchpad/lib/source-api.mjs` (LocalDB, 14 checks): light rows, by ids, the old way, limits; the store opens parts
  on demand; the private text found through the neighbour library; a reader of the shared area gets neither rows nor
  parts of the private library (403) and no link; nobody without an account.
- `scratchpad/lib/source-browser.mjs` (headless Edge, 17 checks): the work's box, import with preview into the private
  library, the same portion again "bez zmian", the reader (contents, margin, `/tekst/nr 8`, search without diacritics),
  selection → "Dodaj cytat" with text and place, a quote opening the private passage, the Vulgate beside the Bible,
  a sermon's footnotes leading into the text.

**Not done:** OCR or PDF reading in the app (the owner's AI does the transcription, as everywhere). Full texts in the
AI link / MCP followed the same day (L2).

## C1 — Cogita in two parts: Wiedza and Nauka (2026-10-24)

The owner asked to simplify Cogita by separating knowledge from learning: Wiedza with three activities (Wpisy, Dodaj,
Schematy — and in Schematy three independent categories: Rodzaje wpisów, Sposoby dodawania, Sposoby wyświetlania),
Nauka with learning; secondary functions reachable but not competing; nothing lost; Polish UI.

**Decided**
- **Two workspace views, one store** (`cogita/parts.ts`): `knowledge` (Wiedza) and `learn` (Nauka) open the same
  bases; every tab belongs to one part (Ustawienia to both). No data or storage change, no migration.
- **Old addresses are rewritten, not broken** (`cogitaTrail` / `cogitaPath`): `learn/<base>/wpisy|schemat|…` lead to
  their new place with `location.replace`; every in-app link builder (Ctrl K, references, origin tags, the
  Scriptorium, the MCP entry URL) uses the new paths.
- **Wpisy shows knowledge first**: adding moved to Dodaj; filter, steps and layout are one fold „Dostosuj" with *co
  pokazać* and *jak pokazać*; the saved views are the „Sposób wyświetlania" chooser. Learning from an entry or a view is
  a link into Nauka („Ucz się tego").
- **Configurations stay independent**: the kind editor lost the forms list; forms and views each have their own list
  and editor in Schematy; none is bound to a kind.
- **The brief's example works end to end** — so two small engine additions: a form can type a `blocks` field and the
  place of a reference fed by an edge (stored `{ value, locator }`), and a view can present as **Struktura** (roots and
  what their follow steps reach, grouped by field). The example ships as `templates/cogita/komentarz-biblijny.json`.

**Built**
- `cogita/parts.ts`, `cogita/KnowledgeParts.tsx` (Dodaj, Schematy, „Ucz się tego"); `CogitaHome.tsx` (tabs per part,
  „Więcej", the way to the other part), `LearnView.tsx` (both overviews; bases are created in Wiedza; redirects),
  `EntityList.tsx` (two shapes: Wpisy and the view designer; Struktura), `SchemaEditor.tsx` (kinds only), `routes.ts`
  (`knowledge`), `Workspace.tsx`, `WorkspaceFrame.tsx` (Wiedza and Nauka under „Studium"), link builders in `search.ts`,
  `ui.tsx`, `BaseWho.tsx`, `refLabels.ts`, `TypeFields.tsx`, `TextArticle.tsx`, `Starters.tsx`, `AiMcp.cs`.
- Forms: `addForm.ts` (`blocks` typeable, `locatorFields`, `LOCATOR`, identity with places), `addFormText.ts`,
  `AddFormRun.tsx`, `AddFormEditor.tsx` (the toggle „miejsce wpisywane w każdym wierszu"); views: `views.ts`
  (`outline`, `viewOutline`), `pages/parts/viewViews.tsx` (a Struktura shows as a table on pages).
- Words: „w Nauce" → „w Wiedzy" where knowledge is meant (JSON descriptions, notes, errors).

**Checks**
- `app-cogita-check.mjs`: 449 (+18) — the tab sets, the three categories, old → new addresses, `cogitaPath`; the
  biblical-commentary template (import, groups with the typed place, one row → two connected entries with
  `{ value: bt, locator: "Łk 1,35" }`, the same row again → nothing new, another verse → the comment reused,
  description); Struktura (forward, backward, all references, roots only, kept in the document).
- `scratchpad/lib/parts-browser.mjs` (headless Edge, 22 checks): the menu, Wiedza overview and tabs, Wpisy without
  adding tools, Dodaj with the method and single entries, the form typing the place and the comment, an argument added
  through the entry editor, Schematy's three categories, a viewing method built in the designer and shown as
  Struktura (passage → text of the Bible, comment, argument „za"), Nauka's tabs, four old addresses, „Ucz się tego".

**Not done:** Struktura on pages (shown as a table there); editing the typed place in the form's „Edycja tego, co już
jest" (the entry editor changes it).

## L2 — A work with its text in one import; full texts over MCP; links that follow their area (0128, 2026-10-24)

The owner reported that a library added to an area did not reach ChatGPT over MCP, and asked for an entry about an
article or book to be created together with its full text in one import, and for the full texts to be read over MCP.

**Decided**
- **A link may follow its area** (`app.ai_access.whole_area`, migration 0128): new collections of the area become its
  parts by themselves — on creation, on listing and on reading — and the creating browser builds their first snapshot.
  New links (also from the consent page) follow the area by default; a leader can switch to chosen collections.
  Existing links that held every collection of their area when they were made follow it; others keep their choice —
  nobody's choice is widened silently. The service works without the column until 0128 is applied.
- **The text is read through its collection.** A library's snapshot carries the texts stored in it (whoever reads the
  library reads its texts); a text in a collection outside the link never appears, not even its title. The browser
  prepares every block (place — own and inherited, written the app's way —, pages, readable marks), so the service
  finds places by simple, documented matching instead of a second parser: equal, a whole unit, a range, pages; a
  place not in the text is not guessed.
- **One document for a work and its text**: the work and the entries it names go through the library import (known
  keys completed, not doubled), then the text; the format grew `portions` (a whole text in one document) and a
  "Cały tekst" section on how to split a source.

**Built**
- Backend: `0128_ai_whole_area.sql`; `AiAccess.cs` (`HasWholeAreaAsync`, `FollowAreaAsync`, whole-area create and change,
  `wholeArea` in the list), `Library.cs` (follow on creation), `AiAccess.Read.cs` (follow on reading; snapshot texts),
  `AiAccess.Texts.cs` (texts, `NormPlace`, `PlaceMatches`, `Locate`, `SearchTexts`, `RenderBlocks`), `AiMcp.cs` (tools
  `list_texts`, `read_text`, `search_text`; texts in `list_collections`, `get_entry`, standard `search`/`fetch`).
- Frontend: `aiSnapshot.ts` (`snapshotTexts`), `aiAccess.ts` (texts fetched for a library's snapshot, size fallback,
  `aiCollectionAdded`, `wholeArea`), `library.ts` (a new collection tells the AI link), `AiAccessPanel.tsx` and
  `AiConnect.tsx` ("Cały obszar"); `sourceImport.ts` (shared preview/write of parts, `planWorkWithText`, description,
  prompt, example), `SourceBox.tsx` ("Dzieło z tekstem (JSON)", whole-text documents in the work's box),
  `sourceText.ts` (`portionDocs`, "Cały tekst"), `LibraryView.tsx` (the button in Źródła), `libraryJson.ts` (a
  source-text document sent to its import).

**Checks**
- `app-library-check.mjs` 2l: the example article (author, journal, two parts) plans without warnings; references
  resolved; a known key completed; "@key" for a known work; refusals; the scheme taken from the text; `portions` expand;
  descriptions; the library import's redirect; the snapshot's texts (places inherited, readable marks, pages, title
  only inside the link, `textsOmitted`).
- Api.Tests 522 (+7): reading texts from a snapshot, places (verse, any writing, chapter, ranges, whole book, pages,
  J 2 ≠ J 21), units in every scheme, search, rendering.
- `scratchpad/ai/follow-texts-api.mjs` (LocalDB, 16): whole-area by default; a base created later joins the whole-area
  link only, gets its snapshot and is ready over MCP; list_texts, read_text by place, range, chapter, not found, part by
  part; search_text; standard search/fetch passages; get_entry names the text; another area's private text absent; the
  migration rule. `mcp-e2e.mjs` (official SDK) 41: ten tools, text tools' output schemas valid.
- `scratchpad/lib/work-text-browser.mjs` (headless Edge, 8): the dialog and its description, preview, import into the
  private library, the article page with its text and fields, the reader, the same document again, "Cały obszar" in
  the AI panel. `source-browser.mjs` still 17/17.

**Owner:** apply 0128 (after 0123–0127), deploy the API, then the site. Existing whole-area links pick up new collections
on their next listing or read; their snapshots appear when someone who writes in the area opens Recreatio.

## K1 — Adding an appointment, tidied; a day's head belongs to its date (2026-10-24)

The owner asked to simplify the calendar: to think about which options adding an appointment really needs, how they
are stored, and to build a cleaner screen. On the phone, tapping a date in the month opened the day's tasks, because
the task pill stood right next to the date.

**Decided**
- **What a new appointment needs is four things**: what (the title), when (a day and from–to, or all day), whether it
  repeats, and which calendar. The calendar brings the rest (0058): who sees it, how long it lasts, what it is
  (meeting, mass), whether it can be booked. Everything else is added on request — "+ Miejsce", "+ Notatka",
  "+ Osoby" (group calendars), "+ Link", "+ Program" (saved appointments) — and stands open when editing as soon as it
  holds something. Each row carries an icon instead of a heading.
- **Stored as before** (`saveEvent`, no migration): the rules live on the calendar, an appointment keeps only what is
  its own, NULL meaning "as the calendar". The sealed fields still name their area (`visibility_area_id`), so that
  column stays — it is just no longer a choice.
- **Removed from the editor**: the visibility per appointment (an older appointment that has one keeps it on saving
  and says so — "inaczej niż kalendarz · jak w kalendarzu"; nothing becomes visible to more people silently), the
  "Część programu" choice (a point is hooked in from its whole, "Podłącz istniejący termin"; a point says
  "Punkt programu: … Odłącz"), and the kind in calendars that hold only meetings (chips Msza · Spowiedź ·
  Nabożeństwo · Spotkanie appear in mass/service calendars).
- **Behaviour**: a later start takes the end along (the length stays), so does a later day; the weekdays of a weekly
  series follow the day until chosen by hand; "Co tydzień / Co miesiąc, 24. dnia / Co rok, 24 października" are one
  choice, "co 2 tygodnie" sits under "Inaczej…"; the end day shows only when it differs ("Kończy się innego dnia",
  "Kilka dni"); unticking "Cały dzień" with no usable hours gives 9:00 and the calendar's length; an end before the
  start is said at once; "+ Termin" while looking at a later day proposes that day at the next full hour (was 1:00).
  Series scope stays a choice above the form ("Zmieniasz: Ten termin · Ten i następne · Całą serię", 0079).
- **The head of a day is one button** — in the month cell and in the list — with the day's task tally as a quiet
  mark inside it (`TaskTally`); it opens the day. The tasks of a day are one click further: the "zadania" row of the
  day view. In narrow cells (phone) the month name steps aside (except on the 1st) and the tally becomes a dot in the
  colour of its state.
- Not done, worth asking: monthly by weekday ("pierwszy piątek miesiąca") would need a new repeat rule in storage;
  `calendar_item.status` (always "planned") and `task_state` are unused and could be dropped in a cleanup step
  (API first, then the migration).

**Built**
- `calendar/EventEditor.tsx` rewritten (same save logic: "ten i następne" with handover, points follow their whole);
  `calendar/EventDetails.tsx` (`ProgramOf` only lists, adds, opens, links and unlinks points); `calendar/TaskDay.tsx`
  (`TaskTally`, `taskWords`; `TaskPill` without `mini`); `calendar/CalendarApp.tsx` (month and list heads, `ListView`
  `onDay`, the "+ Termin" hour); `calendar/CalendarPart.tsx`; styles in `personal.css` (`.wk-ev-row` …,
  `.wk-cal2-cellhead` with container queries), `links-and-notices.css`, `calendar-links.css`.

**Checks**
- LocalDB drives (headless Edge, dev server against the local API): `scratchpad/va/cal-ui.mjs` 41 — the core-only new
  form, focus, chips, duration following the start, weekly weekdays, calendar chips and "Widzą", "+ Miejsce", the
  instant end error, stored values, "bez końca", reopening a series ("Ten termin" only moves the time), the all-day
  row, mass calendar kinds and length, "Ten i następne" with a new series, month/list heads open the day (mouse and
  finger), no cut-off day numbers on the phone, the form fits a phone screen. `cal-ui2.mjs` 20 — program point add,
  open, "Odłącz"; a kept visibility exception and "jak w kalendarzu"; booking in a "marked" calendar; the "+ Termin"
  hour on a later day.
- All `app-*-check` scripts and the style ratchet pass (wk-hint 565 → 555); `tsc` is clean for these files.

## F1 — Minors in a form: how they are recognised, how they take part; the JSON formats as a tree (2026-10-24)

The owner asked: a form with minors knows minority from the age when it is asked, otherwise from a tick; a minor then
takes part with a parent, with an adult the parent authorises, or alone with the parent's written consent, and each
way asks as little as possible (nothing, a name, the parent with the paper). The form chooses birth date or tick and
which ways are open (checkboxes; an event only for children opens one). Such a form must import as JSON, also inside
the page JSON, and formats that carry other formats must always describe them currently, without copies.

**Decided**
- **Settings are a general piece of a need** (`NeedSetting`: one of several, or several), not a screen of their own.
  The minors need is the first with settings: `age` = `birth` | `ask`, `ways` ⊆ `parent`, `adult`, `consent`
  (proposed: birth date, all three; an entry from before reads as birth date + consent, as it was).
- **What is asked**: with a parent, nothing (when it is the only way, one sentence says so); with an adult, the
  adult's name; alone, the parent's name and phone and the approval to sign (a text, never a tick, as since 0087).
  Several ways: the minor chooses ("Jak niepełnoletni uczestnik weźmie udział?", required only for minors). One way:
  nobody chooses. The logic compares the chosen wording, so the need holds those options (read-only in the editor).
- **New paper rule `sign`**: print when the form shows a statement to sign. The minors need sets it, so the print
  appears for the tick as well as for the birth date, and only for the consent way. `minor` keeps working for forms
  that have it. A later print evaluates the age on the day of filling. **The print at the end of the form works
  only once the form is filled** (nothing missing, nothing wrong — the same as "Wyślij"): before that the note
  stands there and the button is off (owner, the same day).
- **Changing the settings of a need that is on reshapes the form in place**: what both versions need stays (same
  questions, answers kept), the new groups stand where the old ones stood, what the need added and no longer needs
  goes (answered questions are only taken off), questions another need holds stay. Entries from before the settings
  resolve their parts by the order in which `applyNeed` created them.
- **JSON**: a form carries `needs` beside `questions` and `design` — `{ "id": "minor", "age": "ask", "ways": [...] }`
  or just `"health"`. The export adds `holds` (key → id), so a copy takes the questions over instead of adding them
  twice. The locks (`config.needs`) are no longer in `config`, and no import overwrites them (`PartJson.own`,
  `keepOwn`). Needs missing from a document stay on unless "Usuń pytania i wymagania, których nie ma w dokumencie".
- **The page import does for each form what the module import does** — one reader (`modules/moduleWish.ts`), one
  importer (`modules/moduleImport.ts`): questions, design, needs, roles, virtual areas, group, repeat, audience.
- **The JSON tree** (`core/jsonTree.ts`): a node says only its own keys and names the nodes inside it; a description
  is a node and everything below it, each node once. Page → page keys, texts, appointments, files, module entry
  (→ kinds, form → needs), layers, motion, drawing, presentation, examples. The module and part descriptions are made
  of the same nodes. The panel shows the outline (a click jumps to the section) and "Wstaw przykład": the page, a
  presentation and two complete forms with every possibility for minors (birth date / tick).

**Built**
- `forms/needs.ts` (wordings, settings, shapes, `NEEDS`, `choiceOf`), `forms/needPlan.ts` (`NeedOn` with `choice`
  and `keys`, `planNeed`, `adoptedOf`, `holdingOf`, `paperAfter`, `layoutReplacing`, `lockedOf().options`),
  `forms/formTemplates.ts` (`applyNeed`, `reshapeNeed`, `dropNeed`, `importNeeds`; refuses to place a need without
  an answers area), `forms/needsJson.ts`, `forms/formFormat.ts`; `FormSettings.tsx` (settings under the need,
  "Zastosuj ustawienia", the `sign` rule in "Po wysłaniu"), `FieldEditors.tsx` (options held by a need),
  `SignSheet.tsx` (`PAPER_SIGN`, `signsShown`, `signsIn`; the form hands its fresh copy to the print button —
  `keepOpenedForm`), `formDesign.ts` (`evaluate(…, { on })`).
- `core/jsonTree.ts`, `pages/pageJsonText.ts` (nodes: `PAGE_JSON`, `moduleFormat`, `partFormat`, `kindNode`),
  `ui/JsonPanel.tsx` (`format`, outline, samples), `pages/part.ts` (`own`, `keepOwn`), `pages/parts/live.tsx`
  (`needs` own, `paper` says `sign`), `pages/pageJson.ts` (export `needs`, form wishes in the plan, own keys kept),
  `pages/PageJsonPanel.tsx` (forms through `applyModuleWish`; a module from another page keeps its own keys; a new
  form without an answers area is warned about), `modules/ModuleJson.tsx`.

**Checks**
- `app-platform-check`: 17 need shapes (3 + minors 2 × 7) — placements, references, unique keys, nothing hideable
  required by itself, compared words are options; per setting: an adult owes nothing, a minor owes only what the
  chosen way needs, paper only with written consent, on the day of filling; the plan: turning on reuses names,
  reshaping keeps, takes off, restores, re-fixes options and spares other needs; old entries by order.
- `app-json-check`: the tree (63 sections in the page, each once; the same text wherever a node stands; every sample
  imports without a warning); needs JSON (every need, setting and value described; tolerant reading; out and back
  the same; locks never in `config`; a page form gets its needs; adoption instead of doubles).
- LocalDB drive `scratchpad/minor-ui.mjs` (headless Edge, 47): outline and jump; sample, area, import of three
  needs; the form in every way (tick, choice, adult's name, parent with the print, untick); settings → birth date
  and two ways (the same parent question, the tick gone); one way (no choice, parent and print at once); module
  export (`needs` with `holds`, no locks in `config`), the same document back (no change), a copy on the page takes
  the questions over (same count, its own ids).
- `tsc` clean; presentation, slides, motion, sim, event and style checks pass.

**Owner:** no migration and no API deploy (the service reads `config.needs` as before); deploy the site. Forms with
the minors need on keep their behaviour (birth date, written consent, paper `minor`) until their settings change.

## S1 — Slides leave at the top: a slide is one sheet; the reader stays put (2026-10-25)

The owner asked, pointing at a slide set to "Przewinięcie" with "Wynurza się z dołu": the slides should disappear
completely at the top when revealing and going to the next slide. Their deck ("Patriotyczna wycieczka") has a shared
backdrop (`deck.backdrop`) and photos, glows and a big word on every slide.

**Found**
- With a shared backdrop the slides' own layers lay in the viewport-fixed cloth and only crossfaded (`backdropAt`):
  while a slide's text left at the top, its photo and big word stayed on the whole screen, mixed with the next.
  "Odsłonięcie" uncovered nothing (the leaving section was transparent); fade, cover and side left the old text
  under the new one until the last frame and then dropped it. Plain decks were clean.
- Separately, in every deck: when an earlier slide changed height while the reader rested (a picture, a calendar, a
  form loading) or the window changed (rotation, a phone keyboard), the track kept its number and rested between two
  slides — the bottom of the previous slide stayed at the top until the next scroll.

**Decided** (three designs and a judge, `wf_d84e399b`; the winner with parts of the others)
- **A slide is one sheet**: its own layers and its content in its `<section>`, in every deck (plain decks as always).
  The shared backdrop is the first child of the track, pushed back by the track's position so it stands, and paints
  the ground itself — a "multiply" photo of a slide still mixes with it (at rest, while scrolling).
- **Who lies over whom cuts** (`slideSheets.sheetsAt`): reveal — the new one only below the leaving one's lower edge
  (no z-index any more); cover — the old one only above the new one's top, in its own shrunk measure; side — the old
  one only left of the new one. Transparent sheets can therefore no longer show what lies under them.
- **Przenikanie by coverage** (`layerCover`: a gradient of solid colours 1, a "normal" image its opacity ≤ .98,
  anything else 0): the old slide stands when the new one covers fully (0084 unchanged); otherwise it fades so that
  exactly 1 − e of it is left — nothing at the end, no jump.
- **Layers drift with the track** at their tempo even while their slide is pinned (the owner's wish of 2026-10-24),
  arrive where they rest without a jump and always cover what shows of their slide. Less motion: they go with their
  slide and cover it whole (also a tall one).
- **Staying put** (`useSlideScroll`, a marked block): while nothing moves the track, changed measures keep the reader
  on the same slide at the same place; a move under way goes on to where its slide is now; a hand on the track keeps
  its place in its slide; and the track never rests between two slides.
- `backdropAt` now serves only presentation scenes.

**Accepted**
- A "multiply" layer mixes with the backdrop only while its slide is unstyled (at rest, scrolling, leaving by reveal,
  arriving by cover); in the other changes it is on its own and settles by a few levels at the end (≈ 8 per channel on
  the owner-like replica, invisible on a near-white cloth). If ever needed: a copy of the cloth in such a section.
- While its slide is cut or fading, a card's frosted glass sees only its own slide's layers.

**Built**
- `pages/slides/slideSheets.ts` (new: `sheetsAt`, `layerCover`, `layerPlace`), `SlideDeck.tsx` (one path, the cloth in
  the track), `slideMotion.ts` (comments), `useSlideScroll.ts` ("Staying put"), `styles/motion.css` (the cloth paints
  the ground, `will-change`), texts: `pageJsonText.ts` (layers, flow, fade, `deck.backdrop`), `LayerEditor.tsx` hint,
  `slideLook.ts`, `presentation.ts`, `AI-BRIEF.md`.

**Checks**
- `app-slides-check`: cuts (also a tall old one), fade by coverage (exactly 1 − e, nothing at the end), less motion;
  every kind × three stacks leaves nothing behind (forward, back, onto a tall slide); layers drift while pinned and
  arrive without a jump; every layer covers what shows (every kind, six tempi, the whole deck); `layerCover`; the
  server draws the cloth first in the track, the layers in their slides (with and without a cloth).
- `app-platform-check` unchanged (the old one stands under a fade).
- LocalDB drives (headless Edge, held clock): `slides3-verify.mjs` — four decks (plain, dark cloth, the owner-like
  replica, cloth without own layers) × desktop, phone, less motion, 16 changes each way: structure, who is on screen,
  texts never both opaque on each other, nothing of the old colour on arrival, the edge mid-way, no jump at the end,
  the multiply photo mixes at rest — all green. `slides-anchor.mjs` — 15 checks (resize, growth above, growth during
  a move and during a wheel scroll, peek, keys); without "Staying put" 5 of them fail. Firefox 157 (the owner's
  browser, WebDriver BiDi, `slides-firefox.mjs`): structure, reveal and scroll edges, multiply at rest — 10/10.

**Owner:** no migration, no API deploy; rebuild and deploy the site.

## W1 — Wywód: a work's leading question and argumentation in Cogita, buttons „W Wiedzy” in the Library (2026-10-25)

The owner asked how Cogita can show the whole structure of an article from the Library — its leading question and
line of argumentation — without giving up the distinction between the parts. Then they settled it: no prepared
schemes in the engine; the structure is prepared outside (by them or their own AI) and imported in their own kinds;
entry points (whole work, beginning, end, several parts at once, overlapping, parallel structures) are described in
Cogita; a button in the Library opens the chosen view at the chosen node. Design history and the mechanism: WYWOD.md.

**Found on the way, fixed**
- The Library view re-ran its loading effect after every knowledge-base sync — about 190 requests a second for as
  long as it was open (committed earlier the same day; `ScriptoriumView.tsx`'s `tick === 0` workaround replaced too).
- `CogitaLibrary.isOwn` said „own” for entries of any other knowledge base loaded in the tab (`LibraryStore.get`
  reaches loaded bases since 2026-10-22); now `store.own`.
- Every question in Cogita read „Pytanie otwarte” (`markupLook` had no `readable`): answered is now computed once per
  state (`answeredIds`, `Lookup.answered`).
- The Cogita import did not resolve Library keys and let document names shadow them; a template file imported twice
  doubled its card templates and forms; `komentarz-biblijny.json` after `komentarz.json` dropped „O czym”.
- The card condition „Warunek: równe / różne” compared only an option's label; it now matches the stored value too.

**Built**
- Structure fields (`FieldDef.structure: up | down`), the step „Idź po strukturze”, `outline` display `{chip, order,
  tie}`, views opened at a node (`wpisy/widok/<view>/<entry>`, `viewFrom`), the Struktura drawn whole
  (`StructureView.tsx`: tree with keys, text order with the pieces of an Aquinas article, relative places, comments
  beside steps), the entry page's structure and breadcrumb; badge and staleness ignore structure links.
- Order by place in the work (`structure.ts`), the scheme recognised from the places when the work is unreadable,
  `locations.ts` reads parts after „;” (pages, outlines, Aquinas).
- Wejścia z Biblioteki (doc kind `anchor`, `anchors.ts`, `AnchorList.tsx`, Więcej → „Wejścia z Biblioteki”, under an
  entry); in the Library the box „W Wiedzy”, the phone line, the reader's buttons (`anchorHits.ts`,
  `LibraryKnowledge.tsx`); „Powiązania” folds long lists and titles statements by thesis.
- Import: lasting names (`_ref`, refs with „/”), declared keys only, kinds completed not replaced, templates and forms
  by name, anchors (view by name, work by key), the preview of the tree; export with lasting names.
- `templates/cogita/wywod.json` (Krok wywodu, Komentarz, three views, two forms, a card template) and
  `templates/cogita/wywod-AI.md` (the guide for an AI, two complete examples); AI-BRIEF Appendix C regenerated; the
  MCP instructions and AI-link notes explain structure fields.

**Checks**
- `app-cogita-check` 482 (33 new: the choice condition by label and value, the schema twice, both guide examples as they stand, idempotent re-import, Summa
  tree and text order, the article by pages, the scheme without the work, the view at a node, the step up and down,
  badge, comments beside steps, anchors, export round trip, preview, kind merge, template dedupe, warnings);
  `app-library-check` (anchors by readable stores only, order, the reader's parts, editions, thesis titles); all other
  checks, vite build, dotnet build, 522 API tests.
- Browser drive `scratchpad/argdesign/wywod-browser.mjs` (headless Edge, LocalDB): 20/20 — schema import, both
  examples with preview, re-import 0 new, Library → „W Wiedzy” → the Summa structure (pieces in text order, „pokaż w
  tekście”, the tree), the article's two anchors in order, the phone line, the reader's button, the anchors tab, and
  a parishioner who reads the library but not the base sees no trace of it.

**Owner:** rebuild and deploy the site; the API deploy only changes one MCP instruction sentence (no migration).
Import `templates/cogita/wywod.json` once per base that should hold structures.

### W1, continued — after the adversarial review (2026-10-25)

An adversarial review confirmed 45 findings: 2 high, 9 medium and the rest low. All were fixed. Eight agents then
re-checked each finding against the code: 17 were only partly fixed, and 10 new problems had appeared in the fixes.
Those were fixed and checked again by a skeptic per area, whose last four reports were fixed as well.

**Engine and screen**
- **The step „Idź po strukturze”** now has `one` (one level). The old `deep` could not be unticked. An old
  `deep: false` still reads as one level.
- **Ordering:**
  - sort keys are computed once per row, with one collator (also in `viewList`);
  - works are ranked by first appearance, and the wider page range comes first;
  - relative places check a boundary: pages stay whole, and Aquinas, the Bible and outlines are shown relative to
    the root.
- **The tree budget** is per root: 2000 steps and 24 levels, with 10000 in the whole view. A cut is said on the card
  and in the classic outline. Comments under a step are never counted as cut steps.
- **Display order:** the order a view fixes wins over the reader's last choice.
- **StructureView, rebuilt:**
  - nested lists, one tab stop per step (the thesis carries `aria-expanded`), ← → fold;
  - „Rozwiń wszystko” with single steps still closable;
  - the classic outline back for roots without structure steps;
  - Polish plurals; roots keyed by id;
  - piece headings read before their step;
  - „pokaż w tekście” after a fresh load and kept open across syncs (`workLook`, also on a work's own page).
- **Places with „;”:**
  - a part that starts lower stays in the frame of the part before;
  - one that only goes deeper is merged into it;
  - a bare number is read at the level before;
  - pages are never framed;
  - unread parts go to `rest`, and the anchor form names them;
  - a note in an outline place does not change the recognised scheme.
- **A view opened at an entry:** search, kind and filter are off with a note, and „Ucz się tego” learns what is shown.
- **Anchors in the UI:**
  - anchors found in search and „Fragment Pisma” open where they lead;
  - the anchors tab never offers readers a form;
  - the entity and anchor forms reset between entries.
- **Sources** say „Otwieranie źródeł…” from the first frame.

**Import and export**
- **Name spaces:** kinds and entries share one; each sort of document has its own. References in documents go first
  to the sort their key names, and the store refuses to change an entry's sort.
- **Two passes for documents:** first what a document names, then templates and forms by name AND kinds. A match by
  name needs a single unclaimed candidate and is said in the review.
- **Lasting names:**
  - kept in lower case, for kinds too, and kept through the editor;
  - the shipped files name their kinds, templates and forms;
  - entries remember their document (`_refDoc`), and the review names documents that reach another's entries;
  - merged entries keep both names (`_refs`), and a row arriving by the dropped name only fills what is empty.
- **References:** a name with „/” is a reference only in reference fields and cell references. Unresolved references
  are left out with a warning; for keys, the warning points to Więcej → Ustawienia → Źródła.
- **Kinds** are completed in the document's order. Name, label, `tells` and `system` are kept unless named, and
  changes are said.
- **Structure problems named before saving:** circles, and steps pointing up to themselves or to nothing.
- **Export:** `@name` for own ids in views (steps, groups, axes, `#axis:` columns), templates, revisions, flows,
  collections and forms. No bookkeeping keys in the data.
- **`answered`:** a `down` list answers the lister, not the questions it lists.

**Guide and texts**
- **`wywod-AI.md`:**
  - names of the form `@<work key>/<reconstruction>/<step>`;
  - the article example with a parallel reconstruction of its introduction and three overlapping anchors;
  - the declared-source requirement (Wiedza → Więcej → Ustawienia → Źródła);
  - what to do for a second reconstruction.
- **MCP instructions and AI-link notes:** `get_related` with depth 3, continuing from depth-3 nodes and from truncated
  edges. REST readers use `/entry/<id>` → `linkedFrom`.
- **WYWOD.md privacy wording:** the service sees that entries of the sort „anchor” exist, nothing more.

**Checks**
- `app-cogita-check`: 524 passed, 74 of them for Wywód.
- `app-library-check` passes.
- json, presentation, style and platform checks pass.
- vite build and `dotnet build` pass, with 0 warnings; Api.Tests pass 522.
- The browser drive passes 23/23, including the introduction as its own reconstruction, the keyboard folding, the
  locked search at a node, „W Wiedzy: 3 wejścia” on a phone, and the parishioner who sees nothing.

**Owner:** the same as W1. Rebuild and deploy the site. The API deploy changes only the MCP instruction text. Import
`templates/cogita/wywod.json` once per base; bases that imported the shipped schema files before get their lasting
names on the next import of each file.

## W2 — Any work: steps and stable elements, strict cards, a reviewed import, the two-step AI guide (2026-10-25)

**What the owner decided** (WYWOD.md §1.1):
- Two kinds describe texts. „Krok wywodu” is the moving thought, with roles extended by wątek, część utworu,
  wydarzenie, etap, opis and streszczenie. „Element stały” holds the stable things: concepts as this work
  understands them, characters, places, motifs, and concepts above works via „Ogólnie”.
- New possibilities are list options, never new schemas. Komentarz stays the owner's own remark about anything.
- Narratives get parallel structures (composition, chronology, a character's development) that share their events.
- Cards are strictly checked, never free text.
- Every change an import makes to what exists is accepted field by field and can be edited first.
- The AI works in two steps: the text into the Library, then the structure into Cogita, from one guide.

**Built**
- **Engine:**
  - `SiblingOrder.by` / `outline.by`: order one level by a field first (the time of a story);
  - a structure field with `multi` gives several parents;
  - card node „Pary z dwóch pól” (`pairs.fields`).
- **Import:**
  - an existing entry is completed, not replaced (fields not named stay, `null` removes one, kinds are added);
  - kinds resolve by lasting name in step documents (`@wywod/krok`);
  - `_refDoc` warnings only for entries tied to a work.
- **Review:** `importReview.ts` (the changes of a plan; defaults: new ticked, changes to existing not; the decided
  plan with accepted changes, edited values, rejected new entries removed together with references to them, name
  stamps kept). `ImportReviewPanel.tsx` shows it under the plan in Wiedza → JSON and in Schematy; the button reads
  „Zapisz przyjęte”.
- **`templates/cogita/wywod.json`:**
  - three kinds, with lasting names: `@wywod/krok`, `@wywod/element`, `@komentarz/rodzaj`;
  - six views, including „Wywód — w czasie opowieści” and „Elementy stałe”;
  - three forms;
  - four card templates: fragments ↔ theses of one work; which thesis for this fragment, the wrong answers from the
    same work; which work for this thesis; what an element means in its work.
- **`templates/cogita/wywod-AI.md`:**
  - the model;
  - step 1 (the text, with Appendix A generated from `workWithTextDescription()` by `scripts/wywod-guide.mjs`);
  - the stop and the sentence for step 2;
  - step 2 (fields, how to build the structures of arguing texts, a Summa article and narratives, elements, names,
    places, fragments, entry points);
  - corrections, a checklist, and four examples (an article with parallel reconstructions and elements, a Summa
    article, a novel with three structures, a correction).

**Checks:**
- `app-cogita-check`: 554, with 104 for Wywód. All four guide examples import as they stand. The new checks cover the
  three structures and the time order, the elements, all four card kinds against the steps of the same work, the
  correction and its review (default, accept, edit, reject, unreadable edit), kinds by lasting name, and Appendix A
  equal to the app.
- `app-library-check`, json, style, presentation and platform checks pass; vite build and `dotnet build` pass
  (0 errors); Api.Tests pass 522.
- Browser drive (headless Edge, LocalDB): 29/29. It covers:
  - the schema;
  - the examples with preview, and a re-import with nothing to review;
  - the novel (19 new, all ticked);
  - the correction (2 unticked changes and 1 ticked new comment; the thesis edited and accepted, and the edited text
    then in the structure);
  - the chronology opened from the Library in the time of the story;
  - the earlier Summa, article, phone, reader, anchors-tab and parishioner checks.

**Owner:** rebuild and deploy the site (no API change since W1). Re-import `templates/cogita/wywod.json` in each base
that has it: the review lists the kind changes to accept. The old self-assessed card template stays until deleted.

## W3 — Short or whole theses, and level by level, in the Struktura view (2026-10-26)

**Asked:**
- The steps' theses were cut with „…”; the owner wanted to choose at the top whether they are short or whole.
- An expand mode: at first only the outermost arguments, then the ones inside them, down to the innermost.

**Built**
- A group „Tezy skrócone | Całe tezy” in each root's tools row, beside „Wywód | Kolejność tekstu”
  (`cogita/StructureView.tsx`).
  - Short (the default): as before, a thesis is cut after 90 characters with „…”, like every name in lists.
  - Whole: the leading question and every step show the whole first sentence, not the paragraph, wrapped over
    several lines. References stay short („↳ do:”, the path „W strukturze”).
  - One choice for every root on the screen, remembered per browser (`cg-structure-theses`); without storage it
    holds for the tab.
- `labelOf` / `fill` / `fieldText` / `valueText` and `blocksTitle` take an optional `whole` (default off, so
  every other list is unchanged).
- **Levels** (tree order, when a step has steps inside it; logic in `cogita/outlineLevels.ts`):
  - The arrow before a step now shows or hides the steps inside it, with their number („▾ 3” / „▸ 3”), as its own
    button (`aria-expanded`, `aria-controls`). It used to repeat the thesis (open the whole step); the thesis still
    does that. Steps without inner steps have an empty place; text order has no arrows.
  - „Wszystkie poziomy | Poziom po poziomie”, remembered per browser (`cg-structure-levels`) for every root on the
    screen. All levels: any branch folds by its arrow; a click on „Wszystkie poziomy” opens all again. Level by
    level: the outer steps first; „Rozwiń poziom” opens exactly one more level wherever steps are shown, „Zwiń
    poziom” closes the deepest one; „poziom 2 z 3” (read out when it changes). „Rozwiń wszystko” is shown with all
    levels only.

**Checks:**
- `app-cogita-check` 564, with 10 new: theses short by default, whole when remembered, the unclipped label; the
  depth of a tree, exactly one level deeper, one level shallower, a step „już wyżej”, the arrows with all levels,
  level by level when remembered, no levels in text order.
- `app-library-check` and the style ratchet pass; `tsc` and vite build pass.
- Browser drive 42/42, with 13 new checks:
  - theses: short by default; whole on click; kept over a real reload and wrapped on a phone with no sideways
    scroll; short again;
  - levels on the article: 7 steps with „▾ 3” at first; 2 outer steps in „Poziom po poziomie”; the arrow opens 5;
    „Rozwiń poziom” reaches 7 („poziom 3 z 3”); „Zwiń poziom” twice back to 2; the thesis still opens the whole
    step; kept over a reload; with all levels a branch folds (2 left) and „Wszystkie poziomy” opens it again.

**Owner:** rebuild and deploy the site; nothing else.

## K2 — Appointment schemes: fields, record lists with rules, liturgical plans that create masses (0132, 2026-10-26)

**Asked:** rethink intentions, masses and appointments as one generic appointment with schemes on top (mass,
intention single or collective, persons, feast and colour, the Sunday of the liturgical year, a fixed evening votive
mass, Sunday 12:13 for the parish), a React Flow that creates the masses of the next weeks by a rule, different per
diocese, and fields declared per area. The decisions are D1–D16 with the owner's notes and O1–O3 in
`documentation/APPOINTMENT-SCHEMES.md` (§4, §7, §8); then "make a full implementation using the selections I made".

**Built** (§9 of that file says where and how it is used)
- **Storage (0132):** `calendar_doc` — schemes and plans, sealed per calendar (a scheme under the key of the area that
  sees the calendar, a plan under the calendar's own area); `calendar_item.scheme_id` (NULL = the universal scheme in
  code) and `plan_origin`; `calendar_value` — values of an appointment or of one occurrence, sealed, with a public
  label and value where the scheme says so; `occurrence_record` + `_value` — generic records (intentions, sign-ups)
  with status and origin. `mass_intention` is copied into the list `intencje` (the API catches up rows written before
  the deploy); the old intention endpoints, the mass plan, series handover and both deletions use the new tables.
- **Schemes** (`calendar/scheme.ts`, `SchemeEditor.tsx`): kind(s), public title, fields (eleven types, appointment or
  day level, public, required, choices, unit), record lists (modes, public text, a pinned person, own sealed fields,
  "outside" sign-up, a rule). Templates: Msza, Nabożeństwo, Spowiedź, Spotkanie z zapisami — copied in by hand.
- **Rules** run in the browser (`records.ts` `checkRule` → `flow/flowRun.ts`): allow, wait or refuse with a message;
  conditions on mode, counts on the occurrence or the week, who adds, a field. A record from outside always waits —
  public fields only — and the office accepts it after the rule ran again (`RecordsPanel.tsx`, replaces
  `IntentionsPanel`).
- **Plans** (`PlanEditor.tsx`, `flow/`): a React Flow with a day stage (season, feasts table, conditions, set,
  mass hours) and a mass stage (conditions, set title/field/variable, fixed record, create or skip); the app only
  computes what moves each year (`flow/liturgy.ts`: Easter, Advent, the Christmas cycle, weeks, nth weekday). The
  template "Rok liturgiczny — parafia (Polska)" holds the Polish calendar, Triduum, Pasterka, the Wednesday evening
  votive mass of MB Nieustającej Pomocy on ordinary weekdays, and "Za parafian" at 12:13.
- **Apply** (`PlanApply.tsx`, "Zastosuj…", also "Zapisz i zastosuj…"): a calendar, a range, a preview day by day,
  then single appointments with the plan's scheme, values and records — not tied to the plan (O1); a second run
  skips what is there (O3). The bell: "Wpisy do przyjęcia" (waiting outside records) and "Plany do przedłużenia"
  (planned weeks ending within 14 days; opens the dialog).
- **Editor and reading:** scheme chips and fields in the appointment editor (day fields for one date or "Ten
  termin"), values in the details; public values on the public mass plan, the print sheet and the gablota.
- **JSON:** `recreatio/scheme` and `recreatio/plan` (`schemeJson.ts`) — export, tolerant import with a word for every
  dropped thing; the description is part of the format tree (scheme → field, list → rule → flow, condition, date;
  plan → plan flow → the same nodes), complete by type (`PLAN_TESTS`/`RULE_TESTS` and every date rule); the templates
  are its samples.

**Checks:**
- `app-scheme-check` 111: the computus and moving days; the Polish template on known days (Christmas with Pasterka,
  Palm Sunday, Gaudete, the Wednesday votive mass and Lent without it, transferred solemnities, Triduum, 12:13) and a
  whole year 2027; intention and sign-up rules; broken flows; JSON; sealing labels of values and records.
- `app-json-check` block 0132 (round trips, oddities, foreign scheme references, the tree, samples); `tsc` clean.
- Backend: `Api.Tests` 547 (with SchemeChecks), `scratchpad/va/schemes-api.mjs` 44 on LocalDB (docs, values, records,
  intention copy and catch-up, old endpoints, deletion).
- Browser drives on LocalDB: `schemes-ui.mjs` 23 (template scheme and plan, the JSON tree and samples, flow
  graph, Sunday preview with 12:13 "Za parafian", two weeks applied = 34 single masses with scheme, colour and
  obchód, the rule refusing a second single intention, the public plan and the old office endpoint);
  `records-outside.mjs` 11 (a member signs up from outside, the record waits, the office accepts it); regressions
  `cal-ui.mjs` 41, `cal-ui2.mjs` 20, `ap-ui.mjs` 10.

**Owner:** apply `0132_appointment_schemes.sql`, then deploy the API, then rebuild and deploy the site.

## M1 — Music in the Library: pieces, scores with their files, recordings in voices, albums; places in time (2026-10-26)

**Asked:** the Library stores music too, as its own part. Choosing the kind of a work decides its fields. A music
work can be a score (sheets, notation) or a recording — one file, or several that are the parts (voices,
instruments). Later: publishing with a player that plays the voices together, and Cogita cards that play a recording
from a moment and ask for the title (choose or type). Those two are not built now; the data is made for them.

**Built** (LIBRARY.md → „Music”):
- **Kinds** (`libraryKinds.ts`): `piece` (Utwór muzyczny), `score` (Nuty), `recording` (Nagranie), `album` (Płyta,
  album), still `work` entries, grouped in the kind select under „Muzyka”. Each field says for which kinds it shows
  (`when`). New fields: composers, lyricists, arrangers, performers, piece, album, track, catalogue number, key,
  voicing, genre, duration, ISMN, lyrics, other titles and incipit; `files` (score) and `tracks` (recording) are lists
  with a new field type `media`. Books lose nothing; music hides ISBN, DOI, the place scheme and the other book-only
  fields.
- **The tab „Muzyka”** (`LibraryView.tsx`): music apart from „Źródła”, one button per kind, its own list lines
  (kind, catalogue, voicing, „3 ścieżki”) and its own JSON export. The pickers offer only pieces (albums) and make a
  new one of that kind; an ensemble typed as a performer becomes an institution.
- **Files** (`MusicFiles.tsx`, `music.ts`): tracks with a voice and a role (part: sounds together; whole: alone),
  several uploaded at once and named from the file name (`guessVoice`); score files (PDF, images, MusicXML, MIDI).
  - Encrypted in the browser (`LibraryStore.upload`) and opened only when asked (`openFile`): play, show a PDF or
    image, download.
  - **Saved at once** (`entryDraft.commit`): the browser drive found that the autosave (1.2 s after typing) lost the
    track list on a quick reload and left the files orphaned.
  - Files go with their entry: removed with it (also many at once), removed with their track after a question,
    replaced, and carried along when the entry moves to another library, sealed again under that area's key
    (`LibraryStore.carryFiles`).
- **Places in time** (`locations.ts`, scheme `time`): `1:23`, `1:23–1:45`, `0:45; 2:10–2:30`, `1:02:03`, `1:23.5`.
  A recording reads its places this way. A time belongs to that one performance (not structural). Source texts keep
  the text schemes (`TEXT_SCHEMES`).
- **Footnotes** (`libraryCite.ts`): a piece by its composer and catalogue number; a score with „[nuty]”; a recording
  by title and composer (from its piece) with performers, „[nagranie]”, the album and track, and the time; an album
  with „[płyta]”.
- **JSON:** the fields are described, with a piece and a recording in voices as examples; a file is kept as the export
  wrote it, an invented one is dropped with a warning. The work-with-text guide shows only the text fields; Appendix A
  of `wywod-AI.md` and of `AI-BRIEF.md` are regenerated.
- **For later** (`music.ts`): `partsOf` and `wholeOf` (the player), `pieceBehind` and `titlesOf` (the cards: every
  recording of a piece is one answer; a typed answer may be any name the piece is known by).

**Checks:**
- `app-library-check`: 25 sections, with a new music section covering:
  - the fields per kind and that books are unchanged;
  - the examples (also music) importing without a warning, and the export → import round trip with files;
  - a dropped invented file;
  - times read, written, compared and ordered;
  - the footnotes of all four kinds;
  - tracks, parts and the whole, the piece behind a recording and its names;
  - twelve file names read as voices.
- `app-cogita-check` 564, `app-json-check`, the style ratchet: pass.
- Browser drive `scratchpad/argdesign/music-browser.mjs` (headless Edge, LocalDB): 21/21. It covers:
  - the tab with one button per kind; the fields of a recording and of a score; the two headings of the kind select;
  - a piece made from the picker; a choir typed as a performer becoming an institution;
  - three tracks uploaded at once and named Sopran / Alt / Całość (whole); three files more on the server;
  - a track played after decryption; the tracks kept over a reload;
  - the Muzyka list and „Źródła” without music; a score with two PDFs (Partytura, Tenor) shown in place;
  - a track removed after a question that names it, its file gone;
  - the recording moved to another library: its two files sealed there, gone here, and playable there;
  - the phone width; no console errors.
- The Wywód drive still passes 42/42 on the same build.

**Owner:** rebuild and deploy the site; no database or API change.

## F1 — Who has a reservation: dates in the list, both-way step filters, step columns in the table (2026-10-27)

**Asked:** in the confirmation form the candidates reserve meetings; the list should show who had a reservation and who
did not.

**Built** (no database or API change — the "Wybierz termin" step of 0100 already counts every reservation the
person's link holds or asked for at the step's resource, also one the office entered for that person)
- **Zgłoszenia** (`FormPeople.tsx`) and the page module **Lista osób** (`pages/parts/entries.tsx`): every row shows a
  tag per "Wybierz termin" step — `termin 17.11, 18:00`, `… · czeka` (waiting for a yes), `termin był 20.10, 18:00`
  (already past), or `bez terminu` (warning colour). `steps.ts` `bookingTags`.
- **The step filter** (`entryDesk.ts`, both lists and the bar of "Panel osoby") has a group per step, both ways:
  `zrobione` / `brakuje`; for a booking step `ma termin`, `termin dopiero będzie`, `termin już był`,
  `termin czeka na potwierdzenie`, `bez terminu` (values `done: next: past: wait: todo:` + step key, carried in
  `?filtr=`). "Napisz SMS" writes to the filtered people — e.g. a reminder to everyone `bez terminu`.
- **Tabela** (`FormTable.tsx`): after the questions a read-only column per step — the reserved date
  (`2026-11-24 18:15 (czeka)`, sortable), otherwise the day it was done, `po terminie`, or a task's `3/5`; each with
  the same both-way filter; in the CSV.

**Not covered:** a reservation made under the person's own account role (signed in, not through the form link) — the
service cannot tie a role to a form entry.

**Checks:** `app-platform-check` §13 (filters both ways, booking done/next/past/wait/todo, tags, filter words; also the
alert order after K2's two new kinds); a DB-free harness in headless Edge (`scratchpad/bookharness`, 13/13: tags,
list filters, table column, date sort, table filter); `tsc` clean; style counts hold.

**Owner:** rebuild and deploy the site. If the form has no "Wybierz termin" step yet: Kroki → add one with the
meetings' resource — the reservations already made through the links count at once.

## C2 — Cogita: one question scheme, the learning order, statistics; books and courses (2026-10-27)

**Asked:** a question scheme (one, or one per type of question?) and its JSON; a structure so that general knowledge
is asked before the specific (the atom before its orbitals) — an entry in the scheme or built into the code; two
scenarios with the import JSON and a general guide for one's own AI — a novel about a real person (what the book
tells and what is historically so, the book as the source) and the Missal (numbered prefaces, pages in series
`12*`, `3'`, `3''`, `(7)`); step 1 the book with its bibliography at once, step 2 a menu to pick two or three ways
of building the course; statistics of how someone learns (how much, time per question, known / not known; counted by
the hierarchy, by spacing, with forgetting); the revision on a page given by link; MCP compatible; then the learner
inside the Kurs area, using only what exists.

**Built**
- **One kind „Pytanie” with a type** (`questionTypes.ts`): 13 types in four groups, fields shown by type through the
  generic `when` („Pokaż, gdy”, any own kind can use it); editor `QuestionFields.tsx` with chips, ticked options,
  pairs (pasted, „Ile par naraz”, headings), a live preview and what is missing; long pair lists make one card per
  pair (`questionCards`). Schematy → Rodzaje lists Pytanie with its types.
- **The learning order** is declared, the engine runs it: ref fields `prerequisite: up|down` („Kolejność nauki”), a
  question's `needs`/`about`; `prerequisites.ts` (graph, levels, basics pulled in), the revision gate on mastery
  (knowness × last correctness), fresh cards lowest level first, Nauka → **Ścieżka** (`LearningPath.tsx`), an entry's
  place, the view grouping „Od podstaw”, „karty czekają na podstawy” at the end of a revision.
- **Statistics** (`measures.ts`, Postępy): per learner and per question, time per answer, now / in a week / how long
  it holds; known counted as Pamięć (A.1), Z hierarchią (A.3) or Ostatnia odpowiedź; scope base or one revision.
- **Learning on a page** (`pageLearner.tsx`): as the page's person; a link without an account introduces itself
  (a link person) and its answers go to the course's intake, where the teacher sees them by name.
- **Kurs** (`AreaKindPanel.tsx`): the main page is made with the course revision on it („Nauka na stronie” adds it
  later), the learners' link aims at that page, „Postępy uczących się”.
- **Library — pages of separately numbered parts, for any book**: a page is written as printed with any marks
  (`12*`, `3''`, `(7)`, `A12`, `†3`, `xii`, `iv*`); the series is the pattern of its marks, its number band computed
  from the pattern (FNV-1a, the same in `AiAccess.PageValue`) — no list of marks (`locations.ts` `readPage`,
  `seriesIndex`); the work field „Serie stron” orders the series by one example page each (`xii 12* 1 3'`); a text's
  directory (`ManifestPart.series`) and the AI snapshot (`pageSeries`) name the series so pages are written back as
  printed; „Gatunek” for books; `AiMcp` instructions on the learning order and on such pages.
- **Templates — general schemes, one per kind of knowledge, not per book**: `pytania.json` (generated,
  `scripts/pytania-template.mjs`), `podstawy.json` + `przyklad-atom.json`, `fakty.json` (Fakty i źródła: „Fakt”
  from any source — novel, textbook, report, recording — with headword, kind, when, where, about whom, period, source
  and place, how the source tells it, the judgement after checking, other sources; „Okres” `@czas/okres` with a date
  range), `zbior.json` (Zbiór: „Pozycja” — prefaces, songs, psalms, articles, works, pictures — with number,
  designation, beginning, theme, marks, picture or sound, group, places in one or more works, easily confused with,
  difference, use; „Grupa”), `wywod.json` („Czy istnieje naprawdę” in Element stały), and the guide `ksiazka-AI.md`
  for any book (the layers and their schemes, step 1, the menu A–F, build rules; appendices from the app by
  `scripts/ksiazka-guide.mjs`). Revised the same day after the owner's review: the first versions were shaped by the
  two scenarios (a „Część księgi” with Missal kinds, a fixed list of page marks); the scenarios are now examples
  of the general schemes, each tested in `app-cogita-check` with two different cases (a novel and a recorded debate;
  a Missal and two hymnals).

**Found by the course drive and fixed:** a link holder could not open a base of a closed area on a page
(`/workspace/libraries` now answers the link's roles like its entries already did, and the page carries the link
proofs without a session); after „Przedstaw się” the previous (in-browser) learner was used until the new one
loaded, so the first answers stayed in the browser (`useLearner` gives only the current holder's learner, „Zacznij”
waits for it); a tall revision or flow module skipped „Przedstaw się”; the learners' table in Postępy is open for a
course base.

**Checks:** `tsc` clean; `app-cogita-check` 625; `app-library-check`, `app-json-check`, `app-presentation-check`,
`app-world-check`, `app-platform-check` pass; `vite build` OK; backend 0 errors, `Api.Tests` 551 (page series in
MCP, the same numbers as the app); `app-style-check` is one over only through another session's new `preview/previewProbe.ts`. Browser drives on
LocalDB: questions 29/29; course 22/22 twice (Kurs tab builds base, import, page, role, link; a learner without an
account introduces themselves and answers; the teacher sees name, counts, time, question by question, three ways).

**Owner:** deploy the API (`-p:PublishProfile=Webio -p:IsGetPasswordEnabled=true`) — the MCP page series and link
holders reading a course base need it — and the site. No database change.

## L3 — A book whose chapters begin mid-page: no false duplicates, every part compared (2026-10-27)

**Asked:** the import of a full Italian book (Teresio Bosco, *Don Bosco*, 51 chapter parts) into CogitaTempBib reported
an overlap — "obejmuje te same miejsca — czy to nie ten sam fragment pod innym kluczem?" — for every chapter; find
the cause, keep the whole text, the chapters and the pages, no hiding and no merging.

**Cause and fix**
- Every part of a text starts with a `page` block for the page it begins on (parts are read on their own), so two
  consecutive chapters share the page where one ends and the next begins. The page check counted that as covering
  the same places. Now only a shared boundary page is allowed; more shared pages, or exactly the same pages with the
  same blocks and words, still warn (`sourceText.ts` `overlapsWith`).
- The import preview kept only the last part of a document (every part had the same temporary id), so each part was
  compared with the one before it only — a real duplicate further back went unseen (`sourceImport.ts`
  `previewPortions`).
- The format description for AIs says it: a part starts with its page even when the previous part ends on it; every
  chapter is its own part, checked against the table of contents.
- The document itself: chapters 22 and 33 were never split off — their numbers and titles stood as plain blocks
  inside chapters 21 and 32. A corrected file (`Downloads/Don_Bosco_CogitaTempBib_PELNY_TEKST_IT_53_czesci.json`,
  53 parts) splits them at those blocks and makes number and title headings; no word of the text changed. The
  "corrected" file from the AI that merged everything into one part was not used.

**Checks:** a scratch validation with the app's own import code (16: the same 4 712 text blocks in the same order,
pages in order 1–254, 53 parts, no warning into an empty library, over the first import, twice; a merged leftover
and a chapter under another key still warn); `app-library-check` (boundary pages allowed, a whole text over its
chapters and a copy under another key named); a browser drive on LocalDB into a library named „CogitaTempBib” with
content of its own (14: no warning, 53 parts with pages, the existing work and author kept and not doubled, the same
file again adds nothing); all checks pass, Api.Tests 551.

**Owner:** rebuild and deploy the site, then import the corrected file. If CogitaTempBib already holds the merged
„Testo integrale”, the preview names it: remove the text on the work page („Usuń tekst”) and import again.

## C3 — Offline revision with the learning order (2026-10-27)

**Asked:** check the offline mode for the new Cogita parts and prepare it.

**Found and fixed** (`offline.ts`, `RevisionRun.tsx`, `LearnView.tsx`, `learn.ts`)
- The kept copy stored the gate „Najpierw podstawy”, but the offline run read it back as no gate — offline, details
  came before the basics. `offlineSource` restores it.
- Offline the service cannot be reached, so the learner had no history: with the gate, everything already known
  would be held back again. The copy now keeps the learner's earlier answers to its cards; `Learner.remember` uses
  them for computing only (never sent again; the same ids from the service replace them later).
- The copy kept the course target without the intake's public key, so answers sealed offline could never be read
  by the course (Postępy). It keeps the key now; online the current one is fetched as before.
- Cards whose question shows a file (the new „Obraz albo dźwięk → która to?”, question media) are not kept: the
  file cannot open offline.

**Not covered:** learning on a page through an access link (course learners without an account) has no offline
mode, as before.

**Checks:** `app-cogita-check` 628 (the copy keeps the gate, the kept answers open the next level, file cards are not
kept); all suites pass, Api.Tests 551.

**Owner:** rebuild and deploy the site. Copies kept before this change still run, without the gate and history —
they are replaced the next time the revision is done online.

## C4 — Sign in without the network; the shell without network with Nauka (2026-10-28)

**Asked:** offline mode must not need an internet login — a login on the device is enough; the app must not sign
out when offline; add it to the SMS-offline mode.

**Was:** every session check that failed (no network) counted as „nobody signed in”: a cold start offline, or the
next click after the network went, showed the sign-in form, which cannot work offline — the copies were unreachable.

**Built**
- `session.ts`: `Unreachable` and `sessionNow` tell „no network / no service” (or 8 s without an answer) from „no
  session”. `App.tsx`: offline nobody is signed out (a known account stays; the bar shows „Bez internetu” leading
  to the copies); a cold start offline opens `shell/AloneShell.tsx` (it replaces `phone/SmsAlone.tsx`): SMS in the
  SMS edition, Nauka bez internetu everywhere; it checks again every 15 s and on `online` („Ponów” too).
- `core/away.ts` — signing in on the device: in the app (and the dev server, for tests), in the mode `kept`, while it
  keeps copies, the device holds the account's salt and the envelope of its master key, sealed under the device key
  (`Field.AwayAccount`). Argon2id of the password opens the envelope or not; the password key stays in the tab, and
  when the network is back with no session `resumeAway` signs in with it — no second password. Signing out,
  „Tylko w pamięci” and dropping the last copy remove it.
- `offline.ts` — copies per account, sealed under HKDF(device key ‖ the account's copy key from its master key):
  neither the device nor the password alone opens them. A copy carries the learning person (id, public key); it
  takes in the answers of the online run (at the end / on leaving) and those given offline. `AwayLearn.tsx` —
  the login, the copies, a run; also Nauka's „bez internetu” with an open or closed key ring.
- `learn.ts`: an intake that could not be fetched offline is not remembered as missing; `flushWaiting` sends what
  waits in the outbox as soon as an account is back (`App.tsx`), whether or not a base is open.

**Checks:** `app-cogita-check` 636 (sealing and opening, the password check with Argon2id, the copy key, an offline
answer readable by the course and the person); browser drive on LocalDB `away-browser.mjs` 20/20 (online copy, cold
start without the service, wrong and right password, offline answers in the outbox and the copy, back online without
a password, outbox sent, progress from both rounds, network lost while signed in, sign-out clears the device); all
suites pass.

**Owner:** the app gets it with the next APK; in the browser only an open tab benefits (no service worker).

## A2 — The JSON import formats over MCP and the AI link (2026-10-28)

**Asked:** include the specification of the JSON imports in the MCP.

**Built:** `frontend/scripts/import-formats.mjs` writes `backend/Api/Library/ImportFormats.json` from the app's own
descriptions (library, work with text, source text, knowledge base, forms for adding, Scriptorium, page, area,
calendar scheme and plan, registry), the AI guides and the ready schemes (19 formats; long ones in parts of ≤ 24 000
characters with contents, JSON templates whole); `app-json-check` fails when it lags behind the app. Embedded in the
program (`ImportFormats.cs`); MCP tools `list_import_formats`, `get_import_format` (instructions say to read the
format before preparing an import); over the link `/ai/<link>/formats[/<id>?part=n]`, in the guide and the OpenAPI.

**Checks:** Api.Tests 556; `app-json-check` passes.

**Owner:** deploy the API.

## A3 — JSON for every part of Recreatio, and all of it over MCP (2026-10-29)

**Asked:** organise all JSON import rules and make them available to an assistant over MCP; then implement the JSON
for every part of Recreatio.

**Built** (overview: JSON.md) — one pure `<part>Json.ts` per part (format as a `jsonTree` node with samples, export,
plan with lines and warnings), a panel where the part's tools live, saving only through the part's existing
functions (sealed in the browser), and a check script per part:
- `calendar` — a calendar's appointments: series (timetables), program points, scheme values, days of a series.
- `masses` — masses and services with their intentions per day (the intentions book), conflicts previewed.
- `tasks`, `bookings` (resources, rules, slots; claims export-only, collisions warned), `chat` (export of a
  conversation; import never in someone else's name: topics, own messages marked „Z importu”, moves, pins),
  `contacts` (beside vCard), `roles` (new roles under grantable holders, renames, holdings; never removes),
  `persons` (one's own data), `workspace-view` („Czeka na Ciebie”), `addresses` (aliases, domains; DNS listed),
  `learn-progress` (one's own answers as a new sealed batch), `lamps`.
- MCP (`list_import_formats`, `get_import_format`): 35 formats in 67 parts, also the place-dependent ones with a
  worked example (`form`, `form-entries`, `quotes`, `text-plan`); tool texts and instructions name every part.
- `app-json-parts-check` (in `app:check`) runs every `app-json-<part>-check.mjs`.

**Without import, on purpose:** Sprawy, keys, access and AI links, seats, the data controller. **Not yet:** SMS.

**Checks:** 12 part checks pass; `app-json-check` (35 formats follow the app); all suites, build; Api.Tests 556.
Browser drive on LocalDB (`argdesign/json-api.mjs` → `json-parts-browser.mjs`): every panel opened as a person does,
export, unchanged export (no change), a sample imported, export again, that export re-imported (no change) — 74/74
with a fresh account (role keys made, masses and intentions, calendar series, bookings, chat in Notatki, lamps …).

**Owner:** deploy the API (the embedded `ImportFormats.json`) and the site.

## C5 — Cogita revision as a storyboard: knowness per item, knowness in views, presets instead of modes (2026-10-30)

**Asked** („Claude Code prompt: Cogita revision as storyboard”): information plus a view that decides what comes next;
knowness belongs to the item (cards are evidence, weighted in the schema); a simple incremental formula with named
rules; views and revisions filter and order with knowness through the existing condition logic; a revision can take a
saved view as source; a fixed set of order/pick options, each explainable; presets instead of hardcoded modes
(„Najpierw podstawy”, and „Od ogólnego do szczegółu” in `fakty.json`); remove the special code; the Don Bosco case
from schema + JSON import + a view alone, tested on a fixture. **Plus:** beside every JSON import, how the imported
data is used in the whole system.

**Found before building:** the knowness formula (A.1) used the last three answers; „Najpierw podstawy” was a revision
node (`gate`) with its own eligibility code (`closedBy`, `unmetNeeds`, `withBasics`, `heldBack`, a level filter in the
session), and the session ordered by level even without it; flows had a second form of the same rule (`prerequisite`);
the condition logic (`logic.ts`) already had „Znajomość”, but only of a fixed id; views filtered only field values.

**Built:**
- `knowness.ts` — one step per answer (`CardState`, `step`, `stateOf`): right × 3 of the time that passed (never
  shorter than before), partly a third (≥ 1 day if days passed), wrong 5 min, right after a mistake 0.4 × the best
  interval before it; knowness = last correctness × 10^(0.5·(1 − t/interval)); snapshots v2 carry the state.
- `knowing.ts` — item knowness = weighted mean of its answered cards (`Template.tests`, `Card.tests`) + inference
  (A.3); relations for conditions (`self`, `cards`, `before`, `up`, a field), `CardGate` for revisions.
- `logic.ts` — `rel` and `each` on „Znajomość”; `ConditionEditor` offers them in views and revisions.
- `selection.ts` / `views.ts` — steps `filter.when` and `learning`, `keep` on `follow`/`structure`/`learning`, columns
  and sorts `#knowness`, `#due`, `#level`; the viewer's own knowness in Wpisy (`CogitaCtx.learner`) and in the page
  module „Widok” (the page's person).
- `revision.ts` — conditions travel with the cards and are checked during the run; `source.view`; `order`
  (general/text/date/random/given/due) and `pick` (next/weighted); `Why` + `whyText`; `waiting`; `migrateRevision`
  turns an old `gate` into the general steps (planning, editor, JSON import/export, old offline copies).
- Presets: „Najpierw podstawy”, the daily revision and „Od ogólnego do szczegółu” from general steps (`presets.ts`);
  `fakty.json` gains „Miejsce” (coordinates), weights on its card templates, the view and revision „Od ogólnego do
  szczegółu”; `przyklad-atom.json` and the AI book guide (E1, E4) use the general steps.
- Flows: `prerequisite` is read as a „Warunek” on knowness (`migratePrerequisites`).
- UI: why line and waiting summary in the run, „Co sprawdza ta karta” (weights) in card templates, order/pick in the
  strategy, „Powtórka z tego widoku”, „Moje wpisy” in Postępy, a migration note in the revision editor.
- Docs beside imports: the course format describes knowness, weights, knowness filters, views as sources, order/pick,
  presets in schemes and how the app uses the data; every other format got „Jak aplikacja używa tych danych”
  (four agents, each claim checked in the code); ImportFormats.json regenerated (35 formats, 68 parts).

**Removed:** the `gate` node and `Plan.gate`, `closedBy`, `heldBack`, `unmetNeeds`, `withBasics`, `entityMastery`,
`masteryOf`, the A.1 formula, `blockedBy`/`gateOpen`, the flow step `prerequisite` (read as a condition).

**Checks:** `app-cogita-check` 679 (new: the rules as ranges, weighted items, relative conditions, the Don Bosco
fixture end to end — view and revision —, gate and flow migration, old offline copies); all JSON checks; tsc.

**Owner:** deploy the site and the API (the embedded `ImportFormats.json`). Re-import `fakty.json` into bases that use
it to get „Miejsce”, the weights and the presets.

## A4 — MCP: what steers learning in a knowledge base (2026-10-30)

Owner spec (German, pasted): the read-only MCP should give for a knowledge base not only entries and schema but
everything that steers learning — templates (name, kinds, direction, graph, tests), revisions (whole graph), views
(mode, steps, group/matrix, columns, sort, outline), flows, collections, anchors, forms, settings (libraries used,
dependencies, who reads), and per template how many cards it really makes — in the format of the export
`recreatio.cogita.course` with `@…` names, as a new tool, in parts for large bases; no learner progress or answers.

- Browser: `cogita/json.ts` `exportSetup(lib, name)` = `exportCourse` without entities (the same `docJson`, so the
  same shape and names) + `cards` (per template: `ref`, `name`, `kinds`, `source?`, `cards`, `entries`, `problems?`;
  `questions`, `total`) from `lib.cards()`. `aiAccess/aiSnapshot.ts` `snapshotSetup(parts, id)` adds `readers`
  (`members` / `everyone` / `members-until-opened`, from the library row as „Kto czyta” computes it) and
  `snapshotDoc(…, setup)` puts it as `setup` into a knowledge base's snapshot; entries of a base carry `ref` (their
  `_ref`). Cards are counted with the sources inside the link only.
- Service: `AiAccess.Snapshot.Setup`, `Item.Ref`; `Opened.Get` also takes `@id` and `@lasting/name`.
  `AiMcpTools.GetKnowledgeSetup` → `SetupOf(snapshot, section, offset)`: everything if ≤ 60 000 chars, else an
  overview (sections with counts and sizes, settings, cards) and per section (English keys or the app's Polish names)
  in pieces with `nextOffset`. An old snapshot → `not_ready` (rebuilt after the next write or when the panel opens).
- Checks: Api.Tests 563 (7 new), app-cogita-check 682 (setup of the Bosko fixture equals the export's templates/views,
  card counts equal the app's cards, nothing of progress), app-library-check (snapshot with setup, `ref`, only bases).
- 2026-10-31 — privacy guard: settings leave with their structure only (`sources`, `dependencies`, `tags`,
  `motivation`, `offline`, `joinPage` — not `storageAreaId` / `contributionLibraryId`); keys that could carry a
  learner's state (`marks`, `correctness`, `knowness`, `dueAt`, `progress`, `learners`, `accountId`, `answeredAt`) are
  dropped everywhere, in the browser (`json.ts` `PRIVATE_KEYS`) and again in the service (`AiMcpTools.Scrub`); keys
  under `fields` are field names (a form's `answers`) and stay. Failing card counts no longer cost the snapshot
  (`cards.failed`). Checks: Api.Tests 564, app-cogita-check 684, LocalDB drive `mcp/setup-e2e.mjs` 15/15.

## C6 — Cogita: the learning screen (2026-10-31)

Owner spec „Cogita – learning screen changes” (scope: only how cards are shown, answered and explained; no change to
kinds, schemes, templates, revisions, views or the import format). As built — COGITA.md §5 „The learning screen”.

- `CardFace.tsx`: options shuffled per showing (stored indices kept), equal width; date precision line; „Sprawdź” →
  „Dalej” in place; ✓/✗ on the own answer; no long „Poprawnie” line for order/match/choice; explanations via
  `EntityReading.tsx` (`ExplainList`: collapsed, the question's topic first, technical fields never shown).
- `OrderAnswer.tsx`: pointer-event drag with live preview, auto-scroll, keyboard, live region, marks with the right
  place, „Pokaż poprawną kolejność” (FLIP).
- `cardBasics.ts` `shuffleAway` / `shuffledPairs`, used by `cards.ts` and the palette's order/match nodes: never the
  stored order (fingerprints unchanged). `check.ts`: fair partial credit for order and date, `orderMarks`,
  `PRECISION_ASK`. `revision.ts`: short `whyText`, long `whyDetail`.
- `RevisionRun.tsx`: „Nowy temat” before the first question about an unmet topic; inline „Zgłoś problem” with
  `prompt`, `given`, `expected`, `correctness`; `Pending.tsx` shows them.
- Checks: app-cogita-check 693, tsc, style; LocalDB drive `learnscreen/learn-browser.mjs` 42 + `learn-reports.mjs` 6
  (mouse, touch and keyboard ordering, marks, toggles, match partners, date precision, collapsed explanations, the
  report read back with the intake key, phone width in dark mode).
- Set aside (built the same day from the first, wider prompt, not in the tree): a topic scheme `tematy.json` with
  „Który to temat?” cards, a course check before publishing, branch revisions in Ścieżka, guide changes — kept as a
  patch in the session scratchpad.

## C7 — „Nowy temat” as reading, a reading pattern per kind, statistics with charts, the course's base (2026-10-31)

Four owner requests of the same afternoon. As built — COGITA.md §2.2 (`reading`), §5 („Nowy temat”), §7 (Statistics),
EVENTS.md (the course's base).

- `reading.ts` (pure): `readingSource` (a list right under its line starts a list; a bold-only line stands alone),
  `headingOf`, `leadAt`, `readingParts` (lists folded under their bold heading, a lead-in with a colon inside),
  `citedPlaces`, `formatReading` / `readingPattern` (the kind's `reading`). `EntityReading.tsx`: `TopicIntro` (lead
  with formatting and footnotes, clamped; „Czytaj dalej” / „Zwiń tekst” in place; a footnote in the lead expands and
  jumps; ↩ from a note opens its fold; „Czytaj tekst” to the reader or the passage), `ReadingPreview` for the kind
  editor; explanations read the same text. Schema: `KindDef.reading` (readKind, kindDoc, built-in overrides, JSON
  merge with warnings, review line, problems for unknown fields); JSON description, `ksiazka-AI.md` and
  `ImportFormats.json` regenerated.
- `knowStats.ts` (pure): stages per card, days, forecast, topics, question kinds, hardest, streak; `classStats` for the
  teacher. `measures.answerIndex` (answers per card in one pass). `KnowCharts.tsx`: hand-drawn SVG (measured width),
  tooltips on hover and focus, arrow keys, a table under each chart; in `Progress.tsx` (own, class, each learner) and
  at the end of `RevisionRun` (loaded when opened). Colours validated with the dataviz validator on #ffffff/#1f1c16.
- `AreaKindPanel.tsx`: „Wybierz istniejącą” / „Wybierz inną” / „Odłącz” for the course's base — the learners' role
  reads the base's area (`createCommonRole` for both areas, or `joinArea`), the page's revision follows
  (`pointRevisionPart`), the old area can be closed (`dropFromArea`). Nothing new is stored: a course's bases are those
  of the area and of the areas its learners' role reads; the one on the main page leads.
- Checks: app-cogita-check 709, tsc, style, library, JSON parts 12/12, formats/guide, schemes 111, JSON 35 formats.
  LocalDB drives (session scratchpad `topicpanel/`): `topic-browser.mjs` 22 (phone 390 and 360, clamp, footnote jump,
  folds, ↩, „Czytaj tekst” to the reader, a kind pattern in the panel, the explanation and the editor preview),
  `stats-browser.mjs` 12 (charts, hover and keys, range, tables, class heat map, a learner, phone dark, end of run),
  `kurs-browser.mjs` 13 (pick, switch, unlink; memberships read back from the service).

## C8 — A course uses many bases, answers go where the learning happens, answers in each person's own area (2026-11-01)

Owner: „a course should use multiple bases and one base should be usable by multiple pages … the course is only a
help and not a necessity”, then „the teacher has no possibility to see the answers of the student”, then „the virtual
role of the form … the admin of the form has read ability … used to show their correctnesses”. As built — COGITA.md §7,
EVENTS.md (the course's bases).

- Where answers go is said by the PLACE (`cogita/answersTo.ts`): a learning module's field „Odpowiedzi uczących się do”
  (`answers`, field kind `area`, `pages/PickArea.tsx` with the intake state), else the revision's area (the editor's
  field is now an area picker and is honoured), else the base's Ustawienia, else the person's private area. A base is
  never changed by a course, so one base serves many courses and pages.
- The service (`Cogita.cs`) also takes answers into an area INSIDE one the learner reads, if it has an intake (a
  course's leaders' area), and says `verdict: "area"` when it refuses; the browser then moves the waiting batches to
  the fallback (`Learner.retarget`: private area for a person, the base area for a seat) instead of keeping them for
  ever.
- Per person (0136, `learn_batch.area_epoch`): when the place names a form's virtual area („Obszary osób”, 0120), a
  person of that form sends into HER own area of it, sealed under its epoch key; whoever reads that area by the rule
  (the leaders) opens it — no intake. Seat grants say their `virtualAreaId`; `/workspace/learn/area/{virtual}/batches`
  returns the batches of every person's area the caller reads; the area list groups them under the virtual area.
- Teacher: `GET /workspace/learn/library/{id}/areas` (areas with answers to a base that the caller reads, with
  counts); Nauka → Postępy chooses the area („Uczący się z obszaru”), `postepy/<area>` in the address puts the learners
  first; each learner opened shows his answers one by one (question, the answer in words via `givenText`, right or
  wrong, time); names from the answers area, the areas above it and the base's area; a link „Odpowiedzi uczących się →”
  under a learning module for whoever leads its area.
- Kurs tab (`AreaKindPanel.tsx`, `areas/courseBases.ts`): any number of bases — the course's own, the ones shown on its
  main page, the ones kept under import keys of kind `library` (0135; the old key `base` counts); „Utwórz nową bazę”,
  „Dodaj istniejącą” (no change to the base), per base „Dodaj na stronę”, „Wpuść uczących się”, „Odłącz” (closes the
  area only when no other course base lies there), „Postępy uczących się” where its modules send; checks for closed
  areas, the main page without learning and modules whose answers do not go to the course or an area inside it.
- Checks: app-cogita-check 714, app-duty-check (course bases), tsc, style, JSON 35 formats (ImportFormats.json
  regenerated), parts 12/12, platform, library, schemes 111. LocalDB drives (session scratchpad `many/`):
  `many-browser.mjs` 26 (two courses share a base, a course with two bases, the leaders' area inside a course, link
  learners per course, the teacher's chooser and answers, unlink), `va-learn-api.mjs` 9 and `va-learn-browser.mjs` 4
  (a form's „Obszary osób”: answers in the person's own area, refused for another person, read by the leader).
- Later the same day (owner: „the user in the module should see his own statistics and charts”): „Moje statystyki” in
  the modules Powtórka, Przebieg and Nauka (osoba z linkiem) — `ModuleStats.tsx` (lazy) with `KnowledgeStats` for the
  module's cards and „Moje odpowiedzi” (`AnswerLog.tsx`, moved out of `Progress.tsx` so a page does not load the
  teacher's screen); a button beside „Zacznij”, above the run in a tall module; „Wróć” back. Drive `many-browser.mjs` 30.

## L4 — Textbooks in the Library: formulas in LaTeX, theorems and proofs, labels (2026-11-01)

Owner: the full-text import (a PDF turned into JSON by one's own AI) must keep mathematical and scientific books
whole — formulas, matrices, symbols, proofs — readable, searchable, usable for studying, with chapters and pages.
The AI stays outside the app; the work is in the format, the import and the reader. As built (LIBRARY.md „Textbooks”):

- Format `recreatio/source-text` v1, compatible: formulas `$…$` / `$$…$$` in every text (Pandoc's rule, and no `$`
  after a digit or letter — Polish prices); blocks `statement` (19 kinds, label, title, `text` or nested `blocks`),
  `figure`, `code`; table label and caption; `{{ref …}}`; `edition.macros`. The description and both prompts say how
  (LaTeX for every formula, read from the page image, `\tag` as printed, doubled backslashes in JSON, what KaTeX lacks)
  with a validated textbook example; ImportFormats.json and the AI guides regenerated.
- `core/tex.ts`: reading, repairs (control characters from single backslashes — known KaTeX words and the text's own
  macros —, `\( \)`, `\[ \]`, bare environments, doubling, definitions → macros, `\tag` in a sentence, page marks in
  formulas), `texPlain`, `prepareTex` (KaTeX's gaps). `core/jsonText.ts`: JsonPanel reads JSON as an AI writes it
  (invalid escapes, no escaping at all with `\\` kept as a row break, fences, raw line breaks) and says it repaired.
- `ui/tex/`: KaTeX 0.19.1 + mhchem, lazy (woff2 only), `Tex`, `TexText`, punctuation glued to a formula, copying and
  selections give LaTeX; a numbered equation's number never covers a wide formula.
- Source texts: statements stored flat (`id`/`in`), nested in export; directory `formulas` and `labels`; labels in
  `placeInManifest` (also other places: „pokaż w tekście” for `Twierdzenie 2.3`), `labelBlocks`, the reader's
  boxes with ∎, references as buttons (into other parts too), labels in „Przejdź”, search by symbol and LaTeX,
  next/previous part, KaTeX preloaded when a text has formulas; preview sets every formula and names the broken ones,
  gaps in pages, references without target, double labels.
- The shared markup sets formulas (knowledge bases, Scriptorium, Cogita, page texts, presentations, quotes); LaTeX
  export with amsmath/amssymb.
- MCP (API deploy): snapshot blocks with `labels`, `end`, `within`, `search`; `read_text` by label; statements quoted
  in the rendering; a symbol term matches inside formulas (`Has`).
- Checks: `app-tex-check.mjs` (new, in `app:check`): 108 formulas, repairs, lenient JSON, the textbook fixture (two
  chapters, 84 formulas, 14 boxes) clean and spoiled four ways → identical blocks, warnings, drawing, snapshot, markup;
  Api.Tests 569 (textbook snapshot); library, json, style, preview, slides, presentation, cogita 714 (before a parallel
  session's change). Browser drive on LocalDB (session scratchpad `tex/tex-browser.mjs`, 28): the textbook pasted
  unescaped → preview repaired, every formula set → import → reader (KaTeX, numbers, boxes, ∎, figure, code),
  references and labels, search, selection → quote with LaTeX, copy, phone 375 px, dark.

## C9 — Cogita: dates checked part by part; every pair shown counts (2026-11-01)

Owner, with two screenshots of the learning screen: „1829 11” was judged wrong for November 1829 („Poprawnie: 1829-11”),
and a „Połącz w pary” card came back many times in a row in almost the same set. „Create a real date check — every part
checked on its own, a year one off as near (50 %), month and day separately. Also think why the second question is
asked many times in a row.” As built — COGITA.md §5 (learning screen, long pair lists) and §6 (pick).

- Dates (`check.ts`): `readDateAnswer` reads every usual form (numbers in any order with any separator, Polish month
  names in any case form and without Polish letters, English names, Roman months, filler words such as „r.”, „roku”,
  „w”, „ok.”); a day without a year or an unknown word is unreadable, never guessed. `checkDate` scores each asked part
  on its own (1 / ½ for one off, also across a month or year boundary / 0): year ½ (all when only the year is asked),
  month and day share ½; right = all parts right or within the tolerance; the closest accepted answer counts;
  `Outcome.dateParts` and `near`. `dateAsked`: never more precise than the answer is known.
- Card (`CardFace.tsx`): the reading under the field („= listopad 1829”), an unreadable answer is not submitted (the
  card says how to write a date), the verdict lists day / month / year with ✓ ≈ ✗ and the right value, the right answer
  in words („listopad 1829”, `dateText`), „Prawie” also for a near date at 50 %.
- Why the pairs came back: the question „Połącz nazwę z tym, co mówi o niej książka (Rozdział 6)” has 6 pairs and
  „Ile par naraz” 4, so each pair is its own card showing 3 others; an answer counted only for the card's own pair, the
  3 others just matched stayed new, and the next card of the same list came straight away — up to 6 times. Now
  `pairEvidence` (`cards.ts`) gives every pair shown its own answer (right or wrong), `RevisionRun` records them and the
  session steps them (`answer(…, also)` in `revision.ts`: settled pairs leave the stack and the queue); the card asked
  is scored by its own pair. And `pickFrom` does not take a card of the same entry right after one, while another card
  waits (not in a deliberate sequence: `next` with `given`, `text`, `date`).
- Checks: app-cogita-check 728 (date reading and scoring, the screenshot's answer, boundaries, unreadable, `dateAsked`;
  pair evidence, a 12-pair list learnt in fewer cards, no two cards of one question in a row). A DB-free browser
  harness (the real `RevisionRun` bundled with esbuild, session scratchpad `cardrun/`, 12 checks, light and dark): the
  month question read and right, the day question near part by part (63 %), the unreadable answer, the 6 pairs settled
  in 2 screens, never twice in a row.

## C10 — Cogita: three bands, the stack of the owner's algorithm, cards that share answers (2026-11-01)

Owner: knowness bands as in his original algorithm — below 5–10 % unknown, from there to 100 % "to be asked" (from the
least to the best known), above 100 % known; a repeat interval is the moment knowness falls just under 1 (to be
asked), not "unknown"; a stack of ~10 cards asked until fully right, a free place filled from "to be asked", then
unknown, then the least known of the known. Then: "the correctness of one card should be usable for other cards —
cards and knowledge items should cooperate. Implement the hardcoded parts and create a prompt how the schemes should
be built." As built — COGITA.md §6 („Three bands, the stack, cards that work together”), the prompt
`templates/cogita/schematy-AI.md` (also over MCP as „guide-schemes”).

- Bands (`knowness.ts`): `FORGOTTEN` 0.1; levels keep their names, mean the bands — `unseen` „nieznane” (never asked,
  wrong last, forgotten), `learning` „do powtórki” (0.1–1), `known` „znane” (≥ 1); `levelOfKnowness`, `levelOfState`.
- Stack (`revision.ts` `fillTemporal`): do powtórki weakest first → nieznane in the revision's order → (with
  `plan.ahead`, default for `temporal`, off with `endWhenDone`) znane weakest first; known cards in the stack only when
  nothing else is there, then the weakest; partly right cards stay asked. `Why` reasons `weak` / `forgotten` /
  `missed` / `ahead` with their words. `RevisionRun`: „Zakończ” shows the end of the run (a run „na zapas” does not
  end by itself). Preset „Tylko zaległe” ends; the others go on.
- Conditions (`logic.ts`): `band` (`learned` | `known` | `due` | `unknown`), editor select (ui.tsx), text; presets and
  the editors' defaults gate on `learned`; the old preset shape `rel: before|up, ≥ 1` reads as `learned` (existing
  revisions and views, e.g. „Od ogólnego do szczegółu”, stop hiding details when the general card is due).
- Bounded inference (`propagate`): max of own and child × impact (impact ≤ 1), never a sum.
- Cards share answers through facts (`Card.facts`, `cards.ts` `answerFacts` / `answerEvidence`, replaces
  `pairEvidence`): pair facts of „Połącz w pary” (pair cards, and the whole-list card), template `asks` (reader, JSON
  import/export, schema export, editor „O jaki fakt pyta”); a card takes an answer when all its facts were answered;
  the run records them and steps them (`answer(…, also)`). Not yet in flows and live sessions.
- Statistics stages follow the bands (`knowStats.ts`: zapomniane < 0.1, do powtórki 0.1–1).
- JSON description (`json.ts`) for bands, `band`, `asks`, `endWhenDone`, bounded inference; ImportFormats.json and the
  guides regenerated.
- Checks: app-cogita-check 742 (bands, the stack order, why by band, „na zapas” weakest first, `endWhenDone`, band
  conditions and the old shape, bounded propagation, facts and `asks`), app-json-check (36 formats), full app:check.
  DB-free browser harness (session scratchpad `cardrun/drive-bands.mjs`, 8): due → forgotten → new → „na zapas”,
  the band of each card in words, „Zakończ” → summary with the three bands, the condition editor (old ≥ 1 → poznane,
  znane, liczba…).

## C11 — Cogita: what Lemma-style courses need (2026-11-01)

Owner's spec „Cogita: what the app still needs for Lemma-style courses" (one idea at a time, idea card, varied
exercises, a short test, a clickable progress map; first course: the LAAG1 lecture script). Everything a course is stays
data; this is only what the app had to do. As built — COGITA.md §5 „Lessons in the style of Lemma".

- 2.1 Formulas: `plainText(…, tex)` / `plainOf(…, 'keep'|'inline')` keep `$…$`; `labelOf(…, tex)`, `lib.labelTex`,
  `entityNameTex`, `EntityTitle`; `TexText` in cards (options, pairs, items, tiles, gaps, expected answers), lists,
  views, Struktura, search hits (`display`), flows, sessions, the teacher's tables (`texClip.ts` shortens without
  cutting a formula). A question prompt with a formula keeps it (`card.prompt`); without one it is the old line.
  Typed answers: `typedVariants` (also the line without LaTeX and the source without dollars), the verdict shows the
  answer as written (`Outcome.shown`).
- 2.2/2.3: `hints`, `explanation`, `feedback` on the card (`cards.ts`; feedback follows its option through `choicesOf`,
  `tidyQuestion` and the shuffle); `withHints` caps (¼ each), `AnswerRecord.hints`; Verdict: explanation expanded, then
  the collapsed entries; a sentence under the chosen and the right options.
- 2.4 `build` (`check.ts` `checkBuild`, `BuildAnswer.tsx`); `order` with `preview` (`BuildPreview`).
- 2.5 Gaps: `GapSlot`, `pieces`, `checkGaps`, `GapAnswer.tsx` (listbox with formulas, keyboard); old multi-gap questions
  keep their fingerprint (only `choices` change it).
- 2.6 Python: `python.ts` `runCode` case by case (load first, then 2 s per case, restart after a timeout, at most two),
  `pythonCode.ts` (the worker's Python, testable under Pyodide in node), `CodeAnswer.tsx` (examples, table per case).
- 2.7 `questionParams.ts`: draw, `let`, `require` (60 tries), `{…}` placeholders that read a parameter (LaTeX groups
  stay), numbers with a comma / `{,}` in formulas; `redrawCard` per showing in a run; `AnswerRecord.params`.
- 2.8 Template nodes `calc` „Oblicz", `aggregate` „Zbierz", `random` with a list (`cardPalette.ts`, `nodeFields.ts`).
- 2.9 `lessonProgress`, `LessonEnd.tsx`, `practicePlan` (levels, two right after a mistake), revision `next`
  (`lessons.ts` `nextLesson`, editor select, `PREFER.next` in the import), `onOpenRevision`.
- 2.10 View mode `quilt` (`quilt.ts`, `QuiltView.tsx`): tiles by band with marks, panel, „Ćwicz to", „Otwórz w źródle";
  Postępy per learner, the class map and per-question statistics.
- 2.11 Motywacja „Serie dni nauki" + `dailyGoal` (`DailyGoal.tsx`, in Nauka and at the end of a run).
- Found on the way: a choice or pair answer was stored as positions in that run's shuffled card, so the teacher's log
  and „most frequent wrong answer" could name the wrong option; `storedGiven` now stores the option texts (old answers
  are read as before). „Ćwicz to" lists the entry and its questions as the source (`practiseGraph`) — the spec's
  `source.list [entry] → follow` gives nothing for an entry without cards of its own.
- Data: question kind fields (`hints`, `explanation`, `feedback`, `extra`, `preview`, `alternatives`, `join`,
  `choices`, `tests`, `params`, `let`, `require`); field type `json` (one value of its own shape, never „poza
  schematem"); `pytania.json`, `ksiazka-AI.md`, the JSON description and ImportFormats.json regenerated.
- Checks: app-lemma-check (55: formulas in labels, old fingerprints, hints, feedback, build, gaps, params, code
  examples, export → import of every new key and `next`), app-lemma-templates-check, app-lemma-code-check,
  app-lemma-lessons-check, app-lemma-quilt-check; app-cogita-check 742. Browser: DB-free card harness (session
  scratchpad `lemma/drive.mjs`, 42: formulas, hints, feedback, build by tap/mouse/keyboard, gaps with listboxes,
  params, order preview, phone dark) and the real app on LocalDB (`lemma/course-api.mjs` → `course-browser.mjs`: three
  lessons with `next`, the end screen, „Ćwicz te jeszcze raz", Python with examples, hidden cases and timeouts, the
  daily goal, the quilt).

## C12 — Cogita: the history of a card after each answer (2026-11-01)

Owner: "after answering a card there should be a view of how the knowness of this card developed — a chart with the
10 % line, the 100 % line and the value directly after the answers — over the last 7 days, 30 days, 90 days etc."

- `knowStats.ts` `cardHistory(marks, from, now, until)`: the curve as corners (between answers knowness falls as
  10^(−t), a straight line on a log axis, so the ends suffice; the floor crossing at `HISTORY_FLOOR` 1 %), the answers
  with knowness before/after, due (falls under 100 %) and forgotten (under 10 %) times; the state before the range is
  replayed, so a shorter range starts at the right value.
- `KnowCharts.tsx` `CardHistoryChart`: ranges dzień / 7 / 30 / 90 dni / rok / od początku (auto: the smallest showing
  every answer; a choice is kept in localStorage), the three bands behind, 10 % and 100 % lines, a point per answer
  (by grade), dashed future, „teraz”, a tip per answer (arrow keys too), the table, a note when earlier answers lie
  outside the range. `RevisionRun` shows it under the verdict when there is a learner (lazy, same chunk as the
  statistics). Colours: the statistics tokens (`.cg-stats, .cg-card-history`).
- Checks: app-cogita-check 753 (+11: same value as `knownessOf`, points right after answers, the jump, range clipping,
  due/forgotten times, floor, never asked), full app:check. DB-free browser harness (session scratchpad
  `cardrun/drive-history.mjs`, 7, light and dark): no chart before the answer, auto range, 316 % after a right answer,
  7 days with the note, the tip „0% → 316%”, a new card answered wrong.

## C13 — Cogita: knowness falls ever more slowly (2026-11-01)

Owner, on the C12 chart (one right answer, then a plunge to 0 within a day): "the knowness shouldn't fall linear but
limited". The old curve q·10^(½(1 − t/I)) is exponential — after a first right answer (I = 15 min) one day is 96
intervals and knowness 10^−47.

- `knowness.ts` `knownessAt`: q·√(10 / (1 + 9·t/I)). Same at 0 (√10 = 316 %) and at the due time (exactly 1), so the
  intervals, the due times and the order of the stack are unchanged; after that the fall slows down (a day after one
  right answer ~11 %, a month ~2 %), 10 % only after 111 intervals, never 0. „Zapomniana” therefore comes much later;
  until then a card stands in „do powtórki”, weakest first.
- `knowStats.ts`: `fallsTo` inverted for the new curve; `piece` samples 24 points per stretch, evenly in
  log(1 + 9·t/I) (dense right after an answer). Topic shares in the statistics are higher accordingly.
- Texts: the JSON description (`json.ts`), COGITA.md, `schematy-AI.md`; guides and ImportFormats.json regenerated.
- Checks: app-cogita-check 754 (bands at 111 intervals, the stack fixture's forgotten card at 2000 min, the slowing
  fall, the history's due/forgotten times and bent future), full app:check. Browser harness: `drive-bands.mjs` 8,
  `drive-history.mjs` 8 (new: one right answer 44 h ago still ~8 % before the next answer, the bent curve).

## C14 — Cogita: „Kilka z kilku” sentence by sentence (2026-11-01)

Owner (a "Welche Sätze sind Aussagen?" card with six sentences): "such cards shouldn't be asked separately for every
version, but concern every sentence separately, and the correctness should be the sum of these parts."

- `check.ts` `checkMany(correct, given, count)`: with the count, each sentence is right when marked and good or left
  out and not good; correctness = the mean (before: hits ÷ max(wanted, given), a correctly left-out sentence earned
  nothing). Nothing marked is still „no answer”.
- `cards.ts`: the `many` answer carries `set` (`share` or the question); `sentenceFact(set, text)`; the whole card has
  one fact per sentence; `answerFacts` judges every shown sentence. `sentenceCards`: with `show` (fewer than the
  sentences, at least 3 sentences) each sentence its card `question:s<hash>` with `show − 1` others (at least one
  good), fingerprint = the sentence, its own fact, the feedback per sentence kept.
- Fields: `show` („Ile naraz”, now for pairs and sentences), `share` („Wspólne zdania”); editor block under the
  choices (`QuestionFields.tsx` `Sentences`); type description; pytania.json, the guides and ImportFormats.json
  regenerated.
- Checks: app-cogita-check 763 (+9: per-sentence score, facts, cards per sentence, fingerprints, evidence for each
  shown sentence, the whole card's mean, `share` across versions, versions apart without it), full app:check. Browser
  harness `cardrun/drive-many.mjs` (3): a sentence card with three sentences, a 1-of-3 answer = 33 %.

## C15 — Cogita: parts of every question as facts; pairs with `share`; a prompt for agents (2026-11-01)

Owner: "For connecting (two columns, event–year) this also applies?" — yes (pairs were facts since C10, scored pair
by pair, `show` per pair); only sharing across versions was missing. Then: "Think about a generalized way possible to
apply in different card/knowledge items — also create a prompt for the agents, so that they can create a JSON import to
match the new format."

- `cards.ts` `partFacts(question, data, answer, prompt)` — one rule for all forms: match → pairs, many → sentences, gap
  with several gaps → words (`gapFact`, `answerFacts` judges each gap from `outcome.marks`), truefalse → one sentence
  (`sentenceFact`, shared with a many of the same `share`), any other form → one part only with `fact`
  (`namedFact`; `"#facet"` + `about` → `entryFact` = `<entry>#<facet>`, the template cards' `asks` fact). Without
  parts nothing changes. Pairs: the `match` answer carries `set`, `pairFact(set, …)` — ids without `share` unchanged.
- Fields `share` („Wspólne części”) and `fact` („O jaki fakt pyta”) shared by every question (`QUESTION_SHARED`);
  editor: under pairs and in the sentences block `share`, for the other forms a fold „Wspólne odpowiedzi z innymi
  pytaniami”. JSON description: a „części” paragraph.
- Prompt `templates/cogita/czesci-AI.md` (MCP `guide-parts`): what the app counts, the keys, a decision table, an
  example, what not to do, a checklist; `schematy-AI.md` points to it.
- Checks: app-cogita-check 771 (+8: share across pair lists, true/false = the many sentence, `fact` across forms,
  `#data` = the template fact, gap words each on its own and shared, the guide's example parses and shares what it
  says), full app:check; pytania.json, guides and ImportFormats.json regenerated.

## C16 — Cogita: Nagrody — points, streak, goal, levels, badges, live charts (2026-11-02)

Owner: gamification in Cogita as a first step — an animated streak („another day of learning”), points for every
answer, „selectable for every scenario, not hard-coded”, modules on a page like the Bosco learning page that animate
the earning live, and a module with live charts and statistics; generalized.

- Engine `cogita/rewards.ts` (pure): `readRewards`/`rewardsData` (tolerant), `REWARD_PRESETS` (5), `rewardsFor`
  (chosen > settings > first > built-in), `rewardState` (events with stable ids: `a:/f:/s:/c:<answer>`, `k:<card>`,
  `g:/d:<day>`, `l:<n>`, `b:<badge>`), `lastDays`, `todayLine`, `freshEvents`. Doc kind `reward`, JSON `rewards`.
- Live: `learn.ts` — learners of one person in one base hear each other (`tell`/`hear`, BroadcastChannel), idle flush
  20 s, `refresh()`; `AnswerRecord.lead` on evidence answers (RevisionRun).
- UI: `RewardViews.tsx` (`useRewards`, `RewardBoard` strip/compact/block/full, `RewardHud`), `LiveStats.tsx`
  (tiles, points today, points and goal per day with a goal line — `KnowCharts` `Columns`/`Line` got `rule`/`pulse`),
  `rewards.css`; page modules `cogita-rewards`, `cogita-stats` (`pages/parts/cogita.tsx`, views in `cogitaViews.tsx`);
  field `rewards` on `cogita-revision` and `seat-learn`; `pageRewards.ts` (a page's rules reach its revision run);
  FieldDef `none` (what an empty optional picker means). Workspace: Nauka → Nagrody (`RewardsEditor.tsx`: own board,
  documents, presets, editor, JSON, live preview), Ustawienia → Motywacja „Punkty i nagrody”, board in „Ucz się”,
  points bar in Nauka runs.
- Checks: `app-rewards-check.mjs` (80, in app:check), app-cogita-check 776 (+5 JSON round trip), json/style checks.
  Drives (session scratchpad `rewards/`): `drive.mjs` DB-free harness (31: live across learners and tabs, floaters,
  flame, ring, effects end, 1100 and 390 px); `page-api.mjs` → `page-browser.mjs` on LocalDB rcd8 (17: a real page
  with revision + both modules, points after the idle flush and reload, Nauka → Nagrody total, editor preview).
- Needs: frontend build + deploy; API deploy only for the MCP format text (ImportFormats.json). No migration.

## C17 — Cogita: generated exercises (2026-11-03)

Owner (agent prompt „generated exercises and the knowledge landscape”, task 1): exercises generated on every show
from ranges, lists of entries, logic and calculations, deterministic from a seed, for questions and templates.

- `generator.ts` (one generator; `questionParams.ts` re-exports), `expr.ts` (lists/records/functions behind
  `compile(src, {lists: true})` — Animation unchanged), `cardPalette.ts` (node `generate`, `random.count`, calc `l0…l7`,
  card inputs `hints`/`solution`), `cards.ts`/`cardBasics.ts` (seed, params with lists and `@id`, skip + reason),
  `check.ts` (`spaces`, `scripts`), `learn.ts` (`AnswerRecord.seed`), `store.ts` (`genWorld`, `kindOf`, `redrawn`),
  `RevisionRun.tsx` (per-show instances for templates, seed with the answer, asked version in „Do poćwiczenia”),
  `GeneratorSamples.tsx` (10 samples + redraw rate in the question and template editors), `generatorImport.ts`
  (import warnings), `CardFace.tsx` (computed numbers shown as precisely as the tolerance asks).
- Checks: `app-generator-check.mjs` (65), app-cogita 776, lemma, sim, motion, world unchanged. Drive (scratchpad `t1/`,
  DB-free): 28/28 — 7 questions and 7 template cards right and wrong, km/h for m/s, Na₂O typed plainly, seeds.

## C18 — Cogita: the knowledge landscape (2026-11-03)

Same prompt, task 2: a view mode that shows any base with a learning order as the viewer's landscape.

- `landscape.ts` (heights, routes, lock, sectors, hex layout, budget/focus; internal API), `landscape.worker.ts` +
  `landscapeClient.ts` (worker, main-thread fallback), `landscapeData.ts`, `landscapeImport.ts` (warnings: cycles, unknown
  axis kind, no prerequisites), `LandscapeView.tsx` + `landscape.css`; `views.ts` (mode `landscape`, `landscape.budget`),
  `EntityList.tsx`, `knowing.ts`/`logic.ts`/`revision.ts` (relation `chain`), `pages/parts/view.tsx`/`viewViews.tsx`
  (`krajobraz`, `answers`, `rewards`), `RevisionRun.onDone`, `QuiltView` exports `QuiltPanel`; `knowness.ts`
  `acyclic`/`propagate` without recursion and with a fast path (same results).
- Checks: `app-landscape-check.mjs` (60). Drives (scratchpad `t2/`, DB-free, StrictMode, real worker): LAAG 17/17, Bosko
  16/16, Wpisy 7/7, the world example at 1200/390 px; lock → review → entry learning end to end. Real page on LocalDB
  (scratchpad `rewards/world-api.mjs` → `world-browser.mjs`, 13/13): the view module in `krajobraz` mode with rewards,
  learning from a ring field, points live in „Punkty i seria”, the landscape moving after the run, generated tasks on
  the same page.

## C19 — Cogita: guides, examples and preview for C17/C18 (2026-11-03)

- Guides `generatory-AI.md` (MCP `guide-generators`), `schematy-AI.md` §2.5 (designing for the landscape); examples
  `przyklad-generatory.json` (`example-generators`), `przyklad-swiat.json` + `przyklad-swiat-strona.json`
  (`example-world`, `example-world-page`); `import-formats.mjs` → ImportFormats.json.
- Preview MCP tool `preview_knowledge` (`frontend/mcp`, `preview/PreviewKnowledge.tsx`, `cogita/memoryBase.ts`): a
  knowledge-base JSON as an in-memory base — the landscape (or any view) for progress none/partial/all at desktop and
  phone width, and ~10 instances of every generator with answers and redraw rate.
- Needs: frontend build + deploy; API deploy for the MCP texts. No migration.

## C20 — Cogita: landscape fixes after the first real test (2026-11-03)

The owner's tablet test on Bosko (ring over budget as a diagonal band, overlapping hexes and labels, empty valley, eight
equal fallback areas named after arbitrary topics). Heights, knowness, bands and the lock rule unchanged.

- `landscape.ts`: budget split by bands (`landscape.bands`, `LS_BANDS` 0.5/0.2/0.1), ring/valley/mountain group fields
  per area (home area), goal route always single; hex rows (valley, one ring row, free row, mountains), order-keeping
  placement in every pass, drawn lift that never covers the cell behind; `sort` respected; entries without a value in
  the centre; `treeAreas` (subtrees named after their root) without `group`. `selection.ts`: axis `depth` ("all" | n),
  nearest value per path, own value wins; landscape mode makes a structure-up `through` transitive. `landscapeData.ts`,
  `views.ts` (`bands`), `EntityList.tsx` (band share inputs), `LandscapeView.tsx` + `landscape.css` (measured labels,
  area names on the outer arc, marks inside the hex, pit layer, test hooks `data-ls-area`, `data-ls-arcs`).
- Docs: `json.ts` (format; regenerated `ksiazka-AI.md` appendix and ImportFormats.json), `schematy-AI.md` §2.5,
  `przyklad-swiat.json` (`nr` + `sort`, `bands`).
- Checks: `app-landscape-check.mjs` 112 (row order desktop/phone, arc drift, an overflowing goal route). Real pages on
  LocalDB (scratchpad `verify/`: `expected.mjs` computes every topic's areas from the JSON alone; `bosko-real-browser.mjs`
  measures the rendered SVG at 1280/820/390, grouped and ungrouped, 151/156 — the 5 misses are area names moved inward
  along the arc at narrow widths; `locks.mjs` 13/13; `rewards/world-browser.mjs` 13/13 at 1280 and 390).
- Needs: frontend build + deploy; API deploy for the MCP texts. No migration.

## C21 — Cogita: a course import saves its new kinds and entries — in one transaction (2026-11-03)

Owner's report: importing `bosko-krajobraz-obszary.json` into Bosko saved the changes to existing items but never the
new kind „Obszar krajobrazu" and its 8 entries; the field `obszar` and the view's group pointed at kind ids that were
never stored, and every re-import minted a new id.

- Root cause: the review (`ImportReviewPanel.tsx`) planned the document for the preview and planned it AGAIN on save;
  `planImport` minted fresh ids for everything new each time. The ticks were keyed by the preview's ids (`k:<id>`,
  `e:<id>`), so on save every new item counted as unticked and was dropped; `decidedPlan` then silently stripped
  references to them from entries and docs (stages lost `obszar`, the group lost `kind`), while a kind's `to` kept the
  dangling id. Reproduced on LocalDB with the committed code: preview „Nowe 9, Zmiany 12", result „Zapisano 10 z 10.".
  The failed saves created no rows; they rewrote the kind, the 8 stages and the view (no orphans to remove).
- `json.ts`: `importIds` — the same document (object) gets the same ids for its new items in every planning, per base;
  `importProblems` — a save never stores a reference to a kind or entry that would not exist (field `to`, an entry's
  kinds, ref values, a view's source/group/axis kinds, anything pointing at an unticked new item) → `ImportBlocked`,
  one line per item and field; only what the save changes is checked (old dangling values elsewhere stay quiet);
  `applyImport` saves everything as ONE batch in dependency order (new kinds, changed kinds, new entries, changed
  entries, docs with views after what they name) and refreshes the AI snapshot right after. Skipped `@names` name the
  entry AND the field. `importReview.ts`: `decidedPlan` blocks instead of stripping; `importSession` (one plan per
  document and base revision for preview, review and save); `changeSummary` counts real changes; values compared as
  stored (`query: ""`, `columns: []` were 2 phantom changes on every view — the owner's „12" was 10).
- Backend: `POST /workspace/library/{id}/entries/save` (`Library.Batch.cs`) — up to 5000 entries / 40 MB in one SQL
  transaction: every row locked and checked (library, version) first, all problems named, then written; nothing on
  any problem. Client: `LibraryStore.saveAll` (seals all, one call, 24 MB cap), `CogitaLibrary.saveBatch`.
- MCP freshness: the server compares a snapshot's mark with the collection's current one — `/ai/{token}`
  (`current`, `changedAt`), `list_collections` (`SnapshotCurrent`, `ChangedAt`), `get_knowledge_setup` (a note starting
  `STALE SNAPSHOT`). The browser rebuilds the snapshot right after an import (`refreshAiNow`) and flushes pending
  rebuilds when the tab is hidden.
- Checks: `app-import-check.mjs` (36: the owner's flow end to end with preview ids, second import 0 new / 0 changes,
  all-or-nothing, blocked references by item and field, repair of the broken state); Api.Tests (batch reading and
  problems, stale note). LocalDB run (scratchpad `import-fix/bosko-import-real.mjs`): old code ×3 reproduces the bug;
  fixed code saves 19 rows with one timestamp (9 new), ids = preview ids, the AI link reads `@bosko-nauka/obszar/etap-1`
  at once, a second import shows 0/0.
- Needs: API deploy (new endpoint, MCP texts) BEFORE the frontend deploy (the import calls the new endpoint). No migration.

## C22 — Landscape: the view keeps its place across tabs, Back/Forward and reload (2026-11-03, Part 2 A)

Owner's report: every time the landscape's tab was left and reopened, the view reloaded and jumped to the top.

- Cause: on `visibilitychange` the store syncs, and `sync()` always bumped the revision; `EntityList`/`viewViews`
  recounted the cards with `useAsync` (value reset to "loading"), replaced the map with "Liczenie kart…", the
  landscape unmounted and the page collapsed.
- `libraryStore.ts` `sync()`: a revision only when entries came back (or the first load). `ui.tsx` `useAsyncKeep`:
  the old value stays while the new one is counted (returns `[value, busy]`); `store.ts` `cardsReady()` + a card cache
  per store (a new view of the same base shows its cards at once).
- `LandscapeView.tsx` `useKept`: memory per base and view (last picture, zoom, chosen field, open panel, width,
  scroll); zoom (`obszar`, a history step) and chosen field (`pole`, replaced) in the address — on a page with the
  module's scope (`<zakres>.obszar`); Back/Forward follow it; scroll restored instantly while the page grows (never
  recorded while restoring, user scroll wins); a small "liczenie…" marker while cards or the map are recounted.
- `EntityList.tsx`: unsaved view settings (budget, band shares …) kept per view (memory + sessionStorage, dropped
  after save or when the saved view changed) and whether "Dostosuj" stood open.
- Browser tests (scratchpad `import-fix/a-browser.mjs`, `a-page.mjs`, LocalDB): hidden/visible without and with a
  change by another client (same element, no "Liczenie…"), another tab and back (zoom, field, panel, scroll ±4 px,
  settings, "Dostosuj"), Back/Forward through zoom levels, reload (zoom and field from the address), page module with
  scoped keys — all pass, no console errors.

## C23 — Landscape: a fixed map where only the heights change (2026-11-03, Part 2 E with B.1, B.3, C, D)

Owner's report: the map reflowed with every bit of progress; the ring collapsed into a few counted fields; group
fields showed bare numbers; nothing showed how topics connect; the panels under the map read like an admin tool.

- `landscape.ts`: `directionTree` (equal arcs in the author's order) + `fixedLayout` (cells from structure only, depth
  bands per area, claims in creation order, one edge-to-edge grid) built once in `setInput`; `layoutOf` only lifts
  cells, cuts the budget and sets the camera. Budget per area and band with one "+N" field each (B.1), round-robin,
  unused room ring → due → valley → mountains; group marks "○ 14 / ◑ 3 / ● 5 / ▲ 25" (B.3); `links` (prerequisites
  through entries without cards), `unlocks`, `progress` (cards known/total, `landscapeData.ts`).
- `LandscapeView.tsx` / `landscape.css`: prisms back to front, outlines of "+N" fields, lit paths with dimming,
  numbered routes, the quest popover with hover intent (EntryPanel, AreaPanel and the map's `title` removed), rims
  as two stacks, zoom with flat faded surroundings and the learner in view.
- `EntityList.tsx` settings words; format text in `json.ts` (→ `ksiazka-AI.md`, `ImportFormats.json` regenerated).
- Not done in E: B.2/B.4/B.5 are replaced by E as asked. Subtree zoom (`sub:<id>`) was tried and dropped — groups
  are areas × bands now.
- Checks: `app-landscape-check.mjs` rewritten for the fixed map (100 checks: determinism, nothing moves under
  progress/budget/zoom/width/goal, one grid, equal sectors, own arc, depth order, additions push nobody, heights,
  zoom camera and rims, budget per area and band, no "+1", B.3 counts, unlocks, links, progress, 10 000 entries:
  map 0.2 s, an answer 0.1 s in node). Browser (scratchpad `landscape-e/e-accept.mjs`, LocalDB Bosko with a learner,
  real mouse events): 54 checks at 1280/820/390 — one grid, own cells, budget, ring singles, symbol language, names
  never overlap, area order, no tooltips, no sideways scroll, same cells at every width/budget/zoom, rims by direction,
  zoom in the address, hover intent, paths and route numbers, popover contents, Esc and outside click, „Co dalej"
  hover, phone sheet; no console errors. `npm run app:check` and `vite build` pass.

## C24 — The path map: a course path that forks and merges (2026-11-03, Part 2 F)

- `cogita/pathLayout.ts` (model: effective needs, reduction, levels, centred forks, merges above branches, pooled
  rows; marks: done/due/available/locked, now, lit ways, merges; `branchOf`), `cogita/PathMap.tsx` + `pathMap.css`
  (hex nodes, ways with light-up animation, window, collapsible, follows "now"), `cogita/PathLearn.tsx` (author order,
  gauge states, unit members, „Ucz się" run), `cogita/flowPath.ts` (a story's entries, order, forks, chapters).
- Nauka → Ścieżka shows the map (list kept as a fold-out); `FlowPlayer` shows it beside/below the story, in sync
  (now, branch light, tap jumps, chapters done by story or knowledge); page module `path` (registry, page format,
  `ImportFormats.json` regenerated); landscape unit fields open their path full size with Back to the same place.
- `contentOfLibrary.cardsOf` = own cards and questions about the entry (`cardsAbout`) — flows' knowness now sees
  what questions test. `CogitaHome` keeps its cards while recounting (no remount flash).
- Checks: `app-path-check.mjs` (36: levels, centred forks of 2/3/10, merges, gaps, determinism, states, merge words,
  branch, transparency, reduction, circles, chain, story order/needs/exits/chapters/now/shown, chapters lead back) in
  `app:check`. Browser (scratchpad `path-f/story-browser.mjs`, LocalDB „Szlak wody", 27 checks): Ścieżka nodes,
  states, due, now, fork/merge positions, "2 z 3", lit ways, window, learning a step, its way lights up when coming
  back; story beside (desktop) / below (390), now, chapters "2 z 3" with only the open path, branch light on hover, tap
  jumps, collapse kept; page modules (story path, lesson path); landscape lesson field with progress ring → „Pokaż
  ścieżkę (14)" → full path in the address → Back to the same scroll; no console errors. Landscape browser test (54)
  still passes. `npm run app:check` and `vite build` pass.

## C25 — Stories that count in Cogita (2026-11-03, Part 2 G)

- Logic: condition `flow` (started / done / goal) — `logic.ts`, condition editor (flow picker), `Facts.flow`,
  `Gauge.flows`/`withFlows`, `RevisionContext.flows`, `flowFacts.ts` (own position, presentation by path, chapters
  kept/restored, goals merged); attached in landscape, Wiedza/page views, path runs, revisions, quilt.
- Positions: `FlowPosition` `done`, `goals`, `path`, `chapters` used; `FlowPlayer` keeps them; `storyRun` keeps done at
  an ending scene and the page path (`PagePresentation.pagePath`, `PublicPage`, `PresentationInNauka`).
- Answers: `AnswerRecord.about` (read back), `answeredCards` (`~page`, never askable); `storyCard.ts` (real question,
  own + about, goal card, `useStoryGoal`); question module keys `question`/`about`; physics/animation `question`/`about` +
  goal recording (`PhysicsLab.onGoal`, `LiveDrawing.onGoal`); `StoryRun.card/resolve`; the run opens its base and
  computes entry knowness for gates; signed-in default person + `targetFor` placement (Nauka sees the answers).
- In-tab sharing: `learn.ts` `SESSION` (answers, snapshots, positions recorded in this tab, absorbed by later learners)
  and positions told to live learners — fixes Nauka missing a just-finished story.
- Units: flow `unit`; landscape lowers done units, shows units of stories, unit view tells the story and its state;
  `landscapeState(…, lowered)`.
- Presentation paths: scene `about` (reader, writer, page format), `presentationPath.ts`, companion PathMap in Nauka
  (`DriveControl.jump`, route-aware now), page module `path` for presentation flows, `storyKnow` (steps without cards
  count when shown).
- Example: `templates/cogita/przyklad-opowiesc.json` + `przyklad-opowiesc-strona.json` (lesson, start → fork of three
  → merge, three real questions, gates by knowness, path module, flow with unit, a view filtered by the flow condition).
- Checks: `app-story-check.mjs` (22) in `app:check`. Browser (scratchpad `story-g/story-browser.mjs`, LocalDB, 22):
  view empty before; intro gate (not learned → shown); fork with path module "0 z 3"; real question prompt; answer →
  back to fork, "1 z 3", node done; all three → meeting scene → end; Nauka → Ścieżka topics done; landscape lesson in
  the valley, unit "ukończona"; flow-condition view filled; second run skips the intro (lesson learned); Nauka
  presentation with its path (5), tap drives to „Chmury", now follows; no console errors. F (27) and E (54) browser
  tests still pass; `npm run app:check` passes.

## C26 — MCP documentation for stories, flows, the path and landscape maps (2026-11-03, Part 2 H)

- `json.ts` flows section rewritten (every step and exit, merging chapters, goals, narrators, `unit`, presentation
  flows, positions and the condition `flow`, path beside the story, module `path`, `recreatio.cogita.flow`);
  `exportFlow` carries the unit; `ksiazka-AI.md` and `ImportFormats.json` regenerated.
- New: `templates/cogita/opowiesci-AI.md` (`guide-stories`), `example-story` + `example-story-page` registered in
  `scripts/import-formats.mjs`.
- `cogita/landscapeExport.ts` + `aiSnapshot.ts`: the snapshot carries `landscapes`; `AiMcp.cs`: section
  `landscapes`/`krajobrazy` (whole result when it fits, own section with paging), descriptions, server instructions
  and the note (flows in full, fixed maps, snapshot rule, stale flag); `AiAccessChecks.cs` two more checks.
- Verified on LocalDB (scratchpad `story-g/mcp-check.mjs`, MCP JSON-RPC over the AI link, 10 checks): the flow in
  full with lasting names, the flow condition kept in its view, the lesson landscape as cells/areas/regions without
  heights, `landscapes` among the sections and as its own section, the note, a current snapshot — and after a
  browser import of a new landscape view a fresh snapshot 2 s later carrying its map. Backend checks pass;
  `npm run app:check` passes.

## C27 — Landscape: popover placement, routes as one graph, labels, colour, borders; the entry editor's side column (2026-11-03, Prompt 3)

- Hover shows only a field's connections; the popover opens on selection (click, tap, Enter, address). It is rendered in
  the document (`position: fixed`): above, below, right or left — whole in the window, the field free, the fewest route
  marks covered; head (title, ring, button) fixed, lists scroll (12rem); a bottom sheet under 640 px with room under the
  page. "W środku" lists every member; the route list every step and the goal.
- `cogita/landscapeDraw.ts` (new): `hexRoutes` (A* on the grid, shared pieces once), `cellEdges`, `placeLabels` (rank,
  alternatives), `numberedStep`. Route numbers replace height labels on route fields; next three + goal numbered, the
  rest dots; badges move to a hex corner when their centre is taken. One collision pass over marks, numbers, area names
  and names.
- Colour: whiter = less known/available (known full colour → due → ring → mountains nearly white; ground whitest);
  group borders drawn per cell inside the land (no overlay layer); ring edges in the area's colour.
- Entry editor (`.cg-split`): the side column sizes to its content (its cards stretched to the form's height with
  90–297 px gaps between rows) and the form's track is `minmax(0, 1fr)` with `overflow-wrap: anywhere` (a long value
  without break opportunities widened the track and ran every field under "Odwołują się tutaj"); `.cg-ref` wraps
  left-aligned.
- Checks: `app-landscape-check` 116 (16 new: routes, labels, numbering). Browser (scratchpad `prompt3/`): LAAG
  "Lernlandschaft" (owner's course JSON in the harness, a ▲20 field selected at 1280/820) 17 — 38/44 route pieces, all
  unique, all between neighbouring cells; numbers 1, 2, 3, 21, dots 4–20; no overlapping labels; popover whole. Bosko
  LocalDB 22 — every aggregate near the top edge at 1280/820 (field at the top and in the middle of the window): hover
  opens nothing, click shows the whole popover with title and button, the field free; "W środku" 69 members in 12rem;
  route of „Zdrowie ucznia i kleryka (1832–1839)" (5 steps here: 1, 2, 3, 6; 1–4 when 3 steps are missing) without
  overlaps; whiter = less known in every area; 390 sheet with the field above it. Editor 8 (Edge; old rules forced back
  reproduce the screenshot). E 53, F 27, G 22 still pass; `npm run app:check` passes.

## C28 — Story units: the review lowers, the button starts, the lock screen (2026-11-03, Prompt 5)

- `flow.ts` `review`; `flowFacts.ts` `storyStage`, `STORY_BUTTON`, `reviewStart`, `storyUnitsOf`, `pageGoals`; `storyRun.tsx`
  records the goals of the flow pointing at the page; `LandscapeView.tsx` lowers on "passed", the popover's story
  button and inline player, „Najpierw powtórz" returns to the story; `LearningPath.tsx` and `pathViews.tsx` story nodes;
  `CogitaHome.tsx` `graj/przeglad`; `PresentationInNauka.tsx` `startAt`; `PresentationView.tsx` + `slides.ts` `?scena=`;
  `storyLock.ts` (new) + `FlowPlayer.tsx` locked screen and the review end screen; `Sessions.tsx` `gate={false}`.
- Example: `przyklad-opowiesc.json` (lesson requires „Stany skupienia wody", questions about topics only, `review`,
  goal „przeglad"), `przyklad-opowiesc-strona.json` (review: counter `opowiesc.przeglad`, gates zero / +1 / result,
  scene „Jeszcze nie" with „Spróbuj jeszcze raz" / „Zakończ na razie"); `json.ts` flows section, `opowiesci-AI.md`,
  `import-formats.mjs` descriptions; `ksiazka-AI.md` and `ImportFormats.json` regenerated.
- Checks: `app-story-check` 31 (9 new: stages with and without goals, button words, review start, story units, page
  goals). Browser on LocalDB (scratchpad `prompt5/p5-accept.mjs`, fresh setup `p5-api.mjs`): the locked screen with the
  missing topic, goal, preview; „Ucz się" opens the story; a due card → „Najpierw powtórz (1)" → back to the story;
  „Kontynuuj opowieść" resumes at the saved scene; review failed → ring + „przegląd jeszcze niezdany" + „Powtórz
  przegląd" (landscape, Nauka → Ścieżka, path module → `?scena=przeglad`); review passed → valley, „Otwórz opowieść".
  Flows without goals: the G browser test on the previous example (no goals) still lowers the lesson when done.

## C29 — Nested landscape: map nodes from the data, one level per zoom (2026-11-03)

- `landscapeNest.ts` (new): `readNest`, `nestPath`, `nestSubtree`, `nestSlots`, `nestLayout`. `views.ts` reads `nest` and
  `nestSort`. `landscape.ts`: the budget clamp is raised (the view passes 1 000 000, so nothing is merged), and `LsLand`
  gains `group`/`share`. `LandscapeView.tsx`: the tree and the level, group review/goal, one primary button, a new map
  drawing (no text, no ground, hover tip, hover/route highlight, two markers, legend), and a larger unit for levels
  with few fields. `landscape.css`: legend, tip, repeat marker, hover/route, group intensity, due deep.
- Example: `przyklad-swiat.json` has kind „Pole mapy" (`@swiat/pole`) and 10 nodes (Matematyka › Liczby › Działania ›
  Ułamki › Dziesiętne i procenty = 5 levels; Fizyka › Ruch / Siły = 2), a field `pole` on every topic, and the view
  `@swiat/w-pola` „Krajobraz pól". Docs: the `json.ts` landscape text, `schematy-AI.md` §2.6 with a full example;
  `ksiazka-AI.md` and `ImportFormats.json` regenerated.
- Checks: `app-landscape-check` 140 (24 new: top level only, one level per zoom, mixed levels, 5- and 2-level
  breadcrumbs, no meaningless cell, subtree ring sums, group band/height/valley/due/lock, fixed positions, packed slots,
  flat view unmerged). Browser (preview server, scratchpad `nest/nest-browser.mjs`): 3 top fields, no `<text>`,
  cells = fields, legend visible, hover = tip + highlight + nothing dimmed, every field opens a popover with one primary
  button, zoom down 5 levels, breadcrumbs back, no console errors. `app:check` passes.

## C30 — One import that creates, changes and deletes by id (2026-11-03, Prompt 6)

- **API first.** `Library.Batch.cs`: `/entries/save` takes `remove: [{entryId, version}]` in the same transaction.
  `ReadSaveRemove` checks: once each, never also saved, state ≥ 1. `RemoveManyProblems` checks: exists, not deleted,
  this library, same state; otherwise 409, and nothing is saved or deleted. A deletion works like `RemoveAsync`: the
  last envelope stays as a version and a tombstone is left. The answer gives `removed`. Tests are in
  `Api.Tests/LibraryChecks.cs`.
- **Frontend.** `library.ts putEntries(…, remove)`; `LibraryStore.saveAll(inputs, progress, remove)` sends the known
  versions, then drops the entries and their files; `CogitaLibrary.saveBatch(…, remove)`; the memory store mirrors it.
  `json.ts`:
  - `{"ref"|"id": "<id or @lasting/name>", "remove": true}` in `entities` and in every doc list; `ImportPlan.removals`.
  - Kinds are never removed by an import (warning).
  - Unknown or foreign items are warned and skipped. Changed and removed in one document = removed only, with a warning.
  - A change by id may omit `kinds`.
  - `removalEffects` / `withRemovals`: ref fields of staying entries and collection lists lose the reference in the
    same save; any other place (flow `unit`/steps, views, revisions, templates, anchors, statement cells) blocks.
  - `applyImport` sends everything as one save.

  `importReview.ts` adds `x:<id>` changes, ticked by default, each naming who loses the reference. `decidedPlan`
  keeps only the ticked ones and adds their blocks. `ImportReviewPanel.tsx` has a „Do usunięcia" section; the intro
  in `CogitaJson.tsx` is updated.
- **History.** Answers stay in the progress. Everything counts from the current cards (gauge, `knowStats`, landscape),
  and the answer log falls back to the stored question text. A restored entry counts again.
- **Docs.** `json.ts` (common part), `opowiesci-AI.md` (corrections and deletions), `schematy-AI.md` checklist,
  `import-formats.mjs` description; `ksiazka-AI.md` and `ImportFormats.json` regenerated.
- **Checks.**
  - `app-import-check`: 69 checks (30 new): change by id, delete with and without references, unticked, blocked by a
    flow and then allowed when the flow goes too, create + delete in one save (and refused = nothing), warnings,
    history, and a 4.15 MB / 1900-entry file in one preview and one save.
  - LocalDB (scratchpad `p6/real-4mb.mjs`), real sealing: 4.15 MB JSON → one request of 6.27 MB, 1.4 s; then 2
    changes + 1898 deletions + 1 new in one request, 0.9 s; cleaned up.
  - Browser (`p6/ui-remove.mjs`, Vite + LocalDB): the deletion is listed with „odwołanie zniknie z: P6 Beta (Wymaga)",
    untick/tick works, saving reports „usunięte: 1", and the reference is gone.
- **Limits.** One save holds at most 5000 items (saves + deletions) and 4 MB per entry. The browser caps sealed bytes
  at 24 MB (≈ 20 MB of JSON). The service caps sealed bytes at 40 MB and the request at 64 MB.

## C31 — A readable Ścieżka: story parts, one direction, fit and zoom, real choices (2026-11-04, Prompt 8)

- **Story parts from the flow** (`storyPath.ts`, new). The map of a story is built from its graph, no longer from its
  entries plus the topics' learning order (that mix caused the unexplained merges, crossings, flipped order and counts):
  - the start and the end are their own marks;
  - "slides to read" = consecutive show/line/expand/opening/scene steps;
  - "questions" = consecutive question steps (or a scene with questions); a step with both shows both counts;
  - "review" = a loop with ≥ 2 questions, plus the `review` step and a lone slide just before the loop;
  - "fork" = choice, chapters, or a scene with several buttons;
  - condition and set steps are transparent.

  `storyMarks`: a part is done once the learner has left it (questions: also learned; review: also everything known);
  a choice counts as chosen; chapters count when all are done; the part after chapters needs all of them. "X z Y"
  counts exactly the drawn hexagons. Hosts: `FlowPlayer` (and the choice screen), `LandscapeView` (story unit),
  `pathViews` (module path), `PresentationInNauka` and `presentationPath` (scenes).
- **Layout** (`pathLayout.ts`): layered (Sugiyama) layout:
  - longest-path levels;
  - dummy points on long edges (`routes`);
  - 24 barycenter sweeps, alternating down and up, keeping the order with the fewest crossings (`crossings`);
  - x placement as the mean of neighbours, keeping order and spacing (`placeRow` with gaps);
  - always bottom → top.

  On entry maps a node with two prerequisites no longer shows a counter: it is no choice.
- **PathMap.tsx / pathMap.css** (rewritten):
  - the whole map fits the panel by default; "+" / "−" doubles the scale up to real size, plus "Dopasuj", drag to pan,
    Ctrl+wheel and "Pełny ekran";
  - kind icons inside the hexagons; the fork is a diamond, start and end are circles;
  - "now" is larger, has a strong outline and its name beside it, always inside the panel;
  - fork counters say „wybierz 1 z 3" / „wybrano 1 z 3" / „ukończono 2 z 3 ścieżek";
  - names appear only on hover or tap; a second tap opens the part;
  - a legend lists only the signs present; dark theme works through both prefers-color-scheme and data-theme.

  The orange dot was `cg-pm-due`: learned, but below 100 % (due for review). It is kept and explained in the legend
  as „do powtórki".
- **Choice screen** (`FlowPlayer`): every option is listed by name with what waits behind it (`branchWork`); a locked
  option says why („Zamknięte, bo: …" / „otworzy się, gdy: …"); chapters list every chapter, done ones as „ukończone".
  CogitaHome keys the player by flow (a direct jump between two stories kept the old state).
- **Path check** (`flowCheck.ts`, new): no start or no end (errors, the import refuses); a second start, an unreachable
  step, an exit leading nowhere, or a loop without a way out (warnings, each step by name). It runs in the import
  preview (`json.ts` flowWarnings / importProblems) and in the flow editor (`FlowProblems`). Without "start",
  `readFlow` takes the one step nothing leads to.
  - Real bases: LAAG has no flows.
  - Bosko has 63 flows. I checked 5 in full through MCP (e1-1, e1-2, e1-3, t10, t11): no problems. They are linear
    stories with a review loop; the "Wątek" flows end with a choice whose roads return to it and „Kończę" ends.
  - The other 58 were not checked one by one here; the editor and every import now show it.
- **Docs**: the `json.ts` flows section and `opowiesci-AI.md` §8a; `ksiazka-AI.md` and `ImportFormats.json` regenerated.
- **Checks**:
  - `app-path-check`: 67 (30 new) — no crossings where none are needed, long edges beside the chain, Bosko-like parts
    and words, counts, three chapters one done „ukończono 1 z 3 ścieżek", a choice of three (stops, roads by name, one
    locked, taken road), the checker (dead end, second start, loop without exit, no start), the Bosko thread shape;
  - `app-story-check` presentation path updated to parts;
  - browser on LocalDB (scratchpad `p8/setup.mjs` + `p8/browser.mjs`): 20 checks — a Bosko-like story fits with
    nothing clipped, start below the end, „0 z 12", "now" named without covering its node, kinds in the legend, no
    text on the map, tap popover, phone 390 px (no sideways scroll), dark theme, chapters, a choice of three, the
    whole-base learning map fits;
  - `app:check` passes.

## C32 — A review has an end; side panel; landscape heights and goal list (2026-11-04, Prompt 9)

- **Review end** (`RevisionRun.tsx`, `RunClosing.tsx` new): the run ends by itself when the engine would only practise
  ahead (`why.reason === 'ahead'`). Closing: „Powtórka zakończona: N kart, wszystkie na co najmniej 100 %", the topics it
  unlocked (ready now, not before; two levels behind what it asked; story or N questions), one big button (origin topic →
  next goal step → first unlocked), „Inne tematy", „Wróć do mapy", quiet „Ćwicz dalej". From „Najpierw powtórz (N)" a
  short message, then the topic opens (`onDone` after 1.3 s). Mistake practice „Wróć" goes to the host's exit.
- **Side panel** (`LandscapeView.tsx`, `landscape.css`): ≥ 860 px a fixed panel on the right (portal), else a sheet of at
  most 45vh; the map stays visible with the field outlined and its route lit; another tap switches the content. The
  content names the topics to review first, says what numbers count („Najpierw powtórz 5 kart", „Pokaż ścieżkę (5
  części)") and drops the unexplained ○.
- **Language** (`lang.ts` new): pl/de/en words for the learning screens; `settings.language` („Język nauki" in Ustawienia,
  kept in the setup export), else detected from the base's names.
- **Follow-ups to Prompt 8**:
  - the lost `review` key: re-importing over existing flows made it a change to an existing document, and those started
    unticked, so saving with defaults dropped it. Now a change that only fills an empty field starts ticked
    (`importReview.ts` `fills`);
  - the 1,371 nodes: the whole-base learning map counted every question (an entity with cards) as a topic. Questions
    about something (`questionIds`) are no longer nodes (`LearningPath`, module path);
  - a choice counts finished roads („wybrano 1 z 3 · ukończono 1"); the option says „ukończone"; taken roads stay lit.
- **Landscape**:
  - 4a goal: an ordered list of steps (state, kind, ✓ when done) kept in the goal position until reached (message) or
    cleared; the closing button becomes „Dalej do celu: X"; route steps are marked, numbered when chosen;
  - 4c height: longest chain of open prerequisites (`chainComp`), equal steps, no cap; the map scales to fit; legend
    „wysokość = ile kroków jeszcze"; `topics` keeps the old distinct count for the panel;
  - 4d markers centred in one style; the lock became „najpierw powtórz, potem dalej"; both in the legend;
  - 4e hidden actionable fields: a ghost outline drawn on top, and the columns in front of the hovered or chosen field go
    see-through (x-ray); rotation in 60° steps; tapping a name in the step list brings the field into view. Ghost +
    x-ray was chosen over lowering front fields because heights carry meaning and must not change on hover.
- **Checks**: `app-landscape-check` 142 (new height semantics, equal steps), `app-import-check` 69.

## C33 — Ask only what is not known; counter, reason, spacer (2026-11-04, Prompt 10)

- **Player rule** (`flowAsk.ts` new, `flow.ts` `PlayContext.skip`, `FlowPlayer.tsx`): a known question (own card ≥ 100 %,
  whole history with merges) is skipped through "right" with no record; slides always shown; every base and flow.
- **Why the story review never ended** (not reproduced on production data — tests run on LocalDB only): the knowness
  formula itself is right (correct answers do reach 100 %). The condition „Wszystkie naraz opanowane?" read a question
  entry through all cards about it (without the merges rename), and ids without cards as 0 — either keeps it false
  although every asked card is known. Now a question reads its own card (`flowKnowness`), ids without cards count as known, and known questions
  are skipped, so the loop only asks what is open. The flow guard was raised from 64 to 600 skipped steps.
- **Spacer** (`pickSpacer`, `revision.ts` `spacerFor`): never the same question twice in a row; a known one comes first,
  „przerywnik", not counted, recorded only when wrong.
- **Counter and reason** (`AskHead`, `RevisionRun`): „Zostało N" with a bar wherever questions are asked (story question
  steps, every temporal review, free practice, mistake practice); `lessonProgress` now works for every temporal plan and
  leaves the spacer out. The reason line names the topic and why.
- **Path counts** (`storyPath.ts` `questionSteps`/`askCounts`/`knownStep`, `PathMarks.ask`, `PathMap` `words`): „2 z 5 pytań
  do odpowiedzi", all known — reading only (icon too); hosts: player, landscape story panel, module path.
- **Not covered**: presentation stories (`storyRun.tsx`) still ask every question of a question scene; live sessions
  (`Sessions.tsx`) keep their own order on purpose.
- **Checks**: `app-ask-check` (new, 12): the user's case — 10 known + 1 unknown, wrong then right → that question twice,
  one spacer, end — both in a story review and in a review by bands, the counter reaching 0 exactly at the end, path
  counts; `app-lemma-lessons-check` updated (every temporal run has a counter).

## C34 — After "Koniec", automatic branches, and a landscape of regions (2026-11-04, Prompt 11)

- **Story (sections 1–3)**: `storyNext.ts` and `runningStory.ts` (new); `storyPath.ts`, `pathLayout.ts`, `PathMap.tsx`,
  `pathMap.css`, `FlowPlayer.tsx`, `storyLock.ts`, `pathViews.tsx`, `PresentationInNauka.tsx`, `presentationPath.ts`.
  - Successors above "Koniec" and on the closing screen, from the learning order and the learner's state (ready, or
    what is missing / due by name; none → nearest learnable field or "Wróć do mapy").
  - Condition steps are automatic: decided per learner, or one `auto` part; loops back to a choice; one end on top;
    fork counts = roads drawn; finished stories count what applied, roads not taken are optional.
  - The Bosko switch bug: a subflow with colliding step ids sharing `visited`; each story now keeps its own, and title,
    path, TERAZ, counters and the question line follow the running story.
  - Popover kept inside panel and screen, path sized by its container with a readable minimum, legend folds.
- **Landscape (sections 5–9)**: `regions.ts`, `levelMap.ts`, `RegionMap.tsx`, `landscapeWords.ts` (new); `LandscapeView.tsx`
  rewritten around levels; `landscape.ts` (`stand`, lazy flat map), worker and client (`stand`, `regions`), `views.ts`
  (`landscape.regions` owner edits), `landscapeExport.ts` (region tree for AI), `EntityList.tsx` (old budget settings out).
  - Regions from the connections (greedy agglomeration, acyclic group graph, cycles kept whole, 5–12 per group, 7–20 on
    top, names from the base or "Rund um …", owner renames/moves kept, previous assignment kept per browser).
  - One level per map (fan, ring = depth — on topic maps the depth in the whole graph —, barycentre, sweeps, gates
    around the fields in the direction of the map above; `routeOrder` region by region).
  - One step per view: largest step with every face ≥ 50 % visible, tilt 0.52 → 1, then cut columns (actionable first,
    hatched), never below 6 px; capped so the tallest column stays near the map's size; orthographic.
  - Two numbers: Stufen (height, chain incl. itself) and Themen (list length incl. itself); badge = Themen.
  - Camera: drag with inertia, wheel and pinch around the pointer, "+"/"−" (below the whole level "−" goes up), 60°,
    "Zu mir", "Ganze Karte"; opens at the next step's level and follows it until the learner moves.
  - Haze, light rim for "now", one light sign per field (review first > due), names on faces when zoomed in, region
    ring and preview, conquered regions (warm, flag, "Gebiet erobert" once), tally, the sentence "Als Nächstes …".
- **Why heights did not match before (6b)**: the old map fitted the step height into a fixed room per map (`geometryOf`:
  t = (room − ground depth) / tallest), so a deep map or a rotation that made the ground deeper squeezed every step towards
  1.2 px — towers became about equally high; nest/"+N" fields stood as high as their NEAREST member while their panel spoke
  of the field's own chain, so a section could look lower than a topic inside it. Now one number per field (Stufen) sets
  the height with one step per view, for every kind of field.
- **Checks**: `app-regions-check` (new, 112), `app-levels-check` (new, 34: maps never mix kinds, ≤ 20 fields, rings by
  depth, every face ≥ 50 % visible in 6 rotations for two learners, more steps never lower, valley 0 / learnable 1, ≥ 6 px
  per step, §4 above Kongruenz, route to §4 outward, route metrics), `app-path-check` 94, `app-story-check` 39,
  `app-lemma-lessons-check` unchanged.
- **LocalDB acceptance** (scratchpad `p11/accept.mjs`, `p11/ls.mjs`, `p11/drag.mjs`, `p11/edit.mjs`, `p11-story/browser.mjs`):
  LAAG-like (278 fields), the Bosko copy (418 topics) and a generated base of 5 000 topics, each with a learner halfway.
  - Satz 4.7 for a new learner: the same 7 topics in the list and the path, Repräsentantensystem above; §4 has 11 Stufen,
    Kongruenz 6.
  - Route metrics, old flat map → one map of the new world: LAAG 122.0 hex / 16.1 turns → 3.3 / 1.0; Bosko 22.5 / 2.2 →
    1.9 / 0.2; 5 000 topics 215.0 / 41.5 → 4.6 / 2.3 (a route crosses 7.8, 5.2 and 13.6 maps).
  - Regions: LAAG 2 levels, top 11, groups 5–8–12 / 2–3–4, inside 60 % / 71 %; Bosko 2 levels, top 9, 5–7–12 / 4–7–8,
    81 % / 93 %; 5 000 topics 3 levels, top 8, 5–8–12 / 5–9–12 / 6–8–12, 64 % / 89 % / 98 %, 140 ms.
  - 5 000 topics: map drawn 1.9 s after opening the view; frames while dragging 16.7 ms (95 % ≤ 16.8 ms); wheel, pinch,
    "Ganze Karte", "Zu mir" work.

## C35 — Regions show their inside, clicks that make sense, a winding layout (2026-11-04, Prompt 12)

- **Files**: `levelMap.ts` (unitsOf, sketchOf, layoutLevel rewritten: pieces, rounds, sectors; boundaryOf/outlineOf,
  stepRange, faster visibility, groundOf), `RegionMap.tsx` (regions as areas with their relief in a world-space group,
  border on the tops with the lit share, labels with full names, hover hints, zoom-in/out glide), `LandscapeView.tsx`
  (budget by width, cells per region, click rules, second click starts, "Als Nächstes hier" lists every learnable
  topic, route on cells, route shown on selection), `landscapeWords.ts`, `landscape.css`, `json.ts` (format text),
  `testGraphs.mjs` (kette8, zweige8), `app-levels-check.mjs`; regenerated `ksiazka-AI.md`, `ImportFormats.json`.
- **Dropped**: the Prompt 11 check "routes turn less often" (a winding chain turns more, on purpose) — replaced by "route
  steps touch more often"; "the route to §4 runs outward" is now a note (one step goes a ring back inward on LAAG; every
  prerequisite still stands no further out). The 6 px minimum step holds on topic maps; maps of regions are flatter.
- **LocalDB** (`scratchpad/p12-bases`): "Kette 8 zz-probe" (8 regions 6–11 topics, a chain) and "Zweige 8 zz-probe"
  (start, four shallow branches, three deeper), each with a learner halfway; plus the Prompt 11 bases.

## C36 (Part B) — Detours into another story, and back (2026-11-04, Prompt 13)

- **Step `detour`** (`flow.ts`, new `detour.ts`): `{"flow": "@ref", "label", "optional": true}`, exits `done` / `skip`
  (`"optional": false` or the editor's `"required": true`: only `done`). `exitAfter` returns from a called story at `done`;
  `detourRefused`: cycle or deeper than 3.
- **Running** (`runningStory.ts`): `detourIn` (where the learner was in it; „Przypomnij“: from the start), `backTo` / `backDepths`
  („Wróć do: …“ without finishing), `insideOf` / `resumeInside` (the overview's place keeps `inside: [{flow, step}]`;
  `FlowPosition.inside` in `learn.ts`, newer wins).
- **Player** (`FlowPlayer.tsx`): the detour card, breadcrumb, „Wróć do“, path header „wewnątrz: …“, skipped marks, the
  path popover with „Otwórz“, „Co dalej“ with open optional detours first (opened without the lock, `cg-story-free:`),
  required detours keep the end from counting, the direct-start line „Najpierw: …“ (`storyLock.ts` `directStartLock`).
- **Path** (`storyPath.ts`, `pathLayout.ts` `PartKind` `detour`, `PathMarks.skipped`, `PathMap.tsx` sign + legend, `pathMap.css`).
- **Import / editor** (`json.ts` flowIssues, `FlowEditor.tsx`, `nodeFields.ts`): unknown target warns, self/cycle blocks with
  both names, chains deeper than 3 warn. Docs: `json.ts` flows text, `templates/cogita/opowiesci-AI.md` §8b, COGITA.md.
- **Tests**: `scripts/app-detour-check.mjs` (39, in `app:check`); LocalDB `scratchpad/p13-detour` setup + browser (17 ok).

## C36 — Progress that survives a reload, detours, one landscape (2026-11-04, Prompt 13)

- **Part A** — cause: the service keeps only the newest `position` batch per holder/base/area, the browser sent one per
  story; plus the 400-a-day limit, a player that saved its start before the learner was loaded, and no visited steps on
  resume. Fix in `learn.ts` (local pending places `cg-pos:*`, one full-set batch after pulling other devices,
  `mergePosition`, `positionFor` by lasting ref, `reset`), `runningStory.ts` (`startRun` with visited, missing step →
  first open step), `FlowPlayer.tsx` (restore when the learner arrives, no write on opening, "Zapomnij postęp"),
  `flow.ts` (`ref`), `flowFacts.ts`, path views; `Cogita.cs` limit 2000/day. Checks in `app-story-check`; browser on
  LocalDB: halfway + reload, finished + reload, "od początku" + reload, another story, second browser, re-import with a
  changed graph (same id and deleted + new id) — all pass.
- **Part B** — see "C36 (Part B)" above (detour step, nested runs, path node, import/editor/docs; `app-detour-check`).
- **Part C** — `worldLayout.ts`, `worldView.ts`, `WorldMap.tsx` (new; `RegionMap.tsx` removed), worker/client `world`,
  `LandscapeView.tsx` (one map, breadcrumb by zoom, summary, short TopicPanel, Legend), `landscapeWords.ts`,
  `landscape.css`, `landscapeExport.ts`, `AiMcp.cs` text, `json.ts` format text; `app-worldmap-check` (44). Connections
  joining neighbours / ≤ 2 hexagons: LAAG 58 % / 70 %, Bosko 71 % / 86 %, kette8 61 % / 87 %, zweige8 64 % / 90 %,
  5 000 topics 43 % / 63 %; regions contiguous 88 %, 100 %, 100 %, 100 %, 81 %; layout of 5 000 topics ~700 ms in the worker;
  dragging 5 000 topics 16.7 ms per frame (95 % ≤ 16.8 ms).

## C37 — Landscape polish: pieces, free camera, information in the hexagons (2026-11-04, Prompt 14)

- Files: `WorldMap.tsx` (pieces, flag, outlines, free orbit and twist, in-hexagon text at two levels, overlay taps, faster
  far drawing), `worldView.ts` (`stepFor`, `fitInfo`, `NAME_PX`, `detailPx`, `deepestS`, `infoAngle`), `worldLayout.ts`
  (no gap rows, boxed-in regions placed again), `LandscapeView.tsx` (pieces stored as `pieces:<view>`, per-tile share /
  what is left / details, step per base, legend), `landscapeWords.ts`, `landscape.css`, `json.ts` (format text),
  `testGraphs.mjs` (`flach7`), `app-worldmap-check.mjs` (no holes, touching regions, no island cells, step per base,
  text fits its chord, deepest zoom ≈ 4 tiles).
- Changed by the user during the work: names on ALL tiles in view at one zoom (one look per zoom), and a deep zoom with
  only 2–5 hexagons and the full information — instead of information only near the centre.
- LocalDB (`scratchpad/p14`): "Flach zz-probe" (59 topics, 7 regions, chains ≤ 3) plus the Prompt 11–13 bases; browser
  checks 18/18 on the flat, linear, branching, LAAG and 5 000-topic bases in light, dark and at 390 px; panning and orbiting
  5 000 topics 16.7 ms per frame.

## C38 — Radial landscape, labels, rings, view modes, answer colours, review spacing (2026-11-04, Prompt 15)

- Files:
  - `worldLayout.ts`: radial wedges, ring bands, leaf-by-leaf growth, swaps, repair, holes, stored seeds, `shade`.
  - `worldView.ts`: `fitInfo` name + status, `RING_PX`, `keepLabels`, `NAME_PX` 68.
  - `WorldMap.tsx`: ring along the edge, painter-order text and outlines, view modes, coloured labels with leaders,
    hover highlight, inverted tilt, slider icons, hidden pieces, sub-region hues, no signs.
  - `LandscapeView.tsx`: stored layout, ring = mean knowness, due flag, legend.
  - `landscapeData.ts` (`ringShare`, `cardsMean`), `landscapeClient.ts`, `landscape.worker.ts` (`places`),
    `landscapeWords.ts`, `landscape.css`, `json.ts`.
  - Answer colours and minus signs: `choiceMarks.ts`, `CardFace.tsx`, `schema.ts`, `titleSigns.ts`.
  - Review spacing: `spacing.ts`, `SpacingSettings.tsx`, `knowness.ts` and its callers.
  - Checks: `app-worldmap-check.mjs`, `app-choice-check.mjs`, `app-spacing-check.mjs`.
- Layout measures (`app-worldmap-check`, offline graphs shaped like the LocalDB test bases):

  | Base | Regions in one piece | Neighbouring connections | Connections ≤ 2 hexes | Pieces of known land (10/25/50/75 % learnt in the author's order) | ms |
  |---|---|---|---|---|---|
  | flat (59) | 100 % | 100 % | 100 % | 1/1/1/1 | 3 |
  | Bosko-like (63) | 100 % | 87 % | 94 % | 1/1/1/2 | 5 |
  | chain (64) | 100 % | 61 % | 83 % | 1/1/1/1 | 5 |
  | branches (64) | 100 % | 68 % | 89 % | 1/1/2/2 | 3 |
  | LAAG-like (278) | 74 % (leaves 25/32) | 62 % | 70 % | 2/2/2/1 | 22 |
  | 5 000 | 65 % (leaves 407/566) | 46 % | 63 % | 11/18/12/6 | 230 |

  A stored layout of 5 000 topics is read in about 50 ms.
- Not reached: one piece of known land for the deep and the 5 000-topic base; some leaf regions there are split.
- LocalDB browser checks (`scratchpad/p15/e.mjs`, 18 each):
  - flat, LAAG and 5 000 (light and dark) at 1400 px, flat at 390 px: all pass;
  - dragging 5 000 topics: median frame 16.7 ms.

## C39 — Landscape and settings modules, review choice, map height, back to the map (2026-11-05)

- New page modules (`pages/parts/cogita.tsx`, views in `landscapeViews.tsx`):
  - `cogita-landscape` „Krajobraz wiedzy": a base (whole base, or one saved view), answers area, rewards, hide
    `spacing`/`learner`/`search`. Without a view it shares the places of „Wpisy" (key `wpisy`).
  - `cogita-settings` „Ustawienia nauki": the learner's „Jak często pytać" on its own; give it the same answers area as
    the learning module, or the choice lands with another learner.
- `SpacingChoice` (`SpacingSettings.tsx`): one-click presets + „Inne…"; shown only when the area has not locked spacing.
  New preset „Częściej" (5 min × 2) in `spacing.ts`.
- Widok: a mode set by the page („Jak pokazać") hides the mode tabs.
- Landscape: map taller (small up to 620 px / 75 % of the window, big up to 820 px; in a module's fullscreen the
  window height); a landscape in fullscreen uses the full width; „‹ Wróć do mapy" above every run and story;
  double-click on a mountain sets the goal and starts the first learnable topic on the way.
- Giving up a begun tile: the topic panel offers „Zrezygnuj — zdejmij pionek" (`removePiece`, the piece list in
  `pieces:<view>` loses the topic; answers stay) or, on the goal piece's tile, „Zrezygnuj z tego celu" (goal cleared too).
- Checks: tsc (only `worldLayout.ts` errors, edited in parallel), app-spacing, app-json (ImportFormats.json
  regenerated), app-landscape, app-style. Not tried in a browser.

## C40 — House, foundation, wedges, view modes, column height (2026-11-05, Prompt 16)

- Files: `worldLayout.ts` (start topic, first ring, foundation by transitive dependants, foundation sectors, wedges from
  the foundation, territory growth per region and snake runs per sub-region, column placement, top-level repair, the
  house tile at 0,0), `WorldMap.tsx` (house tile, flat house icon, no dot, Do odkrycia, note, column height, labels on
  their area, one zoom band per region level, tooltip at the pointer), `worldView.ts` (`keepLabels` with spots and short
  lines), `LandscapeView.tsx` (no stored layout — computed on each load), `landscapeWords.ts`, `landscape.css`,
  `json.ts` (format text), `testGraphs.mjs` (`stern8`), `app-worldmap-check.mjs` (house tile, holes, islands, strays,
  foundation size and shape, regions touching it).
- Changed by the user during the work: the house on its own tile with a flat icon; a zoom band for every level of
  sub-regions; no black dot; recompute the map on every load instead of storing it.
- Layout measures (offline, `app-worldmap-check`):

  | Base | Holes | Islands | Strays | Regions touching the foundation | Foundation | Regions in one piece | Neighbouring | ≤ 2 hexes |
  |---|---|---|---|---|---|---|---|---|
  | flat (59) | 0 | 1 | 0 | 8/8 | 13 | 100 % | 68 % | 91 % |
  | star, Bosko-shaped (65) | 0 | 1 | 0 | 8/8 | 9 (start + 8 successors) | 100 % | 73 % | 88 % |
  | Bosko-like chain (63) | 0 | 1 | 0 | 7/7 | 16 | 100 % | 62 % | 80 % |
  | chain (64) | 0 | 1 | 0 | 8/8 | 16 | 100 % | 59 % | 84 % |
  | branches (64) | 0 | 1 | 0 | 7/7 | 16 | 100 % | 60 % | 88 % |
  | deep, LAAG-like (278) | 0 | 1 | 0 | 10/10 | 61 | 60 % (top 9/10) | 54 % | 68 % |
  | 5 000 | 0 | 1 | 0 | 7/7 | 37 | 86 % (top 6/7) | 36 % | 56 % |

- Not reached: in the deep and the 5 000-topic base not every sub-region (and one top region) is one piece.
- LocalDB browser checks (`scratchpad/p16/f.mjs`, 13 each): star, deep, 5 000 (dark) at 1400 px and flat at 390 px; the
  Prompt 14 test with the new tilt direction (18/18) and the Prompt 15 test (18/18); dragging 5 000 topics 16.7 ms per
  frame.

## C41 — Motion and rewards: playback on the landscape, live answers, badges and levels (2026-11-05, Prompt 17)

- Review first (four parallel reviews of everything built in Prompts 11–16, then fixes):
  - Layout and map (`worldLayout.ts`, `WorldMap.tsx`): crash on small bases (the house cell read as a topic), stealing
    into the foundation, pinch end, double tap during a glide, covered pieces catching taps, canvas scaling, stale paint
    loop, 45° label, long spins, stale world, first-change rebuild — fixed; fuzz 3 000 random graphs, 0 throws.
  - Landscape view: stale world after a base change, locks behind unreviewable page cards, wrong saved stand clearing a
    goal, story units started as cards, owner tools without a saved view, goal piece off a filtered map, goals that left
    the view, `[object Object]` keys, rename box carried over, the topic list rendered while closed (5 000 rows), new
    objects every render redrawing the map, a goal stored without steps (route fetched once), region edits lost on
    „Zapisz" in Wpisy — fixed.
  - Learner and spacing: a revision inside a story stuck on its end screen (`onDone` in a ref), statistics and module
    cards with the default spacing, a fixed view mode overridden from the address, Polish-only aria labels, intervals
    capped at 1 000 years (Date range), the default schedule bit-exact again after a lapse — fixed. Learner values
    overwritten across instances and devices, the 5 000-batch history cut, stale queued positions, offline spacing:
    see the learner-sync part below.
  - Stories (FlowPlayer and flow.ts, edited in parallel by the owner): reported, not changed — chapter end after a
    resume ends the story, presentation detours pass straight through, opening a story saves a position, chapters keyed
    by hub id only, lock re-evaluated mid-story, story templates (import blocked, identity, re-resolve), „Przebieg"
    conditions without the lasting ref, required detours to missing stories, a late learner overwriting the place.
- Prompt 17 files: `ui/motion.ts` (Animacje), `ui/MotionChoice.tsx`, `cogita/motionWords.ts`, `cogita/rewardBus.ts`
  (answer source, flights with a finish handle, utrwalone), `cogita/RewardToasts.tsx`, `cogita/knownNow.ts`,
  `cogita/SessionSummary.tsx`, `cogita/landscapeShown.ts` (last-shown state and diff), `cogita/worldPlay.ts` (playback
  timing and wave), `WorldMap.tsx` (playback drawing, Pokaż zmiany), `LandscapeView.tsx` (snapshot, diff, points per
  field, counter, map measures and awards), `RewardViews.tsx` (counter hold, map badges, badges page under a board),
  `CardFace.tsx`/`cogita.css` (answer motion), `RevisionRun.tsx` (streak, summary, Wróć do mapy), `pages/parts/view.tsx`
  + `viewViews.tsx` (`switch`), `notify/WorkspaceLook.tsx` and `LandscapeHome.tsx` (Animacje), `landscape.css`,
  `rewards.css`; badges and levels by a helper: `rewards.ts` (kinds, map measures, `cleanDays`, awards), `BadgesPage.tsx`,
  `badges.css`, `mapMeasures.ts`, `RewardsEditor.tsx` (route `nagrody/odznaki`), `Progress.tsx` (teacher view).
- „Co dalej" after a story: the successors stand in one row (same level), joined by a bar; wider than the map — the row
  scrolls sideways (changed by the user mid-way).
- Learner sync (a helper, `learn.ts`, `Cogita.cs`, `offline.ts`, `AwayLearn.tsx`): latest-only kinds (values, positions,
  suspensions) are written as per-key changes on top of a fresh pull (`cg-wait:<lib>:<holder>`, shared by every Learner of
  that person and base, broadcast through `tell`/`hear`), never replayed from the outbox; batch reads are paged
  (`?after`, response `more`/`next`, cursor created_at + id; 5 000 / 20 000 / 10 000 per page); the offline copy keeps the
  area's spacing; `postDue` clamps dates. Old client ↔ new API both work.
- Checks: `app-playback-check.mjs` (new, 44), `app-learn-sync-check.mjs` (new, 31), `app-rewards-check.mjs` (130),
  `app-spacing-check.mjs` (35, a 1 000-year cap added), tsc, style ratchet; Api.Tests 585.
- LocalDB browser drives (`scratchpad/p17/`): `real.mjs` learns three topics through the app (a review first, then two
  topics), restores the state from before and reloads — one playback, "+N" fly (counter 1 130 → 1 170), over in 2.8 s,
  Pokaż zmiany, a badge toast „Celny" (12 checks, the one miss: the review happened inside the first run); `answers.mjs`
  — wrong/partly/right, „5 z rzędu" glowing, daily goal / streak / level toasts once each, „Poziom 5: Mistrz", the
  summary card; `badges.mjs` — 8 levels with the learner's place, badges got / going / not started / on the map, six
  kinds, three next goals, history (8/8); `smoke.mjs` on 5 000 topics (dark) and 64 topics (phone, reduced, off).

## C42 — Badges as categories with material steps (2026-11-05)

- The owner: the badges page had become bulky — categories with steps you can click, from wood up to diamond, about
  5 × 5. `rewards.ts`: `BADGE_MATERIALS` (wood, bronze, silver, gold, diamond), optional `tier` 1–5, `materialsOf`,
  `badgeCategories` (category = badge kind; one ladder per measure, ordered by threshold, material by rank), 25 built-in
  badges (Seria streak 3/7/14/30/100, Celność combo 5/10/25/50/100, Wiedza utrwalone 1/25/100/500/2000, Cele goals
  1/5/20/50/150, Mapa map % 10/25/50/75/100; ids with the same threshold kept), a stored higher map step implies the lower
  ones, `badgeKindOf` from the measure only; level frames on the same scale (frame 0 wood).
- `BadgesPage.tsx` and `badges.css` rewritten (levels as one row of medals; category tiles with medal, pips, bar and
  „najbliżej"; a tap opens the steps — a row, on phones a list; history folded); `RewardViews.tsx` (BadgeMedal,
  MaterialPips, the board shows the categories), `RewardToasts.tsx` (material in the toast), `RewardsEditor.tsx`
  (material and `tier`), `lang.ts` (rewardWords), `json.ts` (format text) → `ImportFormats.json` and
  `templates/cogita/ksiazka-AI.md` regenerated (the API needs a deploy for MCP).
- Checks: `app-rewards-check.mjs` 145 (§17 new); drive `scratchpad/p18/badges2.mjs` 19/19 (1280 light, 390 dark); page
  height at 1280 from about 1 750 px to 650 px.

## C43 — The way to a chosen topic, in steps: jumping dots (2026-11-05)

- The owner: an animation of the steps to a topic one wants to learn — dots jump from the available tiles to the chosen
  one, synchronized so that where a tile needs several, their dots arrive there in the same step.
- `worldWay.ts` (new): the way = the topic and every topic still open before it (through known topics; a known
  foundation is never walked), jumps to every topic on the way that needs it, cycles as one step (Tarjan, no recursion;
  every member sends a dot on, members without an own jump join when the others land); step = longest chain of the
  open before it (= the column level above the ring); timing (`wayTimes`: appear 0.42 s, 280–600 ms per step, at most
  ~4.8 s for all steps, goal 0.7 s, fade), waiting (`wayWaits`: a dot hops on the spot until its jump).
- `WorldMap.tsx`: own canvas `cg-wm-way` over the map (`paintWay`; the map is not redrawn), auto-play once on choosing a
  topic (camera stays), the button „Pokaż drogę · N kroków" (replays, glides out first if needed; a click while playing
  skips; „Krok k z n" while playing), rings where dots meet and at the goal, labels fade while it plays, waits for and
  yields to the Prompt 17 playback, ograniczone fades per step, wyłączone draws only; the polyline route is gone; the
  chosen topic's needs links show only known ones. `LandscapeView.tsx`: the plan for the chosen topic, else the goal
  (`routeShown`/`routeT` removed), legend „droga". `landscapeWords.ts` (way words, `kroki`), `landscape.css`.
- Checks: `app-way-check.mjs` (new, 482: same-step arrival, waiting, split/meet, through known, cycles, no way, timing,
  5 000-topic random graph under 60 ms per way, words) in `app:check`. Drives (`scratchpad/p18/way.mjs`, LocalDB): kette
  1280 light (13-step and 6-step ways), 390 dark, ograniczone, wyłączone, the 5 000-topic base — 12/12 each (8/8 off);
  0.1 ms per frame for the dots, 60 fps.

## C44 — Stories ↔ questions: Prompts 19–22 in one pass (2026-11-05, Prompt 23)

- Audit first (four read-only reviews), then built by part; test data on LocalDB: two new libraries „P23 Bosko" (pl: overview
  → Etap 1 with six detours after slides 1, 2, 2, 3, 4, 5 → deep stories, nested detour, story-wide and practice-only
  questions, bad slides for the lint) and „P23 LAAG" (de: u0 → k1–k4 → §11–§15, formulas, footnotes, interactive questions,
  a hand-built review) — `scratchpad/p23/setup.mjs`.
- A (slides ↔ questions): `SlideView.tsx`, `slideLinks.ts`, `slideLib.ts`, `StoryPreview.tsx`, `QuestionLandscape.tsx`,
  `slideLint.ts`, `slideWords.ts`, `slides.css`; `EntityReading.tsx`, `CardFace.tsx`, `EntityEditor.tsx`, `FlowPlayer.tsx`
  (lib for explanations, ⋯ „Pytania do tego slajdu", title fallback), `LandscapeView.tsx` (tabs), `json.ts`,
  `opowiesci-AI.md`. Check `app-slide-links-check.mjs` (120).
- B (detours as branches) and A8: `pathLayout.ts` (`withBranches`: the line without detours, branches beside their
  anchor), `PathMap.tsx` (branch nodes, arms, names, states, counter, „Rozwiń", „tu wrócisz", TeX in names and „Co dalej"),
  `pathBranches.ts` (state, slides done/total, questions known, „po slajdzie N", sub-detours), `DetourCard.tsx` (one card
  for the step and the path, with the unit's summary), `FlowPlayer.tsx` (the calling story's path inside a detour),
  `LandscapeView.tsx` (the unit path with branches and cards), `pathMap.css`, `lang.ts`. Check `app-branches-check.mjs` (17).
  Also fixed: switching from one library's player straight to another's stayed on „Otwieranie bazy wiedzy…"
  (`libraryStore.ts`: a counter instead of the revision as state).
- C (self-check): `revision.ts` (pick sample, perTopic, step sample, warnings for unknown mode/pick), `kinds.ts`,
  `questionTypes.ts`, `cardBasics.ts`, `cards.ts` (core), `logic.ts`/`knowing.ts` (rel core), `selfCheck.ts`,
  `SelfCheckSummary.tsx`, `selfCheckWords.ts`, `selfCheck.css`, `TopicQuestions.tsx`, `RevisionRun.tsx`, `WorldMap.tsx`
  (button and mode „Luki"), `flowFacts.ts`/`storyLock.ts`/`LandscapeView.tsx` (story passed when all its questions are
  known), `levelMap.ts` (lone topics named after themselves), `json.ts`, `schematy-AI.md`, `pytania.json`. Check
  `app-selfcheck-check.mjs` (92).
- D (explanation paths): `SlideDrawing.tsx`/`slideDrawing.css` (drawing beside a slide), `interactive.ts`/
  `InteractiveAnswer.tsx` (check submit, goals in order), `interactiveCheck.ts` + `json.ts` (import warnings),
  `PreviewKnowledge.tsx`, `mcp/report.mjs`, `mcp/server.mjs` (interactive questions in preview_knowledge), `flow.ts`,
  `reviewRound.ts`, `ReviewStep.tsx`, `storyPath.ts`, `flowCheck.ts` (step review), `pages/motion/expr.ts` (fmtpi),
  `LivePanel.tsx` (TeX labels), `levelMap.ts` (nest nodes that are topics), `library/libraryMarkup.ts`, `markupView.tsx`,
  `blocks.ts`, `reading.ts`, `scriptorium/latex.ts`, `sermon.ts`, `styles/library.css` (details block),
  `backend/Api/Library/AiMcp.cs` (includeData, ref, names) + `Api.Tests/AiAccessChecks.cs`. Checks
  `app-review-step-check.mjs` (30), `app-drawing-check.mjs` (23); Api.Tests 587.
- E (one place): `QuestionLandscape.tsx` „Pokaż na ścieżce", `LandscapeView.tsx` (branch highlight on the overview path),
  `SelfCheckSummary.tsx` (the story preview from a gap). Drive `scratchpad/p23/place.mjs` 6/6.
- Drives: `scratchpad/p23/branches.mjs` 15/15 at 1280 light and 390 dark; parts A/C/D in `scratchpad/p23a`, `p23c`, `p23d`.
- Not done: interactive questions in the preview MCP are reported as text (problems, solution values, solved), not drawn;
  texts drawn inside a drawing stay plain (labels of controls render TeX).
- Added by the owner during the work: badges 5 categories × 12 roughly exponential steps (materials spread, grades I–III;
  `rewards.ts` `materialAt` by count, `BadgeStep.grade/grades`; `BadgesPage.tsx` steps wrap), 12 levels doubling (0 …
  200 000); „Co dalej" as violet hexagons like the path's nodes (`pathMap.css`, legend `nextLegend`). `app-rewards-check`
  updated (147).

## C45 — Links between knowledge bases (2026-11-05, Prompt 24)

- Model: `@@<handle>:<@lasting name | id>` (`cogita/worlds.ts`); settings `handle` + `worlds` (`store.ts` `readSettings`);
  ref fields `"external": true` (`schema.ts`, written by `kinds.ts` `kindDoc`); markup `[[w|@@h:@x]]` (`libraryMarkup.ts`
  `CROSS_ONLY`, `markupView.tsx` `MarkupLinks.cross`); cross detours always optional (`detour.ts` `detourOf`,
  `detourProblems` skips them); `@@` never a prerequisite (`prerequisites.ts`).
- Import/export/removal (`worldsImport.ts`, `json.ts`, `ImportReviewPanel.tsx`, `EntitySelection.tsx`): accepted everywhere,
  never blocking; warnings at planning (field without `external`) and after the preview against the other bases (unknown
  handle searched and added to `worlds` in the same save, unreadable world, missing target, detour to a non-story, own
  handle); export keeps the form, setup snapshot carries `handle`/`worlds`; deleting lists links from other bases.
- Docs: COGITA.md „Links between knowledge bases", `json.ts` format text, `opowiesci-AI.md` §8c, `schematy-AI.md`;
  `ImportFormats.json` + `ksiazka-AI.md` regenerated. Check `app-worlds-check.mjs` (52) in `app:check`.
- UI: `WorldLinks.tsx` (`useWorlds`, `WorldsSection`, `CrossLink`, `CrossDetourStep`, `CrossRun`, `WorldPicker`,
  `CrossRefEditor`, `useBrokenWorldLinks`), `worldWords.ts`, `worlds.css`; wired into `EntityEditor`, `EntityReading`
  (reading + „Nowy temat"), `FlowPlayer` (`EntityView`, detour step, the nested run), `LandscapeView` (topic panel,
  `portals`) + `WorldMap` (the sign), `GraphEditor`/`nodeFields` (detour picker), `CogitaSettings` („Inne światy"),
  `Pending` (broken links), `schema.ts` `valueText` ('' for `@@`).
- MCP: `AiAccess.Worlds.cs`, `AiAccess.Read.cs`, `AiMcp.cs` — cross links with base names in `get_entry`/`get_related`,
  several collections in `search_entries`, `Handle`/`Worlds` in `get_knowledge_setup`; Api.Tests 604 (17 new).
- Verified on LocalDB (scratchpad `p24/`: Fizyka → Historia, Tajne unreadable): drive 13/13 at 1280 and 390 dark, the
  finish-in-B path (B's own „najpierw: Jakub II" → „Ucz się" → B's story → back in A at the next step), import warning by
  name + still imported, deleting the target in B → broken in A, removal preview naming the link from A.

## C46 — One hexagon, several inner routes (2026-11-06)

- `cogita/mountain.ts` (new): `stepsOnEveryRoute`, `mandatoryQuestionSteps`, `routesOf`, `mountainProblems` (warnings
  only); texts `cogitaEditFlow.mountain.*` (en/de/pl).
- Completion and review: `flowFacts.ts` `flowQuestionsKnown` counts only required questions (flows with `choice`),
  new `storyCompleted`; `reviewRound.ts` `reviewCards` the same required questions.
- Import and editor: `json.ts` `flowIssues` (with the plan's entities) and `FlowEditor.tsx` `FlowProblems` add the
  mountain warnings.
- Counting: `storyPath.ts` `storyMarks` — untaken roads optional as soon as another road is walked; `LandscapeView.tsx`
  story line excludes them; `FlowPlayer.tsx` header counts the hexagon inside one of its segments.
- Check `scripts/app-mountain-check.mjs` (37, in `app:check`). LocalDB example and drives in scratchpad `p25/`
  (production build — the dev server's landscape worker fails on `@react-refresh` since `landscapeWords` imports
  `core/i18n.tsx`; not from this change).
