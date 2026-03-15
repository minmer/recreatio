import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import '../../styles/cogita.css';
import 'katex/dist/katex.min.css';
import {
  ApiError,
  createCogitaLibrary,
  getCogitaCreationProjects,
  createDataItem,
  exportCogitaLibraryStream,
  getCogitaDependencyGraphs,
  getCogitaCollections,
  getCogitaInfoDetail,
  getCogitaLibraries,
  getCogitaLiveRevisionSessionsByRevision,
  importCogitaLibraryStream,
  getCogitaReviewers,
  getCogitaRevisions,
  getRoleGraph,
  getRoles,
  issueCsrf,
  searchCogitaInfos,
  type CogitaImportProgress,
  updateDataItem,
  type CogitaCollectionSummary,
  type CogitaCreationProject,
  type CogitaDependencyGraphSummary,
  type CogitaInfoSearchResult,
  type CogitaLibrary,
  type CogitaLiveRevisionSessionListItem,
  type CogitaReviewer,
  type CogitaRevision,
  type RoleResponse,
  type TransferProgress
} from '../../lib/api';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { CogitaEmbeddedContext, CogitaShell } from './CogitaShell';
import { useLocation, useNavigate } from 'react-router-dom';
import { CogitaLibraryOverview } from './components/workspace/library/CogitaLibraryOverview';
import { CogitaNotionSearch } from './components/workspace/notion/CogitaNotionSearch';
import { CogitaNotionEdit } from './components/workspace/notion/CogitaNotionEdit';
import { CogitaNotionOverview } from './components/workspace/notion/CogitaNotionOverview';
import { CogitaDependencySearch } from './components/workspace/dependency/CogitaDependencySearch';
import { CogitaDependencyEdit } from './components/workspace/dependency/CogitaDependencyEdit';
import { CogitaDependencyOverview } from './components/workspace/dependency/CogitaDependencyOverview';
import { CogitaNotionCards } from './components/workspace/notion/CogitaNotionCards';
import { CogitaPersonsPage } from './CogitaPersonsPage';
import { CogitaStoryboardEdit, type StoryboardWorkspaceMode } from './components/workspace/storyboard/CogitaStoryboardEdit';
import { CogitaTextWorkspace } from './components/workspace/text/CogitaTextWorkspace';
import { CogitaCollectionSearch } from './components/workspace/collection/CogitaCollectionSearch';
import { CogitaCollectionOverview } from './components/workspace/collection/CogitaCollectionOverview';
import { CogitaCollectionEdit } from './components/workspace/collection/CogitaCollectionEdit';
import { CogitaRevisionSearch } from './components/workspace/revision/CogitaRevisionSearch';
import { CogitaRevisionOverview } from './components/workspace/revision/CogitaRevisionOverview';
import { CogitaRevisionEdit } from './components/workspace/revision/CogitaRevisionEdit';
import { CogitaRevisionLiveSessions } from './components/workspace/revision/livesessions/CogitaRevisionLiveSessions';
import { CogitaLiveSessionsPage } from './live/CogitaLiveSessionsPage';
import type { CogitaLibraryMode } from './components/types';
import { primeCachedCollections } from './components/cogitaMetaCache';
import { createWorkspaceTransfer } from './features/workspace/transfer';

type RevisionView = 'detail' | 'graph' | 'settings' | 'live' | 'new';
type LiveSessionView = 'list' | 'new' | 'detail' | 'edit';
type DependencyView = 'search' | 'create' | 'overview' | 'edit';
type StoryboardView = 'search' | 'create' | 'overview' | 'edit';
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
  storyboardId?: string;
  storyboardView?: StoryboardView;
  collectionId?: string;
  filterCollectionId?: string;
  revisionId?: string;
  revisionView?: RevisionView;
  liveSessionId?: string;
  liveSessionView?: LiveSessionView;
  cardMode?: CogitaLibraryMode;
  infoId?: string;
  infoView?: 'overview' | 'cards' | 'collections';
  collectionView?: 'overview' | 'infos';
  dependencyGraphId?: string;
  dependencyView?: DependencyView;
  dependencyTransferToken?: string;
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
type RevisionMode = 'search' | 'create' | 'selected' | 'live_sessions';
type LiveSessionMode = 'search' | 'create' | 'selected';
type DependencyMode = 'search' | 'create' | 'selected';
type StoryboardMode = 'search' | 'create' | 'selected';
type TutorialSlide = { step: string; title: string; lead: string; passages: string[]; focus: string[]; action: string };

const PREFS_ITEM_NAME = 'cogita.preferences';
const REVIEWER_PREFS_ITEM_NAME = 'cogita.reviewer.preferences';
const WORKSPACE_LAST_PATH_KEY = 'cogita.workspace.last.path';
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
  all_revisions: { requiresCollection: false, allowsRevision: true },
  new_collection: { requiresCollection: false, allowsRevision: false },
  transfer: { requiresCollection: false, allowsRevision: false },
  storyboards: { requiresCollection: false, allowsRevision: false },
  new_storyboard: { requiresCollection: false, allowsRevision: false },
  texts: { requiresCollection: false, allowsRevision: false },
  new_text: { requiresCollection: false, allowsRevision: false },
  dependencies: { requiresCollection: false, allowsRevision: false }
};
const REVISION_SELECTION_VIEWS: RevisionView[] = ['detail', 'settings', 'live'];
const SIDEBAR_NAV_LABEL_MAX = 30;
const BREADCRUMB_NAV_LABEL_MAX = 42;

