/**
 * 2026-11-05 (Prompt 17) — ODZNAKI I POZIOMY: die eigene Seite der Abzeichen und Stufen (COGITA.md §12 „Nagrody").
 *
 * 2026-11-05 (Odznaki; vom Nutzer: „zu sperrig") — KATEGORIEN MIT STUFEN AUS STOFFEN, kompakt:
 * <code>
 *   Poziomy     eine Zeile: jede Stufe eine Medaille in ihrem Rahmen (Holz … Diamant, `levelFrame`), die jetzige mit Krone,
 *               die Linie golden bis hierher; darunter ihr Name, der Balken zur nächsten, was die nächste bringt;
 *               „Wszystkie poziomy" klappt die Liste mit den Schwellen auf
 *   Odznaki     je Kategorie (die Art) eine Kachel: die Medaille im höchsten erreichten Stoff, die Stufen als Punkte, der
 *               Stoff in Worten, der Balken zur nächsten Stufe („do srebra: jeszcze 5 dni"); die Kachel, der am wenigsten
 *               fehlt, heisst „najbliżej" (statt des früheren Blocks der nächsten Ziele). Antippen klappt darunter ihre
 *               Stufen auf — in einer Zeile, am Telefon untereinander: Medaille, Stoff, Name, Schwelle, Datum oder was
 *               fehlt; eine Kategorie zugleich
 *   Historia    zugeklappt; aufgeklappt alle Nagrody, die neuesten zuerst, nach Tag zu wählen
 * </code>
 *
 * Alles aus `rewardState` und `badgeCategories` — rein aus den Antworten; die Masse der Karte als `extra`, ihre Daten aus den
 * Werten (`awardsOf`). Für die Lehrerin (`readOnly`) dieselbe Seite ohne Handlungen. Nichts nur mit Farbe: der Stoff steht
 * als Wort, die Medaillen unterscheiden sich in der Gestalt, Zeichen (✓ ★ ○ ◇) und Worte daneben; jeder Balken ein `meter`.
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { t, useT } from '../core/i18n';
import { rewardWords, type Lang, type RewardWords } from './lang';
import { dayStart } from './lessons';
import {
  awardsOf, badgeCategories, eventText, freshAwards, levelFrame, materialsOf, rewardState,
  type BadgeCategory, type BadgeIcon, type BadgeKind, type BadgeStep, type ExtraMeasures, type RewardAnswer, type RewardBadge, type RewardEvent, type RewardRules, type RewardState
} from './rewards';
import { BadgeMedal, MaterialPips, RewardIcon } from './RewardViews';
import { motionLevel } from '../ui/motion';
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

const shareOf = (s: Pick<BadgeStep, 'badge' | 'value'>): number => Math.max(0, Math.min(1, s.value / Math.max(1, s.badge.atLeast)));
/** Was zur Stufe noch fehlt (gerundet nach oben: „jeszcze 1 % mapy", nie „0,4 %"); beim Lauf guter Antworten der Rekord. */
const leftOf = (W: RewardWords, s: Pick<BadgeStep, 'badge' | 'value'>): string => (s.badge.measure === 'combo'
  ? W.comboLeft(s.value, s.badge.atLeast)
  : W.left(s.badge.measure, Math.max(0, Math.ceil(s.badge.atLeast - s.value)), s.value, s.badge.atLeast));
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
  /* 2026-11-12 — neu, sobald das Wörterbuch der Sprache geladen ist (sonst blieben die Schlüssel stehen). */
  const loaded = useT();
  const W = useMemo(() => rewardWords(lang), [lang, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const cats = useMemo(() => badgeCategories(state.badges), [state]);

  /* Abzeichen der Karte, eben erreicht: das Datum merken (dann steht es fest — auch bei der Lehrerin). */
  useEffect(() => {
    if (readOnly || onAwards === undefined) return;
    const add = freshAwards(rules, extra, awarded, view.at);
    if (Object.keys(add).length > 0) onAwards(add);
  }, [readOnly, onAwards, rules, extra, awarded, view.at]);

  const date = useMemo(() => new Intl.DateTimeFormat(W.locale, { day: 'numeric', month: 'short', year: 'numeric' }), [W]);
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
      <Levels state={state} W={W} readOnly={readOnly} />
      <Categories cats={cats} W={W} readOnly={readOnly} date={date} />
      <History state={state} W={W} />
    </div>
  );
}

