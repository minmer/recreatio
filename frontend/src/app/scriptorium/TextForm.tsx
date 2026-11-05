/**
 * EINEN TEXT SCHREIBEN (Skryptorium, seit 2026-10-23; vorher in der Bibliothek):
 * Text mit Zitaten, und der Plan eines Projekts.
 *
 * 2026-10-21 — der Text hat drei Teile: Plan (die Hauptgedanken mit Zitaten,
 * `PlanEditor.tsx`), Treść und Dalsze informacje. Die einfachen Felder zeichnet
 * `library/LibraryFields.tsx` (dieselben wie bei den Quellen).
 */

import { useState, type ReactNode } from 'react';

import { useT } from '../core/i18n';
import { viewPath } from '../routes';
import { containerPath } from '../library/library';
import type { OpenLibrary } from '../library/library';
import { bibliography, segText, workBehind } from '../library/libraryCite';
import { MARKUP_DOC } from '../library/libraryJson';
import { type EntryData, type LibEntry, type OutlineItem, TEXT_STATUS, ids, num, refTarget, str, wordCount } from '../library/libraryKinds';
import { citedKeys } from '../library/libraryMarkup';
import { FieldList } from '../library/LibraryFields';
import type { Entry, LibraryStore } from '../library/libraryStore';
import { TextArticle } from './TextArticle';
import { Segs } from '../library/markupView';
import { PlanEditor } from './PlanEditor';
import { planOf } from './sermon';
import { WritingArea } from './WritingTools';

/* -- Der Text: schreiben mit Quellen ------------------------------------------------------------- */

