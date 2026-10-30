/**
 * DIE AUSWAHL EINES WIDOKU BEARBEITEN (2026-10-22, Schritt 9): Quellen
 * (Wszystko, Rodzaj, Zbiór, Lista, Z wpisu — mehrere am Anfang zählen zusammen,
 * Schritt 10), dann Schritte — „Idź po odwołaniu", „Filtr" —, wonach das
 * Drzewo gruppiert und (Schritt 10) was Zeilen und Spalten der Macierz sind.
 * 2026-10-23 (Schritt 5): eine Achse ist ein Rodzaj — mit dem Feld, über das
 * man zu ihr gehört, einer Reihenfolge und Überschriften (`AxisSettings`).
 * 2026-10-30: „Filtr znajomości" (die eine Logik, auch über die Kenntnis) und
 * „Idź po kolejności nauki".
 * Dieselben Felder wie an den Knoten einer Powtórka (`nodeFields.ts`, Palette
 * `view`), gezeichnet von derselben Eingabe (`ConfigInput`).
 */

import type { FieldKey } from './GraphEditor';
import { ConfigInput } from './GraphEditor';
import { configFields } from './nodeFields';
import { isSource, RETIRED_STEP, RETIRED_TOPIC, SOURCE_TYPES, STEP_WORDS, type Grouping, type Step, type StepType } from './selection';
import type { CogitaLibrary } from './store';
import { useState } from 'react';

import { EntityPicker, useCtx } from './ui';
import { AXIS_COLUMN, axesOf, type ViewDoc } from './views';
import type { Axis } from './selection';

/** Die Verweisfelder, nach Rodzaj gruppiert — für „Idź po odwołaniu" (auch in der Powtórka). */
export function refFieldKeys(lib: CogitaLibrary): FieldKey[] {
  const out: FieldKey[] = [];
  const seen = new Set<string>();
  for (const kind of lib.materialKinds) {
    for (const f of kind.fields) {
      if (f.type !== 'ref' || seen.has(`${kind.id}:${f.key}`)) continue;
      seen.add(`${kind.id}:${f.key}`);
      out.push({ key: f.key, label: f.label, group: kind.name });
    }
  }
  return out;
}

/** Alle kurzen Felder, mit Rodzaj — wonach gruppiert werden kann, was eine Spalte sein kann. */
export function shortFieldKeys(lib: CogitaLibrary): FieldKey[] {
  const out: FieldKey[] = [];
  const seen = new Set<string>();
  for (const kind of lib.materialKinds) {
    for (const f of kind.fields) {
      if (f.type === 'markup' || f.type === 'text' || f.type === 'blocks' || f.type === 'media' || seen.has(f.key)) continue;
      seen.add(f.key);
      out.push({ key: f.key, label: `${f.label} (${kind.name})` });
    }
  }
  return out;
}

const groupWord = (g: Grouping | null): string => (g === null || g.by === 'kind' ? 'kind' : g.by === 'level' ? 'level' : g.by === 'field' ? `field:${g.field}` : `axis:${g.kind}`);
const groupOfWord = (word: string, was: Grouping | null): Grouping => {
  if (word === 'level') return { by: 'level' };
  if (word.startsWith('field:')) return { by: 'field', field: word.slice(6) };
  if (word.startsWith('axis:')) {
    const kind = word.slice(5);
    return was !== null && was.by === 'axis' && was.kind === kind ? was : { by: 'axis', kind, via: [] };
  }
  return { by: 'kind' };
};

/** Eine Gruppierung wählen: nach Rodzaj, nach einer Achse (einem Rodzaj: seine Einträge sind die Werte), nach einem Feld. */
function GroupingSelect({ label, value, kindLabel, onChange }: { label: string; value: Grouping | null; kindLabel: string; onChange: (g: Grouping) => void }) {
  const { lib } = useCtx();
  const axes = axesOf(lib);
  return (
    <div className="cg" data-grouping={label}>
      <label className="wk-field">
        <span>{label}</span>
        <select value={groupWord(value)} onChange={(e) => onChange(groupOfWord(e.target.value, value))}>
          <option value="kind">{kindLabel}</option>
          {/* 2026-10-27 — die Ebenen von den Grundlagen her (Felder „Najpierw trzeba znać”, `prerequisites.ts`). */}
          <option value="level">według kolejności nauki (poziomy od podstaw)</option>
          {axes.length > 0 && (
            <optgroup label="według osi — rodzaju (jego wpisy to wartości)">
              {axes.map((k) => <option key={k.id} value={`axis:${k.id}`}>{k.name}</option>)}
            </optgroup>
          )}
          <optgroup label="według pola">
            {shortFieldKeys(lib).map((f) => <option key={f.key} value={`field:${f.key}`}>{f.label}</option>)}
          </optgroup>
        </select>
      </label>
      {value !== null && value.by === 'axis' && <AxisSettings axis={value} onChange={(axis) => onChange({ by: 'axis', ...axis })} />}
    </div>
  );
}

