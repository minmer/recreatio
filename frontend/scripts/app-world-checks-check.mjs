/**
 * 2026-11-22 (Eigentümer, „Gute Welten", I2) — DIE KONTROLLE EINER WELT (`src/app/cogita/worldChecks.ts`), ohne Browser:
 *   1. eine kleine Welt, gebaut, um JEDE Prüfung auszulösen — und an den Stellen, die stimmen, nichts;
 *   2. dieselbe Welt als Abschrift für AI (wie `aiSnapshot.ts`), im Dienst-Bündel (`backend/Api/Library/ImportCheck.js`,
 *      `recreatioWorldChecks`) in einem nackten JavaScript-Kontext (wie Jint): dieselben Befunde;
 *   3. die Hilfen: Wörter einer Folie, fast gleiche Tags.
 *
 *   node scripts/app-world-checks-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const workspace = await mkdtemp(join(tmpdir(), 'app-world-checks-'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(join(workspace, 'entry.ts'), `
export { memoryBase } from '${app}cogita/memoryBase';
export { worldChecks, wordCount, nearSame } from '${app}cogita/worldChecks';
export { exportSetup, nameIn } from '${app}cogita/json';
export { feedbackForAi } from '${app}cogita/feedback';
export { worldInputOf } from '${app}cogita/worldmap/wmInput';
`);
await build({
  entryPoints: [join(workspace, 'entry.ts')], bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', jsx: 'automatic',
  plugins: [{ name: 'no-css', setup(b) { b.onResolve({ filter: /\.css$/ }, (a) => ({ path: a.path, namespace: 'no-css' })); b.onLoad({ filter: /.*/, namespace: 'no-css' }, () => ({ contents: '', loader: 'js' })); } }],
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const m = await import(pathToFileURL(join(workspace, 'entry.js')).href);

let passed = 0;
const ok = (name) => { passed += 1; console.log(`ok   ${name}`); };

