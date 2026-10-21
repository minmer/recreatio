/**
 * Einen Eintrag der Bibliothek schreiben: Felder, Text mit Zitaten, Gliederung.
 *
 * 2026-10-21 — der Text hat drei Teile: Plan (die Hauptgedanken mit Zitaten,
 * `PlanEditor.tsx`), Treść und Dalsze informacje; Themen werden, wo die
 * Bibliothek Aspekte hat, Achse für Achse gewählt (`TopicPick.tsx`).
 */

import { type ReactNode, useState } from 'react';

import { count } from '../pages/event/kit';
import { viewPath } from '../routes';
import type { OpenLibrary } from './library';
import { bibliography, segText, workBehind } from './libraryCite';
import { MARKUP_DOC } from './libraryJson';
import { type EntryData, type LibEntry, type LibField, type OutlineItem, TEXT_STATUS, ids, kindOf, num, str, wordCount } from './libraryKinds';
import { citedKeys } from './libraryMarkup';
import { RefPicker } from './LibraryPick';
import type { Entry, LibraryStore } from './libraryStore';
import { TextArticle } from './LibraryText';
import { Segs } from './markupView';
import { PlanEditor } from './PlanEditor';
import { planOf } from './sermon';
import { TopicsField } from './TopicPick';
import { WritingArea } from './WritingTools';

/* -- Felder ---------------------------------------------------------------------------------- */

export function FieldList({ store, kind, data, set, readOnly, skip = [], only, extras = {} }: {
  store: LibraryStore;
  kind: string;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
  skip?: readonly string[];
  /** 2026-10-21 — nur diese Felder, in der Reihenfolge der Art (ein Formular in Abschnitten). */
  only?: readonly string[];
  /** Was unter einem Feld steht — Knöpfe, Hinweise (bei der ISBN: scannen, Katalog). */
  extras?: Readonly<Record<string, ReactNode>>;
}) {
  const def = kindOf(kind)!;
  return (
    <div className="lib-fields">
      {def.fields.filter((f) => !skip.includes(f.key) && (only === undefined || only.includes(f.key))
        && f.type !== 'outline' && f.type !== 'markup' && f.type !== 'items' && (f.when === undefined || f.when(data))).map((field) => (
        <FieldInput key={field.key} store={store} field={field} data={data} set={set} readOnly={readOnly} extra={extras[field.key]} />
      ))}
    </div>
  );
}

