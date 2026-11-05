/**
 * 2026-11-02 — NAGRODY ZUM ANSEHEN, LIVE (die Rechnung: `rewards.ts`). Punkte zählen hoch, „+10" steigt auf, die Flamme
 * der Serie zündet am ersten Lerntag-Moment, der Ring des Tagesziels füllt sich, eine neue Stufe und ein neues Abzeichen
 * springen auf. Alles aus den Antworten des Lernenden: hält ein anderer Baustein derselben Person auf der Seite eine
 * Antwort fest, hört es dieser sofort (`learn.ts`, die Lernenden hören einander) und zeigt genau das Neue.
 *
 * <code>
 *   useRewards     der Stand und was eben neu ist (feste Kennungen der Ereignisse)
 *   RewardBoard    die Tafel: strip (eine Zeile), compact (über einer Powtórka, oben in der Nauka), block, full
 *   RewardHud      die Zeile im Lauf einer Powtórka
 * </code>
 *
 * Bewegung nur ohne „prefers-reduced-motion"; nichts nur mit Farbe (Zahlen und Worte daneben); was neu ist, sagt eine
 * höfliche Live-Region einmal.
 */

import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { plural } from '../core/plural';
import { viewPath } from '../routes';
import { motionLevel } from '../ui/motion';
import { baseLang } from './lang';
import type { Learner } from './learn';
import { motionWords, type MotionWords } from './motionWords';
import { answerSource, flyPoints } from './rewardBus';
import { eventText, freshEvents, GOAL_UNIT_LABEL, lastDays, levelAt, rewardState, type BadgeIcon, type RewardDay, type RewardEvent, type RewardRules, type RewardState } from './rewards';
import { pushToasts, type RewardToast } from './RewardToasts';
import { CogitaContext } from './ui';
import './rewards.css';

/* -- Was eine Tafel zeigt --------------------------------------------------------------------------------------------- */

export const REWARD_PIECES = [
  { value: 'points', label: 'Punkty' },
  { value: 'level', label: 'Poziom' },
  { value: 'streak', label: 'Seria dni' },
  { value: 'goal', label: 'Cel dnia' },
  { value: 'badges', label: 'Odznaki' },
  { value: 'feed', label: 'Ostatnie nagrody' }
] as const;
export type RewardPiece = (typeof REWARD_PIECES)[number]['value'];
export type RewardShape = 'strip' | 'compact' | 'block' | 'full';

const NUM = new Intl.NumberFormat('pl-PL');
const TIME = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });
const WEEKDAY = new Intl.DateTimeFormat('pl-PL', { weekday: 'narrow' });
const DAY_NAME = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

/* 2026-11-05 (Prompt 17) — die Wahl „Animacje" des Geräts (sonst das Betriebssystem): ograniczone und wyłączone zählen nicht hoch. */
const reducedMotion = (): boolean => motionLevel() !== 'full';
const days = (n: number) => `${n} ${plural(n, 'dzień', 'dni', 'dni')}`;
const pointsWord = (n: number) => plural(n, 'punkt', 'punkty', 'punktów');

/* -- Der Stand, live --------------------------------------------------------------------------------------------------- */

export interface Fresh {
  /** Zählt bei jeder neuen Gruppe hoch — Animationen starten neu. */
  readonly seq: number;
  readonly events: readonly RewardEvent[];
}

/**
 * DER STAND UND DAS NEUE. Beim ersten Stand (und wenn Lernender, Regel oder Kartenkreis wechseln) gilt alles als
 * bekannt — gefeiert wird nur, was danach kommt. Jede Minute neu gerechnet (ein neuer Tag, eine Serie in Gefahr); mit
 * Konto oder Platz holt `live` alle 30 s, was andere Geräte sandten.
 */
export function useRewards(learner: Learner | null, rules: RewardRules, { keys, rename, live = false }: { keys?: ReadonlySet<string>; rename?: (key: string) => string; live?: boolean } = {}): { readonly state: RewardState | null; readonly fresh: Fresh } {
  const answers = learner?.progress.answers ?? null;
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!live || learner === null || learner.holder.kind === 'local') return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') void learner.refresh().catch(() => undefined); }, 30_000);
    return () => clearInterval(t);
  }, [live, learner]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `answers` ist neu, sobald eine Antwort dazukommt
  const state = useMemo(() => (answers === null ? null : rewardState(answers.values(), rules, Math.max(clock, Date.now()), { ...(keys === undefined ? {} : { keys }), ...(rename === undefined ? {} : { rename }) })), [answers, rules, clock, keys, rename]);
  const known = useRef<{ readonly learner: Learner | null; readonly rules: RewardRules; readonly keys: ReadonlySet<string> | undefined; readonly ids: Set<string> } | null>(null);
  const [fresh, setFresh] = useState<Fresh>({ seq: 0, events: [] });
  useEffect(() => {
    if (state === null) return;
    const k = known.current;
    if (k === null || k.learner !== learner || k.rules !== rules || k.keys !== keys) {
      known.current = { learner, rules, keys, ids: new Set(state.events.map((e) => e.id)) };
      return;
    }
    const added = freshEvents(k.ids, state);
    if (added.length === 0) return;
    for (const e of added) k.ids.add(e.id);
    setFresh((f) => ({ seq: f.seq + 1, events: added }));
  }, [state, learner, rules, keys]);
  return { state, fresh };
}

