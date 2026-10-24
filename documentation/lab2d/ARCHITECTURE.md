# 2D lab engine (v2) — architecture

Status (2026-10-22): Milestones M0–M1d are built on the CPU and pass their tests except the time budget of test 16;
M1e, the WebGPU path, is built as the "accelerated view" — the whole step on the GPU (§15) — and meets test 17 (test 11
was at the edge of its tolerance, as on the CPU, until the particles of a cell shared their heat). M2a, the first step of the sandbox plan ([SANDBOX.md](SANDBOX.md)), adds
liquids other than water (rapeseed oil first) on the CPU: per-material particles, viscosity and drifting droplets
(tests 18–22). M2b adds dissolved salt (NaCl): one water activity for vapour pressure, boiling and freezing point,
brine density and heat capacity, crystallisation to a crust (tests 23–27), and droplets below the cell size that boil
off and fly; particles of one cell share heat and salt at the rate of diffusion across the cell, and salt diffuses
from cell to cell (`exchange.ts`, tests 28–30). The accelerated view takes neither oil nor salt yet; it shares heat
within cells like the CPU. B (2026-10-22) bakes a scene into a clip — computed once as fast as the machine allows,
kept in the browser, played back without computing and continued live from any frame bit for bit (§16, tests 31–34);
the lab never starts by itself, a module may bake on opening, and one lab can offer several scenarios.
Since 2026-10-24 violent boiling is computed without blowing up, softened or asked about (§19), and the lab runs only
full screen with a preparation phase, a simulation phase and a bake dialog (§20).
[MILESTONES.md](MILESTONES.md) has the measured numbers. Written as a
design before the code (2026-10-19, as the build prompt v2 asks) and updated to what was built.
Code: `frontend/src/app/lab/lab2d/`. Simplifications: [SIMPLIFICATIONS.md](SIMPLIFICATIONS.md).

Version 1 (`lab/particles/`, documentation/particles/) simulated everything, air included, with Position Based
Fluids; it was CPU-heavy and inaccurate. Version 2 does not reuse its solver — it uses the split that CFD and
computer graphics use: fields on an Eulerian grid, liquids as APIC particles, bubbles as Lagrangian objects. It
reuses v1's interface where it fits (the lab frame, the worker loop with its two rhythms, the host, the quality
setting, the slow-computer hint).

## 1. What it is

A real-time 2D lab engine for a school chemistry sandbox. Students drag materials and apparatus into a box; the
engine computes what happens from local physical laws and real material data. The first complete scene: a beaker of
water boiling on a hot plate. Milestone 1 covers heat and gas (M1a), the liquid (M1b), bubbles and phase change (M1c),
the teaching tools (M1d) and a WebGPU path (M1e, the accelerated view).

Quality = cell size: medium 3 mm, high 2 mm (the default), very high 1 mm. A device that once chose a lower quality
keeps it (localStorage). Budget of the prompt: at most 12 ms of simulation per 60 Hz frame at 2 mm cells
(100 × 75 for a 20 × 15 cm box), i.e. 6 ms per step at dt = 1/120 s. Reference machine for all measurements: the
development laptop (AMD Ryzen 9 5900HS, Node 22); the prompt leaves "the target school laptop" unnamed.

Rules that override convenience (prompt v2): one world, one loop (one grid, one particle store, one object store);
the right representation per quantity; no presets or scripts in the engine; data-driven materials with a source per
value; SI units in a slab of depth D (1 cm); exact bookkeeping (identical weights both ways; budgets close and are
tested); the CPU implementation is the reference; honest simplifications; everything live.

## 2. Layout

```
lab/lab2d/
  engine/              plain TypeScript, no React, no DOM: runs in the worker and headless in Node (tests)
    units.ts           constants (R, g0, p_atm, T0), store slots (GAS/LIQUID/SOLID, N2/O2/H2O)
    rng.ts             seeded random numbers (mulberry32) and an integer hash
    materials.json     species and solids, every value with its source key (§4)
    materials.ts       typed access and property functions: ρ, c_p, h, k, μ, σ, D_v; gas tables 150–1150 K
    solution.ts        salt solutions (M2b): Pitzer water activity, boiling and freezing point, solubility,
                       brine density, c_p, enthalpy and its inverse, partial enthalpy of water (§4)
    if97.ts            IAPWS-IF97 region 4 (p_sat, T_sat, dT_sat/dp), IAPWS saturation densities; fast tables
    shapes.ts          regions of scene operations: rect, circle, poly, line with width
    scene.ts           scene JSON: reading (tolerant, with warnings) and writing (§10)
    grid.ts            the staggered MAC grid and its fields (§3.1)
    particles.ts       the liquid-particle store (§3.2)
    bubbles.ts         the object store: bubbles (§3.3)
    solver.ts          PCG with a geometric-multigrid preconditioner (pressure), Jacobi-PCG (heat, diffusion) (§6.6)
    regions.ts         fluid regions (open or sealed) and the pressure p0 of sealed ones (§6.4)
    liquid.ts          APIC transfers, volume fractions, classification, liquid projection, advection (§7)
    liquidMix.ts       several liquids (M2a): the viscosity step and the drift of unresolved droplets (§7)
    extend.ts          velocity outside the liquid: extension, droplets that fly (M2b), sampling the grid (§7)
    gas.ts             conservative gas transport, MacCormack velocity, buoyancy, low-Mach sources, projection (§6)
    heat.ts            implicit conduction over all cells, heaters, losses (§6.5)
    exchange.ts        particles of one cell share heat and salt (IEM at the diffusion rate); salt between cells (§6.5)
    bubbleState.ts     a bubble's radius, pressure and temperature from its masses; footprint weights (§8.1)
    bubbleModel.ts     cavities, nucleation, growth, departure, motion, coalescence, bursting (§8)
    phase.ts           the liquid gathered per cell, vapour diffusion with surface evaporation and dew, wall films;
                       mass to and from the particles (water with its partial enthalpy) (§9)
    flash.ts, fog.ts   flash evaporation (surface cells and droplets), fog in the gas (§9)
    salt.ts            crystallisation of supersaturated brine, the crust and the box-floor store (M2b, §9)
    edits.ts           scene operations and tools: fill, erase, move, solid, beaker, hot plate (§10)
    budget.ts          mass and energy budgets
    charts.ts          the samples behind the live charts (every 0.25 s)
    stages.ts          the eight stage names (HUD, tests)
    engine.ts          the Engine: commands, the step loop with timing per stage, queries, stats
    probe.ts           what the inspector sees at a point (cell, particle, bubble; brine: w, m, T_b, T_f)
    protocol.ts        messages between host and worker
  render/              frame buffers from the engine state, WebGL2 renderer, palette, view fitting (§11)
    layers.ts          the layers of a frame (what is visible, independent of the overlay, at clip precision) and
                       the frame of an overlay composed from them — live and in playback (§16)
  clip/                clips (B, §16)
    clip.ts            the clip header, the baker (records frames, keyframes, chart samples) and the player
    codec.ts           frames as bytes: chunks of two seconds, deltas, layer-major, deflate (CompressionStream)
    snapshot.ts        a keyframe: the whole engine state by a walk through its object graph, scratch left out
    session.ts         baking, playback and going live inside the worker
    store.ts           IndexedDB (headers, chunks, keyframes; the least recently played go first)
  gpu/                 the accelerated view (M1e, §15): WebGPU kernels as WGSL in TypeScript strings, the state on the GPU
    kernel.ts          GpuCtx: device, kernels with explicit bind layouts, dispatch, a per-dispatch profiler
    slots.ts, lib.ts   buffer layouts (counters, cell and face fields, records) and the shared WGSL library
    state.ts           all GPU buffers; upload from and download to the CPU Engine (tools, inspector, saving)
    engine.ts          GpuEngine: the step as compute passes, readbacks with interval sums, iterations recorded ahead
    solver.ts          MGPCG: levels, V-cycle, the CG loop (kernels in ksolver.ts and kmg.ts)
    k*.ts              the stages: liquid (kliquid), gas (kgas, kgasflow), bubbles (kbubbles, kbubend), interface
                       and phase change (kphase), heat and diagnostics (kheat); kernels.ts lists them all
    render.ts          the WebGPU renderer (fields and cells built by compute kernels, bubbles and particles from storage)
    charts.ts          chart samples from the readouts
  engine.worker.ts     the worker: owns the Engine and (OffscreenCanvas) the renderer; two rhythms (steps, frames)
  gpu.worker.ts        the accelerated view's worker: a CPU Engine for the tools and the GpuEngine; draws with WebGPU
  host.ts              main thread: starts the worker, forwards commands, receives stats and fallback frames
  workerFactory.ts     the module worker (Vite)
  Lab2D.tsx            the React shell (LabFrame): tools, palette, inspector, bubble view, charts, levels, scenes, scenarios
  ClipControls.tsx     the start panel, the baking progress, the playback bar and the section "Nagranie" (§16)
  panels.tsx           inspector, bubble panel, charts, legend, "About this model", HUD
  presets.ts           starting layouts as data (the benchmark scene first)
  text.ts              the scene description and the prompt to copy for an outside AI
  i18n.ts              all UI text: Polish first, German and English; the simplifications for students
  lab2d.css            the stage overlays (classes l2d-*)
  tests/               Vitest, headless in Node (§12)
pages/parts/lab2d.tsx  the page part `lab2d` (card in a strip, the lab in a block, fullscreen)
scripts/lab2d-bench.mjs  the benchmark scene, timing per stage (§13)
scripts/fixtures/lab2d-wrzenie.json  a page with four labs, for import
scripts/lab2d-scenarios.mjs  writes scripts/fixtures/lab2d-scenariusze.json from the presets: one lab with eleven
                       scenarios to choose, one lab that bakes on opening (for import)
```

## 3. Data layout

### 3.1 The grid

Staggered MAC grid with square cells of size Δx over the box (the box sides are the domain boundary, not cells).
Cell (i, j), i ∈ [0, nx), j ∈ [0, ny), index c = i + j·nx, centre ((i + ½)Δx, (j + ½)Δx), y up. Faces: u at
x = iΔx, index i + j(nx + 1); v at y = jΔx, index i + j·nx. Structure of arrays, allocated once per scene load; masses
and energies Float64, everything else Float32 (as the prompt asks).

