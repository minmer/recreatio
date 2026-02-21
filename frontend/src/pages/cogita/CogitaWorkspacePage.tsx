import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createCogitaCollection,
  createCogitaLibrary,
  createDataItem,
  getCogitaCollections,
  getCogitaLibraries,
  getRoleGraph,
  getRoles,
  issueCsrf,
  updateDataItem,
  type CogitaCollectionSummary,
  type CogitaLibrary,
  type RoleResponse
} from '../../lib/api';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { CogitaShell } from './CogitaShell';
import { useLocation, useNavigate } from 'react-router-dom';

type RevisionView = 'detail' | 'graph' | 'settings' | 'run';

type CogitaPreferences = {
  version: 1;
  lastLibraryId?: string;
  byLibrary?: Record<string, { lastCollectionId?: string; lastRevisionView?: RevisionView }>;
};

type ParsedCogitaPath = {
  libraryId?: string;
  collectionId?: string;
  revisionView?: RevisionView;
};

const PREFS_ITEM_NAME = 'cogita.preferences';

function parseCogitaPath(pathname: string): ParsedCogitaPath {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'cogita' || segments[1] !== 'library') {
    return {};
  }

  const libraryId = segments[2];
  if (!libraryId) {
    return {};
  }

  if (segments[3] !== 'collections') {
    return { libraryId };
  }

  const collectionId = segments[4] && segments[4] !== 'new' ? segments[4] : undefined;
  if (!collectionId) {
    return { libraryId };
  }

  if (segments[5] === 'graph') {
    return { libraryId, collectionId, revisionView: 'graph' };
  }

  if (segments[5] === 'revision') {
    return { libraryId, collectionId, revisionView: segments[6] === 'run' ? 'run' : 'settings' };
  }

  return { libraryId, collectionId, revisionView: 'detail' };
}

function buildCogitaPath(libraryId?: string, collectionId?: string, revisionView?: RevisionView): string {
  if (!libraryId) {
    return '/cogita';
  }
  if (!collectionId) {
    return `/cogita/library/${libraryId}/collections`;
  }

  if (revisionView === 'graph') {
    return `/cogita/library/${libraryId}/collections/${collectionId}/graph`;
  }
  if (revisionView === 'settings') {
    return `/cogita/library/${libraryId}/collections/${collectionId}/revision`;
  }
  if (revisionView === 'run') {
    return `/cogita/library/${libraryId}/collections/${collectionId}/revision/run`;
  }
  return `/cogita/library/${libraryId}/collections/${collectionId}`;
}

function resolvePreferenceRoleId(roles: RoleResponse[], ownedRoleIds: Set<string>): string | null {
  if (!roles.length) return null;

  const writableRoles = roles.filter((role) => ownedRoleIds.has(role.roleId));
  const candidates = writableRoles.length > 0 ? writableRoles : roles;

  const roleKinds = candidates.map((role) => {
    const roleKind = role.fields.find((field) => field.fieldType === 'role_kind')?.plainValue?.toLowerCase() ?? '';
    return { roleId: role.roleId, roleKind };
  });

  const master = roleKinds.find((entry) => entry.roleKind.includes('master'));
  if (master) return master.roleId;

  const account = roleKinds.find((entry) => entry.roleKind.includes('account') || entry.roleKind.includes('user'));
  if (account) return account.roleId;

  return candidates[0]?.roleId ?? null;
}

function safeParsePreferences(raw?: string | null): CogitaPreferences {
  if (!raw) {
    return { version: 1, byLibrary: {} };
  }

  try {
    const parsed = JSON.parse(raw) as CogitaPreferences;
    if (!parsed || typeof parsed !== 'object') {
      return { version: 1, byLibrary: {} };
    }
    return {
      version: 1,
      lastLibraryId: parsed.lastLibraryId,
      byLibrary: parsed.byLibrary ?? {}
    };
  } catch {
    return { version: 1, byLibrary: {} };
  }
}

