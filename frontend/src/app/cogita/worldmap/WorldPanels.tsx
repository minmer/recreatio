/**
 * 2026-11-09 — DIE FELDER NEBEN DER WELTKARTE (spec §4.8: kurz, wenig Text): ein Ort (§7.3 — Stufen, Durchgang, Reihenfolge der
 * Eroberung, woher nie erschienene Karten kommen, „direkt lernen", die Linien hier), ein Abschnitt (§6.1 — die Fahrkarte mit der
 * Quelle jeder neuen Karte), ein Umsteigeort und das Haus (§4.5 — jede Richtung mit Ziel, Folien und Fahrkarte; hier wählt man),
 * die Navigation (§8.2 — der Fahrplan als senkrechte Linie, ein Fenster um den jetzigen Schritt, „Tu możesz też skręcić") und
 * die Liste für Autoren (§11). Rechnet nichts am Modell: alles kommt aus `WorldState`, die Taten aus `PanelActions`.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { T } from '../../core/i18n';
import { attemptsText } from './WorldLevels';
import { rgbCss, type LineColour } from './wmColors';
import { stepKey, type Timetable } from './wmNav';
import type { PlanStep } from './wmPlan';
import { runGate, type LevelProgress, type LevelRule } from './wmRuns';
import { reviewable, type SectionState, type WorldState } from './wmState';
import { dueOf } from './wmViews';
import { HOME, type Section, type WmIssue } from './wmTypes';
import './worldmap.css';

/** Was die Felder tun lassen (die Landschaft führt es aus). */
export interface PanelActions {
  /** Die Erzählung am Anfang dieses Abschnitts öffnen (die Karte hat seine Fahrkarte geprüft). */
  travel(section: string): void;
  learn(cards: readonly string[], title: string): void;
  /** Nur Karten, die wiederholt werden dürfen (`reviewable`). */
  review(cards: readonly string[], title: string): void;
  /** Jede dieser Karten einmal, in zufälliger Folge — auch gut gewusste (die Wiederholung am Haus). */
  repeat(cards: readonly string[], title: string): void;
  run(place: string): void;
  /** „Prowadź mnie tutaj": Navigation in dieser Sitzung (mit einem gewählten Abschnitt). */
  lead(target: string, via?: string): void;
  show(kind: 'place' | 'section' | 'home' | 'junction', id: string): void;
  open?: (id: string) => void;
}

export interface PanelCtx {
  readonly state: WorldState;
  readonly t: T;
  readonly canLearn: boolean;
  readonly colours: ReadonlyMap<string, LineColour>;
  readonly nameOf: (id: string) => string;
  readonly act: PanelActions;
}

/* -- Kleine Teile ------------------------------------------------------------------------------------------------------------ */

function Chip({ colour }: { colour: LineColour | undefined }) {
  return <span className="cg-wm-chip" aria-hidden="true" ref={(el) => { if (el !== null && colour !== undefined) el.style.background = rgbCss(colour.color); }} />;
}

function PanelTop({ title, onClose, t }: { title: ReactNode; onClose: () => void; t: T }) {
  return (
    <div className="cg-wm-ptop">
      <h3>{title}</h3>
      <button type="button" className="cg-ls-qclose" aria-label={t('cogitaWorld.panel.close')} onClick={onClose} data-world-panel-close="">×</button>
    </div>
  );
}

const lineOf = (ctx: PanelCtx, s: Section) => ctx.state.lines.lines.get(s.line);
const branchLabel = (ctx: PanelCtx, s: Section): string | null => lineOf(ctx, s)?.branches.find((b) => b.id === s.branch)?.fork?.label ?? null;
const fromTo = (ctx: PanelCtx, s: Section): string => (s.from === s.to ? ctx.nameOf(s.to) : `${ctx.nameOf(s.from)} → ${ctx.nameOf(s.to)}`);
/** Was eine Fahrkarte als erstes fehlt (für „wymaga: …"). */
const firstMissing = (ctx: PanelCtx, st: SectionState): string => {
  const p = st.ticket.parts.find((x) => !x.result.met);
  return p === undefined ? '' : ctx.t(p.view.key, p.view.params);
};

function TicketTag({ st, t, level = null }: { st: SectionState; t: T; /** `openAt` > 0: ab welcher Stufe des Startturms. */ level?: number | null }) {
  if (st.travelled) return <span className="cg-wm-tag is-done" data-world-tag="travelled">✓ {t('cogitaWorld.panel.travelled')}</span>;
  /* 2026-11-10 — ein Weg von einem nicht eroberten Turm ist nicht offen, auch mit gültiger Fahrkarte. */
  if (!st.open) return <span className="cg-wm-tag is-lock" data-world-tag="closed">{level === null ? t('cogitaWorld.panel.towerFirst') : t('cogitaWorld.panel.towerFirstLevel', { level })}</span>;
  if (st.ticket.met) return <span className="cg-wm-tag is-ok" data-world-tag="ok">{t('cogitaWorld.panel.ticketOk')}</span>;
  if (st.ticket.unknown) return <span className="cg-wm-tag is-lock" data-world-tag="unknown">{t('cogitaWorld.panel.ticketUnknown')}</span>;
  if (st.ticket.reviewOnly) return <span className="cg-wm-tag is-lock" data-world-tag="review">{t('cogitaWorld.panel.reviewOnly')}</span>;
  return (
    <span className="cg-wm-tag is-lock" data-world-tag="locked">
      {t('cogitaWorld.panel.ticketMissing')}{st.ticket.missing.new.length > 0 ? ` · ${t('cogitaWorld.panel.newCards', { count: st.ticket.missing.new.length })}` : ''}
    </span>
  );
}

