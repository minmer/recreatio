/**
 * Moduły — die Bausteine selbst, getrennt von den Seiten, die sie zeigen.
 *
 * <b>Warum eine eigene Ansicht.</b> Ein Baustein trägt Daten: ein Bogen seine
 * Fragen und Antworten, ein Messplan seine Intentionen. Die Seite zeigt ihn
 * nur. Solange beides eine Zeile war, entstand ein Baustein dadurch, dass man
 * ihn irgendwo hinstellte — und dann gab es ihn genau dort und nirgends sonst.
 * Denselben Bogen auf zwei Seiten zu hängen war unmöglich; es entstanden zwei,
 * die nur gleich aussahen.
 *
 * <b>Der Bereich entscheidet, nicht die Adresse.</b> Ein Baustein gehört in
 * einen Bereich — dort liegen seine Daten, dort liegen die Schlüssel. Wer ihn
 * pflegen darf, folgt daraus. Ein Baustein OHNE Bereich ist kein Fehler: ein
 * Text trägt nichts Versiegeltes, und für ihn entscheidet die Seite, auf der
 * er hängt.
 *
 * <b>Was ein einfacher Weg nebenbei anlegt, steht auch hier.</b> Wer im Raster
 * einen Kasten hinschiebt, legt damit einen Baustein an — einen richtigen, mit
 * Namen, der in dieser Liste auftaucht und sich umbenennen, umhängen und
 * löschen lässt. Kein stiller Sonderfall, der sich nirgends wiederfindet.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadAreas, type AreaRow } from './area';
import { newId } from './ids';
import {
  createModule, loadModules, removeModule, SUBJECT_LABEL, SUBJECTS,
  updateModule, type Subject, type ModuleRow
} from './module';
import { PARTS, partLabel, takesEntries } from './parts/registry';
import { useCrumbs } from './crumbTrail';
import { viewPath } from './routes';
import { WorkspaceError, type Who } from './session';

/**
 * Welches der beiden Bilder dasteht — AUS DER ADRESSE, wie bei den Bereichen.
 *
 * <b>`#/workspace/modules/new`.</b> Als Zustand im Speicher liess sich das
 * Anlegen nicht verschicken, ein Neuladen warf einen heraus, und der
 * Zurück-Pfeil des Browsers verliess den Arbeitsplatz statt das Formular.
 */
type View = { readonly at: 'list' } | { readonly at: 'new' };

const NEW = 'new';

