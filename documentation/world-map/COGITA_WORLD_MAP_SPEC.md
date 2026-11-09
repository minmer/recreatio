# Cogita World Map: a line network through free-standing knowledge places

**For:** Claude Code in the repository `minmer/recreatio`
**Date:** 9 November 2026 · **Version:** 3
**Status:** Target design confirmed by the owner. Implementation in two steps (§0).
**Reference:** `prototype-world-map-v7.html` (next to this file). The prototype shows behaviour and look; its UI text is German. Its code is **not** a model for the architecture. Where the prototype and this file disagree, this file wins.

---

## 0. Two-step process

**Step 1: analysis and proposal (no code changes).**
Read this file completely. Study the current code and data model. Reply with the report described in §14. Then stop.

**Step 2: implementation in one pass.**
You will receive an answer to your report containing all decisions. You then implement everything in the order of §13, with tests, on one branch with one pull request.

Ground rules for both steps:
1. **Assume nothing you have not seen in the code.** Wherever this file says "check", report what you found, with file and field name.
2. **No changes to production data.** New storage only where §7 requires it, and only as you proposed it in Step 1 and as it was confirmed.
3. **Pure logic separate from rendering.** Graph, layout, tracks, conditions, height and navigation are pure functions without DOM, with unit tests. The renderer receives finished data only.
4. **Build for extension** (§10). Hard-wire nothing that would force a rebuild when new condition types arrive.

---

## 1. Goal

The world map shows a Cogita knowledge base as a **rotatable 3D landscape**:

- **Knowledge places** are round pillars that stand free and never touch. Exception: parts of a block that the database itself divides.
- The **position** of every pillar is computed only from the dependencies. Imports contain no positions.
- The **height** of a pillar shows how much is still missing to reach it.
- **Stories** are coloured, directed lines on shared tracks, with **interchange stations** where you choose between several stories.
- Every line section needs a **ticket**: fulfilled conditions, today knowledge only, later other kinds too (§10).
- Every place can also be **conquered directly**, without travelling a story.

The map must work for Bosko (about 200 places) and for worlds with thousands of places and many cross-references.

---

## 2. Terms

| Term | Meaning |
|---|---|
| **Place** | A question block (topic, typically 10–15 cards). One round pillar. |
| **Block with parts** | A place the database divides into parts. A large flat disc with the parts standing on it as smaller pillars that touch each other. |
| **Card** | A question with its own knowledge history (existing Recreatio model, unchanged). |
| **Line** | A story (flow) or one branch of a story. Own colour, directed. |
| **Stop** | A place where a line stops because it introduces or asks cards of that place there. |
| **Section** | Part of a line between two consecutive stops. Has slides, introduces cards, has a ticket. |
| **Track** | Geometric path between two places. Several lines share it. |
| **Interchange station** | A place where several lines stop, or where a story splits into branches. You choose there how to continue. The number of directions is unlimited. |
| **Ticket** | The conditions of a section with their status for the learner. |
| **Run** | One test round over all cards of a place. Cogita has no such concept today; the world map stores it (§7). |
| **Level** | Reached by passing runs. The number of levels is configurable, 0 to 5 (§7.1). |
| **Conquered** | A place whose last level is reached. With 0 levels: a place whose cards are known. |
| **Timetable** | The list of steps of a navigation, shown as a window around the current step, with branch options (§8). |
| **Home** | Starting point, flat on the ground. Lines with no prerequisites start there. |

---

## 3. Mapping to Recreatio: check in Step 1

The basis is the guide `templates/cogita/opowiesci-AI.md` (available via MCP as `guide-stories`). For every row report **present / present differently / missing**, with file, field name and an example from a real knowledge base.

