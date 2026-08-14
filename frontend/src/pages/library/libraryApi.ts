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
// Kept in sync with the sets validated in LibraryEndpoints.cs.

export const WORK_KINDS = [
  'book', 'article', 'essay', 'poetry', 'drama', 'treatise', 'collection', 'reference', 'other'
] as const;

export const CONTRIBUTION_ROLES = [
  'author', 'coauthor', 'editor', 'translator', 'illustrator',
  'foreword', 'afterword', 'commentary', 'compiler', 'other'
] as const;

export const COPY_STATUSES = ['shelf', 'lent', 'borrowed', 'wanted', 'ordered', 'lost', 'sold'] as const;

export const COPY_CONDITIONS = ['new', 'good', 'fair', 'worn', 'damaged'] as const;

export const READING_STATUSES = ['unread', 'reading', 'read', 'abandoned', 'reference'] as const;

export const BINDINGS = ['hardcover', 'paperback', 'leather', 'ebook', 'audiobook', 'other'] as const;

export const LOAN_DIRECTIONS = ['out', 'in'] as const;

/** Languages offered in the pickers. Any other code can still be typed by hand. */
export const LANGUAGE_CODES = [
  'pl', 'en', 'de', 'fr', 'it', 'es', 'pt', 'nl', 'la', 'grc', 'he', 'ru', 'uk',
  'cs', 'sk', 'hu', 'lt', 'sv', 'no', 'da', 'fi', 'ro', 'el', 'tr', 'ar', 'zh', 'ja'
] as const;

export type WorkKind = (typeof WORK_KINDS)[number];
export type ContributionRole = (typeof CONTRIBUTION_ROLES)[number];
export type CopyStatus = (typeof COPY_STATUSES)[number];
export type CopyCondition = (typeof COPY_CONDITIONS)[number];
export type ReadingStatus = (typeof READING_STATUSES)[number];
export type Binding = (typeof BINDINGS)[number];
export type LoanDirection = (typeof LOAN_DIRECTIONS)[number];

// ── Types ────────────────────────────────────────────────────────────────────

export type LibraryPerson = {
  id: number;
  displayName: string;
  sortName: string | null;
  birthYear: number | null;
  deathYear: number | null;
  nationality: string | null;
  notes: string | null;
  workCount: number;
  editionCount: number;
};

export type LibraryPersonSave = {
  displayName: string;
  sortName: string | null;
  birthYear: number | null;
  deathYear: number | null;
  nationality: string | null;
  notes: string | null;
};

export type LibraryPublisher = {
  id: number;
  name: string;
  city: string | null;
  notes: string | null;
  editionCount: number;
};

export type LibraryPublisherSave = {
  name: string;
  city: string | null;
  notes: string | null;
};

export type LibraryShelf = {
  id: number;
  name: string;
  location: string | null;
  description: string | null;
  sortOrder: number;
  copyCount: number;
};

export type LibraryShelfSave = {
  name: string;
  location: string | null;
  description: string | null;
  sortOrder: number;
};

export type LibraryTag = {
  id: number;
  name: string;
  color: string | null;
  workCount: number;
};

export type LibraryTagSave = {
  name: string;
  color: string | null;
};

export type LibraryContribution = {
  id: number;
  personId: number;
  personName: string;
  role: string;
  sortOrder: number;
};

export type LibraryContributionSave = {
  personId: number;
  role: string;
};

export type LibraryWorkListItem = {
  id: number;
  originalTitle: string;
  originalSubtitle: string | null;
  originalLanguage: string;
  uniformTitle: string | null;
  kind: string;
  firstPublishedYear: number | null;
  authors: string[];
  editionLanguages: string[];
  tags: LibraryTag[];
  editionCount: number;
  copyCount: number;
};

export type LibraryWorkList = {
  items: LibraryWorkListItem[];
  total: number;
};

export type LibraryEditionListItem = {
  id: number;
  workId: number;
  title: string;
  subtitle: string | null;
  language: string;
  isTranslation: boolean;
  publisherId: number | null;
  publisherName: string | null;
  publishedPlace: string | null;
  publishedYear: number | null;
  editionStatement: string | null;
  isbn: string | null;
  pageCount: number | null;
  binding: string | null;
  translators: string[];
  copyCount: number;
};

