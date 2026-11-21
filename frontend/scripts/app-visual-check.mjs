/**
 * 2026-11-16 — GRAFIKEN IM ZAPIS (`library/visual.ts`, `library/visuals/Visuals.tsx`), ohne Browser geprüft:
 *
 *   1. Der Leser: ein Zaun bleibt ein Block (nichts darin wird Absatz, Liste oder Überschrift), ein Zaun ohne Ende reicht bis
 *      zum Schluss, Tabellen mit Kopf und Ausrichtung, Zellen sind Zapis (Wzory, Verweise), `\|` in einer Zelle.
 *   2. Diagramme: Arten und ihre Namen, Zahlen wie Menschen sie schreiben (1 234,5 · 12 % · −3), Trenner, Lücken, Warnungen
 *      statt Abbruch, die Grenzen (acht Reihen, drei bei Punkten).
 *   3. Funktionen, Schema, Baum, Zeitleiste: was gelesen wird und was gewarnt wird; die Schichten eines Schemas (Kreise).
 *   4. Klartext (Suche, Auszüge, MCP): eine Grafik in Worten, eine Tabelle Zeile für Zeile, Code, wie er ist.
 *   5. Gezeichnet (renderToStaticMarkup): eine Tabelle, Code, und eine Grafik im Zapis — überall, wo `Blocks` zeichnet.
 *   6. „Wstaw grafikę": das Beispiel jeder Art liest sich ohne Warnung und steht als eigener Absatz.
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-visual-'));
const entry = join(workspace, 'entry.tsx');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * as V from '${app}library/visual';
export { insertBlock } from '${app}library/VisualInsert';
export { layers, niceTicks } from '${app}library/visuals/Visuals';
export { default as Visual } from '${app}library/visuals/Visuals';
export { parseMarkup, plainText, citedKeys, unknownColors, TEXT_COLORS } from '${app}library/libraryMarkup';
export { slideLintOf } from '${app}cogita/slideLint';
export { Blocks } from '${app}library/markupView';
export { renderToStaticMarkup } from 'react-dom/server';
export { createElement } from 'react';
`);
await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', jsx: 'automatic',
  nodePaths: [join(process.cwd(), 'node_modules')],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' }, logLevel: 'error'
});

/* Der Speicher der Bibliothek horcht sonst auf andere Tabs — und hält den Prozess offen. */
globalThis.BroadcastChannel = undefined;
let passed = 0;
const ok = (label) => { passed += 1; console.log(`ok   ${label}`); };
try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const { V } = m;
  const F = '```';

  /* -- 1. Der Leser ---------------------------------------------------------------------------------------- */
  {
    const blocks = m.parseMarkup(`Wstęp.\n\n${F}chart Ludność\n## nie nagłówek\n- nie lista\n| Rok | A |\n| 2020 | 1 |\n${F}\n\nKoniec.`);
    assert.deepEqual(blocks.map((b) => b.t), ['p', 'fence', 'p']);
    assert.equal(blocks[1].lang, 'chart');
    assert.equal(blocks[1].info, 'Ludność');
    assert.equal(blocks[1].body, '## nie nagłówek\n- nie lista\n| Rok | A |\n| 2020 | 1 |');
    ok('a fence stays one block: nothing inside becomes a heading, list or table; lang and title from its first line');
    const open = m.parseMarkup(`Tekst\n${F}plot\ny = x`);
    assert.deepEqual(open.map((b) => b.t), ['p', 'fence']);
    assert.equal(open[1].body, 'y = x');
    ok('a fence without its end reaches to the end of the text (as while typing)');
    const tilde = m.parseMarkup('~~~~python\nprint(1)\n~~~~');
    assert.equal(tilde[0].t, 'fence'); assert.equal(tilde[0].lang, 'python');
    ok('~~~ fences too; another language is code');
    const table = m.parseMarkup('| Pojęcie | Wzór |\n|:--|--:|\n| pole koła | $\\pi r^2$ |\n| a \\| b | [[słowo|@x]] |');
    assert.equal(table[0].t, 'table');
    assert.deepEqual(table[0].align, ['left', 'right']);
    assert.equal(table[0].head.length, 2);
    assert.equal(table[0].rows[0][1][0].t, 'math');
    assert.equal(table[0].rows[1][0][0].v, 'a | b');
    assert.equal(table[0].rows[1][1][0].t, 'ref');
    assert.deepEqual(m.citedKeys('| a | [[b|@klucz]] |\n| c | d |'), ['klucz']);
    ok('a table: header from the |---| line, alignment, cells are markup (formulas, references), \\| inside a cell, references counted');
    assert.deepEqual(m.parseMarkup('| tylko jedna linia').map((b) => b.t), ['p']);
    assert.deepEqual(m.parseMarkup('Zdanie\n| ciąg dalszy').map((b) => b.t), ['p']);
    ok('one line with | or a | inside a paragraph stays text');
    const inQuote = m.parseMarkup(`::: details Dowód\n${F}tree\nA\n  B\n${F}\n:::`);
    assert.equal(inQuote[0].t, 'details'); assert.equal(inQuote[0].c[0].t, 'fence');
    ok('a graphic inside a fold (::: details) is read there');
  }

  /* -- 2. Diagramme ------------------------------------------------------------------------------------------ */
  {
    assert.equal(V.numberOf('1 234,5'), 1234.5);
    assert.equal(V.numberOf('1.234,5'), 1234.5);
    assert.equal(V.numberOf('12 %'), 12);
    assert.equal(V.numberOf('−3'), -3);
    assert.equal(V.numberOf('2.5', false), 2.5);
    assert.equal(V.numberOf('abc'), null);
    assert.deepEqual(V.rangeOf('-3..3'), [-3, 3]);
    assert.deepEqual(V.rangeOf('10 do 0'), [0, 10]);
    ok('numbers as people write them (1 234,5 · 1.234,5 · 12 % · −3) and ranges (-3..3, „10 do 0")');
    const c = V.readVisual('wykres', 'Ludność', 'type: linia\ny: mln\n| Rok | Polska | Czechy |\n|---|---|---|\n| 1950 | 25,0 | 8,9 |\n| 1990 | 38,1 | |\n| 2020 | 38,3 | 10,7 |');
    assert.equal(c.warnings.length, 0, c.warnings.join('; '));
    assert.equal(c.visual.kind, 'chart'); assert.equal(c.visual.type, 'line');
    assert.deepEqual(c.visual.series, ['Polska', 'Czechy']);
    assert.deepEqual(c.visual.rows.map((r) => r.at), [1950, 1990, 2020]);
    assert.deepEqual(c.visual.rows[1].values, [38.1, null]);
    ok('a chart: Polish names (wykres, linia), a separator row skipped, decimal commas, an empty cell is a gap, years as numbers');
    const csv = V.readVisual('chart', '', 'Owoc,Kg\njabłka,2.5\ngruszki,3');
    assert.deepEqual(csv.visual.rows.map((r) => r.values[0]), [2.5, 3]);
    const semi = V.readVisual('chart', '', 'Owoc;Kg\njabłka;2,5');
    assert.deepEqual(semi.visual.rows[0].values, [2.5]);
    ok('separators: with "," decimals are dots; with ";" (or | or tab) the comma is decimal');
    const bad = V.readVisual('chart', '', 'type: tort\n| x | a |\n| p | 1 |\n| q | dużo |');
    assert.equal(bad.visual.type, 'bar');
    assert.equal(bad.warnings.length, 2);
    assert.deepEqual(bad.visual.rows[1].values, [null]);
    ok('mistakes warn and the rest is drawn: unknown type → columns, a word instead of a number → empty');
    const many = V.readVisual('chart', '', `| x |${' s |'.repeat(10)}\n| a |${' 1 |'.repeat(10)}`);
    assert.equal(many.visual.series.length, V.MAX_SERIES);
    const dots = V.readVisual('chart', '', 'type: scatter\n| x | a | b | c | d |\n| 1 | 1 | 2 | 3 | 4 |');
    assert.equal(dots.visual.series.length, V.MAX_SCATTER_SERIES);
    const dotsBad = V.readVisual('chart', '', 'type: scatter\n| x | a |\n| jeden | 1 |');
    assert.equal(dotsBad.visual, null);
    ok('limits: eight series (the checked palette), three for points; points need numbers in the first column');
    assert.equal(V.readVisual('chart', '', 'type: bar').visual, null);
    ok('no data: nothing drawn, said why');
  }

  /* -- 3. Funktionen, Schema, Baum, Zeitleiste ---------------------------------------------------------------- */
  {
    const p = V.readVisual('plot', 'Ruch', 'y = x^2\nf(x) = sin(x)\nx: 0..5 czas [s]\ny: -1..30\npoint: 2, 4 tu');
    assert.equal(p.warnings.length, 0, p.warnings.join('; '));
    assert.deepEqual(p.visual.xRange, [0, 5]); assert.deepEqual(p.visual.yRange, [-1, 30]);
    assert.equal(p.visual.x, 'czas [s]');
    assert.deepEqual(p.visual.functions.map((f) => f.expr), ['x^2', 'sin(x)']);
    assert.deepEqual(p.visual.points, [{ x: 2, y: 4, label: 'tu' }]);
    ok('a plot: functions (y = …, f(x) = …), x range with its axis name, y range, a labelled point');
    assert.equal(V.readVisual('plot', '', 'x: 0..1').visual, null);
    ok('a plot with nothing to draw says so');

    const d = V.readVisual('diagram', '', 'direction: right\nświatło -> chlorofil: pochłania\nCO2[dwutlenek węgla] -> glukoza\nA -> B -> C\nA ..> C\nX <- Y\nsam');
    assert.equal(d.warnings.length, 0, d.warnings.join('; '));
    assert.equal(d.visual.direction, 'right');
    assert.equal(d.visual.nodes.find((n) => n.id === 'CO2').label, 'dwutlenek węgla');
    assert.deepEqual(d.visual.edges.map((e) => `${e.from}>${e.to}:${e.style}${e.label === '' ? '' : `:${e.label}`}`),
      ['światło>chlorofil:arrow:pochłania', 'CO2>glukoza:arrow', 'A>B:arrow', 'B>C:arrow', 'A>C:dashed', 'Y>X:arrow']);
    assert.ok(d.visual.nodes.some((n) => n.id === 'sam'));
    ok('a diagram: labelled arrows, id[long text], chains, dashed, reversed, a lone box, direction');
    const rows = m.layers({ nodes: ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id })), edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }, { from: 'a', to: 'd' }].map((e) => ({ ...e, label: '', style: 'arrow' })) });
    assert.deepEqual(rows.map((r) => r.length), [1, 2, 1]);
    assert.equal(rows[0][0], 'a');
    ok('layers: each box below its deepest source; a cycle is broken at its back edge (no endless loop)');
    const tr = V.readVisual('tree', 'Części mowy', 'Części mowy\n  Odmienne\n    rzeczownik\n  - Nieodmienne\n    spójnik\n    rzeczownik');
    assert.equal(tr.visual.tree, true);
    assert.equal(tr.visual.nodes.length, 6);
    assert.deepEqual(tr.visual.edges.map((e) => `${e.from}>${e.to}`), ['Części mowy>Odmienne', 'Odmienne>rzeczownik', 'Części mowy>Nieodmienne', 'Nieodmienne>spójnik', 'Nieodmienne>rzeczownik#6']);
    ok('a tree from indentation (with "- "), the same word twice is two boxes');
    const tl = V.readVisual('oś-czasu', '', 'title: Bosko\n1815: narodziny\n1859–1888 — Zgromadzenie\nXIV w.: coś\nbez daty');
    assert.equal(tl.visual.title, 'Bosko');
    assert.deepEqual(tl.visual.items.map((i) => i.when), ['1815', '1859–1888', 'XIV w.']);
    assert.equal(tl.warnings.length, 1);
    ok('a timeline: dates as written (ranges, centuries), "—" or ":", a line without a date warns');
    assert.deepEqual(m.niceTicks(0, 38.3, 4), [0, 10, 20, 30, 40]);
    ok('axis ticks: 1, 2, 5 × 10ⁿ, rounded outwards');
  }

  /* -- 4. Klartext ---------------------------------------------------------------------------------------------- */
  {
    const plain = m.plainText(`Przed.\n\n${F}chart Owoce\n| Owoc | kg |\n| jabłka | 2 |\n${F}\n\n| a | b |\n|---|---|\n| $x^2$ | c |\n\n${F}diagram\nA -> B: daje\n${F}\n\n${F}python\nprint(1)\n${F}`);
    assert.ok(plain.includes('Wykres: Owoce'), plain);
    assert.ok(plain.includes('jabłka | 2'), plain);
    assert.ok(plain.includes('a | b'), plain);
    assert.ok(plain.includes('A → B (daje)'), plain);
    assert.ok(plain.includes('print(1)'), plain);
    ok('plain text (search, excerpts, MCP): a graphic in words, a table row by row, code as written');
  }

  /* -- 5. Gezeichnet ------------------------------------------------------------------------------------------- */
  {
    const look = { get: () => undefined, byKey: () => undefined };
    const html = m.renderToStaticMarkup(m.createElement(m.Blocks, { blocks: m.parseMarkup(`| a | b |\n|---|--:|\n| **1** | $x$ |\n\n${F}python\nprint(1)\n${F}`), look, notes: null, prefix: 'p-' }));
    assert.ok(html.includes('<table class="lib-table">'), html);
    assert.ok(html.includes('<th>a</th>') && html.includes('class="is-right"') && html.includes('<strong>1</strong>'), html);
    assert.ok(html.includes('<pre class="lib-code" data-code-lang="python"><code>print(1)</code></pre>'), html);
    ok('drawn by Blocks (every markup text): a table with its header and alignment, code as code');
    const label = (s) => s;
    const chart = m.renderToStaticMarkup(m.createElement(m.Visual, { lang: 'chart', info: 'Owoce', body: '| Owoc | 2023 | 2024 |\n| jabłka | 2 | 3 |\n| gruszki | 1 | 2 |', label }));
    assert.ok(chart.includes('data-visual="chart-bar"') && chart.includes('data-visual-legend="2"') && chart.includes('data-visual-data=""'), chart);
    assert.ok(chart.includes('<td class="vz-num">3</td>'), chart);
    ok('a chart: figure with its title, a legend from two series, the data table');
    const broken = m.renderToStaticMarkup(m.createElement(m.Visual, { lang: 'chart', info: '', body: 'type: bar', label }));
    assert.ok(broken.includes('vz-broken') && broken.includes('data-visual-warn="1"'), broken);
    ok('nothing to draw: the fence text and why');
    const tl = m.renderToStaticMarkup(m.createElement(m.Visual, { lang: 'timeline', info: '', body: '1815: narodziny\n1841: święcenia', label }));
    assert.ok(tl.includes('data-visual-moment="1"') && tl.includes('narodziny'), tl);
    const dg = m.renderToStaticMarkup(m.createElement(m.Visual, { lang: 'diagram', info: '', body: 'A -> B\nA -> C', label }));
    assert.ok(dg.includes('data-visual-layer="1"') && (dg.match(/data-visual-node=/g) ?? []).length === 3, dg);
    ok('a timeline and a diagram: dates in order, boxes in layers');
  }

  /* -- 6. Wstaw grafikę ------------------------------------------------------------------------------------------ */
  {
    for (const kind of [...V.VISUAL_KINDS]) {
      const text = V.visualTemplate(kind);
      const blocks = m.parseMarkup(text);
      assert.equal(blocks.length, 1, kind);
      const read = V.readVisual(blocks[0].lang, blocks[0].info, blocks[0].body);
      assert.equal(read.warnings.length, 0, `${kind}: ${read.warnings.join('; ')}`);
      assert.notEqual(read.visual, null, kind);
    }
    assert.equal(m.parseMarkup(V.visualTemplate('table'))[0].t, 'table');
    ok('every example of "Wstaw grafikę" reads without a warning');
    const put = m.insertBlock('Pierwszy akapit.\nDrugi', 'XX', 16);
    assert.equal(put.text, 'Pierwszy akapit.\n\nXX\n\nDrugi');
    assert.equal(m.insertBlock('', 'XX').text, 'XX\n');
    ok('inserted as its own paragraph at the caret (empty lines around it)');
  }
  {
    /* 2026-11-21 — farbiger Text: [Wörter]{.red}. */
    const [p] = m.parseMarkup('Woda [na **słońcu**]{.orange} i [x]{.big .blue} oraz [y]{.rot}, a [link](https://a.pl) zostaje.');
    const colors = p.c.filter((i) => i.t === 'color').map((i) => [i.color, i.c.map((x) => x.t).join('+')]);
    assert.deepEqual(colors, [['orange', 'text+b'], ['blue', 'text'], ['rot', 'text']]);
    assert.ok(p.c.some((i) => i.t === 'link'));
    ok('colours: [words]{.red} with markup inside, several classes (the first known), an unknown name kept for the warning; a link stays a link');
    const html = m.renderToStaticMarkup(m.createElement(m.Blocks, { blocks: m.parseMarkup('**[A]{.red}** [B]{.mark} [C]{.rot}'), notes: null }));
    assert.match(html, /<strong><span class="lib-c lib-c-red" data-text-color="red">A<\/span><\/strong>/);
    assert.match(html, /<span class="lib-c lib-c-mark" data-text-color="mark">B<\/span>/);
    assert.ok(!html.includes('rot') && html.includes('C'));
    ok('drawn as a span of the palette (also inside bold, "mark" as highlighter); an unknown colour — the words without colour');
    assert.equal(m.plainText('[Ważne]{.red} zdanie'), 'Ważne zdanie');
    assert.deepEqual([m.unknownColors('[a]{.red} [b]{.rot} [c]{.Blau}'), m.unknownColors('bez koloru')], [['rot', 'blau'], []]);
    const warn = m.slideLintOf({ kinds: [], entities: [{ id: 'e1', kinds: ['k'], data: { tytul: 'Slajd', blocks: [{ type: 'paragraph', text: '[x]{.rot}' }] } }, { id: 'e2', kinds: ['k'], data: { tytul: 'Dobry', blocks: [{ text: '[x]{.green}' }] } }] }, () => [], 'pl');
    assert.equal(warn.length, 1);
    assert.ok(warn[0].includes('.rot') && warn[0].includes('„Slajd”') && warn[0].includes('mark'), warn[0]);
    assert.equal(m.TEXT_COLORS.length, 10);
    ok('plain text drops the colour; the import warns once per entry about a colour that does not exist (with the allowed ones)');
  }
  console.log(`\n${passed} passed, 0 failed`);
} catch (e) {
  console.error('FAIL', e);
  process.exitCode = 1;
} finally {
  await rm(workspace, { recursive: true, force: true });
  process.exit(process.exitCode ?? 0);
}
