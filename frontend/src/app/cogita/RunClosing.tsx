/**
 * 2026-11-04 (Prompt 9) — DAS ENDE EINER POWTÓRKA: was sie freigeschaltet hat (beim Namen und mit seiner Art: eine
 * Erzählung, so viele Fragen), EIN grosser Knopf zum naheliegenden Nächsten — das Thema, das diese Powtórka verlangt hat;
 * sonst der nächste Schritt zum Ziel; sonst das erste Freigeschaltete —, dazu klein „Inne tematy" und „Wróć do mapy",
 * und leise „Ćwicz dalej" für wer weiter üben will.
 *
 * Freigeschaltet: ein Eintrag mit Karten, der jetzt lernbar ist (nicht gelernt, alles davor gelernt, keine schwache Karte in
 * der Kette davor) und es vor diesem Lauf nicht war. Gesucht wird hinter dem, was der Lauf gefragt hat (zwei Stufen weit).
 */

import { useMemo } from 'react';

import type { Card } from './cardBasics';
import { gaugeFromMarks, itemKnowness, type Gauge } from './knowing';
import { LS_LEARNED } from './landscape';
import { lockCards } from './landscapeData';
import type { Words } from './lang';
import { renamer, type Learner } from './learn';
import { cardEntities, cardsAbout } from './prerequisites';
import { storyUnitsOf } from './flowFacts';
import type { CogitaLibrary } from './store';
import { TexText } from '../ui/tex/Tex';
import { entityNameTex } from './ui';

export interface Closing {
  /** Das Thema, das diese Powtórka verlangt hat („Najpierw powtórz"). */
  readonly origin?: string | null;
  /** Der Weg zum Ziel, in der Reihenfolge des Lernens (das Ziel zuletzt). */
  readonly goal?: readonly string[] | null;
  /** Ein Thema öffnen (lernen, die Erzählung spielen). */
  readonly openTopic: (id: string) => void;
  readonly others?: () => void;
  readonly back?: () => void;
  readonly label: (id: string) => string;
}

export function RunClosing({ lib, learner, cards, asked, closing, W, onPractise, onOnward, onBack }: {
  lib: CogitaLibrary;
  learner: Learner | null;
  cards: readonly Card[];
  /** Die Karten, die dieser Lauf gefragt hat. */
  asked: readonly string[];
  closing?: Closing;
  W: Words;
  /** Ohne Gastgeber: ein Freigeschaltetes hier üben. */
  onPractise: (id: string) => void;
  onOnward: (() => void) | null;
  onBack: (() => void) | null;
}) {
  const made = useMemo(() => {
    const graph = lib.prerequisites();
    const rename = renamer(lib.merges());
    const fp = new Map(cards.map((c) => [c.key, c.fingerprint] as const));
    const marksAll = (key: string) => learner?.marks(key, fp.get(key), rename) ?? [];
    const now = Date.now();
    /* Der Stand vor diesem Lauf: ohne die Antworten seit seinem Anfang (die erste Antwort des Laufs). */
    const askedSet = new Set(asked);
    const runStart = Math.min(...asked.flatMap((k) => marksAll(k).map((m) => m.at)).filter((at) => now - at < 6 * 3_600_000), now);
    const marksBefore = (key: string) => marksAll(key).filter((m) => m.at < runStart);
    const before = gaugeFromMarks(cards, marksBefore, lib.dependencies(), now, graph);
    const after = gaugeFromMarks(cards, marksAll, lib.dependencies(), now, graph);
    const learned = (g: Gauge, id: string) => itemKnowness(g, id) >= LS_LEARNED - 1e-12;
    const stories = storyUnitsOf(lib, (id) => after.testing.has(id));
    const ready = (g: Gauge, id: string) => !learned(g, id) && (graph.needs.get(id) ?? []).every((p) => learned(g, p)) && lockCards(g, graph, id, cards).length === 0;
    const touched = new Set(cards.filter((c) => askedSet.has(c.key)).flatMap(cardEntities));
    const near = new Set<string>();
    for (const id of touched) for (const a of graph.builds.get(id) ?? []) { near.add(a); for (const b of graph.builds.get(a) ?? []) near.add(b); }
    const unlocked = [...near].filter((id) => !touched.has(id) && (after.testing.has(id) || stories.has(id)) && ready(after, id) && !ready(before, id));
    const kindOf = (id: string) => (stories.has(id) ? W.story : W.questions(cardsAbout(cards, id).length));
    const goalNext = closing?.goal?.find((id) => !learned(after, id)) ?? null;
    return { unlocked: unlocked.slice(0, 8), kindOf, goalNext };
  }, [lib, learner, cards, asked, closing?.goal, W]);
  const name = (id: string) => <TexText text={entityNameTex(lib, id)} />;
  const open = closing?.openTopic ?? onPractise;
  const big = closing?.origin != null ? { id: closing.origin, text: W.learnNow(closing.label(closing.origin)), why: 'origin' }
    : made.goalNext !== null ? { id: made.goalNext, text: W.nextToGoal(closing?.label(made.goalNext) ?? lib.label(lib.entity(made.goalNext)!)), why: 'goal' }
    : made.unlocked.length > 0 ? { id: made.unlocked[0], text: W.nextTopic(lib.label(lib.entity(made.unlocked[0])!)), why: 'unlocked' }
    : null;
  return (
    <div className="cg-run-closing" data-run-closing="">
      {made.unlocked.length > 0 ? (
        <div data-run-unlocked={made.unlocked.length}>
          <p className="cg-run-closing-h">{W.unlocked}</p>
          <ul className="cg-run-unlocked">
            {made.unlocked.map((id) => <li key={id} data-run-unlocked-item={id}>{name(id)} <span className="cg-muted">· {made.kindOf(id)}</span></li>)}
          </ul>
        </div>
      ) : <p className="cg-muted">{W.nothingUnlocked}</p>}
      <div className="wk-actions">
        {big !== null && <button type="button" className="wk-btn cg-run-next" onClick={() => open(big.id)} data-run-next={big.why} data-run-next-id={big.id}>{big.text}</button>}
        {closing?.others !== undefined && <button type="button" className="wk-btn wk-btn-line" onClick={closing.others} data-run-others="">{W.otherTopics}</button>}
        {(closing?.back ?? onBack) != null && <button type="button" className="wk-btn wk-btn-line" onClick={closing?.back ?? onBack ?? undefined} data-run-back="">{W.backToMap}</button>}
        {onOnward !== null && <button type="button" className="wk-link-btn" onClick={onOnward} data-run-onward="">{W.keepPractising}</button>}
      </div>
    </div>
  );
}
