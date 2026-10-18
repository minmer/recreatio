/**
 * 2026-10-17 — DIE BEDIENUNG UNTER (ODER NEBEN) DEM BILD ZUM ANFASSEN:
 * Schieber, Zahlen, Schalter, Wahl, Knöpfe, Anzeigen — und, 2026-10-18, die
 * Werkstatt einer Welt (seit 2026-10-18 in `LiveWorldPanel.tsx`; hier, was
 * sie mit der übrigen Bedienung teilt).
 *
 * React baut die Elemente (neu, wenn ein anderes Ding gewählt wird oder sich
 * der Bau ändert); die Werte darin schreibt die Schleife (`LiveDrawing.tsx`),
 * über `data-c`, `data-prop`, `data-ro` und `data-w` — ein laufendes Bild
 * rendert React nicht sechzigmal in der Sekunde neu.
 */

import { fmt, toNum, truth } from './expr';
import type { Program } from './liveRun';
import type { ControlSpec, PropSpec, VarSpec } from './liveModel';
import { readShot, type WorldShot } from './liveThings';

/** Wie viele Stellen eine Zahl braucht — so viele, wie ihr Schritt hat (0,25 → zwei, 0,5 → eine). */
export function digitsOf(step: number | null, given: number | null): number {
  if (given !== null) return given;
  if (step === null) return 2;
  for (let d = 0; d < 4; d += 1) if (Math.abs(step * 10 ** d - Math.round(step * 10 ** d)) < 1e-9) return d;
  return 4;
}

/** Eine Zahl mit ihrer Einheit — Grad und Prozent ohne Abstand, wie im Polnischen. */
export function withUnit(value: number, digits: number, unit: string): string {
  const n = fmt(value, digits);
  if (unit === '') return n;
  /* Dazwischen ein fester Abstand (U+00A0): „9,81 m/s²" bricht nicht um. */
  return /^[°%′″]/.test(unit) ? `${n}${unit}` : `${n} ${unit}`;
}

export function rangeOf(spec: VarSpec | undefined): { min: number; max: number; step: number } {
  const value = spec?.value ?? 0;
  const min = spec?.min ?? Math.min(0, value - Math.max(1, Math.abs(value)));
  const max = spec?.max ?? Math.max(min + 1, value + Math.max(1, Math.abs(value)));
  return { min, max, step: spec?.step ?? (max - min) / 100 };
}

/** Die Grenzen einer Eigenschaft für einen Schieber — offene Grenzen werden ein Stück um den Wert. */
export function propRange(spec: PropSpec, bounds: { min: number; max: number; step: number | null }, value: number): { min: number; max: number; step: number } {
  const span = Math.max(1, Math.abs(value));
  const min = bounds.min > -1e8 ? bounds.min : value - 10 * span;
  const max = bounds.max < 1e8 ? Math.max(bounds.max, min) : value + 10 * span;
  return { min, max, step: spec.step ?? ((max - min) / 100 || 0.01) };
}

export function ControlView({ c, i, program, onSet, onPress, locked }: {
  c: ControlSpec;
  i: number;
  program: Program;
  onSet: (name: string, value: number) => void;
  onPress: (index: number) => void;
  locked: boolean;
}) {
  switch (c.type) {
    case 'slider': {
      const spec = program.varOf(c.var);
      const r = rangeOf(spec);
      const label = c.label || spec?.label || c.var;
      return (
        <label className="lv-control lv-slider" data-c={i}>
          <span className="lv-name">{label}</span>
          <output className="lv-value" />
          <input type="range" min={r.min} max={r.max} step={r.step} defaultValue={program.value(c.var)} disabled={locked}
            onInput={(e) => onSet(c.var, e.currentTarget.valueAsNumber)} onChange={(e) => onSet(c.var, e.currentTarget.valueAsNumber)} />
        </label>
      );
    }
    case 'number': {
      const spec = program.varOf(c.var);
      const r = rangeOf(spec);
      return (
        <label className="lv-control lv-number" data-c={i}>
          <span className="lv-name">{c.label || spec?.label || c.var}</span>
          <span className="lv-number-row">
            <input type="number" inputMode="decimal" min={spec?.min ?? undefined} max={spec?.max ?? undefined} step={r.step} defaultValue={program.value(c.var)} disabled={locked}
              onChange={(e) => { const n = toNum(e.currentTarget.value); if (Number.isFinite(n)) onSet(c.var, n); }} />
            {(c.unit || spec?.unit) && <span className="lv-unit">{c.unit || spec?.unit}</span>}
          </span>
        </label>
      );
    }
    case 'toggle': {
      const spec = program.varOf(c.var);
      return (
        <label className="lv-control lv-toggle" data-c={i}>
          <input type="checkbox" defaultChecked={truth(program.value(c.var))} disabled={locked} onChange={(e) => onSet(c.var, e.currentTarget.checked ? 1 : 0)} />
          <span>{c.label || spec?.label || c.var}</span>
        </label>
      );
    }
    case 'choice': {
      const spec = program.varOf(c.var);
      const label = c.label || spec?.label || c.var;
      return (
        <div className="lv-control lv-choice" data-c={i} role="group" aria-label={label}>
          <span className="lv-name">{label}</span>
          <span className="lv-choice-row">
            {c.options.map((o, n) => (
              <button key={n} type="button" aria-pressed={program.value(c.var) === o.value} disabled={locked} onClick={() => onSet(c.var, o.value)}>{o.label}</button>
            ))}
          </span>
        </div>
      );
    }
    case 'button':
      return (
        <button type="button" className={`wk-btn${c.do === 'reset' ? ' wk-btn-line' : ''} lv-control lv-button`} data-c={i} disabled={locked} onClick={() => onPress(i)}>
          {c.label}
        </button>
      );
    case 'readout':
      return (
        <div className="lv-control lv-readout" data-c={i}>
          <span className="lv-name">{c.label}</span>
          <output className="lv-value" />
        </div>
      );
  }
}

/* -- 2026-10-18: die Werkstatt einer Welt ------------------------------------------------------- */

/** Was man in der Werkstatt tun kann — die Schleife führt es aus. */
export type WorldAct =
  | { readonly type: 'undo' | 'redo' | 'reset' | 'toggle' | 'predict' | 'task' | 'endEdit' | 'save' | 'load' }
  | { readonly type: 'add'; readonly kind: string; readonly parent: string | null }
  | { readonly type: 'remove' | 'copy'; readonly id: string }
  | { readonly type: 'select'; readonly id: string | null }
  | { readonly type: 'edit'; readonly id: string; readonly prop: string; readonly value: number }
  | { readonly type: 'cam'; readonly cmd: 'in' | 'out' | 'fit' }
  | { readonly type: 'import'; readonly shot: WorldShot };

/**
 * Was der Knopf zum Vermuten gerade tut: angehalten — prüfen („Sprawdź");
 * nach einer Prüfung in einer Aufgabe — neu vermuten („Popraw"); sonst — anhalten
 * und vermuten („Przewiduj").
 */
export function predictLabel(program: Program): string {
  const p = program.predict;
  if (p === null) return '';
  return program.held ? p.check : p.start ? p.again : p.hold;
}

/** Ein Bau aus Text (JSON) — `null`: kein JSON, oder keine Dinge darin. */
export function shotOfText(text: string): WorldShot | null {
  try { return readShot(JSON.parse(text) as unknown); } catch { return null; }
}
