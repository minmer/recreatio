# Particle lab engine — architecture

Status: M0 (skeleton) and M1a (mechanics) built, 2026-10-19; M1b (heat), M1c (phase change) and M1d (teaching tools)
designed here, not built. Code: `frontend/src/app/lab/particles/`. Simplifications:
[SIMPLIFICATIONS.md](SIMPLIFICATIONS.md). Not related to the physics lab (`lab/physics/`, LAB.md) or to Balance Lab
(INTERACTIVE.md) — it only reuses the lab frame (`LabFrame.tsx`).

## 1. What it is

A real-time 2D particle engine for a school chemistry sandbox. A box of air; pupils paint materials and place
apparatus; everything that happens follows from local rules and the species database. Milestone 1 covers heating,
convection, boiling, condensation and the tools to inspect them. Chemistry (M2), melting solids (M3) and energetic
reactions (M4) are designed for (§12) but not built.

Target machine (the user's decision, 2026-10-19, replacing the prompt's "8 000 particles at 60 fps on a mid-range
school laptop"): a high-performance PC. The normal resolution is very high (2 mm particles), high (2.5 mm) also
counts as normal, and medium (3 mm) is the choice for a weaker computer. Hosting is GitHub Pages: whatever needs
special HTTP headers has to work without them (§8). What it costs is in §11.1.

Rules that override convenience (from the prompt): one engine (one particle store, one neighbour grid, one step loop —
water, air, steam, glass and the heater are the same particle type with different data; a phase change edits fields,
it never swaps objects); no presets or scripts in engine code (no "beaker", no "if heater on, spawn bubbles"); all
substance behaviour from a sourced species database; SI units with a slab of depth D; every approximation listed in
SIMPLIFICATIONS.md and shown to pupils; everything live.

## 2. Layout

```
lab/particles/
  engine/            plain TypeScript — no React, no DOM; runs in the worker and headless in Node (tests)
    units.ts         constants (R, g, p_atm), conversions
    species.json     the species database: every value with its source (§4)
    species.ts       typed access: density(T), c_p, k, latent heats, Antoine, gas density and its mapping
    rng.ts           seeded random numbers (the only randomness in the engine)
    mem.ts           every field the kernels touch, on a SharedArrayBuffer when helpers compute along (§8)
    store.ts         the particle store: structure of arrays, fixed capacity, free list (§3)
    grid.ts          uniform neighbour grid: counting sort, the list of moving particles, lattice sites (§5)
    kernels.ts       2D SPH kernels (poly6, spiky), the lattice rest area, the pressure scale κ
    solver.ts        the kernels of a substep: predict, search + λ, correction, end of substep (§6.2)
    runner.ts        who runs the kernels: one thread, or the engine's thread with helpers (§8)
    band.ts          air only where it matters: the band of air particles, ambient air elsewhere (§6.5)
    shapes.ts        sampling regions, lines and apparatus outlines into particle positions
    scene.ts         scene JSON: read, normalise, write (§9)
    engine.ts        the Engine: commands, the step loop with its timings, queries, budgets (§6)
    protocol.ts      the messages between the host and the worker (§8)
                     later: heat.ts (M1b), phase.ts (M1c)
  render/            WebGL2: instanced particles, later metaballs and overlays (§7)
  engine.worker.ts   the worker: owns the Engine (and the renderer on an OffscreenCanvas)
  helper.worker.ts   a helper: computes its share of every kernel on the shared memory (§8)
  workerFactory.ts   creates the workers (Vite bundles them; the harness swaps the file)
  host.ts            main thread: starts the worker and the helpers, decides where to render, forwards commands
  fullLab.ts         the all-cores tab: its address carries the scene (§8)
  ParticleLab.tsx    the React shell: palette, tools, inspector, time controls (uses LabFrame)
  i18n.ts            all UI text: Polish first, German and English ready
  tests/             Vitest, headless in Node (§11)
pages/parts/particles.tsx   the page part `particles` (one module of a page)
frontend/lab.html, src/lab.tsx, public/lab-sw.js   the all-cores tab and its service worker (§8)
```

## 3. Data layout — the particle store

Structure of arrays with a fixed capacity, allocated once per scene load (on shared memory when helpers compute
along); a stack of free slots makes spawning and deleting O(1) without allocation. Slots keep their index for life
(the inspector holds an index and a `uid`). Loops never walk the whole capacity: the grid produces the list of live
particles sorted by cell and the list of the moving ones, and the kernels run over those.

| Field | Type | Unit | Meaning |
|---|---|---|---|
| `x, y` | f64 | m | position (origin bottom-left of the box, y up) |
| `px, py`, `qx, qy` | f64 | m | the two buffers of predicted positions (a correction reads one and writes the other) |
| `ox, oy` | f64 | m | position at the start of the step (render interpolation) |
| `vx, vy` | f64 | m/s | velocity |
| `phase` | u8 | — | 0 solid, 1 liquid, 2 gas |
| `fixed` | u8 | — | 1 = static (walls, apparatus): never moves, infinite solver mass |
| `alive`, `uid` | u8, u32 | — | slot in use, stable identity |
| `origin` | u8 | — | box wall, made by an operation (painted, placed), or air of the band (§6.5) |
| `spc[K]`, `smass[K]`, `dom` | u16, f64, u8 | —, kg, — | composition: K = 4 species slots and their substance mass; the dominant species |
| `mass` | f64 | kg | substance mass = Σ smass — real, conserved, used for heat and chemistry |
| `H` | f64 | J/kg | specific enthalpy — temperature and phase progress are derived from it |
| `T, rho` | f64 | K, kg/m³ | temperature, real density |
| `p`, `pres` | f64 | Pa | displayed pressure (smoothed, absolute) and the solver's gauge pressure of the last substep |
| `area` | f64 | m² | solver rest area (moving) or density share of a static particle |
| `wInv` | f64 | 1/kg | solver inverse mass (0 for static) |
| `lambda`, `lamSum`, `dens` | f64 | —, —, — | PBF multiplier, its sum over the iterations of a substep, solver density / rest |
| `dvx, dvy` | f64 | m/s | velocity change from viscosity, cohesion, adhesion (applied at the end of a substep) |
| `edge`, `vgx, vgy, vgw` | u8, f64 | — | touches ambient air without particles; Σ ∇W and Σ W over its lattice sites |
| `nbr`, `role`, `group` | u16, u8, u16 | — | neighbour count; heater element; heater group |
| `site`, `budget`, `acc, accH`, `bond` | | | reserved: nucleation site, vapour budget, condensate accumulator, solid bonds |

Mass and volume: every particle stands for a lattice cell of area s² and depth D, so its substance mass is
ρ·s²·D. The solver's rest area is the kernel-consistent `A0 = 1 / Σ W` over the rest lattice: with the spiky kernel
of the solver (whose own point carries 62 % of the sum at h = 2s) A0 ≈ 0.785·s². Gas particles move with a mapped
density (§6.2); their real mass stays real.

Quality levels: s = 2 / 2.5 / 3 mm (Bardzo wysoka — the default / Wysoka / Średnia); smoothing radius h = 2s. Changing
the level rebuilds the scene from its description (§9). Walls and apparatus are at least two particles thick, so they
thicken at coarser levels: a beaker's wall is 4 mm at very high and 6 mm at medium, and the same beaker holds about
10 % less water. A scene names its level; a device on which someone chose a lower one keeps that choice (browser
storage), because the level is a property of the computer, not of the lesson.

## 4. Species database

`engine/species.json`: one entry per substance or material in the schema the chemistry milestones will use. Every
number is `{ "v": value, "src": key }`; `sources` maps keys to full citations (NIST WebBook, CRC Handbook, IAPWS,
Kell 1975, manufacturer data sheets). Entries for M1: H₂O (ice, water, steam), N₂, O₂, borosilicate glass, stainless
steel, porous ceramic (boiling chips). Per entry: molar mass, density per phase (water ρ(T) by Kell's formula), c_p
per phase, thermal conductivity per phase, latent heats and transition temperatures, Antoine coefficients, the
nucleation superheats of a liquid, the nucleation-site density of a solid surface, surface tension, contact angles,
colours, and for later chemistry ΔfH° and S°. A test checks that every value has a source.

## 5. Neighbour grid

Cell size = h = 2s, covering the box plus a margin of six lattice sites; a cell holds exactly 2 × 2 sites of the box
lattice. Each substep: the cell of every live particle (computed in the kernels while predicting, in parallel) →
counts → prefix sums → `sorted` (particle indices ordered by cell), `cellStart`, and `moving` (only the moving ones,
same order — the kernels run over it, so every thread gets the same amount of work). The search visits the 3×3 cells
around a moving particle and is at the same time the first PBF iteration (§6.2): per neighbour within h it stores the
index, the kernel gradient and the kernel value (`nbrList`, `pgx, pgy`, `pw`), which the correction then only weights.
Per cell, `cellAir` marks ambient air without particles; per site, `siteFree` says whether air can be there (inside
the box or beyond an open side, nothing static on it). No allocation after the first build at a given capacity.

## 6. The step loop

A step is dt = 1/240 s; the worker runs as many as the elapsed time (× speed) asks for (when the computer cannot keep
up, as many as its threads manage, §8), and the renderer interpolates positions between the last two steps. Each step
runs k substeps of one PBF iteration each: k = 8 at 2 mm, scaled with the spacing (6 at 3 mm), more — up to 16 — when
the fastest particle would move more than 0.4·h in a substep. Every particle goes through the same sequence:

1. Gravity → velocity; predict positions and cells (static particles do not move).
2. Sort the grid (from the cells computed in step 1).
3. Search the neighbours and compute λ (first iteration); the correction from one position buffer into the other,
   with XSPH, cohesion and adhesion in the same loop; further iterations if configured.
4. End of substep: velocity from the corrected positions plus the velocity change of step 3, the pressure, and the
   prediction of the next substep (positions and cells) — steps 2–4 repeat k times.
5. Heat: conduction between neighbours, heater input, losses to the room (M1b).
6. Phase change: nucleation, evaporation, condensation, splitting (M1c).
7. Chemistry hook (empty in M1).
8. Boundaries: particles that leave the grid are removed (substances booked as escaped, air returned to the room);
   the band of air follows what matters (§6.5).
9. Diagnostics: mass and energy budgets, probes, timings.

Each stage is timed (ms per stage, shown in the developer HUD). Nothing in the loop allocates; there is no
`Math.random` (the seeded generator is part of the state), so a run is deterministic for a seed and a command
sequence — also with helpers (§8).

### 6.1 How the solver was chosen (measured, M1a)

The first PBF version (poly6 density, spiky gradient, one substep with four iterations) failed in ways that decided
the design; each fix is a measurement, not a guess:

- **A column compresses with its height.** Without memory of the pressure between steps, every step must rebuild the
  hydrostatic pressure from the density error: the error grows with g·H·dt²/(s²·iterations) — 30 % at the bottom of
  6 cm of water at 3 mm, more at 2 mm. Warm-starting the pressure from the previous step wound up and exploded. Small
  steps (Macklin et al. 2019) cut the error quadratically: 8 substeps × 1 iteration hold a 5 cm column at 2 mm within
  1–2 %.
- **Walls must push like the fluid.** A static particle has no constraint of its own; counted once, the column pushed
  its bottom row through the two wall layers. Counting the boundary term twice (pressure mirroring, as Band et al.
  2018 do for SPH) holds it.
- **The gradient must belong to the density.** With poly6 density and spiky gradient a box of water at rest, given one
  small kick in zero g, kept boiling (Σv² from 0.0025 to 48). With a consistent kernel the corrections are
  conservative. poly6 with its own gradient pairs particles (no gradient at the origin; 89 of 200 particles paired, 7 %
  volume lost); spiky with its own gradient does not.
- **Jacobi overshoots.** Summed over all constraints of a particle, full corrections overshoot; ω = 0.5 keeps the kick
  test dissipative.
- **Viscosity and cohesion belong in every substep.** Applied once per step, XSPH did not hold the noise of the
  iterations and cohesion rang at the contact lines (0.3 m/s at the corners of the water); per substep they do not.

### 6.2 Mechanics — multiphase PBF (M1a)

Position Based Fluids (Macklin & Müller 2013) in the number-density form of Solenthaler & Pajarola (2008),
mass-weighted as in Macklin et al. (2014):

- Density constraint `C_i = A_i Σ_j W_ij + Σ_b V_b W_ib − 1` with the spiky kernel (W(0) included in the sum over j);
  fluid neighbours j, static neighbours b, and the free lattice sites of ambient air without particles (§6.5), which
  count like static particles of area A0. Static particles sit on the same lattice as the fluid, two layers thick, so
  `V_b = A0` (the frozen-fluid volume that Akinci et al. 2012 compute per particle for irregular boundaries).
- `λ_i = min(0, −C_i / (w_i |∇_i C_i|² + Σ_j w_j |A_i ∇W_ij|² + ε))` with `w = 1/m_solver` (0 for static) — pressure,
  never tension; correction `Δx_i = ω w_i [Σ_j (λ_i A_i + λ_j A_j) ∇W_ij + 2 λ_i Σ_b V_b ∇W_ib]`, ω = 0.5. Heavier
  particles move less: buoyancy emerges from gravity plus incompressibility, with no "rise" code.
- Per-particle rest density through rest area and solver mass: liquids and solids `m_solver = m`; gases `A_i = A0`,
  `m_solver = ρ_map·s²·D`, where ρ_map maps the ideal-gas density at ambient pressure monotonically (log scale) into
  20–80 kg/m³ (air 61, steam at 100 °C 52). Liquid : gas stays below ≈ 50 and the order of gases is kept. M1b adds
  thermal expansion through the rest area of liquids.
- Velocity: from the corrected positions, plus XSPH (per substep 0.03 between liquids, 0.08 with gas, 0.03 at walls;
  mass-weighted so momentum is kept; ambient air without particles counts as air at rest), cohesion between like
  liquid particles and adhesion to solids after Akinci et al. (2013).
- Surface tension: for a pair force F = γ m_i m_j C(r) the line tension of a flat interface in the slab is
  γ (ρD)²/3 ∫C r³ dr, so γ = 3σ/(ρ² D ∫C r³ dr). That formula gives 16 times the surface tension of water; the factor
  1/16 is calibrated on the Laplace pressure of a disc in zero gravity (Δp = σ/R within ±10 % at 2–3 mm, R 8–12 mm).
  Adhesion from the contact angle by Young–Dupré: W_a/W_c = (1 + cos θ)/2 with the same moment formula — not measured.
- Pressure: `p_i = p_ambient − ω Σλ_i / (κ A_i D dt²)`. κ = s²/(A² · ½Σ_j |f_j| r_j²) corrects for the discrete
  gradient, which sees a linear pressure field only 1/κ as strongly as the continuum (κ = 1.83 for spiky at h = 2s);
  displayed smoothed over 50 ms. Hydrostatics: 95–96 Pa/cm against 97.9 (§11).

### 6.3 Heat (M1b)

State is specific enthalpy H (J/kg); T and the phase progress follow from the material's enthalpy curve: sensible
heat from c_p per phase plus latent heat at each transition. Reference: H = 0 for every species at 0 °C in its
reference phase (liquid for water, solid for glass, steel and ceramic, gas for N₂ and O₂). Water: ice
`−L_f + c_ice(T − 0 °C)`, liquid `c_l(T − 0 °C)`, vapour `c_l·100 K + L_v(100 °C) + c_v(T − 100 °C)` — vapour enthalpy
depends on T alone (ideal gas), so the latent heat at another saturation temperature follows Kirchhoff's law
(`L(T_sat) = h_v − h_l`). A mixture's H is the mass-weighted sum, so T follows by inverting a linear function in each
phase. Conduction between neighbours in the energy-conserving form of Cleary & Monaghan (1999) with the harmonic mean
of conductivities:

```
dH_i/dt = Σ_j m_j / (ρ_i ρ_j) · 4 k_i k_j / (k_i + k_j) · (T_i − T_j) · (r_ij · ∇_i W_ij) / (|r_ij|² + 0.01 h²)
```

applied pairwise and antisymmetrically (what i gains, j loses), with real masses and real densities. Heater: static
particles with `role = 1`, one group per heater, power-controlled (W per slab depth, spread over its elements) or
temperature-controlled (thermostat with a power limit). Losses: wall and open-boundary particles exchange heat with
the room through a heat-transfer coefficient; the band of air exchanges heat with the ambient air at its edge, booked
like the air it exchanges (§6.5). Convection must emerge from thermal expansion (§6.2); only if solver noise masks
it, a Boussinesq term computed from the same material data is added. Warm air and warm apparatus are "active" and
pull the band of air with them (§6.5).

### 6.4 Phase change (M1c)

T_sat from the Antoine equation at the local pressure (ambient + hydrostatic from the solver). A liquid particle
starts to vaporise only above T_sat + ΔT_nuc — small at nucleation sites (liquid touching a solid surface particle with
`site` > 0, scaled by the solid's site density), large in the bulk; next to existing vapour there is no barrier. Heat
above the saturated-liquid enthalpy goes into latent progress; at progress 1 the particle becomes vapour with the
expansion budget `k = min(ρ_l/ρ_v, K_max)`, K_max ≈ 16, spent by rate-limited splitting that halves the substance mass
each time (the bubble inflates smoothly). Vapour touching liquid below T_sat condenses; a gas particle whose water
partial pressure exceeds p_sat(T) gives water mass and latent heat to the accumulator of a nearby liquid or solid
particle; a full accumulator spawns a droplet (dew on cold walls runs down). Gas particles exchange species by
diffusion in the same SPH form as heat. Every transition conserves substance mass and energy exactly.

### 6.5 Boundaries and ambient air (band in M1a, open sides in M1c)

**Air only where it matters** (`band.ts`, the prompt's fallback after Müller et al. 2005). Air particles exist in a band
of three cells (6 s: 12 mm at very high) around everything that is "active": every liquid, everything painted, every
gas that is not ambient air, and air or apparatus warmer or colder than the room by more than 0.5 K. The rest of the box
is ambient air without particles: still, at room temperature, pressure and composition. Its free lattice sites count
in the density of nearby particles like static particles of area A0 (pressure mirrored), and XSPH pulls nearby
particles towards its rest — so the band's air is held as if by a wall of still air. When a cell joins the band, air
particles are put on its free sites; when it has been far from everything for 48 substeps, its air goes back to the
room. Stray band air found in a cell of ambient air goes back too. Mass and enthalpy that move between the band and
the room are booked (`airInMass`, `airOutMass`, `airInH`, `airOutH`), so the budgets stay exact. In the boiling scene
at very high the band holds 458 air particles instead of 13 427 for a box full of air.

The room beyond an open side is ambient air of the same kind (its lattice sites continue beyond the box), so the air
of the band does not pour out of an open top; what leaves the grid is removed — substances booked as escaped, air
returned to the room. M1c adds the open-boundary bookkeeping of energy and the room's exchange of steam. Each side of
the box is a wall (two layers of static particles) or open. Gravity and ambient pressure are settings; lower pressure
lowers T_sat through Antoine, zero-g leaves bubbles where they form — neither is coded directly.

## 7. Rendering

WebGL2 with instanced quads (one instance per particle: position and colour, interpolated between steps); the
fragment shader draws a soft disc. Ambient air without particles is not drawn (the box's background is that air; the
side panel says so). Views: "particles" (colour by species and phase) and, later, "realistic" (screen-space
metaballs). Overlays later: temperature (colour-blind-safe), pressure, density, velocity vectors, phase map, force
arrows. The renderer takes any WebGL2 context, so the same code draws in the worker (OffscreenCanvas) or on the main
thread.

## 8. Threading and the message protocol

The engine runs in a module Web Worker. If the browser can create a WebGL2 context on an OffscreenCanvas, the canvas
is transferred and the worker renders; otherwise the worker sends a render snapshot each frame (transferable buffers:
interpolated positions and colours) and the main thread draws it with the same renderer. React never holds particle
data; the UI reads stats at 5 Hz.

Two rhythms that do not hold each other back:

- **Steps** run in chunks of at most 4 ms, chained through a `MessageChannel` (no timer clamping); a timer waits only
  while the simulation is ahead. Each chunk runs as many steps as the elapsed time × speed asks for. When the computer
  cannot keep up, chunks run back to back: time runs slower, a backlog beyond 0.1 s is dropped, and the lab says so
  (§10).
- **Drawing** follows the screen (`requestAnimationFrame` in the worker): every beat while the simulation keeps up,
  about 60 per second while it lags. Chromium does not run a worker's animation frames while messages are queued, so
  with a full thread the chunks draw themselves once the last picture is 16 ms old.

Steps tied to frames would give a 144 Hz screen one step per frame. In the fallback, two snapshot buffers travel, so
the worker can send the next picture before the page has returned the previous one.

**All cores.** Every kernel of a substep is Jacobi-style — a particle writes only its own fields and reads its
neighbours' from the previous phase — so it can be cut into pieces. With helpers, the engine's fields live on
`SharedArrayBuffer`s (`mem.ts`); the host creates up to seven helper workers (cores − 2) and gives each a
`MessageChannel` to the engine's worker; `SharedRunner` (`runner.ts`) runs a kernel by raising a generation counter
in a shared `Int32Array`, computing its own piece, and waiting until the helpers have counted `DONE` up (they spin
about half a millisecond between kernels, then sleep in `Atomics.wait`). New fields after a scene load go to the
helpers as a message with a version; until all have confirmed, the engine computes alone. The result is
bit-identical whatever the number of threads (a test computes the kernels in seven reversed pieces). Serial between
kernels: the counting sort, the band, removing particles.

**GitHub Pages and isolation.** Browsers give shared memory only to cross-origin isolated pages
(`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`), and GitHub Pages cannot send
headers. So the lab has its own page, `lab.html` (a separate Vite entry, `src/lab.tsx`), and `public/lab-sw.js`, a
service worker whose scope is that page only: it passes every response of the page through and adds the headers. On
the first visit the page registers it, waits until it is active and reloads once (a flag in sessionStorage prevents a
loop); after a hard reload, which bypasses service workers, it reloads once more. Workers of an isolated page must
share its headers — a file under /assets/, outside the worker's scope, does not, so `lab.html` creates its workers
from blobs (`?worker&inline`); the page part uses the files (it is not isolated). The page part opens the tab with a
button ("Wszystkie rdzenie"): what was built goes into the address, compressed (`#z=` + deflate-raw + base64url,
`fullLab.ts`), so the link can also be shared. The rest of the site is untouched: no service worker, no headers.

Host → worker: `init` (with the helpers' ports), `resize`, `op` (fill, erase, solid, beaker, hotplate), `setHeater`,
`setAmbient`, `setBoundary`, `query(x, y)`, `pause`, `step`, `setSpeed`, `setQuality`, `showAir`, `serialize`, `load`,
`frameDone` (fallback rendering). Worker → host: `ready`, `view`, `stats`, `frame` (fallback snapshot), `reply`
(query, serialize), `error`. Engine → helper: `init` (the control buffer, its index), `attach` (the fields, a
version), `quit`. Types in `engine/protocol.ts` and `engine/runner.ts`.

## 9. Scenes

A scene is a starting layout, not a particle dump: the box (size, depth), ambient settings, boundary sides, the seed,
the quality and an ordered list of operations (fill a region with a composition at a temperature, place an apparatus,
draw a wall, place a solid, erase). Loading builds the walls, applies the operations and draws the band of air around
what matters; painting and placing append operations, so saving reproduces what was built at any quality level.
JSON, `format: "recreatio/particles"`, version 1.

## 10. React shell and page part

`ParticleLab.tsx` inside `LabFrame` (title bar with time controls, stage, side panel, full screen): palette (water,
air, glass, steel, boiling chips; beaker, hot plate), tools (paint, erase, place, wall, inspect — mouse and touch),
quality (very high by default, the choice remembered on the device), a hint when the computer cannot keep up for
three seconds at speed 1× or slower (with buttons for the all-cores tab and the next lower level), the inspector
(phase, temperature, pressure, mass, velocity, density, enthalpy, neighbours, composition — and "ambient air without
particles" where there is no particle), the developer HUD (ms per stage, particles, air particles, steps per second,
threads, substeps). Later: bubble view, charts, levels (primary / secondary), "About this model". Page part
`particles` (fullscreen, lazily loaded, the scene in its config, the "Wszystkie rdzenie" button).

## 11. Tests

Vitest, headless in Node on the engine alone (`npm run test:particles`, also the last step of `npm run app:check`; the
ten-minute run of gate 1 with `npm run test:particles:slow`). M0 (`tests/m0.test.ts`): database sources, Antoine,
Kell, the enthalpy curve, store and free list, neighbour search against brute force, lattice rest area and pressure
scale, the empty box, quality levels, scene round trip, determinism for a seed, a 2 s painted run (finite, water mass
kept). M1a (`tests/m1a.test.ts`, `m1a.slow.test.ts`): the gates below, the surface-tension calibration, the band and
its ledger, bit-identical results in pieces, and the cost per quality (logged).

The prompt's gates decide when a milestone is done. Reports give measured numbers, not impressions:

| # | Test | Pass criterion | Milestone | Result |
|---|---|---|---|---|
| 1 | Stability | Water under air settles; 10 simulated minutes, no explosion, flat surface | M1a | passed: 10 min at 3 mm — surface σ 0.17 mm, v_max ≤ 0.8 cm/s, density 1.005, nothing lost |
| 2 | Hydrostatics | Pressure rises ≈ 98 Pa per cm of water depth (±10 %) | M1a | passed: 95.8 Pa/cm (3 mm), 95.2 Pa/cm (2 mm) |
| 3 | Buoyancy | A vapour blob in water rises; a water droplet in air falls | M1a | passed: the blob rises 3.4 cm in 0.5 s; the drop falls 3.5 cm in 0.1 s (vacuum 4.9) |
| 4 | Conservation | Insulated closed box: energy drift < 1 % over 5 min; substance mass exact, including escaped | M1b | |
| 5 | Heating rate | Constant power below boiling: dT/dt ≈ P/(m·c_p) (±10 %) | M1b | |
| 6 | Boiling point | Water plateaus at ≈ 100 °C at 101.3 kPa and ≈ 90 °C at 70 kPa | M1c | |
| 7 | Subcooled boiling | Early bubbles collapse before the surface; later ones reach it | M1c | |
| 8 | Superheating | Smooth plate, no chips: bulk water exceeds 100 °C; adding chips triggers boiling | M1c | |
| 9 | Performance | Developer HUD shows ms per step phase; ≥ 60 fps with 8 000 particles on the target laptop — since 2026-10-19: the boiling scene in real time at very high on a high-performance PC (§11.1) | M1d | the boiling scene runs in real time at very high in the all-cores tab (M1a, §11.1) |

M1d also ends with a walkthrough of the boiling scene. Working rule: stop after each milestone and report test results
and known limitations before starting the next.

### 11.1 Performance

Reference PC: the development laptop (AMD Ryzen 9 5900HS, 8 cores / 16 threads; RTX 3070 Laptop). Real time means 240
steps per second. The boiling scene with the M1a solver (water + the band of air + walls and apparatus), headless Edge:

| Level | Moving + static particles | Page part, one thread | All-cores tab, 8 threads |
|---|---|---|---|
| very high (2 mm) | 1 264 + 1 483 | 0.56× real time | 1.0× (241 steps/s), 116 fps |
| high (2.5 mm) | 880 + 1 088 | 0.93× | 1.0×, 155 fps |
| medium (3 mm) | 632 + 860 | 1.0× (capped by the clock) | 1.0× |

One thread, Node: 6.5 ms per step at very high, 2.4 ms at medium. The levers taken for GitHub Pages: the band of air
(13 427 → 458 air particles in this scene) and all cores in the tab of its own; the GPU (WebGPU) stays designed-for
(§12). A scene with much more water costs proportionally more; the lab then says so and offers the all-cores tab or a
lower quality.

## 12. Designed for, not built

- **Chemistry (M2)**: composition slots per particle and the empty chemistry hook (step 7); species carry ΔfH° and S°
  so feasibility can come from ΔG; reactions will be graph edges parsed from formulas, rates from Arrhenius times
  contact (cross-species neighbour pairs) or concentration within a particle.
- **Solids (M3)**: `bond` group ids and a constraint slot in step 3 (shape matching or distance constraints); melting
  dissolves bonds through the same enthalpy curve.
- **Energetic reactions (M4)**: local overpressure needs a compressible model beyond the low-Mach assumption (§6.2) —
  the solver keeps the gas mapping in one place so it can be replaced.
- **WebGPU**: the kernels work on flat typed arrays with no object graph, are already cut into Jacobi phases, and
  name their parameters in one array — they can move to compute shaders as they are.
