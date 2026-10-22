/**
 * KTO WIDZI TEN WPIS (2026-10-22) — an Stelle von „Opublikuj".
 *
 * Wer einen Eintrag liest, entscheidet allein der Bereich seiner Bibliothek:
 * seine Mitglieder, und ist er öffentlich, jeder. Öffentlich wird ein Eintrag,
 * indem man ihn in die Bibliothek eines öffentlichen Bereichs trägt (und
 * privat, indem man ihn in die eines privaten trägt) — die Kennung bleibt,
 * jeder Verweis zeigt weiter auf ihn.
 */

import { useState } from 'react';

import { useMe, useWho } from '../core/me';
import { toast } from '../ui/dialogs';
import { WorkspaceError } from '../core/session';
import { viewPath } from '../routes';
import { libraryKindOf, type OpenLibrary } from './library';
import { fieldRefs } from './libraryKinds';
import { useLibraries } from './LibraryPick';
import { storeOf, type Entry, type LibraryStore } from './libraryStore';

/** Wer eine Bibliothek liest — in Worten. */
export function audienceWords(library: Pick<OpenLibrary, 'areaPublic' | 'areaRuleAt'>): string {
  if (library.areaPublic !== true) return 'członkowie jej obszaru';
  if (library.areaRuleAt == null) return 'członkowie obszaru — obszar jest publiczny, ale biblioteka czeka na przegląd (Ustawienia → Porządki)';
  return 'wszyscy — obszar jest publiczny';
}

export function AreaBox({ store, library, entry, readOnly }: { store: LibraryStore; library: OpenLibrary; entry: Entry; readOnly: boolean }) {
  const me = useMe(useWho());
  const libraries = useLibraries();
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const others = (libraries ?? []).filter((l) => l.libraryId !== library.libraryId && l.writes && libraryKindOf(l) === 'books');
  const chosen = others.find((l) => l.libraryId === target);
  /* Was er nennt und was auf ihn zeigt, aber drüben niemand lesen könnte, der nur den neuen Bereich sieht. */
  const refs = fieldRefs(entry).length;
  const back = store.backlinks(entry.id).length;

  const move = async () => {
    if (chosen === undefined || me == null) return;
    setBusy(true);
    setFailed(null);
    try {
      const there = storeOf(me.ring, chosen);
      await there.sync();
      const moved = await store.moveTo(entry.id, there);
      if (moved.keyChanged) {
        /* 2026-10-22 — drüben war der Schlüssel vergeben: der neue gilt, der alte bleibt als zweiter, und Texte zeigen über die Kennung. */
        toast(`W tamtej bibliotece klucz „${moved.from ?? ''}” był już zajęty — wpis ma teraz klucz „${moved.entry.key ?? ''}”. Stary zostaje przy wpisie, a teksty wskazują go stałym odnośnikiem, więc nic się nie zepsuło.`);
      }
      window.location.hash = viewPath('library', chosen.libraryId, entry.id);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się przenieść.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="lib-box">
      <h2 className="lib-box-h">Kto widzi</h2>
      <p>Biblioteka „{library.name}”: {audienceWords(library)}.</p>
      {!readOnly && others.length > 0 && (
        <details className="wk-fold">
          <summary>Przenieś do innej biblioteki</summary>
          <p className="lib-cm-lede">Wpis zachowuje swoją kennung — odwołania i osadzenia dalej działają. Zobaczą go ci, którzy widzą tamtą bibliotekę.</p>
          <select value={target} disabled={busy} aria-label="Biblioteka docelowa" onChange={(e) => setTarget(e.target.value)}>
            <option value="">— wybierz bibliotekę —</option>
            {others.map((l) => <option key={l.libraryId} value={l.libraryId}>{l.name} — {l.areaPublic === true ? 'publiczna' : 'dla członków obszaru'}</option>)}
          </select>
          {chosen !== undefined && (
            <>
              <p>Po przeniesieniu: {audienceWords(chosen)}.</p>
              {(refs > 0 || back > 0) && (
                <p className="wk-warn">
                  Kto widzi tylko jedną z bibliotek, zobaczy w miejscu odwołania „[odwołanie niedostępne]” — bez tytułu i treści.
                  {refs > 0 ? ` Wpis odwołuje się do ${refs} innych.` : ''}{back > 0 ? ` Do niego odwołuje się ${back}.` : ''}
                </p>
              )}
              <div className="wk-actions">
                <button type="button" className="wk-btn" disabled={busy || me == null} onClick={() => void move()}>{busy ? 'Przenoszenie…' : `Przenieś do „${chosen.name}”`}</button>
              </div>
            </>
          )}
        </details>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}
