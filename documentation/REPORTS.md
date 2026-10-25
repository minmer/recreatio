# Reports and takedown

*Design, 2026-10-25, from the owner's brief "data controller, reports and events". Not built. Companions:
[DATA-CONTROLLER.md](DATA-CONTROLLER.md) (who answers for an area's data) and [EVENTS.md](EVENTS.md) (the catalogue
must not go public before this works). The legal reasons are in §13; they are not legal advice.*

## 1. Why

Content is sealed in the browser, so neither the operator nor a controller can search it, and nobody has to. When
someone reports a specific item, the report carries the item's kind and ID. The item can then be blocked or deleted by
that ID without anyone reading it. The hosting provider must offer an easy way to report specific items and act on
them (DSA art. 16, 17), and a controller must be able to answer a person's requests about their data, including
erasure, within a month (RODO art. 12(3)). A person who gives an item's ID gives information that allows
identification, so their rights apply (art. 11).

## 2. Today

- **No report feature.** The only "Zgłoś błąd" is Cogita's feedback on a question (anonymous `flags` batches sealed for
  the base's intake); it is not moderation, so the new entry needs another name and path.
- **What the service can read.** Most content is sealed. Some is plaintext by design: every page that is not sealed (all
  public pages, and access-only pages unless sealed under 0121) with its parts and menu; all page files, also on sealed
  pages; the names of areas, calendars, bookable resources and non-form modules; public appointment titles, mass
  intention texts and link labels. Public areas publish their epoch key, so what is sealed in them is readable by anyone,
  the operator included. The AI link (0126) is the one place where the service opens content.
- **No blocked state.** No content kind can be hidden from everyone by a third party and brought back. The nearest is
  `registration.is_hidden`, set by the office: it takes a submission out of the office's list, member lists, "Napisz do
  nas", mini-area planning and the bell's counts, but the person still sees it.
- **Deleting is for the item's own people.** Every delete checks the item's own writers or moderators: certificates on
  exactly its area, or the role that leads its page. Some kinds have no delete at all: pages (an address can be moved,
  never deleted), a single chat attachment (files go only with the whole chat), the kept versions of a deleted message
  or Library entry, and a submission with mini areas (0120), whose removal fails on `fk_area_instance_registration`.
  Some deletes are refused by state: appointments with bookings or accepted intentions, celebrated intentions, forms
  with submissions.
- **Page files** are served to anyone who has their id (`GET /page-image/{id}`), with `Cache-Control: public,
  max-age=31536000, immutable`: a copy already fetched cannot be recalled.
