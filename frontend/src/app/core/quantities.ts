/**
 * GRÖSSEN UND EINHEITEN (2026-10-23, Schritt 13; target architecture B.11) —
 * eine kleine Auswahl aus QUDT: Dimensionen, Größenarten (quantity kinds) und
 * Einheiten mit ihrem Faktor zu SI. Die Kennungen sind die lokalen Namen von
 * QUDT (`Torque`, `Energy`; `N-M`, `KiloN`, `DEG_C`).
 *
 * <code>
 *   Dimension      L M T I Θ N J — Länge, Masse, Zeit, Strom, Temperatur, Stoffmenge, Lichtstärke
 *   Größenart      was gemessen wird: Länge, Energie, Drehmoment … — zwei Arten können
 *                  dieselbe Dimension haben (Energie und Drehmoment: M L² T⁻²) und sind
 *                  doch nicht dasselbe
 *   Einheit        Symbol, Faktor (und Versatz) zu SI: SI = Wert × Faktor + Versatz;
 *                  welche Arten sie misst (N·m: Drehmoment — und, mehrdeutig, Energie)
 * </code>
 *
 * Wer es braucht: Zahlenfelder und Fragen von Cogita (ein Wert wird in seiner
 * Einheit eingegeben und dazu in SI gespeichert; eine Antwort wird in SI und
 * nur innerhalb ihrer Art verglichen), die Anzeigen der Labore (die Motoren
 * rechnen in SI, angezeigt wird in einer Einheit dieser Liste). Rein, ohne
 * React.
 */

/** Die Exponenten der sieben Basisdimensionen: L, M, T, I, Θ, N, J. */
export type Dim = readonly [number, number, number, number, number, number, number];

export interface QuantityKind {
  /** Der lokale Name in QUDT (`quantitykind:Torque`). */
  readonly id: string;
  readonly label: string;
  readonly dim: Dim;
  /** Die SI-Einheit dieser Art (Faktor 1). */
  readonly si: string;
}

export interface Unit {
  /** Der lokale Name in QUDT (`unit:N-M`). */
  readonly id: string;
  /** Wie sie hinter der Zahl steht. */
  readonly symbol: string;
  readonly label: string;
  /** Welche Arten sie misst — mehr als eine: mehrdeutig (N·m). */
  readonly kinds: readonly string[];
  /** SI = Wert × factor + offset. */
  readonly factor: number;
  readonly offset?: number;
  /** Wie man sie sonst tippt. */
  readonly aliases?: readonly string[];
}

const D = (l = 0, m = 0, t = 0, i = 0, th = 0, n = 0, j = 0): Dim => [l, m, t, i, th, n, j];

