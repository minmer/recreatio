/**
 * 2026-10-18 — WAS DIE CHEMIA WEISS (Laboratorium chemiczne): Stoffe mit
 * echter molarer Masse und Bildungsenthalpie, Ionen, Gase, Feststoffe —
 * EINE Tabelle, aus der jeder Vorgang seine Wärme bekommt (ΔH = Σ ΔHf der
 * Produkte − Σ ΔHf der Edukte): das Auflösen von NaOH wird heiss, das von
 * NH₄NO₃ kalt, Natrium im Wasser erwärmt es, Säure und Lauge erwärmen sich
 * beim Neutralisieren — und niemand musste das einzeln hinschreiben.
 *
 * Dazu: welche Salze sich lösen und wie weit (Löslichkeit bzw. Ksp — die
 * Temperatur ändert sie nach van 't Hoff mit derselben Enthalpie), die
 * Spannungsreihe der Metalle (E°), schwache Säuren und Basen, Komplexe,
 * Zersetzungen beim Erhitzen, was brennt, Indikatoren, Flammenfarben, die
 * Luft, und was auf dem Regal steht.
 */

export type Phase = 's' | 'l' | 'g' | 'aq';

export interface Species {
  readonly id: string;
  readonly name: string;
  /** Formel zum Zeigen (mit tief- und hochgestellten Zeichen). */
  readonly formula: string;
  /** g/mol */
  readonly M: number;
  readonly phase: Phase;
  /** kJ/mol (in diesem Zustand) — `null`: unbekannt (dann ohne Wärme). */
  readonly dHf: number | null;
  readonly charge?: number;
  /** Dichte (g/cm³) für Feststoffe und Flüssigkeiten. */
  readonly rho?: number;
  /** Farbe als Feststoff (oder Gas) / als Lösung, und wie stark sie färbt (je mol/L). */
  readonly color?: string;
  readonly aqColor?: string;
  readonly tint?: number;
  /** Schmelzpunkt (K) — Natrium schmilzt zur Kugel, Eis zu Wasser, Paraffin am Docht. */
  readonly mp?: number;
  /** Flammenfarbe des Kations. */
  readonly flame?: string;
}

const S = (id: string, name: string, formula: string, M: number, phase: Phase, dHf: number | null, more: Partial<Species> = {}): Species =>
  ({ id, name, formula, M, phase, dHf, ...more });

