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
import { plural } from '../core/plural';
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
import { createArea, joinArea, loadMembers, type AreaRow, type Member } from './area';
import { AreaPick } from './AreaPick';
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
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'wydarzenie';

/** Die Fragen eines neuen Formulars zgłoszeń. */
export const SIGNUP_QUESTIONS = [
  { id: 'q1', kind: 'line', label: 'Imię', required: true, halfWidth: true, identity: 'given_name' },
  { id: 'q2', kind: 'line', label: 'Nazwisko', required: true, halfWidth: true, identity: 'surname' },
  { id: 'q3', kind: 'phone', label: 'Telefon', required: true, halfWidth: true, identity: 'phone' },
  { id: 'q4', kind: 'email', label: 'E-mail', required: false, halfWidth: true, identity: 'email' }
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
  if (page.locked === true) throw new WorkspaceError('Ta strona jest zapieczętowana, a ta karta nie ma jej klucza.');
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
      note = `Strona powstała, ale nie podaje jeszcze administratora danych tego obszaru: ${failure(e, 'błąd')}`;
    }
  }
  await savePage(input.path, { title: input.title.trim() || 'Strona', lead: input.lead });
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
  input.onStage('Tworzenie formularza…');
  await createModule(formId, 'form', input.name, input.areaId, 'person');
  await writeFormContent(who, { moduleId: formId, areaId: input.areaId }, { questions: SIGNUP_QUESTIONS },
    { replace: false, answersTo: input.areaId, onStage: input.onStage });
  let note: string | null = null;
  if (input.publishTo !== input.areaId) {
    input.onStage('Pytania w obszarze publikacji…');
    try {
      await moveQuestions(ring, formId, input.publishTo);
    } catch (e) {
      note = `Pytania formularza zostały w tym obszarze (${failure(e, 'nie udało się ich przenieść')}) — zmienisz to w ustawieniach formularza.`;
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
  onStage('Zakładanie bazy wiedzy…');
  const libraryId = await createLibrary(ring, areaId, name, 'knowledge');
  if (!(await loadIntake(areaId).then(() => true, () => false))) {
    onStage('Klucz przyjęć odpowiedzi (kilka sekund)…');
    await createIntake(ring, areaId, person.id);
  }
  onStage('Codzienna powtórka…');
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
  if (writer === undefined) throw new WorkspaceError('Żadna z Twoich ról nie pisze w tym obszarze.');
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
   * Bazy wiedzy des Kurses: die des Bereichs — und (2026-10-31) die eines anderen Bereichs, den seine Uczący się lesen
   * (eine bestehende, gewählt; die auf der Hauptseite zuerst).
   */
  readonly bases: readonly LibraryRow[];
  /** 2026-10-31 — bestehende Bazy anderer Bereiche (mit Namen): wählbar als Baza des Kurses. */
  readonly otherBases: readonly OpenLibrary[];
  /** Die Namen der Bazy, die geöffnet werden konnten. */
  readonly baseNames: ReadonlyMap<string, string>;
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
   * 2026-10-31 — EINE BESTEHENDE BAZA FÜR DEN KURS bleibt, wo sie ist; die Rolle der Uczący się liest ihren Bereich
   * (`pickBase`). Welche Bazy der Kurs hat, sagt also, welche Bereiche diese Rolle liest — nichts wird dafür gespeichert.
   */
  const knowledge = libraries.filter((l) => libraryKindOf(l) === 'knowledge');
  const learners = profile.kind === 'course' ? roleFor(roles, LEARNERS) : null;
  const elsewhere = [...new Set(knowledge.filter((l) => l.areaId !== areaId).map((l) => l.areaId))];
  const read = learners === null ? [] : await Promise.all(elsewhere.map((there) => quiet<string | null>(loadMembers(there)
    .then((r) => (r.members.some((m) => m.roleId.toLowerCase() === learners.roleId.toLowerCase()) ? there : null)), null)));
  const sharedAreas = new Set(read.filter((x): x is string => x !== null));
  const onPage = new Set((page?.parts ?? []).filter((p) => p.kind === 'cogita-revision').map((p) => readConfig(p.config).library));
  const shared = knowledge.filter((l) => sharedAreas.has(l.areaId)).sort((a, b) => Number(onPage.has(b.libraryId)) - Number(onPage.has(a.libraryId)));
  const others = profile.kind === 'course' ? knowledge.filter((l) => l.areaId !== areaId && !sharedAreas.has(l.areaId)) : [];
  const named = ring === null ? [] : await openLibraries(ring, [...shared, ...others]).catch(() => [] as OpenLibrary[]);

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
    bases: [...knowledge.filter((l) => l.areaId === areaId), ...shared],
    otherBases: named.filter((l) => others.some((o) => o.libraryId === l.libraryId)),
    baseNames: new Map(named.map((l) => [l.libraryId, l.name]))
  };
}

/* == Rollen der Arten ============================================================ */

export interface RoleDef {
  readonly key: string;
  readonly label: string;
  readonly capability: 'read' | 'write' | 'admin';
  readonly says: string;
  readonly link: string;
}

const ORGANISERS: RoleDef = { key: 'organisers', label: 'Organizatorzy', capability: 'admin', says: 'prowadzą wszystko', link: 'Link dla organizatorów' };
const HELPERS: RoleDef = { key: 'helpers', label: 'Pomocnicy', capability: 'write', says: 'piszą w kalendarzu i rozmowach', link: 'Link dla pomocników' };
const PARTICIPANTS: RoleDef = { key: 'participants', label: 'Uczestnicy', capability: 'read', says: 'czytają strony, kalendarz i rozmowy; dostaje ją każdy zapisany', link: 'Link dla uczestników' };
const MEMBERS: RoleDef = { key: 'members', label: 'Członkowie', capability: 'write', says: 'piszą w rozmowie i kalendarzu grupy', link: 'Link dla członków' };
const LEADERS: RoleDef = { key: 'leaders', label: 'Prowadzący', capability: 'admin', says: 'prowadzą grupę', link: 'Link dla prowadzących' };
const LEARNERS: RoleDef = { key: 'learners', label: 'Uczący się', capability: 'read', says: 'uczą się z bazy, a Ty widzisz ich postępy', link: 'Link dla uczących się' };

/** Die Rolle einer Art — unter ihrem Schlüssel (auch aus einem JSON-Import), sonst an ihrem Namen („Uczestnicy: Rekolekcje 2027"). */
export const roleFor = (roles: readonly RoleSeen[], def: RoleDef): RoleSeen | null =>
  roles.find((r) => r.key === def.key)
  ?? roles.find((r) => r.name !== null && (r.name === def.label || r.name.startsWith(`${def.label}:`))) ?? null;

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
}

export const nameOf = (ctx: Ctx, areaId: string): string =>
  areaId === ctx.area.areaId ? ctx.area.name : ctx.areas.find((a) => a.areaId === areaId)?.name ?? 'inny obszar';

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
      if (keys.ring === null || person === null) throw new WorkspaceError('Najpierw podaj hasło — klucze nie są otwarte w tej karcie.');
      const said = await act({ ring: keys.ring, person, step: setBusy });
      toast(done, { kind: 'ok' });
      if (typeof said === 'string' && said !== '') setNote(said);
    } catch (e) {
      toast(failure(e, 'Nie udało się — część mogła już powstać.'), { kind: 'error' });
    } finally {
      /* Auch nach einem Fehler: ein Teil kann schon stehen. */
      forgetKeys();
      invalidate();
      refreshDesk();
      setBusy(null);
      onChanged();
    }
  }, [who, onChanged]);

  if (world === null) return failed ? <p className="wk-error">Nie udało się wczytać tego obszaru.</p> : <Loading lines={3} />;

  const main = profile.main?.path ?? null;
  const signup = (main === null ? undefined : world.forms.find((f) => f.extendsId === null && f.pages.includes(main)))
    ?? world.forms.find((f) => f.extendsId === null) ?? null;

  const ctx: Ctx = {
    who, area, areas, state, profile, world, busy: busy !== null, run,
    title: (world.card?.title ?? '').trim() || area.name,
    publishTo: profile.publishAreaId ?? area.areaId,
    main, signup, open, setOpen, links,
    setLink: (key, url) => setLinks((was) => ({ ...was, [key]: url }))
  };

  const daily = profile.kind === 'school' || profile.kind === 'class';
  const tools = (
    <section className="wk-kind-sec" aria-labelledby="kind-tools-h">
      <h2 className="wk-h2" id="kind-tools-h">{TOOLS_TITLE[profile.kind]}</h2>
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
          {ring === null && <p className="wk-warn">Klucze nie są otwarte w tej karcie — podaj hasło, żeby coś tu zmienić.</p>}
          {busy !== null && <p className="wk-working" role="status">{busy}</p>}
          {note !== null && (
            <p className="wk-note" role="status">
              {note} <button type="button" className="wk-link-btn" onClick={() => setNote(null)}>Zamknij</button>
            </p>
          )}

          <Readiness ctx={ctx} />

          {/* 0134 — in einer Szkoła und einer Klasa zuerst die Arbeit (Programme, Dziennik); eine Klasa veröffentlicht nichts. */}
          {daily && tools}

          <section className="wk-kind-sec" aria-labelledby="kind-card-h">
            <h2 className="wk-h2" id="kind-card-h">Wizytówka</h2>
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
        <p className="wk-note">Wizytówkę i narzędzia zmienia ten, kto prowadzi obszar.</p>
      )}

      {/* Importieren legt an und ändert — das tut, wer den Bereich führt. */}
      {state.admin && withJson && (
        <section className="wk-kind-sec" aria-labelledby="kind-json-h">
          <h2 className="wk-h2" id="kind-json-h">Import i eksport (JSON dla AI)</h2>
          <AreaJsonPanel area={area} ring={ring} who={who} onImported={onChanged} />
        </section>
      )}
    </div>
  );
}

const TOOLS_TITLE: Record<ProfileKind, string> = {
  event: 'Wydarzenie krok po kroku',
  group: 'Grupa',
  organisation: 'Parafia / organizacja',
  course: 'Kurs',
  school: 'Szkoła: klasy i programy',
  class: 'Klasa: dziennik, uczniowie, plan lekcji'
};

/* == Für jeden Leser: die Karte ================================================== */