export const QUANTITY_KINDS: readonly QuantityKind[] = [
  { id: 'Dimensionless', label: 'bez wymiaru', dim: D(), si: 'UNITLESS' },
  { id: 'PlaneAngle', label: 'kąt', dim: D(), si: 'RAD' },
  { id: 'Length', label: 'długość', dim: D(1), si: 'M' },
  { id: 'Area', label: 'pole powierzchni', dim: D(2), si: 'M2' },
  { id: 'Volume', label: 'objętość', dim: D(3), si: 'M3' },
  { id: 'Mass', label: 'masa', dim: D(0, 1), si: 'KiloGM' },
  { id: 'Time', label: 'czas', dim: D(0, 0, 1), si: 'SEC' },
  { id: 'Frequency', label: 'częstotliwość', dim: D(0, 0, -1), si: 'HZ' },
  { id: 'AngularVelocity', label: 'prędkość kątowa', dim: D(0, 0, -1), si: 'RAD-PER-SEC' },
  { id: 'Velocity', label: 'prędkość', dim: D(1, 0, -1), si: 'M-PER-SEC' },
  { id: 'Acceleration', label: 'przyspieszenie', dim: D(1, 0, -2), si: 'M-PER-SEC2' },
  { id: 'Force', label: 'siła', dim: D(1, 1, -2), si: 'N' },
  { id: 'Momentum', label: 'pęd', dim: D(1, 1, -1), si: 'KiloGM-M-PER-SEC' },
  { id: 'Energy', label: 'energia (praca, ciepło)', dim: D(2, 1, -2), si: 'J' },
  { id: 'Torque', label: 'moment siły', dim: D(2, 1, -2), si: 'N-M' },
  { id: 'Power', label: 'moc', dim: D(2, 1, -3), si: 'W' },
  { id: 'Pressure', label: 'ciśnienie', dim: D(-1, 1, -2), si: 'PA' },
  { id: 'ThermodynamicTemperature', label: 'temperatura', dim: D(0, 0, 0, 0, 1), si: 'K' },
  { id: 'Density', label: 'gęstość', dim: D(-3, 1), si: 'KiloGM-PER-M3' },
  { id: 'DynamicViscosity', label: 'lepkość dynamiczna', dim: D(-1, 1, -1), si: 'PA-SEC' },
  { id: 'KinematicViscosity', label: 'lepkość kinematyczna', dim: D(2, 0, -1), si: 'M2-PER-SEC' },
  { id: 'SpecificEnergy', label: 'energia właściwa (entalpia na kilogram)', dim: D(2, 0, -2), si: 'J-PER-KiloGM' },
  { id: 'SpecificHeatCapacity', label: 'ciepło właściwe', dim: D(2, 0, -2, 0, -1), si: 'J-PER-KiloGM-K' },
  { id: 'ThermalConductivity', label: 'przewodność cieplna', dim: D(1, 1, -3, 0, -1), si: 'W-PER-M-K' },
  { id: 'ElectricCurrent', label: 'natężenie prądu', dim: D(0, 0, 0, 1), si: 'A' },
  { id: 'ElectricCharge', label: 'ładunek elektryczny', dim: D(0, 0, 1, 1), si: 'C' },
  { id: 'Voltage', label: 'napięcie', dim: D(2, 1, -3, -1), si: 'V' },
  { id: 'Resistance', label: 'opór elektryczny', dim: D(2, 1, -3, -2), si: 'OHM' },
  { id: 'Capacitance', label: 'pojemność elektryczna', dim: D(-2, -1, 4, 2), si: 'FARAD' },
  { id: 'AmountOfSubstance', label: 'liczność materii', dim: D(0, 0, 0, 0, 0, 1), si: 'MOL' },
  { id: 'AmountOfSubstanceConcentration', label: 'stężenie molowe', dim: D(-3, 0, 0, 0, 0, 1), si: 'MOL-PER-M3' },
  { id: 'MolarMass', label: 'masa molowa', dim: D(0, 1, 0, 0, 0, -1), si: 'KiloGM-PER-MOL' },
  { id: 'LuminousIntensity', label: 'światłość', dim: D(0, 0, 0, 0, 0, 0, 1), si: 'CD' }
];

const u = (id: string, symbol: string, label: string, kinds: string | readonly string[], factor: number, more: { offset?: number; aliases?: readonly string[] } = {}): Unit =>
  ({ id, symbol, label, kinds: typeof kinds === 'string' ? [kinds] : kinds, factor, ...more });

/* Drehmoment und Energie haben dieselbe Dimension; N·m sagt man beim Moment — als Energie ist es mehrdeutig. */
const TORQUE_OR_ENERGY = ['Torque', 'Energy'] as const;

