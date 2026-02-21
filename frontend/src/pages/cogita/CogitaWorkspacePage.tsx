import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import '../../styles/cogita.css';
import 'katex/dist/katex.min.css';
import {
  createCogitaCollection,
  createCogitaLibrary,
  createCogitaRevision,
  createDataItem,
  getCogitaCollections,
  getCogitaLibraries,
  getCogitaRevisions,
  getRoleGraph,
  getRoles,
  issueCsrf,
  updateDataItem,
  type CogitaCollectionSummary,
  type CogitaLibrary,
  type CogitaRevision,
  type RoleResponse
} from '../../lib/api';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { CogitaEmbeddedContext, CogitaShell } from './CogitaShell';
import { useLocation, useNavigate } from 'react-router-dom';
import { CogitaLibraryOverviewPage } from './library/CogitaLibraryOverviewPage';
import { CogitaLibraryListPage } from './library/CogitaLibraryListPage';
import { CogitaLibraryAddPage } from './library/CogitaLibraryAddPage';
import { CogitaDependencyGraphPage } from './library/CogitaDependencyGraphPage';
import { CogitaLibrarySharedRevisionsPage } from './library/CogitaLibrarySharedRevisionsPage';
import { CogitaCollectionListPage } from './library/collections/CogitaCollectionListPage';
import { CogitaCollectionCreatePage } from './library/collections/CogitaCollectionCreatePage';
import { CogitaCollectionDetailPage } from './library/collections/CogitaCollectionDetailPage';
import { CogitaRevisionSettingsPage } from './library/collections/CogitaRevisionSettingsPage';
import { CogitaRevisionRunPage } from './library/collections/CogitaRevisionRunPage';
import { CogitaCollectionGraphPage } from './library/collections/CogitaCollectionGraphPage';
import type { CogitaLibraryMode } from './library/types';

type RevisionView = 'detail' | 'graph' | 'settings' | 'run' | 'shared';
type CogitaTarget =
  | 'library_overview'
  | 'all_cards'
  | 'new_card'
  | 'all_collections'
  | 'new_collection'
  | 'dependencies';

type CogitaPreferences = {
  version: 1;
  lastLibraryId?: string;
  byLibrary?: Record<string, { lastCollectionId?: string; lastRevisionId?: string; lastRevisionView?: RevisionView; lastTarget?: CogitaTarget }>;
};

type ParsedCogitaPath = {
  libraryId?: string;
  target?: CogitaTarget;
  collectionId?: string;
  revisionId?: string;
  revisionView?: RevisionView;
  cardMode?: CogitaLibraryMode;
};

const PREFS_ITEM_NAME = 'cogita.preferences';
const TARGET_OPTIONS: CogitaTarget[] = [
  'library_overview',
  'all_cards',
  'new_card',
  'all_collections',
  'new_collection',
  'dependencies'
];
const TARGET_CAPABILITIES: Record<CogitaTarget, { requiresCollection: boolean; allowsRevision: boolean }> = {
  library_overview: { requiresCollection: false, allowsRevision: false },
  all_cards: { requiresCollection: false, allowsRevision: false },
  new_card: { requiresCollection: false, allowsRevision: false },
  all_collections: { requiresCollection: true, allowsRevision: true },
  new_collection: { requiresCollection: false, allowsRevision: false },
  dependencies: { requiresCollection: false, allowsRevision: false }
};
const REVISION_OPTIONS: RevisionView[] = ['detail', 'graph', 'settings', 'run', 'shared'];

function parseCogitaPath(pathname: string, search: string = ''): ParsedCogitaPath {
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

  const searchParams = new URLSearchParams(search);
  const revisionId = searchParams.get('revisionId') ?? undefined;

  if (segments[3] === 'list') {
    return { libraryId, target: 'all_cards', cardMode: 'list', revisionId };
  }

  if (segments[3] === 'detail' || segments[3] === 'collection') {
    return { libraryId, target: 'all_cards', cardMode: segments[3] as CogitaLibraryMode, revisionId };
  }

  if (segments[3] === 'new' || segments[3] === 'add') {
    return { libraryId, target: 'new_card', revisionId };
  }

  if (segments[3] === 'shared-revisions') {
    return { libraryId, target: 'all_collections', revisionId };
  }

  if (segments[3] === 'dependencies') {
    return { libraryId, target: 'dependencies' };
  }

  if (segments[3] !== 'collections') {
    return { libraryId, target: 'library_overview' };
  }

  if (segments[4] === 'new') {
    return { libraryId, target: 'new_collection', revisionId };
  }

  const collectionId = segments[4];
  if (!collectionId) {
    return { libraryId, target: 'all_collections' };
  }

  if (segments[5] === 'graph') {
    return { libraryId, target: 'all_collections', collectionId, revisionId, revisionView: 'graph' };
  }
  if (segments[5] === 'shared-revisions') {
    return { libraryId, target: 'all_collections', collectionId, revisionId, revisionView: 'shared' };
  }

  if (segments[5] === 'revision') {
    return {
      libraryId,
      target: 'all_collections',
      collectionId,
      revisionId,
      revisionView: segments[6] === 'run' ? 'run' : 'settings'
    };
  }

  return { libraryId, target: 'all_collections', collectionId, revisionId, revisionView: 'detail' };
}

