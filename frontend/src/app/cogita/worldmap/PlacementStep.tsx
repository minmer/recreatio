/**
 * 2026-11-12 — DIE EINSTUFUNG IM SPIELER („Sprawdź, ile już umiesz", Schritt "explore"): Anfang (Art wählen, „Dalej bez
 * sprawdzania"), Fragen (echte Fragen der Baza, jede Antwort mit \`via: "placement"\`; Gekonntes zählt als richtig, ohne gefragt zu
 * werden), „Zakończ na razie" / „Kontynuuj", der Abschluss (gutgeschrieben, erobert, Lücken mit „Ucz się", „Ustaw jako cel").
 * Die Regeln rechnet \`wmPlacement.ts\`; der Lauf steht in der Stelle \`explore:<bereich>\` des Lernenden.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { tFor } from '../../core/i18n';
import type { Card } from '../cardBasics';
import { CardFace } from '../CardFace';
import { baseLang } from '../lang';
import { renamer, type Learner } from '../learn';
import type { CogitaLibrary } from '../store';
import { placementWorld } from './placementWorld';
import { runsOn } from './wmFeatures';
import { finishRun } from './wmRuns';
import {
  answer, frontOf, isKnownSkip, newAdaptive, newTarget, nextAsk, packRun, readExplore, scopeKey, scopeTowers, unpackRun,
  type Ask, type ExploreMode, type PlacementCtx, type PlacementRun
} from './wmPlacement';
import './worldmap.css';

export function PlacementStep({ lib, cards, learner, config, onDone, onLearn, onGoal }: {
  lib: CogitaLibrary;
  cards: readonly Card[];
  learner: Learner;
  config: Readonly<Record<string, unknown>>;
  /** Weiter in der Erzählung (zu Ende, ausgelassen, oder nichts offen). */
  onDone: () => void;
  onLearn?: (place: string) => void;
  onGoal?: (place: string) => void;
}) {
  const t = tFor(baseLang(lib));
  const cfg = useMemo(() => readExplore(config), [config]);
  const key = scopeKey(cfg);
  const [tick, setTick] = useState(0);
  useEffect(() => learner.subscribe(() => setTick((n) => n + 1)), [learner]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- jede Antwort, jede Gutschrift: neu
  const pw = useMemo(() => placementWorld(lib, cards, learner), [lib, lib.revision, cards, learner, tick]);
  const scope = useMemo(() => scopeTowers(pw.world, pw.lines, cfg), [pw, cfg]);
  const cardByKey = useMemo(() => new Map(cards.map((c) => [c.key, c] as const)), [cards]);
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  const ctx: PlacementCtx = {
    world: pw.world, state: pw.state, scope, rules: pw.rules, random: Math.random,
    cardsOf: (p) => (pw.state.places.get(p)?.cards ?? []).filter((k) => cardByKey.has(k)),
    lastAnswered: (k) => { const m = learner.marks(k, cardByKey.get(k)?.fingerprint, rename); return m.length === 0 ? 0 : m[m.length - 1].at; }
  };
  const pos = learner.progress.positions.get(key);
  const kept = unpackRun(pos?.visited ?? []);
  const done = pos?.done === true;
  const skipped = (pos?.chapters ?? []).includes('skip');

  /* Die Zielstufe: nur mit Stufen und wenn der Dienst Durchgänge speichert. */
  const levelsOffered = pw.levels <= 0 || !runsOn(learner.holder) ? [] : (cfg.targetLevels ?? Array.from({ length: pw.levels }, (_, i) => i + 1)).filter((l) => l >= 1 && l <= pw.levels);
  const modes = cfg.modes.filter((m) => m === 'adaptive' || levelsOffered.length > 0);
  const [mode, setMode] = useState<ExploreMode>(modes.includes(cfg.default) ? cfg.default : modes[0] ?? 'adaptive');
  const [level, setLevel] = useState(levelsOffered[levelsOffered.length - 1] ?? 1);

  const [run, setRun] = useState<PlacementRun | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [ended, setEnded] = useState<PlacementRun | null>(null);
  const last = useRef<number | null>(null);
  const asked = useRef(new Set<string>());

  const keep = (r: PlacementRun | null, extra: { done?: boolean; skip?: boolean; reset?: boolean } = {}) => {
    void learner.keepPosition({
      flow: key, step: '', visited: r === null ? [] : packRun(r), at: Date.now(),
      ...(extra.done === true ? { done: true } : {}), ...(extra.skip === true ? { chapters: ['skip'] } : {}), ...(extra.reset === true ? { reset: true } : {})
    }).catch(() => undefined);
  };
  /* Was eine Antwort bewirkt: Gutschrift, Rücknahme (Werte), ein entschiedener Durchgang (gespeichert wie jeder Durchgang). */
  const apply = (r: PlacementRun, a: Ask, correctness: number): PlacementRun => {
    const out = answer(ctx, r, a, correctness >= 0.999, cfg, correctness);
    if (out.credit !== undefined) void learner.keepPlaced({ [out.credit]: Date.now() }).catch(() => undefined);
    if (out.withdraw !== undefined) void learner.keepPlaced({ [out.withdraw]: 0 }).catch(() => undefined);
    if (out.decided !== undefined) void learner.keepRun(finishRun(out.decided.session, Date.now(), learner.holder.kind === 'role' ? [learner.holder.roleId] : [])).catch(() => undefined);
    return out.run;
  };
  /* Die nächste Frage — gekonnte Karten zählen als richtig, ohne gefragt zu werden. */
  const advance = (start: PlacementRun) => {
    let r = start;
    for (let guard = 0; guard < 400; guard += 1) {
      const next = nextAsk(ctx, r, asked.current);
      r = next.run;
      if (next.ask === null) { finish(r); return; }
      if (isKnownSkip(pw.state, next.ask.card)) { asked.current.add(next.ask.card); r = apply(r, next.ask, 1); continue; }
      asked.current.add(next.ask.card);
      setRun(r);
      setAsk(next.ask);
      keep(r);
      return;
    }
    finish(r);
  };
  const finish = (r: PlacementRun) => { setRun(null); setAsk(null); setEnded(r); keep(r, { done: cfg.once }); };
  const begin = (again: boolean) => {
    asked.current = new Set();
    const r = mode === 'target' ? newTarget(level) : newAdaptive();
    keep(r, { reset: again });
    setEnded(null);
    advance(r);
  };
  const resume = () => { if (kept !== null) { setEnded(null); advance(kept); } };
  const stop = () => { if (run !== null) keep(run); setRun(null); setAsk(null); };

  const front = frontOf(ctx, run ?? kept ?? newAdaptive());
  const open = front.length > 0;
  /* Nichts offen und kein Lauf: keine leere Seite — gleich weiter. */
  const pass = run === null && ended === null && !open && (kept === null || frontOf(ctx, kept).length === 0);
  useEffect(() => { if (pass) onDone(); }, [pass]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (p: string) => pw.world.places.get(p)?.label ?? p;
  const title = cfg.title !== '' ? cfg.title : t('cogitaWorld.placement.title');

  if (ended !== null) {
    const credited = ended.mode === 'adaptive' ? ended.credited : [];
    const reached = ended.mode === 'target' ? ended.reached : [];
    const gaps = ended.mode === 'adaptive' ? ended.burned : ended.failed;
    return (
      <section className="cg-placement is-end" data-placement="end" data-placement-credited={credited.length} data-placement-reached={reached.length} data-placement-gaps={gaps.length}>
        <h3>{t('cogitaWorld.placement.endTitle')}</h3>
        <p>{credited.length > 0 && t('cogitaWorld.placement.credited', { count: credited.length })}{reached.length > 0 && t('cogitaWorld.placement.reached', { count: reached.length, level: ended.mode === 'target' ? ended.level : 1 })}{credited.length + reached.length === 0 && t('cogitaWorld.placement.nothingCredited')}</p>
        {gaps.length > 0 && (
          <>
            <p className="cg-muted">{t('cogitaWorld.placement.gaps', { count: gaps.length })}</p>
            <ul className="cg-placement-gaps">
              {gaps.map((p, i) => (
                <li key={p} data-placement-gap={p}>
                  <strong>{name(p)}</strong>
                  {onLearn !== undefined && <button type="button" className="wk-link-btn" onClick={() => onLearn(p)} data-placement-learn={p}>{t('cogitaWorld.placement.learn')}</button>}
                  {i === 0 && onGoal !== undefined && <button type="button" className="wk-link-btn" onClick={() => onGoal(p)} data-placement-goal={p}>{t('cogitaWorld.placement.goal')}</button>}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="wk-actions"><button type="button" className="wk-btn" autoFocus onClick={onDone} data-placement-next="">{t('cogitaWorld.placement.next')} ›</button></div>
      </section>
    );
  }

  if (run !== null && ask !== null) {
    const card = cardByKey.get(ask.card);
    const count = run.mode === 'adaptive' ? run.credited.length : run.reached.length;
    return (
      <section className="cg-placement is-ask" data-placement="ask" data-placement-tower={ask.place} data-placement-recheck={ask.recheck ? '1' : '0'} data-placement-count={count}>
        <p className="cg-muted cg-placement-head">
          <strong>{name(ask.place)}</strong>{ask.recheck ? ` · ${t('cogitaWorld.placement.recheck')}` : ''} · {t('cogitaWorld.placement.sofar', { count })}
          <button type="button" className="wk-link-btn" onClick={stop} data-placement-stop="">{t('cogitaWorld.placement.stop')}</button>
        </p>
        {card !== undefined && (
          <CardFace key={`${ask.card}:${asked.current.size}`} card={card} lib={lib}
            stats={{ marks: () => learner.marks(card.key, card.fingerprint, rename), spacing: learner.spacing }}
            onAnswered={(o, given, ms) => { if (last.current !== null) return; last.current = o.correctness; learner.record(card, o.correctness, { via: 'placement', ms, ...(typeof given === 'string' ? { given } : {}) }); }}
            onNext={() => { const c = last.current; last.current = null; if (c === null) return; advance(apply(run, ask, c)); }} />
        )}
      </section>
    );
  }

  /* Der Anfang: wählen, weitermachen, nochmals, oder ohne Prüfung weiter. */
  return (
    <section className="cg-placement is-start" data-placement="start" data-placement-open={front.length} data-placement-done={done ? '1' : '0'} data-placement-skipped={skipped ? '1' : '0'}>
      {/* Der "title" des Schrittes steht schon als Überschrift des Spielers. */}
      {cfg.title === '' && <h3>{title}</h3>}
      <p>{t('cogitaWorld.placement.says', { count: front.length, scope: [...scope].filter((p) => pw.state.places.get(p)?.conquered !== true).length })}</p>
      {done && <p className="cg-muted">{t('cogitaWorld.placement.doneBefore')}</p>}
      {skipped && !done && <p className="cg-muted">{t('cogitaWorld.placement.skippedBefore')}</p>}
      {kept === null || done ? (
        <>
          {modes.length > 1 && (
            <div className="cg-wm-modes" role="group" aria-label={t('cogitaWorld.placement.modeLabel')}>
              <button type="button" className={`cg-wm-mode${mode === 'adaptive' ? ' is-on' : ''}`} aria-pressed={mode === 'adaptive'} onClick={() => setMode('adaptive')} data-placement-mode="adaptive">{t('cogitaWorld.placement.adaptive')}</button>
              <button type="button" className={`cg-wm-mode${mode === 'target' ? ' is-on' : ''}`} aria-pressed={mode === 'target'} onClick={() => setMode('target')} data-placement-mode="target">{t('cogitaWorld.placement.target')}</button>
            </div>
          )}
          <p className="cg-muted">{mode === 'adaptive' ? t('cogitaWorld.placement.adaptiveSays', { streak: cfg.streak, errors: cfg.errors }) : t('cogitaWorld.placement.targetSays')}</p>
          {mode === 'target' && (
            <div className="cg-wm-modes" role="group" aria-label={t('cogitaWorld.placement.levelLabel')}>
              {levelsOffered.map((l) => <button key={l} type="button" className={`cg-wm-mode${level === l ? ' is-on' : ''}`} aria-pressed={level === l} onClick={() => setLevel(l)} data-placement-level={l}>{t('cogitaWorld.placement.level', { level: l })}</button>)}
            </div>
          )}
          <div className="wk-actions">
            <button type="button" className="wk-btn" autoFocus onClick={() => begin(done || skipped)} data-placement-start="">{done ? t('cogitaWorld.placement.again') : t('cogitaWorld.placement.start')}</button>
            <button type="button" className="wk-link-btn" onClick={() => { keep(kept, { skip: !done }); onDone(); }} data-placement-skip="">{done ? t('cogitaWorld.placement.next') : t('cogitaWorld.placement.skip')}</button>
          </div>
        </>
      ) : (
        <div className="wk-actions">
          <button type="button" className="wk-btn" autoFocus onClick={resume} data-placement-continue="">{t('cogitaWorld.placement.continue')}</button>
          <button type="button" className="wk-link-btn" onClick={() => { keep(kept, { skip: true }); onDone(); }} data-placement-skip="">{t('cogitaWorld.placement.skip')}</button>
        </div>
      )}
    </section>
  );
}
