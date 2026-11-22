/**
 * 2026-11-22 (0145) — DIE TEXTE EINER AI-ABSCHRIFT JE TEXT (`src/app/aiAccess/aiSnapshot.ts`, Format 2), ohne Browser:
 *   1. Verzeichnis und Inhalt getrennt: das Verzeichnis trägt keinen Block; die Stücke zusammen sind GENAU die Blöcke von Format 1;
 *   2. Stücke an Blockgrenzen, höchstens CHUNK_JSON Zeichen, `from` stimmt; der Hash ist der SHA-256 des JSON (wie der Dienst prüft);
 *   3. inkrementell: ein geänderter Text ändert nur seine Hashes, ein unveränderter behält sie, ein gelöschter fällt aus der Liste;
 *   4. der Besitzer schaltet einen Text aus (`ai: false`): im Verzeichnis `excluded`, ohne Stücke; ein neuer Import behält den Schalter;
 *   5. ein Stück, das zu gross ist oder nicht ankam: nur sein Text bekommt den Stand;
 *   6. die Abschrift selbst: Format 2, das Verzeichnis darin, klein.
 *
 *   node scripts/app-ai-texts-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const workspace = await mkdtemp(join(tmpdir(), 'app-ai-texts-'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(join(workspace, 'entry.ts'), `
export { snapshotDoc, snapshotTexts, snapshotTextObjects, withTextStates, chunkBlocks, SNAPSHOT_VERSION, CHUNK_JSON, MAX_TEXT_OBJECT } from '${app}aiAccess/aiSnapshot';
export * as S from '${app}library/sourceText';
`);
await build({
  entryPoints: [join(workspace, 'entry.ts')], bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', jsx: 'automatic',
  plugins: [{ name: 'no-css', setup(b) { b.onResolve({ filter: /\.css$/ }, (a) => ({ path: a.path, namespace: 'no-css' })); b.onLoad({ filter: /.*/, namespace: 'no-css' }, () => ({ contents: '', loader: 'js' })); } }],
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const m = await import(pathToFileURL(join(workspace, 'entry.js')).href);
const { S } = m;

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok   ${name}`); } catch (e) { failed += 1; console.log(`FAIL ${name}: ${e.message}`); }
};

/* Ein paar Texte wie in der Bibliothek: ein Werk, sein Verzeichnis (sourcetext), seine Teile (sourcepart). */
const work = (id, key, title, workType = 'book') => ({ id, kind: 'work', key, data: { workType, title } });
const W1 = work('00000000-0000-4000-8000-0000000000a1', 'bt', 'Biblia Tysiąclecia', 'bible');
const W2 = work('00000000-0000-4000-8000-0000000000a2', 'ratzinger2007', 'Jezus z Nazaretu');
const W3 = work('00000000-0000-4000-8000-0000000000a3', 'ratzinger2007', 'Summa theologiae');
const textOf = (id, w, example, extra = {}) => {
  const plan = S.planSourceImport(example, { work: w });
  const entry = { id, kind: 'sourcetext', data: { ...S.nextManifest(undefined, w.id, plan, `${id}-p`), ...extra } };
  return { entry, parts: [{ id: `${id}-p`, data: S.partData(id, w.id, plan) }] };
};
const bible = textOf('tx-bible', W1, S.SOURCE_EXAMPLES.bible);
const pages = textOf('tx-pages', W2, S.SOURCE_EXAMPLES.pages);
const scopeOf = (texts) => [{ store: { libraryId: 'LT', all: () => [W1, W2, W3, ...texts.map((x) => x.entry)] }, kind: 'books', name: 'Biblioteka', texts }];
const sha = (s) => createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
const chunkBlocksOf = (objects, text) => text.parts.map((p) => p.chunks.flatMap((c) => JSON.parse(objects.chunks.get(c.hash)).blocks));

try {
  const scope = scopeOf([bible, pages]);
  const old = m.snapshotTexts(scope[0].texts, { get: (id) => [W1, W2].find((w) => w.id === id), byKey: () => undefined, readable: () => [W1, W2] });
  const objects = await m.snapshotTextObjects(scope, 'LT');

  check('1. the index carries no block: parts give counts and chunk addresses only', () => {
    for (const t of objects.texts) for (const p of t.parts) { assert.equal(typeof p.blocks, 'number'); assert.ok(Array.isArray(p.chunks) && p.chunks.length >= 1); }
    assert.ok(!JSON.stringify(objects.texts).includes('"text":'), 'no block text in the index');
  });
  check('1. the chunks together are exactly the blocks of format 1 (old and new read the same)', () => {
    objects.texts.forEach((t, i) => assert.deepEqual(chunkBlocksOf(objects, t), old[i].parts.map((p) => p.blocks)));
  });
  check('1. the index keeps work, title, key, scheme, places, pages; words and bytes counted', () => {
    const [b, p] = objects.texts;
    assert.deepEqual([b.work, b.workTitle, b.workKey, b.scheme, b.state, b.parts[0].key], [W1.id, 'Biblia Tysiąclecia', 'bt', 'bible', 'readable', 'J']);
    assert.ok(b.words > 0 && b.bytes > 0 && b.limit === m.MAX_TEXT_OBJECT && p.parts[0].first !== undefined);
  });
  check('2. a hash is the SHA-256 of the chunk JSON (what the service verifies after opening)', () => {
    for (const [h, json] of objects.chunks) assert.equal(h, sha(json));
  });
  check('2. a long part is cut at block boundaries, each chunk at most CHUNK_JSON characters, from = its first block', () => {
    const blocks = Array.from({ length: 50 }, (_, i) => ({ type: 'paragraph', at: `nr ${i + 1}`, text: 'x'.repeat(1000) }));
    const cut = m.chunkBlocks(blocks, 5000);
    assert.ok(cut.length > 5);
    assert.deepEqual(cut.flatMap((c) => c.blocks), blocks);
    let at = 0; for (const c of cut) { assert.equal(c.from, at); at += c.blocks.length; assert.ok(JSON.stringify({ blocks: c.blocks }).length <= 5000 + 20); }
    assert.equal(m.chunkBlocks([{ type: 'paragraph', text: 'y'.repeat(9000) }], 5000).length, 1, 'a single larger block stays alone');
  });

  /* 3. Inkrementell. */
  const changedPages = textOf('tx-pages', W2, { ...S.SOURCE_EXAMPLES.pages, portions: S.SOURCE_EXAMPLES.pages.portions?.map((p, i) => (i === 0 ? { ...p, blocks: [...p.blocks, { type: 'paragraph', text: 'Nowy akapit.' }] } : p)) ?? S.SOURCE_EXAMPLES.pages.portions, blocks: S.SOURCE_EXAMPLES.pages.blocks === undefined ? undefined : [...S.SOURCE_EXAMPLES.pages.blocks, { type: 'paragraph', text: 'Nowy akapit.' }] });
  const after = await m.snapshotTextObjects(scopeOf([bible, changedPages]), 'LT');
  const hashesOf = (o, id) => o.texts.find((t) => t.id === id).parts.flatMap((p) => p.chunks.map((c) => c.hash));
  check('3. an unchanged text keeps its hashes — nothing of it is uploaded again', () => assert.deepEqual(hashesOf(after, 'tx-bible'), hashesOf(objects, 'tx-bible')));
  check('3. a changed text gets new hashes — only they are uploaded', () => {
    const fresh = [...after.chunks.keys()].filter((h) => !objects.chunks.has(h));
    assert.ok(fresh.length >= 1);
    assert.ok(fresh.every((h) => hashesOf(after, 'tx-pages').includes(h)), 'every new hash belongs to the changed text');
  });
  const withoutBible = await m.snapshotTextObjects(scopeOf([pages]), 'LT');
  check('3. a deleted text: its hashes are no longer named (the keep list drops them)', () => {
    assert.ok(hashesOf(objects, 'tx-bible').every((h) => !withoutBible.chunks.has(h)));
    assert.ok(hashesOf(objects, 'tx-pages').every((h) => withoutBible.chunks.has(h)));
  });

  /* 4. Der Schalter des Besitzers. */
  const off = textOf('tx-summa', W3, S.SOURCE_EXAMPLES.pages, { ai: false });
  const withOff = await m.snapshotTextObjects(scopeOf([bible, off]), 'LT');
  check('4. a text switched off for AI: listed as excluded, no chunks, the others untouched', () => {
    const t = withOff.texts.find((x) => x.id === 'tx-summa');
    assert.equal(t.state, 'excluded');
    assert.ok(t.parts.every((p) => p.chunks.length === 0));
    assert.deepEqual(hashesOf(withOff, 'tx-bible'), hashesOf(objects, 'tx-bible'));
  });
  check('4. importing another portion keeps the switch (nextManifest)', () => {
    const plan = S.planSourceImport(S.SOURCE_EXAMPLES.pages, { work: W3 });
    assert.equal(S.nextManifest(S.readManifest(off.entry.data), W3.id, plan, 'tx-summa-p2').ai, false);
    assert.equal(S.nextManifest(S.readManifest(pages.entry.data), W2.id, plan, 'x').ai, undefined);
  });

  /* 5. Stand nach dem Hinaufladen. */
  check('5. a chunk too large or not arrived: only its text gets the state', () => {
    const one = hashesOf(objects, 'tx-pages')[0];
    const states = m.withTextStates(objects.texts, new Map([[one, 'not_uploaded']]));
    assert.deepEqual(states.map((t) => t.state), ['readable', 'not_uploaded']);
    assert.deepEqual(m.withTextStates(objects.texts, new Map([[one, 'too_large']])).map((t) => t.state), ['readable', 'too_large']);
  });

  /* 6. Die Abschrift. */
  check('6. the snapshot: format 2, the index in it, no block content; without an index format-1 texts as before', () => {
    const doc = m.snapshotDoc(scope, 'LT', 'now', true, undefined, objects.texts);
    assert.equal(doc.v, 2);
    assert.equal(m.SNAPSHOT_VERSION, 2);
    assert.deepEqual(doc.texts, objects.texts);
    assert.ok(!JSON.stringify(doc).includes('"text":"'));
    const legacy = m.snapshotDoc(scope, 'LT', 'now');
    assert.ok(Array.isArray(legacy.texts[0].parts[0].blocks));
  });
} finally {
  await rm(workspace, { recursive: true, force: true });
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
