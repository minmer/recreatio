/**
 * 2026-10-27 — EIN BROWSER OHNE FENSTER, über das Chrome DevTools Protocol.
 *
 * Edge oder Chrome, wie sie auf dem Rechner liegen (`RECREATIO_PREVIEW_BROWSER`
 * nennt einen anderen), mit einem eigenen, leeren Profil: kein Keks, kein
 * Konto — die Seite, wie ein Besucher sie sieht. Gesprochen wird über den
 * WebSocket des Browsers (Node 22+ hat ihn eingebaut), je Tab eine Sitzung
 * (`flatten`). Was eine Seite in die Konsole schreibt, wird gesammelt.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATES = {
  win32: [
    join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/snap/bin/chromium']
};

/** Der Browser, den es hier gibt — oder ein Fehler, der sagt, wie man einen nennt. */
export function findBrowser() {
  const said = process.env.RECREATIO_PREVIEW_BROWSER;
  if (said) {
    if (!existsSync(said)) throw new Error(`RECREATIO_PREVIEW_BROWSER points to "${said}", which does not exist.`);
    return said;
  }
  const found = (CANDIDATES[process.platform] ?? CANDIDATES.linux).find((one) => one !== '' && existsSync(one));
  if (found === undefined) throw new Error('No Edge or Chrome found. Install one, or set RECREATIO_PREVIEW_BROWSER to the browser executable.');
  return found;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Läuft der Prozess noch? */
const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

const PROFILE = 'recreatio-preview-profile-';

/**
 * WAS EIN HART BEENDETER DIENST ZURÜCKLIESS: ein Browser ohne Fenster, dessen
 * Besitzer (`owner.pid` im Profil) nicht mehr lebt. Er wird über seinen
 * DevTools-Anschluss geschlossen und sein Profil gelöscht. Profile eines
 * Dienstes, der noch läuft (eine zweite Sitzung daneben), bleiben.
 */
export async function reapOrphans(log = () => {}) {
  let names = [];
  try { names = (await readdir(tmpdir())).filter((one) => one.startsWith(PROFILE)); } catch { return; }
  for (const name of names) {
    const dir = join(tmpdir(), name);
    let owner = null;
    try { owner = Number((await readFile(join(dir, 'owner.pid'), 'utf8')).trim()); } catch { owner = null; }
    if (owner !== null && Number.isFinite(owner) && alive(owner)) continue;
    try {
      const [port, path] = (await readFile(join(dir, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/);
      const ws = new WebSocket(`ws://127.0.0.1:${port.trim()}${path.trim()}`);
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 1500);
        ws.addEventListener('open', () => { ws.send(JSON.stringify({ id: 1, method: 'Browser.close' })); setTimeout(() => { clearTimeout(timer); resolve(); }, 300); }, { once: true });
        ws.addEventListener('error', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
      log(`closed a browser left over by an earlier preview server (${name})`);
    } catch { /* kein Anschluss: nichts läuft mehr */ }
    await removeProfile(dir);
  }
}

/** Ein Profil löschen — der Browser gibt seine Dateien erst kurz nach dem Schliessen frei. */
async function removeProfile(dir) {
  for (let i = 0; i < 5; i += 1) {
    try { await rm(dir, { recursive: true, force: true }); return; } catch { await sleep(300); }
  }
}

export class Browser {
  static async launch({ executable = findBrowser(), log = () => {} } = {}) {
    await reapOrphans(log);
    const profile = await mkdtemp(join(tmpdir(), PROFILE));
    await writeFile(join(profile, 'owner.pid'), String(process.pid));
    const args = [
      '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
      '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-default-apps',
      '--disable-background-networking', '--disable-component-update', '--mute-audio', '--hide-scrollbars',
      /* Bahnen und Uhren laufen in jedem Tab, auch im hinteren. */
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      /* WebGL ohne Grafikkarte (Labore, Zeichnungen). */
      '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
      /*
       * Zusammengesetzt wird ohne GPU: sonst malte der Browser lange Seiten neben
       * grossen eigenen Ebenen (ein Karussell) unten nicht mehr — weiss statt Inhalt.
       * WebGL bleibt (SwiftShader).
       */
      '--disable-gpu-compositing',
      '--force-color-profile=srgb', '--lang=pl-PL', '--window-size=1440,900',
      /* Weitere Schalter für einen bestimmten Rechner (durch Leerzeichen getrennt). */
      ...(process.env.RECREATIO_PREVIEW_BROWSER_ARGS ?? '').split(' ').filter((one) => one !== ''),
      'about:blank'
    ];
    /*
     * Edge auf Windows: der gestartete Prozess reicht an den eigentlichen Browser
     * weiter und endet sofort (0), ohne etwas zu schreiben. Wo der Browser lauscht,
     * steht dann nur in `DevToolsActivePort` im Profil — Chrome schreibt es auch.
     */
    const child = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let said = '';
    child.stderr.on('data', (chunk) => { said += chunk.toString(); });
    let wsUrl = null;
    for (let i = 0; i < 150 && wsUrl === null; i += 1) {
      const hit = /DevTools listening on (ws:\/\/\S+)/.exec(said);
      if (hit !== null) { wsUrl = hit[1]; break; }
      try {
        const [port, path] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/);
        if (port && path) wsUrl = `ws://127.0.0.1:${port.trim()}${path.trim()}`;
      } catch { await sleep(200); }
    }
    if (wsUrl === null) throw new Error(`The browser did not start in 30 s: ${executable}\n${said.slice(-600)}`);
    const browser = new Browser(child, profile, log);
    await browser.connect(wsUrl);
    /* Die Kennung des eigentlichen Browsers — damit er auch dann endet, wenn `Browser.close` nicht mehr ankommt. */
    try {
      const info = await browser.send('SystemInfo.getProcessInfo', {}, undefined, 5000);
      browser.pid = info.processInfo.find((one) => one.type === 'browser')?.id ?? null;
    } catch { browser.pid = null; }
    return browser;
  }

  constructor(child, profile, log) {
    this.child = child;
    this.profile = profile;
    this.log = log;
    this.pid = null;
    this.nextId = 1;
    this.waiting = new Map();
    this.pages = new Map();
    this.closed = false;
  }

  async connect(url) {
    this.ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', () => reject(new Error('Could not connect to the browser.')), { once: true });
    });
    this.ws.addEventListener('message', (event) => this.receive(JSON.parse(String(event.data))));
    this.ws.addEventListener('close', () => {
      this.closed = true;
      for (const [, w] of this.waiting) w.reject(new Error('The browser closed.'));
      this.waiting.clear();
    });
  }

  receive(message) {
    if (message.id !== undefined) {
      const wait = this.waiting.get(message.id);
      if (wait === undefined) return;
      this.waiting.delete(message.id);
      if (message.error) wait.reject(new Error(`${wait.method}: ${message.error.message}${message.error.data ? ` (${message.error.data})` : ''}`));
      else wait.resolve(message.result);
      return;
    }
    const page = message.sessionId === undefined ? undefined : this.pages.get(message.sessionId);
    page?.event(message.method, message.params);
  }

  send(method, params = {}, sessionId = undefined, timeout = 120000) {
    if (this.closed) return Promise.reject(new Error('The browser is closed.'));
    const id = this.nextId++;
    const message = { id, method, params, ...(sessionId === undefined ? {} : { sessionId }) };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.waiting.delete(id); reject(new Error(`${method}: no answer in ${timeout} ms`)); }, timeout);
      this.waiting.set(id, {
        method,
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); }
      });
      this.ws.send(JSON.stringify(message));
    });
  }

  /** Ein neuer Tab mit eigener Grösse, eigenem Farbschema und eigener Bewegung. */
  async newPage({ width, height, scale = 1, mobile = false, dark = false, reduced = false }) {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(this, targetId, sessionId);
    this.pages.set(sessionId, page);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Log.enable');
    await page.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
    await page.setViewport({ width, height, scale, mobile });
    await page.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' },
        { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }
      ]
    });
    return page;
  }

  async close() {
    if (!this.closed) {
      try { await this.send('Browser.close', {}, undefined, 5000); } catch { /* schon weg */ }
    }
    this.kill();
    await sleep(500);
    await removeProfile(this.profile);
  }

  /** Ohne Umweg: auch beim Beenden des Dienstes, wenn nichts mehr gewartet werden kann. */
  kill() {
    try { if (this.pid !== null) process.kill(this.pid); } catch { /* schon weg */ }
    try { if (this.child.exitCode === null) this.child.kill(); } catch { /* schon weg */ }
  }
}

