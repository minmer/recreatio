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

import { LangScope, rich, useT, type Section } from '../core/i18n';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import { formsPath, pageSteps, PATH_SHAPE, ROOT_STEP, tilesPath, viewPath, VIEWS, type Spot, type View } from '../routes';
import { useCrumbs } from '../shell/crumbTrail';
import { useOnline } from '../chat/chatFeatures';
import { FormOffice } from '../forms/FormOffice';
import { loadModules, readConfig, type ModuleRow } from '../modules/module';
import { partLabel } from '../pages/parts/registry';
import { Account } from '../account/Account';
import { Addresses } from '../pages/Addresses';
import { Areas } from '../areas/Areas';
import { Modules } from '../modules/Modules';
import { Reservations } from '../bookings/Reservations';
import { CalendarApp } from '../calendar/CalendarApp';
import { ChatView } from '../chat/ChatPage';
import { MassOffice } from '../masses/MassOffice';
import { PageEditor } from '../pages/PageEditor';
import { RoleGraph } from '../roles/RoleGraph';
import { WorkspaceError, type Who } from '../core/session';
import { useTouched } from './Recent';
import { SlugTree } from '../pages/SlugTree';
import { TasksView } from '../calendar/TasksView';
import { LibraryView } from '../library/LibraryView';
import { Kartoteka } from '../registry/Kartoteka';
import { claimSlug, loadDesk, takers, type Desk } from './desk';
import { roleLabel, useRoleNames } from '../roles/roleNames';
import { treeOf } from '../core/tree';
import { WorkspaceHome } from './WorkspaceHome';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { useRemembered } from '../core/prefs';
import { ShareButton } from '../links/Share';
import { DESK_EVENT } from './viewData';

/* 0109 — die Nauka als eigenes Bündel (Karten, Läufe, Sitzungen): erst, wenn man sie öffnet. */
const LearnView = lazy(() => import('../cogita/LearnView').then((m) => ({ default: m.LearnView })));
/* 2026-10-23 — das Skryptorium erst, wenn es geöffnet wird. */
const ScriptoriumView = lazy(() => import('../scriptorium/ScriptoriumView').then((m) => ({ default: m.ScriptoriumView })));

/* 2026-10-17 — SMS und Kontakte (Ausgabe „sms") als eigenes Bündel: wer kein Telefon damit hat, lädt es nie. */
const SmsApp = lazy(() => import('../phone/SmsApp'));
const ContactsApp = lazy(() => import('../phone/ContactsApp'));
const LampsApp = lazy(() => import('../lamps/LampsApp'));
/* 0129–0131 — Sprawy: Meldungen (der Betreiber), eigene gesperrte Inhalte, Bitten um einen Platz in einer Liste. */
/* 0137 — Wspólnoty: die geführte Einrichtung, die Struktur (React Flow) — erst, wenn man sie öffnet. */
const Communities = lazy(() => import('../communities/Communities').then((m) => ({ default: m.Communities })));
const SprawyView = lazy(() => import('../reports/Sprawy').then((m) => ({ default: m.SprawyView })));

