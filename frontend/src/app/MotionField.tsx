/**
 * 0107/0108 — RUCH EINSTELLEN: bis zu drei Bewegungen aus dem Wörterbuch
 * (`motion.ts`) — ein Grundwort (move, size, turn, fade, draw, color, reveal,
 * keys) mit seinem Woher und Wohin, oder eine Vorlage mit ihren Reglern; dazu
 * Verzögerung, Dauer, Wiederholung und Übergang. Gebraucht im Editor der
 * Slajdy und der Präsentation, bei den Ebenen eines Bildes aus Schichten und
 * bei den Schichten der Luft.
 */

import { useState } from 'react';

import { MAX_MOTIONS, MOTIONS, motionDef, motionUseJson, readMotionUse, type MotionUse } from './motion';

const REPEAT_LABEL: Record<string, string> = { '': 'jak zwykle', once: 'raz (po dotarciu)', loop: 'w kółko', alternate: 'tam i z powrotem' };
const EASE_LABEL: Record<string, string> = { '': 'jak zwykle', linear: 'równo', ease: 'łagodnie', in: 'przyspiesza', out: 'hamuje', inOut: 'rusza i hamuje', step: 'skokiem' };

/** Die Klatki als Text — für `keys`, ein Feld, das sich prüft, bevor es übernimmt. */
function KeysField({ use, busy, onChange }: { use: MotionUse; busy: boolean; onChange: (next: MotionUse) => void }) {
  const [text, setText] = useState(() => JSON.stringify(use.keys ?? [{ at: 0, opacity: 0 }, { at: 1, opacity: 1 }]));
  const [bad, setBad] = useState(false);
  return (
    <label className="wk-field">
      <span>Klatki (JSON): [{'{'} "at": 0–1, "x", "y", "scale", "rotate", "opacity", "color" … {'}'}]</span>
      <textarea rows={4} value={text} spellCheck={false} disabled={busy} aria-invalid={bad}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const next = readMotionUse({ ...motionUseJson(use), keys: JSON.parse(e.target.value) });
            setBad(next === null || next.keys === null);
            if (next !== null && next.keys !== null) onChange(next);
          } catch { setBad(true); }
        }} />
    </label>
  );
}

