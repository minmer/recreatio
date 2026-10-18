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

import { LIQUIDS } from '../fluid';
import { LabSection, LabValue, labNum } from '../LabFrame';
import { MATERIALS, type Body } from './physBody';
import type { Basin } from './physFluid';
import { PALETTE_ITEMS } from './physPalette';
import type { PaletteKey, StepSpec, ToolKey, VectorKind, WorldControl } from './physScene';
import type { World } from './physWorld';

const ICONS: Record<PaletteKey, ReactNode> = {
  ball: <><circle cx="16" cy="16" r="9" fill="#e8823a" /><path d="M8 13q8 4 16 0" stroke="#7a3f12" fill="none" /></>,
  box: <rect x="7" y="9" width="18" height="15" fill="#c8955a" stroke="#6b4a26" />,
  plank: <rect x="3" y="14" width="26" height="5" fill="#c8955a" stroke="#6b4a26" />,
  wedge: <path d="M5 25h22L5 9z" fill="#c8955a" stroke="#6b4a26" />,
  ramp: <path d="M3 26h26L3 12z" fill="#9b938a" stroke="#56504a" />,
  wall: <rect x="13" y="4" width="6" height="24" fill="#9b938a" stroke="#56504a" />,
  pendulum: <><path d="M10 4h12M16 4l6 18" stroke="#333" strokeWidth="1.6" /><circle cx="22" cy="23" r="4" fill="#9aa4ad" stroke="#555" /></>,
  spring: <><path d="M10 4h12M16 4v3l-4 2 8 2-8 2 8 2-8 2 4 2v2" stroke="#2f6fae" fill="none" strokeWidth="1.5" /><rect x="11" y="21" width="10" height="7" fill="#9aa4ad" stroke="#555" /></>,
  pulley: <><circle cx="16" cy="7" r="4" fill="none" stroke="#333" strokeWidth="1.5" /><path d="M12 7v12M20 7v8" stroke="#8a6d3b" /><rect x="9" y="19" width="6" height="7" fill="#9aa4ad" /><rect x="17" y="15" width="6" height="5" fill="#c7ccd1" /></>,
  seesaw: <><path d="M3 16l26-4" stroke="#6b4a26" strokeWidth="3" /><path d="M12 26h8l-4-12z" fill="#9b938a" /></>,
  basin: <><path d="M5 7v19h22V7" stroke="#555" fill="none" strokeWidth="1.6" /><rect x="6" y="15" width="20" height="10" fill="rgba(64,150,220,0.6)" /></>
};

const TOOL_ICONS: Record<ToolKey, ReactNode> = {
  pin: <><circle cx="16" cy="16" r="6" fill="#fff" stroke="#333" strokeWidth="2" /><circle cx="16" cy="16" r="2" fill="#333" /></>,
  rope: <path d="M6 6q4 20 20 20" stroke="#8a6d3b" strokeWidth="2" fill="none" />,
  rod: <path d="M6 26L26 6" stroke="#333" strokeWidth="3" />,
  link: <path d="M5 16h4l2-5 3 10 3-10 3 10 3-10 2 5h4" stroke="#2f6fae" strokeWidth="1.6" fill="none" />,
  ruler: <><rect x="3" y="12" width="26" height="8" fill="#f2e2b0" stroke="#7a6a3a" /><path d="M7 12v4M11 12v3M15 12v4M19 12v3M23 12v4" stroke="#7a6a3a" /></>,
  probe: <><circle cx="16" cy="18" r="6" fill="none" stroke="#c0392b" strokeWidth="2" /><path d="M16 4v8M10 18h12" stroke="#c0392b" strokeWidth="2" /></>,
  delete: <path d="M8 9h16M12 9V6h8v3M10 9l1 17h10l1-17" stroke="#c0392b" strokeWidth="1.8" fill="none" />
};

const TOOL_LABEL: Record<ToolKey, string> = {
  pin: 'Przypnij (oś)', rope: 'Lina', rod: 'Pręt', link: 'Sprężyna', ruler: 'Linijka', probe: 'Sonda ciśnienia', delete: 'Usuń'
};

