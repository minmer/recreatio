# Particle lab engine — architecture

Status: design for Milestone 1 (boiling water on a heater), written before the code as the build prompt asks
(2026-10-19). Code: `frontend/src/app/lab/particles/`. Simplifications: [SIMPLIFICATIONS.md](SIMPLIFICATIONS.md).
Not related to the physics lab (`lab/physics/`, LAB.md) or to Balance Lab (INTERACTIVE.md) — it only reuses the lab
frame (`LabFrame.tsx`).

## 1. What it is

A real-time 2D particle engine for a school chemistry sandbox. A box of air; pupils paint materials and place
apparatus; everything that happens follows from local rules and the species database. Milestone 1 covers heating,
convection, boiling, condensation and the tools to inspect them. Chemistry (M2), melting solids (M3) and energetic
reactions (M4) are designed for (§12) but not built.

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
    store.ts         the particle store: structure of arrays, fixed capacity, free list (§3)
    grid.ts          uniform neighbour grid: counting sort, 3×3 search, neighbour lists (§5)
    kernels.ts       2D SPH kernels (poly6, spiky, cubic spline)
    shapes.ts        sampling regions, lines and apparatus outlines into particle positions
    scene.ts         scene JSON: read, normalise, apply, write (§9)
    engine.ts        the Engine: commands, the step loop with its timings, queries, budgets (§6)
    solver.ts        multiphase PBF (M1a)            heat.ts       enthalpy, conduction, heater (M1b)
    phase.ts         nucleation, splitting, condensation (M1c)    boundary.ts  open sides, ambient air (M1c)
    protocol.ts      the messages between the host and the worker (§8)
  render/            WebGL2: instanced particles, later metaballs and overlays (§7)
  engine.worker.ts   the worker: owns the Engine (and the renderer on an OffscreenCanvas)
  workerFactory.ts   creates the worker (Vite bundles it; the harness swaps it)
  host.ts            main thread: starts the worker, decides where to render, forwards commands, receives stats
  ParticleLab.tsx    the React shell: palette, tools, inspector, charts, time controls (uses LabFrame)
  i18n.ts            all UI text: Polish first, German and English ready
  tests/             Vitest, headless in Node (§11)
