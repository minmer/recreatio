/**
 * 2026-11-22 (Eigentümer: „wer Cogita hat, legt eine Klasse an; die Schüler scannen einen QR-Code und legen ein Konto an,
 * melden sich an oder werden eine Person ohne Konto — und sehen dann nur ihre kleine Werkstatt") — EINE KLASSE AUS EINER BAZA.
 *
 * Keine neue Struktur: eine Klasse ist ein BEREICH (Art `class`) mit
 *   - der Rolle der Uczniowie (Schlüssel `students`, lesen) — sie liest die Klasse und die Baza;
 *   - der Baza, gemerkt als Schlüssel `library` `base-<id>` (wie ein Kurs, `courseBases.ts`) — daran erkennt die Karte, wer
 *     leiten darf (`MapClassTools.tsx`), und die Nauka, wohin die Antworten eines Schülers gehen (`classOfBase`);
 *   - Przyjęcia (eine Intake), die die Lehrerin öffnet — so sieht sie die Fortschritte;
 *   - einem Link, der die Rolle der Uczniowie gibt (Schlüssel `link` `class-join`) und auf `#/workspace/klasa/<id>` aufgeht:
 *     das ist der QR-Code. Wer ihn öffnet, legt ein Konto an, meldet sich an oder stellt sich ohne Konto vor (`ClassJoin.tsx`).
 *
 * Wer eine Klasse anlegen kann: wer andere in den Bereich der Baza hineinlassen darf (sonst könnten die Schüler sie nicht
 * lesen) — oder die Baza ist öffentlich lesbar.
 */

import { createArea, loadAreas, type AreaRow } from '../../areas/area';
import { baseKey } from '../../areas/courseBases';
import { loadImportKeys, saveImportKeys, saveProfile, type ImportKey } from '../../areas/profile';
import { areaKeys, setMemberName } from '../../chat/chat';
import { t } from '../../core/i18n';
import type { Me } from '../../core/me';
import { forgetKeys, keysFor } from '../../core/ringOf';
import { whoIsThere, WorkspaceError } from '../../core/session';
import { createIntake, loadIntake } from '../../forms/intake';
import { createLink, issuerIn, linkUrlOf, loadLinks, revokeLink, type LinkRow } from '../../links/linkAccess';
import { createCommonRole } from '../../roles/commonRole';
import { classAim, CLASS_JOIN, CLASS_STUDENTS, classesIn, type ClassOf } from './classModel';

export { classAim, CLASS_JOIN, CLASS_STUDENTS } from './classModel';
export type { ClassOf } from './classModel';

/** Die Baza, für die eine Klasse entsteht. */
export interface ClassBase {
  readonly libraryId: string;
  readonly areaId: string;
  readonly name: string;
}

/* -- Wer darf --------------------------------------------------------------------------------------------------------- */

/** Kann ich mit dieser Baza eine Klasse anlegen? `share`: die Uczniowie treten dem Bereich der Baza bei; `public`: lesbar für alle. */
export async function classOpening(me: Me, base: ClassBase): Promise<'share' | 'public' | null> {
  const rows = await loadAreas().then((r) => r.areas, () => [] as readonly AreaRow[]);
  const row = rows.find((a) => a.areaId.toLowerCase() === base.areaId.toLowerCase());
  if (row !== undefined && row.publicLevel !== 'none') return 'public';
  return (await issuerIn(me.ring, base.areaId).catch(() => null)) === null ? null : 'share';
}

/* -- Welche Klassen ------------------------------------------------------------------------------------------------- */

let areasOnce: Promise<readonly AreaRow[]> | null = null;
const areasNow = (fresh = false): Promise<readonly AreaRow[]> => {
  if (fresh) areasOnce = null;
  areasOnce ??= loadAreas().then((r) => r.areas, () => []);
  return areasOnce;
};
const keysOnce = new Map<string, Promise<readonly ImportKey[]>>();
const keysOf = (areaId: string, fresh = false): Promise<readonly ImportKey[]> => {
  if (fresh) keysOnce.delete(areaId);
  let found = keysOnce.get(areaId);
  if (found === undefined) { found = loadImportKeys(areaId).then((r) => r.keys, () => []); keysOnce.set(areaId, found); }
  return found;
};

