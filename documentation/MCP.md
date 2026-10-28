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
| `get_schema` | `collection?` (id or name) | the kinds of each collection with their fields: key, label, type, `says`, `to` (reference targets), `multi`, options, locator |
| `search_entries` | `query?`, `collection?`, `kind?`, `limit` 1–50, `offset` | `total`, `nextOffset`, results with id, title, kind, text type, key, collection, area, snippet, url |
| `get_entry` | `id` (UUID or citation key) | the stored data, its kinds' fields, `links` (each reference with field, title and locator), `linkedFrom` (who refers to it, by field), a readable `text`, and for a work its `fullTexts` |
| `get_related` | `id`, `depth` 1–3, `direction` out/in/both, `fields?`, `includeData` | a sub-network: nodes (with readable text) and edges (from, to, field, locator); references outside the authorization are only counted. A reconstructed argument of a work (2026-10-25, WYWOD.md): from its leading question, `direction: "in"` along the field whose schema says `"structure": "up"`, `depth: 3`, then again from every node at depth 3. One call returns at most 60 nodes (`truncated`); its edges still name the steps that did not fit. Over REST the same tree comes from `/entry/<id>` → `linkedFrom` (entries directly below, with their field) |
| `list_texts` | `collection?`, `work?` | full texts: the work (id, title, key), collection, scheme of places (`pages`, `bible`, `numbered`, `aquinas`, `decimal`, `sections`, `outline`), words, and the parts with their first and last place and pages; a link to the app's reader |
| `read_text` | `text` (text id, or the work's id / key), `locator?`, `part?`, `start`, `limit` 1–200 | the passage at a place — `J 21,15`, a unit `J 21`, a range `J 21,15-17` or `a – b`, `nr 24`, `I, q. 2, a. 3`, `2.0121`, `§ 43`, pages `s. 45-47` — or a part block by block (`nextStart`); each block with its place, own number and pages, plus a readable rendering |
| `search_text` | `query`, `text?`, `collection?`, `limit`, `offset` | blocks of full texts with all words (Polish letters do not matter, phrases first): text, work, part, place, pages, snippet, reader url |
| `search` | `query` | standard ChatGPT search: `{results: [{id, title, url}]}` — entries first, then passages of full texts (`text:<text>:<part>:<block>`) |
| `fetch` | `id` | standard ChatGPT fetch: `{id, title, text, url, metadata}`; for a passage, the whole unit of its place with work and place |
| `list_import_formats` | — | (2026-10-28) the JSON formats the user can import: id, group, title, what it is for, where in the app it is imported, size and number of parts; plus the formats that exist only in place (a form's list, one work's text, a text's plan) |
| `get_import_format` | `format` (id), `part` (from 1) | one format exactly as the app describes it next to its import, or a ready scheme / AI guide; long ones in parts of ≤ 24 000 characters — part 1 carries the contents (each heading, e.g. every module kind of a page, with its part), then `nextPart` |

- **Import formats** (2026-10-28): an assistant that reads Recreatio often writes what is imported next — Library
  entries, a work with its full text, a knowledge base with questions, Scriptorium texts, a page, an area, calendar
  schemes, a registry. `frontend/scripts/import-formats.mjs` writes `backend/Api/Library/ImportFormats.json` from the
  app's own descriptions (the same text that stands next to each JSON import), the AI guides
  (`templates/cogita/ksiazka-AI.md`, `wywod-AI.md`) and the ready schemes (`templates/cogita/*.json`, kept whole);
  `app-json-check` fails when the file lags behind the app. The file is embedded in the program (`ImportFormats.cs`).
  Nothing is imported from here: the user pastes the JSON in the app and confirms after the list of changes. Over
  the link: `GET /ai/<link>/formats` and `/ai/<link>/formats/<id>?part=n` (also in the guide and in `openapi.json`).

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
  creator still leads the area; read-only. The token lives as long as the shortest of its links (`expires_in`).
  Every call checks each link again.
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

Revoking: delete the link (area → Dostęp → Dostęp dla AI → Usuń) — the token stops at the next call. Removing the
plugin in ChatGPT forgets the token on ChatGPT's side.

## Testing and troubleshooting

- **Inspector**: `npx @modelcontextprotocol/inspector --cli https://api.recreatio.pl/mcp/<link secret> --transport http --method tools/list`
  (or the Inspector UI with OAuth against `https://api.recreatio.pl/mcp`).
- `401` without `invalid_token`: the client sent no token — the OAuth connection is missing.
- `401 invalid_token`: every authorized link was deleted, expired, or its creator no longer leads the area — make a
  link and re-connect.
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