- **Public pages outside organisations.** Any signed-in account can publish up to 500 addresses `c/<8 znaków>` per role
  (Cogita's direct publishing). A page whose only leading role belonged to a deleted account can no longer be edited or
  taken down by anyone through the service.
- **No operator access.** There is no web console and no operator role, and no configuration names an account, role or
  area. The owner administers outside the web service: the console modes `migrate` and `slug add|recode|host|list`, run
  where the connection string is, SQL by hand with read-only scripts in `Sql/diagnostics`, and manual deploys. The
  address kontakt@recreatio.pl is published on the privacy page, the account deletion page and the Play listing; who
  reads it is not in the repository (§16). In the app the owner is an ordinary account.
- **No e-mail.** The service sends no e-mail and no SMS. Its outbound calls go to Firebase Cloud Messaging (an empty
  "check" wake-up), three book catalogues and OAuth client metadata.
- **The bell** is computed per account at each poll from live state; nothing is stored as a message. Only accounts have
  it. It reaches a seat only when an account has bound the seat to one of its persons (`access_holder`); other seats and
  link persons see things only in their portal and seat chat.
- **Spam and technical data.** Nothing protects public forms, sign-in or registration: no captcha, honeypot, proof of
  work or rate-limit middleware. The AI link and the catalogue lookup count requests per IP in memory; those entries are
  pruned only above 20,000 or 10,000 keys, so an address can stay in memory until the process restarts. The service's
  own log holds no IP addresses and keeps failures for 7 days; the hosting provider's access logs are outside the
  repository. Sessions store no IP or user agent.
- **No audit log.** Signed certificates, role edges, link redemptions and message versions record who did one kind of
  thing; nothing records actions in general.
- **The operator's pages.** `/prywatnosc/` (2026-09-30) and `/usun-konto/` exist as static pages; there is no terms of
  use, contact page or imprint. The privacy page names a parish as the controller of the whole platform, with the
  diocesan IOD and the KIOD, which contradicts the brief (§9).

## 3. The idea

```
 reporter (anyone) ──"Zgłoś"──► report: kind + ID of the item, kind of report, receipt hash      (plaintext: routing)
                                        reason, contact, attached content                        (sealed for the handler)
        │
        ▼
 routing: item ─► its area ─► the record that applies (DATA-CONTROLLER.md)
        ├── "Dotyczy moich danych" and a record applies ──► the home area's admins   (one month, bell reminders)
        └── illegal content, "Inne", or no record     ──► the operator               (may involve the record's admins)
        │
        ▼
 handling:  block (reversible) ─► tell the author, who may object ─► delete for good, or restore
            the reporter sees the decision by the receipt · every step is logged, without content
```

Handling acts only on the reported item, never on its whole area.

## 4. What can be reported

| item kind | what | its ID, as a viewer sees it | area for routing | its author, as the service knows it |
|---|---|---|---|---|
| `page` | a page with its menu and look | slug id (`GET /page` returns it) | none for a public page; the bound areas of an access-only page | the role that leads the nearest claimed address |
| `part` | one part of a page | `slug_part` id (`part-<id>` in the page) or module id | the module's area, else as its page | as its page |
| `form` | a form: questions and texts | module id | `module.area_id` | the writers of that area |
| `file` | a page file: image, document, track, media | `page_image` id (in every file address) | as its page | `created_by_role_id` |
| `message` | a chat message | `messageId` (`message-<id>` in the chat) | `chat.area_id` | `author_role_id` and `author_person_id`, or a seat |
| `attachment` | a file in a chat | its id, known only inside the sealed message; the reporter's browser adds it to a `message` report | `chat.area_id` | `uploaded_by`: the account, or the seat |
| `share` | a file behind a link (`#/plik/<secret>`) | `phone_share` id, which the viewer's browser derives from the secret | `phone_share.area_id` | the area's writers; a Thunderbird connection's account |
| `entry` | an entry of a public Library, Scriptorium or knowledge base | entry id (`?t=`, `?wpis=`) | `library.area_id` | `written_by_account_id` (since 0109) |
| `item` | an appointment of a public calendar, or a point of a programme | item id, with one occurrence's time or none for the whole series | the calendar's area | `owner_role_id` |
| `intention` | a mass intention on the public plan | its id, which the public plan must start carrying | the mass calendar's area | `created_by_role_id` |
| `link` | an access link's join page (label, area names) | invitation id | the link's areas (one or several) | `created_by_role_id` |
| `submission` | one's own submission (requests about one's own data) | `registrationId`, shown to the person | the form's area and its answer areas | — |
| `event` | a card in a list of events; comes with [EVENTS.md](EVENTS.md) step E1 | the event's area id | the event's area | the event's leaders |

