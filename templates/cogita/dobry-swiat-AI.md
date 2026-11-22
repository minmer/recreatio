# The guide: what a good world is

*Guide `guide-good-world` for every AI agent that builds or improves a knowledge world in Recreatio/Cogita. State: 22 November 2026. Read it before building or improving a world; the format guides give the exact syntax. The numbers I2 … I12 in the text name app features — the key is at the end.*

## 1.0 How to use this guide

- **Precedence.** The owner's explicit instructions come first, then this guide. The format guides (`knowledge-base`, `guide-stories`, `guide-world-map`, `guide-schemes`, `guide-visuals`, `guide-generators`, `guide-parts`) give the exact syntax. This guide says what to build with it.
- **Read before you build.** Read `get_import_format` for every format you use, `get_knowledge_setup` for the live base, `get_feedback` for the base, at least one world that is already imported, and the sources in the library. Use a feature only if a format describes it as live (dated). If it is not, say so and do not invent syntax.
- **Data, not settings.** Never write coordinates, colours or heights into an import. The app computes them.

## 1.1 What a good world does

A good world brings a learner **as fast as possible, but safely,** to knowledge that they did not have before. A learner should feel that someone is taking them by the hand: it reacts to what they answered, explains exactly what is missing, and moves on quickly once they understand.

Above everything else, **a world is many-dimensional, not a text** (1.2a): the same towers can be met in the order of the source at several levels of detail, along a main character, or along a topic that jumps across the source.

Seven principles follow from this:

1. **Every tower is one step forward, of roughly equal size.** It is neither a trivial definition nor several new ideas at once.
2. **One path leads to one tower, always.** A path may also end at an outer fork that leads to several towers. A path never runs through several towers.
3. **The main way is short.** Help, other explanation forms and depth sit beside it and appear only when they are needed or chosen.
4. **Errors steer the way.** Every wrong option is a named thinking error, and behind each error lies the explanation that resolves it.
5. **Nothing is copied.** Each fact, question and explanation exists once and is linked wherever it is needed.
6. **The computer grades every question.** There is no self-assessment.
7. **The map stays readable.** Every slide and question belongs to a tower, prerequisites are direct, and names are short.

## 1.2 Building blocks

| Block | In the base | On the map | Purpose |
|---|---|---|---|
| World | one knowledge base with its own schema and `handle` | the whole map | one field that keeps growing |
| Area (Dziedzina) | kind with `"structure": "up"` hierarchy | colour, not a border | orientation, placement by area |
| Tag | hierarchical label on towers (see 1.8) | filter, slice of the map | competition, stage, thread |
| Use flag | on slides, questions and steps: self-study, lesson or both (see 1.7) | nothing | which steps a mode plays |
| Tower (Temat nauki) | one entry | pillar | one step; conquered in one run |
| Block (rare) | field with `"part": "up"` | disc with towers on it | a large topic made of parts |
| Question | kind `question`, `about` = tower | dot on the line | tests the tower; the card belongs to the question |
| Slide | slide kind; "wyjaśnia" = tower (empty for a road slide) | dot on the line | explains |
| Unit (Jednostka) | one per path, "Wymaga" = ticket | start and ticket of the line | what must be known before the path |
| Path (flow) | `flow` with `unit` | line | the way to one tower |
| Outer fork | `choice` whose branches lead to different towers | interchange node | choosing a direction |
| Deepening | `detour` to another path, also into another world (`@@handle:`) | loop at the line | "Do you want to know more?" |
| Question path | `paths` | signpost "?" | a real question answered in 3–8 steps |
| Placement | `explore` | one step | finds what the learner already knows |

Two links hold a world together:
- **"Wymaga"** (`"prerequisite": "up"`) holds only **direct** prerequisites and must have no cycles. It decides order, tower height, the discs under locked towers and tickets.
- **`about` / "wyjaśnia"** decides where a step stands on the map. Link every slide and every question to its tower.

## 1.2a A world is many-dimensional, not a text

**This is the most important property of a world.** A text has one order: sentence after sentence, chapter after chapter. A world must not copy that order. It splits the material into towers (one step each) and then offers **several ways through the same towers**. Even when the source is linear — a lecture, a novel, a book of the Bible — the world built from it is not.

Build at least these dimensions over one set of towers:

1. **The order of the source, at several levels of detail.** Get to know the parts one after the other — first an overview, then the scenes, then the details of a scene, and so on. A world may have one, two, three or more levels of detail; the learner goes as deep as they want.
   - An **overview tower** that several scene towers build on ("Wymaga" points from the scenes to the overview).
   - **Blocks** (`"part": "up"`) when a large part has its own parts.
   - **Deeper paths** through `detour` (`optional: true`) for the details — the ladder of paths in 1.6.
2. **Threads across the order.** Get to know several scenes by following one line through them:
   - **a main character** ("Achilles from the quarrel to Priam's tent", "Peter in the Gospels") — a question path (`paths`) whose steps visit the scenes where the person acts, and a tag for the person;
   - **a topic** that jumps through the source — from the first scene to the last one and then to the next ("Rage in the Iliad", "Covenant from Genesis to the Apocalypse") — a question path or a tag for the topic, and **joining towers** that compare scenes (a tower whose "Wymaga" names two scenes that do not build on each other).
3. **Bridges** to other books and worlds (1.6) — the same scene seen from another source.

**Rules.**
- **Nothing is copied.** Every dimension is a different way through the same towers, questions and slides (principle 5). A thread does not retell the scenes; it links them and adds only what is new: the comparison, the development, the question that connects them.
- **The order of the source stays one dimension among several.** Do not build only "chapter 1 → chapter 2 → …", and do not hide the source order either: a learner who wants to read along must still be able to.
- **Plan the dimensions before the towers.** List the levels of detail, the main characters and the topics first; then cut the towers so that each can stand on several ways (one scene = one tower, not one chapter = one tower when a chapter holds three scenes).
- **Check it.** `get_world_checks` reports `world.linear` (the towers form one line, like a text), `world.oneLevel` (no levels of detail), `world.noThreads` (no order across the source), and `world.dimensions` (info: what the world has — levels, blocks, deepenings, overviews, question paths, tags across parts, joining towers).

## 1.3 Towers

- **Size.** About 4–8 minutes of learning. The number of questions depends on how long one question takes: some towers have 6 questions, others clearly more. The usual range is 10–15. There is no fixed norm. Split a tower that is too large, and merge one that is too small with its neighbour.
- **Questions.**
  - 1–2 key questions (`"core": true`).
  - At least two questions that work for a class vote: one decision, four options, and every wrong option a named error (`tags`).
  - Vary the question forms.
  - Variants of the same question share an answer through `fact` or `share`. The path asks one variant; the others wait in the tower.
- **Conquest levels.** The recommended setting for every world (the "best world" standard) is:
  - Level 1: at least 75 % of the tower's questions answered correctly in one run, however many attempts (`"attempts": "any"`).
  - Level 2: at least 90 %, where each question may be wrong once and then right the next time (`"attempts": "one"`).
  - Everything right at the first attempt gives both levels and the distinction "Mistrzowsko".

  With these levels a learner can conquer a tower without being pushed straight to the top level. Use `levelsSetup` with exactly these two rules and `openAt: 1` in every new world. A world that has another setting (for example three levels: 75/85/95 %) keeps it until the owner decides. When you improve such a world, ask the owner: "Switch to two levels, or keep three?" If he chooses two, the improved world's import file carries the new `levelsSetup`.
- **Spiral.** A topic may have several towers above each other: everyday, precise, orders of magnitude (field "Stopień dokładności" in Fizyka). A question path may visit a tower again at a higher level (`"level": 2`).
- **Subjects that start with calculation** (physics: electricity, light, waves, heat) first get towers without formulas. They start from an everyday experience that the learner knows (the seesaw). The question then asks why it happens, or what changes when something is changed. It never asks about the experience itself.

## 1.4 Questions

**Graded by the computer only.**
- Never use `form: "flash"` (self-assessed). Use `one`, `many`, `truefalse`, `match`, `order`, `build`, `number` (with `unit`/`quantity`), `date`, `gap`, `text` with accepted answers, `point`, `code`, `interactive`, the reading tasks on a Library passage `lines`, `label`, `span` (the passage by `work` + `locator`, never copied), and generated questions (`params`).
- Typed answers (`text`, `gap`) list every accepted form: inflections, digits, forms without Polish diacritics. The first form is the canonical one.
- A gap has one blank. Avoid gaps whose answer has real synonyms; if that cannot be avoided, accept the synonyms. In a gap with choices, never put a synonym of the answer among the wrong options.