function buildCogitaPath(
  libraryId?: string,
  target: CogitaTarget = 'library_overview',
  collectionId?: string,
  revisionView?: RevisionView,
  revisionId?: string
): string {
  const withRevision = (path: string) => (revisionId ? `${path}?revisionId=${encodeURIComponent(revisionId)}` : path);
  if (!libraryId) {
    return '/cogita';
  }
  if (target === 'library_overview') {
    return withRevision(`/cogita/library/${libraryId}`);
  }
  if (target === 'all_cards') {
    return withRevision(`/cogita/library/${libraryId}/list`);
  }
  if (target === 'new_card') {
    return withRevision(`/cogita/library/${libraryId}/add`);
  }
  if (target === 'all_collections') {
    if (!collectionId) {
      return withRevision(`/cogita/library/${libraryId}/collections`);
    }
    if (revisionView === 'graph') {
      return withRevision(`/cogita/library/${libraryId}/collections/${collectionId}/graph`);
    }
    if (revisionView === 'settings') {
      return withRevision(`/cogita/library/${libraryId}/collections/${collectionId}/revision`);
    }
    if (revisionView === 'run') {
      return withRevision(`/cogita/library/${libraryId}/collections/${collectionId}/revision/run`);
    }
    if (revisionView === 'shared') {
      return withRevision(`/cogita/library/${libraryId}/collections/${collectionId}/shared-revisions`);
    }
    return withRevision(`/cogita/library/${libraryId}/collections/${collectionId}`);
  }
  if (target === 'new_collection') {
    return withRevision(`/cogita/library/${libraryId}/collections/new`);
  }
  if (target === 'dependencies') {
    return withRevision(`/cogita/library/${libraryId}/dependencies`);
  }
  return withRevision(`/cogita/library/${libraryId}`);
}

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path;
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
  const pathState = useMemo(() => parseCogitaPath(location.pathname, location.search), [location.pathname, location.search]);
  const workspaceCopy = copy.cogita.workspace;

  const [libraries, setLibraries] = useState<CogitaLibrary[]>([]);
  const [collections, setCollections] = useState<CogitaCollectionSummary[]>([]);
  const [revisions, setRevisions] = useState<CogitaRevision[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | undefined>(undefined);
  const [selectedTarget, setSelectedTarget] = useState<CogitaTarget>('library_overview');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(undefined);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | undefined>(undefined);
  const [selectedRevisionView, setSelectedRevisionView] = useState<RevisionView>('detail');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newRevisionName, setNewRevisionName] = useState('');

  const [preferenceRoleId, setPreferenceRoleId] = useState<string | null>(null);
  const [preferenceDataItemId, setPreferenceDataItemId] = useState<string | null>(null);
  const prefsRef = useRef<CogitaPreferences>({ version: 1, byLibrary: {} });
  const initializedRef = useRef(false);
  const savingRef = useRef(false);
  const lastNavigationRef = useRef<string | null>(null);

  const selectedLibrary = useMemo(
    () => libraries.find((library) => library.libraryId === selectedLibraryId) ?? null,
    [libraries, selectedLibraryId]
  );
  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.collectionId === selectedCollectionId) ?? null,
    [collections, selectedCollectionId]
  );
  const selectedRevision = useMemo(
    () => revisions.find((revision) => revision.revisionId === selectedRevisionId) ?? null,
    [revisions, selectedRevisionId]
  );
  const revisionLabels = useMemo(
    () => ({
      detail: workspaceCopy.revisions.detail,
      graph: workspaceCopy.revisions.graph,
      settings: workspaceCopy.revisions.settings,
      run: workspaceCopy.revisions.run,
      shared: workspaceCopy.targets.sharedRevisions
    }),
    [
      workspaceCopy.revisions.detail,
      workspaceCopy.revisions.graph,
      workspaceCopy.revisions.run,
      workspaceCopy.revisions.settings,
      workspaceCopy.targets.sharedRevisions
    ]
  );
  const revisionOptions = useMemo<Array<{ value: RevisionView; label: string }>>(
    () => REVISION_OPTIONS.map((value) => ({ value, label: revisionLabels[value] })),
    [revisionLabels.detail, revisionLabels.graph, revisionLabels.run, revisionLabels.settings, revisionLabels.shared]
  );
  const targetLabels = useMemo<Record<CogitaTarget, string>>(
    () => ({
      library_overview: workspaceCopy.targets.libraryOverview,
      all_cards: workspaceCopy.targets.allCards,
      new_card: workspaceCopy.targets.newCard,
      all_collections: workspaceCopy.targets.allCollections,
      new_collection: workspaceCopy.targets.newCollection,
      dependencies: workspaceCopy.targets.dependencies
    }),
    [workspaceCopy.targets]
  );
  const selectedTargetLabel = useMemo(
    () => targetLabels[selectedTarget] ?? selectedTarget,
    [selectedTarget, targetLabels]
  );
  const selectedRevisionLabel = revisionLabels[selectedRevisionView];
  const hasLibrarySelection = Boolean(selectedLibraryId);
  const hasCollectionSelection = Boolean(selectedCollectionId);
  const showCollectionLayer = hasLibrarySelection && selectedTarget === 'all_collections';
  const showRevisionLayer = hasCollectionSelection && selectedTarget === 'all_collections';
  const applyNavigationSelection = useCallback(
    (next: {
      libraryId?: string;
      target: CogitaTarget;
      collectionId?: string;
      revisionId?: string;
      revisionView: RevisionView;
    }) => {
      const hasLibrary = Boolean(next.libraryId);
      let resolvedTarget = next.target;
      let resolvedCollectionId = next.collectionId;
      let resolvedRevisionId = next.revisionId;
      let resolvedRevision = next.revisionView;

      if (!hasLibrary) {
        resolvedTarget = 'library_overview';
        resolvedCollectionId = undefined;
        resolvedRevisionId = undefined;
        resolvedRevision = 'detail';
      } else if (TARGET_CAPABILITIES[resolvedTarget].requiresCollection && !resolvedCollectionId) {
        resolvedTarget = 'all_collections';
        resolvedRevisionId = undefined;
        resolvedRevision = 'detail';
      } else if (resolvedTarget !== 'all_collections') {
        resolvedCollectionId = undefined;
        resolvedRevisionId = undefined;
      } else if (!TARGET_CAPABILITIES[resolvedTarget].allowsRevision) {
        resolvedRevision = 'detail';
      }

      setSelectedLibraryId(next.libraryId);
      setSelectedTarget(resolvedTarget);
      setSelectedCollectionId(resolvedCollectionId);
      setSelectedRevisionId(resolvedRevisionId);
      setSelectedRevisionView(resolvedRevision);
      setSidebarOpen(false);

      const nextPath = normalizePath(
        buildCogitaPath(next.libraryId, resolvedTarget, resolvedCollectionId, resolvedRevision, resolvedRevisionId)
      );
      if (normalizePath(`${location.pathname}${location.search}`) === nextPath) return;
      lastNavigationRef.current = nextPath;
      navigate(nextPath);
    },
    [location.pathname, location.search, navigate]
  );
  const setCollectionRevision = (revision: RevisionView) => {
    applyNavigationSelection({
      libraryId: selectedLibraryId,
      target: 'all_collections',
      collectionId: selectedCollectionId,
      revisionId: selectedRevisionId,
      revisionView: revision
    });
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
          const nextLibraryId = value || undefined;
          applyNavigationSelection({
            libraryId: nextLibraryId,
            target: nextLibraryId ? 'library_overview' : 'library_overview',
            collectionId: undefined,
            revisionId: undefined,
            revisionView: 'detail'
          });
        }
      },
      {
        key: 'target',
        label: workspaceCopy.layers.target,
        visible: hasLibrarySelection,
        value: selectedTarget,
        selectedLabel: selectedTargetLabel,
        disabled: !hasLibrarySelection,
        options: TARGET_OPTIONS.map((target) => ({ value: target, label: targetLabels[target] })),
        onSelect: (value: string) => {
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: value as CogitaTarget,
            collectionId: selectedCollectionId,
            revisionId: selectedRevisionId,
            revisionView: selectedRevisionView
          });
        }
      },
      {
        key: 'collection',
        label: workspaceCopy.layers.collection,
        visible: showCollectionLayer,
        value: selectedCollectionId ?? '',
        selectedLabel: selectedCollection?.name ?? workspaceCopy.path.noCollectionSelected,
        disabled: !hasLibrarySelection || collectionsLoading || collections.length === 0,
        options: collections.map((collection) => ({ value: collection.collectionId, label: collection.name })),
        emptyOption: workspaceCopy.selectCollectionOption,
        onSelect: (value: string) => {
          const nextCollectionId = value || undefined;
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: 'all_collections',
            collectionId: nextCollectionId,
            revisionId: undefined,
            revisionView: selectedRevisionView
          });
        }
      },
      {
        key: 'revision_entry',
        label: workspaceCopy.layers.revision,
        visible: hasCollectionSelection,
        value: selectedRevisionId ?? '',
        selectedLabel: selectedRevision?.name ?? workspaceCopy.status.noRevisions,
        disabled: !hasCollectionSelection || revisionsLoading || revisions.length === 0,
        options: revisions.map((revision) => ({ value: revision.revisionId, label: revision.name })),
        emptyOption: workspaceCopy.status.noRevisions,
        onSelect: (value: string) => {
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: 'all_collections',
            collectionId: selectedCollectionId,
            revisionId: value || undefined,
            revisionView: selectedRevisionView
          });
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
      applyNavigationSelection,
      revisions,
      revisionsLoading,
      revisionOptions,
      selectedCollection,
      selectedCollectionId,
      selectedRevision,
      selectedRevisionId,
      hasCollectionSelection,
      hasLibrarySelection,
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
  const sidebarActionLevels = useMemo(
    () => visibleNavigationLevels.filter((level) => level.key !== 'library' && level.key !== 'collection' && level.key !== 'revision_entry'),
    [visibleNavigationLevels]
  );
  const sidebarLibraryActionsLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'target') ?? null,
    [sidebarActionLevels]
  );
  const sidebarCollectionActionsLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'revision') ?? null,
    [sidebarActionLevels]
  );
  const embeddedSubpage = useMemo(() => {
    const libraryId = pathState.libraryId;
    if (!libraryId || !location.pathname.startsWith('/cogita/library/')) {
      return null;
    }

    const baseProps = {
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
      libraryId
    };

    if (pathState.target === 'library_overview') {
      return <CogitaLibraryOverviewPage {...baseProps} />;
    }
    if (pathState.target === 'all_cards') {
      return <CogitaLibraryListPage {...baseProps} mode={pathState.cardMode ?? 'list'} />;
    }
    if (pathState.target === 'new_card') {
      return <CogitaLibraryAddPage {...baseProps} />;
    }
    if (pathState.target === 'dependencies') {
      return <CogitaDependencyGraphPage {...baseProps} />;
    }
    if (pathState.target === 'all_collections') {
      if (pathState.collectionId) {
        const collectionProps = { ...baseProps, collectionId: pathState.collectionId };
        if (pathState.revisionView === 'graph') {
          return <CogitaCollectionGraphPage {...collectionProps} />;
        }
        if (pathState.revisionView === 'shared') {
          return <CogitaLibrarySharedRevisionsPage {...baseProps} collectionId={pathState.collectionId} />;
        }
        if (pathState.revisionView === 'settings') {
          return <CogitaRevisionSettingsPage {...collectionProps} revisionId={pathState.revisionId} />;
        }
        if (pathState.revisionView === 'run') {
          return <CogitaRevisionRunPage {...collectionProps} revisionId={pathState.revisionId} />;
        }
        return <CogitaCollectionDetailPage {...collectionProps} />;
      }
      return <CogitaCollectionListPage {...baseProps} />;
    }
    if (pathState.target === 'new_collection') {
      return (
        <CogitaCollectionCreatePage
          {...baseProps}
          onCreated={(newCollectionId) => navigate(`/cogita/library/${libraryId}/collections/${newCollectionId}/graph`)}
        />
      );
    }
    return null;
  }, [
    authLabel,
    copy,
    language,
    location.pathname,
    navigate,
    onLanguageChange,
    onLogout,
    onNavigate,
    onProfileNavigate,
    onToggleSecureMode,
    pathState.cardMode,
    pathState.collectionId,
    pathState.libraryId,
    pathState.revisionId,
    pathState.revisionView,
    pathState.target,
    secureMode,
    showProfileMenu
  ]);

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
        setSelectedRevisionId(pathState.revisionId ?? (selectedByRule ? prefsRef.current.byLibrary?.[selectedByRule]?.lastRevisionId : undefined));
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

  useLayoutEffect(() => {
    if (!initializedRef.current) return;

    if (pathState.libraryId && libraries.some((library) => library.libraryId === pathState.libraryId)) {
      setSelectedLibraryId(pathState.libraryId);
    }

    if (pathState.target) {
      setSelectedTarget(pathState.target);
    }

    setSelectedCollectionId(pathState.collectionId);
    setSelectedRevisionId(pathState.revisionId);

    if (pathState.revisionView) {
      setSelectedRevisionView(pathState.revisionView);
    }
  }, [libraries, pathState.collectionId, pathState.libraryId, pathState.revisionId, pathState.revisionView, pathState.target]);

  useEffect(() => {
    if (!selectedLibraryId) {
      setCollections([]);
      setSelectedCollectionId(undefined);
      setRevisions([]);
      setSelectedRevisionId(undefined);
      return;
    }

    let cancelled = false;
    setCollectionsLoading(true);

    getCogitaCollections({ libraryId: selectedLibraryId, limit: 200 })
      .then((response) => {
        if (cancelled) return;

        const items = response.items;
        setCollections(items);

        const resolvedCollectionId = items.find((item) => item.collectionId === pathState.collectionId)?.collectionId;

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
    if (!selectedLibraryId || !selectedCollectionId) {
      setRevisions([]);
      setSelectedRevisionId(undefined);
      return;
    }

    let cancelled = false;
    setRevisionsLoading(true);

    getCogitaRevisions({ libraryId: selectedLibraryId, collectionId: selectedCollectionId })
      .then((items) => {
        if (cancelled) return;
        setRevisions(items);
        const preferredRevision = prefsRef.current.byLibrary?.[selectedLibraryId]?.lastRevisionId;
        const resolvedRevisionId =
          items.find((item) => item.revisionId === pathState.revisionId)?.revisionId ??
          items.find((item) => item.revisionId === preferredRevision)?.revisionId;
        setSelectedRevisionId(resolvedRevisionId);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setRevisions([]);
        setSelectedRevisionId(undefined);
      })
      .finally(() => {
        if (!cancelled) {
          setRevisionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathState.revisionId, selectedCollectionId, selectedLibraryId]);

  useEffect(() => {
    if (!initializedRef.current) return;
    if (
      pathState.libraryId &&
      libraries.some((library) => library.libraryId === pathState.libraryId) &&
      pathState.libraryId !== selectedLibraryId
    ) {
      return;
    }
    if (pathState.target && pathState.target !== selectedTarget) {
      return;
    }
    if (pathState.revisionView && pathState.revisionView !== selectedRevisionView) {
      return;
    }
    if (pathState.revisionId && pathState.revisionId !== selectedRevisionId) {
      return;
    }
    if (
      TARGET_CAPABILITIES[selectedTarget].requiresCollection &&
      !selectedCollectionId &&
      pathState.target === 'all_collections' &&
      Boolean(pathState.collectionId)
    ) {
      return;
    }

    const currentPath = normalizePath(`${location.pathname}${location.search}`);
    const nextPath = normalizePath(
      buildCogitaPath(selectedLibraryId, selectedTarget, selectedCollectionId, selectedRevisionView, selectedRevisionId)
    );
    if (currentPath === nextPath) {
      lastNavigationRef.current = null;
      return;
    }
    if (lastNavigationRef.current === nextPath) {
      return;
    }
    lastNavigationRef.current = nextPath;
    navigate(nextPath, { replace: true });
  }, [
    libraries,
    location.pathname,
    navigate,
    pathState.collectionId,
    pathState.libraryId,
    pathState.revisionId,
    pathState.revisionView,
    pathState.target,
    selectedCollectionId,
    selectedLibraryId,
    selectedRevisionId,
    selectedRevisionView,
    selectedTarget
  ]);

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
      lastRevisionId: selectedRevisionId,
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
    selectedRevisionId,
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
      setSelectedRevisionId(undefined);
      setSelectedTarget('all_collections');
      setSelectedRevisionView('detail');
      setNewCollectionName('');
    } catch {
      setStatus(copy.cogita.library.collections.saveFail);
    }
  };

  const handleCreateRevision = async () => {
    if (!selectedLibraryId || !selectedCollectionId) {
      setStatus(workspaceCopy.status.selectLibraryFirst);
      return;
    }
    const name = newRevisionName.trim();
    if (!name) {
      setStatus(workspaceCopy.revisionForm.nameLabel);
      return;
    }
    setStatus(null);
    try {
      const created = await createCogitaRevision({
        libraryId: selectedLibraryId,
        collectionId: selectedCollectionId,
        name,
        revisionType: 'random',
        revisionSettings: null,
        mode: 'random',
        check: 'exact',
        limit: 20
      });
      setRevisions((previous) => [created, ...previous]);
      setSelectedRevisionId(created.revisionId);
      setSelectedTarget('all_collections');
      setSelectedRevisionView('settings');
      setNewRevisionName('');
    } catch {
      setStatus(workspaceCopy.status.loadFailed);
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
            <h2>{selectedLibrary?.name ?? workspaceCopy.path.noLibrarySelected}</h2>
            <p className="cogita-sidebar-note">
              {selectedLibrary ? workspaceCopy.sidebar.libraryActionsHint : workspaceCopy.status.selectLibraryFirst}
            </p>
            {sidebarLibraryActionsLevel ? (
              <div className="cogita-sidebar-actions">
                {sidebarLibraryActionsLevel.options.map((option) => (
                  <button
                    key={`sidebar:target:${option.value}`}
                    type="button"
                    className={`ghost ${String(sidebarLibraryActionsLevel.value) === option.value ? 'active' : ''}`}
                    onClick={() => sidebarLibraryActionsLevel.onSelect(option.value)}
                    disabled={sidebarLibraryActionsLevel.disabled}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {selectedCollection ? (
            <div className="cogita-browser-sidebar-section">
              <h3>{selectedCollection.name}</h3>
              <p className="cogita-sidebar-note">{workspaceCopy.sidebar.collectionActionsHint}</p>
              {sidebarCollectionActionsLevel ? (
                <div className="cogita-sidebar-actions">
                  {sidebarCollectionActionsLevel.options.map((option) => (
                    <button
                      key={`sidebar:revision:${option.value}`}
                      type="button"
                      className={`ghost ${String(sidebarCollectionActionsLevel.value) === option.value ? 'active' : ''}`}
                      onClick={() => sidebarCollectionActionsLevel.onSelect(option.value)}
                      disabled={sidebarCollectionActionsLevel.disabled}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

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
              <select
                aria-label={level.label}
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

          {embeddedSubpage ? (
            <section className="cogita-browser-embedded">
              <CogitaEmbeddedContext.Provider value>
                {embeddedSubpage}
              </CogitaEmbeddedContext.Provider>
            </section>
          ) : null}

          {!embeddedSubpage ? (
            <>
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
                <code>{buildCogitaPath(selectedLibraryId, selectedTarget, selectedCollectionId, selectedRevisionView, selectedRevisionId)}</code>
              </p>

              {selectedLibraryId ? (
                <div className="cogita-browser-links">
                  <a className="ghost" href={`/#/cogita/library/${selectedLibraryId}`}>
                    {workspaceCopy.links.libraryOverview}
                  </a>
                  <a className="ghost" href={`/#/cogita/library/${selectedLibraryId}/list`}>
                    {workspaceCopy.links.allCards}
                  </a>
                  {selectedCollectionId ? (
                    <a className="ghost" href={`/#/cogita/library/${selectedLibraryId}/collections/${selectedCollectionId}/shared-revisions`}>
                      {workspaceCopy.links.sharedRevisions}
                    </a>
                  ) : null}
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

              <label className="cogita-field full">
                <span>{workspaceCopy.revisionForm.nameLabel}</span>
                <input
                  type="text"
                  value={newRevisionName}
                  onChange={(event) => setNewRevisionName(event.target.value)}
                  placeholder={workspaceCopy.revisionForm.namePlaceholder}
                  disabled={!selectedCollectionId}
                />
              </label>
              <button type="button" className="cta" onClick={handleCreateRevision} disabled={!selectedCollectionId}>
                {workspaceCopy.revisionForm.createAction}
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
                          setSelectedRevisionId(undefined);
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
            </>
          ) : null}
        </div>
      </section>
    </CogitaShell>
  );
}
