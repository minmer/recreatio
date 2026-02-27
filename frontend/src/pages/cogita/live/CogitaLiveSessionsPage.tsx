import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { attachCogitaLiveRevisionSession, getCogitaLiveRevisionSessions, type CogitaLiveRevisionSessionListItem } from '../../../lib/api';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaShell } from '../CogitaShell';

export function CogitaLiveSessionsPage(props: {
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
  const navigate = useNavigate();
  const liveCopy = props.copy.cogita.library.revision.live;
  const { libraryId } = props;
  const [items, setItems] = useState<CogitaLiveRevisionSessionListItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [attachedBySessionId, setAttachedBySessionId] = useState<Record<string, { sessionId: string; code: string; hostSecret: string }>>({});
  const statusLabelMap: Record<string, string> = useMemo(
    () => ({
      lobby: liveCopy.statusLobby,
      running: liveCopy.statusRunning,
      revealed: liveCopy.statusRevealed,
      finished: liveCopy.statusFinished
    }),
    [liveCopy.statusFinished, liveCopy.statusLobby, liveCopy.statusRevealed, liveCopy.statusRunning]
  );

  const load = async () => {
    setStatus('loading');
    try {
      const list = await getCogitaLiveRevisionSessions({ libraryId });
      setItems(list);
      setStatus('ready');
    } catch {
      setItems([]);
      setStatus('error');
    }
  };

  useEffect(() => {
    load();
  }, [libraryId]);

  const attachAndOpen = async (
    item: CogitaLiveRevisionSessionListItem,
    mode: 'host' | 'presenter' | 'login'
  ) => {
    setBusySessionId(item.sessionId);
    try {
      const attached =
        attachedBySessionId[item.sessionId] ??
        (await attachCogitaLiveRevisionSession({ libraryId, sessionId: item.sessionId }));
      if (!attachedBySessionId[item.sessionId]) {
        setAttachedBySessionId((prev) => ({
          ...prev,
          [item.sessionId]: { sessionId: attached.sessionId, code: attached.code, hostSecret: attached.hostSecret }
        }));
      }
      const code = encodeURIComponent(attached.code);
      if (mode === 'host') {
        navigate(
          `/cogita/live-revision-host/${encodeURIComponent(libraryId)}/${encodeURIComponent(item.revisionId)}?sessionId=${encodeURIComponent(
            attached.sessionId
          )}&hostSecret=${encodeURIComponent(attached.hostSecret)}&code=${code}`
        );
        return;
      }
      const target =
        mode === 'presenter'
          ? `${window.location.origin}/#/cogita/public/live-revision-screen/${code}`
          : `${window.location.origin}/#/cogita/public/live-revision/${code}`;
      window.open(target, '_blank', 'noopener');
    } finally {
      setBusySessionId(null);
    }
  };

  return (
    <CogitaShell {...props}>
      <section className="cogita-library-dashboard">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-panel">
              <div className="cogita-detail-header">
                <div>
                  <p className="cogita-user-kicker">{liveCopy.hostKicker}</p>
                  <h2 className="cogita-detail-title">Active live sessions</h2>
                </div>
                <div className="cogita-form-actions">
                  <button type="button" className="cta ghost" onClick={load}>Refresh</button>
                </div>
              </div>
              {status === 'loading' ? <p>{liveCopy.loading}</p> : null}
              {status === 'error' ? <p className="cogita-help">{liveCopy.connectionError}</p> : null}
              {status === 'ready' && items.length === 0 ? <p className="cogita-help">No active sessions.</p> : null}
              <div className="cogita-share-list">
                {items.map((item) => (
                  <div className="cogita-share-row" key={item.sessionId}>
                    <div>
                      <strong>{item.title || item.sessionId}</strong>
                      <div className="cogita-share-meta">
                        {statusLabelMap[item.status] ?? item.status} · {liveCopy.participantsTitle}: {item.participantCount}
                      </div>
                    </div>
                    <div className="cogita-form-actions">
                      <button type="button" className="ghost" onClick={() => attachAndOpen(item, 'host')} disabled={busySessionId === item.sessionId}>
                        Host
                      </button>
                      <button type="button" className="ghost" onClick={() => attachAndOpen(item, 'presenter')} disabled={busySessionId === item.sessionId}>
                        Screen
                      </button>
                      <button type="button" className="ghost" onClick={() => attachAndOpen(item, 'login')} disabled={busySessionId === item.sessionId}>
                        Login panel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