export const UNITS: readonly Unit[] = [
  u('UNITLESS', '', 'bez jednostki', 'Dimensionless', 1),
  u('PERCENT', '%', 'procent', 'Dimensionless', 0.01),
  u('RAD', 'rad', 'radian', 'PlaneAngle', 1),
  u('DEG', '°', 'stopień', 'PlaneAngle', Math.PI / 180, { aliases: ['deg', 'º'] }),
  u('REV', 'obr', 'obrót', 'PlaneAngle', 2 * Math.PI, { aliases: ['obr.', 'rev'] }),

  u('M', 'm', 'metr', 'Length', 1),
  u('KiloM', 'km', 'kilometr', 'Length', 1000),
  u('DeciM', 'dm', 'decymetr', 'Length', 0.1),
  u('CentiM', 'cm', 'centymetr', 'Length', 0.01),
  u('MilliM', 'mm', 'milimetr', 'Length', 0.001),
  u('MicroM', 'µm', 'mikrometr', 'Length', 1e-6, { aliases: ['μm', 'um'] }),
  u('NanoM', 'nm', 'nanometr', 'Length', 1e-9),
  u('IN', 'in', 'cal', 'Length', 0.0254, { aliases: ['″'] }),
  u('FT', 'ft', 'stopa', 'Length', 0.3048),
  u('MI', 'mi', 'mila', 'Length', 1609.344),
  u('LY', 'ly', 'rok świetlny', 'Length', 9460730472580800),

  u('M2', 'm²', 'metr kwadratowy', 'Area', 1),
  u('DeciM2', 'dm²', 'decymetr kwadratowy', 'Area', 0.01),
  u('CentiM2', 'cm²', 'centymetr kwadratowy', 'Area', 1e-4),
  u('MilliM2', 'mm²', 'milimetr kwadratowy', 'Area', 1e-6),
  u('KiloM2', 'km²', 'kilometr kwadratowy', 'Area', 1e6),
  u('HA', 'ha', 'hektar', 'Area', 1e4),

  u('M3', 'm³', 'metr sześcienny', 'Volume', 1),
  u('DeciM3', 'dm³', 'decymetr sześcienny', 'Volume', 1e-3),
  u('CentiM3', 'cm³', 'centymetr sześcienny', 'Volume', 1e-6, { aliases: ['ccm'] }),
  u('MilliM3', 'mm³', 'milimetr sześcienny', 'Volume', 1e-9),
  u('L', 'l', 'litr', 'Volume', 1e-3, { aliases: ['L', 'ℓ'] }),
  u('MilliL', 'ml', 'mililitr', 'Volume', 1e-6, { aliases: ['mL'] }),
  u('HectoL', 'hl', 'hektolitr', 'Volume', 0.1, { aliases: ['hL'] }),

  u('KiloGM', 'kg', 'kilogram', 'Mass', 1),
  u('DecaGM', 'dag', 'dekagram', 'Mass', 0.01),
  u('GM', 'g', 'gram', 'Mass', 1e-3),
  u('MilliGM', 'mg', 'miligram', 'Mass', 1e-6),
  u('MicroGM', 'µg', 'mikrogram', 'Mass', 1e-9, { aliases: ['μg', 'ug'] }),
  u('TONNE', 't', 'tona', 'Mass', 1000),
  u('LB', 'lb', 'funt', 'Mass', 0.45359237),

  u('SEC', 's', 'sekunda', 'Time', 1, { aliases: ['sek', 'sec'] }),
  u('MilliSEC', 'ms', 'milisekunda', 'Time', 1e-3),
  u('MicroSEC', 'µs', 'mikrosekunda', 'Time', 1e-6, { aliases: ['μs', 'us'] }),
  u('MIN', 'min', 'minuta', 'Time', 60),
  u('HR', 'h', 'godzina', 'Time', 3600, { aliases: ['godz', 'godz.'] }),
  u('DAY', 'd', 'doba', 'Time', 86400, { aliases: ['doba', 'dni'] }),
  u('YR', 'rok', 'rok', 'Time', 31557600, { aliases: ['lat', 'a'] }),

  u('HZ', 'Hz', 'herc', 'Frequency', 1),
  u('KiloHZ', 'kHz', 'kiloherc', 'Frequency', 1e3),
  u('MegaHZ', 'MHz', 'megaherc', 'Frequency', 1e6),
  u('GigaHZ', 'GHz', 'gigaherc', 'Frequency', 1e9),
  u('PER-SEC', '1/s', 'na sekundę', 'Frequency', 1, { aliases: ['s⁻¹'] }),
  u('PER-MIN', '1/min', 'na minutę', 'Frequency', 1 / 60, { aliases: ['min⁻¹'] }),

  u('RAD-PER-SEC', 'rad/s', 'radian na sekundę', 'AngularVelocity', 1),
  u('DEG-PER-SEC', '°/s', 'stopień na sekundę', 'AngularVelocity', Math.PI / 180),
  u('REV-PER-SEC', 'obr/s', 'obrót na sekundę', 'AngularVelocity', 2 * Math.PI),
  u('REV-PER-MIN', 'obr/min', 'obrót na minutę', 'AngularVelocity', (2 * Math.PI) / 60, { aliases: ['rpm', 'obr./min'] }),

  u('M-PER-SEC', 'm/s', 'metr na sekundę', 'Velocity', 1),
  u('CentiM-PER-SEC', 'cm/s', 'centymetr na sekundę', 'Velocity', 0.01),
  u('KiloM-PER-HR', 'km/h', 'kilometr na godzinę', 'Velocity', 1 / 3.6, { aliases: ['kmh', 'km/godz'] }),
  u('KiloM-PER-SEC', 'km/s', 'kilometr na sekundę', 'Velocity', 1000),
  u('MI-PER-HR', 'mph', 'mila na godzinę', 'Velocity', 0.44704),
  u('KN', 'kn', 'węzeł', 'Velocity', 1852 / 3600),

  u('M-PER-SEC2', 'm/s²', 'metr na sekundę kwadrat', 'Acceleration', 1),
  u('CentiM-PER-SEC2', 'cm/s²', 'centymetr na sekundę kwadrat', 'Acceleration', 0.01),
  u('G', 'g₀', 'przyspieszenie ziemskie normalne', 'Acceleration', 9.80665, { aliases: ['gn'] }),

  u('N', 'N', 'niuton', 'Force', 1),
  u('MilliN', 'mN', 'miliniuton', 'Force', 1e-3),
  u('KiloN', 'kN', 'kiloniuton', 'Force', 1e3),
  u('MegaN', 'MN', 'meganiuton', 'Force', 1e6),
  u('KiloGM_F', 'kgf', 'kilogram-siła', 'Force', 9.80665),
  u('DYN', 'dyn', 'dyna', 'Force', 1e-5),

  u('KiloGM-M-PER-SEC', 'kg·m/s', 'kilogram metr na sekundę', 'Momentum', 1),
  u('N-SEC', 'N·s', 'niutonosekunda', 'Momentum', 1),

  u('J', 'J', 'dżul', 'Energy', 1),
  u('MilliJ', 'mJ', 'milidżul', 'Energy', 1e-3),
  u('KiloJ', 'kJ', 'kilodżul', 'Energy', 1e3),
  u('MegaJ', 'MJ', 'megadżul', 'Energy', 1e6),
  u('CAL', 'cal', 'kaloria', 'Energy', 4.184),
  u('KiloCAL', 'kcal', 'kilokaloria', 'Energy', 4184),
  u('W-HR', 'W·h', 'watogodzina', 'Energy', 3600, { aliases: ['Wh'] }),
  u('KiloW-HR', 'kW·h', 'kilowatogodzina', 'Energy', 3.6e6, { aliases: ['kWh'] }),
  u('EV', 'eV', 'elektronowolt', 'Energy', 1.602176634e-19),

  u('N-M', 'N·m', 'niutonometr', TORQUE_OR_ENERGY, 1, { aliases: ['Nm'] }),
  u('MilliN-M', 'mN·m', 'miliniutonometr', TORQUE_OR_ENERGY, 1e-3, { aliases: ['mNm'] }),
  u('KiloN-M', 'kN·m', 'kiloniutonometr', TORQUE_OR_ENERGY, 1e3, { aliases: ['kNm'] }),

  u('W', 'W', 'wat', 'Power', 1),
  u('MilliW', 'mW', 'miliwat', 'Power', 1e-3),
  u('KiloW', 'kW', 'kilowat', 'Power', 1e3),
  u('MegaW', 'MW', 'megawat', 'Power', 1e6),
  u('HP_Metric', 'KM', 'koń mechaniczny', 'Power', 735.49875, { aliases: ['PS'] }),

  u('PA', 'Pa', 'paskal', 'Pressure', 1),
  u('HectoPA', 'hPa', 'hektopaskal', 'Pressure', 100),
  u('KiloPA', 'kPa', 'kilopaskal', 'Pressure', 1e3),
  u('MegaPA', 'MPa', 'megapaskal', 'Pressure', 1e6),
  u('BAR', 'bar', 'bar', 'Pressure', 1e5),
  u('MilliBAR', 'mbar', 'milibar', 'Pressure', 100),
  u('ATM', 'atm', 'atmosfera fizyczna', 'Pressure', 101325),
  u('MilliM_HG', 'mmHg', 'milimetr słupa rtęci', 'Pressure', 133.322387415, { aliases: ['mm Hg'] }),
  u('PSI', 'psi', 'funt na cal kwadratowy', 'Pressure', 6894.757293168),

  u('K', 'K', 'kelwin', 'ThermodynamicTemperature', 1),
  u('DEG_C', '°C', 'stopień Celsjusza', 'ThermodynamicTemperature', 1, { offset: 273.15, aliases: ['ºC', 'oC', 'st. C', 'C°'] }),
  u('DEG_F', '°F', 'stopień Fahrenheita', 'ThermodynamicTemperature', 5 / 9, { offset: (459.67 * 5) / 9, aliases: ['ºF', 'F°'] }),

  u('KiloGM-PER-M3', 'kg/m³', 'kilogram na metr sześcienny', 'Density', 1),
  u('GM-PER-CentiM3', 'g/cm³', 'gram na centymetr sześcienny', 'Density', 1000, { aliases: ['g/ccm'] }),
  u('GM-PER-L', 'g/l', 'gram na litr', 'Density', 1, { aliases: ['g/L', 'g/dm³'] }),
  u('KiloGM-PER-L', 'kg/l', 'kilogram na litr', 'Density', 1000, { aliases: ['kg/L', 'kg/dm³'] }),
  u('GM-PER-MilliL', 'g/ml', 'gram na mililitr', 'Density', 1000, { aliases: ['g/mL'] }),

  u('PA-SEC', 'Pa·s', 'paskalosekunda', 'DynamicViscosity', 1),
  u('MilliPA-SEC', 'mPa·s', 'milipaskalosekunda', 'DynamicViscosity', 1e-3),
  u('CentiPOISE', 'cP', 'centypuaz', 'DynamicViscosity', 1e-3),
  u('M2-PER-SEC', 'm²/s', 'metr kwadratowy na sekundę', 'KinematicViscosity', 1),
  u('J-PER-KiloGM', 'J/kg', 'dżul na kilogram', 'SpecificEnergy', 1),
  u('KiloJ-PER-KiloGM', 'kJ/kg', 'kilodżul na kilogram', 'SpecificEnergy', 1e3),
  u('J-PER-KiloGM-K', 'J/(kg·K)', 'dżul na kilogram i kelwin', 'SpecificHeatCapacity', 1, { aliases: ['J/kgK', 'J/(kgK)', 'J/kg/K', 'J/(kg·°C)'] }),
  u('W-PER-M-K', 'W/(m·K)', 'wat na metr i kelwin', 'ThermalConductivity', 1, { aliases: ['W/mK', 'W/(mK)', 'W/m/K'] }),

  u('A', 'A', 'amper', 'ElectricCurrent', 1),
  u('MilliA', 'mA', 'miliamper', 'ElectricCurrent', 1e-3),
  u('MicroA', 'µA', 'mikroamper', 'ElectricCurrent', 1e-6, { aliases: ['μA', 'uA'] }),
  u('C', 'C', 'kulomb', 'ElectricCharge', 1),
  u('MilliA-HR', 'mA·h', 'miliamperogodzina', 'ElectricCharge', 3.6, { aliases: ['mAh'] }),
  u('A-HR', 'A·h', 'amperogodzina', 'ElectricCharge', 3600, { aliases: ['Ah'] }),
  u('V', 'V', 'wolt', 'Voltage', 1),
  u('MilliV', 'mV', 'miliwolt', 'Voltage', 1e-3),
  u('KiloV', 'kV', 'kilowolt', 'Voltage', 1e3),
  u('OHM', 'Ω', 'om', 'Resistance', 1, { aliases: ['ohm', 'Ohm'] }),
  u('KiloOHM', 'kΩ', 'kiloom', 'Resistance', 1e3, { aliases: ['kohm', 'kOhm'] }),
  u('MegaOHM', 'MΩ', 'megaom', 'Resistance', 1e6, { aliases: ['Mohm', 'MOhm'] }),
  u('FARAD', 'F', 'farad', 'Capacitance', 1),
  u('MicroFARAD', 'µF', 'mikrofarad', 'Capacitance', 1e-6, { aliases: ['μF', 'uF'] }),
  u('NanoFARAD', 'nF', 'nanofarad', 'Capacitance', 1e-9),
  u('PicoFARAD', 'pF', 'pikofarad', 'Capacitance', 1e-12),

  u('MOL', 'mol', 'mol', 'AmountOfSubstance', 1),
  u('MilliMOL', 'mmol', 'milimol', 'AmountOfSubstance', 1e-3),
  u('MOL-PER-M3', 'mol/m³', 'mol na metr sześcienny', 'AmountOfSubstanceConcentration', 1),
  u('MOL-PER-L', 'mol/l', 'mol na litr', 'AmountOfSubstanceConcentration', 1000, { aliases: ['mol/L', 'mol/dm³'] }),
  u('KiloGM-PER-MOL', 'kg/mol', 'kilogram na mol', 'MolarMass', 1),
  u('GM-PER-MOL', 'g/mol', 'gram na mol', 'MolarMass', 1e-3),
  u('CD', 'cd', 'kandela', 'LuminousIntensity', 1)
];

