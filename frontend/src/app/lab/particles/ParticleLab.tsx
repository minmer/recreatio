/**
 * PARTIKEL-LABOR — DIE OBERFLÄCHE (React): Rahmen, Werkzeuge, Palette,
 * Inspektor und Entwickler-HUD um die Bühne. Die Engine läuft im Arbeiter
 * (`host.ts`, `engine.worker.ts`); in React stehen nur Einstellungen und die
 * Kennzahlen, die der Arbeiter fünfmal je Sekunde schickt — nie Partikeln.
 *
 * Die Leinwand entsteht im Effekt selbst (nicht im JSX): eine Leinwand lässt
 * sich nur einmal an einen Arbeiter übergeben, und React ruft Effekte im
 * StrictMode zweimal auf.
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { Icon, type IconName } from '../../ui/icons';
import { LabFrame } from '../LabFrame';
import type { ParticleInfo } from './engine/engine';
import type { HostStats } from './engine/protocol';
import { readScene, writeScene, type Op, type Quality } from './engine/scene';
import { phaseColor, spIndex } from './engine/species';
import { STAGES } from './engine/stages';
import { GAS, LIQUID, SOLID, T0 } from './engine/units';
import { ParticleHost } from './host';
import { num, t, type TextKey } from './i18n';
import { createEngineWorker } from './workerFactory';

import './particles.css';

export interface ParticleConfig {
  readonly title: string;
  readonly text: readonly string[];
  readonly scene: unknown;
}

type Tool = 'paint' | 'erase' | 'place' | 'wall' | 'inspect';
type ApparatusKey = 'beaker' | 'hotplate';

interface Material {
  readonly key: string;
  readonly label: TextKey;
  /** Werkstoff fester Partikeln — oder `null`: ein Fluid der Zusammensetzung `composition`. */
  readonly solid: string | null;
  readonly composition: Readonly<Record<string, number>>;
  readonly phase: 'liquid' | 'gas';
  readonly color: string;
}

const MATERIALS: readonly Material[] = [
  { key: 'water', label: 'matWater', solid: null, composition: { H2O: 1 }, phase: 'liquid', color: phaseColor(spIndex('H2O'), LIQUID) },
  { key: 'air', label: 'matAir', solid: null, composition: { N2: 0.7676, O2: 0.2324 }, phase: 'gas', color: phaseColor(spIndex('N2'), GAS) },
  { key: 'glass', label: 'matGlass', solid: 'glass', composition: {}, phase: 'liquid', color: phaseColor(spIndex('glass'), SOLID) },
  { key: 'steel', label: 'matSteel', solid: 'steel', composition: {}, phase: 'liquid', color: phaseColor(spIndex('steel'), SOLID) },
  { key: 'chips', label: 'matChips', solid: 'ceramic', composition: {}, phase: 'liquid', color: phaseColor(spIndex('ceramic'), SOLID) }
];

const TOOLS: readonly { readonly key: Tool; readonly label: TextKey; readonly icon: IconName; readonly hint: TextKey }[] = [
  { key: 'paint', label: 'toolPaint', icon: 'edit', hint: 'hintPaint' },
  { key: 'erase', label: 'toolErase', icon: 'x', hint: 'hintErase' },
  { key: 'place', label: 'toolPlace', icon: 'plus', hint: 'hintPlace' },
  { key: 'wall', label: 'toolWall', icon: 'minus', hint: 'hintWall' },
  { key: 'inspect', label: 'toolInspect', icon: 'search', hint: 'hintInspect' }
];

const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4, 8];
const QUALITIES: readonly { readonly key: Quality; readonly label: TextKey }[] = [
  { key: 'low', label: 'qualityLow' },
  { key: 'medium', label: 'qualityMedium' },
  { key: 'high', label: 'qualityHigh' }
];

/** Ein Gerät an der Stelle (x, y): Mitte und Unterkante; dicht über dem Boden steht es auf ihm. */
function apparatusOp(kind: ApparatusKey, x: number, y: number): Op {
  const yy = y < 0.015 ? 0 : y;
  return kind === 'beaker'
    ? { op: 'beaker', x, y: yy, w: 0.07, h: 0.09, wall: 0.0025, material: 'glass', T: T0 + 20 }
    : { op: 'hotplate', x, y: yy, w: 0.16, h: 0.012, material: 'steel', T: T0 + 20, mode: 'power', power: 50, target: T0 + 150, on: true };
}

