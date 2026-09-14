/**
 * Obszary — die Schlüssel, ihre Epochen, und die Kalender darin.
 *
 * <b>Drei Achsen, und diese ist die erste.</b> Ein Bereich ist ein benannter
 * Schlüssel; Rollen halten ihn, Seiten zeigen, was unter ihm liegt. Keine der
 * drei besitzt eine andere — deshalb steht diese Ansicht neben Rollen und
 * Seiten und nicht in einer von beiden.
 *
 * <b>„Jawny" ist hier ein KLUCZ, kein Schalter.</b> Eine Epoche offenzulegen
 * heisst, ihren Schlüssel herauszugeben — und damit gilt es rückwirkend für
 * alles, was je unter ihr versiegelt wurde. Es lässt sich nicht zurücknehmen.
 * Deshalb steht es hier mit dieser Warnung und nicht als Häkchen an einem
 * Formular.
 *
 * <b>Ohne Passwort sind die Schlüssel fort.</b> Nach einem Neuladen liegt der
 * PasswordKey nicht mehr im Tab (`session.ts`), und ohne ihn lässt sich nichts
 * unterschreiben und nichts auspacken. Die Ansicht fragt dann danach — angemeldet
 * bleibt man dabei.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  createArea, loadAreas, loadMembers, myEpochKeys, publishEpoch,
  type AreaRow, type Member
} from './area';
import { createCalendar, loadCalendars, type CalendarRow } from './calendar';
import type { Ring, SealedRole } from './keys';
import { keysFor, forgetKeys } from './ringOf';
import { Seats } from './Seats';
import { WorkspaceError, type Who } from './session';
import { Unlock } from './Unlock';

export function Areas({ who }: { who: Who }) {
  const [areas, setAreas] = useState<readonly AreaRow[] | null | undefined>(undefined);
  const [calendars, setCalendars] = useState<readonly CalendarRow[]>([]);
  const [ring, setRing] = useState<Ring | null>(null);
  const [person, setPerson] = useState<SealedRole | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const look = useCallback(async () => {
    try {
      const { ring: bund, graph } = await keysFor(who);

      setRing(bund);
      setPerson(graph.roles.find((r) => r.isPersonal) ?? null);
      setAreas((await loadAreas()).areas);
      setCalendars((await loadCalendars()).calendars);
      setFailed(null);
    } catch (e) {
      setAreas(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać obszarów.');
    }
  }, [who]);

  useEffect(() => { void look(); }, [look]);

  const act = async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);

    try {
      await todo();
      forgetKeys();
      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  if (areas === undefined) return <p className="wk-lede">Wczytywanie…</p>;

  if (areas === null) {
    return (
      <>
        <p className="wk-error">{failed}</p>
        <p><button type="button" className="wk-btn" onClick={() => void look()}>Spróbuj ponownie</button></p>
      </>
    );
  }

  return (
    <>
      <p className="wk-lede">
        Obszar to nazwany klucz. Role go trzymają, strony pokazują to, co pod nim
        leży — a epoka mówi, od kiedy. Nic tu nie należy do nikogo innego: to
        osobna oś.
      </p>

      {ring === null && (
        <Unlock who={who} why="Bez hasła nie da się podpisać ani otworzyć klucza." onDone={() => void look()} />
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-hint">{busy}</p>}

      {areas.length === 0 ? (
        <p className="wk-empty">Nie prowadzisz jeszcze żadnego obszaru.</p>
      ) : (
        <ul className="wk-list">
          {areas.map((area) => (
            <AreaRowView
              key={area.areaId}
              area={area}
              areas={areas}
              calendars={calendars.filter((c) => c.areaId === area.areaId)}
              ring={ring}
              person={person}
              open={open === area.areaId}
              busy={busy !== null}
              onOpen={() => setOpen(open === area.areaId ? null : area.areaId)}
              onAct={act}
            />
          ))}
        </ul>
      )}

      <NewArea ring={ring} person={person} busy={busy !== null} onAct={act} />
    </>
  );
}

/* -- Ein Bereich ----------------------------------------------------------- */

