/**
 * 2026-11-05 (Prompt 17) — ODZNAKI I POZIOMY: die eigene Seite der Abzeichen und Stufen (COGITA.md §12 „Nagrody").
 *
 * <code>
 *   Najbliższe cele   die 2–3 Abzeichen (oder die nächste Stufe), denen anteilig am wenigsten fehlt — Balken und „jeszcze 2 dni"
 *   Poziomy           alle Stufen als Weg: Punkte je Stufe, ein Zeichen zwischen der jetzigen und der nächsten mit dem Anteil,
 *                     was die nächste bringt (Titel und Rahmen — je Rang ein Rahmen, `levelFrame`)
 *   Odznaki           nach Art (`badgeKindOf`); Stufen desselben Masses (3/7/30 Tage) in einer Zeile; zdobyta (in Farbe, mit
 *                     Datum), w drodze (grau, Balken, wie viel noch), jeszcze nie (grau, mit Beschreibung), auf dem Krajobraz
 *                     gezählt (ein Mass der Karte, das hier niemand gemessen hat)
 *   Historia          alle Nagrody, die neuesten zuerst, nach Tag zu wählen
 * </code>
 *
 * Alles aus `rewardState` — rein aus den Antworten; die Masse der Karte als `extra`, ihre Daten aus den Werten
 * (`awardsOf`). Für die Lehrerin (`readOnly`) dieselbe Seite ohne Handlungen. Nichts nur mit Farbe: Zeichen (✓ ★ ○) und
 * Worte daneben; jeder Balken ein `meter` mit Worten.
 */

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { rewardWords, type Lang, type RewardWords } from './lang';
import { dayStart } from './lessons';
import {
  awardsOf, BADGE_KINDS, badgeKindOf, eventText, freshAwards, levelFrame, rewardState,
  type BadgeIcon, type ExtraMeasures, type RewardAnswer, type RewardBadge, type RewardEvent, type RewardRules, type RewardState
} from './rewards';
import { RewardIcon } from './RewardViews';
import './badges.css';

export interface BadgesPageProps {
  readonly rules: RewardRules;
  /**
   * Die Antworten — eine Sammlung (`learner.progress.answers`, ein Array), bei jeder Rechnung neu durchlaufen. Kein
   * einmaliger Iterator: StrictMode rechnet zweimal, und der zweite fände ihn leer.
   */
  readonly answers: { values(): Iterable<RewardAnswer> };
  readonly rename?: (key: string) => string;
  /** Nur die Karten dieses Ortes. */
  readonly keys?: ReadonlySet<string>;
  /** Die Werte des Lernenden (`progress.values`): daraus die Daten der Abzeichen der Karte (`~award.`). */
  readonly values?: Readonly<Record<string, number>>;
  /** Die Masse der Karte, soweit bekannt (`mapMeasures.ts`). */
  readonly extra?: ExtraMeasures;
  /** Fester Zeitpunkt (sonst jetzt, jede Minute neu). */
  readonly now?: number;
  /** Für die Lehrerin: dieselbe Seite, ohne Handlungen. */
  readonly readOnly?: boolean;
  readonly lang?: Lang;
  /** Die Überschrift — sonst „Odznaki i poziomy"; `''`: keine (in einem `<details>`, dessen summary sie nennt). */
  readonly title?: string;
  /** Abzeichen der Karte, eben erreicht und noch ohne Datum — zum Merken (`Learner.keepAwards`); nie mit `readOnly`. */
  readonly onAwards?: (add: Readonly<Record<string, number>>) => void;
}

type BadgeRow = RewardState['badges'][number];
type Phase = 'got' | 'going' | 'none' | 'map';

