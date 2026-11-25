/**
 * 2026-11-24 (Tryb prowadzony) — WAS DIE KLASSE SIEHT, solange die Lehrerin führt: oben „Prowadzi nauczyciel", darunter genau ihr Inhalt
 * — ihre Karte (geführt: dieselbe Kamera, dasselbe Gewählte, kein Bedienen), eine Folie, eine Frage zum Beantworten (eine Stimme wie in
 * jeder Stunde) oder eine Wahl. Kein Weiter, kein Wegnavigieren. Dieselbe Ansicht für die Leinwand (ohne Stimme).
 *
 * `FollowGate` sucht für die Klasse (ein Konto: seine Sitzungen; eine Person ohne Konto: die ihres Platzes) eine laufende Folge-Stunde
 * und legt die Ansicht ÜBER die Seite — ist sie zu, ist man wieder, wo man war.
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { myEpochKeys } from '../../areas/area';
import { useT } from '../../core/i18n';
import { newId } from '../../core/ids';
import { useMe, type Me } from '../../core/me';
import type { Who } from '../../core/session';
import { partSize } from '../../pages/part';
import { usePerson } from '../../pages/pagePerson';
import { TexText } from '../../ui/tex/Tex';
import { loadSeatChats, seatIdentity } from '../../seats/seatChat';
import { seatsExactly } from '../../seats/seatKeep';
import { seatAreaKeys, seatPassOf, type SeatPass } from '../holders';
import { LessonPlay } from '../lesson/LessonHost';
import { intakeOf } from '../learn';
import { loadSessions, postEvents, sealForIntake, sealForSession, seatSessions, sessionKeyOf, unwrapForSeat, type Credentials, type SessionRow } from '../live';
import { plains, useEvents, type Opened, type RoomPulse } from '../sessionEvents';
import { followMetaOf } from './followHost';
import { followNow } from './followModel';
import { FollowViewContext } from './followView';
import './follow.css';

const ViewView = lazy(() => import('../../pages/parts/viewViews').then((m) => ({ default: m.ViewView })));

/** Die Ansicht der Klasse (und der Leinwand) aus den Ereignissen einer Folge-Stunde. */
export function FollowScreen({ session, opened, slots, sent, onVote, projector = false, room = null }: {
  session: SessionRow;
  opened: readonly Opened[];
  slots: readonly { readonly index: number; readonly form: string; readonly count: number }[];
  sent: ReadonlyMap<number, unknown>;
  /** Eine Stimme (Schüler) — `null`: nur ansehen (Leinwand). */
  onVote: ((index: number, given: unknown) => void) | null;
  projector?: boolean;
  /** 2026-11-25 (LiveRoom) — beim Schüler: wie die Verbindung steht und ob er angemeldet ist. */
  room?: { readonly state: RoomState; readonly joined: boolean } | null;
}) {
  const t = useT();
  const now = followNow(opened, session.state === 'closed');
  const size = useMemo(() => partSize({ colSpan: 6, rowSpan: 5 }), []);
  const map = now.map;
  const view = useMemo(() => (map === null ? null : { map }), [map]);
  const overlay = now.content === 'slide' || now.content === 'question' || now.content === 'choice';
  return (
    <div className={`cg-follow${projector ? ' is-projector' : ''}`} data-follow-screen={now.content} data-follow-session={session.sessionId}>
      <p className="cg-follow-banner" role="status"><span className="cg-follow-dot" aria-hidden="true" />{t('cogitaFollow.screen.banner')}{now.config !== null && now.config.title !== '' && <> · <TexText text={now.config.title} /></>}
        {room !== null && (
          <span className={`cg-follow-room is-${room.state}`} data-follow-room-state={room.state}>
            {room.state === 'ok' ? (room.joined ? t('cogitaFollow.screen.roomOk') : t('cogitaFollow.screen.roomJoining'))
              : room.state === 'teacher-away' ? t('cogitaFollow.screen.roomTeacherAway') : t('cogitaFollow.screen.roomDown')}
          </span>
        )}
      </p>
      <div className="cg-follow-body">
        {now.config !== null && map !== null && view !== null && (
          <div className={`cg-follow-map${overlay ? ' is-under' : ''}`} data-follow-map={map.view} data-follow-cam={map.cam === null ? '' : `${map.cam.cx.toFixed(1)},${map.cam.cy.toFixed(1)},${map.cam.rot.toFixed(0)}`} aria-hidden={overlay ? true : undefined}>
            <FollowViewContext.Provider value={view}>
              <Suspense fallback={null}>
                <ViewView config={{ title: '', library: now.config.library, view: map.view, mode: 'krajobraz', answers: now.config.classArea, rewards: '', switching: false }}
                  ctx={{ moduleId: `follow-${session.sessionId}`, size, whole: true }} />
              </Suspense>
            </FollowViewContext.Provider>
          </div>
        )}
        {overlay && (
          <div className="cg-follow-content" data-follow-content={now.content}>
            <LessonPlay sessionId={session.sessionId} opened={opened} slots={slots} learner={null} sent={sent} onVote={onVote ?? (() => undefined)} />
          </div>
        )}
        {now.content === 'none' && <p className="cg-follow-wait" data-follow-wait="">{t('cogitaFollow.screen.wait')}</p>}
      </div>
    </div>
  );
}

