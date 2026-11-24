/**
 * 2026-11-24 (Tryb prowadzony) — DIE LEHRERIN FÜHRT: eine laufende Folge-Stunde je Tab (gemerkt für diesen Tab, so überlebt sie ein
 * Neuladen und einen Seitenwechsel), und was ihr Gerät hinausschickt. Gezeigtes kommt hier an (`reportMap`, `reportStep`,
 * `reportMapShown`) — die Karte, ein Spieler; hinaus geht es nur, solange das Bild nicht angehalten ist („Zatrzymaj obraz"), und nur
 * Änderungen. „Pokaż uczniom" schickt den jetzigen Stand trotzdem. Werkzeuge der Lehrerin (QR-Code, Konsole) melden nichts — die
 * Schüler behalten das zuletzt Geschickte.
 */

import { useSyncExternalStore } from 'react';

import { myEpochKeys } from '../../areas/area';
import type { Me } from '../../core/me';
import { newId } from '../../core/ids';
import type { Card } from '../cardBasics';
import { deliverSessionKeys, loadEvents, loadSession, loadSessions, postEvents, sealForSession, sessionKeyOf, setSessionState, stripCard, type SessionRow } from '../live';
import type { PublicEntity } from '../publish';
import { newSession } from '../lesson/lessonApi';
import type { LessonStep } from '../lesson/lessonStep';
import type { CogitaLibrary } from '../store';
import { FOLLOW_MAP, FOLLOW_SHOW, mapToSend, type FollowConfig, type FollowMapState } from './followModel';

export interface FollowLive {
  readonly sessionId: string;
  readonly areaId: string;
  readonly className: string;
  readonly libraryId: string;
  readonly epoch: number;
  readonly key: Uint8Array;
  readonly keys: ReadonlyMap<number, Uint8Array>;
  readonly hostRoleId: string;
  readonly frozen: boolean;
  readonly startedAt: number;
}

/** Die offene Abstimmung (eine gezeigte Frage) — für „Pokaż wyniki". */
export interface FollowVote { readonly index: number; readonly card: Card; readonly data: Readonly<Record<string, unknown>> | null; readonly step: string; readonly predict: boolean }

