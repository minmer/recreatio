/**
 * 2026-10-18 — DIE BEDIENUNG DER FIZYKA 2D (neben oder unter der Bühne):
 * was man hinzufügt (Piaskownica), womit man misst und verbindet, was am
 * gewählten Körper oder Becken einzustellen ist, die Schritte eines Versuchs,
 * was zu sehen ist, die Welt (Luft, Schwerkraft) und der Schreiber.
 *
 * Werte, die sich in jedem Bild ändern (Geschwindigkeit, Höhe, Energie),
 * schreibt die Schleife (`data-q`) — React baut nur, wenn sich die Wahl
 * oder der Bau ändert.
 */

import type { ReactNode } from 'react';

import { useT } from '../../core/i18n';
import { LIQUIDS } from '../fluid';
import { LabSection, LabValue, labNum } from '../LabFrame';
import { MATERIALS, type Body } from './physBody';
import type { Basin } from './physFluid';
import { PALETTE_ITEMS } from './physPalette';
import type { PaletteKey, StepSpec, ToolKey, VectorKind, WorldControl } from './physScene';
import type { World } from './physWorld';

const ICONS: Record<PaletteKey, ReactNode> = {
  ball: <><circle cx="16" cy="16" r="9" fill="#e8823a" /><path d="M8 13q8 4 16 0" stroke="#7a3f12" fill="none" /></>, // i18n-ignore (Zeichen, kein Text)
  box: <rect x="7" y="9" width="18" height="15" fill="#c8955a" stroke="#6b4a26" />, // i18n-ignore (Zeichen, kein Text)
  plank: <rect x="3" y="14" width="26" height="5" fill="#c8955a" stroke="#6b4a26" />, // i18n-ignore (Zeichen, kein Text)
  wedge: <path d="M5 25h22L5 9z" fill="#c8955a" stroke="#6b4a26" />, // i18n-ignore (Zeichen, kein Text)
  ramp: <path d="M3 26h26L3 12z" fill="#9b938a" stroke="#56504a" />, // i18n-ignore (Zeichen, kein Text)
  wall: <rect x="13" y="4" width="6" height="24" fill="#9b938a" stroke="#56504a" />, // i18n-ignore (Zeichen, kein Text)
  pendulum: <><path d="M10 4h12M16 4l6 18" stroke="#333" strokeWidth="1.6" /><circle cx="22" cy="23" r="4" fill="#9aa4ad" stroke="#555" /></>, // i18n-ignore (Zeichen, kein Text)
  spring: <><path d="M10 4h12M16 4v3l-4 2 8 2-8 2 8 2-8 2 4 2v2" stroke="#2f6fae" fill="none" strokeWidth="1.5" /><rect x="11" y="21" width="10" height="7" fill="#9aa4ad" stroke="#555" /></>, // i18n-ignore (Zeichen, kein Text)
  pulley: <><circle cx="16" cy="7" r="4" fill="none" stroke="#333" strokeWidth="1.5" /><path d="M12 7v12M20 7v8" stroke="#8a6d3b" /><rect x="9" y="19" width="6" height="7" fill="#9aa4ad" /><rect x="17" y="15" width="6" height="5" fill="#c7ccd1" /></>, // i18n-ignore (Zeichen, kein Text)
  seesaw: <><path d="M3 16l26-4" stroke="#6b4a26" strokeWidth="3" /><path d="M12 26h8l-4-12z" fill="#9b938a" /></>, // i18n-ignore (Zeichen, kein Text)
  basin: <><path d="M5 7v19h22V7" stroke="#555" fill="none" strokeWidth="1.6" /><rect x="6" y="15" width="20" height="10" fill="rgba(64,150,220,0.6)" /></> // i18n-ignore (Zeichen, kein Text)
};

