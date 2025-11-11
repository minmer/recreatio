# Scenario 01 – Mass Intentions and Offerings

> This document specifies the **business flow, data model and security / key model** for handling **Mass intentions and offerings** in ReCreatio.

The goal is to support:

- entry and management of intentions and offerings by authorised parish staff,
- public display of selected information (e.g. intention lists on a website),
- strict protection of personal and financial data,
- auditability (who changed what and when),
- QR / link based access to selected slices of data (e.g. donor’s intention history).

---

## 1. Domain Overview

### 1.1 Actors

- **Parish** – organisational unit, has its own roles and keys.
- **Parish Priest / Vicar** – can see and manage all intentions and offerings for the parish.
- **Parish Office Staff** – can enter and edit intentions, may see offerings depending on configuration.
- **Donor (logged in)** – has a personal account and can:
  - see their own intentions and offerings,
  - receive QR / link to specific intentions.
- **Donor (anonymous)** – has no account, but:
  - receives a QR / link to their intention receipt,
  - can later associate it with an account.

### 1.2 Core Objects

- **Intention**
  - Mass time and place,
  - intention text (who / what the Mass is offered for),
  - optional public text (if different from internal),
  - links to offerings.

- **Offering**
  - amount (may be optional or hidden),
  - currency,
  - type (Mass offering, donation, etc.),
  - date,
  - link to donor (if known).

- **Donor Profile**
  - optional, only for logged-in donors,
  - basic personal data (name, email, etc.).

---

## 2. Data Model (Logical)

For simplicity we show only the most important fields.

```text
Parish(Id, Name, ...)
Intention(Id, ParishId, MassDateTime, ChurchName, PublicTextEnc, InternalTextEnc, DonorRefEnc, Status, ...)
Offering(Id, ParishId, IntentionId, AmountEnc, Currency, Date, DonorRefEnc, ...)
Donor(Id, UserId?, NameEnc, EmailEnc, ...)
IntentionHistoryLedger( IntentionId, Timestamp, ActorRoleId, ChangeType, Details )
```

All fields ending with `Enc` are **encrypted** with DataKeys (see below).

Public, non-sensitive fields such as `MassDateTime` and `ChurchName` may remain unencrypted to allow simple public listings.

---

## 3. Security & Key Model for Scenario 01

### 3.1 Roles

For each parish:

- `ParishRole` – represents the parish as an organisation.
- `ParishPriestRole` – represents the current parish priest.
- `ParishOfficeRole` – staff handling intentions and office work.
- `ParishFinanceRole` – staff allowed to see offering amounts.
- `ParishPublicRole` – technical role for public data (readonly, no secret keys).

Users (priests, staff) are members of the relevant roles via their MasterRoles.

### 3.2 DataKeys

Typical DataKeys:

- `DK_IntentionInternal` – encrypts:
  - `InternalTextEnc` (full internal intention text),
  - `DonorRefEnc` in Intention.
- `DK_IntentionPublic` – encrypts `PublicTextEnc` (if it should not be fully public).
- `DK_Offering` – encrypts:
  - `AmountEnc`,
  - `DonorRefEnc` in Offering.
- `DK_DonorProfile` – encrypts personal fields in Donor.

DataKey ownership:

- `DK_IntentionInternal` and `DK_IntentionPublic` are owned by `ParishRole` and are decryptable by:
  - `ParishPriestRole`,
  - `ParishOfficeRole`.
- `DK_Offering` is decryptable by:
  - `ParishFinanceRole`,
  - optionally `ParishPriestRole`.
- `DK_DonorProfile` is decryptable by:
  - the donor’s MasterRole,
  - selected parish roles if consent is given (e.g. for correspondence).

All relationships are expressed via RoleKeys and recorded in **Key Ledger**.

### 3.3 Public vs Private Data

- Public listings (website, printed sheets) use:
  - `MassDateTime`,
  - `ChurchName`,
  - `PublicTextEnc` decrypted by backend on behalf of `ParishPublicRole` if necessary.
