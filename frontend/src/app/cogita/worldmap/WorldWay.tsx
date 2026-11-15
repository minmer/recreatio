/**
 * 2026-11-10 (Eigentümer) — DER WEG IN TEILEN: ein Ziel, das nicht gleich erreichbar ist, zeigt seinen Weg als Kette von Teilen
 * (Erzählung = Fahrt durch einen Abschnitt, Powtórka, direkt lernen, Zdobycie = Durchgang, am Ende die Fahne).
 * <code>
 *   WayChain     die Kette; erledigt ✓, eben erledigt (springt auf), jetzt (pulsiert), kommend
 *   NextView     im Vollbild der Teil „Dalej": nach jedem erledigten Teil der Weg und die Einladung zum nächsten
 * </code>
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { stepAction, stepMeta, stepText, type PanelCtx } from './WorldPanels';
import { stepKey, type Timetable } from './wmNav';
import type { PlanStep } from './wmPlan';
import type { LevelRule } from './wmRuns';
import './worldmap.css';

type PartState = 'done' | 'just' | 'skipped' | 'current' | 'next';

/** Die Zeichen der Teile (eigene Striche, in der Farbe des Textes). */
export function PartIcon({ kind }: { kind: PlanStep['kind'] | 'target' }): ReactNode {
  const d = kind === 'travel' ? 'M2 5.5 Q6 4 10 6 Q14 4 18 5.5 V16 Q14 14.5 10 16 Q6 14.5 2 16 Z M10 6 V16'
    : kind === 'review' ? 'M15.5 7 A6 6 0 1 0 16 12 M15.5 7 L15.8 3.4 M15.5 7 L12 6.4'
      : kind === 'learn' ? 'M4 3.5 H13 L16 6.5 V16.5 H4 Z M7 9 H13 M7 12 H13'
        : kind === 'target' ? 'M5 17.5 V2.5 M5 3 H15 L12.5 6.5 L15 10 H5'
          : 'M5 17 V7 H6.5 V4.5 H8.5 V7 H11.5 V4.5 H13.5 V7 H15 V17 Z M8.5 17 V13 A1.5 1.5 0 0 1 11.5 13 V17';
  return <svg className="cg-wm-picon" viewBox="0 0 20 20" aria-hidden="true"><path d={d} /></svg>;
}

/** Wie ein Teil kurz heisst (die Art), wohin er gehört (der Ort). */
function partWords(step: PlanStep, ctx: PanelCtx): { kind: string; where: string } {
  const { t, nameOf, state } = ctx;
  const where = step.kind === 'travel' ? nameOf(state.lines.sections.get(step.section)?.to ?? step.place) : nameOf(step.place);
  return { kind: t(`cogitaWorld.way.kind.${step.kind}`), where };
}

/** Erledigt ✓, übersprungen ↷ (2026-11-14). */
function PartMark({ state }: { state: PartState }) {
  if (state === 'skipped') return <span className="cg-wm-wcheck is-skipped" aria-hidden="true">↷</span>;
  return state === 'done' || state === 'just' ? <span className="cg-wm-wcheck" aria-hidden="true">✓</span> : null;
}