/** Alle Stoffe (Schlüssel: Kennung). Ionen tragen ihre Ladung in der Kennung (Na+, SO4-2). */
export const SPECIES: Readonly<Record<string, Species>> = Object.fromEntries([
  /* Wasser und die Gase */
  S('H2O', 'woda', 'H₂O', 18.015, 'l', -285.8, { rho: 1 }),
  S('H2O(g)', 'para wodna', 'H₂O', 18.015, 'g', -241.8),
  S('ice', 'lód', 'H₂O', 18.015, 's', -291.8, { rho: 0.917, color: '#dff2fb', mp: 273.15 }),
  S('N2', 'azot', 'N₂', 28.014, 'g', 0),
  S('O2', 'tlen', 'O₂', 31.998, 'g', 0),
  S('Ar', 'argon', 'Ar', 39.95, 'g', 0),
  S('H2', 'wodór', 'H₂', 2.016, 'g', 0),
  S('CO2', 'tlenek węgla(IV)', 'CO₂', 44.01, 'g', -393.5),
  S('NH3', 'amoniak', 'NH₃', 17.031, 'g', -45.9),
  S('HCl(g)', 'chlorowodór', 'HCl', 36.46, 'g', -92.3),
  S('SO2', 'tlenek siarki(IV)', 'SO₂', 64.07, 'g', -296.8),
  S('NO', 'tlenek azotu(II)', 'NO', 30.01, 'g', 90.3),
  S('NO2', 'tlenek azotu(IV)', 'NO₂', 46.01, 'g', 33.2, { color: '#a5491f' }),
  S('N2O4', 'tetratlenek diazotu', 'N₂O₄', 92.01, 'g', 9.16),
  S('CH4', 'metan (gaz z palnika)', 'CH₄', 16.04, 'g', -74.6),
  S('EtOH(g)', 'etanol (para)', 'C₂H₅OH', 46.07, 'g', -234.8),

  /* Metalle */
  S('Li', 'lit', 'Li', 6.94, 's', 0, { rho: 0.534, color: '#c9c9c9', mp: 453.7 }),
  S('Na', 'sód', 'Na', 22.99, 's', 0, { rho: 0.968, color: '#d8d8d2', mp: 371 }),
  S('K', 'potas', 'K', 39.098, 's', 0, { rho: 0.862, color: '#cfd0c8', mp: 336.5 }),
  S('Ca', 'wapń', 'Ca', 40.078, 's', 0, { rho: 1.55, color: '#bdbdb4' }),
  S('Mg', 'magnez', 'Mg', 24.305, 's', 0, { rho: 1.74, color: '#c8ccd0' }),
  S('Al', 'glin', 'Al', 26.982, 's', 0, { rho: 2.7, color: '#d0d4d8' }),
  S('Zn', 'cynk', 'Zn', 65.38, 's', 0, { rho: 7.14, color: '#a9b0b5' }),
  S('Fe', 'żelazo', 'Fe', 55.845, 's', 0, { rho: 7.87, color: '#7d7f82' }),
  S('Pb', 'ołów', 'Pb', 207.2, 's', 0, { rho: 11.34, color: '#6f7479' }),
  S('Cu', 'miedź', 'Cu', 63.546, 's', 0, { rho: 8.96, color: '#c26a3d' }),
  S('Ag', 'srebro', 'Ag', 107.87, 's', 0, { rho: 10.49, color: '#e3e4e6' }),
  S('Sn', 'cyna', 'Sn', 118.71, 's', 0, { rho: 7.31, color: '#c9ccd0', mp: 505.1 }),
  S('Field', 'stop Fielda (Bi, In, Sn)', 'Bi–In–Sn', 150, 's', 0, { rho: 7.88, color: '#c3c6cc', mp: 335 }),
  S('wood', 'drewno', '(C₆H₁₀O₅)ₙ', 162.1, 's', -960, { rho: 0.6, color: '#c8955a' }),

  /* Kationen */
  S('H+', 'kation wodoru', 'H⁺', 1.008, 'aq', 0, { charge: 1 }),
  S('Li+', 'kation litu', 'Li⁺', 6.94, 'aq', -278.5, { charge: 1, flame: '#e0102a' }),
  S('Na+', 'kation sodu', 'Na⁺', 22.99, 'aq', -240.1, { charge: 1, flame: '#ffb000' }),
  S('K+', 'kation potasu', 'K⁺', 39.098, 'aq', -252.4, { charge: 1, flame: '#b07cf0' }),
  S('NH4+', 'kation amonu', 'NH₄⁺', 18.04, 'aq', -132.5, { charge: 1 }),
  S('Ag+', 'kation srebra', 'Ag⁺', 107.87, 'aq', 105.6, { charge: 1 }),
  S('Mg+2', 'kation magnezu', 'Mg²⁺', 24.305, 'aq', -466.9, { charge: 2 }),
  S('Ca+2', 'kation wapnia', 'Ca²⁺', 40.078, 'aq', -542.8, { charge: 2, flame: '#ff5a1f' }),
  S('Ba+2', 'kation baru', 'Ba²⁺', 137.33, 'aq', -537.6, { charge: 2, flame: '#a8e04a' }),
  S('Sr+2', 'kation strontu', 'Sr²⁺', 87.62, 'aq', -545.8, { charge: 2, flame: '#ff1a1a' }),
  S('Zn+2', 'kation cynku', 'Zn²⁺', 65.38, 'aq', -153.9, { charge: 2 }),
  S('Fe+2', 'kation żelaza(II)', 'Fe²⁺', 55.845, 'aq', -89.1, { charge: 2, aqColor: '#9fc46a', tint: 1.2 }),
  S('Fe+3', 'kation żelaza(III)', 'Fe³⁺', 55.845, 'aq', -48.5, { charge: 3, aqColor: '#d08a1e', tint: 14 }),
  S('Cu+2', 'kation miedzi(II)', 'Cu²⁺', 63.546, 'aq', 64.8, { charge: 2, aqColor: '#2f86d6', tint: 6, flame: '#2fd0a0' }),
  S('Pb+2', 'kation ołowiu(II)', 'Pb²⁺', 207.2, 'aq', -1.7, { charge: 2 }),
  S('Al+3', 'kation glinu', 'Al³⁺', 26.982, 'aq', -531, { charge: 3 }),
  S('Mn+2', 'kation manganu(II)', 'Mn²⁺', 54.938, 'aq', -220.8, { charge: 2, aqColor: '#f2c6d6', tint: 0.4 }),
  S('Sn+2', 'kation cyny(II)', 'Sn²⁺', 118.71, 'aq', -8.8, { charge: 2 }),

  /* Anionen */
  S('OH-', 'anion wodorotlenkowy', 'OH⁻', 17.007, 'aq', -230, { charge: -1 }),
  S('Cl-', 'anion chlorkowy', 'Cl⁻', 35.45, 'aq', -167.2, { charge: -1 }),
  S('Br-', 'anion bromkowy', 'Br⁻', 79.904, 'aq', -121.6, { charge: -1 }),
  S('I-', 'anion jodkowy', 'I⁻', 126.9, 'aq', -55.2, { charge: -1 }),
  S('NO3-', 'anion azotanowy(V)', 'NO₃⁻', 62.004, 'aq', -205, { charge: -1 }),
  S('SO4-2', 'anion siarczanowy(VI)', 'SO₄²⁻', 96.06, 'aq', -909.3, { charge: -2 }),
  S('SCN-', 'anion tiocyjanianowy', 'SCN⁻', 58.08, 'aq', 76.4, { charge: -1 }),
  S('MnO4-', 'anion manganianowy(VII)', 'MnO₄⁻', 118.94, 'aq', -541.4, { charge: -1, aqColor: '#7a1fa2', tint: 600 }),
  S('CrO4-2', 'anion chromianowy(VI)', 'CrO₄²⁻', 115.99, 'aq', -881.2, { charge: -2, aqColor: '#e6c619', tint: 40 }),
  S('Cr2O7-2', 'anion dichromianowy(VI)', 'Cr₂O₇²⁻', 215.99, 'aq', -1490.3, { charge: -2, aqColor: '#ee7414', tint: 45 }),
  S('S2O3-2', 'anion tiosiarczanowy', 'S₂O₃²⁻', 112.13, 'aq', -652.3, { charge: -2 }),

  /* Die Formen der schwachen Säuren und Basen (siehe POOLS) */
  S('CO2(aq)', 'CO₂ rozpuszczony', 'CO₂', 44.01, 'aq', -413.8),
  S('HCO3-', 'anion wodorowęglanowy', 'HCO₃⁻', 61.016, 'aq', -692, { charge: -1 }),
  S('CO3-2', 'anion węglanowy', 'CO₃²⁻', 60.008, 'aq', -677.1, { charge: -2 }),
  S('CH3COOH', 'kwas octowy', 'CH₃COOH', 60.05, 'aq', -485.8),
  S('CH3COO-', 'anion octanowy', 'CH₃COO⁻', 59.044, 'aq', -486, { charge: -1 }),
  S('NH3(aq)', 'amoniak rozpuszczony', 'NH₃', 17.031, 'aq', -80.3),
  S('SO2(aq)', 'SO₂ rozpuszczony', 'SO₂', 64.07, 'aq', -323),
  S('HSO3-', 'anion wodorosiarczanowy(IV)', 'HSO₃⁻', 81.07, 'aq', -626.2, { charge: -1 }),
  S('SO3-2', 'anion siarczanowy(IV)', 'SO₃²⁻', 80.06, 'aq', -635.5, { charge: -2 }),

  /* Komplexe */
  S('Cu(NH3)4+2', 'kation tetraaminamiedzi(II)', '[Cu(NH₃)₄]²⁺', 131.7, 'aq', -348.5, { charge: 2, aqColor: '#1d3fbf', tint: 55 }),
  S('Ag(NH3)2+', 'kation diaminasrebra(I)', '[Ag(NH₃)₂]⁺', 141.9, 'aq', -111.3, { charge: 1 }),
  S('Zn(OH)4-2', 'anion tetrahydroksocynkanowy', '[Zn(OH)₄]²⁻', 133.4, 'aq', null, { charge: -2 }),
  S('Al(OH)4-', 'anion tetrahydroksoglinianowy', '[Al(OH)₄]⁻', 95.0, 'aq', null, { charge: -1 }),
  S('FeSCN+2', 'kation tiocyjanianożelaza(III)', '[FeSCN]²⁺', 113.9, 'aq', null, { charge: 2, aqColor: '#a8141c', tint: 2500 }),
  S('CuOH+', 'kation hydroksomiedzi(II)', 'CuOH⁺', 80.55, 'aq', null, { charge: 1 }),
  S('FeOH+2', 'kation hydroksożelaza(III)', 'FeOH²⁺', 72.85, 'aq', null, { charge: 2 }),
  S('AlOH+2', 'kation hydroksoglinu', 'AlOH²⁺', 43.99, 'aq', null, { charge: 2 }),
  S('ZnOH+', 'kation hydroksocynku', 'ZnOH⁺', 82.39, 'aq', null, { charge: 1 }),
  S('PbOH+', 'kation hydroksoołowiu(II)', 'PbOH⁺', 224.2, 'aq', null, { charge: 1 }),

  /* Gelöste Moleküle */
  S('H2O2', 'nadtlenek wodoru', 'H₂O₂', 34.015, 'aq', -191.2),
  S('sugar', 'sacharoza', 'C₁₂H₂₂O₁₁', 342.3, 'aq', -2220.7),
  S('soap', 'detergent', 'detergent', 300, 'aq', null),
  S('ethanol', 'etanol', 'C₂H₅OH', 46.07, 'aq', -288.3),

  /* Salze und andere Feststoffe */
  S('NaCl', 'chlorek sodu', 'NaCl', 58.44, 's', -411.2, { rho: 2.16, color: '#f7f7f4' }),
  S('KCl', 'chlorek potasu', 'KCl', 74.55, 's', -436.7, { rho: 1.98, color: '#f7f7f4' }),
  S('LiCl', 'chlorek litu', 'LiCl', 42.39, 's', -408.6, { rho: 2.07, color: '#f7f7f4' }),
  S('KNO3', 'azotan(V) potasu', 'KNO₃', 101.1, 's', -494.6, { rho: 2.11, color: '#f7f7f4' }),
  S('NaNO3', 'azotan(V) sodu', 'NaNO₃', 84.99, 's', -467.9, { rho: 2.26, color: '#f7f7f4' }),
  S('NH4Cl', 'chlorek amonu', 'NH₄Cl', 53.49, 's', -314.4, { rho: 1.53, color: '#f7f7f4' }),
  S('NH4NO3', 'azotan(V) amonu', 'NH₄NO₃', 80.04, 's', -365.6, { rho: 1.72, color: '#f7f7f4' }),
  S('NaOH', 'wodorotlenek sodu', 'NaOH', 40.0, 's', -425.6, { rho: 2.13, color: '#f4f4f0' }),
  S('KOH', 'wodorotlenek potasu', 'KOH', 56.11, 's', -424.6, { rho: 2.04, color: '#f4f4f0' }),
  S('CaCl2', 'chlorek wapnia', 'CaCl₂', 110.98, 's', -795.4, { rho: 2.15, color: '#f4f4f0' }),
  S('CuSO4', 'siarczan(VI) miedzi(II) bezwodny', 'CuSO₄', 159.6, 's', -771.4, { rho: 3.6, color: '#e9ecec' }),
  S('CuSO4·5H2O', 'siarczan(VI) miedzi(II)—woda (1/5)', 'CuSO₄·5H₂O', 249.7, 's', -2279.7, { rho: 2.29, color: '#2f7fd6' }),
  S('ZnSO4', 'siarczan(VI) cynku', 'ZnSO₄', 161.47, 's', -982.8, { rho: 3.54, color: '#f4f4f0' }),
  S('FeSO4·7H2O', 'siarczan(VI) żelaza(II)—woda (1/7)', 'FeSO₄·7H₂O', 278.01, 's', -3014.6, { rho: 1.9, color: '#a6d08a' }),
  S('AgNO3', 'azotan(V) srebra', 'AgNO₃', 169.87, 's', -124.4, { rho: 4.35, color: '#f4f4f0' }),
  S('Pb(NO3)2', 'azotan(V) ołowiu(II)', 'Pb(NO₃)₂', 331.2, 's', -451.9, { rho: 4.53, color: '#f4f4f0' }),
  S('KI', 'jodek potasu', 'KI', 166.0, 's', -327.9, { rho: 3.12, color: '#f4f4f0' }),
  S('KSCN', 'tiocyjanian potasu', 'KSCN', 97.18, 's', -200.2, { rho: 1.89, color: '#f4f4f0' }),
  S('BaCl2', 'chlorek baru', 'BaCl₂', 208.2, 's', -858.6, { rho: 3.86, color: '#f4f4f0' }),
  S('SrCl2', 'chlorek strontu', 'SrCl₂', 158.53, 's', -828.9, { rho: 3.05, color: '#f7f7f4' }),
  S('Na2CO3', 'węglan sodu', 'Na₂CO₃', 105.99, 's', -1130.7, { rho: 2.54, color: '#f7f7f4' }),
  S('NaHCO3', 'wodorowęglan sodu', 'NaHCO₃', 84.01, 's', -950.8, { rho: 2.2, color: '#f7f7f4' }),
  S('Na2SO4', 'siarczan(VI) sodu', 'Na₂SO₄', 142.04, 's', -1387.1, { rho: 2.66, color: '#f7f7f4' }),
  S('K2SO4', 'siarczan(VI) potasu', 'K₂SO₄', 174.26, 's', -1437.8, { rho: 2.66, color: '#f7f7f4' }),
  S('MgSO4', 'siarczan(VI) magnezu', 'MgSO₄', 120.37, 's', -1284.9, { rho: 2.66, color: '#f7f7f4' }),
  S('CH3COONa', 'octan sodu', 'CH₃COONa', 82.03, 's', -708.8, { rho: 1.53, color: '#f7f7f4' }),
  S('K2CrO4', 'chromian(VI) potasu', 'K₂CrO₄', 194.19, 's', -1403.7, { rho: 2.73, color: '#e6c619' }),
  S('KMnO4', 'manganian(VII) potasu', 'KMnO₄', 158.03, 's', -837.2, { rho: 2.7, color: '#4a1452' }),
  S('K2Cr2O7', 'dichromian(VI) potasu', 'K₂Cr₂O₇', 294.18, 's', -2061.5, { rho: 2.68, color: '#e8641b' }),
  S('Na2S2O3', 'tiosiarczan sodu', 'Na₂S₂O₃', 158.11, 's', -1123, { rho: 1.67, color: '#f4f4ef' }),
  S('FeCl3', 'chlorek żelaza(III)', 'FeCl₃', 162.2, 's', -399.5, { rho: 2.9, color: '#6b3b14' }),
  S('CaCO3', 'węglan wapnia', 'CaCO₃', 100.09, 's', -1207.6, { rho: 2.71, color: '#f2f0ea' }),
  S('BaCO3', 'węglan baru', 'BaCO₃', 197.34, 's', -1216.3, { rho: 4.29, color: '#f4f4f0' }),
  S('CuCO3', 'węglan miedzi(II)', 'CuCO₃', 123.55, 's', -595, { rho: 4, color: '#3fa08a' }),
  S('MgCO3', 'węglan magnezu', 'MgCO₃', 84.31, 's', -1095.8, { rho: 2.96, color: '#f4f4f0' }),
  S('ZnCO3', 'węglan cynku', 'ZnCO₃', 125.4, 's', -812.8, { rho: 4.4, color: '#f4f4f0' }),
  S('AgCl', 'chlorek srebra', 'AgCl', 143.32, 's', -127, { rho: 5.56, color: '#f6f6f2' }),
  S('AgBr', 'bromek srebra', 'AgBr', 187.77, 's', -100.4, { rho: 6.47, color: '#f1e9c2' }),
  S('AgI', 'jodek srebra', 'AgI', 234.77, 's', -61.8, { rho: 5.68, color: '#efe08a' }),
  S('Ag2O', 'tlenek srebra', 'Ag₂O', 231.74, 's', -31.1, { rho: 7.14, color: '#5a4030' }),
  S('Ag2CO3', 'węglan srebra', 'Ag₂CO₃', 275.75, 's', -505.8, { rho: 6.08, color: '#ece4b8' }),
  S('Ag2CrO4', 'chromian(VI) srebra', 'Ag₂CrO₄', 331.73, 's', -731.7, { rho: 5.6, color: '#a2321f' }),
  S('BaSO4', 'siarczan(VI) baru', 'BaSO₄', 233.39, 's', -1473.2, { rho: 4.5, color: '#f8f8f6' }),
  S('CaSO4', 'siarczan(VI) wapnia', 'CaSO₄', 136.14, 's', -1434.5, { rho: 2.96, color: '#f6f6f2' }),
  S('PbI2', 'jodek ołowiu(II)', 'PbI₂', 461.0, 's', -175.5, { rho: 6.16, color: '#f2c318' }),
  S('PbCl2', 'chlorek ołowiu(II)', 'PbCl₂', 278.1, 's', -359.4, { rho: 5.85, color: '#f6f6f2' }),
  S('PbSO4', 'siarczan(VI) ołowiu(II)', 'PbSO₄', 303.26, 's', -920, { rho: 6.29, color: '#f6f6f2' }),
  S('Ca(OH)2', 'wodorotlenek wapnia', 'Ca(OH)₂', 74.09, 's', -985.2, { rho: 2.21, color: '#f6f6f2' }),
  S('Mg(OH)2', 'wodorotlenek magnezu', 'Mg(OH)₂', 58.32, 's', -924.5, { rho: 2.34, color: '#f6f6f2' }),
  S('Cu(OH)2', 'wodorotlenek miedzi(II)', 'Cu(OH)₂', 97.56, 's', -449.8, { rho: 3.37, color: '#4f9fe0' }),
  S('Fe(OH)2', 'wodorotlenek żelaza(II)', 'Fe(OH)₂', 89.86, 's', -569, { rho: 3.4, color: '#7f9d5a' }),
  S('Fe(OH)3', 'wodorotlenek żelaza(III)', 'Fe(OH)₃', 106.87, 's', -823, { rho: 3.12, color: '#9a4a16' }),
  S('Al(OH)3', 'wodorotlenek glinu', 'Al(OH)₃', 78.0, 's', -1277, { rho: 2.42, color: '#f2f2ee' }),
  S('Zn(OH)2', 'wodorotlenek cynku', 'Zn(OH)₂', 99.4, 's', -642, { rho: 3.05, color: '#f2f2ee' }),
  S('MgO', 'tlenek magnezu', 'MgO', 40.3, 's', -601.6, { rho: 3.58, color: '#fbfbf8' }),
  S('CaO', 'tlenek wapnia (wapno palone)', 'CaO', 56.08, 's', -635.1, { rho: 3.34, color: '#f6f6f0' }),
  S('CuO', 'tlenek miedzi(II)', 'CuO', 79.55, 's', -157.3, { rho: 6.31, color: '#232222' }),
  S('MnO2', 'tlenek manganu(IV)', 'MnO₂', 86.94, 's', -520, { rho: 5.03, color: '#2b2626' }),
  S('K2MnO4', 'manganian(VI) potasu', 'K₂MnO₄', 197.13, 's', -1180, { rho: 2.8, color: '#1f4a2a' }),
  S('Fe3O4', 'tlenek żelaza(II, III)', 'Fe₃O₄', 231.53, 's', -1118.4, { rho: 5.17, color: '#2d2a28' }),
  S('S', 'siarka', 'S', 32.06, 's', 0, { rho: 2.07, color: '#f2d62a', mp: 388 }),
  S('C', 'węgiel drzewny', 'C', 12.011, 's', 0, { rho: 0.4, color: '#2a2725' }),
  S('wax', 'parafina (świeca)', 'C₂₅H₅₂', 352.7, 's', -900, { rho: 0.9, color: '#f4efe0', mp: 330 }),
  S('sugar(s)', 'cukier', 'C₁₂H₂₂O₁₁', 342.3, 's', -2226, { rho: 1.59, color: '#fbfbf8' }),
  S('potato', 'ziemniak (katalaza)', '—', 1000, 's', null, { rho: 1.08, color: '#e9d39a' })
].map((s) => [s.id, s]));

