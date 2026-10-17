/**
 * 2026-10-18 — WELTEN ZUM ANFASSEN (`liveModel.ts`: `world`): eine Waage aus
 * Belken und Gewichten, die man aufhängt, verschiebt und ins Gleichgewicht
 * bringt — und, um zu zeigen, dass nichts davon eine Waage im Code ist, eine
 * Übersetzung aus Zahnrädern mit denselben Wörtern.
 *
 * <b>Die Waage</b>: jede Belke dreht sich um ihren Punkt (`pivot`); ihre
 * Stange liegt ein wenig darunter (`h`), darum steht sie leer gerade und
 * kippt, wenn eine Seite überwiegt — bis an den Anschlag (`tilt`). Was an ihr
 * hängt, zieht mit seiner ganzen Masse an seinem Punkt: das Moment ist
 * `sum(children, total*arm)` (kg·m), die ganze Masse `bm + sum(children,
 * total)` — so wirkt eine untere Belke mit allem, was an ihr hängt, auf die
 * obere. Bewegt wird nach dem Drallsatz:
 *
 * <code>
 *   I·ω' = −g·M·cos φ − k·sin φ − c·ω      (M: Moment, k = g·h·Masse, c: Dämpfung)
 * </code>
 *
 * Gelöst ist, wenn jede Belke (fast) kein Moment hat und still steht — eine
 * Sekunde lang. Die Stufen des Spiels (`scripts/balance-lab.mjs`) sind
 * dieselben Arten mit anderen Dingen, Sperren und Regeln (`balanceDrawing`).
 */

import type { LiveExample } from './liveExamples';