/* -- Kleine Bausteine -------------------------------------------------------------------------------------------------- */

/** Eine Zahl, die zu ihrem neuen Wert hochzählt (ohne Bewegung: sofort). */
export function CountUp({ value, className, from }: { value: number; className?: string; /** 2026-11-05 (Prompt 17) — von hier zählen (sonst steht der Wert gleich da). */ from?: number }) {
  const [shown, setShown] = useState(from ?? value);
  const now = useRef(from ?? value);
  useEffect(() => {
    const start = now.current;
    if (start === value) return undefined;
    if (reducedMotion()) { now.current = value; setShown(value); return undefined; }
    const t0 = performance.now();
    const span = Math.min(1400, 350 + Math.abs(value - start) * 6);
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / span);
      const v = Math.round(start + (value - start) * (1 - Math.pow(1 - k, 3)));
      now.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className} data-rw-value={value}>{NUM.format(shown)}</span>;
}

/** Eine Klasse für eine Weile — eine Animation, die bei jedem neuen `seq` neu läuft. */
function useFlash(on: boolean, seq: number, ms = 1600): boolean {
  const [flash, setFlash] = useState(false);
  /* Ausgelöst von einer neuen Gruppe, die es betrifft … */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei einer neuen Gruppe
  useEffect(() => { if (on && seq > 0) setFlash(true); }, [seq]);
  /* … und immer wieder aus: auch wenn inzwischen eine Gruppe kam, die es nicht betrifft. */
  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(false), ms);
    return () => clearTimeout(t);
  }, [flash, seq, ms]);
  return flash;
}

/** Eine CSS-Variable, gesetzt vor dem Zeichnen (die Gestalt bleibt in den Klassen). */
function useVar<T extends HTMLElement | SVGElement>(name: string, value: string) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => { ref.current?.style.setProperty(name, value); }, [name, value]);
  return ref;
}

const ICON_PATHS: Readonly<Record<BadgeIcon | 'flame-core', string>> = {
  star: 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z',
  flame: 'M12 2c1.3 3.6 6.5 6.3 6.5 12a6.5 6.5 0 0 1-13 0c0-3.2 1.7-5.3 3.4-6.8.1 2.3 1.1 3.8 2.4 4.4-.5-3.4-.3-6.4.7-9.6z',
  'flame-core': 'M12 12.6c1.2 1.5 2.6 2.6 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.6 1.1-2.9 2.6-4.6z',
  target: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm0 3.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  book: 'M3 5.5C5.8 4.3 8.8 4.3 11.2 6v13.2C8.8 17.6 5.8 17.6 3 18.8zM21 5.5c-2.8-1.2-5.8-1.2-8.2.5v13.2c2.4-1.6 5.4-1.6 8.2-.4z',
  bolt: 'M13.5 2L4.5 13.5H11L10 22l9.5-12H13z',
  crown: 'M3 7.5l4.6 4.2L12 4.5l4.4 7.2L21 7.5 19.2 19H4.8z',
  medal: 'M7 2h4l1.5 5.2-2.6 2.5zm10 0h-4l-1.5 5.2 2.6 2.5zM12 9.5a6.2 6.2 0 1 1 0 12.4 6.2 6.2 0 0 1 0-12.4z',
  leaf: 'M20.5 3.5C11 3.5 4.5 9 4.5 17.2c0 1 .1 2 .3 3.1l1.6-1.4C7 13.6 11 9.8 15.5 8.2 11.6 10.4 8.8 13.6 7.6 18c7.4.3 12.9-5.8 12.9-14.5z',
  check: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.6 14.2l-4.3-4.3 1.6-1.6 2.7 2.7 6-6 1.6 1.6z',
  rocket: 'M12 2c3.4 2.3 5.5 6.2 5.3 10.6L15 15.5H9l-2.3-2.9C6.5 8.2 8.6 4.3 12 2zm0 5a1.8 1.8 0 1 0 0 3.6A1.8 1.8 0 0 0 12 7zM9 16.5h6L12 22z'
};

