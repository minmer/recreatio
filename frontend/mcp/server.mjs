#!/usr/bin/env node
/**
 * 2026-10-27 — recreatio-preview: ein MCP-Dienst für Assistenten, die Seiten
 * für Recreatio als JSON schreiben. Er zeigt, wie das Dokument nach dem Import
 * auf recreatio.pl wirklich aussähe — gezeichnet von der echten Anwendung in
 * einem Browser ohne Fenster —, in jeder Grösse, Slajd für Slajd, Szene für
 * Szene, mit Filmstreifen der Wechsel, und sagt, was daran nicht stimmt.
 * Gespeichert wird nichts. documentation/PREVIEW-MCP.md.
 *
 *   node frontend/mcp/server.mjs                     stdio (Claude Code, Claude Desktop, Codex, Cursor …)
 *   node frontend/mcp/server.mjs --http 8790         Streamable HTTP auf 127.0.0.1:8790/mcp, mit Schlüssel
 *
 * Optionen (oder Umgebung): --renderer source|site|dist|https://…/preview.html
 * (RECREATIO_PREVIEW_RENDERER), --api https://api.recreatio.pl|off
 * (RECREATIO_PREVIEW_API), --out <ordner> (RECREATIO_PREVIEW_OUT), --token
 * (RECREATIO_PREVIEW_TOKEN), --host 127.0.0.1.
 */

/* Was jemand in die Konsole schreibt, darf das Protokoll auf stdout nicht stören. */
console.log = (...args) => console.error(...args);
console.info = (...args) => console.error(...args);

import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { Previewer, UserError, VIEWPORTS } from './preview.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const frontend = resolve(here, '..');
const repo = resolve(frontend, '..');

function option(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && process.argv[at + 1] !== undefined) return process.argv[at + 1];
  return fallback;
}

const httpPort = option('http', null);
const settings = {
  renderer: option('renderer', process.env.RECREATIO_PREVIEW_RENDERER ?? 'source'),
  api: (() => {
    const said = option('api', process.env.RECREATIO_PREVIEW_API ?? 'https://api.recreatio.pl');
    return said === 'off' ? null : said.replace(/\/+$/, '');
  })(),
  out: option('out', process.env.RECREATIO_PREVIEW_OUT ?? join(tmpdir(), 'recreatio-preview'))
};
const log = (message) => process.stderr.write(`[recreatio-preview] ${message}\n`);

/* Je Zeichner einer (die Quellen, docs/, ein Bau, eine Adresse im Netz) — mit eigenem Browser und Tabs. */
const previewers = new Map();
function previewer(renderer) {
  const key = renderer ?? settings.renderer;
  let one = previewers.get(key);
  if (one === undefined) {
    one = new Previewer({ repo, frontend, renderer: key, api: settings.api, out: settings.out, log, anyFile: httpPort === null });
    previewers.set(key, one);
  }
  return one;
}

/* -- Die Eingaben ----------------------------------------------------------------------- */

const docArgs = {
  json: z.union([z.string(), z.record(z.string(), z.any())]).optional()
    .describe('The document to import: a recreatio/page document (or a single module / part, or a legacy event document) — as a JSON object or as JSON text. Give this or "file".'),
  file: z.string().optional()
    .describe('Path to a .json file with the document (absolute, or relative to the repository root) — instead of "json". Best for big documents.'),
  path: z.string().optional()
    .describe('Address the page would have, e.g. "parafia/rekolekcje" (menus with relative links depend on it). Default: "path" of the document, else "podglad".'),
  basePath: z.string().optional()
    .describe('Preview an import ONTO this existing public page: it is fetched live (read-only) and the document is applied to it the way the import does — modules with known ids change in place, the rest stays (or goes, with replace: true).'),
  replace: z.boolean().optional()
    .describe('With basePath: the page keeps exactly the modules of the document ("replace"); otherwise new modules are added after the existing ones (the import default).'),
  live: z.boolean().optional()
    .describe('Fetch public data from api.recreatio.pl for modules that show it (calendars, masses, libraries, existing page images) — read-only. Default true; false shows them empty.'),
  images: z.record(z.string(), z.string()).optional()
    .describe('Files for "page-image:@key" placeholders: { "<key>": "<path to a local file, or https URL>" }. Without them the preview shows labelled placeholder pictures (3:2) with the description from "images".'),
  imagesDir: z.string().optional()
    .describe('A folder whose files are matched to "images" by their "name", or by key = file name without extension (like the import does).'),
  renderer: z.string().optional()
    .describe('Which build renders: "source" (the working tree — default), "site" (docs/, what recreatio.pl serves once pushed), "dist", or an https://…/preview.html address.')
};

