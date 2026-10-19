# Laboratory — a 2D physics lab as a page part

Status: built on 2026-10-18 (frontend only, no migration, no backend change). The request: a module with a hard-coded
2D physics engine in which different things can be built and randomness used, where *how* the engine is used on a page
is saved in the database — liquid pressure, full screen, pleasant interaction, a sandbox and specific experiments for
school. A chemistry lab built beside it the same day was removed on 2026-10-19 (it will be done another way); this
document now describes the physics lab only. Not to be confused with Balance Lab, the world engine of Cogita
(INTERACTIVE.md).

## 1. The shape of it

| | Physics (`physics`) |
|---|---|
| Part | `pages/parts/physics.tsx` |
| Engine | `lab/physics/` (bodies, contacts, joints, fluids) |
| Component | `PhysicsLab.tsx` |
| Scene reader / writer | `physScene.ts`, `physSave.ts` |
| Experiments | `physPresets.ts` (15) |
| AI prompt | `physText.ts` |
| Checks | `scripts/app-lab-check.mjs` |

**The engine is code, the experiment is a document.** The part stores four keys in `slug_part.config`: `title`, `text`
(lines for the pupils), `mode` (`experiment` — exactly this scene with "Pokaż"; `sandbox` — everything allowed, presets
to load, save in the browser, export JSON) and `scene` (JSON). The backend accepts any lowercase kind and a config up
to 64 000 characters, so nothing changed there. The part is `fullscreen: true` (the page's whole-window view) and
carries its own full-screen button (`LabFrame.tsx`: the browser's fullscreen where possible, a fixed layer otherwise).
The strip size shows a card with "Otwórz laboratorium". The engine loads lazily (`later`), with its CSS (`lab.css`).

Shared pieces in `lab/`: `LabFrame.tsx` (title bar, stage, side panel beside or below — a container query at 46 rem —,
full screen), `labView.ts` (DPR-aware canvas, camera with y up, a loop that sleeps when nothing moves, gestures: grab,
drag, tap, pan, pinch, Ctrl+wheel; on the page a finger on empty ground scrolls the page, in full screen every gesture
belongs to the lab), `labGraph.ts` (recorder), `labRandom.ts` (drawn values: `{ name, from, to, step }` or
`{ name, pick: [...] }`, numbers as `"=expr"` in the motion expression language, texts with `{name}`), `fluid.ts`
(liquids, pressure in depth), `LabEditor.tsx` (title, mode, text, presets, scene JSON, "Kopiuj polecenie dla AI", live
preview, "Przyjmij" — the AI works in the user's own chat).

Fixture: `scripts/lab-examples.mjs` writes `fixtures/lab-fizyka.json` — a page ("Pracownia fizyczna") with an intro
text, every preset as a module and a sandbox. The script runs every preset first and imports the page through
`planImport` (no warnings).

## 2. Physics

Semi-implicit Euler at 1/120 s, 10 iterations: SAT polygon and circle contacts with clipping and speculative points,
Baumgarte, warm starting by feature id (prepare and warm-start are separate passes), a 2-point block solver, friction
before the normal impulse, restitution above 0.6 m/s — also when a gap closes within the step, and propagated along a
chain of elastic bodies within the iterations, given once per contact (so Newton's cradle hands the impulse to the
last ball instead of moving all five like a lump). Joints: pin/motor, rod, rope, spring, pulley, mouse.

Fluids are volume basins: the level by bisection including what bodies displace, layers by density, buoyancy from the
polygon below the level, drag, `p = p₀ + Σρgh`, Torricelli jets from holes as drops, pipes for communicating vessels.
Tools: pin, rope, rod, spring, ruler, pressure probe, delete. Scene keys: `world`, `vars`, `bodies`, `joints`, `fluids`,
`pipes`, `show`, `graph`, `allow`, `controls`, `goal`, `steps`, `view`.

## 3. Checks

`node scripts/app-lab-check.mjs` (part of `app:check`, a few seconds): free fall, air resistance, rest and a tower,
collision, inclined plane, pendulum and spring periods, Atwood, Newton's cradle, floating and displacement, pressure in
depth, Torricelli, communicating vessels with oil — against the textbook values.

## 4. Limits, on purpose

2D rigid bodies (no soft bodies, no rolling resistance); liquids are basins, not particles.
