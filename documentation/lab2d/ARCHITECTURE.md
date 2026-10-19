# 2D lab engine (v2) — architecture

Status: design for Milestone 1 (heating, convection, evaporation, boiling, condensation, fog), written before the
code as the build prompt v2 asks (2026-10-19). Code: `frontend/src/app/lab/lab2d/`. Simplifications:
[SIMPLIFICATIONS.md](SIMPLIFICATIONS.md). Milestone results: [MILESTONES.md](MILESTONES.md).

Version 1 (`lab/particles/`, documentation/particles/) simulated everything, air included, with Position Based
Fluids; it was CPU-heavy and inaccurate. Version 2 does not reuse its solver — it uses the split that CFD and
computer graphics use: fields on an Eulerian grid, liquids as APIC particles, bubbles as Lagrangian objects. It
reuses v1's interface where it fits (the lab frame, the worker loop with its two rhythms, the host, the quality
setting, the slow-computer hint).

## 1. What it is

A real-time 2D lab engine for a school chemistry sandbox. Students drag materials and apparatus into a box; the
engine computes what happens from local physical laws and real material data. The first complete scene: a beaker of
water boiling on a hot plate. Milestone 1 covers heat and gas (M1a), the liquid (M1b), bubbles and phase change (M1c),
the teaching tools (M1d) and a WebGPU path (M1e).

Target machines (prompt v2, project context): school laptops and better; the CPU path runs everywhere and is the
reference, WebGPU accelerates where available. Quality = cell size: medium 3 mm, high 2 mm (the CPU default),
very high 1 mm (the WebGPU default). Budget: at most 12 ms of simulation per 60 Hz frame at 2 mm cells
(100 × 75 for a 20 × 15 cm box) with about 6 000 liquid particles. Reference machine for the measurements: the
development laptop (AMD Ryzen 9 5900HS); the prompt leaves "the target school laptop" unnamed, so §13 reports the
reference numbers and what they imply for a slower CPU.

Rules that override convenience (prompt v2): one world, one loop (one grid, one particle store, one object store);
the right representation per quantity; no presets or scripts; data-driven materials with a source per value; SI
units in a slab of depth D (1 cm); exact bookkeeping (identical weights both ways; budgets close and are tested); the
CPU implementation is the reference; honest simplifications; everything live.

## 2. Layout

```
lab/lab2d/
  engine/              plain TypeScript, no React, no DOM: runs in the worker and headless in Node (tests)
    units.ts           constants (R, g0, p_atm), conversions
    rng.ts             seeded random numbers
    materials.json     the species and materials database, every value with its source (§4)
    materials.ts       typed access and property functions: ρ(T), c_p(T), h(T), k(T), μ(T), σ(T), D_v(T, p)
    if97.ts            IAPWS-IF97 region 4 (p_sat, T_sat) and the IAPWS saturation densities
    grid.ts            the staggered MAC grid and its fields (§3.1)
    particles.ts       the liquid-particle store (§3.2)
    bubbles.ts         the object store: bubbles (§3.3) and their models (§8)
    solver.ts          PCG with a geometric-multigrid preconditioner (pressure), Jacobi-PCG (heat, diffusion)
    liquid.ts          APIC transfers, volume fractions, liquid projection with a free surface, advection, drift
    gas.ts             conservative gas transport, MacCormack velocity, buoyancy, low-Mach sources, projection
    regions.ts         gas regions (open or sealed) and the pressure p0(t) of sealed ones
    heat.ts            implicit conduction over all cells, heater, losses
    phase.ts           saturation, surface evaporation, flash, fog, dew, wall film
    budget.ts          mass and energy budgets, probes
    scene.ts           scene JSON (§10)
    engine.ts          the Engine: commands, the step loop with timing per stage, queries
    protocol.ts        messages between host and worker
  render/              WebGL2: cell texture, liquid surface from particles, bubbles, overlays (§11)
  engine.worker.ts     the worker: owns the Engine and the renderer (OffscreenCanvas)
  host.ts              main thread: starts the worker, forwards commands, receives stats and fallback frames
  Lab2D.tsx            the React shell (LabFrame): palette, tools, inspector, bubble view, charts, levels
  i18n.ts              all UI text: Polish first, German and English
  tests/               Vitest, headless in Node (§12)
pages/parts/lab2d.tsx  the page part `lab2d`
```

