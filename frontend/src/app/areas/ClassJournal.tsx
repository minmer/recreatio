/**
 * 0134 — DER DZIENNIK EINER KLASA: Termin für Termin (aus dem Plan lekcji im Kalender der Klasse),
 * an jedem die Realizacja — welche Lekcja des Programms, ob sie stattfand, eine Notiz, das Zadanie.
 *
 * <b>Eine Realizacja ist ein Wygłoszenie</b> im Skryptorium der Schule (`school.ts`): „Szczegóły"
 * öffnet es dort mit allem, was vom Plan der Lekcja gesagt wurde, Punkt für Punkt. Hier steht nur,
 * was man nach der Stunde in einer Minute einträgt; jede Zeile speichert für sich.
 *
 * <b>Je Klasse anders:</b> eine Lekcja fällt aus („nie odbyła się" — „Rozłóż program" verteilt sie
 * neu), eine kommt dazu („Lekcja dodatkowa", auch ausserhalb des Programms), eine andere Reihenfolge
 * ist nur ein anderes Thema an einem Termin.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { plural } from '../core/plural';
import { WorkspaceError } from '../core/session';
import type { LibraryRow } from '../library/library';
import { LESSON_STATES, str } from '../library/libraryKinds';
import type { LibraryStore } from '../library/libraryStore';
import { viewPath } from '../routes';
import { Loading } from '../ui/Loading';
import { failure, type Ctx } from './AreaKindPanel';
import {
  cellOf, dayOf, distribute, journalRows, lessonMessage, lessonSlotsOf, postToClass, realizationsOf, saveRealization, schoolYear,
  STATE_SIGN, STATE_WORD, type JournalRow, type Lesson, type LessonSlot, type LessonState, type Realization
} from './school';

/** Eine Lekcja aus einem der Programme der Klasse — mit ihrem Programm (für die Wahl des Themas). */
export interface JournalLesson extends Lesson {
  readonly programId: string;
  readonly programTitle: string;
}

const addDays = (day: string, n: number): string => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dayOf(d);
};
const startOf = (day: string): Date => new Date(`${day}T00:00:00`);
const endOf = (day: string): Date => new Date(`${day}T23:59:59`);

const dayLabel = (day: string): string =>
  new Date(`${day}T12:00:00`).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
const timeLabel = (iso: string): string => new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

/** Welche Stände eine Zeile anbietet: geplant nur ab heute. */
const statesFor = (date: string, today: string): readonly LessonState[] =>
  date >= today ? ['planned', 'done', 'partial', 'skipped'] : ['done', 'partial', 'skipped'];

const WINDOW_BACK = 14;
const WINDOW_AHEAD = 28;
const STEP = 28;

