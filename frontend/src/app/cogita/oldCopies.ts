/**
 * STARE KOPIE PUBLIKACJI (2026-10-22, Schritt 8 — seit 2026-10-23 ohne
 * Porządki, direkt in „Kto czyta" der Baza).
 *
 * Bis 2026-10-22 stellte eine Baza wiedzy einzelne Bündel hinaus: eine
 * Abschrift in `data.public` (im versiegelten Eintrag), beim Dienst eine
 * offene Fassung (`published_*`) und offene Kopien der Dateien. Jetzt liest
 * eine Baza, wer ihren Bereich liest. Die Kopien sind übrig:
 *
 * <code>
 *   offene Fassung beim Dienst   zurückziehen — der Eintrag bleibt
 *   data.public im Eintrag       herausnehmen — nur, wenn alles, was die Abschrift
 *                                zeigt, noch in der Baza (oder ihren Quellen) steht;
 *                                sonst bleibt sie, und es wird gesagt, was fehlt
 *   offene Kopie einer Datei     zurückziehen — die versiegelte Datei bleibt
 * </code>
 *
 * Eine Abschrift kann Inhalt aus einer Quelle in einem anderen Bereich
 * tragen. Darum öffnet „Kto czyta" keine Baza, solange einer ihrer Einträge
 * noch eine trägt (`hasOldCopies`) — sonst läse jeder diese Abschrift mit.
 */

import type { EntryData, LibEntry } from '../library/libraryKinds';
import type { LibraryStore } from '../library/libraryStore';
import { loadFiles, unpublishFile } from './files';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Trägt der Eintrag noch eine Abschrift aus der Zeit des Veröffentlichens? */
export const oldCopyOf = (entry: Pick<LibEntry, 'data'>): Record<string, unknown> | null => (isObject(entry.data.public) ? entry.data.public : null);

/** Trägt die Baza noch Abschriften? Dann öffnet „Kto czyta" sie nicht. */
export const hasOldCopies = (store: Pick<LibraryStore, 'all'>): boolean => store.all().some((e) => oldCopyOf(e) !== null);

/** Hat die Baza noch etwas aus der Zeit des Veröffentlichens (Abschriften oder offene Fassungen)? */
export const hasOldPublications = (store: Pick<LibraryStore, 'all'>): boolean =>
  store.all().some((e) => oldCopyOf(e) !== null || e.publishedAs !== null);

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Was eine Abschrift zeigt, das es nicht mehr gibt: Kennungen von Einträgen
 * (Erklärungen, Einträge eines Przebiegs, Karten), die weder in der Baza noch
 * in einer geladenen Quelle stehen. Dateien zählen nicht (sie bleiben versiegelt).
 */
export function missingIn(copy: Record<string, unknown>, known: (id: string) => boolean): string[] {
  const wanted = new Set<string>();
  const take = (value: unknown) => { for (const id of JSON.stringify(value ?? null).match(UUID) ?? []) wanted.add(id.toLowerCase()); };
  if (isObject(copy.entity)) take(copy.entity.id);
  if (isObject(copy.explain)) Object.keys(copy.explain).forEach(take);
  if (isObject(copy.entities)) Object.keys(copy.entities).forEach(take);
  if (Array.isArray(copy.cards)) for (const card of copy.cards) if (isObject(card)) { take(card.entity); take(card.question); }
  return [...wanted].filter((id) => !known(id));
}

/** Der Eintrag ohne die Abschrift. */
export function withoutCopy(data: EntryData): EntryData {
  const { public: _gone, ...rest } = data;
  return rest;
}

/** Was „Wycofaj stare kopie" getan hat — und was blieb. */
export interface OldCopiesReport {
  readonly withdrawn: number;
  readonly stripped: number;
  readonly files: number;
  /** Abschriften, die bleiben: sie zeigen Einträge, die es nicht mehr gibt. */
  readonly kept: readonly { readonly id: string; readonly missing: number }[];
  readonly failedFiles: number;
}

type Store = Pick<LibraryStore, 'all' | 'get' | 'withdraw' | 'save'>;

/**
 * Alles aus der Zeit des Veröffentlichens zurücknehmen, das ohne Verlust
 * geht. `known` sagt, ob es einen Eintrag (in der Baza oder einer Quelle)
 * noch gibt; `files` zieht die offenen Kopien der Dateien zurück (in der
 * Prüfung ohne Dienst: weglassen).
 */
export async function withdrawOldCopies(
  store: Store,
  known: (id: string) => boolean,
  files?: { libraryId: string } | null
): Promise<OldCopiesReport> {
  const published = store.all().filter((e) => e.publishedAs !== null).map((e) => e.id);
  if (published.length > 0) await store.withdraw(published);
  let stripped = 0;
  const kept: { id: string; missing: number }[] = [];
  for (const entry of store.all()) {
    const copy = oldCopyOf(entry);
    if (copy === null) continue;
    const missing = missingIn(copy, known);
    if (missing.length > 0) { kept.push({ id: entry.id, missing: missing.length }); continue; }
    const now = store.get(entry.id) ?? entry;
    await store.save({ id: now.id, kind: now.kind, ...(now.key === undefined ? {} : { key: now.key }), data: withoutCopy(now.data) });
    stripped += 1;
  }
  let done = 0;
  let failedFiles = 0;
  if (files != null) {
    const open = (await loadFiles(files.libraryId).catch(() => ({ files: [] }))).files.filter((f) => f.publicAt !== null);
    for (const f of open) {
      if ((await unpublishFile(files.libraryId, f.fileId).catch(() => ({ unpublished: false }))).unpublished) done += 1;
      else failedFiles += 1;
    }
  }
  return { withdrawn: published.length, stripped, files: done, kept, failedFiles };
}

/** Der Bericht in einem Satz. */
export function oldCopiesLine(report: OldCopiesReport): string {
  const parts = [`Wycofane stare kopie publiczne: ${report.withdrawn}`, `usunięte kopie we wpisach: ${report.stripped}`, `wycofane kopie plików: ${report.files}`];
  const more: string[] = [];
  if (report.kept.length > 0) more.push(`Zostało kopii: ${report.kept.length} — pokazują wpisy, których w bazie już nie ma (przywróć je z historii wpisu albo zachowaj kopię; dopóki jest, tej bazy nie da się otworzyć dla wszystkich).`);
  if (report.failedFiles > 0) more.push(`Nie udało się wycofać plików: ${report.failedFiles} — spróbuj jeszcze raz.`);
  return [`${parts.join(', ')}.`, ...more].join(' ');
}
