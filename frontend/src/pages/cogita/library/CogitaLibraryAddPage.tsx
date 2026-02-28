import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  createCogitaInfo,
  getCogitaInfoDetail,
  getCogitaInfoTypeSpecification,
  updateCogitaInfo,
  type CogitaInfoLinkFieldSpec,
  type CogitaInfoPayloadFieldSpec,
  type CogitaInfoTypeSpecification
} from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import type { CogitaInfoOption, CogitaInfoType } from './types';
import { InfoSearchSelect } from './components/InfoSearchSelect';
import { ReferencePanel, type ReferenceSourceForm } from './components/ReferencePanel';
import { getInfoTypeLabel } from './libraryOptions';
import { useCogitaLibraryMeta } from './useCogitaLibraryMeta';

type LinkTypeSelectionState = Record<string, CogitaInfoType>;
type QuestionKind = 'selection' | 'truefalse' | 'text' | 'number' | 'date' | 'matching' | 'ordering';
type QuestionDefinition = {
  type: QuestionKind;
  title?: string;
  question: string;
  options?: string[];
  answer?: number[] | string | number | boolean | { paths: number[][] };
  columns?: string[][];
  matchingPaths?: string[][];
};

const QUESTION_DEFINITION_TEMPLATE = JSON.stringify(
  {
    type: 'selection',
    title: 'Question title',
    question: 'Question text',
    options: ['Option A', 'Option B', 'Option C'],
    answer: [0]
  },
  null,
  2
);

function createDefaultQuestionDefinition(kind: QuestionKind = 'selection'): QuestionDefinition {
  if (kind === 'matching') {
    return { type: kind, title: '', question: '', columns: [[''], ['']], answer: { paths: [] }, matchingPaths: [['', '']] };
  }
  if (kind === 'ordering') {
    return { type: kind, title: '', question: '', options: [''] };
  }
  if (kind === 'truefalse') {
    return { type: kind, title: '', question: '', answer: true };
  }
  if (kind === 'text' || kind === 'date') {
    return { type: kind, title: '', question: '', answer: '' };
  }
  if (kind === 'number') {
    return { type: kind, title: '', question: '', answer: '' };
  }
  return { type: kind, title: '', question: '', options: [''], answer: [] };
}

function isQuestionKind(value: string): value is QuestionKind {
  return ['selection', 'truefalse', 'text', 'number', 'date', 'matching', 'ordering'].includes(value);
}

