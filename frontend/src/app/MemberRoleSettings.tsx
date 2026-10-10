/**
 * ROLA UCZESTNIKÓW (0091) — in den Einstellungen eines Formulars.
 *
 * <b>Was die Kanzlei hier sieht:</b> welche Rolle die Menschen des Formulars
 * bekommen und wozu sie führt; wie viele schon dazugehören und ihren
 * Schlüssel haben; „Przenieś obecne zgłoszenia" für die, die vor der Rolle
 * eingesandt haben. Die Rolle wählt sie aus ihren Rollen — oder legt gleich
 * hier eine neue an, mit ihren Bereichen.
 *
 * <b>Den Schlüssel gibt dieser Browser weiter</b>, ohne Klick: beim Öffnen und
 * nach jeder Änderung (\`handOverRoleKeys\`); sonst die Glocke, sobald jemand
 * neu dazukommt.
 */

import { useCallback, useEffect, useState } from 'react';

import type { AreaRow } from './area';
import { createCommonRole, reachWords, type NewRoleDraft } from './commonRole';
import { CommonRoleChoice, EMPTY_DRAFT, NEW_ROLE, useGivableRoles } from './CommonRoleField';
import type { Ring, SealedRole } from './keys';
import { enrollMembers, handOverRoleKeys, loadFormMembers, setMemberRole, type MemberState } from './memberRole';
import { WorkspaceError } from './session';

