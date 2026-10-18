/**
 * 2026-10-18 — GAS, DAMPF, WÄRME (Chemia): was zwischen Flüssigkeit, Gas,
 * Zimmer und Brenner hin- und hergeht.
 *
 *   Henry       CO₂, NH₃, SO₂ lösen sich und entweichen (übersättigt: Bläschen) —
 *               heisse Limonade verliert ihr CO₂; HCl und NO₂ werden geschluckt.
 *   Zimmer      ein offenes Gefäss gibt Überdruck ab und tauscht mit der Luft —
 *               Wasserstoff ist schnell fort, CO₂ bleibt lange im Becherglas (es ist
 *               schwerer), heisse Flammengase steigen hinaus.
 *   Dampf       Verdunsten nach dem Dampfdruck (Antoine, Raoult: Salzwasser
 *               verdunstet langsamer und kocht später); Kochen hält die Temperatur,
 *               im verschlossenen Gefäss steigt mit dem Druck der Siedepunkt.
 *   Eis         schmilzt, mit Salz unter 0 °C.
 *   Wärme       der Brenner gibt, das Zimmer nimmt (Newton).
 *   Bewegung    was fällt, schwimmt oben (Natrium fährt herum), Niederschlag setzt sich.
 */

import { AIR, GASES, HENRY, POOLS, SPECIES, type GasId } from './chemData';
import type { Vessel } from './chemVessel';

const R = 8.314;
const dHf = (id: string): number => (SPECIES[id]?.dHf ?? 0) * 1000;
const H_VAP = dHf('H2O(g)') - dHf('H2O');
const M_AIR = 28.96;

export interface Room {
  readonly T: number;
  readonly p: number;
}

/** Dampfdruck des Wassers (kPa) bei T (K) — Antoine. */
export function pvap(T: number): number {
  const c = T - 273.15;
  const [a, b, d] = c <= 100 ? [8.07131, 1730.63, 233.426] : [8.14019, 1810.94, 244.485];
  return 10 ** (a - b / (d + Math.max(-60, c))) * 0.133322;
}

/** Wie viel der Teilchen in der Flüssigkeit Wasser sind (Raoult). */
export function waterShare(v: Vessel): number {
  let other = 0;
  for (const [id, n] of v.aq) if (!id.startsWith('ind:') && id !== 'soap') other += n;
  return v.water / Math.max(1e-12, v.water + other);
}

/** Molalität der gelösten Teilchen (mol/kg Wasser) — für den Schmelzpunkt. */
function molality(v: Vessel): number {
  let other = 0;
  for (const [id, n] of v.aq) if (!id.startsWith('ind:')) other += n;
  return other / Math.max(1e-9, v.water * 0.018015);
}

/* -- Gase und Flüssigkeit ----------------------------------------------------------------------- */

export function henryStep(v: Vessel, dt: number, t: number, room: Room): void {
  if (!v.wet()) return;
  const V = v.liters();
  const atm = v.pressure(room.p) / 101.325;
  const nTot = v.gasTotal();
  const r = v.shape.halfWidth(v.level());
  const A = Math.PI * r * r * (v.spray > 0 ? 25 : 1);
  const stir = 1 + (v.stir > 0 ? 3 : 0) + Math.min(6, v.fx.boil * 60);
  const sites = v.lumps.some((l) => l.where === 'in' && l.form !== 'precipitate') ? 2 : 1;
  const gasMl = Math.max(1, v.gasMl());
  /* Bläschen entstehen nur, wenn das Gelöste zusammen mehr Druck hätte als draussen ist (Sprudel ja, Salmiakgeist nein). */
  const kh = (pool: (typeof POOLS)[number]): number => {
    const henry = pool.gas === null ? undefined : HENRY[pool.gas];
    if (henry === undefined || pool.gas === null) return 0;
    return henry.k * Math.exp((-(dHf(pool.forms[pool.neutral]) - dHf(pool.gas)) / R) * (1 / v.T - 1 / 298.15));
  };
  const neutral = (pool: (typeof POOLS)[number]): number => ((v.aq.get(pool.id) ?? 0) / V) * (v.spec.alpha[pool.id][pool.neutral] ?? 0);
  let inside = (waterShare(v) * pvap(v.T)) / 101.325;
  for (const pool of POOLS) { const k = kh(pool); if (k > 0) inside += neutral(pool) / k; }
  const nucleate = Math.min(1, Math.max(0, (inside / atm - 1.05) / 0.3));
  for (const pool of POOLS) {
    if (pool.gas === null) continue;
    const KH = kh(pool);
    if (KH <= 0) continue;
    const ng = v.gas.get(pool.gas) ?? 0;
    const ceq = nTot > 0 ? (KH * atm * ng) / nTot : 0;
    const total = v.aq.get(pool.id) ?? 0;
    const cn = neutral(pool);
    if (ng <= 0 && cn <= 0) continue;
    let flux = (0.004 * stir * A * (ceq - cn)) / 1000;
    if (flux > 0) flux = Math.min(flux, (ng * (1 - Math.exp((-0.5 * A * stir * dt) / gasMl))) / dt);
    let bub = 0;
    if (nucleate > 0 && cn > ceq) bub = 0.35 * V * (cn - ceq) * sites * stir * nucleate;
    void total;
    let dn = (flux - bub) * dt;
    if (dn < 0) dn = Math.max(dn, -cn * V * 0.8);
    if (dn > 0) dn = Math.min(dn, ng);
    if (Math.abs(dn) < 1e-16) continue;
    v.addAq(pool.id, dn);
    v.addGas(pool.gas, -dn);
    if (bub > 0) {
      v.fx.bulk += bub;
      if (bub * dt > 1e-7) v.say(`gas:${pool.gas}`, pool.gas === 'CO2' ? 'Wydziela się gaz — pęcherzyki tlenku węgla(IV).' : pool.gas === 'NH3' ? 'Wydziela się amoniak — gaz o ostrym zapachu.' : 'Wydziela się tlenek siarki(IV).', t);
    }
  }
  /* Was sich ganz löst: Chlorwasserstoff, Stickstoffdioxid. */
  for (const g of ['HCl(g)', 'NO2'] as const) {
    const ng = v.gas.get(g) ?? 0;
    if (ng <= 1e-14) continue;
    const dn = ng * (1 - Math.exp((-0.5 * A * stir * dt) / gasMl));
    v.addGas(g, -dn);
    if (g === 'HCl(g)') v.addAq('Cl-', dn); else {
      v.addAq('NO3-', (2 * dn) / 3);
      v.addGas('NO', dn / 3);
      v.water = Math.max(0, v.water - dn / 3);
    }
  }
  v.respeciate();
}

