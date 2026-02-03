import { useEffect, useMemo, useState } from 'react';
import bibleBooks from '../../../../content/bibleBooks.json';
import type { Copy } from '../../../../content/types';
import type { CogitaInfoOption } from '../types';
import { InfoSearchSelect } from './InfoSearchSelect';

export type ReferenceSourceForm = {
  sourceKind: string;
  locatorValue: string;
  locatorAux: string;
  bibleBookDisplay: string;
  sourceUrl: string;
  sourceAccessedDate: string;
  churchDocument: CogitaInfoOption | null;
  bookMedia: CogitaInfoOption | null;
  work: CogitaInfoOption | null;
};

type ReferencePanelProps = {
  libraryId: string;
  copy: Copy;
  language: 'pl' | 'en' | 'de';
  sourceKindOptions: Array<{ value: string; label: string }>;
  value: ReferenceSourceForm;
  onChange: (next: ReferenceSourceForm) => void;
  labels: {
    sourceKindLabel: string;
    bibleBookLabel: string;
    bibleBookPlaceholder: string;
    bibleRestLabel: string;
    bibleRestPlaceholder: string;
    churchDocumentLabel: string;
    churchDocumentPlaceholder: string;
    workLabel: string;
    workPlaceholder: string;
    bookLabel: string;
    bookPlaceholder: string;
    locatorLabel: string;
    locatorPlaceholder: string;
  };
};

const MAX_BIBLE_RESULTS = 8;

