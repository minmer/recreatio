/**
 * LABOR 2D (v2) — DIE TAFELN DER LEHRWERKZEUGE (Prompt v2, „Interaction and
 * teaching tools“): Inspektor, Blasenansicht, die vier Schreiber, „O tym
 * modelu” und das Entwickler-HUD. Alle lesen denselben Zustand, den der
 * Arbeiter fünfmal je Sekunde schickt — nie Feld- oder Teilchendaten.
 *
 * Zwei Stufen: „podstawowy” (Zustände, Temperatur, einfache Worte) und
 * „rozszerzony” (alle Grössen in SI-Einheiten).
 */

import { useId } from 'react';

import type { ProbeInfo } from './engine/engine';
import type { BubbleView, ChartSample, HostStats } from './engine/protocol';
import { STAGES } from './engine/stages';
import { liquidName, liquidsText, materialName, num, SIMPLIFICATIONS_PL, t, type TextKey } from './i18n';
import type { Overlay } from './render/frame';
import { VIRIDIS } from './render/palette';

export type Level = 'primary' | 'secondary';
const C = (k: number): number => k - 273.15;

function Row({ label, value }: { label: string; value: string }) {
  return <div className="lab-value"><span>{label}</span><output>{value}</output></div>;
}

/** Ein Wort für eine Temperatur auf der Grundstufe („wrze“ nur für Wasser). */
function feel(T: number, Tsat: number, liquid: boolean): string {
  if (liquid && T >= Tsat - 0.3) return t('boiling');
  if (T > 273.15 + 80) return t('veryHot');
  if (T > 273.15 + 50) return t('hot');
  if (T > 273.15 + 30) return t('warm');
  if (T > 273.15 + 15) return t('feelRoom');
  return t('cold');
}

export function Inspector({ info, level }: { info: ProbeInfo; level: Level }) {
  const c = info.cell;
  const salt = c.salt;
  /* Was in der Zelle ist: der Feststoff, das Gas oder die Flüssigkeiten (Wasser mit Salz heisst Sole). */
  const liquid = c.liquids.length === 0 ? t('kindLiquid') : salt !== null && c.liquids.length === 1 ? t('kindBrine') : liquidsText(c.liquids);
  const kind = c.kind === 'solid' ? t('kindSolid') : c.kind === 'liquid' ? liquid : t('kindGas');
  /* In Sole siedet die Flüssigkeit bei T_b der Lösung (höher als T_sat des reinen Wassers). */
  const Tboil = salt !== null ? salt.Tb : c.Tsat;
  if (level === 'primary') {
    return (
      <div className="lab-values">
        <Row label={t('cell')} value={`${kind}${c.material !== null ? ` · ${materialName(c.material)}` : ''}${c.heater ? ` · ${t('heating')}` : ''}`} />
        <Row label={t('temp')} value={`${num(C(c.T), 0)} °C · ${feel(c.T, Tboil, c.kind === 'liquid')}`} />
        {salt !== null && <Row label={t('saltHere')} value={`${num(100 * salt.w, 1)} %`} />}
        <Row label={salt !== null ? t('boilsAt') : t('tsatHere')} value={`${num(C(Tboil), 1)} °C`} />
        {salt !== null && <Row label={t('freezesAt')} value={`${num(C(salt.Tf), 1)} °C`} />}
        {c.crust > 0 && <Row label={t('crust')} value={`${num(c.crust * 1e6, 1)} mg`} />}
        {c.kind === 'gas' && <Row label={t('rh')} value={`${num(100 * Math.min(1, c.rh), 0)} %`} />}
        {c.kind === 'gas' && c.fog > 0 && <Row label={t('fog')} value={`${num(c.fog * 1000, 2)} g/m³`} />}
        {info.bubble !== null && <p className="lab-muted">{t('bubbleHint')}</p>}
      </div>
    );
  }
  return (
    <div className="lab-values">
      <Row label={t('cell')} value={`${kind}${c.material !== null ? ` (${materialName(c.material)})` : ''}${c.kind !== 'liquid' && c.liquids.length > 0 ? ` · ${liquidsText(c.liquids)}` : ''}${c.heater ? ` · ${t('heating')}` : ''}`} />
      <Row label={t('temp')} value={`${num(C(c.T), 2)} °C`} />
      <Row label={t('absPressure')} value={`${num(c.p / 1000, 3)} kPa`} />
      <Row label={t('tsatHere')} value={`${num(C(c.Tsat), 3)} °C`} />
      {salt !== null && (
        <>
          <Row label={t('saltHere')} value={`${num(100 * salt.w, 2)} % · ${t('molality')} ${num(salt.molality, 3)} mol/kg`} />
          <Row label={t('boilsAt')} value={`${num(C(salt.Tb), 3)} °C`} />
          <Row label={t('freezesAt')} value={`${num(C(salt.Tf), 2)} °C`} />
        </>
      )}
      <Row label={t('density')} value={`${num(c.rho, c.rho < 10 ? 4 : 1)} kg/m³`} />
      <Row label={t('velocity')} value={`${num(Math.hypot(c.u, c.v) * 100, 2)} cm/s`} />
      {c.kind === 'gas' && <Row label={t('composition')} value={`N₂ ${num(100 * c.x[0], 1)} %, O₂ ${num(100 * c.x[1], 1)} %, H₂O ${num(100 * c.x[2], 2)} % (mol)`} />}
      {c.kind === 'gas' && <Row label={t('rh')} value={`${num(100 * c.rh, 1)} %`} />}
      {c.kind === 'gas' && <Row label={t('fog')} value={`${num(c.fog * 1000, 3)} g/m³`} />}
      {c.film > 0 && <Row label={t('film')} value={`${num(c.film * 1e6, 3)} mg`} />}
      {c.crust > 0 && <Row label={t('crust')} value={`${num(c.crust * 1e6, 3)} mg`} />}
      {info.particle !== null && (
        <>
          <Row label={t('particle')} value={`${liquidName(info.particle.liquid)}${info.particle.salt > 0 ? ` · ${t('saltWord')} ${num(100 * info.particle.salt, 2)} %` : ''} · ${num(C(info.particle.T), 2)} °C · ${num(info.particle.mass * 1e6, 3)} mg`} />
          <Row label={t('velocity')} value={`${num(Math.hypot(info.particle.vx, info.particle.vy) * 100, 2)} cm/s · ρ ${num(info.particle.rho, 1)} kg/m³`} />
        </>
      )}
    </div>
  );
}

