/**
 * Eine Gruppe von innen — Auskunft, Kalender, Gespräch, Aufgaben, Leute.
 *
 * <b>Diese Datei baut fast nichts selbst.</b> Der Chat ist `RcAreaView`, der
 * Kalender ist `RcCalendarDetail` — dieselben Bauteile wie in der Werkstatt,
 * nur mit der Kennung dieses Bereichs. Das ist die ganze Idee hinter „eine
 * Gruppe ist ein Bereich mit einer Vordertür": ein zweites Nachrichtenwesen
 * daneben wäre ein zweiter Lesepfad für dieselben versiegelten Daten, und der
 * zweite ist immer der, den beim nächsten Sicherheitsbefund niemand mitprüft.
 *
 * <b>Was diese Datei WIRKLICH beiträgt</b>, sind drei Dinge:
 *
 *   1. Die Tür — wer draußen steht, sieht den Aushang und erfährt, wie man
 *      hineinkommt. Nicht eine Fehlermeldung.
 *   2. Die beiden Auskünfte nebeneinander und beschriftet: was im Schaukasten
 *      hängt und was versiegelt liegt.
 *   3. Die Aufgabe, die aus einem Gespräch entstand — die Verbindung, die es
 *      vorher nirgends gab.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { RcRequestError } from '../lib/rcApi';
import { rcAreas, rcRoles, type RcArea, type RcRole } from '../lib/rcChat';
import { rcAddItem, rcCalendars, rcOccurrences, type RcCalendar, type RcOccurrence } from '../lib/rcCalendar';
import { rcCreateInvitation, rcInviteLink } from '../lib/rcInvite';
import { rcTopics, type RcTopic } from '../lib/rcThreads';
import { RcAreaView } from '../RcChat';
import { RcCalendarDetail } from '../RcCalendar';
import type { RcLang } from '../i18n';
import {
  rcGroup, rcGroups, rcGroupStance, rcMemberCount, rcNoteState, rcSaveGroup,
  type RcGroupOne
} from './rcGroups';

type Tab = 'info' | 'calendar' | 'chat' | 'tasks' | 'people';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'info', label: 'O wspólnocie' },
  { id: 'calendar', label: 'Kalendarz' },
  { id: 'chat', label: 'Rozmowa' },
  { id: 'tasks', label: 'Zadania' },
  { id: 'people', label: 'Osoby' }
];

export function RcGroupPage({
  parishId, groupSlug, signedIn, lang, at, onError
}: {
  parishId: string;
  groupSlug: string;
  signedIn: boolean;
  lang: RcLang;
  at: (pageId: string) => string;
  onError: (message: string) => void;
}) {
  const [group, setGroup] = useState<RcGroupOne | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('info');

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      /*
       * ZWEI SCHRITTE, WEIL DIE ADRESSE EIN NAME IST UND KEINE KENNUNG.
       *
       * `…/community/ministranci` nennt die Gruppe so, wie ein Mensch sie
       * nennt. Der Dienst führt sie unter einer Kennung. Der Umweg über die
       * Liste ist der Preis dafür, dass die Adresse lesbar bleibt — und der
       * ist es wert: eine Adresse mit einer Kennung darin kann niemand
       * vorlesen.
       */
      const list = await rcGroups(parishId);
      const found = (list.groups ?? []).find((g) => g.slug === groupSlug);

      if (found === undefined) { setMissing(true); return; }

      setGroup(await rcGroup(found.groupId));
      setMissing(false);
      setError(null);
    } catch (e) {
      setError(e instanceof RcRequestError
        ? 'Nie udało się wczytać wspólnoty — sprawdź, czy konto jest odblokowane.'
        : 'Nie udało się wczytać wspólnoty.');
    }
  }, [parishId, groupSlug, signedIn]);

  useEffect(() => { void load(); }, [load]);

  /*
   * DIE BAUTEILE BRAUCHEN IHRE EIGENEN GEGENSTÄNDE.
   *
   * `RcAreaView` will einen Bereich, `RcCalendarDetail` einen Kalender — beide
   * so, wie der Dienst sie beschreibt, nicht bloß deren Kennung. Sie werden
   * einmal geholt und geteilt: je Reiter zu laden hieße, beim Hin- und
   * Herschalten dieselbe Liste immer wieder zu holen.
   */
  const [areas, setAreas] = useState<readonly RcArea[]>([]);
  const [calendars, setCalendars] = useState<readonly RcCalendar[]>([]);
  const [roles, setRoles] = useState<readonly RcRole[]>([]);

  const inside = group !== null && rcGroupStance(group).inside;

  useEffect(() => {
    if (!inside) return;
    let alive = true;
    void (async () => {
      try {
        const [a, c, r] = await Promise.all([rcAreas(), rcCalendars(), rcRoles()]);
        if (!alive) return;
        setAreas(a.areas ?? []);
        setCalendars(c.calendars ?? []);
        setRoles(r.roles ?? []);
      } catch { /* Die Reiter sagen dann selbst, dass sie nichts haben. */ }
    })();
    return () => { alive = false; };
  }, [inside]);

  // -- Ohne Konto -------------------------------------------------------------

  if (!signedIn) {
    return (
      <section className="wg-one">
        <p className="ps-muted">
          Ta wspólnota jest widoczna po zalogowaniu. Zaloguj się albo poproś o
          link — po jego otwarciu wspólnota połączy się z Twoim kontem.
        </p>
        <p><a className="ps-more" href={at('community')}>Wszystkie wspólnoty</a></p>
      </section>
    );
  }

  if (missing) {
    return (
      <section className="wg-one">
        <h1 className="ps-title">Nie znaleziono wspólnoty</h1>
        <p className="ps-muted">
          Pod adresem <code>{groupSlug}</code> nie ma wspólnoty w tej parafii —
          albo nie jest dla Ciebie widoczna.
        </p>
        <p><a className="ps-more" href={at('community')}>Wszystkie wspólnoty</a></p>
      </section>
    );
  }

  if (error !== null) return <p className="ap-error">{error}</p>;
  if (group === null) return <p className="ps-muted">Wczytywanie…</p>;

  const stance = rcGroupStance(group);
  const area = areas.find((a) => a.areaId === group.areaId) ?? null;
  const calendar = calendars.find((c) => c.calendarId === group.calendarId) ?? null;

  return (
    <section className="wg-one">
      <header className="wg-one-head">
        <p className="wg-crumb"><a href={at('community')}>Wspólnoty</a></p>
        <h1 className="ps-title">{group.name}</h1>

        {(group.summary ?? '') !== '' && <p className="wg-summary">{group.summary}</p>}
        {(group.meets ?? '') !== '' && <p className="wg-meets">{group.meets}</p>}

        <p className="wg-meta">
          <span>{rcMemberCount(group.members)}</span>
          {stance.member && <span className="wg-mine">należysz</span>}
          {stance.admin && !stance.member && <span className="wg-admin">zarządzasz</span>}
          {!group.isPublic && <span className="wg-hidden">nie na stronie</span>}
          {group.lifecycle === 'archived' && <span className="wg-archived">archiwalna</span>}
        </p>
      </header>

      {/*
        DIE TÜR FÜR DEN, DER DRAUSSEN STEHT.

        Er sieht den Aushang — mehr gibt es nicht zu sehen, und das ist keine
        Panne. Wichtig ist, dass hier steht, WIE man hineinkommt: eine Seite,
        die nur „nie masz dostępu" sagt, ist eine Sackgasse, und der Mensch
        davor hat nichts falsch gemacht.
      */}
      {!stance.inside ? (
        <p className="wg-outside">
          Nie należysz do tej wspólnoty. Rozmowa, kalendarz i zadania są
          zapieczętowane jej kluczem — bez niego nie ma czego pokazać. Poproś
          osobę prowadzącą o link; po jego otwarciu wspólnota połączy się z
          Twoim kontem.
        </p>
      ) : (
        <>
          <nav className="wg-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`wg-tab${tab === t.id ? ' is-on' : ''}`}
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === 'info' && (
            <RcGroupInfo group={group} mayEdit={stance.admin} onSaved={() => void load()} />
          )}

          {tab === 'calendar' && (calendar === null
            ? <p className="ps-muted">Wczytywanie kalendarza…</p>
            : <RcCalendarDetail
                lang={lang}
                calendar={calendar}
                roles={roles}
                onBack={() => setTab('info')}
                onError={onError}
              />)}

          {tab === 'chat' && (area === null
            ? <p className="ps-muted">Wczytywanie rozmowy…</p>
            : <RcAreaView lang={lang} area={area} roles={roles} onError={onError} />)}

          {tab === 'tasks' && (
            <RcGroupTasks group={group} roles={roles} onError={onError} />
          )}

          {tab === 'people' && (
            <RcGroupPeople group={group} mayInvite={stance.mayInvite} />
          )}
        </>
      )}
    </section>
  );
}

