# Architecture

How REcreatio is built today (2026-10-17). The domain documents — [COGITA.md](COGITA.md), [LIBRARY.md](LIBRARY.md),
[CHAT.md](CHAT.md), [INTERACTIVE.md](INTERACTIVE.md) — go deeper into their parts; [TRANSFER.md](TRANSFER.md) records how the old data forms were removed and what is left.

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
| `frontend/android` | Capacitor shell in two editions (`productFlavors`): `play` for everyone, `sms` with SMS, MMS, the phone's contacts and the BLE lamp transmitter (`src/sms/`, installed by hand); `docs/` is the built website for GitHub Pages |

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
| `pages/` | the page registry and editor, parts (`parts/` — one file per kind), slides, presentation (with its storyboard: gates, values, the `question` part, run in the browser or in Cogita — `presentation/story.ts`, `storyRun.tsx`; COGITA.md §8), sealed pages (`pageSeal.ts`, `pageSealing.ts`), motion, interactive drawings (`motion/live*`, `expr.ts`: values, simulation, controls, rules; worlds of things — `liveWorld.ts`, `liveEdit.ts`, `liveWorlds.ts` (balance, gears); random tasks of comparable difficulty — `liveTask.ts`; the world panel — `LiveWorldPanel.tsx`, `liveSync.ts` — INTERACTIVE.md), event parts, JSON import/export |
| `lab/` | the physics laboratory, page part `physics` (LAB.md): the engine in code, experiments as JSON scenes. The frame with fullscreen (`LabFrame.tsx`), camera, loop and gestures (`labView.ts`), recorder (`labGraph.ts`), drawn values (`labRandom.ts`), liquids (`fluid.ts`), the editor (`LabEditor.tsx`). `physics/`: rigid bodies (SAT contacts, block solver, joints), basins with pressure, buoyancy, jets and pipes, scenes, presets (`fixtures/lab-fizyka.json` from `scripts/lab-examples.mjs`). `particles/`: the 2D particle laboratory, page part `particles` (documentation/particles/ — its own ARCHITECTURE.md and SIMPLIFICATIONS.md): the engine runs in a Web Worker (`engine.worker.ts`, `engine/` — particle store, neighbour grid, multiphase PBF in Jacobi kernels `solver.ts`, the band of air `band.ts`, species database `species.json` with sources, scenes, the step), drawn with WebGL2 (`render/`), the page side in `host.ts` and `ParticleLab.tsx`; with all cores (helper workers on shared memory, `runner.ts`, `helper.worker.ts`) only in its own tab `lab.html` (`src/lab.tsx`), made cross-origin isolated on GitHub Pages by the service worker `public/lab-sw.js`, which serves that page only; headless Vitest tests in `tests/` (`npm run test:particles`, the long one `npm run test:particles:slow`). `lab2d/`: the 2D lab engine v2, page part `lab2d` (documentation/lab2d/ — ARCHITECTURE.md, SIMPLIFICATIONS.md, MILESTONES.md, the sandbox plan SANDBOX.md): fields on an Eulerian MAC grid, water as APIC particles, bubbles as objects; `engine/` (grid, particle and bubble stores, multigrid solvers `solver.ts`, liquids of several materials (water, rapeseed oil — viscosity and drifting droplets, M2a), salt dissolved in the water (Pitzer water activity, boiling and freezing point, brine properties, crust — `solution.ts`, `salt.ts`, M2b), gas, regions, heat (particles of a cell share heat and salt at the diffusion rate, salt diffuses between cells — `exchange.ts`), baked clips (computed once, kept in IndexedDB, played back without computing, continued live from any frame — `clip/`; the lab never starts by itself, a module can bake on opening, one lab can offer several scenarios), bubble model, phase change, materials database `materials.json` with sources, IAPWS-IF97, scenes and tools `edits.ts`, budgets), drawn with WebGL2 (`render/`) from the worker `engine.worker.ts`, the page side in `host.ts`, `Lab2D.tsx`, `panels.tsx`; the accelerated view (button "Widok przyspieszony", M1e): the whole step on WebGPU in `gpu/` (kernels as WGSL strings `k*.ts`, `GpuEngine`, `GpuState` with upload/download for the tools, MGPCG `solver.ts`, the WebGPU renderer) run by `gpu.worker.ts`; presets in `presets.ts`, the page fixture `fixtures/lab2d-wrzenie.json`; headless Vitest tests in `tests/` (`npm run test:lab2d`, the long ones `npm run test:lab2d:slow`) and the benchmark `npm run bench:lab2d` |
| `modules/` | modules as own things (forms are modules), their settings and JSON |
| `library/` | library entries, citations, catalogue lookup, visibility by area (who reads is the area’s — LIBRARY.md; migrations of sealed data on the screen Porządki, `rebuild/`); **the one markup reader** of the app (`libraryMarkup.ts` parses, `markupView.tsx` draws: sources as footnotes, own entries as links) — also used by Cogita knowledge and the page `text` part (`LibraryLines.tsx`, `ui/richText.tsx`); the reference index over libraries and knowledge bases (`refIndex.ts`, names and paths in `refLabels.ts`, pages one leads in `pageUses.ts`) and places in the Scripture (`bible.ts`); sermons — a text's plan, its deliveries (what was said and skipped), topics as aspects, the public archive with filters, table and tree (LIBRARY.md, “Sermons”) |
| `cogita/` | knowledge bases, cards (`cards.ts`, `cardPalette.ts`, `cardBasics.ts`), revisions, flows, sessions, games, forms for adding many entries at once and editing them in that shape (`addForm*.ts`, `AddFormEditor.tsx`, `AddFormRun.tsx`, `AddFormRows.tsx`); who reads a base is its area’s (`visibility.ts`, `BaseWho.tsx` — no per-item publishing since step 8), and pages read the base itself (`pageBase.ts`) |
| `notify/` | the bell and its digest; push for the app |
| `phone/` | the SMS edition of the app (Gradle flavour `sms`): SMS and MMS from the phone's own store, shown like Rozmowy (`SmsApp`, `smsChat.tsx` built from `chat/ChatKit`, `Composer`, `SmsSheet` for "Napisz SMS"), the own number per conversation and per contact group on a phone with two SIMs (`lines.ts`, `LinesView`), muting, blocking spam and deleting conversations (natively `Spam.java`), the sealed SMS archive (`smsArchive.ts`: batches per conversation with outlines and the own number per message; owned by a chosen role, `archiveSettings.ts`), replies written in the browser and sent by the phone that has the conversation's number (`outbox.ts`), sending later (natively, `ScheduledSms`), choosing messages and reading them large (`reading.tsx`), files sent as encrypted links (`share.ts`; the page `SharedFile.tsx` behind the route `#/plik/<secret>`, no account needed; `Shares.tsx` lists the own links), the own address book (`ContactsApp`, `contactStore.ts`, vCard) and its copy in the phone's contacts; the shell loads only `here.ts` |
| `lamps/` | lamps controlled over Bluetooth LE by the SMS edition (native `LampPlugin`): devices with their signals, sealed in the own area (`lampStore.ts`); payloads parsed into AD structures and rebuilt as Android's `addManufacturerData` (`adv.ts`, `FrameView`); sending one after another with a console and history (`transmit.ts`, `LampConsole`); learning from a remote by scanning — strongest sender, runs, repeating pattern, nRF Connect logs (`learn.ts`, `LampLearn`); a pace (pause between transmissions, limit per frame) applied at sending time (`pace.ts`: one pair of sliders for the buttons, one per timer); timers at times of day with several actions, run by the phone's own alarm even with the app closed (`timers.ts`, `TimerList`, `TimerEdit`; native `LampTimers`) |
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
| `Identity/` | register/login (`Auth`), kept keys, state, persons, sealed-name checks, account deletion |
| `Roles/` | the role graph, creating roles and holders, invitations (links), reach |
| `Areas/` | areas, epochs and grants, certificates, intake and data controller, audiences, the workspace summary |
| `Pages/` | slugs (the address registry), pages and parts, modules, menus, images, access to pages |
| `Forms/` | forms (fields, design, submissions, office, links, steps, tasks, rounds) and seats |
| `Calendar/`, `Bookings/`, `Masses/` | calendars, agenda and tasks; resources and claims; masses and intentions |
| `Chat/` | chats, messages, features (scheduling, presence, marks), topics, seat chats, delivery worker |
| `Library/`, `Cogita/` | library entries, catalogue, Cogita storage; sessions, games and the SignalR hub |
| `Notifications/`, `Registry/` | digest and push; postal registry |
| `Phone/` | the SMS edition's storage: sealed contacts (with tombstones) in the own area; SMS archive batches (one conversation each, with message prints and a sealed outline, 0115) in the area of the role that owns the archive; sealed MMS files on disk; which archives a caller can read; the outbox of replies written in the browser (0116: sealed, waiting → taken → sent or failed, cancelled; `Push.Phone` wakes the phones); files behind a link (0117: sealed in the browser under a key that only the link holds, on disk next to the MMS files, with an expiry; anyone with the id may fetch the sealed file, `GET /share/{id}`); lamps (0118: one sealed document per device with its BLE signals, versioned, `Phone.Lamps.cs`) |
| `Transfer/` | what is left of the transfer: answers in RSA envelopes, server clean-up counts (goes when all are 0) |