| Field | Type | Unit | Meaning |
|---|---|---|---|
| `solid` | u8 | — | material index + 1 of a solid cell (0: fluid) |
| `role`, `heater` | u8, i16 | — | 1 = heater element, and its heater group |
| `phiS`, `sdf` | f32 | —, m | static solid share of the B-spline stencil (stands in for the missing particles of walls); distance to the nearest solid |
| `phi`, `alpha` | f32 | — | liquid volume fraction φ, bubble volume fraction α_b |
| `kind`, `region` | u8, i32 | — | per step: solid, liquid or gas (§7); fluid region (§6.4) |
| `pl`, `pg` | f32 | Pa | liquid solver pressure (gauge, hydrostatics included); gas p′ = p − p_amb(y) |
| `mg[6]` | f64 | kg | gas species masses: N₂, O₂, H₂O vapour, three reserved slots |
| `mfog` | f64 | kg | fog (condensed droplets suspended in the gas) |
| `Hg` | f64 | J | gas enthalpy (species and fog) |
| `Es`, `film` | f64 | J, kg | solid energy (with its wall film and salt crust), wall-film water |
| `crust` | f64 | kg | salt crust on a solid cell (M2b; its enthalpy is in `Es`, its heat capacity part of the solid's) |
| `T`, `Tl`, `Cl` | f32, f32, f64 | K, K, J/K | cell temperature; temperature and heat capacity of the cell's liquid share |
| `Sl`, `Sg` | f32 | 1/s | divergence sources of the liquid and the gas |
| `ul, vl`, `ug, vg` | f32 | m/s | liquid and gas face velocities |
| `fs` | f32 | — | share of the cell covered by bodies (exact clipping of their rectangles, §17) |
| `owner`, `matB` | i16, u8 | — | body index + 1 and material + 1 of the body covering most of the cell (0: none) |
| `capB`, `Ts` | f64, f32 | J/K, K | heat capacity and temperature of the bodies' share of the cell (from their internal cells by area) |
| `au, av` | f32 | — | open fraction of each u and v face (1 − the share bodies cover; 0 closed) |
| `usol, vsol` | f32 | m/s | velocity of the covered part of a face: the covering body's there, else 0 |

Cavities live in a flat side table built from the solids (`bubbleModel.rebuildSites`, §8.2).

### 3.2 Liquid particles

About four per liquid cell (2 × 2 on fill), fixed capacity, packed (removal moves the last particle into the hole; a
stable `id` travels with it for the inspector).

| Field | Type | Meaning |
|---|---|---|
| `x, y`, `vx, vy` | f32 | position (m), velocity (m/s) |
| `c00, c01, c10, c11` | f32 | APIC affine matrix C (1/s) |
| `mass` | f64 | substance mass (kg) — with salt: water plus salt |
| `h` | f64 | specific enthalpy (J/kg; of the solution when there is salt) — the state; `T` and `rho` are cached from it |
| `spc[2]`, `smass[2]` | u8, f64 | dissolved species: slot 0 holds NaCl (`spc` = 1) and its mass (M2b); slot 1 is free |
| `mat` | u8 | the particle's liquid: index into `LIQUIDS` (0 water, 1 rapeseed oil); its laws give T and ρ from h |

### 3.3 Objects (bubbles in M1)

Fixed capacity, packed: position (x, y), depth z ∈ [r, D − r], velocity (vx, vy), species masses (six slots, f64),
enthalpy H_b (f64), age, attached cavity (−1: free), stable id; derived and cached: radius, volume, internal pressure,
vapour pressure, T_b, growth rate, and the last forces (four 2D vectors for the bubble view). Rigid solids (M3) will
use the same store.

## 4. Materials database

`engine/materials.json`: species and solids in the schema the chemistry milestones will use. Every number carries a
source key; `sources` maps keys to citations (IAPWS R7-97, SR1-86, R1-76, R15-11; Kell 1975; NIST WebBook; Vogel
fit; NIST-JANAF; Incropera; Sutherland constants; Massman 1998; SCHOTT data sheets; CODATA; contact angles;
Lemmert & Chawla; for oil Rojas et al. 2013 and Melo-Espinosa et al. 2014; for salt PHREEQC pitzer.dat, Spencer,
Møller & Weare 1990, Malmberg & Maryott 1956, Laliberté 2009, Pitzer, Peiper & Busey 1984, NBS 1982, IAPWS R10-06;
the references of the tests: Greenspan 1977, Bodnar 1993). A test checks that every value cites a source.

- **H₂O**: liquid ρ(T) (Kell), c_p(T) (table, piecewise linear with an exact enthalpy integral and inverse), k(T)
  (IAPWS 2011, quadratic), μ(T) (Vogel), σ(T) (IAPWS R1-76), saturation curve (IF97 region 4), saturated densities
  (SR1-86); vapour c_p (ideal gas, linear in T), k, μ; molar mass; ΔfH°, S° for later chemistry.
- **N₂, O₂**: molar mass, c_p, k(T) (power law), μ(T) (Sutherland), diffusivity of water vapour in air (Massman).
  Gas properties are tabulated from these laws at 1 K steps (150–1150 K, linear reading, error < 1e-5).
- **Rapeseed (canola) oil** (M2a): ρ(T) and c_p(T) linear (the fits of Rojas, Coimbra & Telis-Romero 2013, measured
  20–160 °C), k(T) linear and μ(T) after Vogel (fits in this repository to their tables, within 0.5 % and 1.3 %),
  surface tension constant (33.4 mN/m, the 20 °C literature mean of Melo-Espinosa et al. 2014). Not volatile.
- **Sodium chloride** (M2b, `solutes`): water activity a_w = exp(−2 m φ M_w) from the Pitzer osmotic coefficient
  φ = 1 − A_φ √m/(1 + 1.2√m) + m (β⁰ + β¹ e^{−2√m}) + m² C^φ, with the parameters and temperature form of PHREEQC
  pitzer.dat and, below 0 °C, the set of Spencer, Møller & Weare (1990, PHREEQC frezchem.dat); A_φ from the dielectric
  constant of Malmberg & Maryott (1956) and the Kell density. Brine density 1/ρ = (1 − w)/ρ_w + w/ρ_app and heat
  capacity c_p = (1 − w) c_p,w + w c_app(T, w) after Laliberté (2009); solubility from Pitzer, Peiper & Busey (1984),
  0–150 °C; heat of solution 3.883 kJ/mol at 25 °C (NBS); the crystal (ρ 2165 kg/m³, c_p 864 J/(kg·K)). For the
  freezing point, ice after IAPWS R10-06 (melting at 273.152519 K, Δh 333.44 kJ/kg, c_p 2096.8 J/(kg·K)).
  `solution.ts`; a_w is read from a 1 K × 0.05 mol/kg table built at the first salt.
- **Borosilicate glass, stainless steel, porous ceramic**: ρ, c_p, k, contact angle with water, cavity population
  (scale, largest mouth radius): glass 0.02 / 3 µm / 25°, steel 1 / 40 µm / 70°, ceramic 50 / 150 µm / 10° (§8.2).

**Several liquids** (M2a, format version 2): every substance with a `liquid` block is a liquid of the engine
(`LIQUIDS`: water first). `cpLiq`, `hLiq`, `tFromHLiq`, `rhoLiq`, `kLiq`, `muLiq`, `sigmaLiq` take the liquid's index;
water keeps its own functions, so water-only scenes compute exactly what they computed in M1. Each liquid has its own
enthalpy reference (0 at 0 °C): no liquid turns into another, so the references never meet.

**Solutions** (M2b): a water particle with salt carries m = water + salt, the salt s and the specific enthalpy of
the solution h(T, w) = (1 − w) h_l(T) + w q_s + A(w) I(T) + B(w) (T − 0 °C), the exact integral of the Laliberté
c_p (A = 1000 a₁ w e^{a₄w}, B = 1000 a₅ w^{a₆+1}, I(T) = ∫ e^{a₂t + a₃e^{0.01t}} dT from 0 °C, tabulated at 0.5 K inside
the measured 1.5–120 °C and held constant outside); q_s makes the heat of solution at 25 °C the NBS value. T(h, w) by
Newton from the particle's last temperature. Water that leaves or joins a solution carries its partial specific
enthalpy h̄_w = h − w ∂h/∂w — the per-cell sum Σ w m_w h̄_w is what the transfers book, kept current after every mass
change — so the rest of the solution keeps its temperature. Crystallising salt leaves with the crystal's enthalpy
c_s (T − 0 °C); the heat of crystallisation stays in the liquid.

**Enthalpy closure.** Every enthalpy is evaluated with the same functions everywhere: h_l(T) = ∫c_p,l dT from 0 °C,
h_v(T) = h_l(100 °C) + h_lv(100 °C) + ∫c_p,v dT from 100 °C (ideal gas, T only; h_lv(100 °C) = 2256.4 kJ/kg from
IF97), gases h_k(T) = c_p,k (T − 0 °C), solids c_s (T − 0 °C). The latent heat at any temperature is
h_lv(T) = h_v(T) − h_l(T) (Kirchhoff). Every transfer between stores moves mass with the enthalpy of the store it
leaves and books the difference as latent heat in the cells — the budgets close to round-off.

## 5. The step loop

One loop for every scene (`engine.ts`); dt = min(1/120 s, 0.9 Δx/u_max of the liquid, ½ Δx/v_max of awake bodies). Each stage is timed for the HUD.

1. **Inputs**: tools, heater power, ambient settings (applied between steps); awake bodies are written into the grid
   (§17), the particles they cover pushed out.
2. **Liquid** (§7): volume change of the last step to the grid; weights; volume fractions; classification (against
   the previous kinds); gas moves out of cells that became liquid and into cells that became gas (exactly); regions
   and p0; gas pressure for the free surface; particles → grid, forces, projection, grid → particles, advection,
   drift correction; heat weights.
3. **Gas** (§6): gas volumes; gas faces; conservative transport (sub-cycled); equation of state; MacCormack velocity
   with buoyancy and viscosity; sources; projection.
4. **Bubbles** (§8): the liquid gathered per cell (T, C, Σ w m, Σ w m h); per-cell budgets; nucleation; growth or
   condensation, departure and motion in adaptive substeps; coalescence; bursting and collapse; mass to the
   particles; α_b.
5. **Interface and gas-phase change** (§9): vapour diffusion with surface evaporation, condensation and dew; flash;
   fog; wall films that spawn particles; supersaturated solutions crystallise (`salt.ts`).
6. **Heat** (§6.5): implicit conduction over all cells with the latent heat of steps 4–5 as sources; heaters; losses;
   then the particles of each cell share heat and salt, and salt diffuses between cells (`exchange.ts`).
7. **Chemistry hook**: empty in M1.
8. **Boundaries and diagnostics**: regions again, compression heating of sealed regions, pressure work on particles
   and bubbles, the equation of state for the next step, budgets, chart samples.
9. **Bodies** (M3a, §17): the cells' changes back to the voxels; pressure on the outlines, the measured added mass,
   gravity, contacts, new poses, sleep; the next dt.

Nothing in the loop allocates; there is no Math.random (the seeded generator and the cavity hash are part of the
state); the CPU path is deterministic for a seed and a command sequence (tested bit for bit).

## 6. Gas

### 6.1 State and transport

Each fluid cell stores conserved quantities: species masses m_k, fog m_f, enthalpy H. T follows from H in closed
form without fog (quadratic: c_p of vapour is linear in T), by Newton with fog. Density uses the gas volume
V_gas = V_cell (1 − φ − α_b). Masses move in flux form between gas cells and through open sides only: across a face
between gas cells the flux is u·A·q_face with q the donor concentration plus a van-Leer-limited slope (MUSCL); faces
to liquid or solid cells carry no gas mass. Sub-cycling: the sum of a cell's outgoing face speeds times h/Δx stays
≤ 0.9 (the prompt's Courant number ≤ 1 from the gas speed); additionally no cell gives more than 0.9 of its content in
one substep (a common factor on all its outgoing fluxes) — that protects cells that are only partly gas. Enthalpy
moves with the same fluxes. Open sides: inflow brings ambient air, outflow is booked as escaped (mass and enthalpy).
Gas trapped in a cell that becomes liquid moves to its gas neighbours (by their gas volume); a cell that becomes gas
takes from its neighbours what fits at its pressure — exactly conserved.

### 6.2 Velocity

MacCormack advection (semi-Lagrangian forward and backward, clamped to the bounds of the forward sample, as Energy2D),
stable at the main dt; air viscosity explicit (ν Δt/Δx² ≈ 0.03). Buoyancy per unit mass g (ρ − ρ̄)/ρ with the
region's mean density ρ̄ and ρ = p M_mix/(R T) — not Boussinesq; ρ is floored at 0.05 kg/m³ in coefficients only (a
guard for nearly empty cells).

### 6.3 Low-Mach sources and projection

Solve for p′ = p − p_amb(y): ∇·((Δt/ρ_f) ∇p′) = ∇·u* − S_g, with p′ = 0 on open sides, solid faces at rest and liquid
faces at the liquid velocity (a moving wall). Instead of approximating the prompt's four parts of S_g separately, the
engine uses the equation of state directly:

```
S_g = (V_eos − V_gas)/(V_cell Δt) + V_src/(V_cell Δt)
V_eos = Σ_k m_k R T/(M_k p(y))     the volume the cell's gas wants at its pressure and temperature
V_src                              the volume change heating, evaporation, bursting and fog caused in the last step
```

The first term is the prompt's volume correction (it removes drift); the second contains heating, added gas volume
and the composition change. Each part is capped at ±½ V_cell per step: a sudden excess (a big bubble bursting into a
small cell) is pushed out over a few steps as a short overpressure instead of demanding a velocity the transport
cannot carry. PCG with the multigrid preconditioner (§6.6), warm-started from the last p′.

### 6.4 Regions and sealed boxes

Fluid cells are labelled by connected regions after every change of solids or sides. A region that touches an open
side has p0 = p_amb. A sealed region (a closed box, a lidded beaker) gets p0 from its state every step — the prompt
asks for this reset anyway, and it cannot drift:

```
Σ_c n_c R T_c / (p0 − ρ̄ g y_c) = V_g,      V_g = V_region − Σ m_p/ρ_p − Σ V_b
```

(hydrostatics inside the region included; Newton from the solution without it). The all-Neumann projection removes
the mean of the right-hand side — exactly the uniform part (1/(γ p0)) dp0/dt. Compression heating: after all stages
each gas cell gets V_c Δp0 of enthalpy (iterated, since the heating raises p0 again: factor 1/(1 − a)); particles and
bubbles get their V Δp0 too ("pressure work"; about +0.02 K per bar for water). Energy budget: U = H − p0·V_fluid in
sealed regions. When an edit or a side switch seals, opens or resizes a region, the jump of −p0·V is booked as an
edit, not a flow (tested).

### 6.5 Heat

One temperature field over all cells (solid, liquid, gas), implicit conduction, solved for δ = T^{n+1} − T*:

```
C_i (T_i^{n+1} − T_i*)/Δt = Σ_j k_ij D (T_j^{n+1} − T_i^{n+1}) + q_i,      k_ij = 2 k_i k_j / (k_i + k_j)
```

C_i = heat capacity of the cell (solid m c_s with its film, gas Σ m_k c_p,k + m_f c_p,l, liquid Σ_p w_ip m_p c_p
with the renormalised heat weights of the particles); T* is the C-weighted mean of the cell's parts; k from the
dominant part. Jacobi-preconditioned CG (SPD, strongly diagonal), tolerance 1e-6 — the bookkeeping is exact for any
tolerance: the energy change of a cell is computed from the face fluxes of the solved temperatures (each face once,
antisymmetric) plus q_i Δt, then distributed to the cell's parts by their share of C (particles by the renormalised
weights: no smearing of the liquid's own temperature differences). Counters record the heat that crosses
solid–liquid, liquid–gas and solid–gas faces (for the charts and test 11).

**Bodies** (M3a, exact rectangles, §17): a cell may hold fluid and a share of a body at once. The share is one more
part of the cell — capacity capB from the body's internal cells by area, energy Es, temperature Ts; the cell's
conductivity mixes by the covered share, fs k_s + (1 − fs) k_f. Inside the cell body share and fluid exchange through
their interface (an area Δx·D, each half its own thickness): ΔT decays with τ = C_s C_f/((C_s + C_f) G),
G = D/(½ fs/k_s + ½ (1 − fs)/k_f) — an exact exponential, energy-conserving. A cell a body closes is solid with the
body's capacity.

**Sharing inside a cell** (`exchange.ts`, after the solve). The particles of a cell still differ — a hot and a cold one
that the flow brought together, brine beside fresh water — and real diffusion evens that out. Each particle moves
toward its cell's mean (IEM, interaction by exchange with the mean, from Lagrangian PDF methods):

```
φ_p ← φ_p + f (φ̄ − φ_p),   f = 1 − exp(−Δt/t),   τ = Δx²/(π² κ),   t = τ (heat),   t = W(2λτ)/(2λ) (salt)
```

τ is the decay time of the slowest structure a cell holds (half a wave across it) — the mixing time in still liquid.
For salt, flow mixes faster: its strain λ (the positive eigenvalue of the trace-free strain-rate tensor of the cell, from the
liquid face velocities) stretches what is in the cell into striations that thin as Δx e^(−λt); the cell is mixed when
the time so far equals the diffusion time across a striation, t = τ e^(−2λt), i.e. t = W(2λτ)/(2λ) with the Lambert
function W — τ for λ → 0, about ln(2λτ)/(2λ) for strong stirring (the lamella picture: Ranz 1979, Villermaux 2019).
Strain below 0.02/s (the noise of liquid at rest) does not count. Heat: φ = T, φ̄ the C-weighted mean
of the cell's particles, κ = α = k/(ρ c_p) of its liquids (water at 20 °C: 2.8 s at 2 mm). Salt: φ = salt per kg of
water (the water stays with its particle), κ = D (1.611·10⁻⁹ m²/s at 25 °C, Nernst–Hartley; Stokes–Einstein D ∝ T/μ_w
for other temperatures: 4.8 min at 2 mm and 20 °C). Σ m c_p ΔT and Σ Δs vanish per cell, so energy and salt stay exact;
salt changes particles with its partial enthalpy h̄_s = h + (1 − w) ∂h/∂w (donors give their own, receivers get the mean
of what was given). Between neighbouring cells salt flows by Fick's law, explicitly: D Δt/Δx² · min(W_i, W_j) ·
(b_i − b_j) per face, b = salt per kg of water, W the cell's water (D Δt/Δx² ≈ 10⁻⁵: far inside stability), carrying h̄_s
of the giving cell; a giving cell takes it from its particles by their salt (none goes negative), a receiving one
gives it by their water. Cells that share: liquid cells and gas cells next to one (the surface); a droplet alone in
the gas does not. Heat between cells stays the solve's. With λ = 1/s salt in a cell is mixed in 2.4 s instead of
4.8 min. Heat keeps its still rate where the water flows: a cell is even within 2.8 s anyway, and sharing faster would
carry the heat of a hot wall into the next cells through the particles' overlapping heat weights (the water in front of
boiling chips stayed too cold, test 12). SIMPLIFICATIONS.md #28, #32; tests 28–30, 35.

