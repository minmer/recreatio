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

import { useCallback, useEffect, useRef, useState } from 'react';

import { areaPath, loadAreas, type AreaRow } from './area';
import { useCrumbs, type Crumb } from './crumbTrail';
import { FormOffice } from './FormOffice';
import { newId } from './ids';
import {
  createModule, loadModules, readConfig, removeModule, SUBJECT_LABEL, SUBJECTS, type Subject, type ModuleRow
} from './module';
import { setPartConfig } from './form';
import { PARTS, partLabel, partOf, takesEntries } from './parts/registry';
import { PickChat } from './PickChat';
import { PickForm, PickQuestions, pickedForm } from './FormPick';
import { PickResource } from './PickResource';
import { viewPath } from './routes';
import { WorkspaceError, type Who } from './session';
import { AreaOptions } from './AreaOptions';
import { ModuleSettings } from './ModuleSettings';
import { useRecent } from './prefs';
import { RecentRow, useTouched } from './Recent';

const NEW = 'new';

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

export function Modules({ who, trail }: { who: Who; trail: readonly string[] }) {
  const [modules, setModules] = useState<readonly ModuleRow[] | null>(null);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const view = viewOf(trail);

  /* 0054 — zuletzt benutzte Bausteine zuerst, gemerkt versiegelt. */
  useTouched('modules', view.at === 'one' ? view.moduleId : null);
  const recent = useRecent('modules');

  const look = useCallback(async () => {
    try {
      setModules((await loadModules()).modules);
      setAreas((await loadAreas()).areas);
      setFailed(null);
    } catch (e) {
      setModules([]);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać modułów.');
    }
  }, []);

  useEffect(() => { void look(); }, [look]);

  const all = modules ?? [];
  /* Der aufgeschlagene Baustein — nur dann, wenn einer aufgeschlagen ist.
     Frisch aus der Liste geholt: nach einer Änderung stünde sonst der alte
     Stand da, und man sähe seine eigene Änderung nicht. */
  const mine = view.at === 'one'
    ? all.find((one) => one.moduleId === view.moduleId)
    : undefined;

  /* -- Der Weg oben im Kopf ------------------------------------------------ */

  const crumbs: Crumb[] = view.at === 'kinds' ? [] : [
    {
      label: partLabel(view.kind),
      href: viewPath('modules', view.kind),

      /* Von einer Art zur nächsten, ohne den Umweg über die Liste darüber. */
      beside: PARTS
        .filter((one) => one.kind !== view.kind)
        .map((one) => ({ label: one.label, href: viewPath('modules', one.kind) }))
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

  if (modules === null) return <p className="wk-empty">Wczytywanie…</p>;

  const head = (
    <>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-working">{busy}</p>}
    </>
  );

  /* -- 1. Die Arten -------------------------------------------------------- */

  if (view.at === 'kinds') {
    return (
      <>
        {head}

        <RecentRow scope="modules" items={all.map((m) => ({ id: m.moduleId, label: `${m.name} · ${partLabel(m.kind)}`, href: viewPath('modules', m.kind, m.moduleId) }))} />

        <Unused modules={all} busy={busy !== null} onAct={act} />

        <ul className="wk-tree">
          {PARTS.map((one) => {
            const count = all.filter((m) => m.kind === one.kind).length;

            return (
              <li key={one.kind}>
                <a className="wk-tree-row" href={viewPath('modules', one.kind)}>
                  <span className="wk-tree-name">{one.label}</span>
                  <span className="wk-tags"><span className="wk-tag">{one.use}</span></span>
                  <span className="wk-tree-mine">
                    {count === 0 ? 'nie ma' : count === 1 ? '1' : count}
                  </span>
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
              <a className="wk-tree-row" href={viewPath('modules', view.kind, one.moduleId)}>
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
            <a className="wk-tree-add" href={viewPath('modules', view.kind, NEW)}>
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
            window.location.hash = viewPath('modules', view.kind, moduleId);
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
      <ModulePage module={mine} areas={areas} who={who} busy={busy !== null} onAct={act} onReload={look} />
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
function ModulePage({ module: row, areas, who, busy, onAct, onReload }: {
  module: ModuleRow;
  areas: readonly AreaRow[];
  who: Who;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  return (
    <>
      <h1 className="wk-h1">{row.name}</h1>

      <dl className="wk-facts">
        <div className="wk-fact">
          <dt>Rodzaj</dt>
          <dd>{partLabel(row.kind)}</dd>
        </div>

        <div className="wk-fact">
          <dt>Na stronach</dt>
          <dd>{row.usedOnPages}</dd>
        </div>

        {row.entries > 0 && (
          <div className="wk-fact">
            <dt>Zgłoszeń</dt>
            <dd>{row.entries}</dd>
          </div>
        )}
      </dl>

      {/* -- Was er ist ----------------------------------------------------- */}

      {row.kind === 'form' ? (
        /*
         * Ein Formular hat Reiter (`FormOffice`), und seine Einstellungen
         * gehören in den ersten — zum Einrichten, nicht über alle drei.
         */
        <FormOffice
          partId={row.moduleId}
          config={readConfig(row.config)}
          who={who}
          standsOn={row.pages}
          module={row}
          onModuleChanged={onReload}
        />
      ) : (
        <>
          <ModuleSettings row={row} areas={areas} busy={busy} onAct={onAct} />
          <Content module={row} busy={busy} />
        </>
      )}
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
        <Editor raw={config} onSet={queue} busy={busy} ctx={{ path: row.pages[0] ?? null }} />
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
        ) : field.kind === 'resource' ? (
          <PickResource
            value={value}
            busy={busy}
            onPick={(id) => { setConfig({ ...config, [field.key]: id }); void save(field.key, id); }}
          />
        ) : field.kind === 'form' ? (
          <PickForm value={value} busy={busy} onPick={(id) => void saveMany(pickedForm(def, field.key, id))} />
        ) : field.kind === 'questions' ? (
          <PickQuestions
            formId={config[field.of ?? ''] ?? ''}
            value={value}
            busy={busy}
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
        return field.kind === 'questions' || field.kind === 'form' ? (
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
        <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">— bez obszaru —</option>
          <AreaOptions areas={areas} only={usable} />
        </select>
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