function normalizeQuestionDefinition(value: unknown): QuestionDefinition | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const rawTypeValue =
    typeof raw.type === 'string'
      ? raw.type
      : typeof raw.kind === 'string'
        ? raw.kind
        : 'selection';
  const kindAlias =
    rawTypeValue === 'multi_select' || rawTypeValue === 'single_select'
      ? 'selection'
      : rawTypeValue === 'boolean'
        ? 'truefalse'
        : rawTypeValue === 'order'
          ? 'ordering'
          : rawTypeValue === 'short' || rawTypeValue === 'open' || rawTypeValue === 'short_text'
            ? 'text'
          : rawTypeValue;
  const kind = isQuestionKind(kindAlias) ? kindAlias : 'selection';
  const title = typeof raw.title === 'string' ? raw.title : '';
  const question = typeof raw.question === 'string' ? raw.question : '';
  if (kind === 'matching') {
    let columns: string[][] = [];
    if (Array.isArray(raw.columns)) {
      columns = raw.columns.map((column) =>
        Array.isArray(column) ? column.map((item) => (typeof item === 'string' ? item : '')) : ['']
      );
    } else if (Array.isArray(raw.left) && Array.isArray(raw.right)) {
      columns = [
        raw.left.map((item) => (typeof item === 'string' ? item : '')),
        raw.right.map((item) => (typeof item === 'string' ? item : ''))
      ];
    }
    if (columns.length < 2) {
      columns = [[''], ['']];
    }
    const answerRaw = raw.answer && typeof raw.answer === 'object' ? (raw.answer as Record<string, unknown>) : null;
    const pathSource = Array.isArray(answerRaw?.paths)
      ? answerRaw?.paths
      : Array.isArray(raw.correctPairs)
        ? raw.correctPairs
        : [];
    const paths = pathSource
      .map((path) => (Array.isArray(path) ? path.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0) : []))
      .filter((path) => path.length > 0);
    const rawMatchingPaths = Array.isArray(raw.matchingPaths)
      ? raw.matchingPaths.map((row) =>
          Array.isArray(row) ? Array.from({ length: columns.length }, (_, index) => String(row[index] ?? '')) : new Array(columns.length).fill('')
        )
      : null;
    const matchingPaths =
      rawMatchingPaths && rawMatchingPaths.length > 0
        ? rawMatchingPaths
        : [...paths.map((path) => path.map(String)), new Array(columns.length).fill('')];
    return { type: kind, title, question, columns, answer: { paths }, matchingPaths };
  }
  if (kind === 'ordering') {
    const items = Array.isArray(raw.options)
      ? raw.options.map((item) => (typeof item === 'string' ? item : ''))
      : Array.isArray(raw.items)
        ? raw.items.map((item) => (typeof item === 'string' ? item : ''))
        : [''];
    return { type: kind, title, question, options: items.length ? items : [''] };
  }
  if (kind === 'truefalse') {
    const answer = typeof raw.answer === 'boolean' ? raw.answer : typeof raw.expected === 'boolean' ? raw.expected : true;
    return { type: kind, title, question, answer };
  }
  if (kind === 'number') {
    if (typeof raw.answer === 'number') return { type: kind, title, question, answer: raw.answer };
    if (typeof raw.answer === 'string') return { type: kind, title, question, answer: raw.answer };
    if (typeof raw.expected === 'number') return { type: kind, title, question, answer: raw.expected };
    return { type: kind, title, question, answer: '' };
  }
  if (kind === 'text' || kind === 'date') {
    const answer = typeof raw.answer === 'string' ? raw.answer : typeof raw.expected === 'string' ? raw.expected : '';
    return { type: kind, title, question, answer };
  }
  const options = Array.isArray(raw.options) ? raw.options.map((item) => (typeof item === 'string' ? item : '')) : [''];
  const answer = Array.isArray(raw.answer)
    ? raw.answer.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0)
    : Array.isArray(raw.correct)
      ? raw.correct.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0)
    : [];
  return { type: kind, title, question, options: options.length ? options : [''], answer };
}

function serializeQuestionDefinition(definition: QuestionDefinition): string {
  const title = (definition.title ?? '').trim();
  const question = (definition.question ?? '').trim();
  switch (definition.type) {
    case 'matching': {
      const columns = (definition.columns ?? [[''], ['']])
        .map((column) => column.map((item) => item.trim()).filter(Boolean))
        .filter((column) => column.length > 0);
      const normalizedColumns = columns.length >= 2 ? columns : [[''], ['']];
      const rawPaths = definition.answer && typeof definition.answer === 'object' && 'paths' in definition.answer ? definition.answer.paths : [];
      const editableRows = (definition.matchingPaths ?? []).map((row) => row.map((value) => String(value ?? '')));
      const width = normalizedColumns.length;
      const fromRows = editableRows
        .map((row) => row.slice(0, width).map((value) => value.trim()))
        .filter((row) => row.some(Boolean))
        .map((row) => row.map((value) => Number(value)))
        .filter((row) => row.length === width && row.every((value) => Number.isInteger(value) && value >= 0)) as number[][];
      const paths = (Array.isArray(rawPaths) ? rawPaths : [])
        .map((path) =>
          Array.isArray(path)
            ? path.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0)
            : []
        )
        .filter((path) => path.length === width);
      const unique = Array.from(new Set([...paths, ...fromRows].map((path) => JSON.stringify(path)))).map((encoded) => JSON.parse(encoded) as number[]);
      return JSON.stringify(
        {
          type: definition.type,
          ...(title ? { title } : {}),
          question,
          columns: normalizedColumns,
          answer: { paths: unique }
        },
        null,
        2
      );
    }
    case 'ordering': {
      const items = (definition.options ?? []).map((item) => item.trim()).filter(Boolean);
      return JSON.stringify(
        {
          type: definition.type,
          ...(title ? { title } : {}),
          question,
          options: items
        },
        null,
        2
      );
    }
    case 'truefalse':
      return JSON.stringify(
        { type: definition.type, ...(title ? { title } : {}), question, answer: Boolean(definition.answer) },
        null,
        2
      );
    case 'number':
      return JSON.stringify(
        {
          type: definition.type,
          ...(title ? { title } : {}),
          question,
          answer:
            typeof definition.answer === 'number'
              ? definition.answer
              : typeof definition.answer === 'string'
                ? definition.answer
                : ''
        },
        null,
        2
      );
    case 'date':
    case 'text':
      return JSON.stringify(
        { type: definition.type, ...(title ? { title } : {}), question, answer: String(definition.answer ?? '') },
        null,
        2
      );
    case 'selection':
    default: {
      const options = (definition.options ?? []).map((option) => option.trim()).filter(Boolean);
      const answerRaw = Array.isArray(definition.answer) ? definition.answer : [];
      const correct = Array.from(
        new Set(answerRaw.filter((index) => Number.isInteger(index) && index >= 0 && index < options.length))
      ).sort((a, b) => a - b);
      return JSON.stringify(
        { type: definition.type, ...(title ? { title } : {}), question, options, answer: correct },
        null,
        2
      );
    }
  }
}

