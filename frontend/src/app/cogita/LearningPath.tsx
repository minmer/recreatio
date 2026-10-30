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
 */

import { useMemo, useState } from 'react';

import type { Card } from './cardBasics';
import { readGraph } from './graph';
import { gaugeFromMarks, itemKnowness, ownKnowness } from './knowing';
import { KNOWN } from './knowness';
import { renamer, type Learner } from './learn';
import { basicsRevision } from './presets';
import { cardsAbout, levelLabel, nearestNeeds } from './prerequisites';
import { planOf } from './revision';
import { RevisionRun } from './RevisionRun';
import { entityName, originPath, useAsync, useCtx } from './ui';
import { Loading } from '../ui/Loading';

type State = 'known' | 'learning' | 'fresh' | 'waiting' | 'order';

const STATE_LABEL: Record<State, string> = {
  known: 'umiem',
  learning: 'w nauce',
  fresh: 'do nauki',
  waiting: 'czeka na podstawy',
  order: 'tylko porządkuje'
};

export function LearningPath({ learner, cards, go }: { learner: Learner | null; cards: readonly Card[] | null; go: (...tail: string[]) => void }) {
  const { lib, writes } = useCtx();
  const graph = lib.prerequisites();
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  const [run, setRun] = useState<{ title: string; ids: readonly string[] | null } | null>(null);

  /* 2026-10-30 — die Powtórka „Najpierw podstawy" aus allgemeinen Schritten, über die genannten Einträge (oder alles). */
  const source = useAsync(run === null || cards === null ? null : async () => {
    const fp = new Map(cards.map((c) => [c.key, c.fingerprint]));
    /* Ein Eintrag mit den Pytania über ihn („O czym") — sie prüfen ihn mit. */
    const ids = run.ids === null ? null : [...new Set(run.ids.flatMap((id) => [id, ...cardsAbout(cards, id).map((c) => c.entity ?? c.question)]))];
    const doc = basicsRevision(ids, run.title);
    const made = await planOf(readGraph(doc.graph), lib.revisionContext(cards, (key) => learner?.marks(key, fp.get(key), rename) ?? [], Date.now()));
    return made.plan === null ? null : { plan: made.plan, cards, deps: lib.dependencies(), title: run.title };
  }, [run, cards, lib, learner]);

  if (cards === null) return <Loading label="Liczenie kart…" />;
  if (run !== null && source === undefined) return <Loading label="Przygotowywanie kart…" />;
  if (run !== null && source !== null && source !== undefined) return <RevisionRun lib={lib} learner={learner} source={source} onClose={() => setRun(null)} />;

  if (graph.edges.length === 0) {
    return (
      <section className="cg-card cg-path-empty" data-learning-path="empty">
        <h3>Kolejność nauki</h3>
        <p>Ta baza nie ma jeszcze kolejności: wszystko jest pytane od razu. Kolejność bierze się z odwołań „Najpierw trzeba znać” — orbital wymaga elektronu i atomu, więc pytania o orbital przychodzą, gdy umiesz atom.</p>
        <ul>
          <li>W rodzaju (Schematy → Rodzaje wpisów) pole-odwołanie z ustawieniem „Kolejność nauki: najpierw trzeba znać to, na co wskazuje” (np. „Wymaga”). Gotowy rodzaj „Pojęcie” z takim polem: <code>templates/cogita/podstawy.json</code>.</li>
          <li>Pytanie ma pole „Najpierw trzeba znać” samo, a przez „O czym” czeka na to, co trzeba znać przed tym, o co pyta.</li>
        </ul>
        {writes && <button type="button" className="wk-btn wk-btn-line" onClick={() => go('schematy', 'rodzaje')}>Przejdź do Schematów</button>}
      </section>
    );
  }

  const now = Date.now();
  const fp = new Map(cards.map((c) => [c.key, c.fingerprint]));
  const g = gaugeFromMarks(cards, (key) => learner?.marks(key, fp.get(key), rename) ?? [], lib.dependencies(), now);
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

  return (
    <div className="cg cg-path" data-learning-path={order.length}>
      <div className="cg-row-between">
        <p className="cg-muted">Od podstaw do szczegółów: karta przychodzi, gdy umiesz to, co trzeba znać przed nią. {order.length} {order.length === 1 ? 'poziom' : 'poziomów'}, {placed.size} {placed.size === 1 ? 'wpis' : 'wpisów'} w kolejności.</p>
        <button type="button" className="wk-btn" onClick={() => setRun({ title: 'Od podstaw', ids: null })}>Ucz się od podstaw</button>
      </div>
      {graph.circles.length > 0 && (
        <p className="wk-warn" data-path-circles={graph.circles.length}>
          Koło w kolejności — te zależności nie działają: {graph.circles.slice(0, 4).map((d) => `${name(d.child)} wymaga ${name(d.parent)}`).join('; ')}. Popraw je we wpisach.
        </p>
      )}
      {order.map((at) => (
        <section key={at} className="cg-path-level" data-path-level={at}>
          <h3>{levelLabel(at)}</h3>
          <ul className="cg-path-list">
            {levels.get(at)!.sort((a, b) => name(a).localeCompare(name(b), 'pl', { numeric: true })).map((id) => {
              const { state, waits } = stateOf(id);
              const count = cardsAbout(cards, id).length;
              return (
                <li key={id} className={`cg-path-item is-${state}`} data-path-entry={id} data-path-state={state}>
                  <span className="cg-path-name">
                    <a className="cg-ref" href={lib.origin(id) === undefined ? '#' : originPath(lib.origin(id)!, id, 'wpisy')}>{name(id)}</a>
                    <span className="cg-path-state">{STATE_LABEL[state]}{state === 'waiting' ? `: ${waits.slice(0, 3).map(name).join(', ')}` : ''}</span>
                  </span>
                  <span className="cg-path-tools">
                    {count > 0 && <span className="cg-muted">{count} {count === 1 ? 'karta' : 'kart'}</span>}
                    {(count > 0 || (graph.needs.get(id) ?? []).length > 0) && (
                      <button type="button" className="wk-link-btn" onClick={() => setRun({ title: name(id), ids: [id] })}>Ucz się{(graph.needs.get(id) ?? []).length > 0 ? ' (z podstawami)' : ''}</button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {outside > 0 && <p className="cg-muted">{outside} {outside === 1 ? 'wpis z kartami nie ma' : 'wpisów z kartami nie ma'} miejsca w kolejności — przychodzą razem z poziomem 1.</p>}
    </div>
  );
}

/** Die Reihenfolge an einem Eintrag (Wiedza): was vor ihm kommt, was auf ihm aufbaut, ein Kreis. */
export function EntityPrerequisites({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const { lib } = useCtx();
  const graph = lib.prerequisites();
  const needs = (graph.needs.get(id) ?? []).filter((x) => lib.entity(x) !== undefined);
  const builds = (graph.builds.get(id) ?? []).filter((x) => lib.entity(x) !== undefined);
  const circles = graph.circles.filter((d) => d.parent === id || d.child === id);
  if (needs.length === 0 && builds.length === 0 && circles.length === 0) return null;
  const level = graph.level.get(id);
  const refs = (ids: readonly string[]) => ids.map((x) => <button key={x} type="button" className="cg-ref" onClick={() => onOpen(x)}>{entityName(lib, x)}</button>);
  return (
    <section className="cg-card cg-prereq" data-entity-prerequisites={id}>
      <div className="cg-row-between">
        <strong>Kolejność nauki</strong>
        {level !== undefined && <span className="cg-tag">{levelLabel(level)}</span>}
      </div>
      {needs.length > 0 && <div className="cg-row"><span className="cg-muted">Najpierw trzeba znać:</span>{refs(needs)}</div>}
      {builds.length > 0 && <div className="cg-row"><span className="cg-muted">Na tym budują:</span>{refs(builds)}</div>}
      {circles.length > 0 && (
        <p className="wk-warn">Koło: {circles.map((d) => `${entityName(lib, d.child)} wymaga ${entityName(lib, d.parent)}`).join('; ')} — ta zależność nie działa, dopóki koło trwa.</p>
      )}
    </section>
  );
}
