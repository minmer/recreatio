/**
 * 0137 — AUS DER WSPÓLNOTA WIRD, WAS ES SCHON GIBT: je Einheit ein Dokument ihres Bereichs
 * („recreatio/area": Rollen = Positionen, Rozmowy, Termine, Seiten, Zapisy), die Zugänge, die aus dem
 * Baum folgen (Leitung und Begleitung nach unten, „Jednostki niżej widzą tę", Gremien), und was ein
 * Mensch seiner Einheit lesen soll (`UnitView`). Rein — `communityImport.ts` führt es aus.
 */

import { AREA_FORMAT } from '../areas/areaJson';
import { DEFAULT_ENTRY } from '../calendar/appointmentsJson';
import { t } from '../core/i18n';
import {
  councilOf, flatten, kindOf, levelOf, positionsOf, rankOf, slug, unitsOf, valueOf,
  type CommunityDoc, type FlatUnit, type Level, type Position, type Unit
} from './community';
import type { CommunityState, Stored, UnitView } from './communityJson';


/** Wie die Rolle einer Position in einer Einheit heisst: „Para animatorska · Krąg 3". */
export const roleName = (p: Position, u: Unit): string => `${p.name} · ${u.name}`.slice(0, 80);
export const roleKey = (unitKey: string, positionKey: string): string => `${unitKey}/${positionKey}`;

/** Wer über Zapisy hereinkommt: die erste Position mit Uczestnictwo, sonst mit Członkostwo. */
const intakePosition = (doc: CommunityDoc, u: Unit): Position | undefined => {
  const ps = positionsOf(doc, u);
  return ps.find((p) => p.rights === 'participant') ?? ps.find((p) => p.rights === 'member');
};

/** Die Adresse der Seiten einer Einheit: eigene, sonst die der Einheit darüber + Schlüssel. */
export function addressOf(doc: CommunityDoc, unitKey: string): string {
  const chain = flatten(doc.unit);
  const here = chain.find((u) => u.unit.key === unitKey);
  if (here === undefined) return slug(doc.name);
  if (here.unit.address !== undefined) return here.unit.address;
  if (here.parent === null) return slug(doc.name);
  return `${addressOf(doc, here.parent)}/${here.unit.key.replace(/_/g, '-')}`.slice(0, 180);
}

const WEEKDAYS = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd']; // i18n-ignore
const DAY_NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const two = (n: number) => String(n).padStart(2, '0');

/** Der nächste Tag dieser Woche ab heute: „cz" → „2026-11-05". */
export function nextWeekday(day: string, from: Date = new Date()): string {
  const want = WEEKDAYS.indexOf(day);
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const now = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() + ((want - now + 7) % 7));
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

