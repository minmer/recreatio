/**
 * Der Arbeitsplatz — Kacheln, und eine davon ganz.
 *
 * <b>Zwei Spalten, auf schmalem Gerät eine.</b> Die Kacheln sind kein
 * Schmuck: sie sind die vier Dinge, die ein Mensch hier hat, nebeneinander
 * statt untereinander — man sieht mit einem Blick, wo etwas liegt.
 *
 * <b>Eine offene Kachel ist eine ADRESSE</b> (`#/workspace/pages`), kein
 * Zustand im Speicher. Deshalb lässt sie sich verschicken und neu laden, und
 * der Zurück-Pfeil des Browsers verlässt die Kachel statt den Arbeitsplatz.
 *
 * <b>Was leer ist, sagt warum.</b> Kalender und Rozmowy hängen an Bereichen,
 * und Bereiche entstehen mit dem ersten Körper. Eine Kachel, die „0" zeigt,
 * behauptet, gerechnet zu haben.
 */

import { useCallback, useEffect, useState } from 'react';

import { pageSteps, PATH_SHAPE, ROOT_STEP, viewPath, VIEWS, type Spot, type View } from './routes';
import { useCrumbs } from './crumbTrail';
import { FormOffice } from './FormOffice';
import { loadModules, readConfig, type ModuleRow } from './module';
import { partLabel } from './parts/registry';
import { Account } from './Account';
import { Addresses } from './Addresses';
import { Areas } from './Areas';
import { Modules } from './Modules';
import { Reservations } from './Reservations';
import { CalendarApp } from './CalendarApp';
import { ChatView } from './ChatPage';
import { MassOffice } from './MassOffice';
import { PageEditor } from './PageEditor';
import { RoleGraph } from './RoleGraph';
import { WorkspaceError, type Who } from './session';
import { RecentRow, useTouched } from './Recent';
import { SlugTree } from './SlugTree';
import { TasksView } from './TasksView';
import { LibraryView } from './LibraryView';
import { Kartoteka } from './Kartoteka';
import { claimSlug, loadDesk, takers, type Desk } from './desk';
import { roleLabel, useRoleNames } from './roleNames';
import { treeOf } from './tree';
import { WorkspaceHome } from './WorkspaceHome';
import { DisplaySwitch } from './DisplaySwitch';
import { useDisplay, type Tool } from './display';
import { ShareButton } from './Share';
import { MINE } from './workspaceViews';
import { DESK_EVENT } from './viewData';

export function Workspace({ spot, who }: { spot: Spot; who: Who }) {
  /** `undefined` = noch nicht nachgesehen, `null` = ging nicht. */
  const [desk, setDesk] = useState<Desk | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);

  const look = useCallback(async () => {
    try {
      setDesk(await loadDesk());
      setFailed(null);
    } catch (e) {
      setDesk(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać warsztatu.');
    }
  }, []);

  useEffect(() => { void look(); }, [look]);

  /* 0094 — ein Anfang (`Starters`) hat eine Seite angelegt: die Liste der Strony neu. */
  useEffect(() => {
    const again = () => void look();
    window.addEventListener(DESK_EVENT, again);
    return () => window.removeEventListener(DESK_EVENT, again);
  }, [look]);

  /*
   * Eine Ansicht, die es nicht gibt (`#/workspace/kalender`). Sie wird NICHT
   * stillschweigend zu den Kacheln — wer so einen Link bekommen hat, soll
   * erfahren, dass das Wort keine Ansicht ist.
   */
  if (spot.kind === 'stray') {
    return (
      <>
        <h1 className="wk-h1">Nie ma tu takiego widoku</h1>
        <p className="wk-lede">
          Warsztat nie zna części <code>{spot.word}</code>.
        </p>

        {/* Der Weg hinaus steht oben, wie überall. Zwei Ausgänge sind keiner mehr. */}
      </>
    );
  }

  if (desk === undefined) return <p className="wk-lede">Wczytywanie…</p>;

  if (desk === null) {
    return (
      <>
        <h1 className="wk-h1">Warsztat</h1>
        <p className="wk-error">{failed}</p>
        <p>
          <button type="button" className="wk-btn" onClick={() => void look()}>Spróbuj ponownie</button>
        </p>
      </>
    );
  }

  if (spot.kind === 'view') {
    return (
      <>
        {/*
          NUR, WENN NICHTS DARIN OFFEN IST.

          Der Weg oben nennt die Ansicht ohnehin. Stand die Überschrift
          zusätzlich da, las man „Obszary" zweimal — und sobald ein Bereich
          offen war, sogar falsch: oben stand „… › Schola", darunter gross
           „Obszary", und die Seite zeigte Schola. Was offen ist, trägt seinen
          eigenen Namen (`AreaPage`), und der ist der richtige.
        */}
        {/* Rozmowy (0062) tragen ihren Namen selbst — oben in der Liste, wie in einer Chat-App. */}
        {spot.trail.length === 0 && spot.view !== 'chat' && spot.view !== 'widok' && (
          <div className="wk-view-title">
            <h1 className="wk-h1">{VIEWS[spot.view]}</h1>
            {/* 0094 — einfach oder erweitert, für diesen Teil (gemerkt mit „Zapisz"). */}
            {TOOL_OF[spot.view] !== undefined && <DisplaySwitch tool={TOOL_OF[spot.view]!} />}
          </div>
        )}

        <Inside
          view={spot.view}
          trail={spot.trail}
          desk={desk}
          who={who}
          onChanged={() => void look()}
        />
      </>
    );
  }

  /* 0094 — die Seite des Warsztat ist ein Widok (`WorkspaceHome`): was neu ist, Termine, Teile auf Wunsch. */
  return <WorkspaceHome who={who} desk={desk} />;
}