/* -- O wspólnocie ---------------------------------------------------------- */

/**
 * Die beiden Auskünfte — und der Unterschied dazwischen, ausgeschrieben.
 *
 * <b>Die versiegelte Notiz lässt sich NICHT überschreiben.</b> Wer den
 * Schlüssel nicht hat, sieht ein leeres Feld — und ein leeres Feld, auf das
 * man speichern kann, ist der Weg, auf dem fremde Arbeit verschwindet: er
 * schreibt hinein, speichert, und was vorher dort stand, hat nie jemand
 * gelesen. Deshalb ist das Feld dann gesperrt und sagt, warum.
 */
function RcGroupInfo({
  group, mayEdit, onSaved
}: {
  group: RcGroupOne;
  mayEdit: boolean;
  onSaved: () => void;
}) {
  const note = rcNoteState(group);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [summary, setSummary] = useState(group.summary ?? '');
  const [meets, setMeets] = useState(group.meets ?? '');
  const [isPublic, setIsPublic] = useState(group.isPublic);
  const [noteText, setNoteText] = useState(note.kind === 'text' ? note.text : '');
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const save = async () => {
    setBusy('Zapisywanie…');
    setFailed(null);
    try {
      await rcSaveGroup(group.groupId, {
        name,
        summary,
        meets,
        isPublic,

        /*
         * EINE VERSIEGELTE NOTIZ WIRD NICHT MITGESCHICKT.
         *
         * Sonst ginge sie beim ersten Speichern verloren: das Feld war leer,
         * weil sie nicht aufging — nicht, weil sie leer ist.
         */
        ...(note.kind === 'sealed'
          ? {}
          : noteText.trim() === ''
            ? { clearNote: true }
            : { note: noteText })
      });
      setEditing(false);
      onSaved();
    } catch {
      setFailed('Nie udało się zapisać.');
    } finally {
      setBusy(null);
    }
  };

  if (!editing) {
    return (
      <div className="wg-info">
        <article className="wg-panel">
          <h2>W gablocie</h2>
          <p className="wg-hint wg-hint-open">
            Widoczne dla każdego, także bez konta.
          </p>

          <dl className="wg-dl">
            <dt>Opis</dt>
            <dd>{(group.summary ?? '') === '' ? <em className="ps-muted">—</em> : group.summary}</dd>
            <dt>Spotkania</dt>
            <dd>{(group.meets ?? '') === '' ? <em className="ps-muted">—</em> : group.meets}</dd>
            <dt>Na stronie parafii</dt>
            <dd>{group.isPublic ? 'tak' : 'nie'}</dd>
          </dl>
        </article>

        <article className="wg-panel wg-panel-sealed">
          <h2>Notatka wewnętrzna</h2>
          <p className="wg-hint wg-hint-sealed">
            Zapieczętowana kluczem tej wspólnoty — nie widzi jej kancelaria ani
            nikt spoza wspólnoty.
          </p>

          {note.kind === 'none' && <p className="ps-muted">Nic tu nie zapisano.</p>}
          {note.kind === 'text' && <p className="wg-note">{note.text}</p>}

          {/*
            NIE „PUSTE" — „NIE OTWORZYSZ".

            To rozróżnienie jest cała różnica: puste pole zaprasza do pisania,
            a tu stoi cudzy tekst, którego nie widzisz.
          */}
          {note.kind === 'sealed' && (
            <p className="wg-sealed">
              Coś tu jest, ale nie masz do tego klucza (<code>{note.reason}</code>).
              Zapisanie nadpisałoby tekst, którego nikt tu nie przeczytał —
              dlatego pole jest zablokowane.
            </p>
          )}
        </article>

        {mayEdit && (
          <button type="button" className="rc-btn" onClick={() => setEditing(true)}>
            Zmień
          </button>
        )}
      </div>
    );
  }

  return (
    <form className="wg-new" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <h2>Zmiana danych wspólnoty</h2>

      <label className="wg-field">
        <span>Nazwa</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      {/*
        ADRES SIĘ NIE ZMIENIA — i lepiej to powiedzieć, niż pokazać zablokowane
        pole, przy którym nikt nie wie, czy to usterka.
      */}
      <p className="wg-hint">
        Adres <code>{group.slug}</code> zostaje: wisi w odnośnikach, które ktoś
        już przepisał.
      </p>

      <label className="wg-field wg-wide">
        <span>Opis</span>
        <textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
        <em className="wg-hint wg-hint-open">W gablocie — widzi każdy.</em>
      </label>

      <label className="wg-field">
        <span>Kiedy się spotykacie</span>
        <input value={meets} onChange={(e) => setMeets(e.target.value)} />
        <em className="wg-hint wg-hint-open">Też w gablocie.</em>
      </label>

      <label className="wg-check">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        <span>Pokaż na stronie parafii</span>
      </label>

      <label className="wg-field wg-wide">
        <span>Notatka wewnętrzna</span>
        <textarea
          rows={3}
          value={note.kind === 'sealed' ? '' : noteText}
          disabled={note.kind === 'sealed'}
          onChange={(e) => setNoteText(e.target.value)}
        />
        <em className={`wg-hint ${note.kind === 'sealed' ? 'wg-hint-blocked' : 'wg-hint-sealed'}`}>
          {note.kind === 'sealed'
            ? 'Zablokowane: jest tu tekst, którego nie otwierasz. Zapisanie skasowałoby go bez śladu.'
            : 'Zapieczętowana kluczem tej wspólnoty.'}
        </em>
      </label>

      {failed !== null && <p className="ap-error">{failed}</p>}

      <div className="wg-actions">
        <button type="submit" className="rc-btn" disabled={busy !== null}>
          {busy ?? 'Zapisz'}
        </button>
        <button type="button" className="rc-btn rc-btn-quiet" onClick={() => setEditing(false)}>
          Anuluj
        </button>
      </div>
    </form>
  );
}

