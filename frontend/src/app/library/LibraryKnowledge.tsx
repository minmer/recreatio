/**
 * „W WIEDZY" — DIE KNÖPFE AN EINEM WERK (2026-10-25, Wywód). Was eine Baza wiedzy über dieses Werk
 * erklärt (ein Wejście z Biblioteki: das Werk ganz oder in Teilen → ein Eintrag in einem Widok),
 * steht hier als Knopf — gerechnet aus dem, was dieser Tab offen hat (`anchorHits.ts`), nie
 * gespeichert. Wer die Baza nicht lesen kann, sieht nichts.
 *
 * <code>
 *   KnowledgeBox    der Kasten neben den Feldern (vor „Powiązania"), nach Bazy geordnet
 *   KnowledgeLine   eine Zeile unter dem Titel, wo die Kästen unter die Felder rutschen (Telefon)
 *   ReaderAnchors   im Czytnik: die Wejścia, die den gelesenen Teil berühren
 * </code>
 */

import { useMemo, useState } from 'react';
import { plural } from '../core/plural';

import { anchorsForWork, anchorsTouching, type AnchorHit } from './anchorHits';
import { kindOf, type LibEntry } from './libraryKinds';
import { formatPlace, parsePlace, type SchemeId } from './locations';
import { loadedStores, type LibraryStore } from './libraryStore';
import type { ManifestPart } from './sourceText';

const FIRST = 8;

/** Die Wejścia an einem Werk — neu gerechnet, wenn sich ein offener Speicher ändert, nicht bei jedem Tastendruck im Formular. */
function useAnchors(work: LibEntry, store: LibraryStore): AnchorHit[] {
  const stamp = loadedStores().map((s) => `${s.libraryId}:${s.revision}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => anchorsForWork(work, store), [work.id, work.data, store, stamp]);
}

/** Wo das Wejście im Werk liegt — „s. 45–60", „I, q. 2, a. 3", „całe dzieło"; an einer anderen Ausgabe mit deren Namen. */
function whereOf(hit: AnchorHit, store: LibraryStore): string {
  const place = hit.place === null ? 'całe dzieło' : formatPlace(hit.place, hit.anchor.locator);
  return hit.edition === undefined ? place : `${place} (w wydaniu: ${kindOf('work')!.title(hit.edition.data, store)})`;
}

export function KnowledgeBox({ store, work }: { store: LibraryStore; work: LibEntry }) {
  const [all, setAll] = useState(false);
  const hits = useAnchors(work, store);
  if (hits.length === 0) return null;
  const shown = all ? hits : hits.slice(0, FIRST);
  const bases = [...new Set(shown.map((h) => h.libraryId))];
  return (
    <section className="lib-box" id="lib-w-wiedzy" data-knowledge-box="">
      <h2 className="lib-box-h">W Wiedzy</h2>
      {bases.map((base) => (
        <div key={base}>
          <p className="lib-box-sub">{shown.find((h) => h.libraryId === base)?.baseName}</p>
          <ul className="lib-rel lib-knowledge">
            {shown.filter((h) => h.libraryId === base).map((h) => (
              <li key={h.anchor.id}>
                <a className="lib-knowledge-go" href={h.href}>{h.anchor.name}</a>
                <span className="lib-rel-where"> — {whereOf(h, store)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {hits.length > FIRST && <button type="button" className="wk-link-btn" onClick={() => setAll(!all)}>{all ? 'Pokaż mniej' : `Pokaż wszystkie (${hits.length})`}</button>}
    </section>
  );
}

/** Unter dem Titel, nur wo die Kästen unter die Felder rutschen: ein Wejście führt direkt hin, mehrere zum Kasten. */
export function KnowledgeLine({ store, work }: { store: LibraryStore; work: LibEntry }) {
  const hits = useAnchors(work, store);
  if (hits.length === 0) return null;
  if (hits.length === 1) return <p className="lib-knowledge-line"><a href={hits[0]!.href}>W Wiedzy: {hits[0]!.anchor.name} ›</a></p>;
  return (
    <p className="lib-knowledge-line">
      <button type="button" className="wk-link-btn" onClick={() => document.getElementById('lib-w-wiedzy')?.scrollIntoView({ block: 'start' })}>W Wiedzy: {hits.length} {plural(hits.length, 'wejście', 'wejścia', 'wejść')} ↓</button>
    </p>
  );
}

/** Im Czytnik: die Wejścia, die den gelesenen Teil berühren (das ganze Werk immer). */
export function ReaderAnchors({ store, work, part, scheme }: { store: LibraryStore; work: LibEntry; part: ManifestPart; scheme: SchemeId }) {
  const hits = useAnchors(work, store);
  if (hits.length === 0) return null;
  const first = part.first === undefined ? null : parsePlace(part.first, scheme);
  const last = part.last === undefined ? first : parsePlace(part.last, scheme);
  const from = first?.spans[0];
  const to = last?.spans.slice(-1)[0];
  const range = { place: from !== undefined && to !== undefined && first !== null ? { ...first, spans: [{ from: from.from, to: to.to }] } : null, ...(part.pages === undefined ? {} : { pages: part.pages }) };
  const touching = anchorsTouching(hits, range);
  if (touching.length === 0) return null;
  return (
    <p className="lib-knowledge-line is-reader" data-reader-anchors="">
      <span className="lib-rel-kind">W Wiedzy</span>
      {touching.map((h) => <a key={h.anchor.id} className="lib-knowledge-go" href={h.href} title={`${h.baseName} — ${whereOf(h, store)}`}>{h.anchor.name}</a>)}
    </p>
  );
}
