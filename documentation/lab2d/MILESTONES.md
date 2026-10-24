# 2D lab engine (v2) — milestones

Measured results of Milestone 1 of the build prompt v2, milestone by milestone: what each gate asked for, what the
tests measured, and what is not met. Architecture: [ARCHITECTURE.md](ARCHITECTURE.md). Simplifications:
[SIMPLIFICATIONS.md](SIMPLIFICATIONS.md).

Reference machine: the development laptop, AMD Ryzen 9 5900HS (8 cores, single-threaded engine), Node 24, Windows 11.
The prompt's "target school laptop" was never named; a typical school laptop is two to four times slower per core.

Reproduce: `npm run test:lab2d` (fast tests, ~6 min), `npm run test:lab2d:slow` (long runs, ~35 min),
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
| M3a bodies | tests 36–40 (SANDBOX.md §13) | built on the CPU (2026-10-23) and the same day remade as exact rectangles (§M3a): all met — floating depth −0.10 % (pine) and −0.01 % (ice), at rest within 0.06 mm, a sinking square +10 % of its drag law and at rest without jitter, a stack stands, a beaker of water falls back 3° below its tipping angle and over 3° above it, budgets exact with moving solids; the free surface got its sub-cell position, which moved older numbers slightly; a beaker wall lying across two cells needed the thin-wall rule (test 11); the accelerated view takes pinned bodies as whole cells and hands free bodies back to the CPU; objects carry names and settings — pinned among them — set in their own panel (§Objects and their settings) |
| M3b melting and freezing | tests 41–45 (SANDBOX.md §13) | built on the CPU (2026-10-23): all met — the Stefan fronts within 6 % (melting) and 7 % (freezing) of Neumann at 2 mm, 4 % and 3 % at 1 mm; an ice cube stays one rectangle and becomes water with energy and water exact; brine settles 0.13 K from T_f(w), a cooling mixture stops at the eutectic, freezing brine keeps all its salt, a carved block stays a few rectangles (§M3b); the accelerated view hands ice back to the CPU |
| B baking and playback | tests 31–34 (SANDBOX.md §13) | built on the CPU (2026-10-22): all met — playback frame-identical to the live view, seeking exact, going on from a keyframe bit for bit; 33.6 MB per simulated minute of boiling at 2 mm (gate set at 40 from it); the lab never starts by itself, a module can bake on opening, one lab offers several scenarios (§B) |
| Violent events, full-screen surface (2026-10-24) | tests 47–48, a walk-through of the surface | built on the CPU: met — violent boiling computed without blowing up (the critical heat flux, the ring, guards against feedback with Δt), softened or asked about; the lab only full screen with preparation and simulation, settings, a bake dialog (frame rate, resume points, resolution, violent events); GPU parity follows |

Test 16 (≤ 12 ms of simulation per 60 Hz frame at the default resolution) is the one gate that fails throughout: the
CPU step of the benchmark scene at 2 mm takes 22.9 ms since M3b (21.6 ms after M1d; budget 6 ms per step, two steps
per frame): the simulation runs at 0.36 × real time, in slow motion with the same results. The shell shows the tempo
and offers 3 mm cells, where a step takes 10.7 ms (0.78 × real time on the reference machine, above the 12 ms per
frame of the budget); 1 mm took 102 ms per step after M1d (0.08 ×). Details and history under "Benchmark". On the GPU
path (M1e) the same scene takes 4.9 ms per step at 2 mm — inside the budget — and 7.7 ms at 1 mm.

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

### Stirring mixes salt faster (2026-10-22)