/* -- Eine Welt, die jede Prüfung auslöst ------------------------------------------------------------------------------- */
const q = (ref, about, data) => ({ ref, kinds: ['question'], data: { form: 'one', about: about === null ? [] : [about], ...data } });
const longWords = Array.from({ length: 150 }, (_, i) => `słowo${i}`).join(' ');
const world = {
  format: 'recreatio.cogita.course', version: 1, name: 'Świat do kontroli',
  kinds: [
    { ref: '@w2/tag', name: 'Tag', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'nad', label: 'Nad', type: 'ref', to: ['@w2/tag'], multi: true, tag: 'up' }] },
    { ref: '@w2/temat', name: 'Temat nauki', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'wymaga', label: 'Wymaga', type: 'ref', to: ['@w2/temat'], multi: true, prerequisite: 'up' }, { key: 'tagi', label: 'Tagi', type: 'ref', to: ['@w2/tag'], multi: true, tag: 'up' }] },
    { ref: '@w2/slajd', name: 'Slajd', label: '{tytul}', fields: [{ key: 'tytul', label: 'Tytuł', type: 'line' }, { key: 'tekst', label: 'Tekst', type: 'blocks' }, { key: 'wyjasnia', label: 'Wyjaśnia', type: 'ref', to: ['@w2/temat'] }] },
    { ref: '@w2/jednostka', name: 'Jednostka', label: '{nazwa}', fields: [{ key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'wymaga', label: 'Wymaga', type: 'ref', to: ['@w2/temat'], multi: true, prerequisite: 'up' }] }
  ],
  entities: [
    { ref: '@w2/tag/mech', kinds: ['@w2/tag'], data: { nazwa: 'Mechanika' } },
    { ref: '@w2/tag/optyka', kinds: ['@w2/tag'], data: { nazwa: 'Optyka' } },
    { ref: '@w2/tag/optyki', kinds: ['@w2/tag'], data: { nazwa: 'Optyki' } },
    { ref: '@w2/t1', kinds: ['@w2/temat'], data: { nazwa: 'Ruch', tagi: ['@w2/tag/mech'] } },
    { ref: '@w2/t2', kinds: ['@w2/temat'], data: { nazwa: 'Prędkość', wymaga: ['@w2/t1'], tagi: ['@w2/tag/optyka'] } },
    { ref: '@w2/t3', kinds: ['@w2/temat'], data: { nazwa: 'Siła', tagi: ['@w2/tag/optyki'] } },
    { ref: '@w2/t4', kinds: ['@w2/temat'], data: { nazwa: 'Kąt', wymaga: ['@w2/t5'] } },
    { ref: '@w2/t5', kinds: ['@w2/temat'], data: { nazwa: 'Łuk', wymaga: ['@w2/t4'] } },
    { ref: '@w2/u1', kinds: ['@w2/jednostka'], data: { nazwa: 'Jednostka 1', wymaga: ['@w2/t2'] } },
    ...[1, 2, 3, 4].map((n) => ({ ref: `@w2/s${n}`, kinds: ['@w2/slajd'], data: { tytul: `Ruch ${n}`, tekst: [{ type: 'paragraph', text: `Krótki tekst ${n}.` }], wyjasnia: '@w2/t1' } })),
    { ref: '@w2/s5', kinds: ['@w2/slajd'], data: { tytul: 'Prędkość', tekst: [{ type: 'paragraph', text: 'Prędkość to droga w czasie.' }], wyjasnia: '@w2/t2' } },
    { ref: '@w2/sdlugi', kinds: ['@w2/slajd'], data: { tytul: 'Za długi', tekst: [{ type: 'paragraph', text: longWords }], wyjasnia: '@w2/t1' } },
    { ref: '@w2/sklik', kinds: ['@w2/slajd'], data: { tytul: 'Klik', tekst: [{ type: 'paragraph', text: 'Teraz kliknij dalej, aby iść.' }], wyjasnia: '@w2/t2' } },
    q('@w2/qflash', '@w2/t1', { form: 'flash', prompt: 'Co to jest ruch?', back: 'Zmiana położenia.' }),
    ...['a', 'b', 'c', 'd', 'e'].map((x, i) => q(`@w2/q${x}`, '@w2/t1', {
      prompt: `Pytanie ${x}?`, options: [`Najdłuższa poprawna odpowiedź ${x}`, 'Krótka', 'Inna', 'Jeszcze'], correct: [0],
      ...(i === 0 ? { tags: ['', 'myli-predkosc', 'myli-predkosci', 'zle-jednostki'] } : {})
    })),
    q('@w2/v1', '@w2/t2', { prompt: 'Głos 1?', options: ['A', 'B', 'C', 'D'], correct: [1], tags: ['blad-a', '', 'blad-c', 'blad-d'], feedback: ['x', 'y', 'z', 'w'], core: true }),
    q('@w2/v2', '@w2/t2', { prompt: 'Głos 2?', options: ['A', 'B', 'C', 'D'], correct: [2], tags: ['blad-a', 'blad-b', '', 'blad-d'], feedback: ['x', 'y', 'z', 'w'] }),
    q('@w2/qt3', '@w2/t3', { prompt: 'Siła?', options: ['Tak', 'Nie'], correct: [0], feedback: ['a', 'b'] }),
    q('@w2/q4', '@w2/t4', { prompt: 'Kąt?', options: ['Tak', 'Nie'], correct: [0], feedback: ['a', 'b'] }),
    q('@w2/q5', '@w2/t5', { prompt: 'Łuk?', options: ['Tak', 'Nie'], correct: [0], feedback: ['a', 'b'] }),
    q('@w2/qnic', null, { prompt: 'O niczym?', options: ['Tak', 'Nie'], correct: [0], feedback: ['a', 'b'] }),
    /* 2026-11-26 — Fragen der Klasse: eine im Turm (ein Befund), eine ohne Turm (in Ordnung, kein „noTower"). */
    q('@w2/klasa', '@w2/t2', { prompt: 'Jak myślicie?', options: ['A', 'B', 'C', 'D'], correct: [0], tags: ['', 'b', 'c', 'd'], feedback: ['x', 'y', 'z', 'w'], use: 'lesson' }),
    q('@w2/klasa2', null, { prompt: 'Jak myślicie 2?', options: ['A', 'B', 'C', 'D'], correct: [0], tags: ['', 'b', 'c', 'd'], feedback: ['x', 'y', 'z', 'w'], use: 'lesson' })
  ],
  flows: [
    {
      ref: '@w2/f1', name: 'Pierwsza droga', look: 'reading', unit: '@w2/u1', start: 's1',
      graph: {
        nodes: [
          ...[1, 2, 3, 4].map((n) => ({ id: `s${n}`, type: 'show', config: { of: `@w2/s${n}` } })),
          { id: 'qa', type: 'question', config: { of: '@w2/qa' } }, { id: 'qb', type: 'question', config: { of: '@w2/qb' } }, { id: 'qc', type: 'question', config: { of: '@w2/qc' } },
          { id: 's5', type: 'show', config: { of: '@w2/s5' } },
          { id: 'ch', type: 'choice', config: { options: [{ label: 'Bardzo długa nazwa tej możliwości na rozwidleniu', hint: 'Podpowiedź'.repeat(12) }, { label: 'Krótko' }] } },
          { id: 'z1', type: 'question', config: { of: '@w2/v1' } }, { id: 'z2', type: 'question', config: { of: '@w2/v2' } }, { id: 'z3', type: 'question', config: { of: '@w2/qd' } },
          { id: 'z4', type: 'question', config: { of: '@w2/qe' } }, { id: 'z5', type: 'question', config: { of: '@w2/qflash' } },
          { id: 'koniec', type: 'end', config: {} }
        ],
        edges: [
          ['s1', 'next', 's2'], ['s2', 'next', 's3'], ['s3', 'next', 's4'], ['s4', 'next', 'qa'],
          ['qa', 'right', 'qb'], ['qa', 'wrong', 'qb'], ['qb', 'right', 'qc'], ['qb', 'wrong', 'qc'], ['qc', 'right', 's5'], ['qc', 'wrong', 's5'],
          ['s5', 'next', 'ch'], ['ch', 'o0', 'z1'], ['ch', 'o1', 'z1'],
          ['z1', 'right', 'z2'], ['z1', 'wrong', 'z2'], ['z2', 'right', 'z3'], ['z2', 'wrong', 'z3'], ['z3', 'right', 'z4'], ['z3', 'wrong', 'z4'],
          ['z4', 'right', 'z5'], ['z4', 'wrong', 'z5'], ['z5', 'right', 'koniec'], ['z5', 'wrong', 'koniec']
        ].map(([from, out, to], i) => ({ id: `e${i}`, from, out, to, in: 'in' }))
      }
    }
  ],
  views: [{ ref: '@w2/mapa', name: 'Mapa', mode: 'landscape', steps: [{ type: 'source.kind', config: { kind: '@w2/temat' } }], landscape: { style: 'world' } }]
};

