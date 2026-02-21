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
type CogitaTarget =
  | 'library_overview'
  | 'all_cards'
  | 'new_card'
  | 'all_collections'
  | 'new_collection'
  | 'shared_revisions'
  | 'dependencies'
  | 'collection_revision';

type CogitaPreferences = {
  version: 1;
  lastLibraryId?: string;
  byLibrary?: Record<string, { lastCollectionId?: string; lastRevisionView?: RevisionView; lastTarget?: CogitaTarget }>;
};

type ParsedCogitaPath = {
  libraryId?: string;
  target?: CogitaTarget;
  collectionId?: string;
  revisionView?: RevisionView;
};

const PREFS_ITEM_NAME = 'cogita.preferences';
const TARGET_OPTIONS: CogitaTarget[] = [
  'library_overview',
  'all_cards',
  'new_card',
  'all_collections',
  'new_collection',
  'collection_revision',
  'shared_revisions',
  'dependencies'
];

function parseCogitaPath(pathname: string): ParsedCogitaPath {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'cogita' || segments[1] !== 'library') {
    return {};
  }

  const libraryId = segments[2];
  if (!libraryId) {
    return {};
  }

  if (!segments[3]) {
    return { libraryId, target: 'library_overview' };
  }

  if (segments[3] === 'list') {
    return { libraryId, target: 'all_cards' };
  }

  if (segments[3] === 'new' || segments[3] === 'add') {
    return { libraryId, target: 'new_card' };
  }

  if (segments[3] === 'shared-revisions') {
    return { libraryId, target: 'shared_revisions' };
  }

  if (segments[3] === 'dependencies') {
    return { libraryId, target: 'dependencies' };
  }

  if (segments[3] !== 'collections') {
    return { libraryId, target: 'library_overview' };
  }

  if (segments[4] === 'new') {
    return { libraryId, target: 'new_collection' };
  }

  const collectionId = segments[4];
  if (!collectionId) {
    return { libraryId, target: 'all_collections' };
  }

  if (segments[5] === 'graph') {
    return { libraryId, target: 'collection_revision', collectionId, revisionView: 'graph' };
  }

  if (segments[5] === 'revision') {
    return {
      libraryId,
      target: 'collection_revision',
      collectionId,
      revisionView: segments[6] === 'run' ? 'run' : 'settings'
    };
  }

  return { libraryId, target: 'collection_revision', collectionId, revisionView: 'detail' };
}

