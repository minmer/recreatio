/**
 * LABOR 2D (v2) — DIE EINSTELLUNGEN (seit 2026-10-24): eine Lade über der
 * Bühne, nur wenn man sie öffnet. Rechnung (Auflösung, heftige Zustände,
 * Grafikkarte), Umgebung, Seiten der Kiste, Anzeige und die Szene als Datei.
 */

import { useRef, type ReactNode } from 'react';

import { Icon } from '../../../ui/icons';
import type { ExtremeMode, Quality, SideName } from '../engine/scene';
import { num, t, type TextKey } from '../i18n';
import type { Level } from '../panels';
import type { Walls } from '../render/glRenderer';

export interface Ambient {
  /** kPa, °C, relative Feuchte (0–1), Schwerkraft in g, Sauerstoff (Volumenanteil). */
  readonly p: number;
  readonly T: number;
  readonly rh: number;
  readonly g: number;
  readonly o2: number;
}

const QUALITY: readonly { readonly q: Quality; readonly mm: number }[] = [{ q: 'very-high', mm: 1 }, { q: 'high', mm: 2 }, { q: 'medium', mm: 3 }];
const EXTREMES: readonly { readonly m: ExtremeMode; readonly label: TextKey; readonly note: TextKey }[] = [
  { m: 'ask', label: 'extAsk', note: 'extAskNote' },
  { m: 'compute', label: 'extCompute', note: 'extComputeNote' },
  { m: 'normalize', label: 'extNormalize', note: 'extNormalizeNote' }
];
const PRESSURES: readonly { readonly key: TextKey; readonly kPa: number }[] = [{ key: 'pSea', kPa: 101.325 }, { key: 'pMountain', kPa: 70 }, { key: 'pCooker', kPa: 200 }];
const SIDES: readonly { readonly s: SideName; readonly label: TextKey }[] = [
  { s: 'left', label: 'sideLeft' }, { s: 'right', label: 'sideRight' }, { s: 'bottom', label: 'sideBottom' }, { s: 'top', label: 'sideTop' }
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section className="l2d-group"><h3>{title}</h3>{children}</section>;
}

/** Eine Wahl aus wenigen Möglichkeiten als Reihe von Knöpfen. */
function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { readonly value: T; readonly text: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="l2d-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'is-on' : ''} onClick={() => onChange(o.value)}>{o.text}</button>
      ))}
    </div>
  );
}

function Range({ label, value, unit, min, max, step, digits, title, onChange }: { label: string; value: number; unit: string; min: number; max: number; step: number; digits: number; title?: string; onChange: (v: number) => void }) {
  return (
    <label className="l2d-range" title={title}>
      <span>{label}</span>
      <output>{num(value, digits)} {unit}</output>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.currentTarget.value))} />
    </label>
  );
}