export function MemberRoleSettings({ partId, ring, person, areas, onRingChanged }: {
  partId: string;
  ring: Ring | null;
  person: SealedRole | null;
  areas: readonly AreaRow[];
  /** Eine neue Rolle angelegt: der Bund muss neu gebaut werden (er kennt sie noch nicht). */
  onRingChanged: () => void;
}) {
  const [state, setState] = useState<MemberState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [picked, setPicked] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [draft, setDraft] = useState<NewRoleDraft>(EMPTY_DRAFT);
  const [bund, setBund] = useState<Ring | null>(ring);
  useEffect(() => setBund(ring), [ring]);
  const { roles, failed: rolesFailed } = useGivableRoles(bund);

  const read = useCallback(async (with_: Ring | null) => {
    try {
      let now = await loadFormMembers(partId);
      /* Wer wartet und von hier seinen Schlüssel bekommen kann, bekommt ihn — gleich. */
      if (with_ !== null && now.waiting.length > 0 && now.roleId !== null && with_.has(now.roleId)) {
        const handed = await handOverRoleKeys(with_, partId, now).catch(() => 0);
        if (handed > 0) now = await loadFormMembers(partId);
      }
      setState(now);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać roli uczestników.');
    }
  }, [partId]);

  useEffect(() => { void read(bund); }, [read, bund]);

  const act = async (what: string, todo: () => Promise<void>) => {
    setBusy(what);
    setFailed(null);
    setNote(null);
    try { await todo(); } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally { setBusy(null); }
  };

  const save = () => act(picked.has(NEW_ROLE) ? 'Tworzenie roli…' : 'Zapisywanie roli…', async () => {
    let roleId = [...picked.keys()].find((id) => id !== NEW_ROLE) ?? null;
    let next = bund;
    if (picked.has(NEW_ROLE)) {
      if (bund === null || person === null) throw new WorkspaceError('Najpierw podaj hasło.');
      const made = await createCommonRole(bund, person, draft, setBusy);
      roleId = made.roleId;
      next = made.ring;
      onRingChanged();
    }
    if (roleId === null) throw new WorkspaceError('Wybierz rolę albo utwórz nową.');
    await setMemberRole(partId, roleId);
    setChoosing(false);
    setPicked(new Map());
    setDraft(EMPTY_DRAFT);
    setBund(next);
    await read(next);
    setNote('Zapisano. Nowe zgłoszenia od razu należą do tej roli.');
  });

  const current = state?.roleId === null || state === null ? null : roles?.find((r) => r.roleId === state.roleId) ?? null;
  const outside = state === null ? 0 : Math.max(0, state.seats - state.members);

  return (
    <section className="wk-field wk-member-role" aria-label="Rola uczestników">
      <h3 className="wk-h2">Rola uczestników</h3>
      <p className="wk-hint">
        Każdy, kto wyśle ten formularz, należy do tej roli — i dostaje to, do czego ona daje dostęp:
        strony, kalendarze, rozmowy jej obszarów. Zmienisz obszary roli — zmienią się dla wszystkich.
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {state === null ? <p className="wk-hint">Wczytywanie…</p> : (
        <>
          {state.roleId === null ? (
            <p className="wk-note">Ten formularz nie daje jeszcze żadnej roli.</p>
          ) : (
            <div className="wk-member-now">
              <p><strong>{current?.name ?? 'Rola (nazwa niedostępna)'}</strong></p>
              <p className="wk-hint">{reachWords(state.areas)}</p>
              <p className="wk-hint" data-member-counts="">
                Należy: {state.members} z {state.seats} {state.seats === 1 ? 'osoby' : 'osób'} z linkiem
                {state.members > 0 && ` · klucz ma ${state.sealed}`}
                {state.members - state.sealed > 0 && ` · czeka na klucz ${state.members - state.sealed}`}
              </p>
              {state.members - state.sealed > 0 && !state.holdsRole && (
                <p className="wk-note">Klucz roli przekaże ktoś, kto ją ma — automatycznie, gdy otworzy aplikację.</p>
              )}
            </div>
          )}

          <div className="wk-actions">
            {state.roleId !== null && outside > 0 && (
              <button type="button" className="wk-btn" disabled={busy !== null} data-member-enroll=""
                onClick={() => void act('Przenoszenie zgłoszeń…', async () => {
                  const { added } = await enrollMembers(partId);
                  await read(bund);
                  setNote(added === 0 ? 'Wszyscy już należą do roli.' : `Dołączono do roli: ${added}.`);
                })}>
                Przenieś obecne zgłoszenia ({outside})
              </button>
            )}
            {!choosing && (
              <button type="button" className="wk-link-btn" disabled={busy !== null || bund === null} onClick={() => {
                setPicked(new Map(state.roleId === null ? [] : [[state.roleId, false]]));
                setChoosing(true);
              }}>
                {state.roleId === null ? 'Wybierz rolę…' : 'Zmień rolę…'}
              </button>
            )}
            {state.roleId !== null && !choosing && (
              <button type="button" className="wk-link-btn" disabled={busy !== null}
                onClick={() => void act('Odłączanie roli…', async () => {
                  await setMemberRole(partId, null);
                  await read(bund);
                  setNote('Nowe zgłoszenia nie dostaną już roli. Kto już do niej należy, zostaje.');
                })}>
                Bez roli
              </button>
            )}
          </div>

          {choosing && (
            <div className="wk-member-choose">
              <CommonRoleChoice roles={roles} failed={rolesFailed} areas={areas} many={false} busy={busy !== null}
                picked={picked} onPicked={setPicked} draft={draft} onDraft={setDraft} />
              <p className="wk-hint">Kto już należy do poprzedniej roli, zostaje w niej. „Przenieś obecne zgłoszenia" doda wszystkich do nowej.</p>
              <div className="wk-actions">
                <button type="button" className="wk-btn" disabled={busy !== null || picked.size === 0} data-member-save="" onClick={() => void save()}>
                  Zapisz rolę
                </button>
                <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={() => { setChoosing(false); setPicked(new Map()); }}>Anuluj</button>
              </div>
            </div>
          )}
        </>
      )}

      {busy !== null && <p className="wk-hint" role="status">{busy}</p>}
      {note !== null && busy === null && <p className="wk-note" role="status">{note}</p>}
    </section>
  );
}

export default MemberRoleSettings;
