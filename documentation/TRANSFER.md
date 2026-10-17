# Transfer — from old data forms to the current ones

The platform grew in rounds (migrations 0001–0111). Each round kept older data readable, so the code carried
branches that existed only for data written before some round. They were removed in three steps:

1. **Structure** — a clean code base without changing what it does. *Done 2026-10-17.*
2. **Prepare and transfer** — old data converted to the current form; in the browser after login where keys are
   needed. *Done 2026-10-17 (8 answer envelopes left, see below).*
3. **Remove** what was only there for old data. *Code done 2026-10-17; the database part runs with migration 0113.*

Counts are from the production database on 2026-10-17.

## Step 1 — structure

- Old documents removed; the current ones are in `documentation/`. New: `README.md`, `ARCHITECTURE.md`, this file.
- Frontend: `src/app` in domain folders; long files split along their concerns; `app.css` and `ui/ui.css` split into
  ordered parts (the built CSS stayed byte-identical); unused functions, re-exports, assets, dependencies and
  scripts removed; one `tsconfig.json`.
- Backend: `backend/Api` in domain folders, long classes split into partial files; `Api.Tests` in the solution.

## Step 2 — what was converted

| What | Old form | Current form | Done by |
|---|---|---|---|
| Migration records | 0078–0111 applied by hand | recorded in `schema_version` | `migrate --record-through 0111` |
| Chat posting policy | `legacy` | `members`, or `writers` for channels | transfer page, then 0112 for other accounts' chats |
| Data controller | per form (`module.controller_*`) | per area (`area_controller`), inherited by sub-areas | transfer page |
| SMS template | one text in `config.sms` | list in `config.smsTemplates` | transfer page |
| Account-root holdings (before 0040) | the account root holds areas, keys, an intake, pages | a person holds them | transfer page |
| Role key layout (before 0034) | one key opens name, reading and signing | own sign key, granted only to leaders | transfer page |
| Host confirmation (before 0050) | guessed from the length of the invite window | `claim.host_confirmed_at` | 0112 |
| Answer envelopes | value key wrapped with RSA for the intake | value key sealed under the office role key | transfer page / opening the answers |

Step 2 had written group, direct and notes chats as `writers`. That keeps the speakers but makes the browser show
the chat as a channel and add new members as readers; 0112 sets them back to `members` (notes always; group and
direct chats where nobody only reads).

## Step 3 — what was removed

**Code** (backend and frontend, no longer reading or writing the old forms):

- Chat policy `legacy`: `ChatRules.Explicit`, the `legacy` branches in delivery and settings, the `legacy` checks in
  `Api.Tests`, the "Dotychczasowe zasady" option. Chats are created with an explicit policy; `area` and `self` are
  `members`, `channel` is `writers`.
- Per-form data controller: the form's own entry and the answer-area fallback in `Form.WholeAsync` (the controller
  comes from the form's area chain only), the controller in module list and update, `ControllerForm`, the legacy
  part of `FormControllerNote`, the module part of "Porządek w całej bazie".
- Plaintext names (0097): `/workspace/names/unsealed` and `/names/seal`, `core/nameSeal.ts` (the name-from-answers
  part moved to `seats/seatNames.ts`), the "Nazwy" card, the plaintext fallbacks in every loader (bookings, chats,
  seats, digest, audiences, extensions) and in `core/names.ts` and `core/holderNames.ts`.
- Account-root hand-over (0040): `Identity/HandOver.cs`, `account/handOver.ts`, `HandOverBar`.
- Old role layout (0034): `Roles/Roles.Layout.cs`, `separateSignKey`, the layout-0 notice. Account roots keep their
  one key (`key_layout = 0`) — nobody else holds them; `Ring.signKey` keeps that branch.
- Pages bound to a role (0026): `/workspace/slug/internal` and every read of `internal_for_role_id`; a page with
  access is bound to areas (0051).
- Page certificates: `/workspace/grants` (list, issue, revoke) and the certificate branch of `Access.OfAsync`; a page
  is edited by whoever holds the role that leads it.
- Seat notes and the portal template (0028): `/workspace/seat/{id}/note`, `/workspace/area/{id}/portal`, the
  `seat-note` page module, the note in the seat bar and in "Moje miejsca"; the office talks to a person in the
  seat chat (0069).
- `/workspace/area/{id}/publish` (areas become public through `/public`) and `/workspace/chat/message/{id}/topic`
  (`/topic/collect` moves one or more messages).