const KIND_BY_ID = new Map(QUANTITY_KINDS.map((k) => [k.id, k]));
const UNIT_BY_ID = new Map(UNITS.map((one) => [one.id, one]));

export const kindById = (id: string | null | undefined): QuantityKind | undefined => (id == null ? undefined : KIND_BY_ID.get(id));
export const unitById = (id: string | null | undefined): Unit | undefined => (id == null ? undefined : UNIT_BY_ID.get(id));

/* -- Wie man eine Einheit schreibt -------------------------------------------------------------------- */

const SUPER: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

/** Eine Schreibweise auf eine Form gebracht: `N*m`, `N m`, `N.m` → `N·m`; `m/s^2`, `m/s2` → `m/s²`; `μ` → `µ`. */
export function normUnit(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[  ]/g, ' ')
    .trim()
    .replace(/μ/g, 'µ')
    .replace(/\s*[*⋅•∙]\s*/g, '·')
    .replace(/\s*·\s*/g, '·')
    .replace(/\^\s*(-?\d)/g, (_, d: string) => [...d].map((c) => SUPER[c] ?? c).join(''))
    .replace(/([A-Za-zµΩ])([23])(?=$|[/·)\s])/g, (_, a: string, d: string) => `${a}${SUPER[d]}`)
    .replace(/([A-Za-zµΩ])\.([A-Za-zµΩ])/g, '$1·$2')
    .replace(/([A-Za-zµΩ])\s+(?=[A-Za-zµΩ])/g, '$1·')
    .replace(/\s+/g, ' ');
}

