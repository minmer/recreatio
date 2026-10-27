/**
 * COGITA — DIE KARTE ZUM ENTDECKEN (COGITA.md §12, [K5]): Einträge als
 * Landschaft — was sitzt, ist hell; was nachlässt, verblasst; die Grenze zum
 * Unbekannten lässt sich betreten; der Rest liegt im Nebel. Schwellen sieht
 * man immer. Ein Klick auf die Grenze: lernen, was dort liegt.
 *
 * 2026-10-23 (Schritt 5) — ohne Themen: die Einträge der gewählten Rodzaje
 * (oder aller eigenen) mit dem, worauf ihre Verweisfelder zeigen, und die
 * bestätigten Abhängigkeiten. Das Ziel eines Verweises liegt näher an der
 * Wurzel (die Część vor ihren Tajemnice).
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
import { cardsAbout } from './prerequisites';

export function ExploreMap({ learner, cards }: { learner: Learner | null; cards: readonly Card[] }) {
  const { lib } = useCtx();
  const look = lib.look;
  const [chosen, setChosen] = useState<string | null>(null);
  const [learning, setLearning] = useState<string | null>(null);
  const [kindId, setKindId] = useState('');
  const kinds = lib.kinds.filter((k) => k.id !== 'question' && lib.ofKind(k.id).length > 0);

  const { nodes, edges, place } = useMemo(() => {
    const chosenKinds = kindId === '' ? kinds : kinds.filter((k) => k.id === kindId);
    const base = chosenKinds.flatMap((k) => lib.ofKind(k.id)).slice(0, 300);
    const ids = new Set<string>(base.map((e) => e.id));
    const links: { from: string; to: string }[] = [];
    for (const e of base) {
      for (const f of fieldsOf(e, look)) {
        if (f.type !== 'ref') continue;
        for (const v of valuesOf(e, f)) {
          if (typeof v.value !== 'string' || v.value === e.id || lib.entity(v.value) === undefined) continue;
          ids.add(v.value);
          links.push({ from: v.value, to: e.id });
        }
      }
    }
    for (const d of lib.dependencies()) if (ids.has(d.parent) && ids.has(d.child)) links.push({ from: d.parent, to: d.child });
    if (ids.size === 0) for (const e of lib.entities().slice(0, 120)) ids.add(e.id);
    const list = [...ids].slice(0, 300).map((id) => {
      const e = lib.entity(id)!;
      const landmark = fieldsOf(e, look).find((f) => f.key === 'landmark');
      return { id, landmark: landmark !== undefined && valuesOf(e, landmark)[0]?.value === true };
    });
    /* Ringe nach der Tiefe von den Wurzeln her — ohne gespeicherte Plätze. */
    return { nodes: list, edges: links, place: ringsOf(list.map((n) => n.id), links) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, look, lib.revision, kindId]);

  const knowness = (id: string) => {
    /* 2026-10-27 — auch die Pytania über ihn („O czym”). */
    const of = cardsAbout(cards, id);
    if (of.length === 0 || learner === null) return 0;
    return average(of.map((c) => knownessOf(learner.marks(c.key, c.fingerprint), Date.now())));
  };
  const seen = (id: string) => learner !== null && cardsAbout(cards, id).some((c) => learner.marks(c.key, c.fingerprint).length > 0);
  const fog = fogOf(nodes, edges, knowness, seen);

  /* Der Plan bleibt derselbe, solange derselbe Eintrag gelernt wird — sonst finge der Lauf bei jedem Bild neu an. */
  const source = useMemo(() => {
    if (learning === null) return null;
    const of = cardsAbout(cards, learning);
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
      {kinds.length > 1 && (
        <label className="wk-field"><span>Na mapie</span>
          <select value={kindId} onChange={(e) => { setKindId(e.target.value); setChosen(null); }}>
            <option value="">wszystkie rodzaje</option>
            {kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </label>
      )}
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
          {cardsAbout(cards, entity.id).length > 0 && <button type="button" className="wk-btn" onClick={() => setLearning(entity.id)}>Ucz się tego ({cardsAbout(cards, entity.id).length} kart)</button>}
        </div>
      )}
    </div>
  );
}
