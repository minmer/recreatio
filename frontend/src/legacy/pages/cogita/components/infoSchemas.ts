import type { CogitaNotionSearchResult } from '../../../lib/api';
import type { CogitaInfoType } from './types';

export type InfoEntityKind = 'single' | 'connection' | 'complex';

export type InfoFilterLabelKey =
  | 'language'
  | 'languageA'
  | 'languageB'
  | 'originalLanguage'
  | 'doi'
  | 'sourceKind'
  | 'locator'
  | 'citationText';

export type InfoFilterFieldSchema = {
  key: string;
  labelKey?: InfoFilterLabelKey;
  label?: string;
  kind: 'text' | 'select';
  path?: string;
  optionsSource?: 'languages' | 'sourceKinds';
  matcher?: 'contains' | 'equals' | 'locator_contains';
};

export type InfoSchema = {
  notionType: string;
  entityKind: InfoEntityKind;
  structure: {
    payloadFields: string[];
    connections?: Array<{
      relationType: string;
      role: string;
      targetType: string;
    }>;
  };
  filterFields: InfoFilterFieldSchema[];
};

const SOURCE_KIND_OPTIONS = [
  { value: 'string', label: 'string' },
  { value: 'book', label: 'book' },
  { value: 'website', label: 'website' },
  { value: 'bible', label: 'bible' },
  { value: 'number_document', label: 'number_document' },
  { value: 'work', label: 'work' },
  { value: 'other', label: 'other' }
];

const LANGUAGE_FILTER: InfoFilterFieldSchema = {
  key: 'languageId',
  labelKey: 'language',
  kind: 'select',
  path: 'languageId',
  optionsSource: 'languages',
  matcher: 'equals'
};

const INFO_SCHEMAS: Record<string, InfoSchema> = {
  language: {
    notionType: 'language',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'name', 'code'] },
    filterFields: []
  },
  word: {
    notionType: 'word',
    entityKind: 'single',
    structure: {
      payloadFields: ['label', 'lemma', 'languageId'],
      connections: [{ relationType: 'word-language', role: 'language', targetType: 'language' }]
    },
    filterFields: [LANGUAGE_FILTER]
  },
  sentence: {
    notionType: 'sentence',
    entityKind: 'single',
    structure: {
      payloadFields: ['label', 'text', 'languageId'],
      connections: [{ relationType: 'language-sentence', role: 'language', targetType: 'language' }]
    },
    filterFields: [LANGUAGE_FILTER]
  },
  topic: {
    notionType: 'topic',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'name'] },
    filterFields: []
  },
  collection: {
    notionType: 'collection',
    entityKind: 'complex',
    structure: { payloadFields: ['label', 'name'] },
    filterFields: []
  },
  person: {
    notionType: 'person',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'name'] },
    filterFields: []
  },
  institution: {
    notionType: 'institution',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'name'] },
    filterFields: []
  },
  collective: {
    notionType: 'collective',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'name'] },
    filterFields: []
  },
  orcid: {
    notionType: 'orcid',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'orcid'] },
    filterFields: [{ key: 'orcid', label: 'ORCID', kind: 'text', path: 'orcid', matcher: 'contains' }]
  },
  address: {
    notionType: 'address',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'street', 'city', 'postalCode', 'country'] },
    filterFields: []
  },
  email: {
    notionType: 'email',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'email', 'address'] },
    filterFields: []
  },
  phone: {
    notionType: 'phone',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'phone', 'number'] },
    filterFields: []
  },
  media: {
    notionType: 'media',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'name', 'url', 'kind'] },
    filterFields: []
  },
  work: {
    notionType: 'work',
    entityKind: 'single',
    structure: {
      payloadFields: ['label', 'title', 'subtitle', 'doi', 'isbn', 'issn', 'languageId', 'originalLanguageId']
    },
    filterFields: [
      LANGUAGE_FILTER,
      {
        key: 'originalLanguageId',
        labelKey: 'originalLanguage',
        kind: 'select',
        path: 'originalLanguageId',
        optionsSource: 'languages',
        matcher: 'equals'
      },
      { key: 'doi', labelKey: 'doi', kind: 'text', path: 'doi', matcher: 'contains' }
    ]
  },
  geo: {
    notionType: 'geo',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'name', 'country', 'region', 'city'] },
    filterFields: []
  },
  music_piece: {
    notionType: 'music_piece',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'title', 'composer'] },
    filterFields: []
  },
  music_fragment: {
    notionType: 'music_fragment',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'title', 'text'] },
    filterFields: []
  },
  source: {
    notionType: 'source',
    entityKind: 'single',
    structure: {
      payloadFields: ['label', 'title', 'sourceKind', 'locator'],
      connections: [{ relationType: 'source-resource', role: 'resource', targetType: 'work' }]
    },
    filterFields: [
      { key: 'sourceKind', labelKey: 'sourceKind', kind: 'select', path: 'sourceKind', optionsSource: 'sourceKinds', matcher: 'equals' },
      { key: 'locator', labelKey: 'locator', kind: 'text', path: 'locator', matcher: 'locator_contains' }
    ]
  },
  citation: {
    notionType: 'citation',
    entityKind: 'single',
    structure: {
      payloadFields: ['title', 'text'],
      connections: [
        { relationType: 'citation-language', role: 'language', targetType: 'language' },
        { relationType: 'reference', role: 'source', targetType: 'source' }
      ]
    },
    filterFields: [{ key: 'text', labelKey: 'citationText', kind: 'text', path: 'text', matcher: 'contains' }]
  },
  question: {
    notionType: 'question',
    entityKind: 'single',
    structure: {
      payloadFields: ['definition']
    },
    filterFields: [
      { key: 'questionType', labelKey: 'type', kind: 'text', path: 'definition.type', matcher: 'contains' },
      { key: 'questionText', labelKey: 'text', kind: 'text', path: 'definition.question', matcher: 'contains' }
    ]
  },
  computed: {
    notionType: 'computed',
    entityKind: 'complex',
    structure: {
      payloadFields: ['label', 'title', 'definition']
    },
    filterFields: []
  },
  translation: {
    notionType: 'translation',
    entityKind: 'connection',
    structure: {
      payloadFields: ['note', 'tagIds'],
      connections: [
        { relationType: 'translation', role: 'wordA', targetType: 'word' },
        { relationType: 'translation', role: 'wordB', targetType: 'word' },
        { relationType: 'word-language', role: 'languageA', targetType: 'language' },
        { relationType: 'word-language', role: 'languageB', targetType: 'language' }
      ]
    },
    filterFields: [
      { key: 'languageAId', labelKey: 'languageA', kind: 'select', optionsSource: 'languages', matcher: 'equals' },
      { key: 'languageBId', labelKey: 'languageB', kind: 'select', optionsSource: 'languages', matcher: 'equals' }
    ]
  }
};

