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
import { rich, useT } from '../core/i18n';

export function PageResponsible({ path, isPublic, responsible }: {
  path: string;
  /** An keinen Bereich gebunden (0051) — dann ist die Wahl Pflicht. */
  isPublic: boolean;
  /** Wie die Seite es zuletzt sagte; `undefined`: nicht geladen. */
  responsible: Responsible | null | undefined;
}) {
  const t = useT();
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
  const areaName = (id: string) => areas.find((a) => a.areaId === id)?.name ?? t('pages.responsible.area');
  const here = (p: string) => (p === '' ? 'recreatio.pl' : p);

  const save = async (areaId: string | null) => {
    setBusy(true);
    setFailed(null);
    try {
      const out = await setPageController(path, areaId);
      setCurrent(out.responsible);
      setPicked('');
      toast(areaId === null ? t('pages.responsible.removed') : t('pages.responsible.saved'), { kind: 'ok' });
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('pages.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const nobody = current === null;

  return (
    <>
      {isPublic && nobody && (
        <p className="wk-warn" data-page-responsible="none">{t('pages.responsible.warn')}</p>
      )}

      <details className="wk-fold" open={isPublic && nobody}>
        <summary>{current?.controller ? t('pages.responsible.titleWith', { name: current.controller.name }) : t('pages.responsible.title')}</summary>
        <div className="wk-page-responsible">
          {current === undefined ? null : current === null || current.controller === null ? (
            <p className="wk-note">
              {isPublic
                ? t('pages.responsible.nobodyPublic')
                : t('pages.responsible.nobodyAccess')}
            </p>
          ) : (
            <p className="wk-controller-line">
              <strong>{current.controller.name}</strong>
              {current.controller.address !== null && `, ${current.controller.address}`}
              {' '}{rich(current.fromPath === path ? t('pages.responsible.areaHere', { area: areaName(current.areaId) }) : t('pages.responsible.areaFrom', { area: areaName(current.areaId), page: here(current.fromPath) }), {
                link: (s, k) => <a key={k} href={viewPath('areas', current.areaId, 'ustawienia')}>{s}</a>
              })}
            </p>
          )}

          {mine.length === 0 ? (
            <p className="wk-note">{t('pages.responsible.canPick')}</p>
          ) : (
            <div className="wk-page-responsible-pick">
              <AreaPick areas={areas} only={mine} value={picked} onChange={setPicked} label={t('pages.responsible.pickLabel')} placeholder={t('pages.responsible.pickPlaceholder')} disabled={busy} />
              <button type="button" className="wk-btn wk-btn-small" disabled={busy || picked === ''} onClick={() => void save(picked)}>{t('pages.responsible.pick')}</button>
              {current !== undefined && current !== null && current.fromPath === path && (
                <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void save(null)}>{t('pages.responsible.remove')}</button>
              )}
            </div>
          )}

          {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
        </div>
      </details>
    </>
  );
}
