/**
 * 2026-11-05 (Prompt 23, D1/D2/D3) — RYSUNKI: geprüft beim Import, Ziele nacheinander, „submit", ein Rysunek neben einer Folie:
 *
 *   1. Eine richtige Frage: keine Probleme, die Lösung erreicht ihr Ziel.
 *   2. Eine Lösung, die ihr Ziel verfehlt: gemeldet (Bericht und Warnung des Imports).
 *   3. Unbekannte Namen im Ziel, in let und an Teilen: beim Namen gemeldet; kein gültiges JSON: gemeldet.
 *   4. Ziele nacheinander ("goals"): richtig nur, wenn alle der Reihe nach erreicht werden; sonst falsch.
 *   5. "check": "submit": gelesen; das Bild beim Ausprobieren ohne Ziel-Regeln (nichts verrät das Treffen).
 *   6. Ein Rysunek bei einer Folie: aus dem Schritt (Objekt, JSON-Text) oder aus einem Feld des Eintrags.
 *
 *   node scripts/app-drawing-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-drawing-'));
const entry = join(workspace, 'entry.ts');
const app = fileURLToPath(new URL('../src/app/', import.meta.url)).replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}cogita/interactiveCheck';
export * from '${app}cogita/interactive';
export { slideDrawingText } from '${app}cogita/SlideDrawing';
`);
await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(workspace, 'entry.mjs'), jsx: 'automatic',
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }, loader: { '.css': 'empty' }, logLevel: 'error'
});
const M = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
await rm(workspace, { recursive: true, force: true });

let failures = 0;
let passes = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passes += 1; return; }
  failures += 1;
  console.error(`FAIL ${name}${detail === '' ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
};

/* Ein einfaches Bild: ein Schieber x, ein Punkt bei x. */
const drawing = (extra = {}) => JSON.stringify({
  view: [-1, -1, 11, 11],
  vars: [{ name: 'x', value: 0, min: 0, max: 10, step: 0.5 }],
  controls: [{ type: 'slider', var: 'x', label: 'Lage $x$' }],
  elements: [{ type: 'circle', x: '=x', y: 5, r: 0.5 }],
  ...extra
});
const q = (data) => ({ form: 'interactive', prompt: 'Stelle x ein', ...data });

/* 1. */
const good = M.drawingReport(q({ drawing: drawing(), goal: 'x > 3', solution: 'x = 4' }));
check('1: richtig — keine Probleme', good !== null && good.problems.length === 0, good?.problems);
check('1: die Lösung erreicht ihr Ziel', good?.solved === true, good);

/* 2. */
const bad = M.drawingReport(q({ drawing: drawing(), goal: 'x > 3', solution: 'x = 1' }));
check('2: die Lösung verfehlt ihr Ziel', bad?.solved === false, bad);
const warn = M.interactiveImportWarnings({ entities: [{ id: 'e1', kinds: ['question'], data: q({ drawing: drawing(), goal: 'x > 3', solution: 'x = 1' }) }] });
check('2: der Import warnt beim Namen', warn.length === 1 && warn[0].includes('Stelle x ein') && warn[0].includes('nie osiąga celu'), warn);
check('2: eine gute Frage warnt nicht', M.interactiveImportWarnings({ entities: [{ id: 'e2', kinds: ['question'], data: q({ drawing: drawing(), goal: 'x > 3', solution: 'x = 4' }) }] }).length === 0);
check('2: andere Fragen zählen nicht', M.interactiveImportWarnings({ entities: [{ id: 'e3', kinds: ['question'], data: { form: 'text', prompt: 'Was?' } }] }).length === 0);

/* 3. */
const unknownGoal = M.drawingReport(q({ drawing: drawing(), goal: 'y > 3', solution: 'x = 4' }));
check('3: unbekannter Name im Ziel', unknownGoal.problems.some((p) => p.includes('y')), unknownGoal.problems);
const unknownLet = M.drawingReport(q({ drawing: drawing({ let: [{ name: 'z', value: 'x * faktor' }] }), goal: 'x > 3' }));
check('3: unbekannter Name in let', unknownLet.problems.some((p) => p.includes('faktor')), unknownLet.problems);
const unknownPart = M.drawingReport(q({ drawing: drawing({ elements: [{ type: 'circle', x: '=xx', y: 5, r: 0.5 }] }), goal: 'x > 3' }));
check('3: unbekannter Name an einem Teil', unknownPart.problems.some((p) => p.includes('xx')), unknownPart.problems);
const broken = M.drawingReport(q({ drawing: '{kein json' }));
check('3: kein JSON', broken.problems.length === 1 && broken.spec === null);

/* 4. Ziele nacheinander. */
const seq = M.interactiveSpec(q({ drawing: drawing(), goals: ['x > 1', 'x > 3'] }), () => 0.5);
check('4: "goals" gelesen', seq.goals?.length === 2, seq);
check('4: beide erreicht (x = 4)', M.checkInteractive(seq, { vars: { x: 4 } }).correct);
check('4: nur das erste (x = 2) — falsch', !M.checkInteractive(seq, { vars: { x: 2 } }).correct);
const order = M.interactiveSpec(q({ drawing: drawing(), goals: ['x > 3', 'x < 1'] }), () => 0.5);
check('4: das zweite vor dem ersten nie zugleich — falsch', !M.checkInteractive(order, { vars: { x: 4 } }).correct && !M.checkInteractive(order, { vars: { x: 0 } }).correct);
check('4: ein Ziel wie bisher', M.checkInteractive(M.interactiveSpec(q({ drawing: drawing(), goal: 'x > 3' }), () => 0.5), { vars: { x: 5 } }).correct);

/* 5. „submit". */
const sub = M.interactiveSpec(q({ drawing: drawing({ rules: [{ when: 'x > 3', goal: true, say: 'Trafione!' }, { when: 'x > 8', say: 'Daleko' }] }), check: 'submit' }), () => 0.5);
check('5: "check": "submit" gelesen', sub.check === 'submit');
const live = M.drawingOfText(sub.drawing).live;
const quiet = M.liveWithoutGoals(live);
check('5: beim Ausprobieren keine Ziel-Regel, die übrigen bleiben', live.rules.some((r) => r.goal) && !quiet.rules.some((r) => r.goal) && quiet.rules.length === 1);
check('5: gewertet wird trotzdem', M.checkInteractive(sub, { vars: { x: 5 } }).correct && !M.checkInteractive(sub, { vars: { x: 1 } }).correct);
check('5: ohne "check": live', M.interactiveSpec(q({ drawing: drawing(), goal: 'x > 3' }), () => 0.5).check === undefined);

/* 6. Rysunek bei einer Folie. */
const obj = JSON.parse(drawing());
check('6: aus dem Schritt (Objekt)', M.slideDrawingText(obj, null) === JSON.stringify(obj));
check('6: aus dem Schritt (JSON-Text)', M.slideDrawingText(' {"elements": []} ', null) === '{"elements": []}');
const ent = { id: 'f', label: 'Zwei Geraden', kinds: [], kindIds: [], media: [], fields: [{ key: 'rysunek', label: 'Rysunek', text: drawing(), type: 'json' }] };
check('6: aus einem Feld des Eintrags', M.slideDrawingText('rysunek', ent) === drawing());
check('6: nichts', M.slideDrawingText(undefined, ent) === null && M.slideDrawingText('fehlt', ent) === null);

if (failures > 0) { console.error(`app-drawing-check: ${failures} failed, ${passes} passed`); process.exit(1); }
console.log(`app-drawing-check: ${passes} checks passed`);
