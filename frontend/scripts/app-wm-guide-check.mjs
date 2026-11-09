/**
 * 2026-11-09 — DIE WELTKARTE, TEIL 6: DER LEITFADEN UND WAS AI SIEHT (spec §9, §13; Entscheidungen 3, 13):
 * <code>
 *   Leitfaden   templates/cogita/weltkarte-AI.md (polnisch) sagt alle acht Punkte von §9, die Liste deckt die Liste für
 *               Autoren; opowiesci-AI.md verweist darauf, schematy-AI.md beschreibt "part"; über MCP als „guide-world-map"
 *   Ausfuhr     ein Widok `style: "world"` geht in „landscapes" als Weltkarte hinaus: [x, y] je Ort (die Lage, die jeder sieht,
 *               auch die abgelegte), das Haus, die Linien, die Umsteigeorte — und nicht mehr als Sechseck-Karte
 * </code>
 *
 *   node scripts/app-wm-guide-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const text = async (p) => (await readFile(p, 'utf8')).replace(/\r\n/g, '\n');

/* -- Der Leitfaden ------------------------------------------------------------------------------------------------------------ */
const guide = await text('../templates/cogita/weltkarte-AI.md');
check('guide: Polish, with the eight points of §9', [
  /jeden temat = jedno miejsce/i.test(guide) && /10–15 pytań/.test(guide),
  guide.includes('"part": "up"') && /nigdy[^.]*"prerequisite"/i.test(guide),
  guide.includes('"prerequisite": "up"') && /BEZPOŚREDNIO/.test(guide),
  /Jeden przebieg = jedna linia/.test(guide) && guide.includes('"about"'),
  /"choice", "chapters"/.test(guide) && /węzeł przesiadkowy/i.test(guide),
  /„Wymaga” jednostki/.test(guide) && guide.includes('"type": "knowness"') && /"condition"/.test(guide),
  /Karty bez slajdu/.test(guide),
  /Bez położeń, kolorów i wysokości/.test(guide),
  /## 10\. Lista kontrolna/.test(guide)
], [true, true, true, true, true, true, true, true, true]);
check('guide: how to turn it on and the levels setting', [guide.includes('"style": "world"'), guide.includes('"levelsSetup"'), guide.includes('Jak aplikacja używa tych danych')], [true, true, true]);
/* Die Liste deckt jede Art der Liste für Autoren (wmTypes ISSUE_CODES). */
const list = guide.slice(guide.indexOf('## 10.'));
const covers = {
  cycle: /bez kół/i, dangling: /donikąd/, partAndPrerequisite: /nigdy na polu z `"prerequisite"`/, partOfSeveral: /w jednym bloku/,
  flowNoPlaces: /bez rozpoznawalnych miejsc/, unknownCondition: /znanych typów/, unreachableSteps: /nieosiągalny/, flowStartsLate: /od swojego pierwszego slajdu/,
  membersNotDetoured: /zagłębienie/, requiresSiblingPrerequisite: /etapu sąsiedniego/, placesWithoutLine: /Miejsca bez linii/, cardsWithoutSlide: /karty bez slajdu/,
  lineStartsMid: null, noRoute: null, mislabelledRegion: /Obszary kolorów/, unitMissing: /"unit" przebiegu istnieje/
};
check('guide: the checklist mirrors the author list (layout-only cases excepted)', Object.entries(covers).filter(([, re]) => re !== null && !re.test(list)).map(([c]) => c), []);
const stories = await text('../templates/cogita/opowiesci-AI.md');
const schemes = await text('../templates/cogita/schematy-AI.md');
check('guide: linked from the stories guide', [stories.includes('guide-world-map'), stories.includes('weltkarte-AI.md')], [true, true]);
check('schemes guide: "part" documented where "prerequisite" is, never together', [schemes.includes('`"part": "up"`'), /Nigdy na tym samym polu co `"prerequisite"`/.test(schemes)], [true, true]);
const formats = JSON.parse(await readFile('../backend/Api/Library/ImportFormats.json', 'utf8'));
const entry = formats.formats.find((f) => f.id === 'guide-world-map');
/* Der Erzeuger teilt lange Texte an Überschriften (Leerzeilen können sich dabei ändern). */
const norm = (x) => x.replace(/\n{2,}/g, '\n\n').trim();
check('MCP: the guide is a format "guide-world-map" with the file as its text', [entry?.group, norm(entry?.parts.join('') ?? '') === norm(guide)], ['Przewodniki dla AI', true]);
const kb = formats.formats.find((f) => f.id === 'knowledge-base')?.parts.join('') ?? '';
check('MCP: the knowledge-base format knows "part" and "style": "world"', [kb.includes('"part" (odwołanie)'), kb.includes('"landscape": {"style": "world"}')], [true, true]);

