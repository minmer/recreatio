import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import bibleBooks from '../../../../../content/bibleBooks.json';
import {
  ApiError,
  createCogitaInfo,
  getCogitaInfoDetail,
  getCogitaInfoTypeSpecification,
  searchCogitaInfos,
  updateCogitaInfo,
  type CogitaInfoLinkFieldSpec,
  type CogitaInfoPayloadFieldSpec,
  type CogitaInfoTypeSpecification
} from '../../../../../lib/api';
import { CogitaShell } from '../../../CogitaShell';
import type { Copy } from '../../../../../content/types';
import type { RouteKey } from '../../../../../types/navigation';
import type { CogitaInfoOption, CogitaInfoType } from '../../types';
import { getInfoTypeLabel } from '../../libraryOptions';
import { useCogitaLibraryMeta } from '../../useCogitaLibraryMeta';
import {
  SOURCE_KIND_OPTIONS,
  buildReferenceSourceLabel,
  buildSourceLocatorPayload,
  createEmptyReferenceSourceForm,
  getReferenceResource,
  parseReferenceFormFromSourceValues,
  NotionTypePayloadShell,
  type ReferenceSourceForm
} from './types/shell';
import {
  createDefaultComputedDefinition,
  parseComputedDefinitionFromPayload,
  serializeComputedDefinition,
  type ComputedDefinition
} from './types/notionComputed';
import {
  createDefaultQuestionDefinition,
  normalizeQuestionDefinition,
  parseQuestionDefinitionFromPayload,
  QUESTION_DEFINITION_TEMPLATE,
  serializeQuestionDefinition,
  type QuestionDefinition
} from './types/notionQuestion';

type InfoSearchSelectCommonProps = {
  libraryId: string;
  infoType: CogitaInfoType;
  label: string;
  placeholder?: string;
  helperText?: string;
  searchFailedText?: string;
  createFailedText?: string;
  createLabel?: string;
  savingLabel?: string;
  loadMoreLabel?: string;
  allowCreate?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  autoAdvance?: boolean;
  onCommit?: () => void;
};

type InfoSearchSelectSingleProps = InfoSearchSelectCommonProps & {
  multiple?: false;
  value: CogitaInfoOption | null;
  onChange: (value: CogitaInfoOption | null) => void;
  values?: never;
  onChangeMultiple?: never;
};

type InfoSearchSelectMultiProps = InfoSearchSelectCommonProps & {
  multiple: true;
  values: CogitaInfoOption[];
  onChangeMultiple: (values: CogitaInfoOption[]) => void;
  value?: never;
  onChange?: never;
};

type InfoSearchSelectProps = InfoSearchSelectSingleProps | InfoSearchSelectMultiProps;

const MAX_INFO_RESULTS = 5;
const MAX_INFO_RESULTS_PER_REQUEST = 50;
const MIN_INFO_QUERY_LENGTH = 2;
const EMPTY_INFO_OPTIONS: CogitaInfoOption[] = [];

