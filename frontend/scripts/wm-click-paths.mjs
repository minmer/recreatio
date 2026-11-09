/**
 * 2026-11-09 — DIE WELTKARTE, TEIL 5: DIE KLICKPFADE (spec §13) — in der Vorschau (`preview.html`: die echte App, die Baza im
 * Speicher, ein Lernender ohne Fortschritt, nichts wird gespeichert), mit echten Mausklicks über das DevTools-Protokoll:
 * <code>
 *   1  Haus → ein Abschnitt mit Schloss → seine Quellen → direkt lernen → das Schloss ist fort
 *   2  ein Umsteigeort mit 3 Zweigen → einen wählen (der Spieler steht im gewählten Zweig)
 *   3  Navigation zu einem Ort mit 3 fehlenden Voraussetzungen, unterwegs eine Abzweigung gewählt
 *   4  die Breite der Säulen stufenlos — gezeichnet, nicht neu gerechnet
 *   5  (dazu) eine Stufe einstellen, die Karten lernen, einen Durchgang bestehen → erobert
 *   6  (dazu, wie im Krajobraz) die Ansichten, „Sprawdź, co wiesz" → Luki, das Abspielen und „Pokaż zmiany", das Ziel, die
 *      Liste der Orte, Portale (Schreibende), „Animacje: wyłączone"
 * </code>
 * Vorher: die Vorschau bauen und bedienen, die Kurse schreiben —
 *
 *   npx vite build --outDir <dist> && npx vite preview --outDir <dist> --port 4791
 *   node scripts/wm-courses.mjs <kurse>
 *   node scripts/wm-click-paths.mjs http://localhost:4791 <kurse>/fixture.json <bilder> [1,2,3,4,5]
 *
 * Schreibt je Pfad Bilder und `click-paths.json`; scheitert (Ausgang 1), wenn ein Pfad nicht ankommt.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Browser } from '../mcp/cdp.mjs';

const [base, coursePath, outDir, onlyArg] = process.argv.slice(2);
/* Nur bestimmte Pfade: `1,3` (sonst alle). */
const only = onlyArg === undefined ? null : new Set(onlyArg.split(','));
const runs = (n) => only === null || only.has(n);
if (base === undefined || coursePath === undefined || outDir === undefined) {
  console.error('usage: node scripts/wm-click-paths.mjs <preview-origin> <fixture.json> <out-dir>');
  process.exit(2);
}
await mkdir(outDir, { recursive: true });
const doc = await readFile(coursePath, 'utf8');
const VIEW = '@wmfx/view/world';
/* Die Testwelt (wmFixtures.ts, Gestalt Bosko): Namen, wie die Karte sie zeigt. */
const N = {
  domkos: 'Dom i kościół (1850–1852)',
  cagrua: 'Cagliero, Rua i konwikt studentów',
  comollo: 'Comollo: przyjaźń i śmierć',
  becchi: 'Dom w Becchi bez ojca',
  magone: 'Michał Magone (1857–1859)',
  warsz: 'Pół tuzina warsztatów',
  savioPlace: 'Dominik Savio',
  savio: 'Z Dominikiem Savio'
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let failed = 0;
const check = (path, name, ok, detail = undefined) => {
  results.push({ path, name, ok, ...(detail === undefined ? {} : { detail }) });
  if (ok) console.log(`ok   [${path}] ${name}`); else { failed += 1; console.error(`FAIL [${path}] ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`); }
};

const browser = await Browser.launch();
try {
  const page = await browser.newPage({ width: 1440, height: 1000 });
  const ev = (expr) => page.evaluate(expr);
  const waitFor = async (expr, what, ms = 30000) => {
    const t0 = Date.now();
    for (;;) {
      if (await ev(`Boolean(${expr})`)) return Date.now() - t0;
      if (Date.now() - t0 > ms) throw new Error(`waited ${ms} ms for ${what}`);
      await sleep(80);
    }
  };
  const shot = async (name) => writeFile(join(outDir, `${name}.webp`), await page.screenshot({ format: 'webp', quality: 82 }));
  const clickAt = async (x, y) => {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  };
  /** Ein Ort, das Haus oder ein Abschnitt — dort, wo die Karte ihn wirklich trifft. */
  const clickMap = async (kind, id) => {
    const at = await ev(`(() => { const c = document.querySelector('[data-world-canvas]'); const p = c?.wmLocate?.(${JSON.stringify(kind)}, ${JSON.stringify(id)}); if (!p) return null; const r = c.getBoundingClientRect(); return [r.left + p[0], r.top + p[1]]; })()`);
    if (at === null) throw new Error(`not on the map: ${kind} ${id}`);
    await clickAt(at[0], at[1]);
  };
  const click = async (selector) => {
    const ok = await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`);
    if (!ok) throw new Error(`no element ${selector}`);
  };
  const ready = `(() => { const h = document.querySelector('[data-world-geometry]'); const c = document.querySelector('[data-world-canvas]'); return h && h.dataset.worldGeometry !== 'pending' && c && Number(c.dataset.wmFrame || 0) > 0; })()`;
  const open = async (progress = 'none', author = false) => {
    await page.navigate(`${base}/preview.html?lang=pl`);
    await waitFor('typeof window.recreatioPreview === "object"', 'the preview');
    const r = await ev(`window.recreatioPreview.knowledge({ doc: ${doc}, view: ${JSON.stringify(VIEW)}, progress: ${JSON.stringify(progress)}, author: ${author} }).then((x) => ({ error: x.error ?? null }))`);
    if (r.error !== null) throw new Error(r.error);
    await waitFor(ready, 'the world map', 60000);
    await sleep(300);
  };
  /** Alle Karten eines Laufs richtig („Tak"), bis er endet. */
  const answerAll = async (endSelector, max = 80) => {
    let n = 0;
    for (; n < max; n += 1) {
      if (await ev(`document.querySelector(${JSON.stringify(endSelector)}) !== null`)) break;
      const picked = await ev(`(() => { const b = [...document.querySelectorAll('.cg-options [role=radio]')].find((x) => x.textContent.trim() === 'Tak' && !x.disabled); if (!b) return false; b.click(); return true; })()`);
      if (!picked) { await sleep(120); continue; }
      await waitFor(`document.querySelector('[data-card-next]') !== null || document.querySelector(${JSON.stringify(endSelector)}) !== null`, 'next card', 10000);
      if (await ev(`document.querySelector('[data-card-next]') !== null`)) await click('[data-card-next]');
      await sleep(60);
    }
    return n;
  };

  /* -- 1 · Haus → Abschnitt mit Schloss → Quellen → direkt lernen → Schloss fort ------------------------------------------- */
  if (runs('1')) {
    const P = '1 lock';
    await open();
    await clickMap('home', '~home');
    await waitFor(`document.querySelector('[data-world-panel="home"]')`, 'the home panel');
    check(P, 'Home opens its panel with the lines that start there', await ev(`document.querySelectorAll('[data-world-panel="home"] [data-world-direction]').length`) >= 1);
    await shot('p1-home');
    const lane = (await ev(`document.querySelector('[data-world-canvas]').wmLanes()`)).find((l) => l.state === 'locked' && l.from === N.domkos && l.to === N.cagrua);
    check(P, 'the map shows a locked section (domkos → cagrua)', lane !== undefined);
    await clickMap('lane', lane.section);
    await waitFor(`document.querySelector('[data-world-panel="section"][data-world-section="${lane.section}"]')`, 'the section panel');
    const sec = await ev(`(() => { const p = document.querySelector('[data-world-panel="section"]'); return { ticket: p.dataset.worldTicket, conditions: [...p.querySelectorAll('[data-world-condition]')].map((x) => x.dataset.worldCondition), sources: [...p.querySelectorAll('[data-world-source]')].map((x) => ({ source: x.dataset.worldSource === 'direct' ? 'direct' : 'section', cards: Number(x.dataset.worldSourceCards), open: x.dataset.worldSourceOpen ?? null })), learn: Number(p.querySelector('[data-world-learn-direct]')?.dataset.worldLearnDirect ?? 0), travel: p.querySelector('[data-world-travel]')?.disabled }; })()`);
    check(P, 'the section panel shows the missing ticket', sec.ticket === 'missing' && sec.conditions.includes('knowledge'), sec);
    check(P, 'the ticket names the sources: a line that introduces cards, and cards with no slide', sec.sources.some((s) => s.source === 'section') && sec.sources.some((s) => s.source === 'direct'), sec.sources);
    check(P, 'travel is disabled while the ticket is missing', sec.travel === true);
    await shot('p1-section-locked');
    await click('[data-world-learn-direct]');
    await waitFor(`document.querySelector('[data-world-running="learn"]')`, 'learning directly');
    const answered = await answerAll('[data-run-end]');
    check(P, `learn directly asks the missing cards (${answered} answered)`, answered >= sec.learn, { answered, missing: sec.learn });
    await shot('p1-learn-end');
    await click('[data-world-back]');
    await waitFor(ready, 'the map again');
    await waitFor(`document.querySelector('[data-world-panel="section"]')?.dataset.worldTicket === 'met'`, 'the ticket to be met', 10000);
    const after = (await ev(`document.querySelector('[data-world-canvas]').wmLanes()`)).find((l) => l.section === lane.section);
    check(P, 'the lock is gone: the ticket is valid and the lane is open', after?.state === 'open', after);
    check(P, 'travel is now possible', await ev(`document.querySelector('[data-world-travel]')?.disabled === false`));
    await shot('p1-lock-gone');
  }

  /* -- 2 · Umsteigeort mit 3 Zweigen → einen wählen ------------------------------------------------------------------------ */
  if (runs('2')) {
    const P = '2 station';
    await open();
    await clickMap('label', N.domkos);
    await waitFor(`document.querySelector('[data-world-panel="place"] [data-world-station]')`, 'the station panel');
    const rows = await ev(`[...document.querySelectorAll('[data-world-station] [data-world-direction]')].map((r) => ({ id: r.dataset.worldDirection, branch: r.dataset.worldDirectionBranch, text: r.textContent, choose: r.querySelector('[data-world-choose]') !== null, tag: r.querySelector('[data-world-tag]')?.dataset.worldTag ?? '' }))`);
    const branches = rows.filter((r) => r.branch !== '');
    check(P, 'the station lists the 3 branches of the story that splits here', new Set(branches.map((r) => r.branch)).size === 3, branches.map((r) => r.text));
    check(P, 'each direction shows its ticket (open branches can be chosen, a locked one cannot)', branches.some((r) => r.choose) && branches.some((r) => !r.choose && r.tag === 'locked'), branches.map((r) => [r.tag, r.choose]));
    await shot('p2-station');
    const pick = branches.find((r) => r.text.includes(N.savio));
    await click(`[data-world-choose="${pick.id}"]`);
    await waitFor(`document.querySelector('[data-world-running="story"] [data-flow-running]')`, 'the story player');
    await sleep(400);
    const at = await ev(`(() => { const s = document.querySelector('[data-world-running="story"] [data-flow-running]'); return { step: s?.dataset.flowStep ?? null, locked: document.querySelector('[data-flow-locked]') !== null }; })()`);
    check(P, 'the player opens in the chosen branch (its first slide)', at.step === 'sh11' && !at.locked, at);
    await shot('p2-branch-open');
  }

  /* -- 3 · Navigation zu einem Ort mit 3 fehlenden Voraussetzungen, eine Abzweigung unterwegs ----------------------------- */
  if (runs('3')) {
    const P = '3 navigate';
    await open();
    /* Der Lernende kennt die Grundlagen: alles vor Magone ausser drei Orten (Dom i kościół, Dominik Savio, Pół tuzina warsztatów). */
    const openTarget = async () => {
      await click('[data-world-fit]');
      await sleep(300);
      await clickMap('label', N.magone);
      await waitFor(`document.querySelector('[data-world-panel="place"] [data-world-order]')`, 'the place panel of the target');
    };
    await openTarget();
    const keep = new Set([N.domkos, N.savioPlace, N.warsz]);
    let learned = 0;
    for (let guard = 0; guard < 20; guard += 1) {
      const shown = await ev(`[...document.querySelectorAll('[data-world-order-item]')].map((li) => ({ id: li.dataset.worldOrderItem, name: li.querySelector('.cg-ref').textContent }))`);
      const item = shown.find((o) => !keep.has(o.name));
      if (item === undefined) break;
      /* Aus der Reihenfolge der Eroberung: den Ort zeigen, seine Karten direkt lernen. */
      await click(`[data-world-order-item="${item.id}"] .cg-ref`);
      await waitFor(`document.querySelector('[data-world-panel="place"][data-world-place="${item.id}"] [data-world-learn-direct]')`, `the panel of ${item.name}`);
      await click(`[data-world-panel="place"] [data-world-learn-direct]`);
      await waitFor(`document.querySelector('[data-world-running="learn"]')`, 'learning directly');
      learned += await answerAll('[data-run-end]', 60);
      await click('[data-world-back]');
      await waitFor(ready, 'the map again');
      await openTarget();
    }
    const order = await ev(`({ count: Number(document.querySelector('[data-world-order]').dataset.worldOrder), names: [...document.querySelectorAll('[data-world-order-item]')].map((li) => li.querySelector('.cg-ref').textContent) })`);
    check(P, `the target has 3 missing prerequisites (after learning ${learned} cards of the others)`, order.count === 3 && order.names.length === 3 && order.names.every((x) => keep.has(x)), order);
    await click('[data-world-panel="place"] [data-world-lead]');
    await waitFor(`document.querySelector('[data-world-panel="nav"]')`, 'the navigation panel');
    const before = await ev(`(() => { const p = document.querySelector('[data-world-panel="nav"]'); return { steps: Number(p.dataset.worldNavSteps), done: Number(p.dataset.worldNavDone), stops: [...p.querySelectorAll('[data-world-stop]')].map((s, i) => ({ i, key: s.dataset.worldStop, state: s.dataset.worldStopState, turns: Number(s.querySelector('[data-world-turns]')?.dataset.worldTurns ?? 0) })) }; })()`);
    check(P, 'the timetable lists every step, the current one first', before.steps >= 6 && before.stops[0].state === 'current', { steps: before.steps, stops: before.stops.map((s) => s.key) });
    const turnAt = before.stops.find((s) => s.turns > 0);
    check(P, 'a branch option is offered on the way', turnAt !== undefined && turnAt.i > 0, before.stops.map((s) => `${s.key}:${s.turns}`));
    await shot('p3-nav');
    await ev(`(() => { const s = document.querySelector('[data-world-stop="${turnAt.key}"] [data-world-turns]'); s.open = true; s.scrollIntoView({ block: 'center' }); return true; })()`);
    const alt = await ev(`document.querySelector('[data-world-stop="${turnAt.key}"] [data-world-turn-choose]').dataset.worldTurnChoose`);
    await shot('p3-turns');
    await click(`[data-world-stop="${turnAt.key}"] [data-world-turn-choose]`);
    await waitFor(`document.querySelectorAll('[data-world-stop]')[${turnAt.i}]?.dataset.worldStop === 'travel:${alt}' && document.querySelector('[data-world-stop="${turnAt.key}"]') === null`, 'the route to be recomputed from that stop');
    const afterNav = await ev(`(() => { const p = document.querySelector('[data-world-panel="nav"]'); return { steps: Number(p.dataset.worldNavSteps), done: Number(p.dataset.worldNavDone), target: p.dataset.worldNavTarget, stops: [...p.querySelectorAll('[data-world-stop]')].map((s) => s.dataset.worldStop) }; })()`);
    check(P, 'choosing the option recomputes the route from that stop (nothing marked done)', afterNav.done === 0 && afterNav.stops.slice(0, turnAt.i).join() === before.stops.slice(0, turnAt.i).map((s) => s.key).join(), { turned: turnAt.key, to: alt, ...afterNav });
    check(P, 'the map shows the route: start pennant, target flag', await ev(`document.querySelector('[data-world-view]').dataset.worldNav !== ''`));
    await shot('p3-turned');
    /* Die Navigation hält in der Sitzung: eine Erzählung öffnen und zurück. */
    await click('[data-world-nav-go]');
    await waitFor(`document.querySelector('[data-world-running]')`, 'the current step to start');
    const kind = await ev(`document.querySelector('[data-world-running]').dataset.worldRunning`);
    if (kind === 'story') await click('[data-flow-close]');
    else await click('[data-world-back]');
    await waitFor(`document.querySelector('[data-world-panel="nav"]')`, 'the navigation to be still there', 15000).catch(() => null);
    check(P, `the navigation persists within the session (after "${kind}")`, await ev(`document.querySelector('[data-world-panel="nav"]') !== null`));
  }

  /* -- 4 · Breite der Säulen: stufenlos, ohne neu zu rechnen ---------------------------------------------------------------- */
  if (runs('4')) {
    const P = '4 pillar';
    await open();
    const geo0 = await ev(`(() => { const h = document.querySelector('[data-world-geometry]'); return { version: h.dataset.worldGeometry, runs: Number(h.dataset.worldGeometryRuns) }; })()`);
    const steps = await ev(`(async () => {
      const slider = document.querySelector('[data-pillar-slider]');
      const cv = document.querySelector('[data-world-canvas]');
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const out = [];
      for (let w = 98; w >= 40; w -= 2) {
        const f0 = Number(cv.dataset.wmFrame);
        const t0 = performance.now();
        set.call(slider, String(w));
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        await frame();
        out.push({ w, pillar: Number(cv.dataset.wmPillar), radius: Number(cv.dataset.wmRadius), drawn: Number(cv.dataset.wmFrame) > f0, ms: performance.now() - t0, draw: Number(cv.dataset.wmMs) });
      }
      return out;
    })()`);
    const geo1 = await ev(`(() => { const h = document.querySelector('[data-world-geometry]'); return { version: h.dataset.worldGeometry, runs: Number(h.dataset.worldGeometryRuns) }; })()`);
    check(P, `every one of ${steps.length} slider positions is drawn at once`, steps.every((s) => s.drawn && Math.abs(s.pillar * 100 - s.w) < 0.01), steps.filter((s) => !s.drawn || Math.abs(s.pillar * 100 - s.w) >= 0.01));
    check(P, 'the drawn radius shrinks continuously', steps.every((s, i) => i === 0 || s.radius < steps[i - 1].radius), steps.map((s) => s.radius));
    check(P, 'positions and tracks are not recomputed (same geometry, no new layout)', geo0.version === geo1.version && geo0.runs === geo1.runs, { geo0, geo1 });
    const ms = steps.map((s) => s.draw).sort((a, b) => a - b);
    results.push({ path: P, name: 'timing', ok: true, detail: { drawMedianMs: ms[Math.floor(ms.length / 2)], drawMaxMs: ms[ms.length - 1] } });
    await shot('p4-pillar-40');
  }

  /* -- 5 · (dazu) eine Stufe, direkt lernen, ein Durchgang → erobert --------------------------------------------------------- */
  if (runs('5')) {
    const P = '5 run';
    await open();
    await clickMap('label', N.becchi);
    await waitFor(`document.querySelector('[data-world-panel="place"]')`, 'the place panel');
    await click('[data-world-my-settings]');
    await waitFor(`document.querySelector('[data-levels-n="1"]')`, 'my settings');
    await click('[data-levels-n="1"]');
    await waitFor(`document.querySelector('[data-world-panel="place"]')?.dataset.worldGate === 'locked'`, 'one level in force');
    check(P, 'with one level the place waits for its cards (run locked)', true);
    await click('[data-world-panel="place"] [data-world-learn-direct]');
    await waitFor(`document.querySelector('[data-world-running="learn"]')`, 'learning directly');
    await answerAll('[data-run-end]');
    await click('[data-world-back]');
    await waitFor(`document.querySelector('[data-world-panel="place"]')?.dataset.worldGate === 'ready'`, 'the run to be possible', 15000);
    await shot('p5-run-ready');
    await click('[data-world-run-for="1"]');
    await waitFor(`document.querySelector('[data-world-run-start]')`, 'the run intro');
    await click('[data-world-run-start]');
    await answerAll('[data-world-run="result"]');
    const res = await ev(`(() => { const r = document.querySelector('[data-world-run="result"]'); return r === null ? null : { level: Number(r.dataset.worldRunLevel), reached: r.dataset.worldRunReached }; })()`);
    check(P, 'the run reaches level 1', res !== null && res.level === 1 && res.reached === '1', res);
    await shot('p5-run-result');
    await click('[data-world-run-close]');
    await waitFor(`document.querySelector('[data-world-panel="place"]')?.dataset.worldConquered === '1'`, 'the place to be conquered', 15000);
    check(P, 'the place is conquered (flat, full colour, knowledge dot)', true);
    await shot('p5-conquered');
  }

  /* -- 6 · Wie im Krajobraz: Ansichten, „Sprawdź, co wiesz" → Luki, Abspielen, das Ziel, Portale, die Liste der Orte ------------- */
  if (runs('6')) {
    const P = '6 hex features';
    const canvas = (key) => ev(`document.querySelector('[data-world-canvas]')?.dataset.${key} ?? null`);
    await open();
    check(P, 'the first visit plays the columns rising', await canvas('wmPlayedKind') === 'first');
    const modes = await ev(`[...document.querySelectorAll('[data-world-mode]')].map((b) => b.dataset.worldMode)`);
    check(P, 'the mode bar: Ogólny, Co umiem, Do odkrycia, Do powtórki, Luki — and "Sprawdź, co wiesz"', modes.join() === 'all,known,discover,due,gaps' && await ev(`document.querySelector('[data-world-selfcheck]') !== null`), modes);
    const litOf = async (m) => { await click(`[data-world-mode="${m}"]`); await sleep(250); return canvas('wmLit'); };
    const known = await litOf('known');
    const discover = await litOf('discover');
    const due = await litOf('due');
    const dueNote = await ev(`document.querySelector('[data-world-note="due"]') !== null`);
    check(P, 'a new learner: "Co umiem" nothing, "Do odkrycia" the places without prerequisites, "Do powtórki" nothing (with its note)', known === '0' && Number(discover) > 0 && due === '0' && dueNote, { known, discover, due, dueNote });
    await litOf('discover');
    await shot('p6-mode-discover');
    const all = await litOf('all');
    check(P, '"Ogólny" — every place in colour again', all === '');
    /* Sprawdź, co wiesz: die erste Kernfrage falsch, die anderen richtig — eine Lücke. */
    await click('[data-world-selfcheck]');
    await waitFor(`document.querySelector('[data-world-running="check"]')`, 'the self-check');
    let first = true;
    for (let n = 0; n < 80; n += 1) {
      if (await ev(`document.querySelector('[data-run-end]') !== null`)) break;
      const want = first ? 'Nie' : 'Tak';
      const picked = await ev(`(() => { const b = [...document.querySelectorAll('.cg-options [role=radio]')].find((x) => x.textContent.trim() === ${JSON.stringify(want)} && !x.disabled); if (!b) return false; b.click(); return true; })()`);
      if (!picked) { await sleep(120); continue; }
      first = false;
      await waitFor(`document.querySelector('[data-card-next]') !== null || document.querySelector('[data-run-end]') !== null`, 'next card', 10000);
      if (await ev(`document.querySelector('[data-card-next]') !== null`)) await click('[data-card-next]');
      await sleep(60);
    }
    await click('[data-world-back]');
    await waitFor(ready, 'the map after the self-check');
    await waitFor(`document.querySelector('[data-world-note="gaps"]')`, 'the gaps note');
    const gaps = await ev(`({ gaps: Number(document.querySelector('[data-world-note="gaps"]').dataset.worldGaps), fill: document.querySelector('[data-world-fill]') !== null, mode: document.querySelector('[data-world-modes]').dataset.worldModes })`);
    await sleep(200);
    const gapsLit = await canvas('wmLit');
    check(P, 'after the self-check: mode "Luki" with one gap in colour and "Uzupełnij luki"', gaps.mode === 'gaps' && gaps.gaps === 1 && gaps.fill && gapsLit === '1', { ...gaps, gapsLit });
    check(P, 'coming back plays what changed since the map was last seen (return)', await canvas('wmPlayedKind') === 'return', await canvas('wmPlayedKind'));
    await shot('p6-gaps');
    await waitFor(`document.querySelector('[data-world-replay]')`, '"Pokaż zmiany"', 8000);
    await click('[data-world-replay]');
    await sleep(120);
    check(P, '"Pokaż zmiany" plays it again', (await canvas('wmPlaying')) !== '', await canvas('wmPlaying'));
    await click('[data-world-mode="all"]');
    /* Das Ziel: am Ort setzen — eine Fahne, die Zeile oben mit den Schritten; zurücknehmen. */
    await click('[data-world-fit]');
    await sleep(300);
    await clickMap('label', N.magone);
    await waitFor(`document.querySelector('[data-world-goal-set]')`, 'the goal button');
    const magone = await ev(`document.querySelector('[data-world-panel="place"]').dataset.worldPlace`);
    await click('[data-world-goal-set]');
    await waitFor(`document.querySelector('[data-world-goal]')`, 'the goal line');
    await sleep(250);
    const g = await ev(`({ goal: document.querySelector('[data-world-goal]').dataset.worldGoal, steps: Number(document.querySelector('[data-world-goal]').dataset.worldGoalSteps), resign: document.querySelector('[data-world-goal-resign]') !== null })`);
    check(P, '"Ustaw jako cel": the goal line with its steps, a flag on the map, "Zrezygnuj" in the panel', g.goal === magone && g.steps > 1 && (await canvas('wmGoal')) === magone && g.resign, g);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
    await ev('window.scrollTo(0, 0)');
    await sleep(300);
    await shot('p6-goal');
    await click('[data-world-goal-clear]');
    await waitFor(`document.querySelector('[data-world-goal]') === null`, 'the goal to go');
    check(P, 'clearing the goal removes the line and the flag', (await canvas('wmGoal')) === '');
    /* Die Liste aller Orte (Tastatur): öffnen, einen wählen. */
    await ev(`(() => { const d = document.querySelector('[data-world-list]'); d.open = true; d.dispatchEvent(new Event('toggle')); d.scrollIntoView({ block: 'center' }); return true; })()`);
    await waitFor(`document.querySelectorAll('[data-world-list-place]').length > 0`, 'the list of places');
    const rows = await ev(`document.querySelectorAll('[data-world-list-place]').length`);
    const placesN = Number(await ev(`document.querySelector('[data-world-view]').dataset.worldPlaces`));
    const pickId = await ev(`document.querySelectorAll('[data-world-list-place]')[3].dataset.worldListPlace`);
    await click(`[data-world-list-place="${pickId}"] .cg-ref`);
    await waitFor(`document.querySelector('[data-world-panel="place"][data-world-place="${pickId}"]')`, 'the place from the list');
    check(P, 'the list of places: every place, and a row opens its panel (no mouse needed)', rows === placesN, { rows, placesN });
    await shot('p6-list');
    /* Portale: wer schreibt, sieht jeden Verweis in andere Welten (der Lernende nur, was er dort lesen kann). */
    check(P, 'a learner sees no portal to a world he cannot read', (await canvas('wmPortals')) === '0');
    await open('none', true);
    const portals = await canvas('wmPortals');
    /* Über die Liste gewählt: die Kamera fliegt hin (nah genug für das Zeichen und den Namen). */
    await ev(`(() => { const d = document.querySelector('[data-world-list]'); d.open = true; d.dispatchEvent(new Event('toggle')); return true; })()`);
    await waitFor(`document.querySelectorAll('[data-world-list-place]').length > 0`, 'the list of places');
    const comolloId = await ev(`[...document.querySelectorAll('[data-world-list-place]')].find((li) => li.textContent.includes(${JSON.stringify(N.comollo)}))?.dataset.worldListPlace ?? null`);
    await click(`[data-world-list-place="${comolloId}"] .cg-ref`);
    await waitFor(`document.querySelector('[data-world-panel="place"] [data-worlds]')`, 'the worlds section');
    check(P, 'a writer sees the portal on the pillar and the link in the place panel', portals === '1', { portals });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
    await ev('window.scrollTo(0, 0)');
    await sleep(400);
    await shot('p6-portal');
    /* „Animacje: wyłączone": nichts bewegt sich. */
    await ev(`localStorage.setItem('rc-motion', 'off')`);
    await open();
    check(P, 'with motion off the change is shown at once (no animation)', (await canvas('wmPlayedMs')) === '0' && (await canvas('wmPlaying')) === '');
    await ev(`localStorage.removeItem('rc-motion')`);
    results.push({ path: P, name: 'names hidden behind nearer pillars (this view)', ok: true, detail: { covered: Number(await canvas('wmCovered')) } });
  }

  const errors = page.console.filter((c) => c.level === 'exception' || c.level === 'error');
  check('all', 'no exceptions in the page', errors.filter((c) => c.level === 'exception').length === 0, errors.slice(0, 5));
} finally {
  await writeFile(join(outDir, 'click-paths.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(`\n${results.filter((r) => r.ok).length} ok, ${failed} failed`);
if (failed > 0) process.exit(1);