function Summary({ ctx }: { ctx: Ctx }) {
  const { profile, world, area, state } = ctx;
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
          {profile.archivedAt !== null ? <span className="wk-tag">zakończone</span> : profile.ended ? <span className="wk-tag">po terminie</span> : null}
          {state.openForms.length > 0 && <span className="wk-tag wk-tag-open">Zapisy otwarte</span>}
        </p>
        <h2 className="wk-kind-title" id="kind-title">{(card?.title ?? '').trim() || area.name}</h2>
        {card !== null && card.lead.trim() !== '' && <p className="wk-kind-lead">{card.lead}</p>}
        {profile.card !== null && card === null && (
          <p className="wk-card-muted">Wizytówki nie da się tu odczytać — brak klucza obszaru, w którym jest widoczna.</p>
        )}
        {(when !== null || place !== null) && <p className="wk-kind-when">{[when, place].filter((x) => x !== null).join(' · ')}</p>}
        {(ctx.main !== null || after !== null || talk !== null || channel !== null) && (
          <p className="wk-kind-links">
            {ctx.main !== null && <a className="wk-link" href={pagePath(ctx.main)}>Strona główna</a>}
            {after !== null && <a className="wk-link" href={pagePath(after)}>Po wydarzeniu{profile.ended ? '' : ' (ukryta do końca)'}</a>}
            {talk !== null && <a className="wk-link" href={viewPath('chat', talk.chatId)}>Rozmowa</a>}
            {channel !== null && <a className="wk-link" href={viewPath('chat', channel.chatId)}>Kanał</a>}
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
  const { state, profile, world, area } = ctx;
  const c = state.controller;
  const settings = viewPath('areas', area.areaId, 'ustawienia');
  const out: Check[] = [];

  out.push({
    key: 'controller', ok: c !== null,
    text: c !== null ? <>Administrator danych: {c.name}</>
      : profile.kind === 'group' ? 'Brak administratora danych — rozmowa grupy nie powstanie.'
      /* 2026-10-27 — eine öffentliche Seite braucht ihn (0129): ohne ihn keine Seite des Kurses, auf die der Link führt. */
      : profile.kind === 'course' ? 'Brak administratora danych — strona kursu z powtórką dla uczących się nie powstanie.'
      : 'Brak administratora danych — formularze nic nie przyjmą, a rozmowy nie powstaną.',
    fix: <a className="wk-btn wk-btn-line wk-btn-small" href={settings}>Wskaż go</a>
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
          ? 'Strona główna podaje administratora danych tego obszaru.'
          : 'Strona główna podaje innego administratora danych niż ten obszar.',
        fix: <Fix ctx={ctx} label="Przypisz stronę do obszaru" what="Przypisywanie strony…" done="Strona podaje administratora danych tego obszaru."
          act={async () => { await setPageController(main, area.areaId); }} />
      });
    }
    out.push(termCheck(ctx));
    const vis = profile.item?.visibilityAreaId ?? null;
    if (profile.itemId !== null && vis !== null && !isPublic(ctx, vis)) {
      out.push({
        key: 'term-public', ok: false,
        text: `Termin widzą tylko członkowie „${nameOf(ctx, vis)}” — na kartach nie będzie daty.`,
        fix: <Go ctx={ctx} label="Zmień, gdzie widać" to="term" />
      });
    }
    out.push(signupCheck(ctx));
    out.push({
      key: 'public-card', ok: world.publicCard !== null,
      text: world.publicCard !== null ? 'Karta jest widoczna publicznie — na listach „Wydarzenia”.'
        : 'Karta jeszcze się nie pokazuje: strona główna musi być publiczna, a wizytówka w jawnym obszarze.'
    });
  }

  if (profile.kind === 'group') {
    const talk = world.chats.find((x) => x.kind === 'area') ?? null;
    out.push({
      key: 'chat', ok: talk !== null,
      text: talk !== null ? 'Rozmowa grupy jest.' : 'Grupa nie ma jeszcze rozmowy.',
      fix: <Fix ctx={ctx} label="Załóż rozmowę" what="Zakładanie rozmowy…" done="Rozmowa grupy jest gotowa." act={(held) => makeChat(ctx, held, false)} />
    });
    const members = roleFor(world.roles, MEMBERS);
    out.push({
      key: 'members', ok: members !== null,
      text: members !== null ? 'Rola członków jest — link dla członków utworzysz niżej.' : 'Brak roli członków — bez niej nie ma linku dla członków.',
      fix: <Fix ctx={ctx} label="Utwórz rolę członków" what="Tworzenie roli…" done="Rola członków jest gotowa." act={(held) => makeRole(ctx, held, MEMBERS)} />
    });
  }

  if (profile.kind === 'organisation') {
    out.push(mainCheck(ctx));
    out.push({
      key: 'public', ok: state.public,
      text: state.public ? 'Obszar jest jawny — jego strona i listy są dla wszystkich.' : 'Obszar nie jest jawny — jego listy i wizytówkę zobaczą tylko członkowie.',
      fix: <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('areas', area.areaId, 'dostep')}>Dostęp → Dla wszystkich</a>
    });
    if (ctx.main !== null) {
      const has = (world.page?.parts ?? []).some((p) => p.kind === 'events');
      out.push({
        key: 'lists', ok: has,
        text: has ? 'Strona główna ma listę wydarzeń lub grup.' : 'Na stronie głównej nie ma jeszcze list wydarzeń ani grup.',
        fix: <Go ctx={ctx} label="Dodaj listy" to="lists" />
      });
    }
  }

  if (profile.kind === 'course') {
    const base = world.bases[0] ?? null;
    out.push({
      key: 'base', ok: base !== null,
      text: base !== null ? 'Baza wiedzy z codzienną powtórką jest.' : 'Kurs nie ma jeszcze bazy wiedzy.',
      fix: (
        <>
          <Fix ctx={ctx} label="Utwórz bazę" what="Zakładanie bazy…" done="Baza wiedzy jest gotowa." act={(held) => makeBase(ctx, held)} />
          {world.otherBases.length > 0 && <Go ctx={ctx} label="Wybierz istniejącą" to="base" />}
        </>
      )
    });
    const learners = roleFor(world.roles, LEARNERS);
    out.push({
      key: 'learners', ok: learners !== null,
      text: learners !== null ? 'Rola uczących się jest — link utworzysz niżej.' : 'Brak roli uczących się.',
      fix: <Fix ctx={ctx} label="Utwórz rolę" what="Tworzenie roli…" done="Rola uczących się jest gotowa." act={(held) => makeRole(ctx, held, LEARNERS)} />
    });
  }

  return out;
}

function cardCheck(ctx: Ctx): Check {
  const { profile, world } = ctx;
  if (profile.card !== null && world.card === null) {
    return { key: 'card', ok: null, text: 'Wizytówka jest, ale nie da się jej tu odczytać.' };
  }
  const ok = world.card !== null && world.card.title.trim() !== '';
  return {
    key: 'card', ok,
    text: ok ? <>Wizytówka: {world.card?.title}{isPublic(ctx, profile.card?.areaId ?? ctx.area.areaId) ? '' : ' (widzą ją tylko członkowie)'}</>
      : 'Brak wizytówki — tytułu i opisu na kartach i listach.',
    fix: <Go ctx={ctx} label="Uzupełnij" to="card" />
  };
}

function publishCheck(ctx: Ctx): Check {
  const name = nameOf(ctx, ctx.publishTo);
  const suggested = defaultPublishArea(ctx.areas, ctx.area.areaId);
  const better = suggested !== ctx.publishTo && isPublic(ctx, suggested) ? suggested : null;
  return {
    key: 'publish', ok: ctx.state.publishPublic,
    text: ctx.state.publishPublic ? `Publikujesz w jawnym obszarze „${name}”.`
      : `„${name}” nie jest jawny — kartę, termin i pytania zobaczą tylko jego członkowie.`,
    fix: better !== null
      ? <Fix ctx={ctx} label={`Publikuj w „${nameOf(ctx, better)}”`} what="Zapisywanie…" done={`Nowe rzeczy pokażesz w „${nameOf(ctx, better)}”.`}
        act={async () => { await saveProfile(ctx.area.areaId, { publishAreaId: better }); }} />
      : <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('areas', ctx.publishTo, 'dostep')}>Otwórz go dla wszystkich</a>
  };
}

function mainCheck(ctx: Ctx): Check {
  return {
    key: 'main', ok: ctx.main !== null,
    text: ctx.main !== null ? <>Strona główna: <a className="wk-link" href={pagePath(ctx.main)}>recreatio.pl/{ctx.main}</a></> : 'Brak strony głównej.',
    fix: <Go ctx={ctx} label="Utwórz stronę" to="main" />
  };
}

function termCheck(ctx: Ctx): Check {
  const item = ctx.profile.item;
  const when = item === null || item.startsAt === null ? null
    : whenText({ id: ctx.profile.itemId ?? '', startsAt: item.startsAt, endsAt: item.endsAt, allDay: item.allDay, status: null, fields: [] });
  return {
    key: 'term', ok: ctx.profile.itemId !== null,
    text: ctx.profile.itemId !== null ? `Główny termin: ${when ?? 'ustawiony'}` : 'Brak głównego terminu — od niego zależy data na kartach i koniec wydarzenia.',
    fix: <Go ctx={ctx} label="Dodaj termin" to="term" />
  };
}

function signupCheck(ctx: Ctx): Check {
  const { state, profile } = ctx;
  const form = ctx.signup;
  if (state.openForms.length > 0) return { key: 'signup', ok: true, text: 'Zapisy otwarte — formularz przyjmuje zgłoszenia.' };
  if (profile.archivedAt !== null) return { key: 'signup', ok: null, text: 'Zapisy zamknięte — wydarzenie się skończyło.' };
  if (form === null) {
    return {
      key: 'signup', ok: false, text: 'Brak formularza zgłoszeń.',
      fix: <Fix ctx={ctx} label="Utwórz formularz" what="Tworzenie formularza…" done="Formularz zgłoszeń jest gotowy." act={(held) => makeSignup(ctx, held)} />
    };
  }
  if (form.closed) {
    return { key: 'signup', ok: false, text: 'Formularz zgłoszeń jest zamknięty.', fix: <a className="wk-btn wk-btn-line wk-btn-small" href={formPath(form.moduleId)}>Otwórz formularz</a> };
  }
  if (ctx.main !== null && !form.pages.includes(ctx.main)) {
    return {
      key: 'signup', ok: false, text: 'Formularz nie stoi na stronie głównej.',
      fix: <Fix ctx={ctx} label="Postaw na stronie" what="Formularz na stronie…" done="Formularz stoi na stronie głównej." act={() => placeForm(ctx, form.moduleId)} />
    };
  }
  const at = questionsAreaOf(form) ?? ctx.area.areaId;
  if (!isPublic(ctx, at)) {
    const target = isPublic(ctx, ctx.publishTo) && ctx.publishTo !== at ? ctx.publishTo : null;
    return {
      key: 'signup', ok: false, text: `Pytania formularza leżą w „${nameOf(ctx, at)}”, którego nie czyta każdy.`,
      fix: target === null ? undefined
        : <Fix ctx={ctx} label={`Pytania do „${nameOf(ctx, target)}”`} what="Przenoszenie pytań…" done="Pytania są widoczne w obszarze publikacji."
          act={async (held) => { await moveQuestions(held.ring, form.moduleId, target === form.areaId ? null : target); }} />
    };
  }
  return { key: 'signup', ok: false, text: 'Zapisy jeszcze nie przyjmują — strona główna musi być publiczna, a obszar mieć administratora danych.' };
}

