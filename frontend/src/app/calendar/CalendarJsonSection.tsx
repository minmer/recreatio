/**
 * 2026-10-29 — „TERMINY JAKO JSON" in den Einstellungen eines Kalenders (`calendarJson.ts` plant,
 * `calendarJsonRun.ts` lädt und schreibt).
 *
 * Neben Schematen und Plänen, wie dort: der Zeitraum des Exports (Vorgabe: von heute ein Jahr), darunter das
 * eine JSON-Fach mit der Beschreibung daneben. Lesende exportieren (aus der Liste der Kalender); importieren
 * darf, wer im Kalender schreibt — den anderen sagt es die Vorschau, und der Knopf erscheint nicht.
 *
 * <b>Die Vorschau braucht den Kalender:</b> die Termine, auf die das Dokument mit "id" zeigt. Geholt wird, wenn
 * ein Dokument eingefügt ist — je Bedarf einmal (`docNeeds`), beim Import noch einmal frisch.
 */

import { useMemo, useRef, useState } from 'react';

import type { AreaRow } from '../areas/area';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import type { CalendarRow } from './calendar';
import { CALENDAR_FORMAT, CALENDAR_JSON, dayOf, docNeeds, docProblem, infoOf, planCalendar, type CalendarState } from './calendarJson';
import { exportCalendarRange, loadDocState, runCalendarImport, type ExportChoice } from './calendarJsonRun';

type Choice = ExportChoice['kind'];

const CHOICES: readonly { readonly value: Choice; readonly label: string }[] = [
  { value: 'year', label: 'od dziś na rok' },
  { value: 'around', label: 'rok wstecz i rok naprzód' },
  { value: 'days', label: 'wybrane dni…' },
  { value: 'all', label: 'wszystko (to może potrwać)' }
];

/** Der Name der Datei: „terminy-msze-parafialne.json". */
const slug = (text: string): string => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'kalendarz';

const inYear = (): string => {
  const now = new Date();
  return dayOf(new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()));
};

export function CalendarJsonSection({ me, areas, calendar, writer, onChanged, open = false }: {
  me: Me;
  areas: readonly AreaRow[];
  calendar: CalendarRow;
  /** Darf importieren: schreibt in diesem Kalender. */
  writer: boolean;
  onChanged: () => void;
  /** Gleich offen — im Fenster, das nur dafür da ist. */
  open?: boolean;
}) {
  const personal = areas.find((a) => a.personal === true)?.areaId ?? null;
  const info = useMemo(() => infoOf(calendar, personal), [calendar, personal]);
  const [choice, setChoice] = useState<Choice>('year');
  const [from, setFrom] = useState(() => dayOf(new Date()));
  const [to, setTo] = useState(inYear);
  const [notes, setNotes] = useState<readonly string[]>([]);
  /* Der Kalender, wie ihn die Vorschau eines Dokuments braucht — je Bedarf (`docNeeds`) einmal geholt. */
  const [states, setStates] = useState<ReadonlyMap<string, CalendarState | { error: string }>>(new Map());
  const asked = useRef(new Set<string>());

  const preview = (value: unknown): JsonPreview | { error: string } => {
    if (!writer) return { error: 'Import jest dla prowadzących ten kalendarz — tutaj możesz pobrać eksport.' };
    const problem = docProblem(value);
    if (problem !== null) return { error: problem };
    const key = JSON.stringify(docNeeds(value, info.calendarId));
    const state = states.get(key);
    if (state === undefined) {
      if (!asked.current.has(key)) {
        asked.current.add(key);
        /* Nicht beim Zeichnen: geholt wird danach, und die Vorschau kommt, sobald es da ist. */
        window.setTimeout(() => {
          void loadDocState(me.ring, info, value).then(
            (got) => setStates((was) => new Map(was).set(key, got)),
            (e: unknown) => setStates((was) => new Map(was).set(key, {
              error: e instanceof WorkspaceError ? e.message : 'Nie udało się odczytać terminów kalendarza.'
            }))
          );
        }, 0);
      }
      return { error: 'Sprawdzanie terminów kalendarza…' };
    }
    if ('error' in state) return state;
    const plan = planCalendar(value, state);
    return 'error' in plan ? plan : { lines: plan.lines, warnings: plan.warnings };
  };

  const run = async (value: unknown, stage: (what: string) => void): Promise<JsonPreview> => {
    if (!writer) throw new WorkspaceError('Import jest dla prowadzących ten kalendarz.');
    stage('Sprawdzanie kalendarza…');
    /* Mit dem FRISCHEN Stand planen — zwischen Vorschau und Knopf kann jemand etwas geändert haben. */
    const plan = planCalendar(value, await loadDocState(me.ring, info, value));
    if ('error' in plan) throw new WorkspaceError(plan.error);
    try {
      return await runCalendarImport({ ring: me.ring, ownerRoleId: me.person.id, calendar: info, plan, stage });
    } finally {
      asked.current.clear();
      setStates(new Map());
      onChanged();
    }
  };

  const exportDoc = async () => {
    const done = await exportCalendarRange(me.ring, info, choice === 'days' ? { kind: 'days', from, to } : { kind: choice });
    setNotes(done.warnings);
    return done.doc;
  };

  return (
    <section className="wk-calset-docs" aria-label="Terminy jako JSON">
      <h3 className="wk-h3">Terminy jako JSON</h3>
      <div className="wk-calset-row">
        <label className="wk-field">
          <span>Eksport — zakres</span>
          <select value={choice} onChange={(e) => setChoice(e.target.value as Choice)}>
            {CHOICES.map((one) => <option key={one.value} value={one.value}>{one.label}</option>)}
          </select>
        </label>
        {choice === 'days' && (
          <>
            <label className="wk-field">
              <span>Od dnia</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="wk-field">
              <span>Do dnia</span>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
      </div>
      {notes.length > 0 && <ul className="wk-json-warn">{notes.map((one, i) => <li key={i}>{one}</li>)}</ul>}
      <JsonPanel
        summary="JSON terminów — eksport i import"
        lead={(
          <>
            Terminy tego kalendarza („{CALENDAR_FORMAT}”): pojedyncze i serie, z programem, schematem i dniami serii — z zakresu
            wybranego wyżej i serie, które w niego sięgają.{' '}
            {writer
              ? 'Import zmienia terminy z "id" na miejscu, dodaje te bez "id", a usuwa tylko oznaczone "remove". Intencje, zapisy i rezerwacje zostają, jak są.'
              : 'Import jest dla prowadzących ten kalendarz.'}
          </>
        )}
        fileName={`terminy-${slug(calendar.title)}.json`}
        exportDoc={exportDoc}
        format={CALENDAR_JSON}
        preview={preview}
        importLabel="Importuj terminy"
        onImport={run}
        open={open}
      />
    </section>
  );
}

export default CalendarJsonSection;
