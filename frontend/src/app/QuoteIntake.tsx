/**
 * CYTATY Z TEJ KSIĄŻKI — auf der Seite eines Werks: was schon da ist (nach
 * Seiten), ein schnelles Feld für einen Satz, und der gewöhnliche Weg vom
 * Bleistift in die Bibliothek (`libraryQuotes.ts`):
 *
 *   1. die angestrichenen Seiten fotografieren und mit dem kopierten
 *      Polecenie in den eigenen Chat mit einer KI geben,
 *   2. das JSON, das zurückkommt, hier einfügen (oder als Datei laden),
 *   3. jedes Zitat prüfen, verbessern, abwählen,
 *   4. alle auf einmal speichern — mit diesem Buch als Quelle.
 *
 * Hier wird keine KI aufgerufen und kein Foto hochgeladen: die KI ist die
 * eigene, im eigenen Chat; herein kommt nur JSON.
 */

import { useMemo, useRef, useState } from 'react';

import type { OpenLibrary } from './library';
import { ids, str } from './libraryKinds';
import {
  exportQuotes, importQuotes, locatorOf, newTopics, pageNumber, planQuotes, quotesDescription, quotesPrompt,
  type MarkMode, type QuoteItem
} from './libraryQuotes';
import type { Entry, LibraryStore } from './libraryStore';
import { parseDocument } from './pageJson';
import { saveBlob } from './platform';
import { useRemembered } from './prefs';
import { viewPath } from './routes';
import { WorkspaceError } from './session';

const SHOWN = 6;

export function QuoteIntake({ store, library, work }: { store: LibraryStore; library: OpenLibrary; work: Entry }) {
  const quotes = useMemo(() => store.ofKind('quote').filter((q) => ids(q.data, 'work').includes(work.id))
    .sort((a, b) => pageNumber(str(a.data, 'locator')) - pageNumber(str(b.data, 'locator')) || a.createdAt.localeCompare(b.createdAt)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [store, store.revision, work.id]);
  const [all, setAll] = useState(false);
  const [intake, setIntake] = useState(false);

  return (
    <section className="lib-quotes-of" aria-labelledby="lib-quotes-of-h">
      <div className="lib-quotes-of-head">
        <h2 id="lib-quotes-of-h" className="wk-h2">Cytaty z tej książki <span className="lib-count">{quotes.length}</span></h2>
        {library.writes && !intake && <button type="button" className="wk-btn" onClick={() => setIntake(true)}>Import cytatów z JSON…</button>}
      </div>

      {quotes.length > 0 && (
        <ol className="lib-quote-rows">
          {(all ? quotes : quotes.slice(0, SHOWN)).map((q) => (
            <li key={q.id}>
              <span className="lib-quote-page">{str(q.data, 'locator') || '—'}</span>
              <a href={viewPath('library', library.libraryId, q.id)}>{clip(str(q.data, 'text'), 220)}</a>
            </li>
          ))}
        </ol>
      )}
      {quotes.length > SHOWN && <button type="button" className="wk-link-btn" onClick={() => setAll(!all)}>{all ? 'Pokaż mniej' : `Pokaż wszystkie (${quotes.length})`}</button>}

      {library.writes && <QuickQuote store={store} work={work} />}
      {library.writes && intake && <JsonIntake store={store} work={work} onClose={() => setIntake(false)} />}
    </section>
  );
}

const clip = (text: string, n: number): string => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
};

/* -- Ein Satz, schnell ------------------------------------------------------------------------ */

function QuickQuote({ store, work }: { store: LibraryStore; work: Entry }) {
  const [text, setText] = useState('');
  const [page, setPage] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement | null>(null);

  const add = async () => {
    if (text.trim() === '') return;
    setBusy(true);
    setFailed(null);
    try {
      const saved = await store.save({ kind: 'quote', data: { text: text.trim(), work: work.id, ...(page.trim() === '' ? {} : { locator: locatorOf(page, '') }) } });
      setText('');
      setSaid(`Dodano [@${saved.key ?? ''}].`);
      area.current?.focus();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać cytatu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="lib-quick-quote" onSubmit={(e) => { e.preventDefault(); void add(); }}>
      <label className="wk-field">
        <span>Nowy cytat</span>
        <textarea ref={area} rows={3} value={text} placeholder="Przepisz fragment… (Ctrl+Enter — dodaj)" onChange={(e) => { setText(e.target.value); setSaid(null); }}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void add(); } }} />
      </label>
      <label className="wk-field lib-quick-page">
        <span>Strona</span>
        <input value={page} inputMode="numeric" placeholder="np. 23" onChange={(e) => setPage(e.target.value)} />
      </label>
      <div className="wk-actions">
        <button type="submit" className="wk-btn wk-btn-line" disabled={busy || text.trim() === ''}>{busy ? 'Zapisywanie…' : 'Dodaj cytat'}</button>
        {said !== null && <span className="wk-done" role="status">{said}</span>}
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </form>
  );
}

