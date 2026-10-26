/**
 * KTO WIDZI TEN WPIS (2026-10-22) — an Stelle von „Opublikuj".
 *
 * Wer einen Eintrag liest, entscheidet allein der Bereich seiner Bibliothek:
 * seine Mitglieder, und ist er öffentlich, jeder. Öffentlich wird ein Eintrag,
 * indem man ihn in die Bibliothek eines öffentlichen Bereichs trägt (und
 * privat, indem man ihn in die eines privaten trägt) — die Kennung bleibt,
 * jeder Verweis zeigt weiter auf ihn.
 *
 * 2026-10-23 — ebenso im Skryptorium: ein Text zieht in ein anderes
 * Skryptorium (nie zwischen den Teilen). Sein Rodzaj tekstu kann mitgehen —
 * sonst sehen Leser des neuen Skryptorium seine eigenen Felder nicht.
 */

import { useState } from 'react';

import { useMe, useWho } from '../core/me';
import { toast } from '../ui/dialogs';
import { WorkspaceError } from '../core/session';
import { viewPath } from '../routes';
import { libraryKindOf, partOf, type OpenLibrary } from './library';
import { fieldRefs, ids, str } from './libraryKinds';
import { filesOf, tracksOf } from './music';
import { useLibraries } from './LibraryPick';
import { storeOf, type Entry, type LibraryStore } from './libraryStore';

/** Wer eine Bibliothek liest — in Worten. */
export function audienceWords(library: Pick<OpenLibrary, 'areaPublic' | 'areaRuleAt'>): string {
  if (library.areaPublic !== true) return 'członkowie jej obszaru';
  if (library.areaRuleAt == null) return 'członkowie obszaru — obszar jest publiczny, ale biblioteka czeka na potwierdzenie w Ustawieniach';
  return 'wszyscy — obszar jest publiczny';
}

export function AreaBox({ store, library, entry, readOnly }: { store: LibraryStore; library: OpenLibrary; entry: Entry; readOnly: boolean }) {
  const me = useMe(useWho());
  const libraries = useLibraries();
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [withType, setWithType] = useState(false);
  const writing = libraryKindOf(library) === 'writing';
  const noun = writing ? 'skryptorium' : 'biblioteki';

  /* Nur in einen Behälter derselben Art: Bibliothek zu Bibliothek, Skryptorium zu Skryptorium. */
  const others = (libraries ?? []).filter((l) => l.libraryId !== library.libraryId && l.writes && libraryKindOf(l) === libraryKindOf(library));
  const chosen = others.find((l) => l.libraryId === target);
  /* Was er nennt und was auf ihn zeigt, aber drüben niemand lesen könnte, der nur den neuen Bereich sieht. */
  const refs = fieldRefs(entry).length;
  const back = store.backlinks(entry.id).length;
  const files = [...tracksOf(entry.data), ...filesOf(entry.data)].filter((f) => f.file !== null).length;
  /* Ein Text eines Rodzaju, der hier liegt: er kann mitgehen. */
  const type = entry.kind === 'text' ? store.own(ids(entry.data, 'textType')[0] ?? '') : undefined;
  const typeHere = type !== undefined && type.kind === 'texttype';

  const move = async () => {
    if (chosen === undefined || me == null) return;
    setBusy(true);
    setFailed(null);
    try {
      const there = storeOf(me.ring, chosen);
      await there.sync();
      if (typeHere && withType && type !== undefined) await store.moveTo(type.id, there);
      const moved = await store.moveTo(entry.id, there);
      if (moved.keyChanged) {
        /* 2026-10-22 — drüben war der Schlüssel vergeben: der neue gilt, der alte bleibt als zweiter, und Texte zeigen über die Kennung. */
        toast(`Tam klucz „${moved.from ?? ''}” był już zajęty — wpis ma teraz klucz „${moved.entry.key ?? ''}”. Stary zostaje przy wpisie, a teksty wskazują go stałym odnośnikiem, więc nic się nie zepsuło.`);
      }
      window.location.hash = viewPath(partOf(chosen), chosen.libraryId, entry.id);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się przenieść.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="lib-box">
      <h2 className="lib-box-h">Kto widzi</h2>
      <p>{writing ? 'Skryptorium' : 'Biblioteka'} „{library.name}”: {audienceWords(library)}.</p>
      {!readOnly && others.length > 0 && (
        <details className="wk-fold">
          <summary>Przenieś do innego {noun}</summary>
          <p className="lib-cm-lede">Wpis zachowuje swoją kennung — odwołania i osadzenia dalej działają. Zobaczą go ci, którzy widzą tamto {writing ? 'skryptorium' : 'miejsce'}.{writing ? ' Tak tekst staje się publiczny: w skryptorium obszaru publicznego.' : ''}</p>
          <select value={target} disabled={busy} aria-label={writing ? 'Skryptorium docelowe' : 'Biblioteka docelowa'} onChange={(e) => setTarget(e.target.value)}>
            <option value="">{writing ? '— wybierz skryptorium —' : '— wybierz bibliotekę —'}</option>
            {others.map((l) => <option key={l.libraryId} value={l.libraryId}>{l.name} — {l.areaPublic === true ? 'publiczna' : 'dla członków obszaru'}</option>)}
          </select>
          {chosen !== undefined && (
            <>
              <p>Po przeniesieniu: {audienceWords(chosen)}.</p>
              {typeHere && type !== undefined && (
                <label className="pe-check">
                  <input type="checkbox" checked={withType} disabled={busy} onChange={(e) => setWithType(e.target.checked)} />
                  <span>Przenieś też rodzaj tekstu „{str(type.data, 'name')}” — bez niego czytelnicy tamtego skryptorium nie zobaczą pól tego rodzaju (inne teksty tego rodzaju dalej z niego korzystają).</span>
                </label>
              )}
              {/* 2026-10-26 — die Dateien der Musik gehen mit: drüben neu versiegelt, hier danach entfernt. */}
              {files > 0 && <p>Pliki ({files}) przejdą razem z wpisem — zaszyfrowane kluczem tamtego obszaru; to może chwilę potrwać.</p>}
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