const phaseOf = (x: BadgeRow): Phase => (x.at !== null ? 'got' : !x.measured ? 'map' : x.value > 0 ? 'going' : 'none');
const shareOf = (x: BadgeRow): number => Math.max(0, Math.min(1, x.value / Math.max(1, x.badge.atLeast)));
/** Was noch fehlt, in Worten (gerundet nach oben: „jeszcze 1 % mapy", nie „0,4 %"). */
const leftOf = (W: RewardWords, x: BadgeRow): string => W.left(x.badge.measure, Math.max(0, Math.ceil(x.badge.atLeast - x.value)), x.value, x.badge.atLeast);
const saysOf = (W: RewardWords, b: RewardBadge): string => b.says ?? W.says(b.measure, b.atLeast);

/** Ein Balken als `meter` (die Breite als CSS-Variable von rewards.css, gesetzt vor dem Zeichnen) — mit Worten. */
function Meter({ value, label, text }: { value: number; label: string; text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  useLayoutEffect(() => { ref.current?.style.setProperty('--cg-rw-share', `${pct}%`); }, [pct]);
  return (
    <span ref={ref} className="cg-rw-meter cg-bp-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${pct} % — ${text}`} aria-label={label}>
      <span />
    </span>
  );
}

/** Die Zeit, zu der gerechnet wird: fest, oder jetzt — jede Minute neu (ein neuer Tag, eine Serie in Gefahr). */
function useClock(fixed: number | undefined): number {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (fixed !== undefined) return undefined;
    const t = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [fixed]);
  return fixed ?? clock;
}

export function BadgesPage({ rules, answers, rename, keys, values, extra, now, readOnly = false, lang = 'pl', title, onAwards }: BadgesPageProps) {
  const W = useMemo(() => rewardWords(lang), [lang]);
  const clock = useClock(now);
  const awarded = useMemo(() => awardsOf(values), [values]);
  const view = useMemo(() => {
    /* Eine Antwort von eben (ein anderer Tab) fiele sonst aus der Rechnung, die nur Antworten bis eine Minute nach `now` nimmt. */
    const at = now ?? Math.max(clock, Date.now());
    const state = rewardState(answers.values(), rules, at, {
      ...(keys === undefined ? {} : { keys }), ...(rename === undefined ? {} : { rename }), ...(extra === undefined ? {} : { extra }), awarded
    });
    return { at, state };
  }, [answers, rules, now, clock, keys, rename, extra, awarded]);
  const { state } = view;

  /* Abzeichen der Karte, eben erreicht: das Datum merken (dann steht es fest — auch bei der Lehrerin). */
  useEffect(() => {
    if (readOnly || onAwards === undefined) return;
    const add = freshAwards(rules, extra, awarded, view.at);
    if (Object.keys(add).length > 0) onAwards(add);
  }, [readOnly, onAwards, rules, extra, awarded, view.at]);

  const date = useMemo(() => new Intl.DateTimeFormat(W.locale, { day: 'numeric', month: 'long', year: 'numeric' }), [W]);
  const earnedN = state.badges.filter((x) => x.at !== null).length;
  const l = state.level;
  return (
    <div className="cg-rw cg-bp" data-badges-page="" data-bp-readonly={readOnly ? '' : undefined} data-bp-total={state.total} data-bp-badges={`${earnedN}/${state.badges.length}`}>
      {title !== '' && <h3 className="cg-bp-title">{title ?? W.title}</h3>}
      <p className="cg-bp-summary">
        {rules.levels.length > 0 && (
          <span className="cg-rw-chip is-level"><RewardIcon name="crown" className="is-crown" /><span className="cg-sr">{l.index < 0 ? W.beforeFirst : W.level(l.index + 1)}: </span>{l.name ?? '—'}</span>
        )}
        <span className="cg-rw-chip is-points"><RewardIcon name="star" className="is-star" />{W.amount('points', state.total)}</span>
        {state.badges.length > 0 && (
          <span className="cg-rw-chip is-badges"><RewardIcon name="medal" className="is-medal" /><span className="cg-sr">{W.badges}: </span>{W.badgesOf(earnedN, state.badges.length)}</span>
        )}
      </p>
      <NextGoals state={state} W={W} />
      <Levels state={state} W={W} readOnly={readOnly} />
      <Badges state={state} W={W} readOnly={readOnly} date={date} />
      <History state={state} W={W} />
    </div>
  );
}