| Element | Assumed source | Check |
|---|---|---|
| Place | Topic entries whose cards are counted via `about` of questions | Which `kinds` are places and which are not (e.g. units)? |
| Prerequisite between places | Field with `"prerequisite": "up"` ("Wymaga") | On topics and on units? |
| Block with parts | Unknown. Candidates: a field with `"structure": "up"`, `areas`, or regions of the landscape | Propose one; if ambiguous, list it as a question |
| Line | Flow (`flows`) with `unit`, either as a graph or as a presentation (`look: "scenes"`) | How do you read the sequence of topics from both variants? |
| Stops | Topics in order of first appearance: `question` via `about`, `show` via `of`, scenes via `about` | Test against three real flows |
| Branch | `choice`, `chapters`, scene with several buttons, `detour` | How many branches, where do they rejoin? |
| Introduced cards | Questions asked on the section | — |
| Ticket | First section: `Wymaga` of the unit. Later sections: `condition` steps (`knowness`, `value`, `flow`, `and`/`or`/`not`) on the section | Are there other sources? |
| Card state | Bands `learned` / `known` / `due` / `unknown` | Record thresholds and functions in `knowness.ts` |
| Travelled section | Flow progress | Stored per step or only per flow? |
| Condition language | `condition` in flows, `logic.ts` | Can it serve as the shared language for tickets and conquest (§10)? |
| Links to other worlds | `@@handle:…` | Portal marker only, never a prerequisite |
| Existing map | `WorldMap.tsx`, `worldLayout.ts`, `LandscapeView.tsx`, `worldWay.ts`, `mountain.ts`, `flowFacts.ts` | What is replaced, adapted, kept? Which 3D technique is used? |
| Set goal | "Ustaw jako cel" | Stays untouched; navigation (§8) is separate |
| Private learner state | Where do answers, flow progress and goals live? | Runs are stored there too (§7) |
| Existing path view of a story | "Ścieżka" with parts and choice points (guide §8a), module `path` | These choice points become interchange stations on the map (§4.5). What remains of the view? |
| World settings | `settings` of the knowledge base | Where do world settings (admin) and personal settings (learner) live? Levels and pillar width go there (§7.1, §4.7) |
| Reviews | Selection of due cards (`reviewRound.ts`, revisions) | Where can cards of unconquered places be excluded from reviews (§7.1)? |

If information is missing, it is **derived**, or the case is **handled visibly** (§11). New import fields only after confirmation.

---

## 4. Presentation

### 4.1 Camera
- Real 3D view: rotate (slider, Shift+drag, two-finger rotate on touch), tilt (25°–88°), zoom, pan.
- While rotating and tilting, the world point at the centre of the view stays fixed.
- "Whole world" fits everything into view.

### 4.2 Places
- **Shape:** round pillar. Parts of a block: large flat disc just above the ground, with the parts as pillars on it that touch each other.
- **Colour = topic**, as in Recreatio today. Learning state changes only saturation, never hue:
  - never seen: strongly desaturated, about 65 % mixed with the ground colour
  - partly seen: medium, about 35 %
  - first level reached, or with 0 levels cards known: full colour
- **Height** = cards still missing to reach this place (§6.2). Conquered places are flat. The "Height" slider scales all heights from 0 to 100 %.
- **Levels:** the top rim of the pillar is divided into as many equal arcs as levels are configured (1–5). Each arc lights up once its level is reached. With 0 levels there are no arcs. Levels remain even when knowledge fades.
- **Knowledge state** (decays over time, from the existing card state): a small dot in the centre of the top face, green, yellow or orange. It appears only on conquered places, because only their cards are reviewed (§7.1). Orange means "review due".
- **Distant places** become **paler** (mixed with the background), **never transparent**. Nothing shows through a pillar.

### 4.3 Text
- Default: **no text on pillars.**
- On hover or tap, a small bubble appears: name, "N cards to go", "from home: k sections · x new · y to review". The route there lights up.
- When zooming in, names appear, low pillars first. Rule: visible when `radius_px > 24 + 0.32 · height_px`.
- Names never overlap. On collision, the lower place wins.

### 4.4 Lines and tracks
- A track is a curved path on the ground. Several lines on one track run **parallel**, 5 world units apart, always in the same order.
- States of a line on a section:
  - **travelled:** full colour, 3.4 px
  - **ticket valid:** colour, 2.4 px, slightly subdued
  - **ticket missing:** dashed, pale, with a lock symbol at the start of the section. The symbol depends on the type of the missing condition (§10.3).
