/**
 * 0121 — VERSIEGELTE SEITEN, nachgemessen (ohne Dienst).
 *
 * Was hier gelten soll: eine Hülle geht nur mit IHREM Schlüssel, IHREM Etikett
 * und IHRER Fassung auf; was gepackt wird, kommt gleich zurück; der Schlüssel
 * der Seite geht über jeden Bereich auf, für den er verpackt ist, und über die
 * führende Rolle; eine ganze Seite kommt offen zurück, als wäre nichts — und
 * ohne Schlüssel leer und `locked`, nie als Hüllen.
 */
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/* Was die Module beim Laden anfassen — im Browser gäbe es das. */
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.window = globalThis;
globalThis.window.location = { hostname: 'recreatio.pl', hash: '', origin: 'https://recreatio.pl', pathname: '/' };
globalThis.addEventListener = () => undefined;
globalThis.removeEventListener = () => undefined;
globalThis.BroadcastChannel = undefined;

const workspace = await mkdtemp(join(tmpdir(), 'app-seal-'));
await build({
  entryPoints: ['src/app/pages/pageSeal.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: workspace,
  logLevel: 'error',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: 'http://svc.invalid' }) }
});

const m = await import(pathToFileURL(join(workspace, 'pageSeal.js')).href);

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

const SLUG = '01a15623-0000-7000-8000-000000000001';
const PART = '01a15623-0000-7000-8000-0000000000a1';
const FORM = '01a15623-0000-7000-8000-0000000000f1';
const AREA = '01a15623-0000-7000-8000-00000000aaaa';
const OTHER = '01a15623-0000-7000-8000-00000000bbbb';
const ROLE = '01a15623-0000-7000-8000-00000000cccc';
const random = () => crypto.getRandomValues(new Uint8Array(32));

/* ── Die Hülle ─────────────────────────────────────────────────────────────── */

const key = { id: SLUG, v: 3, key: random() };
const title = await m.sealPiece(key, m.sealAad.title(SLUG, 3), 'Rada parafialna — sprawy kadrowe');
check('a sealed piece has the envelope shape', [m.isEnvelope(title), title.startsWith('rcs1.3.')], [true, true]);
check('… and opens with its key, label and version', await m.openPiece(key, m.sealAad.title(SLUG, 3), title), 'Rada parafialna — sprawy kadrowe');
check('… not under another label (a title is no lead)', await m.openPiece(key, m.sealAad.lead(SLUG, 3), title), null);
check('… not for another page', await m.openPiece(key, m.sealAad.title(OTHER, 3), title), null);
check('… not under another version', await m.openPiece({ ...key, v: 4 }, m.sealAad.title(SLUG, 4), title), null);
check('… not with another key', await m.openPiece({ ...key, key: random() }, m.sealAad.title(SLUG, 3), title), null);
const flipped = title.slice(0, -3) + (title.at(-3) === 'A' ? 'B' : 'A') + title.slice(-2);
check('… and not when one character changed', await m.openPiece(key, m.sealAad.title(SLUG, 3), flipped), null);

const look = JSON.stringify({ show: { scenes: Array.from({ length: 40 }, (_, i) => ({ key: `s${i}`, label: `Scena ${i}`, change: 'fade', steps: 1 })) } });
const sealedLook = await m.sealPiece(key, m.sealAad.look(SLUG, 3), look);
check('JSON is packed before sealing: the envelope is shorter than the plain text', sealedLook.length < look.length, true);
check('… and comes back unchanged', await m.openPiece(key, m.sealAad.look(SLUG, 3), sealedLook), look);
check('short text is not packed and still comes back', await m.openPiece(key, m.sealAad.subject(SLUG, 3), await m.sealPiece(key, m.sealAad.subject(SLUG, 3), '{}')), '{}');
check('the empty string survives', await m.openPiece(key, m.sealAad.lead(SLUG, 3), await m.sealPiece(key, m.sealAad.lead(SLUG, 3), '')), '');

check('plain JSON is no envelope', [m.isEnvelope('{"a":1}'), m.isEnvelope('rcs1.x.abc'), m.isEnvelope(null)], [false, false, false]);

/* ── Der Schlüssel der Seite ───────────────────────────────────────────────── */

const areaKey = { epoch: 7, key: random() };
const roleKey = random();
const ring = { has: (id) => id === ROLE, keyOf: (id) => { if (id !== ROLE) throw new Error('no role'); return roleKey; } };
const made = await m.newPageKey(SLUG, 1, [AREA, OTHER], ROLE, ring, async (areaId) => {
  if (areaId === AREA) return areaKey;
  throw new Error('no key for this area');
});
check('a new page key is wrapped for each area this ring holds and for the leading role', made.wraps.map((w) => w.a ?? `role:${w.r}`), [AREA, `role:${ROLE}`]);
check('… with the area\'s newest epoch', made.wraps[0].e, 7);
check('… and says which areas it could not reach', made.missing, [OTHER]);

