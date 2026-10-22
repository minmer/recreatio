# 2D lab engine (v2) — milestones

Measured results of Milestone 1 of the build prompt v2, milestone by milestone: what each gate asked for, what the
tests measured, and what is not met. Architecture: [ARCHITECTURE.md](ARCHITECTURE.md). Simplifications:
[SIMPLIFICATIONS.md](SIMPLIFICATIONS.md).

Reference machine: the development laptop, AMD Ryzen 9 5900HS (8 cores, single-threaded engine), Node 24, Windows 11.
The prompt's "target school laptop" was never named; a typical school laptop is two to four times slower per core.

Reproduce: `npm run test:lab2d` (fast tests, ~3 min), `npm run test:lab2d:slow` (long runs, ~30 min),
`npm run bench:lab2d` (benchmark, on a quiet machine).

## Summary

| Milestone | Gate | Status |
|---|---|---|
| M0 Skeleton | worker loop, stores, renderer, shell, painting, HUD | met |
| M1a Heat and gas | tests 2, 15, gas part of 4, time budget of 16 | tests met; **16 not met** |
| M1b Liquid | tests 1, 3, 4, 5, 16 | tests met; **16 not met** |
| M1c Bubbles and phase change | tests 6–14, 16 | tests met; **16 not met** |
| M1d Teaching tools | 16 and a walkthrough of the boiling scene | walkthrough done; **16 not met** |
| M1e GPU path | test 17, 1 mm in the budget | built (the accelerated view): test 17 met (test 11 was at the edge, as on the CPU, until the particles of a cell shared their heat: now −0.37 K); 2 mm 4.9 ms per step; **1 mm 7.7 ms, above the 6 ms** (§M1e) |
| M2a liquids (oil) | tests 18–22 (SANDBOX.md §13), water unchanged | built on the CPU (2026-10-21): all met; every M1 number unchanged to the last printed digit; water scenes as fast as before (§M2a); the accelerated view hands oil scenes back to the CPU |
| M2b solutions (salt) | tests 23–27 (SANDBOX.md §13) | built on the CPU (2026-10-22): all met; then particles of a cell share heat and salt at the diffusion rate and salt diffuses between cells (tests 28–30, met); all M1/M2a tests still met, some numbers moved slightly (§M2b); water +2.4 % per step, brine +12 % over water; the accelerated view shares heat like the CPU and hands salt scenes back to the CPU |

Test 16 (≤ 12 ms of simulation per 60 Hz frame at the default resolution) is the one gate that fails throughout:
the CPU step of the benchmark scene at 2 mm takes 21.6 ms (budget 6 ms per step, two steps per frame): the
simulation runs at 0.39 × real time, in slow motion with the same results. The shell shows the tempo and offers 3 mm
cells, where a step takes 8.5 ms (0.98 × real time on the reference machine, still above the 12 ms per frame of the
budget); 1 mm takes 102 ms per step (0.08 ×). Details and history under "Benchmark". On the GPU path (M1e) the same
scene takes 4.9 ms per step at 2 mm — inside the budget — and 7.7 ms at 1 mm.

## M0 — Skeleton

Built: the engine module (no React, headless in Node), the three stores (grid, liquid particles, objects), the worker
with OffscreenCanvas WebGL2 and a main-thread fallback (transferred frame buffers), the React shell in `LabFrame`,
painting liquid and solids, apparatus as shapes of solid cells, the scene JSON with seed, the dev HUD with the time
of all eight stages, the materials database with a source for every value.

`m0.test.ts` (15 tests, all pass): IAPWS-IF97 region 4 against the verification values of R7-97(2012) (tables 35,
36) to 8 digits; SR1-86 saturated densities at 100 °C; liquid properties at textbook values (density maximum near
4 °C); exact inversion of the enthalpy closures; every value in materials.json cites a source; stores with stable
ids; scene round trip; the presets and the page fixture read without a warning; painting (four particles per liquid
cell, apparatus as solid cells); erase and the refusal of a liquid without a free surface; moving a beaker with its
water and a hot plate with its heater keeps the budgets closed; sealing and opening regions keeps the energy budget
closed; eight timed stages with finite state; bit-for-bit determinism for a seed and a command sequence.

## M1a — Heat and gas

| Test | Criterion | Measured |
|---|---|---|
| 2 Conduction | step in a steel slab vs erf, within 2 % | largest deviation 0.0679 K of an 80 K step (**0.085 %**) after 20 s |
| 15 Sealed box | p0 rises by p0·ΔT/T, ±1 % | ΔT 7.868 K: +2719.64 Pa vs 2719.66 Pa (**−0.000 %**) |
| 4 gas, sealed | \|ΔE − ∫P dt\| < 0.5 % of ∫P dt, water exact | 60 s: 1.8e-8 J of 600 J (**3e-9 %**), water error −1.2e-21 kg; 10 min: see below |
| 4 gas, open | budgets close with escaped mass and energy | 30 s: error **1.5e-12 J** (heater 300 J, walls 2.36 J, open-side conduction 0.22 J, escaped 0.80 J) |
| 4 gas, 10 min | as above, sealed and insulated | 1.8e-7 J of 1200 J (**1.5e-8 %**), water −1.7e-21 kg; p0 rose to 145.96 kPa |

