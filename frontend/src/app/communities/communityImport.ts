/**
 * 0137 — DIE WSPÓLNOTA AUSFÜHREN, Schritt für Schritt, mit dem, was es gibt:
 *
 *   1. Einheiten   — Bereiche anlegen, umbenennen, umhängen (`createArea`, `renameArea`, `setParent`);
 *                    Gremien als Bereiche unter ihrer Einheit
 *   2. Werkzeuge   — je Einheit ihr Dokument („recreatio/area") durch `runAreaImport`: Positionen als
 *                    Rollen, Rozmowy, Termine, Seiten, Zapisy
 *   3. Zugänge     — was der Baum verlangt (`desiredAccess`): `joinArea`; was die Wspólnota früher gab
 *                    und nicht mehr gilt: `dropFromArea`; die Leitung hält die übrigen Positionen
 *   4. Personen    — ein Link je Person, der ihre Rollen hält (`createLink`); andere Rollen → neuer Link,
 *                    der alte wird zurückgenommen (`revokeLink`)
 *   5. Merken      — versiegelt in der Wurzel das Ganze, in jeder Einheit, was ihre Menschen lesen
 *
 * Was entsteht, wird nach jedem Schritt gemerkt: bricht ein späterer ab, trifft der nächste Import es
 * wieder, statt es zu verdoppeln.
 */