const viewportList = z.array(z.string()).optional()
  .describe(`Screen sizes: ${Object.entries(VIEWPORTS).map(([k, v]) => `${k} ${v.width}×${v.height}`).join(', ')}, or "WIDTHxHEIGHT". The grid has 2 columns below 640 px, 4 below 1024 px, 6 above.`);

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

/* -- Die Antworten ----------------------------------------------------------------------- */

function answer(done) {
  const content = [{ type: 'text', text: done.text }];
  for (const one of done.images ?? []) {
    content.push({ type: 'text', text: `▼ ${one.label} (${one.sheet.width}×${one.sheet.height}) — ${one.file}` });
    content.push({ type: 'image', data: one.sheet.buffer.toString('base64'), mimeType: one.sheet.mime });
  }
  return { content };
}

function failure(e) {
  const message = e instanceof UserError ? e.message : `The preview failed: ${e instanceof Error ? e.stack ?? e.message : String(e)}`;
  if (!(e instanceof UserError)) log(message);
  return { isError: true, content: [{ type: 'text', text: message }] };
}

/**
 * Fehler als Antwort, nicht als Abbruch — und, wenn der Client darum bittet
 * (`progressToken`), Fortschritt: der erste Aufruf startet Vite und den Browser.
 */
const guarded = (work) => async (args, extra) => {
  const token = extra?._meta?.progressToken;
  const onProgress = token === undefined ? undefined : (progress, total, message) => {
    void extra.sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress, total, message } }).catch(() => {});
  };
  try { return await work({ ...args, onProgress }); } catch (e) { return failure(e); }
};

/* -- Der Dienst -------------------------------------------------------------------------- */

const INSTRUCTIONS = `Recreatio (recreatio.pl) builds pages from a JSON document that the owner imports in the page editor ("JSON strony"). This server shows how such a document will REALLY look once imported — rendered by the real app in a headless browser, at several screen sizes — and what is wrong with it. Nothing is ever saved.

Work loop: page_format (learn the format; Polish, like the app) → write the document → check_page (fast: import plan, ignored keys, module sizes) → preview_page (pictures + measured problems per screen) → preview_motion for slides/presentations/animations → preview_module for one module in every grid size → fix and repeat. Modules are named M1, M2 … in the order of the page — the same names on the pictures and in the reports; slides S1, S2 …; presentation scenes by their key.

A page has three modes ("mode"): "page" (modules in a 6/4/2-column grid; widths snap to 2/3/4/6 columns, heights to 1 strip / 3 block / 5 tall; each size shows a different view), "slides" (every module a full screen, transitions, a stage of travelling modules), "presentation" (scenes with freely placed pieces, steps, camera changes, buttons and paths). Pictures the page still needs are written as "page-image:@key" with a description in "images" — the preview shows labelled placeholders, or real files given with "images".`;

