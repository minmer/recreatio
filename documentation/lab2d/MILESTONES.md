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
| M1e GPU path | test 17, 1 mm in the budget | **not built** (§M1e) |

Test 16 (≤ 12 ms of simulation per 60 Hz frame at the default resolution) is the one gate that fails throughout:
the CPU step of the benchmark scene at 2 mm takes 21.6 ms (budget 6 ms per step, two steps per frame): the
simulation runs at 0.39 × real time, in slow motion with the same results. The shell shows the tempo and offers 3 mm
cells, where a step takes 8.5 ms (0.98 × real time on the reference machine, still above the 12 ms per frame of the
budget); 1 mm takes 102 ms per step (0.08 ×). Details and history under "Benchmark".

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
| 11 Boiling plateau | mean water within 0.5 K of T_sat; vapour = (P − losses)/h_lv within 5 % | mean water **99.495 °C**, T_sat 99.974 °C (−0.48 K: inside the tolerance, with little margin — evaporation at the surface and the glass walls keep the bulk slightly below T_sat); vapour **5.233 mg/s** vs (P − losses)/h_lv **5.230 mg/s (+0.05 %)**, P 25 W, losses 13.2 W |
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

## M1e — GPU path (not built)

The gate asks for WebGPU compute for advection, pressure and conduction with fixed-point-atomic particle-to-grid
transfers, test 17 (GPU equals CPU on tests 1–3, 6, 11) and 1 mm cells within the time budget. It was not built,
because the measurements say it would not reach its gate in the form the milestone describes:

- At 2 mm the linear solves are about 40 % of a 21 ms step. A WebGPU path for the solves alone must read every solution
  back before the next stage can use it (mapAsync; typically 0.5–2 ms per round trip in Chrome), four solves per step.
  The gain at 2 mm would be a few milliseconds at most; the step would stay far above 6 ms.
- At 1 mm (30 000 cells, 13 000 particles) a step takes 102 ms (measured); even with free solves the rest would take
  about 60 ms. "1 mm within the time budget" therefore needs the whole step on the GPU: APIC with fixed-point atomics,
  MUSCL transport, MacCormack, multigrid-PCG, the heat and vapour solves, fog and flash, and the bubbles either on the
  GPU or with a narrow per-step exchange of their footprints.
- WGSL has no 64-bit floats. The prompt's exact Float64 bookkeeping of masses and energies needs double-float (df64)
  arithmetic for the conserved quantities on the GPU, so that test 17 compares like with like.
- Node, which runs the tests, has no WebGPU: test 17 needs a browser harness (headless Chrome/Edge; the reference
  machine has an RTX 3070, so it can run there).

Proposal: a GPU-resident grid pipeline behind the same stage interfaces (data stays on the GPU between stages), df64
for conserved quantities, the bubble model on the CPU with a per-step exchange, and a browser equivalence harness
for test 17. It is a project of several weeks and should be decided on its own.

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

¹ measured inside the test run with other test files in parallel, before bubbles and phase change existed.

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

- **Test 16** — not met on the CPU (above). The default stays 2 mm, as the project owner asked for v1 ("the normal
  situation should be high or very high"); slower machines get a hint to switch to 3 mm.
- **M1e** — not built (above).
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