/** Die Belke: Länge, Drehpunkt, eigene Masse; wo sie an der oberen hängt (Leine) — ganz oben: wo ihr Ständer steht. */
const BEAM = {
  name: 'belka',
  label: 'Belka',
  props: [
    { name: 'length', label: 'Długość', value: 4, min: 1, max: 10, step: 0.5, unit: 'm' },
    { name: 'pivot', label: 'Oś obrotu (od lewego końca)', value: 2, min: 0, max: '=length', step: 0.25, unit: 'm' },
    { name: 'bm', label: 'Masa belki', value: 0, min: 0, max: 50, step: 1, unit: 'kg' },
    { name: 'pos', label: 'Miejsce na belce wyżej', value: 1, min: 0, max: '=parent.length', step: 0.25, unit: 'm', apart: 0.25, when: '!isroot', new: 'parent.pivot + 1' },
    { name: 'drop', label: 'Długość linki', value: 1.2, min: 0.3, max: 3, step: 0.1, unit: 'm', when: '!isroot' },
    { name: 'sx', label: 'Położenie stojaka', value: 0, min: -40, max: 40, step: 0.5, unit: 'm', when: 'isroot', new: 'max(things, bx1) + pivot + 0.5' }
  ],
  let: [
    { name: 'total', value: 'bm + sum(children, total)' },
    { name: 'arm', value: 'isroot ? 0 : pos - parent.pivot' },
    { name: 'mom', value: 'sum(children, total*arm) + bm*(length/2 - pivot)' },
    { name: 'inertia', value: 'bm*(length^2/12 + (length/2 - pivot)^2) + sum(children, total*arm^2) + 0.3' },
    { name: 'kr', value: 'g*h*(total + 1)' },
    { name: 'damp', value: '2*zeta*sqrt(kr*inertia)' },
    { name: 'ok', value: 'abs(mom) < tol' },
    { name: 'still', value: 'abs(omega) < 0.05 && abs(angle) < 0.05' },
    { name: 'ca', value: 'cos(angle)' },
    { name: 'sa', value: 'sin(angle)' },
    { name: 'ax', value: 'isroot ? sx : parent.x + arm*parent.ca + h*parent.sa' },
    { name: 'ay', value: 'isroot ? stand : parent.y + arm*parent.sa - h*parent.ca' },
    { name: 'x', value: 'ax' },
    { name: 'y', value: 'isroot ? stand : ay - drop' },
    { name: 'x1', value: 'x - pivot*ca + h*sa' },
    { name: 'y1', value: 'y - pivot*sa - h*ca' },
    { name: 'x2', value: 'x + (length - pivot)*ca + h*sa' },
    { name: 'y2', value: 'y + (length - pivot)*sa - h*ca' },
    { name: 'dy', value: 'isroot ? 0 : parent.dy - h - drop' },
    { name: 'low', value: 'dy - h - 0.15 - max(pivot, length - pivot)*0.36' },
    { name: 'stand', value: 'isroot ? max(2.5, 0.8 - min(low, min(descendants, low))) : 0' },
    { name: 'rx', value: 'isroot ? sx : parent.rx + arm' },
    { name: 'ry', value: 'root.stand + dy' },
    { name: 'bx0', value: 'rx - pivot - 0.4' },
    { name: 'bx1', value: 'rx + length - pivot + 0.4' },
    { name: 'by0', value: 'ry - h - 0.5' },
    { name: 'by1', value: 'ry + 0.7' },
    { name: 'hit', value: '6' }
  ],
  state: [
    { name: 'angle', value: 0, rate: 'omega' },
    { name: 'omega', value: 0, rate: '(-g*mom*cos(angle) - kr*sin(angle) - damp*omega)/inertia' }
  ],
  events: [
    { when: 'angle > tilt', set: { angle: 'tilt', omega: 0 } },
    { when: 'angle < -tilt', set: { angle: '-tilt', omega: 0 } }
  ],
  drag: {
    pos: 'parent.pivot + (px - parent.x)*parent.ca + (py - parent.y)*parent.sa',
    drop: 'ay - py',
    sx: 'px'
  },
  can: { edit: ['length', 'pivot', 'bm', 'pos', 'drop', 'sx'], add: ['ciezarek', 'belka'], remove: true, copy: true },
  readouts: [
    { label: 'Suma momentów', value: 'mom', unit: 'kg·m', digits: 2 },
    { label: 'Masa z tym, co wisi', value: 'total', unit: 'kg', digits: 1 },
    { label: 'Pochylenie', value: 'deg(angle)', unit: '°', digits: 1 }
  ],
  children: 8,
  shapes: [
    { type: 'line', x: '=x', y: '=y', x2: '=x', y2: 0, stroke: 'muted', width: 5, show: 'isroot' },
    { type: 'line', x: '=x - 0.6', y: 0, x2: '=x + 0.6', y2: 0, stroke: 'muted', width: 5, show: 'isroot' },
    { type: 'line', x: '=ax', y: '=ay', x2: '=x', y2: '=y', stroke: 'muted', width: 1.5, show: '!isroot' },
    { type: 'line', x: '=x', y: '=y', x2: '=x + h*sa', y2: '=y - h*ca', stroke: 'ink', width: 3 },
    { type: 'line', x: '=x1', y: '=y1', x2: '=x2', y2: '=y2', stroke: "=ok ? (still ? 'ok' : 'warn') : 'danger'", width: 7 },
    {
      type: 'line', repeat: 21, x: '=x1 + i*0.5*ca', y: '=y1 + i*0.5*sa', x2: '=x1 + i*0.5*ca + 0.13*sa', y2: '=y1 + i*0.5*sa - 0.13*ca',
      stroke: 'ink/45', width: 1, show: 'ruler && i*0.5 <= length + 0.001'
    },
    { type: 'circle', x: '=x', y: '=y', r: 4.5, fill: 'ink' },
    { type: 'circle', x: '=x', y: '=y', r: 2, fill: 'ground' },
    { type: 'text', x: '=x', y: '=y + 0.42', text: 'ΣM = {fmt(mom, 2)} kg·m', size: 11, weight: 600, fill: "=ok ? 'ok' : 'danger'", show: 'edu' }
  ]
};