Conventions: authorization in every handler (`Auth.WhoAsync`, `Area.MayAsync`, role reach); the service never
decrypts — it verifies signatures (`Kernel` records) and stores blobs; SQL is parameterized; errors go out as
`{ error }` with a Polish message.

## Data

One SQL Server database, schema `app` (0113 drops the empty schemas the old system left, see TRANSFER.md).

| Group | Main tables |
|---|---|
| identity | `account`, `account_key`, `session`, `account_state`, `notify_device`, `notify_seen` |
| keys and roles | `role` (key pairs, sealed private halves, `key_layout`), `role_edge` (signed), `key_grant` (`role`, `role_sign`, `epoch`), `certificate`, `invitation` |
| areas | `area`, `area_epoch`, `area_controller`, `area_member_name`, `intake` |
| pages | `slug` (with `page_seal`, 0121), `slug_page`, `slug_part`, `slug_area`, `slug_menu`, `module`, `form_group` |
| forms and seats | `slug_field`, `form_design`, `registration`, `registration_value`, `access` (seats), `access_holder`, `access_role`, `access_grant`, `form_step`, `task_*`; 0120: `module_role` (the roles a form gives), `virtual_area` (a form's rule for each person's own area), `area_instance` (one mini area per submission and rule) — see [MINI-AREAS.md](MINI-AREAS.md) |
| calendar | `calendar`, `calendar_item`, `calendar_field`, `calendar_exception`, `claim`, `item_slot`, `mass_intention` |
| chat | `chat`, `chat_message`, `chat_message_version`, `chat_seat_key`, `chat_read`, `chat_presence`, `chat_mark`, `chat_preference`, `chat_attachment`, `online` |
| library and Cogita | `library`, `library_entry`, `library_entry_version`, `library_file`, `learn_batch`, `learn_due`, `cogita_*` |
| phone (SMS edition) | `phone_contact`, `phone_sms_batch`, `phone_file`, `phone_outbox`, `phone_share`, `phone_lamp` (0118) |

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
  `holds` (0034). Certificates (`read`, `write`, `admin`, `certify`) on an area are signed in the browser by the
  issuing role and verified by the service. A page is led by the role that claimed its address; a page with access
  is bound to areas.