## 3. Data layout

### 3.1 The grid

Staggered MAC grid with square cells of size Δx over the box (the box sides are the domain boundary, not cells).
Cell (i, j), i ∈ [0, nx), j ∈ [0, ny), index c = i + j·nx, centre ((i + ½)Δx, (j + ½)Δx), y up. Faces: u at
x = iΔx ((nx + 1)·ny), v at y = jΔx (nx·(ny + 1)). Structure of arrays, allocated once per scene load; masses and
energies Float64, everything else Float32.

| Field | Type | Unit | Meaning |
|---|---|---|---|
| `solid` | u8 | — | material index + 1 of a solid cell (0: fluid) |
| `role` | u8 | — | 0, or 1 = heater element (internal source) |
| `phi`, `alpha` | f32 | — | liquid volume fraction φ, bubble volume fraction α_b |
| `kind` | u8 | — | per step: solid, liquid (φ + α_b ≥ ½), gas |
| `region` | i32 | — | gas region id (§6.4) |
| `pl` | f32 | Pa | liquid solver pressure (gauge: absolute = p0 + pl, hydrostatics included) |
| `pg` | f32 | Pa | gas p′ = p − p_amb(y) |
| `mg[K]` | f64 | kg | gas species masses: N₂, O₂, H₂O vapour, three reserved slots |
| `mfog` | f64 | kg | fog (condensed droplets suspended in the gas) |
| `Hg` | f64 | J | gas enthalpy (species and fog) |
| `Es` | f64 | J | solid energy (enthalpy of the solid and of its wall film) |
| `T` | f32 | K | cell temperature (derived) |
| `Sl`, `Sg` | f32 | 1/s | divergence sources of the liquid and the gas |
| `film` | f64 | kg | wall-film water on a solid surface cell |
| `ul, vl`, `ug, vg` | f32 | m/s | liquid and gas face velocities |

Solid surface cells also hold a cavity list (radius, state, waiting, attached bubble) in a flat side table (§8.2).

### 3.2 Liquid particles

About four per liquid cell (2 × 2, jittered), fixed capacity, free list.

| Field | Type | Meaning |
|---|---|---|
| `x, y` | f32 | position (m) |
| `vx, vy` | f32 | velocity (m/s) |
| `c00, c01, c10, c11` | f32 | APIC affine matrix C (1/s) |
| `mass` | f64 | substance mass (kg) |
| `h` | f64 | specific enthalpy (J/kg) — T derived from it |
| `T` | f32 | temperature (K), cached |
| `spc[2]`, `smass[2]` | u8, f64 | composition slots (water in M1; dissolved species in M2) |
| `mat` | u8 | material (species) index |

### 3.3 Objects (bubbles in M1)

Fixed capacity, free list: position (x, y), depth z ∈ [r, D − r], velocity (vx, vy), species masses (vapour, air)
f64, enthalpy H_b f64, age, attached cavity (−1: free). Radius, volume, internal pressure and T_b are derived from
the state (§8.1). Rigid solids (M3) will use the same store.

## 4. Materials database

`engine/materials.json`: species and materials in the schema the chemistry milestones will use. Every number is
`{ "v": value, "src": key }` (tables `{ "table": [[T, v], …], "src": key }`); `sources` maps keys to citations
(IAPWS releases, NIST WebBook, CRC Handbook, Incropera, Kell 1975, Massman 1998, Lemmert & Chawla, Tomiyama 1998).

- **H₂O**: liquid ρ(T) (Kell 1975), c_p(T) (NIST, IAPWS-95 at saturation, table), k(T) (IAPWS 2011 at saturation,
  quadratic), μ(T) (Vogel fit), σ(T) (IAPWS R1-76(2014)), saturation curve (IAPWS-IF97 region 4), saturated vapour
  and liquid densities (IAPWS SR1-86), vapour c_p (ideal gas), k, μ, molar mass; ice reserved.
