/**
 * 2026-10-18 — VERSUCHE FÜR DIE SCHULE (Fizyka 2D): fertige Szenen — dieselben
 * Dokumente, die ein Baustein speichert. Der Editor bietet sie an („Wstaw
 * przykład”), die Piaskownica lädt sie („Doświadczenia”), und
 * `scripts/lab-examples.mjs` schreibt aus ihnen die Beispielseite.
 *
 * Jede Szene: eine Welt, Körper und Verbindungen, Becken, was zu sehen ist,
 * was man darf, manchmal ein Ziel, die Schritte des Versuchs — und, wo es
 * passt, gezogene Werte (jedes Mal ein anderer Winkel, eine andere Länge).
 */

import { t } from '../../core/i18n';

export interface PhysPreset {
  readonly key: string;
  readonly title: string;
  /** Wozu, in einer Zeile. */
  readonly summary: string;
  /** Was die Schüler tun sollen (Absätze). */
  readonly text: readonly string[];
  readonly scene: Readonly<Record<string, unknown>>;
}

/* Ein Klotz auf einer schiefen Ebene (Winkel `kat`, oberes Ende der Fläche bei x0, Höhe hTop): `d` Meter die Fläche hinab, Dicke h. */
const onSlope = (x0: number, len: number, d: number, h: number) => ({
  x: `=${x0} + ${d}*cos(rad(kat)) + ${h / 2 + 0.004}*sin(rad(kat))`,
  y: `=${len}*tan(rad(kat)) - ${d}*sin(rad(kat)) + ${h / 2 + 0.004}*cos(rad(kat))`,
  angle: '=-kat'
});

/** Ein Versuch mit seinen Texten (labPhysics.json, `labPhysics.preset.<id>`): Titel, Zeile, Absätze — und die Szene, deren Beschriftungen und Schritte erst beim Lesen übersetzt werden. */
function preset(id: string, key: string, scene: () => Readonly<Record<string, unknown>>): PhysPreset {
  return {
    key,
    get title() { return t(`labPhysics.preset.${id}.title`); },
    get summary() { return t(`labPhysics.preset.${id}.summary`); },
    get text() { return t(`labPhysics.preset.${id}.text`).split('\n'); },
    get scene() { return scene(); }
  };
}