## M1b — Liquid

| Test | Criterion | Measured |
|---|---|---|
| 1 Hydrostatics | 97.9 Pa/cm at 20 °C, 94.7 at 90 °C (±2 %), currents < 1 mm/s | **97.924** and **94.698** Pa/cm (exactly ρ g); largest particle speed after 5 s **0.0027 mm/s** |
| 3 Heating rate | dT/dt = P/Σ(m c_p) within 5 % | **−2.30 %** over 180–300 s: 0.10901 vs 0.11157 K/s (Σ m c_p = 89.63 J/K: water 75.10, solids 14.45, air 0.077; 10 W) |
| 4 with water | sealed, insulated; open | 60 s sealed: 7.2e-7 J of 600 J (**1.2e-7 %**), water error −2e-16 kg; 40 s open: error **1.6e-11 J**; 10 min sealed: 3.3e-5 J of 3000 J (**1.1e-6 %**), water 9e-17 kg (water at 49.1 °C at the end) |
| 5 Expansion | level +3.4 % (±0.3 %) from 20 to 90 °C | **+3.627 %** (ρ(20)/ρ(90) − 1 = 3.407 %; the +0.22 % comes from the free surface settling into the cell layer differently at the two temperatures at 2 mm — 3.44 % at 1 and 3 mm) |

## M1c — Bubbles and phase change

| Test | Criterion | Measured |
|---|---|---|
| 6 Saturation | T_sat 99.97 °C at 101.325 kPa, 89.93 °C at 70 kPa (±0.01 K); +0.26 K at 10 cm depth | IF97 exact (M0); **+0.2604 K** at 10 cm from the engine's own liquid pressure (945.3 Pa, ρ 958.4 kg/m³) |
| 7 Bubble growth | 1.20 mm after 10 ms at 5 K superheat (±5 %) | **1.1711 mm (−2.4 %)**; the 10 µm seed starts near the critical radius, where 2σ/r raises T_b (the ODE with surface tension gives 1.179 mm) |
| 8 Departure | 2.34 mm at 45° (±5 %) | 158 departures, mean **2.3498 mm** (Fritz at 100 °C: 2.3438 mm) |
| 9 Rise velocity | 0.25 m/s at 3 mm, 0.23 m/s at 5 mm (±10 %) | **0.2491** (−0.4 %) and **0.2276 m/s** (−1.0 %) |
| 10 Subcooled boiling | bubbles collapse while the bulk is ≥ 5 K below T_sat; later reach the surface | bulk ≥ 5 K below T_sat: 51 450 bubbles collapsed, **21 (0.04 %)** reached the surface; warmer: **330** reached it (24 238 collapsed); water 98.5 °C after 49 s (compact beaker 5 cm wide, 2.7 cm of water, 40 W) |
| 11 Boiling plateau | mean water within 0.5 K of T_sat; vapour = (P − losses)/h_lv within 5 % | mean water **99.495 °C**, T_sat 99.974 °C (−0.48 K: inside the tolerance, with little margin — evaporation at the surface and the glass walls keep the bulk slightly below T_sat); vapour **5.233 mg/s** vs (P − losses)/h_lv **5.230 mg/s (+0.05 %)**, P 25 W, losses 13.2 W. Since the particles of a cell share their heat (M2b): **99.656 °C (−0.32 K)**, vapour 5.309 mg/s vs 5.307 mg/s (+0.05 %) |
| 12 Superheating | ≤ 1 K with chips; ≥ ΔT_act of the largest glass cavity without | with chips **0.273 K** (on ceramic); without **9.965 K** on glass, ΔT_act of the largest glass cavity 9.461 K |
| 13 Evaporation | rate = ρ D ΔY/L within 5 % | **+1.13 %** (2.168e-9 vs 2.144e-9 kg/s; the Stefan flow adds ≈ Y_sat/2) |
| 14 Fog | fog only where p_H2O > p_sat; each fog cell exactly saturated; water exact | largest \|p_v − p_sat\|/p_sat in a fog cell **1.1e-11**; fog in subsaturated cells **0**; water error **1e-20 kg** |

Known behaviour (SIMPLIFICATIONS.md #18): nucleation at a hot wall is frequent — thousands of tiny bubbles per second
form and collapse in subcooled water, because one 2 mm wall cell holds the whole wall superheat. Energy and mass are
exact; the bubble count is higher than in reality.

## M1d — Teaching tools

Built: inspector (cell, nearest particle, bubble; two levels; material names from the database), bubble view (radius,
vapour mass, internal pressure, T_sat inside, growth rate, the four forces as labelled arrows on the stage; the
selected bubble is followed through merges, and when it bursts or collapses its last state stays with a note saying
what happened), overlays with legends (temperature, pressure, velocity — the gas speed as colour plus arrows for gas
and water, each on its own scale —, humidity, invisible vapour, phase map), a raw-particle view (the water particles
as dots coloured by their temperature instead of the smooth surface), the four live charts (water temperature with
the plateau, energy budget, water by state, vapour production against (P − losses)/h_lv), two levels, time controls
(pause, single step, slow motion, fast-forward), scenes saved and loaded as JSON with the seed, the "About this
model" panel with all simplifications in two wordings, the room settings (pressure presets, temperature, humidity,
oxygen content of the inflowing air, gravity 0.25–2 g, each side wall or open), quality with the slow-computer hint,
and the page part `lab2d` with a fixture page (`scripts/fixtures/lab2d-wrzenie.json`).

