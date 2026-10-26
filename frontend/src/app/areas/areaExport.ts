/**
 * 0133 — DER BEREICH ALS DOKUMENT („recreatio/area"): Profil und Wizytówka,
 * Rollen, Termine mit Programm, Seiten (mit Formularen), Unterformulare,
 * Rozmowy, Listen — so, wie ihn der Import wieder liest.
 *
 * <b>Keine Kennungen des Dienstes</b> für die Teile des Bereichs: Seiten,
 * Bausteine, Rollen, Termine heissen mit Schlüsseln, Verweise mit "@…"
 * (`areaJson.ts`). Was noch keinen Schlüssel hat (eine Seite von Hand, eine
 * Rolle von Hand), bekommt jetzt einen — und der Bereich merkt ihn sich: ein
 * Import desselben Dokuments ändert dann genau das, statt es zu verdoppeln.
 *
 * <b>Nichts Geheimes:</b> keine Links (ihr Geheimnis kennt nur, wer sie
 * anlegte), keine Zgłoszenia, keine Menschen — nur, was ein Prowadzący
 * ohnehin sieht und was ein Sprachmodell für das nächste Wydarzenie braucht.
 */

import { loadAgenda, type Series } from '../calendar/agenda';
import { loadProgram, openProgram, type ProgramNode } from '../calendar/program';
import { areaKeys, loadAreaNames, loadChats, openNames } from '../chat/chat';
import { keysFor } from '../core/ringOf';
import type { Who } from '../core/session';
import { loadListings } from '../events/events';
import { readFormContent, type FormContent } from '../forms/formJson';
import { memberRolesOf } from '../forms/formGroups';
import { loadModules, questionsAreaOf, readConfig, type ModuleRow } from '../modules/module';
import { loadMenu } from '../pages/menu';
import type { DraftPart } from '../pages/page';
import { exportModule, exportPage } from '../pages/pageJson';
import { loadRoleReach } from '../roles/commonRole';
import { loadDesk, type PageCard } from '../workspace/desk';
import { loadAudienceForms } from './audience';
import { loadMembers } from './area';
import { loadPageState } from './areaImport';
import {
  AREA_FORMAT, ASK_KIND, entryRef, freeKey, keyBook, keyFrom, PAGE_KEY, relativePath, tokenizeCalendarFields, tokenizePaths, tokenizeValues,
  type ExportIds, type KeyBook, type RoleLevel
} from './areaJson';
import { loadImportKeys, loadProfile, openCard, saveImportKeys, type ImportKeyKind } from './profile';

