# Laboratories — a 2D physics lab and a 2D chemistry lab as page parts

Status: built on 2026-10-18 (frontend only, no migration, no backend change). The request: a module with a hard-coded
2D physics engine in which different things can be built and randomness used, where *how* the engine is used on a page
is saved in the database; and a chemistry module — materials, temperature, state, pressure in a vessel, sodium in water
giving hydrogen bubbles and heat, salts reacting in water, fire, bubbles, a view of how the air or the liquid is mixed,
liquid pressure in both labs, full screen, pleasant interaction, a sandbox and specific experiments for school. The same
day the chemistry engine was rebuilt as one real sandbox (a scene declares where things are, the engine does the rest;
heat moves on a grid), with experiments as constrained scenes and slide decks with one step per slide. Then rates
(§3.6): every reaction runs where its reactants meet, at the rate its law gives for the conditions there (concentration,
temperature, catalyst, surface) — incomplete, with rests, or both ways to an equilibrium K(T) —, crystals dissolve by
Noyes–Whitney (faster hot, stirred, powdered), and solutes diffuse.

## 1. The shape of it

| | Physics (`physics`) | Chemistry (`chemistry`) |
|---|---|---|
| Part | `pages/parts/physics.tsx` | `pages/parts/chemistry.tsx` |
| Engine | `lab/physics/` (bodies, contacts, joints, fluids) | `lab/chem/` (a grid of 4 mm cells: heat, gases, liquids, chemistry and fire in every cell) |
| Component | `PhysicsLab.tsx` | `ChemLab.tsx` |
| Scene reader / writer | `physScene.ts`, `physSave.ts` | `chemSetup.ts` |
| Experiments | `physPresets.ts` (15) | `chemPresets.ts` (29) and nine slide decks (`scripts/lab-decks.mjs`) |
| AI prompt | `physText.ts` | `chemText.ts` |
| Checks | `scripts/app-lab-check.mjs` | same script |