function Readiness({ ctx }: { ctx: Ctx }) {
  const checks = checksOf(ctx);
  const missing = checks.filter((c) => c.ok === false).length;
  return (
    <section className="wk-kind-sec" aria-labelledby="kind-ready-h">
      <h2 className="wk-h2" id="kind-ready-h">{missing === 0 ? 'Wszystko gotowe' : `Do zrobienia: ${missing}`}</h2>
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

const CATEGORIES = ['rekolekcje', 'pielgrzymka', 'wyjazd', 'obóz', 'warsztaty', 'koncert', 'spotkanie', 'kurs', 'schola', 'oaza'];

/** Ein Bereich zur Wahl: der eigene und die, die ich führe — mit „każdy" / „tylko członkowie". */
export function WherePick({ ctx, label, value, onPick }: { ctx: Ctx; label: string; value: string; onPick: (areaId: string) => void }) {
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
        note={(areaId) => (isPublic(ctx, areaId) ? 'widzi każdy' : 'tylko członkowie')}
      />
    </div>
  );
}

function ImagePick({ images, value, busy, hasPage, onPick }: {
  images: readonly PageImageRow[]; value: string; busy: boolean; hasPage: boolean; onPick: (id: string) => void;
}) {
  if (images.length === 0 && value === '') {
    return (
      <p className="wk-kind-small">
        {hasPage ? 'Zdjęcie wybierzesz z plików strony głównej — dodaj je w edytorze strony.' : 'Zdjęcie wybierzesz z plików strony głównej, gdy ją utworzysz.'}
      </p>
    );
  }
  const shown: readonly { id: string; name: string | null }[] = value !== '' && !images.some((one) => one.id === value)
    ? [{ id: value, name: 'obecne zdjęcie' }, ...images] : images;
  return (
    <div className="wk-field">
      <span>Zdjęcie</span>
      <div className="wk-kind-images" role="radiogroup" aria-label="Zdjęcie">
        <label className={`wk-kind-pick${value === '' ? ' is-on' : ''}`}>
          <input type="radio" name="kind-image" checked={value === ''} disabled={busy} onChange={() => onPick('')} />
          <span className="wk-kind-pick-none">bez zdjęcia</span>
        </label>
        {shown.map((one) => (
          <label key={one.id} className={`wk-kind-pick${value === one.id ? ' is-on' : ''}`}>
            <input type="radio" name="kind-image" checked={value === one.id} disabled={busy} onChange={() => onPick(one.id)} />
            <FadeImg src={eventImageUrl(one.id)} alt={one.name ?? 'zdjęcie'} loading="lazy" decoding="async" />
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
    return `Wizytówka zapisana, ale tytułu strony głównej nie udało się zmienić: ${failure(e, 'błąd')}`;
  }
}

function CardEditor({ ctx }: { ctx: Ctx }) {
  const { profile, world, area } = ctx;
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

  const save = () => ctx.run('Zapisywanie wizytówki…', 'Zapisano wizytówkę.', async (held) => {
    const empty = title.trim() === '' && lead.trim() === '';
    const card = empty ? { sealed: '' as const } : await sealCard(held.ring, area.areaId, where, { title, lead }).catch(() => {
      throw new WorkspaceError(`Nie masz klucza obszaru „${nameOf(ctx, where)}” — wybierz inny w „Gdzie widać”.`);
    });
    await saveProfile(area.areaId, { card, category: category.trim(), ...(imageId !== (profile.imageId ?? '') ? { imageId } : {}) });
    return (await syncMainTitle(ctx, { title, lead })) ?? undefined;
  });

  return (
    <form className="wk-kind-form" id="kind-card" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      {unreadable && (
        <p className="wk-warn">Obecnej wizytówki nie da się tu odczytać (brak klucza obszaru „{nameOf(ctx, profile.card?.areaId ?? '')}”) — zapis ją zastąpi.</p>
      )}
      <label className="wk-field">
        <span>Tytuł</span>
        <input value={title} maxLength={200} disabled={ctx.busy} placeholder={area.name} data-kind-title="" onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="wk-field">
        <span>Opis</span>
        <textarea value={lead} rows={3} maxLength={600} disabled={ctx.busy} placeholder="Jednym, dwoma zdaniami: dla kogo i o czym." onChange={(e) => setLead(e.target.value)} />
      </label>
      <label className="wk-field">
        <span>Kategoria (do filtrów na listach)</span>
        <input value={category} maxLength={40} disabled={ctx.busy} list="kind-categories" placeholder="np. rekolekcje" onChange={(e) => setCategory(e.target.value)} />
      </label>
      <datalist id="kind-categories">
        {CATEGORIES.map((one) => <option key={one} value={one} />)}
      </datalist>
      <ImagePick images={world.images} value={imageId} busy={ctx.busy} hasPage={ctx.main !== null} onPick={setImageId} />
      <WherePick ctx={ctx} label="Gdzie widać wizytówkę" value={where} onPick={setWhere} />
      <div className="wk-actions">
        <button type="submit" className="wk-btn wk-btn-small" disabled={ctx.busy || !changed} data-kind-save-card="">Zapisz wizytówkę</button>
      </div>
    </form>
  );
}

function PublishSection({ ctx }: { ctx: Ctx }) {
  const now = ctx.publishTo;
  const suggested = defaultPublishArea(ctx.areas, ctx.area.areaId);
  const pick = (next: string) => {
    if (next === now) return;
    void ctx.run('Zapisywanie…', `Nowe rzeczy pokażesz w „${nameOf(ctx, next)}”.`, async () => {
      await saveProfile(ctx.area.areaId, { publishAreaId: next === ctx.area.areaId ? '' : next });
    });
  };
  return (
    <section className="wk-kind-sec" aria-labelledby="kind-publish-h" id="kind-publish">
      <h2 className="wk-h2" id="kind-publish-h">Publikuj w</h2>
      <WherePick ctx={ctx} label="Nowe rzeczy pokazuj w" value={now} onPick={pick} />
      {suggested !== now && isPublic(ctx, suggested) && (
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={() => pick(suggested)}>
            Proponowany: „{nameOf(ctx, suggested)}” — jawny, prowadzisz go
          </button>
        </div>
      )}
      <p className="wk-kind-small">
        Wizytówka, główny termin i pytania formularzy mogą być widoczne w innym obszarze niż dane — odpowiedzi, osoby i rozmowy
        zostają tutaj. Każdą rzecz możesz potem przenieść osobno; do innego obszaru publikujesz tylko, gdy prowadzisz oba.
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
  const c = ctx.state.controller;
  return (
    <>
      <Tool id="controller" name="Administrator danych" ok={c !== null}
        says={c !== null ? <>{c.name} — odpowiada za dane wydarzeń i grup w tym obszarze i niżej.</> : 'Wskaż go — będzie odpowiadał za dane wszystkich wydarzeń i grup w tym obszarze i niżej.'}>
        <div className="wk-actions">
          <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('areas', ctx.area.areaId, 'ustawienia')}>{c !== null ? 'Ustawienia' : 'Wskaż'}</a>
        </div>
      </Tool>
      <MainPageTool ctx={ctx} />
      <ListsTool ctx={ctx} />
    </>
  );
}

function CourseTools({ ctx }: { ctx: Ctx }) {
  const base = ctx.world.bases[0] ?? null;
  const onPage = base !== null && hasRevisionPart(ctx, base.libraryId);
  /* 2026-10-31 — eine bestehende Baza aus einem anderen Bereich: wo sie liegt und wer sie dadurch liest, steht dabei. */
  const elsewhere = base !== null && base.areaId !== ctx.area.areaId;
  const picking = base === null && ctx.open === 'base';
  return (
    <>
      <Tool id="base" name="Baza wiedzy" ok={base !== null}
        says={elsewhere
          ? <>„{ctx.world.baseNames.get(base.libraryId) ?? 'Baza wiedzy'}” z obszaru „{nameOf(ctx, base.areaId)}” — uczący się tego kursu czytają ten obszar.</>
          : base === null && ctx.world.otherBases.length > 0 ? 'Wpisy i pytania kursu, z codzienną powtórką dla uczących się — nowa baza albo jedna z tych, które już masz.'
          : 'Wpisy i pytania kursu, z codzienną powtórką dla uczących się.'}>
        {picking && <PickBase ctx={ctx} />}
        <div className="wk-actions">
          {base === null ? (!picking && (
            <>
              <button type="button" className="wk-btn wk-btn-small" disabled={ctx.busy}
                onClick={() => void ctx.run('Zakładanie bazy…', 'Baza wiedzy jest gotowa.', (held) => makeBase(ctx, held))}>Utwórz bazę</button>
              {ctx.world.otherBases.length > 0 && (
                <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} data-course-pick="" onClick={() => ctx.setOpen('base')}>Wybierz istniejącą</button>
              )}
            </>
          )) : (
            <>
              <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('knowledge', base.libraryId, 'wpisy')}>Otwórz</a>
              {/* 2026-10-27 — wie die Uczący się lernen: je Osoba, je Pytanie, mit Zeit und Sposób liczenia (Nauka → Postępy). */}
              <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('learn', base.libraryId, 'postepy')} data-course-progress="">Postępy uczących się</a>
            </>
          )}
        </div>
      </Tool>
      {/* 2026-10-27 — die Powtórka auf der Seite des Kurses: dorthin führt der Link der Uczący się, auch ohne Konto. */}
      {base !== null && ctx.main !== null && (
        <Tool id="learnpage" name="Nauka na stronie" ok={onPage}
          says={onPage ? 'Na stronie głównej jest powtórka kursu — link dla uczących się prowadzi tam; kto nie ma konta, przedstawia się i jego postępy też widzisz.' : 'Powtórka kursu na stronie głównej: tam uczą się osoby z linku, także bez konta.'}>
          {!onPage && (
            <div className="wk-actions">
              <button type="button" className="wk-btn wk-btn-small" disabled={ctx.busy} data-course-learnpage=""
                onClick={() => void ctx.run('Dodawanie powtórki…', 'Powtórka jest na stronie głównej — utwórz teraz link dla uczących się.', async (held) => {
                  const revision = await courseRevision(ctx, held);
                  if (revision === null) throw new WorkspaceError('Baza kursu nie ma jeszcze powtórki — utwórz ją w Nauce (Powtórki).');
                  await addToPage(ctx.main!, [revisionPart(revision)]);
                })}>Dodaj powtórkę na stronę główną</button>
            </div>
          )}
        </Tool>
      )}
      <RolesTool ctx={ctx} defs={[LEARNERS]} />
      <MainPageTool ctx={ctx} optional />
    </>
  );
}

/**
 * 2026-10-31 — „WYBIERZ ISTNIEJĄCĄ": eine der eigenen Bazy wird die des Kurses, wo sie ist. Zur Wahl stehen Bazy aus
 * Bereichen, in die ich hineinlassen darf, nie aus dem privaten; dabei steht, dass die Uczący się den ganzen Bereich
 * lesen werden — mit den anderen Bazy darin.
 */
function PickBase({ ctx }: { ctx: Ctx }) {
  const choices = ctx.world.otherBases.filter((b) => {
    const area = ctx.areas.find((a) => a.areaId === b.areaId);
    return area !== undefined && area.personal !== true && area.mayCertify;
  });
  const [picked, setPicked] = useState('');
  const chosen = choices.find((b) => b.libraryId === picked) ?? choices[0];
  const neighbours = chosen === undefined ? [] : ctx.world.otherBases.filter((b) => b.areaId === chosen.areaId && b.libraryId !== chosen.libraryId);
  return (
    <form className="wk-kind-form" data-course-pick-form="" onSubmit={(e) => {
      e.preventDefault();
      if (chosen !== undefined) void ctx.run('Łączenie bazy z kursem…', `„${chosen.name}” jest bazą kursu.`, (held) => pickBase(ctx, held, chosen));
    }}>
      {chosen === undefined ? (
        <p className="wk-kind-small">Nie ma bazy, którą można tu wybrać: kurs może korzystać z bazy z obszaru, do którego możesz kogoś wpuścić — nie z Twojego prywatnego.</p>
      ) : (
        <>
          <label className="wk-field">
            <span>Istniejąca baza wiedzy</span>
            <select value={chosen.libraryId} disabled={ctx.busy} onChange={(e) => setPicked(e.target.value)}>
              {choices.map((b) => <option key={b.libraryId} value={b.libraryId}>{b.name} — obszar „{nameOf(ctx, b.areaId)}”</option>)}
            </select>
          </label>
          <p className="wk-warn" data-course-pick-warn="">
            Baza zostaje w obszarze „{nameOf(ctx, chosen.areaId)}”. Rola „{LEARNERS.label}” dostanie do niego dostęp do czytania: uczący się z linku
            zobaczą wszystko, co jest w tym obszarze{neighbours.length > 0 ? <>, także {neighbours.length === 1 ? 'bazę' : 'bazy'} {neighbours.map((b) => `„${b.name}”`).join(', ')}</> : ''} — nie tylko tę bazę.
            {roleFor(ctx.world.roles, LEARNERS) === null && ' Rola uczących się powstanie przy tym (kilkanaście sekund).'}
          </p>
        </>
      )}
      <div className="wk-actions">
        {chosen !== undefined && <button type="submit" className="wk-btn wk-btn-small" disabled={ctx.busy} data-course-pick-go="">Wybierz tę bazę</button>}
        <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={() => ctx.setOpen(null)}>Anuluj</button>
      </div>
    </form>
  );
}

/* -- Strona główna, podstrony -- */

export function MainPageTool({ ctx, optional = false }: { ctx: Ctx; optional?: boolean }) {
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
      <Tool id="main" name="Strona główna" ok says={<a className="wk-link" href={pagePath(main)}>recreatio.pl/{main}</a>}>
        <div className="wk-actions">
          <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('pages', ...pageSteps(main))}>Edytuj stronę</a>
          <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={() => ctx.setOpen('main')}>Wybierz inną</button>
        </div>
      </Tool>
    );
  }

  return (
    <Tool id="main" name="Strona główna" ok={main !== null ? true : optional ? null : false}
      says={ctx.profile.kind === 'event' ? 'Strona, którą pokazują karty i listy — z wizytówką na górze.' : 'Strona, którą pokazują karty i listy.'}>
      {pages.length === 0 ? (
        <p className="wk-kind-small">
          Nie prowadzisz jeszcze żadnej strony — adres najwyższego poziomu bierze się kodem w <a className="wk-link" href={viewPath('pages')}>Stronach</a>.
        </p>
      ) : (
        <form className="wk-kind-form" onSubmit={(e) => {
          e.preventDefault();
          void ctx.run('Tworzenie strony…', 'Strona główna jest gotowa.', (held) => makeMainPage(ctx, held, `${under}/${address}`));
        }}>
          <div className="wk-kind-row">
            <label className="wk-field">
              <span>Nowa strona pod</span>
              <select value={under} disabled={ctx.busy} onChange={(e) => setParent(e.target.value)}>
                {pages.map((p) => <option key={p.path} value={p.path}>recreatio.pl/{p.path}/…</option>)}
              </select>
            </label>
            <label className="wk-field">
              <span>Końcówka adresu</span>
              <input value={slug} maxLength={40} disabled={ctx.busy} placeholder={slugOf(ctx.title)} onChange={(e) => setSlug(e.target.value)} />
            </label>
          </div>
          <p className="wk-kind-address">recreatio.pl/{under}/{address}</p>
          <div className="wk-actions">
            <button type="submit" className="wk-btn wk-btn-small" disabled={ctx.busy || under === ''} data-kind-main="">Utwórz stronę</button>
          </div>
        </form>
      )}
      <div className="wk-field">
        <span>Albo istniejąca strona</span>
        <PickPage value={picked} busy={ctx.busy} onPick={setPicked} />
      </div>
      <div className="wk-actions">
        {picked !== '' && picked !== main && (
          <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
            onClick={() => void ctx.run('Zapisywanie…', 'Ustawiono stronę główną.', async () => { await saveProfile(ctx.area.areaId, { path: picked }); ctx.setOpen(null); })}>
            Ustaw jako główną
          </button>
        )}
        {editing && <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={() => ctx.setOpen(null)}>Anuluj</button>}
      </div>
    </Tool>
  );
}

