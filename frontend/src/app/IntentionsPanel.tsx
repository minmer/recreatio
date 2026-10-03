/**
 * DIE INTENTIONEN EINER MESSE — im Kalender, dort, wo die Messe steht (0079).
 *
 * <b>Vorher stand dort nur ein Verweis</b>: „Msze i spowiedzi zmienia się w
 * Msze i intencje". Wer im Kalender die Sonntagsmesse aufschlug, sah weder, was
 * gelesen wird, noch konnte er etwas dazuschreiben — für beides musste er die
 * Ansicht wechseln und dieselbe Messe dort noch einmal suchen.
 *
 * <b>Hier steht, was für DIESES Vorkommen gelesen wird</b>, und wer darf,
 * schreibt eine dazu. Alles Weitere — Reihenfolge, Zelebrant, Geber und Gabe,
 * verlegen — bleibt in „Msze i intencje", und der Link führt genau zu dieser
 * Messe, nicht an den Anfang der Liste.
 */

import { useCallback, useEffect, useState } from 'react';

import { sameInstant } from './calendarBookings';
import {
  addIntention, dayKey, INTENTION_STATUS_LABEL, KIND_LABEL, loadOffice,
  type IntentionKind, type OfficeMass
} from './mass';
import { viewPath } from './routes';
import { WorkspaceError } from './session';

export function IntentionsPanel({ calendarId, itemId, occurrenceAt, start, editable }: {
  calendarId: string;
  itemId: string;
  /** Der ursprüngliche Beginn — die Adresse der Intentionen. */
  occurrenceAt: string;
  /** Wann sie wirklich ist (bei einer verlegten Messe eine andere Zeit). */
  start: Date;
  editable: boolean;
}) {
  const [mass, setMass] = useState<OfficeMass | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<IntentionKind>('single');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const found = await loadOffice(calendarId, new Date(start.getTime() - 60_000), new Date(start.getTime() + 60_000));
      setMass(found.masses.find((m) => m.itemId === itemId && sameInstant(m.occurrenceAt, occurrenceAt)) ?? null);
    } catch {
      setMass(null);
    }
  }, [calendarId, itemId, occurrenceAt, start]);

  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    const value = text.trim();
    if (value === '') return;
    setBusy(true);
    setFailed(null);
    try {
      await addIntention(itemId, occurrenceAt, { text: value, kind });
      setText('');
      await load();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać intencji.');
    } finally {
      setBusy(false);
    }
  };

  const list = mass?.intentions ?? [];
  const live = list.filter((one) => one.status !== 'cancelled');
  const office = viewPath('masses', calendarId, dayKey(start.toISOString()), itemId);

  return (
    <section className="wk-ev-ints" aria-label="Intencje">
      <h3 className="wk-ev-ints-head">
        Intencje{live.length > 0 && <span className="wk-row-side"> · {live.length}</span>}
      </h3>

      {mass === undefined ? (
        <p className="wk-hint">Wczytywanie intencji…</p>
      ) : list.length === 0 ? (
        <p className="wk-empty">Bez intencji.</p>
      ) : (
        <ol className="wk-ev-ints-list">
          {list.map((one) => (
            <li key={one.intentionId} className={one.status === 'cancelled' ? 'is-cancelled' : undefined}>
              <span>{one.text}</span>
              <span className="wk-row-side">
                {' '}{KIND_LABEL[one.kind as IntentionKind] ?? one.kind}
                {one.status !== 'accepted' && ` · ${INTENTION_STATUS_LABEL[one.status] ?? one.status}`}
              </span>
            </li>
          ))}
        </ol>
      )}

      {editable && mass !== null && mass !== undefined && mass.status !== 'cancelled' && (
        <div className="wk-ev-ints-add">
          <input
            value={text} maxLength={400} disabled={busy} placeholder="Nowa intencja, np. Za śp. Jana Kowalskiego"
            aria-label="Nowa intencja"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }}
          />
          <select value={kind} disabled={busy} aria-label="Rodzaj intencji" onChange={(e) => setKind(e.target.value as IntentionKind)}>
            <option value="single">{KIND_LABEL.single}</option>
            <option value="collective">{KIND_LABEL.collective}</option>
          </select>
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || text.trim() === ''} onClick={() => void add()}>
            Dodaj
          </button>
        </div>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}

      <p className="wk-hint">
        <a className="wk-link" href={office}>Otwórz w „Msze i nabożeństwa"</a> — kolejność, kto odprawia, ofiarodawca, przeniesienie.
      </p>
    </section>
  );
}

export default IntentionsPanel;
