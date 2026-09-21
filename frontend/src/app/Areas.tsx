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
  createArea, dropFromArea, loadAreas, loadMembers, myEpochKeys, setPublicLevel, setSeatLevel,
  PUBLIC_LEVELS, SEAT_LEVELS, type AreaRow, type Member, type PublicLevel
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
          {inOrder(areas).map(({ area, depth }) => (
            <AreaRowView
              key={area.areaId}
              area={area}
              depth={depth}
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

      <NewArea ring={ring} person={person} areas={areas} busy={busy !== null} onAct={act} />
    </>
  );
}

/**
 * Die Stufen in der Sprache, die im Haus gesprochen wird.
 *
 * <b>Kein `certify` darunter.</b> Es steht neben der Leiter (3.5) und heisst
 * etwas ganz anderes — „darf hineinlassen", nicht „darf mehr". In dieselbe
 * Liste gesetzt läse es sich als vierte Stufe, und genau der Fall, für den es
 * gedacht ist, ginge verloren.
 */
const LEVEL_NAME: Record<'read' | 'write' | 'admin', string> = {
  read: 'czytasz',
  write: 'piszesz',
  admin: 'prowadzisz'
};

/** Dieselben Wörter, aber über jemand anderen gesagt. */
const OTHER_LEVEL: Record<string, string> = {
  read: 'czyta',
  write: 'pisze',
  admin: 'prowadzi',
  certify: 'wpuszcza'
};

/* -- Der Baum -------------------------------------------------------------- */

/**
 * Die Bereiche in der Ordnung, in der sie liegen — `Parafia > Msza > Ofiary`.
 *
 * <b>Flach gezeichnet, mit Einzug.</b> Verschachtelte Listen wären hier eine
 * zweite Struktur neben `parent_area_id`, und zwei Strukturen laufen
 * auseinander. Die Tiefe steht deshalb an der Zeile, nicht im Markup.
 *
 * <b>Wessen Vater nicht dabei ist, steht ganz aussen.</b> Das ist kein Fehler,
 * sondern der Normalfall für jemanden, der den inneren Bereich lesen darf und
 * den äusseren nicht: der äussere kommt in seiner Liste gar nicht vor. Ihn als
 * „fehlt" zu zeigen verriete, dass es ihn gibt.
 */
function inOrder(areas: readonly AreaRow[]): readonly { area: AreaRow; depth: number }[] {
  const known = new Set(areas.map((a) => a.areaId));
  const out: { area: AreaRow; depth: number }[] = [];

  const under = (parent: string | null, depth: number) => {
    for (const area of areas) {
      const mine = area.parentAreaId !== null && known.has(area.parentAreaId)
        ? area.parentAreaId
        : null;

      if (mine !== parent) continue;

      out.push({ area, depth });
      under(area.areaId, depth + 1);
    }
  };

  under(null, 0);
  return out;
}

/* -- Ein Bereich ----------------------------------------------------------- */

function AreaRowView({ area, depth, areas, calendars, ring, person, open, busy, onOpen, onAct }: {
  area: AreaRow;

  /** Wie tief er liegt — der Einzug, nicht die Wahrheit: die steht in `parentAreaId`. */
  depth: number;

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

  const [note, setNote] = useState<string | null>(null);

  /**
   * Den Bereich nach aussen oeffnen oder schliessen.
   *
   * <b>Der Schluessel kommt aus der EIGENEN Zuteilung</b> und liegt nirgends
   * zwischen. Damit geht das auch am Tag nach dem Anlegen — und es geht nur
   * dem, der ihn ohnehin hat.
   *
   * <b>Beim Schliessen wird keiner gebraucht:</b> es wird einer weggenommen.
   */
  const openTo = async (level: PublicLevel) => {
    if (level === 'none') {
      await setPublicLevel(area.areaId, level);
      return;
    }

    if (ring === null) throw new WorkspaceError('Bez hasła nie otworzysz obszaru.');

    const keys = await myEpochKeys(ring, area.areaId);
    const key = keys.get(area.currentEpoch);

    if (key === undefined) {
      throw new WorkspaceError('Nie masz klucza tej epoki — nie możesz jej otworzyć.');
    }

    await setPublicLevel(area.areaId, level, key);
  };

  return (
    <li className="wk-row">
      <span style={{ paddingLeft: `${depth * 1.4}rem` }}>
        {/*
          DER EINZUG SAGT, WORIN ER LIEGT. Ein Strich davor, damit die Tiefe
          auch dann zu sehen ist, wenn nur ein einziger Bereich eingerückt
          dasteht — ohne ihn sähe es nach einem Satzfehler aus.
        */}
        {depth > 0 && <span className="wk-row-side" aria-hidden="true">└ </span>}

        <strong>{area.name}</strong>

        <span className="wk-row-side">
          {' · '}epoka {area.currentEpoch}
          {' · '}masz {area.heldEpochs}

          {/*
            WAS ICH HIER DARF — an der Zeile, nicht erst im aufgeklappten
            Kasten. Wer eine Liste von Bereichen überfliegt, fragt genau das.
          */}
          {area.myLevel !== null && <> · {LEVEL_NAME[area.myLevel]}</>}
          {area.mayCertify && <> · wpuszcza</>}
        </span>

        {/*
          ZWEI ZEICHEN, DIE NICHT DASSELBE SIND (0035): wie weit der Bereich
          nach aussen offen steht, und was jemand sieht, der über ein Formular
          hereinkommt. Beide stehen nur da, wenn sie etwas sagen — ein „nic"
          neben jedem Bereich wäre Lärm.
        */}
        {area.publicLevel !== 'none' && (
          <span className="wk-chip-ok" title="Bez konta, dla każdego">
            {area.publicLevel === 'write' ? 'jawny · można pisać' : 'jawny'}
          </span>
        )}

        {area.seatLevel !== 'own' && (
          <span className="wk-chip-ok" title="Co widzi osoba z formularza poza swoim">
            z formularza: {area.seatLevel === 'write' ? 'pisze' : 'czyta'}
          </span>
        )}

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

            <h3 className="wk-h2">Kto tu jest</h3>

            {/*
              MIT DER STUFE, nicht nur mit dem Namen. „Wer ist hier" ohne „was
              darf er" ist die Hälfte der Frage — und die unwichtigere.
            */}
            <ul className="wk-tile-lines">
              {members.map((m) => (
                <li key={m.roleId}>
                  {m.kind === 'person' ? 'Osoba' : m.kind === 'group' ? 'Grupa' : 'Rola'}
                  {' '}<code>{m.roleId.slice(0, 8)}</code>
                  {' — '}
                  {m.capabilities.map((c) => OTHER_LEVEL[c] ?? c).join(', ')}

                  {area.mayCertify && (
                    <>
                      {' · '}
                      <button
                        type="button" className="wk-link-btn" disabled={busy}
                        onClick={() => void onAct('Usuwanie z obszaru…', async () => {
                          const out = await dropFromArea(area.areaId, m.roleId);
                          setNote(out.note);
                          setMembers((was) => was.filter((x) => x.roleId !== m.roleId));
                        })}
                      >
                        Usuń stąd
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>

            {note !== null && <p className="wk-note">{note}</p>}

            {/*
              Die Plätze. Sie stehen HIER und nicht in einer eigenen Ansicht:
              ein Platz ist ein Platz IN einem Bereich, und wer ihn ausstellt,
              braucht dessen Epochenschlüssel — den hat er genau hier.
            */}
            {ring !== null && person !== null && (
              <Seats area={area} areas={areas} ring={ring} ownerRoleId={person.id} />
            )}

            {/* -- Nach aussen ------------------------------------------- */}

            <h3 className="wk-h2">Dla wszystkich</h3>

            {area.myLevel !== 'admin' ? (
              <p className="wk-empty">Tym steruje ten, kto prowadzi obszar.</p>
            ) : (
              <>
                <p className="wk-hint">
                  Otwarcie obszaru wydaje klucz epoki na zewnątrz — każdy będzie
                  mógł przeczytać to, co pod nią leży, także wstecz. Zamknięcie
                  odbiera klucz z tej chwili, ale nie odbiera go tym, którzy już
                  go sobie zapisali.
                </p>

                <div className="wk-actions">
                  {PUBLIC_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={level === area.publicLevel ? 'wk-btn' : 'wk-link-btn'}
                      disabled={busy || ring === null || level === area.publicLevel}
                      onClick={() => void onAct('Zmiana jawności…', () => openTo(level))}
                    >
                      {level === 'none' ? 'Zamknięty'
                        : level === 'read' ? 'Każdy czyta'
                        : 'Każdy czyta i pisze'}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* -- Dla tych z formularza --------------------------------- */}

            <h3 className="wk-h2">Kto przyjdzie przez formularz</h3>

            <p className="wk-hint">
              Swoje zgłoszenie taka osoba widzi zawsze — należy do niej. Tu
              ustawiasz tylko, ile widzi <em>poza</em> nim.
            </p>

            {area.myLevel !== 'admin' ? (
              <p className="wk-empty">Tym steruje ten, kto prowadzi obszar.</p>
            ) : (
              <div className="wk-actions">
                {SEAT_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={level === area.seatLevel ? 'wk-btn' : 'wk-link-btn'}
                    disabled={busy || level === area.seatLevel}
                    onClick={() => void onAct('Zmiana dostępu…', async () => {
                      await setSeatLevel(area.areaId, level);
                    })}
                  >
                    {level === 'own' ? 'Tylko swoje'
                      : level === 'read' ? 'Czyta wspólne'
                      : 'Czyta i pisze wspólne'}
                  </button>
                ))}
              </div>
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

function NewArea({ ring, person, areas, busy, onAct }: {
  ring: Ring | null;
  person: SealedRole | null;

  /** Worin er liegen kann — nur, wo ich selbst prowadzę (0035). */
  areas: readonly AreaRow[];

  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [inside, setInside] = useState('');

  /*
   * NUR DORT, WO ICH PROWADZĘ. Der Dienst verlangt `admin` auf dem äusseren
   * Bereich (0035); eine Auswahl, die mehr anböte, führte zu einem Knopf, der
   * beim Drücken absagt.
   */
  const canNest = areas.filter((a) => a.myLevel === 'admin');

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

        void onAct('Zakładanie obszaru…',
          () => createArea(ring, person, name, inside === '' ? undefined : inside))
          .then(() => { setName(''); setInside(''); });
      }}
    >
      <h2 className="wk-h2">Załóż obszar</h2>

      <label className="wk-field">
        <span>Nazwa</span>
        <input value={name} placeholder="np. Kancelaria" onChange={(e) => setName(e.target.value)} />
      </label>

      {canNest.length > 0 && (
        <label className="wk-field">
          <span>Wewnątrz</span>
          <select value={inside} onChange={(e) => setInside(e.target.value)}>
            <option value="">Nigdzie — osobny obszar</option>
            {canNest.map((a) => (
              <option key={a.areaId} value={a.areaId}>{a.name}</option>
            ))}
          </select>
        </label>
      )}

      {inside !== '' && (
        <p className="wk-hint">
          Kto ma tu wejść, musi już być w obszarze nadrzędnym — to warunek, nie
          dziedziczenie. Bycie tam samo w sobie nie daje tu niczego.
        </p>
      )}

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
