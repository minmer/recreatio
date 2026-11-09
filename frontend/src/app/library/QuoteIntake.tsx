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
import { workLocatorKey } from './locations';
import { ids, str } from './libraryKinds';
import {
  exportQuotes, importQuotes, locatorOf, planQuotes, quotesDescription, quotesPrompt,
  type MarkMode, type QuoteItem
} from './libraryQuotes';
import type { Entry, LibraryStore } from './libraryStore';
import { parseDocument } from '../pages/pageJson';
import { saveBlob } from '../core/platform';
import { useRemembered } from '../core/prefs';
import { viewPath } from '../routes';
import { WorkspaceError } from '../core/session';
import { useT } from '../core/i18n';

const SHOWN = 6;

export function QuoteIntake({ store, library, work }: { store: LibraryStore; library: OpenLibrary; work: Entry }) {
  /* 2026-10-22 — nach der Stelle: Seiten als Zahlen, die Schrift nach dem Kanon. */
  const quotes = useMemo(() => store.ofKind('quote').filter((q) => ids(q.data, 'work').includes(work.id))
    .sort((a, b) => workLocatorKey(str(a.data, 'locator'), work.data).localeCompare(workLocatorKey(str(b.data, 'locator'), work.data)) || a.createdAt.localeCompare(b.createdAt)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [store, store.revision, work.id, work.data]);
  const [all, setAll] = useState(false);
  const [intake, setIntake] = useState(false);
  const t = useT();

  return (
    <section className="lib-quotes-of" aria-labelledby="lib-quotes-of-h">
      <div className="lib-quotes-of-head">
        <h2 id="lib-quotes-of-h" className="wk-h2">{t('libraryData.quotes.title')} <span className="lib-count">{quotes.length}</span></h2>
        {library.writes && !intake && <button type="button" className="wk-btn" onClick={() => setIntake(true)}>{t('libraryData.quotes.importOpen')}</button>}
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
      {quotes.length > SHOWN && <button type="button" className="wk-link-btn" onClick={() => setAll(!all)}>{all ? t('libraryData.quotes.showLess') : t('libraryData.quotes.showAll', { n: quotes.length })}</button>}

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
  const t = useT();

  const add = async () => {
    if (text.trim() === '') return;
    setBusy(true);
    setFailed(null);
    try {
      const saved = await store.save({ kind: 'quote', data: { text: text.trim(), work: work.id, ...(page.trim() === '' ? {} : { locator: locatorOf(page, '') }) } });
      setText('');
      setSaid(t('libraryData.quotes.added', { key: saved.key ?? '' }));
      area.current?.focus();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('libraryData.quotes.saveOneFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="lib-quick-quote" onSubmit={(e) => { e.preventDefault(); void add(); }}>
      <label className="wk-field">
        <span>{t('libraryData.quotes.newQuote')}</span>
        <textarea ref={area} rows={3} value={text} placeholder={t('libraryData.quotes.newPlaceholder')} onChange={(e) => { setText(e.target.value); setSaid(null); }}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void add(); } }} />
      </label>
      <label className="wk-field lib-quick-page">
        <span>{t('libraryData.quotes.page')}</span>
        <input value={page} inputMode="numeric" placeholder={t('libraryData.quotes.pagePlaceholder')} onChange={(e) => setPage(e.target.value)} />
      </label>
      <div className="wk-actions">
        <button type="submit" className="wk-btn wk-btn-line" disabled={busy || text.trim() === ''}>{busy ? t('common.saving') : t('libraryData.quotes.addQuote')}</button>
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
  const file = useRef<HTMLInputElement | null>(null);
  const t = useT();

  const markMode: MarkMode = mode === 'whole' ? 'whole' : 'marked';
  const prompt = useMemo(() => quotesPrompt(work, store, markMode), [work, store, markMode]);

  const readPasted = (text: string) => {
    setPasted(text);
    setDone(null);
    const parsed = parseDocument(text);
    if (parsed === null) { setItems(null); setFailed(null); return; }
    if ('error' in parsed) { setFailed(t('libraryData.quotes.badJson', { error: parsed.error })); setItems(null); return; }
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
    setStage(t('common.saving'));
    try {
      const result = await importQuotes(items, work, store, (input) => store.save(input), { stage: setStage });
      setDone(t('libraryData.quotes.savedN', { count: result.saved })
        + (result.failed.length > 0 ? ` ${t('libraryData.quotes.failedList', { list: result.failed.join(', ') })}` : ''));
      setItems(null);
      setPasted('');
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('libraryData.quotes.saveFailed'));
    } finally {
      setStage(null);
    }
  };

  const chosen = items?.filter((i) => i.keep).length ?? 0;

  return (
    <div className="lib-intake">
      <div className="lib-intake-head">
        <h3 className="wk-h3">{t('libraryData.quotes.importTitle')}</h3>
        <button type="button" className="wk-link-btn" onClick={onClose}>{t('common.close')}</button>
      </div>
      <p className="wk-hint">{t('libraryData.quotes.importHint')}</p>

      <section className="lib-intake-step" aria-label={t('libraryData.quotes.prompt')}>
        <h4 className="wk-json-h">{t('libraryData.quotes.step1')}</h4>
        <fieldset className="lib-mode">
          <legend>{t('libraryData.quotes.whatIsQuote')}</legend>
          <label className="pe-check"><input type="radio" name="lib-mode" checked={markMode === 'marked'} onChange={() => setMode('marked')} /><span>{t('libraryData.quotes.marked')}</span></label>
          <label className="pe-check"><input type="radio" name="lib-mode" checked={markMode === 'whole'} onChange={() => setMode('whole')} /><span>{t('libraryData.quotes.whole')}</span></label>
        </fieldset>
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-line" onClick={() => copy('prompt', prompt)}>{copied === 'prompt' ? t('libraryData.quotes.promptCopied') : t('libraryData.quotes.copyPrompt')}</button>
          <button type="button" className="wk-link-btn" aria-expanded={showPrompt} onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? t('libraryData.quotes.hidePrompt') : t('libraryData.quotes.showPrompt')}</button>
        </div>
        {showPrompt && <pre className="wk-json-pre lib-prompt">{prompt}</pre>}
      </section>

      <section className="lib-intake-step" aria-label="JSON"> // i18n-ignore
        <h4 className="wk-json-h">{t('libraryData.quotes.step2')}</h4>
        <textarea className="wk-json-text" rows={6} spellCheck={false} value={pasted} aria-label={t('libraryData.quotes.answer')}
          placeholder='{"format": "recreatio/quotes", "quotes": [ … ] }' onChange={(e) => readPasted(e.target.value)} />
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" onClick={() => file.current?.click()}>{t('libraryData.quotes.loadFile')}</button>
          <input ref={file} type="file" accept=".json,application/json,text/plain" hidden onChange={(e) => { const one = e.target.files?.[0]; e.target.value = ''; if (one !== undefined) void one.text().then(readPasted); }} />
          <button type="button" className="wk-link-btn" onClick={() => void saveBlob(new Blob([JSON.stringify(exportQuotes(work, store), null, 2)], { type: 'application/json' }), `${t('libraryData.quotes.fileName')}-${work.key ?? work.id.slice(0, 8)}.json`)}>
            {t('libraryData.quotes.export')}
          </button>
        </div>
        <details className="wk-fold">
          <summary>{t('libraryData.quotes.formatDoc')}</summary>
          <div className="wk-actions"><button type="button" className="wk-link-btn" onClick={() => copy('doc', quotesDescription(work))}>{copied === 'doc' ? t('libraryData.quotes.docCopied') : t('libraryData.quotes.copyDoc')}</button></div>
          <pre className="wk-json-pre">{quotesDescription(work)}</pre>
        </details>
      </section>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {done !== null && <p className="wk-done" role="status">{done}</p>}

      {items !== null && items.length > 0 && (
        <section className="lib-intake-step" aria-label={t('libraryData.quotes.review')}>
          <h4 className="wk-json-h">{t('libraryData.quotes.step3')}</h4>
          <p className="wk-hint">
            {t('libraryData.quotes.summary', { quotes: t('libraryData.quotes.count', { count: items.length }), unsure: items.filter((i) => i.uncertain).length, known: items.filter((i) => i.duplicateOf !== undefined).length })}
          </p>
          {warnings.length > 0 && <ul className="wk-json-warn">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          <ol className="lib-review">
            {items.map((item) => (
              <li key={item.n} className={`${item.keep ? '' : 'is-off'}${item.uncertain ? ' is-unsure' : ''}`}>
                <label className="lib-review-keep">
                  <input type="checkbox" checked={item.keep} onChange={(e) => change(item.n, { keep: e.target.checked })} />
                  <span className="lib-sr">{t('libraryData.quotes.keep')}</span>
                </label>
                <div className="lib-review-body">
                  <div className="lib-review-row">
                    <input className="lib-review-page" value={item.locator} aria-label={t('libraryData.quotes.place')} placeholder={t('libraryData.quotes.placePlaceholder')} onChange={(e) => change(item.n, { locator: e.target.value })} />
                    {item.uncertain && <span className="lib-badge is-unsure">{t('libraryData.quotes.unsure')}</span>}
                    {item.duplicateOf !== undefined && <span className="lib-badge">{t('libraryData.quotes.exists')}</span>}
                    {item.id !== undefined && <span className="lib-badge">{t('libraryData.quotes.changesExisting')}</span>}
                  </div>
                  <textarea rows={Math.min(8, Math.max(2, Math.ceil(item.text.length / 90)))} value={item.text} aria-label={t('libraryData.quotes.text')} onChange={(e) => change(item.n, { text: e.target.value })} />
                  {item.check !== '' && <p className="wk-warn">{t('libraryData.quotes.check', { what: item.check })}</p>}
                </div>
              </li>
            ))}
          </ol>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={chosen === 0 || stage !== null} onClick={() => void save()}>
              {stage ?? t('libraryData.quotes.saveN', { count: chosen })}
            </button>
            <button type="button" className="wk-link-btn" onClick={() => { setItems(null); setPasted(''); }}>{t('libraryData.quotes.discard')}</button>
          </div>
        </section>
      )}
    </div>
  );
}
