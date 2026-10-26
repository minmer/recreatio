/**
 * 0133 — DAS DOKUMENT EINES BEREICHS AUSFÜHREN („recreatio/area"), Schritt für
 * Schritt: Profil, Rollen (mit Links), Termine mit Programm, Formulare und Seiten,
 * Unterformulare, Rozmowy, Wizytówka, Listen.
 *
 * <b>Was entsteht, wird sofort unter seinem Schlüssel gemerkt</b>
 * (`area_import_key`), auch wenn ein späterer Schritt scheitert: der nächste
 * Import trifft es wieder, statt es zu verdoppeln. Ein einzelnes Stück, das nicht
 * geht (eine Seite, eine Rolle, ein Termin), wird gemeldet — der Rest geht weiter.
 *
 * <b>Alles Versiegeln geschieht hier im Browser:</b> die Felder der Termine unter
 * dem Schlüssel des Bereichs, in dem sie gezeigt werden, die Wizytówka ebenso, die
 * Fragen eines Formulars unter dem Schlüssel seines Veröffentlichungsbereichs. Der
 * Dienst prüft nur, dass wer in einen anderen Bereich veröffentlicht, beide führt.
 */

import { deleteEvent, saveEvent, type EventDraft } from '../calendar/agenda';
import type { AppointmentDoc } from '../calendar/appointmentsJson';
import { createCalendar } from '../calendar/calendar';
import { byPlace, loadProgram } from '../calendar/program';
import { areaKeys, loadAreaNames, openNames, setMemberName, startAreaChat } from '../chat/chat';
import { newId } from '../core/ids';
import type { Ring, SealedRole } from '../core/keys';
import { keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { askListing, loadListings, LISTING_WORDS } from '../events/events';
import { moveQuestions } from '../forms/questionsArea';
import { aimOf, createLink } from '../links/linkAccess';
import { createModule, loadModules, questionsAreaOf, updateModule, type ModuleRow } from '../modules/module';
import { applyModuleWish } from '../modules/moduleImport';
import { readModuleWish } from '../modules/moduleWish';
import type { ImageChoice } from '../pages/ImageNeeds';
import { loadPage, pageModeOf, toDraft } from '../pages/page';
import { NEED_PREFIX } from '../pages/pageImageNeeds';
import { runPageImport } from '../pages/pageImportRun';
import { readLook } from '../pages/slides/slideLook';
import { createCommonRole } from '../roles/commonRole';
import { pagePath, viewPath } from '../routes';
import { loadDesk, setPageAreas, type PageCard } from '../workspace/desk';
import { invalidate, refreshDesk } from '../workspace/viewData';
import { openSubpage } from './access';
import { createArea, joinArea, loadAreas, loadMembers, type AreaRow } from './area';
import {
  adjustPagePlan, blankPage, existingFormModule, formsOf, isUuid, keyBook, missingLine, moduleLine, normalisePath, pagePaths, planArea, preparePage,
  publishTarget, resolveRoleRefs, resolveTokens, type AreaDocument, type AreaImportOptions, type AreaPlan, type AreaState, type AskWant, type KeyBook,
  type PageLoad, type PlannedPage, type PlanStep, type PublishSay, type RefIds
} from './areaJson';
import { linkAudienceForm } from './audience';
import { setPageController } from './controllers';
import { loadImportKeys, loadProfile, saveImportKeys, saveProfile, sealCard, type ImportKey, type ImportKeyKind, type ProfilePatch } from './profile';

const failure = (e: unknown, fallback = 'nie udało się'): string =>
  (e instanceof WorkspaceError ? e.message : e instanceof Error ? e.message : fallback).replace(/[.\s]+$/, '');

/* -- Was der Plan über eine Seite wissen muss ------------------------------------------ */

/** Wie eine Seite gerade ist — für Vorschau und Import. Keine Seite (oder keine lesbare): `missing`. */
export async function loadPageState(path: string): Promise<PageLoad> {
  try {
    const page = await loadPage(path);
    return {
      state: 'page',
      now: {
        path, title: page.title ?? '', lead: page.lead ?? '', mode: pageModeOf(page.mode), look: readLook(page.theme),
        parts: page.parts.map(toDraft), logic: page.logic ?? null, subject: page.subject ?? null
      },
      editable: page.editable && page.locked !== true,
      ...(page.responsible === undefined ? {} : { responsibleAreaId: page.responsible?.areaId ?? null })
    };
  } catch {
    return { state: 'missing' };
  }
}

/**
 * Die Rollen des Bereichs mit ihrem Namen — die Namen, die die Prowadzący im Bereich lesen,
 * sonst der eigene der Rolle (wenn ich sie halte). Rollen eines Links zählen nicht.
 */
export async function loadRoleNames(ring: Ring | null, areaId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ring === null) return out;
  const [members, sealed] = await Promise.all([
    loadMembers(areaId).then((r) => r.members, () => []),
    loadAreaNames(areaId).then((r) => r.names, () => [])
  ]);
  let names = new Map<string, string>();
  if (sealed.length > 0) {
    try { names = await openNames(await areaKeys(ring, areaId), areaId, sealed); } catch { /* ohne Namen im Bereich */ }
  }
  for (const m of members) {
    if (m.kind !== 'group') continue;
    const name = names.get(m.roleId) ?? (ring.has(m.roleId) ? await ring.name(m.roleId).catch(() => null) : null);
    if (name !== null && name.trim() !== '' && !name.startsWith('Link: ')) out.set(m.roleId, name);
  }
  return out;
}

