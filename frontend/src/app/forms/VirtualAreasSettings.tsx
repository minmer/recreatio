/**
 * OBSZARY OSÓB (0120) — die virtuellen Bereiche eines Formulars, in seinen
 * Einstellungen.
 *
 * Je virtuellem Bereich eine Regel: wie er heisst, was die Person damit tut
 * (nicht sehen / lesen / schreiben), und welche Rollen jeden solchen Bereich
 * jeder Person erreichen — mit welcher Stufe. Dazu, wie viele Personen ihren
 * Bereich schon haben.
 *
 * <b>Angewandt wird die Regel von diesem Browser, ohne Klick</b>: beim Öffnen
 * und nach jeder Änderung legt er fehlende Bereiche an und trägt nach, was
 * eine neue Rolle braucht (`applyVirtualArea`) — so weit seine Schlüssel
 * reichen. Was er nicht kann (ein Platz, den er nicht öffnet), bleibt für einen
 * anderen Leiter, und die Zahlen sagen es.
 */

import { useCallback, useEffect, useState } from 'react';

import { dropFromArea, joinArea, loadMembers, type Member } from '../areas/area';
import type { Ring, SealedRole } from '../core/keys';
import { t as tApp, useT } from '../core/i18n';
import { WorkspaceError } from '../core/session';
import { useGivableRoles } from '../roles/CommonRoleField';
import { Loading } from '../ui/Loading';
import {
  applyVirtualArea, changeVirtualArea, createVirtualArea, loadVirtualAreas, loadVirtualPlan, releaseVirtualArea,
  SUBMITTER_LEVELS, SUBMITTER_WORDS, type SubmitterLevel, type VirtualAreaRow, type VirtualAreas
} from './virtualAreas';

type Level = 'read' | 'write' | 'admin';

/* Die Worte je Stufe: `formsData.va.level.<stufe>`. */
const levelKey = (level: Level | 'certify'): string => `formsData.va.level.${level}`;

/** Die stärkste Stufe eines Mitglieds, in Worten — `certify` allein heisst: lässt hinein, sieht nicht hinein. */
function levelWord(capabilities: readonly string[]): string {
  if (capabilities.includes('admin')) return tApp(levelKey('admin'));
  if (capabilities.includes('write')) return tApp(levelKey('write'));
  if (capabilities.includes('read')) return tApp(levelKey('read'));
  return tApp(levelKey('certify'));
}

