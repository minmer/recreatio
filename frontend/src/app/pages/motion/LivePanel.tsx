/**
 * 2026-10-17 — DIE BEDIENUNG UNTER (ODER NEBEN) DEM BILD ZUM ANFASSEN:
 * Schieber, Zahlen, Schalter, Wahl, Knöpfe, Anzeigen — und, 2026-10-18, die
 * Werkstatt einer Welt: Cofnij/Ponów, Od nowa, Hinzufügen, und für das
 * gewählte Ding, was man an ihm einstellen darf, seine Anzeigen, Anhängen,
 * Kopieren, Entfernen.
 *
 * React baut die Elemente (neu, wenn ein anderes Ding gewählt wird oder sich
 * der Bau ändert); die Werte darin schreibt die Schleife (`LiveDrawing.tsx`),
 * über `data-c`, `data-prop`, `data-ro` und `data-w` — ein laufendes Bild
 * rendert React nicht sechzigmal in der Sekunde neu.
 */

import { useState } from 'react';

import { fmt, toNum, truth } from './expr';
import type { Program } from './liveRun';
import type { ControlSpec, PropSpec, VarSpec } from './liveModel';
import type { WorldShot } from './liveWorld';

/** Wie viele Stellen eine Zahl braucht — aus dem Schritt ihres Werts. */
export function digitsOf(step: number | null, given: number | null): number {
  if (given !== null) return given;
  if (step === null) return 2;
  return Math.max(0, Math.min(4, Math.ceil(-Math.log10(step) - 1e-9)));
}

