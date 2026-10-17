/**
 * Die BAUSTEINE — in drei Schritten, und jeder ist eine Adresse.
 *
 * <code>
 *   #/workspace/modules              die Arten
 *   #/workspace/modules/form         die Bögen, die es gibt
 *   #/workspace/modules/form/new     einen neuen anlegen
 *   #/workspace/modules/form/&lt;id&gt;    einen ganz aufschlagen
 * </code>
 *
 * <b>Vorher war es EINE Liste.</b> Alle Arten durcheinander, jede Zeile zum
 * Aufklappen, und darin drei Felder — Name, Bereich, „wovon er handelt". Unter
 * zwanzig Bausteinen fand man den gesuchten nicht mehr, und das, was man
 * eigentlich suchte, stand gar nicht darin: die Fragen eines Bogens standen
 * woanders.
 *
 * <b>Erst die Art, dann das Ding, dann alles davon.</b> So sucht man auch: „ein
 * Formular" ist die erste Entscheidung, „welches" die zweite. Und weil jeder
 * Schritt eine Adresse ist, steht der Weg oben im Kopf und lässt sich
 * verschicken — die Bögen eines Hauses sind ein Link.
 *
 * <b>Der dritte Schritt ist die GANZE Seite des Bausteins.</b> Seine
 * Einstellungen und das, was seine Art ausmacht: bei einem Bogen die Fragen,
 * die Einsendungen, die Nachrichtenvorlage und das Portal. Dieselbe Ansicht
 * erreicht man auch von der Seite aus, auf der er steht — ein Ding, zwei Wege
 * dorthin.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { areaPath, loadAreas, type AreaRow } from '../areas/area';
import { useCrumbs, type Crumb } from '../shell/crumbTrail';
import { FormOffice } from '../forms/FormOffice';
import { newId } from '../core/ids';
import {
  createModule, loadModules, readConfig, removeModule, SUBJECT_LABEL, SUBJECTS, type Subject, type ModuleRow
} from './module';
import { setPartConfig } from '../forms/form';
import { PARTS, partLabel, partOf, takesEntries } from '../pages/parts/registry';
import { PickChat } from '../chat/PickChat';
import { PickForm, PickQuestions, pickedForm } from '../forms/FormPick';
import { PickPage } from '../pages/PickPage';
import { PickResource } from '../bookings/PickResource';
import { PickLibrary, PickLibraryEntry } from '../library/LibraryPick';
import { PickCalendar, PickCalendarItem } from '../calendar/PickCalendar';
import { DependencyMap } from './DependencyMap';
import { FORM_MAP, FormList } from '../forms/FormList';
import { FormMap } from '../forms/FormMap';
import type { FormGroup } from './module';
import { PEOPLE_TAB, viewPath, formsPath, modulePath } from '../routes';
import { WorkspaceError, type Who } from '../core/session';
import { AreaPick } from '../areas/AreaPick';
import { ModuleSettings } from './ModuleSettings';
import { ModuleJson } from './ModuleJson';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { current as notifyNow, subscribe as notifySubscribe } from '../notify/notify';
import { useRecent } from '../core/prefs';
import { useTouched } from '../workspace/Recent';
import { Icon } from '../ui/icons';
import { plural } from '../core/plural';

const NEW = 'new';

/** 0072 — die Karte der Zusammenhänge; kein Name einer Art (die heissen englisch). */
const MAP = 'mapa';

/** Kennungen sind UUIDs; `new` ist keine, und deshalb kollidiert nichts. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Welcher der vier Schritte gerade dasteht. */
type View =
  | { readonly at: 'kinds' }
  | { readonly at: 'list'; readonly kind: string }
  | { readonly at: 'new'; readonly kind: string }
  | { readonly at: 'one'; readonly kind: string; readonly moduleId: string };