const two = (n: number) => String(n).padStart(2, '0');
const dayOf = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const clockOf = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}`;
const WEEKDAY_WORDS = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Beginn und Ende, wie das Dokument sie schreibt (Ortszeit; ganztägig: der letzte Tag einschliesslich). */
function whenOf(node: Pick<ProgramNode, 'start' | 'end' | 'allDay'>): { start: string; end: string; allDay?: true } {
  if (node.allDay) {
    const last = new Date(node.end.getTime() - 1);
    return { start: dayOf(node.start), end: dayOf(last) };
  }
  const sameDay = dayOf(node.start) === dayOf(node.end);
  return { start: `${dayOf(node.start)}T${clockOf(node.start)}`, end: sameDay ? clockOf(node.end) : `${dayOf(node.end)}T${clockOf(node.end)}` };
}

/** Die Wiederholung einer Reihe (sonst nichts). */
function repeatOf(series: Series | undefined, start: Date): Record<string, unknown> {
  if (series === undefined || series.repeatKind === 'none') return {};
  const out: Record<string, unknown> = { repeat: series.repeatKind };
  if (series.repeatEvery > 1) out.every = series.repeatEvery;
  if (series.repeatKind === 'weekly' && series.repeatWeekdays !== null) {
    out.weekdays = WEEKDAY_WORDS.filter((_, i) => (series.repeatWeekdays! & (1 << i)) !== 0);
  }
  if (series.repeatUntil !== null) {
    const until = new Date(series.repeatUntil);
    /* „Bez końca" steht im Kalender als zehn Jahre voraus — das schreibt das Dokument nicht. */
    if (!Number.isNaN(until.getTime()) && until.getTime() - start.getTime() < 9 * 365 * 86_400_000) out.until = series.repeatUntil.slice(0, 10);
  }
  return out;
}

/** DER EXPORT. `register`: Schlüssel, die es noch nicht gab, merkt sich der Bereich (wer in ihm schreibt). */
export async function exportArea(input: {
  readonly who: Who;
  readonly areaId: string;
  readonly areaName: string;
  readonly register: boolean;
}): Promise<{ doc: Record<string, unknown>; warnings: string[] }> {
  const { who, areaId } = input;
  const warnings: string[] = [];
  const { ring } = await keysFor(who);

  const [state, keyRows, desk, modules] = await Promise.all([
    loadProfile(areaId),
    loadImportKeys(areaId).then((r) => r.keys, () => []),
    loadDesk().then((d) => d.pages.filter((p) => p.aliasOf === null), () => [] as readonly PageCard[]),
    loadModules().then((r) => r.modules, () => [] as readonly ModuleRow[])
  ]);
  const profile = state.profile;
  const book: KeyBook = keyBook(keyRows);
  const fresh: { kind: ImportKeyKind; key: string; refId: string | null; refText: string | null }[] = [];
  const taken = new Map<ImportKeyKind, Set<string>>();
  const takenOf = (kind: ImportKeyKind) => {
    let set = taken.get(kind);
    if (set === undefined) { set = new Set(keyRows.filter((k) => k.kind === kind).map((k) => k.key)); taken.set(kind, set); }
    return set;
  };
  /** Ein Schlüssel für ein Stück: der gemerkte, sonst ein neuer (und der Bereich merkt ihn sich). */
  const claim = (kind: ImportKeyKind, wanted: string, refId: string | null, refText: string | null = null, max = 32): string => {
    const key = freeKey(wanted, takenOf(kind), max);
    takenOf(kind).add(key);
    fresh.push({ kind, key, refId, refText });
    return key;
  };

  /* Wohin standardmässig veröffentlicht wird. */
  const publishArea = profile?.publishAreaId ?? null;
  const publishOf = (id: string | null): Record<string, unknown> => {
    const at = id ?? areaId;
    const def = publishArea ?? areaId;
    if (at === def) return {};
    return { publish: at === areaId ? 'area' : at };
  };

  /* -- Rollen ------------------------------------------------------------------------ */
  const roleKeys = new Map<string, string>();
  const roles: Record<string, unknown>[] = [];
  {
    const [members, reach, sealedNames] = await Promise.all([
      loadMembers(areaId).then((r) => r.members, () => []),
      loadRoleReach().then((r) => r.roles, () => []),
      loadAreaNames(areaId).then((r) => r.names, () => [])
    ]);
    let names = new Map<string, string>();
    if (ring !== null && sealedNames.length > 0) {
      try { names = await openNames(await areaKeys(ring, areaId), areaId, sealedNames); } catch { /* ohne Namen im Bereich */ }
    }
    const linkRoles = new Set(reach.filter((r) => r.link).map((r) => r.roleId));
    for (const m of members) {
      if (m.kind !== 'group' || linkRoles.has(m.roleId)) continue;
      const name = names.get(m.roleId) ?? (ring !== null && ring.has(m.roleId) ? await ring.name(m.roleId).catch(() => null) : null);
      if (name === null || name.startsWith('Link: ')) continue;
      const level: RoleLevel = m.capabilities.includes('admin') ? 'admin' : m.capabilities.includes('write') ? 'write' : 'read';
      const known = book.keyOf('role', m.roleId);
      const key = known?.key ?? claim('role', keyFrom(name), m.roleId);
      roleKeys.set(m.roleId, key);
      roles.push({ key, name, level, ...(book.get('link', key) === undefined ? {} : { link: true }) });
    }
  }

  /* -- Seiten (zuerst gelesen: ihre Bausteine nennen Termine, und Termine brauchen Namen) ---- */
  const mainPath = profile?.main?.path ?? null;
  const afterPath = profile?.after?.path ?? null;
  const keyedPages = keyRows.filter((k) => k.kind === 'page' && !k.key.includes('/') && k.refText !== null);
  const paths: string[] = [];
  const addPath = (path: string | null) => { if (path !== null && path !== '' && !paths.includes(path)) paths.push(path); };
  addPath(mainPath);
  addPath(afterPath);
  for (const k of keyedPages) addPath(k.refText);
  /*
   * Die Unterseiten der Hauptseite nur, wenn sie diesem Bereich gehören — er steht für sie
   * gerade, oder nur seine Menschen sehen sie. Unter der Seite einer Parafia stehen die
   * Seiten ihrer Wydarzenia; die gehören deren Bereichen.
   */
  if (mainPath !== null) {
    for (const p of desk) {
      if (!p.path.startsWith(`${mainPath}/`) || paths.includes(p.path)) continue;
      if ((p.accessAreaIds ?? []).includes(areaId)) { addPath(p.path); continue; }
      const seen = await loadPageState(p.path);
      if (seen.state === 'page' && seen.responsibleAreaId === areaId) addPath(p.path);
    }
  }
  const base = mainPath ?? [...paths].sort((a, b) => a.length - b.length)[0] ?? '';

  const pageKeys = new Map<string, string>();
  for (const path of paths) {
    const known = keyedPages.find((k) => k.refText === path)?.key;
    const wanted = path === mainPath ? 'main' : path === afterPath ? 'po' : keyFrom(path.split('/').pop() ?? 'strona', 24);
    pageKeys.set(path, known ?? claim('page', PAGE_KEY.test(wanted) ? wanted : 'strona', null, path, 24));
  }

  const formRefs = new Map<string, string>();
  const areaForms = modules.filter((m) => m.kind === 'form' && m.areaId === areaId);
  const loadedPages: { path: string; key: string; doc: Record<string, unknown>; parts: Map<string, string> }[] = [];
  const pageDrafts = new Map<string, readonly DraftPart[]>();
  for (const path of paths) {
    const loaded = await loadPageState(path);
    if (loaded.state !== 'page') { warnings.push(`Strona ${path}: nie udało się jej odczytać — pominięta.`); continue; }
    const now = loaded.now;
    pageDrafts.set(path, now.parts);
    const pageKey = pageKeys.get(path)!;
    const menu = await loadMenu(path).catch(() => null);
    const names = new Map(modules.map((m) => [m.moduleId, m.name] as const));
    const forms = new Map<string, FormContent>();
    for (const part of now.parts.filter((p) => p.kind === 'form')) {
      const moduleId = part.moduleId ?? part.id;
      try { forms.set(moduleId, await readFormContent(who, moduleId)); } catch { warnings.push(`Strona ${path}: pytań formularza „${names.get(moduleId) ?? moduleId}” nie da się teraz odczytać — bez nich.`); }
    }
    /* Die Bausteine: der gemerkte Name, sonst einer nach Art und Reihenfolge. */
    const partKeys = new Map<string, string>();
    const usedKeys = new Set<string>();
    for (const part of now.parts) {
      const known = book.keyOf('page', part.id);
      if (known !== undefined && known.key.startsWith(`${pageKey}/`)) {
        const key = known.key.slice(pageKey.length + 1);
        if (!usedKeys.has(key)) { partKeys.set(part.id, key); usedKeys.add(key); }
      }
    }
    /* Ein neuer Name ist frei auf der Seite UND unter den gemerkten (ein alter Name einer gelöschten Stelle träfe sonst daneben). */
    const remembered = new Set(keyRows.filter((k) => k.kind === 'page' && k.key.startsWith(`${pageKey}/`)).map((k) => k.key.slice(pageKey.length + 1)));
    const counts = new Map<string, number>();
    for (const part of now.parts) {
      const n = (counts.get(part.kind) ?? 0) + 1;
      counts.set(part.kind, n);
      if (partKeys.has(part.id)) continue;
      const key = freeKey(keyFrom(`${part.kind}-${n}`), new Set([...usedKeys, ...remembered]));
      usedKeys.add(key);
      partKeys.set(part.id, key);
      fresh.push({ kind: 'page', key: entryRef(pageKey, key), refId: part.id, refText: null });
    }
    for (const part of now.parts.filter((p) => p.kind === 'form')) {
      const ref = entryRef(pageKey, partKeys.get(part.id)!);
      const moduleId = part.moduleId ?? part.id;
      if (!formRefs.has(moduleId)) formRefs.set(moduleId, ref);
      if (book.get('form', ref)?.refId !== moduleId) fresh.push({ kind: 'form', key: ref, refId: moduleId, refText: null });
    }
    const exported = exportPage({ ...now, menu, names, forms });
    loadedPages.push({ path, key: pageKey, doc: exported, parts: partKeys });
  }

  /* -- „Napisz do nas": wer antwortet (Rollen des Bereichs) und wessen Menschen schreiben (Formulare) ---- */
  const asks = new Map<string, { answer: string[]; forms: string[] }>();
  for (const drafts of pageDrafts.values()) {
    for (const part of drafts.filter((p) => p.kind === ASK_KIND)) {
      const moduleId = part.moduleId ?? part.id;
      const row = modules.find((m) => m.moduleId === moduleId);
      const answer: string[] = [];
      if (row?.areaId != null) {
        for (const m of await loadMembers(row.areaId).then((r) => r.members, () => [])) {
          const key = roleKeys.get(m.roleId);
          if (key !== undefined && !answer.includes(`@role:${key}`)) answer.push(`@role:${key}`);
        }
      }
      const attached = await loadAudienceForms('module', moduleId).then((r) => r.forms, () => []);
      const forms = attached.map((f) => formRefs.get(f.moduleId)).filter((r): r is string => r !== undefined).map((r) => `@form:${r}`);
      asks.set(part.id, { answer, forms });
    }
  }

  /* -- Termine: was ein Import anlegte, der Haupttermin, und was der Kalender des Bereichs hat ---- */
  const itemKeys = new Map<string, string>();
  const appointments: Record<string, unknown>[] = [];
  {
    const tops: string[] = [];
    const addTop = (id: string | null) => { if (id !== null && !tops.includes(id)) tops.push(id); };
    addTop(profile?.itemId ?? null);
    for (const k of keyRows) if (k.kind === 'appointment' && !k.key.includes('/')) addTop(k.refId);
    const now = Date.now();
    const series = new Map<string, Series>();
    try {
      const agenda = await loadAgenda(new Date(now - 60 * 86_400_000), new Date(now + 339 * 86_400_000));
      for (const o of agenda.occurrences) {
        if (o.areaId !== areaId) continue;
        if (!series.has(o.itemId)) series.set(o.itemId, o.series);
        if ((o.parentItemId ?? null) === null) addTop(o.itemId);
      }
    } catch { /* ohne die übrigen Termine des Kalenders */ }

    const usedKeys = new Set(keyRows.filter((k) => k.kind === 'appointment').map((k) => k.key.split('/')[0]));
    for (const id of tops) {
      let node: ProgramNode | null = null;
      let visibility: string | null = null;
      try {
        const tree = await loadProgram(id);
        node = await openProgram(tree.items, ring);
        visibility = tree.items.find((r) => r.itemId === id)?.visibilityAreaId ?? null;
      } catch { /* nicht mehr da, oder nicht lesbar */ }
      if (node === null) continue;
      const known = book.keyOf('appointment', id);
      const isMain = id === (profile?.itemId ?? null);
      const key = known !== undefined && !known.key.includes('/') ? known.key
        : claim('appointment', freeKey(isMain ? 'main' : keyFrom(node.title, 40), usedKeys, 41), id, null, 41);
      usedKeys.add(key);
      itemKeys.set(id, key);
      const point = (one: ProgramNode, importKey: string): Record<string, unknown> => {
        const children = one.children.map((child, i) => {
          const childKey = `${importKey}/${i + 1}`;
          if (book.get('appointment', childKey)?.refId !== child.itemId) fresh.push({ kind: 'appointment', key: childKey, refId: child.itemId, refText: null });
          return point(child, childKey);
        });
        return {
          title: one.title, ...whenOf(one),
          ...(one.location === null ? {} : { location: one.location }),
          ...(one.notes === null ? {} : { notes: one.notes }),
          ...(one.link === null ? {} : { link: one.link, ...(one.linkLabel === null ? {} : { linkLabel: one.linkLabel }) }),
          ...(children.length === 0 ? {} : { points: children })
        };
      };
      appointments.push({
        key, ...(isMain ? { main: true } : {}),
        ...point(node, key),
        ...repeatOf(series.get(id), node.start),
        ...publishOf(visibility)
      });
    }
    /* Punkte, auf die ein Baustein zeigt, brauchen einen Namen ("@main-2"). */
    const referenced = new Set<string>();
    for (const page of loadedPages) {
      for (const m of Array.isArray(page.doc.modules) ? page.doc.modules : []) {
        if (!isRecord(m) || !isRecord(m.config)) continue;
        for (const v of Object.values(m.config)) if (typeof v === 'string') for (const t of v.split(',')) referenced.add(t.trim());
      }
    }
    const nameAt = (list: unknown, prefix: string) => {
      if (!Array.isArray(list)) return;
      list.forEach((p, i) => {
        if (!isRecord(p)) return;
        const importKey = `${prefix}/${i + 1}`;
        const id = [...keyRows, ...fresh].find((k) => k.kind === 'appointment' && k.key === importKey)?.refId ?? null;
        if (id !== null && referenced.has(id) && !itemKeys.has(id)) {
          p.key = importKey.replace(/\//g, '-');
          itemKeys.set(id, String(p.key));
        }
        nameAt(p.points, importKey);
      });
    };
    for (const a of appointments) nameAt(a.points, String(a.key));
  }

  /* -- Die Seiten als Teile des Dokuments ------------------------------------------------ */
  const calendars = new Set<string>();
  try {
    const { loadCalendars } = await import('../calendar/calendar');
    for (const c of (await loadCalendars()).calendars) if (c.areaId === areaId) calendars.add(c.calendarId);
  } catch { /* ohne "@kalendarz" */ }
  const ids: ExportIds = {
    areaId, calendars, items: itemKeys, forms: formRefs,
    pages: new Map([...pageKeys].map(([path, key]) => [path, key] as const)),
    roles: roleKeys
  };
  const pages: Record<string, unknown>[] = [];
  for (const page of loadedPages) {
    const card = desk.find((p) => p.path === page.path);
    const bound = card?.accessAreaIds ?? [];
    const { format: _format, version: _version, path: _path, ...rest } = page.doc;
    const partIds = page.parts;
    const modulesOut = (Array.isArray(rest.modules) ? rest.modules : []).map((raw) => {
      if (!isRecord(raw)) return raw;
      const partId = typeof raw.id === 'string' ? raw.id : '';
      const draft = (pageDrafts.get(page.path) ?? []).find((p) => p.id === partId);
      const { module: _module, id: _id, ...entry } = raw;
      let out: Record<string, unknown> = { id: partIds.get(partId) ?? partId, ...entry };
      if (draft?.audienceAreaId === areaId) out.members = true;
      const ask = out.kind === ASK_KIND ? asks.get(partId) : undefined;
      if (ask !== undefined) out = { ...out, ...(ask.answer.length === 0 ? {} : { answer: ask.answer }), forms: ask.forms };
      if (out.kind === 'form') {
        const moduleId = draft?.moduleId ?? partId;
        const row = modules.find((m) => m.moduleId === moduleId);
        if (Array.isArray(out.questions)) {
          out.questions = out.questions.map((q) => {
            if (!isRecord(q)) return q;
            const { answersTo: _answers, ...question } = q;
            return question;
          });
        }
        if (row !== undefined) {
          const memberRoles = memberRolesOf(row);
          if (memberRoles.length > 0) out.memberRoles = memberRoles.map((r) => (roleKeys.has(r) ? `@${roleKeys.get(r)}` : r));
          out = { ...out, ...publishOf(questionsAreaOf(row)) };
        }
      }
      if (isRecord(out.slide)) {
        const slide: Record<string, unknown> = { ...out.slide };
        if (isRecord(slide.stage) && isRecord(slide.stage.frames)) {
          slide.stage = { ...slide.stage, frames: Object.fromEntries(Object.entries(slide.stage.frames).map(([k, v]) => [partIds.get(k) ?? k, v])) };
        }
        if (isRecord(slide.with) && typeof slide.with.slide === 'string') slide.with = { ...slide.with, slide: partIds.get(slide.with.slide) ?? slide.with.slide };
        out.slide = slide;
      }
      return tokenizeCalendarFields(out, ids);
    });
    let doc: Record<string, unknown> = { ...rest, modules: modulesOut };
    if (isRecord(doc.logic)) {
      const swap = (v: unknown) => (typeof v === 'string' ? partIds.get(v) ?? v : v);
      doc.logic = { ...doc.logic, nodes: (Array.isArray(doc.logic.nodes) ? doc.logic.nodes : []).map((n) => (isRecord(n) ? { ...n, partId: swap(n.partId), goto: swap(n.goto) } : n)) };
    }
    doc = tokenizePaths(doc, ids);
    doc = tokenizeValues(doc, ids) as Record<string, unknown>;
    const relative = relativePath(base, page.path);
    pages.push({
      key: page.key,
      path: relative,
      ...(page.path === mainPath ? { main: true } : {}),
      ...(page.path === afterPath ? { after: true } : {}),
      ...(bound.includes(areaId) ? { access: 'members' } : bound.length === 0 ? { access: 'public' } : {}),
      page: doc
    });

  }

  /* -- Unterformulare -------------------------------------------------------------------- */
  const subforms: Record<string, unknown>[] = [];
  for (const sub of modules.filter((m) => m.kind === 'form' && m.extendsId !== null && formRefs.has(m.extendsId!))) {
    const known = book.keyOf('form', sub.moduleId);
    const key = known !== undefined && !known.key.includes('/') ? known.key : claim('form', keyFrom(sub.name), sub.moduleId);
    formRefs.set(sub.moduleId, key);
    let form: FormContent | undefined;
    try { form = await readFormContent(who, sub.moduleId); } catch { warnings.push(`Podformularz „${sub.name}”: pytań nie da się teraz odczytać — bez nich.`); }
    const out = exportModule({ ...sub, config: readConfig(sub.config), memberRoles: memberRolesOf(sub) }, form);
    const questions = Array.isArray(out.questions)
      ? out.questions.map((q) => {
        if (!isRecord(q)) return q;
        const { answersTo: _answers, ...question } = q;
        return question;
      })
      : undefined;
    subforms.push({
      key, of: `@form:${formRefs.get(sub.extendsId!)}`, name: sub.name, audience: sub.audience === 'office' ? 'office' : 'person',
      ...(sub.repeat === undefined || sub.repeat === 'once' ? {} : { repeat: sub.repeat }),
      ...publishOf(questionsAreaOf(sub)),
      ...(questions === undefined ? {} : { questions }),
      ...(out.design === undefined || out.design === null ? {} : { design: out.design }),
      ...(out.needs === undefined ? {} : { needs: out.needs }),
      ...(Array.isArray(out.memberRoles) ? { memberRoles: out.memberRoles.map((r) => (typeof r === 'string' && roleKeys.has(r) ? `@${roleKeys.get(r)}` : r)) } : {})
    });
  }
  for (const form of areaForms.filter((m) => m.extendsId === null && !formRefs.has(m.moduleId))) {
    warnings.push(`Formularz „${form.name}” nie stoi na żadnej stronie obszaru — nie ma go w eksporcie.`);
  }

  /* -- Rozmowy und Listen ----------------------------------------------------------------- */
  const chats: unknown[] = [];
  try {
    for (const chat of (await loadChats()).chats.filter((c) => c.areaId === areaId && (c.kind === 'area' || c.kind === 'channel'))) {
      const forms = await loadAudienceForms('chat', chat.chatId).then((r) => r.forms, () => []);
      const refs = forms.map((f) => formRefs.get(f.moduleId)).filter((r): r is string => r !== undefined).map((r) => `@form:${r}`);
      chats.push(refs.length === 0 ? chat.kind : { kind: chat.kind, forms: refs });
    }
  } catch { /* ohne Rozmowy */ }
  const listings = await loadListings(areaId)
    .then((r) => r.listings.filter((l) => l.state !== 'refused' && l.path !== null).map((l) => l.path!), () => [] as string[]);

  /* -- Das Profil und seine Wizytówka ------------------------------------------------------ */
  let card: Record<string, unknown> | undefined;
  if (profile?.card != null) {
    const opened = await openCard(profile.card, areaId, ring).catch(() => null);
    if (opened === null) warnings.push('Wizytówki nie da się teraz otworzyć — nie ma jej w eksporcie.');
    else card = { title: opened.title, lead: opened.lead, ...(profile.imageId === null ? {} : { image: `page-image:${profile.imageId}` }), ...publishOf(profile.card.areaId) };
  }

  const doc: Record<string, unknown> = {
    format: AREA_FORMAT,
    version: 1,
    ...(profile === null ? {} : { kind: profile.kind }),
    name: input.areaName,
    ...(profile?.category == null ? {} : { category: profile.category }),
    ...(base === '' ? {} : { address: base }),
    publish: publishArea === null ? 'area' : publishArea,
    ...(profile === null ? {} : { archive: profile.archiveMode }),
    ...(card === undefined ? {} : { card }),
    roles,
    appointments,
    pages,
    subforms,
    chats,
    listings
  };

  if (input.register && fresh.length > 0) {
    try {
      for (let i = 0; i < fresh.length; i += 400) await saveImportKeys(areaId, fresh.slice(i, i + 400));
    } catch {
      warnings.push('Obszar nie zapamiętał nowych kluczy — import tego dokumentu może utworzyć części jeszcze raz.');
    }
  }
  return { doc, warnings };
}