The user saw salt mixing too slowly and implausibly: in "Solanka pod słodką wodą" salty and fresh particles stayed
side by side in the same cells while the water circulated. Inside a cell, salt evened out at the rate of the slowest
diffusion mode a cell holds (4.8 min at 2 mm) — right for still water, far too slow where the water moves: stirring
stretches whatever is in a cell into striations that thin exponentially, and across a thin striation salt diffuses in
seconds (the lamella picture: Ranz 1979; [Villermaux 2019](https://doi.org/10.1146/annurev-fluid-010518-040306)).
`exchange.ts` now uses for salt the mixing time t = W(2λτ)/(2λ) instead of τ: λ the strain of the flow in the cell
(the positive eigenvalue of the trace-free strain-rate tensor from the liquid face velocities), W the Lambert
function — τ in still water, about ln(2λτ)/(2λ) when stirred: 2.4 s instead of 4.8 min at λ = 1/s. Strain below
0.02/s (the noise of water at rest) does not count. ARCHITECTURE.md §6.5, SIMPLIFICATIONS.md #28.

**Heat keeps its still rate.** The same rule for heat (0.7 s instead of 2.8 s at λ = 1/s) broke test 12: with boiling
chips the first bubble came on glass at 9.97 K superheat. Sharing faster inside a cell carries the heat of a hot wall
into the next cells through the particles' overlapping heat weights (B-spline weights over 3 × 3 cells, while a cell
shares among the particles whose centre it holds), so the water in front of the chips stayed too cold (their surface
at T_sat + 2 K, the water in front of them below T_sat). Heat back at the still rate gives test 12 bit for bit as
before; a cell is even within 2.8 s anyway.

| Measure (preset "Solanka pod słodką wodą") | Before | With stirring |
|---|---|---|
| Spread of salt between the particles of a cell, 15 W, 180 s | 1.08 % | **0.32 %** |
| Salt in the band above the interface, 15 W, 180 s | 0.5 ± 0.9 % | 0.8 ± 1.0 % |
| Spread inside cells, 80 W (the bottom boils), 180 s | 1.42 % | **0.75 %** |
| Band above the interface, 80 W, 180 s | 1.4 ± 4.6 % (salty and fresh particles scattered) | 5.4 ± 5.1 % (a mixed layer) |

Test 35 (new): under an imposed pure strain the in-cell differences of salt decay at (π² D/Δx²)·x/W(x),
x = 2(λ − 0.02/s)τ — **0.00 %** at λ = 0 and 0.01/s, **0.02 %** at 0.5/s (66 times the still rate), **0.04 %** at
2/s (213 times); heat at its still rate for every λ (0.00 %). Test 29 is now measured over about 10 % decay (30 s at
20 °C, 10 s at 80 °C): over 10 s at 20 °C the spread decays only 3.5 %, and particles crossing cell boundaries moved
the measured rate by 1.3 % (+0.39 % over 30 s, +0.43 % at 80 °C). Scenes without salt run bit for bit as before.

## B — baking and playback

Built on the CPU (2026-10-22), the third step of [SANDBOX.md](SANDBOX.md), with what the user asked for on starting:
the lab never starts by itself (it shows the start and waits for "Uruchom na żywo" or "Upiecz"), baking is started by
a button, and a module can be set to bake on opening ("Po otwarciu" in the editor, `start: "bake"`; a clip already in
the browser then plays at once). One lab can offer several scenarios (`scenarios`, a picker above the text; each with
its own clip). The page `scripts/fixtures/lab2d-scenariusze.json` (written by `node scripts/lab2d-scenarios.mjs` from
the presets) has one lab with eleven scenarios — three of them new presets: "Konwekcja nad grzałką", "Wrzenie w
górach" (70 kPa) and "Solanka pod słodką wodą" — and one lab that bakes ten seconds of boiling on opening.
ARCHITECTURE.md §16 describes the format.

| Test | Gate | Result |
|---|---|---|
| 31 Playback | every frame of a clip draws what the live view drew while baking | 3 s of the compact boiling beaker (50 × 40 cells, 91 frames): **308 drawn frames identical** (without overlay every frame, each of the eight overlays every third frame, where its layers are stored) |
| 32 Seeking | frames in any order equal frames in sequence; t → frame floor(30 t) | **12 frames** read out of order (across chunk boundaries) equal; frameAt exact at 0, 1/30, 1, 1.0333 s, the end, beyond and before |
| 33 Going on | a restored keyframe runs on bit for bit | the whole state equal after 120 steps in **four scenes**: boiling (1207 particles, 148 bubbles), brine dried to a crust (96 particles, 19 bubbles), water under oil (viscosity on; 120 bubbles), a sealed box with fog; from the keyframe at 5 s of a 6 s clip **108 drawn frames** equal the clip |
| 34 Size per minute | measure, then set the gate | the boiling beaker (preset "Wrzenie", 20 × 15 cm, 2 mm), one minute: 1801 frames, **11.6 kB per frame** (20.8 MB), 13 keyframes of **980 kB** (12.7 MB): **33.6 MB per simulated minute**; gate 40 MB. Baked in 475 s: **0.13× real time** |

In the browser (headless Edge, a bundle of the shell; 26 checks): the start panel stays for three seconds with
nothing computing; "Upiecz" for 10 s of convection bakes in 18–19 s (0.43–0.53× real time, a preview every 0.3 s);
the clip plays, the temperature overlay works in playback, the slider seeks to 5.0 s, "Na żywo od tej chwili" goes
live (paused, tools back), a reload offers "Odtwórz nagranie (10 s)" from IndexedDB and plays it at once, closing
returns to the start; the scenario picker lists all presets and switches paused; a module with `start: "bake"` bakes
by itself and then plays; no errors in the page. On a phone (390 px, dark) the playback bar fits one row (the live
button as an icon).

Found and fixed on the way:

- **The first frames were 57 MB per minute.** Pressure and speed were stored relative to the frame's maximum, so
  every cell changed whenever the maximum moved; the temperature in 0.05 K steps flickered in the low bits; deflate saw
  frame after frame. Now fixed quadratic 8-bit scales, 0.5 K, the chunk ordered by layer, two seconds per chunk, and
  the gas-overlay layers every third frame (held in between): 22.9 → 8.0 kB per frame over the first 10 s of boiling
  (27.3 MB per minute with the keyframes; boiling grows, so a whole minute takes 33.6).
- **Keyframes stored scratch twice.** `solver.system.x` is `solver.xs` under a second name; skipped under one path it
  was taken under the other (270 kB per keyframe). Skipped objects now count as seen. Getters (`system.nx`) are left
  out — they cannot be written back.
- **A solver created on first use** (`liquid.vsolver`, only once viscosity runs) gave a fresh engine another layout
  than a running one; it is scratch and left out.
- **Scratch for the physics, not for the frame**: the water's face velocities are rewritten every step, but the frame
  reads them for the water arrows — the first frame after going live differed in the velocity overlay. They are kept.
- **The playback slider jumped back**: the worker reports its time five times a second, React reset the controlled
  slider to the old time right after the input event, and the change event that followed undid the seek. The dragged
  time now holds for 0.6 s.

## M3a — bodies

Built on the CPU (2026-10-23), the fourth step of [SANDBOX.md](SANDBOX.md) §6, with the decisions of 2026-10-21:
every object is one whole, each pinned or free, free ones asleep until something moves them. A beaker, a hot plate, a
painted block ("Postaw ciało") is a **body**: a set of voxels at the grid's Δx in its own frame (material, energy,
heater group, film and crust per voxel), a pose, velocities, mass and inertia, its outline edges and convex parts
(`body.ts`). ARCHITECTURE.md §17 describes the machinery; the short version:

- **Pinned or asleep**, a body stands in the grid as solid cells exactly like the solids before M3a — every scene
  without a free body runs bit for bit as before (checked on all eleven older presets against the committed engine,
  apart from the salt scenes, which the salt stirring of §M2b changes). Beakers and hot plates are pinned unless the
  scene says `"pinned": false`; the tool "Przypnij" pins and releases.
- **Awake**, a body is written into the grid at every step (`bodyRaster.ts`): the cells whose centres lie in its
  voxels (a one-cell wall stays tight when tilted), its velocity on their faces (both projections see a moving wall),
  energy, capacity, film and crust through the same weights there and back (cells read the voxel under their centre;
  the change of every cell goes back to its voxels at the end of the step). Cells it enters give their gas to the
  free neighbours, cells it leaves take gas from theirs or become liquid; particles and bubbles it covers go back
  along their path in the body's frame to the side they came from.
- **Forces** (`bodyForces.ts`): the pressure of both projections on the **true outline** — at the midpoint of every
  outline edge, from the fluid cells on its outer side, brought to the edge's height hydrostatically (liquid and gas
  separately; the larger wins at a waterline); an edge resting on another solid gets the pressure continued through
  the solids (a "film"). Buoyancy is exact between cells, and a one-cell glass wall feels water inside and air
  outside.
- **Coupling**: partitioned, with the added mass measured from the pressure solve itself: three more solves with the
  matrix of the step give M_a = Δt Δx² D Jᵀ A⁻¹ J (3 × 3 per body), and the body steps with
  (M + M_a)(V_free − V) = Δt (m g + F) + M_a D, D the fluid-and-gravity part of the last velocity change. Contacts
  use the body's own mass.
- **Contacts** (`bodyContacts.ts`): the physics lab's solver (`lab/physics/physCollide.ts`, now typed for any
  "collider" and with its slop and speculative gap per contact — the physics lab is unchanged, `app-lab-check` passes),
  0.1 Δx slop and Δx gap; parts of a body forward their pose and velocity to it; box walls, painted solids (merged
  into rectangles), pinned and sleeping bodies are static; warm starts survive a keyframe (stored in arrays, solved in
  key order).
- **Sleep and waking**: a body that has touched something and moved less than 2 mm/s for half a second falls asleep.
  It wakes when an awake body touches it moving faster than 1 cm/s, when a tool changes the scene, or when the fluid
  lifts it with more than its weight. Free bodies settle for a moment after loading (resting ones fall asleep again
  within half a second; one hanging over an edge falls).
- **Scene format** (still version 1, additive): `{"op": "body", "region", "material", "T", "pinned", "angle"}`,
  `{"op": "pin", "x", "y", "pinned"}`, `pinned` and `angle` on `beaker` and `hotplate`; a scene from before M3a writes
  unchanged (so its clips keep their keys). New solids with sourced data: pine wood, ice (IAPWS R10-06, conductivity
  after Slack), granite; friction and restitution for every solid. Tools "Postaw ciało" (drag a rectangle, choose wood,
  ice, stone, glass or steel) and "Przypnij"; the inspector shows the body (material, state, mass, temperature,
  speed, rotation). Presets "Co pływa?" and "Przewrócona zlewka", both also among the scenarios of the page fixture
  (`scripts/fixtures/lab2d-scenariusze.json`, regenerated). The accelerated view hands scenes with free bodies back to
  the CPU.

| Test | Gate (SANDBOX.md §13) | Result |
|---|---|---|
| 36 Floating depth | ρ_b/ρ_l of the height under water ±2 % (wood, ice) | pine 8 × 4 cm in 20 °C water: **20.41 mm** for 20.44 (−0.13 %); ice 4 × 4 cm in 0 °C water: **36.66 mm** for 36.67 (−0.04 %); mean over 3 s; energy error 4e-11 J |
| 37 Sinking | a drag-law terminal speed ±15 %, then rest without jitter | a 2 cm ceramic disc between 12 and 22 cm depth: **0.511 m/s**, drag law with C_D = 1.2 (White, cylinder) 0.487 m/s (**+5.0 %**); a stone block lands and **moves 0.0000 mm** in the second after, asleep |
| 38 Stack | a stack of two blocks stands | a pine block dropped 1 cm onto another: lands at **40.000 mm** (exactly on the lower one), slides 0.0001 mm, angle 0.0000°, both asleep; energy error 4e-14 J |
| 39 Tipping | a full beaker tips at its geometric tipping angle ±3° | glass beaker 7 × 8 cm, 4 cm of water, on its corner, water at rest then released: geometric angle (glass and a level water surface) **46.11°**; released at 43.11° it **falls back to 0.00°**, at 49.11° it **falls over (90°)**; no water lost (0.1–0.2 mg evaporated), water budget 8e-16 kg |
| 40 Budgets | budgets close with moving solids | a hot stone (80 °C) sinks and a warm pine block (40 °C) floats in 20 °C water: they give **9.67 J** to the water in 2 s; energy error **1.1e-10 J**, water 1.6e-15 kg, air 1.4e-20 kg |
| 33 Going on (B) | a keyframe with moving bodies runs on bit for bit | a pine block falling into water and a hot stone landing on the bottom (contacts with warm starts): **identical** after 120 steps |
| JSON | body and pin round-trip; older scenes unchanged | round trip equal; beaker and plate pinned unless told; a 15° body has exactly 15°; free bodies → CPU only |

