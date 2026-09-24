/**
 * Obszary — die Schlüssel und wer an ihnen steht.
 *
 * <b>Drei Achsen, und diese ist die erste.</b> Ein Bereich ist ein benannter
 * Schlüssel; Rollen halten ihn, Seiten zeigen, was unter ihm liegt. Keine der
 * drei besitzt eine andere — deshalb steht diese Ansicht neben Rollen und
 * Seiten und nicht in einer von beiden.
 *
 * <b>Drei Bilder, nicht eines.</b> Die Liste, ein einzelner Bereich, und das
 * Anlegen — alle drei sind Adressen, und der Weg dorthin steht oben im Kopf.
 *
 * <b>Was hier NICHT mehr steht: die Erklärung.</b> Auf dieser Seite standen
 * fünf Absätze darüber, was ein Bereich ist, wie ein Epochenschlüssel entsteht
 * und warum es zwei Zeugnisse braucht. Wer hier ankommt, will einen Bereich
 * öffnen oder anlegen — er liest das nicht, und was er wirklich wissen muss
 * (dass ein geschlossener Bereich niemandem zurücknimmt, was er sich schon
 * abgeschrieben hat) ging darin unter. Jetzt steht ein Satz da, an der Stelle,
 * an der er gilt.
 *
 * <b>Und der Zustand steht nicht mehr in Prosa.</b> „epoka 3 · masz 2 ·
 * prowadzisz · wpuszczasz" war eine Zeile, die man lesen musste, um vier
 * Angaben zu erfahren. Vier Felder sagen dasselbe auf einen Blick.
 *
 * <b>Ohne Passwort sind die Schlüssel fort.</b> Nach einem Neuladen liegt der
 * PasswordKey nicht mehr im Tab (`session.ts`), und ohne ihn lässt sich nichts
 * unterschreiben und nichts auspacken. Die Ansicht fragt dann danach —
 * angemeldet bleibt man dabei.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  besideIt, chainTo, createArea, dropFromArea, inOrder, loadAreas, loadMembers, myEpochKeys,
  setPublicLevel, setSeatLevel,
  PUBLIC_LEVELS, SEAT_LEVELS, type AreaRow, type Member, type PublicLevel
} from './area';
import { useCrumbs, type Crumb } from './crumbTrail';
import type { Ring, SealedRole } from './keys';
import { keysFor, forgetKeys } from './ringOf';
import { viewPath } from './routes';
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

const KIND_NAME: Record<Member['kind'], string> = {
  person: 'Osoba',
  group: 'Grupa',
  role: 'Rola'
};

/**
 * Welches der drei Bilder gerade dasteht — und zwar AUS DER ADRESSE.
 *
 * <b>`#/workspace/areas` ist die Liste, `#/workspace/areas/<kennung>` ein
 * Bereich, `#/workspace/areas/new` das Anlegen.</b> Als Zustand im Speicher
 * liess sich ein aufgeschlagener Bereich nicht verschicken, ein Neuladen warf
 * einen heraus, und der Zurück-Pfeil des Browsers verliess den Arbeitsplatz,
 * statt den Bereich zu schliessen.
 *
 * <b>`new` kann keine Kennung sein.</b> Kennungen sind UUIDs; das Wort ist
 * damit frei und muss nicht gesperrt werden.
 */
type View =
  | { readonly at: 'list' }
  | { readonly at: 'area'; readonly areaId: string }
  | { readonly at: 'new' };

const NEW = 'new';

const viewOf = (trail: readonly string[]): View =>
  trail[0] === undefined ? { at: 'list' }
  : trail[0] === NEW ? { at: NEW }
  : { at: 'area', areaId: trail[0] };