**Worth asking.**
- No general knowledge. A question that common sense, elimination or the form of the options answers is worthless.
- Interesting and quick to read: "Czy fizyk może powiedzieć, że szkoła zbliża się do mnie?" is good; "Co się porusza?" is not.
- Ask only what was explained. A question tests what a slide in its chain taught: in its own tower or in a transitive prerequisite. If no slide teaches it, add the content to a slide or delete the question.
- Every question must be understandable on its own, because it comes back in reviews without its tower. Name the book, the place and the person. Never write "here", "in this pericope" or "according to the commentary".

**Options and feedback.**
- Wrong options are credible. They come from the same field and register, are often a real fact from elsewhere, and are never silly. A wrong option is a separate claim, not a copy of the correct one with an error pasted in.
- The correct option is the longest in at most 3 of 10 choice questions, is not the shortest more often than chance, and its position is spread evenly.
- Every option of `one` or `many` has its own feedback sentence that says why it is right or wrong.
- Every wrong option that stands for a typical thinking error gets a tag (`tags`). Tags are short, lower-case and hyphenated, and they name the error, not the option (`myli-narratora-z-autorem`).
- Do not offer choices where the answer becomes obvious.

**Lifetime.** A question that is still the same question keeps its `ref`, because learners' history hangs on it. A rewritten question gets a new `ref`, and the old one is removed explicitly.

## 1.5 Slides and text

- **One thought per slide.** Usually 1–4 sentences, never more than about 130 words. Short sentences and concrete nouns.
- **Alternate.** One or two slides, then one or two questions about exactly those slides. Never more than three slides or two questions in a row (except in the closing block, 1.6). The question comes right after the slide that prepares it.
- **Anchor first.** Start with 3–5 landmarks and add 2–3 things at a time. Give the full list or order only at the end. Leaving out a detail is better than burying the learner.
- **An entry specific to the subject.** Do not use one template for every topic. Each book or field has its own key (Mateusz through five speeches, Łukasz through the journey, Marek through three places and a question, Jan through signs and the hour). The plan and the towers grow out of that key, with the same names and boundaries.
- **One line, without hesitation.** Do not write "nie jest pewne" or "komentarz nie rozstrzyga". Choose the best-founded reading and tell it consistently. Disputed points go to one slide "Dla dociekliwych" at the end.
- **Concrete and relational.** Join every precise term to an everyday picture. Say what the term changes between the people or things involved (for theology: between God and the person), then give an example the learner knows. One model is "sakramenty działają skutecznie": Christ really changes His relationship to us, like someone who answers every sincere request for help even if I do not use that help.
- **Terms.** Explain a difficult term at its first use, in the same tower or in a required tower. A term that is itself a concept gets its own tower. "Pamiętasz", "znasz już" and "jak wiesz" are allowed only when the knowledge is in the prerequisite chain. Keep one register for the audience: grade 8 and secondary school need simpler words than adult literature courses. Cut asides that add nothing for the learner.
- **No meta-text.** Not "kliknij dalej", "to już nie cytat, lecz ćwiczenie", "wspólny mianownik" or "trzymaj się tego, co mówią źródła".
- **Comparisons.** Never list parallels such as "X — Y; A — B" without context. Each comparison gets its background (who, what situation), the exact quote, and one sentence on what the two sides share.
- **Sources.**
  - Use sources whenever they exist. Working without sources needs the owner's explicit instruction.
  - Work from the full text in the library (`read_text`); study guides are a second source only.
  - Quote only what you have read, exactly, and never from memory. Do not inflect words inside quotation marks; rebuild the sentence around the quote.
  - Cite as `[@key, locator]`. At most one short quoted sentence per slide, attributed to the right speaker.
  - Mark your own interpretations ("tych porównań nie ma w źródłach — robimy je sami").
