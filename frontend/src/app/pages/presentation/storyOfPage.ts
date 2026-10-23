/**
 * DAS STORYBOARD EINER SEITE, GELADEN (2026-10-22, Schritt 12) — für einen
 * Ablauf der Baza wiedzy, der auf eine Präsentation zeigt (`presentation`):
 * zum Spielen in Nauka und als Karte im Editor der Abläufe.
 *
 * Geholt wird die Seite wie jede andere (`/page/<pfad>`), mit dem Zugang
 * dessen, der schaut: wer sie nicht sehen darf, bekommt sie auch hier nicht
 * („[odwołanie niedostępne]"). Ohne die Bausteine der Seite (kein Register) —
 * der Editor der Abläufe lädt nur, was er für den Graphen braucht.
 */

import { WorkspaceError } from '../../core/session';
import { loadPage, toDraft, type DraftPart, type PageContent } from '../page';
import { text } from '../part';
import { readLook, type Look } from '../slides/slideLook';
import { readPiece, readShow, type Show } from './presentation';
import { NO_STORY } from './story';
import { storyToFlow, type StoryFlow, type StoryPiece } from './storyFlow';

export interface LoadedStory {
  readonly page: PageContent;
  /** Der Pfad, unter dem die Seite wirklich steht (ein Zweitname zeigt auf ihn). */
  readonly path: string;
  readonly parts: readonly DraftPart[];
  readonly look: Look;
  readonly show: Show;
  readonly flow: StoryFlow;
}

/** Wie ein Baustein heisst — ohne das Register der Bausteine (dort: `pieceLabelOf`). */
const labelOf = (part: DraftPart): string => {
  const line = (part.config.body ?? '').split('\n').map((one) => one.trim()).find((one) => one !== '') ?? '';
  return text(part.config, 'title') || text(part.config, 'alt') || line.replace(/^[#>]+\s*/, '').slice(0, 60) || part.kind;
};

/** Die Präsentation unter `path` — oder ein Satz, warum nicht (wirft `Error` mit ihm). */
export async function loadStory(path: string): Promise<LoadedStory> {
  let page: PageContent;
  try {
    page = await loadPage(path.replace(/^#?\/?/, ''));
  } catch (e) {
    const verdict = e instanceof WorkspaceError ? e.verdict : null;
    throw new Error(verdict === 'needsaccess' || verdict === 'noaccess'
      ? '[odwołanie niedostępne] Ta prezentacja jest tylko dla osób z dostępem.'
      : e instanceof Error ? e.message : 'Nie udało się wczytać prezentacji.');
  }
  if (page.locked === true) throw new Error('[odwołanie niedostępne] Ta prezentacja jest zaszyfrowana, a ta przeglądarka nie ma do niej klucza.');
  if (page.mode !== 'presentation') throw new Error(`Pod adresem „${path}” nie ma prezentacji.`);
  const parts = page.parts.map(toDraft);
  const look = readLook(page.theme ?? null);
  const read = readShow(look.show);
  /* Wie auf der Seite: Fragen ohne eingestellten Przebieg haben einen (im Browser). */
  const show = read.story === null && parts.some((part) => part.kind === 'question') ? { ...read, story: NO_STORY } : read;
  const pieces: StoryPiece[] = parts
    .map((part) => ({ key: part.id, kind: part.kind, label: labelOf(part), piece: readPiece(part.layout) }))
    .filter((one) => Object.keys(one.piece.places).length > 0);
  const real = page.aliasOf ?? page.path;
  return { page, path: real, parts, look, show, flow: storyToFlow(show, pieces, real) };
}
