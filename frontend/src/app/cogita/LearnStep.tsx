/**
 * 0109 — DER SCHRITT „NAUCZ SIĘ" (COGITA.md §15): erledigt, sobald der Mensch
 * die Karten der Bibliothek (oder einer Powtórka darin) bis zur Schwelle kann.
 *
 * <b>Die Kenntnis rechnet sein Browser</b> aus seinen eigenen Antworten — der
 * Dienst sieht sie nicht. Erreicht sie die Schwelle, hakt der Browser den
 * Schritt ab, wie „Zrobione" (der Dienst erlaubt es nur bei Schritten, die die
 * Person selbst abhakt). Erledigt bleibt erledigt, auch wenn die Kenntnis
 * später nachlässt — die nächste Powtórka zeigt es ihm.
 *
 * <code>
 *   LearnStep   beim Menschen, in „Twoje kroki": wie weit, „Ucz się" an Ort und Stelle
 *   PickLearn   im Reiter „Kroki": welche Bibliothek, welche Powtórka, bis wohin
 * </code>
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { libraryKindOf } from '../library/library';
import { useLibraries } from '../library/LibraryPick';
import { useLibraryStore } from '../library/libraryStore';
import { useMe, useWho } from '../core/me';
import type { SeatView } from '../seats/seatContext';
import { dueText, markOwnStep, type StepState } from '../steps/steps';
import type { Card } from './cardBasics';
import { readPlan } from './revision';
import { RevisionRun } from './RevisionRun';
import { learnedShare, seatCtx, useSeatLearner, useSeatLibrary } from './seatLearn';
import { Bar, CogitaContext, percent } from './ui';
import { Loading } from '../ui/Loading';

export interface LearnDraft {
  readonly libraryId: string;
  /** Leer: alle Karten der Bibliothek. */
  readonly revisionId: string;
  /** 0..1 — die mittlere Kenntnis, ab der der Schritt erledigt ist. */
  readonly threshold: number;
}

