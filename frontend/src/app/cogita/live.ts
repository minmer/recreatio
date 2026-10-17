/**
 * COGITA — SITZUNGEN IM BROWSER (COGITA.md §10): der Weg zum Dienst, die
 * Schlüssel, und die Leitung in Echtzeit.
 *
 * <b>Der Schlüssel einer Sitzung</b> kommt aus der Epoche ihres Bereichs,
 * abgeleitet wie der Chatschlüssel (`recreatio:v1:cogita-session:<id>:<epoch>`).
 * Mitglieder rechnen ihn selbst; ein Platz bekommt ihn verpackt für seine
 * P-256-Identität (wie in der Rozmowa); wer mit dem Link des Quiz kommt, hat
 * ihn hinter der Raute (`k=`), den der Dienst nie sieht.
 *
 * <b>Antworten und Anmeldungen</b> gehen an die Annahme des Bereichs: nur, wer
 * ihre Rolle hält (der Gastgeber, die Leiter), öffnet sie [I10]. Ohne Annahme
 * nimmt der Teilnehmer den Sitzungsschlüssel.
 *
 * <b>Echtzeit</b>: SignalR (JSON über WebSocket), ohne Bibliothek — Handschlag,
 * `Join`, und was der Hub schickt (`ev`, `state`, `pos`). Geht der WebSocket
 * nicht (ein Hosting ohne), fragt der Browser alle zwei Sekunden selbst.
 */

import { aad, derive, Field, fromBase64Url, KEY_SIZE, open, openText, seal, sealText, sha256, toBase64Url, unwrapKey, unwrapKeyP256, wrapKey, wrapKeyP256 } from '../core/crypto';
import { newId } from '../core/ids';
import { API, call } from '../core/session';
import type { AnswerSpec, Card } from './cardBasics';

export type SessionKind = 'live' | 'async' | 'sync' | 'story' | 'game' | 'shared';
export type SessionState = 'lobby' | 'running' | 'paused' | 'finished' | 'closed';

export const SESSION_KIND_LABEL: Record<SessionKind, string> = {
  live: 'Na żywo (gospodarz i ekran)',
  async: 'We własnym tempie (grupa)',
  sync: 'Kilka osób przy jednym urządzeniu',
  story: 'Opowieść z kodem',
  game: 'Gra w terenie',
  shared: 'Otwarty link'
};

export interface SessionRow {
  readonly sessionId: string;
  readonly areaId: string;
  readonly libraryId: string | null;
  readonly kind: SessionKind;
  readonly state: SessionState;
  readonly epoch: number;
  readonly titleSealed: string | null;
  readonly hostRoleId: string;
  readonly pagePath: string | null;
  readonly joinCode: string | null;
  readonly joinable: boolean;
  readonly endsAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly closedAt: string | null;
  readonly host: boolean;
}

export interface SessionEvent {
  readonly sessionId: string;
  readonly seq: number;
  readonly eventId: string;
  readonly kind: string;
  readonly authorRoleId: string | null;
  readonly authorPersonId: string | null;
  readonly authorSeatId: string | null;
  readonly epoch: number;
  readonly sealed: string | null;
  readonly plain: string | null;
  readonly createdAt: string;
}

/** Wie man in eine Sitzung kommt, wenn nicht mit dem Konto: ein Platz, das Geheimnis des Links, ein Code. */
export interface Credentials {
  readonly seat?: string;
  readonly join?: string;
  readonly links?: string;
}

const headersOf = (c: Credentials): Record<string, string> => ({
  ...(c.seat === undefined ? {} : { 'X-Recreatio-Seat': c.seat }),
  ...(c.join === undefined ? {} : { 'X-Cogita-Join': c.join })
});

/* -- Schlüssel ------------------------------------------------------------------------- */

const titleAad = (sessionId: string) => aad('cogita', 'session', sessionId, Field.CogitaSession, 1);
const eventAad = (eventId: string) => aad('cogita', 'event', eventId, Field.CogitaEvent, 1);
const seatKeyAad = (sessionId: string, seatId: string, epoch: number) => aad('cogita', 'session_key', `${sessionId}.${seatId}.${epoch}`, Field.CogitaSeatKey, 1);

