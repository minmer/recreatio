/**
 * SCHREIBEN MIT QUELLEN (0064; 2026-10-21 aus `LibraryTextForm.tsx` hierher) —
 * das Schreibfeld mit seinen Knöpfen und der Wähler für Quellen und Zitate.
 * Die Treść eines Textes, der Plan (`PlanEditor.tsx`) und der Zapis eines
 * Wygłoszenia (`DeliveryForm.tsx`) schreiben mit denselben Werkzeugen.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { WorkspaceError } from '../core/session';
import { originOf } from './libraryCite';
import { kindOf, str } from './libraryKinds';
import { RefPicker, entryLine } from './LibraryPick';
import type { Entry, LibraryStore } from './libraryStore';

/** Das Schreibfeld — mit Knöpfen, die an der Schreibmarke einfügen. */
export function WritingArea({ store, value, readOnly, placeholder, onChange }: {
  store: LibraryStore;
  value: string;
  readOnly: boolean;
  placeholder: string;
  onChange: (next: string) => void;
}) {
  const area = useRef<HTMLTextAreaElement | null>(null);
  const [picker, setPicker] = useState<'cite' | 'embed' | null>(null);

  /* Das Feld wächst mit dem Text. */
  useEffect(() => {
    const el = area.current;
    if (el === null) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(320, el.scrollHeight + 4)}px`;
  }, [value]);

  const edit = (make: (before: string, chosen: string, after: string) => { text: string; caret: [number, number] }) => {
    const el = area.current;
    const from = el?.selectionStart ?? value.length;
    const to = el?.selectionEnd ?? value.length;
    const done = make(value.slice(0, from), value.slice(from, to), value.slice(to));
    onChange(done.text);
    window.requestAnimationFrame(() => {
      if (el === null) return;
      el.focus();
      el.setSelectionRange(done.caret[0], done.caret[1]);
    });
  };

  const wrap = (mark: string) => edit((b, s, a) => ({ text: `${b}${mark}${s || 'tekst'}${mark}${a}`, caret: [b.length + mark.length, b.length + mark.length + (s || 'tekst').length] }));
  const line = (prefix: string) => edit((b, s, a) => {
    const start = b.lastIndexOf('\n') + 1;
    const text = `${b.slice(0, start)}${prefix}${b.slice(start)}${s}${a}`;
    return { text, caret: [b.length + prefix.length, b.length + prefix.length + s.length] };
  });
  const insert = (text: string, block = false) => edit((b, s, a) => {
    const lead = block && b !== '' && !b.endsWith('\n\n') ? (b.endsWith('\n') ? '\n' : '\n\n') : '';
    const tail = block && !a.startsWith('\n') ? '\n\n' : '';
    const out = `${b}${lead}${text}${tail}${a}`;
    const caret = b.length + lead.length + text.length + tail.length;
    void s;
    return { text: out, caret: [caret, caret] };
  });

  const selection = () => {
    const el = area.current;
    return el === null ? '' : value.slice(el.selectionStart, el.selectionEnd);
  };

  return (
    <div className="lib-writing">
      {!readOnly && (
        <div className="lib-tools" role="toolbar" aria-label="Wstawianie">
          <button type="button" title="Pogrubienie" onClick={() => wrap('**')}><b>B</b></button>
          <button type="button" title="Kursywa" onClick={() => wrap('*')}><i>I</i></button>
          <button type="button" title="Śródtytuł" onClick={() => line('## ')}>Śródtytuł</button>
          <button type="button" title="Wcięty cytat" onClick={() => line('> ')}>„ ”</button>
          <button type="button" title="Lista" onClick={() => line('- ')}>• Lista</button>
          <button type="button" title="Własny przypis" onClick={() => edit((b, s, a) => ({ text: `${b}^[${s}]${a}`, caret: [b.length + 2, b.length + 2 + s.length] }))}>Przypis</button>
          <button type="button" className={picker === 'cite' ? 'is-on' : ''} onClick={() => setPicker(picker === 'cite' ? null : 'cite')}>Źródło…</button>
          <button type="button" className={picker === 'embed' ? 'is-on' : ''} onClick={() => setPicker(picker === 'embed' ? null : 'embed')}>Cytat z biblioteki…</button>
        </div>
      )}
      {picker !== null && (
        <CitePicker
          store={store}
          mode={picker}
          selection={selection()}
          onClose={() => setPicker(null)}
          onCite={(key, locator) => { insert(locator === '' ? `[@${key}]` : `[@${key}, ${locator}]`); setPicker(null); }}
          onEmbed={(key, replaceSelection) => {
            if (replaceSelection) edit((b, _s, a) => ({ text: `${b}![@${key}]${a}`, caret: [b.length + key.length + 4, b.length + key.length + 4] }));
            else insert(`![@${key}]`, true);
            setPicker(null);
          }}
        />
      )}
      <textarea
        ref={area}
        className="lib-textarea"
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        spellCheck
        lang="pl"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); wrap('**'); }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); wrap('*'); }
        }}
      />
    </div>
  );
}

/** Eine Quelle wählen — oder aus dem markierten Absatz gleich ein Zitat machen. */
export function CitePicker({ store, mode, selection, onClose, onCite, onEmbed }: {
  store: LibraryStore;
  mode: 'cite' | 'embed';
  selection: string;
  onClose: () => void;
  onCite: (key: string, locator: string) => void;
  onEmbed: (key: string, replaceSelection: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Entry | null>(null);
  const [locator, setLocator] = useState('');
  const [making, setMaking] = useState(false);
  const [work, setWork] = useState<string[]>([]);
  const [quoteLocator, setQuoteLocator] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const kinds = mode === 'cite' ? ['work', 'quote', 'text'] : ['quote'];
  /* 2026-10-22 — getippt wird der Schlüssel, wo er von hier aus genau diesen Eintrag findet; sonst die Kennung (gespeichert wird ohnehin die Kennung). */
  const tokenOf = (entry: Entry): string => (entry.key !== undefined && store.byKey(entry.key)?.id === entry.id ? entry.key : entry.id);

  const found = useMemo(() => (query.trim() === ''
    ? store.all().filter((e) => kinds.includes(e.kind)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    : store.search(query, kinds)).slice(0, 10),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [query, store, store.revision, mode]);

  const makeQuote = async () => {
    setFailed(null);
    try {
      const saved = await store.save({ kind: 'quote', data: { text: selection.trim(), work: work[0] ?? '', locator: quoteLocator } });
      onEmbed(tokenOf(saved), true);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać cytatu.');
    }
  };

  return (
    <div className="lib-cite-picker" role="dialog" aria-label={mode === 'cite' ? 'Wstaw źródło' : 'Wstaw cytat'}>
      <div className="lib-cite-head">
        <strong>{mode === 'cite' ? 'Wstaw odwołanie do źródła' : 'Wstaw cytat z biblioteki'}</strong>
        <button type="button" className="wk-link-btn" onClick={onClose}>Zamknij</button>
      </div>

      {mode === 'embed' && selection.trim().length > 10 && !making && (
        <button type="button" className="wk-link-btn" onClick={() => setMaking(true)}>Zapisz zaznaczony fragment jako nowy cytat…</button>
      )}
      {making ? (
        <div className="lib-cite-make">
          <blockquote className="lib-blockquote">{selection.trim().slice(0, 400)}{selection.trim().length > 400 ? '…' : ''}</blockquote>
          <div className="wk-field"><span>Źródło</span><RefPicker store={store} kinds={['work']} value={work} multiple={false} onChange={setWork} /></div>
          <label className="wk-field"><span>Miejsce</span><input value={quoteLocator} placeholder="s. 23 · J 3,16" onChange={(e) => setQuoteLocator(e.target.value)} /></label>
          {failed !== null && <p className="wk-error">{failed}</p>}
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={() => void makeQuote()}>Zapisz cytat i wstaw</button>
            <button type="button" className="wk-link-btn" onClick={() => setMaking(false)}>Anuluj</button>
          </div>
        </div>
      ) : chosen === null ? (
        <>
          <input autoFocus type="search" value={query} placeholder={mode === 'cite' ? 'Szukaj źródła, cytatu, tekstu…' : 'Szukaj cytatu…'} onChange={(e) => setQuery(e.target.value)} />
          <ul className="lib-cite-list">
            {found.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => {
                  if (mode === 'embed') onEmbed(tokenOf(entry), false);
                  else if (entry.kind === 'work') setChosen(entry);
                  else onCite(tokenOf(entry), '');
                }}>
                  <span className="lib-option-kind">{kindOf(entry.kind)?.label}</span> {entry.kind === 'quote' ? `„${store.title(entry)}” — ${originOf(entry, store)}` : entryLine(entry, store)}
                </button>
              </li>
            ))}
            {found.length === 0 && <li className="wk-hint">Nic nie znaleziono — dodaj źródło w zakładce „Źródła”.</li>}
          </ul>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); onCite(tokenOf(chosen), locator.trim()); }}>
          <p>{entryLine(chosen, store)}</p>
          <label className="wk-field"><span>Miejsce (strona, werset, numer) — można pominąć</span>
            <input autoFocus value={locator} placeholder={str(chosen.data, 'workType') === 'bible' ? 'J 3,16' : 's. 23'} onChange={(e) => setLocator(e.target.value)} />
          </label>
          <div className="wk-actions">
            <button type="submit" className="wk-btn">Wstaw [@{tokenOf(chosen)}{locator.trim() === '' ? '' : `, ${locator.trim()}`}]</button>
            <button type="button" className="wk-link-btn" onClick={() => setChosen(null)}>Inne źródło</button>
          </div>
        </form>
      )}
    </div>
  );
}
