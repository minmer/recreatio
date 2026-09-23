/**
 * Obszary — die Schlüssel und wer an ihnen steht.
 *
 * <b>Drei Achsen, und diese ist die erste.</b> Ein Bereich ist ein benannter
 * Schlüssel; Rollen halten ihn, Seiten zeigen, was unter ihm liegt. Keine der
 * drei besitzt eine andere — deshalb steht diese Ansicht neben Rollen und
 * Seiten und nicht in einer von beiden.
 *
 * <b>Drei Bilder, nicht eines.</b> Die Liste, ein einzelner Bereich, und das
 * Anlegen. Alles gleichzeitig zu zeigen hiess: jede Zeile trug ein Formular
 * für etwas, das man gerade nicht tut, und unter zwanzig Bereichen fand man
 * den gesuchten nicht mehr. Wer einen Bereich öffnet, bekommt ihn ganz; der
 * Pfeil führt zurück.
 *
 * <b>Was hier NICHT steht.</b> Kalender gehören zum Kalender. Sie standen hier,
 * weil ein Kalender einen Bereich BRAUCHT — das ist ein Grund, sie zu
 * verbinden, und keiner, sie hier zu führen.
 *
 * <b>Ohne Passwort sind die Schlüssel fort.</b> Nach einem Neuladen liegt der
 * PasswordKey nicht mehr im Tab (`session.ts`), und ohne ihn lässt sich nichts
 * unterschreiben und nichts auspacken. Die Ansicht fragt dann danach —
 * angemeldet bleibt man dabei.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  createArea, dropFromArea, loadAreas, loadMembers, myEpochKeys,
  setPublicLevel, setSeatLevel,
  PUBLIC_LEVELS, SEAT_LEVELS, type AreaRow, type Member, type PublicLevel
} from './area';
import type { Ring, SealedRole } from './keys';
import { keysFor, forgetKeys } from './ringOf';
import { Seats } from './Seats';
import { WorkspaceError, type Who } from './session';
import { Unlock } from './Unlock';

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

/** Welches der drei Bilder gerade dasteht. */
type View =
  | { readonly at: 'list' }
  | { readonly at: 'area'; readonly areaId: string }
  | { readonly at: 'new' };