/** Eine Karte OHNE Antwort — so geht sie zu den Teilnehmern [L3]. */
export function stripCard(card: Card): Card {
  const a = card.answer;
  const answer: AnswerSpec = (() => {
    switch (a.form) {
      case 'text': return { ...a, accepted: [] };
      case 'gap': return { ...a, accepted: [] };
      case 'number': return { ...a, values: [] };
      case 'date': return { ...a, values: [] };
      case 'one': return { ...a, correct: -1 };
      case 'many': return { ...a, correct: [] };
      case 'truefalse': return { ...a, value: false };
      case 'order': return { ...a, items: [] };
      case 'match': return { ...a, pairs: [] };
      case 'flash': return { ...a, back: [] };
      case 'code': return { ...a, reference: '', createInput: '' };
      case 'point': return a.on === 'map' ? { ...a, target: { lat: 0, lon: 0, r: 0 } } : { ...a, target: { x: 0, y: 0, r: 0 } };
    }
  })();
  return { ...card, answer, explain: [], fingerprint: '' };
}

/** Der Schlüssel der Sitzung in dieser Epoche — aus dem des Bereichs, nur in eine Richtung. */
export const sessionKeyOf = (areaKey: Uint8Array, sessionId: string, epoch: number): Promise<Uint8Array> =>
  derive(areaKey, `recreatio:v1:cogita-session:${sessionId}:${epoch}`, KEY_SIZE);

export async function sealTitle(key: Uint8Array, sessionId: string, title: string): Promise<string> {
  return toBase64Url(await sealText(key, titleAad(sessionId), title));
}

export async function openTitle(key: Uint8Array, row: SessionRow): Promise<string | null> {
  if (row.titleSealed === null) return null;
  try { return await openText(key, titleAad(row.sessionId), fromBase64Url(row.titleSealed)); } catch { return null; }
}

/** Den Sitzungsschlüssel einem Platz geben — verpackt für seine P-256-Identität. */
export async function wrapForSeat(sessionId: string, seatId: string, epoch: number, wrapPublicKey: string, key: Uint8Array): Promise<string> {
  return toBase64Url(await wrapKeyP256(fromBase64Url(wrapPublicKey), seatKeyAad(sessionId, seatId, epoch), key));
}

export async function unwrapForSeat(sessionId: string, seatId: string, epoch: number, wrapPrivate: Uint8Array, sealed: string): Promise<Uint8Array | null> {
  try { return await unwrapKeyP256(wrapPrivate, seatKeyAad(sessionId, seatId, epoch), fromBase64Url(sealed)); } catch { return null; }
}

/* -- Ereignisse versiegeln ---------------------------------------------------------------- */

/*
 * Die Hülle eines Ereignisses beginnt mit einem Byte:
 *   1  unter dem Sitzungsschlüssel (die Epoche steht am Ereignis)
 *   2  für die Annahme: [2 Bytes Länge][verpackter Zufallsschlüssel][Hülle]
 */
export async function sealForSession(key: Uint8Array, eventId: string, body: unknown): Promise<string> {
  const inner = await seal(key, eventAad(eventId), new TextEncoder().encode(JSON.stringify(body)));
  const out = new Uint8Array(1 + inner.length);
  out[0] = 1;
  out.set(inner, 1);
  return toBase64Url(out);
}

export async function sealForIntake(intake: Uint8Array, eventId: string, body: unknown): Promise<string> {
  const content = crypto.getRandomValues(new Uint8Array(KEY_SIZE));
  const wrapped = await wrapKey(intake, eventAad(`${eventId}.key`), content);
  const inner = await seal(content, eventAad(eventId), new TextEncoder().encode(JSON.stringify(body)));
  const out = new Uint8Array(3 + wrapped.length + inner.length);
  out[0] = 2;
  out[1] = wrapped.length >> 8;
  out[2] = wrapped.length & 0xff;
  out.set(wrapped, 3);
  out.set(inner, 3 + wrapped.length);
  return toBase64Url(out);
}

/** Ein Ereignis öffnen — mit dem Sitzungsschlüssel seiner Epoche oder dem privaten der Annahme. `null`: nicht für diesen Browser. */
export async function openEvent(event: SessionEvent, keys: { readonly session: (epoch: number) => Uint8Array | undefined; readonly intake?: Uint8Array | null }): Promise<unknown> {
  if (event.plain !== null && event.sealed === null) {
    try { return JSON.parse(event.plain) as unknown; } catch { return null; }
  }
  if (event.sealed === null) return null;
  try {
    const blob = fromBase64Url(event.sealed);
    if (blob[0] === 1) {
      const key = keys.session(event.epoch);
      if (key === undefined) return null;
      return JSON.parse(new TextDecoder().decode(await open(key, eventAad(event.eventId), blob.slice(1)))) as unknown;
    }
    if (blob[0] === 2 && keys.intake != null) {
      const length = (blob[1] << 8) | blob[2];
      const content = await unwrapKey(keys.intake, eventAad(`${event.eventId}.key`), blob.slice(3, 3 + length));
      return JSON.parse(new TextDecoder().decode(await open(content, eventAad(event.eventId), blob.slice(3 + length)))) as unknown;
    }
  } catch {
    return null;
  }
  return null;
}

