/**
 * 2026-10-29 — „IMPORT I EKSPORT (JSON)" DER KANZLEI: Messen und Intentionen
 * eines Zeitraums als ein Dokument (`massesJson.ts`, "recreatio/masses").
 *
 * <b>Der Hauptweg ist die Księga intencji.</b> Der Export eines Monats hat
 * jede Messe mit "free": true oder ihren Intentionen; der Auftrag für die
 * eigene KI („Skopiuj prompt dla AI") legt ihn neben die Beschreibung, und was
 * zurückkommt, steht hier erst als Plan — welche Messe an welchem Tag welche
 * Intention bekommt, mit jedem Konflikt —, dann erst wird gespeichert.
 *
 * <b>Geladen wird, was das Dokument nennt</b>: seine Tage und Kalender, sobald
 * es eingefügt ist (wie im JSON eines Bereichs die Seiten). Bis dahin sagt der
 * Plan „Sprawdzanie…".
 *
 * Exportieren darf, wer den Kalender sieht; importieren nur, wer darin
 * schreibt — sonst sagt es der Plan, und der Knopf erscheint nicht.
 */

import { useRef, useState } from 'react';

import type { AreaRow } from '../areas/area';
import type { CalendarRow } from '../calendar/calendar';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import { loadMassesState, runMassesImport, type LoadedMasses } from './massesImport';
import {
  addDays, coversNeeds, dayOfDate, daysBetween, exportMasses, MASSES_JSON, MAX_DAYS, massesPrompt, type MassesNeeds, type MassesOptions,
  type MassesPlan, needsOf, planMasses, readDay, readMassesDocument
} from './massesJson';

interface Analysis {
  readonly plan: MassesPlan;
  readonly loaded: LoadedMasses;
  readonly preview: JsonPreview;
}

