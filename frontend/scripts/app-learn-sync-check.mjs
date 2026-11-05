/**
 * 2026-11-05 (Durchsicht) — WAS EIN LERNENDER HINTERLÄSST, ÜBER BAUSTEINE UND GERÄTE HINWEG (`cogita/learn.ts`), nachgemessen
 * gegen einen nachgebauten Dienst, der wie Cogita.cs je Halter, Baza, Bereich und Art nur den JÜNGSTEN Stapel `values`,
 * `suspend`, `position` behält und seitenweise antwortet.
 *
 *   1. Werte: zwei Bausteine derselben Person (die Wahl der Abstände, eine Erzählung) überschreiben einander nicht —
 *      live gehört, und jeder Stapel ist ein zusammengelegter Stand (holen, Änderungen darauf); auch zwischen Geräten,
 *      auch `keepStack`, `keepAwards` (das früheste Datum) und das Löschen (`keepSpacing(null)`); ohne Konto ebenso.
 *   2. Seiten: alle Seiten werden geholt (gleiche Zeiten an der Grenze: nichts fehlt, nichts doppelt), der jüngste
 *      Stapel zählt; ein älterer Dienst ohne `more`: eine Seite; ein Dienst, der nicht weiterkommt, hält nicht fest;
 *      die Kanzlei (`areaProgress`) ebenso.
 *   3. Ohne Netz: Stellen, Werte und Sperren gehen nie aus der Ablage hinaus, wie sie warteten — erst nach einem
 *      gelungenen Holen, zusammengelegt (ein beendeter Weg eines anderen Geräts bleibt beendet); ein alter wartender
 *      Stapel dieser Arten (einer älteren Fassung) wird beim Laden aufgenommen, nicht so gesendet.
 *   4. Ohne Netz gelernt: die Abstände der Abschrift (`spacingOfCopy` → `areaSpacing`).
 *   5. `postDue` wirft nie, bevor es ein Versprechen gibt (Termine ausserhalb des Kalenders).
 *
 *   node scripts/app-learn-sync-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-learn-sync-'));
const app = fileURLToPath(new URL('../src/app/', import.meta.url)).replace(/\\/g, '/');
const API = 'http://cogita.test';

/* Eine Ablage im Gedächtnis statt IndexedDB — je Modul-Instanz („Gerät") eine eigene. */
const stub = join(workspace, 'idb.ts').replace(/\\/g, '/');
await writeFile(stub, `
export const STORES = ['library', 'outbox', 'progress', 'offline'] as const;
export type StoreName = (typeof STORES)[number];
const mem = new Map<string, string>();
const k = (s: string, key: string) => s + '\\u0000' + key;
export const idbGet = async <T>(store: StoreName, key: string): Promise<T | null> => (mem.has(k(store, key)) ? JSON.parse(mem.get(k(store, key))!) as T : null);
export async function idbPut(store: StoreName, key: string, value: unknown): Promise<boolean> { mem.set(k(store, key), JSON.stringify(value)); return true; }
export async function idbDelete(store: StoreName, key: string): Promise<void> { mem.delete(k(store, key)); }
export async function idbKeys(store: StoreName, prefix = ''): Promise<string[]> {
  return [...mem.keys()].filter((x) => x.startsWith(store + '\\u0000' + prefix)).map((x) => x.slice(store.length + 1));
}
export async function idbClear(store: StoreName): Promise<void> { for (const x of [...mem.keys()]) if (x.startsWith(store + '\\u0000')) mem.delete(x); }
export async function idbForget(...stores: readonly StoreName[]): Promise<void> { for (const s of stores) await idbClear(s); }
`);
const entry = join(workspace, 'entry.ts');
await writeFile(entry, `
export { Learner, absorb, EMPTY_PROGRESS, sealBatch, flushOutbox, pending, areaProgress, postDue, allPages } from '${app}cogita/learn';
export { newWrapPair } from '${app}core/crypto';
export { idbPut, idbKeys } from '${app}core/idb';
export { PRESET_SPACING, OWN_FIRST, OWN_GROWTH, OWN_STACK, DEFAULT_STACK } from '${app}cogita/spacing';
export { DEFAULT_SPACING } from '${app}cogita/knowness';
export { spacingOfCopy } from '${app}cogita/offline';
`);
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: join(workspace, 'entry.mjs'),
  /* Der Dienst ist ein nachgebauter unter einem erfundenen Namen — nie der echte. */
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: API }) },
  loader: { '.css': 'empty' },
  logLevel: 'error',
  plugins: [{ name: 'idb-stub', setup(b) { b.onResolve({ filter: /core[\\/]idb$/ }, () => ({ path: stub })); } }]
});
globalThis.BroadcastChannel = undefined;
/* Jedes „Gerät" ist eine eigene Instanz des Moduls: eigener Speicher, eigene Ablage, eigene Live-Liste. */
const device = (name) => import(`${pathToFileURL(join(workspace, 'entry.mjs')).href}?device=${name}`);

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

