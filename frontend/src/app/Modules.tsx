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

import { useCallback, useEffect, useState } from 'react';

import { loadAreas, type AreaRow } from './area';
import { useCrumbs, type Crumb } from './crumbTrail';
import { FormOffice } from './FormOffice';
import { newId } from './ids';
import {
  createModule, loadModules, readConfig, removeModule, SUBJECT_LABEL, SUBJECTS,
  updateModule, type Subject, type ModuleRow
} from './module';
import { setPartConfig } from './form';
import { PARTS, partLabel, partOf, takesEntries } from './parts/registry';
import { viewPath } from './routes';
import { WorkspaceError, type Who } from './session';

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

  const ofKind = all.filter((one) => one.kind === view.kind);

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
                  {one.areaName !== null
                    ? <span className="wk-tag">{one.areaName}</span>
                    : <span className="wk-tag">bez obszaru</span>}

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
      <ModulePage module={mine} areas={areas} who={who} busy={busy !== null} onAct={act} />
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
function ModulePage({ module: row, areas, who, busy, onAct }: {
  module: ModuleRow;
  areas: readonly AreaRow[];
  who: Who;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(row.name);
  const [areaId, setAreaId] = useState(row.areaId ?? '');
  const [forKind, setForKind] = useState<Subject>(row.forKind);

  useEffect(() => {
    setName(row.name);
    setAreaId(row.areaId ?? '');
    setForKind(row.forKind);
  }, [row.moduleId, row.name, row.areaId, row.forKind]);

  /* Umziehen geht nur, solange nichts darunter liegt — der Dienst kann nicht
     umschlüsseln. Das gehört VOR den Knopf, nicht in die Absage danach. */
  const carries = row.fields > 0 || row.entries > 0;

  /* Wovon er handelt, steht fest, sobald etwas eingegangen ist. */
  const asks = takesEntries(row.kind);

  const changed =
    name.trim() !== row.name
    || areaId !== (row.areaId ?? '')
    || forKind !== row.forKind;

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

      <section className="wk-form">
        <label className="wk-field">
          <span>Nazwa</span>
          <input value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="wk-field">
          <span>Obszar</span>
          <select
            value={areaId}
            disabled={busy || carries}
            onChange={(e) => setAreaId(e.target.value)}
          >
            <option value="">— bez obszaru —</option>
            {areas.map((a) => <option key={a.areaId} value={a.areaId}>{a.name}</option>)}
          </select>
        </label>

        {asks && (
          <label className="wk-field">
            <span>Czyj to formularz</span>
            <select
              value={forKind}
              disabled={busy || row.entries > 0}
              onChange={(e) => setForKind(e.target.value as Subject)}
            >
              {SUBJECTS.map((one) => (
                <option key={one} value={one}>{SUBJECT_LABEL[one]}</option>
              ))}
            </select>
          </label>
        )}

        {carries && (
          <p className="wk-hint">
            Ten moduł ma już dane — obszaru nie da się zmienić. To, co
            zapieczętowano starym kluczem, zostaje pod nim.
          </p>
        )}

        <div className="wk-actions">
          {changed && (
            <button
              type="button" className="wk-btn" disabled={busy || name.trim() === ''}
              onClick={() => void onAct('Zapisywanie…', () => updateModule(row.moduleId, {
                name: name.trim(),
                ...(forKind === row.forKind ? {} : { forKind }),
                ...(areaId === '' ? (row.areaId === null ? {} : { clearArea: true }) : { areaId })
              }))}
            >
              Zapisz
            </button>
          )}

          {/* Löschen nur, wenn nichts daran hängt — der Dienst lehnt es sonst
              ab, und ein Knopf, der absagt, ist schlimmer als keiner. */}
          {row.usedOnPages === 0 && row.entries === 0 && (
            <button
              type="button" className="wk-link-btn" disabled={busy}
              onClick={() => void onAct('Usuwanie…', () => removeModule(row.moduleId))
                .then(() => { window.location.hash = viewPath('modules', row.kind); })}
            >
              Usuń moduł
            </button>
          )}
        </div>
      </section>

      {/* -- Und was seine Art ausmacht -------------------------------------- */}

      {row.kind === 'form'
        ? (
          <FormOffice
            partId={row.moduleId}
            config={readConfig(row.config)}
            who={who}
            standsOn={row.pages}
          />
        )
        : <Content module={row} busy={busy} />}
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

  useEffect(() => { setConfig(readConfig(row.config)); }, [row.moduleId, row.config]);

  if (def === undefined || def.fields.length === 0) {
    return (
      <p className="wk-hint">
        Ten rodzaj nie ma własnych ustawień — wszystko, co pokazuje, bierze się
        skądinąd.
      </p>
    );
  }

  const save = async (key: string, value: string) => {
    setFailed(null);

    try {
      const done = await setPartConfig(row.moduleId, { [key]: value });
      setConfig(done.config);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    }
  };

  return (
    <section className="wk-form">
      <h2 className="wk-h2">Treść</h2>

      {def.fields.map((field) => {
        const value = config[field.key] ?? '';

        return (
          <label className="wk-field" key={field.key}>
            <span>{field.label}</span>

            {field.kind === 'line' ? (
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
            )}
          </label>
        );
      })}

      {failed !== null && <p className="wk-error">{failed}</p>}
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
          {usable.map((a) => <option key={a.areaId} value={a.areaId}>{a.name}</option>)}
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
