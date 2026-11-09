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
import { useT } from '../core/i18n';

export function MemberRoleSettings({ partId, ring, person, areas, onRingChanged }: {
  partId: string;
  ring: Ring | null;
  person: SealedRole | null;
  areas: readonly AreaRow[];
  /** Eine neue Rolle angelegt: der Bund muss neu gebaut werden (er kennt sie noch nicht). */
  onRingChanged: () => void;
}) {
  const t = useT();
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
      setFailed(e instanceof WorkspaceError ? e.message : t('roles.member.loadFailed'));
    }
  }, [partId, t]);

  useEffect(() => { void read(bund); }, [read, bund]);

  const act = async (what: string, todo: () => Promise<void>) => {
    setBusy(what);
    setFailed(null);
    setNote(null);
    try { await todo(); } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('common.failed'));
    } finally { setBusy(null); }
  };

  const save = () => act(picked.has(NEW_ROLE) ? t('roles.member.creating') : t('roles.member.saving'), async () => {
    const roleIds = [...picked.keys()].filter((id) => id !== NEW_ROLE);
    let next = bund;
    if (picked.has(NEW_ROLE)) {
      if (bund === null || person === null) throw new WorkspaceError(t('roles.member.passwordFirst'));
      const made = await createCommonRole(bund, person, draft, setBusy);
      roleIds.push(made.roleId);
      next = made.ring;
      onRingChanged();
    }
    if (roleIds.length === 0) throw new WorkspaceError(t('roles.member.pickRole'));
    await setMemberRoles(partId, roleIds);
    setChoosing(false);
    setPicked(new Map());
    setDraft(EMPTY_DRAFT);
    setBund(next);
    await read(next);
    setNote(roleIds.length === 1
      ? t('roles.member.savedOne')
      : t('roles.member.savedMany'));
  });

  const nameOf = (roleId: string) => roles?.find((r) => r.roleId === roleId)?.name ?? t('roles.member.nameUnavailable');

  /* Kto wysłał, a nie należy jeszcze do którejś z ról — „Przenieś" doda go do wszystkich. */
  const outside = state === null ? 0 : Math.max(0, ...state.roles.map((r) => state.seats - r.members));

  return (
    <section className="wk-field wk-member-role" aria-label={t('roles.member.title')}>
      <h3 className="wk-h2">{t('roles.member.title')}</h3>
      <p className="wk-hint">
        {t('roles.member.lead')}
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {state === null ? <Loading label={t('common.loading')} /> : (
        <>
          {state.roles.length === 0 ? (
            <p className="wk-note">{t('roles.member.none')}</p>
          ) : state.roles.map((role) => (
            <div key={role.roleId} className="wk-member-now" data-member-role={role.roleId}>
              <p><strong>{nameOf(role.roleId)}</strong></p>
              <p className="wk-hint">{reachWords(role.areas)}</p>
              <p className="wk-hint" data-member-counts="">
                {t('roles.member.belongs', { members: role.members, count: state.seats })}
                {role.members > 0 && ` · ${t('roles.member.hasKey', { n: role.sealed })}`}
                {role.members - role.sealed > 0 && ` · ${t('roles.member.waitsKey', { n: role.members - role.sealed })}`}
              </p>
              {role.members - role.sealed > 0 && !role.holdsRole && (
                <p className="wk-note">{t('roles.member.handOver')}</p>
              )}
            </div>
          ))}

          <div className="wk-actions">
            {state.roles.length > 0 && outside > 0 && (
              <button type="button" className="wk-btn" disabled={busy !== null} data-member-enroll=""
                onClick={() => void act(t('roles.member.enrolling'), async () => {
                  const { added } = await enrollMembers(partId);
                  await read(bund);
                  setNote(added === 0 ? t('roles.member.allIn') : t('roles.member.added', { n: added }));
                })}>
                {t('roles.member.enroll', { n: outside })}
              </button>
            )}
            {!choosing && (
              <button type="button" className="wk-link-btn" disabled={busy !== null || bund === null} onClick={() => {
                setPicked(new Map(state.roles.map((r) => [r.roleId, false] as const)));
                setChoosing(true);
              }}>
                {state.roles.length === 0 ? t('roles.member.choose') : t('roles.member.change')}
              </button>
            )}
            {state.roles.length > 0 && !choosing && (
              <button type="button" className="wk-link-btn" disabled={busy !== null}
                onClick={() => void act(t('roles.member.detaching'), async () => {
                  await setMemberRoles(partId, []);
                  await read(bund);
                  setNote(t('roles.member.detached'));
                })}>
                {t('roles.member.noRoles')}
              </button>
            )}
          </div>

          {choosing && (
            <div className="wk-member-choose">
              <CommonRoleChoice roles={roles} failed={rolesFailed} areas={areas} many busy={busy !== null}
                picked={picked} onPicked={setPicked} draft={draft} onDraft={setDraft} />
              <p className="wk-hint">{t('roles.member.chooseHint')}</p>
              <div className="wk-actions">
                <button type="button" className="wk-btn" disabled={busy !== null || picked.size === 0} data-member-save="" onClick={() => void save()}>
                  {t('roles.member.save')}
                </button>
                <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={() => { setChoosing(false); setPicked(new Map()); }}>{t('common.cancel')}</button>
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