export function Workspace({ spot, who }: { spot: Spot; who: Who }) {
  /* 0111 — angemeldet und die Seite zu sehen: „w aplikacji" (für „Wyślij, gdy będzie online" und wer es teilt). */
  useOnline('/workspace/online');
  /** `undefined` = noch nicht nachgesehen, `null` = ging nicht. */
  const [desk, setDesk] = useState<Desk | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);
  const t = useT();

  const look = useCallback(async () => {
    try {
      setDesk(await loadDesk());
      setFailed(null);
    } catch (e) {
      setDesk(null);
      setFailed(e instanceof WorkspaceError ? e.message : t('workspace.main.loadFailed'));
    }
  }, [t]);

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
        <h1 className="wk-h1">{t('workspace.main.strayTitle')}</h1>
        <p className="wk-lede">
          {rich(t('workspace.main.strayText', { word: spot.word }), { code: (s, key) => <code key={key}>{s}</code> })}
        </p>

        {/* Der Weg hinaus steht oben, wie überall. Zwei Ausgänge sind keiner mehr. */}
      </>
    );
  }

  if (desk === undefined) return <Loading />;

  if (desk === null) {
    return (
      <>
        <h1 className="wk-h1">{t('workspace.main.title')}</h1>
        <p className="wk-error">{failed}</p>
        <p>
          <button type="button" className="wk-btn" onClick={() => void look()}>{t('common.retry')}</button>
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
        {/*
          2026-10-16 — KEIN „Sposób wyświetlania" mehr: jede Ansicht hat EINEN
          Aufbau, und was selten gebraucht wird, steht dort, wo man es braucht
          (ein Reiter, „⋯"). Biblioteka und Nauka tragen ihren Titel selbst.
        */}
        {spot.trail.length === 0 && !OWN_TITLE.has(spot.view) && (
          <PageHeader title={VIEWS[TITLE_OF[spot.view] ?? spot.view]} />
        )}

        {/* Zadania sind ein Reiter des Kalenders, kein eigener Ort. */}
        {spot.trail.length === 0 && (spot.view === 'calendar' || spot.view === 'tasks') && <CalendarTabs at={spot.view} />}

        <LangScope section={SECTION_OF[spot.view] ?? 'workspace'}>
          <Inside
            view={spot.view}
            trail={spot.trail}
            desk={desk}
            who={who}
            onChanged={() => void look()}
          />
        </LangScope>
      </>
    );
  }

  /* 0094 — die Seite des Warsztat ist ein Widok (`WorkspaceHome`): was neu ist, Termine, Teile auf Wunsch. */
  return <WorkspaceHome who={who} desk={desk} />;
}

/** 2026-11-05 — welcher Teil der Anwendung eine Ansicht ist: seine eigene Sprache, wenn jemand eine gewählt hat (core/i18n.tsx). */
const SECTION_OF: Partial<Record<View, Section>> = {
  areas: 'areas', calendar: 'calendar', tasks: 'calendar', chat: 'chat', forms: 'forms', modules: 'forms', pages: 'pages',
  library: 'library', scriptorium: 'scriptorium', knowledge: 'knowledge', learn: 'learn', masses: 'masses', bookings: 'bookings',
  wspolnoty: 'communities', roles: 'roles', addresses: 'addresses', sms: 'sms', contacts: 'sms', lamps: 'lamps',
  registry: 'registry', sprawy: 'reports', account: 'account'
};

/** Ansichten, die ihren Titel selbst tragen. */
const OWN_TITLE: ReadonlySet<View> = new Set<View>(['chat', 'widok', 'library', 'scriptorium', 'knowledge', 'learn', 'forms', 'areas', 'sms', 'contacts', 'lamps', 'roles', 'bookings']);

/** Unter welchem Namen eine Ansicht steht — Zadania unter Kalendarz. */
const TITLE_OF: Partial<Record<View, View>> = { tasks: 'calendar' };

/** Kalendarz | Zadania — zwei Reiter, zwei Adressen. */
function CalendarTabs({ at }: { at: 'calendar' | 'tasks' }) {
  const t = useT();
  return (
    <nav className="wk-tabs" aria-label={t('workspace.main.calendar')}>
      <a className={at === 'calendar' ? 'wk-tab wk-tab-on' : 'wk-tab'} aria-current={at === 'calendar' ? 'page' : undefined} href={viewPath('calendar')}>{t('workspace.main.terms')}</a>
      <a className={at === 'tasks' ? 'wk-tab wk-tab-on' : 'wk-tab'} aria-current={at === 'tasks' ? 'page' : undefined} href={viewPath('tasks')}>{t('workspace.main.tasks')}</a>
    </nav>
  );
}

/** Eine alte Adresse führt zur neuen — ersetzt, damit Zurück nicht im Kreis geht. */
function Redirect({ to }: { to: string }) {
  useEffect(() => { window.location.replace(to); }, [to]);
  return <Loading />;
}

/** Was unter `forms` steht, so wie `Modules` es liest (`form/<kennung>`, `mapa-formularzy`). */
const formsTrail = (trail: readonly string[]): readonly string[] =>
  trail.length === 0 || trail[0] === FORM_MAP_STEP ? trail : ['form', ...trail];

