/**
 * Moje dane — die Angaben, die dem MENSCHEN gehören.
 *
 * <b>Sie gehören keinem Bereich.</b> Sie liegen an seiner Rolle, einzeln
 * versiegelt unter seinem Rollenschlüssel, und werden einzeln freigegeben. Wer
 * eine Telefonnummer bekommen soll, bekommt genau die und nicht den Geburtstag
 * dazu — das ist der ganze Grund, warum jedes Feld sein eigenes Etikett trägt.
 *
 * <b>Freigeben heisst: neu versiegeln, unter dem Schlüssel des Empfängers.</b>
 * Deshalb steht hier nur, wo man auch wirklich hineinsiegeln kann — Bereiche,
 * deren Epochenschlüssel man hält. An einen fremden Bereich geht eine Angabe
 * über sein FORMULAR (Annahmeschlüssel), nicht über diese Liste: unter einem
 * offengelegten Schlüssel zu versiegeln wäre nicht Weitergeben, sondern
 * Veröffentlichen.
 *
 * <b>Zurücknehmen nimmt die Zeile weg, nicht die Erinnerung.</b> Das sagt die
 * Seite auch so — alles andere wäre ein Versprechen, das die Sache nicht hält.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadAreas, myEpochKeys, type AreaRow } from './area';
import type { Ring } from './keys';
import {
  FIELD_LABEL, PERSON_FIELDS, forgetValue, loadPerson, openMine, releaseValue,
  setValue, withdrawValue, type PersonField, type Release
} from './person';
import { WorkspaceError } from './session';

export function PersonCard({ roleId, ring }: { roleId: string; ring: Ring }) {
  const [values, setValues] = useState<Map<PersonField, string>>(new Map());
  const [releases, setReleases] = useState<readonly Release[]>([]);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  const look = useCallback(async () => {
    try {
      const mine = await loadPerson(roleId);
      setValues(await openMine(roleId, ring, mine.values));
      setReleases(mine.releases);
      setAreas((await loadAreas()).areas);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać danych.');
    }
  }, [roleId, ring]);

  useEffect(() => { void look(); }, [look]);

  const act = async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);
    setSaid(null);

    try {
      await todo();
      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h2 className="wk-h2">Moje dane</h2>

      <p className="wk-hint">
        To jedyne na tej platformie, co należy do <strong>człowieka</strong>, a
        nie do żadnego obszaru. Każde pole jest zapieczętowane osobno i osobno
        udostępniane — kto ma dostać telefon, dostaje telefon, a nie przy okazji
        datę urodzenia.
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {said !== null && <p className="wk-done">{said}</p>}
      {busy !== null && <p className="wk-hint">{busy}</p>}

      <ul className="wk-list">
        {PERSON_FIELDS.map((field) => (
          <ValueRow
            key={field}
            field={field}
            value={values.get(field) ?? null}
            releases={releases.filter((r) => r.field === field)}
            areas={areas}
            ring={ring}
            busy={busy !== null}
            onAct={act}
            onSaid={setSaid}
            roleId={roleId}
          />
        ))}
      </ul>
    </>
  );
}

/* -- Ein Feld --------------------------------------------------------------- */

