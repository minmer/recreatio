/**
 * 2026-11-09 — EIN DURCHGANG (spec §7.1, Entscheidung 7): jede Karte des Ortes einmal, gemischt; eine falsche kommt am Ende
 * wieder, bis sie sitzt; eine Karte, deren Infos alle schon sassen (auch aus anderen Kombinationen), fragt er nicht mehr. Alles beim ersten
 * Mal richtig: „Mistrzowsko" — alle Stufen auf einmal, die höchste Auszeichnung. Jede Antwort ist eine gewöhnliche Antwort (`via: "run:<id>"`); am Ende geht der Durchgang als Stapel `run`
 * hinaus (nur für den Halter versiegelt) und die Stufe rechnet sich neu. Ein Dienst vor 0140: der Durchgang ist verborgen.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { tFor } from '../../core/i18n';
import { newId } from '../../core/ids';
import type { Card } from '../cardBasics';
import { CardFace, storedGiven } from '../CardFace';
import { baseLang } from '../lang';
import { learnFeatures, renamer, type Learner } from '../learn';
import type { CogitaLibrary } from '../store';
import { attemptsText } from './WorldLevels';
import { effectiveWorldFor, reportDueFor } from './wmReview';
import { finishRun, levelOf, perfectRun, runAnswer, runCard, runDone, factsOfCard, startRun, type RunRecord, type RunSession } from './wmRuns';
import './worldmap.css';

export interface RunOutcome {
  readonly run: RunRecord;
  readonly before: number;
  readonly after: number;
}

export function WorldRun({ lib, learner, place, name, cards, onClose }: {
  lib: CogitaLibrary;
  learner: Learner;
  place: string;
  name: string;
  /** Die Karten des Ortes. */
  cards: readonly Card[];
  onClose: (outcome: RunOutcome | null) => void;
}) {
  const L = baseLang(lib);
  const t = tFor(L);
  const eff = effectiveWorldFor(lib, learner);
  const mine = useMemo(() => [...learner.progress.runs.values()].filter((r) => r.place === place), [learner.progress.runs, place]);
  const before = levelOf(mine, eff.rules, eff.levels);
  const level = Math.min(eff.levels, before.level + 1);
  const rule = eff.rules[level - 1];
  const byKey = useMemo(() => new Map(cards.map((c) => [c.key, c] as const)), [cards]);
  const facts = useMemo(() => Object.fromEntries(cards.map((c) => [c.key, factsOfCard(c)] as const)), [cards]);
  const [allowed, setAllowed] = useState<boolean | null>(learner.holder.kind === 'local' ? true : null);
  useEffect(() => {
    if (learner.holder.kind === 'local') return undefined;
    let alive = true;
    void learnFeatures().then((f) => { if (alive) setAllowed(f.run); });
    return () => { alive = false; };
  }, [learner]);
  const [session, setSession] = useState<RunSession | null>(null);
  const last = useRef<number | null>(null);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [saving, setSaving] = useState(false);
  /* 2026-11-10 (Eigentümer) — nach einer falschen Antwort darf man den Durchgang von vorn beginnen (für „Mistrzowsko"). */
  const [lastWrong, setLastWrong] = useState(false);
  const fresh = () => startRun(newId(), place, cards.map((c) => c.key), Date.now(), facts);
  const restart = () => { last.current = null; setLastWrong(false); setOutcome(null); setSession(fresh()); };

  if (allowed === false) {
    return (
      <div className="cg-world-run" data-world-run="server-old">
        <p className="cg-muted">{t('cogitaWorld.run.serverOld')}</p>
        <div className="wk-actions"><button type="button" className="wk-btn" onClick={() => onClose(null)}>{t('cogitaWorld.run.close')}</button></div>
      </div>
    );
  }

  if (outcome !== null) {
    const r = outcome.run;
    const reached = outcome.after > outcome.before;
    const perfect = perfectRun(r);
    return (
      <div className={`cg-world-run${perfect ? ' is-perfect' : ''}`} data-world-run="result" data-world-run-level={outcome.after} data-world-run-reached={reached ? '1' : '0'} data-world-run-perfect={perfect ? '1' : '0'}>
        <h3>{t('cogitaWorld.run.title', { name })}</h3>
        {perfect && <p className="cg-wm-perfect is-big" data-world-perfect="">★ {t('cogitaWorld.run.perfect')} — {t('cogitaWorld.run.perfectSays')}</p>}
        <p>{t('cogitaWorld.run.result', { first: r.firstTry, all: r.cards, after: r.afterCorrection })}</p>
        <p className={reached ? 'wk-note' : 'cg-muted'}>
          {reached ? (outcome.after - outcome.before > 1 ? t('cogitaWorld.run.reachedMany', { from: outcome.before + 1, level: outcome.after }) : t('cogitaWorld.run.reached', { level: outcome.after })) : t('cogitaWorld.run.notReached', { level, pct: rule?.pct ?? 0 })}
          {reached && outcome.after >= eff.levels ? ` · ${t('cogitaWorld.run.conquered')}` : ''}
        </p>
        <div className="wk-actions">
          <button type="button" className="wk-btn" autoFocus onClick={() => onClose(outcome)} data-world-run-close="">{t('cogitaWorld.run.close')}</button>
          {!perfect && <button type="button" className="wk-btn wk-btn-line" onClick={restart} data-world-run-again="">{t('cogitaWorld.run.tryAgain')}</button>}
        </div>
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="cg-world-run" data-world-run="intro" data-world-run-for={level}>
        <h3>{t('cogitaWorld.run.title', { name })}</h3>
        <p><strong>{t('cogitaWorld.run.forLevel', { level })}</strong>{rule === undefined ? '' : ` · ${t('cogitaWorld.run.rule', { pct: rule.pct, attempts: attemptsText(rule.attempts, t) })}`}</p>
        <p className="cg-muted">{t('cogitaWorld.run.intro', { count: cards.length })}</p>
        <div className="wk-actions">
          <button type="button" className="wk-btn" autoFocus disabled={allowed !== true || cards.length === 0}
            onClick={() => setSession(startRun(newId(), place, cards.map((c) => c.key), Date.now(), facts))} data-world-run-start="">{t('cogitaWorld.run.start')}</button>
          <button type="button" className="wk-link-btn" onClick={() => onClose(null)}>{t('cogitaWorld.run.close')}</button>
        </div>
      </div>
    );
  }

  const key = runCard(session);
  const card = key === null ? undefined : byKey.get(key);
  const finish = (s: RunSession) => {
    const run = finishRun(s, Date.now(), learner.holder.kind === 'role' ? [learner.holder.roleId] : []);
    const after = levelOf([...mine, run], eff.rules, eff.levels).level;
    setSaving(true);
    void learner.keepRun(run).catch(() => undefined).finally(() => {
      setSaving(false);
      setOutcome({ run, before: before.level, after });
      /* Step 3 · 3 — ein eroberter Ort ändert, was fällig ist: die Erinnerung des Dienstes gleich neu (alle Karten der Baza). */
      void lib.cards().then((r) => reportDueFor(lib, r.cards, learner, renamer(lib.merges())), () => undefined);
    });
  };
  const next = () => {
    if (key === null || last.current === null) return;
    const s = runAnswer(session, key, last.current);
    last.current = null;
    if (runDone(s)) { setSession(s); finish(s); return; }
    setSession(s);
  };
  if (saving || card === undefined) return <p className="cg-muted" data-world-run="saving">{t('cogitaWorld.run.saving')}</p>;
  const n = session.order.length - session.queue.length + 1;
  const mistaken = lastWrong || session.retrying || Object.values(session.first).some((c) => c < 0.999);
  return (
    <div className="cg-world-run" data-world-run="ask" data-world-run-card={card.key} data-world-run-again={session.retrying ? '1' : '0'}
      data-world-run-first={Object.values(session.first).filter((c) => c >= 0.999).length}>
      <p className="cg-muted">{t('cogitaWorld.run.title', { name })} · {session.retrying ? t('cogitaWorld.run.again') : t('cogitaWorld.run.of', { n: Math.min(n, session.order.length), all: session.order.length })}</p>
      <CardFace key={`${session.id}:${card.key}:${session.attempts}`} card={card} lib={lib} lang={L}
        onAnswered={(o, given, ms) => {
          if (last.current !== null) return;
          last.current = o.correctness;
          setLastWrong(o.correctness < 0.999);
          learner.record(card, o.correctness, { via: `run:${session.id}`, ms, given: storedGiven(card, given) });
        }}
        onNext={next} />
      {mistaken ? (
        <div className="wk-note cg-wm-restart" data-world-run-restart-hint="">
          <span>{t('cogitaWorld.run.restartSays')}</span>
          <button type="button" className="wk-btn wk-btn-line is-small" onClick={restart} data-world-run-restart="">{t('cogitaWorld.run.restart')}</button>
        </div>
      ) : (
        <p className="cg-wm-restart"><button type="button" className="wk-link-btn" onClick={restart} data-world-run-restart="">{t('cogitaWorld.run.restart')}</button></p>
      )}
    </div>
  );
}
