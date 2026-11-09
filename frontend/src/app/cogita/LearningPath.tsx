/**
 * 2026-10-27 — DIE ŚCIEŻKA: die Reihenfolge des Lernens einer Baza, sichtbar (Nauka → Ścieżka).
 *
 * Aus dem einen Graphen der Voraussetzungen (`prerequisites.ts` — die Felder „Najpierw trzeba
 * znać" und die Zależności der Ustawienia) die Ebenen, von den Grundlagen her; je Eintrag, wie er
 * bei diesem Lernenden steht:
 * <code>
 *   umiem             seine Karten (und die Pytania über ihn) sitzen
 *   w nauce           schon gefragt, noch nicht sicher
 *   do nauki          frei, noch nie gefragt
 *   czeka na …        vor ihm sitzt etwas noch nicht — die Powtórka hält seine Karten zurück
 *   tylko porządkuje  keine Karte prüft ihn: er sperrt nichts, an seiner Stelle zählt, was davor kommt
 * </code>
 * „Ucz się od podstaw" fragt die ganze Baza, „Ucz się" an einem Eintrag fragt ihn — beide als die Powtórka
 * „Najpierw podstawy" aus allgemeinen Schritten (2026-10-30, `presets.ts` `basicsRevision`): die Karten dessen,
 * was vor ihm kommt, dazu, und jede Karte erst, wenn das Vorherige sitzt.
 *
 * Daneben (`EntityPrerequisites`) die Reihenfolge an einem Eintrag in der Wiedza: was vor ihm kommt,
 * was auf ihm aufbaut, ein Kreis.
 *
 * 2026-11-03 (F) — <b>die Ebenen sind jetzt eine Karte</b> (`PathMap`): von unten nach oben, Gabeln und
 * Zusammenführungen, der Stand wie im Krajobraz; ein Knoten bietet „Ucz się" (mit dem, was davor kommt). Die Liste der
 * Ebenen bleibt darunter zum Aufklappen (Vorleser, sehr grosse Baza).
 */

import { useMemo } from 'react';

import type { Card } from './cardBasics';
import { gaugeFromMarks, itemKnowness, ownKnowness } from './knowing';
import { spacingFor } from './spacing';
import { KNOWN } from './knowness';
import { answeredCards, renamer, type Learner } from './learn';
import { learnerFlows, STORY_BUTTON, storyStage, storyUnitsOf } from './flowFacts';
import { authorOrder, gaugeKnow, pathOfEntries, usePathRun } from './PathLearn';
import { PathMap } from './PathMap';
import { pathMarks } from './pathLayout';
import { cardsAbout, levelLabel, nearestNeeds, questionIds } from './prerequisites';
import { useRunRewards } from './RewardsEditor';
import { entityName, entityNameTex, originPath, useCtx } from './ui';
import { Loading } from '../ui/Loading';
import { TexText } from '../ui/tex/Tex';
import { LangScope, rich, useT } from '../core/i18n';
import { baseLang } from './lang';

type State = 'known' | 'learning' | 'fresh' | 'waiting' | 'order';

const STATE_LABEL: Record<State, string> = {
  known: 'cogitaLearnPath.path.state.known',
  learning: 'cogitaLearnPath.path.state.learning',
  fresh: 'cogitaLearnPath.path.state.fresh',
  waiting: 'cogitaLearnPath.path.state.waiting',
  order: 'cogitaLearnPath.path.state.order'
};

type PathProps = { learner: Learner | null; cards: readonly Card[] | null; go: (...tail: string[]) => void };

/** 2026-11-05 — die Ścieżka spricht die Sprache der Baza. */
export function LearningPath(props: PathProps) {
  const { lib } = useCtx();
  return <LangScope lang={baseLang(lib)}><LearningPathIn {...props} /></LangScope>;
}

