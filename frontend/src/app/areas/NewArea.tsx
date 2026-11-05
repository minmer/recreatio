/**
 * Einen Bereich anlegen.
 */

import { useState } from 'react';

import { useT } from '../core/i18n';
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
  const t = useT();
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
    : ring === null ? t('areas.passwordFirst')
    : person === null ? t('areas.noPerson')
    : name.trim() === '' ? t('areas.newArea.nameIt')
    : null;

  return (
    <form
      className="wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (blocker !== null || ring === null || person === null) return;

        void onAct(t('areas.creating'),
          () => createArea(ring, person, name, inside === '' ? undefined : inside))
          .then(onDone);
      }}
    >
      <h1 className="wk-h1">{t('areas.newArea.title')}</h1>

      <label className="wk-field">
        <span>{t('common.name')}</span>
        <input
          value={name}
          placeholder={t('areas.newArea.namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      {canNest.length > 0 && (
        <label className="wk-field">
          <span>{t('areas.newArea.inside')}</span>
          <AreaPick label={t('areas.newArea.inside')} value={inside} onChange={setInside} areas={areas} only={canNest}
            extras={[{ value: '', label: t('areas.newArea.nowhere') }]} />
        </label>
      )}

      {blocker !== null && !busy && <p className="wk-blocker">{blocker}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={blocker !== null}>{t('areas.newArea.create')}</button>
      </div>
    </form>
  );
}
