import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import '../../styles/cogita.css';
import 'katex/dist/katex.min.css';
import {
  createCogitaCollection,
  createCogitaLibrary,
  createCogitaRevision,
  createDataItem,
  getCogitaCollections,
  getCogitaInfoDetail,
  getCogitaLibraries,
  getCogitaReviewers,
  getCogitaRevisions,
  getRoleGraph,
  getRoles,
  issueCsrf,
  searchCogitaInfos,
  updateDataItem,
  type CogitaCollectionSummary,
  type CogitaInfoSearchResult,
  type CogitaLibrary,
  type CogitaReviewer,
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
import { CogitaInfoCheckcardsPage } from './library/CogitaInfoCheckcardsPage';
import { CogitaPersonsPage } from './CogitaPersonsPage';
import { CogitaLibrarySharedRevisionsPage } from './library/CogitaLibrarySharedRevisionsPage';
import { CogitaLibraryTransferPage } from './library/CogitaLibraryTransferPage';
import { CogitaLibraryStoryboardsPage } from './library/CogitaLibraryStoryboardsPage';
import { CogitaLibraryTextsPage } from './library/CogitaLibraryTextsPage';
import { CogitaCollectionListPage } from './library/collections/CogitaCollectionListPage';
import { CogitaCollectionDetailPage } from './library/collections/CogitaCollectionDetailPage';
import { CogitaCollectionCreatePage } from './library/collections/CogitaCollectionCreatePage';
import { CogitaRevisionSettingsPage } from './library/collections/CogitaRevisionSettingsPage';
import { CogitaRevisionRunPage } from './library/collections/CogitaRevisionRunPage';
import { CogitaCollectionGraphPage } from './library/collections/CogitaCollectionGraphPage';
import type { CogitaLibraryMode } from './library/types';

type RevisionView = 'detail' | 'graph' | 'settings' | 'run' | 'shared' | 'new';
type CogitaTarget =
  | 'library_overview'
  | 'all_cards'
  | 'new_card'
  | 'all_collections'
  | 'all_revisions'
  | 'new_collection'
  | 'transfer'
  | 'storyboards'
  | 'new_storyboard'
  | 'texts'
  | 'new_text'
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
  infoId?: string;
  infoView?: 'overview' | 'cards' | 'collections';
  collectionView?: 'overview' | 'infos';
  libraryAction?: 'new-info';
  collectionAction?: 'new-revision' | 'new-collection';
};

type NavigationOption = {
  value: string;
  label: string;
};

type NavigationLevel = {
  key: string;
  label: string;
  visible: boolean;
  value: string;
  selectedLabel: string;
  disabled: boolean;
  options: NavigationOption[];
  emptyOption?: string;
  onSelect: (value: string) => void;
};

type InfoMode = 'search' | 'create' | 'selected';
type CollectionMode = 'search' | 'create' | 'selected';
type TutorialSlide = { step: string; title: string; lead: string; passages: string[]; focus: string[]; action: string };

const PREFS_ITEM_NAME = 'cogita.preferences';
const REVIEWER_PREFS_ITEM_NAME = 'cogita.reviewer.preferences';
const TARGET_OPTIONS: CogitaTarget[] = [
  'library_overview',
  'all_cards',
  'all_collections',
  'all_revisions',
  'storyboards',
  'texts',
  'dependencies',
  'transfer'
];
const TARGET_CAPABILITIES: Record<CogitaTarget, { requiresCollection: boolean; allowsRevision: boolean }> = {
  library_overview: { requiresCollection: false, allowsRevision: false },
  all_cards: { requiresCollection: false, allowsRevision: false },
  new_card: { requiresCollection: false, allowsRevision: false },
  all_collections: { requiresCollection: true, allowsRevision: true },
  all_revisions: { requiresCollection: true, allowsRevision: true },
  new_collection: { requiresCollection: false, allowsRevision: false },
  transfer: { requiresCollection: false, allowsRevision: false },
  storyboards: { requiresCollection: false, allowsRevision: false },
  new_storyboard: { requiresCollection: false, allowsRevision: false },
  texts: { requiresCollection: false, allowsRevision: false },
  new_text: { requiresCollection: false, allowsRevision: false },
  dependencies: { requiresCollection: false, allowsRevision: false }
};
const REVISION_SELECTION_VIEWS: RevisionView[] = ['settings', 'run', 'shared'];

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
  const infoId = searchParams.get('infoId') ?? undefined;
  const rawInfoView = searchParams.get('infoView');
  const infoView = (rawInfoView === 'cards' ? 'cards' : rawInfoView === 'collections' ? 'collections' : 'overview') as
    | 'overview'
    | 'cards'
    | 'collections';
  const collectionView = (searchParams.get('collectionView') === 'overview' ? 'overview' : 'infos') as 'overview' | 'infos';
  const collectionAction = searchParams.get('collectionAction');
  const libraryAction = searchParams.get('libraryAction');
  const libraryTarget = searchParams.get('libraryTarget');
  const collectionBaseTarget: CogitaTarget = libraryTarget === 'revisions' ? 'all_revisions' : 'all_collections';

  if (segments[3] === 'list') {
    return {
      libraryId,
      target: libraryAction === 'new-info' ? 'new_card' : 'all_cards',
      cardMode: 'list',
      revisionId,
      infoId,
      infoView,
      libraryAction: libraryAction === 'new-info' ? 'new-info' : undefined
    };
  }

  if (segments[3] === 'detail' || segments[3] === 'collection') {
    return { libraryId, target: 'all_cards', cardMode: segments[3] as CogitaLibraryMode, revisionId, infoId, infoView };
  }

  if (segments[3] === 'new' || segments[3] === 'add') {
    return { libraryId, target: 'new_card', revisionId, libraryAction: 'new-info' };
  }

  if (segments[3] === 'edit') {
    return { libraryId, target: 'new_card', revisionId, infoId: segments[4] };
  }

  if (segments[3] === 'infos') {
    const infoIdFromPath = segments[4];
    if (!infoIdFromPath) {
      return { libraryId, target: 'all_cards', cardMode: 'list', revisionId };
    }
    if (segments[5] === 'checkcards') {
      return { libraryId, target: 'all_cards', cardMode: 'list', revisionId, infoId: infoIdFromPath, infoView: 'cards' };
    }
    if (segments[5] === 'collections') {
      return { libraryId, target: 'all_cards', cardMode: 'list', revisionId, infoId: infoIdFromPath, infoView: 'collections' };
    }
    return { libraryId, target: 'all_cards', cardMode: 'list', revisionId, infoId: infoIdFromPath, infoView: 'overview' };
  }

  if (segments[3] === 'shared-revisions') {
    return { libraryId, target: collectionBaseTarget, revisionId };
  }

  if (segments[3] === 'revision' && segments[4] === 'run') {
    return { libraryId, target: collectionBaseTarget, revisionView: 'run', revisionId, infoId, infoView };
  }

  if (segments[3] === 'dependencies') {
    return { libraryId, target: 'dependencies' };
  }

  if (segments[3] === 'transfer') {
    return { libraryId, target: 'transfer' };
  }

  if (segments[3] === 'storyboards') {
    if (segments[4] === 'new') {
      return { libraryId, target: 'new_storyboard' };
    }
    return { libraryId, target: 'storyboards' };
  }

  if (segments[3] === 'texts') {
    if (segments[4] === 'new') {
      return { libraryId, target: 'new_text' };
    }
    return { libraryId, target: 'texts' };
  }

  if (segments[3] !== 'collections') {
    return { libraryId, target: 'library_overview' };
  }

  if (segments[4] === 'new') {
    return { libraryId, target: 'new_collection', revisionId };
  }

  const collectionId = segments[4];
  if (!collectionId) {
    if (collectionAction === 'new-collection') {
      return { libraryId, target: 'new_collection', collectionAction: 'new-collection' };
    }
    return { libraryId, target: collectionBaseTarget };
  }

  if (segments[5] === 'graph') {
    return { libraryId, target: collectionBaseTarget, collectionId, revisionId, revisionView: 'graph' };
  }
  if (segments[5] === 'shared-revisions') {
    return { libraryId, target: collectionBaseTarget, collectionId, revisionId, revisionView: 'shared' };
  }

  if (segments[5] === 'revision') {
    return {
      libraryId,
      target: collectionBaseTarget,
      collectionId,
      revisionId,
      revisionView: segments[6] === 'run' ? 'run' : 'settings',
      collectionView
    };
  }

  if (collectionAction === 'new-revision') {
    return { libraryId, target: collectionBaseTarget, collectionId, revisionId, revisionView: 'new' };
  }

    return { libraryId, target: collectionBaseTarget, collectionId, revisionId, revisionView: 'detail', collectionView };
}

