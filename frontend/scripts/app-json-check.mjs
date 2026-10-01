/**
 * 0064 — DAS JSON DER SEITEN UND MODULE, nachgemessen.
 *
 * Die Beschreibung neben jedem Import wird aus den Bausteinen erzeugt. Damit
 * sie nicht hinter ihnen zurückbleibt, prüft dieser Lauf:
 *
 *   1. Jede Art hat ein Beispiel, und JEDER Schlüssel darin ist beschrieben —
 *      keiner beschrieben, den es nicht gibt. Wer einer Art einen Schlüssel
 *      gibt, ohne ihn zu beschreiben, fällt hier auf.
 *   2. JSON → Tafel → JSON verliert nichts.
 *   3. Export → Import einer Seite behält jede Kennung: Stelle, Modul, Platz,
 *      Inhalt — geändert wird an Ort und Stelle, nichts entsteht neu.
 *   4. Neue Einträge bekommen neue Kennungen und einen freien Platz; die Karte
 *      der Seite folgt ihnen.
 *   5. Die Beschreibung nennt jede Art und jeden Schlüssel.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-json-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export { PARTS, partOf } from '${app}parts/registry';
export * from '${app}pageJson';
export { QUESTION_EXAMPLE, QUESTION_KEYS, readQuestions } from '${app}formJson';
export { BREAKPOINTS } from '${app}layout';
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

/* Wie in app-chat-check: ein BroadcastChannel des Schlüsselbunds hielte den Lauf sonst am Leben. */
const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Jeder Schlüssel eines Dokuments als Pfad: `groups`, `groups[].rows[].time`. */
function pathsOf(value, prefix = '', out = new Set()) {
  for (const [key, one] of Object.entries(value)) {
    const path = `${prefix}${key}`;
    out.add(path);
    if (isPlain(one)) pathsOf(one, `${path}.`, out);
    else if (Array.isArray(one)) for (const item of one) if (isPlain(item)) pathsOf(item, `${path}[].`, out);
  }
  return out;
}