/* -- Zadania --------------------------------------------------------------- */

/**
 * Aufgaben der Gruppe — und woraus sie entstanden sind.
 *
 * <b>Eine Aufgabe ist hier kein eigenes Ding.</b> Sie ist ein Kalendereintrag
 * mit `itemType = 'task'`. Das ist keine Sparsamkeit: eine Aufgabe HAT einen
 * Termin, einen Zuständigen und einen Titel, und nur so steht sie auch im
 * Terminplan neben Messe und Beichte. Eine eigene Tabelle wäre dieselbe Sache
 * zweimal — mit zwei Listen, die auseinanderlaufen.
 *
 * <b>Das Thema daneben ist der eigentliche Zusatz.</b> „Kto wyprasuje alby?"
 * steht im Gespräch, und darunter vierzig weitere Sätze. Wird daraus eine
 * Aufgabe, ist sie ohne diesen Verweis drei Wörter ohne Zusammenhang.
 */
function RcGroupTasks({
  group, roles, onError
}: {
  group: RcGroupOne;
  roles: readonly RcRole[];
  onError: (message: string) => void;
}) {
  const [items, setItems] = useState<readonly RcOccurrence[] | null>(null);
  const [topics, setTopics] = useState<readonly RcTopic[]>([]);
  const [adding, setAdding] = useState(false);

  /*
   * Ein weites Fenster, aber ein endliches: eine Aufgabe von vorgestern ist
   * noch offen, eine für nächsten Sommer steht schon fest. „Alles" ist bei
   * wiederkehrenden Einträgen keine Frage, die sich beantworten lässt.
   */
  const window = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - 90);

    const to = new Date(from);
    to.setDate(to.getDate() + 455);

    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const load = useCallback(async () => {
    try {
      const [found, threads] = await Promise.all([
        rcOccurrences(group.calendarId, window.from, window.to),
        rcTopics(group.areaId)
      ]);
      setItems((found.occurrences ?? []).filter((o) => o.itemType === 'task'));
      setTopics(threads.topics ?? []);
    } catch (e) {
      onError(e instanceof RcRequestError ? 'Nie udało się wczytać zadań.' : 'Nie udało się wczytać zadań.');
      setItems([]);
    }
  }, [group.calendarId, group.areaId, window, onError]);

  useEffect(() => { void load(); }, [load]);

  const titleOf = (topicId: string): string =>
    topics.find((t) => t.topicId === topicId)?.title ?? 'rozmowa';

  const open = (items ?? []).filter((t) => t.taskState !== 'done' && t.taskState !== 'cancelled');
  const done = (items ?? []).filter((t) => t.taskState === 'done');

  return (
    <div className="wg-tasks">
      <header className="wg-head">
        <h2>Zadania</h2>
        {!adding && (
          <button type="button" className="rc-btn" onClick={() => setAdding(true)}>
            Nowe zadanie
          </button>
        )}
      </header>

      {adding && (
        <RcNewTask
          group={group}
          roles={roles}
          topics={topics}
          onCancel={() => setAdding(false)}
          onDone={() => { setAdding(false); void load(); }}
        />
      )}

      {items === null && <p className="ps-muted">Wczytywanie…</p>}

      {items !== null && items.length === 0 && !adding && (
        <p className="ps-muted">
          Nic nie czeka. Zadanie można też zrobić z rozmowy — najpierw zbierz
          wiadomości w temat, potem wskaż go tutaj.
        </p>
      )}

      <TaskList title="Do zrobienia" tasks={open} titleOf={titleOf} />
      <TaskList title="Zrobione" tasks={done} titleOf={titleOf} />
    </div>
  );
}

