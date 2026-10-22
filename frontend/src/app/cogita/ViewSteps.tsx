/**
 * DIE AUSWAHL EINES WIDOKU BEARBEITEN (2026-10-22, Schritt 9): eine Quelle
 * (Wszystko, Rodzaj, Zbiór, Temat, Lista), dann Schritte — „Idź po odwołaniu",
 * „Filtr" —, und wonach das Drzewo gruppiert. Dieselben Felder wie an den
 * Knoten einer Powtórka (`nodeFields.ts`, Palette `view`), gezeichnet von
 * derselben Eingabe (`ConfigInput`).
 */

import type { FieldKey } from './GraphEditor';
import { ConfigInput } from './GraphEditor';
import { configFields } from './nodeFields';
import { isSource, SOURCE_TYPES, STEP_WORDS, type Grouping, type Step, type StepType } from './selection';
import type { CogitaLibrary } from './store';
import { useCtx } from './ui';
import { axesOf, type ViewDoc } from './views';

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

/** Alle Felder, nach Rodzaj gruppiert — wonach ein Drzewo gruppieren kann. */
function allFieldKeys(lib: CogitaLibrary): FieldKey[] {
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
const groupOfWord = (word: string): Grouping | null => (word.startsWith('field:') ? { by: 'field', field: word.slice(6) }
  : word.startsWith('topic:') ? { by: 'topic', axis: word.slice(6) } : null);

export function ViewSteps({ view, onChange }: { view: ViewDoc; onChange: (next: ViewDoc) => void }) {
  const { lib } = useCtx();
  const refs = refFieldKeys(lib);
  const source = view.steps[0] ?? { type: 'source.all' as const, config: {} };
  const rest = view.steps.slice(1);
  const setStep = (i: number, step: Step) => onChange({ ...view, steps: view.steps.map((s, j) => (j === i ? step : s)) });
  const remove = (i: number) => onChange({ ...view, steps: view.steps.filter((_, j) => j !== i) });
  const add = (type: StepType) => onChange({ ...view, steps: [...view.steps, { type, config: type === 'filter.rule' ? { rule: { op: 'and', items: [] } } : {} }] });
  const fields = (step: Step, i: number) => configFields('view', step.type).map((field) => (
    <ConfigInput key={field.key} field={field} value={step.config[field.key]} fieldKeys={refs} readOnly={false}
      onSet={(v) => setStep(i, { ...step, config: { ...step.config, [field.key]: v } })} />
  ));
  const axes = axesOf(lib);

  return (
    <div className="cg">
      <label className="wk-field">
        <span>Skąd</span>
        <select value={source.type} onChange={(e) => setStep(0, { type: e.target.value as StepType, config: {} })}>
          {SOURCE_TYPES.map((t) => <option key={t} value={t}>{STEP_WORDS[t].label}</option>)}
        </select>
      </label>
      <p className="cg-muted">{STEP_WORDS[isSource(source.type) ? source.type : 'source.all'].says}</p>
      {fields(source, 0)}
      {rest.map((step, k) => (
        <div key={k} className="cg-card">
          <div className="cg-row-between">
            <strong>{STEP_WORDS[step.type].label}</strong>
            <button type="button" className="wk-link-btn" aria-label={`Usuń krok: ${STEP_WORDS[step.type].label}`} onClick={() => remove(k + 1)}>×</button>
          </div>
          <p className="cg-muted">{STEP_WORDS[step.type].says}</p>
          {fields(step, k + 1)}
        </div>
      ))}
      <span className="cg-row">
        <button type="button" className="wk-link-btn" onClick={() => add('follow')}>+ Idź po odwołaniu</button>
        <button type="button" className="wk-link-btn" onClick={() => add('filter.rule')}>+ Filtr</button>
      </span>
      <label className="wk-field">
        <span>Drzewo grupuje</span>
        <select value={groupWord(view.group)} onChange={(e) => onChange({ ...view, group: groupOfWord(e.target.value) })}>
          <option value="kind">według rodzaju (tematy jako drzewo)</option>
          {axes.length > 0 && (
            <optgroup label="według osi tematów">
              {axes.map((a) => <option key={a.id} value={`topic:${a.id}`}>{lib.label(a)}</option>)}
            </optgroup>
          )}
          <optgroup label="według pola">
            {allFieldKeys(lib).map((f) => <option key={f.key} value={`field:${f.key}`}>{f.label}</option>)}
          </optgroup>
        </select>
      </label>
    </div>
  );
}