function buildServer() {
  const server = new McpServer({ name: 'recreatio-preview', version: '1.0.0' }, { instructions: INSTRUCTIONS });

  server.registerTool('page_format', {
    title: 'Page JSON format',
    description: 'The exact JSON format of a Recreatio page import (recreatio/page), generated by the app itself — the same text it shows next to its import box: page settings, the three modes, every module kind with its keys and an example, slides, presentation scenes, motion, files ("images"). Read it before writing a document. With "kind", only that module kind. In Polish, like the app. Also lists all module kinds with their default size.',
    inputSchema: {
      kind: z.string().optional().describe('A module kind (e.g. "text", "hero", "gallery", "calendar") — only its description.'),
      renderer: docArgs.renderer
    },
    annotations: READ_ONLY
  }, guarded(async ({ kind, renderer }) => {
    const done = await previewer(renderer).format({ kind });
    const kinds = done.kinds.map((k) => `- ${k.kind} — ${k.label}: ${k.use} (default ${k.box})${k.retired ? ' — retired, do not use' : ''}`).join('\n');
    return { content: [{ type: 'text', text: `${done.text}\n\n# Module kinds (${done.kinds.length})\n${kinds}` }] };
  }));

  server.registerTool('check_page', {
    title: 'Check a page document',
    description: 'Check a page document WITHOUT rendering: what the import would change (the app’s own plan and warnings, verbatim), every key the import ignores, drops or reads differently (with its JSON path: unknown keys, invalid values, sizes that snap), the files it asks for, and every module (M1, M2 …) with its grid size and what it shows at each screen size (desktop 6 columns, tablet 4, phone 2), modules hidden for visitors, slides and presentation route. Fast — use it while writing; then preview_page to see it.',
    inputSchema: {
      json: docArgs.json, file: docArgs.file, path: docArgs.path, basePath: docArgs.basePath, replace: docArgs.replace,
      live: docArgs.live, renderer: docArgs.renderer
    },
    annotations: READ_ONLY
  }, guarded(async (args) => {
    const done = await previewer(args.renderer).check(args);
    return { content: [{ type: 'text', text: done.text }] };
  }));

  server.registerTool('preview_page', {
    title: 'Preview the imported page',
    description: 'Render a page document exactly as recreatio.pl would show it after the JSON import — the real app in a headless browser, as a visitor without an account — and return pictures and a report per screen size. A page with modules: the whole page (long pages in columns). Slides: every slide (tall slides also at their end). A presentation: every scene and every step on the route. Modules carry the labels M1, M2 … on the pictures (red frame = something to fix) and in the report, which lists measured problems: text cut off, content spilling out of its card, sideways scrolling, text under 12 px, low contrast measured on the rendered pixels, images that do not load, modules hidden for visitors, pieces off the screen or covering each other, modules still loading, console errors, and the requests made to the live service. Also contains the check_page report. Nothing is saved.',
    inputSchema: {
      ...docArgs,
      viewports: viewportList.describe(`${viewportList.description} Default: ["phone", "desktop"].`),
      theme: z.enum(['light', 'dark', 'both']).optional().describe('Device colour scheme. Pages with an automatic or a light+night theme look different in dark mode. Default light.'),
      reducedMotion: z.boolean().optional().describe('Emulate "reduce motion" (slides and scenes then only fade).'),
      annotate: z.boolean().optional().describe('Draw M1, M2 … frames on the overview pictures (default true). The PNG files are always clean.'),
      detail: z.enum(['overview', 'full']).optional().describe('"overview" (default): one or more sheets per screen. "full": also each screen-sized picture at full size (readable text; up to 12 per screen).'),
      focus: z.array(z.string()).optional().describe('Also return close-ups: modules ("M3"), slides ("S2"), presentation scenes (their key).')
    },
    annotations: READ_ONLY
  }, guarded(async (args) => answer(await previewer(args.renderer).preview(args))));

  server.registerTool('preview_motion', {
    title: 'Preview transitions and animations',
    description: 'Show how the page moves, as filmstrips (each row one change, left to right, frames at exact in-between positions): between slides (transition, entering content, modules travelling on the stage), between presentation scenes and between the steps of a scene (camera change, travelling pieces, arrivals), and the clock-driven animations of modules on a page with modules (paused and sampled over their duration).',
    inputSchema: {
      ...docArgs,
      viewport: z.string().optional().describe('One screen size (see preview_page); default "desktop".'),
      theme: z.enum(['light', 'dark']).optional(),
      reducedMotion: z.boolean().optional(),
      frames: z.number().int().min(3).max(8).optional().describe('Frames per change (default 5).'),
      only: z.array(z.string()).optional().describe('Only changes whose label contains one of these texts, e.g. ["S2→S3"], a scene key, or "M4".')
    },
    annotations: READ_ONLY
  }, guarded(async (args) => answer(await previewer(args.renderer).motion(args))));

  server.registerTool('preview_module', {
    title: 'Preview one module in every size',
    description: 'Render one module of the document in every size the page grid allows on each screen — widths 2/3/4/6 columns × heights strip (1) / block (3) / tall (5); a phone has only 2 columns, a tablet 4 — as the same card the page draws, each with the sentence the editor shows for that size. Use it to check that a bigger card really shows more and a small one has its own view instead of being cut, and to pick the size for the layout.',
    inputSchema: {
      ...docArgs,
      module: z.string().optional().describe('Which module: "M3" (order on the page), "modules[2]" (index in the document), its id, or its kind (the first of that kind). Default: the first.'),
      viewports: viewportList.describe(`${viewportList.description} Default: ["phone", "tablet", "desktop"].`),
      theme: z.enum(['light', 'dark']).optional()
    },
    annotations: READ_ONLY
  }, guarded(async (args) => answer(await previewer(args.renderer).module(args))));

  return server;
}

/* -- Laufen ------------------------------------------------------------------------------ */

let closing = false;
async function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  await Promise.allSettled([...previewers.values()].map((one) => one.close()));
  process.exit(code);
}
process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));
process.on('exit', () => { for (const one of previewers.values()) one.kill(); });

if (httpPort === null) {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
  process.stdin.on('end', () => void shutdown(0));
  log(`ready on stdio (renderer ${settings.renderer}, api ${settings.api ?? 'off'}, out ${settings.out})`);
} else {
  const token = option('token', process.env.RECREATIO_PREVIEW_TOKEN ?? randomBytes(18).toString('base64url'));
  const host = option('host', '127.0.0.1');
  const http = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    if (url.pathname !== '/mcp') { res.writeHead(404); res.end(); return; }
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    let body;
    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { res.writeHead(400); res.end(); return; }
    }
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  });
  http.listen(Number(httpPort), host, () => {
    log(`ready on http://${host}:${httpPort}/mcp — send "Authorization: Bearer ${token}" (renderer ${settings.renderer}, api ${settings.api ?? 'off'})`);
  });
}