export type LibraryWorkDetail = {
  id: number;
  originalTitle: string;
  originalSubtitle: string | null;
  originalLanguage: string;
  uniformTitle: string | null;
  kind: string;
  firstPublishedYear: number | null;
  notes: string | null;
  contributions: LibraryContribution[];
  tagIds: number[];
  editions: LibraryEditionListItem[];
  createdUtc: string;
  updatedUtc: string;
};

export type LibraryWorkSave = {
  originalTitle: string;
  originalSubtitle: string | null;
  originalLanguage: string;
  uniformTitle: string | null;
  kind: string;
  firstPublishedYear: number | null;
  notes: string | null;
};

export type LibraryEditionSave = {
  title: string;
  subtitle: string | null;
  language: string;
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
  coverUrl: string | null;
  notes: string | null;
};

export type LibraryLoan = {
  id: number;
  copyId: number;
  direction: string;
  counterpartName: string;
  counterpartContact: string | null;
  lentOn: string;
  dueOn: string | null;
  returnedOn: string | null;
  notes: string | null;
};

export type LibraryCopy = {
  id: number;
  editionId: number;
  shelfId: number | null;
  shelfName: string | null;
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
  notes: string | null;
  openLoan: LibraryLoan | null;
};

export type LibraryCopySave = {
  shelfId: number | null;
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
  notes: string | null;
};

export type LibraryEditionDetail = {
  id: number;
  workId: number;
  workOriginalTitle: string;
  workOriginalLanguage: string;
  title: string;
  subtitle: string | null;
  language: string;
  isTranslation: boolean;
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
  coverUrl: string | null;
  notes: string | null;
  contributions: LibraryContribution[];
  copies: LibraryCopy[];
  createdUtc: string;
  updatedUtc: string;
};

export type LibraryCopyListItem = {
  id: number;
  editionId: number;
  workId: number;
  editionTitle: string;
  workOriginalTitle: string;
  language: string;
  isTranslation: boolean;
  authors: string[];
  publisherName: string | null;
  publishedYear: number | null;
  shelfId: number | null;
  shelfName: string | null;
  signature: string | null;
  status: string;
  condition: string | null;
  readingStatus: string;
  rating: number | null;
  isFavourite: boolean;
  openLoan: LibraryLoan | null;
};

export type LibraryCopyList = {
  items: LibraryCopyListItem[];
  total: number;
};

export type LibraryLoanSave = {
  direction: string;
  counterpartName: string;
  counterpartContact: string | null;
  lentOn: string;
  dueOn: string | null;
  returnedOn: string | null;
  notes: string | null;
};

export type LibraryLoanListItem = {
  id: number;
  copyId: number;
  editionId: number;
  editionTitle: string;
  authors: string[];
  direction: string;
  counterpartName: string;
  counterpartContact: string | null;
  lentOn: string;
  dueOn: string | null;
  returnedOn: string | null;
  isOverdue: boolean;
  notes: string | null;
};

export type LibraryReadingSave = {
  startedOn: string | null;
  finishedOn: string | null;
  rating: number | null;
  notes: string | null;
};

export type LibraryReadingListItem = {
  id: number;
  copyId: number;
  editionId: number;
  editionTitle: string;
  authors: string[];
  startedOn: string | null;
  finishedOn: string | null;
  rating: number | null;
  notes: string | null;
};

export type LibraryCountByKey = {
  key: string;
  label: string;
  count: number;
};

export type LibraryOverview = {
  works: number;
  editions: number;
  copies: number;
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
  byOriginalLanguage: LibraryCountByKey[];
  byKind: LibraryCountByKey[];
  byShelf: LibraryCountByKey[];
  topAuthors: LibraryCountByKey[];
  recentlyAdded: LibraryCopyListItem[];
};

export type LibraryImportResult = {
  people: number;
  publishers: number;
  shelves: number;
  tags: number;
  works: number;
  editions: number;
  copies: number;
  loans: number;
  readings: number;
};

export type LibraryWorkFilters = {
  term?: string;
  kind?: string;
  originalLanguage?: string;
  editionLanguage?: string;
  personId?: number;
  tagId?: number;
  publisherId?: number;
  onlyTranslated?: boolean;
  onlyOwned?: boolean;
  sort?: string;
  skip?: number;
  take?: number;
};

