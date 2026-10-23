/**
 * DIE AUSWAHL EINES WIDOKU BEARBEITEN (2026-10-22, Schritt 9): Quellen
 * (Wszystko, Rodzaj, Zbiór, Temat, Lista — mehrere am Anfang zählen zusammen,
 * Schritt 10), dann Schritte — „Idź po odwołaniu", „Filtr" —, wonach das
 * Drzewo gruppiert und (Schritt 10) was Zeilen und Spalten der Macierz sind.
 * Dieselben Felder wie an den Knoten einer Powtórka (`nodeFields.ts`, Palette
 * `view`), gezeichnet von derselben Eingabe (`ConfigInput`).
 */

import type { FieldKey } from './GraphEditor';
import { ConfigInput } from './GraphEditor';
import { configFields } from './nodeFields';
import { isSource, SOURCE_TYPES, STEP_WORDS, type Grouping, type Step, type StepType } from './selection';
import type { CogitaLibrary } from './store';
import { useCtx } from './ui';
import { AXIS_COLUMN, axesOf, type ViewDoc } from './views';

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

const groupWord = (g: Grouping | null): string => (g === null || g.by === 'kind' ? 'kind' : g.by === 'field' ? `field:${g.field}` : `topic:${g.axis}`);
const groupOfWord = (word: string): Grouping => (word.startsWith('field:') ? { by: 'field', field: word.slice(6) }
  : word.startsWith('topic:') ? { by: 'topic', axis: word.slice(6) } : { by: 'kind' });

/** Eine Gruppierung wählen: nach Rodzaj, nach einer Achse von Tematy, nach einem Feld. */
function GroupingSelect({ label, value, kindLabel, onChange }: { label: string; value: Grouping | null; kindLabel: string; onChange: (g: Grouping) => void }) {
  const { lib } = useCtx();
  const axes = axesOf(lib);
  return (
    <label className="wk-field">
      <span>{label}</span>
      <select value={groupWord(value)} onChange={(e) => onChange(groupOfWord(e.target.value))}>
        <option value="kind">{kindLabel}</option>
        {axes.length > 0 && (
          <optgroup label="według osi tematów">
            {axes.map((a) => <option key={a.id} value={`topic:${a.id}`}>{lib.label(a)}</option>)}
          </optgroup>
        )}
        <optgroup label="według pola">
          {shortFieldKeys(lib).map((f) => <option key={f.key} value={`field:${f.key}`}>{f.label}</option>)}
        </optgroup>
      </select>
    </label>
  );
}

/** Die Spalten einer Tabela: auch eine Achse von Tematy (ihre Werte, zu denen der Eintrag gehört). */
export function axisColumns(lib: CogitaLibrary): { key: string; label: string }[] {
  return axesOf(lib).map((a) => ({ key: `${AXIS_COLUMN}${a.id}`, label: `${lib.label(a)} (oś tematów)` }));
}

export function ViewSteps({ view, onChange }: { view: ViewDoc; onChange: (next: ViewDoc) => void }) {
  const { lib } = useCtx();
  const refs = refFieldKeys(lib);
  let leading = 0;
  while (leading < view.steps.length && isSource(view.steps[leading].type)) leading += 1;
  const steps = leading === 0 ? [{ type: 'source.all' as const, config: {} }, ...view.steps] : view.steps;
  const sources = Math.max(1, leading);
  const setStep = (i: number, step: Step) => onChange({ ...view, steps: steps.map((s, j) => (j === i ? step : s)) });
  const remove = (i: number) => onChange({ ...view, steps: steps.filter((_, j) => j !== i) });
  const add = (type: StepType) => onChange({ ...view, steps: [...steps, { type, config: type === 'filter.rule' ? { rule: { op: 'and', items: [] } } : {} }] });
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
        <button type="button" className="wk-link-btn" onClick={() => add('filter.rule')}>+ Filtr</button>
      </span>
      <GroupingSelect label="Drzewo grupuje" value={view.group} kindLabel="według rodzaju (tematy jako drzewo)" onChange={(g) => onChange({ ...view, group: g.by === 'kind' ? null : g })} />
      {view.mode === 'matrix' && (
        <>
          <GroupingSelect label="Macierz — wiersze" value={view.matrix?.rows ?? null} kindLabel="według rodzaju" onChange={(rows) => onChange({ ...view, matrix: { rows, cols: view.matrix?.cols ?? { by: 'kind' } } })} />
          <GroupingSelect label="Macierz — kolumny" value={view.matrix?.cols ?? null} kindLabel="według rodzaju" onChange={(cols) => onChange({ ...view, matrix: { rows: view.matrix?.rows ?? { by: 'kind' }, cols } })} />
        </>
      )}
    </div>
  );
}
