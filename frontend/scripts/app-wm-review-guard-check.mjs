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

/*
  Step 3 §2.5 — JEDE STELLE, nicht nur jede Datei: in den Dateien, die die Regel fragen müssen, steht bei jedem Aufruf eines
  Einstiegs (±WINDOW Zeilen) die Regel oder ihr Bereich (reviewable / mayReview / reviewScope / scope / review: true) — sonst
  kann eine Datei an einer Stelle fragen und an einer anderen eine ungefilterte Liste bauen. Ausnahmen je Stelle, mit Grund.
*/
const WINDOW = 12;
const SITE_RULE = /\breviewable\b|\bmayReview\b|\breviewScope\b|\bscope\b|\breview:\s*true\b/;
const SITE_OK = {
  /* Datei → Muster der Zeile mit dem Aufruf → [Grund, Beleg: ein Muster, das in der Datei stehen muss]. */
  'cogita/revision.ts': {
    '\\beligible\\(': ['eligible() leaves out s.fixed.blocked, which is built from reviewable() when the session starts', /const open = \(c: Card\) => !s\.fixed\.blocked\.has\(c\.key\);[\s\S]*if \(input\.review != null\) for \(const k of byKey\.keys\(\)\) if \(!reviewable\(k, input\.review\)/],
    '\\bspacerFor\\(': ['spacerFor() skips s.fixed.blocked (built from reviewable())', /function spacerFor[\s\S]{0,400}!s\.fixed\.blocked\.has\(k\)/]
  },
  'cogita/LandscapeView.tsx': {
    '\\bdueCards\\b': ['dueCards is filtered with mayReview where it is built', /const dueCards = useMemo\(\(\) => \{[\s\S]{0,500}!mayReview\(c\.key, reviewScope\)/],
    'revisionContext\\(': ['planFrom practises chosen topics — learning, not a regular review', /const planFrom = async \(graph: Graph\)/]
  }
};
function uncoveredSites(text) {
  const lines = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1').split('\n');
  const out = [];
  lines.forEach((line, i) => {
    if (!ENTRY.some((re) => re.test(line))) return;
    if (/^\s*(export\s+)?(async\s+)?function\b|^\s*export\s+const\b/.test(line)) return; /* eine Definition, kein Aufruf */
    const win = lines.slice(Math.max(0, i - WINDOW), i + WINDOW + 1).join('\n');
    if (!SITE_RULE.test(win)) out.push({ line: i + 1, full: line, text: line.trim().slice(0, 90) });
  });
  return out;
}
/* Selbstprüfung: eine Datei, die an einer Stelle fragt und an einer anderen nicht — die Prüfung je Datei sah das nicht. */
{
  const sample = ['const a = cards.filter((c) => reviewable(c.key, scope));', 'const x = dueAt(a);', ...Array(30).fill('// …'), 'const y = dueAt(cards);'].join('\n');
  const found = uncoveredSites(sample).map((s) => s.line);
  if (found.length === 1 && found[0] === 33) ok('Step 3 §2.5: a call site without the rule is found even when the file asks elsewhere');
  else fail('Step 3 §2.5: a call site without the rule is found even when the file asks elsewhere', `found ${JSON.stringify(found)}`);
}
for (const rel of REQUIRED) {
  const text = await readFile(join(ROOT, rel), 'utf8');
  for (const [pat, [why, proof]] of Object.entries(SITE_OK[rel] ?? {})) {
    if (proof.test(text)) ok(`Step 3 §2.5: ${rel} — sites matching ${pat} exempt: ${why}`);
    else fail(`Step 3 §2.5: ${rel} — exemption for ${pat} no longer holds`, why);
  }
  const bad = uncoveredSites(text).filter((s) => !Object.keys(SITE_OK[rel] ?? {}).some((pat) => new RegExp(pat).test(s.full)));
  if (bad.length === 0) ok(`Step 3 §2.5: every call site in ${rel} asks the rule`);
  else fail(`Step 3 §2.5: every call site in ${rel} asks the rule`, bad.map((s) => `${rel}:${s.line} ${s.text}`).join('\n  '));
}

/* Step 3 §2.4 — die schwachen Zeichen der Sechsecke (LandscapeView) zählen nur Karten, die wiederholt werden dürfen. */
{
  const lv = await readFile(join(ROOT, 'cogita/LandscapeView.tsx'), 'utf8');
  if (/const reviewable = useMemo\(\(\) => new Set\(\[\.\.\.fp\.keys\(\)\]\.filter\(\(k\) => mayReview\(k, reviewScope\)\)\)/.test(lv)) ok('Step 3 §2.4: LandscapeView passes only reviewable cards to the weak marks');
  else fail('Step 3 §2.4: LandscapeView passes only reviewable cards to the weak marks', 'landscapeState gets every card as reviewable');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
