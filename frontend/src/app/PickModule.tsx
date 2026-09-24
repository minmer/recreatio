/**
 * WELCHEN Bogen diese Stelle zeigt — auswählen oder anlegen.
 *
 * <b>Hier standen die Fragen selbst.</b> Wer ein Formular auf eine Seite legte,
 * stellte sie im Seiteneditor — und legte denselben Bogen auf eine zweite
 * Seite, stellte sie dort noch einmal. Zwei Sätze Fragen, zwei Sätze Antworten,
 * ein Name: „derselbe Bogen" war nur ein Wort.
 *
 * <b>Ein Bogen ist ein DING</b> (0036). Er gehört einem Bereich, nicht einer
 * Seite; die Seite zeigt ihn. Deshalb wird hier nur gewählt, WELCHER — und
 * gefragt wird beim Baustein.
 *
 * <b>Wer einen neuen anlegt, landet sofort dort, wo man ihn füllt.</b> Ein
 * frisch angelegter Bogen ohne Fragen ist die Hälfte eines Handgriffs; ihn
 * danach in einer anderen Ansicht wiederzusuchen ist die schlechtere Hälfte.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadAreas, type AreaRow } from './area';
import { newId } from './ids';
import { createModule, loadModules, type ModuleRow } from './module';
import { WorkspaceError } from './session';

export function PickModule({ kind, chosen, busy, onPick, onMade }: {
  /** Die Art, die hier steht — nur Bausteine derselben passen an diese Stelle. */
  kind: string;

  /** `null` heisst: diese Stelle zeigt noch keinen. */
  chosen: string | null;

  busy: boolean;
  onPick: (moduleId: string) => void;

  /**
   * Angelegt — und zwar mit der Bitte, ihn gleich aufzuschlagen.
   *
   * Getrennt von `onPick`, weil es zwei verschiedene Dinge sind: das eine
   * wechselt, was hier steht, das andere wechselt die ANSICHT.
   */
  onMade: (moduleId: string) => void;
}) {
  const [modules, setModules] = useState<readonly ModuleRow[] | null>(null);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState('');
  const [making, setMaking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const look = useCallback(async () => {
    try {
      setModules((await loadModules()).modules);
      setAreas((await loadAreas()).areas);
    } catch {
      setModules([]);
    }
  }, []);

  useEffect(() => { void look(); }, [look]);

  /* Nur Bausteine DERSELBEN Art. Ein Messplan an der Stelle eines Bogens wäre
     eine Kachel, die etwas anderes zeigt, als die Seite sagt. */
  const fitting = (modules ?? []).filter((one) => one.kind === kind);

  /* Hineinlegen darf man nur, wo man schreiben darf — der Dienst verlangt es. */
  const usable = areas.filter((a) => a.myLevel === 'admin' || a.myLevel === 'write');

  const make = async () => {
    setMaking(true);
    setFailed(null);

    try {
      const moduleId = newId();
      await createModule(moduleId, kind, name.trim(), areaId === '' ? null : areaId, 'person');

      setName('');
      await look();
      onMade(moduleId);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się założyć.');
    } finally {
      setMaking(false);
    }
  };

  if (modules === null) return <p className="pb-empty">Wczytywanie modułów…</p>;

  return (
    <section className="pb-fields">
      <label className="wk-field">
        <span>Który formularz</span>
        <select
          value={chosen ?? ''}
          disabled={busy || making}
          onChange={(e) => { if (e.target.value !== '') onPick(e.target.value); }}
        >
          <option value="">— wybierz —</option>
          {fitting.map((one) => (
            <option key={one.moduleId} value={one.moduleId}>
              {one.name}
              {one.areaName !== null && ` · ${one.areaName}`}
              {one.entries > 0 && ` · ${one.entries} zgł.`}
            </option>
          ))}
        </select>
      </label>

      {/*
        DERSELBE BOGEN AUF ZWEI SEITEN ist kein Sonderfall, sondern der Grund,
        warum hier gewählt wird: ein Satz Fragen, ein Satz Antworten, zwei
        Stellen, an denen er steht.
      */}
      {chosen !== null && fitting.some((one) => one.moduleId === chosen) && (
        <p className="wk-hint">
          Pytania i zgłoszenia należą do modułu — otwórz go, żeby je ułożyć.
        </p>
      )}

      <details className="pb-new">
        <summary>Albo załóż nowy</summary>

        <label className="wk-field">
          <span>Nazwa</span>
          <input
            value={name}
            placeholder="np. Zapisy na bierzmowanie"
            disabled={busy || making}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="wk-field">
          <span>Obszar</span>
          <select
            value={areaId}
            disabled={busy || making}
            onChange={(e) => setAreaId(e.target.value)}
          >
            <option value="">— bez obszaru —</option>
            {usable.map((a) => (
              <option key={a.areaId} value={a.areaId}>{a.name}</option>
            ))}
          </select>
        </label>

        <p className="wk-hint">Obszar to klucz — pod nim będą leżały odpowiedzi.</p>

        {failed !== null && <p className="wk-error">{failed}</p>}

        <div className="wk-actions">
          <button
            type="button"
            className="wk-btn"
            disabled={busy || making || name.trim() === ''}
            onClick={() => void make()}
          >
            {making ? 'Zakładanie…' : 'Załóż i otwórz'}
          </button>
        </div>
      </details>
    </section>
  );
}

export default PickModule;
