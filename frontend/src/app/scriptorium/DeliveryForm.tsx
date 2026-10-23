/**
 * EIN WYGŁOSZENIE SCHREIBEN (2026-10-21) — ein Kazanie, einmal gehalten.
 *
 * <code>
 *   Kazanie, Tag, Ort         welcher Text, wann, wo, für wen
 *   Nagranie                  Adresse (Datei, YouTube) — eine Datei spielt gleich hier
 *   Co z planu                je Punkt des Plans: powiedziane / krótko / pominięte,
 *                             die Zeit im Nagranie (⏱ nimmt sie aus dem Player), eine Uwaga
 *   Co doszło                 was gesagt wurde und nicht im Plan stand — mit Zeit und Platz
 *   Zapis                     das Gesagte, Wort für Wort (wer es hat)
 *   przez AI                  das Polecenie mit dem Plan und seinen Kennungen für den
 *                             eigenen Chat; die Antwort (JSON) geht in DIESES Formular
 * </code>
 *
 * Gespeichert wird von selbst, wie jeder Eintrag (`LibraryEditor.tsx`).
 */

import { useRef } from 'react';

import { viewPath } from '../routes';
import { JsonPanel } from '../ui/JsonPanel';
import type { OpenLibrary } from '../library/library';
import { patchFromDoc } from '../library/libraryJson';
import { exportScriptorium, SCRIPTORIUM_SPEC } from './scriptoriumJson';
import { COVERAGE_STATES, itemsOf, str, type EntryData, type LibEntry } from '../library/libraryKinds';
import type { LibraryStore } from '../library/libraryStore';
import { FieldList } from '../library/LibraryFields';
import { MediaPlayer } from './SermonParts';
import {
  addedData, countsLine, coverageCounts, coverageData, coverageIndex, coverageOf, deliveryPlan, deliveryPrompt,
  deliveriesOf, mediaFile, orphanCoverage, planOf, pointLine, pointNumbers, timeText,
  type AddedItem, type CoverageItem, type CoverageState
} from './sermon';
import { WritingArea } from './WritingTools';

const SIGN: Record<string, string> = { said: '✓', short: '◐', skipped: '✕' };

/** „Co doszło", wie es im Formular steht — auch eine Zeile ohne Text (man hat sie gerade angelegt). */
const addedRows = (data: EntryData): AddedItem[] =>
  itemsOf(data, 'added').map((item) => ({ text: str(item, 'text'), at: str(item, 'at'), after: str(item, 'after') }));

/* -- Co z planu ------------------------------------------------------------------------------- */