export function WayChain({ parts, ctx, target, big = false, more = 0, centre = false, drag = false, onPick, onStart }: {
  parts: readonly { readonly step: PlanStep; readonly state: PartState }[];
  ctx: PanelCtx;
  target: string;
  big?: boolean;
  /**
   * 2026-11-10 (Eigentümer: „der Weg waagerecht und rollbar, der jetzige Schritt in der Mitte; ein Klick auf einen Schritt zeigt,
   * wo er auf der Karte liegt") — der jetzige Teil steht in der Mitte (auch der erste und der letzte).
   */
  centre?: boolean;
  onPick?: (step: PlanStep) => void;
  /** 2026-11-14 — die Kette lässt sich mit der Maus ziehen und mit dem Rad rollen. */
  drag?: boolean;
  /** 2026-11-11 — Doppelklick auf einen Schritt: ihn beginnen (nicht schon erledigte). */
  onStart?: (step: PlanStep) => void;
  /** Weitere Teile, die nicht gezeigt sind (vor der Fahne). */
  more?: number;
}) {
  const { t, nameOf } = ctx;
  /* Ein langer Weg rollt zum jetzigen Teil (ein eben erledigter bleibt links daneben sichtbar). */
  const box = useRef<HTMLOListElement | null>(null);
  const at = parts.findIndex((p) => p.state === 'current');
  /* Ziehen (Maus) und Rad: die Kette rollt waagerecht; ein Zug ist kein Klick auf einen Schritt. */
  const pull = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  useEffect(() => {
    const ol = box.current;
    if (!drag || ol === null) return undefined;
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || ol.scrollWidth <= ol.clientWidth) return;
      e.preventDefault();
      ol.style.scrollBehavior = 'auto';
      ol.scrollLeft += e.deltaY;
    };
    ol.addEventListener('wheel', wheel, { passive: false });
    return () => ol.removeEventListener('wheel', wheel);
  }, [drag]);
  const dragProps = !drag ? {} : {
    onPointerDown: (e: React.PointerEvent<HTMLOListElement>) => { if (e.pointerType === 'mouse' && e.button === 0) pull.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false }; },
    onPointerMove: (e: React.PointerEvent<HTMLOListElement>) => {
      const d = pull.current;
      if (d === null || (e.buttons & 1) === 0) return;
      const dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dx) < 5) return;
      d.moved = true;
      e.currentTarget.style.scrollBehavior = 'auto';
      e.currentTarget.scrollLeft = d.left - dx;
    },
    onPointerUp: () => { if (pull.current !== null && !pull.current.moved) pull.current = null; },
    onPointerLeave: () => { if (pull.current !== null && !pull.current.moved) pull.current = null; },
    onClickCapture: (e: React.MouseEvent) => { if (pull.current?.moved === true) { e.stopPropagation(); e.preventDefault(); } pull.current = null; }
  };
  useEffect(() => {
    const ol = box.current;
    const li = at < 0 ? null : (ol?.children[at] as HTMLElement | undefined) ?? null;
    if (ol === null || li === null) return;
    const left = Math.max(0, li.offsetLeft - ol.clientWidth / 2 + li.offsetWidth / 2);
    if (typeof ol.scrollTo === 'function') ol.scrollTo({ left, behavior: 'smooth' }); else ol.scrollLeft = left;
  }, [at, parts.length]);
  return (
    <ol ref={box} className={`cg-wm-parts${big ? ' is-big' : ''}${centre ? ' is-centre' : ''}${drag ? ' is-drag' : ''}`} data-world-way={parts.length + more} {...dragProps}>
      {parts.map(({ step, state }, i) => {
        const w = partWords(step, ctx);
        return (
          <li key={`${stepKey(step)}:${i}`} className={`cg-wm-wpart is-${state} is-${step.kind}`} data-world-way-part={stepKey(step)} data-world-way-state={state}
            title={stepText(step, ctx)} ref={(el) => { el?.style.setProperty('--i', String(i)); }}>
            {onPick === undefined ? (
              <>
                <span className="cg-wm-wdot"><PartIcon kind={step.kind} /><PartMark state={state} /></span>
                <span className="cg-wm-wtext"><span className="cg-wm-wkind">{w.kind}</span><span className="cg-wm-wwhere">{w.where}</span></span>
              </>
            ) : (
              <button type="button" className="cg-wm-wbtn" onClick={() => onPick(step)} onDoubleClick={() => onStart?.(step)} data-world-way-show={stepKey(step)}>
                <span className="cg-wm-wdot"><PartIcon kind={step.kind} /><PartMark state={state} /></span>
                <span className="cg-wm-wtext"><span className="cg-wm-wkind">{w.kind}</span><span className="cg-wm-wwhere">{w.where}</span></span>
              </button>
            )}
          </li>
        );
      })}
      {more > 0 && <li className="cg-wm-wpart is-more" data-world-way-more={more}><span className="cg-wm-wdot">+{more}</span></li>}
      <li className="cg-wm-wpart is-target" data-world-way-target={target}>
        <span className="cg-wm-wdot"><PartIcon kind="target" /></span>
        <span className="cg-wm-wtext"><span className="cg-wm-wkind">{t('cogitaWorld.way.kind.target')}</span><span className="cg-wm-wwhere">{nameOf(target)}</span></span>
      </li>
    </ol>
  );
}