- **Original languages.** Write the original first and the transliteration in italics after it: ἀποκάλυψις (*apokalypsis*). Check Greek against a dictionary of NT and LXX forms. Write Hebrew with consonants only.
- **Literature.** A reading tower tells nothing that comes later in the book.
- **Drawings.** Use a drawing where it explains: a chart for numbers that are compared or change, a diagram where one thing follows from another, a tree where something divides, a timeline for order in time, an `animation`/`drawing` for forces, motion, rays, circuits and balances. A drawing always comes with words that say the same thing. Describe it generally enough to serve many situations, not only one prepared question. MCP offers examples (I8), which are suggestions, never required templates.
- **Formatting.** Use the format's own markup: paragraphs, `> ` quotes with `> — Author`, `[^1]` footnotes, `[[words|@entry]]` links, and colour `[words]{.red}` used sparingly and always for the same role.

## 1.6 Paths and branching

**Shape.**
- Home → road → tower → road → tower. Every path ends at its tower or at an outer fork.
- Exactly one start and one end. Every step is reachable, and every question has both `right` and `wrong` edges.
- Use stable step `id`s (for example `s<key>`) so that learners' positions survive re-imports.
- A road slide (no tower) belongs to the way onward.

**Two kinds of branching.**

| | Inner branching | Outer fork |
|---|---|---|
| Where | inside a path | a place on the map |
| Branches | rejoin; same target tower | lead to different towers |
| For | help after errors, another explanation form, skipping what is known, chapters in free order | choosing a direction |
| How | `onWrong`, `wrong:<tag>`, `partial`, `rightOnRetry`, `onRight.skip`, `skipWhen`, `chapters`, `choice` with return | `choice` with `of` (describing slide) and `hint` per option; `condition` as ticket |
| Map | small loop at the tower; help never counts | interchange with branches |

A way can run between tower and fork, fork and tower, two towers, or two forks. Branches may differ in length and may be nested. There is no fixed structure: the length follows what the learner needs at that point.

**The adaptive core of every path** (the reference is Romantyczność, the pattern is `example-adaptive`):
1. A short text, then a **probe question**. If it is answered correctly, `onRight.skip` drops the basic slides. A learner who answers 1–3 questions surely is at the tower after about three slides.
2. On a wrong answer: the help slide for that tag (`onWrong.byTag`), otherwise the general help slide, then an easier check question (`onWrong.check`), then `then: "retry"` (`max: 1`).
3. For `many`, `match` and `order`: `partialAt: 0.5` with a `partial` edge to a help step (`remedial: true`).
4. At the end, `{"type": "session", "since": "<first step>", "wrong": {"op": "ge", "than": 3}}` leads to a recap slide (`remedial: true`).
5. Closing block: 2–4 questions that connect the steps, then a summary. After the summary there is nothing; the tower handles reviews. A `review` step is optional.
6. Link help slides to the tower of the question, or the import warns.

**Explanation forms, not copies.**
- Do not build three complete copies of a path for children, school and adults, and do not ask "Jak mam to opowiedzieć?" before anything has happened. That is the current Fizyka pattern, and it is wrong.
- Keep one short main way. Offer the choice of explanation **where a difficulty appears**, after a wrong answer: `wrong:<tag>` → a `choice` with `of` and `hint`, whose branches are help steps (`remedial: true`) that rejoin.
- The author decides how many forms a tower needs and names each by what the learner gets: "Z przykładem", "Ze wzorem — pomyślę sam", "Krok po kroku", "Krótko". Different forms really differ in narration, length and examples; one dense slide for someone who wants formulas, examples for someone who wants examples.
- All forms of a tower use the same facts and the same questions.

**The ladder of paths.** Overview ("Kim był ksiądz Bosko?") → short stage paths → deeper paths through `detour` (`optional: true`). At most 3 levels inside each other, and no cycles. Keep overviews short.

**Bridges** (the same scene in several books, Gospels ↔ Apocalypse, one subject ↔ another world) are designed as one layer for the whole world, not added link by link. A bridge requires every tower it uses.

**Tickets.**
- A ticket comes only from the unit's "Wymaga", from an option's `condition`, or from a `condition` step.
- A line's ticket never requires more than the line's first tower.
- Conditions on the current run (`session`, `lastAnswer`, `streak`) are not tickets.

**Forks.**
- A fork describes itself: its slide goes in `of`, and each option has a `hint` of at most 100 characters. Its label is a short line name of at most 32 characters.
- Do not put a separate describing slide before the fork.
- Use `hold: true` when the learner must always decide.

**Experiments.** Where a simple experiment is possible, it is its own story, and it still ends at one tower. There is no compulsory "try it yourself" question in every tower.