/** Die Kräfte der gewählten Blase: Auftrieb (−V∇p), Gewicht, Widerstand, virtuelle Masse — als (x, y). */
export function forcesOf(b: BubbleView): { key: 'fBuoyancy' | 'fWeight' | 'fDrag' | 'fAdded'; x: number; y: number }[] {
  const f = b.force;
  return [
    { key: 'fBuoyancy', x: f[0], y: f[1] },
    { key: 'fWeight', x: f[2], y: f[3] },
    { key: 'fDrag', x: f[4], y: f[5] },
    { key: 'fAdded', x: f[6], y: f[7] }
  ];
}

const FATE: Readonly<Record<NonNullable<BubbleView['fate']>, TextKey>> = { burst: 'fateBurst', collapsed: 'fateCollapsed', merged: 'fateMerged' };

export function BubblePanel({ b, level }: { b: BubbleView | null; level: Level }) {
  if (b === null) return <p className="lab-muted">{t('bubbleHint')}</p>;
  const forces = forcesOf(b);
  const buoy = Math.hypot(forces[0].x, forces[0].y);
  const weight = Math.hypot(forces[1].x, forces[1].y);
  const ratio = weight > 0 ? buoy / weight : 0;
  const fate = b.fate === null ? null : <p className="l2d-fate" role="status">{t(FATE[b.fate])}</p>;
  if (level === 'primary') {
    return (
      <div className="lab-values">
        {fate}
        <Row label={t('diameter')} value={`${num(2 * b.r * 1000, 2)} mm`} />
        <Row label={t('temp')} value={`${num(C(b.T), 1)} °C`} />
        <p className="lab-text">{b.attached ? t('attached') : t('free')}</p>
        {ratio > 0 && <p className="lab-text">{t('buoyancyRatio').replace('{x}', num(ratio, 0))}</p>}
        <p className="lab-muted">{t('whyRise')}</p>
      </div>
    );
  }
  return (
    <div className="lab-values">
      {fate}
      <Row label={t('radius')} value={`${num(b.r * 1000, 3)} mm`} />
      <Row label={t('vapourMass')} value={`${num(b.mv * 1e9, 3)} µg`} />
      {b.ma > 0 && <Row label={t('airMass')} value={`${num(b.ma * 1e9, 3)} µg`} />}
      <Row label={t('innerPressure')} value={`${num(b.pb / 1000, 3)} kPa`} />
      <Row label={t('tsatInside')} value={`${num(C(b.Tsat), 3)} °C`} />
      <Row label={t('growth')} value={`${num(b.dmdt * 1e9, 3)} µg/s`} />
      <Row label={t('velocity')} value={`${num(Math.hypot(b.vx, b.vy) * 100, 2)} cm/s`} />
      {forces.map((f) => <Row key={f.key} label={t(f.key)} value={`${num(Math.hypot(f.x, f.y) * 1e6, 3)} µN`} />)}
      {ratio > 0 && <p className="lab-text">{t('buoyancyRatio').replace('{x}', num(ratio, 0))}</p>}
    </div>
  );
}

