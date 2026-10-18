# Laboratories — a 2D physics lab and a 2D chemistry lab as page parts

Status: built on 2026-10-18 (frontend only, no migration, no backend change). The request: a module with a hard-coded
2D physics engine in which different things can be built and randomness used, where *how* the engine is used on a page
is saved in the database; and a chemistry module — materials, temperature, state, pressure in a vessel, sodium in water
giving hydrogen bubbles and heat, salts reacting in water, fire, bubbles, a view of how the air or the liquid is mixed,
liquid pressure in both labs, full screen, pleasant interaction, a sandbox and specific experiments for school.

## 1. The shape of it

| | Physics (`physics`) | Chemistry (`chemistry`) |
|---|---|---|
| Part | `pages/parts/physics.tsx` | `pages/parts/chemistry.tsx` |
| Engine | `lab/physics/` (bodies, contacts, joints, fluids) | `lab/chem/` (species, equilibria, reactions, phases, bench) |
| Component | `PhysicsLab.tsx` | `ChemLab.tsx` |
| Scene reader / writer | `physScene.ts`, `physSave.ts` | `chemScene.ts` |
| Experiments | `physPresets.ts` (15) | `chemPresets.ts` (23) |
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
("Pracownia chemiczna", "Pracownia fizyczna") with an intro text, every preset as a module and a sandbox. The script
runs every scene first and imports both pages through `planImport` (no warnings).

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

## 3. Chemistry

### 3.1 What is counted

A vessel holds water (mol), solutes, solid lumps, gas, one temperature. Solutes are **strong ions** (Na⁺, Cl⁻, Cu²⁺ …),
the **totals of weak pools** (C: CO₂/HCO₃⁻/CO₃²⁻, Ac: acetic acid/acetate, N: NH₄⁺/NH₃, S: SO₂/HSO₃⁻/SO₃²⁻), molecules
(H₂O₂, ethanol, detergent) and indicator drops. **H⁺ and OH⁻ are never counted**: they follow from charge balance.
Adding NaOH adds Na⁺ and one water; HCl adds only Cl⁻; Na₂CO₃ adds 2 Na⁺, one C and one water.

### 3.2 One equilibrium (`chemPh.ts`)

`[H⁺] − [OH⁻] + Σz·c(strong) + Σ charge of the pools + Σ charge change of hydroxo complexes = 0`, decreasing in pH,
solved by bisection. Complexes (Cu(NH₃)₄²⁺, Ag(NH₃)₂⁺, Zn(OH)₄²⁻, Al(OH)₄⁻, FeSCN²⁺) need free NH₃ / SCN⁻, found by an
inner bisection on the ligand balance. Kw and every Ka follow the temperature by van 't Hoff with enthalpies from the
same formation-enthalpy table — hot water is neutral below pH 7.

### 3.3 Heat comes from the balance (`chemVessel.ts`)

`chemical()` is Σ formation enthalpies of everything in the vessel, including what the forms of the pools and of H⁺/OH⁻
carry relative to the counted forms (`formEnthalpy`). After every step: released heat = old enthalpy + what entered or
left − new enthalpy; `T += (released + burner − room losses + sensible heat of what was added) / heat capacity` (water,
glass, solids, gas). No reaction knows its own heat: neutralisation warms (~5.5 K for 25 + 25 mL of 1 mol/L), NaOH
dissolving heats, NH₄NO₃ cools, CaO slaking boils, sodium warms the water, peroxide decomposition can boil. Gas that
leaves takes its enthalpy (`exchange`), poured portions carry theirs (`take` / `give`).

### 3.4 Processes (`chemSalts.ts`, `chemReact.ts`, `chemPhase.ts`)