export function TextForm({ store, entry, data, set, readOnly, typeFields }: {
  store: LibraryStore;
  entry: LibEntry;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
  /** 2026-10-23 — die Felder seines Rodzaj tekstu (`TypeFields.tsx`), unter den Daten des Textes. */
  typeFields?: ReactNode;
}) {
  const t = useT();
  const [view, setView] = useState<'write' | 'preview' | 'both'>(() => (window.matchMedia?.('(min-width: 70rem)').matches === true ? 'both' : 'write'));
  /* 2026-10-21 — ein neuer Text (und einer, der schon einen Plan hat) beginnt beim Plan; ein geschriebener bei der Treść. */
  const [part, setPart] = useState<'plan' | 'body' | 'further'>(() => (planOf(data).length > 0 || str(data, 'body').trim() === '' ? 'plan' : 'body'));
  const words = wordCount(str(data, 'body'));
  const target = num(data, 'targetWords');
  const missing = citedKeys(str(data, 'body'), str(data, 'further'), ...planOf(data).map((p) => p.text)).filter((k) => refTarget(store, k) === undefined);

  return (
    <>
      <label className="wk-field lib-field is-wide">
        <span>{t('common.title')}</span>
        <input className="lib-title-input" value={str(data, 'title')} disabled={readOnly} placeholder={t('scriptorium.text.titlePlaceholder')} onChange={(e) => set({ title: e.target.value })} />
      </label>

      <div className="lib-write-bar">
        <div className="wk-seg" role="group" aria-label={t('scriptorium.text.part')}>
          {([['plan', 'scriptorium.text.parts.plan'], ['body', 'scriptorium.text.parts.body'], ['further', 'scriptorium.text.parts.further']] as const).map(([value, label]) => (
            <button key={value} type="button" className={part === value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={part === value} onClick={() => setPart(value)}>{t(label)}</button>
          ))}
        </div>
        <div className="wk-seg" role="group" aria-label={t('scriptorium.text.view')}>
          {([['write', 'scriptorium.text.views.write'], ['both', 'scriptorium.text.views.both'], ['preview', 'scriptorium.text.views.preview']] as const).map(([value, label]) => (
            <button key={value} type="button" className={view === value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={view === value} onClick={() => setView(value)}>{t(label)}</button>
          ))}
        </div>
        <span className="lib-words">{target !== null && target > 0 ? t('scriptorium.text.wordsOf', { count: words, target, percent: Math.round((words / target) * 100) }) : t('scriptorium.text.words', { count: words })}</span>
      </div>

      <div className={`lib-write is-${view}`}>
        {view !== 'preview' && part === 'plan' && <PlanEditor store={store} text={entry} data={data} set={set} readOnly={readOnly} />}
        {view !== 'preview' && part !== 'plan' && (
          <WritingArea
            key={part}
            store={store}
            value={str(data, part)}
            readOnly={readOnly}
            placeholder={part === 'body' ? t('scriptorium.text.bodyPlaceholder') : t('scriptorium.text.furtherPlaceholder')}
            onChange={(next) => set({ [part]: next })}
          />
        )}
        {view !== 'write' && (
          <div className="lib-preview" aria-label={t('scriptorium.text.views.preview')}>
            <TextArticle entry={entry} look={store} prefix="pv-" hrefOf={(e) => (e.kind === 'entity' ? undefined : containerPath((store.homeOf(e.id) ?? store).libraryId, e.id))} />
          </div>
        )}
      </div>
      {missing.length > 0 && <p className="wk-warn">{t('scriptorium.text.missing', { keys: missing.map((k) => `[@${k}]`).join(', ') })}</p>}

      <details className="wk-fold lib-meta-fold" open={(str(data, 'date') === '' && str(data, 'body') === '') || typeFields !== undefined}>
        <summary>{typeFields !== undefined ? t('scriptorium.text.dataWithType') : t('scriptorium.text.data')}</summary>
        <FieldList store={store} kind="text" data={data} set={set} readOnly={readOnly} skip={['title']} />
        {typeFields}
      </details>

      <details className="wk-fold">
        <summary>{t('scriptorium.text.howToWrite')}</summary>
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
  const t = useT();
  const texts = store.ofKind('text').filter((one) => ids(one.data, 'project').includes(project.id));
  const listed = new Set(value.filter((i): i is { text: string } => 'text' in i).map((i) => i.text));
  const outside = texts.filter((one) => !listed.has(one.id));
  const items = value.filter((i) => !('text' in i) || store.get(i.text) !== undefined);
  const words = texts.reduce((n, one) => n + wordCount(str(one.data, 'body')), 0);
  const target = num(project.data, 'targetWords');
  const [heading, setHeading] = useState('');

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [one] = next.splice(from, 1);
    next.splice(to, 0, one!);
    onChange(next);
  };

  const works = texts.flatMap((one) => citedKeys(str(one.data, 'body'), str(one.data, 'further')).map((k) => workBehind(refTarget(store, k), store)))
    .filter((w): w is Entry => w !== undefined);
  const bib = bibliography(works, store);

  return (
    <section className="lib-outline">
      <h2 className="wk-h2">{t('scriptorium.outline.title')}</h2>
      <p className="lib-progress">
        {t('scriptorium.count.texts', { count: texts.length })} · {target !== null && target > 0 ? t('scriptorium.text.wordsOf', { count: words, target, percent: Math.round((words / target) * 100) }) : t('scriptorium.count.words', { count: words })}
        {target !== null && target > 0 && <span className="lib-bar"><span style={{ width: `${Math.min(100, Math.round((words / target) * 100))}%` }} /></span>}
      </p>
      <ol className="lib-outline-list">
        {items.map((item, i) => (
          <li key={'text' in item ? item.text : `h${i}`} className={'heading' in item ? 'is-heading' : ''}>
            {'heading' in item ? (
              <input value={item.heading} disabled={readOnly} aria-label={t('scriptorium.outline.heading')} onChange={(e) => onChange(items.map((x, j) => (j === i ? { heading: e.target.value } : x)))} />
            ) : (
              <a href={viewPath('scriptorium', library.libraryId, item.text)}>
                {store.title(store.get(item.text)!)}
                <span className="lib-row-meta"> · {TEXT_STATUS.find((s) => s.value === str(store.get(item.text)!.data, 'status'))?.label ?? t('scriptorium.outline.draft')} · {t('scriptorium.count.words', { count: wordCount(str(store.get(item.text)!.data, 'body')) })}</span>
              </a>
            )}
            {!readOnly && (
              <span className="lib-outline-tools">
                <button type="button" aria-label={t('scriptorium.outline.up')} disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
                <button type="button" aria-label={t('scriptorium.outline.down')} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>↓</button>
                <button type="button" aria-label={t('scriptorium.outline.remove')} onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {outside.length > 0 && (
        <div className="lib-outside">
          <p className="wk-hint">{t('scriptorium.outline.outside')}</p>
          <ul>
            {outside.map((one) => (
              <li key={one.id}>
                <a href={viewPath('scriptorium', library.libraryId, one.id)}>{store.title(one)}</a>{' '}
                {!readOnly && <button type="button" className="wk-link-btn" onClick={() => onChange([...items, { text: one.id }])}>{t('scriptorium.outline.addToPlan')}</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!readOnly && (
        <div className="wk-actions">
          <input value={heading} placeholder={t('scriptorium.outline.headingPlaceholder')} onChange={(e) => setHeading(e.target.value)} aria-label={t('scriptorium.outline.newHeading')} />
          <button type="button" className="wk-link-btn" disabled={heading.trim() === ''} onClick={() => { onChange([...items, { heading: heading.trim() }]); setHeading(''); }}>{t('scriptorium.outline.addHeading')}</button>
          <a className="wk-btn" href={viewPath('scriptorium', library.libraryId, 'nowy', 'text', `project=${project.id}`)}>{t('scriptorium.outline.newText')}</a>
        </div>
      )}
      {bib.length > 0 && (
        <details className="wk-fold">
          <summary>{t('scriptorium.outline.bibliography', { count: bib.length })}</summary>
          <ul className="lib-bib">{bib.map(({ work, segs }) => <li key={work.id}><Segs segs={segs} /></li>)}</ul>
          <button type="button" className="wk-link-btn" onClick={() => void navigator.clipboard.writeText(bib.map(({ segs }) => `${segText(segs)}.`).join('\n'))}>{t('scriptorium.outline.copyBibliography')}</button>
        </details>
      )}
    </section>
  );
}
