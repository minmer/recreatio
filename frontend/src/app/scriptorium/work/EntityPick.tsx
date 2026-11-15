/**
 * EIN EINTRAG DES WISSENS WÄHLEN (2026-11-15) — eine Person, ein Ort, ein Begriff aus den Bazy wiedzy, die dieser
 * Leser öffnen kann (durch die Linse des Skryptorium). Für Marken an Knoten und Regeln zu einem Eintrag.
 */

import { useState } from 'react';

import { useT } from '../../core/i18n';
import type { ScriptoriumLens } from '../lens';
import type { WorkKnowledge } from './workKnowledge';

/** Die Arten der anderen Teile — keine Einträge des Wissens eines Werks. */
const FOREIGN = new Set(['text', 'delivery', 'project', 'node', 'person', 'work', 'quote', 'question']);

/** Wie ein Eintrag des Wissens heisst — aus dem Wissen des Werks oder der Linse; unlesbar: nichts. */
export function entityLabel(id: string, knowledge: WorkKnowledge, lens: ScriptoriumLens | null): string | null {
  const known = knowledge.get(id);
  if (known !== undefined) return known.label;
  const entity = lens?.entity(id);
  return entity === undefined || lens === null ? null : lens.label(entity);
}

export function EntityPick({ lens, knowledge, onPick, disabled = false, exclude = [] }: {
  lens: ScriptoriumLens | null;
  knowledge: WorkKnowledge;
  onPick: (id: string) => void;
  disabled?: boolean;
  exclude?: readonly string[];
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const words = query.trim();
  const hits: { id: string; label: string; kind: string }[] = [];
  if (words !== '') {
    if (lens !== null) {
      for (const e of lens.search(words, undefined, true)) {
        if (FOREIGN.has(e.kinds[0] ?? '') || exclude.includes(e.id)) continue;
        hits.push({ id: e.id, label: lens.label(e), kind: lens.kind(e.kinds[0] ?? '')?.name ?? '' });
        if (hits.length >= 12) break;
      }
    } else {
      const low = words.toLowerCase();
      for (const e of knowledge.all()) {
        if (!e.label.toLowerCase().includes(low) || exclude.includes(e.id)) continue;
        hits.push({ id: e.id, label: e.label, kind: e.kind });
        if (hits.length >= 12) break;
      }
    }
  }
  return (
    <div className="work-pick">
      <input type="search" value={query} disabled={disabled} placeholder={t('workUi.pick.placeholder')} aria-label={t('workUi.pick.placeholder')} onChange={(e) => setQuery(e.target.value)} />
      {words !== '' && (hits.length === 0 ? <p className="wk-empty">{lens === null ? t('workUi.pick.loading') : t('workUi.pick.none')}</p> : (
        <ul className="work-pick-list">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" className="wk-link-btn" onClick={() => { onPick(h.id); setQuery(''); }}>
                {h.label}{h.kind === '' ? '' : ` · ${h.kind}`}
              </button>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