/* -- Najbliższe cele ---------------------------------------------------------------------------------------------------- */

interface Goal {
  readonly key: string;
  readonly name: string;
  readonly icon: BadgeIcon;
  readonly share: number;
  readonly left: string;
}

/** Die 2–3 nächsten Ziele: die nächste Stufe und die gemessenen Abzeichen, denen anteilig am wenigsten fehlt. */
function NextGoals({ state, W }: { state: RewardState; W: RewardWords }) {
  const l = state.level;
  const goals: Goal[] = [];
  if (l.next !== null) goals.push({ key: 'level', name: W.levelNamed(l.next.name), icon: 'crown', share: l.share, left: W.left('points', Math.max(0, l.next.at - state.total), state.total, l.next.at) });
  for (const x of state.badges) {
    if (x.at !== null || !x.measured) continue;
    goals.push({ key: `b:${x.badge.id}`, name: x.badge.name, icon: x.badge.icon, share: shareOf(x), left: leftOf(W, x) });
  }
  /* Stabil: bei gleichem Anteil die Stufe zuerst, dann die Folge der Regel. */
  const top = goals.sort((a, b) => b.share - a.share).slice(0, 3);
  const unmeasured = state.badges.some((x) => x.at === null && !x.measured);
  return (
    <section className="cg-bp-section" data-bp-part="next">
      <h4>{W.nextGoals}</h4>
      {top.length === 0 ? <p className="cg-muted">{unmeasured ? W.restOnMap : W.allDone}</p> : (
        <ol className="cg-bp-goals">
          {top.map((g) => (
            <li key={g.key} className="cg-bp-goal" data-bp-goal={g.key}>
              <span className="cg-bp-goal-icon" aria-hidden><RewardIcon name={g.icon} /></span>
              <span className="cg-bp-goal-body">
                <strong>{g.name}</strong>
                <Meter value={g.share} label={W.meter(g.name)} text={g.left} />
                <span className="cg-bp-left">{g.left}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* -- Poziomy ------------------------------------------------------------------------------------------------------------ */

/** Der Weg der Stufen: jede mit Name, Schwelle und Rahmen; zwischen der jetzigen und der nächsten, wo der Lernende steht. */
function Levels({ state, W, readOnly }: { state: RewardState; W: RewardWords; readOnly: boolean }) {
  const levels = state.rules.levels;
  const l = state.level;
  if (levels.length === 0) {
    return (
      <section className="cg-bp-section" data-bp-part="levels">
        <h4>{W.levels}</h4>
        <p className="cg-muted">{W.noLevels}</p>
      </section>
    );
  }
  const pct = Math.round(l.share * 100);
  const here = l.next === null ? null : (
    <li className="cg-bp-here" data-bp-here={pct}>
      <span className="cg-bp-here-dot" aria-hidden />
      <span className="cg-bp-here-body">
        <strong>{readOnly ? W.hereOther(pct, l.next.name) : W.here(pct, l.next.name)}</strong>
        <Meter value={l.share} label={W.levelMeter(l.next.name)} text={W.toNext(Math.max(0, l.next.at - state.total), l.next.name)} />
        <span className="cg-bp-left">{W.toNext(Math.max(0, l.next.at - state.total), l.next.name)}</span>
      </span>
    </li>
  );
  return (
    <section className="cg-bp-section" data-bp-part="levels">
      <h4>{W.levels}</h4>
      <ol className="cg-bp-levels" data-bp-levels={levels.length}>
        {l.index < 0 && here}
        {levels.map((lv, i) => {
          const phase = i < l.index ? 'past' : i === l.index ? 'now' : 'ahead';
          const frame = levelFrame(i, levels.length);
          const mark = phase === 'past' ? '✓' : phase === 'now' ? '★' : '○';
          const said = phase === 'past' ? W.reached : phase === 'now' ? (readOnly ? W.current : W.you) : (readOnly ? W.notYet : W.ahead);
          return (
            <Fragment key={i}>
              <li className={`cg-bp-level is-${phase}`} data-bp-level={i + 1} data-bp-frame={frame} aria-current={phase === 'now' ? 'step' : undefined}>
                <span className={`cg-bp-frame is-f${frame}`} aria-hidden>{phase === 'now' ? <RewardIcon name="crown" /> : i + 1}</span>
                <span className="cg-bp-level-body">
                  <strong className="cg-bp-level-name">{lv.name}</strong>
                  <span className="cg-bp-level-meta">{W.level(i + 1)} · {W.from(lv.at)} · {W.frame[frame]}</span>
                  <span className={`cg-bp-level-state is-${phase}`}><span aria-hidden>{mark} </span>{said}</span>
                </span>
              </li>
              {i === l.index && here}
            </Fragment>
          );
        })}
      </ol>
      <p className="cg-bp-brings" data-bp-brings="">{l.next === null ? W.top : W.brings(l.next.name, W.frameGives[levelFrame(l.index + 1, levels.length)] ?? '')}</p>
    </section>
  );
}

/* -- Odznaki ------------------------------------------------------------------------------------------------------------ */

/** Die Abzeichen nach Art; in einer Art die desselben Masses als Stufen einer Zeile (nach der Schwelle). */
function Badges({ state, W, readOnly, date }: { state: RewardState; W: RewardWords; readOnly: boolean; date: Intl.DateTimeFormat }) {
  const groups = useMemo(() => BADGE_KINDS.map((kind) => {
    const list = state.badges.filter((x) => badgeKindOf(x.badge) === kind);
    const rows: BadgeRow[][] = [];
    const byMeasure = new Map<string, BadgeRow[]>();
    for (const x of list) {
      const had = byMeasure.get(x.badge.measure);
      if (had === undefined) { const row = [x]; byMeasure.set(x.badge.measure, row); rows.push(row); } else had.push(x);
    }
    for (const row of rows) row.sort((a, b) => a.badge.atLeast - b.badge.atLeast);
    return { kind, list, rows };
  }).filter((g) => g.list.length > 0), [state]);
  const earned = state.badges.filter((x) => x.at !== null).length;
  const when = (at: number | null) => (at === null ? '' : date.format(new Date(at)));
  return (
    <section className="cg-bp-section" data-bp-part="badges">
      <h4>{W.badges} {state.badges.length > 0 && <span className="cg-bp-count">{W.badgesOf(earned, state.badges.length)}</span>}</h4>
      {groups.length === 0 ? <p className="cg-muted">{W.noBadges}</p> : groups.map((g) => (
        <div key={g.kind} className="cg-bp-group" data-bp-kind={g.kind}>
          <h5>{W.kinds[g.kind]} <span className="cg-bp-count">{g.list.filter((x) => x.at !== null).length}/{g.list.length}</span></h5>
          <ul className="cg-bp-badges">
            {g.rows.map((row) => (row.length === 1
              ? <BadgeCard key={row[0]!.badge.id} x={row[0]!} W={W} readOnly={readOnly} when={when} />
              : <TierRow key={`m:${row[0]!.badge.measure}`} rows={row} W={W} readOnly={readOnly} when={when} />))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** Wie weit ein Abzeichen ist: zdobyta (Datum), auf dem Krajobraz gezählt, jeszcze nie, oder ein Balken mit „jeszcze …". */
function BadgeStatus({ x, W, readOnly, when }: { x: BadgeRow; W: RewardWords; readOnly: boolean; when: (at: number | null) => string }) {
  const phase = phaseOf(x);
  if (phase === 'got') return <span className="cg-bp-status is-got"><span aria-hidden>✓ </span>{W.earned(when(x.at))}</span>;
  if (phase === 'map') return <span className="cg-bp-status is-map"><span aria-hidden>◇ </span>{readOnly ? W.onMapOther : W.onMap}</span>;
  if (phase === 'none') return <span className="cg-bp-status is-none"><span aria-hidden>○ </span>{W.notStarted}</span>;
  const left = leftOf(W, x);
  return (
    <>
      <Meter value={shareOf(x)} label={W.meter(x.badge.name)} text={left} />
      <span className="cg-bp-status is-going">{left}</span>
    </>
  );
}

function BadgeCard({ x, W, readOnly, when }: { x: BadgeRow; W: RewardWords; readOnly: boolean; when: (at: number | null) => string }) {
  const phase = phaseOf(x);
  return (
    <li className={`cg-bp-badge is-${phase}`} data-bp-badge={x.badge.id} data-bp-phase={phase}>
      <span className="cg-bp-badge-icon" aria-hidden><RewardIcon name={x.badge.icon} /></span>
      <span className="cg-bp-badge-body">
        <strong className="cg-bp-badge-name">{x.badge.name}</strong>
        <span className="cg-bp-says">{saysOf(W, x.badge)}{x.badge.points > 0 ? <span className="cg-bp-bonus"> {W.bonus(x.badge.points)}</span> : null}</span>
        <BadgeStatus x={x} W={W} readOnly={readOnly} when={when} />
      </span>
    </li>
  );
}

/** Stufen eines Masses (z. B. 3, 7, 30 Tage) in einer Zeile; darunter, wie weit es zur nächsten noch ist. */
function TierRow({ rows, W, readOnly, when }: { rows: readonly BadgeRow[]; W: RewardWords; readOnly: boolean; when: (at: number | null) => string }) {
  const measure = rows[0]!.badge.measure;
  const next = rows.find((x) => x.at === null) ?? null;
  const got = rows.filter((x) => x.at !== null).length;
  return (
    <li className="cg-bp-tiers" data-bp-tiers={measure}>
      <span className="cg-bp-tiers-head">
        <strong>{W.measure[measure] ?? measure}</strong>
        <span className="cg-bp-count">{next === null ? W.allTiers : W.tiers(got, rows.length)}</span>
      </span>
      <ol className="cg-bp-tier-list">
        {rows.map((x) => {
          const phase = phaseOf(x);
          return (
            <li key={x.badge.id} className={`cg-bp-tier is-${phase}`} data-bp-badge={x.badge.id} data-bp-phase={phase}>
              <span className="cg-bp-badge-icon" aria-hidden><RewardIcon name={x.badge.icon} /></span>
              <strong className="cg-bp-badge-name">{x.badge.name}</strong>
              <span className="cg-bp-says">{saysOf(W, x.badge)}{x.badge.points > 0 ? <span className="cg-bp-bonus"> {W.bonus(x.badge.points)}</span> : null}</span>
              <span className={`cg-bp-status is-${phase}`}>
                {phase === 'got' ? <><span aria-hidden>✓ </span>{W.earned(when(x.at))}</> : <><span aria-hidden>○ </span>{x === next ? leftOf(W, x) : W.amount(x.badge.measure, x.badge.atLeast)}</>}
              </span>
            </li>
          );
        })}
      </ol>
      {next !== null && (
        <span className="cg-bp-tiers-next">
          {phaseOf(next) === 'map'
            ? <span className="cg-bp-status is-map"><span aria-hidden>◇ </span>{readOnly ? W.onMapOther : W.onMap}</span>
            : <Meter value={shareOf(next)} label={W.meter(next.badge.name)} text={leftOf(W, next)} />}
        </span>
      )}
    </li>
  );
}

/* -- Historia ----------------------------------------------------------------------------------------------------------- */

const SHOWN = new Set<RewardEvent['kind']>(['level', 'badge', 'goal', 'streak']);
const PAGE = 60;
const EVENT_ICON: Partial<Record<RewardEvent['kind'], BadgeIcon>> = { level: 'crown', goal: 'target', streak: 'flame' };

/** Alle Nagrody — Ereignisse mit Punkten, Stufen, Abzeichen, Ziele, Serien —, die neuesten zuerst, nach Tag. */
function History({ state, W }: { state: RewardState; W: RewardWords }) {
  const rules = state.rules;
  const days = useMemo(() => {
    const by = new Map<number, RewardEvent[]>();
    for (let i = state.events.length - 1; i >= 0; i -= 1) {
      const e = state.events[i]!;
      if (e.points <= 0 && !SHOWN.has(e.kind)) continue;
      const day = dayStart(e.at);
      const list = by.get(day);
      if (list === undefined) by.set(day, [e]); else list.push(e);
    }
    return [...by.entries()].map(([day, events]) => ({ day, events, points: events.reduce((s, e) => s + e.points, 0) }));
  }, [state]);
  const [day, setDay] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const dayName = useMemo(() => new Intl.DateTimeFormat(W.locale, { weekday: 'long', day: 'numeric', month: 'long' }), [W]);
  const time = useMemo(() => new Intl.DateTimeFormat(W.locale, { hour: '2-digit', minute: '2-digit' }), [W]);
  const picked = days.filter((d) => String(d.day) === day);
  const chosen = picked.length > 0 ? picked : days;
  const all = chosen.reduce((s, d) => s + d.events.length, 0);
  let budget = limit;
  const parts: { day: number; points: number; events: RewardEvent[] }[] = [];
  for (const d of chosen) {
    if (budget <= 0) break;
    const events = d.events.slice(0, budget);
    budget -= events.length;
    parts.push({ day: d.day, points: d.points, events });
  }
  const shown = parts.reduce((s, d) => s + d.events.length, 0);
  const textOf = (e: RewardEvent): string => {
    const name = e.kind === 'level' ? rules.levels[(e.value ?? 1) - 1]?.name ?? String(e.value ?? '')
      : e.kind === 'badge' ? rules.badges.find((x) => x.id === e.badge)?.name ?? e.badge ?? '' : '';
    return W.event(e.kind, e.value, name, rules.combo.every) ?? eventText(e, rules);
  };
  const iconOf = (e: RewardEvent): BadgeIcon | null => (e.kind === 'badge' ? rules.badges.find((x) => x.id === e.badge)?.icon ?? 'medal' : EVENT_ICON[e.kind] ?? null);
  return (
    <section className="cg-bp-section" data-bp-part="history">
      <h4>{W.history}</h4>
      {days.length === 0 ? <p className="cg-muted">{W.noHistory}</p> : (
        <>
          <label className="wk-field cg-bp-day">
            <span>{W.day}</span>
            <select value={picked.length > 0 ? day : ''} onChange={(e) => { setDay(e.target.value); setLimit(PAGE); }} data-bp-day="">
              <option value="">{W.allDays(days.length)}</option>
              {days.map((d) => <option key={d.day} value={String(d.day)}>{dayName.format(new Date(d.day))} ({d.events.length})</option>)}
            </select>
          </label>
          <ol className="cg-bp-history" data-bp-history={shown}>
            {parts.map((d) => (
              <li key={d.day} data-bp-history-day={d.day}>
                <h5><span>{dayName.format(new Date(d.day))}</span>{d.points > 0 && <span className="cg-bp-count">{W.dayTotal(d.points)}</span>}</h5>
                <ol className="cg-bp-events">
                  {d.events.map((e) => {
                    const icon = iconOf(e);
                    return (
                      <li key={e.id} className={`is-${e.kind}`} data-bp-event={e.kind}>
                        <span className="cg-bp-event-time">{time.format(new Date(e.at))}</span>
                        <strong className="cg-bp-event-pts">{e.points > 0 ? `+${W.num(e.points)}` : ''}</strong>
                        <span className="cg-bp-event-text">{icon !== null && <RewardIcon name={icon} className={`is-${e.kind}`} />}{textOf(e)}</span>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
          {shown < all && (
            <div className="wk-actions">
              <button type="button" className="wk-btn wk-btn-quiet" onClick={() => setLimit((n) => n + PAGE * 4)} data-bp-more="">{W.more(all - shown)}</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