export function ClassJournal({ ctx, store, library, lessons, round, revision }: {
  ctx: Ctx;
  store: LibraryStore;
  library: LibraryRow;
  lessons: readonly JournalLesson[];
  /** Nach einer Änderung des Plans lekcji neu lesen. */
  round: number;
  /** Der Stand des Skryptorium — die Realizacje folgen ihm. */
  revision: number;
}) {
  const classId = ctx.area.areaId;
  const today = dayOf(new Date());
  const [from, setFrom] = useState(() => addDays(today, -WINDOW_BACK));
  const [to, setTo] = useState(() => addDays(today, WINDOW_AHEAD));
  const [slots, setSlots] = useState<readonly LessonSlot[] | null>(null);
  const [slotsFailed, setSlotsFailed] = useState(false);
  const [extra, setExtra] = useState(false);

  useEffect(() => {
    let alive = true;
    setSlots(null);
    setSlotsFailed(false);
    void lessonSlotsOf(classId, startOf(from), endOf(to)).then(
      (found) => { if (alive) setSlots(found); },
      () => { if (alive) { setSlots([]); setSlotsFailed(true); } });
    return () => { alive = false; };
  }, [classId, from, to, round]);

  const realizations = useMemo(() => realizationsOf(store.all(), classId), [store, classId, revision]);
  const rows = useMemo(() => (slots === null ? [] : journalRows(slots, realizations).filter((r) => r.date >= from && r.date <= to)), [slots, realizations, from, to]);
  const writes = library.writes;

  /* Die Themen: die Lekcje der Programme — und was diese Klasse ausserhalb davon hatte. */
  const lessonIds = useMemo(() => new Set(lessons.map((l) => l.textId)), [lessons]);
  const extraIds = useMemo(() => [...new Set(realizations.map((r) => r.textId).filter((id): id is string => id !== null && !lessonIds.has(id)))], [realizations, lessonIds]);
  const titleOf = (id: string | null): string | null => {
    if (id === null) return null;
    const lesson = lessons.find((l) => l.textId === id);
    if (lesson !== undefined) return lesson.title;
    return str(store.get(id)?.data ?? {}, 'title').trim() || 'Bez tytułu';
  };
  const signOf = (id: string): string => {
    const cell = cellOf(realizations.filter((r) => r.textId === id));
    return cell === null ? '' : `${STATE_SIGN[cell.state]} `;
  };
  const programs = useMemo(() => {
    const out: { id: string; title: string; lessons: JournalLesson[] }[] = [];
    for (const l of lessons) {
      const at = out.find((p) => p.id === l.programId);
      if (at === undefined) out.push({ id: l.programId, title: l.programTitle, lessons: [l] });
      else at.lessons.push(l);
    }
    return out;
  }, [lessons]);

  const topics = (
    <>
      <option value="">— bez tematu —</option>
      {programs.map((p) => (
        <optgroup key={p.id} label={p.title}>
          {p.lessons.map((l) => <option key={l.textId} value={l.textId}>{signOf(l.textId)}{l.number}. {l.title}</option>)}
        </optgroup>
      ))}
      {extraIds.length > 0 && (
        <optgroup label="Dodatkowe">
          {extraIds.map((id) => <option key={id} value={id}>{signOf(id)}{titleOf(id)} (dodatkowa)</option>)}
        </optgroup>
      )}
    </>
  );

  const distributeNow = () => void ctx.run('Rozkładanie programu na terminy…', 'Program rozłożony na kolejne lekcje.', async () => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 26 * 7);
    const future = await lessonSlotsOf(classId, start, end);
    const plan = distribute(lessons, realizationsOf(store.all(), classId), future, dayOf(start));
    for (const one of plan) await saveRealization(store, { textId: one.textId, date: one.date, classAreaId: classId, state: 'planned' });
    if (plan.length === 0) {
      return future.length === 0 ? 'Nie ma kolejnych terminów — dodaj lekcje w „Plan lekcji”.' : 'Wszystkie lekcje programu są już odbyte albo zaplanowane.';
    }
    return `Zaplanowano ${plan.length} ${plural(plan.length, 'lekcję', 'lekcje', 'lekcji')}: od ${dayLabel(plan[0].date)} do ${dayLabel(plan[plan.length - 1].date)}.`;
  });

  const year = schoolYear(new Date());
  const move = (days: number) => { setFrom((was) => addDays(was, days)); setTo((was) => addDays(was, days)); };
  const whole = from === year.from && to === year.until;

  return (
    <div className="wk-journal" data-journal="">
      <div className="wk-journal-bar">
        <button type="button" className="wk-btn wk-btn-line wk-btn-small" data-journal-earlier="" onClick={() => move(-STEP)}>← Wcześniej</button>
        <button type="button" className="wk-btn wk-btn-line wk-btn-small" data-journal-later="" onClick={() => move(STEP)}>Później →</button>
        {whole ? (
          <button type="button" className="wk-link-btn" onClick={() => { setFrom(addDays(today, -WINDOW_BACK)); setTo(addDays(today, WINDOW_AHEAD)); }}>Najbliższe tygodnie</button>
        ) : (
          <button type="button" className="wk-link-btn" data-journal-year="" onClick={() => { setFrom(year.from); setTo(year.until); }}>Cały rok szkolny</button>
        )}
        <span className="wk-kind-small">{dayLabel(from)} – {dayLabel(to)}</span>
      </div>

      {writes && (
        <div className="wk-actions">
          {lessons.length > 0 && (
            <button type="button" className="wk-btn wk-btn-small" disabled={ctx.busy} data-journal-distribute="" onClick={distributeNow}>
              Rozłóż program na kolejne lekcje
            </button>
          )}
          <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} aria-expanded={extra} data-journal-extra-open="" onClick={() => setExtra(!extra)}>
            + Lekcja dodatkowa
          </button>
        </div>
      )}
      {writes && extra && <ExtraLesson ctx={ctx} store={store} today={today} onDone={() => setExtra(false)} />}

      {slotsFailed && <p className="wk-error">Nie udało się odczytać planu lekcji — widać tylko zapisane lekcje.</p>}
      {slots === null ? <Loading lines={3} /> : rows.length === 0 ? (
        <p className="wk-kind-small">
          W tym czasie nie ma lekcji. Dodaj lekcję w tygodniu w „Plan lekcji” — albo wpisz lekcję dodatkową.
        </p>
      ) : (
        <ol className="wk-journal-rows">
          {rows.map((row) => (
            <JournalLine
              key={row.slot !== null ? `${row.slot.itemId}|${row.slot.occurrenceAt}` : `r:${row.realization?.id ?? row.date}`}
              ctx={ctx} store={store} library={library} row={row} today={today} writes={writes} topics={topics} titleOf={titleOf}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

/* -- Eine Zeile ---------------------------------------------------------------------------------- */

function JournalLine({ ctx, store, library, row, today, writes, topics, titleOf }: {
  ctx: Ctx;
  store: LibraryStore;
  library: LibraryRow;
  row: JournalRow;
  today: string;
  writes: boolean;
  topics: ReactNode;
  titleOf: (id: string | null) => string | null;
}) {
  const classId = ctx.area.areaId;
  const r: Realization | null = row.realization;
  const [summary, setSummary] = useState(r?.summary ?? '');
  const [homework, setHomework] = useState(r?.homework ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Was von aussen kommt (ein anderer Tab, der Skryptorium), ersetzt den Entwurf. */
  useEffect(() => { setSummary(r?.summary ?? ''); }, [r?.id, r?.summary]);
  useEffect(() => { setHomework(r?.homework ?? ''); }, [r?.id, r?.homework]);

  /*
   * Eine Zeile ohne Realizacja bekommt sie beim ersten Eintrag — vergangen: gehalten, künftig: geplant.
   * Die Änderungen einer Zeile laufen nacheinander (Notatka und Zadanie verlassen kurz nacheinander ihr
   * Feld): jede liest den Eintrag, wie ihn die vorige gespeichert hat — sonst nähme die zweite die erste
   * zurück, oder es entstünden zwei Realizacje für einen Termin.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());
  const madeId = useRef<string | null>(r?.id ?? null);
  useEffect(() => { if (r !== null) madeId.current = r.id; }, [r]);
  const save = (patch: { textId?: string | null; state?: LessonState; summary?: string; homework?: string }): Promise<void> => {
    queue.current = queue.current.then(async () => {
      setBusy(true);
      setError(null);
      try {
        const id = madeId.current;
        const saved = await saveRealization(store, {
          ...(id === null ? { date: row.date, state: row.date > today ? 'planned' as const : 'done' as const } : { id }),
          classAreaId: classId,
          ...patch
        });
        madeId.current = saved.id;
      } catch (e) {
        setError(failure(e, 'Nie udało się zapisać.'));
      } finally {
        setBusy(false);
      }
    });
    return queue.current;
  };

  const send = () => {
    if (r === null) return;
    void ctx.run('Wysyłanie do klasy…', 'Wysłano klasie.', async (held) => {
      await postToClass(held.ring, {
        classAreaId: classId, personId: held.person.id,
        text: lessonMessage({ date: row.date, title: titleOf(r.textId), summary, homework })
      });
    });
  };

  const title = titleOf(r?.textId ?? null);
  const states = statesFor(row.date, today);
  const off = !writes || busy || ctx.busy;

  return (
    <li className={`wk-journal-row${row.date === today ? ' is-today' : row.date < today ? ' is-past' : ''}${r !== null ? ` is-${r.state}` : ''}`}
      data-journal-row="" data-date={row.date} data-state={r?.state ?? ''}>
      <div className="wk-journal-when">
        <span className="wk-journal-day">{dayLabel(row.date)}</span>
        {row.slot !== null && <span>{timeLabel(row.slot.startsAt)}</span>}
        {row.slot?.cancelled === true && <span className="wk-tag">odwołana</span>}
        {row.slot === null && <span className="wk-card-muted">poza planem</span>}
      </div>
      <div className="wk-journal-body">
        <div className="wk-journal-line">
          {writes ? (
            <select value={r?.textId ?? ''} disabled={off} aria-label="Temat lekcji" data-journal-topic=""
              onChange={(e) => void save({ textId: e.target.value === '' ? null : e.target.value })}>
              {topics}
            </select>
          ) : (
            <span className="wk-journal-title">{title ?? '— bez tematu —'}</span>
          )}
          {writes ? (
            <span className="wk-seg wk-journal-states" role="group" aria-label="Stan lekcji">
              {states.map((s) => (
                <button key={s} type="button" disabled={off} aria-pressed={r?.state === s} data-journal-state={s}
                  className={r?.state === s ? `wk-seg-opt wk-seg-on is-${s}` : 'wk-seg-opt'}
                  onClick={() => { if (r?.state !== s) void save({ state: s }); }}>
                  <span aria-hidden="true">{STATE_SIGN[s]}</span> {LESSON_STATES.find((x) => x.value === s)?.label}
                </button>
              ))}
            </span>
          ) : r !== null && <span className="wk-tag">{STATE_SIGN[r.state]} {STATE_WORD[r.state]}</span>}
        </div>

        {writes ? (
          <div className="wk-journal-texts">
            <label className="wk-field">
              <span>Notatka</span>
              <input value={summary} disabled={off} maxLength={2000} placeholder="Co było, na czym skończyliśmy" data-journal-note=""
                onChange={(e) => setSummary(e.target.value)}
                onBlur={() => { if (summary !== (r?.summary ?? '')) void save({ summary }); }} />
            </label>
            <label className="wk-field">
              <span>Zadanie dla klasy</span>
              <input value={homework} disabled={off} maxLength={2000} placeholder="np. przeczytać Łk 15" data-journal-homework=""
                onChange={(e) => setHomework(e.target.value)}
                onBlur={() => { if (homework !== (r?.homework ?? '')) void save({ homework }); }} />
            </label>
          </div>
        ) : (r !== null && (r.summary !== '' || r.homework !== '')) && (
          <p className="wk-kind-small">
            {r.summary}{r.summary !== '' && r.homework !== '' ? ' · ' : ''}{r.homework !== '' ? `Zadanie: ${r.homework}` : ''}
          </p>
        )}

        {r !== null && (
          <div className="wk-actions">
            <a className="wk-link-btn" href={viewPath('scriptorium', library.libraryId, r.id)} data-journal-details="">Szczegóły — co z planu lekcji</a>
            {writes && (
              <button type="button" className="wk-link-btn" disabled={off} data-journal-send="" onClick={send}>Wyślij klasie</button>
            )}
          </div>
        )}
        {busy && <span className="wk-kind-small" role="status">Zapisywanie…</span>}
        {error !== null && <p className="wk-error" role="alert">{error}</p>}
      </div>
    </li>
  );
}

/* -- Lekcja dodatkowa ------------------------------------------------------------------------------ */

function ExtraLesson({ ctx, store, today, onDone }: { ctx: Ctx; store: LibraryStore; today: string; onDone: () => void }) {
  const classId = ctx.area.areaId;
  const [textId, setTextId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [state, setState] = useState<LessonState>('done');
  const texts = useMemo(() => store.ofKind('text')
    .map((t) => ({ id: t.id, title: str(t.data, 'title').trim() || 'Bez tytułu' }))
    .sort((a, b) => a.title.localeCompare(b.title, 'pl')), [store]);

  const pickDate = (next: string) => {
    setDate(next);
    setState(next > today ? 'planned' : 'done');
  };

  const submit = () => void ctx.run('Zapisywanie lekcji…', 'Lekcja jest w dzienniku.', async () => {
    let id = textId;
    if (id === '') {
      if (title.trim() === '') throw new WorkspaceError('Wybierz temat albo wpisz nowy.');
      id = (await store.save({ kind: 'text', data: { title: title.trim().slice(0, 200), status: 'draft' } })).id;
    }
    await saveRealization(store, { textId: id, date, classAreaId: classId, state });
    onDone();
  });

  return (
    <form className="wk-kind-form wk-journal-extra" data-journal-extra="" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="wk-kind-row">
        <label className="wk-field">
          <span>Temat ze skryptorium</span>
          <select value={textId} disabled={ctx.busy} data-journal-extra-text="" onChange={(e) => setTextId(e.target.value)}>
            <option value="">— nowy temat —</option>
            {texts.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>
        {textId === '' && (
          <label className="wk-field">
            <span>Nowy temat</span>
            <input value={title} maxLength={200} disabled={ctx.busy} placeholder="np. Przygotowanie do jasełek" data-journal-extra-title=""
              onChange={(e) => setTitle(e.target.value)} />
          </label>
        )}
      </div>
      <div className="wk-kind-row">
        <label className="wk-field">
          <span>Dzień</span>
          <input type="date" value={date} disabled={ctx.busy} data-journal-extra-date="" onChange={(e) => pickDate(e.target.value)} />
        </label>
        <label className="wk-field">
          <span>Stan</span>
          <select value={state} disabled={ctx.busy} onChange={(e) => setState(e.target.value as LessonState)}>
            {statesFor(date, today).map((s) => <option key={s} value={s}>{STATE_WORD[s]}</option>)}
          </select>
        </label>
      </div>
      <div className="wk-actions">
        <button type="submit" className="wk-btn wk-btn-small" disabled={ctx.busy || date === '' || (textId === '' && title.trim() === '')} data-journal-extra-save="">
          Zapisz w dzienniku
        </button>
        <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={onDone}>Anuluj</button>
      </div>
    </form>
  );
}
