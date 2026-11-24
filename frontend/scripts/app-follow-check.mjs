/**
 * 2026-11-24 (Tryb prowadzony) — DIE KLASSE FOLGT DER LEHRERIN (`src/app/cogita/follow/followModel.ts`), ohne Browser:
 *   1. was die Schüler sehen, aus den Ereignissen: der jüngste Inhalt gewinnt (Karte ↔ Folie ↔ Frage), das Ende einer Erzählung → Karte;
 *   2. angeheftet: zeigt die Lehrerin etwas Eigenes (QR), kommt nichts — es bleibt das zuletzt Geschickte;
 *   3. angehalten: nichts geht hinaus, „Pokaż uczniom" schickt trotzdem; nur Änderungen gehen hinaus;
 *   4. zu → nichts mehr; eine Stunde ohne `follow` ist keine Folge-Stunde;
 *   5. die Kamera als Ausschnitt: jedes Gerät sieht denselben Boden; die Frage wird eine Abstimmung (LessonPlay liest sie).
 *
 *   node scripts/app-follow-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const workspace = await mkdtemp(join(tmpdir(), 'app-follow-'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(join(workspace, 'entry.ts'), `
export * from '${app}cogita/follow/followModel';
export { lessonNow } from '${app}cogita/lesson/LessonHost';
`);
await build({
  entryPoints: [join(workspace, 'entry.ts')], bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', jsx: 'automatic',
  plugins: [{ name: 'no-css', setup(b) { b.onResolve({ filter: /\.css$/ }, (a) => ({ path: a.path, namespace: 'no-css' })); b.onLoad({ filter: /.*/, namespace: 'no-css' }, () => ({ contents: '', loader: 'js' })); } }],
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const m = await import(pathToFileURL(join(workspace, 'entry.js')).href);

let passed = 0;
let failed = 0;
const check = (name, fn) => { try { fn(); passed += 1; console.log(`ok   ${name}`); } catch (e) { failed += 1; console.log(`FAIL ${name}: ${e.message}`); } };

let seq = 0;
const ev = (kind, body) => ({ event: { kind, seq: ++seq, sessionId: 's', eventId: `e${seq}`, epoch: 1, sealed: null, plain: null, createdAt: '', authorRoleId: null, authorPersonId: null, authorSeatId: null }, body });
const config = ev('config', { title: 'Klasa 1a', follow: true, classArea: 'A', library: 'L' });
const cam = { cx: 10, cy: 20, rot: -20, fore: 0.7, spanW: 400, spanH: 300 };
const map1 = ev('follow-map', { view: 'V', cam, chosen: { kind: 'place', id: 'P1' }, mode: 'all', slice: [], at: 1 });
const slide = ev('step', { at: 2, flow: 'F', step: 's1', kind: 'show', title: 'Gniew', entity: { id: 'E', kinds: [], data: {} } });
const qStep = ev('step', { at: 3, flow: 'F', step: 'q1', kind: 'question', title: null, entity: null });
const card = { key: 'k', question: 'Q', prompt: [{ text: 'Kto?' }], answer: { form: 'one', options: ['A', 'B'], correct: 0 } };
const question = ev('question', { index: 7, total: 0, card, startedAt: 3, deadline: null, round: 1, step: 'q1', lesson: true });
const back = ev('follow-show', { kind: 'map', at: 4 });
const map2 = ev('follow-map', { view: 'V', cam: { ...cam, cx: 99 }, chosen: null, mode: 'due', slice: ['T1'], at: 5 });

try {
  check('1. start: only the config — nothing to show yet; the first map → the map', () => {
    assert.equal(m.followNow([config]).content, 'none');
    assert.equal(m.followNow([config, map1]).content, 'map');
    assert.equal(m.followNow([config, map1]).map.chosen.id, 'P1');
  });
  check('1. a slide after the map → the slide; a question after it → the question (a vote LessonPlay reads)', () => {
    assert.equal(m.followNow([config, map1, slide]).content, 'slide');
    const now = [config, map1, slide, qStep, question];
    assert.equal(m.followNow(now).content, 'question');
    const lesson = m.lessonNow(now);
    assert.equal(lesson.vote.kind, 'question');
    assert.equal(lesson.vote.q.index, 7);
  });
  check('1. back to the map (follow-show) wins over the older step; a newer camera moves the map, the last state counts', () => {
    const now = [config, map1, slide, qStep, question, back, map2];
    const f = m.followNow(now);
    assert.equal(f.content, 'map');
    assert.equal(f.map.cam.cx, 99);
    assert.deepEqual([f.map.mode, f.map.slice, f.map.chosen], ['due', ['T1'], null]);
  });
  check('1. the end of a story → the map', () => {
    const end = ev('step', { at: 6, flow: 'F', step: '', kind: 'end', title: null, entity: null });
    assert.equal(m.followNow([config, map1, slide, end]).content, 'map');
  });
  check('2. pinned: the teacher opens the QR code (nothing is sent) — the students keep the slide', () => {
    const now = [config, map1, slide];
    assert.equal(m.followNow(now).content, 'slide');
    assert.equal(m.followNow([...now]).content, 'slide');
  });
  check('3. paused: nothing goes out; „Pokaż uczniom" (force) sends; unchanged state is not sent again', () => {
    const cur = m.readMapState({ view: 'V', cam, chosen: null, mode: 'all', slice: [], at: 1 });
    assert.equal(m.mapToSend({ frozen: true, currentMap: cur, sentMap: null }), null);
    assert.equal(m.mapToSend({ frozen: true, currentMap: cur, sentMap: null }, true), cur);
    assert.equal(m.mapToSend({ frozen: false, currentMap: cur, sentMap: cur }), null);
    const moved = { ...cur, cam: { ...cam, cx: cam.cx + 50 } };
    assert.equal(m.mapToSend({ frozen: false, currentMap: moved, sentMap: cur }), moved);
    const jitter = { ...cur, cam: { ...cam, cx: cam.cx + 0.1 } };
    assert.equal(m.mapToSend({ frozen: false, currentMap: jitter, sentMap: cur }), null, 'a tiny move is the same picture');
  });
  check('4. closed → nothing; a lesson without follow is no guided session', () => {
    assert.equal(m.followNow([config, map1, slide], true).content, 'none');
    const plain = ev('config', { title: 'Lekcja', parts: [] });
    assert.equal(m.followNow([plain, map1]).config, null);
    assert.equal(m.followNow([plain, map1]).content, 'none');
    assert.equal(m.isFollowConfig({ follow: true }), true);
    assert.equal(m.isFollowConfig({ follow: 'yes' }), false);
  });
  check('5. the camera as a ground window: a phone and a projector see the same ground (fit inside)', () => {
    assert.equal(m.zoomFor(cam, 800, 600), 2);
    assert.equal(m.zoomFor(cam, 400, 600), 1);
    assert.equal(m.readCam({ ...cam, spanW: 0 }), null);
    assert.equal(m.readCam({ cx: 'x' }), null);
    assert.deepEqual(m.readCam(cam), cam);
  });
  check('5. a broken map event is ignored (the last good one stays)', () => {
    const bad = ev('follow-map', { cam });
    assert.equal(m.followNow([config, map1, bad]).map.chosen.id, 'P1');
  });
} finally {
  await rm(workspace, { recursive: true, force: true });
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
