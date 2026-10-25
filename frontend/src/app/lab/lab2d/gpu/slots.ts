/**
 * LABOR 2D (v2) — DIE PLÄTZE der GPU-Speicher: welche Grösse wo liegt. Dieselben
 * Zahlen in TypeScript und als WGSL-Konstanten (SLOTS_WGSL, Teil der
 * Bibliothek lib.ts).
 *
 * - `glob` (f32): Zustand des Schritts (Δt, ρ_ref, …), von einzelnen Fäden geschrieben.
 * - `cnt` (atomic u32): Zähler (u32), Summen (f32 über Vergleichen-und-Tauschen)
 *   und Maxima (f32-Bits über atomicMax). Die Zwischensummen ab INTERVAL_FIRST
 *   leert der Arbeiter bei jeder Ablesung; er führt die Gesamtsummen in f64.
 * - Zellfelder: `cf` (f32), `cu` (u32), `at` (atomic: Quellen, die viele Fäden
 *   zugleich beitragen); Feld k von Zelle c liegt bei k·n + c.
 * - Flächenfelder: `ff` (f32), `fu` (u32), `af` (atomic); u-Flächen zuerst
 *   (i + j·(nx + 1)), dann die v-Flächen (nu + i + j·nx).
 * - Gebiete `reg` (f32) und ihre Summen `racc` (atomic), Heizgruppen `heat`
 *   (f32) und `hacc` (atomic), Skalare des CG `cgs` (atomic).
 */

/** glob: f32. */
export const G = {
  DT: 0, TIME: 1, RHOREF: 2, NSUB: 3, CAPACITY_WARN: 4
} as const;
export const GLOB_SIZE = 16;

/** cnt: atomic u32. */
export const C = {
  /* u32 */
  PCOUNT: 0, POLD: 1, BCOUNT: 2, NEXTID_B: 3, NEXTID_P: 4, PFULL: 5, BFULL: 6, PSORT: 7,
  /* f32-Summen dieses Schritts */
  SUM_M: 8, SUM_V: 9, SUM_WM: 10, SUM_WMT: 11, SUM_CL: 12,
  /* f32-Maxima dieses Schritts (Bits) */
  UMAXL: 13, MAXOUT: 14,
  /* Blase der Ansicht (Kennung; 0xffffffff: keine) und was aus ihr wurde */
  WATCH: 15,
  /* --- ab hier Zwischensummen bis zur nächsten Ablesung --- */
  /* f32 */
  ESC_WATER: 16, ESC_AIR: 17, ESC_ENERGY: 18, PRODUCED: 19, CONDENSED: 20, DEW: 21, FOGMADE: 22, BURSTVAP: 23,
  HEATER_E: 24, LOSS_WALLS: 25, LOSS_OPEN: 26, LOSS_SOLIDS: 27, FLUX_SL: 28, FLUX_LG: 29, FLUX_SG: 30, SIMTIME: 31,
  /* u32 */
  STEPS: 32, NUCLEATED: 33, DEPARTED: 34, MERGED: 35, BURST: 36, COLLAPSED: 37, BURST_COLD: 38, BURST_WARM: 39,
  COLL_COLD: 40, COLL_WARM: 41, CAPPED: 42, NSUBMAX: 43,
  IT_L: 44, IT_G: 45, IT_H: 46, IT_D: 47, CAP_L: 48, CAP_G: 49, CAP_H: 50, CAP_D: 51,
  /* f32-Maxima (Bits) */
  UMAXG: 52, FOGERR: 53, RES_L: 54, RES_G: 55, RES_H: 56,
  /* u32: Was aus der Blase der Ansicht wurde (0 lebt, 1 geplatzt, 2 vergangen, 3 aufgegangen) */
  WATCH_FATE: 57,
  /* erste Keimbildung: Bits von T_f − T_sat + 1000 (0: noch keine) und Werkstoff + 1 */
  FIRST_SH: 58, FIRST_MAT: 59,
  /* Heftige Zustände bis zur nächsten Ablesung (eigens geleert): schnellstes Teilchen und grösste Blase (f32-Bits), gebremste Teilchen (u32), abgelassener Dampf (f32) */
  VMAXP: 60, RMAXB: 61, SLOWED: 62, VENTED: 63,
  /* M2a/M2b bis zur nächsten Ablesung (eigens geleert): entwichene andere Flüssigkeiten, entwichenes Salz, Energie mit ihnen (f32) */
  ESC_OTHER: 65, ESC_SALT: 66,
  /* M2b: auskristallisiertes Salz bis zur nächsten Ablesung (f32; mit ESC_OTHER und ESC_SALT geleert) */
  CRYST: 67,
  /* Ende der Zwischensummen */
  /* Kennzahlen auf Anfrage (Partialsummen stehen in `meas`) */
  TMAX: 64,
  /* Arbeitsplätze der Einblendungen */
  OV_PMAX: 68, OV_VMAX: 69, OV_VGAS: 70, OV_VLIQ: 71, ARROWS: 72,
  /* Bis zur nächsten Ablesung (eigens geleert): Gas, das flüssige Zellen abgaben (f32, kg), wie oft (u32), wie oft ohne Ziel (u32,
     es blieb liegen), flüssige Zellen, deren Verdunsten auf ihr Wasser gekürzt wurde (u32) */
  REL_MASS: 73, REL_N: 74, REL_MISS: 75, EVAP_CAP: 76
} as const;
export const CNT_SIZE = 96;
export const INTERVAL_FIRST = 16;
export const INTERVAL_END = 57;