const SPELLINGS: ReadonlyMap<string, readonly Unit[]> = (() => {
  const out = new Map<string, Unit[]>();
  const add = (key: string, one: Unit) => {
    if (key === '') return;
    const list = out.get(key) ?? [];
    if (!list.includes(one)) list.push(one);
    out.set(key, list);
  };
  for (const one of UNITS) {
    add(one.symbol, one);
    add(normUnit(one.symbol), one);
    add(one.id, one);
    for (const alias of one.aliases ?? []) { add(alias, one); add(normUnit(alias), one); }
  }
  return out;
})();

/**
 * DIE EINHEIT ZU EINER SCHREIBWEISE — genau (Gross- und Kleinschreibung
 * zählen: `mm` ist nicht `Mm`, `KM` nicht `km`); sonst ohne Rücksicht auf sie,
 * wenn es dann genau eine gibt. Auch die Kennungen von QUDT (`N-M`).
 */
export function findUnit(text: string | null | undefined): Unit | undefined {
  if (text == null) return undefined;
  const raw = text.trim();
  if (raw === '') return undefined;
  const exact = SPELLINGS.get(raw) ?? SPELLINGS.get(normUnit(raw));
  if (exact !== undefined && exact.length === 1) return exact[0];
  const low = normUnit(raw).toLowerCase();
  const found = new Set<Unit>();
  for (const [key, list] of SPELLINGS) if (key.toLowerCase() === low) for (const one of list) found.add(one);
  return found.size === 1 ? [...found][0] : undefined;
}