export function Modules({ who: _who, trail }: { who: Who; trail: readonly string[] }) {
  const [modules, setModules] = useState<readonly ModuleRow[] | null | undefined>(undefined);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const view: View = trail[0] === NEW ? { at: NEW } : { at: 'list' };

  /* Was offen ist, steht oben im Weg — und nur das. */
  useCrumbs(view.at === NEW ? [{ label: 'Nowy moduł', href: null }] : []);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const look = useCallback(async () => {
    try {
      setModules((await loadModules()).modules);
      setAreas((await loadAreas()).areas);
      setFailed(null);
    } catch (e) {
      setModules(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać modułów.');
    }
  }, []);

  useEffect(() => { void look(); }, [look]);

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

  if (modules === undefined) return <p className="wk-lede">Wczytywanie…</p>;

  if (modules === null) {
    return (
      <>
        <p className="wk-error">{failed}</p>
        <p><button type="button" className="wk-btn" onClick={() => void look()}>Spróbuj ponownie</button></p>
      </>
    );
  }

  const head = (
    <>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-hint">{busy}</p>}
    </>
  );

  if (view.at === 'new') {
    return (
      <>
        {head}
        <NewModule
          areas={areas}
          busy={busy !== null}
          onAct={act}
          onDone={() => { window.location.hash = viewPath('modules'); }}
        />
      </>
    );
  }

  return (
    <>
      <p className="wk-lede">
        Moduł to rzecz, a nie miejsce na stronie. Dane należą do niego — strona
        tylko go pokazuje. Ten sam moduł może stać na dwóch stronach i nadal ma
        jeden komplet danych.
      </p>

      {head}

      {modules.length === 0 ? (
        <p className="wk-empty">Jeszcze żadnego modułu.</p>
      ) : (
        <ul className="wk-list">
          {modules.map((m) => (
            <ModuleRowView
              key={m.moduleId}
              module={m}
              areas={areas}
              open={open === m.moduleId}
              busy={busy !== null}
              onOpen={() => setOpen(open === m.moduleId ? null : m.moduleId)}
              onAct={act}
            />
          ))}
        </ul>
      )}

      <div className="wk-actions">
        <a className="wk-btn" href={viewPath('modules', NEW)}>Nowy moduł</a>
      </div>
    </>
  );
}

/* -- Eine Zeile ------------------------------------------------------------ */

function ModuleRowView({ module: row, areas, open, busy, onOpen, onAct }: {
  module: ModuleRow;
  areas: readonly AreaRow[];
  open: boolean;
  busy: boolean;
  onOpen: () => void;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(row.name);
  const [areaId, setAreaId] = useState(row.areaId ?? '');
  const [forKind, setForKind] = useState<Subject>(row.forKind);

  /* Umziehen geht nur, solange nichts darunter liegt — der Dienst kann nicht
     umschlüsseln. Das gehört VOR den Knopf, nicht in die Absage danach. */
  const carries = row.fields > 0 || row.entries > 0;

  /* Wovon er handelt, steht fest, sobald etwas eingegangen ist: vorhandene
     Plätze hingen sonst nachträglich an etwas anderem. */
  const asks = takesEntries(row.kind);

  return (
    <li className="wk-row">
      <span>
        <button type="button" className="wk-link-btn" onClick={onOpen}>
          <strong>{row.name}</strong>
        </button>

        <span className="wk-row-side">
          {' · '}{partLabel(row.kind)}
          {row.areaName !== null ? <> · {row.areaName}</> : <> · bez obszaru</>}
          {row.usedOnPages === 0
            ? <> · nigdzie nie stoi</>
            : <> · na {row.usedOnPages} {row.usedOnPages === 1 ? 'stronie' : 'stronach'}</>}
          {row.entries > 0 && <> · {row.entries} zgłoszeń</>}
        </span>

        {open && (
          <div className="wk-form">
            <label className="wk-field">
              <span>Nazwa</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <label className="wk-field">
              <span>Obszar</span>
              <select
                value={areaId}
                disabled={carries}
                onChange={(e) => setAreaId(e.target.value)}
              >
                <option value="">— bez obszaru —</option>
                {areas.map((a) => (
                  <option key={a.areaId} value={a.areaId}>{a.name}</option>
                ))}
              </select>
            </label>

            {asks && (
              <>
                <label className="wk-field">
                  <span>Czyj to formularz</span>
                  <select
                    value={forKind}
                    disabled={row.entries > 0}
                    onChange={(e) => setForKind(e.target.value as Subject)}
                  >
                    {SUBJECTS.map((one) => (
                      <option key={one} value={one}>{SUBJECT_LABEL[one]}</option>
                    ))}
                  </select>
                </label>

                <p className="wk-hint">
                  {row.entries > 0
                    ? 'Są już zgłoszenia — tego, kogo dotyczy, nie da się zmienić: '
                      + 'miejsca, które powstały, wiszą przy tym, co wtedy wybrano.'
                    : 'Zgłoszenie tworzy miejsce, a miejsce musi do kogoś należeć. '
                      + 'Tu stoi, do kogo — i stąd bierze się to, co formularz '
                      + 'podpowie zalogowanemu.'}
                </p>
              </>
            )}

            {carries ? (
              <p className="wk-hint">
                Ten moduł ma już dane — obszaru nie da się zmienić. To, co
                zapieczętowano starym kluczem, zostaje pod nim: usługa nie ma
                czym tego przełożyć.
              </p>
            ) : row.usedOnPages === 0 && row.areaId !== null ? (
              <p className="wk-hint">
                Nie stoi na żadnej stronie — gdybyś zdjął mu obszar, nikt nie
                mógłby go już tknąć. Najpierw postaw go gdzieś.
              </p>
            ) : (
              <p className="wk-hint">
                Obszar decyduje, kto może tu pisać i czytać. Bez obszaru
                decyduje strona, na której moduł stoi.
              </p>
            )}

            <div className="wk-actions">
              {(name.trim() !== row.name || areaId !== (row.areaId ?? '')
                || forKind !== row.forKind) && (
                <button
                  type="button" className="wk-btn" disabled={busy || name.trim() === ''}
                  onClick={() => void onAct('Zapisywanie…', () => updateModule(row.moduleId, {
                    name: name.trim(),
                    ...(forKind === row.forKind ? {} : { forKind }),
                    ...(areaId === ''
                      ? (row.areaId === null ? {} : { clearArea: true })
                      : { areaId })
                  }))}
                >
                  Zapisz
                </button>
              )}

              {/*
                LÖSCHEN NUR, WENN NICHTS DARAN HÄNGT. Der Dienst lehnt es sonst
                ab; hier steht der Knopf erst gar nicht, damit niemand eine
                Absage für einen Defekt hält.
              */}
              {row.usedOnPages === 0 && row.entries === 0 && (
                <button
                  type="button" className="wk-link-btn" disabled={busy}
                  onClick={() => void onAct('Usuwanie…', () => removeModule(row.moduleId))}
                >
                  Usuń moduł
                </button>
              )}
            </div>
          </div>
        )}
      </span>
    </li>
  );
}

/* -- Anlegen --------------------------------------------------------------- */

function NewModule({ areas, busy, onAct, onDone }: {
  areas: readonly AreaRow[];
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
  onDone: () => void;
}) {
  const [kind, setKind] = useState(PARTS[0]?.kind ?? 'text');
  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState('');
  const [forKind, setForKind] = useState<Subject>('person');

  /* Hineinlegen darf man nur, wo man schreiben darf — der Dienst verlangt es,
     und eine Auswahl, die mehr anböte, endete in einer Absage. */
  const usable = areas.filter((a) => a.myLevel === 'admin' || a.myLevel === 'write');

  const blocker =
    busy ? null
    : name.trim() === '' ? 'Nazwij moduł.'
    : null;

  return (
    <form
      className="wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (blocker !== null) return;

        void onAct('Zakładanie modułu…',
          () => createModule(
            newId(), kind, name.trim(), areaId === '' ? null : areaId,
            takesEntries(kind) ? forKind : 'none'))
          .then(onDone);
      }}
    >
      <h1 className="wk-h1">Nowy moduł</h1>

      <label className="wk-field">
        <span>Rodzaj</span>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {PARTS.map((c) => (
            <option key={c.kind} value={c.kind}>{c.label}</option>
          ))}
        </select>
      </label>

      <label className="wk-field">
        <span>Nazwa</span>
        <input
          value={name}
          placeholder="np. Zapisy na bierzmowanie"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <p className="wk-hint">
        Po nazwie go znajdziesz, kiedy będziesz go stawiał na stronie.
      </p>

      {/*
        NUR, WO ES ETWAS HEISST. Ein Aushangtext handelt von niemandem; die
        Auswahl dort hinzustellen hiesse, nach etwas zu fragen, dessen einzige
        richtige Antwort „keine" ist.
      */}
      {takesEntries(kind) && (
        <>
          <label className="wk-field">
            <span>Czyj to formularz</span>
            <select value={forKind} onChange={(e) => setForKind(e.target.value as Subject)}>
              {SUBJECTS.map((one) => (
                <option key={one} value={one}>{SUBJECT_LABEL[one]}</option>
              ))}
            </select>
          </label>

          <p className="wk-hint">
            Zgłoszenie tworzy miejsce, a miejsce musi do kogoś należeć — do
            osoby, do grupy albo do roli. Zalogowanemu formularz podpowie stąd
            jego dane, raz wpisane i wspólne dla wszystkich formularzy.
          </p>
        </>
      )}

      <label className="wk-field">
        <span>Obszar</span>
        <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">— bez obszaru —</option>
          {usable.map((a) => (
            <option key={a.areaId} value={a.areaId}>{a.name}</option>
          ))}
        </select>
      </label>

      <p className="wk-hint">
        Obszar to klucz — pod nim będą leżały dane tego modułu, i on decyduje,
        kto je otworzy. Tekst na gablocie żadnego nie potrzebuje: jego treść i
        tak stoi otworem.
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

export default Modules;
