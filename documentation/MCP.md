# Recreatio as an MCP server

Recreatio can be connected to ChatGPT (or any assistant that speaks the Model Context Protocol) as a **read-only**
source: the assistant searches, reads and follows references in the Library, Scriptorium and knowledge bases the
user authorized — live data, no copied files.

It is a thin layer over the AI link of an area (LIBRARY.md → "An AI reads the three parts"; ARCHITECTURE.md → Keys →
AI access). Nothing is copied or stored for MCP: every call opens the authorized links' sealed snapshots for the
length of the call, exactly as `GET /ai/{link}` does.

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
| `list_collections` | — | every authorized collection: id, part (`books`/`writing`/`knowledge`), name, area, entry count, kinds with counts, when its snapshot was made, `ready` |
| `get_schema` | `collection?` (id or name) | the kinds of each collection with their fields: key, label, type, `says`, `to` (reference targets), `multi`, options, locator |
| `search_entries` | `query?`, `collection?`, `kind?`, `limit` 1–50, `offset` | `total`, `nextOffset`, results with id, title, kind, text type, key, collection, area, snippet, url |
| `get_entry` | `id` (UUID or citation key) | the stored data, its kinds' fields, `links` (each reference with field, title and locator), `linkedFrom` (who refers to it, by field), a readable `text` |
| `get_related` | `id`, `depth` 1–3, `direction` out/in/both, `fields?`, `includeData` | a sub-network: nodes (with readable text) and edges (from, to, field, locator); references outside the authorization are only counted |
| `search` | `query` | standard ChatGPT search: `{results: [{id, title, url}]}` |
| `fetch` | `id` | standard ChatGPT fetch: `{id, title, text, url, metadata}` |

- **Search**: all words must occur (title, key, kind, content); case and Polish letters do not matter; words of one
  or two characters count only as whole words, and entries where the words stand together come first — `J 21`
  finds "J 21,15-17" before anything else and never "2021". Without a query it lists everything in a stable order;
  page with `offset` until `nextOffset` is `null`.
- **References** keep their meaning: a `Komentarz` lists its `grounds` and `objections`; a `Komentarz biblijny`
  points at the Bible in the Library with its locator (`J 21,15-17`) and at its comment. Ids outside the
  authorization appear only as "outside" — no title, no content.
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

1. In Recreatio: an area → Dostęp → "Dostęp dla AI" → make a link with the collections the assistant may read (or
   make it later on the consent page).
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
  opens Recreatio (the Dostęp tab refreshes stale snapshots).
- The consent page says the request expired: it lasts 15 minutes — start again from ChatGPT.
- Local drives (LocalDB): `scratchpad/mcp/mcp-e2e.mjs` (official MCP TypeScript SDK as the client: OAuth discovery,
  DCR, PKCE, consent, token, all tools, `J 21`, grounds/objections, paging, Polish, errors, revocation, the path
  form) and `mcp-consent-browser.mjs` (the consent page in a headless browser).