| item kind | where a block is checked | delete for good |
|---|---|---|
| `page` | `Page.WritePageAsync` (`/page`, `/site`; also the editor and widgets) | new: the page's content goes, the address stays claimed |
| `part` | `Page.PartsOfAsync` | the placement goes; the module goes when nothing else holds it |
| `form` | `GET /form/{id}`, the submit and the office paths | new: the form is closed and its questions and texts are removed; its submissions stay with the controller |
| `file` | `GET /page-image/{id}` | the existing hard delete |
| `message` | `Chat.ReadMessagesAsync`, `Chat.VersionListAsync` | new: the body and all versions |
| `attachment` | `Chat.DownloadAsync` | new: a single file |
| `share` | `ShareRowAsync` | the existing delete |
| `entry` | `OpenEntriesAsync`, `WriteEntriesAsync`, `VersionAsync`, the AI link | new: the tombstone and its versions |
| `item` | the calendar, programme, mass, agenda and chat-link readers | the existing delete; where it is refused, the sealed fields are removed instead |
| `intention` | `Mass.ShowAsync` | the existing delete; where it is refused, the text is emptied |
| `link` | `GET /invite/{lookup}` | the link is revoked |
| `submission` | the office's lists | the existing remove, fixed for mini areas |
| `event` | `GET /events`, `GET /event/{id}` | taken off its lists; the event itself is handled as a `page` |

- **Several areas.** An item with more than one area (an access-only page bound to several areas, a link, a
  submission with answer areas) goes to a controller only when every one of its areas has the same record; otherwise to
  the operator, who may forward it.
- New kinds come the same way: an ID a viewer can see, an area, an author, a choke point, a delete.

## 5. Reporting

- **Anyone may report**, with or without an account.
- **"Zgłoś" entries** fill in the item's kind and ID by themselves:
  - every part of a page, on each of the four card frames that know the part's id: the grid card, the slide card, the
    presentation piece and the widget card (no single frame wraps every part);
  - every page as a whole ("Zgłoś stronę"), in its footer, or for slides and presentations, which cover the whole
    screen, in a small fixed control;
  - page files in the gallery's viewer and in part "Pliki";
  - every form (the form card is one component everywhere);
  - the join page and the "Otwarto z linku" bar;
  - every message (one entry in `MessageMenu`, which all chat rooms share, the read-only one of link readers too);
  - a file behind a link (`#/plik/…`);
  - every widget on another website, next to "recreatio.pl ↗";
  - every card of the event catalogue, when it comes with [EVENTS.md](EVENTS.md) step E4.
- **The report page** (`#/zglos`; the word must join the route words in `routes.ts` and `Slug.IsReserved`, after `slug
  list` shows that no page of that name exists) also takes an address or an ID, for people who have only a link or a
  screenshot.
