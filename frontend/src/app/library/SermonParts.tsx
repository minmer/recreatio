/**
 * EIN KAZANIE AUF DER SEITE (2026-10-21) — der Plan und die Wygłoszenia.
 *
 * <code>
 *   PlanSection        die Punkte, nummeriert, mit Zitaten und Fussnoten — und,
 *                      wenn ein Wygłoszenie gewählt ist, je Punkt: powiedziane /
 *                      krótko / pominięte, die Stelle im Nagranie, was dazukam
 *   DeliveriesSection  die Wygłoszenia, neueste zuerst; das gewählte mit Player,
 *                      kurzem Bericht und dem Zapis
 *   MediaPlayer        eine Datei spielt hier; YouTube und Seiten öffnen sich
 * </code>
 *
 * <b>Ein Plan, viele Aufnahmen.</b> Der Plan steht einmal; wer ein
 * Wygłoszenie wählt, sieht AUF dem Plan, was diesmal gesagt wurde — statt
 * eines zweiten Plans je Aufnahme. Ein Klick auf eine Zeit springt im Player
 * dorthin (oder öffnet YouTube an der Stelle).
 */

import { Fragment, useMemo, type MutableRefObject } from 'react';

import { str, type LibEntry, type Lookup } from './libraryKinds';
import { parseMarkup, type Block } from './libraryMarkup';
import { Blocks, countNotes, NoteList, type Notes } from './markupView';
import {
  addedOf, countsLine, coverageCounts, coverageIndex, coverageOf, mediaFile, pointKindLabel, pointLine, pointNumbers,
  secondsOf, stateLabel, timeText, type AddedItem, type CoverageItem, type PlanPoint
} from './sermon';

export interface ParsedPoint {
  readonly point: PlanPoint;
  /** Gelesen in `TextArticle` — die Fussnoten hängen an genau diesen Bäumen. */
  readonly blocks: readonly Block[];
}

const dateWords = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m === null) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
};

/* -- Die Stelle im Nagranie --------------------------------------------------------------------- */

