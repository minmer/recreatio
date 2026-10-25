# Reports and takedown

*Built 2026-10-25 (migration 0130). Companions: [DATA-CONTROLLER.md](DATA-CONTROLLER.md),
[EVENTS.md](EVENTS.md). Not legal advice.*

## The rule

Every report goes to the **operator** — the role that runs the service: `Operator:RoleId` in the server configuration,
otherwise the role that leads the page `start`. The operator decides: block, restore, delete for good, or reject.
Nothing is blocked or deleted without a report, and a report can only name what the reporter can read (the service
checks it per kind: public pages for anyone; a page bound to areas, a chat message, a library entry, a non-public form
or appointment only for someone who reads that area; a shared file or a link only by the id that follows from its
secret). Anyone can report, with or without an account (`#/zglos`).

## What is open and what is sealed

Open (so the item can be found): kind, id, page path, area and controller of the item, the reason category.
Sealed in the reporter's browser for the operator role's public wrap key (AES-GCM under a random key, the key wrapped
RSA-OAEP; labels `report_text` / `report_key`): the text, an optional contact, **what the reporter saw** (for sealed
content such as a chat message the operator has no key — he gets only what the reporter leaves in the report) and the
**decision secret** S. The service stores only SHA-256(S) and SHA-256(receipt); nothing about the reporter. A report
can only be decided by someone who opens it, and only about the item it names.

## Deciding

The operator opens the queue (**Sprawy**), unseals the report with the operator role's key and acts. Each decision sends
S and one **step of the chain**, signed in the browser with the operator role's signing key
(`TakedownEntryRecord`: sequence, hash of the previous step — the first hangs on 32 zero bytes —, report, item, action,
signer, time; same bytes as `core/dutyRecords.ts`). The service checks S, that the step is the next one and hangs on the
current head, and the signature — and only then applies the effect in the same transaction. "Sprawdź łańcuch"
recomputes every hash and link and checks every signature in the browser. The chain is the log: it is never emptied.

| Action | When | Effect |
| --- | --- | --- |
| block | new or restored report | a `takedown` row; the item is withheld everywhere (pages and files answer 451, parts become a "blocked" placeholder, messages lose their body, forms stop, appointments, library entries, shares and links disappear) |
| restore | blocked or objected | the takedown row goes; the item is back |
| delete | blocked for 14 days, or right after an objection | deleted by id, per kind (`Reports.DeleteForGoodAsync`); files after commit |
| reject | new report | nothing happens to the item |

No step gives anyone a key to content: blocking is a service-side refusal to serve; deleting removes rows the service
holds anyway.

## The author

The bell tells the author (the role that wrote the item, or leads its page) what is blocked, why, and until when he can
object. An objection is sealed for the operator like a report (`report_objection` / `report_objection_key`).

## Retention

Sealed texts (report and objection) are emptied 183 days after a final decision (deleted, restored, rejected) by a
daily sweep; what was reported and decided stays, the chain always. Rate limit: 10 reports and 10 status checks per IP
per hour, in memory, forgotten after an hour.

## Endpoints

Public: `GET /report/operator` (the operator role's public keys), `GET /report/target`, `POST /report`,
`POST /report/status`. Operator: `GET /workspace/reports`, `GET /workspace/reports/ledger`,
`POST /workspace/report/{id}/decide`. Author: `GET /workspace/takedowns`, `POST /workspace/takedown/{id}/objection`.
Code: `backend/Api/Reports/`, `frontend/src/app/reports/` (client `reports.ts`, `ReportPage.tsx`, `Sprawy.tsx`).
