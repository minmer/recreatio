/**
 * 2026-11-22 — „GOOD KNOWLEDGE WORLDS" (Eigentümer, Teil 2: I1, I7, I8, I9), ohne Browser und ohne Dienst:
 *   I1  der Leitfaden `guide-good-world` (templates/cogita/dobry-swiat-AI.md) steht zuerst unter den Leitfäden für AI, die
 *       Anweisungen des MCP nennen ihn, die Leitfäden der Erzählungen, der Weltkarte und der Schemata verlinken ihn am Anfang,
 *       und was ihm widersprach, ist weg (10–15 Fragen als Norm, drei Stufen als Beispiel, „Dla dzieci / Jak w szkole …", "flash");
 *   I7  die empfohlenen Stufen (75 % beliebig, 90 % mit einer Korrektur, Pfade ab Stufe 1) für jede neue Baza; was „one"
 *       genau zählt; was eine Änderung (3 → 2, 0 → 2, 2 → 0) für die Lernenden heisst — in der Vorschau des Imports;
 *   I8  jede Zeichnung und jeder Zaun der Propozycje in guide-visuals §9 geht durch die Leser der App: nichts fällt weg,
 *       keine unbekannten Schlüssel oder Farben, kein Ausdruck ohne Sinn, ein Opis słowami = "alt";
 *   I9  ein Schritt "explore" mit nur "done", nur "next" oder beiden; Übergänge ohne "id" bleiben; Hinweis ≤ 100, Name ≤ 32.
 *
 *   node scripts/app-good-world-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-good-world-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export { memoryBase } from '${app}cogita/memoryBase';
export { planImport, importProblems, HINT_MAX, OPTION_LABEL_MAX } from '${app}cogita/json';
export { readFlow } from '${app}cogita/flow';
export { flowProblems } from '${app}cogita/flowCheck';
export { readLevelsSetup, RECOMMENDED_LEVELS, startRun, runAnswer, finishRun, levelOf, runScore } from '${app}cogita/worldmap/wmRuns';
export { levelsChange, levelsChangeWords, isRecommendedLevels, recommendedLevels } from '${app}cogita/worldmap/levelsChange';
export { newBaseSettings } from '${app}cogita/baseDefaults';
export { drawingOf } from '${app}pages/motion/drawing';
export { problemsOf } from '${app}pages/motion/liveLint';
export { colorValue } from '${app}pages/motion/motion';
export { readVisual } from '${app}library/visual';
export { t } from '${app}core/i18n';
`);
await build({
  entryPoints: { entry }, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error',
  loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const A = await import(pathToFileURL(join(workspace, 'entry.js')).href);

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const truth = (name, ok, detail) => check(name, ok === true ? true : { failed: true, detail }, true);
const text = async (path) => (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');

/* ==================================================================================================================
 * I1 — der Leitfaden über MCP
 * ================================================================================================================== */
{
  const { formats, PART_LIMIT } = await import(pathToFileURL(join(process.cwd(), 'scripts/import-formats.mjs')).href);
  const all = await formats();
  const guides = all.formats.filter((f) => f.group === 'Przewodniki dla AI');
  const good = all.formats.find((f) => f.id === 'guide-good-world');
  const file = await text('../templates/cogita/dobry-swiat-AI.md');
  check('I1: guide-good-world is the first guide for AI', guides[0]?.id, 'guide-good-world');
  const sections = ['1.0 How to use this guide', '1.1 What a good world does', '1.2 Building blocks', '1.3 Towers', '1.4 Questions', '1.5 Slides and text', '1.6 Paths and branching', '1.7 Self-study and lessons: one content, two orders', '1.8 Map, tags and world size', '1.9 Process', '1.10 Improving a world', '1.11 Working with subagents', '1.12 Integrity and communication', '1.13 Checklist', '1.14 What the current worlds show (22 November 2026)'];
  check('I1: the guide carries every section of Part 1 in order, served whole (parts joined = the file)', [sections.every((s) => file.includes(`## ${s}\n`)), sections.map((s) => file.indexOf(`## ${s}\n`)).every((at, i, list) => i === 0 || at > list[i - 1]), good.parts.join('\n\n').replace(/\s+/g, ' ').trim() === file.trimEnd().replace(/\s+/g, ' ').trim()], [true, true, true]);
  truth('I1: verbatim key sentences of Part 1 (towers, levels, explanation forms, prediction, import check)', [
    'About 4–8 minutes of learning. The number of questions depends on how long one question takes',
    'Level 2: at least 90 %, where each question may be wrong once and then right the next time (`"attempts": "one"`).',
    'Offer the choice of explanation **where a difficulty appears**, after a wrong answer: `wrong:<tag>` → a `choice` with `of` and `hint`, whose branches are help steps (`remedial: true`) that rejoin.',
    'Mark the step `"predict": true` (I3).',
    'Send the finished file through the MCP import check (I12).'
  ].every((s) => file.includes(s)));
  const first = (id) => all.formats.find((f) => f.id === id)?.parts[0] ?? '';
  check('I1: the stories, world map and schemes guides link it at their start', ['guide-stories', 'guide-world-map', 'guide-schemes'].map((id) => first(id).slice(0, 1500).includes('guide-good-world')), [true, true, true]);
  const instructions = await text('../backend/Api/Library/AiMcp.cs');
  truth('I1: the MCP instructions say to read guide-good-world before building or improving a world', instructions.includes('Before building or improving a knowledge world, read guide-good-world'));
  const world = all.formats.find((f) => f.id === 'guide-world-map');
  check('I1: the world map guide still comes in one part', [world.parts.length, world.parts[0].length <= PART_LIMIT], [1, true]);
  const stories = all.formats.find((f) => f.id === 'guide-stories').parts.join('\n');
  const schemes = all.formats.find((f) => f.id === 'guide-schemes').parts.join('\n');
  const book = await text('../templates/cogita/ksiazka-AI.md');
  check('I1: no contradiction left — no "10–15 questions" norm, the two-level example, no "Dla dzieci / Jak w szkole / Dla dorosłych" choice, no "flash" recommended, review optional, hint ≤ 100, label ≤ 32', [
    world.parts[0].includes('Jeden temat, 10–15 pytań'), world.parts[0].includes('"levels": 3'), world.parts[0].includes('"levels": 2'), world.parts[0].includes('Te same karty w innym opakowaniu'),
    stories.includes('"label": "Dla dzieci"'), stories.includes('ok. 120 znaków'), stories.includes('Przegląd na końcu (nieobowiązkowy)'),
    book.includes('albo `"flash"`'), schemes.includes('„Dziedzina” albo „Tag”')
  ], [false, false, true, false, false, false, true, false, false]);
  const kb = all.formats.find((f) => f.id === 'knowledge-base').parts.join('\n');
  truth('I1: the knowledge-base format names the recommended levels, the explore exit alias, optional edge ids and no "flash" in worlds', kb.includes('"pct": 90, "attempts": "one"') && kb.includes('"next" liczy się jako "done"') && kb.includes('"id" i "in" przejścia można pominąć') && kb.includes('nie używaj "flash"'));
  const visuals = all.formats.find((f) => f.id === 'guide-visuals');
  truth('I8: guide-visuals carries the drawings section with its suggestions', visuals.parts.join('\n').includes('## 9. Rysunki z kształtów') && visuals.title.includes('drawing'));
}