/** Ein Gewicht: Masse, wo es an der Belke hängt, wie lang seine Leine ist. */
const WEIGHT = {
  name: 'ciezarek',
  label: 'Ciężarek',
  props: [
    { name: 'm', label: 'Masa', value: 5, min: 1, max: 100, step: 1, unit: 'kg' },
    { name: 'pos', label: 'Miejsce na belce', value: 1, min: 0, max: '=parent.length', step: 0.25, unit: 'm', apart: 0.25, new: 'parent.pivot - 1' },
    { name: 'drop', label: 'Długość linki', value: 0.6, min: 0.2, max: 3, step: 0.1, unit: 'm' }
  ],
  let: [
    { name: 'total', value: 'm' },
    { name: 'arm', value: 'pos - parent.pivot' },
    { name: 'r', value: '0.13 + 0.035*sqrt(m)' },
    { name: 'ax', value: 'parent.x + arm*parent.ca + h*parent.sa' },
    { name: 'ay', value: 'parent.y + arm*parent.sa - h*parent.ca' },
    { name: 'x', value: 'ax' },
    { name: 'y', value: 'ay - drop - r' },
    { name: 'dy', value: 'parent.dy - h - drop' },
    { name: 'low', value: 'dy - 2*r - 0.35 - abs(arm)*0.36' },
    { name: 'rx', value: 'parent.rx + arm' },
    { name: 'ry', value: 'root.stand + dy' },
    { name: 'bx0', value: 'rx - r - 0.3' },
    { name: 'bx1', value: 'rx + r + 0.3' },
    { name: 'by0', value: 'ry - 2*r - 0.5' },
    { name: 'by1', value: 'ry' },
    { name: 'hit', value: '4' }
  ],
  drag: {
    pos: 'parent.pivot + (px - parent.x)*parent.ca + (py - parent.y)*parent.sa',
    drop: 'ay - py - r'
  },
  can: { edit: ['m', 'pos', 'drop'], remove: true, copy: true },
  readouts: [
    { label: 'Moment względem osi', value: 'total*arm', unit: 'kg·m', digits: 2 },
    { label: 'Ramię', value: 'abs(arm)', unit: 'm', digits: 2 }
  ],
  children: 0,
  shapes: [
    { type: 'line', x: '=ax', y: '=ay', x2: '=x', y2: '=y + r', stroke: 'muted', width: 1.5 },
    { type: 'rect', x: '=x - r', y: '=y - r', w: '=2*r', h: '=2*r', r: 3, fill: 'accent', stroke: 'ink/30', width: 1 },
    { type: 'text', x: '=x', y: '=y - r - 0.2', text: '{fmt(m, 0)} kg', size: 11, weight: 600, fill: 'ink' },
    { type: 'text', x: '=x', y: '=y - r - 0.45', text: 'M = {fmt(total*arm, 1)}', size: 9.5, fill: 'muted', show: 'edu' }
  ]
};

export interface BalanceLevel {
  readonly alt: string;
  /** Die Dinge: `{ id, kind: 'belka' | 'ciezarek', parent, lock, … Eigenschaften }`. */
  readonly things: readonly Readonly<Record<string, unknown>>[];
  readonly allow?: Readonly<Record<string, unknown>>;
  readonly keep?: readonly Readonly<Record<string, unknown>>[];
  readonly hint?: string;
  readonly save?: boolean;
  /** Was erscheint, wenn alles im Gleichgewicht ist. */
  readonly solved?: string;
  /** Weitere Bedienung (in einer Präsentation: „Dalej", wenn gelöst). */
  readonly controls?: readonly Readonly<Record<string, unknown>>[];
  readonly rules?: readonly Readonly<Record<string, unknown>>[];
}

