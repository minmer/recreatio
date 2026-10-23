# Interactive drawings — presentations you can touch

Status: built on 2026-10-17 (frontend only, no migration). The request: the presentation page with all its animations
should be interactable, stay light enough for a phone, be able to explain physics, and connect with Cogita.
Extended on 2026-10-18 by worlds of things (§10): the Balance Lab — beams, weights, mobiles, levels and a sandbox — as
data, on a page and as Cogita questions.

## 1. What we took from Brilliant

Brilliant (brilliant.org) teaches by doing, not by video. From its own posts and talks:

- **A lesson is a chain of small problems.** Each screen has one idea and a visual the learner manipulates before
  anything is explained ("learn the rules as you play"). Authors design the progression and the "aha" moment.
- **Interactives are a game engine, and puzzles are data.** Gear trains, mobiles, pool, optics, circuits are worlds
  of one engine; a puzzle is a structured description, which is why an LLM can generate variants (0 → 93 % correct
  gear-train puzzles once the representation was made "LLM-friendly"), and every variant is reviewed by a human.
- **Parametric, reusable diagrams** (Diagrammar, built in Elm): diagrams are code with parameters, shared toolkits and
  styles, and any diagram can become interactive.
- **Motion with state machines** (Rive): one small file per animation across web, iOS and Android; inputs and triggers
  instead of re-coding transitions.
- **Immediate feedback**, an explanation that is itself interactive, practice sets of variants for mastery.

Sources: blog.brilliant.org/hand-crafted-machine-made, rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations,
thestrangeloop.com/2022/diagrammar-simply-make-interactive-diagrams.html, brilliant.org/courses/puzzle-science.

## 2. What existed before (0085–0110)

- **Presentation** (0085, 0089, 0108): scenes on one scroll axis, steps with emphasis, camera flight, travelling
  pieces, branching paths with buttons. Every animation was *playback*: the motion vocabulary (`motion.ts`: move, size,
  turn, fade, draw, color, reveal, keys) runs on the clock with WAAPI, and a drawing (`animation` module) is SVG
  shapes with such motions. Nothing reacted to the viewer beyond navigation; there was no state and no physics, and a
  rich picture meant precomputed keyframes (the Cogita knowledge map is 45 kB of JSON).
- **Cogita**: twelve answer forms (text … point), none of them visual; flows have a look `scenes`, but the flow
  player renders it as styled reading, not through the presentation engine. Page modules (revision, flow, entity card
  …) can stand in a presentation scene.

## 3. The model (all data, `pages/motion/liveModel.ts`)

A drawing becomes interactive by adding keys next to `size`, `symbols`, `elements`:

| key | what |
|---|---|
| `vars` | values the viewer sets: `[{ "name", "value", "min", "max", "step", "unit", "label", "random": [a, b] }]` |
| `let` | values computed from others, in order, every frame: `[{ "name", "value": "v0^2*sin(rad(2*kat))/g" }]` |
| `sim` | ODEs: `state: [{ "name", "value" (start), "rate" (derivative) }]`, `events` (when → set / stop / say), `until`, `dt`, `speed`, `auto`, `loop`, `max` |
| `controls` | slider, number, toggle, choice, button (`do`: run/pause/toggle/reset, `set`, `go`), readout |
| `rules` | when a condition *becomes* true: `say` (with `{…}`), `mood`, `goal`, `set`, `do`, `go` (presentation), `once` |
| `panel` | controls below (default) or beside a wide drawing |

On shapes: any number or color may be an expression (`"x": "=x0 + v*t"`); text with `{…}`; `show`; `drag`
(`{ "x": "var" }` or `{ "set": { "kat": "deg(atan2(py, px))" } }`); `tap`; `repeat` (with `i`, `n`). New shapes:
`arrow`, `poly`, `plot` (y = f(u) or a parametric path), `trace` (the path of a value over time), `frame` (a world
window with y up, axes, clip — positions in world units, sizes in drawing units).

