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
  sen: 'Sen dziewięciolatka',
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
      /* 2026-11-14 — ein Turm zeigt zuerst seine Knöpfe; das Feld mit allem Weiteren öffnet „⋯“. */
      if (/data-world-panel="(place|home|section|junction|sign)"|data-world-path-list|data-world-path-open|data-world-junction|data-world-ticket|data-world-travel/.test(expr)) await ev(`(() => { if (document.querySelector('[data-world-side]') === null) document.querySelector('[data-world-tower-more]')?.click(); return true; })()`);
      if (Date.now() - t0 > ms) { await writeFile(join(outDir, "timeout.webp"), await page.screenshot({ format: "webp", quality: 82 })).catch(() => undefined); throw new Error(`waited ${ms} ms for ${what}`); }
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
    /* 2026-11-14 — die Knöpfe über einem gewählten Turm (und der Knopf des Schrittes) liegen über der Karte: für den Klick auf die Karte durchlässig. */
    await ev(`(() => { document.querySelectorAll('[data-world-tower-actions], [data-world-start-btn]').forEach((e) => { e.style.pointerEvents = 'none'; }); return true; })()`);
    const locate = () => ev(`(() => { const c = document.querySelector('[data-world-canvas]'); const p = c?.wmLocate?.(${JSON.stringify(kind)}, ${JSON.stringify(id)}); if (!p) return null; const r = c.getBoundingClientRect(); return [r.left + p[0], r.top + p[1]]; })()`);
    /* Erst, wenn die Stelle stillsteht (eine Bildlaufleiste, die eben erscheint, verschiebt die Leinwand um ein paar Punkte). */
    let at = await locate();
    for (let i = 0; i < 50; i += 1) {
      await sleep(120);
      const again = await locate();
      if (at !== null && again !== null && Math.abs(again[0] - at[0]) < 0.5 && Math.abs(again[1] - at[1]) < 0.5) break;
      at = again;
    }
    /* Nicht im Bild: einmal die ganze Welt zeigen, dann noch einmal suchen. */
    if (at === null) {
      await ev(`document.querySelector('[data-world-fit]')?.click()`);
      await sleep(500);
      at = await locate();
    }
    /* 2026-11-10 — jede Prüfung legt die Welt neu an (neue Kennungen, andere Lage): verdeckt ein Turm die Stelle, die Karte drehen. */
    for (let turn = 0; turn < 3 && at === null; turn += 1) {
      await ev(`document.querySelector('[data-world-canvas]').wmTurn(90)`);
      await sleep(400);
      at = await locate();
    }
    if (at === null) { await writeFile(join(outDir, "timeout.webp"), await page.screenshot({ format: "webp", quality: 82 })).catch(() => undefined); throw new Error(`not on the map: ${kind} ${id}`); }
    await clickAt(at[0], at[1]);
  };
  const click = async (selector) => {
    const ok = await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`);
    if (!ok) throw new Error(`no element ${selector}`);
  };
  /* Nach einem Teil mit Navigation steht erst der Weg da (2026-11-10): „Wróć do mapy" führt zur Karte. */
  const ready = `(() => { const back = document.querySelector('[data-world-next-page] [data-world-next-map]'); if (back) back.click(); const h = document.querySelector('[data-world-geometry]'); const c = document.querySelector('[data-world-canvas]'); return h && h.dataset.worldGeometry !== 'pending' && c && Number(c.dataset.wmFrame || 0) > 0; })()`;
  const open = async (progress = 'none', author = false, query = '') => {
    await page.navigate(`${base}/preview.html?lang=pl${query}`);
    await waitFor('typeof window.recreatioPreview === "object"', 'the preview');
    const r = await ev(`window.recreatioPreview.knowledge({ doc: ${doc}, view: ${JSON.stringify(VIEW)}, progress: ${JSON.stringify(progress)}, author: ${author} }).then((x) => ({ error: x.error ?? null }))`);
    if (r.error !== null) throw new Error(r.error);
    await waitFor(ready, 'the world map', 60000);
    await sleep(300);
    /* 2026-11-14 — beim ersten Mal beginnt der Rundgang von selbst: die Pfade (ausser 14) schliessen ihn. */
    if (!keepTour) { await sleep(400); await ev(`(() => { document.querySelector('[data-world-tour-close], [data-world-tour-done]')?.click(); return true; })()`); await sleep(200); }
  };
  let keepTour = false;
  /** 2026-11-10 — nach einem Teil: die Folie mit seinen Zahlen schliessen (wenn sie kommt), dann steht der Weg unten auf der Karte. */
  const afterPart = async () => {
    await waitFor(`document.querySelector('[data-world-running]') === null`, 'the part to end', 15000);
    await sleep(400);
    if (await ev(`document.querySelector('[data-world-finish]') !== null`)) await click('[data-world-finish-close]');
    await waitFor(`document.querySelector('[data-world-finish]') === null`, 'the statistics slide to close', 10000);
  };
  /** 2026-11-14 — „Zacznij“ (unten oder über dem Turm) öffnet die Tafel des Schrittes in der Mitte; ihr „Start“ beginnt ihn. */
  const startStep = async (via = '[data-world-next-go]') => {
    await click(via);
    await waitFor(`document.querySelector('[data-world-sheet] [data-world-sheet-start]')`, 'the step sheet in the middle of the map');
    await click('[data-world-sheet-start]');
  };
  /** Die Karte des Weges offen, mit allen Teilen (der Fahrplan mit seinen Abzweigungen). */
  const wayOpen = async () => {
    if (await ev(`document.querySelector('[data-world-way-open]') !== null`)) await click('[data-world-way-open]');
    await waitFor(`document.querySelector('[data-world-next-page] [data-world-panel="nav"]')`, 'the way at the bottom of the map', 15000);
    await ev(`(() => { const d = document.querySelector('[data-world-all-parts]'); if (d) d.open = true; return true; })()`);
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

  /*
    -- 1 · Haus → ein gesperrter Zweig nach einer Gabelung → woher seine Karten kommen -----------------------------------------
    2026-11-10 (Eigentümer) — die Gabelung ist ein eigener Knoten; direkt lernen nur, was keine Erzählung erreicht.
  */
  if (runs('1')) {
    const P = '1 lock';
    await open();
    await clickMap('home', '~home');
    await sleep(500);
    await shot('p1-home-buttons');
    await waitFor(`document.querySelector('[data-world-panel="home"]')`, 'the home panel');
    check(P, 'Home opens its panel with the lines that start there', await ev(`document.querySelectorAll('[data-world-panel="home"] [data-world-direction]').length`) >= 1);
    await shot('p1-home');
    const lane = (await ev(`document.querySelector('[data-world-canvas]').wmLanes()`)).find((l) => l.state === 'locked' && l.symbol !== 'place' && l.from.startsWith('~j:') && l.to === N.cagrua);
    check(P, 'the map shows the locked branch from the fork node (fork → cagrua)', lane !== undefined);
    const nodes = await ev(`document.querySelector('[data-world-canvas]').wmJunctionList()`);
    check(P, 'the fork is a node of its own on the map, with 3 ways', nodes.some((j) => j.id === lane.from && j.kind === 'fork' && j.ways === 3), nodes);
    /* 2026-11-11 — keine Namen auf der Karte; ein Pfad unter der Maus zeigt seine Beschreibung und leuchtet dezent. */
    check(P, 'path names are not printed on the map', (await ev(`document.querySelector('[data-world-canvas]').dataset.wmPathNames`)) === '0');
    const lp = await ev(`(() => { const c = document.querySelector('[data-world-canvas]'); const p = c.wmLocate('lane', ${JSON.stringify(lane.section)}); if (!p) return null; const r = c.getBoundingClientRect(); return [r.left + p[0], r.top + p[1]]; })()`);
    if (lp !== null) {
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: lp[0], y: lp[1] });
      await waitFor(`document.querySelector('[data-world-lane-bubble]') !== null && document.querySelector('[data-world-canvas]').dataset.wmHoverLane !== ''`, 'the description of the path', 5000).catch(() => null);
      check(P, 'hovering a path shows its description and highlights it', await ev(`document.querySelector('[data-world-lane-bubble]')?.dataset.worldLaneBubble === ${JSON.stringify(lane.section)} && document.querySelector('[data-world-canvas]').dataset.wmHoverLane === ${JSON.stringify(lane.section)}`));
      await shot('p1-lane-hover');
    }
    await clickMap('lane', lane.section);
    await waitFor(`document.querySelector('[data-world-panel="section"][data-world-section="${lane.section}"]')`, 'the section panel');
    const sec = await ev(`(() => { const p = document.querySelector('[data-world-panel="section"]'); return { ticket: p.dataset.worldTicket, conditions: [...p.querySelectorAll('[data-world-condition]')].map((x) => x.dataset.worldCondition), sources: [...p.querySelectorAll('[data-world-source]')].map((x) => ({ source: x.dataset.worldSource === 'direct' ? 'direct' : 'section', cards: Number(x.dataset.worldSourceCards), open: x.dataset.worldSourceOpen ?? null })), learn: Number(p.querySelector('[data-world-learn-direct]')?.dataset.worldLearnDirect ?? 0), travel: p.querySelector('[data-world-travel]')?.disabled, lead: p.querySelector('[data-world-lead]') !== null }; })()`);
    check(P, 'the section panel shows the missing ticket', sec.ticket === 'missing' && sec.conditions.includes('knowledge'), sec);
    check(P, 'its cards come from a story (a line explains them), so nothing is offered to learn directly', sec.sources.some((x) => x.source === 'section') && !sec.sources.some((x) => x.source === 'direct') && sec.learn === 0, sec);
    /* 2026-11-12 (Eigentümer: „nur ein Knopf") — ohne Fahrkarte kein „Odkryj", stattdessen „Prowadź mnie tutaj". */
    check(P, 'no "Odkryj" while the ticket is missing — "Prowadź mnie tutaj" instead', sec.travel === undefined && sec.lead, sec);
    await shot('p1-section-locked');
  }

  /* -- 2 · Eine Gabelung mit 3 Wegen (ein eigener Knoten) → einen wählen ----------------------------------------------------- */
  if (runs('2')) {
    const P = '2 fork';
    await open();
    const J = (await ev(`document.querySelector('[data-world-canvas]').wmJunctionList()`)).find((j) => j.kind === 'fork' && j.ways === 3);
    check(P, 'a fork node with 3 ways is on the map', J !== undefined);
    await clickMap('junction', J.id);
    await waitFor(`document.querySelector('[data-world-panel="junction"]')`, 'the fork panel');
    const ways = await ev(`[...document.querySelectorAll('[data-world-junction-way]')].map((r) => ({ id: r.dataset.worldJunctionWay, text: r.textContent, choose: r.querySelector('[data-world-choose]') !== null, tag: r.querySelector('[data-world-tag]')?.dataset.worldTag ?? '' }))`);
    check(P, 'the fork panel lists its 3 ways (target, slides, questions)', ways.length === 3, ways.map((w) => w.text));
    check(P, 'the node says what lies before it and how many ways leave it', (await ev(`document.querySelector('[data-world-junction-says]')?.textContent ?? ''`)).length > 0);
    await shot('p2-fork');
    if (!ways.some((w) => w.choose)) {
      check(P, 'the tower before the fork is not conquered: every way waits for it, none can be chosen', ways.every((w) => !w.choose && w.tag === 'closed'), ways.map((w) => [w.tag, w.choose]));
    } else {
      check(P, 'each way shows its ticket (open ones can be chosen, a locked one cannot)', ways.some((w) => w.choose) && ways.some((w) => !w.choose && w.tag === 'locked'), ways.map((w) => [w.tag, w.choose]));
      const pick = ways.find((w) => w.text.includes(N.savio));
      await click(`[data-world-choose="${pick.id}"]`);
      await waitFor(`document.querySelector('[data-world-running="story"] [data-flow-running]')`, 'the story player');
      await sleep(400);
      const at = await ev(`(() => { const s = document.querySelector('[data-world-running="story"] [data-flow-running]'); return { step: s?.dataset.flowStep ?? null, locked: document.querySelector('[data-flow-locked]') !== null }; })()`);
      check(P, 'the player opens in the chosen branch (its first slide)', at.step === 'sh11' && !at.locked, at);
      await shot('p2-branch-open');
      /* 2026-11-11 — zurück zur Wahl („Wstecz"): eine andere Möglichkeit ist wieder wählbar und führt in ihren Weg. */
      for (let i = 0; i < 8 && !(await ev(`document.querySelector('[data-flow-past-option]:not([disabled]):not(.is-chosen)') !== null`)); i += 1) {
        if (!(await ev(`(() => { const b = document.querySelector('[data-flow-back]'); if (!b) return false; b.click(); return true; })()`))) break;
        await sleep(200);
      }
      const other = await ev(`document.querySelector('[data-flow-past-option]:not([disabled]):not(.is-chosen)')?.dataset.flowPastOption ?? null`);
      check(P, 'looking back at a past choice: another path can be chosen', other !== null, other);
      if (other !== null) {
        await click(`[data-flow-past-option="${other}"]`);
        await sleep(400);
        const now = await ev(`(() => { const s = document.querySelector('[data-world-running="story"] [data-flow-running]:not(.is-behind)'); return { step: s?.dataset.flowStep ?? null, past: document.querySelector('[data-flow-past]') !== null }; })()`);
        check(P, '… choosing it goes into that path (a second path of the same story)', now.step !== null && now.step !== 'sh11' && !now.past, now);
        await shot('p2-rechoose');
      }
    }
  }

  /* -- 3 · Navigation zu einem Ort mit 3 fehlenden Voraussetzungen, eine Abzweigung unterwegs ----------------------------- */
  if (runs('3')) {
    const P = '3 navigate';
    await open();
    /* Der Lernende kennt die Grundlagen: alles vor Magone ausser drei Orten (Dom i kościół, Dominik Savio, Pół tuzina warsztatów). */
    const openTarget = async () => {
      /* Erst, wenn „Pokaż zmiany" (die Kamera fliegt zu Eroberten) zu Ende gespielt ist — sonst nähme es „Cały świat" zurück. */
      await sleep(300);
      await waitFor(`(document.querySelector('[data-world-canvas]')?.dataset.wmPlaying ?? '') === ''`, 'the playback to end', 20000);
      await click('[data-world-fit]');
      await sleep(300);
      await clickMap('label', N.magone);
      await waitFor(`document.querySelector('[data-world-panel="place"] [data-world-order]')`, 'the place panel of the target');
    };
    await openTarget();
    /* 2026-11-10 — jede fehlende Voraussetzung (auch mittelbar) steht in der Reihenfolge der Eroberung; der Weg führt der Reihe nach hin. */
    const order = await ev(`({ count: Number(document.querySelector('[data-world-order]').dataset.worldOrder), names: [...document.querySelectorAll('[data-world-order-item]')].map((li) => li.querySelector('.cg-ref').textContent), required: Number(document.querySelector('[data-world-required]')?.dataset.worldRequired ?? 0) })`);
    check(P, `the target lists its missing prerequisites in order (${order.count}), the panel names each with open / locked`, order.count >= 3 && order.required >= 3 && [N.domkos, N.savioPlace, N.warsz].every((x) => order.names.includes(x) || order.count > 6), order);
    /*
      2026-11-14 (Eigentümer: „die Seite sagt, was sie tut: so viele Schritte; dann die Ansage des ersten Schrittes — beginnen oder
      überspringen") — „Prowadź mnie tutaj" zeigt zuerst die Karte des Weges: „N Schritte führen zu …", „Schritt 1 von N".
    */
    await click('[data-world-tower-actions] [data-world-lead]');
    await waitFor(`document.querySelector('[data-world-next-page] [data-world-announce="1"]')`, 'the announcement of the first step');
    const intro = await ev(`({ intro: Number(document.querySelector('[data-world-way-intro]')?.dataset.worldWayIntro ?? 0), running: document.querySelector('[data-world-running]') !== null, go: document.querySelector('[data-world-next-go]') !== null, skip: document.querySelector('[data-world-next-page] [data-world-next-view]')?.dataset.worldNextView ?? null, goal: document.querySelector('[data-world-goal]')?.dataset.worldGoal ?? null })`);
    check(P, `"take me there" says how many steps lead to the target (${intro.intro}) and announces step 1 — nothing starts by itself`, intro.intro >= 3 && !intro.running && intro.go && intro.skip !== null, intro);
    check(P, 'the target becomes the goal', intro.goal !== null && intro.goal !== '', intro);
    await shot('p3-announce');
    /* 2026-11-14 (Eigentümer) — „Zakończ“ auf derselben Höhe wie die Knöpfe über dem Schritt (auch auf der ganzen Seite). */
    const rowOf = () => ev(`(() => { const a = document.querySelector('[data-world-next-stop]')?.getBoundingClientRect(); const b = document.querySelector('[data-world-next-go]')?.getBoundingClientRect(); return a && b ? { stop: Math.round(a.top + a.height / 2), go: Math.round(b.top + b.height / 2) } : null; })()`);
    const row1 = await rowOf();
    await click('[data-world-full="page"]');
    await sleep(900);
    const row2 = await rowOf();
    await shot('p3-row-page');
    await ev(`(() => { document.querySelector('[data-world-fulltab="exit"]')?.click(); return true; })()`);
    await sleep(600);
    check(P, '"Zakończ" stands on the same height as the button above the step (in the page and on the whole page)', row1 !== null && row2 !== null && Math.abs(row1.stop - row1.go) <= 1 && Math.abs(row2.stop - row2.go) <= 1, { row1, row2 });
    /* Überspringen (auch gegen die Regeln): der Schritt ist vorbei (↷ in der Kette), die Ansage geht zu Schritt 2. */
    /* 2026-11-14 — überspringen in der Tafel des Schrittes (die Leiste hat nur „Weiter“ und „Beenden“). */
    await click('[data-world-next-go]');
    await waitFor(`document.querySelector('[data-world-sheet-skip]')`, 'the step sheet');
    await click('[data-world-sheet-skip]');
    await waitFor(`document.querySelector('[data-world-step-skipped="${intro.skip}"]') && document.querySelector('[data-world-announce="2"]')`, 'the skipped step and the announcement of step 2');
    check(P, 'skipping marks the step ↷ in the chain and announces the next one', await ev(`document.querySelector('[data-world-way-part="${intro.skip}"]')?.dataset.worldWayState === 'skipped'`));
    await shot('p3-skipped');
    /* Mitten im Schritt: oben „Schritt 2 von N" mit „Pomiń" — der Schritt endet gleich, ohne Tafel. */
    await startStep();
    await waitFor(`document.querySelector('[data-world-running]') && document.querySelector('[data-world-part-skip]')`, 'the running step with its banner');
    const midKey = await ev(`document.querySelector('[data-world-part-skip]').dataset.worldPartSkip`);
    check(P, `the running step shows "step 2 of N" with a skip button (${midKey})`, await ev(`document.querySelector('[data-world-part]')?.dataset.worldPart === '2'`));
    await shot('p3-banner');
    await click('[data-world-part-skip]');
    await waitFor(`document.querySelector('[data-world-running]') === null && document.querySelector('[data-world-step-skipped="${midKey}"]') && document.querySelector('[data-world-announce="3"]')`, 'step 3 announced after skipping mid-step');
    check(P, 'skipping mid-step ends it without the statistics slide', await ev(`document.querySelector('[data-world-finish]') === null`));
    /* 2026-11-14 (Eigentümer) — ein Schritt der Leiste angeklickt: „Przejdź tutaj“ oder „Pomiń“; übersprungen wird er grau. */
    const nowKey = await ev(`document.querySelector('[data-world-next-page] [data-world-next-view]')?.dataset.worldNextView ?? ''`);
    const later = await ev(`[...document.querySelectorAll('[data-world-next-page] [data-world-way-part]')].filter((x) => x.dataset.worldWayState === 'next')[1]?.dataset.worldWayPart ?? null`);
    await click(`[data-world-next-page] [data-world-way-show="${later}"]`);
    await waitFor(`document.querySelector('[data-world-picked-skip]')`, 'the menu of the picked step');
    check(P, 'a picked step offers "go here" and "skip"', await ev(`document.querySelector('[data-world-picked-go]') !== null`));
    await click('[data-world-picked-skip]');
    await waitFor(`document.querySelector('[data-world-way-part="${later}"]')?.dataset.worldWayState === 'skipped'`, 'the picked step to be skipped');
    check(P, 'skipping a picked step greys it out (the current step stays)', (await ev(`document.querySelector('[data-world-next-page] [data-world-next-view]')?.dataset.worldNextView ?? ''`)) === nowKey);
    /* 2026-11-14 (Eigentümer) — ein übersprungener Schritt bleibt an seinem Platz (grau) und lässt sich zurückholen. */
    const placeOf = (key) => ev(`[...document.querySelectorAll('[data-world-next-page] [data-world-way-part]')].findIndex((x) => x.dataset.worldWayPart === ${JSON.stringify(key)})`);
    const placeSkipped = await placeOf(later);
    await click(`[data-world-next-page] [data-world-way-show="${later}"]`);
    await waitFor(`document.querySelector('[data-world-picked-restore]')`, 'the restore button above the skipped step');
    await click('[data-world-picked-restore]');
    await waitFor(`document.querySelector('[data-world-way-part="${later}"]')?.dataset.worldWayState === 'next'`, 'the step to be open again');
    check(P, 'a skipped step stays in its place and can be restored there', placeSkipped >= 0 && (await placeOf(later)) === placeSkipped, { placeSkipped, now: await placeOf(later) });
    /* 2026-11-14 — über dem Turm des Schrittes fliegt „Zacznij tutaj“; er öffnet die Tafel des Schrittes (ein Satz, was getan wird). */
    await waitFor(`(() => { const b = document.querySelector('[data-world-start-btn]'); return b !== null && !b.hidden && b.getBoundingClientRect().width > 0; })()`, 'the start button above the tower', 10000);
    await click('[data-world-start-btn]');
    await waitFor(`document.querySelector('[data-world-sheet] [data-world-sheet-start]')`, 'the step sheet');
    const sheet = await ev(`(() => { const x = document.querySelector('[data-world-sheet]'); return { n: x.querySelector('.cg-wm-annnum')?.textContent ?? '', about: x.querySelector('.cg-wm-sheetabout')?.textContent ?? '', buttons: x.querySelectorAll('.cg-wm-sheetbtns button').length }; })()`);
    check(P, 'the start button above the tower opens the step sheet in the middle: step n of m, one sentence what is done, Start / Skip', sheet.n !== '' && sheet.about.length > 10 && sheet.buttons >= 2, sheet);
    await shot('p3-sheet');
    await click('[data-world-sheet-start]');
    await waitFor(`document.querySelector('[data-world-running]')`, 'step 3 to start');
    const firstKind = await ev(`document.querySelector('[data-world-running]').dataset.worldRunning`);
    check(P, `"Start" begins the announced step (${firstKind})`, ['story', 'learn', 'run', 'review'].includes(firstKind), firstKind);
    if (firstKind === 'story') await click('[data-flow-close]'); else await click('[data-world-back]');
    /* 2026-11-10 — nach jedem Teil: die Karte, unten der Weg (Schritt für Schritt) mit der Einladung zum nächsten Teil — kein eigener Reiter. */
    await afterPart();
    await waitFor(`document.querySelector('[data-world-next-page] [data-world-next-invite]')`, 'the way with the invitation to the next part');
    check(P, 'after a part: the way at the bottom of the map and the invitation to the next part', await ev(`document.querySelectorAll('[data-world-next-page] [data-world-way-part]').length >= 6 && document.querySelector('[data-world-next-go]') !== null && document.querySelector('[data-world-canvas]') !== null`));
    await shot('p3-next');
    await wayOpen();
    const before = await ev(`(() => { const p = document.querySelector('[data-world-panel="nav"]'); return { steps: Number(p.dataset.worldNavSteps), done: Number(p.dataset.worldNavDone), stops: [...p.querySelectorAll('[data-world-stop]')].map((s, i) => ({ i, key: s.dataset.worldStop, state: s.dataset.worldStopState, turns: Number(s.querySelector('[data-world-turns]')?.dataset.worldTurns ?? 0) })) }; })()`);
    check(P, 'the timetable lists every step, the current one after the done (and skipped) ones', before.steps >= 6 && before.stops.findIndex((x) => x.state === 'current') === before.done, { steps: before.steps, stops: before.stops.map((s) => s.key) });
    /* Eine Möglichkeit nach dem ersten Teil (die Teile davor bleiben, wenn man sie wählt). */
    const turnAt = before.stops.find((s) => s.turns > 0 && s.i > 0);
    check(P, 'a branch option is offered on the way', turnAt !== undefined && turnAt.i > 0, before.stops.map((s) => `${s.key}:${s.turns}`));
    await shot('p3-nav');
    await ev(`(() => { const s = document.querySelector('[data-world-stop="${turnAt.key}"] [data-world-turns]'); s.open = true; s.scrollIntoView({ block: 'center' }); return true; })()`);
    const alt = await ev(`document.querySelector('[data-world-stop="${turnAt.key}"] [data-world-turn-choose]').dataset.worldTurnChoose`);
    await shot('p3-turns');
    await click(`[data-world-stop="${turnAt.key}"] [data-world-turn-choose]`);
    await waitFor(`[...document.querySelectorAll('[data-world-stop]')].some((s) => s.dataset.worldStop === 'travel:${alt}') && document.querySelector('[data-world-stop="${turnAt.key}"]') === null`, 'the route to be recomputed from that stop');
    const afterNav = await ev(`(() => { const p = document.querySelector('[data-world-panel="nav"]'); return { steps: Number(p.dataset.worldNavSteps), done: Number(p.dataset.worldNavDone), target: p.dataset.worldNavTarget, stops: [...p.querySelectorAll('[data-world-stop]')].map((s) => s.dataset.worldStop) }; })()`);
    check(P, 'choosing the option recomputes the route from that stop (nothing new marked done)', afterNav.done === before.done && afterNav.stops.slice(0, turnAt.i).join() === before.stops.slice(0, turnAt.i).map((s) => s.key).join(), { turned: turnAt.key, to: alt, ...afterNav });
    check(P, 'the map shows the route: start pennant, target flag', await ev(`document.querySelector('[data-world-view]').dataset.worldNav !== ''`));
    await shot('p3-turned');
    /* Die Navigation hält in der Sitzung: eine Erzählung öffnen und zurück. */
    await click('[data-world-nav-go]');
    await waitFor(`document.querySelector('[data-world-running]')`, 'the current step to start');
    const kind = await ev(`document.querySelector('[data-world-running]').dataset.worldRunning`);
    if (kind === 'story') await click('[data-flow-close]');
    else await click('[data-world-back]');
    await afterPart();
    await wayOpen().catch(() => null);
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
    /* 2026-11-10 (Eigentümer) — gleich erobern geht immer: der Durchgang fragt alle Karten und sagt, wie viele nie gefragt wurden. */
    await waitFor(`document.querySelector('[data-world-panel="place"]')?.dataset.worldGate === 'ready'`, 'one level in force: the run can be tried at once', 15000);
    const unseen = await ev(`Number(document.querySelector('[data-world-run-unseen]')?.dataset.worldRunUnseen ?? -1)`);
    check(P, 'with one level the run can be tried at once, saying how many cards were never asked', unseen > 0, unseen);
    check(P, 'no learning directly: a story explains these cards', await ev(`document.querySelector('[data-world-panel="place"] [data-world-learn-direct]') === null`));
    await shot('p5-run-ready');
    await click('[data-world-run-for="1"]');
    /* 2026-11-10 — ein Fehler: der Durchgang lässt sich von vorn beginnen (für „Mistrzowsko"). */
    await waitFor(`document.querySelector('[data-world-run="ask"]')`, 'the first card');
    await ev(`(() => { const b = [...document.querySelectorAll('.cg-options [role=radio]')].find((x) => x.textContent.trim() === 'Nie' && !x.disabled); if (b) b.click(); return !!b; })()`);
    await waitFor(`document.querySelector('[data-world-run-restart-hint]')`, 'the offer to start over after a mistake');
    await click('[data-world-run-restart]');
    await waitFor(`document.querySelector('[data-world-run="ask"]')?.dataset.worldRunAgain === '0' && document.querySelector('[data-world-run="ask"]')?.dataset.worldRunFirst === '0'`, 'a fresh run');
    check(P, 'after a mistake the run can be started over: nothing counted yet, no retry round', await ev(`document.querySelector('[data-world-run-restart-hint]') === null`));
    await answerAll('[data-world-finish]');
    await waitFor(`document.querySelector('[data-world-finish]')`, 'the statistics slide after the run', 15000);
    const res = await ev(`(() => { const f = document.querySelector('[data-world-finish]'); return { kind: f.dataset.worldFinish, answers: Number(f.dataset.worldFinishAnswers) }; })()`);
    check(P, 'no result page: the run ends in the statistics slide (level 1 reached: conquered)', ['conquer', 'perfect'].includes(res.kind) && res.answers > 0, res);
    await shot('p5-run-result');
    await click('[data-world-finish-close]');
    await waitFor(`document.querySelector('[data-world-panel="place"]')?.dataset.worldConquered === '1'`, 'the place to be conquered', 15000);
    check(P, 'the place is conquered (flat, full colour, knowledge dot)', true);
    await sleep(1200);
    await shot('p5-conquered');
    /* 2026-11-14 (Eigentümer: „hier gehen drei Wege weiter — sie sollen zu sehen sein“) — die Wege weiter: gezählt, je ein Knopf, auf der Karte; unter dem Zeiger nur einer. */
    const roads = await ev(`(() => { const p = document.querySelector('[data-world-tower-actions]'); return { said: p.querySelectorAll('[data-world-onward-to]').length, buttons: p.querySelectorAll('[data-world-onward-to]').length, roads: [...p.querySelectorAll('[data-world-onward-road]')].map((x) => x.dataset.worldOnwardRoad), route: document.querySelector('[data-world-canvas]')?.dataset.wmRoute ?? '' }; })()`);
    check(P, `a conquered tower shows each road on as a button above it (${roads.said}), and the map shows them`, roads.said > 0 && roads.said === roads.buttons && roads.route !== '', roads);
    if (roads.buttons > 1) {
      await ev(`(() => { document.querySelector('[data-world-tower-actions] [data-world-onward-to]').dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); return true; })()`);
      await sleep(300);
      const one = await ev(`document.querySelector('[data-world-canvas]')?.dataset.wmRoute ?? ''`);
      check(P, 'pointing at one road lights only that road', one !== '' && one !== roads.route && one.split(' ').length < roads.route.split(' ').length, { one, all: roads.route });
      await shot('p5-road-peek');
      await ev(`(() => { document.querySelector('[data-world-tower-actions] [data-world-onward-to]').dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body })); return true; })()`);
    }
    /* 2026-11-14 (Eigentümer: „am Ziel von selbst eine Animation, der Weg ist zu Ende“) — ein Weg, der schon am Ziel ist, endet von selbst. */
    await ev(`(() => { document.querySelector('[data-world-panel="place"] .cg-wm-close, [data-world-panel="place"] [aria-label]')?.click(); return true; })()`);
    await sleep(400);
    const at = await ev(`(() => { const c = document.querySelector('[data-world-canvas]'); const q = c?.wmLocate?.('label', ${JSON.stringify(N.becchi)}); if (!q) return null; const r = c.getBoundingClientRect(); return [r.left + q[0], r.top + q[1]]; })()`);
    /* Erst einmal (das Feld öffnet sich, die Karte rückt), dann an der neuen Stelle zweimal kurz. */ if (at !== null) { await clickAt(at[0], at[1]); await sleep(900); const at2 = (await ev(`(() => { const c = document.querySelector('[data-world-canvas]'); const q = c?.wmLocate?.('label', ${JSON.stringify(N.becchi)}); if (!q) return null; const r = c.getBoundingClientRect(); return [r.left + q[0], r.top + q[1]]; })()`)) ?? at; await clickAt(at2[0], at2[1]); await sleep(60); await clickAt(at2[0], at2[1]); }
    await waitFor(`document.querySelector('[data-world-arrived]') !== null`, 'the arrival animation', 8000).catch(() => undefined);
    const arr = await ev(`({ shown: document.querySelector('[data-world-arrived]') !== null, nav: document.querySelector('[data-world-view]')?.dataset.worldNav ?? '?', card: document.querySelector('[data-world-next-arrived]') !== null })`);
    check(P, 'a way that is at its goal ends by itself: the arrival rises over the map, no navigation, no card to close', arr.shown && arr.nav === '' && !arr.card, arr);
    await shot('p5-arrived');
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
    await afterPart();
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
    await waitFor(`document.querySelector('[data-world-panel="place"]') && document.querySelector('[data-world-goal-set]')`, 'the goal button');
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
    /* Der Zeichner nimmt es mit dem nächsten Bild. */
    await waitFor(`(document.querySelector('[data-world-canvas]')?.dataset.wmGoal ?? '') === ''`, 'the flag to go', 3000).catch(() => null);
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
    check(P, 'a learner sees no portal to a world they cannot read', (await canvas('wmPortals')) === '0');
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

  /* -- 7 · Die ganze Seite als Spiel (2026-11-10): zwei Arten, ein Teil kommt herein, Abschluss mit Folgen, von selbst weiter ----- */
  if (runs('7')) {
    const P = '7 full page game';
    const canvas = (key) => ev(`document.querySelector('[data-world-canvas]')?.dataset.${key} ?? null`);
    const hostOf = () => ev(`(() => { const h = document.querySelector('[data-world-view]'); return { mode: h.dataset.worldFullMode, bar: document.querySelector('[data-world-fullbar]')?.dataset.worldFullbar ?? null, locked: document.documentElement.classList.contains('cg-wm-locked') }; })()`);
    await open();
    check(P, 'two ways in: the whole screen and the whole page', await ev(`[...document.querySelectorAll('[data-world-full]')].map((b) => b.dataset.worldFull).join()`) === 'screen,page');
    await click('[data-world-full="screen"]');
    await waitFor(`document.querySelector('[data-world-view]').dataset.worldFullMode === 'screen'`, 'the whole screen');
    await click('[data-world-fulltab="mode"]');
    await waitFor(`document.querySelector('[data-world-view]').dataset.worldFullMode === 'page'`, 'the whole page');
    const h0 = await hostOf();
    check(P, 'the bar switches to the whole page; the page below does not scroll', h0.mode === 'page' && h0.bar === 'map' && h0.locked, h0);
    await sleep(600);
    await clickMap('label', N.becchi);
    await waitFor(`document.querySelector('[data-world-panel="place"]')`, 'the place panel over the map');
    await click('[data-world-my-settings]');
    await waitFor(`document.querySelector('[data-levels-n="1"]')`, 'my settings');
    await click('[data-levels-n="1"]');
    await waitFor(`document.querySelector('[data-world-panel="place"]')?.dataset.worldGate === 'ready'`, 'one level in force', 15000);
    await click('[data-world-run-for="1"]');
    await waitFor(`document.querySelector('[data-world-running="run"]')`, 'the run');
    check(P, 'a part comes in as its own view, zooming in', await ev(`document.querySelector('[data-full-view="run"]')?.dataset.enter === 'zoom' && document.querySelector('[data-world-fullbar]').dataset.worldFullbar === 'run'`));
    const played0 = await canvas('wmPlayed');
    await answerAll('[data-world-finish]');
    await waitFor(`document.querySelector('[data-world-finish]')`, 'the finish of the part');
    const fin = await ev(`(() => { const f = document.querySelector('[data-world-finish]'); return { kind: f.dataset.worldFinish, answers: Number(f.dataset.worldFinishAnswers), auto: f.querySelector('[data-world-finish-auto]') !== null }; })()`);
    check(P, 'the finish counts the answers and goes on by itself (to the map: no way chosen)', ['conquer', 'perfect'].includes(fin.kind) && fin.answers > 0 && fin.auto, fin);
    /* 2026-11-10 (Eigentümer) — erst die Folie mit den Zahlen; die Karte spielt danach, was sich änderte. */
    check(P, 'first the statistics slide: the map does not play behind it', (await canvas('wmPlayed')) === played0);
    await shot('p7-finish');
    await waitFor(`document.querySelector('[data-world-finish]') === null`, 'the slide to go on by itself', 15000);
    await waitFor(`(document.querySelector('[data-world-canvas]')?.dataset.wmPlayed ?? '') !== ${JSON.stringify(played0 ?? '')}`, 'the map to play what changed', 10000);
    check(P, 'by itself the slide closes; the map plays what changed', (await hostOf()).bar === 'map' && (await canvas('wmPlayedKind')) === 'return');
    await shot('p7-map-plays');
    /* Ein zweiter Turm (seine Voraussetzung ist nun erobert) — der Abschluss sagt, was folgt und warum; eine Berührung hält das Weitergehen an. */
    await clickMap('label', N.sen);
    await waitFor(`document.querySelector('[data-world-panel="place"]')?.dataset.worldGate === 'ready'`, 'the run to be possible', 15000);
    await click('[data-world-run-for="1"]');
    await answerAll('[data-world-finish]');
    await waitFor(`document.querySelector('[data-world-finish]')`, 'the finish of the run');
    await sleep(2400);
    const won = await ev(`(() => { const f = document.querySelector('[data-world-finish]'); return { kind: f.dataset.worldFinish, follows: [...f.querySelectorAll('[data-world-finish-follow]')].map((x) => x.dataset.worldFinishFollow + ': ' + x.textContent) }; })()`);
    check(P, 'a conquest: the flag, and what follows says it is conquered and why', (won.kind === 'conquer' || won.kind === 'perfect') && won.follows[0]?.startsWith('conquer:'), won);
    await shot('p7-conquer');
    await clickAt(20, 20);
    await sleep(1200);
    check(P, 'a touch stops going on by itself', await ev(`document.querySelector('[data-world-finish]') !== null && document.querySelector('[data-world-finish-auto]') === null`));
    await click('[data-world-finish-close]');
    await waitFor(`document.querySelector('[data-world-finish]') === null`, 'the map');
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await waitFor(`document.querySelector('[data-world-view]').dataset.worldFullMode === ''`, 'Esc to close the whole page');
    check(P, 'Esc closes the whole page; the page scrolls again', !(await hostOf()).locked);
  }

  /*
    -- 8 · 2026-11-10 (Eigentümer, Teil 4): Scheiben (ein Klick gleitet hin, der Weg zurück), Doppelklick = Überblick über den Weg,
    „Beenden" hält nur an, der Plan einer Erzählung nur im Vollbild auf Wunsch, „Statistik dieser Karte" an jeder Frage ------------
  */
  if (runs('8')) {
    const P = '8 discs and overview';
    const canvas = (key) => ev(`document.querySelector('[data-world-canvas]')?.dataset.${key} ?? null`);
    await open();
    const discs = await ev(`document.querySelector('[data-world-canvas]').wmDiscs()`);
    const magone = discs.find((d) => d.discs.length >= 2);
    check(P, 'towers stand on discs (one per missing prerequisite)', magone !== undefined, discs.slice(0, 3));
    /* Hineinzoomen zu ihm (das Rad an seiner Stelle), bis die Scheiben als Streifen und ihre Namen zu sehen sind. */
    await clickMap('place', magone.id);
    await waitFor(`document.querySelector('[data-world-panel="place"]')`, 'the place panel');
    let disc = null;
    for (let i = 0; i < 18 && (disc === null || Number(await canvas('wmDiscNames')) === 0); i += 1) {
      await ev(`document.querySelector('[data-world-canvas]').wmLookAt(${JSON.stringify(magone.id)}, ${(0.6 * Math.pow(1.35, i)).toFixed(3)})`);
      await sleep(250);
      disc = await ev(`(() => { const c = document.querySelector('[data-world-canvas]'); const p = c.wmLocate('disc', ${JSON.stringify(`${magone.id}#0`)}); if (!p) return null; const r = c.getBoundingClientRect(); return [r.left + p[0], r.top + p[1]]; })()`);
    }
    check(P, 'close up the discs show as stripes with the names of their towers', disc !== null && Number(await canvas('wmDiscStripes')) > 0 && Number(await canvas('wmDiscNames')) > 0, { stripes: await canvas('wmDiscStripes'), names: await canvas('wmDiscNames') });
    await shot('p8-discs');
    if (disc !== null) {
      await clickAt(disc[0], disc[1]);
      await waitFor(`document.querySelector('[data-world-panel="place"]')?.dataset.worldPlace === ${JSON.stringify(magone.discs[0])}`, 'the tower of the bottom disc', 10000).catch(() => null);
      check(P, 'a click on a disc glides to its tower (bottom disc = first to do) and keeps the way back', await ev(`document.querySelector('[data-world-panel="place"]')?.dataset.worldPlace === ${JSON.stringify(magone.discs[0])} && document.querySelector('[data-world-trail]') !== null`));
      await shot('p8-disc-glide');
      await click(`[data-world-trail-to="${magone.id}"]`);
      await waitFor(`document.querySelector('[data-world-panel="place"]')?.dataset.worldPlace === ${JSON.stringify(magone.id)}`, 'back to the tower', 10000).catch(() => null);
      check(P, 'the way back returns to the tower', await ev(`document.querySelector('[data-world-panel="place"]')?.dataset.worldPlace === ${JSON.stringify(magone.id)} && document.querySelector('[data-world-trail]') === null`));
    }
    /* Doppelklick: der Überblick über den Weg, von dort beginnt man (erst das Feld zu, die Kamera still). */
    await ev(`(() => { document.querySelector('[data-world-panel-close]')?.click(); return true; })()`);
    await sleep(900);
    await click('[data-world-fit]');
    await sleep(1200);
    const pt = await ev(`(() => { const c = document.querySelector('[data-world-canvas]'); const p = c.wmLocate('place', ${JSON.stringify(magone.id)}); if (!p) return null; const r = c.getBoundingClientRect(); return [r.left + p[0], r.top + p[1]]; })()`);
    await clickAt(pt[0], pt[1]);
    await sleep(60);
    await clickAt(pt[0], pt[1]);
    await waitFor(`document.querySelector('[data-world-next-page] [data-world-next-invite]')`, 'the way at the bottom of the map');
    const ov = await ev(`({ steps: [...document.querySelectorAll('[data-world-next-page] [data-world-way-part]')].map((x) => x.dataset.worldWayPart), target: document.querySelector('[data-world-next-page] [data-world-way-target]')?.dataset.worldWayTarget, start: document.querySelector('[data-world-next-go]')?.dataset.worldNextGo, goal: document.querySelector('[data-world-goal]')?.dataset.worldGoal ?? null })`);
    check(P, 'a double click makes the tower the goal and shows the way step by step at the bottom of the map; nothing started yet', ov.steps.length >= 3 && ov.target === magone.id && ov.goal === magone.id && await ev(`document.querySelector('[data-world-running]') === null && document.querySelector('[data-world-canvas]') !== null`), ov);
    /* Ein Schritt der Kette zeigt, wo er auf der Karte liegt. */
    const shown = await ev(`document.querySelectorAll('[data-world-way-show]').length`);
    await click('[data-world-way-show]');
    await ev(`(() => { document.querySelector('[data-world-picked-close]')?.click(); return true; })()`);
    await sleep(900);
    check(P, 'the steps of the way can be clicked: the map shows where the step is', shown >= 3);
    await sleep(300);
    await shot('p8-overview');
    await startStep();
    await waitFor(`document.querySelector('[data-world-running]')`, 'the first step from the overview');
    const kind = await ev(`document.querySelector('[data-world-running]').dataset.worldRunning`);
    check(P, `"start" in the overview begins the first step (${kind})`, kind === ov.start || (ov.start === 'travel' && kind === 'story') || (['learn', 'know', 'review'].includes(ov.start) && ['learn', 'review'].includes(kind)), { kind, start: ov.start });
    if (kind === 'story') {
      /* Der Plan der Erzählung: nicht daneben, nur auf Wunsch im Vollbild; der eigene Weg lässt sich ausschalten. */
      await sleep(400);
      check(P, 'no story graph beside the story', await ev(`document.querySelector('.cg-story-path-side') === null && document.querySelector('.cg-story-mapview') === null`));
      await ev(`(() => { const m = document.querySelector('[data-flow-menu]'); if (m) m.open = true; return true; })()`);
      const hasMap = await ev(`document.querySelector('[data-flow-story-map]') !== null`);
      if (hasMap) {
        await click('[data-flow-story-map]');
        await waitFor(`document.querySelector('.cg-story-mapview [data-path-map]')`, 'the story map full screen');
        await click('[data-story-map-route]');
        await sleep(200);
        check(P, 'the story map opens full screen on demand; the own way can be switched off', await ev(`document.querySelector('[data-story-map-route]').checked === false`));
        await shot('p8-story-map');
        await click('[data-story-map-close]');
        check(P, 'and it closes again', await ev(`document.querySelector('.cg-story-mapview') === null`));
      }
      /* Bis zur ersten Frage blättern: dort „Statistik dieser Karte". */
      for (let i = 0; i < 20 && !(await ev(`document.querySelector('[data-card-stats]') !== null`)); i += 1) {
        if (!(await ev(`(() => { const b = document.querySelector('[data-flow-go]'); if (!b) return false; b.click(); return true; })()`))) break;
        await sleep(150);
      }
      await click('[data-flow-close]');
    } else await click('[data-world-back]');
    await afterPart();
    await waitFor(`document.querySelector('[data-world-next-stop]')`, 'the way after the part', 15000);
    /* 2026-11-14 (Eigentümer) — eine begonnene Erzählung: ihre Spur ist bis zur zuletzt gesehenen Folie gefärbt. */
    await sleep(600);
    check(P, 'a story begun but not finished is coloured on the map up to its last seen slide', Number(await ev(`document.querySelector('[data-world-canvas]')?.dataset.wmLaneProgress ?? 0`)) >= 1, await ev(`document.querySelector('[data-world-canvas]')?.dataset.wmLaneProgress`));
    await click('[data-world-next-stop]');
    await waitFor(`document.querySelector('[data-world-nav-paused]')`, 'the paused way');
    check(P, '"end navigation" only pauses the way (the progress stays); it can be resumed', await ev(`document.querySelector('[data-world-nav-paused]').dataset.worldNavPaused === ${JSON.stringify(magone.id)} && document.querySelector('[data-world-panel="nav"]') === null`));
    await click('[data-world-nav-resume]');
    await wayOpen();
    check(P, 'resumed: the timetable is back', await ev(`document.querySelector('[data-world-panel="nav"]').dataset.worldNavTarget === ${JSON.stringify(magone.id)}`));
    await shot('p8-resumed');
    /* „Statistik dieser Karte" an einer Frage (ein Turm: sein Durchgang). */
    await click('[data-world-nav-go]');
    await waitFor(`document.querySelector('[data-world-running]')`, 'the current step');
    for (let i = 0; i < 30 && !(await ev(`document.querySelector('[data-card-stats]') !== null`)); i += 1) {
      if (await ev(`(() => { const b = document.querySelector('[data-flow-go]'); if (!b) return false; b.click(); return true; })()`)) { await sleep(150); continue; }
      await sleep(150);
    }
    if (await ev(`document.querySelector('[data-card-stats]') !== null`)) {
      await click('[data-card-stats]');
      await waitFor(`document.querySelector('[data-card-stats-open]')`, 'the statistics of the card', 10000);
      check(P, 'every card view offers "statistics of this card" (same place, same sign)', await ev(`document.querySelector('[data-card-stats-open]') !== null`));
      await shot('p8-card-stats');
    } else check(P, 'a question was reached to try "statistics of this card"', false);
  }

  /*
    -- 10 · 2026-11-11: eine Wahl mit ihrer Beschreibung ("of") und je Möglichkeit einem Hinweis ("hint") — EIN Bildschirm; nur mit
    einer Testwelt, deren Wahl sie trägt (scratch fixture-choice.json, siehe Bericht) ------------------------------------------------
  */
  if (runs('10')) {
    const P = '10 choice with description';
    await open('all');
    const lane = (await ev(`document.querySelector('[data-world-canvas]').wmLanes()`)).find((l) => l.to.startsWith('~j:'));
    await clickMap('lane', lane.section);
    await waitFor(`document.querySelector('[data-world-panel="section"] [data-world-travel]')`, 'the section panel');
    await click('[data-world-panel="section"] [data-world-travel]');
    await waitFor(`document.querySelector('[data-world-running="story"] [data-flow-running]')`, 'the story');
    for (let i = 0; i < 30 && !(await ev(`document.querySelector('[data-flow-choice-of="1"]') !== null`)); i += 1) {
      if (!(await ev(`(() => { const b = document.querySelector('[data-flow-go]') ?? document.querySelector('[data-card-next]'); if (b) { b.click(); return true; } const t = [...document.querySelectorAll('.cg-options [role=radio]')].find((x) => !x.disabled); if (t) { t.click(); return true; } return false; })()`))) break;
      await sleep(150);
    }
    const scr = await ev(`(() => { const s = document.querySelector('[data-flow-running]:not(.is-behind)'); const ch = s?.querySelector('[data-flow-choice-of="1"]'); if (!ch) return null; const slide = ch.previousElementSibling; return { title: s.querySelector('[data-flow-title]')?.textContent ?? '', head: ch.querySelector('[data-flow-choice-head]')?.textContent ?? '', hints: ch.querySelectorAll('[data-flow-option-hint]').length, options: ch.querySelectorAll('[data-flow-option]').length, slideAbove: slide !== null && slide.textContent.trim().length > 0, next: document.querySelector('[data-flow-go]') !== null }; })()`);
    check(P, 'the slide stands above the options on ONE screen; the choice title heads the options; one hint per option', scr !== null && scr.slideAbove && scr.head === 'Którędy dalej?' && scr.hints === scr.options && scr.options >= 2 && !scr.next, scr);
    await shot('p10-choice');
    await click('[data-flow-option][data-flow-option-locked="0"]');
    await sleep(400);
    for (let i = 0; i < 12 && !(await ev(`document.querySelector('[data-flow-past-choice]') !== null`)); i += 1) {
      if (!(await ev(`(() => { const b = document.querySelector('[data-flow-back]'); if (!b) return false; b.click(); return true; })()`))) break;
      await sleep(200);
    }
    const past = await ev(`(() => { const c = document.querySelector('[data-flow-past-choice]'); if (!c) return null; return { chosen: c.querySelectorAll('.is-chosen').length, hints: c.querySelectorAll('[data-flow-option-hint]').length, slideAbove: (c.previousElementSibling?.textContent ?? '').trim().length > 0 }; })()`);
    check(P, 'review mode shows the text and the options, the chosen one marked', past !== null && past.chosen === 1 && past.hints >= 2 && past.slideAbove, past);
    await shot('p10-review');
  }

  /*
    -- 11 · 2026-11-12: die Einstufung (Schritt "explore") am Anfang einer Erzählung — nur mit einer Testwelt, die ihn trägt
    (scratch fixture-explore.json, siehe Bericht): Anfang, Fragen, Gutschrift (ein gestrichelter Ring auf der Karte), anhalten, weiter
  */
  if (runs('11')) {
    const P = '11 placement';
    await open();
    await clickMap('home', '~home');
    await waitFor(`document.querySelector('[data-world-panel="home"] [data-world-choose]')`, 'the stories from home');
    await ev(`(() => { const b = [...document.querySelectorAll('[data-world-panel="home"] [data-world-direction]')].find((r) => r.textContent.includes('Małgorzat'))?.querySelector('[data-world-choose]'); if (b) { b.click(); return true; } return false; })()`);
    await waitFor(`document.querySelector('[data-placement="start"]')`, 'the placement at the start of the story');
    const start = await ev(`(() => { const s = document.querySelector('[data-placement="start"]'); return { open: Number(s.dataset.placementOpen), skip: s.querySelector('[data-placement-skip]') !== null }; })()`);
    check(P, 'a story that starts with a placement opens it first; it can be skipped ("Dalej bez sprawdzania")', start.open >= 1 && start.skip, start);
    await shot('p11-start');
    await click('[data-placement-start]');
    await waitFor(`document.querySelector('[data-placement="ask"]')`, 'the first question');
    let credited = 0;
    for (let i = 0; i < 12 && credited === 0; i += 1) {
      const picked = await ev(`(() => { const b = [...document.querySelectorAll('.cg-options [role=radio]')].find((x) => x.textContent.trim() === 'Tak' && !x.disabled); if (!b) return false; b.click(); return true; })()`);
      if (!picked) { await sleep(150); continue; }
      await waitFor(`document.querySelector('[data-card-next]') !== null`, 'next', 10000);
      await click('[data-card-next]');
      await sleep(250);
      credited = Number(await ev(`document.querySelector('[data-placement]')?.dataset.placementCount ?? document.querySelector('[data-placement]')?.dataset.placementCredited ?? 0`));
    }
    check(P, 'right answers in a row credit a tower (streak 2) and the run goes on', credited >= 1, credited);
    await shot('p11-ask');
    if (await ev(`document.querySelector('[data-placement-stop]') !== null`)) {
      await click('[data-placement-stop]');
      await waitFor(`document.querySelector('[data-placement-continue]')`, 'the continue button');
      check(P, '"Zakończ na razie" keeps the run: "Kontynuuj" continues it', true);
    }
    await click('[data-flow-close]');
    await sleep(800);
    await ev(`(() => { const f = document.querySelector('[data-world-finish-close]'); if (f) f.click(); return true; })()`);
    await sleep(800);
    check(P, 'the credited tower is marked on the map (dashed ring)', Number(await ev(`document.querySelector('[data-world-canvas]')?.dataset.wmPlaced ?? 0`)) >= 1);
    await shot('p11-map');
  }

  /*
    -- 12 · 2026-11-12: beim Laden die Frage (Vollbild / ganze Seite / Teil der Seite); ein Teil im Vollbild füllt den Platz und
    steht still; nach dem Teil die Tafel über der angehaltenen Karte, beim Schliessen fliegt, was sie brachte, zur Karte, und
    die Karte spielt erst danach
  */
  if (runs('12')) {
    const P = '12 invite, still run, flight';
    const canvas = (key) => ev(`document.querySelector('[data-world-canvas]')?.dataset.${key} ?? null`);
    await open('none', false, '&invite=1');
    const inv = await ev(`(() => { const d = document.querySelector('[data-world-invite]'); return d === null ? null : [...d.querySelectorAll('[data-world-invite-choose]')].map((b) => b.dataset.worldInviteChoose + (b.classList.contains('is-best') ? '*' : '')).join(); })()`);
    check(P, 'on load the module is greyed with the question: full screen (recommended), full page, part of the page', inv === 'screen*,page,stay', inv);
    await shot('p12-invite');
    await click('[data-world-invite-choose="screen"]');
    await waitFor(`document.querySelector('[data-world-view]').dataset.worldFullMode === 'screen'`, 'the whole screen');
    check(P, '"full screen" opens the whole screen and the question is gone', await ev(`document.querySelector('[data-world-invite]') === null`));
    await sleep(600);
    await clickMap('label', N.becchi);
    await waitFor(`document.querySelector('[data-world-panel="place"]')`, 'the place panel');
    await click('[data-world-my-settings]');
    await waitFor(`document.querySelector('[data-levels-n="1"]')`, 'my settings');
    await click('[data-levels-n="1"]');
    await waitFor(`document.querySelector('[data-world-panel="place"]')?.dataset.worldGate === 'ready'`, 'one level in force', 15000);
    await click('[data-world-run-for="1"]');
    await waitFor(`document.querySelector('[data-world-running="run"] .cg-options [role=radio]')`, 'the first question');
    await sleep(400);
    const rectOf = `(() => { const v = document.querySelector('[data-full-view="run"]'); const o = document.querySelector('.cg-options [role=radio]'); const p = document.querySelector('.cg-face .cg-prompt'); const r = o.getBoundingClientRect(), q = p.getBoundingClientRect(); return { wide: v.hasAttribute('data-run-wide'), zoom: Number(getComputedStyle(v).getPropertyValue('--run-zoom') || 0), x: Math.round(r.left), y: Math.round(r.top), py: Math.round(q.top), scroll: v.scrollHeight - v.clientHeight }; })()`;
    const before = await ev(rectOf);
    check(P, 'the run fills the screen: two fixed columns, scaled with the window', before.wide && before.zoom >= 1, before);
    await shot('p12-run-ask');
    /*
      2026-11-12 (Eigentümer: eine Reihenfolge mit sechs Teilen, „Sprawdź" unter dem Rand) — eine lange Frage: (hier künstlich
      verlängert) sie wird beim Einpassen kleiner, bis die linke Spalte ganz zu sehen ist; danach wieder die normale Grösse.
    */
    await page.setViewport({ width: 1440, height: 760 });
    await sleep(500);
    await ev(`(() => { const m = document.querySelector('.cg-face-main'); for (let i = 0; i < 6; i += 1) { const d = document.createElement('div'); d.className = 'cg-test-long'; d.style.height = '90px'; d.style.border = '1px dashed'; m.appendChild(d); } return true; })()`);
    await page.setViewport({ width: 1440, height: 780 });
    await sleep(600);
    const long = await ev(`(() => { const m = document.querySelector('.cg-face-main'); const v = document.querySelector('[data-full-view="run"]'); const last = m.lastElementChild.getBoundingClientRect(); const vb = v.getBoundingClientRect(); return { over: m.scrollHeight - m.clientHeight, zoom: Number(document.querySelector('.cg-face').dataset.runZoom), inside: last.bottom <= vb.bottom + 1, pageScroll: v.scrollHeight - v.clientHeight }; })()`);
    check(P, 'a long question is fitted (less space above, then smaller) until all of it is visible — nothing below the edge', long.over <= 1 && long.inside && long.pageScroll <= 2, long);
    await shot('p12-run-long');
    await ev(`(() => { document.querySelectorAll('.cg-test-long').forEach((d) => d.remove()); return true; })()`);
    await page.setViewport({ width: 1440, height: 1000 });
    await sleep(600);
    await ev(`(() => { const b = [...document.querySelectorAll('.cg-options [role=radio]')].find((x) => x.textContent.trim() === 'Tak' && !x.disabled); b.click(); return true; })()`);
    await waitFor(`document.querySelector('[data-card-next]') !== null`, 'the verdict');
    await sleep(500);
    const after = await ev(rectOf);
    check(P, 'after the answer nothing moved (question and answers in the same place) and the view does not scroll', after.x === before.x && after.y === before.y && after.py === before.py && after.scroll <= 2, { before, after });
    await shot('p12-run-answered');
    /* 2026-11-14 (Eigentümer: „noch immer verrutscht es“) — der Teil ist nie breiter als sein Fenster (kein seitliches Rollen, kein Sprung beim Fokus auf „Dalej“). */
    const side = await ev(`(() => { const v = document.querySelector('[data-full-view="run"]'); return { over: v.scrollWidth - v.clientWidth, left: v.scrollLeft, top: v.scrollTop }; })()`);
    check(P, 'the run never scrolls sideways and does not jump when "Dalej" gets the focus', side.over <= 1 && side.left === 0 && side.top === 0, side);
    /* 2026-11-14 (Eigentümer: „das Neuskalieren kommt davon, dass sich beim Antworten die Grösse ändert“) — erscheint eine Bildlaufleiste, bleibt alles, wie es ist. */
    await ev(`(() => { const d = document.createElement('div'); d.className = 'cg-test-tall'; d.style.height = '2400px'; document.querySelector('[data-full-view="run"]').appendChild(d); return true; })()`);
    await sleep(600);
    const tall = await ev(rectOf);
    check(P, 'a scroll bar appearing after the answer changes nothing: same scale, same place', tall.zoom === after.zoom && tall.x === after.x && tall.y === after.y, { after, tall });
    await ev(`(() => { document.querySelectorAll('.cg-test-tall').forEach((d) => d.remove()); return true; })()`);
    await sleep(300);
    /* 2026-11-14 (Eigentümer: „‚Dalej‘ ist wegen des Rollens oft verdeckt, besonders quer“) — ein Telefon quer, die Antwort künstlich lang: „Dalej“ bleibt im Bild. */
    await page.setViewport({ width: 760, height: 360 });
    await sleep(600);
    await ev(`(() => { const o = document.querySelector('.cg-answer .cg-options'); for (let i = 0; i < 5; i += 1) { const d = document.createElement('div'); d.className = 'cg-test-long'; d.style.height = '80px'; d.style.border = '1px dashed'; o.appendChild(d); } return true; })()`);
    await sleep(400);
    const land = await ev(`(() => { const n = document.querySelector('[data-card-next]').getBoundingClientRect(); const v = document.querySelector('[data-full-view="run"]').getBoundingClientRect(); return { top: Math.round(n.top), bottom: Math.round(n.bottom), viewTop: Math.round(v.top), viewBottom: Math.round(v.bottom) }; })()`);
    check(P, 'landscape phone, long answer: "Dalej" stays in view', land.top >= land.viewTop && land.bottom <= land.viewBottom + 1, land);
    await shot('p12-landscape-next');
    await ev(`(() => { document.querySelectorAll('.cg-test-long').forEach((d) => d.remove()); return true; })()`);
    await page.setViewport({ width: 1440, height: 1000 });
    await sleep(600);
    await click('[data-card-next]');
    await answerAll('[data-world-finish]');
    await waitFor(`document.querySelector('[data-world-finish]')`, 'the panel of the part');
    await sleep(1500);
    const under = { held: await canvas('wmHeld'), playing: await canvas('wmPlaying') };
    check(P, 'the panel lies over the map; the map waits on the state before (held, not playing)', (under.held ?? '') !== '' && under.playing === '', under);
    await shot('p12-panel');
    const played0 = await canvas('wmPlayed');
    await click('[data-world-finish-close]');
    const t0 = Date.now();
    await sleep(250);
    const flying = Number(await ev(`document.querySelector('[data-world-flights]')?.dataset.worldFlights ?? 0`));
    check(P, 'closing the panel sends what it brought flying to the map', flying >= 1, flying);
    await shot('p12-flight');
    await waitFor(`(document.querySelector('[data-world-canvas]')?.dataset.wmPlayed ?? '') !== ${JSON.stringify(played0 ?? '')}`, 'the map to play', 10000);
    const startedAfter = Date.now() - t0;
    await sleep(150);
    const ms = Number(await canvas('wmPlayedMs'));
    check(P, 'the map plays what changed only after the panel closed (started, return)', (await canvas('wmPlayedKind')) === 'return' && ms > 0, { startedAfter, ms });
    await waitFor(`document.querySelector('[data-world-flights]') === null`, 'the flight to land', 5000);
    await shot('p12-landed');
  }

  /*
    -- 13 · 2026-11-12 (Prompt 25): Wege zu einer Frage — nur mit einer Testwelt, die sie trägt (scratch fixture-paths.json, siehe
    Bericht): Wegweiser am Haus, an einem Ort und an einer Gabelung; das Haus listet alle Fragen; das Feld eines Weges; „Idź tą
    drogą" (seit 2026-11-12 „Odkryj") beginnt den ersten offenen Schritt; mit erledigten Schritten der Abschluss, danach ist der Weg erledigt (Haken)
  */
  /* -- 14 · 2026-11-14: der Rundgang über die echte Karte (erfundener Fortschritt), beim ersten Mal von selbst, vom Haus aus neu ---- */
  /* -- 15 · (2026-11-14) „Zdobądź w pełni“ und die Tafel, wenn ein Durchgang keine Stufe mehr bringt ------------------------------ */
  if (runs('15')) {
    const P = '15 conquer fully';
    await open();
    await clickMap('label', N.becchi);
    await waitFor(`document.querySelector('[data-world-panel="place"]')`, 'the place panel');
    await click('[data-world-my-settings]');
    await waitFor(`document.querySelector('[data-levels-n="1"]')`, 'my settings');
    await click('[data-levels-n="1"]');
    await waitFor(`document.querySelector('[data-world-panel="place"]')?.dataset.worldGate === 'ready'`, 'one level in force', 15000);
    await click('[data-world-run-for="1"]');
    /* Die erste Karte falsch (Stufe 1 zählt „beliebig“: das bringt keine Tafel), dann alles richtig → erobert, aber nicht „Mistrzowsko“. */
    await waitFor(`document.querySelector('[data-world-run="ask"]')`, 'the first card');
    await ev(`(() => { const b = [...document.querySelectorAll('.cg-options [role=radio]')].find((x) => x.textContent.trim() === 'Nie' && !x.disabled); if (b) b.click(); return !!b; })()`);
    await waitFor(`document.querySelector('[data-card-next]') !== null`, 'next after the mistake');
    await click('[data-card-next]');
    await sleep(200);
    check(P, 'a level counted "any way" is never lost: no slide after a mistake', await ev(`document.querySelector('[data-world-run-lost]') === null`));
    await answerAll('[data-world-finish]');
    await waitFor(`document.querySelector('[data-world-finish]')`, 'the statistics slide', 15000);
    const kind = await ev(`document.querySelector('[data-world-finish]').dataset.worldFinish`);
    check(P, 'conquered with a mistake: not masterly', kind === 'conquer', kind);
    await click('[data-world-finish-close]');
    await waitFor(`document.querySelector('[data-world-tower-actions] [data-world-conquer-full]')`, 'the button "Zdobądź w pełni" above the tower', 15000);
    check(P, 'a conquered tower below the star offers "Zdobądź w pełni"', true);
    await click('[data-world-tower-actions] [data-world-conquer-full]');
    await waitFor(`document.querySelector('[data-world-full-sheet]')`, 'the levels sheet');
    const sheet = await ev(`(() => { const s = document.querySelector('[data-world-full-sheet]'); return { levels: [...s.querySelectorAll('[data-world-full-level]')].map((x) => x.dataset.worldFullLevel + (x.classList.contains('is-done') ? '✓' : '')), start: s.querySelector('[data-world-full-start]') !== null }; })()`);
    check(P, 'the sheet lists level 1 (reached) and the star (not yet), then the start button', sheet.levels.join() === '1✓,star' && sheet.start, sheet);
    await sleep(700);
    await shot('p15-full-sheet');
    await click('[data-world-full-start]');
    await waitFor(`document.querySelector('[data-world-run="ask"]')`, 'the run for the star');
    await ev(`(() => { const b = [...document.querySelectorAll('.cg-options [role=radio]')].find((x) => x.textContent.trim() === 'Nie' && !x.disabled); if (b) b.click(); return !!b; })()`);
    await waitFor(`document.querySelector('[data-card-next]') !== null`, 'next after the mistake');
    await click('[data-card-next]');
    await waitFor(`document.querySelector('[data-world-run-lost="star"]')`, 'the slide "this run can no longer reach the star"');
    check(P, 'one mistake on the way to the star: the slide proposes a new round and says why', await ev(`document.querySelector('[data-world-run-lost-restart]') !== null && document.querySelector('[data-world-run-lost-go]') !== null`));
    await sleep(700);
    await shot('p15-lost');
    await click('[data-world-run-lost-restart]');
    await waitFor(`document.querySelector('[data-world-run="ask"]')?.dataset.worldRunFirst === '0' && document.querySelector('[data-world-run-lost]') === null`, 'a fresh round');
    check(P, '"Nowa runda" starts a fresh run', true);
  }

  if (runs('14')) {
    const P = '14 tour';
    keepTour = true;
    await page.navigate('about:blank');
    await open('none', false, '&tour=1');
    await sleep(800);
    const first = await ev(`document.querySelector('[data-world-tour]')?.dataset.worldTour ?? null`);
    if (first === null) { await clickMap('home', '~home'); await waitFor(`document.querySelector('[data-world-tour-start]')`, 'the tour button above the house'); await click('[data-world-tour-start]'); }
    await waitFor(`document.querySelector('[data-world-tour="welcome"]')`, 'the first step of the tour');
    check(P, 'the tour starts by itself the first time (or from the house)', true, { first });
    const keys = [];
    const acts = [];
    let realButtons = 0;
    let arcCount = 0;
    let demoSkip = 0;
    const frames = [];
    for (let i = 0; i < 20; i += 1) {
      const k = await ev(`document.querySelector('[data-world-tour]')?.dataset.worldTour ?? null`);
      if (k === null) break;
      keys.push(k);
      await sleep(700);
      /* 2026-11-14 — interaktiv: erst das Gezeigte klicken (das Haus auf der Karte selbst, sonst den pulsierenden Knopf), dann die Erklärung. */
      const doing = await ev(`document.querySelector('[data-world-tour-do]')?.dataset.worldTourDo ?? null`);
      if (doing !== null) {
        acts.push(doing);
        if (doing === 'home') await clickMap('home', '~home'); else if (doing === 'step') await click('[data-world-tour-demo] [data-world-way-show]'); else await click('[data-world-tour-tap]');
        await waitFor(`document.querySelector('[data-world-tour-do]') === null && document.querySelector('[data-world-tour-next], [data-world-tour-done]') !== null`, 'the explanation after the click', 8000);
        await sleep(300);
        if (k === 'tower') realButtons = await ev(`document.querySelectorAll('[data-world-tower-actions] [data-world-lead], [data-world-tower-actions] [data-world-run-for]').length`);
        if (k === 'steps') { await click('[data-world-tour-demo] [data-world-picked-skip]').catch(() => undefined); await sleep(300); demoSkip = await ev(`document.querySelectorAll('[data-world-tour-demo] [data-world-way-state="skipped"]').length`); }
      }
      frames.push(await ev(`document.querySelector('[data-world-canvas]')?.dataset.wmFrame ?? ''`));
      if (k === 'arcs') arcCount = Number(await ev(`document.querySelector('[data-world-canvas]')?.dataset.wmArcs ?? 0`));
      await shot(`p14-${String(i).padStart(2, '0')}-${k}`);
      if (await ev(`document.querySelector('[data-world-tour-next]') === null`)) break;
      await click('[data-world-tour-next]');
      await sleep(200);
    }
    check(P, `every part is explained on this map (${keys.length} steps)`, ['welcome', 'home', 'tower', 'conquered', 'locked', 'way', 'views'].every((k) => keys.includes(k)), keys);
    check(P, 'after clicking a tower its real buttons stand above it (Odkryj, Zdobądź od razu)', realButtons >= 2, realButtons);
    check(P, 'the steps of a way can be tried in the tour: a skipped step stays greyed in its place', demoSkip >= 1, demoSkip);
    check(P, 'the check of existing knowledge and the arcs in the air are explained', keys.includes('placement') && keys.includes('steps') && keys.includes('arcs') && arcCount > 0, { keys, arcCount });
    check(P, `it is interactive: the learner clicks what is shown, then the explanation follows (${acts.join(', ')})`, acts.includes('home') && acts.includes('place') && acts.length >= 4, acts);
    await click('[data-world-tour-done]');
    await waitFor(`document.querySelector('[data-world-tour]') === null`, 'the tour to close');
    check(P, 'the own progress is untouched (no tower conquered by the tour)', await ev(`document.querySelector('[data-world-won]') === null && document.querySelector('[data-world-goal-done]') === null`));
    /* Die Vorschau legt bei jedem Laden eine neue Baza an — gemerkt wird je Baza und Widok: der Schlüssel steht. */
    check(P, 'seen once: remembered on this device (it does not start again by itself)', await ev(`Object.keys(localStorage).some((k) => k.startsWith('cg-wm-tour:') && localStorage.getItem(k) === '1')`));
    keepTour = false;
  }

  if (runs('13')) {
    const P = '13 question paths';
    const canvas = (key) => ev(`document.querySelector('[data-world-canvas]')?.dataset.${key} ?? null`);
    await open();
    /* 2026-11-14 (Eigentümer) — nur, wo man losgehen kann: am Haus; an einem Turm erst, wenn er erobert ist (1854 und die Gabelung von L4 noch nicht). */
    check(P, 'signposts stand only where one can start now: at home (towers not yet conquered carry none)', Number(await canvas('wmSigns')), 1);
    await clickMap('home', '~home');
    await waitFor(`document.querySelector('[data-world-path-list]')`, 'the questions at home');
    check(P, 'home lists every question ("Czego chcesz się dowiedzieć?")', Number(await ev(`document.querySelector('[data-world-path-list]').dataset.worldPathList`)), 2);
    await shot('p13-home');
    /* 2026-11-12 (Eigentümer) — ein Wegweiser zeigt nur seine Fragen, jede ein Knopf; die Frage zeigt nur „Odkryj" (kein Text). */
    const fromSign = async () => {
      /* 2026-11-14 — ein Weg, dessen Schritte gegangen sind, hat keinen Wegweiser mehr: dann die Liste am Haus. */
      await clickMap('home', '~home');
      await waitFor(`document.querySelector('[data-world-path-open]')`, 'the questions of the signpost (or the house)');
      await click('[data-world-path-open]');
      await waitFor(`document.querySelector('[data-world-panel="path"]')`, 'the path panel from the signpost');
    };
    /* 2026-11-14 — der Wegweiser steht am Anfang des ganzen Weges (nicht unbedingt am Haus). */
    const signKey = (await canvas('wmSignKeys') ?? '').split(' ')[0] ?? '';
    await clickMap('sign', signKey);
    await waitFor(`document.querySelector('[data-world-panel="sign"]')`, 'the signpost panel');
    const sign = await ev(`(() => { const p = document.querySelector('[data-world-panel="sign"]'); return { buttons: p.querySelectorAll('button[data-world-path-open]').length, text: p.querySelectorAll('p, li, .cg-wm-meta').length }; })()`);
    check(P, 'a signpost shows only its questions, each one button, no other text', sign.buttons >= 1 && sign.text === 0, sign);
    await click('[data-world-panel="sign"] [data-world-path-open]');
    await waitFor(`document.querySelector('[data-world-panel="path"]')`, 'the path panel from the signpost');
    const panel = await ev(`(() => { const p = document.querySelector('[data-world-panel="path"]'); return { id: p.dataset.worldPath, state: p.dataset.worldPathState, buttons: [...p.querySelectorAll('.wk-actions button')].map((b) => Object.keys(b.dataset).join()), text: p.querySelectorAll('p, li, ol').length }; })()`);
    check(P, 'the question shows only "Odkryj" (the steps stand on the map)', panel.state === 'new' && panel.buttons.length === 1 && panel.buttons[0] === 'worldPathGo' && panel.text === 0, panel);
    for (let i = 0; i < 20 && (await canvas('wmRoute')) === ''; i += 1) await sleep(100);
    check(P, 'the chosen path is lit like any chosen route', (await canvas('wmRoute')) !== '', await canvas('wmRoute'));
    await shot('p13-path');
    await click('[data-world-path-go]');
    /* 2026-11-14 — wie „Prowadź mnie tutaj“: zuerst die Ansage des ersten Schrittes, dann „Start“. */
    await waitFor(`document.querySelector('[data-world-next-page] [data-world-announce="1"]')`, 'the announcement of the first step of the path', 15000);
    await startStep();
    await waitFor(`document.querySelector('[data-world-running]')`, 'the first step of the path', 15000);
    check(P, '"Odkryj" announces the first open step, then begins it (guided like "Prowadź mnie tutaj")', await ev(`document.querySelector('[data-world-running]').dataset.worldRunning`) !== '');
    /* Den ersten Schritt zu Ende gehen (eine Stufe, wie in Pfad 7): danach sind die Schritte erledigt, der Abschluss ist dran. */
    await ev(`(() => { const b = document.querySelector('[data-world-back], [data-world-run-back], [data-flow-close]'); if (b) b.click(); return true; })()`);
    await sleep(600);
    /* Der Weg pausiert (sonst steht „Zacznij tutaj“ über dem Turm, den der Klick sucht). */
    await ev(`(() => { const b = document.querySelector('[data-world-next-stop]'); if (b) b.click(); return true; })()`);
    await sleep(300);
    await clickMap('label', N.becchi);
    await waitFor(`document.querySelector('[data-world-panel="place"]')`, 'the place panel');
    await click('[data-world-my-settings]');
    await waitFor(`document.querySelector('[data-levels-n="1"]')`, 'my settings');
    await click('[data-levels-n="1"]');
    await waitFor(`document.querySelector('[data-world-panel="place"]')?.dataset.worldGate === 'ready'`, 'one level in force', 15000);
    await click('[data-world-run-for="1"]');
    await waitFor(`document.querySelector('[data-world-running="run"]')`, 'the run');
    await answerAll('[data-world-finish]');
    await sleep(800);
    await ev(`(() => { const f = document.querySelector('[data-world-finish-close]'); if (f) f.click(); return true; })()`);
    await sleep(1500);
    await fromSign();
    const half = await ev(`(() => { const p = document.querySelector('[data-world-panel="path"]'); return { state: p.dataset.worldPathState, check: p.querySelector('[data-world-path-check]') !== null, go: p.querySelector('[data-world-path-go]') !== null }; })()`);
    check(P, 'its step done but not the check: on the way, "Sprawdź się" instead of "Odkryj"', half.state === 'going' && half.check && !half.go, half);
    if (half.check) {
      await click('[data-world-path-check]');
      await answerAll('[data-world-finish], [data-world-panel="path"][data-world-path-state="done"]');
      await sleep(800);
      await ev(`(() => { const f = document.querySelector('[data-world-finish-close]'); if (f) f.click(); return true; })()`);
      await waitFor(`document.querySelector('[data-world-panel="path"]')`, 'the path panel after the check', 15000);
      const after = await ev(`(() => { const p = document.querySelector('[data-world-panel="path"]'); return { state: p.dataset.worldPathState, deeper: p.querySelector('[data-world-path-deeper]')?.dataset.worldPathDeeper ?? null, repeat: p.querySelector('[data-world-path-repeat].wk-btn-line') !== null, go: p.querySelector('[data-world-path-go]') !== null }; })()`);
      check(P, 'the check passed: the path is done — "Powtórz" outlined, "Głębiej", no "Odkryj"', after.state === 'done' && after.deeper !== null && after.repeat && !after.go, after);
      await shot('p13-done');
    }
  }

  const errors = page.console.filter((c) => c.level === 'exception' || c.level === 'error');
  check('all', 'no exceptions in the page', errors.filter((c) => c.level === 'exception').length === 0, errors.slice(0, 5));
} finally {
  await writeFile(join(outDir, 'click-paths.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(`\n${results.filter((r) => r.ok).length} ok, ${failed} failed`);
if (failed > 0) process.exit(1);