pages/parts/particles.tsx   the page part `particles` (one module of a page)
```

## 3. Data layout — the particle store

Structure of arrays with a fixed capacity, allocated once per resolution; a stack of free slots makes spawning and
deleting O(1) without allocation. Slots keep their index for life (the inspector holds an index and a `uid`). Loops
never walk the whole capacity: the grid rebuild produces the list of live particles sorted by cell, and every loop
runs over it.

| Field | Type | Unit | Meaning |
|---|---|---|---|
| `x, y` | f64 | m | position (origin bottom-left of the box, y up) |
| `px, py` | f64 | m | predicted position (solver) |
| `ox, oy` | f64 | m | position at the previous substep (render interpolation) |
| `vx, vy` | f64 | m/s | velocity |
| `phase` | u8 | — | 0 solid, 1 liquid, 2 gas |
| `fixed` | u8 | — | 1 = static (walls, apparatus): never moves, infinite solver mass |
| `alive` | u8 | — | slot in use |
| `uid` | u32 | — | stable identity |
| `spc[K]`, `smass[K]` | u16, f64 | —, kg | composition: K = 4 species slots (index+1, 0 = empty) and their substance mass |
| `mass` | f64 | kg | substance mass = Σ smass — real, conserved, used for heat and chemistry |
| `H` | f64 | J/kg | specific enthalpy — temperature and phase progress are derived from it |
| `T, rho, p` | f64 | K, kg/m³, Pa | derived each step: temperature, real density, pressure |
| `nbr` | u16 | — | neighbour count |
| `area` | f64 | m² | solver rest area (2D volume) — see §6.3 |
| `wInv` | f64 | 1/kg | solver inverse mass (0 for static) |
| `lambda` | f64 | — | PBF multiplier |
| `role` | u8 | — | 0 none, 1 heater element (static particles of a heater) |
| `group` | u16 | — | heater group / apparatus id |
| `site` | f32 | — | reserved: nucleation-site strength of a surface particle |
| `budget` | f32 | — | reserved: remaining vapour expansion budget (splits) |
| `acc, accH` | f64 | kg, J | reserved: condensate accumulator (water mass and its enthalpy) |
| `bond` | i32 | — | reserved: bond group (solids, M3) |

Every particle has the same nominal 2D area `A0 = s²` (s the spacing of the quality level) and represents a volume
`A0·D`. Mass, heat capacity and every displayed number come from the real substance mass.

Quality levels: s = 4 / 3 / 2.5 mm (Niska / Średnia / Wysoka); smoothing radius h = 2s; a 30 × 20 cm box holds
≈ 3 700 / 6 600 / 9 600 particles. Changing the level rebuilds the scene from its description (§9).

## 4. Species database

`engine/species.json`: one entry per substance or material in the schema the chemistry milestones will use. Every
number is `{ "v": value, "src": key }`; `sources` maps keys to full citations (NIST WebBook, CRC Handbook, IAPWS,
Kell 1975, manufacturer data sheets). Entries for M1: H₂O (ice, water, steam), N₂, O₂, borosilicate glass, stainless
steel, porous ceramic (boiling chips). Per entry: molar mass, density per phase (water ρ(T) by Kell's formula), c_p
per phase, thermal conductivity per phase, latent heats and transition temperatures, Antoine coefficients, the
nucleation superheats of a liquid (ΔT at sites, ΔT in the bulk), the nucleation-site density of a solid surface,
surface tension and contact angles (pairs), colours, and for later chemistry ΔfH° and S°. A test checks that every
value has a source.

## 5. Neighbour grid

Cell size = h, covering the box plus a margin. Each substep: cell index per live particle → counts → prefix sums →
`sorted` (particle indices ordered by cell) and `cellStart`. A neighbour search visits only the 3×3 cells around a
particle. The solver builds a flat neighbour list once per substep (`nbrStart`, `nbrList`) and reuses it in its
iterations. No allocation after the first build at a given capacity.

## 6. The step loop

Fixed substeps, dt = 1/240 s; the worker runs as many as the elapsed time (× speed) asks for, up to a time budget, and
the renderer interpolates positions between the last two substeps. Every particle goes through the same sequence:

1. Gravity and forces → velocity; predict positions (static particles do not move).
2. Rebuild the neighbour grid.
3. Constraints, a few iterations: density (fluid and static neighbours), later solid bonds.
4. Velocities from the corrected positions; viscosity, cohesion and adhesion.
5. Heat: conduction between neighbours, heater input, losses to the room.
6. Phase change: nucleation, evaporation, condensation, splitting.
7. Chemistry hook (empty in M1).
8. Open boundaries: remove leaving particles, refill ambient air.
9. Diagnostics: mass and energy budgets, probes, timings.

Each phase is timed (ms per phase, shown in the developer HUD). Nothing in the loop allocates; there is no
`Math.random` (the seeded generator is part of the state), so a run is deterministic for a seed and a command
sequence.

### 6.1 M0 placeholder

Until M1a, step 3 is a simple non-penetration constraint so the skeleton can be painted and watched. A few
Gauss–Seidel sweeps run over the particles in grid order: rows of cells from the bottom up, each cell sorted by height
(the grid records each particle's rank). A moving particle closer than s to a fluid particle earlier in that order, or
to a static particle, moves away by the whole overlap; the neighbour does not move (one-sided, like shock
propagation). Contacts within 0.1 % of s count as touching, so floating-point noise cannot make a lattice drift
sideways. Velocities are capped at 3 m/s. A two-sided, mass-weighted Jacobi version was tried first and blew the box
apart. The placeholder has no pressure and no buoyancy: a painted drop rests on the air below it. The PBF density
constraint replaces it.

### 6.2 Mechanics — multiphase PBF (M1a)

Position Based Fluids (Macklin & Müller 2013) in the number-density form of Solenthaler & Pajarola (2008), mass-weighted
as in Macklin et al. (2014):

- Density constraint `C_i = A_i Σ_j W(x_i − x_j) + Σ_b A_b W(x_i − x_b) − 1` (fluid neighbours j, static neighbours b;
  poly6 kernel). `A_i` is the particle's rest area, `A_b = 1 / Σ_k W(x_b − x_k)` over static neighbours (Akinci et al.
  2012), so walls contribute density and fluids neither leak nor stick.
- `λ_i = −C_i / (Σ_k w_k |∇_k C_i|² + ε)` with `w = 1/m_solver` (0 for static); correction
  `Δx_i = w_i Σ_j (λ_i A_i + λ_j A_j) ∇W_ij` (+ the boundary term). Heavier particles move less: buoyancy emerges from
  gravity plus incompressibility, with no "rise" code.
- Per-particle rest density through the rest area and solver mass: liquids and solids `m_solver = m`,
  `A_i = m / (ρ_real(T)·D)` — thermal expansion moves particles apart; gases `A_i = A0`,
  `m_solver = ρ_map·A0·D`, where ρ_map maps the ideal-gas density at ambient pressure monotonically (log scale) into
  20–80 kg/m³. Liquid : gas stays below ≈ 50 and the order of gases (H₂ < steam < air < CO₂) is kept.
- Velocity update, XSPH viscosity (per material pair), cohesion and adhesion after Akinci et al. (2013) with
  coefficients from the database (calibrated to the resolution, documented).
- Pressure for the inspector and for T_sat: `p_i = p_ambient + λ`-derived pressure, smoothed; must pass the hydrostatic
  test (≈ 98 Pa per cm of water).

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
the room through a heat-transfer coefficient. Convection must emerge from thermal expansion (§6.2); only if solver
noise masks it, a Boussinesq term computed from the same material data is added.

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

### 6.5 Boundaries and ambient air (M1c)

Each side of the box is a wall (two layers of static particles) or open. An open side is a thin band acting as the
room: particles that leave are removed and booked as escaped (mass per species, enthalpy); when the band's density
falls below rest, ambient air (pressure, temperature, composition from the ambient settings) is spawned there.
Gravity and ambient pressure are settings; lower pressure lowers T_sat through Antoine, zero-g leaves bubbles where
they form — neither is coded directly.

## 7. Rendering

WebGL2 with instanced quads (one instance per particle: position and colour, interpolated between substeps); the
fragment shader draws a soft disc. Views: "particles" (colour by species and phase) and, later, "realistic"
(screen-space metaballs). Overlays later: temperature (colour-blind-safe), pressure, density, velocity vectors, phase
map, force arrows. The renderer takes any WebGL2 context, so the same code draws in the worker (OffscreenCanvas) or on
the main thread.

## 8. Threading and the message protocol

The engine runs in a module Web Worker. If the browser can create a WebGL2 context on an OffscreenCanvas, the canvas
is transferred and the worker renders; otherwise the worker sends a render snapshot each frame (transferable buffers:
interpolated positions and colours) and the main thread draws it with the same renderer. React never holds particle
data; the UI reads stats at 5–10 Hz.

Host → worker: `init`, `resize`, `addParticles(region, composition, T)`, `removeParticles(region)`,
`addSolid(shape, material, T)`, `setHeater`, `setAmbient`, `setBoundary`, `query(x, y)`, `pause`, `step`,
`setSpeed`, `setQuality`, `serialize`, `load`, `frameDone` (fallback rendering). Worker → host: `ready`, `stats`,
`frame` (fallback snapshot), `reply` (query, serialize), `error`. Types in `engine/protocol.ts`.

## 9. Scenes

A scene is a starting layout, not a particle dump: the box (size, depth), ambient settings, boundary sides, the seed
and an ordered list of operations (fill a region with a composition at a temperature, place an apparatus, draw a wall,
place a solid). Loading applies them to a box of ambient air; painting and placing append operations, so saving
reproduces what was built at any quality level. JSON, `format: "recreatio/particles"`, version 1.

## 10. React shell and page part

`ParticleLab.tsx` inside `LabFrame` (title bar with time controls, stage, side panel, full screen): palette (water,
air, glass, steel, boiling chips; beaker, hot plate), tools (paint, erase, place, wall, drag, inspect — mouse and
touch), quality, developer HUD (ms per step phase, particles, steps per second). Later: inspector, bubble view,
charts, levels (primary / secondary), "About this model". Page part `particles` (fullscreen, lazily loaded, the scene
in its config).

## 11. Tests

Vitest, headless in Node on the engine alone (`npm run test:particles`, also the last step of `npm run app:check`).
M0 (`tests/m0.test.ts`): database sources, Antoine, Kell, the enthalpy curve, store and free list, grid against brute
force, lattice rest area, the empty box, scene round trip, determinism for a seed, a 2 s painted run (finite, water
mass kept).

The prompt's gates decide when a milestone is done. Reports give measured numbers, not impressions:

| # | Test | Pass criterion | Milestone |
|---|---|---|---|
| 1 | Stability | Water under air settles; 10 simulated minutes, no explosion, flat surface | M1a |
| 2 | Hydrostatics | Pressure rises ≈ 98 Pa per cm of water depth (±10 %) | M1a |
| 3 | Buoyancy | A vapour blob in water rises; a water droplet in air falls | M1a |
| 4 | Conservation | Insulated closed box: energy drift < 1 % over 5 min; substance mass exact, including escaped | M1b |
| 5 | Heating rate | Constant power below boiling: dT/dt ≈ P/(m·c_p) (±10 %) | M1b |
| 6 | Boiling point | Water plateaus at ≈ 100 °C at 101.3 kPa and ≈ 90 °C at 70 kPa | M1c |
| 7 | Subcooled boiling | Early bubbles collapse before the surface; later ones reach it | M1c |
| 8 | Superheating | Smooth plate, no chips: bulk water exceeds 100 °C; adding chips triggers boiling | M1c |
| 9 | Performance | Developer HUD shows ms per step phase; ≥ 60 fps with 8 000 particles on the target laptop | M1d |

M1d also ends with a walkthrough of the boiling scene. Working rule: stop after each milestone and report test results
and known limitations before starting the next.

## 12. Designed for, not built

- **Chemistry (M2)**: composition slots per particle and the empty chemistry hook (step 7); species carry ΔfH° and S°
  so feasibility can come from ΔG; reactions will be graph edges parsed from formulas, rates from Arrhenius times
  contact (cross-species neighbour pairs) or concentration within a particle.
- **Solids (M3)**: `bond` group ids and a constraint slot in step 3 (shape matching or distance constraints); melting
  dissolves bonds through the same enthalpy curve.
- **Energetic reactions (M4)**: local overpressure needs a compressible model beyond the low-Mach assumption (§6.2) —
  the solver keeps the gas mapping in one place so it can be replaced.
- **WebGPU**: the solver works on flat typed arrays with no object graph, so its loops can move to compute shaders.
