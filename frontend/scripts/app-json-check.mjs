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
export { PARTS, partOf } from '${app}pages/parts/registry';
export * from '${app}pages/pageJson';
export * from '${app}pages/pageJsonText';
export { QUESTION_EXAMPLE, QUESTION_KEYS, readQuestions } from '${app}forms/formJson';
export { ENTRIES_FORMAT, ENTRIES_KEYS, ONCE_KEY, answerKeys, entriesDescription, exportEntries, planEntries } from '${app}forms/entriesJson';
export { BREAKPOINTS } from '${app}pages/layout';
export { readVirtualAreas, levelOf } from '${app}forms/virtualAreasJson';
export { readAppointments, referencesIn, resolveReferences, describePlan, DEFAULT_ENTRY } from '${app}calendar/appointmentsJson';
export { readImageNeeds, resolveImageNeeds, previewImageNeeds, matchFiles, fileProblem, fitsNeed, acceptOf, NEED_PREFIX, PREVIEW_REF, MAX_NEEDS } from '${app}pages/pageImageNeeds';
export { describe, sectionsOf, samplesOf } from '${app}core/jsonTree';
export { FORM_FORMAT, NEEDS_FORMAT, minorFormSample } from '${app}forms/formFormat';
export { readNeedWishes, needOut, needsOut, needWishLines, needsKeys, NEEDS_EXAMPLE } from '${app}forms/needsJson';
export { NEEDS, needOf, choiceOf } from '${app}forms/needs';
export { readNeeds, needsJson, adoptedOf, planNeed, holdingOf, keysOfOn } from '${app}forms/needPlan';
export { keepOwn } from '${app}pages/part';
export { readModuleWish, carriesForm, formWishLine } from '${app}modules/moduleWish';
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
    menu: { path: 'zz-probe/json', items: [{ label: 'Start', kind: 'abs', target: 'zz-probe', children: [], image: '/logo.svg' }, { label: 'Zapisy', kind: 'rel', target: 'zapisy', children: [] }], uses: null, inherited: null, usable: [] }
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
  /* 2026-10-21 — ein Logo im Menü: kommt mit, und was kein Bild sein kann, wird gesagt und fällt weg. */
  const badLogo = m.planImport({ format: m.PAGE_FORMAT, version: 1, menu: [{ label: 'Start', kind: 'abs', target: '', image: 'javascript:alert(1)' }] }, now, m.DEFAULT_IMPORT);
  assert.ok(badLogo.warnings.some((w) => w.includes('Start') && w.includes('image')), 'a menu image that is no image is reported');
  assert.equal(badLogo.menu.items[0].image, undefined, 'and dropped');
  ok('page export → import (replace): same places, same modules, same content, layout, slides, look, menu (with a logo) and logic');

  /* 0082 — „Wybór na stronie": ein Objekt im Dokument, an Ort und Stelle. */
  const decl = { kind: 'entry', form: shared, list: 'zz-probe/lista' };
  const withSubject = { ...now, subject: JSON.stringify(decl) };
  const subjectDoc = JSON.parse(JSON.stringify(m.exportPage(withSubject)));
  assert.deepEqual(subjectDoc.subject, decl, 'the subject is exported as an object');
  assert.equal(doc.subject, null, 'a page without one says null');
  assert.equal(m.planImport(subjectDoc, withSubject, m.DEFAULT_IMPORT).subject, undefined, 'an unchanged subject is not rewritten');
  assert.equal(m.planImport({ ...subjectDoc, subject: null }, withSubject, m.DEFAULT_IMPORT).subject, null, 'null takes it away');
  assert.deepEqual(JSON.parse(m.planImport(subjectDoc, now, m.DEFAULT_IMPORT).subject), decl, 'a new one is set');
  const odd = m.planImport({ ...subjectDoc, subject: { kind: 'nonsense' } }, now, m.DEFAULT_IMPORT);
  assert.ok(odd.subject === undefined && odd.warnings.some((w) => w.includes('nonsense')), 'an unknown kind is reported and left alone');
  const lacking = m.planImport({ ...subjectDoc, subject: { kind: 'entry' } }, now, m.DEFAULT_IMPORT);
  assert.ok(lacking.subject !== undefined && lacking.warnings.some((w) => w.includes('formularz')), 'what is missing is said');
  assert.ok(m.pageDescription().includes('"subject" — ') && m.pageDescription().includes('"entry"'), 'the description explains it');
  ok('page subject (0082): exported as an object, imported in place, removed with null, unknown kinds and gaps reported');

  /* 0084 — Slajdy: wie sie kommen, wie der Inhalt erscheint, Farben, die Bühne — und die Plätze folgen neuen Kennungen. */
  {
    const moving = m.planImport({
      format: m.PAGE_FORMAT,
      modules: [
        { id: 'a', kind: 'text', slide: { label: 'A', layers: [], transition: 'zoom', enter: 'rise', colors: { accent: '#ff0000' } }, config: { title: 'A' } },
        { id: 'b', kind: 'notice', slide: { label: 'Logo', layers: [], stage: { frames: { a: { x: 10, y: 20, w: 15 }, cover: { x: 80 } }, bare: true } }, config: { body: 'Zapisy!' } },
        { kind: 'text', slide: { label: 'C', layers: [], transition: 'wiggle' }, config: { title: 'C' } }
      ]
    }, { ...now, parts: [] }, m.DEFAULT_IMPORT);
    const [a, b, c] = moving.parts;
    assert.equal(a.layout.slide.transition, 'zoom');
    assert.equal(a.layout.slide.enter, 'rise');
    assert.deepEqual(a.layout.slide.colors, { accent: '#ff0000' }, 'only the colours given are stored');
    const frames = b.layout.slide.stage.frames;
    assert.ok(frames[a.id] !== undefined && frames.cover !== undefined && frames.a === undefined, 'stage places follow the new id of their slide');
    assert.equal(frames[a.id].scale, 1, 'missing numbers take their default');
    assert.equal(b.layout.slide.stage.bare, true);
    assert.equal(c.layout.slide.transition, undefined, 'an unknown transition falls back to the default (and is not stored)');
    assert.ok(moving.warnings.some((w) => w.includes('wiggle')), 'and it is reported');
    const out = JSON.parse(JSON.stringify(m.exportPage({ ...now, parts: moving.parts })));
    assert.deepEqual(out.modules[1].slide.stage.frames[a.id], frames[a.id], 'the stage goes out as it came in');
    assert.equal(out.modules[2].slide.transition, undefined, 'defaults are left out of the export');
    const again = m.planImport(out, { ...now, parts: moving.parts }, { ...m.DEFAULT_IMPORT, replace: true });
    assert.deepEqual(again.parts.map((p) => p.layout.slide), moving.parts.map((p) => p.layout.slide), 'export → import changes nothing');
    ok('slides (0084): transition, entrance, colours and stage survive export → import; stage places follow new ids; bad values reported');
  }

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
  /* 2026-10-24 — die Überschrift eines Abschnitts, gleich auf welcher Ebene des Baums er steht. */
  const heading = (text, title) => text.split('\n').some((line) => /^#{1,4} /.test(line) && line.replace(/^#{1,4} /, '').startsWith(title));
  for (const def of m.PARTS) {
    assert.ok(heading(page, `"${def.kind}" — ${def.label}`), `page description lists ${def.kind}`);
    for (const key of Object.keys(def.json.keys)) assert.ok(page.includes(`"${key}" — `), `page description explains ${def.kind}.${key}`);
    assert.ok(heading(m.partDescription(def.kind), `"${def.kind}" — ${def.label}`), `part description of ${def.kind}`);
    assert.ok(heading(m.moduleDescription(def.kind), `"${def.kind}" — ${def.label}`), `module description of ${def.kind}`);
  }
  for (const key of Object.keys(m.QUESTION_KEYS)) assert.ok(m.moduleDescription('form').includes(`"${key}" — `), `form description explains ${key}`);
  const example = m.planImport(m.pageExample(), { ...now, parts: [], logic: null }, { ...m.DEFAULT_IMPORT, replace: true });
  assert.ok(!('error' in example) && example.warnings.length === 0, `the example in the description imports cleanly: ${example.warnings?.join(' | ')}`);
  assert.equal(example.parts.length, m.pageExample().modules.length);
  assert.ok(example.forms.size === 1, 'the example form carries questions');
  assert.equal(example.forms.values().next().value.needs[0].id, 'minor', 'and the minors with every way');
  ok('descriptions: every kind and every key, for page, part and module; the page example imports cleanly');

  /* -- 2026-10-24: der Baum der Formate — jeder Abschnitt einmal, Behälter tragen ihren Inhalt ------------ */
  {
    const keysOf = (root) => m.sectionsOf(root).map((s) => s.node.key);
    const pageKeys = keysOf(m.PAGE_JSON);
    assert.equal(new Set(pageKeys).size, pageKeys.length, 'every node once in the page');
    for (const key of ['page.keys', 'page.appointments', 'page.images', 'page.module', 'kinds', 'form', 'form.needs', 'motion', 'live', 'presentation']) {
      assert.ok(pageKeys.includes(key), `the page carries ${key}`);
    }
    assert.ok(pageKeys.indexOf('page.module') < pageKeys.indexOf('form') && pageKeys.indexOf('form') < pageKeys.indexOf('form.needs'), 'page → module → form → needs');
    for (const def of m.PARTS) assert.ok(pageKeys.includes(`part:${def.kind}`), `the page carries the kind ${def.kind}`);
    const formModule = keysOf(m.moduleFormat('form'));
    assert.deepEqual(formModule, ['module:form', 'part:form', 'form', 'form.needs'], 'a form module: its kind, the form, its needs');
    assert.deepEqual(keysOf(m.moduleFormat('text')), ['module:text', 'part:text'], 'another module: only its kind');
    assert.deepEqual(keysOf(m.partFormat('form')), ['part-doc:form', 'part:form']);
    /* Derselbe Knoten, derselbe Text — wo er auch steht. */
    const needsText = m.NEEDS_FORMAT.text();
    assert.ok(page.includes(needsText) && m.moduleDescription('form').includes(needsText), 'the needs section is the same in the page and in the module');
    assert.equal(page.split(needsText).length, 2, 'and stands once');
    assert.equal(m.moduleDescription('form').split(m.FORM_FORMAT.text()).length, 2);
    assert.ok(page.includes('## Ruch') && page.includes('## Pliki do dodania') && page.includes('## Terminy do kalendarza') && page.includes('#### Wymagania formularza ("needs")'), 'headings by depth');
    assert.ok(!m.moduleDescription('text').includes('"needs"'), 'a text module says nothing about needs');
    /* Ganze Beispiele zum Einsetzen: jedes importiert ohne ein Wort. */
    const samples = m.samplesOf(m.PAGE_JSON);
    assert.deepEqual(samples.map((s) => s.label).length, 4, 'two page samples and two forms');
    for (const sample of samples) {
      const planned = m.planImport(sample.doc(), { ...now, parts: [], logic: null }, { ...m.DEFAULT_IMPORT, replace: true });
      assert.ok(!('error' in planned) && planned.warnings.length === 0, `sample „${sample.label}” imports cleanly: ${planned.warnings?.join(' | ')}`);
    }
    assert.deepEqual(m.samplesOf(m.moduleFormat('form')).map((s) => s.label), m.samplesOf(m.NEEDS_FORMAT).map((s) => s.label), 'the form module offers the form samples');
    assert.deepEqual(m.samplesOf(m.moduleFormat('text')), [], 'a text module none');
    ok(`JSON tree: ${pageKeys.length} sections in the page, each once; page → module → form → needs; the same text wherever a node stands; samples import cleanly`);
  }

  /* -- 2026-10-24: die Wymagania im JSON ("needs") -------------------------------------------------- */
  {
    const keys = m.needsKeys();
    documented('needs', m.NEEDS_EXAMPLE, keys);
    for (const need of m.NEEDS) {
      assert.ok(keys['needs[].id'].includes(`"${need.id}"`), `the description names ${need.id}`);
      for (const s of need.settings) for (const c of s.choices) assert.ok(keys[`needs[].${s.key}`].includes(`"${c.value}"`), `the description explains ${need.id}.${s.key}=${c.value}`);
    }
    const said = [];
    const wishes = m.readNeedWishes(['health', { id: 'minor', age: 'ask', ways: ['consent', 'parent', 'boat'], colour: 'red' }, { id: 'nonsense' }, 'health', { id: 'rules', holds: 'x' }, 7], said);
    assert.deepEqual(wishes.map((w) => w.id), ['health', 'minor', 'rules'], 'known needs once, in order');
    assert.deepEqual(wishes[1].choice, { age: ['ask'], ways: ['parent', 'consent'] }, 'known values kept, in their order');
    assert.equal(said.length, 6, `each dropped thing says so: ${said.join(' | ')}`);
    assert.deepEqual(m.readNeedWishes([{ id: 'minor' }], []).at(0).choice, { age: ['birth'], ways: ['parent', 'adult', 'consent'] }, 'without settings: every way, the birth date');
    assert.deepEqual(m.readNeedWishes([{ id: 'minor', age: ['ask', 'birth'] }], said).at(0).choice.age, ['ask'], 'one value where one is asked: the first named');
    assert.equal(m.readNeedWishes(undefined, []), undefined, 'no key: nothing said');
    assert.deepEqual(m.readNeedWishes(null, []), [], 'null: none');
    assert.equal(m.readNeedWishes('minor', said), undefined, 'not a list: nothing (with a word)');

    /* Eingeschaltet → JSON → gelesen: dieselbe Wahl, dieselben Kennungen. */
    const on = { id: 'minor', label: 'Udział niepełnoletnich', fields: ['f1'], added: ['f1'], items: ['g1'], nodes: [], edges: [], paper: true, choice: { age: ['ask'], ways: ['adult', 'consent'] }, keys: { given: 'f1', gParticipant: 'g1' } };
    const out = m.needOut(on);
    assert.deepEqual(out, { id: 'minor', age: 'ask', ways: ['adult', 'consent'], holds: { given: 'f1', gParticipant: 'g1' } }, 'a setting of one is a word, of many a list; holds as they are');
    const back = m.readNeedWishes(JSON.parse(JSON.stringify([out])), []);
    assert.deepEqual([back[0].choice, back[0].holds], [on.choice, on.keys], 'round trip');
    const legacy = { id: 'minor', label: 'Niepełnoletni potrzebują pisemnej zgody rodzica', fields: ['a', 'b', 'c', 'd', 'e'], added: [], items: ['g1', 'g2', 't1'], nodes: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'], edges: ['e1', 'e2', 'e3', 'e4', 'e5'] };
    assert.deepEqual([m.needOut(legacy).age, m.needOut(legacy).ways, m.needOut(legacy).holds.guardian], ['birth', ['consent'], 'd'], 'an entry from before the settings goes out as it was, with what it holds');
    assert.deepEqual(m.needOut({ id: 'health', label: 'Z', fields: [], added: [], items: [], nodes: [], edges: [] }), { id: 'health' }, 'a need without settings and holdings: its id');

    /* Die Vorschau: was der Import täte. */
    const lines = m.needWishLines(m.readNeedWishes([{ id: 'minor', age: 'birth', ways: ['consent'] }, 'rules'], []), [on, { id: 'health', label: 'Zdrowie', fields: [], added: [], items: [], nodes: [], edges: [] }], false);
    assert.ok(lines.some((l) => l.includes('nowe ustawienia')) && lines.some((l) => l.includes('zostanie włączone')) && lines.some((l) => l.includes('zostaje włączone')), `lines: ${lines.join(' | ')}`);
    assert.ok(m.needWishLines([], [on], true)[0].includes('wyłączone'), 'with "replace": turned off');

    /* Die Sperren der Tafel stehen nicht im JSON — und kein Import überschreibt sie. */
    const form = m.partOf('form').json;
    assert.equal('needs' in form.toJson({ title: 'Z', needs: '[{"id":"minor"}]' }), false, 'the locks are not exported in config');
    assert.equal('needs' in form.fromJson({ title: 'Z', needs: [{ id: 'x' }] }), false, 'and not imported from config');
    assert.deepEqual(m.keepOwn(form, { title: 'A', needs: 'L' }, { title: 'B' }), { title: 'B', needs: 'L' }, 'a replaced config keeps them');
    assert.deepEqual(m.replacing({ title: 'A', needs: 'L' }, m.keepOwn(form, { title: 'A', needs: 'L' }, { title: 'B' })), { title: 'B' }, 'so the patch never clears them');
    const exported = m.exportModule({ moduleId: 'b1', kind: 'form', name: 'Zapisy', config: { title: 'Z', needs: m.needsJson([on]) } });
    assert.deepEqual([exported.config.needs, exported.needs?.[0]?.id], [undefined, 'minor'], 'the module document says "needs" beside its questions');
    const entryOut = m.exportEntry({ id: 'p1', moduleId: 'b1', kind: 'form', layout: {}, config: { needs: m.needsJson([on]) } });
    assert.equal(entryOut.needs[0].age, 'ask', 'so does a page entry');
    assert.equal('needs' in m.exportModule({ moduleId: 'b2', kind: 'form', name: 'X', config: {} }), false, 'no need, no key');

    /* Der Plan einer Seite: ein Formular bekommt seine Wymagania; eine andere Art nicht; was der Ort hält, bleibt. */
    const place = { id: ids[2], moduleId: 'b1', kind: 'form', layout: layoutAt(7), config: { title: 'Zapisy', needs: 'LOCKS' } };
    const withNeeds = m.planImport({ format: m.PAGE_FORMAT, modules: [
      { id: ids[2], kind: 'form', config: { title: 'Zapisy 2', needs: 'IGNORED' }, needs: [{ id: 'minor', ways: ['parent'] }, 'nothing'], memberRoles: ['r1'] },
      { kind: 'text', config: { title: 'x' }, needs: ['health'], questions: [] }
    ] }, { ...now, parts: [place] }, m.DEFAULT_IMPORT);
    const wish = withNeeds.forms.get(ids[2]);
    assert.deepEqual([wish.needs.map((w) => w.id), wish.memberRoles], [['minor'], ['r1']], 'the form gets its needs and roles');
    assert.equal(withNeeds.parts.find((p) => p.id === ids[2]).config.needs, 'LOCKS', 'the locks of the place stay, whatever the document says');
    assert.equal(withNeeds.parts.find((p) => p.id === ids[2]).config.title, 'Zapisy 2');
    assert.ok(withNeeds.warnings.some((w) => w.includes('nothing')), 'an unknown need is reported');
    assert.ok(withNeeds.warnings.some((w) => w.includes('"needs"') && w.includes('tylko formularz')), 'needs on a text module are reported');
    assert.ok(withNeeds.lines.some((l) => l.includes('Udział niepełnoletnich')), 'the plan names them');

    /* Übernehmen statt verdoppeln: was das Dokument mitbrachte, zählt über seine neuen Kennungen. */
    const content = {
      questions: [{ id: 'Q1', kind: 'line', label: 'Imię', identity: 'given_name' }, { id: 'Q2', kind: 'line', label: 'Imię i nazwisko rodzica / opiekuna prawnego', identity: 'none' }],
      removed: [],
      design: { version: 1, layout: [{ type: 'group', id: 'tpl-g', kind: 'group', title: 'Rodzic', items: [{ type: 'field', id: 'Q2' }] }], nodes: [{ id: 'tpl-n', kind: 'show', x: 0, y: 0, target: 'tpl-g' }], edges: [] }
    };
    const adopted = m.adoptedOf(m.needOf('minor'), { given: 'doc-1', guardian: 'doc-2', gGuardian: 'tpl-g', nShow0: 'tpl-n', nAge: 'gone' }, new Map([['doc-1', 'Q1'], ['doc-2', 'Q2']]), new Set(['Q2']), content);
    assert.deepEqual([adopted.keys, adopted.fields, adopted.added, adopted.items, adopted.nodes], [{ given: 'Q1', guardian: 'Q2', gGuardian: 'tpl-g', nShow0: 'tpl-n' }, ['Q1', 'Q2'], ['Q2'], ['tpl-g'], ['tpl-n']],
      'questions by their new ids, groups and nodes as they are, what is missing falls away; only what the import created may go again');
    assert.equal(m.adoptedOf(m.needOf('minor'), { given: 'x' }, new Map(), new Set(), content), null, 'nothing there: no adoption');
    const replanned = m.planNeed({ need: m.needOf('minor'), choice: { age: ['birth'], ways: ['consent'] }, content, now: adopted, others: [], makeId: (() => { let n = 0; return () => `new${++n}`; })() });
    assert.deepEqual([replanned.keys.given, replanned.keys.guardian, replanned.keys.gGuardian], ['Q1', 'Q2', 'tpl-g'], 'the adopted parts are reused');
    assert.deepEqual(replanned.questions.map((q) => q.label), ['Nazwisko', 'Data urodzenia', 'Telefon rodzica / opiekuna'], 'only the missing ones are created');
    ok('needs JSON (2026-10-24): every need, setting and value described; tolerant reading; out and back the same; locks never in config; a page form gets them; adoption instead of doubles');
  }

  /* -- 2026-10-24: Termine fürs Kalender im JSON einer Seite ------------------------------- */
  {
    const said = [];
    const plan = m.readAppointments([
      { key: 'dzien1', calendar: 'rekolekcje', title: 'Rekolekcje — dzień 1', start: '2026-12-05T18:00', end: '21:00', location: 'Kościół',
        points: [
          { title: 'Msza', start: '18:00', end: '19:00' },
          { title: 'Konferencja', start: '19:15', end: '20:00', points: [{ title: 'Pytania' }] }
        ] },
      { title: 'Festyn', start: '2027-06-13', end: '2027-06-14' },
      { title: 'Próba chóru', start: '2026-12-02T19:00', repeat: 'weekly', weekdays: ['śr', 'pt'], until: '2027-01-31' }
    ], [{ key: 'rekolekcje', label: 'Kalendarz rekolekcji', calendar: 'cal-1' }], said);
    assert.deepEqual(said, [], 'a clean document reads without a word');
    assert.deepEqual(plan.entries.map((e) => [e.key, e.label, e.suggested, e.count]), [['rekolekcje', 'Kalendarz rekolekcji', 'cal-1', 1], [m.DEFAULT_ENTRY, 'Kalendarz', null, 2]],
      'two entries: the described one with its suggestion, and the default for appointments without one');
    assert.equal(plan.total, 6, 'three appointments, three points');
    const [day1, fest, choir] = plan.items;
    assert.deepEqual([day1.date, day1.time, day1.minutes, day1.allDay], ['2026-12-05', '18:00', 180, false], 'start and an end as a time of the same day');
    assert.deepEqual(day1.points.map((p) => [p.title, p.date, p.time, p.minutes, p.entry]), [['Msza', '2026-12-05', '18:00', 60, 'rekolekcje'], ['Konferencja', '2026-12-05', '19:15', 45, 'rekolekcje']],
      'points: "GG:MM" on the day of their appointment, into its calendar');
    assert.deepEqual([day1.points[1].points[0].time, day1.points[1].points[0].minutes], ['19:15', 60], 'a point without a start begins with its appointment, an hour long');
    assert.deepEqual([fest.allDay, fest.minutes, fest.time], [true, 2880, '00:00'], 'all day: the last day counts');
    assert.deepEqual([choir.repeat, choir.weekdays, choir.until], ['weekly', 4 | 16, '2027-01-31'], 'weekly on Wednesday and Friday until the given day');
    assert.ok(plan.keys.has('dzien1') && plan.keys.has('rekolekcje') && plan.keys.has(m.DEFAULT_ENTRY), 'modules may point at appointments and entries');

    const bad = [];
    const rough = m.readAppointments([
      { title: '', start: '2026-12-05' },
      { title: 'Bez daty' },
      { title: 'Zła data', start: '2026-02-30' },
      { key: 'x y', title: 'Zły klucz', start: '2026-12-01T10:00', end: '09:00', repeat: 'often', points: [{ title: 'Punkt', start: '10:00', calendar: 'inny', repeat: 'daily' }] }
    ], [{ key: 'nikt', label: 'Pusty' }], bad);
    assert.equal(rough.items.length, 1, 'only the readable appointment stays');
    assert.equal(rough.items[0].minutes, 60, 'an end before the start: an hour');
    assert.ok(bad.length >= 8, `each dropped thing says so (${bad.length})`);
    assert.equal(m.readAppointments(undefined, undefined, []), undefined, 'no key: the document brings no appointments');

    /* Im Plan einer Seite: eine Zeile dazu, und Verweise der Module werden geprüft. */
    const doc = { format: m.PAGE_FORMAT, version: 1, appointments: [{ key: 'dzien1', title: 'Dzień 1', start: '2026-12-05T18:00' }],
      modules: [{ kind: 'program', config: { title: 'Program', calendar: '', item: '@dzien1' } }, { kind: 'calendar', config: { title: 'Terminy', calendars: '@nieznany' } }] };
    const planned = m.planImport(doc, { ...now, parts: [], logic: null }, m.DEFAULT_IMPORT);
    assert.ok(!('error' in planned) && planned.appointments?.items.length === 1, 'the plan carries the appointments');
    assert.ok(planned.lines.some((l) => l.startsWith('Terminy do kalendarza: 1')), 'and says how many, where');
    assert.ok(planned.warnings.some((w) => w.includes('„@nieznany”')) && !planned.warnings.some((w) => w.includes('„@dzien1”')), 'an unknown "@name" is reported, a known one not');

    /* Verweise ersetzen — nur in Feldern, die auf Kalender oder Termine zeigen. */
    const items = new Map([['dzien1', { itemId: 'item-1', calendarId: 'cal-9' }]]);
    const entries = new Map([['rekolekcje', 'cal-1']]);
    const program = m.resolveReferences('program', { title: '@dzien1', calendar: '', item: '@dzien1' }, m.referenceFieldsOf('program'), items, entries);
    assert.deepEqual(program.config, { title: '@dzien1', calendar: 'cal-9', item: 'item-1' }, 'program: the item, its calendar filled in; the title stays text');
    const calendar = m.resolveReferences('calendar', { title: 'Terminy', calendars: '@rekolekcje, cal-2, @gdzie' }, m.referenceFieldsOf('calendar'), items, entries);
    assert.deepEqual([calendar.config.calendars, calendar.missing], ['cal-1, cal-2, @gdzie', ['gdzie']], 'calendar: entries replaced in the list, an unknown name stays and is reported');
    assert.deepEqual(m.referencesIn({ calendars: '@a,b, @c', title: '@x' }, m.referenceFieldsOf('calendar')), ['a', 'c'], 'references only in calendar fields');

    /* Die Beschreibung: beide Schlüssel, und ihr Beispiel liest sich sauber. */
    const page = m.pageDescription();
    assert.ok(page.includes('"appointments" — ') && page.includes('"calendars" — ') && page.includes('## Terminy do kalendarza'), 'the description explains appointments and entries');
    const sample = JSON.parse(page.slice(page.indexOf('Przykład:', page.indexOf('## Terminy do kalendarza')) + 'Przykład:'.length, page.indexOf('\n## ', page.indexOf('## Terminy do kalendarza') + 5)).trim());
    const sampleWords = [];
    const samplePlan = m.readAppointments(sample.appointments, sample.calendars, sampleWords);
    assert.ok(sampleWords.length === 0 && samplePlan.total === 5, 'the example in the description reads cleanly');
    ok('page JSON (2026-10-24): appointments with their program, entries chosen on import, "@name" references, tolerant reading, description');
  }

  {
  /* -- 0077: eine Erweiterung, die sich wiederholt — im JSON des Moduls ----------------- */
  const extModule = m.exportModule({ moduleId: 'e1', kind: 'form', name: 'Odwiedziny', config: {}, extendsId: 'b1', audience: 'office', repeat: 'month' });
  assert.equal(extModule.repeat, 'month');
  assert.equal(extModule.extends, 'b1');
  assert.equal(extModule.audience, 'office');
  assert.equal('repeat' in m.exportModule({ moduleId: 'b1', kind: 'form', name: 'Chorzy', config: {} }), false, 'a plain form carries no repeat');
  for (const key of ['"repeat" — ', '"extends", "audience" — ', '"memberRoles" — ', '"virtualAreas" — ', '"group" — ']) assert.ok(m.moduleDescription('form').includes(key), `form module description explains ${key}`);
  /* 0096 — die Gruppe (der Ordner) geht mit ihrem Namen mit; ohne Gruppe kein Schlüssel. */
  assert.equal(m.exportModule({ moduleId: 'b1', kind: 'form', name: 'Zapisy', config: {}, group: 'Bierzmowanie 2027' }).group, 'Bierzmowanie 2027');
  assert.equal('group' in m.exportModule({ moduleId: 'b1', kind: 'form', name: 'Zapisy', config: {}, group: null }), false, 'no group, no key');
  /* 0091/0120 — die Rollen seiner Menschen gehen als Liste mit; ohne Rolle steht kein Schlüssel da. */
  assert.deepEqual(m.exportModule({ moduleId: 'b1', kind: 'form', name: 'Zapisy', config: {}, memberRoles: ['r1', 'r2'] }).memberRoles, ['r1', 'r2']);
  assert.equal('memberRoles' in m.exportModule({ moduleId: 'b1', kind: 'form', name: 'Zapisy', config: {}, memberRoles: [] }), false, 'no role, no key');
  assert.equal('memberRole' in m.exportModule({ moduleId: 'b1', kind: 'form', name: 'Zapisy', config: {}, memberRoles: ['r1'] }), false, 'the old single key is read, not written');
  ok('module JSON: an extension says what it extends, who fills it and how often; a form carries the roles of its people');

  /* -- 0120: die Obszary osób im JSON des Moduls -------------------------------------------- */
  {
    const rules = [
      { name: 'Kandydat i prowadzący', submitter: 'write', roles: [{ role: 'r-lead', level: 'admin' }, { role: 'r-kat', level: 'write' }] },
      { name: 'Notatki prowadzących', submitter: 'none', roles: [{ role: 'r-lead', level: 'admin' }] }
    ];
    const out = m.exportModule({ moduleId: 'b1', kind: 'form', name: 'Zapisy', config: {}, virtualAreas: rules });
    assert.deepEqual(out.virtualAreas, rules, 'every rule goes out: name, what the person does, which roles at which level');
    assert.equal('virtualAreas' in m.exportModule({ moduleId: 'b1', kind: 'form', name: 'Zapisy', config: {}, virtualAreas: [] }), false, 'no rule, no key');
    const back = [];
    assert.deepEqual(m.readVirtualAreas(JSON.parse(JSON.stringify(out.virtualAreas)), back), rules, 'export → import: the same rules');
    assert.deepEqual(back, [], 'a clean document reads without warnings');
    const said = [];
    const read = m.readVirtualAreas([
      { name: '  Wizytówka ', submitter: 'read', roles: [{ role: 'r-all', level: 'read' }, { role: 'r-all', level: 'write' }, { role: '', level: 'read' }, { role: 'x', level: 'boss' }] },
      { name: 'wizytówka', submitter: 'write', roles: [] },
      { submitter: 'write' },
      { name: 'Bez stopnia', submitter: 'sometimes' }
    ], said);
    assert.deepEqual(read, [
      { name: 'Wizytówka', submitter: 'read', roles: [{ role: 'r-all', level: 'read' }] },
      { name: 'Bez stopnia', submitter: 'write', roles: [] }
    ], 'trimmed names, one entry per name and role, unknown words dropped');
    assert.equal(said.length, 5, 'each dropped thing says so: two bad roles, a repeated name, a nameless rule, an unknown submitter');
    assert.equal(m.readVirtualAreas(undefined, []), undefined, 'no key: the document says nothing about it');
    assert.deepEqual(m.readVirtualAreas('x', said), [], 'not a list: nothing, with a warning');
    assert.equal(m.levelOf(['certify']), null, 'certify alone lets in, does not look in');
    assert.equal(m.levelOf(['read', 'certify', 'admin']), 'admin');
    ok('module JSON (0120): Obszary osób out and back in; tolerant reading with a word for every dropped thing');
  }

  /* -- 0077: die Liste eines Formulars als JSON ------------------------------------------- */
  const field = (fieldId, label, kind = 'line', identityRole = 'none', options = []) =>
    ({ fieldId, label, kind, identityRole, options, help: null, areaId: 'a', labelAreaId: 'a', labelEpoch: 1, epoch: 1, position: 0, isRequired: false, isHalfWidth: false, selfEdit: true, linkCheck: false, labelSealed: '', helpSealed: null, optionsSealed: null });
  const baseFields = [field('f-imie', 'Imię', 'line', 'given_name'), field('f-nazw', 'Nazwisko', 'line', 'surname'), field('f-adres', 'Adres', 'line', 'address'), field('f-uw', 'Uwagi', 'text'), field('f-uw2', 'Uwagi', 'text')];
  const visitFields = [field('v-k', 'Komunia', 'checkbox'), field('v-s', 'Spowiedź', 'checkbox'), field('v-n', 'Namaszczenie', 'checkbox'), field('v-u', 'Uwagi', 'text')];
  const noteFields = [field('n-1', 'Notatka', 'text')];
  const ctx = {
    formId: 'form-1', formName: 'Chorzy', fields: baseFields,
    extensions: [
      { moduleId: 'ext-visits', name: 'Odwiedziny', audience: 'office', repeat: 'month', fields: visitFields },
      { moduleId: 'ext-notes', name: 'Notatki', audience: 'office', repeat: 'once', fields: noteFields },
      { moduleId: 'ext-self', name: 'Ankieta', audience: 'person', repeat: 'once', fields: noteFields }
    ],
    existing: [
      {
        registrationId: 'r-anna', hasSeat: false,
        answers: new Map([['f-imie', 'Anna'], ['f-nazw', 'Kowalska'], ['f-adres', 'ul. Długa 5']]),
        records: new Map([
          ['ext-visits', new Map([['2026-09', { registrationId: 'x-1', values: new Map([['v-k', 'tak'], ['v-u', 'słaba']]) }]])],
          ['ext-notes', new Map([['', { registrationId: 'x-2', values: new Map([['n-1', 'dzwonić przed']]) }]])]
        ])
      },
      { registrationId: 'r-jan', hasSeat: true, answers: new Map([['f-imie', 'Jan'], ['f-nazw', 'Nowak']]), records: new Map() }
    ]
  };
  const at = new Date(2026, 9, 2, 12, 0, 0);

  const keysOf = m.answerKeys(baseFields);
  assert.equal(keysOf.get('f-imie'), 'Imię');
  assert.equal(keysOf.get('f-uw'), 'f-uw', 'two questions with one label fall back to their ids');

  const exported = m.exportEntries(ctx);
  assert.equal(exported.format, m.ENTRIES_FORMAT);
  assert.deepEqual(exported.entries[0].answers, { 'Imię': 'Anna', 'Nazwisko': 'Kowalska', 'Adres': 'ul. Długa 5' });
  assert.deepEqual(exported.entries[0].records, { Odwiedziny: { '2026-09': { Komunia: true, Uwagi: 'słaba' } }, Notatki: { [m.ONCE_KEY]: { Notatka: 'dzwonić przed' } } });
  assert.equal('records' in exported.entries[1], false);

  const again = m.planEntries(exported, ctx, at);
  assert.deepEqual([again.add.length, again.change.length, again.recordsNew.length, again.recordsChange.length, again.warnings.length], [0, 0, 0, 0, 0], 'an export imports as "nothing to change"');

  const plan = m.planEntries({
    format: m.ENTRIES_FORMAT, version: 1,
    entries: [
      { id: 'r-anna', answers: { Adres: 'ul. Krótka 1', 'Imię': 'Anna' }, records: { Odwiedziny: { '2026-09': { Komunia: false, 'Spowiedź': true }, '2026-10': { Komunia: true, Namaszczenie: 'tak' }, '2026-11': { Komunia: true }, '2026-13': { Komunia: true } }, Ankieta: { once: { Notatka: 'x' } }, Brak: {} } },
      { answers: { 'imię': 'Jan', Nazwisko: 'Nowak', Adres: 'ul. Nowa 2' } },
      { answers: { 'Imię': 'Maria', Nazwisko: 'Wiśniewska', Telefon: '600' }, records: { odwiedziny: { '2026-10': { Komunia: true } } } },
      { answers: {} },
      'not an entry'
    ]
  }, ctx, at);
  assert.equal(plan.add.length, 1);
  assert.equal(plan.add[0].name, 'Maria Wiśniewska');
  assert.deepEqual(plan.add[0].answers, [{ fieldId: 'f-imie', value: 'Maria' }, { fieldId: 'f-nazw', value: 'Wiśniewska' }]);
  assert.deepEqual(plan.change, [{ registrationId: 'r-anna', answers: [{ fieldId: 'f-adres', value: 'ul. Krótka 1' }] }], 'only what differs is revised');
  assert.deepEqual(plan.recordsChange, [{ extensionId: 'ext-visits', registrationId: 'x-1', answers: [{ fieldId: 'v-k', value: '' }, { fieldId: 'v-s', value: 'tak' }] }]);
  assert.deepEqual(plan.recordsNew, [
    { extensionId: 'ext-visits', base: { registrationId: 'r-anna' }, round: '2026-10', answers: [{ fieldId: 'v-k', value: 'tak' }, { fieldId: 'v-n', value: 'tak' }] },
    { extensionId: 'ext-visits', base: { ref: 0 }, round: '2026-10', answers: [{ fieldId: 'v-k', value: 'tak' }] }
  ]);
  const said = plan.warnings.join('\n');
  for (const part of ['jeszcze się nie zaczął', '„2026-13”', 'wypełnia osoba przez swój link', 'nie ma rozszerzenia „Brak”', 'nie ma pytania „Telefon”', 'bez żadnej odpowiedzi', 'to nie jest obiekt', 'dopasowan', 'własny link']) {
    assert.ok(said.includes(part), `a warning says: ${part}\n${said}`);
  }
  assert.ok('error' in m.planEntries({ format: 'recreatio/page', entries: [] }, ctx, at));
  assert.ok('error' in m.planEntries({ format: m.ENTRIES_FORMAT }, ctx, at));

  const listDoc = m.entriesDescription(ctx, at);
  for (const key of Object.keys(m.ENTRIES_KEYS)) assert.ok(listDoc.includes(`"${key}" — `), `list description explains ${key}`);
  for (const part of ['"Imię" — ', '"Odwiedziny" — co miesiąc', '"Komunia" — tak / nie', '"2026-10"', '"Notatki" — jednorazowe']) assert.ok(listDoc.includes(part), `list description names ${part}`);
  assert.ok(!listDoc.includes('"Ankieta"'), 'extensions the person fills are not offered for import');
  const fromExample = m.planEntries(JSON.parse(listDoc.slice(listDoc.indexOf('Przykład:') + 'Przykład:'.length)), { ...ctx, existing: [] }, at);
  assert.ok(!('error' in fromExample) && fromExample.warnings.length === 0 && fromExample.add.length === 2 && fromExample.recordsNew.length === 1, 'the example in the list description imports cleanly');
  ok('list JSON: export round-trips, new and changed people, records per period, warnings, a description built from the form');
  }

  /* -- 2026-10-24: Dateien, um die eine Seite bittet ("images", "page-image:@schlüssel") ---------- */
  {
    const P = m.NEED_PREFIX;
    const page = (extra) => ({ format: m.PAGE_FORMAT, version: 1, ...extra });
    const ref = (n) => `page-image:0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
    const doc = page({
      images: [
        { key: 'dom', label: 'Dom od ogrodu', description: 'Dom latem, poziomo', name: 'dom-ogrod.jpg' },
        { key: 'ognisko', kind: 'video', description: 'Ogień w pętli' },
        { key: 'szum', kind: 'sound', label: 'Szum lasu' },
        { key: 'zapas', label: 'Nieużywany' },
        { key: 'zły klucz' },
        { key: 'dom', label: 'Drugi raz' },
        { key: 'logo', kind: 'gif' }
      ],
      cover: [{ kind: 'image', speed: 0.3, url: `${P}dom`, opacity: 1 }],
      menu: [{ label: 'Start', kind: 'abs', target: '', image: `${P}logo` }],
      show: { scenes: [{ key: 's1', title: 'Start' }], sound: { url: `${P}szum`, label: 'Las' } },
      modules: [
        { kind: 'image', config: { url: `${P}dom`, video: `${P}ognisko`, alt: 'Dom' } },
        { kind: 'gallery', config: { shots: [{ url: `${P}galeria-1`, caption: 'Pierwsze' }] } }
      ]
    });

    const needs = m.readImageNeeds(doc);
    assert.deepEqual(needs.needs.map((n) => [n.key, n.kind, n.uses, n.declared]),
      [['dom', 'image', 2, true], ['ognisko', 'video', 1, true], ['szum', 'sound', 1, true], ['zapas', 'image', 0, true], ['logo', 'image', 1, true], ['galeria-1', 'any', 1, false]],
      'described files with their kinds and uses; one only used, without a description');
    assert.deepEqual([needs.needs[0].label, needs.needs[0].description, needs.needs[0].name, needs.needs[1].label], ['Dom od ogrodu', 'Dom latem, poziomo', 'dom-ogrod.jpg', 'ognisko'],
      'label, description and file name read; a missing label is the key');
    for (const part of ['„zły klucz”', '„dom” jest opisany w "images" dwa razy', '„zapas” jest opisany', '„logo”: "kind" „gif”', `„${P}galeria-1” nie ma opisu`]) {
      assert.ok(needs.warnings.some((w) => w.includes(part)), `a warning says: ${part}\n${needs.warnings.join('\n')}`);
    }
    assert.equal(m.readImageNeeds(doc), needs, 'the same document is read once');
    assert.equal(m.readImageNeeds(page({ modules: [] })), undefined, 'no "images" and no placeholder: nothing is asked for');
    assert.equal(m.readImageNeeds(page({ images: [], modules: [] })), undefined, 'an empty list asks for nothing');

    /* Einsetzen: überall im Dokument, die Beschreibungen bleiben, was fehlt, wird leer. */
    const refs = new Map([['dom', ref(1)], ['ognisko', ref(2)], ['logo', ref(3)], ['galeria-1', ref(4)]]);
    const resolved = m.resolveImageNeeds(doc, refs);
    const out = resolved.doc;
    assert.equal(out.cover[0].url, ref(1), 'in a background layer');
    assert.equal(out.menu[0].image, ref(3), 'in the menu');
    assert.equal(out.show.sound.url, '', 'a file nobody added leaves its place empty');
    assert.deepEqual([out.modules[0].config.url, out.modules[0].config.video, out.modules[1].config.shots[0].url], [ref(1), ref(2), ref(4)], 'in modules, also deep in lists');
    assert.deepEqual(out.images, doc.images, 'the descriptions themselves stay as they are');
    assert.deepEqual([resolved.placed, resolved.missing], [5, ['szum']], 'five places filled, one file missing');
    assert.ok(JSON.stringify(doc).includes(`${P}dom`), 'the document itself is not changed');
    assert.equal(m.resolveImageNeeds({ text: `tło: ${P}dom, koniec` }, refs).doc.text, `tło: ${ref(1)}, koniec`, 'inside a longer text too');

    /* Der Plan sieht echte Dateien: kein Logo fällt weg, die Module tragen die Kennungen. */
    const planned = m.planImport(out, { ...now, parts: [], logic: null }, m.DEFAULT_IMPORT);
    assert.ok(!('error' in planned), 'the resolved document imports');
    assert.ok(!planned.warnings.some((w) => w.startsWith('Menu:')), `no logo is reported as broken:\n${planned.warnings.join('\n')}`);
    assert.ok(planned.warnings.some((w) => w.includes('"show.sound"')), 'the sound nobody added is said to be missing');
    assert.equal(planned.menu.items[0].image, ref(3), 'the menu keeps its logo');
    assert.equal(planned.parts[0].config.url, ref(1), 'the image module carries the file');
    const raw = m.planImport(doc, { ...now, parts: [], logic: null }, m.DEFAULT_IMPORT);
    assert.ok(raw.warnings.some((w) => w.includes('Start') && w.includes('image')), 'without resolving, the menu would drop its placeholder — so the import resolves first');
    const shown = m.planImport(m.previewImageNeeds(doc, new Set(['logo'])), { ...now, parts: [], logic: null }, m.DEFAULT_IMPORT);
    assert.equal(shown.menu.items[0].image, m.PREVIEW_REF, 'the preview puts a placeholder in the shape of a file where one is chosen');
    assert.equal(shown.parts[0].config.url ?? '', '', 'and leaves the rest empty, as the import will');

    /* Mehrere Dateien auf einmal: nach Namen, ohne Endung, nach Schlüssel; der Rest bleibt übrig. */
    const match = m.matchFiles(needs.needs, ['DOM-OGROD.JPG', 'ognisko.mp4', 'cokolwiek.png', 'szum.mp3', 'dom-ogrod.png']);
    assert.deepEqual([...match.byKey.entries()], [['dom', 0], ['ognisko', 1], ['szum', 3]], 'by the given name (any case), then by the key as the name');
    assert.deepEqual(match.rest, [2, 4], 'what fits nothing (or comes second) stays for the person');
    assert.equal(m.matchFiles(needs.needs, ['dom-ogrod.webp']).byKey.get('dom'), 0, 'the given name without its extension also fits');

    /* Was eine Datei sein darf. */
    assert.equal(m.fileProblem('image', 'image/png', 1000), null);
    assert.ok(m.fileProblem('image', 'video/mp4', 1000).includes('obraz'), 'a film is no picture');
    assert.ok(m.fileProblem('image', 'image/jpeg', 9 * 1024 * 1024).includes('8 MB'), 'a picture over 8 MB is refused');
    assert.equal(m.fileProblem('video', 'video/webm', 20 * 1024 * 1024), null);
    assert.ok(m.fileProblem('sound', null, 10).includes('dźwięk'), 'an unknown file is no sound');
    assert.equal(m.fileProblem('file', 'application/pdf', 1000), null);
    assert.equal(m.fileProblem('any', 'audio/mpeg', 1000), null, 'an undescribed file takes anything the page takes');
    assert.ok(m.fitsNeed('file', 'image/png') && !m.fitsNeed('image', 'application/pdf'), 'documents may be pictures, pictures no documents');
    assert.ok(m.acceptOf('image').includes('image/png') && m.acceptOf('sound').includes('.mp3'), 'the file dialog offers the right kinds');

    /* Die Beschreibung: der Schlüssel, der Abschnitt, und sein Beispiel liest sich und importiert sauber. */
    const text = m.pageDescription();
    assert.ok(text.includes('"images" — ') && text.includes('## Pliki do dodania') && text.includes(`"${P}klucz"`), 'the description explains "images" and the placeholder');
    const at = text.indexOf('## Pliki do dodania');
    const sample = JSON.parse(text.slice(text.indexOf('Przykład:', at) + 'Przykład:'.length, text.indexOf('\n## ', at + 5)).trim());
    const sampleNeeds = m.readImageNeeds(sample);
    assert.ok(sampleNeeds.warnings.length === 0 && sampleNeeds.needs.length === 3 && sampleNeeds.needs.every((n) => n.declared && n.uses > 0), 'the example reads cleanly: three described files, each used');
    const sampleRefs = new Map(sampleNeeds.needs.map((n, i) => [n.key, ref(10 + i)]));
    const samplePlan = m.planImport(m.resolveImageNeeds(sample, sampleRefs).doc, { ...now, parts: [], logic: null }, m.DEFAULT_IMPORT);
    assert.ok(!('error' in samplePlan) && samplePlan.warnings.length === 0, `the example imports without a word:\n${('warnings' in samplePlan ? samplePlan.warnings : []).join('\n')}`);
    ok('page JSON (2026-10-24): files a page asks for — described in "images", placed wherever "page-image:@key" stands, missing ones empty, matched by name, checked by kind, described');
  }

} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
