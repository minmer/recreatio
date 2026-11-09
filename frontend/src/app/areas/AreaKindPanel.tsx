/**
 * 0133 — DER REITER DER ART eines Bereichs: Wydarzenie, Grupa, Parafia, Kurs.
 *
 * Oben, was jeder Leser sieht (Wizytówka, Termin, Wege). Darunter, für wer
 * den Bereich führt: was noch fehlt — mit dem Handgriff, der es behebt —, die
 * Wizytówka, wohin veröffentlicht wird, die Werkzeuge der Art, die fremden
 * Listen und der JSON für eine KI.
 *
 * Nichts ist eigens gebaut: jedes Werkzeug ruft, was es schon gibt (Seite,
 * Formular, Termin, Rozmowa, Rolle, Link) und hängt es ans Profil. Die
 * Anfänge (`Starters.tsx`) nehmen dieselben Stücke von hier.
 *
 * Veröffentlicht wird je Stück: Wizytówka, Haupttermin und Fragen stehen,
 * wo sie gezeigt werden; Antworten, Menschen und Rozmowy bleiben im Bereich.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { areaKeys, loadAreaNames, openNames, setMemberName, startAreaChat, type ChatRow, type SealedName } from '../chat/chat';
import { draftOf, loadAgenda, openAgenda, saveEvent, type OpenedItem } from '../calendar/agenda';
import { createCalendar } from '../calendar/calendar';
import { loadProgram, openProgram, type ProgramNode } from '../calendar/program';
import { newId } from '../core/ids';
import type { Ring, SealedRole } from '../core/keys';
import { rich, t as tApp, useT, type T } from '../core/i18n';
import { forgetKeys, keysFor } from '../core/ringOf';
import { call, WorkspaceError, type Who } from '../core/session';
import { Listings } from '../events/AreaEventSettings';
import { eventImageUrl, loadEvent, whenText, type EventCard } from '../events/events';
import { mainTermOf } from '../events/mainTerm';
import { writeFormContent } from '../forms/formJson';
import { createIntake, loadIntake } from '../forms/intake';
import { moveQuestions } from '../forms/questionsArea';
import { createLibrary, libraryKindOf, loadLibraries, openLibraries, type LibraryRow, type OpenLibrary } from '../library/library';
import { storeOf } from '../library/libraryStore';
import { LinkShare } from '../links/AccessLinks';
import { createLink, issuerIn } from '../links/linkAccess';
import { createModule, questionsAreaOf, readConfig, updateModule, type ModuleRow } from '../modules/module';
import { BREAKPOINTS, COLUMNS, frameFor, snapColSpan, snapRowSpan, type Breakpoint, type Frame } from '../pages/layout';
import { loadPage, savePage, saveParts, toDraft, type DraftPart, type PageContent } from '../pages/page';
import { isImageType, loadPageImages, type PageImageRow } from '../pages/pageImages';
import { PickPage } from '../pages/PickPage';
import { createCommonRole } from '../roles/commonRole';
import { setMemberRoles } from '../roles/memberRole';
import { selfOf } from '../roles/roles';
import { formPath, pagePath, pageSteps, viewPath } from '../routes';
import { ask, toast } from '../ui/dialogs';
import { FadeImg } from '../ui/fadeImage';
import { later } from '../ui/later';
import { Loading } from '../ui/Loading';
import { Segment } from '../ui/Segment';
import { loadDesk, type PageCard } from '../workspace/desk';
import { chatsNow, invalidate, modulesNow, refreshDesk } from '../workspace/viewData';
import { createArea, dropFromArea, joinArea, loadMembers, type AreaRow, type Member } from './area';
import { AreaPick } from './AreaPick';
import { answersOfBase, baseKey, closesArea, courseBaseRefs, isInside, strayLearning, type CourseBaseRef } from './courseBases';
import { partOf } from '../pages/parts/registry';
import { linkAudienceForm } from './audience';
import { setPageController } from './controllers';
import {
  defaultPublishArea, kindLabel, loadImportKeys, openCard, PROFILE_KINDS, publishChoices, removeProfile, saveImportKeys, saveProfile, sealCard, setArchived,
  type CardText, type ImportKey, type Profile, type ProfileKind, type ProfileState
} from './profile';
import { savePublishedItem } from './profileItem';
import './kinds.css';

/* Der JSON für eine KI (Fork J) — erst geladen, wenn der Reiter offen ist. */
const AreaJsonPanel = later(() => import('./AreaJsonPanel').then((m) => m.AreaJsonPanel));

export const failure = (e: unknown, fallback: string): string => (e instanceof WorkspaceError ? e.message : fallback);

/* 0134 — die Werkzeuge einer Szkoła und einer Klasa (eigene Dateien, erst geladen, wenn gezeigt). */
const SchoolTools = later(() => import('./SchoolTools').then((m) => m.SchoolTools));
const ClassTools = later(() => import('./ClassTools').then((m) => m.ClassTools));

/* == Stücke, die auch die Anfänge nehmen ========================================= */

/** „Rekolekcje 2027" → „rekolekcje-2027" — so, wie eine Adresse heissen darf. */
export const slugOf = (name: string): string => name.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l') // i18n-ignore — Adresse ohne Diakritika
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'wydarzenie'; // i18n-ignore — eine Adresse

/** Die Fragen eines neuen Formulars zgłoszeń. */
export const SIGNUP_QUESTIONS = [
  { id: 'q1', kind: 'line', get label() { return tApp('areasKind.signup.given'); }, required: true, halfWidth: true, identity: 'given_name' },
  { id: 'q2', kind: 'line', get label() { return tApp('areasKind.signup.surname'); }, required: true, halfWidth: true, identity: 'surname' },
  { id: 'q3', kind: 'phone', get label() { return tApp('areasKind.signup.phone'); }, required: true, halfWidth: true, identity: 'phone' },
  { id: 'q4', kind: 'email', get label() { return tApp('areasKind.signup.email'); }, required: false, halfWidth: true, identity: 'email' }
] as const;

/** Ein Baustein, der auf eine Seite kommt — unter alles, was dort steht. */
export interface NewPart {
  readonly kind: string;
  readonly config: Record<string, string>;
  readonly box: { readonly colSpan: number; readonly rowSpan: number };
  readonly id?: string;
  readonly moduleId?: string | null;
  readonly audienceAreaId?: string | null;
}

/** Die Wizytówka als Baustein — oben auf der Hauptseite eines Wydarzenie. */
/* Auf ihrer eigenen Seite zeigt sie nur Zeit, Ort, Bild und Marken (der Titel steht im Kopf) — darum niedrig. */
export const cardPart = (areaId: string): NewPart => ({ kind: 'event', config: { title: '', area: areaId }, box: { colSpan: 6, rowSpan: 2 } });

/** Ein Formular als Baustein. */
export const formPart = (formId: string): NewPart => ({ kind: 'form', moduleId: formId, config: {}, box: { colSpan: 6, rowSpan: 5 } });

/** Je Bildschirmgrösse ein Rahmen unter dem tiefsten Baustein. */
function below(parts: readonly DraftPart[], box: NewPart['box']): Partial<Record<Breakpoint, Frame>> {
  const out: Partial<Record<Breakpoint, Frame>> = {};
  for (const bp of BREAKPOINTS) {
    const bottom = parts.reduce((low, part) => {
      const frame = frameFor(part, bp);
      return Math.max(low, frame.position.row + snapRowSpan(frame.size.rowSpan));
    }, 1);
    out[bp] = { position: { row: bottom, col: 1 }, size: { colSpan: snapColSpan(box.colSpan, COLUMNS[bp]), rowSpan: snapRowSpan(box.rowSpan) } };
  }
  return out;
}

/** Bausteine ans Ende einer Seite — die anderen bleiben, wie sie sind. */
export async function addToPage(path: string, wanted: readonly NewPart[]): Promise<void> {
  const page = await loadPage(path);
  if (page.locked === true) throw new WorkspaceError(tApp('areasKind.pageSealed'));
  let parts: DraftPart[] = page.parts.map(toDraft);
  for (const one of wanted) {
    parts = [...parts, {
      id: one.id ?? newId(),
      moduleId: one.moduleId ?? null,
      kind: one.kind,
      layout: below(parts, one.box),
      config: one.config,
      ...(one.audienceAreaId == null ? {} : { audienceAreaId: one.audienceAreaId })
    }];
  }
  await saveParts(path, parts);
}

/**
 * Eine neue Unterseite: anlegen, dem Bereich zuordnen (sein Administrator danych
 * steht für sie — `areaId: null`: wie die Seite darüber), Titel, Bausteine.
 */
export async function createSubpage(input: {
  readonly path: string; readonly roleId: string; readonly areaId: string | null;
  readonly title: string; readonly lead: string | null; readonly parts: readonly NewPart[];
}): Promise<{ note: string | null }> {
  await call('/workspace/subpage', { method: 'POST', body: JSON.stringify({ path: input.path, roleId: input.roleId }) });
  let note: string | null = null;
  if (input.areaId !== null) {
    try {
      await setPageController(input.path, input.areaId);
    } catch (e) {
      note = tApp('areasKind.pageNoController', { error: failure(e, tApp('areasSchool.school.error')) });
    }
  }
  await savePage(input.path, { title: input.title.trim() || tApp('areasKind.page'), lead: input.lead });
  if (input.parts.length > 0) await addToPage(input.path, input.parts);
  return { note };
}

/**
 * Ein Formular zgłoszeń: die Fragen, die Antworten in den Bereich — und die Fragen
 * dort, wo veröffentlicht wird (änderbar in den Einstellungen des Formulars).
 */
export async function createSignupForm(who: Who, ring: Ring, input: {
  readonly areaId: string; readonly name: string; readonly publishTo: string; readonly onStage: (what: string) => void;
}): Promise<{ formId: string; note: string | null }> {
  const formId = newId();
  input.onStage(tApp('areasKind.stage.form'));
  await createModule(formId, 'form', input.name, input.areaId, 'person');
  await writeFormContent(who, { moduleId: formId, areaId: input.areaId }, { questions: SIGNUP_QUESTIONS },
    { replace: false, answersTo: input.areaId, onStage: input.onStage });
  let note: string | null = null;
  if (input.publishTo !== input.areaId) {
    input.onStage(tApp('areasKind.stage.questions'));
    try {
      await moveQuestions(ring, formId, input.publishTo);
    } catch (e) {
      note = tApp('areasKind.questionsStayed', { error: failure(e, tApp('areasKind.questionsNotMoved')) });
    }
  }
  return { formId, note };
}

/** Eine Rolle für den Bereich, mit ihrem Namen dort (damit ihn auch die anderen Prowadzący lesen). */
export async function createAreaRole(ring: Ring, person: SealedRole, input: {
  readonly areaId: string; readonly name: string; readonly capability: 'read' | 'write' | 'admin'; readonly onStage: (what: string) => void;
}): Promise<{ roleId: string; ring: Ring }> {
  const made = await createCommonRole(ring, person, { name: input.name, areas: [{ areaId: input.areaId, capability: input.capability }] }, input.onStage);
  try {
    const by = await myWriter(made.ring, input.areaId);
    await setMemberName(input.areaId, await areaKeys(made.ring, input.areaId, true), made.roleId, input.name, by);
  } catch {
    // Ohne Namen im Bereich — die Rolle selbst steht.
  }
  return made;
}

/** 0109 — der Kurs: Baza wiedzy mit täglicher Powtórka, die Antworten in den Bereich (Przyjęcia). */
export async function createCourseBase(ring: Ring, person: SealedRole, areaId: string, name: string, onStage: (what: string) => void): Promise<string> {
  onStage(tApp('areasKind.stage.base'));
  const libraryId = await createLibrary(ring, areaId, name, 'knowledge');
  if (!(await loadIntake(areaId).then(() => true, () => false))) {
    onStage(tApp('areasKind.stage.intake'));
    await createIntake(ring, areaId, person.id);
  }
  onStage(tApp('areasKind.stage.revision'));
  const store = storeOf(ring, { libraryId, areaId });
  await store.sync();
  const [{ CogitaLibrary }, { REVISION_PRESETS }] = await Promise.all([import('../cogita/store'), import('../cogita/presets')]);
  const lib = new CogitaLibrary(store, true);
  await lib.saveDoc('revision', REVISION_PRESETS[0].make());
  await lib.saveSettings({ storageAreaId: areaId, motivation: 'progress' });
  return libraryId;
}

/** Wohin ein neues Wydarzenie veröffentlicht: der nächste jawne Bereich darüber, den ich führe — sonst es selbst. */
export function publishAreaFor(areas: readonly AreaRow[], parentAreaId: string | null, areaId: string): string {
  if (parentAreaId === null || parentAreaId === '') return areaId;
  const found = defaultPublishArea(areas, parentAreaId);
  const row = areas.find((a) => a.areaId === found);
  return row !== undefined && row.publicLevel !== 'none' && row.myLevel === 'admin' ? found : areaId;
}

/** Welche meiner Rollen im Bereich schreibt (prowadzi zuerst). */
export async function myWriter(ring: Ring, areaId: string): Promise<string> {
  const { members } = await loadMembers(areaId);
  const mine = members.filter((m) => ring.has(m.roleId));
  const writer = mine.find((m) => m.capabilities.includes('admin')) ?? mine.find((m) => m.capabilities.includes('write'));
  if (writer === undefined) throw new WorkspaceError(tApp('areas.page.noWriter'));
  return writer.roleId;
}

/* == Was der Reiter lädt ========================================================= */

export interface RoleSeen {
  readonly roleId: string;
  /** Der Schlüssel, unter dem der Bereich sie kennt (Reiter und JSON-Import teilen ihn: „participants"). */
  readonly key: string | null;
  readonly name: string | null;
  readonly level: 'read' | 'write' | 'admin';
  readonly mine: boolean;
  readonly wrapPublicKey: string;
}

export interface World {
  readonly card: CardText | null;
  /** Formulare des Bereichs (mit Unterformularen). */
  readonly forms: readonly ModuleRow[];
  readonly chats: readonly ChatRow[];
  /** Die Hauptseite, wie ihr Editor sie sieht. */
  readonly page: PageContent | null;
  /** Bilder der Hauptseite und der Seite danach. */
  readonly images: readonly PageImageRow[];
  readonly program: ProgramNode | null;
  readonly calendarId: string | null;
  /** Die Karte, wie sie draussen steht (`null`: nicht öffentlich). */
  readonly publicCard: EventCard | null;
  /** Meine Seiten (ohne zweite Namen). */
  readonly pages: readonly PageCard[];
  readonly roles: readonly RoleSeen[];
  /**
   * 2026-11-01 — DIE BAZY DES KURSES (`courseBases.ts`), beliebig viele: die des Bereichs, die gemerkten (Art
   * `library`) und die, aus denen die Hauptseite etwas zeigt. Jede bleibt, wo sie ist; keine wird dafür geändert.
   */
  readonly bases: readonly CourseBase[];
  /** Bestehende Bazy anderer Bereiche (mit Namen), die der Kurs noch nicht nutzt: „Dodaj istniejącą". */
  readonly otherBases: readonly OpenLibrary[];
  /** Die Namen der Bazy, die geöffnet werden konnten. */
  readonly baseNames: ReadonlyMap<string, string>;
  /** Bereiche ausser dem Kurs, die die Rolle der Uczący się liest. */
  readonly learnersIn: ReadonlySet<string>;
}

/** 2026-11-01 — eine Baza des Kurses: wo sie liegt, warum sie dazugehört, was die Hauptseite von ihr zeigt. */
export interface CourseBase extends CourseBaseRef {
  /** Ihre Zeile — `null`: ich kann sie nicht (mehr) lesen. */
  readonly row: LibraryRow | null;
  readonly name: string | null;
}

export function quiet<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return promise.catch(() => fallback);
}

const levelOf = (caps: readonly string[]): RoleSeen['level'] =>
  caps.includes('admin') ? 'admin' : caps.includes('write') ? 'write' : 'read';

