# Who is responsible for the data

*Design, 2026-10-24. Not built. Companion to [EVENTS.md](EVENTS.md): every event takes its data controller from here.*

## 1. Today

Since 2026-10-17 the data controller ("Administrator danych") is set once per area in `app.area_controller`: area, name,
address, e-mail. It is plaintext on purpose, because the clause has to be readable before anyone types anything. An
area without its own entry uses the nearest one above it (`parent_area_id`, at most 16 levels). A form shows the one
from its area chain (`Form.WholeAsync`) and takes no submissions while the whole chain has none. The clause appears
under the form ("Administratorem danych jest …") and on the print sheet.

That fixed "every form asks for the same parish". Three gaps are left:

1. **Areas outside the chain start from nothing.** The same name and address have to be typed again for:
   - a standalone event or group (the starters offer "— samodzielny —"),
   - a group that belongs to a second organisation,
   - any new top-level area.

   A change of address then has to be repeated in every copy.
2. **The clause is incomplete.** It names only the controller. Two things are missing:
   - the data protection officer (IOD);
   - the authority that handles complaints: Prezes UODO for most organisations, the Kościelny Inspektor Ochrony
     Danych for Catholic church entities.

   The need "Zasady udziału, wizerunek i informacja o danych" (`formTemplates.ts`, `INFO`) names Prezes UODO in its
   fixed text. That is wrong for a parish.
3. **Other places that collect personal data show no controller.** This covers booking a slot, starting "Napisz do
   nas" and joining by link.

## 2. The idea

The controller becomes **a record of its own, stored once, that areas point to**, instead of text typed into each area.

```
 data_controller  "Parafia św. Kazimierza, ul. …, IOD …, KIOD"      home area: Parafia
        ▲                         ▲                              ▲
        │ points to               │ points to                    │ points to
   area Parafia           area Pielgrzymka 2027           area Oaza (standalone)
        │
   area Schola, area Bierzmowanie …   (no own entry: the nearest area above applies, as today)
```

- **What a record holds:** name, address, e-mail and phone (optional), the IOD with name and contact (optional), and
  the authority (`uodo` or `kiod`).
- **Who edits it:** every record has a **home area**, and whoever leads that area ("prowadzi") edits the record. A
  change applies at once to every area and form that uses it. The settings say where: "obowiązuje w 4 obszarach".
- **How areas use it:** an area **points to** one record or to none. With none, the nearest area above applies. The
  rule of 2026-10-17 does not change.
- **Picking instead of typing:** a new area **picks** a saved record in one click. It can pick:
  - records whose home area the account can read;
  - records already used by areas the account can read.

  Typing a new record is the exception.
- **Forms never ask.** A form shows the record from its area chain, as it does today. A form that answers to a
  different controller belongs in its own (sub-)area. The area is the unit of responsibility: there is one rule, and
  the clause always follows the form's area.
- **The same record is shown everywhere** personal data is collected in that area: the form, the print sheet, booking
  a slot, the start of "Napisz do nas", and the join page of a link.

## 3. Where it is stored, and why there

| option | verdict |
|---|---|
| a plaintext table `app.data_controller`, pointed to from `app.area_controller` | **chosen.** It is readable without keys, because the clause is for people without an account. There is one row per controller, and the area tree still decides which one applies |
| a copy per form (before 2026-10-17) | removed in step 3, because the copies drifted apart |
| an entry in the Library (person or organisation) | entries are sealed, so a public form could not show it |
| the office role | role names are sealed, and a role holds keys; it is not a legal entity |
| an "organisation" table | it would be a second hierarchy next to the area tree, which already is the organisation's structure |

## 4. Data