Built-in names: `t` (simulation time), `time` (seconds visible), `step` (position inside the presentation scene),
`i`/`n`, `u`, `px`/`py`. The expression language (`expr.ts`) is parsed into closures — no `eval` — with arithmetic,
`^`, comparisons, logic, ternary, strings, `fmt(x, d)` with a Polish decimal comma, and ~35 functions.

## 4. The runtime

- `liveRun.ts` — `Program`: compiles everything once; RK4 in fixed steps (frame-rate independent), events and rules
  checked after every step (a ball passing through a hoop for one step still counts), simultaneous assignment
  (collisions), restart when a value of the experiment changes (its start, a rule's or an event's condition), live
  effect when only a rate changes (gravity). `runToEnd()` simulates without a screen — used by Cogita checks.
  `problemsOf(drawing)` lints every expression without drawing.
- `LiveDrawing.tsx` — React builds an SVG skeleton (`data-k`); a loop writes only changed attributes, only for parts
  whose names changed, skips parts inside hidden groups, runs at most 60 fps, and stops entirely when nothing moves or
  the drawing is not visible (its scene is away, it scrolled out). Handles get a transparent 44 px hit ring and
  `touch-action: none`; arrow keys move a focused handle; controls are native inputs with values for screen readers.
  Reduced motion: nothing starts by itself; what the viewer starts still runs.
- `DrawingView` keeps static drawings exactly as before and lazy-loads `LiveDrawing` only for interactive ones.

## 5. In a presentation

- The drive ignores touches that start on `[data-pz-hold]` (handles, the control panel), so dragging a handle never
  swipes the scene; presenter clicks on them do not advance.
- `ShowClock` (`showContext.ts`) gives each scene's drawings `step` — scrolling through the steps of a scene can
  reveal parts (`"show": "step >= 1"`), fluidly in between.
- A rule's or button's `go` moves the presentation (`next`, `back`, a scene key, `link:<id>`), along the branching
  paths of 0089.

## 6. In Cogita

