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
import { finishRun, levelOf, runAnswer, runCard, runDone, factsOfCard, startRun, type RunRecord, type RunSession } from './wmRuns';
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
  const [saving, setSaving] = useState(false);
  /* 2026-11-10 (Eigentümer) — nach einer falschen Antwort darf man den Durchgang von vorn beginnen (für „Mistrzowsko"). */
  const [lastWrong, setLastWrong] = useState(false);
  /* 2026-11-14 — die Tafel „dieser Durchgang bringt keine Stufe mehr" wurde für diesen Durchgang schon gezeigt (weiter trotzdem). */
  const [lostSeen, setLostSeen] = useState<string | null>(null);
  const fresh = () => startRun(newId(), place, cards.map((c) => c.key), Date.now(), facts);
  const restart = () => { last.current = null; setLastWrong(false); setSession(fresh()); };
  /*
    2026-11-10 (Eigentümer: „keine leeren Seiten, die nur sagen, dass es jetzt beginnt oder dass es zu Ende ist — wer erobern will,
    erobert gleich; danach gleich zurück zur Karte, dort sieht man, was sich geändert hat") — der Durchgang beginnt sofort.
  */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (allowed !== true || session !== null) return;
    if (cards.length === 0) { onCloseRef.current(null); return; }
    setSession(fresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal, sobald der Durchgang erlaubt ist
  }, [allowed]);

  if (allowed === false) {
    return (
      <div className="cg-world-run" data-world-run="server-old">
        <p className="cg-muted">{t('cogitaWorld.run.serverOld')}</p>
        <div className="wk-actions"><button type="button" className="wk-btn" onClick={() => onClose(null)}>{t('cogitaWorld.run.close')}</button></div>
      </div>
    );
  }

  if (session === null) return <p className="cg-muted" data-world-run="starting" data-world-run-for={level}>{t('cogitaWorld.run.title', { name })}{rule === undefined ? '' : ` · ${t('cogitaWorld.run.rule', { pct: rule.pct, attempts: attemptsText(rule.attempts, t) })}`}</p>;

  const key = runCard(session);
  const card = key === null ? undefined : byKey.get(key);
  const finish = (s: RunSession) => {
    const run = finishRun(s, Date.now(), learner.holder.kind === 'role' ? [learner.holder.roleId] : []);
    const after = levelOf([...mine, run], eff.rules, eff.levels).level;
    setSaving(true);
    void learner.keepRun(run).catch(() => undefined).finally(() => {
      setSaving(false);
      /* Gleich zurück zur Karte: dort spielt sie ab, was sich geändert hat, und der Weg sagt, was nun folgt. */
      onCloseRef.current({ run, before: before.level, after });
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
  /*
    2026-11-14 (Eigentümer: „bringt der Durchgang wegen einer falschen Antwort keine bessere Stufe mehr, eine Tafel mit dem Vorschlag einer
    neuen Runde und der Erklärung, warum es nicht reicht") — ZU VIELE FEHLER FÜR DAS ZIEL: zählt eine Stufe „beim ersten Mal", jeder Fehler
    beim ersten Versuch; „mit einer Korrektur", was auch beim zweiten nicht sass; „beliebig" geht nie verloren. Ist schon die letzte Stufe
    erreicht, ist das Ziel der Stern: ein einziger Fehler beim ersten Versuch genügt.
  */
  const total = session.order.length;
  const aimStar = before.level >= eff.levels;
  const firstWrong = Object.values(session.first).filter((c) => c < 0.999).length;
  const secondWrong = Object.keys(session.second).filter((k) => (session.second[k] ?? 1) < 0.999).length;
  const failed = rule === undefined ? 0 : rule.attempts === 'first' ? firstWrong : rule.attempts === 'one' ? secondWrong : 0;
  const maxFail = rule === undefined ? total : total - Math.ceil((total * rule.pct) / 100 - 1e-9);
  const lost = aimStar ? firstWrong > 0 : failed > maxFail;
  if (lost && lostSeen !== session.id && last.current === null && !saving) {
    return (
      <div className="cg-world-run cg-wm-lost" data-world-run-lost={aimStar ? 'star' : level}>
        <h3>{t('cogitaWorld.run.lostTitle')}</h3>
        <p>{aimStar ? t('cogitaWorld.run.lostStar') : t('cogitaWorld.run.lostLevel', { level, pct: rule?.pct ?? 0, attempts: rule === undefined ? '' : attemptsText(rule.attempts, t), failed, allowed: maxFail })}</p>
        <p className="cg-muted">{t('cogitaWorld.run.lostSays')}</p>
        <div className="wk-actions">
          <button type="button" className="wk-btn" autoFocus onClick={restart} data-world-run-lost-restart="">{t('cogitaWorld.run.newRound')}</button>
          <button type="button" className="wk-btn wk-btn-line" onClick={() => setLostSeen(session.id)} data-world-run-lost-go="">{t('cogitaWorld.run.goOn')}</button>
        </div>
      </div>
    );
  }
  const mistaken = lastWrong || session.retrying || Object.values(session.first).some((c) => c < 0.999);
  return (
    <div className="cg-world-run" data-world-run="ask" data-world-run-card={card.key} data-world-run-again={session.retrying ? '1' : '0'}
      data-world-run-first={Object.values(session.first).filter((c) => c >= 0.999).length}>
      <p className="cg-muted">{t('cogitaWorld.run.title', { name })} · {session.retrying ? t('cogitaWorld.run.again') : t('cogitaWorld.run.of', { n: Math.min(n, session.order.length), all: session.order.length })}</p>
      {/* 2026-11-14 (Eigentümer: „ein Fortschrittsbalken zeigt, wo wir gerade stehen") — wie viele Karten des Durchgangs schon gefragt sind. */}
      <span className="cg-wm-runbar" role="progressbar" aria-valuemin={0} aria-valuemax={session.order.length} aria-valuenow={session.order.length - session.queue.length}
        aria-label={t('cogitaWorld.run.of', { n: Math.min(n, session.order.length), all: session.order.length })} data-world-run-progress={session.order.length - session.queue.length}>
        <i ref={(el) => { if (el !== null) el.style.width = `${session.order.length === 0 ? 0 : Math.round((100 * (session.order.length - session.queue.length)) / session.order.length)}%`; }} />
      </span>
      <CardFace key={`${session.id}:${card.key}:${session.attempts}`} card={card} lib={lib} lang={L}
        stats={{ marks: () => learner.marks(card.key, card.fingerprint, renamer(lib.merges())), spacing: learner.spacing }}
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
