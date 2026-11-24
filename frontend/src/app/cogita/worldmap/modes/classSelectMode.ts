/**
 * MODUS „WAS DIE KLASSE SIEHT" (`ClassSelect.tsx`): die Lehrerin klickt Türme, Abschnitte, Gabelungen und Wegweiser an — alles
 * anklickbar, Ausgeblendetes grau. Solange er läuft, ist er ausschliessend: kein Weg, kein Ziel, keine Knöpfe, kein Abspielen, kein
 * Seitenfeld, kein Rundgang. Auch ohne zu wählen trägt er die Klassen ins Menü ein („Widoczne dla klasy…").
 */

import type { ClassSelect } from '../ClassSelect';
import type { MapMode } from '../mapMode';

export function classSelectMode(sel: ClassSelect, opts: {
  /** Die Wege eines Wegweisers (der Wegweiser selbst ist nur ein Ort auf der Karte). */
  readonly signPaths: (key: string) => readonly string[];
  /** Vor dem Wählen: was der Lernende gewählt hatte, fällt weg. */
  readonly beforeStart: () => void;
}): MapMode {
  const menu = { classes: sel.classes.map((c) => ({ key: c.areaId, label: c.name, onPick: () => { opts.beforeStart(); sel.start(c); } })) };
  if (!sel.active) return { id: 'classSelect', active: true, menu };
  return {
    id: 'classSelect',
    active: true,
    exclusive: true,
    draw: {
      route: null, faint: null, chosen: null, focus: null, marks: null, lit: sel.lit, goal: null, tasks: null, chosenSign: null,
      under: null, towerActions: null, startAction: null, hiddenLanes: sel.hiddenLanes
    },
    pick: {
      place: (id) => { if (id !== null) sel.pickPlace(id); },
      section: sel.pickLane,
      junction: sel.pickJunction,
      sign: (key) => sel.pickSign(opts.signPaths(key))
    },
    bar: sel.bar,
    /* Aus dem Menü beginnt nichts anderes: keine Klassen zum Wählen, kein „Prowadź na żywo". */
    menu: { classes: [], live: null },
    menuLocked: true,
    suppress: { tour: true, invite: true, side: true, playback: true }
  };
}