const SOURCE_KIND_OPTIONS = [
  { value: 'string', label: 'string' },
  { value: 'book', label: 'book' },
  { value: 'website', label: 'website' },
  { value: 'bible', label: 'bible' },
  { value: 'number_document', label: 'number_document' },
  { value: 'work', label: 'work' },
  { value: 'other', label: 'other' }
] as const;

function createEmptyReferenceSourceForm(): ReferenceSourceForm {
  return {
    sourceKind: 'string',
    locatorValue: '',
    locatorAux: '',
    bibleBookDisplay: '',
    sourceUrl: '',
    sourceAccessedDate: '',
    churchDocument: null,
    bookMedia: null,
    work: null
  };
}

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

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stringValue(node: Record<string, unknown> | null, key: string): string {
  const value = node?.[key];
  return typeof value === 'string' ? value : '';
}

function resourceOptionForKind(sourceKind: string, resource: CogitaInfoOption | null): Partial<ReferenceSourceForm> {
  if (!resource) return {};
  if (sourceKind === 'book' && resource.infoType === 'media') return { bookMedia: resource };
  if (sourceKind === 'work' && resource.infoType === 'work') return { work: resource };
  if (sourceKind === 'number_document' && resource.infoType === 'work') return { churchDocument: resource };
  return {};
}

function parseReferenceFormFromSourceValues(
  payloadValues: Record<string, string>,
  resource: CogitaInfoOption | null
): ReferenceSourceForm {
  const base = createEmptyReferenceSourceForm();
  const sourceKind = (payloadValues.sourceKind ?? '').trim() || base.sourceKind;
  const locatorRaw = payloadValues.locator ?? '';
  const locatorObject = tryParseJsonObject(locatorRaw);
  let locatorValue = '';
  let locatorAux = '';
  let bibleBookDisplay = '';
  let sourceUrl = '';
  let sourceAccessedDate = '';

  if (sourceKind === 'website') {
    sourceUrl = stringValue(locatorObject, 'url');
    sourceAccessedDate = stringValue(locatorObject, 'accessedDate');
    locatorValue = stringValue(locatorObject, 'value');
  } else if (sourceKind === 'bible') {
    locatorValue = stringValue(locatorObject, 'book') || locatorRaw.trim();
    locatorAux = stringValue(locatorObject, 'passage') || stringValue(locatorObject, 'rest');
    bibleBookDisplay = stringValue(locatorObject, 'bookDisplay');
  } else if (locatorObject) {
    locatorValue = stringValue(locatorObject, 'value') || stringValue(locatorObject, 'locator');
    locatorAux = stringValue(locatorObject, 'aux');
  } else {
    locatorValue = locatorRaw;
  }

  return {
    ...base,
    sourceKind,
    locatorValue,
    locatorAux,
    bibleBookDisplay,
    sourceUrl,
    sourceAccessedDate,
    ...resourceOptionForKind(sourceKind, resource)
  };
}

function getReferenceResource(form: ReferenceSourceForm): CogitaInfoOption | null {
  if (form.sourceKind === 'book') return form.bookMedia;
  if (form.sourceKind === 'work') return form.work;
  if (form.sourceKind === 'number_document') return form.churchDocument;
  return null;
}