- **N₂, O₂**: molar mass, c_p, k(T), μ(T) (Sutherland), diffusivity of water vapour in air (Massman 1998).
- **Borosilicate glass, stainless steel 304, porous ceramic**: ρ, c_p, k, contact angle with water, cavity
  population (§8.2).
- For chemistry: ΔfH°, S°, c_p of each species (stored, unused in M1).

**Enthalpy closure.** Every enthalpy is evaluated with the same functions everywhere: h_l(T) = ∫c_p,l dT from
0 °C, h_v(T) = h_l(100 °C) + h_lv(100 °C) + ∫c_p,v dT from 100 °C (ideal gas; vapour enthalpy depends on T only),
gases h_k(T) = c_p,k (T − 0 °C), solids h_s(T) = c_s (T − 0 °C). The latent heat at any temperature is therefore
h_lv(T) = h_v(T) − h_l(T) (Kirchhoff), anchored at the IF97 value at 100 °C. Every transfer between stores moves
mass with the enthalpy of the store it leaves and books the difference as latent heat in the cells — the budgets
close to round-off.

## 5. The step loop

One loop for every scene; dt = min(1/120 s, Δx/u_max of the liquid). Each stage is timed for the HUD.

1. **Inputs**: tools, heater power, ambient settings.
2. **Liquid** (§7): particles → grid (APIC), volume fractions, body forces, divergence sources, projection with a
   free surface, grid → particles, RK2 advection with solid collision, drift correction.
3. **Gas** (§6): conservative scalar transport (sub-cycled, CFL ≤ 1), MacCormack velocity advection, buoyancy, air
   viscosity, implicit vapour diffusion, low-Mach sources, projection with liquid and solids as boundaries, p0(t) of
   sealed regions.
4. **Bubbles** (§8): nucleation, growth or condensation, departure, motion, coalescence, bursting; reactions and
   volume rates to the grid.
5. **Interface and gas-phase change** (§9): surface evaporation, flash, fog, dew.
6. **Heat** (§6.5): implicit conduction over all cells with the latent heat of steps 4–5 as sources; heater; losses.
7. **Chemistry hook**: empty in M1.
8. **Boundaries and diagnostics**: open sides, escaped mass and energy, budgets, probes, timing.

Nothing in the loop allocates; there is no Math.random (the seeded generator is part of the state); the CPU path is
deterministic for a seed and a command sequence.

## 6. Gas

### 6.1 State and transport

Each fluid cell stores conserved quantities: species masses m_k, fog m_f, enthalpy H. T follows from H by inverting
H = Σ m_k h_k(T) + m_f h_l(T) (linear per species; Newton on the tabulated water part). Masses move in flux form
between gas cells and through open sides only: across a face between gas cells the flux is u·A·q_face with q the
upwinded concentration, limited (van Leer); faces to liquid or solid cells carry no gas mass (they move with the
liquid or stand still). Transport is sub-cycled so that |u|·Δt_sub/Δx ≤ 1. Enthalpy moves with the same fluxes, so
mass and energy stay consistent. Gas trapped in a cell that becomes liquid stays there (still in the budgets) until
the cell is gas again.

### 6.2 Velocity

MacCormack advection (semi-Lagrangian forward and backward with a limiter, as Energy2D), stable at the main dt; air
viscosity explicit (ν Δt/Δx² ≈ 0.03). Buoyancy per unit mass g (ρ − ρ_amb)/ρ with ρ = p0·M_mix/(R·T) — not
Boussinesq, which would make steam rise half as fast.

### 6.3 Low-Mach sources and projection

Solve for p′ = p − p_amb(y):

```
∇·((Δt/ρ_f) ∇p′) = ∇·u* − S_g
S_g = q/(ρ c_p T)                                     heating (net heat into the cell, from the last heat step)
    + V̇_added / V_cell                                 gas volume added: bursts, evaporation, fog (negative)
    + (R T/p0)(1/M_H2O − 1/M_air) ∇·(ρ D ∇Y_H2O)       composition change by vapour diffusion
    + (Σ_k m_k R T/(M_k p0) − V_gas)/(V_gas Δt)        volume correction (removes drift)
```