Heaters: a hot plate (a body with a heater group, its source spread over its internal cells by volume; on the
accelerated view steel cells with role 1) with an internal source — power mode (W per slab depth) or a thermostat (PI on
the mean heater temperature, power-limited, anti-windup). Box walls lose h_ext (T − T_amb) with h_ext = 10 W/(m²·K)
in series with half a cell; open sides conduct to the room (2k/Δx) and exchange by inflow and outflow. A microwave-like
volumetric liquid source exists for tests. No radiation (SIMPLIFICATIONS.md).

### 6.6 Linear solvers

`GridSolver` works on padded arrays (a ghost ring with zero coefficients: inner loops without branches) of a
rectangle of the grid. Systems in finite-volume form (A x)_c = (dH + dD + Σ a_f) x_c − Σ a_f x_nb.

- **Pressure (liquid and gas)**: CG preconditioned with one V-cycle of geometric multigrid (McAdams, Sifakis, Teran
  2010): cell-centred 2 × 2 → 1 levels down to ≤ 24 cells; red-black Gauss–Seidel V(1,1) plus one Gauss–Seidel sweep
  over the boundary band (cells next to walls or Dirichlet faces; forward before, backward after the coarse grid, so
  the preconditioner stays symmetric); bilinear prolongation of cell centres (a missing coarse neighbour: its weight
  dropped at a Dirichlet boundary, mirrored to the parent at a wall), restriction = its transpose. **Geometric coarse
  operators**: every coarse cell knows its active area and centroid; a coarse face gets Σ κL of its fine faces divided
  by the distance of the centroids, a Dirichlet coupling κL by the distance from the centroid to the face — cut cells
  at odd boundaries, the water surface and walls get the right couplings (with plain averages the V-cycle diverged
  there). Cells without any coupling (a single gas cell between water and a wall) are deactivated, at every level.
  Pure-Neumann regions (a sealed box) are found by a flood fill and their constant is projected out of the right-hand
  side, the preconditioned residual and the solution. Warm start; relative residual 1e-5 in real time and in tests
  (test-specific tolerances are passed where needed); a cap that is hit is counted and shown in the HUD.
- **Heat and vapour diffusion**: CG with Jacobi.

## 7. Liquid

- **Transfers**: APIC (Jiang et al. 2015) with quadratic B-spline weights on the staggered faces; G2P recovers the
  affine matrix with D = Δx²/4. At the box walls the stencils are completed by mirrored ghost nodes (normal component
  antisymmetric, tangential symmetric: free slip); open sides are clamped. Without the mirrors truncated stencils made
  water climb the walls.
- **Volume fractions**: φ = Σ w m_p/ρ(T_p)/V_cell + φ_s (the static solid share of the stencil stands in for the
  particles walls do not have), α_b = Σ w V_b/V_cell as far as the liquid has made room for it (see the divergence
  source). A cell is liquid when it has particles (φ > 0) and φ + φ_s + α_b ≥ ½ — and a cell may become gas only if
  it was gas, touches gas or touches an open side (no gas voids inside the liquid; cavitation is not modelled,
  bubbles are the only gas in the liquid).