/* -- Der Weg zum Dienst ------------------------------------------------------------------- */

export interface NewSession {
  readonly areaId: string;
  readonly libraryId: string | null;
  readonly kind: SessionKind;
  readonly epoch: number;
  readonly title: string;
  readonly hostRoleId: string;
  readonly pagePath?: string | null;
  /** Mitmachen per Link (ein Geheimnis) und/oder per Code. */
  readonly joinLink: boolean;
  readonly joinCode: boolean;
  readonly endsAt?: string | null;
}

/** Eine Sitzung anlegen. Gibt sie zurück — und das Geheimnis des Links (nur hier, nie beim Dienst). */
export async function createSession(input: NewSession, areaKey: Uint8Array): Promise<{ session: SessionRow; secret: string | null; key: Uint8Array }> {
  const sessionId = newId();
  const key = await sessionKeyOf(areaKey, sessionId, input.epoch);
  const secret = input.joinLink ? toBase64Url(crypto.getRandomValues(new Uint8Array(24))) : null;
  const session = await call<SessionRow>('/workspace/cogita/sessions', {
    method: 'POST',
    body: JSON.stringify({
      sessionId, areaId: input.areaId, libraryId: input.libraryId, kind: input.kind, epoch: input.epoch,
      titleSealed: await sealTitle(key, sessionId, input.title.trim() || 'Sesja'), hostRoleId: input.hostRoleId,
      pagePath: input.pagePath ?? null, joinHash: secret === null ? null : toBase64Url(await sha256(secret)),
      joinCode: input.joinCode, endsAt: input.endsAt ?? null
    })
  });
  return { session, secret, key };
}

export const loadSessions = (areaId?: string, libraryId?: string): Promise<{ sessions: readonly SessionRow[] }> => {
  const q = [areaId === undefined ? '' : `areaId=${encodeURIComponent(areaId)}`, libraryId === undefined ? '' : `libraryId=${encodeURIComponent(libraryId)}`].filter(Boolean).join('&');
  return call(`/workspace/cogita/sessions${q === '' ? '' : `?${q}`}`);
};

export const loadSession = (id: string, cred: Credentials = {}): Promise<{ session: SessionRow; seatId: string | null; keys: readonly { epoch: number; keySealed: string }[]; intake: boolean }> =>
  call(`/cogita/session/${encodeURIComponent(id)}`, {}, headersOf(cred));

export const loadEvents = (id: string, after: number, cred: Credentials = {}): Promise<{ session: SessionRow; events: readonly SessionEvent[]; last: number }> =>
  call(`/cogita/session/${encodeURIComponent(id)}/events?after=${after}`, {}, headersOf(cred));

export interface EventOut {
  readonly eventId: string;
  readonly kind: string;
  readonly epoch: number;
  readonly sealed?: string;
  readonly plain?: string;
  readonly authorRoleId?: string;
  readonly authorPersonId?: string;
}

export const postEvents = (id: string, events: readonly EventOut[], cred: Credentials = {}): Promise<{ events: readonly { eventId: string; seq: number }[] }> =>
  call(`/cogita/session/${encodeURIComponent(id)}/events`, { method: 'POST', body: JSON.stringify({ events }) }, headersOf(cred));

export const setSessionState = (id: string, state: SessionState, cred: Credentials = {}, more: { endsAt?: string | null } = {}): Promise<SessionRow> =>
  call(`/cogita/session/${encodeURIComponent(id)}/state`, { method: 'POST', body: JSON.stringify({ state, ...more }) }, headersOf(cred));

export const joinByCode = (code: string): Promise<{ session: SessionRow; join: string }> =>
  call('/cogita/join', { method: 'POST', body: JSON.stringify({ code: code.trim().toUpperCase() }) });

export const seatSessions = (token: string): Promise<{ sessions: readonly { session: SessionRow; keys: readonly { epoch: number; keySealed: string }[] }[] }> =>
  call(`/seat/${encodeURIComponent(token)}/cogita/sessions`);

