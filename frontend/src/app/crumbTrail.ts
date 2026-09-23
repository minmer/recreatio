/**
 * Der Weg, der oben steht — von „Warsztat" bis zu dem, was gerade offen ist.
 *
 * <b>Warum er nicht aus der Adresse allein entsteht.</b> In der Adresse steht
 * eine Kennung: `#/workspace/areas/01a0ce70-…`. Ein Mensch liest darin nichts.
 * Was dort STEHEN soll, ist „Parafia > Schola" — und das weiss nur die Ansicht,
 * die die Bereiche ohnehin geladen hat. Der Kopf der Seite kann es nicht
 * ausrechnen, ohne jede Ansicht zu kennen, die es je geben wird.
 *
 * <b>Deshalb meldet die Ansicht ihren Weg an, statt dass der Kopf ihn holt.</b>
 * Der Kopf zeigt, was angemeldet ist. Ist nichts angemeldet, zeigt er den Teil,
 * den er selbst weiss — und das ist kein Fehlerfall, sondern der Normalfall für
 * jede Ansicht ohne Tiefe.
 *
 * <b>Ein Speicher ausserhalb von React, und kein Kontext.</b> Ein Kontext
 * zwänge einen Anbieter um die ganze Anwendung und liesse jede Ansicht beim
 * Zeichnen den Kopf mit-zeichnen. Hier meldet die Ansicht in einem Effekt an —
 * nach dem Zeichnen, wie es sich gehört — und nur der Kopf zeichnet neu.
 *
 * <b>Beim Verlassen wird abgemeldet.</b> Ohne das bliebe der Bereich im Kopf
 * stehen, während darunter längst die Rollen stünden: ein Weg, der auf etwas
 * zeigt, das man verlassen hat, ist schlimmer als gar keiner.
 */

import { useEffect, useSyncExternalStore } from 'react';

/** Eine Stufe des Weges. */
export interface Crumb {
  readonly label: string;

  /**
   * Wohin sie führt. `null` heisst: das ist die Stelle, an der wir stehen —
   * sie ist kein Verweis auf sich selbst.
   */
  readonly href: string | null;

  /**
   * Was auf DERSELBEN Stufe noch liegt — die Geschwister.
   *
   * <b>Das macht aus dem Weg ein Menü.</b> Wer in einem Unterbereich steht,
   * will meistens in den daneben, und nicht erst hinauf und wieder hinunter.
   * Fehlt es, ist die Stufe einfach ein Verweis.
   */
  readonly beside?: readonly { readonly label: string; readonly href: string }[];
}

type Listener = () => void;

let deep: readonly Crumb[] = [];
const listeners = new Set<Listener>();

const tell = () => { for (const one of listeners) one(); };

const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/**
 * Was eine Ansicht INNERHALB ihrer selbst offen hat.
 *
 * Der Kopf setzt „Warsztat" und den Namen der Ansicht davor; hier steht nur,
 * was tiefer liegt.
 */
export const useDeepCrumbs = (): readonly Crumb[] =>
  useSyncExternalStore(subscribe, () => deep, () => deep);

/**
 * Den eigenen Weg anmelden — und beim Verlassen wieder abmelden.
 *
 * <b>`useEffect` und nicht beim Zeichnen.</b> Beim Zeichnen zu melden hiesse,
 * während des Zeichnens einer Ansicht eine andere neu zu zeichnen; React sagt
 * dazu zu Recht etwas.
 *
 * <b>Verglichen wird der INHALT, nicht die Kennung des Feldes.</b> Eine Ansicht
 * baut ihren Weg bei jedem Zeichnen neu; ginge es nach der Kennung, meldete
 * jedes Zeichnen eine Änderung an und der Kopf zeichnete endlos mit.
 */
export function useCrumbs(mine: readonly Crumb[]): void {
  const same = JSON.stringify(mine);

  useEffect(() => {
    deep = JSON.parse(same) as readonly Crumb[];
    tell();

    return () => {
      deep = [];
      tell();
    };
  }, [same]);
}