/** Welche Art eine Einheit misst — nur wenn es genau eine ist (für bestehende Einheiten: `kg` → Masse; `N·m` bleibt offen). */
export function guessKind(unitText: string | null | undefined): string | undefined {
  const one = findUnit(unitText);
  return one !== undefined && one.kinds.length === 1 ? one.kinds[0] : undefined;
}

export const measures = (one: Unit, kind: string): boolean => one.kinds.includes(kind);

export const unitsOfKind = (kind: string): readonly Unit[] => UNITS.filter((one) => one.kinds.includes(kind));

/** Die Einheit, in der eine Art ohne weitere Angabe steht: ihre SI-Einheit. */
export const siUnitOf = (kind: string): Unit | undefined => unitById(kindById(kind)?.si);

/* -- Rechnen ------------------------------------------------------------------------------------------- */

/** Zwölf gültige Stellen — damit aus 1,5 kN nicht 1499,9999999998 N wird. */
const tidy = (n: number): number => (Number.isFinite(n) ? Number(n.toPrecision(12)) : n);

export const toSI = (value: number, one: Unit): number => tidy(value * one.factor + (one.offset ?? 0));
export const fromSI = (si: number, one: Unit): number => tidy((si - (one.offset ?? 0)) / one.factor);

/** Von einer Einheit in eine andere derselben Art — `null`, wenn sie nichts gemeinsam haben. */
export function convert(value: number, from: Unit, to: Unit): number | null {
  if (!from.kinds.some((k) => to.kinds.includes(k))) return null;
  return fromSI(toSI(value, from), to);
}