const TOOL_SAYS: Record<ToolKey, string> = {
  pin: 'Dotknij ciała: w tym miejscu dostanie oś obrotu (gwóźdź w ścianie).',
  rope: 'Przeciągnij od ciała do drugiego ciała albo do punktu w powietrzu.',
  rod: 'Przeciągnij od ciała do drugiego ciała albo do punktu: sztywny pręt.',
  link: 'Przeciągnij od ciała do drugiego ciała albo do punktu: sprężyna.',
  ruler: 'Przeciągnij, żeby zmierzyć odległość.',
  probe: 'Dotknij albo przeciągnij w cieczy: ciśnienie w tym miejscu.',
  delete: 'Dotknij ciała, żeby je usunąć.'
};

export function Palette({ items, onPick }: { items: readonly PaletteKey[]; onPick: (key: PaletteKey) => void }) {
  return (
    <div className="lab-palette" role="group" aria-label="Dodaj">
      {PALETTE_ITEMS.filter((p) => items.includes(p.key)).map((p) => (
        <button key={p.key} type="button" className="lab-item" onClick={() => onPick(p.key)}>
          <svg viewBox="0 0 32 32" aria-hidden="true">{ICONS[p.key]}</svg>
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function Tools({ tools, active, onPick }: { tools: readonly ToolKey[]; active: ToolKey | null; onPick: (key: ToolKey | null) => void }) {
  if (tools.length === 0) return null;
  return (
    <>
      <div className="lab-palette" role="group" aria-label="Narzędzia">
        {tools.map((t) => (
          <button key={t} type="button" className={`lab-item${active === t ? ' is-on' : ''}`} aria-pressed={active === t} onClick={() => onPick(active === t ? null : t)}>
            <svg viewBox="0 0 32 32" aria-hidden="true">{TOOL_ICONS[t]}</svg>
            {TOOL_LABEL[t]}
          </button>
        ))}
      </div>
      {active !== null && <p className="lab-muted">{TOOL_SAYS[active]}</p>}
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
  return (
    <LabSection title={`Zaznaczone: ${body.label}`}>
      <LabValue label="Masa" value={body.fixed ? 'nieruchome' : labNum(body.m, body.m < 10 ? 2 : 1, 'kg')} />
      <LabValue label="Materiał" value={`${body.material.name} · ${labNum(body.material.density, 0, 'kg/m³')}`} />
      {!body.fixed && (
        <>
          <div className="lab-value"><span>Prędkość</span><output data-q="v" /></div>
          <div className="lab-value"><span>Wysokość</span><output data-q="h" /></div>
          <div className="lab-value"><span>Energia kinetyczna</span><output data-q="ek" /></div>
          <div className="lab-value"><span>Energia potencjalna</span><output data-q="ep" /></div>
          <div className="lab-value"><span>Siła wyporu</span><output data-q="lift" /></div>
        </>
      )}
      <div className="lab-row">
        <label><input type="checkbox" checked={body.trace} onChange={(e) => onChange({ trace: e.currentTarget.checked })} /> ślad</label>
        {edit && <label><input type="checkbox" checked={body.fixed} onChange={(e) => onChange({ fixed: e.currentTarget.checked })} /> nieruchome</label>}
      </div>
      {edit && (
        <>
          <label className="lab-field">
            Materiał
            <select value={body.material.key} onChange={(e) => onChange({ material: e.currentTarget.value })}>
              {Object.values(MATERIALS).map((m) => <option key={m.key} value={m.key}>{m.name} ({m.density} kg/m³)</option>)}
            </select>
          </label>
          <label className="lab-field">
            Obrót
            <input type="range" min={-180} max={180} step={5} value={Math.round((body.a * 180) / Math.PI)} onChange={(e) => onChange({ angle: (e.currentTarget.valueAsNumber * Math.PI) / 180 })} />
          </label>
          <button type="button" className="wk-btn wk-btn-line" onClick={onDelete}>Usuń</button>
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
  const g = world.g;
  return (
    <LabSection title="Zbiornik">
      {basin.layers.length === 0 ? <p className="lab-muted">Pusty.</p> : basin.layers.slice().reverse().map((l, i) => (
        <LabValue key={i} label={l.liquid.name} value={labNum((l.amount * world.depth) * 1000, 1, 'l')} />
      ))}
      <div className="lab-value"><span>Poziom</span><output data-q="level" /></div>
      <LabValue label="Ciśnienie na dnie" value={labNum(basin.pressure(basin.y0, g) / 1000, 1, 'kPa')} />
      {basin.holes.map((h, i) => (
        <button key={i} type="button" className={`wk-btn${h.open ? '' : ' wk-btn-line'}`} onClick={() => onChange({ hole: i })}>
          {h.open ? 'Zatkaj' : 'Otwórz'} otwór {i + 1} ({labNum(h.at, 2, 'm')})
        </button>
      ))}
      {edit && (
        <div className="lab-row">
          {Object.values(LIQUIDS).slice(0, 6).map((l) => (
            <button key={l.key} type="button" className="wk-btn wk-btn-line" onClick={() => onChange({ pour: l.key })}>+ {l.name}</button>
          ))}
          <button type="button" className="wk-btn wk-btn-line" onClick={() => onChange({ drain: true })}>Wylej</button>
        </div>
      )}
    </LabSection>
  );
}

export function Steps({ steps, at, showing, onShow, onNext }: { steps: readonly StepSpec[]; at: number; showing: boolean; onShow: () => void; onNext: () => void }) {
  if (steps.length === 0) return null;
  return (
    <LabSection title="Doświadczenie krok po kroku">
      <ol className="lab-steps">
        {steps.map((s, i) => <li key={i} className={i === at ? 'is-now' : i < at ? 'is-done' : ''}>{s.say}</li>)}
      </ol>
      <div className="lab-row">
        <button type="button" className="wk-btn" onClick={onShow} disabled={showing}>{showing ? 'Pokazuję…' : 'Pokaż'}</button>
        <button type="button" className="wk-btn wk-btn-line" onClick={onNext} disabled={showing || at >= steps.length}>Następny krok</button>
      </div>
    </LabSection>
  );
}

const VECTOR_LABEL: Record<VectorKind, string> = { v: 'prędkość', g: 'ciężar', lift: 'wypór', net: 'siła wypadkowa' };

export function View({ vectors, grid, pressure, values, liquid, onToggle }: {
  vectors: readonly VectorKind[];
  grid: boolean;
  pressure: boolean;
  values: boolean;
  liquid: boolean;
  onToggle: (what: VectorKind | 'grid' | 'pressure' | 'values') => void;
}) {
  return (
    <LabSection title="Widok" open={false}>
      <div className="lab-row">
        {(['v', 'g', 'lift', 'net'] as const).map((k) => (
          <label key={k}><input type="checkbox" checked={vectors.includes(k)} onChange={() => onToggle(k)} /> {VECTOR_LABEL[k]}</label>
        ))}
      </div>
      <div className="lab-row">
        <label><input type="checkbox" checked={values} onChange={() => onToggle('values')} /> wartości</label>
        <label><input type="checkbox" checked={grid} onChange={() => onToggle('grid')} /> siatka</label>
        {liquid && <label><input type="checkbox" checked={pressure} onChange={() => onToggle('pressure')} /> ciśnienie</label>}
      </div>
    </LabSection>
  );
}

const PLANETS: readonly (readonly [string, number])[] = [['Ziemia', 9.81], ['Księżyc', 1.62], ['Mars', 3.71], ['Jowisz', 24.79], ['nieważkość', 0]];

export function WorldControls({ controls, gravity, air, onGravity, onAir }: { controls: readonly WorldControl[]; gravity: number; air: boolean; onGravity: (g: number) => void; onAir: (on: boolean) => void }) {
  if (controls.length === 0) return null;
  return (
    <LabSection title="Świat">
      {controls.includes('air') && <label className="lab-row"><input type="checkbox" checked={air} onChange={(e) => onAir(e.currentTarget.checked)} /> Powietrze (opór powietrza)</label>}
      {controls.includes('gravity') && (
        <label className="lab-field">
          Grawitacja
          <select value={String(PLANETS.find((p) => Math.abs(p[1] - gravity) < 0.01)?.[1] ?? gravity)} onChange={(e) => onGravity(Number(e.currentTarget.value))}>
            {PLANETS.map(([name, g]) => <option key={name} value={g}>{name} ({String(g).replace('.', ',')} m/s²)</option>)}
            {!PLANETS.some((p) => Math.abs(p[1] - gravity) < 0.01) && <option value={gravity}>{String(gravity).replace('.', ',')} m/s²</option>}
          </select>
        </label>
      )}
    </LabSection>
  );
}
