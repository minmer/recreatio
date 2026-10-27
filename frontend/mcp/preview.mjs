/**
 * 2026-10-27 — DIE VORSCHAU FÜR ASSISTENTEN: ein Dokument der Seite, so
 * gezeichnet, wie es nach dem Import auf recreatio.pl stünde — in mehreren
 * Grössen, hell und dunkel, Slajd für Slajd, Szene für Szene, Wechsel für
 * Wechsel —, gemessen und beschrieben.
 *
 * Gezeichnet wird von der echten Anwendung (`preview.html`,
 * `src/app/preview/`); hier wird nur gesteuert: der Dienst, der sie ausliefert
 * (`host.mjs`), der Browser ohne Fenster (`cdp.mjs`), die Blätter (`sheet.mjs`)
 * und der Bericht (`report.mjs`). Tabs bleiben offen (je Grösse und Farbschema
 * einer) und werden neu geladen, sobald sich die Quellen ändern.
 */

import { randomBytes } from 'node:crypto';
import { existsSync, watch } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';

import { Browser } from './cdp.mjs';
import { startHost } from './host.mjs';
import { captureText, checkText, moduleLine, sideText, viewHeading } from './report.mjs';
import { slices, Studio } from './sheet.mjs';

/** Benannte Bildschirme — oder „BREITExHÖHE". Am Telefon und Tablet mit Berührung. */
export const VIEWPORTS = {
  phone: { width: 390, height: 844, mobile: true },
  'phone-small': { width: 360, height: 740, mobile: true },
  tablet: { width: 820, height: 1180, mobile: true },
  'tablet-landscape': { width: 1180, height: 820, mobile: true },
  laptop: { width: 1280, height: 800, mobile: false },
  desktop: { width: 1440, height: 900, mobile: false },
  wide: { width: 1920, height: 1080, mobile: false }
};

export class UserError extends Error {}

export function viewportOf(said) {
  const name = String(said).trim().toLowerCase();
  if (VIEWPORTS[name] !== undefined) return { name, ...VIEWPORTS[name] };
  const hit = /^(\d{3,4})\s*[x×]\s*(\d{3,4})$/.exec(name);
  if (hit === null) throw new UserError(`Unknown viewport "${said}" — use ${Object.keys(VIEWPORTS).join(', ')} or WIDTHxHEIGHT (e.g. 1366x768).`);
  const width = Math.min(3840, Math.max(320, Number(hit[1])));
  const height = Math.min(2400, Math.max(400, Number(hit[2])));
  return { name: `${width}x${height}`, width, height, mobile: width < 1024 };
}

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.pdf': 'application/pdf'
};

/** Eine lange Seite wird höchstens so hoch aufgenommen (px) — darüber bricht die Grafik der Browser ab. */
const MAX_PAGE = 16000;
/** Höchstens so viele Aufnahmen je Bildschirm (Slajdy, Schritte). */
const MAX_SHOTS = 40;
/** Ein Blatt höchstens so gross: ein Modell liest es ohne Verkleinerung. */
const SHEET = 1580;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Zonen einer Präsentation wie `zonesOf` (presentationMotion.ts): je Szene ihre Schritte, eine Einheit dazwischen. */
function zonesFor(route, scenes) {
  const steps = new Map(scenes.map((s) => [s.key, s.steps]));
  const out = [];
  let at = 0;
  for (const key of route) {
    const count = Math.max(1, Math.round(steps.get(key) ?? 1));
    out.push({ key, at, to: at + count - 1 });
    at += count;
  }
  return out;
}

/** Wie stark eine Aufnahme dieser Breite auf einem Blatt verkleinert wird. */
const pageScale = (w) => (w <= 480 ? 1 : w <= 900 ? 0.62 : w <= 1500 ? 0.5 : 0.4);
const thumbScale = (w) => (w <= 480 ? 0.5 : w <= 900 ? 0.34 : w <= 1500 ? 0.3 : 0.24);

export class Previewer {
  constructor({ repo, frontend, renderer = 'source', api = 'https://api.recreatio.pl', out = join(tmpdir(), 'recreatio-preview'), log = () => {}, anyFile = true }) {
    this.repo = repo;
    this.frontend = frontend;
    this.renderer = renderer;
    this.api = api;
    this.out = out;
    this.log = log;
    this.anyFile = anyFile;
    this.host = null;
    this.browser = null;
    this.studio = null;
    this.tabs = new Map();
    this.generation = 0;
    this.starting = null;
    this.queue = Promise.resolve();
  }

  /** Eine Arbeit nach der anderen — zwei Aufrufe teilen sich die Tabs nicht. */
  serial(work) {
    const run = this.queue.then(work, work);
    this.queue = run.catch(() => undefined);
    return run;
  }

