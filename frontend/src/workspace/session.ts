/**
 * Wer hier ist — die einzige Frage, die der Arbeitsplatz vor dem ersten Bild
 * stellt.
 *
 * <b>Warum das schon jetzt eine eigene Datei ist.</b> Der Dienst des Neubaus
 * gibt es noch nicht. Die Versuchung waere, den Aufruf spaeter „irgendwo"
 * einzusetzen — und dann steht er an drei Stellen, mit drei verschiedenen
 * Annahmen darueber, was ein Fehlschlag bedeutet. Hier steht er einmal, und
 * die Antwort auf einen Fehlschlag steht daneben.
 *
 * <b>Ein Fehlschlag heisst NEIN.</b> Kein Netz, kein Dienst, keine Sitzung —
 * in jedem dieser Faelle ist die richtige Antwort dieselbe: nicht angemeldet.
 * Ein `catch`, das `true` zurueckgaebe, waere ein Zugang, der aus einem
 * Netzfehler entsteht.
 */

/**
 * Wo der Dienst des Neubaus liegt.
 *
 * Noch nicht gebaut. Der Name steht trotzdem hier und nicht verstreut in
 * Aufrufen: wenn er sich aendert, aendert er sich an einer Stelle.
 */
const API = import.meta.env.VITE_WORKSPACE_API ?? '';

/**
 * Ist gerade jemand angemeldet?
 *
 * Solange kein Dienst eingestellt ist, lautet die Antwort ehrlich `false` —
 * und NICHT „vielleicht". Eine Oberflaeche, die ohne Dienst so tut, als waere
 * jemand da, zeigt leere Listen, die wie ein Datenverlust aussehen.
 */
export async function whoIsThere(): Promise<boolean> {
  if (API === '') return false;

  try {
    const response = await fetch(`${API}/session`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    return response.ok;
  } catch {
    return false;
  }
}