/* -- Der nachgebaute Dienst ------------------------------------------------------------------------------------- */

const LATEST = new Set(['position', 'values', 'suspend']);
const iso = (ms) => new Date(ms).toISOString();
const service = {
  rows: [],
  clock: Date.now() - 3_600_000,
  /* Stapel je Millisekunde (> 1: gleiche Zeiten), Seite, ein älterer Dienst ohne Seiten, einer, der nicht weiterkommt. */
  perTick: 1, page: 1000, legacy: false, stuck: false, offline: false,
  log: [],
  due: [],
  reset() { this.rows = []; this.log = []; this.due = []; this.perTick = 1; this.page = 1000; this.legacy = false; this.stuck = false; this.offline = false; },
  stamp() { const at = this.clock; this.ticks = (this.ticks ?? 0) + 1; if (this.ticks >= this.perTick) { this.ticks = 0; this.clock += 1; } return at; },
  newest(kind) { return this.rows.filter((r) => r.kind === kind).sort((x, y) => x.createdAt - y.createdAt).at(-1); },
  posts(kind) { return this.log.filter((l) => l.method === 'POST' && (kind === undefined || l.kinds.includes(kind))).length; }
};
const order = (x, y) => x.createdAt - y.createdAt || (x.batchId < y.batchId ? -1 : x.batchId > y.batchId ? 1 : 0);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function pageOf(list, url, forArea) {
  const since = url.searchParams.get('since');
  const after = url.searchParams.get('after');
  let rows = list.slice().sort(order);
  if (since !== null) rows = rows.filter((r) => r.createdAt >= Date.parse(since) - 2000);
  if (after !== null) {
    const cut = after.lastIndexOf('_');
    const at = Date.parse(after.slice(0, cut));
    const id = after.slice(cut + 1);
    rows = rows.filter((r) => r.createdAt > at || (r.createdAt === at && r.batchId > id));
  }
  const out = (r) => ({ batchId: r.batchId, libraryId: r.libraryId, areaId: r.areaId, holderRoleId: r.holderRoleId, holderSeatId: null, kind: r.kind, sealed: r.sealed, key: forArea ? r.keyForArea ?? null : r.keyForHolder, createdAt: iso(r.createdAt), areaEpoch: null });
  if (service.legacy) return { now: iso(service.clock), forArea, batches: rows.map(out) };
  const more = rows.length > service.page;
  const shown = rows.slice(0, service.page);
  const last = shown.at(-1);
  if (service.stuck) return { now: iso(service.clock), forArea, batches: shown.map(out), more: true, next: 'nowhere_x' };
  return { now: more ? iso(last.createdAt) : iso(service.clock), forArea, batches: shown.map(out), more, next: more ? `${iso(last.createdAt)}_${last.batchId}` : null };
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  if (url.origin !== API) throw new Error(`refused: ${url.href}`);
  const method = init.method ?? 'GET';
  if (service.offline) throw new TypeError('offline');
  if (method === 'POST' && url.pathname === '/workspace/learn/batches') {
    const { batches } = JSON.parse(init.body);
    service.log.push({ method, path: url.pathname, kinds: batches.map((b) => b.kind) });
    const stored = [];
    for (const b of batches) {
      if (service.rows.some((r) => r.batchId === b.batchId)) { stored.push(b.batchId); continue; }
      if (LATEST.has(b.kind)) service.rows = service.rows.filter((r) => !(r.holderRoleId === b.holderRoleId && r.libraryId === b.libraryId && r.areaId === b.areaId && r.kind === b.kind));
      service.rows.push({ ...b, createdAt: service.stamp() });
      stored.push(b.batchId);
    }
    return json({ stored });
  }
  if (method === 'GET' && url.pathname === '/workspace/learn/batches') {
    service.log.push({ method, path: url.pathname, after: url.searchParams.has('after'), kinds: [] });
    return json(pageOf(service.rows.filter((r) => r.libraryId === url.searchParams.get('libraryId')), url, false));
  }
  const area = /^\/workspace\/learn\/area\/([^/]+)\/batches$/.exec(url.pathname);
  if (method === 'GET' && area !== null) {
    service.log.push({ method, path: '/area', after: url.searchParams.has('after'), kinds: [] });
    return json(pageOf(service.rows.filter((r) => r.areaId === area[1] && r.keyForArea !== undefined), url, true));
  }
  if (method === 'POST' && url.pathname === '/workspace/learn/due') {
    service.due.push(JSON.parse(init.body));
    return json({ ok: true });
  }
  if (method === 'GET' && url.pathname.startsWith('/intake/')) return json({ error: 'none' }, 404);
  throw new Error(`unexpected ${method} ${url.pathname}`);
};

