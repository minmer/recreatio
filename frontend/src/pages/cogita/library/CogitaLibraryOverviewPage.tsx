import { useRef, useState, type ChangeEvent } from 'react';
import {
  ApiError,
  createCogitaMockData,
  exportCogitaLibraryStream,
  importCogitaLibraryStream,
  type CogitaImportProgress,
  type TransferProgress
} from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { useCogitaLibraryMeta } from './useCogitaLibraryMeta';

export function CogitaLibraryOverviewPage({
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
  libraryId: string;
}) {
  const { libraryName, stats } = useCogitaLibraryMeta(libraryId);
  const [mockStatus, setMockStatus] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ infos: number; connections: number; collections: number } | null>(null);
  const [importLiveStatus, setImportLiveStatus] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<TransferProgress | null>(null);
  const [importProgress, setImportProgress] = useState<TransferProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const baseHref = `/#/cogita/library/${libraryId}`;
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

  const handleMockData = async () => {
    setMockStatus(null);
    try {
      const result = await createCogitaMockData(libraryId);
      setMockStatus(
        copy.cogita.library.overview.seedSuccess
          .replace('{languages}', String(result.languages))
          .replace('{translations}', String(result.translations))
      );
    } catch {
      setMockStatus(copy.cogita.library.overview.seedFail);
    }
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
        const stageLabel = progress.stage === 'infos'
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
      <section className="cogita-library-dashboard" data-mode="detail">
        <header className="cogita-library-dashboard-header">
          <div>
            <p className="cogita-user-kicker">{copy.cogita.library.overview.kicker}</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">{copy.cogita.library.overview.subtitle}</p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href="/#/cogita">
              {copy.cogita.library.actions.backToCogita}
            </a>
            <a className="cta ghost" href={`${baseHref}/list`}>
              {copy.cogita.library.actions.openList}
            </a>
            <a className="cta ghost" href={`${baseHref}/collections`}>
              {copy.cogita.library.actions.collections}
            </a>
            <a className="cta" href={`${baseHref}/new`}>
              {copy.cogita.library.actions.addInfo}
            </a>
          </div>
        </header>

        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-stats">
              <div className="cogita-stat-card">
                <span>{copy.cogita.library.overview.stats.totalInfos}</span>
                <strong>{stats?.totalInfos ?? 0}</strong>
              </div>
              <div className="cogita-stat-card">
                <span>{copy.cogita.library.overview.stats.connections}</span>
                <strong>{stats?.totalConnections ?? 0}</strong>
              </div>
              <div className="cogita-stat-card">
                <span>{copy.cogita.library.overview.stats.words}</span>
                <strong>{stats?.totalWords ?? 0}</strong>
              </div>
              <div className="cogita-stat-card">
                <span>{copy.cogita.library.overview.stats.sentences}</span>
                <strong>{stats?.totalSentences ?? 0}</strong>
              </div>
              <div className="cogita-stat-card">
                <span>{copy.cogita.library.overview.stats.languages}</span>
                <strong>{stats?.totalLanguages ?? 0}</strong>
              </div>
              <div className="cogita-stat-card">
                <span>{copy.cogita.library.overview.stats.collections}</span>
                <strong>{stats?.totalCollections ?? 0}</strong>
              </div>
            </div>

            <div className="cogita-library-grid">
              <div className="cogita-library-pane">
                <div className="cogita-library-controls">
                  <div className="cogita-library-search">
                    <p className="cogita-user-kicker">{copy.cogita.library.overview.quickActionsTitle}</p>
                    <div className="cogita-card-empty">
                      <p>{copy.cogita.library.overview.quickActionsText}</p>
                      <div className="cogita-form-actions">
                        <a className="cta ghost" href={`${baseHref}/list`}>
                          {copy.cogita.library.overview.browseList}
                        </a>
                        <a className="cta ghost" href={`${baseHref}/collections`}>
                          {copy.cogita.library.overview.viewCollections}
                        </a>
                        <a className="cta" href={`${baseHref}/new`}>
                          {copy.cogita.library.overview.addInfo}
                        </a>
                      </div>
                      <div className="cogita-form-actions">
                        <button type="button" className="cta ghost" onClick={handleMockData}>
                          {copy.cogita.library.overview.seedMock}
                        </button>
                        {mockStatus ? <p className="cogita-help">{mockStatus}</p> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="cogita-library-panel">
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.library.overview.kicker}</p>
                      <h3 className="cogita-detail-title">{copy.cogita.library.overview.focusTitle}</h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    <p>{copy.cogita.library.overview.focusBody1}</p>
                    <p>{copy.cogita.library.overview.focusBody2}</p>
                  </div>
                </section>
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.library.overview.kicker}</p>
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
                        <progress
                          value={exportProgress.percent ?? undefined}
                          max={exportProgress.totalBytes ? 100 : undefined}
                        />
                        <span>
                          {copy.cogita.library.overview.exportProgress.replace(
                            '{loaded}',
                            formatBytes(exportProgress.loadedBytes)
                          ).replace(
                            '{total}',
                            exportProgress.totalBytes ? formatBytes(exportProgress.totalBytes) : copy.cogita.library.overview.progressUnknown
                          )}
                        </span>
                      </div>
                    ) : null}
                    {importProgress ? (
                      <div className="cogita-progress">
                        <progress
                          value={importProgress.percent ?? undefined}
                          max={importProgress.totalBytes ? 100 : undefined}
                        />
                        <span>
                          {copy.cogita.library.overview.importProgress.replace(
                            '{loaded}',
                            formatBytes(importProgress.loadedBytes)
                          ).replace(
                            '{total}',
                            importProgress.totalBytes ? formatBytes(importProgress.totalBytes) : copy.cogita.library.overview.progressUnknown
                          )}
                        </span>
                      </div>
                    ) : null}
                    {exportStatus ? <p className="cogita-help">{exportStatus}</p> : null}
                    {importStatus ? <p className="cogita-help">{importStatus}</p> : null}
                    {importLiveStatus ? <p className="cogita-help">{importLiveStatus}</p> : null}
                    {importResult ? (
                      <p className="cogita-help">
                        {copy.cogita.library.overview.importSummary.replace(
                          '{infos}',
                          String(importResult.infos)
                        ).replace('{connections}', String(importResult.connections)).replace(
                          '{collections}',
                          String(importResult.collections)
                        )}
                      </p>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
