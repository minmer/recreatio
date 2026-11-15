# Works — from the whole down to the smallest unit

Status: built 2026-11-15 (no migration: everything is entries in the Scriptorium's sealed store and in knowledge
bases). Code: `frontend/src/app/scriptorium/work/`. Checks: `scripts/app-work-check.mjs`. Part of the Scriptorium
([SCRIPTORIUM.md](SCRIPTORIUM.md)); the knowledge of a work lives in Cogita ([COGITA.md](COGITA.md)); an agent reads it
over MCP ([MCP.md](MCP.md)).

A **work** is a Scriptorium project built from the general to the specific: the whole, its parts, ever smaller
sections, down to the units the author writes — each with a purpose and a role before any prose exists. Persons,
places, terms and ideas stay consistent because they live in a knowledge base, everything is introduced before it is
used, and every section either brings something new or says what else it is. The same machinery serves a book, a
scholarly article, a cycle of 500 short sermons, lessons of a school program and a collection.

## Data

All of it is ordinary sealed entries of the Scriptorium (`library/libraryKinds.ts`):

| kind | what |
|---|---|
| `project` | the work. New fields: `lang` (pl/de/en — of the work and its print), `levels` (`{name, latex}` per depth: "Part / Chapter / Section", "Cycle / Month / Sermon"), `dimensions`, `paths`, `roles` (own roles with `brings`), `knowledge` (the knowledge bases of the work), `latexClass` (book / article / booklet / handout), `citationStyle` (notes / authorYear). The old `outline` stays. |
| `node` | one node of the structure tree: `project`, `parent`, `order` (a number; moving rewrites only the moved node), `title`, `purpose`, `synopsis`, `role`, `brings`, `targetWords` / `targetMinutes`, `status`, `notes`, `text` (the prose — an ordinary text, so editor, plan, deliveries, pages and archive keep working), `split` / `variant` / `skip` (dimensions), `template` + `templateSig`, `marks`. Its id never changes, so links, marks and deliveries never break. |
| `rule` | the rulebook: `rule`, `why`, `weight` (must / should), scope fields that must all hold (`node` subtree, `role`, `template`, `dimension` + `value`, `entity`), `good` / `bad` examples, `check` + `param`. Without `project` it is the **own rulebook**, inherited by every project of the Scriptorium. |
| `unittemplate` | the inner shape of a kind of unit: `parts` (`{id, title, kind, words, minutes, note}`), role, targets. |

Roles: new (must bring something), summary (brings nothing; recalls), introduction, transition, example /
application, exercise / review, conclusion — plus own roles of the project, each saying whether it must bring something
new, brings nothing new, or may. Spoken targets count 130 words a minute. Lengths more than 25 % off the target are
reported.

**Old projects** (a flat `outline`, no nodes) show their outline as a tree of virtual nodes; one click converts it
(`outlineToNodes`, headings → top nodes, texts → nodes under them). The outline itself is kept, and readers of
outlines (school programs, the old book print) read the tree through `projectOutline` once nodes exist.

## Dimensions and paths

A project declares dimensions (audience, level, viewpoint …), ordered or not. **Any node can split** by one
(`split`): its children carry `variant` — a value, or empty for the **shared core** read on every path. Splits nest (a
part split by audience, a section inside split again by viewpoint). A **path** (an edition) chooses one value per
dimension (`paths`; without paths: the first value of each) and reads as one linear work: through unsplit parts
unchanged, through each split part along its value (`linear`). Checks, the context of a unit, LaTeX and the MCP
briefing all work per path.

The **table** (`dimensionTable`) shows rows (the nodes of a tree level, or the values of a second dimension) ×
the values of a column dimension, filters for the others; a cell lists the nodes that stand specifically for that
value with their status, the shared core stands beside; a split without a child for a value is a **gap**, unless the
value is marked deliberately not needed (`skip`, with a note).