/**
 * 2026-10-23 (Schritt 5) — EINE ACHSE EINSTELLEN: über welches Feld ein Eintrag
 * zu einem Wert gehört (direkt oder einen Schritt weiter), in welcher
 * Reihenfolge die Werte stehen (ein Zahlenfeld oder die Liste eines Eintrags)
 * und unter welchen Überschriften (ein Verweisfeld der Werte).
 */
function AxisSettings({ axis, onChange }: { axis: Axis; onChange: (axis: Axis) => void }) {
  const { lib } = useCtx();
  const kind = lib.kind(axis.kind);
  const refs = refFieldKeys(lib);
  const own = kind?.fields ?? [];
  /* Wer die Werte in einer Reihenfolge nennt: ein Verweisfeld für mehrere, das auf diesen Rodzaj (oder auf jeden) zeigt. */
  const lists = lib.materialKinds.flatMap((k) => k.fields.filter((f) => f.type === 'ref' && f.multi && ((f.to ?? []).length === 0 || (f.to ?? []).includes(axis.kind))).map((f) => ({ kind: k, field: f })));
  const holder = axis.sort?.list === undefined ? undefined : lib.entity(axis.sort.list);
  const [listKind, setListKind] = useState<string | null>(null);
  const sortWord = axis.sort === undefined ? (listKind ?? '')
    : axis.sort.list !== undefined ? `list:${holder?.kinds.find((k) => lists.some((l) => l.kind.id === k && l.field.key === axis.sort!.field)) ?? ''}:${axis.sort.field}`
    : `field:${axis.sort.field}`;
  const viaWord = axis.via.length === 0 ? '' : axis.via.length === 1 ? axis.via[0] : '#many';
  const set = (patch: Partial<Axis>) => {
    const next: Record<string, unknown> = { ...axis, ...patch };
    for (const [k, v] of Object.entries(patch)) if (v === undefined) delete next[k];
    onChange(next as unknown as Axis);
  };
  return (
    <div className="cg-card cg-axis" data-axis={axis.kind}>
      <span className="cg-muted">Wartości: wpisy rodzaju „{kind?.name ?? axis.kind}” ({lib.material(axis.kind).length}).</span>
      <label className="wk-field"><span>Wpis należy do wartości przez pole</span>
        <select value={viaWord} onChange={(e) => set({ via: e.target.value === '' ? [] : e.target.value === '#many' ? axis.via : [e.target.value] })}>
          <option value="">dowolne pole-odwołanie</option>
          {axis.via.length > 1 && <option value="#many">kilka pól: {axis.via.join(', ')}</option>}
          {refs.map((f) => <option key={`${f.group}:${f.key}`} value={f.key}>{f.label} ({f.group})</option>)}
        </select>
      </label>
      <label className="wk-field"><span>…albo o jeden krok dalej — najpierw przez pole</span>
        <select value={axis.through ?? ''} onChange={(e) => set({ through: e.target.value === '' ? undefined : e.target.value })}>
          <option value="">nie — tylko bezpośrednio</option>
          <option value="*">dowolne pole-odwołanie</option>
          {refs.map((f) => <option key={`${f.group}:${f.key}`} value={f.key}>{f.label} ({f.group})</option>)}
        </select>
      </label>
      <label className="wk-field"><span>Kolejność wartości</span>
        <select value={sortWord} onChange={(e) => {
          const word = e.target.value;
          if (word === '') { setListKind(null); set({ sort: undefined }); return; }
          if (word.startsWith('field:')) { setListKind(null); set({ sort: { field: word.slice(6) } }); return; }
          setListKind(word);
          set({ sort: undefined });
        }}>
          <option value="">według nazwy</option>
          {own.filter((f) => f.type === 'number').map((f) => <option key={f.key} value={`field:${f.key}`}>według pola: {f.label}</option>)}
          {lists.map((l) => <option key={`${l.kind.id}:${l.field.key}`} value={`list:${l.kind.id}:${l.field.key}`}>według listy w polu „{l.field.label}” ({l.kind.name})</option>)}
        </select>
      </label>
      {sortWord.startsWith('list:') && (() => {
        const [, holderKind, fieldKey] = sortWord.split(':');
        return (
          <label className="wk-field"><span>Który wpis podaje kolejność</span>
            <EntityPicker lib={lib} kinds={[holderKind]} refs value={axis.sort?.list ?? null} onPick={(id) => { if (id !== null) { setListKind(null); set({ sort: { field: fieldKey, list: id } }); } }} />
          </label>
        );
      })()}
      <label className="wk-field"><span>Nagłówki według pola wartości</span>
        <select value={axis.group ?? ''} onChange={(e) => set({ group: e.target.value === '' ? undefined : e.target.value })}>
          <option value="">bez nagłówków</option>
          {own.filter((f) => f.type === 'ref').map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </label>
    </div>
  );
}

/** Die Spalten einer Tabela: auch eine Achse (ein Rodzaj — die Werte, auf die der Eintrag zeigt). */
export function axisColumns(lib: CogitaLibrary): { key: string; label: string }[] {
  return axesOf(lib).map((k) => ({ key: `${AXIS_COLUMN}${k.id}`, label: `${k.name} (oś)` }));
}

/** Womit ein neuer Schritt beginnt — „Filtr znajomości": was vorher zu können ist, sitzt (2026-10-30). */
const STEP_START: Partial<Record<StepType, Readonly<Record<string, unknown>>>> = {
  'filter.rule': { rule: { op: 'and', items: [] } },
  structure: { dir: 'down' },
  learning: { dir: 'before' },
  'filter.when': { when: { type: 'knowness', rel: 'before', op: 'ge', than: 1 } }
};

export function ViewSteps({ view, onChange }: { view: ViewDoc; onChange: (next: ViewDoc) => void }) {
  const { lib } = useCtx();
  const refs = refFieldKeys(lib);
  let leading = 0;
  while (leading < view.steps.length && isSource(view.steps[leading].type)) leading += 1;
  const steps = leading === 0 ? [{ type: 'source.all' as const, config: {} }, ...view.steps] : view.steps;
  const sources = Math.max(1, leading);
  const setStep = (i: number, step: Step) => onChange({ ...view, steps: steps.map((s, j) => (j === i ? step : s)) });
  const remove = (i: number) => onChange({ ...view, steps: steps.filter((_, j) => j !== i) });
  const add = (type: StepType) => onChange({ ...view, steps: [...steps, { type, config: STEP_START[type] ?? {} }] });
  const addSource = () => onChange({ ...view, steps: [...steps.slice(0, sources), { type: 'source.kind', config: {} }, ...steps.slice(sources)] });
  const fields = (step: Step, i: number) => configFields('view', step.type).map((field) => (
    <ConfigInput key={field.key} field={field} value={step.config[field.key]} fieldKeys={refs} readOnly={false}
      onSet={(v) => setStep(i, { ...step, config: { ...step.config, [field.key]: v } })} />
  ));

  return (
    <div className="cg">
      {steps.slice(0, sources).map((source, i) => (
        <div key={`s${i}`} className={sources > 1 ? 'cg-card' : undefined}>
          <div className="cg-row-between">
            <label className="wk-field">
              <span>{i === 0 ? 'Skąd' : 'Razem z'}</span>
              <select value={source.type} onChange={(e) => setStep(i, { type: e.target.value as StepType, config: {} })}>
                {SOURCE_TYPES.map((t) => <option key={t} value={t}>{STEP_WORDS[t].label}</option>)}
              </select>
            </label>
            {sources > 1 && <button type="button" className="wk-link-btn" aria-label="Usuń źródło" onClick={() => remove(i)}>×</button>}
          </div>
          <p className="cg-muted">{STEP_WORDS[isSource(source.type) ? source.type : 'source.all'].says}</p>
          {source.config[RETIRED_STEP] === 'source.topic' && <p className="wk-warn">{RETIRED_TOPIC}</p>}
          {fields(source, i)}
        </div>
      ))}
      {steps.slice(sources).map((step, k) => (
        <div key={`k${k}`} className="cg-card">
          <div className="cg-row-between">
            <strong>{STEP_WORDS[step.type].label}</strong>
            <button type="button" className="wk-link-btn" aria-label={`Usuń krok: ${STEP_WORDS[step.type].label}`} onClick={() => remove(sources + k)}>×</button>
          </div>
          <p className="cg-muted">{STEP_WORDS[step.type].says}</p>
          {fields(step, sources + k)}
        </div>
      ))}
      <span className="cg-row">
        <button type="button" className="wk-link-btn" onClick={addSource}>+ Źródło (razem)</button>
        <button type="button" className="wk-link-btn" onClick={() => add('follow')}>+ Idź po odwołaniu</button>
        <button type="button" className="wk-link-btn" onClick={() => add('structure')}>+ Idź po strukturze</button>
        <button type="button" className="wk-link-btn" onClick={() => add('learning')}>+ Idź po kolejności nauki</button>
        <button type="button" className="wk-link-btn" onClick={() => add('filter.rule')}>+ Filtr</button>
        <button type="button" className="wk-link-btn" onClick={() => add('filter.when')}>+ Filtr znajomości</button>
      </span>
      {view.retired.map((line) => <p key={line} className="wk-warn">{line}</p>)}
      <GroupingSelect label="Drzewo grupuje" value={view.group} kindLabel="według rodzaju" onChange={(g) => onChange({ ...view, group: g.by === 'kind' ? null : g })} />
      {view.mode === 'matrix' && (
        <>
          <GroupingSelect label="Macierz — wiersze" value={view.matrix?.rows ?? null} kindLabel="według rodzaju" onChange={(rows) => onChange({ ...view, matrix: { rows, cols: view.matrix?.cols ?? { by: 'kind' } } })} />
          <GroupingSelect label="Macierz — kolumny" value={view.matrix?.cols ?? null} kindLabel="według rodzaju" onChange={(cols) => onChange({ ...view, matrix: { rows: view.matrix?.rows ?? { by: 'kind' }, cols } })} />
        </>
      )}
    </div>
  );
}
