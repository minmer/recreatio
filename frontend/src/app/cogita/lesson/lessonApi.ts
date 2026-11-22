/**
 * 2026-11-22 (Part B) — EINE STUNDE UND EINE ZADANIE ANLEGEN. Beides ist eine Cogita-Sitzung (0109, 0144) im Bereich der
 * Klasse: keine neue Ablage, kein neuer Schlüssel — der Schlüssel kommt aus der Epoche des Bereichs (wie jede Sitzung),
 * Antworten gehen an seine Przyjęcia, Plätze (Menschen ohne Konto) bekommen den Schlüssel verpackt (`deliverSessionKeys`).
 *
 * <code>
 *   lesson   config: { title, parts: [{flow, start?}], showVotes, thresholds }   + Code und Link zum Mitmachen
 *   task     config: { title, target: {kind, id}, name, at }; ends_at = Frist      keine Teilnahme, nur lesen
 *   plan     2026-11-22 (I11) — eine gespeicherte Planung: eine Stunde OHNE Code und Link, angehalten (paused), nie live;
 *            config wie eine Stunde, dazu `plan` (Anfang, Ziel, Teile — `lessonPlan.ts`). Starten legt eine neue Stunde mit
 *            derselben Einstellung an; der Plan bleibt für das nächste Mal.
 * </code>
 */

import { myEpochKeys } from '../../areas/area';
import type { Me } from '../../core/me';
import { newId } from '../../core/ids';
import { t } from '../../core/i18n';
import { createSession, deleteSession, deliverSessionKeys, loadEvents, loadSession, loadSessions, openEvent, postEvents, rememberSecret, sealForSession, sessionKeyOf, setSessionState, type SessionKind, type SessionRow } from '../live';
import type { CogitaLibrary } from '../store';
import { DEFAULT_THRESHOLDS, isFlowPart, readLessonConfig, type AssignTarget, type LessonConfig, type LessonPart, type ShowVotes, type Thresholds } from './lessonTally';

/** Wer leitet: die eigene Person (wie beim Anlegen jeder Sitzung). */
const hostOf = (me: Me) => me.roles.find((r) => r.kind === 'person') ?? me.person;

export async function newSession(lib: CogitaLibrary, me: Me, input: { areaId: string; kind: SessionKind; title: string; join: boolean; endsAt?: string | null; deliver?: boolean }, config: unknown, meta: unknown) {
  const keys = await myEpochKeys(me.ring, input.areaId);
  if (keys.size === 0) throw new Error(t('cogitaViewsStats.sess.noAreaKey'));
  const epoch = Math.max(...keys.keys());
  const areaKey = keys.get(epoch)!;
  const made = await createSession({
    areaId: input.areaId, libraryId: lib.libraryId, kind: input.kind, epoch, title: input.title, hostRoleId: hostOf(me).id,
    joinLink: input.join, joinCode: input.join, endsAt: input.endsAt ?? null, pagePath: lib.settings().joinPage ?? null
  }, areaKey);
  if (made.secret !== null) rememberSecret(made.session.sessionId, made.secret);
  const eventId = newId();
  await postEvents(made.session.sessionId, [
    { eventId, kind: 'config', epoch, sealed: await sealForSession(made.key, eventId, config) },
    { eventId: newId(), kind: 'meta', epoch, plain: JSON.stringify(meta) }
  ]);
  /* Plätze des Bereichs (Menschen ohne Konto, vorgestellt über einen Link) lesen die Sitzung mit ihrem verpackten Schlüssel. */
  if (input.deliver === false) return made.session;
  const sessionKeys = new Map<number, Uint8Array>();
  for (const [e, key] of keys) sessionKeys.set(e, await sessionKeyOf(key, made.session.sessionId, e));
  await deliverSessionKeys(made.session.sessionId, sessionKeys, hostOf(me).id).catch(() => 0);
  return made.session;
}

export interface NewLesson {
  readonly areaId: string;
  readonly title: string;
  readonly parts: readonly LessonPart[];
  readonly showVotes?: ShowVotes;
  readonly thresholds?: Thresholds;
  /** 2026-11-22 (I11) — der Plan, aus dem die Stunde entsteht (`lessonPlan.ts`), unverändert mitgenommen. */
  readonly plan?: unknown;
}

const configOf = (input: NewLesson) => ({
  title: input.title, parts: input.parts, showVotes: input.showVotes ?? 'after', thresholds: input.thresholds ?? DEFAULT_THRESHOLDS,
  ...(input.plan === undefined ? {} : { plan: input.plan })
});