import { createArea, dropFromArea, joinArea, loadAreas, loadMembers, renameArea, type AreaRow } from '../areas/area';
import { DEFAULT_AREA_IMPORT, readAreaDocument } from '../areas/areaJson';
import { runAreaImport } from '../areas/areaImport';
import { loadImportKeys } from '../areas/profile';
import { t } from '../core/i18n';
import type { Ring, SealedRole } from '../core/keys';
import { forgetKeys, keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { createLink, issuerIn, loadLinks, revokeLink } from '../links/linkAccess';
import { addHolder } from '../roles/roles';
import { councilOf, flatten, positionsOf, rankOf, withAutoSubgroups, type CommunityDoc, type Unit } from './community';
import { addressOf, compileCouncil, compileUnit, desiredAccess, joinMark, linkLabel, personRoles, roleKey, unitView } from './communityCompile';
import { EMPTY_STATE, type LinkMark, type StoredCommunity } from './communityJson';
import { loadSetup, saveSetup, setParent } from './communityStore';

const failure = (e: unknown): string => (e instanceof Error ? e.message : t('communities.run.failedWord')).replace(/[.\s]+$/, '');

export interface RunResult {
  readonly rootAreaId: string;
  readonly lines: string[];
  readonly warnings: string[];
  /** Neue Links — nur jetzt zu sehen (später: „Osoby” → „Kopiuj link”). */
  readonly links: readonly { readonly name: string; readonly url: string }[];
}

/** Was im neuen Dokument fehlt, bleibt (Personen, Einheiten unter ihrem alten Vater). */
export function carryOver(before: CommunityDoc | null, doc: CommunityDoc): CommunityDoc {
  if (before === null) return doc;
  const persons = [...doc.persons];
  for (const p of before.persons) if (!persons.some((x) => x.key === p.key)) persons.push(p);
  const now = new Set(flatten(doc.unit).map((u) => u.unit.key));
  const missing = flatten(before.unit).filter((u) => !now.has(u.unit.key) && u.parent !== null);
  if (missing.length === 0) return { ...doc, persons };
  const attach = (unit: Unit): Unit => {
    const own = missing.filter((m) => m.parent === unit.key && !now.has(m.unit.key));
    const kids = (unit.units ?? []).map(attach);
    for (const m of own) { now.add(m.unit.key); kids.push(m.unit); }
    return { ...unit, units: kids };
  };
  let unit = attach(doc.unit);
  const orphans = missing.filter((m) => !now.has(m.unit.key));
  if (orphans.length > 0) unit = { ...unit, units: [...(unit.units ?? []), ...orphans.map((o) => o.unit)] };
  return { ...doc, unit, persons };
}

/** Plätze in aufgelösten Einheiten zählen nicht mehr (für Rollen und Links). */
function activePlaces(doc: CommunityDoc): CommunityDoc {
  const gone = new Set(flatten(doc.unit).filter((u) => u.unit.remove === true || u.path.some((k) => flatten(doc.unit).find((x) => x.unit.key === k)?.unit.remove === true)).map((u) => u.unit.key));
  return { ...doc, persons: doc.persons.map((p) => ({ ...p, places: p.places.filter((pl) => !gone.has(pl.unit)) })) };
}

export async function runCommunityImport(input: {
  readonly who: Who;
  /** Die Wurzel einer bestehenden Wspólnota — oder ein Bereich, der zur Wurzel wird; `null`: neu anlegen. */
  readonly rootAreaId: string | null;
  readonly doc: CommunityDoc;
  /** Beim Zusammenlegen: was die Teile schon wissen (`mergeCommunities`). */
  readonly seed?: Pick<StoredCommunity, 'doc' | 'state'> | null;
  /** Diese Personen bekommen einen neuen Link, auch wenn ihre Rollen gleich bleiben (der alte war weitergegeben, verloren …). */
  readonly renew?: readonly string[];
  readonly stage: (what: string) => void;
}): Promise<RunResult> {
  const { who, stage } = input;
  const lines: string[] = [];
  const warnings: string[] = [];
  const links: { name: string; url: string }[] = [];

  stage(t('communities.run.keys'));
  let held = await keysFor(who);
  if (held.ring === null) throw new WorkspaceError(t('communities.run.needPassword'));
  let ring: Ring = held.ring;
  const person: SealedRole | null = held.graph.roles.find((r) => r.kind === 'person' && ring.maySign(r.id)) ?? null;
  if (person === null) throw new WorkspaceError(t('communities.run.noPerson'));
  const refresh = async () => { forgetKeys(); held = await keysFor(who); if (held.ring !== null) ring = held.ring; };

  /* Was die Wspólnota schon weiss. */
  let rootAreaId = input.rootAreaId;
  let version = 0;
  let before: Pick<StoredCommunity, 'doc' | 'state'> | null = input.seed ?? null;
  if (rootAreaId !== null) {
    const row = await loadSetup(ring, rootAreaId);
    if (row.missing) throw new WorkspaceError(t('communities.migrationMissing'));
    if (row.unreadable) throw new WorkspaceError(t('communities.run.unreadable'));
    if (row.stored?.kind === 'unit') throw new WorkspaceError(t('communities.run.isUnit', { name: row.stored.view.community.name }));
    if (row.stored?.kind === 'community') before = row.stored;
    version = row.version;
  }
  const doc = carryOver(before?.doc ?? null, input.doc);
  const full = activePlaces(withAutoSubgroups(doc));
  const s = {
    units: { ...(before?.state.units ?? EMPTY_STATE.units) } as Record<string, string>,
    councils: { ...(before?.state.councils ?? EMPTY_STATE.councils) } as Record<string, string>,
    roles: { ...(before?.state.roles ?? EMPTY_STATE.roles) } as Record<string, string>,
    links: { ...(before?.state.links ?? EMPTY_STATE.links) } as Record<string, LinkMark>,
    joins: [...(before?.state.joins ?? [])],
    holds: [...(before?.state.holds ?? [])]
  };
  if (rootAreaId !== null && s.units[full.unit.key] === undefined) s.units[full.unit.key] = rootAreaId;

  /* -- 1. Einheiten ---------------------------------------------------------------- */
  let areas: readonly AreaRow[] = (await loadAreas()).areas;
  const areaOf = (id: string | undefined) => (id === undefined ? undefined : areas.find((a) => a.areaId.toLowerCase() === id.toLowerCase()));
  let made = 0, moved = 0;
  for (const f of flatten(full.unit)) {
    const u = f.unit;
    if (u.remove === true) continue;
    const parentArea = f.parent === null ? undefined : s.units[f.parent];
    if (f.parent !== null && parentArea === undefined) { warnings.push(t('communities.run.noParent', { name: u.name })); continue; }
    stage(t('communities.run.stageUnit', { name: u.name }));
    try {
      let id = s.units[u.key];
      if (id === undefined && u.area !== undefined) {
        if (areaOf(u.area)?.myLevel !== 'admin') throw new WorkspaceError(t('communities.run.notYourArea'));
        id = u.area;
        s.units[u.key] = id;
      }
      if (id === undefined || areaOf(id) === undefined) {
        if (id !== undefined) warnings.push(t('communities.run.areaGone', { name: u.name }));
        id = (await createArea(ring, person, u.name, parentArea)).areaId;
        s.units[u.key] = id;
        made += 1;
      } else {
        const now = areaOf(id)!;
        if (now.name !== u.name) await renameArea(id, u.name);
        if (f.parent !== null && (now.parentAreaId ?? '').toLowerCase() !== (parentArea ?? '').toLowerCase()) { await setParent(id, parentArea ?? null); moved += 1; }
      }
      const council = councilOf(full, u);
      if (council !== undefined) {
        const cid = s.councils[council.key];
        if (cid === undefined || areaOf(cid) === undefined) s.councils[council.key] = (await createArea(ring, person, council.name, id)).areaId;
        else if (areaOf(cid)!.name !== council.name) await renameArea(cid, council.name);
      }
    } catch (e) {
      warnings.push(t('communities.run.unitSkipped', { name: u.name, why: failure(e) }));
    }
  }
  rootAreaId = s.units[full.unit.key] ?? null;
  if (rootAreaId === null) throw new WorkspaceError(`${t('communities.run.noRoot', { name: full.unit.name })}${warnings.length > 0 ? ` ${warnings.join(' ')}` : ''}`);
  lines.push(t('communities.run.unitsLine', { made, moved, all: flatten(full.unit).filter((x) => x.unit.remove !== true).length }));
  await refresh();
  areas = (await loadAreas()).areas;

  /* Zwischendurch merken — bricht etwas ab, kennt der nächste Import die Bereiche. */
  const remember = async (): Promise<void> => {
    const stored: StoredCommunity = { kind: 'community', doc, state: s, view: unitView(full, s, full.unit.key, rootAreaId!, null) };
    version = await saveSetup(ring, rootAreaId!, stored, version, null);
  };
  try { await remember(); } catch (e) { warnings.push(t('communities.run.stateNotSaved', { why: failure(e) })); }

  /* -- 2. Werkzeuge: das Dokument jedes Bereichs ------------------------------------- */
  const homes = new Map<string, string | null>();
  const run = async (areaId: string, areaName: string, raw: Record<string, unknown>, base: string, label: string) => {
    const read = readAreaDocument(raw);
    if ('error' in read) { warnings.push(`${label}: ${read.error}`); return; }
    const result = await runAreaImport({
      who, areaId, areaName, doc: read.doc, options: { ...DEFAULT_AREA_IMPORT, base }, imageFor: {},
      hooks: { stage: (what) => stage(`${label}: ${what}`), step: () => undefined }
    });
    warnings.push(...[...read.warnings, ...result.warnings].map((w) => `${label}: ${w}`));
    for (const l of result.links) links.push({ name: `${label} — ${l.name}`, url: l.url });
  };
  for (const f of flatten(full.unit)) {
    const u = f.unit;
    const areaId = s.units[u.key];
    if (u.remove === true || areaId === undefined) continue;
    const compiled = compileUnit(full, f, new Date(), s.roles);
    homes.set(u.key, compiled.home);
    try {
      await run(areaId, u.name, compiled.doc, addressOf(full, u.key), t('communities.run.quoted', { name: u.name }));
    } catch (e) {
      warnings.push(t('communities.run.failedFor', { name: u.name, why: failure(e) }));
    }
    try {
      const { keys } = await loadImportKeys(areaId);
      for (const p of positionsOf(full, u)) {
        const k = keys.find((x) => x.kind === 'role' && x.key === p.key && x.refId !== null);
        if (k?.refId) s.roles[roleKey(u.key, p.key)] = k.refId;
      }
    } catch (e) { warnings.push(t('communities.run.rolesNotRead', { name: u.name, why: failure(e) })); }
    const council = councilOf(full, u);
    const cid = council === undefined ? undefined : s.councils[council.key];
    if (council !== undefined && cid !== undefined) {
      try { await run(cid, council.name, compileCouncil(council.name), '', t('communities.run.quoted', { name: council.name })); } catch (e) { warnings.push(t('communities.run.failedFor', { name: council.name, why: failure(e) })); }
    }
  }
  try { await remember(); } catch (e) { warnings.push(t('communities.run.stateNotSaved', { why: failure(e) })); }
  await refresh();

  /* -- 3. Zugänge aus dem Baum ---------------------------------------------------------- */
  stage(t('communities.run.stageAccess'));
  const { joins, holds } = desiredAccess(full, s);
  const members = new Map<string, Awaited<ReturnType<typeof loadMembers>>['members']>();
  const issuers = new Map<string, string | null>();
  const membersOf = async (areaId: string) => {
    let m = members.get(areaId);
    if (m === undefined) { m = (await loadMembers(areaId)).members; members.set(areaId, m); }
    return m;
  };
  const keepJoins: string[] = [];
  let joined = 0, dropped = 0;
  for (const j of joins) {
    try {
      const role = held.graph.roles.find((r) => r.id === j.roleId);
      const has = (await membersOf(j.areaId)).find((m) => m.roleId === j.roleId);
      const top = Math.max(0, ...(has?.capabilities ?? []).map(rankOf));
      const ours = s.joins.find((x) => x.startsWith(`${j.areaId}|${j.roleId}|`));
      if (has !== undefined && ours !== undefined && ours !== joinMark(j) && top > rankOf(j.level)) {
        /* Weniger als bisher: erst hinaus, dann mit der neuen Stufe herein. */
        await dropFromArea(j.areaId, j.roleId);
        dropped += 1;
      } else if (has !== undefined && top >= rankOf(j.level)) { keepJoins.push(joinMark(j)); continue; }
      if (role === undefined) { warnings.push(t('communities.run.accessNoRole', { why: j.why })); continue; }
      if (!issuers.has(j.areaId)) issuers.set(j.areaId, await issuerIn(ring, j.areaId));
      const issuer = issuers.get(j.areaId);
      if (issuer === null || issuer === undefined) { warnings.push(t('communities.run.accessNoIssuer', { why: j.why })); continue; }
      stage(t('communities.run.stageJoin', { why: j.why }));
      await joinArea(ring, j.areaId, { id: role.id, kind: role.kind, wrapPublicKey: role.wrapPublicKey }, issuer, j.level);
      keepJoins.push(joinMark(j));
      joined += 1;
    } catch (e) {
      warnings.push(t('communities.run.accessFailed', { why: j.why, error: failure(e) }));
    }
  }
  for (const mark of s.joins) {
    const [areaId, roleId] = mark.split('|');
    if (joins.some((j) => j.areaId === areaId && j.roleId === roleId)) continue;
    try { await dropFromArea(areaId, roleId); dropped += 1; } catch (e) { warnings.push(t('communities.run.dropFailed', { why: failure(e) })); keepJoins.push(mark); }
  }
  s.joins = keepJoins;
  const keepHolds: string[] = [];
  for (const h of holds) {
    const mark = `${h.holder}|${h.held}`;
    if (held.graph.edges.some((e) => e.fromRoleId === h.holder && e.toRoleId === h.held && e.edgeKind === 'holds')) { keepHolds.push(mark); continue; }
    const holder = held.graph.roles.find((r) => r.id === h.holder);
    if (holder === undefined || !ring.has(h.held)) continue;
    try { await addHolder(ring, h.held, holder, 'holds', true); keepHolds.push(mark); } catch (e) { warnings.push(t('communities.run.holdFailed', { why: failure(e) })); }
  }
  s.holds = keepHolds;
  lines.push(t('communities.run.accessLine', { joined, dropped, all: joins.length }));
  try { await remember(); } catch (e) { warnings.push(t('communities.run.stateNotSaved', { why: failure(e) })); }
  await refresh();

  /* -- 4. Personen: ein Link je Person ------------------------------------------------- */
  let fresh = 0, renewed = 0, revoked = 0;
  const created = new Map<string, string>();
  for (const p of full.persons) {
    const mark = s.links[p.key];
    if (p.remove === true || p.places.length === 0) {
      if (mark !== undefined) {
        try { await revokeLink(mark.invitationId, true); revoked += 1; delete s.links[p.key]; } catch (e) { warnings.push(t('communities.run.revokeFailed', { name: p.name, why: failure(e) })); }
      }
      continue;
    }
    const want = personRoles(full, s, p.key);
    if (want.length === 0) { warnings.push(t('communities.run.noRoles', { name: p.name })); continue; }
    const ids = want.map((w) => w.roleId);
    if (mark !== undefined && mark.roles.join(',') === ids.join(',') && !(input.renew ?? []).includes(p.key)) continue;
    const missing = want.filter((w) => !ring.has(w.roleId) || (w.lead && !ring.maySign(w.roleId)));
    if (missing.length > 0) { warnings.push(t('communities.run.notAllRoles', { name: p.name })); continue; }
    try {
      stage(t('communities.run.stageLink', { name: p.name }));
      const link = await createLink(ring, person, { label: linkLabel(full, p.key), roles: want, once: false, maxUses: null, expiresDays: 365, aim: 'moje' }, (what) => stage(`${p.name}: ${what}`));
      links.push({ name: p.name, url: link.url });
      created.set(p.key, link.invitationId);
      s.links[p.key] = { invitationId: link.invitationId, linkRoleId: '', roles: ids, at: new Date().toISOString() };
      if (mark !== undefined) {
        try { await revokeLink(mark.invitationId, true); } catch (e) { warnings.push(t('communities.run.oldRevokeFailed', { name: p.name, why: failure(e) })); }
        renewed += 1;
      } else fresh += 1;
    } catch (e) {
      warnings.push(`${p.name}: ${failure(e)}.`);
    }
  }
  if (created.size > 0) {
    try {
      const { invites } = await loadLinks();
      for (const [key, invitationId] of created) {
        const row = invites.find((i) => i.invitationId === invitationId);
        if (row !== undefined) s.links[key] = { ...s.links[key], linkRoleId: row.roleId };
      }
    } catch { /* ohne Rolle des Links — die Begrüssung nennt dann keinen Namen */ }
  }
  lines.push(t('communities.run.linksLine', { fresh, renewed, revoked }));

  /* -- 5. Merken: das Ganze in der Wurzel, das Eigene in jeder Einheit --------------------- */
  stage(t('communities.run.stageSave'));
  try { await remember(); } catch (e) { warnings.push(t('communities.run.notSaved', { why: failure(e) })); }
  const root = rootAreaId;
  const saveView = async (areaId: string, unitKey: string, home: string | null) => {
    if (areaId === root) return;
    const row = await loadSetup(ring, areaId);
    const view = { ...unitView(full, s, unitKey, root, home) };
    await saveSetup(ring, areaId, { kind: 'unit', view }, row.version, null);
  };
  for (const f of flatten(full.unit)) {
    const areaId = s.units[f.unit.key];
    if (areaId === undefined || f.unit.remove === true) continue;
    try { await saveView(areaId, f.unit.key, homes.get(f.unit.key) ?? null); } catch (e) { warnings.push(t('communities.run.viewNotSaved', { name: f.unit.name, why: failure(e) })); }
    const council = councilOf(full, f.unit);
    const cid = council === undefined ? undefined : s.councils[council.key];
    if (council !== undefined && cid !== undefined) {
      try {
        const row = await loadSetup(ring, cid);
        await saveSetup(ring, cid, { kind: 'unit', view: { ...unitView(full, s, f.unit.key, root, null), unit: { key: council.key, name: council.name, areaId: cid }, positions: [], people: [] } }, row.version, null);
      } catch { /* das Gremium ohne Hinweis — es funktioniert trotzdem */ }
    }
  }
  /* Die Wurzel selbst: ihre Startseite steht erst jetzt fest. */
  try {
    const stored: StoredCommunity = { kind: 'community', doc, state: s, view: unitView(full, s, full.unit.key, root, homes.get(full.unit.key) ?? null) };
    version = await saveSetup(ring, root, stored, version, null);
  } catch (e) { warnings.push(t('communities.run.notSaved', { why: failure(e) })); }

  /* Der Bund kennt die eben entstandenen Linkrollen sonst nicht („Kopiuj link“ bliebe leer bis zum Neuladen). */
  forgetKeys();
  return { rootAreaId: root, lines, warnings, links };
}

/* -- Zusammenlegen: mehrere Wspólnoty unter eine neue Einheit ------------------------------------ */

/**
 * Zwei Rejony unter eine Diözese: die Wurzeln werden Einheiten der neuen, alles andere bleibt, wie es
 * ist (Bereiche, Rollen, Links). Doppelte Schlüssel der zweiten bekommen ein Präfix.
 */
export function mergeCommunities(parts: readonly Pick<StoredCommunity, 'doc' | 'state'>[], top: { key: string; name: string; kind: Unit['kind'] }): Pick<StoredCommunity, 'doc' | 'state'> {
  const state: { units: Record<string, string>; councils: Record<string, string>; roles: Record<string, string>; links: Record<string, LinkMark>; joins: string[]; holds: string[] } =
    { units: {}, councils: {}, roles: {}, links: {}, joins: [], holds: [] };
  const units: Unit[] = [];
  const positions: CommunityDoc['positions'][number][] = [];
  const fields: CommunityDoc['fields'][number][] = [];
  const blueprints: CommunityDoc['blueprints'][number][] = [];
  const persons: CommunityDoc['persons'][number][] = [];
  const taken = new Set<string>([top.key]);
  for (const part of parts) {
    const prefix = part.doc.unit.key;
    const rename = new Map<string, string>();
    for (const { unit } of flatten(part.doc.unit)) {
      const key = taken.has(unit.key) ? `${prefix}-${unit.key}`.slice(0, 40) : unit.key;
      rename.set(unit.key, key);
      taken.add(key);
    }
    const re = (u: Unit): Unit => ({ ...u, key: rename.get(u.key) ?? u.key, ...(u.units === undefined ? {} : { units: u.units.map(re) }) });
    units.push({ ...re(part.doc.unit), area: part.state.units[part.doc.unit.key] });
    for (const [k, v] of Object.entries(part.state.units)) state.units[rename.get(k) ?? k] = v;
    for (const [k, v] of Object.entries(part.state.councils)) state.councils[k] = v;
    for (const [k, v] of Object.entries(part.state.roles)) { const [u, p] = k.split('/'); state.roles[`${rename.get(u) ?? u}/${p}`] = v; }
    for (const p of part.doc.positions) if (!positions.some((x) => x.key === p.key)) positions.push(p);
    for (const f of part.doc.fields) if (!fields.some((x) => x.key === f.key)) fields.push(f);
    for (const b of part.doc.blueprints) if (!blueprints.some((x) => x.key === b.key)) blueprints.push(b);
    for (const p of part.doc.persons) {
      const places = p.places.map((pl) => ({ unit: rename.get(pl.unit) ?? pl.unit, position: pl.position }));
      const same = persons.findIndex((x) => x.key === p.key);
      if (same >= 0 && persons[same].name === p.name) persons[same] = { ...persons[same], places: [...persons[same].places, ...places] };
      else {
        const key = same >= 0 ? `${prefix}-${p.key}`.slice(0, 40) : p.key;
        persons.push({ ...p, key, places });
        const mark = part.state.links[p.key];
        if (mark !== undefined) state.links[key] = mark;
      }
    }
    state.joins.push(...part.state.joins);
    state.holds.push(...part.state.holds);
  }
  return {
    doc: { name: top.name, positions, fields, blueprints, unit: { key: top.key, name: top.name, kind: top.kind, units }, persons },
    state
  };
}
