import { useEffect, useMemo, useRef, useState } from 'react';
import {
  attachCogitaGameHost,
  getCogitaGamePublicState,
  sendCogitaGameHostCommand,
  updateCogitaGameHostGroups,
  updateCogitaGameHostPhase,
  type CogitaGameSessionState
} from '../../../../../lib/api';
import type { Copy } from '../../../../../content/types';
import type { RouteKey } from '../../../../../types/navigation';
import { CogitaShell } from '../../../CogitaShell';
import { connectCogitaGameRealtime, type GameRealtimeConnection } from './gameRealtime';

export function CogitaGameHostRuntime({
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
  libraryId,
  sessionId,
  hostSecret,
  code
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
  sessionId: string;
  hostSecret: string;
  code?: string;
}) {
  const [state, setState] = useState<CogitaGameSessionState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [transport, setTransport] = useState<'signalr' | 'polling' | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<'lobby' | 'active_round' | 'reveal' | 'transition' | 'paused' | 'finished'>('lobby');
  const [command, setCommand] = useState('host:ping');
  const [groupJson, setGroupJson] = useState(
    JSON.stringify(
      [
        { groupKey: 'group-a', displayName: 'Group A', capacity: 8 },
        { groupKey: 'group-b', displayName: 'Group B', capacity: 8 }
      ],
      null,
      2
    )
  );

  const realtimeRef = useRef<GameRealtimeConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const snapshot = await attachCogitaGameHost({ libraryId, sessionId, hostSecret });
        if (cancelled) return;
        setState(snapshot);
        setPhase((snapshot.phase as typeof phase) ?? 'lobby');
        setRoundIndex(snapshot.roundIndex ?? 0);
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : 'Unable to attach host.');
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [hostSecret, libraryId, sessionId]);

  useEffect(() => {
    if (!state?.hostRealtimeToken) return;
    let disposed = false;

    const connect = async () => {
      try {
        const connection = await connectCogitaGameRealtime({
          sessionId: state.sessionId,
          realtimeToken: state.hostRealtimeToken,
          lastSeqNo: state.lastSeqNo ?? 0,
          fetchState: async (sinceSeq) => {
            if (code) {
              return getCogitaGamePublicState({ code, sinceSeq });
            }
            const next = await attachCogitaGameHost({ libraryId, sessionId, hostSecret });
            return { state: next, eTag: '' };
          },
          onSnapshot: (next) => {
            if (!disposed) setState(next);
          }
        });
        if (disposed) {
          await connection.stop();
          return;
        }
        realtimeRef.current = connection;
        setTransport(connection.transport);
      } catch {
        setTransport('polling');
      }
    };
    void connect();

    return () => {
      disposed = true;
      if (realtimeRef.current) {
        void realtimeRef.current.stop();
        realtimeRef.current = null;
      }
    };
  }, [code, hostSecret, libraryId, sessionId, state?.hostRealtimeToken, state?.lastSeqNo, state?.sessionId]);

  const applyPhase = async (nextPhase?: typeof phase) => {
    const targetPhase = nextPhase ?? phase;
    try {
      const updated = await updateCogitaGameHostPhase({
        libraryId,
        sessionId,
        hostSecret,
        phase: targetPhase,
        roundIndex,
        status: targetPhase === 'finished' ? 'finished' : targetPhase === 'paused' ? 'paused' : 'active',
        meta: { hostUpdatedUtc: new Date().toISOString() }
      });
      setState(updated);
      setStatus(`Phase updated: ${targetPhase}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to update phase.');
    }
  };

  const dispatchCommand = async () => {
    try {
      const updated = await sendCogitaGameHostCommand({
        libraryId,
        sessionId,
        hostSecret,
        command: command.trim() || 'host:ping',
        payload: { hostUtc: new Date().toISOString() }
      });
      setState(updated);
      setStatus('Command dispatched.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to dispatch command.');
    }
  };

  const saveGroups = async () => {
    try {
      const parsed = JSON.parse(groupJson) as Array<{ groupKey: string; displayName: string; capacity?: number }>;
      await updateCogitaGameHostGroups({
        libraryId,
        sessionId,
        hostSecret,
        groups: parsed
      });
      setStatus('Groups updated.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to update groups.');
    }
  };

  const scoreboard = useMemo(() => state?.scoreboard ?? [], [state?.scoreboard]);

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
      <section className="cogita-section" style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gap: '0.8rem' }}>
        <header className="cogita-library-header">
          <div>
            <h1>Game Host Console</h1>
            <p>Session: {sessionId}</p>
          </div>
          <div style={{ opacity: 0.8 }}>Realtime: {transport ?? 'not connected'}</div>
        </header>

        <div className="cogita-panel" style={{ display: 'grid', gap: '0.65rem' }}>
          <div>Status: <strong>{state?.status ?? '-'}</strong> | Phase: <strong>{state?.phase ?? '-'}</strong></div>
          <div>Round: {state?.roundIndex ?? 0} | Version: {state?.version ?? 0}</div>
          {code ? <div>Participant link: <a href={`/#/cogita/game/join/${encodeURIComponent(code)}`}>open</a></div> : null}

          <div style={{ display: 'grid', gridTemplateColumns: '200px 140px auto', gap: '0.5rem', alignItems: 'end' }}>
            <label>
              Phase
              <select className="cogita-input" value={phase} onChange={(event) => setPhase(event.target.value as typeof phase)}>
                <option value="lobby">lobby</option>
                <option value="active_round">active_round</option>
                <option value="reveal">reveal</option>
                <option value="transition">transition</option>
                <option value="paused">paused</option>
                <option value="finished">finished</option>
              </select>
            </label>
            <label>
              Round
              <input className="cogita-input" type="number" value={roundIndex} onChange={(event) => setRoundIndex(Number(event.target.value || 0))} />
            </label>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <button type="button" className="cta" onClick={() => void applyPhase()}>Apply</button>
              <button type="button" className="ghost" onClick={() => void applyPhase('active_round')}>Start Round</button>
              <button type="button" className="ghost" onClick={() => void applyPhase('reveal')}>Reveal</button>
              <button type="button" className="ghost" onClick={() => void applyPhase('transition')}>Transition</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'end' }}>
            <label>
              Host command
              <input className="cogita-input" value={command} onChange={(event) => setCommand(event.target.value)} />
            </label>
            <button type="button" className="ghost" onClick={dispatchCommand}>Send Command</button>
          </div>

          <details>
            <summary>Group assignment JSON</summary>
            <textarea
              className="cogita-input"
              style={{ minHeight: 160, marginTop: 8, fontFamily: 'monospace' }}
              value={groupJson}
              onChange={(event) => setGroupJson(event.target.value)}
            />
            <div style={{ marginTop: 8 }}>
              <button type="button" className="ghost" onClick={saveGroups}>Save Groups</button>
            </div>
          </details>
        </div>

        <div className="cogita-panel">
          <h3>Participants ({state?.participants.length ?? 0})</h3>
          <ul>
            {(state?.participants ?? []).map((participant) => (
              <li key={participant.participantId}>
                {participant.displayName} | role {participant.roleType} | group {participant.groupId ?? '-'} | connected {participant.isConnected ? 'yes' : 'no'} | spoof {participant.spoofRiskScore}
              </li>
            ))}
          </ul>
        </div>

        <div className="cogita-panel">
          <h3>Scoreboard ({scoreboard.length})</h3>
          <ul>
            {scoreboard.map((row) => (
              <li key={`${row.participantId ?? row.groupId ?? 'session'}-${row.rank}`}>
                rank {row.rank} | score {row.score} | participant {row.participantId ?? '-'} | group {row.groupId ?? '-'}
              </li>
            ))}
          </ul>
        </div>

        <details className="cogita-panel">
          <summary>Event log ({state?.events.length ?? 0})</summary>
          <ul>
            {(state?.events ?? []).slice(-100).map((event) => (
              <li key={event.eventId}>
                #{event.seqNo} {event.eventType}
              </li>
            ))}
          </ul>
        </details>

        {status ? <p className="cogita-help">{status}</p> : null}
      </section>
    </CogitaShell>
  );
}