function buildSourceLocatorPayload(form: ReferenceSourceForm): unknown {
  const locatorValue = form.locatorValue.trim();
  const locatorAux = form.locatorAux.trim();
  const sourceUrl = form.sourceUrl.trim();
  const sourceAccessedDate = form.sourceAccessedDate.trim();

  switch (form.sourceKind) {
    case 'website':
      return {
        url: sourceUrl,
        accessedDate: sourceAccessedDate
      };
    case 'bible':
      return {
        book: locatorValue,
        bookDisplay: form.bibleBookDisplay.trim(),
        passage: locatorAux
      };
    case 'book':
    case 'work':
    case 'number_document':
      return locatorAux ? { value: locatorValue, aux: locatorAux } : locatorValue;
    default:
      return locatorAux ? { value: locatorValue, aux: locatorAux } : locatorValue;
  }
}

function buildReferenceSourceLabel(form: ReferenceSourceForm): string {
  const locatorValue = form.locatorValue.trim();
  const locatorAux = form.locatorAux.trim();
  const locatorTail = [locatorValue, locatorAux].filter(Boolean).join(' ');
  switch (form.sourceKind) {
    case 'website':
      return form.sourceUrl.trim() || 'website';
    case 'bible':
      return locatorTail || 'bible';
    case 'book':
      return [form.bookMedia?.label, locatorTail].filter(Boolean).join(' · ') || 'book';
    case 'work':
      return [form.work?.label, locatorTail].filter(Boolean).join(' · ') || 'work';
    case 'number_document':
      return [form.churchDocument?.label, locatorTail].filter(Boolean).join(' · ') || 'number_document';
    default:
      return locatorTail || form.sourceKind || 'source';
  }
}

function validateReferenceSourceForm(form: ReferenceSourceForm): boolean {
  if (!form.sourceKind.trim()) return false;
  if (form.sourceKind === 'website') return Boolean(form.sourceUrl.trim());
  if (form.sourceKind === 'bible') return Boolean(form.locatorValue.trim() && form.locatorAux.trim());
  if (form.sourceKind === 'book') return Boolean(form.bookMedia);
  if (form.sourceKind === 'work') return Boolean(form.work);
  if (form.sourceKind === 'number_document') return Boolean(form.churchDocument && form.locatorValue.trim());
  return Boolean(form.locatorValue.trim());
}