function Swatch({ color }: { color: string }) {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill={color} stroke="currentColor" strokeOpacity="0.35" /></svg>;
}

function ApparatusIcon({ kind }: { kind: ApparatusKey }) {
  return kind === 'beaker'
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v17h12V3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M7 12h10v7H7z" fill="#3d8fd8" opacity="0.6" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="14" width="20" height="6" rx="1" fill="#7d858e" /><path d="M6 17h12" stroke="#e8823a" strokeWidth="2" /></svg>;
}

function Inspector({ info }: { info: ParticleInfo }) {
  const phase = info.phase === SOLID ? t('phaseSolid') : info.phase === LIQUID ? t('phaseLiquid') : t('phaseGas');
  return (
    <div className="lab-values">
      <div className="lab-value"><span>{t('phase')}</span><output>{phase}{info.fixed ? ` · ${t('fixed')}` : ''}{info.role === 1 ? ` · ${t('heater')}` : ''}</output></div>
      <div className="lab-value"><span>{t('temp')}</span><output>{num(info.T - T0, 1)} °C</output></div>
      <div className="lab-value"><span>{t('mass')}</span><output>{num(info.mass * 1e6, 2)} mg</output></div>
      <div className="lab-value"><span>{t('velocity')}</span><output>{num(Math.hypot(info.vx, info.vy) * 100, 1)} cm/s</output></div>
      <div className="lab-value"><span>{t('density')}</span><output>{num(info.rho, info.rho < 10 ? 3 : 1)} kg/m³</output></div>
      <div className="lab-value"><span>{t('enthalpy')}</span><output>{num(info.H / 1000, 1)} kJ/kg</output></div>
      <div className="lab-value"><span>{t('neighbours')}</span><output>{info.neighbours}</output></div>
      <div className="lab-value"><span>{t('composition')}</span><output>{info.composition.map((c) => `${c.name} ${num(c.fraction * 100, 0)} %`).join(', ')}</output></div>
    </div>
  );
}

function Hud({ stats }: { stats: HostStats }) {
  const e = stats.engine;
  const lines = [
    `${e.particles} ${t('particles')} (${t('liquid')} ${e.liquid}, ${t('gas')} ${e.gas}, ${t('solidFixed')} ${e.fixed}) / ${e.capacity}`,
    `${Math.round(stats.stepsPerSecond)} ${t('stepsPerSecond')} · ${t('simRate')} ${num(stats.simRate, 2)}× · ${Math.round(stats.fps)} ${t('fps')}`,
    `${stats.mode === 'worker' ? t('renderWorker') : t('renderMain')} · render ${num(stats.renderMs, 2)} ms · s = ${num(e.spacing * 1000, 1)} mm`,
    ...STAGES.map((name, k) => `${name.padEnd(12)} ${(e.stages[k] ?? 0).toFixed(3)} ms`),
    `${'step'.padEnd(12)} ${e.stages.reduce((a, b) => a + b, 0).toFixed(3)} ms${e.overflow > 0 ? ` · overflow ${e.overflow}` : ''}`
  ];
  return <div className="pl-hud" aria-hidden="true">{lines.join('\n')}</div>;
}