export const species = (id: string): Species | undefined => SPECIES[id];

/** Die Gase, die ein Gefäss enthalten kann (in dieser Reihenfolge gezeigt). */
export const GASES = ['N2', 'O2', 'Ar', 'CO2', 'H2O(g)', 'H2', 'NH3', 'HCl(g)', 'SO2', 'NO', 'NO2', 'N2O4', 'CH4', 'EtOH(g)'] as const;
export type GasId = (typeof GASES)[number];

/** Farben der Gase für die Lupe und die Anteile. */
export const GAS_COLORS: Readonly<Record<GasId, string>> = {
  N2: '#5b7bd5', O2: '#d64a4a', Ar: '#9a9a9a', CO2: '#3b3b3b', 'H2O(g)': '#7fc8f0', H2: '#e8e8e8',
  NH3: '#8a5ad0', 'HCl(g)': '#4fae5f', SO2: '#d8b020', NO: '#c08060', NO2: '#a5491f', N2O4: '#d9c9b0', CH4: '#7fa7a0', 'EtOH(g)': '#c79bd8'
};

/** Die Luft im Labor (Molanteile, mit etwas Feuchte). */
export const AIR: Readonly<Partial<Record<GasId, number>>> = { N2: 0.7714, O2: 0.207, Ar: 0.0092, CO2: 0.0004, 'H2O(g)': 0.012 };

/* -- Schwache Säuren und Basen: Vorräte ------------------------------------------------------- */

/**
 * EIN VORRAT (Kohlensäure, Essigsäure, Ammoniak, schweflige Säure): gezählt
 * wird nur die Summe; wie viel davon CO₂, HCO₃⁻ oder CO₃²⁻ ist, sagt der pH
 * (`chemPh.ts`). Die Formen von der protonreichsten an, mit Ladung und dem
 * Wasser, das ihre Bildung aus der ersten Form braucht (CO₂ + H₂O → HCO₃⁻ + H⁺).
 */
export interface Pool {
  readonly id: 'C' | 'Ac' | 'N' | 'S';
  readonly name: string;
  readonly forms: readonly string[];
  readonly charges: readonly number[];
  readonly water: readonly number[];
  /** pKa der Stufen bei 25 °C (die Temperatur folgt aus den Enthalpien). */
  readonly pKa: readonly number[];
  /** Die neutrale Form, die als Gas entweichen kann (und ihr Gas). */
  readonly neutral: number;
  readonly gas: GasId | null;
}

export const POOLS: readonly Pool[] = [
  { id: 'C', name: 'węglany', forms: ['CO2(aq)', 'HCO3-', 'CO3-2'], charges: [0, -1, -2], water: [0, 1, 1], pKa: [6.35, 10.33], neutral: 0, gas: 'CO2' },
  { id: 'Ac', name: 'octany', forms: ['CH3COOH', 'CH3COO-'], charges: [0, -1], water: [0, 0], pKa: [4.76], neutral: 0, gas: null },
  { id: 'N', name: 'amoniak', forms: ['NH4+', 'NH3(aq)'], charges: [1, 0], water: [0, 0], pKa: [9.25], neutral: 1, gas: 'NH3' },
  { id: 'S', name: 'siarczany(IV)', forms: ['SO2(aq)', 'HSO3-', 'SO3-2'], charges: [0, -1, -2], water: [0, 1, 1], pKa: [1.86, 7.2], neutral: 0, gas: 'SO2' }
];
export type PoolId = Pool['id'];
export const poolOf = (id: string): Pool | undefined => POOLS.find((p) => p.id === id);

/** Zu welchem Vorrat (und welcher Form) ein Ion gehört — NH₄⁺ zum Ammoniak, CO₃²⁻ zu den Carbonaten. */
export const POOL_MEMBER: Readonly<Record<string, readonly [PoolId, number]>> = Object.fromEntries(
  POOLS.flatMap((p) => p.forms.map((f, i) => [f, [p.id, i] as const]))
);

/** Löslichkeit der Gase in Wasser (mol/(L·atm) bei 25 °C) — wohin sie gehen. */
export const HENRY: Readonly<Partial<Record<GasId, { readonly k: number; readonly into: PoolId | 'strong' }>>> = {
  CO2: { k: 0.034, into: 'C' },
  NH3: { k: 58, into: 'N' },
  SO2: { k: 1.3, into: 'S' },
  'HCl(g)': { k: 1e6, into: 'strong' },
  NO2: { k: 50, into: 'strong' }
};

/* -- Komplexe -------------------------------------------------------------------------------- */

export interface Complex {
  readonly id: string;
  readonly metal: string;
  readonly ligand: 'NH3' | 'OH-' | 'SCN-';
  readonly n: number;
  readonly logB: number;
}

/**
 * Komplexe: Bildung aus dem freien Metallion und dem Liganden (β = [MLₙ]/([M][L]ⁿ), 25 °C). Die Hydroxo-Komplexe mit n = 1
 * sind die Hydrolyse der Metallionen (Cu²⁺ + H₂O ⇄ CuOH⁺ + H⁺, pKa = 14 − logβ): darum ist eine Lösung von CuSO₄ sauer
 * (pH ≈ 4), FeCl₃ noch saurer (pH ≈ 2) — und darum fällt aus ihr nicht schon Cu(OH)₂ aus.
 */
