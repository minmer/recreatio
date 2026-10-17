/**
 * Was neben dem Bild der Rollen steht: die gewählte Rolle, das Konto, die Übergabe der Zertifikate.
 */

import { useEffect, useState } from 'react';

import { type Held, handOver, holdsAnything, loadHeld } from '../account/handOver';
import type { Ring, SealedRole } from '../core/keys';
import { type Who, WorkspaceError } from '../core/session';
import { DOTS, KIND_NAME } from './RoleNode';
import { type EdgeKind, type NewKind, type RoleEdge, type RoleGraphData, createRole, dropHolder, personsOf, renameRole, retypeRole, revokeRole } from './roles';

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

/** 1 obszar, 2 obszary, 5 obszarów. */
function counted(n: number, one: string, few: string, many: string): string {
  const tens = n % 100;
  const units = n % 10;
  const word = n === 1 ? one
    : units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few
    : many;
  return `${n} ${word}`;
}

/**
 * WAS DAS KONTO VOR 0040 BEKAM — einmal übergeben, dann nie wieder zu sehen.
 *
 * Oben über dem Graphen und nicht erst im Konto-Knoten: wer hier nicht
 * zufällig auf „Konto" klickt, sähe nie, dass seine Bereiche noch am falschen
 * Ort hängen.
 */
export function HandOverBar({ ring, graph, names, onDone }: {
  ring: Ring;
  graph: RoleGraphData;
  names: ReadonlyMap<string, string>;
  onDone: () => void;
}) {
  const [held, setHeld] = useState<Held | null>(null);
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const persons = personsOf(graph);

  useEffect(() => {
    let alive = true;
    loadHeld()
      .then((found) => { if (alive) setHeld(found); })
      .catch(() => { if (alive) setHeld(null); });
    return () => { alive = false; };
  }, [graph]);

  if (held === null || !holdsAnything(held)) return null;

  const what = [
    held.areas.length > 0 && counted(held.areas.length, 'obszar', 'obszary', 'obszarów'),
    held.addresses > 0 && counted(held.addresses, 'adres', 'adresy', 'adresów'),
    held.calendarItems > 0
      && counted(held.calendarItems, 'wpis w kalendarzu', 'wpisy w kalendarzu', 'wpisów w kalendarzu'),
    held.intakes.length > 0
      && counted(held.intakes.length, 'skrzynka formularza', 'skrzynki formularzy', 'skrzynek formularzy')
  ].filter((x): x is string => x !== false).join(', ');

  const person = persons.find((p) => p.id === to) ?? persons[0] ?? null;
  const nameOf = (p: SealedRole) => names.get(p.id) ?? 'bez nazwy';

  return (
    <div className="wk-warn">
      <p>
        <strong>Konto trzyma jeszcze samo: {what}.</strong>{' '}
        Od teraz należy to do osób — przekaż to jednej z nich. Klucze zostaną
        przepakowane w tej przeglądarce.
      </p>

      {person === null ? (
        <p>Najpierw załóż osobę: kliknij „Konto" w grafie.</p>
      ) : (
        <div className="wk-actions">
          {persons.length > 1 && (
            <select value={person.id} disabled={busy} onChange={(e) => setTo(e.target.value)}>
              {persons.map((p) => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}
            </select>
          )}
          <button
            type="button" className="wk-btn" disabled={busy}
            onClick={() => {
              setBusy(true);
              setFailed(null);
              handOver(ring, held, person)
                .then(() => onDone())
                .catch((e: unknown) => setFailed(
                  e instanceof WorkspaceError ? e.message : 'Nie udało się przekazać.'))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'Przepakowywanie kluczy…' : `Przekaż: ${nameOf(person)}`}
          </button>
        </div>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}