const TOOL_ICONS: Record<ToolKey, ReactNode> = {
  pin: <><circle cx="16" cy="16" r="6" fill="#fff" stroke="#333" strokeWidth="2" /><circle cx="16" cy="16" r="2" fill="#333" /></>, // i18n-ignore (Zeichen, kein Text)
  rope: <path d="M6 6q4 20 20 20" stroke="#8a6d3b" strokeWidth="2" fill="none" />, // i18n-ignore (Zeichen, kein Text)
  rod: <path d="M6 26L26 6" stroke="#333" strokeWidth="3" />, // i18n-ignore (Zeichen, kein Text)
  link: <path d="M5 16h4l2-5 3 10 3-10 3 10 3-10 2 5h4" stroke="#2f6fae" strokeWidth="1.6" fill="none" />, // i18n-ignore (Zeichen, kein Text)
  ruler: <><rect x="3" y="12" width="26" height="8" fill="#f2e2b0" stroke="#7a6a3a" /><path d="M7 12v4M11 12v3M15 12v4M19 12v3M23 12v4" stroke="#7a6a3a" /></>, // i18n-ignore (Zeichen, kein Text)
  probe: <><circle cx="16" cy="18" r="6" fill="none" stroke="#c0392b" strokeWidth="2" /><path d="M16 4v8M10 18h12" stroke="#c0392b" strokeWidth="2" /></>, // i18n-ignore (Zeichen, kein Text)
  delete: <path d="M8 9h16M12 9V6h8v3M10 9l1 17h10l1-17" stroke="#c0392b" strokeWidth="1.8" fill="none" /> // i18n-ignore (Zeichen, kein Text)
};



export function Palette({ items, onPick }: { items: readonly PaletteKey[]; onPick: (key: PaletteKey) => void }) {
  const t = useT();
  return (
    <div className="lab-palette" role="group" aria-label={t('labPhysics.panel.add')}>
      {PALETTE_ITEMS.filter((p) => items.includes(p.key)).map((p) => (
        <button key={p.key} type="button" className="lab-item" onClick={() => onPick(p.key)}>
          <svg viewBox="0 0 32 32" aria-hidden="true">{ICONS[p.key]}</svg>
          {t(`labPhysics.palette.${p.key}`)}
        </button>
      ))}
    </div>
  );
}

export function Tools({ tools, active, onPick }: { tools: readonly ToolKey[]; active: ToolKey | null; onPick: (key: ToolKey | null) => void }) {
  const t = useT();
  if (tools.length === 0) return null;
  return (
    <>
      <div className="lab-palette" role="group" aria-label={t('labPhysics.panel.tools')}>
        {tools.map((k) => (
          <button key={k} type="button" className={`lab-item${active === k ? ' is-on' : ''}`} aria-pressed={active === k} onClick={() => onPick(active === k ? null : k)}>
            <svg viewBox="0 0 32 32" aria-hidden="true">{TOOL_ICONS[k]}</svg>
            {t(`labPhysics.tool.${k}`)}
          </button>
        ))}
      </div>
      {active !== null && <p className="lab-muted">{t(`labPhysics.toolSays.${active}`)}</p>}
    </>
  );
}

