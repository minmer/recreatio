/**
 * LABOR 2D (v2) — DIE WERKZEUGE (seit 2026-10-24): eine Leiste am Rand der
 * Bühne (auf dem Telefon unten) — Wybierz, Dodaj, Maluj, Gumka, Ścianka,
 * Badaj — und die Einstellungen des gewählten Werkzeugs als kleines Feld über
 * der Bühne. Werkzeuge, die die Szene ändern, gehen nur in der Pause: läuft
 * die Rechnung, sind sie gedämpft, und ein Klick hält sie an.
 */

import type { ReactNode } from 'react';

import { Icon } from '../../../ui/icons';
import { GRAIN_MATS } from '../engine/grains';
import { LIQUIDS } from '../engine/materials';
import { num, t, type TextKey } from '../i18n';
import { KindIcon, OBJECT_KINDS, type ObjectKind } from '../objectKinds';

export type Tool = 'select' | 'add' | 'paint' | 'erase' | 'wall' | 'inspect';

/** Werkzeuge, die die Szene ändern (nur in der Pause). */
export const EDIT_TOOLS: readonly Tool[] = ['add', 'paint', 'erase', 'wall'];

export interface Material {
  readonly key: string;
  readonly label: TextKey;
  readonly solid: string | null;
  /** Eine Flüssigkeit der Datenbank (H2O, oil-rapeseed …): gemalt als Füllung mit dieser Zusammensetzung. */
  readonly liquid?: string;
  /** Ein darin gelöster Stoff (NaCl) — sein Massenanteil kommt vom Regler „Sól w solance“. */
  readonly solute?: string;
  /** Körner eines Stoffs (M3c): gemalt als lockere Schüttung. */
  readonly grains?: string;
  readonly color: string;
}

export const MATERIALS: readonly Material[] = [
  { key: 'water', label: 'matWater', solid: null, liquid: 'H2O', color: '#3d8fd8' },
  { key: 'oil', label: 'matOil', solid: null, liquid: 'oil-rapeseed', color: LIQUIDS[1]?.color ?? '#e3b437' },
  { key: 'brine', label: 'matBrine', solid: null, liquid: 'H2O', solute: 'NaCl', color: '#8dbbe3' },
  { key: 'salt', label: 'matSalt', solid: null, grains: 'NaCl', color: GRAIN_MATS[0]?.color ?? '#f4f3ee' },
  { key: 'air', label: 'matAir', solid: null, color: '#e6eef3' },
  { key: 'glass', label: 'matGlass', solid: 'glass', color: '#9cc3d5' },
  { key: 'steel', label: 'matSteel', solid: 'steel', color: '#7d858e' },
  { key: 'chips', label: 'matChips', solid: 'ceramic', color: '#d8ccb4' }
];

/** Woraus eine Ścianka sein kann. */
export const WALL_MATERIALS: readonly Material[] = MATERIALS.filter((m) => m.solid !== null);

