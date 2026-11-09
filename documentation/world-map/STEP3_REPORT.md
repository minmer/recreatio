# Cogita World Map — Step 3 report

**Branch:** `cogita/world-map`, from `7ef54ad0` to `ace55890`.
**Rule followed:** one commit per numbered item. For every bug, a check was first added to the matching `app-wm-*` script and seen failing on the old code, then the fix made it pass.

## Summary

- Every item in §1 and §2 is done. Two items were changed by later decisions of the owner (see "Owner's decisions"):
  - §1.7 (waiting steps): its mechanism is now gone, because levels no longer have minimum gaps.
  - §1.10 ("now" wakes at the next waiting date): there are no waiting dates any more. "Now" is refreshed when the tab becomes visible and every 10 minutes instead.
- §3: in the app at 1440 and 1920 px the world view is wider than 50 rem, so the panel already stands beside the map. On narrower screens the panel is now a sheet over the lower part of the map.
- The owner asked for further changes during this step (island terrain, calmer map, controls, run rules). They are in their own commits and listed below.
- Finish (§4):
  - all `app-wm-*` checks, `tsc`, `app:i18n` (ratchet stays at 1) and `wm-click-paths.mjs` (39/39) pass;
  - every screenshot in `step2/` was retaken.

## 1. Bugs (§1)

| # | Commit | New check (script → name) | Notes |
|---|---|---|---|
| 1 | `2e18d9ee` | runs → "Step 3 · 1 …" (5 checks: appeared, run gate, counts, height, all-suspended place) | `suspended` reaches `LearnerInput` and the condition context. A place whose every card is suspended counts as conquered and flat. |
| 2 | `0659ef01` | runs → "Step 3 · 2: review scope …" (in-memory base with a topic and an aspect kind) | The review scope is built from the place kinds of the base's world views. A base without a world view: levels do not affect reviews. |
| 3 | `9b8c2d8e` | runs → "due report …" (2); learn-sync → "7" (3) | `reportDue` after `keepRun` and after any level setting is saved. The offline copy stores the reviewable keys and uses them. |
| 4 | `bc953dc7` | model → "Step 3 · 4 …" (4) | A section is travelled when its last step, or each of its questions, was visited. "done" counts only for sections with visited steps. |
| 5 | `2aef496b` | model → "Step 3 · 5 …" (4) | A gate after content at a stop waits for the next section that leaves the stop. A gate before all content of a branch (or before a choice) still locks that branch's first section, also one that stays at the place. Two guard checks keep that. |
| 6 | `d72f7188` | model → "Step 3 · 6 …" (7) | Any unknown part makes the whole condition unknown (also `or`); `not` and `xor` over something unknown are never met. Tickets and run unlocks only; flows unchanged. |
| 7 | `d980abce` | interaction → "Step 3 · 7 …"; model → window checks | The current step became the first step that can be done now. **Later superseded** by the removal of gaps (`4a950ded`): nothing waits any more. The checks now state that the timetable has no waiting step and that the current step is the run that can be done now. |
| 8 | `c2d98d83` | geometry → "Step 3 · 8 …" (3) | `layoutPass` (in `wmStore.ts`): a full layout on request; once it is laid **and saved**, the request is reset. A failed save keeps it. |
| 9 | `6e4a1329` | runs → "Step 3 · 9 …" (2) | The review world is kept per array of cards (identity), with a hash of the card keys as fallback — never per count. |
| 10 | `5a3c2760` | views → "Step 3 · 10 …" (2) | Re-scoped (no waiting dates any more): "now" is a clock refreshed on `visibilitychange` and every 10 minutes, so cards that fall due show up while the map stays open. |
| 11 | `16d7a1e6` | presentation (source); manual check on the zoom screenshots | Names are measured with `measureText`; the collision box uses the measured width. Names longer than 200 px are shortened with "…". |
| 12 | `16d7a1e6` | same | A name that would cross the edge is moved inside the canvas; if its place is outside, it is not drawn. |

## 2. Smaller items (§2)