export function viewOf(trail: readonly string[]): View {
  const kind = trail[0];
  if (kind === undefined) return { at: 'kinds' };

  const second = trail[1];
  if (second === undefined) return { at: 'list', kind };
  if (second === NEW) return { at: NEW, kind };
  if (UUID.test(second)) return { at: 'one', kind, moduleId: second };

  /* Weder das eine noch das andere: dann eben die Liste dieser Art. Zu raten
     wäre schlimmer als zurückzufallen. */
  return { at: 'list', kind };
}

/**
 * @param forms 2026-10-16 — „Formularze": nur Formulare (Liste, Gruppen, ein Formular). Ohne: „Moduły" in
 *   den Ustawienia — jede Art, Unbenutzte, die Karte der Abhängigkeiten.
 */
export function Modules({ who, trail, forms = false }: { who: Who; trail: readonly string[]; forms?: boolean }) {
  const [modules, setModules] = useState<readonly ModuleRow[] | null>(null);
  /* 0096 — die Gruppen von Formularen (Ordner). */
  const [groups, setGroups] = useState<readonly FormGroup[]>([]);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const view = viewOf(trail);

  const { digest } = useSyncExternalStore(notifySubscribe, notifyNow);

  /* 0054 — zuletzt benutzte Bausteine zuerst, gemerkt versiegelt. */
  useTouched('modules', view.at === 'one' ? view.moduleId : null);
  const recent = useRecent('modules');

  const look = useCallback(async () => {
    try {
      const loaded = await loadModules();
      setModules(loaded.modules);
      setGroups(loaded.groups ?? []);
      setAreas((await loadAreas()).areas);
      setFailed(null);
    } catch (e) {
      setModules([]);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać modułów.');
    }
  }, []);

  useEffect(() => { void look(); }, [look]);

  /*
   * `…/osoby` — ein Formular gleich auf seiner Liste (der Weg von der Seite,
   * auf der es steht). Der Zusatz gilt EINMAL: die Adresse steht danach
   * wieder ohne ihn da, sonst spränge die Ansicht nach jeder Änderung am
   * Baustein auf die Liste zurück.
   */
  const onList = view.at === 'one' && trail[2] === PEOPLE_TAB;
  const plain = view.at === 'one' ? modulePath(view.kind, view.moduleId) : null;

  useEffect(() => {
    if (onList && plain !== null && modules !== null) window.location.replace(plain);
  }, [onList, plain, modules]);

  const all = modules ?? [];
  /* Der aufgeschlagene Baustein — nur dann, wenn einer aufgeschlagen ist.
     Frisch aus der Liste geholt: nach einer Änderung stünde sonst der alte
     Stand da, und man sähe seine eigene Änderung nicht. */
  const mine = view.at === 'one'
    ? all.find((one) => one.moduleId === view.moduleId)
    : undefined;

  /* -- Der Weg oben im Kopf ------------------------------------------------ */

  const crumbs: Crumb[] = trail[0] === MAP ? [{ label: 'Mapa zależności', href: null }]
    : trail[0] === FORM_MAP ? [{ label: 'Mapa formularzy', href: null }]
    : view.at === 'kinds' ? []
    /* Unter „Formularze" ist die Art schon der Ort: nur das eine Formular. */
    : forms ? (view.at === 'list' ? [] : [{ label: view.at === NEW ? 'Nowy formularz' : mine?.name ?? '…', href: null }])
    : [
    {
      label: partLabel(view.kind),
      href: modulePath(view.kind),

      /* Von einer Art zur nächsten, ohne den Umweg über die Liste darüber. */
      beside: PARTS
        .filter((one) => one.kind !== view.kind)
        .map((one) => ({ label: one.label, href: modulePath(one.kind) }))
    },
    ...(view.at === 'list' ? [] : [{
      label: view.at === NEW ? 'Nowy' : mine?.name ?? '…',
      href: null
    }])
  ];

  useCrumbs(crumbs);

  const act = async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);

    try {
      await todo();
      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  if (modules === null) return <Loading />;

  /* 0072 — die Karte: Seiten, Bausteine und ihre Quellen, zum Ansehen und Umhängen. */
  if (trail[0] === MAP) return <DependencyMap />;

  /* 0096 — die Karte der Formulare: Gruppen, Unterformulare, wo der Link entsteht, was wovon abhängt. */
  if (trail[0] === FORM_MAP) return <FormMap focus={trail[1] ?? null} />;

  const head = (
    <>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-working">{busy}</p>}
    </>
  );

  /* -- 1. Die Arten -------------------------------------------------------- */

  if (view.at === 'kinds' && forms) {
    /*
     * 0094 — EINFACH: die Formulare, mit dem, was neu ist, zuerst. Andere
     * Bausteine (Texte, Messpläne …) setzt man auf der Seite; hier sind sie der
     * erweiterte Weg.
     */
    const fresh = new Map((digest?.registrations.list ?? []).map((one) => [one.moduleId, one.count]));
    /* 0096 — die Formulare in ihren Gruppen, Unterformulare unter ihrem Hauptformular. */
    return (
      <>
        {head}
        <div data-simple-forms="">
          <FormList modules={all} groups={groups} areas={areas} fresh={fresh} busy={busy !== null} onAct={act} />
        </div>
      </>
    );
  }

  if (view.at === 'kinds') {
    return (
      <>
        {head}

        {/* 2026-10-17 — die Karten als zwei Zeilen, die Arten als Zeilen eines Kastens (auf dem Telefon lief die Liste über den Rand). */}
        <nav className="wk-box" aria-label="Mapy">
          <a className="wk-line" href={viewPath('modules', MAP)}>
            <span className="wk-line-ic"><Icon name="flow" /></span>
            <span className="wk-line-text">
              <span className="wk-line-title">Mapa zależności</span>
              <span className="wk-line-sub">Strony, moduły i źródła — co z czego korzysta</span>
            </span>
            <span className="wk-line-end"><Icon name="next" /></span>
          </a>
          <a className="wk-line" href={formsPath(FORM_MAP)}>
            <span className="wk-line-ic"><Icon name="branch" /></span>
            <span className="wk-line-text">
              <span className="wk-line-title">Mapa formularzy</span>
              <span className="wk-line-sub">Grupy, podformularze, link osoby</span>
            </span>
            <span className="wk-line-end"><Icon name="next" /></span>
          </a>
        </nav>

        <Unused modules={all} busy={busy !== null} onAct={act} />

        <ul className="wk-box wk-kind-list" aria-label="Rodzaje modułów">
          {PARTS.map((one) => {
            const count = all.filter((m) => m.kind === one.kind).length;

            return (
              <li key={one.kind}>
                <a className="wk-line" href={modulePath(one.kind)}>
                  <span className="wk-line-text">
                    <span className="wk-line-title">{one.label}</span>
                    <span className="wk-line-sub">{one.use}</span>
                  </span>
                  <span className="wk-line-end">{count === 0 ? '—' : <span className="wk-count is-quiet">{count}</span>}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  const ofKind = recent.order(all.filter((one) => one.kind === view.kind), (one) => one.moduleId);

  /* -- 2. Die Bausteine dieser Art ----------------------------------------- */

  if (view.at === 'list') {
    return (
      <>
        {head}

        {partOf(view.kind) !== undefined && (
          <p className="wk-lede">{partOf(view.kind)!.use}</p>
        )}

        <ul className="wk-tree">
          {ofKind.map((one) => (
            <li key={one.moduleId}>
              <a className="wk-tree-row" href={modulePath(view.kind, one.moduleId)}>
                <span className="wk-tree-name">{one.name}</span>

                <span className="wk-tags">
                  {one.areaId !== null ? (
                    /* Mit dem Weg dorthin — zwei „Kandydaci" sind sonst nicht zu unterscheiden. */
                    <span className="wk-tag" title={areaPath(areas, one.areaId).full || undefined}>
                      {areaPath(areas, one.areaId).short || one.areaName}
                    </span>
                  ) : <span className="wk-tag">bez obszaru</span>}

                  {one.entries > 0 && <span className="wk-tag">{one.entries} zgłoszeń</span>}
                </span>

                <span className="wk-tree-mine">
                  {one.usedOnPages === 0
                    ? 'nigdzie nie stoi'
                    : `na ${one.usedOnPages} ${one.usedOnPages === 1 ? 'stronie' : 'stronach'}`}
                </span>
              </a>
            </li>
          ))}

          <li>
            <a className="wk-tree-add" href={modulePath(view.kind, NEW)}>
              <span aria-hidden="true">+</span> Nowy
            </a>
          </li>
        </ul>

        {ofKind.length === 0 && (
          <p className="wk-empty">Nie masz jeszcze żadnego takiego modułu.</p>
        )}
      </>
    );
  }

  /* -- 3. Anlegen ---------------------------------------------------------- */

  if (view.at === NEW) {
    return (
      <>
        {head}
        <NewModule
          kind={view.kind}
          areas={areas}
          busy={busy !== null}
          onAct={act}
          onDone={(moduleId) => {
            window.location.hash = modulePath(view.kind, moduleId);
          }}
        />
      </>
    );
  }

  /* -- 4. Einer, ganz ------------------------------------------------------ */

  if (mine === undefined) {
    return <p className="wk-empty">Tego modułu już nie ma.</p>;
  }

  return (
    <>
      {head}
      <ModulePage module={mine} areas={areas} who={who} busy={busy !== null} onAct={act} onReload={look} onList={onList} />
    </>
  );
}

/* -- Ein Baustein, ganz ----------------------------------------------------- */

/**
 * Alles, was zu einem Baustein gehört — seine Einstellungen und das, was seine
 * Art ausmacht.
 *
 * <b>Die Art entscheidet, was darunter steht.</b> Ein Bogen bringt seine
 * Fragen, Einsendungen, Nachrichtenvorlage und sein Portal mit (`FormOffice`);
 * alles andere hat Felder, und die stehen hier. Ein `if` über zwei Fälle, und
 * beide sind echte Fälle — kein Katalog, der jede Art einzeln aufzählt.
 */
function ModulePage({ module: row, areas, who, busy, onAct, onReload, onList }: {
  module: ModuleRow;
  areas: readonly AreaRow[];
  who: Who;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
  onReload: () => Promise<void>;

  /** Ein Formular auf seiner Liste aufschlagen — so verlangt es die Adresse. */
  onList: boolean;
}) {
  /* 0064 — nach einem Import mit Fragen liest das Formular neu. */
  const [round, setRound] = useState(0);
  /* 0094 — das JSON ist der erweiterte Weg (bei einem Formular der der Formulare). */
  /* Eine Zeile Angaben statt einer Reihe „RODZAJ / NA STRONACH / ZGŁOSZEŃ". */
  const facts = [
    row.kind === 'form' ? (row.areaName ?? null) : partLabel(row.kind),
    row.usedOnPages === 0 ? 'na żadnej stronie' : row.usedOnPages === 1 ? 'na 1 stronie' : `na ${row.usedOnPages} stronach`,
    row.entries > 0 ? `${row.entries} ${plural(row.entries, 'zgłoszenie', 'zgłoszenia', 'zgłoszeń')}` : null
  ].filter((one): one is string => one !== null && one !== '');

  return (
    <>
      <PageHeader
        title={row.name}
        badge={row.kind === 'form' && row.closed ? <span className="wk-tag">Zapisy zamknięte</span> : row.kind === 'form' ? <span className="wk-tag wk-tag-open">Zapisy otwarte</span> : undefined}
        meta={facts.join(' · ')}
      />

      {/* -- Was er ist ----------------------------------------------------- */}

      {row.kind === 'form' ? (
        /*
         * Ein Formular hat Reiter (`FormOffice`), und seine Einstellungen
         * gehören in den ersten — zum Einrichten, nicht über alle drei.
         */
        <FormOffice
          key={`${row.moduleId}:${round}`}
          partId={row.moduleId}
          config={readConfig(row.config)}
          who={who}
          standsOn={row.pages}
          module={row}
          onModuleChanged={onReload}
          onList={onList}
        />
      ) : (
        <>
          <ModuleSettings row={row} areas={areas} busy={busy} onAct={onAct} />
          <Content module={row} busy={busy} />
        </>
      )}

      {/* 0064 — dieses Modul als JSON: Name, Inhalt, bei einem Formular Fragen und Aufbau. Zugeklappt, ganz unten. */}
      <ModuleJson row={row} who={who} onDone={async () => { await onReload(); setRound((n) => n + 1); }} />
    </>
  );
}

/**
 * Der Inhalt eines Bausteins, der seinen Inhalt SELBST trägt.
 *
 * <b>Dieselben Felder wie im Rastereditor</b> — und dieselbe Quelle: die Art
 * sagt, welche es sind (`parts/`). Sie hier ein zweites Mal aufzuzählen wäre
 * genau der Fehler, den die Bausteinverträge abgeschafft haben.
 *
 * <b>Gespeichert wird je Feld, beim Verlassen.</b> Ein „Zapisz" darunter wäre
 * ein zweiter Knopf neben dem für die Einstellungen, und man müsste sich
 * merken, welcher welche Hälfte nimmt.
 */
function Content({ module: row, busy }: { module: ModuleRow; busy: boolean }) {
  const def = partOf(row.kind);
  const [config, setConfig] = useState<Record<string, string>>(() => readConfig(row.config));
  const [failed, setFailed] = useState<string | null>(null);

  /*
   * 0063 — EIN EIGENER EDITOR SCHREIBT BEI JEDEM TASTENDRUCK. Gespeichert wird
   * gesammelt, kurz nachdem das Tippen aufhört — und was die Antwort
   * zurückbringt, überschreibt nicht, was inzwischen schon wieder getippt ist.
   */
  const queued = useRef<Record<string, string>>({});
  const timer = useRef<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const patch = queued.current;
    queued.current = {};
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    try {
      const done = await setPartConfig(row.moduleId, patch);
      setConfig({ ...done.config, ...queued.current });
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setSaving(false);
    }
  }, [row.moduleId]);

  const queue = (patch: Record<string, string>) => {
    setConfig((was) => ({ ...was, ...patch }));
    queued.current = { ...queued.current, ...patch };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, 700);
  };

  /* Wer die Seite verlässt, während noch etwas wartet, verliert es nicht. */
  useEffect(() => () => { void flush(); }, [flush]);

  useEffect(() => { setConfig({ ...readConfig(row.config), ...queued.current }); }, [row.moduleId, row.config]);

  if (def !== undefined && def.Editor !== null) {
    const Editor = def.Editor;
    return (
      <section className="wk-form">
        <h2 className="wk-h2">Treść</h2>
        {def.missing(config) !== null && <p className="wk-blocker">{def.missing(config)}</p>}
        <Editor raw={config} onSet={queue} busy={busy} ctx={{ path: row.pages[0] ?? null, moduleId: row.moduleId }} />
        <p className="wk-hint" role="status">{saving ? 'Zapisywanie…' : 'Zmiany zapisują się same.'}</p>
        {failed !== null && <p className="wk-error">{failed}</p>}
      </section>
    );
  }

  if (def === undefined || def.fields.length === 0) {
    return (
      <p className="wk-hint">
        Ten rodzaj nie ma własnych ustawień — wszystko, co pokazuje, bierze się
        skądinąd.
      </p>
    );
  }

  const save = async (key: string, value: string) => saveMany({ [key]: value });

  /* Mehrere Schlüssel in EINEM Gang — ein anderes Formular setzt auch die Auswahl seiner Fragen zurück. */
  const saveMany = async (patch: Record<string, string>) => {
    setFailed(null);
    setConfig({ ...config, ...patch });

    try {
      const done = await setPartConfig(row.moduleId, patch);
      setConfig(done.config);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    }
  };

  return (
    <section className="wk-form">
      <h2 className="wk-h2">Treść</h2>

      {def.missing(config) !== null && <p className="wk-blocker">{def.missing(config)}</p>}

      {def.fields.map((field) => {
        const value = config[field.key] ?? '';

        const input = field.kind === 'chat' ? (
          <PickChat value={value} busy={busy} onPick={(id) => { setConfig({ ...config, [field.key]: id }); void save(field.key, id); }} />
        ) : field.kind === 'calendar' ? (
          <PickCalendar value={value} busy={busy} onPick={(id) => { setConfig({ ...config, [field.key]: id }); void save(field.key, id); }} />
        ) : field.kind === 'calendarItem' ? (
          <PickCalendarItem calendarId={config[field.of ?? ''] ?? ''} value={value} busy={busy}
            onPick={(id) => { setConfig({ ...config, [field.key]: id }); void save(field.key, id); }} />
        ) : field.kind === 'library' || field.kind === 'knowledge' ? (
          <PickLibrary kind={field.kind === 'knowledge' ? 'knowledge' : 'books'} value={value} busy={busy} onPick={(id) => void save(field.key, id)} />
        ) : field.kind === 'libraryEntry' ? (
          <PickLibraryEntry library={config[field.of ?? ''] ?? ''} kinds={field.entryKinds ?? ['text']} value={value} busy={busy} optional={field.optional} onPick={(id) => void save(field.key, id)} />
        ) : field.kind === 'resource' ? (
          <PickResource
            value={value}
            busy={busy}
            onPick={(id) => { setConfig({ ...config, [field.key]: id }); void save(field.key, id); }}
          />
        ) : field.kind === 'page' ? (
          <PickPage value={value} busy={busy} onPick={(path) => { setConfig({ ...config, [field.key]: path }); void save(field.key, path); }} />
        ) : field.kind === 'form' ? (
          <PickForm value={value} busy={busy} onPick={(id) => void saveMany(pickedForm(def, field.key, id))} />
        ) : field.kind === 'questions' ? (
          <PickQuestions
            formId={config[field.of ?? ''] ?? ''}
            value={value}
            busy={busy}
            subforms={field.subforms === true}
            onPick={(next) => void save(field.key, next)}
          />
        ) : field.kind === 'line' ? (
          <input
            value={value}
            placeholder={field.hint}
            disabled={busy}
            onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
            onBlur={(e) => { void save(field.key, e.target.value); }}
          />
        ) : (
          <textarea
            rows={5}
            value={value}
            placeholder={field.hint}
            disabled={busy}
            onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
            onBlur={(e) => { void save(field.key, e.target.value); }}
          />
        );

        /* Mehrere Knöpfe darin — kein <label>, sonst träfe ein Klick daneben den ersten. */
        return field.kind === 'questions' || field.kind === 'form' || field.kind === 'calendarItem' ? (
          <div className="wk-field" key={field.key}><span>{field.label}</span>{input}</div>
        ) : (
          <label className="wk-field" key={field.key}><span>{field.label}</span>{input}</label>
        );
      })}

      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/**
 * 0063 — WAS NIRGENDS STEHT, auf einmal weg.
 *
 * Ein Baustein bleibt in der Liste, wenn er von einer Seite genommen wird
 * (0041) — er soll sich woanders wieder hinsetzen lassen. Mit der Zeit sammeln
 * sich so Bausteine an, die niemand mehr braucht: „text — …", „seat-shared —
 * …", nebenbei angelegt und vergessen. Hier gehen sie alle, nach einer
 * Rückfrage, die sie beim Namen nennt.
 *
 * <b>Was Einsendungen trägt, bleibt</b> — sie gehören denen, die sie geschickt
 * haben; der Dienst lehnt es ohnehin ab (`Module.RemoveAsync`). Es steht dabei,
 * damit niemand rätselt, warum es nicht verschwindet.
 */
function Unused({ modules, busy, onAct }: {
  modules: readonly ModuleRow[];
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const idle = modules.filter((one) => one.usedOnPages === 0);
  const free = idle.filter((one) => one.entries === 0);
  const kept = idle.filter((one) => one.entries > 0);

  if (idle.length === 0) return null;

  const removeAll = async () => {
    const refused: string[] = [];
    for (const one of free) {
      try {
        await removeModule(one.moduleId);
      } catch (e) {
        refused.push(`${one.name}: ${e instanceof WorkspaceError ? e.message : 'nie udało się'}`);
      }
    }
    if (refused.length > 0) throw new WorkspaceError(`Nie usunięto: ${refused.join(' · ')}`);
  };

  return (
    <section className="wk-unused">
      <p className="wk-unused-line">
        <strong>Nieużywane moduły: {idle.length}</strong>
        <span className="wk-hint"> — nie stoją na żadnej stronie.</span>
        {free.length > 0 && !asking && (
          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setAsking(true)}>Usuń nieużywane…</button>
        )}
      </p>
      {asking && (
        <div className="wk-unused-ask">
          <p>Usunąć te moduły? Nie da się tego cofnąć.</p>
          <ul>{free.map((one) => <li key={one.moduleId}>{one.name} <span className="wk-hint">· {partLabel(one.kind)}</span></li>)}</ul>
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-danger" disabled={busy}
              onClick={() => { setAsking(false); void onAct(`Usuwanie modułów (${free.length})…`, removeAll); }}>
              Usuń {free.length}
            </button>
            <button type="button" className="wk-link-btn" onClick={() => setAsking(false)}>Anuluj</button>
          </div>
        </div>
      )}
      {kept.length > 0 && (
        <p className="wk-hint">
          Zostają, bo mają zgłoszenia: {kept.map((one) => `${one.name} (${one.entries})`).join(', ')}. Zgłoszenia należą do osób, które je wysłały.
        </p>
      )}
    </section>
  );
}

/* -- Anlegen ---------------------------------------------------------------- */

/**
 * Einen neuen Baustein — die Art steht schon fest.
 *
 * <b>Sie kommt aus der Adresse</b> und wird nicht noch einmal gefragt: wer hier
 * ankommt, hat sie einen Schritt vorher gewählt. Ein Auswahlfeld daneben wäre
 * die Möglichkeit, etwas anderes zu tun, als man gerade tut.
 */
function NewModule({ kind, areas, busy, onAct, onDone }: {
  kind: string;
  areas: readonly AreaRow[];
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
  onDone: (moduleId: string) => void;
}) {
  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState('');
  const [forKind, setForKind] = useState<Subject>('person');

  /* Hineinlegen darf man nur, wo man schreiben darf — der Dienst verlangt es,
     und eine Auswahl, die mehr anböte, endete in einer Absage. */
  const usable = areas.filter((a) => a.myLevel === 'admin' || a.myLevel === 'write');

  const blocker = busy ? null : name.trim() === '' ? 'Nazwij moduł.' : null;

  return (
    <form
      className="wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (blocker !== null) return;

        const moduleId = newId();

        void onAct('Zakładanie…', () => createModule(
          moduleId, kind, name.trim(), areaId === '' ? null : areaId,
          takesEntries(kind) ? forKind : 'none'
        )).then(() => onDone(moduleId));
      }}
    >
      <h1 className="wk-h1">Nowy: {partLabel(kind)}</h1>

      <label className="wk-field">
        <span>Nazwa</span>
        <input
          value={name}
          placeholder="np. Zapisy na bierzmowanie"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="wk-field">
        <span>Obszar</span>
        <AreaPick label="Obszar" value={areaId} onChange={setAreaId} areas={areas} only={usable}
          extras={[{ value: '', label: '— bez obszaru —' }]} />
      </label>

      <p className="wk-hint">Obszar to klucz — pod nim będą leżały dane tego modułu.</p>

      {takesEntries(kind) && (
        <label className="wk-field">
          <span>Czyj to formularz</span>
          <select value={forKind} onChange={(e) => setForKind(e.target.value as Subject)}>
            {SUBJECTS.map((one) => (
              <option key={one} value={one}>{SUBJECT_LABEL[one]}</option>
            ))}
          </select>
        </label>
      )}

      {blocker !== null && !busy && <p className="wk-blocker">{blocker}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={blocker !== null}>
          Załóż i otwórz
        </button>
      </div>
    </form>
  );
}

export default Modules;