- **Direction:** an arrowhead in the middle of every section. All connections are directed.
- **Slides** are not drawn as dots. Their number appears in the bubble and in the panel.
- **Gates:** small squares on the pillar rim where a track arrives.

### 4.5 Interchange stations
- The choice points shown today in a story's path view (guide §8a: "wybór drogi") become **interchange stations** on the map. The map takes over this role: you see where a story splits and you choose there.
- A place where several lines stop, or where a story splits into branches, is an **interchange station**: a ring around the pillar on the ground.
- The number of outgoing directions is **unlimited**. A story with three branches yields three line branches starting here.
- The station panel lists all outgoing lines with name, destination, slide count and ticket status. You choose there how to continue.
- Crossings in open terrain have **no** ring: lines do not meet there and you cannot change.

### 4.6 Home
Flat on the ground: a symbol on a round ground plate, no 3D body. Label "Start".

### 4.7 Pillar width
- **Continuous slider** "Pillar width" from 40 % to 100 % of the full radius.
- The world setting (admin) sets the default. Each learner can change it for themselves; the personal setting is stored.
- **Positions and tracks stay unchanged.** Only the drawn radii shrink. The space between pillars grows and tracks become easier to read. The learner then zooms in closer.
- Therefore tracks are always routed with the **full** radius as obstacle (§5.4). With narrower pillars, a straight piece extends the track from the full rim to the drawn rim.
- Moving the slider only redraws; nothing is recomputed.

### 4.8 Panel
Short, little text. Views: place, section, interchange station, navigation (§6–§8).

---

## 5. Geometry (once per world version)

Everything is deterministic: same data, same map. Computation runs in a **Web Worker** and is cached per world version. Propose the storage location in Step 1, e.g. next to the existing `worldLayout`.

### 5.1 Read and clean the graph
1. Read places, cards, prerequisites, blocks with parts and flows.
2. Find **cycles** in prerequisites with Tarjan. A component with more than one place is treated as **one group** for height and order, and reported in the author list.
3. **Dangling references** are ignored and reported.
4. Places without connections are kept and placed at the edge near places of the same topic colour.

### 5.2 Derive lines from flows
1. Walk the flow as a graph from start to end.
2. Assign each step its places: question → `about`; `show` → `of`; scene → `about`.
3. Stop sequence = places in order of first appearance. Consecutive identical places are merged.
4. **Branches** (`choice`, `chapters`, scene with several exits): each branch becomes its own **line branch**, in the story's colour, slightly shaded. It starts at the last place before the branch, which thereby becomes an interchange station. Branches that rejoin end at the meeting point, which also becomes an interchange station.
5. `detour` into another story: change to that story's line at the current place, return at the same place.
6. Record per section: slide count, introduced cards (questions on the section), conditions (§6.1, §10).
7. Lines whose unit has no prerequisites start at **Home**.

### 5.3 Compute positions
1. **Initial positions** from a hash of the place ID.
2. **Force layout:**
   - springs along every track (rest length 3.4 R, strength 0.05)
   - springs along every prerequisite without a track (5 R, 0.01)
   - repulsion between all places with a hard minimum distance `r_a + r_b + 2.1 R`
   - Barnes–Hut from 500 places upwards
3. **Stability:** positions are stored. New places are inserted near their connections while old ones stay fixed. A full re-layout happens only on explicit command by someone with write access.
4. **Blocks with parts:** the layout uses the outer disc. Inside, the parts are arranged by circle packing.

### 5.4 Tracks: none passes through a pillar
1. Every pair of places with at least one section gets **one** track.
2. Obstacles: every place as a circle with **full** radius + 11.
3. Grid with cell size 7. Cells inside obstacles are blocked. Cells closer than 22 to an obstacle cost more. Cells already used cost slightly less, so tracks bundle.
4. **A\*** with 8 neighbours, no diagonal through blocked corners, from gate A to gate B. Gates sit on the rim facing the other place. If a gate lies inside another obstacle, rotate it in steps of ±0.3 rad until free.
5. **Simplify** to corner points with clear line of sight (sampling step 3).
6. **Smooth** with Catmull–Rom.
7. **Verify:** every point of the curve lies outside every other obstacle (tolerance 3). Otherwise use the simplified corner polyline.
8. **Mandatory test:** no point of any track comes closer to another pillar than its full radius + 8. The test runs on all test worlds.
9. Parallel lines: offset perpendicular to the track.