/** Jede Richtung von einem Ort (oder dem Haus): Linie, Zweig, Ziel, Folien, Fahrkarte — und hier wählen. */
function Directions({ from, ctx }: { from: string; ctx: PanelCtx }) {
  const { state, t, act } = ctx;
  const own = state.lines.stations.get(from)?.out;
  const list = (own !== undefined ? own.map((id) => state.lines.sections.get(id)!) : [...state.lines.sections.values()].filter((s) => s.from === from))
    .filter((s) => s !== undefined && s.kind !== 'return')
    .sort((a, b) => (Number(lineOf(ctx, a)?.deepening ?? false) - Number(lineOf(ctx, b)?.deepening ?? false)) || (a.line < b.line ? -1 : a.line > b.line ? 1 : 0) || (a.id < b.id ? -1 : 1));
  if (list.length === 0) return null;
  return (
    <ul className="cg-wm-rows" data-world-directions={list.length}>
      {list.map((s) => {
        const st = state.sections.get(s.id)!;
        const label = branchLabel(ctx, s);
        return (
          <li key={s.id} className="cg-wm-row" data-world-direction={s.id} data-world-direction-branch={label === null ? '' : s.branch}>
            <span className="cg-wm-rowmain">
              <Chip colour={ctx.colours.get(s.line)} />
              <strong>{lineOf(ctx, s)?.name ?? s.line}</strong>
              {label !== null && <span> · {label}</span>}
            </span>
            <span className="cg-wm-meta">→ {ctx.nameOf(s.to)} · {t('cogitaWorld.panel.slides', { count: s.slides })}</span>
            <TicketTag st={st} t={t} level={(state.settings.openAt ?? 0) > 0 ? state.settings.openAt! : null} />
            <span className="cg-wm-rowact">
              {ctx.canLearn && st.ticket.met && st.open && <button type="button" className="wk-btn is-small" onClick={() => act.travel(s.id)} data-world-choose={s.id}>{t('cogitaWorld.panel.choose')}</button>}
              <button type="button" className="wk-link-btn" onClick={() => act.show('section', s.id)} data-world-direction-more={s.id}>{t('cogitaWorld.panel.details')}</button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Woher neue Karten kommen (§6.1): je Quelle die billigste Fahrt, die sie einführt — offen oder was sie selbst braucht; sonst „bez slajdu". */
function Sources({ cards, except, ctx }: { cards: readonly string[]; except: string | null; ctx: PanelCtx }) {
  const { state, t, act } = ctx;
  const groups = new Map<string, string[]>();
  for (const k of cards) {
    const best = state.sources(k).find((x) => x.section !== except);
    const key = best?.section ?? '';
    const l = groups.get(key) ?? [];
    l.push(k);
    groups.set(key, l);
  }
  const order = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : (state.sections.get(a)!.cost - state.sections.get(b)!.cost) || (a < b ? -1 : 1)));
  return (
    <ul className="cg-wm-rows" data-world-sources={cards.length}>
      {order.map((sec) => {
        const list = groups.get(sec)!;
        if (sec === '') {
          return (
            <li key="direct" className="cg-wm-row" data-world-source="direct" data-world-source-cards={list.length}>
              <span className="cg-wm-rowmain">{t('cogitaWorld.panel.cards', { count: list.length })}</span>
              <span className="cg-wm-meta">{t('cogitaWorld.panel.noSlide')}</span>
            </li>
          );
        }
        const s = state.lines.sections.get(sec)!;
        const st = state.sections.get(sec)!;
        return (
          <li key={sec} className="cg-wm-row" data-world-source={sec} data-world-source-cards={list.length} data-world-source-open={st.ticket.met && st.open ? '1' : '0'}>
            <span className="cg-wm-rowmain">
              <Chip colour={ctx.colours.get(s.line)} />
              <span>{t('cogitaWorld.panel.cards', { count: list.length })} · {lineOf(ctx, s)?.name ?? s.line}: {fromTo(ctx, s)}</span>
            </span>
            <span className="cg-wm-meta">{!st.open ? ((state.settings.openAt ?? 0) > 0 ? t('cogitaWorld.panel.reachStart', { name: ctx.nameOf(s.from), level: state.settings.openAt! }) : t('cogitaWorld.panel.conquerStart', { name: ctx.nameOf(s.from) })) : st.ticket.met ? t('cogitaWorld.panel.openNow') : t('cogitaWorld.panel.needs', { what: firstMissing(ctx, st) })}</span>
            <span className="cg-wm-rowact">
              {ctx.canLearn && st.ticket.met && st.open && <button type="button" className="wk-btn wk-btn-line is-small" onClick={() => act.travel(sec)} data-world-source-travel={sec}>{t('cogitaWorld.panel.travel')}</button>}
              <button type="button" className="wk-link-btn" onClick={() => act.show('section', sec)}>{t('cogitaWorld.panel.details')}</button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* -- Ein Abschnitt ---------------------------------------------------------------------------------------------------------- */

export function SectionPanel({ id, ctx, onClose }: { id: string; ctx: PanelCtx; onClose: () => void }) {
  const { state, t, act } = ctx;
  const s = state.lines.sections.get(id);
  const st = state.sections.get(id);
  if (s === undefined || st === undefined) return null;
  const line = lineOf(ctx, s);
  const label = branchLabel(ctx, s);
  const unmet = st.ticket.parts.filter((p) => !p.result.met);
  const fresh = st.ticket.missing.new;
  const due = st.ticket.missing.review;
  /* Wiederholen darf nur, was die Regel lässt; der Rest gehört zum Lernen (eine Fahrkarte ist keine Wiederholung). */
  const reviewList = due.filter((k) => reviewable(k, state));
  /* 2026-11-10 — direkt nur, was keine Erzählung erreicht (wo eine es erklärt, steht sie unter „woher"). */
  const learnList = [...fresh, ...due.filter((k) => !reviewable(k, state))].filter((k) => state.band(k) !== 'unseen' || !storyReaches(state, k));
  const title = `${line?.name ?? s.line}: ${fromTo(ctx, s)}`;
  return (
    <section className="cg-wm-panel" data-world-panel="section" data-world-section={id} data-world-ticket={st.ticket.met ? 'met' : st.ticket.unknown ? 'unknown' : 'missing'} data-world-travelled={st.travelled ? '1' : '0'}>
      <PanelTop t={t} onClose={onClose} title={<><Chip colour={ctx.colours.get(s.line)} /> {line?.name ?? s.line}</>} />
      {label !== null && <p className="cg-wm-meta" data-world-branch={s.branch}>{t('cogitaWorld.panel.branch', { label })}</p>}
      <p className="cg-wm-meta">
        {s.kind === 'return' ? t('cogitaWorld.panel.back', { name: ctx.nameOf(s.to) }) : fromTo(ctx, s)} · {t('cogitaWorld.panel.slides', { count: s.slides })}
        {s.introduces.length > 0 && <> · {t('cogitaWorld.panel.newCards', { count: st.fresh.length })}</>}
        {st.travelled && <> · ✓ {t('cogitaWorld.panel.travelled')}</>}
      </p>
      <p className="cg-wm-h">{t('cogitaWorld.panel.ticket')}</p>
      {st.ticket.met ? <p className="cg-wm-ok" data-world-ticket-ok="">✓ {t('cogitaWorld.panel.ticketOk')}</p> : (
        <div className="cg-wm-ticket" data-world-ticket-missing={fresh.length + due.length}>
          <ul className="cg-wm-rows">
            {unmet.map((p, i) => <li key={i} className="cg-wm-row" data-world-condition={p.view.symbol}><span className="cg-wm-lock">{t(p.view.key, p.view.params)}</span></li>)}
          </ul>
          {st.ticket.reviewOnly && <p className="cg-wm-meta">{t('cogitaWorld.panel.reviewOnly')}</p>}
          {fresh.length > 0 && (
            <>
              <p className="cg-wm-meta">{t('cogitaWorld.panel.newCards', { count: fresh.length })} — {t('cogitaWorld.panel.whereFrom')}</p>
              <Sources cards={fresh} except={id} ctx={ctx} />
            </>
          )}
          {ctx.canLearn && (learnList.length > 0 || reviewList.length > 0) && (
            <div className="wk-actions">
              {learnList.length > 0 && <button type="button" className="wk-btn" onClick={() => act.learn(learnList, title)} data-world-learn-direct={learnList.length}>{t('cogitaWorld.panel.learnDirectlyN', { count: learnList.length })}</button>}
              {reviewList.length > 0 && <button type="button" className="wk-btn wk-btn-line" onClick={() => act.review(reviewList, title)} data-world-review={reviewList.length}>{t('cogitaWorld.panel.reviewN', { count: reviewList.length })}</button>}
            </div>
          )}
        </div>
      )}
      {!st.open && (
        <p className="cg-wm-lock" data-world-start-closed={s.from}>
          {(state.settings.openAt ?? 0) > 0 ? t('cogitaWorld.panel.reachStart', { name: ctx.nameOf(s.from), level: state.settings.openAt! }) : t('cogitaWorld.panel.conquerStart', { name: ctx.nameOf(s.from) })}{' '}
          <button type="button" className="wk-link-btn" onClick={() => act.show('place', s.from)}>{t('cogitaWorld.panel.showPlace')}</button>
        </p>
      )}
      {ctx.canLearn && (
        <div className="wk-actions">
          <button type="button" className={st.ticket.met && st.open ? 'wk-btn' : 'wk-btn wk-btn-line'} disabled={!st.ticket.met || !st.open} onClick={() => act.travel(id)} data-world-travel={id}>
            {st.travelled ? t('cogitaWorld.panel.travelAgain') : t('cogitaWorld.panel.travel')}
          </button>
          {state.places.get(s.to)?.conquered !== true && <button type="button" className="wk-link-btn" onClick={() => act.lead(s.to, id)} data-world-lead={s.to}>{t('cogitaWorld.panel.leadMe')}</button>}
        </div>
      )}
    </section>
  );
}

/* -- 2026-11-10: was ein gesperrter Turm verlangt; eine Gabelung, ein Tor ----------------------------------------------------- */

/** Ein verlangter Turm: erobert, jetzt zu erobern (seine eigenen Voraussetzungen sitzen) oder selbst noch gesperrt. */
export type RequiredState = 'done' | 'open' | 'locked';

/** Jeder Turm, den ein Turm verlangt — auch mittelbar —, mit seinem Stand; die Grundlage zuerst. */
export function requiredTowers(state: WorldState, place: string): { readonly id: string; readonly state: RequiredState }[] {
  const rank = new Map(state.world.order.map((p, i) => [p, i] as const));
  return [...state.world.base(place)]
    .filter((p) => state.world.places.has(p))
    .map((p) => ({
      id: p,
      state: (state.places.get(p)?.conquered === true ? 'done' : (state.world.places.get(p)?.needs ?? []).every((n) => state.places.get(n)?.conquered === true) ? 'open' : 'locked') as RequiredState
    }))
    .sort((a, b) => (state.world.places.get(a.id)!.depth - state.world.places.get(b.id)!.depth) || ((rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)));
}

/** Kann eine Erzählung diese Karte erklären (führt ein Abschnitt sie ein)? Sonst — und nur dann — wird sie direkt gelernt. */
export const storyReaches = (state: WorldState, card: string): boolean => (state.lines.introducedBy.get(card) ?? []).length > 0;

/**
 * 2026-11-10 (Eigentümer: „ein gesperrter Turm erklärt sich selbst") — JEDER FEHLENDE TURM, auch mittelbar: ob er offen ist (jetzt
 * zu erobern), noch gesperrt oder schon erobert.
 */
function RequiredList({ id, ctx }: { id: string; ctx: PanelCtx }) {
  const { t, state, act, nameOf } = ctx;
  const list = requiredTowers(state, id);
  const missing = list.filter((x) => x.state !== 'done').length;
  if (missing === 0) return null;
  return (
    <div className="cg-wm-req" data-world-required={missing}>
      <p className="cg-wm-meta">{t('cogitaWorld.panel.requiresFirst', { count: missing })}</p>
      <ul className="cg-wm-rows">
        {list.map((x) => (
          <li key={x.id} className={`cg-wm-row is-${x.state}`} data-world-required-tower={x.id} data-world-required-state={x.state}>
            <span className={`cg-wm-tag ${x.state === 'done' ? 'is-done' : x.state === 'open' ? 'is-ok' : 'is-lock'}`}>{t(`cogitaWorld.panel.req.${x.state}`)}</span>
            <button type="button" className="cg-ref" onClick={() => act.show('place', x.id)}>{nameOf(x.id)}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Wie ein Knoten zwischen Türmen sich beschreibt: „5 Folien, dann Gabelung: 3 Wege" — oder ein Tor. */
export function junctionText(id: string, ctx: Pick<PanelCtx, 't' | 'state'>): string {
  const { t, state } = ctx;
  const j = state.lines.junctions.get(id);
  if (j === undefined) return '';
  const cap = (x: string) => x.charAt(0).toLocaleUpperCase() + x.slice(1);
  if (j.kind === 'gate') return cap(t('cogitaWorld.map.junctionGate', { count: state.lines.links.filter((l) => l.to === id).length + 1 }));
  const ways = junctionWays(id, state).length;
  return j.before.slides > 0 ? `${t('cogitaWorld.map.junctionBefore', { count: j.before.slides })} ${t('cogitaWorld.map.junctionWays', { count: ways })}` : cap(t('cogitaWorld.map.junctionWays', { count: ways }));
}

/** Die Wege, die an einem Knoten abfahren (Verpackungen desselben Weges zählen einmal), und wie viele Verpackungen jeder hat. */
export function junctionWays(id: string, state: WorldState): { readonly s: Section; readonly styles: number }[] {
  const j = state.lines.junctions.get(id);
  if (j === undefined) return [];
  const byKey = new Map<string, { s: Section; styles: number }>();
  for (const sid of j.out) {
    const s = state.lines.sections.get(sid);
    if (s === undefined) continue;
    const k = s.variant === undefined ? s.id : `${s.to}|${s.variant.choice}`;
    const had = byKey.get(k);
    if (had === undefined) byKey.set(k, { s, styles: 1 }); else had.styles += 1;
  }
  return [...byKey.values()];
}

/** 2026-11-10 — eine Gabelung oder ein Tor: wohin jeder Weg führt, wie lang er ist, was ihn sperrt — und von hier aus gehen. */
export function JunctionPanel({ id, ctx, onClose }: { id: string; ctx: PanelCtx; onClose: () => void }) {
  const { state, t, act, nameOf } = ctx;
  const j = state.lines.junctions.get(id);
  if (j === undefined) return null;
  const ways = junctionWays(id, state);
  const from = state.lines.links.filter((l) => l.to === id).map((l) => l.from);
  return (
    <section className="cg-wm-panel" data-world-panel="junction" data-world-junction={id} data-world-junction-kind={j.kind}>
      <PanelTop t={t} onClose={onClose} title={<><Chip colour={ctx.colours.get(j.line)} /> {nameOf(id)}</>} />
      <p className="cg-wm-meta" data-world-junction-says="">{junctionText(id, ctx)}</p>
      {j.kind === 'gate' && (
        <p className="cg-wm-meta" data-world-junction-from={from.length + 1}>
          {t('cogitaWorld.panel.gateFrom', { names: [j.from, ...from].map(nameOf).join(', ') })}
        </p>
      )}
      <ul className="cg-wm-rows" data-world-junction-ways={ways.length}>
        {ways.map(({ s, styles }) => {
          const st = state.sections.get(s.id)!;
          const label = branchLabel(ctx, s);
          return (
            <li key={s.id} className="cg-wm-row" data-world-junction-way={s.id}>
              <span className="cg-wm-rowmain"><strong>→ {nameOf(s.to)}</strong>{label !== null && <span> · {label}</span>}</span>
              <span className="cg-wm-meta">
                {t('cogitaWorld.panel.slides', { count: s.slides })} · {t('cogitaWorld.panel.questionsN', { count: s.questions.length })}{styles > 1 ? ` · ${t('cogitaWorld.panel.styles', { count: styles })}` : ''}
              </span>
              <TicketTag st={st} t={t} />
              <span className="cg-wm-rowact">
                {ctx.canLearn && st.ticket.met && st.open && <button type="button" className="wk-btn is-small" onClick={() => act.travel(s.id)} data-world-choose={s.id}>{t('cogitaWorld.panel.travel')}</button>}
                {state.places.get(s.to)?.conquered === false && <button type="button" className="wk-link-btn" onClick={() => act.lead(s.to)} data-world-lead={s.to}>{t('cogitaWorld.panel.leadMe')}</button>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* -- Ein Ort ------------------------------------------------------------------------------------------------------------------- */

/** Wie viele Orte der Reihenfolge das Feld zeigt (der Rest als Zahl). */
const ORDER_SHOWN = 6;

export function PlacePanel({ id, ctx, levels, rules, onClose, settings, onSettings, goal = null, worlds = null, way = null }: {
  id: string;
  ctx: PanelCtx;
  levels: ReadonlyMap<string, LevelProgress>;
  rules: readonly LevelRule[];
  onClose: () => void;
  /** „Moje ustawienia" (offen) und der Schalter dazu. */
  settings: ReactNode;
  onSettings: () => void;
  /** „Ustaw jako cel" / „Zrezygnuj z tego celu" — wie im Krajobraz (das Ziel bleibt, die Navigation lebt nur in der Sitzung). */
  goal?: { readonly isGoal: boolean; readonly set: () => void; readonly clear: () => void } | null;
  /** Die Verweise dieses Ortes in andere Welten (`WorldsSection`) — nie eine Voraussetzung. */
  worlds?: ReactNode;
  /** Der Weg hierher in Teilen, wenn der Ort nicht gleich erreichbar ist (`WayPreview`). */
  way?: ReactNode;
}) {
  const { state, t, act } = ctx;
  const place = state.world.places.get(id);
  const ps = state.places.get(id);
  if (place === undefined || ps === undefined) return null;
  const L = state.settings.levels;
  const progress = levels.get(id) ?? { level: 0, reachedAt: [], perfect: false };
  const gate = runGate(state.ctx, id, progress, L);
  const block = place.block === undefined ? undefined : state.world.blocks.get(place.block);
  const station = state.lines.stations.get(id);
  const linesHere = [...state.lines.lines.values()].filter((l) => l.stops.includes(id) || l.sections.some((sid) => { const s = state.lines.sections.get(sid); return s !== undefined && (s.to === id || s.from === id); }));
  /* Step 3 · 1 — nur Karten, die zählen (ausgesetzte nie). */
  const unseen = ps.cards.filter((k) => state.band(k) === 'unseen');
  const notKnown = ps.cards.filter((k) => state.band(k) !== 'known');
  /*
    2026-11-10 (Eigentümer: „Direkt lernen nur, was keine Erzählung erreicht") — nie gesehene Karten, die eine Erzählung erklärt,
    lernt man auf ihrem Weg; direkt nur die, die keine erreicht. Vorher wiederholen: was man gesehen hat und noch nicht kann (und
    was keine Erzählung erreicht).
  */
  const storyUnseen = unseen.filter((k) => storyReaches(state, k));
  const direct = unseen.filter((k) => !storyReaches(state, k));
  const prepare = notKnown.filter((k) => state.band(k) !== 'unseen' || !storyReaches(state, k));
  const hiddenOrder = Math.max(0, state.conquestOrder(id).length - 1 - ORDER_SHOWN);
  const due = ps.conquered ? dueOf(state, id) : [];
  const order = gate.kind === 'locked' || (L === 0 && !ps.conquered) ? state.conquestOrder(id).filter((p) => p !== id) : [];
  const total = order.reduce((sum, p) => sum + (state.places.get(p)?.missing ?? 0), 0) + ps.missing;
  const rule = gate.kind === 'ready' ? rules[gate.level - 1] : undefined;
  return (
    <section className="cg-wm-panel" data-world-panel="place" data-world-place={id} data-world-gate={gate.kind} data-world-conquered={ps.conquered ? '1' : '0'} data-world-level={ps.level}>
      <PanelTop t={t} onClose={onClose} title={place.label} />
      {block !== undefined && <p className="cg-wm-meta">{t('cogitaWorld.panel.partOf', { name: block.label })}</p>}
      <p className="cg-wm-meta" data-world-place-stats="">
        {t('cogitaWorld.panel.cards', { count: ps.total })}
        {L > 0 && <> · {t('cogitaWorld.panel.levelOf', { level: ps.level, levels: L })}</>}
        {' · '}{ps.conquered ? t('cogitaWorld.map.conquered') : t('cogitaWorld.map.cardsToGo', { count: ps.missing })}
      </p>
      {progress.perfect && <p className="cg-wm-perfect" data-world-perfect="">★ {t('cogitaWorld.run.perfect')}</p>}
      {/*
        2026-11-09 (Eigentümer: „es soll klar sein, was zu tun ist") — EIN nächster Schritt, gross; alles andere eingeklappt.
        Erobert: wiederholen (wenn etwas fällig ist). Ein Durchgang geht: ihn beginnen. Sonst: „Prowadź mnie tutaj".
      */}
      <div className="cg-wm-next" data-world-next="">
        <p className="cg-wm-h">{t('cogitaWorld.panel.next')}</p>
        {ps.conquered ? (
          ctx.canLearn && due.length > 0
            ? <button type="button" className="wk-btn" onClick={() => act.review(due, place.label)} data-world-review={due.length}>{t('cogitaWorld.panel.reviewN', { count: due.length })}</button>
            : <p className="cg-wm-ok">✓ {t('cogitaWorld.map.conquered')}</p>
        ) : !ctx.canLearn ? <p className="cg-wm-meta">{t('cogitaWorld.map.cardsToGo', { count: ps.missing })}</p>
        : gate.kind === 'locked' ? (
          <>
            {/* 2026-11-10 — gesperrt: jeder fehlende Turm (auch mittelbar), offen oder gesperrt; der Weg führt der Reihe nach hin. */}
            <RequiredList id={id} ctx={ctx} />
            <div className="wk-actions"><button type="button" className="wk-btn" onClick={() => act.lead(id)} data-world-lead={id}>{t('cogitaWorld.panel.leadMe')}</button></div>
            {way}
          </>
        ) : gate.kind === 'ready' ? (
          <>
            {/*
              2026-11-10 (Eigentümer) — AM TURM ZWEI WEGE, jederzeit: gleich erobern (alle Karten; wie viele nie gefragt wurden, steht
              dabei) — oder erst wiederholen, was man noch nicht kann. Erklärt eine Erzählung noch Karten, kann man sie erst erkunden.
            */}
            <div className="cg-wm-ways" data-world-ways="">
              <div className="cg-wm-way1">
                <button type="button" className="wk-btn" onClick={() => act.run(id)} data-world-run-for={gate.level}>{t('cogitaWorld.panel.conquerNow')}</button>
                <span className="cg-wm-meta" data-world-run-unseen={unseen.length}>
                  {unseen.length > 0 ? t('cogitaWorld.panel.conquerUnseen', { count: unseen.length, all: ps.cards.length }) : t('cogitaWorld.panel.conquerSays', { count: ps.cards.length })}
                  {rule !== undefined ? ` · ${t('cogitaWorld.run.rule', { pct: rule.pct, attempts: attemptsText(rule.attempts, t) })}` : ''}
                </span>
              </div>
              {prepare.length > 0 && (
                <div className="cg-wm-way1">
                  <button type="button" className="wk-btn wk-btn-line" onClick={() => act.learn(prepare, place.label)} data-world-prepare={prepare.length}>{t('cogitaWorld.panel.prepareN', { count: prepare.length })}</button>
                  <span className="cg-wm-meta">{t('cogitaWorld.panel.prepareSays')}</span>
                </div>
              )}
              {storyUnseen.length > 0 && (
                <div className="cg-wm-way1">
                  <button type="button" className="wk-btn wk-btn-line" onClick={() => act.lead(id)} data-world-lead={id}>{t('cogitaWorld.panel.exploreFirst')}</button>
                  <span className="cg-wm-meta">{t('cogitaWorld.panel.exploreSays', { count: storyUnseen.length })}</span>
                </div>
              )}
            </div>
            {way}
          </>
        ) : (
          <>
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={() => act.lead(id)} data-world-lead={id}>{t('cogitaWorld.panel.leadMe')}</button>
            {prepare.length > 0 && (
              <button type="button" className="wk-link-btn" onClick={() => act.learn(prepare, place.label)} data-world-learn-direct={prepare.length}>
                {t('cogitaWorld.panel.learnDirectlyN', { count: prepare.length })}
              </button>
            )}
          </div>
          <RequiredList id={id} ctx={ctx} />
          {way}
          </>
        )}
        {direct.length > 0 && <p className="cg-wm-meta" data-world-direct={direct.length}>{t('cogitaWorld.panel.noStory', { count: direct.length })}</p>}
      </div>
      {ps.dot !== null && (
        <p className="cg-wm-row" data-world-dot={ps.dot}>
          <span className={`cg-wm-dot is-${ps.dot}`} aria-hidden="true" />
          <span>{t('cogitaWorld.panel.knowledge')}: {t(`cogitaWorld.panel.dot.${ps.dot}`)}</span>
        </p>
      )}

      {/* Alles Weitere eingeklappt: die Reihenfolge, woher die Karten kommen, die Linien, die Richtungen, Ziel und Einstellungen. */}
      <details className="cg-wm-more" data-world-more="">
        <summary>{t('cogitaWorld.panel.more')}</summary>
        {!ps.conquered && (
          <div className="cg-wm-conquer" data-world-conquer={gate.kind}>
            {order.length > 0 && (
              <>
                <p className="cg-wm-h">{t('cogitaWorld.panel.conquerFirst')}</p>
                <ol className="cg-wm-rows cg-wm-order" data-world-order={order.length}>
                  {order.slice(0, ORDER_SHOWN).map((p) => (
                    <li key={p} className="cg-wm-row" data-world-order-item={p}>
                      <button type="button" className="cg-ref" onClick={() => act.show('place', p)}>{ctx.nameOf(p)}</button>
                      <span className="cg-wm-meta">{t('cogitaWorld.map.cardsToGo', { count: state.places.get(p)?.missing ?? 0 })}</span>
                    </li>
                  ))}
                </ol>
                <p className="cg-wm-meta" data-world-order-total={total}>{hiddenOrder > 0 ? `${t('cogitaWorld.panel.moreN', { count: hiddenOrder })} · ` : ''}{t('cogitaWorld.panel.orderTotal', { count: total })}</p>
              </>
            )}
            {gate.kind === 'locked' && order.length === 0 && unseen.length === 0 && <p className="cg-wm-meta">{t('cogitaWorld.run.locked')}</p>}
            {unseen.length > 0 && (
              <>
                <p className="cg-wm-meta">{t('cogitaWorld.panel.neverSeen', { count: unseen.length })} — {t('cogitaWorld.panel.whereFrom')}</p>
                <Sources cards={unseen} except={null} ctx={ctx} />
              </>
            )}
          </div>
        )}
        <p className="cg-wm-h">{station !== undefined ? t('cogitaWorld.panel.station') : t('cogitaWorld.panel.linesHere')}</p>
        {linesHere.length === 0 ? <p className="cg-wm-meta" data-world-no-lines="">{t('cogitaWorld.panel.noLines')}</p> : (
          <p className="cg-wm-lines" data-world-lines-here={linesHere.length}>
            {linesHere.map((l) => <span key={l.id} className="cg-wm-linechip"><Chip colour={ctx.colours.get(l.id)} />{l.name}</span>)}
          </p>
        )}
        {station !== undefined && (
          <div data-world-station={id}>
            <p className="cg-wm-meta">{t('cogitaWorld.panel.directions')}</p>
            <Directions from={id} ctx={ctx} />
          </div>
        )}
        {worlds}
        <div className="wk-actions">
          {goal !== null && !ps.conquered && !goal.isGoal && <button type="button" className="wk-link-btn" onClick={goal.set} data-world-goal-set={id}>{t('cogitaLearn.words.setGoal')}</button>}
          {goal !== null && goal.isGoal && <button type="button" className="wk-link-btn" onClick={goal.clear} data-world-goal-resign={id}>{t('cogitaLearn.landscape.resignGoal')}</button>}
          {ctx.canLearn && <button type="button" className="wk-link-btn" onClick={onSettings} data-world-my-settings="">{t('cogitaWorld.panel.mySettings')}</button>}
          {act.open !== undefined && <button type="button" className="wk-link-btn" onClick={() => act.open!(id)} data-world-open={id}>{t('cogitaWorld.panel.openEntry')}</button>}
        </div>
      </details>
      {settings}
    </section>
  );
}

/* -- Das Haus ------------------------------------------------------------------------------------------------------------------ */

/*
  2026-11-10 (Eigentümer) — AM HAUS DIE WIEDERHOLUNG VON ALLEM: jede Karte eroberter Orte, deren Kenntnis unter der gewählten
  Schwelle liegt (90 % … 130 %; über 100 % heisst „na zapas"), einmal und in zufälliger Folge. Die Schwelle merkt sich dieses Gerät.
*/
const REPEAT_AT = [0.9, 1, 1.15, 1.3] as const;
const REPEAT_KEY = 'cg-wm-repeat-at';
const keptRepeatAt = (): number => {
  try { const v = Number(localStorage.getItem(REPEAT_KEY)); return (REPEAT_AT as readonly number[]).includes(v) ? v : 1; } catch { return 1; }
};

function HomeRepeat({ ctx }: { ctx: PanelCtx }) {
  const { t, state, act } = ctx;
  const [at, setAt] = useState(keptRepeatAt);
  const choose = (v: number) => { setAt(v); try { localStorage.setItem(REPEAT_KEY, String(v)); } catch { /* ohne Speicher: nur jetzt */ } };
  /* Was wiederholt werden darf (eroberte Orte), schon gesehen, nicht ausgesetzt. */
  const seen = useMemo(() => [...state.world.cardPlaces.keys()].filter((k) => reviewable(k, state) && state.band(k) !== 'unseen' && state.ctx.suspended?.(k) !== true), [state]);
  const below = (v: number) => seen.filter((k) => state.ctx.knowness(k) < v);
  const list = below(at);
  const pct = Math.round(at * 100);
  return (
    <div className="cg-wm-next" data-world-repeat={list.length} data-world-repeat-at={at}>
      <p className="cg-wm-h">{t('cogitaWorld.home.repeatTitle')}</p>
      <p className="cg-wm-meta">{t('cogitaWorld.home.repeatSays')}</p>
      <div className="cg-wm-modes" role="group" aria-label={t('cogitaWorld.home.repeatTitle')}>
        {REPEAT_AT.map((v) => (
          <button key={v} type="button" className={`cg-wm-mode${at === v ? ' is-on' : ''}`} aria-pressed={at === v} onClick={() => choose(v)} data-world-repeat-choose={v}>
            {t('cogitaWorld.home.below', { pct: Math.round(v * 100) })} ({below(v).length})
          </button>
        ))}
      </div>
      {!ctx.canLearn ? null : list.length > 0
        ? <div className="wk-actions"><button type="button" className="wk-btn" onClick={() => act.repeat(list, t('cogitaWorld.home.repeatRun', { pct }))} data-world-repeat-go={list.length}>{t('cogitaWorld.home.repeatN', { count: list.length })}</button></div>
        : <p className="cg-wm-ok" data-world-repeat-none="">✓ {t('cogitaWorld.home.nothing', { pct })}</p>}
    </div>
  );
}

export function HomePanel({ ctx, onClose }: { ctx: PanelCtx; onClose: () => void }) {
  const { t } = ctx;
  return (
    <section className="cg-wm-panel" data-world-panel="home">
      <PanelTop t={t} onClose={onClose} title={t('cogitaWorld.map.start')} />
      <HomeRepeat ctx={ctx} />
      <p className="cg-wm-meta">{t('cogitaWorld.panel.homeSays')}</p>
      <Directions from={HOME} ctx={ctx} />
    </section>
  );
}

/* -- Die Navigation: der Fahrplan ------------------------------------------------------------------------------------------- */

export function stepText(step: PlanStep, ctx: PanelCtx): string {
  const { t, nameOf, state } = ctx;
  switch (step.kind) {
    case 'travel': {
      const s = state.lines.sections.get(step.section);
      if (s === undefined) return step.section;
      return t('cogitaWorld.nav.travel', { line: lineOf(ctx, s)?.name ?? s.line, from: nameOf(s.from), to: nameOf(s.to) });
    }
    case 'learn': return t('cogitaWorld.nav.learn', { place: nameOf(step.place) });
    case 'review': { const s = state.lines.sections.get(step.section); return t('cogitaWorld.nav.review', { to: nameOf(s?.to ?? step.place) }); }
    case 'run': return t('cogitaWorld.nav.run', { place: nameOf(step.place), level: step.level });
    case 'know': return t('cogitaWorld.nav.know', { place: nameOf(step.place) });
  }
}

export function stepMeta(step: PlanStep, ctx: PanelCtx, rules: readonly LevelRule[]): string {
  const { t, state } = ctx;
  switch (step.kind) {
    case 'travel': {
      const s = state.lines.sections.get(step.section);
      return [t('cogitaWorld.panel.newCards', { count: step.cards.length }), s === undefined ? '' : t('cogitaWorld.panel.slides', { count: s.slides }), step.locked ? t('cogitaWorld.nav.locked') : ''].filter((x) => x !== '').join(' · ');
    }
    case 'learn':
    case 'review':
    case 'know': return t('cogitaWorld.panel.cards', { count: step.cards.length });
    case 'run': {
      const r = rules[step.level - 1];
      const rule = r === undefined ? '' : t('cogitaWorld.run.rule', { pct: r.pct, attempts: attemptsText(r.attempts, t) });
      /* 2026-11-10 — wie viele Karten der Durchgang fragt, die nie gefragt wurden. */
      return [rule, step.upTo > step.level ? t('cogitaWorld.nav.runAll', { upTo: step.upTo }) : '', step.unseen.length > 0 ? t('cogitaWorld.nav.runUnseen', { count: step.unseen.length }) : ''].filter((x) => x !== '').join(' · ');
    }
  }
}

/** Was der jetzige Schritt tun lässt. */
export function stepAction(step: PlanStep, ctx: PanelCtx): string | null {
  const { t, state } = ctx;
  switch (step.kind) {
    case 'travel': {
      const st = state.sections.get(step.section);
      return st !== undefined && !st.ticket.met ? t('cogitaWorld.panel.learnDirectlyN', { count: st.ticket.missing.new.length + st.ticket.missing.review.length }) : t('cogitaWorld.panel.travel');
    }
    case 'learn':
    case 'know': return t('cogitaWorld.panel.learnDirectlyN', { count: step.cards.length });
    case 'review': return t('cogitaWorld.panel.reviewN', { count: step.cards.length });
    case 'run': return t('cogitaWorld.panel.conquerNow');
  }
}

function Turns({ step, ctx, onChoose }: { step: Extract<PlanStep, { kind: 'travel' }>; ctx: PanelCtx; onChoose: (place: string, section: string) => void }) {
  const { t, state, nameOf } = ctx;
  const effort = (d: number) => (Math.abs(d) < 0.05 ? t('cogitaWorld.nav.costSame') : d > 0 ? t('cogitaWorld.nav.costMore', { n: Math.round(d * 10) / 10 }) : t('cogitaWorld.nav.costLess', { n: Math.round(-d * 10) / 10 }));
  return (
    <details className="cg-wm-turns" data-world-turns={step.alternatives.length}>
      <summary data-world-turns-open="">{t('cogitaWorld.nav.turnHint')}</summary>
      <ul className="cg-wm-rows">
        {step.alternatives.map((a) => {
          const s = state.lines.sections.get(a.section);
          if (s === undefined) return null;
          return (
            <li key={a.section} className="cg-wm-row" data-world-turn={a.section}>
              <span className="cg-wm-rowmain"><Chip colour={ctx.colours.get(s.line)} /><span>{lineOf(ctx, s)?.name ?? s.line}: {fromTo(ctx, s)}</span></span>
              <span className="cg-wm-meta">
                {t('cogitaWorld.panel.slides', { count: a.slides })} · {t('cogitaWorld.nav.covers', { count: a.covers })}
                {a.opens.length > 0 && <> · {t('cogitaWorld.nav.opens', { names: a.opens.slice(0, 3).map(nameOf).join(', ') })}</>} · {effort(a.delta)}
              </span>
              <span className="cg-wm-rowact"><button type="button" className="wk-btn wk-btn-line is-small" onClick={() => onChoose(step.place, a.section)} data-world-turn-choose={a.section}>{t('cogitaWorld.panel.choose')}</button></span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function NavPanel({ tt, ctx, rules, onChoose, onGo, onEnd, onPrepare }: {
  tt: Timetable;
  ctx: PanelCtx;
  rules: readonly LevelRule[];
  onChoose: (place: string, section: string) => void;
  onGo: (step: PlanStep) => void;
  onEnd: () => void;
  /** 2026-11-10 — am Turm der zweite Weg: erst wiederholen, was man noch nicht kann. */
  onPrepare?: (step: PlanStep) => void;
}) {
  const { t } = ctx;
  const all = tt.done.length + tt.upcoming.length;
  const boxRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);
  /* Das Fenster (§8.2): zwei erledigte darüber sichtbar, der Rest durch Blättern. */
  useEffect(() => {
    const box = boxRef.current;
    const list = listRef.current;
    if (box === null || list === null) return;
    const first = list.children[Math.max(0, tt.done.length - 2)] as HTMLElement | undefined;
    if (first !== undefined) box.scrollTop = first.offsetTop;
  }, [tt]);
  const stop = (step: PlanStep, kind: 'done' | 'current' | 'next', key: string) => {
    const meta = stepMeta(step, ctx, rules);
    const action = kind === 'current' && ctx.canLearn ? stepAction(step, ctx) : null;
    return (
      <li key={key} className={`cg-wm-stop is-${kind}`} data-world-stop={stepKey(step)} data-world-stop-kind={step.kind} data-world-stop-state={kind}>
        <span className="cg-wm-stopdot" aria-hidden="true" />
        <div className="cg-wm-stopbody">
          <span className="cg-wm-stoptext">{kind === 'done' ? '✓ ' : ''}{stepText(step, ctx)}</span>
          {meta !== '' && <span className="cg-wm-meta">{meta}</span>}
          {action !== null && (
            <div className="wk-actions">
              <button type="button" className="wk-btn is-small" onClick={() => onGo(step)} data-world-nav-go={step.kind}>{action}</button>
              {step.kind === 'run' && step.prepare.length > 0 && onPrepare !== undefined && <button type="button" className="wk-btn wk-btn-line is-small" onClick={() => onPrepare(step)} data-world-nav-prepare={step.prepare.length}>{t('cogitaWorld.panel.prepareN', { count: step.prepare.length })}</button>}
            </div>
          )}
          {kind !== 'done' && step.kind === 'travel' && step.alternatives.length > 0 && <Turns step={step} ctx={ctx} onChoose={onChoose} />}
        </div>
      </li>
    );
  };
  return (
    <section className="cg-wm-panel cg-wm-nav" data-world-panel="nav" data-world-nav-target={tt.target} data-world-nav-steps={all} data-world-nav-done={tt.done.length}>
      <PanelTop t={t} onClose={onEnd} title={<>⚑ {t('cogitaWorld.nav.target', { name: ctx.nameOf(tt.target) })}</>} />
      <p className="cg-wm-meta" data-world-nav-progress="">{t('cogitaWorld.nav.progress', { done: tt.done.length, all })} · {t('cogitaWorld.map.cardsToGo', { count: tt.cards })}</p>
      {tt.upcoming.length === 0
        ? <p className="wk-note" data-world-nav-arrived="">{t('cogitaWorld.nav.arrived', { name: ctx.nameOf(tt.target) })}</p>
        : (
          <div ref={boxRef} className="cg-wm-tt" data-world-timetable="">
            <ol ref={listRef} className="cg-wm-ttlist">
              {tt.done.map((s, i) => stop(s, 'done', `d:${i}:${stepKey(s)}`))}
              {tt.upcoming.map((s, i) => stop(s, i === 0 ? 'current' : 'next', `u:${stepKey(s)}`))}
            </ol>
          </div>
        )}
      <div className="wk-actions"><button type="button" className="wk-link-btn" onClick={onEnd} data-world-nav-end="">{t('cogitaWorld.nav.end')}</button></div>
    </section>
  );
}

/* -- Die Liste für Autoren (§11, nur Schreibende) ---------------------------------------------------------------------------- */

export function AuthorList({ issues, nameOf, t }: { issues: readonly WmIssue[]; nameOf: (id: string) => string; t: T }) {
  if (issues.length === 0) return <p className="cg-wm-meta" data-world-authors="0">{t('cogitaWorld.issue.none')}</p>;
  const names = (ids: readonly string[]) => {
    const list = [...new Set(ids.map(nameOf))];
    return list.length > 6 ? `${list.slice(0, 6).join(', ')} … (+${list.length - 6})` : list.join(', ');
  };
  const errors = issues.filter((i) => i.level === 'error').length;
  return (
    <details className="cg-wm-authors" data-world-authors={issues.length} data-world-authors-errors={errors}>
      <summary>{t('cogitaWorld.issue.title', { count: issues.length })}</summary>
      <ul className="cg-wm-rows">
        {issues.map((i, n) => (
          <li key={`${i.code}:${n}`} className="cg-wm-row" data-world-issue={i.code} data-world-issue-level={i.level}>
            <span className={`cg-wm-tag is-${i.level}`}>{t(`cogitaWorld.issue.level.${i.level}`)}</span>
            <span>{t(`cogitaWorld.issue.${i.code}`, { ...(i.data ?? {}), count: typeof i.data?.count === 'number' ? i.data.count : i.ids.length, names: i.code === 'mislabelledRegion' ? nameOf(i.ids[0] ?? '') : names(i.ids) })}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
