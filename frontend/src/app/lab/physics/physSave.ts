/**
 * 2026-10-18 — DIE WELT ALS DOKUMENT (Fizyka 2D): was gerade in der
 * Piaskownica steht, als Szene — zum Speichern im Browser, und als JSON,
 * das eine Lehrerin in den Baustein einfügt. So wird aus dem Ausprobieren ein
 * Versuch auf der Seite: gebaut wird mit der Hand, gespeichert als Daten.
 */

import { MATERIALS } from './physBody';
import type { PinJoint, PulleyJoint, RodJoint, SpringJoint } from './physJoints';
import type { PhysScene } from './physScene';
import type { World } from './physWorld';

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const deg = (a: number) => Math.round(((a * 180) / Math.PI) * 10) / 10;

/** Die Szene, wie sie jetzt steht — mit dem, was das ursprüngliche Dokument über Sicht, Ziel und Schritte sagte. */
export function sceneOfWorld(world: World, base: PhysScene): Record<string, unknown> {
  const walls = new Set(world.basins.flatMap((b) => b.walls));
  const bodies = world.bodies.filter((b) => !walls.has(b) && !b.id.startsWith('~')).map((b) => {
    const spec: Record<string, unknown> = { id: b.id };
    if (b.named) spec.label = b.label;
    if (b.shape.kind === 'circle') { spec.shape = 'circle'; spec.r = r3(b.shape.r); } else {
      spec.shape = 'poly';
      spec.points = [...b.shape.xs].map((x, i) => [r3(x), r3(b.shape.kind === 'poly' ? b.shape.ys[i] : 0)]);
    }
    spec.x = r3(b.x);
    spec.y = r3(b.y);
    if (Math.abs(b.a) > 1e-4) spec.angle = deg(b.a);
    spec.material = b.material.key;
    const base0 = MATERIALS[b.material.key];
    if (base0 !== undefined && base0.density !== b.material.density) spec.density = b.material.density;
    if (b.fixed) spec.static = true;
    if (!b.draggable) spec.drag = false;
    if (b.color !== null) spec.color = b.color;
    if (b.trace) spec.trace = true;
    return spec;
  });
  const ref = (b: { id: string }) => (b === world.ground ? null : b.id);
  const joints = world.joints.map((j) => {
    if (j.kind === 'pin') {
      const p = j as PinJoint;
      return { type: p.torque > 0 && p.speed !== 0 ? 'motor' : 'pin', a: p.a.id, ...(ref(p.b) === null ? {} : { b: p.b.id }), at: [r3(p.pax), r3(p.pay)], ...(p.torque > 0 ? { speed: p.speed, torque: p.torque } : {}) };
    }
    if (j.kind === 'rod' || j.kind === 'rope') {
      const r = j as RodJoint;
      return { type: r.kind, a: r.a.id, ...(ref(r.b) === null ? {} : { b: r.b.id }), on: [r3(r.la[0]), r3(r.la[1])], at: ref(r.b) === null ? [r3(r.pbx), r3(r.pby)] : [r3(r.lb[0]), r3(r.lb[1])], length: r3(r.length) };
    }
    if (j.kind === 'spring') {
      const s = j as SpringJoint;
      return { type: 'spring', a: s.a.id, ...(ref(s.b) === null ? {} : { b: s.b.id }), on: [r3(s.la[0]), r3(s.la[1])], at: ref(s.b) === null ? [r3(s.pbx), r3(s.pby)] : [r3(s.lb[0]), r3(s.lb[1])], length: r3(s.length), k: s.k, damping: s.damping };
    }
    const p = j as PulleyJoint;
    return { type: 'pulley', a: p.a.id, b: p.b.id, on: [r3(p.la[0]), r3(p.la[1])], onB: [r3(p.lb[0]), r3(p.lb[1])], at: [r3(p.gax), r3(p.gay)], at2: [r3(p.gbx), r3(p.gby)], length: r3(p.total) };
  }).filter((j) => j !== null);
  const fluids = world.basins.map((b) => ({
    id: b.id, x: r3(b.x0), y: r3(b.y0), w: r3(b.width), h: r3(b.y1 - b.y0), wall: r3(b.wall),
    layers: b.layers.map((l) => ({ liquid: l.liquid.key, height: r3(l.amount / b.width) })),
    ...(b.holes.length > 0 ? { holes: b.holes.map((h) => ({ side: h.side, at: r3(h.at), size: r3(h.size), open: h.open })) } : {})
  }));
  const pipes = world.pipes.map((p) => ({ a: p.a.id, b: p.b.id, y: r3(p.y), size: r3(p.size), open: p.open }));
  const raw = base.raw;
  return {
    world: { gravity: world.g, air: world.air, depth: world.depth, ...(base.ground ? {} : { ground: false }) },
    ...(raw.vars === undefined ? {} : { vars: raw.vars }),
    bodies,
    ...(joints.length > 0 ? { joints } : {}),
    ...(fluids.length > 0 ? { fluids } : {}),
    ...(pipes.length > 0 ? { pipes } : {}),
    ...Object.fromEntries(['show', 'graph', 'allow', 'goal', 'steps', 'controls', 'view'].filter((k) => raw[k] !== undefined).map((k) => [k, raw[k]]))
  };
}