V_gas = V_cell (1 − φ − α_b). Boundaries: p′ = 0 on open sides; faces to solids have zero velocity, faces to liquid
cells carry the liquid face velocity (Neumann). The system is symmetric positive definite: PCG with a geometric
multigrid preconditioner (§6.6), warm-started.

### 6.4 Regions and sealed boxes

Gas cells are labelled by connected regions every step. A region that touches an open side has p0 = p_amb and the
Dirichlet condition there. A sealed region (a closed box, a lidded beaker) has its own uniform pressure p0(t):

```
dp0/dt = γ p0 / V_g · (∫ S_g dV − dV_g/dt),      ∇·u = S_g − (1/(γ p0)) dp0/dt
```

with V_g = V_box − V_solid − Σ m_p/ρ_p − Σ V_b (smooth), dV_g/dt from the discrete face fluxes, the mean of the
right-hand side removed so the all-Neumann solve is consistent, p0 reset after each step to
R·Σ_i T_i Σ_k (m_k,i/M_k)/V_g (no drift), the compression heating (dp0/dt)/(ρ c_p) added to the gas energy, and
U = H − p0·V_g in the energy budget.

### 6.5 Heat

One temperature field over all cells (solid, liquid, gas), implicit conduction:

```
C_i (T_i^{n+1} − T_i*)/Δt = Σ_j k_ij D (T_j^{n+1} − T_i^{n+1}) + q_i,      k_ij = 2 k_i k_j / (k_i + k_j)
```

(C_i = heat capacity of the cell, D the slab depth: the flux through a face of area Δx·D over a distance Δx.) Solid
cells: C = m c_s, T from E_s. Gas cells: C = Σ m_k c_p,k + m_f c_p,l. Liquid: every particle adds its heat capacity
m_p c_p and C·T to the cells it touches with the same quadratic B-spline weights as the momentum transfer; T* is the
C-weighted mean of the cell's parts. Solve with Jacobi-preconditioned CG (the system is SPD and strongly diagonal).
Exact bookkeeping: the energy change of a cell is computed from the face fluxes of the solved temperatures (each
face once, antisymmetric) plus q_i Δt; each part of the cell is then set to the new temperature — the gas and solid
energies directly, the particles by the interpolated change Σ_i w_ip (T_i^{n+1} − T_liq,i), which moves exactly the
cell's liquid share and keeps the particles' own temperature differences (no smearing).

Heater: static steel cells with role 1 and an internal source — power mode (W) or thermostat (PI control of the mean
heater temperature, power-limited). Losses h_ext (T − T_amb) per wall-side face (h_ext = 10 W/(m²·K)); open sides
exchange heat by inflow and outflow (escaped energy). No radiation (SIMPLIFICATIONS.md).

### 6.6 Pressure solves

PCG with a geometric-multigrid V-cycle as preconditioner (McAdams et al. 2010): cell-centred levels, coarse face
coefficients by averaging the fine ones (rediscretisation), Dirichlet cells kept as such, damped Jacobi smoothing
(symmetric, so the preconditioner is SPD), a direct-ish coarsest level (many Gauss–Seidel sweeps). Warm start from the
previous step. Relative residual 1e-5 in real time, 1e-8 in tests; an iteration cap that is hit is reported in the
HUD and the budgets.

## 7. Liquid

- **Transfers**: APIC (Jiang et al. 2015) with quadratic B-spline weights on the staggered faces; G2P recovers the
  affine matrix with D = Δx²/4. A FLIP/PIC blend is not used.
- **Volume fractions**: φ = Σ w m_p/ρ(T_p)/V_cell, α_b = Σ w V_b/V_cell (bubbles); a cell is liquid when
  φ + α_b ≥ ½.
- **Body force** g ρ(T)/ρ_ref on liquid faces with a constant-density projection (ρ_ref): the pressure is the real
  hydrostatic pressure, warm water rises, the density maximum near 4 °C is kept. Never combined with a
  variable-density liquid projection. Bubble reaction forces are added (§8.4).
