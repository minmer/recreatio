/**
 * 2026-10-29 — DAS JSON DER ROLLEN („recreatio/roles", `src/app/roles/rolesJson.ts`), nachgemessen — ohne
 * Dienst und ohne Schlüssel: der Stand des Kontos ist erfunden, die Schritte des Imports sind nachgebildet.
 *
 *   1. Die Beschreibung geht ohne App (ein Knoten, `describe`), nennt jeden Schlüssel, und jeder Schlüssel der
 *      Beispiele und des Exports ist beschrieben — keiner beschrieben, der nirgends vorkommt.
 *   2. Export → Text → Plan desselben Dokuments: nichts zu tun, jede Kennung erkannt.
 *   3. An Ort und Stelle: Name, Art, neue Halter; ein Eintrag ohne "id" wird neu — unter dem, der ihn führt,
 *      und nach seinem Halter, wenn der auch neu ist.
 *   4. Nur, was das Konto geben kann: keine Personen, nichts am Konto vorbei, kein „sign" ohne Signierschlüssel,
 *      kein Kreis, nichts an Rollen der Links oder an verschlossenen; höchstens 50 neue Rollen.
 *   5. Kaputte Werte geben Warnungen, keinen Absturz.
 *   6. Ausführen: Reihenfolge, Fortschritt je Rolle; was an einer gescheiterten Rolle hängt, unterbleibt.
 *   7. Der Stand aus Graph, Bund und Bereichen (`rolesStateOf`) — und auch dessen Export plant nichts.
 *
 *   node scripts/app-json-roles-check.mjs
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-json-roles-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}roles/rolesJson';
export { describe, sectionsOf, samplesOf } from '${app}core/jsonTree';
`);
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
});

/* Wie in app-json-check: ein BroadcastChannel des Schlüsselbunds hielte den Lauf sonst am Leben. */
const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Jeder Schlüssel eines Dokuments als Pfad: `roles`, `roles[].holders[].by`. */
function pathsOf(value, prefix = '', out = new Set()) {
  for (const [key, one] of Object.entries(value)) {
    const path = `${prefix}${key}`;
    out.add(path);
    if (isPlain(one)) pathsOf(one, `${path}.`, out);
    else if (Array.isArray(one)) for (const item of one) if (isPlain(item)) pathsOf(item, `${path}[].`, out);
  }
  return out;
}

/* -- Ein erfundenes Konto ------------------------------------------------------------------------- */

const id = (n) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const ACC = id(100), ME = id(1), ANNA = id(2), PROB = id(3), RADA = id(4), SCHOLA = id(5), LINK = id(6), LOCKED = id(7), MINI = id(8);
const role = (n, kind, name, more = {}) => ({
  id: id(n), kind, name, readable: true, leads: true, passesSign: true, link: false, areas: [],
  createdAt: `2026-01-${String(n).padStart(2, '0')}T08:00:00Z`, ...more
});
const edge = (from, to, level, sign = level === 'holds') => ({ from, to, level, sign, createdAt: '2026-02-01T08:00:00Z' });
const state = {
  accountId: ACC, accountLeads: true, selfId: ME,
  roles: [
    role(1, 'person', 'Michał Nowak'),
    role(2, 'person', 'Anna Nowak'),
    role(3, 'role', 'Proboszcz', { areas: [{ name: 'Parafia św. Jana', level: 'admin' }] }),
    role(4, 'group', 'Rada parafialna'),
    role(5, 'group', 'Schola'),
    role(6, 'role', 'Link: Rada', { link: true }),
    role(7, 'role', null, { readable: false, leads: false, passesSign: false }),
    /* Anna gehört dazu, führt aber nicht: kein Signierschlüssel im Bund. */
    role(8, 'group', 'Ministranci', { leads: false, passesSign: false })
  ],
  holdings: [
    edge(ACC, ME, 'holds'), edge(ACC, ANNA, 'holds'),
    edge(ME, PROB, 'holds'), edge(PROB, RADA, 'holds'), edge(PROB, SCHOLA, 'holds'),
    edge(RADA, SCHOLA, 'read'), edge(ME, LINK, 'holds'), edge(LINK, RADA, 'holds', false),
    edge(ME, LOCKED, 'holds'), edge(ANNA, MINI, 'holds', false), edge(LOCKED, MINI, 'write')
  ]
};