export function MotionField({ value, busy, onChange, kinds = 'all', label = 'Ruch' }: {
  value: readonly MotionUse[];
  busy: boolean;
  onChange: (next: MotionUse[]) => void;
  /** Welche Arten zur Wahl stehen — bei einer Schicht nur Schleifen. */
  kinds?: 'all' | 'enter' | 'loop';
  label?: string;
}) {
  const offered = MOTIONS.filter((def) => kinds === 'all' || def.verb || def.kind === kinds);
  const replace = (index: number, next: MotionUse | null) => {
    if (next !== null) onChange(value.map((one, i) => (i === index ? next : one)));
  };
  const patch = (index: number, change: Record<string, unknown>) => {
    const merged: Record<string, unknown> = { ...motionUseJson(value[index]), ...change };
    for (const key of Object.keys(change)) if (change[key] === null || change[key] === '') delete merged[key];
    replace(index, readMotionUse(merged));
  };
  const number = (raw: string): number | null => (raw.trim() === '' ? null : Number(raw));

  return (
    <div className="mo-field">
      <span className="mo-field-label">{label}</span>
      {value.length === 0 && <p className="wk-hint">Bez ruchu.</p>}
      {value.map((use, index) => {
        const def = motionDef(use.name);
        const pair = use.name === 'move' || (use.name === 'size' && Array.isArray(use.to));
        return (
          <fieldset key={index} className="mo-row">
            <legend>
              <select value={use.name} disabled={busy} aria-label="Rodzaj ruchu"
                onChange={(e) => replace(index, readMotionUse({ name: e.target.value }))}>
                <optgroup label="Słowa — co się zmienia">
                  {offered.filter((d) => d.verb).map((d) => <option key={d.name} value={d.name}>{d.label}</option>)}
                </optgroup>
                <optgroup label="Gotowe (pokaz Cogita)">
                  {offered.filter((d) => !d.verb).map((d) => <option key={d.name} value={d.name}>{d.label}</option>)}
                </optgroup>
              </select>
              <button type="button" className="se-drop" aria-label="Usuń ruch" disabled={busy}
                onClick={() => onChange(value.filter((_, i) => i !== index))}>×</button>
            </legend>
            {def !== undefined && <span className="wk-hint">{def.says}.</span>}

            {use.name === 'keys' ? (
              <KeysField use={use} busy={busy} onChange={(next) => replace(index, next)} />
            ) : use.name === 'color' ? (
              <div className="mo-pair">
                <label className="se-inline"><span>Z koloru</span>
                  <input value={typeof use.from === 'string' ? use.from : ''} disabled={busy} placeholder="#8cc8ff" onChange={(e) => patch(index, { from: e.target.value })} />
                </label>
                <label className="se-inline"><span>Na kolor</span>
                  <input value={typeof use.to === 'string' ? use.to : ''} disabled={busy} placeholder="accent" onChange={(e) => patch(index, { to: e.target.value })} />
                </label>
              </div>
            ) : def?.verb === true ? (
              <div className="mo-pair">
                {pair ? (
                  <>
                    <label className="se-inline"><span>Do x</span>
                      <input type="number" step="any" value={Array.isArray(use.to) ? use.to[0] : ''} disabled={busy} placeholder="0"
                        onChange={(e) => patch(index, { to: [number(e.target.value) ?? 0, Array.isArray(use.to) ? use.to[1] : 0] })} />
                    </label>
                    <label className="se-inline"><span>Do y</span>
                      <input type="number" step="any" value={Array.isArray(use.to) ? use.to[1] : ''} disabled={busy} placeholder="0"
                        onChange={(e) => patch(index, { to: [Array.isArray(use.to) ? use.to[0] : 0, number(e.target.value) ?? 0] })} />
                    </label>
                    {use.path !== null && <span className="wk-hint">Droga przez {use.path.length} punktów (z JSON).</span>}
                  </>
                ) : (
                  <>
                    <label className="se-inline"><span>Od</span>
                      <input type="number" step="any" value={typeof use.from === 'number' ? use.from : ''} disabled={busy} onChange={(e) => patch(index, { from: number(e.target.value) })} />
                    </label>
                    <label className="se-inline"><span>Do</span>
                      <input type="number" step="any" value={typeof use.to === 'number' ? use.to : ''} disabled={busy} onChange={(e) => patch(index, { to: number(e.target.value) })} />
                    </label>
                  </>
                )}
              </div>
            ) : null}

            <label className="se-inline">
              <span>Opóźnienie (ms)</span>
              <input type="number" step={10} value={use.delay ?? ''} placeholder={String(def?.delay ?? 0)} disabled={busy}
                onChange={(e) => patch(index, { delay: number(e.target.value) })} />
            </label>
            <label className="se-inline">
              <span>Czas (ms)</span>
              <input type="number" step={10} min={50} value={use.duration ?? ''} placeholder={String(def?.duration ?? '')} disabled={busy}
                onChange={(e) => patch(index, { duration: number(e.target.value) })} />
            </label>
            <label className="se-inline">
              <span>Powtarzanie</span>
              <select value={typeof use.repeat === 'string' ? use.repeat : ''} disabled={busy} onChange={(e) => patch(index, { repeat: e.target.value })}>
                {Object.entries(REPEAT_LABEL).map(([key, said]) => <option key={key} value={key}>{said}</option>)}
              </select>
            </label>
            <label className="se-inline">
              <span>Przejście</span>
              <select value={use.ease !== null && EASE_LABEL[use.ease] !== undefined ? use.ease : ''} disabled={busy} onChange={(e) => patch(index, { ease: e.target.value })}>
                {Object.entries(EASE_LABEL).map(([key, said]) => <option key={key} value={key}>{said}</option>)}
              </select>
            </label>
            {def !== undefined && Object.entries(def.params).map(([key, p]) => (
              <label key={key} className="se-inline">
                <span>{p.label}</span>
                <input type="number" step="any" min={p.min} max={p.max} value={use.params[key] ?? ''} placeholder={String(p.value)} disabled={busy}
                  onChange={(e) => patch(index, { [key]: number(e.target.value) })} />
              </label>
            ))}
          </fieldset>
        );
      })}
      {value.length < MAX_MOTIONS && (
        <button type="button" className="wk-link-btn" disabled={busy}
          onClick={() => { const first = readMotionUse({ name: kinds === 'loop' ? 'float' : 'rise' }); if (first !== null) onChange([...value, first]); }}>
          + Ruch
        </button>
      )}
    </div>
  );
}

export default MotionField;
