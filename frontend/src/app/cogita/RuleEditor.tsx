/**
 * DIE REGEL BEARBEITEN (die der Zbiory, `selection.ts`): Bedingungen über
 * Felder — gleich, enthält, gefüllt, vor/nach, ist Rodzaj, verweist auf — und
 * Gruppen mit I / LUB, bis zur vierten Tiefe. Gebraucht in „Wpisy", im Widok
 * und am Knoten „Filtr wpisów" der Powtórka (2026-10-22, Schritt 9 — vorher
 * nur in `EntityList.tsx`).
 */

import { COMPARE_LABEL, type Compare, type Condition, type RuleGroup } from './selection';
import { useCtx } from './ui';

export function RuleEditor({ rule, onChange, depth = 0 }: { rule: RuleGroup; onChange: (r: RuleGroup) => void; depth?: number }) {
  const { lib } = useCtx();
  const keys = [...new Map(lib.kinds.flatMap((k) => k.fields).map((f) => [f.key, f.label])).entries()];
  const set = (i: number, item: Condition | RuleGroup | null) => onChange({ ...rule, items: item === null ? rule.items.filter((_, j) => j !== i) : rule.items.map((x, j) => (j === i ? item : x)) });
  return (
    <div className="cg-cond">
      <div className="cg-cond-row">
        <select value={rule.op} onChange={(e) => onChange({ ...rule, op: e.target.value === 'or' ? 'or' : 'and' })}>
          <option value="and">wszystkie warunki (I)</option>
          <option value="or">którykolwiek (LUB)</option>
        </select>
      </div>
      <div className="cg-cond-items">
        {rule.items.map((item, i) => 'items' in item
          ? <div key={i} className="cg-cond-item"><RuleEditor rule={item} depth={depth + 1} onChange={(r) => set(i, r)} /><button type="button" className="wk-link-btn" onClick={() => set(i, null)}>×</button></div>
          : (
            <div key={i} className="cg-cond-row">
              {item.cmp !== 'kind' && item.cmp !== 'refers' && (
                <select value={item.field ?? ''} onChange={(e) => set(i, { ...item, field: e.target.value })}>
                  <option value="">pole…</option>
                  {keys.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              )}
              <select value={item.cmp} onChange={(e) => set(i, { ...item, cmp: e.target.value as Compare })}>
                {(Object.keys(COMPARE_LABEL) as Compare[]).map((c) => <option key={c} value={c}>{COMPARE_LABEL[c]}</option>)}
              </select>
              {item.cmp === 'kind' ? (
                <select value={item.value ?? ''} onChange={(e) => set(i, { ...item, value: e.target.value })}>
                  {lib.kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              ) : item.cmp !== 'filled' && item.cmp !== 'empty' && <input value={item.value ?? ''} onChange={(e) => set(i, { ...item, value: e.target.value })} />}
              <button type="button" className="wk-link-btn" onClick={() => set(i, null)}>×</button>
            </div>
          ))}
        <span className="cg-row">
          <button type="button" className="wk-link-btn" onClick={() => onChange({ ...rule, items: [...rule.items, { cmp: 'contains', field: keys[0]?.[0], value: '' }] })}>+ warunek</button>
          {depth < 3 && <button type="button" className="wk-link-btn" onClick={() => onChange({ ...rule, items: [...rule.items, { op: rule.op === 'and' ? 'or' : 'and', items: [] }] })}>+ grupa</button>}
        </span>
      </div>
    </div>
  );
}
