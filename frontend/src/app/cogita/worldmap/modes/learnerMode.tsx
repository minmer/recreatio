/**
 * MODUS „DER LERNENDE" (die Grundlage, zuletzt in der Liste): was die Karte einem Lernenden zeigt — der Weg zum gewählten Turm oder zum
 * Ziel (kräftig, Erledigtes dünn), die Zeichen der Navigation, die Ansicht (alle · gewusst · zu entdecken · fällig · Luki), das Ziel,
 * der gewählte Wegweiser, unten der Weg in Schritten, über einem gewählten Ding seine Knöpfe und „Schritt n" am jetzigen Schritt — und
 * was ein Klick tut (wählen; Doppelklick: Ziel und Weg; freier Boden: alles ohne Weg).
 *
 * Der Stand des Lernenden (Navigation, was läuft, Felder, Abspielen) lebt im Wirt (`WorldLandscape.tsx`); hier steht, was davon auf die
 * Karte geht, und die Knöpfe über Türmen, Pfaden, Gabelungen, Wegweisern und dem Haus (`learnerButtons` — auch der Rundgang zeigt sie).
 */

import type { ReactNode } from 'react';

import type { T } from '../../../core/i18n';
import type { MapMode, MapPick, MapThing } from '../mapMode';
import type { PanelActions } from '../WorldPanels';
import { homeRepeatBelow, keepRepeatAt, REPEAT_AT } from '../WorldPanels';
import type { TowerButton } from '../WorldPillars';
import type { RouteFocus } from '../wmFocus';
import { freshRoads } from '../wmFocus';
import { isPathTarget, type QPath } from '../wmPaths';
import type { PlanStep } from '../wmPlan';
import type { LevelProgress } from '../wmRuns';
import { dueOf } from '../wmViews';
import type { WorldState } from '../wmState';
import { HOME, type Lines, type World } from '../wmTypes';
import type { Timetable } from '../wmNav';

export interface LearnerButtons {
  readonly tower: (id: string) => TowerButton[];
  readonly lane: (id: string) => TowerButton[];
  readonly fork: (id: string) => TowerButton[];
  readonly sign: (key: string) => TowerButton[];
  /** Je Art des Gewählten (Haus = Turm `HOME`). */
  readonly forThing: (kind: string, id: string) => TowerButton[];
}

/**
 * 2026-11-14 (Eigentümer: „ein Klick auf einen Turm: Knöpfe über ihm, das Feld daneben ist für die Statistik") — DIE KNÖPFE ÜBER EINEM
 * TURM. Noch nicht erobert: „Odkryj" (voll, das Wichtigere) und „Zdobądź od razu" (umrandet). Erobert: jeder Weg weiter
 * (`onwardRoads`, gegangen umrandet; unter dem Zeiger leuchtet er) — steht ein Wegweiser am Turm, zuerst seine Fragen; „Powtórz" nur,
 * wenn etwas fällig ist (in der Farbe, wie nötig). Gibt es nichts davon, kein Knopf. Immer klein „⋯": das Feld mit den Zahlen.
 * AM HAUS (2026-11-14): die Fragen, die hier beginnen, die Wege, die von hier etwas Neues bringen, und „Powtórz (N)" mit der Schwelle
 * (ein Klick auf „< 100 %" wechselt sie: 90 · 100 · 115 · 130 %), dazu der Rundgang.
 * Die Knöpfe zeigen den Stand, den die Karte zeigt (`bs`: im Rundgang den erfundenen).
 */
