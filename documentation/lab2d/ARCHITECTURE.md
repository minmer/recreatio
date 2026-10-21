# 2D lab engine (v2) — architecture

Status (2026-10-21): Milestones M0–M1d are built on the CPU and pass their tests except the time budget of test 16;
M1e, the WebGPU path, is built as the "accelerated view" — the whole step on the GPU (§15) — and meets test 17 (test 11
at the edge of its tolerance, as on the CPU). M2a, the first step of the sandbox plan ([SANDBOX.md](SANDBOX.md)), adds
liquids other than water (rapeseed oil first) on the CPU: per-material particles, viscosity and drifting droplets
(tests 18–22); the accelerated view does not take them yet. [MILESTONES.md](MILESTONES.md) has the measured numbers. Written as a
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
    if97.ts            IAPWS-IF97 region 4 (p_sat, T_sat, dT_sat/dp), IAPWS saturation densities; fast tables
    shapes.ts          regions of scene operations: rect, circle, poly, line with width
    scene.ts           scene JSON: reading (tolerant, with warnings) and writing (§10)
    grid.ts            the staggered MAC grid and its fields (§3.1)
    particles.ts       the liquid-particle store (§3.2)
    bubbles.ts         the object store: bubbles (§3.3)
    solver.ts          PCG with a geometric-multigrid preconditioner (pressure), Jacobi-PCG (heat, diffusion) (§6.6)
    regions.ts         fluid regions (open or sealed) and the pressure p0 of sealed ones (§6.4)
    liquid.ts          APIC transfers, volume fractions, classification, liquid projection, advection (§7)
    gas.ts             conservative gas transport, MacCormack velocity, buoyancy, low-Mach sources, projection (§6)
    heat.ts            implicit conduction over all cells, heaters, losses (§6.5)
    bubbleState.ts     a bubble's radius, pressure and temperature from its masses; footprint weights (§8.1)
    bubbleModel.ts     cavities, nucleation, growth, departure, motion, coalescence, bursting (§8)
    phase.ts           vapour diffusion with surface evaporation and dew, flash, fog, wall films (§9)
    edits.ts           scene operations and tools: fill, erase, move, solid, beaker, hot plate (§10)
    budget.ts          mass and energy budgets
    charts.ts          the samples behind the live charts (every 0.25 s)
    stages.ts          the eight stage names (HUD, tests)
    engine.ts          the Engine: commands, the step loop with timing per stage, queries, stats
    protocol.ts        messages between host and worker
  render/              frame buffers from the engine state, WebGL2 renderer, palette, view fitting (§11)
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
  Lab2D.tsx            the React shell (LabFrame): tools, palette, inspector, bubble view, charts, levels, scenes
  panels.tsx           inspector, bubble panel, charts, legend, "About this model", HUD
  presets.ts           starting layouts as data (the benchmark scene first)
  text.ts              the scene description and the prompt to copy for an outside AI
  i18n.ts              all UI text: Polish first, German and English; the simplifications for students
  lab2d.css            the stage overlays (classes l2d-*)
  tests/               Vitest, headless in Node (§12)
pages/parts/lab2d.tsx  the page part `lab2d` (card in a strip, the lab in a block, fullscreen)
scripts/lab2d-bench.mjs  the benchmark scene, timing per stage (§13)
scripts/fixtures/lab2d-wrzenie.json  a page with four labs, for import
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
| `Es`, `film` | f64 | J, kg | solid energy (with its wall film), wall-film water |
| `T`, `Tl`, `Cl` | f32, f32, f64 | K, K, J/K | cell temperature; temperature and heat capacity of the cell's liquid share |
| `Sl`, `Sg` | f32 | 1/s | divergence sources of the liquid and the gas |
| `ul, vl`, `ug, vg` | f32 | m/s | liquid and gas face velocities |

Cavities live in a flat side table built from the solids (`bubbleModel.rebuildSites`, §8.2).

### 3.2 Liquid particles

About four per liquid cell (2 × 2 on fill), fixed capacity, packed (removal moves the last particle into the hole; a
stable `id` travels with it for the inspector).