export type LibraryCopyFilters = {
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

// ── People ───────────────────────────────────────────────────────────────────

export const getPeople = (term?: string) =>
  req<LibraryPerson[]>(`/library/people${query({ term })}`, { method: 'GET' });

export const createPerson = (body: LibraryPersonSave) =>
  req<LibraryPerson>('/library/people', { method: 'POST', body: JSON.stringify(body) });

export const updatePerson = (id: number, body: LibraryPersonSave) =>
  req<LibraryPerson>(`/library/people/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const deletePerson = (id: number) =>
  req<void>(`/library/people/${id}`, { method: 'DELETE' });

// ── Publishers ───────────────────────────────────────────────────────────────

export const getPublishers = () =>
  req<LibraryPublisher[]>('/library/publishers', { method: 'GET' });

export const createPublisher = (body: LibraryPublisherSave) =>
  req<LibraryPublisher>('/library/publishers', { method: 'POST', body: JSON.stringify(body) });

export const updatePublisher = (id: number, body: LibraryPublisherSave) =>
  req<LibraryPublisher>(`/library/publishers/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const deletePublisher = (id: number) =>
  req<void>(`/library/publishers/${id}`, { method: 'DELETE' });

// ── Shelves ──────────────────────────────────────────────────────────────────

export const getShelves = () =>
  req<LibraryShelf[]>('/library/shelves', { method: 'GET' });

export const createShelf = (body: LibraryShelfSave) =>
  req<LibraryShelf>('/library/shelves', { method: 'POST', body: JSON.stringify(body) });

export const updateShelf = (id: number, body: LibraryShelfSave) =>
  req<LibraryShelf>(`/library/shelves/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const deleteShelf = (id: number) =>
  req<void>(`/library/shelves/${id}`, { method: 'DELETE' });

// ── Tags ─────────────────────────────────────────────────────────────────────

export const getTags = () =>
  req<LibraryTag[]>('/library/tags', { method: 'GET' });

export const createTag = (body: LibraryTagSave) =>
  req<LibraryTag>('/library/tags', { method: 'POST', body: JSON.stringify(body) });

export const updateTag = (id: number, body: LibraryTagSave) =>
  req<LibraryTag>(`/library/tags/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const deleteTag = (id: number) =>
  req<void>(`/library/tags/${id}`, { method: 'DELETE' });

// ── Works ────────────────────────────────────────────────────────────────────

export const getWorks = (filters: LibraryWorkFilters) =>
  req<LibraryWorkList>(`/library/works${query({ ...filters })}`, { method: 'GET' });

export const getWork = (id: number) =>
  req<LibraryWorkDetail>(`/library/works/${id}`, { method: 'GET' });

export const createWork = (body: LibraryWorkSave) =>
  req<{ id: number }>('/library/works', { method: 'POST', body: JSON.stringify(body) });

export const updateWork = (id: number, body: LibraryWorkSave) =>
  req<{ id: number }>(`/library/works/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const deleteWork = (id: number) =>
  req<void>(`/library/works/${id}`, { method: 'DELETE' });

export const saveWorkContributions = (id: number, contributions: LibraryContributionSave[]) =>
  req<LibraryContribution[]>(`/library/works/${id}/contributions`, {
    method: 'PUT',
    body: JSON.stringify({ contributions })
  });

export const saveWorkTags = (id: number, tagIds: number[]) =>
  req<number[]>(`/library/works/${id}/tags`, { method: 'PUT', body: JSON.stringify({ tagIds }) });

// ── Editions ─────────────────────────────────────────────────────────────────

export const getEdition = (id: number) =>
  req<LibraryEditionDetail>(`/library/editions/${id}`, { method: 'GET' });

export const createEdition = (workId: number, body: LibraryEditionSave) =>
  req<{ id: number }>(`/library/works/${workId}/editions`, { method: 'POST', body: JSON.stringify(body) });

export const updateEdition = (id: number, body: LibraryEditionSave) =>
  req<{ id: number }>(`/library/editions/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const deleteEdition = (id: number) =>
  req<void>(`/library/editions/${id}`, { method: 'DELETE' });

export const saveEditionContributions = (id: number, contributions: LibraryContributionSave[]) =>
  req<LibraryContribution[]>(`/library/editions/${id}/contributions`, {
    method: 'PUT',
    body: JSON.stringify({ contributions })
  });

// ── Copies ───────────────────────────────────────────────────────────────────

export const getCopies = (filters: LibraryCopyFilters) =>
  req<LibraryCopyList>(`/library/copies${query({ ...filters })}`, { method: 'GET' });

export const createCopy = (editionId: number, body: LibraryCopySave) =>
  req<{ id: number }>(`/library/editions/${editionId}/copies`, { method: 'POST', body: JSON.stringify(body) });

export const updateCopy = (id: number, body: LibraryCopySave) =>
  req<{ id: number }>(`/library/copies/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const deleteCopy = (id: number) =>
  req<void>(`/library/copies/${id}`, { method: 'DELETE' });

// ── Loans ────────────────────────────────────────────────────────────────────

export const getLoans = (openOnly?: boolean) =>
  req<LibraryLoanListItem[]>(`/library/loans${query({ openOnly })}`, { method: 'GET' });

export const createLoan = (copyId: number, body: LibraryLoanSave) =>
  req<LibraryLoan>(`/library/copies/${copyId}/loans`, { method: 'POST', body: JSON.stringify(body) });

export const updateLoan = (id: number, body: LibraryLoanSave) =>
  req<LibraryLoan>(`/library/loans/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const deleteLoan = (id: number) =>
  req<void>(`/library/loans/${id}`, { method: 'DELETE' });

// ── Readings ─────────────────────────────────────────────────────────────────

export const getReadings = () =>
  req<LibraryReadingListItem[]>('/library/readings', { method: 'GET' });

export const createReading = (copyId: number, body: LibraryReadingSave) =>
  req<{ id: number }>(`/library/copies/${copyId}/readings`, { method: 'POST', body: JSON.stringify(body) });

export const updateReading = (id: number, body: LibraryReadingSave) =>
  req<{ id: number }>(`/library/readings/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const deleteReading = (id: number) =>
  req<void>(`/library/readings/${id}`, { method: 'DELETE' });

// ── Barcode scanning ─────────────────────────────────────────────────────────

export type LibraryLookupContributor = {
  name: string;
  role: string;
};

export type LibraryLookup = {
  isbn: string;
  title: string | null;
  subtitle: string | null;
  authors: string[];
  translators: string[];
  /** Everyone the catalogue lists, with their role — richest from Biblioteka Narodowa. */
  contributors: LibraryLookupContributor[];
  publisher: string | null;
  publishedPlace: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  language: string | null;
  /** Set when the catalogue records it — Biblioteka Narodowa does, the others do not. */
  originalLanguage: string | null;
  series: string | null;
  coverUrl: string | null;
  sources: string[];
};

export type LibraryScanResult = {
  isbn: string;
  matchingEditions: LibraryEditionListItem[];
  ownedCopies: LibraryCopyListItem[];
  lookup: LibraryLookup | null;
  lookupAttempted: boolean;
};

export type LibraryScanImport = {
  isbn: string;
  originalTitle: string;
  originalLanguage: string;
  kind: string;
  firstPublishedYear: number | null;
  editionTitle: string;
  editionSubtitle: string | null;
  editionLanguage: string;
  publisherName: string | null;
  publishedPlace: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  series: string | null;
  coverUrl: string | null;
  authorNames: string[];
  translatorNames: string[];
  shelfId: number | null;
  createCopy: boolean;
};

export type LibraryScanImportResult = {
  workId: number;
  editionId: number;
  copyId: number | null;
};

/** `lookup` forces the external catalogue call even when the shelf already matches. */
export const scanIsbn = (code: string, lookup?: boolean) =>
  req<LibraryScanResult>(`/library/scan${query({ code, lookup })}`, { method: 'GET' });

export const importScan = (body: LibraryScanImport) =>
  req<LibraryScanImportResult>('/library/scan/import', { method: 'POST', body: JSON.stringify(body) });

// ── Overview and transfer ────────────────────────────────────────────────────

export const getOverview = () =>
  req<LibraryOverview>('/library/overview', { method: 'GET' });

export const exportLibrary = () =>
  req<unknown>('/library/export', { method: 'GET' });

export const importLibrary = (bundle: unknown) =>
  req<LibraryImportResult>('/library/import', { method: 'POST', body: JSON.stringify(bundle) });