/** Eine Zahl mit ihrer Einheit — Grad und Prozent ohne Abstand, wie im Polnischen. */
export function withUnit(value: number, digits: number, unit: string): string {
  const n = fmt(value, digits);
  if (unit === '') return n;
  return /^[°%′″]/.test(unit) ? `${n}${unit}` : `${n} ${unit}`;
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
  | { readonly type: 'undo' | 'redo' | 'reset' | 'toggle' | 'endEdit' | 'save' | 'load' }
  | { readonly type: 'add'; readonly kind: string; readonly parent: string | null }
  | { readonly type: 'remove' | 'copy'; readonly id: string }
  | { readonly type: 'select'; readonly id: string | null }
  | { readonly type: 'edit'; readonly id: string; readonly prop: string; readonly value: number }
  | { readonly type: 'cam'; readonly cmd: 'in' | 'out' | 'fit' }
  | { readonly type: 'import'; readonly shot: WorldShot };

/** Ein Bau aus Text (JSON) — nur, was wie Dinge aussieht; der Rest fällt weg. */
export function shotOfText(text: string): WorldShot | null {
  try {
    const value = JSON.parse(text) as unknown;
    const list = Array.isArray(value) ? value : typeof value === 'object' && value !== null ? (value as { things?: unknown }).things : null;
    if (!Array.isArray(list)) return null;
    const things = list.slice(0, 200).flatMap((raw) => {
      if (typeof raw !== 'object' || raw === null) return [];
      const r = raw as Record<string, unknown>;
      if (typeof r.id !== 'string' || typeof r.kind !== 'string') return [];
      const props: Record<string, number> = {};
      for (const [k, v] of Object.entries(typeof r.props === 'object' && r.props !== null ? r.props as Record<string, unknown> : {})) {
        if (typeof v === 'number' && Number.isFinite(v)) props[k] = v;
      }
      return [{ id: r.id.slice(0, 32), kind: r.kind.slice(0, 32), parent: typeof r.parent === 'string' ? r.parent.slice(0, 32) : null, props }];
    });
    return things.length === 0 ? null : { things };
  } catch {
    return null;
  }
}

export function WorldPanel({ program, selected, version, locked, cameras, onAct }: {
  program: Program;
  selected: string | null;
  /** Ändert sich mit dem Bau — dann wird neu gebaut (was man anhängen darf, ändert sich mit). */
  version: number;
  locked: boolean;
  cameras: boolean;
  onAct: (act: WorldAct) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [textBad, setTextBad] = useState(false);
  const world = program.world;
  if (world === null) return null;
  void version;
  const t = selected === null ? undefined : world.get(selected);
  const roots = world.addable(null);
  const label = (kind: string) => world.kinds.get(kind)?.spec.label ?? kind;
  const props = t === undefined ? [] : world.editable(t);
  const readouts = t?.kind.spec.readouts ?? [];
  const children = t === undefined ? [] : world.addable(t);
  return (
    <div className="lv-world-panel">
      <div className="lv-tools" role="toolbar" aria-label="Warsztat">
        <button type="button" className="wk-btn wk-btn-line" data-w="undo" disabled={locked} title="Cofnij (Ctrl+Z)" onClick={() => onAct({ type: 'undo' })}>↶ Cofnij</button>
        <button type="button" className="wk-btn wk-btn-line" data-w="redo" disabled={locked} title="Ponów (Ctrl+Y)" onClick={() => onAct({ type: 'redo' })}>↷ Ponów</button>
        <button type="button" className="wk-btn wk-btn-line" data-w="reset" disabled={locked} onClick={() => onAct({ type: 'reset' })}>Od nowa</button>
        {program.sim !== null && (
          <button type="button" className="wk-btn wk-btn-line" data-w="toggle" disabled={locked} onClick={() => onAct({ type: 'toggle' })}>Pauza</button>
        )}
        {cameras && (
          <span className="lv-cam-tools" role="group" aria-label="Widok">
            <button type="button" className="wk-btn wk-btn-line" aria-label="Przybliż" onClick={() => onAct({ type: 'cam', cmd: 'in' })}>+</button>
            <button type="button" className="wk-btn wk-btn-line" aria-label="Oddal" onClick={() => onAct({ type: 'cam', cmd: 'out' })}>−</button>
            <button type="button" className="wk-btn wk-btn-line" data-w="fit" onClick={() => onAct({ type: 'cam', cmd: 'fit' })}>Dopasuj</button>
          </span>
        )}
        {world.spec.save && (
          <>
            <button type="button" className="wk-btn wk-btn-line" disabled={locked} onClick={() => onAct({ type: 'save' })}>Zapisz</button>
            <button type="button" className="wk-btn wk-btn-line" data-w="load" disabled={locked} onClick={() => onAct({ type: 'load' })}>Wczytaj</button>
            <button type="button" className="wk-btn wk-btn-line" aria-expanded={text !== null}
              onClick={() => { setTextBad(false); setText(text === null ? JSON.stringify(program.worldSnapshot(), null, 1) : null); }}>JSON</button>
          </>
        )}
      </div>
      {text !== null && (
        <div className="lv-json">
          <textarea value={text} rows={6} spellCheck={false} aria-label="Układ jako JSON" onChange={(e) => { setText(e.currentTarget.value); setTextBad(false); }} />
          <button type="button" className="wk-btn" disabled={locked} onClick={() => {
            const shot = shotOfText(text);
            if (shot === null) { setTextBad(true); return; }
            onAct({ type: 'import', shot });
            setText(null);
          }}>Wczytaj ten układ</button>
          {textBad && <p className="wk-error">To nie jest układ (JSON z listą „things").</p>}
        </div>
      )}
      {roots.length > 0 && (
        <div className="lv-add" role="group" aria-label="Dodaj">
          {roots.map((k) => (
            <button key={k} type="button" className="wk-btn wk-btn-line" disabled={locked} onClick={() => onAct({ type: 'add', kind: k, parent: null })}>+ {label(k)}</button>
          ))}
        </div>
      )}
      {t === undefined
        ? world.spec.hint !== '' && <p className="lv-hint">{world.spec.hint}</p>
        : (
          <section className="lv-inspector" aria-label={`${t.kind.spec.label} ${t.id}`}>
            <header className="lv-inspector-head">
              <strong>{t.kind.spec.label}</strong>
              <span className="lv-id">{t.id}</span>
              <button type="button" className="lv-close" aria-label="Zamknij" onClick={() => onAct({ type: 'select', id: null })}>×</button>
            </header>
            {props.map((p) => {
              const name = p.label || p.name;
              const edit = (value: number) => onAct({ type: 'edit', id: t.id, prop: p.name, value });
              const nudge = (dir: number) => {
                const r = propRange(p, world.bounds(t, p.name), toNum(t.env[p.name]));
                edit(toNum(t.env[p.name]) + dir * r.step);
                onAct({ type: 'endEdit' });
              };
              return (
                <div key={p.name} className="lv-control lv-prop" data-prop={p.name}>
                  <span className="lv-name">{name}</span>
                  <output className="lv-value" />
                  <span className="lv-prop-row">
                    <button type="button" className="lv-step" aria-label={`${name}: mniej`} disabled={locked} onClick={() => nudge(-1)}>−</button>
                    <input type="range" aria-label={name} disabled={locked}
                      onInput={(e) => edit(e.currentTarget.valueAsNumber)} onChange={() => onAct({ type: 'endEdit' })} />
                    <button type="button" className="lv-step" aria-label={`${name}: więcej`} disabled={locked} onClick={() => nudge(1)}>+</button>
                    <input type="number" inputMode="decimal" className="lv-prop-num" aria-label={`${name} (liczba)`} disabled={locked}
                      onChange={(e) => { const n = toNum(e.currentTarget.value); if (Number.isFinite(n)) { edit(n); onAct({ type: 'endEdit' }); } }} />
                  </span>
                </div>
              );
            })}
            {readouts.length > 0 && (
              <div className="lv-readouts">
                {readouts.map((r, i) => (
                  <div key={i} className="lv-control lv-readout" data-ro={i}>
                    <span className="lv-name">{r.label}</span>
                    <output className="lv-value" />
                  </div>
                ))}
              </div>
            )}
            {(children.length > 0 || world.canCopy(t) || world.canRemove(t)) && (
              <div className="lv-thing-actions">
                {children.map((k) => (
                  <button key={k} type="button" className="wk-btn wk-btn-line" disabled={locked} onClick={() => onAct({ type: 'add', kind: k, parent: t.id })}>+ {label(k)}</button>
                ))}
                {world.canCopy(t) && <button type="button" className="wk-btn wk-btn-line" disabled={locked} onClick={() => onAct({ type: 'copy', id: t.id })}>Powiel</button>}
                {world.canRemove(t) && <button type="button" className="wk-btn wk-btn-line" disabled={locked} onClick={() => onAct({ type: 'remove', id: t.id })}>Usuń</button>}
              </div>
            )}
          </section>
        )}
    </div>
  );
}