/** Alles, was der Plan braucht, frisch gelesen. */
export async function loadAreaState(input: {
  readonly areaId: string; readonly areaName: string; readonly ring: Ring | null;
  readonly doc: AreaDocument | null; readonly base: string;
}): Promise<AreaState> {
  const [profile, keys, areas, desk, modules, roleNames] = await Promise.all([
    loadProfile(input.areaId),
    loadImportKeys(input.areaId).then((r) => r.keys, () => [] as readonly ImportKey[]),
    loadAreas().then((r) => r.areas, () => [] as readonly AreaRow[]),
    loadDesk().then((d) => d.pages.filter((p) => p.aliasOf === null), () => [] as readonly PageCard[]),
    loadModules().then((r) => r.modules, () => [] as readonly ModuleRow[]),
    loadRoleNames(input.ring, input.areaId).catch(() => new Map<string, string>())
  ]);
  const pages = new Map<string, PageLoad>();
  if (input.doc !== null) {
    for (const path of pagePaths(input.doc, input.base)) pages.set(path, await loadPageState(path));
  }
  const ring = input.ring;
  return {
    areaId: input.areaId, areaName: input.areaName, profile, book: keyBook(keys), areas, desk, modules,
    holds: (roleId) => ring !== null && ring.has(roleId), roleNames, pages
  };
}

/** Die Menschen dieser Formulare (mit ihrem Link) in eine Rozmowa — was nicht geht, in Worten. */
async function joinForms(chatId: string, forms: readonly { ref: string; moduleId: string | null }[], byRoleId: string): Promise<{ linked: number; warnings: string[] }> {
  let linked = 0;
  const warnings: string[] = [];
  for (const one of forms) {
    if (one.moduleId === null) { warnings.push(`formularza „${one.ref}” nie ma w dokumencie ani w obszarze — pominięty.`); continue; }
    try {
      await linkAudienceForm('chat', chatId, one.moduleId, true, byRoleId);
      linked += 1;
    } catch (e) {
      warnings.push(`zapisanych z „${one.ref}” nie dołączono (${failure(e)}).`);
    }
  }
  return { linked, warnings };
}

/** Welche meiner Rollen im Bereich schreibt (prowadzi zuerst). */
async function myWriter(ring: Ring, areaId: string): Promise<string> {
  const { members } = await loadMembers(areaId);
  const mine = members.filter((m) => ring.has(m.roleId));
  const writer = mine.find((m) => m.capabilities.includes('admin')) ?? mine.find((m) => m.capabilities.includes('write'));
  if (writer === undefined) throw new WorkspaceError('Żadna z Twoich ról nie pisze w tym obszarze.');
  return writer.roleId;
}

/* -- Der Lauf ---------------------------------------------------------------------------- */

export type StepState = 'running' | 'done' | 'failed';

export interface AreaRunHooks {
  readonly stage: (what: string) => void;
  /** Ein Schritt des Plans beginnt, ist fertig — oder brach ab. */
  readonly step: (key: PlanStep['key'], state: StepState) => void;
  readonly uploading?: (busy: boolean) => void;
  /** Eine Datei vom Gerät ist jetzt eine Datei der Seite. */
  readonly uploaded?: (pageKey: string, needKey: string, choice: ImageChoice) => void;
}

export interface AreaRunResult {
  readonly lines: string[];
  readonly warnings: string[];
  /** Links, die eben entstanden — nur jetzt zu sehen. */
  readonly links: readonly { readonly name: string; readonly url: string }[];
}

const STEP_TITLE: Record<PlanStep['key'], string> = {
  profile: 'Profil', roles: 'Role', appointments: 'Terminy', pages: 'Formularze i strony', subforms: 'Podformularze',
  chats: 'Rozmowy', card: 'Wizytówka i profil', listings: 'Listy'
};

