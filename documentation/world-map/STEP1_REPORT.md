# Cogita World Map — Step 1 report

**Date:** 9 November 2026
**Analysed:** `minmer/recreatio` at `main` 549261f5 (includes PR #5 "one hexagon, several inner routes"), and the real knowledge bases **Bosko** (3,393 entries) and **LAAG** (2,167 entries), read through the read-only Recreatio connection (snapshot 2026-11-05, current).
**Nothing was changed** in code or data. The spec and the prototype were not in the repository; I worked from the copies attached to the request.

Paths are relative to `frontend/src/app/cogita/` unless they start with `backend/`, `frontend/`, `templates/` or `pages/`. Line numbers are from `main`.

---

## 1. Understanding

**What I will build**
- A new map of one knowledge base:
  - **Places:** round pillars that stand free.
  - **Position:** computed only from prerequisites and story connections, by a force layout.
  - **Tracks:** routed around the pillars (grid A\* → simplify → smooth → verify).
  - **Stories:** coloured, directed lines on shared tracks, with interchange stations.
  - **Height:** the cards still missing.
  - **Colour:** the topic colour, with learning state shown as saturation only.
  - **Camera:** rotate, tilt, zoom and pan.
  - **Names:** shown only on zoom; a bubble on hover or tap.
- **A pure model layer** with unit tests: graph and cleaning, lines with branches and stations, a condition registry with one knowledge evaluator, height, conquest order, a Dijkstra route and the navigation planner.
- **Geometry in a Web Worker,** cached per world version. Positions are stored so that new places do not move old ones.
- **Conquest by runs:** a new private run record, levels 0–5 set by the admin and overridable by the learner, and the level always recomputed from raw runs. With 1–5 levels, cards of unconquered places stay out of regular reviews.
- **Panels:**
  - place
  - section (ticket with sources, "learn directly")
  - station (choose a direction)
  - navigation (timetable window with branch options)
  - personal settings (levels, pillar width)
- **The guide** `weltkarte-AI.md` in Polish, linked from `opowiesci-AI.md` and listed through MCP.

**What I will not build:** the future condition types (only the registry slot for them), content for Bosko, import fields that are not confirmed, changes to production data, and any MCP view of learner state (runs stay private).

**What the real data changes in the picture**
- **Places are the topic kind that questions are `about`.** In Bosko this is *Temat nauki*: all 1,163 questions name exactly one, on average 9.4 per topic. In LAAG it is *Lerneinheit*.
- **Story units are not places.** Bosko's *Część opowieści* (63 parts, one per flow) and LAAG's *Geschichtsteil* become lines. Today the Bosko "Opowieści — krajobraz" shows them as tiles.
- **Slides are not places either.** A show step reaches a place only indirectly: through the slide's own reference field (Bosko `o_czym`, 558 of 558 slides) or through questions whose `explain` names the slide.
- **Bosko has no content branches.** Its 63 flows are one generated skeleton: slides, questions, optional detours, a review loop. Stations therefore come from detours and from shared places, not from `choice`. The 3-branch station of the test world has to be a fixture.

---

## 2. Mapping (§3)

Status is one of **present**, **present differently** or **missing**.

| Element | Status | Where in the code | Real example / finding |
|---|---|---|---|
| **Place** | present differently | Cards of an entry: `cardsAbout` (`prerequisites.ts:151`). Topics that a real card is about: `gauge.askable` (`knowing.ts:73-81`). Tiles today: the source kind of a landscape view (`views.ts`, `landscapeData.ts`). A story unit without own cards also becomes a tile (`storyUnitsOf`, `flowFacts.ts`). | Bosko: places = *Temat nauki* (`@bosko-nauka/temat/…`, 124 entries). `about` → topic for 1,163/1,163 questions, 5–17 per topic, median 9. Typ split: aspekt 104, etap 8, watek 11, zarys 1. *Not* places: *Część opowieści* (flow `unit`), *Slajd opowieści* (shown by steps), questions, *Obszar krajobrazu* (map areas). The view "Pytania — krajobraz" already uses topics as tiles (`source.kind @bosko-nauka/temat`, `nest: "obszar"`). |
| **Prerequisite between places** | present | Ref fields with `"prerequisite": "up"`, collected by `fieldDependencies` (`prerequisites.ts:42-55`, skips `@@` links). Settings `dependencies`. Graph: `depsMemo` (`store.ts`) → `prerequisiteGraph` (`prerequisites.ts:83-109`). Questions' `needs` (`kinds.ts:229`, also prerequisite "up") feed the **same** graph. | On topics: Temat `wymaga` (prerequisite **and** structure "up"); aspekt → etap → zarys, watek → zarys. On units: Część `wymaga` → parts **or** topics (e.g. `u/e5` needs `u/w0` + `T:zarys`). Question-level: `needs` → other questions (e.g. `q-e2-przedmiescia` needs `q-w-tlo-chlopcy` and `q/e2-4-n4`), often across places. |
| **Block with parts** | missing (candidate present differently) | No field means "part of a place" without also meaning "needed first". Candidates: (1) the view's `landscape.nest` owner nodes (`landscapeNest.ts:54`, `levelMap.ts` `nestAsRegions`); (2) a field with `"structure": "up"` that is **not** a prerequisite; (3) computed regions (`regions.ts:806`), which are groups, not parts. | Bosko: Temat `wymaga` is structure **and** prerequisite, so it cannot mean "part". `obszar` → *Obszar krajobrazu* (60, `nalezy` = structure up). Under nest `obszar` there are 51 level-1 nodes: one per deepening (its 2–3 aspects) and one "Etap N w skrócie" per stage (one topic). The prototype's 3-part block matches exactly such a deepening. Recommendation in §8 Q3. |
| **Line** | present | Flows with `unit` (`flow.ts:181-213`, `readFlow` 254-292). Graph flows: ordered entries via `flowPath` (`flowPath.ts:39-151`, first appearance, fork exits). Presentation flows (`look: "scenes"`): `presentationPath` (`pages/presentation/presentationPath.ts:69-95`, scene `about` + question pieces) through `storyToFlow` (`storyFlow.ts:47-113`). | Bosko: 63 flows, 1:1 with 63 parts (`f/<kod>` → `u/<kod>`): 8 stages, 11 threads, 43 deepenings, 1 intro. All are `look: "slides"` with narrator `@bosko-opowiesci/michal`. No presentation, no scenes, no chapters, no subflow. LAAG has the same shape (Geschichtsteil 25). |
| **Stops** | present differently | Entries per step: `stepEntries` (`FlowPlayer.tsx:132-150`): show/expand/opening → `of`; question → card `about`, else the question. `flowPath.items` keeps the order. `storyPath` parts lose the interleaving of shown and asked entries and drop subflow/detour/line topics. | Show steps show **slides**, not topics. The place comes from the slide's `o_czym` (kind-specific). Equivalently, the question that `explain`s the slide has `about` = the slide's `o_czym` (1,163/1,163). Big lines contain 2–3 "borrowed" questions about aspects of their deepenings (teasers). Walks: §6. |
| **Branch** | present | `choice` (exits o0..on, option `condition`), `chapters` (c0..cn + done), scene with ≥2 buttons, `detour` (done/skip), `condition` (automatic yes/no), `subflow` (PR #5). Fork parts: `storyPath.ts:411-448`, `branchParts` 526-540. Detours as side arms with anchor/rejoin: `pathLayout.ts` `withBranches` 341-403. Routes: `mountain.ts` `routesOf` 105-132. | Bosko: no content branch. The only `choice` is the review retry ("Przegląd jeszcze niezdany"). Branching comes from **detours**: each stage detours to its own 4–9 deepenings, each thread to 3 deepenings, the intro to `f/e1-4`. 6 deepenings are reached from 3 flows. |
| **Introduced cards** | present | Question steps and their card (`askedCardOf`, `flowAsk.ts`). `storyWork` counts slides and questions. Known questions are skipped (`ctx.skip`). Required questions are those on every route (`mountain.ts` `mandatoryQuestionSteps` 91-96). | Bosko: 812 main-line question steps over 63 flows, 0–3 per slide. The review block asks every main question again: these are reviews of the same cards, not new introductions. |
| **Ticket** | present differently | Per **story**, not per section. Unit chain lock: `lockWith` (`storyLock.ts:68-76`) gives missing entries plus "Najpierw powtórz" weak cards. Earlier unfinished stories: `directStartLock` (142-157). Option `condition` (disabled option with a reason). `condition` steps route yes/no but never block. Chapters `done`. Review threshold → goals → `storyStage`. Presentation gates (`story.ts:161`). | Bosko units need parts **and** topics (`u/e5`: `u/w0` + `T:zarys`; `u/t3`: `u/w0` + `u/e1`; oddly `u/e1-4`: `u/w0` + `T:zarys`, not `u/e1`). Conditions in flows: only `value` conditions inside the review loop. No `knowness`/`flow`/`and`/`or`/`not` anywhere, and no option conditions. |
| **Card state** | present (four band systems) | `knownessAt` = q·√(10/(1+9t/interval)), `KNOWN` = 1, `FORGOTTEN` = 0.1, `dueAt` (`knowness.ts:77-167`). Condition bands `inBand` (`logic.ts:190-198`): learned ≥ 0.1, known ≥ 1, due = 0.1 ≤ k < 1, unknown = unseen. Landscape bands known/due/ring/mountain (`landscape.ts:122`, `heightsOf` 323-385). Statistics bands (`knowStats.ts:23-39`). | Topic knowness averages answered cards only (`knowing.ts:69-100`), so one right answer can make a topic "known". The landscape ring uses `cardsMean`, where unanswered cards count 0. Two meanings of "due" coexist: `LandscapeView` `dueCards` uses k < 1, the conditions use `inBand`. |
| **Travelled section** | present differently | Per flow, not per step: `FlowPosition` {step, visited[], chapters, at, done, goals[], path, reset, ref, inside[]} (`learn.ts:87-110`). Monotone merge for done/goals/chapters (`mergePosition` 127-136). `visited` is trimmed to 400 entries when sent (1125). | Derivable: a section is travelled when its steps are in `visited` of that flow, or the flow is `done` on that route. The 400 cap can lose early steps of long flows (Bosko deepenings have up to 140 nodes; stage flows 100+). |
| **Condition language** | present | `logic.ts`: 12 types (value, knowness with of/rel/each/band, answered, visited, flow, time, place, zone, and, or, not, xor; `CONDITION_TYPES` 204). `readCondition` 276-317, synchronous `holds` 355-407, `Facts` 111-135, `conditionText` 335-352 (hard-coded Polish). | **Fails open:** an unknown type reads as `null`, and `holds(null)` is `true`. time and geo (`place`/`zone`) already exist; group, code and qr do not. |
| **Links to other worlds** | present | `@@handle:@name` (`worlds.ts`, `WorldLinks.tsx`). `WorldTopic.portals` → ◎ on the tile (`LandscapeView.tsx:746-748`, `WorldMap.tsx:1391-1398`). `@@` is never a prerequisite (`prerequisites.ts`). | Bosko has no handle or worlds. Keep as a portal marker only. |
| **Existing map** | present (replace geometry and drawing) | `WorldMap.tsx` (Canvas 2D, orthographic rotate/tilt, painter's order), `worldView.ts` (camera, projection, labels), `worldLayout.ts` (hex layout, deterministic, never stored), `landscape.ts` (graph and heights, bitsets), `landscape.worker.ts` + `landscapeClient.ts`, `worldWay.ts` (`wayPlan`), `mountain.ts`, `flowFacts.ts`. | Details in §3. |
| **Set goal** | present | Stored as a fake position `landscape:<viewKey>` (step = goal id) via `learner.keepPosition` (`LandscapeView.tsx:455-476`). `storyGoal.ts:29-38` writes all landscape keys; `StoryRoute.tsx` reads it. Cleared once the goal is known. | Stays untouched. Navigation (§8 of the spec) is separate and lasts for the session only. |
| **Private learner state** | present | `app.learn_batch` (`backend/Api/Sql/0109_cogita.sql:81-104`), sealed per holder. Kinds answers/snapshots/position/values/suspend (+ flags/counts on the server), validated twice: `Kinds` (`backend/Api/Cogita/Cogita.cs:44-47`) and `ck_learn_batch_kind` (0109:99). Personal settings live in `values` under `~` keys, numbers only (`spacing.ts:72-73`). No account: IndexedDB `local:<lib>:<holder>`. MCP never sees it (`AiMcp.cs:733-747`, `AiMcpOverview.cs:54`). | A run kind needs a migration plus an API change (§4). |
| **Existing path view** | present | `PathMap.tsx` + `storyPath.ts`/`pathLayout.ts`. Page module `path` (`pages/parts/path.tsx:32-52`, `pathViews.tsx:48-200`). Also beside the story player (`FlowPlayer.tsx` ~781), Nauka → Ścieżka (`LearningPath.tsx:139`), the landscape (`LandscapeView.tsx:1006/1016`), presentations (`PresentationInNauka.tsx:142`). | "Wybór drogi" = fork part mode `choose` (guide §8a). Detour arms already have anchor/rejoin, i.e. a station model. |
| **World settings** | present (pattern), missing (fields) | `CogitaSettings` (`store.ts:66-108`), read by a validator (`readSettings`), saved by merge (`saveSettings`). Pattern: an admin value plus `locked`, a learner `~` override, and an effective value with priority locked > own > admin > default (`spacing.ts:97-102, 179-184`). | The name `worlds` is taken (cross-base links), so the new field must not be `world`s. Proposal: §5a. |
| **Reviews** | present differently | There is **no** central function. `revision.ts` `start()` → `eligible()` (664-669) → `fillTemporal` (700-727); the spacer comes from all cards (`spacerFor` 767-776). Lists are also built in `RevisionRun.tsx:66-75`, `LandscapeView` (`planFrom`, `reviewCards`, `dueCards`), `QuiltView.tsx:173`, `SlideView.tsx:81`, `storyLock.ts:74`, `StoryRoute.tsx`, `storyGoal.ts`, `FlowPlayer.tsx`, `PathLearn.tsx`, and `reviewRound.ts` for the flow review step. Due counts: `Learner.reportDue` (`learn.ts:1269-1283`) → `app.learn_due` → the "Powtórka czeka" notification (`backend/Api/Notify.cs:638-656`); also `CogitaHome.tsx:210`, `cogitaViews.tsx:584-589`. The offline copy freezes its card list (`offline.ts:81-92`). | One predicate is needed at all of these places (§5a). |

---

## 3. Existing map: replace, adapt, keep — and the 3D technique

**Today:**
- Canvas 2D on two canvases (map + "way" dots), with HTML region labels and an SVG overlay for pieces and the flag.
- Orthographic camera `WorldCam {s, cx, cy, rot, fore}` (`worldView.ts:29-106`) and painter's order (`WorldMap.tsx:1145`).
- Above 1,200 tiles: an oversized offscreen canvas while panning, plus "still/moving" layers for playback.
- Labels: `placeLabels`/`keepLabels`/`fitInfo`.
- Gestures: wheel, drag, orbit with Ctrl or a right drag, and pinch, twist and tilt on touch.
- Built and checked for 5,000 tiles (`scripts/app-worldmap-check.mjs`).

| Keep (reuse as is) | Adapt | Replace |
|---|---|---|
| `WorldCam`, `toScreen`/`toGround`/`fitCam`, glide, all gestures and buttons, camera kept in localStorage | Painter's order (tracks on the ground first, then pillars back to front) | `worldLayout.ts` (hex placement, house tile, wedges, rings) → force layout |
| `fitInfo` (already circle-based), `placeLabels`/`keepLabels`, theme and palette reading | Picking: circle/ellipse test plus a spatial grid instead of the O(n) hex scan | Hex drawing: side faces, hex edges, outlines along shared hex edges, ground cells, 30° text snap |
| Worker RPC with main-thread fallback (`landscapeClient.ts`) | Occlusion (`coverAt`) and the playback ripple (`waveDelays`): distance-based instead of hex neighbours | Pillar width fixed at `HEX_CORNER` (`levelMap.ts:837`) |
| Graph, bitset closure, heights, bands (`landscape.ts`), regions and nest as colour areas | Playback (`landscapeShown`, `playTimes`): same data, new visuals | `[q, r]` export of `landscapeExport.ts:70` / `AiMcp.cs:758` → `[x, y]` (contract change) |
| Goal storage, view modes (Ogólny / Co umiem / Do odkrycia / Do powtórki / Luki), self-check, portals | `wayPlan` (`worldWay.ts:58-172`; Tarjan steps) → the planner's ordering core | Dead code: `fixedLayout`/`layoutOf`/`run` (`landscape.ts`), `layoutLevel` (`levelMap.ts`), `nestLayout` |

**Technique: Canvas 2D, orthographic, reusing the existing camera.** My reasons:
1. **It is proven.** The current renderer already rotates and tilts 5,000 prisms; a cylinder (side quad + top ellipse) is cheaper than a hex prism.
2. **The ground layer is one affine image.** With an orthographic camera the ground plane maps to the screen by a single affine transform (rotate + squash). So tracks, gates, station rings, home and block plates (all at z = 0) can be rasterised **once** into an offscreen canvas in world coordinates and drawn each frame with `setTransform` + `drawImage`. They are re-rasterised only when learner state changes, or at a finer resolution after zooming has come to rest. This makes thousands of track polylines nearly free during rotation.
3. **Text, theming and picking stay simple** in Canvas 2D. WebGL would scale further, but labels, high-DPI text and hit-testing would all have to be rebuilt. Keep WebGL as a later option behind the same model interface.

SVG (the prototype) is fine for 50 places and too slow for 1,000+.

**Dev-mode bug to fix first.** The current worker dies in `vite dev`: `landscape.worker.ts:9` → `landscapeWords.ts` → `lang.ts` → `core/i18n.tsx`, which pulls in `@react-refresh` and its `window` access. The new geometry worker must import no `.tsx` and no i18n. The old worker's `landscapeWords` import can be dropped, because the client already sends the words.

---

## 4. Architecture

A new folder `cogita/worldmap/`. Pure modules have no DOM and no React, and get Node checks in `scripts/app-worldmap2-check.mjs` and siblings.

| Module | Content | Main interface |
|---|---|---|
| `wmGraph.ts` | Read and clean: places, their cards (`cardsAbout`), prerequisite edges between places, blocks, cycles (Tarjan; reuse `worldWay` / `prerequisiteGraph`), dangling refs, author issues | `readWorld(input: WorldInput): World` — input is plain data (entries, kinds, flows, cards), not a `CogitaLibrary` |
| `wmLines.ts` | Lines from flows: place per step, stops, sections, branches, stations, detour lines, subflows inlined (PR #5 segments) | `linesOf(world, flows, resolve): { lines: Line[]; stations: Station[]; issues: Issue[] }` with `Section {line, from, to, steps, slides, introduces: CardKey[], conditions: Condition[]}` |
| `wmConditions.ts` | Registry (§5) + the knowledge evaluator | `register(ev)`, `evaluate(c, ctx)`, `cost(c, ctx)`, `describe(c, ctx, t)` |
| `wmState.ts` | Per person: card states, tickets with sources, heights, conquest order, Dijkstra from Home, route summary | `stateOf(world, lines, learnerView): WorldState` |
| `wmRuns.ts` | Run model, level from raw runs + effective rules, waiting gaps | `levelOf(place, runs, rules, now)`, `canRun(…)` |
| `wmPlan.ts` | Navigation plan, timetable window, branch options | `plan(target, state, choices): Plan` |
| `wmLayout.ts` | Force layout with Barnes–Hut from 500, stable insertion, circle packing for blocks | `layout(world, lines, previous?): Positions` |
| `wmTracks.ts` | Grid A\*, simplify, Catmull–Rom, verify, offsets for parallel lines | `tracks(world, lines, positions): Track[]` + `checkClearance(...)` |
| `wmGeometry.worker.ts` | Layout + tracks; no `.tsx`, no i18n | message `{world, lines, previous}` → `{positions, tracks, issues}` |
| `WorldPillars.tsx` (+ `worldPillars.css`) | Canvas renderer on the reused camera | gets finished data only |
| `WorldPanels.tsx` | Place, section, station, navigation, settings panels | texts via `t()` (CLAUDE.md) |

**Cache and storage of geometry**
- **World version** = hash of the places, the prerequisite edges between places, the section pairs, the blocks and the layout parameters.
- **Positions** go in a new document kind `worldmap` in the knowledge base. The fields would be `{version, positions: {placeId: [x, y]}, params}`, about 300 KB for 5,000 places.
  - The backend accepts any lowercase kind (`ck_library_entry_kind`, `0064_library.sql:97`) up to 4 MB sealed (`Library.cs:32`).
  - Add `worldmap` to `DOC_KINDS` (`kinds.ts:64`), not to `SHARED_DOCS`.
  - **Who writes it:** only people with write access — automatically after a change (like the MCP snapshot) and with "Re-lay the whole map".
  - **Learners** read it. If it is missing or stale, they compute deterministically from the stored positions plus insertion.
- **Tracks** are not stored. They are recomputed in the worker from the positions and cached in IndexedDB under the world version.

**Storage of runs**
- A new learn batch kind **`run`**, append-only like answers.
  - **Server:** migration `0140` (drop and re-add `ck_learn_batch_kind`, precedent `0135_course_base_key.sql:13-19`), and `run` added to `Kinds` (`Cogita.cs:44-47`) but not to `Latest`. **The API must be deployed before the frontend**; otherwise inserts fail on the CHECK.
  - **Client:** `BatchKind`, `Progress.runs`, `absorb` (dedupe by run id), the local and offline copies, live sync, `app-learn-sync-check.mjs`.
- **Contents:** a run header only: `{id, place, participants: [holderRoleId], startedAt, finishedAt, cards, firstTry, afterCorrection, attempts}`.
  - Each answer in the run carries `via: "run:<id>"` (`AnswerRecord.via` exists, `learn.ts:49`), so the counts can be re-derived and checked.
  - Sealed for the holder **without** the area key, so teachers' area reads skip it (`Cogita.cs:118, 480`). This is a decision: Q9.
- Not visible through MCP (learn batches never are).

**Personal world settings** stay in `values` as numbers (§5a); no new batch kind is needed for them.

---

## 5. Conditions (§10)

**`logic.ts` can be the shared language, with three changes.**

1. **The same JSON form.** Tickets and run unlocks are `Condition` objects exactly as in flows today: `knowness` with `of`/`rel`/`each`/`band`, `flow`, `value`, `and`/`or`/`not`/`xor`, `time`, `place`/`zone`. Authors write one language everywhere.

2. **A registry beside `holds`, not inside it.**

   ```ts
   interface ConditionEvaluator<C extends Condition = Condition> {
     type: string;
     prepare?(c: C, ctx: LearnerContext): Promise<void>;   // async facts: device, code, QR, group
     evaluate(c: C, ctx: LearnerContext): ConditionResult; // synchronous over prepared facts
     cost(c: C, ctx: LearnerContext): number;
     describe(c: C, ctx: LearnerContext, t: T): ConditionView;
   }
   type ConditionResult = { met: boolean; progress?: number; missing?: unknown; pending?: boolean };
   ```

   - **Async without breaking anything.** The spec allows an async `evaluate`. I propose async `prepare` plus a synchronous `evaluate`, because everything that walks flows is synchronous: `enter`/`advance`, `runningStory`, `optionsOf`, `goalsReached`, `storyPath` with `decide`, revision planning and the presentation route. Dijkstra and the planner read the last prepared result; a result not prepared yet is `pending` (treated as not met).
   - **The knowledge evaluator** handles `knowness` and the implicit unit requirement. It returns `missing = {review: CardKey[], new: CardKey[]}` with the source of each new card. Its cost is 4·new + 1.5·review.
   - `describe` goes through `t()`. `conditionText` and the label tables in `logic.ts` are hard-coded Polish today.

3. **Fail closed for tickets.** Today an unknown type becomes `null` and `holds(null) === true`, so the gate opens. For tickets I would read unknown types into `{type: "unknown", raw}`, which evaluates to "not met, unknown type" and lands in the author list. I would not change `readCondition` for existing flows in this step (Q10).

**Sources of a section's ticket**
- (a) **First section:** the unit's `Wymaga`. A required part maps to "that story passed" (the `flow` type, as `storyLock` does today). A required topic maps to knowledge of that place's cards.
- (b) The `condition` of the `choice` option the branch starts from.
- (c) `condition` steps used as **gates** on the section, i.e. where one exit leaves the line (ends, or goes back).
- **Not tickets:** automatic `condition` branches whose both exits continue the story. They pick the branch the learner will see (`decideBy`). Also not the review loop's `value` conditions — in Bosko these are the only conditions there are.

### 5a. Settings and reviews

**Admin (knowledge base `settings`)**
- A new field **`levelsSetup`**; the name `worlds` is taken.

  ```json
  "levelsSetup": {"levels": 3,
    "rules": [{"pct": 75, "attempts": "any"}, {"pct": 85, "attempts": "one", "gapDays": 1}, {"pct": 95, "attempts": "first", "gapDays": 1}],
    "knownShare": 1, "pillarWidth": 0.7, "locked": false}
  ```

- Read by a validator modelled on `readAreaSpacing` (`spacing.ts`). Added to `SETUP_SETTINGS` (`json.ts:228`) and `SettingsKept` (`AiMcp.cs:735`) only if AI should see it.

**Learner (personal `values`, numbers only)**
- `~world.levels`, `~world.l1.pct`, `~world.l1.attempts` (0 any / 1 one / 2 first), `~world.l1.gap`, …, `~world.pillar` (40–100).
- Saved like `keepStack` (`learn.ts:1198`). Effective value = locked admin > own > admin > default, as `effectiveSpacing` does.

**Keeping cards of unconquered places out of reviews**
- **One predicate** `reviewable(card, worldState)` in `wmState.ts`, true when any of these holds:
  - effective levels = 0,
  - the card belongs to no place,
  - the card's place is conquered.
- **Used at every place that builds a review list or a due count:**
  - `revision.ts` `eligible()` and `spacerFor()`
  - `RevisionRun` `planFor`
  - `LandscapeView` `dueCards`/`reviewCards`/`reviewFirst`
  - `CogitaHome.tsx:210`, `cogitaViews.tsx:584`
  - `QuiltView.tsx:173`
  - `StoryRoute`, `storyGoal`, `storyLock.ts:74` ("Najpierw powtórz")
  - `Learner.reportDue` (so the server notification matches)
  - the offline copy (baked in when the copy is kept)
- **Not filtered:** learning new topics, questions inside stories, the flow review step, practising a slide's questions. These are learning, not regular reviews.
- **Existing learners:** they have no runs. Switching an existing base to 1–5 levels would therefore stop all of their reviews at once. Recommendation (Q8): default 0 levels for existing bases, and the settings page shows how many cards would leave reviews before the admin switches.

### 5b. The path view ("Ścieżka")

- **The map takes over choosing between stories and branches,** at its stations. The station panel lists every outgoing direction. Choosing one opens the flow at that branch: a small player API extension, `jumpTo {step, exit}`.
- **Ścieżka stays as the view *inside* one line:** slides, questions, review, and inner routes (PR #5). It stays beside the story player, in the page module `path`, and in the landscape panel. Its `choice` forks stay, because a story played on its own still asks at its forks.
- **Nauka → Ścieżka** (`LearningPath.tsx`, over prerequisites) overlaps with the navigation timetable. I recommend keeping it until the timetable is accepted, then folding it in (Q12).

---

## 6. Lines from real Bosko flows

**All 63 Bosko flows share one generated skeleton:**
- **Main line:** each slide (`show`) is followed by 0–3 questions. Each question writes `set ok = 1/0` and both exits rejoin. Then optional `detour` steps follow, with "done" and "skip" going to the same next step.
- **Review block:** every main question is checked again through `value` conditions. Passing needs `przeglad ≥ ceil(0.9·N)`; if it fails, a `choice` offers to repeat. Then `koniec`.
- **Step counts:** show = S+2, question = 2N, set = 4N+1, condition = N+1, choice = 1, detour = D, end = 1.
- **Anomalies:** e2-1 and e6-3 start at `sn1`, not `s1`. Three slides have no question.

**Places of steps (rule R1, recommended):**
- A `show` step → the shown entry if it is a place; otherwise its reference fields that point to a place kind (Bosko: slide `o_czym`). Fallback: the `about` of questions that `explain` it.
- A `question` step → its `about`.

**Stops (rule R2, recommended):**
- Stops come from shown entries.
- A question about another place (a "borrowed" teaser) creates no stop. Its card counts as *introduced for that place* on this section.
- The review block (repeated questions after the main line) creates no stops.

Under the literal rule of spec §5.2 (every step, first appearance), big lines zig-zag through the aspects they only tease. Both results are shown below.

**First section (R3):** from the places the unit requires (Home if none) to the first stop. Ticket = unit `Wymaga`.

**Detours (R4):** the target flow's line starts at the current stop and returns to it, which makes that stop an interchange station.

### (a) Etap 5 — `f/e5` (unit `u/e5`, duza)
- **Unit:** `wymaga` = `u/w0` + `T:zarys`; `tematy` = `T:etap-5`. No stage requires the previous stage; stage order exists only in `nr`.
- **Steps:**

  ```
  s1·q1_1 → s2·q2_1[a/e5-1-2]·q2_2 → ⇢e5-1 → s3·q3_1·q3_2[a/e5-2-1] → ⇢e5-2 → s4·q4_1 → ⇢e5-3 ⇢e5-4 → s5·q5_1·q5_2 → ⇢e5-5 ⇢e5-6 → s6·q6_1[a/e5-9-1]·q6_2 → ⇢e5-7 ⇢e5-9 → sn1·qn1_1–3 → ⇢e5-8 → review
  ```

  All slides: `o_czym` = etap-5.
- **R1–R4 result:**
  - **Stops:** `etap-5` only.
  - **Sections:** one: `zarys → etap-5`, with 7 slides and 10 own cards, plus 3 borrowed cards introduced for a/e5-1-2, a/e5-2-1 and a/e5-9-1. Ticket: `u/w0` passed + `zarys` known.
  - **Stations:** `etap-5`, with 9 deepening lines leaving and returning (e5-1 … e5-9, each a loop through its 2–3 aspects).
  - **Shared with threads:** e5-2 and e5-3 (t11), e5-6 (t3), e5-7 (t1, t8), e5-8 (t5).
- **Literal §5.2:**
  - **Stops:** `etap-5 → a/e5-1-2 → a/e5-2-1 → a/e5-9-1`.
  - The e5-2 and e5-9 detours would start at their own aspect places. The line would cross into three deepenings that it does not teach.

### (b) Thread t3 „System prewencyjny" — `f/t3` (unit `u/t3`, watek)
- **Unit:** `wymaga` = `u/w0` + `u/e1`; `tematy` = `T:system`; `obszar` = etap-1, etap-3, etap-5.
- **Steps:**

  ```
  s1·q1_1·q1_2 → s2·q2_1 → ⇢e3-2 → s3·q3_1 → ⇢e6-3 → s4·q4_1[a/e5-6-2]·q4_2 → ⇢e5-6 → s5·q5_1–3 → s6·q6_1[a/e8-4-2]·q6_2 → review
  ```

- **R1–R4 result:**
  - **Stops:** `system`.
  - **First section:** `etap-1 → system` (`u/e1`'s topic; `u/w0` passed). 2 borrowed cards: a/e5-6-2 and a/e8-4-2.
  - **Station:** `system`, with 3 deepening loops (e3-2, e6-3, e5-6).
- **Literal §5.2:**
  - **Stops:** `system → a/e5-6-2 → a/e8-4-2` (first appearance; the line keeps returning to `system`).
  - **Track:** a section to `a/e8-4-2` that no detour reaches.
- **For the author list:**
  - The parts that list t3 in `nalezy` (e1-3, e3-1, e5-7, e5-9) are none of its detour targets.
  - Detour targets differ from the `nalezy` members for 10 of the 11 threads.

### (c) Etap 1 — `f/e1` (unit `u/e1`, duza)
No Bosko flow has a content branch, and none is a presentation. So the third walk is a second stage, plus one deepening.

- **Unit:** `wymaga` = `u/w0` + `T:zarys`; `tematy` = `T:etap-1`.
- **Steps:**

  ```
  s1·q1_1·q1_2 → ⇢e1-1 → s2·q2_1 → ⇢e1-2 ⇢e1-3 → s3·q3_1[a/e1-4-1] → ⇢e1-4 → s4·q4_1·q4_2 → ⇢e1-5 → s5·q5_1[a/e1-6-3]·q5_2 → ⇢e1-6 → s6·q6_1·q6_2 → review
  ```

- **R1–R4 result:**
  - **Stops:** `etap-1`.
  - **First section:** `zarys → etap-1`.
  - **Station:** `etap-1`, with 6 deepening loops. Shared: e1-1 (t1), e1-2 (t2), e1-4 (w0), e1-5 and e1-6 (t9).
- **Literal §5.2:**
  - **Stops:** `etap-1 → a/e1-4-1 → a/e1-6-3`.
- **Deepening `f/e1-5`** (read in full): stops `a/e1-5-1 → a/e1-5-2 → a/e1-5-3`, with 3, 6 and 7 questions.
  - Deepenings are the only Bosko lines that really travel from place to place.
  - This one is a loop from `etap-1` (detour of e1) and from the t9 thread's place (detour of t9).

### What the map of Bosko would look like
- **Pillars:** 124.
- **Hubs:** 8 stage places, 11 thread places and `zarys`.
- **Lines:**
  - The intro line runs from Home to `zarys`, assuming `u/w0` requires nothing (its `wymaga` was not read).
  - The 19 big lines are mostly entry sections into their hub.
  - The 43 deepening lines are short loops of 2–3 aspects back to the hub that called them. Six of them are called from three hubs.
- **Stations:** at every hub.
- **No content branches at all.** The station with 3 branches required by spec §12 must come from the fixture world.
- **Data issues the author list would show:**
  - thread `nalezy` versus the actual detours
  - `u/e1-4` requiring `u/w0` instead of `u/e1`
  - the two flows that start at `sn1`
  - "Opowieści — krajobraz": the region keyed by w0 is named „Dom w czasie burzy"

---

## 7. Gaps

| # | Gap | Derive / decision |
|---|---|---|
| 1 | Which kinds are places | **Derive**: kinds of the questions' `about` targets, minus flow-unit kinds, slide kinds and `question` (Bosko: Temat nauki; LAAG: Lerneinheit). Configurable through the view's `source.kind` — **decision** Q1. |
| 2 | Block with parts | **Decision** Q3. There is no part-of field in Bosko; the nest owner nodes are a candidate. |
| 3 | Place of a show step (slides) | **Derive** (R1): ref fields of the shown entry to place kinds, fallback via `explain`. |
| 4 | Borrowed questions and review blocks | **Decision** Q4: R2 versus literal first appearance. |
| 5 | Tickets after the first section | **Derive** from option conditions and gate steps (§5). Bosko has none today. |
| 6 | Unit requirement on another unit | **Derive**: "story passed" (as `storyLock`). Its cost comes from the cards of that unit's `tematy`. |
| 7 | Line colours for 63 lines | **Decision** Q5. |
| 8 | Runs | **Missing**: new kind `run` plus a migration (§4). |
| 9 | "Correct after one correction" | **Decision** Q7. Cards have no retry today: a wrong answer shows feedback, and the card does not ask again within the run. |
| 10 | Levels and pillar-width settings | **Missing**: `levelsSetup` + `~world.*` (§5a). |
| 11 | Excluding unconquered places from reviews | **Missing**: one predicate at about 12 places (§5a); **decision** Q8 for existing bases. |
| 12 | Stable positions | **Missing**: doc kind `worldmap` (§4); **decision** Q11. |
| 13 | Travelled sections | **Derive** from `FlowPosition.visited`/`done`. The 400-step cap is a risk (§9). |
| 14 | Question-level `needs` across places | **Decision** Q6. |
| 15 | Home | **Derive**: lines whose unit requires nothing. |
| 16 | Author list | **Derive**. Shown only to writers (`ctx.writes`). Bosko already has issues (§6). |
| 17 | MCP export of geometry | **Decision** Q13: `[q, r]` hex positions today. |
| 18 | `u/w0`'s own `wymaga` | Not read. **Derive** at build time. |

---

## 8. Open questions (with my recommendation)

1. **Which entries are places?** Recommend: topics, i.e. the kinds questions are `about`. Story units become lines only. The current "Opowieści — krajobraz" (tiles = parts) is then superseded by the lines on the topic map.
2. **New view or replacement of the hex map?** Recommend: the world map as a new rendering of the same view kind (a view setting `landscape.style: "world"`) in the same `LandscapeView` shell and panels. Hex stays the default until you accept the new map; then hex is retired and the dead code removed.
3. **Block with parts.** Recommend: a level-1 node of the view's `landscape.nest` that holds **2–6** places becomes a block with parts. In Bosko that means the deepenings with their aspects, as in the prototype. Larger nodes and higher levels stay colour areas. Alternative: an explicit part-of field later (structure up, not prerequisite).
4. **Stops of a line.** Recommend R2:
   - stops from shown entries
   - borrowed questions introduce cards without becoming stops
   - review blocks create no stops

   With the literal rule, Bosko's stage lines would zig-zag through aspects they only tease.
5. **Line colours.** 63 lines need families. Recommend: each big line (stage, thread, intro) gets its own hue; deepening lines get a lighter shade of their area's hue. At far zoom, deepening lines are hidden.
6. **Question `needs`.** Recommend: ignore them for geometry and height; use them only to order cards within a place and in the ticket's sources.
7. **Attempts "one correction".** Recommend: within a run, a wrong card is asked once more at the end of the run. "First attempt" counts only answers that were right the first time; "one correction" counts those that were right on that second ask; "any" counts right at all.
8. **Existing bases and reviews.** Recommend: `levels` defaults to 0 for existing bases (today's behaviour). The admin opts in. The settings page shows how many cards would leave reviews, and that every learner starts unconquered.
9. **Who sees runs.** Recommend: private to the holder (sealed without the area key). Teachers see levels only if you decide so later.
10. **Unknown condition types.** Recommend: fail closed for tickets and run unlocks only; leave flows as they are, and show unknown types in the author list.
11. **Who stores positions.** Recommend: writers' browsers write the `worldmap` document automatically after a change, plus a manual "Re-lay the whole map". Learners never write.
12. **Ścieżka and Nauka → Ścieżka.** Recommend: keep the in-story Ścieżka; fold `LearningPath` into the timetable after acceptance.
13. **MCP landscapes export.** Recommend: keep the hex `[q, r]` export while hex views exist; add `[x, y]` for world views only if AI authoring needs it.
14. **"Prowadź mnie tutaj" today sets a goal.** Recommend: that button becomes the new session-only navigation ("Take me there"). "Ustaw jako cel" stays exactly as it is.
15. **The PR #5 "one hexagon" model.** Recommend: keep its completion logic (required questions on every route, `storyCompleted`). Its picture, one tile per unit, is replaced by a line whose `choice` → `subflow` segments become line branches.
16. **Where this report lives.** `docs/` is the published site, and `deploy-web.bat` deletes `docs\` on every site build. Recommend: move the spec, the prototype and this report to `documentation/world-map/`.

---

## 9. Risks

| Risk | Handling in Step 2 |
|---|---|
| **A\* at 5,000 places** (< 20 s): a full-world grid with cell 7 has millions of cells | Bounded search per track (bounding box of the two gates plus a margin, widened only on failure). Bucketed obstacle tests. Tracks shortest-first, so "used" cells bundle. Everything in the worker. A timing test in the check script. |
| **Force layout O(n²)** | Barnes–Hut quadtree from 500 places. The iteration count scales with n. Warm start from stored positions. |
| **Stability** needs stored positions that only writers can store | Doc kind `worldmap`. Deterministic fallback. A test that adding 10 places moves no existing place. |
| **Reviews disappearing** for existing learners | Default 0 levels; explicit opt-in with a count. |
| **Order of deployment** for the `run` kind | Migration and API first; until then the frontend checks for the kind like `Schema.LearnEpochAsync`. |
| **Unknown conditions open gates** today | Fail-closed reader for tickets; author list. |
| **`visited` capped at 400** loses early steps of long flows | Derive "travelled" also from `done` and the route. Consider a compact "sections travelled" set in the position (decision in Step 2). |
| **Two meanings of "due"** (k < 1 vs `inBand`) | The world map uses `inBand`, and so does the review predicate. |
| **Clutter with 63 lines** | Colour families, hidden deepenings at far zoom, parallel offsets. |
| **Dev-mode worker crash** (react-refresh) | The new worker imports no `.tsx`; the old worker's `landscapeWords` import is dropped. |
| **Hard-coded Polish** in `logic.ts`, `FlowPlayer` option reasons | New texts via `t()` and locale files (en/de/pl). |
| **Parallel work** in shared files (`LandscapeView.tsx`, `lang.ts`, `learn.ts`) | New code in `cogita/worldmap/`; small hooks into shared files; re-read before each edit. |
| **Real data has no branches** | Branches, stations and 0/1/3/5-level behaviour are tested on the fixture worlds of §12. |

---

## 10. Effort (focused working days, including tests)

| Part (§13) | Effort | Notes |
|---|---|---|
| 1 · Model | 4–5 | `readWorld`, lines with R1–R4, stations, registry + knowledge evaluator, heights, order, Dijkstra, planner; fixtures for the 4 test worlds |
| 2 · Runs | 4–5 | Migration and API (deploy first), batch kind, settings (admin + learner), run flow, levels from raw runs, the review predicate at about 12 places, offline copy |
| 3 · Geometry | 4–5 | Force layout + Barnes–Hut, A\* tracks, verification test, worker, IndexedDB cache, `worldmap` doc, stability test, timing |
| 4 · Presentation | 4–5 | Pillar renderer on the existing camera, ground layer as one affine image, labels, bubble, lines and locks, stations, home, blocks, pillar width; screenshots in light/dark and desktop/phone |
| 5 · Interaction | 5–6 | Place / section / station / navigation panels, tickets with sources, learn directly, runs, timetable with branch options, choosing at a station (player `jumpTo`) |
| 6 · Guide | 1 | `weltkarte-AI.md` (Polish), link from `opowiesci-AI.md`, `import-formats.mjs` listing, regenerated `ImportFormats.json` |
| **Total** | **22–27** | Plus one API deploy before the frontend. |