/** Ein Zeichen der Nagrody (gefüllt, nimmt die Farbe des Textes). */
export function RewardIcon({ name, className }: { name: BadgeIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} className={`cg-rw-icon${className === undefined ? '' : ` ${className}`}`} aria-hidden focusable="false">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/** Die Flamme der Serie: brennt, wenn heute schon zählt; grau, wenn die Serie heute noch zu retten ist; zündet live. */
function Flame({ lit, ignite, big = false }: { lit: boolean; ignite: boolean; big?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`cg-rw-flame${lit ? ' is-lit' : ' is-out'}${ignite ? ' is-ignite' : ''}${big ? ' is-big' : ''}`} aria-hidden focusable="false" data-rw-flame={lit ? 'lit' : 'out'}>
      <path className="cg-rw-flame-outer" d={ICON_PATHS.flame} />
      <path className="cg-rw-flame-inner" d={ICON_PATHS['flame-core']} />
    </svg>
  );
}

/** Der Ring des Tagesziels — füllt sich weich; erreicht: ein Haken. */
function GoalRing({ now, goal, size = 'md', pop }: { now: number; goal: number; size?: 'sm' | 'md' | 'lg'; pop: boolean }) {
  const share = Math.max(0, Math.min(1, now / Math.max(1, goal)));
  const r = 15.5;
  const c = 2 * Math.PI * r;
  const ref = useVar<SVGCircleElement>('--cg-rw-dash', `${(c * (1 - share)).toFixed(2)}`);
  const met = now >= goal;
  return (
    <span className={`cg-rw-ring is-${size}${met ? ' is-met' : ''}${pop ? ' is-pop' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(goal, now)} aria-label="Cel dnia" data-rw-goal={`${now}/${goal}`}>
      <svg viewBox="0 0 36 36" aria-hidden focusable="false">
        <circle className="cg-rw-ring-back" cx={18} cy={18} r={r} />
        <circle ref={ref} className="cg-rw-ring-fill" cx={18} cy={18} r={r} strokeDasharray={c.toFixed(2)} />
      </svg>
      <span className="cg-rw-ring-text">{met ? <svg viewBox="0 0 24 24" className="cg-rw-tick" aria-hidden focusable="false" data-rw-tick=""><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : <>{Math.min(now, goal)}<small>/{goal}</small></>}</span>
      {/* 2026-11-05 (Prompt 17) — eben erreicht: der Ring schliesst sich zum Haken, ein kurzer Funkenkranz. */}
      {met && pop && <span className="cg-rw-burst is-ring" aria-hidden>{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</span>}
    </span>
  );
}

/** Ein Balken mit weichem Übergang (die Breite als CSS-Variable). */
function Meter({ value, label }: { value: number; label: string }) {
  const ref = useVar<HTMLSpanElement>('--cg-rw-share', `${(Math.max(0, Math.min(1, value)) * 100).toFixed(1)}%`);
  return <span ref={ref} className="cg-rw-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label}><span /></span>;
}

/** Was in einer Gruppe am meisten zählt — es gibt der Blase Wort, Farbe und Zeichen. */
const RANK: readonly RewardEvent['kind'][] = ['streak', 'goal', 'combo', 'known', 'fast', 'first', 'answer'];
const SHORT: Partial<Record<RewardEvent['kind'], string>> = { answer: 'dobrze', first: 'nowa karta', fast: 'szybko!', known: 'utrwalona karta', goal: 'cel dnia!' };
const FLOAT_ICON: Partial<Record<RewardEvent['kind'], BadgeIcon>> = { streak: 'flame', goal: 'target', combo: 'bolt', known: 'leaf', fast: 'bolt', first: 'star', answer: 'star' };

type FloatItem = { readonly id: string; readonly points: number; readonly text: string; readonly kind: string; readonly icon: BadgeIcon };

/**
 * Die Blase einer Gruppe: EINE für die Punkte (ihr wichtigster Grund im Wort). 2026-11-05 (Prompt 17): Stufe und Abzeichen
 * sind Meldungen am Rand (`RewardToasts.tsx`); flogen die Punkte eben von der Antwort zum Zähler, gibt es keine Blase.
 */
function floatsOf(fresh: Fresh, rules: RewardRules, flown: boolean): FloatItem[] {
  const out: FloatItem[] = [];
  const paid = fresh.events.filter((e) => e.points > 0 && e.kind !== 'level' && e.kind !== 'badge');
  if (paid.length > 0 && !flown) {
    const top = RANK.find((k) => paid.some((e) => e.kind === k)) ?? 'answer';
    const lead = paid.find((e) => e.kind === top)!;
    const text = top === 'answer' ? eventText(lead, rules) : top === 'combo' || top === 'streak' ? eventText(lead, rules) : SHORT[top] ?? eventText(lead, rules);
    out.push({ id: `p${fresh.seq}`, points: paid.reduce((s, e) => s + e.points, 0), text, kind: top, icon: FLOAT_ICON[top] ?? 'star' });
  }
  return out;
}

/**
 * „+N", das in der Ecke aufsteigt und vergeht — je Antwort eine Blase (alle Punkte zusammen). Höchstens `max` stehen
 * zugleich (die neuesten); in einer Zeile nur eine.
 */
function Floaters({ fresh, rules, max = 3, flown = false }: { fresh: Fresh; rules: RewardRules; max?: number; flown?: boolean }) {
  const [items, setItems] = useState<readonly FloatItem[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); }, []);
  useEffect(() => {
    if (fresh.seq === 0 || fresh.events.length === 0) return;
    const made = floatsOf(fresh, rules, flown);
    if (made.length === 0) return;
    /* In einer Zeile nur eine Blase: die der Punkte (sie trägt die Antwort); sonst die neuesten. */
    setItems((was) => (max === 1 ? made.slice(0, 1) : [...was.filter((x) => !made.some((m) => m.id === x.id)), ...made].slice(-max)));
    const t = setTimeout(() => { timers.current.delete(t); setItems((was) => was.filter((x) => !made.includes(x))); }, reducedMotion() ? 3000 : 2400);
    timers.current.add(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `flown` gehört zu derselben Gruppe
  }, [fresh, rules, max]);
  return (
    <div className="cg-rw-floaters" aria-live="polite" data-rw-floaters={items.length}>
      {items.map((x, i) => (
        <span key={x.id} className={`cg-rw-float is-${x.kind}`} data-rw-float={x.kind} data-rw-float-at={i}>
          <RewardIcon name={x.icon} />
          {x.points > 0 && <strong>+{NUM.format(x.points)}</strong>}
          <span>{x.text}</span>
        </span>
      ))}
    </div>
  );
}

/** Die letzten Tage als Reihe: ein Zeichen je Tag (✓ Serie, ◐ gelernt, · nichts) — nie nur Farbe. */
function DayStrip({ list, today, seq, live }: { list: readonly RewardDay[]; today: number; seq: number; live: boolean }) {
  const wide = list.length > 7;
  return (
    <ol className={`cg-rw-days${wide ? ' is-month' : ''}`} aria-label={`Ostatnie ${list.length} dni`}>
      {list.map((d) => {
        const state = d.counted ? 'counted' : d.answers + d.cards > 0 ? 'some' : 'none';
        const isToday = d.day === today;
        const said = `${DAY_NAME.format(new Date(d.day))}: ${d.answers} odpowiedzi, ${NUM.format(d.points)} pkt${d.counted ? ' — dzień serii' : ''}${d.met ? ', cel osiągnięty' : ''}`;
        return (
          <li key={isToday && live ? `${d.day}:${seq}` : d.day} className={`is-${state}${isToday ? ' is-today' : ''}${isToday && live ? ' is-pop' : ''}`} title={said} data-rw-day={state}>
            {!wide && <span className="cg-rw-day-wd" aria-hidden>{WEEKDAY.format(new Date(d.day))}</span>}
            <span className="cg-rw-day-mark" aria-hidden>{d.counted ? '✓' : state === 'some' ? '◐' : '·'}</span>
            <span className="cg-sr">{said}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* -- Die Teile der Tafel ----------------------------------------------------------------------------------------------- */

function PointsPart({ state, fresh, hero, shownTotal, counter }: { state: RewardState; fresh: Fresh; hero: boolean; shownTotal: number; counter: (el: HTMLElement | null) => void }) {
  const bump = useFlash(fresh.events.some((e) => e.points > 0), fresh.seq, 900);
  return (
    <section className={`cg-rw-part cg-rw-points${hero ? ' is-hero' : ''}${bump ? ' is-bump' : ''}`} data-rw-part="points">
      <span className="cg-rw-label"><RewardIcon name="star" className="is-star" />Punkty</span>
      <span ref={counter} className="cg-rw-counter" data-rw-counter=""><CountUp value={shownTotal} className="cg-rw-big" /></span>
      <span className="cg-rw-sub">dziś +{NUM.format(state.today.points + state.events.filter((e) => e.at >= state.today.day && (e.kind === 'goal' || e.kind === 'streak' || e.kind === 'badge')).reduce((s, e) => s + e.points, 0))}</span>
    </section>
  );
}

function LevelPart({ state, fresh, onOpen }: { state: RewardState; fresh: Fresh; onOpen?: () => void }) {
  const up = useFlash(fresh.events.some((e) => e.kind === 'level'), fresh.seq, 2200);
  const l = state.level;
  if (state.rules.levels.length === 0) return null;
  return (
    <section className={`cg-rw-part cg-rw-level${up ? ' is-up' : ''}`} data-rw-part="level" data-rw-level={l.index + 1}>
      <span className="cg-rw-label"><RewardIcon name="crown" className="is-crown" />Poziom {l.index + 1}</span>
      {/* 2026-11-05 (Prompt 17) — die Stufe antippen: „Odznaki i poziomy". */}
      {onOpen === undefined ? <strong className="cg-rw-level-name">{l.name ?? '—'}</strong>
        : <button type="button" className="cg-rw-level-name cg-rw-open" onClick={onOpen} data-rw-open="level">{l.name ?? '—'}</button>}
      <Meter value={l.share} label={l.next === null ? 'Najwyższy poziom' : `Do poziomu „${l.next.name}”`} />
      <span className="cg-rw-sub">{l.next === null ? 'najwyższy poziom' : `do „${l.next.name}”: ${NUM.format(Math.max(0, l.next.at - state.total))} pkt`}</span>
      {up && <span className="cg-rw-burst" aria-hidden>{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</span>}
    </section>
  );
}

function StreakPart({ state, fresh, hero, list }: { state: RewardState; fresh: Fresh; hero: boolean; list: readonly RewardDay[] | null }) {
  const ignite = useFlash(fresh.events.some((e) => e.kind === 'streak'), fresh.seq, 1800);
  const counts = state.rules.streak.counts === 'goal' ? 'cel dnia' : 'nauka';
  const say = state.streak === 0
    ? (state.rules.streak.counts === 'goal' ? 'Osiągnij dziś cel, a zacznie się seria.' : 'Ucz się dziś, a zacznie się seria.')
    : state.streakToday ? `Dzisiaj już się liczy (${counts}).`
      : state.rules.streak.counts === 'goal' ? 'Osiągnij dziś cel, żeby utrzymać serię.' : 'Ucz się dziś, żeby utrzymać serię.';
  return (
    <section className={`cg-rw-part cg-rw-streak${hero ? ' is-hero' : ''}${state.atRisk ? ' is-risk' : ''}`} data-rw-part="streak" data-rw-streak={state.streak} data-rw-streak-today={state.streakToday ? '' : undefined}>
      <span className="cg-rw-label">Seria</span>
      <span className="cg-rw-streak-row">
        <Flame lit={state.streakToday} ignite={ignite} big={hero} />
        <span className="cg-rw-streak-num"><CountUp value={state.streak} className="cg-rw-big" /> <span>{plural(state.streak, 'dzień', 'dni', 'dni')}</span></span>
      </span>
      <span className="cg-rw-sub">{say}{state.best > state.streak ? ` Najdłuższa: ${days(state.best)}.` : ''}</span>
      {list !== null && <DayStrip list={list} today={state.today.day} seq={fresh.seq} live={ignite} />}
    </section>
  );
}

function GoalPart({ state, fresh, hero }: { state: RewardState; fresh: Fresh; hero: boolean }) {
  const pop = useFlash(fresh.events.some((e) => e.kind === 'goal'), fresh.seq, 1600);
  const g = state.rules.goal;
  const left = Math.max(0, g.amount - state.goalNow);
  return (
    <section className={`cg-rw-part cg-rw-goal${hero ? ' is-hero' : ''}`} data-rw-part="goal">
      <span className="cg-rw-label">Cel dnia</span>
      <span className="cg-rw-goal-row">
        <GoalRing now={state.goalNow} goal={g.amount} size={hero ? 'lg' : 'md'} pop={pop} />
        <span className="cg-rw-sub">{left === 0 ? <><strong>Cel osiągnięty!</strong> {state.rules.points.goal > 0 ? `+${state.rules.points.goal} pkt` : ''}</> : <>jeszcze <strong>{NUM.format(left)}</strong> {GOAL_UNIT_LABEL[g.unit]}</>}</span>
      </span>
    </section>
  );
}

function BadgesPart({ state, fresh, all, onOpen }: { state: RewardState; fresh: Fresh; all: boolean; onOpen?: () => void }) {
  const newIds = new Set(fresh.events.filter((e) => e.kind === 'badge').map((e) => e.badge));
  const pop = useFlash(newIds.size > 0, fresh.seq, 2000);
  if (state.badges.length === 0) return null;
  const earned = state.badges.filter((x) => x.at !== null).length;
  const shown = all ? state.badges : state.badges.filter((x) => x.at !== null).slice(-6);
  return (
    <section className="cg-rw-part cg-rw-badges" data-rw-part="badges" data-rw-badges={`${earned}/${state.badges.length}`}>
      <span className="cg-rw-label"><RewardIcon name="medal" className="is-medal" />Odznaki {earned} z {state.badges.length}</span>
      {shown.length === 0 ? <span className="cg-rw-sub">Pierwsza czeka: {state.badges[0]!.badge.name} — {state.badges[0]!.badge.says ?? ''}</span> : (
        <ul className="cg-rw-badge-list">
          {shown.map(({ badge, at, value }) => {
            const got = at !== null;
            const said = `${badge.name}${badge.says === undefined ? '' : ` — ${badge.says}`}${got ? ` (od ${DAY_NAME.format(new Date(at))})` : ` (${NUM.format(Math.min(value, badge.atLeast))} z ${NUM.format(badge.atLeast)})`}`;
            return (
              <li key={badge.id} className={`cg-rw-badge${got ? ' is-got' : ''}${pop && newIds.has(badge.id) ? ' is-new' : ''}`} title={said} data-rw-badge={badge.id} data-rw-badge-got={got ? '' : undefined}>
                <span className="cg-rw-badge-icon"><RewardIcon name={badge.icon} /></span>
                {/* 2026-11-05 (Prompt 17) — ein Abzeichen antippen: „Odznaki i poziomy". */}
                {onOpen === undefined ? <span className="cg-rw-badge-name">{badge.name}</span>
                  : <button type="button" className="cg-rw-badge-name cg-rw-open" onClick={onOpen} data-rw-open="badge">{badge.name}</button>}
                {!got && <Meter value={value / badge.atLeast} label={said} />}
                <span className="cg-sr">{said}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** 2026-11-05 (Prompt 17) — was als Meldung kam, steht auch hier: Ziel, Serie, Stufe, Abzeichen (auch ohne Punkte). */
export const FEED_KINDS: ReadonlySet<RewardEvent['kind']> = new Set(['level', 'badge', 'goal', 'streak']);

function FeedPart({ state, n }: { state: RewardState; n: number }) {
  const list = state.events.filter((e) => e.points > 0 || FEED_KINDS.has(e.kind)).slice(-n).reverse();
  return (
    <section className="cg-rw-part cg-rw-feed" data-rw-part="feed">
      <span className="cg-rw-label">Ostatnie nagrody</span>
      {list.length === 0 ? <span className="cg-rw-sub">Jeszcze nic — pierwsza odpowiedź przyniesie punkty.</span> : (
        <ol className="cg-rw-feed-list">
          {list.map((e) => (
            <li key={e.id} data-rw-feed={e.kind}>
              <span className="cg-rw-feed-time">{TIME.format(new Date(e.at))}</span>
              <strong className="cg-rw-feed-pts">{e.points > 0 ? `+${NUM.format(e.points)}` : ''}</strong>
              <span>{eventText(e, state.rules)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* -- Die Tafel --------------------------------------------------------------------------------------------------------- */

/**
 * DIE TAFEL DER NAGRODY eines Lernenden. `hidden`: was wegbleibt (die Häkchen „Co pokazuje" eines Bausteins);
 * `shape`: eine Zeile, eine schmale Zeile über einer Powtórka, ein Block, das Ganze (hoch, im Vollbild).
 */
/** Ist ein Element im Fenster zu sehen (dorthin fliegen die Punkte nur dann)? */
const onScreen = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
};

/** Punkte, die mit einer Antwort kamen (nicht Ziel, Serie, Abzeichen, Stufe — die sind Meldungen). */
const paidOf = (f: Fresh): number => f.events.filter((e) => e.points > 0 && !FEED_KINDS.has(e.kind)).reduce((s, e) => s + e.points, 0);

/**
 * 2026-11-05 (Prompt 17) — DIE MELDUNGEN EINER GRUPPE: Ziel („Cel dnia osiągnięty! +50"), ein Tag der Serie, jedes Abzeichen
 * (antippen öffnet „Odznaki i poziomy"), eine neue Stufe (der Balken läuft von dort voll, wo er stand).
 */
function toastsOf(fresh: Fresh, state: RewardState, MW: MotionWords, open: () => void): RewardToast[] {
  const out: RewardToast[] = [];
  const first = fresh.events[0];
  const before = first === undefined ? state.total : first.total - first.points;
  for (const e of fresh.events) {
    if (e.kind === 'goal') out.push({ id: e.id, kind: 'goal', title: MW.goalReached, ...(e.points > 0 ? { points: e.points } : {}) });
    else if (e.kind === 'streak') out.push({ id: e.id, kind: 'streak', title: MW.streakDay(e.value ?? 1), ...(e.points > 0 ? { points: e.points } : {}) });
    else if (e.kind === 'badge') {
      const b = state.rules.badges.find((x) => x.id === e.badge);
      out.push({ id: e.id, kind: 'badge', title: b?.name ?? MW.badge, line: b?.says ?? MW.badge, icon: b?.icon ?? 'medal', ...(e.points > 0 ? { points: e.points } : {}), open, openLabel: MW.openBadges });
    } else if (e.kind === 'level') {
      const n = e.value ?? 1;
      out.push({ id: e.id, kind: 'level', title: MW.level(n, state.rules.levels[n - 1]?.name ?? ''), line: MW.levelUp, level: { from: levelAt(state.rules.levels, before).share }, open, openLabel: MW.openBadges });
    }
  }
  return out;
}

export function RewardBoard({ learner, rules, keys, rename, hidden, shape, live = true, onBadges, inline }: {
  learner: Learner | null;
  rules: RewardRules;
  keys?: ReadonlySet<string>;
  rename?: (key: string) => string;
  hidden?: ReadonlySet<string>;
  shape: RewardShape;
  /** Mit Konto oder Platz: alle 30 s holen, was andere Geräte sandten. */
  live?: boolean;
  /** 2026-11-05 (Prompt 17) — „Odznaki i poziomy" öffnen; fehlt es: im Arbeitsbereich die Adresse in der Nauka, sonst hier darunter. */
  onBadges?: () => void;
  /** Die Seite der Abzeichen hier darunter (wo es keine Adresse dafür gibt — eine Seite, ein Link). */
  inline?: (close: () => void) => ReactNode;
}) {
  const { state, fresh } = useRewards(learner, rules, { ...(keys === undefined ? {} : { keys }), ...(rename === undefined ? {} : { rename }), live });
  const cg = useContext(CogitaContext);
  const MW = motionWords(cg === null ? 'pl' : baseLang(cg.lib));
  const show = (p: RewardPiece) => hidden === undefined || !hidden.has(p);
  const now = Date.now();
  const list = useMemo(() => (state === null ? null : lastDays(state, now, shape === 'full' ? 28 : 7)), [state, shape]); // eslint-disable-line react-hooks/exhaustive-deps
  /* „Odznaki i poziomy": im Arbeitsbereich die Adresse in der Nauka; auf einer Seite (ein Link, ein Platz) hier darunter. */
  const [open, setOpen] = useState(false);
  const inWorkspace = cg !== null && cg.me !== null && typeof window !== 'undefined' && window.location.hash.startsWith('#/workspace');
  const openBadges = onBadges ?? (inWorkspace ? () => { window.location.hash = viewPath('learn', cg.lib.libraryId, 'nagrody', 'odznaki'); } : inline !== undefined ? () => setOpen(true) : undefined);
  /*
    2026-11-05 (Prompt 17) — DIE PUNKTE DER EBEN GEGEBENEN ANTWORT fliegen von ihr zum Zähler: solange sie fliegen, steht er
    noch auf dem alten Stand, dann zählt er hoch. Nur, wenn die Antwort eben war und der Zähler zu sehen ist.
  */
  const counterEl = useRef<HTMLElement | null>(null);
  const setCounter = (el: HTMLElement | null) => { counterEl.current = el; };
  const flight = useMemo(() => {
    if (fresh.seq === 0) return null;
    const src = answerSource();
    const sum = paidOf(fresh);
    return src === null || sum <= 0 ? null : { x: src.x, y: src.y, sum, seq: fresh.seq };
  }, [fresh]);
  const [arrived, setArrived] = useState(0);
  const flying = flight !== null && arrived < flight.seq && counterEl.current !== null;
  const shownTotal = state === null ? 0 : flying ? Math.max(0, state.total - flight.sum) : state.total;
  useEffect(() => {
    if (state === null || fresh.seq === 0) return;
    const el = counterEl.current;
    if (flight !== null && el !== null && el.isConnected && onScreen(el)) flyPoints([{ n: flight.sum, x: flight.x, y: flight.y }], el, () => setArrived(flight.seq));
    else if (flight !== null) setArrived(flight.seq);
    pushToasts(toastsOf(fresh, state, MW, openBadges ?? (() => undefined)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- je neuer Gruppe einmal
  }, [fresh]);
  if (state === null) return <div className="cg-rw is-waiting" data-rw-shape={shape}><span className="cg-muted">Liczenie punktów…</span></div>;
  const badgesLink = openBadges !== undefined && show('badges') && (state.badges.length > 0 || state.rules.levels.length > 0)
    ? <button type="button" className="wk-link-btn cg-rw-badges-link" onClick={openBadges} data-rw-badges-open="">{MW.openBadges}</button> : null;
  const inlinePage = open && inline !== undefined ? <div className="cg-rw-inline" data-rw-inline="">{inline(() => setOpen(false))}</div> : null;

  if (shape === 'strip' || shape === 'compact') {
    return (
      <div className={`cg-rw is-${shape}`} data-rw-shape={shape} data-rw-total={state.total}>
        <span className="cg-rw-line">
          {show('points') && <span className="cg-rw-chip is-points" title="Punkty"><RewardIcon name="star" className="is-star" /><span ref={setCounter} className="cg-rw-counter" data-rw-counter=""><CountUp value={shownTotal} className="cg-rw-chip-num" /></span><span className="cg-sr"> {pointsWord(state.total)}</span></span>}
          {show('level') && state.rules.levels.length > 0 && (openBadges === undefined
            ? <span className="cg-rw-chip is-level" title={`Poziom ${state.level.index + 1}`}><RewardIcon name="crown" className="is-crown" />{state.level.name ?? '—'}</span>
            : <button type="button" className="cg-rw-chip is-level cg-rw-open" title={`Poziom ${state.level.index + 1} — ${MW.openBadges}`} onClick={openBadges} data-rw-open="level"><RewardIcon name="crown" className="is-crown" />{state.level.name ?? '—'}</button>)}
          {show('streak') && <StreakChip state={state} fresh={fresh} />}
          {show('goal') && <GoalChip state={state} fresh={fresh} />}
          {show('badges') && state.badges.length > 0 && (openBadges === undefined
            ? <span className="cg-rw-chip is-badges" title="Odznaki"><RewardIcon name="medal" className="is-medal" />{state.badges.filter((x) => x.at !== null).length}/{state.badges.length}</span>
            : <button type="button" className="cg-rw-chip is-badges cg-rw-open" title={MW.openBadges} onClick={openBadges} data-rw-open="badges"><RewardIcon name="medal" className="is-medal" />{state.badges.filter((x) => x.at !== null).length}/{state.badges.length}</button>)}
        </span>
        <Floaters fresh={fresh} rules={rules} max={1} flown={flight !== null} />
        {inlinePage}
      </div>
    );
  }

  const pieces = (['points', 'level', 'streak', 'goal'] as const).filter((p) => show(p) && (p !== 'level' || state.rules.levels.length > 0));
  const hero = shape === 'block' && pieces.length === 1;
  return (
    <div className={`cg-rw is-${shape}`} data-rw-shape={shape} data-rw-total={state.total}>
      <div className="cg-rw-grid" data-rw-pieces={pieces.length}>
        {show('points') && <PointsPart state={state} fresh={fresh} hero={hero} shownTotal={shownTotal} counter={setCounter} />}
        {show('level') && <LevelPart state={state} fresh={fresh} {...(openBadges === undefined ? {} : { onOpen: openBadges })} />}
        {show('streak') && <StreakPart state={state} fresh={fresh} hero={hero} list={list?.slice(-7) ?? null} />}
        {show('goal') && <GoalPart state={state} fresh={fresh} hero={hero} />}
      </div>
      {show('streak') && shape === 'full' && list !== null && (
        <section className="cg-rw-part cg-rw-month" data-rw-part="days">
          <span className="cg-rw-label">Ostatnie 4 tygodnie</span>
          <DayStrip list={list} today={state.today.day} seq={fresh.seq} live={false} />
          <span className="cg-rw-sub">✓ dzień serii, ◐ była nauka, · nic</span>
        </section>
      )}
      {show('badges') && (shape === 'full' || pieces.length === 0) && <BadgesPart state={state} fresh={fresh} all={shape === 'full'} {...(openBadges === undefined ? {} : { onOpen: openBadges })} />}
      {show('feed') && (shape === 'full' || pieces.length === 0) && <FeedPart state={state} n={shape === 'full' ? 12 : 6} />}
      {badgesLink}
      <Floaters fresh={fresh} rules={rules} flown={flight !== null} />
      {inlinePage}
    </div>
  );
}

function StreakChip({ state, fresh }: { state: RewardState; fresh: Fresh }) {
  const ignite = useFlash(fresh.events.some((e) => e.kind === 'streak'), fresh.seq, 1800);
  return (
    <span className={`cg-rw-chip is-streak${state.atRisk ? ' is-risk' : ''}`} title={state.streakToday ? 'Seria — dzisiaj już się liczy' : state.atRisk ? 'Seria — ucz się dziś, żeby ją utrzymać' : 'Seria dni'}>
      <Flame lit={state.streakToday} ignite={ignite} />
      <CountUp value={state.streak} className="cg-rw-chip-num" /><span className="cg-sr"> {plural(state.streak, 'dzień', 'dni', 'dni')} serii</span>
    </span>
  );
}

function GoalChip({ state, fresh }: { state: RewardState; fresh: Fresh }) {
  const pop = useFlash(fresh.events.some((e) => e.kind === 'goal'), fresh.seq, 1600);
  const g = state.rules.goal;
  return (
    <span className="cg-rw-chip is-goal" title={`Cel dnia: ${g.amount} ${GOAL_UNIT_LABEL[g.unit]}`}>
      <GoalRing now={state.goalNow} goal={g.amount} size="sm" pop={pop} />
      {Math.min(state.goalNow, g.amount)}/{g.amount}<span className="cg-sr"> {GOAL_UNIT_LABEL[g.unit]} dziś</span>
    </span>
  );
}

/** Die Zeile im Lauf einer Powtórka: Punkte, Serie, Ziel — und was die eben gegebene Antwort brachte. */
export function RewardHud({ learner, rules, rename }: { learner: Learner | null; rules: RewardRules; rename?: (key: string) => string }) {
  return (
    <div className="cg-rw-hud" data-rw-hud="">
      <RewardBoard learner={learner} rules={rules} {...(rename === undefined ? {} : { rename })} shape="compact" hidden={HUD_HIDDEN} live={false} />
    </div>
  );
}
const HUD_HIDDEN: ReadonlySet<string> = new Set(['level', 'badges', 'feed']);
