/**
 * LABOR 2D (v2) — WAS EINE ABLESUNG DES BESCHLEUNIGTEN WEGS BRINGT (aus
 * engine.ts, seit 2026-10-26 eine eigene Datei): die Zwischensummen und den
 * Zustand einer Ablesung, ihre Plätze im Zwischenpuffer, die Gesamtsummen seit
 * dem Start, die der Arbeiter in f64 führt.
 */

import type { BodyRead } from './bodies';
import { C } from './slots';

/** Was eine Ablesung bringt (Zwischensummen seit der letzten, Zustand jetzt). */
export interface Readout {
  readonly pcount: number;
  readonly bcount: number;
  readonly dt: number;
  readonly stepsSince: number;
  readonly simSince: number;
  readonly itL: number; readonly itG: number; readonly itH: number; readonly itD: number;
  readonly capL: number; readonly capG: number; readonly capH: number; readonly capD: number;
  readonly resL: number; readonly resG: number; readonly resH: number;
  readonly nsub: number;
  readonly uMaxG: number;
  readonly waterMass: number;
  readonly waterT: number;
  readonly waterTmax: number;
  readonly solids: number; readonly film: number; readonly gas: number; readonly vapour: number; readonly fog: number; readonly air: number;
  readonly liquidCells: number; readonly gasCells: number;
  readonly liquidH: number; readonly liquidMass: number; readonly sensible: number;
  /** Andere Flüssigkeiten als Wasser (M2a): Masse und Σ m T. */
  readonly otherMass: number; readonly otherMT: number;
  /** Salz (M2b): gelöst in den Teilchen, als Kruste, am Boden der Kiste (kg) und dessen Enthalpie (J). */
  readonly saltLiquid: number; readonly crust: number; readonly floor: number; readonly floorH: number;
  readonly bubH: number; readonly bubWater: number; readonly bubAir: number;
  readonly regions: { p0: number; sealed: boolean; vGas: number; vFluid: number }[];
  readonly heaters: { P: number; Tmean: number; integral: number; cells: number }[];
  readonly watch: { found: boolean; id: number; fate: number; data: Float32Array };
  readonly firstSuperheat: number | null;
  readonly stageMs: number[] | null;
  /** Zwischensummen seit der letzten Ablesung (Flüsse in J und kg, Zähler). */
  readonly intervals: Readonly<Record<IntervalKey, number>>;
  /** Massstäbe der Einblendungen im letzten Bild: grösster Überdruck (Pa), Gas- und Wassergeschwindigkeit (m/s). */
  readonly ov: readonly [number, number, number];
  /** Heftige Zustände seit der letzten Ablesung: schnellstes Teilchen (m/s), grösste Blase (m), gebremste Teilchen, abgelassener Dampf (kg). */
  readonly vmaxP: number;
  readonly rmaxB: number;
  readonly slowed: number;
  readonly vented: number;
  /** Körper mit genauen Anteilen (seit 2026-10-26): je Körper Lage, Zustand, Masse, Temperatur, Energie, Film, Kruste; Iterationen und gekappte Läufe der Messung der mitbewegten Masse. */
  readonly bodies: readonly BodyRead[];
  readonly itP: number;
  readonly capP: number;
}

export type IntervalKey = 'heater' | 'lossWalls' | 'lossOpen' | 'escapedEnergy' | 'escapedWater' | 'escapedAir' | 'escapedOther' | 'escapedSalt' | 'crystallized' | 'produced' | 'condensed' | 'dew' | 'fogMade'
  | 'burstVapour' | 'fluxSL' | 'fluxLG' | 'fluxSG' | 'lossSolids' | 'nucleated' | 'departed' | 'merged' | 'burst' | 'collapsed'
  | 'burstCold' | 'burstWarm' | 'collapsedCold' | 'collapsedWarm' | 'releasedGas' | 'releases' | 'releaseMisses' | 'evapCapped'
  | 'bodyWork' | 'parked' | 'contFull' | 'melted' | 'frozen' | 'meltFull';