export function CogitaWorkspacePage({
  copy,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange
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
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathState = useMemo(() => parseCogitaPath(location.pathname), [location.pathname]);

  const [libraries, setLibraries] = useState<CogitaLibrary[]>([]);
  const [collections, setCollections] = useState<CogitaCollectionSummary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | undefined>(undefined);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(undefined);
  const [selectedRevisionView, setSelectedRevisionView] = useState<RevisionView>('detail');
  const [loading, setLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');

  const [preferenceRoleId, setPreferenceRoleId] = useState<string | null>(null);
  const [preferenceDataItemId, setPreferenceDataItemId] = useState<string | null>(null);
  const prefsRef = useRef<CogitaPreferences>({ version: 1, byLibrary: {} });
  const initializedRef = useRef(false);
  const savingRef = useRef(false);

  const selectedLibrary = useMemo(
    () => libraries.find((library) => library.libraryId === selectedLibraryId) ?? null,
    [libraries, selectedLibraryId]
  );
  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.collectionId === selectedCollectionId) ?? null,
    [collections, selectedCollectionId]
  );

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      setLoading(true);
      try {
        await issueCsrf();
        const [libraryItems, roles, graph] = await Promise.all([getCogitaLibraries(), getRoles(), getRoleGraph()]);
        if (cancelled) return;

        setLibraries(libraryItems);

        const ownedRoleIds = new Set(
          graph.nodes.filter((node) => node.nodeType === 'role' && node.canLink).map((node) => node.roleId ?? '')
        );
        const roleId = resolvePreferenceRoleId(roles, ownedRoleIds);
        setPreferenceRoleId(roleId);

        if (roleId) {
          const preferenceNode = graph.nodes.find(
            (node) =>
              node.nodeType === 'data' &&
              node.roleId === roleId &&
              (node.fieldType === PREFS_ITEM_NAME || node.label === PREFS_ITEM_NAME)
          );
          setPreferenceDataItemId(preferenceNode?.dataKeyId ?? null);
          prefsRef.current = safeParsePreferences(preferenceNode?.value);
        }

        const preferredLibraryFromPrefs = prefsRef.current.lastLibraryId;
        const selectedByRule =
          libraryItems.find((item) => item.libraryId === pathState.libraryId)?.libraryId ??
          (libraryItems.length === 1 ? libraryItems[0].libraryId : undefined) ??
          libraryItems.find((item) => item.libraryId === preferredLibraryFromPrefs)?.libraryId ??
          libraryItems[0]?.libraryId;

        setSelectedLibraryId(selectedByRule);
        setSelectedRevisionView(pathState.revisionView ?? 'detail');
        initializedRef.current = true;
      } catch {
        if (!cancelled) {
          setStatus('Failed to load Cogita workspace.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initializedRef.current) return;

    if (pathState.libraryId && libraries.some((library) => library.libraryId === pathState.libraryId)) {
      setSelectedLibraryId(pathState.libraryId);
    }

    if (pathState.revisionView) {
      setSelectedRevisionView(pathState.revisionView);
    }
  }, [libraries, pathState.libraryId, pathState.revisionView]);

  useEffect(() => {
    if (!selectedLibraryId) {
      setCollections([]);
      setSelectedCollectionId(undefined);
      return;
    }

    let cancelled = false;
    setCollectionsLoading(true);

    getCogitaCollections({ libraryId: selectedLibraryId, limit: 200 })
      .then((response) => {
        if (cancelled) return;

        const items = response.items;
        setCollections(items);

        const preferredCollection = prefsRef.current.byLibrary?.[selectedLibraryId]?.lastCollectionId;
        const resolvedCollectionId =
          items.find((item) => item.collectionId === pathState.collectionId)?.collectionId ??
          items.find((item) => item.collectionId === preferredCollection)?.collectionId ??
          (items.length === 1 ? items[0].collectionId : undefined);

        setSelectedCollectionId(resolvedCollectionId);
      })
      .catch(() => {
        if (!cancelled) {
          setCollections([]);
          setSelectedCollectionId(undefined);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCollectionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathState.collectionId, selectedLibraryId]);

  useEffect(() => {
    if (!initializedRef.current) return;

    const targetPath = buildCogitaPath(selectedLibraryId, selectedCollectionId, selectedRevisionView);
    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  }, [location.pathname, navigate, selectedCollectionId, selectedLibraryId, selectedRevisionView]);

  useEffect(() => {
    if (!initializedRef.current || !preferenceRoleId || !selectedLibraryId || savingRef.current) return;

    const currentPrefs = prefsRef.current;
    const byLibrary = { ...(currentPrefs.byLibrary ?? {}) };
    const nextLibraryPrefs = {
      ...(byLibrary[selectedLibraryId] ?? {}),
      lastCollectionId: selectedCollectionId,
      lastRevisionView: selectedRevisionView
    };

    const nextPrefs: CogitaPreferences = {
      version: 1,
      lastLibraryId: selectedLibraryId,
      byLibrary: {
        ...byLibrary,
        [selectedLibraryId]: nextLibraryPrefs
      }
    };

    const previousRaw = JSON.stringify(currentPrefs);
    const nextRaw = JSON.stringify(nextPrefs);
    if (previousRaw === nextRaw) {
      return;
    }

    prefsRef.current = nextPrefs;
    savingRef.current = true;

    const persist = async () => {
      try {
        if (preferenceDataItemId) {
          await updateDataItem(preferenceDataItemId, { plainValue: nextRaw });
        } else {
          const created = await createDataItem(preferenceRoleId, {
            itemName: PREFS_ITEM_NAME,
            itemType: 'data',
            plainValue: nextRaw
          });
          setPreferenceDataItemId(created.dataItemId);
        }
      } catch {
        setStatus('Could not save Cogita preferences.');
      } finally {
        savingRef.current = false;
      }
    };

    void persist();
  }, [preferenceDataItemId, preferenceRoleId, selectedCollectionId, selectedLibraryId, selectedRevisionView]);

  const handleCreateLibrary = async () => {
    const name = newLibraryName.trim();
    if (!name) {
      setStatus(copy.cogita.user.libraryNameRequired);
      return;
    }

    setStatus(null);
    try {
      const created = await createCogitaLibrary({ name });
      setLibraries((previous) => [created, ...previous]);
      setSelectedLibraryId(created.libraryId);
      setSelectedCollectionId(undefined);
      setNewLibraryName('');
    } catch {
      setStatus(copy.cogita.user.libraryCreateFailed);
    }
  };

  const handleCreateCollection = async () => {
    if (!selectedLibraryId) {
      setStatus('Select a library first.');
      return;
    }

    const name = newCollectionName.trim();
    if (!name) {
      setStatus(copy.cogita.library.collections.saveRequiredName);
      return;
    }

    setStatus(null);
    try {
      const created = await createCogitaCollection({
        libraryId: selectedLibraryId,
        name,
        items: []
      });
      const updated = await getCogitaCollections({ libraryId: selectedLibraryId, limit: 200 });
      setCollections(updated.items);
      setSelectedCollectionId(created.collectionId);
      setSelectedRevisionView('detail');
      setNewCollectionName('');
    } catch {
      setStatus(copy.cogita.library.collections.saveFail);
    }
  };

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
      <section className="cogita-browser-page">
        <header className="cogita-browser-header">
          <p className="cogita-user-kicker">Cogita Browser</p>
          <h1 className="cogita-library-title">{selectedLibrary?.name ?? copy.cogita.user.librariesTitle}</h1>
          <p className="cogita-library-subtitle">Navigate by library, collection and revision from one place.</p>
        </header>

        <nav className="cogita-browser-menu" aria-label="Cogita browser navigation">
          <div className="cogita-browser-segment">
            <span>Library</span>
            <select
              value={selectedLibraryId ?? ''}
              onChange={(event) => {
                const nextLibrary = event.target.value || undefined;
                setSelectedLibraryId(nextLibrary);
                setSelectedCollectionId(undefined);
              }}
              disabled={loading || libraries.length === 0}
            >
              {libraries.length === 0 ? <option value="">No library</option> : null}
              {libraries.map((library) => (
                <option key={library.libraryId} value={library.libraryId}>
                  {library.name}
                </option>
              ))}
            </select>
          </div>

          <span className="cogita-browser-separator">›</span>

          <div className="cogita-browser-segment">
            <span>Collection</span>
            <select
              value={selectedCollectionId ?? ''}
              onChange={(event) => setSelectedCollectionId(event.target.value || undefined)}
              disabled={!selectedLibraryId || collectionsLoading || collections.length === 0}
            >
              <option value="">All collections</option>
              {collections.map((collection) => (
                <option key={collection.collectionId} value={collection.collectionId}>
                  {collection.name}
                </option>
              ))}
            </select>
          </div>

          <span className="cogita-browser-separator">›</span>

          <div className="cogita-browser-segment">
            <span>Revision</span>
            <select
              value={selectedRevisionView}
              onChange={(event) => setSelectedRevisionView(event.target.value as RevisionView)}
              disabled={!selectedCollectionId}
            >
              <option value="detail">Detail</option>
              <option value="graph">Graph</option>
              <option value="settings">Settings</option>
              <option value="run">Run</option>
            </select>
          </div>
        </nav>

        <div className="cogita-browser-layout">
          <article className="cogita-browser-panel">
            <h2>Current position</h2>
            <p className="cogita-browser-path">
              <strong>{selectedLibrary?.name ?? 'No library selected'}</strong>
              <span> / </span>
              <strong>{selectedCollection?.name ?? 'No collection selected'}</strong>
              <span> / </span>
              <strong>{selectedRevisionView}</strong>
            </p>
            <p className="cogita-browser-note">Current route: <code>{buildCogitaPath(selectedLibraryId, selectedCollectionId, selectedRevisionView)}</code></p>

            {selectedLibraryId ? (
              <div className="cogita-browser-links">
                <a className="ghost" href={`/#/cogita/library/${selectedLibraryId}`}>
                  Library overview
                </a>
                <a className="ghost" href={`/#/cogita/library/${selectedLibraryId}/list`}>
                  Cards list
                </a>
                <a className="ghost" href={`/#/cogita/library/${selectedLibraryId}/shared-revisions`}>
                  Shared revisions
                </a>
              </div>
            ) : null}
          </article>

          <article className="cogita-browser-panel">
            <h2>Quick create</h2>
            <label className="cogita-field full">
              <span>{copy.cogita.user.libraryNameLabel}</span>
              <input
                type="text"
                value={newLibraryName}
                onChange={(event) => setNewLibraryName(event.target.value)}
                placeholder={copy.cogita.user.libraryNamePlaceholder}
              />
            </label>
            <button type="button" className="cta" onClick={handleCreateLibrary}>
              {copy.cogita.user.createLibraryAction}
            </button>

            <label className="cogita-field full">
              <span>{copy.cogita.library.collections.nameLabel}</span>
              <input
                type="text"
                value={newCollectionName}
                onChange={(event) => setNewCollectionName(event.target.value)}
                placeholder={copy.cogita.library.collections.namePlaceholder}
                disabled={!selectedLibraryId}
              />
            </label>
            <button type="button" className="cta" onClick={handleCreateCollection} disabled={!selectedLibraryId}>
              {copy.cogita.library.collections.createAction}
            </button>

            {status ? <p className="cogita-form-error">{status}</p> : null}
          </article>
        </div>

        <section className="cogita-browser-collections">
          <h2>Collections</h2>
          {collectionsLoading ? <p className="cogita-library-subtitle">Loading collections...</p> : null}
          {!collectionsLoading && collections.length === 0 ? (
            <p className="cogita-library-subtitle">No collections in this library yet.</p>
          ) : null}
          {collections.length > 0 ? (
            <div className="cogita-card-list" data-view="list">
              {collections.map((collection) => (
                <button
                  key={collection.collectionId}
                  type="button"
                  className={`cogita-card-item ${collection.collectionId === selectedCollectionId ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCollectionId(collection.collectionId);
                    setSelectedRevisionView('detail');
                  }}
                >
                  <div className="cogita-card-type">Collection</div>
                  <h3 className="cogita-card-title">{collection.name}</h3>
                  <p className="cogita-card-subtitle">{collection.itemCount} items</p>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </CogitaShell>
  );
}
