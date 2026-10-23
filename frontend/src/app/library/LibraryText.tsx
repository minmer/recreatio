/**
 * EIN ZITAT, GEZEICHNET (0064) — mit Herkunft. Der Text (mit Fussnoten, Plan
 * und Wygłoszenia) steht seit 2026-10-23 im Skryptorium:
 * `scriptorium/TextArticle.tsx`.
 *
 * Was folgt, galt dem Text und gilt dort weiter:
 *
 * <b>Dieselbe Zeichnung im Editor und auf der Seite.</b> Der Editor reicht
 * seinen Speicher als `Lookup` herein, die Seite den Speicher, den sie für
 * diesen Leser geöffnet hat (`libraryOpen.ts`). Was der Leser sieht, sieht
 * der Schreibende schon beim Tippen — soweit der Leser es lesen darf.
 *
 * <b>2026-10-21 — ein Kazanie:</b> über der Treść die Wygłoszenia (mit
 * Player) und der Plan; wer ein Wygłoszenie wählt, sieht auf dem Plan, was
 * diesmal gesagt, nur gestreift, ausgelassen wurde und was dazukam. Ein Text
 * ohne Plan und ohne Wygłoszenia sieht aus wie bisher. Die Bausteine des
 * Zapis stehen in `markupView.tsx`, der Plan und die Wygłoszenia in
 * `SermonParts.tsx`.
 */

import { originOf } from './libraryCite';
import { str, type LibEntry, type Lookup } from './libraryKinds';
import { QuoteBody } from './markupView';

/** Ein Zitat mit Herkunft — in der Sammlung, in der Bibliothek. (2026-10-23: Komentarze über ein Zitat stehen in Nauka; „Powiązania" nennt sie.) */
export function QuoteFigure({ entry, look }: { entry: LibEntry; look: Lookup; full?: boolean }) {
  const d = entry.data;
  return (
    <figure className="lib-quote">
      <blockquote><QuoteBody text={str(d, 'text')} /></blockquote>
      {str(d, 'translation') !== '' && <p className="lib-embed-translation">{str(d, 'translation')}</p>}
      <figcaption>— {originOf(entry, look)}</figcaption>
    </figure>
  );
}