async function loadWorld(who: Who, areaId: string, profile: Profile, held: Ring | null): Promise<World> {
  /* Der frische Bund: eben angelegte Rollen sind darin, der der Ansicht kennt sie noch nicht. */
  const ring = (await keysFor(who).then((k) => k.ring, () => null)) ?? held;
  const main = profile.main?.path ?? null;
  const after = profile.after?.path ?? null;
  const imagesOf = (path: string | null): Promise<readonly PageImageRow[]> => path === null ? Promise.resolve([])
    : quiet<readonly PageImageRow[]>(loadPageImages(path).then((r) => r.images.filter((one) => isImageType(one.contentType))), []);

  const [card, modules, chats, page, mainImages, afterImages, program, publicCard, pages, members, sealedNames, libraries, keys] = await Promise.all([
    profile.card === null ? Promise.resolve(null) : quiet<CardText | null>(openCard(profile.card, areaId, ring), null),
    quiet<readonly ModuleRow[]>(modulesNow(), []),
    quiet<readonly ChatRow[]>(chatsNow(), []),
    main === null ? Promise.resolve(null) : quiet<PageContent | null>(loadPage(main), null),
    imagesOf(main),
    imagesOf(after),
    profile.itemId === null ? Promise.resolve(null)
      : quiet<{ node: ProgramNode | null; calendarId: string } | null>(
        loadProgram(profile.itemId).then(async (p) => ({ node: await openProgram(p.items, ring), calendarId: p.calendarId })), null),
    profile.kind === 'event' ? quiet<EventCard | null>(loadEvent(areaId).then((r) => r.event), null) : Promise.resolve(null),
    quiet<readonly PageCard[]>(loadDesk().then((d) => d.pages.filter((p) => p.aliasOf === null)), []),
    quiet<readonly Member[]>(loadMembers(areaId).then((r) => r.members), []),
    quiet<readonly SealedName[]>(loadAreaNames(areaId).then((r) => r.names), []),
    profile.kind === 'course' ? quiet<readonly LibraryRow[]>(loadLibraries().then((r) => r.libraries), []) : Promise.resolve([] as readonly LibraryRow[]),
    quiet<readonly ImportKey[]>(loadImportKeys(areaId).then((r) => r.keys), [])
  ]);
  const keyOf = new Map(keys.filter((k) => k.kind === 'role' && k.refId !== null).map((k) => [k.refId!.toLowerCase(), k.key] as const));

  let names = new Map<string, string>();
  if (ring !== null && sealedNames.length > 0) {
    try { names = await openNames(await areaKeys(ring, areaId), areaId, sealedNames); } catch { /* ohne Namen */ }
  }
  const roles: RoleSeen[] = [];
  for (const m of members) {
    if (m.kind !== 'group') continue;
    const mine = ring !== null && ring.has(m.roleId);
    const name = names.get(m.roleId) ?? (mine && ring !== null ? await ring.name(m.roleId).catch(() => null) : null);
    roles.push({ roleId: m.roleId, key: keyOf.get(m.roleId.toLowerCase()) ?? null, name, level: levelOf(m.capabilities), mine, wrapPublicKey: m.wrapPublicKey });
  }

  /*
   * 2026-11-01 — DIE BAZY DES KURSES (`courseBases.ts`): beliebig viele, jede bleibt, wo sie ist; die Uczący się lesen
   * ihre Bereiche (die Rolle tritt ihnen bei — welche, sagt `learnersIn`). Vorher galt EINE Baza, geraten aus den
   * Bereichen der Rolle (dann zählte jede Nachbarin im selben Bereich mit) und ihre Ustawienia wurden umgestellt.
   */
  const knowledge = libraries.filter((l) => libraryKindOf(l) === 'knowledge');
  const refs = profile.kind !== 'course' ? [] : courseBaseRefs({
    areaId, knowledge, keys,
    parts: (page?.parts ?? []).map((p) => ({ id: p.id, kind: p.kind, config: readConfig(p.config) })),
    knowledgeFields: (kind) => partOf(kind)?.fields.filter((f) => f.kind === 'knowledge').map((f) => f.key) ?? []
  });
  const rowOf = (id: string) => knowledge.find((l) => l.libraryId.toLowerCase() === id.toLowerCase()) ?? null;
  const learners = profile.kind === 'course' ? roleFor(roles, LEARNERS) : null;
  const elsewhere = [...new Set(refs.map((b) => rowOf(b.libraryId)?.areaId ?? areaId).filter((there) => there !== areaId))];
  const read = learners === null ? [] : await Promise.all(elsewhere.map((there) => quiet<string | null>(loadMembers(there)
    .then((r) => (r.members.some((m) => m.roleId.toLowerCase() === learners.roleId.toLowerCase()) ? there : null)), null)));
  const learnersIn = new Set(read.filter((x): x is string => x !== null));
  const rows = refs.map((b) => rowOf(b.libraryId)).filter((r): r is LibraryRow => r !== null);
  const others = profile.kind === 'course' ? knowledge.filter((l) => !refs.some((b) => b.libraryId.toLowerCase() === l.libraryId.toLowerCase())) : [];
  const named = ring === null || profile.kind !== 'course' ? [] : await openLibraries(ring, [...rows, ...others]).catch(() => [] as OpenLibrary[]);
  const baseNames = new Map(named.map((l) => [l.libraryId, l.name]));

  return {
    card,
    forms: modules.filter((m) => m.kind === 'form' && m.areaId === areaId),
    chats: chats.filter((c) => c.areaId === areaId),
    page,
    images: [...mainImages, ...afterImages.filter((a) => !mainImages.some((b) => b.id === a.id))],
    program: program?.node ?? null,
    calendarId: program?.calendarId ?? null,
    publicCard,
    pages,
    roles,
    bases: refs.map((b) => {
      const row = rowOf(b.libraryId);
      return { ...b, row, name: row === null ? null : baseNames.get(row.libraryId) ?? null };
    }),
    otherBases: named.filter((l) => others.some((o) => o.libraryId === l.libraryId)),
    baseNames,
    learnersIn
  };
}

/* == Rollen der Arten ============================================================ */

export interface RoleDef {
  readonly key: string;
  readonly label: string;
  readonly capability: 'read' | 'write' | 'admin';
  readonly says: string;
  readonly link: string;
  /** Der polnische Name aus der Zeit vor den Sprachen — ältere Rollen heissen so. */
  readonly legacy?: string;
}

const ORGANISERS: RoleDef = {
  key: 'organisers', capability: 'admin', legacy: 'Organizatorzy', // i18n-ignore — der Name älterer Rollen
  get label() { return tApp('areasKind.role.organisers.label'); }, get says() { return tApp('areasKind.role.organisers.says'); }, get link() { return tApp('areasKind.role.organisers.link'); }
};
const HELPERS: RoleDef = {
  key: 'helpers', capability: 'write', legacy: 'Pomocnicy', // i18n-ignore — der Name älterer Rollen
  get label() { return tApp('areasKind.role.helpers.label'); }, get says() { return tApp('areasKind.role.helpers.says'); }, get link() { return tApp('areasKind.role.helpers.link'); }
};
const PARTICIPANTS: RoleDef = {
  key: 'participants', capability: 'read', legacy: 'Uczestnicy', // i18n-ignore — der Name älterer Rollen
  get label() { return tApp('areasKind.role.participants.label'); }, get says() { return tApp('areasKind.role.participants.says'); }, get link() { return tApp('areasKind.role.participants.link'); }
};
const MEMBERS: RoleDef = {
  key: 'members', capability: 'write', legacy: 'Członkowie', // i18n-ignore — der Name älterer Rollen
  get label() { return tApp('areasKind.role.members.label'); }, get says() { return tApp('areasKind.role.members.says'); }, get link() { return tApp('areasKind.role.members.link'); }
};
const LEADERS: RoleDef = {
  key: 'leaders', capability: 'admin', legacy: 'Prowadzący', // i18n-ignore — der Name älterer Rollen
  get label() { return tApp('areasKind.role.leaders.label'); }, get says() { return tApp('areasKind.role.leaders.says'); }, get link() { return tApp('areasKind.role.leaders.link'); }
};
const LEARNERS: RoleDef = {
  key: 'learners', capability: 'read', legacy: 'Uczący się', // i18n-ignore — der Name älterer Rollen
  get label() { return tApp('areasKind.role.learners.label'); }, get says() { return tApp('areasKind.role.learners.says'); }, get link() { return tApp('areasKind.role.learners.link'); }
};

/** Die Rolle einer Art — unter ihrem Schlüssel (auch aus einem JSON-Import), sonst an ihrem Namen („Uczestnicy: Rekolekcje 2027"). */
export const roleFor = (roles: readonly RoleSeen[], def: RoleDef): RoleSeen | null =>
  roles.find((r) => r.key === def.key)
  ?? roles.find((r) => r.name !== null && [def.label, def.legacy].some((n) => n !== undefined && (r.name === n || r.name!.startsWith(`${n}:`)))) ?? null;

/* == Der Reiter ================================================================== */

export interface Held {
  readonly ring: Ring;
  readonly person: SealedRole;
  readonly step: (what: string) => void;
}

/** Ein Handgriff — was er zurückgibt, steht danach als Hinweis da. */
export type Act = (held: Held) => Promise<string | void>;

export interface Ctx {
  readonly who: Who;
  readonly area: AreaRow;
  readonly areas: readonly AreaRow[];
  readonly state: ProfileState;
  readonly profile: Profile;
  readonly world: World;
  readonly busy: boolean;
  readonly run: (what: string, done: string, act: Act) => Promise<void>;
  /** Der Titel der Wizytówka, sonst der Name des Bereichs. */
  readonly title: string;
  readonly publishTo: string;
  readonly main: string | null;
  /** Das Formular zgłoszeń: das auf der Hauptseite, sonst das erste. */
  readonly signup: ModuleRow | null;
  readonly open: string | null;
  readonly setOpen: (id: string | null) => void;
  readonly links: Readonly<Record<string, string>>;
  readonly setLink: (key: string, url: string) => void;
  /** Die Wörter in der Sprache des Reiters. */
  readonly t: T;
}

export const nameOf = (ctx: Ctx, areaId: string): string =>
  areaId === ctx.area.areaId ? ctx.area.name : ctx.areas.find((a) => a.areaId === areaId)?.name ?? ctx.t('areasKind.otherArea');

export const isPublic = (ctx: Ctx, areaId: string): boolean => {
  if (areaId === ctx.area.areaId) return ctx.state.public;
  const row = ctx.areas.find((a) => a.areaId === areaId);
  return row !== undefined && row.publicLevel !== 'none';
};

