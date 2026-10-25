# 2D lab engine — the sandbox plan (more matter, everything falls, melting, salt, baking)

Status (2026-10-24): a design before the code, as ARCHITECTURE.md was. **All of it is built**: M2a, M2b, B, M3a, M3b
and M3c (several liquids, rapeseed oil; salt solutions with a crust; baked clips; rigid bodies of exact rectangles
that fall, float, sink and tip; ice that melts and freezes; salt crystals that sink, pile up, dissolve and grow —
MILESTONES.md §M2a, §M2b, §B, §M3a, §M3b, §M3c; ARCHITECTURE.md §17, §18, §21). The user confirmed the order of §13 and decided (2026-10-21):

- every object is one whole — a beaker, a plate, an ice cube moves as one piece; for each object the user decides
  whether it is pinned or reacts to gravity;
- bodies start asleep: nothing is computed for an object until something moves it (beakers in presets rest on their
  plates without cost; pull the plate away and the beaker falls);
- clips stay in the browser only (no files, nothing attached to pages).

and (2026-10-23):

- **solids are rectangles.** A body is one or a few exact rectangles in its own frame, not a set of grid cells; inside
  it is stable as a rectangle. It changes shape only when it melts or ice grows on it, and then a whole side moves: a
  melting ice cube gets smaller and stays a rectangle, and water appears where the ice was. Painted walls (the "Maluj"
  and "Ścianka" tools) stay grid cells and can still be painted freehand;
- melting and freezing come together: an ice side next to water colder than its freezing point grows by a whole
  side; salt stays in the water. New ice appearing by itself in cold water (nucleation) comes later;
- melting can happen on one side or on several at once — the side the heat comes through — but each side that melts
  gets smaller as a whole;
- objects instead of separate tools: a movable thing (an ice cube, a block, a beaker, a hot plate) is an object with a
  name and its own settings; whether it is pinned (does not fall) is one of them, set in the object's panel — there is
  no separate "Przypnij" tool.

and (2026-10-24):

- **violent events are the user's choice.** Superheated water that boils explosively, a giant vapour bubble, fast
  splashing water: the scene says whether this is computed as in reality, softened (calmer boiling, the water stays in
  the vessel) or asked about the first time it happens (the default) — ARCHITECTURE.md §19. Every scene computes such
  events without blowing up;
- **the lab runs only full screen**, with nothing scrolling around it, and needs no explanations: first the
  preparation (build and set everything), then the simulation; to change the scene the simulation pauses ("Od nowa"
  returns to the set-up at the start). Baking asks how: length, the recording step, resume points, resolution and the
  violent events (ARCHITECTURE.md §20);
- **the accelerated view gets every new part**: the GPU ports of §12 follow now, step by step, and M3c is the next step
  of the sandbox. Done the same day: violent events, oil (M2a) and salt (M2b) run on the accelerated view
  (MILESTONES.md); free bodies (M3a) and ice (M3b) still send a scene back to the CPU. M3c (grains) followed the same
  day on the CPU; scenes with grains also run on the CPU.

It extends
ARCHITECTURE.md §14 ("Designed for, not built": M2 chemistry, M3 solids) with what the user asked for:

1. more liquids than water — oil first;
2. everything reacts to gravity, not only water and gases — solids fall, float, sink, tip over;
3. water can melt and freeze (ice);
4. salt — dissolving, brine, crystals;
5. baking — compute a scene once, cache it, and play it back (or continue from it) later.

The point the user stressed: this is a sandbox for many scenarios, not one experiment. Boiling water was the first
scene; the engine must be built so that new scenes come from new data and new layouts, not from new code.

## 1. Principles

- **Matter, not scenarios.** The engine knows kinds of matter and their laws. A scenario is a scene (JSON) and maybe a
  preset; no code path may test for "the ice-in-salt-water scene".
- **Data-driven substances.** Every substance is a record in the materials database with its phases, transitions and
  properties, each value with a source key (the rule of M1). A new liquid, solid or solute is a new record.
- **One world, one loop.** One grid, one particle store, one object store, one heat solve. New kinds of matter join
  the existing stages instead of getting their own loops.