---

## 6. Learner state (per person, recomputed on every change)

### 6.1 Cards and tickets
- `known(card)`: band `learned` or better.
- `due(card)`: band `due`.
- A section's ticket is the **evaluation of its conditions** (§10). Today there is one type: the knowledge condition.
- **Knowledge condition** on a section: required cards = cards of the places in `Wymaga` (first section), or in `condition`/`knowness` on the section, minus the cards this section introduces itself. Result: { review: required ∩ due, new: required ∖ known }.
- For every new card the ticket shows its **source**: the section that introduces it, whether that section is directly travellable or what it needs itself, otherwise "no slide, learn directly".
- If nothing is new and only reviews are due, the ticket says "review only".

### 6.2 Height
`height(place) = Σ cards of all places in {place} ∪ base(place) that are not yet conquered`, drawn as `6 + 3.6 · √height`, capped at 110. The base is the transitive closure of prerequisites.

### 6.3 Cheapest route from Home
Dijkstra over sections, directed. Changing at stations costs 0.
`cost = 1 + 4 · |new| + 1.5 · |review| + cost of other open conditions − 0.5 (if already travelled)`.
The summary is computed in order along the route: cards introduced by an earlier section no longer count as new later.

---

## 7. Conquest: runs

**Conquering is not the same as knowing.** Knowledge comes, as now, from every single answer. Conquering means you answered the cards of a place correctly **in one run**. Cogita has no concept of a run, so the world map stores it.

### 7.1 Rules
- A **run** asks every card of a place once, in random order. Every answer is stored as a normal card answer.
- **Number of levels: 0 to 5.**
  - The world setting (admin) defines the number and rules of the levels.
  - Each learner can choose a different setting for themselves. It is stored.
  - Configurable per level: threshold in percent, allowed attempts (any after explanation / one direct correction / first attempt only), minimum gap to the previous level in days.
  - Default with 3 levels: 75 % any attempts; 85 % one correction and 1 day; 95 % first attempt and 1 day.
- **With 1–5 levels:**
  - A run can start when every card of the place has appeared at least once (`learned` or better) and all direct prerequisites are conquered.
  - A place is **conquered** when its last level is reached.
  - **Only conquered places are reviewed.** Cards of an unconquered place do not enter regular reviews. Full conquest opens reviewing.
- **With 0 levels:**
  - There are no runs and no conquest.
  - A place counts as fulfilled once its cards are known by the existing card state (share configurable, default: all cards in band `known`).
  - Cards enter reviews as they do today.
- **Store raw runs, not levels.** The level is computed from the runs and the setting currently in force. If a learner or the admin changes the setting, the level is recomputed. Nothing is lost.
- **Sections remain untravelled** when someone conquers directly. Only what was actually travelled is stored.
- Reached levels do not drop through forgetting. The knowledge state (§4.2) can drop and then shows "due".

### 7.2 Storage (propose in Step 1)
New private records per person, in the same place as the rest of the private learner state, not visible via MCP:

```text
Run {
  place: entry ID
  participants: [person]          // always exactly one today (§10)
  started, finished: timestamp
  cards: count
  correct_first_attempt: count
  correct_after_correction: count
  attempts: count
}
PersonalWorldSettings { levels: 0..5, rules: [...], pillarWidth: 0.4..1.0 }
```

World settings (admin) belong to the knowledge base `settings`: `levels`, `rules`, `pillarWidth`. Propose the exact location in Step 1.

### 7.3 Place panel
- Name, card count, level reached of N, "N cards to go"
- Knowledge state with "Review" (conquered places only)
- **Conquer:**
  - run possible → button "Start run for level X", showing that level's threshold
  - level waiting for its minimum gap → "Level X from <date>"
  - otherwise the **conquest order**: topological order of the unconquered base, with card count per place and total
  - and for cards that have never appeared: their source (§6.1) and "Learn directly"
