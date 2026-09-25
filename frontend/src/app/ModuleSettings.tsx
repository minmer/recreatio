/**
 * Was ein Baustein IST — Name, Bereich, wessen Formular.
 *
 * <b>Eine eigene Datei, weil zwei Stellen sie brauchen:</b> die Seite eines
 * Bausteins zeigt sie über seinem Inhalt, ein Formular im ersten Reiter
 * („Ustawienia"), zusammen mit allem anderen, was das Formular als GANZES
 * betrifft.
 *
 * <b>Den Bereich eines Formulars zu wechseln geht jetzt</b> (0042). Seine
 * Fragen liegen unter dem Schlüssel dieses Bereichs; wer wechselt, lässt den
 * Browser jede Frage neu versiegeln (`reseal`), und der Dienst nimmt den
 * Wechsel nur mit ALLEN neuen Hüllen an. Die Antworten ziehen nicht mit — sie
 * gehören dem Bereich ihrer Frage, nicht dem des Formulars.
 */

import { useEffect, useState } from 'react';

import type { AreaRow } from './area';
import { AreaOptions } from './AreaOptions';
import { removeModule, SUBJECT_LABEL, SUBJECTS, updateModule, type ModuleRow, type Resealed, type Subject } from './module';
import { takesEntries } from './parts/registry';
import { viewPath } from './routes';

export function ModuleSettings({ row, areas, busy, onAct, reseal }: {
  row: ModuleRow;
  areas: readonly AreaRow[];
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;

  /**
   * Die Fragen und der Aufbau, unter dem Schlüssel des NEUEN Bereichs
   * versiegelt — nur ein Formular kann das. Fehlt es, bleibt der Bereich fest,
   * sobald etwas daran hängt: dann gibt es niemanden, der umschlüsseln könnte.
   */
  reseal?: (areaId: string) => Promise<Resealed>;
}) {
  const [name, setName] = useState(row.name);
  const [areaId, setAreaId] = useState(row.areaId ?? '');
  const [forKind, setForKind] = useState<Subject>(row.forKind);

  useEffect(() => {
    setName(row.name);
    setAreaId(row.areaId ?? '');
    setForKind(row.forKind);
  }, [row.moduleId, row.name, row.areaId, row.forKind]);

  /* Hängt etwas daran? Dann zieht es nur um, wer es neu versiegeln kann. */
  const carries = row.fields > 0 || row.entries > 0;
  const movable = !carries || reseal !== undefined;

  /* Wovon er handelt, steht fest, sobald etwas eingegangen ist. */
  const asks = takesEntries(row.kind);

  const changed =
    name.trim() !== row.name
    || areaId !== (row.areaId ?? '')
    || forKind !== row.forKind;

  const save = () => onAct('Zapisywanie…', async () => {
    const moving = areaId !== (row.areaId ?? '');

    /*
     * Die Fragen und der Aufbau gehen neu versiegelt mit — oder der Dienst
     * lehnt ab. Gefragt wird auch ohne Fragen: ein Aufbau kann schon stehen.
     */
    const again = moving && areaId !== '' && reseal !== undefined ? await reseal(areaId) : null;

    await updateModule(row.moduleId, {
      name: name.trim(),
      ...(forKind === row.forKind ? {} : { forKind }),
      ...(areaId === '' ? (row.areaId === null ? {} : { clearArea: true }) : { areaId }),
      ...(again === null || again.fields.length === 0 ? {} : { reseal: again.fields }),
      ...(again?.design === undefined ? {} : { designSealed: again.design.sealed, designEpoch: again.design.epoch })
    });
  });

  return (
    <section className="wk-form">
      <label className="wk-field">
        <span>Nazwa</span>
        <input value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="wk-field">
        <span>{reseal !== undefined ? 'Obszar formularza' : 'Obszar'}</span>
        <select
          value={areaId}
          disabled={busy || !movable}
          onChange={(e) => setAreaId(e.target.value)}
        >
          {/* Ohne Bereich hätte eine Frage keinen Schlüssel, unter dem sie liegt. */}
          <option value="" disabled={reseal !== undefined && row.fields > 0}>— bez obszaru —</option>
          <AreaOptions areas={areas} />
        </select>
        {reseal !== undefined && (
          <span className="wk-hint">
            Pytania są zapieczętowane kluczem tego obszaru — przeczyta je każdy, kto
            czyta ten obszar. Odpowiedzi idą tam, dokąd kieruje je każde pytanie.
          </span>
        )}
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

      {!movable && (
        <p className="wk-hint">
          Ten moduł ma już dane — obszaru nie da się zmienić. To, co
          zapieczętowano starym kluczem, zostaje pod nim.
        </p>
      )}

      {movable && carries && areaId !== (row.areaId ?? '') && (
        <p className="wk-hint">
          Przy zapisie wszystkie pytania (i układ z logiką) zostaną przepieczętowane kluczem nowego
          obszaru. Zebrane odpowiedzi zostają tam, gdzie są.
        </p>
      )}

      <div className="wk-actions">
        {changed && (
          <button
            type="button" className="wk-btn" disabled={busy || name.trim() === ''}
            onClick={() => void save()}
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
  );
}

export default ModuleSettings;