const KEEP = 'recreatio:cogita:follow-live';
let live: FollowLive | null = null;
let vote: FollowVote | null = null;
let currentMap: FollowMapState | null = null;
let sentMap: FollowMapState | null = null;
let currentContent: { readonly kind: 'map' } | { readonly kind: 'step'; readonly step: LessonStep } = { kind: 'map' };
let sentStepKey = '';
let mapTimer = 0;
let version = 0;
const listeners = new Set<() => void>();
const changed = () => { version += 1; for (const l of listeners) l(); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Die laufende Folge-Stunde dieses Tabs (oder null) — und die offene Abstimmung. */
export function useFollowLive(): { readonly live: FollowLive | null; readonly vote: FollowVote | null } {
  useSyncExternalStore(subscribe, () => version);
  return { live, vote };
}
export const followLiveNow = (): FollowLive | null => live;

const keep = (l: FollowLive | null) => {
  try {
    if (l === null) sessionStorage.removeItem(KEEP);
    else sessionStorage.setItem(KEEP, JSON.stringify({ sessionId: l.sessionId, areaId: l.areaId, className: l.className, libraryId: l.libraryId }));
  } catch { /* ohne Speicher: nur bis zum Neuladen */ }
};

/** Ein Ereignis an die Klasse (versiegelt mit dem Schlüssel der Sitzung), mit einem offenen Teil, wo nötig. */
export async function followSend(kind: string, body: unknown, plain?: { readonly kind: string; readonly body: unknown }): Promise<void> {
  const l = live;
  if (l === null) return;
  const eventId = newId();
  await postEvents(l.sessionId, [
    { eventId, kind, epoch: l.epoch, sealed: await sealForSession(l.key, eventId, body) },
    ...(plain === undefined ? [] : [{ eventId: newId(), kind: plain.kind, epoch: l.epoch, plain: JSON.stringify(plain.body) }])
  ]);
}

async function attach(row: SessionRow, me: Me, meta: { className: string; libraryId: string }): Promise<FollowLive | null> {
  const area = await myEpochKeys(me.ring, row.areaId);
  const keys = new Map<number, Uint8Array>();
  for (const [e, k] of area) keys.set(e, await sessionKeyOf(k, row.sessionId, e));
  const key = keys.get(row.epoch);
  if (key === undefined) return null;
  return { sessionId: row.sessionId, areaId: row.areaId, className: meta.className, libraryId: meta.libraryId, epoch: row.epoch, key, keys, hostRoleId: row.hostRoleId, frozen: false, startedAt: Date.now() };
}

/** Die offene Hälfte `meta` einer Sitzung: ist sie eine Folge-Stunde? (gemerkt je Sitzung) */
const followMeta = new Map<string, Promise<{ follow: boolean; className: string }>>();
export function followMetaOf(sessionId: string, cred: { seat?: string } = {}): Promise<{ follow: boolean; className: string }> {
  let found = followMeta.get(sessionId);
  if (found === undefined) {
    found = loadEvents(sessionId, 0, cred).then(({ events }) => {
      const meta = events.find((e) => e.kind === 'meta' && e.plain !== null);
      try { const m = JSON.parse(meta?.plain ?? '{}') as { follow?: unknown; className?: unknown }; return { follow: m.follow === true, className: typeof m.className === 'string' ? m.className : '' }; }
      catch { return { follow: false, className: '' }; }
    }, () => ({ follow: false, className: '' }));
    followMeta.set(sessionId, found);
  }
  return found;
}

/** „Prowadź klasę na żywo": eine Folge-Stunde in der Klasse anlegen (keine Code, kein QR — die Klasse hat ihre Schlüssel). */
export async function startFollow(lib: CogitaLibrary, me: Me, klass: { readonly areaId: string; readonly name: string }): Promise<void> {
  if (live !== null && live.areaId === klass.areaId) return;
  if (live !== null) await stopFollow();
  const config: FollowConfig = { title: klass.name, follow: true, classArea: klass.areaId, library: lib.libraryId };
  const row = await newSession(lib, me, { areaId: klass.areaId, kind: 'lesson', title: klass.name, join: false }, config,
    { library: lib.libraryId, lesson: true, follow: true, className: klass.name });
  await setSessionState(row.sessionId, 'running');
  const made = await attach({ ...row, state: 'running' }, me, { className: klass.name, libraryId: lib.libraryId });
  if (made === null) throw new Error('no key');
  live = made;
  vote = null;
  sentMap = null;
  sentStepKey = '';
  keep(live);
  changed();
  /* Gleich das jetzige Bild (die Karte, wo die Lehrerin steht). */
  await showNow();
}

/** Nach einem Neuladen oder Seitenwechsel: die eigene laufende Folge-Stunde wieder aufnehmen (gemerkt im Tab, sonst gesucht). */
export async function resumeFollow(me: Me, libraryId: string): Promise<void> {
  if (live !== null) return;
  let wanted: { sessionId: string; className: string } | null = null;
  try { const k = JSON.parse(sessionStorage.getItem(KEEP) ?? 'null') as { sessionId?: string; className?: string; libraryId?: string } | null; if (k?.sessionId !== undefined && k.libraryId === libraryId) wanted = { sessionId: k.sessionId, className: k.className ?? '' }; } catch { /* nichts gemerkt */ }
  let row: SessionRow | null = null;
  if (wanted !== null) {
    row = await loadSession(wanted.sessionId).then((r) => r.session, () => null);
    if (row !== null && (row.state !== 'running' || !row.host)) row = null;
  }
  if (row === null) {
    const { sessions } = await loadSessions(undefined, libraryId).catch(() => ({ sessions: [] as readonly SessionRow[] }));
    for (const s of sessions.filter((x) => x.kind === 'lesson' && x.state === 'running' && x.host).slice(0, 8)) {
      const m = await followMetaOf(s.sessionId);
      if (m.follow) { row = s; wanted = { sessionId: s.sessionId, className: m.className }; break; }
    }
  }
  if (row === null || live !== null) return;
  const made = await attach(row, me, { className: wanted?.className ?? '', libraryId });
  if (made === null || live !== null) return;
  live = made;
  keep(live);
  changed();
}

/** „Zakończ": die Folge-Stunde schliessen — die Schüler kehren zurück, wo sie waren. */
export async function stopFollow(): Promise<void> {
  const l = live;
  live = null;
  vote = null;
  currentContent = { kind: 'map' };
  keep(null);
  changed();
  if (l !== null) await setSessionState(l.sessionId, 'closed').catch(() => undefined);
}

/** „Zatrzymaj obraz" / „Wznów": angehalten geht nichts hinaus; beim Wiederaufnehmen gleich der jetzige Stand. */
export function setFollowFrozen(frozen: boolean): void {
  if (live === null) return;
  live = { ...live, frozen };
  changed();
  if (!frozen) void showNow();
}

/** Neue Plätze (Menschen ohne Konto, eben beigetreten) bekommen den Schlüssel der Sitzung. */
export async function deliverFollowKeys(): Promise<void> {
  const l = live;
  if (l !== null) await deliverSessionKeys(l.sessionId, l.keys, l.hostRoleId).catch(() => 0);
}

/* -- Was die Lehrerin zeigt ------------------------------------------------------------------------------------------- */

async function flushMap(force: boolean): Promise<void> {
  if (live === null) return;
  const m = mapToSend({ frozen: live.frozen, currentMap, sentMap }, force);
  if (m === null) return;
  sentMap = m;
  await followSend(FOLLOW_MAP, { ...m, at: Date.now() }).catch(() => { sentMap = null; });
}

/** Die Karte der Lehrerin (nach jeder Änderung) — hinaus nach dem Stillstand (~350 ms), nur wenn anders. */
export function reportMap(state: FollowMapState): void {
  currentMap = state;
  if (live === null || live.frozen) return;
  window.clearTimeout(mapTimer);
  mapTimer = window.setTimeout(() => { void flushMap(false); }, 350);
}

const smallEntity = (e: PublicEntity | null): PublicEntity | null => {
  if (e === null) return null;
  try { return JSON.stringify(e).length <= 40_000 ? e : null; } catch { return null; }
};
const stepKey = (s: LessonStep): string => (s.kind === 'end' ? `end:${s.flow}` : `${s.kind}:${s.flow}:${s.step}`);

async function publishStep(step: LessonStep): Promise<void> {
  if (live === null) return;
  const key = stepKey(step);
  if (key === sentStepKey) return;
  sentStepKey = key;
  if (step.kind === 'end' || step.kind === 'other') { await followSend(FOLLOW_SHOW, { kind: 'map', at: Date.now() }); return; }
  const title = step.kind === 'show' || step.kind === 'choice' || step.kind === 'chapters' ? step.title : null;
  await followSend('step', { at: Date.now(), flow: step.flow, step: step.step, kind: step.kind, title, entity: step.kind === 'show' ? smallEntity(step.entity) : null });
  if (step.kind === 'question') {
    /* Eine Abstimmung wie in jeder Stunde: die Schüler antworten, die Lehrerin sieht die Verteilung. */
    const index = Math.floor((Date.now() - live.startedAt) / 100) + 1;
    vote = { index, card: step.card, data: step.data, step: step.step, predict: step.predict === true };
    changed();
    const card = step.card;
    await followSend('question', { index, total: 0, card: stripCard(card), startedAt: Date.now(), deadline: null, round: 1, step: step.step, lesson: true, ...(step.predict === true ? { predict: true } : {}) },
      { kind: 'slot', body: { index, form: card.answer.form, count: card.answer.form === 'one' || card.answer.form === 'many' ? card.answer.options.length : card.answer.form === 'truefalse' ? 2 : 0 } });
  } else if (step.kind === 'choice' || step.kind === 'chapters') {
    const index = Math.floor((Date.now() - live.startedAt) / 100) + 1;
    await followSend('poll', { index, round: 1, step: step.step, kind: step.kind, title: step.title, options: step.options });
  }
}

/** Ein Schritt im Spieler der Lehrerin (eine Folie, eine Frage, eine Wahl, das Ende). */
export function reportStep(step: LessonStep): void {
  currentContent = step.kind === 'end' ? { kind: 'map' } : { kind: 'step', step };
  if (live === null || live.frozen) return;
  void publishStep(step).catch(() => { sentStepKey = ''; });
}

/** Zurück zur Karte (der Spieler ist zu). */
export function reportMapShown(): void {
  currentContent = { kind: 'map' };
  if (live === null || live.frozen) return;
  sentStepKey = '';
  void followSend(FOLLOW_SHOW, { kind: 'map', at: Date.now() }).catch(() => undefined);
}

/** „Pokaż uczniom": der jetzige Stand gleich hinaus — auch angehalten. */
export async function showNow(): Promise<void> {
  if (live === null) return;
  await flushMap(true);
  if (currentContent.kind === 'map') { sentStepKey = ''; await followSend(FOLLOW_SHOW, { kind: 'map', at: Date.now() }); }
  else await publishStep(currentContent.step);
}

/** Die Abstimmung ist aufgedeckt (die Lehrerin hat die Verteilung gezeigt). */
export function clearFollowVote(): void { vote = null; changed(); }