**The engine is code, the experiment is a document.** A part stores four keys in `slug_part.config`: `title`, `text`
(lines for the pupils), `mode` (`experiment` — exactly this scene with "Pokaż"; `sandbox` — everything allowed, presets
to load, save in the browser, export JSON) and `scene` (JSON). The backend accepts any lowercase kind and a config up
to 64 000 characters, so nothing changed there. Both parts are `fullscreen: true` (the page's whole-window view) and
carry their own full-screen button (`LabFrame.tsx`: the browser's fullscreen where possible, a fixed layer otherwise).
The strip size shows a card with "Otwórz laboratorium". The engines load lazily (`later`), with their CSS (`lab.css`).

Shared pieces in `lab/`: `LabFrame.tsx` (title bar, stage, side panel beside or below — a container query at 46 rem —,
full screen), `labView.ts` (DPR-aware canvas, camera with y up, a loop that sleeps when nothing moves — and runs at a
few frames per second when only slow things remain, like a beaker cooling —, gestures: grab, drag, tap, pan, pinch,
Ctrl+wheel; on the page a finger on empty ground scrolls the page, in full screen every gesture belongs to the lab),
`labGraph.ts` (recorder), `labRandom.ts` (drawn values: `{ name, from, to, step }` or `{ name, pick: [...] }`, numbers
as `"=expr"` in the motion expression language, texts with `{name}`), `LabEditor.tsx` (title, mode, text, presets,
scene JSON, "Kopiuj polecenie dla AI", live preview, "Przyjmij" — the AI works in the user's own chat).

Fixtures: `scripts/lab-examples.mjs` writes `fixtures/lab-chemia.json` and `fixtures/lab-fizyka.json` — pages
("Pracownia chemiczna", "Pracownia fizyczna") with an intro text, every preset as a module and a sandbox — and the nine
chemistry slide decks `fixtures/lab-pokaz-*.json` (§3.10). The script runs every scene first, checks that every deck
slide shows what it promises, and imports all pages through `planImport` (no warnings). It takes about seven minutes.

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

## 3. Chemistry — one sandbox

There is no engine per experiment. A scene says only what stands where and what is in it; the engine computes the
rest — heat that flows, metals that melt, water that boils, gases that rise or sink, solutions that mix and react,
flames where fuel meets oxygen. An experiment is a constrained scene of the same sandbox (fewer reagents, steps,
questions).

### 3.1 The grid (`chemGrid.ts`, `chemThings.ts`, `chemDevices.ts`)

The bench is a vertical slab of 4 mm cells (`CELL`), about 3 cm deep; inside an upright container every row gets the
depth that gives it its exact volume (π·r² over the row), so a 50 cm³ burette holds 50 cm³. Each cell holds a structural
material (glass, porcelain, steel, brass, wood, gauze, the hotplate's casing …), at most **one solid** with a form
(piece, granules, crystals, powder, cast, coat, precipitate), **one liquid** — an aqueous composition vector (`chemAq.ts`)
or one melt —, 14 gases, smoke, mist, fume and flame colour, and **one temperature**.

Things are painted into the grid and carry their cells when moved: containers (beaker, flasks, tube, cylinder, dish,
crucible, jar, burette, trough), burner, hotplate (a light casing under a 4 mm plate, a thermostat at 450 °C and a
magnetic stirrer that keeps the liquid of the vessel on it moving), tripod and stand with gauze, candle, thermometer
(its bulb hangs one cell above the floor and reads the medium around it, weighted by heat capacity, with a lag of about
a second), rods of a material or a metal, pieces (ice comes as 10 g cubes that stack inside the vessel), splint, loop,
spoon, stopper, plate. What the devices do in each step (burner, hotplate, candle, loop, thermometer, burette, pieces,
the stopper) is `chemDevices.ts`. A hand that drags a thing lifts it over obstacles; let go, it falls onto what is below
(the gauze).

### 3.2 Equilibria (`chemPh.ts`, `chemAq.ts`)

The aqueous vector counts **strong ions**, the **totals of weak pools** (C, Ac, N, S), molecules and indicator drops;
**H⁺ and OH⁻ are never counted** — they follow from the charge balance `[H⁺] − [OH⁻] + Σz·c + pools + hydroxo
complexes = 0`, solved by false position around the previous pH. Complexes need the free ligand, found by Newton in the
logarithm (the derivative of the bound amount is known): Cu(NH₃)₄²⁺, Ag(NH₃)₂⁺, Zn(OH)₄²⁻, Al(OH)₄⁻, FeSCN²⁺ and the
**hydrolysis of metal ions** as the first hydroxo complexes (CuOH⁺, FeOH²⁺, AlOH²⁺, ZnOH⁺, PbOH⁺; pKa = 14 − log β₁). A
metal may bind several ligands; while one free ligand is searched, the others stand fixed in the denominator (OH⁻ from
the pH, then SCN⁻ against OH⁻, then NH₃ against both and against H⁺). So a CuSO₄ solution is acidic (0.5 mol/dm³:
pH 4.1), FeCl₃ more so, and neither throws traces of hydroxide. Kw and every Ka follow the temperature (van 't Hoff
from the formation-enthalpy table). Every cell is speciated within a budget per step. Salts: Q against Ksp(T) — what
precipitates is solved so that *after* the equilibrium Q = Ksp (false position; weak-acid salts with the pH inside, at
most 24 such solves per step, round-robin, with their own budget for dissolving). Bottles are normalised to their
nominal volume; the `fill` of a scene vessel is blended into one solution (adding, filling, pouring without motion:
`chemFill.ts`; the air a filling pushes out rises into the cell above instead of becoming bubbles). The pH shown under a
vessel is the pH of its whole content.

### 3.3 Energy

Every change books formation-enthalpy deltas into the cell's pending heat; transport moves amounts and mixes
temperatures by heat capacity; the form heat of the pools moves with the liquid, and when the forms change the
difference becomes heat. So no reaction knows its own heat: neutralisation of 50 + 50 cm³ of 1 mol/dm³ warms by ~6 K,
5 g NaOH in 50 cm³ by ~22 K, 10 g NH₄NO₃ cools by ~13 K, 6 g KNO₃ in 10 cm³ by ~9 K, sodium melts into a ball. The heat
of a metal reaction is split between the metal and the water, the metal cell taking at most what brings it to 900 K.

### 3.4 Heat moves (`chemHeat.ts`)

Conduction over every face, each pair relaxed exactly over the step (exponentially — stable for a tiny gas cell next to
thick glass); thin glass conducts through like thick (`kCell`). Radiation above 600 K. Phase changes by the enthalpy
method, so the temperature stays at the melting point until all has melted (tin at 232 °C, both ways); ice melts at the
freezing point of the solution next to it (a trace of dew does not count). Salt lying on ice wets it at the contact (the
ice is always a little wet there): the salt dissolves in that film, the brine lowers the freezing point of the ice next
to it, and the ice melts with its own heat — crushed ice and salt cool to about −10 °C in a minute and a half when
stirred, to about −4 °C without stirring. Water boils where its vapour pressure (Antoine, Raoult) reaches the pressure;
it evaporates at its surface (at most 5 K of evaporative cooling per step and cell) and condenses on colder walls (dew
heats them). Vapour in cooler gas becomes mist only as far as the cell stays saturated after the latent heat
(Clausius–Clapeyron coupling). A scene temperature puts the content in its state at that temperature (`T: 260` on tin:
molten); a thing that is placed has room temperature, also in hot water — it warms up.

### 3.5 Gases and liquids (`chemAir.ts`, `chemFlow.ts`)

Gas spaces are regions: open ones are at room pressure, closed ones get P = nRT/V and push gas through liquid (bubbling)
or pop the stopper at +40 kPa. Walls hold no gas, so a closed tube standing in a water bath keeps exactly its own gas.
**Buoyancy** swaps whole parcels with a neighbour (straight up, or diagonally so a dense streak slides past lighter air)
with the velocity √(2·g·L·Δρ/ρ) (L a parcel of about a cell, ×2.5): every parcel moves at most one cell per pass, and
the number of passes follows the velocity (up to four per step), so a large step moves gas as far as two small ones. A
warm rising parcel entrains its cooler neighbours; heavy gas spreads sideways only where it rests on something. The slab
lies in a big room: a warm plume in the open also draws room air from front and back (α ≈ 0.1 of its velocity) — the
gas above a Bunsen flame is ~900 °C at 6 cm and ~250 °C at 25 cm, not a hot column. The top of the world is open.

Liquids flow as amounts (down, sideways, overfull up). **Mixing** (`mixLiquids`) has three parts: density-driven
convection moves whole parcels (warmer or less concentrated water up, as fast as its buoyancy velocity, once per pass),
dense solution resting on the floor or on denser liquid flows sideways (the coloured layer around a crystal spreads);
turbulence (stirring rod, magnetic stirrer, pouring, bubbles; it decays in a second or two) exchanges up to 40 % per
step; and **molecular diffusion** with D ≈ 1.5·10⁻⁵ cm²/s at 25 °C scaled by T/η(T) (Stokes–Einstein with the Vogel
viscosity of water — 3.4× faster at 80 °C than at 20 °C), accumulated over half a second because it is so small. Still
layers therefore mix slowly: a permanganate layer under water loses ~1–2 % into the water above in ten minutes.
Granules and powders fall, in water at their sinking speed (stirring lifts crystals); solids lighter than water (ice)
float; rigid pieces fall or float. Bubbles are particles that rise in half-cell steps and never through a wall; they
dissolve soluble gas on their way, steam bubbles collapse in colder water, at the surface they release their gas.

### 3.6 Rates (`chemKinetics.ts`, `chemCell.ts`)

Reactions happen only where their reactants are in the same cell (or a solid touches a wetted neighbour), and at a rate
that follows from the conditions there — so a reaction can stay incomplete, leave a rest, or run in both directions.
The scheme is the one of reactive-transport codes (operator splitting): transport and heat first, then the **fast
equilibria** as speciation (§3.2), then the **slow reactions** with their rate laws.

**Dissolving** (Noyes–Whitney): rate = A·D(T)/δ·cₛ·(1 − (Q/Ksp)^(1/ν)) — A the surface of the solid in the cell (from
its grain: crystals 0.5 mm, powder 0.04 mm) or the face it shows to a wet neighbour, D(T) as above, δ the saturated film,
0.2 mm in still water and thinner with turbulence (δ = 0.02/(1 + 6·turb) cm), cₛ the saturation from Ksp(T), ν the ions
per formula. Sugar uses a solubility table (179 … 487 g/100 g). 2 g of CuSO₄·5H₂O in 50 cm³ dissolve in 30 s about four
times as much in water at 80 °C as at 5 °C, 3.5 times as much with the magnetic stirrer, four times as much as powder.
Sparingly soluble basic salts dissolve in acid by a surface reaction with Arrhenius.

**Slow reactions** are rows of a table (`KINETICS`): what is used and made (aqueous, gas, solid, water), a rate constant
at 25 °C and an activation energy, the orders, optional catalyst surface (MnO₂, potato, copper), pH window, the number of
H⁺ or OH⁻ it consumes (`acid`, `base` — never counted, so the step is limited by what the charge balance holds) and an
upper temperature (catalase denatures above 60 °C). The rate is

  r = k₂₅·exp(−Eₐ/R·(1/T − 1/298.15)) · (V or A) · Π cᵢ^nᵢ

and the extent of a step ξ = ξmax·(1 − e^(−r·dt/ξmax)), so a reaction never uses more than is there and a long step
does not overshoot. A catalyst is a separate pathway with its own k and Eₐ (H₂O₂: alone k = 10⁻⁸ s⁻¹; with I⁻
0.012 L/(mol·s), Eₐ 56 kJ/mol; with Fe³⁺; on MnO₂; with catalase). Rows: H₂O₂ and its catalysts, MnO₄⁻ with Fe²⁺ and
with H₂O₂ (acidic and neutral), copper in nitric acid (concentrated → NO₂, dilute → NO), the thiosulfate clock
(S₂O₃²⁻ + 2H⁺ → S↓ + SO₂ + H₂O, first order, Eₐ 45 kJ/mol: 50 cm³ of 0.15 mol/dm³ with 5 cm³ of acid turn cloudy after
~45 s at 20 °C, about twice as fast per 10 K, twice as slow at half the concentration), chromate ⇄ dichromate (by pH
window), 2NO ⇄ … and N₂O₄ ⇄ 2NO₂.

**Reversible reactions** carry an equilibrium constant K₂₅; K(T) follows by van 't Hoff with ΔH from the formation
enthalpies, and the backward rate is k/K. In a gas cell the step goes toward Q = K — solved by bisection *together with
the reaction's own heat* (a tiny gas cell would otherwise overshoot and oscillate). N₂O₄ ⇄ 2NO₂ (ΔH = +57 kJ/mol):
in a closed tube with 40 % NO₂ in air the brown NO₂ is ~6 % of the gas in ice water, ~11 % at room temperature and
~33 % in hot water, where the pressure rises by a third (pure NO₂ would pop the stopper). A filled vessel starts in
equilibrium (`settleGas`).

A reaction is reported once per vessel (§3.7); one that makes a solid is reported like a precipitate (from 2 mg).

### 3.7 Chemistry and fire in the cells (`chemCell.ts`, `chemFire.ts`)

Salts precipitate where solutions meet; metals react at wetted faces (water, acid, base; rate by E°, surface, [H⁺] and
temperature; zinc ~1 cm³ H₂ per second in 1 mol/dm³ HCl), nobler metals deposit as a coat; hydration (CaO, CuSO₄),
Henry exchange at surfaces, supersaturated CO₂ fizzes, decomposition on heating (Arrhenius). Gases burn above their
ignition temperature, or next to a flame when the mixture could heat itself past 1300 K (hydrogen: 950 K — lean mixtures
still burn); a **hydrogen** flame runs through the whole flammable mixture within one step (≈2.5 m/s) — the pop.
Methane without oxygen forms soot (the yellow flame); solids burn at their faces (magnesium, sulfur, charcoal, wood,
steel wool), brighter in oxygen; the candle draws air from around its wick and goes out at ~15 % O₂; salts on the loop
colour the flame; NH₃ meeting HCl gas makes white smoke.

### 3.8 What is reported (`chemWorld.ts`)

Every event is reported once per vessel, with its equation (`chemEq.ts`). Boiling, melting, freezing only when visible:
enough liquid, the content as a whole that warm (dew on hot glass does not count), and for melting and freezing only
once a quarter of the amount (at most 0.5 g) has changed beyond its extreme. A precipitate is reported from 2 mg in the
vessel; less waits up to 20 s for its growth (traces where two solutions meet stay silent). Colour changes come from the
averaged look of the whole solution; NO₂ is drawn by Lambert–Beer (the molecules on the way through the vessel), so a hot
tube is dark brown and one in ice pale.

### 3.9 Scene (`chemSetup.ts`)

`room`, `world`, `vars`, `things` (`id`, `kind`, `x`, `y`, `on`, `in` — a piece, thermometer, rod, or a tube in a water
bath —, `size`, `of`, `angle`, `label`, `hidden`, `held`, `fill` [{ `reagent`, `amount` }], `T`, `gas` — the fractions of
a mixture instead of air, mixed and in equilibrium, or a burner's gas —, `closed`, `lit`, `air`, `power`, `stir`,
`height`, `content` — a saved state), `shelf` (ids or groups), `tools`, `allow` (`shelf`, `things`, `move`), `show`
(`values`, `composition`, `micro`, `equations`, `heat`), `graph`, `before` (actions done while building — a slide starts
where the previous one ended), `warm` (seconds run before the start), `steps` (`say`, `do` — add, pour, move, burner,
heat (`on`, `power`, `stir`), ignite, use, flame, tap, tilt, speed —, `wait` up to 600 s, `ask` — a prediction
question, `answer` may be `"=name"`), `speed` (up to 300), `view`. The sandbox's JSON export writes `content` per thing,
so a built bench can become a module; loading it settles the solids without running time.

Interaction: take a reagent (amount chips) and tap a vessel; drag a vessel over another's mouth — it tilts and pours
while held (an empty vessel pours heavy gas); drop it on a tripod over the burner, or a closed tube into a water bath;
tap a burner or a burette. The side panel: the selected thing (temperature, liquid, pH, gas pressure and composition,
solids and melts), burner air and gas, hotplate power, heating and stirrer, burette rate, **Pod lupą** (`chemMicro.ts`),
observations, recorder, steps. The heat view colours temperature finely between the room and 100 °C, then carmine, then
the glow. Time: steps of 1/30 s; at higher speeds a frame takes up to four longer steps — up to 0.12 s while something
burns, drips or streams, otherwise up to 2 s (time-lapse for dissolving, diffusion, cooling; speeds 1 … 300×).

### 3.10 Experiments and slide decks

Presets (29): melting and freezing of tin · Field's metal in hot water · heat conduction in rods (heat view) ·
convection (KMnO₄) · precipitation reactions · mixing two solutions (the cloud of AgCl) · titration on a magnetic
stirrer · alkali metals in water · metals in hydrochloric acid · hydrogen and the pop · catalysis of H₂O₂ · the
disappearing cross (thiosulfate: concentration and temperature) · candle under a jar · CO₂ extinguishes candles ·
stopper popping · limewater · heat of dissolution · boiling of water and brine · freezing mixture · speed of dissolving
(cold, hot, stirred; crystals and powder on the shelf) · diffusion in cold and hot water · displacement series · golden
rain · copper and ammonia · indicators · chromate ⇄ dichromate · NO₂ ⇄ N₂O₄ in cold and heat · riddle: which salt?

Slide decks (`scripts/lab-decks.mjs` → `fixtures/lab-pokaz-*.json`, pages in mode `slides`): a hero slide with the goal,
then one chemistry slide per step — a constrained scene whose state is written into the scene itself (molten tin at
260 °C, zinc already in the acid via `before` and 12 s of `warm`), with its prediction question —, at the end a text
slide with the explanation. Decks: tin (heating, the melting plateau, freezing), precipitation (AgCl poured, Cu(OH)₂,
PbI₂, Fe(OH)₃, BaSO₄), metals and hydrogen (zinc, the activity series, the pop), combustion (candle under a jar, CO₂ on
candles, limewater), acid and base (phenolphthalein, heat of neutralisation, titration), heat (conduction, convection,
freezing mixture), **dissolving and diffusion** (KMnO₄ in cold and hot water, CuSO₄ in cold and hot water, with and
without the stirrer, crystals and powder, KNO₃ saturating in cold water and dissolving when heated), **reaction rate**
(thiosulfate concentration and temperature, MnO₂ with the glowing splint, marble and chalk) and **reversible reactions**
(chromate in acid, dichromate in base, NO₂/N₂O₄ in three baths). Each slide's `expect` (a sentence in the
observations, a thermometer above/below or on a plateau, a candle out, one point warmer than another, a substance risen
into the upper half, or `more` — an amount in one vessel more than f times that in another: dissolved, solid, a gas
share, the share in the upper half) is checked before writing; the check runs time like the stage (frames at the
scene's speed).

## 4. Checks

`node scripts/app-lab-check.mjs` (part of `app:check`, about a minute and a half): physics (free fall, air, rest and a
tower, collision, inclined plane, pendulum and spring periods, Atwood, Newton's cradle, floating and displacement,
pressure, Torricelli, communicating vessels with oil) and chemistry against textbook values (pH of acids, bases and
water, also hot; solubility of KNO₃ and Ca(OH)₂ against temperature; heat of neutralisation and of dissolution; AgCl
exactly by the equation; sodium in water, zinc but not copper in acid, iron coated with copper; the tin plateau at
232 °C; conduction — a copper rod cools far above ice water, glass hardly; water boils at 100 °C, brine higher; a CO₂
cloud sinks, a candle under a jar goes out, the burner heats, hydrogen pops, sodium colours the flame; titration jumps
between 20 and 30 cm³; crushed ice and salt reach −10 °C when stirred and cool also unstirred; dissolving faster hot,
stirred and as powder; D(80 °C) > 3·D(20 °C) and still layers mix slowly; the thiosulfate rate first order with
Arrhenius, H₂O₂ first order in iodide; chromate ⇄ dichromate; NO₂/N₂O₄ in every cell at K(T); CuSO₄ acidic and clear
also hot, FeCl₃ more acidic; a closed tube in a water bath keeps its gas; every preset and the sandbox build, run
without NaN and save without loss).

## 5. Limits, on purpose

Ideal solutions (no activity coefficients); one solid and one liquid per cell; the slab is 2D, its third dimension only
in the volumes and in the entrainment of room air. Rate constants are textbook values where they exist (H₂O₂ with I⁻,
the N₂O₄ equilibrium) and otherwise calibrated so the classroom version takes as long as in reality (the thiosulfate
clock, metals in acid); chromate ⇄ dichromate switches by pH windows instead of an equilibrium with H⁺. Diffusion lives
on 4 mm cells: across a sharp boundary it carries, in the first hour, less than the √(Dt) law would (about a third after
ten minutes) — what one sees in a beaker is mostly convection anyway. A step costs 5–15 ms on a desktop, so very fast
speeds run with longer steps. The physics is 2D rigid bodies (no soft bodies, no rolling resistance), and its liquids are
basins, not particles.