export function Areas({ who, trail }: { who: Who; trail: readonly string[] }) {
  const [areas, setAreas] = useState<readonly AreaRow[] | null | undefined>(undefined);
  const [ring, setRing] = useState<Ring | null>(null);
  const [person, setPerson] = useState<SealedRole | null>(null);
  const view = viewOf(trail);
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

  /*
   * DER WEG OBEN IM KOPF.
   *
   * In der Adresse steht eine Kennung; ein Mensch liest darin nichts. Was
   * dort stehen soll, ist „Parafia › Schola" — und das weiss nur diese
   * Ansicht, weil sie die Bereiche ohnehin geladen hat.
   *
   * <b>Jede Stufe nimmt ihre Geschwister mit.</b> Wer in einem Unterbereich
   * steht, will meistens in den daneben; hinauf und wieder hinunter sind zwei
   * Klicks für etwas, das einer sein sollte.
   */
  const list = areas ?? [];

  const crumbs: Crumb[] = view.at === NEW
    ? [{ label: 'Nowy obszar', href: null }]
    : view.at === 'area'
      ? chainTo(list, view.areaId).map((step) => ({
          label: step.name,
          href: viewPath('areas', step.areaId),
          beside: besideIt(list, step)
            .map((other) => ({ label: other.name, href: viewPath('areas', other.areaId) }))
        }))
      : [];

  useCrumbs(crumbs);

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

  if (areas === undefined) return <p className="wk-empty">Wczytywanie…</p>;

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
      {busy !== null && <p className="wk-working">{busy}</p>}

      {ring === null && (
        <Unlock who={who} why="Bez hasła nie otworzysz klucza." onDone={() => void look()} />
      )}
    </>
  );

  /* -- Ein einzelner Bereich, ganz ----------------------------------------- */

  if (view.at === 'area') {
    if (shown === null) {
      /* Weggefallen, während er offen war. */
      return <p className="wk-empty">Tego obszaru już nie ma.</p>;
    }

    return (
      <>
        {head}
        <AreaPage
          area={shown}
          areas={areas}
          ring={ring}
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
        {head}
        <NewArea
          ring={ring}
          person={person}
          areas={areas}
          busy={busy !== null}
          onAct={act}
          onDone={() => { window.location.hash = viewPath('areas'); }}
        />
      </>
    );
  }

  /* -- Die Liste ----------------------------------------------------------- */

  return (
    <>
      {head}

      {/*
        DIE TIEFE STEHT AN DER ZEILE, nicht im Markup. Verschachtelte Listen
        wären eine zweite Struktur neben `parent_area_id`, und zwei Strukturen
        laufen auseinander.
      */}
      <ul className="wk-tree">
        {inOrder(areas).map(({ area, depth }) => (
          <li key={area.areaId}>
            <a
              className="wk-tree-row"
              href={viewPath('areas', area.areaId)}
              style={{ '--depth': depth } as React.CSSProperties}
            >
              <span className="wk-tree-name">{area.name}</span>
              <Tags area={area} />
              {area.myLevel !== null && (
                <span className="wk-tree-mine">{LEVEL_NAME[area.myLevel]}</span>
              )}
            </a>
          </li>
        ))}

        {/*
          Der Neue steht am ENDE der Liste und nicht in einer Leiste darüber:
          dort, wo die Dinge sind, gehört auch das Anlegen eines weiteren hin.
        */}
        <li>
          <a className="wk-tree-add" href={viewPath('areas', NEW)}>
            <span aria-hidden="true">+</span> Nowy obszar
          </a>
        </li>
      </ul>

      {areas.length === 0 && (
        <p className="wk-empty">Obszar to klucz. Bez niego nie ma gdzie niczego zamknąć.</p>
      )}
    </>
  );
}

/* -- Was an einem Bereich auffällt ----------------------------------------- */

/**
 * Nur, was vom Normalfall ABWEICHT.
 *
 * Ein Plättchen an jeder Zeile wäre keines: stünde „zamknięty" überall, liesse
 * sich das Offene nicht mehr herauslesen. Was dasteht, ist das, was auffallen
 * soll.
 */