/* -- Der Schüler: suchen, folgen, abstimmen ------------------------------------------------------------------------------ */

/**
 * 2026-11-25 (LiveRoom, Eigentümer: „eine echte Live-Stunde: wer mit einem neuen Link kommt, ist dabei; jede Sekunde Verbindung") —
 * DER WEG DES SCHÜLERS, Schritt für Schritt und sichtbar:
 *
 * <code>
 *   suchen       alle 3 s: läuft in dieser Baza eine Folge-Stunde, die ich (Konto) oder mein Platz lesen darf?
 *   Schlüssel    SELBST GERECHNET aus dem Schlüssel der Klasse — ein Konto aus seinem Ring, ein Platz aus der Rolle, die ihm der
 *                Link der Klasse gab (`seatAreaKeys`). Keine Identität, kein Warten auf die Lehrerin. Nur wenn das fehlt: der
 *                verpackte Schlüssel, den ihr Gerät Plätzen alle 5 s gibt (der alte Weg, als Rückfall).
 *   anmelden     „join" (versiegelt für die Przyjęcia der Klasse; ohne sie unter dem Schlüssel der Stunde) — wiederholt, bis es
 *                angekommen ist
 *   im Raum      jede Sekunde ein Abruf (zugleich der Herzschlag: die Lehrerin sieht, wer da ist); der Dienst sagt, wann die
 *                Lehrerin zuletzt da war — die Zeile oben sagt es dem Schüler
 * </code>
 */
type Stage = { readonly code: 'nokey' | 'noclass' | 'search'; readonly why: string };

interface Found {
  readonly row: SessionRow;
  readonly cred: Credentials;
  readonly keys: ReadonlyMap<number, Uint8Array>;
  readonly participant: string;
  readonly name: string;
}

const deriveAll = async (sessionId: string, area: ReadonlyMap<number, Uint8Array>): Promise<Map<number, Uint8Array>> => {
  const keys = new Map<number, Uint8Array>();
  for (const [e, k] of area) keys.set(e, await sessionKeyOf(k, sessionId, e));
  return keys;
};

