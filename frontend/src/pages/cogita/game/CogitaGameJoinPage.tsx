import { useEffect, useMemo, useRef, useState } from 'react';
import {
  completeCogitaGameInteraction,
  getCogitaGamePublicState,
  joinCogitaGame,
  leaveCogitaGame,
  submitCogitaGameAnswer,
  submitCogitaGameLocationPings,
  type CogitaGameSessionState
} from '../../../lib/api';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaShell } from '../CogitaShell';
import { connectCogitaGameRealtime, type GameRealtimeConnection } from './gameRealtime';
import { createAdaptiveGameLocationTracker, type GameLocationTracker, type GameLocationZone } from './gameLocation';

function participantTokenStorageKey(code: string) {
  return `cogita.game.join.${code}.token`;
}

function participantMetaStorageKey(code: string) {
  return `cogita.game.join.${code}.meta`;
}

export function CogitaGameJoinPage({
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
  code: string;
}) {
  const [name, setName] = useState('');
  const [groupKey, setGroupKey] = useState('');
  const [participantToken, setParticipantToken] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [state, setState] = useState<CogitaGameSessionState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [interactionKey, setInteractionKey] = useState('manual-interaction');
  const [transport, setTransport] = useState<'signalr' | 'polling' | null>(null);

  const realtimeRef = useRef<GameRealtimeConnection | null>(null);
  const locationRef = useRef<GameLocationTracker | null>(null);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(participantTokenStorageKey(code));
    const savedMeta = window.localStorage.getItem(participantMetaStorageKey(code));
    if (savedToken) {
      setParticipantToken(savedToken);
      try {
        const parsed = JSON.parse(savedMeta ?? '{}') as { participantId?: string; name?: string; groupKey?: string };
        if (parsed.participantId) setParticipantId(parsed.participantId);
        if (parsed.name) setName(parsed.name);
        if (parsed.groupKey) setGroupKey(parsed.groupKey);
      } catch {
        // ignore corrupted local metadata
      }
    }
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await getCogitaGamePublicState({
          code,
          participantToken: participantToken ?? undefined,
          sinceSeq: 0
        });
        if (!cancelled) {
          setState(response.state);
        }
      } catch {
        if (!cancelled) {
          setStatus('Unable to fetch session state.');
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [code, participantToken]);

  useEffect(() => {
    const snapshot = state;
    const token = snapshot?.participantRealtimeToken;
    if (!snapshot?.sessionId || !token) {
      return;
    }

    let disposed = false;
    const connect = async () => {
      try {
        const connection = await connectCogitaGameRealtime({
          sessionId: snapshot.sessionId,
          realtimeToken: token,
          lastSeqNo: snapshot.lastSeqNo ?? 0,
          fetchState: async (sinceSeq) => {
            return getCogitaGamePublicState({
              code,
              participantToken: participantToken ?? undefined,
              sinceSeq
            });
          },
          onSnapshot: (nextState) => {
            if (!disposed) setState(nextState);
          },
          onEvent: (event) => {
            if (!disposed && event.seqNo) {
              connection.ack(event.seqNo).catch(() => undefined);
            }
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
  }, [code, participantToken, state?.participantRealtimeToken, state?.sessionId, state?.lastSeqNo]);

  const zones = useMemo(() => {
    const source = state?.zones ?? [];
    const result: GameLocationZone[] = [];
    for (const item of source) {
      const latRaw = item?.geometry && typeof item.geometry === 'object' ? (item.geometry as { lat?: unknown }).lat : undefined;
      const lonRaw = item?.geometry && typeof item.geometry === 'object' ? (item.geometry as { lon?: unknown }).lon : undefined;
      const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw);
      const lon = typeof lonRaw === 'number' ? lonRaw : Number(lonRaw);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      result.push({
        zoneId: item.zoneId,
        lat,
        lon,
        radiusM: Number(item.triggerRadiusM ?? 0),
        isEnabled: Boolean(item.isEnabled)
      });
    }
    return result;
  }, [state?.zones]);

  useEffect(() => {
    if (!participantToken || zones.length === 0) {
      return;
    }
    if (locationRef.current) {
      locationRef.current.stop();
      locationRef.current = null;
    }

    const tracker = createAdaptiveGameLocationTracker({
      zones,
      onModeChanged: (mode) => {
        setStatus(`Location mode: ${mode}`);
      },
      onBatch: (samples) => {
        void submitCogitaGameLocationPings({
          code,
          participantToken,
          samples,
          batchId:
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`
        }).catch(() => undefined);
      }
    });
    locationRef.current = tracker;

    return () => {
      if (locationRef.current) {
        locationRef.current.stop();
        locationRef.current = null;
      }
    };
  }, [code, participantToken, zones]);

  const joinSession = async () => {
    if (!name.trim()) {
      setStatus('Name is required.');
      return;
    }
    setStatus(null);
    try {
      const response = await joinCogitaGame({
        code,
        name: name.trim(),
        groupKey: groupKey.trim() || null,
        deviceId: navigator.userAgent
      });
      setParticipantToken(response.participantToken);
      setParticipantId(response.participantId);
      setState(response.state);
      window.localStorage.setItem(participantTokenStorageKey(code), response.participantToken);
      window.localStorage.setItem(
        participantMetaStorageKey(code),
        JSON.stringify({
          participantId: response.participantId,
          name: name.trim(),
          groupKey: groupKey.trim() || null
        })
      );
      setStatus('Joined live game session.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to join session.');
    }
  };

  const submitAnswer = async () => {
    if (!participantToken) return;
    try {
      await submitCogitaGameAnswer({
        code,
        participantToken,
        interactionKey: interactionKey.trim() || 'manual-interaction',
        answer: answerText.trim()
      });
      setAnswerText('');
      setStatus('Answer submitted.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to submit answer.');
    }
  };

  const submitInteraction = async () => {
    if (!participantToken) return;
    try {
      await completeCogitaGameInteraction({
        code,
        participantToken,
        interactionKey: interactionKey.trim() || 'manual-interaction',
        value: { completedAtUtc: new Date().toISOString() }
      });
      setStatus('Interaction completed.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to complete interaction.');
    }
  };

  const leaveSession = async () => {
    if (!participantToken) return;
    try {
      await leaveCogitaGame({ code, participantToken });
      window.localStorage.removeItem(participantTokenStorageKey(code));
      window.localStorage.removeItem(participantMetaStorageKey(code));
      setParticipantToken(null);
      setParticipantId(null);
      setStatus('You left the session.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to leave session.');
    }
  };

  const myScore = useMemo(() => {
    if (!participantId || !state?.scoreboard?.length) return null;
    return state.scoreboard.find((row) => row.participantId === participantId) ?? null;
  }, [participantId, state?.scoreboard]);

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
      <section className="cogita-section" style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: '0.8rem' }}>
        <header className="cogita-library-header">
          <div>
            <h1>Game Join</h1>
            <p>Code: {code}</p>
          </div>
          <div style={{ opacity: 0.8 }}>Realtime: {transport ?? 'not connected'}</div>
        </header>

        {!participantToken ? (
          <div className="cogita-panel" style={{ display: 'grid', gap: '0.6rem', maxWidth: 560 }}>
            <label>
              Name
              <input className="cogita-input" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              Group key (optional)
              <input className="cogita-input" value={groupKey} onChange={(event) => setGroupKey(event.target.value)} />
            </label>
            <button type="button" className="cta" onClick={joinSession}>
              Join Session
            </button>
          </div>
        ) : null}

        {state ? (
          <div className="cogita-panel" style={{ display: 'grid', gap: '0.65rem' }}>
            <div>Phase: <strong>{state.phase}</strong> | Round: {state.roundIndex} | Version: {state.version}</div>
            <div>Participants: {state.participants.length} | Groups: {state.groups.length}</div>
            {myScore ? <div>Your score: <strong>{myScore.score}</strong> (rank {myScore.rank})</div> : null}

            <div style={{ display: 'grid', gap: '0.45rem', maxWidth: 720 }}>
              <label>
                Interaction key
                <input className="cogita-input" value={interactionKey} onChange={(event) => setInteractionKey(event.target.value)} />
              </label>
              <label>
                Answer payload (text)
                <textarea className="cogita-input" value={answerText} onChange={(event) => setAnswerText(event.target.value)} />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="cta" onClick={submitAnswer}>Submit Answer</button>
                <button type="button" className="ghost" onClick={submitInteraction}>Complete Interaction</button>
                <button type="button" className="ghost" onClick={leaveSession}>Leave</button>
              </div>
            </div>

            <details>
              <summary>Scoreboard</summary>
              <ul>
                {state.scoreboard.map((row) => (
                  <li key={`${row.participantId ?? row.groupId ?? 'session'}-${row.rank}`}>
                    rank {row.rank} | score {row.score} | participant {row.participantId ?? '-'} | group {row.groupId ?? '-'}
                  </li>
                ))}
              </ul>
            </details>

            <details>
              <summary>Recent events ({state.events.length})</summary>
              <ul>
                {state.events.slice(-30).map((event) => (
                  <li key={event.eventId}>
                    #{event.seqNo} {event.eventType}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ) : null}

        {status ? <p className="cogita-help">{status}</p> : null}
      </section>
    </CogitaShell>
  );
}