- New answer form `interactive` (question fields `drawing`, `goal`, `solution`). The card shows the drawing and
  "Sprawdź"; the stored answer is the values that were set. The check rebuilds the program with them and simulates to
  the end — correct when a goal is reached (a rule with `"goal": true`, or the question's own `goal` expression).
- `random` values are drawn per attempt from the card's seed and fixed in the card (the learner cannot override them);
  the card's fingerprint ignores them, so its history survives new targets. A `solution` is a computation with them
  (`kat = 45; v0 = sqrt(cel*g)`) and is replayed after a wrong answer; after any answer the drawing replays the
  learner's own attempt.
- Works wherever cards are: revisions, flow question steps, live sessions (participants get the drawing without goal
  rules or solution, [L3]), the knowledge map and progress.
- A presentation can include a `cogita-revision` module whose questions are interactive.

## 7. Authoring

The user does AI in their own chat ([ai-stays-outside]): the `animation` editor offers "Kopiuj polecenie dla AI"
(context, rules, the full format, an example), a live preview, a list of expression problems, and nine physics
examples to insert (`liveExamples.ts`: throw, pendulum, spring, incline, collision, refraction, waves, orbit, ball —
and, since 2026-10-18, the balance workshop and the gears from `liveWorlds.ts`).
The page JSON description contains the section "Rysunek do poruszania". The lesson
`frontend/scripts/fixtures/physics-lesson.json` (generated by `scripts/physics-lesson.mjs`) is a 10-scene presentation
built from those examples; import it through the page JSON panel of a presentation page.

## 8. Weight

- An interactive page loads ~19 kB gzip on demand (LiveDrawing 10 kB, liveRun 4 kB, expression chunk 5 kB); the first
  public load carries only the tolerant reader. Each lesson drawing is 1–3 kB of JSON.
- Measured in headless Edge at 390×844 with a 4× slower CPU: a running pendulum costs ~17 % of the main thread
  (page baseline excluded); an idle drawing costs nothing.

## 9. Checks

- `scripts/app-sim-check.mjs` (in `app:check`): the language, physics against closed forms (range within 3 cm,
  pendulum period within 10 ms, spring energy to 1e-6, bounce e²·h, collision swap, circular orbit radius), rules,
  problems, the examples, Cogita cards and checks, the lesson import.
- A DB-free browser harness (session scratchpad: `harness/`, esbuild alias to `src/app`, CDP over Node's WebSocket):
  60 checks — sliders, buttons, mouse and touch drags, keyboard, presentation wheel/swipe vs. handles, step reveal,
  the Cogita card, the editor, reduced motion, phone layout, light and dark, performance.

## 10. Worlds of things (2026-10-18)

The second request: a balance puzzle game ("Balance Lab": beams with pivots, weights of 1–100 kg, nested hanging
beams, torque physics, levels, a sandbox with undo, save and zoom) that can stand on a page and be a Cogita
question — and, above all, not hardcoded: a sandbox where many such games and experiments are made by *describing
the constraints and behaviour of things*.

**The idea.** A drawing may carry a `world`: *kinds* of things (what each has, what follows from it, how it moves, how
it looks, what one may do with it), the *things* at the start (a tree — each hangs on a parent or stands at the top),
and the *rules* of this world. Nothing in the engine knows beams: the balance is a 9 kB document
(`pages/motion/liveWorlds.ts`), and a gear train is the same words with other kinds.

| key | what |
|---|---|
| `kinds[]` | `name`, `label`; `props` — numbers with `min`/`max` that may be expressions (`"=parent.length"`), `step`, `unit`, `apart` (spacing among siblings), `new` (where a new one goes), `when` (does it apply to this thing), `quiet` (not listed among a selected thing's given values); `let` (computed per thing); `state`, `events` (per-thing ODEs, the same RK4); `shapes` (the look, evaluated in the thing); `drag` (`{ prop: expression of px, py }`), `tap`; `can` (`edit`, `add`, `remove`, `copy`); `readouts`; `children` (at most); `brief` (how a thing is named in the panel, `"{m} kg"`); `mark` (the dashed ring on changeable things, default on) |
| `things[]` | `{ id, kind, parent, lock (true or a list of props), …props }`; a prop may be `{ "random": [a, b] }` or an expression of the drawing's values (`"=3 + s"`, see §12) |
| `allow` | `add`, `remove`, `copy`, `edit`, `drag`, `roots` — narrower than the kinds allow (a puzzle), never wider |
| `limits` | `things`, `depth` |
| `keep[]` | invariants `{ when, say }`: a change after which one fails is taken back (`edits <= 2` — "only two moves") |
| `save`, `hint` | the workshop's save/load/JSON; the line under the drawing when nothing is selected (`{…}` computed) |
| `list` | every changeable property as its own row in the panel (default: when nothing can be added or removed and there are at most six — a puzzle) |

Expressions gain relations and aggregates (`expr.ts`): `parent.x`, `root.x`, `outer.x`, `w2.m` (a thing by its id),
`sum|avg|min|max|count|all|any(set, expr)` over `children`, `descendants`, `siblings`, `others`, `things` or a kind;
per-thing built-ins `isroot`, `depth`, `index`, `selected`, `nchildren`, `can` (and `can.pos` per property — §13); drawing-wide `edits` and `nthings`. Every
compiled expression records where it reads (`links`: `children>total`, `parent>x`, `@w2>m`), and after each change
of structure the world sorts all lets of all things topologically — nobody declares an order, a cycle is reported.
Lets that depend on time run after every step, only those the rates need run in every RK stage, the rest only when
something changed.

**Runtime.**

- `liveWorld.ts` (`World`): an environment per thing (its prototype is the drawing's), the evaluation order,
  permissions, bounds/steps/apart, add/remove/copy with subtrees, undo/redo snapshots, `replay(shot)` (rebuild a
  given world through the rules, counting moves), change tracking by name (a turning gear rewrites one transform, not
  48 teeth).
- `liveEdit.ts` (`Workshop`): every change a person makes is remembered, counted (`edits`) and checked against `keep`
  (taken back on violation, the reason shown); a drag is one change, a slider pulled through is one change.
- `liveRun.ts`: the world's state in the same RK4 vector; `sleep` — when nothing changed across steps for 0.8 s the
  loop stops until the next change; rules with `for` (true for N seconds without a break); controls with `show`.
- `liveBuild.tsx` draws `{ "type": "world" }` (inside a frame) as one `<g data-thing>` per thing, parents first, with
  a 44 px ring at the thing's `x`, `y`; a frame with `camera: true` zooms (buttons, Ctrl+wheel, two fingers — not by
  double tap, which fires by accident while selecting) and pans when zoomed. Its fitted view is computed once and kept:
  dragging, editing or adding something that still fits does not move or rescale the picture; „Dopasuj” refits. `LivePanel.tsx` adds the workshop: undo/redo, reset, start/pause, zoom, add buttons, and
  an inspector of the selected thing (slider, −/+, number, readouts, hang a child, duplicate, remove).
- Select by tap or click, move by dragging or arrow keys, Delete removes, Ctrl+Z/Ctrl+Y. A finger on a thing blocks
  page scrolling (`touchstart` is cancelled there — Chrome ignores `touch-action` on the parts of an SVG).

**The balance** (`BALANCE`, `balanceDrawing(level)`): a beam turns about its pivot; its bar hangs `h` below the
pivot, so an empty beam is level and a heavier side tips it until it rests on a stop (`tilt`).
`mom = sum(children, total*arm) + bm*(length/2 − pivot)`, `total = bm + sum(children, total)`, and
`I·ω' = −g·mom·cos φ − g·h·(total + 1)·sin φ − c·ω` with near-critical damping (`speed` 4 for the feel of a game).
Green: balanced and still; yellow: balanced, still swinging; red: one side heavier. Solved: every beam has
|ΣM| < `tol` and stands still for one second. ΣM per beam and M per weight (toggle "Momenty"), a ruler every 0.5 m
(toggle "Linijka"); the view fits the rest positions of all things, so it does not wobble with the swing. The scene is
anchored at the ceiling (y = 0): top beams hang `hang` below it, and the floor lies under the deepest point anything
can reach when tilted — only the floor moves when something deeper is hung (the top stays where the eye has it).

**Balance Lab** (`frontend/scripts/balance-lab.mjs` → `scripts/fixtures/balance-lab.json` and
`balance-lab-cogita.json`): a 12-scene presentation — a demo, levels 1–6 (simple balance, another mass, several
weights, a beam on a beam, a three-level mobile, only two moves), two expert levels (the beam has a mass, move the
pivot), the workshop, gears, Nauka. Each level is the same kinds with other things, locks and rules — and, since
§12, a family of tasks of comparable difficulty drawn anew on every visit; "Dalej →" appears when it is solved
(`show: "solved"`, `go: "next"`). The script checks every family before writing it: 40 draws and the document's own
version each compile, are unsolved at the start and are solved by their solution replayed through the rules, and
the family is varied. The course: a topic, six knowledge statements, the eight levels as interactive questions (the
solution is the drawing's `task.solve`, computed with each attempt's numbers), a revision
(all levels in order) and a slides flow with a hint after a wrong answer. Import the presentation through the page
JSON panel of a presentation page, the course through Nauka → JSON; any page can take the workshop or the gears from
"Wstaw przykład" of an `animation` module.

**In Cogita.** The answer is `{ vars, world }`; the check replays the learner's world through the world's rules
(locked stays locked, nothing is added where adding is not allowed, each changed thing is a move, so `keep` holds;
properties are set twice, so a weight may take a place another one only frees) and simulates to the end. Each attempt
draws its task with the same generator as a page (§12) and keeps the numbers (`fixed`, things as `fixed["w1.m"]`). A solution may name
`id.prop`; solution and answer are told in words ("Ciężarek w3 · Masa = 2 kg"); after answering, the drawing replays
the learner's world, or the solution.

**Weight.** The world engine adds ~6 kB gzip to the lazy interactive code (LiveDrawing 15 kB, liveRun with world and
workshop 11 kB, expressions 6 kB). A settled balance sleeps: 2–6 ms of main thread in 3 s on a 4× slower phone; the
gear demo, which keeps turning, about a quarter.

**Checks.** `scripts/app-world-check.mjs` (in `app:check`): world expressions and their order; the balance against
physics (to the stop, level and solved, the angle of a small overhang tan φ = −M/(h·(m + 1)), a beam on a beam,
sleeping); the rules (bounds as computations, steps, apart, locks, `when`, allow, depth); the workshop (one change
per drag and per slider, undo/redo with add/copy/remove, `keep`); replay and Cogita (locks, moves, random per try,
answers in words); both fixtures; gears; random tasks and marks (§12, §13). The browser harness has 120 more checks for
worlds: the workshop with mouse and keyboard, a phone with touch and two fingers, levels and "Dalej" in the
presentation, random tasks and „Nowe zadanie”, the marks and rows, portrait and landscape phones, the Cogita card
(right, wrong, the solution replayed), gears, performance.

## 11. Predict first, then see — and small screens (2026-10-18)

**Prediction.** Brilliant's "predict → observe → explain" as a general word: a drawing may carry `predict` (`true`
or `{ start, say, check, again, hold }`). While it is held (`held` = 1): the simulation does not run (a balance is held
level by hand — clamps at the beam ends), rules are silent (no message, no goal), and whatever would give the answer
away waits — authors use `held` in expressions (`"stroke": "=held ? 'ink' : …"`, `"show": "!held"`, readouts with
`show`). The learner sets up a guess, presses „Sprawdź" (`release`: `tries` + 1, the experiment starts from its
beginning), and sees what happens. With `start: true` (a task) any change after the check holds it again — the guess
is being changed — and „Popraw" does the same; with `start: false` (the workshop) it runs freely and „Przewiduj"
holds it on demand, replacing the separate "Pauza". In Cogita the drawing is held while answering and the card's own
„Sprawdź" releases it; checks (`runToEnd`) release by themselves. All Balance Lab levels and the eight questions
predict first; the demo scene stays free for discovery. The goal message adds "Przewidziane za pierwszym razem!" when
`tries` = 1.

**Small screens.** A presentation piece whose content is taller than the room from its anchor to the stage edge
(a phone held sideways, a drawing with its workshop) gets that room as `max-height` and scrolls inside
(`.pz-el.is-scroll`, measured with a ResizeObserver; pieces that fit keep their look, shadows are not clipped).
The drive hands a swipe to an inner scroll while it can still move in that direction and takes it back at its end;
when the page is pinch-zoomed, one finger pans the zoomed view instead of changing scenes. On a stage, an
interactive drawing is at most ~62 % of the stage height, leaving room for its controls.

**Stable while touching.** Selecting a thing never moves the picture: the side panel is aligned to the top (a growing
inspector no longer re-centres the drawing), a presentation piece with a live drawing always reserves its scrollbar
(the drawing does not shrink when the inspector makes it scroll), the stage's hidden-overflow frames snap back if
focus or `scrollIntoView` tries to scroll them, and the camera keeps its view (see above).

## 12. Random tasks of comparable difficulty (2026-10-18)

The request: "not every time the same task, but every time a random example of comparable difficulty — an example for
many scenarios, not hardcoded". A drawing may carry `task` (`liveModel.ts`, generated by `liveTask.ts`):

| key | what |
|---|---|
| `require[]` | conditions every drawn task must meet — expressions such as `onstep(s, 0.5)` (the answer lies on the slider's grid), `abs(s - r0) >= 1` (far enough from the start), `a != b` |
| `solve` | the solution as expressions of the drawn values: `"w2.pos = 3 + s"` or `{ "kat": "…" }` |
| `new` | the label of the „Nowe zadanie” button (`false`: none) |
| `tries` | how often to draw at most (200) |

What is drawn: vars with `random` (snapped to their `step`) and thing properties with `random`; thing properties may
be expressions of the drawing's values (`"m": "=a"`, `"pos": "=3 - d"`), so an author draws a few numbers and derives
the scene from them (solution-first: draw the answer's ingredients, derive the rest, reject what does not fit). A
draw counts when every `require` holds, no rule with `goal` already holds at the start, and every `solve` target can
be reached by hand (a var within its bounds; a thing property that may be edited or dragged, within its bounds, on a
thing that exists); with „Nowe zadanie” it must also differ from the task just shown. If nothing fits in `tries`
draws, the task is the one the document's values describe. **Comparable difficulty is said by the task itself**:
the same steps, numbers from the same ranges, the answer on the grid, a start far enough from it — no game is code.

Where: a page draws on every visit (the drawing's own chance), „Nowe zadanie” draws again — keeping what the person
switched on (controls), resetting moves, checks and `solved`, holding again for a prediction, refitting the camera;
Cogita draws per attempt from the card's seed with the same generator and keeps the numbers in the card, so the check
and the replay see the same task; without its own `solution` a question takes `task.solve`. The predict text and the
world's hint are templates (`"Przewiduj: po lewej {w1.m} kg, {abs(w1.arm)} m od osi."`) — static page text cannot
know the numbers, the drawing can.

Balance Lab's eight levels are families: p1 draws masses and arms so that one division gives a place on the 0.5 m
grid; p2 the same with the mass to find (whole kilograms); p3 two free weights with one solution on the 0.25 m grid;
p4/p5 nested beams whose hanging points come out on the grid; p6 a gap one move can close (two moves allowed);
p7 the beam's own mass with the pivot off centre; p8 the pivot between two end weights. `balance-lab.mjs` verifies 41
tasks per family before writing the fixtures.

## 13. What is given, what you change — and the phone (2026-10-18)

**In the drawing.** Every thing knows whether a person may change it: `can` (anything — drag or edit) and `can.pos`
per property (a relation-like read in `expr.ts`; the world sets them, nothing computes them). Kinds use them to
show it: the balance draws given weights grey and riveted to their beam, a weight you move green with arrows along
the beam, a mass you set with „±”, a movable hanging point or axis green with arrows. The engine adds a dashed ring
around changeable things (`mark`, CSS), but only when the drawing has both kinds of things (`is-mixed` — in a
workshop everything can change, so nothing is marked).

**In the panel** (`LiveWorldPanel.tsx`, values written by `liveSync.ts`): „Dane” — chips of the things that are
given (tap: their values, marked given); „Ustawiasz” — in a puzzle every changeable property as its own row (name,
value, − slider +, a number field where there is room), no need to select first; then the tools in one row
(„Sprawdź”, „Nowe zadanie”, undo/redo/reset and the camera as icons), the message and the drawing's controls
(„Dalej →” right after „Brawo!”), then the selected thing (values that can change, values that are given with a lock,
readouts — below the buttons, so selecting never pushes „Sprawdź” away), the hint, and the workshop's add/save/JSON.
Things are named by their kind's `brief` („Ciężarek 2 kg”), in the panel and for screen readers alike.

**On a phone** both the drawing and what you set must be visible at once: on a stage the drawing sticks to the top of
its scrolling piece while the panel scrolls beneath it; held sideways (landscape, little height) the drawing and the
panel stand side by side; in narrow panels the number field gives way to the value next to the name. The lesson's
wide placement gives the drawing more width. Checked in the harness at 390×760 and 760×360: drawing and slider fully
in view, and the drawing still in view with the piece scrolled to its end.

## 14. Not done

- Units in drawings are display strings (`vars[].unit`). The shared quantity list (`core/quantities.ts`, step 13) is used by Cogita fields and questions and by the labs' readouts (`labQuantity`), not yet by drawings.
- A Cogita flow with look `scenes` and a graph of its own still renders as styled reading. A flow that points at a
  presentation (`presentation`, step 12, COGITA.md §8) plays through the presentation engine, drawings included.
- No visual drawing editor (JSON, preview, examples, AI prompt). The Cogita question editor shows `drawing` as a
  plain long text field without a preview.
- A drawing on a page does not record progress into a Cogita question by itself; use a revision module.
- Parametric symbols (`use` with parameters) and per-particle simulation state (arrays) are not in the language.
- Worlds: no moving a thing to another parent; things do not collide (two gears may overlap); a hanging weight acts
  on its beam by its weight only (no swing of its own).
