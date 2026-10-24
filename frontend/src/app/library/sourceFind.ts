/**
 * 2026-10-24 — DIE TEXTE, DIE DIESER LESER ERREICHT. Ein Zitat, eine Fussnote, ein Feld mit
 * Stelle in Nauka fragt hier, ob es zum zitierten Werk einen Text gibt und wo die Stelle darin
 * steht (`sourceText.ts`). Gefragt werden der `Lookup`, mit dem gezeichnet wird (eine Seite
 * kennt nur ihre Bibliotheken), und im Arbeitsbereich alle Bibliotheken, die der Tab schon offen
 * hat. Mehr nicht: was dieser Browser nicht lesen darf, kommt hier nie an — der Dienst gibt die
 * Hüllen nur dem, der den Bereich liest, und öffnen kann sie nur sein Schlüssel.
 */

import type { LibEntry, Lookup } from './libraryKinds';
import { loadedStores, type LibraryStore } from './libraryStore';
import { textPlace, type TextFinder, type TextLink } from './sourceText';

/** Wer die Texte eines Werks kennt: der Zeichnende und die offenen Bibliotheken des Tabs. */
export const finderOf = (look: Lookup | undefined): TextFinder => (workId) => {
  const out = new Map<string, LibEntry>();
  for (const e of look?.texts?.(workId) ?? []) out.set(e.id, e);
  for (const store of loadedStores()) for (const e of store.ownTexts(workId)) out.set(e.id, e);
  return [...out.values()];
};

/** Ein Teil eines Textes öffnen — über den Zeichnenden oder eine offene Bibliothek. */
export async function openPart(look: Lookup | undefined, partId: string): Promise<LibEntry | null> {
  const viaLook = look?.heavy === undefined ? null : await look.heavy(partId).catch(() => null);
  if (viaLook !== null) return viaLook;
  const home = loadedStores().find((s) => s.ownsHeavy(partId));
  return home === undefined ? null : home.heavy(partId).catch(() => null);
}

/** Ein `Lookup` für ein Werk, wenn der Zeichnende keinen hat (ein Feld in Nauka): seine Bibliothek. */
export const workLook = (workId: string): LibraryStore | undefined => loadedStores().find((s) => s.own(workId) !== undefined);

/** Wo steht die Stelle im Text — `null`: kein Text dieses Werks erreichbar. */
export function placeFor(look: Lookup | undefined, workId: string, locator: string): TextLink | null {
  const base = look ?? workLook(workId);
  if (base === undefined) return null;
  return textPlace(base, finderOf(base), workId, locator);
}
