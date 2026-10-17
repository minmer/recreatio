# Transfer — from old data forms to the current ones

The platform grew in rounds (migrations 0001–0111). Each round kept older data readable, so the code carries
branches that exist only for data written before some round. This document is the plan to remove them:

1. **Structure** — make the code base clean without changing what it does. *Done 2026-10-17.*
2. **Prepare and transfer** — convert old data to the current form; after login, in the browser where keys are
   needed. *Built 2026-10-17; the transfer itself is run by the owners of the data.*
3. **Remove** what was only there for old data. *After the transfer — the list is below.*

Counts are from the production database on 2026-10-17.

## Step 1 — structure (no change in function)

- Old documents removed (`ACTUAL_PLATFORM_TECHNICAL_STATE.md`, `CogitaAim.md`, `COGITA_*`, `Forms_Import_JSON.md`,
  `Hortus_Reservations.md`, `Login_and_Registration.md`, `RC_BEFUNDE.md`, `Roles_and_Keys.md`, `System_Prepare.md`,
  `cogita-graph.md`, `CenterTemp2.html`, `_reference/`, root `CNAME`); the current ones moved to `documentation/`;
  the definitions still cited from the old Cogita documents kept in COGITA.md, Appendix A. New: `README.md`,
  `ARCHITECTURE.md`, this file.
- Frontend: `src/app` in domain folders (see ARCHITECTURE.md); files over ~800 lines split along their concerns
  (chat kit, mass office, form office and form card with their state hooks, `form.ts` into fields / submissions /
  revisions / value checks, areas, slot card, slides, page JSON, Cogita cards, …); `app.css` (7 900 lines) and
  `ui/ui.css` split into ordered parts — the built CSS is byte-identical; about 50 unused functions, constants and types and 14 pass-through
  re-exports removed; five copies of the Polish plural replaced by `core/plural.ts`; unused public assets removed
  (`public/event/`, `public/parish/`, three Cogita images); unused dependencies and package scripts removed; one
  `tsconfig.json` (the separate one for the new code is no longer needed).
- Backend: `backend/Api` in domain folders, long classes split into partial files; `Api.Tests` added to the
  solution; the unused EF tool manifest and the stale `Sql/reset/` scripts (schema of 0001–0019) removed.

## Step 2 — what is converted

