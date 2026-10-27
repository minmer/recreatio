# Page preview for AI agents (MCP server `recreatio-preview`)

An assistant that writes a page as JSON (`recreatio/page`, a module, a part, or a legacy event document) can see
how it will look **after the import on recreatio.pl** — drawn by the real app in a headless browser, at several
screen sizes, slide by slide, scene by scene and step by step, with filmstrips of the transitions — and gets a
report of what is wrong with it. Nothing is ever saved: the page never reaches the service.

It is a local MCP server (`frontend/mcp/`). The read-only server for ChatGPT at `api.recreatio.pl/mcp`
(MCP.md) is a different one: it reads Library, Scriptorium and knowledge bases; a browser cannot run on that host.

## Connecting

| client | how |
|---|---|
| Claude Code (in this repository) | `.mcp.json` at the root already names it — approve "recreatio-preview" once |
| Codex CLI | `~/.codex/config.toml`: `[mcp_servers.recreatio-preview]` `command = "node"` `args = ["C:/…/recreatio/frontend/mcp/server.mjs"]` |
| Claude Desktop, Cursor, others | a stdio server: `node <repo>/frontend/mcp/server.mjs` |
| remote (ChatGPT through a tunnel) | `npm --prefix frontend run preview:mcp -- --http 8790 --token <secret>`, then `cloudflared tunnel --url http://127.0.0.1:8790`; in ChatGPT (Developer mode) add a custom MCP server with URL `https://<tunnel>/mcp/<secret>` and "No authentication" (other clients may send `Authorization: Bearer <secret>` to `/mcp`); in this mode files can be read only inside the repository |

Needs `npm install` in `frontend/` (adds `@modelcontextprotocol/sdk`, `zod`) and Edge or Chrome on the machine
(`RECREATIO_PREVIEW_BROWSER` names another one). Options, also as environment variables:
`--renderer source|site|dist|https://…/preview.html` (`RECREATIO_PREVIEW_RENDERER`), `--api https://api.recreatio.pl|off`
(`RECREATIO_PREVIEW_API`), `--out <folder>` (`RECREATIO_PREVIEW_OUT`, default `%TEMP%\recreatio-preview`).

## Tools

| tool | what it returns |
|---|---|
| `page_format` | the JSON format exactly as the app describes it next to its import box (`pageDescription()`, Polish), or one module kind (`kind`); the list of all kinds with their default size |
| `check_page` | without pictures: the import plan and warnings verbatim, every key the import ignores (`unknown`), drops (`dropped` — unknown, invalid or the default) or reads differently (`changed` — sizes that snap, clamped values) with its JSON path, the files asked for, every module M1, M2 … with its size and the editor's "shows" sentence per screen, modules hidden for visitors, slides, the presentation route (steps, scenes reached only by buttons, unreachable ones) |
| `preview_page` | the check, plus per screen size (`viewports`, default phone + desktop; `theme` light/dark/both; `reducedMotion`): a page as one long picture, slides one by one (tall ones also at their end), a presentation scene by scene and step by step; overview sheets with M1, M2 … framed (red: something to fix), PNG files of every picture, and measured findings |
| `preview_motion` | filmstrips (`frames` 3–8 per change): between slides, between scenes and steps of a presentation, clock-driven animations of modules on a page (paused and sampled); `only` filters by label |
| `preview_module` | one module (`M3`, `modules[2]`, its id or its kind) in every size the grid allows per screen (2/3/4/6 columns × strip/block/tall), with the "shows" sentence per size |

Common arguments: `json` (object or text) or `file` (path), `path` (address it would have), `basePath` + `replace`
(import onto an existing public page, fetched live), `live` (public data from the service, default on),
`images` (`{ "<key>": "<file or https URL>" }` for `page-image:@key`) or `imagesDir` (matched by name or key),
`focus` (close-ups: `M3`, `S2`, a scene key), `detail: "full"` (every screen-sized picture), `annotate`.

Findings, each with the module it belongs to: `text-cut`, `scrolls` (content scrolling inside a box), `spills`
(content outside its card), `sparse` (a tall card that is mostly empty), `tiny-text` (< 12 px), `contrast` (WCAG,
measured on the rendered pixels against what is really underneath), `image` (does not load), `empty`, `loading`,
`off-screen` and `overlap` (slides and scenes), sideways scrolling of the page with its cause, console errors,
and the requests made to the live service.

Every report ends with a link (`http://127.0.0.1:<port>/preview.html?doc=<id>`) that opens the same preview in a
normal browser while the server runs. `preview.html` itself (also on recreatio.pl once the site is rebuilt)
takes pasted JSON — it never loads a document from its address.

## How it works

- `frontend/preview.html` → `src/app/preview/`: `previewDoc.ts` runs `planImport` (the import's own plan) with the
  requested files replaced by preview ids, and builds what `GET /page/<path>` would return after `runPageImport`
  (title only with a title, stored strings, look, menu, logic). `previewFetch.ts` serves that page and anonymous
  `/session`, passes other GETs to the service and refuses every write. The real app is then mounted (`mountApp`)
  at `#/<path>`: same header, menu, modules, slides and scenes as recreatio.pl (a form with questions in the
  document is drawn through `standIn` in `parts/registry.ts`). `previewLint.ts` compares the
  document with what the readers make of it (`toJson(fromJson(…))`, `slideJson`, `pieceJson`, `showJson`) and with
  the kinds' described keys. `previewProbe.ts` waits until nothing loads and measures; `ModuleMatrix.tsx` draws the
  size matrix. Small hooks in the app: `previewControl.ts` (the context through which the preview holds the slide
  track — `useSlideScroll` "Held" — and the presentation drive at an exact position), `showPreviewFiles` in
  `imageUrl`, `data-slide`/`data-part` on slides, `PagePlan.from` (which document entry made which part).
- `frontend/mcp/`: `server.mjs` (tools), `preview.mjs` (driving), `host.mjs` (serves the renderer on 127.0.0.1 —
  `source` through Vite from the working tree, `site` = `docs/`, `dist` — and proxies `/api` to the service,
  GET/HEAD only, without cookies), `cdp.mjs` (Edge/Chrome over the DevTools protocol; GPU compositing off, WebGL
  through SwiftShader; browsers left by a killed server are closed on the next start), `sheet.mjs` (sheets,
  filmstrips and pixel contrast drawn on a canvas in the browser), `report.mjs`.
- Checks: `scripts/app-preview-check.mjs` (in `app:check`: the page after import, the key check — every kind's own
  example passes silently, the fixtures carry no unknown key — sizes, slides, route).

## Limits

- A form whose questions come with the document is drawn from the document (`PreviewForm.tsx`: its questions,
  layout and logic in `FormFlow`, sending disabled) — without the data controller's clause, which comes from the
  area its answers go to. A form the document only points at is the live one. Appointments in `"appointments"` are
  created only by the import: until then a calendar or program module shows the calendar without them. The report
  says both.
- Placeholder pictures are 3:2; a real photo with another ratio changes layouts that follow the picture.
- Data modules show live public data, or nothing with `live: false`; a sealed or access-only base page cannot be
  fetched for `basePath`.
- Headless Edge has no WebGPU here, so the labs' accelerated view is not shown; WebGL works.
