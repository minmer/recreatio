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
import { plural } from './ChatKit';
import { loadModules, type ModuleRow } from './module';
import { WorkspaceError } from './session';

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
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className="wk-h2">Formularze ({forms.length})</h2>
      <p className="wk-hint">
        {mode === 'one'
          ? <>Kto wypełnił dołączony formularz, może tu zacząć rozmowę — ze swojego linku, bez konta. Widzi ją tylko on i odpowiadający.</>
          : <>Kto wypełnił dołączony formularz, {othersWrite(mode) ? 'czyta i pisze w' : 'czyta'} {what} — ze swojego linku, bez konta.</>}
        {' '}Nie liczą się zgłoszenia wycofane ani ukryte na liście.
      </p>

      {forms.length > 0 && (
        <ul className="wk-list">
          {forms.map((f) => (
            <li key={f.moduleId} className="wk-row">
              <span>
                <strong>{f.name}</strong>
                <span className="wk-row-side">
                  {f.areaName !== null ? ` · ${f.areaName}` : ''} · {f.people} {plural(f.people, 'osoba', 'osoby', 'osób')} z linkiem
                </span>
              </span>
              {byRoleId !== null && (
                <button type="button" className="wk-link-btn wk-danger" disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Odłączyć formularz „${f.name}"? Kto go wypełnił, przestanie widzieć ${what} (chyba że ma link do obszaru).`)) return;
                    void act(f.moduleId, false);
                  }}>
                  Odłącz
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {byRoleId === null
        ? <p className="wk-hint">Formularze dołącza ktoś, kto ma w tym obszarze prawo zapisu.</p>
        : modules !== null && (offered.length === 0
          ? <p className="wk-empty">{forms.length === 0 ? 'Nie widzisz żadnego formularza, który można dołączyć.' : 'Wszystkie Twoje formularze są już dołączone.'}</p>
          : (
            <form className="wk-form" onSubmit={(e) => { e.preventDefault(); if (pick !== '') void act(pick, true); }}>
              <label className="wk-field">
                <span>Dołącz formularz</span>
                <select value={pick} onChange={(e) => setPick(e.target.value)} disabled={busy}>
                  <option value="">— wybierz —</option>
                  {offered.map((m) => (
                    <option key={m.moduleId} value={m.moduleId}>{m.name}{m.areaName !== null ? ` (${m.areaName})` : ''}</option>
                  ))}
                </select>
              </label>
              <div className="wk-actions">
                <button type="submit" className="wk-btn wk-btn-quiet" disabled={busy || pick === ''}>Dołącz</button>
              </div>
            </form>
          ))}

      {failed !== null && <p className="wk-error">{failed}</p>}
    </>
  );
}