export function learnerButtons(c: {
  readonly bs: WorldState;
  /** Der echte Stand (die Wiederholung am Haus). */
  readonly state: WorldState;
  readonly lines: Lines;
  readonly t: T;
  readonly nameOf: (id: string) => string;
  readonly act: PanelActions;
  readonly levelsCount: number;
  readonly levels: ReadonlyMap<string, LevelProgress>;
  readonly pathsAt: (key: string) => readonly QPath[];
  readonly leadPath: (id: string) => void;
  readonly travel: (section: string) => void;
  readonly peekRoad: (road: readonly string[] | null) => void;
  readonly toggleMore: () => void;
  readonly conquerFully: (id: string) => void;
  readonly homePool: readonly string[];
  readonly repeatAt: number;
  readonly setRepeatAt: (v: number) => void;
  readonly startTour: () => void;
}): LearnerButtons {
  const { bs, state, lines, t, nameOf, act, pathsAt } = c;
  const moreButton = (id: string): TowerButton => ({ key: 'more', label: '⋯', small: true, line: true, title: t('cogitaWorld.panel.more'), onClick: c.toggleMore, data: { 'world-tower-more': id } });
  const home = (): TowerButton[] => {
    const out: TowerButton[] = [];
    for (const qp of pathsAt('home')) out.push({ key: `q:${qp.id}`, label: t('cogitaWorld.panel.askButton', { name: qp.title }), onClick: () => c.leadPath(qp.id), data: { 'world-tower-path': qp.id } });
    for (const r of freshRoads(bs, lines, HOME)) {
      const last = r.sections[r.sections.length - 1]!;
      out.push({ key: `r:${r.sections.join('>')}`, label: t('cogitaWorld.panel.roadButton', { name: nameOf(r.to) }),
        onClick: () => (bs.places.get(r.to)?.conquered !== true ? act.lead(r.to, last) : act.show('place', r.to)), peek: (on) => c.peekRoad(on ? r.sections : null),
        data: { 'world-onward-to': r.to, 'world-onward-road': r.sections.join(' '), 'world-onward-done': '0' } });
    }
    const list = homeRepeatBelow(state, c.homePool, c.repeatAt);
    const pct = Math.round(c.repeatAt * 100);
    if (list.length > 0) out.push({ key: 'repeat', label: t('cogitaWorld.home.repeatN', { count: list.length }), title: t('cogitaWorld.home.repeatSays'), onClick: () => act.repeat(list, t('cogitaWorld.home.repeatRun', { pct })), data: { 'world-repeat-go': String(list.length) } });
    /* Die Schwelle nur, wenn es überhaupt etwas zu wiederholen gibt. */
    if (c.homePool.length > 0) out.push({ key: 'at', label: t('cogitaWorld.home.below', { pct }), small: true, line: true, title: t('cogitaWorld.home.repeatTitle'),
      onClick: () => { const i = REPEAT_AT.indexOf(c.repeatAt as (typeof REPEAT_AT)[number]); const v = REPEAT_AT[(i + 1) % REPEAT_AT.length]!; c.setRepeatAt(v); keepRepeatAt(v); }, data: { 'world-repeat-at': String(c.repeatAt) } });
    /* 2026-11-14 (Eigentümer) — vom Haus aus der Rundgang über die Karte, jederzeit von vorn. */
    out.push({ key: 'tour', label: t('cogitaWorld.tour.start'), line: true, onClick: c.startTour, data: { 'world-tour-start': '' } });
    out.push(moreButton(HOME));
    return out;
  };
  /* Ein Pfad: ein Knopf — offen „Odkryj" (gegangen: umrandet), sonst „Prowadź mnie tutaj" zu seinem Turm. */
  const lane = (id: string): TowerButton[] => {
    const sec = lines.sections.get(id), st = bs.sections.get(id);
    if (sec === undefined || st === undefined) return [moreButton(id)];
    const out: TowerButton[] = [];
    if (st.ticket.met && st.open) out.push({ key: 'go', label: st.travelled ? t('cogitaWorld.panel.travelAgain') : t('cogitaWorld.panel.travel'), line: st.travelled, onClick: () => c.travel(id), data: { 'world-travel': id } });
    else if (bs.places.get(sec.to)?.conquered !== true) out.push({ key: 'lead', label: t('cogitaWorld.panel.leadMe'), onClick: () => act.lead(sec.to, id), data: { 'world-lead': sec.to } });
    return [...out, moreButton(id)];
  };
  /* Eine Gabelung: jeder Weg ein Knopf (offen voll, gegangen umrandet; was noch nicht geht, führt hin). */
  const fork = (id: string): TowerButton[] => {
    const out: TowerButton[] = [];
    for (const sid of lines.junctions.get(id)?.out ?? []) {
      const sec = lines.sections.get(sid), st = bs.sections.get(sid);
      if (sec === undefined || st === undefined) continue;
      const go = st.ticket.met && st.open;
      out.push({ key: sid, label: t('cogitaWorld.panel.roadButton', { name: nameOf(sec.to) }), line: st.travelled || !go,
        onClick: () => (go ? c.travel(sid) : bs.places.get(sec.to)?.conquered === false ? act.lead(sec.to, sid) : act.show('section', sid)), peek: (on) => c.peekRoad(on ? [sid] : null),
        data: go ? { 'world-choose': sid } : { 'world-lead': sec.to } });
    }
    return [...out, moreButton(id)];
  };
  /* Ein Wegweiser: seine Fragen, jede ein Knopf (gleich geführt). */
  const sign = (key: string): TowerButton[] => [
    ...pathsAt(key).map((qp): TowerButton => ({ key: qp.id, label: t('cogitaWorld.panel.askButton', { name: qp.title }), onClick: () => c.leadPath(qp.id), data: { 'world-path-lead': qp.id } })),
    moreButton(key)
  ];
  const tower = (id: string): TowerButton[] => {
    if (id === HOME) return home();
    const ps = bs.places.get(id);
    const more = moreButton(id);
    if (ps === undefined) return [more];
    if (!ps.conquered) {
      const unseen = ps.cards.filter((k) => bs.band(k) === 'unseen').length;
      return [
        { key: 'explore', label: t('cogitaWorld.panel.explore'), onClick: () => act.lead(id), data: { 'world-lead': id } },
        { key: 'conquer', label: t('cogitaWorld.panel.conquerDirect'), line: true,
          title: unseen > 0 ? t('cogitaWorld.panel.conquerUnseen', { count: unseen, all: ps.cards.length }) : t('cogitaWorld.panel.conquerSays', { count: ps.cards.length }),
          onClick: () => (c.levelsCount > 0 ? act.run(id) : act.learn(ps.cards.filter((k) => bs.band(k) !== 'known'), nameOf(id))),
          data: { 'world-run-for': String(c.levelsCount > 0 ? Math.min(c.levelsCount, ps.level + 1) : 0), 'world-run-unseen': String(unseen) } },
        more
      ];
    }
    const out: TowerButton[] = [];
    for (const qp of pathsAt(`p:${id}`)) out.push({ key: `q:${qp.id}`, label: t('cogitaWorld.panel.askButton', { name: qp.title }), onClick: () => c.leadPath(qp.id), data: { 'world-tower-path': qp.id } });
    for (const r of freshRoads(bs, lines, id)) {
      const last = r.sections[r.sections.length - 1]!;
      const toConquer = bs.places.get(r.to)?.conquered !== true;
      out.push({ key: `r:${r.sections.join('>')}`, label: t('cogitaWorld.panel.roadButton', { name: nameOf(r.to) }), line: r.travelled,
        onClick: () => (toConquer ? act.lead(r.to, last) : act.show('place', r.to)), peek: (on) => c.peekRoad(on ? r.sections : null),
        data: { 'world-onward-to': r.to, 'world-onward-road': r.sections.join(' '), 'world-onward-done': r.travelled ? '1' : '0' } });
    }
    /* 2026-11-14 (Eigentümer) — erobert, aber nicht „Mistrzowsko": „Zdobądź w pełni" (erst die Stufen mit Erklärung, dann Start). */
    if (c.levelsCount > 0 && c.levels.get(id)?.perfect !== true) out.push({ key: 'full', label: t('cogitaWorld.panel.conquerFully'), line: true, onClick: () => c.conquerFully(id), data: { 'world-conquer-full': id } });
    const due = dueOf(bs, id);
    if (due.length > 0) out.push({ key: 'review', label: t('cogitaWorld.panel.reviewN', { count: due.length }), score: ps.share, onClick: () => act.review(due, nameOf(id)), data: { 'world-review': String(due.length) } });
    return [...out, more];
  };
  const forThing = (kind: string, id: string): TowerButton[] => (kind === 'section' ? lane(id) : kind === 'sign' ? sign(id) : kind === 'junction' ? fork(id) : tower(id));
  return { tower, lane, fork, sign, forThing };
}

