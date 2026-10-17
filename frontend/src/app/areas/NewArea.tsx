/**
 * Einen Bereich anlegen.
 */

import { useState } from 'react';

import type { Ring, SealedRole } from '../core/keys';
import { type AreaRow, createArea } from './area';
import { AreaPick } from './AreaPick';

/* -- Anlegen ---------------------------------------------------------------- */

export function NewArea({ ring, person, areas, busy, onAct, onDone }: {
  ring: Ring | null;
  person: SealedRole | null;
  areas: readonly AreaRow[];
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [inside, setInside] = useState('');

  /*
   * NUR DORT, WO ICH PROWADZĘ. Der Dienst verlangt `admin` auf dem äusseren
   * Bereich (0035); eine Auswahl, die mehr anböte, führte zu einem Knopf, der
   * beim Drücken absagt.
   */
  const canNest = areas.filter((a) => a.myLevel === 'admin');

  const blocker =
    busy ? null
    : ring === null ? 'Najpierw podaj hasło.'
    : person === null ? 'Konto nie prowadzi jeszcze żadnej osoby — załóż ją w Rolach.'
    : name.trim() === '' ? 'Nazwij obszar.'
    : null;

  return (
    <form
      className="wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (blocker !== null || ring === null || person === null) return;

        void onAct('Zakładanie…',
          () => createArea(ring, person, name, inside === '' ? undefined : inside))
          .then(onDone);
      }}
    >
      <h1 className="wk-h1">Nowy obszar</h1>

      <label className="wk-field">
        <span>Nazwa</span>
        <input
          value={name}
          placeholder="np. Kancelaria"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      {canNest.length > 0 && (
        <label className="wk-field">
          <span>Wewnątrz</span>
          <AreaPick label="Wewnątrz" value={inside} onChange={setInside} areas={areas} only={canNest}
            extras={[{ value: '', label: 'Nigdzie — osobny obszar' }]} />
        </label>
      )}

      {blocker !== null && !busy && <p className="wk-blocker">{blocker}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={blocker !== null}>Załóż</button>
      </div>
    </form>
  );
}