/* -- Lesen und schreiben ------------------------------------------------------------------------------- */

const DIGITS: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };

/**
 * EINE ZAHL MIT EINHEIT, wie man sie tippt: „12 N·m", „12Nm", „1,5 kN",
 * „−3,2e3 J", „1,5·10³ Pa", „12 000 kg", „20 °C", „12" (ohne Einheit).
 * `unit`: die erkannte Einheit; `unitText`: was hinter der Zahl stand (leer:
 * nichts). `null`: keine Zahl.
 */
export function parseQuantity(text: string): { readonly value: number; readonly unit: Unit | undefined; readonly unitText: string } | null {
  const t = text.normalize('NFC').replace(/[  ]/g, ' ').replace(/−/g, '-').trim();
  const m = /^([-+]?\d{1,3}(?:[ ]\d{3})+(?:[.,]\d+)?|[-+]?\d*[.,]?\d+)(?:\s*(?:[eE]([-+]?\d+)|[·×x*]\s*10\s*(?:\^|\*\*)?\s*([-+]?\d+|[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)))?\s*(.*)$/.exec(t);
  if (m === null) return null;
  const mantissa = Number(m[1].replace(/ /g, '').replace(',', '.'));
  const exponent = m[2] !== undefined ? Number(m[2]) : m[3] !== undefined ? Number([...m[3]].map((c) => DIGITS[c] ?? c).join('')) : 0;
  const value = mantissa * 10 ** exponent;
  if (!Number.isFinite(value)) return null;
  const unitText = m[4].trim();
  return { value: tidy(value), unit: unitText === '' ? undefined : findUnit(unitText), unitText };
}

/** Eine Zahl auf Polnisch: Komma, höchstens zwölf Stellen. */
export const numberText = (n: number): string => String(tidy(n)).replace('.', ',');

/** „1,5 kN", „20 °C", „45°", „12 %". */
export function quantityText(value: number, one: Unit | undefined): string {
  const n = numberText(value);
  if (one === undefined || one.symbol === '') return n;
  return /^[°′″]$/.test(one.symbol) ? `${n}${one.symbol}` : `${n} ${one.symbol}`;
}

/** Die Arten in Worten — für eine Meldung („energia (praca, ciepło) albo moment siły"). */
export const kindsText = (kinds: readonly string[]): string => kinds.map((k) => kindById(k)?.label ?? k).join(' albo ');

/* -- Für die Beschreibungen (JSON, KI) ------------------------------------------------------------------- */

/** Die Arten mit ihren Einheiten, kurz: „Torque (moment siły): N·m, mN·m, kN·m". */
export function quantitiesDescription(): string {
  return QUANTITY_KINDS.map((k) => `${k.id} (${k.label}): ${unitsOfKind(k.id).map((one) => one.symbol || '—').join(', ')}`).join('; ');
}
