/**
 * 0137 — DIE WSPÓLNOTA ALS JSON („recreatio/community", `src/app/communities/`), nachgemessen — ohne Dienst:
 *
 *   1. Die Beschreibung geht ohne App, nennt jeden Schlüssel der Beispiele; jedes Beispiel liest sich ohne Warnung.
 *   2. Export → Lesen ergibt dasselbe Dokument.
 *   3. Jede Einheit jedes Beispiels wird ein Dokument eines Bereichs, das `readAreaDocument` ohne Fehler nimmt.
 *   4. Erben: eigener Wert > Bauplan > Einheit darüber > Vorschlag; „nicht vererbt" bleibt, wo es steht.
 *   5. Zugänge aus dem Baum: Leitung admin unten, Begleitung read unten, „niżej widzą”, Gremium; die Leitung hält.
 *   6. Podgrupy według cechy, Obsada, Plan in Worten (neuer Link nur bei geänderten Plätzen), Zusammenlegen, Übernahme.
 *
 *   node scripts/app-json-community-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-json-community-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}communities/community';
export * from '${app}communities/communityJson';
export * from '${app}communities/communityCompile';
export { EXAMPLES } from '${app}communities/communityExamples';
export { readAreaDocument } from '${app}areas/areaJson';
export { describe, sectionsOf, samplesOf } from '${app}core/jsonTree';
export { carryOver, mergeCommunities } from '${app}communities/communityImport';
`);
await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }, loader: { '.css': 'empty' }, logLevel: 'error', jsx: 'automatic'
});
globalThis.BroadcastChannel = undefined;
const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
await rm(workspace, { recursive: true, force: true });

let checks = 0;
const ok = (cond, what) => { assert.ok(cond, what); checks += 1; };

/* 1. Beschreibung und Beispiele */
const text = m.communityDescription();
ok(text.includes('recreatio/community') && text.includes('Jak aplikacja używa tych danych'), 'description has intro and usage');
for (const key of ['positions', 'fields', 'blueprints', 'unit', 'persons', 'rights', 'pair', 'per', 'need', 'from', 'council', 'people', 'address', 'area', 'remove', 'extra', 'places', 'leadersOnly']) {
  ok(text.includes(`"${key}"`) || text.includes(`  ${key} `) || text.includes(`  ${key}:`) || text.includes(`${key} —`), `description names "${key}"`);
}
for (const s of m.SETTINGS) ok(text.includes(`"${s.path}"`), `description names setting ${s.path}`);
ok(m.samplesOf(m.COMMUNITY_JSON).length === m.EXAMPLES.length, 'every example is a sample');
const docs = {};
for (const e of m.EXAMPLES) {
  const read = m.readCommunity(e.doc());
  ok(!('error' in read), `example ${e.key} reads`);
  assert.deepEqual(read.warnings, [], `example ${e.key}: no warnings`);
  docs[e.key] = read.doc;
  /* 2. Rundweg */
  const again = m.readCommunity(JSON.parse(JSON.stringify(m.exportCommunity(read.doc))));
  ok(!('error' in again) && again.warnings.length === 0, `example ${e.key}: export reads again`);
  assert.deepEqual(m.exportCommunity(again.doc), m.exportCommunity(read.doc), `example ${e.key}: export → import → export is stable`);
  checks += 1;
}
ok('error' in m.readCommunity({ format: 'recreatio/area' }) && 'error' in m.readCommunity({ format: 'recreatio/community' }), 'wrong format / no unit → error');
{
  const bad = m.readCommunity({ format: 'recreatio/community', positions: [{ key: 'X Y', name: 'a' }, { key: 'a', name: 'A', rights: 'boss' }], unit: { name: 'Góra', settings: { life: { duration: 'forever' }, nope: { x: 1 } }, units: [{ key: 'a', name: 'A' }, { key: 'a', name: 'B' }] }, persons: [{ name: 'Jan', places: [{ unit: 'zzz', position: 'a' }] }] });
  ok(!('error' in bad) && bad.warnings.length >= 5 && bad.doc.unit.key === 'gora' && bad.doc.positions[0].rights === 'member', 'tolerant reading: warnings, not a crash');
}