/** Das gewählte Ding: seine Werte (die Schleife schreibt sie), und was man an ihm ändern darf. */
export function BodyInspector({ body, edit, onChange, onDelete }: {
  body: Body;
  edit: boolean;
  onChange: (patch: { material?: string; fixed?: boolean; trace?: boolean; angle?: number }) => void;
  onDelete: () => void;
}) {
  const t = useT();
  return (
    <LabSection title={t('labPhysics.panel.selected', { label: body.label })}>
      <LabValue label={t('labPhysics.panel.mass')} value={body.fixed ? t('labPhysics.panel.fixedValue') : labNum(body.m, body.m < 10 ? 2 : 1, 'kg')} />
      <LabValue label={t('labPhysics.panel.material')} value={t('labPhysics.panel.materialValue', { name: t(`labPhysics.material.${body.material.key}`), density: labNum(body.material.density, 0, 'kg/m³') })} />
      {!body.fixed && (
        <>
          <div className="lab-value"><span>{t('labPhysics.panel.speed')}</span><output data-q="v" /></div>
          <div className="lab-value"><span>{t('labPhysics.panel.height')}</span><output data-q="h" /></div>
          <div className="lab-value"><span>{t('labPhysics.panel.kinetic')}</span><output data-q="ek" /></div>
          <div className="lab-value"><span>{t('labPhysics.panel.potential')}</span><output data-q="ep" /></div>
          <div className="lab-value"><span>{t('labPhysics.panel.lift')}</span><output data-q="lift" /></div>
        </>
      )}
      <div className="lab-row">
        <label><input type="checkbox" checked={body.trace} onChange={(e) => onChange({ trace: e.currentTarget.checked })} /> {t('labPhysics.panel.trace')}</label>
        {edit && <label><input type="checkbox" checked={body.fixed} onChange={(e) => onChange({ fixed: e.currentTarget.checked })} /> {t('labPhysics.panel.fixed')}</label>}
      </div>
      {edit && (
        <>
          <label className="lab-field">
            {t('labPhysics.panel.material')}
            <select value={body.material.key} onChange={(e) => onChange({ material: e.currentTarget.value })}>
              {Object.values(MATERIALS).map((m) => <option key={m.key} value={m.key}>{t('labPhysics.panel.materialOption', { name: t(`labPhysics.material.${m.key}`), density: m.density })}</option>)}
            </select>
          </label>
          <label className="lab-field">
            {t('labPhysics.panel.angle')}
            <input type="range" min={-180} max={180} step={5} value={Math.round((body.a * 180) / Math.PI)} onChange={(e) => onChange({ angle: (e.currentTarget.valueAsNumber * Math.PI) / 180 })} />
          </label>
          <button type="button" className="wk-btn wk-btn-line" onClick={onDelete}>{t('labPhysics.panel.remove')}</button>
        </>
      )}
    </LabSection>
  );
}

export function BasinInspector({ basin, world, edit, onChange }: {
  basin: Basin;
  world: World;
  edit: boolean;
  onChange: (patch: { hole?: number; pour?: string; drain?: boolean }) => void;
}) {
  const t = useT();
  const g = world.g;
  return (
    <LabSection title={t('labPhysics.panel.basin')}>
      {basin.layers.length === 0 ? <p className="lab-muted">{t('labPhysics.panel.empty')}</p> : basin.layers.slice().reverse().map((l, i) => (
        <LabValue key={i} label={t(`lab.liquid.${l.liquid.key}`)} value={labNum((l.amount * world.depth) * 1000, 1, 'l')} />
      ))}
      <div className="lab-value"><span>{t('labPhysics.panel.level')}</span><output data-q="level" /></div>
      <LabValue label={t('labPhysics.panel.bottomPressure')} value={labNum(basin.pressure(basin.y0, g) / 1000, 1, 'kPa')} />
      {basin.holes.map((h, i) => (
        <button key={i} type="button" className={`wk-btn${h.open ? '' : ' wk-btn-line'}`} onClick={() => onChange({ hole: i })}>
          {t(h.open ? 'labPhysics.panel.holeClose' : 'labPhysics.panel.holeOpen', { n: i + 1, at: labNum(h.at, 2, 'm') })}
        </button>
      ))}
      {edit && (
        <div className="lab-row">
          {Object.values(LIQUIDS).slice(0, 6).map((l) => (
            <button key={l.key} type="button" className="wk-btn wk-btn-line" onClick={() => onChange({ pour: l.key })}>{t('labPhysics.panel.pour', { name: t(`lab.liquid.${l.key}`) })}</button>
          ))}
          <button type="button" className="wk-btn wk-btn-line" onClick={() => onChange({ drain: true })}>{t('labPhysics.panel.drain')}</button>
        </div>
      )}
    </LabSection>
  );
}