/* -- Das Zimmer --------------------------------------------------------------------------------- */

const molar = (g: GasId): number => SPECIES[g]?.M ?? 29;

export function roomStep(v: Vessel, dt: number, room: Room): void {
  if (v.closed || v.kind === 'syringe') return;
  const nEq = (room.p * (v.gasMl() / 1000)) / (R * v.T);
  let nTot = v.gasTotal();
  if (nTot > nEq * 1.0000001) {
    const f = 1 - nEq / nTot;
    for (const [g, n] of [...v.gas]) v.exchange(g, -n * f);
  } else if (nTot < nEq) {
    const add = nEq - nTot;
    for (const g of GASES) { const x = AIR[g] ?? 0; if (x > 0) v.exchange(g, add * x); }
  }
  nTot = v.gasTotal();
  if (nTot <= 0) return;
  let M = 0;
  for (const [g, n] of v.gas) M += (n / nTot) * molar(g);
  const hot = v.lumps.some((l) => l.burning) || v.burning ? 400 : 0;
  const r = (M / M_AIR) * (room.T / (v.T + hot));
  const buoy = r < 1 ? 1 + 25 * (1 - r) : Math.max(0.04, 1 - 3 * (r - 1));
  const k = 0.02 * v.type.mouth ** 2 * buoy * (1 + Math.min(4, v.fx.bulk * 200));
  const f = 1 - Math.exp(-k * dt);
  for (const g of GASES) {
    const n = v.gas.get(g) ?? 0;
    const target = nTot * (AIR[g] ?? 0);
    if (n === 0 && target === 0) continue;
    v.exchange(g, (target - n) * f);
  }
}

/* -- Dampf --------------------------------------------------------------------------------------- */

export function evaporateStep(v: Vessel, dt: number, room: Room): void {
  const nTot = v.gasTotal();
  const p = v.pressure(room.p);
  const vap = v.gas.get('H2O(g)') ?? 0;
  const pH2O = nTot > 0 ? (p * vap) / nTot : 0;
  const peq = v.wet() ? waterShare(v) * pvap(v.T) : 0;
  const r = v.shape.halfWidth(v.level());
  const A = peq > pH2O ? Math.PI * r * r : Math.max(Math.PI * r * r, Math.PI * v.shape.R * v.shape.H * 0.6);
  let flux = (0.8 * A * (peq - pH2O)) / (R * v.T) / 1000;
  if (flux > 0) flux = Math.min(flux, v.water / dt);
  else flux = Math.max(flux, -vap / dt * 0.5);
  if (flux === 0 || !Number.isFinite(flux)) return;
  v.water -= flux * dt;
  v.addGas('H2O(g)', flux * dt);
  if (flux > 0 && v.T > 318) v.fx.steam += flux;
}