function buildCogitaPath(
  libraryId?: string,
  target: CogitaTarget = 'library_overview',
  collectionId?: string,
  revisionView?: RevisionView,
  revisionId?: string,
  infoId?: string,
  infoView: 'overview' | 'cards' | 'collections' = 'overview',
  collectionView: 'overview' | 'infos' = 'infos'
): string {
  const withQuery = (
    path: string,
    query?: {
      revisionId?: string;
      collectionAction?: 'new-revision' | 'new-collection';
      libraryAction?: 'new-info';
      libraryTarget?: 'revisions';
      infoId?: string;
      infoView?: 'overview' | 'cards' | 'collections';
      collectionView?: 'overview' | 'infos';
    }
  ) => {
    const params = new URLSearchParams();
    if (query?.revisionId) {
      params.set('revisionId', query.revisionId);
    }
    if (query?.collectionAction) {
      params.set('collectionAction', query.collectionAction);
    }
    if (query?.libraryAction) {
      params.set('libraryAction', query.libraryAction);
    }
    if (query?.libraryTarget) {
      params.set('libraryTarget', query.libraryTarget);
    }
    if (query?.infoId) {
      params.set('infoId', query.infoId);
    }
    if (query?.infoView && query?.infoId) {
      params.set('infoView', query.infoView);
    }
    if (query?.collectionView && query.collectionView !== 'infos') {
      params.set('collectionView', query.collectionView);
    }
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  };
  if (!libraryId) {
    return '/cogita';
  }
  if (target === 'library_overview') {
    return withQuery(`/cogita/library/${libraryId}`, { revisionId });
  }
  if (target === 'all_cards') {
    if (infoId) {
      if (infoView === 'cards') {
        return withQuery(`/cogita/library/${libraryId}/infos/${infoId}/checkcards`, { revisionId });
      }
      if (infoView === 'collections') {
        return withQuery(`/cogita/library/${libraryId}/infos/${infoId}/collections`, { revisionId });
      }
      return withQuery(`/cogita/library/${libraryId}/infos/${infoId}`, { revisionId });
    }
    return withQuery(`/cogita/library/${libraryId}/list`, { revisionId, infoId, infoView });
  }
  if (target === 'new_card') {
    if (infoId) {
      return withQuery(`/cogita/library/${libraryId}/edit/${infoId}`, { revisionId });
    }
    return withQuery(`/cogita/library/${libraryId}/list`, { revisionId, libraryAction: 'new-info' });
  }
  if (target === 'all_collections' || target === 'all_revisions') {
    const libraryTarget = target === 'all_revisions' ? 'revisions' : undefined;
    if (!collectionId && revisionView === 'run') {
      return withQuery(`/cogita/library/${libraryId}/revision/run`, { revisionId, libraryTarget });
    }
    if (!collectionId) {
      return withQuery(`/cogita/library/${libraryId}/collections`, { revisionId, libraryTarget });
    }
    if (revisionView === 'graph') {
      return withQuery(`/cogita/library/${libraryId}/collections/${collectionId}/graph`, { revisionId, libraryTarget });
    }
    if (revisionView === 'settings') {
      return withQuery(`/cogita/library/${libraryId}/collections/${collectionId}/revision`, { revisionId, libraryTarget });
    }
    if (revisionView === 'run') {
      return withQuery(`/cogita/library/${libraryId}/collections/${collectionId}/revision/run`, { revisionId, libraryTarget });
    }
    if (revisionView === 'shared') {
      return withQuery(`/cogita/library/${libraryId}/collections/${collectionId}/shared-revisions`, { revisionId, libraryTarget });
    }
    if (revisionView === 'new') {
      return withQuery(`/cogita/library/${libraryId}/collections/${collectionId}`, {
        revisionId,
        libraryTarget,
        collectionAction: 'new-revision'
      });
    }
      return withQuery(`/cogita/library/${libraryId}/collections/${collectionId}`, { revisionId, libraryTarget, collectionView });
  }
  if (target === 'new_collection') {
    return withQuery(`/cogita/library/${libraryId}/collections`, { revisionId, collectionAction: 'new-collection' });
  }
  if (target === 'transfer') {
    return withQuery(`/cogita/library/${libraryId}/transfer`, { revisionId });
  }
  if (target === 'storyboards') {
    return withQuery(`/cogita/library/${libraryId}/storyboards`, { revisionId });
  }
  if (target === 'new_storyboard') {
    return withQuery(`/cogita/library/${libraryId}/storyboards/new`, { revisionId });
  }
  if (target === 'texts') {
    return withQuery(`/cogita/library/${libraryId}/texts`, { revisionId });
  }
  if (target === 'new_text') {
    return withQuery(`/cogita/library/${libraryId}/texts/new`, { revisionId });
  }
  if (target === 'dependencies') {
    return withQuery(`/cogita/library/${libraryId}/dependencies`, { revisionId });
  }
  return withQuery(`/cogita/library/${libraryId}`, { revisionId });
}

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path;
}