- **The right representation per kind of matter** (§2): the split that made M1 accurate is kept and extended.
- **General mechanisms, specific data.** Phase changes are one table of transitions (solid ↔ liquid, liquid ↔ gas,
  solid → solution, solution → solid); each moves mass with the enthalpy of the store it leaves and books the
  difference as latent heat (the closure rule of ARCHITECTURE.md §4). Gravity acts on everything that has mass.
- **Costs scale with presence.** A scene without oil does not solve viscosity; resting bodies sleep; a scene without
  salt carries no solute work. Today's scenes must not get slower.
- **CPU first, GPU after.** The CPU engine stays the deterministic reference; each milestone is then ported to the
  accelerated view, which refuses (with a note) a scene that uses something not yet ported.
- **Tests with physical references** for every milestone (§13), budgets that close, honest simplifications.

## 2. Kinds of matter and their representation

| Matter | Representation | Exists | Why this one |
|---|---|---|---|
| Gases (air, vapour) | conserved masses and enthalpy on the grid | yes | low-Mach flow is a field |
| Liquids of any material, with dissolved species | APIC particles: `mat` = the liquid, solute slots = the composition | water only | particles keep sharp interfaces and carry composition without numerical diffusion |
| Bubbles | objects | yes (steam and air in water) | below or near cell size |
| Rigid solids: apparatus, ice cubes, wood, stones, metal | **bodies**: a few exact rectangles in the body's frame (material; energy, film and crust per internal cell) — since 2026-10-23, a voxel set before | yes (M3a, M3b) | stiff solids cannot be simulated as a continuum at real-time steps; internal cells let a body conduct heat inside, and a melting side moves as a whole |
| Granular solids: salt crystals, sugar, sand | **grain particles** in the particle store (`kind` = grain, size) | no | thousands of grains — too many for rigid bodies, but a granular continuum on particles fits the grid |
| Dissolved species (salt in water) | composition of liquid particles | slots exist, unused | exact salt mass, no smearing |
| Fog | field on the grid | yes | microscopic droplets |

**Considered and not chosen:**
- MPM (material point method) for everything, as in Stomakhin et al. 2014, "Augmented MPM for phase-change and
  varied materials". It handles ice, melting and solid–fluid coupling elegantly, but stiff solids need explicit time
  steps of microseconds: the sound speed in steel or ice is 3–5 km/s, so Δx/c ≈ 1 µs at 2 mm. Rigid bodies take the
  stiff limit exactly at no cost.
- Rigid bodies for grains (the count is too high).
- Salt concentration as a grid field (numerical diffusion would mix brine in seconds that really takes hours).

## 3. Materials database v2 (substances)

`materials.json` becomes a list of **substances**, each with the phases it can take and the transitions between them.

```jsonc
{
  "id": "H2O", "molarMass": { "v": 0.01801528, "src": "codata" },
  "solid":  { "name": {"pl": "lód"}, "rho": {…}, "cp": {…}, "k": {…}, "friction": {…}, "color": "#d8eef8" },
  "liquid": { "name": {"pl": "woda"}, "rho": {"kell": …}, "cp": {"table": …}, "k": …, "mu": {"vogel": …},
              "sigma": …, "solvent": true, "group": "aqueous", "color": "#3d8fd8" },
  "vapour": { … },
  "fusion": { "T": { "v": 273.15, "src": "iapws-ice" }, "h": { "v": 333550, "src": "iapws-ice" } },
  "saturation": { "if97": … }
}
{ "id": "oil-sunflower", "liquid": { "rho": {"linear": …}, "cp": {"linear": …}, "k": …, "mu": {"andrade": …},
  "sigma": …, "group": "oil", "smokePoint": …, "color": "#e3c34a" } }           // not volatile in its range
{ "id": "NaCl", "molarMass": …,
  "solid":  { "rho": …, "cp": …, "k": …, "repose": …, "color": "#f4f4f2" },
  "solute": { "solvent": "H2O", "osmotic": {"pitzer": …}, "solubility": {"table": …}, "density": {…},
              "cp": {…}, "mu": {…}, "dHsol": …, "D": … } }
```