export function Areas({ who }: { who: Who }) {
  const [areas, setAreas] = useState<readonly AreaRow[] | null | undefined>(undefined);
  const [ring, setRing] = useState<Ring | null>(null);
  const [person, setPerson] = useState<SealedRole | null>(null);
  const [view, setView] = useState<View>({ at: 'list' });
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const look = useCallback(async () => {
    try {
      const { ring: bund, graph } = await keysFor(who);

      setRing(bund);
      setPerson(graph.roles.find((r) => r.isPersonal) ?? null);
      setAreas((await loadAreas()).areas);
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

  /*
   * Der geöffnete Bereich, frisch aus der Liste geholt. NICHT beim Öffnen
   * weggelegt: nach einer Änderung stünde sonst der alte Stand da, und man
   * sähe seine eigene Änderung nicht.
   */
  const shown = view.at === 'area'
    ? areas.find((a) => a.areaId === view.areaId) ?? null
    : null;

  const head = (
    <>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-hint">{busy}</p>}
    </>
  );

  /* -- Ein einzelner Bereich, ganz ----------------------------------------- */

  if (view.at === 'area') {
    if (shown === null) {
      /* Weggefallen, während er offen war — zurück statt ins Leere. */
      return (
        <>
          <Back onClick={() => setView({ at: 'list' })} />
          <p className="wk-empty">Tego obszaru już nie ma.</p>
        </>
      );
    }

    return (
      <>
        <Back onClick={() => setView({ at: 'list' })} />
        {head}

        {ring === null && (
          <Unlock who={who} why="Bez hasła nie da się podpisać ani otworzyć klucza." onDone={() => void look()} />
        )}

        <AreaPage
          area={shown}
          areas={areas}
          ring={ring}
          person={person}
          busy={busy !== null}
          onAct={act}
        />
      </>
    );
  }

  /* -- Anlegen, ganz ------------------------------------------------------- */

  if (view.at === 'new') {
    return (
      <>
        <Back onClick={() => setView({ at: 'list' })} />
        {head}

        {ring === null && (
          <Unlock who={who} why="Bez hasła nie da się podpisać klucza." onDone={() => void look()} />
        )}

        <NewArea
          ring={ring}
          person={person}
          areas={areas}
          busy={busy !== null}
          onAct={act}
          onDone={() => setView({ at: 'list' })}
        />
      </>
    );
  }

  /* -- Die Liste ----------------------------------------------------------- */

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

      {head}

      {areas.length === 0 ? (
        <p className="wk-empty">Nie prowadzisz jeszcze żadnego obszaru.</p>
      ) : (
        <ul className="wk-list">
          {inOrder(areas).map(({ area, depth }) => (
            <li className="wk-row" key={area.areaId}>
              <span style={{ paddingLeft: `${depth * 1.4}rem` }}>
                {/*
                  Der Einzug sagt, worin er liegt. Ein Strich davor, damit die
                  Tiefe auch bei einem einzelnen eingerückten Bereich zu sehen
                  ist — ohne ihn sähe es nach einem Satzfehler aus.
                */}
                {depth > 0 && <span className="wk-row-side" aria-hidden="true">└ </span>}

                <button
                  type="button"
                  className="wk-link-btn"
                  onClick={() => setView({ at: 'area', areaId: area.areaId })}
                >
                  <strong>{area.name}</strong>
                </button>

                <span className="wk-row-side">
                  {area.myLevel !== null && <> · {LEVEL_NAME[area.myLevel]}</>}
                </span>

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
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => setView({ at: 'new' })}>
          Załóż obszar
        </button>
      </div>
    </>
  );
}

/** Der Weg zurück. Er steht oben links, weil er dort gesucht wird. */
function Back({ onClick }: { onClick: () => void }) {
  return (
    <p>
      <button type="button" className="wk-link-btn" onClick={onClick}>
        ← Wszystkie obszary
      </button>
    </p>
  );
}

/* -- Ein Bereich, ganz ------------------------------------------------------ */

/** Welcher Abschnitt gerade offen ist. `null` heisst: keiner. */
type Section = 'roles' | 'forms' | 'public' | null;

/**
 * Ein Bereich mit allem, was an ihm hängt — aber jeweils nur EIN Abschnitt
 * offen.
 *
 * <b>Warum nicht alles untereinander.</b> Die drei Abschnitte beantworten drei
 * verschiedene Fragen, und wer eine davon stellt, stellt die anderen gerade
 * nicht. Alles zugleich zu zeigen heisst: drei Formulare auf einem Bild, von
 * denen zwei Arbeit sind, die niemand vorhat — und das Gesuchte liegt darunter.
 */
function AreaPage({ area, areas, ring, person, busy, onAct }: {
  area: AreaRow;
  areas: readonly AreaRow[];
  ring: Ring | null;
  person: SealedRole | null;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [section, setSection] = useState<Section>(null);
  const [members, setMembers] = useState<readonly Member[]>([]);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (section !== 'roles') return;

    loadMembers(area.areaId)
      .then((found) => setMembers(found.members))
      .catch(() => setMembers([]));
  }, [section, area.areaId]);

  const parent = area.parentAreaId === null
    ? null
    : areas.find((a) => a.areaId === area.parentAreaId) ?? null;

  /**
   * Den Bereich nach aussen öffnen oder schliessen.
   *
   * <b>Der Schlüssel kommt aus der EIGENEN Zuteilung</b> und liegt nirgends
   * zwischen. Damit geht das auch am Tag nach dem Anlegen — und es geht nur
   * dem, der ihn ohnehin hat. Beim Schliessen wird keiner gebraucht: es wird
   * einer weggenommen.
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
    <>
      <h2 className="wk-h1">{area.name}</h2>

      <p className="wk-row-side">
        epoka {area.currentEpoch}
        {' · '}masz {area.heldEpochs}
        {area.myLevel !== null && <> · {LEVEL_NAME[area.myLevel]}</>}
        {area.mayCertify && <> · wpuszczasz</>}
        {parent !== null && <> · wewnątrz: {parent.name}</>}
      </p>

      {/*
        DIE VORAUSSETZUNG, an der Stelle, an der sie gilt. Wer hier jemanden
        aufnehmen will, muss wissen, dass die Person zuerst aussen stehen muss —
        sonst erfährt er es erst an der Absage.
      */}
      {parent !== null && (
        <p className="wk-hint">
          Kto ma tu wejść, musi już być w obszarze <strong>{parent.name}</strong>.
          To warunek, nie dziedziczenie — bycie tam samo w sobie nie daje tu niczego.
        </p>
      )}

      <div className="wk-actions">
        <Tab now={section} mine="roles" onPick={setSection}>Role</Tab>
        <Tab now={section} mine="forms" onPick={setSection}>Z formularza</Tab>
        <Tab now={section} mine="public" onPick={setSection}>Dla wszystkich</Tab>
      </div>

      {/* -- Wer hier ist ---------------------------------------------- */}

      {section === 'roles' && (
        <div className="wk-form">
          <ul className="wk-tile-lines">
            {members.length === 0 && <li className="wk-empty">Nikogo — albo jeszcze się nie wczytało.</li>}

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
        </div>
      )}

      {/* -- Wer über ein Formular hereinkommt -------------------------- */}

      {section === 'forms' && (
        <div className="wk-form">
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

          {/*
            Die Plätze selbst. Sie stehen HIER, weil ein Platz ein Platz IN
            einem Bereich ist und wer ihn ausstellt, dessen Epochenschlüssel
            braucht — den hat er genau hier.
          */}
          {ring !== null && person !== null && (
            <Seats area={area} areas={areas} ring={ring} ownerRoleId={person.id} />
          )}
        </div>
      )}

      {/* -- Nach aussen ------------------------------------------------ */}

      {section === 'public' && (
        <div className="wk-form">
          <p className="wk-hint">
            Otwarcie obszaru wydaje klucz epoki na zewnątrz — każdy będzie mógł
            przeczytać to, co pod nią leży, także wstecz. Zamknięcie odbiera
            klucz z tej chwili, ale nie odbiera go tym, którzy już go sobie
            zapisali.
          </p>

          {area.myLevel !== 'admin' ? (
            <p className="wk-empty">Tym steruje ten, kto prowadzi obszar.</p>
          ) : (
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
          )}
        </div>
      )}
    </>
  );
}

/** Ein Reiter. Noch einmal darauf zu drücken klappt ihn zu. */
function Tab({ now, mine, onPick, children }: {
  now: Section;
  mine: Exclude<Section, null>;
  onPick: (s: Section) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={now === mine ? 'wk-btn' : 'wk-link-btn'}
      onClick={() => onPick(now === mine ? null : mine)}
    >
      {children}
    </button>
  );
}

/* -- Anlegen ---------------------------------------------------------------- */

function NewArea({ ring, person, areas, busy, onAct, onDone }: {
  ring: Ring | null;
  person: SealedRole | null;
  areas: readonly AreaRow[];
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
  onDone: () => void;
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
          .then(onDone);
      }}
    >
      <h2 className="wk-h1">Załóż obszar</h2>

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
        i nie potrafi go otworzyć. Razem z nim powstają dwa zaświadczenia:{' '}
        <code>admin</code> i <code>certify</code>. Bez tego drugiego nikogo byś
        tu już nigdy nie wpuścił, także siebie.
      </p>

      {blocker !== null && !busy && <p className="wk-blocker">{blocker}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={blocker !== null}>
          Załóż
        </button>
      </div>
    </form>
  );
}

export default Areas;