/** Was der Lernende gewählt hat (auch ein Weg zu einer Frage, `qpath`). */
export interface LearnerChosen { readonly kind: 'place' | 'section' | 'home' | 'junction' | 'sign' | 'qpath'; readonly id: string }

export function learnerMode(v: {
  readonly hasLearner: boolean;
  readonly world: World;
  readonly lines: Lines;
  readonly t: T;
  readonly chosen: LearnerChosen | null;
  /** Ein Schritt des Weges, den man sich zeigen liess (Turm oder Pfad). */
  readonly peek: string | null;
  readonly route: readonly string[] | null;
  readonly faint: readonly string[] | null;
  readonly focus: RouteFocus | null;
  readonly marks: { readonly start: string | null; readonly target: string | null; readonly forks: readonly string[] } | null;
  readonly lit: ReadonlySet<string> | null;
  readonly goal: string | null;
  readonly signs: readonly { readonly key: string; readonly paths: readonly string[] }[];
  /** Wo Knöpfe über dem Gewählten stehen (`null`: keine). */
  readonly floatKind: 'place' | 'section' | 'sign' | null;
  readonly buttons: LearnerButtons;
  /** Der Weg in Schritten (unten). */
  readonly wayCard: ReactNode;
  /** „Schritt n" am jetzigen Schritt: nur, wenn sonst nichts darüber liegt. */
  readonly next: { readonly tt: Timetable; readonly step: PlanStep; readonly open: (s: PlanStep) => void } | null;
  readonly pick: MapPick;
}): MapMode {
  const { chosen, peek, lines, world, t } = v;
  const peekLane = peek !== null && lines.sections.has(peek);
  const of: MapThing | null = chosen;
  const nowStep = v.next?.tt.upcoming[0];
  return {
    id: 'learner',
    active: true,
    draw: {
      route: peekLane ? [peek] : v.route,
      faint: peekLane ? v.route : v.faint,
      chosen: peek !== null && world.places.has(peek) ? peek : chosen?.kind === 'place' || chosen?.kind === 'junction' ? chosen.id : null,
      focus: v.focus,
      marks: v.marks === null ? null : { start: v.marks.start, target: v.marks.target, forks: v.marks.forks },
      lit: v.lit,
      /* Ein Weg zu einer Frage ist kein Turm: ohne Fahne. */
      goal: v.goal !== null && isPathTarget(v.goal) ? null : v.goal,
      chosenSign: chosen?.kind === 'sign' ? chosen.id : chosen?.kind === 'qpath' ? v.signs.find((x) => x.paths.includes(chosen.id))?.key ?? null : null,
      under: v.wayCard,
      towerActions: v.floatKind !== null && chosen !== null && of !== null && v.hasLearner ? { place: chosen.id, kind: v.floatKind, buttons: v.buttons.forThing(chosen.kind, chosen.id), of } : null,
      /* 2026-11-14 (Eigentümer: „Zacznij tutaj führt in die Irre — mal beginnt es, mal geht es weiter“) — allgemein: welcher Schritt, welche Art. */
      startAction: v.next === null || nowStep === undefined ? null : {
        label: t('cogitaWorld.way.stepButton', { n: v.next.tt.done.length + 1, kind: t(`cogitaWorld.way.kind.${nowStep.kind}`) }),
        onClick: () => v.next?.open(nowStep),
        at: nowStep.kind !== 'travel' ? { kind: 'place' as const, id: nowStep.place } : { kind: 'section' as const, id: nowStep.section }
      }
    },
    pick: v.pick
  };
}
