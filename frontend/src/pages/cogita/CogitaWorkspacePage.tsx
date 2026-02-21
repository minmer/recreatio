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
const TARGET_CAPABILITIES: Record<CogitaTarget, { requiresCollection: boolean; allowsRevision: boolean }> = {
  library_overview: { requiresCollection: false, allowsRevision: false },
  all_cards: { requiresCollection: false, allowsRevision: false },
  new_card: { requiresCollection: false, allowsRevision: false },
  all_collections: { requiresCollection: false, allowsRevision: false },
  new_collection: { requiresCollection: false, allowsRevision: false },
  collection_revision: { requiresCollection: true, allowsRevision: true },
  shared_revisions: { requiresCollection: false, allowsRevision: false },
  dependencies: { requiresCollection: false, allowsRevision: false }
};
const REVISION_OPTIONS: RevisionView[] = ['detail', 'graph', 'settings', 'run'];

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const revisionOptions = useMemo<Array<{ value: RevisionView; label: string }>>(
    () => REVISION_OPTIONS.map((value) => ({ value, label: revisionLabels[value] })),
    [revisionLabels.detail, revisionLabels.graph, revisionLabels.run, revisionLabels.settings]
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
  const selectedRevisionLabel = revisionLabels[selectedRevisionView];
  const selectedTargetCapability = TARGET_CAPABILITIES[selectedTarget];
  const showCollectionLayer = selectedTargetCapability.requiresCollection;
  const showRevisionLayer = selectedTargetCapability.allowsRevision;
  const setCollectionRevision = (revision: RevisionView) => {
    setSelectedTarget('collection_revision');
    setSelectedRevisionView(revision);
    setSidebarOpen(false);
  };
  const navigationLevels = useMemo(
    () => [
      {
        key: 'library',
        label: workspaceCopy.layers.library,
        visible: true,
        value: selectedLibraryId ?? '',
        selectedLabel: selectedLibrary?.name ?? workspaceCopy.path.noLibrarySelected,
        disabled: loading || libraries.length === 0,
        options: libraries.map((library) => ({ value: library.libraryId, label: library.name })),
        emptyOption: workspaceCopy.noLibraryOption,
        onSelect: (value: string) => {
          setSelectedLibraryId(value || undefined);
          setSelectedCollectionId(undefined);
          setSidebarOpen(false);
        }
      },
      {
        key: 'target',
        label: workspaceCopy.layers.target,
        visible: true,
        value: selectedTarget,
        selectedLabel: selectedTargetLabel,
        disabled: !selectedLibraryId,
        options: TARGET_OPTIONS.map((target) => ({ value: target, label: targetLabels[target] })),
        onSelect: (value: string) => {
          setSelectedTarget(value as CogitaTarget);
          setSidebarOpen(false);
        }
      },
      {
        key: 'collection',
        label: workspaceCopy.layers.collection,
        visible: showCollectionLayer,
        value: selectedCollectionId ?? '',
        selectedLabel: selectedCollection?.name ?? workspaceCopy.path.noCollectionSelected,
        disabled: !selectedLibraryId || collectionsLoading || collections.length === 0,
        options: collections.map((collection) => ({ value: collection.collectionId, label: collection.name })),
        emptyOption: workspaceCopy.selectCollectionOption,
        onSelect: (value: string) => {
          setSelectedCollectionId(value || undefined);
          setSidebarOpen(false);
        }
      },
      {
        key: 'revision',
        label: workspaceCopy.layers.revision,
        visible: showRevisionLayer,
        value: selectedRevisionView,
        selectedLabel: selectedRevisionLabel,
        disabled: !selectedCollectionId,
        options: revisionOptions.map((option) => ({ value: option.value, label: option.label })),
        onSelect: (value: string) => {
          setCollectionRevision(value as RevisionView);
        }
      }
    ],
    [
      collections,
      collectionsLoading,
      libraries,
      loading,
      revisionOptions,
      selectedCollection,
      selectedCollectionId,
      selectedLibrary,
      selectedLibraryId,
      selectedRevisionLabel,
      selectedRevisionView,
      selectedTarget,
      selectedTargetLabel,
      showCollectionLayer,
      showRevisionLayer,
      targetLabels,
      workspaceCopy.layers.collection,
      workspaceCopy.layers.library,
      workspaceCopy.layers.revision,
      workspaceCopy.layers.target,
      workspaceCopy.noLibraryOption,
      workspaceCopy.path.noCollectionSelected,
      workspaceCopy.path.noLibrarySelected,
      workspaceCopy.selectCollectionOption
    ]
  );
  const visibleNavigationLevels = useMemo(
    () => navigationLevels.filter((level) => level.visible),
    [navigationLevels]
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
    if (typeof window === 'undefined') return;
    const onResize = () => {
      if (window.innerWidth > 920) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
      <section className="cogita-browser-shell">
        <aside className={`cogita-browser-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label={workspaceCopy.sidebar.title}>
          <div className="cogita-browser-sidebar-section">
            <h2>{workspaceCopy.sidebar.title}</h2>
          </div>

          <div className="cogita-browser-sidebar-section">
            <h3>{workspaceCopy.sidebar.currentPath}</h3>
            <ul className="cogita-browser-tree">
              {visibleNavigationLevels.map((level, index) => (
                <li key={level.key} className={index > 1 ? 'tree-child' : ''}>
                  <span>{level.label}</span>
                  <strong>{level.selectedLabel}</strong>
                </li>
              ))}
            </ul>
          </div>

          <div className="cogita-browser-sidebar-section">
            <h3>{workspaceCopy.sidebar.explore}</h3>
            {visibleNavigationLevels.map((level) => (
              <div key={level.key} className="cogita-sidebar-level">
                <strong>{level.label}</strong>
                <div className="cogita-sidebar-actions">
                  {level.options.map((option) => (
                    <button
                      key={`${level.key}:${option.value}`}
                      type="button"
                      className={`ghost ${String(level.value) === option.value ? 'active' : ''}`}
                      onClick={() => level.onSelect(option.value)}
                      disabled={level.disabled}
                    >
                      {option.label}
                    </button>
                  ))}
                  {level.options.length === 0 ? (
                    <p className="cogita-sidebar-note">
                      {level.key === 'library'
                        ? workspaceCopy.noLibraryOption
                        : level.key === 'collection'
                          ? workspaceCopy.status.noCollections
                          : workspaceCopy.sidebar.contextEmpty}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="cogita-browser-sidebar-section">
            <h3>{workspaceCopy.sidebar.alwaysAvailable}</h3>
            <div className="cogita-sidebar-actions">
              <button type="button" className="ghost" onClick={onProfileNavigate}>
                {workspaceCopy.sidebar.accountSettings}
              </button>
              <button type="button" className="ghost" onClick={() => {
                onNavigate('cogita');
                setSidebarOpen(false);
              }}>
                {workspaceCopy.sidebar.cogitaHome}
              </button>
              <button type="button" className="ghost" onClick={onToggleSecureMode}>
                {secureMode ? copy.account.secureModeDisable : copy.account.secureModeEnable}
              </button>
            </div>
          </div>
        </aside>
        {sidebarOpen ? <button type="button" className="cogita-sidebar-backdrop" aria-label={workspaceCopy.sidebar.closeMenu} onClick={() => setSidebarOpen(false)} /> : null}

        <div className="cogita-browser-page">
          <nav className="cogita-browser-menu" aria-label={workspaceCopy.navigationAria}>
          <button
            type="button"
            className="ghost cogita-sidebar-toggle"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? workspaceCopy.sidebar.closeMenu : workspaceCopy.sidebar.openMenu}
          >
            <span className="cogita-sidebar-toggle-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
          {visibleNavigationLevels.map((level, index) => (
            <div key={`menu:${level.key}`} className="cogita-browser-segment">
              {index > 0 ? <span className="cogita-browser-separator">›</span> : null}
              <span>{level.label}</span>
              <select
                value={level.value}
                onChange={(event) => level.onSelect(event.target.value)}
                disabled={level.disabled}
              >
                {level.emptyOption ? <option value="">{level.emptyOption}</option> : null}
                {level.options.map((option) => (
                  <option key={`${level.key}:${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          </nav>

          <div className="cogita-browser-layout">
            <article className="cogita-browser-panel">
              <h2>{workspaceCopy.panels.currentPosition}</h2>
              <p className="cogita-browser-path">
                {visibleNavigationLevels.map((level, index) => (
                  <span key={`path:${level.key}`}>
                    {index > 0 ? <span> / </span> : null}
                    <strong>{level.selectedLabel}</strong>
                  </span>
                ))}
                {!showCollectionLayer ? (
                  <span>
                    <span> / </span>
                    <strong>{workspaceCopy.path.noCollectionLayer}</strong>
                  </span>
                ) : null}
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
        </div>
      </section>
    </CogitaShell>
  );
}