function LearningPathIn({ learner, cards, go }: PathProps) {
  const { lib, writes } = useCtx();
  const t = useT();
  /* 2026-11-02 — zählt die Nauka Punkte: auch im Lauf „Najpierw podstawy" (`RewardsEditor.tsx`). */
  const rewards = useRunRewards();
  const graph = lib.prerequisites();
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  /* 2026-10-30 — die Powtórka „Najpierw podstawy" aus allgemeinen Schritten, über die genannten Einträge (oder alles). */
  const run = usePathRun(lib, learner, cards, rewards);
  const setRun = (r: { title: string; ids: readonly string[] | null }) => run.start(r.title, r.ids);

  if (cards === null) return <Loading label={t('cogitaLearnPath.path.counting')} />;
  if (run.view !== null) return <>{run.view}</>;

  if (graph.edges.length === 0) {
    return (
      <section className="cg-card cg-path-empty" data-learning-path="empty">
        <h3>{t('cogitaLearnPath.path.order')}</h3>
        <p>{t('cogitaLearnPath.path.emptyText')}</p>
        <ul>
          <li>{rich(t('cogitaLearnPath.path.emptyKind'), { c: (s) => <code>{s}</code> })}</li>
          <li>{t('cogitaLearnPath.path.emptyQuestion')}</li>
        </ul>
        {writes && <button type="button" className="wk-btn wk-btn-line" onClick={() => go('schematy', 'rodzaje')}>{t('cogitaLearnPath.path.toSchemes')}</button>}
      </section>
    );
  }

  const now = Date.now();
  const fp = new Map(cards.map((c) => [c.key, c.fingerprint]));
  const g = gaugeFromMarks([...cards, ...(learner === null ? [] : answeredCards(learner.progress, new Set(fp.keys())))], (key) => learner?.marks(key, fp.get(key), rename) ?? [], lib.dependencies(), now, undefined, spacingFor(lib, learner));
  /*
    2026-11-03 (Prompt 5) — ERZÄHLUNGEN ALS KNOTEN: eine Einheit, auf die ein Ablauf zeigt und die keine eigenen Karten hat,
    steht auf der Karte (gelernt, wenn ihr Przegląd bestanden ist); ihr Knopf öffnet den Spieler — an der Stelle des
    Lernenden, „Powtórz przegląd" am Przegląd. Nie Karten üben, die sie nicht hat.
  */
  const stories = storyUnitsOf(lib, (id) => g.testing.has(id));
  const told = learnerFlows(lib, learner?.progress.positions);
  const stageOf = (id: string) => { const f = stories.get(id); return f === undefined ? null : storyStage(f, told.get(f.id)); };
  const stateOf = (id: string): { state: State; waits: string[] } => {
    if (!g.askable.has(id)) return { state: 'order', waits: [] };
    if (ownKnowness(g, id) >= KNOWN) return { state: 'known', waits: [] };
    /* Dieselbe Bedingung wie „Filtr znajomości" mit „to, co trzeba znać wcześniej" (die Powtórka „Najpierw podstawy"). */
    const waits = nearestNeeds([id], graph, (x) => g.askable.has(x)).filter((x) => itemKnowness(g, x) < KNOWN);
    if (waits.length > 0) return { state: 'waiting', waits };
    const asked = cardsAbout(cards, id).some((c) => (learner?.marks(c.key, c.fingerprint, rename).length ?? 0) > 0);
    return { state: asked ? 'learning' : 'fresh', waits: [] };
  };

  const levels = new Map<number, string[]>();
  for (const [id, at] of graph.level) if (lib.entity(id) !== undefined) levels.set(at, [...(levels.get(at) ?? []), id]);
  const order = [...levels.keys()].sort((a, b) => a - b);
  const placed = new Set([...graph.level.keys()]);
  const outside = new Set(cards.flatMap((c) => [c.entity ?? c.question]).filter((id) => !placed.has(id))).size;
  const name = (id: string) => entityName(lib, id);
  /* 2026-11-01 — gezeigt mit seinen Wzory; `name` bleibt zum Sortieren und für Titel. */
  const shown = (id: string) => entityNameTex(lib, id);
  /* 2026-11-03 (F) — die Karte: was Karten hat, von den Grundlagen her (Einträge, die nur ordnen, sind durchsichtig), je Ebene in der Reihenfolge des Autors. */
  const byAuthor = authorOrder(lib);
  const asks = questionIds(cards);
  const items = order.flatMap((at) => levels.get(at)!.filter((id) => (g.askable.has(id) && !asks.has(id)) || stories.has(id)).sort(byAuthor)).map((id) => ({ id, label: name(id) }));
  const model = pathOfEntries(items, graph, false);
  const known = gaugeKnow(g);
  const marks = pathMarks(model, (id) => { const st = stageOf(id); return st === null ? known(id) : { learned: st === 'passed', due: false }; });

  return (
    <div className="cg cg-path" data-learning-path={order.length}>
      <div className="cg-row-between">
        <p className="cg-muted">{t('cogitaLearnPath.path.intro', { levels: t('cogitaLearnPath.path.levels', { count: order.length }), entries: t('cogitaLearnPath.path.entries', { count: placed.size }) })}</p>
        <button type="button" className="wk-btn" onClick={() => setRun({ title: t('cogitaLearnPath.path.fromBasicsTitle'), ids: null })}>{t('cogitaLearnPath.path.fromBasics')}</button>
      </div>
      {graph.circles.length > 0 && (
        <p className="wk-warn" data-path-circles={graph.circles.length}>
          {t('cogitaLearnPath.path.circles')}<TexText text={graph.circles.slice(0, 4).map((d) => t('cogitaLearnPath.path.requires', { child: shown(d.child), parent: shown(d.parent) })).join('; ')} />{t('cogitaLearnPath.path.circlesFix')}
        </p>
      )}
      <PathMap model={model} marks={marks} title={t('cogitaLearn.words.pathTitle')} name={(id) => <TexText text={shown(id)} />}
        detail={(id) => { const n = cardsAbout(cards, id).length; return n === 0 ? null : t('cogitaLearn.count.cards', { count: n }); }}
        actions={(id, state) => (
          <div className="wk-actions">
            {stageOf(id) !== null ? (
              <button type="button" className="wk-btn" onClick={() => go('przebiegi', stories.get(id)!.id, 'graj', ...(stageOf(id) === 'review' ? ['przeglad'] : []))} data-path-story={stageOf(id)!}>
                {STORY_BUTTON[stageOf(id)!]}
              </button>
            ) : (
              <button type="button" className="wk-btn" onClick={() => setRun({ title: name(id), ids: [id] })} data-path-learn={id}>
                {state === 'done' ? t('cogitaLearnRun.step.review') : (graph.needs.get(id) ?? []).length > 0 ? t('cogitaLearnPath.path.learnBasics') : t('cogitaLearnRun.step.learn')}
              </button>
            )}
            {lib.origin(id) !== undefined && <a className="wk-link-btn" href={originPath(lib.origin(id)!, id, 'wpisy')}>{t('cogitaLearn.words.openEntry')}</a>}
          </div>
        )} />
      <details className="cg-path-levels" data-path-levels="">
        <summary>{t('cogitaLearnPath.path.asList', { n: order.length })}</summary>
      {order.map((at) => (
        <section key={at} className="cg-path-level" data-path-level={at}>
          <h3>{levelLabel(at)}</h3>
          <ul className="cg-path-list">
            {levels.get(at)!.sort((a, b) => name(a).localeCompare(name(b), t.locale, { numeric: true })).map((id) => {
              const { state, waits } = stateOf(id);
              const count = cardsAbout(cards, id).length;
              return (
                <li key={id} className={`cg-path-item is-${state}`} data-path-entry={id} data-path-state={state}>
                  <span className="cg-path-name">
                    <a className="cg-ref" href={lib.origin(id) === undefined ? '#' : originPath(lib.origin(id)!, id, 'wpisy')}><TexText text={shown(id)} /></a>
                    <span className="cg-path-state">{t(STATE_LABEL[state])}{state === 'waiting' ? <>: <TexText text={waits.slice(0, 3).map(shown).join(', ')} /></> : ''}</span>
                  </span>
                  <span className="cg-path-tools">
                    {count > 0 && <span className="cg-muted">{t('cogitaLearn.count.cards', { count })}</span>}
                    {(count > 0 || (graph.needs.get(id) ?? []).length > 0) && (
                      <button type="button" className="wk-link-btn" onClick={() => setRun({ title: name(id), ids: [id] })}>{(graph.needs.get(id) ?? []).length > 0 ? t('cogitaLearnPath.path.learnBasics') : t('cogitaLearnRun.step.learn')}</button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      </details>
      {outside > 0 && <p className="cg-muted">{t('cogitaLearnPath.path.outside', { count: outside })}</p>}
    </div>
  );
}

/** Die Reihenfolge an einem Eintrag (Wiedza): was vor ihm kommt, was auf ihm aufbaut, ein Kreis. */
export function EntityPrerequisites({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const { lib } = useCtx();
  const t = useT();
  const graph = lib.prerequisites();
  const needs = (graph.needs.get(id) ?? []).filter((x) => lib.entity(x) !== undefined);
  const builds = (graph.builds.get(id) ?? []).filter((x) => lib.entity(x) !== undefined);
  const circles = graph.circles.filter((d) => d.parent === id || d.child === id);
  if (needs.length === 0 && builds.length === 0 && circles.length === 0) return null;
  const level = graph.level.get(id);
  const refs = (ids: readonly string[]) => ids.map((x) => <button key={x} type="button" className="cg-ref" onClick={() => onOpen(x)}><TexText text={entityNameTex(lib, x)} /></button>);
  return (
    <section className="cg-card cg-prereq" data-entity-prerequisites={id}>
      <div className="cg-row-between">
        <strong>{t('cogitaLearnPath.path.order')}</strong>
        {level !== undefined && <span className="cg-tag">{levelLabel(level)}</span>}
      </div>
      {needs.length > 0 && <div className="cg-row"><span className="cg-muted">{t('cogitaLearnPath.path.needs')}</span>{refs(needs)}</div>}
      {builds.length > 0 && <div className="cg-row"><span className="cg-muted">{t('cogitaLearnPath.path.builds')}</span>{refs(builds)}</div>}
      {circles.length > 0 && (
        <p className="wk-warn">{t('cogitaLearnPath.path.circle')}<TexText text={circles.map((d) => t('cogitaLearnPath.path.requires', { child: entityNameTex(lib, d.child), parent: entityNameTex(lib, d.parent) })).join('; ')} />{t('cogitaLearnPath.path.circleEnd')}</p>
      )}
    </section>
  );
}
