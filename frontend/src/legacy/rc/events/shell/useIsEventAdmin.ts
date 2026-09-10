/**
 * Fuehrt dieser Leser die Veranstaltung?
 *
 * <b>Im alten Modul war das eine Frage an den Dienst</b> („bist du der
 * Veranstalter dieses Links?"). Hier ist es keine mehr: die Antwort steht
 * bereits im Zusammenhang jedes Teils als `mayRead` — sie folgt daraus, ob der
 * Leser den Schluessel des Bereichs hat, und der Dienst hat sie beim Laden der
 * Veranstaltung schon beantwortet.
 *
 * Ein zweiter Aufruf danebenzustellen hiesse, dieselbe Auskunft zweimal zu
 * holen und danach zwei Wahrheiten zu haben, sobald eine davon aelter ist.
 *
 * <b>Warum die Datei trotzdem steht.</b> Die uebernommenen Teile rufen sie auf.
 * Sie zu entfernen hiesse, in jedem davon eine Zeile anders zu machen — und
 * beim naechsten Abgleich mit dem alten Modul, das noch laeuft, waere jede
 * davon ein Unterschied, den jemand von Hand nachziehen muss.
 */

import { createContext, useContext } from 'react';

/** Gesetzt von der Huelle, aus `mayRead` der Veranstaltung. */
export const RcEventAdminContext = createContext(false);

export function useIsEventAdmin(): boolean {
  return useContext(RcEventAdminContext);
}