export function ParticleLab({ config, whole = false, createWorker = createEngineWorker }: {
  config: ParticleConfig;
  /** Steht schon im ganzen Fenster der Seite. */
  whole?: boolean;
  /** Der Arbeiter (der Prüfstand ohne Vite reicht einen eigenen herein). */
  createWorker?: () => Worker;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<ParticleHost | null>(null);
  const drag = useRef<{ start: [number, number]; startPx: [number, number]; last: [number, number]; at: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<HostStats | null>(null);
  const [paused, setPaused] = useState(false);
  const [speedAt, setSpeedAt] = useState(3);
  const [hud, setHud] = useState(false);
  const [tool, setTool] = useState<Tool>('paint');
  const [material, setMaterial] = useState('water');
  const [apparatus, setApparatus] = useState<ApparatusKey>('beaker');
  const [brushMm, setBrushMm] = useState(8);
  const [tempC, setTempC] = useState(20);
  const [quality, setQuality] = useState<Quality>(() => readScene(config.scene).scene.quality);
  const [showAir, setShowAir] = useState(true);
  const [info, setInfo] = useState<ParticleInfo | null | undefined>(undefined);
  const [line, setLine] = useState<readonly [number, number, number, number] | null>(null);
  const airRef = useRef(showAir);
  airRef.current = showAir;

  useEffect(() => {
    const box = boxRef.current;
    if (box === null) return undefined;
    const canvas = document.createElement('canvas');
    canvas.className = 'pl-canvas';
    box.prepend(canvas);
    setError(null);
    const host = new ParticleHost(canvas, createWorker, { onReady: () => setReady(true), onStats: setStats, onError: setError });
    hostRef.current = host;
    const r = box.getBoundingClientRect();
    void host.start(config.scene, airRef.current, r.width, r.height, window.devicePixelRatio || 1);
    const ro = new ResizeObserver(() => {
      const q = box.getBoundingClientRect();
      host.resize(q.width, q.height, window.devicePixelRatio || 1);
    });
    ro.observe(box);
    return () => {
      ro.disconnect();
      host.dispose();
      canvas.remove();
      hostRef.current = null;
      setReady(false);
    };
  }, [config.scene, createWorker]);

  const host = (): ParticleHost | null => hostRef.current;
  const local = (e: ReactPointerEvent<HTMLDivElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  /** Malen oder Löschen mit dem Pinsel an einer Stelle (Meter). */
  const brushAt = (x: number, y: number): void => {
    const h = host();
    if (h === null) return;
    const region = { circle: [x, y, brushMm / 1000] as const };
    if (tool === 'erase') { h.apply({ op: 'erase', region }); return; }
    const m = MATERIALS.find((k) => k.key === material) ?? MATERIALS[0];
    if (m.solid !== null) h.apply({ op: 'solid', region, material: m.solid, T: T0 + tempC });
    else h.apply({ op: 'fill', region, composition: m.composition, phase: m.phase, T: T0 + tempC });
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const h = host();
    if (h === null || !ready) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const px = local(e);
    const w = h.toWorld(px[0], px[1]);
    drag.current = { start: w, startPx: px, last: w, at: performance.now() };
    if (tool === 'paint' || tool === 'erase') brushAt(w[0], w[1]);
    else if (tool === 'place') { h.apply(apparatusOp(apparatus, w[0], w[1])); drag.current = null; }
    else if (tool === 'inspect') { void h.query(w[0], w[1]).then(setInfo); drag.current = null; }
    else if (tool === 'wall') setLine([px[0], px[1], px[0], px[1]]);
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    const h = host();
    if (d === null || h === null) return;
    const px = local(e);
    const w = h.toWorld(px[0], px[1]);
    if (tool === 'wall') { setLine([d.startPx[0], d.startPx[1], px[0], px[1]]); return; }
    const moved = Math.hypot(w[0] - d.last[0], w[1] - d.last[1]);
    const now = performance.now();
    if (moved < brushMm / 3000 && now - d.at < 60) return;
    d.last = w;
    d.at = now;
    brushAt(w[0], w[1]);
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    const h = host();
    drag.current = null;
    setLine(null);
    if (d === null || h === null || tool !== 'wall') return;
    const px = local(e);
    const [x, y] = h.toWorld(px[0], px[1]);
    const spacing = stats?.engine.spacing ?? 0.0025;
    if (Math.hypot(x - d.start[0], y - d.start[1]) < spacing) return;
    const m = MATERIALS.find((k) => k.key === material);
    h.apply({ op: 'solid', region: { line: [d.start[0], d.start[1], x, y], width: Math.max(2 * spacing, 0.005) }, material: m?.solid ?? 'glass', T: T0 + tempC });
  };

  const togglePause = (): void => {
    const next = !paused;
    setPaused(next);
    host()?.pause(next);
  };
  const cycleSpeed = (): void => {
    const next = (speedAt + 1) % SPEEDS.length;
    setSpeedAt(next);
    host()?.setSpeed(SPEEDS[next]);
  };
  const changeQuality = (q: Quality): void => {
    setQuality(q);
    host()?.setQuality(q);
  };
  const emptyBox = (): void => {
    const base = readScene(config.scene).scene;
    host()?.load(writeScene({ ...base, quality, ops: [] }));
  };

  const speed = SPEEDS[speedAt];
  const hint = TOOLS.find((k) => k.key === tool)?.hint ?? 'hintPaint';
  const bar = (
    <>
      <button type="button" className={`lab-tool${paused ? '' : ' is-on'}`} onClick={togglePause} title={paused ? t('play') : t('pause')} aria-label={paused ? t('play') : t('pause')}>
        <Icon name={paused ? 'play' : 'pause'} />
      </button>
      <button type="button" className="lab-tool" disabled={!paused} onClick={() => host()?.step()} title={t('step')} aria-label={t('step')}>
        <Icon name="next" />
      </button>
      <button type="button" className="lab-tool" onClick={cycleSpeed} title={t('speed')} aria-label={`${t('speed')} ${speed}×`}>{num(speed, speed < 1 ? 2 : 0)}×</button>
      <button type="button" className={`lab-tool${hud ? ' is-on' : ''}`} onClick={() => setHud(!hud)} title={t('hud')} aria-label={t('hud')}>HUD</button>
    </>
  );

  const stage = (
    <div ref={boxRef} className="pl-box" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {line !== null && (
        <svg className="pl-overlay" aria-hidden="true"><line className="pl-wall-preview" x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} /></svg>
      )}
      {hud && stats !== null && <Hud stats={stats} />}
      {(!ready || error !== null) && <div className="pl-status">{error ?? t('loading')}</div>}
    </div>
  );

  const side = (
    <div className="lab-side-in">
      {config.text.map((p, k) => <p key={k} className="lab-text">{p}</p>)}
      <p className="lab-muted">{t('m0Note')}</p>
      <details className="lab-section" open>
        <summary>{t('tools')}</summary>
        <div className="lab-section-body">
          <div className="lab-palette">
            {TOOLS.map((k) => (
              <button key={k.key} type="button" className={`lab-item${tool === k.key ? ' is-on' : ''}`} onClick={() => setTool(k.key)}>
                <Icon name={k.icon} />{t(k.label)}
              </button>
            ))}
          </div>
          <p className="lab-muted">{t(hint)}</p>
        </div>
      </details>
      <details className="lab-section" open>
        <summary>{t('materials')}</summary>
        <div className="lab-section-body">
          <div className="lab-palette">
            {MATERIALS.map((m) => (
              <button key={m.key} type="button" className={`lab-item${material === m.key ? ' is-on' : ''}`} onClick={() => { setMaterial(m.key); if (tool !== 'paint' && tool !== 'wall') setTool('paint'); }}>
                <Swatch color={m.color} />{t(m.label)}
              </button>
            ))}
          </div>
        </div>
      </details>
      <details className="lab-section" open>
        <summary>{t('apparatus')}</summary>
        <div className="lab-section-body">
          <div className="lab-palette">
            {(['beaker', 'hotplate'] as const).map((k) => (
              <button key={k} type="button" className={`lab-item${apparatus === k && tool === 'place' ? ' is-on' : ''}`} onClick={() => { setApparatus(k); setTool('place'); }}>
                <ApparatusIcon kind={k} />{t(k === 'beaker' ? 'appBeaker' : 'appHotplate')}
              </button>
            ))}
          </div>
        </div>
      </details>
      <details className="lab-section">
        <summary>{t('settings')}</summary>
        <div className="lab-section-body">
          <label className="lab-field">{t('brush')}: {brushMm} mm
            <input type="range" min={2} max={30} step={1} value={brushMm} onChange={(e) => setBrushMm(Number(e.currentTarget.value))} />
          </label>
          <label className="lab-field">{t('temperature')}: {tempC} °C
            <input type="range" min={0} max={100} step={1} value={tempC} onChange={(e) => setTempC(Number(e.currentTarget.value))} />
          </label>
          <label className="lab-field">{t('quality')}
            <select value={quality} onChange={(e) => changeQuality(e.currentTarget.value as Quality)}>
              {QUALITIES.map((q) => <option key={q.key} value={q.key}>{t(q.label)}</option>)}
            </select>
          </label>
          <label className="lab-row"><input type="checkbox" checked={showAir} onChange={(e) => { setShowAir(e.currentTarget.checked); host()?.showAir(e.currentTarget.checked); }} />{t('showAir')}</label>
          <div className="lab-row">
            <button type="button" className="lab-tool" onClick={() => host()?.load(config.scene)}><Icon name="refresh" />{t('restart')}</button>
            <button type="button" className="lab-tool" onClick={emptyBox}><Icon name="trash" />{t('emptyBox')}</button>
          </div>
        </div>
      </details>
      {tool === 'inspect' && info !== undefined && (
        <details className="lab-section" open>
          <summary>{t('inspect')}</summary>
          <div className="lab-section-body">{info === null ? <p className="lab-muted">{t('nothingHere')}</p> : <Inspector info={info} />}</div>
        </details>
      )}
    </div>
  );

  return <LabFrame title={config.title || t('title')} bar={bar} stage={stage} side={side} whole={whole} />;
}
