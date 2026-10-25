# Who is responsible for the data

*Built 2026-10-25 (migration 0129). Companions: [REPORTS.md](REPORTS.md) (reports go to the operator) and
[EVENTS.md](EVENTS.md). Not legal advice.*

## The rule

Nothing is collected in an area unless someone answers for its data. Without a data controller ("Administrator danych")
the service refuses: form submissions, bookings, and new messages or new conversations in area, channel and seat chats
(this includes "Napisz do nas"). A **public page** cannot be saved unless an area answers for it. Two-person, group and
own chats need nobody: the people in them answer for themselves; reports about them still go to the operator.
A link with access is never blocked — its page shows the clause of every area it leads into.

The **operator** (whoever runs recreatio.pl) processes the data on the controllers' behalf. Name and contact are in
`frontend/src/app/operator.ts`, the one place to change them; every clause names the operator.

## The model

| Table | What it holds |
| --- | --- |
| `data_controller` | One record per organisation, plaintext (the clause must be readable before anyone types), with a **home area** whose admins change it. Closed instead of deleted. |
| `data_controller_version` | Every change is a version: name, address, e-mail, phone, DPO name/contact, authority (`uodo` / `kiod`), who wrote it, whether someone confirmed they may act for the organisation. |
| `controller_attachment` | Makes a record apply to an area: `asked` → `live` (signed) / `refused` / `cancelled`; `offered` → `live`; `live` → `ended` (withdrawn, left, replaced, closed, home-deleted, area-deleted). At most one live attachment per area. |
| `controller_terms` | Which version of the processing terms (umowa powierzenia) a record accepted. Today: `2026-10` (`Controllers.TermsVersion`, `TERMS_VERSION`). |
| `area_parent_ended` | Parent links that an account deletion cut, with the date — so the chain at a past moment is still known. |
| `slug.controller_area_id` | The area that answers for a page and the pages below it. |

**What applies** to an area at time T: the live attachment of the nearest area up the chain (itself, then its parents,
at most 16 steps), in the record's version at T. `Controllers.OfAreaAsync`; `GET /workspace/area/{id}/controller?at=`
answers for any past date.

## Signatures

An attachment is a statement made for an organisation, so it is signed in the browser with the signing key of a role
that is admin of the record's **home** area (`ControllerAttachmentRecord`, `core/dutyRecords.ts`; same canonical bytes,
checked by `Kernel.Tests` and `scripts/app-duty-check.mjs`). The service only verifies: role is the caller's, holds
`admin` on the home area, signature matches, clock within an hour. Anyone can check a clause:
`GET /controller/{id}?area=` returns all versions plus the signature, the signer's public key and the certificate that
let the signer sign (with the issuer's key). Attachments moved by 0129 from `area_controller` carry no signature and say
so.

Admin is admin, however it was obtained (directly, through a held role, or a redeemed link): the check is the live
`admin` certificate on the exact area.

## Flows (area settings → "Administrator danych")

- **New record** — fields, "I may act for this organisation", accept the terms; it applies at once to its home area
  (the creator signs).
- **Choose an existing record** — if I lead its home area it applies at once (signed); otherwise it is an ask to the
  home area, which signs ("Podpisz i przyjmij") or refuses.
- **Offer** — the home area signs and offers its record to another area, which accepts (or it applies at once when I
  lead both).
- **Inherit** — end the own attachment; the area takes what applies above it.
- **Withdraw / close** — the home ends one use, or closes the record everywhere (history stays).
- **Pages** — page editor → "Kto odpowiada za tę stronę": an area I lead that has a controller
  (`POST /workspace/slug/controller`). Pages below inherit it. The page footer shows it, with "Zgłoś".

The bell ("Sprawy do decyzji") lists asks, offers, decisions, areas that lost their controller, records missing terms
or data, and public pages I lead with nobody responsible.

## Account deletion

Records homed in deleted areas close; their attachments end (`home-deleted`), so the areas that used them stop
collecting until someone names a new controller. Deleted areas' attachments end (`area-deleted`); cut parent links go
to `area_parent_ended`. Certificates that signatures refer to are revoked, not deleted. The deletion preview names the
records that will stop applying.

## Endpoints

`GET|POST /workspace/area/{id}/controller` · `GET|POST /workspace/controllers` · `POST /workspace/controller/{id}`
(version) · `…/close` · `…/terms` · `…/offer` · `POST /workspace/attachment/{id}/decide|end` ·
`POST /workspace/slug/controller` · public: `GET /area/{id}/controller`, `GET /controller/{id}`.
Code: `backend/Api/Areas/Controllers*.cs`, `frontend/src/app/areas/controllers.ts`, `AreaController.tsx`,
`ControllerClause.tsx`, `clause.ts`, `pages/PageResponsible.tsx`.
