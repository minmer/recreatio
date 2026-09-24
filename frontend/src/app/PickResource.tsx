/**
 * EIN ZASÓB AUSWÄHLEN — statt seine Kennung einzutippen.
 *
 * <b>Das Feld fragte nach einer Kennung, die niemand kennt.</b> „Kennung
 * kalendarza" stand darüber, und auf der Seite „confirmation/candidate" stand
 * danach `con26/27/1` darin — eine vernünftige Bezeichnung, nur keine
 * Kennung. Der Baustein blieb leer, und nichts sagte, warum. Eine UUID tippt
 * kein Mensch ab; wer ein Ding meint, soll es aus den Dingen wählen.
 *
 * <b>Was schon drinsteht und keines ist, wird gezeigt</b>, nicht verschwiegen:
 * sonst sähe das Feld leer aus, obwohl die Seite etwas Falsches trägt.
 */

import { useEffect, useState } from 'react';

import { KIND_LABEL, loadResources, type ResourceRow } from './resource';

export function PickResource({ value, busy, onPick }: {
  value: string;
  busy: boolean;
  onPick: (resourceId: string) => void;
}) {
  const [rows, setRows] = useState<readonly ResourceRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadResources()
      .then(({ resources }) => { if (alive) setRows(resources); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  if (rows === null) return <p className="wk-hint">Wczytywanie zasobów…</p>;

  const known = value === '' || rows.some((r) => r.resourceId === value);

  return (
    <>
      <select value={known ? value : ''} disabled={busy} onChange={(e) => onPick(e.target.value)}>
        <option value="">— wybierz —</option>
        {rows.map((r) => (
          <option key={r.resourceId} value={r.resourceId}>
            {r.name} · {KIND_LABEL[r.kind]}
          </option>
        ))}
      </select>

      {!known && (
        <span className="wk-blocker">
          Teraz stoi tu „{value}" — to nie jest żaden zasób. Wybierz właściwy.
        </span>
      )}

      {rows.length === 0 && (
        <span className="wk-hint">Nie ma jeszcze zasobów — załóż je w Rezerwacjach.</span>
      )}
    </>
  );
}

export default PickResource;
