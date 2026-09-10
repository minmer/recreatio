import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  createCogitaCoreRun,
  getCogitaCoreRunState,
  getCogitaPublicRevisionShare,
  issueCsrf
} from '../../../../../lib/api';
import { CogitaShell } from '../../../CogitaShell';
import type { Copy } from '../../../../../content/types';
import type { RouteKey } from '../../../../../types/navigation';

function isGuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function sharedRunStorageKey(shareId: string) {
  return `cogita.revision.shared.run.${shareId}`;
}

export function CogitaRevisionSharedRuntimeEntry({
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
  shareId
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
  shareId: string;
}) {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const shareKey = useMemo(() => (params.get('key') ?? '').trim(), [params]);
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const openRuntime = async () => {
      setStatus('loading');
      setError(null);
      try {
        await issueCsrf();
        const share = await getCogitaPublicRevisionShare({
          shareId,
          key: shareKey || undefined
        });
        if (cancelled) return;

        let runId: string | null = null;
        const key = sharedRunStorageKey(shareId);
        const storedRunId = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
        if (storedRunId && isGuid(storedRunId)) {
          try {
            const state = await getCogitaCoreRunState({ libraryId: share.libraryId, runId: storedRunId });
            runId = state.run.runScope === 'shared' ? storedRunId : null;
          } catch {
            runId = null;
          }
          if (!runId && typeof window !== 'undefined') {
            window.localStorage.removeItem(key);
          }
        }

        if (!runId) {
          const created = await createCogitaCoreRun({
            libraryId: share.libraryId,
            runScope: 'shared',
            title: `Shared · ${share.revisionName || 'Revision'}`,
            status: 'lobby'
          });
          runId = created.runId;
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, runId);
          }
        }

        if (typeof window !== 'undefined') {
          const nextParams = new URLSearchParams();
          nextParams.set('shareCode', shareId);
          if (shareKey) {
            nextParams.set('key', shareKey);
          }
          const query = nextParams.toString();
          window.location.hash =
            `#/cogita/revision/shared/${encodeURIComponent(share.libraryId)}/${encodeURIComponent(runId)}` +
            (query ? `?${query}` : '');
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Unable to open shared runtime.';
        setStatus('error');
        setError(message);
      }
    };

    void openRuntime();
    return () => {
      cancelled = true;
    };
  }, [shareId, shareKey]);

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
      <section className="glass-card" style={{ maxWidth: 760, margin: '0 auto' }}>
        <h2 style={{ marginTop: 0 }}>Opening shared revision runtime</h2>
        {status === 'loading' ? (
          <p className="cogita-help">Preparing runtime session...</p>
        ) : (
          <div>
            <p className="cogita-form-error">{error ?? 'Failed to initialize shared runtime.'}</p>
            <button
              type="button"
              className="cta"
              onClick={() => {
                window.location.reload();
              }}
            >
              Retry
            </button>
          </div>
        )}
      </section>
    </CogitaShell>
  );
}