export const COMPLEXES: readonly Complex[] = [
  { id: 'Cu(NH3)4+2', metal: 'Cu+2', ligand: 'NH3', n: 4, logB: 13.0 },
  { id: 'CuOH+', metal: 'Cu+2', ligand: 'OH-', n: 1, logB: 6.3 },
  { id: 'Ag(NH3)2+', metal: 'Ag+', ligand: 'NH3', n: 2, logB: 7.2 },
  { id: 'ZnOH+', metal: 'Zn+2', ligand: 'OH-', n: 1, logB: 5.0 },
  { id: 'Zn(OH)4-2', metal: 'Zn+2', ligand: 'OH-', n: 4, logB: 16.4 },
  { id: 'AlOH+2', metal: 'Al+3', ligand: 'OH-', n: 1, logB: 9.0 },
  { id: 'Al(OH)4-', metal: 'Al+3', ligand: 'OH-', n: 4, logB: 33 },
  { id: 'FeSCN+2', metal: 'Fe+3', ligand: 'SCN-', n: 1, logB: 2.1 },
  { id: 'FeOH+2', metal: 'Fe+3', ligand: 'OH-', n: 1, logB: 11.8 },
  { id: 'PbOH+', metal: 'Pb+2', ligand: 'OH-', n: 1, logB: 6.3 }
];

/* -- Salze: wie sie sich lösen (und ausfallen) ------------------------------------------------ */

export interface Salt {
  /** Der Feststoff (sein Kristall). */
  readonly solid: string;
  readonly cation: string;
  readonly nc: number;
  readonly anion: string;
  readonly na: number;
  /** Wasser, das beim Lösen frei wird (Kristallwasser; je OH⁻, CO₃²⁻, HCO₃⁻ eines; bei Oxiden weniger). */
  readonly w: number;
  /** Löslichkeit bei 20 °C in g je 100 g Wasser (des wasserfreien Salzes) — oder `ksp` (25 °C) bei schwer löslichen. */
  readonly sol?: number;
  readonly ksp?: number;
  /** Ksp und Wärme wie bei diesem Salz (ein Oxid wie sein Hydroxid). */
  readonly like?: string;
}

const salt = (solid: string, cation: string, nc: number, anion: string, na: number, more: Partial<Salt>): Salt => {
  const basic = anion === 'OH-' || anion === 'CO3-2' || anion === 'HCO3-';
  return { solid, cation, nc, anion, na, w: basic ? na : 0, ...more };
};

/**
 * DIE SALZE: lösen sie sich, sind sie schwer löslich? EINE Regel für alle
 * (`chemSalts.ts`): ist das Ionenprodukt Q grösser als Ksp, fällt aus;
 * kleiner — und der Feststoff liegt da —, löst er sich. So fällt AgCl aus,
 * wenn man AgNO₃ zu NaCl giesst, und NaNO₃ bleibt gelöst; KNO₃ kristallisiert
 * beim Abkühlen; Kalkwasser wird milchig von CO₂ und wieder klar von zu viel.
 */
export const SALTS: readonly Salt[] = [
  salt('NaCl', 'Na+', 1, 'Cl-', 1, { sol: 36.0 }),
  salt('KCl', 'K+', 1, 'Cl-', 1, { sol: 34.0 }),
  salt('LiCl', 'Li+', 1, 'Cl-', 1, { sol: 83 }),
  salt('KNO3', 'K+', 1, 'NO3-', 1, { sol: 31.6 }),
  salt('NaNO3', 'Na+', 1, 'NO3-', 1, { sol: 88 }),
  salt('NH4Cl', 'NH4+', 1, 'Cl-', 1, { sol: 37.2 }),
  salt('NH4NO3', 'NH4+', 1, 'NO3-', 1, { sol: 192 }),
  salt('NaOH', 'Na+', 1, 'OH-', 1, { sol: 109 }),
  salt('KOH', 'K+', 1, 'OH-', 1, { sol: 112 }),
  salt('CaCl2', 'Ca+2', 1, 'Cl-', 2, { sol: 74.5 }),
  salt('CuSO4·5H2O', 'Cu+2', 1, 'SO4-2', 1, { w: 5, sol: 20.7 }),
  salt('ZnSO4', 'Zn+2', 1, 'SO4-2', 1, { sol: 57.7 }),
  salt('FeSO4·7H2O', 'Fe+2', 1, 'SO4-2', 1, { w: 7, sol: 26.6 }),
  salt('AgNO3', 'Ag+', 1, 'NO3-', 1, { sol: 222 }),
  salt('Pb(NO3)2', 'Pb+2', 1, 'NO3-', 2, { sol: 54.3 }),
  salt('KI', 'K+', 1, 'I-', 1, { sol: 144 }),
  salt('KSCN', 'K+', 1, 'SCN-', 1, { sol: 217 }),
  salt('BaCl2', 'Ba+2', 1, 'Cl-', 2, { sol: 35.8 }),
  salt('SrCl2', 'Sr+2', 1, 'Cl-', 2, { sol: 53.8 }),
  salt('Na2CO3', 'Na+', 2, 'CO3-2', 1, { sol: 21.5 }),
  salt('NaHCO3', 'Na+', 1, 'HCO3-', 1, { sol: 9.6 }),
  salt('Na2SO4', 'Na+', 2, 'SO4-2', 1, { sol: 19.5 }),
  salt('K2SO4', 'K+', 2, 'SO4-2', 1, { sol: 11.1 }),
  salt('MgSO4', 'Mg+2', 1, 'SO4-2', 1, { sol: 33.7 }),
  salt('CH3COONa', 'Na+', 1, 'CH3COO-', 1, { sol: 46.4 }),
  salt('K2CrO4', 'K+', 2, 'CrO4-2', 1, { sol: 63.7 }),
  salt('KMnO4', 'K+', 1, 'MnO4-', 1, { sol: 6.4 }),
  salt('K2Cr2O7', 'K+', 2, 'Cr2O7-2', 1, { sol: 12.3 }),
  salt('Na2S2O3', 'Na+', 2, 'S2O3-2', 1, { sol: 70 }),
  salt('FeCl3', 'Fe+3', 1, 'Cl-', 3, { sol: 91.8 }),
  salt('Ca(OH)2', 'Ca+2', 1, 'OH-', 2, { sol: 0.173 }),
  salt('CaSO4', 'Ca+2', 1, 'SO4-2', 1, { sol: 0.24 }),
  /* schwer löslich */
  salt('AgCl', 'Ag+', 1, 'Cl-', 1, { ksp: 1.8e-10 }),
  salt('AgBr', 'Ag+', 1, 'Br-', 1, { ksp: 5.0e-13 }),
  salt('AgI', 'Ag+', 1, 'I-', 1, { ksp: 8.3e-17 }),
  salt('Ag2O', 'Ag+', 2, 'OH-', 2, { w: 1, ksp: 3.8e-16 }),
  salt('Ag2CrO4', 'Ag+', 2, 'CrO4-2', 1, { ksp: 1.1e-12 }),
  salt('Ag2CO3', 'Ag+', 2, 'CO3-2', 1, { ksp: 8.5e-12 }),
  salt('BaSO4', 'Ba+2', 1, 'SO4-2', 1, { ksp: 1.1e-10 }),
  salt('CaCO3', 'Ca+2', 1, 'CO3-2', 1, { ksp: 3.4e-9 }),
  salt('BaCO3', 'Ba+2', 1, 'CO3-2', 1, { ksp: 2.6e-9 }),
  salt('CuCO3', 'Cu+2', 1, 'CO3-2', 1, { ksp: 1.4e-10 }),
  salt('MgCO3', 'Mg+2', 1, 'CO3-2', 1, { ksp: 6.8e-6 }),
  salt('ZnCO3', 'Zn+2', 1, 'CO3-2', 1, { ksp: 1.5e-10 }),
  salt('PbI2', 'Pb+2', 1, 'I-', 2, { ksp: 9.8e-9 }),
  salt('PbCl2', 'Pb+2', 1, 'Cl-', 2, { ksp: 1.7e-5 }),
  salt('PbSO4', 'Pb+2', 1, 'SO4-2', 1, { ksp: 2.5e-8 }),
  salt('Mg(OH)2', 'Mg+2', 1, 'OH-', 2, { ksp: 5.6e-12 }),
  salt('Cu(OH)2', 'Cu+2', 1, 'OH-', 2, { ksp: 2.2e-20 }),
  salt('Fe(OH)2', 'Fe+2', 1, 'OH-', 2, { ksp: 4.9e-17 }),
  salt('Fe(OH)3', 'Fe+3', 1, 'OH-', 3, { ksp: 2.8e-39 }),
  salt('Al(OH)3', 'Al+3', 1, 'OH-', 3, { ksp: 3e-34 }),
  salt('Zn(OH)2', 'Zn+2', 1, 'OH-', 2, { ksp: 3e-17 }),
  /* Oxide, die sich nur in Säure lösen (wie ihr Hydroxid, mit einem Wasser weniger) */
  salt('CuO', 'Cu+2', 1, 'OH-', 2, { w: 1, like: 'Cu(OH)2' })
];
export const saltOf = (solid: string): Salt | undefined => SALTS.find((s) => s.solid === solid);

/** Feststoffe, die mit Wasser zu einem anderen Feststoff werden (Löschen von Kalk, blauer Vitriol). */
export const HYDRATION: readonly { readonly from: string; readonly to: string; readonly water: number; readonly k: number; readonly eq: string }[] = [
  { from: 'CaO', to: 'Ca(OH)2', water: 1, k: 6e-5, eq: 'CaO + H₂O → Ca(OH)₂' },
  { from: 'MgO', to: 'Mg(OH)2', water: 1, k: 1.5e-6, eq: 'MgO + H₂O → Mg(OH)₂' },
  { from: 'CuSO4', to: 'CuSO4·5H2O', water: 5, k: 2e-4, eq: 'CuSO₄ + 5H₂O → CuSO₄·5H₂O' }
];