/* 3. Jede Einheit → Dokument eines Bereichs */
const NOW = new Date('2026-11-05T10:00:00');
for (const [key, doc] of Object.entries(docs)) {
  const full = m.withAutoSubgroups(doc);
  for (const f of m.unitsOf(full)) {
    const compiled = m.compileUnit(full, f, NOW);
    const read = m.readAreaDocument(JSON.parse(JSON.stringify(compiled.doc)));
    ok(!('error' in read), `${key}/${f.unit.key}: area document reads`);
    const serious = read.warnings.filter((w) => !/publish/.test(w));
    assert.deepEqual(serious, [], `${key}/${f.unit.key}: area document without warnings`);
    ok(read.doc.roles.length === m.positionsOf(full, f.unit).length, `${key}/${f.unit.key}: one role per position`);
  }
}
{
  const turnus = docs.turnus;
  const top = m.compileUnit(turnus, m.findUnit(turnus, 'turnus-2'), NOW).doc;
  const main = top.pages.find((p) => p.key === 'main');
  const form = main.page.modules.find((x) => x.kind === 'form');
  ok(form !== undefined && form.memberRoles[0] === '@uczestnik' && form.needs.some((n) => n.id === 'minor') && form.needs.includes('health'), 'signup: form gives the participant role, minors and health needs');
  ok(top.subforms.some((s) => s.key === 'dla-prowadzacych' && s.questions.some((q) => q.id === 'dieta')), 'leaders-only fields go to a separate sub-form');
  ok(top.appointments.some((a) => a.key === 'main' && a.main === true && a.start === '2027-07-15'), 'limited: main appointment from..until');
  ok(top.chats.some((c) => typeof c === 'object' && c.kind === 'area') && top.chats.includes('channel'), 'chat with the signed-up and announcements');
  const choir = m.compileUnit(docs.chor, m.findUnit(docs.chor, 'chor'), NOW).doc;
  const meet = choir.appointments.find((a) => a.key === 'spotkanie');
  ok(meet !== undefined && meet.repeat === 'weekly' && meet.weekdays[0] === 'cz' && meet.start === '2026-11-05T19:00' && meet.end === '21:00' && meet.until === '2027-06-30', 'weekly meeting from step 1');
  ok(choir.appointments.some((a) => a.key === 'pasterka'), 'extra appointments are merged');
  ok(m.addressOf(docs.szkola, '2b') === 'liceum-jp2/2b' && m.addressOf(docs['grupa-nauki'], 'grawitacja') === 'grupa-grawitacja', 'addresses follow the tree');
}

/* 4. Erben */
{
  const s = docs.szkola;
  ok(m.resolveSetting(s, '2b', 'tools.cogita').source.kind === 'blueprint' && m.valueOf(s, '2b', 'tools.cogita') === true, 'blueprint wins over parent');
  ok(m.resolveSetting(s, '2b', 'tools.announcements').source.kind === 'unit' && m.valueOf(s, '2b', 'tools.announcements') === true, 'inherited from the school');
  ok(m.resolveSetting(s, '2b', 'visibility.subunitsSee').source.kind === 'default', 'not inherited: stays where it is set');
  ok(m.resolveSetting(s, 'szkola', 'tools.chat').source.kind === 'own' && m.valueOf(s, 'szkola', 'tools.chat') === false, 'own value');
  const tweaked = { ...s, unit: { ...s.unit, units: s.unit.units.map((u) => (u.key === '3a' ? { ...u, settings: { tools: { cogita: false } } } : u)) } };
  ok(m.valueOf(tweaked, '3a', 'tools.cogita') === false && m.valueOf(tweaked, '2b', 'tools.cogita') === true, 'a unit overrides its blueprint');
  const sug = m.suggestFrom({ duration: 'limited', open: 'anyone', place: 'onsite', rhythm: 'once' });
  ok(sug.intake.mode === 'signup' && sug.tools.staffing === true && sug.public.page === true, 'step 1 suggests steps 4–5');
  const kept = m.withSuggestions({ intake: { mode: 'leaders' } }, sug);
  ok(kept.intake.mode === 'leaders' && kept.tools.chat === true, 'suggestions never overwrite');
}

/* 5. Zugänge */
const fakeState = (doc) => {
  const state = { units: {}, councils: {}, roles: {}, links: {}, joins: [], holds: [] };
  for (const f of m.flatten(doc.unit)) {
    state.units[f.unit.key] = `area-${f.unit.key}`;
    const c = m.councilOf(doc, f.unit);
    if (c) state.councils[c.key] = `area-${c.key}`;
    for (const p of m.positionsOf(doc, f.unit)) state.roles[`${f.unit.key}/${p.key}`] = `role-${f.unit.key}-${p.key}`;
  }
  return state;
};
{
  const dk = docs['dk-rejon-13'];
  const st = fakeState(dk);
  const { joins, holds } = m.desiredAccess(dk, st);
  const has = (area, role, level) => joins.some((j) => j.areaId === area && j.roleId === role && j.level === level);
  ok(has('area-krag-13-2', 'role-rejon-13-para-rejonowa', 'admin'), 'lead: admin in every unit below');
  ok(has('area-krag-13-2', 'role-rejon-13-moderator-rejonu', 'read'), 'accompany: reads below');
  ok(has('area-rejon-13', 'role-krag-13-1-czlonek', 'read'), 'subunits see the rejon');
  ok(has('area-krag-rejonowy-13', 'role-krag-13-3-para-animatorska', 'write') && has('area-krag-rejonowy-13', 'role-rejon-13-moderator-rejonu', 'write'), 'council: own and below positions');
  ok(!joins.some((j) => j.areaId === 'area-krag-rejonowy-13' && j.roleId === 'role-krag-13-1-czlonek'), 'council: not the members');
  ok(holds.some((h) => h.holder === 'role-krag-13-1-para-animatorska' && h.held === 'role-krag-13-1-czlonek'), 'the lead holds the other positions of its unit');
  ok(new Set(joins.map((j) => `${j.areaId}|${j.roleId}`)).size === joins.length, 'one join per area and role (the strongest)');
  const roles = m.personRoles(dk, st, 'anna-kowalska');
  ok(roles.length === 2 && roles.some((r) => r.roleId === 'role-rejon-13-para-rejonowa' && r.lead) && roles.some((r) => r.roleId === 'role-krag-13-3-czlonek' && !r.lead), 'one link holds all roles of a person');
  ok(!m.linkLabel(dk, 'anna-kowalska').includes('Kowalska'), 'the link label carries no name');
  const view = m.unitView(dk, st, 'krag-13-3', 'area-rejon-13', 'dk/rejon-13/krag-13-3/dla-nas', NOW);
  ok(view.people.some((p) => p.name === 'Anna Kowalska' && p.positions[0] === 'czlonek') && view.positions.length === 3, 'unit view: people and positions of this unit');
}

