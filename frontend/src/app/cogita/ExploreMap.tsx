/**
 * COGITA — DIE KARTE ZUM ENTDECKEN (COGITA.md §12, [K5]): Themen und Einträge
 * als Landschaft — was sitzt, ist hell; was nachlässt, verblasst; die Grenze
 * zum Unbekannten lässt sich betreten; der Rest liegt im Nebel. Schwellen
 * sieht man immer. Ein Klick auf die Grenze: lernen, was dort liegt.
 */

import { useMemo, useState } from 'react';

import { EntityGlance } from './CardFace';
import type { Card } from './cardBasics';
import { fogOf, ringsOf } from './game';
import { average, knownessOf, shareOf } from './knowness';
import type { Learner } from './learn';
import { readPlan } from './revision';
import { RevisionRun } from './RevisionRun';
import { fieldsOf, valuesOf } from './schema';
import { useCtx } from './ui';

export function ExploreMap({ learner, cards }: { learner: Learner | null; cards: readonly Card[] }) {
  const { lib } = useCtx();
  const look = lib.look;
  const [chosen, setChosen] = useState<string | null>(null);
  const [learning, setLearning] = useState<string | null>(null);

  const { nodes, edges, place } = useMemo(() => {
    const topics = lib.ofKind('topic');
    const ids = new Set<string>(topics.map((t) => t.id));
    const links: { from: string; to: string }[] = [];
    for (const t of topics) {
      for (const f of fieldsOf(t, look)) {
        if (f.type !== 'ref' || !['parent', 'answers', 'entity'].includes(f.key)) continue;
        for (const v of valuesOf(t, f)) {
          if (typeof v.value !== 'string' || lib.entity(v.value) === undefined) continue;
          ids.add(v.value);
          links.push(f.key === 'parent' ? { from: v.value, to: t.id } : { from: t.id, to: v.value });
        }
      }
    }
    if (ids.size === 0) for (const e of lib.entities().slice(0, 120)) ids.add(e.id);
    const list = [...ids].slice(0, 300).map((id) => {
      const e = lib.entity(id)!;
      const landmark = fieldsOf(e, look).find((f) => f.key === 'landmark');
      return { id, landmark: landmark !== undefined && valuesOf(e, landmark)[0]?.value === true };
    });
    /* Ringe nach der Tiefe von den Wurzeln her — ohne gespeicherte Plätze. */
    return { nodes: list, edges: links, place: ringsOf(list.map((n) => n.id), links) };
  }, [lib, look, lib.revision]);

  const knowness = (id: string) => {
    const of = cards.filter((c) => c.entity === id);
    if (of.length === 0 || learner === null) return 0;
    return average(of.map((c) => knownessOf(learner.marks(c.key, c.fingerprint), Date.now())));
  };
  const seen = (id: string) => learner !== null && cards.some((c) => c.entity === id && learner.marks(c.key, c.fingerprint).length > 0);
  const fog = fogOf(nodes, edges, knowness, seen);

  /* Der Plan bleibt derselbe, solange derselbe Eintrag gelernt wird — sonst finge der Lauf bei jedem Bild neu an. */
  const source = useMemo(() => {
    if (learning === null) return null;
    const of = cards.filter((c) => c.entity === learning);
    const e = lib.entity(learning);
    return { plan: readPlan(of, null, { mode: 'once', order: 'random' }), cards: of, title: e === undefined ? 'Powtórka' : lib.label(e) };
  }, [learning, cards, lib]);

  if (source !== null) {
    return <RevisionRun lib={lib} learner={learner} source={source} onClose={() => setLearning(null)} />;
  }

  const entity = chosen === null ? undefined : lib.entity(chosen);
  return (
    <div className="cg">
      <p className="wk-hint">Jasne — umiesz; bladnie — zaciera się; przerywana obwódka — granica, którą możesz przekroczyć; mgła — jeszcze nieodkryte.</p>
      <div className="cg-explore">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {edges.map((e, i) => {
            const a = place.get(e.from);
            const b = place.get(e.to);
            return a === undefined || b === undefined ? null : <line key={i} x1={a.x * 100} y1={a.y * 100} x2={b.x * 100} y2={b.y * 100} />;
          })}
        </svg>
        {nodes.map((n) => {
          const at = place.get(n.id) ?? { x: 0.5, y: 0.5 };
          const state = fog.get(n.id) ?? 'fog';
          const e = lib.entity(n.id)!;
          return (
            <button key={n.id} type="button" className={`cg-explore-node is-${state}`} style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
              disabled={state === 'fog'} title={state === 'fog' ? 'Jeszcze w mgle' : `${lib.label(e)} · ${Math.round(shareOf(knowness(n.id)) * 100)}%`}
              onClick={() => setChosen(n.id)}>
              {lib.label(e)}
            </button>
          );
        })}
      </div>
      {entity !== undefined && (
        <div className="cg-card">
          <EntityGlance lib={lib} entity={entity} onEntity={setChosen} />
          {cards.some((c) => c.entity === entity.id) && <button type="button" className="wk-btn" onClick={() => setLearning(entity.id)}>Ucz się tego ({cards.filter((c) => c.entity === entity.id).length} kart)</button>}
        </div>
      )}
    </div>
  );
}