/** DER IMPORT — prüft noch einmal mit frischem Stand, dann Schritt für Schritt. */
export async function runAreaImport(input: {
  readonly who: Who;
  readonly areaId: string;
  readonly areaName: string;
  readonly doc: AreaDocument;
  readonly options: AreaImportOptions;
  /** Je Seite (ihr Schlüssel): die gewählten Dateien. */
  readonly imageFor: Readonly<Record<string, Readonly<Record<string, ImageChoice>>>>;
  readonly hooks: AreaRunHooks;
}): Promise<AreaRunResult> {
  const { who, areaId, areaName, doc, options, hooks } = input;
  const lines: string[] = [];
  const warnings: string[] = [];
  const links: { name: string; url: string }[] = [];

  hooks.stage('Sprawdzanie obszaru…');
  const held = await keysFor(who);
  let ring: Ring | null = held.ring;
  if (ring === null) throw new WorkspaceError('Najpierw podaj hasło — import pieczętuje w tej przeglądarce.');
  const person: SealedRole | null = held.graph.roles.find((r) => r.kind === 'person' && ring!.maySign(r.id)) ?? null;
  if (person === null) throw new WorkspaceError('To konto nie ma jeszcze osoby, która mogłaby to zrobić.');
  const keyRing = (): Ring => ring!;
  const personId = person.id;

  const base = normalisePath(options.base);
  const state = await loadAreaState({ areaId, areaName, ring, doc, base });
  const plan: AreaPlan = planArea(doc, state, options);
  if (plan.blocked !== null) throw new WorkspaceError(plan.blocked);
  warnings.push(...plan.warnings);

  /* Die Schlüssel: sofort im Buch, gespeichert am Ende jedes Schritts (und wenn er abbricht). */
  let rows: ImportKey[] = [...state.book.all];
  let book: KeyBook = state.book;
  const pending: { kind: ImportKeyKind; key: string; refId?: string | null; refText?: string | null; remove?: boolean }[] = [];
  const remember = (kind: ImportKeyKind, key: string, refId: string | null, refText: string | null = null) => {
    const was = book.get(kind, key);
    if (was !== undefined && was.refId === refId && was.refText === refText) return;
    pending.push({ kind, key, refId, refText });
    rows = [...rows.filter((r) => !(r.kind === kind && r.key === key)), { kind, key, refId, refText, updatedAt: new Date().toISOString() }];
    book = keyBook(rows);
  };
  const forget = (kind: ImportKeyKind, key: string) => {
    pending.push({ kind, key, remove: true });
    rows = rows.filter((r) => !(r.kind === kind && r.key === key));
    book = keyBook(rows);
  };
  const flush = async () => {
    while (pending.length > 0) {
      const chunk = pending.splice(0, 400);
      try {
        await saveImportKeys(areaId, chunk);
      } catch (e) {
        warnings.push(`Nie zapamiętano ${chunk.length} kluczy importu (${failure(e)}) — ponowny import może utworzyć to jeszcze raz.`);
      }
    }
  };

  /*
   * DIE FRAGEN EINES FORMULARS unter ihren Kennungen im Dokument („imie") — die Kennung einer
   * Frage beim Dienst entsteht erst beim Anlegen; ohne dieses Gedächtnis legte ein zweiter
   * Import dasselbe Dokument jede Frage noch einmal an.
   */
  const QUESTION_KEY = /^[a-z0-9][a-z0-9_-]{0,40}$/i;
  const knownQuestions = (ref: string | null | undefined): ReadonlyMap<string, string> | undefined => {
    if (ref == null) return undefined;
    const out = new Map<string, string>();
    for (const k of book.all) if (k.kind === 'question' && k.refId !== null && k.key.startsWith(`${ref}#`)) out.set(k.key.slice(ref.length + 1), k.refId);
    return out.size === 0 ? undefined : out;
  };
  const rememberQuestions = (ref: string, ids: ReadonlyMap<string, string>) => {
    for (const [docId, fieldId] of ids) {
      if (!QUESTION_KEY.test(docId) || isUuid(docId) || `${ref}#${docId}`.length > 120) continue;
      remember('question', `${ref}#${docId}`, fieldId);
    }
  };

  const done: string[] = [];
  const step = async (key: PlanStep['key'], run: () => Promise<void>) => {
    hooks.step(key, 'running');
    try {
      await run();
      hooks.step(key, 'done');
      done.push(STEP_TITLE[key]);
    } catch (e) {
      hooks.step(key, 'failed');
      throw new WorkspaceError(`Krok „${STEP_TITLE[key]}” przerwany: ${failure(e)}.${done.length > 0 ? ` Zrobione wcześniej (${done.join(', ')}) zostaje.` : ''} Popraw i zaimportuj jeszcze raz — import trafi w to samo.`);
    } finally {
      await flush();
    }
  };

  /* Wohin ein Stück geht — nur in einen Bereich, den ich führe (sonst in den Bereich selbst). */
  const leads = (id: string) => id === areaId || state.areas.some((a) => a.areaId === id && a.myLevel === 'admin');
  const targetOf = (say: PublishSay | undefined): string => {
    const id = publishTarget(say, plan.publishAreaId, state.areas, areaId);
    return leads(id) ? id : areaId;
  };
  const nameOf = (id: string) => (id === areaId ? 'tym obszarze' : `„${state.areas.find((a) => a.areaId === id)?.name ?? 'obszar'}”`);

  /* 1 — das Profil (die Art zuerst: dann versteckt der Dienst die Seite danach von Anfang an). */
  await step('profile', async () => {
    hooks.stage('Profil obszaru…');
    const patch: { -readonly [K in keyof ProfilePatch]?: ProfilePatch[K] } = {
      publishAreaId: plan.publishAreaId === areaId ? '' : plan.publishAreaId
    };
    if (doc.kind !== undefined) patch.kind = doc.kind;
    if (doc.category !== undefined) patch.category = doc.category ?? '';
    if (doc.archive !== undefined) patch.archiveMode = doc.archive;
    await saveProfile(areaId, patch);
    lines.push(`Profil zapisany — publiczne części w ${nameOf(plan.publishAreaId)}.`);
  });

  /* 2 — Rollen und ihre Links. */
  const roleIds = new Map<string, string>();
  for (const r of plan.roles) if (r.roleId !== null) roleIds.set(r.doc.key, r.roleId);
  if (plan.roles.length > 0) {
    await step('roles', async () => {
      let made = 0;
      for (const r of plan.roles) {
        let roleId = r.roleId;
        if (roleId === null) {
          try {
            hooks.stage(`Rola „${r.doc.name}”: liczenie kluczy…`);
            const created = await createCommonRole(keyRing(), person, { name: r.doc.name, areas: [{ areaId, capability: r.doc.level }] }, hooks.stage);
            ring = created.ring;
            roleId = created.roleId;
            remember('role', r.doc.key, roleId);
            made += 1;
            /* Der Name auch im Bereich — damit ihn die anderen Prowadzący lesen. */
            try {
              const by = await myWriter(keyRing(), areaId);
              await setMemberName(areaId, await areaKeys(keyRing(), areaId, true), roleId, r.doc.name, by);
            } catch { /* ohne Namen im Bereich — die Rolle selbst steht */ }
          } catch (e) {
            warnings.push(`Rola „${r.doc.name}”: ${failure(e)} — pominięta (i jej link).`);
            continue;
          }
        }
        /* Die gleichnamige Rolle des Bereichs: ab jetzt unter ihrem Schlüssel. */
        if (r.adopted === true) remember('role', r.doc.key, roleId);
        roleIds.set(r.doc.key, roleId);
        if (r.doc.link !== null && !r.linkMade) {
          try {
            hooks.stage(`Link dla „${r.doc.name}”…`);
            /* Wie im Reiter der Art: wer in einem Wydarzenie nur liest, landet auf seiner Hauptseite — sonst im Widok obszaru. */
            const mainPlanned = plan.pages.find((p) => p.doc.main && p.problem === null)?.path ?? null;
            const aim = aimOf(doc.kind === 'event' && r.doc.level === 'read' && mainPlanned !== null ? pagePath(mainPlanned) : viewPath('areas', areaId));
            const link = await createLink(keyRing(), person, {
              label: r.doc.link.label ?? r.doc.name, roles: [{ roleId, lead: r.doc.link.lead }],
              once: r.doc.link.once, expiresDays: r.doc.link.days, aim: 'aim' in aim ? aim.aim : null
            }, hooks.stage);
            remember('link', r.doc.key, link.invitationId);
            links.push({ name: r.doc.name, url: link.url });
          } catch (e) {
            warnings.push(`Link dla „${r.doc.name}”: ${failure(e)}.`);
          }
        }
      }
      lines.push(`Role: nowe — ${made}, już były — ${plan.roles.length - made}${links.length > 0 ? `; linki — ${links.length} (niżej)` : ''}.`);
    });
  }

  /* 3 — Termine: das Ganze vor seinen Teilen, im Kalender des Bereichs. */
  const itemIds = new Map<string, string>();
  const refItems = new Map<string, string>();
  let calendarId: string | null = null;
  let mainItemId: string | null = null;
  if (plan.items.length > 0 || plan.dropItems.length > 0) {
    await step('appointments', async () => {
      hooks.stage('Kalendarz obszaru…');
      calendarId = (await createCalendar({ areaId, title: areaName, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })).calendarId;

      /* Was es von früheren Importen noch gibt — der Baum jedes Termins (und je Ganzem seine Teile der Reihe nach). */
      const alive = new Set<string>();
      const childrenOf = new Map<string, string[]>();
      /* Der Kalender, in dem ein Termin steht — ein Ändern nennt ihn (sonst zöge er in den Kalender des Bereichs, der ihn zeigt). */
      const calendarOf = new Map<string, string>();
      for (const top of plan.items.filter((i) => i.parentKey === null && i.itemId !== null)) {
        try {
          const tree = await loadProgram(top.itemId!);
          for (const row of tree.items) { alive.add(row.itemId); calendarOf.set(row.itemId, tree.calendarId); }
          for (const row of [...tree.items].sort(byPlace)) {
            if (row.parentItemId === null) continue;
            childrenOf.set(row.parentItemId, [...(childrenOf.get(row.parentItemId) ?? []), row.itemId]);
          }
        } catch { /* gelöscht — er entsteht neu */ }
      }
      /* Ein übernommener Haupttermin (ohne Schlüssel): seine Punkte nach ihrer Stelle — wenn keiner sie schon unter einem Schlüssel hat. */
      const keyed = new Set(book.all.filter((k) => k.kind === 'appointment' && k.refId !== null).map((k) => k.refId!));
      const adoptedKeys = new Set(plan.items.filter((i) => i.adopted === true).map((i) => i.importKey));

      let created = 0;
      let changed = 0;
      for (const it of plan.items) {
        const parent = it.parentKey === null ? null : itemIds.get(it.parentKey) ?? null;
        if (it.parentKey !== null && parent === null) continue;
        const one: AppointmentDoc = it.doc;
        const draft: EventDraft = {
          title: one.title, location: one.location, notes: one.notes, link: one.link, linkLabel: one.linkLabel,
          areaId: it.visibilityAreaId, ownerRoleId: person.id,
          date: one.date, time: one.time, minutes: one.minutes, allDay: one.allDay,
          repeat: one.repeat, every: one.every, weekdays: one.weekdays, until: one.until, count: null,
          ...(it.parentKey === null ? {} : { parentItemId: parent, position: it.position })
        };
        hooks.stage(`Kalendarz: „${one.title}”…`);
        let existing = it.itemId;
        if (existing === null && parent !== null && it.parentKey !== null && adoptedKeys.has(it.parentKey)) {
          const at = (childrenOf.get(parent) ?? [])[(it.position ?? 0) - 1];
          if (at !== undefined && !keyed.has(at)) { existing = at; keyed.add(at); adoptedKeys.add(it.importKey); }
        }
        try {
          let id: string;
          if (existing !== null && alive.has(existing)) {
            id = await saveEvent(keyRing(), { ...draft, calendarId: calendarOf.get(existing) ?? calendarId! }, existing);
            changed += 1;
          } else {
            id = await saveEvent(keyRing(), { ...draft, calendarId: calendarId! });
            created += 1;
          }
          /* Auch ein übernommener Termin steht ab jetzt unter seinem Schlüssel. */
          remember('appointment', it.importKey, id);
          itemIds.set(it.importKey, id);
          if (one.key !== null) refItems.set(one.key, id);
          if (it.main) mainItemId = id;
        } catch (e) {
          warnings.push(`„${one.title}” nie trafił do kalendarza: ${failure(e)}${one.points.length > 0 ? ' (razem z programem)' : ''}.`);
        }
      }
      let dropped = 0;
      for (const k of plan.dropItems) {
        if (k.refId !== null) {
          try { await deleteEvent(k.refId); dropped += 1; } catch { /* schon fort */ }
        }
        forget('appointment', k.key);
      }
      lines.push(`Terminy: nowe — ${created}, zmienione — ${changed}${dropped > 0 ? `, usunięte punkty programu — ${dropped}` : ''}.`);
    });
  }

  /* 4 — erst ALLE Formulare (dann zeigen Verweise jeder Seite auf jedes), dann die Seiten. */
  const formModules = new Map<string, { moduleId: string; isNew: boolean }>();
  const formIds = new Map<string, string>();
  const subformIds = new Map<string, { moduleId: string; isNew: boolean }>();
  const missing = new Set<string>();
  /* „Napisz do nas" auf den Seiten: eingerichtet, wenn alle Seiten stehen (dann gibt es jedes Formular). */
  const asks: { moduleId: string; ask: AskWant; label: string }[] = [];
  let mainPath: string | null = null;
  let afterPath: string | null = null;
  let cardImageId: string | null = null;
  const cardNeed = typeof doc.card?.image === 'string' && doc.card.image.startsWith(NEED_PREFIX) ? doc.card.image.slice(NEED_PREFIX.length) : null;

  /** Die Fragen dorthin, wo sie veröffentlicht werden — vor dem Schreiben neuer Fragen (die dann gleich dort liegen). */
  const placeQuestions = async (moduleId: string, say: PublishSay | undefined, name: string, row: ModuleRow | null) => {
    const target = targetOf(say);
    const now = row === null ? areaId : questionsAreaOf(row) ?? areaId;
    if (target === now) return;
    hooks.stage(`Pytania „${name}” w ${nameOf(target)}…`);
    try {
      await moveQuestions(keyRing(), moduleId, target === areaId ? null : target);
      lines.push(`Formularz „${name}”: pytania w ${nameOf(target)}, odpowiedzi w tym obszarze.`);
    } catch (e) {
      warnings.push(`Formularz „${name}”: pytania zostały w ${nameOf(now)} (${failure(e)}) — zmienisz to w ustawieniach formularza.`);
    }
  };

  const usable = plan.pages.filter((p) => p.problem === null);
  if (usable.length > 0 || plan.subforms.length > 0) {
    await step('pages', async () => {
      const modules = await loadModules().then((r) => r.modules, () => state.modules);
      for (const p of usable) {
        const load = state.pages.get(p.path);
        const now = load?.state === 'page' ? load.now.parts : [];
        for (const f of formsOf(p.doc, now, book)) {
          let moduleId = existingFormModule(f.ref, now, book, modules);
          let isNew = false;
          try {
            if (moduleId === null) {
              moduleId = newId();
              hooks.stage(`Formularz „${f.name}”…`);
              await createModule(moduleId, 'form', f.name, areaId, 'person');
              isNew = true;
              remember('form', f.ref, moduleId);
            }
            formModules.set(f.ref, { moduleId, isNew });
            formIds.set(f.ref, moduleId);
            await placeQuestions(moduleId, f.publish, f.name, isNew ? null : modules.find((m) => m.moduleId === moduleId) ?? null);
          } catch (e) {
            warnings.push(`Formularz „${f.name}” (${f.ref}): ${failure(e)}.`);
          }
        }
      }
      /* Unterformulare: ihr Modul jetzt (Verweise zeigen auf sie), ihr Inhalt später. */
      for (const s of plan.subforms) {
        const parent = formIds.get(s.doc.of) ?? s.parentModuleId;
        if (parent === null) continue;
        let moduleId = s.moduleId;
        let isNew = false;
        try {
          if (moduleId === null) {
            moduleId = newId();
            hooks.stage(`Podformularz „${s.doc.name}”…`);
            await createModule(moduleId, 'form', s.doc.name, areaId, 'person', undefined, {
              extendsId: parent, audience: s.doc.audience, ...(s.doc.wish.repeat === undefined ? {} : { repeat: s.doc.wish.repeat })
            });
            isNew = true;
            remember('form', s.doc.key, moduleId);
          }
          subformIds.set(s.doc.key, { moduleId, isNew });
          formIds.set(s.doc.key, moduleId);
        } catch (e) {
          warnings.push(`Podformularz „${s.doc.name}”: ${failure(e)} — pominięty.`);
        }
      }
      const pages = new Map(usable.map((p) => [p.doc.key, p.path] as const));
      const ids: RefIds = { areaId, calendarId, items: refItems, forms: formIds, pages, roles: roleIds };
      let made = 0;
      for (const p of usable) {
        const result = await importPage(p, ids);
        if (result === 'made') made += 1;
      }
      lines.push(`Strony: ${usable.length}${made > 0 ? ` (nowe — ${made})` : ''}.`);
      for (const one of asks) await setUpAsk(one.moduleId, one.ask, one.label);
    });
  }

  /**
   * „NAPISZ DO NAS" EINRICHTEN: sein Bereich der Antwortenden IM Bereich (dessen Administrator
   * danych gilt), darin die Rollen aus "answer", daran die Formulare aus "forms" — wie im Reiter
   * der Art. Was es schon gibt, bleibt; es kommt nur hinzu, was fehlt.
   */
  async function setUpAsk(moduleId: string, ask: AskWant, label: string): Promise<void> {
    const where = `${label}: „Napisz do nas”`;
    const answer = ask.answer.length > 0 ? ask.answer : doc.roles.filter((r) => r.level === 'admin').map((r) => r.key);
    const forms = ask.forms ?? [...formModules.keys()];
    try {
      const row = (await loadModules()).modules.find((m) => m.moduleId === moduleId);
      let answerArea = row?.areaId ?? null;
      if (answerArea === null) {
        const named = answer.map((k) => doc.roles.find((r) => r.key === k)?.name).filter((n): n is string => n !== undefined);
        hooks.stage(`${where}: kto odpowiada…`);
        const made = await createArea(keyRing(), person!, (named.join(', ') || 'Organizatorzy').slice(0, 200), areaId);
        await updateModule(moduleId, { areaId: made.areaId });
        answerArea = made.areaId;
      }
      const [inside, here] = await Promise.all([
        loadMembers(answerArea).then((r) => r.members, () => []),
        loadMembers(areaId).then((r) => r.members, () => [])
      ]);
      for (const key of answer) {
        const roleId = roleIds.get(key);
        if (roleId === undefined) { warnings.push(`${where}: roli „${key}” nie ma w dokumencie ani w obszarze — pominięta.`); continue; }
        if (inside.some((m) => m.roleId === roleId)) continue;
        const member = here.find((m) => m.roleId === roleId);
        if (member === undefined) { warnings.push(`${where}: rola „${key}” nie jest jeszcze w obszarze — dodasz ją w edytorze strony.`); continue; }
        await joinArea(keyRing(), answerArea, { id: roleId, kind: 'group', wrapPublicKey: member.wrapPublicKey }, personId, 'write')
          .catch((e: unknown) => { warnings.push(`${where}: rola „${key}” nie dodana (${failure(e)}).`); });
      }
      let linked = 0;
      for (const ref of forms) {
        const formId = formIds.get(ref);
        if (formId === undefined) { warnings.push(`${where}: formularza „${ref}” nie ma w dokumencie ani w obszarze — pominięty.`); continue; }
        await linkAudienceForm('module', moduleId, formId, true, personId).then(() => { linked += 1; },
          (e: unknown) => { warnings.push(`${where}: zapisanych z „${ref}” nie dołączono (${failure(e)}).`); });
      }
      lines.push(`${where}: odpowiadają ${answer.length > 0 ? answer.map((k) => `„${doc.roles.find((r) => r.key === k)?.name ?? k}”`).join(', ') : 'Ty'}${linked > 0 ? `; piszą zapisani z ${linked} ${linked === 1 ? 'formularza' : 'formularzy'}` : ''}.`);
    } catch (e) {
      warnings.push(`${where}: ${failure(e)} — ustawisz to w edytorze strony.`);
    }
  }

  /** Eine Seite: anlegen, wem sie gehört, wer sie sieht — dann der Import der Seite selbst. */
  async function importPage(p: PlannedPage, ids: RefIds): Promise<'made' | 'kept' | 'skipped'> {
    const label = `Strona „${p.doc.key}” (${p.path})`;
    hooks.stage(`${label}…`);
    let made = false;
    if (!p.exists) {
      try {
        await openSubpage(p.path, personId, `Import obszaru „${areaName}”`.slice(0, 200));
        made = true;
      } catch (e) {
        warnings.push(`${label}: ${failure(e)} — pominięta.`);
        return 'skipped';
      }
    }
    remember('page', p.doc.key, null, p.path);
    if (p.doc.main) mainPath = p.path;
    if (p.doc.after) {
      afterPath = p.path;
      /* Sofort: dann zeigt der Dienst sie erst nach dem Ende. */
      await saveProfile(areaId, { afterPath: p.path }).catch((e: unknown) => {
        warnings.push(`${label}: nie oznaczono jej jako „po wydarzeniu” (${failure(e)}) — do końca wydarzenia może być widoczna.`);
      });
    }

    /* Wer sie sieht. */
    const bound = state.desk.find((c) => c.path === p.path)?.accessAreaIds ?? [];
    let isPublic = bound.length === 0;
    try {
      if (p.doc.access === 'members' && !bound.includes(areaId)) {
        await setPageAreas(p.path, [...bound, areaId]);
        lines.push(`${label}: tylko dla osób obszaru.`);
        isPublic = false;
      } else if (p.doc.access === 'public' && bound.length > 0) {
        await setPageAreas(p.path, []);
        lines.push(`${label}: publiczna.`);
        isPublic = true;
      }
    } catch (e) {
      warnings.push(`${label}: dostęp nie zmieniony (${failure(e)}).`);
    }

    /* Wer für eine öffentliche Seite geradesteht: dieser Bereich (sein Administrator danych). */
    const loaded = await loadPageState(p.path);
    const responsible = loaded.state === 'page' ? loaded.responsibleAreaId : undefined;
    if (isPublic && state.profile.controller !== null && responsible !== areaId) {
      try {
        await setPageController(p.path, areaId);
      } catch (e) {
        warnings.push(`${label}: nie wskazano obszaru jako odpowiedzialnego za stronę (${failure(e)}).`);
      }
    }

    const now = loaded.state === 'page' ? loaded.now : blankPage(p.path);
    const prep = preparePage({
      page: p.doc, now, book, ids, formModules, newId,
      cardImage: p.doc.main && cardNeed !== null ? `${NEED_PREFIX}${cardNeed}` : null,
      fallbackTitle: p.doc.main ? (doc.card?.title ?? areaName) : areaName
    });
    warnings.push(...prep.warnings);
    for (const token of prep.missing) missing.add(`${label}\u0000${token}`);
    /* Je Formular dieser Seite sein Name im Bereich („main/zapisy") — für seine Fragen. */
    const refOfModule = new Map(prep.entries.filter((e) => e.form !== null).map((e) => [e.form!.moduleId, e.ref] as const));
    try {
      const result = await runPageImport({
        who, now: prep.now, doc: prep.doc,
        options: { replace: options.replaceModules, copyModules: false, legacyPage: 0, takeTheme: true },
        choices: {
          replaceQuestions: options.replaceQuestions, answersTo: areaId, calendarFor: {}, imageFor: input.imageFor[p.doc.key] ?? {},
          knownQuestions: (moduleId) => knownQuestions(refOfModule.get(moduleId)), questionsByLabel: true
        },
        hooks: {
          stage: hooks.stage, uploading: hooks.uploading,
          uploaded: (key, choice) => hooks.uploaded?.(p.doc.key, key, choice),
          adjust: (planned) => adjustPagePlan(planned, prep, areaId, options.replaceModules, now.parts)
        }
      });
      lines.push(`${label}${made ? ' — nowa' : ''}:`, ...result.lines.map((line) => `   ${line.startsWith('Moduły: zmienione w miejscu') ? moduleLine(prep, options.replaceModules, now.parts) : line}`));
      warnings.push(...result.warnings.map((w) => `${label}: ${w}`));
      for (const [moduleId, ids] of result.questions) {
        const ref = refOfModule.get(moduleId) ?? prep.entries.find((e) => result.moduleOf.get(e.partId) === moduleId)?.ref;
        if (ref !== undefined) rememberQuestions(ref, ids);
      }
      for (const e of prep.entries) {
        if (!result.parts.some((x) => x.id === e.partId)) continue;
        remember('page', e.ref, e.partId);
        if (e.form !== null) remember('form', e.ref, result.moduleOf.get(e.partId) ?? e.form.moduleId);
        if (e.ask !== null) asks.push({ moduleId: result.moduleOf.get(e.partId) ?? e.partId, ask: e.ask, label });
      }
      if (p.doc.main && cardNeed !== null) {
        const ref = result.images.get(cardNeed);
        if (ref !== undefined) cardImageId = ref.slice('page-image:'.length);
      }
    } catch (e) {
      warnings.push(`${label}: ${failure(e)} — treść strony nie zapisana.`);
      return made ? 'made' : 'skipped';
    }
    return made ? 'made' : 'kept';
  }

  /* 5 — der Inhalt der Unterformulare. */
  if (subformIds.size > 0) {
    await step('subforms', async () => {
      const modules = await loadModules().then((r) => r.modules, () => [] as readonly ModuleRow[]);
      const ids: RefIds = { areaId, calendarId, items: refItems, forms: formIds, pages: new Map(), roles: roleIds };
      for (const s of plan.subforms) {
        const made = subformIds.get(s.doc.key);
        if (made === undefined) continue;
        const row = modules.find((m) => m.moduleId === made.moduleId);
        if (row === undefined) { warnings.push(`Podformularz „${s.doc.name}”: nie widać go na liście modułów — pominięty.`); continue; }
        await placeQuestions(made.moduleId, s.doc.publish, s.doc.name, made.isNew ? null : row);
        const said = new Set<string>();
        const resolved = resolveRoleRefs(resolveTokens(s.doc.raw, ids, said) as Record<string, unknown>, ids, said);
        for (const token of said) missing.add(`Podformularz „${s.doc.name}”\u0000${token}`);
        const questions = Array.isArray(resolved.questions)
          ? resolved.questions.map((q) => {
            if (q === null || typeof q !== 'object' || Array.isArray(q)) return q;
            const { answersTo: _gone, ...rest } = q as Record<string, unknown>;
            return rest;
          })
          : resolved.questions;
        const { config: _config, ...wish } = readModuleWish({ ...resolved, questions, name: s.doc.name });
        try {
          const applied = await applyModuleWish(who, row, wish, {
            replace: options.replaceQuestions, answersTo: areaId, stage: hooks.stage, known: knownQuestions(s.doc.key), byLabel: true
          });
          rememberQuestions(s.doc.key, applied.ids);
          lines.push(`Podformularz „${s.doc.name}”${made.isNew ? ' (nowy)' : ''}: ${applied.lines.join(' ') || 'bez zmian.'}`);
          warnings.push(...applied.warnings.map((w) => `Podformularz „${s.doc.name}”: ${w}`));
        } catch (e) {
          warnings.push(`Podformularz „${s.doc.name}”: ${failure(e)}.`);
        }
      }
    });
  }

  /* 6 — Rozmowy (die eines Bereichs gibt es je einmal: eine vorhandene wird genommen). */
  if (doc.chats !== undefined && doc.chats.length > 0) {
    await step('chats', async () => {
      let writer: string;
      try {
        writer = await myWriter(keyRing(), areaId);
      } catch (e) {
        warnings.push(`Rozmowy: ${failure(e)} — pominięte.`);
        return;
      }
      for (const c of doc.chats!) {
        const label = c.kind === 'area' ? 'Rozmowa obszaru' : 'Kanał ogłoszeń';
        try {
          hooks.stage(`${label}…`);
          const chatId = await startAreaChat(areaId, writer, c.kind === 'channel');
          remember('chat', c.kind, chatId);
          const joined = await joinForms(chatId, c.forms.map((ref) => ({ ref, moduleId: formIds.get(ref) ?? null })), writer);
          warnings.push(...joined.warnings.map((w) => `${label}: ${w}`));
          lines.push(`${label}: jest${joined.linked > 0 ? `; dołączeni zapisani z ${joined.linked} ${joined.linked === 1 ? 'formularza' : 'formularzy'}` : ''}.`);
        } catch (e) {
          warnings.push(`${label}: ${failure(e)}.`);
        }
      }
    });
  }

  /* 7 — die Wizytówka und was das Profil zeigt: Hauptseite, Seite danach, Haupttermin, Bild. */
  {
    const patch: { -readonly [K in keyof ProfilePatch]?: ProfilePatch[K] } = {};
    if (mainPath !== null) patch.path = mainPath;
    if (afterPath !== null) patch.afterPath = afterPath;
    if (mainItemId !== null) patch.itemId = mainItemId;
    if (doc.card !== undefined || Object.keys(patch).length > 0) {
      await step('card', async () => {
        if (doc.card === null) patch.card = { sealed: '' };
        else if (doc.card !== undefined) {
          const at = targetOf(doc.card.publish);
          hooks.stage('Pieczętowanie wizytówki…');
          patch.card = await sealCard(keyRing(), areaId, at, { title: doc.card.title, lead: doc.card.lead });
          if (doc.card.image === null) patch.imageId = '';
          else if (typeof doc.card.image === 'string') {
            const id = cardNeed !== null ? cardImageId : doc.card.image.slice('page-image:'.length);
            if (id !== null && id !== '') patch.imageId = id;
            else warnings.push('Zdjęcie wizytówki: nie dodano pliku — wybierzesz je w ustawieniach obszaru.');
          }
          lines.push(`Wizytówka „${doc.card.title}” — w ${nameOf(at)}.`);
        }
        hooks.stage('Profil: strony i termin…');
        await saveProfile(areaId, patch);
        if (mainPath !== null) lines.push(`Strona główna: ${mainPath}.`);
        if (afterPath !== null) lines.push(`Strona „po wydarzeniu”: ${afterPath} — pokaże się po zakończeniu.`);
        if (mainItemId !== null) lines.push('Główny termin ustawiony.');
      });
    }
  }

  /* 8 — Listen, in denen es stehen will (eine Bitte je Liste, einmal). */
  if (doc.listings.length > 0) {
    await step('listings', async () => {
      const had = await loadListings(areaId).then((r) => r.listings, () => []);
      for (const path of doc.listings) {
        const known = had.find((l) => l.path === path);
        if (known !== undefined) { lines.push(`Lista „${path}”: prośba już jest (${LISTING_WORDS[known.state]}).`); continue; }
        try {
          const asked = await askListing(areaId, { path });
          lines.push(`Lista „${path}”: ${LISTING_WORDS[asked.state]}${asked.catalogue ? ' (katalog — decyduje operator)' : ''}.`);
        } catch (e) {
          warnings.push(`Lista „${path}”: ${failure(e)}.`);
        }
      }
    });
  }

  for (const one of missing) {
    const [where, token] = one.split('\u0000');
    warnings.push(missingLine(where, token));
  }
  invalidate();
  refreshDesk();
  return { lines, warnings, links };
}
