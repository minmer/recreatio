# Who is responsible for the data

*Design, 2026-10-24, rewritten 2026-10-25 after the owner's legal review (RODO, church data protection, DSA). Not
built. Companions: [REPORTS.md](REPORTS.md) (reports and takedown by ID) and [EVENTS.md](EVENTS.md) (every event takes
its controller from here). The legal reasons are in §12; they are not legal advice.*

## 1. Today

Since 2026-10-17 the data controller ("Administrator danych") is read only from `app.area_controller`, created in 0022:

- **One row per area:** `area_id` (key; foreign key without cascade), `name` (not blank, at most 200), `address` (400),
  `email` (200) and `updated_at`. It is plaintext on purpose, because the clause has to be readable before anyone types
  anything. A save overwrites the row: there is no history and no record of who wrote it. The per-form copies
  (`module.controller_*`) were removed in step 3 of [TRANSFER.md](TRANSFER.md) and dropped by 0113.
- **Inheritance.** An area without its own row uses the nearest one above it: the area itself and at most 16 ancestors
  along `parent_area_id`. The recursive query is written twice: `Intake.ControllerOfAsync` (`GET
  /workspace/area/{id}/controller`) and `Form.WholeAsync` (`GET /form/{id}` and the submit gate). `GET /intake/{id}`
  and the `areas[]` of `GET /form/{id}` carry only the area's own row; the browser never reads the latter.
