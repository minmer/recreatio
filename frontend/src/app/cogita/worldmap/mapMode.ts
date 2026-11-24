/**
 * 2026-11-24 (Eigentümer: „dieselbe Karte in verschiedenen Lagen wiederverwenden") — DER VERTRAG EINES MODUS DER WELTKARTE.
 *
 * Die Karte selbst (`mapCore.ts` + `WorldPillars`) zeichnet eine Szene, führt die Kamera, nimmt Klicks und Überfahren an, trägt das Menü
 * (☰), Vollbild und Seite. WAS sie in einer Lage zeigt und was ein Klick dort tut, sagt ein MODUS — je Lage eine Datei in `modes/`:
 *
 * <code>
 *   classSelectMode   die Lehrerin wählt, was eine Klasse sieht (alles anklickbar, Ausgeblendetes grau)
 *   tourMode          der Rundgang über die Karte (erfundener Stand, ein eigenes Bild, Klicks nur auf das Gezeigte)
 *   followViewMode    Schüler / Leinwand folgen (Kamera von aussen, nichts bedienbar)
 *   followHostMode    die Lehrerin führt die Klasse live (die Kamera und das Gewählte gehen hinaus)
 *   teacherMode       „Prowadzę": Prowadź tutaj / Zadaj über Türmen, die Zadania, der Teil der Klasse im Menü
 *   authorMode        wer die Baza schreibt: Hinweise zur Karte, Fehler der Wege zu einer Frage, die Lage neu
 *   learnerMode       der Lernende: Wege, Ziel, geführter Weg, Knöpfe über Türmen (die Grundlage, zuletzt)
 * </code>
 *
 * <b>Zusammensetzen</b> (`composeModes`): die Modi stehen nach Vorrang in einer Liste (der erste zuerst); ein inaktiver zählt nicht.
 * <list>
 *   <item>Zeichnen (`draw`): je Schlüssel gilt der ERSTE aktive Modus, der ihn setzt (auch `null` ist gesetzt: „nichts").</item>
 *   <item>Knöpfe über einem Ding (`buttons`): die Knöpfe, die ein Modus zeichnet (`towerActions` mit `of`), reichen alle Modi ÜBER ihm
 *     umgebaut weiter — der nächste zuerst, der oberste zuletzt.</item>
 *   <item>Klicks (`pick`): der erste aktive Modus mit einem Griff für diese Art nimmt ihn; ein AUSSCHLIESSENDER Modus (`exclusive`) schluckt
 *     jede Art, für die er keinen Griff hat — darunter liegende Modi bekommen nichts.</item>
 *   <item>Leisten (`banner` über den Bedienelementen, `bar` vor dem Menü, `overlay` nach dem Menü, `tools` bei den Reglern, `below` unter
 *     der Karte, `onMap` auf ihr): alle, in der Reihenfolge der Liste.</item>
 *   <item>Unterdrücken (`suppress`): ODER über alle aktiven Modi (Rundgang, Einladung, Seitenfeld, Abspielen, Überfahren, Vollbild).</item>
 *   <item>Kamera: `follow` vom ersten Modus, der sie vorgibt (dann ist sie gesteuert); `onCamera` aller Modi, die sie senden.</item>
 *   <item>Menü: die Einträge, die einen Modus BEGINNEN (`classes`, `live`), kommen von allen Modi — sperrt ein Modus das Menü
 *     (`menuLocked`), nur von ihm (`live` vom ersten, der es setzt). Der Teil der Klasse (`classBody`, `teaching`) bleibt immer.</item>
 * </list>
 *
 * Eine neue Lage der Karte (etwa die Planung einer Stunde) ist ein neuer Modus — eine Datei, keine Änderung an der Karte.
 */

import { createElement, Fragment, type ReactNode } from 'react';

import type { SharedCam } from '../follow/followModel';
import type { RouteFocus } from './wmFocus';
import type { Scene } from './wmScene';
import type { TowerButton } from './WorldPillars';

