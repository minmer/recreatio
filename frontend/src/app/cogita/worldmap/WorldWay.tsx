/**
 * 2026-11-10 (Eigentümer) — DER WEG IN TEILEN: ein Ziel, das nicht gleich erreichbar ist, zeigt seinen Weg als Kette von Teilen
 * (Erzählung = Fahrt durch einen Abschnitt, Powtórka, direkt lernen, Zdobycie = Durchgang, am Ende die Fahne).
 * <code>
 *   WayChain     die Kette; erledigt ✓, eben erledigt (springt auf), jetzt (pulsiert), kommend
 *   WayPreview   im Feld des Ortes: so geht der Weg, bevor man ihn beginnt
 *   NextView     im Vollbild der Teil „Dalej": nach jedem erledigten Teil der Weg und die Einladung zum nächsten
 * </code>
 */

import { useEffect, useRef, type ReactNode } from 'react';

import { stepAction, stepMeta, stepText, type PanelCtx } from './WorldPanels';
import { stepKey, type Timetable } from './wmNav';
import type { Plan, PlanStep } from './wmPlan';
import type { LevelRule } from './wmRuns';
import './worldmap.css';

type PartState = 'done' | 'just' | 'current' | 'next';

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

export function WayChain({ parts, ctx, target, big = false, more = 0 }: {
  parts: readonly { readonly step: PlanStep; readonly state: PartState }[];
  ctx: PanelCtx;
  target: string;
  big?: boolean;
  /** Weitere Teile, die nicht gezeigt sind (vor der Fahne). */
  more?: number;
}) {
  const { t, nameOf } = ctx;
  /* Ein langer Weg rollt zum jetzigen Teil (ein eben erledigter bleibt links daneben sichtbar). */
  const box = useRef<HTMLOListElement | null>(null);
  const at = parts.findIndex((p) => p.state === 'current');
  useEffect(() => {
    const ol = box.current;
    const li = at < 0 ? null : (ol?.children[at] as HTMLElement | undefined) ?? null;
    if (ol === null || li === null) return;
    ol.scrollLeft = Math.max(0, li.offsetLeft - ol.clientWidth / 2 + li.offsetWidth / 2);
  }, [at, parts.length]);
  return (
    <ol ref={box} className={`cg-wm-parts${big ? ' is-big' : ''}`} data-world-way={parts.length + more}>
      {parts.map(({ step, state }, i) => {
        const w = partWords(step, ctx);
        return (
          <li key={`${stepKey(step)}:${i}`} className={`cg-wm-wpart is-${state} is-${step.kind}`} data-world-way-part={stepKey(step)} data-world-way-state={state}
            title={stepText(step, ctx)} ref={(el) => { el?.style.setProperty('--i', String(i)); }}>
            <span className="cg-wm-wdot"><PartIcon kind={step.kind} />{(state === 'done' || state === 'just') && <span className="cg-wm-wcheck" aria-hidden="true">✓</span>}</span>
            <span className="cg-wm-wtext"><span className="cg-wm-wkind">{w.kind}</span><span className="cg-wm-wwhere">{w.where}</span></span>
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

/** Wie viele Teile jeder Art (für die Zeile über der Kette). */
export function countLine(steps: readonly PlanStep[], ctx: PanelCtx): string {
  const n = (k: PlanStep['kind']) => steps.filter((s) => s.kind === k).length;
  return ([['travel', n('travel')], ['review', n('review')], ['learn', n('learn') + n('know')], ['run', n('run')]] as const)
    .filter(([, c]) => c > 0).map(([k, c]) => ctx.t(`cogitaWorld.way.count.${k}`, { count: c })).join(' · ');
}

/** Im Feld des Ortes: der Weg dorthin, bevor man ihn beginnt (nur, wenn er mehr als einen Teil hat). */
export function WayPreview({ plan, ctx }: { plan: Plan; ctx: PanelCtx }) {
  if (plan.steps.length < 2) return null;
  const SHOWN = 7;
  const parts = plan.steps.slice(0, SHOWN).map((step, i) => ({ step, state: (i === 0 ? 'current' : 'next') as PartState }));
  return (
    <div className="cg-wm-waybox" data-world-way-preview={plan.steps.length}>
      <p className="cg-wm-h">{ctx.t('cogitaWorld.way.preview', { count: plan.steps.length })}</p>
      <p className="cg-wm-meta">{countLine(plan.steps, ctx)}</p>
      <WayChain parts={parts} ctx={ctx} target={plan.target} more={Math.max(0, plan.steps.length - SHOWN)} />
    </div>
  );
}

/** Im Vollbild: der Weg und die Einladung zum nächsten Teil. */
export function NextView({ tt, ctx, rules, just, onGo, onMap, onEnd, onPrepare }: {
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
}) {
  const { t, nameOf } = ctx;
  const all = tt.done.length + tt.upcoming.length;
  const parts = [
    ...tt.done.map((step) => ({ step, state: (just.has(stepKey(step)) ? 'just' : 'done') as PartState })),
    ...tt.upcoming.map((step, i) => ({ step, state: (i === 0 ? 'current' : 'next') as PartState }))
  ];
  const next = tt.upcoming[0];
  const pct = all === 0 ? 100 : Math.round((100 * tt.done.length) / all);
  return (
    <section className="cg-wm-nextview" data-world-next-view={next === undefined ? 'arrived' : stepKey(next)}>
      <header className="cg-wm-nexthead">
        <h2><PartIcon kind="target" /> {t('cogitaWorld.way.title', { name: nameOf(tt.target) })}</h2>
        <div className="cg-wm-wbar" role="progressbar" aria-valuemin={0} aria-valuemax={all} aria-valuenow={tt.done.length} aria-label={t('cogitaWorld.nav.progress', { done: tt.done.length, all })}>
          <span ref={(el) => { if (el !== null) el.style.width = `${pct}%`; }} />
        </div>
        <p className="cg-wm-meta">{t('cogitaWorld.nav.progress', { done: tt.done.length, all })}{tt.cards > 0 ? ` · ${t('cogitaWorld.map.cardsToGo', { count: tt.cards })}` : ''}</p>
      </header>
      <WayChain parts={parts} ctx={ctx} target={tt.target} big />
      {next === undefined ? (
        <div className="cg-wm-invite is-arrived" data-world-next-arrived="">
          <p className="cg-wm-invitebig"><PartIcon kind="target" /> {t('cogitaWorld.nav.arrived', { name: nameOf(tt.target) })}</p>
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
            <button type="button" className="wk-link-btn" onClick={onMap} data-world-next-map="">{t('cogitaWorld.way.toMap')}</button>
            <button type="button" className="wk-link-btn" onClick={onEnd} data-world-next-stop="">{t('cogitaWorld.nav.end')}</button>
          </div>
        </div>
      )}
    </section>
  );
}