try {
  const D = await device('main');
  const pair = await D.newWrapPair();
  const intake = await D.newWrapPair();
  const holder = { kind: 'role', roleId: 'r-anna', wrapPublicKey: pair.publicKey, wrapPrivate: async () => pair.privateKey };
  const target = { areaId: 'area-course', intake: intake.publicKey };
  const LIB = 'lib-sync';
  const ONCE = D.PRESET_SPACING.once;
  const LIGHTER = D.PRESET_SPACING.lighter;
  /* Ein Lernender, wie `useLearner` ihn macht (abonniert, geladen); `settle`: bis alles hinaus ist, was hinaus kann. */
  const learner = async (K, lib = LIB) => { const l = new K.Learner(lib, holder, target); l.subscribe(() => undefined); await l.load(); await l.sendPositions(); return l; };
  const settle = (l) => l.sendPositions();
  /* Was der Dienst jetzt hätte, für ein neues Gerät: dessen Lernender nach dem Laden. */
  let fresh = 0;
  const reload = async (lib = LIB) => learner(await device(`fresh-${fresh += 1}`), lib);
  const card = (key) => ({ key, question: key, direction: '', fingerprint: `fp-${key}`, template: 't', prompt: [], answer: { form: 'flash', back: [] }, explain: [], varies: false, requires: [] });

  /* ══ 1. Werte über Bausteine und Geräte ══════════════════════════════════════════════════════════════════════ */
  {
    service.reset();
    const P = await device('page');
    const settings = await learner(P);       /* „Ustawienia nauki" / die Wahl im Krajobraz */
    const story = await learner(P);          /* eine Erzählung auf derselben Seite */
    await settings.keepSpacing(ONCE);
    check('1 the story module hears the chosen spacing at once (same person, same base)', story.spacing, ONCE);
    /* Die Erzählung schreibt ihre Werte — mit den alten `~`-Werten, die sie beim Öffnen las. */
    await story.keepValues({ punkte: 4, [P.OWN_FIRST]: 900_000, [P.OWN_GROWTH]: 3 });
    check('1 the newest values batch has the points AND the spacing (review A3)', [service.newest('values') !== undefined, (await reload()).spacing, (await reload()).progress.values.punkte], [true, ONCE, 4]);

    await story.keepValues({ punkte: 9 });
    await settings.keepSpacing(LIGHTER);
    const back = await reload();
    check('1 the story set 9, then the spacing changed elsewhere: 9 stays (review A5)', [back.progress.values.punkte, back.spacing], [9, LIGHTER]);

    await settings.keepStack(15);
    await story.keepAwards({ 'pol-mapy': 2000 });
    await settings.keepAwards({ 'pol-mapy': 1000, 'cala-mapa': 3000 });
    await story.keepAwards({ 'pol-mapy': 5000 });
    const all = await reload();
    check('1 keepStack and keepAwards merge too (the earliest award date stays)', [all.progress.values.punkte, all.progress.values[P.OWN_STACK], all.progress.values['~award.pol-mapy'], all.progress.values['~award.cala-mapa'], all.spacing], [9, 15, 1000, 3000, LIGHTER]);

    await settings.keepSpacing(null);
    const none = await reload();
    check('1 removing the own spacing removes only it', [none.progress.values[P.OWN_FIRST], none.progress.values.punkte, none.progress.values[P.OWN_STACK], none.spacing], [undefined, 9, 15, D.DEFAULT_SPACING]);
    check('1 nothing changes: no batch (a later award date, the same points)', await (async () => { const n = service.posts('values'); await story.keepAwards({ 'cala-mapa': 9000 }); await story.keepValues({ punkte: 9 }); return service.posts('values') - n; })(), 0);

    /* Zwei Geräte: das Telefon lud früher und hört nichts vom Laptop — es holt vor dem Schreiben. */
    const phone = await learner(await device('phone'));
    const laptop = await learner(await device('laptop'));
    await laptop.keepSpacing(ONCE);
    await phone.keepValues({ punkte: 12 });
    const both = await reload();
    check('1 across devices: the stale phone writes its points on top of the laptop\'s spacing', [both.progress.values.punkte, both.spacing, both.progress.values[P.OWN_STACK]], [12, ONCE, 15]);
    await phone.suspend('t:q1', true);
    await laptop.suspend('t:q2', true);
    check('1 suspensions from two devices: both kept', [...(await reload()).progress.suspended].sort(), ['t:q1', 't:q2']);
  }

  /* ══ 1b. Ohne Konto: die Ablage dieses Browsers ═════════════════════════════════════════════════════════════ */
  {
    const L = await device('local');
    const who = { kind: 'local', id: 'browser-1' };
    const make = async () => { const l = new L.Learner(LIB, who, null); l.subscribe(() => undefined); await l.load(); return l; };
    const a = await make();
    const b = await make();
    await a.keepSpacing(ONCE);
    b.record(card('q1'), 1);
    await b.flush();
    await a.flush();
    const c = await make();
    check('1b no account: a chose the spacing, b answered and wrote — after a reload both are there (review B1)', [c.spacing, c.progress.answers.size], [ONCE, 1]);
    await b.keepValues({ punkte: 5 });
    a.record(card('q2'), 1);
    await a.flush();
    const d = await make();
    check('1b … and a\'s later write keeps b\'s points', [d.progress.values.punkte, d.progress.answers.size, d.spacing], [5, 2, ONCE]);
  }

  /* ══ 2. Alle Seiten ══════════════════════════════════════════════════════════════════════════════════════════ */
  {
    service.reset();
    const W = await device('writer');
    const w = await learner(W);
    service.perTick = 2;                     /* je zwei Stapel dieselbe Zeit — auch an den Grenzen der Seiten */
    for (let i = 0; i < 9; i += 1) { w.record(card(`p${i}`), 1); await w.flush(); }
    await w.keepValues({ punkte: 77 });       /* der jüngste Stapel: Werte */
    service.page = 3;
    service.log = [];
    const r = await reload();
    const gets = service.log.filter((l) => l.path === '/workspace/learn/batches');
    check('2 ten batches on four pages (3 per page, equal times at the borders): all nine answers, the newest values', [r.progress.answers.size, r.progress.values.punkte, gets.length, gets.filter((g) => g.after).length], [9, 77, 4, 3]);
    service.legacy = true;
    service.log = [];
    const old = await reload();
    check('2 an older service without pages: one call, everything', [old.progress.answers.size, service.log.filter((l) => l.path === '/workspace/learn/batches').length], [9, 1]);
    service.legacy = false;
    service.stuck = true;
    service.log = [];
    let stuckDone = false;
    const s = new (await device('stuck')).Learner(LIB, holder, target);
    await s.load().then(() => { stuckDone = true; }, () => { stuckDone = true; });
    check('2 a service that never moves on: stops after two calls (the same cursor), nothing hangs', [stuckDone, service.log.filter((l) => l.path === '/workspace/learn/batches').length <= 3], [true, true]);
    service.stuck = false;
    service.log = [];
    const rows = await D.areaProgress(target.areaId, LIB, intake.privateKey);
    check('2 the teacher pages through too (areaProgress)', [rows.length, rows[0]?.progress.answers.size, rows[0]?.progress.values.punkte, service.log.filter((l) => l.path === '/area').length], [1, 9, 77, 4]);
    service.page = 1000;
  }

  /* ══ 3. Ohne Netz: nie ein alter ganzer Stand ════════════════════════════════════════════════════════════════ */
  {
    service.reset();
    /* Die Uhr des Dienstes eine Stunde voraus: was er hier speichert, ist jünger als ein alter wartender Stapel (unten). */
    service.clock = Date.now() + 3_600_000;
    const Ph = await device('phone-3');
    const La = await device('laptop-3');
    const phone = await learner(Ph);
    const laptop = await learner(La);
    const t = Date.now();
    await laptop.keepPosition({ flow: 'story-a', step: 'a1', visited: ['a1'], at: t });
    await settle(laptop);
    /* Das Telefon ohne Netz: Erzählung B, eine eigene Einstellung, eine Sperre. */
    service.offline = true;
    await phone.keepPosition({ flow: 'story-b', step: 'b2', visited: ['b1', 'b2'], at: t + 10 });
    await phone.keepSpacing(ONCE);
    await phone.suspend('t:x', true);
    await phone.flush();
    await settle(phone);
    service.offline = false;
    const postsBefore = service.posts();
    /* Inzwischen beendet der Laptop Erzählung A (mit Ziel) und setzt Punkte. */
    await laptop.keepPosition({ flow: 'story-a', step: 'end', visited: ['a1', 'end'], at: t + 20, done: true, goals: ['g1'] });
    await laptop.keepValues({ punkte: 3 });
    await settle(laptop);
    check('3 offline: nothing of the phone went into the outbox (no position/values/suspend batch waits there)', (await Ph.pending(holder)).map((b) => b.kind), []);
    /* Wieder Netz: das Telefon holt, legt zusammen, sendet. */
    await phone.flush();
    await settle(phone);
    const now = await reload();
    const a = now.progress.positions.get('story-a');
    check('3 back online: the laptop\'s finished story stays finished, the phone\'s place is there (review C4)',
      [a?.done, a?.goals, a?.step, now.progress.positions.get('story-b')?.step], [true, ['g1'], 'end', 'b2']);
    check('3 … and the values and suspensions are merged, not replaced', [now.progress.values.punkte, now.spacing, [...now.progress.suspended]], [3, ONCE, ['t:x']]);
    check('3 the phone sent after it could pull (one POST with the three kinds)', service.log.slice(postsBefore).some((l) => l.method === 'POST' && ['position', 'values', 'suspend'].every((k) => l.kinds.includes(k))), true);

    /* Ein alter wartender Stapel (eine ältere Fassung legte ihn ohne Netz ab): nie so hinaus, beim Laden aufgenommen. */
    const Old = await device('old-version');
    const legacyPos = await Old.sealBatch(LIB, holder, target, { v: 1, kind: 'position', positions: [{ flow: 'story-c', step: 'c1', visited: ['c1'], at: t + 30 }, { flow: 'story-a', step: 'a1', visited: ['a1'], at: t - 5 }] });
    const legacyVal = await Old.sealBatch(LIB, holder, target, { v: 1, kind: 'values', values: { punkte: 1, extra: 7 } });
    for (const b of [legacyPos, legacyVal]) await Old.idbPut('outbox', `r:${holder.roleId}:${b.batchId}`, b);
    const before = service.posts();
    await Old.flushOutbox(holder);
    check('3 an old queued position/values batch is never posted as it waited (flushOutbox skips it)', service.posts() - before, 0);
    const olds = new Old.Learner(LIB, holder, target);
    olds.subscribe(() => undefined);
    await olds.load();
    await settle(olds);
    const merged = await reload();
    const pa = merged.progress.positions.get('story-a');
    check('3 … the learner takes it in when it loads: its place joins, the finished story stays finished, nothing waits',
      [merged.progress.positions.get('story-c')?.step, pa?.done, pa?.step, (await Old.pending(holder)).length], ['c1', true, 'end', 0]);
    check('3 … an old values batch adds what is new, but does not turn back newer points (it is older than the service\'s)', [merged.progress.values.extra, merged.progress.values.punkte, merged.spacing], [7, 3, ONCE]);
    /* Jünger als der Stand des Dienstes (die Uhr des Dienstes zurück): dann gelten auch seine geänderten Werte. */
    {
      const Older = await device('old-version-2');
      service.rows = service.rows.map((r) => ({ ...r, createdAt: r.createdAt - 7_200_000 }));
      const newer = await Older.sealBatch(LIB, holder, target, { v: 1, kind: 'values', values: { punkte: 50 } });
      await Older.idbPut('outbox', `r:${holder.roleId}:${newer.batchId}`, newer);
      const l = new Older.Learner(LIB, holder, target);
      l.subscribe(() => undefined);
      await l.load();
      await settle(l);
      const seen = await reload();
      check('3 … a queued values batch NEWER than the service\'s changes the points too (nothing deleted)', [seen.progress.values.punkte, seen.progress.values.extra, seen.spacing], [50, 7, ONCE]);
      await laptop.refresh();
      await laptop.keepValues({ punkte: 3 });
    }

    /* Kein Netz beim Holen: nichts geht hinaus; der nächste Versuch schickt den zusammengelegten Stand. */
    service.offline = true;
    await laptop.keepValues({ punkte: 30 });
    service.offline = false;
    check('3 a failed pull sends nothing — the change waits', (await reload()).progress.values.punkte, 3);
    await settle(laptop);
    check('3 … and goes out on the next try', (await reload()).progress.values.punkte, 30);
  }

  /* ══ 4. Ohne Netz gelernt: die Abstände der Abschrift ════════════════════════════════════════════════════════ */
  {
    const O = await device('away');
    const copy = (spacing) => ({ libraryId: LIB, revisionId: 'rev', name: 'R', plan: {}, cards: [], deps: [], target: null, holder: null, savedAt: 0, ...(spacing === undefined ? {} : { spacing }) });
    const off = new O.Learner(LIB, { kind: 'local', id: 'away' }, null);
    off.areaSpacing = O.spacingOfCopy(copy({ ...ONCE, locked: false }));
    check('4 offline: the spacing kept with the copy applies (not the default)', off.spacing, ONCE);
    off.areaSpacing = O.spacingOfCopy(copy(undefined));
    check('4 an older copy without spacing: the default', off.spacing, O.DEFAULT_SPACING);
    await off.keepSpacing(LIGHTER);
    off.areaSpacing = O.spacingOfCopy(copy({ ...ONCE, locked: false }));
    check('4 the learner\'s own spacing (when it could be loaded) wins over the copy\'s', off.spacing, LIGHTER);
    off.areaSpacing = O.spacingOfCopy(copy({ ...ONCE, locked: true }));
    check('4 … unless the area locked it when the copy was kept', off.spacing, ONCE);
    check('4 junk in a copy is ignored', O.spacingOfCopy(copy({ first: 'x', growth: 3 })), undefined);
  }

  /* ══ 5. postDue wirft nie synchron ═════════════════════════════════════════════════════════════════════════ */
  {
    service.reset();
    const results = [];
    for (const due of [8.64e15 + 1, Number.POSITIVE_INFINITY, Number.NaN, -5, Date.UTC(2027, 0, 1)]) {
      let threw = false;
      let p;
      try { p = D.postDue(holder, LIB, due, Number.NaN); } catch { threw = true; }
      results.push([threw, p instanceof Promise]);
      await p?.catch(() => undefined);
    }
    check('5 postDue returns a promise for every date (no synchronous RangeError)', results.every(([threw, isPromise]) => !threw && isPromise), true);
    check('5 … out of range is clamped or dropped, the count is a number', service.due.map((d) => [d.dueAt, d.dueCount]),
      [['9999-01-01T00:00:00.000Z', 0], [null, 0], [null, 0], ['1970-01-01T00:00:00.000Z', 0], ['2027-01-01T00:00:00.000Z', 0]]);
  }
} finally {
  globalThis.fetch = realFetch;
  await rm(workspace, { recursive: true, force: true });
}

if (failed > 0) {
  console.error(`\n${failed} of ${failed + passed} checks FAILED.`);
  process.exit(1);
}
console.log(`\n${passed} checks pass.`);
process.exit(0);