/** Welche Ansicht welchen Teil mit eigenem Weg hat (`display.ts`). */
const TOOL_OF: Partial<Record<View, Tool>> = {
  areas: 'areas', modules: 'modules', pages: 'pages', roles: 'roles', addresses: 'addresses'
};

/**
 * 0094 — EIN TEIL NUR IM ERWEITERTEN WEG (Role, Adresy i domeny): im einfachen
 * steht, wo man dasselbe findet, und wie man ihn trotzdem öffnet.
 */
function OnlyExtended({ tool, children, where }: { tool: Tool; children: React.ReactNode; where: React.ReactNode }) {
  const display = useDisplay(tool);
  if (display.extended) return <>{children}</>;
  return (
    <div className="wk-only-extended">
      <p className="wk-lede">{where}</p>
      <button type="button" className="wk-btn wk-btn-quiet" data-show-extended={tool}
        onClick={() => display.pick(display.def.modes.find((one) => one.extended)!.id)}>Pokaż mimo to</button>
    </div>
  );
}

/* -- Eine Kachel ganz ------------------------------------------------------ */

function Inside({ view, trail, desk, who, onChanged }: {
  view: View;

  /**
   * Was INNERHALB der Ansicht offen ist — aus der Adresse.
   *
   * <b>Gedeutet wird er hier nicht.</b> Für „Obszary" ist das eine Kennung,
   * für „Strony" ein Pfad im Register; wer das hier entschiede, müsste jede
   * Ansicht kennen, die es je geben wird.
   */
  trail: readonly string[];
  desk: Desk;
  who: Who;
  onChanged: () => void;
}) {
  if (view === 'modules') return <Modules who={who} trail={trail} />;
  if (view === 'pages') {
    return <Pages desk={desk} who={who} trail={trail} onClaimed={onChanged} />;
  }
  if (view === 'addresses') {
    return (
      <OnlyExtended tool="addresses" where={<>Alias albo własną domenę ustawia się rzadko — dlatego ta część jest w widoku rozszerzonym. Twoje strony są w <a href={viewPath('pages')}>Stronach</a>.</>}>
        <Addresses desk={desk} who={who} onChanged={onChanged} />
      </OnlyExtended>
    );
  }
  if (view === 'roles') {
    return (
      <OnlyExtended tool="roles" where={<>Kto ma dostęp, widać w każdym <a href={viewPath('areas')}>obszarze</a> (część „Osoby" i „Dostęp") i przy linkach. Graf wszystkich ról jest w widoku rozszerzonym.</>}>
        <RoleGraph who={who} />
      </OnlyExtended>
    );
  }
  if (view === 'areas') return <Areas who={who} trail={trail} desk={desk} />;
  /* 0094 — ein Widok aus der Adresse (`#/workspace/widok/<kennung>`). */
  if (view === 'widok') return <WorkspaceHome who={who} desk={desk} viewId={trail[0] ?? MINE} />;
  if (view === 'calendar') return <CalendarApp who={who} trail={trail} />;
  if (view === 'tasks') return <TasksView who={who} />;
  if (view === 'masses') return <MassOffice who={who} trail={trail} />;
  if (view === 'bookings') return <Reservations trail={trail} />;
  if (view === 'account') return <Account who={who} trail={trail} />;
  if (view === 'chat') return <ChatView who={who} trail={trail} />;
  if (view === 'library') return <LibraryView who={who} trail={trail} />;
  if (view === 'registry') return <Kartoteka who={who} trail={trail} />;

  /* Jede Ansicht steht oben; was hier ankommt, gibt es (noch) nicht. */
  return <p className="wk-note">Tej części warsztatu jeszcze nie ma.</p>;
}