## 1.7 Self-study and lessons: one content, two orders

The same slides and questions serve both orders. Only who presses "next", whose answer counts, and the order of question and explanation differ.

**Self-study: explain first, then ask.**
```
short text (contains the answer) → question (checks that it arrived)
  right → on (skip basics)       wrong → help for this error → easier check → retry
```

**Lesson: ask first, then explain.**
```
short situation (without the answer) → prediction question (nobody knows yet; everyone votes)
  distribution shows which errors sit in the class
→ explanation depending on the answer:  right → short confirmation why
                                        wrong:<tag> → explanation of exactly this error
→ understanding question (now with knowledge; counts)
```

**Prediction questions** point forward ("What happens when …?", "Which ball lands first?"). Their wrong options are the class's typical preconceptions, each with a tag.
- Mark the step `"predict": true` (I3).
- A prediction is shown and evaluated for the vote and for branching, but it **does not count** toward the learner's knowledge, because it is a guess made before the knowledge exists. The app tells the learner so.
- Never use a prediction question as an understanding question.

| Role | When | Counts |
|---|---|---|
| Prediction | before the explanation, in a lesson | no |
| Probe | at the start | yes |
| Understanding question | right after the slide | yes |
| Check after help | after an error, easier | yes |
| Closing questions | end of the path | yes |
| Key question | placement, gaps | yes |

**One path, two modes, choices made by the app when they are clear.**
- A lesson uses the same path and, as far as possible, the same slides.
- The mode (self-study or teacher mode) is not a tag. It is chosen in the general menu (teacher mode only for whoever has the teacher or administrator role in the class area). Content says which mode it serves with a **use flag** on slides, questions and steps: self-study only, lesson only, or both (the default). See I4.
- Where the two orders differ, the path branches. A branch that starts with a lesson-only step is valid only in teacher mode, and a branch that starts with a self-study-only step is valid only in self-study.
- **The app chooses by itself whenever the choice is clear.** This already holds for guided routes: when a learner goes to a target (for example in explore mode, or with "Prowadź mnie tutaj"), the app takes at each fork the branch that leads to the target. It holds the same way for modes: when only one branch fits the active mode, the app takes it. The teacher never sees the switch, and the path follows the mode.
- A lesson-only step inside a branch that both modes use (for example a prediction slide) is skipped in self-study, and a self-study-only step is skipped in teacher mode.

**The teacher plans the lesson.** The app suggests a lesson but never fixes it. In teacher mode the teacher:
1. sets a **start** (home, a tower or a step) and a **target** (a tower);
2. gets the route the app computes, with its paths and towers in prerequisite order (the same computation as "Prowadź mnie tutaj");
3. may narrow it: skip items, add items (another path, a deepening, a tower), and move them;
4. chooses for each tower whether the class only goes **through the path**, or also **through the tower**, answering the tower's questions one after another together.

The plan can be saved and reused. Authors write paths and towers so that any route through them works in a lesson.

**Projector rule.** Every path can be led on a projector: each slide is understandable without clicking, and each question fits on the screen. A lesson ends with three individual questions (exit ticket).

## 1.8 Map, tags and world size

**Rules for every world.**
- One world grows. A new goal (a competition, a class) does not get its own world. It gets tags that select the towers it needs.
- Worlds stay separate and are linked with `@@handle:` (shared mathematics stays in its own world). Links are offers, never prerequisites.
- A new world starts with about 20 towers that are already part of the final world. Then it grows from general to detailed: orientation (author, time, terms), outline, part-by-part reading (one tower per chapter or pericope), then study towers (people, problems, interpretation, writing). 20 towers for a novel is too thin; about 75 was right for "Dżuma".

**Tags.**
- The authors choose tags themselves. First read the existing tags of the world (I5) and reuse them; create a new tag only when no existing one fits.
- Tags form a network with levels: a subtag may belong to several parent tags. A parent tag shows every tower below it.
- Typical tags: competition and stage, historical thread, topic. Whether content suits a lesson is not a tag; it is the use flag (1.7).

**Placement.** Add `explore` ("Sprawdź, ile już umiesz") before long prerequisite chains and as an option at the start of every world from medium size up. Declare it once per scope. Biographical towers keep their story and get no separate placement.