function Tags({ area }: { area: AreaRow }) {
  return (
    <span className="wk-tags">
      {area.publicLevel !== 'none' && (
        <span className="wk-tag wk-tag-open" title="Bez konta, dla każdego">
          {area.publicLevel === 'write' ? 'jawny · pisze' : 'jawny'}
        </span>
      )}

      {area.seatLevel !== 'own' && (
        <span className="wk-tag" title="Co widzi osoba z formularza poza swoim">
          formularz: {area.seatLevel === 'write' ? 'pisze' : 'czyta'}
        </span>
      )}
    </span>
  );
}

/* -- Ein Bereich, ganz ------------------------------------------------------ */

/** Welcher Abschnitt offen ist. Einer ist es immer. */
type Section = 'roles' | 'forms' | 'public';

/**
 * Ein Bereich mit allem, was an ihm hängt — aber jeweils nur EIN Abschnitt.
 *
 * <b>Warum nicht alles untereinander.</b> Die drei Abschnitte beantworten drei
 * verschiedene Fragen, und wer eine davon stellt, stellt die anderen gerade
 * nicht.
 *
 * <b>Und einer steht offen.</b> Vorher war beim Ankommen keiner offen, und die
 * Seite zeigte einen Namen, vier Angaben und drei Knöpfe — man musste erst
 * etwas tun, um überhaupt etwas zu sehen. „Wer ist hier" ist die Frage, mit der
 * fast jeder kommt.
 */
