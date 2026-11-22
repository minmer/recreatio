# Recreatio as an MCP server

Recreatio can be connected to ChatGPT (or any assistant that speaks the Model Context Protocol) as a **read-only**
source: the assistant searches, reads and follows references in the Library, Scriptorium and knowledge bases the
user authorized, and reads the **full texts** of works stored there (books, articles, the Bible, documents) — live
data, no copied files.

It is a thin layer over the AI link of an area (LIBRARY.md → "An AI reads the three parts"; ARCHITECTURE.md → Keys →
AI access). Nothing is copied or stored for MCP: every call opens the authorized links' sealed snapshots for the
length of the call, exactly as `GET /ai/{link}` does.

Seeing how a page JSON will look after its import is a different, local server: `recreatio-preview`
([PREVIEW-MCP.md](PREVIEW-MCP.md)).

## Endpoint

| what | address |
|---|---|
| MCP (Streamable HTTP, stateless) | `https://api.recreatio.pl/mcp` |
| MCP with a link in the path (clients without OAuth) | `https://api.recreatio.pl/mcp/<link secret>` |
| Protected-resource metadata (RFC 9728) | `https://api.recreatio.pl/.well-known/oauth-protected-resource/mcp` (also without `/mcp`) |
| Authorization-server metadata (RFC 8414) | `https://api.recreatio.pl/.well-known/oauth-authorization-server` |
| OAuth | `/oauth/authorize`, `/oauth/token`, `/oauth/register` |
| Consent page (in the app) | `https://recreatio.pl/#/polacz-ai/<request>` |

Server: the official C# SDK `ModelContextProtocol.AspNetCore` 2.3.0, stateless (no sessions, any instance can answer),
name `recreatio`, with instructions telling the assistant where to start. Code: `backend/Api/Library/AiMcp.cs`
(tools, the gate), `AiOAuth.cs` (OAuth), `AiAccess.Read.cs` (opening, search, references, rendering — shared with
`/ai/…`); the consent page `frontend/src/app/aiAccess/AiConnect.tsx`. Migration `0127_ai_oauth.sql`.

## Tools

All tools are read-only (`readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`,
`openWorldHint: false`) and return `structuredContent` with an output schema plus the same JSON as text.

