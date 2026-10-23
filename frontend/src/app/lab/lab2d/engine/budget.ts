/**
 * LABOR 2D (v2) — DIE BILANZEN (Prompt v2, Prinzip 6 und Test 4): Wasser in
 * jedem Zustand, Luft, Energie — und was hinein- und hinausging.
 *
 *   E = Σ E_s + Σ m_p h_p + Σ H_Gas + Σ H_Blase − Σ_verschlossen p0 V_g
 *
 * (in verschlossenen Gebieten zählt die innere Energie U = H − p0 V_g; das
 * Salz am Boden der Kiste zählt mit seiner Enthalpie zu den Feststoffen). Die
 * Änderung von E muss gleich sein: Heizung − Verluste durch Wände − Leitung an
 * offenen Seiten − Entwichenes + Eingriffe der Werkzeuge. Wasser zählt ohne
 * sein gelöstes Salz; das Salz hat eine eigene Bilanz (gelöst, Kruste, Boden,
 * entwichen).
 */

import type { Bubbles } from './bubbles';
import type { Grid } from './grid';
import type { Particles } from './particles';
import type { Regions } from './regions';
import { WATER } from './materials';
import { H2O, N2, O2, SOLID, SPECIES_SLOTS } from './units';

export interface WaterByState {
  liquid: number;
  vapour: number;
  fog: number;
  film: number;
  bubbles: number;
  escaped: number;
  total: number;
}

/** Flüssigkeiten ausser Wasser (Öl): sie verdampfen nicht — in der Kiste und entwichen (kg). */
export interface OtherLiquids {
  liquid: number;
  escaped: number;
  total: number;
}

/** Kochsalz (M2b): gelöst in den Teilchen, als Kruste auf Feststoffen, am Boden der Kiste, entwichen (kg). */
export interface SaltByState {
  liquid: number;
  crust: number;
  floor: number;
  escaped: number;
  total: number;
}

/** Salz am Boden der Kiste (salt.ts): Masse und Enthalpie. */
export interface FloorSalt {
  readonly mass: number;
  readonly energy: number;
}

export interface BudgetSnapshot {
  /** Energie des Inhalts (J) nach der Formel oben. */
  energy: number;
  /** Davon: Feststoffe, Flüssigkeit, Gas, Blasen, −p0 V_g. */
  solids: number;
  liquid: number;
  gas: number;
  bubbles: number;
  pv: number;
  water: WaterByState;
  other: OtherLiquids;
  salt: SaltByState;
  /** Luft (N₂ + O₂) in Zellen und Blasen plus entwichen (kg). */
  air: number;
}

export interface Flows {
  /** Seit dem Start (J): Heizung, Verluste durch Wände, Leitung an offenen Seiten, entwichene Enthalpie, Eingriffe. */
  heater: number;
  lossWalls: number;
  lossOpen: number;
  escapedEnergy: number;
  editEnergy: number;
  /** Seit dem Start (kg): entwichenes Wasser und Luft, Eingriffe. */
  escapedWater: number;
  escapedAir: number;
  editWater: number;
  editAir: number;
  /** Andere Flüssigkeiten (kg): entwichen, Eingriffe. */
  escapedOther: number;
  editOther: number;
  /** Salz (kg): entwichen (mit Teilchen oder durch einen offenen Boden), Eingriffe. */
  escapedSalt: number;
  editSalt: number;
  /** Arbeit bewegter Körper an verschlossenem Gas (J, M3a): der Sprung von −p0·V, wenn ein Körper Zellen eines verschlossenen Gebiets füllt oder freigibt. */
  bodyWork: number;
}

export function emptyFlows(): Flows {
  return { heater: 0, lossWalls: 0, lossOpen: 0, escapedEnergy: 0, editEnergy: 0, escapedWater: 0, escapedAir: 0, editWater: 0, editAir: 0, escapedOther: 0, editOther: 0, escapedSalt: 0, editSalt: 0, bodyWork: 0 };
}

const NO_FLOOR: FloorSalt = { mass: 0, energy: 0 };

/** Den Inhalt zählen. */
export function measure(g: Grid, P: Particles, B: Bubbles, R: Regions, flows: Flows, out: BudgetSnapshot, floor: FloorSalt = NO_FLOOR): BudgetSnapshot {
  const n = g.n;
  let solids = 0;
  let gas = 0;
  let vapour = 0;
  let fog = 0;
  let film = 0;
  let crust = 0;
  let air = 0;
  for (let c = 0; c < n; c += 1) {
    if (g.kind[c] === SOLID || g.solid[c] !== 0) { solids += g.Es[c]; film += g.film[c]; crust += g.crust[c]; continue; }
    gas += g.Hg[c];
    vapour += g.mg[H2O * n + c];
    fog += g.mfog[c];
    air += g.mg[N2 * n + c] + g.mg[O2 * n + c];
  }
  let liquid = 0;
  let liquidMass = 0;
  let otherMass = 0;
  let saltMass = 0;
  for (let p = 0; p < P.count; p += 1) {
    liquid += P.mass[p] * P.h[p];
    const s = P.smass[2 * p];
    saltMass += s;
    if (P.mat[p] === WATER) liquidMass += P.mass[p] - s;
    else otherMass += P.mass[p] - s;
  }
  solids += floor.energy;
  let bub = 0;
  let bubWater = 0;
  for (let b = 0; b < B.count; b += 1) {
    bub += B.H[b];
    bubWater += B.m[b * SPECIES_SLOTS + H2O];
    air += B.m[b * SPECIES_SLOTS + N2] + B.m[b * SPECIES_SLOTS + O2];
  }
  /* Verschlossen: U = H − p0 V für alle Phasen des Gebiets (Gas, Flüssigkeit, Blasen) — V_Fluid bleibt fest. */
  const pv = R.pvTerm();
  out.solids = solids;
  out.liquid = liquid;
  out.gas = gas;
  out.bubbles = bub;
  out.pv = pv;
  out.energy = solids + liquid + gas + bub + pv;
  const w = out.water;
  w.liquid = liquidMass;
  w.vapour = vapour;
  w.fog = fog;
  w.film = film;
  w.bubbles = bubWater;
  w.escaped = flows.escapedWater;
  w.total = liquidMass + vapour + fog + film + bubWater + flows.escapedWater;
  const o = out.other;
  o.liquid = otherMass;
  o.escaped = flows.escapedOther;
  o.total = otherMass + flows.escapedOther;
  const sl = out.salt;
  sl.liquid = saltMass;
  sl.crust = crust;
  sl.floor = floor.mass;
  sl.escaped = flows.escapedSalt;
  sl.total = saltMass + crust + floor.mass + flows.escapedSalt;
  out.air = air + flows.escapedAir;
  return out;
}

export function emptySnapshot(): BudgetSnapshot {
  return {
    energy: 0, solids: 0, liquid: 0, gas: 0, bubbles: 0, pv: 0, air: 0,
    water: { liquid: 0, vapour: 0, fog: 0, film: 0, bubbles: 0, escaped: 0, total: 0 },
    other: { liquid: 0, escaped: 0, total: 0 },
    salt: { liquid: 0, crust: 0, floor: 0, escaped: 0, total: 0 }
  };
}
