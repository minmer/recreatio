import type { CogitaGameEvent, CogitaGameScoreRow, CogitaGameSessionState, CogitaGameStateResponse } from '../../../../../lib/api';

const apiBase = import.meta.env.VITE_API_BASE ?? 'https://api.recreatio.pl';

export type GameRealtimeConnection = {
  transport: 'signalr' | 'polling';
  stop: () => Promise<void>;
  ack: (seqNo: number) => Promise<void>;
};

export async function connectCogitaGameRealtime(payload: {
  sessionId: string;
  realtimeToken: string;
  lastSeqNo?: number;
  pollMs?: number;
  fetchState: (sinceSeq: number) => Promise<CogitaGameStateResponse>;
  onSnapshot: (state: CogitaGameSessionState) => void;
  onEvent?: (event: CogitaGameEvent) => void;
  onScoreboard?: (rows: CogitaGameScoreRow[], version: number) => void;
  onPhaseChanged?: (value: { phase: string; roundIndex: number; status: string }) => void;
  onAck?: (value: unknown) => void;
}): Promise<GameRealtimeConnection> {
  const importSignalR = new Function('moduleName', 'return import(moduleName);') as (moduleName: string) => Promise<unknown>;

  try {
    const signalRModule = (await importSignalR('@microsoft/signalr')) as {
      HubConnectionBuilder: new () => {
        withUrl: (url: string) => unknown;
        withAutomaticReconnect: () => unknown;
        build: () => {
          on: (eventName: string, handler: (...args: unknown[]) => void) => void;
          start: () => Promise<void>;
          stop: () => Promise<void>;
          invoke: (methodName: string, ...args: unknown[]) => Promise<void>;
        };
      };
    };

    if (!signalRModule?.HubConnectionBuilder) {
      throw new Error('SignalR module not available');
    }

    const connection = new signalRModule.HubConnectionBuilder()
      .withUrl(`${apiBase}/hubs/cogita-game`)
      .withAutomaticReconnect()
      .build();
    let latestSeqNo = payload.lastSeqNo ?? 0;
    let heartbeatTimer = 0;

    connection.on('GameSnapshot', (snapshot: unknown) => {
      const parsed = snapshot as CogitaGameSessionState;
      latestSeqNo = Math.max(latestSeqNo, Number(parsed?.lastSeqNo ?? 0));
      payload.onSnapshot(parsed);
    });

    connection.on('GameEventDelta', (gameEvent: unknown) => {
      const parsed = gameEvent as CogitaGameEvent;
      latestSeqNo = Math.max(latestSeqNo, Number(parsed?.seqNo ?? 0));
      payload.onEvent?.(parsed);
    });

    connection.on('ScoreboardDelta', (delta: unknown) => {
      const root = (delta ?? {}) as { rows?: CogitaGameScoreRow[]; version?: number };
      payload.onScoreboard?.(root.rows ?? [], Number(root.version ?? 0));
    });

    connection.on('PhaseChanged', (value: unknown) => {
      const root = (value ?? {}) as { phase?: string; roundIndex?: number; status?: string };
      payload.onPhaseChanged?.({
        phase: root.phase ?? 'lobby',
        roundIndex: Number(root.roundIndex ?? 0),
        status: root.status ?? 'lobby'
      });
    });

    connection.on('Ack', (value: unknown) => {
      payload.onAck?.(value);
    });

    await connection.start();
    await connection.invoke('Subscribe', payload.sessionId, payload.realtimeToken, latestSeqNo);
    heartbeatTimer = window.setInterval(() => {
      void connection.invoke('HeartbeatSession', payload.sessionId, payload.realtimeToken, latestSeqNo).catch(() => {
        // no-op; next heartbeat/reconnect attempt will retry
      });
    }, 4000);

    const reconnectable = connection as unknown as {
      onreconnected?: (callback: () => void | Promise<void>) => void;
    };
    reconnectable.onreconnected?.(() => {
      return connection.invoke('Subscribe', payload.sessionId, payload.realtimeToken, latestSeqNo);
    });

    return {
      transport: 'signalr',
      stop: async () => {
        if (heartbeatTimer) {
          window.clearInterval(heartbeatTimer);
          heartbeatTimer = 0;
        }
        await connection.stop();
      },
      ack: async (seqNo: number) => {
        await connection.invoke('Ack', seqNo);
      }
    };
  } catch {
    let disposed = false;
    let pollTimer = 0;
    let lastSeq = payload.lastSeqNo ?? 0;

    const runPoll = async () => {
      if (disposed) return;
      try {
        const response = await payload.fetchState(lastSeq);
        payload.onSnapshot(response.state);
        const events = response.state.events ?? [];
        if (events.length > 0) {
          for (const item of events) {
            payload.onEvent?.(item);
          }
          lastSeq = Math.max(lastSeq, events[events.length - 1]?.seqNo ?? lastSeq);
        }
      } catch {
        // keep retrying silently in fallback mode
      }
    };

    await runPoll();
    pollTimer = window.setInterval(() => {
      void runPoll();
    }, Math.max(1500, payload.pollMs ?? 4000));

    return {
      transport: 'polling',
      stop: async () => {
        disposed = true;
        if (pollTimer) {
          window.clearInterval(pollTimer);
        }
      },
      ack: async (_seqNo: number) => {
        payload.onAck?.({ fallback: true });
      }
    };
  }
}