- Internal systems for staff can also see:
  - `InternalTextEnc`,
  - donor references,
  - offering details.

Exactly **which fields** are shown in which UI is independent from encryption; encryption only guarantees that **no one without keys** can access them.

### 3.4 SharedViews and QR

For donors (especially anonymous):

- For each intention + offering we may create a **SharedView**:
  - view scope: “this intention with id I for donor X”,
  - associated **view role** with a ViewRoleKey,
  - SharedViewKey derived from QR secret.
- We store:

  ```text
  EncViewRoleKey = Enc(ViewRoleKey, SharedViewKey)
  ```

- QR / link is printed on the receipt or sent by email.

When QR is scanned:

1. Backend reconstructs `SharedViewKey`, decrypts `EncViewRoleKey` and obtains `ViewRoleKey`.
2. It uses `ViewRoleKey` to decrypt:
   - internal text of that intention (or subset),
   - offering details for that donor.
3. Returned information is limited strictly by the view role’s scope.

If the person later creates an account and logs in:

- the SharedView can be attached to their MasterRole via a membership record,
- the same data becomes accessible without QR.

Creation and use of SharedViews is written to **Business Ledger** and **Key Ledger**.

---

## 4. Main Flows

### 4.1 Creating an Intention and Offering (Office Staff)

1. Staff logs in (Normal or Secure Mode).
2. Frontend sends the new intention data to the backend.
3. Backend:
   - authenticates user and loads their roles,
   - verifies they are member of `ParishOfficeRole` (or admin),
   - resolves `DK_IntentionInternal`, `DK_IntentionPublic`, `DK_Offering`,
   - encrypts internal text, donor reference and offering fields.
4. Backend saves records and writes:
   - business event `IntentionCreated` to **Business Ledger**,
   - any key usage to **Key Ledger**.

### 4.2 Editing an Intention

1. User must be in `ParishOfficeRole` or `ParishPriestRole`.
2. Backend loads and decrypts the existing intention using DataKeys.
3. Changes are written and a `IntentionUpdated` event is stored in **Business Ledger** with:
   - `ActorRoleId`,
   - old and new values (optionally hashed / summarised).

### 4.3 Public Listing

1. Frontend requests intentions for a given parish and date range.
2. Backend:
   - resolves `DK_IntentionPublic` if public text is encrypted,
   - decrypts only fields needed for listing.
3. Data is returned without any sensitive donor or offering information.

No SharedView or user-related MasterKey is required to produce public listings.

---

## 5. Quiz / QR Interaction with Scenario 01 (Optional)

Although QR and SharedViews are more central in Scenario 02, they can also be used here:

- a donor may receive a QR code that:
  - shows history of their intentions in a given parish,
  - is scoped to a period or a specific Mass,
- the code technically represents a SharedView whose view role can decrypt only those specific records.

This reuse of the same mechanism keeps the foundation consistent across scenarios.

---

## 6. Auditability and Ledgers

For this scenario, the following ledger entries are typical:

- **Auth Ledger**
  - logins / logouts of priests and staff,
  - state changes of their accounts.

- **Key Ledger**
  - creation of DataKeys for parish intentions and offerings,
  - key rotations when parish leadership changes,
  - creation and revocation of SharedViews.

- **Business Ledger**
  - `IntentionCreated`, `IntentionUpdated`, `IntentionCancelled`,
  - `OfferingRegistered`, `OfferingCorrected`,
  - `SharedViewCreated`, `SharedViewUsed`, `SharedViewAttachedToUser`.

These logs allow reconstructing “who saw or changed what” even years later.

---

## 7. Summary

Scenario 01 is fully supported by the generic foundation:

- intentions and offerings are encrypted with DataKeys owned by parish roles,
- priests and staff access them via RoleKeys and the normal login flow,
- donors (logged-in or anonymous) access only their own slice via SharedViews and QR / links,
- all operations are auditable via the three ledgers.

The scenario therefore does not need special cryptographic tricks – it simply **instantiates** the general roles-and-keys model for the parish domain.