/** Eine Stunde anlegen — gibt ihre Kennung zurück (der Leiter öffnet sie gleich). */
export async function createLesson(lib: CogitaLibrary, me: Me, input: NewLesson): Promise<string> {
  const session = await newSession(lib, me, { areaId: input.areaId, kind: 'lesson', title: input.title, join: true }, configOf(input),
    { flow: input.parts.find(isFlowPart)?.flow ?? null, library: lib.libraryId, lesson: true });
  return session.sessionId;
}

/* -- Gespeicherte Planungen (I11) ----------------------------------------------------------------------------------------- */

/**
 * Ist diese Sitzung eine gespeicherte Planung? Eine Stunde ohne Code und ohne Link, nicht laufend — eine Stunde, die läuft, hat
 * immer einen Code (`createLesson`), darum verwechselt keine Liste die beiden.
 */
export const isPlanSession = (s: Pick<SessionRow, 'kind' | 'joinCode' | 'joinable' | 'state'>): boolean =>
  s.kind === 'lesson' && s.joinCode === null && !s.joinable && s.state !== 'running' && s.state !== 'lobby';

export interface SavedPlan {
  readonly sessionId: string;
  readonly areaId: string;
  readonly config: LessonConfig;
  readonly updatedAt: string;
}

/** Eine Planung speichern: neu (ohne `sessionId`) oder ihre Einstellung ersetzen. Gibt die Kennung zurück. */
export async function savePlan(lib: CogitaLibrary, me: Me, input: NewLesson, sessionId?: string | null): Promise<string> {
  const keys = await myEpochKeys(me.ring, input.areaId);
  if (keys.size === 0) throw new Error(t('cogitaViewsStats.sess.noAreaKey'));
  if (sessionId !== undefined && sessionId !== null) {
    const { session } = await loadSession(sessionId);
    const areaKey = keys.get(session.epoch);
    if (areaKey === undefined) throw new Error(t('cogitaViewsStats.sess.noAreaKey'));
    const eventId = newId();
    await postEvents(sessionId, [{ eventId, kind: 'config', epoch: session.epoch, sealed: await sealForSession(await sessionKeyOf(areaKey, sessionId, session.epoch), eventId, configOf(input)) }]);
    return sessionId;
  }
  const made = await newSession(lib, me, { areaId: input.areaId, kind: 'lesson', title: input.title, join: false, deliver: false }, configOf(input),
    { library: lib.libraryId, lesson: true, plan: true });
  /* Angehalten: keine Liste zeigt sie als laufende Stunde; eine neue Einstellung nimmt sie weiter an. */
  await setSessionState(made.sessionId, 'paused');
  return made.sessionId;
}

/** Die gespeicherten Planungen einer Klasse für diese Baza — die neuesten zuerst. */
export async function loadPlans(lib: CogitaLibrary, me: Me, areaId: string): Promise<SavedPlan[]> {
  const { sessions } = await loadSessions(areaId, lib.libraryId);
  const keys = await myEpochKeys(me.ring, areaId);
  const out: SavedPlan[] = [];
  for (const s of sessions.filter(isPlanSession).slice(0, 40)) {
    const areaKey = keys.get(s.epoch);
    if (areaKey === undefined) continue;
    try {
      const key = await sessionKeyOf(areaKey, s.sessionId, s.epoch);
      const { events } = await loadEvents(s.sessionId, 0);
      const last = events.filter((e) => e.kind === 'config').pop();
      const config = last === undefined ? null : readLessonConfig(await openEvent(last, { session: (e) => (e === s.epoch ? key : undefined) }));
      if (config !== null) out.push({ sessionId: s.sessionId, areaId, config, updatedAt: s.updatedAt });
    } catch { /* eine Planung, die sich nicht öffnen lässt */ }
  }
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Eine Planung löschen (die Stunden, die aus ihr entstanden, bleiben). */
export const deletePlan = (sessionId: string): Promise<unknown> => deleteSession(sessionId);

export interface NewAssignment {
  readonly areaId: string;
  readonly title: string;
  readonly target: AssignTarget;
  readonly name: string;
  /** Die Frist (ISO) — oder keine. */
  readonly until: string | null;
}

/** Eine Zadanie anlegen: Ziel + Klasse + Frist, EIN Ding. */
export async function createAssignment(lib: CogitaLibrary, me: Me, input: NewAssignment): Promise<string> {
  const config = { title: input.title, target: input.target, name: input.name, at: Date.now() };
  const session = await newSession(lib, me, { areaId: input.areaId, kind: 'task', title: input.title, join: false, endsAt: input.until }, config,
    { library: lib.libraryId, task: input.target.kind });
  return session.sessionId;
}