/** Was man auf der Karte anklicken kann. */
export type PickKind = 'place' | 'section' | 'home' | 'junction' | 'sign';

/** Ein Ding auf der Karte, dem Knöpfe gehören (die Art wie gewählt: auch Haus und Gabelung). */
export interface MapThing { readonly kind: string; readonly id: string }

/** Die Knöpfe über einem Ding (wie `WorldPillars.towerActions`) — `of`: wem sie gehören, damit Modi darüber sie umbauen können. */
export interface MapTowerActions {
  readonly place: string;
  readonly kind?: 'place' | 'section' | 'sign';
  readonly buttons: readonly TowerButton[];
  readonly of?: MapThing;
}

/** Was ein Modus der Zeichnung vorgibt — dieselben Namen wie die Eigenschaften von `WorldPillars`. */
export interface MapDraw {
  /** Ein eigenes Bild (der Rundgang); sonst das der Karte. */
  readonly scene: Scene;
  readonly route: readonly string[] | null;
  readonly faint: readonly string[] | null;
  readonly chosen: string | null;
  readonly focus: RouteFocus | null;
  readonly marks: { readonly start: string | null; readonly target: string | null; readonly forks: readonly string[] } | null;
  readonly lit: ReadonlySet<string> | null;
  readonly goal: string | null;
  readonly tasks: ReadonlySet<string> | null;
  readonly chosenSign: string | null;
  readonly under: ReactNode;
  readonly towerActions: MapTowerActions | null;
  readonly startAction: { readonly label: string; readonly onClick: () => void; readonly at: { readonly kind: 'place' | 'section'; readonly id: string } } | null;
  readonly hiddenLanes: ReadonlySet<string> | null;
}

/** Was ein Modus unterdrückt (für die anderen und für die Karte). */
export interface MapSuppress {
  /** Kein Rundgang (und ein laufender endet). */
  readonly tour?: boolean;
  /** Keine Frage „Vollbild, Seite oder hier?". */
  readonly invite?: boolean;
  /** Kein Seitenfeld (Ort, Abschnitt, Haus …). */
  readonly side?: boolean;
  /** Kein Abspielen dessen, was sich änderte (und kein Halten). */
  readonly playback?: boolean;
  /** Keine Blasen beim Überfahren. */
  readonly hover?: boolean;
  /** Kein „Pełny ekran" im Menü (der Modus braucht die Karte, wie sie ist). */
  readonly full?: boolean;
}

/** Ein Eintrag des Menüs, den ein Modus beiträgt (z. B. die Klassen, für die man wählt). */
export interface MapMenuPick { readonly key: string; readonly label: string; readonly onPick: () => void }

export interface MapMenuPart {
  /** „Widoczne dla klasy…": die Klassen zum Wählen. */
  readonly classes?: readonly MapMenuPick[];
  /** „Prowadź klasę na żywo": an/aus und die Klassen. */
  readonly live?: { readonly on: boolean; readonly onStop: () => void; readonly classes: readonly MapMenuPick[] } | null;
  /** Der Teil der Klasse (Prowadzę / Uczę się). */
  readonly classBody?: ReactNode;
  readonly teaching?: boolean;
}

/** Die Kamera: vorgegeben (gefolgt) oder gemeldet (geführt). */
export interface MapCamera {
  /** Die Kamera kommt von aussen — nichts lässt sich bedienen (`WorldPillars.following`). */
  readonly follow?: SharedCam | null;
  /** Jede Änderung der Kamera geht an diesen Modus. */
  readonly onCamera?: (cam: SharedCam) => void;
}

export interface MapPick {
  /** Ein Turm (`null`: daneben — nichts gewählt). */
  readonly place?: (id: string | null) => void;
  readonly section?: (id: string) => void;
  readonly home?: (id: string) => void;
  readonly junction?: (id: string) => void;
  readonly sign?: (key: string) => void;
  /** Doppelklick auf einen Turm (Ziel und Weg). */
  readonly lead?: (id: string) => void;
  /** Doppelklick auf freien Boden. */
  readonly plain?: () => void;
}

