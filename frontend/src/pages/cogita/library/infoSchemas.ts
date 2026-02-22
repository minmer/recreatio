import type { CogitaInfoSearchResult } from '../../../lib/api';
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
  | 'quote';

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
  infoType: string;
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
    infoType: 'language',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'name', 'code', 'notes'] },
    filterFields: []
  },
  word: {
    infoType: 'word',
    entityKind: 'single',
    structure: {
      payloadFields: ['label', 'lemma', 'notes', 'languageId'],
      connections: [{ relationType: 'word-language', role: 'language', targetType: 'language' }]
    },
    filterFields: [LANGUAGE_FILTER]
  },
  sentence: {
    infoType: 'sentence',
    entityKind: 'single',
    structure: {
      payloadFields: ['label', 'text', 'notes', 'languageId'],
      connections: [{ relationType: 'language-sentence', role: 'language', targetType: 'language' }]
    },
    filterFields: [LANGUAGE_FILTER]
  },
  topic: {
    infoType: 'topic',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'name', 'notes'] },
    filterFields: []
  },
  collection: {
    infoType: 'collection',
    entityKind: 'complex',
    structure: { payloadFields: ['label', 'name', 'notes'] },
    filterFields: []
  },
  person: {
    infoType: 'person',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'name', 'notes'] },
    filterFields: []
  },
  institution: {
    infoType: 'institution',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'name', 'notes'] },
    filterFields: []
  },
  collective: {
    infoType: 'collective',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'name', 'notes'] },
    filterFields: []
  },
  orcid: {
    infoType: 'orcid',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'orcid', 'notes'] },
    filterFields: [{ key: 'orcid', label: 'ORCID', kind: 'text', path: 'orcid', matcher: 'contains' }]
  },
  address: {
    infoType: 'address',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'street', 'city', 'postalCode', 'country', 'notes'] },
    filterFields: []
  },
  email: {
    infoType: 'email',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'email', 'address', 'notes'] },
    filterFields: []
  },
  phone: {
    infoType: 'phone',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'phone', 'number', 'notes'] },
    filterFields: []
  },
  media: {
    infoType: 'media',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'name', 'url', 'kind', 'notes'] },
    filterFields: []
  },
  work: {
    infoType: 'work',
    entityKind: 'single',
    structure: {
      payloadFields: ['label', 'title', 'subtitle', 'doi', 'isbn', 'issn', 'languageId', 'originalLanguageId', 'notes']
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
    infoType: 'geo',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'name', 'country', 'region', 'city', 'notes'] },
    filterFields: []
  },
  music_piece: {
    infoType: 'music_piece',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'title', 'composer', 'notes'] },
    filterFields: []
  },
  music_fragment: {
    infoType: 'music_fragment',
    entityKind: 'single',
    structure: { payloadFields: ['label', 'title', 'text', 'notes'] },
    filterFields: []
  },
  source: {
    infoType: 'source',
    entityKind: 'single',
    structure: {
      payloadFields: ['label', 'title', 'sourceKind', 'locator', 'notes'],
      connections: [{ relationType: 'source-resource', role: 'resource', targetType: 'work' }]
    },
    filterFields: [
      { key: 'sourceKind', labelKey: 'sourceKind', kind: 'select', path: 'sourceKind', optionsSource: 'sourceKinds', matcher: 'equals' },
      { key: 'locator', labelKey: 'locator', kind: 'text', path: 'locator', matcher: 'locator_contains' }
    ]
  },
  citation: {
    infoType: 'citation',
    entityKind: 'single',
    structure: {
      payloadFields: ['title', 'text', 'notes'],
      connections: [
        { relationType: 'quote-language', role: 'language', targetType: 'language' },
        { relationType: 'reference', role: 'source', targetType: 'source' }
      ]
    },
    filterFields: [{ key: 'text', labelKey: 'quote', kind: 'text', path: 'text', matcher: 'contains' }]
  },
  computed: {
    infoType: 'computed',
    entityKind: 'complex',
    structure: {
      payloadFields: ['label', 'title', 'definition', 'notes']
    },
    filterFields: []
  },
  translation: {
    infoType: 'translation',
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
  infoType: 'default',
  entityKind: 'single',
  structure: { payloadFields: ['label', 'notes'] },
  filterFields: []
};

export function getInfoSchema(type?: string | null): InfoSchema {
  if (!type) return DEFAULT_SCHEMA;
  return INFO_SCHEMAS[type] ?? DEFAULT_SCHEMA;
}

export function resolveSchemaFieldOptions(
  schemaField: InfoFilterFieldSchema,
  context: { languages: CogitaInfoSearchResult[] }
): Array<{ value: string; label: string }> {
  if (schemaField.optionsSource === 'languages') {
    return context.languages.map((item) => ({ value: item.infoId, label: item.label }));
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