**Question paths** (`paths`) exist only where a real question arises ("Dlaczego satelita nie spada?"). Never invent one. A question path has 3–8 steps, a promise, and 1–3 closing questions.

**Sizes.**

| Size | Towers | Today | Shape |
|---|---|---|---|
| Small project | 10–30 | Romantyczność (14) | one start path with fork and placement; 1–4 areas; one import file |
| Medium | 30–100 | Konkurs Teologii (31) | 3–8 areas; tags for stage and goal; some question paths |
| Large | 100–300 | Fizyka (158), Literatura (190), Pismo Święte (203) | two area levels; ladder of paths; placement per area; bridges; import split by area if needed |
| Giant | 300+ | none yet | several linked worlds; multi-level tags; the map shows only the chosen slice (earlier package C2) |

## 1.9 Process

1. **Read** (1.0) and state the format dates you rely on.
2. **Plan the towers**: goal, direct prerequisites, area and tags per tower. Check for equal steps and for no cycles.
3. **Write** the first 20 towers completely, then grow.
4. **Check the import before delivering.** Send the finished file through the MCP import check (I12). It writes nothing and returns exactly what the app's import would say: the changes, warnings and errors. Deliver only a file with zero errors, and explain the remaining warnings. This applies to every Recreatio import you prepare, not only knowledge bases.
5. **Deliver one idempotent file** that holds the whole world, not a chain of patches. Removals go into it explicitly (`{"ref": …, "remove": true}`); before removing, check with `get_entry` that the entry exists and that nothing else points to it. Stay under 5,000 elements per file, removals included. Never import yourself: the owner imports, and the MCP is read-only.
6. **Change through the builder.** Keep the world's source in a builder script, never hand-edit output JSON, and rebuild after every change.
7. **Check automatically.** Every rule that can be tested gets a validator: slide length, question after slide, flash forbidden, option-length statistics, quotes equal to the library text, prerequisite chain for every question, path checker. Also test the flows for dead ends, not only the questions. Run `get_world_checks` (I2) on the live base before you start and after the owner's import.
8. **Review once.** A different model, which did not write the text, reviews for correctness, style and comprehension and gives concrete findings. Then do **one** repair, and stop.
9. **When the owner points out one error,** search the whole world for the same kind of error before you report back.
10. **After the import,** compare the counts in the base with the file and read a few entries.

## 1.10 Improving a world

- **Read the feedback first:** `get_feedback` for the base, with `state: "open"`. Fix what users reported (wrong, unclear, language, display, too hard, too easy). Keep what they marked as good.
- **Mark what you fixed.** Put every addressed feedback id into the import file as resolved (I6) and name the ids in your report. Until I6 exists, list the ids in the report so that the owner can mark them as done in the app.
- Run `get_world_checks` and treat its findings as the to-do list next to the feedback. Where the world differs from the recommended standard (for example three conquest levels), ask the owner whether to switch, and do not switch silently.
- Apply a fix in one world to another world only after asking. Propose it, though.

## 1.11 Working with subagents

- Give each subagent a written brief file, about five towers, and its own scratch directory. Run at most about 20 at a time, and ask for one-line answers.
- Match the model to the task: a strong model writes entries, keys and bridges and does the independent review; a mid model writes and rebuilds towers; a small model rewrites, summarises and checks mechanically.
- The main agent designs, writes the validators and merges.

## 1.12 Integrity and communication

- **Competitions.**
  - Never reproduce a confidential commission test.
  - Never tailor materials to a test before the exam.
  - After the exam, discuss topics without the test's question numbers.
- **Copyright.** No copyrighted full texts and no access keys in repositories. Slides are your own summaries.
- **Language.**
  - Content in the world's language (Polish for the current worlds).
  - Conversation in the owner's language: he often dictates in Polish or German; read transcription slips by their meaning.
  - Prompts for Claude Code in English and self-contained.
- **Acting and reporting.**
  - Act on clear requests, state the assumption you took, and ask only when a wrong guess is expensive.
  - Report briefly: the result, the numbers before and after, what the owner must import or decide, which feedback ids were addressed, and what was **not** verified (what nobody read, what comes from memory instead of a source).

## 1.13 Checklist