function Toggle({ label, on, disabled, title, onChange }: { label: string; on: boolean; disabled?: boolean; title?: string; onChange: (on: boolean) => void }) {
  return (
    <label className="l2d-toggle" title={title}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function SettingsSheet(p: {
  quality: Quality;
  onQuality: (q: Quality) => void;
  extremes: ExtremeMode;
  onExtremes: (m: ExtremeMode) => void;
  /** Die Grafikkarte: an?, geht es (sonst der Grund)? */
  accel: boolean;
  accelBlocked: string | null;
  showAccel: boolean;
  onAccel: () => void;
  ambient: Ambient;
  onAmbient: (a: Ambient) => void;
  walls: Walls | null;
  onSide: (side: SideName, wall: boolean) => void;
  particles: boolean;
  particlesBlocked: boolean;
  onParticles: (on: boolean) => void;
  level: Level;
  onLevel: (l: Level) => void;
  hud: boolean;
  onHud: (on: boolean) => void;
  onSave: () => void;
  onLoadFile: (file: File) => void;
  onEmpty: () => void;
  onScenarioStart: () => void;
  busy: boolean;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const a = p.ambient;
  const ext = EXTREMES.find((x) => x.m === p.extremes) ?? EXTREMES[0];
  return (
    <section className="l2d-sheet" aria-label={t('settings')} onPointerDown={(e) => e.stopPropagation()}>
      <header className="l2d-sheet-head">
        <h2>{t('settings')}</h2>
        <button type="button" className="l2d-icon" onClick={p.onClose} aria-label={t('closePanel')} title={t('closePanel')}><Icon name="x" /></button>
      </header>
      <div className="l2d-sheet-body">
        <Group title={t('setCompute')}>
          <span className="l2d-label">{t('quality')}</span>
          <Segmented label={t('quality')} value={p.quality} onChange={p.onQuality} options={QUALITY.map((x) => ({ value: x.q, text: `${x.mm} mm` }))} />
          <span className="l2d-label">{t('extremes')}</span>
          <Segmented label={t('extremes')} value={p.extremes} onChange={p.onExtremes} options={EXTREMES.map((x) => ({ value: x.m, text: t(x.label) }))} />
          <p className="l2d-note-line">{t(ext.note)}</p>
          {p.showAccel && <Toggle label={t('accelSetting')} on={p.accel} disabled={!p.accel && p.accelBlocked !== null} title={p.accelBlocked ?? t('accelTitle')} onChange={() => p.onAccel()} />}
          {p.accel && <p className="l2d-note-line">{t('accelNoteShort')}</p>}
        </Group>
        <Group title={t('room')}>
          <div className="l2d-chips">
            {PRESSURES.map((x) => <button key={x.key} type="button" className={Math.abs(a.p - x.kPa) < 0.5 ? 'is-on' : ''} onClick={() => p.onAmbient({ ...a, p: x.kPa })}>{t(x.key)}</button>)}
          </div>
          <Range label={t('pressure')} value={a.p} unit="kPa" min={50} max={250} step={0.5} digits={1} onChange={(v) => p.onAmbient({ ...a, p: v })} />
          <Range label={t('roomTemp')} value={a.T} unit="°C" min={0} max={40} step={1} digits={0} onChange={(v) => p.onAmbient({ ...a, T: v })} />
          <Range label={t('humidity')} value={100 * a.rh} unit="%" min={0} max={100} step={5} digits={0} onChange={(v) => p.onAmbient({ ...a, rh: v / 100 })} />
          <Range label={t('oxygen')} value={100 * a.o2} unit="%" min={0} max={50} step={1} digits={0} title={t('oxygenNote')} onChange={(v) => p.onAmbient({ ...a, o2: v / 100 })} />
          <Range label={t('gravity')} value={a.g} unit="g" min={0.25} max={2} step={0.05} digits={2} onChange={(v) => p.onAmbient({ ...a, g: v })} />
        </Group>
        <Group title={t('sides')}>
          <div className="l2d-chips">
            {SIDES.map((x) => {
              const wall = p.walls === null ? x.s !== 'top' : p.walls[x.s];
              return <button key={x.s} type="button" className={wall ? 'is-on' : ''} aria-pressed={wall} onClick={() => p.onSide(x.s, !wall)}>{t(x.label)}: {t(wall ? 'sideWall' : 'sideOpen')}</button>;
            })}
          </div>
        </Group>
        <Group title={t('view')}>
          <Toggle label={t('particlesShort')} on={p.particles} disabled={p.particlesBlocked} title={p.particlesBlocked ? t('clipParticles') : undefined} onChange={p.onParticles} />
          <span className="l2d-label">{t('level')}</span>
          <Segmented label={t('level')} value={p.level} onChange={p.onLevel} options={[{ value: 'primary', text: t('levelPrimary') }, { value: 'secondary', text: t('levelSecondaryShort') }]} />
          <Toggle label={t('hudShort')} on={p.hud} onChange={p.onHud} />
        </Group>
        <Group title={t('sceneFile')}>
          <div className="l2d-chips">
            <button type="button" onClick={p.onSave}><Icon name="download" />{t('saveShort')}</button>
            <button type="button" disabled={p.busy} onClick={() => fileRef.current?.click()}><Icon name="upload" />{t('loadScene')}</button>
            <button type="button" disabled={p.busy} onClick={p.onEmpty}><Icon name="trash" />{t('emptyBox')}</button>
            <button type="button" disabled={p.busy} onClick={p.onScenarioStart}><Icon name="refresh" />{t('scenarioStart')}</button>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" className="l2d-file" onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f !== undefined) p.onLoadFile(f); e.currentTarget.value = ''; }} />
        </Group>
      </div>
    </section>
  );
}
