/**
 * Was neben dem Bild der Rollen steht: die gewählte Rolle und das Konto.
 */

import { useState } from 'react';

import type { Ring, SealedRole } from '../core/keys';
import type { Who } from '../core/session';
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
  const [draft, setDraft] = useState('');
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<NewKind>('role');

  const mine = ring !== null && ring.has(role.id);
  const label = (id: string) => names.get(id) ?? 'zapieczętowane';

  return (
    <>
      <h2 className="wk-h2">{name ?? (mine ? 'bez nazwy' : 'zapieczętowane')}</h2>
      <p className="wk-row-side">{KIND_NAME[role.kind]} · <code>{role.id.slice(0, 8)}</code></p>

      {!mine && (
        <p className="wk-empty">
          Tej roli nie masz otwartej — widzisz, że istnieje, ale nie jej nazwę
          ani jej wnętrza.
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
                void onAct('Zmiana nazwy…', () => renameRole(ring, role.id, draft)).then(() => setDraft(''));
              }
            }}
          >
            <label className="wk-field">
              <span>Nazwa</span>
              <input value={draft} placeholder={name ?? ''} onChange={(e) => setDraft(e.target.value)} />
            </label>
            <div className="wk-actions">
              <button type="submit" className="wk-btn" disabled={busy || draft.trim() === ''}>Zmień nazwę</button>
            </div>
            <p className="wk-hint">Nazwa działa wstecz — także nad tym, co ta rola zrobiła wcześniej.</p>
          </form>

          {role.kind !== 'person' && (
            <div className="wk-actions">
              <button
                type="button" className="wk-btn" disabled={busy}
                onClick={() => void onAct('Zmiana rodzaju…',
                  () => retypeRole(role.id, role.kind === 'role' ? 'group' : 'role'))}
              >
                Zmień na {role.kind === 'role' ? 'grupę' : 'rolę'}
              </button>
            </div>
          )}

          <h3 className="wk-h2">Kto trzyma</h3>
          <ul className="wk-list">
            {holders.length === 0 && <li className="wk-empty">Nikt — to korzeń Twojego konta.</li>}
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
                      {dot.name}
                    </span>
                  </span>

                  {!last && (
                    <button
                      type="button" className="wk-link-btn" disabled={busy}
                      onClick={() => void onAct(`Odbieranie: ${dot.name}…`,
                        () => dropHolder(role.id, edge.fromRoleId, edge.edgeKind as EdgeKind))}
                    >
                      Odbierz
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Anlegen: die gewählte Rolle HÄLT die neue. Ohne Halter gäbe es eine
              Rolle, deren Schlüssel niemand hat. */}
          <h3 className="wk-h2">Nowa rola pod tą</h3>
          <form
            className="wk-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim() !== '' && ring !== null) {
                void onAct('Liczenie kluczy nowej roli…',
                  () => createRole(ring, role, { kind: newKind, name: newName }))
                  .then(() => setNewName(''));
              }
            }}
          >
            <label className="wk-field">
              <span>Nazwa</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </label>

            <label className="wk-field">
              <span>Rodzaj</span>
              <select value={newKind} onChange={(e) => setNewKind(e.target.value as NewKind)}>
                <option value="person">Osoba — konkretny człowiek</option>
                <option value="role">Rola — funkcja, którą ktoś pełni</option>
                <option value="group">Grupa — ci, którzy do niej należą</option>
              </select>
            </label>

            {/*
              Der Unterschied, der später zählt: eine Person geht, ein Amt
              bleibt. Wer beides gleich anlegt, kann die Frage „wer hat das
              damals gemacht" nicht mehr von „wer macht das heute" trennen.
            */}
            {newKind === 'person' && (
              <p className="wk-hint">
                Osoba to człowiek, nie funkcja. Jeśli chodzi Ci o coś, co można
                komuś przekazać — wybierz „Rola".
              </p>
            )}

            <div className="wk-actions">
              <button type="submit" className="wk-btn" disabled={busy || newName.trim() === ''}>Załóż rolę</button>
            </div>
            <p className="wk-hint">
              Powstają dwa klucze RSA-4096 — to potrwa kilka sekund.
            </p>
          </form>

          {!role.isPersonal && (
            <div className="wk-actions">
              <button
                type="button" className="wk-link-btn" disabled={busy}
                onClick={() => void onAct('Usuwanie…', () => revokeRole(role.id))}
              >
                Usuń tę rolę
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
  const [name, setName] = useState('');

  return (
    <>
      <h2 className="wk-h2">Konto</h2>
      <p className="wk-row-side">{who.loginId}</p>

      <p className="wk-hint">
        Konto samo niczego nie trzyma. Obszary, adresy i role należą do osób,
        które konto prowadzi.
      </p>

      {ring !== null && ring.has(account.id) && (
        <form
          className="wk-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() !== '') {
              void onAct('Liczenie kluczy nowej osoby…',
                () => createRole(ring, account, { kind: 'person', name }))
                .then(() => setName(''));
            }
          }}
        >
          <h3 className="wk-h2">Nowa osoba</h3>
          <label className="wk-field">
            <span>Imię</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </label>
          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={busy || name.trim() === ''}>Załóż osobę</button>
          </div>
          <p className="wk-hint">Powstają dwa klucze RSA-4096 — to potrwa kilka sekund.</p>
        </form>
      )}
    </>
  );
}