/* -- Metalle: die Spannungsreihe ----------------------------------------------------------------- */

export interface Metal {
  readonly id: string;
  /** Normalpotential (V) von M^n+/M. */
  readonly E: number;
  readonly n: number;
  readonly ion: string;
  /** Geschwindigkeit mit Wasser, mit Säure (je mol/L H⁺) und mit Lauge (je mol/L OH⁻) — mol/(s·cm²) bei 25 °C. */
  readonly kw: number;
  readonly ka: number;
  readonly kb?: number;
  /** Aktivierungsenergie mit Wasser (kJ/mol): Magnesium reagiert erst mit heissem Wasser. */
  readonly Ew?: number;
  /** Eine Oxidschicht bremst den Anfang (Sekunden, bis sie gelöst ist) — Aluminium. */
  readonly oxide?: number;
}

export const METALS: readonly Metal[] = [
  { id: 'Li', E: -3.04, n: 1, ion: 'Li+', kw: 6e-5, ka: 2e-3 },
  { id: 'K', E: -2.93, n: 1, ion: 'K+', kw: 1.4e-3, ka: 5e-3 },
  { id: 'Ca', E: -2.87, n: 2, ion: 'Ca+2', kw: 2.5e-5, ka: 1e-3 },
  { id: 'Na', E: -2.71, n: 1, ion: 'Na+', kw: 4.5e-4, ka: 3e-3 },
  { id: 'Mg', E: -2.37, n: 2, ion: 'Mg+2', kw: 4e-10, Ew: 80, ka: 3.5e-5 },
  { id: 'Al', E: -1.66, n: 3, ion: 'Al+3', kw: 0, ka: 5e-6, kb: 6e-6, oxide: 25 },
  { id: 'Zn', E: -0.76, n: 2, ion: 'Zn+2', kw: 0, ka: 1.1e-5, kb: 1e-6 },
  { id: 'Fe', E: -0.44, n: 2, ion: 'Fe+2', kw: 0, ka: 6e-7 },
  { id: 'Sn', E: -0.14, n: 2, ion: 'Sn+2', kw: 0, ka: 1.5e-7 },
  { id: 'Pb', E: -0.13, n: 2, ion: 'Pb+2', kw: 0, ka: 2e-8 },
  { id: 'Cu', E: 0.34, n: 2, ion: 'Cu+2', kw: 0, ka: 0 },
  { id: 'Ag', E: 0.8, n: 1, ion: 'Ag+', kw: 0, ka: 0 }
];
export const metalOf = (id: string): Metal | undefined => METALS.find((m) => m.id === id);
/** Welches Metall zu einem Ion gehört (für die Abscheidung: Cu²⁺ → Cu). */
export const metalOfIon = (ion: string): Metal | undefined => METALS.find((m) => m.ion === ion);

/* -- Zersetzen beim Erhitzen ----------------------------------------------------------------- */

export interface Decomposition {
  readonly from: string;
  /** Ab welcher Temperatur (K) es merklich geht. */
  readonly T: number;
  /** Was je mol entsteht: "s:CuO", "g:CO2", "water" (flüssig, wenn nass). */
  readonly make: readonly (readonly [string, number])[];
  /** Auch unter Wasser (Cu(OH)₂ wird beim Kochen schwarz). */
  readonly wet?: boolean;
  readonly eq: string;
}

export const DECOMPOSITIONS: readonly Decomposition[] = [
  { from: 'NaHCO3', T: 380, make: [['s:Na2CO3', 0.5], ['g:H2O(g)', 0.5], ['g:CO2', 0.5]], eq: '2NaHCO₃ → Na₂CO₃ + H₂O + CO₂↑' },
  { from: 'CaCO3', T: 1080, make: [['s:CaO', 1], ['g:CO2', 1]], eq: 'CaCO₃ → CaO + CO₂↑' },
  { from: 'CuCO3', T: 560, make: [['s:CuO', 1], ['g:CO2', 1]], eq: 'CuCO₃ → CuO + CO₂↑' },
  { from: 'Cu(OH)2', T: 350, make: [['s:CuO', 1], ['water', 1]], wet: true, eq: 'Cu(OH)₂ → CuO + H₂O' },
  { from: 'CuSO4·5H2O', T: 385, make: [['s:CuSO4', 1], ['g:H2O(g)', 5]], eq: 'CuSO₄·5H₂O → CuSO₄ + 5H₂O' },
  { from: 'KMnO4', T: 515, make: [['s:K2MnO4', 0.5], ['s:MnO2', 0.5], ['g:O2', 0.5]], eq: '2KMnO₄ → K₂MnO₄ + MnO₂ + O₂↑' },
  { from: 'NH4Cl', T: 610, make: [['g:NH3', 1], ['g:HCl(g)', 1]], eq: 'NH₄Cl → NH₃↑ + HCl↑' },
  { from: 'Ag2O', T: 570, make: [['s:Ag', 2], ['g:O2', 0.5]], eq: '2Ag₂O → 4Ag + O₂↑' },
  { from: 'Mg(OH)2', T: 620, make: [['s:MgO', 1], ['g:H2O(g)', 1]], eq: 'Mg(OH)₂ → MgO + H₂O' },
  { from: 'Ca(OH)2', T: 790, make: [['s:CaO', 1], ['g:H2O(g)', 1]], eq: 'Ca(OH)₂ → CaO + H₂O' },
  { from: 'sugar(s)', T: 470, make: [['s:C', 12], ['g:H2O(g)', 11]], eq: 'C₁₂H₂₂O₁₁ → 12C + 11H₂O' }
];

/* -- Was brennt ------------------------------------------------------------------------------- */

export interface Fuel {
  readonly id: string;
  /** Zündtemperatur (K) — eine Streichholzflamme bringt ~900 K, der Brenner ~1300 K. */
  readonly ignite: number;
  /** Unter welchem Anteil Sauerstoff es ausgeht (Kerze 16 %). */
  readonly xmin: number;
  /** mol/(s·cm²) bei Luft (21 % O₂). Die Kerze: mol/s je Docht. */
  readonly k: number;
  readonly o2: number;
  readonly make: readonly (readonly [string, number])[];
  readonly flame: string | null;
  /** Wie hell (1 — blendend: Magnesium). */
  readonly light: number;
  readonly smoke: string | null;
  /** Nur als Pulver oder Wolle (ein Nagel brennt nicht). */
  readonly fine?: boolean;
  readonly eq: string;
}

export const FUELS: readonly Fuel[] = [
  { id: 'Mg', ignite: 900, xmin: 0.03, k: 1.2e-4, o2: 0.5, make: [['s:MgO', 1]], flame: '#ffffff', light: 1, smoke: '#f4f4f4', eq: '2Mg + O₂ → 2MgO' },
  { id: 'S', ignite: 520, xmin: 0.08, k: 6e-5, o2: 1, make: [['g:SO2', 1]], flame: '#4a6cff', light: 0.25, smoke: null, eq: 'S + O₂ → SO₂' },
  { id: 'C', ignite: 650, xmin: 0.1, k: 1.2e-5, o2: 1, make: [['g:CO2', 1]], flame: null, light: 0.35, smoke: null, eq: 'C + O₂ → CO₂' },
  { id: 'Fe', ignite: 950, xmin: 0.15, k: 2e-6, o2: 2 / 3, make: [['s:Fe3O4', 1 / 3]], flame: '#ffb040', light: 0.6, smoke: null, fine: true, eq: '3Fe + 2O₂ → Fe₃O₄' },
  { id: 'wax', ignite: 600, xmin: 0.16, k: 4.7e-6, o2: 38, make: [['g:CO2', 25], ['g:H2O(g)', 26]], flame: '#ffb347', light: 0.4, smoke: null, eq: 'C₂₅H₅₂ + 38O₂ → 25CO₂ + 26H₂O' },
  { id: 'ethanol', ignite: 640, xmin: 0.15, k: 4e-5, o2: 3, make: [['g:CO2', 2], ['g:H2O(g)', 3]], flame: '#6f9cff', light: 0.15, smoke: null, eq: 'C₂H₅OH + 3O₂ → 2CO₂ + 3H₂O' },
  { id: 'wood', ignite: 700, xmin: 0.12, k: 2.5e-5, o2: 6, make: [['g:CO2', 6], ['g:H2O(g)', 5]], flame: '#ffb347', light: 0.5, smoke: '#5a5a5a', eq: '(C₆H₁₀O₅)ₙ + 6nO₂ → 6nCO₂ + 5nH₂O' }
];
export const fuelOf = (id: string): Fuel | undefined => FUELS.find((f) => f.id === id);

/**
 * WAS ALS GAS BRENNT (Brenner, Wasserstoff, Etanoldampf): ab der
 * Zündtemperatur in jeder Zelle, in der Brennstoff und Sauerstoff zusammen
 * sind — fehlt Sauerstoff, wird der Kohlenstoff zu Russ (die gelbe,
 * leuchtende Flamme des Brenners mit geschlossener Luft).
 */
export interface GasFuel {
  readonly id: GasId;
  readonly ignite: number;
  readonly o2: number;
  readonly make: readonly (readonly [GasId, number])[];
  /** Kohlenstoff je mol, der bei Sauerstoffmangel Russ wird. */
  readonly soot: number;
  readonly eq: string;
}

export const GAS_FUELS: readonly GasFuel[] = [
  { id: 'CH4', ignite: 870, o2: 2, make: [['CO2', 1], ['H2O(g)', 2]], soot: 1, eq: 'CH₄ + 2O₂ → CO₂ + 2H₂O' },
  { id: 'H2', ignite: 840, o2: 0.5, make: [['H2O(g)', 1]], soot: 0, eq: '2H₂ + O₂ → 2H₂O' },
  { id: 'EtOH(g)', ignite: 700, o2: 3, make: [['CO2', 2], ['H2O(g)', 3]], soot: 0, eq: 'C₂H₅OH + 3O₂ → 2CO₂ + 3H₂O' }
];

/* -- Indikatoren ------------------------------------------------------------------------------- */