**Structure**
- [ ] Many-dimensional, not a text (1.2a): the source order with levels of detail, plus threads across it (a main character, a topic); `world.linear`, `world.oneLevel` and `world.noThreads` are absent.
- [ ] Equal steps, direct prerequisites, no cycles.
- [ ] Every tower has questions whose `about` is that tower; no question is about a unit.
- [ ] Every slide is linked to its tower, or deliberately to none (road slide).
- [ ] Every path ends at one tower or at an outer fork, with one start and one end, and every question has `right` and `wrong`.
- [ ] Forks describe themselves; labels ≤ 32 characters, hints ≤ 100.
- [ ] Levels are 75 % any and 90 % one, or the owner decided to keep another setting.

**Questions**
- [ ] No `flash`; everything is graded by the computer.
- [ ] Nothing general, nothing answerable from the form of the options; each question is self-contained.
- [ ] Every question is taught by a slide in its chain.
- [ ] Credible distractors with feedback; the correct option is longest in ≤ 30 % of questions, and its positions are spread.
- [ ] Tags on typical errors; the frequent tags have help slides.
- [ ] At least two vote-ready questions per tower.

**Text**
- [ ] One thought per slide (≤ ~130 words); alternation kept.
- [ ] No meta-text and no hesitation; disputed points only in "Dla dociekliwych".
- [ ] Quotes checked with `read_text`; own interpretations marked; sources cited.
- [ ] Terms explained within the chain.

**Map and use**
- [ ] Placement before long chains; question paths only for real questions.
- [ ] Tags reused from the existing list.
- [ ] Every path works on a projector; prediction steps are marked `predict`; lesson-only and self-study-only steps carry the use flag.
- [ ] The import check (I12) returns zero errors.
- [ ] Open feedback read; addressed ids resolved in the file.

## 1.14 What the current worlds show (22 November 2026)

| World | Good, keep | Not yet good |
|---|---|---|
| Romantyczność (14 towers) | adaptive core in every path (probe with `byTag`, check, retry, `partial`, recap at 3 errors); start with fork and `explore`; detour for depth; clear tags of errors | hook slides already state the answer (fine for self-study, not for lessons); 2 open feedback items |
| Literatura (190) | strict slide–question alternation; reading towers chapter by chapter; work from the full text | linear only, no adaptive help; 3 levels (75/85/95 first) instead of 2 |
| Pismo Święte (203) | entry specific to each book; bridges and 18 question paths; one path per tower | linear, about 16 questions per path without adaptive help; 20 overview towers written from memory; about 800 links unread |
| Fizyka (158) | outer fork with knowledge tickets and hints; generated questions; experiment slide ("try"); feedback per option | three full copies per tower (children/school/adults) chosen before any difficulty; 106 path texts unreviewed; numbers from model memory, no sources |
| Konkurs Teologii (31) | `explore` before long chains; strict prerequisite chain checks in its builder | long blocks of 10+ questions at the end of paths; some lines pass through several towers; 3 levels |

---

## Key to the item numbers (added for agents)

The guide was written together with a list of app features; their numbers appear above. Each is a tool or a key of a format — read its exact syntax with `get_import_format` before you use it, and use only what a format describes as live.

| In the text | What it is | Where to read |
|---|---|---|
| I2 | MCP tool `get_world_checks`: findings per base, tower and path (code, weight must/should/info, the entity, a fix hint); it never blocks an import | the tool's own description |
| I3 | `"predict": true` on a `question` step — a prediction that is shown and branches but never counts | `knowledge-base`, flows |
| I4 | the use flag `"use": "self" \| "lesson" \| "both"` on slides, questions and steps, and the condition `{"type": "mode", "is": "lesson" \| "self"}` | `knowledge-base`, flows |
| I5 | the tag list of a world: `get_knowledge_setup`, section `"tags"` (`ref`, `name`, `parents`, `level`, `towers`, `towersBelow`) | `guide-world-map` §5b |
| I6 | `"feedback": [{"id": "<feedback id>", "state": "done", "note": "…"}]` in the knowledge-base import — marks addressed feedback as done in the same write | `knowledge-base` |
| I8 | drawing examples with "when to use" — suggestions, never templates | `guide-visuals` §9 |
| I12 | MCP tool `check_import(format, document)` — the app's import preview for every format, nothing written | the tool's own description |
| C2 | drawing only the chosen slice of a large world (tags) | `guide-world-map` §5b |