function isCogitaTarget(value: unknown): value is CogitaTarget {
  return typeof value === 'string' && (TARGET_OPTIONS as string[]).includes(value);
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
  const [infos, setInfos] = useState<CogitaInfoSearchResult[]>([]);
  const [revisions, setRevisions] = useState<CogitaRevision[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | undefined>(undefined);
  const [selectedTarget, setSelectedTarget] = useState<CogitaTarget>('library_overview');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(undefined);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | undefined>(undefined);
  const [selectedRevisionView, setSelectedRevisionView] = useState<RevisionView>('detail');
  const [selectedInfoLabel, setSelectedInfoLabel] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newRevisionName, setNewRevisionName] = useState('');
  const [headerReviewers, setHeaderReviewers] = useState<CogitaReviewer[]>([]);
  const [selectedReviewerRoleId, setSelectedReviewerRoleId] = useState('');
  const [reviewersReloadTick, setReviewersReloadTick] = useState(0);

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

  const isPersonsPage = normalizePath(location.pathname) === '/cogita/persons';

  useEffect(() => {
    if (!selectedLibraryId) {
      setHeaderReviewers([]);
      setSelectedReviewerRoleId('');
      return;
    }
    let cancelled = false;
    getCogitaReviewers({ libraryId: selectedLibraryId })
      .then((items) => {
        if (cancelled) return;
        const personReviewers = items.filter((item) => (item.roleKind ?? '').trim().toLowerCase() === 'person');
        setHeaderReviewers(personReviewers);
        try {
          const raw = window.localStorage.getItem(REVIEWER_PREFS_ITEM_NAME);
          const prefs = raw ? (JSON.parse(raw) as Record<string, string>) : {};
          const saved = prefs[selectedLibraryId] ?? '';
          const next = saved && personReviewers.some((item) => item.roleId === saved) ? saved : '';
          setSelectedReviewerRoleId(next);
        } catch {
          setSelectedReviewerRoleId('');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setHeaderReviewers([]);
        setSelectedReviewerRoleId('');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLibraryId, reviewersReloadTick]);

  useEffect(() => {
    if (!selectedLibraryId) return;
    try {
      const raw = window.localStorage.getItem(REVIEWER_PREFS_ITEM_NAME);
      const prefs = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      if (selectedReviewerRoleId) {
        prefs[selectedLibraryId] = selectedReviewerRoleId;
      } else {
        delete prefs[selectedLibraryId];
      }
      window.localStorage.setItem(REVIEWER_PREFS_ITEM_NAME, JSON.stringify(prefs));
    } catch {
      // ignore local preference persistence failures
    }
  }, [selectedLibraryId, selectedReviewerRoleId]);
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
      shared: workspaceCopy.targets.sharedRevisions,
      new: workspaceCopy.revisionForm.createAction
    }),
    [
      workspaceCopy.revisions.detail,
      workspaceCopy.revisions.graph,
      workspaceCopy.revisions.run,
      workspaceCopy.revisions.settings,
      workspaceCopy.targets.sharedRevisions,
      workspaceCopy.revisionForm.createAction
    ]
  );
  const displayTarget = useMemo<CogitaTarget>(() => {
    if (selectedTarget === 'new_card') return 'all_cards';
    if (selectedTarget === 'new_collection') return 'all_collections';
    if (selectedTarget === 'new_storyboard') return 'storyboards';
    if (selectedTarget === 'new_text') return 'texts';
    return selectedTarget;
  }, [selectedTarget]);
  const displayRevisionView = useMemo<RevisionView>(() => (selectedRevisionView === 'new' ? 'settings' : selectedRevisionView), [selectedRevisionView]);
  const isCollectionNavigationTarget = selectedTarget === 'all_collections' || selectedTarget === 'all_revisions';
  const collectionMode = useMemo<CollectionMode>(() => {
    if (selectedTarget === 'new_collection') return 'create';
    if (isCollectionNavigationTarget && selectedCollectionId) return 'selected';
    return 'search';
  }, [isCollectionNavigationTarget, selectedCollectionId, selectedTarget]);
  const infoMode = useMemo<InfoMode>(() => {
    if (pathState.infoId) return 'selected';
    if (selectedTarget === 'new_card') return 'create';
    return 'search';
  }, [pathState.infoId, selectedTarget]);
  const selectedInfoOption = useMemo(
    () => infos.find((item) => item.infoId === pathState.infoId) ?? null,
    [infos, pathState.infoId]
  );
  const targetLabels = useMemo<Record<CogitaTarget, string>>(
    () => ({
      library_overview: workspaceCopy.targets.libraryOverview,
      all_cards: workspaceCopy.targets.allCards,
      new_card: workspaceCopy.targets.newCard,
      all_collections: workspaceCopy.targets.allCollections,
      all_revisions: workspaceCopy.targets.allRevisions,
      new_collection: workspaceCopy.targets.newCollection,
      transfer: workspaceCopy.targets.transfer,
      storyboards: workspaceCopy.targets.storyboards,
      new_storyboard: workspaceCopy.targets.newStoryboard,
      texts: workspaceCopy.targets.texts,
      new_text: workspaceCopy.targets.newText,
      dependencies: workspaceCopy.targets.dependencies
    }),
    [workspaceCopy.targets]
  );
  const selectedTargetLabel = useMemo(
    () => targetLabels[displayTarget] ?? displayTarget,
    [displayTarget, targetLabels]
  );
  const selectedRevisionLabel = revisionLabels[displayRevisionView];
  const hasLibrarySelection = Boolean(selectedLibraryId);
  const tutorialSlides = useMemo<TutorialSlide[]>(() => {
    const quickStart =
      language === 'pl'
        ? 'Ruch na teraz: utwórz bibliotekę i wpisz pierwszy element wiedzy.'
        : language === 'de'
          ? 'Nächster Schritt: Erstelle eine Bibliothek und füge den ersten Wissenseintrag hinzu.'
          : 'Next action: create one library and add your first knowledge item.';

    if (language === 'pl') {
      return [
        { step: 'Krok 1', title: 'Czym jest Cogita?', lead: 'To centrum budowania i prowadzenia procesu nauki po zalogowaniu.', passages: ['W jednym miejscu łączysz treści, ćwiczenia i współpracę zespołu.', 'Zamiast luźnych notatek dostajesz spójny przepływ: biblioteka → kolekcja → powtórka.'], focus: ['Jedna przestrzeń robocza', 'Spójny proces'], action: quickStart },
        { step: 'Krok 2', title: 'Zacznij od biblioteki', lead: 'Biblioteka jest bazą dla całego tematu.', passages: ['Nazwij bibliotekę jasno: np. „Historia Kościoła – semestr 1”.', 'Każdy kolejny moduł korzysta z tej samej biblioteki jako źródła.'], focus: ['Nazwa tematyczna', 'Jeden punkt startowy'], action: quickStart },
        { step: 'Krok 3', title: 'Dodawaj informacje', lead: 'Twórz krótkie, konkretne jednostki wiedzy.', passages: ['Wpisy typu info opisują pojęcia, osoby, źródła i cytaty.', 'Małe jednostki łatwiej łączyć, powtarzać i aktualizować.'], focus: ['Krótko i konkretnie', 'Łatwe aktualizacje'], action: quickStart },
        { step: 'Krok 4', title: 'Pracuj na typach', lead: 'Formularze dostosowują się do rodzaju informacji.', passages: ['Każdy typ pokazuje właściwe pola i porządkuje dane.', 'To zmniejsza chaos i poprawia jakość wyszukiwania.'], focus: ['Lepsza struktura', 'Mniej błędów'], action: quickStart },
        { step: 'Krok 5', title: 'Łącz wiedzę linkami', lead: 'Buduj kontekst przez relacje między wpisami.', passages: ['Połącz temat z definicją, źródłem i przykładem.', 'Graf relacji pomaga zobaczyć, czego brakuje przed kolejnym etapem.'], focus: ['Relacje między wpisami', 'Pełniejszy kontekst'], action: quickStart },
        { step: 'Krok 6', title: 'Twórz kolekcje celu', lead: 'Kolekcja grupuje wpisy pod konkretny scenariusz.', passages: ['Osobna kolekcja dla lekcji, osobna dla quizu lub egzaminu.', 'Nie duplikujesz treści — tylko wybierasz, co jest potrzebne.'], focus: ['Celowe grupowanie', 'Bez duplikatów'], action: quickStart },
        { step: 'Krok 7', title: 'Dodawaj powtórki', lead: 'Powtórka definiuje jak przebiega sprawdzanie.', passages: ['Ustaw tempo, kolejność i zakres materiału.', 'Dla jednej kolekcji możesz mieć kilka powtórek o różnych poziomach.'], focus: ['Kontrola tempa', 'Różne poziomy'], action: quickStart },
        { step: 'Krok 8', title: 'Info vs karta', lead: 'Rozróżniaj źródło wiedzy i widok ćwiczeniowy.', passages: ['Info to rekord bazowy, który przechowuje treść.', 'Karta to forma pytania/utrwalenia generowana z info.'], focus: ['Źródło danych', 'Widok ćwiczeń'], action: quickStart },
        { step: 'Krok 9', title: 'Uruchamiaj sesję', lead: 'Tryb Run prowadzi uczestników krok po kroku.', passages: ['Prowadzący kontroluje rytm i przejścia między etapami.', 'Uczestnicy mają jasny przebieg bez zgadywania, co dalej.'], focus: ['Płynny przebieg', 'Lepsza dynamika grupy'], action: quickStart },
        { step: 'Krok 10', title: 'Czytaj graf zależności', lead: 'Graf pokazuje priorytety nauki.', passages: ['Węzły centralne oznaczają tematy, które wpływają na wiele innych.', 'Najpierw utrwal fundamenty, potem przechodź do warstw zaawansowanych.'], focus: ['Priorytety materiału', 'Lepsza kolejność'], action: quickStart },
        { step: 'Krok 11', title: 'Storyboard i teksty', lead: 'Plan i notatki trzymaj blisko wiedzy źródłowej.', passages: ['Storyboard układa narrację i przebieg spotkania.', 'Teksty zbierają komentarze, wnioski i gotowe treści do publikacji.'], focus: ['Lepsze przygotowanie', 'Notatki w kontekście'], action: quickStart },
        { step: 'Krok 12', title: 'Udostępniaj bezpiecznie', lead: 'Dziel się materiałem bez utraty kontroli.', passages: ['Możesz dać dostęp tylko do odczytu dla wybranych osób.', 'Edycja pozostaje po stronie autora lub zespołu prowadzącego.'], focus: ['Kontrola uprawnień', 'Bezpieczne współdzielenie'], action: quickStart },
        { step: 'Krok 13', title: 'Nawiguj warstwowo', lead: 'Sidebar i breadcrumb prowadzą przez poziomy.', passages: ['Zawsze widzisz, czy pracujesz na bibliotece, kolekcji czy powtórce.', 'Mniej kliknięć „w ciemno”, więcej świadomej nawigacji.'], focus: ['Orientacja w systemie', 'Szybsze decyzje'], action: quickStart },
        { step: 'Krok 14', title: 'Plan wdrożenia 30 minut', lead: 'Najpierw prosty pilot, potem rozwijaj.', passages: ['Plan: 1 biblioteka, 10 wpisów info, 1 kolekcja, 1 powtórka testowa.', 'Po pierwszej sesji popraw strukturę i dodaj kolejne scenariusze.'], focus: ['Szybki start', 'Iteracyjne doskonalenie'], action: 'Gotowe? Załóż bibliotekę po prawej i przejdź do pierwszego wpisu.' }
      ];
    }

    if (language === 'de') {
      return [
        { step: 'Schritt 1', title: 'Was ist Cogita?', lead: 'Ein zentraler Workspace für Lernen und Moderation nach dem Login.', passages: ['Du verbindest Inhalte, Übungen und Teamarbeit in einem Ablauf.', 'Der Prozess bleibt klar: Bibliothek → Sammlung → Wiederholung.'], focus: ['Ein Workspace', 'Klarer Ablauf'], action: quickStart },
        { step: 'Schritt 2', title: 'Mit Bibliothek starten', lead: 'Die Bibliothek ist der Startpunkt für dein Thema.', passages: ['Vergib einen klaren Namen für Kurs oder Modul.', 'Alle weiteren Bereiche greifen auf diese Basis zu.'], focus: ['Sauberer Start', 'Gemeinsame Basis'], action: quickStart },
        { step: 'Schritt 3', title: 'Infos anlegen', lead: 'Erfasse Wissen in kleinen, klaren Einträgen.', passages: ['Info-Einträge enthalten Begriffe, Personen, Quellen und Zitate.', 'Kleinere Einheiten lassen sich besser verknüpfen und trainieren.'], focus: ['Kleine Einheiten', 'Leicht wartbar'], action: quickStart },
        { step: 'Schritt 4', title: 'Typbasierte Eingabe', lead: 'Formulare passen sich automatisch dem Info-Typ an.', passages: ['Dadurch bleiben Daten strukturiert und konsistent.', 'Das verbessert Qualität und Auffindbarkeit.'], focus: ['Konsistenz', 'Bessere Suche'], action: quickStart },
        { step: 'Schritt 5', title: 'Wissen verlinken', lead: 'Verbinde Einträge zu einem Kontextnetz.', passages: ['Thema, Quelle und Beispiel werden als Beziehung sichtbar.', 'So erkennst du Lücken vor der nächsten Lernphase.'], focus: ['Kontextnetz', 'Lücken erkennen'], action: quickStart },
        { step: 'Schritt 6', title: 'Ziel-Sammlungen bauen', lead: 'Eine Sammlung bündelt Inhalte für einen konkreten Zweck.', passages: ['Nutze getrennte Sammlungen für Unterricht, Quiz oder Prüfung.', 'Du wählst Inhalte aus statt sie zu kopieren.'], focus: ['Zielorientierung', 'Keine Duplikate'], action: quickStart },
        { step: 'Schritt 7', title: 'Wiederholungen erstellen', lead: 'Wiederholungen definieren den Prüfungsablauf.', passages: ['Tempo, Reihenfolge und Umfang sind pro Wiederholung steuerbar.', 'Mehrere Wiederholungen pro Sammlung sind möglich.'], focus: ['Ablaufsteuerung', 'Mehrere Niveaus'], action: quickStart },
        { step: 'Schritt 8', title: 'Info und Karte', lead: 'Datenobjekt und Trainingsansicht sind getrennt.', passages: ['Info ist die Quelle der Inhalte.', 'Die Karte ist die Übungsansicht für Frage und Antwort.'], focus: ['Sauberes Modell', 'Wiederverwendbar'], action: quickStart },
        { step: 'Schritt 9', title: 'Sitzung durchführen', lead: 'Im Run-Modus führst du die Gruppe Schritt für Schritt.', passages: ['Moderation steuert Übergänge und Timing.', 'Teilnehmende folgen einem klaren Ablauf.'], focus: ['Klare Moderation', 'Stabile Dynamik'], action: quickStart },
        { step: 'Schritt 10', title: 'Abhängigkeitsgraph lesen', lead: 'Der Graph zeigt Lernprioritäten.', passages: ['Zentrale Knoten beeinflussen viele weitere Themen.', 'Starte mit Grundlagen und baue danach auf.'], focus: ['Priorisierung', 'Lernreihenfolge'], action: quickStart },
        { step: 'Schritt 11', title: 'Storyboard & Texte', lead: 'Plane Ablauf und sammle Notizen im selben Kontext.', passages: ['Storyboards strukturieren Sequenzen und Rollen.', 'Texte halten Erkenntnisse und veröffentlichungsreife Inhalte fest.'], focus: ['Planung', 'Dokumentation'], action: quickStart },
        { step: 'Schritt 12', title: 'Sicher teilen', lead: 'Teile Inhalte ohne Kontrollverlust.', passages: ['Leserechte sind separat von Bearbeitungsrechten steuerbar.', 'So bleibt der Kernbestand geschützt.'], focus: ['Rechtekontrolle', 'Sicheres Teilen'], action: quickStart },
        { step: 'Schritt 13', title: 'Ebenen-Navigation', lead: 'Sidebar und Breadcrumb zeigen deinen aktuellen Kontext.', passages: ['Du siehst sofort, auf welcher Ebene du arbeitest.', 'Das spart Zeit und reduziert Fehlklicks.'], focus: ['Orientierung', 'Effizienz'], action: quickStart },
        { step: 'Schritt 14', title: '30-Minuten-Startplan', lead: 'Starte klein und erweitere iterativ.', passages: ['Plan: 1 Bibliothek, 10 Infos, 1 Sammlung, 1 Test-Wiederholung.', 'Nach der ersten Runde verbesserst du Struktur und Ablauf.'], focus: ['Schneller Einstieg', 'Iteratives Vorgehen'], action: 'Jetzt starten: Bibliothek rechts anlegen und den ersten Eintrag erfassen.' }
      ];
    }

    return [
      { step: 'Step 1', title: 'What is Cogita?', lead: 'A post-login workspace to design, run, and improve knowledge journeys.', passages: ['You can keep content, training flow, and collaboration in one place.', 'The path stays explicit: library → collection → revision → session.'], focus: ['Single workspace', 'Clear learning flow'], action: quickStart },
      { step: 'Step 2', title: 'Start with a library', lead: 'Your library is the root container for one domain or program.', passages: ['Name it after your course, cohort, or topic scope.', 'Every next module reuses this foundation.'], focus: ['Root container', 'Consistent base'], action: quickStart },
      { step: 'Step 3', title: 'Add information units', lead: 'Build knowledge from small, reusable info entries.', passages: ['Capture terms, references, people, concepts, and citations.', 'Smaller entries are easier to link, review, and update.'], focus: ['Reusable units', 'Easy maintenance'], action: quickStart },
      { step: 'Step 4', title: 'Use type-based forms', lead: 'Each info type has a matching data structure and fields.', passages: ['Form layouts adapt automatically to the selected type.', 'This improves consistency and lowers input mistakes.'], focus: ['Structured input', 'Fewer errors'], action: quickStart },
      { step: 'Step 5', title: 'Link the knowledge graph', lead: 'Relationships turn isolated facts into usable context.', passages: ['Connect topics, sources, and supporting examples.', 'Dependency links show what must be learned first.'], focus: ['Context building', 'Better sequencing'], action: quickStart },
      { step: 'Step 6', title: 'Build goal collections', lead: 'Collections package selected infos for a concrete objective.', passages: ['Create separate collections for class, quiz, exam, or workshop.', 'You curate from existing entries instead of duplicating content.'], focus: ['Goal-oriented sets', 'No duplication'], action: quickStart },
      { step: 'Step 7', title: 'Create revisions', lead: 'Revisions define how practice and checking should run.', passages: ['Set pacing, order, and scope for each session style.', 'One collection can host multiple revision strategies.'], focus: ['Practice design', 'Multiple modes'], action: quickStart },
      { step: 'Step 8', title: 'Understand info vs card', lead: 'Data objects and practice views are intentionally separate.', passages: ['Info is the canonical source object.', 'Card is the generated training/checking view.'], focus: ['Clear model', 'Reusable content'], action: quickStart },
      { step: 'Step 9', title: 'Run live sessions', lead: 'Run mode helps facilitators guide each step with control.', passages: ['Move through prompts, responses, and timing intentionally.', 'Participants get a predictable and focused session rhythm.'], focus: ['Facilitator control', 'Group clarity'], action: quickStart },
      { step: 'Step 10', title: 'Read dependency graphs', lead: 'Graph views expose prerequisites and high-impact nodes.', passages: ['Central nodes usually deserve priority in onboarding.', 'Use this to plan revision order and reduce confusion.'], focus: ['Priority mapping', 'Smarter progression'], action: quickStart },
      { step: 'Step 11', title: 'Use storyboards and texts', lead: 'Plan narratives and keep notes near source knowledge.', passages: ['Storyboards model session structure and transitions.', 'Texts capture outcomes, drafts, and reusable explanations.'], focus: ['Planning layer', 'Contextual notes'], action: quickStart },
      { step: 'Step 12', title: 'Share safely', lead: 'Share read access without losing editorial control.', passages: ['Keep editing rights restricted to owners or maintainers.', 'Collaborators can consume material while core data stays protected.'], focus: ['Access control', 'Safe collaboration'], action: quickStart },
      { step: 'Step 13', title: 'Navigate by layers', lead: 'Sidebar and breadcrumb make system depth understandable.', passages: ['You always know whether you are at library, collection, or revision level.', 'Clear location awareness reduces wrong actions.'], focus: ['Fast orientation', 'Lower friction'], action: quickStart },
      { step: 'Step 14', title: '30-minute launch plan', lead: 'Start with a minimum viable setup, then iterate.', passages: ['Plan: create 1 library, add 10 infos, build 1 collection, run 1 revision.', 'After the first run, refine structure and scale by scenario.'], focus: ['Immediate execution', 'Iterative improvement'], action: 'Ready now? Create your first library on the right and start adding knowledge.' }
    ];
  }, [language]);
  const tutorialTotal = tutorialSlides.length;
  const safeTutorialIndex = Math.max(0, Math.min(tutorialIndex, tutorialTotal - 1));
  const activeTutorialSlide = tutorialSlides[safeTutorialIndex];
  const hasCollectionSelection = Boolean(selectedCollectionId);
  const showCollectionLayer = hasLibrarySelection && isCollectionNavigationTarget;
  const showCollectionActionLayer = hasCollectionSelection && isCollectionNavigationTarget;
  const showRevisionLayer = hasCollectionSelection && isCollectionNavigationTarget && (
    displayRevisionView === 'settings' || displayRevisionView === 'run' || displayRevisionView === 'shared'
  );
  const applyNavigationSelection = useCallback(
    (next: {
      libraryId?: string;
      target: CogitaTarget;
      collectionId?: string;
      revisionId?: string;
      revisionView: RevisionView;
      infoId?: string;
      infoView?: 'overview' | 'cards' | 'collections';
      collectionView?: 'overview' | 'infos';
    }) => {
      const hasLibrary = Boolean(next.libraryId);
      let resolvedTarget = next.target;
      let resolvedCollectionId = next.collectionId;
      let resolvedRevisionId = next.revisionId;
      let resolvedRevision = next.revisionView;
      let resolvedInfoId = next.infoId;
      let resolvedInfoView = next.infoView ?? pathState.infoView ?? 'overview';
      let resolvedCollectionView = next.collectionView ?? pathState.collectionView ?? 'infos';

      if (!hasLibrary) {
        resolvedTarget = 'library_overview';
        resolvedCollectionId = undefined;
        resolvedRevisionId = undefined;
        resolvedRevision = 'detail';
        resolvedInfoId = undefined;
        resolvedInfoView = 'overview';
        resolvedCollectionView = 'infos';
      } else if (TARGET_CAPABILITIES[resolvedTarget].requiresCollection && !resolvedCollectionId) {
        resolvedTarget = resolvedTarget === 'all_revisions' ? 'all_revisions' : 'all_collections';
        resolvedRevisionId = undefined;
        resolvedRevision = 'detail';
      } else if (resolvedTarget !== 'all_collections' && resolvedTarget !== 'all_revisions') {
        resolvedCollectionId = undefined;
        resolvedRevisionId = undefined;
        if (resolvedTarget !== 'new_card' && resolvedTarget !== 'all_cards') {
          resolvedInfoId = undefined;
          resolvedInfoView = 'overview';
        }
        if (resolvedTarget !== 'new_collection') {
          resolvedCollectionView = 'infos';
        }
      } else if (!TARGET_CAPABILITIES[resolvedTarget].allowsRevision) {
        resolvedRevision = 'detail';
      } else if (!REVISION_SELECTION_VIEWS.includes(resolvedRevision)) {
        resolvedRevisionId = undefined;
      }

      setSelectedLibraryId(next.libraryId);
      setSelectedTarget(resolvedTarget);
      setSelectedCollectionId(resolvedCollectionId);
      setSelectedRevisionId(resolvedRevisionId);
      setSelectedRevisionView(resolvedRevision);
      setSidebarOpen(false);

      const nextPath = normalizePath(
        buildCogitaPath(
          next.libraryId,
          resolvedTarget,
          resolvedCollectionId,
          resolvedRevision,
          resolvedRevisionId,
          resolvedInfoId,
          resolvedInfoView,
          resolvedCollectionView
        )
      );
      if (normalizePath(`${location.pathname}${location.search}`) === nextPath) return;
      lastNavigationRef.current = nextPath;
      navigate(nextPath);
    },
    [location.pathname, location.search, navigate, pathState.collectionView, pathState.infoView]
  );
  const navigationLevels = useMemo<NavigationLevel[]>(
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
        value: displayTarget,
        selectedLabel: selectedTargetLabel,
        disabled: !hasLibrarySelection,
        options: TARGET_OPTIONS.map((target) => ({ value: target, label: targetLabels[target] })),
        onSelect: (value: string) => {
          const nextTarget = value as CogitaTarget;
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: nextTarget,
            collectionId: selectedCollectionId,
            revisionId: selectedRevisionId,
            revisionView: selectedRevisionView,
            infoId: nextTarget === 'new_card' ? pathState.infoId : undefined
          });
        }
      },
      {
        key: 'info_mode',
        label: workspaceCopy.layers.target,
        visible: displayTarget === 'all_cards',
        value: infoMode,
        selectedLabel:
          infoMode === 'create'
            ? workspaceCopy.infoMode.create
            : infoMode === 'selected'
            ? selectedInfoOption?.label ?? selectedInfoLabel ?? copy.cogita.library.list.selectedEmpty
            : workspaceCopy.infoMode.search,
        disabled: !hasLibrarySelection,
        options: [
          { value: 'search', label: workspaceCopy.infoMode.search },
          { value: 'create', label: workspaceCopy.infoMode.create },
          ...(pathState.infoId
            ? [
                {
                  value: 'selected',
                  label: selectedInfoOption?.label ?? selectedInfoLabel ?? copy.cogita.library.list.selectedEmpty
                }
              ]
            : [])
        ],
        onSelect: (value: string) => {
          if (value === 'selected') {
            if (!pathState.infoId) return;
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: 'all_cards',
              collectionId: selectedCollectionId,
              revisionId: selectedRevisionId,
              revisionView: selectedRevisionView,
              infoId: pathState.infoId,
              infoView: 'overview'
            });
            return;
          }
          if (value === 'create') {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: 'new_card',
              collectionId: selectedCollectionId,
              revisionId: selectedRevisionId,
              revisionView: selectedRevisionView,
              infoId: undefined
            });
            return;
          }
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: 'all_cards',
            collectionId: selectedCollectionId,
            revisionId: selectedRevisionId,
            revisionView: selectedRevisionView,
            infoId: undefined,
            infoView: 'overview'
          });
        }
      },
      {
        key: 'info_selected_action',
        label: workspaceCopy.layers.target,
        visible: displayTarget === 'all_cards' && Boolean(pathState.infoId),
        value:
          selectedTarget === 'new_card' && pathState.infoId
            ? 'edit'
            : pathState.infoView === 'cards'
            ? 'cards'
            : pathState.infoView === 'collections'
            ? 'collections'
            : 'overview',
        selectedLabel:
          selectedTarget === 'new_card' && pathState.infoId
            ? workspaceCopy.infoActions.edit
            : pathState.infoView === 'cards'
            ? workspaceCopy.infoActions.seeCards
            : pathState.infoView === 'collections'
            ? 'Kolekcje'
            : workspaceCopy.infoActions.overview,
        disabled: !hasLibrarySelection || !pathState.infoId,
        options: [
          { value: 'overview', label: workspaceCopy.infoActions.overview },
          { value: 'edit', label: workspaceCopy.infoActions.edit },
          { value: 'cards', label: workspaceCopy.infoActions.seeCards },
          { value: 'collections', label: 'Kolekcje' }
        ],
        onSelect: (value: string) => {
          if (!pathState.infoId) return;
          if (value === 'edit') {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: 'new_card',
              collectionId: selectedCollectionId,
              revisionId: selectedRevisionId,
              revisionView: selectedRevisionView,
              infoId: pathState.infoId
            });
            return;
          }
          if (value === 'cards') {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: 'all_cards',
              collectionId: selectedCollectionId,
              revisionId: selectedRevisionId,
              revisionView: selectedRevisionView,
              infoId: pathState.infoId,
              infoView: 'cards'
            });
            return;
          }
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: 'all_cards',
            collectionId: selectedCollectionId,
            revisionId: selectedRevisionId,
            revisionView: selectedRevisionView,
            infoId: pathState.infoId,
            infoView: 'overview'
          });
        }
      },
      {
        key: 'collection_mode',
        label: workspaceCopy.layers.collection,
        visible: hasLibrarySelection && (isCollectionNavigationTarget || selectedTarget === 'new_collection'),
        value: collectionMode,
        selectedLabel:
          collectionMode === 'create'
            ? copy.cogita.library.actions.createCollection
            : collectionMode === 'selected'
            ? (selectedCollection?.name ?? workspaceCopy.path.noCollectionSelected)
            : copy.cogita.library.actions.collections,
        disabled: !hasLibrarySelection,
        options: [
          { value: 'search', label: copy.cogita.library.actions.collections },
          { value: 'create', label: copy.cogita.library.actions.createCollection },
          ...(selectedCollectionId && selectedCollection
            ? [{ value: 'selected', label: selectedCollection.name }]
            : [])
        ],
        onSelect: (value: string) => {
          if (value === 'create') {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: 'new_collection',
              collectionId: undefined,
              revisionId: undefined,
              revisionView: 'detail'
            });
            return;
          }
          if (value === 'selected' && selectedCollectionId) {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: isCollectionNavigationTarget ? selectedTarget : 'all_collections',
              collectionId: selectedCollectionId,
              revisionId: selectedRevisionId,
              revisionView: 'detail'
            });
            return;
          }
          if (value === 'collections') {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: 'all_cards',
              collectionId: selectedCollectionId,
              revisionId: selectedRevisionId,
              revisionView: selectedRevisionView,
              infoId: pathState.infoId,
              infoView: 'collections'
            });
            return;
          }
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: isCollectionNavigationTarget ? selectedTarget : 'all_collections',
            collectionId: undefined,
            revisionId: undefined,
            revisionView: 'detail'
          });
        }
      },
      {
        key: 'collection',
        label: workspaceCopy.layers.collection,
        visible: showCollectionLayer && collectionMode !== 'create',
        value: selectedCollectionId ?? '',
        selectedLabel: selectedCollection?.name ?? workspaceCopy.path.noCollectionSelected,
        disabled: !hasLibrarySelection || collectionsLoading || collections.length === 0,
        options: collections.map((collection) => ({ value: collection.collectionId, label: collection.name })),
        emptyOption: workspaceCopy.selectCollectionOption,
        onSelect: (value: string) => {
          const nextCollectionId = value || undefined;
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: isCollectionNavigationTarget ? selectedTarget : 'all_collections',
            collectionId: nextCollectionId,
            revisionId: undefined,
            revisionView: 'detail'
          });
        }
      },
      {
        key: 'collection_selected_action',
        label: workspaceCopy.layers.revision,
        visible: showCollectionActionLayer,
        value:
          displayRevisionView === 'graph'
            ? 'edit'
            : (displayRevisionView === 'settings' || displayRevisionView === 'run' || displayRevisionView === 'shared')
            ? 'revisions'
            : (pathState.collectionView ?? 'infos') === 'overview'
            ? 'overview'
            : 'infos',
        selectedLabel:
          displayRevisionView === 'graph'
            ? 'Edytuj'
            : (displayRevisionView === 'settings' || displayRevisionView === 'run' || displayRevisionView === 'shared')
            ? workspaceCopy.targets.allRevisions
            : (pathState.collectionView ?? 'infos') === 'overview'
            ? 'Przegląd'
            : 'Informacje',
        disabled: !selectedCollectionId,
        options: [
          { value: 'overview', label: 'Przegląd' },
          { value: 'edit', label: 'Edytuj' },
          { value: 'infos', label: 'Informacje' },
          { value: 'revisions', label: workspaceCopy.targets.allRevisions }
        ],
        onSelect: (value: string) => {
          if (!selectedCollectionId) return;
          if (value === 'edit') {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: isCollectionNavigationTarget ? selectedTarget : 'all_collections',
              collectionId: selectedCollectionId,
              revisionId: undefined,
              revisionView: 'graph'
            });
            return;
          }
          if (value === 'revisions') {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: isCollectionNavigationTarget ? selectedTarget : 'all_collections',
              collectionId: selectedCollectionId,
              revisionId: selectedRevisionId,
              revisionView: 'settings'
            });
            return;
          }
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: isCollectionNavigationTarget ? selectedTarget : 'all_collections',
            collectionId: selectedCollectionId,
            revisionId: undefined,
            revisionView: 'detail',
            infoId: pathState.infoId,
            infoView: pathState.infoView,
            collectionView: value === 'overview' ? 'overview' : 'infos'
          });
        }
      },
      {
        key: 'revision_entry',
        label: workspaceCopy.layers.revision,
        visible: showRevisionLayer,
        value: selectedRevisionId ?? '',
        selectedLabel: selectedRevision?.name ?? workspaceCopy.status.noRevisions,
        disabled: !hasCollectionSelection || revisionsLoading || revisions.length === 0,
        options: revisions.map((revision) => ({ value: revision.revisionId, label: revision.name })),
        emptyOption: workspaceCopy.status.noRevisions,
        onSelect: (value: string) => {
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: isCollectionNavigationTarget ? selectedTarget : 'all_collections',
            collectionId: selectedCollectionId,
            revisionId: value || undefined,
            revisionView: selectedRevisionView
          });
        }
      }
    ],
    [
      collections,
      collectionsLoading,
      infoMode,
      infos,
      libraries,
      loading,
      applyNavigationSelection,
      revisions,
      revisionsLoading,
      selectedCollection,
      selectedCollectionId,
      selectedInfoOption,
      selectedRevision,
      selectedRevisionId,
      selectedInfoLabel,
      hasCollectionSelection,
      hasLibrarySelection,
      selectedLibrary,
      isCollectionNavigationTarget,
      selectedLibraryId,
      selectedRevisionLabel,
      selectedRevisionView,
      selectedTarget,
      displayRevisionView,
      displayTarget,
      selectedTargetLabel,
      showCollectionLayer,
      showCollectionActionLayer,
      showRevisionLayer,
      targetLabels,
      copy.cogita.library.list.selectedEmpty,
      pathState.infoId,
      pathState.infoView,
      pathState.collectionView,
      workspaceCopy.infoActions.edit,
      workspaceCopy.infoActions.overview,
      workspaceCopy.infoActions.seeCards,
      workspaceCopy.layers.collection,
      workspaceCopy.layers.library,
      workspaceCopy.layers.revision,
      workspaceCopy.layers.target,
      workspaceCopy.noLibraryOption,
      workspaceCopy.path.noCollectionSelected,
      workspaceCopy.path.noLibrarySelected,
      workspaceCopy.selectCollectionOption,
      workspaceCopy.targets.allRevisions,
      collectionMode
    ]
  );
  const visibleNavigationLevels = useMemo<NavigationLevel[]>(
    () => navigationLevels.filter((level) => level.visible),
    [navigationLevels]
  );
  const sidebarActionLevels = useMemo<NavigationLevel[]>(
    () =>
      visibleNavigationLevels.filter(
        (level) =>
          level.key !== 'library' &&
          level.key !== 'collection'
      ),
    [visibleNavigationLevels]
  );
  const sidebarLibraryActionsLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'target') ?? null,
    [sidebarActionLevels]
  );
  const sidebarInfoActionsLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'info_mode') ?? null,
    [sidebarActionLevels]
  );
  const sidebarSelectedInfoActionsLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'info_selected_action') ?? null,
    [sidebarActionLevels]
  );
  const sidebarCollectionActionsLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'collection_mode') ?? null,
    [sidebarActionLevels]
  );
  const sidebarSelectedCollectionActionsLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'collection_selected_action') ?? null,
    [sidebarActionLevels]
  );
  const sidebarRevisionEntriesLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'revision_entry') ?? null,
    [sidebarActionLevels]
  );
  const renderSidebarActions = useCallback((level: NavigationLevel | null, keyPrefix: string) => {
    if (!level) return null;
    return (
      <div className="cogita-sidebar-actions">
        {level.options.map((option) => (
          <button
            key={`${keyPrefix}:${level.key}:${option.value}`}
            type="button"
            className={`ghost ${String(level.value) === option.value ? 'active' : ''}`}
            onClick={() => level.onSelect(option.value)}
            disabled={level.disabled}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }, []);
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
      if (pathState.infoId && pathState.infoView === 'cards') {
        return <CogitaInfoCheckcardsPage {...baseProps} infoId={pathState.infoId} selectedReviewerRoleId={selectedReviewerRoleId || null} />;
      }
      return <CogitaLibraryListPage {...baseProps} mode={pathState.cardMode ?? 'list'} />;
    }
    if (pathState.target === 'new_card') {
      return <CogitaLibraryAddPage {...baseProps} editInfoId={pathState.infoId} />;
    }
    if (pathState.target === 'dependencies') {
      return <CogitaDependencyGraphPage {...baseProps} />;
    }
    if (pathState.target === 'transfer') {
      return <CogitaLibraryTransferPage {...baseProps} />;
    }
    if (pathState.target === 'storyboards' || pathState.target === 'new_storyboard') {
      return <CogitaLibraryStoryboardsPage {...baseProps} />;
    }
    if (pathState.target === 'texts' || pathState.target === 'new_text') {
      return <CogitaLibraryTextsPage {...baseProps} />;
    }
    if (pathState.target === 'all_collections' || pathState.target === 'all_revisions') {
      if (!pathState.collectionId && pathState.revisionView === 'run') {
        return <CogitaRevisionRunPage {...baseProps} revisionId={pathState.revisionId} />;
      }
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
          onCreated={(collectionId) => {
            applyNavigationSelection({
              libraryId,
              target: selectedTarget === 'all_revisions' ? 'all_revisions' : 'all_collections',
              collectionId,
              revisionId: undefined,
              revisionView: 'graph'
            });
          }}
        />
      );
    }
    return null;
  }, [
    authLabel,
    applyNavigationSelection,
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
    pathState.infoId,
    pathState.libraryId,
    pathState.revisionId,
    pathState.revisionView,
    pathState.target,
    secureMode,
    showProfileMenu,
    selectedTarget,
    selectedReviewerRoleId
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

        const selectedByRule =
          libraryItems.find((item) => item.libraryId === pathState.libraryId)?.libraryId;

        const preferredTargetFromPrefs = selectedByRule ? prefsRef.current.byLibrary?.[selectedByRule]?.lastTarget : undefined;
        const preferredTarget = isCogitaTarget(preferredTargetFromPrefs) ? preferredTargetFromPrefs : 'library_overview';
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

    if (!pathState.libraryId) {
      setSelectedLibraryId(undefined);
      setSelectedTarget(pathState.target ?? 'library_overview');
      setSelectedCollectionId(undefined);
      setSelectedRevisionId(undefined);
      setSelectedRevisionView('detail');
      return;
    }

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
      setInfos([]);
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
    if (!selectedLibraryId || (displayTarget !== 'all_cards' && selectedTarget !== 'new_card')) {
      setInfos([]);
      return;
    }
    let cancelled = false;
    searchCogitaInfos({ libraryId: selectedLibraryId, limit: 200 })
      .then((items) => {
        if (cancelled) return;
        setInfos(items);
      })
      .catch(() => {
        if (cancelled) return;
        setInfos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [displayTarget, selectedLibraryId, selectedTarget]);

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
    const infoId = pathState.infoId;
    if (!selectedLibraryId || !infoId) {
      setSelectedInfoLabel(undefined);
      return;
    }

    let cancelled = false;
    getCogitaInfoDetail({ libraryId: selectedLibraryId, infoId })
      .then((detail) => {
        if (cancelled) return;
        const payload = detail.payload as { label?: string; name?: string; title?: string };
        setSelectedInfoLabel(payload?.label ?? payload?.name ?? payload?.title ?? detail.infoId);
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedInfoLabel(infoId);
      });

    return () => {
      cancelled = true;
    };
  }, [pathState.infoId, selectedLibraryId]);

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
      (pathState.target === 'all_collections' || pathState.target === 'all_revisions') &&
      Boolean(pathState.collectionId)
    ) {
      return;
    }

    const currentPath = normalizePath(`${location.pathname}${location.search}`);
    const isMainCogitaPath =
      normalizePath(location.pathname) === '/cogita' &&
      !pathState.libraryId &&
      !selectedLibraryId;
    if (isMainCogitaPath) {
      lastNavigationRef.current = null;
      return;
    }
    if (normalizePath(location.pathname) === '/cogita/persons') {
      lastNavigationRef.current = null;
      return;
    }
    const isLibraryRevisionRunPath =
      normalizePath(location.pathname) === `/cogita/library/${selectedLibraryId}/revision/run` &&
      pathState.revisionView === 'run' &&
      !pathState.collectionId &&
      (selectedTarget === 'all_collections' || selectedTarget === 'all_revisions') &&
      selectedRevisionView === 'run' &&
      !selectedCollectionId;
    if (isLibraryRevisionRunPath) {
      lastNavigationRef.current = null;
      return;
    }
    const nextPath = normalizePath(
      buildCogitaPath(
        selectedLibraryId,
        selectedTarget,
        selectedCollectionId,
        selectedRevisionView,
        selectedRevisionId,
        pathState.infoId,
        pathState.infoView ?? 'overview',
        pathState.collectionView ?? 'infos'
      )
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
    location.search,
    navigate,
    pathState.collectionId,
    pathState.infoId,
    pathState.infoView,
    pathState.collectionView,
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
      setSelectedTarget(selectedTarget === 'all_revisions' ? 'all_revisions' : 'all_collections');
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
      setSelectedTarget(selectedTarget === 'all_revisions' ? 'all_revisions' : 'all_collections');
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
      headerExtra={
        <div className="cogita-header-reviewer-actions">
          <label className="cogita-header-reviewer">
            <span>Person</span>
            <select
              value={selectedReviewerRoleId}
              disabled={!selectedLibraryId}
              onChange={(event) => {
                const value = event.target.value;
                if (value === '__new_person__') {
                  navigate('/cogita/persons');
                  return;
                }
                setSelectedReviewerRoleId(value);
              }}
            >
              <option value="">{selectedLibraryId ? 'No person' : 'Select library first'}</option>
              {headerReviewers.map((reviewer) => (
                <option key={reviewer.roleId} value={reviewer.roleId}>
                  {reviewer.label}
                </option>
              ))}
              <option value="__new_person__">+ Create new person</option>
            </select>
          </label>
          <button type="button" className="ghost" onClick={() => navigate('/cogita/persons')}>
            Persons
          </button>
        </div>
      }
    >
      <section className="cogita-browser-shell">
        <aside className={`cogita-browser-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label={workspaceCopy.sidebar.title}>
          <div className="cogita-browser-sidebar-section">
            <h2>{selectedLibrary?.name ?? workspaceCopy.path.noLibrarySelected}</h2>
            <p className="cogita-sidebar-note">
              {selectedLibrary ? workspaceCopy.sidebar.libraryActionsHint : workspaceCopy.status.selectLibraryFirst}
            </p>
            {renderSidebarActions(sidebarLibraryActionsLevel, 'sidebar')}
            {sidebarInfoActionsLevel ? (
              <div className="cogita-sidebar-actions-nested" data-level="branch">
                <p className="cogita-sidebar-note">{workspaceCopy.sidebar.infoActionsHint}</p>
                {renderSidebarActions(sidebarInfoActionsLevel, 'sidebar')}
                {sidebarSelectedInfoActionsLevel ? (
                  <div className="cogita-sidebar-actions-nested" data-level="branch">
                    <p className="cogita-sidebar-note">
                      {selectedInfoOption?.label ?? selectedInfoLabel ?? copy.cogita.library.list.selectedEmpty}
                    </p>
                    <p className="cogita-sidebar-note">{workspaceCopy.sidebar.selectedInfoActionsHint}</p>
                    {renderSidebarActions(sidebarSelectedInfoActionsLevel, 'sidebar')}
                  </div>
                ) : null}
              </div>
            ) : null}

            {sidebarCollectionActionsLevel ? (
              <div className="cogita-sidebar-actions-nested" data-level="branch">
                <p className="cogita-sidebar-note">{workspaceCopy.sidebar.collectionActionsHint}</p>
                {renderSidebarActions(sidebarCollectionActionsLevel, 'sidebar')}
                {selectedCollection && sidebarSelectedCollectionActionsLevel ? (
                  <div className="cogita-sidebar-actions-nested" data-level="branch">
                    <p className="cogita-sidebar-note">{selectedCollection.name}</p>
                    {renderSidebarActions(sidebarSelectedCollectionActionsLevel, 'sidebar')}
                    {sidebarRevisionEntriesLevel ? (
                      <div className="cogita-sidebar-actions-nested" data-level="branch">
                        <p className="cogita-sidebar-note">
                          {selectedRevision?.name ?? workspaceCopy.status.noRevisions}
                        </p>
                        {renderSidebarActions(sidebarRevisionEntriesLevel, 'sidebar')}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
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
              {level.options.length === 0 ? (
                <span className="cogita-browser-static" aria-label={level.label}>
                  {level.selectedLabel}
                </span>
              ) : (
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
              )}
            </div>
          ))}

          </nav>

          {embeddedSubpage ? (
            <>
              {(selectedTarget === 'all_collections' || selectedTarget === 'all_revisions') && selectedCollectionId && selectedRevisionView === 'new' ? (
                <article className="cogita-browser-panel">
                  <h2>{workspaceCopy.revisionForm.createAction}</h2>
                  <label className="cogita-field full">
                    <span>{workspaceCopy.revisionForm.nameLabel}</span>
                    <input
                      type="text"
                      value={newRevisionName}
                      onChange={(event) => setNewRevisionName(event.target.value)}
                      placeholder={workspaceCopy.revisionForm.namePlaceholder}
                    />
                  </label>
                  <button type="button" className="cta" onClick={handleCreateRevision}>
                    {workspaceCopy.revisionForm.createAction}
                  </button>
                  {status ? <p className="cogita-form-error">{status}</p> : null}
                </article>
              ) : null}
              <section className="cogita-browser-embedded">
                <CogitaEmbeddedContext.Provider value>
                  {embeddedSubpage}
                </CogitaEmbeddedContext.Provider>
              </section>
            </>
          ) : null}

          {!embeddedSubpage ? (
            <>
              {isPersonsPage ? (
                <section className="cogita-browser-embedded">
                  <CogitaPersonsPage
                    copy={copy}
                    onPersonCreated={(roleId) => {
                      void roleId;
                      setReviewersReloadTick((value) => value + 1);
                    }}
                  />
                </section>
              ) : null}

              {!selectedLibraryId && !isPersonsPage ? (
                <section className="cogita-browser-intro">
                  <div className="cogita-browser-intro-main">
                    <article className="cogita-browser-panel cogita-browser-tutorial">
                      <div className="cogita-browser-tutorial-head">
                        <div>
                          <p className="cogita-browser-tutorial-step">{activeTutorialSlide.step}</p>
                          <h2>{activeTutorialSlide.title}</h2>
                        </div>
                        <p>
                          {safeTutorialIndex + 1} / {tutorialTotal}
                        </p>
                      </div>
                      <p className="cogita-browser-note cogita-browser-tutorial-lead">{activeTutorialSlide.lead}</p>
                      <div className="cogita-browser-tutorial-passages">
                        {activeTutorialSlide.passages.map((passage) => (
                          <p key={passage}>{passage}</p>
                        ))}
                      </div>
                      <div className="cogita-browser-tutorial-focus">
                        {activeTutorialSlide.focus.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                      <p className="cogita-browser-note cogita-browser-tutorial-action">{activeTutorialSlide.action}</p>
                      <div className="cogita-browser-tutorial-progress" role="list" aria-label="Tutorial progress">
                        {tutorialSlides.map((slide, index) => (
                          <button
                            key={`tutorial:${slide.title}:${index}`}
                            type="button"
                            className={`ghost ${index === safeTutorialIndex ? 'active' : ''}`}
                            onClick={() => setTutorialIndex(index)}
                            aria-label={`${index + 1}`}
                          >
                            {index + 1}
                          </button>
                        ))}
                      </div>
                      <div className="cogita-form-actions">
                        <button
                          type="button"
                          className="ghost"
                          disabled={safeTutorialIndex === 0}
                          onClick={() => setTutorialIndex((current) => Math.max(0, current - 1))}
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          className="cta"
                          disabled={safeTutorialIndex === tutorialTotal - 1}
                          onClick={() => setTutorialIndex((current) => Math.min(tutorialTotal - 1, current + 1))}
                        >
                          Next
                        </button>
                      </div>
                    </article>
                  </div>

                  <div className="cogita-browser-intro-side">
                    <article className="cogita-browser-panel">
                      <h2>{copy.cogita.user.createLibraryTitle}</h2>
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
                      {status ? <p className="cogita-form-error">{status}</p> : null}
                    </article>

                    <article className="cogita-browser-panel">
                      <h2>{copy.cogita.user.availableLibraries}</h2>
                      {libraries.length === 0 ? <p className="cogita-browser-note">{copy.cogita.user.noLibraries}</p> : null}
                      {libraries.length > 0 ? (
                        <div className="cogita-card-list" data-view="list">
                          {libraries.map((library) => (
                            <button
                              key={library.libraryId}
                              type="button"
                              className="cogita-card-item"
                              onClick={() => {
                                applyNavigationSelection({
                                  libraryId: library.libraryId,
                                  target: 'library_overview',
                                  collectionId: undefined,
                                  revisionId: undefined,
                                  revisionView: 'detail'
                                });
                              }}
                            >
                              <div className="cogita-card-type">{copy.cogita.user.libraryRoleLabel}</div>
                              <h3 className="cogita-card-title">{library.name}</h3>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  </div>
                </section>
              ) : null}

            </>
          ) : null}
        </div>
      </section>
    </CogitaShell>
  );
}