export function ReferencePanel({
  libraryId,
  copy,
  language,
  sourceKindOptions,
  value,
  onChange,
  labels
}: ReferencePanelProps) {
  const [bibleFocus, setBibleFocus] = useState(false);
  const [bibleIndex, setBibleIndex] = useState(-1);

  const bibleBookOptions = useMemo(() => {
    const lang = language;
    return (bibleBooks as Array<any>).map((book) => {
      const entry = book?.[lang] ?? book?.en ?? book?.la;
      const label = `${entry.abbr} — ${entry.name}`;
      return { label, latin: book?.la?.abbr ?? entry.abbr };
    });
  }, [language]);

  const filterBibleBooks = (query: string, includeAllIfEmpty = false) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return includeAllIfEmpty ? bibleBookOptions.slice(0, MAX_BIBLE_RESULTS) : [];
    }
    return bibleBookOptions.filter((option) => option.label.toLowerCase().includes(trimmed)).slice(0, MAX_BIBLE_RESULTS);
  };

  const resolveBibleBook = (input: string, lang: 'pl' | 'en' | 'de') => {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return null;
    const books = bibleBooks as Array<any>;
    for (const book of books) {
      const la = book?.la;
      const entry = book?.[lang] ?? book?.en ?? la;
      const abbr = entry?.abbr ?? '';
      const name = entry?.name ?? '';
      if (
        abbr.toLowerCase() === trimmed ||
        name.toLowerCase() === trimmed ||
        `${abbr} — ${name}`.toLowerCase() === trimmed
      ) {
        return { book, entry, la };
      }
    }
    return null;
  };

  useEffect(() => {
    if (value.sourceKind === 'bible' && value.locatorValue && !bibleFocus) {
      const match = resolveBibleBook(value.locatorValue, language);
      if (match) {
        const display = `${match.entry.abbr} — ${match.entry.name}`;
        if (display !== value.bibleBookDisplay) {
          onChange({ ...value, bibleBookDisplay: display });
        }
      }
    }
  }, [language, value, bibleFocus, onChange]);

  const update = (patch: Partial<ReferenceSourceForm>) => onChange({ ...value, ...patch });

  return (
    <>
      <label className="cogita-field full">
        <span>{labels.sourceKindLabel}</span>
        <select
          value={value.sourceKind}
          onChange={(event) =>
            update({
              sourceKind: event.target.value,
              churchDocument: null,
              bookMedia: null,
              work: null,
              locatorValue: '',
              locatorAux: '',
              bibleBookDisplay: ''
            })
          }
        >
          {sourceKindOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {value.sourceKind === 'bible' && (
        <>
          <div className="cogita-lookup full">
            <label className="cogita-field full">
              <span>{labels.bibleBookLabel}</span>
              <input
                type="text"
                value={value.bibleBookDisplay}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  update({ bibleBookDisplay: nextValue, locatorValue: '' });
                  setBibleFocus(true);
                  setBibleIndex(-1);
                }}
                onKeyDown={(event) => {
                  const options = filterBibleBooks(value.bibleBookDisplay);
                  if (!options.length) return;
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setBibleIndex((prev) => Math.min(prev + 1, options.length - 1));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setBibleIndex((prev) => Math.max(prev - 1, 0));
                  } else if (event.key === 'Enter' || event.key === 'Tab') {
                    if (bibleIndex >= 0 && options[bibleIndex]) {
                      const option = options[bibleIndex];
                      const match = resolveBibleBook(option.label, language);
                      if (!match) return;
                      update({ bibleBookDisplay: option.label, locatorValue: match.la?.abbr ?? value.locatorValue });
                      setBibleFocus(false);
                    }
                  }
                }}
                onFocus={() => setBibleFocus(true)}
                onBlur={() => window.setTimeout(() => setBibleFocus(false), 100)}
                placeholder={labels.bibleBookPlaceholder}
              />
            </label>
            {bibleFocus && filterBibleBooks(value.bibleBookDisplay, true).length > 0 && (
              <div className="cogita-lookup-results">
                {filterBibleBooks(value.bibleBookDisplay, true).map((option, index) => (
                  <button
                    key={option.latin}
                    type="button"
                    className="cogita-lookup-option"
                    data-active={index === bibleIndex}
                    tabIndex={-1}
                    onMouseDown={() => {
                      const match = resolveBibleBook(option.label, language);
                      if (!match) return;
                      update({ bibleBookDisplay: option.label, locatorValue: match.la?.abbr ?? value.locatorValue });
                    }}
                  >
                    <strong>{option.label}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="cogita-field full">
            <span>{labels.bibleRestLabel}</span>
            <input
              type="text"
              value={value.locatorAux}
              onChange={(event) => update({ locatorAux: event.target.value })}
              placeholder={labels.bibleRestPlaceholder}
            />
          </label>
        </>
      )}
      {value.sourceKind === 'website' && (
        <>
          <label className="cogita-field full">
            <span>{copy.cogita.library.add.info.sourceUrlLabel}</span>
            <input
              type="text"
              value={value.sourceUrl}
              onChange={(event) => update({ sourceUrl: event.target.value })}
              placeholder={copy.cogita.library.add.info.sourceUrlPlaceholder}
            />
          </label>
          <label className="cogita-field full">
            <span>{copy.cogita.library.add.info.sourceAccessedDateLabel}</span>
            <input
              type="text"
              value={value.sourceAccessedDate}
              onChange={(event) => update({ sourceAccessedDate: event.target.value })}
              placeholder={copy.cogita.library.add.info.sourceAccessedDatePlaceholder}
            />
          </label>
        </>
      )}
      {value.sourceKind === 'number_document' && (
        <>
          <InfoSearchSelect
            libraryId={libraryId}
            infoType="work"
            label={labels.churchDocumentLabel}
            placeholder={labels.churchDocumentPlaceholder}
            value={value.churchDocument}
            onChange={(next) => update({ churchDocument: next })}
            searchFailedText={copy.cogita.library.lookup.searchFailed}
            createFailedText={copy.cogita.library.lookup.createFailed}
            createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.work)}
            savingLabel={copy.cogita.library.lookup.saving}
            loadMoreLabel={copy.cogita.library.lookup.loadMore}
          />
          <label className="cogita-field full">
            <span>{labels.locatorLabel}</span>
            <input
              type="text"
              value={value.locatorValue}
              onChange={(event) => update({ locatorValue: event.target.value })}
              placeholder={labels.locatorPlaceholder}
            />
          </label>
        </>
      )}
      {value.sourceKind === 'work' && (
        <InfoSearchSelect
          libraryId={libraryId}
          infoType="work"
          label={labels.workLabel}
          placeholder={labels.workPlaceholder}
          value={value.work}
          onChange={(next) => update({ work: next })}
          searchFailedText={copy.cogita.library.lookup.searchFailed}
          createFailedText={copy.cogita.library.lookup.createFailed}
          createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.work)}
          savingLabel={copy.cogita.library.lookup.saving}
          loadMoreLabel={copy.cogita.library.lookup.loadMore}
        />
      )}
      {value.sourceKind === 'book' && (
        <>
          <InfoSearchSelect
            libraryId={libraryId}
            infoType="media"
            label={labels.bookLabel}
            placeholder={labels.bookPlaceholder}
            value={value.bookMedia}
            onChange={(next) => update({ bookMedia: next })}
            searchFailedText={copy.cogita.library.lookup.searchFailed}
            createFailedText={copy.cogita.library.lookup.createFailed}
            createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.media)}
            savingLabel={copy.cogita.library.lookup.saving}
            loadMoreLabel={copy.cogita.library.lookup.loadMore}
          />
          <label className="cogita-field full">
            <span>{labels.locatorLabel}</span>
            <input
              type="text"
              value={value.locatorValue}
              onChange={(event) => update({ locatorValue: event.target.value })}
              placeholder={labels.locatorPlaceholder}
            />
          </label>
        </>
      )}
      {value.sourceKind !== 'website' &&
        value.sourceKind !== 'bible' &&
        value.sourceKind !== 'book' &&
        value.sourceKind !== 'number_document' && (
          <label className="cogita-field full">
            <span>{labels.locatorLabel}</span>
            <input
              type="text"
              value={value.locatorValue}
              onChange={(event) => update({ locatorValue: event.target.value })}
              placeholder={labels.locatorPlaceholder}
            />
          </label>
        )}
    </>
  );
}
