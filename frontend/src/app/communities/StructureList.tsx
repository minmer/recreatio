/**
 * 0137 — DIE STRUKTUR ALS LISTE: dasselbe wie die Karte (StructureMap), fürs Telefon — ohne React Flow.
 */

import { kindLabel } from '../areas/profile';
import { flatten, kindOf, positionsOf, staffing, type CommunityDoc } from './community';
import { mayMove } from './communityEdit';

/** Dasselbe als Liste — fürs Telefon (und für alle, die lieber lesen): einrücken, öffnen, umhängen. */
export function StructureList({ doc, selected, onPick, onMove }: {
  doc: CommunityDoc;
  selected: string | null;
  onPick: (key: string) => void;
  onMove: (key: string, target: string) => void;
}) {
  const flat = flatten(doc.unit);
  const gaps = staffing(doc);
  return (
    <ul className="wk-cm-tree" data-cm-tree="">
      {flat.map((f) => {
        const targets = flat.filter((t) => mayMove(doc, f.unit.key, t.unit.key) && t.unit.key !== f.parent);
        const warn = gaps.filter((g) => g.unit === f.unit.key && g.have < g.want);
        return (
          <li key={f.unit.key} className={`wk-cm-tree-row depth-${Math.min(f.depth, 6)}${f.unit.key === selected ? ' is-on' : ''}${f.unit.remove ? ' is-removed' : ''}`}>
            <button type="button" className="wk-link-btn" onClick={() => onPick(f.unit.key)}>{f.unit.name}</button>
            <span className="wk-cm-meta">{kindLabel(kindOf(doc, f.unit))} · {positionsOf(doc, f.unit).map((p) => p.name).join(', ') || 'bez pozycji'}</span>
            {warn.map((g) => <span key={g.position} className="wk-fmap-warn">⚠ {g.positionName}: brakuje {g.want - g.have}</span>)}
            {f.parent !== null && targets.length > 0 && (
              <select aria-label={`Przenieś „${f.unit.name}” pod…`} value="" onChange={(e) => { if (e.target.value !== '') onMove(f.unit.key, e.target.value); }}>
                <option value="">Przenieś pod…</option>
                {targets.map((t) => <option key={t.unit.key} value={t.unit.key}>{'· '.repeat(t.depth)}{t.unit.name}</option>)}
              </select>
            )}
          </li>
        );
      })}
    </ul>
  );
}
