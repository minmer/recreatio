import {
  getCogitaCollections,
  getCogitaLibraries,
  getCogitaLibraryStats,
  type CogitaCollectionSummary,
  type CogitaLibraryStats
} from '../../../lib/api';

const libraryNameById = new Map<string, string>();
let librariesPromise: Promise<void> | null = null;

const libraryStatsById = new Map<string, CogitaLibraryStats | null>();
const libraryStatsPromises = new Map<string, Promise<CogitaLibraryStats | null>>();

const collectionsByLibrary = new Map<string, CogitaCollectionSummary[]>();
const collectionsPromises = new Map<string, Promise<CogitaCollectionSummary[]>>();

async function ensureLibrariesLoaded() {
  if (librariesPromise) {
    await librariesPromise;
    return;
  }
  librariesPromise = getCogitaLibraries()
    .then((libraries) => {
      libraries.forEach((library) => {
        libraryNameById.set(library.libraryId, library.name);
      });
    })
    .catch(() => {
      // Keep cache empty on transient failures.
    })
    .finally(() => {
      librariesPromise = null;
    });
  await librariesPromise;
}

export async function getCachedLibraryName(libraryId: string): Promise<string | null> {
  const existing = libraryNameById.get(libraryId);
  if (existing) return existing;
  await ensureLibrariesLoaded();
  return libraryNameById.get(libraryId) ?? null;
}

export async function getCachedLibraryStats(libraryId: string): Promise<CogitaLibraryStats | null> {
  if (libraryStatsById.has(libraryId)) {
    return libraryStatsById.get(libraryId) ?? null;
  }
  const existingPromise = libraryStatsPromises.get(libraryId);
  if (existingPromise) return existingPromise;

  const nextPromise = getCogitaLibraryStats(libraryId)
    .then((stats) => {
      libraryStatsById.set(libraryId, stats);
      return stats;
    })
    .catch(() => {
      libraryStatsById.set(libraryId, null);
      return null;
    })
    .finally(() => {
      libraryStatsPromises.delete(libraryId);
    });

  libraryStatsPromises.set(libraryId, nextPromise);
  return nextPromise;
}

export async function getCachedCollections(libraryId: string): Promise<CogitaCollectionSummary[]> {
  const cached = collectionsByLibrary.get(libraryId);
  if (cached) return cached;

  const existingPromise = collectionsPromises.get(libraryId);
  if (existingPromise) return existingPromise;

  const nextPromise = getCogitaCollections({ libraryId, limit: 200 })
    .then((bundle) => {
      collectionsByLibrary.set(libraryId, bundle.items);
      return bundle.items;
    })
    .catch(() => [])
    .finally(() => {
      collectionsPromises.delete(libraryId);
    });

  collectionsPromises.set(libraryId, nextPromise);
  return nextPromise;
}

export function primeCachedCollections(libraryId: string, items: CogitaCollectionSummary[]) {
  collectionsByLibrary.set(libraryId, items);
}