function TaskList({
  title, tasks, titleOf
}: {
  title: string;
  tasks: readonly RcOccurrence[];
  titleOf: (topicId: string) => string;
}) {
  if (tasks.length === 0) return null;

  return (
    <>
      <h3 className="wg-block">{title}</h3>
      <ul className="wg-task-list">
        {tasks.map((task) => {
          /*
           * Pole `unreadable` bywa NIEOBECNE, nie `null` — usługa nie wypisuje
           * pustych pól. Porównanie `!== null` uznałoby każde zadanie za
           * zapieczętowane.
           */
          const sealed = (task.unreadable ?? null) !== null;
          const topicId = task.topicId ?? null;

          return (
            <li key={`${task.itemId}-${task.startsUtc}`} className="wg-task">
              <span className={`wg-task-state is-${task.taskState ?? 'todo'}`} aria-hidden="true" />

              <span className="wg-task-body">
                <strong>
                  {sealed
                    ? <em className="wg-sealed-inline">zapieczętowane</em>
                    : (task.title ?? task.titlePublic ?? 'bez nazwy')}
                </strong>

                <span className="wg-task-meta">
                  <time dateTime={task.startsUtc}>
                    {new Date(task.startsUtc).toLocaleDateString('pl-PL',
                      { day: 'numeric', month: 'long' })}
                  </time>

                  {/*
                    SKĄD SIĘ TO WZIĘŁO.

                    Bez tego zadanie to trzy słowa bez kontekstu, który je
                    tłumaczy — a kontekst leży dwa kliknięcia dalej, w rozmowie.
                  */}
                  {topicId !== null && (
                    <span className="wg-task-topic">z rozmowy: {titleOf(topicId)}</span>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function RcNewTask({
  group, roles, topics, onCancel, onDone
}: {
  group: RcGroupOne;
  roles: readonly RcRole[];
  topics: readonly RcTopic[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [topicId, setTopicId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /* Geschrieben wird im Namen einer Rolle, die einen Schlüssel HAT. */
  const owner = useMemo(() => roles.find((r) => r.hasKey) ?? roles[0], [roles]);

  const add = async () => {
    if (owner === undefined) return;
    setBusy('Dodawanie…');
    setFailed(null);
    try {
      const starts = new Date(`${day}T09:00:00`);
      await rcAddItem(
        group.calendarId, owner.roleId,
        starts.toISOString(), starts.toISOString(),
        {
          itemType: 'task',
          taskState: 'todo',
          title,

          /*
           * `area` und nicht `private`: eine Aufgabe der Gruppe geht die
           * Gruppe an. `private` hieße, dass sie für alle anderen ganz aus
           * der Liste fällt — auch für den, der sie erledigen soll.
           */
          visibility: 'area',
          topicId: topicId === '' ? undefined : topicId
        }
      );
      onDone();
    } catch {
      setFailed('Nie udało się dodać zadania.');
      setBusy(null);
    }
  };

  return (
    <form className="wg-new" onSubmit={(e) => { e.preventDefault(); void add(); }}>
      <label className="wg-field wg-wide">
        <span>Co trzeba zrobić</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wyprasować alby" />
        <em className="wg-hint wg-hint-sealed">Zapieczętowane kluczem wspólnoty.</em>
      </label>

      <label className="wg-field">
        <span>Na kiedy</span>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      </label>

      {/*
        Z KTÓREJ ROZMOWY.

        Lista tematów, a nie pojedynczych wiadomości: wiadomość można ukryć albo
        zmienić, temat zostaje. I temat powstaje dokładnie tak, jak trzeba —
        zaznacza się w rozmowie, co do siebie należy, i nadaje temu nazwę.
      */}
      {topics.length > 0 && (
        <label className="wg-field">
          <span>Z rozmowy (nieobowiązkowe)</span>
          <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">—</option>
            {topics.map((t) => (
              <option key={t.topicId} value={t.topicId}>{t.title ?? 'temat'}</option>
            ))}
          </select>
          <em className="wg-hint">
            Zadanie zachowa odnośnik do rozmowy, z której wyszło.
          </em>
        </label>
      )}

      {failed !== null && <p className="ap-error">{failed}</p>}

      <div className="wg-actions">
        <button type="submit" className="rc-btn" disabled={title.trim() === '' || busy !== null}>
          {busy ?? 'Dodaj'}
        </button>
        <button type="button" className="rc-btn rc-btn-quiet" onClick={onCancel}>Anuluj</button>
        {title.trim() === '' && busy === null && (
          <span className="wg-blocker">Wpisz, co trzeba zrobić.</span>
        )}
      </div>
    </form>
  );
}

/* -- Osoby ----------------------------------------------------------------- */

/**
 * Der Beitrittslink.
 *
 * <b>Er wird EINMAL gezeigt und ist danach weg.</b> Das Geheimnis steht
 * nirgends gespeichert — nur sein SHA-256 —, und das ist der Sinn: wer die
 * Tabelle vollständig besitzt, kann die Einladung nicht einlösen. Der Preis
 * steht hier, wo jemand ihn liest, und nicht in einer Dokumentation: geht der
 * Link verloren, stellt man einen neuen aus.
 *
 * <b>Was der Link bewirkt, steht auch dabei.</b> „Zaproś" klingt harmlos; in
 * Wahrheit reist ein Schlüssel mit, und wer ihn einlöst, liest alles, was die
 * Gruppe seit ihrer Epoche geschrieben hat. Das gehört auf denselben
 * Bildschirm wie der Knopf.
 */
function RcGroupPeople({ group, mayInvite }: { group: RcGroupOne; mayInvite: boolean }) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const make = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const made = await rcCreateInvitation(group.memberRoleId, {
        label: group.name,
        daysValid: 30,

        /*
         * Ein Link für EINE Person. Ein Sammellink, der einmal in einer
         * Gruppe landet, wird weitergeleitet — und dann sitzt jemand drin,
         * den niemand aufgenommen hat, und keiner weiß, wer ihn geschickt hat.
         */
        maxUses: 1
      });
      setLink(rcInviteLink(made.secret));
    } catch {
      setFailed('Nie udało się utworzyć linku.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wg-people">
      <p className="wg-count">{rcMemberCount(group.members)} we wspólnocie.</p>

      {!mayInvite && (
        <p className="ps-muted">
          Zapraszać może osoba, która zarządza wspólnotą — link niesie klucz,
          więc nie jest to drobiazg.
        </p>
      )}

      {mayInvite && (
        <>
          <p className="wg-warn">
            Link niesie klucz tej wspólnoty. Kto go otworzy, przeczyta wszystko,
            co napisano tu od jego epoki — i wspólnota dopisze się do jego konta.
            Wyślij go tej jednej osobie, dla której jest.
          </p>

          <button type="button" className="rc-btn" disabled={busy} onClick={() => void make()}>
            {busy ? 'Tworzenie…' : 'Utwórz link zapraszający'}
          </button>

          {failed !== null && <p className="ap-error">{failed}</p>}

          {link !== null && (
            <div className="wg-link">
              <p className="wg-warn">
                Zapisz go teraz — ten link pokazujemy RAZ. Sekret nie jest nigdzie
                przechowywany; gdy przepadnie, tworzy się nowy.
              </p>
              <code className="wg-link-text">{link}</code>
              <button
                type="button"
                className="rc-btn rc-btn-quiet"
                onClick={() => {
                  void navigator.clipboard?.writeText(link);
                  setCopied(true);
                }}
              >
                {copied ? 'Skopiowano' : 'Kopiuj'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default RcGroupPage;