function SubpagesTool({ ctx }: { ctx: Ctx }) {
  const [name, setName] = useState('');
  const main = ctx.main;
  if (main === null) return null;
  const after = ctx.profile.after?.path ?? null;
  const lower = ctx.world.pages.filter((p) => p.path.startsWith(`${main}/`) && p.path !== after);
  return (
    <Tool id="sub" name="Podstrony" ok={lower.length > 0 ? true : null} says="Program, dojazd, regulamin — każda pod adresem strony głównej.">
      {lower.length > 0 && (
        <ul className="wk-kind-list">
          {lower.map((p) => <li key={p.path}><a className="wk-link" href={viewPath('pages', ...pageSteps(p.path))}>{p.path.slice(main.length + 1)}</a></li>)}
        </ul>
      )}
      <form className="wk-kind-form wk-kind-inline" onSubmit={(e) => {
        e.preventDefault();
        const called = name.trim();
        if (called === '') return;
        void ctx.run('Tworzenie podstrony…', 'Podstrona jest gotowa — dodaj na niej moduły.', async (held) => {
          await createSubpage({ path: `${main}/${slugOf(called)}`, roleId: held.person.id, areaId: null, title: called, lead: null, parts: [] });
          setName('');
        });
      }}>
        <label className="wk-field">
          <span>Nowa podstrona</span>
          <input value={name} maxLength={80} disabled={ctx.busy} placeholder="np. Program" onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy || name.trim() === ''}>Dodaj</button>
      </form>
    </Tool>
  );
}

/* -- Formularze -- */

function SignupTool({ ctx }: { ctx: Ctx }) {
  const form = ctx.signup;
  if (form === null) {
    return (
      <Tool id="signup" name="Formularz zgłoszeń" ok={false}
        says="Imię, nazwisko, telefon, e-mail. Odpowiedzi trafiają do tego obszaru, pytania widać tam, gdzie publikujesz.">
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-small" disabled={ctx.busy} data-kind-signup=""
            onClick={() => void ctx.run('Tworzenie formularza…', 'Formularz zgłoszeń jest gotowy.', (held) => makeSignup(ctx, held))}>
            Utwórz formularz
          </button>
        </div>
      </Tool>
    );
  }
  const onMain = ctx.main !== null && form.pages.includes(ctx.main);
  const at = questionsAreaOf(form) ?? ctx.area.areaId;
  const open = ctx.state.openForms.includes(form.moduleId);
  return (
    <Tool id="signup" name="Formularz zgłoszeń" ok={open}
      says={<>{form.name} · {form.entries} {plural(form.entries, 'zgłoszenie', 'zgłoszenia', 'zgłoszeń')}{form.closed ? ' · zamknięty' : open ? ' · przyjmuje' : ' · jeszcze nie przyjmuje'}</>}>
      <div className="wk-actions">
        <a className="wk-btn wk-btn-line wk-btn-small" href={formPath(form.moduleId)}>Otwórz</a>
        {!onMain && ctx.main !== null && (
          <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
            onClick={() => void ctx.run('Formularz na stronie…', 'Formularz stoi na stronie głównej.', () => placeForm(ctx, form.moduleId))}>
            Postaw na stronie głównej
          </button>
        )}
      </div>
      <WherePick ctx={ctx} label="Pytania widać w" value={at} onPick={(next) => {
        if (next === at) return;
        void ctx.run('Przenoszenie pytań…', `Pytania są teraz widoczne w „${nameOf(ctx, next)}”.`, async (held) => {
          await moveQuestions(held.ring, form.moduleId, next === form.areaId ? null : next);
        });
      }} />
      <p className="wk-kind-small">Odpowiedzi zawsze trafiają do tego obszaru. To samo zmienisz w ustawieniach formularza.</p>
    </Tool>
  );
}

