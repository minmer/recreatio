/**
 * COGITA — DIE EREIGNISSE EINER SITZUNG LESEN (aus `Sessions.tsx` herausgelöst, 2026-11-22: die Stunde der Klasse
 * `lesson/LessonHost.tsx` liest sie genauso).
 */

import { useEffect, useRef, useState } from 'react';

import { connect, openEvent, type ConnectOptions, type Credentials, type Pulse, type SessionEvent, type SessionRow } from './live';

export interface Opened { readonly event: SessionEvent; readonly body: unknown }

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const lastOf = <T,>(list: readonly T[]): T | undefined => list[list.length - 1];

/** Verbunden bleiben und jedes Ereignis öffnen, das dieser Browser öffnen kann. */
/** 2026-11-25 (LiveRoom) — der Raum nach dem letzten Abruf: wann er kam (Uhr dieses Geräts), was der Dienst sagte, die Abweichung der Uhr. */
export interface RoomPulse { readonly at: number; readonly pulse: Pulse | null; readonly offset: number }

export function useEvents(sessionId: string, cred: Credentials, keys: ReadonlyMap<number, Uint8Array>, intake: Uint8Array | null, options: ConnectOptions = {}): { opened: readonly Opened[]; raw: readonly SessionEvent[]; poke: () => void; live: boolean; session: SessionRow | null; pulse: RoomPulse | null; failing: string | null } {
  const [opened, setOpened] = useState<readonly Opened[]>([]);
  const [raw, setRaw] = useState<readonly SessionEvent[]>([]);
  const [session, setSession] = useState<SessionRow | null>(null);
  const conn = useRef<{ poke: () => void; realtime: () => boolean } | null>(null);
  const [live, setLive] = useState(false);
  const [pulse, setPulse] = useState<RoomPulse | null>(null);
  const [failing, setFailing] = useState<string | null>(null);
  useEffect(() => {
    setOpened([]);
    setRaw([]);
    const c = connect(sessionId, cred, {
      onEvents: (events) => {
        setRaw((was) => [...was, ...events]);
        void Promise.all(events.map(async (event) => ({ event, body: await openEvent(event, { session: (e) => keys.get(e), intake }) })))
          .then((done) => setOpened((was) => [...was, ...done].sort((a, b) => a.event.seq - b.event.seq)));
      },
      onState: (s) => { setSession(s); setFailing(null); },
      onPulse: (p, offset) => setPulse({ at: Date.now(), pulse: p, offset }),
      onError: setFailing
    }, 0, options);
    conn.current = c;
    const t = window.setInterval(() => setLive(c.realtime()), 3000);
    return () => { c.close(); window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, cred.join, cred.seat, cred.participant, keys.size, intake === null, options.room === true]);
  return { opened, raw, poke: () => conn.current?.poke(), live, session, pulse, failing };
}

export function bodies<T>(opened: readonly Opened[], kind: string): { body: T; event: SessionEvent }[] {
  return opened.filter((o) => o.event.kind === kind && isObject(o.body)).map((o) => ({ body: o.body as T, event: o.event }));
}

/** Die offenen (plain) Ereignisse einer Art, gelesen. */
export function plains<T>(raw: readonly SessionEvent[], kind: string): T[] {
  return raw.filter((e) => e.kind === kind && e.plain !== null).flatMap((e) => { try { return [JSON.parse(e.plain!) as T]; } catch { return []; } });
}