- **Salts, hydroxides, carbonates, oxides — one rule**: Q against Ksp(T) (Ksp from solubility or tabulated, van 't Hoff
  with the dissolution enthalpy). The amount that dissolves or precipitates is found so that *after* the equilibrium
  Q = Ksp (bisection over x, the pH solved inside), so precipitating Cu(OH)₂ lowers the pH and CaCO₃ dissolves in acid.
  Precipitation relaxes within a fraction of a second; dissolving is limited by surface (piece, granules, crystals,
  powder, ribbon — chalk faster than marble). Well soluble salts crystallise (KNO₃ on cooling), sparingly soluble ones
  precipitate and settle. Follows without own code: limewater turns milky and partly clears with more CO₂, Zn(OH)₂
  dissolves in base and acid, AgCl in ammonia but AgI not, PbI₂ dissolves hot and falls as golden rain, Cu(OH)₂ turns
  deep blue in excess ammonia. Bottle solutions are clarified (what would precipitate by hydrolysis is filtered off).
- **Metals**: with water (Li, Na, K, Ca; Mg only hot via its activation energy), with acid (rate ∝ surface · [H⁺],
  ordered by E°: Mg ≫ Zn > Fe > Pb, Cu none), Al and Zn with base, Al with a slowly dissolving oxide layer, displacement
  of nobler metals as a coat (Fe + Cu²⁺, Cu + Ag⁺), copper in nitric acid (NO, or NO₂ when concentrated). A reacting
  piece is locally hotter (heat / surface): sodium melts into a ball and skates, potassium ignites its hydrogen.
- **Solution reactions** (table): H₂O₂ decomposition (MnO₂, potato, I⁻, Fe³⁺, temperature), MnO₄⁻ with Fe²⁺ or H₂O₂
  (decolourised in acid, brown MnO₂ otherwise). **Hydration**: CaO → Ca(OH)₂, white CuSO₄ → blue. **Decomposition** on
  heating (NaHCO₃, CaCO₃, CuCO₃, Cu(OH)₂ even under water, CuSO₄·5H₂O, KMnO₄, NH₄Cl, Ag₂O, hydroxides, sugar).
- **Fire**: fuels with ignition temperature, minimum oxygen and products (Mg blinding white, S blue, C glowing, steel
  wool sparks, candle, ethanol); a candle under a closed jar goes out at ~16 % O₂; open crucibles burn in room air.
- **Gases**: Henry exchange for CO₂, NH₃, SO₂ (temperature-dependent), HCl and NO₂ absorbed; bubbles only when the
  dissolved gases together would exceed the outside pressure (soda water fizzes, ammonia water does not). Open vessels
  vent overpressure and mix with room air at a rate set by the mouth and by buoyancy — hydrogen is gone in seconds,
  heavy CO₂ stays in a beaker for minutes and can be poured onto a candle, hot flame gases rise out. NO turns brown in
  air, NH₃ and HCl make white smoke.
- **Vapour, boiling, ice**: evaporation by vapour pressure (Antoine, Raoult); the temperature cannot exceed the boiling
  point, the excess boils water off (salt water boils higher; in a closed vessel the boiling point rises with pressure);
  ice melts at the freezing point of the solution (ice and salt go below 0 °C).
- **Pressure**: closed vessels hold pressure (gas, heat, vapour) until the stopper flies at +45 kPa; a manometer shows
  Δp as a water U-tube; a tube between vessels lets gas flow when the pressure beats the water column above the tube's
  end (ρgh), and when the first vessel's pressure falls far enough the liquid rises back — the ammonia fountain. The
  pressure probe reads p₀ + ρgh at a depth. A gas syringe collects gas at room pressure and shows its volume.

### 3.5 The bench and the view

`chemBench.ts`: vessels (beaker, conical and round flask, test tube in a rack or clamped over the burner, measuring
cylinder, evaporating dish, crucible, jar, burette over a vessel with a tap, gas syringe), burners with tripod and gauze
(blue / luminous flame, tinted by the flame test), tubes, steps of 1/30 s, events. Each process emits observations once
(gas, precipitate with colour, dissolving, colour change, warming, boiling, stopper, flame…) with the ionic or molecular
equation built from the data (`chemEq.ts`). Tools: glowing splint (relights in O₂), burning splint (pops in H₂, goes out
in CO₂), match, indicator paper (pH), damp paper at the mouth (acidic or basic gas), flame-test loop, stirrer, stopper,
manometer, tube, deflagrating spoon (take a dry solid, ignite it in the burner, put it into another vessel), pressure
probe, empty, delete.