/** Zeichen der Werkzeuge (24 × 24, Linien in currentColor). */
function ToolIcon({ tool }: { tool: Tool }) {
  if (tool === 'add') return <Icon name="plus" />;
  if (tool === 'inspect') return <Icon name="search" />;
  const path = tool === 'select' ? 'M6 3l12 9-5.5 1.2L16 20l-2.6 1.1-2.6-6.6L6 18z'
    : tool === 'paint' ? 'M14.5 3.5l6 6-8.4 8.4-6-6zM6 12.4l5.6 5.6c-.8 2.4-3 3.5-6.6 3.5.2-3.6 1-5.8 1-9.1z'
      : tool === 'erase' ? 'M8.5 20.5h11M4.6 14.6l8.7-8.7a2 2 0 012.8 0l3 3a2 2 0 010 2.8L11 19.8a2 2 0 01-2.8 0l-3.6-3.6a2 2 0 010-1.6zM9 10.2l5.8 5.8'
        : 'M4 19L20 5';
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={tool === 'wall' ? 3.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TOOLS: readonly { readonly key: Tool; readonly label: TextKey }[] = [
  { key: 'select', label: 'toolSelect' },
  { key: 'add', label: 'toolAdd' },
  { key: 'paint', label: 'toolPaint' },
  { key: 'erase', label: 'toolErase' },
  { key: 'wall', label: 'toolWall' },
  { key: 'inspect', label: 'toolInspect' }
];

export function ToolRail({ tool, onTool, locked, off }: {
  tool: Tool;
  onTool: (tool: Tool) => void;
  /** Die Rechnung läuft: Werkzeuge, die die Szene ändern, sind gedämpft (ein Klick hält an). */
  locked: boolean;
  /** Backen oder Wiedergabe: das Bild gehört dem Nachweis, alle Werkzeuge ruhen. */
  off: boolean;
}) {
  return (
    <nav className={`l2d-rail${off ? ' is-off' : ''}`} aria-label={t('tools')}>
      {TOOLS.map((k) => {
        const off = locked && EDIT_TOOLS.includes(k.key);
        return (
          <button key={k.key} type="button" className={`l2d-railbtn${tool === k.key ? ' is-on' : ''}${off ? ' is-locked' : ''}`} aria-pressed={tool === k.key}
            onClick={() => onTool(k.key)} title={off ? `${t(k.label)} — ${t('pauseToEdit')}` : t(k.label)}>
            <ToolIcon tool={k.key} />
            <span>{t(k.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Swatch({ color }: { color: string }) {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill={color} stroke="currentColor" strokeOpacity="0.35" /></svg>;
}

/** Ein Regler mit Wert. */
function Range({ label, value, unit, min, max, step = 1, digits = 0, onChange }: { label: string; value: number; unit: string; min: number; max: number; step?: number; digits?: number; onChange: (v: number) => void }) {
  return (
    <label className="l2d-range">
      <span>{label}</span>
      <output>{num(value, digits)} {unit}</output>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.currentTarget.value))} />
    </label>
  );
}

export interface ToolSettings {
  readonly addKind: ObjectKind;
  readonly material: string;
  readonly wallMaterial: string;
  readonly brushMm: number;
  readonly tempC: number;
  readonly saltPct: number;
}

/** Das Feld des gewählten Werkzeugs (nur für Dodaj, Maluj, Gumka, Ścianka). */
export function ToolOptions({ tool, s, onChange, onClose }: {
  tool: Tool;
  s: ToolSettings;
  onChange: (patch: Partial<ToolSettings>) => void;
  onClose: () => void;
}) {
  let body: ReactNode = null;
  if (tool === 'add') {
    body = (
      <div className="l2d-tiles">
        {OBJECT_KINDS.map((k) => (
          <button key={k.key} type="button" className={`l2d-tile${s.addKind === k.key ? ' is-on' : ''}`} aria-pressed={s.addKind === k.key} onClick={() => onChange({ addKind: k.key })}>
            <KindIcon kind={k.key} /><span>{t(k.label)}</span>
          </button>
        ))}
      </div>
    );
  } else if (tool === 'paint') {
    const m = MATERIALS.find((x) => x.key === s.material) ?? MATERIALS[0];
    body = (
      <>
        <div className="l2d-tiles">
          {MATERIALS.map((x) => (
            <button key={x.key} type="button" className={`l2d-tile${s.material === x.key ? ' is-on' : ''}`} aria-pressed={s.material === x.key} onClick={() => onChange({ material: x.key })}>
              <Swatch color={x.color} /><span>{t(x.label)}</span>
            </button>
          ))}
        </div>
        <Range label={t('brush')} value={s.brushMm} unit="mm" min={2} max={30} onChange={(v) => onChange({ brushMm: v })} />
        <Range label={t('paintTemp')} value={s.tempC} unit="°C" min={0} max={200} onChange={(v) => onChange({ tempC: v })} />
        {m.solute !== undefined && <Range label={t('saltConc')} value={s.saltPct} unit="%" min={1} max={26} onChange={(v) => onChange({ saltPct: v })} />}
      </>
    );
  } else if (tool === 'erase') {
    body = <Range label={t('brush')} value={s.brushMm} unit="mm" min={2} max={30} onChange={(v) => onChange({ brushMm: v })} />;
  } else if (tool === 'wall') {
    body = (
      <>
        <div className="l2d-tiles">
          {WALL_MATERIALS.map((x) => (
            <button key={x.key} type="button" className={`l2d-tile${s.wallMaterial === x.key ? ' is-on' : ''}`} aria-pressed={s.wallMaterial === x.key} onClick={() => onChange({ wallMaterial: x.key })}>
              <Swatch color={x.color} /><span>{t(x.label)}</span>
            </button>
          ))}
        </div>
        <Range label={t('paintTemp')} value={s.tempC} unit="°C" min={0} max={200} onChange={(v) => onChange({ tempC: v })} />
      </>
    );
  }
  if (body === null) return null;
  const title: TextKey = tool === 'add' ? 'objects' : tool === 'paint' ? 'materials' : tool === 'erase' ? 'toolErase' : 'toolWall';
  return (
    <section className="l2d-toolopts" aria-label={t(title)} onPointerDown={(e) => e.stopPropagation()}>
      <header><strong>{t(title)}</strong><button type="button" className="l2d-icon is-small" onClick={onClose} aria-label={t('hideOptions')} title={t('hideOptions')}><Icon name="chevron" /></button></header>
      {body}
    </section>
  );
}
