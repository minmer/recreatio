/**
 * 0129 — WER FÜR EINE SEITE GERADESTEHT: ein Bereich, den ich führe und der einen
 * Administrator danych hat. Die Wahl gilt auch für die Seiten darunter, bis eine
 * von ihnen selbst einen nennt. Eine ÖFFENTLICHE Seite ohne ihn lässt sich nicht
 * speichern — der Dienst lehnt ab (`Controllers.PageGateAsync`).
 *
 * Gesetzt werden darf es nur von dem, der die Seite UND den Bereich führt — sonst
 * machte jeder jede Organisation für seine Seite verantwortlich.
 */

import { useEffect, useState } from 'react';

import type { AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { setPageController, type PageResponsible as Responsible } from '../areas/controllers';
import { WorkspaceError } from '../core/session';
import { viewPath } from '../routes';
import { toast } from '../ui/dialogs';
import { areasNow } from '../workspace/viewData';

export function PageResponsible({ path, isPublic, responsible }: {
  path: string;
  /** An keinen Bereich gebunden (0051) — dann ist die Wahl Pflicht. */
  isPublic: boolean;
  /** Wie die Seite es zuletzt sagte; `undefined`: nicht geladen. */
  responsible: Responsible | null | undefined;
}) {
  const [current, setCurrent] = useState<Responsible | null | undefined>(responsible);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => { setCurrent(responsible); }, [responsible]);
  useEffect(() => {
    let alive = true;
    void areasNow().then((list) => { if (alive) setAreas(list); }, () => undefined);
    return () => { alive = false; };
  }, []);

  const mine = areas.filter((a) => a.myLevel === 'admin' && a.personal !== true && a.ownChat == null);
  const areaName = (id: string) => areas.find((a) => a.areaId === id)?.name ?? 'obszar';
  const here = (p: string) => (p === '' ? 'recreatio.pl' : p);

  const save = async (areaId: string | null) => {
    setBusy(true);
    setFailed(null);
    try {
      const out = await setPageController(path, areaId);
      setCurrent(out.responsible);
      setPicked('');
      toast(areaId === null ? 'Usunięto wskazanie.' : 'Zapisano, kto odpowiada za stronę.', { kind: 'ok' });
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  const nobody = current === null;

  return (
    <>
      {isPublic && nobody && (
        <p className="wk-warn" data-page-responsible="none">
          Ta strona jest publiczna, a nikt nie odpowiada za jej treść — zapiszesz ją dopiero, gdy wskażesz obszar
          (niżej: „Kto odpowiada za tę stronę”).
        </p>
      )}

      <details className="wk-fold" open={isPublic && nobody}>
        <summary>Kto odpowiada za tę stronę{current?.controller ? ` — ${current.controller.name}` : ''}</summary>
        <div className="wk-page-responsible">
          {current === undefined ? null : current === null || current.controller === null ? (
            <p className="wk-note">
              {isPublic
                ? 'Nikt nie jest wskazany. Każda publiczna strona potrzebuje kogoś, kto za nią odpowiada — może to być organizacja pośrednicząca.'
                : 'Nikt nie jest wskazany — za stronę tylko z dostępem odpowiada administrator danych jej obszarów.'}
            </p>
          ) : (
            <p className="wk-controller-line">
              <strong>{current.controller.name}</strong>
              {current.controller.address !== null && `, ${current.controller.address}`}
              {' '}— obszar <a href={viewPath('areas', current.areaId, 'ustawienia')}>{areaName(current.areaId)}</a>
              {current.fromPath === path
                ? '; obowiązuje też dla stron poniżej.'
                : `; wskazane na stronie ${here(current.fromPath)} — obowiązuje też tutaj.`}
            </p>
          )}

          {mine.length === 0 ? (
            <p className="wk-note">Wskazać można obszar, który prowadzisz i który ma administratora danych.</p>
          ) : (
            <div className="wk-page-responsible-pick">
              <AreaPick areas={areas} only={mine} value={picked} onChange={setPicked} label="Obszar, który odpowiada" placeholder="Wybierz obszar…" disabled={busy} />
              <button type="button" className="wk-btn wk-btn-small" disabled={busy || picked === ''} onClick={() => void save(picked)}>Wskaż</button>
              {current !== undefined && current !== null && current.fromPath === path && (
                <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void save(null)}>Usuń wskazanie</button>
              )}
            </div>
          )}

          {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
        </div>
      </details>
    </>
  );
}