/* ==================================================================================================================
 * I7 — die empfohlenen Stufen
 * ================================================================================================================== */
const REC = A.readLevelsSetup(A.RECOMMENDED_LEVELS);
{
  check('I7: the recommendation reads as 2 levels — 75 % any, 90 % one — paths open at level 1, every card counts',
    [REC.levels, REC.rules.map((r) => [r.pct, r.attempts]), REC.openAt, REC.knownShare], [2, [[75, 'any'], [90, 'one']], 1, 1]);
  check('I7: a new base gets exactly this setting (and nothing else of the settings)', A.newBaseSettings(), { levelsSetup: { levels: 2, rules: [{ pct: 75, attempts: 'any' }, { pct: 90, attempts: 'one' }], knownShare: 1, openAt: 1 } });
  /* Ein Durchgang mit 10 Karten: 8 gleich richtig, 1 nach einer Korrektur, 1 erst beim dritten Mal. */
  let s = A.startRun('r1', 'tower', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], 1000);
  const answerAll = () => {
    for (let guard = 0; guard < 40 && s.queue.length > 0; guard += 1) {
      const card = s.queue[0];
      const asked = s.asked[card] ?? 0;
      const right = card === 'i' ? asked >= 1 : card === 'j' ? asked >= 2 : true;
      s = A.runAnswer(s, card, right ? 1 : 0);
    }
  };
  answerAll();
  const run = A.finishRun(s, 2000, ['me']);
  check('I7: "one" = right at the first attempt or after the one correction; "any" also later; "first" only the first',
    [run.firstTry, run.afterCorrection, run.laterRight, A.runScore(run, 'first'), A.runScore(run, 'one'), A.runScore(run, 'any')], [8, 1, 1, 0.8, 0.9, 1]);
  check('I7: that run conquers both recommended levels (90 % with one correction) — without "Mistrzowsko"', [A.levelOf([run], REC.rules, REC.levels).level, A.levelOf([run], REC.rules, REC.levels).perfect], [2, false]);
  const OLD = A.readLevelsSetup({ levels: 3, rules: [{ pct: 75, attempts: 'any' }, { pct: 85, attempts: 'one' }, { pct: 95, attempts: 'first' }], openAt: 2 });
  const c32 = A.levelsChange(OLD, REC);
  check('I7: 3 → 2 — new level 1 from old level 1, new level 2 (90 % one) only from old level 3; conquerors stay conquerors',
    [c32.keeps, c32.conquestKept, c32.toRuns, c32.toCards], [[1, 3], true, false, false]);
  const words = A.levelsChangeWords(c32, A.t);
  truth('I7: the words say it plainly (both settings, nothing earned is lost, Mistrzowsko stays, own levels)', words.line.includes('3 poziomy') && words.line.includes('2 poziomy') && words.line.includes('90 %') && words.learners.includes('Mistrzowsko') && words.learners.includes('Nowy poziom 2') && words.learners.includes('własne poziomy'), words);
  check('I7: 0 → 2 runs instead of known cards; 2 → 0 back to cards; the same setting — no change',
    [A.levelsChange(undefined, REC).toRuns, A.levelsChange(REC, undefined).toCards, A.levelsChange(REC, A.readLevelsSetup(A.RECOMMENDED_LEVELS)), A.isRecommendedLevels(REC), A.isRecommendedLevels(OLD)], [true, true, null, true, false]);
  /* Die Lernenden: ein Durchgang mit 85–89 % (eine Korrektur) hatte Stufe 2 von 3 und hat jetzt Stufe 1 von 2 — ein Durchgang mit 95 % beim ersten Mal hat alles. */
  const mk = (id, first, after) => ({ id, place: 't', participants: [], startedAt: 0, finishedAt: 1, cards: 20, firstTry: first, afterCorrection: after, attempts: 20 });
  check('I7: levels are recomputed from the stored runs — what the new rules grant is there at once',
    [A.levelOf([mk('a', 15, 2)], OLD.rules, OLD.levels).level, A.levelOf([mk('a', 15, 2)], REC.rules, REC.levels).level, A.levelOf([mk('b', 19, 0)], OLD.rules, OLD.levels).level, A.levelOf([mk('b', 19, 0)], REC.rules, REC.levels).level], [2, 1, 3, 2]);
}
{
  /* Die Vorschau des Imports: eine Baza mit drei Stufen, ein Kurs mit der Empfehlung. */
  const TEMAT = { ref: '@k/temat', name: 'Temat', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }] };
  const start = { format: 'recreatio.cogita.course', version: 1, name: 'B', kinds: [TEMAT], entities: [{ ref: '@t/a', kinds: ['@k/temat'], data: { nazwa: 'A' } }],
    settings: [{ levelsSetup: { levels: 3, rules: [{ pct: 75, attempts: 'any' }, { pct: 85, attempts: 'one' }, { pct: 95, attempts: 'first' }], knownShare: 1, openAt: 2 } }] };
  const made = await A.memoryBase(start, { libraryId: 'lib-gw', areaId: 'area-gw' });
  const lib = made.writer;
  check('I7: the base starts with three levels', lib.settings().levelsSetup?.levels, 3);
  const plan = A.planImport(lib, { format: 'recreatio.cogita.course', version: 1, name: 'Ustawienia', settings: [{ levelsSetup: A.newBaseSettings().levelsSetup }] });
  truth('I7: the preview says the levels change (first lines) and what it means for learners (a warning)', plan.lines.some((l) => l.startsWith('Poziomy zdobywania się zmieniają')) && plan.warnings.some((w) => w.includes('Nowy poziom 2') && w.includes('Mistrzowsko')), plan);
  const same = A.planImport(lib, { format: 'recreatio.cogita.course', version: 1, name: 'Bez zmiany', settings: [{ motivation: 'progress' }] });
  truth('I7: settings without levels — nothing about levels', !same.lines.some((l) => l.startsWith('Poziomy zdobywania')) && !same.warnings.some((w) => w.includes('Nowy poziom')), same);
  const empty = (await A.memoryBase({ format: 'recreatio.cogita.course', version: 1, name: 'C', kinds: [TEMAT] }, { libraryId: 'lib-gw2', areaId: 'area-gw2' })).writer;
  const fromZero = A.planImport(empty, { format: 'recreatio.cogita.course', version: 1, name: 'Poziomy', settings: [{ levelsSetup: A.newBaseSettings().levelsSetup }] });
  truth('I7: from no levels — the preview explains that towers are now conquered in runs', fromZero.warnings.some((w) => w.includes('zdobywa się ją w przebiegu')), fromZero.warnings);
}