- Lines stopping here, and whether the place is an interchange station
- Link "My settings" (levels, pillar width)

---

## 8. Navigation: "Take me there"

### 8.1 Plan
- Button "Take me there" on every place and every section.
- Navigation is **not** stored as a goal. The existing "Ustaw jako cel" stays untouched. The chosen route persists within the session while navigation runs.
- **Plan contents:** for every unconquered place in the target's base, in topological order:
  1. Introduce its cards: travel the cheapest section that introduces them; otherwise "learn directly".
  2. Runs up to the last level; with 0 levels: learn the cards until they are known.

  Then the same for the target. Waiting times between levels appear in the plan ("Level II from tomorrow"). Meanwhile the plan continues with the next place that is not waiting.
- After **every** change to learner state, the plan is recomputed.

### 8.2 Timetable in the panel
The route can be very long. It is not shown in full.

- The timetable is a **vertical line** like a railway line diagram. Every step is a stop: travel section, learn directly, run, wait.
- Visible is a **window around the current step**: 2 completed above, the current one large, 4 upcoming below. The rest is reached by **scrolling up and down**.
- The target with progress is always at the top ("7 of 31 steps · 140 cards to go").
- **Branch options:** at every stop that is an interchange station, or where other lines lead to the same knowledge, a subtle hint "You can also turn here" appears. It expands to show the alternatives:
  - another line that introduces the same cards ("with Mama Małgorzata instead of with Rua")
  - a detour that also opens another place
  - each with slides, new cards and effect on the total.

  Choosing an alternative recomputes the route from that stop. The choice holds for this session.

### 8.3 On the map
- A **"Start here"** pennant at the current step
- The **next steps** as a strong glowing band, later steps only as a thin, pale trace. You see what matters now and can sense the rest.
- A small fork symbol at stations where you can turn
- A flag at the target
- "End navigation" clears everything.

---

## 9. For authors and imports

The map is built from data alone. So that it looks good, in Step 2 you write a guide `templates/cogita/weltkarte-AI.md` and link it from `opowiesci-AI.md`. It is offered via MCP like the other guides (`list_import_formats`). Write it in Polish like the existing guides. Contents:

1. **Places:** one topic = one place, 10–15 questions whose `about` names that topic. Larger topics as a block with parts, using the relation from §3.
2. **Prerequisites:** only those that are needed for the subject matter, in `Wymaga`. They determine height and position.
3. **Stories:** one flow per story. Places come from `about`/`of` of the steps, so connect every scene and every question to the right topic. The flow's name is the line's name, e.g. "Z Ruą".
4. **Branches** with `choice`/`chapters` become interchange stations. Branches that rejoin form a closed shape on the map.
5. **Tickets** come from `Wymaga` of the unit and from `condition` steps. To open a section only after certain knowledge, put a `knowness` condition there.
6. **Cards without slides** are allowed; they are learned directly.
7. **No positions, colours or heights** in imports.
8. A checklist mirroring the author list (§11).

---

## 10. Extensibility: conditions as building blocks

Today sections and runs require only knowledge. Later, other conditions will be added. The structure must accept them without a rebuild.

### 10.1 One shared condition language
Tickets and run unlocks are **conditions** in the same form as the existing `condition` expressions in flows (`and`, `or`, `not`, `knowness`, `value`, `flow`). Check in Step 1 whether `logic.ts` can be extended for this. If yes, use it. If not, propose a compatible form.

### 10.2 Evaluator registry
Every condition type has an **evaluator** with the same interface:

```ts
interface ConditionEvaluator<C> {
  type: string;                        // "knowledge"; later "group", "geo", "code", …
  evaluate(c: C, ctx: LearnerContext): ConditionResult | Promise<ConditionResult>;
  cost(c: C, ctx: LearnerContext): number;            // for Dijkstra and the planner
  describe(c: C, ctx: LearnerContext): ConditionView; // text, symbol, action for the panel
}
type ConditionResult = { met: boolean; progress?: number; missing?: unknown };
```

Unknown types are shown as "not met, unknown type" and break nothing.

### 10.3 Future types (do not build now, do not block)

