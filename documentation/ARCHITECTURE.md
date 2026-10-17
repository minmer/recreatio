# Architecture

How REcreatio is built today (2026-10-17). The domain documents — [COGITA.md](COGITA.md), [LIBRARY.md](LIBRARY.md),
[CHAT.md](CHAT.md) — go deeper into their parts; [TRANSFER.md](TRANSFER.md) lists what still exists only for old data.

## The idea in one paragraph

The browser holds the keys; the service holds ciphertext and checks signatures. Access is a key: whoever holds an
area's epoch key reads what is sealed under it, and a signed certificate says what a role may change. A role is a
key pair plus a symmetric role key; roles hold other roles (a key grant + a signed edge), so walking the graph from
the account's root is walking the keys. Pages, forms, calendars, chats, the library and Cogita all live in **areas**
and use this one mechanism.

## Repository layout

| Path | What |
|---|---|
| `backend/Api` | the service: ASP.NET Core minimal APIs, `static partial class` per domain, raw SQL (`Microsoft.Data.SqlClient`) |
| `backend/Api/Sql` | migrations, embedded into the assembly and run by `migrate`; `diagnostics/` holds read-only checks |
| `backend/Kernel` | bytes only: AES-256-GCM sealing, RSA (OAEP wrap, PSS sign), AAD, canonical records, ids. No domain knowledge |
| `backend/Api.Tests`, `backend/Kernel.Tests` | console check programs; `Kernel.Tests/wrap-vector.json` is a cross-language vector |
| `frontend/src/app` | the application (React 18, TypeScript, Vite) |
| `frontend/src/legacy` | six content files read only by the fixture generators `scripts/cogita-home.mjs` and `scripts/presentation-home.mjs` |
| `frontend/scripts` | `app-*-check.mjs` (logic checks, bundled with esbuild from source paths), fixtures, Android tooling |
| `frontend/android` | Capacitor shell; `docs/` is the built website for GitHub Pages |

## Frontend

Entry: `src/main.tsx` keeps an access link out of the address, starts the Android shell when present, then mounts
`app/mount.tsx` (theme, CSS) → `app/App.tsx` (routing by hash: public pages, links, seat portals, the workspace).
`routes.ts` is the one place where addresses are built and read.

| Folder | Responsibility |
|---|---|
| `core/` | crypto (`crypto.ts`, `canonical.ts`), the key ring (`keys.ts`, `ringOf.ts`, `keyring.ts`), session and kept keys, names sealing, prefs, small utilities (`plural.ts`, `dayMath.ts`, `masonry.ts`) |
| `ui/` | the design system: tokens and components (`ui.css` → `tokens.css`, `components.css`, `frames.css`, `kit.css`), `Icon`, `Menu`, `Modal`, `PageHeader`, `Loading`, `ask`/`toast` (`dialogs.tsx`), `later` (lazy parts) |
| `styles/` | the screen styles, imported in order by `app.css` (the order is part of the cascade) |
| `shell/` | frames (workspace, plain, public), sign-in, unlock, crumbs, search palette, phone bar |
| `workspace/` | the workspace views (Teraz, alerts, starters, recent), cached view data (`viewData.ts`) |
| `account/` | Konto: own data, keys and devices, deletion, the transfer page |
| `roles/` | role graph, creating roles and holders, signing edges, member roles of forms |
| `areas/` | areas: people, access, settings, data controller, audiences |
| `links/` | access links (a link is a role), joining, sharing |
| `seats/` | a person's place behind a personal link: portal, verification, seat chat |
| `forms/` | forms: fields, layout and logic, submissions (`submissions.ts`, `revisions.ts`, `valueCheck.ts`), the office (`FormOffice.tsx` + `useFormOffice.tsx`), SMS, tables, JSON |
| `steps/` | steps of a person after a form: marks, tasks, bookings, chats, learning |
| `calendar/` | calendars, events and tasks, programmes, agenda |
| `masses/` | masses, confessions, devotions; the office (intentions, plan, terms, printing) |
| `bookings/` | resources that can be taken; offers, claims, the slot card |
| `chat/` | chats: the kit (`ChatKit.tsx`, `ChatLog.tsx`, `Composer.tsx`, `ChatChrome.tsx`), the three rooms (`ChatPage`, `PageChatView`, `SeatChatView`), topics, features |
| `pages/` | the page registry and editor, parts (`parts/` — one file per kind), slides, presentation, motion, event parts, JSON import/export |
| `modules/` | modules as own things (forms are modules), their settings and JSON |
| `library/` | library entries, citations, catalogue lookup, publishing |
| `cogita/` | knowledge bases, cards (`cards.ts`, `cardPalette.ts`, `cardBasics.ts`), revisions, flows, sessions, games |
| `notify/` | the bell and its digest; push for the app |
| `registry/` | addresses (postal parts), Kartoteka |

Conventions:

- **One concern per module, about 800 lines at most.** A long component keeps its state in a hook beside it
  (`useFormOffice.tsx`, `useFormCard.ts`). One exception on purpose: `pages/slides/useSlideScroll.ts` is a
  line-for-line port of tuned gesture code. A few modules are still a little above the mark (`useFormOffice.tsx`,
  `cogita/schema.ts`, `pages/presentation/PresentationView.tsx` and `presentation.ts`, which the fixture
  generators read by name).