try {
  const made = await m.memoryBase(world, { libraryId: 'w2-swiat', areaId: 'w2-obszar' });
  assert.ok(!('error' in made), made.error);
  const lib = made.writer;
  const qflash = lib.byImportRef('w2/qflash', 'entity').id;
  /* Ein Ablauf ohne Schritte (der Import nimmt ihn nicht an — in der Baza kann er trotzdem stehen). */
  await lib.saveDoc('flow', { name: 'Pusta', look: 'reading', graph: { nodes: [], edges: [] } });
  await lib.saveDoc('feedback', { target: { kind: 'question', entity: qflash, label: 'Co to jest ruch?' }, category: 'wrong', text: 'To nie jest pytanie.', at: '2026-11-22T10:00:00Z', state: 'open' });
  await lib.saveDoc('feedback', { target: { kind: 'question', entity: qflash, label: 'Co to jest ruch?' }, category: 'good', text: 'Już poprawione.', at: '2026-11-21T10:00:00Z', state: 'done' });
  const { cards } = await lib.cards();
  const report = m.worldChecks(lib, { cards });
  const codes = new Set(report.findings.map((f) => f.code));
  const of = (code) => report.findings.filter((f) => f.code === code);
  const name = (ref) => lib.label(lib.entity(lib.byImportRef(ref, 'entity').id));

  /* -- 1. Jede Prüfung ------------------------------------------------------------------------------------------------- */
  const expected = ['question.flash', 'question.noTower', 'question.untaught', 'question.noFeedback', 'question.classInTower', 'tower.noCore', 'tower.longestCorrect',
    'tower.positions', 'slide.long', 'path.severalTowers', 'path.slidesInRow', 'path.questionsInRow', 'path.longClosing', 'line.ticket', 'fork.labelLong',
    'fork.hintLong', 'mistakeTag.noHelp', 'mistakeTag.nearDuplicate', 'mistakeTag.usedOnce', 'tag.usedOnce', 'tag.nearDuplicate', 'levels.standard',
    'feedback.open', 'flow.preview', 'preview.slides', 'map.cycle'];
  const missing = expected.filter((c) => !codes.has(c));
  assert.deepEqual(missing, [], `checks that did not fire: ${missing.join(', ')} — got ${[...codes].join(', ')}`);
  ok(`every check fires on a world built for it (${expected.length} codes; ${report.findings.length} findings)`);

  assert.equal(of('question.flash')[0].weight, 'must');
  assert.equal(of('question.flash')[0].entity.name, '@w2/qflash', 'the entity comes with its lasting name');
  assert.equal(of('question.flash')[0].tower.label, 'Ruch');
  assert.ok(of('flow.preview').some((f) => f.weight === 'must'), 'an error of a flow (an empty flow) is a must');
  assert.deepEqual(report.findings.map((f) => f.weight), [...report.findings.map((f) => f.weight)].sort((a, b) => ['must', 'should', 'info'].indexOf(a) - ['must', 'should', 'info'].indexOf(b)), 'must first, then should, then info');
  assert.equal(report.counts.must + report.counts.should + report.counts.info, report.findings.length);
  assert.equal(report.codes.reduce((n, c) => n + c.count, 0), report.findings.length);
  ok('flash and flow errors are "must"; findings carry the entity (lasting name), its tower and path; ordered must → should → info; counts add up');

  assert.ok(of('question.untaught').some((f) => f.entity.name === '@w2/qt3') && !of('question.untaught').some((f) => ['@w2/qa', '@w2/v1'].includes(f.entity.name)), 'only the question whose tower no slide teaches');
  assert.deepEqual(of('question.noTower').map((f) => f.entity.name), ['@w2/qnic']);
  assert.ok(of('question.noFeedback').some((f) => f.entity.name === '@w2/qa') && !of('question.noFeedback').some((f) => f.entity.name === '@w2/v1'), 'feedback per option counted');
  ok('questions: untaught only where no slide teaches the tower or what it requires; belonging to no tower; options without feedback');

  const towersOf = (code) => of(code).map((f) => f.tower?.label);
  assert.ok(towersOf('tower.noCore').includes('Ruch') && !towersOf('tower.noCore').includes('Prędkość'), 'a tower with a core question is fine');
  assert.deepEqual(of('question.classInTower').map((f) => [f.entity.name, f.tower?.label]), [['@w2/klasa', 'Prędkość']], 'a class question (use lesson) in a tower is a finding; one without a tower is fine');
  assert.ok(!codes.has('tower.fewVote'), 'towers need no vote questions any more (2026-11-26)');
  const t2 = lib.byImportRef('w2/t2', 'entity').id;
  const klasa = lib.byImportRef('w2/klasa', 'entity').id;
  const mapIn = m.worldInputOf(lib, cards, {});
  assert.ok(!mapIn.cards.some((c) => c.question === klasa) && mapIn.cards.some((c) => c.about.includes(t2)), 'the map takes no lesson-only question into a tower');
  assert.deepEqual(towersOf('tower.longestCorrect'), ['Ruch']);
  assert.deepEqual(towersOf('tower.positions'), ['Ruch']);
  ok('towers: key question, the correct option longest too often and always at the same position; class questions stay out of towers');

  assert.deepEqual(of('slide.long').map((f) => f.entity.name), ['@w2/sdlugi']);
  const path = of('path.severalTowers')[0];
  assert.ok(path.message.includes('Ruch') && path.message.includes('Prędkość') && path.path.name === '@w2/f1', path.message);
  assert.equal(of('path.slidesInRow')[0].step, 's1');
  assert.equal(of('path.questionsInRow')[0].step, 'qa');
  assert.ok(of('path.longClosing')[0].message.includes('5'), of('path.longClosing')[0].message);
  assert.ok(of('line.ticket')[0].message.includes('Prędkość') && of('line.ticket')[0].tower.label === 'Ruch', of('line.ticket')[0].message);
  assert.equal(of('fork.labelLong')[0].step, 'ch');
  assert.equal(of('fork.hintLong').length, 1);
  assert.ok(!of('flow.preview').some((f) => f.message.includes('Bardzo długa nazwa') && /(32|100)/.test(f.message)), `the preview's own sentence about the fork is not repeated: ${of('flow.preview').map((f) => f.message).join(' | ')}`);
  ok('paths: two towers on one path, 4 slides and 3 questions in a row (with the step), a closing block of 5, a ticket beyond the first tower, a long fork label and hint');

  assert.ok(of('mistakeTag.noHelp')[0].message.includes('myli-predkosc') && of('mistakeTag.noHelp')[0].path.name === '@w2/f1');
  assert.ok(of('mistakeTag.nearDuplicate')[0].message.includes('myli-predkosc') && of('mistakeTag.nearDuplicate')[0].message.includes('myli-predkosci'));
  assert.ok(!of('mistakeTag.nearDuplicate').some((f) => f.message.includes('blad-a') && f.message.includes('blad-b')), '„blad-a" and „blad-b" are different errors');
  assert.ok(of('tag.nearDuplicate')[0].message.includes('Optyka') && of('tag.nearDuplicate')[0].message.includes('Optyki'));
  assert.ok(of('tag.usedOnce').some((f) => f.message.includes('Mechanika')));
  ok('tags: error tags without help in the path, near duplicates (not different letters), map tags used once and near duplicates');

  const fb = of('feedback.open');
  assert.equal(fb.length, 1, 'one open item (the done one does not count)');
  assert.ok(fb[0].weight === 'should' && fb[0].entity.name === '@w2/qflash' && fb[0].message.includes('wrong'.slice(0, 0)), fb[0].message);
  assert.equal(of('levels.standard')[0].weight, 'info');
  ok('open feedback per entry (done items do not count); the conquest levels differ from the standard — info only');

  /* Die Stufen nach dem Standard: kein Befund. */
  await lib.saveSettings({ levelsSetup: { levels: 2, rules: [{ pct: 75, attempts: 'any' }, { pct: 90, attempts: 'one' }], knownShare: 1, openAt: 1 } });
  const after = m.worldChecks(lib, { cards: (await lib.cards()).cards });
  assert.equal(after.findings.filter((f) => f.code === 'levels.standard').length, 0);
  ok('the two-level standard (75 % any, 90 % one correction, paths from level 1) gives no finding');

  /* -- 2. Im Dienst: dieselbe Rechnung aus der Abschrift -------------------------------------------------------------------- */
  const named = m.nameIn(lib);
  const snapshot = {
    library: lib.libraryId, name: 'Świat do kontroli', madeAt: '2026-11-22T10:00:00Z',
    kinds: lib.kinds.filter((k) => !k.id.startsWith('~') && !['question', 'work', 'person'].includes(k.id)).map((k) => ({ id: k.id, name: k.name })),
    entries: lib.entities().filter((e) => lib.isOwn(e.id)).map((e) => ({ id: e.id, kind: e.kinds[0], kinds: e.kinds, ...(typeof lib.entry(e.id)?.data._ref === 'string' ? { ref: lib.entry(e.id).data._ref } : {}), data: Object.fromEntries(Object.entries(e.data).filter(([k]) => !k.startsWith('_'))) })),
    setup: { course: (await m.exportSetup(lib, 'Świat do kontroli')).course, feedback: m.feedbackForAi(lib, named) }
  };
  const { bundle } = await import(pathToFileURL(join(process.cwd(), 'scripts/import-check-bundle.mjs')).href);
  const fresh = await bundle();
  const ctx = vm.createContext({});
  vm.runInContext('delete globalThis.Intl;', ctx);
  vm.runInContext(fresh.js, ctx);
  const locales = JSON.parse(fresh.locales);
  const t0 = Date.now();
  /* Alle drei Sprachen (wie der Dienst für diese Kontrolle): die Worte der Folien kommen in der Sprache der Baza (`slideLint.ts`). */
  const viaServer = JSON.parse(await ctx.recreatioWorldChecks(JSON.stringify({ base: snapshot, lang: 'en' }), JSON.stringify(locales)));
  const ms = Date.now() - t0;
  assert.equal(viaServer.restored.missing, 0, 'every kind and document of the snapshot got its id back');
  const key = (f) => `${f.code}|${f.weight}|${f.entity?.name ?? ''}|${f.step ?? ''}`;
  const here = after.findings.map(key).sort();
  const there = viaServer.findings.map(key).sort();
  assert.deepEqual(there, here, 'the server finds the same as the app');
  assert.deepEqual(viaServer.findings.map((f) => f.message).sort(), after.findings.map((f) => f.message).sort(), 'with the same words');
  ok(`the server bundle (bare JavaScript, like Jint) restores the base from its AI snapshot — with its feedback — and finds exactly the same (${viaServer.findings.length} findings, ${ms} ms)`);

  /* -- 3. Die Hilfen ---------------------------------------------------------------------------------------------------------- */
  assert.equal(m.wordCount('Ala ma kota, a [[kot|@w2/t1]] ma Alę. [@kowalski2020, s. 4] $E = mc^2$'), 8, 'a formula is one word');
  assert.equal(m.wordCount('Tekst\n```chart\nbar\n| a | 1 |\n```\nkoniec'), 2, 'a fenced graphic does not count');
  assert.deepEqual([m.nearSame('narrator', 'narratora'), m.nearSame('myli-narratora-z-autorem', 'myli-narrator-z-autorem'), m.nearSame('blad-a', 'blad-b'), m.nearSame('Optyka', 'optyka'), m.nearSame('zle-jednostki', 'zle-jednostki'), m.nearSame('kot', 'kota')], [true, true, false, true, false, false]);
  ok('helpers: words of a slide (links by their word, citations and graphics not), near-duplicate tags (another form, not other letters, not short words)');
} finally {
  await rm(workspace, { recursive: true, force: true });
}
console.log(`\n${passed} passed, 0 failed`);
