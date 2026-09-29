/**
 * Die Wege im Menü, nachgemessen.
 *
 * Zwei Dinge, die falsch sein können, ohne dass es auffällt: ein relativer
 * Pfad, der eine Ebene zu tief landet, und eine Hervorhebung, die auf der
 * falschen Zeile sitzt — oder auf gar keiner. Beides sieht auf einem Bild
 * richtig aus und wird nicht gemeldet; hier steht deshalb, was gelten soll.
 *
 * Seit 0056 steht dasselbe Menü auf vielen Seiten. Damit ist der häufige Fall
 * nicht mehr „diese Seite hat einen eigenen Eintrag", sondern „diese Seite
 * liegt unter einem" — genau das wird hier geprüft.
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-menu-'));
await build({
  entryPoints: ['src/app/menuPath.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: workspace,
  logLevel: 'error'
});

const m = await import(pathToFileURL(join(workspace, 'menuPath.js')).href);

let failed = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log(`ok   ${name}`);
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

const item = (label, kind, target, children = []) => ({ label, kind, target, children });

/* ── Relative Pfade: von der Seite, die das Menü trägt ────────────────────── */

check('a step down', m.joinPath('parish/grzegorzki', 'oaza'), 'parish/grzegorzki/oaza');
check('a dot stays put', m.joinPath('parish/grzegorzki', './oaza'), 'parish/grzegorzki/oaza');
check('two dots go up', m.joinPath('parish/grzegorzki', '../kontakt'), 'parish/kontakt');
check('two dots alone are the page above', m.joinPath('parish/grzegorzki', '../'), 'parish');
check('it does not climb past the root', m.joinPath('parish', '../../../oaza'), 'oaza');
check('several steps at once', m.joinPath('parish', 'oaza/terminy'), 'parish/oaza/terminy');

check('an absolute target is itself', m.registryPath(item('X', 'abs', '/parish/oaza/'), 'anything'), 'parish/oaza');
check('an outside address has no page', m.registryPath(item('X', 'url', 'https://example.org'), 'parish'), null);
check('a bare roof has no page', m.registryPath(item('X', 'none', ''), 'parish'), null);

/* ── Wo man ist ───────────────────────────────────────────────────────────── */

const menu = [
  item('Start', 'abs', ''),
  item('Parafia', 'rel', './', [
    item('Kontakt', 'rel', 'kontakt'),
    item('Oaza', 'rel', 'oaza')
  ]),
  item('Zewnętrzne', 'url', 'https://example.org')
];
const from = 'parish';
const spot = (here) => m.hereIn(menu, from, here);

check('the page with its own entry is the one marked', spot('parish/oaza'), { at: '1.1', exact: true });
check('and its roof is not a second mark', spot('parish/kontakt'), { at: '1.0', exact: true });
check('the page that carries the menu', spot('parish'), { at: '1', exact: true });
check('the start page', spot(''), { at: '0', exact: true });

/*
   Der Fall, um den es geht: eine Seite, die im Menü gar nicht steht. Sie liegt
   unter „Oaza", also ist „Oaza" markiert — sonst leuchtete nichts, und das
   Menü sagte auf halbem Weg nicht mehr, wo man ist.
*/
check('a page below an entry marks that entry', spot('parish/oaza/terminy'), { at: '1.1', exact: false });
check('deeper still, the same entry', spot('parish/oaza/terminy/2026'), { at: '1.1', exact: false });

/* Der NÄCHSTE Abschnitt gewinnt, nicht der oberste. */
check('the nearest section wins over the wider one', spot('parish/kontakt/mapa'), { at: '1.0', exact: false });

/*
   Die Wurzel ist der Anfang jedes Pfades. Zählte sie als Abschnitt, wäre
   „Start" überall markiert — dann sagte die Hervorhebung nichts mehr.
*/
check('the start page is not the section of everything', spot('parish/oaza'), { at: '1.1', exact: true });
check('a page outside the menu marks nothing', m.hereIn(menu, from, 'lo13/klasy'), null);

/* Ein halber Name ist kein Abschnitt: „parish/oazana" liegt nicht unter „oaza". */
check('a longer name is not a section', m.hereIn([item('Oaza', 'abs', 'parish/oaza')], from, 'parish/oazanka'), null);

/* Genau schlägt Abschnitt, auch wenn der Abschnitt weiter unten im Baum steht. */
const both = [item('Oaza', 'abs', 'parish/oaza'), item('Terminy', 'abs', 'parish/oaza/terminy')];
check('an exact entry beats a section, wherever it stands',
  m.hereIn(both, from, 'parish/oaza/terminy'), { at: '1', exact: true });

/* ── Das Dach über der Stelle ─────────────────────────────────────────────── */

check('the roof of the marked entry', m.under('1', '1.1'), true);
check('a neighbour is not a roof', m.under('0', '1.1'), false);
check('the entry itself is not its own roof', m.under('1.1', '1.1'), false);

await rm(workspace, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