- **Body force** g ρ(T)/ρ_ref with the mass-weighted mean density ρ_ref and a constant-density projection: the
  pressure is the real hydrostatic pressure, warm water rises, the density maximum near 4 °C is kept. With several
  liquids each particle brings its own density: oil floats, layers have exact hydrostatics (SIMPLIFICATIONS.md #22).
- **Viscosity** (M2a, only when a liquid other than water is present): after P2G and before the forces, implicit
  per velocity component, ρ_ref Δx²/Δt (u* − u) = Σ η_f (u_nb − u*), η_f the harmonic mean of the faces' mass-weighted
  particle viscosities; no slip at walls and solids (2η across half a cell), no stress at the free surface and toward
  empty faces; CG with Jacobi. Forces come after it: viscosity acting on the gravity kick that the projection removes
  made resting layers circulate at centimetres per second near no-slip walls.
- **Droplets** (M2a): a particle whose liquid is the minority in its cell drifts relative to the flow at the terminal
  velocity of a droplet of its own volume in the majority liquid (Schiller–Naumann drag, Hadamard–Rybczynski factor;
  at most a quarter cell per step; position only, the mixture keeps its momentum). Without it immiscible liquids would
  not separate below the cell size (SIMPLIFICATIONS.md #24). Bubble reaction
  forces (drag, added mass) are added on the faces with the bubble's weights.
- **Divergence source**: the volume change of every particle in the last step (thermal expansion, evaporation,
  condensation), splatted with its weights, plus Δα_b·V/Δt of the bubbles (growth, motion, bursting), plus the drift
  correction 0.1 (φ + α_b − 1)/Δt (the positive part everywhere, both signs in the interior) — it works on volume,
  not particle count, so bubbles and evaporation keep their volume. α_b follows the bubbles' footprint by at most
  ALPHA_RATE = 200 cell volumes per second: a merge, a burst or a collapse happens within one step however short the
  step is, and without the limit its source demanded speeds ∝ 1/Δt — the step size (set by the fastest liquid) fell to
  zero and the run ended in NaN (cold water painted onto the bare hot plate). Ordinary boiling stays below the limit
  (at most 22 /s at 2 mm, 121 /s at 1 mm measured), so no test result changes.
- **Projection**: free surface at the gas pressure of the region, placed between the centres of a liquid cell and its
  gas neighbour where φ crosses ½ ("ghost fluid", Gibou et al. 2002: the coupling a/θ with θ the fraction of the
  distance, at least 0.1; φ near walls without the missing mirror share, φ/(1 − φ_s)); the face between them is
  corrected with the same 1/θ. The pressure at depth d is then ρ g d to a fraction of a cell (before: ρ g (d + ε), ε up
  to one cell — a floating body sat half a cell too high; M3a). Walls impermeable, a moving body's faces carry its
  velocity (`grid.usol`, `vsol`); PCG + multigrid on the bounding rectangle of the liquid. Right after it, with the
  matrix still in the solver, the added mass of awake bodies is measured (§17).
- **Advection** (`liquidMove.ts`): RK2 in the grid velocity; particles that end in a solid are pushed out along the
  distance field (their normal velocity removed) — near an awake body its own shape decides (§17); particles that leave
  through an open side are booked as escaped (water, other liquids and salt separately).
- **Droplets in the air** (M2b, `extend.ts`): a particle with no liquid cell within two cells (a splash, the last
  remains of an evaporating layer) flies ballistically with its own velocity and gravity and stops where it hits a
  solid or a box wall (it wets). The grid has no velocity there: the extension set such particles to zero (they hovered
  where they were), and own-velocity faces next to extended ones made APIC ring up (a droplet over a brine surface
  accelerated tenfold per step). Inside and near the liquid nothing changes.

A fill that would leave a liquid region without a free surface is refused (the prompt: no pressure law for it in M1).

**Salt water** (M2b) is water for all of this (`mat` = water): the sums count its water only, Σ w s is gathered per
cell, and from it the molality of the cell's water, its activity a_w (at the cell's liquid temperature) and, where a
stage needs it, the boiling point T_b(p, m). A cell without water particles (liquid only because a bubble fills it, or
holding only oil) neither evaporates nor feeds a bubble — before M2b such a cell could make vapour out of nothing.
Salt moves with its particle, between the particles of a cell and by diffusion between cells (§6.5).

**Only water exchanges mass with the gas and the bubbles** (M2a): the per-cell sums that every transfer reads (Σ w m,
Σ w m h) count water particles only; evaporation and dew at a surface cell scale with its share of water, flash takes
only water particles, condensate in a cell without water becomes a new water particle (with the enthalpy the transfer
booked). Bubbles nucleate only where the liquid is mostly water, use the density, viscosity and surface tension of the
liquid around them, and exchange vapour only with water (a steam bubble in oil rises and bursts).

## 8. Bubbles

### 8.1 State

A bubble is a sphere inside the slab: p_b = p_l + 2σ/r, T_b = T_sat(p_v), V = m_v/ρ''(T_b) (vapour saturated at its
partial pressure, ρ'' from SR1-86 so it matches IF97) + n_a R T_b/(p_b − p_v) (air ideal); solved by a bracketed
root search on p_v. When 2r > D it flattens (r stays D/2 until V = π (D/2)² D) and then is a disc of volume π r² D;
the Laplace term stays 2σ/r. Heat-exchange area: sphere 4πr², disc 2πrD. While d ≤ 3Δx volume, heat and force are
spread with B-spline weights; larger bubbles are rasterised into the cells they cover.

### 8.2 Nucleation

Every solid face next to a fluid cell carries up to eight cavities, drawn once per face from a hash of the seed and
the face (independent of the order of edits): mouth radii from a truncated power law whose tail reproduces Lemmert &
Chawla, N = (210 ΔT_w)^1.805 m⁻², for steel (ΔT_act ∝ 1/r_c, calibrated at 1 atm: r_ref = 210·r_1K), scaled per
material (glass few and small, chips many and large). A cavity is active when T_f − T_sat(p_l) ≥ ΔT_act =
T_sat(p_l + 2σ/r_c) − T_sat(p_l) with T_f = (k_s T_s + k_l T_l)/(k_s + k_l); a new bubble starts at r_c with vapour
taken from the particles of the fluid cell. After a departure the site restarts when T_f again exceeds its ΔT_act —
the waiting time emerges. Per-cell energy budgets keep the transfers from pushing a cell across T_sat. In brine
(M2b) the cell's T_b(p, m) takes the place of T_sat for activation and budgets.

### 8.3 Growth and condensation

dm_v/dt = h A (T_l − T_sat(p_v)) / (h_v(T_b) − h_l(T_l)), h = max(k_l √(3/(π α_l t_b)), (k_l/d)(2 + 0.6 Re^½ Pr^⅓)).
For sphere and disc the energy balance gives dr/dt = h ΔT/(ρ_v L) independent of r, so each substep grows the radius
by exactly ∫h dt · ΔT/(ρ_v L), with the Plesset–Zwick term integrated in closed form (with the area at the start of a
substep the growth was 12 % too slow). Substeps: at most the bubble's age (Δr/r ≲ ½), a quarter cell of motion, and
a substep that would carry an attached bubble past its departure diameter is cut exactly there. T_l is T_f for an
attached bubble, whose heat comes from the solid cell; for a free one the liquid of its footprint. In brine the vapour
in the bubble stays pure and saturated at its pressure, while the interface with the brine stands ΔT_b = T_b − T_sat
higher: growth is driven by T_l − T_sat(p_v) − ΔT_b.

### 8.4 Departure, motion, coalescence, bursting

Departure at the Fritz diameter D_d = 0.0208 θ √(σ/(g Δρ)) (θ in degrees per material). Motion: the pressure force in
momentum form, F_p = ρ_l V (Du/Dt + g) (the bubble's own perturbation of ∇p would otherwise slow it), weight, added
mass (C_A = ½, with the V̇ term; its shrinking part limited per substep), Tomiyama (1998) drag for contaminated water,
semi-implicit; the liquid velocity is sampled outside the bubble's footprint; drag and added-mass reactions go to the
liquid. Bubbles below 20 µm move with the liquid (their force balance is stiff and irrelevant). Bubbles that overlap
in 3D (depths included; discs overlap in the plane) merge, conserving mass, momentum and energy (the radius follows
the summed volume; the volume itself is derived from the summed masses at the next solve); a free bubble stays
free when it swallows a new one. At the free surface a bubble releases its species and enthalpy into the gas cells
above it — as many as its volume needs, weighted by gas volume — with a volume source; a bubble whose vapour
condenses away (collapse) gives the rest to the liquid of its footprint.

## 9. Interface and gas-phase change

- **Vapour diffusion** (implicit, Jacobi-PCG over the gas cells) with the interfaces as boundary values: Y_sat(T_s) on
  the liquid–gas face itself (not in the first gas cell), ṁ″ = ρ D (Y_sat − Y_1)/(Δx/2) with the Stefan factor
  (1 − Y); gas–wall: dew into the wall film when the gas is wetter than Y_sat(T_wall), and a film evaporates back while
  it lasts; open sides exchange with ambient air (escaped). Between gas cells vapour moves one way and the same mass of
  air the other way, each with the enthalpy of its donor cell.
- **Flash** (`flash.ts`): a surface cell whose liquid is above T_sat(p) — over brine T_b(p, m) — turns its excess
  sensible heat into vapour; the particles end exactly there (by their share), their salt stays. Particles in a cell
  that is not liquid (droplets below the cell size) flash the same way into their own cell; a droplet that would boil
  away completely vanishes (its salt goes to the crust, the cell takes the energy difference as heat). Before M2b a hot
  plate heated such droplets far past boiling.
- **Over brine** the vapour pressure is a_w p_sat(T): Y_sat at the surface face uses it, so the air over saturated
  brine settles at 75.3 % relative humidity (the humidity fixed point of Greenspan 1977).
- **Crystallisation** (`salt.ts`, after the interface stage): a particle above the solubility gives
  x = (s − w_sat m)/(1 − w_sat) to the crust of the nearest solid — a solid next to its cell (below first), else the
  first solid under it; over the bare box floor a store per column (energy kept, no heat exchange); through an open
  bottom it escapes. A particle that dries up (less than 10⁻³ of a particle's water left) gives its water to the gas
  and its salt to the crust. The crust does not dissolve again (SIMPLIFICATIONS.md #29).
- **Fog**: where p_H2O > p_sat(T), Δm condenses so that the remaining vapour is exactly saturated at the new temperature
  (H fixed, T rises by h_lv Δm/C) — an Illinois-bracketed secant search to 1e-13 relative; subsaturated cells
  evaporate fog the same way; cells clearly below saturation without fog are skipped.
- **Films**: a wall film above a threshold spawns a liquid particle that runs down.
- Every transfer carries the enthalpy of the store it leaves; the difference is latent heat of the cell (a source of
  the heat stage). Saturation from IAPWS-IF97 region 4 at the local absolute pressure.

## 10. Scenes and tools

A scene is a starting layout: box (w, h, depth), ambient (p, T, relative humidity, dry-air composition, g — all
adjustable while it runs; a new composition enters through open sides, the gas in the box keeps its own), sides,
quality, seed and an ordered list of operations — `fill` (liquid water, or gas of a composition), `erase`, `solid` (a
painted, static solid of cells), the **objects** `body` (a block of a region and material — an ice cube, wood, stone —
free unless `pinned`, turned by `angle` about the region's centre; M3a, §17), `beaker` (with an optional lid) and
`hotplate` (power or thermostat) — both pinned unless `"pinned": false`, turned by `angle` about the middle of their
base —, `move` and `remove`. Since 2026-10-23 every object has a name (`id`; `readScene` gives one where it is
missing — `body-1`, `beaker-1` — and renames a duplicate) and carries its own settings: `pinned`, `T`, `angle`,
material, size, lid, heater. Changing a setting changes the object where it stands in the list (`objects.ts`,
`editObject`); no operation is appended. `pinned` and the heater act at once, even while it runs (a released beaker
falls); material, temperature, size, angle and lid change the set-up: at time 0 the scene is rebuilt with the changed
object, later the engine refuses. `move` with an `id` moves that object together with what lies in its box (the
water and bubbles of a beaker, a painted solid in it, objects lying wholly inside it); `move` with a `region` moves
everything solid there (a painted solid by whole cells). `remove` takes an object away (booked). Both are operations
in the order, because what was painted later depends on where things stood. The old `pin` (pin or release the body
at a point) is still read. `fill` takes any liquid of the database (`H2O`, `oil-rapeseed`) with mass fractions; several immiscible liquids are
spread evenly by volume, each particle being one of them; `NaCl` dissolves in the water of the fill
(`{ "H2O": 0.9, "NaCl": 0.1 }` is 10 % brine; without water it is dropped with a warning). JSON, `format: "recreatio/lab2d"`, version 1, in m / °C /
kPa / W (`scene.ts`; unknown parts are dropped with a warning). Every tool is an operation appended to the scene, so
"save" writes the current layout with its seed, and a change of quality rebuilds the same layout at the new cell size.
Edits book the mass and energy they add or remove (the budgets close across tools).

## 11. Rendering, threading, React

The engine runs in a module Web Worker (`engine.worker.ts`): steps in time slices of 6 ms between frames, frames at
display rate, stats to the page five times a second. WebGL2 on an OffscreenCanvas in the worker; without it the
worker builds frame buffers and transfers them (a ring of two) to a WebGL2 canvas on the page. Each frame:

- the box ground; the liquid as a smooth surface: particle coverage splatted with B-splines on half cells, blurred
  ([1 2 1]/4) and cut at ½ in the shader with a thin darker edge (tinted by temperature in the temperature overlay,
  by the salt share in the salt overlay, M2b) — or, in the raw-particle view, the particles as points coloured by
  temperature (in the salt overlay by their salt share);
- salt crusts (M2b): solid cells blend toward the crystal's colour with the crust's thickness; salt on the bare box
  floor tints the lowest cell of its column;
- bubbles as circles at their true radius;
- a field texture, read linearly with premultiplied alpha: the continuous overlays (temperature, pressure,
  velocity, humidity, invisible vapour) and fog — white with Beer–Lambert opacity from its water content
  (SIMPLIFICATIONS.md #21), paler under the temperature, pressure and velocity overlays;
- a cell texture, read crisply: painted solids in their colour (glowing above 60 °C) and the phase map;
- bodies (exact rectangles, §17): every internal cell a rotated quad in its material's colour (a hot plate glows, a
  crust whitens; the overlay's colour in the temperature and phase overlays) and the outlines of the rectangles on
  top. Cells a body closes stay empty in the cell texture, and the liquid's coverage is continued under bodies (three
  layers, before the blur), so no light gap shows between the water and a body that stands between cells;
- in the velocity overlay, arrows on a grid of about 6 mm: gas (dark) and water (white), each scaled to its own
  largest speed (the legend gives both);
- the box walls (open sides stay open).

Water vapour itself is invisible; the "vapour" overlay shows it next to the fog. The React shell (since 2026-10-24
`Lab2D.tsx` → `LabApp.tsx` with the parts in `shell/`, §20) holds only settings and the stats; it draws the force arrows of the selected bubble, the overlay legend,
the HUD and notes as SVG/HTML over the canvas. The inspector asks the worker (`query`); a selected bubble is followed
through merges, and when it bursts or collapses its last state stays with a note saying what happened.

Since B every frame is drawn in two steps (`render/layers.ts`): the layers of the state — what is visible,
independent of the overlay and already at the precision a clip stores — and from them the frame of the chosen
overlay. Live, only the layers the overlay needs are sampled; a clip samples all. A clip played back therefore shows
exactly what the live view showed (§16).

The accelerated view (§15) swaps the worker: `gpu.worker.ts` steps and draws with WebGPU on its own OffscreenCanvas
and answers the same host messages, so the shell, the tools, the inspector and the charts stay as they are.

## 12. Tests

Vitest, headless in Node on the engine alone: `npm run test:lab2d` (87 tests, ~6 minutes) and
`npm run test:lab2d:slow` (tests 3, 4 over ten simulated minutes, 10, 11, 12, 34, 41 at 1 mm, 43 with enough salt).
MILESTONES.md records the numbers.

| # | Test | File |
|---|---|---|
| — | IF97 and SR1-86 check values, materials and sources, stores, scenes and fixture, painting, refusal, move, sealing, stages, determinism | m0.test.ts |
| 1 | Hydrostatics: 97.9 Pa/cm at 20 °C, 94.7 at 90 °C (±2 %), residual currents < 1 mm/s | m1b.test.ts |
| 2 | Conduction: a step in a solid slab matches erf within 2 % | m1a.test.ts |
| 3 | Heating rate: dT/dt = P/Σ(m c_p) within 5 % (sealed, insulated) | m1b.slow.test.ts |
| 4 | Conservation: sealed box 10 min, energy within 0.5 % of ∫P dt, water exact; open box closes | m1a.test.ts, m1b.test.ts, m1b.slow.test.ts |
| 5 | Thermal expansion 20 → 90 °C: level +3.4 % (±0.3 %) | m1b.test.ts |
| 6 | Saturation (IF97) and its hydrostatic shift from the engine's own pressure | m1c.test.ts |
| 7 | Bubble growth: 1.20 mm after 10 ms at 5 K superheat (Plesset–Zwick, ±5 %) | m1c.test.ts |
| 8 | Departure: 2.34 mm at 45° (Fritz, ±5 %) | m1c.test.ts |
| 9 | Rise velocity: 0.25 m/s at 3 mm, 0.23 at 5 mm (±10 %) | m1c.test.ts |
| 10 | Subcooled boiling: early bubbles collapse, later reach the surface | m1c.slow.test.ts |
| 11 | Boiling plateau within 0.5 K of T_sat; vapour = (P − losses)/h_lv within 5 % | m1c.slow.test.ts |
| 12 | Superheating: ≤ 1 K with chips, ≥ ΔT_act of the largest glass cavity without | m1c.slow.test.ts |
| 13 | Evaporation = ρ D ΔY/L within 5 % | m1c.test.ts |
| 14 | Fog only where supersaturated, exactly saturated after, water exact | m1c.test.ts |
| 15 | Sealed box: p0 rises by p0 ΔT/T (±1 %) | m1a.test.ts |
| 16 | Performance: ms per stage (HUD, test output, `npm run bench:lab2d`); ≤ 12 ms per frame at the default resolution | m1a.test.ts |
| 18 | Two layers at rest: dp/dy = ρ_oil g and ρ_w g (±2 %), currents < 1 mm/s | m2a.test.ts |
| 19 | Oil poured under water ends on top, interface from the volumes (±1 cell) | m2a.test.ts |
| 20 | Viscosity: one implicit step damps a shear mode by its exact discrete factor (±1 %); water alone solves none | m2a.test.ts |
| 21 | Oil 140 → 150 °C: no bubbles, no vapour, dT/dt = P/(m c_p) (±2 %), energy and oil mass close | m2a.test.ts |
| 22 | Water boiling under oil: bubbles cross the oil and burst; oil, water and energy budgets close | m2a.test.ts |
| 23 | NaCl against its sources: density at 10 and 20 % (±0.3 %), φ at 25 and 100 °C (±0.5 %), boiling point at 1 and 3 mol/kg (±0.1 K), freezing point at 1 and 3 mol/kg (±0.1 K, Bodnar 1993), a_w of saturated brine (±0.3 % RH, Greenspan 1977), c_p and Δh (±0.5 %), enthalpy closure, fill and JSON | m2b.test.ts |
| 24 | Brine under water at rest: dp/dy = ρ_brine g and ρ_w g (±2 %), the layers stay, salt exact | m2b.test.ts |
| 25 | The air over saturated brine in a sealed box settles at 75.3 % RH (±0.5 %) | m2b.test.ts |
| 26 | Brine boiling: bubbles nucleate and burst, the brine gets saltier, salt exact, water and energy close | m2b.test.ts |
| 27 | Brine boiled dry: no particle left, the crust holds all the salt (exact), energy closes | m2b.test.ts |
| 28 | Heat inside a cell: a 2 K difference between a cell's particles decays at π² α/Δx² (±1 %), energy exact | m2b.test.ts |
| 29 | Salt inside a cell: 10 % brine beside fresh water evens out at π² D/Δx² at 20 and 80 °C (±1 %), salt and energy exact | m2b.test.ts |
| 30 | Salt between cells: a cosine across 2 cm decays at the discrete Fick rate (±1 %; the continuum's D k² within 4 %), salt exact | m2b.test.ts |
| 35 | Stirring: under an imposed pure strain λ the in-cell differences of salt decay at (π² D/Δx²)·x/W(x), x = 2(λ − 0.02/s)τ (±1 %); below 0.02/s at the molecular rate; heat at its still rate for every λ | m2b.test.ts |
| 31 | Playback: every frame of a clip draws the same pixels as the live view did while baking (without overlay every frame, with each overlay every third frame) | b.test.ts |
| 32 | Seeking: frames read in any order equal frames read in sequence; time t is frame floor(30 t) | b.test.ts |
| 33 | Going on from a keyframe: the whole state equals the run that never stopped (boiling, brine to a crust, water under oil, a sealed box with fog, moving bodies with contacts, melting ice); from a clip's keyframe the frames equal the clip | b.test.ts |
| 34 | Size: a minute of the boiling beaker at 2 mm stays under 40 MB (measured 36.0) | b.slow.test.ts |
| 36 | Floating: pine and ice float with ρ_b/ρ_l of their height under water (±2 %, mean over 3 s); budgets exact | m3a.test.ts |
| 37 | Sinking: a 2 cm ceramic square reaches the drag law's terminal speed (C_D = 2.1 of a square cylinder, ±15 %) before its wake turns it over; a stone block lands and rests without jitter, asleep | m3a.test.ts |
| 38 | Stacking: a block dropped onto another lands flat on it and both stand still, asleep | m3a.test.ts |
| 39 | Tipping: a glass beaker of water released 3° below its geometric tipping angle falls back, 3° above it falls over; no water lost | m3a.test.ts |
| 40 | Budgets with moving solids: a hot stone sinks and a warm block floats in cold water — energy, water and air exact | m3a.test.ts |
| — | Scene format of bodies (body, pin, pinned, angle round-trip; free bodies need the CPU; a circle becomes the square of its area, a line with a width a rotated rectangle); objects: names given and made unique, settings changed in place (pinned at any time, the set-up at the start), move and remove by name with budgets exact | m3a.test.ts |
| 41 | Stefan: melting under water at 20 °C and freezing on ice at −20 °C follow the Neumann solution (2 mm: front speed ±5 %, position ±10 %; 1 mm: ±5 %) | m3b.test.ts, m3b.slow.test.ts |
| 42 | Ice cube in warm water: one rectangle, never warmer than its melting point, the lost ice is water in the particles; energy and water exact | m3b.test.ts |
| 43 | Ice in brine settles at T_f(w) of the diluted brine (±0.2 K); in 25 % brine a cooling mixture below −18 °C whose coldest particle never passes the eutectic (by more than 0.05 K) | m3b.test.ts, m3b.slow.test.ts |
| 44 | Freezing brine keeps all its salt: the ice grows, the brine gets saltier, salt exact | m3b.test.ts |
| 45 | A carved ice block melts as a few rectangles that neither overlap nor fall apart; budgets exact | m3b.test.ts |
| 46 | The side the heat comes through melts: an ice block on a warm plate melts from below and stays on the plate; budgets exact | m3b.test.ts |
| 47 | Violent boiling: water at 95 °C poured onto steel at 140 °C for 300 steps — the critical heat flux is 1.26 MW/m²; computed: every value finite, the 20 m/s guard never acts, the step never collapses, budgets exact; softened: no bubble above 4 mm, water held at 1.5 m/s, the water stays, budgets exact | ext.test.ts |
| 48 | Asking: one event when a bubble passes 6 mm or water 2 m/s, handed over once; the answer is stored in the scene and nothing is asked again | ext.test.ts |
| 17 | GPU equivalence on tests 1–3, 6, 11 | browser harness in headless Edge (Node has no WebGPU) and in Firefox (a visible window: headless Firefox gets no WebGPU adapter); numbers in MILESTONES.md (M1e) |

The browser side (tools, overlays, inspector, bubble view, charts, scenes, phone layout) was walked through in
headless Edge against a bundle of the shell; the results are in MILESTONES.md (M1d); baking, playback, seeking, going
live, the clip cache, baking on opening and the scenarios likewise (MILESTONES.md §B); the full-screen surface of
2026-10-24 — card, layer, phases, tools, settings, bake dialog, the question, the page's whole window, the phone —
likewise (MILESTONES.md, "Violent events and the full-screen surface").

## 13. Performance

`npm run bench:lab2d` runs the benchmark scene (the boiling beaker with chips, 98 °C water, 20 × 15 cm) headless and
prints ms per stage, CG iterations and gas substeps. Budget per 60 Hz frame: 12 ms, i.e. 6 ms per step. Numbers and
their history: MILESTONES.md. Where the time goes at 2 mm: the gas stage (transport in ~4 substeps and a projection
of ~11 MGPCG iterations — thin beaker walls make coarse cells straddle two gas regions, which slows the V-cycle), the
vapour diffusion, the heat solve, the liquid, the bubbles. On the GPU (accelerated view, §15; RTX 3070 laptop) the
benchmark scene takes 4.9 ms per step at 2 mm and 7.7 ms at 1 mm, the gas stage again the largest.

## 14. Designed for, not built

Chemistry (M2: species and reactions as a graph, each cell a well-mixed reactor, stiff implicit kinetics, gas from a
liquid becomes bubbles, gas in the gas phase a divergence source); melting and grains (M3b, M3c — rigid bodies are
built, §17); energetic reactions (M4: an explicit sub-model for
the Coulomb explosion of sodium; hydrogen ignition needs a compressible solver); zero gravity (surface tension on the
resolved surface); a molecule lens (read-only Lennard-Jones view).
Nothing in M1 blocks them: six species slots on cells and bubbles, two composition slots on particles, the object
store, the chemistry hook in the loop.

The plan for the next steps — several liquids (oil), bodies that fall, float and tip, melting and freezing, salt in
solution and as grains, and baked clips — is [SANDBOX.md](SANDBOX.md) (2026-10-21, a design before the code; M2a,
M2b, B and M3a are built). It replaces the M3 sketch above: melting there is an interface process at the solution's freezing
point, not a volume enthalpy rule. Still open from M2b: the crust does not dissolve (grains and dissolution are M3c),
only NaCl, one diffusion coefficient for all concentrations.

## 15. The GPU path (M1e): the accelerated view

The button "Widok przyspieszony" (shown where the browser has WebGPU) restarts the lab in a second worker,
`gpu.worker.ts`, that runs the whole step on the GPU — at 1 mm, or at the saved quality — and draws with WebGPU;
"Widok zwykły" returns to the CPU worker with the same scene. If the device or a kernel fails, the shell falls back
to the CPU worker with a note; a scene with a liquid other than water, with dissolved salt or with a salt crust goes
back to the CPU worker the same way, with its tools applied (M2a and M2b are not ported yet; nor are the M2b changes
for droplets below the cell size and for cells without water particles, §7, §9). The sharing of heat inside a cell
(§6.5) is ported: kernel `heatShare`, one thread per cell over its sorted particles, after the heat solve. The view is not bit-reproducible (float atomics, order-free merging): the prompt's
determinism stays a property of the CPU engine. Checked in two WebGPU implementations: Edge/Chrome (Dawn) and Firefox
(wgpu). They schedule workgroups differently, so a kernel whose result depends on that order works in one and fails
in the other (§15, solves). Checked on 2026-10-21 by running every kernel with its workgroups in reverse order
(MILESTONES.md, M1e).

- **State**: every field lives on the GPU in field-major buffers (cell fields, face fields, atomic accumulators),
  particles and bubbles as records; a CPU `Engine` in the worker mirrors the scene. Every tool runs on the CPU: the
  worker downloads the GPU state into the mirror, applies the operation there and uploads the result
  (`GpuState.download`/`upload`), so the tools use the CPU code unchanged and their bookkeeping stays exact. The
  inspector and saving download as well.
- **Step**: the eight stages as compute passes in the CPU's order. Particles are sorted by cell twice per step (a
  counting sort); every particle→grid transfer is a gather over the sorted particles, so P2G needs no float atomics.
  Bubbles: one thread per bubble with its own substeps (identical to the CPU per bubble); merging chains each bubble to
  the lowest-numbered bubble it touches (positions from the start of the merge); per-cell heat budgets are shared by
  atomics without priority.
- **Solves**: MGPCG for the liquid and gas pressure and — unlike the CPU's Jacobi-PCG — also for heat and vapour
  diffusion. Coarse levels are built geometrically on the GPU; red-black smoothing runs in shared-memory tiles
  (pre-smoothing fused with the restriction, prolongation with post-smoothing), the coarse tail of the V-cycle in one
  workgroup. A tile reads a border of cells that belong to its neighbours, so no field a tile reads may be written in
  the same dispatch: pre-smoothing starts every level at x = 0 and writes the smoothed x to a field of its own (`xp`);
  post-smoothing reads `xp` and the coarse x and writes x. (With x read and written in place, the result depended on
  the order in which the GPU ran the tiles: in Firefox the solver did not converge at all and the water tore along the
  tile edges; Edge happened to schedule it harmlessly.) Pure-Neumann gas components are found by union-find
  (atomicMin) and projected every iteration. The CG scalars are per-workgroup partial sums folded by one workgroup (no
  contended float atomics).
- **No round trips inside a step**: iteration counts are recorded ahead from the last readbacks (×1.5 + 2 when a solve
  hit its cap); iterations after convergence return at once. The gas transport records all 16 substeps and the GPU
  decides each step how many of them work — a count taken from the readbacks came too late for a sudden splash, and a
  smaller Δt did not help because the gas source grows with 1/Δt. Indirect dispatches are avoided (Chrome validates
  each one with an extra pass, ~30 µs).
- **Readbacks**: a few times per second the worker reads counters, interval sums (energy and water flows, phase change,
  bubble events), regions, heaters and the watched bubble, and keeps f64 totals; each readback carries the layout it was
  recorded with, and one that is still in flight when the state is rebuilt is discarded. Budgets on the GPU are f32:
  energy errors of 1e-5–4e-4 of the energy turned over (the sealed box the most) instead of the CPU's 1e-9
  (MILESTONES.md).
- **Frames**: up to eight steps per frame, at most three frames in flight; compute kernels build the field and cell
  textures and the liquid coverage, render pipelines draw them, the bubbles from the bubble buffer and the particles
  from the particle buffer — nothing is copied to the CPU per frame.

## 16. Clips: baking and playback (B)

A scene can be **baked**: the worker computes it from its start as fast as the machine allows, without drawing (a
preview every 0.3 s and a progress bar), records it and keeps the clip in the browser. A clip **plays back** without
computing — smoothly also on a weak computer or a phone — with a timeline, 0.25–4× speed, loop and every overlay, and
**"Na żywo od tej chwili"** continues live from the frame on screen. Clips stay in the browser (the user's decision,
SANDBOX.md §9): no files, nothing attached to pages.

**Starting.** The lab never starts by itself: it shows the scene's start and waits — "Uruchom" runs it live,
"Upiecz…" opens the bake dialog (§20: 10, 30, 60, 120 or 300 s of simulated time, a frame every 67, 33 or 17 ms,
resume points every 1, 5 or 10 s, the resolution and how violent events are computed — never "ask" while baking), and
when this browser already holds a clip of the scene, "Nagranie … s" plays it. A module may bake on opening (`start: "bake"` in its configuration, set in the
editor as "Po otwarciu"); a clip already baked then plays at once. `seconds` sets the length, `scenarios` adds
further scenes to choose from (a picker above the text; each scenario has its own clip and, with `start: "bake"`,
bakes when chosen). Restart and choosing a scenario also come back paused.

**The clip** (`recreatio/lab2d-clip`, version 2 — version 1 clips, without the bodies' quads, still play; `clip/clip.ts`):

- *Header*: the scene (canonical JSON with quality, seed, the mode of violent events and every operation), the grid,
  the frames per second of simulated time (30 by default; 15 or 60 as chosen when baking — the timeline steps by
  them), the sizes of the chunks, the keyframes, the chart samples (every 0.25 s) and the layout of the engine
  that baked it.
- *Frames*: the layers of each frame (`render/layers.ts`) — per cell the kind and material, salt crust, the glow of
  hot solids, fog opacity, the temperature (0.5 K), gas pressure and speed (8 bit on a fixed quadratic scale, so a
  value changes only where it changes, not when the frame's maximum moves), humidity (64 steps) and vapour; the liquid
  on half cells (coverage, temperature, oil and salt share); the velocity at the arrow points (8 bit, quadratic);
  bubbles (position, radius in µm, air share, 16 bit each). Two seconds make a chunk; each layer is stored as the
  byte-wise difference to the previous frame (what does not change becomes zero), the chunk ordered by layer (all
  temperatures, then all pressures …: a quarter smaller than frame by frame) and packed with the browser's deflate
  (`CompressionStream`; `clip/codec.ts`). What the frame without overlay needs is stored in every frame; what only the
  gas overlays show (temperature, pressure, speed, humidity, vapour, bubbles in the phase map, arrows) in every third,
  and playback holds it in between — that halves a clip. Lossless: playback composes the very layers that were baked.
- *Keyframes*: the whole engine state every 5 s (or 1 or 10 s, as chosen; `clip/snapshot.ts`). Instead of a list per module a walk through the
  object graph of the engine and its chart sampler takes every number, string and typed array in field order — each
  object once (the modules share arrays), plain data objects as one value (so null ↔ object does not change the
  structure), getters left out; per-particle and per-bubble arrays only up to the count. Left out is scratch: arrays
  rewritten in every step before anyone reads them — measured, not guessed: an array filled with nonsense (NaN, or a
  large integer) that leaves the run of four scenes (boiling, brine to a crust, oil, a sealed box with fog) unchanged
  after 60 steps; what the frame reads stays in (the water's velocity for its arrows). Every entry carries its path;
  restoring writes by path into an engine freshly built from the clip's scene (an array still missing there is
  created). The set of paths is the layout: a clip baked by an engine with another layout plays back but cannot be
  continued live.
- *Going live* loads the keyframe before the frame on screen into a fresh engine and computes on to that frame (in
  slices, with progress) — the CPU engine is deterministic, so the state is bit for bit the state the frame was baked
  from (test 33).

**The store** (`clip/store.ts`): IndexedDB `recreatio-lab2d` — headers in `clips`, packed chunks in `chunks`, keyframes
in `keys`, so playback fetches only what it needs (the chunk on screen and the next; three chunks in memory). The key
of a clip is SHA-256 over the format and the canonical scene: the same scene in the same quality finds its clip again
— also after an edit is undone, never for a changed scene. The frame rate and the keyframe spacing are not part of
the key: baking the same scene again with other ones replaces its clip. More than 16 clips or 600 MB: the least recently played go
first. Without IndexedDB (a private window) the clip lives as long as the lab is open.

**In the worker** (`clip/session.ts`): three states. *Live*: as before. *Baking*: the engine is rebuilt from the scene
as it is now laid out (with the user's edits) and the baker steps in slices of 30 ms, so messages get through; each
frame is captured when the simulated time reaches it (layers sampled in full, a keyframe every 5 s); chunks are packed
alongside. Stopping keeps what is recorded as a shorter clip. *Playback*: nothing computes; the clock advances with the
display, the frame on screen is composed from its layers (redrawn only when the frame, the overlay or the size
changes). Tools act only live; in playback a note points to "Na żywo od tej chwili".

**Sizes and speed** (MILESTONES.md §B): the boiling beaker at 2 mm — 11.6 kB per frame and 980 kB per keyframe, 33.6 MB
per simulated minute (34.0 MB since M3a: the grid's body arrays); baking it runs at 0.13× real time on the reference laptop (a minute in about eight minutes),
calmer scenes several times faster (convection: 0.43×). Baking runs on the CPU only; the accelerated view neither bakes
nor plays clips (its button is off while a clip plays or bakes).

## 17. Bodies (M3a; exact rectangles since 2026-10-23)

Every object is a whole (SANDBOX.md §6): a beaker, a hot plate, a block, an ice cube. Files: `body.ts` (one body),
`bodyCover.ts` (into the grid and back), `geom.ts` (exact clipping, recomposition), `bodyForces.ts` (pressure and added
mass), `bodyContacts.ts` (contacts), `bodyTools.ts` (erase, move, split), `bodies.ts` (the set: creation, the two step
stages), `bodyMelt.ts` (melting and freezing, §18), `gpu/staircase.ts` (bodies on the accelerated view).

**A body** is one or a few axis-aligned rectangles in its own frame, exact in metres, not rounded to the grid: a beaker
three (a bottom and two walls standing on it; four with a lid), everything else one; one material. The frame's origin
is the centre of mass; a world point L of the frame is at (x, y) + R(a)·L. Inside each rectangle lie internal cells of
about Δx, laid exactly into it (column and row boundaries `xs`, `ys` — a melting side thins its outer row), each with
energy (J, with its water film at h_l(T) and its salt crust), film and crust (kg). Derived (`derive`): mass, centre
(the frame moves into it, so nothing jumps), inertia, the convex hull's area and second moment, the farthest corner and
the **free segments** — the parts of each rectangle's sides that touch no other rectangle of the body (closer than
10⁻⁶ Δx counts as joined). A circle region becomes the square of the same area (with a warning), a polygon its bounding
rectangle, a line with a width a rotated rectangle. Erasing cuts the box the region spans in the body's frame out of
each rectangle (up to four remain: left, right, below, above); what falls apart becomes separate bodies (`separate`,
energies by area). Everything is numbers and typed arrays: keyframes take bodies as they are.

**States.** Pinned: infinite mass, never moves. Free and asleep: stands in the grid like any solid (its fractions
frozen). Free and awake: it is written into the grid every step. Beakers and plates are pinned unless the scene says
otherwise; free bodies settle for a moment after loading and fall asleep after half a second of touching something at
under 2 mm/s. A sleeping body wakes when an awake one touches it at more than 1 cm/s, when a tool changes the scene,
when the fluid lifts it with more than 1.02 times its weight, or when it melts or grows.

**Into the grid** (`bodyCover.ts`, at the start of the step for awake bodies, and after any change):

- *Weights*: each internal cell's share of every grid cell it overlaps, by exact clipping of the rotated quad against
  the square (Sutherland–Hodgman, `geom.quadInBox`); a grid cell a rectangle cuts into two separate parts (it meets the
  cell's border in two arcs, `geom.splitsCell`) is marked.
- *Cells*: `fs` = the covered share (all bodies), `capB` = Σ w C_k, `Es` = Σ w E_k (film and crust likewise), `owner`
  and `matB` the body with the largest share. A cell is **closed** (kind solid) if fs ≥ 0.99, if it is cut in two, or if
  fs ≥ ½ next to solid that is not the same body — a box side, a painted solid, another body's closed or half-covered
  cell (an unresolved gap: a block landing on the floor squeezes the water out instead of leaving an empty liquid cell
  under it). Cells that close give their gas to the free cells around (through open faces first: a thin wall passes no
  gas); cells that open become liquid without gas next to them, else gas taken from their neighbours.
- *Faces*: per u and v face the share the rectangles cover (exact segment clipping) gives the open fraction
  α = 1 − share (`au`, `av`), the covered part's velocity (`usol`, `vsol`) and the body covering most (`faceOwner`);
  when a face closes or opens, the regions are relabelled.
- *Projections*: the liquid's pressure solve and divergence weight every face by α and take the covered part's
  velocity as known — the cut cells of Batty, Bertails & Bridson 2007 (the solid part of a face moves with the body);
  the gas likewise (fluxes and projection × α, gas volume (1 − fs − φ − α_b) V); regions connect through open faces and
  count V_fluid = Σ (1 − fs) V; vapour and salt diffuse × α.
- *Thin walls*: a face a body covers whole between two cells that are both open (a 2 mm beaker wall lying across two
  2 mm cells — the presets' beakers at 2 mm) separates them for everything that looks at neighbours. Particles put no
  weight into a cell behind such a face (`grid.updateThin` marks them per cell; `cutWeights` gives their share to the
  rest of the 3 × 3 cells; diagonally when both ways round are cut), and evaporation, flash boiling and the test
  whether a cell borders gas look only through open faces. Without it the water inside a beaker also stood in the cell
  outside its wall and evaporated there (test 11 boiled 3.9 K below T_sat), and particles beside a floating ice block
  reached into cells it almost covers, behind faces it covers whole (single particles 0.1 K below the eutectic).
- *Heat* (§6.5): the body's share is a part of the cell (capB, Es, Ts); at the end of the step each cell's change goes
  back to the internal cells — energy by w C_k/capB, film and crust by weight or by what each gave. Nothing is created
  or lost (test 40).
- *Particles and bubbles* inside a rectangle after a move go back along their path in the body's frame to just before
  the side they entered (Liang–Barsky on the rectangles; already deep inside: the nearest side), their velocity into the
  body removed; the liquid's own transport does the same (`hit`).
- Then φ_s (the covered shares smoothed like solid cells), the distance field, the regions (−p0·V of sealed regions
  jumps: booked as `flows.bodyWork`) and the cavities are refreshed in the box of what changed. Cavities sit on the free
  segments in the body's frame (one draw per piece of about Δx) and move with it; they are drawn anew only when cells
  flip or the body's sides change their structure (a melting side just moves its cavities along).

**Forces** (`bodyForces.ts`): the pressure of both projections is continued into the solid cells as before; it is
integrated over the free segments in pieces of at most ½ Δx, each reading the fluid in front of it at its own height
(hydrostatic correction), the larger of liquid and gas at a waterline, a piece resting on solid the continued pressure.
The gas side uses the p0 the liquid saw at its surface at the start of the step: in a sealed region p0 changes within
the step, and mixing the two gave a floating body a spurious net force that grew into an oscillation (a block floating
in a closed box flew out of it). In water at rest this is the buoyancy of the submerged part, continuous in the
position — a floating body no longer bobs by rows of cells (test 36: 0.06 mm instead of ±1.4 mm).

**Coupling** (partitioned): as before — the projections of step n see V^n, their pressure gives F^n; the added mass is
measured after every liquid projection with three more solves on the faces the body covers (`faceOwner`, weighted by
the covered share): (M + M_a)(V_free − V^n) = Δt (m g + F^n) + M_a D^{n−1}.

**Contacts** (`bodyContacts.ts`): each rectangle is a box part of the physics lab's solver (separating axes, clipped
manifolds, two-point block solver, warm starting, Coulomb friction; slop 0.1 Δx, speculative gap Δx). Static: closed
box sides, painted solids (cells of one material merged into rectangles), pinned and sleeping bodies. When a body melts
or grows, its parts take the new rectangles in place and keep their warm start.

**Order in the step**: bodies part 1 (into the grid) at the start; liquid … heat as before; the diagnostics; bodies
part 2 (collect, melting and freezing, forces, velocities, contacts, positions, sleep) as stage 9. dt is limited so
that no point of an awake body moves more than half a cell per step. A body leaving the box through an open side is
booked as escaped (energy, film water, crust salt; ice as water).

**Tools and format**: objects with names and settings (§10). In the shell, "Przedmioty" adds an ice cube, a block
of wood, stone, glass or steel, a beaker or a hot plate (a click: the usual size; a dragged rectangle: position and
size; a click on an existing object selects it instead); "Wybierz" selects an object (its outline is drawn from the
worker's `ObjectView`, sent with the statistics) and drags it (`move` with its `id`, by the exact offset); the panel
"Przedmiot" shows its settings — "Przypięty", material, temperature, size, angle, lid, heater — and removes it
(`ObjectPanel.tsx`). Erasing or painting over a body cuts its rectangles (booked; ice counts as water) and may split
it; the pieces keep the object's name. The inspector shows the body under the cursor.

**Drawing** (§11): each internal cell as a rotated quad, the rectangles' outlines on top; cells a body closes stay
empty in the cell texture.

**The accelerated view** (`gpu/staircase.ts`) knows no fractions: on upload every cell a pinned body covers by more than
half, or that the CPU closed, becomes a solid cell there (where a face lies wholly inside a body and neither of its
cells qualifies, the one with the larger share — a thin wall on the boundary of two cells stays tight without doubling)
with the body's temperature (energy from the whole cell's capacity, as the kernels compute), material and heater group;
φ_s, the distance field, the regions' fluid volume and the cavities' wall cells follow the staircase, and the gas of a
cell that turns solid there stays in it. On download the staircase cells give their temperatures back to the bodies
(their share's energy, then `collect`). In the presets the beaker and the plate lie exactly on the 1 mm cells, so the
staircase is the body. A free body or ice sends the scene back to the CPU (`needsCpu`).

## 18. Melting and freezing (M3b)

`bodyMelt.ts`, after the bodies' energies are collected and before the forces (stage 9), for every body of a meltable
material (ice, `meltsAt`):

- **Energy.** Internal cells carry sensible energy c_p (T − 0 °C) (with film and crust); a meltable body adds the
  latent offset m·e0, e0 = h_l(T_m) − c_p,ice (T_m − 0 °C) − Δh_fus (IAPWS R10-06: Δh_fus = 333.55 kJ/kg at
  T_m = 273.1525 K), so ice at T_f turns into water at T_f with exactly the latent heat. The water budget counts the
  ice (`WaterByState.ice`); placing, erasing and losing ice are booked as water.
- **The interface.** Every side with a free segment gets T_f from the liquid in front of it — the salt and water of the
  cells just outside and one cell further (the thin fluid part of a mixed cell often holds no particle), `freezingPoint`
  of their molality; no liquid: pure water. A side is *open* when fluid lies in front of it; a side against a wall, a
  painted solid or another body is not.
- **Melting — the side the heat comes through.** Every side also gets its *supply*: Σ k (T − T_f)⁺ · length over the
  cells just in front (`meltSides.supplyAt`) — water, air, or a solid such as a hot plate or the wall of a warm beaker
  (outside the box: nothing). An edge cell warmer than T_f gives its excess E − E(T_f) to its adjacent free sides that
  have a supply, shared by it (a corner cell between water and air gives almost all to the water side); a cell with no
  such side, and a cell inside, gives it to the nearest open side of its rectangle (no open side: the nearest free
  side). So one or several sides melt at once, each as a whole, and a block lying on a warm plate melts from below and
  sinks onto it (before 2026-10-23 the plate's heat went to the nearest open side: such a block got narrower, not
  flatter). The ice is never warmer than where it melts; a cell inside gives its heat at once (the conduction to the
  surface is instant, the end state right). A side's excess Q moves it inward by
  δ = Q/(ρ D Σ_k s_k [L(T_f) + c_p (T_f − T_k)]) over its edge cells k (free length s_k). The slice's energy, film and
  crust, the offset of its mass and Q become meltwater: added to the water particles in the cells just in front by
  their mass (one cell further only if those hold none; a particle above twice the nominal mass splits), else held per
  body and spawned as a particle in front of the side — or at the nearest free spot within three cells (beside a block
  on a plate) — once it reaches a quarter of the nominal mass.
- **Freezing.** Water in front of a side colder than T_f freezes m = C_l (T_f − T_l)/L, at most half of a particle's
  water per step; it leaves with the enthalpy of ice (the particles keep the latent heat and warm up), its salt stays.
  Planned first, taken after the side moved: exactly the mass the body grew by. The new slice is ice at T_f; particles
  and bubbles it covers are pushed out.
- **One rectangle**: the sides move directly (`moveSide`); the outer rows thin or thicken; a row thinner than 0.3 Δx
  merges into its neighbour and one thicker than 1.6 Δx splits (area-weighted regridding); a rectangle thinner than
  0.05 Δx melts completely, film and crust included.
- **Several rectangles** (a carved block, an ice beaker): the moves become slabs along the free segments — inside for
  melting, outside for growth — and the body is recomposed (`geom.recompose`): the old rectangles minus the melt slabs
  plus the growth slabs, on the grid of all their coordinates, read as horizontal runs per row with equal runs above
  each other merged — the shape is decomposed the same way every time and stays a few rectangles. Sides of different
  rectangles on one straight line that meet end to end are one wall and move by one depth (otherwise steps and slivers
  appeared, and removing a sliver split the body); at a convex corner a growth slab follows the neighbouring side's
  move, at an inner corner a melt slab reaches as far as the other wall recedes (no ridge stays in the corner). The
  removed area takes its energy from the old cells by area, the added area gets ice at T_f, the internal cells are
  regridded by area; if the rectangles fall apart, each further group becomes its own body.
- **Afterwards**: derive, new weights, the contact parts in place; the body wakes (lighter, it rises or sinks);
  cavities are drawn anew only if the side structure changed.

Energy and water close to rounding (tests 41–45); salt never enters the ice (test 44). The fronts of the Stefan problem
follow Neumann within 6 % at 2 mm and 4 % at 1 mm (melting, after 4 min; its speed from 2 to 4 min within 1.5 %), and
within 7 % and 3 % (freezing, after 2 min). The interface lives in cells — first order in Δx: in the first seconds,
while the thermal layer is thinner than a cell, melting runs ahead and freezing lags (SIMPLIFICATIONS.md #31, #40;
MILESTONES.md §M3b).

## 19. Violent events (since 2026-10-24)

Water poured onto a very hot plate, superheated water in a smooth beaker that finally nucleates (bumping), many
bubbles merging into one: before 2026-10-24 such scenes ended in a giant vapour bubble that pushed the water out of
the box, or in NaN within ten steps. Water at 95 °C on steel at 140 °C traced the chain (`ext.test.ts`; the diagnostic
runs are in MILESTONES.md):

1. An attached bubble took the whole stored superheat of its wall cell in one step — 8.6 cm³ of vapour in 27 ms.
2. The reaction force of a bubble larger than a cell (drag and added mass, Delnoij et al. 1997) went onto the 3 × 3
   faces at its centre, where the liquid has already made room. The explicit Du/Dt of the added mass then fed back:
   the liquid's acceleration in one step became a larger opposite one in the next (0.4 N → 10⁵ N in six steps).
3. The drift correction ran at DRIFT_GAIN·err/Δt and a particle's volume jump at ΔV/Δt: the faster the flow, the
   shorter the step, the larger both sources — the step fell to 0.1 µs and the water ran at 5000 m/s.
4. Bubbles followed the projection's pressure without inertia; its short dips below zero absolute let a bubble grow
   from 55 to 2000 cm³ in one step, and the boiling point of the cells dropped with it.

What changed for every scene (each a numerical guard; SIMPLIFICATIONS.md #42–#45):

- **Critical heat flux.** A bubble on a wall gets at most what the boiling curve lets through the wall:
  q″_max = 0.149 ρ_v^½ h_lv [σ g (ρ_l − ρ_v)]^¼ (Lienhard & Dhir 1973; 1.26 MW/m² at 1 atm and 1 g) on the wetted face
  of the wall cell, per step (`extremes.ts`, `wallLeft`/`takeWall`). Heat the wall keeps stays there and conducts.
- **The ring.** The reaction force of a bubble larger than a cell spreads over the faces in the ring r…R around it,
  R = max(1.5 r, r + 2Δx), weighted by the liquid share of the two cells (`bubbleMotion.spreadRing`). The ring holds at
  least 1.25 πr²D ρ — more than the added mass ½ πr²D ρ, so the feedback factor stays below 0.4. Smaller bubbles keep
  the B-spline stencil.
- **No faster than DRIFT_DT.** The drift correction and a particle's volume jump are spread over at least
  DRIFT_DT = 0.5 ms (`liquid.ts`); what is not corrected in this step stays an overfill that the drift corrects next.
  At ordinary steps (≥ 0.5 ms) nothing changes.
- **The void fraction stops at the open part of a cell** (`updateAlpha`): beyond it no flow could make room, and
  the error would never close.
- **Pressure floor.** The pressure a bubble sees and the boiling point of a cell use at least half the ambient
  pressure.
- **A guard**: no particle faster than 20 m/s (water in a lab box reaches a few m/s; the guard did not act in test 47).

Two bugs went with it: a free bubble booked the enthalpy change of its re-solved state into every cell of its
footprint — also into cells a big bubble had emptied, which have no heat capacity, so the heat was lost (now only
cells with liquid; without one the bubble keeps it); and two bubbles that merged kept the volume of one until the next
solve.

**The modes** (`scene.extremes`, the setting "Gwałtowne zjawiska"):

| Mode | What it does |
|---|---|
| `ask` (default) | computed like `compute`; when a bubble passes 6 mm or water 2 m/s, the worker pauses and posts `extreme`; the surface asks "Licz dokładnie" or "Łagodź", the answer is stored in the scene (`setExtremes`); asked once per scene |
| `compute` | nothing more: superheated water may boil explosively and throw water out of the vessel, as it does in reality |
| `normalize` | walls give bubbles at most a tenth of the critical heat flux; every cavity nucleates by 2 K of superheat (no bumping); what a bubble has beyond 4 mm radius goes to the gas above the surface as if that part burst there; water is held below 1.5 m/s |

Mass and energy stay exact in every mode (the kinetic energy of the liquid is not in the energy budget, so the brake
does not change it). Stats carry the mode, a pending event, the largest bubble, the fastest particle and what was
softened. Water at 95 °C on steel at 140 °C (test 47, 300 steps at 2 mm): computed, the largest bubble reaches 26 mm,
the fastest particle 9.7 m/s, the shortest step 0.19 ms, and half the water is thrown out of the open box; softened,
no bubble passes 4 mm, the fastest particle 1.1 m/s, the step stays above 1.7 ms and 99.7 % of the water stays.
Baking never asks: the bake dialog chooses `compute` or `normalize`. The accelerated view carries the mode (§15).

## 20. The full-screen surface (since 2026-10-24)

The lab runs only full screen. On a page a card shows the title, the first sentence of the task and "Otwórz
laboratorium"; the lab opens as a layer over the whole window (`Lab2D.tsx`: a portal to the body, the browser's full
screen where it has one, the body locked so nothing scrolls behind it; Esc closes what is open, then the layer). In the
page's own whole window (`whole`) the lab fills the space under the page's bar at once.

`LabApp.tsx` lays it out on a grid without scrolling:

- **top** (`shell/TopBar.tsx`): the title (or the scenario picker), below it the first sentence of the task (a click
  opens it whole), the phase — Przygotowanie, Symulacja, Pieczenie, Nagranie — and task & model, settings, close;
- **left**, on a phone a row at the bottom (`shell/ToolRail.tsx`): Wybierz, Dodaj, Maluj, Gumka, Ścianka, Badaj; the
  chosen tool's settings float over the stage (objects to add, materials with brush, temperature and salt, the wall's
  material) and fold away on a phone as soon as one reaches into the box;
- **right**, only when there is something to show (`shell/SidePanel.tsx`; on a phone a sheet from below): the selected
  object with its settings (ObjectPanel), what Badaj found, the selected bubble with its forces, the charts — tabs
  when there are several;
- **bottom** (`shell/TimeBar.tsx`): Uruchom / Pauza / Wznów, one step, the speed, the clock, the slow-computer chip,
  the overlay, the charts, Od nowa, the scene's clip, Upiecz…; while baking the progress, in playback the player
  (timeline in the clip's own frames, speed, loop, live from here, delete, end).

**Two phases.** *Preparation* (time 0): everything can be built and set, objects' set-up included. *Simulation*: once it
runs, the tools that change the scene (Dodaj, Maluj, Gumka, Ścianka) are muted; choosing one, dragging an object or
removing one pauses the run first ("Zatrzymano — możesz zmieniać scenę"). Starting keeps the set-up (a `serialize`
before `pause(false)`, which the worker answers in order); "Od nowa" returns to it, "Scenariusz od początku" (in the
settings) to the scenario. Baking always starts from that set-up.

**Settings** (`shell/SettingsSheet.tsx`, a drawer): resolution (1, 2, 3 mm), violent events (§19), the graphics card,
the environment (pressure presets and sliders, room temperature, humidity, oxygen, gravity), the box's sides, particles
instead of the surface, the level of the texts, the developer panel, and the scene as a file (save, load, empty box,
scenario from the start). **Task & model** (`shell/Dialogs.tsx`, `InfoSheet`): the scenario's text and the model's
simplifications. **Bake dialog** (`BakeDialog`): length, recording step, resume points, resolution, violent events
and an estimate of frames, resume points and size (1.9 B per cell and frame, 44 B per cell and keyframe, from test
31); the last frame rate and spacing are kept in this browser. **The question** (`ExtremeDialog`): see §19. The space
bar starts and pauses.

Texts: `i18n.ts` (Polish first, German and English beside it — the overlays, environment, charts and inspector now in
all three) and `i18nShell.ts` for the surface.