/** reg: je Gebiet REG_STRIDE f32. */
export const R = {
  OPEN: 0, VFLUID: 1, P0: 2, RHOBAR: 3, VLIQ: 4, VBUB: 5, VGAS: 6, NSUM: 7, MSUM: 8, P0START: 9, DP0: 10,
  KCOMP: 11, TOTAL: 12, WORK: 13
} as const;
export const REG_STRIDE = 16;
/** racc: je Gebiet RACC_STRIDE Summen (f32 über CAS). */
export const RA = { VLIQ: 0, VBUB: 1, NSUM: 2, MSUM: 3, A: 4, B: 5, ACOMP: 6, VSUM: 7 } as const;
export const RACC_STRIDE = 8;

/** heat: je Heizgruppe HEAT_STRIDE f32. */
export const H = { MODE: 0, POWER: 1, TARGET: 2, ON: 3, P: 4, TMEAN: 5, INTEGRAL: 6, CELLS: 7 } as const;
export const HEAT_STRIDE = 8;
/** hacc: je Heizgruppe Summe der Temperaturen (f32) und Zellen (u32). */
export const HA = { TSUM: 0, CELLS: 1 } as const;
export const HACC_STRIDE = 2;

/** cgs: Skalare der CG-Löser (je Löser ein Block von CGS_STRIDE; f32 über CAS). */
export const S = { PQ0: 0, PQ1: 1, RR0: 2, RR1: 3, RZ0: 4, RZ1: 5, RZ2: 6, BB: 7, CURK: 8, ITER: 9, TOLSQ: 10, DONE: 11 } as const;
export const CGS_STRIDE = 16;

/** cf: f32-Zellfelder. */
export const F = {
  PHI: 0, ALPHA: 1, ALPHAOLD: 2, PL: 3, PG: 4, MN: 5, MO: 6, MV: 7, MF: 8, HG: 9,
  ES: 10, FILM: 11, T: 12, TL: 13, CL: 14,
  VGAS: 15, RHO: 16, NMOL: 17, CAP: 18, MU: 19, VEOS: 20, SRCV: 21, VEOSMID: 22,
  PHIS: 23, SDF: 24,
  TSAT: 25, PTL: 26, PCL: 27, ACC: 28, ACCH: 29, SCALE: 30,
  C: 31, CS: 32, CG: 33, TSTAR: 34, K: 35, Q: 36, SHARE: 37,
  MTOT: 38, Y0: 39, RD: 40, HVC: 41, HNC: 42, HOC: 43, BG: 44, BY: 48,
  TS: 52, VAP: 53, VAPH: 54,
  /* M2a: Σ w m aller Flüssigkeiten und die vorherrschende Flüssigkeit der Zelle (Index in LIQUIDS, als f32) */
  ACCALL: 55, HOST: 56,
  /* M2a: die Flüssigkeit mit der meisten Masse unter den Teilchen der Zelle selbst (für die Drift der Tröpfchen) */
  DHOST: 57,
  /* M2b: Σ w s, die Molalität des Wassers und seine Aktivität, die Erhöhung des Siedepunkts (zur Sammlung der Flüssigkeit) */
  ACCS: 58, MOL: 59, AW: 60, DTB: 61,
  /* M2b: Salzkruste der festen Zelle (kg); Salz am Boden der Kiste je Spalte i (an der Stelle i) und seine Enthalpie */
  CRUST: 62, FLOOR: 63, FLOORH: 64,
  /* M2b, Austausch: Salz und Wasser der Wasserteilchen der Zelle selbst, ihre mittlere Temperatur, tauscht sie (1/0); Dichte ihres Wassers (Drift) */
  XS: 65, XW: 66, XT: 67, XON: 68, RHOW: 69
} as const;
export const NF = 70;