/** Wie lange der Weg nach einem Teil wartet, bevor der nächste von selbst beginnt (Sekunden). */
export const NEXT_AUTO_S = 6;

/**
 * 2026-11-10 (Eigentümer: „Prowadź mnie tutaj ist ein geführter Ablauf: nach jedem Teil geht es von selbst mit dem nächsten
 * weiter") — DER NÄCHSTE TEIL VON SELBST: nach `seconds` Sekunden, ausser man berührt etwas (eine Taste, ein Rad).
 */
export function useAutoGo(on: boolean, seconds: number, go: () => void): number | null {
  const [left, setLeft] = useState<number | null>(on ? seconds : null);
  const goRef = useRef(go);
  goRef.current = go;
  const counting = left !== null;
  useEffect(() => {
    if (!counting) return undefined;
    const stop = () => setLeft(null);
    const id = window.setInterval(() => { if (!document.hidden) setLeft((x) => (x === null ? null : x - 1)); }, 1000);
    window.addEventListener('pointerdown', stop, true);
    window.addEventListener('keydown', stop, true);
    window.addEventListener('wheel', stop, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('pointerdown', stop, true);
      window.removeEventListener('keydown', stop, true);
      window.removeEventListener('wheel', stop, true);
    };
  }, [counting]);
  useEffect(() => { if (left !== null && left <= 0) { setLeft(null); goRef.current(); } }, [left]);
  return left;
}

const NONE: ReadonlySet<string> = new Set();