export const deleteSession = (id: string): Promise<{ deleted: boolean }> =>
  call(`/workspace/cogita/session/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Den Plätzen des Bereichs den Schlüssel geben, die ihn noch nicht haben — still, wie in der Rozmowa. */
export async function deliverSessionKeys(sessionId: string, keys: ReadonlyMap<number, Uint8Array>, byRoleId: string): Promise<number> {
  const { seats } = await call<{ seats: readonly { seatId: string; wrapPublicKey: string; epochs: readonly number[] }[] }>(`/workspace/cogita/session/${encodeURIComponent(sessionId)}/seats`);
  const out: { seatId: string; epoch: number; keySealed: string }[] = [];
  for (const seat of seats) {
    for (const [epoch, key] of keys) {
      if (seat.epochs.includes(epoch)) continue;
      try { out.push({ seatId: seat.seatId, epoch, keySealed: await wrapForSeat(sessionId, seat.seatId, epoch, seat.wrapPublicKey, key) }); } catch { /* nächster */ }
    }
  }
  let granted = 0;
  for (let at = 0; at < out.length; at += 400) {
    const done = await call<{ granted: number }>(`/workspace/cogita/session/${encodeURIComponent(sessionId)}/keys`, { method: 'POST', body: JSON.stringify({ byRoleId, keys: out.slice(at, at + 400) }) });
    granted += done.granted;
  }
  return granted;
}

/* -- Ein Link zum Mitmachen --------------------------------------------------------------- */

/** Der Link für das Quiz: die Seite, die Sitzung, das Geheimnis und der Schlüssel (hinter der Raute). */
export function joinLink(pagePath: string, sessionId: string, secret: string, key: Uint8Array, epoch: number): string {
  const base = typeof window === 'undefined' ? 'https://recreatio.pl/' : `${window.location.origin}${window.location.pathname}`;
  return `${base}#/${pagePath}?sesja=${encodeURIComponent(sessionId)}&j=${encodeURIComponent(secret)}&k=${toBase64Url(key)}&e=${epoch}`;
}

export interface Ticket {
  readonly sessionId: string;
  readonly join: string;
  readonly key: Uint8Array | null;
  readonly epoch: number | null;
}

const TICKETS = 'recreatio:cogita:tickets';

/** Was ein Link zum Mitmachen trug — aus der Adresse genommen (und daraus entfernt), in diesem Tab behalten. */
export function ticketFromAddress(hash: string): Ticket | null {
  const at = hash.indexOf('?');
  if (at < 0) return null;
  const params = new URLSearchParams(hash.slice(at + 1));
  const sessionId = params.get('sesja');
  const join = params.get('j');
  if (sessionId === null || join === null) return null;
  const k = params.get('k');
  const e = params.get('e');
  const ticket: Ticket = { sessionId, join, key: k === null ? null : fromBase64Url(k), epoch: e === null ? null : Number(e) };
  keepTicket(ticket);
  return ticket;
}

export function keepTicket(ticket: Ticket): void {
  try {
    const all = JSON.parse(sessionStorage.getItem(TICKETS) ?? '{}') as Record<string, unknown>;
    all[ticket.sessionId] = { join: ticket.join, key: ticket.key === null ? null : toBase64Url(ticket.key), epoch: ticket.epoch };
    sessionStorage.setItem(TICKETS, JSON.stringify(all));
  } catch { /* nur in diesem Bild */ }
}

export function ticketOf(sessionId: string): Ticket | null {
  try {
    const all = JSON.parse(sessionStorage.getItem(TICKETS) ?? '{}') as Record<string, { join?: string; key?: string | null; epoch?: number | null }>;
    const one = all[sessionId];
    if (one?.join === undefined) return null;
    return { sessionId, join: one.join, key: typeof one.key === 'string' ? fromBase64Url(one.key) : null, epoch: typeof one.epoch === 'number' ? one.epoch : null };
  } catch {
    return null;
  }
}

/** Wer in dieser Sitzung mitmacht (ohne Konto): eine Kennung je Sitzung und Gerät, die bleibt, solange der Tab lebt. */
export function participantId(sessionId: string): string {
  const slot = `recreatio:cogita:me:${sessionId}`;
  try {
    const had = localStorage.getItem(slot);
    if (had !== null) return had;
    const made = newId();
    localStorage.setItem(slot, made);
    return made;
  } catch {
    return newId();
  }
}

/* -- Die Leitung ---------------------------------------------------------------------------------- */

const RS = '\u001e';

export interface Connection {
  /** Ob gerade der WebSocket trägt (sonst fragt der Browser selbst). */
  readonly realtime: () => boolean;
  readonly close: () => void;
  /** Jetzt nachsehen (etwa nach dem eigenen Schreiben). */
  readonly poke: () => void;
}

