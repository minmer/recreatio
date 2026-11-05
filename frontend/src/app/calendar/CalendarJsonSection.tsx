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
import { useT } from '../core/i18n';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import type { CalendarRow } from './calendar';
import { CALENDAR_FORMAT, CALENDAR_JSON, dayOf, docNeeds, docProblem, infoOf, planCalendar, type CalendarState } from './calendarJson';
import { exportCalendarRange, loadDocState, runCalendarImport, type ExportChoice } from './calendarJsonRun';

type Choice = ExportChoice['kind'];

/* Die Schlüssel der Bezeichnungen — übersetzt beim Zeichnen. */
const CHOICES: readonly { readonly value: Choice; readonly label: string }[] = [
  { value: 'year', label: 'calendarData.jsonSection.choice.year' },
  { value: 'around', label: 'calendarData.jsonSection.choice.around' },
  { value: 'days', label: 'calendarData.jsonSection.choice.days' },
  { value: 'all', label: 'calendarData.jsonSection.choice.all' }
];

/** Der Name der Datei: „terminy-msze-parafialne.json". */
const slug = (text: string, fallback: string): string => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l') // i18n-ignore
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback;

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
  const t = useT();
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
    if (!writer) return { error: t('calendarData.jsonSection.readerOnly') };
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
              error: e instanceof WorkspaceError ? e.message : t('calendarData.jsonSection.loadFailed')
            }))
          );
        }, 0);
      }
      return { error: t('calendarData.jsonSection.checking') };
    }
    if ('error' in state) return state;
    const plan = planCalendar(value, state);
    return 'error' in plan ? plan : { lines: plan.lines, warnings: plan.warnings };
  };

  const run = async (value: unknown, stage: (what: string) => void): Promise<JsonPreview> => {
    if (!writer) throw new WorkspaceError(t('calendarData.jsonSection.writersOnly'));
    stage(t('calendarData.jsonSection.checkingCalendar'));
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
    <section className="wk-calset-docs" aria-label={t('calendarData.jsonSection.title')}>
      <h3 className="wk-h3">{t('calendarData.jsonSection.title')}</h3>
      <div className="wk-calset-row">
        <label className="wk-field">
          <span>{t('calendarData.jsonSection.range')}</span>
          <select value={choice} onChange={(e) => setChoice(e.target.value as Choice)}>
            {CHOICES.map((one) => <option key={one.value} value={one.value}>{t(one.label)}</option>)}
          </select>
        </label>
        {choice === 'days' && (
          <>
            <label className="wk-field">
              <span>{t('calendarData.jsonSection.fromDay')}</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="wk-field">
              <span>{t('calendarData.jsonSection.toDay')}</span>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
      </div>
      {notes.length > 0 && <ul className="wk-json-warn">{notes.map((one, i) => <li key={i}>{one}</li>)}</ul>}
      <JsonPanel
        summary={t('calendarData.jsonSection.summary')}
        lead={(
          <>
            {t('calendarData.jsonSection.lead', { format: CALENDAR_FORMAT })}{' '}
            {writer ? t('calendarData.jsonSection.leadWriter') : t('calendarData.jsonSection.writersOnly')}
          </>
        )}
        fileName={t('calendarData.jsonSection.fileName', { name: slug(calendar.title, t('calendarData.jsonSection.fileFallback')) })}
        exportDoc={exportDoc}
        format={CALENDAR_JSON}
        preview={preview}
        importLabel={t('calendarData.jsonSection.importLabel')}
        onImport={run}
        open={open}
      />
    </section>
  );
}

export default CalendarJsonSection;