export function InfoSearchSelect({
  libraryId,
  infoType,
  label,
  placeholder,
  value,
  onChange,
  values,
  onChangeMultiple,
  helperText,
  searchFailedText,
  createFailedText,
  createLabel,
  savingLabel,
  loadMoreLabel,
  allowCreate = true,
  inputRef,
  autoAdvance,
  onCommit,
  multiple
}: InfoSearchSelectProps) {
  const selectedValues = multiple ? values ?? EMPTY_INFO_OPTIONS : EMPTY_INFO_OPTIONS;
  const [query, setQuery] = useState(multiple ? '' : value?.label ?? '');
  const [results, setResults] = useState<CogitaInfoOption[]>([]);
  const [visibleCount, setVisibleCount] = useState(MAX_INFO_RESULTS);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRequest = useRef(0);
  const cacheRef = useRef(new Map<string, CogitaInfoOption[]>());

  const showCreate = useMemo(() => {
    if (!allowCreate) return false;
    if (multiple) {
      return query.trim().length > 0;
    }
    return query.trim().length > 0 && !value;
  }, [allowCreate, query, value, multiple]);

  useEffect(() => {
    if (!multiple) {
      setQuery(value?.label ?? '');
    }
  }, [value, multiple]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < MIN_INFO_QUERY_LENGTH) {
      setResults([]);
      setIsOpen(false);
      setVisibleCount(MAX_INFO_RESULTS);
      setHighlightedIndex(-1);
      setIsLoading(false);
      setError(null);
      return;
    }

    const normalizedQuery = trimmed.toLowerCase();
    const cacheKey = `${libraryId}:${infoType}:${normalizedQuery}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      if (multiple && selectedValues.length > 0) {
        const selectedIds = new Set(selectedValues.map((item) => item.id));
        setResults(cached.filter((item) => !selectedIds.has(item.id)));
      } else {
        setResults(cached);
      }
      setVisibleCount(MAX_INFO_RESULTS);
      setHighlightedIndex(-1);
      setIsOpen(cached.length > 0);
      setIsLoading(false);
      setError(null);
      return;
    }

    const requestId = window.setTimeout(async () => {
      const currentRequest = Date.now();
      lastRequest.current = currentRequest;
      setIsLoading(true);
      setError(null);
      try {
        const matches = await searchCogitaInfos({
          libraryId,
          type: infoType,
          query: trimmed,
          limit: MAX_INFO_RESULTS_PER_REQUEST
        });
        if (lastRequest.current !== currentRequest) return;
        const mapped = matches.slice(0, MAX_INFO_RESULTS_PER_REQUEST).map((match) => ({
          id: match.infoId,
          label: match.label,
          infoType: match.infoType as CogitaInfoType
        }));
        cacheRef.current.set(cacheKey, mapped);
        if (multiple && selectedValues.length > 0) {
          const selectedIds = new Set(selectedValues.map((item) => item.id));
          setResults(mapped.filter((item) => !selectedIds.has(item.id)));
        } else {
          setResults(mapped);
        }
        setVisibleCount(MAX_INFO_RESULTS);
        setHighlightedIndex(-1);
        setIsOpen(true);
      } catch {
        if (lastRequest.current !== currentRequest) return;
        setError(searchFailedText ?? 'Search failed.');
      } finally {
        if (lastRequest.current === currentRequest) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(requestId);
  }, [libraryId, infoType, query, selectedValues, searchFailedText, multiple]);

  const handleSelect = (option: CogitaInfoOption) => {
    if (multiple) {
      const next = selectedValues.some((item) => item.id === option.id)
        ? selectedValues
        : [...selectedValues, option];
      onChangeMultiple?.(next);
      setQuery('');
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }
    onChange?.(option);
    setQuery(option.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (autoAdvance) {
      onCommit?.();
    }
  };

  const handleCreate = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError(null);
    try {
      const created = await createCogitaInfo({
        libraryId,
        infoType,
        payload: { label: trimmed }
      });
      const createdOption = { id: created.infoId, label: trimmed, infoType: created.infoType as CogitaInfoType };
      if (trimmed.length >= MIN_INFO_QUERY_LENGTH) {
        const cacheKey = `${libraryId}:${infoType}:${trimmed.toLowerCase()}`;
        const existing = cacheRef.current.get(cacheKey) ?? [];
        cacheRef.current.set(cacheKey, [createdOption, ...existing]);
      }
      if (multiple) {
        onChangeMultiple?.([...selectedValues, createdOption]);
        setQuery('');
        setIsOpen(false);
        setHighlightedIndex(-1);
        return;
      }
      onChange?.(createdOption);
      setIsOpen(false);
      setHighlightedIndex(-1);
      if (autoAdvance) {
        onCommit?.();
      }
    } catch {
      setError(createFailedText ?? 'Create failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="cogita-lookup">
      <label className="cogita-field">
        <span>{label}</span>
        <input
          ref={inputRef}
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!multiple && value) onChange?.(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (!results.length) return;
              setIsOpen(true);
              setHighlightedIndex((prev) => {
                const maxVisibleIndex = Math.min(results.length, visibleCount) - 1;
                const next = prev < 0 ? 0 : Math.min(prev + 1, maxVisibleIndex);
                if (next === maxVisibleIndex && results.length > visibleCount) {
                  setVisibleCount((count) => Math.min(count + MAX_INFO_RESULTS, results.length));
                  return Math.min(prev + 1, Math.min(results.length, visibleCount + MAX_INFO_RESULTS) - 1);
                }
                return next;
              });
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              if (!results.length) return;
              setIsOpen(true);
              setHighlightedIndex((prev) => (prev <= 0 ? 0 : prev - 1));
              return;
            }
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (highlightedIndex >= 0 && results[highlightedIndex]) {
              handleSelect(results[highlightedIndex]);
              return;
            }
            if (showCreate) {
              handleCreate();
            }
          }}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        />
      </label>
      {helperText ? <p className="cogita-help">{helperText}</p> : null}
      {error ? <p className="cogita-form-error">{error}</p> : null}
      {multiple && selectedValues.length > 0 ? (
        <div className="cogita-lookup-values">
          {selectedValues.map((option) => (
            <button
              key={option.id}
              type="button"
              className="ghost"
              onClick={() => onChangeMultiple?.(selectedValues.filter((item) => item.id !== option.id))}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {isOpen && (results.length > 0 || showCreate) ? (
        <div className="cogita-lookup-results">
          {results.slice(0, visibleCount).map((option, index) => (
            <button
              key={option.id}
              type="button"
              className="cogita-lookup-option"
              data-active={index === highlightedIndex}
              onMouseDown={() => handleSelect(option)}
            >
              <strong>{option.label}</strong>
              <span>{option.infoType}</span>
            </button>
          ))}
          {results.length > visibleCount ? (
            <button type="button" className="cogita-lookup-more" onMouseDown={() => setVisibleCount((count) => count + MAX_INFO_RESULTS)}>
              {loadMoreLabel ?? 'Load more'}
            </button>
          ) : null}
          {showCreate ? (
            <button type="button" className="cogita-lookup-create" onMouseDown={handleCreate} disabled={isLoading}>
              {isLoading ? savingLabel ?? 'Saving…' : createLabel ?? `Create "${query.trim()}"`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const MAX_BIBLE_RESULTS = 8;

function ReferencePanel({
  libraryId,
  copy,
  language,
  sourceKindOptions,
  value,
  onChange,
  labels
}: {
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
}) {
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

type LinkTypeSelectionState = Record<string, CogitaInfoType>;

function normalizePayloadValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function resolveInfoLabel(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const data = payload as Record<string, unknown>;
  const definition = (data.definition && typeof data.definition === 'object' ? (data.definition as Record<string, unknown>) : null);
  const candidates = [data.label, data.name, data.title, data.text, data.orcid, data.email, data.number];
  if (definition) {
    candidates.unshift(definition.title, definition.question);
  }
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return fallback;
}

function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }

  const raw = error.message?.trim();
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    // Keep raw message fallback.
  }

  return raw;
}

export type CogitaNotionCreated = {
  infoId: string;
  infoType: string;
  label: string;
};

export type CogitaNotionEditProps = {
  copy: Copy;
  authLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  libraryId: string;
  editInfoId?: string;
  onCreated?: (item: CogitaNotionCreated) => void;
};

export function CogitaNotionEdit({
  copy,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange,
  libraryId,
  editInfoId,
  onCreated
}: CogitaNotionEditProps) {
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const isEditMode = Boolean(editInfoId);
  const [specifications, setSpecifications] = useState<CogitaInfoTypeSpecification[]>([]);
  const [selectedInfoType, setSelectedInfoType] = useState<CogitaInfoType>('word');
  const [payloadValues, setPayloadValues] = useState<Record<string, string>>({});
  const [singleLinks, setSingleLinks] = useState<Record<string, CogitaInfoOption | null>>({});
  const [multiLinks, setMultiLinks] = useState<Record<string, CogitaInfoOption[]>>({});
  const [linkTypeSelections, setLinkTypeSelections] = useState<LinkTypeSelectionState>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<'idle' | 'loading' | 'saving'>('idle');
  const [sourceReferenceForm, setSourceReferenceForm] = useState<ReferenceSourceForm>(createEmptyReferenceSourceForm);
  const [inlineReferenceEnabled, setInlineReferenceEnabled] = useState<Record<string, boolean>>({});
  const [inlineReferenceForms, setInlineReferenceForms] = useState<Record<string, ReferenceSourceForm>>({});
  const [inlineReferenceStatus, setInlineReferenceStatus] = useState<Record<string, string | null>>({});
  const [inlineReferenceSavingField, setInlineReferenceSavingField] = useState<string | null>(null);
  const [computedDefinition, setComputedDefinition] = useState<ComputedDefinition>(createDefaultComputedDefinition);
  const [questionDefinition, setQuestionDefinition] = useState<QuestionDefinition>(() =>
    normalizeQuestionDefinition(JSON.parse(QUESTION_DEFINITION_TEMPLATE)) ?? createDefaultQuestionDefinition()
  );
  const [questionImportJson, setQuestionImportJson] = useState(QUESTION_DEFINITION_TEMPLATE);
  const [questionImportQueue, setQuestionImportQueue] = useState<QuestionDefinition[]>([]);
  const [questionImportQueueIndex, setQuestionImportQueueIndex] = useState(0);

  const currentSpec = useMemo(
    () => specifications.find((spec) => spec.infoType === selectedInfoType),
    [selectedInfoType, specifications]
  );
  const sourceSpec = useMemo(
    () => specifications.find((spec) => spec.infoType === 'source'),
    [specifications]
  );
  const infoTypeOptions = useMemo(
    () =>
      specifications.map((spec) => ({
        value: spec.infoType as CogitaInfoType,
        label: getInfoTypeLabel(copy, spec.infoType as CogitaInfoType)
      })),
    [copy, specifications]
  );

  const applyQuestionDefinition = (next: QuestionDefinition) => {
    const normalized = normalizeQuestionDefinition(next) ?? createDefaultQuestionDefinition();
    const serialized = serializeQuestionDefinition(normalized);
    setQuestionDefinition(normalized);
    setPayloadValues((prev) => ({ ...prev, definition: serialized }));
  };

  useEffect(() => {
    let cancelled = false;
    getCogitaInfoTypeSpecification({ libraryId })
      .then((items) => {
        if (cancelled) return;
        setSpecifications(items);
        if (!isEditMode) {
          const first = items[0]?.infoType as CogitaInfoType | undefined;
          if (first) setSelectedInfoType(first);
        }
      })
      .catch(() => {
        if (!cancelled) setSpecifications([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isEditMode, libraryId]);

  useEffect(() => {
    if (isEditMode) return;
    if (!currentSpec) return;
    const payload: Record<string, string> = {};
    const single: Record<string, CogitaInfoOption | null> = {};
    const multi: Record<string, CogitaInfoOption[]> = {};
    const linkTypes: LinkTypeSelectionState = {};

    for (const field of currentSpec.payloadFields) {
      if (currentSpec.infoType === 'question' && field.key === 'definition' && field.inputType === 'json') {
        payload[field.key] = QUESTION_DEFINITION_TEMPLATE;
      } else if (currentSpec.infoType === 'computed' && field.key === 'definition' && field.inputType === 'json') {
        payload[field.key] = serializeComputedDefinition(createDefaultComputedDefinition());
      } else {
        payload[field.key] = '';
      }
    }
    for (const link of currentSpec.linkFields) {
      if (link.multiple) {
        multi[link.key] = [];
      } else {
        single[link.key] = null;
      }
      if (link.targetTypes.length > 0) {
        linkTypes[link.key] = link.targetTypes[0] as CogitaInfoType;
      }
    }

    setPayloadValues(payload);
    setSingleLinks(single);
    setMultiLinks(multi);
    setLinkTypeSelections(linkTypes);
  }, [currentSpec?.infoType, isEditMode]);

  useEffect(() => {
    if (selectedInfoType !== 'question') return;
    const normalized = parseQuestionDefinitionFromPayload(payloadValues.definition);
    if (!normalized) {
      const fallback = normalizeQuestionDefinition(JSON.parse(QUESTION_DEFINITION_TEMPLATE)) ?? createDefaultQuestionDefinition();
      setQuestionDefinition(fallback);
      setQuestionImportJson(QUESTION_DEFINITION_TEMPLATE);
      setPayloadValues((prev) => (prev.definition === QUESTION_DEFINITION_TEMPLATE ? prev : { ...prev, definition: QUESTION_DEFINITION_TEMPLATE }));
      return;
    }
    setQuestionDefinition(normalized);
    if (questionImportQueue.length === 0) {
      setQuestionImportJson(serializeQuestionDefinition(normalized));
    }
  }, [payloadValues.definition, questionImportQueue.length, selectedInfoType]);

  useEffect(() => {
    if (selectedInfoType !== 'computed') return;
    const normalized = parseComputedDefinitionFromPayload(payloadValues.definition);
    if (!normalized) {
      const fallback = createDefaultComputedDefinition();
      setComputedDefinition(fallback);
      if (!String(payloadValues.definition ?? '').trim()) {
        setPayloadValues((prev) => ({ ...prev, definition: serializeComputedDefinition(fallback) }));
      }
      return;
    }
    setComputedDefinition(normalized);
  }, [payloadValues.definition, selectedInfoType]);

  useEffect(() => {
    if (!isEditMode || !editInfoId || specifications.length === 0) return;
    let cancelled = false;
    setLoading('loading');
    setStatus(null);

    const load = async () => {
      const detail = await getCogitaInfoDetail({ libraryId, infoId: editInfoId });
      if (cancelled) return;

      const type = detail.infoType as CogitaInfoType;
      setSelectedInfoType(type);
      const spec = specifications.find((item) => item.infoType === type);
      if (!spec) {
        setLoading('idle');
        return;
      }

      const payloadRecord = (detail.payload ?? {}) as Record<string, unknown>;
      const nextPayloadValues: Record<string, string> = {};
      for (const field of spec.payloadFields) {
        nextPayloadValues[field.key] = normalizePayloadValue(payloadRecord[field.key]);
      }
      setPayloadValues(nextPayloadValues);

      const linksRecord = ((detail.links ?? {}) as Record<string, unknown>) ?? {};
      const nextSingle: Record<string, CogitaInfoOption | null> = {};
      const nextMulti: Record<string, CogitaInfoOption[]> = {};
      const nextLinkTypes: LinkTypeSelectionState = {};

      const optionPromises: Array<Promise<void>> = [];
      for (const linkField of spec.linkFields) {
        if (linkField.targetTypes.length > 0) {
          nextLinkTypes[linkField.key] = linkField.targetTypes[0] as CogitaInfoType;
        }

        const rawValue = linksRecord[linkField.key];
        if (linkField.multiple) {
          const ids = Array.isArray(rawValue) ? rawValue.filter((value) => typeof value === 'string') as string[] : [];
          nextMulti[linkField.key] = [];
          for (const id of ids) {
            optionPromises.push(
              getCogitaInfoDetail({ libraryId, infoId: id })
                .then((linked) => {
                  if (cancelled) return;
                  const option: CogitaInfoOption = {
                    id,
                    infoType: linked.infoType as CogitaInfoType,
                    label: resolveInfoLabel(linked.payload, id)
                  };
                  nextLinkTypes[linkField.key] = option.infoType;
                  nextMulti[linkField.key] = [...nextMulti[linkField.key], option];
                })
                .catch(() => undefined)
            );
          }
        } else {
          const id = typeof rawValue === 'string' ? rawValue : null;
          nextSingle[linkField.key] = null;
          if (id) {
            optionPromises.push(
              getCogitaInfoDetail({ libraryId, infoId: id })
                .then((linked) => {
                  if (cancelled) return;
                  const option: CogitaInfoOption = {
                    id,
                    infoType: linked.infoType as CogitaInfoType,
                    label: resolveInfoLabel(linked.payload, id)
                  };
                  nextLinkTypes[linkField.key] = option.infoType;
                  nextSingle[linkField.key] = option;
                })
                .catch(() => undefined)
            );
          }
        }
      }

      await Promise.all(optionPromises);
      if (cancelled) return;
      setSingleLinks(nextSingle);
      setMultiLinks(nextMulti);
      setLinkTypeSelections(nextLinkTypes);
      setLoading('idle');
    };

    load().catch(() => {
      if (!cancelled) {
        setStatus('Failed to load info details.');
        setLoading('idle');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [editInfoId, isEditMode, libraryId, specifications]);

  useEffect(() => {
    if (selectedInfoType !== 'source') return;
    setSourceReferenceForm(parseReferenceFormFromSourceValues(payloadValues, singleLinks.resource ?? null));
  }, [
    selectedInfoType,
    payloadValues.sourceKind,
    payloadValues.locator,
    singleLinks.resource?.id,
    singleLinks.resource?.infoType,
    singleLinks.resource?.label
  ]);

  const resetReferenceFormAfterCreate = (form: ReferenceSourceForm) => {
    const keepSourceKind = sourceSpec?.payloadFields.find((field) => field.key === 'sourceKind')?.keepOnCreate ?? false;
    const keepResource = sourceSpec?.linkFields.find((field) => field.key === 'resource')?.keepOnCreate ?? false;
    const next = createEmptyReferenceSourceForm();
    next.sourceKind = keepSourceKind ? form.sourceKind : next.sourceKind;
    if (keepResource) {
      next.work = form.work;
      next.bookMedia = form.bookMedia;
      next.churchDocument = form.churchDocument;
    }
    if (keepSourceKind && form.sourceKind === 'bible') {
      next.locatorValue = form.locatorValue;
      next.bibleBookDisplay = form.bibleBookDisplay;
    }
    if (keepSourceKind && form.sourceKind === 'website') {
      next.sourceUrl = form.sourceUrl;
      next.sourceAccessedDate = form.sourceAccessedDate;
    }
    return next;
  };

  const referencePanelLabels = useMemo(
    () => ({
      sourceKindLabel: copy.cogita.library.add.info.sourceKindLabel,
      bibleBookLabel: copy.cogita.library.add.info.sourceBibleBookLabel,
      bibleBookPlaceholder: copy.cogita.library.add.info.sourceBibleBookPlaceholder,
      bibleRestLabel: copy.cogita.library.add.info.sourceBibleRestLabel,
      bibleRestPlaceholder: copy.cogita.library.add.info.sourceBibleRestPlaceholder,
      churchDocumentLabel: copy.cogita.library.add.info.sourceResourceLabel,
      churchDocumentPlaceholder: copy.cogita.library.add.info.sourceResourcePlaceholder,
      workLabel: copy.cogita.library.add.info.sourceResourceLabel,
      workPlaceholder: copy.cogita.library.add.info.sourceResourcePlaceholder,
      bookLabel: copy.cogita.library.add.info.sourceResourceLabel,
      bookPlaceholder: copy.cogita.library.add.info.sourceResourcePlaceholder,
      locatorLabel: copy.cogita.library.list.typeFilterLocator,
      locatorPlaceholder: copy.cogita.library.list.typeFilterLocator
    }),
    [copy]
  );

  const handleInlineReferenceCreate = async (fieldKey: string) => {
    const form = inlineReferenceForms[fieldKey] ?? createEmptyReferenceSourceForm();
    if (!validateReferenceSourceForm(form)) {
      setInlineReferenceStatus((prev) => ({ ...prev, [fieldKey]: copy.cogita.library.add.info.referenceMissingSource }));
      return;
    }

    setInlineReferenceSavingField(fieldKey);
    setInlineReferenceStatus((prev) => ({ ...prev, [fieldKey]: null }));
    try {
      const resource = getReferenceResource(form);
      const links = resource ? { resource: resource.id } : {};
      const payload = {
        label: buildReferenceSourceLabel(form),
        sourceKind: form.sourceKind.trim(),
        locator: buildSourceLocatorPayload(form)
      };
      const created = await createCogitaInfo({
        libraryId,
        infoType: 'source',
        payload,
        links
      });
      const option: CogitaInfoOption = {
        id: created.infoId,
        infoType: 'source',
        label: payload.label
      };
      setMultiLinks((prev) => {
        const current = prev[fieldKey] ?? [];
        if (current.some((item) => item.id === option.id)) return prev;
        return { ...prev, [fieldKey]: [...current, option] };
      });
      if (isEditMode && editInfoId) {
        const currentDetail = await getCogitaInfoDetail({ libraryId, infoId: editInfoId });
        const nextLinks: Record<string, string | string[] | null> =
          currentDetail.links && typeof currentDetail.links === 'object'
            ? ({ ...(currentDetail.links as Record<string, string | string[] | null>) })
            : {};
        const currentFieldValue = nextLinks[fieldKey];
        const nextIds = Array.isArray(currentFieldValue)
          ? currentFieldValue.filter((value): value is string => typeof value === 'string')
          : typeof currentFieldValue === 'string'
            ? [currentFieldValue]
            : [];
        if (!nextIds.includes(option.id)) {
          nextLinks[fieldKey] = [...nextIds, option.id];
          await updateCogitaInfo({
            libraryId,
            infoId: editInfoId,
            payload: currentDetail.payload,
            links: nextLinks
          });
        }
      }
      setInlineReferenceForms((prev) => ({ ...prev, [fieldKey]: resetReferenceFormAfterCreate(form) }));
      setInlineReferenceStatus((prev) => ({ ...prev, [fieldKey]: null }));
    } catch (error) {
      setInlineReferenceStatus((prev) => ({
        ...prev,
        [fieldKey]: extractApiErrorMessage(error, copy.cogita.library.lookup.createFailed)
      }));
    } finally {
      setInlineReferenceSavingField((current) => (current === fieldKey ? null : current));
    }
  };

  const handleSave = async () => {
    if (!currentSpec) return;

    const payload: Record<string, unknown> = {};
    for (const field of currentSpec.payloadFields) {
      if (selectedInfoType === 'source' && (field.key === 'sourceKind' || field.key === 'locator')) {
        continue;
      }
      const raw = (payloadValues[field.key] ?? '').trim();
      if (!raw) {
        if (field.required) {
          setStatus(`Field '${field.label}' is required.`);
          return;
        }
        continue;
      }

      if (field.inputType === 'json') {
        try {
          payload[field.key] = JSON.parse(raw);
        } catch {
          setStatus(`Field '${field.label}' must be valid JSON.`);
          return;
        }
      } else {
        payload[field.key] = raw;
      }
    }

    const links: Record<string, string | string[] | null> = {};
    for (const linkField of currentSpec.linkFields) {
      if (selectedInfoType === 'source' && linkField.key === 'resource') {
        continue;
      }
      if (linkField.multiple) {
        const values = (multiLinks[linkField.key] ?? []).map((item) => item.id);
        if (linkField.required && values.length === 0) {
          setStatus(`Link '${linkField.label}' is required.`);
          return;
        }
        if (values.length > 0) {
          links[linkField.key] = values;
        }
      } else {
        const value = singleLinks[linkField.key]?.id ?? null;
        if (linkField.required && !value) {
          setStatus(`Link '${linkField.label}' is required.`);
          return;
        }
        if (value) {
          links[linkField.key] = value;
        }
      }
    }

    if (selectedInfoType === 'source') {
      if (!validateReferenceSourceForm(sourceReferenceForm)) {
        setStatus(copy.cogita.library.add.info.referenceMissingSource);
        return;
      }

      const sourceKind = sourceReferenceForm.sourceKind.trim();
      payload.sourceKind = sourceKind;
      payload.locator = buildSourceLocatorPayload(sourceReferenceForm);
      if (typeof payload.label !== 'string' || !payload.label.trim()) {
        payload.label = buildReferenceSourceLabel(sourceReferenceForm);
      }

      const resource = getReferenceResource(sourceReferenceForm);
      if (resource) {
        links.resource = resource.id;
      }
    }

    setLoading('saving');
    setStatus(null);
    try {
      if (isEditMode && editInfoId) {
        await updateCogitaInfo({
          libraryId,
          infoId: editInfoId,
          payload,
          links
        });
        setStatus('Notion updated.');
      } else {
        const created = await createCogitaInfo({
          libraryId,
          infoType: selectedInfoType,
          payload,
          links
        });
        onCreated?.({
          infoId: created.infoId,
          infoType: created.infoType,
          label: resolveInfoLabel(payload, created.infoId)
        });
        const hasQueuedQuestionImport =
          selectedInfoType === 'question' &&
          questionImportQueue.length > 0 &&
          questionImportQueueIndex < questionImportQueue.length - 1;

        if (hasQueuedQuestionImport) {
          const nextIndex = questionImportQueueIndex + 1;
          const nextDefinition = questionImportQueue[nextIndex] ?? null;
          if (nextDefinition) {
            const serializedNext = serializeQuestionDefinition(nextDefinition);
            setQuestionImportQueueIndex(nextIndex);
            setQuestionDefinition(nextDefinition);
            setPayloadValues((prev) => ({ ...prev, definition: serializedNext }));
            setStatus(`Notion saved. Loaded next question (${nextIndex + 1}/${questionImportQueue.length}).`);
          } else {
            setStatus('Notion saved.');
          }
        } else {
          if (selectedInfoType === 'question' && questionImportQueue.length > 0) {
            setQuestionImportQueue([]);
            setQuestionImportQueueIndex(0);
          }
          setStatus('Notion saved.');
        }

        const nextPayload: Record<string, string> = {};
        for (const field of currentSpec.payloadFields) {
          nextPayload[field.key] = field.keepOnCreate ? (payloadValues[field.key] ?? '') : '';
        }
        if (hasQueuedQuestionImport) {
          const activeDefinition = questionImportQueue[Math.min(questionImportQueueIndex + 1, questionImportQueue.length - 1)];
          if (activeDefinition) {
            nextPayload.definition = serializeQuestionDefinition(activeDefinition);
          }
        }
        setPayloadValues(nextPayload);

        const nextSingle: Record<string, CogitaInfoOption | null> = {};
        const nextMulti: Record<string, CogitaInfoOption[]> = {};
        for (const link of currentSpec.linkFields) {
          if (link.multiple) nextMulti[link.key] = link.keepOnCreate ? (multiLinks[link.key] ?? []) : [];
          else nextSingle[link.key] = link.keepOnCreate ? (singleLinks[link.key] ?? null) : null;
        }
        setSingleLinks((prev) => ({ ...prev, ...nextSingle }));
        setMultiLinks((prev) => ({ ...prev, ...nextMulti }));
        if (selectedInfoType === 'source') {
          setSourceReferenceForm((prev) => {
            const next = resetReferenceFormAfterCreate(prev);
            const nextResource = getReferenceResource(next);
            setPayloadValues((current) => ({
              ...current,
              sourceKind: next.sourceKind,
              locator: normalizePayloadValue(buildSourceLocatorPayload(next))
            }));
            setSingleLinks((current) => ({ ...current, resource: nextResource }));
            if (nextResource) {
              setLinkTypeSelections((current) => ({ ...current, resource: nextResource.infoType }));
            }
            return next;
          });
        }
      }
    } catch (error) {
      setStatus(extractApiErrorMessage(error, 'Failed to save info.'));
    } finally {
      setLoading('idle');
    }
  };

  const handleInterpretQuestionJson = () => {
    try {
      const parsed = JSON.parse(questionImportJson);
      if (Array.isArray(parsed)) {
        const normalizedItems = parsed
          .map((item) => normalizeQuestionDefinition(item))
          .filter((item): item is QuestionDefinition => Boolean(item));
        if (normalizedItems.length === 0) {
          setStatus('Question JSON array must contain at least one valid question object.');
          return;
        }
        const first = normalizedItems[0];
        setQuestionImportQueue(normalizedItems);
        setQuestionImportQueueIndex(0);
        applyQuestionDefinition(first);
        setStatus(`Loaded question array (${normalizedItems.length} items).`);
        return;
      }
      const normalized = normalizeQuestionDefinition(parsed);
      if (!normalized) {
        setStatus('Question JSON must be an object or an array of question objects.');
        return;
      }
      setQuestionImportQueue([]);
      setQuestionImportQueueIndex(0);
      applyQuestionDefinition(normalized);
      setStatus(null);
    } catch {
      setStatus('Question JSON is invalid.');
    }
  };

  const renderPayloadField = (field: CogitaInfoPayloadFieldSpec) => {
    const value = payloadValues[field.key] ?? '';
    return (
      <NotionTypePayloadShell
        key={`payload:${field.key}`}
        copy={copy}
        infoType={selectedInfoType}
        field={field}
        value={value}
        onValueChange={(nextValue) => setPayloadValues((prev) => ({ ...prev, [field.key]: nextValue }))}
        questionEditor={
          selectedInfoType === 'question'
            ? {
                definition: questionDefinition,
                onDefinitionChange: applyQuestionDefinition,
                importJson: questionImportJson,
                onImportJsonChange: setQuestionImportJson,
                onInterpretJson: handleInterpretQuestionJson,
                importQueueLength: questionImportQueue.length,
                importQueueIndex: questionImportQueueIndex
              }
            : undefined
        }
        computedEditor={
          selectedInfoType === 'computed'
            ? {
                definition: computedDefinition,
                onDefinitionChange: (next) => {
                  setComputedDefinition(next);
                  setPayloadValues((prev) => ({ ...prev, definition: serializeComputedDefinition(next) }));
                }
              }
            : undefined
        }
      />
    );
  };

  const renderLinkField = (field: CogitaInfoLinkFieldSpec) => {
    const targetType = (linkTypeSelections[field.key] ?? field.targetTypes[0]) as CogitaInfoType;
    const isReferenceAttachmentField = field.key === 'references' && field.multiple && field.targetTypes.includes('source');
    const inlineReferenceForm = inlineReferenceForms[field.key] ?? createEmptyReferenceSourceForm();
    const inlineReferenceOpen = inlineReferenceEnabled[field.key] ?? false;
    const inlineStatus = inlineReferenceStatus[field.key];
    return (
      <div key={`link:${field.key}`} className="cogita-field full">
        <span>{field.label}</span>
        {field.targetTypes.length > 1 ? (
          <select
            value={targetType}
            onChange={(event) => setLinkTypeSelections((prev) => ({ ...prev, [field.key]: event.target.value as CogitaInfoType }))}
          >
            {field.targetTypes.map((type) => (
              <option key={`${field.key}:${type}`} value={type}>
                {getInfoTypeLabel(copy, type as CogitaInfoType | 'any' | 'vocab')}
              </option>
            ))}
          </select>
        ) : null}
        {field.multiple ? (
          <InfoSearchSelect
            libraryId={libraryId}
            infoType={targetType}
            label={field.label}
            placeholder={field.key}
            multiple
            values={multiLinks[field.key] ?? []}
            onChangeMultiple={(values) => setMultiLinks((prev) => ({ ...prev, [field.key]: values }))}
            allowCreate={!isReferenceAttachmentField}
            searchFailedText="Search failed"
            createFailedText="Create failed"
          />
        ) : (
          <InfoSearchSelect
            libraryId={libraryId}
            infoType={targetType}
            label={field.label}
            placeholder={field.key}
            value={singleLinks[field.key] ?? null}
            onChange={(value) => setSingleLinks((prev) => ({ ...prev, [field.key]: value }))}
            searchFailedText="Search failed"
            createFailedText="Create failed"
          />
        )}
        {isReferenceAttachmentField ? (
          <div>
            <label className="cogita-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={inlineReferenceOpen}
                onChange={(event) =>
                  setInlineReferenceEnabled((prev) => ({ ...prev, [field.key]: event.target.checked }))
                }
              />
              <span>{copy.cogita.library.add.info.referenceToggle}</span>
            </label>
            {inlineReferenceOpen ? (
              <div className="cogita-library-panel">
                <p className="cogita-user-kicker">{copy.cogita.library.add.info.referenceTitle}</p>
                <ReferencePanel
                  libraryId={libraryId}
                  copy={copy}
                  language={language}
                  sourceKindOptions={[...SOURCE_KIND_OPTIONS]}
                  value={inlineReferenceForm}
                  onChange={(next) => setInlineReferenceForms((prev) => ({ ...prev, [field.key]: next }))}
                  labels={referencePanelLabels}
                />
                <div className="cogita-form-actions">
                  <button
                    type="button"
                    className="cta ghost"
                    onClick={() => handleInlineReferenceCreate(field.key)}
                    disabled={inlineReferenceSavingField === field.key}
                  >
                    {inlineReferenceSavingField === field.key
                      ? copy.cogita.library.lookup.saving
                      : copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.source)}
                  </button>
                </div>
                {inlineStatus ? <p className="cogita-library-subtitle">{inlineStatus}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderSourceReferenceEditor = () => (
    <div className="cogita-library-panel">
      <p className="cogita-user-kicker">{copy.cogita.library.add.info.referenceTitle}</p>
      <ReferencePanel
        libraryId={libraryId}
        copy={copy}
        language={language}
        sourceKindOptions={[...SOURCE_KIND_OPTIONS]}
        value={sourceReferenceForm}
        onChange={setSourceReferenceForm}
        labels={referencePanelLabels}
      />
    </div>
  );

  return (
    <CogitaShell
      copy={copy}
      authLabel={authLabel}
      showProfileMenu={showProfileMenu}
      onProfileNavigate={onProfileNavigate}
      onToggleSecureMode={onToggleSecureMode}
      onLogout={onLogout}
      secureMode={secureMode}
      onNavigate={onNavigate}
      language={language}
      onLanguageChange={onLanguageChange}
    >
      <section className="cogita-library-dashboard" data-mode="detail">
        <header className="cogita-library-dashboard-header">
          <div>
            <p className="cogita-user-kicker">{isEditMode ? 'Edit notion' : 'Create notion'}</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">Specification-driven editor</p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href={`/#/cogita/workspace/libraries/${libraryId}/notions`}>
              Back to list
            </a>
          </div>
        </header>

        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <article className="cogita-library-panel">
              {!isEditMode ? (
                <label className="cogita-field full">
                  <span>Notion type</span>
                  <select value={selectedInfoType} onChange={(event) => setSelectedInfoType(event.target.value as CogitaInfoType)}>
                    {infoTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {loading === 'loading' && isEditMode ? <p>Loading...</p> : null}

              {currentSpec && !(loading === 'loading' && isEditMode) ? (
                <div className="cogita-form-grid">
                  {currentSpec.payloadFields
                    .filter((field) => !(selectedInfoType === 'source' && (field.key === 'sourceKind' || field.key === 'locator')))
                    .map(renderPayloadField)}
                  {selectedInfoType === 'source' ? renderSourceReferenceEditor() : null}
                  {currentSpec.linkFields
                    .filter((field) => !(selectedInfoType === 'source' && field.key === 'resource'))
                    .map(renderLinkField)}
                </div>
              ) : (
                loading === 'loading' && isEditMode ? null : <p>No specification found for this notion type.</p>
              )}

              <div className="cogita-form-actions">
                <button type="button" className="cta" onClick={handleSave} disabled={loading === 'saving' || !currentSpec}>
                  {loading === 'saving' ? 'Saving...' : isEditMode ? 'Update notion' : 'Create notion'}
                </button>
              </div>

              {status ? <p className="cogita-library-subtitle">{status}</p> : null}
            </article>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