export function AreaKindPanel({ who, area, areas, ring, state, profile, onChanged, withJson = true }: {
  who: Who;
  area: AreaRow;
  areas: readonly AreaRow[];
  ring: Ring | null;
  state: ProfileState;
  profile: Profile;
  onChanged: () => void;
  /** Den JSON des Bereichs zeigen — nicht, wenn ihn die Seite schon darunter hält (`AreaPage`). */
  withJson?: boolean;
}) {
  const t = useT();
  const [world, setWorld] = useState<World | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [links, setLinks] = useState<Readonly<Record<string, string>>>({});

  useEffect(() => {
    let alive = true;
    setFailed(false);
    void loadWorld(who, area.areaId, profile, ring).then(
      (found) => { if (alive) setWorld(found); },
      () => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [who, area.areaId, profile, ring]);

  const run = useCallback(async (what: string, done: string, act: Act) => {
    setBusy(what);
    setNote(null);
    try {
      const keys = await keysFor(who);
      const person = selfOf(keys.graph);
      if (keys.ring === null || person === null) throw new WorkspaceError(t('areasKind.passwordFirst'));
      const said = await act({ ring: keys.ring, person, step: setBusy });
      toast(done, { kind: 'ok' });
      if (typeof said === 'string' && said !== '') setNote(said);
    } catch (e) {
      toast(failure(e, t('areasKind.partlyFailed')), { kind: 'error' });
    } finally {
      /* Auch nach einem Fehler: ein Teil kann schon stehen. */
      forgetKeys();
      invalidate();
      refreshDesk();
      setBusy(null);
      onChanged();
    }
  }, [who, onChanged, t]);

  if (world === null) return failed ? <p className="wk-error">{t('areasKind.loadFailed')}</p> : <Loading lines={3} />;

  const main = profile.main?.path ?? null;
  const signup = (main === null ? undefined : world.forms.find((f) => f.extendsId === null && f.pages.includes(main)))
    ?? world.forms.find((f) => f.extendsId === null) ?? null;

  const ctx: Ctx = {
    who, area, areas, state, profile, world, busy: busy !== null, run,
    title: (world.card?.title ?? '').trim() || area.name,
    publishTo: profile.publishAreaId ?? area.areaId,
    main, signup, open, setOpen, links,
    setLink: (key, url) => setLinks((was) => ({ ...was, [key]: url })),
    t
  };

  const daily = profile.kind === 'school' || profile.kind === 'class';
  const tools = (
    <section className="wk-kind-sec" aria-labelledby="kind-tools-h">
      <h2 className="wk-h2" id="kind-tools-h">{t(`areasKind.toolsTitle.${profile.kind}`)}</h2>
      <ul className="wk-kind-tools">
        {profile.kind === 'event' && <EventTools ctx={ctx} />}
        {profile.kind === 'group' && <GroupTools ctx={ctx} />}
        {profile.kind === 'organisation' && <OrganisationTools ctx={ctx} />}
        {profile.kind === 'course' && <CourseTools ctx={ctx} />}
        {profile.kind === 'school' && <SchoolTools ctx={ctx} />}
        {profile.kind === 'class' && <ClassTools ctx={ctx} />}
      </ul>
    </section>
  );

  return (
    <div className="wk-kind" data-kind={profile.kind}>
      <Summary ctx={ctx} />

      {state.admin ? (
        <>
          {ring === null && <p className="wk-warn">{t('areasKind.keysClosed')}</p>}
          {busy !== null && <p className="wk-working" role="status">{busy}</p>}
          {note !== null && (
            <p className="wk-note" role="status">
              {note} <button type="button" className="wk-link-btn" onClick={() => setNote(null)}>{t('common.close')}</button>
            </p>
          )}

          <Readiness ctx={ctx} />

          {/* 0134 — in einer Szkoła und einer Klasa zuerst die Arbeit (Programme, Dziennik); eine Klasa veröffentlicht nichts. */}
          {daily && tools}

          <section className="wk-kind-sec" aria-labelledby="kind-card-h">
            <h2 className="wk-h2" id="kind-card-h">{t('areasJson.plan.card')}</h2>
            <CardEditor key={`${profile.card?.sealed ?? ''}|${profile.imageId ?? ''}|${profile.category ?? ''}|${world.card?.title ?? ''}`} ctx={ctx} />
          </section>

          {profile.kind !== 'class' && <PublishSection ctx={ctx} />}

          {!daily && tools}

          {profile.kind !== 'organisation' && profile.kind !== 'class' && (
            <section className="wk-kind-sec">
              <Listings areaId={area.areaId} editable />
            </section>
          )}
        </>
      ) : (
        <p className="wk-note">{t('areasKind.leaderChanges')}</p>
      )}

      {/* Importieren legt an und ändert — das tut, wer den Bereich führt. */}
      {state.admin && withJson && (
        <section className="wk-kind-sec" aria-labelledby="kind-json-h">
          <h2 className="wk-h2" id="kind-json-h">{t('areas.page.jsonTitle')}</h2>
          <AreaJsonPanel area={area} ring={ring} who={who} onImported={onChanged} />
        </section>
      )}
    </div>
  );
}

/* Die Überschrift der Werkzeuge je Art: `areasKind.toolsTitle.<art>`. */

/* == Für jeden Leser: die Karte ================================================== */

function Summary({ ctx }: { ctx: Ctx }) {
  const { profile, world, area, state, t } = ctx;
  const card = world.card;
  const item = profile.item;
  const when = item === null || item.startsAt === null ? null
    : whenText({ id: profile.itemId ?? '', startsAt: item.startsAt, endsAt: item.endsAt, allDay: item.allDay, status: null, fields: [] });
  const place = world.program?.location ?? null;
  const talk = world.chats.find((c) => c.kind === 'area') ?? null;
  const channel = world.chats.find((c) => c.kind === 'channel') ?? null;
  const after = profile.after?.path ?? null;

  return (
    <section className={`wk-kind-summary${profile.imageId !== null ? ' has-image' : ''}`} aria-labelledby="kind-title">
      {profile.imageId !== null && (
        <figure className="wk-kind-cover">
          <FadeImg src={eventImageUrl(profile.imageId)} alt="" loading="lazy" decoding="async" />
        </figure>
      )}
      <div className="wk-kind-summary-body">
        <p className="wk-kind-tags">
          <span className="wk-tag">{kindLabel(profile.kind)}</span>
          {profile.category !== null && profile.category !== '' && <span className="wk-tag">{profile.category}</span>}
          {profile.archivedAt !== null ? (<span className="wk-tag">{t('areasKind.summary.ended')}</span>) : profile.ended ? (<span className="wk-tag">{t('areasKind.summary.past')}</span>) : null}
          {state.openForms.length > 0 && <span className="wk-tag wk-tag-open">{t('areasKind.summary.open')}</span>}
        </p>
        <h2 className="wk-kind-title" id="kind-title">{(card?.title ?? '').trim() || area.name}</h2>
        {card !== null && card.lead.trim() !== '' && <p className="wk-kind-lead">{card.lead}</p>}
        {profile.card !== null && card === null && (
          <p className="wk-card-muted">{t('areasKind.summary.cardUnread')}</p>
        )}
        {(when !== null || place !== null) && <p className="wk-kind-when">{[when, place].filter((x) => x !== null).join(' · ')}</p>}
        {(ctx.main !== null || after !== null || talk !== null || channel !== null) && (
          <p className="wk-kind-links">
            {ctx.main !== null && <a className="wk-link" href={pagePath(ctx.main)}>{t('areasKind.summary.main')}</a>}
            {after !== null && <a className="wk-link" href={pagePath(after)}>{profile.ended ? t('areasKind.summary.after') : t('areasKind.summary.afterHidden')}</a>}
            {talk !== null && <a className="wk-link" href={viewPath('chat', talk.chatId)}>{t('areas.page.chatLink')}</a>}
            {channel !== null && <a className="wk-link" href={viewPath('chat', channel.chatId)}>{t('areas.page.channelLink')}</a>}
          </p>
        )}
      </div>
    </section>
  );
}

/* == Was noch fehlt ============================================================== */

interface Check {
  readonly key: string;
  readonly ok: boolean | null;
  readonly text: ReactNode;
  readonly fix?: ReactNode;
}

/** Ein Knopf, der einen Handgriff tut. */
export function Fix({ ctx, label, what, done, act }: { ctx: Ctx; label: string; what: string; done: string; act: Act }) {
  return (
    <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} onClick={() => void ctx.run(what, done, act)}>
      {label}
    </button>
  );
}

/** Ein Knopf, der ein Werkzeug weiter unten öffnet. */
export function Go({ ctx, label, to }: { ctx: Ctx; label: string; to: string }) {
  return (
    <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} onClick={() => {
      ctx.setOpen(to);
      window.requestAnimationFrame(() => document.getElementById(`kind-${to}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    }}>
      {label}
    </button>
  );
}

function checksOf(ctx: Ctx): Check[] {
  const { state, profile, world, area, t } = ctx;
  const c = state.controller;
  const settings = viewPath('areas', area.areaId, 'ustawienia');
  const out: Check[] = [];

  out.push({
    key: 'controller', ok: c !== null,
    text: c !== null ? t('areasKind.check.controller', { name: c.name })
      : profile.kind === 'group' ? t('areasKind.check.noControllerGroup')
      /* 2026-10-27 — eine öffentliche Seite braucht ihn (0129): ohne ihn keine Seite des Kurses, auf die der Link führt. */
      : profile.kind === 'course' ? t('areasKind.check.noControllerCourse')
      : t('areasKind.check.noController'),
    fix: <a className="wk-btn wk-btn-line wk-btn-small" href={settings}>{t('areasKind.check.setIt')}</a>
  });

  if (profile.kind === 'event') {
    out.push(cardCheck(ctx), publishCheck(ctx), mainCheck(ctx));
    const responsible = world.page?.responsible;
    if (ctx.main !== null && c !== null && responsible !== undefined) {
      const main = ctx.main;
      out.push({
        key: 'page-controller',
        ok: responsible !== null && (responsible.areaId === area.areaId || responsible.controller?.id === c.id),
        text: responsible !== null && (responsible.areaId === area.areaId || responsible.controller?.id === c.id)
          ? t('areasKind.check.pageController')
          : t('areasKind.check.pageOtherController'),
        fix: <Fix ctx={ctx} label={t('areasKind.check.assignPage')} what={t('areasKind.check.assigning')} done={t('areasKind.check.pageAssigned')}
          act={async () => { await setPageController(main, area.areaId); }} />
      });
    }
    out.push(termCheck(ctx));
    const vis = profile.item?.visibilityAreaId ?? null;
    if (profile.itemId !== null && vis !== null && !isPublic(ctx, vis)) {
      out.push({
        key: 'term-public', ok: false,
        text: t('areasKind.check.termMembers', { name: nameOf(ctx, vis) }),
        fix: <Go ctx={ctx} label={t('areasKind.check.changeWhere')} to="term" />
      });
    }
    out.push(signupCheck(ctx));
    out.push({
      key: 'public-card', ok: world.publicCard !== null,
      text: world.publicCard !== null ? t('areasKind.check.cardPublic')
        : t('areasKind.check.cardHidden')
    });
  }

  if (profile.kind === 'group') {
    const talk = world.chats.find((x) => x.kind === 'area') ?? null;
    out.push({
      key: 'chat', ok: talk !== null,
      text: talk !== null ? t('areasKind.check.groupChat') : t('areasKind.check.groupNoChat'),
      fix: <Fix ctx={ctx} label={t('areasKind.check.makeChat')} what={t('areas.page.creatingChat')} done={t('areasKind.check.groupChatReady')} act={(held) => makeChat(ctx, held, false)} />
    });
    const members = roleFor(world.roles, MEMBERS);
    out.push({
      key: 'members', ok: members !== null,
      text: members !== null ? t('areasKind.check.members') : t('areasKind.check.noMembers'),
      fix: <Fix ctx={ctx} label={t('areasKind.check.makeMembers')} what={t('areasKind.check.makingRole')} done={t('areasKind.check.membersReady')} act={(held) => makeRole(ctx, held, MEMBERS)} />
    });
  }

  if (profile.kind === 'organisation') {
    out.push(mainCheck(ctx));
    out.push({
      key: 'public', ok: state.public,
      text: state.public ? t('areasKind.check.public') : t('areasKind.check.notPublic'),
      fix: <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('areas', area.areaId, 'dostep')}>{t('areasKind.check.accessForAll')}</a>
    });
    if (ctx.main !== null) {
      const has = (world.page?.parts ?? []).some((p) => p.kind === 'events');
      out.push({
        key: 'lists', ok: has,
        text: has ? t('areasKind.check.lists') : t('areasKind.check.noLists'),
        fix: <Go ctx={ctx} label={t('areasKind.check.addLists')} to="lists" />
      });
    }
  }

  if (profile.kind === 'course') {
    const bases = world.bases;
    out.push({
      key: 'base', ok: bases.length > 0,
      text: bases.length > 0 ? t('areasKind.check.bases', { count: bases.length }) : t('areasKind.check.noBase'),
      fix: (
        <>
          <Fix ctx={ctx} label={t('areasKind.check.makeBase')} what={t('areasKind.check.makingBase')} done={t('areasKind.check.baseReady')} act={(held) => makeBase(ctx, held)} />
          {world.otherBases.length > 0 && <Go ctx={ctx} label={t('areasKind.check.chooseExisting')} to="base" />}
        </>
      )
    });
    const learners = roleFor(world.roles, LEARNERS);
    out.push({
      key: 'learners', ok: learners !== null,
      text: learners !== null ? t('areasKind.check.learners') : t('areasKind.check.noLearners'),
      fix: <Fix ctx={ctx} label={t('areasKind.check.makeRole')} what={t('areasKind.check.makingRole')} done={t('areasKind.check.learnersReady')} act={(held) => makeRole(ctx, held, LEARNERS)} />
    });
    /* 2026-11-01 — Bazy aus anderen Bereichen: die Uczący się müssen sie lesen, sonst sehen sie auf der Seite nichts. */
    const closed = bases.filter((b) => b.row !== null && !b.own && !world.learnersIn.has(b.row.areaId) && !isPublic(ctx, b.row.areaId));
    if (closed.length > 0) {
      out.push({
        key: 'access', ok: false,
        text: t('areasKind.check.learnersClosed', { count: closed.length, names: closed.map((b) => t('areasJson.quoted', { name: b.name ?? t('areasKind.base') })).join(', ') }),
        fix: <Fix ctx={ctx} label={t('areasKind.check.letLearners')} what={t('areasKind.check.lettingLearners')} done={t('areasKind.check.learnersRead')} act={(held) => letLearnersIntoAll(ctx, held, closed)} />
      });
    }
    if (ctx.main !== null && bases.length > 0) {
      const learning = bases.some((b) => b.learning.length > 0);
      out.push({
        key: 'learnpage', ok: learning,
        text: learning ? t('areasKind.check.learnPage') : t('areasKind.check.noLearnPage'),
        fix: <Fix ctx={ctx} label={t('areasKind.check.addRevisions')} what={t('areasKind.check.addingRevisions')} done={t('areasKind.check.revisionsAdded')} act={(held) => placeAll(ctx, held)} />
      });
      /* Ein Lernbaustein, dessen Antworten nicht ausdrücklich in den Kurs gehen (womöglich in einen anderen Kurs derselben Baza). */
      const stray = strayLearning(pageParts(ctx), ctx.area.areaId, (id) => insideCourse(ctx, id));
      if (stray.length > 0) {
        out.push({
          key: 'answers', ok: false,
          text: t('areasKind.check.stray', { count: stray.length }),
          fix: <Fix ctx={ctx} label={t('areasKind.check.route')} what={t('areasKind.check.savingPage')} done={t('areasKind.check.routed')} act={() => routeAnswers(ctx)} />
        });
      }
    }
  }

  return out;
}

function cardCheck(ctx: Ctx): Check {
  const { profile, world, t } = ctx;
  if (profile.card !== null && world.card === null) {
    return { key: 'card', ok: null, text: t('areasKind.check.cardUnread') };
  }
  const ok = world.card !== null && world.card.title.trim() !== '';
  return {
    key: 'card', ok,
    text: ok ? t(isPublic(ctx, profile.card?.areaId ?? ctx.area.areaId) ? 'areasKind.check.card' : 'areasKind.check.cardMembers', { title: world.card?.title ?? '' })
      : t('areasKind.check.noCard'),
    fix: <Go ctx={ctx} label={t('areasKind.check.complete')} to="card" />
  };
}

function publishCheck(ctx: Ctx): Check {
  const { t } = ctx;
  const name = nameOf(ctx, ctx.publishTo);
  const suggested = defaultPublishArea(ctx.areas, ctx.area.areaId);
  const better = suggested !== ctx.publishTo && isPublic(ctx, suggested) ? suggested : null;
  return {
    key: 'publish', ok: ctx.state.publishPublic,
    text: ctx.state.publishPublic ? t('areasKind.check.publishPublic', { name })
      : t('areasKind.check.publishClosed', { name }),
    fix: better !== null
      ? <Fix ctx={ctx} label={t('areasKind.check.publishIn', { name: nameOf(ctx, better) })} what={t('common.saving')} done={t('areasKind.check.publishedIn', { name: nameOf(ctx, better) })}
        act={async () => { await saveProfile(ctx.area.areaId, { publishAreaId: better }); }} />
      : <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('areas', ctx.publishTo, 'dostep')}>{t('areasKind.check.openForAll')}</a>
  };
}

function mainCheck(ctx: Ctx): Check {
  const { t } = ctx;
  return {
    key: 'main', ok: ctx.main !== null,
    text: ctx.main !== null ? <>{t('areasKind.check.mainLabel')} <a className="wk-link" href={pagePath(ctx.main)}>{`recreatio.pl/${ctx.main}`}</a></> : t('areasKind.check.noMain'),
    fix: <Go ctx={ctx} label={t('areasKind.check.makePage')} to="main" />
  };
}

function termCheck(ctx: Ctx): Check {
  const { t } = ctx;
  const item = ctx.profile.item;
  const when = item === null || item.startsAt === null ? null
    : whenText({ id: ctx.profile.itemId ?? '', startsAt: item.startsAt, endsAt: item.endsAt, allDay: item.allDay, status: null, fields: [] });
  return {
    key: 'term', ok: ctx.profile.itemId !== null,
    text: ctx.profile.itemId !== null ? t('areasKind.check.term', { when: when ?? t('areasKind.check.termSet') }) : t('areasKind.check.noTerm'),
    fix: <Go ctx={ctx} label={t('areasKind.check.addTerm')} to="term" />
  };
}

function signupCheck(ctx: Ctx): Check {
  const { state, profile, t } = ctx;
  const form = ctx.signup;
  if (state.openForms.length > 0) return { key: 'signup', ok: true, text: t('areasKind.check.signupOpen') };
  if (profile.archivedAt !== null) return { key: 'signup', ok: null, text: t('areasKind.check.signupEnded') };
  if (form === null) {
    return {
      key: 'signup', ok: false, text: t('areasKind.check.noSignup'),
      fix: <Fix ctx={ctx} label={t('areasKind.check.makeForm')} what={t('areasKind.stage.form')} done={t('areasKind.check.formReady')} act={(held) => makeSignup(ctx, held)} />
    };
  }
  if (form.closed) {
    return { key: 'signup', ok: false, text: t('areasKind.check.formClosed'), fix: <a className="wk-btn wk-btn-line wk-btn-small" href={formPath(form.moduleId)}>{t('areasKind.check.openForm')}</a> };
  }
  if (ctx.main !== null && !form.pages.includes(ctx.main)) {
    return {
      key: 'signup', ok: false, text: t('areasKind.check.formNotOnPage'),
      fix: <Fix ctx={ctx} label={t('areasKind.check.placeForm')} what={t('areasKind.check.placingForm')} done={t('areasKind.check.formPlaced')} act={() => placeForm(ctx, form.moduleId)} />
    };
  }
  const at = questionsAreaOf(form) ?? ctx.area.areaId;
  if (!isPublic(ctx, at)) {
    const target = isPublic(ctx, ctx.publishTo) && ctx.publishTo !== at ? ctx.publishTo : null;
    return {
      key: 'signup', ok: false, text: t('areasKind.check.questionsIn', { name: nameOf(ctx, at) }),
      fix: target === null ? undefined
        : <Fix ctx={ctx} label={t('areasKind.check.questionsTo', { name: nameOf(ctx, target) })} what={t('areasKind.check.movingQuestions')} done={t('areasKind.check.questionsMoved')}
          act={async (held) => { await moveQuestions(held.ring, form.moduleId, target === form.areaId ? null : target); }} />
    };
  }
  return { key: 'signup', ok: false, text: t('areasKind.check.signupNotYet') };
}

function Readiness({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  const checks = checksOf(ctx);
  const missing = checks.filter((c) => c.ok === false).length;
  return (
    <section className="wk-kind-sec" aria-labelledby="kind-ready-h">
      <h2 className="wk-h2" id="kind-ready-h">{missing === 0 ? t('areasKind.ready') : t('areasKind.todo', { count: missing })}</h2>
      <ul className="wk-kind-checks">
        {checks.map((c) => (
          <li key={c.key} className={c.ok === true ? 'is-ok' : c.ok === false ? 'is-missing' : 'is-unknown'} data-check={c.key}>
            <span className="wk-kind-mark" aria-hidden="true">{c.ok === true ? '✓' : c.ok === false ? '✗' : '·'}</span>
            <span className="wk-kind-check-text">{c.text}</span>
            {c.ok === false && c.fix !== undefined && <span className="wk-kind-fix">{c.fix}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* == Wizytówka und wohin =========================================================== */

const CATEGORIES = ['rekolekcje', 'pielgrzymka', 'wyjazd', 'obóz', 'warsztaty', 'koncert', 'spotkanie', 'kurs', 'schola', 'oaza']; // i18n-ignore — vorgeschlagene Werte (Daten)

/** Ein Bereich zur Wahl: der eigene und die, die ich führe — mit „każdy" / „tylko członkowie". */
export function WherePick({ ctx, label, value, onPick }: { ctx: Ctx; label: string; value: string; onPick: (areaId: string) => void }) {
  const { t } = ctx;
  const choices = publishChoices(ctx.areas, ctx.area.areaId);
  return (
    <div className="wk-field">
      <span>{label}</span>
      <AreaPick
        label={label}
        areas={ctx.areas}
        only={choices}
        value={value}
        disabled={ctx.busy}
        onChange={onPick}
        note={(areaId) => (isPublic(ctx, areaId) ? t('areasKind.where.everyone') : t('areasKind.where.members'))}
      />
    </div>
  );
}

function ImagePick({ images, value, busy, hasPage, onPick }: {
  images: readonly PageImageRow[]; value: string; busy: boolean; hasPage: boolean; onPick: (id: string) => void;
}) {
  const t = useT();
  if (images.length === 0 && value === '') {
    return (
      <p className="wk-kind-small">
        {hasPage ? t('areasKind.image.fromPage') : t('areasKind.image.later')}
      </p>
    );
  }
  const shown: readonly { id: string; name: string | null }[] = value !== '' && !images.some((one) => one.id === value)
    ? [{ id: value, name: t('areasKind.image.current') }, ...images] : images;
  return (
    <div className="wk-field">
      <span>{t('areasKind.image.label')}</span>
      <div className="wk-kind-images" role="radiogroup" aria-label={t('areasKind.image.label')}>
        <label className={`wk-kind-pick${value === '' ? ' is-on' : ''}`}>
          <input type="radio" name="kind-image" checked={value === ''} disabled={busy} onChange={() => onPick('')} />
          <span className="wk-kind-pick-none">{t('areasKind.image.none')}</span>
        </label>
        {shown.map((one) => (
          <label key={one.id} className={`wk-kind-pick${value === one.id ? ' is-on' : ''}`}>
            <input type="radio" name="kind-image" checked={value === one.id} disabled={busy} onChange={() => onPick(one.id)} />
            <FadeImg src={eventImageUrl(one.id)} alt={one.name ?? t('areasKind.image.alt')} loading="lazy" decoding="async" />
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * Der Titel der Hauptseite folgt der Wizytówka — solange er leer ist oder noch
 * der alte Titel der Wizytówka (eigens Geschriebenes bleibt).
 */
async function syncMainTitle(ctx: Ctx, next: CardText): Promise<string | null> {
  const page = ctx.world.page;
  const path = ctx.main;
  if (page === null || path === null || page.locked === true || next.title.trim() === '') return null;
  const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? '').trim() === (b ?? '').trim();
  const before = ctx.world.card;
  if ((page.title ?? '').trim() !== '' && !same(page.title, before?.title)) return null;
  const lead = (page.lead ?? '').trim() === '' || same(page.lead, before?.lead) ? (next.lead.trim() || null) : page.lead;
  if (same(page.title, next.title) && same(page.lead, lead)) return null;
  try {
    await savePage(path, { title: next.title.trim(), lead });
    return null;
  } catch (e) {
    return ctx.t('areasKind.card.titleNotSynced', { error: failure(e, ctx.t('areasSchool.school.error')) });
  }
}

function CardEditor({ ctx }: { ctx: Ctx }) {
  const { profile, world, area, t } = ctx;
  /* Eine Grupa und eine Klasa zeigen ihre Wizytówka zuerst nur ihren Menschen. */
  const firstWhere = profile.card?.areaId ?? (profile.kind === 'group' || profile.kind === 'class' ? area.areaId : ctx.publishTo);
  const [title, setTitle] = useState(world.card?.title ?? '');
  const [lead, setLead] = useState(world.card?.lead ?? '');
  const [category, setCategory] = useState(profile.category ?? '');
  const [imageId, setImageId] = useState(profile.imageId ?? '');
  const [where, setWhere] = useState(firstWhere);

  const unreadable = profile.card !== null && world.card === null;
  const changed = title !== (world.card?.title ?? '') || lead !== (world.card?.lead ?? '') || category !== (profile.category ?? '')
    || imageId !== (profile.imageId ?? '') || where !== firstWhere || unreadable;

  const save = () => ctx.run(t('areasKind.card.saving'), t('areasKind.card.saved'), async (held) => {
    const empty = title.trim() === '' && lead.trim() === '';
    const card = empty ? { sealed: '' as const } : await sealCard(held.ring, area.areaId, where, { title, lead }).catch(() => {
      throw new WorkspaceError(t('areasKind.card.noKey', { name: nameOf(ctx, where) }));
    });
    await saveProfile(area.areaId, { card, category: category.trim(), ...(imageId !== (profile.imageId ?? '') ? { imageId } : {}) });
    return (await syncMainTitle(ctx, { title, lead })) ?? undefined;
  });

  return (
    <form className="wk-kind-form" id="kind-card" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      {unreadable && (
        <p className="wk-warn">{t('areasKind.card.unreadable', { name: nameOf(ctx, profile.card?.areaId ?? '') })}</p>
      )}
      <label className="wk-field">
        <span>{t('common.title')}</span>
        <input value={title} maxLength={200} disabled={ctx.busy} placeholder={area.name} data-kind-title="" onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="wk-field">
        <span>{t('common.description')}</span>
        <textarea value={lead} rows={3} maxLength={600} disabled={ctx.busy} placeholder={t('areasKind.card.leadPlaceholder')} onChange={(e) => setLead(e.target.value)} />
      </label>
      <label className="wk-field">
        <span>{t('areasKind.card.category')}</span>
        <input value={category} maxLength={40} disabled={ctx.busy} list="kind-categories" placeholder={t('areasKind.card.categoryPlaceholder')} onChange={(e) => setCategory(e.target.value)} />
      </label>
      <datalist id="kind-categories">
        {CATEGORIES.map((one) => <option key={one} value={one} />)}
      </datalist>
      <ImagePick images={world.images} value={imageId} busy={ctx.busy} hasPage={ctx.main !== null} onPick={setImageId} />
      <WherePick ctx={ctx} label={t('areasKind.card.where')} value={where} onPick={setWhere} />
      <div className="wk-actions">
        <button type="submit" className="wk-btn wk-btn-small" disabled={ctx.busy || !changed} data-kind-save-card="">{t('areasKind.card.save')}</button>
      </div>
    </form>
  );
}

function PublishSection({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  const now = ctx.publishTo;
  const suggested = defaultPublishArea(ctx.areas, ctx.area.areaId);
  const pick = (next: string) => {
    if (next === now) return;
    void ctx.run(t('common.saving'), t('areasKind.check.publishedIn', { name: nameOf(ctx, next) }), async () => {
      await saveProfile(ctx.area.areaId, { publishAreaId: next === ctx.area.areaId ? '' : next });
    });
  };
  return (
    <section className="wk-kind-sec" aria-labelledby="kind-publish-h" id="kind-publish">
      <h2 className="wk-h2" id="kind-publish-h">{t('areasKind.publish.title')}</h2>
      <WherePick ctx={ctx} label={t('areasKind.publish.label')} value={now} onPick={pick} />
      {suggested !== now && isPublic(ctx, suggested) && (
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={() => pick(suggested)}>
            {t('areasKind.publish.suggested', { name: nameOf(ctx, suggested) })}
          </button>
        </div>
      )}
      <p className="wk-kind-small">
        {t('areasKind.publish.note')}
      </p>
    </section>
  );
}

/* == Werkzeuge =================================================================== */

export function Tool({ id, name, ok, says, children }: { id: string; name: string; ok: boolean | null; says?: ReactNode; children?: ReactNode }) {
  return (
    <li id={`kind-${id}`} className={`wk-kind-tool${ok === true ? ' is-ok' : ok === false ? ' is-missing' : ''}`} data-tool={id}>
      <span className="wk-kind-mark" aria-hidden="true">{ok === true ? '✓' : ok === false ? '+' : '·'}</span>
      <div className="wk-kind-tool-body">
        <h3 className="wk-kind-tool-name">{name}</h3>
        {says !== undefined && <p className="wk-kind-tool-says">{says}</p>}
        {children}
      </div>
    </li>
  );
}

function EventTools({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <MainPageTool ctx={ctx} />
      <SubpagesTool ctx={ctx} />
      <SignupTool ctx={ctx} />
      {ctx.signup !== null && <SubFormsTool ctx={ctx} form={ctx.signup} />}
      <TermTool key={`${ctx.profile.itemId ?? ''}|${ctx.profile.item?.startsAt ?? ''}|${ctx.world.program?.title ?? ''}`} ctx={ctx} />
      <AskTool ctx={ctx} />
      <ChatTool ctx={ctx} kind="channel" />
      <ChatTool ctx={ctx} kind="area" />
      <RolesTool ctx={ctx} defs={[ORGANISERS, HELPERS, PARTICIPANTS]} />
      <AfterTool ctx={ctx} />
      <ArchiveTool ctx={ctx} />
    </>
  );
}

function GroupTools({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <ChatTool ctx={ctx} kind="area" />
      <ChatTool ctx={ctx} kind="channel" />
      <RolesTool ctx={ctx} defs={[MEMBERS, LEADERS]} />
      <MainPageTool ctx={ctx} optional />
    </>
  );
}

function OrganisationTools({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  const c = ctx.state.controller;
  return (
    <>
      <Tool id="controller" name={t('areas.page.controller')} ok={c !== null}
        says={c !== null ? t('areasKind.org.controller', { name: c.name }) : t('areasKind.org.noController')}>
        <div className="wk-actions">
          <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('areas', ctx.area.areaId, 'ustawienia')}>{c !== null ? t('common.settings') : t('areasKind.org.set')}</a>
        </div>
      </Tool>
      <MainPageTool ctx={ctx} />
      <ListsTool ctx={ctx} />
    </>
  );
}

/**
 * 2026-11-01 — DER KURS NUTZT BAZY, ER BESITZT SIE NICHT (`courseBases.ts`): beliebig viele, jede in ihrem Bereich,
 * jede auch in anderen Kursen und auf Seiten ohne Kurs. Je Baza: wo sie liegt, ob die Uczący się sie lesen, ob die
 * Hauptseite mit ihr lernt — und Otwórz, Postępy (die dieses Kurses), Dodaj na stronę, Odłącz.
 */
function CourseTools({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  const bases = ctx.world.bases;
  const picking = ctx.open === 'base';
  return (
    <>
      <Tool id="base" name={bases.length > 1 ? t('areasKind.course.bases') : t('areasKind.base')} ok={bases.length > 0}
        says={bases.length > 0
          ? t('areasKind.course.basesSays')
          : ctx.world.otherBases.length > 0 ? t('areasKind.course.noBaseOthers')
          : t('areasKind.course.noBase')}>
        {bases.length > 0 && (
          <ul className="wk-kind-bases" data-course-bases={bases.length}>
            {bases.map((b) => <BaseRow key={b.libraryId} ctx={ctx} base={b} />)}
          </ul>
        )}
        {picking ? <PickBase ctx={ctx} /> : (
          <div className="wk-actions">
            <button type="button" className={bases.length === 0 ? 'wk-btn wk-btn-small' : 'wk-btn wk-btn-line wk-btn-small'} disabled={ctx.busy} data-course-new=""
              onClick={() => void ctx.run(t('areasKind.check.makingBase'), t('areasKind.check.baseReady'), (held) => makeBase(ctx, held))}>
              {bases.length === 0 ? t('areasKind.check.makeBase') : t('areasKind.course.makeNew')}
            </button>
            {ctx.world.otherBases.length > 0 && (
              <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} data-course-pick="" onClick={() => ctx.setOpen('base')}>
                {bases.length === 0 ? t('areasKind.check.chooseExisting') : t('areasKind.course.addExisting')}
              </button>
            )}
          </div>
        )}
      </Tool>
      <RolesTool ctx={ctx} defs={[LEARNERS]} />
      <MainPageTool ctx={ctx} optional />
    </>
  );
}

/** Eine Baza des Kurses — eine Zeile mit ihrem Stand und ihren Handgriffen. */
function BaseRow({ ctx, base }: { ctx: Ctx; base: CourseBase }) {
  const { t } = ctx;
  const name = base.name ?? t('areasKind.base');
  const row = base.row;
  const learners = roleFor(ctx.world.roles, LEARNERS);
  const elsewhere = row !== null && !base.own;
  const reads = row === null || base.own || ctx.world.learnersIn.has(row.areaId);
  const open = !reads && row !== null && isPublic(ctx, row.areaId);
  const state = [
    row === null ? t('areasKind.course.noAccess') : null,
    elsewhere ? (reads ? t('areasKind.course.learnersRead') : open ? t('areasKind.course.areaPublic') : t('areasKind.course.learnersDont')) : null,
    ctx.main === null ? null : base.learning.length > 0 ? t('areasKind.course.onMain') : t('areasKind.course.notOnMain')
  ].filter((x): x is string => x !== null);
  const unlink = async () => {
    const remaining = ctx.world.bases.filter((b) => b.libraryId !== base.libraryId && b.row !== null).map((b) => b.row!);
    const closes = row !== null && learners !== null && ctx.world.learnersIn.has(row.areaId) && closesArea(ctx.area.areaId, row, remaining);
    const yes = await ask({
      title: t('areasKind.course.unlinkAsk', { name }),
      body: [
        base.parts.length > 0 ? t('areasKind.course.unlinkModules') : null,
        closes && row !== null ? t('areasKind.course.unlinkRole', { role: LEARNERS.label, name: nameOf(ctx, row.areaId) }) : null,
        t('areasKind.course.unlinkStays')
      ].filter((x) => x !== null).join(' '),
      confirm: t('areas.audience.detach')
    });
    if (yes) void ctx.run(t('areasKind.course.unlinking'), t('areasKind.course.unlinked', { name }), (held) => unlinkBase(ctx, held, base, closes));
  };
  return (
    <li className="wk-kind-base" data-course-base={base.libraryId}>
      <p className="wk-kind-base-name"><strong>{t('areasJson.quoted', { name })}</strong>{row !== null && <span className="wk-card-muted"> — {base.own ? t('areasKind.course.inCourse') : t('areasKind.course.inArea', { name: nameOf(ctx, row.areaId) })}</span>}</p>
      {state.length > 0 && <p className="wk-kind-small" data-course-base-state="">{state.join(' · ')}</p>}
      <div className="wk-actions">
        {row !== null && <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('knowledge', row.libraryId, 'wpisy')}>{t('common.open')}</a>}
        {/* 2026-10-27 — wie die Uczący się lernen; 2026-11-01 — die DIESES Kurses (sein Bereich in der Adresse). */}
        {row !== null && <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('learn', row.libraryId, 'postepy', answersOfBase(pageParts(ctx), base.learning, ctx.area.areaId))} data-course-progress="">{t('areasKind.course.progress')}</a>}
        {row !== null && ctx.main !== null && base.learning.length === 0 && (
          <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} data-course-place=""
            onClick={() => void ctx.run(t('areasKind.course.addingRevision'), t('areasKind.course.revisionAdded'), (held) => placeBase(ctx, held, row))}>{t('areasKind.course.addToPage')}</button>
        )}
        {row !== null && !reads && !open && (
          <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} data-course-letin=""
            onClick={() => void ctx.run(t('areasKind.check.lettingLearners'), t('areasKind.course.learnersReadArea', { name: nameOf(ctx, row.areaId) }), async (held) => { await letLearnersIn(ctx, held, [row.areaId]); })}>{t('areasKind.check.letLearners')}</button>
        )}
        {!base.own && <button type="button" className="wk-link-btn" disabled={ctx.busy} data-course-unlink="" onClick={() => void unlink()}>{t('areas.audience.detach')}</button>}
      </div>
    </li>
  );
}

/**
 * 2026-10-31 — „WYBIERZ ISTNIEJĄCĄ", 2026-11-01 „DODAJ ISTNIEJĄCĄ": noch eine Baza für den Kurs, wo sie ist. Zur Wahl
 * stehen Bazy aus Bereichen, in die ich hineinlassen darf (oder die die Uczący się schon lesen), nie aus dem privaten;
 * dabei steht, dass die Uczący się den ganzen Bereich lesen werden — mit den anderen Bazy darin. Die Baza selbst
 * ändert sich nicht.
 */
function PickBase({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  const course = ctx.area.areaId;
  const read = ctx.world.learnersIn;
  const name = (b: LibraryRow) => ctx.world.baseNames.get(b.libraryId) ?? t('areasKind.base');
  const choices = ctx.world.otherBases.filter((b) => {
    if (b.areaId === course || read.has(b.areaId)) return true;
    const area = ctx.areas.find((a) => a.areaId === b.areaId);
    return area !== undefined && area.personal !== true && area.mayCertify;
  });
  const [picked, setPicked] = useState('');
  const [place, setPlace] = useState(true);
  const chosen = choices.find((b) => b.libraryId === picked) ?? choices[0];
  const neighbours = chosen === undefined ? [] : [
    ...ctx.world.otherBases.filter((b) => b.areaId === chosen.areaId && b.libraryId !== chosen.libraryId),
    ...ctx.world.bases.map((b) => b.row).filter((r): r is LibraryRow => r !== null && r.areaId === chosen.areaId)
  ];
  return (
    <form className="wk-kind-form" data-course-pick-form="" onSubmit={(e) => {
      e.preventDefault();
      if (chosen === undefined) return;
      const pick = { ...chosen, name: name(chosen) };
      void ctx.run(t('areasKind.course.linking'), t('areasKind.course.linked', { name: pick.name }), (held) => addBase(ctx, held, pick, place && ctx.main !== null));
    }}>
      {chosen === undefined ? (
        <p className="wk-kind-small">{t('areasKind.course.noneToAdd')}</p>
      ) : (
        <>
          <label className="wk-field">
            <span>{t('areasKind.course.existing')}</span>
            <select value={chosen.libraryId} disabled={ctx.busy} onChange={(e) => setPicked(e.target.value)} data-course-pick-select="">
              {choices.map((b) => <option key={b.libraryId} value={b.libraryId}>{t('areasKind.course.baseInArea', { base: name(b), name: nameOf(ctx, b.areaId) })}</option>)}
            </select>
          </label>
          {chosen.areaId === course ? (
            <p className="wk-kind-small">{t('areasKind.course.inCourseRead')}</p>
          ) : read.has(chosen.areaId) ? (
            <p className="wk-kind-small">{t('areasKind.course.alreadyRead', { name: nameOf(ctx, chosen.areaId) })}</p>
          ) : (
            <p className="wk-warn" data-course-pick-warn="">
              {neighbours.length > 0
                ? t('areasKind.course.pickWarnNeighbours', { name: nameOf(ctx, chosen.areaId), role: LEARNERS.label, count: neighbours.length, bases: neighbours.map((b) => t('areasJson.quoted', { name: name(b) })).join(', ') })
                : t('areasKind.course.pickWarn', { name: nameOf(ctx, chosen.areaId), role: LEARNERS.label })}
              {roleFor(ctx.world.roles, LEARNERS) === null && ` ${t('areasKind.course.roleWillBeMade')}`}
            </p>
          )}
          <p className="wk-kind-small">{t('areasKind.course.settingsStay')}</p>
          {ctx.main !== null && (
            <label className="wk-check" data-course-pick-place="">
              <input type="checkbox" checked={place} disabled={ctx.busy} onChange={(e) => setPlace(e.target.checked)} />
              <span>{t('areasKind.course.placeToo')}</span>
            </label>
          )}
        </>
      )}
      <div className="wk-actions">
        {chosen !== undefined && <button type="submit" className="wk-btn wk-btn-small" disabled={ctx.busy} data-course-pick-go="">{t('areasKind.course.addThis')}</button>}
        <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={() => ctx.setOpen(null)}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

/* -- Strona główna, podstrony -- */

export function MainPageTool({ ctx, optional = false }: { ctx: Ctx; optional?: boolean }) {
  const { t } = ctx;
  const main = ctx.main;
  const editing = ctx.open === 'main';
  const pages = ctx.world.pages.filter((p) => p.path !== '');
  const [parent, setParent] = useState('');
  const [slug, setSlug] = useState('');
  const [picked, setPicked] = useState('');
  const under = parent !== '' ? parent : pages[0]?.path ?? '';
  const address = slugOf(slug.trim() === '' ? ctx.title : slug);

  if (main !== null && !editing) {
    return (
      <Tool id="main" name={t('areasKind.summary.main')} ok says={<a className="wk-link" href={pagePath(main)}>{`recreatio.pl/${main}`}</a>}>
        <div className="wk-actions">
          <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('pages', ...pageSteps(main))}>{t('areasKind.main.edit')}</a>
          <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={() => ctx.setOpen('main')}>{t('areasKind.main.other')}</button>
        </div>
      </Tool>
    );
  }

  return (
    <Tool id="main" name={t('areasKind.summary.main')} ok={main !== null ? true : optional ? null : false}
      says={ctx.profile.kind === 'event' ? t('areasKind.main.saysEvent') : t('areasKind.main.says')}>
      {pages.length === 0 ? (
        <p className="wk-kind-small">
          {rich(t('areasKind.main.noPages'), { a: (s) => <a className="wk-link" href={viewPath('pages')}>{s}</a> })}
        </p>
      ) : (
        <form className="wk-kind-form" onSubmit={(e) => {
          e.preventDefault();
          void ctx.run(t('areasKind.main.creating'), t('areasKind.main.ready'), (held) => makeMainPage(ctx, held, `${under}/${address}`));
        }}>
          <div className="wk-kind-row">
            <label className="wk-field">
              <span>{t('areasKind.main.under')}</span>
              <select value={under} disabled={ctx.busy} onChange={(e) => setParent(e.target.value)}>
                {pages.map((p) => <option key={p.path} value={p.path}>{`recreatio.pl/${p.path}/…`}</option>)}
              </select>
            </label>
            <label className="wk-field">
              <span>{t('areasKind.main.ending')}</span>
              <input value={slug} maxLength={40} disabled={ctx.busy} placeholder={slugOf(ctx.title)} onChange={(e) => setSlug(e.target.value)} />
            </label>
          </div>
          <p className="wk-kind-address">{`recreatio.pl/${under}/${address}`}</p>
          <div className="wk-actions">
            <button type="submit" className="wk-btn wk-btn-small" disabled={ctx.busy || under === ''} data-kind-main="">{t('areasKind.check.makePage')}</button>
          </div>
        </form>
      )}
      <div className="wk-field">
        <span>{t('areasKind.main.existing')}</span>
        <PickPage value={picked} busy={ctx.busy} onPick={setPicked} />
      </div>
      <div className="wk-actions">
        {picked !== '' && picked !== main && (
          <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
            onClick={() => void ctx.run(t('common.saving'), t('areasKind.main.set'), async () => { await saveProfile(ctx.area.areaId, { path: picked }); ctx.setOpen(null); })}>
            {t('areasKind.main.setAsMain')}
          </button>
        )}
        {editing && <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={() => ctx.setOpen(null)}>{t('common.cancel')}</button>}
      </div>
    </Tool>
  );
}

function SubpagesTool({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  const [name, setName] = useState('');
  const main = ctx.main;
  if (main === null) return null;
  const after = ctx.profile.after?.path ?? null;
  const lower = ctx.world.pages.filter((p) => p.path.startsWith(`${main}/`) && p.path !== after);
  return (
    <Tool id="sub" name={t('areasKind.sub.title')} ok={lower.length > 0 ? true : null} says={t('areasKind.sub.says')}>
      {lower.length > 0 && (
        <ul className="wk-kind-list">
          {lower.map((p) => <li key={p.path}><a className="wk-link" href={viewPath('pages', ...pageSteps(p.path))}>{p.path.slice(main.length + 1)}</a></li>)}
        </ul>
      )}
      <form className="wk-kind-form wk-kind-inline" onSubmit={(e) => {
        e.preventDefault();
        const called = name.trim();
        if (called === '') return;
        void ctx.run(t('areasKind.sub.creating'), t('areasKind.sub.ready'), async (held) => {
          await createSubpage({ path: `${main}/${slugOf(called)}`, roleId: held.person.id, areaId: null, title: called, lead: null, parts: [] });
          setName('');
        });
      }}>
        <label className="wk-field">
          <span>{t('areasKind.sub.new')}</span>
          <input value={name} maxLength={80} disabled={ctx.busy} placeholder={t('areasKind.sub.placeholder')} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy || name.trim() === ''}>{t('common.add')}</button>
      </form>
    </Tool>
  );
}

/* -- Formularze -- */

function SignupTool({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  const form = ctx.signup;
  if (form === null) {
    return (
      <Tool id="signup" name={t('areasKind.signupTool.title')} ok={false}
        says={t('areasKind.signupTool.says')}>
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-small" disabled={ctx.busy} data-kind-signup=""
            onClick={() => void ctx.run(t('areasKind.stage.form'), t('areasKind.check.formReady'), (held) => makeSignup(ctx, held))}>
            {t('areasKind.check.makeForm')}
          </button>
        </div>
      </Tool>
    );
  }
  const onMain = ctx.main !== null && form.pages.includes(ctx.main);
  const at = questionsAreaOf(form) ?? ctx.area.areaId;
  const open = ctx.state.openForms.includes(form.moduleId);
  return (
    <Tool id="signup" name={t('areasKind.signupTool.title')} ok={open}
      says={`${form.name} · ${t('areasKind.signupTool.entries', { count: form.entries })} · ${form.closed ? t('areasKind.signupTool.closed') : open ? t('areasKind.signupTool.accepts') : t('areasKind.signupTool.notYet')}`}>
      <div className="wk-actions">
        <a className="wk-btn wk-btn-line wk-btn-small" href={formPath(form.moduleId)}>{t('common.open')}</a>
        {!onMain && ctx.main !== null && (
          <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
            onClick={() => void ctx.run(t('areasKind.check.placingForm'), t('areasKind.check.formPlaced'), () => placeForm(ctx, form.moduleId))}>
            {t('areasKind.signupTool.place')}
          </button>
        )}
      </div>
      <WherePick ctx={ctx} label={t('areasKind.signupTool.where')} value={at} onPick={(next) => {
        if (next === at) return;
        void ctx.run(t('areasKind.check.movingQuestions'), t('areasKind.signupTool.moved', { name: nameOf(ctx, next) }), async (held) => {
          await moveQuestions(held.ring, form.moduleId, next === form.areaId ? null : next);
        });
      }} />
      <p className="wk-kind-small">{t('areasKind.signupTool.note')}</p>
    </Tool>
  );
}

function SubFormsTool({ ctx, form }: { ctx: Ctx; form: ModuleRow }) {
  const { t } = ctx;
  const [name, setName] = useState('');
  const [filler, setFiller] = useState<'person' | 'office'>('person');
  const subs = ctx.world.forms.filter((f) => f.extendsId === form.moduleId);
  return (
    <Tool id="subforms" name={t('areasJson.step.subforms')} ok={subs.length > 0 ? true : null}
      says={t('areasKind.subforms.says')}>
      {subs.length > 0 && (
        <ul className="wk-kind-list">
          {subs.map((f) => (
            <li key={f.moduleId}>
              <a className="wk-link" href={formPath(f.moduleId)}>{f.name}</a> <span className="wk-tag">{f.audience === 'office' ? t('areasKind.subforms.office') : t('areasKind.subforms.person')}</span>
            </li>
          ))}
        </ul>
      )}
      <form className="wk-kind-form wk-kind-inline" onSubmit={(e) => {
        e.preventDefault();
        const called = name.trim();
        if (called === '') return;
        void ctx.run(t('areasKind.subforms.creating'), t('areasKind.subforms.ready'), async () => {
          await createModule(newId(), 'form', called, ctx.area.areaId, 'person', undefined, { extendsId: form.moduleId, audience: filler });
          setName('');
        });
      }}>
        <label className="wk-field">
          <span>{t('areasKind.subforms.new')}</span>
          <input value={name} maxLength={120} disabled={ctx.busy} placeholder={t('areasKind.subforms.placeholder')} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="wk-field">
          <span>{t('areasKind.subforms.filler')}</span>
          <select value={filler} disabled={ctx.busy} onChange={(e) => setFiller(e.target.value === 'office' ? 'office' : 'person')}>
            <option value="person">{t('areasKind.subforms.person')}</option>
            <option value="office">{t('areasKind.subforms.office')}</option>
          </select>
        </label>
        <button type="submit" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy || name.trim() === ''}>{t('common.add')}</button>
      </form>
    </Tool>
  );
}

/* -- Termin i program -- */

interface TermDraft {
  readonly title: string;
  readonly date: string;
  readonly time: string;
  readonly endDate: string;
  readonly endTime: string;
  readonly place: string;
  /* Die Notiz geht unverändert mit — sonst nähme das Speichern sie weg. */
  readonly notes: string;
  readonly where: string;
}

interface PointDraft {
  readonly title: string;
  readonly date: string;
  readonly time: string;
  readonly endTime: string;
  readonly place: string;
}

const two = (n: number): string => String(n).padStart(2, '0');
const dayOf = (d: Date): string => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const timeOf = (d: Date): string => `${two(d.getHours())}:${two(d.getMinutes())}`;

function termDraft(ctx: Ctx): TermDraft {
  const node = ctx.world.program;
  const where = ctx.profile.item?.visibilityAreaId ?? ctx.publishTo;
  if (node === null) return { title: ctx.title, date: '', time: '', endDate: '', endTime: '', place: '', notes: '', where };
  const last = node.allDay ? new Date(node.end.getTime() - 1) : node.end;
  return {
    title: node.title,
    date: dayOf(node.start),
    time: node.allDay ? '' : timeOf(node.start),
    endDate: dayOf(last) === dayOf(node.start) ? '' : dayOf(last),
    endTime: node.allDay ? '' : timeOf(node.end),
    place: node.location ?? '',
    notes: node.notes ?? '',
    where
  };
}

const pointWhen = (root: ProgramNode, p: ProgramNode, t: T): string => {
  const time = (d: Date) => d.toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' });
  const day = dayOf(p.start) === dayOf(root.start) && dayOf(root.end) === dayOf(root.start) ? ''
    : `${p.start.toLocaleDateString(t.locale, { weekday: 'short', day: 'numeric', month: 'short' })} `;
  return p.allDay ? day.trim() || t('areasKind.term.allDay') : `${day}${time(p.start)}–${time(p.end)}`;
};

function TermTool({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  const has = ctx.profile.itemId !== null;
  const node = ctx.world.program;
  const editing = !has || ctx.open === 'term';
  const [draft, setDraft] = useState<TermDraft>(() => termDraft(ctx));
  const [point, setPoint] = useState<PointDraft | null>(null);
  const [mode, setMode] = useState<'new' | 'pick'>('new');
  const set = (change: Partial<TermDraft>) => setDraft((was) => ({ ...was, ...change }));
  const vis = ctx.profile.item?.visibilityAreaId ?? null;
  const itemId = ctx.profile.itemId;
  const programShown = itemId !== null && (ctx.world.page?.parts ?? []).some((p) => p.kind === 'program' && readConfig(p.config).item === itemId);
  /* Ein Termin mit Link oder ohne lesbare Felder: hier gespeichert, ginge etwas verloren. */
  const here = node !== null && node.link === null && node.linkLabel === null;

  if (!editing) {
    const when = ctx.profile.item?.startsAt == null ? null
      : whenText({ id: itemId ?? '', startsAt: ctx.profile.item.startsAt, endsAt: ctx.profile.item.endsAt, allDay: ctx.profile.item.allDay, status: null, fields: [] });
    return (
      <Tool id="term" name={t('areasKind.term.title')} ok
        says={<>{when ?? t('areasKind.term.term')}{node?.location ? ` · ${node.location}` : ''}{vis !== null ? ` · ${isPublic(ctx, vis) ? t('areasKind.term.seenAll') : t('areasKind.term.seenOnly', { name: nameOf(ctx, vis) })}` : ''}</>}>
        <div className="wk-actions">
          {here ? (
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} onClick={() => ctx.setOpen('term')}>{t('areasKind.term.change')}</button>
          ) : (
            <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('calendar')}>{t('areasKind.term.changeInCalendar')}</a>
          )}
          {ctx.main !== null && itemId !== null && !programShown && (
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
              onClick={() => void ctx.run(t('areasKind.term.placing'), t('areasKind.term.placed'), () => placeProgram(ctx))}>
              {t('areasKind.term.show')}
            </button>
          )}
        </div>
        {node !== null && node.children.length > 0 && (
          <ol className="wk-kind-points">
            {node.children.map((p) => (
              <li key={p.itemId}>
                <span className="wk-kind-point-when">{pointWhen(node, p, t)}</span> {p.title}{p.location !== null && p.location !== '' ? ` · ${p.location}` : ''}
              </li>
            ))}
          </ol>
        )}
        {node !== null && (point === null ? (
          <div className="wk-actions">
            <button type="button" className="wk-link-btn" disabled={ctx.busy}
              onClick={() => setPoint({ title: '', date: dayOf(node.start), time: '', endTime: '', place: '' })}>
              {t('areasKind.term.addPoint')}
            </button>
          </div>
        ) : (
          <form className="wk-kind-form" onSubmit={(e) => {
            e.preventDefault();
            const wanted = point;
            void ctx.run(t('areasKind.term.addingPoint'), t('areasKind.term.pointAdded'), async (held) => { await addPoint(ctx, held, wanted); setPoint(null); });
          }}>
            <label className="wk-field">
              <span>{t('areasKind.term.point')}</span>
              <input value={point.title} maxLength={200} disabled={ctx.busy} placeholder={t('areasKind.term.pointPlaceholder')} onChange={(e) => setPoint({ ...point, title: e.target.value })} />
            </label>
            <div className="wk-kind-row">
              <label className="wk-field">
                <span>{t('areasSchool.class.day')}</span>
                <input type="date" value={point.date} disabled={ctx.busy} onChange={(e) => setPoint({ ...point, date: e.target.value })} />
              </label>
              <label className="wk-field">
                <span>{t('common.from')}</span>
                <input type="time" value={point.time} disabled={ctx.busy} onChange={(e) => setPoint({ ...point, time: e.target.value })} />
              </label>
              <label className="wk-field">
                <span>{t('common.to')}</span>
                <input type="time" value={point.endTime} disabled={ctx.busy || point.time === ''} onChange={(e) => setPoint({ ...point, endTime: e.target.value })} />
              </label>
            </div>
            <label className="wk-field">
              <span>{t('areasKind.term.placeOptional')}</span>
              <input value={point.place} maxLength={200} disabled={ctx.busy} onChange={(e) => setPoint({ ...point, place: e.target.value })} />
            </label>
            <div className="wk-actions">
              <button type="submit" className="wk-btn wk-btn-small" disabled={ctx.busy || point.title.trim() === '' || point.date === ''}>{t('areasKind.term.addPointButton')}</button>
              <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={() => setPoint(null)}>{t('common.cancel')}</button>
            </div>
          </form>
        ))}
      </Tool>
    );
  }

  if (has && !here) {
    return (
      <Tool id="term" name={t('areasKind.term.title')} ok says={t('areasKind.term.linked')}>
        <div className="wk-actions">
          <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('calendar')}>{t('areasKind.term.openCalendar')}</a>
          <button type="button" className="wk-link-btn" onClick={() => ctx.setOpen(null)}>{t('common.close')}</button>
        </div>
      </Tool>
    );
  }

  return (
    <Tool id="term" name={t('areasKind.term.title')} ok={has ? true : false}
      says={has ? undefined : t('areasKind.term.says')}>
      <Segment
        now={mode}
        options={[{ value: 'new', label: has ? t('areasKind.term.changeThis') : t('areasKind.term.new') }, { value: 'pick', label: t('areasKind.term.pickExisting') }]}
        busy={ctx.busy}
        onPick={setMode}
      />
      {mode === 'pick' ? <PickTerm ctx={ctx} /> : (
      <form className="wk-kind-form" onSubmit={(e) => {
        e.preventDefault();
        const wanted = draft;
        void ctx.run(t('areasKind.term.saving'), has ? t('areasKind.term.saved') : t('areasKind.term.ready'), async (held) => {
          await saveTerm(ctx, held, wanted);
          ctx.setOpen(null);
        });
      }}>
        <label className="wk-field">
          <span>{t('areasKind.term.titleField')}</span>
          <input value={draft.title} maxLength={200} disabled={ctx.busy} placeholder={ctx.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <div className="wk-kind-row">
          <label className="wk-field">
            <span>{t('areasKind.term.start')}</span>
            <input type="date" value={draft.date} disabled={ctx.busy} data-kind-date="" onChange={(e) => set({ date: e.target.value })} />
          </label>
          <label className="wk-field">
            <span>{t('areasKind.term.time')}</span>
            <input type="time" value={draft.time} disabled={ctx.busy} onChange={(e) => set({ time: e.target.value })} />
          </label>
        </div>
        <div className="wk-kind-row">
          <label className="wk-field">
            <span>{t('areasKind.term.end')}</span>
            <input type="date" value={draft.endDate} min={draft.date === '' ? undefined : draft.date} disabled={ctx.busy} onChange={(e) => set({ endDate: e.target.value })} />
          </label>
          <label className="wk-field">
            <span>{t('areasKind.term.endTime')}</span>
            <input type="time" value={draft.endTime} disabled={ctx.busy || draft.time === ''} onChange={(e) => set({ endTime: e.target.value })} />
          </label>
        </div>
        <label className="wk-field">
          <span>{t('areasKind.term.place')}</span>
          <input value={draft.place} maxLength={200} disabled={ctx.busy} placeholder={t('areasKind.term.placePlaceholder')} onChange={(e) => set({ place: e.target.value })} />
        </label>
        <WherePick ctx={ctx} label={t('areasKind.term.where')} value={draft.where} onPick={(where) => set({ where })} />
        <div className="wk-actions">
          <button type="submit" className="wk-btn wk-btn-small" disabled={ctx.busy || draft.date === ''} data-kind-term="">{has ? t('areasKind.term.save') : t('areasKind.check.addTerm')}</button>
          {has && <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={() => ctx.setOpen(null)}>{t('common.cancel')}</button>}
        </div>
      </form>
      )}
    </Tool>
  );
}

/** Ein Termin, der Haupttermin werden kann: einzeln, kein Punkt eines anderen, von mir änderbar. */
interface TermChoice {
  readonly item: OpenedItem;
  /** Steht er schon im Kalender dieses Bereichs — sonst zieht er beim Wählen um. */
  readonly here: boolean;
}

/**
 * EINEN VORHANDENEN TERMIN WÄHLEN. Haupttermin kann nur ein Termin im Kalender
 * des Bereichs sein (der Dienst prüft es); einer aus einem anderen Kalender zieht
 * dafür um — wer ihn sieht, bleibt gleich, seine Punkte gehen über ihren Termin mit.
 */
function PickTerm({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  const [choices, setChoices] = useState<readonly TermChoice[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  const [find, setFind] = useState('');

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const ring = (await keysFor(ctx.who)).ring;
        if (ring === null) throw new WorkspaceError(t('areasKind.pick.keysClosed'));
        const now = Date.now();
        /* Der Dienst gibt höchstens 400 Tage: einen Monat zurück, knapp ein Jahr voraus. */
        const { occurrences } = await loadAgenda(new Date(now - 30 * 86_400_000), new Date(now + 365 * 86_400_000));
        const seen = new Set<string>();
        const single = occurrences.filter((o) => {
          if (seen.has(o.itemId) || o.itemId === ctx.profile.itemId) return false;
          seen.add(o.itemId);
          return o.kind === 'appointment' && o.series.repeatKind === 'none' && (o.parentItemId ?? null) === null;
        });
        const opened = (await openAgenda(ring, single, ctx.areas)).filter((o) => o.editable);
        const list = opened
          .map((item) => ({ item, here: item.occurrence.areaId === ctx.area.areaId }))
          .sort((a, b) => Number(b.here) - Number(a.here) || Date.parse(a.item.occurrence.startsAt) - Date.parse(b.item.occurrence.startsAt));
        if (live) setChoices(list);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => { live = false; };
  }, [ctx.who, ctx.areas, ctx.area.areaId, ctx.profile.itemId]);

  if (failed) return <p className="wk-kind-small">{t('areasKind.pick.failed')}</p>;
  if (choices === null) return <Loading lines={2} />;
  const own = choices.filter((c) => c.here);
  if (choices.length === 0) {
    return <p className="wk-kind-small">{t('areasKind.pick.none')}</p>;
  }
  const words = find.trim().toLocaleLowerCase(t.locale).split(/\s+/).filter(Boolean);
  const shown = (all ? choices : own).filter((c) => {
    const text = `${c.item.title} ${c.item.location ?? ''} ${nameOf(ctx, c.item.occurrence.areaId)}`.toLocaleLowerCase(t.locale);
    return words.every((w) => text.includes(w));
  });

  const pick = async (choice: TermChoice) => {
    const o = choice.item.occurrence;
    if (!choice.here) {
      const yes = await ask({
        title: t('areasKind.pick.moveAsk'),
        body: t('areasKind.pick.moveBody', { title: choice.item.title, from: nameOf(ctx, o.areaId), to: ctx.area.name }),
        confirm: t('areasKind.pick.moveAndPick')
      });
      if (!yes) return;
    }
    void ctx.run(t('areasKind.pick.setting'), t('areasKind.pick.set'), async (held) => {
      if (!choice.here) {
        held.step(t('areasKind.pick.moving'));
        const calendar = await createCalendar({ areaId: ctx.area.areaId, title: ctx.area.name, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        /* Das Schema gehört dem alten Kalender — im neuen gilt das universelle (der Dienst setzt es so). */
        await saveEvent(held.ring, { ...draftOf(choice.item), calendarId: calendar.calendarId, schemeId: undefined, values: undefined }, o.itemId);
      }
      await saveProfile(ctx.area.areaId, { itemId: o.itemId });
      ctx.setOpen(null);
    });
  };

  return (
    <>
      {(all ? choices : own).length > 8 && (
        <label className="wk-field">
          <span>{t('common.search')}</span>
          <input value={find} placeholder={t('areasKind.pick.findPlaceholder')} onChange={(e) => setFind(e.target.value)} />
        </label>
      )}
      {!all && own.length === 0 && <p className="wk-kind-small">{t('areasKind.pick.noneHere')}</p>}
      {all && shown.length === 0 && <p className="wk-kind-small">{t('areasKind.pick.noMatch')}</p>}
      <ul className="wk-kind-roles" data-kind-term-pick="">
        {shown.map((c) => {
          const o = c.item.occurrence;
          const when = whenText({ id: o.itemId, startsAt: o.startsAt, endsAt: o.endsAt, allDay: o.allDay, status: null, fields: [] });
          return (
            <li key={o.itemId}>
              <span className="wk-kind-role-name">
                <b>{c.item.title}</b> · {when}{c.item.location ? ` · ${c.item.location}` : ''}
                {!c.here && <span className="wk-kind-small"> · {t('areasKind.pick.calendar', { name: nameOf(ctx, o.areaId) })}</span>}
              </span>
              <div className="wk-actions">
                <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} onClick={() => void pick(c)}>
                  {c.here ? t('common.select') : t('areasKind.pick.moveAndPick')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {own.length < choices.length && (
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" onClick={() => setAll(!all)}>
            {all ? t('areasKind.pick.onlyHere') : t('areasKind.pick.others', { count: choices.length - own.length })}
          </button>
        </div>
      )}
    </>
  );
}

/* -- Rozmowy, „Napisz do nas" -- */

function AskTool({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  const has = (ctx.world.page?.parts ?? []).some((p) => p.kind === 'seat-ask');
  return (
    <Tool id="ask" name={t('areasKind.ask.title')} ok={has ? true : null}
      says={has ? t('areasKind.ask.has') : t('areasKind.ask.says')}>
      <div className="wk-actions">
        {ctx.main === null ? (<span className="wk-kind-small">{t('areasKind.mainFirst')}</span>)
          : has ? <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('pages', ...pageSteps(ctx.main))}>{t('areasKind.main.edit')}</a>
          : (
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
              onClick={() => void ctx.run(t('areasKind.ask.stage'), t('areasKind.ask.placed'), (held) => makeAsk(ctx, held))}>
              {t('areasKind.ask.add')}
            </button>
          )}
      </div>
    </Tool>
  );
}

export function ChatTool({ ctx, kind }: { ctx: Ctx; kind: 'area' | 'channel' }) {
  const { t } = ctx;
  const chat = ctx.world.chats.find((c) => c.kind === kind) ?? null;
  const channel = kind === 'channel';
  const name = channel ? t('areasJson.import.channel') : ctx.profile.kind === 'group' ? t('areasKind.chat.group') : ctx.profile.kind === 'class' ? t('areasKind.chat.class') : t('areasKind.chat.participants');
  const form = ctx.signup;
  const joined = chat !== null && form !== null && (chat.formIds ?? []).includes(form.moduleId);
  return (
    <Tool id={channel ? 'channel' : 'chat'} name={name} ok={chat !== null ? true : channel ? null : false}
      says={channel ? t('areasKind.chat.channelSays') : t('areasKind.chat.chatSays')}>
      <div className="wk-actions">
        {chat === null ? (
          <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
            onClick={() => void ctx.run(channel ? t('areas.page.creatingChannel') : t('areas.page.creatingChat'), channel ? t('areasKind.chat.channelReady') : t('areasKind.chat.chatReady'),
              (held) => makeChat(ctx, held, channel))}>
            {t('areas.newArea.create')}
          </button>
        ) : (
          <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('chat', chat.chatId)}>{t('common.open')}</a>
        )}
        {chat !== null && form !== null && !joined && (
          <button type="button" className="wk-link-btn" disabled={ctx.busy}
            onClick={() => void ctx.run(t('areasKind.chat.joining'), t('areasKind.chat.joined'), async (held) => {
              await linkAudienceForm('chat', chat.chatId, form.moduleId, true, await myWriter(held.ring, ctx.area.areaId));
            })}>
            {t('areasKind.chat.join')}
          </button>
        )}
      </div>
    </Tool>
  );
}

/* -- Role -- */

export function RolesTool({ ctx, defs }: { ctx: Ctx; defs: readonly RoleDef[] }) {
  const { t } = ctx;
  const found = defs.map((def) => ({ def, role: roleFor(ctx.world.roles, def) }));
  const others = ctx.world.roles.filter((r) => !found.some((f) => f.role?.roleId === r.roleId)).length;
  const all = found.every((f) => f.role !== null);
  return (
    <Tool id="roles" name={t('areasKind.roles.title')} ok={all ? true : found.some((f) => f.role !== null) ? null : false}
      says={t('areasKind.roles.says')}>
      <ul className="wk-kind-roles">
        {found.map(({ def, role }) => (
          <li key={def.key} data-role={def.key}>
            <span className="wk-kind-role-name"><strong>{def.label}</strong> <span className="wk-card-muted">— {def.says}</span></span>
            <span className="wk-actions">
              {role === null ? (
                <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
                  onClick={() => void ctx.run(t('areasKind.check.makingRole'), t('areasKind.roles.ready', { name: def.label }), (held) => makeRole(ctx, held, def))}>
                  {t('common.create')}
                </button>
              ) : role.mine ? (
                <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
                  onClick={() => void ctx.run(t('areasKind.roles.makingLink'), t('areasKind.roles.linkReady'), (held) => makeLink(ctx, held, def, role))}>
                  {def.link}
                </button>
              ) : <span className="wk-tag">{t('areasKind.roles.exists')}</span>}
            </span>
            {ctx.links[def.key] !== undefined && <LinkShare url={ctx.links[def.key]} />}
          </li>
        ))}
      </ul>
      <p className="wk-kind-small">
        {others > 0 && <>{t('areasKind.roles.others', { count: others })} </>}
        {rich(t('areasKind.roles.linksLater'), { a: (s) => <a className="wk-link" href={viewPath('areas', ctx.area.areaId, 'dostep')}>{s}</a> })}
      </p>
    </Tool>
  );
}

/* -- Po wydarzeniu, koniec -- */

function AfterTool({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  const [picked, setPicked] = useState('');
  const after = ctx.profile.after?.path ?? null;
  const unlink = async () => {
    const yes = await ask({
      title: t('areasKind.after.unlinkAsk'),
      body: t('areasKind.after.unlinkBody'),
      confirm: t('areas.audience.detach')
    });
    if (yes) void ctx.run(t('areasKind.after.unlinking'), t('areasKind.after.unlinked'), async () => { await saveProfile(ctx.area.areaId, { afterPath: '' }); });
  };
  return (
    <Tool id="after" name={t('areasKind.after.title')} ok={after !== null ? true : null}
      says={t('areasKind.after.says')}>
      {after !== null ? (
        <div className="wk-actions">
          <a className="wk-link" href={pagePath(after)}>{`recreatio.pl/${after}`}</a>
          <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('pages', ...pageSteps(after))}>{t('areasKind.main.edit')}</a>
          <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={() => void unlink()}>{t('areas.audience.detach')}</button>
        </div>
      ) : (
        <>
          <div className="wk-actions">
            {ctx.main === null ? <span className="wk-kind-small">{t('areasKind.mainFirst')}</span> : (
              <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} data-kind-after=""
                onClick={() => void ctx.run(t('areasKind.main.creating'), t('areasKind.after.ready'), (held) => makeAfterPage(ctx, held))}>
                {t('areasKind.after.make', { path: `${ctx.main}/po-wydarzeniu` })}
              </button>
            )}
          </div>
          <div className="wk-field">
            <span>{t('areasKind.main.existing')}</span>
            <PickPage value={picked} busy={ctx.busy} onPick={setPicked} />
          </div>
          {picked !== '' && picked !== ctx.main && (
            <div className="wk-actions">
              <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
                onClick={() => void ctx.run(t('common.saving'), t('areasKind.after.set'), async () => { await saveProfile(ctx.area.areaId, { afterPath: picked }); })}>
                {t('areasKind.after.setAs')}
              </button>
            </div>
          )}
        </>
      )}
    </Tool>
  );
}

const dateText = (iso: string, t: T): string => new Date(iso).toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric' });

function ArchiveTool({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  const p = ctx.profile;
  const archived = p.archivedAt !== null;
  const says = archived ? t('areasKind.archive.ended', { date: dateText(p.archivedAt!, t) })
    : p.archiveMode === 'manual' ? t('areasKind.archive.manual')
    : p.itemId === null ? t('areasKind.archive.autoNoTerm')
    : t('areasKind.archive.auto');

  const end = async () => {
    const yes = await ask({
      title: t('areasKind.archive.endAsk'),
      body: t('areasKind.archive.endBody'),
      confirm: t('areasKind.archive.end')
    });
    if (yes) void ctx.run(t('areasKind.archive.ending'), t('areasKind.archive.endedToast'), async () => { await setArchived(ctx.area.areaId, true); });
  };
  const restore = async () => {
    const yes = await ask({
      title: t('areasKind.archive.restoreAsk'),
      body: t('areasKind.archive.restoreBody'),
      confirm: t('areasKind.archive.restore')
    });
    if (yes) void ctx.run(t('areasKind.archive.restoring'), t('areasKind.archive.restored'), async () => { await setArchived(ctx.area.areaId, false); });
  };

  return (
    <Tool id="archive" name={t('areasKind.archive.title')} ok={archived ? true : null} says={says}>
      {!archived && (
        <Segment
          now={p.archiveMode}
          options={[{ value: 'auto', label: t('areasKind.archive.optAuto') }, { value: 'manual', label: t('areasKind.archive.optManual') }]}
          busy={ctx.busy}
          onPick={(mode) => void ctx.run(t('common.saving'), mode === 'auto' ? t('areasKind.archive.willAuto') : t('areasKind.archive.willManual'),
            async () => { await saveProfile(ctx.area.areaId, { archiveMode: mode }); })}
        />
      )}
      <div className="wk-actions">
        {archived
          ? <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} onClick={() => void restore()}>{t('areasKind.archive.restore')}</button>
          : <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} data-kind-end="" onClick={() => void end()}>{t('areasKind.archive.endNow')}</button>}
      </div>
    </Tool>
  );
}

/* -- Parafia: Listen -- */

const LISTS: readonly { readonly type: 'event' | 'group'; readonly label: string }[] = [
  { type: 'event', label: 'areasKind.lists.event' },
  { type: 'group', label: 'areasKind.lists.group' }
];

function ListsTool({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  const parts = ctx.world.page?.parts ?? [];
  const has = (type: 'event' | 'group') => parts.some((p) => p.kind === 'events' && ((readConfig(p.config).type ?? '') || 'event') === type);
  return (
    <Tool id="lists" name={t('areasKind.lists.title')} ok={ctx.main === null ? false : LISTS.every((one) => has(one.type)) ? true : null}
      says={t('areasKind.lists.says')}>
      <div className="wk-actions">
        {ctx.main === null ? <span className="wk-kind-small">{t('areasKind.mainFirst')}</span> : LISTS.map((one) => has(one.type) ? (
          <span key={one.type} className="wk-tag wk-tag-open">{t(one.label)} ✓</span>
        ) : (
          <button key={one.type} type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
            onClick={() => void ctx.run(t('areasKind.lists.adding'), t('areasKind.lists.added', { name: t(one.label) }), () => placeList(ctx, one.type))}>
            {t('areasKind.lists.add', { name: t(one.label) })}
          </button>
        ))}
      </div>
    </Tool>
  );
}

/* == Handgriffe ================================================================== */

async function makeMainPage(ctx: Ctx, held: Held, path: string): Promise<string | void> {
  const parts: NewPart[] = [];
  if (ctx.profile.kind === 'event') parts.push(cardPart(ctx.area.areaId));
  /* 2026-10-27 — ein Kurs: seine Powtórki gleich auf der Seite — dort lernt, wer den Link bekommt (2026-11-01: aus jeder Baza eine). */
  if (ctx.profile.kind === 'course') {
    for (const base of ctx.world.bases) {
      if (base.row === null) continue;
      const revision = await firstRevision(held.ring, base.row, held);
      if (revision !== null) parts.push(revisionPart(revision, ctx.area.areaId));
    }
  }
  /* Ein Formular, das noch auf keiner Seite steht, kommt gleich mit. */
  if (ctx.signup !== null && ctx.signup.pages.length === 0) parts.push(formPart(ctx.signup.moduleId));
  held.step(ctx.t('areasKind.main.creating'));
  const made = await createSubpage({
    path, roleId: held.person.id, areaId: ctx.state.controller === null ? null : ctx.area.areaId,
    title: ctx.title, lead: (ctx.world.card?.lead ?? '').trim() || null, parts
  });
  await saveProfile(ctx.area.areaId, { path });
  ctx.setOpen(null);
  return made.note ?? undefined;
}

async function placeForm(ctx: Ctx, formId: string): Promise<void> {
  if (ctx.main === null) throw new WorkspaceError(ctx.t('areasKind.mainFirst'));
  await addToPage(ctx.main, [formPart(formId)]);
}

async function makeSignup(ctx: Ctx, held: Held): Promise<string | void> {
  const made = await createSignupForm(ctx.who, held.ring, { areaId: ctx.area.areaId, name: ctx.title, publishTo: ctx.publishTo, onStage: held.step });
  const notes: string[] = made.note === null ? [] : [made.note];
  if (ctx.main !== null) {
    held.step(ctx.t('areasKind.act.formOnMain'));
    await addToPage(ctx.main, [formPart(made.formId)]);
  }
  const participants = roleFor(ctx.world.roles, PARTICIPANTS);
  if (participants !== null) {
    await setMemberRoles(made.formId, [participants.roleId]).catch(() => { notes.push(ctx.t('areasKind.act.participantsNotLinked')); });
  }
  return notes.join(' ') || undefined;
}

async function saveTerm(ctx: Ctx, held: Held, draft: TermDraft): Promise<void> {
  const term = mainTermOf(draft);
  if (term === null) throw new WorkspaceError(ctx.t('areasKind.act.needStart'));
  const itemId = ctx.profile.itemId;
  const was = ctx.profile.item;
  const saved = await savePublishedItem(held.ring, {
    areaId: ctx.area.areaId,
    visibilityAreaId: draft.where,
    /* Wem der Termin gehört und sein Status bleiben. */
    ownerRoleId: (itemId === null ? null : was?.ownerRoleId) ?? held.person.id,
    status: itemId === null ? null : was?.status ?? null,
    /* Er bleibt im Kalender des Bereichs, auch wenn ihn ein anderer Bereich zeigt. */
    calendarId: itemId === null ? null : was?.calendarId ?? ctx.world.calendarId,
    item: { title: draft.title.trim() || ctx.title, location: draft.place, notes: draft.notes, ...term },
    ...(itemId === null ? {} : { itemId })
  });
  if (itemId === null) await saveProfile(ctx.area.areaId, { itemId: saved });
}

async function addPoint(ctx: Ctx, held: Held, point: PointDraft): Promise<void> {
  const itemId = ctx.profile.itemId;
  if (itemId === null) throw new WorkspaceError(ctx.t('areasKind.act.termFirst'));
  const term = mainTermOf({ date: point.date, time: point.time, endDate: point.date, endTime: point.endTime });
  if (term === null) throw new WorkspaceError(ctx.t('areasKind.act.needPointDay'));
  await savePublishedItem(held.ring, {
    areaId: ctx.area.areaId,
    visibilityAreaId: ctx.profile.item?.visibilityAreaId ?? ctx.publishTo,
    ownerRoleId: held.person.id,
    item: { title: point.title.trim(), location: point.place, ...term },
    parentItemId: itemId
  });
}

async function placeProgram(ctx: Ctx): Promise<void> {
  if (ctx.main === null || ctx.profile.itemId === null) throw new WorkspaceError(ctx.t('areasKind.act.mainAndTermFirst'));
  await addToPage(ctx.main, [{ kind: 'program', config: { title: ctx.t('areasKind.act.programTitle'), calendar: ctx.world.calendarId ?? '', item: ctx.profile.itemId }, box: { colSpan: 6, rowSpan: 5 } }]);
}

/**
 * „Napisz do nas": der Baustein auf der Hauptseite, sein Bereich der Antwortenden
 * IM Bereich (dessen Administrator danych gilt), die Organizatorzy darin, das
 * Formular zgłoszeń daran.
 */
async function makeAsk(ctx: Ctx, held: Held): Promise<string | void> {
  if (ctx.main === null) throw new WorkspaceError(ctx.t('areasKind.mainFirst'));
  const partId = newId();
  held.step(ctx.t('areasKind.act.askOnPage'));
  await addToPage(ctx.main, [{ id: partId, kind: 'seat-ask', config: { title: ctx.t('areasKind.act.askTitle') }, box: { colSpan: 3, rowSpan: 5 } }]);
  held.step(ctx.t('areasKind.act.whoAnswers'));
  const made = await createArea(held.ring, held.person, ctx.t('areasKind.act.organisersArea', { name: ctx.title }).slice(0, 200), ctx.area.areaId);
  await updateModule(partId, { areaId: made.areaId });
  const notes: string[] = [];
  const organisers = roleFor(ctx.world.roles, ORGANISERS);
  if (organisers !== null) {
    await joinArea(held.ring, made.areaId, { id: organisers.roleId, kind: 'group', wrapPublicKey: organisers.wrapPublicKey }, held.person.id, 'write')
      .catch(() => { notes.push(ctx.t('areasKind.act.organisersNotAdded')); });
  }
  if (ctx.signup !== null) {
    await linkAudienceForm('module', partId, ctx.signup.moduleId, true, held.person.id)
      .catch(() => { notes.push(ctx.t('areasKind.act.formNotAttached')); });
  } else {
    notes.push(ctx.t('areasKind.act.attachForm'));
  }
  return notes.join(' ') || undefined;
}

async function makeChat(ctx: Ctx, held: Held, channel: boolean): Promise<string | void> {
  const writer = await myWriter(held.ring, ctx.area.areaId);
  const chatId = await startAreaChat(ctx.area.areaId, writer, channel);
  if (ctx.signup === null) return;
  const joined = await linkAudienceForm('chat', chatId, ctx.signup.moduleId, true, writer).then(() => true, () => false);
  return joined ? undefined : ctx.t('areasKind.act.chatNotJoined');
}

async function makeRole(ctx: Ctx, held: Held, def: RoleDef): Promise<string | void> {
  const made = await createAreaRole(held.ring, held.person, { areaId: ctx.area.areaId, name: ctx.t('areasKind.act.roleName', { role: def.label, name: ctx.title }), capability: def.capability, onStage: held.step });
  /* Unter ihrem Schlüssel — dann trifft sie auch ein JSON-Import und der Export nennt sie so. */
  if (!ctx.world.roles.some((r) => r.key === def.key)) {
    await saveImportKeys(ctx.area.areaId, [{ kind: 'role', key: def.key, refId: made.roleId, refText: def.label }]).catch(() => undefined);
  }
  if (def.key !== PARTICIPANTS.key || ctx.signup === null) return;
  /* Wer sich zapisze, bekommt die Rolle der Uczestnicy. */
  const had = ctx.signup.memberRoleIds ?? (ctx.signup.memberRoleId === null ? [] : [ctx.signup.memberRoleId]);
  const linked = await setMemberRoles(ctx.signup.moduleId, [...had.filter((id) => id !== made.roleId), made.roleId]).then(() => true, () => false);
  return linked ? undefined : ctx.t('areasKind.act.roleNotLinked');
}

/**
 * 2026-10-27 — DIE POWTÓRKA EINER BAZA auf der Seite des Kurses: ihre erste Powtórka (bei einer neuen die tägliche,
 * die `createCourseBase` anlegt). Wer den Link der Uczący się öffnet, lernt dort — mit Konto als er selbst, ohne
 * Konto stellt er sich vor (`cogita/pageLearner.tsx`); seine Antworten gehen in die Przyjęcia des Kurses.
 */
async function firstRevision(ring: Ring, base: Pick<LibraryRow, 'libraryId' | 'areaId'>, held?: Held): Promise<{ libraryId: string; revisionId: string } | null> {
  held?.step(tApp('areasKind.act.baseRevision'));
  const store = storeOf(ring, base);
  await store.sync();
  const revision = store.all().find((e) => e.kind === 'revision');
  return revision === undefined ? null : { libraryId: base.libraryId, revisionId: revision.id };
}

/** 2026-11-01 — mit dem Bereich für die Antworten (`answers`): auf der Seite des Kurses — der Kurs. */
const revisionPart = (r: { libraryId: string; revisionId: string }, answers: string): NewPart =>
  ({ kind: 'cogita-revision', config: { title: '', library: r.libraryId, revision: r.revisionId, answers }, box: { colSpan: 6, rowSpan: 4 } });

/** Wohin der Link einer Rolle führt. */
function aimFor(ctx: Ctx, def: RoleDef): string {
  if (def.key === PARTICIPANTS.key && ctx.main !== null) return ctx.main;
  /*
   * 2026-10-27 — die Seite des Kurses, wenn es sie gibt (dort lernt man auch ohne Konto); sonst die Nauka (mit Konto).
   * 2026-11-01 — mit mehreren Bazy immer die Seite; ohne Seite die Nauka nur, wenn es genau eine Baza gibt.
   */
  if (def.key === LEARNERS.key && ctx.main !== null && ctx.world.bases.some((b) => b.learning.length > 0)) return ctx.main;
  const only = ctx.world.bases.length === 1 ? ctx.world.bases[0]!.row : null;
  if (def.key === LEARNERS.key && only !== null) return `workspace/learn/${only.libraryId}`;
  if (def.key === LEARNERS.key && ctx.main !== null) return ctx.main;
  return `workspace/areas/${ctx.area.areaId}`;
}

async function makeLink(ctx: Ctx, held: Held, def: RoleDef, role: RoleSeen): Promise<void> {
  const link = await createLink(held.ring, held.person, {
    label: ctx.t('areasKind.act.roleName', { role: def.label, name: ctx.title }), roles: [{ roleId: role.roleId, lead: false }], once: false,
    expiresDays: def.key === LEARNERS.key ? 365 : 90, aim: aimFor(ctx, def)
  }, held.step);
  ctx.setLink(def.key, link.url);
}

async function makeAfterPage(ctx: Ctx, held: Held): Promise<string | void> {
  if (ctx.main === null) throw new WorkspaceError(ctx.t('areasKind.mainFirst'));
  const path = `${ctx.main}/po-wydarzeniu`;
  const made = await createSubpage({
    path, roleId: held.person.id, areaId: ctx.state.controller === null ? null : ctx.area.areaId,
    title: ctx.t('areasKind.act.afterTitle', { name: ctx.title }), lead: null,
    parts: [
      { kind: 'text', config: { title: ctx.t('areasKind.act.thanksTitle'), body: ctx.t('areasKind.act.thanksBody') }, box: { colSpan: 6, rowSpan: 3 } },
      /* Nur für die Menschen des Wydarzenie — leer, bis jemand Bilder oder Materialien einträgt. */
      { kind: 'text', config: { title: ctx.t('areasKind.act.forParticipants'), body: '' }, audienceAreaId: ctx.area.areaId, box: { colSpan: 6, rowSpan: 3 } }
    ]
  });
  await saveProfile(ctx.area.areaId, { afterPath: path });
  return made.note ?? undefined;
}

async function placeList(ctx: Ctx, type: 'event' | 'group'): Promise<void> {
  if (ctx.main === null) throw new WorkspaceError(ctx.t('areasKind.mainFirst'));
  const config: Record<string, string> = type === 'event'
    ? { title: ctx.t('areasKind.lists.event'), type, areas: ctx.area.areaId, deep: 'yes', when: 'coming' }
    : { title: ctx.t('areasKind.lists.group'), type, areas: ctx.area.areaId, deep: 'yes' };
  await addToPage(ctx.main, [{ kind: 'events', config, box: { colSpan: 6, rowSpan: 3 } }]);
}

/**
 * Eine neue Baza im Bereich des Kurses (mit täglicher Powtórka und Przyjęcia) — 2026-11-01: auch neben anderen; ihre
 * Powtórka kommt gleich auf die Hauptseite, die Antworten in den Kurs.
 */
async function makeBase(ctx: Ctx, held: Held): Promise<string | void> {
  const taken = new Set(ctx.world.bases.map((b) => b.name ?? ''));
  let name = ctx.title;
  for (let n = 2; taken.has(name); n += 1) name = `${ctx.title} ${n}`;
  const libraryId = await createCourseBase(held.ring, held.person, ctx.area.areaId, name, held.step);
  if (ctx.main === null) return;
  const revision = await firstRevision(held.ring, { libraryId, areaId: ctx.area.areaId }, held);
  if (revision === null) return;
  held.step(ctx.t('areasKind.act.revisionOnMain'));
  await addToPage(ctx.main, [revisionPart(revision, ctx.area.areaId)]);
  return ctx.t('areasKind.act.revisionPlaced');
}

/** Der Name einer Rolle unter den Mitgliedern eines Bereichs — ohne ihn steht sie dort namenlos (es geht auch ohne). */
async function nameRoleIn(ring: Ring, areaId: string, roleId: string, name: string): Promise<void> {
  try {
    const by = await myWriter(ring, areaId);
    await setMemberName(areaId, await areaKeys(ring, areaId, true), roleId, name, by);
  } catch {
    // Ohne Namen — die Rolle steht trotzdem.
  }
}

/**
 * Die Uczący się lesen weitere Bereiche (die von Bazy): gibt es ihre Rolle noch nicht, entsteht sie gleich für den Kurs
 * und diese Bereiche; sonst tritt sie ihnen bei (lesen). Der neue Bund, falls einer entstand.
 */
async function letLearnersIn(ctx: Ctx, held: Held, areas: readonly string[]): Promise<Ring> {
  const course = ctx.area.areaId;
  const name = ctx.t('areasKind.act.roleName', { role: LEARNERS.label, name: ctx.title });
  const learners = roleFor(ctx.world.roles, LEARNERS);
  if (learners === null) {
    held.step(ctx.t('areasKind.act.learnersRole'));
    const made = await createCommonRole(held.ring, held.person, { name, areas: [course, ...areas].map((areaId) => ({ areaId, capability: 'read' as const })) }, held.step);
    for (const there of [course, ...areas]) await nameRoleIn(made.ring, there, made.roleId, name);
    await saveImportKeys(course, [{ kind: 'role', key: LEARNERS.key, refId: made.roleId, refText: LEARNERS.label }]).catch(() => undefined);
    return made.ring;
  }
  for (const there of areas) {
    held.step(ctx.t('areasKind.act.learnersAccess', { name: nameOf(ctx, there) }));
    const issuer = await issuerIn(held.ring, there);
    if (issuer === null) throw new WorkspaceError(ctx.t('areasKind.act.cantLetIn', { name: nameOf(ctx, there) }));
    await joinArea(held.ring, there, { id: learners.roleId, kind: 'group', wrapPublicKey: learners.wrapPublicKey }, issuer, 'read');
    await nameRoleIn(held.ring, there, learners.roleId, learners.name ?? name);
  }
  return held.ring;
}

/** Die Bereiche dieser Bazy für die Uczący się öffnen (ein Handgriff aus „Do zrobienia"). */
async function letLearnersIntoAll(ctx: Ctx, held: Held, bases: readonly CourseBase[]): Promise<void> {
  await letLearnersIn(ctx, held, [...new Set(bases.map((b) => b.row?.areaId).filter((a): a is string => a !== undefined))]);
}

/** Die Przyjęcia des Kurses — ohne sie läse niemand die Antworten, die in den Kurs gehen. */
async function ensureIntake(ctx: Ctx, held: Held, ring: Ring): Promise<void> {
  if (await loadIntake(ctx.area.areaId).then(() => true, () => false)) return;
  held.step(ctx.t('areasKind.stage.intake'));
  await createIntake(ring, ctx.area.areaId, held.person.id);
}

/**
 * 2026-10-31 „WYBIERZ ISTNIEJĄCĄ", 2026-11-01 „DODAJ ISTNIEJĄCĄ" — NOCH EINE BAZA FÜR DEN KURS, wo sie ist:
 *   1. die Rolle der Uczący się liest ihren Bereich (gibt es die Rolle noch nicht, entsteht sie für beide);
 *   2. der Kurs merkt sie sich (Art `library`, 0135) — auch ohne Baustein auf der Seite;
 *   3. auf Wunsch kommt ihre erste Powtórka auf die Hauptseite, die Antworten in den Kurs (`answers`).
 * Die Baza selbst ändert sich nicht (früher stellte der Kurs ihre Ustawienia um — dann gehörten die Antworten aller
 * Kurse dem ersten); sie kann weiter anderen Kursen und Seiten dienen.
 */
async function addBase(ctx: Ctx, held: Held, base: OpenLibrary, place: boolean): Promise<string | void> {
  const course = ctx.area.areaId;
  const notes: string[] = [];
  const reads = base.areaId === course || ctx.world.learnersIn.has(base.areaId);
  const ring = reads ? held.ring : await letLearnersIn(ctx, held, [base.areaId]);
  await saveImportKeys(course, [{ kind: 'library', key: baseKey(base.libraryId), refId: base.libraryId, refText: base.name }])
    .catch(() => notes.push(ctx.t('areasKind.act.baseNotRemembered')));
  await ensureIntake(ctx, held, ring);
  if (place && ctx.main !== null) {
    const revision = await firstRevision(ring, base, held);
    if (revision === null) notes.push(ctx.t('areasKind.act.noRevisionYet'));
    else {
      held.step(ctx.t('areasKind.act.revisionOnMain'));
      await addToPage(ctx.main, [revisionPart(revision, course)]);
      notes.push(ctx.t('areasKind.act.revisionPlacedCourse'));
    }
  }
  ctx.setOpen(null);
  return notes.join(' ') || undefined;
}

/** Die erste Powtórka einer Baza auf die Hauptseite — die Antworten in den Kurs. */
async function placeBase(ctx: Ctx, held: Held, base: LibraryRow): Promise<void> {
  if (ctx.main === null) throw new WorkspaceError(ctx.t('areasKind.mainFirst'));
  const revision = await firstRevision(held.ring, base, held);
  if (revision === null) throw new WorkspaceError(ctx.t('areasKind.act.baseNoRevision'));
  await ensureIntake(ctx, held, held.ring);
  await addToPage(ctx.main, [revisionPart(revision, ctx.area.areaId)]);
}

/** Jede Baza des Kurses ohne Lernbaustein auf der Hauptseite bekommt ihre erste Powtórka dort (die ohne Powtórka nicht). */
async function placeAll(ctx: Ctx, held: Held): Promise<string | void> {
  if (ctx.main === null) throw new WorkspaceError(ctx.t('areasKind.mainFirst'));
  const parts: NewPart[] = [];
  const without: string[] = [];
  for (const base of ctx.world.bases) {
    if (base.row === null || base.learning.length > 0) continue;
    const revision = await firstRevision(held.ring, base.row, held);
    if (revision === null) without.push(ctx.t('areasJson.quoted', { name: base.name ?? ctx.t('areasKind.base') }));
    else parts.push(revisionPart(revision, ctx.area.areaId));
  }
  if (parts.length === 0) throw new WorkspaceError(ctx.t('areasKind.act.withoutRevision', { names: without.join(', ') }));
  await ensureIntake(ctx, held, held.ring);
  await addToPage(ctx.main, parts);
  return without.length === 0 ? undefined : ctx.t('areasKind.act.notAdded', { names: without.join(', ') });
}

/** Die Bausteine der Hauptseite, wie die Regeln sie lesen (`courseBases.ts`). */
const pageParts = (ctx: Ctx) => (ctx.world.page?.parts ?? []).map((p) => ({ id: p.id, kind: p.kind, config: readConfig(p.config) }));

/** Liegt ein Bereich im Kurs (ein Bereich seiner Prowadzący darin)? Nach dem, was die Bereiche, die ich sehe, sagen. */
const insideCourse = (ctx: Ctx, areaId: string): boolean =>
  isInside(areaId, ctx.area.areaId, (id) => ctx.areas.find((a) => a.areaId.toLowerCase() === id.toLowerCase())?.parentAreaId ?? null);

/**
 * Jeder Lernbaustein der Hauptseite, dessen Antworten nicht in den Kurs gehen (`strayLearning`), schickt sie jetzt
 * dorthin (`answers`) — einer, der in einen Bereich IM Kurs schickt, bleibt; der Baustein bleibt, wo er steht.
 */
async function routeAnswers(ctx: Ctx): Promise<void> {
  if (ctx.main === null) return;
  const course = ctx.area.areaId;
  const page = await loadPage(ctx.main);
  if (page.locked === true) throw new WorkspaceError(tApp('areasKind.pageSealed'));
  const drafts = page.parts.map(toDraft);
  const stray = new Set(strayLearning(drafts.map((p) => ({ id: p.id, kind: p.kind, config: p.config as Record<string, string> })), course, (id) => insideCourse(ctx, id)).map((p) => p.id));
  await saveParts(ctx.main, drafts.map((part) => (stray.has(part.id) ? { ...part, config: { ...part.config, answers: course } } : part)));
}

/**
 * 2026-10-31, 2026-11-01 — „ODŁĄCZ": eine Baza aus einem anderen Bereich gehört nicht mehr zum Kurs. Der Kurs vergisst
 * sie, ihre Bausteine verlassen die Hauptseite, und — liegt dort keine andere Baza des Kurses mehr (`closes`) — lesen die
 * Uczący się ihren Bereich nicht mehr. Die Baza selbst bleibt, auch in anderen Kursen.
 */
async function unlinkBase(ctx: Ctx, held: Held, base: CourseBase, closes: boolean): Promise<string | void> {
  const notes: string[] = [];
  if (base.keys.length > 0) {
    await saveImportKeys(ctx.area.areaId, base.keys.map((key) => ({ kind: 'library' as const, key, remove: true }))).catch(() => undefined);
  }
  if (ctx.main !== null && base.parts.length > 0) {
    held.step(ctx.t('areasKind.act.mainPage'));
    const page = await loadPage(ctx.main);
    if (page.locked === true) throw new WorkspaceError(tApp('areasKind.pageSealed'));
    const gone = new Set(base.parts);
    await saveParts(ctx.main, page.parts.map(toDraft).filter((part) => !gone.has(part.id)));
  }
  const learners = roleFor(ctx.world.roles, LEARNERS);
  if (closes && learners !== null && base.row !== null) {
    held.step(ctx.t('areasKind.act.closingFor', { name: nameOf(ctx, base.row.areaId) }));
    const r = await dropFromArea(base.row.areaId, learners.roleId);
    if (r.note !== '') notes.push(r.note);
  }
  return notes.join(' ') || undefined;
}

/* == Ustawienia: der Rodzaj ======================================================= */

const NO_KIND = { kind: null, get label() { return tApp('areasKind.setting.plain'); }, get says() { return tApp('areasKind.setting.plainSays'); } } as const;

/**
 * „Rodzaj obszaru" in den Ustawienia. Die Art wechseln oder abnehmen lässt den
 * Bereich, wie er ist — es ändern sich Werkzeuge, Wizytówka und Listen.
 */
export function AreaKindSetting({ area, areas, state, onChanged }: {
  area: AreaRow;
  areas: readonly AreaRow[];
  state: ProfileState | null;
  onChanged: (profile?: Profile | null) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  if (state === null) return <Loading lines={1} />;
  const now = state.profile?.kind ?? null;

  const pick = async (next: ProfileKind | null) => {
    if (next === now) return;
    if (next === null) {
      const yes = await ask({
        title: t('areasKind.setting.removeAsk'),
        body: t('areasKind.setting.removeBody'),
        confirm: t('areasKind.setting.remove'),
        danger: true
      });
      if (!yes) return;
    } else if (now !== null) {
      const yes = await ask({
        title: t('areasKind.setting.changeAsk', { kind: kindLabel(next) }),
        body: t('areasKind.setting.changeBody'),
        confirm: t('common.change')
      });
      if (!yes) return;
    }
    setBusy(true);
    try {
      if (next === null) {
        await removeProfile(area.areaId);
        onChanged(null);
        toast(t('areasKind.setting.removed'), { kind: 'ok' });
      } else {
        /* Ein neues Wydarzenie veröffentlicht gleich dort, wo es naheliegt: im nächsten jawnen Bereich darüber, den ich führe. */
        const publish = now === null && next === 'event' ? defaultPublishArea(areas, area.areaId) : area.areaId;
        const out = await saveProfile(area.areaId, { kind: next, ...(publish !== area.areaId ? { publishAreaId: publish } : {}) });
        onChanged(out.profile);
        toast(t('areasKind.setting.changed', { kind: kindLabel(next) }), { kind: 'ok' });
        if (now === null) window.location.hash = viewPath('areas', area.areaId, 'profil');
      }
    } catch (e) {
      toast(failure(e, t('areasKind.setting.failed')), { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const choices: readonly { readonly kind: ProfileKind | null; readonly label: string; readonly says: string }[] = [NO_KIND, ...PROFILE_KINDS];
  return (
    <div className="wk-kind-choices" role="radiogroup" aria-label={t('areas.page.kind')}>
      {choices.map((one) => (
        <label key={one.kind ?? 'none'} className={`wk-kind-choice${now === one.kind ? ' is-on' : ''}`} data-area-kind={one.kind ?? 'none'}>
          <input type="radio" name={`area-kind-${area.areaId}`} checked={now === one.kind} disabled={!state.admin || busy} onChange={() => void pick(one.kind)} />
          <span className="wk-kind-choice-text">
            <strong>{one.label}</strong>
            <span className="wk-kind-choice-says">{one.says}</span>
          </span>
        </label>
      ))}
      {!state.admin && <p className="wk-kind-small">{t('areasKind.setting.leader')}</p>}
      {state.admin && now === null && (
        <p className="wk-kind-small">
          {t('areasKind.setting.orJson')}{' '}
          <a className="wk-link" href={viewPath('areas', area.areaId, 'profil')} data-area-json-open="">{t('areasKind.setting.importJson')}</a>
        </p>
      )}
    </div>
  );
}