const FORM_MAP_STEP = 'mapa-formularzy';

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
  const t = useT();
  if (view === 'forms') return <Modules who={who} trail={formsTrail(trail)} forms />;
  /* Die alte Adresse eines Formulars (`modules/form/<kennung>`) — eine Adresse je Ding. */
  if (view === 'modules' && trail[0] === 'form') return <Redirect to={formsPath(...trail.slice(1))} />;
  if (view === 'modules') return <Modules who={who} trail={trail} />;
  if (view === 'pages') {
    return <Pages desk={desk} who={who} trail={trail} onClaimed={onChanged} />;
  }
  if (view === 'addresses') return <Addresses desk={desk} who={who} onChanged={onChanged} />;
  if (view === 'roles') return <RoleGraph who={who} />;
  if (view === 'areas') return <Areas who={who} trail={trail} desk={desk} />;
  if (view === 'wspolnoty') return <Suspense fallback={<Loading />}><Communities who={who} trail={trail} /></Suspense>;
  /* 0094 — die Adresse eines Widoks führt dorthin, wo er jetzt steht: der eines Bereichs in den Bereich, jeder andere nach Hause. */
  if (view === 'widok') {
    const area = /^area:(.+)$/.exec(trail[0] ?? '')?.[1];
    return <Redirect to={area === undefined ? tilesPath() : viewPath('areas', area)} />;
  }
  if (view === 'calendar') return <CalendarApp who={who} trail={trail} />;
  if (view === 'tasks') return <TasksView who={who} />;
  if (view === 'masses') return <MassOffice who={who} trail={trail} />;
  if (view === 'bookings') return <Reservations trail={trail} />;
  if (view === 'account') return <Account who={who} trail={trail} />;
  if (view === 'chat') return <ChatView who={who} trail={trail} />;
  if (view === 'library') return <LibraryView who={who} trail={trail} />;
  if (view === 'scriptorium') return <Suspense fallback={<Loading />}><ScriptoriumView who={who} trail={trail} /></Suspense>;
  /* 2026-10-24 — Cogita in zwei Teilen: Wiedza (Einträge, Dodaj, Schematy) und Nauka, dieselben Bazy (`cogita/parts.ts`). */
  if (view === 'knowledge') return <Suspense fallback={<Loading />}><LearnView who={who} trail={trail} part="knowledge" /></Suspense>;
  if (view === 'learn') return <Suspense fallback={<Loading />}><LearnView who={who} trail={trail} part="learn" /></Suspense>;
  if (view === 'sms') return <Suspense fallback={<Loading />}><SmsApp who={who} trail={trail} /></Suspense>;
  if (view === 'contacts') return <Suspense fallback={<Loading />}><ContactsApp who={who} trail={trail} /></Suspense>;
  if (view === 'lamps') return <Suspense fallback={<Loading />}><LampsApp who={who} trail={trail} /></Suspense>;
  if (view === 'registry') return <Kartoteka who={who} trail={trail} />;
  if (view === 'sprawy') return <Suspense fallback={<Loading />}><SprawyView who={who} trail={trail} /></Suspense>;

  /* Jede Ansicht steht oben; was hier ankommt, gibt es (noch) nicht. */
  return <p className="wk-note">{t('workspace.main.noSuchPart')}</p>;
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
  const t = useT();

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
    : desk.roles.length === 0 ? t('workspace.claim.noRole')
    : typed === '' ? t('workspace.claim.enterAddress')
    : !isRoot && !PATH_SHAPE.test(path) ? t('workspace.claim.shape')
    : path === 'workspace' || path.startsWith('workspace/') ? t('workspace.claim.reserved')
    : code.trim() === '' ? t('workspace.claim.enterCode')
    : roleId === '' ? t('workspace.claim.pickRole')
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
      setFailed(e instanceof WorkspaceError ? e.message : t('workspace.claim.failed'));
    } finally {
      setBusy(false);
    }
  };

  /* Liste oder Baum — eine Ansicht derselben Seiten, kein „Sposób wyświetlania". */
  const [shape, setShape] = useRemembered('pages.shape', 'list');

  return (
    <>
      {desk.pages.length === 0 ? (
        <p className="wk-lede">{t('workspace.claim.noAddresses')}</p>
      ) : editing !== null || moduleId !== null ? null : (
        <>
        <div className="wk-seg" role="group" aria-label={t('workspace.claim.shapeLabel')}>
          <button type="button" className={shape !== 'tree' ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={shape !== 'tree'} onClick={() => setShape('list')}>{t('workspace.claim.list')}</button>
          <button type="button" className={shape === 'tree' ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={shape === 'tree'} onClick={() => setShape('tree')}>{t('workspace.claim.tree')}</button>
        </div>
        {shape !== 'tree' ? <PageList desk={desk} who={who} /> : (
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
        )}
        </>
      )}

      {/*
        EIN BAUSTEIN, AUFGESCHLAGEN — als Unterseite der Seite, auf der er
        steht. Die Seitenliste bleibt dabei stehen: man kommt von ihr, und
        man geht zu ihr zurück.
      */}
      {moduleId !== null && (
        module === null ? (
          <p className="wk-empty">{t('workspace.claim.noModule')}</p>
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
        <summary>{t('workspace.claim.summary')}</summary>


        <form
          className="wk-form"
          onSubmit={(e) => { e.preventDefault(); if (blocker === null) void go(); }}
        >
          <label className="wk-field">
            <span>{t('workspace.claim.address')}</span>
            <input value={wanted} onChange={(e) => setWanted(e.target.value)} placeholder={t('workspace.claim.addressPlaceholder')} />
          </label>

          {/* Sonst wäre die Wurzel die einzige Adresse, die man nicht tippen kann. */}
          <p className="wk-hint">
            {rich(t('workspace.claim.rootHint'), { code: (s, key) => <code key={key}>{s}</code> })}
          </p>

          <label className="wk-field">
            <span>{t('workspace.claim.code')}</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
          </label>

          {/*
            NICHT „ja" przejmuję adres, tylko rola. To jedyne pole, które łatwo
            przeoczyć, a decyduje o tym, co się stanie, gdy ktoś odejdzie.
          */}
          <label className="wk-field">
            <span>{t('workspace.claim.who')}</span>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {takers(desk.roles).map((role) => (
                <option key={role.id} value={role.id}>{roleLabel(role, names)}</option>
              ))}
            </select>
          </label>

          <p className="wk-hint">
            {isRoot ? (
              <>{rich(t('workspace.claim.rootRole'), { code: (s, key) => <code key={key}>{s}</code> })}</>
            ) : (
              <>{rich(t('workspace.claim.subRole', { path: path === '' ? t('workspace.claim.addressPlaceholder') : path }), { code: (s, key) => <code key={key}>{s}</code> })}</>
            )}
          </p>

          {failed !== null && <p className="wk-error">{failed}</p>}
          {done !== null && <p className="wk-done">{rich(t('workspace.claim.done', { path: done }), { code: (s, key) => <code key={key}>{s}</code> })}</p>}

          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={blocker !== null || busy}>
              {busy ? t('workspace.parts.checking') : t('workspace.claim.claim')}
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
  const t = useT();
  const pages = desk.pages.filter((one) => one.aliasOf === null).sort((a, b) => a.path.localeCompare(b.path));
  return (
    <>
      <ul className="wk-page-list">
        {pages.map((one) => {
          const areas = one.accessAreaIds ?? [];
          return (
            <li key={one.path} data-page={one.path}>
              <a className="wk-page-path" href={viewPath('pages', ...pageSteps(one.path))}>{one.path === '' ? 'recreatio.pl' : one.path}</a>
              {areas.length > 0 && <span className="wk-tag">{t('workspace.parts.withAccess')}</span>}
              <span className="wk-part-acts">
                <a className="wk-link-btn" href={`#/${one.path}`}>{t('common.open')}</a>
                <a className="wk-link-btn" href={viewPath('pages', ...pageSteps(one.path))}>{t('common.edit')}</a>
                <ShareButton who={who} label={t('workspace.parts.share')} className="wk-link-btn"
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
