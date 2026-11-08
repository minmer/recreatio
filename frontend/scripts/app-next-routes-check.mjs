/** Regression checks for locked destinations and source citation routes. */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
globalThis.BroadcastChannel = undefined;
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'next-routes-'));
const app = join(process.cwd(), 'src/app').replace(/\\/g, '/');
try {
  await writeFile(join(dir, 'entry.tsx'), `
export { storyRoute } from '${app}/cogita/storyLock';
export { firstStoryGoalStep, keepStoryGoal } from '${app}/cogita/storyGoal';
export { prerequisiteGraph } from '${app}/cogita/prerequisites';
export { EMPTY_PROGRESS } from '${app}/cogita/learn';
export { CogitaLibrary } from '${app}/cogita/store';
export { Markup } from '${app}/cogita/ui';
export { readerPath } from '${app}/library/SourceJump';
export { placeFor } from '${app}/library/sourceFind';
export { findBlocks, placeOptions } from '${app}/library/sourceText';
export { parsePlace, readPage } from '${app}/library/locations';
export { createElement } from 'react';
export { renderToStaticMarkup } from 'react-dom/server';
`);
  await build({ entryPoints: [join(dir, 'entry.tsx')], outfile: join(dir, 'entry.mjs'), bundle: true, format: 'esm', platform: 'node', jsx: 'automatic',
    nodePaths: [join(process.cwd(), 'node_modules')], loader: { '.css': 'empty' }, logLevel: 'error',
    define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } });
  const m = await import(pathToFileURL(join(dir, 'entry.mjs')).href);
  const dependencies = [{ parent: 'basics', child: 'chapter', kind: 'prerequisite', impact: 1 }, { parent: 'chapter', child: 'target', kind: 'prerequisite', impact: 1 }];
  const graph = m.prerequisiteGraph(dependencies);
  const flows = ['basics', 'chapter'].map((id) => ({ id: `flow-${id}`, data: { name: id, unit: id, graph: { nodes: [{ id: 'end', type: 'end', config: {} }], edges: [] } } }));
  const learner = { progress: { ...m.EMPTY_PROGRESS, positions: new Map() }, marks: () => [] };
  const lib = { prerequisites: () => graph, dependencies: () => [], merges: () => new Map(), settings: () => ({}), docs: (kind) => kind === 'flow' ? flows : [],
    entity: (id) => ({ id, kinds: ['topic'], data: {} }), entry: (id) => ({ id, data: { _ref: id } }), label: (e) => e.id };
  let route = m.storyRoute(lib, [], learner, 'target');
  assert.deepEqual(route.map((x) => x.id), ['basics', 'chapter', 'target'], 'route includes the destination after its prerequisites');
  assert.deepEqual(route.map((x) => x.lock.missing), [[], ['basics'], ['basics', 'chapter']], 'only the first unmet stage can start');
  assert.equal(route[0].story.id, 'flow-basics', 'story prerequisites lead to their story, not an empty card run');
  assert.deepEqual(m.storyRoute(lib, [], learner, 'target'), route, 'viewing or cancelling a route cannot change availability');
  assert.equal(m.firstStoryGoalStep(route, [], new Set()).story.id, 'flow-basics', 'a new goal starts with the first required lecture');
  learner.progress.positions.set('flow-basics', { flow: 'flow-basics', step: 'end', visited: ['end'], done: true, at: Date.now() });
  route = m.storyRoute(lib, [], learner, 'target');
  assert.equal(route[0].learned, true);
  assert.deepEqual(route[1].lock.missing, [], 'finishing the first story opens the next');
  assert.deepEqual(route[2].lock.missing, ['chapter'], 'the destination still waits for its remaining prerequisite');
  assert.equal(m.firstStoryGoalStep(route, [], new Set()).story.id, 'flow-chapter', 'completed lectures are skipped');
  const saved = [];
  const goalLearner = { ...learner, keepPosition: async (position) => { saved.push(position); learner.progress.positions.set(position.flow, position); } };
  const goalLib = { ...lib, docs: (kind) => kind === 'view' ? [{ id: 'course-map', data: { mode: 'landscape' } }, { id: 'table', data: { mode: 'table' } }] : lib.docs(kind) };
  const firstGoal = await m.keepStoryGoal(goalLib, [], goalLearner, 'target');
  assert.equal(firstGoal.story.id, 'flow-chapter', 'saving the goal opens the first unfinished lecture');
  assert.deepEqual(saved.map((p) => p.flow), ['landscape:wpisy', 'landscape:course-map'], 'the default and saved landscapes retain the goal');
  assert.ok(saved.every((p) => p.step === 'target'), 'the goal remains the destination, not its first prerequisite');
  assert.ok(saved.every((p) => JSON.stringify(p.visited) === JSON.stringify(['basics', 'chapter', 'target'])), 'the saved goal includes the numbered route');
  assert.equal(learner.progress.positions.get('flow-basics').done, true, 'setting a goal preserves completed lessons');
  assert.equal(learner.progress.positions.has('flow-chapter'), false, 'setting a goal never completes its first lesson');
  await assert.rejects(m.keepStoryGoal(goalLib, [], { ...goalLearner, keepPosition: async () => { throw Error('save failed'); } }, 'target'), /save failed/, 'a failed save cannot report a successful launch');
  learner.progress.positions.set('flow-chapter', { flow: 'flow-chapter', step: 'end', visited: ['end'], done: true, at: Date.now() });
  assert.deepEqual(m.storyRoute(lib, [], learner, 'target').at(-1).lock, { missing: [], weak: [], due: [] }, 'the destination opens after both stories');
  assert.deepEqual(m.storyRoute({ ...lib, prerequisites: () => m.prerequisiteGraph([]) }, [], learner, 'standalone').map((x) => x.id), ['standalone']);

  const card = { key: 'q', question: 'q', about: ['basics'], direction: '', fingerprint: 'q', prompt: [], explain: [], answer: { form: 'flash', back: [] }, varies: false, requires: [] };
  const reviewing = { progress: { ...m.EMPTY_PROGRESS, positions: new Map() }, marks: () => [{ at: Date.now() - 10 * 60000, correctness: 0.6 }] };
  const reviewLib = { ...lib, docs: () => [], prerequisites: () => m.prerequisiteGraph([{ parent: 'basics', child: 'target', kind: 'prerequisite', impact: 1 }]) };
  const weak = m.storyRoute(reviewLib, [card], reviewing, 'target').at(-1).lock;
  assert.deepEqual(weak.missing, []);
  assert.deepEqual(weak.weak.map((x) => x.key), ['q'], 'review action contains the actual weak prerequisite cards');
  assert.deepEqual(weak.due, ['basics']);
  const reviewGoal = await m.keepStoryGoal(reviewLib, [card], { ...reviewing, keepPosition: async () => {} }, 'target');
  assert.equal(reviewGoal.kind, 'review', 'a required review opens before the destination');
  assert.deepEqual(reviewGoal.cards.map((c) => c.key), ['q']);
  const targetCard = { ...card, key: 'qt', about: ['target'] };
  const readyGoal = await m.keepStoryGoal(lib, [targetCard], goalLearner, 'target');
  assert.equal(readyGoal.kind, 'topic');
  assert.equal(readyGoal.id, 'target', 'a ready destination starts immediately');
  const goalWithoutMap = await m.keepStoryGoal(lib, [targetCard], goalLearner, 'target');
  assert.equal(goalWithoutMap.id, 'target', 'a goal does not require an authored landscape view');
  reviewing.progress.suspended = new Set(['q']);
  assert.equal(m.storyRoute(reviewLib, [card], reviewing, 'target').at(-1).lock.weak.length, 0, 'suspended cards are not offered for review');
  assert.equal(await m.keepStoryGoal(reviewLib, [card], { ...reviewing, keepPosition: async () => { throw Error('must not save an empty route'); } }, 'target'), null, 'an unavailable route cannot start a suspended card');

  const work = { id: 'book', key: 'bosco', kind: 'work', libraryId: 'books', data: { title: 'Don Bosco. Una biografia nuova', workType: 'book' } };
  const part = { id: 'part', kind: 'sourcepart', data: { blocks: [{ type: 'page', page: 'PDF138' }, { type: 'paragraph', text: 'First page.' }, { type: 'page', page: 'PDF139' }, { type: 'paragraph', text: 'Second page.' }] } };
  const manifest = { id: 'text', kind: 'sourcetext', libraryId: 'books', data: { work: 'book', scheme: 'pages', edition: {}, parts: [{ id: 'part', key: 'one', label: 'One', order: 1, pages: [m.parsePlace('s. PDF138', 'pages').pages[0].from, m.parsePlace('s. PDF139', 'pages').pages[0].from], blocks: 4, words: 4 }] } };
  const store = (libraryId, entries, heavy = []) => ({ libraryId, areaId: libraryId, revision: 1, all: () => entries, own: (id) => entries.find((x) => x.id === id),
    get: (id) => entries.find((x) => x.id === id), ownByKey: (key) => entries.find((x) => x.key === key), byKey: (key) => entries.find((x) => x.key === key),
    ownTexts: (id) => entries.filter((x) => x.kind === 'sourcetext' && x.data.work === id), ownsHeavy: (id) => heavy.some((x) => x.id === id), heavy: async (id) => heavy.find((x) => x.id === id) ?? null });
  const base = new m.CogitaLibrary(store('course', []), false);
  const source = store('books', [work, manifest], [part]);
  base.setSources([{ kind: 'books', name: 'Books', store: source }]);
  const look = base.markupLook;
  assert.equal(look.texts('book')[0].id, 'text', 'a Cogita citation sees its authorized source text without relying on a workspace tab');
  assert.equal((await look.heavy('part')).id, 'part', 'the passage loads from the store that owns it');
  const link = m.placeFor(look, 'book', 's. PDF138–PDF139');
  assert.equal(link.status, 'found', 'the exact PDF range from the report resolves');
  assert.deepEqual(m.findBlocks(part.data.blocks, m.parsePlace(link.locator, 'pages'), 'pages', {}), [1, 3], 'the reader selects both cited PDF pages');
  assert.ok(m.readerPath(link).includes('/books/book/tekst/s.%20PDF138%E2%80%93PDF139'), 'reader route preserves owner, work and page range');
  const render = () => m.renderToStaticMarkup(m.createElement(m.Markup, { lib: base, text: 'One [@bosco, s. PDF138–PDF139]. Two [@bosco, s. PDF139].' }));
  const publicHtml = render();
  assert.equal((publicHtml.match(/pokaż w tekście/g) ?? []).length, 2, 'public citations offer the readable passage');
  assert.ok(!publicHtml.includes('#/workspace'), 'public reading does not force a workspace route');
  globalThis.window = { location: { hash: '#/workspace/library/course/cogita/przebiegi/story/graj' } };
  const workspaceHtml = render();
  assert.equal((workspaceHtml.match(/href="#\/workspace\/library\/books\/book"/g) ?? []).length, 2, 'each citation, including Tamże, links to its source library');
  base.setSources([{ kind: 'books', name: 'Books', store: store('books', [work]) }]);
  const noTextHtml = render();
  assert.ok(noTextHtml.includes('Otwórz źródło') && !noTextHtml.includes('pokaż w tekście'), 'bibliographic sources remain reachable without a transcript');
  base.setSources([]);
  assert.equal(base.markupLook.texts('book').length, 0);
  assert.equal(await base.markupLook.heavy('part'), null, 'removed source cannot expose a cached passage');
  assert.ok(!render().includes('Otwórz źródło'), 'unreadable references do not expose source links');
  delete globalThis.window;
  console.log('Locked-route, goal-start and citation-route regression checks pass.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
