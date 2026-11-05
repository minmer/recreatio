/**
 * 2026-11-05 (Prompt 23, A2–A6) — FRAGEN ↔ FOLIEN, ohne Oberfläche nachgemessen (`cogita/slideLinks.ts`, `cogita/slideLint.ts`,
 * `cogita/slideWords.ts`):
 *
 *   1. Der Index: wo jede Folie steht (Schritt, Folge), wer in wen abbiegt, welche Einheit wem gehört — auch mit @Namen.
 *   2. Die Leiter: vom obersten Überblick bis zur Erzählung, nie im Kreis.
 *   3. Wo eine Folie zu sehen ist: die begonnene zuerst, sonst die tiefere vor dem Überblick.
 *   4. Führende Folien, die Fragen zu einer Folie (genau die, deren Erklärung sie nennt).
 *   5. Die Gruppen: je Satz führender Folien eine, bei ihrer Erzählung nach der Folge der Folien; „Cała opowieść" zuletzt.
 *   6. Der Stand der Gruppen: Tal, zu wiederholen, lernbar, Berg mit den offenen davor.
 *   7. Der Lint: „Cytat (…):", „Przypisy", „kliknij dalej", Zitat ohne „> — Autor", [@…] in einer Frage — und nichts bei guten.
 *   8. Die Worte in drei Sprachen.
 *
 *   node scripts/app-slide-links-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-slides-'));
const entry = join(workspace, 'entry.ts');
const app = fileURLToPath(new URL('../src/app/', import.meta.url)).replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}cogita/slideLinks';
export { slideLintOf, textProblems, promptCites } from '${app}cogita/slideLint';
export { slideWords } from '${app}cogita/slideWords';
`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(workspace, 'entry.mjs'), define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }, loader: { '.css': 'empty' }, logLevel: 'error' });
const M = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
await rm(workspace, { recursive: true, force: true });

let failures = 0;
let passes = 0;
const check = (name, ok, detail = '') => { if (ok) { passes += 1; return; } failures += 1; console.error(`FAIL ${name}${detail === '' ? '' : ` — ${JSON.stringify(detail)}`}`); };

const show = (id, of) => ({ id, type: 'show', config: { of } });
const detour = (id, flow) => ({ id, type: 'detour', config: { flow } });
const q = (id) => ({ id, type: 'question', config: { of: id } });
const flows = [
  { id: 'zarys', name: 'Zarys', unit: 'u-zarys', graph: { nodes: [show('s1', 'z1'), detour('d1', '@etap1'), { id: 'end', type: 'end', config: {} }] } },
  { id: 'etap1', name: 'Etap 1', unit: 'u-etap1', graph: { nodes: [show('sa', 'a1'), detour('d1', 'sen'), show('sb', 'a2'), detour('d2', 'becchi'), show('sc', 'shared'), q('q1')] } },
  { id: 'sen', name: 'Sen', unit: 'u-sen', graph: { nodes: [show('s1', 'sen1'), show('s2', 'shared'), detour('d', 'proroctwo')] } },
  { id: 'becchi', name: 'Becchi', unit: 'u-becchi', graph: { nodes: [show('s1', 'b1')] } },
  { id: 'proroctwo', name: 'Proroctwo', graph: { nodes: [show('s1', 'p1'), detour('back', 'proroctwo')] } }
];
const entryRef = (r) => (r.startsWith('@') ? r.slice(1) : r);
const flowRef = (r) => { const x = r.startsWith('@') ? r.slice(1) : r; return flows.some((f) => f.id === x) ? x : null; };
const ix = M.storyIndex(flows, entryRef, flowRef);

/* 1 */
check('1: Folie a2 steht in etap1 als zweite', JSON.stringify(ix.shows.get('a2')) === JSON.stringify([{ flow: 'etap1', step: 'sb', order: 1 }]), ix.shows.get('a2'));
check('1: shared steht zweimal', (ix.shows.get('shared') ?? []).length === 2);
check('1: wer in sen abbiegt (auch mit @Namen)', JSON.stringify(ix.callers.get('sen')) === '["etap1"]' && JSON.stringify(ix.callers.get('etap1')) === '["zarys"]');
check('1: ein Abstecher in sich selbst zählt nicht', !(ix.callers.get('proroctwo') ?? []).includes('proroctwo'));
check('1: Einheit → Erzählung', ix.unitFlow.get('u-sen') === 'sen');
/* 2 */
check('2: die Leiter von proroctwo', M.ladderOf(ix, 'proroctwo').join('>') === 'zarys>etap1>sen>proroctwo', M.ladderOf(ix, 'proroctwo'));
check('2: der Überblick ist seine eigene Leiter', M.ladderOf(ix, 'zarys').join('>') === 'zarys');
/* 3 */
const at = M.storyForSlide(ix, 'shared');
check('3: ohne Begonnenes — die tiefere (sen vor etap1)', at?.flow === 'sen' && at.step === 's2' && at.ladder.join('>') === 'zarys>etap1>sen', at);
const at2 = M.storyForSlide(ix, 'shared', (f) => f === 'etap1');
check('3: eine begonnene geht vor', at2?.flow === 'etap1' && at2.step === 'sc', at2);
check('3: keine Erzählung — null', M.storyForSlide(ix, 'nirgends') === null);
/* 4 */
const isSlide = (id) => ['z1', 'a1', 'a2', 'shared', 'sen1', 'b1', 'p1'].includes(id);
check('4: führende Folien bis zum ersten Thema', M.leadingSlides(['a1', 'a2', 'topic', 'b1'], isSlide).join() === 'a1,a2');
check('4: kein Anfang mit Folie — leer', M.leadingSlides(['topic', 'a1'], isSlide).length === 0);
const questions = [
  { id: 'qa', explain: ['a1', 'topic'] }, { id: 'qb', explain: ['a1', 'topic2'] }, { id: 'qc', explain: ['a1', 'a2', 'topic'] },
  { id: 'qd', explain: ['sen1'] }, { id: 'qe', explain: ['topic', 'a1'] }, { id: 'qw', explain: ['u-sen', 'topic'] }, { id: 'qx', explain: ['topic'] }
];
check('4: Fragen zu a1 (auch nicht führend)', M.questionsOfSlide(questions, 'a1').join() === 'qa,qb,qc,qe');
/* 5 */
const groups = M.questionGroups(questions, ix, isSlide);
const keys = groups.map((g) => g.key);
check('5: je Satz führender Folien eine Gruppe', keys.includes('s:a1') && keys.includes('s:a1+a2') && keys.includes('s:sen1'), keys);
check('5: s:a1 hat qa und qb', groups.find((g) => g.key === 's:a1')?.questions.join() === 'qa,qb');
check('5: ohne führende Folie und ohne Einheit — keine Gruppe', !groups.some((g) => g.questions.includes('qx') || g.questions.includes('qe')));
check('5: die ganze Erzählung — „whole:sen" zuletzt in sen', groups.find((g) => g.key === 'whole:sen')?.whole === true && keys.indexOf('whole:sen') > keys.indexOf('s:sen1'), keys);
check('5: in der Folge der Erzählungen, dann der Folien', keys.indexOf('s:a1') < keys.indexOf('s:sen1'), keys);
/* 6 */
const stand = { qa: [{ k: 1, seen: true }], qb: [{ k: 1, seen: true }], qc: [{ k: 0.4, seen: true }], qd: [{ k: 0, seen: false }], qw: [{ k: 0, seen: false }] };
const stands = M.groupStands(groups, (id) => stand[id] ?? []);
const st = (key) => stands[keys.indexOf(key)];
check('6: alle gekonnt — Tal', st('s:a1').band === 'known' && st('s:a1').steps === 0);
check('6: alle beantwortet, nicht alle gekonnt — zu wiederholen', st('s:a1+a2').band === 'due');
check('6: die erste offene in sen — lernbar', st('s:sen1').band === 'ring' && st('s:sen1').steps === 1);
check('6: danach — ein Berg mit zwei Stufen', st('whole:sen').band === 'mountain' && st('whole:sen').steps === 2, st('whole:sen'));
check('6: die Gruppe davor in derselben Erzählung', st('whole:sen').before === keys.indexOf('s:sen1'));
/* 7 */
check('7: „Cytat (…):"', M.textProblems(['Cytat (Wspomnienia, s. 3): „Byłem…”']).includes('quote'));
check('7: „Przypisy"', M.textProblems(['Tekst.\n\nPrzypisy:\n1. Coś']).includes('notes'));
check('7: „kliknij dalej"', M.textProblems(['Teraz kliknij dalej, żeby zobaczyć.']).includes('click'));
check('7: Zitat ohne „> — Autor"', M.textProblems(['> Byłem wtedy chłopcem.\n> I śniłem.']).includes('quoteBy'));
check('7: Zitat mit „> — Autor" ist gut', M.textProblems(['> Byłem wtedy chłopcem.\n> — Jan Bosko']).length === 0);
check('7: guter Text — nichts', M.textProblems(['Jan urodził się w 1815 r.\n\nPotem $x^2$ i przypis[^1].\n\n[^1]: Źródło.']).length === 0);
check('7: [@…] in einer Frage', M.promptCites('Kiedy? [@wspomnienia, s. 12]') && !M.promptCites('Kiedy był sen?'));
const lint = M.slideLintOf({ kinds: [], entities: [
  { id: 'e1', kinds: ['slajd'], data: { tytul: 'Zły cytat', tresc: [{ type: 'paragraph', text: 'Cytat (Pamiętnik): „…”' }] } },
  { id: 'e2', kinds: ['question'], data: { prompt: 'Gdzie? [@x]' } },
  { id: 'e3', kinds: ['slajd'], data: { tytul: 'Dobry', tresc: [{ type: 'paragraph', text: '> Słowa.\n> — Autor' }] } }
] }, (k) => (k.includes('slajd') ? ['tresc'] : []), 'pl');
check('7: zwei Warnungen (Zitat, Frage), keine beim guten', lint.length === 2 && lint[0].includes('Zły cytat') && lint[1].includes('[@'), lint);
const de = M.slideLintOf({ kinds: [], entities: [{ id: 'e1', kinds: ['folie'], data: { titel: 'Alt', inhalt: [{ type: 'paragraph', text: 'Cytat (Gauß): „…”' }] } }] }, () => ['inhalt'], 'de');
check('7: deutsch', de.length === 1 && de[0].includes('Schreibweise'), de);
/* 8 */
for (const lang of ['pl', 'de', 'en']) {
  const W = M.slideWords(lang);
  for (const [k, v] of Object.entries(W)) {
    const text = typeof v === 'function' ? v(3, 1) : v;
    check(`8: ${lang}.${k}`, typeof text === 'string' && text.trim() !== '' && !text.includes('undefined'), text);
  }
}
check('8: polnische Mehrzahl', M.slideWords('pl').pytania(5) === '5 pytań' && M.slideWords('pl').pytania(2) === '2 pytania');

if (failures > 0) { console.error(`app-slide-links-check: ${failures} failed, ${passes} passed`); process.exit(1); }
console.log(`app-slide-links-check: ${passes} checks passed`);