Walkthrough (2026-10-20) in headless Edge against a bundle of the shell and the worker, desktop 1440 × 900 and phone
390 × 844 with touch: every preset starts and renders; paint (mouse and touch), erase, place (a beaker now stands on
the hot plate instead of inside it), drag (moves the apparatus with its water; it used to erase the water), wall,
inspect, the bubble view, all overlays with their legends (velocity arrows in gas and water), the raw-particle view,
charts, levels, room settings (sea level → mountain, top side sealed), quality change (rebuilds the same layout at
3 mm), save (JSON with all operations), empty box, restart; no console errors. Fixed on the way: material ids shown instead of names; "boiling" said of hot glass; selecting a
bubble that vanished at once showed nothing; fog drawn as opaque blocks over the overlays (now a linearly read field
texture with Beer–Lambert opacity); holes in the drawn water (coverage now blurred); an energy-budget jump of about
30 J when a side was closed (the −p0·V term is now booked as an edit); a singular multigrid cell (an isolated gas cell
with no coupling) that broke the gas solve after a splash; ghost heaters listed after a plate was erased.

## M1e — GPU path (built: the accelerated view)

Built (2026-10-20): the whole step on the GPU (WebGPU compute in a worker of its own, ARCHITECTURE.md §15), started
from the lab with "Widok przyspieszony". Measured on the reference laptop's RTX 3070 (laptop) in Edge; the prompt's
fixed-point atomics and df64 bookkeeping were not needed for the gate as built (P2G is a gather over sorted particles;
budgets are f32 on the GPU with f64 totals) and determinism was waived for this view.

**Test 17 — the GPU on tests 1–3, 6, 11** (headless Edge, RTX 3070; same scenes and measures as the Vitest files;
run again on 2026-10-21 after the multigrid fix below, the earlier runs in brackets):

| Test | Gate | GPU | CPU |
|---|---|---|---|
| 1 Hydrostatics 20 °C | 97.9 Pa/cm ±2 %, currents < 1 mm/s | **97.924** Pa/cm, 0.0029 mm/s (0.0032) | 97.924, 0.0027 mm/s |
| 1 Hydrostatics 90 °C | 94.7 Pa/cm ±2 % | **94.698** Pa/cm, 0.0024 mm/s (0.0026) | 94.698, 0.0027 mm/s |
| 2 Conduction | erf within 2 % | **0.0679 K** of 80 K (0.085 %) | 0.0679 K (0.085 %) |
| 3 Heating rate | dT/dt = P/Σ(m c_p) within 5 % | **−2.61 %** (−1.92 %, −1.68 %) | −2.30 % |
| 6 Saturation shift at 10 cm | 0.26 K ± 0.01 | **0.2604 K** (945.3 Pa) | 0.2604 K (945.3 Pa) |
| 11 Boiling plateau | mean water within 0.5 K of T_sat; vapour within 5 % | **−0.517 K**, vapour **+0.05 %** (−0.495 K and −0.534 K, +0.06 % and +0.05 %) | −0.48 K, +0.05 % |

Test 11's temperature criterion is met by the CPU with 0.02 K to spare; the GPU lands on either side of it from run to
run (its bubble statistics are not repeatable). Energy budgets on the GPU: test 3 (sealed, insulated, 300 s, 3000 J of
heating) closes to 0.48 J (1.6e-4), test 11 (60 s) to 0.04 J, the 12 s compact boiling run to 6 mJ of 8 kJ.

Again on 2026-10-22 with the particles of a cell sharing their heat (kernel `heatShare`, §M2b): tests 1, 2 and 6 give
the same numbers (90 °C: 0.0028 mm/s); test 3 **−2.18 %**, energy error −0.42 J; test 11 **−0.371 K**, vapour
**+0.05 %**, energy error −0.04 J. The same check as test 28 on the GPU: a 2 K difference inside each cell decays at
0.3549 /s in Edge and in Firefox (CPU 0.3549, π² α/Δx² 0.3547); without the kernel at 0.0003 /s.

The compact boiling beaker over 12 s at 2 mm, GPU and CPU: water 99.19 and 99.23 °C; nucleated 77 753 and 78 697;
departed 71 232 and 72 254; burst 2 572 and 2 496; collapsed 9 849 and 15 932 (the largest difference; merging
and the shared heat budgets follow no order on the GPU); merged 31 899 and 34 397; vapour produced 48.18 and
47.78 mg.

Time per step, benchmark scene (300 steps after a 300-step start, the GPU busy without waiting for readbacks; the
stage times are timestamps of single steps, so they leave out the gaps between passes):