/** Eine Waage: dieselben Arten, Werte, Rechnungen und Regeln — mit den Dingen, Sperren und Grenzen einer Stufe. */
export function balanceDrawing(level: BalanceLevel): Record<string, unknown> {
  return {
    alt: level.alt,
    size: [480, 320],
    vars: [
      { name: 'g', value: 9.81, unit: 'm/s²', label: 'Grawitacja' },
      { name: 'tol', value: 0.05, unit: 'kg·m', label: 'Tolerancja momentu' },
      { name: 'h', value: 0.2, unit: 'm', label: 'Drążek pod osią' },
      { name: 'zeta', value: 0.5, label: 'Tłumienie' },
      { name: 'tilt', value: 0.35, unit: 'rad', label: 'Największe pochylenie' },
      { name: 'edu', value: 1, min: 0, max: 1, step: 1, label: 'Momenty' },
      { name: 'ruler', value: 1, min: 0, max: 1, step: 1, label: 'Linijka' },
      { name: 'solved', value: 0, min: 0, max: 1, step: 1 }
    ],
    let: [
      { name: 'vx0', value: 'min(things, bx0)' },
      { name: 'vx1', value: 'max(things, bx1)' },
      { name: 'vy1', value: 'max(things, by1)' },
      { name: 'vw', value: 'ceil(max(vx1 - vx0, (vy1 + 0.4)*1.5, 6)/0.5)*0.5' },
      { name: 'vh', value: 'vw/1.5' },
      { name: 'vcx', value: 'round((vx0 + vx1)/2*4)/4' },
      { name: 'vcy', value: 'vh/2 - 0.4' },
      { name: 'bad', value: 'count(belka, !ok)' }
    ],
    sim: { dt: 0.01, speed: 4, auto: true, sleep: true, max: 3600 },
    controls: [
      { type: 'toggle', var: 'edu', label: 'Momenty' },
      { type: 'toggle', var: 'ruler', label: 'Linijka' },
      { type: 'readout', label: 'Przeważa belek', value: 'bad', digits: 0 },
      ...(level.controls ?? [])
    ],
    rules: [
      {
        when: 'nthings > 0 && all(belka, ok && still)', for: 1, goal: true, set: { solved: 1 },
        say: level.solved ?? 'Równowaga! Na każdej belce masa × ramię po lewej równa się masie × ramię po prawej.'
      },
      { when: 'edits > 0 && bad > 0', say: 'Przeważa jeszcze belek: {bad}. Porównaj masa × ramię po obu stronach osi.', mood: 'miss' },
      ...(level.rules ?? [])
    ],
    world: {
      kinds: [BEAM, WEIGHT],
      things: level.things,
      allow: level.allow ?? { roots: ['belka'] },
      limits: { things: 40, depth: 6 },
      keep: level.keep ?? [],
      save: level.save ?? false,
      hint: level.hint ?? 'Dotknij belki albo ciężarka, żeby go wybrać; przeciągnij, żeby przesunąć.'
    },
    elements: [
      {
        type: 'frame', x: 0, y: 0, w: 480, h: 320, camera: true, clip: true,
        view: ['=vcx - vw/2', '=vcy - vh/2', '=vcx + vw/2', '=vcy + vh/2'],
        children: [
          { type: 'rect', x: '=vcx - vw', y: -3, w: '=2*vw', h: 3, fill: 'muted/12' },
          { type: 'line', x: '=vcx - vw', y: 0, x2: '=vcx + vw', y2: 0, stroke: 'muted/60', width: 1.5 },
          { type: 'world' }
        ]
      }
    ]
  };
}

/** Die Werkstatt: alles erlaubt — Belken und Gewichte anhängen, verschieben, ändern, kopieren, speichern. */
export const BALANCE: LiveExample = {
  key: 'waga',
  title: 'Waga — warsztat',
  says: 'Świat rzeczy: belki i ciężarki, które się dowiesza, przesuwa i zmienia; każda belka liczy swój moment i przechyla się, póki nie zrównoważysz.',
  drawing: balanceDrawing({
    alt: 'Waga z belek i ciężarków — warsztat',
    save: true,
    allow: { roots: ['belka'] },
    hint: 'Dotknij belki, żeby dowiesić ciężarek albo kolejną belkę; ciężarek przeciągnij wzdłuż belki. Cofnij: Ctrl+Z.',
    things: [
      { id: 'b1', kind: 'belka', length: 6, pivot: 3, sx: 0 },
      { id: 'w1', kind: 'ciezarek', parent: 'b1', m: 4, pos: 1.5 },
      { id: 'w2', kind: 'ciezarek', parent: 'b1', m: 2, pos: 5 }
    ]
  })
};

