/**
 * 2026-11-05 (Prompt 23, B) — ABSTECHER ALS ZWEIGE DER ŚCIEŻKA (`cogita/pathLayout.ts` `withBranches`, `cogita/pathBranches.ts`):
 *
 *   1. Die Linie bleibt gerade: Abstecher stehen nicht auf ihr; davor → danach direkt verbunden.
 *   2. Ein Zweig steht neben seinem Anker, halb zur nächsten Stufe; Arme hinaus und zurück (Kanten Anker → Zweig → danach).
 *   3. Die Seiten wechseln von Anker zu Anker; zwei nach demselben Knoten fächern sich auf (beide Seiten, dann weiter aussen).
 *   4. Kennungen und Reihenfolge bleiben (die Teile zeigen weiter auf ihre Knoten); ohne Abstecher ändert sich nichts.
 *   5. „po slajdzie N" aus den Slajdy der Linie bis zum Anker.
 *
 *   node scripts/app-branches-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-branches-'));
await build({
  entryPoints: { path: 'src/app/cogita/pathLayout.ts', br: 'src/app/cogita/pathBranches.ts', lang: 'src/app/cogita/lang.ts' },
  bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const [P, B, L] = await Promise.all(['path', 'br', 'lang'].map(load));
await rm(workspace, { recursive: true, force: true });

let failed = 0;
let passed = 0;
const check = (name, ok, detail = '') => { if (ok) { passed += 1; return; } failed += 1; console.error(`FAIL ${name}${detail === '' ? '' : ` — ${JSON.stringify(detail)}`}`); };

/* Etap 1: start, s1, d1, s2, d2a, d2b, s3, d3, s4, d4, s5, d5, s6, end — eine Kette. */
const ids = ['start', 's1', 'd1', 's2', 'd2a', 'd2b', 's3', 'd3', 's4', 'd4', 's5', 'd5', 's6', 'end'];
const kind = (id) => (id === 'start' ? 'start' : id === 'end' ? 'end' : id.startsWith('d') ? 'detour' : 'read');
const items = ids.map((id) => ({ id, label: id }));
const needs = ids.map((_, i) => (i === 0 ? [] : [i - 1]));
const info = ids.map((id) => ({ kind: kind(id), slides: (/^s[0-9]/).test(id) ? 1 : 0 }));
const m = P.pathModel(items, needs, { source: 'story', reduced: true, info });
const at = (id) => m.nodes[m.index.get(id)];
const line = m.nodes.filter((n) => n.branch === undefined);
const br = m.nodes.filter((n) => n.branch !== undefined);
check('1: six branches', br.length === 6, br.length);
check('1: the line is straight (one column)', new Set(line.map((n) => n.x)).size === 1, line.map((n) => n.x));
check('1: the line goes one level per node', line.every((n, i) => n.level === i), line.map((n) => n.level));
check('1: s1 → s2 directly on the line', m.edges.some(([a, b]) => m.nodes[a].id === 's1' && m.nodes[b].id === 's2'));
check('2: a branch stands beside its anchor, half a level up', at('d1').branch.anchor === m.index.get('s1') && at('d1').level === at('s1').level + 0.5 && Math.abs(at('d1').x - at('s1').x) > 1);
check('2: arms out and back', m.edges.some(([a, b]) => m.nodes[a].id === 's1' && m.nodes[b].id === 'd1') && m.edges.some(([a, b]) => m.nodes[a].id === 'd1' && m.nodes[b].id === 's2'));
check('2: rejoin is the next slide', m.nodes[at('d1').branch.rejoin].id === 's2');
check('3: two after one slide fan out to both sides', at('d2a').branch.anchor === at('d2b').branch.anchor && at('d2a').branch.side !== at('d2b').branch.side, [at('d2a').branch, at('d2b').branch]);
check('3: sides alternate from anchor to anchor', at('d1').branch.side !== at('d2a').branch.side && at('d3').branch.side !== at('d4').branch.side, ['d1', 'd2a', 'd3', 'd4', 'd5'].map((x) => at(x).branch.side));
check('3: the extent covers every branch and its name', br.every((n) => n.x - 0.5 >= m.x0 - 1e-9 && n.x + 0.5 <= m.x1 + 1e-9));
check('4: ids and order kept', m.nodes.map((n) => n.id).join() === ids.join());
const plain = P.pathModel(items.filter((x) => !x.id.startsWith('d')), items.filter((x) => !x.id.startsWith('d')).map((_, i) => (i === 0 ? [] : [i - 1])), { source: 'story', reduced: true, info: info.filter((x) => x.kind !== 'detour') });
check('4: without detours nothing changes', plain.nodes.every((n) => n.branch === undefined) && new Set(plain.nodes.map((n) => n.x)).size === 1);
check('4: branches: false keeps them on the line', P.pathModel(items, needs, { source: 'story', reduced: true, info, branches: false }).nodes.every((n) => n.branch === undefined));
/* 5. „po slajdzie N". */
const W = L.words('pl');
const sp = { parts: ids.map((id) => ({ kind: kind(id), slides: (/^s[0-9]/).test(id) ? 1 : 0 })), model: m };
check('5: after slide 1', B.whereOf(sp, m.index.get('s1'), W) === 'po slajdzie 1', B.whereOf(sp, m.index.get('s1'), W));
check('5: after slide 2 (both of the fan)', B.whereOf(sp, at('d2b').branch.anchor, W) === 'po slajdzie 2');
check('5: German', B.whereOf(sp, m.index.get('s3'), L.words('de')) === 'nach Folie 3');
/* A fork with a detour on one road: still straight per road, the branch beside its anchor. */
const f = P.pathModel(['a', 'f', 'x', 'dx', 'y', 'z'].map((id) => ({ id, label: id })), [[], [0], [1], [2], [1], [3, 4]], { source: 'story', reduced: true, info: [{ kind: 'start' }, { kind: 'fork' }, { kind: 'read' }, { kind: 'detour' }, { kind: 'read' }, { kind: 'end' }] });
check('fork: the detour is a branch of its road', f.nodes[3].branch?.anchor === 2 && f.nodes[3].branch?.rejoin === 5, f.nodes[3]);

if (failed > 0) { console.error(`app-branches-check: ${failed} failed, ${passed} passed`); process.exit(1); }
console.log(`app-branches-check: ${passed} checks passed`);