function AreaPage({ area, areas, ring, busy, onAct }: {
  area: AreaRow;
  areas: readonly AreaRow[];
  ring: Ring | null;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [section, setSection] = useState<Section>('roles');
  const [members, setMembers] = useState<readonly Member[] | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (section !== 'roles') return;

    let dropped = false;

    void (async () => {
      let found: readonly Member[] = [];
      try { found = (await loadMembers(area.areaId)).members; } catch { /* leer */ }
      if (dropped) return;

      setMembers(found);

      /*
       * NAMEN STATT KENNUNGEN, wo es geht.
       *
       * Hier stand `roleId.slice(0, 8)` — acht Zeichen Hex als Bezeichnung
       * eines Menschen. Lesbar ist der Name nur für den, der den Schlüssel der
       * Rolle hält; für alle anderen bleibt die Kennung, und DAS ist die
       * ehrliche Antwort: „nicht für dich" und nicht „namenlos".
       */
      if (ring === null) return;

      const read = new Map<string, string>();

      for (const one of found) {
        const name = await ring.name(one.roleId);
        if (name !== null) read.set(one.roleId, name);
      }

      if (!dropped) setNames(read);
    })();

    return () => { dropped = true; };
  }, [section, area.areaId, ring]);

  const parent = area.parentAreaId === null
    ? null
    : areas.find((a) => a.areaId === area.parentAreaId) ?? null;

  /**
   * Den Bereich nach aussen öffnen oder schliessen.
   *
   * <b>Der Schlüssel kommt aus der EIGENEN Zuteilung</b> und liegt nirgends
   * zwischen. Beim Schliessen wird keiner gebraucht: es wird einer weggenommen.
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

  const mine = area.myLevel === 'admin';

  return (
    <>
      {/*
        <b>`h1` und nicht `h2`.</b> Seit der Weg oben die Ansicht nennt, steht
        hier die einzige Überschrift der Seite.
      */}
      <h1 className="wk-h1">{area.name}</h1>

      {/*
        VIER ANGABEN ALS VIER FELDER. Als Satz mit Trennpunkten musste man ihn
        lesen, um sie zu erfahren.
      */}
      <dl className="wk-facts">
        <Fact label="Epoka">{area.currentEpoch}</Fact>
        <Fact label="Twoje klucze">{area.heldEpochs}</Fact>
        <Fact label="Ty">
          {area.myLevel === null ? '—' : LEVEL_NAME[area.myLevel]}
          {area.mayCertify && <span className="wk-tag">wpuszczasz</span>}
        </Fact>
        {parent !== null && (
          <Fact label="Wewnątrz">
            <a className="wk-crumb-link" href={viewPath('areas', parent.areaId)}>{parent.name}</a>
          </Fact>
        )}
      </dl>

      <div className="wk-tabs" role="tablist">
        <Tab now={section} mine="roles" onPick={setSection}>Role</Tab>
        <Tab now={section} mine="forms" onPick={setSection}>Z formularza</Tab>
        <Tab now={section} mine="public" onPick={setSection}>Dla wszystkich</Tab>
      </div>

      {/* -- Wer hier ist ---------------------------------------------- */}

      {section === 'roles' && (
        <div className="wk-panel">
          {members === null ? (
            <p className="wk-empty">Wczytywanie…</p>
          ) : members.length === 0 ? (
            <p className="wk-empty">Nikogo tu jeszcze nie ma.</p>
          ) : (
            <ul className="wk-people">
              {members.map((m) => (
                <li className="wk-person" key={m.roleId}>
                  <span className="wk-person-who">
                    <span className="wk-tag">{KIND_NAME[m.kind]}</span>
                    {names.has(m.roleId)
                      ? <strong>{names.get(m.roleId)}</strong>
                      : <code className="wk-person-id">{m.roleId.slice(0, 8)}</code>}
                  </span>

                  <span className="wk-person-can">
                    {m.capabilities.map((c) => (
                      <span className="wk-tag" key={c}>{OTHER_LEVEL[c] ?? c}</span>
                    ))}
                  </span>

                  {area.mayCertify && (
                    <button
                      type="button" className="wk-link-btn" disabled={busy}
                      onClick={() => void onAct('Usuwanie…', async () => {
                        const out = await dropFromArea(area.areaId, m.roleId);
                        setNote(out.note);
                        setMembers((was) => (was ?? []).filter((x) => x.roleId !== m.roleId));
                      })}
                    >
                      Usuń
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/*
            DIE VORAUSSETZUNG, an der Stelle, an der sie gilt — und nicht mehr
            oben auf der Seite, wo sie jeden empfing, der bloss nachsehen wollte.
          */}
          {parent !== null && (
            <p className="wk-hint">
              Wejść tu może tylko ktoś, kto jest już w <strong>{parent.name}</strong>.
            </p>
          )}

          {note !== null && <p className="wk-note">{note}</p>}
        </div>
      )}

      {/* -- Wer über ein Formular hereinkommt -------------------------- */}

      {section === 'forms' && (
        <div className="wk-panel">
          {mine ? (
            <Segment
              now={area.seatLevel}
              options={SEAT_LEVELS.map((level) => ({
                value: level,
                label: level === 'own' ? 'Tylko swoje'
                  : level === 'read' ? 'Czyta wspólne'
                  : 'Czyta i pisze wspólne'
              }))}
              busy={busy}
              onPick={(level) => void onAct('Zmiana dostępu…', () => setSeatLevel(area.areaId, level))}
            />
          ) : (
            <p className="wk-empty">Tym steruje ten, kto prowadzi obszar.</p>
          )}

          <p className="wk-hint">Swoje zgłoszenie taka osoba widzi zawsze.</p>

          {/*
            HIER STANDEN DIE PLÄTZE — und das Ausstellen von Hand.

            Es war dieselbe Sache zweimal: wer ein Formular führt, sieht
            jede Einsendung mitsamt Namen, Antworten und Link an einer
            Stelle (`FormOffice`). Der Knopf hier erzeugte daneben einen
            Platz OHNE Einsendung — einen, den danach nur eine zweite Liste
            wiederfand.

            Was an dieser Stelle bleibt, ist die Einstellung darüber: WIE
            VIEL so jemand ausser seinem Eigenen sieht. Das ist eine
            Eigenschaft des Bereichs und gehört nirgendwo sonst hin.
          */}
        </div>
      )}

      {/* -- Nach aussen ------------------------------------------------ */}

      {section === 'public' && (
        <div className="wk-panel">
          {mine ? (
            <Segment
              now={area.publicLevel}
              options={PUBLIC_LEVELS.map((level) => ({
                value: level,
                label: level === 'none' ? 'Zamknięty'
                  : level === 'read' ? 'Każdy czyta'
                  : 'Każdy czyta i pisze'
              }))}
              busy={busy || ring === null}
              onPick={(level) => void onAct('Zmiana jawności…', () => openTo(level))}
            />
          ) : (
            <p className="wk-empty">Tym steruje ten, kto prowadzi obszar.</p>
          )}

          {/*
            DER EINE SATZ, DER BLEIBEN MUSS. Hier standen vier Zeilen über
            Epochenschlüssel; darin ging unter, was wirklich zählt — und das
            steht jetzt allein da, und nur dann, wenn es etwas zu verlieren gibt.
          */}
          {area.publicLevel !== 'none' && (
            <p className="wk-warn">
              Zamknięcie nie odbiera klucza tym, którzy już go sobie zapisali.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="wk-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Ein Reiter. Einer ist immer gewählt — zuklappen geht nicht mehr. */
function Tab({ now, mine, onPick, children }: {
  now: Section;
  mine: Section;
  onPick: (s: Section) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={now === mine}
      className={now === mine ? 'wk-tab wk-tab-on' : 'wk-tab'}
      onClick={() => onPick(mine)}
    >
      {children}
    </button>
  );
}

/**
 * Eine Stufe aus wenigen — als EIN Bedienelement.
 *
 * <b>Vorher war die gewählte Stufe ein gefüllter Knopf</b> und die übrigen
 * unterstrichene Verweise: das Gewählte sah aus, als wäre es das, was man
 * drücken soll. Hier ist es ein Feld mit Abteilungen, und die eingeschaltete
 * ist erkennbar eingeschaltet.
 */
function Segment<T extends string>({ now, options, busy, onPick }: {
  now: T;
  options: readonly { value: T; label: string }[];
  busy: boolean;
  onPick: (value: T) => void;
}) {
  return (
    <div className="wk-seg" role="group">
      {options.map((one) => (
        <button
          key={one.value}
          type="button"
          aria-pressed={one.value === now}
          className={one.value === now ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
          disabled={busy || one.value === now}
          onClick={() => onPick(one.value)}
        >
          {one.label}
        </button>
      ))}
    </div>
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
    : ring === null ? 'Najpierw podaj hasło.'
    : person === null ? 'Nie znaleziono Twojej roli osobistej.'
    : name.trim() === '' ? 'Nazwij obszar.'
    : null;

  return (
    <form
      className="wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (blocker !== null || ring === null || person === null) return;

        void onAct('Zakładanie…',
          () => createArea(ring, person, name, inside === '' ? undefined : inside))
          .then(onDone);
      }}
    >
      <h1 className="wk-h1">Nowy obszar</h1>

      <label className="wk-field">
        <span>Nazwa</span>
        <input
          value={name}
          placeholder="np. Kancelaria"
          onChange={(e) => setName(e.target.value)}
        />
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

      {/*
        NUR WENN ES GILT. Hier standen zwei Absätze — einer über die
        Voraussetzung, einer darüber, wie der Schlüssel entsteht. Den zweiten
        liest niemand, der gerade einen Namen eintippt.
      */}
      {inside !== '' && (
        <p className="wk-hint">
          Wejść tam będzie mógł tylko ktoś, kto jest już w obszarze nadrzędnym.
        </p>
      )}

      {blocker !== null && !busy && <p className="wk-blocker">{blocker}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={blocker !== null}>Załóż</button>
      </div>
    </form>
  );
}

export default Areas;
