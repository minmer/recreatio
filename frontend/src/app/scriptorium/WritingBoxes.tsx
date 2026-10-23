/**
 * DIE KÄSTEN NEBEN EINEM TEXT (Skryptorium, 2026-10-23 aus
 * `library/LibraryEntryBoxes.tsx`): LaTeX — der Text, das Projekt als Buch,
 * „Plan na ambonę" — und eine Powtórka aus dem Text.
 */

import { useState } from 'react';

import { saveBlob } from '../core/platform';
import { useRemembered } from '../core/prefs';
import { viewPath } from '../routes';
import type { OpenLibrary } from '../library/library';
import { type LibEntry, entryTitle } from '../library/libraryKinds';
import type { LibraryStore } from '../library/libraryStore';
import { useMe, useWho } from '../core/me';
import { latexFileName, missingKeys, planToLatex, projectToLatex, textToLatex } from './latex';
import { planOf } from './sermon';

/* -- LaTeX (Druck) ------------------------------------------------------------------------------- */

/**
 * DRUCKEN HEISST LaTeX. Ein Text (oder ein ganzes Projekt als Buch) als
 * `.tex`: Fussnoten mit den Quellen, Zitate mit Herkunft, Źródła am Ende —
 * dasselbe, was die Seite zeigt, für `pdflatex` (`libraryLatex.ts`).
 */
export function LatexBox({ store, entry }: { store: LibraryStore; entry: LibEntry }) {
  const [shown, setShown] = useState(false);
  const [author, setAuthor] = useRemembered('library.latex.author', '');
  const missing = entry.kind === 'text' ? missingKeys(entry, store) : [];
  const source = () => (entry.kind === 'project'
    ? projectToLatex(entry, store, { author })
    : textToLatex(entry, store, { author }));

  return (
    <section className="lib-box">
      <h2 className="lib-box-h">LaTeX</h2>
      <p className="wk-hint">{entry.kind === 'project' ? 'Cały projekt jako książka: części, rozdziały, przypisy, źródła na końcu.' : 'Tekst do druku: przypisy ze źródłami, cytaty, źródła na końcu.'}</p>
      <label className="wk-field">
        <span>Autor (na stronie tytułowej)</span>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="np. ks. Jan Kowalski" />
      </label>
      {missing.length > 0 && <p className="wk-warn">Brakuje w bibliotece: {missing.map((k) => `@${k}`).join(', ')} — w przypisie stanie „[brak źródła]".</p>}
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => void saveBlob(new Blob([source()], { type: 'application/x-tex' }), latexFileName(entry))}>Pobierz .tex</button>
        <button type="button" className="wk-link-btn" onClick={() => setShown((was) => !was)}>{shown ? 'Ukryj podgląd' : 'Podgląd'}</button>
        <button type="button" className="wk-link-btn" onClick={() => void navigator.clipboard?.writeText(source())}>Kopiuj</button>
      </div>
      {entry.kind === 'text' && planOf(entry.data).length > 0 && (
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-line" onClick={() => void saveBlob(new Blob([planToLatex(entry, store)], { type: 'application/x-tex' }), latexFileName(entry, '-plan'))}>
            Plan na ambonę (.tex)
          </button>
        </div>
      )}
      {shown && <pre className="lib-latex">{source()}</pre>}
    </section>
  );
}

/* -- Nauka (Schritt 11) ------------------------------------------------------------------------------ */

/**
 * 2026-10-22 (Schritt 11) — EINE POWTÓRKA AUS DIESEM TEXT: die Karten dessen,
 * worauf er verweist (Cytaty, Komentarze, Słowa, Stellen des Plans), in einer
 * Baza wiedzy, die diese Bibliothek als Quelle nennt (`cogita/fromEntry.ts`,
 * erst bei Bedarf geladen).
 */
export function LearnBox({ library, entry }: { library: OpenLibrary; entry: LibEntry }) {
  const me = useMe(useWho());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const make = async () => {
    if (me == null) return;
    setBusy(true);
    setFailed(null);
    try {
      const { revisionFromEntry } = await import('../cogita/fromEntry');
      const done = await revisionFromEntry(me.ring, library.libraryId, entry.id, entryTitle(entry, { get: () => undefined, byKey: () => undefined }));
      window.location.hash = viewPath('learn', done.baseId, 'powtorki', done.revisionId);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Nie udało się utworzyć powtórki.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="lib-box">
      <h2 className="lib-box-h">Nauka</h2>
      <p className="lib-meta">Powtórka z tego, na co wskazuje tekst: cytaty, komentarze, słowa ze słownika, miejsca z planu — w bazie wiedzy, która korzysta z tego skryptorium.</p>
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-line" disabled={busy || me == null} onClick={() => void make()}>{busy ? 'Tworzenie…' : 'Powtórka z tego tekstu'}</button>
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}