*Why not Cogita's axes and matrices:* they group entries by reference fields — good for an archive, but a work needs
order (reading order per path) and the shared core, which a reference axis cannot express. The table reuses the idea
(rows × columns × filters) on the tree.

## The knowledge of a work lives in Cogita

Persons, places, terms, ideas, motifs, objects, events are built with the Cogita schema machinery in a knowledge
base whose settings say **purpose: the knowledge of a work** — Nauka does not offer it as a course (it can be switched
back to learning at any time; nothing is deleted). Ready kinds: `templates/cogita/dzielo.json`. The Scriptorium reads
fields by their **role** (`cogita/schema.ts` `FIELD_ROLES`, `work/workKnowledge.ts`):

- `forms` (forms recognised in the text without a link), `forbidden` (forbidden synonyms / wrong forms),
  `preferred`, `definition`, `usage`, `description`; prerequisites are the usual „Kolejność nauki" fields
  (`prerequisite: "up"`);
- a **phase** is an entry with `phaseOf` (whose phase), `validFrom` / `validUntil` (a node or text of the work — the
  phase holds from the first place of `from` to the last of `until` on the path) and `storyFrom` / `storyUntil`.
  Wherever one writes, the description valid there is shown.

**Two-way links.** A text, plan point or node points at Cogita entries; a Cogita entry may point at texts and nodes
(Cogita knows `node` as a built-in kind) when its base lists the Scriptorium as a source (the work's settings offer to
add it). Visibility stays exactly as strict as before: targets are resolved only through stores the reader opened —
whoever cannot open the Scriptorium sees nothing of it, not even a title. An entry's page in Cogita shows "In the work":
where it is introduced, defined, exemplified, used and recalled, linking back.

## Introduced before used: marks

Occurrences have a role: `intro`, `def`, `ex`, `use`, `recall`. They come from

- the node (`marks`) — works before any prose;
- the Zapis of its text, in plan points and body: `[[Anna|@anna|intro]]` (without a role: used) — the parser keeps
  the role on the link (`library/libraryMarkup.ts` `splitMark`);
- unmarked mentions: a word of the text that is a form of an entry (label, preferred form, `forms`) counts as *used* —
  only for entries marked explicitly somewhere in the work.

The register (`registerOf`) orders them per path — node by node and, inside a node, **akapit by akapit**: every block of
the body (paragraph, heading, quote, list) is an akapit (`unitsOf`); a text that has only a plan counts its points.
An occurrence carries its akapit (`para`); a mark on the node, or a plan point beside a body, holds for the whole node.
A use before its introduction (`beforeIntro`) is a use in an earlier node, or in an earlier akapit of the same node;
inside the akapit that introduces a word the word may be used freely. The matrix entities × nodes shows them in
reading order.

## The course of the work (Przebieg)

The first tab of a work (`CourseView.tsx`, data `workCourse.ts`): the whole book from the chapters down to every akapit,
for the author of a very large book who must see the explanation step by step.

- **Rows** in reading order with the level's name, role, words and akapity, and under the title its key thought (or
  purpose). "Show down to": chapters, sub-chapters, paragraphs … or akapity; every row opens and closes on its own,
  and an open row can show its own akapity.
- **Words** at every place: introduced (green), defined, example, used, recalled; italic when recognised without a
  link; **red when used before it is introduced**, with where it is introduced. A closed row sums up its whole part
  ("Introduces 5: …", "Uses 12: …").
- **The summary on top**: counts per level, akapity, words, introduced words, places used too early — and "Next
  problem" walks through them one by one, opening the tree and scrolling to the akapit. "Only places with problems"
  filters.
- **The vocabulary beside** in the order the reader acquires it (where introduced, defined or not, uses, uses too
  early), the words used but never introduced on top. Clicking a word (anywhere) follows it through the work: a bar
  with its introduction, definition, uses and the uses too early; the tree shows only the parts where it occurs.
- Per path (edition), like everything else; the same rule as the checks, so the view and the report never disagree.

## Checks — a report, never a block

