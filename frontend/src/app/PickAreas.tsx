/**
 * 0081 — OBSZARY DO WYBORU w ustawieniach modułu (pole `areas`): do kogo
 * osoba z linkiem może napisać. Obszar to jego ludzie — role z dostępem do
 * niego; kto ma odpowiadać tylko wybranymi rolami (np. ksiądz), wybiera obszar,
 * w którym są tylko one.
 */

import { useEffect, useState } from 'react';

import { areaPath, inOrder, loadAreas, type AreaRow } from './area';

export function PickAreas({ value, busy, onPick }: {
  value: string;
  busy: boolean;
  onPick: (areaIds: string) => void;
}) {
  const [areas, setAreas] = useState<readonly AreaRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadAreas()
      .then(({ areas: found }) => { if (alive) setAreas(found); })
      .catch(() => { if (alive) setAreas([]); });
    return () => { alive = false; };
  }, []);

  if (areas === null) return <p className="wk-hint">Wczytywanie obszarów…</p>;

  const chosen = value.split(',').map((one) => one.trim()).filter((one) => one !== '');
  const toggle = (id: string) => onPick((chosen.includes(id) ? chosen.filter((one) => one !== id) : [...chosen, id]).join(','));
  const mine = inOrder(areas).map(({ area }) => area).filter((a) => a.myLevel !== null && a.personal !== true);

  if (mine.length === 0) return <p className="wk-hint">Nie masz jeszcze żadnego obszaru.</p>;

  return (
    <div className="wk-pick-cals">
      {mine.map((a) => (
        <label key={a.areaId} className="wk-check">
          <input type="checkbox" checked={chosen.includes(a.areaId)} disabled={busy} onChange={() => toggle(a.areaId)} />
          <span title={areaPath(areas, a.areaId).full}>{areaPath(areas, a.areaId).short}</span>
        </label>
      ))}
      {chosen.some((id) => !areas.some((a) => a.areaId === id)) && (
        <span className="wk-blocker">Jednego z wybranych obszarów już nie widzisz — zaznacz właściwe.</span>
      )}
      <span className="wk-hint">
        Odpowiadają wszyscy, którzy mają dostęp do obszaru. Mają to być tylko wybrane role (np. ksiądz)? Wybierz obszar,
        w którym są tylko one. Osoba z linkiem zobaczy tylko te obszary, które mają związek z jej formularzem.
      </span>
    </div>
  );
}