const top = (path) => path.split(/[.[]/)[0];

function documented(label, example, keys) {
  const paths = pathsOf(example);
  for (const path of paths) assert.ok(keys[path] !== undefined, `${label}: "${path}" is in the example but not described`);
  const tops = new Set([...paths].map(top));
  for (const key of Object.keys(keys)) assert.ok(tops.has(top(key)), `${label}: "${key}" is described but not in the example`);
  for (const [key, says] of Object.entries(keys)) assert.ok(typeof says === 'string' && says.trim().length > 3, `${label}: "${key}" has a real sentence`);
}

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);

  /* -- 1 und 2: jede Art ------------------------------------------------------------- */
  for (const def of m.PARTS) {
    const json = def.json;
    assert.ok(json && typeof json.toJson === 'function' && typeof json.fromJson === 'function', `${def.kind}: has a JSON contract`);
    assert.ok(isPlain(json.example) && Object.keys(json.example).length > 0, `${def.kind}: has a filled example`);
    documented(def.kind, json.example, json.keys);

    for (const field of def.fields) {
      assert.ok(json.example[field.key] !== undefined, `${def.kind}: field "${field.key}" appears in the example`);
    }

    const stored = json.fromJson(json.example);
    assert.deepEqual(json.toJson(stored), json.example, `${def.kind}: JSON → stored → JSON is lossless`);
    assert.equal(def.hasContent(stored), true, `${def.kind}: the example has something to show`);
    assert.deepEqual(json.fromJson('nonsense'), def.Editor === null ? {} : json.fromJson({}), `${def.kind}: garbage reads as empty`);
    assert.deepEqual(json.fromJson(null), json.fromJson({}), `${def.kind}: null reads as empty`);
  }
  ok(`${m.PARTS.length} kinds: example, every key described, nothing described that is not there, lossless round trip`);

  /* Flach: Listen werden Zeilen, Zahlen Text, Leeres fällt weg. */
  const text = m.partOf('text').json;
  assert.deepEqual(text.fromJson({ title: 'A', body: ['x', '## y', 'z'], empty: '', gone: null }), { title: 'A', body: 'x\n## y\nz' });
  assert.deepEqual(text.toJson({ title: 'A', body: 'x\n\nz', extra: 'kept' }), { title: 'A', body: ['x', '', 'z'], extra: 'kept' });
  const masses = m.partOf('masses').json;
  assert.deepEqual(masses.fromJson({ days: 7 }), { days: '7' });
  const calendar = m.partOf('calendar').json;
  assert.deepEqual(calendar.fromJson({ calendars: ['a', 'b'] }), { calendars: 'a,b' });
  assert.deepEqual(calendar.toJson({ calendars: 'a, b' }), { calendars: ['a', 'b'] });
  const form = m.partOf('form').json;
  assert.deepEqual(form.toJson({ smsTemplates: '[{"label":"L","text":"T"}]' }), { smsTemplates: [{ label: 'L', text: 'T' }] });
  ok('flat parts: lines as lists, ids as lists, numbers as text, JSON keys as objects, unknown keys kept');

  /* Ereignisse: der Inhalt offen, auch in der Gestalt des Altbestands. */
  const plan = m.partOf('plan').json;
  const legacyShape = plan.fromJson({ title: 'Plan', config: { groups: [{ label: 'Dzień', rows: [{ title: 'Msza' }] }] } });
  assert.equal(legacyShape.title, 'Plan');
  assert.equal(JSON.parse(legacyShape.json).groups[0].rows[0].title, 'Msza');
  ok('event parts: title and intro beside the content; the legacy { title, config } shape is accepted');

  /* -- 3: Export → Import ändert an Ort und Stelle ------------------------------------- */
  const frame = (row, col, colSpan, rowSpan) => ({ position: { row, col }, size: { colSpan, rowSpan } });
  const layoutAt = (row) => ({ desktop: frame(row, 1, 6, 3), tablet: frame(row, 1, 4, 3), mobile: frame(row, 1, 2, 3) });
  const ids = ['0190a0a0-0000-7000-8000-000000000001', '0190a0a0-0000-7000-8000-000000000002', '0190a0a0-0000-7000-8000-000000000003'];
  const shared = '0190a0a0-0000-7000-8000-0000000000ff';
  const parts = [
    { id: ids[0], moduleId: ids[0], kind: 'text', layout: { ...layoutAt(1), slide: { label: 'O nas', layers: [] } }, config: { title: 'O nas', body: 'Raz\nDwa' } },
    { id: ids[1], moduleId: shared, kind: 'plan', layout: layoutAt(4), config: m.partOf('plan').json.fromJson(m.partOf('plan').json.example) },
    { id: ids[2], moduleId: null, kind: 'form', layout: layoutAt(7), config: { title: 'Zapisy' } }
  ];
  const now = {
    path: 'zz-probe/json', title: 'Strona', lead: '', mode: 'slides',
    look: { theme: { mode: 'dark', accent: '#4c7dd6', ink: '#eef2f8', ground: '#080d15', muted: '#a3b2c9' }, cover: [] },
    parts,
    logic: JSON.stringify({ version: 1, nodes: [{ id: 'n1', kind: 'part', x: 0, y: 0, partId: ids[1] }], edges: [] }),
    menu: { path: 'zz-probe/json', items: [{ label: 'Start', kind: 'abs', target: 'zz-probe', children: [] }], uses: null, inherited: null, usable: [] }
  };
  const doc = JSON.parse(JSON.stringify(m.exportPage(now)));
  assert.equal(doc.format, m.PAGE_FORMAT);
  assert.equal(m.documentKind(doc), 'page');

  const back = m.planImport(doc, now, { ...m.DEFAULT_IMPORT, replace: true });
  assert.ok(!('error' in back), 'the export imports');
  assert.deepEqual(back.warnings, [], 'no warnings on a round trip');
  assert.deepEqual(back.parts.map((p) => p.id), ids, 'every place keeps its id');
  assert.deepEqual(back.parts.map((p) => p.moduleId), [ids[0], shared, ids[2]], 'every place keeps its module');
  for (const [i, part] of back.parts.entries()) {
    assert.ok(m.sameConfig(part.config, parts[i].config), `${part.kind}: content unchanged`);
    assert.deepEqual(part.layout, parts[i].layout, `${part.kind}: place and slide unchanged`);
  }
  assert.equal(back.title, undefined, 'unchanged title is not rewritten');
  assert.equal(back.lead, undefined, 'unchanged lead is not rewritten');
  assert.equal(back.mode, 'slides');
  assert.equal(back.look, undefined, 'an unchanged look is not rewritten');
  assert.deepEqual(back.menu, { items: now.menu.items });
  assert.equal(JSON.parse(back.logic).nodes[0].partId, ids[1], 'the logic still points at the same place');
  ok('page export → import (replace): same places, same modules, same content, layout, slides, look, menu and logic');

  /* Eine Änderung im Dokument — an Ort und Stelle. */
  doc.modules[0].config.body = ['Raz', 'Dwa', 'Trzy'];
  doc.modules[1].config.note = 'Nowa uwaga';
  doc.title = 'Nowy tytuł';
  const changed = m.planImport(doc, now, m.DEFAULT_IMPORT);
  assert.deepEqual(changed.parts.map((p) => p.id), ids, 'append mode: still the same places, nothing new');
  assert.equal(changed.parts[0].config.body, 'Raz\nDwa\nTrzy');
  assert.equal(JSON.parse(changed.parts[1].config.json).note, 'Nowa uwaga');
  assert.equal(changed.configs.get(ids[1]).json, changed.parts[1].config.json, 'a shared module gets its content after saving');
  assert.equal(changed.title, 'Nowy tytuł');
  ok('a changed document changes the page in place');

  /* -- 4: Neues — neue Kennungen, freier Platz, die Karte folgt ------------------------ */
  const fresh = m.planImport({
    format: m.PAGE_FORMAT,
    modules: [
      { id: 'a', kind: 'faq', config: { items: [{ question: 'Co zabrać?', answer: 'Wodę.' }] } },
      { kind: 'notice', size: { colSpan: 3, rowSpan: 1 }, config: { body: 'Uwaga!' } },
      { kind: 'nonsense', config: {} }
    ],
    logic: { version: 1, nodes: [{ id: 'n1', kind: 'part', x: 0, y: 0, partId: 'a' }, { id: 'n2', kind: 'step', x: 0, y: 0, label: 'Krok', goto: 'a' }], edges: [] }
  }, now, m.DEFAULT_IMPORT);
  assert.equal(fresh.parts.length, 5, 'two new modules after the three that stay');
  const [faq, notice] = fresh.parts.slice(3);
  assert.ok(!ids.includes(faq.id) && faq.id !== 'a' && /^[0-9a-f-]{36}$/.test(faq.id), 'a new place gets a real new id');
  assert.equal(faq.moduleId, null, 'and a new module');
  for (const bp of m.BREAKPOINTS) assert.ok(faq.layout[bp] && notice.layout[bp], `new modules are placed on ${bp}`);
  assert.ok(faq.layout.desktop.position.row >= 10, 'below what is already there');
  assert.equal(notice.layout.desktop.size.rowSpan, 1);
  assert.ok(fresh.warnings.some((w) => w.includes('nonsense')), 'an unknown kind is reported');
  const logic = JSON.parse(fresh.logic);
  assert.equal(logic.nodes[0].partId, faq.id, 'the logic follows the new id');
  assert.equal(logic.nodes[1].goto, faq.id);
  ok('new entries: fresh ids, free places, size honoured, unknown kinds reported, logic remapped');

  /* Kopieren statt teilen. */
  const elsewhere = { ...doc, path: 'zz-probe/other' };
  const shared2 = m.planImport(elsewhere, { ...now, parts: [] }, m.DEFAULT_IMPORT);
  assert.equal(shared2.parts[1].moduleId, shared, 'from another page: the same module by default');
  const copied = m.planImport(elsewhere, { ...now, parts: [] }, { ...m.DEFAULT_IMPORT, copyModules: true });
  assert.ok(copied.parts.every((p) => p.moduleId === null), 'or copies on request');
  assert.ok(copied.parts.every((p) => !ids.includes(p.id)), 'new places either way');
  ok('documents from another page: shared modules by default, copies on request');

  /* Ein Modul-Dokument an der Seite: trifft die Stelle, die dieses Modul zeigt. */
  const single = m.planImport(m.exportModule({ moduleId: shared, kind: 'plan', name: 'Plan', config: parts[1].config }), now, m.DEFAULT_IMPORT);
  assert.deepEqual(single.parts.map((p) => p.id), ids, 'a module document updates the place that shows it');
  assert.equal(single.names.get(ids[1]), 'Plan');
  ok('a module document on the page updates the place that shows that module');

  /* Altbestand. */
  const legacy = m.planImport({ title: 'Wydarzenie', pages: [{ parts: [{ kind: 'faq', config: { items: [] } }] }] }, now, m.DEFAULT_IMPORT);
  assert.equal(legacy.legacy, true);
  assert.equal(legacy.parts.length, 4);
  ok('the legacy event format is still recognised');

  /* replacing(): was wegfällt, wird geleert. */
  assert.deepEqual(m.replacing({ a: '1', b: '2' }, { a: '1', c: '3' }), { b: '', c: '3' });
  ok('replacing a config clears the keys that are gone');

  /* -- Fragen ---------------------------------------------------------------------- */
  documented('questions', m.QUESTION_EXAMPLE, m.QUESTION_KEYS);
  const warnings = [];
  const read = m.readQuestions([{ id: 'q1', kind: 'weird', label: 'A' }, { label: '' }, { label: 'B', options: 'x\ny' }], warnings);
  assert.equal(read.length, 2);
  assert.equal(read[0].kind, 'line');
  assert.deepEqual(read[1].options, ['x', 'y']);
  assert.equal(warnings.length, 2);
  ok('form questions: every key described, tolerant reading with warnings');

  /* -- 5: die Beschreibung ------------------------------------------------------------ */
  const page = m.pageDescription();
  for (const def of m.PARTS) {
    assert.ok(page.includes(`### "${def.kind}" — ${def.label}`), `page description lists ${def.kind}`);
    for (const key of Object.keys(def.json.keys)) assert.ok(page.includes(`"${key}" — `), `page description explains ${def.kind}.${key}`);
    assert.ok(m.partDescription(def.kind).includes(`### "${def.kind}"`), `part description of ${def.kind}`);
    assert.ok(m.moduleDescription(def.kind).includes(`### "${def.kind}"`), `module description of ${def.kind}`);
  }
  for (const key of Object.keys(m.QUESTION_KEYS)) assert.ok(m.moduleDescription('form').includes(`"${key}" — `), `form description explains ${key}`);
  const example = m.planImport(m.pageExample(), { ...now, parts: [], logic: null }, { ...m.DEFAULT_IMPORT, replace: true });
  assert.ok(!('error' in example) && example.warnings.length === 0, 'the example in the description imports cleanly');
  assert.equal(example.parts.length, m.pageExample().modules.length);
  assert.ok(example.forms.size === 1, 'the example form carries questions');
  ok('descriptions: every kind and every key, for page, part and module; the page example imports cleanly');
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