`work/workChecks.ts`, per path; every finding has the place (node, entity, rule), the message, **why** and the
**fix**, in the app's language: used before introduced · not introduced on this path (only in another version) ·
never introduced · introduced but never used · introduced twice · a prerequisite introduced later · no definition /
no example where a rule demands one · a phase not valid here · a forbidden synonym or form · a *new* node that
introduces nothing · a summary that introduces something or recalls what was never introduced · length far from the
target · no purpose / no role · a gap in the dimension table · template changed / parts missing · rule checks on the
wording (sentence length, max / min words, forbidden / required words, exactly one new thing) · an unresolved
citation · a quote that does not match the full text in the Library (where it is open). Explicit uses before the
introduction are *must*, unmarked ones *should*.

## Templates and cycles

A unit template gives the plan of a new text (`tpl-<part>` point ids) and its rules (rules with `template`). A
**cycle** (`cycleFrom`) makes N units in one save — numbered titles, every n-th a summary, optionally split by a
dimension (a head, the shared core and a variant per value) and with texts. Each node keeps the template's shape
(`templateSig`); a changed template is reported, and applying it again adds the missing parts to the plan without
losing anything.

## Context at hand

`work/workContext.ts` — the same for the app (beside the text editor) and the agent: purpose, role, synopsis, the
chain above, the synopses before and after, the neighbouring cells (the same place for other values), what is already
introduced on this path (and whether defined), what this unit must deliver, the rules in scope with their reasons, the
phases valid here, the open findings.

## LaTeX

`work/workLatex.ts` — the whole work along one path, one node's subtree, or one unit. Levels map to their command
(`\part` … `\paragraph`; what the class lacks moves down), class from `latexClass` (book; booklet = book on A5;
article; handout = compact article), labels `\label{n:<id>}`, summaries marked, glossary (terms with definition and
the page of their introduction), an index of persons / places / terms by kind built by hand (`\pageref`, no makeindex
run), sources from the Library, citation style notes or author–year, optional table of the dimensions. **Draft**:
role, purpose, synopsis framed under each heading, unwritten units as placeholders, findings as margin notes; **final**
is clean. The language of the document is the project's (`withLang`, babel). Standard packages only; pdflatex uses T1 + Latin Modern, lualatex fontspec (`iftex` in the shared preamble, so the old text and pulpit prints compile with lualatex too).

**Compiled for real** by `npm run app:work-tex` (`scripts/app-work-tex.mjs`, not in `app:check` — it needs pdflatex and lualatex in the PATH, e.g. MiKTeX): every document `app-work-check` produces — book pl/de/en final and draft, one chapter, handout, catechesis booklets, the sermon booklet, the split book, the article pl/de, the old text and pulpit prints — with pdflatex (twice) and lualatex; it fails on any error, undefined reference or missing glyph. 2026-11-15: 28 of 28.

## The agent over MCP

The browser that builds the Scriptorium's AI snapshot adds `works` (`work/workBrief.ts`): the rulebook with reasons,
the tree, templates, the knowledge (only from bases inside the same AI link), every occurrence, and per path the
reading order, first introductions, the findings and per-node context (rules, phases, what to deliver). The service
does not run checks: `get_work_briefing`, `get_work_context` and `get_work_checks` (AiMcp.Works.cs) filter what the
app computed, so the agent sees exactly the app's findings. Writing back follows the app's principle: the agent
prepares JSON in the `scriptorium` and `knowledge-base` formats, the owner reviews and imports; the guide
`guide-work` (`templates/cogita/dzielo-AI.md`) describes the workflow read rules → read the node's context → write →
self-check. No write tools: the content is sealed in the browser, and the reviewed import is the one path that keeps
it so.

## In the app