| Type | Example | What the structure already needs |
|---|---|---|
| `group` | Three people answer a run correctly together | A run has a participant list instead of a single person; default is one person |
| `companion` | A section needs a second person travelling along | Travelled sections can belong to several people at once |
| `geo` | You must be at a location | `LearnerContext` can carry device data; evaluation may be asynchronous |
| `code` | A code must be entered | A condition can offer an action in the panel |
| `qr` | A QR code must be scanned | Like `code`, with a camera action |
| `time` | Only within a time window | Evaluation receives the current time through the context |

Consequences for Step 2:
- `evaluate` may be asynchronous.
- A condition's result is not stored on the place or section; it is computed from context and learner state.
- Every condition type has its own lock symbol.

---

## 11. Messy data

| Case | Behaviour |
|---|---|
| Card without a slide | "no slide, learn directly" |
| Section requires cards introduced only later | Ticket shows the introducing line and the effort to get there |
| Place without a line | Stands free, conquered directly |
| Line starts in the middle of the world | Starts at its first place, which becomes an interchange station |
| Flow without recognisable places | Not drawn; author list |
| Cycle in prerequisites | Group; author list |
| Dangling reference | Ignored; author list |
| A\* finds no route | Straight fallback line, red in the author list; test fails |
| Unknown condition type | "not met, unknown type" |

Only people with write access see the **author list**.

---

## 12. Test worlds (fixtures, no production data)

1. Bosko structure as in the prototype (≈ 50 places, 4 stories, one block with 3 parts, one story with 3 branches at one station), each with 0, 1, 3 and 5 levels
2. 1,000 places, 40 stories (generated)
3. 5,000 places (generated, layout and tracks only)
4. A "broken" world containing every case from §11

---

## 13. Implementation order in Step 2 and acceptance

| Part | Content | Acceptance |
|---|---|---|
| 1 · Model | Read and clean graph, derive lines (with branches and stations), condition registry with knowledge evaluator, height, order, Dijkstra, planner | Unit tests on all test worlds |
| 2 · Runs | Storage (§7.2), admin and personal settings, run flow, levels computed from raw runs, exclusion of unconquered places from reviews | Tests for 0, 1, 3 and 5 levels; level changes correctly when the setting changes; waiting gaps |
| 3 · Geometry | Layout, tracks in a Web Worker, cache, stability | Track test green; 1,000 places < 3 s, 5,000 places < 20 s; adding 10 places moves no existing place |
| 4 · Presentation | All of §4, integrated into the existing map | Screenshots desktop and phone, light and dark; smooth rotation with 1,000 places; no transparency |
| 5 · Interaction | Panels, ticket with sources, learn directly, runs, navigation with timetable and branch options, station choice, pillar width | Click paths: Home → section with lock → sources → learn directly → lock gone; station with 3 branches → choose one; navigate to a place with 3 missing prerequisites, choosing one branch option on the way; pillar width continuous without recomputation |
| 6 · Guide | `weltkarte-AI.md` (§9), links, MCP listing | Guide retrievable via MCP |

---

## 14. Step 1 report: outline

1. **Understanding** in your own words, at most one page: what you will build and what not
2. **Mapping** (§3): every row with file, field, example; present / different / missing
3. **Existing map:** what is replaced, adapted, kept, and which 3D technique you use, with reasons
4. **Architecture:** modules, files, interfaces, worker, cache, storage of runs
5. **Conditions** (§10): can `logic.ts` be the shared language? Concrete proposal
   - 5a. **Settings and reviews:** where world and personal settings live, and how cards of unconquered places are kept out of reviews
   - 5b. **Path view:** what happens to the existing "Ścieżka" once the map takes over its choice points
6. **Lines from real flows:** using three real Bosko flows, show the stops, branches and stations your algorithm produces
7. **Gaps:** everything missing in the data model, each marked "derive" or "decision needed"
8. **Open questions:** numbered, each with your recommendation
9. **Risks** and how you will handle them in Step 2
10. **Effort** per part of §13

---

## 15. Out of scope

- Changes to import formats or production data beyond §7.2
- Content for Bosko
- Implementing the future condition types from §10.3