/* ==================================================================================================================
 * I9 — "explore" mit einem Übergang; Übergänge ohne "id"; Hinweis und Name einer Möglichkeit
 * ================================================================================================================== */
{
  const TEMAT = { ref: '@k/temat', name: 'Temat', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'wymaga', label: 'Wymaga', type: 'ref', multi: true, to: ['@k/temat'], prerequisite: 'up' }] };
  const lib = (await A.memoryBase({ format: 'recreatio.cogita.course', version: 1, name: 'B', kinds: [TEMAT], entities: [{ ref: '@t/a', kinds: ['@k/temat'], data: { nazwa: 'A' } }] }, { libraryId: 'lib-i9', areaId: 'area-i9' })).writer;
  const flow = (edges, nodes = []) => ({ format: 'recreatio.cogita.course', version: 1, name: 'F', flows: [{ ref: '@f/x', name: 'X', start: 's', graph: {
    nodes: [{ id: 's', type: 'show', config: { of: '@t/a' } }, { id: 'e', type: 'explore', config: { title: 'Sprawdź, ile już umiesz', scope: ['@t/a'] } }, { id: 'k', type: 'end', config: {} }, ...nodes],
    edges: [{ from: 's', out: 'next', to: 'e' }, ...edges]
  } }] });
  const verdict = (doc) => {
    const plan = A.planImport(lib, doc);
    const read = A.readFlow('f', doc.flows[0]);
    return { blocked: A.importProblems(lib, plan).blocked.length, problems: A.flowProblems(read).length, edges: read.graph.edges.map((e) => `${e.from}>${e.out}>${e.to}`) };
  };
  check('I9: explore with only "done" — accepted, one edge is enough', verdict(flow([{ from: 'e', out: 'done', to: 'k' }])), { blocked: 0, problems: 0, edges: ['s>next>e', 'e>done>k'] });
  check('I9: explore with only "next" — read as "done"', verdict(flow([{ from: 'e', out: 'next', to: 'k' }])), { blocked: 0, problems: 0, edges: ['s>next>e', 'e>done>k'] });
  check('I9: explore with both — accepted, no warning', verdict(flow([{ from: 'e', out: 'done', to: 'k' }, { from: 'e', out: 'next', to: 'k' }])).problems, 0);
  const edges = A.readFlow('f', { graph: { nodes: [{ id: 'a', type: 'show' }, { id: 'b', type: 'show' }, { id: 'c', type: 'end' }], edges: [{ from: 'a', out: 'next', to: 'b' }, { id: '~e1', from: 'b', out: 'next', to: 'c' }] } }).graph.edges;
  check('I9: an edge without "id" is kept with its own id (it no longer vanishes), next to an explicit one, without a collision',
    [edges.map((e) => `${e.from}>${e.to}`), edges.map((e) => e.id).includes('~e1'), new Set(edges.map((e) => e.id)).size], [['a>b', 'b>c'], true, 2]);
  const long = (label, hint) => flow([{ from: 'e', out: 'done', to: 'c' }, { from: 'c', out: 'o0', to: 'k' }], [{ id: 'c', type: 'choice', config: { options: [{ label, hint }] } }]);
  const say = (doc) => A.planImport(lib, doc).warnings.join(' | ');
  check('I9/1.6: hint at most 100 and label at most 32 — longer ones warn', [A.HINT_MAX, A.OPTION_LABEL_MAX,
    say(long('Do warsztatów', 'x'.repeat(100))).includes('wskazówkę z'), say(long('Do warsztatów', 'x'.repeat(101))).includes('wskazówkę z 101'),
    say(long('x'.repeat(32), 'krótko')).includes('ma nazwę z'), say(long('x'.repeat(33), 'krótko')).includes('ma nazwę z 33')], [100, 32, false, true, false, true]);
  /* Der Weg „Formy wyjaśnienia" aus guide-stories §8g: als Ablauf ohne Sackgassen, die Hilfe als Hilfe. */
  const stories = await text('../templates/cogita/opowiesci-AI.md');
  const at = stories.indexOf('"title": "Jak to wyjaśnić?"');
  const open = stories.lastIndexOf('```json\n', at);
  const graph = JSON.parse(stories.slice(open + 8, stories.indexOf('\n```', at)));
  const forms = A.readFlow('forms', { start: 'q', graph });
  check('I1: the explanation-forms example in guide-stories is a sound flow (no problems, every help step reachable only after the error)',
    [A.flowProblems(forms).filter((p) => p.level === 'error').length, forms.graph.edges.length, graph.nodes.filter((n) => n.config?.remedial === true).length], [0, 14, 6]);
}

