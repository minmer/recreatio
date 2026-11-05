/**
 * DIE KÄSTEN NEBEN EINEM TEXT (Skryptorium, 2026-10-23 aus
 * `library/LibraryEntryBoxes.tsx`): LaTeX — der Text, das Projekt als Buch,
 * „Plan na ambonę" — und eine Powtórka aus dem Text.
 */

import { useState } from 'react';

import { useT } from '../core/i18n';
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
  const t = useT();
  const [shown, setShown] = useState(false);
  const [author, setAuthor] = useRemembered('library.latex.author', '');
  const missing = entry.kind === 'text' ? missingKeys(entry, store) : [];
  const source = () => (entry.kind === 'project'
    ? projectToLatex(entry, store, { author })
    : textToLatex(entry, store, { author }));

  return (
    <section className="lib-box">
      <h2 className="lib-box-h">LaTeX</h2>{/* i18n-ignore — ein Name */}
      <p className="wk-hint">{entry.kind === 'project' ? t('scriptorium.boxes.latexProject') : t('scriptorium.boxes.latexText')}</p>
      <label className="wk-field">
        <span>{t('scriptorium.boxes.author')}</span>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={t('scriptorium.boxes.authorPlaceholder')} />
      </label>
      {missing.length > 0 && <p className="wk-warn">{t('scriptorium.boxes.missing', { keys: missing.map((k) => `@${k}`).join(', ') })}</p>}
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => void saveBlob(new Blob([source()], { type: 'application/x-tex' }), latexFileName(entry))}>{t('scriptorium.boxes.download')}</button>
        <button type="button" className="wk-link-btn" onClick={() => setShown((was) => !was)}>{shown ? t('scriptorium.boxes.hidePreview') : t('common.preview')}</button>
        <button type="button" className="wk-link-btn" onClick={() => void navigator.clipboard?.writeText(source())}>{t('common.copy')}</button>
      </div>
      {entry.kind === 'text' && planOf(entry.data).length > 0 && (
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-line" onClick={() => void saveBlob(new Blob([planToLatex(entry, store)], { type: 'application/x-tex' }), latexFileName(entry, '-plan'))}>
            {t('scriptorium.boxes.pulpit')}
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
  const t = useT();
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
      setFailed(e instanceof Error ? e.message : t('scriptorium.boxes.learnFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="lib-box">
      <h2 className="lib-box-h">{t('scriptorium.boxes.learn')}</h2>
      <p className="lib-meta">{t('scriptorium.boxes.learnLead')}</p>
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-line" disabled={busy || me == null} onClick={() => void make()}>{busy ? t('scriptorium.boxes.creating') : t('scriptorium.boxes.learnButton')}</button>
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}
