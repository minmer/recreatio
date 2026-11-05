/**
 * 0137 — DIE STRUKTUR ALS LISTE: dasselbe wie die Karte (StructureMap), fürs Telefon — ohne React Flow.
 */

import { kindLabel } from '../areas/profile';
import { useT } from '../core/i18n';
import { flatten, kindOf, positionsOf, staffing, type CommunityDoc } from './community';
import { mayMove } from './communityEdit';

/** Dasselbe als Liste — fürs Telefon (und für alle, die lieber lesen): einrücken, öffnen, umhängen. */
export function StructureList({ doc, selected, onPick, onMove }: {
  doc: CommunityDoc;
  selected: string | null;
  onPick: (key: string) => void;
  onMove: (key: string, target: string) => void;
}) {
  const t = useT();
  const flat = flatten(doc.unit);
  const gaps = staffing(doc);
  return (
    <ul className="wk-cm-tree" data-cm-tree="">
      {flat.map((f) => {
        const targets = flat.filter((x) => mayMove(doc, f.unit.key, x.unit.key) && x.unit.key !== f.parent);
        const warn = gaps.filter((g) => g.unit === f.unit.key && g.have < g.want);
        return (
          <li key={f.unit.key} className={`wk-cm-tree-row depth-${Math.min(f.depth, 6)}${f.unit.key === selected ? ' is-on' : ''}${f.unit.remove ? ' is-removed' : ''}`}>
            <button type="button" className="wk-link-btn" onClick={() => onPick(f.unit.key)}>{f.unit.name}</button>
            <span className="wk-cm-meta">{kindLabel(kindOf(doc, f.unit))} · {positionsOf(doc, f.unit).map((p) => p.name).join(', ') || t('communities.structure.noPositions')}</span>
            {warn.map((g) => <span key={g.position} className="wk-fmap-warn">⚠ {t('communities.structure.missing', { position: g.positionName, count: g.want - g.have })}</span>)}
            {f.parent !== null && targets.length > 0 && (
              <select aria-label={t('communities.structure.moveNamed', { name: f.unit.name })} value="" onChange={(e) => { if (e.target.value !== '') onMove(f.unit.key, e.target.value); }}>
                <option value="">{t('communities.structure.moveUnder')}</option>
                {targets.map((x) => <option key={x.unit.key} value={x.unit.key}>{'· '.repeat(x.depth)}{x.unit.name}</option>)}
              </select>
            )}
          </li>
        );
      })}
    </ul>
  );
}
