/**
 * Darf der Angemeldete diese Pfarrei verwalten?
 *
 * <b>Die Frage geht an den Dienst und wird nicht geraten.</b> Ein
 * Bearbeitungsschalter, der erscheint, weil die Oberfläche vermutet, dass
 * jemand darf, führt zu einem Klick und einer Fehlermeldung. Ein Schalter, der
 * nur erscheint, wenn der Server es bestätigt hat, führt zu einer Bearbeitung.
 *
 * <b>Ein Fehlschlag heisst „nein".</b> Nicht angemeldet, keine Schlüssel, kein
 * Netz — in jedem dieser Fälle ist die richtige Antwort dieselbe: der Schalter
 * bleibt weg. Ein `catch`, das `true` zurückgäbe, wäre eine Berechtigung, die
 * aus einem Netzfehler entsteht.
 */

import { rcFetch } from '../lib/rcApi';
import type { RcApi } from '../lib/rcApi';

export async function rcMayAdminArea(areaId: string | null | undefined): Promise<boolean> {
  if (areaId === null || areaId === undefined || areaId === '') return false;

  try {
    const answer = await rcFetch<RcApi<'RcPermissionCheckResponse'>>(
      `/permissions/check?scopeKind=area&scopeId=${encodeURIComponent(areaId)}&capability=admin`,
      { withUnlock: true }
    );
    return answer.allowed === true;
  } catch {
    return false;
  }
}
