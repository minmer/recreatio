import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  attachCogitaLiveRevisionSession,
  getCogitaLiveRevisionSessions,
  getCogitaParticipatingLiveRevisionSessions,
  type CogitaLiveRevisionParticipantSessionListItem,
  type CogitaLiveRevisionSessionListItem
} from '../../../lib/api';
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
  const [hostedItems, setHostedItems] = useState<CogitaLiveRevisionSessionListItem[]>([]);
  const [participatingItems, setParticipatingItems] = useState<CogitaLiveRevisionParticipantSessionListItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [attachedBySessionId, setAttachedBySessionId] = useState<Record<string, { sessionId: string; code: string; hostSecret: string }>>({});

  type SessionRole = 'host' | 'participant' | 'both';
  type UnifiedLiveSession = {
    sessionId: string;
    title?: string | null;
    status: string;
    participantCount: number;
    updatedUtc: string;
    role: SessionRole;
    hostItem?: CogitaLiveRevisionSessionListItem;
    participantItem?: CogitaLiveRevisionParticipantSessionListItem;
  };

  const statusLabelMap: Record<string, string> = useMemo(
    () => ({
      lobby: liveCopy.statusLobby,
      running: liveCopy.statusRunning,
      revealed: liveCopy.statusRevealed,
      finished: liveCopy.statusFinished,
      closed: liveCopy.closedStatus
    }),
    [liveCopy.closedStatus, liveCopy.statusFinished, liveCopy.statusLobby, liveCopy.statusRevealed, liveCopy.statusRunning]
  );

  const load = async () => {
    setStatus('loading');
    try {
      const [list, participating] = await Promise.all([
        getCogitaLiveRevisionSessions({ libraryId }),
        getCogitaParticipatingLiveRevisionSessions({ libraryId })
      ]);
      setHostedItems(list);
      setParticipatingItems(participating);
      setStatus('ready');
    } catch {
      setHostedItems([]);
      setParticipatingItems([]);
      setStatus('error');
    }
  };

  useEffect(() => {
    load();
  }, [libraryId]);

  const unifiedSessions = useMemo<UnifiedLiveSession[]>(() => {
    const byId = new Map<string, UnifiedLiveSession>();
    for (const item of hostedItems) {
      byId.set(item.sessionId, {
        sessionId: item.sessionId,
        title: item.title,
        status: item.status,
        participantCount: item.participantCount,
        updatedUtc: item.updatedUtc,
        role: 'host',
        hostItem: item
      });
    }
    for (const item of participatingItems) {
      const existing = byId.get(item.sessionId);
      if (existing) {
        existing.participantItem = item;
        existing.role = 'both';
        if (!existing.title && item.title) existing.title = item.title;
        existing.status = item.status || existing.status;
        existing.participantCount = Math.max(existing.participantCount, item.participantCount);
        if (new Date(item.updatedUtc).getTime() > new Date(existing.updatedUtc).getTime()) {
          existing.updatedUtc = item.updatedUtc;
        }
      } else {
        byId.set(item.sessionId, {
          sessionId: item.sessionId,
          title: item.title,
          status: item.status,
          participantCount: item.participantCount,
          updatedUtc: item.updatedUtc,
          role: 'participant',
          participantItem: item
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) => new Date(b.updatedUtc).getTime() - new Date(a.updatedUtc).getTime());
  }, [hostedItems, participatingItems]);

  const sharedRoleSessions = useMemo(() => unifiedSessions.filter((session) => session.role === 'both'), [unifiedSessions]);
  const hostOnlySessions = useMemo(() => unifiedSessions.filter((session) => session.role === 'host'), [unifiedSessions]);
  const participantOnlySessions = useMemo(
    () => unifiedSessions.filter((session) => session.role === 'participant'),
    [unifiedSessions]
  );

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

  const roleLabelByRole: Record<SessionRole, string> = useMemo(
    () => ({
      host: liveCopy.roleHost,
      participant: liveCopy.roleParticipant,
      both: liveCopy.roleBoth
    }),
    [liveCopy.roleBoth, liveCopy.roleHost, liveCopy.roleParticipant]
  );

  const renderSessionRow = (item: UnifiedLiveSession) => (
    <div className="cogita-share-row" key={item.sessionId}>
      <div>
        <strong>{item.title || item.sessionId}</strong>
        <div className="cogita-share-meta">
          {statusLabelMap[item.status] ?? item.status} · {liveCopy.participantsTitle}: {item.participantCount}
        </div>
        <div className="cogita-share-meta">
          {liveCopy.roleLabel}: {roleLabelByRole[item.role]}
        </div>
        {item.participantItem ? (
          <div className="cogita-share-meta">
            {liveCopy.yourScoreLabel}: {item.participantItem.participantScore} ·{' '}
            {item.participantItem.isConnected ? liveCopy.connectedLabel : liveCopy.disconnectedLabel}
          </div>
        ) : null}
      </div>
      {item.hostItem ? (
        <div className="cogita-form-actions">
          <button type="button" className="ghost" onClick={() => attachAndOpen(item.hostItem, 'host')} disabled={busySessionId === item.sessionId}>
            {liveCopy.roleHost}
          </button>
          <button type="button" className="ghost" onClick={() => attachAndOpen(item.hostItem, 'presenter')} disabled={busySessionId === item.sessionId}>
            {liveCopy.presenterUrlLabel}
          </button>
          <button type="button" className="ghost" onClick={() => attachAndOpen(item.hostItem, 'login')} disabled={busySessionId === item.sessionId}>
            {liveCopy.joinTitle}
          </button>
        </div>
      ) : null}
    </div>
  );

  const renderSessionGroup = (title: string, rows: UnifiedLiveSession[], emptyLabel: string) => (
    <>
      <div className="cogita-detail-header" style={{ marginTop: '1rem' }}>
        <div>
          <h3 className="cogita-detail-title">{title}</h3>
        </div>
      </div>
      {rows.length === 0 ? <p className="cogita-help">{emptyLabel}</p> : null}
      {rows.length > 0 ? <div className="cogita-share-list">{rows.map(renderSessionRow)}</div> : null}
    </>
  );

  return (
    <CogitaShell {...props}>
      <section className="cogita-library-dashboard">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-panel">
              <div className="cogita-detail-header">
                <div>
                  <p className="cogita-user-kicker">{liveCopy.hostKicker}</p>
                  <h2 className="cogita-detail-title">{liveCopy.activeSessionsTitle}</h2>
                </div>
                <div className="cogita-form-actions">
                  <button type="button" className="cta ghost" onClick={load}>
                    {liveCopy.refreshAction}
                  </button>
                </div>
              </div>
              {status === 'loading' ? <p>{liveCopy.loading}</p> : null}
              {status === 'error' ? <p className="cogita-help">{liveCopy.connectionError}</p> : null}
              {status === 'ready' && unifiedSessions.length === 0 ? <p className="cogita-help">{liveCopy.noSessionsForRole}</p> : null}
              {status === 'ready'
                ? (
                    <>
                      {renderSessionGroup(liveCopy.sharedRoleSessionsTitle, sharedRoleSessions, liveCopy.noSessionsForRole)}
                      {renderSessionGroup(liveCopy.hostSessionsTitle, hostOnlySessions, liveCopy.noHostSessions)}
                      {renderSessionGroup(liveCopy.participantSessionsTitle, participantOnlySessions, liveCopy.noParticipantSessions)}
                    </>
                  )
                : null}
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