const has = (list, part) => list.some((line) => line.includes(part));
const warned = (plan, part) => assert.ok(has(plan.warnings, part), `warning "${part}" expected in:\n  ${plan.warnings.join('\n  ')}`);

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);

  /* -- 1: die Beschreibung ---------------------------------------------------------------------- */
  const text = m.describe(m.ROLES_JSON);
  assert.equal(m.rolesDescription(), text, 'rolesDescription() is describe(ROLES_JSON)');
  assert.ok(text.includes('"recreatio/roles"') && text.includes('RSA-4096') && text.includes('#/workspace/roles'), 'the description names the format, the cost and the place');
  for (const path of Object.keys(m.ROLES_PATHS)) {
    const key = path.split(/[.[\]]+/).filter(Boolean).pop();
    assert.ok(text.includes(`"${key}"`), `the description names "${key}" (${path})`);
  }
  for (const [path, says] of Object.entries(m.ROLES_PATHS)) assert.ok(typeof says === 'string' && says.trim().length > 3, `"${path}" has a real sentence`);
  assert.ok(m.sectionsOf(m.ROLES_JSON).length >= 3, 'the format has its entry and holder sections');
  const samples = m.samplesOf(m.ROLES_JSON);
  assert.ok(samples.length >= 1, 'at least one sample to insert');

  const described = new Set(Object.keys(m.ROLES_PATHS));
  const covered = new Set();
  const exported = m.exportRoles(state);
  for (const [label, doc] of [...samples.map((s) => [s.label, s.doc()]), ['export', exported]]) {
    for (const path of pathsOf(doc)) {
      assert.ok(described.has(path), `${label}: "${path}" is in the document but not described`);
      covered.add(path);
    }
  }
  for (const path of described) assert.ok(covered.has(path), `"${path}" is described but in no sample and no export`);
  ok(`description without app context: ${text.length} characters, ${described.size} keys, every key of ${samples.length} samples and the export described`);

  /* -- 2: Export → Text → Plan: nichts zu tun ---------------------------------------------------- */
  const doc = JSON.parse(JSON.stringify(exported));
  assert.equal(doc.format, 'recreatio/roles');
  assert.equal(doc.version, 1);
  assert.equal(doc.sealed, 1, 'the locked role is counted, not exported');
  const ids = doc.roles.map((r) => r.id);
  assert.deepEqual(new Set(ids), new Set([ME, ANNA, PROB, RADA, SCHOLA, LINK, MINI]), 'every readable role, no account, no locked role');
  const at = new Map(ids.map((x, i) => [x, i]));
  assert.ok(at.get(ME) < at.get(PROB) && at.get(PROB) < at.get(RADA) && at.get(ANNA) < at.get(MINI), 'who holds stands before what is held');
  const entryOf = (x) => doc.roles.find((r) => r.id === x);
  assert.equal(entryOf(ME).key, 'ja', 'the first person is "ja"');
  assert.deepEqual(entryOf(ME).holders, [{ by: '@konto', level: 'holds', sign: true }]);
  assert.deepEqual(entryOf(RADA).holders, [{ by: '@proboszcz', level: 'holds', sign: true }, { by: '@link-rada', level: 'holds', sign: false }]);
  assert.deepEqual(entryOf(SCHOLA).holders, [{ by: '@proboszcz', level: 'holds', sign: true }, { by: '@rada-parafialna', level: 'read' }]);
  assert.deepEqual(entryOf(MINI).holders, [{ by: '@anna-nowak', level: 'holds', sign: false }], 'a holder the account cannot open is left out');
  assert.equal(entryOf(LINK).link, true);
  assert.deepEqual(entryOf(PROB).areas, [{ name: 'Parafia św. Jana', level: 'admin' }]);

  const same = m.planRolesImport(doc, state);
  assert.ok(!('error' in same), 'the export reads back');
  assert.deepEqual([same.creates.length, same.renames.length, same.retypes.length, same.holdings.length], [0, 0, 0, 0], 'an unchanged export changes nothing');
  assert.deepEqual(same.warnings, [], 'an unchanged export gives no warnings');
  assert.deepEqual(new Set(same.known), new Set(ids), 'every id is recognised');
  assert.equal(same.lines[0], 'Nic się nie zmieni.');
  assert.ok(has(same.lines, 'powiązań, które już są: 9'), same.lines.join(' | '));
  ok('export → text → plan: nothing to do, every id kept, holders first, "@ja" and "@konto", link roles and areas as information');

  /* -- 3: an Ort und Stelle; ohne "id" neu ------------------------------------------------------- */
  const edited = JSON.parse(JSON.stringify(exported));
  edited.roles.find((r) => r.id === RADA).name = 'Rada duszpasterska';
  edited.roles.find((r) => r.id === SCHOLA).kind = 'role';
  edited.roles.find((r) => r.id === SCHOLA).holders.push({ by: '@anna-nowak', level: 'read' });
  /* Der Abhängige zuerst — er entsteht trotzdem nach seinem Halter. */
  edited.roles.push({ key: 'mlodsi', kind: 'grupa', name: 'Młodsi lektorzy', holders: ['@lektorzy'] });
  edited.roles.push({ key: 'lektorzy', kind: 'group', name: 'Lektorzy', holders: [{ by: '@proboszcz' }, { by: '@rada-parafialna', level: 'write' }] });
  const change = m.planRolesImport(edited, state);
  assert.ok(!('error' in change));
  assert.deepEqual(change.warnings, []);
  assert.deepEqual(change.renames, [{ roleId: RADA, from: 'Rada parafialna', to: 'Rada duszpasterska' }]);
  assert.deepEqual(change.retypes, [{ roleId: SCHOLA, name: 'Schola', to: 'role' }]);
  assert.deepEqual(change.creates.map((c) => [c.key, c.kind, c.name, c.holder]), [
    ['lektorzy', 'group', 'Lektorzy', { id: PROB }],
    ['mlodsi', 'group', 'Młodsi lektorzy', { key: 'lektorzy' }]
  ], 'entries without id are new — in the order of their holders');
  assert.deepEqual(change.holdings.map((h) => [h.role, h.holder, h.level, h.sign]), [
    [{ id: SCHOLA }, { id: ANNA }, 'read', false],
    [{ key: 'lektorzy' }, { id: RADA }, 'write', false]
  ]);
  assert.ok(change.lines[0].includes('Nowe role: 2') && change.lines[0].includes('kilka sekund'), 'the preview says how many new roles and that each takes seconds');
  assert.equal(change.known.length, ids.length, 'the edited entries keep their ids');
  /* Nichts wird weggenommen: aus „read" wird nicht „write" — „write" kommt dazu, und die Vorschau sagt es. */
  const relevel = JSON.parse(JSON.stringify(exported));
  relevel.roles.find((r) => r.id === SCHOLA).holders.find((h) => h.by === '@rada-parafialna').level = 'write';
  const rl = m.planRolesImport(relevel, state);
  assert.deepEqual(rl.holdings.map((h) => [h.role, h.holder, h.level, h.sign]), [[{ id: SCHOLA }, { id: RADA }, 'write', false]]);
  warned(rl, '„Rada parafialna” trzyma już „Schola” (czyta) — to powiązanie zostaje obok nowego');
  ok('in place: rename, role ↔ group, a new holder (another level adds, never replaces); without id: new roles, created after the new role that holds them');

  /* -- 4: nur, was das Konto geben kann ---------------------------------------------------------- */
  const rights = m.planRolesImport({
    format: 'recreatio/roles', version: 1, roles: [
      { key: 'osoba', kind: 'person', name: 'Jan Kowalski', holders: ['@ja'] },
      { key: 'pod-kontem', name: 'Pod kontem', holders: ['@konto'] },
      { key: 'pod-ministrantami', name: 'Pod ministrantami', holders: [MINI] },
      { key: 'pod-linkiem', name: 'Pod linkiem', holders: [LINK] },
      { key: 'bez-nazwy', holders: ['@ja'] },
      { key: 'sierota', name: 'Sierota' },
      { key: 'tylko-czyta', name: 'Tylko czyta', holders: [{ by: '@ja', level: 'read' }] },
      { key: 'pod-osoba', name: 'Pod osobą, która nie powstanie', holders: ['@osoba'] },
      { id: MINI, holders: [{ by: '@ja', level: 'holds', sign: true }] },
      { id: MINI, name: 'Ministranci 2' },
      { id: SCHOLA, holders: [{ by: PROB }, { by: RADA, level: 'read', sign: true }] },
      { id: PROB, holders: [{ by: SCHOLA, level: 'read' }, { by: '@konto' }] },
      { id: RADA, holders: [{ by: MINI, level: 'read' }, { by: LINK, level: 'read' }, { by: '@ja', level: 'holds', sign: false }] },
      { id: ANNA, kind: 'role', holders: [{ by: PROB, level: 'read' }] },
      { id: LINK, name: 'Inna nazwa' },
      { id: LOCKED, name: 'Otwarta' },
      { id: 'ffffffff-0000-7000-8000-000000000000', name: 'Obca' },
      { id: ACC, name: 'Konto' }
    ]
  }, state);
  assert.ok(!('error' in rights));
  assert.equal(rights.creates.length, 0, 'none of these can be created');
  assert.deepEqual(rights.holdings.map((h) => [h.role, h.holder, h.level, h.sign]), [
    [{ id: RADA }, { id: ME }, 'holds', false],
    [{ id: ANNA }, { id: PROB }, 'read', false]
  ], 'only what the account may give');
  for (const part of [
    'osób import nie zakłada', 'konto trzyma tylko osoby — rolę albo grupę załóż pod osobą', 'nie prowadzisz „Ministranci” z podpisem — pominięta',
    '„Link: Rada” to rola linku dostępu', 'nowa rola potrzebuje nazwy', 'nowa rola potrzebuje "holders"', 'nikt jej nie prowadzi', '„@osoba” nie powstanie',
    'nie masz klucza podpisu „Ministranci”', 'ta sama rola ("id") drugi raz', 'klucz podpisu idzie tylko z "holds"', 'zamknęłoby krąg',
    'konto trzyma tylko osoby i tylko prowadząc', 'nie prowadzisz „Ministranci” z podpisem — w jej imieniu', 'role linków dostępu zmienia się przy linkach',
    'Uwaga: „Proboszcz” dostanie klucz osoby „Anna Nowak”', 'rodzaju „osoba” nie da się zmienić', 'jej nazwę zmienia się przy linku',
    'nie otwierasz w tej przeglądarce', 'nie ma takiej roli w tym koncie', 'to konto, nie rola'
  ]) warned(rights, part);
  assert.ok(!has(rights.lines, 'Nowe role'), 'nothing new is announced');

  const many = m.planRolesImport({ roles: Array.from({ length: 55 }, (_, i) => ({ name: `Rola ${i + 1}`, holders: ['@ja'] })) }, state);
  assert.equal(many.creates.length, 50, 'at most 50 new roles per import');
  warned(many, 'Najwyżej 50 nowych ról');
  const circle = m.planRolesImport({ roles: [{ key: 'a', name: 'A', holders: ['@b'] }, { key: 'b', name: 'B', holders: ['@a'] }] }, state);
  assert.equal(circle.creates.length, 0, 'new roles holding each other in a circle are not created');
  warned(circle, 'w kółko');
  ok('only what the account may give: no persons, no account, no sign key it lacks, no circle, no link or locked roles, at most 50 new');

  /* -- 5: kaputte Werte -------------------------------------------------------------------------- */
  for (const bad of ['nonsense', null, 42, [], [{ name: 'x' }], { roles: 'x' }, { roles: {} }, { format: 'recreatio/page', roles: [] }]) {
    const plan = m.planRolesImport(bad, state);
    assert.ok('error' in plan && typeof plan.error === 'string' && plan.error.length > 0, `${JSON.stringify(bad)} is refused with a sentence`);
  }
  assert.ok('error' in m.planRolesImport({ roles: [] }, { ...state, accountId: null }), 'an account without roles cannot import');
  const messy = m.planRolesImport({
    format: 'recreatio/roles', version: 9, extra: true, roles: [
      null, 5, 'tekst', [],
      { kind: 7, name: 'Zły rodzaj', holders: ['@ja'] },
      { name: { x: 1 }, holders: ['@ja'] },
      { name: 'Złe holders', holders: 'x' },
      { name: 'Złe pozycje', holders: [5, { by: 7 }, { by: '@nope' }, { by: '@ja', level: 'boss' }, { by: '@ja', level: { a: 1 } }, { by: '@ja', sign: 'tak' }, '', { by: '@ja', what: 1 }] },
      { id: 12345, name: 'Liczba jako id' },
      { key: '!!!', name: 'Zły klucz', holders: ['@ja'] },
      { key: 'konto', name: 'Zarezerwowany', holders: ['@ja'] },
      { key: 'ja', name: 'Też zarezerwowany', holders: ['@ja'] },
      { key: 'dwa', name: 'Pierwszy', holders: ['@ja'] },
      { key: 'dwa', name: 'Drugi', holders: ['@dwa'] },
      { name: 'x'.repeat(300), holders: ['@ja'] },
      { name: '   ', holders: ['@ja'] },
      { id: RADA, name: '' },
      { name: 'Nieznany klucz', holders: ['@ja'], color: 'red' }
    ]
  }, state);
  assert.ok(!('error' in messy), 'a messy document is read, not refused');
  for (const part of [
    'Nieznany klucz "extra"', 'Wersja 9', 'Wpis 1: to nie jest obiekt', 'nieznany rodzaj 7', '"name" musi być tekstem', '"holders" musi być listą',
    'to nie jest odwołanie ani obiekt', 'brak "by"', 'prowadzi donikąd', 'nieznany stopień "boss"', '"sign" to true albo false', 'puste odwołanie',
    'nieznany klucz "what"', 'to samo powiązanie drugi raz', '"id" musi być tekstem', 'tylko litery, cyfry', 'klucz „konto” jest zarezerwowany',
    'klucz „ja” jest zarezerwowany', 'klucz „dwa” drugi raz', 'skrócona', 'pusta nazwa — zostaje', 'nieznany klucz "color"'
  ]) warned(messy, part);
  const madeNames = messy.creates.map((c) => c.name);
  for (const name of ['Zły rodzaj', 'Złe pozycje', 'Zły klucz', 'Zarezerwowany', 'Pierwszy', 'Drugi', 'x'.repeat(200), 'Nieznany klucz']) {
    assert.ok(madeNames.includes(name), `"${name.slice(0, 20)}" is still planned`);
  }
  assert.deepEqual(messy.creates.find((c) => c.name === 'Drugi').holder, { key: 'dwa' }, '"@dwa" leads to the first entry with that key');
  assert.equal(messy.creates.find((c) => c.name === 'Zły rodzaj').kind, 'role', 'an unknown kind becomes a role');
  assert.equal(messy.renames.length, 0, 'an empty name renames nothing');
  ok(`malformed documents: refused with a sentence or read with ${messy.warnings.length} warnings — never a crash`);

  /* -- 6: ausführen -------------------------------------------------------------------------------- */
  const sample = m.planRolesImport(samples[0].doc(), state);
  assert.deepEqual(sample.warnings, [], 'the parish sample imports without a word');
  assert.deepEqual(sample.creates.map((c) => c.key), ['proboszcz', 'kancelaria', 'rada', 'schola']);
  assert.deepEqual(sample.creates[0].holder, { id: ME }, '"@ja" is the first person');
  for (const s of samples.slice(1)) assert.deepEqual(m.planRolesImport(s.doc(), state).warnings, [], `sample "${s.label}" imports without a word`);

  const calls = [];
  const stages = [];
  let made = 0;
  const ops = {
    create: async (holder, kind, name) => { calls.push(['create', holder, kind, name]); made += 1; return id(500 + made); },
    rename: async (roleId, name) => { calls.push(['rename', roleId, name]); },
    retype: async (roleId, kind) => { calls.push(['retype', roleId, kind]); },
    hold: async (roleId, holder, level, sign) => { calls.push(['hold', roleId, holder, level, sign]); }
  };
  const done = await m.applyRolesImport(sample, ops, (what) => stages.push(what));
  assert.deepEqual(calls, [
    ['create', ME, 'role', 'Proboszcz'],
    ['create', id(501), 'role', 'Kancelaria parafialna'],
    ['create', id(501), 'group', 'Rada parafialna'],
    ['create', id(501), 'group', 'Schola'],
    ['hold', id(503), id(502), 'read', false],
    ['hold', id(504), id(503), 'read', false]
  ], 'created in order under the ids just made, then the holders');
  for (const n of [1, 2, 3, 4]) assert.ok(stages.some((s) => s.startsWith(`Rola ${n} z 4:`)), `progress for role ${n} of 4`);
  assert.deepEqual(done.warnings, []);
  assert.deepEqual(done.lines, ['Nowe role: 4 z 4.', 'Nowe powiązania: 2 z 2.']);

  calls.length = 0;
  made = 0;
  const failing = { ...ops, create: async (holder, kind, name) => { if (name === 'Proboszcz') throw new Error('Ta rola nie jest Twoja.'); return ops.create(holder, kind, name); } };
  const broken = await m.applyRolesImport(sample, failing);
  assert.deepEqual(calls, [], 'nothing hangs on a role that was not made');
  assert.ok(has(broken.warnings, 'Ta rola nie jest Twoja.') && broken.warnings.filter((w) => w.includes('nie powstała, bo')).length === 3);
  assert.equal(broken.warnings.filter((w) => w.includes('rola nie powstała')).length, 2);
  assert.deepEqual(broken.lines, ['Nowe role: 0 z 4.', 'Nowe powiązania: 0 z 2.']);

  calls.length = 0;
  const inPlace = await m.applyRolesImport(change, ops);
  assert.deepEqual(calls.filter((c) => c[0] !== 'create').map((c) => c[0]), ['rename', 'retype', 'hold', 'hold'], 'names and kinds before the holders');
  assert.deepEqual(inPlace.warnings, []);
  ok('apply: new roles in order with progress per role, then names, kinds, holders; a failed role takes what hangs on it along');

  /* -- 7: der Stand aus Graph und Bund ----------------------------------------------------------- */
  const OLDLINK = id(9);
  const at0 = '2026-01-01T00:00:00Z';
  const sealedRole = (rid, kind, more = {}) => ({
    id: rid, kind, isPersonal: false, createdAt: at0, displayNameSealed: 'x', wrapPublicKey: 'x', signPublicKey: 'x',
    wrapPrivateSealed: 'x', signPrivateSealed: 'x', keyLayout: 1, ...more
  });
  const wire = (n, from, to, edgeKind) => ({ id: id(900 + n), fromRoleId: from, toRoleId: to, signerRoleId: from, edgeKind, createdAt: at0, expiresAt: null });
  const graph = {
    personRoleId: ACC,
    roles: [
      sealedRole(ACC, 'account', { isPersonal: true, keyLayout: 0 }), sealedRole(ME, 'person'), sealedRole(PROB, 'role'),
      sealedRole(LINK, 'role'), sealedRole(OLDLINK, 'role'), sealedRole(LOCKED, 'group')
    ],
    edges: [
      wire(1, ACC, ME, 'holds'), wire(2, ME, PROB, 'holds'), wire(3, ME, LINK, 'holds'), wire(4, ME, OLDLINK, 'holds'),
      wire(5, PROB, LOCKED, 'read'), wire(6, ME, PROB, 'certify')
    ],
    grants: [
      { holderRoleId: ACC, roleId: ME, sealedBlob: 'x', keyKind: 'role' }, { holderRoleId: ACC, roleId: ME, sealedBlob: 'x', keyKind: 'role_sign' },
      { holderRoleId: ME, roleId: PROB, sealedBlob: 'x', keyKind: 'role' }, { holderRoleId: ME, roleId: PROB, sealedBlob: 'x', keyKind: 'role_sign' },
      { holderRoleId: ME, roleId: LINK, sealedBlob: 'x', keyKind: 'role' }
    ]
  };
  const ring = {
    has: (x) => x !== LOCKED,
    maySign: (x) => [ACC, ME, PROB].includes(x),
    signKeyOf: (x) => ([ME, PROB].includes(x) ? new Uint8Array(32) : null)
  };
  const names = new Map([[ACC, 'Konto'], [ME, 'Michał'], [PROB, '  Proboszcz  '], [LINK, 'Zaproszenie'], [OLDLINK, 'Link: Stary']]);
  const reach = [
    { roleId: PROB, link: false, holds: [], areas: [{ areaId: 'a1', name: 'Parafia', capability: 'admin' }] },
    { roleId: LINK, link: true, holds: [], areas: [] }
  ];
  const st = m.rolesStateOf(graph, ring, names, reach);
  const fact = (x) => st.roles.find((r) => r.id === x);
  assert.deepEqual([st.accountId, st.selfId, st.accountLeads], [ACC, ME, true]);
  assert.ok(fact(ACC) === undefined, 'the account is not a role of the document');
  assert.equal(fact(PROB).name, 'Proboszcz');
  assert.deepEqual(fact(PROB).areas, [{ name: 'Parafia', level: 'admin' }]);
  assert.deepEqual([fact(LINK).link, fact(OLDLINK).link, fact(PROB).link], [true, true, false], 'link roles from the service and by the old name');
  assert.deepEqual([fact(LOCKED).readable, fact(LOCKED).name, fact(LOCKED).leads], [false, null, false]);
  assert.deepEqual([fact(ME).leads, fact(LINK).leads, fact(PROB).passesSign, fact(LINK).passesSign], [true, false, true, false]);
  const signOf = (from, to) => st.holdings.find((h) => h.from === from && h.to === to && h.level === 'holds')?.sign;
  assert.deepEqual([signOf(ACC, ME), signOf(ME, PROB), signOf(ME, LINK)], [true, true, false], 'the sign key from the role_sign grants');
  assert.ok(!st.holdings.some((h) => h.level === 'certify'), 'an unknown edge kind is not a holding');
  assert.equal(m.rolesStateOf(graph, ring, names, null).roles.find((r) => r.id === LINK).link, false, 'without the service only the old name tells');
  const round = m.planRolesImport(JSON.parse(JSON.stringify(m.exportRoles(st))), st);
  assert.deepEqual([round.creates.length, round.renames.length, round.retypes.length, round.holdings.length, round.warnings.length], [0, 0, 0, 0, 0]);
  ok('state from graph, ring and reach: names opened, link roles, sign keys from grants — and its export plans nothing');

  console.log('Roles JSON holds.');
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