| Cells | liquid | gas | bubbles | interface | heat | diag. | step | CPU step | speed-up |
|---|---|---|---|---|---|---|---|---|---|
| 2 mm (100 × 75) | 1.08 | 1.63 | 0.90 | 0.64 | 0.48 | 0.11 | **4.93** | 21.59 | 4.4 × |
| 1 mm (200 × 150) | 1.59 | 2.83 | 0.95 | 0.93 | 0.79 | 0.16 | **7.67** | 101.78 | 13 × |

In the browser, at 1 mm with drawing: 96–121 steps per second, 0.8–1.0 × real time (the worker's pacing with three
frames in flight; two left the GPU idle between frames: 98 instead of 121 steps per second). At 2 mm the GPU path
meets test 16's budget; at 1 mm it needs 7.7 ms per step against 6 ms.

Firefox (2026-10-21, Firefox 157; its WebGPU took the integrated AMD GPU of the reference laptop although the lab asks
for high performance, and it hides the adapter's name): the same results as Edge, but slower. Building the 106
kernels takes 20.5 s (Edge 5.4 s): Firefox compiles them one after another. A step takes 27 ms at 1 mm against 11.8 ms
in Edge on the same GPU, so the lab runs at 0.25 × real time; at 2 mm 11 ms, 0.5 ×. Measured per kernel, the extra time
sits in the kernels with large workgroup memory (pre-smoothing 98 µs per dispatch against 27 µs, post-smoothing 57
against 11, the multigrid tail 42 against 21). Firefox fills workgroup memory with zeros from one thread at the start
of every workgroup, at a cost that grows with its size in bytes: in a test kernel over 130 workgroups, 576 floats cost
25 µs per dispatch and five arrays of them 121 µs (Edge: 4 and 7 µs). Packing four arrays into one of `vec4` does not
help (121 µs). The same fill makes those kernels slow to compile (multigrid tail 3.8 s, 0.26 s with tiny arrays).
Less workgroup memory per kernel is the only lever, e.g. keeping only x in the smoothing tiles and reading the
coefficients from memory.

Found and fixed on the way:

- The gas transport's substep count taken from the readbacks came too late for a sudden splash (painted water
  landing beside the beaker, 2 mm): the transport ran with too few substeps, and the run lost energy and blew up. All
  16 substeps are now recorded and the GPU decides each step how many work, as the CPU does (two dispatches per
  substep, the spare ones return at once: about 0.2 ms per step at 1 mm).
- Merged bubbles took the summed volume at once on the GPU, while the CPU keeps the absorbed volume out until the
  next solve; with whole clusters merging in cold water the GPU's α_b jumped and the liquid source grew with 1/Δt.
  The GPU now merges as the CPU does.
- Readbacks after a rebuild or an upload (quality change, new scene, tools): one still in flight was read with the
  new layout, and one taken before the first step after an upload counted no particles (the sorted count was set only
  by the first sort). Both went into the totals and the budget baseline — the HUD showed E NaN, a water error of
  grams, the gas solve recorded at 60 iterations and capped all the time, 16 substeps, and the lab ran at a third of
  real time. Stale readbacks are now discarded, the sorted count is set at upload, and after a change of resolution the
  recorded iterations start again from their defaults. Switching views now also carries pause, speed, overlay and
  the particle view to the new worker (the bar showed paused while the new worker ran).
- **The multigrid tiles raced** (2026-10-21, reported from Firefox: within a few frames the water tore into horizontal
  bands 16 cells apart, large bubbles grew in 20 °C water, the energy went NaN and each frame took seconds). A tile
  reads a border of cells that belong to its neighbours: pre-smoothing read the level's x (zero, while neighbouring
  tiles were writing their smoothed values into it), and post-smoothing read x plus the coarse correction and wrote x
  in the same dispatch, so a tile that started late added the correction a second time along its edges. Edge
  scheduled the tiles so that this did no visible harm; in Firefox the solver did not converge at all (a Poisson test
  system: residual 1.06 after 32 iterations, Edge 1e-4 after 4). Pre-smoothing now starts from zero and writes `xp`,
  post-smoothing reads `xp` and writes x: Firefox and Edge give the same residuals to the digit, and Edge needs one
  iteration fewer (5 instead of 6 to 1e-5). Running every kernel with its workgroups in reverse order then found
  nothing else that depends on the order beyond the rounding of atomic sums (and bubble merges that flip on it).
- **Both engines**: a merge, burst or collapse changes α_b within one step however short; its source Δα_b·V/Δt then
  demands liquid speeds ∝ 1/Δt, and the step (set by the fastest liquid) fell to zero — cold water painted onto the
  bare hot plate ended in NaN on the CPU too (`wrzenie`, 2 mm, at t ≈ 0.13 s). α_b now follows the bubbles' footprint
  by at most 200 cell volumes per second (ARCHITECTURE.md §7). Ordinary boiling never reaches the limit: all fast and
  slow tests give the same numbers as before, to the last digit printed.

