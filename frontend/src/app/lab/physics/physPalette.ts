/**
 * 2026-10-18 — WAS MAN IN DER PIASKOWNICA DAZUSTELLT (Fizyka 2D): fertige
 * Teile und kleine Aufbauten — eine Kugel, ein Klotz, ein Brett, ein Keil,
 * eine Rampe, eine Wand; ein Pendel, eine Feder mit Gewicht, eine Rolle mit
 * zwei Gewichten (Atwood), eine Wippe, ein Becken mit Wasser. Jedes ist
 * dieselbe Art Dokument wie eine gespeicherte Szene (`physScene.ts`), nur
 * dort gebaut, wo man es hinstellt.
 */

import { NO_DRAW } from '../labRandom';
import type { Body } from './physBody';
import { basinOf, bodyOf, jointOf } from './physScene';
import type { PaletteKey } from './physScene';
import type { World } from './physWorld';

export interface PaletteItem {
  readonly key: PaletteKey;
  readonly label: string;
}

export const PALETTE_ITEMS: readonly PaletteItem[] = [
  { key: 'ball', label: 'Piłka' },
  { key: 'box', label: 'Klocek' },
  { key: 'plank', label: 'Deska' },
  { key: 'wedge', label: 'Klin' },
  { key: 'ramp', label: 'Równia' },
  { key: 'wall', label: 'Ściana' },
  { key: 'pendulum', label: 'Wahadło' },
  { key: 'spring', label: 'Sprężyna' },
  { key: 'pulley', label: 'Bloczek' },
  { key: 'seesaw', label: 'Huśtawka' },
  { key: 'basin', label: 'Zbiornik' }
];

let serial = 0;
const fresh = (world: World, base: string): string => {
  let id: string;
  do { serial += 1; id = `${base}${serial}`; } while (world.bodies.some((b) => b.id === id) || world.basins.some((b) => b.id === id));
  return id;
};

/** Ein Teil der Piaskownica an der Stelle (x, y) — gibt die neuen Körper zurück (der erste ist der, den man dann wählt). */
export function place(world: World, key: PaletteKey, x: number, y: number): Body[] {
  const d = NO_DRAW;
  const depth = world.depth;
  const add = (spec: Record<string, unknown>, base: string): Body | null => {
    const b = bodyOf({ ...spec, id: fresh(world, base) }, d, depth, fresh(world, base));
    if (b === null) return null;
    world.add(b);
    return b;
  };
  const join = (spec: Record<string, unknown>) => {
    const j = jointOf(spec, d, world, `j${serial}`);
    if (j !== null) world.join(j);
  };
  switch (key) {
    case 'ball': { const b = add({ shape: 'circle', r: 0.15, x, y, material: 'ball' }, 'pilka'); return b === null ? [] : [b]; }
    case 'box': { const b = add({ shape: 'box', w: 0.4, h: 0.4, x, y, material: 'wood' }, 'klocek'); return b === null ? [] : [b]; }
    case 'plank': { const b = add({ shape: 'box', w: 1.6, h: 0.1, x, y, material: 'wood' }, 'deska'); return b === null ? [] : [b]; }
    case 'wedge': { const b = add({ shape: 'poly', points: [[-0.4, -0.25], [0.4, -0.25], [-0.4, 0.25]], x, y, material: 'wood' }, 'klin'); return b === null ? [] : [b]; }
    case 'ramp': { const b = add({ shape: 'poly', points: [[-1.5, 0], [1.5, 0], [-1.5, 1.2]], x, y: Math.max(0, y - 0.6), static: true, material: 'stone' }, 'rownia'); return b === null ? [] : [b]; }
    case 'wall': { const b = add({ shape: 'box', w: 0.2, h: 1.5, x, y: Math.max(0.75, y), static: true, material: 'stone' }, 'sciana'); return b === null ? [] : [b]; }
    case 'pendulum': {
      const b = add({ shape: 'circle', r: 0.12, x: x + 0.9, y: y - 1.2, material: 'steel' }, 'wahadlo');
      if (b === null) return [];
      join({ type: 'rod', a: b.id, at: [x, y + 0.3] });
      return [b];
    }
    case 'spring': {
      const b = add({ shape: 'box', w: 0.3, h: 0.3, x, y: y - 0.6, material: 'steel' }, 'ciezarek');
      if (b === null) return [];
      join({ type: 'spring', a: b.id, on: [0, 0.15], at: [x, y + 0.8], length: 1, k: 400, damping: 2 });
      return [b];
    }
    case 'pulley': {
      const m1 = add({ shape: 'box', w: 0.3, h: 0.3, x: x - 0.4, y: y - 0.5, material: 'steel' }, 'm');
      const m2 = add({ shape: 'box', w: 0.3, h: 0.3, x: x + 0.4, y: y - 0.5, material: 'aluminium' }, 'm');
      if (m1 === null || m2 === null) return [];
      join({ type: 'pulley', a: m1.id, b: m2.id, on: [0, 0.15], onB: [0, 0.15], at: [x - 0.4, y + 0.9], at2: [x + 0.4, y + 0.9] });
      return [m1, m2];
    }
    case 'seesaw': {
      const base = add({ shape: 'poly', points: [[-0.35, 0], [0.35, 0], [0, 0.5]], x, y: 0, static: true, material: 'stone' }, 'podpora');
      const plank = add({ shape: 'box', w: 3, h: 0.1, x, y: 0.56, material: 'wood' }, 'hustawka');
      if (base === null || plank === null) return [];
      join({ type: 'pin', a: plank.id, at: [x, 0.52] });
      return [plank];
    }
    case 'basin': {
      const basin = basinOf({ x: x - 1, y: Math.max(0, y - 1), w: 2, h: 1.4, layers: [{ liquid: 'water', height: 0.8 }] }, d, depth, fresh(world, 'zbiornik'));
      world.basins.push(basin);
      for (const w of basin.walls) world.add(w);
      return [];
    }
  }
}