function CoverageEditor({ store, library, entry, data, set, readOnly, now }: {
  store: LibraryStore;
  library: OpenLibrary;
  entry: LibEntry;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
  /** Wo der Player gerade steht — `null`: kein Player. */
  now: (() => number | null) | null;
}) {
  const parts = deliveryPlan(entry, store);
  const all = parts.flatMap((p) => p.points);
  const coverage = coverageOf(data);
  const index = coverageIndex(coverage);
  const orphans = orphanCoverage(coverage, all);
  const counts = countsLine(coverageCounts(all, coverage, addedRows(data).filter((a) => a.text.trim() !== '')));

  /* In der Reihenfolge des Plans gespeichert; Zeilen zu Punkten, die es nicht mehr gibt, bleiben hinten, bis man sie löscht. */
  const write = (byPoint: ReadonlyMap<string, CoverageItem>) => {
    const ordered = [...all.map((p) => byPoint.get(p.id)), ...orphans.map((o) => byPoint.get(o.point))]
      .filter((item): item is CoverageItem => item !== undefined && (item.state !== '' || item.at !== '' || item.note.trim() !== ''));
    set({ coverage: ordered.map(coverageData) });
  };
  const change = (point: string, patch: Partial<CoverageItem>) => {
    const next = new Map(index);
    next.set(point, { ...(index.get(point) ?? { point, state: '', at: '', note: '' }), ...patch });
    write(next);
  };
  const markRest = (state: CoverageState) => {
    const next = new Map(index);
    for (const p of all) if ((index.get(p.id)?.state ?? '') === '') next.set(p.id, { ...(index.get(p.id) ?? { point: p.id, at: '', note: '' }), state });
    write(next);
  };

  if (parts.length === 0) {
    return (
      <section className="lib-cover" aria-label="Co z planu">
        <h2 className="wk-h2">Co z planu zostało powiedziane</h2>
        <p className="lib-cover-lead">Najpierw wybierz wyżej kazanie (tekst) — jego plan pojawi się tutaj, punkt po punkcie.</p>
      </section>
    );
  }

  return (
    <section className="lib-cover" aria-label="Co z planu">
      <h2 className="wk-h2">Co z planu zostało powiedziane</h2>
      {counts !== '' && <p className="lib-cover-lead">{counts}</p>}
      {parts.map(({ text, points }) => {
        const numbers = pointNumbers(points);
        return (
          <div key={text.id} className="lib-cover-text-block">
            {parts.length > 1 && <h3 className="lib-section">{str(text.data, 'title') || 'Bez tytułu'}</h3>}
            {points.length === 0 ? (
              <p className="lib-cover-lead">
                Ten tekst nie ma jeszcze planu — <a href={viewPath('scriptorium', library.libraryId, text.id)}>dopisz go w tekście</a> (zakładka „Plan”), a tu zaznaczysz, co z niego padło.
              </p>
            ) : (
              <ol className="lib-cover-list">
                {points.map((p) => {
                  const item = index.get(p.id);
                  const state = item?.state ?? '';
                  return (
                    <li key={p.id} className={`lib-cover-row is-d${p.depth} is-${state === '' ? 'open' : state}`}>
                      <span className="lib-point-no">{numbers.get(p.id)}</span>
                      <span className="lib-cover-point">{pointLine(p.text, store, 240) || '(pusty punkt)'}</span>
                      <span className="wk-seg lib-cover-states" role="group" aria-label="Jak">
                        {COVERAGE_STATES.map((s) => (
                          <button key={s.value} type="button" disabled={readOnly} aria-pressed={state === s.value}
                            className={state === s.value ? `wk-seg-opt wk-seg-on is-${s.value}` : 'wk-seg-opt'}
                            onClick={() => change(p.id, { state: state === s.value ? '' : s.value })}>
                            <span aria-hidden="true">{SIGN[s.value]}</span> {s.label}
                          </button>
                        ))}
                      </span>
                      <span className="lib-cover-time">
                        <input value={item?.at ?? ''} disabled={readOnly} placeholder="m:ss" aria-label="Czas w nagraniu" inputMode="numeric"
                          onChange={(e) => change(p.id, { at: e.target.value.trim() })} />
                        {now !== null && !readOnly && (
                          <button type="button" className="wk-link-btn" title="Wpisz czas z odtwarzacza" aria-label="Czas z odtwarzacza"
                            onClick={() => { const s = now(); if (s !== null) change(p.id, { at: timeText(s), state: state === '' ? 'said' : state }); }}>⏱</button>
                        )}
                      </span>
                      <input className="lib-cover-note" value={item?.note ?? ''} disabled={readOnly} placeholder="Uwaga: co było inaczej"
                        aria-label="Uwaga" onChange={(e) => change(p.id, { note: e.target.value })} />
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        );
      })}
      {!readOnly && all.length > 0 && (
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" onClick={() => markRest('said')}>Resztę oznacz: powiedziane</button>
          <button type="button" className="wk-link-btn" onClick={() => markRest('skipped')}>Resztę oznacz: pominięte</button>
          {coverage.length > 0 && <button type="button" className="wk-link-btn" onClick={() => set({ coverage: [] })}>Wyczyść oznaczenia</button>}
        </div>
      )}
      {orphans.length > 0 && (
        <p className="wk-warn">
          {orphans.length} {orphans.length === 1 ? 'oznaczenie dotyczy punktu' : 'oznaczeń dotyczy punktów'}, których nie ma już w planie.{' '}
          {!readOnly && <button type="button" className="wk-link-btn" onClick={() => set({ coverage: coverage.filter((c) => !orphans.includes(c)).map(coverageData) })}>Usuń je</button>}
        </p>
      )}
    </section>
  );
}

/* -- Co doszło ---------------------------------------------------------------------------------- */

function AddedEditor({ store, entry, data, set, readOnly, now }: {
  store: LibraryStore;
  entry: LibEntry;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
  now: (() => number | null) | null;
}) {
  const rows = addedRows(data);
  const points = deliveryPlan(entry, store).flatMap((p) => p.points);
  const numbers = pointNumbers(points);
  const write = (next: readonly AddedItem[]) => set({ added: next.map(addedData) });
  const change = (at: number, patch: Partial<AddedItem>) => write(rows.map((row, i) => (i === at ? { ...row, ...patch } : row)));

  return (
    <section className="lib-cover" aria-label="Co doszło">
      <h2 className="wk-h2">Co doszło</h2>
      {rows.length === 0 && <p className="lib-cover-lead">To, co zostało powiedziane, a nie było w planie — przykład, ogłoszenie, nowa myśl.</p>}
      {rows.length > 0 && (
        <ul className="lib-added-list">
          {rows.map((row, at) => (
            <li key={at} className="lib-added-row">
              <textarea rows={2} value={row.text} disabled={readOnly} placeholder="Co padło (jedno-dwa zdania)" aria-label="Co doszło"
                onChange={(e) => change(at, { text: e.target.value })} />
              <span className="lib-cover-time">
                <input value={row.at} disabled={readOnly} placeholder="m:ss" aria-label="Czas w nagraniu" onChange={(e) => change(at, { at: e.target.value.trim() })} />
                {now !== null && !readOnly && (
                  <button type="button" className="wk-link-btn" title="Wpisz czas z odtwarzacza" aria-label="Czas z odtwarzacza"
                    onClick={() => { const s = now(); if (s !== null) change(at, { at: timeText(s) }); }}>⏱</button>
                )}
              </span>
              <select value={row.after} disabled={readOnly} aria-label="Po którym punkcie" onChange={(e) => change(at, { after: e.target.value })}>
                <option value="">— na końcu —</option>
                {points.map((p) => <option key={p.id} value={p.id}>po {numbers.get(p.id)} {pointLine(p.text, undefined, 50)}</option>)}
              </select>
              {!readOnly && <button type="button" className="wk-link-btn lib-danger-link" aria-label="Usuń" onClick={() => write(rows.filter((_, i) => i !== at))}>×</button>}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" onClick={() => { const s = now === null ? null : now(); write([...rows, { text: '', at: s === null ? '' : timeText(s), after: '' }]); }}>+ Co doszło</button>
        </div>
      )}
    </section>
  );
}

/* -- Das ganze Formular ------------------------------------------------------------------------- */

export function DeliveryForm({ store, library, entry, data, set, readOnly }: {
  store: LibraryStore;
  library: OpenLibrary;
  /** Das Wygłoszenie, wie es gerade im Editor steht. */
  entry: LibEntry;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
}) {
  const media = useRef<HTMLMediaElement | null>(null);
  const audio = str(data, 'audio');
  const video = str(data, 'video');
  const file = mediaFile(audio) !== null || mediaFile(video) !== null;
  const now = file ? () => (media.current === null ? null : media.current.currentTime) : null;

  return (
    <div className="lib-delivery-form">
      <FieldList store={store} kind="delivery" data={data} set={set} readOnly={readOnly} only={['texts', 'date', 'occasion', 'place', 'audience', 'readings']} />

      <section className="lib-cover" aria-label="Nagranie">
        <h2 className="wk-h2">Nagranie</h2>
        <FieldList store={store} kind="delivery" data={data} set={set} readOnly={readOnly} only={['audio', 'video', 'duration']} />
        {(audio !== '' || video !== '') && (
          <div className="lib-recordings">
            {audio !== '' && <MediaPlayer url={audio} kind="audio" media={mediaFile(audio) !== null ? media : undefined} />}
            {video !== '' && <MediaPlayer url={video} kind="video" media={mediaFile(audio) === null && mediaFile(video) !== null ? media : undefined} />}
          </div>
        )}
        {file && <p className="lib-cover-lead">Słuchając, naciśnij ⏱ przy punkcie — wpisze się czas z odtwarzacza.</p>}
      </section>

      <CoverageEditor store={store} library={library} entry={entry} data={data} set={set} readOnly={readOnly} now={now} />
      <AddedEditor store={store} entry={entry} data={data} set={set} readOnly={readOnly} now={now} />

      <FieldList store={store} kind="delivery" data={data} set={set} readOnly={readOnly} only={['summary', 'topics']} />

      <details className="wk-fold">
        <summary>Zapis wygłoszenia (transkrypcja)</summary>
        <WritingArea store={store} value={str(data, 'transcript')} readOnly={readOnly}
          placeholder="To, co zostało powiedziane, słowo w słowo — akapity oddzielone pustą linią." onChange={(next) => set({ transcript: next })} />
      </details>

      {!readOnly && (
        <JsonPanel
          summary="Z nagrania albo zapisu — przez AI we własnym czacie"
          lead={<>Skopiuj polecenie — jest w nim plan z identyfikatorami punktów. Wklej je w swoim czacie razem z nagraniem albo zapisem, a odpowiedź (JSON) wklej tutaj: trafi do tego formularza.</>}
          fileName={`wyglosznie-${str(data, 'date') || entry.id.slice(0, 8)}.json`}
          exportDoc={() => exportScriptorium('wygłoszenie', [entry], store)}
          description={() => deliveryPrompt(entry, store)}
          preview={(doc) => {
            const found = patchFromDoc(doc, { id: entry.id, kind: 'delivery' }, store, SCRIPTORIUM_SPEC);
            if ('error' in found) return found;
            const all = deliveryPlan(entry, store).flatMap((p) => p.points);
            const coverage = coverageOf(found.patch);
            const unknown = orphanCoverage(coverage, all).length;
            return {
              lines: [...found.lines, ...(coverage.length > 0 ? [countsLine(coverageCounts(all, coverage, addedRows(found.patch)))] : [])],
              warnings: [...found.warnings, ...(unknown > 0 ? [`${unknown} oznaczeń wskazuje punkty, których nie ma w planie.`] : [])]
            };
          }}
          importLabel="Wpisz do formularza"
          onImport={async (doc) => {
            const found = patchFromDoc(doc, { id: entry.id, kind: 'delivery' }, store, SCRIPTORIUM_SPEC);
            if ('error' in found) throw new Error(found.error);
            set(found.patch);
            return { lines: ['Wpisane do formularza — zapisze się samo.'], warnings: found.warnings };
          }}
        />
      )}
    </div>
  );
}

/* -- Am Text: seine Wygłoszenia ------------------------------------------------------------------ */

export function DeliveriesBox({ store, library, text, readOnly }: { store: LibraryStore; library: OpenLibrary; text: LibEntry; readOnly: boolean }) {
  const list = deliveriesOf(text, store);
  const plan = planOf(text.data);
  return (
    <section className="lib-box">
      <h2 className="lib-box-h">Wygłoszenia</h2>
      {list.length === 0 ? <p>Jeszcze nie wygłoszony. Po kazaniu dopisz, kiedy i gdzie — i co z planu padło.</p> : (
        <ul className="lib-rel">
          {list.map((d) => {
            const counts = countsLine(coverageCounts(plan, coverageOf(d.data), addedRows(d.data).filter((a) => a.text.trim() !== '')));
            return (
              <li key={d.id}>
                <a href={viewPath('scriptorium', library.libraryId, d.id)}>{[str(d.data, 'date') || 'bez daty', str(d.data, 'occasion')].filter(Boolean).join(' · ')}</a>
                {counts !== '' && <span className="lib-row-meta"> — {counts}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {!readOnly && <a className="wk-link-btn" href={viewPath('scriptorium', library.libraryId, 'nowy', 'delivery', `texts=${text.id}`)}>+ Wygłoszenie</a>}
    </section>
  );
}