export interface MapMode {
  readonly id: string;
  readonly active: boolean;
  /** Ausschliessend: Klicks, für die der Modus keinen Griff hat, gehen an niemanden darunter. */
  readonly exclusive?: boolean;
  readonly draw?: Partial<MapDraw>;
  readonly pick?: MapPick;
  /** Die Knöpfe eines Dings umbauen, die ein Modus UNTER diesem zeichnet (etwa „Prowadź tutaj" vor denen des Lernenden). */
  readonly buttons?: (thing: MapThing, own: readonly TowerButton[]) => readonly TowerButton[];
  /** Über den Bedienelementen (etwa „Na żywo"). */
  readonly banner?: ReactNode;
  /** In den Bedienelementen vor dem Menü (etwa die Leiste der Wahl für eine Klasse). */
  readonly bar?: ReactNode;
  /** In den Bedienelementen nach dem Menü (etwa die Zadania der Klasse). */
  readonly overlay?: ReactNode;
  /** Bei den Reglern unter der Karte (etwa „Lage neu"). */
  readonly tools?: ReactNode;
  /** Unter der Karte (etwa die Hinweise für Schreibende). */
  readonly below?: ReactNode;
  /** Auf der Karte, über ihrem Bild (etwa die Karte des Rundgangs). */
  readonly onMap?: ReactNode;
  readonly menu?: MapMenuPart;
  /** Aus dem Menü beginnt nur dieser Modus etwas (die Klassen und „Na żywo" der anderen fallen weg). */
  readonly menuLocked?: boolean;
  readonly camera?: MapCamera;
  readonly suppress?: MapSuppress;
  /** Klassen am Wirt der Karte (`cg-wm-host …`) und Daten-Attribute (für Stil und Fahrten). */
  readonly hostClass?: string;
  readonly hostData?: Readonly<Record<string, string>>;
}

export interface ComposedModes {
  /** Je Schlüssel der Wert des ersten aktiven Modus, der ihn setzt; `undefined`: keiner. */
  readonly draw: Partial<MapDraw>;
  readonly pick: Required<MapPick>;
  /** Die Leisten aller Modi an ihrem Platz (je Modus ein Teil mit seinem Schlüssel; nichts: `null`). */
  readonly banner: ReactNode;
  readonly bar: ReactNode;
  readonly overlay: ReactNode;
  readonly tools: ReactNode;
  readonly below: ReactNode;
  readonly onMap: ReactNode;
  readonly menu: Required<Omit<MapMenuPart, 'classBody'>> & Pick<MapMenuPart, 'classBody'>;
  readonly camera: { readonly follow: SharedCam | null; readonly following: boolean; readonly onCamera: ((cam: SharedCam) => void) | undefined };
  readonly suppress: Required<MapSuppress>;
  readonly hostClass: string;
  readonly hostData: Readonly<Record<string, string>>;
  /** Die aktiven Modi (in der Reihenfolge des Vorrangs). */
  readonly active: readonly string[];
}

const DRAW_KEYS: readonly (keyof MapDraw)[] = ['scene', 'route', 'faint', 'chosen', 'focus', 'marks', 'lit', 'goal', 'tasks', 'chosenSign', 'under', 'towerActions', 'startAction', 'hiddenLanes'];
const has = (o: object | undefined, key: string): boolean => o !== undefined && Object.prototype.hasOwnProperty.call(o, key);
const shown = (b: ReactNode): boolean => b !== undefined && b !== null && b !== false;

