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

import { useEffect, useRef, useState } from 'react';

import { rich, useT } from '../core/i18n';
import { keysFor } from '../core/ringOf';
import { WorkspaceError, whoIsThere } from '../core/session';
import { loadChildren } from '../areas/profile';
import { lessonMessage, postToClass, STATE_SIGN, stateOf } from '../areas/school';
import { selfOf } from '../roles/roles';
import { toast } from '../ui/dialogs';
import { areasNow } from '../workspace/viewData';
import { viewPath } from '../routes';
import { JsonPanel } from '../ui/JsonPanel';
import type { OpenLibrary } from '../library/library';
import { patchFromDoc } from '../library/libraryJson';
import { exportScriptorium, SCRIPTORIUM_SPEC } from './scriptoriumJson';
import { COVERAGE_STATES, ids, itemsOf, LESSON_STATES, str, type EntryData, type LibEntry } from '../library/libraryKinds';
import type { LibraryStore } from '../library/libraryStore';
import { FieldList } from '../library/LibraryFields';
import { MediaPlayer } from './SermonParts';
import {
  addedData, countsLine, coverageCounts, coverageData, coverageIndex, coverageOf, deliveryPlan, deliveryPrompt,
  deliveriesOf, mediaFile, orphanCoverage, planOf, pointLine, pointNumbers, timeText,
  type AddedItem, type CoverageItem, type CoverageState
} from './sermon';
import { WritingArea } from './WritingTools';
/* 0134 — die Lekcja in einer Klasse hat ihre Gestalt dort, wo auch die Schule sie zeigt. */
import '../areas/school.css';

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
  const t = useT();
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
      <section className="lib-cover" aria-label={t('scriptorium.delivery.coverage.label')}>
        <h2 className="wk-h2">{t('scriptorium.delivery.coverage.title')}</h2>
        <p className="lib-cover-lead">{t('scriptorium.delivery.coverage.pickFirst')}</p>
      </section>
    );
  }

  return (
    <section className="lib-cover" aria-label={t('scriptorium.delivery.coverage.label')}>
      <h2 className="wk-h2">{t('scriptorium.delivery.coverage.title')}</h2>
      {counts !== '' && <p className="lib-cover-lead">{counts}</p>}
      {parts.map(({ text, points }) => {
        const numbers = pointNumbers(points);
        return (
          <div key={text.id} className="lib-cover-text-block">
            {parts.length > 1 && <h3 className="lib-section">{str(text.data, 'title') || t('common.untitled')}</h3>}
            {points.length === 0 ? (
              <p className="lib-cover-lead">
                {rich(t('scriptorium.delivery.coverage.noPlan'), { a: (s) => <a href={viewPath('scriptorium', library.libraryId, text.id)}>{s}</a> })}
              </p>
            ) : (
              <ol className="lib-cover-list">
                {points.map((p) => {
                  const item = index.get(p.id);
                  const state = item?.state ?? '';
                  return (
                    <li key={p.id} className={`lib-cover-row is-d${p.depth} is-${state === '' ? 'open' : state}`}>
                      <span className="lib-point-no">{numbers.get(p.id)}</span>
                      <span className="lib-cover-point">{pointLine(p.text, store, 240) || t('scriptorium.delivery.coverage.emptyPoint')}</span>
                      <span className="wk-seg lib-cover-states" role="group" aria-label={t('scriptorium.delivery.coverage.how')}>
                        {COVERAGE_STATES.map((s) => (
                          <button key={s.value} type="button" disabled={readOnly} aria-pressed={state === s.value}
                            className={state === s.value ? `wk-seg-opt wk-seg-on is-${s.value}` : 'wk-seg-opt'}
                            onClick={() => change(p.id, { state: state === s.value ? '' : s.value })}>
                            <span aria-hidden="true">{SIGN[s.value]}</span> {s.label}
                          </button>
                        ))}
                      </span>
                      <span className="lib-cover-time">
                        <input value={item?.at ?? ''} disabled={readOnly} placeholder={t('scriptorium.delivery.timePlaceholder')} aria-label={t('scriptorium.delivery.timeInRecording')} inputMode="numeric"
                          onChange={(e) => change(p.id, { at: e.target.value.trim() })} />
                        {now !== null && !readOnly && (
                          <button type="button" className="wk-link-btn" title={t('scriptorium.delivery.timeFromPlayerTitle')} aria-label={t('scriptorium.delivery.timeFromPlayer')}
                            onClick={() => { const s = now(); if (s !== null) change(p.id, { at: timeText(s), state: state === '' ? 'said' : state }); }}>⏱</button>
                        )}
                      </span>
                      <input className="lib-cover-note" value={item?.note ?? ''} disabled={readOnly} placeholder={t('scriptorium.delivery.coverage.notePlaceholder')}
                        aria-label={t('scriptorium.delivery.coverage.note')} onChange={(e) => change(p.id, { note: e.target.value })} />
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
          <button type="button" className="wk-link-btn" onClick={() => markRest('said')}>{t('scriptorium.delivery.coverage.restSaid')}</button>
          <button type="button" className="wk-link-btn" onClick={() => markRest('skipped')}>{t('scriptorium.delivery.coverage.restSkipped')}</button>
          {coverage.length > 0 && <button type="button" className="wk-link-btn" onClick={() => set({ coverage: [] })}>{t('scriptorium.delivery.coverage.clear')}</button>}
        </div>
      )}
      {orphans.length > 0 && (
        <p className="wk-warn">
          {t('scriptorium.delivery.coverage.orphans', { count: orphans.length })}{' '}
          {!readOnly && <button type="button" className="wk-link-btn" onClick={() => set({ coverage: coverage.filter((c) => !orphans.includes(c)).map(coverageData) })}>{t('scriptorium.delivery.coverage.removeThem')}</button>}
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
  const t = useT();
  const rows = addedRows(data);
  const points = deliveryPlan(entry, store).flatMap((p) => p.points);
  const numbers = pointNumbers(points);
  const write = (next: readonly AddedItem[]) => set({ added: next.map(addedData) });
  const change = (at: number, patch: Partial<AddedItem>) => write(rows.map((row, i) => (i === at ? { ...row, ...patch } : row)));

  return (
    <section className="lib-cover" aria-label={t('scriptorium.delivery.added.title')}>
      <h2 className="wk-h2">{t('scriptorium.delivery.added.title')}</h2>
      {rows.length === 0 && <p className="lib-cover-lead">{t('scriptorium.delivery.added.lead')}</p>}
      {rows.length > 0 && (
        <ul className="lib-added-list">
          {rows.map((row, at) => (
            <li key={at} className="lib-added-row">
              <textarea rows={2} value={row.text} disabled={readOnly} placeholder={t('scriptorium.delivery.added.placeholder')} aria-label={t('scriptorium.delivery.added.title')}
                onChange={(e) => change(at, { text: e.target.value })} />
              <span className="lib-cover-time">
                <input value={row.at} disabled={readOnly} placeholder={t('scriptorium.delivery.timePlaceholder')} aria-label={t('scriptorium.delivery.timeInRecording')} onChange={(e) => change(at, { at: e.target.value.trim() })} />
                {now !== null && !readOnly && (
                  <button type="button" className="wk-link-btn" title={t('scriptorium.delivery.timeFromPlayerTitle')} aria-label={t('scriptorium.delivery.timeFromPlayer')}
                    onClick={() => { const s = now(); if (s !== null) change(at, { at: timeText(s) }); }}>⏱</button>
                )}
              </span>
              <select value={row.after} disabled={readOnly} aria-label={t('scriptorium.delivery.added.after')} onChange={(e) => change(at, { after: e.target.value })}>
                <option value="">{t('scriptorium.delivery.added.atEnd')}</option>
                {points.map((p) => <option key={p.id} value={p.id}>{t('scriptorium.delivery.added.afterPoint', { no: numbers.get(p.id) ?? '', text: pointLine(p.text, undefined, 50) })}</option>)}
              </select>
              {!readOnly && <button type="button" className="wk-link-btn lib-danger-link" aria-label={t('common.remove')} onClick={() => write(rows.filter((_, i) => i !== at))}>×</button>}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" onClick={() => { const s = now === null ? null : now(); write([...rows, { text: '', at: s === null ? '' : timeText(s), after: '' }]); }}>{t('scriptorium.delivery.added.add')}</button>
        </div>
      )}
    </section>
  );
}

/* -- 0134: eine Lekcja in einer Klasse ------------------------------------------------------------ */

interface ClassChoice { readonly areaId: string; readonly name: string }

/** Die Klassen im Bereich dieses Skryptorium (einer Szkoła) — `null`: wird gefragt. */
function useClasses(areaId: string): readonly ClassChoice[] | null {
  const t = useT();
  const [found, setFound] = useState<readonly ClassChoice[] | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all([
      loadChildren(areaId).then((r) => r.children, () => []),
      areasNow().catch(() => [])
    ]).then(([children, areas]) => {
      if (!alive) return;
      const names = new Map(areas.map((a) => [a.areaId.toLowerCase(), a.name] as const));
      setFound(children.filter((c) => c.kind === 'class')
        .map((c) => ({ areaId: c.areaId.toLowerCase(), name: names.get(c.areaId.toLowerCase()) ?? t('scriptorium.delivery.lesson.classFallback') }))
        .sort((a, b) => a.name.localeCompare(b.name, t.locale, { numeric: true })));
    });
    return () => { alive = false; };
  }, [areaId, t]);
  return found;
}

/**
 * LEKCJA W KLASIE — nur, wo es Klassen gibt (im Skryptorium einer Szkoła) oder das Wygłoszenie schon
 * einer Klasse gehört: welche Klasse, wie es lief (geplant, gehalten, teilweise, nicht gehalten),
 * das Zadanie — und das Ganze als Nachricht in den Kanał der Klasse.
 */
function LessonSection({ store, library, data, set, readOnly }: {
  store: LibraryStore;
  library: OpenLibrary;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
}) {
  const t = useT();
  const classes = useClasses(library.areaId);
  const [sending, setSending] = useState(false);
  const classArea = str(data, 'classArea').trim().toLowerCase();
  if (classes === null || (classes.length === 0 && classArea === '')) return null;
  const state = stateOf(data);

  const send = async () => {
    setSending(true);
    try {
      const who = await whoIsThere();
      if (who === null) throw new WorkspaceError(t('scriptorium.delivery.lesson.signIn'));
      const keys = await keysFor(who);
      const person = selfOf(keys.graph);
      if (keys.ring === null || person === null) throw new WorkspaceError(t('scriptorium.delivery.lesson.passwordFirst'));
      const text = store.get(ids(data, 'texts')[0] ?? '');
      await postToClass(keys.ring, {
        classAreaId: classArea, personId: person.id,
        text: lessonMessage({ date: str(data, 'date'), title: text === undefined ? null : str(text.data, 'title'), summary: str(data, 'summary'), homework: str(data, 'homework') })
      });
      toast(t('scriptorium.delivery.lesson.sent'), { kind: 'ok' });
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : t('scriptorium.delivery.lesson.sendFailed'), { kind: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="lib-cover sc-lesson" aria-label={t('scriptorium.delivery.lesson.title')} data-lesson-form="">
      <h2 className="wk-h2">{t('scriptorium.delivery.lesson.title')}</h2>
      <p className="lib-cover-lead">
        {t('scriptorium.delivery.lesson.lead')}
      </p>
      <label className="wk-field">
        <span>{t('scriptorium.delivery.lesson.class')}</span>
        <select value={classArea} disabled={readOnly} data-lesson-class="" onChange={(e) => set({ classArea: e.target.value })}>
          <option value="">{t('scriptorium.delivery.lesson.noClass')}</option>
          {classes.map((c) => <option key={c.areaId} value={c.areaId}>{c.name}</option>)}
          {classArea !== '' && !classes.some((c) => c.areaId === classArea) && <option value={classArea}>{t('scriptorium.delivery.lesson.otherClass')}</option>}
        </select>
      </label>
      {classArea !== '' && (
        <>
          <div className="wk-field">
            <span>{t('scriptorium.delivery.lesson.state')}</span>
            <span className="wk-seg sc-states" role="group" aria-label={t('scriptorium.delivery.lesson.state')}>
              {LESSON_STATES.map((s) => (
                <button key={s.value} type="button" disabled={readOnly} aria-pressed={state === s.value} data-lesson-state={s.value}
                  className={state === s.value ? `wk-seg-opt wk-seg-on is-${s.value}` : 'wk-seg-opt'}
                  onClick={() => set({ state: s.value })}>
                  <span aria-hidden="true">{STATE_SIGN[s.value]}</span> {s.label}
                </button>
              ))}
            </span>
          </div>
          <label className="wk-field">
            <span>{t('scriptorium.delivery.lesson.homework')}</span>
            <textarea rows={2} value={str(data, 'homework')} disabled={readOnly} placeholder={t('scriptorium.delivery.lesson.homeworkPlaceholder')} data-lesson-homework=""
              onChange={(e) => set({ homework: e.target.value })} />
          </label>
          {!readOnly && (
            <div className="wk-actions">
              <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={sending} data-lesson-send="" onClick={() => void send()}>
                {sending ? t('scriptorium.delivery.lesson.sending') : t('scriptorium.delivery.lesson.send')}
              </button>
              <span className="lib-cover-lead">{t('scriptorium.delivery.lesson.sendLead')}</span>
            </div>
          )}
        </>
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
  const t = useT();
  const media = useRef<HTMLMediaElement | null>(null);
  const audio = str(data, 'audio');
  const video = str(data, 'video');
  const file = mediaFile(audio) !== null || mediaFile(video) !== null;
  const now = file ? () => (media.current === null ? null : media.current.currentTime) : null;

  return (
    <div className="lib-delivery-form">
      <LessonSection store={store} library={library} data={data} set={set} readOnly={readOnly} />
      <FieldList store={store} kind="delivery" data={data} set={set} readOnly={readOnly} only={['texts', 'date', 'occasion', 'place', 'audience', 'readings']} />

      <section className="lib-cover" aria-label={t('scriptorium.delivery.recording')}>
        <h2 className="wk-h2">{t('scriptorium.delivery.recording')}</h2>
        <FieldList store={store} kind="delivery" data={data} set={set} readOnly={readOnly} only={['audio', 'video', 'duration']} />
        {(audio !== '' || video !== '') && (
          <div className="lib-recordings">
            {audio !== '' && <MediaPlayer url={audio} kind="audio" media={mediaFile(audio) !== null ? media : undefined} />}
            {video !== '' && <MediaPlayer url={video} kind="video" media={mediaFile(audio) === null && mediaFile(video) !== null ? media : undefined} />}
          </div>
        )}
        {file && <p className="lib-cover-lead">{t('scriptorium.delivery.listenHint')}</p>}
      </section>

      <CoverageEditor store={store} library={library} entry={entry} data={data} set={set} readOnly={readOnly} now={now} />
      <AddedEditor store={store} entry={entry} data={data} set={set} readOnly={readOnly} now={now} />

      <FieldList store={store} kind="delivery" data={data} set={set} readOnly={readOnly} only={['summary']} />

      <details className="wk-fold">
        <summary>{t('scriptorium.delivery.transcript')}</summary>
        <WritingArea store={store} value={str(data, 'transcript')} readOnly={readOnly}
          placeholder={t('scriptorium.delivery.transcriptPlaceholder')} onChange={(next) => set({ transcript: next })} />
      </details>

      {!readOnly && (
        <JsonPanel
          summary={t('scriptorium.delivery.ai.summary')}
          lead={t('scriptorium.delivery.ai.lead')}
          fileName={`wyglosznie-${str(data, 'date') || entry.id.slice(0, 8)}.json`}
          exportDoc={() => exportScriptorium(t('scriptorium.delivery.exportName'), [entry], store)}
          description={() => deliveryPrompt(entry, store)}
          preview={(doc) => {
            const found = patchFromDoc(doc, { id: entry.id, kind: 'delivery' }, store, SCRIPTORIUM_SPEC);
            if ('error' in found) return found;
            const all = deliveryPlan(entry, store).flatMap((p) => p.points);
            const coverage = coverageOf(found.patch);
            const unknown = orphanCoverage(coverage, all).length;
            return {
              lines: [...found.lines, ...(coverage.length > 0 ? [countsLine(coverageCounts(all, coverage, addedRows(found.patch)))] : [])],
              warnings: [...found.warnings, ...(unknown > 0 ? [t('scriptorium.delivery.ai.unknownPoints', { count: unknown })] : [])]
            };
          }}
          importLabel={t('scriptorium.delivery.ai.import')}
          onImport={async (doc) => {
            const found = patchFromDoc(doc, { id: entry.id, kind: 'delivery' }, store, SCRIPTORIUM_SPEC);
            if ('error' in found) throw new Error(found.error);
            set(found.patch);
            return { lines: [t('scriptorium.delivery.ai.imported')], warnings: found.warnings };
          }}
        />
      )}
    </div>
  );
}

/* -- Am Text: seine Wygłoszenia ------------------------------------------------------------------ */

export function DeliveriesBox({ store, library, text, readOnly }: { store: LibraryStore; library: OpenLibrary; text: LibEntry; readOnly: boolean }) {
  const t = useT();
  const list = deliveriesOf(text, store);
  const plan = planOf(text.data);
  return (
    <section className="lib-box">
      <h2 className="lib-box-h">{t('scriptorium.delivery.box.title')}</h2>
      {list.length === 0 ? <p>{t('scriptorium.delivery.box.none')}</p> : (
        <ul className="lib-rel">
          {list.map((d) => {
            const counts = countsLine(coverageCounts(plan, coverageOf(d.data), addedRows(d.data).filter((a) => a.text.trim() !== '')));
            return (
              <li key={d.id}>
                <a href={viewPath('scriptorium', library.libraryId, d.id)}>{[str(d.data, 'date') || t('scriptorium.noDate'), str(d.data, 'occasion')].filter(Boolean).join(' · ')}</a>
                {counts !== '' && <span className="lib-row-meta"> — {counts}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {!readOnly && <a className="wk-link-btn" href={viewPath('scriptorium', library.libraryId, 'nowy', 'delivery', `texts=${text.id}`)}>{t('scriptorium.delivery.box.add')}</a>}
    </section>
  );
}