/** Nach einem Anlegen oder Beitreten: neu nachsehen. */
export function forgetClasses(): void {
  areasOnce = null;
  keysOnce.clear();
}

/** Höchstens so viele Bereiche werden je Liste nachgesehen (je einer eine Anfrage). */
const LOOK_AT = 60;

/**
 * Die Klassen, die ich sehe: `lead` — die ich führe (Admin), sonst die, in denen ich lerne. `libraryId`: nur die mit dieser Baza.
 * Eine Klasse ist jeder Bereich, der sich eine Baza merkt (also auch ein Kurs oder eine Klasse einer Schule) — ausser dem
 * eigenen und dem Bereich der Baza selbst.
 */
export async function myClasses(lead: boolean, libraryId?: string, fresh = false): Promise<ClassOf[]> {
  const rows = (await areasNow(fresh)).filter((a) => a.personal !== true && a.myLevel !== null && (lead ? a.myLevel === 'admin' : a.myLevel !== 'admin')).slice(0, LOOK_AT);
  const keyed = await Promise.all(rows.map(async (a) => ({ area: a, keys: await keysOf(a.areaId, fresh) })));
  return classesIn(keyed.map(({ area, keys }) => ({ areaId: area.areaId, name: area.name, keys })), libraryId);
}

/** Die Klasse, in der ich (als Schüler) mit dieser Baza lerne — dorthin gehen meine Antworten. `null`: keine. */
export async function classOfBase(libraryId: string): Promise<string | null> {
  const found = await myClasses(false, libraryId);
  return found[0]?.areaId ?? null;
}

/* -- Anlegen ---------------------------------------------------------------------------------------------------------- */

export type ClassStage = 'area' | 'role' | 'intake' | 'link';

/**
 * EINE KLASSE ANLEGEN — der Bereich (unter dem der Baza, wenn ich dort hineinlassen darf: dann gilt dessen Administrator
 * danych), die Rolle der Uczniowie (liest die Klasse und die Baza), die Przyjęcia, der Link zum Beitreten. Dauert: zwei
 * Rollen mit RSA-4096 (die der Uczniowie und die des Links).
 */
export async function createClass(me: Me, base: ClassBase, name: string, stage: (s: ClassStage) => void = () => undefined): Promise<{ readonly klass: ClassOf; readonly url: string }> {
  const title = name.trim();
  if (title === '') throw new WorkspaceError(t('cogitaClass.err.needName'));
  const opening = await classOpening(me, base);
  if (opening === null) throw new WorkspaceError(t('cogitaClass.err.cannotShare'));

  stage('area');
  const area = await createArea(me.ring, me.person, title.slice(0, 200), opening === 'share' ? base.areaId : undefined);
  await saveProfile(area.areaId, { kind: 'class' }).catch(() => undefined);

  stage('role');
  const studentsName = t('cogitaClass.studentsOf', { name: title }).slice(0, 200);
  const made = await createCommonRole(me.ring, me.person, {
    name: studentsName,
    areas: [{ areaId: area.areaId, capability: 'read' }, ...(opening === 'share' ? [{ areaId: base.areaId, capability: 'read' as const }] : [])]
  });
  const ring = made.ring;
  await setMemberName(area.areaId, await areaKeys(ring, area.areaId, true), made.roleId, studentsName, me.person.id).catch(() => undefined);
  await saveImportKeys(area.areaId, [
    { kind: 'role', key: CLASS_STUDENTS, refId: made.roleId, refText: t('cogitaClass.students') },
    { kind: 'library', key: baseKey(base.libraryId), refId: base.libraryId, refText: base.name.slice(0, 200) }
  ]);

  stage('intake');
  if (!(await loadIntake(area.areaId).then(() => true, () => false))) await createIntake(ring, area.areaId, me.person.id);

  stage('link');
  const link = await joinLink(ring, me, area.areaId, base.libraryId, title, made.roleId);
  forgetKeys();
  forgetClasses();
  return {
    klass: { areaId: area.areaId, name: title, bases: [{ libraryId: base.libraryId, name: base.name }], studentsRoleId: made.roleId, joinInvitationId: link.invitationId },
    url: link.url
  };
}

