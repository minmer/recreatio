/**
 * 2026-10-27 — DIE VORSCHAU FÜR ASSISTENTEN, nachgemessen (ohne Browser).
 *
 *   1. Aus einem Dokument wird, was `GET /page/<pfad>` nach dem Import liefern
 *      würde: Titel (nur mit Titel auch der Vorspann), Art, Aussehen, Menü,
 *      Bausteine als gespeicherte Zeichenketten; erbetene Dateien bekommen
 *      Kennungen der Vorschau, überall, wo ihr Platzhalter steht.
 *   2. Die Prüfung der Schlüssel schweigt zu allem, was die Beschreibung kennt:
 *      das Beispiel JEDER Art geht ohne ein Wort durch (sonst liefen Prüfung
 *      und Beschreibung auseinander) — und nennt, was der Import nicht nimmt.
 *   3. Bausteine je Grösse, Folge der Slajdy, Weg einer Präsentation, die Wahl
 *      eines Bausteins (M3, modules[2], Kennung, Art).
 *   4. Die Fixtures der Präsentationen tragen keinen unbekannten Schlüssel.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-preview-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}preview/previewDoc';
export { lintDocument } from '${app}preview/previewLint';
export { PARTS, partOf } from '${app}pages/parts/registry';
`);
/* 2026-11-03 — die Vorschau einer Baza wiedzy (preview_knowledge): die Baza im Speicher, der erfundene Fortschritt, die Proben. */
const knowledgeEntry = join(workspace, 'knowledge.ts');
await writeFile(knowledgeEntry, `
export * from '${app}cogita/memoryBase';
export { readView } from '${app}cogita/views';
export { gaugeFromMarks, cardKnowness } from '${app}cogita/knowing';
`);
await build({
  entryPoints: [entry, knowledgeEntry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: workspace,
  outExtension: { '.js': '.mjs' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
});

/* Wie in app-chat-check: ein BroadcastChannel des Schlüsselbunds hielte den Lauf sonst am Leben. */
const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;

const fixture = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);

  /* -- 1: das Dokument als Seite nach dem Import --------------------------------------- */
  const doc = {
    format: 'recreatio/page',
    version: 1,
    path: 'zz/rekolekcje',
    title: 'Rekolekcje',
    lead: 'Trzy wieczory.',
    mode: 'page',
    theme: { mode: 'light', accent: '#1f6f50' },
    menu: [{ label: 'Start', target: 'zz/rekolekcje' }],
    images: [{ key: 'plakat', label: 'Plakat', description: 'Pionowy plakat' }],
    modules: [
      { id: 'a', kind: 'text', config: { title: 'O nas', body: ['Raz', 'Dwa'] }, layout: { desktop: { position: { row: 1, col: 1 }, size: { colSpan: 4, rowSpan: 3 } } } },
      { kind: 'image', config: { url: 'page-image:@plakat', alt: 'Plakat' } },
      { kind: 'hero', config: { headline: 'Witaj', subtitle: 'nie ma' } },
      { kind: 'slider', config: {} }
    ]
  };
  const pp = m.planPreview({ doc });
  assert.ok(!('error' in pp), 'the document plans');
  assert.equal(pp.path, 'zz/rekolekcje', 'the path comes from the document');
  assert.equal(pp.content.title, 'Rekolekcje');
  assert.equal(pp.content.lead, 'Trzy wieczory.');
  assert.equal(pp.content.mode, 'page');
  assert.equal(pp.content.parts.length, 3, 'the unknown kind is skipped, like the import does');
  assert.ok(pp.warnings.some((w) => w.includes('slider')), 'and the import warning says so');
  assert.equal(pp.content.menu.items.length, 1);
  assert.equal(pp.content.menu.from, 'zz/rekolekcje');
  assert.equal(JSON.parse(pp.content.theme).accent, '#1f6f50');
  const image = pp.content.parts.find((p) => p.kind === 'image');
  assert.equal(JSON.parse(image.config).url, `page-image:${m.previewFileId(0)}`, 'the placeholder became a preview file id');
  assert.equal(pp.files.get('plakat'), m.previewFileId(0));
  assert.equal(pp.needs.length, 1);
  assert.ok(pp.content.parts.every((p) => typeof p.layout === 'string' && typeof p.config === 'string' && p.moduleId === p.id), 'parts are stored strings; a new place makes its module under its own id');
  assert.equal(pp.content.editable, false);
  assert.equal(pp.content.access.restricted, false);
  assert.equal(pp.content.id, m.PREVIEW_PAGE_ID);

  const untitled = m.planPreview({ doc: { modules: [{ kind: 'text', config: { body: 'x' } }], lead: 'bez tytułu' } });
  assert.equal(untitled.content.title, null, 'without a title nothing of the page text is saved');
  assert.equal(untitled.content.lead, null);
  assert.ok(untitled.notes.some((n) => n.includes('tytułu')), 'and the preview says why');
  assert.equal(untitled.path, m.PREVIEW_PATH);

  assert.ok('error' in m.planPreview({ doc: '{ broken' }), 'broken JSON is an error in words');
  assert.ok('error' in m.planPreview({ doc: { nothing: true } }), 'a document that is no page is an error');
  assert.equal(m.planPreview({ doc: JSON.stringify(doc) }).content.parts.length, 3, 'JSON text works like an object');
  assert.equal(m.cleanPath('#/a//b/ '), 'a/b');

  /* Auf eine bestehende Seite: bekannte Kennungen ändern an Ort und Stelle, neue kommen dazu. */
  const base = { ...pp.content, title: 'Alt', parts: pp.content.parts };
  const again = m.planPreview({ doc: { modules: [{ id: pp.content.parts[0].id, kind: 'text', config: { title: 'Neu', body: 'x' } }, { kind: 'notice', config: { body: 'Uwaga' } }] }, base });
  assert.equal(again.content.parts.length, 4, 'three kept (one changed in place) and one added');
  assert.equal(again.content.parts[0].id, pp.content.parts[0].id);
  assert.equal(JSON.parse(again.content.parts[0].config).title, 'Neu');
  assert.equal(again.content.title, 'Alt', 'a document without a title keeps the title of the page');
  ok('a document becomes the page the service would deliver after the import (title rule, parts, look, menu, files, base page)');

  /* -- 2: die Prüfung der Schlüssel ------------------------------------------------------ */
  for (const def of m.PARTS) {
    const said = m.lintDocument({ format: 'recreatio/page', modules: [{ kind: def.kind, config: def.json.example }] });
    assert.deepEqual(said, [], `${def.kind}: its own example passes without a word — ${JSON.stringify(said)}`);
  }
  const lint = m.lintDocument({
    ...doc,
    colour: 'red',
    theme: { mode: 'light', accent: 'green', glow: 1 },
    show: { scenes: [{ key: 'a', change: 'swoosh' }] },
    modules: [
      { kind: 'text', config: { title: 'A', subtitle: 'x' }, layout: { desktop: { position: { row: 1, col: 5 }, size: { colSpan: 5, rowSpan: 2 } }, watch: {} }, slide: { transition: 'warp' } },
      { kind: 'hero', config: { headline: 'H', subtitle: 'x', actions: [{ label: 'L', href: '#a', colour: 'red' }] } },
      { kind: 'form', config: { title: 'F', needs: 'x' }, colour: 'red' }
    ]
  });
  const has = (path, kind) => lint.some((one) => one.path === path && one.kind === kind);
  assert.ok(has('colour', 'unknown'), 'an unknown page key');
  assert.ok(has('theme.glow', 'unknown') && has('theme.accent', 'changed'), 'theme keys and colours');
  assert.ok(has('show.scenes[0].change', 'dropped'), 'an invalid scene change is dropped (the default takes over)');
  assert.ok(has('modules[0].config.subtitle', 'unknown'), 'an unknown key of a flat part');
  assert.ok(has('modules[0].layout.desktop.size.colSpan', 'changed') && has('modules[0].layout.desktop.size.rowSpan', 'changed'), 'sizes that snap');
  assert.ok(has('modules[0].layout.desktop.position.col', 'changed'), 'a column that does not fit');
  assert.ok(has('modules[0].layout.watch', 'unknown'), 'an unknown screen size');
  assert.ok(has('modules[0].slide.transition', 'dropped'), 'an unknown transition');
  assert.ok(has('modules[1].config.subtitle', 'unknown') && has('modules[1].config.actions[0].colour', 'unknown'), 'unknown keys of an event part, also inside lists');
  assert.ok(!lint.some((one) => one.path === 'modules[1].config.subtitle' && one.kind === 'dropped'), 'unknown is not also reported as dropped');
  assert.ok(has('modules[2].config.needs', 'dropped'), 'a key the module keeps for itself');
  assert.ok(has('modules[2].colour', 'unknown'), 'an unknown key of a module entry');
  ok(`key check: every kind's example passes silently (${m.PARTS.length}); unknown, dropped and changed keys are named with their path`);

  /* -- 3: Grössen, Slajdy, Weg ------------------------------------------------------------ */
  const modules = m.modulesOf(pp);
  assert.equal(modules.length, 3);
  assert.deepEqual([modules[0].n, modules[0].docIndex, modules[0].kind], [1, 0, 'text']);
  assert.deepEqual([modules[0].sizes.desktop.colSpan, modules[0].sizes.tablet.colSpan, modules[0].sizes.mobile.colSpan], [4, 4, 2], 'sizes per screen, snapped like the grid');
  assert.equal(modules[1].docIndex, 1);
  assert.ok(modules.every((one) => one.sizes.desktop.shows !== ''), 'every module says what it shows');
  assert.equal(m.pickModule(pp, 'M2').kind, 'image');
  assert.equal(m.pickModule(pp, 'modules[2]').kind, 'hero');
  assert.equal(m.pickModule(pp, 'hero').kind, 'hero');
  assert.equal(m.pickModule(pp, 2).kind, 'image');
  assert.equal(m.pickModule(pp, 'M9'), null);
  assert.deepEqual(m.sizesFor(2).map((s) => `${s.colSpan}x${s.rowSpan}`), ['2x1', '2x3', '2x5']);
  assert.equal(m.sizesFor(6).length, 12);

  const deck = m.planPreview({ doc: { ...doc, mode: 'slides', modules: [
    { id: 'a', kind: 'text', config: { title: 'A', body: 'x' } },
    { id: 'b', kind: 'image', config: { url: '/x.png', alt: 'x' }, slide: { with: { slide: 'a', side: 'end', share: 40 } } },
    { id: 'c', kind: 'notice', config: { body: 'Uwaga' }, slide: { stage: { frames: { a: { x: 80, y: 20, w: 20 } } } } }
  ] } });
  const slides = m.deckPlanOf(deck);
  assert.deepEqual(slides.slides.map((s) => s.modules.length), [0, 2], 'a title slide, then one slide carrying its companion');
  assert.equal(slides.stage.length, 1, 'the stage module has no slide of its own');

  const home = m.planPreview({ doc: await fixture('presentation-home.json') });
  const show = m.showPlanOf(home);
  assert.deepEqual(show.route, ['start', 'calosc', 'czlowiek', 'dane', 'dzieje', 'kontakt'], 'the route without buttons');
  assert.deepEqual(show.zones.map((z) => z.to - z.at + 1), [1, 4, 3, 3, 1, 1], 'steps per scene');
  assert.equal(show.zones[1].at, 1);
  assert.ok(m.modulesOf(home).filter((one) => one.kind === 'text' && one.title !== '').every((one) => one.visible), 'a titled text is visible on a stage');
  ok('sizes per screen, picking a module, slides with companions and stage, the presentation route and its steps');

  /* -- 4: die Fixtures ----------------------------------------------------------------------- */
  for (const name of ['presentation-home.json', 'cogita-home.json', 'hortus-dei.json', 'physics-lesson.json', 'lab2d-wrzenie.json']) {
    const said = m.lintDocument(await fixture(name)).filter((one) => one.kind === 'unknown');
    assert.deepEqual(said, [], `${name}: no unknown keys — ${JSON.stringify(said.slice(0, 3))}`);
  }
  ok('the fixtures carry no unknown key');

  /* -- 5: eine Baza wiedzy aus JSON (preview_knowledge) ------------------------------------------ */
  const k = await import(pathToFileURL(join(workspace, 'knowledge.mjs')).href);
  const template = async (name) => JSON.parse(await readFile(new URL(`../../templates/cogita/${name}`, import.meta.url), 'utf8'));
  const NOW = Date.parse('2026-11-03T12:00:00Z');

  const atom = await k.memoryBase(await template('przyklad-atom.json'));
  assert.ok(!('error' in atom), 'the atom example imports into memory');
  assert.deepEqual(atom.warnings, [], 'without a warning');
  assert.equal(atom.lib.entities().length, 24);
  assert.ok('error' in await k.memoryBase('{ zepsuty'), 'broken JSON is an error in words');
  assert.ok('error' in await k.memoryBase({ format: 'recreatio/page' }), 'a page is no knowledge base');
  const none = await k.previewLearner(atom.lib, 'none', NOW);
  assert.equal(none.learner.progress.answers.size, 0, 'no progress: no answers');
  const all = await k.previewLearner(atom.lib, 'all', NOW);
  assert.ok(all.counts.known > 0 && all.counts.new === 0, 'all: every card known');
  const half = await k.previewLearner(atom.lib, 'partial', NOW);
  assert.ok(half.counts.known > 0 && half.counts.due > 0 && half.counts.new > 0 && half.counts.forgotten + half.counts.wrong > 0, `partial: known, due, forgotten or wrong, new — ${JSON.stringify(half.counts)}`);
  assert.equal(Object.values(half.counts).reduce((a, b) => a + b, 0), half.moods.size);
  /* Die erfundenen Antworten treffen die Bänder der Kenntnis, wie die App sie rechnet. */
  const { cards } = await atom.lib.cards('podglad');
  const g = k.gaugeFromMarks(cards, (key) => half.learner.marks(key), atom.lib.dependencies(), NOW);
  for (const [key, mood] of half.moods) {
    const kn = k.cardKnowness(g, key);
    const fits = mood === 'known' ? kn >= 1 : mood === 'due' ? kn >= 0.1 && kn < 1 : mood === 'new' ? half.learner.marks(key).length === 0 : kn < 0.1 && half.learner.marks(key).length > 0;
    assert.ok(fits, `${mood}: knowness ${kn} of ${key}`);
  }
  ok(`knowledge preview: a course imports into memory; the invented progress (${JSON.stringify(half.counts)}) lands in the app's bands`);

  /* Die Muster des Leitfadens (`example-generators`): was rechnet, gibt jedes Mal eine gültige Fassung. */
  const gens = await k.memoryBase(await template('przyklad-generatory.json'));
  assert.ok(!('error' in gens) && gens.warnings.length === 0, `the generator examples import — ${'error' in gens ? gens.error : gens.warnings.join(' | ')}`);
  const report = await k.generatorReport(gens.lib, 12);
  const byRef = new Map(report.map((r) => [r.ref, r]));
  const num = (text) => Number(String(text).split(' ')[0].replace(',', '.'));
  const speed = byRef.get('@generatory/q-predkosc');
  assert.equal(speed.made, 12, 'speed: an instance every time');
  assert.ok(speed.samples.every((s) => Math.abs(num(s.answer) - s.values.s / s.values.t) < 1e-4 * Math.max(1, s.values.s / s.values.t) && s.values.s % 10 === 0 && s.values.t >= 2 && s.values.t <= 60), 'speed: s/t from the ranges (step 10)');
  const equation = byRef.get('@generatory/q-rownanie');
  assert.equal(equation.made, 12, 'linear equation: an instance every time');
  assert.ok(equation.samples.every((s) => s.values.a * s.values.x + s.values.b === s.values.c && num(s.answer) === s.values.x && s.values.x !== 0 && Number.isInteger(s.values.x)), 'linear equation: built backwards from an integer solution, x ≠ 0');
  const log = byRef.get('@generatory/q-logarytm');
  assert.ok(log.made === 12 && log.samples.every((s) => s.values.p ** s.values.k === s.values.w && num(s.answer) === s.values.k), 'logarithm: log_p(p^k) = k');
  assert.ok(new Set(speed.samples.map((s) => s.prompt)).size > 6, 'the instances differ');
  /* `\frac{ s }{ t }` (Leerzeichen in den Klammern) bleibt in Buchstaben — `\frac{s}{t}` bekäme die Zahlen. */
  assert.ok(speed.samples.every((s) => s.hints?.[0]?.includes('\\frac{ s }{ t }') === true), `speed: the hint keeps the letters — ${speed.samples[0]?.hints?.[0]}`);
  /* Ein Platzhalter, der stehen blieb (`{nazwa}`), oder ein Wert, der keiner ist — „NaNO₃" (Natriumnitrat) ist einer; auch in Podpowiedzi und Wyjaśnienie. */
  const unfilled = /\{[A-Za-z_][\w.[\]]*\}|\bNaN\b|\bundefined\b/;
  const shownOf = (s) => `${s.prompt} ${s.answer} ${(s.options ?? []).join(' ')} ${(s.hints ?? []).join(' ')} ${s.explanation ?? ''}`;
  for (const r of report) {
    assert.ok(r.made === 12 && r.problems.length === 0, `${r.ref}: an instance every time — ${r.problems.join(' | ')}`);
    assert.ok(r.samples.every((s) => s.answer !== '' && !unfilled.test(shownOf(s))), `${r.ref}: no unfilled value — ${JSON.stringify(r.samples.find((s) => unfilled.test(shownOf(s))))}`);
    /* Gezogene Einträge mit ihrem Namen aus dem Dokument, nicht mit der Kennung des Speichers. */
    assert.ok(r.samples.every((s) => !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(JSON.stringify(s.values ?? {}))), `${r.ref}: drawn entries by their names — ${JSON.stringify(r.samples[0]?.values)}`);
  }
  assert.equal(byRef.get('@generatory/q-wzor-z-nazwy').samples[0].values.kation.startsWith('@generatory/jon-'), true, 'a drawn ion by its ref');
  assert.ok(byRef.get('@generatory/q-wzor-z-nazwy').samples.every((s) => /^[A-Za-z()₀-₉]+$/.test(s.answer)), 'chemistry: a formula with subscripts');
  assert.ok(byRef.get('@generatory/q-rownanie').samples.every((s) => s.explanation?.includes(`x = ${String(s.values.x)}`) === true), 'equation: the solution shows this instance');
  ok(`generator samples: all ${report.length} patterns valid in 12 of 12 instances (entry draws included); prompts, hints and solutions filled`);

  /* Die Welt des Wissens (`example-world`) und ihre Seite (`example-world-page`). */
  const world = await k.memoryBase(await template('przyklad-swiat.json'));
  assert.ok(!('error' in world) && world.warnings.length === 0, `the world example imports — ${'error' in world ? world.error : world.warnings.join(' | ')}`);
  const graph = world.lib.prerequisites();
  assert.deepEqual(graph.circles, [], 'no cycle in its learning order');
  assert.ok(Math.max(...graph.level.values()) >= 5, 'several levels from the fundamentals');
  const topics = world.lib.entities().filter((e) => e.kinds.some((kind) => world.lib.kind(kind)?.name === 'Temat'));
  assert.equal(topics.length, 20, 'twenty topics (one from the history of science)');
  /* Dieselbe Baza zweimal importiert (andere Kennungen — wie Desktop und Telefon in zwei Tabs): dieselben Zustände. */
  const twice = await k.memoryBase(await template('przyklad-swiat.json'));
  const moodsBy = async (base) => {
    const stable = k.stableKeyOf(base.lib);
    const p = await k.previewLearner(base.lib, 'partial', NOW);
    return new Map([...p.moods].map(([key, mood]) => [stable(key), mood]));
  };
  const firstMoods = await moodsBy(world);
  assert.ok([...firstMoods.keys()].every((key) => !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(key)), 'stable keys carry no import id');
  assert.deepEqual(await moodsBy(twice), firstMoods, 'the same document gives the same invented progress in every tab');
  const landscape = world.lib.docs('view').find((e) => e.data.mode === 'landscape');
  assert.ok(landscape !== undefined, 'a view saved as landscape');
  assert.equal(k.readView(landscape.data).mode, 'landscape', 'the app reads it as a landscape');
  assert.equal(k.readView(landscape.data).landscape?.budget, 60, 'its budget');
  const conversion = (await k.generatorReport(world.lib, 8)).find((r) => r.ref === '@swiat/t-zamiana');
  assert.ok(conversion.made === 8 && conversion.problems.length === 0, `the template with "generate" makes a card every time — ${conversion.problems.join(' | ')}`);
  assert.ok(conversion.samples.every((s) => /^Zamień na metry: \d+ [khcm]m$/.test(s.prompt) && Number.isFinite(num(s.answer))), 'conversion: prompt and a number');
  /* `texts` des Generators → Eingang „solution" der Karte: „45 km = 45 · 1000 m = 45000 m". */
  assert.ok(conversion.samples.every((s) => /^\d+ [khcm]m = \d+ · [\d,]+ m = [\d,]+ m$/.test(s.explanation ?? '') && num(s.answer) === num(s.explanation.split(' = ')[2])), `conversion: the solution with this instance's numbers — ${conversion.samples[0]?.explanation}`);
  const pageDoc = await template('przyklad-swiat-strona.json');
  const pageSaid = m.lintDocument(pageDoc);
  assert.deepEqual(pageSaid.filter((one) => one.kind === 'unknown'), [], `example-world-page: no unknown keys — ${JSON.stringify(pageSaid.slice(0, 3))}`);
  const viewModule = pageDoc.modules.find((one) => one.kind === 'view');
  assert.ok(viewModule.config.mode === 'krajobraz' && 'answers' in viewModule.config && /Punkty świata wiedzy/.test(viewModule.config.rewards), 'example-world-page: the landscape module names answers and the course rewards');
  ok('the world example: 20 topics, no cycle, a landscape view the app reads, the "generate" template with its solution, the same invented progress in every tab; its page has no unknown key');
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