/* -- Strony: übernehmen, nicht anlegen ------------------------------------- */

/**
 * EIN BAUSTEIN ALS UNTERSEITE SEINER SEITE.
 *
 * `#/workspace/pages/parish/zapisy/<kennung>` schlägt den Baustein auf, der
 * auf `parish/zapisy` steht. Das ist die Ordnung, in der man ihn sucht — man
 * kommt von der Seite, auf der er liegt, und der Weg oben sagt es auch so.
 *
 * <b>Woran man ihn erkennt.</b> Eine Kennung ist eine UUID; ein Schritt im
 * Register ist ein Wort. Die Form allein genügte aber nicht als Beweis —
 * `ck_slug_path` liesse eine Unterseite zu, die genau so aussieht. Deshalb
 * wird ZUSÄTZLICH gefragt, ob der ganze Pfad eine Seite ist, die ich führe:
 * ist er es, ist es eine Seite, und die Form zählt nicht.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function splitTrail(trail: readonly string[], known: ReadonlySet<string>): {
  readonly path: string | null;
  readonly moduleId: string | null;
} {
  /* Die Wurzel (`~`, `pageSteps`): recreatio.pl selbst — und ein Baustein darauf. */
  if (trail[0] === ROOT_STEP) {
    const under = trail[1];
    return { path: '', moduleId: under !== undefined && UUID.test(under) ? under : null };
  }

  const whole = trail.join('/');
  if (trail.length === 0) return { path: null, moduleId: null };

  /* Eine Seite, die es gibt, bleibt eine Seite. */
  if (known.has(whole)) return { path: whole, moduleId: null };

  const last = trail[trail.length - 1];
  const above = trail.slice(0, -1).join('/');

  if (trail.length > 1 && UUID.test(last) && known.has(above)) {
    return { path: above, moduleId: last };
  }

  /* Weder noch: behandelt wie eine Seite, und die sagt dann selbst, dass sie
     nicht da ist. Zu raten wäre schlimmer. */
  return { path: whole, moduleId: null };
}