/** Platz in cnt und Art (f: f32-Summe, u: u32-Zähler) jeder Zwischensumme. */
export const INTERVALS: readonly (readonly [IntervalKey, number, 'f' | 'u'])[] = [
  ['heater', C.HEATER_E, 'f'], ['lossWalls', C.LOSS_WALLS, 'f'], ['lossOpen', C.LOSS_OPEN, 'f'], ['escapedEnergy', C.ESC_ENERGY, 'f'],
  ['escapedWater', C.ESC_WATER, 'f'], ['escapedAir', C.ESC_AIR, 'f'], ['escapedOther', C.ESC_OTHER, 'f'], ['escapedSalt', C.ESC_SALT, 'f'], ['crystallized', C.CRYST, 'f'], ['produced', C.PRODUCED, 'f'], ['condensed', C.CONDENSED, 'f'],
  ['dew', C.DEW, 'f'], ['fogMade', C.FOGMADE, 'f'], ['burstVapour', C.BURSTVAP, 'f'], ['fluxSL', C.FLUX_SL, 'f'], ['fluxLG', C.FLUX_LG, 'f'],
  ['fluxSG', C.FLUX_SG, 'f'], ['lossSolids', C.LOSS_SOLIDS, 'f'], ['nucleated', C.NUCLEATED, 'u'], ['departed', C.DEPARTED, 'u'],
  ['merged', C.MERGED, 'u'], ['burst', C.BURST, 'u'], ['collapsed', C.COLLAPSED, 'u'], ['burstCold', C.BURST_COLD, 'u'],
  ['burstWarm', C.BURST_WARM, 'u'], ['collapsedCold', C.COLL_COLD, 'u'], ['collapsedWarm', C.COLL_WARM, 'u'],
  ['releasedGas', C.REL_MASS, 'f'], ['releases', C.REL_N, 'u'], ['releaseMisses', C.REL_MISS, 'u'], ['evapCapped', C.EVAP_CAP, 'u'],
  ['bodyWork', C.BODYWORK, 'f'], ['parked', C.PARKED, 'u'], ['contFull', C.CONT_FULL, 'u'],
  ['melted', C.MELTED, 'f'], ['frozen', C.FROZEN, 'f'], ['meltFull', C.MELTFULL, 'u']
];

/** Gesamtsummen seit dem Start (f64), wie Engine.flows, Phase und BubbleModel sie führen. */
export interface Totals {
  time: number; steps: number;
  heater: number; lossWalls: number; lossOpen: number; escapedEnergy: number; escapedWater: number; escapedAir: number; escapedOther: number;
  escapedSalt: number; crystallized: number;
  produced: number; condensed: number; dew: number; fogMade: number; burstVapour: number;
  nucleated: number; departed: number; merged: number; burst: number; collapsed: number;
  burstCold: number; burstWarm: number; collapsedCold: number; collapsedWarm: number;
  fluxSL: number; fluxLG: number; fluxSG: number; lossSolids: number; capped: number;
  slowed: number; vented: number;
  /** Nur auf der GPU: Gas, das flüssige Zellen abgaben (kg), wie oft, wie oft ohne erreichbare Gaszelle (es blieb liegen), und wie oft
   *  das Verdunsten einer flüssigen Zelle auf ihr Wasser gekürzt wurde (je Schritt und Zelle). */
  releasedGas: number; releases: number; releaseMisses: number; evapCapped: number;
  /** Körper (seit 2026-10-26): ihre Arbeit an verschlossenem Gas (J, wie flows.bodyWork), Zellen, deren Gas beim Schliessen liegen blieb,
   *  Berührungen ohne Platz. */
  bodyWork: number; parked: number; contFull: number;
  /** Schmelzen (seit 2026-10-26): geschmolzenes und angefrorenes Eis (kg, wie BodyMelt.melted, frozen); wie oft ein Körper keinen Platz für seine neue Aufteilung fand. */
  melted: number; frozen: number; meltFull: number;
}

export const emptyTotals = (): Totals => ({
  time: 0, steps: 0, heater: 0, lossWalls: 0, lossOpen: 0, escapedEnergy: 0, escapedWater: 0, escapedAir: 0, escapedOther: 0, escapedSalt: 0, crystallized: 0,
  produced: 0, condensed: 0, dew: 0, fogMade: 0, burstVapour: 0, nucleated: 0, departed: 0, merged: 0, burst: 0, collapsed: 0,
  burstCold: 0, burstWarm: 0, collapsedCold: 0, collapsedWarm: 0, fluxSL: 0, fluxLG: 0, fluxSG: 0, lossSolids: 0, capped: 0,
  slowed: 0, vented: 0, releasedGas: 0, releases: 0, releaseMisses: 0, evapCapped: 0, bodyWork: 0, parked: 0, contFull: 0,
  melted: 0, frozen: 0, meltFull: 0
});

/** Wo im Zwischenpuffer einer Ablesung was liegt (Bytes; bodies: die Ablesung der Körper, nbody Körper). */
export interface ReadLayout { readonly cnt: number; readonly glob: number; readonly reg: number; readonly heat: number; readonly meas: number; readonly probe: number; readonly ts: number; readonly bodies: number; readonly nbody: number; readonly total: number }
/** Der Zustand, für den eine Ablesung aufgezeichnet wurde. */
export interface ReadMeta {
  readonly version: number;
  readonly layout: ReadLayout;
  /** GPU-Gebiet je CPU-Gebiet und Zahl der Heizungen beim Aufzeichnen. */
  readonly regions: readonly number[];
  readonly heaters: number;
  readonly groups: readonly number[];
  readonly nreg: number;
  readonly nheat: number;
}