- **Enthalpy references**: one per substance. Water stays as in M1 (liquid at 0 °C = 0); ice
  h_s(T) = −h_sl + ∫ c_p,s dT from 0 °C; a solution adds each solute's enthalpy and books the heat of solution when it
  dissolves. The closure rule is unchanged: every transfer moves its own enthalpy and the difference is latent heat.
- **Property models** stay named laws (Kell, Vogel, Andrade, table, linear, power, Pitzer…) evaluated by one function
  per model. For speed they are tabulated per liquid at 1 K steps (like the gas tables) — and the GPU reads the same
  tables, so CPU and GPU evaluate identical numbers.
- **First set**:

| Substance | Phases | Source candidates |
|---|---|---|
| H₂O | ice, water, vapour | IAPWS R10-06 for ice Ih (ρ 916.7 kg/m³, c_p ≈ 2.1 kJ/(kg·K), k ≈ 2.2 W/(m·K) at 0 °C); h_sl = 333.55 kJ/kg |
| N₂, O₂ | gas | as now |
| Refined sunflower oil | liquid | ρ ≈ 919 kg/m³ at 20 °C, c_p ≈ 2.0 kJ/(kg·K), k ≈ 0.17 W/(m·K), μ ≈ 0.05 Pa·s at 20 °C, ≈ 0.008 Pa·s at 100 °C, smoke point ≈ 225 °C — one cited dataset to be chosen (oils vary) |
| NaCl | crystal, dissolved | crystal ρ 2165 kg/m³, c_p 0.86 kJ/(kg·K); solution: CRC Handbook (concentrative properties: density, freezing point, viscosity), Pitzer & Mayorga 1973 / Robinson & Stokes (osmotic coefficients), solubility 35.9 g per 100 g water at 20 °C, Δ_solH ≈ +3.9 kJ/mol |
| Pine wood, granite | solid | Incropera Table A.3 |
| Glass, steel, ceramic | solid | as now, plus friction and restitution for contacts |

The values in this table are orientation only; each number enters the database with its exact source, as in M1. A
test keeps checking that every value cites one.

## 4. Liquids of any material (oil)