export interface Indicator {
  readonly id: string;
  readonly name: string;
  /** Farbe je pH (Stützstellen) — dazwischen gemischt; `rgba(…,0)`: farblos. */
  readonly stops: readonly (readonly [number, string])[];
}

export const INDICATORS: readonly Indicator[] = [
  { id: 'phenolphthalein', name: 'fenoloftaleina', stops: [[8.1, 'rgba(255,255,255,0)'], [8.8, 'rgba(240,110,200,0.6)'], [10, 'rgba(214,30,150,0.9)']] },
  { id: 'methylorange', name: 'oranż metylowy', stops: [[3.1, '#d9302a'], [4.4, '#f0a020'], [6, '#f5d020']] },
  { id: 'litmus', name: 'lakmus', stops: [[4.5, '#c0283a'], [6.5, '#7a3c8a'], [8.3, '#3050b0']] },
  { id: 'bromothymol', name: 'błękit bromotymolowy', stops: [[6, '#e8d020'], [7, '#4aa060'], [7.6, '#2860c0']] },
  { id: 'universal', name: 'wskaźnik uniwersalny', stops: [[1, '#d0202a'], [3, '#f06a20'], [5, '#f0c020'], [7, '#40a040'], [9, '#2878c8'], [11, '#4a3aa0'], [13, '#7a2a90']] },
  { id: 'cabbage', name: 'wywar z czerwonej kapusty', stops: [[2, '#c8204a'], [4, '#c04a90'], [7, '#6a4ab0'], [9, '#3a7ac0'], [11, '#3aa070'], [13, '#d8c830']] }
];
export const indicatorOf = (id: string): Indicator | undefined => INDICATORS.find((i) => i.id === id);

/* -- Was auf dem Regal steht ------------------------------------------------------------------- */

export type ReagentForm = 'piece' | 'granules' | 'powder' | 'ribbon' | 'crystals' | 'solution' | 'liquid' | 'indicator' | 'gas' | 'candle';

export interface Reagent {
  readonly id: string;
  readonly name: string;
  readonly form: ReagentForm;
  /** Fest: der Stoff. Lösung: Gelöstes und Konzentration (mol/L). Gas: das Gas. */
  readonly solid?: string;
  readonly solute?: string;
  readonly conc?: number;
  /** Noch etwas darin (eine angesäuerte Lösung: FeCl₃ mit etwas HCl). */
  readonly also?: readonly (readonly [string, number])[];
  /** Wie viel man auf einmal nimmt: Gramm (fest), Milliliter (flüssig, Gas) oder Tropfen (Indikator). */
  readonly amounts: readonly number[];
  readonly group: 'metale' | 'sole' | 'kwasy' | 'zasady' | 'tlenki' | 'inne' | 'wskazniki' | 'gazy';
  /** Warum es gefährlich ist — gezeigt auf dem Etikett. */
  readonly warn?: string;
  /** Temperatur beim Eingiessen (°C) — sonst Zimmertemperatur. */
  readonly T?: number;
}

export const REAGENT_GROUPS: readonly (readonly [Reagent['group'], string])[] = [
  ['metale', 'Metale'], ['kwasy', 'Kwasy'], ['zasady', 'Zasady'], ['sole', 'Sole'], ['tlenki', 'Tlenki'],
  ['wskazniki', 'Wskaźniki'], ['gazy', 'Gazy z butli'], ['inne', 'Inne']
];