function useFollowSession(libraryId: string, me: Me | null | undefined, pass: SeatPass | null, seatName: string, onStage: (s: Stage | null) => void): Found | null {
  const [found, setFound] = useState<Found | null>(null);
  const stageRef = useRef(onStage);
  stageRef.current = onStage;
  const passSig = pass?.token ?? '';
  useEffect(() => {
    let alive = true;
    let waiting = false;
    let noClass = false;
    /* Die Schlüssel der Klasse, die der Platz hält — je Bereich gemerkt (und wieder geholt, solange die Epoche fehlt). */
    const held = new Map<string, Map<number, Uint8Array>>();
    let wrapPrivate: Uint8Array | null | undefined;
    const look = async (): Promise<Found | null> => {
      waiting = false;
      noClass = false;
      if (pass !== null) {
        const { sessions } = await seatSessions(pass.token);
        for (const one of sessions) {
          const s = one.session;
          if (s.kind !== 'lesson' || s.state !== 'running' || (s.libraryId ?? '').toLowerCase() !== libraryId.toLowerCase()) continue;
          if (!(await followMetaOf(s.sessionId, { seat: pass.token })).follow) continue;
          let area = held.get(s.areaId);
          if (area === undefined || !area.has(s.epoch)) {
            area = await seatAreaKeys(pass, s.areaId).catch(() => new Map<number, Uint8Array>());
            held.set(s.areaId, area);
          }
          const keys = await deriveAll(s.sessionId, area);
          if (!keys.has(s.epoch) && one.keys.length > 0) {
            /* Der Rückfall: der verpackte Schlüssel (dafür braucht es die Identität des Platzes). */
            if (wrapPrivate === undefined) {
              wrapPrivate = await (async () => {
                const { identity } = await loadSeatChats(pass.token);
                if (identity === null) return null;
                return (await seatIdentity(pass.token, pass.seatId, pass.seatKey, identity)).wrapPrivateKey;
              })().catch(() => null);
            }
            if (wrapPrivate !== null) {
              for (const k of one.keys) {
                if (keys.has(k.epoch)) continue;
                const key = await unwrapForSeat(s.sessionId, pass.seatId, k.epoch, wrapPrivate, k.keySealed);
                if (key !== null) keys.set(k.epoch, key);
              }
            }
          }
          if (!keys.has(s.epoch)) { waiting = true; noClass ||= area.size === 0; continue; }
          return { row: s, cred: { seat: pass.token, participant: pass.seatId.toLowerCase() }, keys, participant: pass.seatId, name: seatName };
        }
        return null;
      }
      if (me == null) return null;
      const { sessions } = await loadSessions(undefined, libraryId);
      for (const s of sessions.filter((x) => x.kind === 'lesson' && x.state === 'running' && !x.host).slice(0, 8)) {
        if (!(await followMetaOf(s.sessionId)).follow) continue;
        const keys = await deriveAll(s.sessionId, await myEpochKeys(me.ring, s.areaId).catch(() => new Map<number, Uint8Array>()));
        if (!keys.has(s.epoch)) { waiting = true; continue; }
        return { row: s, cred: { participant: me.person.id.toLowerCase() }, keys, participant: me.person.id, name: me.names.get(me.person.id) ?? '' };
      }
      return null;
    };
    let timer = 0;
    const tick = () => {
      void look().then((f) => {
        if (!alive) return;
        stageRef.current(f === null && waiting ? { code: noClass ? 'noclass' : 'nokey', why: '' } : null);
        setFound((was) => (was !== null && f !== null && was.row.sessionId === f.row.sessionId ? was : f));
      }, (e: unknown) => {
        console.warn('follow: search failed', e);
        if (alive) stageRef.current({ code: 'search', why: e instanceof Error ? e.message : String(e) });
      }).finally(() => { if (alive) timer = window.setTimeout(tick, 3000); });
    };
    tick();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [libraryId, me, passSig]); // eslint-disable-line react-hooks/exhaustive-deps
  return found;
}

const deviceOf = (): string => {
  try { const k = 'recreatio:cogita:device'; let d = localStorage.getItem(k); if (d === null) { d = newId(); localStorage.setItem(k, d); } return d; } catch { return newId(); }
};

/** Wie die Verbindung gerade steht — aus dem letzten Abruf (jede Sekunde). */
export type RoomState = 'ok' | 'teacher-away' | 'down';

export function roomStateOf(pulse: RoomPulse | null, failing: string | null, now: number): RoomState {
  if (failing !== null || pulse === null || now - pulse.at > 6000) return 'down';
  if (pulse.pulse === null) return 'ok';
  return pulse.pulse.hostAgo === null || pulse.pulse.hostAgo > 10_000 ? 'teacher-away' : 'ok';
}

const ROOM = { room: true } as const;

/** Folgen: die Ereignisse (jede Sekunde), die eigene Stimme, „ich bin da" — wiederholt, bis es angekommen ist. */
function FollowLive({ found }: { found: Found }) {
  const { opened, raw, poke, session, pulse, failing } = useEvents(found.row.sessionId, found.cred, found.keys, null, ROOM);
  const [intake, setIntake] = useState<Uint8Array | null | undefined>(undefined);
  const [sent, setSent] = useState<ReadonlyMap<number, unknown>>(new Map());
  const [joined, setJoined] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const device = useMemo(deviceOf, []);
  /* Die Przyjęcia der Klasse — fehlt sie, gehen Anmeldung und Stimmen unter dem Schlüssel der Stunde (andere Schüler bekommen sie nie). */
  useEffect(() => {
    let alive = true;
    void intakeOf(found.row.areaId).then((k) => { if (alive) setIntake(k); }, () => { if (alive) setIntake(null); });
    return () => { alive = false; };
  }, [found.row.areaId]);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  const post = async (kind: 'join' | 'answer', body: unknown) => {
    const eventId = newId();
    const viaIntake = intake != null;
    const sealed = viaIntake ? await sealForIntake(intake, eventId, body) : await sealForSession(found.keys.get(found.row.epoch)!, eventId, body);
    await postEvents(found.row.sessionId, [{ eventId, kind, epoch: viaIntake ? 0 : found.row.epoch, sealed }], found.cred);
    poke();
  };
  /* Anmelden, sobald klar ist, wohin — bei einem Fehler nach 3 s wieder, bis es angekommen ist. */
  useEffect(() => {
    if (intake === undefined || joined) return undefined;
    let alive = true;
    let timer = 0;
    const tryJoin = () => {
      void post('join', { participant: found.participant, name: found.name || found.participant.slice(-4), team: null, device })
        .then(() => { if (alive) setJoined(true); }, (e: unknown) => { console.warn('follow: join failed', e); if (alive) timer = window.setTimeout(tryJoin, 3000); });
    };
    tryJoin();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [intake, joined]); // eslint-disable-line react-hooks/exhaustive-deps
  const row = session ?? found.row;
  if (row.state === 'closed' || row.state === 'finished') return null;
  const state = roomStateOf(pulse, failing, now);
  return (
    <div className="cg-follow-overlay" data-follow-overlay={found.row.sessionId} data-follow-joined={joined ? '1' : '0'}>
      <FollowScreen session={row} opened={opened} slots={plains<{ index: number; form: string; count: number }>(raw, 'slot')} sent={sent} room={{ state, joined }}
        onVote={(index, given) => {
          setSent((m) => new Map(m).set(index, given));
          void post('answer', { participant: found.participant, device, index, given, at: Date.now() + (pulse?.offset ?? 0) }).catch(() => undefined);
        }} />
    </div>
  );
}

/**
 * IN DER KLASSE: führt die Lehrerin gerade (eine laufende Folge-Stunde dieser Baza), liegt ihre Ansicht über der Seite. Unter einem
 * `PersonProvider` gilt die gewählte Person ohne Konto; ohne Konto auf der Klassenseite (`aim`) der Platz, den dieser Browser für
 * sie hält (der eigene Link); sonst das Konto.
 */
export function FollowGate({ libraryId, who, aim }: { libraryId: string; who: Who | null; aim?: string }) {
  const me = useMe(who);
  const person = usePerson();
  const seat = person?.chosen?.kind === 'seat' ? person.chosen.seat : null;
  const kept = seat === null && who === null && aim !== undefined ? seatsExactly(aim)[0] ?? null : null;
  const t = useT();
  const [pass, setPass] = useState<SeatPass | null>(null);
  const [passProblem, setPassProblem] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const asSeat = seat !== null || kept !== null;
  useEffect(() => {
    let alive = true;
    setPassProblem(null);
    setPass(null);
    if (!asSeat) return undefined;
    void seatPassOf(seat, kept).then((p) => {
      if (!alive) return;
      setPass(p);
      if (p === null) setPassProblem(t('cogitaFollow.screen.noSeatKey'));
    }, (e: unknown) => {
      console.warn('follow: the seat could not be opened', e);
      if (alive) setPassProblem(e instanceof Error ? e.message : String(e));
    });
    return () => { alive = false; };
  }, [seat?.token, kept]); // eslint-disable-line react-hooks/exhaustive-deps
  const found = useFollowSession(libraryId, asSeat ? null : me, pass, person?.chosen?.name ?? '', setStage);
  if (found !== null) return <FollowLive key={found.row.sessionId} found={found} />;
  /* Woran es hängt — nur, wenn etwas hängt. */
  const said = passProblem !== null ? { code: 'holder', text: t('cogitaFollow.screen.problemHolder', { why: passProblem }) }
    : stage?.code === 'nokey' ? { code: 'nokey', text: t('cogitaFollow.screen.problemKey') }
    : stage?.code === 'noclass' ? { code: 'noclass', text: t('cogitaFollow.screen.problemNoClass') }
    : stage?.code === 'search' ? { code: 'search', text: t('cogitaFollow.screen.problemSearch', { why: stage.why }) }
    : null;
  return said === null ? null : <p className="wk-note cg-follow-problem" role="status" data-follow-problem={said.code}>{said.text}</p>;
}
