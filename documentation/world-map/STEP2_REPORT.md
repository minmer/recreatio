# Cogita World Map: Step 2 report

**Date:** 9 November 2026
**Branch:** `cogita/world-map` (PR B), stacked on `cogita/world-map-server` (PR A, #6); base `main` `8e05c08a`, merged with `main` `122be75c` in the second pass
**Follows:** `STEP2_DECISIONS.md` §3 — PR A first, then PR B with parts 1–6, one commit per part

## Summary

- **Everything in §3 of the decisions file is built.** PR A (migration 0140 and the server probe) and PR B parts 1–6 are one commit each. A small follow-up commit after part 6 makes topic colours cycle the way the hex landscape does (see deviation 13).
- **A second pass closed what the first report missed** (§1, "Second pass"). A review against the decisions and the spec found three gaps, now built:
  1. The dead code listed in Step 1 is removed (decision 2).
  2. The run probe now hides run features: levels count as 0 until the server stores runs.
  3. The world view has the hex view's modes, self-check, portals, goal and playback (Step 1 §3).

  The same pass added picking through a screen grid, names hidden behind nearer pillars, and a keyboard list of places (the former deviation 15).
- **Every acceptance check in spec §13 passes.** The four click paths of part 5 run in the real app with real mouse clicks: 38/38 checks, including an extra run path and a sixth path for the second pass. The guide is readable through the MCP tools.
- **Deploy order:**
  1. PR A: migration 0140, then the API.
  2. PR B: the API again (it changes `ImportFormats.json`, the MCP texts and `SettingsKept`), then the frontend.

  Hex stays the default. The world map only appears in a view with `"landscape": {"style": "world"}`.
- **Bosko today:** 124 places, 63 lines, 20 interchange stations, no blocks, no branch stations. Layout and tracks take 244 ms, with no straight fallbacks and no clearance violations. Writers see an author list with 164 notes, all at "info" level.

---

## 1. What was built

### PR A — server (`7ebc027b`)

| File | What |
|---|---|
| `backend/Api/Sql/0140_learn_run.sql` | `ck_learn_batch_kind` allows `run`. Idempotent, like 0135. |
| `backend/Api/Cogita/Cogita.cs` | `run` is in `Kinds`; it is not in `Latest` or `Anonymous`. Until the database knows the kind, a run batch gets 409 instead of a CHECK failure. `GET /workspace/learn/features` returns `{ run }`. |
| `backend/Api/Infrastructure/Schema.cs` | `LearnRunAsync` reads the CHECK definition (the probe). |
| `backend/Api.Tests/CogitaChecks.cs` | Checks for the kinds and for the probe. |

The first commit (`ef46fd3e`) moved the spec, the prototype, the Step 1 report and the decisions to `documentation/world-map/`.

### Part 1 · Model (`ad6f9846`)

Everything is pure TypeScript under `frontend/src/app/cogita/worldmap/`.

| File | What |
|---|---|
| `wmTypes.ts` | Input and output types, `HOME`, the 16 author-list codes (`ISSUE_CODES`). |
| `wmGraph.ts` | `readWorld`: places (decision 1), prerequisites, blocks only via `"part": "up"`/`"down"` (decision 3), cycles (iterative Tarjan), dangling references, base bitsets. |
| `wmLines.ts` | `linesOf`, which turns each flow into a line: <br>• expands subflows; <br>• walks the graph with post-dominators; <br>• applies R1–R4; <br>• branches from `choice`/`chapters`/scene buttons, including PR #5 `choice → subflow`; <br>• stations and detour stations per caller (correction 3); <br>• tickets only from (a), (b) and (c) (correction 4); <br>• the author-list findings of decision 7. |
| `wmConditions.ts` | The evaluator registry `{type, symbol, read, prepare (async), evaluate, cost, describe}`. Built-in `knowness` (card bands only, via `inBand` — correction 1), `story`, `flow` and the plain types. Unknown types fail closed for tickets (decision 10). |
| `wmState.ts` | `stateOf`: <br>• card bands; <br>• conquered places (0 levels: share of known cards; 1–5: last level reached); <br>• height via bitsets; <br>• tickets; <br>• travelled sections from visited/done (correction 2); <br>• Dijkstra from Home; route summary; conquest order; card sources; <br>• `reviewable()` (correction 5). |
| `wmPlan.ts` | The navigation plan (travel / learn / run / wait / know), waiting gaps, branch options, `timetableWindow`. |
| `wmFixtures.ts` | Test worlds: <br>• Bosko shape: 50 places, a block with 3 parts, a 3-way choice; <br>• generated worlds with 1,000 and 5,000 places; <br>• a broken world with every case of §11; <br>• `fakeLearner`. |
| `schema.ts`, `kinds.ts` | `FieldDef.part` is read, exported and imported. |
| `scripts/app-wm-model-check.mjs` | 123 checks. |

### Part 2 · Runs (`9b75b24e`)

| File | What |
|---|---|
| `learn.ts` | Batch kind `run`: <br>• sealed for the holder only (decision 9); <br>• never in `LATEST_KINDS`; <br>• deduplicated by id; <br>• posted one by one, so a 409 before 0140 blocks nothing. <br>Also `keepRun`, `keepLevels`, `keepPillar`, `learnFeatures()`, and `reportDue` filtered by `reviewable`. |
| `worldmap/wmRuns.ts` | `levelsSetup` (admin) and `~world.*` (learner); priority is locked admin > own > admin > default 0. Levels are computed from raw runs: at most one level per run, gaps measured from `reachedAt`. `runGate`, the `conquered` evaluator, the run session (a wrong card returns once at the end — decision 7). |
| `worldmap/wmReview.ts`, `worldmap/wmInput.ts` | `effectiveWorldFor`, `reviewScopeFor`, `leavingReviews`; the world input built from the base, memoised per revision. |
| `worldmap/WorldLevels.tsx`, `worldmap/WorldRun.tsx` | The settings editor (the admin saves explicitly and sees how many cards would leave reviews — decision 8), "Moja mapa świata", the pillar slider, the run screen. |
| `revision.ts`, `RevisionRun.tsx`, `LandscapeView.tsx`, `CogitaHome.tsx`, `pages/parts/cogitaViews.tsx`, `QuiltView.tsx`, `storyLock.ts`, the offline copy | Every review and due-count site calls `reviewable`. |
| `store.ts`, `json.ts`, `CogitaSettings.tsx`, `backend/Api/Library/AiMcp.cs` | `levelsSetup` in the base settings (read, export, MCP `SettingsKept`). |
| `locales/{en,de,pl}/cogitaWorld.json` | Texts. |
| Checks | `app-wm-runs-check` (39; 47 after the second pass), `app-wm-review-guard-check` (18; fails when a new review site skips `reviewable`), `app-learn-sync-check` §6 (409 before the migration, the probe). |

### Part 3 · Geometry (`6e38cee0`)

| File | What |
|---|---|
| `worldmap/wmLayout.ts` | Deterministic force layout: <br>• track springs and weak prerequisite springs; <br>• Barnes–Hut from 500 nodes; <br>• hard minimum rim gap of 2.1 R; <br>• stable mode keeps stored places fixed and inserts new ones; <br>• blocks as one disc (`packParts`). |
| `worldmap/wmTracks.ts` | A* on a growing grid, line-of-sight simplification, Catmull–Rom curves verified every 2 units, `clearance` (tolerance 8), parallel lanes 5 units apart. |
| `worldmap/wmGeometry.ts`, `wmGeometry.worker.ts`, `wmGeometryClient.ts` | Geometry in a Web Worker, cached in memory and in IndexedDB (`wm-geo:<version>`). The worker imports no `.tsx` and no i18n (correction 6). |
| `worldmap/wmStore.ts`, `kinds.ts`, `json.ts` | The `worldmap` document: writers' browsers write it after a change, and on "Ułóż mapę od nowa" (decision 11). It is never part of a course export. |
| `landscape.worker.ts`, `landscape.ts`, `landscapeClient.ts` | `landscapeWords` and the i18n import were removed from the old worker. `landscape.ts` now returns keys, which the client translates (see deviation 1). |
| Checks | `app-wm-geometry-check` (41). |

### Part 4 · Presentation (`71223460`)

| File | What |
|---|---|
| `worldmap/WorldPillars.tsx` | Canvas 2D renderer with an orthographic camera: <br>• continuous rotation (slider, Shift/right-drag, two-finger twist), tilt 25°–88° around a fixed centre, zoom at the cursor, keys; <br>• the ground is rasterised once per state and drawn with one affine transform; <br>• pillars are drawn back to front, never transparent; <br>• names only when `r_px > 24 + 0.32·h_px`, never overlapping. |
| `worldmap/wmScene.ts`, `worldmap/wmColors.ts` | The scene. Lane states: travelled, open, or locked with a symbol per condition type. A separate OKLCH line palette that is darker and more saturated than the pillars (decision 5). |
| `worldmap/WorldLandscape.tsx`, `views.ts`, `LandscapeView.tsx` | `landscape.style: "world"` inside the `LandscapeView` shell; hex stays the default (decision 2). |
| `worldmap/worldmap.css` | Styles, using only theme variables, light and dark. |
| `scripts/wm-courses.mjs` | Course JSON for the preview: the fixture, 1,000 places, and the Bosko shape from the read-only copy. |
| Checks | `app-wm-presentation-check` (26). |

### Part 5 · Interaction (`ff24852d`)

| File | What |
|---|---|
| `worldmap/WorldPanels.tsx` | Place, section, station/home, navigation and author-list panels (see below). |
| `worldmap/wmNav.ts` | Session-only navigation (decision 14): steps count as done only through learning, never by choosing a branch; map marks; `sessionStorage`. |
| `worldmap/wmAuthors.ts` | The author list: world, lines, routing failures (red) and mislabelled colour areas. |
| `worldmap/WorldLandscape.tsx` | Opens stories at a section's start, and at a station directly in the chosen branch. Runs learning, reviews and runs in place of the map. Navigation glow (next steps strong, later faint), pennant, flag and fork marks. Re-renders on every learner change. The side panel follows the container width. |
| `FlowPlayer.tsx` | `jumpTo {step, exit}` (Step 1 report §5b). |
| `worldmap/WorldPillars.tsx` | Navigation marks; a canvas hook (`wmLocate`, `wmLanes`) for the click-path drive. |
| `worldmap/wmPlan.ts` | Branch options exclude complements (deviation 2). |
| `preview/PreviewKnowledge.tsx` | `knowledge({ author: true })` renders as a writer. |
| `scripts/wm-courses.mjs` | Maps references inside nested conditions. |
| Checks | `app-wm-interaction-check` (34); `scripts/wm-click-paths.mjs` (the click paths, 25 checks; 38 with path 6 of the second pass). |

The panels in `WorldPanels.tsx`:
- **Place** (§7.3): card count; level N of M; knowledge dot with "Powtórz"; "Start run for level X" with its rule, or "Level X from <date>"; the conquest order with card counts and a total; sources of never-seen cards with "Learn directly"; lines here; "Moje ustawienia".
- **Section** (§6.1): the ticket conditions, then each new card's source — the cheapest line that introduces it, whether that line is open or what it needs, or "no slide — learn directly". Then "Learn directly" or "Review". Travel only with a valid ticket.
- **Station and home** (§4.5): every direction with line, branch label, destination, slides and ticket; you choose there.
- **Navigation** (§8.2): the timetable as a vertical line, with a window of 2 done steps, the current step and 4 next ones; "Tu możesz też skręcić" with slides, cards, places it also opens and its effect on the total; "Zakończ nawigację".
- **Author list** (writers only).

### Part 6 · Guide (`6856d9ac`)

| File | What |
|---|---|
| `templates/cogita/weltkarte-AI.md` | The guide, in Polish. It covers: <br>• how to switch the map on; <br>• the eight points of §9; <br>• `levelsSetup`; <br>• "Jak aplikacja używa tych danych"; <br>• a checklist that mirrors the author list. |
| `templates/cogita/opowiesci-AI.md` | New §8d with the link. |
| `templates/cogita/schematy-AI.md` | `"part": "up"` documented next to `"prerequisite"`. |
| `cogitaDataFormat.json` (en/de/pl), `json.ts` | The knowledge-base format text names `"part"` (`kinds.s07Part`) and `"style": "world"` with `levelsSetup` (`course.main.s51World`). |
| `scripts/import-formats.mjs`, `backend/Api/Library/ImportFormats.json` | The format `guide-world-map`, listed by MCP `list_import_formats`. |
| `worldmap/wmExport.ts`, `aiAccess/aiSnapshot.ts`, `landscapeExport.ts`, `backend/Api/Library/AiMcp.cs` | Decision 13: a world view appears in `get_knowledge_setup` → `landscapes` as `{style: "world", home [x, y], places [[x, y, "@place", "@block"\|null]], lines, stations}`, using the same positions the view shows (stored layout first). Hex views keep `[q, r]`. |
| Checks | `app-wm-guide-check` (16); `backend/Api.Tests/AiAccessChecks.cs` (the guide through `AiMcpTools`). |

### Follow-up (`b780cfcb`)

Topic colours cycle through the eight colours like the hex landscape, and the click-path screenshots are WebP.

### Second pass

A review of the first report against the decisions and the spec found three gaps. They are now built, one commit each.

**Merge with `main`** (`a2efd1c3` on PR A, `bef1e8ab` on PR B).
- `main` had a new commit (`122be75c`) whose site build deleted `docs/world-map/STEP1_REPORT.md`, the file this branch had moved to `documentation/world-map/`. PR A could not merge.
- Both branches now include `main`; the moved file is kept.

**1 · The dead code is gone** (`0b557c4b`, decision 2).

| File | Removed |
|---|---|
| `landscape.ts` | `fixedLayout`, `layoutOf` and `LandscapeEngine.layout`/`map`/`positionOf`, with everything only they used |
| `landscapeClient.ts`, `landscape.worker.ts` | the `run` request (and `spoken`, which only translated its fields) |
| `levelMap.ts` | `layoutLevel` (and `unitsOf`, `fanAngle`) |
| `landscapeNest.ts` | `nestLayout` (and `nestSlots`, `ringSlots`, `nestPath`) |

- 2,275 lines in all.
- A reference scan before and after the cut decided what went: only what the listed code had left without callers (deviation 16).
- `app-landscape-check` keeps its 70 checks of live code; the 72 checks of the removed layout went with it.
- `app-levels-check` now checks regions and step heights (22 checks).
- `app-import-check` uses the engine's state (69 checks).

**2 · The probe hides run features** (`a93367bd`, PR A).

| File | What |
|---|---|
| `worldmap/wmFeatures.ts`, `worldmap/useServerRuns.ts` | The server's last answer, kept in the browser. `learnFeatures()` writes it; views redraw when it arrives. |
| `worldmap/wmReview.ts` | `effectiveWorldFor` gives 0 levels (`serverOld`) to a learner with an account while the server cannot store runs. This hides the level arcs and "Start run", and keeps every review and due count as today, including `reportDue` for the reminder. Learners without an account keep their levels, because their runs stay in the browser. |
| `worldmap/WorldLevels.tsx` | The admin cannot save levels before the server is updated, with a note. The learner's own settings say why levels are missing. |
| Checks | `app-wm-runs-check` 47: 8 new — no answer yet, a local learner, the answer arriving, an older server, listeners, no storage, the empty review scope. |

**3 · What the world view keeps from the hex view** (`453e2c5c`, Step 1 §3).

| File | What |
|---|---|
| `worldmap/wmViews.ts` | Pure: which places each mode means; the place memory for the playback (one number per place) and what changed; the playback schedule for each motion level. |
| `worldmap/wmPick.ts` | Pure: the screen grid of drawn pillars, picking the front-most pillar, and names covered by nearer pillars. |
| `worldmap/WorldLandscape.tsx` | The mode bar with "Sprawdź, co wiesz", gaps and "Uzupełnij luki", portals, the goal line, the playback memory, the points counter (with rewards), the conquest note, "Pokaż zmiany", exploration-badge measures and the list of places. |
| `worldmap/WorldPillars.tsx` | The playback animation, grey places in a mode, the outline of the places a mode means, the portal sign, the goal flag, picking through the grid and covered names. |
| `worldmap/WorldPanels.tsx` | "Ustaw jako cel" / "Zrezygnuj z tego celu" and the place's links into other worlds (`WorldsSection`). |
| `LandscapeView.tsx` | Passes `rewards` on to the world view. |
| Checks | `app-wm-views-check` (27, new, part of `npm run app:check`); click path 6 (13). |

What a learner sees in the world view now:
- **Modes** (kept per view and learner, as in the hex view):
  - Ogólny
  - Co umiem: conquered places
  - Do odkrycia: not conquered, with everything before it conquered
  - Do powtórki: due cards that may be reviewed
  - Luki

  Places a mode does not mean turn grey (opaque). The places it means stand in full colour with an outline.
- **Self-check:** "Sprawdź, co wiesz" asks every place's core question once. Afterwards Luki shows the gaps, with "Uzupełnij luki".
- **Portals:** a two-ring sign on a pillar that links into other worlds, and the links in its panel. A writer sees every link; a learner sees only what they can read there. Never a prerequisite.
- **Goal:** "Ustaw jako cel" works as in the hex view, with the same stored goal and the same steps. The goal shows as a flag in the goal colour and as a line above the map: "Cel: … — N tematów do celu", with "Pokaż" and "Usuń cel". When the goal is conquered, the map says "Cel osiągnięty".
- **Playback** of what changed since the map was last seen:
  - columns sink, or rise on a first visit;
  - new levels light up, and a ring runs over the ground around a conquered place;
  - neighbours follow in a wave;
  - with rewards, points rise over their places into the counter;
  - a note names newly conquered places, and "Pokaż zmiany" plays it again;
  - a click or key skips the rest. "Animacje: ograniczone" gives only a short glow; "wyłączone" shows the change at once.
- **List of places:** "Wszystkie miejsca (N)" for the keyboard. In a mode it lists only the places the mode means; a row opens the place as a click would.

---

## 2. Acceptance checks (spec §13)

| Part | Acceptance | Result |
|---|---|---|
| 1 · Model | Unit tests on all test worlds | **123/123** (`app-wm-model-check`): the Bosko-shape fixture with 0/1/3/5 levels, 1,000 and 5,000 generated places, and the broken world. |
| 2 · Runs | Tests for 0, 1, 3 and 5 levels; the level changes when the setting changes; waiting gaps | **47/47** (`app-wm-runs-check`, 8 of them for the probe in the second pass), for example: <br>• "3 levels: L1 by r1, L2 by r3 (r2 too early), L3 by r5 (r4 too early)" <br>• "setting changed: stricter rules → a lower level, recomputed" <br>• "setting changed back: the old level returns (nothing lost)" <br>• "waiting gap: after L1 the next counts from one day later" <br>• "probe: no answer yet — an account learner gets 0 levels (serverOld), so no review leaves" <br>Review guard **18/18**; learn sync **41/41**. |
| 3 · Geometry | Track test green; 1,000 places < 3 s; 5,000 places < 20 s; adding 10 places moves no existing place | **41/41** (`app-wm-geometry-check`). Clearance: 0 violations and 0 straight fallbacks on every world. Timings are below. |
| 4 · Presentation | Screenshots desktop and phone, light and dark; smooth rotation with 1,000 places; no transparency | **26/26** (`app-wm-presentation-check`); screenshots in §3, retaken after the second pass. Rotating 1,000 places over 180 steps (headless Edge, slider): draw time avg 3.3 ms, p95 3.7 ms, max 4.8 ms per frame (before the second pass: 3.3 / 3.6 / 3.9). No `globalAlpha` < 1 and no rgba/hsla/transparent/opacity in the renderer; distant places, and the grey of a mode, are mixed with the background. |
| 5 · Interaction | The four click paths | **38/38** (`scripts/wm-click-paths.mjs`, results in `step2/click-paths.json`): the four paths, the extra run path, path 6 of the second pass, and no page exceptions. Plus **34/34** (`app-wm-interaction-check`) and **27/27** (`app-wm-views-check`). The paths are listed below. |
| 6 · Guide | Guide retrievable via MCP | `AiMcpTools.ListImportFormats()` lists `guide-world-map` and `GetImportFormat("guide-world-map")` returns it: **648/648** backend checks. `app-wm-guide-check` **16/16**. `import-formats.mjs --check` OK. |

**Part 3 timings** (`app-wm-geometry-check`, this machine):

| World | Layout + tracks | Layout | Tracks | Nodes / tracks |
|---|---|---|---|---|
| Bosko-shape fixture | 88 ms | 43 ms | 43 ms | 49 / 59 |
| 1,000 places, 40 stories | **1.63 s** (< 3 s) | 0.77 s | 0.86 s | 1,001 / 252 |
| 5,000 places | **15.7 s** (< 20 s) | 4.8 s | 10.9 s | 5,001 / 907 |
| Insert 10 places (stable) | 1.3 s | | | none of the existing places moved |
| Real Bosko (124 places) | 244 ms | 144 ms | 98 ms | 235 tracks |

In the preview, a map goes from course JSON to its first frame in about 2.6 s for Bosko, 4 s for 1,000 places and 1.8 s for the fixture. This includes the import, the cards, the layout and the drawing.

**Part 5 click paths.** These run in the preview: the real app components, an in-memory base, a new learner, nothing saved, and real mouse events over CDP.

1. **Home → section with lock → sources → learn directly → lock gone.**
   - The Home panel lists the lines that start there.
   - The locked lane "Z chłopcami z warsztatów: Dom i kościół → Cagliero, Rua…" opens its section panel. It shows the ticket (know „Comollo"), 10 cards from "Z Mamą Małgorzatą" (open now) and 3 with no slide. Travel is disabled.
   - "Ucz się bezpośrednio (13)" asks the 13 cards. Back on the map the ticket is valid, the lane is open and travel is enabled.
2. **Station with 3 branches → choose one.**
   - The panel of „Dom i kościół" lists the 3 branches of the story that splits there: two open, and „Do studentów" locked by its option condition.
   - "Wybierz" on „Z Dominikiem Savio" opens the player directly on that branch's first slide (`sh11`), not locked.
3. **Navigate to a place with 3 missing prerequisites, choosing a branch option on the way.**
   - From the conquest order of „Michał Magone", the other 9 places of its base are learned directly (115 cards). Three missing prerequisites remain: Dom i kościół, Dominik Savio, Pół tuzina warsztatów.
   - "Prowadź mnie tutaj" shows a 14-step timetable. At the stop on the way, the branch option (another branch of the same story into Magone) is chosen.
   - The route is recomputed from that stop: the earlier stops are unchanged and nothing is marked done. The map shows the route, the pennant and the flag. The navigation survives opening a story and coming back.
4. **Pillar width changes continuously without recomputation.**
   - 30 slider positions from 98 % to 40 % are each drawn immediately; the drawn radius shrinks strictly.
   - The geometry version and the number of layouts stay the same. Draw time: median 2.9 ms, max 3.3 ms.
5. **Extra: a run.**
   - "Moje ustawienia" → 1 level, then the run is locked until the cards appear.
   - Learn directly → "Rozpocznij przebieg na poziom 1" → 13 cards → level 1 reached → the place is conquered.
6. **Extra (second pass): what the world view keeps from the hex view.**
   - **First visit and modes.** The first visit plays the columns rising. For a new learner, "Co umiem" lights nothing, "Do odkrycia" lights the places without prerequisites, and "Do powtórki" lights nothing, with its note. "Ogólny" colours everything again.
   - **Self-check.** "Sprawdź, co wiesz" with the first core question wrong: back on the map, mode Luki shows exactly that one place, with "Uzupełnij luki". Coming back plays the change (`return`), and "Pokaż zmiany" plays it again.
   - **Goal.** "Ustaw jako cel" on Magone shows the goal line with its steps, the flag and "Zrezygnuj z tego celu"; "Usuń cel" removes line and flag.
   - **List of places.** It lists all 50 places, and a row opens its panel.
   - **Portals.** The one link into another world in the fixture is not shown to a learner, because they cannot read that world. A writer sees it on the pillar and in the panel.
   - **Motion off.** With "Animacje: wyłączone", the change is shown at once.

**Other suites** (after the second pass, on the branch merged with `main` `122be75c`).
- `tsc` is clean, and `app:i18n` holds (ratchet 1, unchanged).
- `app-json-check` (23) and `app-json-parts-check` (13) pass. `app-json-check` failed on the original base, because `ImportFormats.json` was stale.
- `app-landscape-check` 70 and `app-levels-check` 22 test only live code now (second pass, 1).
- `app-import-check` 69, `app-worldmap-check` 109, `app-regions-check` 112, `app-library-check` 25, `app-preview-check` 7 and `app-learn-sync-check` 41 pass.
- `app-selfcheck-check` passes (92). In the first report it timed out; this time it finished.
- Failures that are not this work's, unchanged:
  - `app-style-check`: `wk-hint` 554 > 548, identical on `main` `122be75c`. The inline-style count is at its limit (90); the world-map files add neither.
  - `app-cogita-check`: the four JSON examples of the book guide (482 checks pass before it, then the check stops on the missing example).

---

## 3. Screenshots (parts 4 and 5)

All screenshots come from the preview (headless Edge), with progress "partial" for parts 4 and none for part 5. Light and dark follow `prefers-color-scheme`. All were retaken after the second pass, so they show the current UI with the mode bar above the map and the list of places below it.

| | Desktop 1440 × 1000 | Phone 390 × 844 @2x |
|---|---|---|
| Bosko, light | ![](step2/bosko-desktop-light.webp) | ![](step2/bosko-phone-light.webp) |
| Bosko, dark | ![](step2/bosko-desktop-dark.webp) | ![](step2/bosko-phone-dark.webp) |
| 1,000 places, light | ![](step2/gen1000-desktop-light.webp) | ![](step2/gen1000-phone-light.webp) |
| 1,000 places, dark | ![](step2/gen1000-desktop-dark.webp) | ![](step2/gen1000-phone-dark.webp) |

Close up, where names appear: ![](step2/bosko-desktop-light-zoom.webp) ![](step2/gen1000-desktop-light-zoom.webp)

The fixture world, with its block and its 3-branch station: ![](step2/fixture-desktop-light.webp)

Part 5, in order:
1. Locked section with sources: ![](step2/p1-section-locked.webp)
2. The lock is gone: ![](step2/p1-lock-gone.webp)
3. The station with 3 branches: ![](step2/p2-station.webp)
4. The chosen branch opens in the player: ![](step2/p2-branch-open.webp)
5. Branch options in the timetable: ![](step2/p3-turns.webp)
6. After choosing an option: ![](step2/p3-turned.webp)
7. Pillar width 40 %: ![](step2/p4-pillar-40.webp)
8. Run result: ![](step2/p5-run-result.webp)
9. Conquered place: ![](step2/p5-conquered.webp)

Second pass (path 6):

10. "Do odkrycia" for a new learner (the one place to start, in colour, outlined): ![](step2/p6-mode-discover.webp)
11. Luki after "Sprawdź, co wiesz", with "Uzupełnij luki": ![](step2/p6-gaps.webp)
12. The goal — line, flag, "Pokaż zmiany" after the return: ![](step2/p6-goal.webp)
13. The list of places: ![](step2/p6-list.webp)
14. A portal on Comollo (seen by a writer): ![](step2/p6-portal.webp)

---

## 4. Deviations from the spec or the decisions

1. **The old worker also imported i18n through `landscape.ts`.** My Step 1 report only named `landscapeWords`. Correction 6 is done fully: `landscape.ts` returns keys and `landscapeClient` translates them. A check fails if either worker imports `.tsx` or i18n.
2. **Branch options exclude complements.** In the fixture, lines bring *different* cards of a place: only 21 of 453 cards are introduced by more than one section. A section that the plan travels anyway for the same place would only change the order, so it is not offered as "Tu możesz też skręcić". What remains are real alternatives, such as the other branches into Magone and the detour entries from different callers. One Part 1 test was rewritten for this.
3. **The map's ticket replaces the player's lock.** A section opened from the map starts the player with `gate={false}`. "Travel" is disabled while the ticket is missing, and tickets come only from the three sources of correction 4. Without this, boarding a line at an interchange station would hit the story's own unit lock, which duplicates ticket (a).
4. **Choosing inside an embedded subflow.** When the fork is inside an embedded subflow, the player opens at the line's subflow step and asks there. `jumpTo.exit` is used only for forks at the line's own level. Neither Bosko nor the fixture has such a case.
5. **Where the fork mark stands.** It is drawn where the timetable step with alternatives begins. That is not necessarily the place where the branches diverge.
6. **"Done" in the timetable.** A step counts as done when it disappears from the plan because the learner learned. A plan recomputed after a choice marks nothing done. The window is a scrolling list of all steps; 2 done steps stay visible above the current one.
7. **Mislabelled regions (decision 7).** These are flagged for the colour areas the world map computes itself: an area named after a topic that is not its centre.
   - Bosko's world view colours by nest `obszar`, so there are none. Without nest, the map computes 12 areas and none is mislabelled.
   - The Step 1 finding was in the hex view "Opowieści — krajobraz", where units are the tiles. The world map replaces that view, and the hex view was not changed.
8. **`flowStartsLate` does not fire for Bosko's e2-1 and e6-3.** They start at `sn1`, which is also their first node. The check flags a flow whose start step is not its first slide, and these two are not such flows (as reported in Step 1).
9. **No `sections` set (correction 2).** The longest Bosko flow has 140 nodes, well under the 400-entry `visited` cap, so `FlowPosition` is unchanged.
10. **The side panel follows the container width (50 rem), not the window.** Narrow hosts (page modules, the preview) get the panel below the map, as on phones.
11. **PR B also needs an API deploy.**
    - Part 2 adds `levelsSetup` to the settings MCP keeps.
    - Part 6 regenerates `ImportFormats.json` (the guide; this also refreshed texts that were stale on `main`) and extends the `get_knowledge_setup` description.
12. **The click paths run in the preview, not on a LocalDB account.** The flows are the same, with nothing written to any database. The server side of runs is covered by PR A's checks and by the learn-sync check (409 before 0140).
13. **Topic colours cycle through eight like the hex landscape.**
    - Part 4 showed areas beyond the eighth in grey, which left much of Bosko grey. Spec §4.2 asks for the topic colour "as in Recreatio today", so this was fixed in a small commit after part 6.
    - Grey now marks only a place without any area.
    - The line palette is unchanged: one hue per big line.
14. **Test aid in the preview.** `recreatioPreview.knowledge({ author: true })` renders as a writer, so the author list and the `worldmap` write path can be seen. Nothing leaves the browser.
15. **Resolved in the second pass: a keyboard list of places.** The first report had places only on the canvas. "Wszystkie miejsca (N)" below the map now lists them; in a mode it lists only the places the mode means, and a row opens the place as a click would.
16. **Dead code: only what the listed code left without callers.** A reference scan before and after the cut decided what went. Code that had no callers already before this pass, and was not on the Step 1 list, stays, as decision 2 says "only". These are candidates for when the hex map is retired:
    - `landscape.ts`: `hexAt`, `polygonsOverlap`, `LS_FORE`/`LS_TILE`/`LS_SHRINK`/`LS_BAND_MARK`
    - `levelMap.ts`: `levelItems`, `sketchOf`, `outlineOf`, `gateAnglesFor`, `routeOrder`, `routeMetrics`, `rotated`, `viewScale`, `stepRange`, `groundOf`. Several of them take the shape `layoutLevel` produced.
    - `landscapeNest.ts`: `nestSubtree`
    - the test hook `setLandscapeWorker`
17. **The probe does more than hide.** Until the server stores runs, a learner with an account has 0 levels, not just hidden run buttons. With hidden buttons alone, the cards of unconquered places would leave reviews while nobody could conquer them. For the same reason, the admin cannot save levels before the server is updated.
18. **Playback, adapted to the world map.**
    - The camera stays where the learner left it. The hex view flies to the changes; here "Pokaż zmiany" replays them where the learner is looking.
    - Points rise over their places and then join the counter. The hex view flies them to the counter.
    - The conquest note names places ("Zdobyte: …"). The hex view names regions.
    - The exploration badges count colour areas whose places are all conquered, and the share of conquered places.
    - The last-shown state is kept under the key `world:<view>`, separate from a hex view.
19. **Self-check covers the whole map.** The hex view checks the region in view, and the world map has no zoom regions. **The goal is a flag only**, with no pawn, as the owner decided for the hex map on 2026-11-06 ("only aims stay").
20. **How the modes look.** The places a mode means stand in full colour with a dark outline; the hex view outlines them in its land and ready colours. With levels, "Do powtórki" counts only conquered places, because only they are reviewed.

---

## 5. Bosko today

These numbers come from the read-only copy (MCP snapshot of 5 November), seen through the Bosko-shaped course: places = *Temat nauki*, colours from nest `obszar`.

- **Places:** 124, with 1,163 cards and no prerequisite cycles.
- **Blocks:** none. Bosko has no field with `"part"` yet, and adding one is a content change outside this pass.
- **Lines:** 63.
  - 20 main lines: 8 stages, 11 threads and the introduction „Krąg czytelników. Kim jest ksiądz Bosko?". The introduction is the only line that starts at home.
  - The other 19 start mid-world, at the place their unit requires.
  - 43 deepenings, drawn as loops from their callers. Six are called from three hubs: Choroba i powrót z matką, Narodziny oratorium (8 grudnia 1841), Ksiądz Bosko i arcybiskup Gastaldi, Zdobycie Rzymu i choroba w Varazze, Konwikt i ksiądz Cafasso, Dominik Savio i pożegnanie matki.
- **Sections:** 235, all drawn.
- **Interchange stations:** 20 hubs. The busiest are:
  - Dzieciństwo i szkoły: 12 lines
  - Dom, warsztaty i pierwsi salezjanie: 12 lines
  - Ksiądz Bosko w zarysie: 10 lines
  - Narodziny oratorium, Sanktuarium, kolegia i siostry, and Dzieło wychodzi w świat: 7 lines each
- **No content forks.** As Step 1 found, there is no branch station. The 3-branch station lives in the fixture.
- **Geometry:** model 96 ms, layout 144 ms, tracks 98 ms; 0 straight fallbacks, 0 clearance violations.
- **On screen:** see §3 — 10 colour areas, low pillars (shallow prerequisite chains), stations as rings around the hubs, and dense deepening loops around the stage hubs.

**The author list Bosko shows to writers** has 164 notes, all at level "info", in four groups. The examples below are the first ones in the list.

- **Members not reached by any detour (10).** These are thread `nalezy` members that the thread's story never detours to. Examples:
  - Wątek: system prewencyjny → Dominik Savio i pożegnanie matki, Mały kuglarz, Narodziny oratorium, Michał Magone
  - Wątek: sny i Maryja Wspomożycielka → 1854: „Będziemy się nazywać salezjanami", Iść daleko: pierwsza wyprawa, Markiza Barolo i Rifugio
  - Wątek: zdrowie księdza Bosko → Święcenia, Pożegnanie z ziemią
  - Wątek: droga do kapłaństwa → Święcenia, Seminarium w Chieri
- **A unit requires a neighbouring stage's prerequisite instead of the stage (13).** Examples:
  - Sen dziewięciolatka ↔ Wątek: sny i Maryja Wspomożycielka
  - Castelnuovo i Chieri ↔ Wątek: droga do kapłaństwa
  - Przyjaciele i wybór drogi ↔ Wątek: droga do kapłaństwa
  - 18 grudnia 1859: Towarzystwo Salezjańskie ↔ Wątek: Zgromadzenie i Rodzina Salezjańska
- **Cards without a slide (122 places).** 401 of Bosko's 1,163 cards (34 %) are introduced by no section — they are not asked in any story — so they are learned directly. Examples: Ksiądz Bosko w zarysie (7), Dom, warsztaty i pierwsi salezjanie (5), Dom w czasie burzy (3).
- **Lines that start mid-world (19).** All 19 are main lines that start at the place their unit requires, for example:
  - Etap 5 → Ksiądz Bosko w zarysie
  - Wątek: system prewencyjny → Dzieciństwo i szkoły
- **No warnings and no errors:** no cycles, dangling references, unknown conditions, stories without places or routing failures.

---

## 6. How to re-run

```bash
cd frontend
node scripts/app-wm-model-check.mjs && node scripts/app-wm-runs-check.mjs && node scripts/app-wm-review-guard-check.mjs
node scripts/app-wm-geometry-check.mjs && node scripts/app-wm-presentation-check.mjs
node scripts/app-wm-interaction-check.mjs && node scripts/app-wm-views-check.mjs && node scripts/app-wm-guide-check.mjs   # all are part of npm run app:check
# click paths and screenshots against a preview build:
npx vite build --outDir <dist> && npx vite preview --outDir <dist> --port 4791
node scripts/wm-courses.mjs <dir> [read-only-copy.json]
node scripts/wm-click-paths.mjs http://localhost:4791 <dir>/fixture.json <out> [1,2,3,4,5,6]
```

Not in this pass (decisions §4): Bosko content changes, removing the hex map or `LearningPath`, and future condition types beyond the registry slot and the async `prepare` hook.