Open: at 1 mm, cold water painted onto the bare 140 °C plate (beside the beaker) can still run away — on the CPU
for a large blob, on the GPU already for a small one (the step size falls towards zero). After the multigrid fix
(2026-10-21) the small one no longer does: a blob of 4 mm radius dropped from 10 cm onto the plate's edge stays stable
on the GPU (water within 0.013 K of the CPU after 1.76 s), and blobs of 4, 6 and 8 mm set down on the bare plate stay
stable on both engines (within 0.06 K after 2.6–3.3 s). The 8 mm blob dropped from 10 cm still runs away on the GPU
at the impact (t ≈ 0.67 s), where the CPU's step also falls to 0.2 ms. Painted into the beaker it
stays stable on both engines (1 mm, blobs of 8 and 12 mm radius; GPU and CPU agree to 0.002 K in the water
temperature after 0.4–0.5 s). Suspected: the coupling of large bubbles and the liquid at 1 mm cells — a bubble's forces
use the liquid's acceleration, estimated from a step's velocity change over the bubble's own substep; capping that
estimate did not fix it reliably.

## M2a — more liquids (oil)

Built on the CPU (2026-10-21), the first step of [SANDBOX.md](SANDBOX.md): the materials database lists substances
(format version 2), every particle carries its liquid, rapeseed (canola) oil is the second liquid — the oil sold in
Polish kitchens — with the measurements of Rojas, Coimbra & Telis-Romero (2013), 20–160 °C. Viscosity and drifting
droplets are new in the liquid stage; bubbles and the interface exchange mass with water only. Palette ("Olej"),
presets "Woda pod olejem" and "Olej i woda się rozdzielają", inspector and the AI prompt know the oil. The accelerated
view hands a scene with oil back to the normal view, with the tools applied (a paint stroke of oil in the accelerated
view arrives in the normal view).

| Test | Gate | Result |
|---|---|---|
| Data | oil laws against the paper's tables at 20, 100, 160 °C | density, c_p, k, μ within 0.3 %, 2 %, 0.6 %, 1.5 % |
| Mixed fill | 50/50 by mass → particles by volume | oil/water particles 1.0847, ρ_w/ρ_oil 1.0843 |
| 18 Two layers at rest | ρ_w g, ρ_oil g ±2 %, currents < 1 mm/s | **97.924** (ρ_w g 97.924) and **90.310** (ρ_oil g 90.310) Pa/cm, 0.0027 mm/s after 5 s |
| 19 Oil under water | interface from the volumes ±1 cell | interface at **32.00 mm** (32 mm), no oil below it after 20 s |
| 20 Viscosity | one implicit step against the exact factor of the discrete shear mode ±1 % | **0.999161** against 0.999161 (continuous e^(−νk²Δt): 0.999160) |
| 21 Oil 140 → 150 °C | no bubbles or vapour, dT/dt = P/(m c_p) ±2 % | 0 bubbles, 0 vapour, **−0.04 %**, energy error −6e-6 J, oil mass exact |
| 22 Water boiling under oil | bubbles cross the oil and burst, budgets close | 11 166 nucleated, 27 burst at the oil surface, water error 6e-16 kg of 18.6 g, energy error 2e-10 J, oil mass exact |

All tests of M0–M1 give the same numbers as before, to the last digit printed (the water functions are unchanged and
every new branch is skipped when only water is present). The benchmark scene with the committed engine against M2a,
alternating, four runs each: 17.03 and 17.13 ms per step (medians, +0.6 %, within run-to-run noise), with the same water
temperature to six decimals after 450 steps. The 50/50 mixture separates in 5–10 s at 2 mm (oil centre 46.5 mm, water
21.8 mm).

Found and fixed on the way:

- **Viscosity acted on the gravity kick.** With viscosity between the forces and the projection, the no-slip walls
  damped the kick g Δt unevenly, and the projection left a circulation: two layers at rest moved at 55 mm/s. Viscosity
  now comes before the forces (on the moving liquid only); the layers rest as still as water alone (0.0027 mm/s).
- **Mixtures did not separate.** Particles of two liquids follow one grid velocity; a cell with two water and two oil
  particles has the mean density and no buoyancy, so a fine mixture stayed mixed and oil lingered for a minute in a
  band under the interface (16 % after 20 s). Drifting droplets (ARCHITECTURE.md §7) separate it in seconds.
- A particle created in the middle of a step (a wall film's drop, now also condensate) read the weights and the volume
  change of the particle that last held its slot; it gets its own now (`Liquid.placeParticle`).

## M2b — salt solutions (NaCl)

Built on the CPU (2026-10-22), the second step of [SANDBOX.md](SANDBOX.md): sodium chloride dissolved in the water
particles, one water activity (Pitzer) for the vapour pressure, the boiling and the freezing point, brine density and
heat capacity after Laliberté, crystallisation of the excess over the solubility into a crust on the nearest solid
(ARCHITECTURE.md §4, §9). Palette "Solanka" with a slider for the salt (1–26 %), the overlay "Stężenie soli", the
inspector (salt share, molality, boiling and freezing point of the cell; the crust of a solid), the NaCl balance in the
HUD, presets "Solanka wrze później" (water and 15 % brine side by side: the brine boils at 103 °C) and "Odparowanie
solanki" (25 % brine boiled dry on a plate held at 250 °C: after about 3½ simulated minutes all salt lies in the crust —
0.927 g, exact, energy error 6e-9 J). The accelerated view hands a scene with salt or a crust back to the normal view.