function Pages({ desk, who, trail, onClaimed }: {
  desk: Desk;
  who: Who;
  trail: readonly string[];
  onClaimed: () => void;
}) {
  /*
   * DIE OFFENE SEITE STEHT IN DER ADRESSE.
   *
   * Ein Pfad im Register hat Teile — `parish/grzegorzki` —, und die sind
   * schon Segmente. Sie werden hier nicht zusammengeklebt und wieder
   * auseinandergenommen, sondern sind, was sie sind: der Weg dorthin.
   */
  const known = new Set(desk.pages.map((one) => one.path));
  const { path: editing, moduleId } = splitTrail(trail, known);
  const names = useRoleNames(who);

  /* 0054 — die zuletzt bearbeiteten Seiten stehen über dem Baum (gemerkt versiegelt). */
  useTouched('pages', editing);

  /*
   * Der aufgeschlagene Baustein. Geholt wird er nur, wenn einer
   * aufgeschlagen ist — auf der Seitenliste wäre es ein Aufruf für nichts.
   */
  const [module, setModule] = useState<ModuleRow | null>(null);

  /* Nach einer Änderung am Baustein neu holen — sein Bereich, seine Klausel. */
  const [moduleTick, setModuleTick] = useState(0);

  useEffect(() => {
    if (moduleId === null) { setModule(null); return; }

    let dropped = false;

    void loadModules()
      .then(({ modules }) => {
        if (dropped) return;
        setModule(modules.find((one) => one.moduleId === moduleId) ?? null);
      })
      .catch(() => { if (!dropped) setModule(null); });

    return () => { dropped = true; };
  }, [moduleId, moduleTick]);

  /*
   * Und derselbe Weg steht oben im Kopf — Stufe für Stufe. Der Baustein
   * hängt als letzte Stufe darunter und trägt seinen Namen, nicht seine
   * Kennung: in der Adresse steht eine UUID, und darin liest ein Mensch
   * nichts.
   */
  const steps = moduleId === null ? trail : trail.slice(0, -1);

  useCrumbs([
    ...steps.map((one, at) => ({
      label: one === ROOT_STEP ? 'recreatio.pl' : one,
      href: viewPath('pages', ...steps.slice(0, at + 1))
    })),
    ...(moduleId === null
      ? []
      : [{ label: module?.name ?? partLabel('form'), href: null }])
  ]);

  const [wanted, setWanted] = useState('');
  const [code, setCode] = useState('');
  const [roleId, setRoleId] = useState(takers(desk.roles)[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const typed = wanted.trim();
  const path = typed.toLowerCase().replace(/^\/+|\/+$/g, '');

  /*
   * Die Wurzel heisst im Register nichts — und ein unberührtes Feld heisst
   * auch nichts. Unterschieden werden die beiden am GETIPPTEN und nicht am
   * Ergebnis: wer „/” schreibt, nennt recreatio.pl selbst; wer gar nichts
   * schreibt, hat das Feld noch nicht angefasst.
   *
   * Prüfte man nur `path`, gäbe es genau eine Adresse, die hier niemals zu
   * übernehmen wäre — und der Dienst nähme sie anstandslos.
   */
  const isRoot = typed !== '' && path === '';

  /* Ein grauer Knopf muss sagen, warum — sonst sieht es aus, als sei der
     Adress-Code schon abgelehnt worden. */
  const blocker =
    busy ? null
    : desk.roles.length === 0 ? 'Nie masz roli, która mogłaby przejąć adres.'
    : typed === '' ? 'Wpisz adres.'
    : !isRoot && !PATH_SHAPE.test(path) ? 'Adres: małe litery, cyfry i myślniki; części oddziel ukośnikiem.'
    : path === 'workspace' || path.startsWith('workspace/') ? 'Adres „workspace” należy do samego warsztatu.'
    : code.trim() === '' ? 'Wpisz kod adresu.'
    : roleId === '' ? 'Wybierz rolę.'
    : null;

  const go = async () => {
    setBusy(true);
    setFailed(null);
    setDone(null);

    try {
      const page = await claimSlug(path, code.trim(), roleId);
      setDone(page.path);
      setWanted('');
      setCode('');
      onClaimed();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się przejąć adresu.');
    } finally {
      setBusy(false);
    }
  };

  const pagesDisplay = useDisplay('pages');

  return (
    <>
      {desk.pages.length === 0 ? (
        <p className="wk-lede">
          Nie prowadzisz jeszcze żadnego adresu. Adres się przejmuje: musi być
          na liście i trzeba mieć do niego kod.
        </p>
      ) : !pagesDisplay.extended ? (
        /* 0094 — EINFACH: die Seiten untereinander; offen ist eine, dann nur der Weg zurück. */
        editing === null && moduleId === null ? (
          <PageList desk={desk} who={who} />
        ) : (
          <p><a className="wk-link-btn" href={viewPath('pages')}>‹ Wszystkie strony</a></p>
        )
      ) : (
        <>
        <RecentRow scope="pages" items={desk.pages.map((one) => ({
          id: one.path, label: one.path === '' ? 'recreatio.pl' : one.path, href: viewPath('pages', ...pageSteps(one.path))
        }))} />
        <SlugTree
          nodes={treeOf(desk.pages)}
          desk={desk}
          who={who}
          editing={editing}
          onEdit={(path) => {
            /* Noch einmal auf dieselbe: zumachen. Wie vorher, nur jetzt als Adresse. */
            window.location.hash = editing === path
              ? viewPath('pages')
              : viewPath('pages', ...pageSteps(path));
          }}
          onChanged={onClaimed}
        />
        </>
      )}

      {/*
        EIN BAUSTEIN, AUFGESCHLAGEN — als Unterseite der Seite, auf der er
        steht. Die Seitenliste bleibt dabei stehen: man kommt von ihr, und
        man geht zu ihr zurück.
      */}
      {moduleId !== null && (
        module === null ? (
          <p className="wk-empty">Tego modułu nie ma — albo nie jest Twój.</p>
        ) : (
          <>
            <h2 className="wk-h2">{module.name}</h2>
            <FormOffice
              partId={module.moduleId}
              config={readConfig(module.config)}
              who={who}
              standsOn={module.pages}
              module={module}
              onModuleChanged={() => setModuleTick((n) => n + 1)}
            />
          </>
        )
      )}

      {moduleId === null && editing !== null && (
        <PageEditor
          path={editing}
          who={who}
          accessAreaIds={desk.pages.find((one) => one.path === editing)?.accessAreaIds ?? []}
          onOpenModule={(id) => { window.location.hash = viewPath('pages', ...pageSteps(editing), id); }}
        />
      )}

      {/*
        EINE ADRESSE ÜBERNIMMT MAN EINMAL.

        Das Formular stand offen unter jeder Seitenliste — vier Felder und
        drei Absätze für einen Handgriff, den man im Jahr vielleicht zweimal
        tut. Zugeklappt steht dort eine Zeile; wer sie braucht, klappt sie auf.
      */}
      <details className="wk-fold">
        <summary>Przejmij adres</summary>


        <form
          className="wk-form"
          onSubmit={(e) => { e.preventDefault(); if (blocker === null) void go(); }}
        >
          <label className="wk-field">
            <span>Adres</span>
            <input value={wanted} onChange={(e) => setWanted(e.target.value)} placeholder="schola" />
          </label>

          {/* Sonst wäre die Wurzel die einzige Adresse, die man nicht tippen kann. */}
          <p className="wk-hint">
            Sam <code>/</code> to <code>recreatio.pl</code>.
          </p>

          <label className="wk-field">
            <span>Kod adresu</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
          </label>

          {/*
            NICHT „ja" przejmuję adres, tylko rola. To jedyne pole, które łatwo
            przeoczyć, a decyduje o tym, co się stanie, gdy ktoś odejdzie.
          */}
          <label className="wk-field">
            <span>Kto będzie odpowiadał</span>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {takers(desk.roles).map((role) => (
                <option key={role.id} value={role.id}>{roleLabel(role, names)}</option>
              ))}
            </select>
          </label>

          <p className="wk-hint">
            {isRoot ? (
              <>Wybrana rola odpowiada za sam adres <code>recreatio.pl</code>.</>
            ) : (
              <>
                Wybrana rola odpowiada za ten adres i za wszystko pod nim —
                <code>{path === '' ? 'schola' : path}/…</code> idzie razem z nim.
              </>
            )}
          </p>

          {failed !== null && <p className="wk-error">{failed}</p>}
          {done !== null && <p className="wk-done">Adres <code>recreatio.pl/{done}</code> jest Twój.</p>}

          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={blocker !== null || busy}>
              {busy ? 'Sprawdzanie…' : 'Przejmij'}
            </button>

            {blocker !== null && !busy && <span className="wk-blocker">{blocker}</span>}
          </div>
        </form>
      </details>
    </>
  );
}

/**
 * 0094 — DIE STRONY, EINFACH: jede Seite eine Zeile — öffnen, bearbeiten,
 * teilen. Der Baum (Unterseiten, Übernehmen) ist der erweiterte Weg.
 */
function PageList({ desk, who }: { desk: Desk; who: Who }) {
  const pages = desk.pages.filter((one) => one.aliasOf === null).sort((a, b) => a.path.localeCompare(b.path));
  return (
    <>
      <RecentRow scope="pages" items={pages.map((one) => ({
        id: one.path, label: one.path === '' ? 'recreatio.pl' : one.path, href: viewPath('pages', ...pageSteps(one.path))
      }))} />
      <ul className="wk-page-list">
        {pages.map((one) => {
          const areas = one.accessAreaIds ?? [];
          return (
            <li key={one.path} data-page={one.path}>
              <a className="wk-page-path" href={viewPath('pages', ...pageSteps(one.path))}>{one.path === '' ? 'recreatio.pl' : one.path}</a>
              {areas.length > 0 && <span className="wk-tag">z dostępem</span>}
              <span className="wk-part-acts">
                <a className="wk-link-btn" href={`#/${one.path}`}>Otwórz</a>
                <a className="wk-link-btn" href={viewPath('pages', ...pageSteps(one.path))}>Edytuj</a>
                <ShareButton who={who} label="Udostępnij" className="wk-link-btn"
                  target={{ title: one.path === '' ? 'recreatio.pl' : one.path, aim: one.path === '' ? null : one.path, areaIds: areas, open: areas.length === 0 }} />
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default Workspace;
