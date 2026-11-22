/**
 * 2026-11-22 — EINE KLASSE AUS EINER BAZA, rein gerechnet (`cogita/classes/classModel.ts`), ohne Browser und ohne Dienst:
 *   1. welche Bereiche Klassen sind (eine gemerkte Baza `base-<id>`), ihre Uczniowie, ihr Code zum Beitreten, nur die einer Baza;
 *   2. die Adresse des QR-Codes und wie die Seite sie liest (Klasse und Baza, nur gültige Kennungen);
 *   3. was die kleine Werkstatt zeigen darf (Nauka, Klasse, Sprache/Wygląd/Bezpieczeństwo) — alles andere führt zurück.
 *
 *   node scripts/app-class-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-class-'));
await build({
  entryPoints: { model: 'src/app/cogita/classes/classModel.ts' }, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error'
});
const M = await import(pathToFileURL(join(workspace, 'model.js')).href);

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const LIB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const key = (kind, k, refId = null, refText = null) => ({ kind, key: k, refId, refText });

/* -- 1. Klassen aus den Schlüsseln der Bereiche ------------------------------------------------------------------------ */
{
  const areas = [
    { areaId: A, name: '3b fizyka', keys: [key('library', `base-${LIB}`, LIB, 'Fizyka'), key('role', 'students', 'r1', 'Uczniowie'), key('link', 'class-join', 'inv1')] },
    { areaId: B, name: '2a', keys: [key('library', `base-${OTHER}`, OTHER, 'Chemia'), key('role', 'students', 'r2')] },
    { areaId: 'c', name: 'Parafia', keys: [key('role', 'participants', 'r3')] }
  ];
  const all = M.classesIn(areas);
  check('a class is an area that remembers a base (the parish without one is no class); sorted by name', all.map((c) => c.name), ['2a', '3b fizyka']);
  check('a class carries its base, its students role and its join code', [all[1].bases, all[1].studentsRoleId, all[1].joinInvitationId], [[{ libraryId: LIB, name: 'Fizyka' }], 'r1', 'inv1']);
  check('a class without a join code (joining closed, or a course) — no code', all[0].joinInvitationId, null);
  check('only the classes of one base (any letter case)', M.classesIn(areas, LIB.toUpperCase()).map((c) => c.areaId), [A]);
}

/* -- 2. Die Adresse des QR-Codes -------------------------------------------------------------------------------------- */
{
  check('the QR code opens the class and its base (lower case)', M.classAim(A.toUpperCase(), LIB), `workspace/klasa/${A}/${LIB}`);
  check('the page reads class and base back', M.classIdOf([A, LIB]), { areaId: A, libraryId: LIB });
  check('an address without the base, or with no id, is no class', [M.classIdOf([A]), M.classIdOf(['x', LIB]), M.classIdOf([])], [null, null, null]);
}

/* -- 3. Die kleine Werkstatt ------------------------------------------------------------------------------------------ */
{
  check('learning, its bases and the class are allowed', [M.learnShellAllows('learn', []), M.learnShellAllows('learn', [LIB, 'postepy']), M.learnShellAllows('klasa', [A, LIB])], [true, true, true]);
  check('language, appearance and security of the account are allowed', ['jezyk', 'wyglad', 'bezpieczenstwo'].map((s) => M.learnShellAllows('account', [s])), [true, true, true]);
  check('everything else of the workspace is not (areas, pages, forms, transfer of data, AI access)', [M.learnShellAllows('areas', []), M.learnShellAllows('pages', []), M.learnShellAllows('forms', []), M.learnShellAllows('account', ['przeniesienie']), M.learnShellAllows('account', ['dostep-ai'])], [false, false, false, false, false]);
  check('the choice of the shell: only "learn" is the small one', [M.readShell('learn'), M.readShell('full'), M.readShell(null), M.readShell('x')], ['learn', 'full', 'full', 'full']);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