export function MediaPlayer({ url, kind, media }: { url: string; kind: 'audio' | 'video'; media?: MutableRefObject<HTMLMediaElement | null> }) {
  const file = mediaFile(url);
  const keep = (el: HTMLMediaElement | null) => { if (media !== undefined) media.current = el; };
  if (file === 'audio') return <audio ref={keep} className="lib-audio" controls preload="metadata" src={url} />;
  if (file === 'video') return <video ref={keep} className="lib-video" controls preload="metadata" src={url} />;
  if (!/^https?:\/\//i.test(url)) return null;
  return <a className="lib-recording" href={url} target="_blank" rel="noreferrer noopener">{kind === 'audio' ? 'Nagranie' : 'Wideo'} ↗</a>;
}

const STATE_SIGN: Record<string, string> = { said: '✓', short: '◐', skipped: '✕' };

function Mark({ item, onSeek }: { item: CoverageItem | undefined; onSeek?: (seconds: number) => void }) {
  if (item === undefined || item.state === '') return null;
  const seconds = item.at === '' ? null : secondsOf(item.at);
  return (
    <p className={`lib-mark is-${item.state}`}>
      <span className="lib-mark-state"><span aria-hidden="true">{STATE_SIGN[item.state]}</span> {stateLabel(item.state)}</span>
      {seconds !== null && (onSeek === undefined
        ? <span className="lib-mark-time">{timeText(seconds)}</span>
        : <button type="button" className="lib-mark-time" onClick={() => onSeek(seconds)} aria-label={`Odtwórz od ${timeText(seconds)}`}>▶ {timeText(seconds)}</button>)}
      {item.note.trim() !== '' && <span className="lib-mark-note">{item.note}</span>}
    </p>
  );
}

function Added({ item, look, onSeek }: { item: AddedItem; look: Lookup; onSeek?: (seconds: number) => void }) {
  const seconds = item.at === '' ? null : secondsOf(item.at);
  return (
    <li className="lib-point lib-added">
      <span className="lib-point-no" aria-hidden="true">+</span>
      <div className="lib-point-body">
        <p className="lib-mark is-added">
          <span className="lib-mark-state">Dodane w tym wygłoszeniu</span>
          {seconds !== null && onSeek !== undefined && <button type="button" className="lib-mark-time" onClick={() => onSeek(seconds)}>▶ {timeText(seconds)}</button>}
        </p>
        <p>{pointLine(item.text, look, 1200)}</p>
      </div>
    </li>
  );
}

/* -- Der Plan ---------------------------------------------------------------------------------- */

export function PlanSection({ points, look, notes, prefix, delivery, onSeek }: {
  points: readonly ParsedPoint[];
  look: Lookup;
  notes: Notes;
  prefix: string;
  /** Das gewählte Wygłoszenie — seine Zeichen stehen auf dem Plan. */
  delivery: LibEntry | null;
  onSeek?: (seconds: number) => void;
}) {
  const numbers = useMemo(() => pointNumbers(points.map((p) => p.point)), [points]);
  const coverage = delivery === null ? null : coverageIndex(coverageOf(delivery.data));
  const added = delivery === null ? [] : addedOf(delivery.data);
  const known = new Set(points.map((p) => p.point.id));
  const after = new Map<string, AddedItem[]>();
  for (const item of added) {
    const at = known.has(item.after) ? item.after : '';
    after.set(at, [...(after.get(at) ?? []), item]);
  }

  return (
    <section className={`lib-plan${coverage === null ? '' : ' is-marked'}`} aria-label="Plan">
      <h3 className="lib-section">Plan</h3>
      {coverage !== null && <p className="lib-plan-legend">Na planie: ✓ powiedziane · ◐ krótko · ✕ pominięte</p>}
      <ol className="lib-plan-list">
        {points.map(({ point, blocks }) => {
          const mark = coverage?.get(point.id);
          const state = coverage === null ? '' : mark?.state || 'open';
          return (
            <Fragment key={point.id}>
              <li className={`lib-point is-d${point.depth} is-${point.kind}${state === '' ? '' : ` is-${state}`}`}>
                <span className="lib-point-no">{numbers.get(point.id)}</span>
                <div className="lib-point-body">
                  {point.kind !== 'thought' && point.kind !== 'quote' && <span className="lib-point-kind">{pointKindLabel(point.kind)}</span>}
                  <Blocks blocks={blocks} look={look} notes={notes} prefix={prefix} />
                  {coverage !== null && <Mark item={mark} onSeek={onSeek} />}
                </div>
              </li>
              {(after.get(point.id) ?? []).map((item, i) => <Added key={`${point.id}-a${i}`} item={item} look={look} onSeek={onSeek} />)}
            </Fragment>
          );
        })}
        {(after.get('') ?? []).map((item, i) => <Added key={`end-${i}`} item={item} look={look} onSeek={onSeek} />)}
      </ol>
    </section>
  );
}

/* -- Die Wygłoszenia ----------------------------------------------------------------------------- */

function Transcript({ delivery, look, prefix }: { delivery: LibEntry; look: Lookup; prefix: string }) {
  const blocks = useMemo(() => parseMarkup(str(delivery.data, 'transcript')), [delivery]);
  const notes = useMemo(() => countNotes([blocks], look), [blocks, look]);
  if (blocks.length === 0) return null;
  return (
    <details className="lib-transcript">
      <summary>Zapis wygłoszenia</summary>
      <div className="lib-body"><Blocks blocks={blocks} look={look} notes={notes} prefix={`${prefix}tr-`} /></div>
      <NoteList notes={notes} prefix={`${prefix}tr-`} />
    </details>
  );
}

export function DeliveriesSection({ deliveries, chosen, onChoose, plan, look, prefix, media }: {
  deliveries: readonly LibEntry[];
  chosen: LibEntry | null;
  onChoose: (id: string | null) => void;
  plan: readonly PlanPoint[];
  look: Lookup;
  prefix: string;
  media: MutableRefObject<HTMLMediaElement | null>;
}) {
  if (deliveries.length === 0) return null;
  return (
    <section className="lib-deliveries" aria-label="Wygłoszenia">
      <h3 className="lib-section">{deliveries.length === 1 ? 'Wygłoszenie' : `Wygłoszenia (${deliveries.length})`}</h3>
      <ul className="lib-delivery-list">
        {deliveries.map((delivery) => {
          const d = delivery.data;
          const on = chosen?.id === delivery.id;
          const counts = countsLine(coverageCounts(plan, coverageOf(d), addedOf(d)));
          const recorded = str(d, 'audio') !== '' || str(d, 'video') !== '';
          return (
            <li key={delivery.id} className={on ? 'is-on' : undefined}>
              <button type="button" className="lib-delivery" aria-pressed={on} onClick={() => onChoose(on ? null : delivery.id)}>
                <span className="lib-delivery-when">{str(d, 'date') === '' ? 'Bez daty' : dateWords(str(d, 'date'))}</span>
                <span className="lib-delivery-meta">{[str(d, 'occasion'), str(d, 'place'), str(d, 'audience'), str(d, 'duration')].filter(Boolean).join(' · ')}</span>
                {counts !== '' && <span className="lib-delivery-counts">{counts}</span>}
                <span className="lib-delivery-act">{on ? 'Zwiń' : recorded ? 'Posłuchaj i zobacz na planie' : 'Zobacz na planie'}</span>
              </button>
              {on && (
                <div className="lib-delivery-open">
                  {str(d, 'audio') !== '' && <MediaPlayer url={str(d, 'audio')} kind="audio" media={media} />}
                  {str(d, 'video') !== '' && <MediaPlayer url={str(d, 'video')} kind="video" media={str(d, 'audio') !== '' && mediaFile(str(d, 'audio')) !== null ? undefined : media} />}
                  {str(d, 'readings') !== '' && <p className="lib-readings"><span>Czytania:</span> {str(d, 'readings')}</p>}
                  {str(d, 'summary') !== '' && <p className="lib-delivery-summary">{str(d, 'summary')}</p>}
                  {plan.length === 0 && addedOf(d).length > 0 && (
                    <ul className="lib-delivery-added">{addedOf(d).map((item, i) => <li key={i}>{pointLine(item.text, look, 1200)}</li>)}</ul>
                  )}
                  <Transcript delivery={delivery} look={look} prefix={prefix} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
