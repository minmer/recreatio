type CollectionFromInfosDraft = {
  kind: 'info-selection';
  libraryId: string;
  infoIds: string[];
  createdAt: string;
};

const STORAGE_PREFIX = 'cogita.collection-draft:';

function storageKey(seedId: string) {
  return `${STORAGE_PREFIX}${seedId}`;
}

export function saveCollectionDraftFromInfos(libraryId: string, infoIds: string[]) {
  if (typeof window === 'undefined') return null;
  const uniqueIds = Array.from(new Set(infoIds.map((id) => id.trim()).filter(Boolean)));
  if (!uniqueIds.length) return null;
  const seedId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const payload: CollectionFromInfosDraft = {
    kind: 'info-selection',
    libraryId,
    infoIds: uniqueIds,
    createdAt: new Date().toISOString()
  };
  window.localStorage.setItem(storageKey(seedId), JSON.stringify(payload));
  return seedId;
}

export function loadCollectionDraftFromInfos(libraryId: string, seedId: string) {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(storageKey(seedId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CollectionFromInfosDraft>;
    if (parsed.kind !== 'info-selection') return null;
    if (parsed.libraryId !== libraryId) return null;
    if (!Array.isArray(parsed.infoIds)) return null;
    const infoIds = parsed.infoIds.map((id) => String(id ?? '').trim()).filter(Boolean);
    if (!infoIds.length) return null;
    return { infoIds };
  } catch {
    return null;
  }
}