/* -- Poziomy: eine Zeile -------------------------------------------------------------------------------------------------- */

type LevelPhase = 'past' | 'now' | 'ahead';

/** Die Stufen als Medaillen in ihren Rahmen (eine Zeile), die jetzige mit Krone; darunter der Weg zur nächsten. */
function Levels({ state, W, readOnly }: { state: RewardState; W: RewardWords; readOnly: boolean }) {
  const levels = state.rules.levels;
  const l = state.level;
  const [all, setAll] = useState(false);
  const listId = useId();
  /* Die Linie hinter den Medaillen: golden bis zur jetzigen Stufe und anteilig weiter (CSS-Variablen vor dem Zeichnen). */
  const track = useRef<HTMLOListElement>(null);
  const done = levels.length < 2 ? 0 : Math.max(0, Math.min(1, (Math.max(0, l.index) + (l.next === null || l.index < 0 ? 0 : l.share)) / (levels.length - 1)));
  useLayoutEffect(() => {
    track.current?.style.setProperty('--cg-bp-n', String(Math.max(1, levels.length)));
    track.current?.style.setProperty('--cg-bp-done', done.toFixed(3));
  }, [done, levels.length]);
  if (levels.length === 0) {
    return (
      <section className="cg-bp-section" data-bp-part="levels">
        <h4 className="cg-bp-h">{W.levels}</h4>
        <p className="cg-muted">{W.noLevels}</p>
      </section>
    );
  }
  const left = l.next === null ? 0 : Math.max(0, l.next.at - state.total);
  const phaseOf = (i: number): LevelPhase => (i < l.index ? 'past' : i === l.index ? 'now' : 'ahead');
  const said = (phase: LevelPhase): string => (phase === 'past' ? W.reached : phase === 'now' ? (readOnly ? W.current : W.you) : readOnly ? W.notYet : W.ahead);
  return (
    <section className="cg-bp-section" data-bp-part="levels">
      <div className="cg-bp-head">
        <h4 className="cg-bp-h">{W.levels}</h4>
        <span className="cg-bp-count">{l.index < 0 ? W.beforeFirst : W.levelOf(l.index + 1, levels.length)}</span>
      </div>
      <ol ref={track} className="cg-bp-track" data-bp-levels={levels.length}>
        {levels.map((lv, i) => {
          const phase = phaseOf(i);
          const frame = levelFrame(i, levels.length);
          return (
            <li key={i} className={`cg-bp-node is-${phase}`} data-bp-level={i + 1} data-bp-frame={frame} aria-current={phase === 'now' ? 'step' : undefined} title={`${lv.name} · ${W.from(lv.at)} · ${W.frame[frame]}`}>
              <BadgeMedal material={frame} ghost={phase === 'ahead'} size={phase === 'now' ? 'md' : 'sm'}>
                {phase === 'now' ? <RewardIcon name="crown" /> : <span className="cg-bp-node-n">{i + 1}</span>}
              </BadgeMedal>
              <span className="cg-sr">{`${lv.name} — ${W.level(i + 1)}, ${W.from(lv.at)}, ${W.frame[frame]}: ${said(phase)}`}</span>
            </li>
          );
        })}
      </ol>
      <div className="cg-bp-level-now" data-bp-here={Math.round(l.share * 100)}>
        <span className="cg-bp-level-name">
          <strong>{l.name ?? W.beforeFirst}</strong>
          {l.index >= 0 && <span className="cg-bp-count"> · {W.frame[levelFrame(l.index, levels.length)]}</span>}
        </span>
        {l.next === null ? <span className="cg-bp-left">{W.top}</span> : (
          <>
            <Meter value={l.share} label={W.levelMeter(l.next.name)} text={W.toNext(left, l.next.name)} />
            <span className="cg-bp-left">{W.toNext(left, l.next.name)}</span>
          </>
        )}
      </div>
      {l.next !== null && <p className="cg-bp-brings" data-bp-brings="">{W.brings(l.next.name, W.frameGives[levelFrame(l.index + 1, levels.length)] ?? '')}</p>}
      <button type="button" className="wk-link-btn cg-bp-more" aria-expanded={all} aria-controls={listId} onClick={() => setAll(!all)} data-bp-all-levels={all ? '1' : '0'}>
        {W.allLevels} <span aria-hidden>{all ? '▴' : '▾'}</span>
      </button>
      {all && (
        <ol id={listId} className="cg-bp-level-list" data-bp-level-list={levels.length}>
          {levels.map((lv, i) => {
            const phase = phaseOf(i);
            const frame = levelFrame(i, levels.length);
            return (
              <li key={i} className={`cg-bp-level-row is-${phase}`} data-bp-level-row={i + 1}>
                <BadgeMedal material={frame} ghost={phase === 'ahead'} size="sm"><span className="cg-bp-node-n">{i + 1}</span></BadgeMedal>
                <span className="cg-bp-level-row-name"><strong>{lv.name}</strong> <span className="cg-bp-count">{W.from(lv.at)} · {W.frame[frame]}</span></span>
                <span className={`cg-bp-status is-${phase === 'past' ? 'got' : phase === 'now' ? 'now' : 'none'}`}><span aria-hidden>{phase === 'past' ? '✓ ' : phase === 'now' ? '★ ' : '○ '}</span>{said(phase)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/* -- Odznaki: Kategorien mit Stufen ------------------------------------------------------------------------------------- */

/**
 * Die Kacheln der Kategorien; eine aufgeklappt: ihre Stufen darunter — breit unter allen Kacheln, am Telefon (eine Spalte)
 * gleich unter der angetippten (die Folge über `order`: Kacheln 0, 2, 4 …, die Stufen gleich danach).
 */
function Categories({ cats, W, readOnly, date }: { cats: readonly BadgeCategory[]; W: RewardWords; readOnly: boolean; date: Intl.DateTimeFormat }) {
  const [open, setOpen] = useState<BadgeKind | null>(null);
  const base = useId();
  const detail = useRef<HTMLLIElement | null>(null);
  /* Aufgeklappt: die Stufen ins Bild (am Telefon stehen sie unter allen Kacheln). */
  useEffect(() => {
    if (open === null) return;
    detail.current?.scrollIntoView?.({ block: 'nearest', behavior: motionLevel() === 'full' ? 'smooth' : 'auto' });
  }, [open]);
  if (cats.length === 0) {
    return (
      <section className="cg-bp-section" data-bp-part="badges">
        <h4 className="cg-bp-h">{W.badges}</h4>
        <p className="cg-muted">{W.noBadges}</p>
      </section>
    );
  }
  const earned = cats.reduce((s, c) => s + c.earned, 0);
  const total = cats.reduce((s, c) => s + c.total, 0);
  /* Die Kategorie, deren nächster Stufe anteilig am wenigsten fehlt (gemessen und schon begonnen): „najbliżej". */
  let closest: BadgeKind | null = null;
  let best = 0;
  for (const c of cats) if (c.next !== null && c.next.measured && c.share > best) { best = c.share; closest = c.kind; }
  const openCat = cats.find((c) => c.kind === open) ?? null;
  const idOf = (k: BadgeKind) => `${base}-${k}`;
  const openAt = openCat === null ? -1 : cats.indexOf(openCat);
  const order = (n: number) => (el: HTMLLIElement | null) => { el?.style.setProperty('--cg-bp-i', String(n)); };
  return (
    <section className="cg-bp-section" data-bp-part="badges">
      <div className="cg-bp-head">
        <h4 className="cg-bp-h">{W.badges}</h4>
        <span className="cg-bp-count">{W.badgesOf(earned, total)}</span>
      </div>
      <ul className="cg-bp-cats" data-bp-cats={cats.length}>
        {cats.map((c, i) => (
          <li key={c.kind} ref={order(2 * i)}>
            <CategoryTile c={c} W={W} readOnly={readOnly} open={open === c.kind} closest={closest === c.kind} controls={idOf(c.kind)} onToggle={() => setOpen(open === c.kind ? null : c.kind)} />
          </li>
        ))}
        {openCat !== null && (
          <li ref={(el) => { detail.current = el; order(2 * openAt + 1)(el); }} className="cg-bp-detail-li">
            <CategorySteps c={openCat} W={W} readOnly={readOnly} date={date} id={idOf(openCat.kind)} />
          </li>
        )}
      </ul>
    </section>
  );
}

/** Was zur nächsten Stufe einer Kategorie fehlt, mit ihrem Stoff: „do srebra: jeszcze 5 dni". */
const toNextStep = (W: RewardWords, s: BadgeStep): string => W.toMaterial(s.material, leftOf(W, s));

/** Eine Kategorie als Kachel (ein Knopf): Medaille im höchsten Stoff, Name, Stufen als Punkte, der Stoff, der Weg zur nächsten. */
function CategoryTile({ c, W, readOnly, open, closest, controls, onToggle }: { c: BadgeCategory; W: RewardWords; readOnly: boolean; open: boolean; closest: boolean; controls: string; onToggle: () => void }) {
  const name = W.kinds[c.kind];
  const next = c.next;
  return (
    <button type="button" className={`cg-bp-cat${open ? ' is-open' : ''}${closest ? ' is-closest' : ''}${c.top === null ? ' is-empty' : ''}`} aria-expanded={open} aria-controls={controls} onClick={onToggle} title={W.showSteps(name)}
      data-bp-category={c.kind} data-bp-material={c.top ?? ''} data-bp-open={open ? '1' : '0'} data-bp-closest={closest ? '1' : undefined} data-bp-earned={`${c.earned}/${c.total}`}>
      <BadgeMedal material={c.top} icon={c.icon} ghost={c.top === null} size="lg" />
      <span className="cg-bp-cat-name">{name}</span>
      <span className="cg-bp-cat-tier">
        <MaterialPips steps={c.ladders.flatMap((x) => x.steps)} />
        <span className="cg-bp-cat-mat">{c.top === null ? W.noMaterial : W.material[c.top]}</span>
      </span>
      {next === null ? (<span className="cg-bp-left is-done"><span aria-hidden>{'✓ '}</span>{W.allTiers}</span>)
        : !next.measured ? (<span className="cg-bp-left is-map"><span aria-hidden>{'◇ '}</span>{readOnly ? W.onMapShortOther : W.onMapShort}</span>)
          : (
            <span className="cg-bp-cat-next">
              <Meter value={c.share} label={W.meter(name)} text={toNextStep(W, next)} />
              <span className="cg-bp-left">{toNextStep(W, next)}</span>
            </span>
          )}
      {closest && <span className="cg-bp-closest">{W.closest}</span>}
      <span className="cg-bp-chev" aria-hidden>{open ? '▴' : '▾'}</span>
    </button>
  );
}

type StepPhase = 'got' | 'next' | 'later' | 'map';
/** 2026-11-05 (Odznaki) — mehrere Stufen eines Stoffes: Srebro I, II, III. */
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** Die Stufen einer Kategorie: je Leiter (ein Mass) eine Zeile, vom Holz bis zum Diamant. */
function CategorySteps({ c, W, readOnly, date, id }: { c: BadgeCategory; W: RewardWords; readOnly: boolean; date: Intl.DateTimeFormat; id: string }) {
  const name = W.kinds[c.kind];
  return (
    <div id={id} className="cg-bp-detail" role="region" aria-label={name} data-bp-detail={c.kind}>
      <div className="cg-bp-head">
        <strong>{name}</strong>
        <span className="cg-bp-count">{W.tiers(c.earned, c.total)}</span>
      </div>
      {c.ladders.map((ladder) => {
        const next = ladder.steps.find((s) => s.at === null) ?? null;
        return (
          <div key={ladder.measure} className="cg-bp-ladder" data-bp-ladder={ladder.measure}>
            {c.ladders.length > 1 && <span className="cg-bp-ladder-name">{W.measure[ladder.measure] ?? ladder.measure}</span>}
            <ol className="cg-bp-steps" data-bp-steps={ladder.steps.length}>
              {ladder.steps.map((s) => {
                const phase: StepPhase = s.at !== null ? 'got' : !s.measured ? 'map' : s === next ? 'next' : 'later';
                return (
                  <li key={s.badge.id} className={`cg-bp-step is-${phase}`} title={saysOf(W, s.badge)} data-bp-step={s.badge.id} data-bp-material={s.material} data-bp-phase={phase}>
                    <BadgeMedal material={s.material} icon={s.badge.icon} ghost={s.at === null} />
                    <span className="cg-bp-step-body">
                      <strong className="cg-bp-step-mat">{W.material[s.material]}{s.grades > 1 ? ` ${ROMAN[s.grade - 1] ?? s.grade}` : ""}</strong>
                      <span className="cg-bp-step-name">{s.badge.name}</span>
                      <span className="cg-bp-step-goal">{W.amount(s.badge.measure, s.badge.atLeast)}{s.badge.points > 0 ? <span className="cg-bp-bonus"> {W.bonus(s.badge.points)}</span> : null}</span>
                      {phase === 'got' && <span className="cg-bp-status is-got"><span aria-hidden>✓ </span>{W.earned(date.format(new Date(s.at!)))}</span>}
                      {phase === 'next' && (
                        <>
                          <Meter value={shareOf(s)} label={W.meter(s.badge.name)} text={leftOf(W, s)} />
                          <span className="cg-bp-status is-going">{leftOf(W, s)}</span>
                        </>
                      )}
                      {phase === 'map' && <span className="cg-bp-status is-map"><span aria-hidden>{'◇ '}</span>{readOnly ? W.onMapShortOther : W.onMapShort}</span>}
                      {phase === 'later' && <span className="cg-bp-status is-none"><span aria-hidden>○ </span>{W.later}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}

/* -- Historia (zugeklappt) ------------------------------------------------------------------------------------------------ */

const SHOWN = new Set<RewardEvent['kind']>(['level', 'badge', 'goal', 'streak']);
const PAGE = 60;
const EVENT_ICON: Partial<Record<RewardEvent['kind'], BadgeIcon>> = { level: 'crown', goal: 'target', streak: 'flame' };

/** Alle Nagrody — Ereignisse mit Punkten, Stufen, Abzeichen (mit ihrem Stoff), Ziele, Serien —, die neuesten zuerst, nach Tag. */
function History({ state, W }: { state: RewardState; W: RewardWords }) {
  const rules = state.rules;
  const materials = useMemo(() => materialsOf(rules.badges), [rules]);
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
    const badge = e.kind === 'badge' ? rules.badges.find((x) => x.id === e.badge) : undefined;
    const m = e.kind === 'badge' ? materials.get(e.badge ?? '') : undefined;
    const name = e.kind === 'level' ? rules.levels[(e.value ?? 1) - 1]?.name ?? String(e.value ?? '')
      : e.kind === 'badge' ? `${badge?.name ?? e.badge ?? ''}${m === undefined ? '' : ` · ${W.material[m]}`}` : '';
    return W.event(e.kind, e.value, name, rules.combo.every) ?? (e.kind === 'badge' ? t('cogitaViewsRewards.event.badge', { name }) : eventText(e, rules));
  };
  const iconOf = (e: RewardEvent): BadgeIcon | null => (e.kind === 'badge' ? rules.badges.find((x) => x.id === e.badge)?.icon ?? 'medal' : EVENT_ICON[e.kind] ?? null);
  return (
    <details className="cg-bp-section cg-bp-history-box" data-bp-part="history">
      <summary className="cg-bp-history-sum" data-bp-history-toggle="">
        <strong>{W.history}</strong>
        {days.length > 0 && <span className="cg-bp-count">{W.historyDays(days.length)}</span>}
      </summary>
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
    </details>
  );
}

