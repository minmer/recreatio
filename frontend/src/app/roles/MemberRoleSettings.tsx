/**
 * ROLE UCZESTNIKÓW (0091; 0120 mehrere) — in den Einstellungen eines Formulars.
 *
 * <b>Was die Kanzlei hier sieht:</b> welche Rollen die Menschen des Formulars
 * bekommen und wozu jede führt; wie viele schon dazugehören und ihren
 * Schlüssel haben; „Przenieś obecne zgłoszenia" für die, die vor einer Rolle
 * eingesandt haben. Die Rollen wählt sie aus ihren Rollen — oder legt gleich
 * hier eine neue an, mit ihren Bereichen.
 *
 * <b>Die Schlüssel gibt dieser Browser weiter</b>, ohne Klick: beim Öffnen und
 * nach jeder Änderung (\`handOverRoleKeys\`); sonst die Glocke, sobald jemand
 * neu dazukommt.
 */

import { useCallback, useEffect, useState } from 'react';

import type { AreaRow } from '../areas/area';
import { createCommonRole, reachWords, type NewRoleDraft } from './commonRole';
import { CommonRoleChoice, EMPTY_DRAFT, NEW_ROLE, useGivableRoles } from './CommonRoleField';
import type { Ring, SealedRole } from '../core/keys';
import { enrollMembers, handOverRoleKeys, loadFormMembers, setMemberRoles, type MemberState } from './memberRole';
import { WorkspaceError } from '../core/session';
import { Loading } from '../ui/Loading';

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
      if (with_ !== null && now.roles.some((r) => r.waiting.length > 0 && with_.has(r.roleId))) {
        const handed = await handOverRoleKeys(with_, partId, now).catch(() => 0);
        if (handed > 0) now = await loadFormMembers(partId);
      }
      setState(now);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać ról uczestników.');
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

  const save = () => act(picked.has(NEW_ROLE) ? 'Tworzenie roli…' : 'Zapisywanie ról…', async () => {
    const roleIds = [...picked.keys()].filter((id) => id !== NEW_ROLE);
    let next = bund;
    if (picked.has(NEW_ROLE)) {
      if (bund === null || person === null) throw new WorkspaceError('Najpierw podaj hasło.');
      const made = await createCommonRole(bund, person, draft, setBusy);
      roleIds.push(made.roleId);
      next = made.ring;
      onRingChanged();
    }
    if (roleIds.length === 0) throw new WorkspaceError('Wybierz rolę albo utwórz nową.');
    await setMemberRoles(partId, roleIds);
    setChoosing(false);
    setPicked(new Map());
    setDraft(EMPTY_DRAFT);
    setBund(next);
    await read(next);
    setNote(roleIds.length === 1
      ? 'Zapisano. Nowe zgłoszenia od razu należą do tej roli.'
      : 'Zapisano. Nowe zgłoszenia od razu należą do tych ról.');
  });

  const nameOf = (roleId: string) => roles?.find((r) => r.roleId === roleId)?.name ?? 'Rola (nazwa niedostępna)';

  /* Kto wysłał, a nie należy jeszcze do którejś z ról — „Przenieś" doda go do wszystkich. */
  const outside = state === null ? 0 : Math.max(0, ...state.roles.map((r) => state.seats - r.members));

  return (
    <section className="wk-field wk-member-role" aria-label="Role uczestników">
      <h3 className="wk-h2">Role uczestników</h3>
      <p className="wk-hint">
        Każdy, kto wyśle ten formularz, należy do tych ról — i dostaje to, do czego one dają dostęp:
        strony, kalendarze, rozmowy ich obszarów. Zmienisz obszary roli — zmienią się dla wszystkich.
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {state === null ? <Loading label="Wczytywanie…" /> : (
        <>
          {state.roles.length === 0 ? (
            <p className="wk-note">Ten formularz nie daje jeszcze żadnej roli.</p>
          ) : state.roles.map((role) => (
            <div key={role.roleId} className="wk-member-now" data-member-role={role.roleId}>
              <p><strong>{nameOf(role.roleId)}</strong></p>
              <p className="wk-hint">{reachWords(role.areas)}</p>
              <p className="wk-hint" data-member-counts="">
                Należy: {role.members} z {state.seats} {state.seats === 1 ? 'osoby' : 'osób'} z linkiem
                {role.members > 0 && ` · klucz ma ${role.sealed}`}
                {role.members - role.sealed > 0 && ` · czeka na klucz ${role.members - role.sealed}`}
              </p>
              {role.members - role.sealed > 0 && !role.holdsRole && (
                <p className="wk-note">Klucz roli przekaże ktoś, kto ją ma — automatycznie, gdy otworzy aplikację.</p>
              )}
            </div>
          ))}

          <div className="wk-actions">
            {state.roles.length > 0 && outside > 0 && (
              <button type="button" className="wk-btn" disabled={busy !== null} data-member-enroll=""
                onClick={() => void act('Przenoszenie zgłoszeń…', async () => {
                  const { added } = await enrollMembers(partId);
                  await read(bund);
                  setNote(added === 0 ? 'Wszyscy już należą do ról.' : `Dołączono: ${added}.`);
                })}>
                Przenieś obecne zgłoszenia ({outside})
              </button>
            )}
            {!choosing && (
              <button type="button" className="wk-link-btn" disabled={busy !== null || bund === null} onClick={() => {
                setPicked(new Map(state.roles.map((r) => [r.roleId, false] as const)));
                setChoosing(true);
              }}>
                {state.roles.length === 0 ? 'Wybierz role…' : 'Zmień role…'}
              </button>
            )}
            {state.roles.length > 0 && !choosing && (
              <button type="button" className="wk-link-btn" disabled={busy !== null}
                onClick={() => void act('Odłączanie ról…', async () => {
                  await setMemberRoles(partId, []);
                  await read(bund);
                  setNote('Nowe zgłoszenia nie dostaną już ról. Kto już do nich należy, zostaje.');
                })}>
                Bez ról
              </button>
            )}
          </div>

          {choosing && (
            <div className="wk-member-choose">
              <CommonRoleChoice roles={roles} failed={rolesFailed} areas={areas} many busy={busy !== null}
                picked={picked} onPicked={setPicked} draft={draft} onDraft={setDraft} />
              <p className="wk-hint">Kto już należy do odznaczonej roli, zostaje w niej. „Przenieś obecne zgłoszenia" doda wszystkich do nowych.</p>
              <div className="wk-actions">
                <button type="button" className="wk-btn" disabled={busy !== null || picked.size === 0} data-member-save="" onClick={() => void save()}>
                  Zapisz role
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