/* ==================================================================================================================
 * I8 — die Propozycje in guide-visuals §9 durch die Leser der App
 * ================================================================================================================== */
{
  const guide = await text('../templates/cogita/grafiki-AI.md');
  const nine = guide.slice(guide.indexOf('## 9. Rysunki z kształtów'));
  const subs = nine.split('\n### 9.').slice(1).map((s) => `9.${s}`);
  check('I8: twelve suggestions (9.1–9.12), each with when to use it and its words-only description', [subs.length, subs.every((s) => s.includes('**Kiedy:**') && s.includes('**Opis słowami:**'))], [12, true]);
  const KEYS = new Set(['type', 'x', 'y', 'w', 'h', 'r', 'x2', 'y2', 'd', 'text', 'size', 'weight', 'anchor', 'url', 'use', 'fill', 'stroke', 'width', 'cap', 'opacity', 'blur', 'glow', 'origin', 'scale', 'rotate', 'children', 'shift', 'motion', 'show', 'drag', 'tap', 'repeat', 'label', 'head', 'points', 'closed', 'fn', 'fx', 'fy', 'var', 'from', 'to', 'samples', 'keep', 'every', 'view', 'axes', 'clip', 'camera']);
  const count = (list) => (list ?? []).reduce((n, s) => n + 1 + count(s.children), 0);
  const parsedCount = (list) => list.reduce((n, s) => n + 1 + parsedCount(s.children), 0);
  const offKeys = (list) => (list ?? []).flatMap((s) => [...Object.keys(s).filter((k) => !KEYS.has(k)), ...offKeys(s.children)]);
  const offColors = (list) => (list ?? []).flatMap((s) => [...['fill', 'stroke'].filter((k) => s[k] !== undefined && A.colorValue(s[k]) === null).map((k) => `${k}=${s[k]}`), ...offColors(s.children)]);
  const drawings = [];
  const fences = [];
  for (const sub of subs) {
    const name = sub.slice(0, sub.indexOf('\n'));
    const said = /\*\*Opis słowami:\*\* (.+)\n/.exec(sub)?.[1] ?? '';
    for (const m of sub.matchAll(/```json\n([\s\S]*?)\n```/g)) drawings.push({ name, said, raw: JSON.parse(m[1]) });
    for (const m of sub.matchAll(/````\n```(chart|plot|diagram|tree|timeline)([^\n]*)\n([\s\S]*?)\n```\n````/g)) fences.push({ name, lang: m[1], info: m[2].trim(), body: m[3] });
  }
  check('I8: seven drawings and five fences (the table in 9.10 is plain markup)', [drawings.length, fences.length], [7, 5]);
  const report = drawings.map(({ name, said, raw }) => {
    const d = A.drawingOf(raw);
    const symbolsRaw = (raw.symbols ?? []).reduce((n, s) => n + count(s.shapes), 0);
    const symbolsRead = [...d.symbols.values()].reduce((n, l) => n + parsedCount(l), 0);
    return { name, dropped: count(raw.elements) - parsedCount(d.elements) + symbolsRaw - symbolsRead, keys: [...offKeys(raw.elements), ...(raw.symbols ?? []).flatMap((s) => offKeys(s.shapes))], colors: [...offColors(raw.elements), ...(raw.symbols ?? []).flatMap((s) => offColors(s.shapes))], problems: A.problemsOf(d).length, alt: d.alt === said && d.alt.length > 40 && d.alt.length <= 200 };
  });
  check('I8: every drawing reads whole — nothing dropped, no unknown key or colour, no expression problem, "alt" = its words-only description',
    report.filter((r) => r.dropped !== 0 || r.keys.length > 0 || r.colors.length > 0 || r.problems > 0 || !r.alt), []);
  const read = fences.map((f) => ({ name: f.name, lang: f.lang, ...A.readVisual(f.lang, f.info, f.body) }));
  check('I8: every fence reads without a warning', read.filter((r) => r.visual === null || r.warnings.length > 0).map((r) => [r.name, r.lang, r.warnings]), []);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