export class Page {
  constructor(browser, targetId, sessionId) {
    this.browser = browser;
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.listeners = new Map();
    /** Was die Seite in die Konsole schrieb: { level, text } — Fehler, Warnungen, Ausnahmen. */
    this.console = [];
    this.viewport = null;
  }

  send(method, params = {}, timeout) {
    return this.browser.send(method, params, this.sessionId, timeout);
  }

  event(method, params) {
    if (method === 'Runtime.consoleAPICalled' && (params.type === 'error' || params.type === 'warning' || params.type === 'assert')) {
      const text = params.args.map((a) => a.value ?? a.description ?? a.unserializableValue ?? '').join(' ').slice(0, 600);
      this.console.push({ level: params.type === 'warning' ? 'warning' : 'error', text });
    } else if (method === 'Runtime.exceptionThrown') {
      const d = params.exceptionDetails;
      this.console.push({ level: 'exception', text: (d.exception?.description ?? d.text ?? '').slice(0, 800) });
    } else if (method === 'Log.entryAdded' && (params.entry.level === 'error' || params.entry.level === 'warning')) {
      this.console.push({ level: params.entry.level, text: `${params.entry.text}${params.entry.url ? ` (${params.entry.url})` : ''}`.slice(0, 600) });
    }
    if (this.console.length > 300) this.console.splice(0, this.console.length - 300);
    for (const listener of this.listeners.get(method) ?? []) listener(params);
  }