| Test | Gate | Result |
|---|---|---|
| 23 Density | 10 and 20 %, 20 and 25 °C, ±0.3 % of PPB Table A-15 | **+0.001, +0.028, +0.007, +0.018 %** |
| 23 Osmotic coefficient | 0.1–6 mol/kg at 25 and 100 °C, ±0.5 % of PPB Table A-9 | largest deviation **0.15 %** |
| 23 Boiling point | 1 and 3 mol/kg at 101.325 kPa, ±0.1 K of the value from PPB's φ | **100.919 °C** (100.919) and **103.162 °C** (103.164); pure water 99.974 °C |
| 23 Freezing point | 1 and 3 mol/kg, ±0.1 K of the measurements (Bodnar 1993) | **−3.396 °C** (−3.372) and **−10.906 °C** (−10.945) |
| 23 Saturated brine | a_w at 20, 25, 30 °C ±0.3 % RH (Greenspan 1977) | **75.27, 75.21, 75.10 %** (75.47, 75.29, 75.09) |
| 23 Heat | c_p(25 °C) and h(100 °C) − h(20 °C) at 1 and 3 mol/kg, ±0.5 % of PPB Table A-17 | c_p **3913** (3920) and **3562** (3560) J/(kg·K); Δh **314.8** (314.6) and **286.6** (286.2) kJ/kg |
| 23 Closure | T(h(T)) = T, ∂h/∂T = c_p, h̄_w = ∂(m h)/∂m_w, h̄_s = ∂(m h)/∂m_s, Δ_solH(25 °C) = 3.883 kJ/mol | exact to 1e-7 K, 1e-6, 0.05 J/kg, 0.05 J/kg, 5 J/mol |
| 24 Brine under water | dp/dy = ρ g in both layers ±2 %, layers stay, salt exact | **112.629** (ρ_brine g 112.629) and **97.924** (97.924) Pa/cm; no salt two cells above the interface after 5 s; 0.0024 mm/s |
| 25 Air over saturated brine | sealed box at 25 °C: RH → 75.29 % ±0.5 % | 50.00 → **75.15 %** after 40 s; salt and water exact |
| 26 Brine boiling | bubbles nucleate and burst, the brine gets saltier, budgets close | 46 974 nucleated, 4 011 burst, 32.2 mg of vapour in 5 s; salt share **5.5216 → 5.5297 %**; salt error −2.6e-17 kg of 1.24 g, water error −2.1e-16 kg, energy error 3.9e-10 J |
| 27 Boiled dry | no particle left, crust = salt (exact), energy closes | dry after **67.58 s**; crust **105.878249 mg** of 105.878249 mg; nothing spattered out; energy error −1.5e-11 J |
| 28 Heat inside a cell | a 2 K difference between a cell's particles decays at π² α/Δx² ±1 %, energy exact | **0.3549 /s** (0.3547 /s, τ = 2.82 s at 21 °C, +0.06 %); energy error −5.5e-8 J; the GPU path: **0.3549 /s** |
| 29 Salt inside a cell | 10 % brine beside fresh water evens out at π² D/Δx² ±1 % at 20 and 80 °C, salt exact | **3.4747e-3 /s** (3.4752e-3, τ = 4.80 min, −0.01 %) and **1.1954e-2 /s** (1.1961e-2, τ = 1.39 min, −0.06 %); salt errors ≤ 2.4e-18 kg of 0.32 mg |
| 30 Salt between cells | a cosine across 2 cm decays at the discrete Fick rate ±1 % (the continuous D k² within 4 %) | **1.3467e-4 /s**: discrete 1.3445e-4 (+0.16 %), continuous 1.3896e-4 (−3.09 %); salt error 7e-20 kg |

The first build (before the sharing between particles, below; the table shows the numbers after it): all 53 fast tests
passed; every number printed by the tests of M0–M2a was the same as before to the last digit. The slow
suite passed too: tests 3, 4 (ten minutes) and 12 gave the same numbers; the long boiling runs part from the old ones
once a droplet leaves the liquid or a bubble fills a cell without water particles (both behave differently now, above):
test 10 — in the subcooled phase the same 51 450 collapses and 21 bursts (0.04 %), in the warm phase 412 bursts and
26 855 collapses (were 330 and 24 238); test 11 — 99.496 °C (was 99.495), vapour 5.220 mg/s against (P − losses)/h_lv
5.217 mg/s (+0.05 %, as before).

The boiling plateau in the scene of test 11 (compact beaker with chips, 30–60 s), measured beside the gates, with the
sharing between particles (below; the first build in brackets): water 99.656 °C (T_sat 99.974 °C, −0.32 K as in test
11; 99.496 °C), 1 mol/kg brine 100.554 °C (T_b at its mean molality of 1.018: 100.938 °C, −0.38 K; 100.384 °C),
3 mol/kg 102.844 °C (T_b at 3.056 mol/kg: 103.232 °C, −0.39 K; 102.696 °C). The plateau moves with the boiling point:
+0.90 K and +3.19 K against +0.96 K and +3.26 K; it sits a few tenths of a kelvin below it for the same reason as
water's (surface evaporation and the cooler parts of the beaker).

