/**
 * LABOR 2D (v2) — DAS FELD „PRZEDMIOT“ (seit 2026-10-23): die Einstellungen
 * des gewählten Gegenstands. „Przypięty“ und die Heizung wirken sofort, auch
 * während es läuft; Werkstoff, Temperatur, Grösse, Drehung und Deckel ändern
 * den Aufbau und gehen am Anfang (vor dem Start oder nach „Od nowa“) — die
 * Szene entsteht dann mit dem geänderten Gegenstand neu. Regler geben ihren
 * Wert erst beim Loslassen weiter (sonst baute jeder Zwischenwert neu auf).
 */

import { useEffect, useState } from 'react';

import { Icon } from '../../ui/icons';
import type { ObjectPatch, ObjectView } from './engine/objects';
import { num, t, type TextKey } from './i18n';

const T0 = 273.15;

/** Werkstoffe eines Klotzes. */
const MATERIALS: readonly { readonly key: string; readonly label: TextKey }[] = [
  { key: 'ice', label: 'matIce' }, { key: 'wood', label: 'matWood' }, { key: 'stone', label: 'matStone' }, { key: 'glass', label: 'matGlass' }, { key: 'steel', label: 'matSteel' }
];

/** Ein Regler, der seinen Wert hält, solange man zieht, und ihn beim Loslassen weitergibt. */
function Slider({ label, unit, value, min, max, step, digits = 0, disabled, onCommit }: {
  label: string; unit: string; value: number; min: number; max: number; step: number; digits?: number; disabled?: boolean; onCommit: (v: number) => void;
}) {
  const [held, setHeld] = useState<number | null>(null);
  useEffect(() => { setHeld(null); }, [value]);
  const shown = held ?? value;
  const commit = (): void => { if (held !== null && held !== value) onCommit(held); };
  return (
    <label className="lab-field">{label}: {num(shown, digits)} {unit}
      <input type="range" min={min} max={max} step={step} value={shown} disabled={disabled}
        onChange={(e) => setHeld(Number(e.currentTarget.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
    </label>
  );
}

const numberOf = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Grösse eines Klotzes aus seinem JSON (die Fläche als Rechteck, sonst ihr umschliessendes). */
function bodySize(op: Record<string, unknown>): [number, number] {
  const region = op.region as Record<string, unknown> | undefined;
  const rect = Array.isArray(region?.rect) ? (region?.rect as number[]) : null;
  if (rect !== null && rect.length === 4) return [rect[2] - rect[0], rect[3] - rect[1]];
  const circle = Array.isArray(region?.circle) ? (region?.circle as number[]) : null;
  if (circle !== null && circle.length === 3) { const s = circle[2] * Math.sqrt(Math.PI); return [s, s]; }
  return [0.02, 0.02];
}

export function ObjectPanel({ op, view, atStart, onPatch, onRemove }: {
  /** Der Gegenstand, wie er im JSON der Szene steht (°C, m). */
  op: Record<string, unknown>;
  /** Wie er jetzt ist (aus den Kennzahlen); null, solange keine kamen. */
  view: ObjectView | null;
  /** Am Anfang (Zeit 0): auch der Aufbau lässt sich ändern. */
  atStart: boolean;
  onPatch: (patch: ObjectPatch) => void;
  onRemove: () => void;
}) {
  const kind = op.op === 'beaker' ? 'beaker' : op.op === 'hotplate' ? 'hotplate' : 'body';
  const material = typeof op.material === 'string' ? op.material : 'wood';
  const id = typeof op.id === 'string' ? op.id : '';
  const pinned = kind === 'body' ? op.pinned === true : op.pinned !== false;
  const T = numberOf(op.T, 20);
  const angle = numberOf(op.angle, 0);
  const [w, h] = kind === 'body' ? bodySize(op) : [numberOf(op.w, 0.07), numberOf(op.h, 0.08)];
  const title = kind === 'beaker' ? t('appBeaker') : kind === 'hotplate' ? t('appHotplate') : t(MATERIALS.find((m) => m.key === material)?.label ?? 'matWood');
  const state = view === null ? '' : view.state === 'gone' ? t('objGone') : t(view.state === 'pinned' ? 'bodyPinned' : view.state === 'asleep' ? 'bodyAsleep' : 'bodyMoving');
  const locked = !atStart;
  const sizeMax = 200;
  const hMax = kind === 'hotplate' ? 20 : kind === 'beaker' ? 150 : 200;
  return (
    <div className="lab-section-body">
      <p className="l2d-obj-title"><strong>{title}</strong> <span className="lab-muted">{t('objName')}: {id}</span></p>
      {view !== null && (
        <p className="lab-muted">{t('objNow')}: {view.state === 'gone' ? state : `${num(view.T - T0, 1)} °C · ${num(view.mass * 1000, view.mass < 0.01 ? 2 : 0)} g · ${state}`}</p>
      )}
      <label className="lab-row"><input type="checkbox" checked={pinned} onChange={(e) => onPatch({ pinned: e.currentTarget.checked })} />{t('objPinned')}</label>
      {kind === 'hotplate' && (
        <>
          <label className="lab-row"><input type="checkbox" checked={op.on !== false} onChange={(e) => onPatch({ on: e.currentTarget.checked })} />{t('heaterOn')}</label>
          <label className="lab-field">{t('heaterMode')}
            <select value={op.mode === 'thermostat' ? 'thermostat' : 'power'} onChange={(e) => onPatch({ mode: e.currentTarget.value === 'thermostat' ? 'thermostat' : 'power' })}>
              <option value="power">{t('modePower')}</option>
              <option value="thermostat">{t('modeThermostat')}</option>
            </select>
          </label>
          <Slider label={t('heaterPower')} unit="W" value={numberOf(op.power, 40)} min={0} max={150} step={1} onCommit={(v) => onPatch({ power: v })} />
          {op.mode === 'thermostat' && <Slider label={t('heaterTarget')} unit="°C" value={numberOf(op.target, 150)} min={30} max={400} step={1} onCommit={(v) => onPatch({ target: T0 + v })} />}
        </>
      )}
      {kind === 'body' && (
        <label className="lab-field">{t('objMaterial')}
          <select value={material} disabled={locked} onChange={(e) => onPatch({ material: e.currentTarget.value })}>
            {MATERIALS.map((m) => <option key={m.key} value={m.key}>{t(m.label)}</option>)}
          </select>
        </label>
      )}
      <Slider label={t('objTemp')} unit="°C" value={T} min={-40} max={200} step={1} disabled={locked} onCommit={(v) => onPatch({ T: T0 + v })} />
      <Slider label={t('objWidth')} unit="mm" value={Math.round(w * 1000)} min={kind === 'body' ? 2 : 20} max={sizeMax} step={1} disabled={locked} onCommit={(v) => onPatch({ w: v / 1000 })} />
      <Slider label={t('objHeight')} unit="mm" value={Math.round(h * 1000)} min={2} max={hMax} step={1} disabled={locked} onCommit={(v) => onPatch({ h: v / 1000 })} />
      <Slider label={t('objAngle')} unit="°" value={angle} min={-90} max={90} step={1} disabled={locked} onCommit={(v) => onPatch({ angle: v })} />
      {kind === 'beaker' && <label className="lab-row"><input type="checkbox" checked={op.lid === true} disabled={locked} onChange={(e) => onPatch({ lid: e.currentTarget.checked })} />{t('objLid')}</label>}
      {locked && <p className="lab-muted">{t('objAtStart')}</p>}
      <div className="lab-row">
        <button type="button" className="lab-tool" onClick={onRemove}><Icon name="trash" />{t('objRemove')}</button>
      </div>
    </div>
  );
}
