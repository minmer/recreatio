/**
 * 0107 — RUCH EINSTELLEN: bis zu drei Bewegungen aus dem Wörterbuch
 * (`motion.ts`), je mit Verzögerung, Dauer und ihren Reglern. Gebraucht im
 * Editor der Slajdy (der Baustein auf seinem Slajd), bei den Ebenen eines
 * Bildes aus Schichten und bei den Schichten der Luft (Dunst, Nici, Fale).
 */

import { MAX_MOTIONS, MOTIONS, motionDef, readMotionUse, type MotionUse } from './motion';

export function MotionField({ value, busy, onChange, kinds = 'all', label = 'Ruch' }: {
  value: readonly MotionUse[];
  busy: boolean;
  onChange: (next: MotionUse[]) => void;
  /** Welche Arten zur Wahl stehen — bei einer Schicht nur Schleifen. */
  kinds?: 'all' | 'enter' | 'loop';
  label?: string;
}) {
  const offered = MOTIONS.filter((def) => kinds === 'all' || def.kind === kinds);
  const set = (index: number, patch: Record<string, unknown>) => {
    const now = value[index];
    const merged = readMotionUse({ name: now.name, duration: now.duration, delay: now.delay, ...now.params, ...patch });
    if (merged === null) return;
    onChange(value.map((one, i) => (i === index ? merged : one)));
  };
  const number = (raw: string): number | null => (raw.trim() === '' ? null : Number(raw));

  return (
    <div className="mo-field">
      <span className="mo-field-label">{label}</span>
      {value.length === 0 && <p className="wk-hint">Bez ruchu.</p>}
      {value.map((use, index) => {
        const def = motionDef(use.name);
        return (
          <fieldset key={index} className="mo-row">
            <legend>
              <select value={use.name} disabled={busy} aria-label="Rodzaj ruchu"
                onChange={(e) => {
                  const next = readMotionUse({ name: e.target.value });
                  if (next !== null) onChange(value.map((one, i) => (i === index ? next : one)));
                }}>
                {kinds !== 'loop' && <optgroup label="Wejście — raz, gdy slajd zostaje osiągnięty">
                  {offered.filter((d) => d.kind === 'enter').map((d) => <option key={d.name} value={d.name}>{d.label}</option>)}
                </optgroup>}
                {kinds !== 'enter' && <optgroup label="W pętli — dopóki widać">
                  {offered.filter((d) => d.kind === 'loop').map((d) => <option key={d.name} value={d.name}>{d.label}</option>)}
                </optgroup>}
              </select>
              <button type="button" className="se-drop" aria-label="Usuń ruch" disabled={busy}
                onClick={() => onChange(value.filter((_, i) => i !== index))}>×</button>
            </legend>
            {def !== undefined && <span className="wk-hint">{def.says}.</span>}
            <label className="se-inline">
              <span>Opóźnienie (ms)</span>
              <input type="number" step={10} value={use.delay ?? ''} placeholder={String(def?.delay ?? 0)} disabled={busy}
                onChange={(e) => set(index, { delay: number(e.target.value) })} />
            </label>
            <label className="se-inline">
              <span>Czas (ms)</span>
              <input type="number" step={10} min={50} value={use.duration ?? ''} placeholder={String(def?.duration ?? '')} disabled={busy}
                onChange={(e) => set(index, { duration: number(e.target.value) })} />
            </label>
            {def !== undefined && Object.entries(def.params).map(([key, p]) => (
              <label key={key} className="se-inline">
                <span>{p.label}</span>
                <input type="number" step="any" min={p.min} max={p.max} value={use.params[key] ?? ''} placeholder={String(p.value)} disabled={busy}
                  onChange={(e) => {
                    const v = number(e.target.value);
                    const params = { ...use.params };
                    if (v === null) delete params[key]; else params[key] = v;
                    const merged = readMotionUse({ name: use.name, duration: use.duration, delay: use.delay, ...params });
                    if (merged !== null) onChange(value.map((one, i) => (i === index ? merged : one)));
                  }} />
              </label>
            ))}
          </fieldset>
        );
      })}
      {value.length < MAX_MOTIONS && (
        <button type="button" className="wk-link-btn" disabled={busy}
          onClick={() => { const first = readMotionUse({ name: offered[0]?.name ?? 'rise' }); if (first !== null) onChange([...value, first]); }}>
          + Ruch
        </button>
      )}
    </div>
  );
}

export default MotionField;