const endTime = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${two(Math.floor(t / 60))}:${two(t % 60)}`;
};

/** Das Ende des Arbeitsjahrs, das gerade läuft (oder kommt): „06-30" → „2027-06-30". */
function yearEnd(until: string, from: Date = new Date()): string {
  const [m, d] = until.split('-').map(Number);
  const y = from.getMonth() + 1 > m || (from.getMonth() + 1 === m && from.getDate() > d) ? from.getFullYear() + 1 : from.getFullYear();
  return `${y}-${two(m)}-${two(d)}`;
}

const signupQuestions = () => [
  { id: 'imie', kind: 'line', label: t('communities.compile.givenName'), required: true, halfWidth: true, identity: 'given_name' },
  { id: 'nazwisko', kind: 'line', label: t('communities.compile.surname'), required: true, halfWidth: true, identity: 'surname' },
  { id: 'telefon', kind: 'phone', label: t('communities.compile.phone'), required: true, halfWidth: true, identity: 'phone' },
  { id: 'email', kind: 'email', label: t('communities.compile.email'), required: false, halfWidth: true, identity: 'email' }
];

const QUESTION_KIND: Record<string, string> = { line: 'line', text: 'text', choice: 'choice', date: 'date', checkbox: 'checkbox', number: 'line' };

/** Pages and modules a unit gets from its settings. */
export interface Compiled {
  readonly doc: Record<string, unknown>;
  /** Was daraus wird, in Worten — für den Plan. */
  readonly says: readonly string[];
  /** Seite für die Menschen der Einheit (Adresse), sonst die öffentliche, sonst keine. */
  readonly home: string | null;
}

/** DAS DOKUMENT DES BEREICHS einer Einheit — „recreatio/area", wie es `runAreaImport` nimmt. */
export function compileUnit(doc: CommunityDoc, flat: FlatUnit, now: Date = new Date()): Compiled {
  const u = flat.unit;
  const v = (path: string) => valueOf(doc, u.key, path);
  const on = (path: string) => v(path) === true;
  const says: string[] = [];
  const address = addressOf(doc, u.key);
  const positions = positionsOf(doc, u);
  const leads = positions.filter((p) => p.rights === 'lead' || p.rights === 'accompany');
  const intake = intakePosition(doc, u);
  const mode = String(v('intake.mode') ?? 'leaders');

  const roles = positions.map((p) => ({
    key: p.key, name: roleName(p, u), level: levelOf(p.rights),
    ...(mode === 'link' && intake?.key === p.key ? { link: { days: 365, label: t('communities.compile.joinLink', { name: u.name }).slice(0, 80) } } : {})
  }));
  if (roles.length > 0) says.push(`role: ${roles.map((r) => r.name).join(', ')}`); // i18n-ignore — Markierung, wird beim Plan herausgefiltert

  /* Termine: das Ganze (befristet) und das regelmässige Treffen. */
  const appointments: Record<string, unknown>[] = [];
  const from = String(v('life.from') ?? '');
  const until = String(v('life.until') ?? '');
  if (v('life.duration') === 'limited' && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    appointments.push({ key: 'main', main: true, title: u.name, start: from, end: /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : from, allDay: true, ...(v('life.location') ? { location: String(v('life.location')) } : {}) });
    says.push(until ? t('communities.compile.saysWholeRange', { from, until }) : t('communities.compile.saysWhole', { from }));
  }
  const rhythm = v('life.rhythm');
  const weekday = String(v('life.weekday') ?? '');
  const time = String(v('life.time') ?? '');
  if (on('tools.calendar') && (rhythm === 'weekly' || rhythm === 'monthly') && WEEKDAYS.includes(weekday) && /^\d{1,2}:\d{2}$/.test(time)) {
    const day = nextWeekday(weekday, now);
    const hhmm = time.padStart(5, '0');
    appointments.push({
      key: 'spotkanie', title: t('communities.compile.meetingTitle', { name: u.name }).slice(0, 200), start: `${day}T${hhmm}`, end: endTime(hhmm, Number(v('life.minutes') ?? 90) || 90),
      repeat: rhythm, ...(rhythm === 'weekly' ? { weekdays: [weekday] } : {}),
      until: yearEnd(String(v('life.yearUntil') ?? '06-30'), now),
      ...(v('life.location') && v('life.place') !== 'online' ? { location: String(v('life.location')) } : {})
    });
    const dayName = t(`communities.weekday.${DAY_NAMES[WEEKDAYS.indexOf(weekday)]}`);
    says.push(t(rhythm === 'weekly' ? 'communities.compile.saysWeekly' : 'communities.compile.saysMonthly', { day: dayName, time: hhmm }));
  }

  /* Seiten. */
  const pages: Record<string, unknown>[] = [];
  const subforms: Record<string, unknown>[] = [];
  const signup = mode === 'signup' && intake !== undefined;
  const publicPage = on('public.page') || signup;
  const description = String(v('public.description') ?? '').trim();
  let signupRef: string | null = null;
  if (publicPage) {
    const modules: Record<string, unknown>[] = [];
    if (description !== '') modules.push({ id: 'opis', kind: 'text', config: { title: u.name, body: description } });
    const meetings = String(v('public.meetings') ?? '').trim();
    if (meetings !== '') modules.push({ id: 'spotkania', kind: 'hours', config: { title: t('communities.compile.meetings'), body: meetings } });
    const contact = String(v('public.contact') ?? '').trim();
    if (contact !== '') modules.push({ id: 'kontakt', kind: 'contact', config: contact.includes('@') ? { email: contact } : { phone: contact } });
    if (on('public.events') && on('tools.calendar')) modules.push({ id: 'terminy', kind: 'calendar', config: { title: t('communities.compile.dates'), calendars: `@${DEFAULT_ENTRY}` } });
    if (signup) {
      const limit = Number(v('intake.limit') ?? 0) || 0;
      const lines = [
        limit > 0 ? t(on('intake.waitlist') ? 'communities.compile.placesWaitlist' : 'communities.compile.places', { count: limit }) : '',
        v('intake.requires') ? t('communities.compile.requires', { what: String(v('intake.requires')) }) : '',
        on('intake.confirm') ? t('communities.compile.confirm') : ''
      ].filter((l) => l !== '');
      if (lines.length > 0) modules.push({ id: 'warunki', kind: 'text', config: { title: t('communities.compile.signup'), body: lines.join('\n') } });
      const fieldQuestions = doc.fields.filter((f) => !f.leadersOnly).map((f) => ({
        id: f.key, kind: QUESTION_KIND[f.kind] ?? 'line', label: f.label, ...(f.kind === 'choice' ? { options: f.options ?? [] } : {})
      }));
      const needs: unknown[] = [];
      if (on('intake.minors')) needs.push({ id: 'minor', age: 'birth', ways: ['parent', 'consent'] });
      if (on('intake.health')) needs.push('health');
      modules.push({
        id: 'zapisy', kind: 'form', name: t('communities.compile.signupForm', { name: u.name }).slice(0, 120), questions: [...signupQuestions(), ...fieldQuestions],
        memberRoles: [`@${intake.key}`], ...(needs.length > 0 ? { needs } : {})
      });
      signupRef = '@form:main/zapisy';
      const secret = doc.fields.filter((f) => f.leadersOnly);
      if (secret.length > 0) {
        subforms.push({
          key: 'dla-prowadzacych', of: signupRef, name: t('communities.compile.leadersData'), audience: 'person',
          questions: secret.map((f) => ({ id: f.key, kind: QUESTION_KIND[f.kind] ?? 'line', label: f.label, ...(f.kind === 'choice' ? { options: f.options ?? [] } : {}) }))
        });
      }
      says.push(limit > 0 ? t('communities.compile.saysSignupLimit', { count: limit }) : t('communities.compile.saysSignup'));
    }
    pages.push({ key: 'main', path: '', main: true, access: 'public', page: { title: u.name, ...(description === '' ? {} : { lead: description.slice(0, 300) }), modules } });
    says.push(t('communities.compile.saysPublic'));
    if (on('public.reports') && v('life.duration') === 'limited') {
      pages.push({ key: 'po', path: 'po', after: true, page: { title: t('communities.compile.afterTitle', { name: u.name }), modules: [{ id: 'relacja', kind: 'text', config: { title: t('communities.compile.afterHeading'), body: t('communities.compile.afterBody') } }] } });
    }
  }

  /* Die Seite für die Menschen der Einheit. */
  const inside: Record<string, unknown>[] = [
    { id: 'witaj', kind: 'text', config: { title: u.name, body: t('communities.compile.insideBody') } }
  ];
  if (on('tools.calendar')) inside.push({ id: 'kalendarz', kind: 'calendar', config: { title: t('communities.compile.dates'), calendars: `@${DEFAULT_ENTRY}` } });
  if (on('tools.chat')) inside.push({ id: 'rozmowa', kind: 'seat-chat', config: { title: t('communities.compile.chat') } });
  if (on('tools.askLeaders') && leads.length > 0) inside.push({ id: 'do-prowadzacych', kind: 'seat-ask', config: { title: t('communities.compile.askLeaders') }, answer: leads.map((p) => `@role:${p.key}`) });
  /* Ohne öffentliche Seite steht die Seite der Menschen AUF der Adresse der Einheit — so haben die Einheiten darunter eine Seite über sich. */
  pages.push(publicPage
    ? { key: 'nasze', path: 'dla-nas', access: 'members', page: { title: t('communities.compile.forUsTitle', { name: u.name }), modules: inside } }
    : { key: 'main', path: '', main: true, access: 'members', page: { title: u.name, modules: inside } });

  const chats: unknown[] = [];
  if (on('tools.chat')) chats.push(signupRef === null ? 'area' : { kind: 'area', forms: [signupRef] });
  if (on('tools.announcements')) chats.push('channel');

  const bp = doc.blueprints.find((b) => b.key === u.from);
  const extra = { ...(bp?.extra ?? {}), ...(u.extra ?? {}) } as Record<string, unknown>;
  const merged = (key: string, mine: readonly Record<string, unknown>[], by = 'key'): Record<string, unknown>[] => {
    const theirs = [...((bp?.extra?.[key] as unknown[]) ?? []), ...((u.extra?.[key] as unknown[]) ?? [])].filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object');
    const out = mine.filter((m) => !theirs.some((t) => t[by] === m[by]));
    for (const t of theirs) { const i = out.findIndex((o) => o[by] === t[by]); if (i >= 0) out[i] = t; else out.push(t); }
    return out;
  };

  const area: Record<string, unknown> = {
    format: AREA_FORMAT, version: 1, kind: kindOf(doc, u), name: u.name, address,
    publish: typeof extra.publish === 'string' ? extra.publish : signup ? 'auto' : 'area',
    ...(v('life.duration') === 'limited' ? { archive: 'auto' } : {}),
    ...(extra.category !== undefined ? { category: extra.category } : {}),
    ...(extra.card !== undefined ? { card: extra.card } : publicPage ? { card: { title: u.name, lead: description } } : {}),
    roles,
    appointments: merged('appointments', appointments),
    pages: merged('pages', pages),
    subforms: merged('subforms', subforms),
    chats: Array.isArray(extra.chats) ? extra.chats : chats,
    ...(Array.isArray(extra.listings) ? { listings: extra.listings } : {})
  };
  return { doc: area, says, home: publicPage ? `${address}/dla-nas` : address };
}

/** Das Gremium: ein Bereich unter der Einheit, mit eigener Rozmowa — seine Menschen gibt die Wspólnota (`desiredAccess`). */
export function compileCouncil(name: string): Record<string, unknown> {
  return { format: AREA_FORMAT, version: 1, kind: 'group', name, publish: 'area', roles: [], pages: [], subforms: [], chats: ['area'] };
}

/* -- Zugänge aus dem Baum ------------------------------------------------------------------ */

export interface Join { readonly areaId: string; readonly roleId: string; readonly level: Level; readonly why: string }
export interface Hold { readonly holder: string; readonly held: string }

/**
 * Was der Baum an Zugängen verlangt — ÜBER die eigenen Rollen jeder Einheit hinaus (die legt das
 * Dokument des Bereichs an): Leitung „admin" und Begleitung „read" in allen Einheiten darunter,
 * „Jednostki niżej widzą tę" (jede Position darunter liest hier), Gremien. Je Bereich und Rolle die
 * stärkste Stufe. Dazu: die Leitung hält die übrigen Positionen ihrer Einheit.
 */
export function desiredAccess(doc: CommunityDoc, state: Pick<CommunityState, 'units' | 'councils' | 'roles'>): { joins: Join[]; holds: Hold[] } {
  const units = unitsOf(doc);
  const below = (key: string): FlatUnit[] => units.filter((u) => u.path.includes(key) && u.unit.key !== key);
  const best = new Map<string, Join>();
  const want = (areaId: string | undefined, roleId: string | undefined, level: Level, why: string) => {
    if (areaId === undefined || roleId === undefined) return;
    const k = `${areaId}|${roleId}`;
    const had = best.get(k);
    if (had === undefined || rankOf(level) > rankOf(had.level)) best.set(k, { areaId, roleId, level, why });
  };
  const holds: Hold[] = [];
  for (const { unit } of units) {
    const ps = positionsOf(doc, unit);
    const role = (unitKey: string, posKey: string) => state.roles[roleKey(unitKey, posKey)];
    for (const p of ps) {
      const mine = role(unit.key, p.key);
      if (p.rights === 'lead' || p.rights === 'accompany') {
        for (const d of below(unit.key)) want(state.units[d.unit.key], mine, p.rights === 'lead' ? 'admin' : 'read', t(p.rights === 'lead' ? 'communities.access.leadsBelow' : 'communities.access.seesBelow', { position: p.name, unit: unit.name }));
      }
      if (p.rights === 'lead' && mine !== undefined) {
        for (const other of ps) {
          const held = role(unit.key, other.key);
          if (other.key !== p.key && held !== undefined) holds.push({ holder: mine, held });
        }
      }
    }
    if (valueOf(doc, unit.key, 'visibility.subunitsSee') === true) {
      for (const d of below(unit.key)) {
        for (const q of positionsOf(doc, d.unit)) want(state.units[unit.key], role(d.unit.key, q.key), 'read', t('communities.access.visibleBelow', { unit: unit.name }));
      }
    }
    const council = councilOf(doc, unit);
    if (council !== undefined) {
      const at = state.councils[council.key];
      for (const p of ps) {
        if (council.own.includes(p.key) || p.rights === 'lead') want(at, role(unit.key, p.key), p.rights === 'lead' ? 'admin' : 'write', t('communities.access.council', { name: council.name }));
      }
      for (const child of units.filter((x) => x.parent === unit.key)) {
        for (const q of positionsOf(doc, child.unit)) if (council.below.includes(q.key)) want(at, role(child.unit.key, q.key), 'write', t('communities.access.council', { name: council.name }));
      }
    }
  }
  return { joins: [...best.values()], holds };
}

export const joinMark = (j: Pick<Join, 'areaId' | 'roleId' | 'level'>): string => `${j.areaId}|${j.roleId}|${j.level}`;

/* -- Was ein Mensch einer Einheit liest ------------------------------------------------------ */

export function unitView(doc: CommunityDoc, state: CommunityState, unitKey: string, rootAreaId: string, home: string | null, now: Date = new Date()): UnitView {
  const flat = flatten(doc.unit).find((u) => u.unit.key === unitKey)!;
  const ps = positionsOf(doc, flat.unit);
  return {
    community: { areaId: rootAreaId, name: doc.name },
    unit: { key: unitKey, name: flat.unit.name, areaId: state.units[unitKey] ?? '' },
    positions: ps.map((p) => ({ key: p.key, name: p.name, rights: p.rights, roleId: state.roles[roleKey(unitKey, p.key)] ?? null })),
    people: doc.persons.filter((p) => p.remove !== true && p.places.some((pl) => pl.unit === unitKey)).map((p) => ({
      name: p.name, linkRoleId: state.links[p.key]?.linkRoleId ?? null,
      positions: p.places.filter((pl) => pl.unit === unitKey).map((pl) => pl.position)
    })),
    home,
    updatedAt: now.toISOString()
  };
}

/** Die Rollen, die der Link einer Person halten soll (sortiert) — und welche davon sie führt. */
export function personRoles(doc: CommunityDoc, state: Pick<CommunityState, 'roles'>, personKey: string): { roleId: string; lead: boolean }[] {
  const person = doc.persons.find((p) => p.key === personKey);
  if (person === undefined || person.remove === true) return [];
  const out = new Map<string, boolean>();
  for (const pl of person.places) {
    const roleId = state.roles[roleKey(pl.unit, pl.position)];
    const pos = doc.positions.find((p) => p.key === pl.position);
    if (roleId === undefined || pos === undefined) continue;
    out.set(roleId, (out.get(roleId) ?? false) || pos.rights === 'lead');
  }
  return [...out].sort(([a], [b]) => a.localeCompare(b)).map(([roleId, lead]) => ({ roleId, lead }));
}

/** Ein neutraler Name für den Link — ohne Personendaten (die Etikette sieht der Dienst). */
export function linkLabel(doc: CommunityDoc, personKey: string): string {
  const person = doc.persons.find((p) => p.key === personKey);
  const first = person?.places[0];
  const unit = first === undefined ? undefined : flatten(doc.unit).find((u) => u.unit.key === first.unit)?.unit;
  const pos = first === undefined ? undefined : doc.positions.find((p) => p.key === first.position);
  return t('communities.compile.linkLabel', { position: pos?.name ?? t('communities.compile.linkPerson'), unit: unit?.name ?? doc.name }).slice(0, 80);
}

/* -- Der Plan in Worten ------------------------------------------------------------------------ */

export interface PlanLine { readonly kind: 'unit' | 'person' | 'access' | 'area' | 'warn'; readonly text: string }

/** Was ein Import ändern würde — aus dem Dokument und dem, was die Wspólnota schon weiss. */
export function planLines(doc: CommunityDoc, before: Extract<Stored, { kind: 'community' }> | null, areaNames: ReadonlyMap<string, string>): PlanLine[] {
  const out: PlanLine[] = [];
  if (before === null) {
    out.push({ kind: 'warn', text: t('communities.plan.claimAddress', { address: addressOf(doc, doc.unit.key) }) });
    out.push({ kind: 'warn', text: t('communities.plan.needController') });
  }
  const state = before?.state;
  const old = before === null ? [] : flatten(before.doc.unit);
  const nameOf = (key: string | null) => flatten(doc.unit).find((x) => x.unit.key === key)?.unit.name ?? '';
  for (const f of flatten(doc.unit)) {
    const u = f.unit;
    const areaId = state?.units[u.key];
    const was = old.find((o) => o.unit.key === u.key);
    if (u.remove === true) { if (areaId !== undefined) out.push({ kind: 'unit', text: t('communities.plan.dissolved', { name: u.name }) }); continue; }
    if (u.area !== undefined && areaId === undefined) {
      const area = areaNames.get(u.area) ?? u.area;
      out.push({ kind: 'unit', text: f.parent ? t('communities.plan.takenOverUnder', { area, name: u.name, parent: nameOf(f.parent) }) : t('communities.plan.takenOver', { area, name: u.name }) });
    } else if (areaId === undefined) out.push({ kind: 'unit', text: f.parent ? t('communities.plan.newUnitUnder', { name: u.name, parent: nameOf(f.parent) }) : t('communities.plan.newUnitTop', { name: u.name }) });
    else {
      if (was !== undefined && was.parent !== f.parent) out.push({ kind: 'unit', text: f.parent === null ? t('communities.plan.movedTop', { name: u.name }) : t('communities.plan.moved', { name: u.name, parent: nameOf(f.parent) }) });
      const now = areaNames.get(areaId);
      if (now !== undefined && now !== u.name) out.push({ kind: 'unit', text: t('communities.plan.renamed', { from: now, to: u.name }) });
    }
    const c = councilOf(doc, u);
    if (c !== undefined && state?.councils[c.key] === undefined) out.push({ kind: 'unit', text: t('communities.plan.council', { name: c.name, unit: u.name }) });
    for (const p of positionsOf(doc, u)) if (state?.roles[roleKey(u.key, p.key)] === undefined) out.push({ kind: 'access', text: t(`communities.plan.role.${levelOf(p.rights)}`, { name: roleName(p, u) }) });
    const compiled = compileUnit(doc, f);
    out.push({ kind: 'area', text: t('communities.plan.area', { name: u.name, says: compiled.says.filter((s) => !s.startsWith('role:')).join('; ') || t('communities.plan.forUsPage') }) });
  }
  for (const p of doc.persons) {
    const mark = state?.links[p.key];
    if (p.remove === true) { if (mark !== undefined) out.push({ kind: 'person', text: t('communities.plan.linkStops', { name: p.name }) }); continue; }
    if (p.places.length === 0) { out.push({ kind: 'warn', text: t('communities.plan.noPlace', { name: p.name }) }); continue; }
    if (mark === undefined) { out.push({ kind: 'person', text: t('communities.plan.newLink', { name: p.name }) }); continue; }
    const wasPerson = before?.doc.persons.find((x) => x.key === p.key);
    const same = wasPerson !== undefined && wasPerson.places.length === p.places.length
      && p.places.every((pl) => wasPerson.places.some((x) => x.unit === pl.unit && x.position === pl.position));
    if (!same) out.push({ kind: 'person', text: t('communities.plan.placesChanged', { name: p.name }) });
  }
  if (before !== null) {
    for (const p of before.doc.persons) if (!doc.persons.some((x) => x.key === p.key) && p.remove !== true) out.push({ kind: 'warn', text: t('communities.plan.personMissing', { name: p.name }) });
    for (const { unit } of old) if (!flatten(doc.unit).some((x) => x.unit.key === unit.key) && unit.remove !== true) out.push({ kind: 'warn', text: t('communities.plan.unitMissing', { name: unit.name }) });
  }
  return out;
}