function FieldInput({ store, field, data, set, readOnly, extra }: {
  store: LibraryStore;
  field: LibField;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
  extra?: ReactNode;
}) {
  const value = str(data, field.key);
  const label = <span>{field.label}{field.private === true && <em className="lib-private" title="Nigdy nie jest publikowane"> · prywatne</em>}</span>;
  const wide = field.type === 'text' || field.type === 'refs' || field.key === 'title';

  if (field.type === 'ref' || field.type === 'refs') {
    /* 2026-10-21 — Themen Achse für Achse, wo die Bibliothek Aspekte hat. */
    const topics = field.type === 'refs' && field.to?.length === 1 && field.to[0] === 'topic';
    return (
      <div className={`wk-field lib-field${wide ? ' is-wide' : ''}`}>
        {label}
        {topics ? (
          <TopicsField store={store} value={ids(data, field.key)} readOnly={readOnly} onChange={(next) => set({ [field.key]: next })} />
        ) : (
          <RefPicker store={store} kinds={field.to ?? []} value={ids(data, field.key)} multiple={field.type === 'refs'} busy={readOnly}
            onChange={(next) => set({ [field.key]: field.type === 'ref' ? (next[0] ?? '') : next })} />
        )}
      </div>
    );
  }

  let input: ReactNode;
  if (field.type === 'select') {
    input = (
      <select value={value} disabled={readOnly} onChange={(e) => set({ [field.key]: e.target.value })}>
        <option value="">—</option>
        {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (field.type === 'text') {
    input = <textarea rows={field.key === 'text' ? 6 : 3} value={value} placeholder={field.hint} disabled={readOnly} onChange={(e) => set({ [field.key]: e.target.value })} />;
  } else {
    input = (
      <input
        type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
        step={field.type === 'number' ? 'any' : undefined}
        min={field.type === 'number' ? 0 : undefined}
        value={field.type === 'number' ? (num(data, field.key) ?? '') : value}
        placeholder={field.hint}
        disabled={readOnly}
        onChange={(e) => set({ [field.key]: field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })}
      />
    );
  }

  if (extra === undefined || extra === null) return <label className={`wk-field lib-field${wide ? ' is-wide' : ''}`}>{label}{input}</label>;
  return (
    <div className={`lib-field-with${wide ? ' is-wide' : ''}`}>
      <label className="wk-field lib-field">{label}{input}</label>
      {extra}
    </div>
  );
}

/* -- Der Text: schreiben mit Quellen ------------------------------------------------------------- */

export function TextForm({ store, entry, data, set, readOnly }: {
  store: LibraryStore;
  entry: LibEntry;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
}) {
  const [view, setView] = useState<'write' | 'preview' | 'both'>(() => (window.matchMedia?.('(min-width: 70rem)').matches === true ? 'both' : 'write'));
  /* 2026-10-21 — ein neuer Text (und einer, der schon einen Plan hat) beginnt beim Plan; ein geschriebener bei der Treść. */
  const [part, setPart] = useState<'plan' | 'body' | 'further'>(() => (planOf(data).length > 0 || str(data, 'body').trim() === '' ? 'plan' : 'body'));
  const words = wordCount(str(data, 'body'));
  const target = num(data, 'targetWords');
  const missing = citedKeys(str(data, 'body'), str(data, 'further'), ...planOf(data).map((p) => p.text)).filter((k) => store.byKey(k) === undefined);

  return (
    <>
      <label className="wk-field lib-field is-wide">
        <span>Tytuł</span>
        <input className="lib-title-input" value={str(data, 'title')} disabled={readOnly} placeholder="Tytuł tekstu" onChange={(e) => set({ title: e.target.value })} />
      </label>

      <div className="lib-write-bar">
        <div className="wk-seg" role="group" aria-label="Część tekstu">
          {([['plan', 'Plan'], ['body', 'Treść'], ['further', 'Dalsze informacje']] as const).map(([value, label]) => (
            <button key={value} type="button" className={part === value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={part === value} onClick={() => setPart(value)}>{label}</button>
          ))}
        </div>
        <div className="wk-seg" role="group" aria-label="Widok">
          {([['write', 'Pisanie'], ['both', 'Obok siebie'], ['preview', 'Podgląd']] as const).map(([value, label]) => (
            <button key={value} type="button" className={view === value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>
          ))}
        </div>
        <span className="lib-words">{words} słów{target !== null && target > 0 ? ` z ${target} (${Math.round((words / target) * 100)}%)` : ''}</span>
      </div>

      <div className={`lib-write is-${view}`}>
        {view !== 'preview' && part === 'plan' && <PlanEditor store={store} text={entry} data={data} set={set} readOnly={readOnly} />}
        {view !== 'preview' && part !== 'plan' && (
          <WritingArea
            key={part}
            store={store}
            value={str(data, part)}
            readOnly={readOnly}
            placeholder={part === 'body' ? 'Treść… Źródło wstawisz przyciskiem „Źródło” albo pisząc [@klucz, s. 12].' : 'Dalsze informacje — lektura, linki, kontekst.'}
            onChange={(next) => set({ [part]: next })}
          />
        )}
        {view !== 'write' && (
          <div className="lib-preview" aria-label="Podgląd">
            <TextArticle entry={entry} look={store} prefix="pv-" hrefOf={(e) => viewPath('library', store.libraryId, e.id)} />
          </div>
        )}
      </div>
      {missing.length > 0 && <p className="wk-warn">Nie ma w bibliotece: {missing.map((k) => `[@${k}]`).join(', ')} — te przypisy będą puste.</p>}

      <details className="wk-fold lib-meta-fold" open={str(data, 'date') === '' && str(data, 'body') === ''}>
        <summary>Dane tekstu — rodzaj, data, czytania, projekt, tematy, nagranie</summary>
        <FieldList store={store} kind="text" data={data} set={set} readOnly={readOnly} skip={['title']} />
      </details>

      <details className="wk-fold">
        <summary>Jak pisać — zapis treści</summary>
        <pre className="wk-json-pre">{MARKUP_DOC}</pre>
      </details>
    </>
  );
}

/* -- Der Plan eines Projekts ------------------------------------------------------------------- */

export function OutlineEditor({ store, library, project, value, readOnly, onChange }: {
  store: LibraryStore;
  library: OpenLibrary;
  project: Entry;
  value: readonly OutlineItem[];
  readOnly: boolean;
  onChange: (next: OutlineItem[]) => void;
}) {
  const texts = store.ofKind('text').filter((t) => ids(t.data, 'project').includes(project.id));
  const listed = new Set(value.filter((i): i is { text: string } => 'text' in i).map((i) => i.text));
  const outside = texts.filter((t) => !listed.has(t.id));
  const items = value.filter((i) => !('text' in i) || store.get(i.text) !== undefined);
  const words = texts.reduce((n, t) => n + wordCount(str(t.data, 'body')), 0);
  const target = num(project.data, 'targetWords');
  const [heading, setHeading] = useState('');

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [one] = next.splice(from, 1);
    next.splice(to, 0, one!);
    onChange(next);
  };

  const works = texts.flatMap((t) => citedKeys(str(t.data, 'body'), str(t.data, 'further')).map((k) => workBehind(store.byKey(k), store)))
    .filter((w): w is Entry => w !== undefined);
  const bib = bibliography(works, store);

  return (
    <section className="lib-outline">
      <h2 className="wk-h2">Plan</h2>
      <p className="lib-progress">
        {count(texts.length, 'tekst', 'teksty', 'tekstów')} · {count(words, 'słowo', 'słowa', 'słów')}{target !== null && target > 0 ? ` z ${target} (${Math.round((words / target) * 100)}%)` : ''}
        {target !== null && target > 0 && <span className="lib-bar"><span style={{ width: `${Math.min(100, Math.round((words / target) * 100))}%` }} /></span>}
      </p>
      <ol className="lib-outline-list">
        {items.map((item, i) => (
          <li key={'text' in item ? item.text : `h${i}`} className={'heading' in item ? 'is-heading' : ''}>
            {'heading' in item ? (
              <input value={item.heading} disabled={readOnly} aria-label="Nagłówek części" onChange={(e) => onChange(items.map((x, j) => (j === i ? { heading: e.target.value } : x)))} />
            ) : (
              <a href={viewPath('library', library.libraryId, item.text)}>
                {store.title(store.get(item.text)!)}
                <span className="lib-row-meta"> · {TEXT_STATUS.find((s) => s.value === str(store.get(item.text)!.data, 'status'))?.label ?? 'Szkic'} · {count(wordCount(str(store.get(item.text)!.data, 'body')), 'słowo', 'słowa', 'słów')}</span>
              </a>
            )}
            {!readOnly && (
              <span className="lib-outline-tools">
                <button type="button" aria-label="Wyżej" disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
                <button type="button" aria-label="Niżej" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>↓</button>
                <button type="button" aria-label="Usuń z planu" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {outside.length > 0 && (
        <div className="lib-outside">
          <p className="wk-hint">Teksty tego projektu spoza planu:</p>
          <ul>
            {outside.map((t) => (
              <li key={t.id}>
                <a href={viewPath('library', library.libraryId, t.id)}>{store.title(t)}</a>{' '}
                {!readOnly && <button type="button" className="wk-link-btn" onClick={() => onChange([...items, { text: t.id }])}>dodaj do planu</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!readOnly && (
        <div className="wk-actions">
          <input value={heading} placeholder="Nagłówek części, np. Część I" onChange={(e) => setHeading(e.target.value)} aria-label="Nowy nagłówek" />
          <button type="button" className="wk-link-btn" disabled={heading.trim() === ''} onClick={() => { onChange([...items, { heading: heading.trim() }]); setHeading(''); }}>+ Nagłówek</button>
          <a className="wk-btn" href={viewPath('library', library.libraryId, 'nowy', 'text', `project=${project.id}`)}>+ Nowy tekst w projekcie</a>
        </div>
      )}
      {bib.length > 0 && (
        <details className="wk-fold">
          <summary>Bibliografia projektu ({bib.length})</summary>
          <ul className="lib-bib">{bib.map(({ work, segs }) => <li key={work.id}><Segs segs={segs} /></li>)}</ul>
          <button type="button" className="wk-link-btn" onClick={() => void navigator.clipboard.writeText(bib.map(({ segs }) => `${segText(segs)}.`).join('\n'))}>Kopiuj bibliografię</button>
        </details>
      )}
    </section>
  );
}