  get rendererWord() {
    if (/^https?:\/\//.test(this.renderer)) return `deployed preview at ${this.renderer}`;
    return { source: 'source (working tree, frontend/src via Vite)', site: 'site (built docs/ — what recreatio.pl serves once pushed)', dist: 'dist (frontend/dist build)' }[this.renderer] ?? this.renderer;
  }

  async start() {
    if (this.starting !== null) return this.starting;
    this.starting = (async () => {
      if (!/^https?:\/\//.test(this.renderer)) {
        this.host = await startHost({ renderer: this.renderer, frontend: this.frontend, repo: this.repo, api: this.api, log: this.log });
        this.log(`preview host ${this.host.url} (${this.renderer})`);
        if (this.renderer === 'source') {
          try {
            watch(join(this.frontend, 'src'), { recursive: true }, () => { this.generation += 1; });
          } catch { /* ohne Beobachter: Tabs werden nicht neu geladen */ }
        }
      }
      this.browser = await Browser.launch({ log: this.log });
      this.studio = await Studio.open(this.browser);
    })();
    try {
      await this.starting;
    } catch (e) {
      this.starting = null;
      throw e;
    }
    return this.starting;
  }

  previewUrl(query = 'driver') {
    if (/^https?:\/\//.test(this.renderer)) {
      const url = new URL(this.renderer);
      if (!url.pathname.endsWith('.html')) url.pathname = `${url.pathname.replace(/\/+$/, '')}/preview.html`;
      url.search = query;
      return url.href;
    }
    return `${this.host.url}/preview.html?${query}`;
  }

  /** Ein Tab je Bildschirm, Farbschema und Bewegung — geladen, mit der Vorschau bereit. */
  async tab(vp, scheme, reduced) {
    await this.start();
    const key = `${vp.width}x${vp.height}:${vp.mobile}:${scheme}:${reduced}`;
    let tab = this.tabs.get(key);
    if (tab !== undefined && (tab.generation !== this.generation || tab.uses >= 25 || this.browser.closed)) {
      await tab.page.close().catch(() => {});
      this.tabs.delete(key);
      tab = undefined;
    }
    if (tab === undefined) {
      if (this.browser.closed) {
        this.starting = null;
        this.tabs.clear();
        await this.start();
      }
      const page = await this.browser.newPage({ width: vp.width, height: vp.height, mobile: vp.mobile, dark: scheme === 'dark', reduced });
      const generation = this.generation;
      await page.navigate(this.previewUrl('driver'));
      const until = Date.now() + 120000;
      while (!(await page.evaluate('typeof window.recreatioPreview === "object"').catch(() => false))) {
        if (Date.now() > until) throw new Error('The preview page did not start in 120 s (see the console of the renderer).');
        await sleep(150);
      }
      tab = { page, generation, uses: 0 };
      this.tabs.set(key, tab);
    }
    tab.uses += 1;
    tab.page.console.length = 0;
    return tab.page;
  }

  /* -- Was der Aufruf mitbringt ------------------------------------------------------ */

  async readFileArg(path) {
    const full = isAbsolute(path) ? path : [resolve(this.repo, path), resolve(process.cwd(), path)].find((one) => existsSync(one)) ?? resolve(this.repo, path);
    if (!this.anyFile) {
      const inside = relative(this.repo, full);
      if (inside.startsWith('..') || isAbsolute(inside)) throw new UserError(`Only files inside the repository can be read here: ${path}`);
    }
    try {
      return { full, bytes: await readFile(full) };
    } catch {
      throw new UserError(`Cannot read the file ${full}`);
    }
  }

  async docOf(args) {
    if (args.file !== undefined && args.file !== null && String(args.file).trim() !== '') {
      const { bytes } = await this.readFileArg(String(args.file));
      return bytes.toString('utf8').replace(/^﻿/, '');
    }
    if (args.json === undefined || args.json === null) throw new UserError('Give the page document as "json" (object or text) or "file" (path to a .json file).');
    return args.json;
  }

  /** Eine Datei als `data:`-Adresse (oder eine Adresse im Netz, wie sie ist). */
  async fileUrl(said) {
    const value = String(said).trim();
    if (/^(https?:|data:)/i.test(value)) return value;
    const { full, bytes } = await this.readFileArg(value);
    if (bytes.length > 30 * 1024 * 1024) throw new UserError(`${full} is larger than 30 MB.`);
    const type = MIME[extname(full).toLowerCase()] ?? 'application/octet-stream';
    return `data:${type};base64,${bytes.toString('base64')}`;
  }

  async inputOf(args) {
    const doc = await this.docOf(args);
    const files = {};
    for (const [key, value] of Object.entries(args.images ?? {})) files[key] = await this.fileUrl(value);
    return {
      doc,
      path: args.path ?? null,
      basePath: args.basePath ?? null,
      options: args.replace === undefined ? null : { replace: args.replace === true },
      files,
      live: args.live !== false,
      imagesDir: args.imagesDir ?? null
    };
  }

  /** Dateien eines Ordners zu den Bitten ("images") — nach "name", sonst nach dem Schlüssel als Dateiname. */
  async matchDir(input, needs) {
    if (input.imagesDir === null || needs.length === 0) return;
    const dir = isAbsolute(input.imagesDir) ? input.imagesDir : resolve(this.repo, input.imagesDir);
    const names = await readdir(dir).catch(() => { throw new UserError(`Cannot read the folder ${dir}`); });
    const bare = (one) => one.toLowerCase().replace(/\.[a-z0-9]{1,5}$/, '');
    for (const need of needs) {
      if (input.files[need.key] !== undefined) continue;
      const hit = names.find((one) => need.name !== null && one.toLowerCase() === String(need.name).toLowerCase())
        ?? names.find((one) => need.name !== null && bare(one) === bare(String(need.name)))
        ?? names.find((one) => bare(one) === need.key.toLowerCase());
      if (hit !== undefined && (await stat(join(dir, hit))).isFile()) input.files[need.key] = await this.fileUrl(join(dir, hit));
    }
  }

  async runDir(check) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const slug = (check?.path ?? 'page').replace(/[^a-z0-9]+/gi, '-').slice(0, 40);
    const dir = join(this.out, `${stamp}-${slug}-${randomBytes(2).toString('hex')}`);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  /** Ein Link für den Menschen: dieselbe Vorschau im eigenen Browser (solange dieser Dienst läuft). */
  humanLink(input) {
    if (this.host === null) return null;
    const id = randomBytes(6).toString('hex');
    const { imagesDir: _dir, ...body } = input;
    this.host.keep(id, body);
    return `${this.host.url}/preview.html?doc=${id}`;
  }

  /* -- In der Seite ------------------------------------------------------------------ */

  async load(page, input) {
    const loaded = await page.call(async (i) => window.recreatioPreview.load(i), input);
    if (loaded.error) throw new UserError(loaded.error);
    return loaded;
  }

  measure(page) {
    return page.call(() => window.recreatioPreview.measure());
  }

  settle(page, timeout) {
    return page.call(async (t) => window.recreatioPreview.settle(t), timeout);
  }

  /** Den Kontrast der Texte am Bild messen und als Befund an die Bausteine hängen. */
  async contrast(png, measure) {
    const samples = [];
    measure.items.forEach((item, i) => item.texts.forEach((t) => samples.push({ ...t, item: i })));
    if (samples.length === 0) return;
    const ratios = await this.studio.contrast(png, samples.map((s) => ({ rect: s.rect, color: s.color })));
    const low = new Map();
    samples.forEach((s, k) => {
      const ratio = ratios[k];
      const need = s.big ? 3 : 4.5;
      if (ratio === null || ratio >= need) return;
      const list = low.get(s.item) ?? [];
      list.push({ ratio, need, text: s.text });
      low.set(s.item, list);
    });
    for (const [i, list] of low) {
      list.sort((a, b) => a.ratio - b.ratio);
      const item = measure.items[i];
      item.findings = [...item.findings, ...list.slice(0, 2).map((one) => ({ kind: 'contrast', detail: `„${one.text}” — ${one.ratio}:1 on the rendered picture (needs ${one.need}:1)` }))];
    }
  }

  /** Rahmen und Namen der Bausteine für das Blatt: rot, wo etwas zu tun ist, sonst blau. */
  marksOf(measure, labels) {
    return measure.items.filter((item) => item.rect.w > 0 && item.rect.h > 0).map((item) => ({
      x: item.rect.x, y: item.rect.y, w: item.rect.w, h: item.rect.h,
      label: (labels[item.id] ?? item.kind).split(' ')[0],
      color: item.findings.length > 0 ? '#e0115f' : '#1565c0'
    }));
  }

  /** Eine Ansicht abfahren: die Seite ganz, jeden Slajd, jeden Schritt jeder Szene. */
  async captureView(page, loaded, vp) {
    const captures = [];
    const labels = (await this.measure(page)).labels;
    const shoot = async (meta, clip = null, beyond = false) => {
      const measure = await this.measure(page);
      const png = await page.screenshot({ clip, beyond });
      await this.contrast(png, measure);
      captures.push({ ...meta, view: loaded.view, measure, png, labels });
    };

    if (loaded.view === 'page') {
      const m = await this.measure(page);
      const height = Math.max(vp.height, Math.min(m.page.h, MAX_PAGE));
      await shoot({ kind: 'page', label: 'page', cut: m.page.h > MAX_PAGE ? m.page.h : null }, { x: 0, y: 0, width: vp.width, height }, true);
    } else if (loaded.view === 'slides') {
      let track = await page.call(() => window.recreatioPreview.deck());
      const count = track?.slides.length ?? 0;
      for (let i = 0; i < Math.min(count, MAX_SHOTS); i += 1) {
        track = await page.call(() => window.recreatioPreview.deck());
        const slide = track?.slides[i];
        if (slide === undefined) break;
        await page.call(async (at) => window.recreatioPreview.holdDeck(at), slide.start);
        await this.settle(page, 4000);
        track = await page.call(() => window.recreatioPreview.deck());
        const now = track?.slides[i] ?? slide;
        await page.call(async (at) => window.recreatioPreview.holdDeck(at), now.start);
        await shoot({ kind: 'slide', index: i, key: now.key, label: `S${i + 1} ${now.label}`, at: 'start', height: now.height, travel: now.travel });
        if (now.travel > 40) {
          await page.call(async (at) => window.recreatioPreview.holdDeck(at), now.start + now.travel);
          await this.settle(page, 2500);
          await shoot({ kind: 'slide', index: i, key: now.key, label: `S${i + 1} ${now.label} (end)`, at: 'end', height: now.height, travel: now.travel });
        }
      }
      await page.call(async () => window.recreatioPreview.holdDeck(null));
      if (count > MAX_SHOTS) captures.truncated = count;
    } else if (loaded.view === 'presentation') {
      const info = await page.call(() => window.recreatioPreview.show());
      const route = info?.route?.length > 0 ? info.route : loaded.check.show?.route ?? [];
      const zones = zonesFor(route, loaded.check.show?.scenes ?? []);
      let shots = 0;
      for (const zone of zones) {
        for (let s = zone.at; s <= zone.to; s += 1) {
          if (shots >= MAX_SHOTS) { captures.truncated = zones.reduce((n, z) => n + z.to - z.at + 1, 0); break; }
          await page.call(async (at) => window.recreatioPreview.goShow(at), s);
          await this.settle(page, 3000);
          await page.call(async (at) => window.recreatioPreview.goShow(at), s);
          const steps = zone.to - zone.at + 1;
          await shoot({ kind: 'scene', key: zone.key, step: s - zone.at + 1, steps, s, label: `${zone.key}${steps > 1 ? ` ${s - zone.at + 1}/${steps}` : ''}` });
          shots += 1;
        }
      }
      captures.route = route;
    }
    captures.labels = labels;
    return captures;
  }

  /* -- Blätter ----------------------------------------------------------------------- */

  /** Eine lange Seite in Spalten — so viele Blätter wie nötig. */
  async pageSheets(view, capture, annotate) {
    const scale = pageScale(view.vp.width);
    const columnPx = Math.floor(1460 / scale);
    const total = Math.max(view.vp.height, Math.min(capture.measure.page.h, MAX_PAGE));
    const parts = slices(Math.round(total), columnPx);
    const perSheet = Math.max(1, Math.floor(SHEET / (view.vp.width * scale + 14)));
    const marks = annotate ? this.marksOf(capture.measure, capture.labels ?? {}) : undefined;
    const sheets = [];
    for (let i = 0; i < parts.length; i += perSheet) {
      const group = parts.slice(i, i + perSheet);
      const tiles = group.map((p) => ({
        png: capture.png,
        crop: { x: 0, y: p.y, w: view.vp.width, h: p.h },
        scale,
        label: `${p.y}–${p.y + p.h} px`,
        marks
      }));
      sheets.push(await this.studio.compose({
        tiles, columns: group.length,
        title: `${view.vp.name} ${view.vp.width}×${view.vp.height} · ${view.scheme} — page ${Math.round(capture.measure.page.h)} px tall${parts.length > perSheet ? ` (sheet ${Math.floor(i / perSheet) + 1}/${Math.ceil(parts.length / perSheet)})` : ''}${scale < 1 ? ` · shown at ${Math.round(scale * 100)}%` : ''}`
      }));
    }
    return sheets;
  }

  /** Slajdy oder Schritte als Raster kleiner Bilder. */
  async gridSheets(view, captures, annotate, title) {
    const scale = thumbScale(view.vp.width);
    const w = view.vp.width * scale;
    const columns = Math.max(1, Math.min(captures.length, Math.floor(SHEET / (w + 14))));
    const rowH = view.vp.height * scale + 40;
    const rows = Math.max(1, Math.floor(SHEET / rowH));
    const sheets = [];
    for (let i = 0; i < captures.length; i += columns * rows) {
      const group = captures.slice(i, i + columns * rows);
      sheets.push(await this.studio.compose({
        columns,
        title: `${title}${captures.length > columns * rows ? ` (${Math.floor(i / (columns * rows)) + 1}/${Math.ceil(captures.length / (columns * rows))})` : ''}`,
        tiles: group.map((c) => ({
          png: c.png, scale, label: c.label.slice(0, 48),
          sub: c.measure.items.some((it) => it.findings.length > 0) ? `⚠ ${c.measure.items.reduce((n, it) => n + it.findings.length, 0)} finding(s)` : undefined,
          marks: annotate ? this.marksOf(c.measure, c.labels ?? {}) : undefined
        }))
      }));
    }
    return sheets;
  }

  /** Einzelne Bilder in voller Grösse (höchstens 1280 px breit). */
  async fullImages(view, captures, limit) {
    const out = [];
    for (const c of captures.slice(0, limit)) {
      if (c.kind === 'page') {
        const h = Math.max(view.vp.height, Math.min(c.measure.page.h, MAX_PAGE));
        for (let y = 0; y < h && out.length < limit; y += view.vp.height) {
          const scale = Math.min(1, 1280 / view.vp.width);
          out.push({
            label: `${view.vp.name} · ${view.scheme} — page ${y}–${Math.min(h, y + view.vp.height)} px`,
            sheet: await this.studio.compose({ columns: 1, tiles: [{ png: c.png, crop: { x: 0, y, w: view.vp.width, h: Math.min(view.vp.height, h - y) }, scale }] })
          });
        }
      } else {
        const scale = Math.min(1, 1280 / view.vp.width);
        out.push({ label: `${view.vp.name} · ${view.scheme} — ${c.label}`, sheet: await this.studio.compose({ columns: 1, tiles: [{ png: c.png, scale }] }) });
      }
    }
    return out;
  }

  /** Ausschnitte um bestimmte Bausteine (M3), Slajdy (S2) oder Szenen (ihr Schlüssel). */
  async focusImages(view, captures, focus) {
    const out = [];
    const labels = captures.labels ?? {};
    const idOf = Object.fromEntries(Object.entries(labels).map(([id, label]) => [label.split(' ')[0].toLowerCase(), id]));
    for (const said of focus) {
      const want = String(said).trim().toLowerCase();
      if (/^m\d+$/.test(want)) {
        const id = idOf[want];
        for (const c of captures) {
          const item = c.measure.items.find((it) => it.id === id);
          if (item === undefined) continue;
          const pad = 16;
          const crop = {
            x: Math.max(0, item.rect.x - pad), y: Math.max(0, item.rect.y - pad),
            w: Math.min(view.vp.width - Math.max(0, item.rect.x - pad), item.rect.w + 2 * pad),
            h: Math.min(Math.max(1, item.rect.h + 2 * pad), 3000)
          };
          if (crop.w <= 0 || crop.h <= 0) continue;
          const scale = Math.min(1, 1280 / crop.w, 1500 / crop.h);
          out.push({ label: `${view.vp.name} · ${view.scheme} — ${labels[id] ?? want} (${c.label})`, sheet: await this.studio.compose({ columns: 1, tiles: [{ png: c.png, crop, scale }] }) });
          if (c.kind === 'page') break;
        }
      } else {
        const hits = captures.filter((c) => (/^s\d+$/.test(want) && c.kind === 'slide' && c.index === Number(want.slice(1)) - 1) || (c.kind === 'scene' && c.key.toLowerCase() === want));
        for (const c of hits) out.push({ label: `${view.vp.name} · ${view.scheme} — ${c.label}`, sheet: await this.studio.compose({ columns: 1, tiles: [{ png: c.png, scale: Math.min(1, 1280 / view.vp.width) }] }) });
      }
    }
    return out;
  }

  /* -- Die Werkzeuge ------------------------------------------------------------------ */

  async check(args) {
    return this.serial(async () => {
      const input = await this.inputOf(args);
      const page = await this.tab(viewportOf('desktop'), 'light', false);
      const check = await page.call(async (i) => window.recreatioPreview.check(i), input);
      if (check.error) throw new UserError(check.error);
      return { text: checkText(check, { renderer: this.rendererWord }), check };
    });
  }

  async format(args) {
    return this.serial(async () => {
      const page = await this.tab(viewportOf('desktop'), 'light', false);
      return page.call((kind) => window.recreatioPreview.format(kind), args.kind ?? null);
    });
  }

  async preview(args) {
    return this.serial(async () => {
      const input = await this.inputOf(args);
      const vps = (args.viewports?.length > 0 ? args.viewports : ['phone', 'desktop']).map(viewportOf);
      const schemes = args.theme === 'both' ? ['light', 'dark'] : [args.theme === 'dark' ? 'dark' : 'light'];
      const reduced = args.reducedMotion === true;
      const annotate = args.annotate !== false;
      const views = [];
      let check = null;
      let step = 0;
      for (const scheme of schemes) {
        for (const vp of vps) {
          args.onProgress?.(step, vps.length * schemes.length, `rendering ${vp.name} ${vp.width}×${vp.height} · ${scheme}`);
          step += 1;
          const page = await this.tab(vp, scheme, reduced);
          if (check === null) {
            const first = await page.call(async (i) => window.recreatioPreview.check(i), input);
            if (first.error) throw new UserError(first.error);
            await this.matchDir(input, first.needs);
          }
          const loaded = await this.load(page, input);
          check ??= loaded.check;
          const captures = await this.captureView(page, loaded, vp);
          const fetches = await page.call(() => window.recreatioPreview.fetches());
          views.push({ vp, scheme, reduced, view: loaded.view, settled: loaded.settled, captures, console: [...page.console], fetches });
        }
      }

      const dir = await this.runDir(check);
      const images = [];
      const lines = [checkText(check, { renderer: this.rendererWord }), ''];
      lines.push(`# How it renders (${views.length} view${views.length === 1 ? '' : 's'})`);
      for (const view of views) {
        lines.push('', viewHeading(view));
        for (const c of view.captures) {
          const file = join(dir, `${view.vp.name}-${view.scheme}-${c.kind}${c.index !== undefined ? `-${String(c.index + 1).padStart(2, '0')}${c.at === 'end' ? 'b' : ''}` : c.key !== undefined ? `-${c.key}-${c.step}` : ''}.png`);
          await writeFile(file, c.png);
          c.file = file;
          if (c.kind === 'page') {
            lines.push(`Page ${c.measure.page.w}×${c.measure.page.h} px${c.cut === null || c.cut === undefined ? '' : ` (picture cut at ${MAX_PAGE} px of ${c.cut})`}${c.measure.menu === null ? '' : ` · menu ${c.measure.menu.items} item(s) in ${c.measure.menu.rows} row(s)`}`);
            lines.push(...captureText(c, view.captures.labels));
          } else {
            const head = c.kind === 'slide'
              ? `### ${c.label}${c.travel > 40 && c.at === 'start' ? ` — content ${Math.round(c.height)} px: scrolls inside the slide (+${Math.round(c.travel)} px below the screen)` : ''}`
              : `### scene ${c.label} (s=${c.s})`;
            lines.push(head, ...captureText(c, view.captures.labels));
          }
        }
        if (view.captures.truncated) lines.push(`- (only the first ${MAX_SHOTS} of ${view.captures.truncated} pictures were taken — use "focus")`);
        if (view.view === 'presentation' && check.show !== null && view.captures.route !== undefined && view.captures.route.join() !== check.show.route.join()) {
          lines.push(`- the live route differs from the plan: ${view.captures.route.join(' → ')}`);
        }
        lines.push(...sideText(view));

        const sheets = view.view === 'page'
          ? await this.pageSheets(view, view.captures[0], annotate)
          : await this.gridSheets(view, view.captures, annotate, `${view.vp.name} ${view.vp.width}×${view.vp.height} · ${view.scheme} — ${view.view === 'slides' ? `${view.captures.length} slide picture(s)` : `${view.captures.length} scene step(s)`}`);
        sheets.forEach((sheet, i) => images.push({ label: `${view.vp.name} · ${view.scheme} — overview${sheets.length > 1 ? ` ${i + 1}/${sheets.length}` : ''}`, sheet }));
        if (args.detail === 'full') images.push(...await this.fullImages(view, view.captures, 12));
        if (Array.isArray(args.focus) && args.focus.length > 0) images.push(...await this.focusImages(view, view.captures, args.focus));
      }

      for (const [i, one] of images.entries()) {
        one.file = join(dir, `sheet-${String(i + 1).padStart(2, '0')}.jpg`);
        await writeFile(one.file, one.sheet.buffer);
      }
      const link = this.humanLink(input);
      lines.push('', '## Files', `- folder: ${dir}`, ...images.map((one) => `- ${one.label}: ${one.file}`));
      if (link !== null) lines.push(`- open this preview in a browser (while the preview server runs): ${link}`);
      const text = lines.join('\n');
      await writeFile(join(dir, 'report.md'), text);
      await writeFile(join(dir, 'report.json'), JSON.stringify({ check, views: views.map((v) => ({ viewport: v.vp, scheme: v.scheme, view: v.view, settled: v.settled, console: v.console, fetches: v.fetches, captures: v.captures.map(({ png: _png, ...rest }) => rest) })) }, null, 1));
      return { text, images, dir };
    });
  }

  /** Wechsel als Filmstreifen: zwischen Slajdy, zwischen und in Szenen, Bewegungen nach der Uhr. */
  async motion(args) {
    return this.serial(async () => {
      const input = await this.inputOf(args);
      const vp = viewportOf(args.viewport ?? 'desktop');
      const scheme = args.theme === 'dark' ? 'dark' : 'light';
      const frames = Math.max(3, Math.min(8, Math.round(args.frames ?? 5)));
      const page = await this.tab(vp, scheme, args.reducedMotion === true);
      const first = await page.call(async (i) => window.recreatioPreview.check(i), input);
      if (first.error) throw new UserError(first.error);
      await this.matchDir(input, first.needs);
      const loaded = await this.load(page, input);
      const check = loaded.check;
      const rows = [];
      const fractions = Array.from({ length: frames }, (_, i) => i / (frames - 1));
      const wanted = (label) => !Array.isArray(args.only) || args.only.length === 0 || args.only.some((one) => label.toLowerCase().includes(String(one).toLowerCase()));
      const lines = [checkText(check, { renderer: this.rendererWord }).split('\n').slice(0, 2).join('\n'), '', `# Motion — ${vp.name} ${vp.width}×${vp.height} · ${scheme}${args.reducedMotion === true ? ' · reduced motion' : ''} · ${frames} frames per change`];

      if (loaded.view === 'slides') {
        const track = await page.call(() => window.recreatioPreview.deck());
        const number = new Map(check.modules.map((m) => [m.id, m]));
        for (let i = 0; i + 1 < track.slides.length && rows.length < 14; i += 1) {
          const a = track.slides[i], b = track.slides[i + 1];
          const label = `S${i + 1}→S${i + 2}`;
          if (!wanted(label)) continue;
          const m = number.get(b.key);
          const how = m === undefined ? 'scroll' : `${m.slide.transition}${m.slide.enter !== 'none' ? ` + enter ${m.slide.enter}` : ''}`;
          const from = a.start + a.travel;
          const to = b.start;
          const shots = [];
          for (const f of fractions) {
            await page.call(async (at) => window.recreatioPreview.holdDeck(at), from + f * (to - from));
            await sleep(60);
            shots.push({ png: await page.screenshot(), f });
          }
          rows.push({ label: `${label} „${b.label}” — ${how}`, shots });
        }
        await page.call(async () => window.recreatioPreview.holdDeck(null));
      } else if (loaded.view === 'presentation') {
        const info = await page.call(() => window.recreatioPreview.show());
        const route = info?.route?.length > 0 ? info.route : check.show?.route ?? [];
        const zones = zonesFor(route, check.show?.scenes ?? []);
        const sceneOf = new Map((check.show?.scenes ?? []).map((s) => [s.key, s]));
        const changes = [];
        zones.forEach((z, i) => {
          for (let s = z.at; s < z.to; s += 1) changes.push({ from: s, to: s + 1, label: `${z.key} step ${s - z.at + 1}→${s - z.at + 2}` });
          const next = zones[i + 1];
          if (next !== undefined) changes.push({ from: z.to, to: next.at, label: `${z.key} → ${next.key} (${sceneOf.get(next.key)?.change ?? 'fade'})` });
        });
        for (const change of changes) {
          if (rows.length >= 14 || !wanted(change.label)) continue;
          const shots = [];
          for (const f of fractions) {
            await page.call(async (at) => window.recreatioPreview.goShow(at), change.from + f * (change.to - change.from));
            await sleep(60);
            shots.push({ png: await page.screenshot(), f });
          }
          rows.push({ label: change.label, shots });
        }
      } else {
        /* Eine Seite: was sich nach der Uhr bewegt, Baustein für Baustein. */
        const animated = await page.call(() => window.recreatioPreview.animated());
        const m = await this.measure(page);
        for (const [id, longest] of Object.entries(animated).slice(0, 6)) {
          const item = m.items.find((it) => it.id === id);
          if (item === undefined) continue;
          const span = Math.min(longest, 8000);
          const label = `${m.labels[id] ?? id} — ${Math.round(longest)} ms${span < longest ? ` (frames over the first ${span} ms)` : ''}`;
          if (!wanted(label)) continue;
          const shots = [];
          const pad = 8;
          const clip = { x: Math.max(0, item.rect.x - pad), y: Math.max(0, item.rect.y - pad), width: Math.min(vp.width, item.rect.w + 2 * pad), height: Math.min(2400, item.rect.h + 2 * pad) };
          for (const f of fractions) {
            await page.call((t) => window.recreatioPreview.seek(t), f * span);
            await sleep(40);
            shots.push({ png: await page.screenshot({ clip, beyond: true }), f, t: Math.round(f * span), w: clip.width, h: clip.height });
          }
          await page.call(() => window.recreatioPreview.seek(null));
          rows.push({ label, shots });
        }
        if (rows.length === 0) lines.push('', 'Nothing on this page moves on its own (no running animations). Slides and presentations move with scrolling — use the page modes for those.');
      }

      const dir = await this.runDir(check);
      const images = [];
      if (rows.length > 0) {
        /* Ein Wechsel je Zeile, seine Bilder von links nach rechts — ein Ganzes Fenster, oder der Ausschnitt eines Bausteins. */
        const width = (shot) => shot.w ?? vp.width;
        const height = (shot) => shot.h ?? vp.height;
        const scaleOf = (shot) => Math.min(1, (SHEET - 14 * frames) / frames / width(shot), 420 / height(shot));
        const rowH = Math.max(...rows.map((row) => height(row.shots[0]) * scaleOf(row.shots[0]))) + 44;
        const perSheet = Math.max(1, Math.floor(SHEET / rowH));
        for (let i = 0; i < rows.length; i += perSheet) {
          const group = rows.slice(i, i + perSheet);
          const tiles = group.flatMap((row) => row.shots.map((shot, k) => ({
            png: shot.png,
            scale: scaleOf(shot),
            label: k === 0 ? row.label.slice(0, 60) : ' ',
            sub: shot.t !== undefined ? `t = ${shot.t} ms` : `${Math.round(shot.f * 100)}%`
          })));
          images.push({
            label: `motion ${Math.floor(i / perSheet) + 1}/${Math.ceil(rows.length / perSheet)}`,
            sheet: await this.studio.compose({ columns: frames, tiles, title: `${vp.name} ${vp.width}×${vp.height} · ${scheme} — each row one change, left to right` })
          });
        }
      }
      for (const row of rows) lines.push(`- ${row.label}: ${row.shots.length} frames`);
      for (const [i, one] of images.entries()) {
        one.file = join(dir, `motion-${String(i + 1).padStart(2, '0')}.jpg`);
        await writeFile(one.file, one.sheet.buffer);
      }
      rows.forEach((row, r) => row.shots.forEach((shot, k) => { void writeFile(join(dir, `motion-row${String(r + 1).padStart(2, '0')}-${k + 1}.png`), shot.png); }));
      lines.push('', '## Files', `- folder: ${dir}`, ...images.map((one) => `- ${one.label}: ${one.file}`));
      return { text: lines.join('\n'), images, dir };
    });
  }

  /** Ein Modul in jeder Grösse, die das Raster je Bildschirm erlaubt. */
  async module(args) {
    return this.serial(async () => {
      const input = await this.inputOf(args);
      const vps = (args.viewports?.length > 0 ? args.viewports : ['phone', 'tablet', 'desktop']).map(viewportOf);
      const scheme = args.theme === 'dark' ? 'dark' : 'light';
      const images = [];
      const lines = [];
      let check = null;
      let dir = null;
      for (const [i, vp] of vps.entries()) {
        args.onProgress?.(i, vps.length, `rendering every size on ${vp.name} ${vp.width}×${vp.height}`);
        const page = await this.tab(vp, scheme, false);
        if (check === null) {
          const first = await page.call(async (i) => window.recreatioPreview.check(i), input);
          if (first.error) throw new UserError(first.error);
          await this.matchDir(input, first.needs);
        }
        const done = await page.call(async (i, which) => window.recreatioPreview.matrix(i, which), input, args.module ?? null);
        if (done.error) throw new UserError(done.error);
        check ??= done.check;
        if (dir === null) {
          dir = await this.runDir(check);
          lines.push(`# Module M${done.module.n} ${done.module.kind} (${done.module.label})${done.module.title === '' ? '' : ` „${done.module.title}”`} in every size`, `Renderer: ${this.rendererWord}`, moduleLine(done.module));
        }
        const m = await this.measure(page);
        const height = Math.max(vp.height, Math.min(m.page.h, MAX_PAGE));
        const png = await page.screenshot({ clip: { x: 0, y: 0, width: vp.width, height }, beyond: true });
        await this.contrast(png, m);
        await writeFile(join(dir, `${vp.name}-matrix.png`), png);
        const cols = vp.width < 640 ? 2 : vp.width < 1024 ? 4 : 6;
        lines.push('', `## ${vp.name} ${vp.width}×${vp.height} (${cols} columns) — ${m.items.length} size(s)${done.settled.settled ? '' : ' — ⚠ still loading'}`);
        const cellOf = new Map((done.cells ?? []).map((c) => [c.size, c]));
        for (const cell of m.items) {
          const said = cellOf.get(cell.id);
          const issues = cell.findings;
          lines.push(`- ${cell.id.replace('x', '×')} ${said === undefined ? '' : `${said.width}·${said.height}${said.folded ? ' (folded: title + button)' : ''} `}— ${cell.rect.w}×${cell.rect.h} px${said === undefined || said.shows === '' ? '' : `; shows: ${said.shows}`}${cell.says.length > 0 ? ` · says „${cell.says.join(' / ')}”` : ''}${issues.length === 0 ? '' : `\n  ${issues.map((f) => `⚠ ${f.kind}: ${f.detail}`).join('\n  ')}`}`);
        }
        const errors = page.console.filter((c) => c.level !== 'warning');
        if (errors.length > 0) lines.push(`- ⚠ console: ${errors.length} error(s) — „${errors[0].text.split('\n')[0].slice(0, 200)}”`);
        const capture = { png, measure: m, labels: {} };
        const sheets = await this.pageSheets({ vp, scheme }, capture, false);
        sheets.forEach((sheet, i) => images.push({ label: `${vp.name} — sizes${sheets.length > 1 ? ` ${i + 1}/${sheets.length}` : ''}`, sheet }));
      }
      for (const [i, one] of images.entries()) {
        one.file = join(dir, `sizes-${String(i + 1).padStart(2, '0')}.jpg`);
        await writeFile(one.file, one.sheet.buffer);
      }
      lines.push('', '## Files', `- folder: ${dir}`, ...images.map((one) => `- ${one.label}: ${one.file}`));
      return { text: lines.join('\n'), images, dir };
    });
  }

  async close() {
    for (const [, tab] of this.tabs) await tab.page.close().catch(() => {});
    this.tabs.clear();
    if (this.browser !== null) await this.browser.close().catch(() => {});
    if (this.host !== null) await this.host.close().catch(() => {});
  }

  /** Beim harten Ende (Signal): wenigstens den Browser nicht zurücklassen. */
  kill() {
    this.browser?.kill();
  }
}