Interaction: take a reagent from the shelf (amount chips: g, cm³, drops) and tap a vessel (or its chip in "Naczynia");
drag a vessel over another — it aligns, tilts and pours while held (an empty vessel pours a gas heavier than air); drop it
on a burner's tripod to heat it; tap a burner to light it; tap a burette to open its tap. The side panel shows the
selected vessel (temperature, liquid, pH, gas pressure, gas composition as a bar, solutes with concentrations, solids),
**Pod lupą** (`chemMicro.ts`: gas molecules flying above, water and ions jiggling below; when the composition changes a
few particles are recoloured per frame, so mixing is visible), the observations log, a recorder (T, pH, p, syringe
volume) and the steps.

Effects (`chemFx.ts`): bubbles from metals, catalysts and tube ends (fizz around a floating piece), bulk degassing and
boiling, steam, smoke, flames (light background: strong colours; dark: additive), sparks, precipitate flakes, swirls of
a poured colour, drops (burette, splashes, overflow), foam with overflow over the rim, the flying stopper, "Pyk!".
Counts are capped (fewer on touch devices) and move in real time even when chemistry runs faster.

### 3.6 Scene

`room`, `vars`, `vessels` (`id`, `type`, `size`, `x`, `label`, `hidden`, `on` — burner id, `closed`, `gauge`, `T`,
`fill` [{ `reagent`, `amount` }], `gas` (fractions instead of air), `over` + `drip` for a burette, `content` — a saved
state), `burners`, `links`, `shelf` (ids or groups), `tools`, `allow` (`shelf`, `vessels`, `move`, `burner`), `show`
(`values`, `composition`, `micro`, `equations` — switch composition off for riddles), `graph`, `steps` (`say`, `do` —
add, pour, burner, use, flame, link, seat, drip, speed —, `wait`, `ask` — a prediction question; `answer` may be
`"=name"`, the index of a drawn pick), `speed`, `view`. The sandbox's JSON export writes `content` per vessel, so a
built bench can become a module.

### 3.7 Experiments

Alkali metals in water · metals in hydrochloric acid · displacement series · titration (burette, pH curve) ·
precipitation reactions · golden rain · CO₂ and limewater · catalysis of H₂O₂ · elephant toothpaste · heat of
dissolution · solubility of KNO₃ · indicators (red cabbage) · burning magnesium and sulfur · candle and CO₂ · ammonia ·
ammonia fountain · flame tests · gas and liquid pressure · boiling of water and brine · amphoteric Zn(OH)₂ · copper and
ammonia · riddle: which salt? (random) · rate of reaction: marble vs chalk with gas syringes.

## 4. Checks

`node scripts/app-lab-check.mjs` (part of `app:check`): physics (free fall, air, rest and a tower, collision, inclined
plane, pendulum and spring periods, Atwood, Newton's cradle, floating and displacement, pressure, Torricelli,
communicating vessels with oil) and chemistry (pH of strong and weak acids and bases, buffer, hot water; heat of
neutralisation and dissolution; AgCl, KNO₃(T), Ca(OH)₂(T), the copper–ammonia complex, amphoteric zinc hydroxide, AgCl
vs AgI in ammonia; sodium in water, Mg + HCl → H₂ with the pop test, the activity series, Fe + Cu²⁺; O₂ from peroxide,
CO₂ into limewater, the candle in a jar, heavy CO₂ and light H₂, boiling of water and brine, the stopper, ammonia,
the flame test, ice and salt).

## 5. Limits, on purpose

Ideal solutions (no activity coefficients); one temperature per vessel (a reacting piece is only *drawn* hotter); no
concentrated sulfuric acid, no electrolysis, no organic chemistry beyond the fuels; reaction rates are tuned to look
right in a classroom, not fitted to kinetics data. The physics is 2D rigid bodies (no soft bodies, no rolling
resistance), and liquids are basins, not particles.