function SubFormsTool({ ctx, form }: { ctx: Ctx; form: ModuleRow }) {
  const [name, setName] = useState('');
  const [filler, setFiller] = useState<'person' | 'office'>('person');
  const subs = ctx.world.forms.filter((f) => f.extendsId === form.moduleId);
  return (
    <Tool id="subforms" name="Podformularze" ok={subs.length > 0 ? true : null}
      says="Dodatkowe pytania do zgłoszenia — uzupełnia uczestnik albo tylko prowadzący (notatki).">
      {subs.length > 0 && (
        <ul className="wk-kind-list">
          {subs.map((f) => (
            <li key={f.moduleId}>
              <a className="wk-link" href={formPath(f.moduleId)}>{f.name}</a> <span className="wk-tag">{f.audience === 'office' ? 'prowadzący' : 'uczestnik'}</span>
            </li>
          ))}
        </ul>
      )}
      <form className="wk-kind-form wk-kind-inline" onSubmit={(e) => {
        e.preventDefault();
        const called = name.trim();
        if (called === '') return;
        void ctx.run('Tworzenie podformularza…', 'Podformularz jest gotowy — dodaj w nim pytania.', async () => {
          await createModule(newId(), 'form', called, ctx.area.areaId, 'person', undefined, { extendsId: form.moduleId, audience: filler });
          setName('');
        });
      }}>
        <label className="wk-field">
          <span>Nowy podformularz</span>
          <input value={name} maxLength={120} disabled={ctx.busy} placeholder="np. Zgoda rodzica" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="wk-field">
          <span>Wypełnia</span>
          <select value={filler} disabled={ctx.busy} onChange={(e) => setFiller(e.target.value === 'office' ? 'office' : 'person')}>
            <option value="person">uczestnik</option>
            <option value="office">prowadzący</option>
          </select>
        </label>
        <button type="submit" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy || name.trim() === ''}>Dodaj</button>
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

const pointWhen = (root: ProgramNode, p: ProgramNode): string => {
  const time = (d: Date) => d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const day = dayOf(p.start) === dayOf(root.start) && dayOf(root.end) === dayOf(root.start) ? ''
    : `${p.start.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })} `;
  return p.allDay ? day.trim() || 'cały dzień' : `${day}${time(p.start)}–${time(p.end)}`;
};

function TermTool({ ctx }: { ctx: Ctx }) {
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
      <Tool id="term" name="Główny termin i program" ok
        says={<>{when ?? 'termin'}{node?.location ? ` · ${node.location}` : ''}{vis !== null ? ` · widzi: ${isPublic(ctx, vis) ? 'każdy' : `tylko „${nameOf(ctx, vis)}”`}` : ''}</>}>
        <div className="wk-actions">
          {here ? (
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} onClick={() => ctx.setOpen('term')}>Zmień termin</button>
          ) : (
            <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('calendar')}>Zmień w kalendarzu</a>
          )}
          {ctx.main !== null && itemId !== null && !programShown && (
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
              onClick={() => void ctx.run('Program na stronie…', 'Program stoi na stronie głównej.', () => placeProgram(ctx))}>
              Pokaż program na stronie
            </button>
          )}
        </div>
        {node !== null && node.children.length > 0 && (
          <ol className="wk-kind-points">
            {node.children.map((p) => (
              <li key={p.itemId}>
                <span className="wk-kind-point-when">{pointWhen(node, p)}</span> {p.title}{p.location !== null && p.location !== '' ? ` · ${p.location}` : ''}
              </li>
            ))}
          </ol>
        )}
        {node !== null && (point === null ? (
          <div className="wk-actions">
            <button type="button" className="wk-link-btn" disabled={ctx.busy}
              onClick={() => setPoint({ title: '', date: dayOf(node.start), time: '', endTime: '', place: '' })}>
              + Punkt programu
            </button>
          </div>
        ) : (
          <form className="wk-kind-form" onSubmit={(e) => {
            e.preventDefault();
            const wanted = point;
            void ctx.run('Dodawanie punktu…', 'Dodano punkt programu.', async (held) => { await addPoint(ctx, held, wanted); setPoint(null); });
          }}>
            <label className="wk-field">
              <span>Punkt programu</span>
              <input value={point.title} maxLength={200} disabled={ctx.busy} placeholder="np. Msza święta" onChange={(e) => setPoint({ ...point, title: e.target.value })} />
            </label>
            <div className="wk-kind-row">
              <label className="wk-field">
                <span>Dzień</span>
                <input type="date" value={point.date} disabled={ctx.busy} onChange={(e) => setPoint({ ...point, date: e.target.value })} />
              </label>
              <label className="wk-field">
                <span>Od</span>
                <input type="time" value={point.time} disabled={ctx.busy} onChange={(e) => setPoint({ ...point, time: e.target.value })} />
              </label>
              <label className="wk-field">
                <span>Do</span>
                <input type="time" value={point.endTime} disabled={ctx.busy || point.time === ''} onChange={(e) => setPoint({ ...point, endTime: e.target.value })} />
              </label>
            </div>
            <label className="wk-field">
              <span>Miejsce (opcjonalnie)</span>
              <input value={point.place} maxLength={200} disabled={ctx.busy} onChange={(e) => setPoint({ ...point, place: e.target.value })} />
            </label>
            <div className="wk-actions">
              <button type="submit" className="wk-btn wk-btn-small" disabled={ctx.busy || point.title.trim() === '' || point.date === ''}>Dodaj punkt</button>
              <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={() => setPoint(null)}>Anuluj</button>
            </div>
          </form>
        ))}
      </Tool>
    );
  }

  if (has && !here) {
    return (
      <Tool id="term" name="Główny termin i program" ok says="Ten termin ma link albo nie da się go tu odczytać — zmień go w kalendarzu, żeby nic nie zginęło.">
        <div className="wk-actions">
          <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('calendar')}>Otwórz kalendarz</a>
          <button type="button" className="wk-link-btn" onClick={() => ctx.setOpen(null)}>Zamknij</button>
        </div>
      </Tool>
    );
  }

  return (
    <Tool id="term" name="Główny termin i program" ok={has ? true : false}
      says={has ? undefined : 'Jego koniec to koniec wydarzenia; punkty programu dodasz potem.'}>
      <Segment
        now={mode}
        options={[{ value: 'new', label: has ? 'Zmień ten termin' : 'Nowy termin' }, { value: 'pick', label: 'Wybierz istniejący' }]}
        busy={ctx.busy}
        onPick={setMode}
      />
      {mode === 'pick' ? <PickTerm ctx={ctx} /> : (
      <form className="wk-kind-form" onSubmit={(e) => {
        e.preventDefault();
        const wanted = draft;
        void ctx.run('Zapisywanie terminu…', has ? 'Zapisano termin.' : 'Główny termin jest gotowy.', async (held) => {
          await saveTerm(ctx, held, wanted);
          ctx.setOpen(null);
        });
      }}>
        <label className="wk-field">
          <span>Tytuł terminu</span>
          <input value={draft.title} maxLength={200} disabled={ctx.busy} placeholder={ctx.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <div className="wk-kind-row">
          <label className="wk-field">
            <span>Początek</span>
            <input type="date" value={draft.date} disabled={ctx.busy} data-kind-date="" onChange={(e) => set({ date: e.target.value })} />
          </label>
          <label className="wk-field">
            <span>Godzina (puste: cały dzień)</span>
            <input type="time" value={draft.time} disabled={ctx.busy} onChange={(e) => set({ time: e.target.value })} />
          </label>
        </div>
        <div className="wk-kind-row">
          <label className="wk-field">
            <span>Koniec (opcjonalnie)</span>
            <input type="date" value={draft.endDate} min={draft.date === '' ? undefined : draft.date} disabled={ctx.busy} onChange={(e) => set({ endDate: e.target.value })} />
          </label>
          <label className="wk-field">
            <span>Godzina końca</span>
            <input type="time" value={draft.endTime} disabled={ctx.busy || draft.time === ''} onChange={(e) => set({ endTime: e.target.value })} />
          </label>
        </div>
        <label className="wk-field">
          <span>Miejsce</span>
          <input value={draft.place} maxLength={200} disabled={ctx.busy} placeholder="np. Dom rekolekcyjny w Limanowej" onChange={(e) => set({ place: e.target.value })} />
        </label>
        <WherePick ctx={ctx} label="Gdzie widać termin" value={draft.where} onPick={(where) => set({ where })} />
        <div className="wk-actions">
          <button type="submit" className="wk-btn wk-btn-small" disabled={ctx.busy || draft.date === ''} data-kind-term="">{has ? 'Zapisz termin' : 'Dodaj termin'}</button>
          {has && <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={() => ctx.setOpen(null)}>Anuluj</button>}
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
  const [choices, setChoices] = useState<readonly TermChoice[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  const [find, setFind] = useState('');

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const ring = (await keysFor(ctx.who)).ring;
        if (ring === null) throw new WorkspaceError('Klucze nie są otwarte.');
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

  if (failed) return <p className="wk-kind-small">Nie udało się wczytać terminów z kalendarzy.</p>;
  if (choices === null) return <Loading lines={2} />;
  const own = choices.filter((c) => c.here);
  if (choices.length === 0) {
    return <p className="wk-kind-small">Nie ma terminu do wybrania — pojedynczego (bez powtórzeń), w kalendarzu, w którym możesz pisać, od miesiąca wstecz do roku naprzód.</p>;
  }
  const words = find.trim().toLocaleLowerCase('pl').split(/\s+/).filter(Boolean);
  const shown = (all ? choices : own).filter((c) => {
    const text = `${c.item.title} ${c.item.location ?? ''} ${nameOf(ctx, c.item.occurrence.areaId)}`.toLocaleLowerCase('pl');
    return words.every((w) => text.includes(w));
  });

  const pick = async (choice: TermChoice) => {
    const o = choice.item.occurrence;
    if (!choice.here) {
      const yes = await ask({
        title: 'Przenieść termin do tego obszaru?',
        body: `„${choice.item.title}” jest w kalendarzu obszaru „${nameOf(ctx, o.areaId)}”. Głównym terminem może być tylko termin z kalendarza tego obszaru, więc przejdzie do kalendarza „${ctx.area.name}”. Widzą go ci sami ludzie co dotąd, punkty programu idą z nim.`,
        confirm: 'Przenieś i wybierz'
      });
      if (!yes) return;
    }
    void ctx.run('Ustawianie terminu…', 'Główny termin jest ustawiony.', async (held) => {
      if (!choice.here) {
        held.step('Przenoszenie terminu…');
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
          <span>Szukaj</span>
          <input value={find} placeholder="tytuł, miejsce, obszar" onChange={(e) => setFind(e.target.value)} />
        </label>
      )}
      {!all && own.length === 0 && <p className="wk-kind-small">W kalendarzu tego obszaru nie ma takiego terminu.</p>}
      {all && shown.length === 0 && <p className="wk-kind-small">Nic nie pasuje.</p>}
      <ul className="wk-kind-roles" data-kind-term-pick="">
        {shown.map((c) => {
          const o = c.item.occurrence;
          const when = whenText({ id: o.itemId, startsAt: o.startsAt, endsAt: o.endsAt, allDay: o.allDay, status: null, fields: [] });
          return (
            <li key={o.itemId}>
              <span className="wk-kind-role-name">
                <b>{c.item.title}</b> · {when}{c.item.location ? ` · ${c.item.location}` : ''}
                {!c.here && <span className="wk-kind-small"> · kalendarz „{nameOf(ctx, o.areaId)}”</span>}
              </span>
              <div className="wk-actions">
                <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} onClick={() => void pick(c)}>
                  {c.here ? 'Wybierz' : 'Przenieś i wybierz'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {own.length < choices.length && (
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" onClick={() => setAll(!all)}>
            {all ? 'Tylko z kalendarza tego obszaru' : `Także z innych kalendarzy (${choices.length - own.length})`}
          </button>
        </div>
      )}
    </>
  );
}

/* -- Rozmowy, „Napisz do nas" -- */

function AskTool({ ctx }: { ctx: Ctx }) {
  const has = (ctx.world.page?.parts ?? []).some((p) => p.kind === 'seat-ask');
  return (
    <Tool id="ask" name="„Napisz do nas”" ok={has ? true : null}
      says={has ? 'Stoi na stronie głównej. Kto odpowiada i z których formularzy można pisać, ustawisz w edytorze strony.'
        : 'Zapisana osoba pisze do organizatorów — tę rozmowę widzą tylko ona i oni.'}>
      <div className="wk-actions">
        {ctx.main === null ? <span className="wk-kind-small">Najpierw strona główna.</span>
          : has ? <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('pages', ...pageSteps(ctx.main))}>Edytuj stronę</a>
          : (
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
              onClick={() => void ctx.run('„Napisz do nas”…', '„Napisz do nas” stoi na stronie głównej.', (held) => makeAsk(ctx, held))}>
              Dodaj na stronę główną
            </button>
          )}
      </div>
    </Tool>
  );
}

export function ChatTool({ ctx, kind }: { ctx: Ctx; kind: 'area' | 'channel' }) {
  const chat = ctx.world.chats.find((c) => c.kind === kind) ?? null;
  const channel = kind === 'channel';
  const name = channel ? 'Kanał ogłoszeń' : ctx.profile.kind === 'group' ? 'Rozmowa grupy' : ctx.profile.kind === 'class' ? 'Rozmowa klasy' : 'Rozmowa uczestników';
  const form = ctx.signup;
  const joined = chat !== null && form !== null && (chat.formIds ?? []).includes(form.moduleId);
  return (
    <Tool id={channel ? 'channel' : 'chat'} name={name} ok={chat !== null ? true : channel ? null : false}
      says={channel ? 'Piszą prowadzący, czytają wszyscy — także zapisani z formularza.' : 'Piszą wszyscy z obszaru — i zapisani z formularza.'}>
      <div className="wk-actions">
        {chat === null ? (
          <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
            onClick={() => void ctx.run(channel ? 'Zakładanie kanału…' : 'Zakładanie rozmowy…', channel ? 'Kanał jest gotowy.' : 'Rozmowa jest gotowa.',
              (held) => makeChat(ctx, held, channel))}>
            Załóż
          </button>
        ) : (
          <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('chat', chat.chatId)}>Otwórz</a>
        )}
        {chat !== null && form !== null && !joined && (
          <button type="button" className="wk-link-btn" disabled={ctx.busy}
            onClick={() => void ctx.run('Dołączanie zapisanych…', 'Zapisani są w tej rozmowie.', async (held) => {
              await linkAudienceForm('chat', chat.chatId, form.moduleId, true, await myWriter(held.ring, ctx.area.areaId));
            })}>
            Dołącz zapisanych
          </button>
        )}
      </div>
    </Tool>
  );
}

/* -- Role -- */

export function RolesTool({ ctx, defs }: { ctx: Ctx; defs: readonly RoleDef[] }) {
  const found = defs.map((def) => ({ def, role: roleFor(ctx.world.roles, def) }));
  const others = ctx.world.roles.filter((r) => !found.some((f) => f.role?.roleId === r.roleId)).length;
  const all = found.every((f) => f.role !== null);
  return (
    <Tool id="roles" name="Role" ok={all ? true : found.some((f) => f.role !== null) ? null : false}
      says="Rola daje dostęp do obszaru — przez link albo z formularza. Tworzenie roli i linku trwa kilkanaście sekund.">
      <ul className="wk-kind-roles">
        {found.map(({ def, role }) => (
          <li key={def.key} data-role={def.key}>
            <span className="wk-kind-role-name"><strong>{def.label}</strong> <span className="wk-card-muted">— {def.says}</span></span>
            <span className="wk-actions">
              {role === null ? (
                <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
                  onClick={() => void ctx.run('Tworzenie roli…', `Rola „${def.label}” jest gotowa.`, (held) => makeRole(ctx, held, def))}>
                  Utwórz
                </button>
              ) : role.mine ? (
                <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
                  onClick={() => void ctx.run('Tworzenie linku…', 'Link jest gotowy — skopiuj go poniżej.', (held) => makeLink(ctx, held, def, role))}>
                  {def.link}
                </button>
              ) : <span className="wk-tag">jest</span>}
            </span>
            {ctx.links[def.key] !== undefined && <LinkShare url={ctx.links[def.key]} />}
          </li>
        ))}
      </ul>
      <p className="wk-kind-small">
        {others > 0 && <>Inne role w obszarze: {others}. </>}
        Linki znajdziesz potem w karcie <a className="wk-link" href={viewPath('areas', ctx.area.areaId, 'dostep')}>Dostęp</a>.
      </p>
    </Tool>
  );
}

/* -- Po wydarzeniu, koniec -- */

function AfterTool({ ctx }: { ctx: Ctx }) {
  const [picked, setPicked] = useState('');
  const after = ctx.profile.after?.path ?? null;
  const unlink = async () => {
    const yes = await ask({
      title: 'Odłączyć stronę po wydarzeniu?',
      body: 'Strona zostaje i od razu będzie widoczna — nie czeka już na koniec wydarzenia.',
      confirm: 'Odłącz'
    });
    if (yes) void ctx.run('Odłączanie…', 'Strona po wydarzeniu odłączona.', async () => { await saveProfile(ctx.area.areaId, { afterPath: '' }); });
  };
  return (
    <Tool id="after" name="Strona po wydarzeniu" ok={after !== null ? true : null}
      says="Ukryta do końca wydarzenia, potem pokazuje się na kartach zamiast zapisów. Moduł na niej może być tylko dla uczestników z ich własnym linkiem — w edytorze strony: „Widoczne dla”.">
      {after !== null ? (
        <div className="wk-actions">
          <a className="wk-link" href={pagePath(after)}>recreatio.pl/{after}</a>
          <a className="wk-btn wk-btn-line wk-btn-small" href={viewPath('pages', ...pageSteps(after))}>Edytuj stronę</a>
          <button type="button" className="wk-link-btn" disabled={ctx.busy} onClick={() => void unlink()}>Odłącz</button>
        </div>
      ) : (
        <>
          <div className="wk-actions">
            {ctx.main === null ? <span className="wk-kind-small">Najpierw strona główna.</span> : (
              <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} data-kind-after=""
                onClick={() => void ctx.run('Tworzenie strony…', 'Strona po wydarzeniu jest gotowa — pokaże się po końcu.', (held) => makeAfterPage(ctx, held))}>
                Utwórz recreatio.pl/{ctx.main}/po-wydarzeniu
              </button>
            )}
          </div>
          <div className="wk-field">
            <span>Albo istniejąca strona</span>
            <PickPage value={picked} busy={ctx.busy} onPick={setPicked} />
          </div>
          {picked !== '' && picked !== ctx.main && (
            <div className="wk-actions">
              <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
                onClick={() => void ctx.run('Zapisywanie…', 'Ustawiono stronę po wydarzeniu.', async () => { await saveProfile(ctx.area.areaId, { afterPath: picked }); })}>
                Ustaw jako stronę po wydarzeniu
              </button>
            </div>
          )}
        </>
      )}
    </Tool>
  );
}

const dateText = (iso: string): string => new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

function ArchiveTool({ ctx }: { ctx: Ctx }) {
  const p = ctx.profile;
  const archived = p.archivedAt !== null;
  const says = archived ? `Zakończone ${dateText(p.archivedAt!)} — formularze zamknięte, widać stronę po wydarzeniu.`
    : p.archiveMode === 'manual' ? 'Zakończysz je przyciskiem poniżej.'
    : p.itemId === null ? 'Zakończy się samo godzinę po końcu głównego terminu — gdy go dodasz.'
    : 'Zakończy się samo godzinę po końcu głównego terminu: formularze się zamkną, pokaże się strona po wydarzeniu.';

  const end = async () => {
    const yes = await ask({
      title: 'Zakończyć wydarzenie teraz?',
      body: 'Formularze przestaną przyjmować zgłoszenia, a strona po wydarzeniu stanie się widoczna. Można to cofnąć („Przywróć”).',
      confirm: 'Zakończ'
    });
    if (yes) void ctx.run('Kończenie…', 'Wydarzenie zakończone.', async () => { await setArchived(ctx.area.areaId, true); });
  };
  const restore = async () => {
    const yes = await ask({
      title: 'Przywrócić wydarzenie?',
      body: 'Formularze zamknięte przy końcu znowu przyjmą zgłoszenia, a koniec ustawisz potem ręcznie.',
      confirm: 'Przywróć'
    });
    if (yes) void ctx.run('Przywracanie…', 'Wydarzenie znowu trwa.', async () => { await setArchived(ctx.area.areaId, false); });
  };

  return (
    <Tool id="archive" name="Koniec wydarzenia" ok={archived ? true : null} says={says}>
      {!archived && (
        <Segment
          now={p.archiveMode}
          options={[{ value: 'auto', label: 'Samo, po terminie' }, { value: 'manual', label: 'Ręcznie' }]}
          busy={ctx.busy}
          onPick={(mode) => void ctx.run('Zapisywanie…', mode === 'auto' ? 'Wydarzenie zakończy się samo.' : 'Wydarzenie zakończysz ręcznie.',
            async () => { await saveProfile(ctx.area.areaId, { archiveMode: mode }); })}
        />
      )}
      <div className="wk-actions">
        {archived
          ? <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} onClick={() => void restore()}>Przywróć</button>
          : <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy} data-kind-end="" onClick={() => void end()}>Zakończ teraz</button>}
      </div>
    </Tool>
  );
}

/* -- Parafia: Listen -- */

const LISTS: readonly { readonly type: 'event' | 'group'; readonly label: string }[] = [
  { type: 'event', label: 'Wydarzenia' },
  { type: 'group', label: 'Grupy' }
];

function ListsTool({ ctx }: { ctx: Ctx }) {
  const parts = ctx.world.page?.parts ?? [];
  const has = (type: 'event' | 'group') => parts.some((p) => p.kind === 'events' && ((readConfig(p.config).type ?? '') || 'event') === type);
  return (
    <Tool id="lists" name="Listy na stronie głównej" ok={ctx.main === null ? false : LISTS.every((one) => has(one.type)) ? true : null}
      says="Wydarzenia i grupy z tego obszaru i obszarów w nim — uzupełniają się same.">
      <div className="wk-actions">
        {ctx.main === null ? <span className="wk-kind-small">Najpierw strona główna.</span> : LISTS.map((one) => has(one.type) ? (
          <span key={one.type} className="wk-tag wk-tag-open">{one.label} ✓</span>
        ) : (
          <button key={one.type} type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={ctx.busy}
            onClick={() => void ctx.run('Dodawanie listy…', `Lista „${one.label}” stoi na stronie głównej.`, () => placeList(ctx, one.type))}>
            Dodaj listę „{one.label}”
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
  /* 2026-10-27 — ein Kurs: seine Powtórka gleich auf der Seite — dort lernt, wer den Link bekommt. */
  if (ctx.profile.kind === 'course') {
    const revision = await courseRevision(ctx, held);
    if (revision !== null) parts.push(revisionPart(revision));
  }
  /* Ein Formular, das noch auf keiner Seite steht, kommt gleich mit. */
  if (ctx.signup !== null && ctx.signup.pages.length === 0) parts.push(formPart(ctx.signup.moduleId));
  held.step('Tworzenie strony…');
  const made = await createSubpage({
    path, roleId: held.person.id, areaId: ctx.state.controller === null ? null : ctx.area.areaId,
    title: ctx.title, lead: (ctx.world.card?.lead ?? '').trim() || null, parts
  });
  await saveProfile(ctx.area.areaId, { path });
  ctx.setOpen(null);
  return made.note ?? undefined;
}

async function placeForm(ctx: Ctx, formId: string): Promise<void> {
  if (ctx.main === null) throw new WorkspaceError('Najpierw strona główna.');
  await addToPage(ctx.main, [formPart(formId)]);
}

async function makeSignup(ctx: Ctx, held: Held): Promise<string | void> {
  const made = await createSignupForm(ctx.who, held.ring, { areaId: ctx.area.areaId, name: ctx.title, publishTo: ctx.publishTo, onStage: held.step });
  const notes: string[] = made.note === null ? [] : [made.note];
  if (ctx.main !== null) {
    held.step('Formularz na stronie głównej…');
    await addToPage(ctx.main, [formPart(made.formId)]);
  }
  const participants = roleFor(ctx.world.roles, PARTICIPANTS);
  if (participants !== null) {
    await setMemberRoles(made.formId, [participants.roleId]).catch(() => { notes.push('Rola uczestników nie została połączona z formularzem — zrobisz to w jego ustawieniach.'); });
  }
  return notes.join(' ') || undefined;
}

async function saveTerm(ctx: Ctx, held: Held, draft: TermDraft): Promise<void> {
  const term = mainTermOf(draft);
  if (term === null) throw new WorkspaceError('Podaj dzień początku.');
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
  if (itemId === null) throw new WorkspaceError('Najpierw główny termin.');
  const term = mainTermOf({ date: point.date, time: point.time, endDate: point.date, endTime: point.endTime });
  if (term === null) throw new WorkspaceError('Podaj dzień punktu programu.');
  await savePublishedItem(held.ring, {
    areaId: ctx.area.areaId,
    visibilityAreaId: ctx.profile.item?.visibilityAreaId ?? ctx.publishTo,
    ownerRoleId: held.person.id,
    item: { title: point.title.trim(), location: point.place, ...term },
    parentItemId: itemId
  });
}

async function placeProgram(ctx: Ctx): Promise<void> {
  if (ctx.main === null || ctx.profile.itemId === null) throw new WorkspaceError('Najpierw strona główna i główny termin.');
  await addToPage(ctx.main, [{ kind: 'program', config: { title: 'Program', calendar: ctx.world.calendarId ?? '', item: ctx.profile.itemId }, box: { colSpan: 6, rowSpan: 5 } }]);
}

/**
 * „Napisz do nas": der Baustein auf der Hauptseite, sein Bereich der Antwortenden
 * IM Bereich (dessen Administrator danych gilt), die Organizatorzy darin, das
 * Formular zgłoszeń daran.
 */
async function makeAsk(ctx: Ctx, held: Held): Promise<string | void> {
  if (ctx.main === null) throw new WorkspaceError('Najpierw strona główna.');
  const partId = newId();
  held.step('„Napisz do nas” na stronie…');
  await addToPage(ctx.main, [{ id: partId, kind: 'seat-ask', config: { title: 'Napisz do nas' }, box: { colSpan: 3, rowSpan: 5 } }]);
  held.step('Kto odpowiada…');
  const made = await createArea(held.ring, held.person, `Organizatorzy — ${ctx.title}`.slice(0, 200), ctx.area.areaId);
  await updateModule(partId, { areaId: made.areaId });
  const notes: string[] = [];
  const organisers = roleFor(ctx.world.roles, ORGANISERS);
  if (organisers !== null) {
    await joinArea(held.ring, made.areaId, { id: organisers.roleId, kind: 'group', wrapPublicKey: organisers.wrapPublicKey }, held.person.id, 'write')
      .catch(() => { notes.push('Rola organizatorów nie została dodana do odpowiadających — dodasz ją w edytorze strony.'); });
  }
  if (ctx.signup !== null) {
    await linkAudienceForm('module', partId, ctx.signup.moduleId, true, held.person.id)
      .catch(() => { notes.push('Formularza zgłoszeń nie dołączono — dołączysz go w edytorze strony.'); });
  } else {
    notes.push('Dołącz formularz zgłoszeń w edytorze strony — bez niego nikt tu nie napisze.');
  }
  return notes.join(' ') || undefined;
}

async function makeChat(ctx: Ctx, held: Held, channel: boolean): Promise<string | void> {
  const writer = await myWriter(held.ring, ctx.area.areaId);
  const chatId = await startAreaChat(ctx.area.areaId, writer, channel);
  if (ctx.signup === null) return;
  const joined = await linkAudienceForm('chat', chatId, ctx.signup.moduleId, true, writer).then(() => true, () => false);
  return joined ? undefined : 'Rozmowa powstała, ale zapisanych nie dołączono — użyj „Dołącz zapisanych”.';
}

async function makeRole(ctx: Ctx, held: Held, def: RoleDef): Promise<string | void> {
  const made = await createAreaRole(held.ring, held.person, { areaId: ctx.area.areaId, name: `${def.label}: ${ctx.title}`, capability: def.capability, onStage: held.step });
  /* Unter ihrem Schlüssel — dann trifft sie auch ein JSON-Import und der Export nennt sie so. */
  if (!ctx.world.roles.some((r) => r.key === def.key)) {
    await saveImportKeys(ctx.area.areaId, [{ kind: 'role', key: def.key, refId: made.roleId, refText: def.label }]).catch(() => undefined);
  }
  if (def.key !== PARTICIPANTS.key || ctx.signup === null) return;
  /* Wer sich zapisze, bekommt die Rolle der Uczestnicy. */
  const had = ctx.signup.memberRoleIds ?? (ctx.signup.memberRoleId === null ? [] : [ctx.signup.memberRoleId]);
  const linked = await setMemberRoles(ctx.signup.moduleId, [...had.filter((id) => id !== made.roleId), made.roleId]).then(() => true, () => false);
  return linked ? undefined : 'Rola powstała, ale nie połączono jej z formularzem — zrobisz to w jego ustawieniach.';
}

/**
 * 2026-10-27 — DIE POWTÓRKA EINES KURSES auf seiner Seite: die erste Powtórka seiner Baza (die tägliche, die
 * `createCourseBase` anlegt). Wer den Link der Uczący się öffnet, lernt dort — mit Konto als er selbst, ohne
 * Konto stellt er sich vor (`cogita/pageLearner.tsx`); seine Antworten gehen in die Przyjęcia des Kurses.
 */
async function courseRevision(ctx: Ctx, held: Held): Promise<{ libraryId: string; revisionId: string } | null> {
  const base = ctx.world.bases[0];
  if (base === undefined) return null;
  held.step('Powtórka kursu…');
  const store = storeOf(held.ring, base);
  await store.sync();
  const revision = store.all().find((e) => e.kind === 'revision');
  return revision === undefined ? null : { libraryId: base.libraryId, revisionId: revision.id };
}

const revisionPart = (r: { libraryId: string; revisionId: string }): NewPart =>
  ({ kind: 'cogita-revision', config: { title: '', library: r.libraryId, revision: r.revisionId }, box: { colSpan: 6, rowSpan: 4 } });

/** Steht auf der Hauptseite schon eine Powtórka dieser Baza? */
const hasRevisionPart = (ctx: Ctx, libraryId: string): boolean =>
  (ctx.world.page?.parts ?? []).some((part) => part.kind === 'cogita-revision' && readConfig(part.config).library === libraryId);

/** Wohin der Link einer Rolle führt. */
function aimFor(ctx: Ctx, def: RoleDef): string {
  if (def.key === PARTICIPANTS.key && ctx.main !== null) return ctx.main;
  /* 2026-10-27 — die Seite des Kurses, wenn es sie gibt (dort lernt man auch ohne Konto); sonst die Nauka (mit Konto). */
  if (def.key === LEARNERS.key && ctx.main !== null && ctx.world.bases[0] !== undefined && hasRevisionPart(ctx, ctx.world.bases[0].libraryId)) return ctx.main;
  if (def.key === LEARNERS.key && ctx.world.bases[0] !== undefined) return `workspace/learn/${ctx.world.bases[0].libraryId}`;
  return `workspace/areas/${ctx.area.areaId}`;
}

async function makeLink(ctx: Ctx, held: Held, def: RoleDef, role: RoleSeen): Promise<void> {
  const link = await createLink(held.ring, held.person, {
    label: `${def.label}: ${ctx.title}`, roles: [{ roleId: role.roleId, lead: false }], once: false,
    expiresDays: def.key === LEARNERS.key ? 365 : 90, aim: aimFor(ctx, def)
  }, held.step);
  ctx.setLink(def.key, link.url);
}

async function makeAfterPage(ctx: Ctx, held: Held): Promise<string | void> {
  if (ctx.main === null) throw new WorkspaceError('Najpierw strona główna.');
  const path = `${ctx.main}/po-wydarzeniu`;
  const made = await createSubpage({
    path, roleId: held.person.id, areaId: ctx.state.controller === null ? null : ctx.area.areaId,
    title: `${ctx.title} — po wydarzeniu`, lead: null,
    parts: [
      { kind: 'text', config: { title: 'Dziękujemy', body: 'Dziękujemy, że byliście z nami!' }, box: { colSpan: 6, rowSpan: 3 } },
      /* Nur für die Menschen des Wydarzenie — leer, bis jemand Bilder oder Materialien einträgt. */
      { kind: 'text', config: { title: 'Dla uczestników', body: '' }, audienceAreaId: ctx.area.areaId, box: { colSpan: 6, rowSpan: 3 } }
    ]
  });
  await saveProfile(ctx.area.areaId, { afterPath: path });
  return made.note ?? undefined;
}

async function placeList(ctx: Ctx, type: 'event' | 'group'): Promise<void> {
  if (ctx.main === null) throw new WorkspaceError('Najpierw strona główna.');
  const config: Record<string, string> = type === 'event'
    ? { title: 'Wydarzenia', type, areas: ctx.area.areaId, deep: 'yes', when: 'coming' }
    : { title: 'Grupy', type, areas: ctx.area.areaId, deep: 'yes' };
  await addToPage(ctx.main, [{ kind: 'events', config, box: { colSpan: 6, rowSpan: 3 } }]);
}

async function makeBase(ctx: Ctx, held: Held): Promise<void> {
  await createCourseBase(held.ring, held.person, ctx.area.areaId, ctx.title, held.step);
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
 * 2026-10-31 — EINE BESTEHENDE BAZA WIRD DIE BAZA DES KURSES, wo sie ist (der Besitzer: „use it in place"):
 *   1. die Rolle der Uczący się liest ihren Bereich — gibt es die Rolle noch nicht, entsteht sie gleich für beide;
 *   2. nennt die Baza noch keinen Ort für Antworten, gehen sie in die Przyjęcia des Kurses (dort die Postępy);
 *   3. steht auf der Hauptseite noch keine Powtórka, kommt ihre erste dorthin — dort lernen die mit dem Link.
 * Ihre Einträge, Fortschritte, Seiten und Links für AI bleiben, wie sie sind.
 */
async function pickBase(ctx: Ctx, held: Held, base: OpenLibrary): Promise<string | void> {
  const course = ctx.area.areaId;
  const there = base.areaId;
  const notes: string[] = [];
  const name = `${LEARNERS.label}: ${ctx.title}`;
  const learners = roleFor(ctx.world.roles, LEARNERS);
  let ring = held.ring;
  if (learners === null) {
    held.step('Rola uczących się (kilkanaście sekund)…');
    const made = await createCommonRole(ring, held.person, { name, areas: [{ areaId: course, capability: 'read' }, { areaId: there, capability: 'read' }] }, held.step);
    ring = made.ring;
    await nameRoleIn(ring, course, made.roleId, name);
    await nameRoleIn(ring, there, made.roleId, name);
    await saveImportKeys(course, [{ kind: 'role', key: LEARNERS.key, refId: made.roleId, refText: LEARNERS.label }]).catch(() => undefined);
  } else {
    held.step(`Dostęp uczących się do obszaru „${nameOf(ctx, there)}”…`);
    const issuer = await issuerIn(ring, there);
    if (issuer === null) throw new WorkspaceError(`Do obszaru „${nameOf(ctx, there)}” nie możesz nikogo wpuścić — wybierz bazę z obszaru, który prowadzisz.`);
    await joinArea(ring, there, { id: learners.roleId, kind: 'group', wrapPublicKey: learners.wrapPublicKey }, issuer, 'read');
    await nameRoleIn(ring, there, learners.roleId, learners.name ?? name);
  }

  held.step('Ustawienia bazy…');
  const store = storeOf(ring, base);
  await store.sync();
  const { CogitaLibrary } = await import('../cogita/store');
  const lib = new CogitaLibrary(store, base.writes);
  const storage = lib.settings().storageAreaId;
  if (storage === undefined && base.writes) {
    if (!(await loadIntake(course).then(() => true, () => false))) {
      held.step('Klucz przyjęć odpowiedzi (kilka sekund)…');
      await createIntake(ring, course, held.person.id);
    }
    await lib.saveSettings({ storageAreaId: course });
  } else if (storage === undefined) {
    notes.push('W tej bazie nie możesz pisać, więc nie ustawiono, gdzie zapisują się odpowiedzi — zrobi to jej prowadzący (Nauka → Ustawienia).');
  } else if (storage !== course) {
    notes.push(`Odpowiedzi uczących się tej bazy zapisują się w obszarze „${nameOf(ctx, storage)}” (ustawienia bazy) — tam też są ich postępy.`);
  }

  const revision = store.all().find((e) => e.kind === 'revision');
  const pageHas = (ctx.world.page?.parts ?? []).some((part) => part.kind === 'cogita-revision');
  if (revision === undefined) {
    notes.push('Baza nie ma jeszcze powtórki — utwórz ją w Nauce (Powtórki), potem dodaj ją na stronę główną.');
  } else if (ctx.main !== null && !pageHas) {
    held.step('Powtórka na stronie głównej…');
    await addToPage(ctx.main, [revisionPart({ libraryId: base.libraryId, revisionId: revision.id })]);
    notes.push('Jej powtórka stoi na stronie głównej — tam uczą się osoby z linku.');
  }
  ctx.setOpen(null);
  return notes.join(' ') || undefined;
}

/* == Ustawienia: der Rodzaj ======================================================= */

const NO_KIND = { kind: null, label: 'Zwykły obszar', says: 'Bez wizytówki i narzędzi rodzaju.' } as const;

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
  const [busy, setBusy] = useState(false);
  if (state === null) return <Loading lines={1} />;
  const now = state.profile?.kind ?? null;

  const pick = async (next: ProfileKind | null) => {
    if (next === now) return;
    if (next === null) {
      const yes = await ask({
        title: 'Zdjąć rodzaj obszaru?',
        body: 'Obszar, strony, formularze, terminy i rozmowy zostają. Znika wizytówka, a obszar znika z list.',
        confirm: 'Zdejmij',
        danger: true
      });
      if (!yes) return;
    } else if (now !== null) {
      const yes = await ask({
        title: `Zmienić rodzaj na „${kindLabel(next)}”?`,
        body: 'Wszystko w obszarze zostaje — zmieniają się narzędzia i listy, na których się pokazuje.',
        confirm: 'Zmień'
      });
      if (!yes) return;
    }
    setBusy(true);
    try {
      if (next === null) {
        await removeProfile(area.areaId);
        onChanged(null);
        toast('Obszar jest znowu zwykłym obszarem.', { kind: 'ok' });
      } else {
        /* Ein neues Wydarzenie veröffentlicht gleich dort, wo es naheliegt: im nächsten jawnen Bereich darüber, den ich führe. */
        const publish = now === null && next === 'event' ? defaultPublishArea(areas, area.areaId) : area.areaId;
        const out = await saveProfile(area.areaId, { kind: next, ...(publish !== area.areaId ? { publishAreaId: publish } : {}) });
        onChanged(out.profile);
        toast(`Rodzaj obszaru: ${kindLabel(next)}.`, { kind: 'ok' });
        if (now === null) window.location.hash = viewPath('areas', area.areaId, 'profil');
      }
    } catch (e) {
      toast(failure(e, 'Nie udało się zmienić rodzaju obszaru.'), { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const choices: readonly { readonly kind: ProfileKind | null; readonly label: string; readonly says: string }[] = [NO_KIND, ...PROFILE_KINDS];
  return (
    <div className="wk-kind-choices" role="radiogroup" aria-label="Rodzaj obszaru">
      {choices.map((one) => (
        <label key={one.kind ?? 'none'} className={`wk-kind-choice${now === one.kind ? ' is-on' : ''}`} data-area-kind={one.kind ?? 'none'}>
          <input type="radio" name={`area-kind-${area.areaId}`} checked={now === one.kind} disabled={!state.admin || busy} onChange={() => void pick(one.kind)} />
          <span className="wk-kind-choice-text">
            <strong>{one.label}</strong>
            <span className="wk-kind-choice-says">{one.says}</span>
          </span>
        </label>
      ))}
      {!state.admin && <p className="wk-kind-small">Rodzaj zmienia ten, kto prowadzi obszar.</p>}
      {state.admin && now === null && (
        <p className="wk-kind-small">
          Albo cały obszar naraz — strony, formularz, terminy, role, rozmowy — z JSON przygotowanego przez AI:{' '}
          <a className="wk-link" href={viewPath('areas', area.areaId, 'profil')} data-area-json-open="">Import z JSON</a>
        </p>
      )}
    </div>
  );
}