export const REAGENTS: readonly Reagent[] = [
  /* Metalle */
  { id: 'Na', name: 'sód (kawałek)', form: 'piece', solid: 'Na', amounts: [0.1, 0.2, 0.5], group: 'metale', warn: 'reaguje gwałtownie z wodą' },
  { id: 'K', name: 'potas (kawałek)', form: 'piece', solid: 'K', amounts: [0.1, 0.2], group: 'metale', warn: 'reaguje bardzo gwałtownie z wodą' },
  { id: 'Li', name: 'lit (kawałek)', form: 'piece', solid: 'Li', amounts: [0.05, 0.1, 0.2], group: 'metale' },
  { id: 'Ca', name: 'wapń (granulki)', form: 'granules', solid: 'Ca', amounts: [0.1, 0.3], group: 'metale' },
  { id: 'Mg', name: 'magnez (wstążka)', form: 'ribbon', solid: 'Mg', amounts: [0.05, 0.1, 0.3], group: 'metale' },
  { id: 'Mg-powder', name: 'magnez (proszek)', form: 'powder', solid: 'Mg', amounts: [0.1, 0.3], group: 'metale' },
  { id: 'Al', name: 'glin (folia)', form: 'ribbon', solid: 'Al', amounts: [0.1, 0.3], group: 'metale' },
  { id: 'Zn', name: 'cynk (granulki)', form: 'granules', solid: 'Zn', amounts: [0.5, 1, 2], group: 'metale' },
  { id: 'Fe', name: 'żelazo (gwóźdź)', form: 'piece', solid: 'Fe', amounts: [2, 5], group: 'metale' },
  { id: 'Fe-wool', name: 'wata stalowa', form: 'powder', solid: 'Fe', amounts: [0.5, 1], group: 'metale' },
  { id: 'Cu', name: 'miedź (drut)', form: 'ribbon', solid: 'Cu', amounts: [0.5, 1, 2], group: 'metale' },
  { id: 'Sn', name: 'cyna (granulki)', form: 'granules', solid: 'Sn', amounts: [5, 20, 50], group: 'metale' },
  { id: 'Pb', name: 'ołów (kawałek)', form: 'piece', solid: 'Pb', amounts: [10, 30, 60], group: 'metale', warn: 'trujący' },
  { id: 'Field', name: 'stop Fielda (topi się w 62 °C)', form: 'piece', solid: 'Field', amounts: [10, 30], group: 'metale' },
  { id: 'Al-block', name: 'glin (kawałek)', form: 'piece', solid: 'Al', amounts: [5, 15], group: 'metale' },
  { id: 'Cu-block', name: 'miedź (kawałek)', form: 'piece', solid: 'Cu', amounts: [10, 30], group: 'metale' },
  /* Säuren */
  { id: 'HCl', name: 'kwas solny 1 mol/dm³', form: 'solution', solute: 'HCl', conc: 1, amounts: [1, 5, 10, 25, 50], group: 'kwasy', warn: 'żrący' },
  { id: 'HCl-dil', name: 'kwas solny 0,1 mol/dm³', form: 'solution', solute: 'HCl', conc: 0.1, amounts: [1, 5, 10, 25, 50], group: 'kwasy' },
  { id: 'H2SO4', name: 'kwas siarkowy(VI) 0,5 mol/dm³', form: 'solution', solute: 'H2SO4', conc: 0.5, amounts: [1, 5, 10, 25], group: 'kwasy', warn: 'żrący' },
  { id: 'HNO3', name: 'kwas azotowy(V) 2 mol/dm³', form: 'solution', solute: 'HNO3', conc: 2, amounts: [1, 5, 10, 25], group: 'kwasy', warn: 'żrący' },
  { id: 'HNO3-conc', name: 'kwas azotowy(V) stężony', form: 'solution', solute: 'HNO3', conc: 14, amounts: [1, 5], group: 'kwasy', warn: 'silnie żrący, utleniacz' },
  { id: 'vinegar', name: 'ocet (kwas octowy 1 mol/dm³)', form: 'solution', solute: 'CH3COOH', conc: 1, amounts: [5, 10, 25, 50], group: 'kwasy' },
  /* Basen */
  { id: 'NaOH', name: 'wodorotlenek sodu (granulki)', form: 'granules', solid: 'NaOH', amounts: [0.5, 2, 5], group: 'zasady', warn: 'żrący' },
  { id: 'NaOH-aq', name: 'wodorotlenek sodu 1 mol/dm³', form: 'solution', solute: 'NaOH', conc: 1, amounts: [1, 5, 10, 25, 50], group: 'zasady', warn: 'żrący' },
  { id: 'NaOH-dil', name: 'wodorotlenek sodu 0,1 mol/dm³', form: 'solution', solute: 'NaOH', conc: 0.1, amounts: [1, 5, 10, 25, 50], group: 'zasady' },
  { id: 'limewater', name: 'woda wapienna', form: 'solution', solute: 'Ca(OH)2', conc: 0.02, amounts: [10, 25, 50], group: 'zasady' },
  { id: 'NH3-aq', name: 'woda amoniakalna 2 mol/dm³', form: 'solution', solute: 'NH3', conc: 2, amounts: [1, 5, 10, 25], group: 'zasady' },
  /* Salze */
  { id: 'NaCl', name: 'chlorek sodu (sól)', form: 'crystals', solid: 'NaCl', amounts: [1, 5, 20], group: 'sole' },
  { id: 'KNO3', name: 'azotan(V) potasu', form: 'crystals', solid: 'KNO3', amounts: [5, 20, 50], group: 'sole' },
  { id: 'NH4NO3', name: 'azotan(V) amonu', form: 'crystals', solid: 'NH4NO3', amounts: [5, 10, 20], group: 'sole' },
  { id: 'NH4Cl', name: 'chlorek amonu', form: 'crystals', solid: 'NH4Cl', amounts: [1, 2, 5], group: 'sole' },
  { id: 'CaCl2', name: 'chlorek wapnia (bezwodny)', form: 'granules', solid: 'CaCl2', amounts: [2, 5, 10], group: 'sole' },
  { id: 'CuSO4·5H2O', name: 'siarczan(VI) miedzi(II) — niebieski', form: 'crystals', solid: 'CuSO4·5H2O', amounts: [1, 5, 10], group: 'sole' },
  { id: 'CuSO4·5H2O-powder', name: 'siarczan(VI) miedzi(II) — niebieski, utarty na proszek', form: 'powder', solid: 'CuSO4·5H2O', amounts: [1, 5, 10], group: 'sole' },
  { id: 'CuSO4', name: 'siarczan(VI) miedzi(II) bezwodny — biały', form: 'powder', solid: 'CuSO4', amounts: [0.5, 1, 2], group: 'sole' },
  { id: 'CaCO3', name: 'marmur (kawałki CaCO₃)', form: 'granules', solid: 'CaCO3', amounts: [1, 2, 5], group: 'sole' },
  { id: 'CaCO3-powder', name: 'kreda (proszek CaCO₃)', form: 'powder', solid: 'CaCO3', amounts: [1, 2, 5], group: 'sole' },
  { id: 'NaHCO3', name: 'soda oczyszczona (NaHCO₃)', form: 'powder', solid: 'NaHCO3', amounts: [1, 2, 5], group: 'sole' },
  { id: 'Na2CO3', name: 'węglan sodu (soda)', form: 'powder', solid: 'Na2CO3', amounts: [1, 5], group: 'sole' },
  { id: 'CuCO3', name: 'węglan miedzi(II) (zielony)', form: 'powder', solid: 'CuCO3', amounts: [0.5, 1], group: 'sole' },
  { id: 'KMnO4', name: 'manganian(VII) potasu', form: 'crystals', solid: 'KMnO4', amounts: [0.1, 0.5, 1], group: 'sole' },
  { id: 'PbNO3-s', name: 'azotan(V) ołowiu(II)', form: 'crystals', solid: 'Pb(NO3)2', amounts: [0.5, 1], group: 'sole', warn: 'trujący' },
  { id: 'KI-s', name: 'jodek potasu', form: 'crystals', solid: 'KI', amounts: [0.5, 1], group: 'sole' },
  { id: 'NaCl-aq', name: 'chlorek sodu 1 mol/dm³', form: 'solution', solute: 'NaCl', conc: 1, amounts: [1, 5, 10, 25], group: 'sole' },
  { id: 'KCl-aq', name: 'chlorek potasu 1 mol/dm³', form: 'solution', solute: 'KCl', conc: 1, amounts: [1, 5, 10], group: 'sole' },
  { id: 'LiCl-aq', name: 'chlorek litu 1 mol/dm³', form: 'solution', solute: 'LiCl', conc: 1, amounts: [1, 5, 10], group: 'sole' },
  { id: 'AgNO3', name: 'azotan(V) srebra 0,1 mol/dm³', form: 'solution', solute: 'AgNO3', conc: 0.1, amounts: [1, 5, 10], group: 'sole' },
  { id: 'KI', name: 'jodek potasu 0,1 mol/dm³', form: 'solution', solute: 'KI', conc: 0.1, amounts: [1, 5, 10], group: 'sole' },
  { id: 'KSCN', name: 'tiocyjanian potasu 0,1 mol/dm³', form: 'solution', solute: 'KSCN', conc: 0.1, amounts: [1, 5], group: 'sole' },
  { id: 'Pb(NO3)2', name: 'azotan(V) ołowiu(II) 0,1 mol/dm³', form: 'solution', solute: 'Pb(NO3)2', conc: 0.1, amounts: [1, 5, 10], group: 'sole', warn: 'trujący' },
  { id: 'BaCl2', name: 'chlorek baru 0,1 mol/dm³', form: 'solution', solute: 'BaCl2', conc: 0.1, amounts: [1, 5, 10], group: 'sole', warn: 'trujący' },
  { id: 'SrCl2', name: 'chlorek strontu 0,5 mol/dm³', form: 'solution', solute: 'SrCl2', conc: 0.5, amounts: [1, 5, 10], group: 'sole' },
  { id: 'CaCl2-aq', name: 'chlorek wapnia 0,5 mol/dm³', form: 'solution', solute: 'CaCl2', conc: 0.5, amounts: [1, 5, 10], group: 'sole' },
  { id: 'Na2SO4', name: 'siarczan(VI) sodu 0,5 mol/dm³', form: 'solution', solute: 'Na2SO4', conc: 0.5, amounts: [1, 5, 10], group: 'sole' },
  { id: 'Na2CO3-aq', name: 'węglan sodu 1 mol/dm³', form: 'solution', solute: 'Na2CO3', conc: 1, amounts: [1, 5, 10, 25], group: 'sole' },
  { id: 'CuSO4-aq', name: 'siarczan(VI) miedzi(II) 0,5 mol/dm³', form: 'solution', solute: 'CuSO4', conc: 0.5, amounts: [1, 5, 10, 25, 50], group: 'sole' },
  { id: 'ZnSO4', name: 'siarczan(VI) cynku 0,5 mol/dm³', form: 'solution', solute: 'ZnSO4', conc: 0.5, amounts: [1, 5, 10, 25], group: 'sole' },
  { id: 'FeSO4', name: 'siarczan(VI) żelaza(II) 0,1 mol/dm³', form: 'solution', solute: 'FeSO4', conc: 0.1, also: [['H2SO4', 0.05]], amounts: [1, 5, 10], group: 'sole' },
  { id: 'FeCl3', name: 'chlorek żelaza(III) 0,1 mol/dm³', form: 'solution', solute: 'FeCl3', conc: 0.1, also: [['HCl', 0.05]], amounts: [1, 5, 10], group: 'sole' },
  { id: 'K2CrO4', name: 'chromian(VI) potasu 0,1 mol/dm³', form: 'solution', solute: 'K2CrO4', conc: 0.1, amounts: [1, 5, 10], group: 'sole', warn: 'trujący' },
  { id: 'K2Cr2O7', name: 'dichromian(VI) potasu 0,05 mol/dm³', form: 'solution', solute: 'K2Cr2O7', conc: 0.05, amounts: [1, 5, 10], group: 'sole', warn: 'trujący' },
  { id: 'Na2S2O3', name: 'tiosiarczan sodu 0,15 mol/dm³', form: 'solution', solute: 'Na2S2O3', conc: 0.15, amounts: [5, 10, 25, 50], group: 'sole' },
  { id: 'KMnO4-aq', name: 'manganian(VII) potasu 0,02 mol/dm³', form: 'solution', solute: 'KMnO4', conc: 0.02, amounts: [1, 5, 10], group: 'sole' },
  /* Oxide */
  { id: 'CaO', name: 'tlenek wapnia (wapno palone)', form: 'powder', solid: 'CaO', amounts: [1, 2, 5], group: 'tlenki' },
  { id: 'MgO', name: 'tlenek magnezu', form: 'powder', solid: 'MgO', amounts: [0.5, 1], group: 'tlenki' },
  { id: 'CuO', name: 'tlenek miedzi(II)', form: 'powder', solid: 'CuO', amounts: [0.5, 1], group: 'tlenki' },
  { id: 'MnO2', name: 'tlenek manganu(IV) (katalizator)', form: 'powder', solid: 'MnO2', amounts: [0.2, 0.5], group: 'tlenki' },
  /* Indikatoren (Tropfen) */
  ...INDICATORS.map((i): Reagent => ({ id: i.id, name: i.name, form: 'indicator', solute: i.id, amounts: [1, 3, 5], group: 'wskazniki' })),
  /* Gase aus der Flasche (mL bei Zimmerbedingungen) */
  { id: 'O2-gas', name: 'tlen', form: 'gas', solid: 'O2', amounts: [50, 100, 250], group: 'gazy' },
  { id: 'CO2-gas', name: 'tlenek węgla(IV)', form: 'gas', solid: 'CO2', amounts: [50, 100, 250], group: 'gazy' },
  { id: 'H2-gas', name: 'wodór', form: 'gas', solid: 'H2', amounts: [10, 25, 50], group: 'gazy', warn: 'palny' },
  { id: 'N2-gas', name: 'azot', form: 'gas', solid: 'N2', amounts: [50, 100, 250], group: 'gazy' },
  { id: 'NH3-gas', name: 'amoniak', form: 'gas', solid: 'NH3', amounts: [50, 100, 250], group: 'gazy' },
  /* Anderes */
  { id: 'water', name: 'woda destylowana', form: 'liquid', solute: 'H2O', amounts: [5, 10, 25, 50, 100], group: 'inne' },
  { id: 'H2O2', name: 'woda utleniona 3%', form: 'solution', solute: 'H2O2', conc: 0.9, amounts: [5, 25, 50], group: 'inne' },
  { id: 'H2O2-30', name: 'perhydrol 30%', form: 'solution', solute: 'H2O2', conc: 9.8, amounts: [5, 10, 25], group: 'inne', warn: 'utleniacz' },
  { id: 'soap', name: 'płyn do mycia naczyń', form: 'solution', solute: 'soap', conc: 0.3, amounts: [1, 5], group: 'inne' },
  { id: 'ethanol', name: 'etanol (denaturat)', form: 'liquid', solute: 'ethanol', amounts: [2, 5, 10], group: 'inne', warn: 'łatwopalny' },
  { id: 'S', name: 'siarka', form: 'powder', solid: 'S', amounts: [0.2, 0.5, 1], group: 'inne' },
  { id: 'C', name: 'węgiel drzewny', form: 'piece', solid: 'C', amounts: [0.5, 1], group: 'inne' },
  { id: 'candle', name: 'świeczka', form: 'candle', solid: 'wax', amounts: [3], group: 'inne' },
  { id: 'ice', name: 'kostki lodu', form: 'piece', solid: 'ice', amounts: [10, 30, 60], group: 'inne' },
  { id: 'ice-crushed', name: 'lód kruszony', form: 'granules', solid: 'ice', amounts: [20, 60, 100], group: 'inne', T: -5 },
  { id: 'sugar', name: 'cukier', form: 'crystals', solid: 'sugar(s)', amounts: [2, 5, 20], group: 'inne' },
  { id: 'sugar-powder', name: 'cukier puder', form: 'powder', solid: 'sugar(s)', amounts: [2, 5, 20], group: 'inne' },
  { id: 'potato', name: 'plasterek ziemniaka', form: 'piece', solid: 'potato', amounts: [5], group: 'inne' },
  { id: 'water-hot', name: 'woda gorąca (80 °C)', form: 'liquid', solute: 'H2O', amounts: [25, 50, 100], group: 'inne', T: 80 },
  { id: 'water-cold', name: 'woda z lodem (2 °C)', form: 'liquid', solute: 'H2O', amounts: [25, 50, 100], group: 'inne', T: 2 },
  { id: 'wood', name: 'drewno (łuczywo)', form: 'piece', solid: 'wood', amounts: [1, 3], group: 'inne' }
];