- **Divergence source** S_l = −(1/ρ)(dρ/dT) DT/Dt (the volume change of the particles in the last heat step, splatted
  with their weights) + w (V̇_b − ṁ_evap/ρ_l)/V_cell, − w V_b/(V_cell Δt) when a bubble bursts, plus the drift
  correction k_d (φ + α_b − 1)/Δt (compression everywhere, both signs in the interior) — it works on volume, not
  particle count, so bubbles and evaporation keep their volume.
- **Projection**: free surface at absolute pressure p0 (Dirichlet p = 0 gauge in gas cells), no penetration at
  solids and walls; PCG + multigrid.
- **Advection**: RK2 in the grid velocity; particles that end in a solid are pushed out along the gradient of a
  distance field of the solids (recomputed when solids change), their normal velocity removed. Particles that leave
  through an open side are booked as escaped.

## 8. Bubbles (M1c)

### 8.1 State

A bubble is a sphere inside the slab: p_b (4/3)π r³ = (Σ_k m_k/M_k) R T_b, p_b = p_l + 2σ/r, T_b = T_sat(p_v), p_v
the vapour partial pressure; depth z ∈ [r, D − r]; once 2r > D it is a disc of volume π r² D. A new bubble starts at
the cavity mouth radius r_c with vapour taken from nearby particles. While d ≤ 3Δx its volume, heat and force are
spread with B-spline weights; larger bubbles are rasterised into cells.

### 8.2 Nucleation

Each solid surface cell carries a few cavities with mouth radii from its material's population, sampled once with the
seeded generator. A cavity is active when T_f − T_sat(p_l) ≥ ΔT_act = T_sat(p_l + 2σ/r_c) − T_sat(p_l), with the wall
contact temperature T_f = (k_s T_s + k_l T_l)/(k_s + k_l). Steel is calibrated to Lemmert & Chawla,
N = (210 ΔT_w)^1.805 m⁻² of active sites; smooth glass has far fewer large cavities, boiling chips many. After a
departure a site restarts when T_f again exceeds its ΔT_act (the waiting time emerges).

### 8.3 Growth and condensation

dm_v/dt = h A (T_l − T_sat(p_v)) / (h_v(T_b) − h_l(T_l)) with h = max(k_l √(3/(π α_l t_b)), (k_l/d)(2 + 0.6 Re^½
Pr^⅓)) — Plesset–Zwick for a young bubble, Ranz–Marshall for a moving one; T_l is T_f for an attached bubble, whose
heat comes from the solid cell. Each step is limited so that no cell crosses T_sat because of this transfer.

### 8.4 Departure, motion, coalescence, bursting

Departure at the Fritz diameter D_d = 0.0208 θ √(σ/(g Δρ)) (θ in degrees per solid–liquid pair). Motion by the force
balance of pressure gradient, weight, added mass (C_A = ½, with the V̇ term) and Tomiyama (1998) drag for
contaminated water; the liquid velocity is sampled outside the bubble's footprint; drag and added-mass reactions go
to the liquid. Bubbles that overlap in 3D (their depths included) merge, conserving mass, momentum and energy. At the
free surface a bubble releases its species and enthalpy into the gas cell above, with a volume source.

## 9. Interface and gas-phase change (M1c)

Surface evaporation imposes Y_sat(T_s) on the liquid–gas face: ṁ″ = ρ D (Y_sat − Y_1)/(Δx/2), implicit; the mass
leaves surface particles, the latent heat the surface cells; a surface cell above T_sat(p0) flashes its excess
sensible heat into vapour. Fog: where p_H2O > p_sat(T), the condensed mass is found by Newton so that the remaining
vapour is exactly saturated at T + h_lv Δm/C_cell; subsaturated cells evaporate fog the same way. Dew: gas next to a
colder wall deposits into the wall film at ṁ″ = ρ D (Y_1 − Y_sat(T_w))/(Δx/2); a full film spawns a liquid particle.
Saturation from IAPWS-IF97 region 4 at the local absolute pressure.

## 10. Scenes

