/**
 * 0080 — DIE FORMULARE AN EINEM DING (`audience.ts`). Wer eines davon
 * ausgefüllt hat, gehört zu dessen Menschen: im Kanał liest er, gemeinsam
 * schreibt er mit — mit seinem Link, ohne Konto.
 *
 * Für jedes Ding dasselbe: die Rozmowa zeigt es in ihren Einstellungen; ein
 * anderes Ding gibt seine Art (`kind`), seine Kennung und seine Formulare.
 * Angeboten werden die Formulare aus „Moduły" ohne ihre Erweiterungen — wer
 * eine Erweiterung ausfüllt, hat das Formular schon ausgefüllt.
 */

import { useEffect, useState } from 'react';

import { linkAudienceForm, othersWrite, type AudienceForm, type AudienceMode } from './audience';
import { useT } from '../core/i18n';
import { loadModules, type ModuleRow } from '../modules/module';
import { WorkspaceError } from '../core/session';
import { askText } from '../ui/dialogs';

export function AudienceForms({ kind, subjectId, mode, forms, byRoleId, what, onChanged }: {
  /** Woran die Formulare hängen — wie der Dienst es kennt (`chat`). */
  kind: string;
  subjectId: string;
  mode: AudienceMode;
  forms: readonly AudienceForm[];

  /** Meine Rolle, die im Bereich schreibt — ohne sie wird nur gezeigt. */
  byRoleId: string | null;

  /** Wie das Ding im Satz heisst: „ten kanał", „tę rozmowę". */
  what: string;
  onChanged: () => void;
}) {
  const t = useT();
  const [modules, setModules] = useState<readonly ModuleRow[] | null>(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (byRoleId === null) return;
    let alive = true;
    void loadModules().then((found) => { if (alive) setModules(found.modules); }).catch(() => { if (alive) setModules([]); });
    return () => { alive = false; };
  }, [byRoleId]);

  const offered = (modules ?? []).filter((m) => m.kind === 'form' && m.extendsId === null && !forms.some((f) => f.moduleId === m.moduleId));

  const act = async (moduleId: string, linked: boolean) => {
    setBusy(true);
    setFailed(null);
    try {
      await linkAudienceForm(kind, subjectId, moduleId, linked, byRoleId ?? undefined);
      setPick('');
      onChanged();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className="wk-h2">{t('areas.audience.forms', { count: forms.length })}</h2>
      <p className="wk-hint">
        {mode === 'one'
          ? t('areas.audience.hintOne')
          : t(othersWrite(mode) ? 'areas.audience.hintWrite' : 'areas.audience.hintRead', { what })}
        {' '}{t('areas.audience.hintNotCounted')}
      </p>

      {forms.length > 0 && (
        <ul className="wk-list">
          {forms.map((f) => (
            <li key={f.moduleId} className="wk-row">
              <span>
                <strong>{f.name}</strong>
                <span className="wk-row-side">
                  {f.areaName !== null ? ` · ${f.areaName}` : ''} · {t('areas.audience.people', { count: f.people })}
                </span>
              </span>
              {byRoleId !== null && (
                <button type="button" className="wk-link-btn wk-danger" disabled={busy}
                  onClick={async () => {
                    if (!(await askText(t('areas.audience.detachAsk', { name: f.name, what })))) return;
                    void act(f.moduleId, false);
                  }}>
                  {t('areas.audience.detach')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {byRoleId === null
        ? <p className="wk-hint">{t('areas.audience.needsWrite')}</p>
        : modules !== null && (offered.length === 0
          ? <p className="wk-empty">{forms.length === 0 ? t('areas.audience.noneToAttach') : t('areas.audience.allAttached')}</p>
          : (
            <form className="wk-form" onSubmit={(e) => { e.preventDefault(); if (pick !== '') void act(pick, true); }}>
              <label className="wk-field">
                <span>{t('areas.audience.attachForm')}</span>
                <select value={pick} onChange={(e) => setPick(e.target.value)} disabled={busy}>
                  <option value="">{t('areas.chooseDash')}</option>
                  {offered.map((m) => (
                    <option key={m.moduleId} value={m.moduleId}>{m.name}{m.areaName !== null ? ` (${m.areaName})` : ''}</option>
                  ))}
                </select>
              </label>
              <div className="wk-actions">
                <button type="submit" className="wk-btn wk-btn-quiet" disabled={busy || pick === ''}>{t('areas.audience.attach')}</button>
              </div>
            </form>
          ))}

      {failed !== null && <p className="wk-error">{failed}</p>}
    </>
  );
}