export function LearnStep({ seat, registrationId, step }: { seat: SeatView; registrationId: string; step: StepState }) {
  const target = step.learn!;
  const opened = useSeatLibrary(seat, target.libraryId ?? '');
  const { lib, name } = opened;
  const { learner, failed } = useSeatLearner(seat, lib);
  const [open, setOpen] = useState(false);
  const [measured, setMeasured] = useState<{ share: number; cards: readonly Card[] } | null>(null);
  const [tick, setTick] = useState(0);
  const ticking = useRef(false);
  const ctx = useMemo(() => (lib == null ? null : seatCtx(lib, opened, seat.token)), [lib, opened, seat.token]);

  useEffect(() => (learner === null ? undefined : learner.subscribe(() => setTick((n) => n + 1))), [learner]);
  useEffect(() => {
    if (lib == null || learner === null) return undefined;
    let alive = true;
    void learnedShare(lib, learner, target.revisionId).then((r) => { if (alive) setMeasured(r); }, () => undefined);
    return () => { alive = false; };
  }, [lib, lib?.revision, learner, tick, target.revisionId]);

  /* Die Schwelle erreicht: abhaken — einmal; erledigt bleibt erledigt. */
  const reached = measured !== null && measured.cards.length > 0 && measured.share >= target.threshold;
  useEffect(() => {
    if (!reached || step.status === 'done' || step.stepId === null || ticking.current) return;
    ticking.current = true;
    void markOwnStep(seat.token, registrationId, step.stepId, true)
      .then(() => seat.reload(), () => undefined)
      .finally(() => { ticking.current = false; });
  }, [reached, step.status, step.stepId, seat, registrationId]);

  /* Ohne Powtórka: alle Karten, das Vergessende zuerst. */
  const source = useMemo(() => {
    if (target.revisionId !== null) {
      const doc = lib?.docs('revision').find((r) => r.id === target.revisionId);
      return { revisionId: target.revisionId, title: typeof doc?.data.name === 'string' ? doc.data.name : step.label };
    }
    const cards = measured?.cards ?? [];
    return { plan: readPlan(cards, { mode: 'temporal', stackSize: 20 }), cards, title: step.label };
    // Der Plan bleibt, solange dieselben Karten gelten — sonst finge der Lauf bei jeder Antwort neu an.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.revisionId, lib, step.label, measured?.cards]);

  const status = step.status === 'done' ? 'zrobione' : step.status === 'overdue' ? 'po terminie' : 'do zrobienia';
  return (
    <>
      <div className="wk-step-head">
        <span className={`wk-step-mark is-${step.status}`} aria-hidden="true">{step.status === 'done' ? '✓' : step.status === 'overdue' ? '!' : '○'}</span>
        <div className="wk-step-text">
          <strong>{step.label}</strong>
          <span className="wk-row-side">{' · '}{status}{step.dueAt !== null && step.status !== 'done' && ` · do ${dueText(step.dueAt)}`}</span>
          {step.help !== null && <p className="wk-hint">{step.help}</p>}
          <p className="wk-hint" data-learn-line="">
            {lib === undefined ? 'Otwieranie bazy wiedzy…'
              : lib === null ? 'Baza wiedzy kursu nie jest dostępna z tego linku — zapytaj prowadzących.'
              : measured === null ? 'Liczenie, ile już umiesz…'
              : measured.cards.length === 0 ? 'W tej bazie wiedzy nie ma jeszcze kart.'
              : `Umiesz ${percent(measured.share)} — cel: ${percent(target.threshold)} · ${name}`}
          </p>
          {measured !== null && measured.cards.length > 0 && <Bar value={measured.share} label="Ile już umiesz" />}
          {failed !== null && <p className="wk-error">{failed}</p>}
        </div>
        {lib != null && measured !== null && measured.cards.length > 0 && (
          <button type="button" className={step.status === 'done' ? 'wk-link-btn' : 'wk-btn'} data-learn-open="" onClick={() => setOpen(!open)}>
            {open ? 'Zwiń' : step.status === 'done' ? 'Powtórz' : 'Ucz się'}
          </button>
        )}
      </div>
      {open && lib != null && ctx !== null && (
        <div className="wk-step-body">
          <CogitaContext.Provider value={ctx}>
            <RevisionRun lib={lib} learner={learner} source={source} onClose={() => setOpen(false)} />
          </CogitaContext.Provider>
        </div>
      )}
    </>
  );
}

/** Im Reiter „Kroki": aus welcher Bibliothek, welche Powtórka (oder alle Karten), bis zu welcher Kenntnis. */
export function PickLearn({ value, onPick }: { value: LearnDraft; onPick: (next: LearnDraft) => void }) {
  const all = useLibraries();
  /* 0110 — nauczyć się można z bazy wiedzy, nie z biblioteki. */
  const libraries = all == null ? all : all.filter((l) => libraryKindOf(l) === 'knowledge');
  const me = useMe(useWho());
  const chosen = libraries?.find((l) => l.libraryId === value.libraryId) ?? null;
  const { store } = useLibraryStore(me?.ring ?? null, chosen);
  const revisions = store?.loaded === true ? store.ofKind('revision') : null;
  return (
    <>
      <label className="wk-inline">
        <span className="wk-hint">Z bazy wiedzy</span>
        {libraries === undefined ? <Loading lines={1} /> : (
          <select value={value.libraryId} data-learn-library="" onChange={(e) => onPick({ ...value, libraryId: e.target.value, revisionId: '' })}>
            <option value="">— wybierz —</option>
            {(libraries ?? []).map((l) => <option key={l.libraryId} value={l.libraryId}>{l.name}</option>)}
            {value.libraryId !== '' && chosen === null && <option value={value.libraryId}>(niedostępna) {value.libraryId.slice(0, 8)}</option>}
          </select>
        )}
      </label>
      {value.libraryId !== '' && (
        <label className="wk-inline">
          <span className="wk-hint">Powtórka</span>
          <select value={value.revisionId} data-learn-revision="" onChange={(e) => onPick({ ...value, revisionId: e.target.value })}>
            <option value="">— wszystkie karty bazy wiedzy —</option>
            {(revisions ?? []).map((r) => <option key={r.id} value={r.id}>{typeof r.data.name === 'string' ? r.data.name : 'Powtórka'}</option>)}
            {value.revisionId !== '' && revisions !== null && !revisions.some((r) => r.id === value.revisionId) && <option value={value.revisionId}>(usunięta)</option>}
          </select>
        </label>
      )}
      <label className="wk-inline">
        <span className="wk-hint">Zrobione przy</span>
        <input type="number" min={10} max={100} step={5} value={Math.round(value.threshold * 100)} style={{ width: '5em' }} data-learn-threshold=""
          onChange={(e) => onPick({ ...value, threshold: Math.max(0.1, Math.min(1, Number(e.target.value) / 100 || 0.8)) })} />
        <span className="wk-hint">% znajomości</span>
      </label>
    </>
  );
}