function buildCogitaPath(
  libraryId?: string,
  target: CogitaTarget = 'library_overview',
  collectionId?: string,
  revisionView?: RevisionView
): string {
  if (!libraryId) {
    return '/cogita';
  }
  if (target === 'library_overview') {
    return `/cogita/library/${libraryId}`;
  }
  if (target === 'all_cards') {
    return `/cogita/library/${libraryId}/list`;
  }
  if (target === 'new_card') {
    return `/cogita/library/${libraryId}/add`;
  }
  if (target === 'all_collections') {
    return `/cogita/library/${libraryId}/collections`;
  }
  if (target === 'new_collection') {
    return `/cogita/library/${libraryId}/collections/new`;
  }
  if (target === 'shared_revisions') {
    return `/cogita/library/${libraryId}/shared-revisions`;
  }
  if (target === 'dependencies') {
    return `/cogita/library/${libraryId}/dependencies`;
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
  const workspaceCopy = copy.cogita.workspace;

  const [libraries, setLibraries] = useState<CogitaLibrary[]>([]);
  const [collections, setCollections] = useState<CogitaCollectionSummary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | undefined>(undefined);
  const [selectedTarget, setSelectedTarget] = useState<CogitaTarget>('library_overview');
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
  const revisionLabels = useMemo(
    () => ({
      detail: workspaceCopy.revisions.detail,
      graph: workspaceCopy.revisions.graph,
      settings: workspaceCopy.revisions.settings,
      run: workspaceCopy.revisions.run
    }),
    [workspaceCopy.revisions.detail, workspaceCopy.revisions.graph, workspaceCopy.revisions.run, workspaceCopy.revisions.settings]
  );
  const targetLabels = useMemo<Record<CogitaTarget, string>>(
    () => ({
      library_overview: workspaceCopy.targets.libraryOverview,
      all_cards: workspaceCopy.targets.allCards,
      new_card: workspaceCopy.targets.newCard,
      all_collections: workspaceCopy.targets.allCollections,
      new_collection: workspaceCopy.targets.newCollection,
      collection_revision: workspaceCopy.targets.collectionRevision,
      shared_revisions: workspaceCopy.targets.sharedRevisions,
      dependencies: workspaceCopy.targets.dependencies
    }),
    [workspaceCopy.targets]
  );
  const selectedTargetLabel = useMemo(
    () => targetLabels[selectedTarget] ?? selectedTarget,
    [selectedTarget, targetLabels]
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

        const preferredTarget =
          (selectedByRule && prefsRef.current.byLibrary?.[selectedByRule]?.lastTarget) ?? 'library_overview';
        setSelectedLibraryId(selectedByRule);
        setSelectedTarget(pathState.target ?? preferredTarget);
        setSelectedRevisionView(pathState.revisionView ?? 'detail');
        initializedRef.current = true;
      } catch {
        if (!cancelled) {
          setStatus(workspaceCopy.status.loadFailed);
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
  }, [workspaceCopy.status.loadFailed]);

  useEffect(() => {
    if (!initializedRef.current) return;

    if (pathState.libraryId && libraries.some((library) => library.libraryId === pathState.libraryId)) {
      setSelectedLibraryId(pathState.libraryId);
    }

    if (pathState.target) {
      setSelectedTarget(pathState.target);
    }

    if (pathState.revisionView) {
      setSelectedRevisionView(pathState.revisionView);
    }
  }, [libraries, pathState.libraryId, pathState.revisionView, pathState.target]);

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

    const nextPath = buildCogitaPath(selectedLibraryId, selectedTarget, selectedCollectionId, selectedRevisionView);
    if (location.pathname !== nextPath) {
      navigate(nextPath, { replace: true });
    }
  }, [location.pathname, navigate, selectedCollectionId, selectedLibraryId, selectedRevisionView, selectedTarget]);

  useEffect(() => {
    if (!initializedRef.current || !preferenceRoleId || !selectedLibraryId || savingRef.current) return;

    const currentPrefs = prefsRef.current;
    const byLibrary = { ...(currentPrefs.byLibrary ?? {}) };
    const nextLibraryPrefs = {
      ...(byLibrary[selectedLibraryId] ?? {}),
      lastCollectionId: selectedCollectionId,
      lastRevisionView: selectedRevisionView,
      lastTarget: selectedTarget
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
        setStatus(workspaceCopy.status.savePrefsFailed);
      } finally {
        savingRef.current = false;
      }
    };

    void persist();
  }, [
    preferenceDataItemId,
    preferenceRoleId,
    selectedCollectionId,
    selectedLibraryId,
    selectedRevisionView,
    selectedTarget,
    workspaceCopy.status.savePrefsFailed
  ]);

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
      setSelectedTarget('library_overview');
      setSelectedCollectionId(undefined);
      setNewLibraryName('');
    } catch {
      setStatus(copy.cogita.user.libraryCreateFailed);
    }
  };

  const handleCreateCollection = async () => {
    if (!selectedLibraryId) {
      setStatus(workspaceCopy.status.selectLibraryFirst);
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
      setSelectedTarget('collection_revision');
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
        <nav className="cogita-browser-menu" aria-label={workspaceCopy.navigationAria}>
          <div className="cogita-browser-segment">
            <span>{workspaceCopy.layers.library}</span>
            <select
              value={selectedLibraryId ?? ''}
              onChange={(event) => {
                const nextLibrary = event.target.value || undefined;
                setSelectedLibraryId(nextLibrary);
                setSelectedCollectionId(undefined);
              }}
              disabled={loading || libraries.length === 0}
            >
              {libraries.length === 0 ? <option value="">{workspaceCopy.noLibraryOption}</option> : null}
              {libraries.map((library) => (
                <option key={library.libraryId} value={library.libraryId}>
                  {library.name}
                </option>
              ))}
            </select>
          </div>

          <span className="cogita-browser-separator">›</span>

          <div className="cogita-browser-segment">
            <span>{workspaceCopy.layers.target}</span>
            <select
              value={selectedTarget}
              onChange={(event) => setSelectedTarget(event.target.value as CogitaTarget)}
              disabled={!selectedLibraryId}
            >
              {TARGET_OPTIONS.map((target) => (
                <option key={target} value={target}>
                  {targetLabels[target]}
                </option>
              ))}
            </select>
          </div>

          {selectedTarget === 'collection_revision' ? <span className="cogita-browser-separator">›</span> : null}

          {selectedTarget === 'collection_revision' ? (
            <div className="cogita-browser-segment">
              <span>{workspaceCopy.layers.collection}</span>
              <select
                value={selectedCollectionId ?? ''}
                onChange={(event) => setSelectedCollectionId(event.target.value || undefined)}
                disabled={!selectedLibraryId || collectionsLoading || collections.length === 0}
              >
                <option value="">{workspaceCopy.selectCollectionOption}</option>
                {collections.map((collection) => (
                  <option key={collection.collectionId} value={collection.collectionId}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {selectedTarget === 'collection_revision' ? <span className="cogita-browser-separator">›</span> : null}

          {selectedTarget === 'collection_revision' ? (
            <div className="cogita-browser-segment">
              <span>{workspaceCopy.layers.revision}</span>
              <select
                value={selectedRevisionView}
                onChange={(event) => setSelectedRevisionView(event.target.value as RevisionView)}
                disabled={!selectedCollectionId}
              >
                <option value="detail">{workspaceCopy.revisions.detail}</option>
                <option value="graph">{workspaceCopy.revisions.graph}</option>
                <option value="settings">{workspaceCopy.revisions.settings}</option>
                <option value="run">{workspaceCopy.revisions.run}</option>
              </select>
            </div>
          ) : null}

        </nav>

        <div className="cogita-browser-layout">
          <article className="cogita-browser-panel">
            <h2>{workspaceCopy.panels.currentPosition}</h2>
            <p className="cogita-browser-path">
              <strong>{selectedLibrary?.name ?? workspaceCopy.path.noLibrarySelected}</strong>
              <span> / </span>
              <strong>{selectedTargetLabel}</strong>
              <span> / </span>
              <strong>
                {selectedTarget === 'collection_revision'
                  ? `${selectedCollection?.name ?? workspaceCopy.path.noCollectionSelected} (${revisionLabels[selectedRevisionView]})`
                  : workspaceCopy.path.noCollectionLayer}
              </strong>
            </p>
            <p className="cogita-browser-note">
              {workspaceCopy.path.currentRoute}{' '}
              <code>{buildCogitaPath(selectedLibraryId, selectedTarget, selectedCollectionId, selectedRevisionView)}</code>
            </p>

            {selectedLibraryId ? (
              <div className="cogita-browser-links">
                <a className="ghost" href={`/#/cogita/library/${selectedLibraryId}`}>
                  {workspaceCopy.links.libraryOverview}
                </a>
                <a className="ghost" href={`/#/cogita/library/${selectedLibraryId}/list`}>
                  {workspaceCopy.links.allCards}
                </a>
                <a className="ghost" href={`/#/cogita/library/${selectedLibraryId}/shared-revisions`}>
                  {workspaceCopy.links.sharedRevisions}
                </a>
              </div>
            ) : null}
          </article>

          <article className="cogita-browser-panel">
            <h2>{workspaceCopy.panels.quickCreate}</h2>
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
          <h2>{workspaceCopy.panels.collections}</h2>
          {collectionsLoading ? <p className="cogita-library-subtitle">{workspaceCopy.status.loadingCollections}</p> : null}
          {!collectionsLoading && collections.length === 0 ? (
            <p className="cogita-library-subtitle">{workspaceCopy.status.noCollections}</p>
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
                  <div className="cogita-card-type">{workspaceCopy.cards.collectionType}</div>
                  <h3 className="cogita-card-title">{collection.name}</h3>
                  <p className="cogita-card-subtitle">{collection.itemCount} {workspaceCopy.cards.itemsSuffix}</p>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </CogitaShell>
  );
}
