import { ApiError } from '../../lib/api';

export { ApiError };

const apiBase = import.meta.env.VITE_API_BASE ?? 'https://api.recreatio.pl';

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function req<T>(path: string, options: RequestInit): Promise<T> {
  const csrfToken = getCsrfToken();
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

// ── Vocabularies ─────────────────────────────────────────────────────────────
// Mirrors the sets validated in LibraryEndpoints.cs.

export const WORK_KINDS = [
  'book', 'article', 'essay', 'poetry', 'drama', 'treatise',
  'collection', 'reference', 'scripture', 'document', 'other'
] as const;

/** Decides which locator fields a quote form shows. */
export const CITATION_SCHEMES = ['Page', 'BibleReference', 'StructuredWork', 'DocumentParagraph'] as const;

export const CONTRIBUTION_ROLES = [
  'author', 'coauthor', 'editor', 'translator', 'illustrator',
  'foreword', 'afterword', 'commentary', 'compiler', 'other'
] as const;

export const MANIFESTATION_FORMATS = ['Print', 'Web', 'Ebook'] as const;

export const ITEM_STATUSES = ['shelf', 'lent', 'borrowed', 'wanted', 'ordered', 'lost', 'sold'] as const;

export const ITEM_CONDITIONS = ['new', 'good', 'fair', 'worn', 'damaged'] as const;

export const READING_STATUSES = ['unread', 'reading', 'read', 'abandoned', 'reference'] as const;

export const BINDINGS = ['hardcover', 'paperback', 'leather', 'ebook', 'audiobook', 'other'] as const;

export const LOAN_DIRECTIONS = ['out', 'in'] as const;

export const PLACEMENT_GROUP_KINDS = ['series', 'collection', 'free'] as const;

export const LANGUAGE_CODES = [
  'pl', 'en', 'de', 'fr', 'it', 'es', 'pt', 'nl', 'la', 'grc', 'he', 'ru', 'uk',
  'cs', 'sk', 'hu', 'lt', 'sv', 'no', 'da', 'fi', 'ro', 'el', 'tr', 'ar', 'zh', 'ja'
] as const;

export type CitationScheme = (typeof CITATION_SCHEMES)[number];

// ── Registries ───────────────────────────────────────────────────────────────

export type LibraryPerson = {
  id: number;
  displayName: string;
  sortName: string | null;
  birthYear: number | null;
  deathYear: number | null;
  nationality: string | null;
  notes: string | null;
  contributionCount: number;
};

export type LibraryPersonSave = Omit<LibraryPerson, 'id' | 'contributionCount'>;

export type LibraryPublisher = {
  id: number;
  name: string;
  city: string | null;
  notes: string | null;
  manifestationCount: number;
};

export type LibraryPublisherSave = { name: string; city: string | null; notes: string | null };

export type LibraryShelf = {
  id: number;
  name: string;
  location: string | null;
  description: string | null;
  sortOrder: number;
  heightMm: number | null;
  depthMm: number | null;
  widthMm: number | null;
  itemCount: number;
};

export type LibraryShelfSave = Omit<LibraryShelf, 'id' | 'itemCount'>;

export type LibraryTag = {
  id: number;
  name: string;
  color: string | null;
  workCount: number;
  quoteCount: number;
};

export type LibraryTagSave = { name: string; color: string | null };

export type LibraryPlacementGroup = {
  id: number;
  name: string;
  groupKind: string;
  notes: string | null;
  itemCount: number;
};

export type LibraryPlacementGroupSave = { name: string; groupKind: string; notes: string | null };

// ── Contributions ────────────────────────────────────────────────────────────

export type LibraryContribution = {
  id: number;
  personId: number;
  personName: string;
  role: string;
  sortOrder: number;
};

export type LibraryContributionSave = { personId: number; role: string };

// ── Work ─────────────────────────────────────────────────────────────────────

export type LibraryWorkSave = {
  originalTitle: string;
  originalSubtitle: string | null;
  originalLanguage: string;
  uniformTitle: string | null;
  kind: string;
  citationScheme: string;
  /** Ordered part definitions for StructuredWork; JSON text. */
  structureTemplateJson: string | null;
  citationSigil: string | null;
  firstPublishedYear: number | null;
  notes: string | null;
};

export type LibraryWorkListItem = {
  id: number;
  originalTitle: string;
  originalSubtitle: string | null;
  originalLanguage: string;
  uniformTitle: string | null;
  kind: string;
  citationScheme: string;
  firstPublishedYear: number | null;
  authors: string[];
  expressionLanguages: string[];
  tags: LibraryTag[];
  expressionCount: number;
  manifestationCount: number;
  itemCount: number;
  quoteCount: number;
};

export type LibraryWorkList = { items: LibraryWorkListItem[]; total: number };

export type LibraryExpressionListItem = {
  id: number;
  workId: number;
  language: string;
  name: string | null;
  isTranslation: boolean;
  translators: string[];
  manifestationCount: number;
};

export type LibraryManifestationListItem = {
  id: number;
  workId: number | null;
  expressionId: number | null;
  expressionName: string | null;
  expressionLanguage: string | null;
  format: string;
  title: string;
  subtitle: string | null;
  publisherId: number | null;
  publisherName: string | null;
  publishedPlace: string | null;
  publishedYear: number | null;
  editionStatement: string | null;
  isbn: string | null;
  pageCount: number | null;
  binding: string | null;
  url: string | null;
  coverImageUrl: string | null;
  heightMm: number | null;
  widthMm: number | null;
  depthMm: number | null;
  itemCount: number;
};

export type LibraryWorkDetail = {
  id: number;
  originalTitle: string;
  originalSubtitle: string | null;
  originalLanguage: string;
  uniformTitle: string | null;
  kind: string;
  citationScheme: string;
  structureTemplateJson: string | null;
  citationSigil: string | null;
  firstPublishedYear: number | null;
  notes: string | null;
  contributions: LibraryContribution[];
  tagIds: number[];
  expressions: LibraryExpressionListItem[];
  manifestations: LibraryManifestationListItem[];
  quoteCount: number;
  createdUtc: string;
  updatedUtc: string;
};

// ── Expression ───────────────────────────────────────────────────────────────

export type LibraryExpressionSave = { language: string; name: string | null; notes: string | null };

export type LibraryExpressionDetail = {
  id: number;
  workId: number;
  workTitle: string;
  workOriginalLanguage: string;
  language: string;
  name: string | null;
  isTranslation: boolean;
  notes: string | null;
  contributions: LibraryContribution[];
  manifestations: LibraryManifestationListItem[];
  createdUtc: string;
  updatedUtc: string;
};

// ── Manifestation ────────────────────────────────────────────────────────────

export type LibraryManifestationSave = {
  expressionId: number | null;
  format: string;
  title: string;
  subtitle: string | null;
  publisherId: number | null;
  publishedPlace: string | null;
  publishedYear: number | null;
  editionStatement: string | null;
  series: string | null;
  seriesNumber: string | null;
  isbn: string | null;
  issn: string | null;
  pageCount: number | null;
  volume: string | null;
  binding: string | null;
  url: string | null;
  originalTextUrl: string | null;
  coverImageUrl: string | null;
  heightMm: number | null;
  widthMm: number | null;
  depthMm: number | null;
  notes: string | null;
};

export type LibraryItem = {
  id: number;
  manifestationId: number;
  shelfId: number | null;
  shelfName: string | null;
  placementGroupId: number | null;
  placementGroupName: string | null;
  positionInShelf: number | null;
  seriesPosition: number | null;
  signature: string | null;
  status: string;
  condition: string | null;
  acquiredDate: string | null;
  acquiredFrom: string | null;
  price: number | null;
  currency: string | null;
  barcode: string | null;
  readingStatus: string;
  rating: number | null;
  isFavourite: boolean;
  scanImageUrl: string | null;
  notes: string | null;
  openLoan: LibraryLoan | null;
};

export type LibraryManifestationDetail = {
  id: number;
  workId: number;
  workTitle: string;
  workOriginalLanguage: string;
  workCitationScheme: string;
  expressionId: number | null;
  expressionName: string | null;
  expressionLanguage: string | null;
  format: string;
  title: string;
  subtitle: string | null;
  publisherId: number | null;
  publisherName: string | null;
  publishedPlace: string | null;
  publishedYear: number | null;
  editionStatement: string | null;
  series: string | null;
  seriesNumber: string | null;
  isbn: string | null;
  issn: string | null;
  pageCount: number | null;
  volume: string | null;
  binding: string | null;
  url: string | null;
  originalTextUrl: string | null;
  coverImageUrl: string | null;
  heightMm: number | null;
  widthMm: number | null;
  depthMm: number | null;
  notes: string | null;
  contributions: LibraryContribution[];
  items: LibraryItem[];
  createdUtc: string;
  updatedUtc: string;
};

// ── Item ─────────────────────────────────────────────────────────────────────

export type LibraryItemSave = {
  shelfId: number | null;
  placementGroupId: number | null;
  positionInShelf: number | null;
  seriesPosition: number | null;
  signature: string | null;
  status: string;
  condition: string | null;
  acquiredDate: string | null;
  acquiredFrom: string | null;
  price: number | null;
  currency: string | null;
  barcode: string | null;
  readingStatus: string;
  rating: number | null;
  isFavourite: boolean;
  scanImageUrl: string | null;
  notes: string | null;
};

export type LibraryItemListItem = {
  id: number;
  manifestationId: number;
  workId: number;
  manifestationTitle: string;
  workTitle: string;
  language: string | null;
  isTranslation: boolean;
  authors: string[];
  publisherName: string | null;
  publishedYear: number | null;
  shelfId: number | null;
  shelfName: string | null;
  positionInShelf: number | null;
  signature: string | null;
  status: string;
  condition: string | null;
  readingStatus: string;
  rating: number | null;
  isFavourite: boolean;
  imageUrl: string | null;
  openLoan: LibraryLoan | null;
};

export type LibraryItemList = { items: LibraryItemListItem[]; total: number };

// ── Quote ────────────────────────────────────────────────────────────────────

export type LibraryQuoteSave = {
  workId: number;
  expressionId: number | null;
  manifestationId: number | null;
  quoteText: string;
  locatorJson: string | null;
  description: string | null;
  context: string | null;
  tagIds: number[] | null;
};

export type LibraryQuote = {
  id: number;
  workId: number;
  workTitle: string;
  workCitationScheme: string;
  expressionId: number | null;
  expressionName: string | null;
  expressionLanguage: string | null;
  manifestationId: number | null;
  manifestationTitle: string | null;
  publisherName: string | null;
  publishedYear: number | null;
  authors: string[];
  quoteText: string;
  locatorJson: string | null;
  locatorDisplay: string | null;
  /** Footnote-ready, written in the requested citation style. */
  reference: string;
  /** The same source as it would appear in a list of works. */
  bibliography: string;
  citationStyle: string;
  description: string | null;
  context: string | null;
  tags: LibraryTag[];
  createdUtc: string;
  updatedUtc: string;
};

export type LibraryQuoteList = { items: LibraryQuote[]; total: number };

/** Tells the form which locator fields to render for a scheme. */
export type LibraryLocatorFieldSpec = {
  key: string;
  kind: 'text' | 'number';
  labelKey: string;
  required: boolean;
};

export type LibraryCitationSchemeSpec = {
  scheme: string;
  authoritativeLevel: 'manifestation' | 'expression' | 'work';
  fields: LibraryLocatorFieldSpec[];
  usesStructureTemplate: boolean;
  example: string;
};

/**
 * A citation style is the second axis: the scheme says where in the work a quote
 * sits, the style says how the reference around it is written.
 */
export type LibraryCitationStyleSpec = {
  key: string;
  displayName: string;
  sampleNote: string;
  sampleBibliography: string;
};

export type LibraryBibleBook = {
  id: string;
  names: Record<string, { abbr: string; name: string }>;
};

export type LibraryQuoteImportResult = {
  imported: number;
  failed: number;
  worksCreated: number;
  expressionsCreated: number;
  manifestationsCreated: number;
  tagsCreated: number;
  errors: { index: number; message: string }[];
};

// ── Loans and readings ───────────────────────────────────────────────────────

export type LibraryLoan = {
  id: number;
  itemId: number;
  direction: string;
  counterpartName: string;
  counterpartContact: string | null;
  lentOn: string;
  dueOn: string | null;
  returnedOn: string | null;
  notes: string | null;
};

export type LibraryLoanSave = Omit<LibraryLoan, 'id' | 'itemId'>;

export type LibraryLoanListItem = LibraryLoan & {
  manifestationId: number;
  title: string;
  authors: string[];
  isOverdue: boolean;
};

export type LibraryReadingSave = {
  startedOn: string | null;
  finishedOn: string | null;
  rating: number | null;
  notes: string | null;
};

export type LibraryReadingListItem = LibraryReadingSave & {
  id: number;
  itemId: number;
  manifestationId: number;
  title: string;
  authors: string[];
};

// ── Arrangement ──────────────────────────────────────────────────────────────

export type LibraryArrangementPlacement = {
  itemId: number;
  title: string;
  shelfId: number;
  shelfName: string;
  position: number;
  previousItemId: number | null;
  previousTitle: string | null;
  nextItemId: number | null;
  nextTitle: string | null;
  groupName: string | null;
  imageUrl: string | null;
  matchesCurrent: boolean;
};

export type LibraryArrangement = {
  placements: LibraryArrangementPlacement[];
  unplaced: { itemId: number; title: string; reason: string }[];
  notes: string[];
};

// ── Overview and scanning ────────────────────────────────────────────────────

export type LibraryCountByKey = { key: string; label: string; count: number };

export type LibraryOverview = {
  works: number;
  expressions: number;
  manifestations: number;
  items: number;
  quotes: number;
  people: number;
  publishers: number;
  shelves: number;
  tags: number;
  translations: number;
  openLoansOut: number;
  openLoansIn: number;
  overdueLoans: number;
  read: number;
  reading: number;
  unread: number;
  byLanguage: LibraryCountByKey[];
  byCitationScheme: LibraryCountByKey[];
  byKind: LibraryCountByKey[];
  byShelf: LibraryCountByKey[];
  topAuthors: LibraryCountByKey[];
  topTags: LibraryCountByKey[];
  recentQuotes: LibraryQuote[];
  recentlyAdded: LibraryItemListItem[];
};

export type LibraryLookup = {
  isbn: string;
  title: string | null;
  subtitle: string | null;
  authors: string[];
  translators: string[];
  contributors: { name: string; role: string }[];
  publisher: string | null;
  publishedPlace: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  language: string | null;
  originalLanguage: string | null;
  series: string | null;
  binding: string | null;
  coverUrl: string | null;
  sources: string[];
};

export type LibraryScanResult = {
  isbn: string;
  matchingManifestations: LibraryManifestationListItem[];
  ownedItems: LibraryItemListItem[];
  lookup: LibraryLookup | null;
  lookupAttempted: boolean;
};

export type LibraryScanImport = {
  isbn: string;
  originalTitle: string;
  originalLanguage: string;
  kind: string;
  citationScheme: string;
  firstPublishedYear: number | null;
  manifestationTitle: string;
  manifestationSubtitle: string | null;
  expressionLanguage: string;
  expressionName: string | null;
  publisherName: string | null;
  publishedPlace: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  series: string | null;
  binding: string | null;
  coverImageUrl: string | null;
  heightMm: number | null;
  widthMm: number | null;
  depthMm: number | null;
  authorNames: string[];
  translatorNames: string[];
  shelfId: number | null;
  createItem: boolean;
};

export type LibraryScanImportResult = {
  workId: number;
  expressionId: number | null;
  manifestationId: number;
  itemId: number | null;
};

// ── Filters ──────────────────────────────────────────────────────────────────

export type LibraryWorkFilters = {
  term?: string;
  kind?: string;
  citationScheme?: string;
  originalLanguage?: string;
  expressionLanguage?: string;
  personId?: number;
  tagId?: number;
  publisherId?: number;
  onlyTranslated?: boolean;
  onlyOwned?: boolean;
  onlyQuoted?: boolean;
  sort?: string;
  skip?: number;
  take?: number;
};

export type LibraryItemFilters = {
  term?: string;
  shelfId?: number;
  status?: string;
  readingStatus?: string;
  language?: string;
  favourite?: boolean;
  minRating?: number;
  sort?: string;
  skip?: number;
  take?: number;
};

export type LibraryQuoteFilters = {
  term?: string;
  workId?: number;
  tagId?: number;
  personId?: number;
  citationScheme?: string;
  lang?: string;
  /** Citation style key; changes only how the reference is written. */
  style?: string;
  sort?: string;
  skip?: number;
  take?: number;
};

// ── Registry calls ───────────────────────────────────────────────────────────

export const getPeople = (term?: string) =>
  req<LibraryPerson[]>(`/library/people${query({ term })}`, { method: 'GET' });
export const createPerson = (body: LibraryPersonSave) =>
  req<LibraryPerson>('/library/people', { method: 'POST', body: JSON.stringify(body) });
export const updatePerson = (id: number, body: LibraryPersonSave) =>
  req<LibraryPerson>(`/library/people/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deletePerson = (id: number) => req<void>(`/library/people/${id}`, { method: 'DELETE' });

export const getPublishers = () => req<LibraryPublisher[]>('/library/publishers', { method: 'GET' });
export const createPublisher = (body: LibraryPublisherSave) =>
  req<LibraryPublisher>('/library/publishers', { method: 'POST', body: JSON.stringify(body) });
export const updatePublisher = (id: number, body: LibraryPublisherSave) =>
  req<LibraryPublisher>(`/library/publishers/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deletePublisher = (id: number) => req<void>(`/library/publishers/${id}`, { method: 'DELETE' });

export const getShelves = () => req<LibraryShelf[]>('/library/shelves', { method: 'GET' });
export const createShelf = (body: LibraryShelfSave) =>
  req<LibraryShelf>('/library/shelves', { method: 'POST', body: JSON.stringify(body) });
export const updateShelf = (id: number, body: LibraryShelfSave) =>
  req<LibraryShelf>(`/library/shelves/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteShelf = (id: number) => req<void>(`/library/shelves/${id}`, { method: 'DELETE' });

export const getTags = () => req<LibraryTag[]>('/library/tags', { method: 'GET' });
export const createTag = (body: LibraryTagSave) =>
  req<LibraryTag>('/library/tags', { method: 'POST', body: JSON.stringify(body) });
export const updateTag = (id: number, body: LibraryTagSave) =>
  req<LibraryTag>(`/library/tags/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteTag = (id: number) => req<void>(`/library/tags/${id}`, { method: 'DELETE' });

export const getPlacementGroups = () =>
  req<LibraryPlacementGroup[]>('/library/placement-groups', { method: 'GET' });
export const createPlacementGroup = (body: LibraryPlacementGroupSave) =>
  req<LibraryPlacementGroup>('/library/placement-groups', { method: 'POST', body: JSON.stringify(body) });
export const updatePlacementGroup = (id: number, body: LibraryPlacementGroupSave) =>
  req<LibraryPlacementGroup>(`/library/placement-groups/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deletePlacementGroup = (id: number) =>
  req<void>(`/library/placement-groups/${id}`, { method: 'DELETE' });

// ── Catalogue calls ──────────────────────────────────────────────────────────

export const getWorks = (filters: LibraryWorkFilters) =>
  req<LibraryWorkList>(`/library/works${query({ ...filters })}`, { method: 'GET' });
export const getWork = (id: number) => req<LibraryWorkDetail>(`/library/works/${id}`, { method: 'GET' });
export const createWork = (body: LibraryWorkSave) =>
  req<{ id: number }>('/library/works', { method: 'POST', body: JSON.stringify(body) });
export const updateWork = (id: number, body: LibraryWorkSave) =>
  req<{ id: number }>(`/library/works/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteWork = (id: number, force = false) =>
  req<void>(`/library/works/${id}${force ? '?force=true' : ''}`, { method: 'DELETE' });
export const saveWorkContributions = (id: number, contributions: LibraryContributionSave[]) =>
  req<LibraryContribution[]>(`/library/works/${id}/contributions`, {
    method: 'PUT',
    body: JSON.stringify({ contributions })
  });
export const saveWorkTags = (id: number, tagIds: number[]) =>
  req<number[]>(`/library/works/${id}/tags`, { method: 'PUT', body: JSON.stringify({ tagIds }) });

export const createExpression = (workId: number, body: LibraryExpressionSave) =>
  req<{ id: number }>(`/library/works/${workId}/expressions`, { method: 'POST', body: JSON.stringify(body) });
export const getExpression = (id: number) =>
  req<LibraryExpressionDetail>(`/library/expressions/${id}`, { method: 'GET' });
export const updateExpression = (id: number, body: LibraryExpressionSave) =>
  req<{ id: number }>(`/library/expressions/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteExpression = (id: number, force = false) =>
  req<void>(`/library/expressions/${id}${force ? '?force=true' : ''}`, { method: 'DELETE' });
export const saveExpressionContributions = (id: number, contributions: LibraryContributionSave[]) =>
  req<LibraryContribution[]>(`/library/expressions/${id}/contributions`, {
    method: 'PUT',
    body: JSON.stringify({ contributions })
  });

export const createManifestation = (workId: number, body: LibraryManifestationSave) =>
  req<{ id: number }>(`/library/works/${workId}/manifestations`, { method: 'POST', body: JSON.stringify(body) });
export const getManifestation = (id: number) =>
  req<LibraryManifestationDetail>(`/library/manifestations/${id}`, { method: 'GET' });
export const updateManifestation = (id: number, body: LibraryManifestationSave) =>
  req<{ id: number }>(`/library/manifestations/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteManifestation = (id: number, force = false) =>
  req<void>(`/library/manifestations/${id}${force ? '?force=true' : ''}`, { method: 'DELETE' });
export const saveManifestationContributions = (id: number, contributions: LibraryContributionSave[]) =>
  req<LibraryContribution[]>(`/library/manifestations/${id}/contributions`, {
    method: 'PUT',
    body: JSON.stringify({ contributions })
  });

export const getItems = (filters: LibraryItemFilters) =>
  req<LibraryItemList>(`/library/items${query({ ...filters })}`, { method: 'GET' });
export const createItem = (manifestationId: number, body: LibraryItemSave) =>
  req<{ id: number }>(`/library/manifestations/${manifestationId}/items`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
export const updateItem = (id: number, body: LibraryItemSave) =>
  req<{ id: number }>(`/library/items/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteItem = (id: number) => req<void>(`/library/items/${id}`, { method: 'DELETE' });

// ── Quote calls ──────────────────────────────────────────────────────────────

export const getCitationSchemes = () =>
  req<LibraryCitationSchemeSpec[]>('/library/citation-schemes', { method: 'GET' });
export const getCitationStyles = () =>
  req<LibraryCitationStyleSpec[]>('/library/citation-styles', { method: 'GET' });
export const getBibleBooks = () => req<LibraryBibleBook[]>('/library/bible-books', { method: 'GET' });

export const getQuotes = (filters: LibraryQuoteFilters) =>
  req<LibraryQuoteList>(`/library/quotes${query({ ...filters })}`, { method: 'GET' });
export const getQuote = (id: number, lang?: string) =>
  req<LibraryQuote>(`/library/quotes/${id}${query({ lang })}`, { method: 'GET' });
export const createQuote = (body: LibraryQuoteSave, lang?: string) =>
  req<{ id: number }>(`/library/quotes${query({ lang })}`, { method: 'POST', body: JSON.stringify(body) });
export const updateQuote = (id: number, body: LibraryQuoteSave, lang?: string) =>
  req<{ id: number }>(`/library/quotes/${id}${query({ lang })}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteQuote = (id: number) => req<void>(`/library/quotes/${id}`, { method: 'DELETE' });

export const importQuotes = (quotes: unknown[], lang?: string) =>
  req<LibraryQuoteImportResult>(`/library/quotes/import${query({ lang })}`, {
    method: 'POST',
    body: JSON.stringify({ quotes })
  });

// ── Loans, readings, shelving, scanning ──────────────────────────────────────

export const getLoans = (openOnly?: boolean) =>
  req<LibraryLoanListItem[]>(`/library/loans${query({ openOnly })}`, { method: 'GET' });
export const createLoan = (itemId: number, body: LibraryLoanSave) =>
  req<LibraryLoan>(`/library/items/${itemId}/loans`, { method: 'POST', body: JSON.stringify(body) });
export const updateLoan = (id: number, body: LibraryLoanSave) =>
  req<LibraryLoan>(`/library/loans/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteLoan = (id: number) => req<void>(`/library/loans/${id}`, { method: 'DELETE' });

export const getReadings = () => req<LibraryReadingListItem[]>('/library/readings', { method: 'GET' });
export const createReading = (itemId: number, body: LibraryReadingSave) =>
  req<{ id: number }>(`/library/items/${itemId}/readings`, { method: 'POST', body: JSON.stringify(body) });
export const updateReading = (id: number, body: LibraryReadingSave) =>
  req<{ id: number }>(`/library/readings/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteReading = (id: number) => req<void>(`/library/readings/${id}`, { method: 'DELETE' });

export const getArrangement = (shelfId?: number) =>
  req<LibraryArrangement>(`/library/arrangement${query({ shelfId })}`, { method: 'GET' });
export const applyArrangement = (placements: { itemId: number; shelfId: number; position: number }[]) =>
  req<{ applied: number }>('/library/arrangement/apply', {
    method: 'POST',
    body: JSON.stringify({ placements })
  });

export const getOverview = (lang?: string) =>
  req<LibraryOverview>(`/library/overview${query({ lang })}`, { method: 'GET' });

export const scanIsbn = (code: string, lookup?: boolean) =>
  req<LibraryScanResult>(`/library/scan${query({ code, lookup })}`, { method: 'GET' });
export const importScan = (body: LibraryScanImport) =>
  req<LibraryScanImportResult>('/library/scan/import', { method: 'POST', body: JSON.stringify(body) });