All 74 fast tests pass (8 files; the M3a file takes about 4 minutes), and so does the slow suite (its numbers at the
end of this section).

Measured on the way (not gates):

- **Added mass, measured.** The pine block's vertical added mass is **44 g** — 2.7 times its own 16 g (it floats in
  a tank whose water must squeeze past it), horizontal 3.7 g; the ice cube 12 g vertical. An a-priori estimate failed
  both ways: 0.75 of ρ_l times the wetted hull made the block explode, 1.5 of it rocked it up to ±1.25 mm.
- **The floating block still bobs** by up to ±1.4 mm (the wood above, ±0.7 mm the ice) and the water around it
  sloshes in step: a pinned block in the same tank leaves the water at rest (±0.002 mm). The water a body displaces
  changes in whole rows of cells, and those small kicks keep the heave mode alive; the mean depth is unaffected.
- **A falling square has too little drag**: the 2 cm ceramic square reaches 0.485 m/s at 2 mm (0.48–0.50 at 1 mm)
  where C_D = 2.1 (Lyn et al. 1995, square cylinder at Re 22 000, with vortex shedding) gives 0.415 — an effective
  C_D of 1.5. Its wake stays symmetric for the whole fall; the disc's wake breaks symmetry by itself and its drag
  matches the cylinder law. Test 37 therefore uses the disc; SIMPLIFICATIONS.md #36.
- **A beaker that lands must not bounce back**: with the full velocity jump in the added-mass term (contact impulses
  included), a glass beaker of water that rocked back onto its base was kicked into the air — the estimate expected
  the water to push back with the added mass, the contained water did not. Only the fluid-and-gravity part counts
  now; what the water does after the landing comes in the next step as a force on the floor.
- **Pressure under a body lying flat** has to come from far away: continuing it three cells deep left the middle of
  a 2.5 cm block's underside at zero gauge pressure — sealed boxes (+3 kPa) then pressed a pine block onto the bottom
  with 50 times its weight. It is now continued layer by layer through all solids.
- **A block landing flat on another traps air**: the gas of the cells between them had nowhere to go within three
  cells (8 mJ vanished from the budget); it now goes to the nearest free cell, found through anything.
- **Sealed boxes** with moving bodies are an edge case: the gas feels a body's displacement one step late (a gas
  spring that makes a floating block in a small sealed box bob by several millimetres) and the energy budget closes
  to about 1 % of the heat exchanged there (exact in open boxes). SIMPLIFICATIONS.md #38.
- **Cost**: nothing when no body is awake (the eleven older presets: step times unchanged); the floating test scene
  (20 × 15 cm, 2 mm, 12 000 particles, one awake body) runs at about 3.5 s per simulated second in Node, the three
  added-mass solves about 10 % of it.

**Not built from SANDBOX.md §6:** the drag tool as a mouse joint ("Przesuń" still moves a body by whole cells);
cavities kept in the body's frame (they are redrawn from the cells whenever a moving body's cells change — only boiling on
a moving body notices); the rendering of a body's true outline (a tilted body is drawn as cells).

**The free surface got its sub-cell position** on the way (both CPU and GPU, `liquid.ts`, `kliquid.ts`): the
pressure of a gas cell above the liquid now sits where φ crosses ½ between the cell centres ("ghost fluid", Gibou et
al. 2002), not at the gas cell's centre. Before, the pressure at depth d was ρ g (d + ε) with ε between 0 and one cell
(half a cell on average) — fine for hydrostatic gradients, but a floating block sat half a cell too high (−4.7 % in
test 36). What it moved in the older tests: test 1 the hydrostatic gradient 97.924 → **97.921** Pa/cm and the residual
currents 0.0027 → **0.11 mm/s** (still far below the 1 mm/s gate; GPU 0.10); test 5 the thermal expansion **3.418 %**
(3.407 % expected, was 3.562 %); test 6 p(10 cm) 945.4 → **939.1 Pa** (ρ g h = 940.2); test 11 on the GPU the boiling
plateau −0.37 → **−0.25 K** below T_sat; test 24 the water layer 97.933 Pa/cm and 0.044 mm/s; test 27 dry after 70.0 s;
tests 7–9, 13–15, 18–20, 22, 23 within their last digits. Snapshots grew by the body arrays of the grid (owner,
capacity, face velocities): 802 → 861 kB for the boiling beaker.

The slow suite with both changes: test 3 **−2.33 %** (was −2.20 %); test 4 with water 3.4e-7 % of ∫P dt (the box of
air unchanged); test 10 — while the bulk was ≥ 5 K below T_sat, **7 of 47 905** bubbles reached the surface (0.015 %;
were 21 of 50 366), 538 later; test 11 **99.678 °C (−0.30 K)**, vapour 5.314 mg/s against (P − losses)/h_lv
5.314 mg/s (0.00 %); test 12 with chips **0.271 K**, without **9.968 K**; test 34 **34.0 MB** per simulated minute
(keyframes of 992 kB, were 980). Test 34's bake now gives the event loop a turn between its two-second slices: since
B, Vitest's worker had waited minutes for an answer during the synchronous bake and ended every slow run with two
"unhandled errors" (a timeout of its `onTaskUpdate` call), although the test's checks held.

### Exact rectangles (2026-10-23)

The user decided (SANDBOX.md, decisions of 2026-10-23): **solids are rectangles** — a body is one or a few exact
rectangles in its own frame, stable inside, changing only when it melts or ice grows on it, and then a whole side
moves; painted walls stay cells. The voxel machinery (`bodyRaster.ts`) is gone; ARCHITECTURE.md §17 describes the
new one: internal cells laid exactly into each rectangle, weights from exact clipping, covered fractions of every
cell and face (`fs`, `au`, `av`), cut-cell projections for the liquid and the gas (Batty, Bertails & Bridson 2007),
the heat of a mixed cell as one more part, cells closed at 99 %, when cut in two, or at half next to another solid.