```sql
-- 0129 (the next free number at the time of writing)
CREATE TABLE app.data_controller (
    id            uniqueidentifier NOT NULL PRIMARY KEY,
    home_area_id  uniqueidentifier NOT NULL REFERENCES app.area (id),   -- whoever leads it edits the record
    name          nvarchar(200)  NOT NULL,                              -- CHECK: not blank
    address       nvarchar(400)  NULL,                                  -- normalised by PostalInput, as now
    email         nvarchar(200)  NULL,
    phone         nvarchar(40)   NULL,
    dpo_name      nvarchar(200)  NULL,                                  -- Inspektor ochrony danych
    dpo_contact   nvarchar(400)  NULL,                                  -- e-mail or postal address
    authority     nvarchar(8)    NOT NULL DEFAULT N'uodo',              -- CHECK IN (N'uodo', N'kiod')
    updated_at    datetimeoffset NOT NULL
);
ALTER TABLE app.area_controller ADD controller_id uniqueidentifier NULL REFERENCES app.data_controller (id);
```

- **Moving the existing rows.** Each existing `area_controller` row gets its own record, with that area as home, and
  the row points to it. Nothing is merged silently, because merging hands the editing over to one area's leaders.
  Instead, the settings offer the merge: "Ten sam administrator jest wpisany osobno w: Schola, Oaza — użyj jednego
  zapisu". It is offered only for areas the account leads.
- **Old and new columns.** While both exist, readers take the record and fall back to the old columns. After the API
  and the website are deployed, a later migration drops `area_controller.name/address/email` and makes
  `controller_id` required. This is the same pattern as step 3 in TRANSFER.md.
- **Account deletion.** If a record's home area is deleted while other areas still use the record, its home moves to
  one of those areas. An unused record is deleted with its area.

## 5. Service

| call | who |
|---|---|
| `GET /workspace/controllers`: the records the account may pick, with "used in N areas" | any account |
| `POST /workspace/controllers`: a new record `{ homeAreaId, name, … }` | admin of the home area |
| `POST /workspace/controller/{id}`: change a record | admin of its home area |
| `POST /workspace/area/{id}/controller`: `{ controllerId }` or `{ inherit: true }`. The old body `{ name, address, email }` still writes the area's own record, for old clients | admin of the area |
| `GET /workspace/area/{id}/controller`: the record that applies, plus `fromAreaId`. Same shape as now, with more fields | reader of the area |

These read through the record from then on: `Form.WholeAsync`, `Form.Public` (the intake areas of fields),
`Intake.PublicAsync`, `AccountDeletion`, and the address tidy-up (`TidyEverything`).

## 6. Browser

- **Obszar → Ustawienia → Administrator danych.** It shows the record that applies (own or inherited, as now), with
  these actions:
  - "Wybierz zapisanego…";
  - "Nowy administrator";
  - "Zmień dane", only in the home area, saying where the change applies;
  - "Dziedzicz z obszaru wyżej".
- **Formularz → Ustawienia.** `FormControllerNote` stays where it is and also shows the IOD and the authority.
- **New area, "Nowe wydarzenie", starters.** They say which record will apply. When the chain has none, they offer the
  saved records first, so a standalone area is never blocked from taking submissions.
- **Kartoteka → Porządek w całej bazie** normalises the addresses of the records instead of copies per area.

## 7. The clause

It is generated from the record, one sentence per part:

> Administratorem danych jest Parafia św. Kazimierza, ul. … (kancelaria@…). Inspektor ochrony danych: … (iod@…).
> Skargę można złożyć do Kościelnego Inspektora Ochrony Danych.

The need "Zasady udziału…" then drops its own sentence about Prezes UODO, because the authority comes from the
record. Old forms keep their text until their author edits it; the tidy-up can offer the replacement.

## 8. Plan

1. Migration 0129, the service calls, and settings with picking. One deploy: the API first, then the website.
2. The clause with IOD and authority, and the same line when booking a slot, starting "Napisz do nas" and joining by
   link.
3. The later migration that drops the old columns.

## 9. Open questions

- **Joint controllers** (współadministratorzy, art. 26 RODO) for co-organised events: an area could point to more
  than one record. Not part of step 1.
- **The full art. 13 information:** should it appear under every form, with purpose and retention set per form?
  Today it comes only with the need "Zasady…".