export function CogitaLibraryAddPage({
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
  editInfoId
}: {
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
}) {
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
    const raw = payloadValues.definition ?? '';
    if (!raw.trim()) {
      const fallback = normalizeQuestionDefinition(JSON.parse(QUESTION_DEFINITION_TEMPLATE)) ?? createDefaultQuestionDefinition();
      setQuestionDefinition(fallback);
      setQuestionImportJson(QUESTION_DEFINITION_TEMPLATE);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const normalized = normalizeQuestionDefinition(parsed);
      if (!normalized) return;
      setQuestionDefinition(normalized);
      if (questionImportQueue.length === 0) {
        setQuestionImportJson(JSON.stringify(parsed, null, 2));
      }
    } catch {
      // keep current UI state; invalid JSON is handled on save/import action
    }
  }, [payloadValues.definition, questionImportQueue.length, selectedInfoType]);

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
        setStatus('Info updated.');
      } else {
        await createCogitaInfo({
          libraryId,
          infoType: selectedInfoType,
          payload,
          links
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
            setStatus(`Info saved. Loaded next question (${nextIndex + 1}/${questionImportQueue.length}).`);
          } else {
            setStatus('Info saved.');
          }
        } else {
          if (selectedInfoType === 'question' && questionImportQueue.length > 0) {
            setQuestionImportQueue([]);
            setQuestionImportQueueIndex(0);
          }
          setStatus('Info saved.');
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

  const renderPayloadField = (field: CogitaInfoPayloadFieldSpec) => {
    const value = payloadValues[field.key] ?? '';
    if (selectedInfoType === 'question' && field.key === 'definition' && field.inputType === 'json') {
      const kind = questionDefinition.type;
      const setKind = (nextKind: QuestionKind) => {
        const currentTitle = questionDefinition.title ?? '';
        const currentQuestion = questionDefinition.question ?? '';
        applyQuestionDefinition({
          ...createDefaultQuestionDefinition(nextKind),
          title: currentTitle,
          question: currentQuestion
        });
      };
      const ensureTrailing = (items: string[]) => {
        if (items.length === 0) return [''];
        return items[items.length - 1].trim() ? [...items, ''] : items;
      };
      const ensureTrailingColumns = (columns: string[][]) => {
        const normalized = (columns.length ? columns : [[''], ['']]).map((column) => ensureTrailing(column));
        return normalized.length >= 2 ? normalized : [...normalized, ['']];
      };
      const ensureTrailingPathRows = (rows: string[][], width: number) => {
        const normalized = rows
          .map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''))
          .filter((row) => row.some((value) => value.trim()) || row === rows[rows.length - 1]);
        if (normalized.length === 0) return [new Array(width).fill('')];
        const last = normalized[normalized.length - 1];
        return last.some((value) => value.trim()) ? [...normalized, new Array(width).fill('')] : normalized;
      };
      const selectionAnswer = Array.isArray(questionDefinition.answer) ? questionDefinition.answer : [];
      const matchingColumns = ensureTrailingColumns(questionDefinition.columns ?? [[''], ['']]);
      const matchingPathRows = ensureTrailingPathRows(questionDefinition.matchingPaths ?? [[]], matchingColumns.length);
      return (
        <div key={`payload:${field.key}`} className="cogita-field full">
          <span>{field.label}</span>
          <div className="cogita-library-panel" style={{ display: 'grid', gap: '0.8rem' }}>
            <label className="cogita-field">
              <span>Question type</span>
              <select value={kind} onChange={(event) => setKind(event.target.value as QuestionKind)}>
                <option value="selection">Selection</option>
                <option value="truefalse">True / false</option>
                <option value="text">Text answer</option>
                <option value="number">Number answer</option>
                <option value="date">Date answer</option>
                <option value="matching">Matching</option>
                <option value="ordering">Right order</option>
              </select>
            </label>
            <label className="cogita-field">
              <span>Title</span>
              <input
                type="text"
                value={questionDefinition.title ?? ''}
                onChange={(event) => applyQuestionDefinition({ ...questionDefinition, title: event.target.value })}
                placeholder="Optional title"
              />
            </label>
            <label className="cogita-field">
              <span>Question</span>
              <textarea
                rows={3}
                value={questionDefinition.question ?? ''}
                onChange={(event) => applyQuestionDefinition({ ...questionDefinition, question: event.target.value })}
                placeholder="Question text"
              />
            </label>

            {kind === 'selection' ? (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'rgba(184,209,234,0.8)' }}>Options / correct indices</span>
                {ensureTrailing(questionDefinition.options ?? ['']).map((option, index, all) => {
                  const selected = new Set(selectionAnswer.filter((item): item is number => Number.isInteger(item)));
                  const isLast = index === all.length - 1;
                  return (
                    <div key={`question-option:${index}`} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selected.has(index)}
                        disabled={!option.trim()}
                        onChange={(event) => {
                          const nextSelected =
                            event.target.checked ? [...selected, index] : [...selected].filter((item) => item !== index);
                          applyQuestionDefinition({ ...questionDefinition, answer: nextSelected });
                        }}
                      />
                      <input
                        type="text"
                        value={option}
                        placeholder={`Answer ${index + 1}`}
                        onChange={(event) => {
                          const next = [...(questionDefinition.options ?? [''])];
                          next[index] = event.target.value;
                          const withTail = ensureTrailing(next);
                          const maxIndex = withTail.length - 1;
                          const nextCorrect = selectionAnswer.filter((item) => item >= 0 && item < maxIndex);
                          applyQuestionDefinition({ ...questionDefinition, options: withTail, answer: nextCorrect });
                        }}
                      />
                      {!isLast ? (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            const source = questionDefinition.options ?? [''];
                            const next = source.filter((_, itemIndex) => itemIndex !== index);
                            const reindexed = selectionAnswer
                              .filter((item) => item !== index)
                              .map((item) => (item > index ? item - 1 : item));
                            applyQuestionDefinition({
                              ...questionDefinition,
                              options: ensureTrailing(next),
                              answer: reindexed
                            });
                          }}
                        >
                          Remove
                        </button>
                      ) : <span />}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {(kind === 'text' || kind === 'date' || kind === 'number') ? (
              <label className="cogita-field">
                <span>Answer</span>
                <input
                  type={kind === 'date' ? 'date' : 'text'}
                  value={typeof questionDefinition.answer === 'string' || typeof questionDefinition.answer === 'number' ? String(questionDefinition.answer) : ''}
                  onChange={(event) => applyQuestionDefinition({ ...questionDefinition, answer: event.target.value })}
                />
              </label>
            ) : null}

            {kind === 'truefalse' ? (
              <label className="cogita-field">
                <span>Answer</span>
                <select
                  value={String(Boolean(questionDefinition.answer))}
                  onChange={(event) => applyQuestionDefinition({ ...questionDefinition, answer: event.target.value === 'true' })}
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </label>
            ) : null}

            {kind === 'matching' ? (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'rgba(184,209,234,0.8)' }}>Columns</span>
                {matchingColumns.map((column, columnIndex) => (
                  <div key={`question-column:${columnIndex}`} style={{ display: 'grid', gap: '0.35rem', border: '1px solid rgba(120,170,220,0.22)', borderRadius: '0.6rem', padding: '0.55rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'rgba(184,209,234,0.85)' }}>Column {columnIndex + 1}</span>
                      {matchingColumns.length > 2 ? (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            const nextColumns = matchingColumns.filter((_, idx) => idx !== columnIndex);
                            const nextRows = matchingPathRows.map((row) => row.filter((_, idx) => idx !== columnIndex));
                            applyQuestionDefinition({ ...questionDefinition, columns: ensureTrailingColumns(nextColumns), matchingPaths: ensureTrailingPathRows(nextRows, Math.max(2, nextColumns.length)) });
                          }}
                        >
                          Remove column
                        </button>
                      ) : null}
                    </div>
                    {column.map((cell, rowIndex) => {
                      const isLast = rowIndex === column.length - 1;
                      return (
                        <div key={`question-column:${columnIndex}:row:${rowIndex}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.4rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={cell}
                            placeholder={`Option ${rowIndex + 1}`}
                            onChange={(event) => {
                              const nextColumns = matchingColumns.map((items) => [...items]);
                              nextColumns[columnIndex][rowIndex] = event.target.value;
                              applyQuestionDefinition({ ...questionDefinition, columns: ensureTrailingColumns(nextColumns), matchingPaths: ensureTrailingPathRows(matchingPathRows, matchingColumns.length) });
                            }}
                          />
                          {!isLast ? (
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => {
                                const nextColumns = matchingColumns.map((items) => [...items]);
                                nextColumns[columnIndex] = nextColumns[columnIndex].filter((_, idx) => idx !== rowIndex);
                                applyQuestionDefinition({ ...questionDefinition, columns: ensureTrailingColumns(nextColumns), matchingPaths: ensureTrailingPathRows(matchingPathRows, matchingColumns.length) });
                              }}
                            >
                              Remove
                            </button>
                          ) : <span />}
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div className="cogita-form-actions" style={{ justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="cta ghost"
                    onClick={() => {
                      const nextColumns = [...matchingColumns.map((column) => [...column]), ['']];
                      const nextRows = matchingPathRows.map((row) => [...row, '']);
                      applyQuestionDefinition({ ...questionDefinition, columns: ensureTrailingColumns(nextColumns), matchingPaths: ensureTrailingPathRows(nextRows, nextColumns.length) });
                    }}
                  >
                    Add column
                  </button>
                </div>

                <span style={{ fontSize: '0.82rem', color: 'rgba(184,209,234,0.8)' }}>Correct paths (0-based indices)</span>
                {matchingPathRows.map((row, rowIndex) => {
                  const isLast = rowIndex === matchingPathRows.length - 1;
                  return (
                    <div key={`question-path:${rowIndex}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${matchingColumns.length}, minmax(0,1fr)) auto`, gap: '0.35rem', alignItems: 'center' }}>
                      {row.map((value, columnIndex) => (
                        <input
                          key={`question-path:${rowIndex}:${columnIndex}`}
                          type="number"
                          min={0}
                          step={1}
                          value={value}
                          placeholder={`${columnIndex}`}
                          onChange={(event) => {
                            const nextRows = matchingPathRows.map((items) => [...items]);
                            nextRows[rowIndex][columnIndex] = event.target.value;
                            const normalizedRows = ensureTrailingPathRows(nextRows, matchingColumns.length);
                            const parsedPaths = normalizedRows
                              .map((r) => r.map((cell) => cell.trim()))
                              .filter((r) => r.every((cell) => cell !== ''))
                              .map((r) => r.map((cell) => Number(cell)))
                              .filter((r) => r.every((cell) => Number.isInteger(cell) && cell >= 0));
                            applyQuestionDefinition({ ...questionDefinition, matchingPaths: normalizedRows, answer: { paths: parsedPaths } });
                          }}
                        />
                      ))}
                      {!isLast ? (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            const nextRows = matchingPathRows.filter((_, idx) => idx !== rowIndex);
                            const normalizedRows = ensureTrailingPathRows(nextRows, matchingColumns.length);
                            const parsedPaths = normalizedRows
                              .map((r) => r.map((cell) => cell.trim()))
                              .filter((r) => r.every((cell) => cell !== ''))
                              .map((r) => r.map((cell) => Number(cell)))
                              .filter((r) => r.every((cell) => Number.isInteger(cell) && cell >= 0));
                            applyQuestionDefinition({ ...questionDefinition, matchingPaths: normalizedRows, answer: { paths: parsedPaths } });
                          }}
                        >
                          Remove
                        </button>
                      ) : <span />}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {kind === 'ordering' ? (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'rgba(184,209,234,0.8)' }}>Ordered options (correct order = listed order)</span>
                {ensureTrailing(questionDefinition.options ?? ['']).map((item, index, all) => {
                  const isLast = index === all.length - 1;
                  return (
                    <div key={`question-order:${index}`} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ color: 'rgba(184,209,234,0.75)', minWidth: '1.5rem' }}>{index + 1}.</span>
                      <input
                        type="text"
                        value={item}
                        placeholder={`Step ${index + 1}`}
                        onChange={(event) => {
                          const next = [...(questionDefinition.options ?? [''])];
                          next[index] = event.target.value;
                          applyQuestionDefinition({ ...questionDefinition, options: ensureTrailing(next) });
                        }}
                      />
                      {!isLast ? (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() =>
                            applyQuestionDefinition({
                              ...questionDefinition,
                              options: ensureTrailing((questionDefinition.options ?? []).filter((_, itemIndex) => itemIndex !== index))
                            })
                          }
                        >
                          Remove
                        </button>
                      ) : <span />}
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'rgba(184,209,234,0.8)' }}>JSON import</span>
              <textarea
                rows={8}
                value={questionImportJson}
                onChange={(event) => setQuestionImportJson(event.target.value)}
                placeholder="Paste question JSON"
              />
              <div className="cogita-form-actions" style={{ justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  className="cta ghost"
                  onClick={() => {
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
                  }}
                >
                  Interpret JSON
                </button>
                {questionImportQueue.length > 0 ? (
                  <span className="cogita-library-hint">
                    Queue: {Math.min(questionImportQueueIndex + 1, questionImportQueue.length)} / {questionImportQueue.length}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      );
    }
    const isLong = field.inputType === 'textarea' || field.inputType === 'json';
    return (
      <label key={`payload:${field.key}`} className="cogita-field full">
        <span>{field.label}</span>
        {isLong ? (
          <textarea
            rows={field.inputType === 'json' ? 8 : 4}
            value={value}
            onChange={(event) => setPayloadValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
            placeholder={field.key}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(event) => setPayloadValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
            placeholder={field.key}
          />
        )}
      </label>
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
            <p className="cogita-user-kicker">{isEditMode ? 'Edit info' : 'Create info'}</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">Specification-driven editor</p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href={`/#/cogita/library/${libraryId}/infos`}>
              Back to list
            </a>
          </div>
        </header>

        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <article className="cogita-library-panel">
              {!isEditMode ? (
                <label className="cogita-field full">
                  <span>Info type</span>
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
                loading === 'loading' && isEditMode ? null : <p>No specification found for this info type.</p>
              )}

              <div className="cogita-form-actions">
                <button type="button" className="cta" onClick={handleSave} disabled={loading === 'saving' || !currentSpec}>
                  {loading === 'saving' ? 'Saving...' : isEditMode ? 'Update info' : 'Create info'}
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