| Field | Type | Meaning |
|---|---|---|
| `x, y`, `vx, vy` | f32 | position (m), velocity (m/s) |
| `c00, c01, c10, c11` | f32 | APIC affine matrix C (1/s) |
| `mass` | f64 | substance mass (kg) |
| `h` | f64 | specific enthalpy (J/kg) — the state; `T` and `rho` are cached from it |
| `spc[2]`, `smass[2]` | u8, f64 | composition slots for dissolved species (M2b; empty so far) |
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
Lemmert & Chawla). A test checks that every value cites a source.

- **H₂O**: liquid ρ(T) (Kell), c_p(T) (table, piecewise linear with an exact enthalpy integral and inverse), k(T)
  (IAPWS 2011, quadratic), μ(T) (Vogel), σ(T) (IAPWS R1-76), saturation curve (IF97 region 4), saturated densities
  (SR1-86); vapour c_p (ideal gas, linear in T), k, μ; molar mass; ΔfH°, S° for later chemistry.
- **N₂, O₂**: molar mass, c_p, k(T) (power law), μ(T) (Sutherland), diffusivity of water vapour in air (Massman).
  Gas properties are tabulated from these laws at 1 K steps (150–1150 K, linear reading, error < 1e-5).
- **Rapeseed (canola) oil** (M2a): ρ(T) and c_p(T) linear (the fits of Rojas, Coimbra & Telis-Romero 2013, measured
  20–160 °C), k(T) linear and μ(T) after Vogel (fits in this repository to their tables, within 0.5 % and 1.3 %),
  surface tension constant (33.4 mN/m, the 20 °C literature mean of Melo-Espinosa et al. 2014). Not volatile.
- **Borosilicate glass, stainless steel, porous ceramic**: ρ, c_p, k, contact angle with water, cavity population
  (scale, largest mouth radius): glass 0.02 / 3 µm / 25°, steel 1 / 40 µm / 70°, ceramic 50 / 150 µm / 10° (§8.2).

**Several liquids** (M2a, format version 2): every substance with a `liquid` block is a liquid of the engine
(`LIQUIDS`: water first). `cpLiq`, `hLiq`, `tFromHLiq`, `rhoLiq`, `kLiq`, `muLiq`, `sigmaLiq` take the liquid's index;
water keeps its own functions, so water-only scenes compute exactly what they computed in M1. Each liquid has its own
enthalpy reference (0 at 0 °C): no liquid turns into another, so the references never meet.

**Enthalpy closure.** Every enthalpy is evaluated with the same functions everywhere: h_l(T) = ∫c_p,l dT from 0 °C,
h_v(T) = h_l(100 °C) + h_lv(100 °C) + ∫c_p,v dT from 100 °C (ideal gas, T only; h_lv(100 °C) = 2256.4 kJ/kg from
IF97), gases h_k(T) = c_p,k (T − 0 °C), solids c_s (T − 0 °C). The latent heat at any temperature is
h_lv(T) = h_v(T) − h_l(T) (Kirchhoff). Every transfer between stores moves mass with the enthalpy of the store it
leaves and books the difference as latent heat in the cells — the budgets close to round-off.

## 5. The step loop

One loop for every scene (`engine.ts`); dt = min(1/120 s, 0.9 Δx/u_max of the liquid). Each stage is timed for the HUD.

1. **Inputs**: tools, heater power, ambient settings (applied between steps).
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
   fog; wall films that spawn particles.
6. **Heat** (§6.5): implicit conduction over all cells with the latent heat of steps 4–5 as sources; heaters; losses.
7. **Chemistry hook**: empty in M1.
8. **Boundaries and diagnostics**: regions again, compression heating of sealed regions, pressure work on particles
   and bubbles, the equation of state for the next step, the next dt, budgets, chart samples.

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