const DEFAULT_SCHEMA: InfoSchema = {
  notionType: 'default',
  entityKind: 'single',
  structure: { payloadFields: ['label'] },
  filterFields: []
};

export function getInfoSchema(type?: string | null): InfoSchema {
  if (!type) return DEFAULT_SCHEMA;
  return INFO_SCHEMAS[type] ?? DEFAULT_SCHEMA;
}

export function resolveSchemaFieldOptions(
  schemaField: InfoFilterFieldSchema,
  context: { languages: CogitaNotionSearchResult[] }
): Array<{ value: string; label: string }> {
  if (schemaField.optionsSource === 'languages') {
    return context.languages.map((item) => ({ value: item.notionId, label: item.label }));
  }
  if (schemaField.optionsSource === 'sourceKinds') {
    return SOURCE_KIND_OPTIONS;
  }
  return [];
}

function getPayloadValue(payload: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let cursor: unknown = payload;
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

export function matchesSchemaField(
  field: InfoFilterFieldSchema,
  payload: Record<string, unknown>,
  filterValue: string
): boolean {
  const value = filterValue.trim();
  if (!value) return true;
  const raw = field.path ? getPayloadValue(payload, field.path) : payload[field.key];
  const normalized = String(raw ?? '').toLowerCase();
  if ((field.matcher ?? 'contains') === 'equals') {
    return normalized === value.toLowerCase();
  }
  if (field.matcher === 'locator_contains') {
    const locator = raw as Record<string, unknown> | undefined;
    return JSON.stringify(locator ?? {}).toLowerCase().includes(value.toLowerCase());
  }
  return normalized.includes(value.toLowerCase());
}

export function buildSearchDocument(
  info: { label: string; infoType: string; payload?: Record<string, unknown> | null },
  fallbackLabel: string
) {
  const payload = info.payload ?? {};
  const schema = getInfoSchema(info.infoType as CogitaInfoType);
  const parts: string[] = [fallbackLabel];
  for (const path of schema.structure.payloadFields) {
    const value = getPayloadValue(payload, path);
    if (value !== null && value !== undefined && String(value).trim()) {
      parts.push(String(value));
    }
  }
  return parts.join(' ').trim();
}