/* -- Was AI sieht: die Weltkarte in „landscapes" -------------------------------------------------------------------------------- */
const workspace = await mkdtemp(join(tmpdir(), 'app-wm-guide-'));
execFileSync(process.execPath, ['scripts/wm-courses.mjs', workspace], { stdio: 'ignore' });
const course = JSON.parse(await readFile(join(workspace, 'fixture.json'), 'utf8'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
const entryFile = join(workspace, 'entry.ts');
await writeFile(entryFile, `
export { memoryBase } from '${app}cogita/memoryBase';
export { worldLayouts } from '${app}cogita/worldmap/wmExport';
export { landscapeLayouts } from '${app}cogita/landscapeExport';
export { setGeometryWorker } from '${app}cogita/worldmap/wmGeometryClient';
export { layoutDoc, storedLayout } from '${app}cogita/worldmap/wmStore';
`);
await build({ entryPoints: [entryFile], bundle: true, format: 'esm', platform: 'node', outdir: workspace, outExtension: { '.js': '.mjs' }, logLevel: 'error', loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) } });
globalThis.BroadcastChannel = undefined;
const M = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
M.setGeometryWorker(null);
const base = await M.memoryBase(course);
if ('error' in base) throw new Error(base.error);
const lib = base.lib;
const cards = (await lib.cards('wm')).cards;
const out = await M.worldLayouts(lib, cards);
check('export: one world view, as a world map', out.map((w) => [w.view, w.style]), [['@wmfx/view/world', 'world']]);
const w = out[0];
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
check('export: every place at [x, y] with its lasting name', [w.places.length, w.places.every((p) => finite(p[0]) && finite(p[1]) && /^@wmfx\//.test(p[2]))], [50, true]);
check('export: the parts of the block name it', w.places.filter((p) => p[3] !== null).map((p) => [p[2], p[3]]).sort(), [['@wmfx/s1859a', '@wmfx/s1859'], ['@wmfx/s1859b', '@wmfx/s1859'], ['@wmfx/s1859c', '@wmfx/s1859']]);
check('export: home, lines with stops, stations', [w.home !== null && finite(w.home[0]), w.lines.length, w.lines.find((l) => l.name === 'Z chłopcami z warsztatów')?.branches, w.stations.includes('@wmfx/domkos')], [true, 6, 3, true]);
const minGap = (() => { let m = Infinity; for (let i = 0; i < w.places.length; i += 1) for (let j = i + 1; j < w.places.length; j += 1) if (w.places[i][3] === null || w.places[i][3] !== w.places[j][3]) m = Math.min(m, Math.hypot(w.places[i][0] - w.places[j][0], w.places[i][1] - w.places[j][1])); return m; })();
check('export: places stand apart (no two pillars on one spot)', minGap >= 2 * 28, true);
const again = (await M.worldLayouts(lib, cards))[0];
check('export: the same every time', Object.keys(w).filter((k) => JSON.stringify(w[k]) !== JSON.stringify(again[k])), []);
check('export: the hex export leaves the world view out ([q, r] stays for hex views)', M.landscapeLayouts(lib, cards).some((l) => l.view === '@wmfx/view/world'), false);
/* Die abgelegte Lage gilt (Entscheidung 11): ein Schreibender hat die Karte verschoben → AI sieht dieselben Plätze. */
const byRef = new Map(lib.entities().map((e) => [`@${lib.entry(e.id)?.data?._ref ?? ''}`, e.id]));
const shifted = {};
for (const p of w.places) if (p[3] === null) { const id = byRef.get(p[2]); if (id !== undefined) shifted[id] = [p[0] + 1000, p[1]]; }
await lib.saveDoc('worldmap', M.layoutDoc({ nodes: shifted }));
check('export: a stored layout is used', M.storedLayout(lib) !== null, true);
const moved = (await M.worldLayouts(lib, cards))[0];
const free = moved.places.filter((p) => p[3] === null);
check('export: … every place where the stored layout puts it', free.every((p) => { const before = w.places.find((q) => q[2] === p[2]); return Math.abs(p[0] - (before[0] + 1000)) < 0.11 && Math.abs(p[1] - before[1]) < 0.11; }), true);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