function AreaRowView({ area, areas, calendars, ring, person, open, busy, onOpen, onAct }: {
  area: AreaRow;

  /** Alle — für den gemeinsamen Schlüssel einer Klasse. */
  areas: readonly AreaRow[];

  calendars: readonly CalendarRow[];
  ring: Ring | null;
  person: SealedRole | null;
  open: boolean;
  busy: boolean;
  onOpen: () => void;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [members, setMembers] = useState<readonly Member[]>([]);

  useEffect(() => {
    if (!open) return;
    loadMembers(area.areaId).then((found) => setMembers(found.members)).catch(() => setMembers([]));
  }, [open, area.areaId]);

  const publish = async () => {
    if (ring === null) return;

    /*
     * Der Schlüssel wird aus der EIGENEN Zuteilung zurückgeholt und nicht
     * irgendwo zwischengelegt. Damit geht das auch am Tag nach dem Anlegen —
     * und es geht nur dem, der ihn ohnehin hat.
     */
    const keys = await myEpochKeys(ring, area.areaId);
    const key = keys.get(area.currentEpoch);

    if (key === undefined) {
      throw new WorkspaceError('Nie masz klucza tej epoki — nie możesz jej ujawnić.');
    }

    await publishEpoch(area.areaId, area.currentEpoch, key);
  };

  const allOpen = area.publishedEpochs >= area.currentEpoch;

  return (
    <li className="wk-row">
      <span>
        <strong>{area.name}</strong>
        <span className="wk-row-side">
          {' · '}epoka {area.currentEpoch}
          {' · '}masz {area.heldEpochs}
          {area.publishedEpochs > 0 && <> · jawne {area.publishedEpochs}</>}
        </span>

        {open && (
          <div className="wk-form">
            <h3 className="wk-h2">Kalendarze</h3>

            {calendars.length === 0 ? (
              <p className="wk-empty">Żadnego — msze i spotkania potrzebują kalendarza.</p>
            ) : (
              <ul className="wk-tile-lines">
                {calendars.map((c) => (
                  <li key={c.calendarId}>
                    {c.title} <code className="wk-row-side">{c.timeZone}</code>
                  </li>
                ))}
              </ul>
            )}

            <NewCalendar areaId={area.areaId} busy={busy} onAct={onAct} />

            <h3 className="wk-h2">Kto trzyma</h3>
            <ul className="wk-tile-lines">
              {members.map((m) => (
                <li key={m.roleId}>
                  {m.kind === 'person' ? 'Osoba' : m.kind === 'group' ? 'Grupa' : 'Rola'}
                  {' '}<code>{m.roleId.slice(0, 8)}</code>
                </li>
              ))}
            </ul>

            {/*
              Die Plätze. Sie stehen HIER und nicht in einer eigenen Ansicht:
              ein Platz ist ein Platz IN einem Bereich, und wer ihn ausstellt,
              braucht dessen Epochenschlüssel — den hat er genau hier.
            */}
            {ring !== null && person !== null && (
              <Seats area={area} areas={areas} ring={ring} ownerRoleId={person.id} />
            )}

            {/*
              Offenlegen ist endgültig. Das gehört VOR den Knopf, nicht in eine
              Bestätigung danach: wer erst nach dem Klick erfährt, dass es nicht
              zurückgeht, erfährt es zu spät.
            */}
            <h3 className="wk-h2">Jawność</h3>
            {allOpen ? (
              <p className="wk-empty">Ta epoka jest już jawna — każdy może otworzyć to, co pod nią leży.</p>
            ) : (
              <>
                <p className="wk-hint">
                  Ujawnienie epoki wydaje jej klucz na zewnątrz. Działa wstecz —
                  obejmie wszystko, co kiedykolwiek pod nią zapieczętowano — i nie
                  da się go cofnąć.
                </p>
                <div className="wk-actions">
                  <button
                    type="button" className="wk-btn" disabled={busy || ring === null}
                    onClick={() => void onAct('Ujawnianie epoki…', publish)}
                  >
                    Ujawnij epokę {area.currentEpoch}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </span>

      <button type="button" className="wk-link-btn" onClick={onOpen}>
        {open ? 'Zamknij' : 'Otwórz'}
      </button>
    </li>
  );
}

/* -- Anlegen ---------------------------------------------------------------- */

function NewArea({ ring, person, busy, onAct }: {
  ring: Ring | null;
  person: SealedRole | null;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [name, setName] = useState('');

  const blocker =
    busy ? null
    : ring === null ? 'Najpierw podaj hasło — klucz trzeba podpisać.'
    : person === null ? 'Nie znaleziono Twojej roli osobistej.'
    : name.trim() === '' ? 'Nazwij obszar.'
    : null;

  return (
    <form
      className="wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (blocker !== null || ring === null || person === null) return;

        void onAct('Zakładanie obszaru…', () => createArea(ring, person, name)).then(() => setName(''));
      }}
    >
      <h2 className="wk-h2">Załóż obszar</h2>

      <label className="wk-field">
        <span>Nazwa</span>
        <input value={name} placeholder="np. Kancelaria" onChange={(e) => setName(e.target.value)} />
      </label>

      <p className="wk-hint">
        Klucz powstaje w tej przeglądarce — usługa dostaje go tylko zapakowanego
        i nie potrafi go otworzyć. Razem z nim powstają dwa zaświadczenia:
        <code>admin</code> i <code>certify</code>. Bez tego drugiego nikogo byś
        tu już nigdy nie wpuścił, także siebie.
      </p>

      {blocker !== null && !busy && <p className="wk-blocker">{blocker}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={blocker !== null || busy}>Załóż</button>
      </div>
    </form>
  );
}

function NewCalendar({ areaId, busy, onAct }: {
  areaId: string;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [zone, setZone] = useState('Europe/Warsaw');

  return (
    <form
      className="wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim() === '') return;

        void onAct('Zakładanie kalendarza…',
          () => createCalendar({ areaId, title: title.trim(), timeZone: zone }))
          .then(() => setTitle(''));
      }}
    >
      <label className="wk-field">
        <span>Nowy kalendarz</span>
        <input value={title} placeholder="np. Porządek mszy" onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="wk-field">
        <span>Strefa czasowa</span>
        <input value={zone} onChange={(e) => setZone(e.target.value)} />
      </label>

      <p className="wk-hint">
        Strefa należy do kalendarza, nie do czytelnika: msza o 18:00 jest o 18:00
        tam, gdzie się odprawia — także po zmianie czasu.
      </p>

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || title.trim() === ''}>
          Załóż kalendarz
        </button>
      </div>
    </form>
  );
}

export default Areas;