/* 6. Podgrupy, Obsada, Plan, Zusammenlegen */
{
  const full = m.withAutoSubgroups(docs.chor);
  const subs = full.unit.units.map((u) => u.key);
  ok(['chor-sopran', 'chor-alt', 'chor-tenor', 'chor-bas'].every((k) => subs.includes(k)), 'subgroups by voice');
  ok(full.persons.find((p) => p.key === 'bartek-wos').places.some((pl) => pl.unit === 'chor-tenor'), 'a tenor lands among the tenors');
  const st = m.staffing(docs.turnus).find((x) => x.unit === 'grupa-ond' && x.position === 'animator');
  ok(st === undefined, 'staffing: a group without participants and without a limit wants nobody yet');
  const top = m.staffing({ ...docs.turnus, unit: { ...docs.turnus.unit, positions: [...docs.turnus.unit.positions, 'animator'] } }).find((x) => x.unit === 'turnus-2' && x.position === 'animator');
  ok(top !== undefined && top.want === 10, '38 places / 4 = 10 animators wanted');
}
{
  const dk = docs['dk-rejon-13'];
  const st = fakeState(dk);
  for (const p of dk.persons) st.links[p.key] = { invitationId: `inv-${p.key}`, linkRoleId: `link-${p.key}`, roles: m.personRoles(dk, st, p.key).map((r) => r.roleId), at: '' };
  const before = { kind: 'community', doc: dk, state: st, view: m.unitView(dk, st, 'rejon-13', 'area-rejon-13', null) };
  const names = new Map(m.flatten(dk.unit).map((f) => [`area-${f.unit.key}`, f.unit.name]));
  const same = m.planLines(dk, before, names);
  ok(!same.some((l) => l.kind === 'person' || l.kind === 'unit'), 'the same document plans no unit or person change');
  const moved = { ...dk, persons: dk.persons.map((p) => (p.key === 'maria-lis' ? { ...p, places: [{ unit: 'krag-13-2', position: 'czlonek' }] } : p)) };
  ok(m.planLines(moved, before, names).some((l) => l.text.startsWith('Maria Lis: miejsca się zmieniły')), 'changed places → new link');
  const fresh = m.planLines(dk, null, new Map());
  ok(fresh.filter((l) => l.kind === 'person').length === dk.persons.length && fresh.some((l) => l.text.startsWith('Nowa jednostka: „Rejon XIII”')), 'a new community plans everything');
  const kept = m.carryOver(dk, { ...dk, persons: dk.persons.slice(0, 2), unit: { ...dk.unit, units: dk.unit.units.slice(0, 1) } });
  ok(kept.persons.length === dk.persons.length && m.flatten(kept.unit).length === m.flatten(dk.unit).length, 'missing persons and units stay');
  const one = docs['dk-rejon-1'];
  const merged = m.mergeCommunities([{ doc: dk, state: st }, { doc: one, state: fakeState(one) }], { key: 'diecezja', name: 'Archidiecezja krakowska', kind: 'organisation' });
  const keys = m.flatten(merged.doc.unit).map((f) => f.unit.key);
  ok(merged.doc.unit.units.length === 2 && merged.doc.unit.units[0].area === 'area-rejon-13' && new Set(keys).size === keys.length, 'merge: both rejony under the diocese, keys unique');
  ok(merged.state.roles['krag-1-1/czlonek'] === 'role-krag-1-1-czlonek' && merged.doc.persons.length === dk.persons.length + one.persons.length, 'merge keeps roles and persons');
  const again = m.readCommunity(JSON.parse(JSON.stringify(m.exportCommunity(merged.doc))));
  ok(!('error' in again), 'merged document exports and reads');
}

console.log(`community JSON: ${checks} checks pass.`);
