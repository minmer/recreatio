/**
 * 2026-11-09 — DIE WELTKARTE, KORREKTUR 5: EINE REGEL FÜR ALLE WIEDERHOLUNGEN. `reviewable(card, scope)` steht einmal in
 * `cogita/worldmap/wmState.ts`; jede Stelle, die eine Wiederholung baut oder fällige Karten zählt, fragt dort. Diese Prüfung
 * sucht die bekannten Einstiege (dueAt, lockCards, reportDue, eligible, spacerFor, dueCards, revisionContext) und schlägt
 * fehl, wenn eine Datei sie benutzt, ohne die Regel zu fragen — ausser sie steht unten mit Grund als Ausnahme.
 *
 *   node scripts/app-wm-review-guard-check.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../src/app/', import.meta.url));

/** Was eine Wiederholung baut oder fällige Karten zählt. */
const ENTRY = [/\bdueAt\(/, /\blockCards\(/, /\breportDue\(/, /\beligible\(/, /\bspacerFor\(/, /\bdueCards\b/, /\brevisionContext\(/];

/** Fragt die Regel: importiert `reviewable` aus der Weltkarte — oder reicht einen Lauf als Wiederholung weiter (`review: true`). */
const covered = (text) => /import\s*\{[^}]*\breviewable\b[^}]*\}\s*from\s*'[^']*worldmap\/wmState'/.test(text) || /\breview:\s*true\b/.test(text);

/** Die Stellen, die die Regel fragen müssen (Bericht §5a). */
const REQUIRED = [
  'cogita/revision.ts', 'cogita/RevisionRun.tsx', 'cogita/LandscapeView.tsx', 'cogita/CogitaHome.tsx', 'pages/parts/cogitaViews.tsx',
  'cogita/QuiltView.tsx', 'cogita/storyLock.ts', 'cogita/learn.ts'
];

/** Einstiege, die bewusst nicht filtern — mit Grund. */
const ALLOWED = {
  'cogita/knowness.ts': 'defines dueAt',
  'cogita/landscapeData.ts': 'defines lockCards',
  'cogita/store.ts': 'defines revisionContext',
  'cogita/landscapeWords.ts': 'words only (the key dueCards)',
  'cogita/measures.ts': 'statistics, not a review list',
  'cogita/SessionSummary.tsx': 'the summary of a finished run',
  'cogita/LearnView.tsx': 'due rows from the service (counted by reportDue)',
  'cogita/RunClosing.tsx': 'what a finished run unlocked (readiness), not a review list',
  'cogita/PathLearn.tsx': 'learning along the path — learning is not a regular review',
  'cogita/worldmap/wmState.ts': 'defines reviewable',
  'cogita/worldmap/wmReview.ts': 'the scope of the rule itself: reportDueFor passes reviewScopeFor into reportDue (Step 3 · 3)'
};

async function* files(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.|\.d\.ts$/.test(e.name)) yield p;
  }
}

let failed = 0;
let passed = 0;
const ok = (name) => { passed += 1; console.log(`ok   ${name}`); };
const fail = (name, why) => { failed += 1; console.error(`FAIL ${name}\n  ${why}`); };

const seen = new Map();
let definitions = 0;
for await (const p of files(ROOT)) {
  const rel = relative(ROOT, p).replace(/\\/g, '/');
  const text = await readFile(p, 'utf8');
  if (/export function reviewable\(/.test(text)) definitions += 1;
  /* Kommentare zählen nicht (eine Beschreibung ist keine Stelle). */
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  if (!ENTRY.some((re) => re.test(code))) continue;
  seen.set(rel, covered(text));
}

if (definitions === 1) ok('reviewable is defined once (worldmap/wmState.ts)'); else fail('reviewable is defined once', `found ${definitions} definitions`);
for (const rel of REQUIRED) {
  if (!seen.has(rel)) { fail(`${rel} still builds reviews`, 'no entry point found — update REQUIRED'); continue; }
  if (seen.get(rel)) ok(`${rel} asks reviewable`); else fail(`${rel} asks reviewable`, 'builds a review list or a due count without reviewable()');
}
for (const [rel, uses] of seen) {
  if (REQUIRED.includes(rel)) continue;
  if (ALLOWED[rel] !== undefined) { ok(`${rel}: exempt — ${ALLOWED[rel]}`); continue; }
  if (uses) ok(`${rel} asks reviewable`);
  else fail(`${rel}: a new review or due-count site`, 'uses dueAt/lockCards/reportDue/eligible/spacerFor/dueCards/revisionContext without reviewable() from cogita/worldmap/wmState — call it, or add the file to ALLOWED with a reason');
}
for (const rel of Object.keys(ALLOWED)) if (!seen.has(rel) && rel !== 'cogita/worldmap/wmState.ts') fail(`exemption ${rel} is stale`, 'the file no longer uses an entry point — remove it from ALLOWED');

/* Step 3 §2.4 — die schwachen Zeichen der Sechsecke (LandscapeView) zählen nur Karten, die wiederholt werden dürfen. */
{
  const lv = await readFile(join(ROOT, 'cogita/LandscapeView.tsx'), 'utf8');
  if (/const reviewable = useMemo\(\(\) => new Set\(\[\.\.\.fp\.keys\(\)\]\.filter\(\(k\) => mayReview\(k, reviewScope\)\)\)/.test(lv)) ok('Step 3 §2.4: LandscapeView passes only reviewable cards to the weak marks');
  else fail('Step 3 §2.4: LandscapeView passes only reviewable cards to the weak marks', 'landscapeState gets every card as reviewable');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