/** Zahnräder: dasselbe Wort `world` — jedes Rad greift in sein Elternrad, dreht sich andersherum und um so schneller, je kleiner es ist. */
export const GEARS: LiveExample = {
  key: 'przekladnia',
  title: 'Przekładnia zębata',
  says: 'Koła zębate jako świat rzeczy: każde koło zazębia się z kołem, na którym wisi; liczba zębów decyduje o obrotach. Dowieś koło, zmień zęby, przeciągnij je wokół sąsiada.',
  drawing: {
    alt: 'Przekładnia zębata: koło napędowe i koła, które się z nim zazębiają',
    size: [480, 320],
    vars: [
      { name: 'motor', value: 20, min: -60, max: 60, step: 5, unit: 'obr/min', label: 'Silnik' },
      { name: 'mod', value: 0.1, unit: 'm', label: 'Moduł (m na ząb)' }
    ],
    let: [
      { name: 'vx0', value: 'min(things, x - r) - 0.4' },
      { name: 'vx1', value: 'max(things, x + r) + 0.4' },
      { name: 'vy0', value: 'min(things, y - r) - 0.4' },
      { name: 'vy1', value: 'max(things, y + r) + 0.6' },
      { name: 'vw', value: 'max(vx1 - vx0, (vy1 - vy0)*1.5, 4)' },
      { name: 'vcx', value: '(vx0 + vx1)/2' },
      { name: 'vcy', value: '(vy0 + vy1)/2' }
    ],
    sim: { dt: 0.01, auto: true, max: 3600 },
    controls: [
      { type: 'slider', var: 'motor' },
      { type: 'readout', label: 'Najszybsze koło', value: 'max(kolo, abs(rpm))', unit: 'obr/min', digits: 1 }
    ],
    world: {
      kinds: [{
        name: 'kolo',
        label: 'Koło',
        props: [
          { name: 'teeth', label: 'Zęby', value: 20, min: 8, max: 48, step: 1 },
          { name: 'dir', label: 'Kierunek od sąsiada', value: 0, min: -180, max: 180, step: 5, unit: '°', when: '!isroot' },
          { name: 'cx', label: 'x', value: 0, min: -10, max: 10, step: 0.1, unit: 'm', when: 'isroot' },
          { name: 'cy', label: 'y', value: 0, min: -10, max: 10, step: 0.1, unit: 'm', when: 'isroot' }
        ],
        let: [
          { name: 'r', value: 'teeth*mod/2' },
          { name: 'x', value: 'isroot ? cx : parent.x + (r + parent.r)*cos(rad(dir))' },
          { name: 'y', value: 'isroot ? cy : parent.y + (r + parent.r)*sin(rad(dir))' },
          { name: 'omega', value: 'isroot ? motor*tau/60 : -parent.omega*parent.r/r' },
          { name: 'rpm', value: 'omega*60/tau' },
          { name: 'phi', value: 'isroot ? theta : rad(dir) + pi - (parent.phi - rad(dir))*parent.teeth/teeth + pi/teeth' },
          { name: 'hit', value: '8' }
        ],
        state: [{ name: 'theta', value: 0, rate: 'isroot ? omega : 0' }],
        drag: { dir: 'deg(atan2(py - parent.y, px - parent.x))', cx: 'px', cy: 'py' },
        can: { edit: ['teeth', 'dir'], add: ['kolo'], remove: true },
        readouts: [
          { label: 'Obroty', value: 'rpm', unit: 'obr/min', digits: 1 },
          { label: 'Przełożenie względem silnika', value: 'omega/root.omega', digits: 3 }
        ],
        children: 4,
        shapes: [
          { type: 'ellipse', x: '=x', y: '=y', w: '=2*r', h: '=2*r', fill: 'accent/15', stroke: 'accent', width: 2 },
          {
            type: 'line', repeat: 48, x: '=x + (r - 0.05)*cos(phi + i*tau/teeth)', y: '=y + (r - 0.05)*sin(phi + i*tau/teeth)',
            x2: '=x + (r + 0.07)*cos(phi + i*tau/teeth)', y2: '=y + (r + 0.07)*sin(phi + i*tau/teeth)', stroke: 'accent', width: 4, cap: 'butt', show: 'i < teeth'
          },
          { type: 'line', x: '=x', y: '=y', x2: '=x + 0.8*r*cos(phi)', y2: '=y + 0.8*r*sin(phi)', stroke: 'ink', width: 2 },
          { type: 'circle', x: '=x', y: '=y', r: 4, fill: 'ink' },
          { type: 'text', x: '=x', y: '=y + r + 0.25', text: '{teeth} z · {fmt(rpm, 1)} obr/min', size: 10, fill: 'muted' }
        ]
      }],
      things: [
        { id: 'k1', kind: 'kolo', teeth: 24, lock: ['cx', 'cy'] },
        { id: 'k2', kind: 'kolo', parent: 'k1', teeth: 12, dir: 0 },
        { id: 'k3', kind: 'kolo', parent: 'k2', teeth: 36, dir: -50 }
      ],
      allow: { copy: false },
      hint: 'Dotknij koła: zmień liczbę zębów albo dowieś następne. Koło przeciągnij wokół sąsiada.'
    },
    elements: [
      {
        type: 'frame', x: 0, y: 0, w: 480, h: 320, camera: true, clip: true,
        view: ['=vcx - vw/2', '=vcy - vw/3', '=vcx + vw/2', '=vcy + vw/3'],
        children: [{ type: 'world' }]
      }
    ]
  }
};