/** Die Modi zusammensetzen — nach den Regeln oben. Rein (ohne React), geprüft in `scripts/app-mapmode-check.mjs`. */
export function composeModes(list: readonly (MapMode | null | undefined)[]): ComposedModes {
  const modes = list.filter((m): m is MapMode => m != null && m.active);
  const draw: Record<string, unknown> = {};
  for (const key of DRAW_KEYS) {
    const at = modes.findIndex((m) => has(m.draw, key));
    if (at < 0) continue;
    let value = (modes[at]!.draw as Record<string, unknown>)[key];
    /* Die Knöpfe über einem Ding: die Modi darüber bauen sie um (der nächste zuerst). */
    if (key === 'towerActions' && value !== null && value !== undefined) {
      const ta = value as MapTowerActions;
      const of = ta.of;
      if (of !== undefined) value = { ...ta, buttons: modes.slice(0, at).reverse().reduce<readonly TowerButton[]>((acc, m) => (m.buttons === undefined ? acc : m.buttons(of, acc)), ta.buttons) };
    }
    draw[key] = value;
  }
  /* Klicks: der erste Modus mit Griff nimmt ihn; ein ausschliessender ohne Griff schluckt ihn. */
  const handlerFor = <K extends keyof MapPick>(kind: K): NonNullable<MapPick[K]> | null => {
    for (const m of modes) {
      const h = m.pick?.[kind];
      if (h !== undefined) return h as NonNullable<MapPick[K]>;
      if (m.exclusive === true) return null;
    }
    return null;
  };
  const place = handlerFor('place'), section = handlerFor('section'), home = handlerFor('home'), junction = handlerFor('junction');
  const sign = handlerFor('sign'), lead = handlerFor('lead'), plain = handlerFor('plain');
  const lockers = modes.filter((m) => m.menuLocked === true);
  const starters = lockers.length > 0 ? lockers : modes;
  const liveFrom = starters.find((m) => has(m.menu, 'live'));
  const bodyFrom = modes.find((m) => m.menu?.classBody !== undefined);
  const followFrom = modes.find((m) => has(m.camera, 'follow'));
  const senders = modes.map((m) => m.camera?.onCamera).filter((f): f is (cam: SharedCam) => void => f !== undefined);
  /* Je Modus ein Teil mit dem Namen des Modus als Schlüssel: kommt ein Modus dazu, bleiben die anderen, wie sie sind. */
  const slot = (key: 'banner' | 'bar' | 'overlay' | 'tools' | 'below' | 'onMap'): ReactNode => {
    const parts = modes.filter((m) => shown(m[key])).map((m) => createElement(Fragment, { key: m.id }, m[key]));
    return parts.length === 0 ? null : parts;
  };
  const any = (key: keyof MapSuppress) => modes.some((m) => m.suppress?.[key] === true);
  return {
    draw: draw as Partial<MapDraw>,
    pick: {
      place: (id) => place?.(id),
      section: (id) => section?.(id),
      home: (id) => home?.(id),
      junction: (id) => junction?.(id),
      sign: (key) => sign?.(key),
      lead: (id) => lead?.(id),
      plain: () => plain?.()
    },
    banner: slot('banner'),
    bar: slot('bar'),
    overlay: slot('overlay'),
    tools: slot('tools'),
    below: slot('below'),
    onMap: slot('onMap'),
    menu: {
      classes: starters.flatMap((m) => m.menu?.classes ?? []),
      live: liveFrom?.menu?.live ?? null,
      ...(bodyFrom === undefined ? {} : { classBody: bodyFrom.menu?.classBody }),
      teaching: modes.some((m) => m.menu?.teaching === true)
    },
    camera: {
      follow: followFrom?.camera?.follow ?? null,
      following: followFrom !== undefined,
      onCamera: senders.length === 0 ? undefined : senders.length === 1 ? senders[0] : (cam) => { for (const s of senders) s(cam); }
    },
    suppress: { tour: any('tour'), invite: any('invite'), side: any('side'), playback: any('playback'), hover: any('hover'), full: any('full') },
    hostClass: modes.map((m) => m.hostClass).filter((c): c is string => c !== undefined && c !== '').join(' '),
    hostData: Object.assign({}, ...modes.map((m) => m.hostData ?? {})) as Record<string, string>,
    active: modes.map((m) => m.id)
  };
}