/** Nach der Wärme: höher als der Siedepunkt geht es nicht — der Überschuss verdampft Wasser. */
export function boilStep(v: Vessel, dt: number, t: number, room: Room): void {
  if (!v.wet()) return;
  const pExt = v.pressure(room.p);
  const xw = waterShare(v);
  if (xw * pvap(v.T) < pExt) return;
  let lo = 250;
  let hi = v.T;
  for (let i = 0; i < 36; i += 1) {
    const mid = (lo + hi) / 2;
    if (xw * pvap(mid) < pExt) lo = mid; else hi = mid;
  }
  const Tb = (lo + hi) / 2;
  const n = Math.min(v.water, (v.capacity() * (v.T - Tb)) / H_VAP);
  v.water -= n;
  v.addGas('H2O(g)', n);
  v.T = Tb;
  v.fx.boil += n / dt;
  v.fx.steam += n / dt;
  v.say('boil', `Ciecz wrze w temperaturze ${(Tb - 273.15).toFixed(1).replace('.', ',')} °C.`, t);
}

/* -- Eis ------------------------------------------------------------------------------------------- */

export function iceStep(v: Vessel, dt: number, t: number): void {
  for (const l of v.lumps) {
    if (l.sp !== 'ice' || l.n <= 0) continue;
    const Tm = 273.15 - 1.86 * molality(v);
    if (v.T <= Tm) continue;
    const e = Math.min(l.n, (0.03 * l.area() * (v.T - Tm) * dt * (v.stir > 0 ? 3 : 1)) / 6010);
    l.n -= e;
    v.water += e;
    if (Tm < 272) v.say('ice-salt', 'Lód topi się w roztworze soli — temperatura spada poniżej 0 °C.', t);
  }
}

/* -- Wärme ---------------------------------------------------------------------------------------- */

/** Was der Brenner gibt (W) — blaue Flamme heisser als die gelbe. */
export const burnerPower = (T: number, air: boolean): number => Math.max(0, 0.35 * ((air ? 1350 : 1050) - T));

export function heatStep(v: Vessel, dt: number, room: Room, flame: { air: boolean } | null): void {
  let P = flame === null ? 0 : burnerPower(v.T, flame.air);
  const d = v.T - room.T;
  P -= 0.0059 * v.size ** (2 / 3) * d * (1 + Math.abs(d) / 800);
  v.qIn += P * dt;
}

/* -- Überlaufen, Bewegung, Absetzen ------------------------------------------------------------------- */

export function spillStep(v: Vessel, t: number): void {
  const over = v.liquidMl() + v.solidsMl() * 0.6 - v.shape.full;
  if (over <= 0.05 || v.liquidMl() <= 0) return;
  v.take(Math.min(1, over / v.liquidMl()), false);
  v.fx.spill += over;
  v.say('spill', 'Ciecz przelewa się przez brzeg naczynia.', t);
}

export function moveLumps(v: Vessel, dt: number): void {
  const level = v.level();
  const rhoL = v.density();
  for (const l of v.lumps) {
    if (l.where === 'spoon') { l.x = 0; l.y = v.shape.H * 0.72; continue; }
    if (l.form === 'candle') { l.x = 0; l.y = 0; continue; }
    const rho = SPECIES[l.sp]?.rho ?? 2;
    const floats = v.wet() && level > 0.2 && rho < rhoL && l.form !== 'precipitate' && l.form !== 'powder';
    const target = floats ? Math.max(0, level - 0.18) : 0;
    const inLiquid = l.y < level;
    if (l.y > target + 0.005) {
      const was = l.y;
      l.vy = Math.max(inLiquid ? -9 : -260, l.vy - (inLiquid ? 40 : 981) * dt);
      l.y = Math.max(target, l.y + l.vy * dt);
      if (was >= level && l.y < level && v.wet()) v.fx.splash += Math.min(3, l.mass() + 0.3);
      if (l.y <= target) l.vy = 0;
    } else if (l.y < target - 0.005) {
      l.y = Math.min(target, l.y + 5 * dt);
      l.vy = 0;
    } else { l.y = target; l.vy = 0; }
    const room = 0.82;
    if (floats && l.gas > 0) {
      l.vx += (Math.random() - 0.5) * Math.min(60, l.gas * 6e4) * dt;
      l.vx *= Math.exp(-dt * 1.5);
    } else l.vx *= Math.exp(-dt * 6);
    l.x += l.vx * dt * 0.35;
    if (l.x > room) { l.x = room; l.vx = -Math.abs(l.vx); }
    if (l.x < -room) { l.x = -room; l.vx = Math.abs(l.vx); }
  }
}

export function settleStep(v: Vessel, dt: number): void {
  for (const l of v.lumps) {
    if (l.form !== 'precipitate') continue;
    if (!v.wet()) l.suspended = 0;
    else if (v.stir > 0 || v.fx.boil > 0.002) l.suspended = Math.max(l.suspended, 0.7);
    else l.suspended *= Math.exp(-dt / 7);
  }
  v.foam *= Math.exp(-dt / 25);
  if (v.foam < 0.05) v.foam = 0;
  v.stir = Math.max(0, v.stir - dt);
  v.spray = Math.max(0, v.spray - dt);
}