- Identity roles `name` and `contact` (before 0038), the single SMS template merge, the browser's own "seen" mark
  (before 0090), the login repair for accounts without a root role (before 0006), the minimum-persons default
  (before 0049), the guessed host confirmation (before 0050; 0112 writes it), and every "fehlt beim alten Dienst" tolerance: those fields are required now.
- The transfer page shows only what is left (below). `migrate` lost `--drop-legacy` and `Sql/0000_drop_legacy.sql`
  (nothing outside `app` is left to drop); it gained `--through NNNN`.
- Runtime checks whether a table exists (`IF OBJECT_ID(…) IS NOT NULL`, for databases that missed a migration) in
  account deletion, the module list and removal, chat removal, the digest and the Cogita clock (`Cogita/Cogita.Game.cs`)
  — every table is there.

**Database** — `Sql/0113_drop_backward_compatibility.sql`; it stops (and changes nothing) if any of these still
holds data:

- `chat.posting_policy`: only `members`/`writers`, no default.
- Columns dropped: `module.controller_name/_address/_email`, `access.recipient_name`, `access.personal_note_sealed`,
  `access.internal_note_sealed`, `claim.holder_name` (`ck_claim_who` now asks for the sealed name),
  `slug.internal_for_role_id` (with its index and foreign key). Table dropped: `area_portal`.
- `slug_field.identity_role` without `name`/`contact`; `certificate.scope_kind` only `area`.
- The 18 person roles of 2026-09-18 that nobody holds and nothing references (checked against every column that
  names a role).
- The empty schemas of the old system (`calendar`, `chat`, `edk`, `event2`, `events`, `forms`, `hortus`, `library`,
  `limanowa`, `pilgrimage`, `rowerowa`). The schema named like the database user is its default schema and stays.

### Running it — in this order

```sh
# 1. Once: the hand-applied scripts must really be there (read-only, every row must say 1)
#      backend/Api/Sql/diagnostics/applied_0078_0111.sql
dotnet run --project backend/Api -- migrate --record-through 0111

# 2. The data conversion — safe under the service that is running now
dotnet run --project backend/Api -- migrate --through 0112

# 3. Deploy the service, then the website (deploy-web.bat, push docs/) and the Android app (deploy-app.bat):
#    an installed app carries its own copy of the website and would keep the old requests.

# 4. What the new service no longer reads
dotnet run --project backend/Api -- migrate --dry-run     # lists only 0113
dotnet run --project backend/Api -- migrate
```

Running 0113 before step 3 would break the running (old) service where it still reads the dropped columns; no data
would be lost, and deploying the new service repairs it.

## What is left

- **8 answers in RSA envelopes** (the confirmation form): they were wrapped for the intake of the seat's area
  ("Kandydaci") instead of their question's area — most likely corrections made through the link in September 2026.
  The office's usual path does not open them. The account that holds both intakes signs in, opens
  **Konto → Przeniesienie danych** and presses **Przepakuj** (`forms/rewrap.ts` tries the other intakes it opens and
  files the keys under the office key of the question's area). Then the transfer can go: `backend/Api/Transfer/`,
  `account/transfer.ts`, `account/TransferPage.tsx`, `forms/rewrap.ts`, the `spare` parameter of `readAcross`, the
  route and the menu and search entries.
- **Old event files**: the `legacy` document kind of the page JSON import (`pages/pageJson.ts` `planLegacy`,
  `pages/slides/SlidesImport.tsx`) and the single `track` of the map part read the exports of the old system. The old
  tables are gone, so these files are the only way in; remove both once no old export is left to import.
- **Fixture sources**: `frontend/src/legacy/` (6 content files) with `scripts/cogita-home.mjs` and
  `scripts/presentation-home.mjs`, until the fixtures in `scripts/fixtures/` are final.

### Kept on purpose — current data, not compatibility

- **New RSA envelopes** keep arriving: a public submission can only wrap for the intake's public key. They are
  re-sealed when the office opens them (0037).
- **Questions from before 0042** (6) have their label under the key of their answers' area (`label_area_id` empty);
  the fallback to that area stays.
- **Seats from before 0046** (70) have no stored link; the office issues a new one when it sends it.
- **Seats' office envelope** (`seat_key_for_office`) is stored but not read yet; **`key_grant.sealed_held`** (0037)
  is unused — both are design tasks, not transfers.
- **Kernel labels**: `Kernel/Aad.cs` keeps its full list of AAD fields (the test vectors of the specification use
  some of them).