/** Der Weg und die Einladung zum nächsten Teil (nach einem Teil; im Vollbild der Teil „Dalej"). */
export function NextView({ tt, ctx, rules, just, onGo, onMap, onEnd, onPrepare, auto = false, card = false, onShow, more, arrived, skipped = NONE, onUnskip }: {
  tt: Timetable;
  ctx: PanelCtx;
  rules: readonly LevelRule[];
  /** Was eben erledigt wurde (springt in der Kette auf). */
  just: ReadonlySet<string>;
  onGo: (step: PlanStep) => void;
  onMap: () => void;
  onEnd: () => void;
  /** 2026-11-10 — am Turm der zweite Weg: erst wiederholen, was man noch nicht kann. */
  onPrepare?: (step: PlanStep) => void;
  /** Eben ging ein Teil zu Ende: der nächste beginnt von selbst (nicht an einem Turm — dort wählt man —, nicht am Ziel). */
  auto?: boolean;
  /**
   * 2026-11-10 (Eigentümer: „der Weg erscheint als Karte über der Karte, unten; nach jedem Teil darüber mein Weg mit der Freude,
   * einen Schritt geschafft zu haben") — klein, über dem unteren Rand der Karte (die Karte zeigt, was sich änderte).
   */
  card?: boolean;
  /** Ein Schritt der Kette angeklickt: wo er auf der Karte liegt. */
  onShow?: (step: PlanStep) => void;
  /** Unter der Kette (die Karte des Weges): alle Teile, aufklappbar. */
  more?: ReactNode;
  /** 2026-11-12 (Prompt 25) — am Ende eines Weges zu einer Frage: der Abschluss („Sprawdź się") statt nur „Zakończ". */
  arrived?: ReactNode;
  /**
   * 2026-11-14 (Eigentümer: „alles soll überspringbar sein, auch gegen die Regeln") — den jetzigen Schritt überspringen; die
   * übersprungenen (ihre Schlüssel) stehen in der Kette mit ↷, am Ende lassen sie sich nachholen (`onUnskip`).
   */
  skipped?: ReadonlySet<string>;
  onUnskip?: () => void;
}) {
  const { t, nameOf } = ctx;
  const first = tt.upcoming[0];
  const left = useAutoGo(auto && ctx.canLearn && first !== undefined && first.kind !== 'run', NEXT_AUTO_S, () => { if (first !== undefined) onGo(first); });
  const all = tt.done.length + tt.upcoming.length;
  const parts = [
    ...tt.done.map((step) => ({ step, state: (skipped.has(stepKey(step)) ? 'skipped' : just.has(stepKey(step)) ? 'just' : 'done') as PartState })),
    ...tt.upcoming.map((step, i) => ({ step, state: (i === 0 ? 'current' : 'next') as PartState }))
  ];
  const next = tt.upcoming[0];
  const pct = all === 0 ? 100 : Math.round((100 * tt.done.length) / all);
  /* Was eben geschafft wurde (der letzte erledigte Teil, der neu ist). */
  const cheer = [...tt.done].reverse().find((s) => just.has(stepKey(s)));
  const skippedHere = tt.done.filter((s) => skipped.has(stepKey(s))).length;
  /*
    2026-11-10 (Eigentümer: „das Feld unten ist zu hoch; der nächste Schritt rechts und kürzer") — ALS LEISTE UNTER DER KARTE: links
    eine Zeile (Ziel, wie weit) und die Kette (rollbar, der jetzige Schritt in der Mitte), rechts kurz der nächste Schritt.
  */
  /*
    2026-11-14 (Eigentümer: „unten nur die Schritte; rechts oben zwei Knöpfe, Weiter und Beenden; links frei; die Leiste lässt sich
    ziehen und rollen") — DIE LEISTE DES WEGES: über die ganze Breite die Kette (ziehen mit der Maus, rollen mit dem Rad; ein Schritt
    angeklickt zeigt, wo er liegt, doppelt beginnt ihn), rechts oben „Przejdź do kroku" und „Zakończ". Überspringen, die Ansage und
    was der Schritt ist, stehen in der Tafel des Schrittes; der ganze Weg mit seinen Abzweigungen klein unter „≡".
  */
  if (card) {
    return (
      <section className="cg-wm-nextview is-card is-strip" data-world-next-view={next === undefined ? 'arrived' : stepKey(next)}
        {...(tt.done.length === 0 && next !== undefined ? { 'data-world-way-intro': all } : {})}>
        <div className="cg-wm-stripbar" {...(next === undefined ? { 'data-world-next-arrived': '' } : { 'data-world-next-invite': next.kind, 'data-world-announce': tt.done.length + 1 })}
          {...(cheer === undefined ? {} : skipped.has(stepKey(cheer)) ? { 'data-world-step-skipped': stepKey(cheer) } : { 'data-world-step-done': stepKey(cheer) })}>
          {more !== undefined && <span className="cg-wm-stripmore">{more}</span>}
          {next === undefined ? (
            <>
              <span className="cg-wm-stripnote"><PartIcon kind="target" /> {t('cogitaWorld.nav.arrived', { name: nameOf(tt.target) })}</span>
              {skippedHere > 0 && onUnskip !== undefined && ctx.canLearn && <button type="button" className="wk-btn wk-btn-line" onClick={onUnskip} title={t('cogitaWorld.way.endSkipped', { count: skippedHere })} data-world-way-unskip="">{t('cogitaWorld.way.unskip')}</button>}
              {arrived}
              <button type="button" className="wk-btn" autoFocus onClick={onEnd} data-world-next-end="">{t('cogitaWorld.way.finish')}</button>
            </>
          ) : (
            <>
              {left !== null && <span className="cg-wm-stripnote" role="timer" aria-live="off" data-world-next-auto={left}>{t('cogitaWorld.finish.autoGo', { s: left })}</span>}
              {ctx.canLearn && <button type="button" className="wk-btn cg-wm-go" autoFocus onClick={() => onGo(next)} title={stepText(next, ctx)} data-world-next-go={next.kind}>{t('cogitaWorld.way.start')} ▶</button>}
              <button type="button" className="wk-btn wk-btn-line" onClick={onEnd} data-world-next-stop="">{t('cogitaWorld.way.exit')}</button>
            </>
          )}
        </div>
        <WayChain parts={parts} ctx={ctx} target={tt.target} centre drag {...(onShow === undefined ? {} : { onPick: onShow })}
          onStart={ctx.canLearn ? (s) => { if (tt.upcoming.some((u) => stepKey(u) === stepKey(s))) onGo(s); } : undefined} />
      </section>
    );
  }
  return (
    <section className={`cg-wm-nextview${card ? ' is-card' : ''}`} data-world-next-view={next === undefined ? 'arrived' : stepKey(next)}>
      {cheer !== undefined && (
        <p className="cg-wm-cheer" role="status" data-world-step-done={stepKey(cheer)}>
          <span className="cg-wm-cheermark" aria-hidden="true">✓</span> {t('cogitaWorld.way.stepDone', { text: stepText(cheer, ctx) })}
        </p>
      )}
      <header className="cg-wm-nexthead">
        <h2><PartIcon kind="target" /> {t('cogitaWorld.way.title', { name: nameOf(tt.target) })}</h2>
        <div className="cg-wm-wbar" role="progressbar" aria-valuemin={0} aria-valuemax={all} aria-valuenow={tt.done.length} aria-label={t('cogitaWorld.nav.progress', { done: tt.done.length, all })}>
          <span ref={(el) => { if (el !== null) el.style.width = `${pct}%`; }} />
        </div>
        <p className="cg-wm-meta">{t('cogitaWorld.nav.progress', { done: tt.done.length, all })}{tt.cards > 0 ? ` · ${t('cogitaWorld.map.cardsToGo', { count: tt.cards })}` : ''}</p>
      </header>
      <WayChain parts={parts} ctx={ctx} target={tt.target} big={!card} centre={card} {...(onShow === undefined ? {} : { onPick: onShow })} />
      {next === undefined ? (
        <div className="cg-wm-invite is-arrived" data-world-next-arrived="">
          <p className="cg-wm-invitebig"><PartIcon kind="target" /> {t('cogitaWorld.nav.arrived', { name: nameOf(tt.target) })}</p>
          {arrived}
          <div className="wk-actions">
            <button type="button" className="wk-btn" autoFocus onClick={onEnd} data-world-next-end="">{t('cogitaWorld.way.finish')}</button>
            <button type="button" className="wk-link-btn" onClick={onMap}>{t('cogitaWorld.way.toMap')}</button>
          </div>
        </div>
      ) : (
        <div className={`cg-wm-invite is-${next.kind}`} data-world-next-invite={next.kind}>
          <span className="cg-wm-invitekind"><PartIcon kind={next.kind} /> {tt.done.length > 0 ? t('cogitaWorld.way.nextAfter') : t('cogitaWorld.way.nextPart')}</span>
          <p className="cg-wm-invitebig">{stepText(next, ctx)}</p>
          {stepMeta(next, ctx, rules) !== '' && <p className="cg-wm-meta">{stepMeta(next, ctx, rules)}</p>}
          <div className="wk-actions">
            {ctx.canLearn && <button type="button" className="wk-btn cg-wm-go" autoFocus onClick={() => onGo(next)} data-world-next-go={next.kind}>{stepAction(next, ctx) ?? t('cogitaWorld.way.go')} ▶</button>}
            {ctx.canLearn && next.kind === 'run' && next.prepare.length > 0 && onPrepare !== undefined && <button type="button" className="wk-btn wk-btn-line" onClick={() => onPrepare(next)} data-world-next-prepare={next.prepare.length}>{t('cogitaWorld.panel.prepareN', { count: next.prepare.length })}</button>}
            {left !== null && (
              <p className="cg-fin-auto" role="timer" aria-live="off" data-world-next-auto={left}>
                <span className="cg-fin-autobar" ref={(el) => { el?.style.setProperty('--auto-s', `${NEXT_AUTO_S}s`); }} aria-hidden="true" />
                {t('cogitaWorld.finish.autoGo', { s: left })}
              </p>
            )}
            <button type="button" className="wk-link-btn" onClick={onMap} data-world-next-map="">{t('cogitaWorld.way.toMap')}</button>
            <button type="button" className="wk-link-btn" onClick={onEnd} data-world-next-stop="">{t('cogitaWorld.nav.end')}</button>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * 2026-11-14 (Eigentümer: „ein Klick auf Start: der Schritt fliegt aus der Leiste unten in die Mitte, dort steht in einem Satz, was
 * jetzt getan wird — Wiederholung, eine Geschichte erkunden, einen Turm erobern — mit einem Knopf Start") — DIE TAFEL DES SCHRITTES
 * über der Mitte der Karte. Esc oder ein Klick daneben schliesst sie (der Weg bleibt).
 */
export function StepSheet({ step, n, all, ctx, rules, onStart, onPrepare, onSkip, onClose }: {
  step: PlanStep;
  n: number;
  all: number;
  ctx: PanelCtx;
  rules: readonly LevelRule[];
  onStart: () => void;
  onPrepare?: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const { t } = ctx;
  const w = partWords(step, ctx);
  const meta = stepMeta(step, ctx, rules);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <div className="cg-wm-sheetback" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} data-world-sheet-back="">
      <section className={`cg-wm-sheet is-${step.kind}`} role="dialog" aria-modal="true" aria-labelledby="cg-wm-sheet-head" data-world-sheet={stepKey(step)}>
        <button type="button" className="cg-wm-wayx cg-wm-sheetx" onClick={onClose} aria-label={t('cogitaWorld.way.toMap')} title={t('cogitaWorld.way.toMap')} data-world-sheet-close="">×</button>
        <span className="cg-wm-sheeticon" aria-hidden="true"><PartIcon kind={step.kind} /></span>
        <span className="cg-wm-annnum">{t('cogitaWorld.way.partOf', { n, all })}</span>
        <h3 id="cg-wm-sheet-head" className="cg-wm-sheethead"><span className="cg-wm-waynextkind">{w.kind}</span> {w.where}</h3>
        <p className="cg-wm-sheetabout">{t(`cogitaWorld.way.about.${step.kind}`)}</p>
        {meta !== '' && <p className="cg-wm-meta">{meta}</p>}
        <div className="cg-wm-sheetbtns">
          <button type="button" className="wk-btn cg-wm-go" autoFocus onClick={onStart} data-world-sheet-start={step.kind}>{stepAction(step, ctx) ?? t('cogitaWorld.way.start')} ▶</button>
          {step.kind === 'run' && step.prepare.length > 0 && onPrepare !== undefined && <button type="button" className="wk-btn wk-btn-line" onClick={onPrepare} data-world-sheet-prepare={step.prepare.length}>{t('cogitaWorld.panel.prepareN', { count: step.prepare.length })}</button>}
          <button type="button" className="wk-btn wk-btn-line" onClick={onSkip} title={t('cogitaWorld.way.skipSays')} data-world-sheet-skip={stepKey(step)}>{t('cogitaWorld.way.skip')} ↷</button>
        </div>
      </section>
    </div>
  );
}
