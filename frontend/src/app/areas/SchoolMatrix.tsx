/**
 * 0134 — WIE WEIT JEDE KLASSE MIT EINEM PROGRAMM IST: Zeilen die Lekcje (mit den Überschriften
 * dazwischen), Spalten die Klassen, die es verwirklichen. Eine Zelle ist die Realizacja dieser
 * Lekcja in dieser Klasse (`cellOf`): gehalten ✓, teilweise ◐ — mit Tag —, geplant · (blass),
 * ausgefallen ✕ („do powtórzenia"). Eine Zelle führt zu ihrer Realizacja im Skryptorium, eine leere
 * legt dort eine an (Lekcja, Klasse, heute, gehalten).
 *
 * Zuletzt je Klasse, was sie ausserhalb ihrer Programme gehalten hat — das Individuelle.
 */

import type { LibraryRow } from '../library/library';
import { str } from '../library/libraryKinds';
import type { Entry, LibraryStore } from '../library/libraryStore';
import { viewPath } from '../routes';
import { cellOf, lessonsOf, progressOf, realizationsOf, STATE_SIGN, STATE_WORD, type Realization } from './school';

/** „2026-10-12" → „12.10". */
const shortDay = (date: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(8, 10)}.${date.slice(5, 7)}` : date);

/** Eine neue Realizacja dieser Lekcja in dieser Klasse — im Formularz Wygłoszenia, schon ausgefüllt. */
export const newRealizationPath = (libraryId: string, textId: string, classAreaId: string, date: string, state = 'done'): string =>
  viewPath('scriptorium', libraryId, 'nowy', 'delivery', `texts=${textId}&classArea=${classAreaId}&state=${state}&date=${date}`);

export function SchoolMatrix({ store, library, program, classes, names, programTexts, today }: {
  store: LibraryStore;
  library: Pick<LibraryRow, 'libraryId' | 'writes'>;
  program: Entry;
  /** Die Klassen des Programms, in der Reihenfolge der Schule. */
  classes: readonly string[];
  /** Klasse → Name. */
  names: ReadonlyMap<string, string>;
  /** Je Klasse die Texte aller ihrer Programme — was nicht darin ist, ist „poza programem". */
  programTexts: ReadonlyMap<string, ReadonlySet<string>>;
  today: string;
}) {
  const lessons = lessonsOf(program, store);
  const all = realizationsOf(store.all());
  const ofClass = new Map<string, Realization[]>(classes.map((c) => [c, all.filter((r) => r.classAreaId === c)]));
  const title = str(program.data, 'title').trim() || 'Program';

  if (lessons.length === 0) {
    return <p className="wk-kind-small">„{title}” nie ma jeszcze lekcji — dodaj je w „Programy”.</p>;
  }
  if (classes.length === 0) {
    return <p className="wk-kind-small">„{title}” nie ma jeszcze klas — zaznacz je w „Programy”.</p>;
  }

  /* Die Überschrift einer Zeile steht über ihr, sobald sie wechselt. */
  let heading: string | null = null;
  const rows: ({ kind: 'heading'; text: string } | { kind: 'lesson'; at: number })[] = [];
  lessons.forEach((l, at) => {
    if (l.heading !== null && l.heading !== heading) rows.push({ kind: 'heading', text: l.heading });
    heading = l.heading;
    rows.push({ kind: 'lesson', at });
  });

  const outside = (c: string): number => {
    const known = programTexts.get(c);
    return (ofClass.get(c) ?? []).filter((r) => r.state !== 'planned' && r.state !== 'skipped' && (r.textId === null || known === undefined || !known.has(r.textId))).length;
  };

  return (
    <div className="sc-matrix-wrap" role="region" aria-label={`Realizacja programu „${title}”`} tabIndex={0}>
      <table className="sc-matrix" data-matrix={program.id}>
        <thead>
          <tr>
            <th scope="col" className="sc-matrix-corner">Lekcja</th>
            {classes.map((c) => {
              const p = progressOf(lessons, ofClass.get(c) ?? []);
              return (
                <th key={c} scope="col" data-class={c}>
                  <a className="wk-link" href={viewPath('areas', c, 'profil')}>{names.get(c) ?? 'klasa'}</a>
                  <span className="sc-matrix-progress" title={`Zrealizowane ${p.done} z ${p.total}`}>{p.done}/{p.total}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => row.kind === 'heading' ? (
            <tr key={`h${i}`} className="sc-matrix-heading">
              <th scope="rowgroup" colSpan={classes.length + 1}>{row.text}</th>
            </tr>
          ) : (() => {
            const lesson = lessons[row.at];
            return (
              <tr key={lesson.textId} data-lesson={lesson.textId}>
                <th scope="row">
                  <span className="sc-matrix-no">{lesson.number}.</span>{' '}
                  <a className="wk-link" href={viewPath('scriptorium', library.libraryId, lesson.textId)}>{lesson.title}</a>
                </th>
                {classes.map((c) => {
                  const cell = cellOf((ofClass.get(c) ?? []).filter((r) => r.textId === lesson.textId));
                  const name = names.get(c) ?? 'klasa';
                  if (cell === null) {
                    return (
                      <td key={c} data-cell={`${lesson.textId}:${c}`} data-state="none">
                        {library.writes
                          ? <a className="sc-cell-add" href={newRealizationPath(library.libraryId, lesson.textId, c, today)} aria-label={`Zapisz realizację: ${lesson.title}, ${name}`}>+</a>
                          : <span className="sc-cell-empty" aria-label="jeszcze nie">–</span>}
                      </td>
                    );
                  }
                  const said = `${STATE_WORD[cell.state]}${cell.date === '' ? '' : `, ${cell.date}`}`;
                  return (
                    <td key={c} data-cell={`${lesson.textId}:${c}`} data-state={cell.state} className={`is-${cell.state}`}>
                      <a href={viewPath('scriptorium', library.libraryId, cell.id)} title={said} aria-label={`${lesson.title}, ${name}: ${said}`}>
                        <span aria-hidden="true">{STATE_SIGN[cell.state]}</span> {cell.state === 'skipped' ? 'do powtórzenia' : shortDay(cell.date)}
                      </a>
                    </td>
                  );
                })}
              </tr>
            );
          })())}
          <tr className="sc-matrix-outside">
            <th scope="row">Poza programem</th>
            {classes.map((c) => <td key={c} data-outside={c}>{outside(c)}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