- **The form:**
  - what is reported (filled in, or chosen from the page's parts and files);
  - the kind: "Dotyczy moich danych" (dostęp, sprostowanie, usunięcie, sprzeciw…), "Treść niezgodna z prawem",
    "Inne";
  - "Dlaczego?" (required);
  - "E-mail do odpowiedzi (opcjonalnie)";
  - for a member who can read the item: "Dołącz treść" — the browser opens the item and adds it. The form says: "Osoba,
    która rozpatruje zgłoszenie, zobaczy tę treść.";
  - before sending, the page says who will handle it: "Rozpatrzy: administrator danych ‹Parafia›" or "Rozpatrzy:
    operator serwisu".
- **Sealing.** The browser seals the reason, the contact and any attached content as a public form seals its answers:
  each value under its own key, wrapped for the handler's public key. A controller's key is the record's key for
  reported content ([DATA-CONTROLLER.md](DATA-CONTROLLER.md) §3), whose private half every admin of the home area
  holds; the operator's key is granted to the operators (§8). An area's forms intake is not used, because it opens for
  one role only. Only the routing stays plaintext: the item's kind and ID, the area and record found for it, the
  handler, the kind of report, times, and the hash of a receipt. A record whose key does not exist yet (a moved record
  before its admins' next visit) has its RODO reports go to the operator, who forwards them once it exists.
- **Confirmation at once.** The page shows "Zgłoszenie treści przyjęte" with a number and a receipt link
  (`#/zglos/<receipt>`). The receipt stays in the reporter's browser; the service keeps only its SHA-256, as for
  anonymous form receipts. A signed-in reporter also finds it under Konto → "Twoje zgłoszenia treści", kept in the
  account's sealed preferences. The service stores nothing that names the reporter.
- **Spam,** without an account and without a third party:
  - a small proof of work in the browser (a few seconds, from a challenge the service signs and does not store);
  - at most 10 reports an hour from one IP address, counted in memory, each entry removed after an hour, never written
    to the database or a log;
  - each report keeps its own row, receipt and sealed parts; reports of the same item and the same kind share one case,
    shown once with a count.

## 6. Who handles what

| kind of report | a record applies to the item's area | no record applies, or the item has no area |
|---|---|---|
| "Dotyczy moich danych" | the record's home area's admins: one month (art. 12(3) RODO), the bell reminds them a week before and on the last day; the operator only forwards and helps | the operator |
| "Treść niezgodna z prawem" | the operator (the hosting provider), who may involve the record's admins | the operator |
| "Inne" | the operator, who may involve the record's admins | the operator |

- **The permission.** A record's home area's admins may block and delete by ID the items of every area to which that
  record applies at the moment of the action ([DATA-CONTROLLER.md](DATA-CONTROLLER.md) §3). The operators may do so for
  any item. Neither gets a key.
- **Without a report.** A record's admins and the operators may open a case for an item themselves, for example after a
  request by letter: the report page works for them, and the case is theirs at once. Every action still belongs to a
  case and has a row in the log.
- **Asking the leaders.** The handler may ask the leaders of the item's area, who can read it, to judge it
  ("Poproś prowadzących o ocenę"). They receive the item's ID and a question the handler writes, never the reporter's
  text or contact, sealed for the public keys of the roles that lead the item's area; they answer the same way.
- **The reporter stays unknown.** The reporter's identity and contact go only to the handler. They are never passed on
  to the item's area or to its author, and the reporter is never told who wrote an item. Identities go only to
  authorities with a legal basis, outside this system. When the operator forwards a RODO request to the controller, the
  contact goes with it, because the controller answers the person.
- **Suspected crimes.** A report of a crime that threatens someone's life or safety must be passed to the authorities
  (DSA art. 18). The operator's queue reminds of that for every "Treść niezgodna z prawem", and the log records that it
  was done, without content.

## 7. Handling

1. **Received:** the reporter got the confirmation (§5); the case waits in the handler's queue.
2. **Blocked:** the item is no longer shown or served to anyone, its author included; every choke point of §4 answers
   with a placeholder "Treść zablokowana po zgłoszeniu.". A widget shows the same. A block can be undone ("Przywróć").
   The handler decides to block; a report alone never blocks anything, or anyone could take down anything. R1 shortens
   the cache of page files to one day, so that a blocked file disappears from browsers within a day; copies saved
   elsewhere cannot be recalled.
3. **The author is told why** through the bell: a new kind "Zablokowane treści" for the accounts that hold the author's
   role (for a group role, every holder). The notice names the item and the reason, as a category and an optional note
   sealed for the author's role, and offers "Odwołaj się". An author with a seat sees the notice in the seat's portal.
   An author known only by an anonymous receipt cannot be told; the case says so.
4. **Objection:** the author's answer is sealed for the handler. The handler restores the item or keeps the block.
5. **Delete for good:** after a period without a successful objection (proposed: 14 days, §16), or at once where the
   case is clear, the handler deletes the item: its rows and files go by ID (§4), and only the takedown row stays, so
   the log stays meaningful.
6. **The reporter is told the decision:** the receipt page shows "Usunięto", "Zablokowano", "Przywrócono" or "Bez
   zmian", never who wrote the item. Where the reporter left an e-mail address, the handler's browser opens a ready
   message in the handler's own mail program (`mailto:`); the address stays sealed in the report. The service sends no
   e-mail (§2), unless the owner decides to add it.

**The log** records each step: which item, which case, what action, who (a role, or an operator's person role) and
when, with no content. Console actions are logged the same way.

## 8. The operator

There is no operator console, and the brief asks before any new kind of superuser access. Proposed, for the owner to
decide:

- **Operators are named on the server.** `appsettings.Production.json` lists the operators' person roles
  (`Operator:RoleIds`), so nobody can add an operator from the web. The check takes only the account's own persons,
  never a role reached through an access link, so an operator cannot be made by forwarding a link.
- **What an operator may do:** see the queue of the operator's cases ("Zgłoszone treści", shown only to them); block,
  restore and delete by ID any item, each action logged; approve cards for the event catalogue ([EVENTS.md](EVENTS.md)
  §5.2), where this check replaces the usual "who tends the list".
- **The operator's key** for reported content is made by an operator's browser and granted to the operators' person
  roles, as a record's key is granted to its admins; when the list changes, an operator's browser tops it up.
- **A console mode** for emergencies, like `slug`: `reports list | block | restore | delete <kind> <id> --by <role>`,
  run where the connection string is. `--by` names the operator for the log; an action without a case opens one. A
  console holds no keys, so it reads no sealed text.

This adds one kind of power: acting on items in areas where the operator holds no certificate. It adds no key.

## 9. The operator's own pages

Drafted in step R1 for the owner to have reviewed, as static pages next to `/prywatnosc/`:

- **`/kontakt/`**, the contact point for users and for authorities (DSA art. 11, 12): who the operator is, an address,
  an e-mail address, and the languages in which one may write (to be confirmed by the owner's reviewer).
- **`/regulamin/`**, a section of the terms of use (DSA art. 14): what may be blocked, how reports are handled, how to
  object, and that suspected crimes are passed to the authorities.
- **Privacy information for the operator's own processing** (accounts and technical data), with Prezes UODO as the
  authority.

The operator's name, address and contact details come from the owner; none is invented here. Two facts the owner must
settle first:

- The live `/prywatnosc/` names the parish of św. Jana Chrzciciela in Kraków as the controller of the whole platform,
  with the diocesan IOD and the KIOD. The brief makes the operator the controller of its own processing, under Prezes
  UODO, and the processor for each organisation.
- The live page is out of date in places the owner should check: the Android app contains Firebase Cloud Messaging; the
  website loads OpenStreetMap tiles, Google Fonts and, for Python tasks, jsDelivr; the app asks for the camera; the
  service receives a key derived from the password at every sign-in; the AI link lets the service open chosen snapshots;
  the online heartbeat, Cogita game positions, AI link counts and data controller records are stored in plaintext. The
  Play listing's "the app talks only to REcreatio" is out of date for the same reason, and whether its "IP address in
  server logs" is right depends on webio's access logs (§16).

## 10. Data

A sketch; the migration takes the next free number.

```sql
CREATE TABLE app.report_case (                         -- one case per item and kind of report while it is open
    id            uniqueidentifier NOT NULL PRIMARY KEY,
    item_kind     nvarchar(12)     NOT NULL,           -- §4
    item_id       uniqueidentifier NOT NULL,
    item_at       datetimeoffset   NULL,               -- one occurrence of an appointment; NULL: the whole item
    area_id       uniqueidentifier NULL,               -- found when opened; NULL for items without an area
    controller_id uniqueidentifier NULL,               -- the record that applied when opened
    handler       nvarchar(10)     NOT NULL,           -- controller | operator
    kind          nvarchar(8)      NOT NULL,           -- data | illegal | other
    state         nvarchar(10)     NOT NULL,           -- received | blocked | objected | deleted | restored | rejected
    opened_by     nvarchar(10)     NOT NULL,           -- report | handler
    objection     varbinary(max)   NULL,               -- sealed for the handler
    opened_at     datetimeoffset   NOT NULL,
    due_at        datetimeoffset   NULL,               -- one month for "data"
    closed_at     datetimeoffset   NULL
);
CREATE TABLE app.report (                              -- each reporter's own row
    id             uniqueidentifier NOT NULL PRIMARY KEY,
    case_id        uniqueidentifier NOT NULL REFERENCES app.report_case (id),
    sealed         varbinary(max)   NULL,              -- reason, contact, attached content; emptied after retention
    receipt_sha256 binary(32)       NOT NULL,
    received_at    datetimeoffset   NOT NULL
);
CREATE TABLE app.takedown (                            -- the state the choke points read
    id          uniqueidentifier NOT NULL PRIMARY KEY,
    item_kind   nvarchar(12)     NOT NULL,
    item_id     uniqueidentifier NOT NULL,
    item_at     datetimeoffset   NULL,                 -- NULL: the whole item
    state       nvarchar(8)      NOT NULL,             -- blocked | deleted
    case_id     uniqueidentifier NOT NULL REFERENCES app.report_case (id),
    reason      nvarchar(16)     NOT NULL,             -- a category shown to the author
    note        varbinary(max)   NULL,                 -- sealed for the author's role
    since       datetimeoffset   NOT NULL
);
CREATE UNIQUE INDEX uq_takedown_item ON app.takedown (item_kind, item_id, item_at);
CREATE TABLE app.report_action (                       -- the log, without content
    id          uniqueidentifier NOT NULL PRIMARY KEY,
    case_id     uniqueidentifier NOT NULL,
    item_kind   nvarchar(12)     NOT NULL,
    item_id     uniqueidentifier NOT NULL,
    action      nvarchar(16)     NOT NULL,             -- received | blocked | restored | notified | objected | deleted | forwarded | asked | authorities | closed
    by_role_id  uniqueidentifier NULL,                 -- NULL only for "received"
    by_operator bit              NOT NULL,
    at          datetimeoffset   NOT NULL
);
CREATE TABLE app.operator_key (                        -- the public half of the operator's key (§8)
    id         uniqueidentifier NOT NULL PRIMARY KEY,
    public_key varbinary(1024)  NOT NULL,
    created_at datetimeoffset   NOT NULL
);
```

The private halves of the keys for reported content are `app.key_grant` rows of a new kind. The reporter's IP address,
user agent and account are not stored anywhere.

## 11. Service

| call | who |
|---|---|
| `POST /report/challenge`: a proof-of-work challenge | anyone |
| `GET /report/target?address=…` or `?kind=…&id=…`: the item, its parts and files to choose from, the handler's public key and who will handle it | anyone |
| `POST /report` `{ itemKind, itemId, itemAt?, kind, sealed, receiptSha256, proof }`: received, with its number | anyone |
| `POST /report/status` `{ receipt }`: the state and the decision, nothing about the author; the service hashes the receipt and looks it up | anyone with the receipt; limited per IP |
| `POST /workspace/report-case` `{ itemKind, itemId, itemAt?, kind }`: a case without a report | the admins of the record that applies to the item, and the operators |
| `GET /workspace/report-cases`: the queue | the admins of a record's home area (their cases); the operators (theirs) |
| `POST /workspace/report-case/{id}/block`, `…/restore`, `…/delete`, `…/reject`, `…/forward`, `…/ask`, `…/close` | the handler of the case |
| `POST /workspace/takedown/{id}/objection` `{ sealed }` | an account that holds the author's role; a seat through `/seat/{token}/…` |

The check for a controller: `Area.MayAsync(account, home area, Admin)`, and the record applies to the item's area now.
The check for an operator: one of the account's own persons is listed in `Operator:RoleIds`. Every write adds a row to
the log.

## 12. Retention

Proposed, for the owner to decide: the sealed parts (reason, contact, attached content, objection) are emptied six
months after a case is closed; the case, the takedown row and the log stay three years after it; the in-memory spam
counters live one hour. A case the owner needs for a dispute is kept until the dispute ends.

## 13. Why: the legal background

Recorded so that later readers understand the design. This is not legal advice: the owner has the texts users see
reviewed by someone with RODO practice.

- **Hosting duties under the DSA.** The operator has no general duty to monitor content (art. 8), but must offer an
  easy way to report specific items (art. 16). It confirms receipt, acts only on the reported item, and tells the author
  why (art. 17). Contact points (art. 11 and 12) and moderation rules in the terms (art. 14) apply to every provider. A
  suspected crime that threatens someone's life or safety must be reported to the authorities (art. 18).
- **The DSA in Poland.** The act of 4 September 2026, signed in September, makes the President of UKE the supervisor
  and introduces fines. Whether the DSA applies to REcreatio depends on whether it counts as an information society
  service, which is normally provided for remuneration. It is built this way regardless.
- **Identification by ID.** A controller that does not need to identify people need not collect extra data only to
  comply; when a person provides information that allows identification, such as an item's ID, their rights apply again
  (art. 11 RODO). That is why reports carry IDs, and why nothing has to search sealed content.
- **Controllers answer within a month** (art. 12(3) RODO); that is why RODO requests about an area with a record go to
  its controller, with the bell's reminders.
- **What the operator publishes itself.** An operator that publishes users' content to the public can be a controller
  of the personal data in it and cannot rely on the hosting exemption for its RODO duties (CJEU C-492/23, Russmedia,
  December 2025). That is why the event catalogue is approved and its cards carry no personal data ([EVENTS.md](EVENTS.md)).

Sources: [C-492/23 press release](https://curia.europa.eu/jcms/upload/docs/application/pdf/2025-12/cp250150en.pdf) ·
[Art. 11](https://iitr.de/en/gdpr/11) · [DSA art. 16](https://www.springlex.eu/en/packages/dsa/dsa-regulation/article-16/) ·
[Polish DSA act signed](https://uodo.gov.pl/pl/138/4587)

## 14. Plan

| step | what | migration |
|---|---|---|
| R1 | the report page and the "Zgłoś" entries, routing and sealing, the proof of work, the queue and cases opened by handlers, block and restore at every choke point of §4, delete for good per kind, the author's notice and objection, the receipt page, the log, operator access as decided, drafts of the operator's pages | next free |

R1 comes after A1 (it needs records, their home areas and their keys) and before E4 (the catalogue must not go public
before it). The kind `event` and the "Zgłoś" on catalogue cards come with [EVENTS.md](EVENTS.md) steps E1 and E4. R1 is
large; if the owner prefers, it is deployed in two parts: first reports, the queue, block, restore and the log; then
delete for good, the notices and objections. The usual order applies: the migration, the API, the website, the app.

## 15. Today → after

| today | after |
|---|---|
| nothing can be reported | "Zgłoś" on pages and their parts, files, forms, the join page, messages, file links, widgets and catalogue cards, and a report page that takes an address or an ID |
| nothing can be hidden by anyone but the item's own people | the handler blocks by ID at every choke point, and can restore |
| a controller cannot touch data it is named for | the home area's admins block and delete single items by ID, with or without a report |
| some items cannot be deleted at all (pages, single chat files, kept versions) | every reported kind has a delete for good by ID |
| no operator access | named operators, every action logged, and a console mode, as the owner decides |
| no terms of use or contact page, and a privacy page that names a parish as the platform's controller | drafts of a contact point, a moderation section and the operator's privacy information, for review |

## 16. Questions for the owner

1. **The operator:** name, address, e-mail and phone (optional) for the operator's pages, the processing terms and the
   clause where nobody is responsible; whether `/prywatnosc/` is replaced; who reads kontakt@recreatio.pl, and in which
   languages authorities may write.
2. **Operator access:** operators named on the server, the console mode, or both (§8); and which persons are operators.
3. **E-mail:** the receipt page plus the handler's own mail program (§7), or outbound e-mail through a mail provider,
   which would let the service read the address when sending.
4. **Items without an area** (public pages, their parts and files, `c/…` addresses): RODO requests about them go to the
   operator, who may forward them to the page's leaders (proposed), or to a controller derived from the page.
5. **Periods:** 14 days for objections (§7), and the retention of §12.
6. **The network in front of the API:** does a proxy or CDN stand before api.recreatio.pl, and how long does webio keep
   access logs with IP addresses? A proxy would make the per-IP counters count everyone together, because the service
   reads no forwarded headers.