export const reagentOf = (id: string): Reagent | undefined => REAGENTS.find((r) => r.id === id);

/**
 * WAS EIN GELÖSTER STOFF INS WASSER GIBT, je mol: starke Ionen, Vorräte
 * (C, Ac, N, S) und Wasser — die Protonen zählt niemand: sie folgen aus der
 * Ladung (HCl gibt nur Cl⁻, NaOH gibt Na⁺ und ein Wasser).
 */
export const DISSOLVES: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
  HCl: [['Cl-', 1]],
  H2SO4: [['SO4-2', 1]],
  HNO3: [['NO3-', 1]],
  CH3COOH: [['Ac', 1]],
  NaOH: [['Na+', 1], ['water', 1]],
  'Ca(OH)2': [['Ca+2', 1], ['water', 2]],
  NH3: [['N', 1]],
  AgNO3: [['Ag+', 1], ['NO3-', 1]],
  NaCl: [['Na+', 1], ['Cl-', 1]],
  KCl: [['K+', 1], ['Cl-', 1]],
  LiCl: [['Li+', 1], ['Cl-', 1]],
  KI: [['K+', 1], ['I-', 1]],
  KSCN: [['K+', 1], ['SCN-', 1]],
  'Pb(NO3)2': [['Pb+2', 1], ['NO3-', 2]],
  BaCl2: [['Ba+2', 1], ['Cl-', 2]],
  SrCl2: [['Sr+2', 1], ['Cl-', 2]],
  CaCl2: [['Ca+2', 1], ['Cl-', 2]],
  Na2SO4: [['Na+', 2], ['SO4-2', 1]],
  Na2CO3: [['Na+', 2], ['C', 1], ['water', 1]],
  CuSO4: [['Cu+2', 1], ['SO4-2', 1]],
  ZnSO4: [['Zn+2', 1], ['SO4-2', 1]],
  FeSO4: [['Fe+2', 1], ['SO4-2', 1]],
  FeCl3: [['Fe+3', 1], ['Cl-', 3]],
  K2CrO4: [['K+', 2], ['CrO4-2', 1]],
  K2Cr2O7: [['K+', 2], ['Cr2O7-2', 1]],
  Na2S2O3: [['Na+', 2], ['S2O3-2', 1]],
  KMnO4: [['K+', 1], ['MnO4-', 1]],
  H2O2: [['H2O2', 1]],
  soap: [['soap', 1]],
  ethanol: [['ethanol', 1]]
};

/** Die Kugel der Rundkolbe (unten abgeflacht zum Stehen) und ihr Hals. */
const ROUND: readonly (readonly [number, number])[] = [
  ...Array.from({ length: 15 }, (_, i): [number, number] => {
    const a = -Math.PI / 2 + 0.25 + (i / 14) * (Math.PI - 0.62);
    return [0.31 * (1 + Math.sin(a)) - 0.31 * (1 + Math.sin(-Math.PI / 2 + 0.25)), Math.max(0.22, Math.cos(a))];
  }),
  [0.615, 0.22],
  [1, 0.22]
];

/** Glas und Geräte: Fassungsvermögen (mL) und Gestalt. */
export type VesselKind = 'beaker' | 'flask' | 'tube' | 'roundflask' | 'cylinder' | 'dish' | 'crucible' | 'jar' | 'burette' | 'syringe';

export interface VesselType {
  readonly kind: VesselKind;
  readonly name: string;
  /** Mögliche Grössen (mL). */
  readonly sizes: readonly number[];
  /** Querschnitt von unten nach oben: [Höhe 0..1, halbe Breite 0..1]. */
  readonly profile: readonly (readonly [number, number])[];
  /** Höhe : Breite. */
  readonly aspect: number;
  /** Wie weit die Öffnung ist (Gase gehen schneller hinaus): 1 — weit. */
  readonly mouth: number;
}

export const VESSELS: Readonly<Record<VesselKind, VesselType>> = {
  beaker: { kind: 'beaker', name: 'zlewka', sizes: [50, 100, 250, 600], profile: [[0, 1], [1, 1]], aspect: 1.35, mouth: 1 },
  flask: { kind: 'flask', name: 'kolba stożkowa', sizes: [100, 250, 500], profile: [[0, 1], [0.66, 0.36], [0.76, 0.2], [1, 0.2]], aspect: 1.35, mouth: 0.22 },
  tube: { kind: 'tube', name: 'probówka', sizes: [15, 25], profile: [[0, 0.45], [0.05, 0.92], [0.08, 1], [1, 1]], aspect: 6.5, mouth: 0.45 },
  roundflask: { kind: 'roundflask', name: 'kolba okrągłodenna', sizes: [100, 250, 500], profile: ROUND, aspect: 1.55, mouth: 0.2 },
  cylinder: { kind: 'cylinder', name: 'cylinder miarowy', sizes: [50, 100, 250], profile: [[0, 1], [1, 1]], aspect: 5, mouth: 0.6 },
  dish: { kind: 'dish', name: 'parownica', sizes: [50, 100], profile: [[0, 0.45], [0.45, 0.85], [1, 1]], aspect: 0.33, mouth: 1 },
  crucible: { kind: 'crucible', name: 'tygiel', sizes: [20, 30], profile: [[0, 0.6], [1, 1]], aspect: 1.05, mouth: 1 },
  jar: { kind: 'jar', name: 'słój', sizes: [500, 1000], profile: [[0, 1], [0.9, 1], [0.96, 0.82], [1, 0.82]], aspect: 1.3, mouth: 0.8 },
  burette: { kind: 'burette', name: 'biureta', sizes: [25, 50], profile: [[0, 0.25], [0.05, 1], [1, 1]], aspect: 22, mouth: 0.5 },
  syringe: { kind: 'syringe', name: 'strzykawka gazowa', sizes: [100], profile: [[0, 1], [1, 1]], aspect: 4, mouth: 0 }
};

/* -- Wärme: wie ein Feststoff Wärme speichert und leitet, wann er schmilzt ---------------------------- */

export interface Thermal {
  /** J/(g·K) und W/(m·K) des Feststoffs. */
  readonly c: number;
  readonly k: number;
  /** Schmelzpunkt (K), Schmelzwärme (J/g), Dichte und Leitfähigkeit der Schmelze. */
  readonly Tm?: number;
  readonly Lf?: number;
  readonly rhoL?: number;
  readonly kL?: number;
  readonly colorL?: string;
  /** Eis schmilzt zu Wasser (in die Lösung), alles andere zu einer eigenen Schmelze. */
  readonly toWater?: boolean;
}

/**
 * DIE WÄRME DER FESTSTOFFE (Handbuchwerte): Metalle leiten gut und schmelzen
 * beim Erhitzen (Zinn bei 232 °C, Blei bei 327 °C, Stop Fielda schon in
 * heissem Wasser), Eis wird Wasser, Paraffin und Schwefel werden flüssig.
 */
export const THERMAL: Readonly<Record<string, Thermal>> = {
  Li: { c: 3.58, k: 85, Tm: 453.7, Lf: 432, rhoL: 0.51, kL: 45 },
  Na: { c: 1.23, k: 142, Tm: 371, Lf: 113, rhoL: 0.927, kL: 85 },
  K: { c: 0.757, k: 102, Tm: 336.5, Lf: 59.6, rhoL: 0.828, kL: 55 },
  Ca: { c: 0.647, k: 201, Tm: 1115, Lf: 213, rhoL: 1.38, kL: 60 },
  Mg: { c: 1.02, k: 156, Tm: 923, Lf: 368, rhoL: 1.58, kL: 80 },
  Al: { c: 0.897, k: 237, Tm: 933.5, Lf: 397, rhoL: 2.38, kL: 90 },
  Zn: { c: 0.388, k: 116, Tm: 692.7, Lf: 112, rhoL: 6.57, kL: 60 },
  Fe: { c: 0.449, k: 80, Tm: 1811, Lf: 247, rhoL: 6.98, kL: 35 },
  Sn: { c: 0.227, k: 67, Tm: 505.1, Lf: 59.2, rhoL: 6.99, kL: 30 },
  Pb: { c: 0.129, k: 35, Tm: 600.6, Lf: 23, rhoL: 10.66, kL: 16 },
  Cu: { c: 0.385, k: 401, Tm: 1358, Lf: 205, rhoL: 8.02, kL: 160 },
  Ag: { c: 0.235, k: 429, Tm: 1235, Lf: 105, rhoL: 9.32, kL: 170 },
  Field: { c: 0.2, k: 19, Tm: 335, Lf: 25, rhoL: 7.6, kL: 15 },
  ice: { c: 2.1, k: 2.2, Tm: 273.15, Lf: 334, toWater: true },
  wax: { c: 2.5, k: 0.25, Tm: 330, Lf: 200, rhoL: 0.77, kL: 0.15, colorL: '#f3e9cc' },
  S: { c: 0.71, k: 0.27, Tm: 388.4, Lf: 54, rhoL: 1.82, kL: 0.15, colorL: '#e0a018' },
  C: { c: 1.0, k: 0.1 },
  wood: { c: 1.7, k: 0.15 },
  potato: { c: 3.4, k: 0.5 },
  'sugar(s)': { c: 1.24, k: 0.15 },
  MgO: { c: 0.92, k: 30 },
  CaCO3: { c: 0.84, k: 2.5 },
  CaO: { c: 0.75, k: 3 },
  CuO: { c: 0.53, k: 3 },
  MnO2: { c: 0.63, k: 1 },
  Fe3O4: { c: 0.65, k: 3 }
};

export const thermalOf = (id: string): Thermal => THERMAL[id] ?? { c: 0.85, k: 1.2 };

export const R = 8.314;
export const P_ATM_KPA = 101.325;
export const T0 = 273.15;
/** Die Temperatur des Zimmers (K), wenn die Szene nichts sagt. */
export const T_ROOM = 293.15;