export function MassesJsonPanel({ me, calendars, areas, chosen, day, onChanged }: {
  /** `null`: ohne Schlüssel in diesem Tab — Export ohne Versiegeltes, kein Import. */
  me: Me | null;
  /** Die Terminarze der Kanzlei (ohne archivierte). */
  calendars: readonly CalendarRow[];
  areas: readonly AreaRow[];
  /** Der oben gewählte Kalender: Ziel eines Dokuments ohne "calendar", Quelle des Exports. */
  chosen: string;
  /** Der Tag, an dem die Kanzlei gerade steht — der Export beginnt dort. */
  day: string;
  onChanged: () => void;
}) {
  const [from, setFrom] = useState(day);
  const [to, setTo] = useState(() => addDays(day, 30));
  const [loaded, setLoaded] = useState<LoadedMasses | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<MassesOptions['conflicts']>('skip');
  const [note, setNote] = useState<string | null>(null);
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptText, setPromptText] = useState<string | null>(null);
  const calendar = calendars.find((c) => c.calendarId === chosen);
  const calendarWord = calendar === undefined ? '…' : `${calendar.areaName}${calendar.title !== calendar.areaName ? ` (${calendar.title})` : ''}`;

  /* -- Was ein Dokument braucht, wird geladen, sobald es eingefügt ist ------------------------ */
  const requested = useRef<string | null>(null);
  const want = (needs: MassesNeeds) => {
    if (loaded !== null && coversNeeds(loaded.state, needs)) return;
    /* Zusammen mit dem, was schon da ist — solange der Zeitraum nicht zu lang wird. */
    const merged: MassesNeeds = loaded === null ? needs : {
      calendars: [...new Set([...loaded.state.loaded, ...needs.calendars])],
      from: loaded.state.from < needs.from ? loaded.state.from : needs.from,
      to: loaded.state.to > needs.to ? loaded.state.to : needs.to
    };
    const wanted = daysBetween(merged.from, merged.to) <= MAX_DAYS ? merged : needs;
    const key = JSON.stringify(wanted);
    if (requested.current === key) return;
    requested.current = key;
    window.setTimeout(() => {
      setFailed(null);
      void loadMassesState({ me, calendars, areas, chosen, calendarIds: wanted.calendars, from: wanted.from, to: wanted.to })
        .then((got) => { setLoaded(got); setFailed(null); })
        .catch((e) => setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się odczytać mszy z tego okresu.'));
    }, 0);
  };

  /* -- Der Plan zu einem Dokument (einmal je Zeichnen, für Vorschau, Einstellungen und Import) ---- */
  const cache = useRef<{ value: unknown; deps: readonly unknown[]; result: Analysis | { error: string } } | null>(null);
  const deps: readonly unknown[] = [loaded, failed, conflicts, chosen, me];
  const analyse = (value: unknown): Analysis | { error: string } => {
    const known = cache.current;
    if (known !== null && known.value === value && known.deps.every((d, i) => d === deps[i])) return known.result;
    const result = compute(value);
    cache.current = { value, deps, result };
    return result;
  };

  function compute(value: unknown): Analysis | { error: string } {
    const read = readMassesDocument(value);
    if ('error' in read) return read;
    if (me === null) return { error: 'Bez kluczy w tej karcie nie da się importować — zaloguj się ponownie.' };
    const rows = calendars.map((c) => ({ calendarId: c.calendarId, title: c.title, areaName: c.areaName, mayWrite: c.mayWrite !== false }));
    const needs = needsOf(read.doc, rows, chosen, dayOfDate(new Date()), loaded?.state.series);
    if ('error' in needs) return needs;
    want(needs);
    if (failed !== null) return { error: failed };
    if (loaded === null || !coversNeeds(loaded.state, needs)) return { error: 'Sprawdzanie mszy z tego okresu…' };
    const plan = planMasses(read.doc, loaded.state, { conflicts });
    if ('error' in plan) return plan;
    return { plan, loaded, preview: { lines: plan.lines, warnings: [...read.warnings, ...plan.warnings] } };
  }

  const preview = (value: unknown): JsonPreview | { error: string } => {
    const done = analyse(value);
    return 'error' in done ? done : done.preview;
  };

  const run = async (value: unknown, stage: (what: string) => void): Promise<JsonPreview> => {
    if (me === null) throw new WorkspaceError('Bez kluczy w tej karcie nie da się importować — zaloguj się ponownie.');
    const done = analyse(value);
    if ('error' in done) throw new WorkspaceError(done.error);
    if (done.plan.empty) return { lines: ['Nic do zmiany — wszystko z dokumentu już jest w kalendarzu.'], warnings: done.preview.warnings };
    try {
      return await runMassesImport({ me, plan: done.plan, loaded: done.loaded, calendars, stage });
    } finally {
      /* Was jetzt im Kalender steht, liest der nächste Plan neu. */
      requested.current = null;
      cache.current = null;
      setLoaded(null);
      onChanged();
    }
  };

  /* -- Export: der gewählte Kalender im gewählten Zeitraum ------------------------------------- */
  const rangeProblem = (() => {
    const a = readDay(from);
    const b = readDay(to);
    if (a === null || b === null) return 'Podaj oba dni okresu.';
    if (b < a) return 'Koniec okresu jest przed początkiem.';
    if (daysBetween(a, b) > MAX_DAYS) return `Najwyżej ${MAX_DAYS} dni naraz.`;
    return null;
  })();

  const exportDoc = async (): Promise<Record<string, unknown>> => {
    if (rangeProblem !== null) throw new WorkspaceError(rangeProblem);
    if (calendar === undefined) throw new WorkspaceError('Wybierz u góry kalendarz.');
    const got = await loadMassesState({ me, calendars, areas, chosen, calendarIds: [chosen], from, to });
    setLoaded(got);
    setNote(me === null
      ? 'Bez kluczy w tej karcie eksport nie ma ofiarodawców, ofiar, miejsc ani imion osób.'
      : got.unreadable > 0 ? `${got.unreadable} pól (ofiarodawca, ofiara) nie da się tu odczytać — w eksporcie ich nie ma.` : null);
    return exportMasses(got.state, chosen, from, to);
  };

  const copyPrompt = async () => {
    setPromptBusy(true);
    setPromptText(null);
    try {
      const text = massesPrompt(await exportDoc());
      try {
        await navigator.clipboard.writeText(text);
        setNote('Skopiowano — wklej do swojej rozmowy z AI razem ze zdjęciami księgi; odpowiedź wklej niżej w „Import”.');
      } catch {
        setPromptText(text);
        setNote('Schowek nie przyjął tekstu — zaznacz go niżej i skopiuj.');
      }
    } catch (e) {
      setNote(e instanceof WorkspaceError ? e.message : 'Nie udało się przygotować promptu.');
    } finally {
      setPromptBusy(false);
    }
  };

  const fileName = `msze-${(calendar?.areaName ?? 'kalendarz').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'kalendarz'}-${from}.json`;

  return (
    <>
      <section className="wk-form" aria-label="Okres eksportu">
        <div className="wk-mo-top">
          <label className="wk-field">
            <span>Od</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="wk-field">
            <span>Do</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className="wk-btn wk-btn-line" disabled={promptBusy || rangeProblem !== null} onClick={() => void copyPrompt()}>
            {promptBusy ? 'Przygotowywanie…' : 'Skopiuj prompt dla AI (księga intencji)'}
          </button>
        </div>
        {rangeProblem !== null && <p className="wk-error">{rangeProblem}</p>}
        {note !== null && <p className="wk-note" role="status">{note}</p>}
        {promptText !== null && (
          <textarea className="wk-json-text" readOnly rows={6} value={promptText} aria-label="Prompt dla AI" onFocus={(e) => e.currentTarget.select()} />
        )}
      </section>

      <JsonPanel
        summary="Msze i intencje jako JSON"
        lead={<>
          Msze, nabożeństwa i spowiedź kalendarza „{calendarWord}” z intencjami — dzień po dniu, w okresie wybranym wyżej.
          Wpis z „id” zmienia się w miejscu, bez „id” — dochodzi; najpierw widać, która msza którego dnia dostanie którą intencję. Niczego nie usuwa.
        </>}
        fileName={fileName}
        exportDoc={exportDoc}
        format={MASSES_JSON}
        open
        preview={preview}
        importLabel="Importuj do kalendarza"
        onImport={run}
        options={(value) => {
          const done = analyse(value);
          if ('error' in done || done.plan.conflicts === 0) return null;
          return (
            <fieldset className="wk-field wk-json-options">
              <legend>Msze, które w kalendarzu mają już inną intencję ({done.plan.conflicts})</legend>
              <label className="wk-check">
                <input type="radio" name="masses-conflicts" checked={conflicts === 'skip'} onChange={() => setConflicts('skip')} />
                <span>Pomiń — nowe intencje do nich nie dojdą (ostrzeżenia wyżej mówią które)</span>
              </label>
              <label className="wk-check">
                <input type="radio" name="masses-conflicts" checked={conflicts === 'add'} onChange={() => setConflicts('add')} />
                <span>Dopisz obok istniejących — dwie pojedyncze w jednej mszy to dwóch kapłanów</span>
              </label>
            </fieldset>
          );
        }}
      />
    </>
  );
}

export default MassesJsonPanel;
