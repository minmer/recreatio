# Interactive drawings — presentations you can touch

Status: built on 2026-10-17 (frontend only, no migration). The request: the presentation page with all its animations
should be interactable, stay light enough for a phone, be able to explain physics, and connect with Cogita.

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
examples to insert (`liveExamples.ts`: throw, pendulum, spring, incline, collision, refraction, waves, orbit, ball).
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

## 10. Not done

- Cogita flows with look `scenes` still render as reading, not through the presentation engine.
- No visual drawing editor (JSON, preview, examples, AI prompt). The Cogita question editor shows `drawing` as a
  plain long text field without a preview.
- A drawing on a page does not record progress into a Cogita question by itself; use a revision module.
- Parametric symbols (`use` with parameters) and per-particle simulation state (arrays) are not in the language.
