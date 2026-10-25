/**
 * „W WIEDZY" AN EINEM WERK (2026-10-25, Wywód) — die Wejścia z Biblioteki (`cogita/anchors.ts`),
 * die auf dieses Werk zeigen: gefunden im Verzeichnis der Verweise (`refIndex.ts`) über die
 * Speicher, die dieser Tab ohnehin offen hat — also nur in Bazy wiedzy, die dieser Leser lesen
 * kann. Die Bibliothek speichert davon nichts; ein Leser ohne Zugang zur Baza sieht nichts, auch
 * nicht, dass es sie gibt.
 *
 * Geordnet nach der Stelle im Werk (das ganze Werk zuerst). Eine Stelle der Struktur (ein Artikel,
 * ein Vers, ein Kapitel) gilt in jeder Ausgabe; ein Wejście an einer anderen Ausgabe desselben
 * Werks erscheint daher auch hier — mit dem Namen jener Ausgabe —, eines mit Seiten nicht.
 */

import { anchorPath, readAnchor, type Anchor } from '../cogita/anchors';
import { openedLibraryNames } from './library';
import type { LibEntry, Lookup } from './libraryKinds';
import { overlap, pagesOverlap, parsePlace, placeSortKey, workOptions, workScheme, type Place } from './locations';
import { loadedStores, type LibraryStore } from './libraryStore';
import { isBooksStore } from './refLabels';
import { referenceIndex } from './refIndex';
import { editionsOf } from './sourceText';

export interface AnchorHit {
  readonly anchor: Anchor;
  /** Die Baza wiedzy, in der das Wejście liegt. */
  readonly libraryId: string;
  readonly baseName: string;
  readonly href: string;
  /** Die Stelle im Układ des Werks (leer: das ganze Werk). */
  readonly place: Place | null;
  /** Eine andere Ausgabe, an der das Wejście hängt — sonst `undefined`. */
  readonly edition?: LibEntry;
}

/** Die Wejścia an einem Werk (und an seinen anderen Ausgaben, soweit ihre Stelle der Struktur gilt). */
export function anchorsForWork(work: LibEntry, look: Lookup, stores: readonly Pick<LibraryStore, 'libraryId' | 'revision' | 'all' | 'ownByKey'>[] = loadedStores(), books: (store: Pick<LibraryStore, 'libraryId'>) => boolean = isBooksStore): AnchorHit[] {
  const index = referenceIndex(stores, books);
  const scheme = workScheme(work.data);
  const options = workOptions(work.data);
  const names = openedLibraryNames();
  const editions = editionsOf(look, work);
  const out: AnchorHit[] = [];
  const seen = new Set<string>();
  for (const target of [work, ...editions]) {
    for (const hit of index.to(target.id)) {
      if (hit.from.kind !== 'anchor' || books(hit.store) || seen.has(hit.from.id)) continue;
      const anchor = readAnchor(hit.from.id, hit.from.data);
      if (anchor.work !== target.id) continue;
      const place = anchor.locator === '' ? null : parsePlace(anchor.locator, scheme, options);
      /* An einer anderen Ausgabe: nur das ganze Werk oder eine Stelle der Struktur (Seiten gehören einer Ausgabe). */
      if (target.id !== work.id && place !== null && place.spans.length === 0) continue;
      seen.add(hit.from.id);
      out.push({
        anchor, libraryId: hit.store.libraryId, baseName: names.get(hit.store.libraryId) ?? 'Baza wiedzy',
        href: anchorPath(hit.store.libraryId, anchor), place, ...(target.id === work.id ? {} : { edition: target })
      });
    }
  }
  /* Nach dem Anfang; bei gleichem Anfang das Grössere zuerst (das Ganze vor seinen Teilen); dann nach dem Namen. */
  return out.sort((a, b) => {
    const ka = a.place === null ? '' : placeSortKey(a.place);
    const kb = b.place === null ? '' : placeSortKey(b.place);
    if (ka !== kb) return ka < kb ? -1 : 1;
    const ea = endOf(a.place);
    const eb = endOf(b.place);
    if (ea !== eb) return ea > eb ? -1 : 1;
    return a.anchor.name.localeCompare(b.anchor.name, 'pl', { numeric: true });
  });
}

/** Wo das erste Stück einer Stelle endet — als Schlüssel zum Vergleichen (Seiten oder Pfad der Struktur). */
function endOf(place: Place | null): string {
  if (place === null) return '~';
  const pad = (n: number | null) => (n === null ? '999999' : String(Math.max(0, n + 20000)).padStart(6, '0'));
  if (place.spans.length > 0) return place.spans[0]!.to.map(pad).join('.');
  if (place.pages.length > 0) return pad(place.pages[0]!.to);
  return '';
}

/**
 * Die Wejścia, die einen Teil des Textes berühren (im Czytnik): das ganze Werk immer, sonst wo
 * sich die Stellen überschneiden — Struktur mit Struktur, Seiten mit Seiten.
 */
export function anchorsTouching(hits: readonly AnchorHit[], range: { readonly place: Place | null; readonly pages?: readonly [number, number] }): AnchorHit[] {
  return hits.filter((h) => {
    if (h.place === null) return true;
    const spans = range.place?.spans ?? [];
    if (h.place.spans.length > 0 && spans.length > 0) return h.place.spans.some((a) => spans.some((b) => overlap(a, b)));
    if (h.place.pages.length > 0 && range.pages !== undefined) return h.place.pages.some((p) => pagesOverlap(p, { from: range.pages![0], to: range.pages![1] }));
    return false;
  });
}