function ValueRow({ field, value, releases, areas, ring, busy, onAct, onSaid, roleId }: {
  field: PersonField;
  value: string | null;
  releases: readonly Release[];
  areas: readonly AreaRow[];
  ring: Ring;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
  onSaid: (message: string | null) => void;
  roleId: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [target, setTarget] = useState('');

  useEffect(() => { setDraft(value ?? ''); }, [value]);

  /* Nur Bereiche, in die man wirklich hineinsiegeln kann — siehe Kopf. */
  const reachable = areas.filter((a) => a.heldEpochs > 0);

  /*
   * SPEICHERN ZIEHT NACH. Wer die Nummer ändert, ändert sie überall dort, wo
   * er sie schon hingegeben hat — `setValue` tut das und sagt, wo es ging.
   *
   * Gesagt wird beides. Ein stilles „gespeichert" wäre die halbe Wahrheit,
   * wenn in einem Bereich der alte Stand stehen bleibt.
   */
  const save = async () => {
    const { refreshed, couldNot } = await setValue(roleId, ring, field, draft);

    if (couldNot.length > 0) {
      onSaid(`Zapisano. Nie udało się odświeżyć w: ${couldNot.join(', ')}`);
    } else if (refreshed.length > 0) {
      onSaid(`Zapisano i odświeżono w: ${refreshed.join(', ')}`);
    }
  };

  const give = async () => {
    if (value === null || target === '') return;

    const area = reachable.find((a) => a.areaId === target);
    if (area === undefined) return;

    const keys = await myEpochKeys(ring, area.areaId);
    const areaKey = keys.get(area.currentEpoch);

    if (areaKey === undefined) {
      throw new WorkspaceError('Nie masz klucza tej epoki — nie da się udostępnić.');
    }

    await releaseValue(roleId, field, value, {
      areaId: area.areaId, areaKey, epoch: area.currentEpoch
    });
  };

  return (
    <li className="wk-row">
      <span>
        <strong>{FIELD_LABEL[field]}</strong>
        <span className="wk-row-side">
          {value === null ? ' · puste' : ` · ${value}`}
          {releases.length > 0 && ` · udostępnione: ${releases.length}`}
        </span>

        {open && (
          <div className="wk-form">
            <label className="wk-field">
              <span>Wartość</span>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} />
            </label>

            <div className="wk-actions">
              <button
                type="button" className="wk-btn"
                disabled={busy || draft.trim() === '' || draft === value}
                onClick={() => void onAct('Zapisywanie…', save)}
              >
                Zapisz
              </button>

              {value !== null && (
                <button
                  type="button" className="wk-link-btn" disabled={busy}
                  onClick={() => void onAct('Usuwanie…', () => forgetValue(roleId, field))}
                >
                  Usuń
                </button>
              )}
            </div>

            {/*
              Ändern zieht bestehende Freigaben NICHT nach. Wer umzieht, gibt
              seine neue Anschrift denen, die sie bekommen sollen — und nicht
              automatisch jedem, der die alte einmal bekommen hat.
            */}
            {releases.length > 0 && (
              <p className="wk-hint">
                Zmiana nie aktualizuje tego, co już udostępniłeś. Udostępnij
                ponownie temu, kto ma znać nową wartość.
              </p>
            )}

            {/* -- Wohin es gegangen ist -------------------------------- */}

            <h4 className="wk-h2">Kto to dostał</h4>

            {releases.length === 0 ? (
              <p className="wk-empty">Nikt.</p>
            ) : (
              <ul className="wk-tile-lines">
                {releases.map((r) => (
                  <li key={r.areaId}>
                    {r.areaName}
                    {' · '}
                    <button
                      type="button" className="wk-link-btn" disabled={busy}
                      onClick={() => void onAct('Wycofywanie…', async () => {
                        const done = await withdrawValue(roleId, field, r.areaId);
                        onSaid(done.note);
                      })}
                    >
                      Wycofaj
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {value !== null && reachable.length > 0 && (
              <>
                <label className="wk-field">
                  <span>Udostępnij obszarowi</span>
                  <select value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="">—</option>
                    {reachable
                      .filter((a) => !releases.some((r) => r.areaId === a.areaId))
                      .map((a) => <option key={a.areaId} value={a.areaId}>{a.name}</option>)}
                  </select>
                </label>

                <div className="wk-actions">
                  <button
                    type="button" className="wk-btn" disabled={busy || target === ''}
                    onClick={() => void onAct('Udostępnianie…', give).then(() => setTarget(''))}
                  >
                    Udostępnij
                  </button>
                </div>

                <p className="wk-hint">
                  Wartość zostanie zapieczętowana kluczem tego obszaru — osobną
                  kopertą, tylko dla niego. Obcemu obszarowi dane przekazuje się
                  przez jego formularz, nie tutaj.
                </p>
              </>
            )}
          </div>
        )}
      </span>

      <button type="button" className="wk-link-btn" onClick={() => setOpen(!open)}>
        {open ? 'Zamknij' : value === null ? 'Wpisz' : 'Zmień'}
      </button>
    </li>
  );
}

export default PersonCard;