| What | Old form | Current form | Where | Left |
|---|---|---|---|---|
| Migration records | 0078–0111 applied by hand, not in `schema_version` | recorded | server, once | 22 scripts |
| Chat posting policy | `legacy` | `members` (area, seat chats) / `writers` (group, direct, notes) — the same behaviour | transfer page (owner of the chat's area) | 6 chats |
| Data controller | per form (`module.controller_*`) | per area (`area_controller`), inherited by sub-areas | transfer page (area admin) | 6 forms in 5 areas |
| SMS template | one text in `config.sms` | list in `config.smsTemplates` | transfer page | 1 form |
| Account root holdings (before 0040) | the account root holds areas, keys, an intake, pages, calendar items | a person holds them | transfer page (that account) | 1 account |
| Role key layout (before 0034) | one key opens name, reading **and** signing | own sign key, granted only to leaders (`holds`) | transfer page (a leader of the role) | 2 roles |
| Answer envelopes | value key wrapped with RSA for the intake | value key sealed under the office role key | transfer page / opening the answers | 11 values in 2 forms |

### Running it

1. Deploy the service and the website built from this state.
2. On the server, check that the hand-applied migrations are really in place, then record them:
   ```sh
   # read-only (SSMS, Azure Data Studio or sqlcmd): every row must say 1
   #   backend/Api/Sql/diagnostics/applied_0078_0111.sql
   dotnet run --project backend/Api -- migrate --record-through 0111 --dry-run
   dotnet run --project backend/Api -- migrate --record-through 0111
   dotnet run --project backend/Api -- migrate --dry-run      # must say: nothing to apply
   ```
   Running plain `migrate` before this would re-run 0099, which resets the step constraint to its old shape and
   fails on the existing booking step.
3. Each owner of old data signs in and opens **Konto → Przeniesienie danych** (`#/workspace/account/przeniesienie`)
   and presses **Przenieś wszystko**. Today that is essentially the first (main) account: it holds the account-root
   data, the two old-layout roles and the areas of the old chats and forms.
4. The section **W całej bazie** on that page shows what is left in the whole database. Step 3 can start when
   everything except the RSA envelopes is 0.

What the steps do exactly:

- **Chats** — `POST /workspace/transfer/chats` rewrites `legacy` for chats whose area the caller administers
  (`ChatRules.Explicit`; `Api.Tests` checks that the speakers and seat rights stay the same for every kind). New
  chats are already written with the explicit policy; an old browser that still sends `legacy` is mapped too.
- **Data controller** — per area: if neither the area nor an area above it has a controller, the form's entry is set
  on the area (the same entry for all forms there; different entries in one area are left for a person to decide);
  then the form entries are cleared. Where the area chain already has one, the form entry was ignored anyway.
- **SMS** — `config.sms` becomes the first template of `config.smsTemplates`; `sms` is deleted.
- **Account → person** — the existing hand-over (`account/handOver.ts`): keys are re-wrapped for the person in the
  browser, certificates re-signed, pages and calendar items re-owned, all in one transaction.
- **Sign key** — `roles.ts` `separateSignKey`: the browser opens the sign private key (old layout: with the role
  key), seals it under a new sign key, wraps that key for every leader (`GET /workspace/roles/{id}/leaders`: an active
  `holds` edge and a role grant) and checks its own envelope before sending; `POST /workspace/roles/{id}/layout`
  accepts only the exact set of leaders, never for account roots, never twice. Holders with only `read`/`write`
  edges lose the ability to sign — the separation 0034 intended.
- **Envelopes** — `forms/rewrap.ts` opens every answer of a form the caller can read and re-seals the value keys
  under the office role key; the RSA envelope is dropped in the same statement.

### Not converted, on purpose

- **Account roots** keep one key (`key_layout = 0`, 13 accounts): nobody holds them; their key is derived from the
  master key. The layout-0 branch of `Ring.signKey` stays for them.
- **New RSA envelopes** keep arriving: a public submission can only wrap for the intake's public key. They are
  re-sealed when the office opens them (0037). This count never stays at 0 and does not block step 3.
- **Seats' office envelope** (177 seats, `seat_key_for_intake`): the service can already store `seat_key_for_office`,
  but nothing reads it yet. Moving seats needs that read path first — a design task, not a transfer.
- **`key_grant.sealed_held`** (0037) is unused: all 108 grants are RSA envelopes, which is how a grant reaches
  someone whose secret one does not have. Either implement "re-seal on first open" for grants or drop the column.
- **Seats from before 0046** (70) have no stored link; the office issues a new link when it sends one. That path
  stays.
- **Plaintext names** (0097): none left.

## Step 3 — what can go afterwards

Each item names its precondition. Database changes go into a new migration (destructive ones as `0000_*`, run with
`--drop-legacy`).

**The transfer itself** (when the page shows 0 except envelopes)
- `backend/Api/Transfer/`, `Roles/Roles.Layout.cs` (and `MapLayout` in `Roles.cs`), `frontend/src/app/account/transfer.ts`,
  `TransferPage.tsx`, `forms/rewrap.ts`, the menu and search entries „Przeniesienie danych", the routes in `Account.tsx`.

**Chat `legacy` policy** (chats = 0)
- `ChatRules.Explicit` and its uses, the `legacy` branches in `ChatRules.Speakers` and `ChatDelivery` (SQL), the
  accepted value in `Chat.List`/`Chat.Features` (`CreateRequest` default), the `legacy` checks in `Api.Tests`,
  `POLICIES` entry in `chat/ChatChrome.tsx`.
- Database: `df_chat_policy` default to `members`, `ck_chat_policy` without `legacy`.

**Per-form data controller** (controllers = 0)
- Database: `module.controller_name`, `controller_address`, `controller_email`.
- Backend: the `own` and answer-area fallbacks in `Form.WholeAsync` (`Forms/Form.cs`), controller handling in
  `Pages/Module.Update.cs`, the controller in the module list and in `Form.Public`.
- Frontend: `ModuleRow.controller`, `updateModule(… controller)`, the `legacy`/`fallback` branches of
  `FormControllerNote` (`areas/AreaController.tsx`), `ControllerForm` (`forms/FormSettings.tsx`) and its use in
  `FormOffice.tsx`.

**Old SMS template** (sms = 0) — the `config.sms` merge in `forms/sms.ts` `templatesOf`.

**Account-root hand-over, 0040** (accounts = 0) — `Identity/HandOver.cs`, `account/handOver.ts`, `HandOverBar` in
`roles/RolePanels.tsx` and its use in `RoleGraph.tsx`; the internal-slug count there.

**Old role layout, 0034** (layouts = 0) — the layout-0 notice in `RoleGraph.tsx`, the "old form" remarks in
`roles.ts` `addHolder`. `Ring.signKey` keeps its layout-0 branch for account roots.

**Plaintext names, 0097** (already 0)
- Database: `access.recipient_name`, `claim.holder_name` (and the plaintext part of `ck_claim_who`).
- Backend: `Identity/Names.cs` (`/workspace/names/unsealed`, `/workspace/names/seal`), plaintext fallbacks in the loaders.
- Frontend: `core/nameSeal.ts`, `sealOldNames` in `notify/notify.ts`, the `SealNames` card in `Account.tsx`, the
  "old, still open" fallbacks in `core/names.ts` and `core/holderNames.ts`.

**Page bound to a role, 0026** (`slug.internal_for_role_id` — already 0)
- Database: the column. Backend: `/workspace/slug/internal` (`Pages/Slug.Areas.cs`) and the reads in
  `Page.Write.cs`, `Area.Settings.cs`, `Form.Portal.cs`, `Workspace.cs`, `HandOver.cs`.

**Seat notes** (0 rows) — `access.personal_note_sealed`, `internal_note_sealed`; `/workspace/seat/{id}/note`
(`Forms/Seat.Own.cs`); the readers in `seats/seat.ts`.

**Endpoints without a caller** (checked against every path in `frontend/src`)
- `/workspace/grants` (GET, POST) and `/workspace/grants/{id}/revoke` — `Pages/Access.cs`.
- `/workspace/area/{id}/portal` (GET, POST) and `app.area_portal` (0 rows; also read in `Forms/Seat.Open.cs`).
- `/workspace/area/{id}/publish` — areas become public through `/workspace/area/{id}/public`.
- `/workspace/chat/message/{id}/topic` — moving a message into a topic has no interface any more.

**Identity roles `name` and `contact`, before 0038** (0 fields) — their entries in `IDENTITY_ROLES`, the `name`
fallback in `fullNameOf` (`forms/form.ts`), the backend validation.

**Old service tolerance** — fields marked "fehlt beim alten Dienst" (optional in the client types: notify digest,
modules, links, pages, library, chat) become required once the old service is gone everywhere.

**Old page files** — the `legacy` document kind of the page JSON import (`pages/pageJson.ts` `planLegacy`,
`pages/slides/SlidesImport.tsx`) while old exports may still come in; the layer reader `LEGACY_AIR` in
`pages/slides/slideLook.ts` (0 slides use it) and the single `track` of the map part (0 maps).

**Database leftovers**
- Empty schemas of the old system, owned by `dbo`: `calendar`, `chat`, `edk`, `event2`, `events`, `forms`,
  `hortus`, `library`, `limanowa`, `pilgrimage`, `rowerowa` (`DROP SCHEMA`). The schema named like the database user is that
  user's default schema and stays (the transfer page leaves it out).
- 18 person roles without any holder, edge, certificate, grant, page, message or seat (created 2026-09-18):
  unreachable; delete after a last reference check.
- `key_grant.sealed_held` (see above).

**The old content files** — `frontend/src/legacy/` (6 files) with `scripts/cogita-home.mjs` and
`scripts/presentation-home.mjs`, once the fixtures in `scripts/fixtures/` are final (the fixture JSON stays).
