# Cogita World Map: Step 2 decisions

**Answers:** `STEP1_REPORT.md` (9 November 2026, main `549261f5`)
**Applies to:** `COGITA_WORLD_MAP_SPEC.md` version 3
**Rule:** Where this file and the spec disagree, this file wins. Where this file is silent, the spec and your report apply, including every recommendation in your report not overruled here.

The report is accepted. Its architecture (§4), condition design (§5), settings and review predicate (§5a), path-view handling (§5b) and line rules R1–R4 (§6) are the basis for Step 2.

---

## 1. Answers to the open questions

| # | Question | Decision |
|---|---|---|
| 1 | Places | **As recommended.** Places = the kinds that questions are `about` (derived), minus unit, slide and question kinds. Story units are lines only. "Opowieści — krajobraz" is superseded once the world map is accepted. |
| 2 | New view or replacement | **As recommended.** New style `landscape.style: "world"` inside the `LandscapeView` shell. Hex stays the default until the owner accepts the world map. Do not delete hex code in this pass; remove only the dead code you listed. |
| 3 | Block with parts | **Not the nest heuristic.** A block exists only where the database says so explicitly. Use a schema flag on a reference field, `"part": "up"` (the entry names the block it belongs to), read like `"prerequisite": "up"`. A field must not carry both `part` and `prerequisite`. Without such a field there are no blocks; Bosko will have none until authors add it. The fixture world uses the flag. Nest and regions remain colour areas only. Document the flag in `weltkarte-AI.md` and in the schema guide where `prerequisite` is documented. |
| 4 | Stops | **R2 as recommended.** Borrowed teaser questions introduce cards for their place on that section but create no stop. Review blocks create no stops and no introductions. |
| 5 | Line colours | **As recommended, with one constraint:** pillars keep the topic colour (spec §4.2). Line colours come from a separate palette that is darker and more saturated than the pillar palette, so a line stays readable on top of any pillar colour and on the ground in light and dark themes. Each big line has its own hue. Deepening lines take a lighter shade of the line that calls them most often and are hidden at far zoom. |
| 6 | Question needs | **As recommended.** Ignored for geometry and height; used only for card order within a place and in ticket sources. |
| 7 | "One correction" | **As recommended.** A wrong card is asked once more at the end of the run; counting as described in your report. |
| 8 | Existing bases | **As recommended.** Levels default to 0 for every existing base. The admin opts in. The settings page shows how many cards would leave reviews before saving. |
| 9 | Who sees runs | **As recommended.** Private to the holder, no area key. |
| 10 | Unknown condition types | **As recommended.** Fail closed for tickets and run unlocks only. Flows unchanged. Listed in the author list. |
| 11 | Who stores positions | **As recommended.** Writers' browsers write the `worldmap` document automatically after a change, plus a manual "Re-lay the whole map". Learners never write. |
| 12 | Ścieżka | **As recommended.** Stays inside a story. `LearningPath` is folded into the timetable only after acceptance; not in this pass. |
| 13 | MCP export | **As recommended.** Keep `[q, r]` for hex views. Add `[x, y]` for world views in this pass, so that authors and AI can inspect the map read-only. |
| 14 | "Prowadź mnie tutaj" | **As recommended.** It becomes the session-only navigation. "Ustaw jako cel" stays unchanged. |
| 15 | PR #5 one-hexagon model | **As recommended.** Keep its completion logic. Its `choice → subflow` segments become branches of the line. |
| 16 | Where files live | **As recommended.** Move spec, prototype, report and this file to `documentation/world-map/` in your first commit. |

---

## 2. Corrections and additions to the spec

1. **Card-level bands only.** The world map never uses topic knowness averages (one right answer can make a topic "known"). Everything — tickets, height, colour saturation, "all cards appeared", the 0-level fulfilment — is computed from per-card bands via `inBand` (`logic.ts`). This also settles the two meanings of "due": use `inBand` everywhere in the world map and in the review predicate.
2. **Travelled sections.** Derive them from `visited` and `done`. If a test shows that the 400-entry cap loses sections of real Bosko flows, add a compact, monotone `sections` set to `FlowPosition` (merged like `visited`). This is the only permitted change to flow progress.
3. **Detour stations.** In Bosko, stations come from detours. A detour line starts and ends at the calling place. If several flows call the same deepening (six do), each calling place is a station for it; the line is drawn once, and its sections connect to every caller.
4. **Section tickets** come only from the three sources in your report §5: (a) unit `Wymaga`, (b) the condition of the choice option a branch starts from, (c) `condition` steps where one exit leaves the line. Requiring a unit means "that story passed"; its cost is the cards of that unit's topics.
5. **Review predicate.** Implement `reviewable(card, worldState)` once in `worldmap/` and call it at every site you listed. Add a check script that fails if a new review or due-count site is added without it (e.g. a grep for the known entry points). `reportDue` uses it, so the server notification matches.
6. **Worker.** Fix the dev-mode crash by removing the `landscapeWords` import from the existing worker. The new geometry worker imports no `.tsx` and no i18n.
7. **Author list additions** from your findings: thread `nalezy` members that are not detour targets; a unit that requires a sibling stage's prerequisite instead of the stage; flows that start at a step other than their first slide; mislabelled regions.

---

## 3. How to deliver Step 2

The work is large (your estimate: 22–27 days). Deliver it on **one branch** in **two pull requests**, because the database migration must be deployed before the frontend:

**PR A — server (small, merge and deploy first)**
- Migration `0140` for learn batch kind `run`; `Kinds` updated, not `Latest`.
- Server probe for the kind, used by the client to hide run features until the server supports them.

**PR B — everything else**, in the order of spec §13, one commit per part:
1. Model
2. Runs (client side, settings, review predicate, offline)
3. Geometry
4. Presentation
5. Interaction
6. Guide `templates/cogita/weltkarte-AI.md` (Polish), link from `opowiesci-AI.md`, `ImportFormats.json`, MCP listing; document the `"part": "up"` flag

After each part: run its tests and acceptance checks from §13. If a check fails and you cannot fix it within the part, stop and report instead of moving on.

At the end, add `documentation/world-map/STEP2_REPORT.md` with:
- what was built, per part, with files
- the result of every acceptance check (with timings and screenshots for parts 3 and 4: Bosko and the 1,000-place world, desktop and phone, light and dark)
- every deviation from the spec or this file, with the reason
- what the Bosko map looks like now, and the author-list entries it shows

---

## 4. Not in this pass

- Bosko content changes (including adding `part` fields or stage prerequisites)
- Removing the hex map or `LearningPath`
- Future condition types beyond the registry slot and the async `prepare` hook