A project opens as its work (`WorkView.tsx`, address `#/workspace/scriptorium/<lib>/<project>/<tab>/<node>`), with
the tabs **Struktura** (the tree per path or all versions, progress per level, add / move / indent / split / merge /
delete, the node panel with autosave, marks, "Write the text", "Apply the template" and the context box), **Tabela**
(the dimension table), **Pojęcia** (the register per entity and the matrix), **Reguły** (the work's rules and the own
rulebook), **Kontrola** (findings per path), **Szablony** (templates, changed units, the cycle generator), **Druk**
(LaTeX), **Ustawienia** (language, class, citation style, levels, dimensions, paths, own roles, knowledge bases — with
"add this Scriptorium as a source" of a base) and **Dane** (the old project fields and outline). The Scriptorium got the
tabs **Reguły** and **Szablony**; a text that belongs to a node shows "In the work" beside the editor. In Cogita: the
setting "What this base is for", the banner of a work's knowledge, Nauka hiding such bases (a button shows them), and
"In the work" on an entry's page (`cogita/WorkBox.tsx`).

## Decisions taken without the owner (product)

- A rule scoped to a value of a dimension ("for children") applies on every path that chooses it — also to the shared
  core children read on it — and nowhere else.
- The own rulebook is per Scriptorium (rules without a project); to reuse it elsewhere, export / import the rules.
- Unmarked mentions count only for entries marked somewhere; before the introduction they are *should*, not *must*.
- Old outlines are converted on request, not automatically.

## Verification (`app-work-check.mjs`, 137)

1. **Book** — 3 parts, 12 chapters, 60 sections; Anna as a child (ch. 1–4) and an adult (ch. 5–12) as two phases;
   a term introduced and defined in 2.1, used in 3.2, used too early in 1.3 (found, only that one); the summary at the
   end of part I recalls only earlier things (no finding; a summary recalling something later is reported); the adult
   phase in ch. 2 reported; a forbidden synonym found; the context of 2.3; the register of the term; LaTeX book with
   part → chapter → section, labels, glossary with page refs, index, summary marked, draft notes only in the draft,
   German when the work is German, one chapter alone.
2. **Catechesis** — 12 topics × children / youth / adults with a shared core: the youth path reports the term
   introduced only in the adults' version; the children-only rule fires only on the children path (also in the shared
   core); the table shows a gap and a "not needed" cell with its note; the youth booklet holds the youth and shared
   texts only, with the dimension overview.
3. **Split sub-part** — one line except chapter 7 (beginners / advanced) with 7.3 split by viewpoint: both paths read
   every other chapter; each path goes through its variants; the check follows each path (the beginners' path reports a
   use in ch. 8 of a term introduced only for the advanced).
4. **Sermon cycle** — 100 five-minute sermons (650 words) from one template, every tenth a recap; series rules (one
   new thought, ≤ 750 words) plus the own rulebook: no findings; the MCP data says that before sermon 37 33 thoughts are
   introduced and that the series rules and the rulebook apply; a changed template is reported on all 100 and applying
   it adds the new part. The brief stays small.
5. **Scholarly article** — author–year citations from the Library, the bibliography, an unresolved citation reported,
   a term without definition reported under the rule "every concept defined", a quote checked against the full text.
6. **Lessons and learning** — a school program's lessons are the same before and after converting its outline to a
   tree; Zapis links without a role are unchanged; the JSON of a work (nodes by @key, marks on Cogita entries by their
   lasting name, rules, templates) plans without a warning; `app-cogita-check`, `app-duty-check` (school),
   `app-library-check`, `app-tex-check`, `app-platform-check` stay green.
7. **Course of a liturgy book** — Mistagogy, History, Celebrating the Mass, Serving at Mass; chapters → sub-chapters →
   paragraphs → akapity: a term introduced in 3.1.1 ¶2 is reported in ¶1 of the same paragraph and, without a link, in
   1.2.1 ¶1 (with "introduced in 3.1.1 ¶2"); use and definition inside the introducing akapit are fine; chapters sum up
   what they introduce; the vocabulary in order of introduction; a word never introduced; plan points as akapity; the
   view rendered (chapters and sub-chapters shown, the problem count, the vocabulary).
