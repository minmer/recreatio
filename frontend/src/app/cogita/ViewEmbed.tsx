/**
 * EIN WIDOK IM TEXT (2026-10-22, Schritt 11) — `![@<widok>]` in einem Punkt des
 * Plans (oder im Text) eines Kazanie zeigt, was der Widok JETZT wählt: „wszystkie
 * psalmy jutrzni niedzielnej" ändert sich, wenn sich der Psałterz ändert. Die
 * Baza wird so geöffnet, wie dieser Leser sie lesen darf (`pageBase.ts`) —
 * auf einer öffentlichen Seite ohne Konto, im Arbeitsbereich als Mitglied;
 * eine Änderung in Nauka (derselbe Tab) holt den neuen Stand gleich nach.
 */

import { useEffect } from 'react';

import { loadedStores } from '../library/libraryStore';
import { UNREADABLE } from '../library/libraryMarkup';
import { usePageBase } from './pageBase';
import { readView, viewList } from './views';
import { Loading } from '../ui/Loading';

export function ViewEmbed({ viewId, libraryId }: { viewId: string; libraryId: string }) {
  const { lib } = usePageBase(libraryId);
  /* Lebendig: ändert jemand die Baza in diesem Tab (Nauka), holt der Widok den Stand vom Dienst nach. */
  useEffect(() => {
    if (lib == null) return undefined;
    const local = loadedStores().find((s) => s.libraryId === libraryId && s !== lib.store);
    return local?.subscribe(() => { void lib.store.sync().catch(() => undefined); });
  }, [lib, libraryId]);

  if (lib === undefined) return <Loading lines={1} />;
  const doc = lib === null ? undefined : lib.docs('view').find((e) => e.id === viewId);
  if (lib === null || doc === undefined) return <p className="lib-missing">{UNREADABLE}</p>;
  const view = readView(doc.data);
  const list = viewList(lib, view);
  return (
    <figure className="lib-embed lib-view-embed">
      <figcaption>{view.name} <span className="cg-muted">({list.length})</span></figcaption>
      {list.length === 0 ? <p className="cg-muted">(nic)</p> : (
        <ul>{list.slice(0, 80).map((e) => <li key={e.id}>{lib.label(e)}</li>)}</ul>
      )}
    </figure>
  );
}
