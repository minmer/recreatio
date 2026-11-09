/**
 * Was neben dem Bild der Rollen steht: die gewählte Rolle und das Konto.
 */

import { useState } from 'react';

import type { Ring, SealedRole } from '../core/keys';
import type { Who } from '../core/session';
import { useT } from '../core/i18n';
import { DOTS, KIND_NAME } from './RoleNode';
import { type EdgeKind, type NewKind, type RoleEdge, createRole, dropHolder, renameRole, retypeRole, revokeRole } from './roles';

/* -- Was man mit einer Rolle tun kann ---------------------------------------
 *
 * Das Entsperren steht nicht mehr hier, sondern in `Unlock.tsx`: es wird an
 * zwei Stellen gebraucht — hier für die Namen, im Seitenformular für die
 * Unterschrift unter einem Zertifikat.
 */

export function Panel({ role, ring, name, holders, names, busy, onAct }: {
  role: SealedRole;
  ring: Ring | null;
  name: string | null;
  holders: readonly RoleEdge[];
  names: ReadonlyMap<string, string>;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<NewKind>('role');

  const mine = ring !== null && ring.has(role.id);
  const label = (id: string) => names.get(id) ?? t('roles.graph.sealed');

  return (
    <>
      <h2 className="wk-h2">{name ?? (mine ? t('roles.graph.noName') : t('roles.graph.sealed'))}</h2>
      <p className="wk-row-side">{KIND_NAME[role.kind]} · <code>{role.id.slice(0, 8)}</code></p>

      {!mine && (
        <p className="wk-empty">
          {t('roles.panel.closed')}
        </p>
      )}

      {mine && (
        <>
          {/* Umbenennen wirkt rückwirkend: der Name liegt an der Rolle, nicht
              als Kopie in allem, was sie je getan hat. */}
          <form
            className="wk-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim() !== '' && ring !== null) {
                void onAct(t('roles.panel.renaming'), () => renameRole(ring, role.id, draft)).then(() => setDraft(''));
              }
            }}
          >
            <label className="wk-field">
              <span>{t('common.name')}</span>
              <input value={draft} placeholder={name ?? ''} onChange={(e) => setDraft(e.target.value)} />
            </label>
            <div className="wk-actions">
              <button type="submit" className="wk-btn" disabled={busy || draft.trim() === ''}>{t('roles.panel.rename')}</button>
            </div>
            <p className="wk-hint">{t('roles.panel.renameHint')}</p>
          </form>

          {role.kind !== 'person' && (
            <div className="wk-actions">
              <button
                type="button" className="wk-btn" disabled={busy}
                onClick={() => void onAct(t('roles.panel.retyping'),
                  () => retypeRole(role.id, role.kind === 'role' ? 'group' : 'role'))}
              >
                {role.kind === 'role' ? t('roles.panel.toGroup') : t('roles.panel.toRole')}
              </button>
            </div>
          )}

          <h3 className="wk-h2">{t('roles.panel.holders')}</h3>
          <ul className="wk-list">
            {holders.length === 0 && <li className="wk-empty">{t('roles.panel.root')}</li>}
            {holders.map((edge) => {
              const dot = DOTS.find((d) => d.kind === edge.edgeKind) ?? DOTS[0];

              /*
               * NUR DIE FÜHRENDEN sind Halter. Eine Lese- oder Schreibkante
               * abzugeben nimmt niemandem den Schlüssel — die Warnung „das ist
               * der letzte" gilt für sie nicht, und der Knopf darf deshalb auch
               * dann dastehen, wenn es nur eine gibt.
               */
              const holding = holders.filter((e) => e.edgeKind === 'holds');
              const last = edge.edgeKind === 'holds' && holding.length <= 1;

              return (
                <li className="wk-row" key={edge.id}>
                  <span>
                    {label(edge.fromRoleId)}
                    <span className="wk-dot-key" style={{ marginLeft: '.5rem' }}>
                      <i style={{ background: dot.colour }} />
                      {t(dot.name)}
                    </span>
                  </span>

                  {!last && (
                    <button
                      type="button" className="wk-link-btn" disabled={busy}
                      onClick={() => void onAct(t('roles.panel.taking', { name: t(dot.name) }),
                        () => dropHolder(role.id, edge.fromRoleId, edge.edgeKind as EdgeKind))}
                    >
                      {t('roles.panel.take')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Anlegen: die gewählte Rolle HÄLT die neue. Ohne Halter gäbe es eine
              Rolle, deren Schlüssel niemand hat. */}
          <h3 className="wk-h2">{t('roles.panel.newUnder')}</h3>
          <form
            className="wk-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim() !== '' && ring !== null) {
                void onAct(t('roles.common.computingKeys'),
                  () => createRole(ring, role, { kind: newKind, name: newName }))
                  .then(() => setNewName(''));
              }
            }}
          >
            <label className="wk-field">
              <span>{t('common.name')}</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </label>

            <label className="wk-field">
              <span>{t('roles.panel.kind')}</span>
              <select value={newKind} onChange={(e) => setNewKind(e.target.value as NewKind)}>
                <option value="person">{t('roles.panel.kinds.person')}</option>
                <option value="role">{t('roles.panel.kinds.role')}</option>
                <option value="group">{t('roles.panel.kinds.group')}</option>
              </select>
            </label>

            {/*
              Der Unterschied, der später zählt: eine Person geht, ein Amt
              bleibt. Wer beides gleich anlegt, kann die Frage „wer hat das
              damals gemacht" nicht mehr von „wer macht das heute" trennen.
            */}
            {newKind === 'person' && (
              <p className="wk-hint">
                {t('roles.panel.personHint')}
              </p>
            )}

            <div className="wk-actions">
              <button type="submit" className="wk-btn" disabled={busy || newName.trim() === ''}>{t('roles.panel.createRole')}</button>
            </div>
            <p className="wk-hint">
              {t('roles.panel.keysHint')}
            </p>
          </form>

          {!role.isPersonal && (
            <div className="wk-actions">
              <button
                type="button" className="wk-link-btn" disabled={busy}
                onClick={() => void onAct(t('roles.panel.removing'), () => revokeRole(role.id))}
              >
                {t('roles.panel.remove')}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* -- Das Konto (0040) -------------------------------------------------------
 *
 * Kein Name, keine Art zum Umstellen, nichts zum Löschen, niemand, der es
 * hält. Was man mit ihm tun kann, ist genau eines: eine Person anlegen.
 */

export function AccountPanel({ who, ring, account, busy, onAct }: {
  who: Who;
  ring: Ring | null;
  account: SealedRole;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useT();
  const [name, setName] = useState('');

  return (
    <>
      <h2 className="wk-h2">{t('roles.node.kind.account')}</h2>
      <p className="wk-row-side">{who.loginId}</p>

      <p className="wk-hint">
        {t('roles.panel.accountHint')}
      </p>

      {ring !== null && ring.has(account.id) && (
        <form
          className="wk-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() !== '') {
              void onAct(t('roles.panel.computingPerson'),
                () => createRole(ring, account, { kind: 'person', name }))
                .then(() => setName(''));
            }
          }}
        >
          <h3 className="wk-h2">{t('roles.panel.newPerson')}</h3>
          <label className="wk-field">
            <span>{t('roles.panel.firstName')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </label>
          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={busy || name.trim() === ''}>{t('roles.panel.createPerson')}</button>
          </div>
          <p className="wk-hint">{t('roles.panel.keysHint')}</p>
        </form>
      )}
    </>
  );
}