- **Lifetimes.** A certificate lasts two years (Kernel E-07: a certificate without an end is a promise forever).
  When one has less than a year left, the browser of anyone who may admit people in that area re-signs it with
  the same role and level — the bell names the areas (`renewals.waiting`), `areas/renew.ts` signs,
  `Areas/Area.Renew.cs` accepts only memberships that still exist (a dropped role stays out). The area's people
  list shows until when each level holds and warns when renewal failed. A role edge with `expires_at` in the
  past gives no reach (`Roles/RoleEdges.cs`, checked by every query that walks edges).
- **Answers.** Each value has its own key. A public submission wraps it for the intake public key (RSA); the first
  time the office opens it, the browser re-seals it under the office role key and the RSA envelope goes (0037).
- **Seats.** A person's place has a seat key; the link carries a secret that opens it. The office reaches seats
  through the intake.
- **Names** of forms and people are sealed (0097); public areas publish their epoch key, so public pages are
  readable by anyone and sealed all the same.
- **Links** are roles: the link role's keys are sealed under a key derived from the secret in the link; the service
  sees only the hash of a proof (`links/linkAccess.ts`). Since 0091 a link gives roles, not areas directly.
- **Sealed pages** (0121). A page with access may be sealed (Strony → Drzewo adresów → Ustawienia →
  „Zaszyfrowana"). Its title, lead, look (with a presentation's scenes), logic, subject, the layout and content of
  every part and its own menu are then envelopes `rcs1.<version>.<base64url>` in the same columns, sealed in the
  browser under a page key; `slug.page_seal` holds that key wrapped under the newest epoch key of each bound area and
  under the key of the role that leads the page. Readers open it the way they open names (`nameKey`: account, link,
  seat with a role); the leading role opens it without an area. A form keeps its settings readable (the service
  enforces portal rules with them). Switching on, off and renewing the key send the whole page in one transaction
  (`PUT /workspace/page-seal/{path}`); a change of the bound areas renews the key, and the service drops the wraps
  of areas that left. A sealed page cannot become public, and its parts and menu are not shared with other pages.
  Files (images, media) are not sealed yet. Code: `pages/pageSeal.ts` (envelopes, wraps, opening),
  `pages/pageSealing.ts` (the whole-page step), `pages/page.ts` (load opens, save seals); service
  `Pages/Page.Seal.cs`.

## Checks

`npm --prefix frontend run app:check` (type check + 11 logic checks + style ratchet), `vite build`,
`dotnet build recreatio.sln`, `Api.Tests`, `Kernel.Tests`. Browser drives (headless Edge) live outside the
repository and run against a local service with `zz-probe-…` accounts.