/* -- Viele auf einmal: JSON aus dem eigenen Chat ---------------------------------------------------- */

function JsonIntake({ store, work, onClose }: { store: LibraryStore; work: Entry; onClose: () => void }) {
  const [mode, setMode] = useRemembered('library.quotes.mode', 'marked');
  const [pasted, setPasted] = useState('');
  const [items, setItems] = useState<readonly QuoteItem[] | null>(null);
  const [warnings, setWarnings] = useState<readonly string[]>([]);
  const [stage, setStage] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [createTopics, setCreateTopics] = useState(true);
  const file = useRef<HTMLInputElement | null>(null);

  const markMode: MarkMode = mode === 'whole' ? 'whole' : 'marked';
  const prompt = useMemo(() => quotesPrompt(work, store, markMode), [work, store, markMode]);

  const readPasted = (text: string) => {
    setPasted(text);
    setDone(null);
    const parsed = parseDocument(text);
    if (parsed === null) { setItems(null); setFailed(null); return; }
    if ('error' in parsed) { setFailed(`Nieprawidłowy JSON: ${parsed.error}`); setItems(null); return; }
    const planned = planQuotes(parsed.value, work, store);
    if ('error' in planned) { setFailed(planned.error); setItems(null); return; }
    setFailed(null);
    setItems(planned.items);
    setWarnings(planned.warnings);
  };

  const copy = (what: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => setCopied(what), () => setCopied(null));
  };

  const change = (n: number, patch: Partial<QuoteItem>) => setItems((was) => was?.map((i) => (i.n === n ? { ...i, ...patch } : i)) ?? null);

  const save = async () => {
    if (items === null) return;
    setFailed(null);
    setStage('Zapisywanie…');
    try {
      const result = await importQuotes(items, work, store, (input) => store.save(input), { createTopics, stage: setStage });
      setDone(`Zapisano ${result.saved} ${result.saved === 1 ? 'cytat' : result.saved < 5 && result.saved > 1 ? 'cytaty' : 'cytatów'}${result.topics > 0 ? `, nowe tematy: ${result.topics}` : ''}.`
        + (result.failed.length > 0 ? ` Nie udało się: ${result.failed.join(', ')}.` : ''));
      setItems(null);
      setPasted('');
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać cytatów.');
    } finally {
      setStage(null);
    }
  };

  const chosen = items?.filter((i) => i.keep).length ?? 0;
  const topicsToMake = items === null ? [] : newTopics(items);

  return (
    <div className="lib-intake">
      <div className="lib-intake-head">
        <h3 className="wk-h3">Import cytatów z JSON</h3>
        <button type="button" className="wk-link-btn" onClick={onClose}>Zamknij</button>
      </div>
      <p className="wk-hint">Zdjęcia zaznaczonych stron daj swojemu czatowi z AI razem z poleceniem poniżej. Odpowiedź (JSON) wklej tutaj — zanim cokolwiek zapiszesz, zobaczysz każdy cytat.</p>

      <section className="lib-intake-step" aria-label="Polecenie">
        <h4 className="wk-json-h">1. Polecenie dla Twojego AI</h4>
        <fieldset className="lib-mode">
          <legend>Co jest cytatem</legend>
          <label className="pe-check"><input type="radio" name="lib-mode" checked={markMode === 'marked'} onChange={() => setMode('marked')} /><span>fragmenty zaznaczone ołówkiem</span></label>
          <label className="pe-check"><input type="radio" name="lib-mode" checked={markMode === 'whole'} onChange={() => setMode('whole')} /><span>cały tekst ze zdjęcia</span></label>
        </fieldset>
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-line" onClick={() => copy('prompt', prompt)}>{copied === 'prompt' ? 'Skopiowano polecenie' : 'Kopiuj polecenie'}</button>
          <button type="button" className="wk-link-btn" aria-expanded={showPrompt} onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? 'Ukryj polecenie' : 'Pokaż polecenie'}</button>
        </div>
        {showPrompt && <pre className="wk-json-pre lib-prompt">{prompt}</pre>}
      </section>

      <section className="lib-intake-step" aria-label="JSON">
        <h4 className="wk-json-h">2. Odpowiedź AI (JSON)</h4>
        <textarea className="wk-json-text" rows={6} spellCheck={false} value={pasted} aria-label="Odpowiedź AI (JSON)"
          placeholder='{"format": "recreatio/quotes", "quotes": [ … ] }' onChange={(e) => readPasted(e.target.value)} />
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" onClick={() => file.current?.click()}>Wczytaj plik .json…</button>
          <input ref={file} type="file" accept=".json,application/json,text/plain" hidden onChange={(e) => { const one = e.target.files?.[0]; e.target.value = ''; if (one !== undefined) void one.text().then(readPasted); }} />
          <button type="button" className="wk-link-btn" onClick={() => void saveBlob(new Blob([JSON.stringify(exportQuotes(work, store), null, 2)], { type: 'application/json' }), `cytaty-${work.key ?? work.id.slice(0, 8)}.json`)}>
            Eksportuj cytaty tej książki (JSON)
          </button>
        </div>
        <details className="wk-fold">
          <summary>Opis formatu JSON</summary>
          <div className="wk-actions"><button type="button" className="wk-link-btn" onClick={() => copy('doc', quotesDescription(work))}>{copied === 'doc' ? 'Skopiowano opis' : 'Kopiuj opis'}</button></div>
          <pre className="wk-json-pre">{quotesDescription(work)}</pre>
        </details>
      </section>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {done !== null && <p className="wk-done" role="status">{done}</p>}

      {items !== null && items.length > 0 && (
        <section className="lib-intake-step" aria-label="Sprawdzenie">
          <h4 className="wk-json-h">3. Sprawdź i zapisz</h4>
          <p className="wk-hint">
            {items.length} {items.length === 1 ? 'cytat' : 'cytatów'} · {items.filter((i) => i.uncertain).length} do sprawdzenia · {items.filter((i) => i.duplicateOf !== undefined).length} już jest
          </p>
          {warnings.length > 0 && <ul className="wk-json-warn">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          <ol className="lib-review">
            {items.map((item) => (
              <li key={item.n} className={`${item.keep ? '' : 'is-off'}${item.uncertain ? ' is-unsure' : ''}`}>
                <label className="lib-review-keep">
                  <input type="checkbox" checked={item.keep} onChange={(e) => change(item.n, { keep: e.target.checked })} />
                  <span className="lib-sr">Zapisz ten cytat</span>
                </label>
                <div className="lib-review-body">
                  <div className="lib-review-row">
                    <input className="lib-review-page" value={item.locator} aria-label="Miejsce (strona)" placeholder="s. ?" onChange={(e) => change(item.n, { locator: e.target.value })} />
                    {item.uncertain && <span className="lib-badge is-unsure">do sprawdzenia</span>}
                    {item.duplicateOf !== undefined && <span className="lib-badge">już jest</span>}
                    {item.id !== undefined && <span className="lib-badge">zmiana istniejącego</span>}
                  </div>
                  <textarea rows={Math.min(8, Math.max(2, Math.ceil(item.text.length / 90)))} value={item.text} aria-label="Tekst cytatu" onChange={(e) => change(item.n, { text: e.target.value })} />
                  <input value={item.description} placeholder="Opis (o czym jest fragment)" aria-label="Opis" onChange={(e) => change(item.n, { description: e.target.value })} />
                  {item.topics.length > 0 && (
                    <p className="lib-review-topics">
                      {item.topics.map((t) => (
                        <button key={t.id ?? t.name} type="button" className={`lib-chip${t.id === undefined ? ' is-new' : ''}`} title="Usuń temat"
                          onClick={() => change(item.n, { topics: item.topics.filter((x) => x !== t) })}>
                          {t.id === undefined ? '+ ' : '#'}{t.name} ×
                        </button>
                      ))}
                    </p>
                  )}
                  {item.notes !== '' && <input value={item.notes} aria-label="Notatki prywatne" onChange={(e) => change(item.n, { notes: e.target.value })} />}
                </div>
              </li>
            ))}
          </ol>
          {topicsToMake.length > 0 && (
            <label className="pe-check">
              <input type="checkbox" checked={createTopics} onChange={(e) => setCreateTopics(e.target.checked)} />
              <span>Utwórz nowe tematy: {topicsToMake.join(', ')}</span>
            </label>
          )}
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={chosen === 0 || stage !== null} onClick={() => void save()}>
              {stage ?? `Zapisz ${chosen} ${chosen === 1 ? 'cytat' : chosen > 1 && chosen < 5 ? 'cytaty' : 'cytatów'}`}
            </button>
            <button type="button" className="wk-link-btn" onClick={() => { setItems(null); setPasted(''); }}>Odrzuć</button>
          </div>
        </section>
      )}
    </div>
  );
}