| tool | input | returns |
|---|---|---|
| `list_collections` | — | every authorized collection: id, part (`books`/`writing`/`knowledge`), name, area, entry count, kinds with counts, number of full texts, when its snapshot was made, `ready` |
| `get_access_overview` | — | (0138) the authorized areas as a tree: each area (checked on its own) with its nearest **authorized** parent, children, link expiry, whole-area flag, permissions (always `read`), collections with snapshot state, and links between knowledge bases (handle, `linksToBase`, shared here or not); `access` = `connection` (managed, with `manageUrl`), `token` (old fixed list) or `link` (path form). Areas outside the authorization never appear, not even their names; no learner data (`AiMcpOverview.cs`) |
| `get_schema` | `collection?` (id or name) | the kinds of each collection with their fields: key, label, type, `says`, `to` (reference targets), `multi`, options, locator |
| `search_entries` | `query?`, `collection?`, `kind?`, `limit` 1–50, `offset` | `total`, `nextOffset`, results with id, title, kind, text type, key, collection, area, snippet, url |
| `get_entry` | `id` (UUID or citation key) | the stored data, its kinds' fields, `links` (each reference with field, title and locator), `linkedFrom` (who refers to it, by field), a readable `text`, and for a work its `fullTexts` |
| `get_related` | `id`, `depth` 1–3, `direction` out/in/both, `fields?`, `includeData` | a sub-network: nodes (with readable text) and edges (from, to, field, locator); references outside the authorization are only counted. A reconstructed argument of a work (2026-10-25, WYWOD.md): from its leading question, `direction: "in"` along the field whose schema says `"structure": "up"`, `depth: 3`, then again from every node at depth 3. One call returns at most 60 nodes (`truncated`); its edges still name the steps that did not fit. Over REST the same tree comes from `/entry/<id>` → `linkedFrom` (entries directly below, with their field) |
| `list_texts` | `collection?`, `work?` | full texts: the work (id, title, key), collection, scheme of places (`pages`, `bible`, `numbered`, `aquinas`, `decimal`, `sections`, `outline`), words, and the parts with their first and last place and pages; a link to the app's reader |
| `read_text` | `text` (text id, or the work's id / key), `locator?`, `part?`, `start`, `limit` 1–200 | the passage at a place — `J 21,15`, a unit `J 21`, a range `J 21,15-17` or `a – b`, `nr 24`, `I, q. 2, a. 3`, `2.0121`, `§ 43`, pages `s. 45-47` — or a part block by block (`nextStart`); each block with its place, own number and pages, plus a readable rendering. 2026-11-01: in textbooks also a label as printed (`Twierdzenie 2.3`, `(2.4)`, `Rys. 1.2`) — the whole statement; formulas stay LaTeX (`$…$`, `$$…$$`), blocks of a statement carry `within`, numbered ones `labels`, and the rendering quotes a statement (`> `) under its bold head |
| `search_text` | `query`, `text?`, `collection?`, `limit`, `offset` | blocks of full texts with all words (Polish letters do not matter, phrases first; formulas by LaTeX command or symbol — `\frac`, `∑` — through each block's `search` line): text, work, part, place, pages, snippet, reader url |
| `search` | `query` | standard ChatGPT search: `{results: [{id, title, url}]}` — entries first, then passages of full texts (`text:<text>:<part>:<block>`) |
| `fetch` | `id` | standard ChatGPT fetch: `{id, title, text, url, metadata}`; for a passage, the whole unit of its place with work and place |
| `get_knowledge_setup` | `collection?` (knowledge base id or name), `section?`, `offset` | (2026-10-30) what steers learning in a knowledge base, as its export `recreatio.cogita.course` **without entities** and with the same lasting names (`@…`): templates (kinds, direction, graph, `tests`), revisions (whole graph), views, flows, collections, anchors, forms, kinds, looks, rules, values, settings (sources, dependencies). Plus `cards` (per template: cards, entries, first problems; question cards apart — counted with the sources inside the link) and `readers` (as „Kto czyta”). Over 60 000 characters: an overview, then per `section` with `nextOffset`. No progress, no answers. Built by the browser into the knowledge base's snapshot (`setup`, `aiSnapshot.ts` → `json.ts` `exportSetup`); a snapshot from before says `not_ready`. Entries carry `ref` (their lasting name) and `get_entry` accepts `@name`. Never learner data: settings keep only their structure, and progress-like keys are dropped in the browser and again in the service (`AiMcpTools.Scrub`). (2026-11-22) Section `tags` (`tagi`): every tag of the world — `{ref, name, parents, level, towers, towersBelow}` from `wmExport.ts` `tagsForAi` (towers of the first `style: "world"` view); in the whole answer, as its own section, and in the overview of a large base when it is small; the tool description and the instructions say to read it before tagging. Needs an API deploy |
| `list_import_formats` | — | (2026-10-28) the JSON formats the user can import: id, group, title, what it is for, where in the app it is imported, size and number of parts; plus the formats that exist only in place (a form's list, one work's text, a text's plan) |
| `get_import_format` | `format` (id), `part` (from 1) | one format exactly as the app describes it next to its import, or a ready scheme / AI guide; long ones in parts of ≤ 24 000 characters — part 1 carries the contents (each heading, e.g. every module kind of a page, with its part), then `nextPart`. 2026-11-22: the first guide is `guide-good-world` (`templates/cogita/dobry-swiat-AI.md`, the owner's "what a good world is", English) — the instructions say to read it before building or improving a world; guide-stories, guide-world-map and guide-schemes link it; guide-visuals §9 carries 12 checked drawing suggestions (`scripts/app-good-world-check.mjs`) |
| `check_import` | `format` (id), `document` (object or JSON text), `collection?`, `language?` (pl/en/de) | (2026-11-22) the app's own import preview run on the server, nothing written: `ok`, `summary`, `changes` (the preview's lines, every changed field of an existing item), `removals` (each deletion by name), ALL errors (they block) and warnings at once, identical ones grouped (`count`, `examples`); a knowledge-base document is checked against that base's snapshot (`snapshotCurrent`), everything else against an empty state (`note` says which) |
| `get_world_checks` | `collection?`, `weight?` (must,should,info), `code?` (exact or prefix `tower.`), `entity?` (id, `@name` or label part), `offset?`, `limit?` (≤ 300), `language?` | (2026-11-22, I2) the app's own **world check** against `guide-good-world` (`cogita/worldChecks.ts`, the same code as Wiedza → „Do zrobienia" → „Kontrola świata"), run with Jint on the base's snapshot: per finding code, weight, message, fix, the entity / tower / path with lasting names and the step; counts per code; never blocks anything; cached per snapshot and language for 15 minutes (paging does not recompute) |
| `get_work_briefing` | `project?` (id, key or title), `path?` | (2026-11-15) a **work** — a Scriptorium project built from the whole down to its units (documentation/WORK.md): the rulebook with reasons and scopes, the structure tree (purpose, role, key thought, target, status, words, split / variant, marks of the concepts per node), dimensions and paths, unit templates, the knowledge of the work (only from knowledge bases shared with this access: persons, places, terms with definition / usage / preferred and forbidden forms / requirements, phases valid from–until a node), finding counts per path and the first 60 findings of the chosen path |
| `get_work_context` | `project?`, `node` (id, key, number on the path such as `2.3`, or title), `path?` | (2026-11-15) what a writer needs at one node on one path — the same as the app shows beside the editor: the node, its chain, the key thoughts before and after, the neighbouring variant cells, everything introduced before it on the path (with where, and whether defined), what it must introduce or define (also below it), the rules in scope with their reasons, the phases valid here, its findings, and its text rendered |
| `get_work_checks` | `project?`, `path?` (empty: all), `node?` | (2026-11-15) the app's own check report per path, exactly as stored: code, weight (`must` / `should` / `info`), node, entity, rule, message, why, fix |
| `get_work_review` | `project?`, `status?`, `path?` | (2026-11-16) the author's review of the structure in reading order — per node the verdict (accepted / revise / remove / none) and the conversation (notes by author or ai, reply, para, done); `status` filters (accepted, revise, remove, none, notes = with open notes). The AI answers notes through the `scriptorium` import (thread items `"by": "ai"`; the import adds them). Core `AiMcp.Review.cs` `ReviewOf`. |
| `get_feedback` | `collection?`, `state` open/done/all, `category?` | (2026-11-20) feedback people left in the app on cards, questions and slides (`cogita/feedback.ts`, the small speech-bubble sign — for whoever writes in the base): category (good, wrong, answer, language, unclear, hard, easy, display, other) with its meaning, the comment, when, open or done, and the target with lasting names (entity, template, card key, how it looked). Carried in the base snapshot (`setup.feedback`); never part of the course JSON |
| `list_pages` | `query?`, `area?`, `limit` 1–200, `offset` | (2026-11-15) the pages of the authorized areas (see **Pages** below): path, title, lead, mode, access (`public` / `area`), `sealed`, number and kinds of modules, area, public url and editor url |
| `get_page` | `path` (path, `/` for the root, or the page's url) | one page in full: title, lead, mode, `look` (stored page look: theme, cover, show, deck, style, lang), `logic`, `subject`, menu, and every module in its order — kind, name, `layout` per screen size, `config` as stored, `text` (a readable digest of its words) — plus its subpages, the responsible area and the areas it is bound to. `search` also finds pages, and `fetch` reads `page:<path>` as text |

- **Works** (2026-11-15, `AiMcp.Works.cs`): a Scriptorium's snapshot carries `works` — one brief per project with
  structure nodes, built in the browser by `scriptorium/work/workBrief.ts` from the same code the app shows
  (`workModel`, `workMarks`, `workChecks`, `workContext`): the brief, and per path the reading order with numbers, where
  each concept is first introduced, the findings, the rules that hold everywhere and per node the extra rules, valid
  phases and what it introduces. The service only selects and expands (rules, phases, labels) — it runs no check of its
  own, so the findings are the app's. The knowledge of a work comes only from knowledge bases inside the same link; a
  base outside contributes nothing, not even a name. A snapshot from before `works` answers `not_found` until the
  browser of someone who writes there rebuilds it. Writing back stays an import: the guide `guide-work`
  (`templates/cogita/dzielo-AI.md`) and the ready scheme `scheme-dzielo` (`templates/cogita/dzielo.json`). Markup links
  may carry a role, `[[Anna|@id|intro]]`; `Render` shows it as `[→ Anna · intro]`. Checks: `Api.Tests/WorkMcpChecks.cs`.
- **Pages** (2026-11-15, `AiMcp.Pages.cs`): no choice of their own — an area's pages are those the app already ties
  to it: an access-only page bound to the area (`app.slug_area`; the link is like a person of the area who may open
  it) and a public page the area is responsible for (`controller_area_id` on it or the nearest page above,
  `Controllers.OfPageAsync`). An access-only page bound to another area never appears, even if this area answers for
  it; blocked pages (0130) and "po wydarzeniu" pages before the end neither. Modules for the people of an area (0133)
  appear only when that area is authorized. Content is read live from the register (what `GET /page/…` shows), not
  from a snapshot; a sealed page (0121) is listed by its address only — the service cannot open it. Never part of
  it: form answers, people, calendar entries. The account page "Dostęp dla AI" says so. Test: LocalDB drive
  `mcp-pages.mjs` (19 checks, session scratchpad).

- **Import formats** (2026-10-28): an assistant that reads Recreatio often writes what is imported next — Library
  entries, a work with its full text, a knowledge base with questions, Scriptorium texts, a page, an area, calendar
  schemes, a registry. `frontend/scripts/import-formats.mjs` writes `backend/Api/Library/ImportFormats.json` from the
  app's own descriptions (the same text that stands next to each JSON import), the AI guides
  (`templates/cogita/ksiazka-AI.md`, `wywod-AI.md`) and the ready schemes (`templates/cogita/*.json`, kept whole);
  `app-json-check` fails when the file lags behind the app. The file is embedded in the program (`ImportFormats.cs`).
  Nothing is imported from here: the user pastes the JSON in the app and confirms after the list of changes. Over
  the link: `GET /ai/<link>/formats` and `/ai/<link>/formats/<id>?part=n` (also in the guide and in `openapi.json`).
  Since 2026-10-29 every part of the app has its format ([JSON.md](JSON.md) lists them with where they are imported):
  besides the above also a calendar's appointments, masses and intentions, tasks, bookings, a conversation, contacts,
  roles, one's own data, „Czeka na Ciebie”, addresses and domains, one's own progress, lamps — and, with a worked
  example, the formats that depend on their place (a form, its list of entries, a book's quotes, a text's plan).

- **Import check** (2026-11-22, `AiMcp.ImportCheck.cs`, `ImportCheck.cs`): `check_import` runs the SAME TypeScript as
  the preview next to every import — `frontend/src/app/importCheck/` (one adapter per format id calling that part's
  planner; `registry.ts` says how to add one) is bundled by `frontend/scripts/import-check-bundle.mjs` into
  `backend/Api/Library/ImportCheck.js` (~5 MB) plus `ImportCheck.locales.json` (the locale files it names), both
  embedded; Jint 4.18 runs it in a sandbox per call (no CLR, 90 s, recursion limit, at most 2 at once). A knowledge
  base is rebuilt in memory from its AI snapshot with its own ids (`restoreBase`), then `importSession` →
  `decidedPlan` with every change accepted, so blockers, removals and warnings are exactly the app's. Cost: ~1 s per
  call for a small document, ~12 s for ~4 600 entities against ~4 500 (V8 needs 1.3 s; half of it is `fieldsOf` in
  `cogita/schema.ts`). The API build regenerates the bundle when `frontend/node_modules` exists (target
  `ImportCheckBundle`, off with `-p:SkipImportCheckBundle=true`); `app-import-registry-check` fails when it lags. Not
  checked on the server: references into other knowledge bases (`@@…`, they need the account) and into Library
  sources the base declares. The local preview MCP has the same tool (`frontend/mcp/importCheck.mjs`, empty state).
  Checks: `app-import-registry-check` (7), `Api.Tests/ImportCheckChecks.cs` (15).
  2026-11-22 (I12): `check_import` also returns `importIn` (where in the app the user imports it — what they choose
  there, from `ImportFormats.json`) and takes a long document in parts (`document` = a string with a piece of the JSON
  text, `part` 1…`of`, the same `upload` id; in memory per connection, 30 minutes, at most 4 open uploads; checked
  once the last part arrives, `partsMissing` until then). The snapshot passed to the script carries `setup.feedback`,
  so a document that resolves feedback (I6) is checked against the real ids. `app-import-registry-check` §6 proves
  that the server bundle returns exactly the app preview for a document of every one of the 29 formats.
- **World check** (2026-11-22, I2, `AiMcp.WorldChecks.cs`): `get_world_checks` runs `recreatioWorldChecks` of the same
  bundle — `restoreBase` (now with the snapshot's feedback) → `lib.cards()` → `worldChecks` — with all three languages
  loaded (slide messages come in the base's language). One implementation: the app shows the same list to writers
  (Wiedza → „Do zrobienia" → „Kontrola świata", `cogita/WorldChecksPanel.tsx`). Checks reuse the map's model
  (`worldInputOf`/`readWorld`/`linesOf`, towers from the `"style": "world"` view), the story path (`storyPath`, help
  steps never count), the import preview's own flow and lint messages (`flowIssues`, `pathWarnings`, slide, generator,
  drawing, landscape and cross-world lints) and the map's notes for authors; new are the checks of
  `guide-good-world` (codes in `worldChecks.ts`). A world of ~4 400 elements: ~0.7 s in V8. Checks:
  `app-world-checks-check` (10: a world built to fire every code, the server bundle in a bare context finds the same),
  `Api.Tests/WorldChecksChecks.cs` (Jint, filters, paging, feedback note, parts).
- **Search**: all words must occur (title, key, kind, content); case and Polish letters do not matter; words of one
  or two characters count only as whole words, and entries where the words stand together come first — `J 21`
  finds "J 21,15-17" before anything else and never "2021". Without a query it lists everything in a stable order;
  page with `offset` until `nextOffset` is `null`.
- **References** keep their meaning: a `Komentarz` lists its `grounds` and `objections`; a `Komentarz biblijny`
  points at the Bible in the Library with its locator (`J 21,15-17`) and at its comment. Ids outside the
  authorization appear only as "outside" — no title, no content.
- **Full texts** (LIBRARY.md → "Places in a work and source texts"): a text stored in an authorized collection comes
  with its snapshot — whoever may read the collection reads its texts; a text stored in a collection the link does not
  hold never appears, not even its title. Blocks are rendered readably: `[s. 46]` a page break, `[^3]` a footnote
  reference, `word[?]` an uncertain reading, `[…]` a gap. Places are matched as written in the text (case, spaces,
  ":" for "," and the kind of dash do not matter); a place that is not in the text is not guessed — the answer names
  the parts with their first and last places. A collection whose texts are too large for its snapshot (over ~30 MB
  packed) is read without them, and `list_texts` says so.
- **URLs** point into the app (`https://recreatio.pl/#/workspace/…`), which opens the entry only for someone who reads
  its area. No secret ever appears in a result.
- **Errors** say what happened: `not_found` (no such entry or collection in this authorization — the same answer
  for an entry that exists elsewhere), `unauthorized` (no authorized link works any more), `rate_limited`
  (120 calls per minute per link). A collection without a snapshot yet is listed with `ready: false`.

## Authentication and scope

- **OAuth 2.1** (what ChatGPT uses): authorization code with PKCE (S256 only), public clients
  (`token_endpoint_auth_method: none`), Dynamic Client Registration (RFC 7591) and Client ID Metadata Documents
  (`https://chatgpt.com/oauth/…/client.json`; only from `Api:OAuthClientHosts`, by default chatgpt.com, openai.com,
  claude.ai, anthropic.com), `iss` in every answer to the client (RFC 9207), the `resource` parameter checked
  against `https://api.recreatio.pl/mcp`. Scope `recreatio.read`.
- **What the user authorizes is AI links.** The consent page (sign-in required) shows who asks and where it returns,
  and lists the AI links of the areas the user leads — or makes one. The user's browser opens the chosen links'
  secrets (only it can: they lie under the area key) and hands them to the service. The **access token is that
  list of link secrets**; until the client redeems the code, the secrets lie sealed under a key derived from the code
  (`Crypto.InfoAiOAuthCode`, AAD field `ai_oauth_code`), and the code itself is kept only as a hash; after
  redemption nothing is kept. Codes last five minutes and work once; a wrong PKCE verifier burns the code.
- **Everything of the link stays in force.** Only its collections; only while it exists, has not expired and its
  creator still leads the area; read-only. Every call checks each link again.
- **One connection, many areas (0138, 2026-11-05).** Before 0138 the access token WAS the list of links ticked at
  consent — fixed forever, so an assistant connected once with "CogitaTemp" never saw any other area, even when
  those areas had working AI links. Now consent creates a **connection** (`app.ai_mcp_connection`,
  `backend/Api/Library/AiMcpConnections.cs`) and the token is `rcm~<secret>` (valid a year). The connection has an
  RSA-4096 pair: the public key lies open, the private key is sealed under HKDF(token) (`Crypto.InfoAiMcpConnection`,
  AAD `ai_mcp_connection`). Each area is a row in `app.ai_mcp_link` holding that area's link secret RSA-wrapped to the
  connection (AAD `ai_mcp_link`, bound to connection AND link) — so the service can **add** an area without knowing
  the token, and opens it only while a call carries the token. The database alone opens nothing.
  - The owner (who consented) manages it in the app: **Account → AI access** (`#/workspace/account/dostep-ai`,
    `frontend/src/app/aiAccess/AiConnections.tsx`): add an area — optionally with every area below it that they
    lead — after a review of the collections and the link used (an existing working link, or a new whole-area one),
    renew an area's link, remove an area, disconnect the assistant. **No OAuth re-authorization** for any of these:
    the change shows at the assistant's next call.
  - Every call checks every area on its own: the link works (ready, not expired, creator leads the area) AND the
    owner still leads the area. A connection with no working area stays connected: `list_collections` answers an
    empty list with the address where areas are added (no 401, so no re-sign-in is forced).
  - Service endpoints (owner's session): `GET /workspace/ai-connections`, `POST …/{id}/links {secret}`,
    `DELETE …/{id}/links/{accessId}`, `DELETE …/{id}`. A connection holds at most 20 areas, one link per area.
    A deleted link leaves every connection (ON DELETE CASCADE).
  - Old tokens (a dot-joined list of link secrets) and `/mcp/<link>` keep working unchanged; they cannot be extended
    — reconnect once. Without migration 0138 the service issues old-style tokens as before.
- **Without OAuth**, a client can use `https://api.recreatio.pl/mcp/<link secret>` (the same secret as the AI link):
  for MCP Inspector or a ChatGPT server set up with "No authentication". The path then holds the secret, so host
  access logs may record it — prefer OAuth.
- Without credentials `/mcp` answers 401 with
  `WWW-Authenticate: Bearer resource_metadata="https://api.recreatio.pl/.well-known/oauth-protected-resource/mcp"`;
  with only dead links, 401 with `error="invalid_token"` (the client re-connects).
- CORS: `/mcp`, the metadata, `/oauth/register` and `/oauth/token` answer any origin without cookies (browser-based
  clients); consent calls (`/oauth/request`, `/oauth/approve`, `/oauth/deny`) need the user's session.

## Connecting ChatGPT

1. In Recreatio: an area → Dostęp → "Dostęp dla AI" → make a link — by default for the **whole area** ("Cały obszar —
   także zbiory, które dojdą później": a library or base created later is included by itself, migration 0128), or
   for chosen collections (or make it later on the consent page).
2. In ChatGPT: Plugins (chatgpt.com/plugins) → **+** → "Add custom MCP server" → Server URL
   `https://api.recreatio.pl/mcp`, Authentication **OAuth** → confirm the warning → "Create as a plugin" → install it.
3. ChatGPT opens Recreatio's consent page: sign in, tick the links, **Zezwól**. ChatGPT returns with the connection.
4. In a chat (Work mode), type `@` and choose the plugin, then ask, e.g. "Find all comments on John 21 and summarize
   their arguments and objections."
5. More areas later: Account → **AI access** → the connection → **Add area** → choose the area (and, if wanted, the
   areas below it) → review the collections and read-only permissions → confirm. ChatGPT sees them at its next
   `list_collections`, next to the areas it already reads.

Revoking: Account → AI access → **Remove from connection** (one area) or **Disconnect assistant** (all), or delete
the link (area → Dostęp → Dostęp dla AI → Usuń) — each takes effect at the next call. Removing the plugin in ChatGPT
forgets the token on ChatGPT's side.

## Testing and troubleshooting

- **Inspector**: `npx @modelcontextprotocol/inspector --cli https://api.recreatio.pl/mcp/<link secret> --transport http --method tools/list`
  (or the Inspector UI with OAuth against `https://api.recreatio.pl/mcp`).
- `401` without `invalid_token`: the client sent no token — the OAuth connection is missing.
- `401 invalid_token`: the connection was disconnected or has expired (a year), or — for an old token — every
  authorized link was deleted, expired, or its creator no longer leads the area — re-connect.
- Only one area shows (e.g. only „CogitaTemp”): the assistant holds an old token, or its connection has only that
  area. `get_access_overview` says which (`access: "token"` = old, fixed list). Reconnect once if old, then add
  areas in Account → AI access.
- Drive for 0138: `scratchpad/mc/connections-e2e.mjs` of session 719fcce1 (33 checks on LocalDB `rc_mc`: OAuth →
  connection, add/remove areas on the same client, hierarchy over an unauthorized middle area, another account
  refused, deleted links leave, empty connection stays connected, old tokens and the path form, revoke → 401).
- `ready: false` in `list_collections`: the collection's snapshot is not built yet; someone who writes in the area
  opens Recreatio (the Dostęp tab refreshes stale snapshots). A collection created after the link appears this way
  at once when the link follows the whole area; the browser that created it builds its first snapshot.
- A new collection does not appear at all: the link was made for chosen collections — Dostęp dla AI → Zbiory → tick
  "Cały obszar" (or the collection).
- The consent page says the request expired: it lasts 15 minutes — start again from ChatGPT.
- Local drives (LocalDB): `scratchpad/mcp/mcp-e2e.mjs` (official MCP TypeScript SDK as the client: OAuth discovery,
  DCR, PKCE, consent, token, all tools, `J 21`, grounds/objections, paging, Polish, errors, revocation, the path
  form, and the three text tools) and `mcp-consent-browser.mjs` (the consent page in a headless browser);
  `scratchpad/ai/follow-texts-api.mjs` (a link following its area, full texts over MCP, privacy of another area's text).