function WorkspaceLibraryTransferSection({
  copy,
  libraryId,
  libraryName
}: {
  copy: Copy;
  libraryId: string;
  libraryName?: string | null;
}) {
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ infos: number; connections: number; collections: number } | null>(null);
  const [importLiveStatus, setImportLiveStatus] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<TransferProgress | null>(null);
  const [importProgress, setImportProgress] = useState<TransferProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes)) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(1)} GB`;
  };

  const handleExport = async () => {
    setExportStatus(null);
    setExportProgress({ loadedBytes: 0, totalBytes: null, percent: null });
    try {
      setExportStatus(copy.cogita.library.overview.exporting);
      const blob = await exportCogitaLibraryStream(libraryId, setExportProgress);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `cogita-library-${libraryName || libraryId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportStatus(copy.cogita.library.overview.exportReady);
    } catch {
      setExportStatus(copy.cogita.library.overview.exportFail);
    } finally {
      setExportProgress((current) => current ?? { loadedBytes: 0, totalBytes: null, percent: null });
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    setImportStatus(null);
    setImportResult(null);
    setImportLiveStatus(null);
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setImportStatus(copy.cogita.library.overview.importing);
      setImportProgress({ loadedBytes: 0, totalBytes: file.size, percent: 0 });
      const result = await importCogitaLibraryStream(libraryId, file, setImportProgress, (progress: CogitaImportProgress) => {
        const stageLabel =
          progress.stage === 'infos'
            ? copy.cogita.library.overview.importStageInfos
            : progress.stage === 'connections'
              ? copy.cogita.library.overview.importStageConnections
              : copy.cogita.library.overview.importStageCollections;
        setImportLiveStatus(
          copy.cogita.library.overview.importLiveProgress
            .replace('{stage}', stageLabel)
            .replace('{done}', String(progress.processed))
            .replace('{total}', String(progress.total))
            .replace('{infos}', String(progress.infos))
            .replace('{connections}', String(progress.connections))
            .replace('{collections}', String(progress.collections))
        );
      });
      setImportResult({
        infos: result.infosImported,
        connections: result.connectionsImported,
        collections: result.collectionsImported
      });
      setImportStatus(copy.cogita.library.overview.importDone);
    } catch (error) {
      const detail = error instanceof ApiError && error.message ? ` ${error.message}` : '';
      setImportStatus(`${copy.cogita.library.overview.importFail}${detail}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <section className="cogita-library-dashboard" data-mode="detail">
      <header className="cogita-library-dashboard-header">
        <div>
          <h1 className="cogita-library-title">{libraryName || libraryId}</h1>
          <p className="cogita-library-subtitle">{copy.cogita.library.overview.transferTitle}</p>
        </div>
      </header>
      <div className="cogita-library-layout">
        <div className="cogita-library-content">
          <section className="cogita-library-detail">
            <div className="cogita-detail-header">
              <div>
                <h3 className="cogita-detail-title">{copy.cogita.library.overview.transferTitle}</h3>
              </div>
            </div>
            <div className="cogita-detail-body">
              <p>{copy.cogita.library.overview.transferBody}</p>
              <div className="cogita-form-actions">
                <button type="button" className="cta" onClick={handleExport}>
                  {copy.cogita.library.overview.export}
                </button>
                <label className="cta ghost cogita-file-button">
                  {copy.cogita.library.overview.import}
                  <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} />
                </label>
              </div>
              {exportProgress ? (
                <div className="cogita-progress">
                  <progress value={exportProgress.percent ?? undefined} max={exportProgress.totalBytes ? 100 : undefined} />
                  <span>
                    {copy.cogita.library.overview.exportProgress
                      .replace('{loaded}', formatBytes(exportProgress.loadedBytes))
                      .replace(
                        '{total}',
                        exportProgress.totalBytes
                          ? formatBytes(exportProgress.totalBytes)
                          : copy.cogita.library.overview.progressUnknown
                      )}
                  </span>
                </div>
              ) : null}
              {importProgress ? (
                <div className="cogita-progress">
                  <progress value={importProgress.percent ?? undefined} max={importProgress.totalBytes ? 100 : undefined} />
                  <span>
                    {copy.cogita.library.overview.importProgress
                      .replace('{loaded}', formatBytes(importProgress.loadedBytes))
                      .replace(
                        '{total}',
                        importProgress.totalBytes
                          ? formatBytes(importProgress.totalBytes)
                          : copy.cogita.library.overview.progressUnknown
                      )}
                  </span>
                </div>
              ) : null}
              {exportStatus ? <p className="cogita-help">{exportStatus}</p> : null}
              {importStatus ? <p className="cogita-help">{importStatus}</p> : null}
              {importLiveStatus ? <p className="cogita-help">{importLiveStatus}</p> : null}
              {importResult ? (
                <p className="cogita-help">
                  {copy.cogita.library.overview.importSummary
                    .replace('{infos}', String(importResult.infos))
                    .replace('{connections}', String(importResult.connections))
                    .replace('{collections}', String(importResult.collections))}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function shortenNavLabel(label: string, maxLength: number) {
  const text = (label ?? '').trim();
  if (text.length <= maxLength) return text;
  if (maxLength <= 1) return text.slice(0, maxLength);
  return `${text.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function parseCogitaPath(pathname: string, search: string = ''): ParsedCogitaPath {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'cogita') {
    return {};
  }

  if (segments[1] !== 'workspace') {
    return {};
  }

  if (!segments[2]) {
    return {};
  }

  if (segments[2] !== 'libraries') {
    return {};
  }

  const libraryId = segments[3];
  if (!libraryId) {
    return {};
  }

  const section = segments[4];
  const sectionArg1 = segments[5];
  const sectionArg2 = segments[6];
  const sectionArg3 = segments[7];
  const sectionArg4 = segments[8];

  const searchParams = new URLSearchParams(search);
  const filterCollectionId = (searchParams.get('filterCollectionId') ?? '').trim() || undefined;
  const dependencyGraphId = (searchParams.get('graphId') ?? '').trim() || undefined;
  const dependencyTransferToken = (searchParams.get('transfer') ?? '').trim() || undefined;
  const dependencyViewRaw = (searchParams.get('dependencyView') ?? '').trim().toLowerCase();
  const dependencyViewBase: DependencyView | undefined =
    dependencyViewRaw === 'edit'
      ? 'edit'
      : dependencyViewRaw === 'overview'
        ? 'overview'
        : dependencyViewRaw === 'create'
          ? 'create'
          : dependencyViewRaw === 'search'
            ? 'search'
            : undefined;
  const dependencyView: DependencyView | undefined = dependencyViewBase ?? (dependencyGraphId ? 'overview' : 'search');

  if (!section) {
    return { libraryId, target: 'library_overview' };
  }

  if (section === 'cards') {
    return { libraryId, target: 'all_cards', cardMode: 'list' };
  }

  if (section === 'infos' || section === 'notions') {
    const infoId = sectionArg1;
    if (!infoId) {
      return { libraryId, target: 'all_cards', cardMode: 'list' };
    }
    if (infoId === 'new') {
      return { libraryId, target: 'new_card' };
    }
    if (sectionArg2 === 'edit') {
      return { libraryId, target: 'new_card', infoId };
    }
    if (sectionArg2 === 'checkcards' || sectionArg2 === 'cards') {
      return { libraryId, target: 'all_cards', cardMode: 'list', infoId, infoView: 'cards' };
    }
    if (sectionArg2 === 'collections') {
      return { libraryId, target: 'all_cards', cardMode: 'list', infoId, infoView: 'collections' };
    }
    return { libraryId, target: 'all_cards', cardMode: 'list', infoId, infoView: 'overview' };
  }

  if (section === 'revisions') {
    const revisionId = sectionArg1;
    if (!revisionId) {
      return { libraryId, target: 'all_revisions', filterCollectionId };
    }
    if (revisionId === 'live-sessions') {
      return { libraryId, target: 'all_revisions', revisionView: 'live', liveSessionView: 'list', filterCollectionId };
    }
    if (revisionId === 'new') {
      return { libraryId, target: 'all_revisions', revisionView: 'new', filterCollectionId };
    }
    if (revisionId === 'run') {
      return { libraryId, target: 'all_revisions', filterCollectionId };
    }
    if (sectionArg2 === 'run') {
      return { libraryId, target: 'all_revisions', revisionId, revisionView: 'detail', filterCollectionId };
    }
    if (sectionArg2 === 'shared') {
      return { libraryId, target: 'all_revisions', revisionId, revisionView: 'detail', filterCollectionId };
    }
    if (sectionArg2 === 'edit') {
      return { libraryId, target: 'all_revisions', revisionId, revisionView: 'settings', filterCollectionId };
    }
    if (sectionArg2 === 'live-sessions') {
      const liveSessionId = sectionArg3;
      if (!liveSessionId) {
        return { libraryId, target: 'all_revisions', revisionId, revisionView: 'live', liveSessionView: 'list', filterCollectionId };
      }
      if (liveSessionId === 'new') {
        return { libraryId, target: 'all_revisions', revisionId, revisionView: 'live', liveSessionView: 'new', filterCollectionId };
      }
      if (sectionArg4 === 'edit') {
        return {
          libraryId,
          target: 'all_revisions',
          revisionId,
          revisionView: 'live',
          liveSessionId,
          liveSessionView: 'edit',
          filterCollectionId
        };
      }
      return {
        libraryId,
        target: 'all_revisions',
        revisionId,
        revisionView: 'live',
        liveSessionId,
        liveSessionView: 'detail',
        filterCollectionId
      };
    }
    return { libraryId, target: 'all_revisions', revisionId, revisionView: 'detail', filterCollectionId };
  }

  if (section === 'dependencies') {
    return {
      libraryId,
      target: 'dependencies',
      dependencyGraphId,
      dependencyView: dependencyView ?? 'search',
      dependencyTransferToken
    };
  }

  if (section === 'transfer') {
    return { libraryId, target: 'transfer' };
  }

  if (section === 'storyboards') {
    if (sectionArg1 === 'new') {
      return { libraryId, target: 'new_storyboard', storyboardView: 'create' };
    }
    if (sectionArg1) {
      if (sectionArg2 === 'edit') {
        return { libraryId, target: 'storyboards', storyboardId: sectionArg1, storyboardView: 'edit' };
      }
      return { libraryId, target: 'storyboards', storyboardId: sectionArg1, storyboardView: 'overview' };
    }
    return { libraryId, target: 'storyboards', storyboardView: 'search' };
  }

  if (section === 'texts' || section === 'writings') {
    if (sectionArg1 === 'new') {
      return { libraryId, target: 'new_text' };
    }
    return { libraryId, target: 'texts' };
  }

  if (section !== 'collections') {
    return { libraryId, target: 'library_overview' };
  }

  const collectionId = sectionArg1;
  if (!collectionId) {
    return { libraryId, target: 'all_collections' };
  }
  if (collectionId === 'new') {
    return { libraryId, target: 'new_collection' };
  }
  if (sectionArg2 === 'edit') {
    return { libraryId, target: 'all_collections', collectionId, revisionView: 'graph' };
  }
  if (sectionArg2 === 'revisions') {
    return { libraryId, target: 'all_revisions', collectionId, filterCollectionId: collectionId };
  }
  if (sectionArg2 === 'infos' || sectionArg2 === 'notions' || sectionArg2 === 'cards') {
    return { libraryId, target: 'all_cards', collectionId, cardMode: 'list', filterCollectionId: collectionId };
  }
  return { libraryId, target: 'all_collections', collectionId, revisionView: 'detail', collectionView: 'overview' };
}

function buildCogitaPath(
  libraryId?: string,
  target: CogitaTarget = 'library_overview',
  collectionId?: string,
  revisionView?: RevisionView,
  revisionId?: string,
  liveSessionId?: string,
  liveSessionView: LiveSessionView = 'list',
  infoId?: string,
  infoView: 'overview' | 'cards' | 'collections' = 'overview',
  collectionView: 'overview' | 'infos' = 'infos',
  filterCollectionId?: string,
  dependencyGraphId?: string,
  dependencyView: DependencyView = 'search',
  dependencyTransferToken?: string,
  storyboardId?: string,
  storyboardView: StoryboardView = 'search'
): string {
  const workspaceBase = `/cogita/workspace/libraries/${libraryId}`;

  const buildRevisionPath = (id?: string, view?: RevisionView) => {
    if (!id) {
      if (view === 'new') return `${workspaceBase}/revisions/${view}`;
      if (view === 'live') return `${workspaceBase}/revisions/live-sessions`;
      return `${workspaceBase}/revisions`;
    }
    if (view === 'settings') return `${workspaceBase}/revisions/${id}/edit`;
    if (view === 'live') {
      if (liveSessionView === 'new') {
        return `${workspaceBase}/revisions/${id}/live-sessions/new`;
      }
      if (liveSessionId) {
        return liveSessionView === 'edit'
          ? `${workspaceBase}/revisions/${id}/live-sessions/${liveSessionId}/edit`
          : `${workspaceBase}/revisions/${id}/live-sessions/${liveSessionId}`;
      }
      return `${workspaceBase}/revisions/${id}/live-sessions`;
    }
    return `${workspaceBase}/revisions/${id}`;
  };

  if (!libraryId) {
    return '/cogita/workspace';
  }
  if (target === 'library_overview') {
    return workspaceBase;
  }
  if (target === 'all_cards') {
    if (filterCollectionId && !infoId) {
      return `${workspaceBase}/collections/${filterCollectionId}/cards`;
    }
    if (infoId) {
      if (infoView === 'cards') {
        return `${workspaceBase}/notions/${infoId}/cards`;
      }
      if (infoView === 'collections') {
        return `${workspaceBase}/notions/${infoId}/collections`;
      }
      return `${workspaceBase}/notions/${infoId}`;
    }
    return `${workspaceBase}/cards`;
  }
  if (target === 'new_card') {
    if (infoId) {
      return `${workspaceBase}/notions/${infoId}/edit`;
    }
    return `${workspaceBase}/notions/new`;
  }
  if (target === 'all_revisions') {
    if (filterCollectionId && !revisionId && (!revisionView || revisionView === 'settings')) {
      return `${workspaceBase}/collections/${filterCollectionId}/revisions`;
    }
    return buildRevisionPath(revisionId, revisionView);
  }
  if (target === 'all_collections') {
    if (revisionView === 'settings' || revisionView === 'live' || revisionView === 'new') {
      return buildRevisionPath(revisionId, revisionView);
    }
    if (!collectionId) {
      return `${workspaceBase}/collections`;
    }
    if (revisionView === 'graph') {
      return `${workspaceBase}/collections/${collectionId}/edit`;
    }
    return collectionView === 'infos'
      ? `${workspaceBase}/collections/${collectionId}/notions`
      : `${workspaceBase}/collections/${collectionId}`;
  }
  if (target === 'new_collection') {
    return `${workspaceBase}/collections/new`;
  }
  if (target === 'transfer') {
    return `${workspaceBase}/transfer`;
  }
  if (target === 'storyboards') {
    if (storyboardView === 'create') {
      return `${workspaceBase}/storyboards/new`;
    }
    if (storyboardId) {
      const encodedStoryboardId = encodeURIComponent(storyboardId);
      return storyboardView === 'edit'
        ? `${workspaceBase}/storyboards/${encodedStoryboardId}/edit`
        : `${workspaceBase}/storyboards/${encodedStoryboardId}`;
    }
    return `${workspaceBase}/storyboards`;
  }
  if (target === 'new_storyboard') {
    return `${workspaceBase}/storyboards/new`;
  }
  if (target === 'texts') {
    return `${workspaceBase}/writings`;
  }
  if (target === 'new_text') {
    return `${workspaceBase}/writings/new`;
  }
  if (target === 'dependencies') {
    const params = new URLSearchParams();
    if (filterCollectionId) params.set('filterCollectionId', filterCollectionId);
    if (dependencyGraphId) params.set('graphId', dependencyGraphId);
    if (dependencyView !== 'search') params.set('dependencyView', dependencyView);
    if (dependencyTransferToken) params.set('transfer', dependencyTransferToken);
    const qs = params.toString();
    return `${workspaceBase}/dependencies${qs ? `?${qs}` : ''}`;
  }
  return workspaceBase;
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const normalized = normalizePath(location.pathname);
    if (!normalized.startsWith('/cogita/workspace')) {
      return;
    }
    const nextPath = `${normalized}${location.search ?? ''}`;
    window.localStorage.setItem(WORKSPACE_LAST_PATH_KEY, nextPath);
  }, [location.pathname, location.search]);

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
  const [status, setStatus] = useState<string | null>(null);
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [headerReviewers, setHeaderReviewers] = useState<CogitaReviewer[]>([]);
  const [selectedReviewerRoleId, setSelectedReviewerRoleId] = useState('');
  const [reviewersReloadTick, setReviewersReloadTick] = useState(0);
  const [revisionLiveSessions, setRevisionLiveSessions] = useState<CogitaLiveRevisionSessionListItem[]>([]);
  const [dependencyGraphs, setDependencyGraphs] = useState<CogitaDependencyGraphSummary[]>([]);
  const [storyboards, setStoryboards] = useState<CogitaCreationProject[]>([]);

  const [preferenceRoleId, setPreferenceRoleId] = useState<string | null>(null);
  const [preferenceDataItemId, setPreferenceDataItemId] = useState<string | null>(null);
  const prefsRef = useRef<CogitaPreferences>({ version: 1, byLibrary: {} });
  const collectionsCacheRef = useRef<Record<string, CogitaCollectionSummary[]>>({});
  const infosCacheRef = useRef<Record<string, CogitaInfoSearchResult[]>>({});
  const revisionsCacheRef = useRef<Record<string, CogitaRevision[]>>({});
  const liveSessionsCacheRef = useRef<Record<string, CogitaLiveRevisionSessionListItem[]>>({});
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

  const normalizedWorkspacePath = normalizePath(location.pathname);
  const isPersonsPage =
    normalizedWorkspacePath === '/cogita/persons' ||
    normalizedWorkspacePath === '/cogita/workspace/persons';

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
  const selectedLiveSession = useMemo(
    () => revisionLiveSessions.find((session) => session.sessionId === pathState.liveSessionId) ?? null,
    [pathState.liveSessionId, revisionLiveSessions]
  );
  const selectedDependencyGraph = useMemo(
    () => dependencyGraphs.find((graph) => graph.graphId === pathState.dependencyGraphId) ?? null,
    [dependencyGraphs, pathState.dependencyGraphId]
  );
  const selectedStoryboard = useMemo(
    () => storyboards.find((storyboard) => storyboard.projectId === pathState.storyboardId) ?? null,
    [pathState.storyboardId, storyboards]
  );
  const displayTarget = useMemo<CogitaTarget>(() => {
    if (selectedTarget === 'new_card') return 'all_cards';
    if (selectedTarget === 'new_collection') return 'all_collections';
    if (selectedTarget === 'new_storyboard') return 'storyboards';
    if (selectedTarget === 'new_text') return 'texts';
    return selectedTarget;
  }, [selectedTarget]);
  const displayRevisionView = useMemo<RevisionView>(() => (selectedRevisionView === 'new' ? 'settings' : selectedRevisionView), [selectedRevisionView]);
  const collectionMode = useMemo<CollectionMode>(() => {
    if (selectedTarget === 'new_collection') return 'create';
    if (selectedTarget === 'all_collections' && selectedCollectionId) return 'selected';
    return 'search';
  }, [selectedCollectionId, selectedTarget]);
  const infoMode = useMemo<InfoMode>(() => {
    if (pathState.infoId) return 'selected';
    if (selectedTarget === 'new_card') return 'create';
    return 'search';
  }, [pathState.infoId, selectedTarget]);
  const revisionMode = useMemo<RevisionMode>(() => {
    if (displayRevisionView === 'live' && !selectedRevisionId) return 'live_sessions';
    if (selectedRevisionView === 'new') return 'create';
    if (selectedRevisionId) return 'selected';
    return 'search';
  }, [displayRevisionView, selectedRevisionId, selectedRevisionView]);
  const liveSessionMode = useMemo<LiveSessionMode>(() => {
    if (displayRevisionView !== 'live') return 'search';
    if (pathState.liveSessionView === 'new') return 'create';
    if (pathState.liveSessionId) return 'selected';
    return 'search';
  }, [displayRevisionView, pathState.liveSessionId, pathState.liveSessionView]);
  const dependencyMode = useMemo<DependencyMode>(() => {
    if (pathState.dependencyView === 'create') return 'create';
    if (pathState.dependencyView === 'search') return 'search';
    if (pathState.dependencyGraphId) return 'selected';
    return 'search';
  }, [pathState.dependencyGraphId, pathState.dependencyView]);
  const storyboardMode = useMemo<StoryboardMode>(() => {
    if (selectedTarget === 'new_storyboard' || pathState.storyboardView === 'create') return 'create';
    if (pathState.storyboardId) return 'selected';
    return 'search';
  }, [pathState.storyboardId, pathState.storyboardView, selectedTarget]);
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

  useEffect(() => {
    if (!selectedLibraryId || displayTarget !== 'storyboards') {
      setStoryboards([]);
      return;
    }

    let cancelled = false;
    getCogitaCreationProjects({ libraryId: selectedLibraryId, projectType: 'storyboard' })
      .then((projects) => {
        if (cancelled) return;
        setStoryboards(projects);
      })
      .catch(() => {
        if (cancelled) return;
        setStoryboards([]);
      });

    return () => {
      cancelled = true;
    };
  }, [displayTarget, selectedLibraryId]);
  const hasLibrarySelection = Boolean(selectedLibraryId);
  const tutorialSlides = useMemo<TutorialSlide[]>(() => {
    const quickStart =
      language === 'pl'
        ? 'Ruch na teraz: utwórz bibliotekę i wpisz pierwszy element wiedzy.'
        : language === 'de'
          ? 'Nächster Schritt: Erstelle eine Bibliothek und füge den ersten Wissenseintrag hinzu.'
          : 'Next action: create one library and add your first notion.';

    if (language === 'pl') {
      return [
        { step: 'Krok 1', title: 'Czym jest Cogita?', lead: 'To centrum budowania i prowadzenia procesu nauki po zalogowaniu.', passages: ['W jednym miejscu łączysz treści, ćwiczenia i współpracę zespołu.', 'Zamiast luźnych notatek dostajesz spójny przepływ: biblioteka → kolekcja → powtórka.'], focus: ['Jedna przestrzeń robocza', 'Spójny proces'], action: quickStart },
        { step: 'Krok 2', title: 'Zacznij od biblioteki', lead: 'Biblioteka jest bazą dla całego tematu.', passages: ['Nazwij bibliotekę jasno: np. „Historia Kościoła – semestr 1”.', 'Każdy kolejny moduł korzysta z tej samej biblioteki jako źródła.'], focus: ['Nazwa tematyczna', 'Jeden punkt startowy'], action: quickStart },
        { step: 'Krok 3', title: 'Dodawaj elementy wiedzy', lead: 'Twórz krótkie, konkretne jednostki wiedzy.', passages: ['Elementy wiedzy opisują pojęcia, osoby, źródła i cytaty.', 'Małe jednostki łatwiej łączyć, powtarzać i aktualizować.'], focus: ['Krótko i konkretnie', 'Łatwe aktualizacje'], action: quickStart },
        { step: 'Krok 4', title: 'Pracuj na typach', lead: 'Formularze dostosowują się do rodzaju elementu wiedzy.', passages: ['Każdy typ pokazuje właściwe pola i porządkuje dane.', 'To zmniejsza chaos i poprawia jakość wyszukiwania.'], focus: ['Lepsza struktura', 'Mniej błędów'], action: quickStart },
        { step: 'Krok 5', title: 'Łącz wiedzę linkami', lead: 'Buduj kontekst przez relacje między wpisami.', passages: ['Połącz temat z definicją, źródłem i przykładem.', 'Graf relacji pomaga zobaczyć, czego brakuje przed kolejnym etapem.'], focus: ['Relacje między wpisami', 'Pełniejszy kontekst'], action: quickStart },
        { step: 'Krok 6', title: 'Twórz kolekcje celu', lead: 'Kolekcja grupuje wpisy pod konkretny scenariusz.', passages: ['Osobna kolekcja dla lekcji, osobna dla quizu lub egzaminu.', 'Nie duplikujesz treści — tylko wybierasz, co jest potrzebne.'], focus: ['Celowe grupowanie', 'Bez duplikatów'], action: quickStart },
        { step: 'Krok 7', title: 'Dodawaj powtórki', lead: 'Powtórka definiuje jak przebiega sprawdzanie.', passages: ['Ustaw tempo, kolejność i zakres materiału.', 'Dla jednej kolekcji możesz mieć kilka powtórek o różnych poziomach.'], focus: ['Kontrola tempa', 'Różne poziomy'], action: quickStart },
        { step: 'Krok 8', title: 'Element wiedzy vs karta', lead: 'Rozróżniaj źródło wiedzy i widok ćwiczeniowy.', passages: ['Element wiedzy to rekord bazowy, który przechowuje treść.', 'Karta to forma pytania/utrwalenia generowana z elementu wiedzy.'], focus: ['Źródło danych', 'Widok ćwiczeń'], action: quickStart },
        { step: 'Krok 9', title: 'Uruchamiaj sesję', lead: 'Tryb Run prowadzi uczestników krok po kroku.', passages: ['Prowadzący kontroluje rytm i przejścia między etapami.', 'Uczestnicy mają jasny przebieg bez zgadywania, co dalej.'], focus: ['Płynny przebieg', 'Lepsza dynamika grupy'], action: quickStart },
        { step: 'Krok 10', title: 'Czytaj graf zależności', lead: 'Graf pokazuje priorytety nauki.', passages: ['Węzły centralne oznaczają tematy, które wpływają na wiele innych.', 'Najpierw utrwal fundamenty, potem przechodź do warstw zaawansowanych.'], focus: ['Priorytety materiału', 'Lepsza kolejność'], action: quickStart },
        { step: 'Krok 11', title: 'Storyboard i teksty', lead: 'Plan i notatki trzymaj blisko wiedzy źródłowej.', passages: ['Storyboard układa narrację i przebieg spotkania.', 'Teksty zbierają komentarze, wnioski i gotowe treści do publikacji.'], focus: ['Lepsze przygotowanie', 'Notatki w kontekście'], action: quickStart },
        { step: 'Krok 12', title: 'Udostępniaj bezpiecznie', lead: 'Dziel się materiałem bez utraty kontroli.', passages: ['Możesz dać dostęp tylko do odczytu dla wybranych osób.', 'Edycja pozostaje po stronie autora lub zespołu prowadzącego.'], focus: ['Kontrola uprawnień', 'Bezpieczne współdzielenie'], action: quickStart },
        { step: 'Krok 13', title: 'Nawiguj warstwowo', lead: 'Sidebar i breadcrumb prowadzą przez poziomy.', passages: ['Zawsze widzisz, czy pracujesz na bibliotece, kolekcji czy powtórce.', 'Mniej kliknięć „w ciemno”, więcej świadomej nawigacji.'], focus: ['Orientacja w systemie', 'Szybsze decyzje'], action: quickStart },
        { step: 'Krok 14', title: 'Plan wdrożenia 30 minut', lead: 'Najpierw prosty pilot, potem rozwijaj.', passages: ['Plan: 1 biblioteka, 10 elementów wiedzy, 1 kolekcja, 1 powtórka testowa.', 'Po pierwszej sesji popraw strukturę i dodaj kolejne scenariusze.'], focus: ['Szybki start', 'Iteracyjne doskonalenie'], action: 'Gotowe? Załóż bibliotekę po prawej i przejdź do pierwszego wpisu.' }
      ];
    }

    if (language === 'de') {
      return [
        { step: 'Schritt 1', title: 'Was ist Cogita?', lead: 'Ein zentraler Workspace für Lernen und Moderation nach dem Login.', passages: ['Du verbindest Inhalte, Übungen und Teamarbeit in einem Ablauf.', 'Der Prozess bleibt klar: Bibliothek → Sammlung → Wiederholung.'], focus: ['Ein Workspace', 'Klarer Ablauf'], action: quickStart },
        { step: 'Schritt 2', title: 'Mit Bibliothek starten', lead: 'Die Bibliothek ist der Startpunkt für dein Thema.', passages: ['Vergib einen klaren Namen für Kurs oder Modul.', 'Alle weiteren Bereiche greifen auf diese Basis zu.'], focus: ['Sauberer Start', 'Gemeinsame Basis'], action: quickStart },
        { step: 'Schritt 3', title: 'Wissenseinträge anlegen', lead: 'Erfasse Wissen in kleinen, klaren Einträgen.', passages: ['Wissenseinträge enthalten Begriffe, Personen, Quellen und Zitate.', 'Kleinere Einheiten lassen sich besser verknüpfen und trainieren.'], focus: ['Kleine Einheiten', 'Leicht wartbar'], action: quickStart },
        { step: 'Schritt 4', title: 'Typbasierte Eingabe', lead: 'Formulare passen sich automatisch dem Wissens-Typ an.', passages: ['Dadurch bleiben Daten strukturiert und konsistent.', 'Das verbessert Qualität und Auffindbarkeit.'], focus: ['Konsistenz', 'Bessere Suche'], action: quickStart },
        { step: 'Schritt 5', title: 'Wissen verlinken', lead: 'Verbinde Einträge zu einem Kontextnetz.', passages: ['Thema, Quelle und Beispiel werden als Beziehung sichtbar.', 'So erkennst du Lücken vor der nächsten Lernphase.'], focus: ['Kontextnetz', 'Lücken erkennen'], action: quickStart },
        { step: 'Schritt 6', title: 'Ziel-Sammlungen bauen', lead: 'Eine Sammlung bündelt Inhalte für einen konkreten Zweck.', passages: ['Nutze getrennte Sammlungen für Unterricht, Quiz oder Prüfung.', 'Du wählst Inhalte aus statt sie zu kopieren.'], focus: ['Zielorientierung', 'Keine Duplikate'], action: quickStart },
        { step: 'Schritt 7', title: 'Wiederholungen erstellen', lead: 'Wiederholungen definieren den Prüfungsablauf.', passages: ['Tempo, Reihenfolge und Umfang sind pro Wiederholung steuerbar.', 'Mehrere Wiederholungen pro Sammlung sind möglich.'], focus: ['Ablaufsteuerung', 'Mehrere Niveaus'], action: quickStart },
        { step: 'Schritt 8', title: 'Wissenseintrag und Karte', lead: 'Datenobjekt und Trainingsansicht sind getrennt.', passages: ['Der Wissenseintrag ist die Quelle der Inhalte.', 'Die Karte ist die Übungsansicht für Frage und Antwort.'], focus: ['Sauberes Modell', 'Wiederverwendbar'], action: quickStart },
        { step: 'Schritt 9', title: 'Sitzung durchführen', lead: 'Im Run-Modus führst du die Gruppe Schritt für Schritt.', passages: ['Moderation steuert Übergänge und Timing.', 'Teilnehmende folgen einem klaren Ablauf.'], focus: ['Klare Moderation', 'Stabile Dynamik'], action: quickStart },
        { step: 'Schritt 10', title: 'Abhängigkeitsgraph lesen', lead: 'Der Graph zeigt Lernprioritäten.', passages: ['Zentrale Knoten beeinflussen viele weitere Themen.', 'Starte mit Grundlagen und baue danach auf.'], focus: ['Priorisierung', 'Lernreihenfolge'], action: quickStart },
        { step: 'Schritt 11', title: 'Storyboard & Texte', lead: 'Plane Ablauf und sammle Notizen im selben Kontext.', passages: ['Storyboards strukturieren Sequenzen und Rollen.', 'Texte halten Erkenntnisse und veröffentlichungsreife Inhalte fest.'], focus: ['Planung', 'Dokumentation'], action: quickStart },
        { step: 'Schritt 12', title: 'Sicher teilen', lead: 'Teile Inhalte ohne Kontrollverlust.', passages: ['Leserechte sind separat von Bearbeitungsrechten steuerbar.', 'So bleibt der Kernbestand geschützt.'], focus: ['Rechtekontrolle', 'Sicheres Teilen'], action: quickStart },
        { step: 'Schritt 13', title: 'Ebenen-Navigation', lead: 'Sidebar und Breadcrumb zeigen deinen aktuellen Kontext.', passages: ['Du siehst sofort, auf welcher Ebene du arbeitest.', 'Das spart Zeit und reduziert Fehlklicks.'], focus: ['Orientierung', 'Effizienz'], action: quickStart },
        { step: 'Schritt 14', title: '30-Minuten-Startplan', lead: 'Starte klein und erweitere iterativ.', passages: ['Plan: 1 Bibliothek, 10 Wissenseinträge, 1 Sammlung, 1 Test-Wiederholung.', 'Nach der ersten Runde verbesserst du Struktur und Ablauf.'], focus: ['Schneller Einstieg', 'Iteratives Vorgehen'], action: 'Jetzt starten: Bibliothek rechts anlegen und den ersten Eintrag erfassen.' }
      ];
    }

    return [
      { step: 'Step 1', title: 'What is Cogita?', lead: 'A post-login workspace to design, run, and improve knowledge journeys.', passages: ['You can keep content, training flow, and collaboration in one place.', 'The path stays explicit: library → collection → revision → session.'], focus: ['Single workspace', 'Clear learning flow'], action: quickStart },
      { step: 'Step 2', title: 'Start with a library', lead: 'Your library is the root container for one domain or program.', passages: ['Name it after your course, cohort, or topic scope.', 'Every next module reuses this foundation.'], focus: ['Root container', 'Consistent base'], action: quickStart },
      { step: 'Step 3', title: 'Add notions', lead: 'Build knowledge from small, reusable notion entries.', passages: ['Capture terms, references, people, concepts, and citations.', 'Smaller entries are easier to link, review, and update.'], focus: ['Reusable units', 'Easy maintenance'], action: quickStart },
      { step: 'Step 4', title: 'Use type-based forms', lead: 'Each notion type has a matching data structure and fields.', passages: ['Form layouts adapt automatically to the selected type.', 'This improves consistency and lowers input mistakes.'], focus: ['Structured input', 'Fewer errors'], action: quickStart },
      { step: 'Step 5', title: 'Link the knowledge graph', lead: 'Relationships turn isolated facts into usable context.', passages: ['Connect topics, sources, and supporting examples.', 'Dependency links show what must be learned first.'], focus: ['Context building', 'Better sequencing'], action: quickStart },
      { step: 'Step 6', title: 'Build goal collections', lead: 'Collections package selected notions for a concrete objective.', passages: ['Create separate collections for class, quiz, exam, or workshop.', 'You curate from existing entries instead of duplicating content.'], focus: ['Goal-oriented sets', 'No duplication'], action: quickStart },
      { step: 'Step 7', title: 'Create revisions', lead: 'Revisions define how practice and checking should run.', passages: ['Set pacing, order, and scope for each session style.', 'One collection can host multiple revision strategies.'], focus: ['Practice design', 'Multiple modes'], action: quickStart },
      { step: 'Step 8', title: 'Notion vs card', lead: 'Data objects and practice views are intentionally separate.', passages: ['A notion is the canonical source object.', 'A card is the generated training/checking view.'], focus: ['Clear model', 'Reusable content'], action: quickStart },
      { step: 'Step 9', title: 'Run live sessions', lead: 'Run mode helps facilitators guide each step with control.', passages: ['Move through prompts, responses, and timing intentionally.', 'Participants get a predictable and focused session rhythm.'], focus: ['Facilitator control', 'Group clarity'], action: quickStart },
      { step: 'Step 10', title: 'Read dependency graphs', lead: 'Graph views expose prerequisites and high-impact nodes.', passages: ['Central nodes usually deserve priority in onboarding.', 'Use this to plan revision order and reduce confusion.'], focus: ['Priority mapping', 'Smarter progression'], action: quickStart },
      { step: 'Step 11', title: 'Use storyboards and texts', lead: 'Plan narratives and keep notes near source knowledge.', passages: ['Storyboards model session structure and transitions.', 'Texts capture outcomes, drafts, and reusable explanations.'], focus: ['Planning layer', 'Contextual notes'], action: quickStart },
      { step: 'Step 12', title: 'Share safely', lead: 'Share read access without losing editorial control.', passages: ['Keep editing rights restricted to owners or maintainers.', 'Collaborators can consume material while core data stays protected.'], focus: ['Access control', 'Safe collaboration'], action: quickStart },
      { step: 'Step 13', title: 'Navigate by layers', lead: 'Sidebar and breadcrumb make system depth understandable.', passages: ['You always know whether you are at library, collection, or revision level.', 'Clear location awareness reduces wrong actions.'], focus: ['Fast orientation', 'Lower friction'], action: quickStart },
      { step: 'Step 14', title: '30-minute launch plan', lead: 'Start with a minimum viable setup, then iterate.', passages: ['Plan: create 1 library, add 10 notions, build 1 collection, run 1 revision.', 'After the first run, refine structure and scale by scenario.'], focus: ['Immediate execution', 'Iterative improvement'], action: 'Ready now? Create your first library on the right and start adding knowledge.' }
    ];
  }, [language]);
  const tutorialTotal = tutorialSlides.length;
  const safeTutorialIndex = Math.max(0, Math.min(tutorialIndex, tutorialTotal - 1));
  const activeTutorialSlide = tutorialSlides[safeTutorialIndex];
  const hasCollectionSelection = Boolean(selectedCollectionId);
  const showCollectionLayer = hasLibrarySelection && displayTarget === 'all_collections';
  const showCollectionActionLayer =
    showCollectionLayer && selectedTarget === 'all_collections' && hasCollectionSelection;
  const isRevisionBranchActive =
    hasLibrarySelection &&
    (displayTarget === 'all_revisions' ||
      (displayTarget === 'all_collections' &&
        hasCollectionSelection &&
        (selectedRevisionView === 'new' ||
          Boolean(selectedRevisionId) ||
          displayRevisionView === 'settings' ||
          displayRevisionView === 'live')));
  const showRevisionLayer = isRevisionBranchActive;
  const showRevisionActionLayer = isRevisionBranchActive && Boolean(selectedRevisionId);
  const applyNavigationSelection = useCallback(
    (next: {
      libraryId?: string;
      target: CogitaTarget;
      collectionId?: string;
      revisionId?: string;
      revisionView: RevisionView;
      liveSessionId?: string;
      liveSessionView?: LiveSessionView;
      infoId?: string;
      infoView?: 'overview' | 'cards' | 'collections';
      collectionView?: 'overview' | 'infos';
      filterCollectionId?: string;
      dependencyGraphId?: string;
      dependencyView?: DependencyView;
      dependencyTransferToken?: string;
    }) => {
      const hasLibrary = Boolean(next.libraryId);
      let resolvedTarget = next.target;
      let resolvedCollectionId = next.collectionId;
      let resolvedRevisionId = next.revisionId;
      let resolvedRevision = next.revisionView;
      let resolvedLiveSessionId = next.liveSessionId;
      let resolvedLiveSessionView = next.liveSessionView ?? pathState.liveSessionView ?? 'list';
      let resolvedInfoId = next.infoId;
      let resolvedInfoView = next.infoView ?? pathState.infoView ?? 'overview';
      let resolvedCollectionView = next.collectionView ?? pathState.collectionView ?? 'infos';
      let resolvedFilterCollectionId = next.filterCollectionId ?? pathState.filterCollectionId;
      const hasExplicitDependencyGraphId = Object.prototype.hasOwnProperty.call(next, 'dependencyGraphId');
      let resolvedDependencyGraphId = hasExplicitDependencyGraphId ? next.dependencyGraphId : pathState.dependencyGraphId;
      let resolvedDependencyView = next.dependencyView ?? pathState.dependencyView ?? 'search';
      let resolvedDependencyTransferToken = next.dependencyTransferToken ?? pathState.dependencyTransferToken;

      if (!hasLibrary) {
        resolvedTarget = 'library_overview';
        resolvedCollectionId = undefined;
        resolvedRevisionId = undefined;
        resolvedRevision = 'detail';
        resolvedLiveSessionId = undefined;
        resolvedLiveSessionView = 'list';
        resolvedInfoId = undefined;
        resolvedInfoView = 'overview';
        resolvedCollectionView = 'infos';
        resolvedFilterCollectionId = undefined;
        resolvedDependencyGraphId = undefined;
        resolvedDependencyView = 'search';
        resolvedDependencyTransferToken = undefined;
      } else if (TARGET_CAPABILITIES[resolvedTarget].requiresCollection && !resolvedCollectionId) {
        resolvedTarget = resolvedTarget === 'all_revisions' ? 'all_revisions' : 'all_collections';
        resolvedRevisionId = undefined;
        resolvedRevision = 'detail';
        resolvedLiveSessionId = undefined;
        resolvedLiveSessionView = 'list';
        resolvedFilterCollectionId = undefined;
        resolvedDependencyGraphId = undefined;
        resolvedDependencyView = 'search';
        resolvedDependencyTransferToken = undefined;
      } else if (resolvedTarget !== 'all_collections' && resolvedTarget !== 'all_revisions') {
        resolvedCollectionId = undefined;
        resolvedRevisionId = undefined;
        resolvedLiveSessionId = undefined;
        resolvedLiveSessionView = 'list';
        if (resolvedTarget !== 'new_card' && resolvedTarget !== 'all_cards') {
          resolvedInfoId = undefined;
          resolvedInfoView = 'overview';
        }
        if (resolvedTarget !== 'new_collection') {
          resolvedCollectionView = 'infos';
        }
        resolvedFilterCollectionId = undefined;
        if (resolvedTarget !== 'dependencies') {
          resolvedDependencyGraphId = undefined;
          resolvedDependencyView = 'search';
          resolvedDependencyTransferToken = undefined;
        }
      } else if (!TARGET_CAPABILITIES[resolvedTarget].allowsRevision) {
        resolvedRevision = 'detail';
      } else if (!REVISION_SELECTION_VIEWS.includes(resolvedRevision)) {
        resolvedRevisionId = undefined;
        resolvedLiveSessionId = undefined;
        resolvedLiveSessionView = 'list';
      }
      if (resolvedTarget !== 'all_cards' && resolvedTarget !== 'all_revisions') {
        resolvedFilterCollectionId = undefined;
      }
      if (resolvedTarget !== 'dependencies') {
        resolvedDependencyGraphId = undefined;
        resolvedDependencyView = 'search';
        resolvedDependencyTransferToken = undefined;
      }

      if (resolvedTarget === 'dependencies') {
        if (resolvedDependencyView === 'search' || resolvedDependencyView === 'create') {
          resolvedDependencyGraphId = undefined;
        }
        if (resolvedDependencyView !== 'create') {
          resolvedDependencyTransferToken = undefined;
        }
        if (!resolvedDependencyGraphId && (resolvedDependencyView === 'overview' || resolvedDependencyView === 'edit')) {
          resolvedDependencyView = 'search';
        }
      }

      if (resolvedRevision !== 'live') {
        resolvedLiveSessionId = undefined;
        resolvedLiveSessionView = 'list';
      }
      if (!resolvedRevisionId && resolvedRevision === 'live') {
        resolvedRevision = 'settings';
        resolvedLiveSessionId = undefined;
        resolvedLiveSessionView = 'list';
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
          resolvedLiveSessionId,
          resolvedLiveSessionView,
          resolvedInfoId,
          resolvedInfoView,
          resolvedCollectionView,
          resolvedFilterCollectionId,
          resolvedDependencyGraphId,
          resolvedDependencyView,
          resolvedDependencyTransferToken
        )
      );
      const currentFullPath = normalizePath(`${location.pathname}${location.search ?? ''}`);
      if (currentFullPath === nextPath) return;
      lastNavigationRef.current = nextPath;
      navigate(nextPath);
    },
    [
      location.pathname,
      location.search,
      navigate,
      pathState.collectionView,
      pathState.dependencyGraphId,
      pathState.dependencyTransferToken,
      pathState.dependencyView,
      pathState.filterCollectionId,
      pathState.infoView,
      pathState.liveSessionView
    ]
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
            infoId: nextTarget === 'new_card' ? pathState.infoId : undefined,
            dependencyGraphId: nextTarget === 'dependencies' ? pathState.dependencyGraphId : undefined,
            dependencyView: nextTarget === 'dependencies' ? (pathState.dependencyView ?? 'search') : 'search'
          });
        }
      },
      {
        key: 'storyboard_mode',
        label: workspaceCopy.layers.target,
        visible: displayTarget === 'storyboards',
        value: storyboardMode,
        selectedLabel:
          storyboardMode === 'create'
            ? workspaceCopy.infoMode.create
            : storyboardMode === 'selected'
              ? (selectedStoryboard?.name ?? pathState.storyboardId ?? copy.cogita.library.modules.storyboardsTitle)
              : workspaceCopy.infoMode.search,
        disabled: !hasLibrarySelection,
        options: [
          { value: 'search', label: workspaceCopy.infoMode.search },
          { value: 'create', label: workspaceCopy.infoMode.create },
          ...(pathState.storyboardId
            ? [{ value: 'selected', label: selectedStoryboard?.name ?? pathState.storyboardId }]
            : [])
        ],
        onSelect: (value: string) => {
          if (!selectedLibraryId) return;
          if (value === 'create') {
            navigate(`/cogita/workspace/libraries/${encodeURIComponent(selectedLibraryId)}/storyboards/new`);
            return;
          }
          if (value === 'selected' && pathState.storyboardId) {
            const suffix = pathState.storyboardView === 'edit' ? '/edit' : '';
            navigate(
              `/cogita/workspace/libraries/${encodeURIComponent(selectedLibraryId)}/storyboards/${encodeURIComponent(pathState.storyboardId)}${suffix}`
            );
            return;
          }
          navigate(`/cogita/workspace/libraries/${encodeURIComponent(selectedLibraryId)}/storyboards`);
        }
      },
      {
        key: 'storyboard_selected_action',
        label: workspaceCopy.layers.target,
        visible: displayTarget === 'storyboards' && Boolean(pathState.storyboardId),
        value: pathState.storyboardView === 'edit' ? 'edit' : 'overview',
        selectedLabel:
          pathState.storyboardView === 'edit'
            ? workspaceCopy.infoActions.edit
            : workspaceCopy.infoActions.overview,
        disabled: !hasLibrarySelection || !pathState.storyboardId,
        options: [
          { value: 'overview', label: workspaceCopy.infoActions.overview },
          { value: 'edit', label: workspaceCopy.infoActions.edit }
        ],
        onSelect: (value: string) => {
          if (!selectedLibraryId || !pathState.storyboardId) return;
          const suffix = value === 'edit' ? '/edit' : '';
          navigate(
            `/cogita/workspace/libraries/${encodeURIComponent(selectedLibraryId)}/storyboards/${encodeURIComponent(pathState.storyboardId)}${suffix}`
          );
        }
      },
      {
        key: 'dependency_mode',
        label: workspaceCopy.layers.target,
        visible: displayTarget === 'dependencies',
        value: dependencyMode,
        selectedLabel:
          dependencyMode === 'selected'
            ? (selectedDependencyGraph?.name ?? workspaceCopy.targets.dependencies)
            : dependencyMode === 'create'
              ? workspaceCopy.infoMode.create
            : workspaceCopy.infoMode.search,
        disabled: !hasLibrarySelection,
        options: [
          { value: 'search', label: workspaceCopy.infoMode.search },
          { value: 'create', label: workspaceCopy.infoMode.create },
          ...(pathState.dependencyGraphId
            ? [{ value: 'selected', label: selectedDependencyGraph?.name ?? workspaceCopy.targets.dependencies }]
            : [])
        ],
        onSelect: (value: string) => {
          if (value === 'selected' && pathState.dependencyGraphId) {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: 'dependencies',
              collectionId: selectedCollectionId,
              revisionId: selectedRevisionId,
              revisionView: selectedRevisionView,
              dependencyGraphId: pathState.dependencyGraphId,
              dependencyView: pathState.dependencyView ?? 'overview'
            });
            return;
          }
          if (value === 'create') {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: 'dependencies',
              collectionId: selectedCollectionId,
              revisionId: selectedRevisionId,
              revisionView: selectedRevisionView,
              dependencyGraphId: undefined,
              dependencyView: 'create'
            });
            return;
          }
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: 'dependencies',
            collectionId: selectedCollectionId,
            revisionId: selectedRevisionId,
            revisionView: selectedRevisionView,
            dependencyGraphId: undefined,
            dependencyView: 'search'
          });
        }
      },
      {
        key: 'dependency_selected_action',
        label: workspaceCopy.layers.target,
        visible: displayTarget === 'dependencies' && Boolean(pathState.dependencyGraphId),
        value: pathState.dependencyView ?? 'overview',
        selectedLabel:
          (pathState.dependencyView ?? 'overview') === 'edit'
            ? workspaceCopy.infoActions.edit
            : workspaceCopy.infoActions.overview,
        disabled: !hasLibrarySelection || !pathState.dependencyGraphId,
        options: [
          { value: 'overview', label: workspaceCopy.infoActions.overview },
          { value: 'edit', label: workspaceCopy.infoActions.edit }
        ],
        onSelect: (value: string) => {
          if (!pathState.dependencyGraphId) return;
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: 'dependencies',
            collectionId: selectedCollectionId,
            revisionId: selectedRevisionId,
            revisionView: selectedRevisionView,
            dependencyGraphId: pathState.dependencyGraphId,
            dependencyView: value === 'edit' ? 'edit' : 'overview'
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
            : selectedTarget === 'dependencies'
            ? workspaceCopy.targets.dependencies
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
          { value: 'collections', label: 'Kolekcje' },
          { value: 'dependencies', label: workspaceCopy.targets.dependencies }
        ],
        onSelect: (value: string) => {
          if (!pathState.infoId) return;
          if (value === 'dependencies') {
            const token = createWorkspaceTransfer({
              kind: 'dependency_create_prefill',
              libraryId: selectedLibraryId ?? '',
              infos: [
                {
                  infoId: pathState.infoId,
                  label: selectedInfoOption?.label ?? selectedInfoLabel ?? pathState.infoId,
                  infoType: selectedInfoOption?.infoType ?? null
                }
              ]
            });
            if (!token) return;
            const query = new URLSearchParams({ transfer: token, dependencyView: 'create' });
            navigate(`/cogita/workspace/libraries/${selectedLibraryId}/dependencies?${query.toString()}`);
            return;
          }
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
        visible: showCollectionLayer,
        value: collectionMode,
        selectedLabel:
          collectionMode === 'create'
            ? copy.cogita.library.actions.createCollection
            : collectionMode === 'selected'
            ? (selectedCollection?.name ?? workspaceCopy.path.noCollectionSelected)
            : workspaceCopy.infoMode.search,
        disabled: !hasLibrarySelection,
        options: [
          { value: 'search', label: workspaceCopy.infoMode.search },
          { value: 'create', label: copy.cogita.library.actions.createCollection },
          ...(selectedCollectionId
            ? [{ value: 'selected', label: selectedCollection?.name ?? workspaceCopy.path.noCollectionSelected }]
            : [])
        ],
        onSelect: (value: string) => {
          if (value === 'selected' && selectedCollectionId) {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: 'all_collections',
              collectionId: selectedCollectionId,
              revisionId: undefined,
              revisionView: 'detail'
            });
            return;
          }
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
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: 'all_collections',
            collectionId: undefined,
            revisionId: undefined,
            revisionView: 'detail'
          });
        }
      },
      {
        key: 'collection_selected_action',
        label: workspaceCopy.layers.collection,
        visible: showCollectionActionLayer,
        value:
          displayRevisionView === 'graph'
            ? 'edit'
            : (displayRevisionView === 'settings' || displayRevisionView === 'live')
            ? 'revisions'
            : (pathState.collectionView ?? 'infos') === 'overview'
            ? 'overview'
            : 'infos',
        selectedLabel:
          displayRevisionView === 'graph'
            ? workspaceCopy.infoActions.edit
            : (displayRevisionView === 'settings' || displayRevisionView === 'live')
            ? workspaceCopy.targets.allRevisions
            : (pathState.collectionView ?? 'infos') === 'overview'
            ? workspaceCopy.infoActions.overview
            : workspaceCopy.targets.allCards,
        disabled: !selectedCollectionId,
        options: [
          { value: 'overview', label: workspaceCopy.infoActions.overview },
          { value: 'edit', label: workspaceCopy.infoActions.edit },
          { value: 'infos', label: workspaceCopy.targets.allCards },
          { value: 'revisions', label: workspaceCopy.targets.allRevisions }
        ],
        onSelect: (value: string) => {
          if (!selectedCollectionId) return;
          if (value === 'edit') {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: 'all_collections',
              collectionId: selectedCollectionId,
              revisionId: undefined,
              revisionView: 'graph'
            });
            return;
          }
          if (value === 'revisions') {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: 'all_revisions',
              collectionId: undefined,
              revisionId: undefined,
              revisionView: 'settings',
              filterCollectionId: selectedCollectionId
            });
            return;
          }
          if (value === 'infos') {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: 'all_cards',
              collectionId: selectedCollectionId,
              revisionId: undefined,
              revisionView: 'detail',
              filterCollectionId: selectedCollectionId
            });
            return;
          }
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: 'all_collections',
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
        key: 'revision_mode',
        label: workspaceCopy.layers.revision,
        visible: showRevisionLayer,
        value: revisionMode,
        selectedLabel:
          revisionMode === 'create'
            ? workspaceCopy.revisionForm.createAction
            : revisionMode === 'selected'
              ? (selectedRevision?.name ?? workspaceCopy.status.noRevisions)
              : revisionMode === 'live_sessions'
                ? workspaceCopy.sidebar.revisionParticipantSessionsHint
              : workspaceCopy.infoMode.search,
        disabled: displayTarget === 'all_revisions' ? !hasLibrarySelection : !hasCollectionSelection,
        options: [
          { value: 'search', label: workspaceCopy.infoMode.search },
          { value: 'create', label: workspaceCopy.revisionForm.createAction },
          ...(selectedRevisionId
            ? [{ value: 'selected', label: selectedRevision?.name ?? workspaceCopy.status.noRevisions }]
            : [])
        ],
        onSelect: (value: string) => {
          const isLibraryRevisionBranch = displayTarget === 'all_revisions';
          const nextTarget = isLibraryRevisionBranch ? 'all_revisions' : 'all_collections';
          const nextCollectionId = isLibraryRevisionBranch ? undefined : selectedCollectionId;
          if (value === 'selected' && selectedRevisionId) {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: nextTarget,
              collectionId: nextCollectionId,
              revisionId: selectedRevisionId,
              revisionView:
                displayRevisionView === 'live' || displayRevisionView === 'detail'
                  ? displayRevisionView
                  : 'settings'
            });
            return;
          }
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: nextTarget,
            collectionId: nextCollectionId,
            revisionId: undefined,
            revisionView: value === 'create' ? 'new' : 'settings'
          });
        }
      },
      {
        key: 'revision_selected_action',
        label: workspaceCopy.layers.revision,
        visible: showRevisionActionLayer,
        value:
          displayRevisionView === 'live'
                ? 'live'
              : displayRevisionView === 'settings'
                ? 'settings'
                : 'overview',
        selectedLabel:
          displayRevisionView === 'live'
                ? workspaceCopy.revisions.live
              : displayRevisionView === 'settings'
                ? workspaceCopy.infoActions.edit
                : workspaceCopy.infoActions.overview,
        disabled: !selectedRevisionId,
        options: [
          { value: 'overview', label: workspaceCopy.infoActions.overview },
          { value: 'settings', label: workspaceCopy.infoActions.edit },
          { value: 'live', label: workspaceCopy.revisions.live }
        ],
        onSelect: (value: string) => {
          if (!selectedRevisionId) return;
          const isLibraryRevisionBranch = displayTarget === 'all_revisions';
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: isLibraryRevisionBranch ? 'all_revisions' : 'all_collections',
            collectionId: isLibraryRevisionBranch ? undefined : selectedCollectionId,
            revisionId: selectedRevisionId,
            revisionView: value === 'live' ? 'live' : value === 'settings' ? 'settings' : 'detail'
          });
        }
      },
      {
        key: 'live_mode',
        label: workspaceCopy.revisions.live,
        visible: showRevisionActionLayer && displayRevisionView === 'live',
        value: liveSessionMode,
        selectedLabel:
          liveSessionMode === 'create'
            ? workspaceCopy.infoMode.create
            : liveSessionMode === 'selected'
              ? (selectedLiveSession?.title ?? pathState.liveSessionId ?? workspaceCopy.status.noRevisions)
              : workspaceCopy.infoMode.search,
        disabled: !selectedRevisionId,
        options: [
          { value: 'search', label: workspaceCopy.infoMode.search },
          { value: 'create', label: workspaceCopy.infoMode.create },
          ...(pathState.liveSessionId
            ? [{ value: 'selected', label: selectedLiveSession?.title ?? pathState.liveSessionId }]
            : [])
        ],
        onSelect: (value: string) => {
          if (!selectedRevisionId) return;
          const isLibraryRevisionBranch = displayTarget === 'all_revisions';
          if (value === 'create') {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: isLibraryRevisionBranch ? 'all_revisions' : 'all_collections',
              collectionId: isLibraryRevisionBranch ? undefined : selectedCollectionId,
              revisionId: selectedRevisionId,
              revisionView: 'live',
              liveSessionId: undefined,
              liveSessionView: 'new'
            });
            return;
          }
          if (value === 'selected' && pathState.liveSessionId) {
            applyNavigationSelection({
              libraryId: selectedLibraryId,
              target: isLibraryRevisionBranch ? 'all_revisions' : 'all_collections',
              collectionId: isLibraryRevisionBranch ? undefined : selectedCollectionId,
              revisionId: selectedRevisionId,
              revisionView: 'live',
              liveSessionId: pathState.liveSessionId,
              liveSessionView: 'detail'
            });
            return;
          }
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: isLibraryRevisionBranch ? 'all_revisions' : 'all_collections',
            collectionId: isLibraryRevisionBranch ? undefined : selectedCollectionId,
            revisionId: selectedRevisionId,
            revisionView: 'live',
            liveSessionId: undefined,
            liveSessionView: 'list'
          });
        }
      },
      {
        key: 'live_selected_action',
        label: workspaceCopy.revisions.live,
        visible: showRevisionActionLayer && displayRevisionView === 'live' && Boolean(pathState.liveSessionId),
        value: pathState.liveSessionView === 'edit' ? 'edit' : 'overview',
        selectedLabel: pathState.liveSessionView === 'edit' ? workspaceCopy.infoActions.edit : workspaceCopy.infoActions.overview,
        disabled: !selectedRevisionId || !pathState.liveSessionId,
        options: [
          { value: 'overview', label: workspaceCopy.infoActions.overview },
          { value: 'edit', label: workspaceCopy.infoActions.edit }
        ],
        onSelect: (value: string) => {
          if (!selectedRevisionId || !pathState.liveSessionId) return;
          const isLibraryRevisionBranch = displayTarget === 'all_revisions';
          applyNavigationSelection({
            libraryId: selectedLibraryId,
            target: isLibraryRevisionBranch ? 'all_revisions' : 'all_collections',
            collectionId: isLibraryRevisionBranch ? undefined : selectedCollectionId,
            revisionId: selectedRevisionId,
            revisionView: 'live',
            liveSessionId: pathState.liveSessionId,
            liveSessionView: value === 'edit' ? 'edit' : 'detail'
          });
        }
      }
    ],
    [
      collections,
      infoMode,
      infos,
      libraries,
      loading,
      applyNavigationSelection,
      navigate,
      revisions,
      selectedCollection,
      selectedCollectionId,
      selectedInfoOption,
      selectedRevision,
      selectedRevisionId,
      selectedLiveSession,
      selectedDependencyGraph,
      selectedInfoLabel,
      hasCollectionSelection,
      hasLibrarySelection,
      selectedLibrary,
      selectedLibraryId,
      selectedRevisionView,
      selectedTarget,
      displayRevisionView,
      displayTarget,
      selectedTargetLabel,
      storyboardMode,
      showCollectionLayer,
      showCollectionActionLayer,
      showRevisionLayer,
      showRevisionActionLayer,
      targetLabels,
      copy.cogita.library.list.selectedEmpty,
      pathState.infoId,
      pathState.infoView,
      pathState.collectionView,
      pathState.dependencyGraphId,
      pathState.dependencyView,
      pathState.filterCollectionId,
      pathState.liveSessionId,
      pathState.liveSessionView,
      pathState.storyboardId,
      pathState.storyboardView,
      selectedStoryboard?.name,
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
      workspaceCopy.targets.allCards,
      workspaceCopy.targets.allRevisions,
      workspaceCopy.targets.dependencies,
      copy.cogita.library.modules.storyboardsTitle,
      workspaceCopy.infoMode.create,
      workspaceCopy.infoMode.search,
      workspaceCopy.revisionForm.createAction,
      workspaceCopy.revisions.live,
      collectionMode,
      dependencyMode,
      revisionMode,
      liveSessionMode
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
  const sidebarDependencyModeLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'dependency_mode') ?? null,
    [sidebarActionLevels]
  );
  const sidebarDependencySelectedActionLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'dependency_selected_action') ?? null,
    [sidebarActionLevels]
  );
  const sidebarStoryboardModeLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'storyboard_mode') ?? null,
    [sidebarActionLevels]
  );
  const sidebarStoryboardSelectedActionLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'storyboard_selected_action') ?? null,
    [sidebarActionLevels]
  );
  const sidebarCollectionActionsLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'collection_mode') ?? null,
    [sidebarActionLevels]
  );
  const sidebarRevisionModeLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'revision_mode') ?? null,
    [sidebarActionLevels]
  );
  const sidebarSelectedCollectionActionsLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'collection_selected_action') ?? null,
    [sidebarActionLevels]
  );
  const sidebarRevisionActionsLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'revision_selected_action') ?? null,
    [sidebarActionLevels]
  );
  const sidebarLiveModeLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'live_mode') ?? null,
    [sidebarActionLevels]
  );
  const sidebarLiveSelectedActionLevel = useMemo(
    () => sidebarActionLevels.find((level) => level.key === 'live_selected_action') ?? null,
    [sidebarActionLevels]
  );
  const renderSidebarActions = useCallback(
    (
      level: NavigationLevel | null,
      keyPrefix: string
    ) => {
      if (!level) return null;
      return (
        <div className="cogita-sidebar-actions">
          {level.options.map((option) => {
            const optionPath = normalizePath((() => {
                if (level.key === 'library') {
                  return buildCogitaPath(option.value || undefined, 'library_overview', undefined, 'detail');
                }
                if (level.key === 'target') {
                  const nextTarget = option.value as CogitaTarget;
                  return buildCogitaPath(
                    selectedLibraryId,
                    nextTarget,
                    selectedCollectionId,
                    selectedRevisionView,
                    selectedRevisionId,
                    pathState.liveSessionId,
                    pathState.liveSessionView ?? 'list',
                    nextTarget === 'new_card' ? pathState.infoId : undefined,
                    pathState.infoView ?? 'overview',
                    pathState.collectionView ?? 'infos',
                    pathState.filterCollectionId,
                    nextTarget === 'dependencies' ? pathState.dependencyGraphId : undefined,
                    nextTarget === 'dependencies' ? (pathState.dependencyView ?? 'search') : 'search',
                    nextTarget === 'dependencies' ? pathState.dependencyTransferToken : undefined
                  );
                }
                if (level.key === 'info_mode') {
                  if (option.value === 'create') {
                    return buildCogitaPath(
                      selectedLibraryId,
                      'new_card',
                      selectedCollectionId,
                      selectedRevisionView,
                      selectedRevisionId
                    );
                  }
                  if (option.value === 'selected' && pathState.infoId) {
                    return buildCogitaPath(
                      selectedLibraryId,
                      'all_cards',
                      selectedCollectionId,
                      selectedRevisionView,
                      selectedRevisionId,
                      pathState.liveSessionId,
                      pathState.liveSessionView ?? 'list',
                      pathState.infoId,
                      'overview'
                    );
                  }
                  return buildCogitaPath(
                    selectedLibraryId,
                    'all_cards',
                    selectedCollectionId,
                    selectedRevisionView,
                    selectedRevisionId
                  );
                }
                if (level.key === 'info_selected_action' && pathState.infoId) {
                  if (option.value === 'dependencies') {
                    const query = new URLSearchParams({ dependencyView: 'create' });
                    return `/cogita/workspace/libraries/${selectedLibraryId}/dependencies?${query.toString()}`;
                  }
                  if (option.value === 'edit') {
                    return buildCogitaPath(
                      selectedLibraryId,
                      'new_card',
                      selectedCollectionId,
                      selectedRevisionView,
                      selectedRevisionId,
                      pathState.liveSessionId,
                      pathState.liveSessionView ?? 'list',
                      pathState.infoId
                    );
                  }
                  return buildCogitaPath(
                    selectedLibraryId,
                    'all_cards',
                    selectedCollectionId,
                    selectedRevisionView,
                    selectedRevisionId,
                    pathState.liveSessionId,
                    pathState.liveSessionView ?? 'list',
                    pathState.infoId,
                    option.value === 'cards' ? 'cards' : option.value === 'collections' ? 'collections' : 'overview'
                  );
                }
                if (level.key === 'dependency_mode') {
                  if (option.value === 'selected' && pathState.dependencyGraphId) {
                    return buildCogitaPath(
                      selectedLibraryId,
                      'dependencies',
                      selectedCollectionId,
                      selectedRevisionView,
                      selectedRevisionId,
                      pathState.liveSessionId,
                      pathState.liveSessionView ?? 'list',
                      pathState.infoId,
                      pathState.infoView ?? 'overview',
                      pathState.collectionView ?? 'infos',
                      pathState.filterCollectionId,
                      pathState.dependencyGraphId,
                      pathState.dependencyView ?? 'overview',
                      pathState.dependencyTransferToken
                    );
                  }
                  if (option.value === 'create') {
                    return buildCogitaPath(
                      selectedLibraryId,
                      'dependencies',
                      selectedCollectionId,
                      selectedRevisionView,
                      selectedRevisionId,
                      pathState.liveSessionId,
                      pathState.liveSessionView ?? 'list',
                      pathState.infoId,
                      pathState.infoView ?? 'overview',
                      pathState.collectionView ?? 'infos',
                      pathState.filterCollectionId,
                      undefined,
                      'create',
                      pathState.dependencyTransferToken
                    );
                  }
                  return buildCogitaPath(
                    selectedLibraryId,
                    'dependencies',
                    selectedCollectionId,
                    selectedRevisionView,
                    selectedRevisionId,
                    pathState.liveSessionId,
                    pathState.liveSessionView ?? 'list',
                    pathState.infoId,
                    pathState.infoView ?? 'overview',
                    pathState.collectionView ?? 'infos',
                    pathState.filterCollectionId,
                    undefined,
                    'search',
                    undefined
                  );
                }
                if (level.key === 'dependency_selected_action' && pathState.dependencyGraphId) {
                  return buildCogitaPath(
                    selectedLibraryId,
                    'dependencies',
                    selectedCollectionId,
                    selectedRevisionView,
                    selectedRevisionId,
                    pathState.liveSessionId,
                    pathState.liveSessionView ?? 'list',
                    pathState.infoId,
                    pathState.infoView ?? 'overview',
                    pathState.collectionView ?? 'infos',
                    pathState.filterCollectionId,
                    pathState.dependencyGraphId,
                    option.value === 'edit' ? 'edit' : 'overview',
                    undefined
                  );
                }
                if (level.key === 'storyboard_mode') {
                  if (!selectedLibraryId) return normalizePath(location.pathname);
                  const encodedLibraryId = encodeURIComponent(selectedLibraryId);
                  if (option.value === 'create') {
                    return `/cogita/workspace/libraries/${encodedLibraryId}/storyboards/new`;
                  }
                  if (option.value === 'selected' && pathState.storyboardId) {
                    const suffix = pathState.storyboardView === 'edit' ? '/edit' : '';
                    return `/cogita/workspace/libraries/${encodedLibraryId}/storyboards/${encodeURIComponent(pathState.storyboardId)}${suffix}`;
                  }
                  return `/cogita/workspace/libraries/${encodedLibraryId}/storyboards`;
                }
                if (level.key === 'storyboard_selected_action' && pathState.storyboardId) {
                  if (!selectedLibraryId) return normalizePath(location.pathname);
                  const encodedLibraryId = encodeURIComponent(selectedLibraryId);
                  const suffix = option.value === 'edit' ? '/edit' : '';
                  return `/cogita/workspace/libraries/${encodedLibraryId}/storyboards/${encodeURIComponent(pathState.storyboardId)}${suffix}`;
                }
                if (level.key === 'collection_mode') {
                  if (option.value === 'create') {
                    return buildCogitaPath(selectedLibraryId, 'new_collection', undefined, 'detail');
                  }
                  if (option.value === 'selected' && selectedCollectionId) {
                    return buildCogitaPath(selectedLibraryId, 'all_collections', selectedCollectionId, 'detail');
                  }
                  return buildCogitaPath(selectedLibraryId, 'all_collections', undefined, 'detail');
                }
                if (level.key === 'collection_selected_action' && selectedCollectionId) {
                  if (option.value === 'edit') {
                    return buildCogitaPath(selectedLibraryId, 'all_collections', selectedCollectionId, 'graph');
                  }
                  if (option.value === 'revisions') {
                    return buildCogitaPath(selectedLibraryId, 'all_revisions', undefined, 'settings', undefined, undefined, 'list', undefined, 'overview', 'infos', selectedCollectionId);
                  }
                  if (option.value === 'infos') {
                    return buildCogitaPath(selectedLibraryId, 'all_cards', selectedCollectionId, 'detail', undefined, undefined, 'list', undefined, 'overview', 'infos', selectedCollectionId);
                  }
                  return buildCogitaPath(
                    selectedLibraryId,
                    'all_collections',
                    selectedCollectionId,
                    'detail',
                    undefined,
                    undefined,
                    'list',
                    pathState.infoId,
                    pathState.infoView ?? 'overview',
                    option.value === 'overview' ? 'overview' : 'infos',
                    pathState.filterCollectionId
                  );
                }
                if (level.key === 'revision_mode') {
                  const isLibraryRevisionBranch = displayTarget === 'all_revisions';
                  const nextTarget = isLibraryRevisionBranch ? 'all_revisions' : 'all_collections';
                  const nextCollectionId = isLibraryRevisionBranch ? undefined : selectedCollectionId;
                  if (option.value === 'create') {
                    return buildCogitaPath(selectedLibraryId, nextTarget, nextCollectionId, 'new', undefined, undefined, 'list', undefined, 'overview', 'infos', pathState.filterCollectionId);
                  }
                  if (option.value === 'selected' && selectedRevisionId) {
                    const mode =
                      displayRevisionView === 'live' || displayRevisionView === 'detail'
                        ? displayRevisionView
                        : 'settings';
                    return buildCogitaPath(selectedLibraryId, nextTarget, nextCollectionId, mode, selectedRevisionId, undefined, 'list', undefined, 'overview', 'infos', pathState.filterCollectionId);
                  }
                  return buildCogitaPath(selectedLibraryId, nextTarget, nextCollectionId, 'settings', undefined, undefined, 'list', undefined, 'overview', 'infos', pathState.filterCollectionId);
                }
                if (level.key === 'revision_selected_action' && selectedRevisionId) {
                  const isLibraryRevisionBranch = displayTarget === 'all_revisions';
                  return buildCogitaPath(
                    selectedLibraryId,
                    isLibraryRevisionBranch ? 'all_revisions' : 'all_collections',
                    isLibraryRevisionBranch ? undefined : selectedCollectionId,
                    option.value === 'live' ? 'live' : option.value === 'settings' ? 'settings' : 'detail',
                    selectedRevisionId,
                    pathState.liveSessionId,
                    pathState.liveSessionView ?? 'list'
                  );
                }
                if (level.key === 'live_mode' && selectedRevisionId) {
                  const isLibraryRevisionBranch = displayTarget === 'all_revisions';
                  const target = isLibraryRevisionBranch ? 'all_revisions' : 'all_collections';
                  const collectionId = isLibraryRevisionBranch ? undefined : selectedCollectionId;
                  if (option.value === 'create') {
                    return buildCogitaPath(selectedLibraryId, target, collectionId, 'live', selectedRevisionId, undefined, 'new');
                  }
                  if (option.value === 'selected' && pathState.liveSessionId) {
                    return buildCogitaPath(selectedLibraryId, target, collectionId, 'live', selectedRevisionId, pathState.liveSessionId, 'detail');
                  }
                  return buildCogitaPath(selectedLibraryId, target, collectionId, 'live', selectedRevisionId);
                }
                if (level.key === 'live_selected_action' && selectedRevisionId && pathState.liveSessionId) {
                  const isLibraryRevisionBranch = displayTarget === 'all_revisions';
                  return buildCogitaPath(
                    selectedLibraryId,
                    isLibraryRevisionBranch ? 'all_revisions' : 'all_collections',
                    isLibraryRevisionBranch ? undefined : selectedCollectionId,
                    'live',
                    selectedRevisionId,
                    pathState.liveSessionId,
                    option.value === 'edit' ? 'edit' : 'detail'
                  );
                }
                return normalizePath(location.pathname);
              })());
            return (
              <a
                key={`${keyPrefix}:${level.key}:${option.value}`}
                href={`/#${optionPath}`}
                className={`ghost ${String(level.value) === option.value ? 'active' : ''}`}
                onClick={(event) => {
                  if (level.disabled) {
                    event.preventDefault();
                    return;
                  }
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                    return;
                  }
                  event.preventDefault();
                  level.onSelect(option.value);
                }}
                aria-disabled={level.disabled}
                title={option.label}
              >
                {shortenNavLabel(option.label, SIDEBAR_NAV_LABEL_MAX)}
              </a>
            );
          })}
        </div>
      );
    },
    [
      displayRevisionView,
      displayTarget,
      location.pathname,
      pathState.collectionView,
      pathState.dependencyGraphId,
      pathState.dependencyTransferToken,
      pathState.dependencyView,
      pathState.filterCollectionId,
      pathState.infoId,
      pathState.infoView,
      pathState.liveSessionId,
      pathState.liveSessionView,
      pathState.storyboardId,
      pathState.storyboardView,
      selectedCollectionId,
      selectedLibraryId,
      selectedRevisionId,
      selectedRevisionView
    ]
  );
  const embeddedSubpage = useMemo(() => {
    const libraryId = pathState.libraryId;
    if (
      !libraryId ||
      !location.pathname.startsWith('/cogita/workspace/libraries/')
    ) {
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
      return <CogitaLibraryOverview {...baseProps} selectedReviewerRoleId={selectedReviewerRoleId || null} />;
    }
    if (pathState.target === 'all_cards') {
      if (pathState.infoId && pathState.infoView === 'cards') {
        return <CogitaNotionCards {...baseProps} infoId={pathState.infoId} selectedReviewerRoleId={selectedReviewerRoleId || null} />;
      }
      if (pathState.infoId && (pathState.infoView ?? 'overview') === 'overview') {
        return (
          <CogitaNotionOverview
            {...baseProps}
            filterCollectionId={pathState.filterCollectionId}
            filterCollectionLabel={pathState.filterCollectionId === selectedCollectionId ? (selectedCollection?.name ?? undefined) : undefined}
          />
        );
      }
      return (
        <CogitaNotionSearch
          {...baseProps}
          mode={pathState.cardMode ?? 'list'}
          filterCollectionId={pathState.filterCollectionId}
          filterCollectionLabel={pathState.filterCollectionId === selectedCollectionId ? (selectedCollection?.name ?? undefined) : undefined}
        />
      );
    }
    if (pathState.target === 'new_card') {
      return <CogitaNotionEdit {...baseProps} editInfoId={pathState.infoId} />;
    }
    if (pathState.target === 'dependencies') {
      const dependencyView = pathState.dependencyView ?? 'search';
      if (dependencyView === 'search') {
        return <CogitaDependencySearch {...baseProps} />;
      }
      if (dependencyView === 'overview') {
        return <CogitaDependencyOverview {...baseProps} />;
      }
      return <CogitaDependencyEdit {...baseProps} mode={dependencyView as 'create' | 'edit'} />;
    }
    if (pathState.target === 'transfer') {
      return <WorkspaceLibraryTransferSection copy={copy} libraryId={libraryId} libraryName={selectedLibrary?.name} />;
    }
    if (pathState.target === 'storyboards' || pathState.target === 'new_storyboard') {
      const storyboardMode: StoryboardWorkspaceMode =
        pathState.target === 'new_storyboard' || pathState.storyboardView === 'create'
          ? 'create'
          : pathState.storyboardView === 'edit'
            ? 'edit'
            : pathState.storyboardView === 'overview'
              ? 'overview'
              : 'search';
      return <CogitaStoryboardEdit {...baseProps} mode={storyboardMode} storyboardId={pathState.storyboardId} />;
    }
    if (pathState.target === 'texts' || pathState.target === 'new_text') {
      return <CogitaTextWorkspace {...baseProps} />;
    }
    if (pathState.target === 'all_revisions') {
      if (!pathState.revisionId && !pathState.revisionView) {
        return <CogitaRevisionSearch {...baseProps} collectionId={pathState.filterCollectionId} />;
      }
      if (pathState.revisionView === 'detail' && pathState.revisionId) {
        return <CogitaRevisionOverview {...baseProps} revisionId={pathState.revisionId} />;
      }
      if (pathState.revisionView === 'live' && pathState.revisionId) {
        return (
          <CogitaRevisionLiveSessions
            {...baseProps}
            revisionId={pathState.revisionId}
            mode={
              pathState.liveSessionView === 'new'
                ? 'create'
                : pathState.liveSessionView === 'edit'
                  ? 'edit'
                  : pathState.liveSessionView === 'detail'
                    ? 'detail'
                    : 'search'
            }
            sessionId={pathState.liveSessionId}
            onCreated={(createdSessionId) => {
              applyNavigationSelection({
                libraryId,
                target: pathState.target ?? 'all_revisions',
                collectionId: selectedCollectionId,
                revisionId: pathState.revisionId,
                revisionView: 'live',
                liveSessionId: createdSessionId,
                liveSessionView: 'detail'
              });
            }}
            onOpenSession={(nextSessionId) => {
              applyNavigationSelection({
                libraryId,
                target: pathState.target ?? 'all_revisions',
                collectionId: selectedCollectionId,
                revisionId: pathState.revisionId,
                revisionView: 'live',
                liveSessionId: nextSessionId,
                liveSessionView: 'detail'
              });
            }}
            onRequestEdit={(nextSessionId) => {
              applyNavigationSelection({
                libraryId,
                target: pathState.target ?? 'all_revisions',
                collectionId: selectedCollectionId,
                revisionId: pathState.revisionId,
                revisionView: 'live',
                liveSessionId: nextSessionId,
                liveSessionView: 'edit'
              });
            }}
            onRequestOverview={(nextSessionId) => {
              applyNavigationSelection({
                libraryId,
                target: pathState.target ?? 'all_revisions',
                collectionId: selectedCollectionId,
                revisionId: pathState.revisionId,
                revisionView: 'live',
                liveSessionId: nextSessionId,
                liveSessionView: 'detail'
              });
            }}
          />
        );
      }
      if (!pathState.revisionId && pathState.revisionView === 'live') {
        return <CogitaLiveSessionsPage {...baseProps} libraryId={libraryId} />;
      }
      if (!pathState.revisionId && pathState.revisionView === 'settings') {
        return <CogitaRevisionSearch {...baseProps} collectionId={pathState.filterCollectionId} />;
      }
      return <CogitaRevisionEdit {...baseProps} revisionId={pathState.revisionId} />;
    }
    if (pathState.target === 'all_collections') {
      if (pathState.collectionId) {
        const collectionProps = { ...baseProps, collectionId: pathState.collectionId };
        if (pathState.revisionView === 'graph') {
          return <CogitaCollectionEdit {...collectionProps} collectionId={pathState.collectionId} />;
        }
        return <CogitaCollectionOverview {...collectionProps} />;
      }
      return <CogitaCollectionSearch {...baseProps} />;
    }
    if (pathState.target === 'new_collection') {
      return (
        <CogitaCollectionEdit
          {...baseProps}
          onCreated={(collection) => {
            applyNavigationSelection({
              libraryId,
              target: 'all_collections',
              collectionId: collection.collectionId,
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
    pathState.dependencyView,
    pathState.infoId,
    pathState.libraryId,
    pathState.liveSessionId,
    pathState.liveSessionView,
    pathState.revisionId,
    pathState.revisionView,
    pathState.storyboardId,
    pathState.storyboardView,
    pathState.target,
    secureMode,
    showProfileMenu,
    selectedCollection,
    selectedCollectionId,
    selectedLibrary,
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
        setSelectedRevisionId(pathState.revisionId);
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

    const cachedCollections = collectionsCacheRef.current[selectedLibraryId];
    if (cachedCollections) {
      setCollections(cachedCollections);
      primeCachedCollections(selectedLibraryId, cachedCollections);
      const cachedResolvedCollectionId = cachedCollections.find((item) => item.collectionId === pathState.collectionId)?.collectionId;
      setSelectedCollectionId(cachedResolvedCollectionId);
      if (!pathState.collectionId || cachedResolvedCollectionId) {
        return;
      }
    }

    let cancelled = false;
    getCogitaCollections({ libraryId: selectedLibraryId, limit: 200 })
      .then((response) => {
        if (cancelled) return;

        const items = response.items;
        collectionsCacheRef.current[selectedLibraryId] = items;
        primeCachedCollections(selectedLibraryId, items);
        setCollections(items);

        const resolvedCollectionId = items.find((item) => item.collectionId === pathState.collectionId)?.collectionId;

        setSelectedCollectionId(resolvedCollectionId);
      })
      .catch(() => {
        if (!cancelled) {
          setCollections([]);
          setSelectedCollectionId(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathState.collectionId, selectedLibraryId]);

  useEffect(() => {
    if (!selectedLibraryId) {
      setInfos([]);
      return;
    }
    if (displayTarget !== 'all_cards' && selectedTarget !== 'new_card') {
      return;
    }
    const cachedInfos = infosCacheRef.current[selectedLibraryId];
    if (cachedInfos) {
      setInfos(cachedInfos);
      if (!pathState.infoId || cachedInfos.some((item) => item.infoId === pathState.infoId)) {
        return;
      }
    }
    let cancelled = false;
    searchCogitaInfos({ libraryId: selectedLibraryId, limit: 200 })
      .then((items) => {
        if (cancelled) return;
        infosCacheRef.current[selectedLibraryId] = items;
        setInfos(items);
      })
      .catch(() => {
        if (cancelled) return;
        setInfos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [displayTarget, pathState.infoId, selectedLibraryId, selectedTarget]);

  useEffect(() => {
    if (!selectedLibraryId || selectedTarget !== 'dependencies') {
      setDependencyGraphs([]);
      return;
    }

    let cancelled = false;
    getCogitaDependencyGraphs({ libraryId: selectedLibraryId })
      .then((response) => {
        if (cancelled) return;
        setDependencyGraphs(response.items ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setDependencyGraphs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLibraryId, selectedTarget]);

  useEffect(() => {
    if (!selectedLibraryId || (selectedTarget !== 'all_revisions' && !selectedCollectionId)) {
      setRevisions([]);
      if (selectedTarget !== 'all_revisions') {
        setSelectedRevisionId(undefined);
      }
      return;
    }

    const scopedRevisionCollectionId = selectedTarget === 'all_revisions' ? pathState.filterCollectionId : selectedCollectionId;
    const revisionCacheKey = `${selectedLibraryId}:${scopedRevisionCollectionId ?? '__library__'}`;
    const cachedRevisions = revisionsCacheRef.current[revisionCacheKey];
    if (cachedRevisions) {
      setRevisions(cachedRevisions);
      const cachedResolvedRevisionId = cachedRevisions.find((item) => item.revisionId === pathState.revisionId)?.revisionId;
      setSelectedRevisionId(cachedResolvedRevisionId);
      if (!pathState.revisionId || cachedResolvedRevisionId) {
        return;
      }
    }

    let cancelled = false;
    getCogitaRevisions({
      libraryId: selectedLibraryId,
      collectionId: scopedRevisionCollectionId
    })
      .then((items) => {
        if (cancelled) return;
        revisionsCacheRef.current[revisionCacheKey] = items;
        setRevisions(items);
        const resolvedRevisionId = items.find((item) => item.revisionId === pathState.revisionId)?.revisionId;
        setSelectedRevisionId(resolvedRevisionId);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setRevisions([]);
        setSelectedRevisionId(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [pathState.filterCollectionId, pathState.revisionId, selectedCollectionId, selectedLibraryId, selectedTarget]);

  useEffect(() => {
    if (!selectedLibraryId || !selectedRevisionId) {
      setRevisionLiveSessions([]);
      return;
    }

    const liveSessionsCacheKey = `${selectedLibraryId}:${selectedRevisionId}`;
    const cachedLiveSessions = liveSessionsCacheRef.current[liveSessionsCacheKey];
    if (cachedLiveSessions) {
      setRevisionLiveSessions(cachedLiveSessions);
      if (!pathState.liveSessionId || cachedLiveSessions.some((item) => item.sessionId === pathState.liveSessionId)) {
        return;
      }
    }

    let cancelled = false;
    getCogitaLiveRevisionSessionsByRevision({ libraryId: selectedLibraryId, revisionId: selectedRevisionId })
      .then((items) => {
        if (cancelled) return;
        liveSessionsCacheRef.current[liveSessionsCacheKey] = items;
        setRevisionLiveSessions(items);
      })
      .catch(() => {
        if (cancelled) return;
        setRevisionLiveSessions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [pathState.liveSessionId, selectedLibraryId, selectedRevisionId]);

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
        const payload = (detail.payload ?? {}) as Record<string, unknown>;
        const definition = (payload.definition && typeof payload.definition === 'object'
          ? (payload.definition as Record<string, unknown>)
          : null);
        const nestedTitle = typeof definition?.title === 'string' ? definition.title : undefined;
        const nestedQuestion = typeof definition?.question === 'string' ? definition.question : undefined;
        const label = typeof payload.label === 'string' ? payload.label : undefined;
        const name = typeof payload.name === 'string' ? payload.name : undefined;
        const title = typeof payload.title === 'string' ? payload.title : undefined;
        setSelectedInfoLabel(nestedTitle ?? nestedQuestion ?? label ?? name ?? title ?? detail.infoId);
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

    const currentPath = normalizePath(`${location.pathname}${location.search ?? ''}`);
    const normalizedPathname = normalizePath(location.pathname);
    const isMainCogitaPath =
      (normalizedPathname === '/cogita/workspace' || normalizedPathname === '/cogita') &&
      !pathState.libraryId &&
      !selectedLibraryId;
    if (isMainCogitaPath) {
      lastNavigationRef.current = null;
      return;
    }
    if (normalizedPathname === '/cogita/persons' || normalizedPathname === '/cogita/workspace/persons') {
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
        pathState.liveSessionId,
        pathState.liveSessionView ?? 'list',
        pathState.infoId,
        pathState.infoView ?? 'overview',
        pathState.collectionView ?? 'infos',
        pathState.filterCollectionId,
        pathState.dependencyGraphId,
        pathState.dependencyView ?? 'search',
        pathState.dependencyTransferToken,
        pathState.storyboardId,
        pathState.storyboardView ?? 'search'
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
    pathState.dependencyGraphId,
    pathState.dependencyTransferToken,
    pathState.dependencyView,
    pathState.filterCollectionId,
    pathState.liveSessionId,
    pathState.liveSessionView,
    pathState.storyboardId,
    pathState.storyboardView,
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
                  navigate('/cogita/workspace/persons');
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
          <button type="button" className="ghost" onClick={() => navigate('/cogita/workspace/persons')}>
            Persons
          </button>
        </div>
      }
    >
      <section className="cogita-browser-shell">
        <aside className={`cogita-browser-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label={workspaceCopy.sidebar.title}>
          <div className="cogita-browser-sidebar-section">
            <h2 title={selectedLibrary?.name ?? workspaceCopy.path.noLibrarySelected}>
              {shortenNavLabel(selectedLibrary?.name ?? workspaceCopy.path.noLibrarySelected, SIDEBAR_NAV_LABEL_MAX)}
            </h2>
            <p className="cogita-sidebar-note">
              {selectedLibrary ? workspaceCopy.sidebar.libraryActionsHint : workspaceCopy.status.selectLibraryFirst}
            </p>
            {renderSidebarActions(sidebarLibraryActionsLevel, 'sidebar')}
            {selectedTarget === 'all_revisions' && sidebarRevisionModeLevel ? (
              <div className="cogita-sidebar-actions-nested" data-level="branch">
                <p className="cogita-sidebar-note">{workspaceCopy.targets.allRevisions}</p>
                {renderSidebarActions(sidebarRevisionModeLevel, 'sidebar')}
                {sidebarRevisionActionsLevel ? (
                  <div className="cogita-sidebar-actions-nested" data-level="branch">
                    <p className="cogita-sidebar-note" title={selectedRevision?.name ?? workspaceCopy.status.noRevisions}>
                      {shortenNavLabel(selectedRevision?.name ?? workspaceCopy.status.noRevisions, SIDEBAR_NAV_LABEL_MAX)}
                    </p>
                    {renderSidebarActions(sidebarRevisionActionsLevel, 'sidebar')}
                    {sidebarLiveModeLevel ? (
                      <div className="cogita-sidebar-actions-nested" data-level="branch">
                        <p className="cogita-sidebar-note">{workspaceCopy.revisions.live}</p>
                        {renderSidebarActions(sidebarLiveModeLevel, 'sidebar')}
                        {sidebarLiveSelectedActionLevel ? (
                          <div className="cogita-sidebar-actions-nested" data-level="branch">
                            <p className="cogita-sidebar-note" title={selectedLiveSession?.title ?? pathState.liveSessionId ?? ''}>
                              {shortenNavLabel(selectedLiveSession?.title ?? pathState.liveSessionId ?? '', SIDEBAR_NAV_LABEL_MAX)}
                            </p>
                            {renderSidebarActions(sidebarLiveSelectedActionLevel, 'sidebar')}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {sidebarInfoActionsLevel ? (
              <div className="cogita-sidebar-actions-nested" data-level="branch">
                <p className="cogita-sidebar-note">{workspaceCopy.sidebar.infoActionsHint}</p>
                {renderSidebarActions(sidebarInfoActionsLevel, 'sidebar')}
                {sidebarSelectedInfoActionsLevel ? (
                  <div className="cogita-sidebar-actions-nested" data-level="branch">
                    <p
                      className="cogita-sidebar-note"
                      title={selectedInfoOption?.label ?? selectedInfoLabel ?? copy.cogita.library.list.selectedEmpty}
                    >
                      {shortenNavLabel(
                        selectedInfoOption?.label ?? selectedInfoLabel ?? copy.cogita.library.list.selectedEmpty,
                        SIDEBAR_NAV_LABEL_MAX
                      )}
                    </p>
                    <p className="cogita-sidebar-note">{workspaceCopy.sidebar.selectedInfoActionsHint}</p>
                    {renderSidebarActions(sidebarSelectedInfoActionsLevel, 'sidebar')}
                  </div>
                ) : null}
              </div>
            ) : null}
            {sidebarDependencyModeLevel ? (
              <div className="cogita-sidebar-actions-nested" data-level="branch">
                <p className="cogita-sidebar-note">{workspaceCopy.targets.dependencies}</p>
                {renderSidebarActions(sidebarDependencyModeLevel, 'sidebar')}
                {sidebarDependencySelectedActionLevel ? (
                  <div className="cogita-sidebar-actions-nested" data-level="branch">
                    <p className="cogita-sidebar-note" title={selectedDependencyGraph?.name ?? workspaceCopy.targets.dependencies}>
                      {shortenNavLabel(selectedDependencyGraph?.name ?? workspaceCopy.targets.dependencies, SIDEBAR_NAV_LABEL_MAX)}
                    </p>
                    {renderSidebarActions(sidebarDependencySelectedActionLevel, 'sidebar')}
                  </div>
                ) : null}
              </div>
            ) : null}
            {sidebarStoryboardModeLevel ? (
              <div className="cogita-sidebar-actions-nested" data-level="branch">
                <p className="cogita-sidebar-note">{workspaceCopy.targets.storyboards}</p>
                {renderSidebarActions(sidebarStoryboardModeLevel, 'sidebar')}
                {sidebarStoryboardSelectedActionLevel ? (
                  <div className="cogita-sidebar-actions-nested" data-level="branch">
                    <p
                      className="cogita-sidebar-note"
                      title={selectedStoryboard?.name ?? pathState.storyboardId ?? workspaceCopy.targets.storyboards}
                    >
                      {shortenNavLabel(selectedStoryboard?.name ?? pathState.storyboardId ?? workspaceCopy.targets.storyboards, SIDEBAR_NAV_LABEL_MAX)}
                    </p>
                    {renderSidebarActions(sidebarStoryboardSelectedActionLevel, 'sidebar')}
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
                    <p className="cogita-sidebar-note" title={selectedCollection.name}>
                      {shortenNavLabel(selectedCollection.name, SIDEBAR_NAV_LABEL_MAX)}
                    </p>
                    {renderSidebarActions(sidebarSelectedCollectionActionsLevel, 'sidebar')}
                    {selectedTarget !== 'all_revisions' && sidebarRevisionModeLevel ? (
                      <div className="cogita-sidebar-actions-nested" data-level="branch">
                        <p className="cogita-sidebar-note">{workspaceCopy.targets.allRevisions}</p>
                        {renderSidebarActions(sidebarRevisionModeLevel, 'sidebar')}
                        {sidebarRevisionActionsLevel ? (
                          <div className="cogita-sidebar-actions-nested" data-level="branch">
                            <p className="cogita-sidebar-note" title={selectedRevision?.name ?? workspaceCopy.status.noRevisions}>
                              {shortenNavLabel(selectedRevision?.name ?? workspaceCopy.status.noRevisions, SIDEBAR_NAV_LABEL_MAX)}
                            </p>
                            {renderSidebarActions(sidebarRevisionActionsLevel, 'sidebar')}
                            {sidebarLiveModeLevel ? (
                              <div className="cogita-sidebar-actions-nested" data-level="branch">
                                <p className="cogita-sidebar-note">{workspaceCopy.revisions.live}</p>
                                {renderSidebarActions(sidebarLiveModeLevel, 'sidebar')}
                                {sidebarLiveSelectedActionLevel ? (
                                  <div className="cogita-sidebar-actions-nested" data-level="branch">
                                    <p className="cogita-sidebar-note" title={selectedLiveSession?.title ?? pathState.liveSessionId ?? ''}>
                                      {shortenNavLabel(selectedLiveSession?.title ?? pathState.liveSessionId ?? '', SIDEBAR_NAV_LABEL_MAX)}
                                    </p>
                                    {renderSidebarActions(sidebarLiveSelectedActionLevel, 'sidebar')}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
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
              <a
                href="/#/account"
                className="ghost"
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                    return;
                  }
                  event.preventDefault();
                  onProfileNavigate();
                }}
              >
                {workspaceCopy.sidebar.accountSettings}
              </a>
              <a
                href="/#/cogita"
                className="ghost"
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                    return;
                  }
                  event.preventDefault();
                  onNavigate('cogita');
                  setSidebarOpen(false);
                }}
              >
                {workspaceCopy.sidebar.cogitaHome}
              </a>
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
                <span className="cogita-browser-static" aria-label={level.label} title={level.selectedLabel}>
                  {shortenNavLabel(level.selectedLabel, BREADCRUMB_NAV_LABEL_MAX)}
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
                    <option key={`${level.key}:${option.value}`} value={option.value} title={option.label}>
                      {shortenNavLabel(option.label, BREADCRUMB_NAV_LABEL_MAX)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}

          </nav>

          {embeddedSubpage ? (
            <>
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
