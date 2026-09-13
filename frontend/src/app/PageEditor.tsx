/**
 * Was unter einer übernommenen Adresse steht — ändern.
 *
 * <b>Klartext, und das ist Absicht.</b> Alles andere im Arbeitsplatz ist
 * versiegelt; diese zwei Felder sind es nicht, weil sie ohne Konto ausgeliefert
 * werden. Der Unterschied steht unter dem Formular — eine Oberfläche, die
 * überall dasselbe Schloss zeigt, lehrt niemanden, wo eines ist.
 *
 * <b>Schreiben darf die Rolle, die die Adresse führt.</b> Der Dienst prüft das;
 * hier wird es nicht noch einmal nachgebaut, sondern seine Antwort angezeigt.
 * Zwei Rechteprüfungen wären zwei Meinungen, und die des Browsers zählt nicht.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadPage, savePage } from './page';
import { pagePath } from './routes';
import { WorkspaceError } from './session';

export function PageEditor({ path }: { path: string }) {
  const [title, setTitle] = useState('');
  const [lead, setLead] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const look = useCallback(async () => {
    setReady(false);
    setFailed(null);

    try {
      const page = await loadPage(path);
      setTitle(page.title ?? '');
      setLead(page.lead ?? '');
    } catch {
      // Eine Adresse ohne Seite ist der Normalfall beim ersten Mal — kein
      // Fehler, sondern ein leeres Formular.
      setTitle('');
      setLead('');
    } finally {
      setReady(true);
    }
  }, [path]);

  useEffect(() => { void look(); }, [look]);

  const go = async () => {
    setBusy(true);
    setFailed(null);
    setSaved(false);

    try {
      await savePage(path, { title: title.trim(), lead: lead.trim() === '' ? null : lead.trim() });
      setSaved(true);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <p className="wk-hint">Wczytywanie strony…</p>;

  return (
    <form
      className="wk-form wk-page-form"
      onSubmit={(e) => { e.preventDefault(); if (!busy && title.trim() !== '') void go(); }}
    >
      <h3 className="wk-h2">recreatio.pl/{path}</h3>

      <label className="wk-field">
        <span>Tytuł</span>
        <input value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} />
      </label>

      <label className="wk-field">
        <span>Tekst</span>
        <textarea
          rows={5}
          value={lead}
          onChange={(e) => { setLead(e.target.value); setSaved(false); }}
        />
      </label>

      <p className="wk-hint">
        Ta strona jest publiczna — tytuł i tekst idą do usługi otwartym tekstem,
        bo czyta je każdy, kto wejdzie pod ten adres.
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {saved && <p className="wk-done">Zapisane.</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || title.trim() === ''}>
          {busy ? 'Zapisywanie…' : 'Zapisz'}
        </button>

        <a className="wk-link" href={pagePath(path)}>Zobacz stronę</a>

        {title.trim() === '' && !busy && <span className="wk-blocker">Wpisz tytuł.</span>}
      </div>
    </form>
  );
}

export default PageEditor;