interface Series { readonly key: TextKey; readonly cls: string; readonly values: readonly number[] }

/** Ein Schreiber: Linien über der Zeit, Grenzen beschriftet. */
function LineChart({ title, times, series, unit, digits }: { title: string; times: readonly number[]; series: readonly Series[]; unit: string; digits: number }) {
  const W = 300;
  const H = 120;
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of series) for (const v of s.values) { if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
  if (!Number.isFinite(lo) || times.length < 2) return <p className="lab-muted">{title}: —</p>;
  if (hi - lo < 1e-12) { hi += 1; lo -= 1; }
  const t0 = times[0];
  const t1 = times[times.length - 1];
  const x = (tt: number): number => (W * (tt - t0)) / Math.max(1e-9, t1 - t0);
  const y = (v: number): number => H - 4 - ((H - 8) * (v - lo)) / (hi - lo);
  return (
    <figure className="l2d-chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {series.map((s) => (
          <polyline key={s.key} className={`l2d-line ${s.cls}`} points={s.values.map((v, k) => `${x(times[k]).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} />
        ))}
        <text className="l2d-axis" x="2" y="10">{num(hi, digits)} {unit}</text>
        <text className="l2d-axis" x="2" y={H - 2}>{num(lo, digits)} {unit}</text>
        <text className="l2d-axis" x={W - 2} y={H - 2} textAnchor="end">{num(t1, 0)} s</text>
      </svg>
      <div className="l2d-legend">{series.map((s) => <span key={s.key} className={s.cls}>{t(s.key)}</span>)}</div>
    </figure>
  );
}

export function Charts({ samples, level }: { samples: readonly ChartSample[]; level: Level }) {
  const times = samples.map((s) => s.t);
  const temp = (
    <LineChart title={t('chartTemp')} times={times} unit="°C" digits={1} series={[
      { key: 'tWater', cls: 'l2d-s0', values: samples.map((s) => C(s.waterT)) },
      { key: 'tMax', cls: 'l2d-s1', values: samples.map((s) => C(s.waterTmax)) },
      { key: 'tSat', cls: 'l2d-s2', values: samples.map((s) => C(s.Tsat)) }
    ]} />
  );
  if (level === 'primary') return temp;
  return (
    <>
      {temp}
      <LineChart title={t('chartEnergy')} times={times} unit="kJ" digits={2} series={[
        { key: 'eHeater', cls: 'l2d-s0', values: samples.map((s) => s.heater / 1000) },
        { key: 'eSensible', cls: 'l2d-s1', values: samples.map((s) => s.sensible / 1000) },
        { key: 'eLatent', cls: 'l2d-s2', values: samples.map((s) => s.latent / 1000) },
        { key: 'eLosses', cls: 'l2d-s3', values: samples.map((s) => s.losses / 1000) },
        { key: 'eEscaped', cls: 'l2d-s4', values: samples.map((s) => s.escaped / 1000) }
      ]} />
      <LineChart title={t('chartWater')} times={times} unit="g" digits={3} series={[
        { key: 'wLiquid', cls: 'l2d-s0', values: samples.map((s) => s.liquid * 1000) },
        { key: 'wVapour', cls: 'l2d-s1', values: samples.map((s) => s.vapour * 1000) },
        { key: 'wFog', cls: 'l2d-s2', values: samples.map((s) => s.fog * 1000) },
        { key: 'wFilm', cls: 'l2d-s3', values: samples.map((s) => s.film * 1000) },
        { key: 'wBubbles', cls: 'l2d-s4', values: samples.map((s) => s.bubbles * 1000) },
        { key: 'wEscaped', cls: 'l2d-s5', values: samples.map((s) => s.escapedWater * 1000) }
      ]} />
      <LineChart title={t('chartVapour')} times={times} unit="mg/s" digits={2} series={[
        { key: 'vMeasured', cls: 'l2d-s0', values: samples.map((s) => s.vapourRate * 1e6) },
        { key: 'vExpected', cls: 'l2d-s1', values: samples.map((s) => s.expectedRate * 1e6) }
      ]} />
    </>
  );
}

export function About({ level }: { level: Level }) {
  return (
    <div className="lab-section-body">
      <p className="lab-text">{t('aboutLead')}</p>
      <ol className="l2d-about">
        {SIMPLIFICATIONS_PL.map((s) => (
          <li key={s.title}><strong>{s.title}.</strong> {level === 'primary' ? s.primary : s.secondary}</li>
        ))}
      </ol>
    </div>
  );
}

/** Zahl mit zwei geltenden Stellen (für die Enden einer Skala). */
function short(x: number): string {
  const a = Math.abs(x);
  return num(x, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
}

const PHASE_KEYS: readonly { readonly key: TextKey; readonly cls: string }[] = [
  { key: 'phaseWater', cls: 'l2d-sw-water' }, { key: 'phaseGas', cls: 'l2d-sw-gas' },
  { key: 'phaseSolid', cls: 'l2d-sw-solid' }, { key: 'phaseBubbles', cls: 'l2d-sw-bubbles' }
];

/** Die Legende der Einblendung: Farbskala mit Anfang und Ende (aus dem letzten Bild) oder die Farben der Mapa stanów. */
export function Legend({ overlay, scale }: { overlay: Overlay; scale: readonly [number, number, number] }) {
  const id = useId();
  if (overlay === 'none') return null;
  if (overlay === 'phase') {
    return (
      <div className="l2d-legend-box" aria-hidden="true">
        <strong>{t('ovPhase')}</strong>
        <div className="l2d-swatches">{PHASE_KEYS.map((k) => <span key={k.key} className={k.cls}>{t(k.key)}</span>)}</div>
      </div>
    );
  }
  const [lo, hi] = scale;
  const blue = overlay === 'humidity' || overlay === 'vapour';
  const title = overlay === 'temperature' ? t('ovTemperature') : overlay === 'pressure' ? t('legendPressure') : overlay === 'velocity' ? t('legendVelocity') : overlay === 'humidity' ? t('ovHumidity') : overlay === 'salt' ? t('legendSalt') : t('legendVapour');
  const ends: readonly [string, string] = overlay === 'temperature' ? [`${num(lo - 273.15, 0)} °C`, `${num(hi - 273.15, 0)} °C`]
    : overlay === 'pressure' ? [`${short(lo)} Pa`, `+${short(hi)} Pa`]
    : overlay === 'velocity' ? ['0', `${short(hi * 100)} cm/s`]
    : overlay === 'humidity' ? ['0 %', '100 %']
    : overlay === 'salt' ? ['0 %', `${num(100 * hi, 0)} %`]
    : ['0', `${num(hi * 1000, 0)} g/m³`];
  return (
    <div className="l2d-legend-box" aria-hidden="true">
      <strong>{title}</strong>
      <svg viewBox="0 0 100 8" preserveAspectRatio="none">
        <defs>
          <linearGradient id={id}>
            {blue
              ? <><stop offset="0" stopColor="#286edc" stopOpacity="0" /><stop offset="1" stopColor="#286edc" stopOpacity="0.86" /></>
              : VIRIDIS.map((c, k) => <stop key={k} offset={k / (VIRIDIS.length - 1)} stopColor={`rgb(${c[0]},${c[1]},${c[2]})`} />)}
          </linearGradient>
        </defs>
        <rect width="100" height="8" fill={`url(#${id})`} />
      </svg>
      <div className="l2d-legend-ends"><span>{ends[0]}</span><span>{ends[1]}</span></div>
      {overlay === 'velocity' && <span>{t('arrowsNote').replace('{g}', short(scale[1] * 100)).replace('{w}', short(scale[2] * 100))}</span>}
    </div>
  );
}

export function Hud({ stats }: { stats: HostStats }) {
  const e = stats.engine;
  const lines = [
    `${e.nx}×${e.ny} · Δx ${num(e.dx * 1000, 1)} mm · ${e.particles} ${t('particles')} · ${e.bubbles} ${t('bubbles')} · Δt ${num(e.dt * 1000, 2)} ms`,
    `${Math.round(stats.stepsPerSecond)} ${t('stepsPerSecond')} · ${t('simRate')} ${num(stats.simRate, 2)}× · ${Math.round(stats.fps)} ${t('fps')} · ${stats.mode === 'gpu' ? `${t('renderGpu')}${stats.adapter ? ` · ${stats.adapter}` : ''}` : `${stats.mode === 'worker' ? t('renderWorker') : t('renderMain')} ${num(stats.renderMs, 2)} ms`}`,
    ...STAGES.map((name, k) => `${name.padEnd(12)} ${(e.stages[k] ?? 0).toFixed(3)} ms`),
    `${t('hudStep').padEnd(12)} ${e.stepMs.toFixed(3)} ms · frame ${(2 * e.stepMs).toFixed(2)} ms`,
    `CG ${e.liquid.iterations}/${e.gas.iterations}/${e.heat.iterations}${e.capped > 0 ? ` · cap ${e.capped}` : ''} · sub ${e.gasSubsteps}`,
    `${t('budget')}: E ${e.energyError.toExponential(1)} J · H₂O ${e.waterError.toExponential(1)} kg${e.saltMass > 0 || e.saltSolid > 0 ? ` · NaCl ${e.saltError.toExponential(1)} kg` : ''}`
  ];
  return <div className="l2d-hud" aria-hidden="true">{lines.join('\n')}</div>;
}