- **Test 36**: pine −0.10 % (bobbing **0.06 mm**, was ±1.4 mm), ice −0.01 % (**0.05 mm**) — the water a body displaces
  now changes continuously with its position.
- **Test 37**: a circle region becomes the square of its area, so the sinking test now uses a 2 cm ceramic square in a
  30 cm tank against the drag law of a square cylinder (C_D = 2.1, Lyn et al. 1995): from 6 to 14 cm **0.456 m/s**
  against 0.415 (**+9.8 %**), turned up to 24° by then; deeper its wake turns it over and it tumbles and glides
  sideways — at 1 mm from 16 cm on, at 2 mm from 20 cm, a chaotic path (the earlier window 20–32 cm gave +2 % at 2 mm
  and −35 % at 1 mm). The stone block rests at 0.000 mm and falls asleep.
- **Tests 38–40** unchanged in substance: the stack at 40.000 mm (energy 1.2e-14 J); the beaker falls back from
  43.11° and over from 49.11° (tipping angle 46.11°); with moving bodies energy −1.2e-10 J, water −1.5e-15 kg.
- **The landing stone** exploded at first (an empty liquid cell under a body landing on the floor, a force of 1444 N):
  hence the rule that a cell covered to half next to another solid is closed.
- **A floating body in a sealed box** flew out of it (a wooden block in a closed 4 cm box reached 13.7 m/s — also with
  voxels, 1.5 m/s and p0 up to 138 kPa): the gas side of the force used p0 after the step's compression, the liquid
  the p0 before. Both use the start-of-step value now; the block sloshes as in an open box (energy drifts by about
  10⁻⁸ J per second there, exact in open boxes).
- **Test 22** counted bursts from the first step on: half-covered air cells at the foot of the beaker, beside the
  plate, were liquid and let bubbles burst at 10 mm (161 in the first half second). With the half-cell rule they are
  closed; the test now runs until the first bubble bursts at the oil's surface (2.57 s; 2514 nucleated).
- **Drawing**: each internal cell a rotated quad, the outlines on top, cells a body closes left empty, the liquid's
  coverage continued under bodies (else a light gap showed between water and a body between cells). Clips are now
  version 2 with the quads and outlines per frame (difference to the previous frame when their number stays):
  test 31 **3.8 kB** per frame (was 3.5); version 1 clips still play.