const info = { id: SLUG, v: 1, w: made.wraps };
const viaArea = await m.openPageKey(info, { keys: { areaKey: async (a, e) => (a === AREA && e === 7 ? areaKey.key : undefined), ring: null } });
check('it opens through the area', viaArea !== null && Buffer.from(viaArea.key).equals(Buffer.from(made.key.key)), true);
const viaRole = await m.openPageKey(info, { keys: { areaKey: async () => undefined, ring } });
check('… and through the leading role without any area key', viaRole !== null && Buffer.from(viaRole.key).equals(Buffer.from(made.key.key)), true);
const nobody = await m.openPageKey(info, { keys: { areaKey: async () => undefined, ring: null } });
check('… and not at all without either', nobody, null);
const wrongEpoch = await m.openPageKey(info, { keys: { areaKey: async (a, e) => (e === 6 ? areaKey.key : undefined), ring: null } });
check('… nor with a key of another epoch', wrongEpoch, null);
const otherPage = await m.openPageKey({ ...info, id: OTHER }, { keys: { areaKey: async () => areaKey.key, ring } });
check('a wrap does not open as the key of another page', otherPage, null);

/* ── Eine ganze Seite ──────────────────────────────────────────────────────── */

const pk = made.key;
const menuItems = [{ label: 'Spotkania', kind: 'rel', target: 'spotkania', children: [] }];
const raw = {
  path: 'parafia/rada', title: await m.sealPiece(pk, m.sealAad.title(SLUG, 1), 'Rada'),
  lead: await m.sealPiece(pk, m.sealAad.lead(SLUG, 1), 'Tylko dla rady.'),
  theme: await m.sealPiece(pk, m.sealAad.look(SLUG, 1), '{"mode":"dark"}'),
  logic: await m.sealPiece(pk, m.sealAad.logic(SLUG, 1), '{"rules":[]}'),
  subject: null,
  updatedAt: null, editable: true, mode: 'page', id: SLUG,
  parts: [
    { id: PART, kind: 'text', moduleId: PART,
      layout: await m.sealPiece(pk, m.sealAad.layout(PART, 1), '{"desktop":{"col":1}}'),
      config: await m.sealPiece(pk, m.sealAad.config({ id: PART, moduleId: PART }, 1), '{"body":"Protokół"}') },
    { id: FORM, kind: 'form', moduleId: FORM,
      layout: await m.sealPiece(pk, m.sealAad.layout(FORM, 1), '{"desktop":{"col":2}}'),
      config: '{"portalUnder":"parafia/rada"}' }
  ],
  menu: { from: 'parafia/rada', items: await m.sealPiece(pk, m.sealAad.menu(SLUG, 1), JSON.stringify(menuItems)) },
  seal: info
};

const keys = { areaKey: async (a, e) => (a === AREA && e === 7 ? areaKey.key : undefined), ring: null };
const opened = await m.openPageContent(raw, { keys });
check('a sealed page comes back open', [opened.content.title, opened.content.lead, opened.content.theme, opened.content.logic, opened.content.subject],
  ['Rada', 'Tylko dla rady.', '{"mode":"dark"}', '{"rules":[]}', null]);
check('… its parts too — a form keeps its plain settings', opened.content.parts.map((p) => [p.layout, p.config]),
  [['{"desktop":{"col":1}}', '{"body":"Protokół"}'], ['{"desktop":{"col":2}}', '{"portalUnder":"parafia/rada"}']]);
check('… and its menu, as items', opened.content.menu.items, menuItems);
check('… with its key for saving', opened.key !== null && opened.key.v === 1, true);

/* Ein Stück an der Stelle eines anderen: der Inhalt eines Bausteins als Anordnung eines anderen. */
const swapped = { ...raw, parts: [{ ...raw.parts[0], layout: raw.parts[1].layout }, raw.parts[1]] };
check('a layout moved onto another part does not open there', (await m.openPageContent(swapped, { keys })).content.parts[0].layout, '{}');

const locked = await m.openPageContent(raw, { keys: { areaKey: async () => undefined, ring: null } });
check('without a key the page is locked and empty — never envelopes on screen',
  [locked.content.locked, locked.content.title, locked.content.lead, locked.content.menu, locked.content.parts.map((p) => p.config), locked.key],
  [true, null, null, null, [null, '{"portalUnder":"parafia/rada"}'], null]);

const plain = { ...raw, seal: null, title: 'Offen' };
check('an open page passes through untouched', (await m.openPageContent(plain)).content.title, 'Offen');

check('titles in a list: open, opened, or nothing', [
  await m.openSealedTitle('Offen', null),
  await m.openSealedTitle(raw.title, null)
], ['Offen', null]);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