Heaters: static steel cells with role 1 and an internal source — power mode (W per slab depth) or a thermostat (PI on
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
- **Projection**: free surface at the gas pressure of the region (Dirichlet in gas cells), walls and solids
  impermeable; PCG + multigrid on the bounding rectangle of the liquid.
- **Advection**: RK2 in the grid velocity; particles that end in a solid are pushed out along the distance field
  (their normal velocity removed); particles that leave through an open side are booked as escaped.

A fill that would leave a liquid region without a free surface is refused (the prompt: no pressure law for it in M1).

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
the waiting time emerges. Per-cell energy budgets keep the transfers from pushing a cell across T_sat.

### 8.3 Growth and condensation

dm_v/dt = h A (T_l − T_sat(p_v)) / (h_v(T_b) − h_l(T_l)), h = max(k_l √(3/(π α_l t_b)), (k_l/d)(2 + 0.6 Re^½ Pr^⅓)).
For sphere and disc the energy balance gives dr/dt = h ΔT/(ρ_v L) independent of r, so each substep grows the radius
by exactly ∫h dt · ΔT/(ρ_v L), with the Plesset–Zwick term integrated in closed form (with the area at the start of a
substep the growth was 12 % too slow). Substeps: at most the bubble's age (Δr/r ≲ ½), a quarter cell of motion, and
a substep that would carry an attached bubble past its departure diameter is cut exactly there. T_l is T_f for an
attached bubble, whose heat comes from the solid cell; for a free one the liquid of its footprint.

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
- **Flash**: a surface cell whose liquid is above T_sat(p) turns its excess sensible heat into vapour; the particles
  end exactly at T_sat (by their share).
- **Fog**: where p_H2O > p_sat(T), Δm condenses so that the remaining vapour is exactly saturated at the new temperature
  (H fixed, T rises by h_lv Δm/C) — an Illinois-bracketed secant search to 1e-13 relative; subsaturated cells
  evaporate fog the same way; cells clearly below saturation without fog are skipped.
- **Films**: a wall film above a threshold spawns a liquid particle that runs down.
- Every transfer carries the enthalpy of the store it leaves; the difference is latent heat of the cell (a source of
  the heat stage). Saturation from IAPWS-IF97 region 4 at the local absolute pressure.

## 10. Scenes and tools

A scene is a starting layout: box (w, h, depth), ambient (p, T, relative humidity, dry-air composition, g — all
adjustable while it runs; a new composition enters through open sides, the gas in the box keeps its own), sides,
quality, seed and an ordered list of operations — `fill` (liquid water, or gas of a composition), `erase`, `move`
(everything solid in a region, with the water and bubbles inside, by whole cells — the drag tool), `solid`, `beaker`
(with an optional lid), `hotplate` (power or thermostat). `fill` takes any liquid of the database (`H2O`, `oil-rapeseed`) with mass fractions; several immiscible liquids are
spread evenly by volume, each particle being one of them. JSON, `format: "recreatio/lab2d"`, version 1, in m / °C /
kPa / W (`scene.ts`; unknown parts are dropped with a warning). Every tool is an operation appended to the scene, so
"save" writes the current layout with its seed, and a change of quality rebuilds the same layout at the new cell size.
Edits book the mass and energy they add or remove (the budgets close across tools).

## 11. Rendering, threading, React

The engine runs in a module Web Worker (`engine.worker.ts`): steps in time slices of 6 ms between frames, frames at
display rate, stats to the page five times a second. WebGL2 on an OffscreenCanvas in the worker; without it the
worker builds frame buffers and transfers them (a ring of two) to a WebGL2 canvas on the page. Each frame:

- the box ground; the liquid as a smooth surface: particle coverage splatted with B-splines on half cells, blurred
  ([1 2 1]/4) and cut at ½ in the shader with a thin darker edge (tinted by temperature in the temperature overlay) —
  or, in the raw-particle view, the particles as points coloured by temperature;
- bubbles as circles at their true radius;
- a field texture, read linearly with premultiplied alpha: the continuous overlays (temperature, pressure,
  velocity, humidity, invisible vapour) and fog — white with Beer–Lambert opacity from its water content
  (SIMPLIFICATIONS.md #21), paler under the temperature, pressure and velocity overlays;
- a cell texture, read crisply: solids in their colour (a hot plate glows above 60 °C) and the phase map;
- in the velocity overlay, arrows on a grid of about 6 mm: gas (dark) and water (white), each scaled to its own
  largest speed (the legend gives both);
- the box walls (open sides stay open).

Water vapour itself is invisible; the "vapour" overlay shows it next to the fog. The React shell (`Lab2D.tsx` in
`LabFrame`) holds only settings and the stats; it draws the force arrows of the selected bubble, the overlay legend,
the HUD and notes as SVG/HTML over the canvas. The inspector asks the worker (`query`); a selected bubble is followed
through merges, and when it bursts or collapses its last state stays with a note saying what happened.

The accelerated view (§15) swaps the worker: `gpu.worker.ts` steps and draws with WebGPU on its own OffscreenCanvas
and answers the same host messages, so the shell, the tools, the inspector and the charts stay as they are.

## 12. Tests

Vitest, headless in Node on the engine alone: `npm run test:lab2d` (41 tests, ~4 minutes) and
`npm run test:lab2d:slow` (tests 3, 4 over ten simulated minutes, 10, 11, 12). MILESTONES.md records the numbers.

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
| 17 | GPU equivalence on tests 1–3, 6, 11 | browser harness in headless Edge (Node has no WebGPU) and in Firefox (a visible window: headless Firefox gets no WebGPU adapter); numbers in MILESTONES.md (M1e) |

The browser side (tools, overlays, inspector, bubble view, charts, scenes, phone layout) was walked through in
headless Edge against a bundle of the shell; the results are in MILESTONES.md (M1d).

## 13. Performance

`npm run bench:lab2d` runs the benchmark scene (the boiling beaker with chips, 98 °C water, 20 × 15 cm) headless and
prints ms per stage, CG iterations and gas substeps. Budget per 60 Hz frame: 12 ms, i.e. 6 ms per step. Numbers and
their history: MILESTONES.md. Where the time goes at 2 mm: the gas stage (transport in ~4 substeps and a projection
of ~11 MGPCG iterations — thin beaker walls make coarse cells straddle two gas regions, which slows the V-cycle), the
vapour diffusion, the heat solve, the liquid, the bubbles. On the GPU (accelerated view, §15; RTX 3070 laptop) the
benchmark scene takes 4.9 ms per step at 2 mm and 7.7 ms at 1 mm, the gas stage again the largest.

## 14. Designed for, not built

Chemistry (M2: species and reactions as a graph, each cell a well-mixed reactor, stiff implicit kinetics, gas from a
liquid becomes bubbles, gas in the gas phase a divergence source); solids (M3: rigid bodies rasterised into moving
solid cells, melting by an enthalpy method into liquid particles); energetic reactions (M4: an explicit sub-model for
the Coulomb explosion of sodium; hydrogen ignition needs a compressible solver); zero gravity (surface tension on the
resolved surface); a molecule lens (read-only Lennard-Jones view).
Nothing in M1 blocks them: six species slots on cells and bubbles, two composition slots on particles, the object
store, the chemistry hook in the loop.

The plan for the next steps — several liquids (oil), bodies that fall, float and tip, melting and freezing, salt in
solution and as grains, and baked clips — is [SANDBOX.md](SANDBOX.md) (2026-10-21, a design before the code). It
replaces the M3 sketch above: melting there is an interface process at the solution's freezing point, not a volume
enthalpy rule.

## 15. The GPU path (M1e): the accelerated view

The button "Widok przyspieszony" (shown where the browser has WebGPU) restarts the lab in a second worker,
`gpu.worker.ts`, that runs the whole step on the GPU — at 1 mm, or at the saved quality — and draws with WebGPU;
"Widok zwykły" returns to the CPU worker with the same scene. If the device or a kernel fails, the shell falls back
to the CPU worker with a note; a scene with a liquid other than water goes back to the CPU worker the same way, with
its tools applied (M2a is not ported yet). The view is not bit-reproducible (float atomics, order-free merging): the prompt's
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