Performance: the first build against M2a, alternating, four runs each: 17.60 and 17.69 ms per step (medians, +0.5 %,
run-to-run noise) with the same water temperature to six decimals after 450 steps; the same scene with 1 mol/kg brine
19.18 ms per step (+8 %: the solution's T(h, w), the activity table, the boiling point per cell, crystallisation). With
the sharing between particles: water 17.45 → 17.87 ms per step (+2.4 %; one more T(h) per particle and step), 1 mol/kg
brine 20.09 ms (+12 % over water).

Found and fixed on the way:

- **The freezing point at 3 mol/kg was 0.16 K too high** with the parameters of pitzer.dat, whose temperature form is
  fitted above 0 °C; below 0 °C the low-temperature set of Spencer, Møller & Weare (1990) now applies (0.04 K).
- **Droplets below the cell size never boiled.** A cell is liquid only when it is at least half full; the flash looked
  at liquid cells only, so the last particles of a layer boiling on a hot plate were heated to 260 °C and then burst
  into the liquid with temperatures below −100 °C. They flash now into their own cell; a droplet that would boil away
  completely vanishes (its salt becomes crust) — before, its mass decayed by a constant fraction per step to 1e-51 kg
  and the run ended in NaN.
- **Droplets hovered.** The velocity extension sets faces far from the liquid to zero, so an isolated particle stayed
  where it was. A first fix let faces that carry particle mass keep their own velocity; next to extended faces that made
  APIC ring up (a droplet over the brine surface sped up 1.5 times per step, to 77 m/s in eight steps). Droplets with no
  liquid within two cells now fly ballistically and stop where they land (`extend.ts`). Water scenes stay identical
  until such a droplet appears (in the benchmark scene not within 700 steps).
- **Vapour from nothing.** A cell that is liquid only because a bubble fills it has no water particles; evaporation from
  it and bubble growth from it created water (jumps of 1e-8 kg in the water budget of a thin film on a 250 °C plate).
  Such cells exchange no mass now.
- `phase.ts` and `liquid.ts` were split (fog.ts, flash.ts; liquidMix.ts, extend.ts), the inspector moved to probe.ts.

### Particles share heat and salt (2026-10-22)

After the first build the user noticed that water particles did not share their temperature and saltiness, as real
water does. They did not: the grid conducted heat between cells through their means and gave every particle of a cell
the same change, so a hot and a cold particle that the flow brought into one cell kept their difference for ever, and
salt moved only with its particle. `exchange.ts` now runs after the heat solve: each particle moves toward its cell's
mean with f = 1 − exp(−Δt/τ), τ = Δx²/(π² κ) — heat with κ = α (2.8 s at 2 mm), salt with κ = D (4.8 min at 20 °C,
1.1 min at 100 °C) per kg of water — and salt diffuses between cells by Fick's law (ARCHITECTURE.md §6.5,
SIMPLIFICATIONS.md #28, #32). Energy and salt stay exact. The GPU path got the heat part (kernel `heatShare`, §M1e);
salt scenes run on the CPU anyway. Tests 28–30 are in the table above.

Found on the way: relaxing the salt per kg of solution instead of per kg of water made the measured rate 4.7 % slower
than 1/τ (moving salt changes the particle's mass, so its mass fraction does not decay as a pure exponential); per kg of
water it is exact. A test scene with g = 0 needs `harness: true`: otherwise the scene reader clamps gravity to 0.25 g,
and brine beside fresh water inside each cell (a density pattern below the cell size) set the water moving at 8 mm/s.

All 56 fast tests and the slow suite pass. What the sharing moved:

| Test | First build | With sharing |
|---|---|---|
| 3 Heating rate | −2.30 % | −2.20 % |
| 4 Sealed beaker, 10 min | water 49.07 °C, error −3.3e-5 J | 49.23 °C, −1.1e-5 J |
| 5 Thermal expansion (3.407 % expected) | 3.627 % | 3.562 % |
| 10 Subcooled boiling | cold phase 51 450 collapsed, 21 surfaced; warm 26 855 and 412; 98.47 °C at 49.9 s | 50 366 and 21; 20 403 and 930; 98.47 °C at 47.1 s |
| 11 Boiling plateau | 99.496 °C (−0.48 K), vapour +0.05 % | **99.656 °C (−0.32 K)**, +0.05 % |
| 12 Superheating | chips 0.273 K at 23.0 s; glass 9.965 K at 24.5 s | 0.265 K at 22.6 s; 9.964 K at 26.6 s |
| 22 Water boiling under oil | 11 166 nucleated, 27 burst | 11 142, 24 |
| 26 Brine boiling | 48 492 nucleated, 3 387 burst, 34.1 mg | 46 974, 4 011, 32.2 mg |
| 27 Boiled dry | 70.97 s | 67.58 s |

Tests 1, 2, 7–9, 14, 15, 18–20, 23 and the M0 checks give the same numbers; tests 6 (945.4 Pa instead of 945.3), 13
(the surface 0.002 K warmer), 21, 24 and 25 differ in the last digits; in the fast version of test 4 the sealed beaker
ends at 21.83 °C instead of 21.76 °C after 60 s (the same energy, more of it in the water).

## Benchmark

The benchmark scene: the beaker with boiling chips on the hot plate, water at 98 °C (preset "wrzenie": it boils at
once), 20 × 15 cm, 300 steps after a 300-step start, `npm run bench:lab2d`. Milliseconds per step; a 60 Hz frame is
two steps. Budget: 6 ms per step.

| When | Cells | inputs | liquid | gas | bubbles | interface | heat | diag. | step | frame |
|---|---|---|---|---|---|---|---|---|---|---|
| M0, M1a | — | not logged per stage at the time (the benchmark scene needs the liquid of M1b) | | | | | | | | |
| M1b end¹ | 2 mm | 0.00 | 3.49 | 11.73 | — | — | 2.96 | 0.88 | 19.06 | 38.1 |
| M1c end | 2 mm | 0.00 | 2.42 | 13.94 | 4.28 | 5.19 | 2.95 | 0.24 | 29.01 | 58.0 |
| M1d (final) | 2 mm | 0.00 | 2.14 | 10.71 | 2.33 | 3.74 | 2.48 | 0.20 | **21.59** | 43.2 |
| M1d (final) | 3 mm | 0.00 | 0.83 | 3.85 | 1.09 | 1.64 | 1.02 | 0.09 | **8.53** | 17.1 |
| M1d (final) | 1 mm | 0.00 | 7.97 | 58.38 | 3.17 | 19.73 | 11.75 | 0.78 | **101.78** | 203.6 |
| M1e GPU² | 2 mm | 0.00 | 1.08 | 1.63 | 0.90 | 0.64 | 0.48 | 0.11 | **4.93** | 9.9 |
| M1e GPU² | 1 mm | 0.00 | 1.59 | 2.83 | 0.95 | 0.93 | 0.79 | 0.16 | **7.67** | 15.3 |

¹ measured inside the test run with other test files in parallel, before bubbles and phase change existed.
² the accelerated view on the RTX 3070 (laptop); the step is the throughput, the stages are timestamps (§M1e).

What the M1d optimisations changed (2 mm): one Gauss–Seidel sweep over the boundary band in the multigrid (gas
iterations 13.2 → 11.0), the gas transport rewritten without per-face method calls, bubble growth substeps tied to
the radius change instead of a quarter of the age (a new bubble needed ~50 substeps in its first step), the vapour
diffusion without boundary work for interior cells and with per-cell enthalpies, face conductances computed once in
the heat step. None of them changes a test result beyond rounding (test 7: −2.0 % → −2.4 % from the coarser growth
substeps).

Where the remaining time goes and what would help next: the gas projection (~11 MGPCG iterations — thin beaker
walls make coarse cells straddle the gas inside and outside the beaker; coarse cells split by connectivity would
bring it near the 5–6 iterations of a box without a beaker), the gas transport (~4 substeps, set by the fastest cell),
and the vapour diffusion and heat solves. Even all of that together would not reach 6 ms per step at 2 mm on this
CPU; that needs the GPU path (§M1e) or several cores (SharedArrayBuffer workers, which on GitHub Pages need the
cross-origin-isolation service worker that v1's own tab uses).

## Requirements of the prompt that were changed or could not be met

- **Test 16** — not met on the CPU (above); met on the GPU path at 2 mm (4.9 ms per step), not at 1 mm (7.7 ms). The
  default stays 2 mm, as the project owner asked for v1 ("the normal situation should be high or very high"); slower
  machines get a hint to switch to 3 mm.
- **M1e** — built without fixed-point atomics and without df64: P2G gathers over particles sorted by cell, budgets are
  f32 on the GPU with f64 totals (energy errors 1e-5–4e-4 relative instead of 1e-9, the sealed box the most); bubble
  merging and shared heat budgets do not follow an order; heat and vapour diffusion use MGPCG instead of Jacobi-PCG. Not
  deterministic (waived for the accelerated view).
- **Test 7** — met, but the prompt's 1.20 mm is the pure Plesset–Zwick radius; with surface tension acting on the
  10 µm seed the exact ODE gives 1.179 mm. The engine gives 1.171 mm.
- **Test 5** — met at 2 mm with a +0.22 % bias of the level measurement (see the table).
- **Sources of the gas divergence** — the prompt lists four parts; the engine uses the equation of state directly
  (V_eos − V_gas plus the volume change of the last step's sources), which contains all four exactly instead of
  approximating each (ARCHITECTURE.md §6.3).
- **Sealed regions** — p0 is set from the state every step instead of integrating dp0/dt (the prompt asks for the reset
  anyway; it cannot drift).
- **Solver tolerance in tests** — tests 1 and 6 (pressure) run at the prompt's 1e-8; the other tests run at the
  real-time 1e-5, so they test what a student sees. Mass and energy bookkeeping is exact for any tolerance.
- **Fog** — the condensed mass is found by a bracketed secant method (Illinois) instead of Newton's method: same
  root (saturation to 1e-11 in test 14), without Newton's failures near the saturation corner.