/** Der Link zum Beitreten: gibt die Rolle der Uczniowie, ein Jahr, ohne Grenze der Zahl; gemerkt als `class-join`. */
async function joinLink(ring: Me['ring'], me: Me, areaId: string, libraryId: string, title: string, studentsRoleId: string): Promise<{ url: string; invitationId: string }> {
  const link = await createLink(ring, me.person, {
    label: t('cogitaClass.linkLabel', { name: title }).slice(0, 120),
    roles: [{ roleId: studentsRoleId, lead: false }],
    once: false,
    maxUses: null,
    expiresDays: 365,
    aim: classAim(areaId, libraryId)
  });
  await saveImportKeys(areaId, [{ kind: 'link', key: CLASS_JOIN, refId: link.invitationId, refText: null }]);
  return link;
}

/* -- Der QR-Code einer Klasse --------------------------------------------------------------------------------------- */

export interface ClassJoinLink {
  readonly row: LinkRow;
  /** `null`: der Link lässt sich hier nicht mehr zeigen (eine andere Person hat ihn angelegt). */
  readonly url: string | null;
}

/** Der Link zum Beitreten, wie ihn die Lehrerin zeigt — mit der Zahl derer, die beigetreten sind. */
export async function classJoinLink(me: Me, klass: ClassOf): Promise<ClassJoinLink | null> {
  if (klass.joinInvitationId === null) return null;
  const { invites } = await loadLinks();
  const row = invites.find((r) => r.invitationId.toLowerCase() === klass.joinInvitationId!.toLowerCase());
  if (row === undefined) return null;
  /* Der Bund dieser Ansicht kann älter sein als der Link (eben angelegt): dann der jetzige. */
  const url = await linkUrlOf(me.ring, row) ?? await ringNow().then((ring) => (ring === null ? null : linkUrlOf(ring, row)), () => null);
  return { row, url };
}

const ringNow = async () => { const who = await whoIsThere(); return who === null ? null : (await keysFor(who)).ring; };

/**
 * EIN NEUER CODE — der alte gilt nicht mehr (wer beigetreten ist, bleibt), ein neuer Link mit derselben Rolle. Für den Fall,
 * dass der Code in falsche Hände kam.
 */
export async function renewJoinLink(me: Me, klass: ClassOf): Promise<string> {
  if (klass.studentsRoleId === null) throw new WorkspaceError(t('cogitaClass.err.noStudents'));
  if (klass.joinInvitationId !== null) await revokeLink(klass.joinInvitationId, false).catch(() => undefined);
  const libraryId = klass.bases[0]?.libraryId;
  if (libraryId === undefined) throw new WorkspaceError(t('cogitaClass.err.noBase'));
  /* Der jetzige Bund — der der Ansicht kennt die Rolle der Uczniowie einer eben angelegten Klasse noch nicht. */
  const ring = (await ringNow().catch(() => null)) ?? me.ring;
  const link = await joinLink(ring, me, klass.areaId, libraryId, klass.name, klass.studentsRoleId);
  forgetKeys();
  forgetClasses();
  return link.url;
}

/** Beitreten schliessen — der Code gilt nicht mehr; wer drin ist, bleibt. */
export async function closeJoining(klass: ClassOf): Promise<void> {
  if (klass.joinInvitationId === null) return;
  await revokeLink(klass.joinInvitationId, false);
  await saveImportKeys(klass.areaId, [{ kind: 'link', key: CLASS_JOIN, remove: true }]).catch(() => undefined);
  forgetClasses();
}