A scene is a starting layout: box (w, h, depth), ambient (p, T, relative humidity, composition, g), sides, quality,
seed and an ordered list of operations (liquid fill, solid shape, beaker, hot plate, boiling chips, erase). JSON,
`format: "recreatio/lab2d"`, version 1, in m / °C / kPa / W.

## 11. Rendering, threading, React

The engine runs in a module Web Worker; WebGL2 on an OffscreenCanvas in the worker, a main-thread fallback with
transferred snapshots (SharedArrayBuffer when the page is cross-origin isolated). The renderer draws a cell texture
(solids, fog, overlays), the liquid as a smooth surface (a particle density field at twice the grid resolution,
thresholded in the shader), bubbles as circles at their true radius, velocity vectors and force arrows as lines.
Water vapour itself is invisible; a toggle shows the vapour field next to the fog. Overlays: temperature
(colour-blind-safe), pressure, velocity, humidity, fog, phase map. The React shell (`Lab2D.tsx`, in `LabFrame`)
reads stats at 5 Hz and never holds field or particle data.

## 12. Tests

Vitest, headless in Node on the engine alone (`npm run test:lab2d`; long ones `npm run test:lab2d:slow`). The gates
of the prompt decide when a milestone is done; MILESTONES.md records measured numbers.

| # | Test | Milestone |
|---|---|---|
| 1 | Hydrostatics: 97.9 Pa/cm at 20 °C, 94.7 at 90 °C (±2 %), residual currents < 1 mm/s | M1b |
| 2 | Conduction: a step in a solid slab matches erf within 2 % | M1a |
| 3 | Heating rate: dT/dt = P/Σ(m c_p) within 5 % (sealed, insulated) | M1b |
| 4 | Conservation: sealed box 10 min, energy within 0.5 % of ∫P dt, water mass exact; open box closes | M1a (gas) / M1b |
| 5 | Thermal expansion 20 → 90 °C: level +3.4 % (±0.3 %) | M1b |
| 6 | Saturation (IF97) and its hydrostatic shift | M1c |
| 7 | Bubble growth: 1.20 mm after 10 ms at 5 K superheat (Plesset–Zwick, ±5 %) | M1c |
| 8 | Departure: 2.34 mm at 45° (Fritz, ±5 %) | M1c |
| 9 | Rise velocity: 0.25 m/s at 3 mm, 0.23 at 5 mm (±10 %) | M1c |
| 10 | Subcooled boiling: early bubbles collapse, later reach the surface | M1c |
| 11 | Boiling plateau within 0.5 K of T_sat; vapour = (P − losses)/h_lv within 5 % | M1c |
| 12 | Superheating: ≤ 1 K with chips, ≥ ΔT_act of the largest glass cavity without | M1c |
| 13 | Evaporation = ρ D ΔY/L within 5 % | M1c |
| 14 | Fog only where supersaturated, exactly saturated after, water exact | M1c |
| 15 | Sealed box: p0 rises by p0 ΔT/T (±1 %) | M1a |
| 16 | Performance: ms per stage in the HUD; ≤ 12 ms per frame at the default resolution | every milestone |
| 17 | GPU equivalence on tests 1–3, 6, 11 | M1e |

## 13. Performance

One benchmark scene (the boiling beaker, 20 × 15 cm, 2 mm cells) is logged per stage at every milestone
(MILESTONES.md). Budget per 60 Hz frame: 12 ms, i.e. 6 ms per step at dt = 1/120.

## 14. Designed for, not built

Chemistry (M2: species and reactions as a graph, each cell a well-mixed reactor, stiff implicit kinetics, gas from a
liquid becomes bubbles, gas in the gas phase a divergence source); solids (M3: rigid bodies rasterised into moving
solid cells, melting by an enthalpy method into liquid particles); energetic reactions (M4: an explicit sub-model for
the Coulomb explosion of sodium; hydrogen ignition needs a compressible solver); zero gravity (surface tension on the
resolved surface); a molecule lens (read-only Lennard-Jones view). Nothing in M1 blocks them: species slots on cells,
particles and bubbles; the object store; the chemistry hook in the loop.
