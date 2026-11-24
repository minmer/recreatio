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
import { seatsExactly } from '../../seats/seatKeep';
import { holderOfKeptSeat, holderOfSeat } from '../holders';
import { LessonPlay } from '../lesson/LessonHost';
import { intakeOf, type Holder } from '../learn';
import { loadSessions, postEvents, sealForIntake, seatSessions, sessionKeyOf, unwrapForSeat, type Credentials, type SessionRow } from '../live';
import { plains, useEvents, type Opened } from '../sessionEvents';
import { followMetaOf } from './followHost';
import { followNow } from './followModel';
import { FollowViewContext } from './followView';
import './follow.css';

const ViewView = lazy(() => import('../../pages/parts/viewViews').then((m) => ({ default: m.ViewView })));

/** Die Ansicht der Klasse (und der Leinwand) aus den Ereignissen einer Folge-Stunde. */
export function FollowScreen({ session, opened, slots, sent, onVote, projector = false }: {
  session: SessionRow;
  opened: readonly Opened[];
  slots: readonly { readonly index: number; readonly form: string; readonly count: number }[];
  sent: ReadonlyMap<number, unknown>;
  /** Eine Stimme (Schüler) — `null`: nur ansehen (Leinwand). */
  onVote: ((index: number, given: unknown) => void) | null;
  projector?: boolean;
}) {
  const t = useT();
  const now = followNow(opened, session.state === 'closed');
  const size = useMemo(() => partSize({ colSpan: 6, rowSpan: 5 }), []);
  const map = now.map;
  const view = useMemo(() => (map === null ? null : { map }), [map]);
  const overlay = now.content === 'slide' || now.content === 'question' || now.content === 'choice';
  return (
    <div className={`cg-follow${projector ? ' is-projector' : ''}`} data-follow-screen={now.content} data-follow-session={session.sessionId}>
      <p className="cg-follow-banner" role="status"><span className="cg-follow-dot" aria-hidden="true" />{t('cogitaFollow.screen.banner')}{now.config !== null && now.config.title !== '' && <> · <TexText text={now.config.title} /></>}</p>
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

interface Found {
  readonly row: SessionRow;
  readonly cred: Credentials;
  readonly keys: ReadonlyMap<number, Uint8Array>;
  readonly participant: string;
  readonly name: string;
}

/** Eine laufende Folge-Stunde dieser Baza, die ich (Konto) oder mein Platz lesen darf — alle 8 s neu gesucht. */
function useFollowSession(libraryId: string, me: Me | null | undefined, holder: Holder | null, seatName: string): Found | null {
  const [found, setFound] = useState<Found | null>(null);
  const holderSig = holder?.kind === 'seat' ? holder.token : '';
  useEffect(() => {
    let alive = true;
    const look = async (): Promise<Found | null> => {
      if (holder?.kind === 'seat') {
        const { sessions } = await seatSessions(holder.token);
        for (const one of sessions) {
          const s = one.session;
          if (s.kind !== 'lesson' || s.state !== 'running' || (s.libraryId ?? '').toLowerCase() !== libraryId.toLowerCase()) continue;
          if (!(await followMetaOf(s.sessionId, { seat: holder.token })).follow) continue;
          const keys = new Map<number, Uint8Array>();
          for (const k of one.keys) { const key = await unwrapForSeat(s.sessionId, holder.seatId, k.epoch, holder.wrapPrivate, k.keySealed); if (key !== null) keys.set(k.epoch, key); }
          if (!keys.has(s.epoch)) continue;
          return { row: s, cred: { seat: holder.token }, keys, participant: holder.seatId, name: seatName };
        }
        return null;
      }
      if (me == null) return null;
      const { sessions } = await loadSessions(undefined, libraryId);
      for (const s of sessions.filter((x) => x.kind === 'lesson' && x.state === 'running' && !x.host).slice(0, 8)) {
        if (!(await followMetaOf(s.sessionId)).follow) continue;
        const area = await myEpochKeys(me.ring, s.areaId).catch(() => new Map<number, Uint8Array>());
        const keys = new Map<number, Uint8Array>();
        for (const [e, k] of area) keys.set(e, await sessionKeyOf(k, s.sessionId, e));
        if (!keys.has(s.epoch)) continue;
        return { row: s, cred: {}, keys, participant: me.person.id, name: me.names.get(me.person.id) ?? '' };
      }
      return null;
    };
    const tick = () => { void look().then((f) => { if (alive) setFound((was) => (was !== null && f !== null && was.row.sessionId === f.row.sessionId ? was : f)); }, () => undefined); };
    tick();
    const id = window.setInterval(tick, 8000);
    return () => { alive = false; window.clearInterval(id); };
  }, [libraryId, me, holderSig]); // eslint-disable-line react-hooks/exhaustive-deps
  return found;
}

const deviceOf = (): string => {
  try { const k = 'recreatio:cogita:device'; let d = localStorage.getItem(k); if (d === null) { d = newId(); localStorage.setItem(k, d); } return d; } catch { return newId(); }
};

/** Folgen: die Ereignisse, die eigene Stimme (versiegelt für die Przyjęcia der Klasse), einmal „ich bin da". */
function FollowLive({ found }: { found: Found }) {
  const { opened, raw, poke, session } = useEvents(found.row.sessionId, found.cred, found.keys, null);
  const [intake, setIntake] = useState<Uint8Array | null>(null);
  const [sent, setSent] = useState<ReadonlyMap<number, unknown>>(new Map());
  const joined = useRef(false);
  const device = useMemo(deviceOf, []);
  useEffect(() => { void intakeOf(found.row.areaId).then(setIntake, () => undefined); }, [found.row.areaId]);
  /* Die Klasse sieht mit, also kurz nachfragen (ein Abruf nur des Neuen): kommt ein Ereignis über die Verbindung nicht an, wartete
     man sonst bis zum nächsten Abruf (15 s). Nur, solange dieser Tab sichtbar ist. */
  const pokeRef = useRef(poke);
  pokeRef.current = poke;
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') pokeRef.current(); }, 3000);
    return () => window.clearInterval(id);
  }, []);
  const post = async (kind: 'join' | 'answer', body: unknown) => {
    if (intake === null) return;
    const eventId = newId();
    await postEvents(found.row.sessionId, [{ eventId, kind, epoch: 0, sealed: await sealForIntake(intake, eventId, body) }], found.cred);
    poke();
  };
  useEffect(() => {
    if (intake === null || joined.current) return;
    joined.current = true;
    void post('join', { participant: found.participant, name: found.name || found.participant.slice(-4), team: null, device }).catch(() => { joined.current = false; });
  }, [intake]); // eslint-disable-line react-hooks/exhaustive-deps
  const row = session ?? found.row;
  if (row.state === 'closed' || row.state === 'finished') return null;
  return (
    <div className="cg-follow-overlay" data-follow-overlay={found.row.sessionId}>
      <FollowScreen session={row} opened={opened} slots={plains<{ index: number; form: string; count: number }>(raw, 'slot')} sent={sent}
        onVote={(index, given) => { setSent((m) => new Map(m).set(index, given)); void post('answer', { participant: found.participant, device, index, given, at: Date.now() }); }} />
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
  const [holder, setHolder] = useState<Holder | null>(null);
  useEffect(() => {
    let alive = true;
    const making = seat !== null ? holderOfSeat(seat) : kept !== null ? holderOfKeptSeat(kept) : null;
    if (making === null) { setHolder(null); return undefined; }
    void making.then((h) => { if (alive) setHolder(h); }, () => undefined);
    return () => { alive = false; };
  }, [seat?.token, kept]); // eslint-disable-line react-hooks/exhaustive-deps
  const found = useFollowSession(libraryId, seat === null && kept === null ? me : null, holder, person?.chosen?.name ?? '');
  return found === null ? null : <FollowLive key={found.row.sessionId} found={found} />;
}