/** cu: u32-Zellfelder (Heizgruppe + 1, 0: keine; Gebiet NONE: fest). */
export const U = { KIND: 0, KPREV: 1, SOLID: 2, HGRP: 3, RID: 4, EDGE: 5 } as const;
export const NU = 6;

/** at: atomare Zellfelder (f32 über CAS). */
export const A = {
  VOLSRC: 0, HSRC: 1, FM: 2, FE: 3, BUDGET: 4, DN: 5, DO: 6, DV: 7, DF: 8, DH: 9, ALPHA: 10, DFILM: 11, DES: 12,
  /* Wärme, die eine Wandzelle in diesem Schritt schon an Blasen gab (J; höchstens die kritische Wärmestromdichte) */
  CHF: 13,
  /* M2b: Kristalle auf eine feste Zelle (kg; ihre Enthalpie über DES), auf den Boden der Kiste je Spalte (kg, J) */
  DCRUST: 14, DFLOOR: 15, DFLOORH: 16
} as const;
export const NA = 17;

/** ff: f32-Flächenfelder. */
export const FF = {
  UL: 0, UG: 1, TMP: 2, MAC1: 3, LO: 4, HI: 5, TSCR: 6, FLUX: 7, DV: 12, DN: 13, DO: 14, DH: 15,
  /* M2a: Zähigkeit der Fläche (massengewichtet), die Geschwindigkeit der Übertragung, der Zuwachs aus den Kräften, der zweite Puffer der Jacobi-Schritte */
  ETA: 16, U0: 17, VF: 18, VT: 19
} as const;
export const NFF = 20;

/** fu: u32-Flächenfelder. */
export const FU = { KNOWN: 0, MARK: 1, MARK2: 2, GAS: 3 } as const;
export const NFU = 4;

/** af: atomare Flächenfelder (Kraft der Blasen auf die Flüssigkeit). */
export const AF = { F: 0 } as const;
export const NAF = 1;

/** bacc: je Blase die Summen beim Verschmelzen. */
export const BA = { V: 0, XV: 1, YV: 2, ZV: 3, VXV: 4, VYV: 5, MN: 6, MO: 7, MV: 8, H: 9, AGE: 10, FLAGS: 11 } as const;
export const BACC_STRIDE = 12;

const wgslConsts = (prefix: string, o: Readonly<Record<string, number>>): string =>
  Object.entries(o).map(([k, v]) => `const ${prefix}${k}: u32 = ${v}u;`).join('\n');

/** Alle Plätze als WGSL-Konstanten (G_DT, C_PCOUNT, F_PHI, …). */
export const SLOTS_WGSL = [
  wgslConsts('G_', G), wgslConsts('C_', C), wgslConsts('R_', R), wgslConsts('RA_', RA), wgslConsts('H_', H), wgslConsts('HA_', HA),
  wgslConsts('S_', S), wgslConsts('F_', F), wgslConsts('U_', U), wgslConsts('A_', A), wgslConsts('FF_', FF), wgslConsts('FU_', FU),
  wgslConsts('AF_', AF), wgslConsts('BA_', BA),
  `const RACC_STRIDE: u32 = ${RACC_STRIDE}u;`, `const HEAT_STRIDE: u32 = ${HEAT_STRIDE}u;`, `const HACC_STRIDE: u32 = ${HACC_STRIDE}u;`,
  `const CGS_STRIDE: u32 = ${CGS_STRIDE}u;`, `const BACC_STRIDE: u32 = ${BACC_STRIDE}u;`
].join('\n');