- **Forms.** While the chain has no row, `POST /form/{id}/submit` answers 409 ("Ten formularz nie ma jeszcze klauzuli —
  nie wiadomo, kto odpowiada za dane.") and the form card hides the questions ("Ten formularz nie mówi, kto odpowiada za
  dane, więc nic nie zbiera."). Entries the office types in, corrections (through the person's link or by the office)
  and answers to steps are not checked.
- **The clause** stands at the top of the form, under its title and above the questions ("Administratorem danych jest
  <nazwa>, <adres> (<e-mail>)."), on purpose, before anyone types; and in the header of the print sheet ("Administrator
  danych: …"). Each place builds the sentence inline. The need "Zasady udziału, wizerunek i informacja o danych"
  (`forms/needs.ts`, `INFO`) adds an art. 13 text under the questions that points to it ("administrator danych podany
  powyżej") and ends with "Przysługuje skarga do Prezesa Urzędu Ochrony Danych Osobowych." That is wrong for a parish.
  Switching the need on copies the text into the form's sealed design; the item's id is recorded in plaintext in
  `module.config` (`needs[].keys.tInfo` since 2026-10-24). The wording has not changed since 2026-10-08.
- **Editing.** An admin of the area ("prowadzi") writes the row, with an account. No call removes an own row, so an area
  with its own entry can never inherit again. An admin of an area whose chain is empty sees only empty fields; the
  warning "Nikt nie jest wpisany — formularze tego obszaru nie przyjmą zgłoszeń." is shown only to people who cannot
  edit.
- **New areas.** No way of creating an area shows or sets a controller ("Nowy obszar" offers "Nigdzie — osobny obszar",
  the starters "— samodzielny —"). A "Zapisy na wydarzenie" form in a standalone area refuses submissions, and the done
  screen says only "Gotowe.".
- **Tidy-up.** "Kartoteka i kolęda → Porządek w całej bazie" normalises the addresses of own rows, but only of areas
  that also have an intake key (it reads them through `GET /intake/{id}`).
- **Admins.** An admin of an area is an account that reaches, through live `holds` edges, a role with a live `admin`
  certificate on exactly that area. Certificates are not inherited down the tree (0035): a parish admin is not an admin
  of a group's area unless certified there. A role reached through an access link counts too: a link can carry admin
  ("zarządzanie"), and whoever joins it gets the link role's sign key.
- **Account deletion** is the only code that deletes areas, and only "dead" ones (private, held by nobody else, without
  seats, bound pages or modules on pages). It deletes their rows. Surviving child areas get `parent_area_id = NULL` and
  silently lose the inherited controller; nobody is told and nothing is kept. An area's parent is set when it is created
  and changes nowhere else.
- **Other places that collect personal data show no controller and check none:** booking a slot, starting "Napisz do
  nas" (whose answering area is created at the top level when it is set up from the page editor, so its chain is
  itself), joining by link, seat chats and the "Przedstaw się" name of link persons, answers in the person's portal,
  Cogita answers sealed for an area's intake, and what members and the office type in about other people: entries,
  bookings, mass intentions and calendar entries (also through write links), and person values a member releases to an
  area.

Three gaps follow from this. Areas outside a chain retype the same organisation, and since an area has a single
parent, a group can inherit from only one organisation. The clause lacks the data protection officer (IOD) and the
right authority. And anyone who leads an area can type any organisation's name into it.

## 2. What changes, and why

The owner's review (2026-10-25) keeps the idea of 2026-10-24, a record stored once that areas point to, and changes how
an area comes to point at it:

1. **Using another area's record needs that area's signature.** An admin of the area that wants it asks; an admin of the
   record's home area signs or refuses. The home side can also offer, and the other side accepts. One person who is
   admin of both does it in one step. Naming an organisation as controller is a legal statement on its behalf; without
   consent, anyone who can read the parish could make it responsible for their group.
2. **A signature means responsibility, and comes with a tool.** The record's organisation becomes responsible for the
   data in the attached area and in every area below it that inherits the record. Its home area's admins may then block
   and delete single items there by ID, without reading them ([REPORTS.md](REPORTS.md)). A controller must be able to
   answer an erasure request.
3. **History instead of deletion.** Attachments end with a date, records are closed, every change is a version. The
   question "who was responsible for area X on day Y?" always has an answer.
4. **No automatic transfer.** When a record's home area is deleted, the record is closed and its attachments end. The
   2026-10-24 rule that moved the home to another area is dropped.
5. **"Nobody responsible" is allowed, but visible.** Collecting stops; joining does not; the clause says so.
6. **Whoever creates a record confirms that they may act for the organisation.** A parish is represented by its pastor
   (can. 532 CIC); a volunteer cannot declare the parish controller alone.
7. **A processing agreement** (umowa powierzenia, art. 28 RODO) between each organisation with a record and the
   operator, accepted by the home area's admins.
8. **Existing entries move without a signature;** merging duplicates goes through the signature flow.

## 3. The model

```
 data_controller  "Parafia św. Kazimierza"   home: Parafia · versions 1…n · open or closed
        ▲                          ▲                                ▲
        │ attachment, signed       │ attachment, signed             │ asked, waiting
        │ by an admin of Parafia   │ by an admin of Parafia         │ (nothing changes yet)
   area Parafia               area Oaza (standalone)          area Pielgrzymka 2027
        │
   area Schola, area Bierzmowanie …   (no attachment: the nearest area above applies, as today)
```

- **A record** holds the name, the address and the e-mail, an optional phone, the IOD (name and contact, optional) and
  the authority: Prezes UODO, or the Kościelny Inspektor Ochrony Danych (KIOD) for Catholic church entities. New
  records and new versions need the name, the address and the e-mail; a moved entry without one shows a notice
  ("Uzupełnij adres i e-mail administratora."). A record has a **home area**, whose admins edit it. Each change is a
  new **version** (who, when). A change applies at once wherever the record is used, and the settings say where
  ("obowiązuje w 4 obszarach").
- **An attachment** says "this area uses this record". It starts as a request: **asked** (by an admin of the area) or
  **offered** (by an admin of the home area, signed already). It becomes **live** when the other side signs or accepts,
  and is **refused** or **cancelled** otherwise; until then nothing changes for the area, whose settings say that it is
  waiting. A live attachment **ends** with a date and a reason. An area has at most one live attachment. The home area
  attaches its own record when the record is created, in one step.
- **What applies.** For area X at time T: walk X and its ancestors as they were at T, nearest first, at most 16 levels;
  the first area with an attachment live at T decides, and the record's version live at T gives the text. With no
  attachment in the chain, nobody is responsible (§9). Forms never ask: the clause always follows the form's area, as
  today.
- **What signing means.** "‹Organizacja› odpowiada za dane w obszarze ‹B› i w obszarach poniżej, które z niego
  dziedziczą." From then on the home area's admins may block and delete single items in those areas by ID
  ([REPORTS.md](REPORTS.md) §6). This is a permission that the service checks at the time of each action against the
  admins' live certificates, not a key: it opens no content. A new sub-area below an attached area inherits without a
  new signature, and the signing dialog says so: only an admin of the parent area can create a sub-area, and nothing
  moves an area under another parent later.
- **Ends.** An attachment ends when the home area withdraws it ("Wycofaj"), when the area leaves it ("Dziedzicz z
  obszaru wyżej", or another record is attached), when the record is closed, or when the home area or the area itself is
  deleted. The areas that used it, directly or by inheritance, fall back to the nearest record above them or to none,
  and their admins get a notice in the bell.
- **Closed records.** A closed record cannot be edited or attached, and stays readable as history. Its home area's
  admins close it by hand; account deletion closes it when the home area dies. It is not deleted while any area that
  used it, directly or by inheritance, still exists.
- **The key for reported content.** Each record has an RSA pair for the reports its home area handles ([REPORTS.md](REPORTS.md)
  §5). The creating admin's browser makes it; its private half is granted to every role with admin on the home area,
  and a browser that holds it tops up new admins when the bell names them, as virtual areas do (`virtual.waiting`).
- **Confirmation of authority.** Creating a record, and changing its name, asks for one tick: "Potwierdzam, że mogę
  działać w imieniu tej organizacji — jestem jej przedstawicielem albo mam jego upoważnienie." The role and the time
  are stored with the version.
- **Processing terms.** Creating a record also accepts the operator's processing terms ("Warunki powierzenia
  przetwarzania danych"), by version. The terms are a static page next to `/prywatnosc/` whose header names its
  version; they say, among other things, that the operator may block content after a report of illegal content. They
  are a draft until the owner has them reviewed, and accepting is switched on only after that review. A home area's
  admins whose record has no accepted version (every moved record, and every record after the terms change) are asked
  on their next visit; until they accept, the settings show a notice and nothing is blocked (owner decision 6).

### History

- Attachments, versions and records are never deleted while the facts they record matter; rows keep area ids without
  foreign keys that would stop an area from being deleted.
- An area's parent changes only when account deletion cuts it loose. That moment is recorded (`area_parent_ended`), so
  the chain can be walked as it was on any day.
- Data from before A1's migration has no history: a moved entry counts from its last change (`updated_at`). For
  earlier days the answer is "unknown", and the settings say so.

## 4. Where it is stored, and why there

| option | verdict |
|---|---|
| plaintext tables `app.data_controller` (+ versions) and `app.controller_attachment` | **chosen.** Readable without keys, because the clause is for people without an account; one row per organisation; the area tree still decides which record applies; the attachments carry the history and the signatures |
| keeping `app.area_controller` and adding `controller_id` (the 2026-10-24 sketch) | its key is the area, so it can hold one row per area and no history or requests; it is replaced and dropped in step A3 |
| a copy per form (0042 until 2026-10-17) | removed in step 3 (0113), because every form asked again and a change had to be made in each copy |
| an entry in the Library (person or organisation) | entries are sealed: the service, which serves the clause and refuses submissions without a controller, cannot read them, and a form could show one only where the Library's area is public |
| the office role | role names are sealed, a role holds keys, and it is not a legal entity |
| an "organisation" table above areas | a second hierarchy next to the area tree, which already is the organisation's structure (0002 had one; 0022 dropped it) |

## 5. Data

A sketch; A1's migration takes the next free number (0129 at the time of writing).

```sql
CREATE TABLE app.data_controller (
    id                 uniqueidentifier NOT NULL PRIMARY KEY,
    home_area_id       uniqueidentifier NOT NULL,          -- no FK: a closed record outlives its home
    created_at         datetimeoffset   NOT NULL,
    created_by_role_id uniqueidentifier NULL,              -- NULL for moved entries
    current_version    int              NOT NULL,
    report_public_key  varbinary(1024)  NULL,              -- the key for reported content (§3)
    closed_at          datetimeoffset   NULL,
    closed_reason      nvarchar(16)     NULL,              -- closed | home-deleted | merged
    closed_by_role_id  uniqueidentifier NULL
);
CREATE TABLE app.data_controller_version (                 -- the values live here, once per change
    controller_id uniqueidentifier NOT NULL REFERENCES app.data_controller (id),
    version       int              NOT NULL,
    name          nvarchar(200)    NOT NULL,               -- not blank
    address       nvarchar(400)    NULL,                   -- required for new versions; normalised by PostalInput
    email         nvarchar(200)    NULL,                   -- required for new versions
    phone         nvarchar(40)     NULL,
    dpo_name      nvarchar(200)    NULL,                   -- Inspektor ochrony danych
    dpo_contact   nvarchar(400)    NULL,                   -- e-mail or postal address
    authority     nvarchar(8)      NOT NULL,               -- uodo | kiod
    written_at    datetimeoffset   NOT NULL,
    written_by_role_id uniqueidentifier NULL,
    authority_confirmed_at datetimeoffset NULL,            -- the tick of §3; NULL for moved entries
    PRIMARY KEY (controller_id, version)
);
CREATE TABLE app.controller_attachment (
    id                  uniqueidentifier NOT NULL PRIMARY KEY,
    area_id             uniqueidentifier NOT NULL,         -- no FK: history outlives the area
    controller_id       uniqueidentifier NOT NULL REFERENCES app.data_controller (id),
    state               nvarchar(10)     NOT NULL,         -- asked | offered | live | refused | cancelled | ended
    asked_by_role_id    uniqueidentifier NULL, asked_at    datetimeoffset NULL,
    signed_by_role_id   uniqueidentifier NULL, signed_at   datetimeoffset NULL,
    signature           varbinary(512)   NULL,             -- ControllerAttachmentRecord, §6
    certificate_id      uniqueidentifier NULL,             -- the signer's admin certificate on the home area
    accepted_by_role_id uniqueidentifier NULL, accepted_at datetimeoffset NULL,   -- offers
    decided_by_role_id  uniqueidentifier NULL, decided_at  datetimeoffset NULL,   -- refusals and cancellations
    live_from           datetimeoffset   NULL,
    ended_at            datetimeoffset   NULL,
    ended_reason        nvarchar(16)     NULL,             -- withdrawn | left | replaced | closed | home-deleted | area-deleted
    ended_by_role_id    uniqueidentifier NULL
);
-- at most one live attachment per area; requests are kept, like booking claims
CREATE UNIQUE INDEX uq_controller_attachment_live ON app.controller_attachment (area_id) WHERE state = N'live';
CREATE TABLE app.controller_terms (
    controller_id       uniqueidentifier NOT NULL REFERENCES app.data_controller (id),
    terms_version       nvarchar(16)     NOT NULL,
    accepted_by_role_id uniqueidentifier NOT NULL,
    accepted_at         datetimeoffset   NOT NULL,
    PRIMARY KEY (controller_id, terms_version)
);
CREATE TABLE app.area_parent_ended (                       -- written only by account deletion
    area_id        uniqueidentifier NOT NULL,
    parent_area_id uniqueidentifier NOT NULL,
    ended_at       datetimeoffset   NOT NULL,
    PRIMARY KEY (area_id, ended_at)
);
```

- **Who decided** is stored for every step (asked, signed, accepted, refused, cancelled, ended), which `app.claim`
  lacks today.
- **The grants of the report key** are `app.key_grant` rows of a new kind, as other keys are granted to roles.
- **Account deletion** lists every table by hand ("alle ohne Kaskade"); these tables are added there (§11).

## 6. Signatures

- **The record.** A new Kernel record type, `ControllerAttachmentRecord`: `{ attachmentId, controllerId, areaId,
  homeAreaId, signerRoleId, signedAt }`, times in unix seconds, canonical JSON as for certificates. The serializer is
  never changed (`Kernel/Canonical.cs`: any change invalidates every stored signature), and the browser builds the same
  value field for field (`core/canonical.ts`).
- **Who signs.** The browser signs with `ring.signKey(role)` of a role that itself holds a live `admin` certificate on
  the home area. The service checks that, as `Area.Renew` does for renewals, records the certificate's id, verifies the
  signature against `app.role.sign_public_key`, and accepts `signedAt` within ±1 h of its clock. A role held through a
  read or write edge has no sign key and cannot sign. Proposed (§15): the role must be reached from one of the
  account's own persons without passing through an access link, because signing for an organisation is not something
  to hand on with a link. Creating a record follows the same rule.
- **Asks and offers.** For an ask, the home admin signs when deciding. For an offer, the home admin signs when offering,
  and the area's admin accepts (role and time stored). One person who is admin of both sends the signature and the
  acceptance together.
- **Ends are recorded, not signed:** who, when and why, as certificate revocation is today (an unsigned update). The
  service is the witness of an end.
- **What is published.** `GET /controller/{id}?area=…`, without an account, returns the record with its versions and
  only the attachment that decides for that area (it may stand on an area above), with its canonical record, its
  signature, the signer's sign public key, and the certificate that authorised the signer, with its own signature and
  its issuer's public key. The list of every area that uses a record stays in its home area's settings, for its admins.
  A small browser check (`areas/controllerProof.ts`) verifies both signatures with WebCrypto; it is the first signature
  check in the frontend.
- **What it proves:** the key of role R signed statement S at time T, and R held an admin certificate on the home area
  signed by role I. **What it does not prove without trusting the service:** that the certificate was not revoked before
  T (revocation is an unsigned row), and the authority of I itself (certificates are not chained reliably: `GrantAsync`
  accepts an issuer that holds no `certify` itself as long as the caller's account does).
- **Names.** The signer appears as "prowadzący obszaru ‹Parafia›" with the role's id. Role and person names stay sealed
  (0097); members who can open names see the person. Nothing new about people becomes plaintext.
- **Kept after account deletion.** A deleted person's roles stay as tombstones with their public keys. The proof reads
  `sign_public_key` without the filter that skips revoked roles (`Area.PublicSignKeyAsync` has it), so old signatures
  remain checkable. Account deletion today hard-deletes the certificates the person held; a certificate that an
  attachment names is revoked instead and kept.
- **No expiry.** A live attachment holds until it ends. Kernel rule E-07 ("a grant without an end is a promise
  forever") is about certificates; the permission an attachment gives is checked against the home admins' certificates,
  which expire and are renewed as before.

## 7. Service

| call | who |
|---|---|
| `GET /workspace/controllers`: the records the account may pick, each with "used in N areas" | any account. It lists records whose home area the account holds a certificate on, and records that apply to such areas |
| `POST /workspace/controllers` `{ homeAreaId, fields, authorityConfirmed, termsVersion, signature, reportKey }`: a new record, attached to its home | admin of the home area |
| `POST /workspace/controller/{id}` `{ fields, authorityConfirmed? }`: a new version | admin of the home area; the tick is required when the name changes |
| `POST /workspace/controller/{id}/close`: ends every attachment | admin of the home area |
| `POST /workspace/controller/{id}/terms` `{ termsVersion }` | admin of the home area |
| `POST /workspace/controller/{id}/offer` `{ areaId, signature }` | admin of the home area |
| `POST /workspace/area/{id}/controller` `{ controllerId }`: ask, or attach at once with `signature` when the caller is also admin of the home area | admin of the area |
| `POST /workspace/area/{id}/controller` `{ inherit: true }`: end the own attachment | admin of the area |
| `POST /workspace/area/{id}/controller` `{ name, address, email }`, the old body: only a new version of a record homed in this area, marked unconfirmed so the notices of §3 show. Where the area has no record of its own, or uses another area's record, it answers 409 "Zaktualizuj aplikację, aby wpisać administratora danych." and changes nothing | admin of the area (old clients) |
| `POST /workspace/attachment/{id}/decide` `{ accept, signature? }`: sign or refuse an ask; accept or refuse an offer | admin of the side that decides |
| `POST /workspace/attachment/{id}/end` | admin of the home area (withdraw) or of the area (leave) |
| `GET /workspace/area/{id}/controller`: what applies, from which area, the attachment's state, waiting requests and notices. Same shape as now (`{ areaId, controller: { fromAreaId, name, address, email } \| null }`) with more fields | reader of the area |
| `GET /controller/{id}?area=…`: the record, its versions and the deciding attachment with its proof (§6) | anyone |

- **One resolver.** `Controllers.OfAreaAsync(area, at)` replaces the two copies of the chain query. `Form.WholeAsync`,
  `GET /intake/{id}`, `GET /form/{id}`, the booking offers, the start of "Napisz do nas", the join page
  (`AreasOfRoleAsync`) and account deletion read through it.
- **Validation** that the old call lacks: lengths, an e-mail format, one transaction.

## 8. Browser

- **Obszar → Ustawienia → Administrator danych** (`AreaController.tsx`) shows the clause that applies (own or inherited,
  with a link to the area it comes from), where the record is used, and any notice: "Czeka na podpis: ‹Parafia›",
  "Nikt nie odpowiada za dane w tym obszarze — formularze, rezerwacje i „Napisz do nas” nic nie przyjmą.", "Brak
  potwierdzenia uprawnień", "Nie zaakceptowano warunków powierzenia", "Uzupełnij adres i e-mail administratora.". Its
  actions:
  - "Wybierz zapisanego…": a list of records; picking one asks the home area, or attaches at once for an admin of both;
  - "Nowy administrator": the fields, the tick of authority and the processing terms;
  - "Zmień dane", only in the home area, saying where the change applies;
  - "Zaproponuj innemu obszarowi", only in the home area;
  - "Dziedzicz z obszaru wyżej";
  - in the home area, the list of areas that use the record, each with "Wycofaj", and "Zamknij wpis administratora".
- **On the next visit** a home area's admin whose record lacks the current terms or the tick is asked once, in a
  dialog: "Akceptuję warunki powierzenia przetwarzania danych (wersja …)." and the tick of §3. Closing the dialog
  leaves the notice in the settings.
- **The signing dialog** says in one sentence what a signature means (§3) and names the areas below that inherit.
- **The bell** gets a new kind "Administrator danych": asks for the home area's admins; offers for the area's admins;
  decisions (signed, refused, offer accepted or refused) for the side that asked or offered; ended attachments for the
  admins of every area that used them; records without accepted terms or a tick for their home area's admins; and new
  admins of a home area for a browser that holds the report key. Decisions are made in the settings, as booking
  requests are made on their resource (kind `bookings`, 0094). It needs a field in `Notify.BuildAsync`, the digest
  type, the alert list and the order check in `app-platform-check`. Telling the asking side needs a digest field of a
  kind no alert has today, as for the event listings ([EVENTS.md](EVENTS.md) §5.2), and a seen mark for notices needs
  a new `notify_seen` kind.
- **Formularz → Ustawienia:** `FormControllerNote` shows the same clause and states.
- **New area, starters, "Nowe wydarzenie"** show which record will apply. When the chain has none, they offer the saved
  records; picking one asks or attaches as above. The done screen says what is still missing ("Formularz zacznie
  przyjmować zgłoszenia, gdy ‹Parafia› podpisze.").
- **Kartoteka i kolęda → Porządek w całej bazie** normalises the addresses of the records the account may edit (instead
  of rows per area), offers merges ("Ten sam administrator jest wpisany osobno w: Schola, Oaza — użyj jednego zapisu",
  which asks or attaches as above and closes the duplicate once the signature is in), and offers the new text of the
  need "Zasady…" (§9).

## 9. The clause, and "nobody responsible"

One builder (`areas/controllerClause.ts`) makes the clause from the record, one sentence per part:

> Administratorem danych jest Parafia św. Kazimierza, ul. …, 31-… Kraków (kancelaria@…, tel. …). Inspektor ochrony
> danych: … (iod@…). Skargę możesz złożyć do Kościelnego Inspektora Ochrony Danych.

With `uodo` the last sentence reads "…do Prezesa Urzędu Ochrony Danych Osobowych.". Where no record applies, the clause
is never empty:

> Za dane zbierane tutaj nie odpowiada żadna organizacja. Treść możesz zgłosić operatorowi serwisu (‹nazwa
> operatora›).

The sentence links to the report page of [REPORTS.md](REPORTS.md); until step R1 is deployed, it links to the
operator's contact address. The operator's name and contact come from the owner (§15).

| place | the area that decides | today | after |
|---|---|---|---|
| a form | the form's area (`module.area_id`) | clause at the top; 409 without | the full clause at the top, as today: the code places it there on purpose, before anyone types, and the need's art. 13 text under the questions points up to it; same rule |
| the print sheet | the form's area | header line | the full clause |
| booking a slot | the resource's area (`resource.area_id`; its calendar is in the same area) | nothing | clause on the slot card; `Bookings.TakeAsync` (`/resource/claim`, `/resource/ask`) refuses without a record |
| starting "Napisz do nas" | the module's answering area (the chat's area) | nothing | clause above "Napisz do: …"; the start (`Chat.Ask`) refuses without a record |
| the join page and the "Otwarto z linku" bar | each area of the link (a link can open several) | nothing | one line per distinct record, and the "nobody" sentence for areas without one; never blocked |
| "Przedstaw się" of link persons | the chat's area | nothing | the clause of that area; not blocked |

- **The live setups first.** Before booking and "Napisz do nas" refuse anything (owner decision 7), the owner runs a
  read-only diagnostic (`Sql/diagnostics/controller_gaps.sql`, written in step A2): resources without a record, with
  their live claims, booking steps and pages; "Napisz do nas" modules whose answering area has no record; forms that
  refuse already. Parts on sealed pages are listed separately, because their configs are envelopes. If a live setup
  would break, that is reported and the rule waits.
- **Expected finding.** A "Napisz do nas" set up from the page editor has a top-level answering area, so its chain is
  only itself; each such module needs an attachment (ask the organiser's record) before the rule applies. From A2 on,
  setting it up asks under which area the answering area goes.
- **The need "Zasady…".** Its fixed sentence about Prezes UODO goes; the text ends instead "Gdzie możesz złożyć
  skargę, podaje informacja o administratorze danych na początku formularza." Old forms keep their copy until it is
  replaced: the tidy-up finds forms with the need on from the plaintext `config.needs`, opens their designs in the
  browser, and replaces the text item only where it still equals the old wording.
- **Not part of the rule:** corrections and answers to steps are never refused (a correction is a right), and joining is
  never refused (groups of private persons need no controller).

## 10. Moving the existing entries, old and new

- **A1's migration** creates the tables of §5 and moves each `area_controller` row into a record with that area as
  home: version 1 from the row's values, and a live attachment from the row's `updated_at`. Moved entries need no
  signature (the brief); they have no tick of authority, no accepted terms and no report key, so their home admins see
  the notices of §3, and their browsers make the key on the next visit. Nothing is merged silently, because merging
  hands the editing to another area's admins.
- **While both exist,** the old service may still write rows between the migration and the deploy. The new service
  reads the attachments and falls back to an `area_controller` row that has none; a row whose `updated_at` is later
  than its record's last version becomes a new version. Old clients keep working within the limits of §7; the Android
  app counts as an old client, because it carries its own copy of the website.
- **Step A3**, after the owner confirms that the website and the app are updated: its migration moves any row still
  unmoved, as A1's did, then drops `app.area_controller`. As with 0113, `migrate --through` holds it back until then.

## 11. Account deletion

Before it deletes the dying areas, account deletion:

- closes the records whose home area dies (`home-deleted`) and ends their attachments in every area;
- ends the attachments of the dying areas (`area-deleted`);
- records the parents it cuts (`area_parent_ended`), for the surviving children and for the dying areas themselves;
- keeps the certificates that attachments name (revoked instead of deleted).

The preview warns the deleting person ("Administrator danych ‹Parafia› przestanie obowiązywać w: Schola, Oaza"), and
the admins of every affected area get the notice of §8.

## 12. Why: the legal background

Recorded so that later readers understand the design. This is not legal advice: the owner has the texts users see
reviewed by someone with RODO practice, for a parish its diocesan data protection officer.

- **Controller and processor.** An organisation that decides why and how data is processed is its controller (art. 4(7)
  RODO). The operator stores the data on its behalf and is its processor, so they need a processing agreement (art. 28).
- **Organisers are responsible.** Whoever organises, coordinates and encourages an activity in which others collect data
  is jointly responsible for it, even without access to the data (CJEU C-25/17, Jehovan todistajat, 2018). That is why
  a parish can be responsible for its confirmation group's areas, and why it accepts that by signing.
- **Private groups.** Purely personal or household processing by private persons is outside RODO (art. 2(2)(c)); the
  regulation still applies to whoever provides the means (recital 18), which is the operator. Publishing to an
  unlimited audience is not a household activity (CJEU C-101/01, Lindqvist, 2003). That is why "nobody responsible" is
  allowed for groups of private persons. Requiring a record for forms, bookings and "Napisz do nas" is owner decision
  7.
- **Identification by ID.** A controller that does not need to identify people need not collect extra data only to
  comply; when a person provides information that allows identification, such as an item's ID, their rights apply again
  (art. 11). That is why reports carry IDs and nothing has to search sealed content.
- **Church entities** in Poland follow the 2018 general decree of the Polish Bishops' Conference; complaints about them
  go to the KIOD, not to Prezes UODO (NSA judgment of 25 May 2022). That is why the authority is part of the record.

Sources: [C-25/17 press release](https://curia.europa.eu/jcms/jcms/p1_1189415/en) ·
[C-101/01 press release](https://curia.europa.eu/jcms/jcms/P_42064/sv) ·
[Recital 18](https://gdpr-info.eu/recitals/no-18/) · [Art. 11](https://iitr.de/en/gdpr/11) ·
[NSA, 25 May 2022](https://www.infor.pl/prawo/nowosci-prawne/5477688,RODO-a-ksiegi-koscielne-NSA-UODO-nie-moze-nakazac-kurii-czy-parafii-usuniecia-danych-osobowych.html)

## 13. Plan

Each step works on its own and is deployed before the next: the owner applies the migration, then the API is deployed,
then the website, then the Android app.

| step | what | migration |
|---|---|---|
| A1 | records, versions, signed attachments with asks and offers, history, the report key, the settings with picking and requests, the bell kind, moving the existing entries, the confirmation of authority, accepting the processing terms (the terms as a draft for review), account deletion as in §11 | next free (0129 at the time of writing) |
| A2 | the clause with IOD and authority everywhere in §9, the "nobody responsible" rules after the live-setup check, the need "Zasady…" and its tidy-up | none (a read-only diagnostic) |
| R1 | reports and takedown ([REPORTS.md](REPORTS.md)), which uses the permission and the key of §3 | next free |
| E1–E5 | events ([EVENTS.md](EVENTS.md) §9) | see there |
| A3 | dropping `app.area_controller`, once all clients are updated | next free |

## 14. Today → after

| today | after |
|---|---|
| a row per area, overwritten, no author | a record with versions, each with who and when |
| any admin of an area types any organisation's name | using another area's record needs that area's signature; creating one needs a confirmation of authority and the processing terms |
| an own entry can never be removed | "Dziedzicz z obszaru wyżej" ends the attachment |
| the clause names only the controller, and the need "Zasady…" names Prezes UODO for everyone | the clause names the controller, the IOD and the right authority |
| booking, "Napisz do nas" and joining show nothing | they show the clause; booking and "Napisz do nas" collect nothing without a record |
| account deletion silently cuts child areas off their controller | the record is closed, attachments end, the cut is recorded, the admins are told |
| "who was responsible on day Y?" has no answer | attachments, versions and recorded parents answer it from A1 on |
| a controller cannot touch data it is named for | the home area's admins block and delete single items by ID ([REPORTS.md](REPORTS.md)) |

## 15. Open questions

Not in this round; nothing is built for them:

- **Joint controllers** (art. 26 RODO) for co-organised events: an area pointing to more than one record.
- **The full art. 13 information** under every form, with purpose, legal basis and retention set per form; the usual way
  is a short first layer under the form with a link to the full text.
- **Consent of minors.** Where processing relies on consent, children under 16 need their parents' consent in Poland
  (art. 8). This matters for confirmation groups.

For the owner, before the step that needs them:

- **A1: owner decision 6** (existing records without accepted terms: a notice, nothing blocked) is still a default.
- **A1: the operator's name and contact.** The processing terms name the processor, and the "nobody" clause of A2 names
  the operator ([REPORTS.md](REPORTS.md) §16).
- **A1: signing through a link.** Should signing and creating a record need a role reached from the account's own person
  without an access link in between? Proposed: yes.
- **A1: deleting closed records.** Proposed: a closed record is deleted once no area that used it, directly or by
  inheritance, exists any more; until then it stays as history.
- **A2: owner decision 7** (booking and "Napisz do nas" need a record; joining does not) is still a default.
- **A2: office entries.** Should entries the office types in (`POST /workspace/part/{id}/entry`) also be refused while
  no record applies? Proposed: yes for new entries, never for corrections.