export function Steps({ steps, at, showing, onShow, onNext }: { steps: readonly StepSpec[]; at: number; showing: boolean; onShow: () => void; onNext: () => void }) {
  const t = useT();
  if (steps.length === 0) return null;
  return (
    <LabSection title={t('labPhysics.panel.steps')}>
      <ol className="lab-steps">
        {steps.map((s, i) => <li key={i} className={i === at ? 'is-now' : i < at ? 'is-done' : ''}>{s.say}</li>)}
      </ol>
      <div className="lab-row">
        <button type="button" className="wk-btn" onClick={onShow} disabled={showing}>{showing ? t('labPhysics.panel.showing') : t('labPhysics.panel.show')}</button>
        <button type="button" className="wk-btn wk-btn-line" onClick={onNext} disabled={showing || at >= steps.length}>{t('labPhysics.panel.next')}</button>
      </div>
    </LabSection>
  );
}


export function View({ vectors, grid, pressure, values, liquid, onToggle }: {
  vectors: readonly VectorKind[];
  grid: boolean;
  pressure: boolean;
  values: boolean;
  liquid: boolean;
  onToggle: (what: VectorKind | 'grid' | 'pressure' | 'values') => void;
}) {
  const t = useT();
  return (
    <LabSection title={t('labPhysics.panel.view')} open={false}>
      <div className="lab-row">
        {(['v', 'g', 'lift', 'net'] as const).map((k) => (
          <label key={k}><input type="checkbox" checked={vectors.includes(k)} onChange={() => onToggle(k)} /> {t(`labPhysics.vector.${k}`)}</label>
        ))}
      </div>
      <div className="lab-row">
        <label><input type="checkbox" checked={values} onChange={() => onToggle('values')} /> {t('labPhysics.panel.values')}</label>
        <label><input type="checkbox" checked={grid} onChange={() => onToggle('grid')} /> {t('labPhysics.panel.grid')}</label>
        {liquid && <label><input type="checkbox" checked={pressure} onChange={() => onToggle('pressure')} /> {t('labPhysics.panel.pressure')}</label>}
      </div>
    </LabSection>
  );
}

/** Schwerkraft der Himmelskörper (m/s²); die Namen: labPhysics.planet.<key>. */
const PLANETS: readonly (readonly [string, number])[] = [['earth', 9.81], ['moon', 1.62], ['mars', 3.71], ['jupiter', 24.79], ['zeroG', 0]];

export function WorldControls({ controls, gravity, air, onGravity, onAir }: { controls: readonly WorldControl[]; gravity: number; air: boolean; onGravity: (g: number) => void; onAir: (on: boolean) => void }) {
  const t = useT();
  if (controls.length === 0) return null;
  return (
    <LabSection title={t('labPhysics.panel.world')}>
      {controls.includes('air') && <label className="lab-row"><input type="checkbox" checked={air} onChange={(e) => onAir(e.currentTarget.checked)} /> {t('labPhysics.panel.air')}</label>}
      {controls.includes('gravity') && (
        <label className="lab-field">
          {t('labPhysics.panel.gravity')}
          <select value={String(PLANETS.find((p) => Math.abs(p[1] - gravity) < 0.01)?.[1] ?? gravity)} onChange={(e) => onGravity(Number(e.currentTarget.value))}>
            {PLANETS.map(([name, g]) => <option key={name} value={g}>{t('labPhysics.panel.gravityOption', { name: t(`labPhysics.planet.${name}`), g: String(g).replace('.', ',') })}</option>)}
            {!PLANETS.some((p) => Math.abs(p[1] - gravity) < 0.01) && <option value={gravity}>{t('labPhysics.panel.gravityValue', { g: String(gravity).replace('.', ',') })}</option>}
          </select>
        </label>
      )}
    </LabSection>
  );
}