- **The accelerated view** gets the bodies as a staircase of whole cells (`gpu/staircase.ts`): every cell covered by
  more than half or closed by the CPU, and for a face lying wholly inside a body with neither cell qualifying, the one
  with the larger share; temperature preserved (energy from the whole cell's capacity), heater group, φ_s, distance
  field, the regions' fluid volume and the cavities' wall cells follow; on download the temperatures go back to the
  bodies through `collect`. Two traps found on the way: moving the gas of newly solid cells to a neighbour without
  re-deriving its density let a sealed region's pressure run away (+20 W of phantom energy) — the gas now stays in
  the solid cell, where the kernels ignore it; and cavities whose wall cell is fluid on the GPU took heat from water
  (vapour +340 %) — their wall cell moves to the solid neighbour or the cavity is switched off. Test 17 after this:
  1a −0.013 %, 1b −0.013 %, 2 0.085 %, **3 −2.40 %** (with the bodies' real heat capacity; M1e −2.61 %), 6 939.1 Pa,
  **11 −0.33 K, vapour −0.3 %** — all as before.
- **Water evaporated through thin walls** — found by the slow suite: test 11's beaker boiled at **96.10 °C, 3.9 K
  below T_sat**. Its walls (2 mm, like the presets' beakers at 2 mm) lie across two cells, which become two half-open
  cells with a closed face between them. The particles' kernels put part of the water of the inner cell into the
  outer one, which then counted as liquid with a surface to the air outside, and evaporation and flash boiling looked
  at a neighbour's kind, not at the face between: 1.5–2.3 W evaporated from the wall cells into the room. Now particles
  put nothing behind a closed face (`grid.updateThin`, their weights renormalised over the rest) and evaporation, flash
  boiling and the gas test of a cell look only through open faces: 0.2–0.3 W from the wall cells (the two at the
  waterline). Test 11 now **99.53 °C (−0.45 K**; M3a −0.30 K), vapour −1.6 % of (P − losses)/h_lv; test 10 lets
  0.16 % of the early bubbles reach the surface (gate 1 %; M3a 0.015 %), test 12 0.27 K with chips and 10.30 K
  without. A beaker placed on whole cells behaves as in M3a (the same scene shifted by 1 mm: 99.34 °C after 30 s in
  both engines). The masks cost 0.08 ms per step in the boiling preset at 2 mm (0.4 %).
- **Particles below the eutectic** — the other failure of that slow run: beside the floating ice of test 43 single
  particles reached −21.30 °C, 0.1 K below the eutectic, for up to a quarter of a second. Their kernels reached into
  cells the block almost covers, behind faces it covers whole (such faces appear in half of the steps there: a square
  floating 77 % deep is not stable lying flat, and in the melting brine it rocks and rolls over). The thin-wall rule
  ended it: the coldest particle now stays within 0.02 K of it. Diluting strong brine with meltwater does absorb heat (5 %
  of water at the eutectic cools it by 0.11 K), but a step's meltwater is far less.
- **The drag tool** moves bodies by the exact offset (to 0.1 mm); a painted solid in the region still moves everything
  by whole cells.

The slow suite after all of it: test 3 **−2.57 %** (M3a −2.33 %) — its Σ m c_p now takes the bodies' own heat
capacity (14.45 J/K of glass and steel; counting solid cells, as before, missed a wall lying across two half-open
cells and gave −6.28 %); test 4 with water 1.0e-6 % of ∫P dt, the box of air 7.7e-10 %; tests 10–12 as above; test
34 **36.0 MB** per simulated minute (keyframes of 1079 kB; were 34.0 MB and 992 kB); tests 41 and 43 in §M3b. 81 fast
tests in 9 files (~5 minutes).

## M3b — melting and freezing

Built on the CPU (2026-10-23), the fifth step of [SANDBOX.md](SANDBOX.md) §7, with the user's decisions: an ice body
stays a rectangle and a whole side melts or grows; melting and growth come together; salt stays in the water; new
ice appearing by itself comes later. ARCHITECTURE.md §18 has the machinery (`bodyMelt.ts`); the short version:

- The interface of every free side is at T_f of the liquid in front (Pitzer, below 0 °C Spencer–Møller–Weare);
  internal cells above it give their excess to the nearest open side, which moves inward by δ = Q/(ρ D Σ s [L + c_p
  (T_f − T)]); the meltwater, with exactly the slice's energy, latent offset and Q, joins the particles in front or
  becomes one; water colder than T_f in front freezes onto the side (with the enthalpy of ice; its salt stays),
  planned first and taken after the side moved.
- Bodies of several rectangles (a carved block, an ice beaker) melt along their free segments and are recomposed into
  horizontal strips; collinear sides are one wall; corners follow their neighbours; a body that melts through splits.
- Energy: the latent offset m·e0 (IAPWS R10-06, Δh_fus = 333.55 kJ/kg at 273.1525 K) makes ice → water exact; the
  water budget counts ice (placing, erasing, escaping included).

The gates (SANDBOX.md §13; m3b.test.ts at 2 mm, m3b.slow.test.ts at 1 mm):

| Test | Result |
|---|---|
| 41 Stefan, melting (ice at 0 °C under water at 20 °C, the cold water below; Neumann with the water's α and St at 10 °C) | 2 mm: front 1.617 mm after 4 min against 1.526 (**+6.0 %**), its speed from 2 to 4 min **+0.6 %**; 1 mm: 1.584 mm (**+3.8 %**), speed **+1.4 %**; energy −2.0e-11 J |
| 41 Stefan, freezing (water at T_f on ice at −20 °C; Neumann with the ice's α) | 2 mm: 1.456 mm after 2 min against 1.556 (**−6.4 %**); 1 mm: 1.517 mm (**−2.5 %**); energy −3.9e-12 J |
| 42 ice cube in warm water | a 2 cm cube at −5 °C in water at 20 °C: 3.667 → 3.421 g in 8 s, still one rectangle (19.17 × 19.47 mm), warmest ice 0.0025 °C (= T_m), energy −1.4e-10 J, water −1.2e-15 kg |
| 43 brine settles at T_f(w) | a 1.5 cm cube at −5 °C in 3.5 % brine at 0 °C: after 2.5 min the brine at −1.929 °C, T_f of its diluted mean (3.433 %) −2.058 °C (**0.13 K**), the ice −2.058 °C; salt −7.9e-18 kg |
| 43 with enough salt (slow) | a 2 cm cube at −10 °C in 25 % brine at −10 °C: after 3 min the brine at −19.39 °C (it started at −10 °C), T_f of its mean (22.19 %) −19.68 °C, still melting (1.49 g so far); the coldest particle in any step −21.217 °C, the eutectic −21.2 °C; salt −4.4e-17 kg, energy 3.1e-12 J |
| 44 freezing brine keeps its salt | 3.5 % brine at −2.10 °C on ice at −20 °C: the ice grows 196 mg in 20 s, the brine's salt changes by 3.7e-15 g (rounding), w 3.5000 → 3.5678 %, no crust on the ice |
| 45 a carved block | a 3 × 2 cm block with a 1 cm notch in water at 40 °C: three rectangles stay three, 4.584 → 3.888 g in 6 s, no overlap, one body, energy 3.0e-10 J |
| 46 the side the heat comes through | a 2 × 1 cm block at −2 °C on a steel plate at 60 °C, in air: after 10 s **18.27 × 8.19 mm**, its bottom on the plate (0.000 mm), energy −7e-14 J, water 8e-18 kg |
| 33 keyframe | melting ice restored into a fresh engine runs on bit for bit (snapshot 900 kB) |

How the Stefan numbers came about: the front is first order in Δx. At first the melting front ran **+39 %** ahead at
10 s and freezing lagged −20 % (with a stall at 1 mm: the thin fluid part of a mixed cell held no particle, so nothing
froze until the ice reached the next cell). What fixed it: sampling the water one cell further when the cell in front
holds none (freezing), giving meltwater to the cells just in front first (one cell further only if they hold no
particle — at 1 mm the late melting rate was 9 % too fast while meltwater went two cells deep), and pushing
particles out of grown ice. The remaining error sits in the first seconds, while the thermal layer is thinner than a
cell (SIMPLIFICATIONS.md #40).

Presets "Lód w ciepłej wodzie" (a 3 cm cube floating in water at 40 °C; dropped from above it plunged to the bottom
first, so it starts afloat) and "Lód z solą — mieszanina chłodząca" (three cubes in 23 % brine at 0 °C); "Co pływa?"
now says the ice melts slowly. Both are among the scenarios of the page fixture (16 scenes). The AI prompt and the
scene docs say that bodies are rectangles (a circle becomes the square of its area) and that ice bodies melt and grow;
a painted "solid" of ice stays a wall. The accelerated view hands scenes with ice back to the CPU.

Not modelled (SIMPLIFICATIONS.md #31, #40): new ice in supercooled water, frost, rounded corners, the conduction
delay inside the ice (an internal cell's heat reaches its side at once).

### The side the heat comes through (2026-10-23)

The user's rule: melting can happen on one side or on several, but each side that melts gets smaller as a whole. With
the first rule — the heat of every internal cell went to the nearest *open* side (fluid in front) — a block lying on a
warm plate never melted from below: its heat went to the sides. A 2 × 1 cm block at −2 °C on a steel plate at 60 °C
(in air) was **12.80 × 10.00 mm** after 20 s: narrower, its full height kept. Now every side gets a supply,
Σ k (T − T_f)⁺ · length over the cells just in front — water, air or a solid such as the plate — and an edge cell gives
its excess to its adjacent sides with a supply, shared by it (`meltSides.ts`; ARCHITECTURE.md §18): the same block is
**16.79 × 6.71 mm** after 20 s (bottom 2.85 mm, left and right 1.7 and 1.5 mm — the meltwater pooling beside it on the
hot plate melts the sides too —, top in air 0.45 mm), sinking onto the plate as its bottom recedes; its meltwater
appears beside it. The floating cube of "Lód w ciepłej wodzie" melts as before on its three sides in water (2.1, 2.1
and 1.7 mm in 20 s; its top in air 0.015 mm). Test 46 holds it; the other M3b numbers moved within their last digits
(test 42 19.17 × 19.47 mm, test 43 0.13 K, test 45 3.888 g); in the slow suite test 41 is unchanged and the
cooling mixture's coldest particle went from −21.196 to −21.217 °C (the gate allows 0.05 K below the eutectic).

## Objects and their settings (2026-10-23)

The user asked how "Przypnij" works ("there seems no possibility") and to rethink the adding of parts and the format:
objects that can move — the ice cube — with a setting that pins them, so they do not fall. Before, "Przypnij" was a tool
of its own: pick it, click a body, and it silently toggled — nothing showed whether a body was pinned, a new body was
always free, and "Przesuń" moved only beakers and plates.

- **Format** (still version 1, additive): `body`, `beaker` and `hotplate` are *objects* with a name `id` (given where
  missing, `body-1`, `beaker-1`; a duplicate is renamed with a warning) and their settings — `pinned`, `T`, `angle`,
  material, size, lid, heater — on themselves. `move` takes an `id` (the object with what lies in its box: the water
  of a beaker, an ice cube floating in it), `remove` takes an object away (booked); a step naming an unknown object is
  dropped with a warning. The old `pin` is still read. The presets name their objects (`plyta`, `zlewka`, `kostka`,
  `drewno`, `lod`, `kamien` …); the AI prompt and the scene docs describe names and settings.
- **Settings change the object where it stands** (`engine/objects.ts`): no step is appended. "Przypięty" and the
  heater act at once, also while it runs — a released beaker falls; material, temperature, size, angle and lid change
  the set-up, so at time 0 the scene is rebuilt from the changed list (exactly what loading it would give), later the
  engine refuses and the panel says to change them at the start.
- **Shell**: "Przedmioty" adds an ice cube, a block of wood, stone, glass or steel, a beaker or a hot plate (a click:
  the usual size — the cube 2 cm at −5 °C, a beaker or plate standing on what is below; a dragged rectangle: position
  and size; a click on an object selects it). The new object is selected at once. "Wybierz" selects an object (its
  outline is drawn) and drags it; the panel "Przedmiot", right below the tools, shows what it is now (temperature,
  mass, pinned / at rest / moving), "Przypięty", material, temperature, size, angle, lid and heater, and "Usuń
  przedmiot". The tools "Postaw", "Ciało", "Przypnij" and "Przesuń" are gone.
- **Checked**: a test (names, a pin in place without a new step, a rebuild at time 0, the refusal while running, a
  move of the beaker carrying its water and the floating cube but not the plate, removal with exact budgets, the steps
  in JSON); test 39 releases its beaker through the setting instead of `pin`; a drive in headless Edge (add a cube, see
  its panel, pin it, run — it stays —, release it — it falls —, add a beaker, drag it, remove it; no console errors).
  83 fast tests in 9 files.

## Violent events and the full-screen surface (2026-10-24)

The user's screenshot showed the lab embedded in a page with everything at once, and asked for a clean surface that
needs no explanations, full screen only with nothing scrolling outside, first the preparation and then the
simulation (paused to add something), a choice of how a clip is baked, and — "the greatest problems" — a choice for
very violent events such as a great hot vapour bubble, "because most of the simulations went out in such a bubble
pushing the whole water of the scene outside it".

**Diagnosis** (water at 95 °C poured onto steel at 140 °C, 2 mm). Before: 2184 nucleations in five steps, particles at
3000 m/s and NaN at step 10. The chain, found one link at a time with step-by-step traces (ARCHITECTURE.md §19):

| What | Measured before | Fix |
|---|---|---|
| wall heat to attached bubbles | the whole stored superheat of a wall cell per step: 8.6 cm³ of vapour in 27 ms | the critical heat flux (Lienhard & Dhir 1973), 1.26 MW/m² at 1 atm |
| drift correction and volume jumps | DRIFT_GAIN·err/Δt, ΔV/Δt: Δt fell to 0.1 µs, water at 5000 m/s | spread over ≥ 0.5 ms |
| void fraction of a bubble at a wall | up to 1.9 of a cell: an error no flow closes | at most the open part of the cell |
| reaction force of big bubbles | on the 3 × 3 faces at the centre: 0.4 N → 10⁵ N in six steps | on the liquid in the ring r…max(1.5 r, r + 2Δx) |
| pressure a bubble sees | dips below zero absolute: one bubble 55 → 2000 cm³ in one step | at least half the ambient |

Two older bugs showed only here: the enthalpy change of a re-solved free bubble was booked into every cell of its
footprint, also into cells a big bubble had emptied (no heat capacity — up to 10⁻² J lost per step; now only cells
with liquid, else the bubble keeps it); merged bubbles kept one bubble's volume until the next solve (the softening
missed them; now the sum).

**Tests** (`ext.test.ts`; 87 fast tests in 10 files, all met):

| # | Gate | Measured |
|---|---|---|
| 47 | q″_max at 1 atm and 1 g | 1.261 MW/m² |
| 47 | computed: 300 steps finite, guard idle, Δt not collapsing, budgets exact | finite; largest bubble 26.4 mm, fastest particle 9.7 m/s, guard 0×, shortest step 0.19 ms; half the water thrown out of the open box; energy −2.4·10⁻¹⁰ J, water 5·10⁻¹⁶ kg |
| 47 | softened: no bubble above 4 mm, water ≤ 1.5 m/s, water stays, budgets exact | largest bubble 4.00 mm, fastest 1.06 m/s, shortest step 1.7 ms, 99.7 % of the water stays (9.4 mg of vapour vented), energy −2.7·10⁻¹⁰ J |
| 48 | asking: one event, handed over once, the answer stored, no second question | after 4 steps (22.6 ms): a 6.4 mm bubble |

The rest of the fast suite is unchanged within its tolerances (the guards do not act at ordinary steps; the ring acts
only for bubbles larger than a cell). Longer runs of the same scene: computed 12.4 s and softened 8.9 s of simulated
time, finite throughout, energy within 4·10⁻¹⁰ J; three seeds of the computed scene closed the energy within
3·10⁻¹⁰ J over 300 violent steps after the footprint fix (before: up to 2·10⁻³ J). The presets stay calm for 20 s at
2 mm; a beaker without chips heated for 337 s reached 119 °C at the bottom (19 K superheat) with the bulk at 59 °C —
the bumping that "ask" now catches.

**The surface** (ARCHITECTURE.md §20): a card on the page, the lab as a full-screen layer; top bar with the phase,
tool rail, side panel only when needed, time bar; settings, task & model and the bake dialog on demand; the question
when violent events start. Clips: frames per second (15, 30, 60) and keyframe spacing (1, 5, 10 s) chosen when baking,
stored in the header. **Checked** in headless Edge against a bundle of the shell: card → layer filling the window
with the body locked, phases, six tools, adding an ice cube (selected, panel, the tool back to Wybierz), running,
muted tools, "Maluj" pausing the run with its note, settings with "Łagodź" stored, the bake dialog (10 s, every
67 ms, 3 mm) baking into a clip that plays with a timeline stepping 1/15 s, ending playback back to the preparation
with the clip's button, the phone layout (tools in a row at the bottom, no horizontal overflow), Esc closing panel
then lab (43 checks); the page's whole window (the lab fills it under the page bar, nothing scrolls), a block added,
run and "Od nowa" back to the set-up, Badaj and the charts as tabs, task & model, Esc closing only the sheet, and
water on the hot plate asking "Gwałtowne wrzenie", answered "Łagodź", running on without a second question (30
checks). No console errors.

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
| M3a³ | 2 mm | 0.00 | 2.04 | 9.68 | 2.34 | 3.38 | 2.60 | 0.19 | **20.24** | 40.5 |
| M3a³ | 3 mm | 0.00 | 0.85 | 3.71 | 1.10 | 1.54 | 1.15 | 0.09 | **8.45** | 16.9 |
| M3b⁴ | 2 mm | 0.00 | 3.03 | 11.24 | 2.50 | 3.27 | 2.62 | 0.21 | **22.90** | 45.8 |
| M3b⁴ | 3 mm | 0.00 | 1.38 | 4.11 | 2.70 | 1.21 | 1.12 | 0.09 | **10.65** | 21.3 |

¹ measured inside the test run with other test files in parallel, before bubbles and phase change existed.
² the accelerated view on the RTX 3070 (laptop); the step is the throughput, the stages are timestamps (§M1e).
³ the CPU with M2a, M2b, B and M3a; the new stage `bodies` (the pinned beaker and plate) takes 0.01 ms. Against the
committed engine of B on the same machine, alternating, four runs each: 19.22 and 19.04 ms per step (medians, −1 %:
noise) — bodies and the new free surface cost nothing in a scene without free bodies.
⁴ the CPU with bodies of exact rectangles and M3b (stage `bodies` 0.04 ms). The committed M3a engine on the same
machine just before: 19.95 ms at 2 mm and 8.38 ms at 3 mm. At 2 mm (+15 %) the gas solve takes 14.6 iterations instead
of 10.6 — the preset's beaker walls lie across cells as two half-open cells each — the liquid stage 1.0 ms more, and
20 % more bubbles are in flight. At 3 mm (+27 %) most of it is boiling: the beaker's bottom is now its true 2 mm with
the water in the cells it shares (the voxels made it a whole 3 mm row of glass), the water boils on it, and 230
bubbles are in flight instead of 18.

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