  once(method, timeout = 60000) {
    return new Promise((resolve, reject) => {
      const list = this.listeners.get(method) ?? [];
      const timer = setTimeout(() => { remove(); reject(new Error(`${method}: not in ${timeout} ms`)); }, timeout);
      const listener = (params) => { clearTimeout(timer); remove(); resolve(params); };
      const remove = () => this.listeners.set(method, (this.listeners.get(method) ?? []).filter((one) => one !== listener));
      list.push(listener);
      this.listeners.set(method, list);
    });
  }

  async setViewport({ width, height, scale = 1, mobile = false }) {
    this.viewport = { width, height, scale, mobile };
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile, screenWidth: width, screenHeight: height });
    await this.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
  }

  async navigate(url, timeout = 90000) {
    const loaded = this.once('Page.loadEventFired', timeout);
    const result = await this.send('Page.navigate', { url });
    if (result.errorText) throw new Error(`Could not open ${url}: ${result.errorText}`);
    await loaded;
  }

  /** Einen Ausdruck in der Seite auswerten; `await` und Rückgabe als Wert (JSON). */
  async evaluate(expression, timeout = 120000) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, timeout);
    if (result.exceptionDetails) {
      const d = result.exceptionDetails;
      throw new Error(`In the page: ${d.exception?.description ?? d.text}`);
    }
    return result.result.value;
  }

  /** Eine Funktion der Seite mit Argumenten (als JSON hinübergegeben). */
  call(fn, ...args) {
    return this.evaluate(`(${fn})(...${JSON.stringify(args)})`);
  }

  /** Ein Bild: das Fenster, ein Ausschnitt (`clip` in CSS-px der Seite) oder die ganze Seite. */
  async screenshot({ clip = null, format = 'png', quality = 85, beyond = false } = {}) {
    const params = { format, fromSurface: true, captureBeyondViewport: beyond };
    if (format !== 'png') params.quality = quality;
    if (clip !== null) params.clip = { ...clip, scale: clip.scale ?? 1 };
    const { data } = await this.send('Page.captureScreenshot', params, 120000);
    return Buffer.from(data, 'base64');
  }

  async close() {
    this.browser.pages.delete(this.sessionId);
    await this.browser.send('Target.closeTarget', { targetId: this.targetId }).catch(() => {});
  }
}