export const PHYS_PRESETS: readonly PhysPreset[] = [
  preset('fall', 'spadek', () => ({
    world: { gravity: 9.81, air: 1 },
    bodies: [
      { id: 'kulka', label: t('labPhysics.preset.fall.label.kulka'), shape: 'circle', r: 0.08, x: 1, y: 4, material: 'steel', trace: true },
      { id: 'kartka', label: t('labPhysics.preset.fall.label.kartka'), shape: 'box', w: 0.5, h: 0.02, x: 2.4, y: 4, material: 'paper', trace: true },
      { id: 'pilka', label: t('labPhysics.preset.fall.label.pilka'), shape: 'circle', r: 0.25, x: 3.8, y: 4, material: 'foam', trace: true }
    ],
    show: { vectors: ['v'], values: true },
    graph: { body: 'kulka', of: ['h', 'v'] },
    controls: ['air', 'gravity'],
    allow: { add: false, tools: ['ruler'] },
    view: [0, -0.2, 4.8, 4.6],
    steps: [
      { say: t('labPhysics.preset.fall.step1'), do: 'play', wait: 2.5 },
      { say: t('labPhysics.preset.fall.step2'), wait: 2 }
    ]
  })),
  preset('slope', 'rownia', () => ({
    world: { gravity: 9.81, air: 0 },
    vars: [{ name: 'kat', from: 15, to: 40, step: 5 }],
    bodies: [
      { id: 'rownia', label: t('labPhysics.preset.slope.label.rownia'), shape: 'poly', points: [[0, 0], [4, 0], [0, '=4*tan(rad(kat))']], x: 0.5, y: 0, static: true, material: 'wood', drag: false },
      { id: 'drewno', label: t('labPhysics.preset.slope.label.drewno'), shape: 'box', w: 0.4, h: 0.25, material: 'wood', ...onSlope(0.5, 4, 0.6, 0.25) },
      { id: 'lod', label: t('labPhysics.preset.slope.label.lod'), shape: 'box', w: 0.3, h: 0.25, material: 'ice', ...onSlope(0.5, 4, 1.4, 0.25) }
    ],
    show: { vectors: ['v'], values: true },
    allow: { add: false, tools: ['ruler'] },
    view: [0, -0.3, 6, 3.8],
    steps: [{ say: t('labPhysics.preset.slope.step1'), do: 'play', wait: 3 }]
  })),
  preset('pendulum', 'wahadlo', () => ({
    world: { gravity: 9.81, air: 0 },
    vars: [{ name: 'L', from: 1, to: 2.5, step: 0.5 }],
    bodies: [{ id: 'kulka', label: t('labPhysics.preset.pendulum.label.kulka'), shape: 'circle', r: 0.1, x: '=3 + L*sin(rad(35))', y: '=4 - L*cos(rad(35))', material: 'steel' }],
    joints: [{ type: 'rod', a: 'kulka', at: [3, 4] }],
    show: { vectors: ['v'], trace: ['kulka'], values: true },
    graph: { body: 'kulka', of: ['ek', 'ep', 'e'] },
    allow: { add: false, tools: ['ruler'] },
    view: [0.5, 0.8, 5.5, 4.5],
    steps: [{ say: t('labPhysics.preset.pendulum.step1'), do: 'play', wait: 4 }]
  })),
  preset('spring', 'sprezyna', () => ({
    world: { gravity: 9.81, air: 0 },
    vars: [{ name: 'k', from: 150, to: 450, step: 50 }],
    bodies: [{ id: 'ciezarek', label: t('labPhysics.preset.spring.label.ciezarek'), shape: 'box', w: 0.2, h: 0.2, x: 3, y: 2.6, material: 'aluminium' }],
    joints: [{ type: 'spring', a: 'ciezarek', on: [0, 0.1], at: [3, 4.2], length: 1.2, k: '=k', damping: 0.4 }],
    show: { values: true },
    graph: { body: 'ciezarek', of: ['h', 'vy'] },
    allow: { add: false, tools: ['ruler'] },
    view: [1.4, 1.2, 4.6, 4.6],
    steps: [{ say: t('labPhysics.preset.spring.step1'), do: 'play', wait: 3 }]
  })),
  preset('collisions', 'zderzenia', () => ({
    world: { gravity: 0, air: 0, ground: false },
    bodies: [
      { id: 'duzy', label: t('labPhysics.preset.collisions.label.duzy'), shape: 'circle', r: 0.3, x: 1.2, y: 1.6, vx: 1.6, material: 'steel', bounce: 0.95, friction: 0 },
      { id: 'maly', label: t('labPhysics.preset.collisions.label.maly'), shape: 'circle', r: 0.2, x: 4, y: 1.5, material: 'aluminium', bounce: 0.95, friction: 0 },
      { id: 'trzeci', label: t('labPhysics.preset.collisions.label.trzeci'), shape: 'circle', r: 0.25, x: 5.2, y: 2.4, material: 'rubber', bounce: 0.95, friction: 0 },
      { id: 'b1', shape: 'box', w: 7, h: 0.15, x: 3.2, y: -0.05, static: true, material: 'stone', bounce: 1, friction: 0, drag: false },
      { id: 'b2', shape: 'box', w: 7, h: 0.15, x: 3.2, y: 3.35, static: true, material: 'stone', bounce: 1, friction: 0, drag: false },
      { id: 'b3', shape: 'box', w: 0.15, h: 3.55, x: -0.25, y: 1.65, static: true, material: 'stone', bounce: 1, friction: 0, drag: false },
      { id: 'b4', shape: 'box', w: 0.15, h: 3.55, x: 6.65, y: 1.65, static: true, material: 'stone', bounce: 1, friction: 0, drag: false }
    ],
    show: { vectors: ['v'], values: true },
    allow: { add: false, tools: [] },
    view: [-0.5, -0.3, 6.9, 3.6],
    steps: [{ say: t('labPhysics.preset.collisions.step1'), do: 'play', wait: 4 }]
  })),
  preset('cradle', 'kolyska', () => ({
    world: { gravity: 9.81, air: 0, ground: false },
    bodies: [0, 1, 2, 3, 4].map((i) => ({
      id: `k${i + 1}`, label: t('labPhysics.preset.cradle.label.ball', { n: i + 1 }), shape: 'circle', r: 0.15,
      x: i === 0 ? 2 + i * 0.302 - 1.4 * Math.sin(0.6) : 2 + i * 0.302,
      y: i === 0 ? 3 - 1.4 * Math.cos(0.6) : 1.6,
      material: 'steel', bounce: 0.98, friction: 0
    })),
    joints: [0, 1, 2, 3, 4].map((i) => ({ type: 'rod', a: `k${i + 1}`, at: [2 + i * 0.302, 3] })),
    show: { values: false },
    allow: { add: false, tools: [] },
    view: [0.6, 1.2, 4.6, 3.3],
    steps: [{ say: t('labPhysics.preset.cradle.step1'), do: 'play', wait: 4 }]
  })),
  preset('throw', 'rzut', () => ({
    world: { gravity: 9.81, air: 0.2 },
    vars: [{ name: 'd', from: 4.5, to: 7.5, step: 0.5 }],
    bodies: [
      { id: 'pilka', label: t('labPhysics.preset.throw.label.pilka'), shape: 'circle', r: 0.12, x: 0.8, y: 1.2, material: 'ball', trace: true },
      { id: 'stol', shape: 'box', w: 1, h: 1, x: 0.8, y: 0.5, static: true, material: 'wood', drag: false },
      { id: 'kosz-l', shape: 'box', w: 0.05, h: 0.5, x: '=d - 0.35', y: 1.75, static: true, material: 'steel', drag: false },
      { id: 'kosz-p', shape: 'box', w: 0.05, h: 0.5, x: '=d + 0.35', y: 1.75, static: true, material: 'steel', drag: false },
      { id: 'kosz-d', shape: 'box', w: 0.75, h: 0.05, x: '=d', y: 1.52, static: true, material: 'steel', drag: false },
      { id: 'slup', shape: 'box', w: 0.08, h: 1.5, x: '=d', y: 0.75, static: true, material: 'steel', drag: false }
    ],
    goal: { body: 'pilka', area: ['=d - 0.3', 1.55, '=d + 0.3', 2], for: 0.3, say: t('labPhysics.preset.throw.goal') },
    show: { values: false },
    allow: { add: false, tools: ['ruler'] },
    view: [0, -0.2, 8.5, 4.5]
  })),
  preset('atwood', 'atwood', () => ({
    world: { gravity: 9.81, air: 0 },
    vars: [{ name: 'm2', from: 4, to: 9, step: 1 }],
    bodies: [
      { id: 'm1', label: t('labPhysics.preset.atwood.label.m1'), shape: 'box', w: 0.25, h: 0.25, x: 2.6, y: 1.6, material: 'steel', density: 1600 },
      { id: 'm2', label: t('labPhysics.preset.atwood.label.m2'), shape: 'box', w: 0.25, h: 0.25, x: 3.4, y: 1.6, material: 'aluminium', density: '=m2/0.00625' }
    ],
    joints: [{ type: 'pulley', a: 'm1', b: 'm2', on: [0, 0.125], onB: [0, 0.125], at: [2.6, 3.6], at2: [3.4, 3.6] }],
    show: { vectors: ['v'], values: true },
    graph: { body: 'm1', of: ['h', 'v'] },
    allow: { add: false, tools: ['ruler'] },
    view: [1.4, -0.2, 4.6, 4],
    steps: [{ say: t('labPhysics.preset.atwood.step1'), do: 'play', wait: 3 }]
  })),
  preset('lever', 'dzwignia', () => ({
    world: { gravity: 9.81, air: 0 },
    bodies: [
      { id: 'podpora', shape: 'poly', points: [[-0.35, 0], [0.35, 0], [0, 0.6]], x: 3, y: 0, static: true, material: 'stone', drag: false },
      { id: 'deska', label: t('labPhysics.preset.lever.label.deska'), shape: 'box', w: 4, h: 0.08, x: 3, y: 0.65, material: 'wood', density: 300 },
      { id: 'a', label: '2 kg' /* i18n-ignore */, shape: 'box', w: 0.25, h: 0.25, x: 1.6, y: 0.82, material: 'steel', density: 320 },
      { id: 'b', label: '4 kg' /* i18n-ignore */, shape: 'box', w: 0.25, h: 0.25, x: 4.2, y: 0.82, material: 'steel', density: 640 }
    ],
    joints: [{ type: 'pin', a: 'deska', at: [3, 0.62] }],
    show: { values: true },
    allow: { add: false, tools: ['ruler'] },
    view: [0.6, -0.3, 5.4, 2.4]
  })),
  preset('floating', 'plywanie', () => ({
    world: { gravity: 9.81, air: 0.3 },
    fluids: [{ id: 'woda', x: 0.5, y: 0, w: 6, h: 1.6, layers: [{ liquid: 'water', height: 1 }] }],
    bodies: [
      { id: 'korek', label: t('labPhysics.preset.floating.label.korek'), shape: 'box', w: 0.4, h: 0.3, x: 1, y: 2.2, material: 'cork' },
      { id: 'drewno', label: t('labPhysics.preset.floating.label.drewno'), shape: 'box', w: 0.4, h: 0.3, x: 2, y: 2.2, material: 'wood' },
      { id: 'lod', label: t('labPhysics.preset.floating.label.lod'), shape: 'box', w: 0.4, h: 0.3, x: 3, y: 2.2, material: 'ice' },
      { id: 'plastik', label: t('labPhysics.preset.floating.label.plastik'), shape: 'box', w: 0.4, h: 0.3, x: 4, y: 2.2, material: 'plastic' },
      { id: 'aluminium', label: t('labPhysics.preset.floating.label.aluminium'), shape: 'box', w: 0.4, h: 0.3, x: 5, y: 2.2, material: 'aluminium' },
      { id: 'stal', label: t('labPhysics.preset.floating.label.stal'), shape: 'box', w: 0.4, h: 0.3, x: 6, y: 2.2, material: 'steel' }
    ],
    show: { vectors: ['g', 'lift'], values: true, pressure: true },
    allow: { add: false, tools: ['probe', 'ruler'] },
    view: [0, -0.3, 7, 2.8],
    steps: [{ say: t('labPhysics.preset.floating.step1'), do: 'play', wait: 4 }]
  })),
  preset('archimedes', 'archimedes', () => ({
    world: { gravity: 9.81, air: 0 },
    fluids: [
      { id: 'przelew', x: 1, y: 0, w: 1.2, h: 1.6, layers: [{ liquid: 'water', height: 1.18 }], holes: [{ side: 'right', at: 1.2, size: 0.08, open: true }] },
      { id: 'zlewka', x: 2.9, y: 0, w: 0.8, h: 0.9 }
    ],
    bodies: [{ id: 'klocek', label: t('labPhysics.preset.archimedes.label.klocek'), shape: 'box', w: 0.3, h: 0.4, x: 1.6, y: 2.3, material: 'aluminium' }],
    joints: [{ type: 'spring', a: 'klocek', on: [0, 0.2], at: [1.6, 3.6], length: 0.9, k: 300, damping: 30 }],
    show: { vectors: ['lift'], values: true },
    allow: { add: false, tools: ['probe', 'ruler'] },
    view: [0.2, -0.2, 4.4, 3.8],
    steps: [{ say: t('labPhysics.preset.archimedes.step1'), do: 'play', wait: 3 }]
  })),
  preset('pressure', 'cisnienie', () => ({
    world: { gravity: 9.81, air: 0 },
    fluids: [{
      id: 'zbiornik', x: 1, y: 1, w: 0.9, h: 2.6, layers: [{ liquid: 'water', height: 2.4 }],
      holes: [{ side: 'right', at: 0.2, size: 0.03, open: false }, { side: 'right', at: 0.9, size: 0.03, open: false }, { side: 'right', at: 1.6, size: 0.03, open: false }]
    }],
    bodies: [{ id: 'stojak', shape: 'box', w: 1.1, h: 0.94, x: 1.45, y: 0.47, static: true, material: 'wood', drag: false }],
    show: { values: true, pressure: true },
    allow: { add: false, tools: ['probe', 'ruler'] },
    view: [0.3, -0.2, 6.5, 4],
    steps: [
      { say: t('labPhysics.preset.pressure.step1'), do: { open: 'zbiornik', hole: 0 }, wait: 1.5 },
      { say: t('labPhysics.preset.pressure.step2'), do: { open: 'zbiornik', hole: 1 }, wait: 1.5 },
      { say: t('labPhysics.preset.pressure.step3'), do: { open: 'zbiornik', hole: 2 }, wait: 3 }
    ]
  })),
  preset('vessels', 'naczynia', () => ({
    world: { gravity: 9.81, air: 0 },
    fluids: [
      { id: 'a', x: 0.5, y: 0.3, w: 0.35, h: 2.2 },
      { id: 'b', x: 1.6, y: 0.3, w: 1.2, h: 2.2, layers: [{ liquid: 'water', height: 1.8 }] },
      { id: 'c', x: 3.5, y: 0.3, w: 0.2, h: 2.2 }
    ],
    pipes: [{ a: 'a', b: 'b', y: 0.36, size: 0.06 }, { a: 'b', b: 'c', y: 0.36, size: 0.06 }],
    bodies: [{ id: 'podstawa', shape: 'box', w: 3.8, h: 0.24, x: 2.15, y: 0.12, static: true, material: 'wood', drag: false }],
    show: { values: true, pressure: true },
    allow: { add: false, tools: ['probe', 'ruler'] },
    view: [0, -0.2, 4.4, 2.8],
    steps: [{ say: t('labPhysics.preset.vessels.step1'), do: 'play', wait: 4 }]
  })),
  preset('uTube', 'u-rurka', () => ({
    world: { gravity: 9.81, air: 0 },
    fluids: [
      { id: 'lewe', x: 1, y: 0.3, w: 0.25, h: 2, layers: [{ liquid: 'water', height: 0.8 }, { liquid: 'oil', height: 0.6 }] },
      { id: 'prawe', x: 2, y: 0.3, w: 0.25, h: 2, layers: [{ liquid: 'water', height: 0.8 }] }
    ],
    pipes: [{ a: 'lewe', b: 'prawe', y: 0.36, size: 0.06 }],
    bodies: [{ id: 'podstawa', shape: 'box', w: 1.6, h: 0.24, x: 1.62, y: 0.12, static: true, material: 'wood', drag: false }],
    show: { values: true, pressure: true },
    allow: { add: false, tools: ['probe', 'ruler'] },
    view: [0.4, -0.2, 2.9, 2.6],
    steps: [{ say: t('labPhysics.preset.uTube.step1'), do: 'play', wait: 4 }]
  })),
  preset('egg', 'jajko', () => ({
    world: { gravity: 9.81, air: 0 },
    fluids: [
      { id: 'slodka', x: 0.5, y: 0, w: 1.4, h: 1.4, layers: [{ liquid: 'water', height: 1 }] },
      { id: 'slona', x: 2.6, y: 0, w: 1.4, h: 1.4, layers: [{ liquid: 'saltwater', height: 1 }] }
    ],
    bodies: [
      { id: 'jajko1', label: t('labPhysics.preset.egg.label.jajko1'), shape: 'poly', points: [[0, -0.14], [0.08, -0.1], [0.1, 0], [0.08, 0.1], [0, 0.15], [-0.08, 0.1], [-0.1, 0], [-0.08, -0.1]], x: 1.2, y: 1.8, material: 'egg' },
      { id: 'jajko2', label: t('labPhysics.preset.egg.label.jajko2'), shape: 'poly', points: [[0, -0.14], [0.08, -0.1], [0.1, 0], [0.08, 0.1], [0, 0.15], [-0.08, 0.1], [-0.1, 0], [-0.08, -0.1]], x: 3.3, y: 1.8, material: 'egg' }
    ],
    show: { vectors: ['g', 'lift'], values: true },
    allow: { add: false, tools: ['probe'] },
    view: [0.1, -0.2, 4.4, 2.3],
    steps: [{ say: t('labPhysics.preset.egg.step1'), do: 'play', wait: 4 }]
  }))
];

/** Eine leere Piaskownica: Boden, etwas Platz, alles erlaubt. */
export const SANDBOX_SCENE: Readonly<Record<string, unknown>> = {
  world: { gravity: 9.81, air: 1 },
  bodies: [
    { id: 'rampa', shape: 'poly', points: [[0, 0], [3, 0], [0, 1.4]], x: 0.3, y: 0, static: true, material: 'stone' },
    { id: 'pilka', shape: 'circle', r: 0.18, x: 0.7, y: 2, material: 'ball' }
  ],
  fluids: [{ id: 'basen', x: 5, y: 0, w: 2.6, h: 1.3, layers: [{ liquid: 'water', height: 0.8 }] }],
  show: { values: true },
  controls: ['air', 'gravity'],
  view: [-0.3, -0.3, 8.5, 4.5]
};
