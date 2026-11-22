/**
 * 2026-11-22 (Eigentümer: „eine Welt ist kein Text") — DIE DIMENSIONEN EINER WELT (`src/app/cogita/worldDimensions.ts`, die
 * Befunde `world.*` in `worldChecks.ts`), ohne Browser:
 *   1. eine Welt wie ein Text (sieben Szenen in einer Linie): world.linear, world.oneLevel, world.noThreads;
 *   2. dieselben Szenen mehrdimensional (ein Überblick mit drei Szenen darunter, ein Tag für eine Figur über weit auseinander
 *      liegende Szenen, ein Turm, der zwei Szenen vergleicht, ein Weg zu einer Frage durch drei Szenen): keiner der drei;
 *   3. world.dimensions zählt, was da ist; der Leitfaden guide-good-world erklärt es (1.2a) und nennt die Codes.
 *
 *   node scripts/app-world-dimensions-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const workspace = await mkdtemp(join(tmpdir(), 'app-world-dims-'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(join(workspace, 'entry.ts'), `
export { memoryBase } from '${app}cogita/memoryBase';
export { worldChecks } from '${app}cogita/worldChecks';
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
const check = (name, got, want) => {
  try { assert.deepEqual(got, want); passed += 1; console.log(`ok   ${name}`); } catch { failed += 1; console.log(`FAIL ${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); }
};

const kinds = [
  { ref: '@d/tag', name: 'Tag', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }] },
  { ref: '@d/scena', name: 'Scena', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'wymaga', label: 'Wymaga', type: 'ref', to: ['@d/scena'], multi: true, prerequisite: 'up' }, { key: 'tagi', label: 'Tagi', type: 'ref', to: ['@d/tag'], multi: true, tag: 'up' }] }
];
const scenes = ['klotnia', 'atena', 'wycofanie', 'patroklos', 'poscig', 'pojedynek', 'priam'];
const q = (scene) => ({ ref: `@d/q/${scene}`, kinds: ['question'], data: { form: 'one', prompt: `${scene}?`, options: ['A', 'B'], correct: [0], about: [`@d/s/${scene}`] } });
const view = [{ ref: '@d/mapa', name: 'Mapa', mode: 'landscape', steps: [{ type: 'source.kind', config: { kind: '@d/scena' } }], landscape: { style: 'world' } }];

/* 1. Wie ein Text: jede Szene verlangt genau die vorige. */
const textLike = {
  format: 'recreatio.cogita.course', version: 1, name: 'Iliada liniowo', kinds,
  entities: [...scenes.map((s, i) => ({ ref: `@d/s/${s}`, kinds: ['@d/scena'], data: { nazwa: s, ...(i === 0 ? {} : { wymaga: [`@d/s/${scenes[i - 1]}`] }) } })), ...scenes.map(q)],
  views: view
};

/*
  2. Mehrdimensional über DIESELBEN Szenen: ein Überblick („Iliada w zarysie"), auf dem drei Szenen aufbauen (Tiefe); Achilles als Tag
  über weit auseinander liegende Szenen (Faden: eine Figur); „Gniew i litość" verbindet die Kłótnia und Priam (Faden: ein Thema).
*/
const many = {
  format: 'recreatio.cogita.course', version: 1, name: 'Iliada wielowymiarowo', kinds,
  entities: [
    { ref: '@d/tag/achilles', kinds: ['@d/tag'], data: { nazwa: 'Achilles' } },
    { ref: '@d/s/zarys', kinds: ['@d/scena'], data: { nazwa: 'Iliada w zarysie' } },
    ...scenes.map((s, i) => ({ ref: `@d/s/${s}`, kinds: ['@d/scena'], data: {
      nazwa: s,
      wymaga: i === 0 || i === 3 || i === 5 ? ['@d/s/zarys'] : [`@d/s/${scenes[i - 1]}`],
      ...(s === 'klotnia' || s === 'priam' ? { tagi: ['@d/tag/achilles'] } : {})
    } })),
    { ref: '@d/s/gniew', kinds: ['@d/scena'], data: { nazwa: 'Gniew i litość', wymaga: ['@d/s/klotnia', '@d/s/priam'] } },
    ...scenes.map(q), q('zarys'), q('gniew')
  ],
  views: view
};

const run = async (doc, more) => {
  const made = await m.memoryBase(doc, { libraryId: `dims-${doc.name.length}`, areaId: 'dims-a' });
  assert.ok(!('error' in made), made.error);
  if (more !== undefined) await more(made.writer);
  const { cards } = await made.writer.cards();
  return m.worldChecks(made.writer, { cards });
};
const codes = (report) => report.findings.map((f) => f.code).filter((c) => c.startsWith('world.'));

try {
  const flat = await run(textLike);
  check('text-like: linear, one level, no threads, and the summary', codes(flat).sort(), ['world.dimensions', 'world.linear', 'world.noThreads', 'world.oneLevel']);
  check('text-like: the three are "should", the summary "info"', flat.findings.filter((f) => f.code.startsWith('world.')).map((f) => `${f.code}:${f.weight}`).sort(),
    ['world.dimensions:info', 'world.linear:should', 'world.noThreads:should', 'world.oneLevel:should']);
  check('text-like: the message counts the towers in the line', /7 of 7 towers/.test(flat.findings.find((f) => f.code === 'world.linear').message), true);

  const rich = await run(many, async (lib) => {
    const id = (ref) => lib.byImportRef(ref, 'entity').id;
    await lib.saveDoc('qpath', { title: 'Jak zmienia się Achilles?', steps: [{ place: id('d/s/klotnia') }, { place: id('d/s/pojedynek') }, { place: id('d/s/priam') }] });
  });
  check('many-dimensional: none of linear / oneLevel / noThreads', codes(rich), ['world.dimensions']);
  const summary = rich.findings.find((f) => f.code === 'world.dimensions').message;
  check('summary: levels 2 with one overview; threads: 1 question path, 1 tag across parts, 1 joining tower', [
    /levels of detail 2/.test(summary), /overviews 1/.test(summary), /question paths 1/.test(summary), /tags across parts 1/.test(summary), /joining towers 1/.test(summary)
  ], [true, true, true, true, true]);

  /* Eine kleine Welt (unter sechs Türmen) wird nicht beurteilt. */
  const small = await run({ ...textLike, name: 'krótko', entities: [...textLike.entities.slice(0, 3), ...scenes.slice(0, 3).map(q)] });
  check('fewer than 6 towers: no world.* finding', codes(small), []);

  /* Der Leitfaden erklärt es und nennt die Codes; die Kontrolle im Dienst sagt die Codes. */
  const guide = await readFile('../templates/cogita/dobry-swiat-AI.md', 'utf8');
  check('guide-good-world: section 1.2a, the three ways (levels, a main character, a topic) and the codes', [
    /## 1\.2a A world is many-dimensional, not a text/.test(guide), /main character/.test(guide), /topic/.test(guide), /levels of detail/.test(guide),
    ['world.linear', 'world.oneLevel', 'world.noThreads', 'world.dimensions'].every((c) => guide.includes(c))
  ], [true, true, true, true, true]);
  const mcp = await readFile('../backend/Api/Library/AiMcp.WorldChecks.cs', 'utf8');
  check('MCP get_world_checks names the world.* codes', ['world.* (linear', 'oneLevel', 'noThreads'].every((c) => mcp.includes(c)), true);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