export interface Listen {
  readonly onEvents: (events: readonly SessionEvent[]) => void;
  readonly onState?: (session: SessionRow) => void;
  readonly onPosition?: (pos: { player: string; team: string | null; lat: number; lon: number; accuracy: number | null; at: string }) => void;
  readonly onError?: (message: string) => void;
}

/**
 * MIT DER SITZUNG VERBUNDEN BLEIBEN: der Hub schickt, was neu ist; fällt er
 * aus oder geht er nicht, holt der Browser alle zwei Sekunden selbst (und
 * nach jedem eigenen Schreiben sofort). Ereignisse kommen nie doppelt und in
 * ihrer Reihenfolge an.
 */
export function connect(sessionId: string, cred: Credentials, listen: Listen, after = 0): Connection {
  let last = after;
  let closed = false;
  let socket: WebSocket | null = null;
  let live = false;
  let timer: number | null = null;
  let fetching = false;
  let again = false;

  const deliver = (events: readonly SessionEvent[]) => {
    const fresh = events.filter((e) => e.seq > last).sort((a, b) => a.seq - b.seq);
    if (fresh.length === 0) return;
    last = fresh[fresh.length - 1].seq;
    listen.onEvents(fresh);
  };

  const pull = async () => {
    if (closed) return;
    if (fetching) { again = true; return; }
    fetching = true;
    try {
      const done = await loadEvents(sessionId, last, cred);
      deliver(done.events);
      listen.onState?.(done.session);
    } catch (e) {
      listen.onError?.(e instanceof Error ? e.message : 'Nie udało się połączyć z sesją.');
    } finally {
      fetching = false;
      if (again) { again = false; void pull(); }
    }
  };

  const schedule = () => {
    if (closed) return;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => { void pull().finally(schedule); }, live ? 15_000 : 2000);
  };

  const open = () => {
    if (closed || typeof WebSocket === 'undefined') return;
    const base = API.startsWith('http') ? API.replace(/^http/, 'ws') : `${window.location.origin.replace(/^http/, 'ws')}${API}`;
    let ws: WebSocket;
    try { ws = new WebSocket(`${base}/cogita/hub`); } catch { return; }
    socket = ws;
    let handshaken = false;
    ws.onopen = () => { ws.send(`${JSON.stringify({ protocol: 'json', version: 1 })}${RS}`); };
    ws.onmessage = (message) => {
      for (const frame of String(message.data).split(RS)) {
        if (frame.trim() === '') continue;
        let parsed: { type?: number; target?: string; arguments?: unknown[]; invocationId?: string; result?: { ok?: boolean }; error?: string };
        try { parsed = JSON.parse(frame) as typeof parsed; } catch { continue; }
        if (!handshaken) {
          handshaken = true;
          if (parsed.error !== undefined) { ws.close(); return; }
          ws.send(`${JSON.stringify({ type: 1, invocationId: '1', target: 'Join', arguments: [sessionId, cred.links ?? null, cred.seat ?? null, cred.join ?? null] })}${RS}`);
          continue;
        }
        if (parsed.type === 3 && parsed.invocationId === '1') {
          live = parsed.result?.ok === true;
          if (!live) ws.close();
          void pull();
          schedule();
          continue;
        }
        if (parsed.type === 6) { ws.send(`${JSON.stringify({ type: 6 })}${RS}`); continue; }
        if (parsed.type === 7) { ws.close(); continue; }
        if (parsed.type === 1 && parsed.target === 'ev' && Array.isArray(parsed.arguments)) {
          const event = parsed.arguments[0] as SessionEvent;
          if (event.seq === last + 1) deliver([event]);
          else if (event.seq > last) void pull();
        }
        if (parsed.type === 1 && parsed.target === 'state' && Array.isArray(parsed.arguments)) listen.onState?.(parsed.arguments[0] as SessionRow);
        if (parsed.type === 1 && parsed.target === 'pos' && Array.isArray(parsed.arguments)) listen.onPosition?.(parsed.arguments[0] as never);
      }
    };
    ws.onclose = () => {
      live = false;
      socket = null;
      schedule();
      if (!closed) window.setTimeout(open, 5000 + Math.random() * 5000);
    };
    ws.onerror = () => { /* onclose folgt */ };
  };

  void pull();
  schedule();
  open();

  return {
    realtime: () => live,
    poke: () => { void pull(); },
    close: () => {
      closed = true;
      if (timer !== null) window.clearTimeout(timer);
      socket?.close();
    }
  };
}