- **Material per particle.** `mat` selects the liquid. Every place that now calls the water functions (heat
  capacities, enthalpy ↔ temperature, density, conductivity, the bubble model's σ, μ, ρ) takes the particle's
  material, or the cell's liquid mixture where the grid needs one value.
- **Density and buoyancy.** The liquid keeps its constant-density projection with the body force g·ρ_p/ρ_ref
  (SIMPLIFICATIONS.md #5). With several liquids the hydrostatic pressure stays exact (∇p = ρg in every layer); only
  the inertia uses ρ_ref (a Boussinesq-type approximation, good for density ratios of about 0.7–1.5 — oil/water 0.92,
  brine/water 1.2). Oil rises above water, brine sinks below it, and warm oil spreads on top, without extra code.
  Upgrade path: a variable-density projection, needed for mercury or molten metals.
- **Viscosity** (new). Water is effectively inviscid at these scales; oil is 50 times more viscous and honey 10 000
  times. An implicit viscosity step per velocity component, with face viscosities splatted from the particles like
  mass (a simplification of Batty & Bridson 2008; SPD, solved with the existing CG). It is skipped where ν Δt/Δx² is
  negligible, so water scenes pay nothing.
- **Immiscibility.** Particles of different liquids stay different particles. A cell may hold both, and its heat
  capacity and conductivity come from its particles. Built with a drift of unresolved droplets (a particle that is the
  minority liquid in its cell moves at the terminal velocity of a droplet of its own volume): without it a fine
  mixture would never separate, because a mixed cell has the mean density and no buoyancy. Without surface tension between liquids (as with water–air,
  #6), an oil–water interface is shaped by gravity alone: droplets do not round up, emulsions are not modelled.
- **Phase change per liquid.** Evaporation, flash and bubbles apply to volatile liquids only (water; ethanol later
  through a reserved gas slot). Oil heats past 100 °C without boiling and warns at its smoke point. Steam bubbles
  from water under oil rise through the oil with the oil's density, viscosity and surface tension: the bubble stage
  gathers these per cell along with T and C. Not yet: boiling of water droplets inside hot oil (needs nucleation at
  liquid–liquid interfaces) — a later scenario, noted so the data model allows it.

## 5. Solutions (salt)

- **Composition.** A liquid particle = solvent material + up to two solutes (`spc`, `smass`; more slots if a later
  milestone needs them). Salt moves with the particle; its mass is exact.
- **One activity model, all colligative effects.** The water activity a_w(m, T) from osmotic coefficients (Pitzer) gives:
  - the vapour pressure of the solution, p_v = a_w·p_sat(T), used for evaporation, bubbles and flash;
  - the boiling point: the solution boils where a_w·p_sat(T_b) = p, about +1 K at 1 mol/kg and about 108–109 °C
    saturated;
  - the freezing point (from the same a_w and h_sl): about −3.4 °C at 1 mol/kg, −21.2 °C at the eutectic (23.2 %).

  None of these is a separate rule: they follow from one quantity, so they stay consistent with each other.
- **Solution properties**: ρ(T, w), c_p(T, w), μ(T, w) from the cited tables. Brine is denser (≈ 1071 kg/m³ at 10 %,
  20 °C), so density layering and salt-driven convection follow.
- **Evaporation and boiling remove water only.** Concentration rises; above the solubility the excess crystallises
  (§8: as grains, or as a crust on the nearest solid before grains exist), with the heat of crystallisation booked.
- **Dissolution** of solid salt in contact with unsaturated solution: ṁ = k_m A ρ (w_sat − w) with a Sherwood
  correlation; the endothermic heat of solution cools the liquid.
- **Molecular diffusion is neglected**: D ≈ 1.5·10⁻⁹ m²/s spreads salt about 0.4 mm in 100 s, less than a cell.
  Mixing comes from flow (honest, and stated in SIMPLIFICATIONS.md). The drawn concentration is smoothed over the
  particles of a cell.
- **New overlay**: "Stężenie" (concentration), next to temperature and vapour.

**As built (M2b, 2026-10-22)**: one solute, NaCl, in slot 0; Pitzer with the parameters of PHREEQC pitzer.dat and,
below 0 °C, those of Spencer, Møller & Weare (pitzer.dat alone put the freezing point at 3 mol/kg 0.16 K too high);
ρ and c_p after Laliberté, μ, k and σ of brine as water's (SIMPLIFICATIONS.md #27); the excess over the solubility
goes at once to a crust on the nearest solid below (or a store on the bare box floor) — no grains, no supersaturation,
and the crust does not dissolve again (dissolution comes with the grains, M3c). The drying scenes brought out older
problems with droplets below the cell size (they never boiled and hovered in the air); they now flash and fly
(ARCHITECTURE.md §7, §9). Numbers: MILESTONES.md §M2b. Changed from the design above: molecular diffusion is not
neglected after all — the particles of a cell share salt (and heat) at the rate of diffusion across the cell, and salt
diffuses between cells by Fick's law (ARCHITECTURE.md §6.5, SIMPLIFICATIONS.md #28, #32). At the physical rate this is
no numerical smearing: brine still keeps its layers for hours, but brine and fresh water stirred into one cell even
out in minutes instead of never.

## 6. Rigid bodies: everything falls

- **A body** = one or a few exact rectangles in its own frame (since 2026-10-23; at first it was a voxel set at the
  grid's Δx) — material, internal cells of about Δx laid exactly into each rectangle with energy, film and crust,
  optional heater role — + its pose (x, y, angle), velocities, mass, centre of mass, inertia; each rectangle is a box
  for contacts (a beaker is three). Mass properties and outlines are recomputed when a side melts or grows.
- **Dynamics**: gravity; fluid forces from the solved liquid and gas pressure (integrated over the body's boundary
  faces) with viscous drag; contacts with walls and other bodies — reusing the physics lab's contact solver
  (`lab/physics/physCollide.ts`: SAT with clipped manifolds, block solver, warm starting, Coulomb friction), which
  already keeps stacks standing; the drag tool becomes a mouse joint. Sleeping: a body that has not moved noticeably
  for a while stops being re-rasterised.
- **Pinned or free, per object; asleep at the start.** Each object has the switch "Przypnij" (pinned: fixed in place,
  infinite mass for contacts) or reacts to gravity. A free object starts asleep and wakes when something touches it,
  its support goes, or the fluid force exceeds its rest; asleep it costs nothing.
- **Into the grid each step** (moving bodies only): each cell gets the share of it the rectangles cover (exact clipping
  of the rotated rectangles), the share of each face they cover and the body's velocity there; the liquid and the gas
  projection use those fractions (Batty, Bertails & Bridson 2007), a cell almost full (99 %), cut in two, or half full
  next to another solid is closed. `phiS`, `sdf`, regions and cavities are refreshed in the box of what moved;
  particles and bubbles inside a rectangle go back out through the side they came in by.
- **Fluid coupling**: two-way, partitioned — the body's velocity is the boundary condition of the solves, the
  resulting pressure the force on the body, with an added-mass term for stability. Good for bodies not much lighter
  than the liquid (ice 0.92, wood 0.5–0.6); very light bodies (a ping-pong ball) need the monolithic coupling of
  Batty, Bertails & Bridson 2007 later (noted as a limit).
- **Heat**: a cell holds the body's share as one more part (capacity, energy, temperature) next to its fluid; the
  internal cells give and take energy through the same area weights both ways, so the budgets close with moving
  solids.
- **Apparatus are bodies.** A beaker in the air falls onto the plate, a pushed beaker of water tips over and spills.
  Heater voxels keep their heater group.
- **Cavities** (nucleation) live in the body's frame (drawn from a hash of body and local face), so a falling ice
  cube keeps its sites; static set-ups keep today's numbers.

## 7. Melting and freezing (built: ARCHITECTURE.md §18)

Treated as an interface process, like evaporation at the liquid–gas surface (ARCHITECTURE.md §9), not as a volume
rule:

- At every side of an ice body where liquid lies in front, the interface is at the **freezing point of the local
  liquid**, T_f(w) — 0 °C in pure water (0.0025 °C at 1 atm), lower in brine (§5).
- After the heat solve, excess sensible heat on either side turns into latent heat, as the flash does for boiling.
  - An internal cell of the ice above T_f of the nearest side that faces fluid gives its excess C (T − T_f) to that
    side; a side's excesses together move the **whole side** inward by δ = Q/(ρ D Σ s_k [L + c_p (T_f − T_k)]). The
    melt joins the particles in front of the side (or becomes a particle there) with exactly the slice's energy, its
    latent offset and Q. The ice stays a rectangle and never warmer than its interface.
  - Liquid below T_f(w) in front of a side freezes until its released heat brings it to T_f; the side moves outward
    by the frozen mass over its length. Only the solvent freezes: salt stays in the liquid, so freezing brine gets
    saltier.
- A rectangle thinner than 0.05 Δx melts completely; the body's mass, centre and outline follow. A melting ice cube
  shrinks, keeps floating with about 92 % under water, and turns over when its shape says so; a carved block stays a
  few rectangles (a wall made of several rectangles' sides moves as one), and splits into bodies if it melts through.
- What emerges without special code: ice in warm water melts at the energy balance; ice in salty water melts below
  0 °C and drags the brine below 0 °C (a cooling mixture, bounded by the eutectic); salt sprinkled on ice melts it
  (once grains exist, §8).
- Not modelled: supercooling and spontaneous freezing in the bulk (freezing needs existing ice or a solid colder
  than T_f by a nucleation margin, which seeds a new ice body); ice growth patterns below the cell size.

## 8. Grains (salt crystals, sugar, sand) (built for salt: ARCHITECTURE.md §21)

Built 2026-10-24 with one change to the plan below: dry grains are not a continuum on the grid but the grain
particles themselves, with friction as position constraints (position-based dynamics, Macklin et al. 2014) — with
four grains per 2 mm cell the continuum held no resting slope (MILESTONES.md §M3c). Grains are salt only; sugar and
sand need their materials (density, angle of repose; sugar does not dissolve into the solution model yet). New
crystals do not seed by themselves: supersaturated brine grows a grain nearby, else crust.

- **Grain particles** in the particle store: `kind` = grain, material, grain size (each particle stands for many real
  grains, as a liquid particle stands for many molecules).
- **In a liquid**: they move with the liquid plus a settling drift from a drag law (Stokes up to Ferguson–Church),
  give the liquid their weight, and pack at the bottom.
- **Dry**: a granular continuum on the same grid — incompressible where packed, free where loose, the stress
  limited by Coulomb friction (after Narain, Golas & Lin 2010, "Free-flowing granular materials with two-way solid
  coupling"). Piles form at the material's angle of repose, and grains rest on bodies and slide off slopes.
- **Salt grains dissolve** (§5) and shrink until they vanish. **Crystallisation** from supersaturated solution grows
  existing grains or seeds new ones on solid surfaces, so a beaker boiled dry keeps its salt as crystals.
- Grains are solid surfaces too: they carry cavities, so throwing salt into hot water can set off a burst of bubbles,
  as it does in a kitchen.

## 9. Baking and recording (cached clips)

**A clip** is a scene recorded over time: render layers per frame, keyframes of the full state, and the timeline of
charts and HUD numbers. Two ways to make one:

- **Record** (live): what happens on screen, including the user's edits, is kept.
- **Bake** (offline): the worker runs the scene as fast as the machine allows, without drawing, on the CPU or the
  GPU, at the live quality or finer (e.g. 1 mm where live runs 2 mm), with a progress bar; it can run in the
  background.

Contents and format (`"format": "recreatio/lab2d-clip"`, version 1):

- **Header**: the scene JSON, quality, seed, engine version, frame rate (30 frames per second of simulated time),
  and the list of layers.
- **Frames**, in chunks of one second, each chunk compressed with the browser's `CompressionStream` (delta to the
  previous frame first). Layers are chosen at bake time:
  - the liquid surface (coverage on half cells, 8 bit);
  - materials, solutes, bubbles (position, radius), bodies (pose; voxel changes as events) and grains (quantised
    positions);
  - the overlay fields at cell resolution (temperature 12 bit; pressure, velocity, vapour, fog, concentration
    8–12 bit).
- **Keyframes**: the complete engine state every few seconds (a new binary snapshot of grid, particles, bubbles,
  bodies, grains and totals). This is the base for seeking, the inspector during playback and "resume live from here".
- **Timeline**: chart samples and the budgets.

Size estimate at 2 mm: about 30 KB per frame before compression, mostly static. That is a few MB per simulated
minute; keyframes take about 0.3–1 MB each compressed. To be measured, and the gate set from the measurement.

Storage and use:

- **Cache**: IndexedDB, keyed by a hash of scene + quality + engine version. Opening the same scene again plays at
  once, also on a phone, with no simulation. Clips stay in the browser (the user's decision): no file export, nothing
  attached to pages.
- **Playback**: timeline scrubbing, 0.25–4× speed (smooth, since nothing is computed), loop, the baked overlays, and
  the inspector from the layers and keyframes. "Na żywo od tej chwili" (live from here) loads the nearest keyframe
  and simulates on. On the CPU that continuation matches a straight run bit for bit (the CPU engine is deterministic),
  which is also how clips are verified.
- **Old clips**: they stay playable after engine updates, because they hold render data. Resuming live needs the
  same engine version and is refused otherwise, with a note.

**As built (B, 2026-10-22)** — ARCHITECTURE.md §16, MILESTONES.md §B. The user added how it starts: the lab never
starts by itself (it waits for "Uruchom na żywo" or "Upiecz"), baking starts by a button, and a module can be set to
bake on opening (a clip already in the browser then plays at once); one lab can offer several scenarios. Changed from
the design: baking only (recording a live run with its edits is not built); the CPU bakes, not the GPU; the frame
layers are the ones the live view draws from (`render/layers.ts`), so playback equals the live view; the gas-overlay
layers are stored every third frame; keyframes are a walk through the engine's object graph with measured scratch
left out, and "the same engine version" is the same set of state paths (the layout). The inspector works live only.
Measured: 33.6 MB per simulated minute of boiling at 2 mm (frames 11.6 kB, keyframes 980 kB every 5 s), baking at
0.13–0.5× real time on the reference laptop.

**GPU baking (2026-10-25)** — ARCHITECTURE.md §15–16, MILESTONES.md "GPU baking". The design's "on the CPU or the
GPU" is built: the bake dialog offers "Licz na: procesor | karta graficzna", the graphics card by default wherever
WebGPU works and the scene runs on the accelerated view (free bodies, ice and grains still bake on the CPU, and the
dialog says so); no WebGPU, a compile error or a lost device fall back to the CPU with a note (a device lost mid-bake
keeps the shorter clip). The format is unchanged: GPU kernels capture the very layers the CPU sampler writes, read
back in batches without waiting, so a GPU clip plays through the same player. The owner's decisions: CPU and GPU clips
of one scene are kept side by side (the engine is in the key of GPU clips only — CPU keys are as before), the player
shows which one plays and switches between them; "Na żywo od tej chwili" on a GPU clip resumes from the keyframe at or
before the shown frame (GPU runs are not reproducible), in the accelerated view where WebGPU works, else on the CPU.
Measured: boiling at 2 mm bakes at 1.55× real time on the RTX 3070 and 1.12× on the integrated AMD GPU (6.3× and 4.7×
the CPU bake), at 1 mm 0.80× and 0.32× (19× and 8×); 24–28 MB per simulated minute at 2 mm, 78–86 MB at 1 mm.

## 10. The step loop after the change

1. Inputs (tools, heaters, ambient).
2. **Bodies, part 1**: rasterise the bodies that moved; refresh solids, distance field, regions and cavity faces where
   needed.
3. Liquid (with grains, per-material density, viscosity).
4. Gas.
5. Bubbles (host properties per cell).
6. Interface: evaporation, flash, fog, films; **melting and freezing; dissolution and crystallisation**.
7. Heat (bodies' voxels and grains included).
8. Chemistry hook.
9. **Bodies, part 2**: fluid forces from this step's pressures, contacts, integration; voxel energies and
   melt/freeze results back to the bodies.
10. Boundaries and diagnostics.

## 11. Scenes, tools, JSON

- **Scene format version 2** (version 1 scenes keep loading unchanged):
  - `fill` takes any liquid material and a composition with solutes, e.g. `{"H2O": 0.9, "NaCl": 0.1}`;
  - a new `body` operation: shape as rectangle, disc or polygon, material, temperature, pinned;
  - a new `grains` operation (material, grain size, region);
  - `beaker` and `hotplate` become bodies (pinned unless the scene says otherwise).
  - The JSON description and the AI prompt (`text.ts`) and the app's JSON check are updated with it.
- **Palette**:
  - liquids: water, oil, brine with a concentration slider;
  - solids for bodies: ice, wood, stone, glass, steel;
  - grains: salt, later sugar and sand;
  - tools "Postaw ciało" (place a body) and "Przypnij" (pin).
- **The inspector** shows material and composition. A new overlay "Materiał" (material map) shows which substance is
  where.
- **Presets** that show the breadth — each is only a layout:
  - "Olej na wodzie" (oil on water);
  - "Lód w wodzie" (ice floats and melts);
  - "Lód z solą" (ice with salt: a cooling mixture below 0 °C);
  - "Solanka wrze później" (brine boils later: the boiling point rises);
  - "Odparowanie solanki" (evaporating brine: crystals remain);
  - "Co pływa?" (what floats? wood, ice, steel);
  - "Przewrócona zlewka" (a knocked-over beaker);
  - "Sól do wrzątku" (salt thrown into boiling water: a burst of bubbles).

## 12. GPU path

Each milestone is then ported (M2a and M2b since 2026-10-24: ARCHITECTURE.md §15):
- material tables as storage buffers read by the same lookups;
- the viscosity solve on the existing MGPCG machinery;
- solutes as per-particle fields;
- body rasterisation as kernels;
- body dynamics in one workgroup (few bodies, contacts with warm starting) — the accelerated view has no round trips
  inside a step, and that stays so;
- grains in the liquid kernels plus the frictional contacts (built on the CPU as position-based dynamics: one thread
  per grain with graph colouring or Jacobi sweeps instead of Gauss–Seidel).

Not ported yet (2026-10-24): free bodies (M3a), ice (M3b) and grains (M3c) — such a scene runs on the CPU.

Before adding kernels, the workgroup memory of the tile kernels should shrink (MILESTONES.md, M1e: in Firefox it
costs most of the step and 20 s of compile time).

## 13. Milestones, tests and order

| Step | Contents | Acceptance tests (references) | Needs |
|---|---|---|---|
| **M2a** Substances and liquids (**built**) | materials v2, per-material particles, oil, liquid viscosity, drifting droplets, palette and presets | two-layer hydrostatics: dp/dy = ρ_oil g and ρ_w g (±2 %); oil poured under water ends on top with layer heights from the volumes (±1 cell); viscous decay of a shear profile, exp(−ν k² t) (±5 %); oil heated to 150 °C without boiling, budgets closed; steam bubbles rise through an oil layer | — |
| **M2b** Solutions (**built**) | NaCl dissolved: activity model, colligative properties, density, evaporation concentrates, crust | density at 10 and 20 % (±0.3 %); boiling point at 1 and 3 mol/kg (±0.1 K of the data); freezing point at 1 and 3 mol/kg (±0.1 K); salt mass exact over boiling; crust mass = salt mass after drying | M2a |
| **B** Baking and recording (**built**, baking only) | clip format, bake runner, cache in the browser, playback, resume from keyframe | playback frame-identical to the recording; seeking to within one frame; CPU resume bit-identical to a straight run; measured size per minute (gate set from the measurement) | — (keyframe sections grow with later steps) |
| **M3a** Bodies (**built**) | bodies of exact rectangles (voxels until 2026-10-23), contacts (physics-lab solver), fluid coupling through covered fractions, heat in bodies, apparatus as bodies, pin | floating depth ρ_b/ρ_l for wood and ice (±2 %); a sinking block reaches a drag-law terminal speed (±15 %) and rests without jitter; a stack of two blocks stands; a full beaker tips at its geometric tipping angle (±3°); budgets close with moving solids | M2a |
| **M3b** Melting and freezing (**built**) | ice; interface at T_f(w); a side melts or grows as a whole; melt to particles, freeze from supercooled water; salt rejection | Stefan melting front against the Neumann solution (±5 %); ice cube in warm water: energy budget closes; brine with ice settles at T_f(w) (±0.2 K) and approaches the eutectic with enough salt; freezing brine keeps all its salt | M3a, M2b |
| **M3c** Grains (**built**) | grain particles: settling, dry granular flow, dissolution, crystallisation, cavities on grains | angle of repose of salt (±3° of the cited value); settling speed (±10 %); dissolution time against the mass-transfer correlation (±20 %); temperature drop from Δ_solH; salt mass exact through dissolving and crystallising | M2b, M3a |
| GPU ports | after each step (or two steps at a time) | test 17 extended by each step's tests | the step |

**Recommended order: M2a → M2b → B → M3a → M3b → M3c.** Each step builds on the previous one:
- substances first, because everything else reads them;
- solutions are small once substances are tables;
- melting needs both bodies and the freezing point of solutions;
- grains last, because they need solutions (dissolving), bodies (resting on them) and the hardest solver of the set.

Baking does not depend on the physics and pays off at once on slow machines, so it comes early.

## 14. Risks and choices

- **Speed**: the CPU already needs 21.6 ms per step at 2 mm against a 6 ms budget. Every new kind of matter adds
  work; the rule "costs scale with presence" keeps today's scenes where they are, and baking covers scenes too heavy
  for a weak machine.
- **Coupling stability**: partitioned coupling is fine for bodies of more than about a third of the liquid's density;
  lighter ones wait for monolithic coupling.
- **Thin moving walls** (one cell): conservative rasterisation and push-out; tested by a tipping beaker that must not
  leak.
- **The granular solve** is the most expensive and least certain part; if it does not fit the budget, a simpler model
  for dry piles stays available as a documented fallback.
- **Oil data** differ between oils: the database names one oil with one cited dataset, not "oil".
- **Decided** (2026-10-21): the order above; objects are wholes, each pinned or free, free ones asleep at the start;
  clips only in the browser.