- **Import what is declared, where it is declared.** No pass-through re-exports.
- **Pure logic in `.ts`, views in `.tsx`.** The check scripts bundle the `.ts` modules directly.
- **Lazy where it is heavy.** Workspace views and page parts load through `React.lazy`/`later`; vendor chunks
  (reactflow, zxing, dnd-kit, hash-wasm) are split in `vite.config.ts`.
- **Comments in German, interface in Polish, documents in English.**
- **The style ratchet** (`scripts/app-style-check.mjs`) counts hand-made values (px font sizes, raw z-index,
  `window.confirm`, inline styles, grey hints); the counts may only fall.

## Backend

`Program.cs` wires middleware and calls `X.Map(app)` per domain; `migrate` and `slug` are command-line modes.

| Folder | Responsibility |
|---|---|
| `Infrastructure/` | `Db`, `Migrate`, error middleware, file logging, `Caller` (account or link), time zones |
| `Identity/` | register/login (`Auth`), kept keys, state, persons, sealed names, account deletion, the 0040 hand-over |
| `Roles/` | the role graph, creating roles and holders, invitations (links), reach, the key layout change |
| `Areas/` | areas, epochs and grants, certificates, intake and data controller, audiences, the workspace summary |
| `Pages/` | slugs (the address registry), pages and parts, modules, menus, images, access to pages |
| `Forms/` | forms (fields, design, submissions, office, links, steps, tasks, rounds) and seats |
| `Calendar/`, `Bookings/`, `Masses/` | calendars, agenda and tasks; resources and claims; masses and intentions |
| `Chat/` | chats, messages, features (scheduling, presence, marks), topics, seat chats, delivery worker |
| `Library/`, `Cogita/` | library entries, catalogue, Cogita storage; sessions, games and the SignalR hub |
| `Notifications/`, `Registry/` | digest and push; postal registry |
| `Transfer/` | the transfer status for old data forms (removed in step 3) |

Conventions: authorization in every handler (`Auth.WhoAsync`, `Area.MayAsync`, role reach); the service never
decrypts — it verifies signatures (`Kernel` records) and stores blobs; SQL is parameterized; errors go out as
`{ error }` with a Polish message.

## Data

One SQL Server database, schema `app` (the other schemas are empty leftovers of the old system, see TRANSFER.md).

| Group | Main tables |
|---|---|
| identity | `account`, `account_key`, `session`, `account_state`, `notify_device`, `notify_seen` |
| keys and roles | `role` (key pairs, sealed private halves, `key_layout`), `role_edge` (signed), `key_grant` (`role`, `role_sign`, `epoch`), `certificate`, `invitation` |
| areas | `area`, `area_epoch`, `area_controller`, `area_member_name`, `intake` |
| pages | `slug`, `slug_page`, `slug_part`, `slug_area`, `slug_menu`, `module`, `form_group` |
| forms and seats | `slug_field`, `form_design`, `registration`, `registration_value`, `access` (seats), `access_holder`, `access_role`, `access_grant`, `form_step`, `task_*` |
| calendar | `calendar`, `calendar_item`, `calendar_field`, `calendar_exception`, `claim`, `item_slot`, `mass_intention` |
| chat | `chat`, `chat_message`, `chat_message_version`, `chat_seat_key`, `chat_read`, `chat_presence`, `chat_mark`, `chat_preference`, `chat_attachment`, `online` |
| library and Cogita | `library`, `library_entry`, `library_entry_version`, `library_file`, `learn_batch`, `learn_due`, `cogita_*` |

Migrations: `NNNN_name.sql`, idempotent (guarded), recorded in `app.schema_version` with a checksum. Applied
scripts are never edited.

## Keys

```
password ──Argon2id──► PasswordKey ──opens──► master_key_sealed ──► MasterKey
MasterKey ──HKDF(role-read:<root>)──► key of the account root (kind `account`)
role key ──opens──► wrap private key ──unwraps──► key_grant: role keys of held roles (persons, roles, groups),
                                                   their sign keys (`role_sign`, only for leaders), area epoch keys
epoch key ──opens──► everything sealed in the area (names, fields, pages, calendars, chats, library)
```

- **Levels.** Edges are `holds`, `write`, `read`; the role key goes with every edge, the sign key only with
  `holds` (0034). Certificates (`read`, `write`, `admin`, `certify`) on an area, page or body are signed in the
  browser by the issuing role and verified by the service.
- **Answers.** Each value has its own key. A public submission wraps it for the intake public key (RSA); the first
  time the office opens it, the browser re-seals it under the office role key and the RSA envelope goes (0037).
- **Seats.** A person's place has a seat key; the link carries a secret that opens it. The office reaches seats
  through the intake.
- **Names** of forms and people are sealed (0097); public areas publish their epoch key, so public pages are
  readable by anyone and sealed all the same.
- **Links** are roles: the link role's keys are sealed under a key derived from the secret in the link; the service
  sees only the hash of a proof (`links/linkAccess.ts`). Since 0091 a link gives roles, not areas directly.

## Checks

`npm --prefix frontend run app:check` (type check + 11 logic checks + style ratchet), `vite build`,
`dotnet build recreatio.sln`, `Api.Tests`, `Kernel.Tests`. Browser drives (headless Edge) live outside the
repository and run against a local service with `zz-probe-…` accounts.