export function VirtualAreasSettings({ partId, ring, person }: {
  partId: string;
  ring: Ring | null;
  person: SealedRole | null;
}) {
  const [state, setState] = useState<VirtualAreas | null>(null);
  const [members, setMembers] = useState<ReadonlyMap<string, readonly Member[]>>(new Map());
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<SubmitterLevel>('write');
  const [adding, setAdding] = useState<{ areaId: string; roleId: string; level: Level } | null>(null);
  const { roles } = useGivableRoles(ring);
  const t = useT();

  useEffect(() => {
    if (ring === null) return undefined;
    let alive = true;
    void ring.names().then((read) => { if (alive) setLabels(read); });
    return () => { alive = false; };
  }, [ring]);

  /*
     Lesen — und, wo dieser Browser es kann, gleich anwenden: fehlende Bereiche
     anlegen, Nachzutragendes nachtragen. Danach noch einmal lesen, damit die
     Zahlen stimmen.
  */
  const read = useCallback(async (apply: boolean) => {
    try {
      let now = await loadVirtualAreas(partId);
      if (apply && ring !== null && now.ready) {
        let changed = false;
        for (const va of now.virtualAreas) {
          if (!va.mayCertify || va.missing + va.behind === 0) continue;
          const done = await applyVirtualArea(ring, await loadVirtualPlan(va.areaId)).catch(() => null);
          if (done !== null && done.created + done.mirrored > 0) changed = true;
        }
        if (changed) now = await loadVirtualAreas(partId);
      }
      const found = new Map<string, readonly Member[]>();
      for (const va of now.virtualAreas) {
        found.set(va.areaId, (await loadMembers(va.areaId).catch(() => ({ members: [] as readonly Member[] }))).members);
      }
      setMembers(found);
      setState(now);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('formsData.va.loadFailed'));
    }
  }, [partId, ring, t]);

  useEffect(() => { void read(true); }, [read]);

  const act = async (what: string, todo: () => Promise<string | null | void>) => {
    setBusy(what);
    setFailed(null);
    setNote(null);
    try {
      const said = await todo();
      if (typeof said === 'string') setNote(said);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('common.failed'));
    } finally { setBusy(null); }
  };

  const apply = (va: VirtualAreaRow) => act(t('formsData.va.creating'), async () => {
    if (ring === null) throw new WorkspaceError(t('formsData.va.passwordFirst'));
    const done = await applyVirtualArea(ring, await loadVirtualPlan(va.areaId), {
      onProgress: (at, of) => setBusy(t('formsData.va.creatingProgress', { at, of }))
    });
    await read(false);
    if (done.noIssuer) return t('formsData.va.noIssuer');
    const parts = [
      done.created > 0 ? t('formsData.va.created', { count: done.created }) : '',
      done.mirrored > 0 ? t('formsData.va.mirrored', { count: done.mirrored }) : '',
      done.seatless > 0 ? t('formsData.va.seatless', { count: done.seatless }) : ''
    ].filter((x) => x !== '');
    return parts.length === 0 ? t('formsData.va.allInPlace') : t('formsData.va.done', { list: parts.join(' · ') });
  });

  const nameOf = (roleId: string) => labels.get(roleId) ?? roles?.find((r) => r.roleId === roleId)?.name ?? t('formsData.va.foreignRole');

  if (state === null) {
    return (
      <section className="wk-field wk-virtual-areas" aria-label={t('formsData.va.title')}>
        <h3 className="wk-h2">{t('formsData.va.title')}</h3>
        {failed !== null ? <p className="wk-error">{failed}</p> : <Loading label={t('common.loading')} />}
      </section>
    );
  }

  return (
    <section className="wk-field wk-virtual-areas" aria-label={t('formsData.va.title')}>
      <h3 className="wk-h2">{t('formsData.va.title')}</h3>
      <p>
        {t('formsData.va.intro')}
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {!state.ready && <p className="wk-note">{t('formsData.va.notReady')}</p>}

      {state.virtualAreas.map((va) => {
        const here = members.get(va.areaId) ?? [];
        const leads = va.myLevel === 'admin';
        const issuer = ring === null ? null : here.find((m) =>
          (m.capabilities.includes('admin') || m.capabilities.includes('certify')) && ring.maySign(m.roleId))?.roleId ?? null;
        const present = new Set(here.map((m) => m.roleId));
        const candidates = (roles ?? []).filter((r) => !present.has(r.roleId));
        const open = adding?.areaId === va.areaId ? adding : null;

        return (
          <div key={va.areaId} className="wk-virtual" data-virtual-area={va.areaId}>
            <p className="wk-virtual-name"><strong>{va.name}</strong></p>
            <p className="wk-virtual-counts" data-virtual-counts="">
              {t('formsData.va.counts', { count: va.instances, of: state.registrations })}
              {va.missing > 0 && ` · ${t('formsData.va.missing', { count: va.missing })}`}
              {va.behind > 0 && ` · ${t('formsData.va.behind', { count: va.behind })}`}
            </p>

            <ul className="wk-virtual-who">
              <li>
                {leads ? (
                  <label>
                    {t('formsData.va.submitter')}{' '}
                    <select value={va.submitterLevel} disabled={busy !== null} data-virtual-submitter=""
                      onChange={(e) => {
                        const next = e.target.value as SubmitterLevel;
                        void act(t('common.saving'), async () => {
                          await changeVirtualArea(va.areaId, { submitterLevel: next });
                          await read(true);
                          return next === 'none' ? t('formsData.va.hiddenFromPeople') : null;
                        });
                      }}>
                      {SUBMITTER_LEVELS.map((one) => <option key={one} value={one}>{SUBMITTER_WORDS[one]}</option>)}
                    </select>
                  </label>
                ) : SUBMITTER_WORDS[va.submitterLevel]}
              </li>
              {here.map((m) => (
                <li key={m.roleId} data-virtual-member={m.roleId}>
                  {nameOf(m.roleId)} — {levelWord(m.capabilities)}
                  {leads && here.length > 1 && (
                    <button type="button" className="wk-link-btn" disabled={busy !== null}
                      aria-label={t('formsData.va.dropRole', { name: nameOf(m.roleId) })}
                      onClick={() => void act(t('formsData.va.droppingRole'), async () => {
                        await dropFromArea(va.areaId, m.roleId);
                        await read(false);
                        return t('formsData.va.roleDropped');
                      })}>
                      {t('formsData.va.drop')}
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {leads && open !== null && (
              <div className="wk-virtual-add">
                <select value={open.roleId} disabled={busy !== null} aria-label={t('formsData.va.role')}
                  onChange={(e) => setAdding({ ...open, roleId: e.target.value })}>
                  {candidates.map((r) => <option key={r.roleId} value={r.roleId}>{r.name}</option>)}
                </select>
                <select value={open.level} disabled={busy !== null} aria-label={t('formsData.va.may')}
                  onChange={(e) => setAdding({ ...open, level: e.target.value as Level })}>
                  {(['read', 'write', 'admin'] as const).map((l) => <option key={l} value={l}>{t(levelKey(l))}</option>)}
                </select>
                <button type="button" className="wk-btn" disabled={busy !== null || open.roleId === '' || issuer === null}
                  data-virtual-add-role=""
                  onClick={() => void act(t('formsData.va.addingRole'), async () => {
                    const role = ring?.roleOf(open.roleId);
                    if (ring === null || role === undefined || issuer === null) throw new WorkspaceError(t('formsData.va.cannotAdd'));
                    await joinArea(ring, va.areaId, role, issuer, open.level);
                    setAdding(null);
                    const done = await applyVirtualArea(ring, await loadVirtualPlan(va.areaId)).catch(() => null);
                    await read(false);
                    return done === null || done.mirrored === 0
                      ? t('formsData.va.addedLater')
                      : t('formsData.va.addedNow');
                  })}>
                  {t('common.add')}
                </button>
                <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={() => setAdding(null)}>{t('common.cancel')}</button>
              </div>
            )}

            <div className="wk-actions">
              {leads && open === null && candidates.length > 0 && (
                <button type="button" className="wk-link-btn" disabled={busy !== null || issuer === null}
                  onClick={() => setAdding({ areaId: va.areaId, roleId: candidates[0].roleId, level: 'write' })}>
                  {t('formsData.va.addRole')}
                </button>
              )}
              {va.mayCertify && va.missing + va.behind > 0 && (
                <button type="button" className="wk-btn" disabled={busy !== null || ring === null} data-virtual-apply=""
                  onClick={() => void apply(va)}>
                  {t('formsData.va.createMissing', { count: va.missing + va.behind })}
                </button>
              )}
              {leads && va.instances === 0 && (
                <button type="button" className="wk-link-btn" disabled={busy !== null}
                  onClick={() => void act(t('formsData.va.droppingRule'), async () => {
                    await releaseVirtualArea(va.areaId);
                    await read(false);
                    return t('formsData.va.ruleDropped');
                  })}>
                  {t('formsData.va.dropRule')}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {state.ready && state.formAreaId !== null && (
        <form className="wk-virtual-new" onSubmit={(e) => {
          e.preventDefault();
          const formAreaId = state.formAreaId;
          if (formAreaId === null) return;
          void act(t('forms.settings.creating'), async () => {
            if (ring === null || person === null) throw new WorkspaceError(t('formsData.va.passwordFirst'));
            if (name.trim() === '') throw new WorkspaceError(t('formsData.va.nameIt'));
            await createVirtualArea(ring, person, partId, formAreaId, name.trim(), level);
            setName('');
            await read(true);
            return t('formsData.va.createdRule');
          });
        }}>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy !== null}
            placeholder={t('formsData.va.namePlaceholder')} aria-label={t('formsData.va.name')} data-virtual-name="" />
          <select value={level} onChange={(e) => setLevel(e.target.value as SubmitterLevel)} disabled={busy !== null} aria-label={t('formsData.va.person')}>
            {SUBMITTER_LEVELS.map((one) => <option key={one} value={one}>{SUBMITTER_WORDS[one]}</option>)}
          </select>
          <button type="submit" className="wk-btn" disabled={busy !== null} data-virtual-create="">{t('formsData.va.addArea')}</button>
        </form>
      )}

      {busy !== null && <p className="wk-note" role="status">{busy}</p>}
      {note !== null && busy === null && <p className="wk-note" role="status">{note}</p>}
    </section>
  );
}

export default VirtualAreasSettings;