| # | Commit | Check | Notes |
|---|---|---|---|
| 1 | `83d3ff9f` | geometry → "Step 3 §2.1 · <world>: offset lanes keep the clearance too" (all 4 worlds; it failed on 1 000 and 5 000 places) | Each track is routed with half its bundle width added to the margin, in the grid search, the sight lines and the smoothing check. Timings: 1 000 places 1.6 s (budget 3 s); 5 000 places 15.4 s (budget 20 s). |
| 2 | `c9d311e8` | views → "Step 3 §2.2 …" (2) | `dueOf` on a conquered place lists every card that is not known (also one that decayed below 0.1). The place panel uses `dueOf`. |
| 3 | `4a950ded` | runs → "session …", "session (§2.3) …" | A wrong card comes back until it is right (at most 4 asks). Answers right on the third or a later ask are recorded as `laterRight`, so "any" differs from "one". |
| 4 | `0590e754` | review guard → "Step 3 §2.4 …" | `LandscapeView` passes only `reviewable` cards to the weak marks. |
| 5 | `930136db` | review guard → "Step 3 §2.5 …" (self-test plus each required file) | Every call of an entry point needs the rule, or its scope, within 12 lines. Sites filtered upstream are exempt per site, and each exemption checks that the upstream filter still exists: `eligible`/`spacerFor` skip `s.fixed.blocked`; `dueCards` is built with `mayReview`. |
| 6 | `16d7a1e6` | — (text) | The bubble says "Na trasie: N odcinków · N nowych kart do biletów · N do powtórki", plus "Dwuklik: prowadź mnie tutaj". |
| 7 | `16d7a1e6` | presentation → "camera: zoom-in stops …", "camera: zooming in near a place …" | Zoom-in stops when a pillar is a third of the view. Zooming in near a place (240 px) zooms towards it. |
| 8 | `16d7a1e6` | presentation → "camera 1200×640 / 390×640 …", "camera: on a phone …" | "Whole world" fits the turned and tilted shape of the world, not a circle (89–90 % of the frame used). On a screen under 640 px the map height follows the shape of the world. |
| 9 | `d37ddd5d` | — | Behaviour kept. Recorded in the guide (`weltkarte-AI.md`) and below as a deviation. |

## 3. The panel in the real app (§3)

I could not sign in to the real app in this session (the test database is not set up here, and production is off limits), so the width comes from the layout rules:
- The content column is `min(100%, --wk-content + 4rem)` with `--wk-content: 90rem`, beside a 15 rem sidebar.
- At 1440 px the world view is about 1 150 px wide (more than 50 rem = 800 px), so the panel already stands beside the map. The same holds at 1920 px.
- Full-width Cogita screens (`.wk-full-body > .wk-card.is-whole:has(.cg-ls)`) already drop the 90 rem limit.

No full-width change was needed. Below 50 rem of container width (about 1 100 px of window with the sidebar, and every phone), the panel is now a **sheet over the lower part of the map**: it sticks to the bottom of the window, is at most half its height and scrolls inside, and the map stays visible above it. The preview shows this (`step2/p3-nav.webp`). Worth a look in the signed-in app at 1100–1300 px.

## 4. Owner's decisions during this step

| Commit | What |
|---|---|
| `4a950ded` | **No minimum gap between levels.** One run raises **every** level whose rule it meets. Everything right the first time gives all levels at once and the award **"Mistrzowsko"** (★, the highest award, always reachable; shown on the run result, in the place panel and as a star on the pillar). Cards of the **same thing** (same facts, otherwise same entry and template — for example several cards drawn from one entry) are not asked again in a run once one of them is right the first time; a wrong answer covers nothing. The plan has one run step per place ("all right first time: straight to level N"). The `gapDays` setting is gone (old values are ignored), also from the guide and the import formats. |
| `16d7a1e6`, `ace55890` | **An island:** water around, a sandy shore outside the land, land following the shape of the world, and trees that never stand on a pillar, its ring or a track (checked). **A calmer map:** only lanes that grow knowledge are prominent (open and bringing cards not yet known). Travelled lanes are thin in their line colour, idle lanes thin and grey, locked lanes dotted; locks only show when zoomed in. **Controls:** Ctrl (or the right button) + drag turns and tilts; dragging down tilts down; double-click or double-tap a pillar = "Prowadź mnie tutaj". |
| `e189f45e` | **A clear place panel:** one next step (review, start the run, or "Prowadź mnie tutaj" with "Ucz się bezpośrednio" beside it); everything else is folded under "Więcej o tym miejscu". A click that skips the playback is judged on the frame that was shown. The click paths wait until a located point stops moving: a scrollbar appearing after the return playback moved the canvas by 12 px. |

## 5. Deviations

- **Height with 0 levels** (§2.9): it counts the cards not yet known (of the place and its base), not all cards of unfulfilled places. The pillar shrinks with every card learned. Kept on purpose; recorded in `templates/cogita/weltkarte-AI.md`.
- **Waiting steps** (§1.7) and **waking at the next waiting date** (§1.10) no longer exist, because the owner removed the gaps (see §4).
- **A gate inside a branch** (§1.5): a gate before every piece of a branch's content locks that branch's first section, even one at the place itself (not only "the next section that leaves the stop"). Otherwise such a gate would be lost.

## 6. Screenshots

All pictures in `step2/` were retaken from a fresh preview build. New: `bosko-desktop-dark-zoom.webp`, `p3-nav.webp` (narrow sheet with the timetable), `p5-run-ready.webp`. `rotation-1000.json`: 180 steps of rotation in the 1 000-place world, drawing 3.4 ms on average (p95 3.9 ms).

## 7. Deploy

- No migration.
- `backend/Api/Library/ImportFormats.json` changed (texts only: no `gapDays`, the height note). The API needs a deploy for the MCP texts, before the frontend.
